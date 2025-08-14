/**
 * Intelligent caching system types for meeting transcription results
 * Provides LRU cache management, integrity validation, and performance optimization
 */

// TODO: Fix import path when shared types are available
// import type { TranscriptionResult } from '@/shared/lib/types/meeting';
import type { TranscriptionResult } from './meeting';

/**
 * Transcription data interface for caching
 */
export interface TranscriptionData {
  /** Raw transcription text */
  text: string;
  /** Transcription confidence score */
  confidence: number;
  /** Word-level timing information */
  words?: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
  /** Language detected */
  language: string;
  /** Audio duration in seconds */
  duration: number;
  /** Transcription timestamp */
  timestamp: string;
  /** Azure Speech service metadata */
  azureMetadata?: {
    requestId: string;
    recognitionStatus: string;
    offset: number;
    duration: number;
  };
}

/**
 * Cache eviction policy types
 */
export type EvictionPolicy =
  | 'lru' // Least Recently Used
  | 'lfu' // Least Frequently Used
  | 'fifo' // First In, First Out
  | 'lifo' // Last In, First Out
  | 'random' // Random eviction
  | 'ttl'; // Time To Live based

/**
 * Cache entry status for lifecycle management
 */
export type CacheEntryStatus =
  | 'active' // Entry is active and available
  | 'stale' // Entry is outdated but usable
  | 'expired' // Entry has exceeded TTL
  | 'corrupted' // Entry failed integrity check
  | 'locked' // Entry is being updated
  | 'archived'; // Entry is archived but not active

/**
 * Cache storage tier for hierarchical caching
 */
export type CacheStorageTier =
  | 'memory' // In-memory cache (fastest)
  | 'disk' // Local disk cache
  | 'compressed' // Compressed disk cache
  | 'archived'; // Long-term archived cache

/**
 * Cache access pattern for optimization
 */
export type CacheAccessPattern =
  | 'frequent' // Accessed very frequently
  | 'regular' // Accessed regularly
  | 'occasional' // Accessed occasionally
  | 'rare' // Rarely accessed
  | 'unknown'; // Access pattern not determined

/**
 * Transcription cache entry for Azure Speech API results
 */
export interface TranscriptionCacheEntry extends CacheEntry<TranscriptionData> {
  /** URL hash for cache key */
  urlHash: string;
  /** Original video URL */
  videoUrl: string;
  /** Cache metadata */
  metadata: TranscriptionCacheMetadata;
}

/**
 * Transcription cache metadata
 */
export interface TranscriptionCacheMetadata extends CacheEntryMetadata {
  /** Azure Speech service region */
  region?: string;
  /** Language used for transcription */
  language?: string;
  /** Transcription confidence score */
  confidence?: number;
  /** Processing duration in milliseconds */
  processingDuration?: number;
  /** URL hash for cache key */
  urlHash?: string;
  /** Content hash for validation */
  contentHash?: string;
  /** Audio duration in seconds */
  duration?: number;
  /** Transcription text length */
  textLength?: number;
  /** Word count in transcription */
  wordCount?: number;
  /** Data integrity checksum */
  checksum?: string;
  /** Cache storage timestamp */
  cacheTimestamp?: string;
  /** Index signature for additional properties */
  [key: string]: unknown;
}

/**
 * URL hash result for cache operations
 */
export interface URLHashResult {
  /** Generated hash */
  hash: string;
  /** Hash algorithm used */
  algorithm: string;
  /** Original URL */
  originalUrl: string;
  /** Hash generation timestamp */
  timestamp: string;
}

/**
 * Cache entry containing transcription result with metadata
 */
export interface CacheEntry<T = unknown> {
  /** Unique cache entry identifier */
  entryId: string;

  /** Cache key for this entry */
  key: string;

  /** SHA-256 hash of the source URL */
  urlHash: string;

  /** Original source URL (for debugging/reference) */
  sourceUrl?: string;

  /** Cached data */
  data: T;

  /** Cache entry metadata */
  metadata: CacheEntryMetadata;

  /** Entry creation timestamp */
  createdAt: string;

  /** Entry size in bytes */
  size: number;

