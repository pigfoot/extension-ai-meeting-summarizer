/**
 * Azure configuration storage schema for the Meeting Summarizer Chrome Extension
 * Provides secure storage schemas and utilities for Azure Speech Service configuration
 * with encryption support building upon the existing storage base architecture.
 */

import { createStorage } from '../base/base';
import { StorageEnum } from '../base/enums';
import type { BaseStorageType } from '../base/types';
// Use generic types to avoid circular dependency with shared package
interface AzureSpeechConfig {
  subscriptionKey?: string;
  serviceRegion?: string;
  language?: string;
  endpoint?: string;
  customModel?: string;
  enableSpeakerDiarization?: boolean;
  enableWordLevelTimestamps?: boolean;
  profanityAction?: 'None' | 'Removed' | 'Masked';
  punctuationAction?: 'None' | 'Dictated' | 'Automatic' | 'DictatedAndAutomatic';
  metadata?: Record<string, string>;
  requestTimeout?: number;
  maxSpeakers?: number;
  phraseHints?: string[];
}

type UserPreferences = Record<string, unknown>;
type ExtensionSettings = Record<string, unknown>;

/**
 * Configuration validation error types
 */
export type ConfigValidationError =
  | 'INVALID_SUBSCRIPTION_KEY'
  | 'INVALID_REGION'
  | 'INVALID_LANGUAGE'
  | 'INVALID_ENDPOINT'
  | 'MISSING_REQUIRED_FIELDS'
  | 'INVALID_TIMEOUT'
  | 'INVALID_SPEAKERS_COUNT'
  | 'INVALID_PHRASE_HINTS'
  | 'ENCRYPTION_FAILED'
  | 'DECRYPTION_FAILED';

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  /** Whether validation passed */
  isValid: boolean;
  /** Validation errors if any */
  errors: ConfigValidationError[];
  /** Warning messages */
  warnings: string[];
  /** Validation timestamp */
  validatedAt: string;
}

/**
 * Encrypted configuration wrapper
 */
export interface EncryptedConfig<T> {
  /** Encrypted data */
  encryptedData: string;
  /** Encryption algorithm used */
  algorithm: string;
  /** Initialization vector for encryption */
  iv: string;
  /** Salt used for key derivation */
  salt: string;
  /** Timestamp when encrypted */
  encryptedAt: string;
  /** Configuration version for migration support */
  version: string;
  /** Checksum for integrity verification */
  checksum: string;
}

/**
 * Azure configuration storage with encryption
 */
export interface SecureAzureConfig extends EncryptedConfig<AzureSpeechConfig> {
  /** Configuration ID for management */
  configId: string;
  /** Display name for configuration */
  displayName: string;
  /** Whether this is the active configuration */
  isActive: boolean;
  /** Last validated timestamp */
  lastValidated?: string;
  /** Validation result */
  validationResult?: ConfigValidationResult;
}

/**
 * Configuration backup entry
 */
export interface ConfigBackup {
  /** Backup ID */
  backupId: string;
  /** Backup timestamp */
  createdAt: string;
  /** Configuration snapshot */
  azureConfig?: SecureAzureConfig;
  /** User preferences snapshot */
  userPreferences?: UserPreferences;
  /** Extension settings snapshot */
  extensionSettings?: ExtensionSettings;
  /** Backup description */
  description?: string;
  /** Backup size in bytes */
  backupSize: number;
}

/**
 * Configuration history entry for audit trail
 */
export interface ConfigHistoryEntry {
  /** History entry ID */
  entryId: string;
  /** Timestamp of change */
  timestamp: string;
  /** Type of change */
  changeType: 'created' | 'updated' | 'deleted' | 'validated' | 'encrypted' | 'restored';
  /** Configuration that was changed */
  configType: 'azure' | 'preferences' | 'settings' | 'auth';
  /** Configuration ID that was affected */
  configId: string;
  /** Description of change */
  description: string;
  /** Previous values (encrypted) */
  previousValues?: string;
  /** New values (encrypted) */
  newValues?: string;
  /** User agent or source of change */
  source: string;
}

/**
 * Simple encryption utilities using Web Crypto API
 */
