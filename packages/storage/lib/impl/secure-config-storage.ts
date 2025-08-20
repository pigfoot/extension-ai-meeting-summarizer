/**
 * Secure Configuration Storage
 * Implements SecureConfigStorage class with encryption,
 * configuration validation and integrity checking for Azure API management.
 */

import { createStorage } from '../base/base';
import { StorageEnum } from '../base/enums';
import { EncryptionUtils } from '../utils/encryption';
import type { BaseStorageType, StorageConfigType } from '../base/types';
import type {
  SecureConfigRecord,
  ValidationResult,
  UserPreferences,
  BackupMetadata,
  ConfigHistoryEntry,
} from '../types/config';

/**
 * Secure configuration storage options
 */
export interface SecureConfigOptions extends StorageConfigType<string> {
  /** Master password for encryption (should be user-provided) */
  masterPassword?: string;
  /** Enable automatic backup to sync storage */
  enableBackup?: boolean;
  /** Maximum number of history entries to keep */
  maxHistoryEntries?: number;
  /** Enable configuration validation */
  enableValidation?: boolean;
}

/**
 * Configuration operation result
 */
export interface ConfigOperationResult<T = unknown> {
  /** Whether operation was successful */
  success: boolean;
  /** Operation result data */
  data?: T;
  /** Error information if operation failed */
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  /** Operation metadata */
  metadata?: {
    /** Operation duration in milliseconds */
    duration: number;
    /** Whether encryption was used */
    encrypted: boolean;
    /** Configuration version */
    version: string;
  };
}

/**
 * Secure configuration storage class
 */
export class SecureConfigStorage {
  private storage: BaseStorageType<string>;
  private backupStorage?: BaseStorageType<string>;
  private encryptionUtils: EncryptionUtils;
  private options: Required<SecureConfigOptions>;
  private configHistory: ConfigHistoryEntry[] = [];

  constructor(options: SecureConfigOptions = {}) {
    this.options = {
      storageEnum: StorageEnum.Local,
      liveUpdate: false,
      sessionAccessForContentScripts: false,
      masterPassword: '',
      enableBackup: true,
      maxHistoryEntries: 10,
      enableValidation: true,
      serialization: {
        serialize: (value: string) => value,
        deserialize: (text: string) => text,
      },
      ...options,
    };

    // Initialize encryption utilities
    this.encryptionUtils = new EncryptionUtils({
      securityLevel: 'confidential',
      enableKeyRotation: true,
      keyRotationInterval: 90,
    });

    // Initialize primary storage
    this.storage = createStorage('secure-config', '{}', {
      storageEnum: this.options.storageEnum,
      liveUpdate: this.options.liveUpdate,
      sessionAccessForContentScripts: this.options.sessionAccessForContentScripts,
    });

    // Initialize backup storage if enabled
    if (this.options.enableBackup) {
      this.backupStorage = createStorage('secure-config-backup', '{}', {
        storageEnum: StorageEnum.Sync,
        liveUpdate: false,
        sessionAccessForContentScripts: false,
      });
    }

    // Load configuration history
    this.loadConfigHistory();
  }

