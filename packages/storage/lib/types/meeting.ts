/**
 * Meeting-specific storage types for the Meeting Summarizer Chrome Extension
 * Extends the base storage foundation with meeting data structures,
 * compression configuration, and storage optimization interfaces.
 */

// TODO: Fix import path when shared types are available
// import type { MeetingRecord, TranscriptionResult, MeetingSummary } from '@/shared/lib/types/meeting';

/**
 * Transcription result from Azure Speech Service
 */
export interface TranscriptionResult {
  id: string;
  text: string;
  fullText: string;
  confidence: number;
  timestamp: string;
  speakers?: SpeakerInfo[];
  segments: TranscriptionSegment[];
}

/**
 * Speaker information in transcription
 */
export interface SpeakerInfo {
  id: string;
  name?: string;
  email?: string;
}

/**
 * Transcription segment with timing
 */
export interface TranscriptionSegment {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  speaker?: SpeakerInfo;
  confidence: number;
}

export interface MeetingRecord {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime?: string;
  participants: SpeakerInfo[];
  transcription?: TranscriptionResult;
  summary?: MeetingSummary;
}

export interface MeetingSummary {
  id: string;
  meetingId: string;
  overview?: string;
  keyPoints: string[];
  actionItems: string[];
  decisions: string[];
  summary: string;
  confidence: number;
}

/**
 * Storage status for meeting records
 */
export type MeetingStorageStatus =
  | 'storing' // Data is being written to storage
  | 'stored' // Data is successfully stored
  | 'compressing' // Data is being compressed
  | 'compressed' // Data is compressed and stored
  | 'error'; // Storage operation failed

/**
 * Compression algorithm types supported for meeting data
 */
export type CompressionAlgorithm =
  | 'gzip' // Standard gzip compression
  | 'deflate' // Deflate compression
  | 'lz4' // LZ4 fast compression
  | 'none'; // No compression

/**
 * Compression level settings
 */
export type CompressionLevel =
  | 'fast' // Fast compression, larger size
  | 'balanced' // Balanced compression and speed
  | 'maximum'; // Maximum compression, slower

/**
 * Storage priority levels for data management
 */
export type StoragePriority =
  | 'critical' // Must never be deleted
  | 'high' // Delete only when absolutely necessary
  | 'medium' // Can be deleted when space is needed
  | 'low'; // Delete first when cleaning up

/**
 * Meeting storage record containing optimized storage data and metadata
 */
export interface MeetingStorageRecord {
  /** Unique storage identifier (SHA-256 hash of meeting URL + timestamp) */
  id: string;

  /** Core meeting data */
  meeting: MeetingRecord;

  /** Compressed transcription data (if enabled) */
  compressedTranscription?: Uint8Array;

  /** Searchable text content for indexing and search functionality */
  searchableText: string;

  /** User-defined tags for organization and filtering */
  tags: string[];

  /** Storage size in bytes for quota management */
  storageSize: number;

  /** Storage metadata for management and optimization */
  storageMetadata: StorageMetadata;

  /** Compression configuration used for this record */
  compressionConfig?: CompressionConfig;

  /** Storage priority level for cleanup decisions */
  priority: StoragePriority;

  /** Checksum for data integrity verification */
  checksum: string;

  /** Last access timestamp for LRU cache management (ISO 8601) */
  lastAccessed: string;

  /** Access count for usage analytics */
  accessCount: number;
}

/**
 * Storage metadata containing system-level information
 */
export interface StorageMetadata {
  /** Current storage status */
  status: MeetingStorageStatus;

  /** Original uncompressed size in bytes */
  originalSize: number;

  /** Compressed size in bytes (if compression is used) */
  compressedSize?: number;

  /** Compression ratio (original/compressed) */
  compressionRatio?: number;

  /** Storage operation timestamps */
  timestamps: {
    /** When the record was first stored (ISO 8601) */
    stored: string;
    /** When the record was last updated (ISO 8601) */
    updated: string;
    /** When compression was applied (ISO 8601) */
    compressed?: string;
    /** When the record was last verified (ISO 8601) */
    verified?: string;
  };

  /** Version of the storage format for migration support */
  storageVersion: string;

  /** Error information if storage operation failed */
  error?: {
    /** Error message */
    message: string;
    /** Error code */
    code: string;
    /** Timestamp when error occurred (ISO 8601) */
    timestamp: string;
  };
}

/**
 * Compression configuration for meeting data storage
 */
export interface CompressionConfig {
  /** Compression algorithm to use */
  algorithm: CompressionAlgorithm;

  /** Compression level setting */
  level: CompressionLevel;

  /** Enable compression for transcription data */
  compressTranscription: boolean;

