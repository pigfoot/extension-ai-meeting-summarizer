/**
 * Secure configuration storage types for Azure Speech API and extension settings
 * Provides encrypted storage interfaces for sensitive data and configuration management
 */

// TODO: Fix import path when shared types are available
// import type { AzureSpeechConfig } from '@/shared/lib/types/azure';
export interface AzureSpeechConfig {
  subscriptionKey: string;
  region: string;
  endpoint?: string;
  language?: string;
}

/**
 * Encryption algorithm types supported for secure data storage
 */
export type EncryptionAlgorithm =
  | 'AES-256-GCM' // AES with Galois/Counter Mode
  | 'AES-256-CBC' // AES with Cipher Block Chaining
  | 'ChaCha20-Poly1305'; // ChaCha20 with Poly1305 MAC

/**
 * Key derivation function types for encryption key generation
 */
export type KeyDerivationFunction =
  | 'PBKDF2' // Password-Based Key Derivation Function 2
  | 'scrypt' // Scrypt key derivation
  | 'Argon2'; // Argon2 key derivation

/**
 * Validation status for configuration settings
 */
export type ValidationStatus =
  | 'valid' // Configuration is valid and tested
  | 'invalid' // Configuration has errors
  | 'untested' // Configuration not yet validated
  | 'expired' // Configuration validation has expired
  | 'pending'; // Validation is in progress

/**
 * Security level classification for configuration data
 */
export type SecurityLevel =
  | 'public' // No encryption needed
  | 'internal' // Basic obfuscation
  | 'confidential' // Standard encryption
  | 'secret'; // High-security encryption

/**
 * Secure configuration record containing encrypted Azure API credentials
 */
export interface SecureConfigRecord {
  /** Configuration record identifier */
  id: string;

  /** Encrypted Azure subscription key */
  encryptedApiKey: string;

  /** Azure service region */
  region: string;

  /** Azure service endpoint URL */
  endpoint: string;

  /** Default language setting for transcription */
  language: string;

  /** User preferences and settings */
  preferences: UserPreferences;

  /** Encryption metadata */
  encryptionMetadata: EncryptionMetadata;

  /** Configuration validation information */
  validation: ValidationResult;

  /** Configuration version for migration support */
  configVersion: string;

  /** Timestamp when configuration was created (ISO 8601) */
  createdAt: string;

  /** Timestamp when configuration was last updated (ISO 8601) */
  updatedAt: string;

  /** Timestamp of last successful validation (ISO 8601) */
  lastValidated?: string;

  /** Backup and recovery information */
  backup?: BackupMetadata;
}

/**
 * User preferences and extension settings
 */
export interface UserPreferences {
  /** Automatically transcribe detected meetings */
  autoTranscribe: boolean;

  /** Automatically generate meeting summaries */
  autoSummarize: boolean;

  /** Notification level for extension events */
  notificationLevel: 'all' | 'errors' | 'critical' | 'none';

  /** Cache retention period in days */
  cacheRetentionDays: number;

  /** Maximum storage usage before warnings (0-1) */
  maxStorageUsage: number;

  /** Default transcription language */
  defaultLanguage: string;

  /** Enable speaker diarization */
  enableSpeakerDiarization: boolean;

  /** Transcription confidence threshold (0-1) */
  confidenceThreshold: number;

  /** UI preferences */
  ui: {
    /** Theme preference */
    theme: 'light' | 'dark' | 'auto';
    /** Compact view mode */
    compactMode: boolean;
    /** Show advanced options */
    showAdvanced: boolean;
    /** Default page size for lists */
    defaultPageSize: number;
  };

  /** Data management preferences */
  dataManagement: {
    /** Enable automatic cleanup */
    enableAutoCleanup: boolean;
    /** Backup configuration to sync storage */
    enableBackup: boolean;
    /** Export data format preference */
    exportFormat: 'json' | 'csv' | 'xml';
  };

  /** Privacy settings */
  privacy: {
    /** Store transcriptions locally only */
    localStorageOnly: boolean;
    /** Anonymize participant data */
    anonymizeParticipants: boolean;
    /** Enable analytics collection */
    enableAnalytics: boolean;
  };
}

/**
 * Encryption metadata for secure data storage
 */
export interface EncryptionMetadata {
  /** Encryption algorithm used */
  algorithm: EncryptionAlgorithm;

  /** Key derivation function used */
  keyDerivation: KeyDerivationFunction;

  /** Initialization vector (base64 encoded) */
  iv: string;

  /** Salt for key derivation (base64 encoded) */
  salt: string;

  /** Number of iterations for key derivation */
  iterations: number;

  /** Authentication tag for AEAD algorithms (base64 encoded) */
  authTag?: string;

  /** Security level classification */
  securityLevel: SecurityLevel;

  /** Key identifier for key rotation */
  keyId: string;