  /** Last access time */
  lastAccessTime: number;

  /** Access count */
  accessCount: number;

  /** Expiration timestamp */
  expiresAt: number;

  /** Data integrity information */
  integrity: CacheIntegrityInfo;
}

/**
 * Cache entry metadata for management and optimization
 */
export interface CacheEntryMetadata {
  /** Entry creation timestamp (ISO 8601) */
  createdAt: string;

  /** Last update timestamp (ISO 8601) */
  updatedAt: string;

  /** Last access timestamp (ISO 8601) */
  lastAccessed: string;

  /** Entry expiration timestamp (ISO 8601) */
  expiresAt?: string;

  /** Time-to-live in seconds */
  ttl?: number;

  /** Cache entry version for updates */
  version: number;

  /** Entry priority for eviction decisions */
  priority: number;

  /** User-defined tags for categorization */
  tags: string[];

  /** Entry size classification */
  sizeCategory: 'small' | 'medium' | 'large' | 'xlarge';

  /** Access pattern classification */
  accessPattern: CacheAccessPattern;
}

/**
 * Cache entry data integrity information
 */
export interface CacheIntegrityInfo {
  /** Data integrity checksum */
  checksum: string;

  /** Checksum algorithm used */
  checksumAlgorithm: 'sha256' | 'md5' | 'crc32';

  /** Last integrity verification timestamp (ISO 8601) */
  lastVerified?: string;

  /** Integrity verification frequency in hours */
  verificationInterval: number;

  /** Integrity status */
  status: 'verified' | 'unverified' | 'corrupted' | 'pending';

  /** Corruption detection information */
  corruption?: {
    /** When corruption was detected (ISO 8601) */
    detectedAt: string;
    /** Type of corruption found */
    type: 'checksum_mismatch' | 'data_missing' | 'format_invalid';
    /** Corruption severity */
    severity: 'minor' | 'major' | 'critical';
    /** Recovery action taken */
    recoveryAction?: 'repaired' | 'recomputed' | 'evicted';
  };
}

/**
 * Cache entry access tracking information
 */
export interface CacheAccessInfo {
  /** Total number of times entry was accessed */
  accessCount: number;

  /** Number of cache hits for this entry */
  hitCount: number;

  /** Access frequency (accesses per hour) */
  accessFrequency: number;

  /** Recent access timestamps for pattern analysis */
  recentAccesses: string[];

  /** Access source tracking */
  accessSources: Record<string, number>;

  /** Performance metrics for this entry */
  performance: {
    /** Average retrieval time in milliseconds */
    averageRetrievalTime: number;
    /** Fastest retrieval time in milliseconds */
    fastestRetrieval: number;
    /** Slowest retrieval time in milliseconds */
    slowestRetrieval: number;
  };

  /** LRU chain position for eviction ordering */
  lruPosition: number;

  /** LFU score for frequency-based eviction */
  lfuScore: number;
}

/**
 * Cache entry storage optimization information
 */
export interface CacheStorageInfo {
  /** Original uncompressed size in bytes */
  originalSize: number;

  /** Current stored size in bytes */
  storedSize: number;

  /** Compression ratio (0-1, where 0.5 means 50% compression) */
  compressionRatio: number;

  /** Storage efficiency score (0-1) */
  storageEfficiency: number;

  /** Whether entry is compressed */
  compressed: boolean;

  /** Compression algorithm used */
  compressionAlgorithm?: 'gzip' | 'deflate' | 'lz4';

  /** Storage location information */
  location: {
    /** Storage type */
    type: CacheStorageTier;
    /** Storage path or identifier */
    path?: string;
    /** Storage allocation size */
    allocatedSize: number;
  };

  /** Deduplication information */
  deduplication?: {
    /** Whether entry is deduplicated */
    isDeduplicated: boolean;
    /** Reference to canonical entry */
    canonicalEntryId?: string;
    /** Space saved through deduplication */
    spaceSaved: number;
  };
}

/**
 * Cache operation result for type safety
 */
export interface CacheOperationResult<T = undefined> {
  /** Operation success status */
  success: boolean;
  /** Result data if successful */
  data?: T | undefined;
  /** Error message if failed */
  error?: string | undefined;
  /** Operation timestamp */
  timestamp: string;
}

