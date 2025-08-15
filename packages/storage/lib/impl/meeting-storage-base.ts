/**
 * Meeting Storage Base Class
 * Extends the base storage foundation with meeting-specific functionality,
 * data compression, and validation methods for meeting data storage operations.
 */

import { createStorage } from '../base/base';
import { StorageEnum } from '../base/enums';
import type { BaseStorageType, StorageConfigType } from '../base/types';
import type {
  MeetingStorageRecord,
  CompressionConfig,
  StorageMetadata,
  MeetingStorageStatus,
  StoragePerformanceMetrics,
} from '../types/meeting';

/**
 * Meeting storage configuration extending base storage config
 */
export interface MeetingStorageConfig extends StorageConfigType<MeetingStorageRecord[]> {
  /** Default compression settings for meeting data */
  defaultCompression?: CompressionConfig;
  /** Maximum individual record size in bytes */
  maxRecordSize?: number;
  /** Enable automatic data validation */
  enableValidation?: boolean;
  /** Performance monitoring settings */
  performanceMonitoring?: boolean;
}

/**
 * Storage operation result with metadata
 */
export interface StorageOperationResult<T = unknown> {
  /** Whether the operation was successful */
  success: boolean;
  /** Operation result data */
  data?: T;
  /** Error information if operation failed */
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  /** Operation performance metrics */
  metrics?: {
    /** Operation duration in milliseconds */
    duration: number;
    /** Size of data processed in bytes */
    dataSize: number;
    /** Compression ratio achieved (if applicable) */
    compressionRatio?: number;
  };
}

/**
 * Meeting storage base class providing core functionality for meeting data management
 */
export abstract class MeetingStorageBase {
  protected storage: BaseStorageType<MeetingStorageRecord[]>;
  protected config: Required<MeetingStorageConfig>;
  protected performanceMetrics: StoragePerformanceMetrics;

  constructor(storageKey: string, fallbackValue: MeetingStorageRecord[] = [], config: MeetingStorageConfig = {}) {
    // Set up default configuration
    this.config = {
      storageEnum: StorageEnum.Local,
      liveUpdate: false,
      sessionAccessForContentScripts: false,
      defaultCompression: {
        algorithm: 'gzip',
        level: 'balanced',
        compressTranscription: true,
        compressSummary: false,
        minSizeThreshold: 1024, // 1KB
        maxCompressionTime: 5000, // 5 seconds
      },
      maxRecordSize: 50 * 1024 * 1024, // 50MB
      enableValidation: true,
      performanceMonitoring: true,
      serialization: {
        serialize: this.serialize.bind(this),
        deserialize: this.deserialize.bind(this),
      },
      ...config,
    };

    // Initialize performance metrics
    this.performanceMetrics = {
      averageOperationTimes: {
        read: 0,
        write: 0,
        delete: 0,
        compress: 0,
        search: 0,
      },
      successRates: {
        read: 1,
        write: 1,
        delete: 1,
        compress: 1,
      },
      cacheMetrics: {
        hitRate: 0,
        missRate: 0,
        averageRetrievalTime: 0,
      },
      optimizationMetrics: {
        compressionEffectiveness: 0,
        deduplicationSavings: 0,
        indexingEfficiency: 0,
      },
    };

    // Create the underlying storage
    this.storage = createStorage(storageKey, fallbackValue, this.config);
  }