export const encryptionUtils = {
  /**
   * Generate a random salt
   */
  generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(32));
  },

  /**
   * Generate a random initialization vector
   */
  generateIV(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(12));
  },

  /**
   * Derive encryption key from password using PBKDF2
   */
  async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), { name: 'PBKDF2' }, false, [
      'deriveBits',
      'deriveKey',
    ]);

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as BufferSource,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  },

  /**
   * Encrypt data using AES-GCM
   */
  async encrypt<T>(data: T, password: string): Promise<EncryptedConfig<T>> {
    try {
      const salt = this.generateSalt();
      const iv = this.generateIV();
      const key = await this.deriveKey(password, salt);

      const encoder = new TextEncoder();
      const dataString = JSON.stringify(data);
      const dataBuffer = encoder.encode(dataString);

      const encryptedBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, dataBuffer);

      const encryptedArray = new Uint8Array(encryptedBuffer);
      const encryptedData = btoa(String.fromCharCode(...encryptedArray));

      // Generate checksum for integrity
      const checksumBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
      const checksumArray = new Uint8Array(checksumBuffer);
      const checksum = btoa(String.fromCharCode(...checksumArray));

      return {
        encryptedData,
        algorithm: 'AES-GCM',
        iv: btoa(String.fromCharCode(...iv)),
        salt: btoa(String.fromCharCode(...salt)),
        encryptedAt: new Date().toISOString(),
        version: '1.0',
        checksum,
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Decrypt data using AES-GCM
   */
  async decrypt<T>(encryptedConfig: EncryptedConfig<T>, password: string): Promise<T> {
    try {
      const salt = new Uint8Array(
        atob(encryptedConfig.salt)
          .split('')
          .map(char => char.charCodeAt(0)),
      );

      const iv = new Uint8Array(
        atob(encryptedConfig.iv)
          .split('')
          .map(char => char.charCodeAt(0)),
      );

      const encryptedData = new Uint8Array(
        atob(encryptedConfig.encryptedData)
          .split('')
          .map(char => char.charCodeAt(0)),
      );

      const key = await this.deriveKey(password, salt);

      const decryptedBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, encryptedData);

      const decoder = new TextDecoder();
      const decryptedString = decoder.decode(decryptedBuffer);

      // Verify checksum
      const dataBuffer = new TextEncoder().encode(decryptedString);
      const checksumBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
      const checksumArray = new Uint8Array(checksumBuffer);
      const checksum = btoa(String.fromCharCode(...checksumArray));

      if (checksum !== encryptedConfig.checksum) {
        throw new Error('Data integrity check failed');
      }

      return JSON.parse(decryptedString);
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
};

/**
 * Azure configuration validation
 */
export const validateAzureConfig = (config: Partial<AzureSpeechConfig>): ConfigValidationResult => {
  const errors: ConfigValidationError[] = [];
  const warnings: string[] = [];

  // Subscription key validation
  if (!config.subscriptionKey || typeof config.subscriptionKey !== 'string') {
    errors.push('INVALID_SUBSCRIPTION_KEY');
  } else if (config.subscriptionKey.length !== 32) {
    warnings.push('Azure subscription key should typically be 32 characters long');
  }

  // Region validation
  const validRegions = [
    'eastus',
    'eastus2',
    'southcentralus',
    'westus2',
    'westus3',
    'australiaeast',
    'southeastasia',
    'northeurope',
    'swedencentral',
    'uksouth',
    'westeurope',
    'centralus',
    'southafricanorth',
    'centralindia',
    'eastasia',
    'japaneast',
    'koreacentral',
  ];

  if (!config.serviceRegion || !validRegions.includes(config.serviceRegion)) {
    errors.push('INVALID_REGION');
  }

  // Language validation
  if (!config.language || typeof config.language !== 'string') {
    errors.push('INVALID_LANGUAGE');
  } else {
    const languagePattern = /^[a-z]{2}-[A-Z]{2}$/;
    if (!languagePattern.test(config.language)) {
      warnings.push('Language should be in format "xx-XX" (e.g., "en-US", "zh-TW")');
    }
  }

  // Endpoint validation if provided
  if (config.endpoint) {
    try {
      new URL(config.endpoint);
    } catch {
      errors.push('INVALID_ENDPOINT');
    }
  }

  // Timeout validation
  if (config.requestTimeout !== undefined) {
    if (typeof config.requestTimeout !== 'number' || config.requestTimeout < 1000 || config.requestTimeout > 300000) {
      errors.push('INVALID_TIMEOUT');
    }
  }

  // Max speakers validation
  if (config.maxSpeakers !== undefined) {
    if (typeof config.maxSpeakers !== 'number' || config.maxSpeakers < 2 || config.maxSpeakers > 10) {
      errors.push('INVALID_SPEAKERS_COUNT');
    }
  }

  // Phrase hints validation
  if (config.phraseHints) {
    if (!Array.isArray(config.phraseHints)) {
      errors.push('INVALID_PHRASE_HINTS');
    } else if (config.phraseHints.length > 100) {
      warnings.push('Large number of phrase hints may impact performance');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    validatedAt: new Date().toISOString(),
  };
};

/**
 * Secure Azure configuration serialization
 */
export const secureAzureConfigSerialization = {
  /**
   * Serialize secure Azure configuration
   */
  serialize: (config: SecureAzureConfig): string => {
    try {
      return JSON.stringify(config);
    } catch (error) {
      console.error('Failed to serialize Azure configuration:', error);
      throw new Error('Configuration serialization failed');
    }
  },

  /**
   * Deserialize secure Azure configuration
   */
  deserialize: (text: string): SecureAzureConfig | null => {
    try {
      if (!text || text.trim() === '') {
        return null;
      }

      const parsed = JSON.parse(text);

      // Validate required fields
      if (!parsed.encryptedData || !parsed.algorithm || !parsed.iv || !parsed.salt) {
        throw new Error('Invalid encrypted configuration format');
      }

      return parsed as SecureAzureConfig;
    } catch (error) {
      console.error('Failed to deserialize Azure configuration:', error);
      return null;
    }
  },
};

/**
 * Configuration history serialization
 */
export const configHistorySerialization = {
  serialize: (history: ConfigHistoryEntry[]): string => {
    try {
      return JSON.stringify(history);
    } catch (error) {
      console.error('Failed to serialize configuration history:', error);
      return JSON.stringify([]);
    }
  },

  deserialize: (text: string): ConfigHistoryEntry[] => {
    try {
      if (!text || text.trim() === '') {
        return [];
      }
      return JSON.parse(text);
    } catch (error) {
      console.error('Failed to deserialize configuration history:', error);
      return [];
    }
  },
};

/**
 * Creates secure Azure configuration storage
 */
export const createSecureAzureConfigStorage = (): BaseStorageType<SecureAzureConfig | null> => {
  return createStorage('azureConfig', null, {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
    serialization: {
      serialize: (config: SecureAzureConfig | null) => {
        return config ? secureAzureConfigSerialization.serialize(config) : '';
      },
      deserialize: (text: string) => {
        return secureAzureConfigSerialization.deserialize(text);
      },
    },
  });
};

/**
 * Creates user preferences storage
 */
export const createUserPreferencesStorage = (): BaseStorageType<UserPreferences> => {
  const defaultPreferences: UserPreferences = {
    defaultLanguage: 'en-US',
    autoStartTranscription: false,
    enableNotifications: true,
    autoSaveTranscriptions: true,
    enableSpeakerDiarization: true,
    transcriptionQuality: 'balanced',
    theme: 'system',
    maxStorageSize: 500, // 500MB
    dataRetentionDays: 90,
    privacySettings: {
      shareAnalytics: false,
      localStorageOnly: true,
      encryptData: true,
      autoDeleteOldData: true,
      confirmDataSharing: true,
    },
    keyboardShortcuts: {
      toggleTranscription: 'Ctrl+Shift+T',
      openSidePanel: 'Ctrl+Shift+S',
      saveMeeting: 'Ctrl+Shift+M',
      quickSummary: 'Ctrl+Shift+Q',
    },
  };

  return createStorage('userPreferences', defaultPreferences, {
    storageEnum: StorageEnum.Sync, // Use sync storage for cross-device preferences
    liveUpdate: true,
    serialization: {
      serialize: (prefs: UserPreferences) => JSON.stringify(prefs),
      deserialize: (text: string) => {
        try {
          return text ? JSON.parse(text) : defaultPreferences;
        } catch {
          return defaultPreferences;
        }
      },
    },
  });
};

/**
 * Creates extension settings storage
 */
export const createExtensionSettingsStorage = (): BaseStorageType<ExtensionSettings> => {
  const defaultSettings: ExtensionSettings = {
    version: '1.0.0',
    installedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    featureFlags: {
      realTimeTranscription: true,
      aiSummarization: true,
      actionItemExtraction: true,
      multiLanguageSupport: true,
      batchProcessing: false,
      speakerIdentification: true,
      sentimentAnalysis: false,
    },
    debugMode: false,
    telemetryEnabled: true,
    updateChannel: 'stable',
  };

  return createStorage('extensionSettings', defaultSettings, {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
    serialization: {
      serialize: (settings: ExtensionSettings) => JSON.stringify(settings),
      deserialize: (text: string) => {
        try {
          return text ? JSON.parse(text) : defaultSettings;
        } catch {
          return defaultSettings;
        }
      },
    },
  });
};

/**
 * Creates configuration history storage
 */
export const createConfigHistoryStorage = (): BaseStorageType<ConfigHistoryEntry[]> => {
  return createStorage('configHistory', [], {
    storageEnum: StorageEnum.Local,
    liveUpdate: false,
    serialization: configHistorySerialization,
  });
};

/**
 * Creates configuration backup storage
 */
export const createConfigBackupStorage = (): BaseStorageType<ConfigBackup[]> => {
  return createStorage('configBackups', [], {
    storageEnum: StorageEnum.Local,
    liveUpdate: false,
    serialization: {
      serialize: (backups: ConfigBackup[]) => JSON.stringify(backups),
      deserialize: (text: string) => {
        try {
          return text ? JSON.parse(text) : [];
        } catch {
          return [];
        }
      },
    },
  });
};

/**
 * Configuration management utilities
 */
export const configUtils = {
  /**
   * Create encrypted Azure configuration
   */
  async createEncryptedAzureConfig(
    config: AzureSpeechConfig,
    password: string,
    displayName: string = 'Default Configuration',
  ): Promise<SecureAzureConfig> {
    const validation = validateAzureConfig(config);
    if (!validation.isValid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    const encrypted = await encryptionUtils.encrypt(config, password);

    return {
      ...encrypted,
      configId: crypto.randomUUID(),
      displayName,
      isActive: true,
      lastValidated: validation.validatedAt,
      validationResult: validation,
    };
  },

  /**
   * Decrypt Azure configuration
   */
  async decryptAzureConfig(secureConfig: SecureAzureConfig, password: string): Promise<AzureSpeechConfig> {
    return encryptionUtils.decrypt(secureConfig, password);
  },

  /**
   * Add configuration history entry
   */
  async addConfigHistoryEntry(
    historyStorage: BaseStorageType<ConfigHistoryEntry[]>,
    entry: Omit<ConfigHistoryEntry, 'entryId' | 'timestamp'>,
  ): Promise<void> {
    const history = await historyStorage.get();
    const newEntry: ConfigHistoryEntry = {
      ...entry,
      entryId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };

    // Keep only last 100 entries
    const updatedHistory = [newEntry, ...history].slice(0, 100);
    await historyStorage.set(updatedHistory);
  },

  /**
   * Create configuration backup
   */
  async createConfigBackup(
    azureConfig?: SecureAzureConfig,
    userPreferences?: UserPreferences,
    extensionSettings?: ExtensionSettings,
    description?: string,
  ): Promise<ConfigBackup> {
    const backup: ConfigBackup = {
      backupId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      backupSize: 0,
      ...(azureConfig && { azureConfig }),
      ...(userPreferences && { userPreferences }),
      ...(extensionSettings && { extensionSettings }),
      ...(description && { description }),
    };

    // Calculate backup size
    const backupData = JSON.stringify(backup);
    backup.backupSize = new Blob([backupData]).size;

    return backup;
  },

  /**
   * Restore configuration from backup
   */
  async restoreFromBackup(
    backup: ConfigBackup,
    azureStorage: BaseStorageType<SecureAzureConfig | null>,
    preferencesStorage: BaseStorageType<UserPreferences>,
    settingsStorage: BaseStorageType<ExtensionSettings>,
  ): Promise<void> {
    if (backup.azureConfig) {
      await azureStorage.set(backup.azureConfig);
    }

    if (backup.userPreferences) {
      await preferencesStorage.set(backup.userPreferences);
    }

    if (backup.extensionSettings) {
      await settingsStorage.set(backup.extensionSettings);
    }
  },
};