/**
 * Cache options for configuration
 */
export interface CacheOptions {
  /** Maximum cache size in MB */
  maxSize?: number | undefined;
  /** Maximum cache size in bytes */
  maxSizeBytes?: number | undefined;
  /** Default TTL in seconds */
  defaultTTL?: number | undefined;
  /** TTL for entries */
  ttl?: number | undefined;
  /** Enable compression */
  enableCompression?: boolean | undefined;
  /** Enable integrity checking */
  enableIntegrityCheck?: boolean | undefined;
  /** Enable metrics collection */
  enableMetrics?: boolean | undefined;
  /** Enable events */
  enableEvents?: boolean | undefined;
  /** Compression threshold in bytes */
  compressionThreshold?: number | undefined;
  /** Maximum memory usage */
  maxMemoryUsage?: number | undefined;
  /** Eviction policy */
  evictionPolicy?: EvictionPolicy | undefined;
}

/**
 * Cache metrics for monitoring
 */
export interface CacheMetrics {
  /** Total operations count */
  operations: number;
  /** Total operations count (alias) */
  totalOperations: number;
  /** Average operation time */
  averageTime: number;
  /** Average operation time (alias) */
  averageOperationTime: number;
  /** Hit rate percentage */
  hitRate: number;
  /** Hit ratio (0-1) */
  hitRatio: number;
  /** Memory usage in bytes */
  memoryUsage: number;
  /** Memory efficiency percentage */
  memoryEfficiency: number;
  /** Uptime in milliseconds */
  uptime: number;
  /** Operations per second */
  operationsPerSecond: number;
  /** Last updated timestamp */
  lastUpdated: string;
}

/**
 * Cache statistics for monitoring and optimization
 */
export interface CacheStats {
  /** Total number of cache entries */
  totalEntries: number;

  /** Cache hit rate (0-1) */
  hitRate: number;

  /** Cache miss rate (0-1) */
  missRate: number;

  /** Total cache hits */
  hits: number;

  /** Total cache misses */
  misses: number;

  /** Total requests */
  totalRequests: number;

  /** Expired entries count */
  expiredEntries: number;

  /** Corrupted entries count */
  corruptedEntries: number;

  /** Write operations count */
  writes: number;

  /** Error count */
  errors: number;

  /** Total cache size in bytes */
  totalSize: number;

  /** Total data size in bytes (alias for totalSize) */
  totalDataSize: number;

  /** Eviction count */
  evictions: number;

  /** Maximum cache size in bytes */
  maxSize: number;

  /** Hit ratio (0-1) */
  hitRatio: number;

  /** Cache size (entry count) */
  size: number;

  /** Memory usage in bytes */
  memoryUsage: number;

  /** Last updated timestamp */
  lastUpdated: string;

  /** Cache usage percentage (0-1) */
  usagePercentage: number;

  /** Entry distribution by tier */
  tierDistribution: Record<CacheStorageTier, number>;

  /** Entry distribution by status */
  statusDistribution: Record<CacheEntryStatus, number>;

  /** Performance metrics */
  performance: CachePerformanceStats;

  /** Eviction statistics */
  eviction: CacheEvictionStats;

  /** Integrity monitoring statistics */
  integrity: CacheIntegrityStats;

  /** Storage optimization statistics */
  optimization: CacheOptimizationStats;
}

/**
 * Cache performance statistics
 */
export interface CachePerformanceStats {
  /** Average cache lookup time in milliseconds */
  averageLookupTime: number;

  /** Average cache write time in milliseconds */
  averageWriteTime: number;

  /** Average cache eviction time in milliseconds */
  averageEvictionTime: number;

  /** Cache throughput (operations per second) */
  throughput: number;

  /** Memory usage for in-memory cache */
  memoryUsage: {
    /** Current memory usage in bytes */
    current: number;
    /** Peak memory usage in bytes */
    peak: number;
    /** Average memory usage in bytes */
    average: number;
  };

