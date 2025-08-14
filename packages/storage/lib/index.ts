// Base storage types and utilities
// Example theme storage for UI components
import { createStorage } from './base/base';
import { StorageEnum } from './base/enums';
import type { ThemeStateType, ThemeStorageType } from './base/types';

export * from './base/index';

const baseThemeStorage = createStorage<ThemeStateType>(
  'theme',
  { theme: 'light', isLight: true },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

export const exampleThemeStorage: ThemeStorageType = {
  ...baseThemeStorage,
  toggle: async () => {
    const current = await baseThemeStorage.get();
    const newTheme = current.theme === 'light' ? 'dark' : 'light';
    await baseThemeStorage.set({
      theme: newTheme,
      isLight: newTheme === 'light',
    });
  },
};

// Storage type definitions
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
  CacheOperationResult,
  CacheOptions,
  CacheMetrics,
  // Sync management types
  SyncStatus,
  SyncHealthStatus,
  SyncEventType,
  SyncMetrics,
  SyncMonitorConfig,
  SyncEvent,
  SyncHealthCheck,
  SyncNotification,
} from './types/cache';

// Meeting-specific storage schemas
export { meetingStorageSchema, type MeetingStorageSchemaType } from './schemas/meeting';

export { configSchema, type ConfigSchemaType } from './schemas/config';

// Core storage implementations
export { MeetingStorageBase } from './impl/meeting-storage-base';
export { MeetingStorage } from './impl/meeting-storage';
export { MeetingIndex } from './impl/meeting-index';

// Enhanced storage implementations
export { CacheBase } from './impl/cache-base';
export { TranscriptionCache } from './impl/transcription-cache';
export { CacheEvictionManager } from './impl/cache-eviction';
export { SyncCoordinator } from './impl/sync-coordinator';
export { ConflictResolver } from './impl/conflict-resolver';
export { OfflineQueue } from './impl/offline-queue';
export { BatchOperationsManager } from './impl/batch-operations';

// Configuration and encryption utilities
export { ConfigValidator } from './impl/config-validator';
export { SecureConfigStorage } from './impl/secure-config-storage';

// Storage utilities
export { setDebugInfo, createUpdateValue, createUpdateValueOrFunction } from './utils/cache';

export { CacheIntegrityChecker } from './utils/cache-integrity';
export { SyncStatusMonitor as SyncMonitor } from './utils/sync-monitor';
export { StoragePerformanceMonitor } from './utils/performance-monitor';
export { StorageQuotaManager as QuotaManager } from './utils/quota-manager';
export { EncryptionUtils } from './utils/encryption';

export {
  CompressionUtils as CompressionService,
  type CompressionResult,
  type CompressionStats,
} from './utils/compression';

export { ConfigMigrationManager as ConfigMigrationService, type MigrationResult } from './utils/config-migration';
