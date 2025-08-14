// Re-export base types to avoid duplication
export type { BaseStorageType, ValueOrUpdateType } from './base/index';

// Meeting-specific storage types
export type {
  // Meeting storage types
  MeetingStorageStatus,
  CompressionAlgorithm,
  CompressionLevel,
  StoragePriority,
  MeetingStorageRecord,
  StorageMetadata,
  CompressionConfig,
  MeetingSearchIndex,
  BatchStorageOperation,
  StorageQuotaInfo,
  StoragePerformanceMetrics,
  MeetingStorageConfig,
} from './types/meeting';

// Secure configuration types
export type {
  // Configuration storage types
  EncryptionAlgorithm,
  KeyDerivationFunction,
  ValidationStatus,
  SecurityLevel,
  SecureConfigRecord,
  UserPreferences,
  EncryptionMetadata,
  ValidationResult,
  ValidationTest,
  ValidationIssue,
  BackupMetadata,
  ConfigMigration,
  MigrationStep,
  ConfigHistoryEntry,
} from './types/config';

// Intelligent caching types
export type {
  // Cache management types
  EvictionPolicy,
  CacheEntryStatus,
  CacheStorageTier,
  CacheAccessPattern,
  CacheEntry,
  CacheEntryMetadata,
  CacheIntegrityInfo,
  CacheAccessInfo,
  CacheStorageInfo,
  CacheStats,
  CachePerformanceStats,
  CacheEvictionStats,
  CacheIntegrityStats,
  CacheOptimizationStats,
  CacheConfig,
} from './types/cache';