  /** Disk I/O statistics */
  diskIO: {
    /** Total bytes read from disk */
    bytesRead: number;
    /** Total bytes written to disk */
    bytesWritten: number;
    /** Average read time in milliseconds */
    averageReadTime: number;
    /** Average write time in milliseconds */
    averageWriteTime: number;
  };
}

/**
 * Cache eviction statistics
 */
export interface CacheEvictionStats {
  /** Total number of evictions */
  totalEvictions: number;

  /** Evictions by policy */
  evictionsByPolicy: Record<EvictionPolicy, number>;

  /** Evictions by reason */
  evictionsByReason: {
    /** Evicted due to cache size limit */
    sizeLimitReached: number;
    /** Evicted due to TTL expiration */
    ttlExpired: number;
    /** Evicted due to corruption */
    corruption: number;
    /** Evicted due to manual cleanup */
    manualCleanup: number;
  };

  /** Average time between evictions in minutes */
  averageEvictionInterval: number;

  /** Space reclaimed through evictions in bytes */
  spaceReclaimed: number;

  /** Eviction efficiency (space reclaimed / evictions) */
  evictionEfficiency: number;
}

/**
 * Cache integrity monitoring statistics
 */
export interface CacheIntegrityStats {
  /** Total integrity checks performed */
  totalChecks: number;

  /** Number of integrity violations found */
  violationsFound: number;

  /** Integrity violation rate (0-1) */
  violationRate: number;

  /** Corruption types detected */
  corruptionTypes: Record<string, number>;

  /** Recovery success rate (0-1) */
  recoverySuccessRate: number;

  /** Average integrity check time in milliseconds */
  averageCheckTime: number;

  /** Last system-wide integrity check (ISO 8601) */
  lastSystemCheck?: string;
}

/**
 * Cache storage optimization statistics
 */
export interface CacheOptimizationStats {
  /** Overall compression ratio across all entries (0-1) */
  overallCompressionRatio: number;

  /** Total space saved through compression in bytes */
  compressionSavings: number;

  /** Total space saved through deduplication in bytes */
  deduplicationSavings: number;

  /** Storage efficiency score (0-1) */
  storageEfficiency: number;

  /** Optimization recommendations */
  recommendations: Array<{
    /** Recommendation type */
    type: 'compress' | 'deduplicate' | 'migrate' | 'evict';
    /** Recommendation description */
    description: string;
    /** Estimated benefit in bytes */
    estimatedBenefit: number;
    /** Implementation effort */
    effort: 'low' | 'medium' | 'high';
  }>;
}

/**
 * Synchronization status for cross-browser data sync
 */
export interface SyncStatus {
  /** Current sync state */
  state: 'idle' | 'syncing' | 'queued' | 'conflicted' | 'failed' | 'offline';
  /** Whether the connection is online */
  online: boolean;
  /** Current queue size */
  queueSize: number;
  /** Recent errors count */
  errors: number;
  /** Recent conflicts count */
  conflicts: number;
  /** Last update timestamp */
  lastUpdated: string;
}

/**
 * Sync health status for monitoring
 */
export type SyncHealthStatus =
  | 'healthy' // All sync operations functioning normally
  | 'degraded' // Some issues but sync is working
  | 'offline' // Cannot sync due to connectivity issues
  | 'critical'; // Major sync issues detected

/**
 * Sync event types for monitoring
 */
export type SyncEventType =
  | 'sync_started'
  | 'sync_completed'
  | 'sync_failed'
  | 'conflict_detected'
  | 'conflict_resolved'
  | 'offline_detected'
  | 'connection_restored';

/**
 * Sync metrics for performance monitoring
 */
export interface SyncMetrics {
  /** Total sync operations completed */
  totalOperations: number;
  /** Successful sync operations */
  successfulOperations: number;
  /** Failed sync operations */
  failedOperations: number;
  /** Average sync time in milliseconds */
  averageSyncTime: number;
  /** Last sync timestamp (ISO 8601) */
  lastSyncAt?: string;
  /** Data synced in bytes */
  dataSynced: number;
  /** Conflicts detected */
  conflictsDetected: number;
  /** Conflicts resolved */
  conflictsResolved: number;
}

/**
 * Sync monitor configuration
 */