  /**
   * Serialize meeting storage records for storage
   */
  protected serialize(records: MeetingStorageRecord[]): string {
    try {
      // Convert Uint8Array to base64 for JSON serialization
      const serializable = records.map(record => ({
        ...record,
        compressedTranscription: record.compressedTranscription
          ? this.uint8ArrayToBase64(record.compressedTranscription)
          : undefined,
      }));

      return JSON.stringify(serializable);
    } catch (error) {
      throw new Error(`Failed to serialize meeting records: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Deserialize meeting storage records from storage
   */
  protected deserialize(text: string): MeetingStorageRecord[] {
    try {
      const parsed = JSON.parse(text);

      // Convert base64 back to Uint8Array
      return parsed.map((record: unknown) => {
        const meetingRecord = record as MeetingStorageRecord & {
          compressedTranscription?: string;
        };

        return {
          ...meetingRecord,
          compressedTranscription: meetingRecord.compressedTranscription
            ? this.base64ToUint8Array(meetingRecord.compressedTranscription)
            : undefined,
        };
      });
    } catch (error) {
      console.error('Failed to deserialize meeting records:', error);
      return [];
    }
  }

  /**
   * Convert Uint8Array to base64 string
   */
  protected uint8ArrayToBase64(uint8Array: Uint8Array): string {
    let binary = '';
    const len = uint8Array.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8Array[i] ?? 0);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 string to Uint8Array
   */
  protected base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const len = binary.length;
    const uint8Array = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      uint8Array[i] = binary.charCodeAt(i);
    }
    return uint8Array;
  }

  /**
   * Validate a meeting storage record
   */
  protected validateRecord(record: MeetingStorageRecord): StorageOperationResult<boolean> {
    if (!this.config.enableValidation) {
      return { success: true, data: true };
    }

    const errors: string[] = [];

    // Validate required fields
    if (!record.id) errors.push('Record ID is required');
    if (!record.meeting) errors.push('Meeting data is required');
    if (!record.searchableText) errors.push('Searchable text is required');
    if (!record.storageMetadata) errors.push('Storage metadata is required');

    // Validate record size
    if (record.storageSize > this.config.maxRecordSize) {
      errors.push(`Record size (${record.storageSize}) exceeds maximum (${this.config.maxRecordSize})`);
    }

    // Validate storage metadata
    if (record.storageMetadata) {
      if (!record.storageMetadata.status) errors.push('Storage status is required');
      if (!record.storageMetadata.timestamps) errors.push('Storage timestamps are required');
      if (!record.storageMetadata.storageVersion) errors.push('Storage version is required');
    }

    // Validate checksum if present
    if (record.checksum && !this.validateChecksum(record)) {
      errors.push('Record checksum validation failed');
    }

    if (errors.length > 0) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Record validation failed',
          details: errors,
        },
      };
    }

    return { success: true, data: true };
  }

  /**
   * Validate record checksum
   */
  protected validateChecksum(record: MeetingStorageRecord): boolean {
    try {
      const calculatedChecksum = this.calculateChecksum(record);
      return calculatedChecksum === record.checksum;
    } catch {
      return false;
    }
  }

  /**
   * Calculate checksum for a record
   */
  protected calculateChecksum(record: MeetingStorageRecord): string {
    // Create a copy without the checksum field for calculation
    const { checksum: _checksum, ...recordForChecksum } = record;
    const recordString = JSON.stringify(recordForChecksum);

    // Simple hash function (in production, use crypto API)
    let hash = 0;
    for (let i = 0; i < recordString.length; i++) {
      const char = recordString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return hash.toString(16);
  }

  /**
   * Compress data according to configuration
   */
  protected async compressData(data: string): Promise<StorageOperationResult<Uint8Array>> {
    const startTime = Date.now();

    try {
      // Check if compression is enabled and data meets threshold
      if (
        !this.config.defaultCompression.compressTranscription ||
        data.length < this.config.defaultCompression.minSizeThreshold
      ) {
        return {
          success: false,
          error: {
            code: 'COMPRESSION_SKIPPED',
            message: 'Data does not meet compression criteria',
          },
        };
      }

      // Simple compression using browser's compression stream
      const encoder = new TextEncoder();
      const inputData = encoder.encode(data);

      // Use CompressionStream if available (modern browsers)
      if ('CompressionStream' in globalThis) {
        const compressionStream = new CompressionStream(this.config.defaultCompression.algorithm as 'gzip' | 'deflate');
        const writer = compressionStream.writable.getWriter();
        const reader = compressionStream.readable.getReader();

        // Write data to compression stream
        await writer.write(inputData);
        await writer.close();

        // Read compressed data
        const chunks: Uint8Array[] = [];
        let done = false;

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            chunks.push(value);
          }
        }

        // Combine chunks
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const compressedData = new Uint8Array(totalLength);
        let offset = 0;

        for (const chunk of chunks) {
          compressedData.set(chunk, offset);
          offset += chunk.length;
        }

        const duration = Date.now() - startTime;
        const compressionRatio = compressedData.length / inputData.length;

        return {
          success: true,
          data: compressedData,
          metrics: {
            duration,
            dataSize: compressedData.length,
            compressionRatio,
          },
        };
      } else {
        // Fallback: Return original data as Uint8Array without compression
        return {
          success: false,
          data: inputData,
          error: {
            code: 'COMPRESSION_UNAVAILABLE',
            message: 'Compression API not available in this environment',
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'COMPRESSION_FAILED',
          message: `Compression failed: ${error instanceof Error ? error.message : String(error)}`,
        },
      };
    }
  }

  /**
   * Decompress data
   */
  protected async decompressData(compressedData: Uint8Array): Promise<StorageOperationResult<string>> {
    try {
      // Use DecompressionStream if available (modern browsers)
      if ('DecompressionStream' in globalThis) {
        const decompressionStream = new DecompressionStream(
          this.config.defaultCompression.algorithm as 'gzip' | 'deflate',
        );
        const writer = decompressionStream.writable.getWriter();
        const reader = decompressionStream.readable.getReader();

        // Write compressed data to decompression stream
        await writer.write(new Uint8Array(compressedData));
        await writer.close();

        // Read decompressed data
        const chunks: Uint8Array[] = [];
        let done = false;

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            chunks.push(value);
          }
        }

        // Combine chunks and decode to string
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const decompressedData = new Uint8Array(totalLength);
        let offset = 0;

        for (const chunk of chunks) {
          decompressedData.set(chunk, offset);
          offset += chunk.length;
        }

        const decoder = new TextDecoder();
        const decompressedString = decoder.decode(decompressedData);

        return {
          success: true,
          data: decompressedString,
        };
      } else {
        // Fallback: Treat as uncompressed data
        const decoder = new TextDecoder();
        const decompressedString = decoder.decode(compressedData);

        return {
          success: true,
          data: decompressedString,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'DECOMPRESSION_FAILED',
          message: `Decompression failed: ${error instanceof Error ? error.message : String(error)}`,
        },
      };
    }
  }

  /**
   * Create storage metadata for a new record
   */
  protected createStorageMetadata(
    status: MeetingStorageStatus,
    originalSize: number,
    compressedSize?: number,
  ): StorageMetadata {
    const now = new Date().toISOString();

    return {
      status,
      originalSize,
      compressedSize: compressedSize ?? 0,
      compressionRatio: compressedSize ? compressedSize / originalSize : 0,
      timestamps: {
        stored: now,
        updated: now,
        ...(compressedSize && { compressed: now }),
      },
      storageVersion: '1.0.0',
    };
  }

  /**
   * Update performance metrics
   */
  protected updatePerformanceMetrics(
    operation: keyof StoragePerformanceMetrics['averageOperationTimes'],
    duration: number,
    success: boolean,
  ): void {
    if (!this.config.performanceMonitoring) return;

    // Update average operation time
    const current = this.performanceMetrics.averageOperationTimes[operation];
    this.performanceMetrics.averageOperationTimes[operation] = (current + duration) / 2;

    // Update success rate
    if (operation in this.performanceMetrics.successRates) {
      const currentRate =
        this.performanceMetrics.successRates[operation as keyof StoragePerformanceMetrics['successRates']];
      const newRate = success ? Math.min(1, currentRate + 0.01) : Math.max(0, currentRate - 0.01);

      (this.performanceMetrics.successRates as Record<string, number>)[operation] = newRate;
    }
  }

  /**
   * Get current performance metrics
   */
  public getPerformanceMetrics(): StoragePerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Get underlying storage instance (for advanced operations)
   */
  protected getStorage(): BaseStorageType<MeetingStorageRecord[]> {
    return this.storage;
  }

  /**
   * Subscribe to storage changes
   */
  public subscribe(listener: () => void): () => void {
    return this.storage.subscribe(listener);
  }

  /**
   * Get current storage snapshot
   */
  public getSnapshot(): MeetingStorageRecord[] | null {
    return this.storage.getSnapshot();
  }
}