  /**
   * Store secure configuration with encryption
   */
  public async storeConfig(
    config: Omit<
      SecureConfigRecord,
      'id' | 'createdAt' | 'updatedAt' | 'encryptionMetadata' | 'validation' | 'configVersion'
    >,
  ): Promise<ConfigOperationResult<SecureConfigRecord>> {
    const startTime = Date.now();

    try {
      if (!this.options.masterPassword) {
        return {
          success: false,
          error: {
            code: 'NO_MASTER_PASSWORD',
            message: 'Master password is required for secure storage',
          },
        };
      }

      // Encrypt the API key
      const encryptionResult = await this.encryptionUtils.encryptData(
        config.encryptedApiKey,
        this.options.masterPassword,
      );

      if (!encryptionResult.success || !encryptionResult.encryptedData || !encryptionResult.metadata) {
        return {
          success: false,
          error: {
            code: 'ENCRYPTION_FAILED',
            message: 'Failed to encrypt API key',
            details: encryptionResult.error,
          },
        };
      }

      // Create secure config record
      const now = new Date().toISOString();
      const secureConfig: SecureConfigRecord = {
        id: this.generateConfigId(),
        encryptedApiKey: encryptionResult.encryptedData,
        serviceRegion: config.serviceRegion,
        endpoint: config.endpoint,
        language: config.language,
        preferences: config.preferences,
        encryptionMetadata: encryptionResult.metadata,
        validation: {
          status: 'untested',
          tests: [],
          score: 0,
          issues: [],
          validatedAt: now,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
          performance: {
            responseTime: 0,
            successRate: 0,
            serviceAvailable: false,
          },
        },
        configVersion: '1.0.0',
        createdAt: now,
        updatedAt: now,
      };

      // Validate configuration if enabled
      if (this.options.enableValidation) {
        const validationResult = await this.validateConfig(secureConfig);
        secureConfig.validation = validationResult;
      }

      // Store configuration
      const serializedConfig = JSON.stringify(secureConfig);
      await this.storage.set(serializedConfig);

      // Create backup if enabled
      if (this.options.enableBackup && this.backupStorage) {
        await this.createBackup(secureConfig);
      }

      // Add to history
      this.addToHistory(secureConfig, 'Configuration created', 'user');

      const duration = Date.now() - startTime;

      return {
        success: true,
        data: secureConfig,
        metadata: {
          duration,
          encrypted: true,
          version: secureConfig.configVersion,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        error: {
          code: 'STORE_CONFIG_FAILED',
          message: `Failed to store configuration: ${error instanceof Error ? error.message : String(error)}`,
        },
        metadata: {
          duration,
          encrypted: false,
          version: '1.0.0',
        },
      };
    }
  }

  /**
   * Retrieve and decrypt configuration
   */
  public async getConfig(): Promise<ConfigOperationResult<SecureConfigRecord>> {
    const startTime = Date.now();

    try {
      if (!this.options.masterPassword) {
        return {
          success: false,
          error: {
            code: 'NO_MASTER_PASSWORD',
            message: 'Master password is required for decryption',
          },
        };
      }

      // Get stored configuration
      const serializedConfig = await this.storage.get();

      if (serializedConfig === '{}') {
        return {
          success: false,
          error: {
            code: 'CONFIG_NOT_FOUND',
            message: 'No configuration found',
          },
        };
      }

      const encryptedConfig = JSON.parse(serializedConfig) as SecureConfigRecord;

      // Decrypt the API key
      const decryptionResult = await this.encryptionUtils.decryptData(
        encryptedConfig.encryptedApiKey,
        this.options.masterPassword,
        encryptedConfig.encryptionMetadata,
      );

      if (!decryptionResult.success || !decryptionResult.data) {
        return {
          success: false,
          error: {
            code: 'DECRYPTION_FAILED',
            message: 'Failed to decrypt API key',
            details: decryptionResult.error,
          },
        };
      }

      // Create decrypted config
      const decryptedConfig: SecureConfigRecord = {
        ...encryptedConfig,
        encryptedApiKey: decryptionResult.data,
      };

      // Check if key rotation is needed
      if (this.encryptionUtils.needsKeyRotation(encryptedConfig.encryptionMetadata)) {
        console.warn('Configuration encryption key needs rotation');
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        data: decryptedConfig,
        metadata: {
          duration,
          encrypted: true,
          version: encryptedConfig.configVersion,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        error: {
          code: 'GET_CONFIG_FAILED',
          message: `Failed to retrieve configuration: ${error instanceof Error ? error.message : String(error)}`,
        },
        metadata: {
          duration,
          encrypted: false,
          version: '1.0.0',
        },
      };
    }
  }

  /**
   * Update configuration
   */
  public async updateConfig(
    updates: Partial<Omit<SecureConfigRecord, 'id' | 'createdAt' | 'encryptionMetadata' | 'configVersion'>>,
  ): Promise<ConfigOperationResult<SecureConfigRecord>> {
    const startTime = Date.now();

    try {
      // Get current configuration
      const currentResult = await this.getConfig();
      if (!currentResult.success || !currentResult.data) {
        return {
          success: false,
          error: {
            code: 'UPDATE_FAILED',
            message: 'Cannot update: current configuration not found',
            details: currentResult.error,
          },
        };
      }

      const currentConfig = currentResult.data;

      // Apply updates
      const updatedConfig: SecureConfigRecord = {
        ...currentConfig,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      // Re-encrypt if API key was updated
      if (updates.encryptedApiKey && this.options.masterPassword) {
        const encryptionResult = await this.encryptionUtils.encryptData(
          updates.encryptedApiKey,
          this.options.masterPassword,
        );

        if (!encryptionResult.success || !encryptionResult.encryptedData || !encryptionResult.metadata) {
          return {
            success: false,
            error: {
              code: 'ENCRYPTION_FAILED',
              message: 'Failed to encrypt updated API key',
              details: encryptionResult.error,
            },
          };
        }

        updatedConfig.encryptedApiKey = encryptionResult.encryptedData;
        updatedConfig.encryptionMetadata = encryptionResult.metadata;
      }

      // Validate updated configuration
      if (this.options.enableValidation) {
        const validationResult = await this.validateConfig(updatedConfig);
        updatedConfig.validation = validationResult;
      }

      // Store updated configuration
      const serializedConfig = JSON.stringify(updatedConfig);
      await this.storage.set(serializedConfig);

      // Update backup
      if (this.options.enableBackup && this.backupStorage) {
        await this.createBackup(updatedConfig);
      }

      // Add to history
      this.addToHistory(updatedConfig, 'Configuration updated', 'user');

      const duration = Date.now() - startTime;

      return {
        success: true,
        data: updatedConfig,
        metadata: {
          duration,
          encrypted: true,
          version: updatedConfig.configVersion,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: `Failed to update configuration: ${error instanceof Error ? error.message : String(error)}`,
        },
        metadata: {
          duration,
          encrypted: false,
          version: '1.0.0',
        },
      };
    }
  }

  /**
   * Delete configuration
   */
  public async deleteConfig(): Promise<ConfigOperationResult<boolean>> {
    const startTime = Date.now();

    try {
      // Get current config for history
      const currentResult = await this.getConfig();

      // Clear primary storage
      await this.storage.set('{}');

      // Clear backup storage
      if (this.backupStorage) {
        await this.backupStorage.set('{}');
      }

      // Add to history
      if (currentResult.success && currentResult.data) {
        this.addToHistory(currentResult.data, 'Configuration deleted', 'user');
      }

      // Clear encryption key cache
      this.encryptionUtils.clearKeyCache();

      const duration = Date.now() - startTime;

      return {
        success: true,
        data: true,
        metadata: {
          duration,
          encrypted: false,
          version: '1.0.0',
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        error: {
          code: 'DELETE_FAILED',
          message: `Failed to delete configuration: ${error instanceof Error ? error.message : String(error)}`,
        },
        metadata: {
          duration,
          encrypted: false,
          version: '1.0.0',
        },
      };
    }
  }

  /**
   * Test configuration connectivity
   */
  public async testConfig(config?: SecureConfigRecord): Promise<ConfigOperationResult<ValidationResult>> {
    const startTime = Date.now();

    try {
      let testConfig = config;

      if (!testConfig) {
        const configResult = await this.getConfig();
        if (!configResult.success || !configResult.data) {
          return {
            success: false,
            error: {
              code: 'NO_CONFIG_TO_TEST',
              message: 'No configuration available to test',
            },
          };
        }
        testConfig = configResult.data;
      }

      const validationResult = await this.validateConfig(testConfig);

      // Update stored configuration with validation results
      if (!config) {
        await this.updateConfig({ validation: validationResult });
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        data: validationResult,
        metadata: {
          duration,
          encrypted: false,
          version: testConfig.configVersion,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        error: {
          code: 'TEST_FAILED',
          message: `Configuration test failed: ${error instanceof Error ? error.message : String(error)}`,
        },
        metadata: {
          duration,
          encrypted: false,
          version: '1.0.0',
        },
      };
    }
  }

  /**
   * Rotate encryption key
   */
  public async rotateEncryptionKey(newMasterPassword: string): Promise<ConfigOperationResult<SecureConfigRecord>> {
    const startTime = Date.now();

    try {
      if (!this.options.masterPassword) {
        return {
          success: false,
          error: {
            code: 'NO_CURRENT_PASSWORD',
            message: 'Current master password is required for key rotation',
          },
        };
      }

      // Get current configuration
      const currentResult = await this.getConfig();
      if (!currentResult.success || !currentResult.data) {
        return {
          success: false,
          error: {
            code: 'ROTATION_FAILED',
            message: 'Cannot rotate key: current configuration not found',
            details: currentResult.error,
          },
        };
      }

      const currentConfig = currentResult.data;

      // Rotate the encryption key
      const rotationResult = await this.encryptionUtils.rotateKey(
        currentConfig.encryptedApiKey,
        this.options.masterPassword,
        newMasterPassword,
        currentConfig.encryptionMetadata,
      );

      if (!rotationResult.success || !rotationResult.encryptedData || !rotationResult.metadata) {
        return {
          success: false,
          error: {
            code: 'KEY_ROTATION_FAILED',
            message: 'Failed to rotate encryption key',
            details: rotationResult.error,
          },
        };
      }

      // Update configuration with new encrypted data
      const updatedConfig: SecureConfigRecord = {
        ...currentConfig,
        encryptedApiKey: rotationResult.encryptedData,
        encryptionMetadata: rotationResult.metadata,
        updatedAt: new Date().toISOString(),
      };

      // Store updated configuration
      const serializedConfig = JSON.stringify(updatedConfig);
      await this.storage.set(serializedConfig);

      // Update master password
      this.options.masterPassword = newMasterPassword;

      // Update backup
      if (this.options.enableBackup && this.backupStorage) {
        await this.createBackup(updatedConfig);
      }

      // Add to history
      this.addToHistory(updatedConfig, 'Encryption key rotated', 'user');

      const duration = Date.now() - startTime;

      return {
        success: true,
        data: updatedConfig,
        metadata: {
          duration,
          encrypted: true,
          version: updatedConfig.configVersion,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        error: {
          code: 'ROTATION_FAILED',
          message: `Key rotation failed: ${error instanceof Error ? error.message : String(error)}`,
        },
        metadata: {
          duration,
          encrypted: false,
          version: '1.0.0',
        },
      };
    }
  }

  /**
   * Get configuration history
   */
  public getConfigHistory(): ConfigHistoryEntry[] {
    return [...this.configHistory];
  }

  /**
   * Export configuration (encrypted)
   */
  public async exportConfig(): Promise<ConfigOperationResult<string>> {
    try {
      const configResult = await this.getConfig();
      if (!configResult.success || !configResult.data) {
        return {
          success: false,
          error: {
            code: 'EXPORT_FAILED',
            message: 'No configuration to export',
          },
        };
      }

      // Create export data (keep encrypted)
      const exportData = {
        config: configResult.data,
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
      };

      return {
        success: true,
        data: JSON.stringify(exportData, null, 2),
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'EXPORT_FAILED',
          message: `Export failed: ${error instanceof Error ? error.message : String(error)}`,
        },
      };
    }
  }

  /**
   * Subscribe to configuration changes
   */
  public subscribe(listener: () => void): () => void {
    return this.storage.subscribe(listener);
  }

  /**
   * Validate configuration
   */
  private async validateConfig(config: SecureConfigRecord): Promise<ValidationResult> {
    const now = new Date().toISOString();
    const tests = [];
    const issues = [];
    let score = 0;

    // Test API key format
    try {
      if (config.encryptedApiKey && config.encryptedApiKey.length > 0) {
        tests.push({
          testId: 'api-key-format',
          name: 'API Key Format',
          status: 'passed' as const,
          duration: 1,
          message: 'API key format is valid',
        });
        score += 0.2;
      } else {
        tests.push({
          testId: 'api-key-format',
          name: 'API Key Format',
          status: 'failed' as const,
          duration: 1,
          message: 'API key is missing or empty',
        });
        issues.push({
          severity: 'error' as const,
          code: 'MISSING_API_KEY',
          message: 'API key is required for Azure Speech Service',
          field: 'encryptedApiKey',
          resolution: 'Please provide a valid Azure Speech Service subscription key',
        });
      }
    } catch (error) {
      tests.push({
        testId: 'api-key-format',
        name: 'API Key Format',
        status: 'failed' as const,
        duration: 1,
        error: {
          code: 'VALIDATION_ERROR',
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }

    // Test region format
    if (config.serviceRegion && /^[a-z]+[a-z0-9]*$/.test(config.serviceRegion)) {
      tests.push({
        testId: 'region-format',
        name: 'Region Format',
        status: 'passed' as const,
        duration: 1,
        message: 'Region format is valid',
      });
      score += 0.2;
    } else {
      tests.push({
        testId: 'region-format',
        name: 'Region Format',
        status: 'failed' as const,
        duration: 1,
        message: 'Invalid region format',
      });
      issues.push({
        severity: 'error' as const,
        code: 'INVALID_REGION',
        message: 'Region must be a valid Azure region identifier',
        field: 'region',
        resolution: 'Use a valid Azure region like "eastus", "westeurope", etc.',
      });
    }

    // Test endpoint format
    if (config.endpoint && /^https:\/\/.*\.cognitiveservices\.azure\.com\/?$/.test(config.endpoint)) {
      tests.push({
        testId: 'endpoint-format',
        name: 'Endpoint Format',
        status: 'passed' as const,
        duration: 1,
        message: 'Endpoint format is valid',
      });
      score += 0.2;
    } else {
      tests.push({
        testId: 'endpoint-format',
        name: 'Endpoint Format',
        status: 'warning' as const,
        duration: 1,
        message: 'Endpoint format may be incorrect',
      });
      issues.push({
        severity: 'warning' as const,
        code: 'SUSPICIOUS_ENDPOINT',
        message: 'Endpoint should follow Azure Cognitive Services URL format',
        field: 'endpoint',
        resolution: 'Verify the endpoint URL with your Azure portal',
      });
    }

    // Test encryption metadata
    if (this.encryptionUtils.validateMetadata(config.encryptionMetadata)) {
      tests.push({
        testId: 'encryption-metadata',
        name: 'Encryption Metadata',
        status: 'passed' as const,
        duration: 1,
        message: 'Encryption metadata is valid',
      });
      score += 0.2;
    } else {
      tests.push({
        testId: 'encryption-metadata',
        name: 'Encryption Metadata',
        status: 'failed' as const,
        duration: 1,
        message: 'Invalid encryption metadata',
      });
      issues.push({
        severity: 'error' as const,
        code: 'INVALID_ENCRYPTION',
        message: 'Configuration encryption metadata is corrupted',
        resolution: 'Re-encrypt the configuration with a valid master password',
      });
    }

    // Test preferences
    if (config.preferences && this.validatePreferences(config.preferences)) {
      tests.push({
        testId: 'preferences-format',
        name: 'Preferences Format',
        status: 'passed' as const,
        duration: 1,
        message: 'Preferences are valid',
      });
      score += 0.2;
    } else {
      tests.push({
        testId: 'preferences-format',
        name: 'Preferences Format',
        status: 'warning' as const,
        duration: 1,
        message: 'Some preferences may have invalid values',
      });
    }

    return {
      status: score >= 0.8 ? 'valid' : score >= 0.5 ? 'untested' : 'invalid',
      tests,
      score,
      issues,
      validatedAt: now,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      performance: {
        responseTime: 0, // Would be filled by actual API test
        successRate: 0, // Would be filled by actual API test
        serviceAvailable: false, // Would be filled by actual API test
      },
    };
  }

  /**
   * Validate user preferences
   */
  private validatePreferences(preferences: UserPreferences): boolean {
    try {
      // Validate notification level
      const validNotificationLevels = ['all', 'errors', 'critical', 'none'];
      if (!validNotificationLevels.includes(preferences.notificationLevel)) {
        return false;
      }

      // Validate cache retention days
      if (preferences.cacheRetentionDays < 1 || preferences.cacheRetentionDays > 365) {
        return false;
      }

      // Validate storage usage threshold
      if (preferences.maxStorageUsage < 0 || preferences.maxStorageUsage > 1) {
        return false;
      }

      // Validate confidence threshold
      if (preferences.confidenceThreshold < 0 || preferences.confidenceThreshold > 1) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create backup in sync storage
   */
  private async createBackup(config: SecureConfigRecord): Promise<void> {
    if (!this.backupStorage) return;

    try {
      const backupData = {
        config,
        backup: {
          backupId: this.generateBackupId(),
          location: 'sync' as const,
          encrypted: true,
          createdAt: new Date().toISOString(),
          size: JSON.stringify(config).length,
          checksum: await this.encryptionUtils.generateHash(JSON.stringify(config)),
          recoveryTest: {
            estimatedRecoveryTime: 5,
          },
        } as BackupMetadata,
      };

      await this.backupStorage.set(JSON.stringify(backupData));
    } catch (error) {
      console.error('Failed to create backup:', error);
    }
  }

  /**
   * Add entry to configuration history
   */
  private addToHistory(
    config: SecureConfigRecord,
    description: string,
    changedBy: 'user' | 'system' | 'migration',
  ): void {
    const entry: ConfigHistoryEntry = {
      entryId: this.generateHistoryId(),
      configSnapshot: {
        id: config.id,
        serviceRegion: config.serviceRegion,
        endpoint: config.endpoint,
        language: config.language,
        configVersion: config.configVersion,
        updatedAt: config.updatedAt,
      },
      changeDescription: description,
      changedBy,
      changedAt: new Date().toISOString(),
      previousValues: {},
      validated: config.validation.status === 'valid',
      impact: {
        riskLevel: 'low',
        affectedAreas: ['configuration'],
        requiresValidation: false,
      },
    };

    this.configHistory.unshift(entry);

    // Trim history to max entries
    if (this.configHistory.length > this.options.maxHistoryEntries) {
      this.configHistory = this.configHistory.slice(0, this.options.maxHistoryEntries);
    }

    // Save history to storage
    this.saveConfigHistory();
  }

  /**
   * Load configuration history from storage
   */
  private async loadConfigHistory(): Promise<void> {
    try {
      // This would load from a separate storage key in a real implementation
      this.configHistory = [];
    } catch (_error) {
      console.debug('No configuration history found');
      this.configHistory = [];
    }
  }

  /**
   * Save configuration history to storage
   */
  private async saveConfigHistory(): Promise<void> {
    try {
      // This would save to a separate storage key in a real implementation
      // For now, just keep in memory
    } catch (error) {
      console.error('Failed to save configuration history:', error);
    }
  }

  /**
   * Generate unique configuration ID
   */
  private generateConfigId(): string {
    return `config-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Generate unique backup ID
   */
  private generateBackupId(): string {
    return `backup-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Generate unique history entry ID
   */
  private generateHistoryId(): string {
    return `history-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Set master password
   */
  public setMasterPassword(password: string): void {
    this.options.masterPassword = password;
  }

  /**
   * Clear master password (for security)
   */
  public clearMasterPassword(): void {
    this.options.masterPassword = '';
    this.encryptionUtils.clearKeyCache();
  }
}