export interface SyncMonitorConfig {
  /** Enable detailed sync monitoring */
  enableDetailedMonitoring: boolean;
  /** Health check interval in minutes */
  healthCheckInterval: number;
  /** Maximum offline time before warning (minutes) */
  maxOfflineTime: number;
  /** Enable notifications for sync events */
  enableNotifications: boolean;
  /** Connection quality check interval (seconds) */
  connectionCheckInterval: number;
  /** Enable health checks */
  enableHealthChecks: boolean;
  /** Enable event tracking */
  enableEventTracking: boolean;
  /** Maximum event history to keep */
  maxEventHistory: number;
  /** Health check thresholds */
  thresholds: {
    /** Performance threshold in milliseconds */
    performanceThreshold: number;
    /** Queue size threshold */
    queueSizeThreshold: number;
    /** Conflict rate threshold (0-1) */
    conflictRate: number;
    /** Performance thresholds */
    performance: {
      /** Good threshold in milliseconds */
      good: number;
      /** Acceptable threshold in milliseconds */
      acceptable: number;
      /** Poor threshold in milliseconds */
      poor: number;
      /** Healthy threshold in milliseconds */
      healthy: number;
      /** Elevated threshold in milliseconds */
      elevated: number;
      /** Critical threshold in milliseconds */
      critical: number;
    };
    /** Error rate thresholds */
    errorRate: {
      /** Healthy threshold */
      healthy: number;
      /** Elevated threshold */
      elevated: number;
      /** Critical threshold */
      critical: number;
    };
    /** Error rate thresholds (detailed) */
    errorRateThresholds: {
      /** Healthy threshold */
      healthy: number;
      /** Elevated threshold */
      elevated: number;
      /** Critical threshold */
      critical: number;
    };
    /** Queue size thresholds */
    queueSize: {
      /** Healthy threshold */
      healthy: number;
      /** Elevated threshold */
      elevated: number;
      /** Critical threshold */
      critical: number;
      /** Backlogged threshold */
      backlogged: number;
    };
    /** Health score thresholds */
    healthScore: {
      /** Healthy threshold (0-100) */
      healthy: number;
      /** Degraded threshold (0-100) */
      degraded: number;
      /** Unhealthy threshold (0-100) */
      unhealthy: number;
    };
  };
  /** Notification configuration */
  notificationConfig: {
    /** Auto timeout for notifications in milliseconds */
    autoTimeout: number;
    /** Enable notification sound */
    enableSound: boolean;
    /** Maximum notifications to show */
    maxNotifications: number;
    /** Enable notifications */
    enabled: boolean;
    /** Notification types to show */
    types: string[];
    /** Show success notifications */
    showSuccess: boolean;
    /** Show error notifications */
    showErrors: boolean;
  };
}

/**
 * Sync event data structure
 */
export interface SyncEvent {
  /** Event type */
  type: SyncEventType;
  /** Event timestamp (ISO 8601) */
  timestamp: string;
  /** Event-specific data */
  data:
    | {
        operationCount?: number | undefined;
        duration?: number | undefined;
        error?: string | undefined;
        metrics?: SyncMetrics | undefined;
        networkStatus?: boolean | undefined;
      }
    | undefined;
}

/**
 * Sync health check result
 */
export interface SyncHealthCheck {
  /** Overall health status */
  status: SyncHealthStatus;
  /** Health score (0-100) */
  score?: number;
  /** Check timestamp (ISO 8601) */
  timestamp?: string;
  /** Detailed check results */
  checks?: {
    network: {
      status: 'healthy' | 'degraded' | 'offline';
      details: string;
    };
    quota: {
      status: 'healthy' | 'warning' | 'critical';
      details: string;
      utilization: number;
    };
    performance: {
      status: 'healthy' | 'slow' | 'poor';
      details: string;
      averageTime: number;
    };
    errors: {
      status: 'healthy' | 'some' | 'many';
      details: string;
      errorRate: number;
    };
    queue: {
      status: 'healthy' | 'backed_up' | 'overflowing';
      details: string;
      queueSize: number;
    };
  };
  /** Recommendations for improvement */
  recommendations?: string[];
}

/**
 * Sync notification data
 */