  /** Encryption timestamp (ISO 8601) */
  encryptedAt: string;

  /** Key rotation information */
  keyRotation: {
    /** Next rotation date (ISO 8601) */
    nextRotation: string;
    /** Rotation interval in days */
    rotationInterval: number;
    /** Whether rotation is automated */
    autoRotate: boolean;
  };
}

/**
 * Configuration validation result
 */
export interface ValidationResult {
  /** Current validation status */
  status: ValidationStatus;

  /** Validation test results */
  tests: ValidationTest[];

  /** Overall validation score (0-1) */
  score: number;

  /** Validation errors and warnings */
  issues: ValidationIssue[];

  /** Timestamp of validation attempt (ISO 8601) */
  validatedAt: string;

  /** Validation expiry date (ISO 8601) */
  expiresAt: string;

  /** Performance metrics from validation */
  performance: {
    /** API response time in milliseconds */
    responseTime: number;
    /** Connection success rate */
    successRate: number;
    /** Service availability */
    serviceAvailable: boolean;
  };
}

/**
 * Individual validation test result
 */
export interface ValidationTest {
  /** Test identifier */
  testId: string;

  /** Test name/description */
  name: string;

  /** Test result status */
  status: 'passed' | 'failed' | 'skipped' | 'warning';

  /** Test execution time in milliseconds */
  duration: number;

  /** Test result message */
  message?: string;

  /** Test result data */
  result?: unknown;

  /** Error information if test failed */
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Configuration validation issue
 */
export interface ValidationIssue {
  /** Issue severity level */
  severity: 'error' | 'warning' | 'info';

  /** Issue code for categorization */
  code: string;

  /** Human-readable issue message */
  message: string;

  /** Field or configuration area affected */
  field?: string;

  /** Suggested resolution steps */
  resolution?: string;

  /** Additional issue context */
  context?: Record<string, unknown>;
}

/**
 * Backup and recovery metadata
 */
export interface BackupMetadata {
  /** Backup identifier */
  backupId: string;

  /** Backup storage location */
  location: 'sync' | 'local' | 'external';

  /** Backup encryption status */
  encrypted: boolean;

  /** Backup creation timestamp (ISO 8601) */
  createdAt: string;

  /** Backup size in bytes */
  size: number;

  /** Backup checksum for integrity verification */
  checksum: string;

  /** Recovery test information */
  recoveryTest: {
    /** Last recovery test date (ISO 8601) */
    lastTested?: string;
    /** Recovery test success */
    successful?: boolean;
    /** Recovery time estimate in seconds */
    estimatedRecoveryTime?: number;
  };
}

/**
 * Configuration migration information
 */
export interface ConfigMigration {
  /** Source configuration version */
  fromVersion: string;

  /** Target configuration version */
  toVersion: string;

  /** Migration strategy */
  strategy: 'automatic' | 'manual' | 'guided';

  /** Migration steps to perform */
  steps: MigrationStep[];

  /** Migration rollback plan */
  rollback: {
    /** Whether rollback is supported */
    supported: boolean;
    /** Rollback steps */
    steps?: MigrationStep[];
    /** Rollback time limit in hours */
    timeLimit?: number;
  };

  /** Migration metadata */
  metadata: {
    /** Migration identifier */
    migrationId: string;
    /** Migration start time (ISO 8601) */
    startedAt?: string;
    /** Migration completion time (ISO 8601) */
    completedAt?: string;
    /** Migration status */
    status: 'pending' | 'running' | 'completed' | 'failed' | 'rolledback';
  };
}

/**
 * Individual migration step
 */
export interface MigrationStep {
  /** Step identifier */
  stepId: string;

  /** Step description */
  description: string;

  /** Step operation type */
  operation: 'transform' | 'add' | 'remove' | 'encrypt' | 'decrypt' | 'validate';

  /** Fields affected by this step */
  affectedFields: string[];

  /** Step execution order */
  order: number;

  /** Whether step is required */
  required: boolean;

  /** Step validation function */
  validate?: (config: SecureConfigRecord) => ValidationResult;
}

/**
 * Configuration history entry for audit trail
 */
export interface ConfigHistoryEntry {
  /** History entry identifier */
  entryId: string;

  /** Configuration snapshot */
  configSnapshot: Partial<SecureConfigRecord>;

  /** Change description */
  changeDescription: string;

  /** User or system that made the change */
  changedBy: 'user' | 'system' | 'migration';

  /** Change timestamp (ISO 8601) */
  changedAt: string;

  /** Previous values for rollback */
  previousValues: Record<string, unknown>;

  /** Change validation status */
  validated: boolean;

  /** Change impact assessment */
  impact: {
    /** Risk level of the change */
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    /** Areas affected by the change */
    affectedAreas: string[];
    /** Whether change requires validation */
    requiresValidation: boolean;
  };
}