  /** Enable compression for summary data */
  compressSummary: boolean;

  /** Minimum size threshold for compression (bytes) */
  minSizeThreshold: number;

  /** Target compression ratio (0-1, where 0.5 means 50% size reduction) */
  targetRatio?: number;

  /** Maximum compression time limit in milliseconds */
  maxCompressionTime: number;
}

/**
 * Search index entry for meeting content
 */
export interface MeetingSearchIndex {
  /** Meeting storage record ID */
  meetingId: string;

  /** Indexed search terms */
  searchTerms: string[];

  /** Full-text search content */
  fullTextContent: string;

  /** Participant names for search */
  participantNames: string[];

  /** Meeting tags for filtering */
  tags: string[];

  /** Indexing metadata */
  indexMetadata: {
    /** When the index was created (ISO 8601) */
    indexedAt: string;
    /** Index version for upgrades */
    indexVersion: string;
    /** Number of search terms indexed */
    termCount: number;
  };
}

/**
 * Batch storage operation configuration
 */
export interface BatchStorageOperation {
  /** Operation type */
  operation: 'create' | 'update' | 'delete' | 'compress';

  /** Meeting records to process */
  records: MeetingStorageRecord[];

  /** Batch operation settings */
  settings: {
    /** Maximum batch size */
    maxBatchSize: number;
    /** Timeout for batch operation in milliseconds */
    timeout: number;
    /** Continue on individual failures */
    continueOnError: boolean;
    /** Enable transaction-like behavior */
    atomic: boolean;
  };

  /** Progress callback for operation tracking */
  onProgress?: (processed: number, total: number, currentRecord?: string) => void;
}

/**
 * Storage quota management information
 */
export interface StorageQuotaInfo {
  /** Total storage quota in bytes */
  totalQuota: number;

  /** Used storage in bytes */
  usedStorage: number;

  /** Available storage in bytes */
  availableStorage: number;

  /** Usage percentage (0-1) */
  usagePercentage: number;

  /** Breakdown by data type */
  breakdown: {
    /** Storage used by meeting records */
    meetingRecords: number;
    /** Storage used by transcriptions */
    transcriptions: number;
    /** Storage used by summaries */
    summaries: number;
    /** Storage used by indexes */
    indexes: number;
    /** Storage used by cache */
    cache: number;
    /** Storage used by configuration */
    configuration: number;
  };

  /** Recommendations for quota management */
  recommendations: {
    /** Suggested cleanup actions */
    cleanupActions: Array<{
      action: 'compress' | 'archive' | 'delete';
      description: string;
      potentialSavings: number;
      priority: StoragePriority;
    }>;
    /** Estimated time until quota is full */
    timeUntilFull?: string;
  };
}

/**
 * Storage performance metrics
 */
export interface StoragePerformanceMetrics {
  /** Average operation times in milliseconds */
  averageOperationTimes: {
    read: number;
    write: number;
    delete: number;
    compress: number;
    search: number;
  };

  /** Operation success rates (0-1) */
  successRates: {
    read: number;
    write: number;
    delete: number;
    compress: number;
  };

  /** Cache performance metrics */
  cacheMetrics: {
    hitRate: number;
    missRate: number;
    averageRetrievalTime: number;
  };

  /** Storage optimization metrics */
  optimizationMetrics: {
    compressionEffectiveness: number;
    deduplicationSavings: number;
    indexingEfficiency: number;
  };
}

/**
 * Meeting storage configuration
 */
export interface MeetingStorageConfig {
  /** Default compression settings */
  defaultCompression: CompressionConfig;

  /** Automatic cleanup settings */
  autoCleanup: {
    /** Enable automatic cleanup */
    enabled: boolean;
    /** Days after which to consider records for cleanup */
    retentionDays: number;
    /** Maximum storage usage before triggering cleanup (0-1) */
    maxUsageThreshold: number;
    /** Cleanup schedule (cron-like expression) */
    schedule?: string;
  };

  /** Index settings */
  indexing: {
    /** Enable full-text search indexing */
    enabled: boolean;
    /** Update index on every change */
    realTimeUpdates: boolean;
    /** Rebuild index interval in days */
    rebuildInterval: number;
  };

  /** Performance settings */
  performance: {
    /** Maximum concurrent storage operations */
    maxConcurrentOps: number;
    /** Cache size limit in bytes */
    cacheSize: number;
    /** Enable batch operations */
    enableBatching: boolean;
  };

  /** Security settings */
  security: {
    /** Enable data integrity checking */
    enableIntegrityChecks: boolean;
    /** Checksum algorithm */
    checksumAlgorithm: 'sha256' | 'crc32';
    /** Enable data obfuscation (not encryption) */
    enableObfuscation: boolean;
  };
}