export interface SyncNotification {
  /** Notification ID */
  id: string;
  /** Notification type */
  type: 'info' | 'warning' | 'error' | 'success';
  /** Notification title */
  title: string;
  /** Notification message */
  message: string;
  /** Notification timestamp (ISO 8601) */
  timestamp: string;
  /** Whether notification has been read */
  read: boolean;
  /** Auto timeout in milliseconds */
  autoTimeout?: number;
  /** Related sync event data */
  eventData?: Record<string, unknown>;
  /** Action buttons for notification */
  actions?: Array<{
    label: string;
    action: string;
    style: 'primary' | 'secondary' | 'danger';
  }>;
}

/**
 * Eviction strategy types
 */
export type EvictionStrategy = 'lru' | 'lfu' | 'fifo' | 'lifo' | 'random' | 'ttl' | 'size' | 'smart';

/**
 * Eviction result
 */
export interface EvictionResult<T = unknown> {
  /** Whether eviction was successful */
  success: boolean;
  /** Number of entries evicted */
  evictedCount: number;
  /** Total bytes freed */
  bytesFreed: number;
  /** List of evicted entries */
  evictedEntries: CacheEntry<T>[];
  /** Eviction duration in milliseconds */
  duration: number;
  /** Error message if failed */
  error?: string;
  /** Eviction timestamp */
  timestamp: string;
}

/**
 * Eviction metrics
 */
export interface EvictionMetrics {
  /** Total evictions performed */
  totalEvictions: number;
  /** Total bytes freed through eviction */
  totalBytesFreed: number;
  /** Total memory freed through eviction */
  totalMemoryFreed: number;
  /** Total entries removed */
  totalEntriesRemoved: number;
  /** Average eviction time */
  averageEvictionTime: number;
  /** Eviction success rate */
  successRate: number;
  /** Eviction rate (evictions per minute) */
  evictionRate: number;
  /** Evictions by strategy */
  evictionsByStrategy: Record<EvictionStrategy, number>;
  /** Eviction efficiency (bytes freed per eviction) */
  efficiency: number;
  /** Last eviction timestamp */
  lastEviction?: string | undefined;
  /** Metrics timestamp */
  lastUpdated: string;
}

/**
 * Sync conflict resolution strategy
 */
export type ConflictResolutionStrategy =
  | 'local_wins'
  | 'remote_wins'
  | 'merge'
  | 'manual'
  | 'latest_timestamp'
  | 'last_write_wins'
  | 'first_write_wins'
  | 'no_conflict';

/**
 * Sync conflict information
 */
export interface SyncConflict<T = unknown> {
  /** Conflict ID */
  id: string;
  /** Conflicted key */
  key: string;
  /** Local version */
  localVersion: T;
  /** Remote version */
  remoteVersion: T;
  /** Local data */
  localData: T;
  /** Remote data */
  remoteData: T;
  /** Local timestamp */
  localTimestamp: string;
  /** Remote timestamp */
  remoteTimestamp: string;
  /** Conflict detection timestamp */
  detectedAt: string;
  /** Conflict type */
  type: 'data_mismatch' | 'timestamp_conflict' | 'version_conflict';
  /** Conflict severity */
  severity: 'low' | 'medium' | 'high';
  /** Local source */
  localSource: string;
  /** Remote source */
  remoteSource: string;
  /** Conflict ID */
  conflictId: string;
}

/**
 * Conflict metadata for tracking
 */
export interface ConflictMetadata {
  /** Conflict detection time */
  detectedAt: string;
  /** Conflict resolution status */
  status: 'pending' | 'resolved' | 'failed';
  /** Resolution strategy used */
  strategy?: ConflictResolutionStrategy;
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Conflict resolution result
 */
export interface ConflictResolution<T = unknown> {
  /** Resolution ID */
  id: string;
  /** Original conflict ID */
  conflictId: string;
  /** Resolution strategy used */
  strategy: ConflictResolutionStrategy;
  /** Resolved value */
  resolvedValue: T;
  /** Whether resolution was successful */
  success: boolean;
  /** Resolution timestamp */
  resolvedAt: string;
  /** Resolution duration */
  duration: number;
  /** Error message if failed */
  error?: string | undefined;
}

/**
 * Cache configuration settings
 */
export interface CacheConfig {
  /** Maximum cache size in bytes */
  maxSize: number;

  /** Default eviction policy */
  defaultEvictionPolicy: EvictionPolicy;

  /** Default TTL for cache entries in seconds */
  defaultTTL: number;

  /** Enable automatic cache optimization */
  enableOptimization: boolean;

  /** Cache tier configuration */
  tierConfig: Record<
    CacheStorageTier,
    {
      /** Maximum size for this tier in bytes */
      maxSize: number;
      /** Whether compression is enabled */
      compressionEnabled: boolean;
      /** Access time penalty multiplier */
      accessTimePenalty: number;
    }
  >;

  /** Integrity checking configuration */
  integrityConfig: {
    /** Enable periodic integrity checks */
    enabled: boolean;
    /** Check interval in hours */
    checkInterval: number;
    /** Checksum algorithm to use */
    checksumAlgorithm: 'sha256' | 'md5' | 'crc32';
  };

  /** Performance tuning settings */
  performance: {
    /** Maximum concurrent cache operations */
    maxConcurrentOps: number;
    /** Cache lookup timeout in milliseconds */
    lookupTimeout: number;
    /** Background optimization interval in minutes */
    optimizationInterval: number;
  };

  /** Monitoring and analytics settings */
  monitoring: {
    /** Enable detailed performance monitoring */
    enableDetailedMonitoring: boolean;
    /** Statistics collection interval in minutes */
    statsInterval: number;
    /** Retain statistics for this many days */
    statsRetentionDays: number;
  };
}

/**
 * Sync operation type for offline queue
 */
export type SyncOperation = 'create' | 'update' | 'delete' | 'sync';

/**
 * Sync priority levels
 */
export type SyncPriority = 'low' | 'normal' | 'medium' | 'high' | 'critical' | 'immediate';

/**
 * Offline queue item for sync operations
 */
export interface OfflineQueueItem {
  /** Operation identifier */
  id: string;
  /** Operation key */
  key: string;
  /** Operation type */
  operation: SyncOperation;
  /** Operation priority */
  priority: SyncPriority;
  /** Operation data */
  data: any;
  /** Creation timestamp */
  createdAt: string;
  /** Number of retry attempts */
  retryCount: number;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Operation metadata */
  metadata?: any;
}

/**
 * Offline queue configuration
 */
export interface OfflineQueueConfig {
  /** Maximum queue size */
  maxQueueSize: number;
  /** Default priority for operations */
  defaultPriority: SyncPriority;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Maximum retry attempts (alias for compatibility) */
  maxRetryAttempts: number;
  /** Retry delay in milliseconds */
  retryDelay: number;
  /** Base retry delay in milliseconds */
  retryDelayBase: number;
  /** Maximum retry delay in milliseconds */
  retryDelayMax: number;
  /** Retry delay multiplier */
  retryDelayMultiplier: number;
  /** Queue persistence enabled */
  persistQueue: boolean;
  /** Enable persistence (alias for compatibility) */
  enablePersistence: boolean;
  /** Enable batching */
  enableBatching: boolean;
  /** Batch size */
  batchSize: number;
  /** Batch timeout in milliseconds */
  batchTimeout: number;
  /** Enable network optimization */
  enableNetworkOptimization: boolean;
  /** Minimum connection quality */
  minConnectionQuality: string;
  /** Enable priority queuing */
  enablePriorityQueuing: boolean;
}

/**
 * Offline queue statistics
 */
export interface OfflineQueueStats {
  /** Total items in queue */
  totalItems: number;
  /** Total items queued (alias for compatibility) */
  totalQueued: number;
  /** Items by priority */
  itemsByPriority: Record<SyncPriority, number>;
  /** Items by operation */
  itemsByOperation: Record<SyncOperation, number>;
  /** Total failed operations */
  totalFailed: number;
  /** Total successful operations */
  totalSuccessful: number;
  /** Queue size in bytes */
  queueSize: number;
  /** Average processing time in milliseconds */
  averageProcessingTime: number;
}
