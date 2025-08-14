/**
 * Compression Utilities
 * Implements text compression for large transcriptions with
 * compression ratio monitoring and optimization for storage efficiency.
 */

import type { CompressionConfig, CompressionAlgorithm, CompressionLevel } from '../types/meeting';

/**
 * Compression result with metadata
 */
export interface CompressionResult {
  /** Whether compression was successful */
  success: boolean;
  /** Compressed data */
  data?: Uint8Array;
  /** Original data size in bytes */
  originalSize: number;
  /** Compressed data size in bytes */
  compressedSize: number;
  /** Compression ratio (compressed/original) */
  compressionRatio: number;
  /** Compression time in milliseconds */
  compressionTime: number;
  /** Compression algorithm used */
  algorithm: CompressionAlgorithm;
  /** Error information if compression failed */
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Decompression result with metadata
 */
export interface DecompressionResult {
  /** Whether decompression was successful */
  success: boolean;
  /** Decompressed text data */
  data?: string;
  /** Original compressed size in bytes */
  compressedSize: number;
  /** Decompressed data size in bytes */
  decompressedSize: number;
  /** Decompression time in milliseconds */
  decompressionTime: number;
  /** Error information if decompression failed */
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Compression statistics for monitoring
 */
export interface CompressionStats {
  /** Total compressions performed */
  totalCompressions: number;
  /** Total decompressions performed */
  totalDecompressions: number;
  /** Average compression ratio */
  averageCompressionRatio: number;
  /** Average compression time in milliseconds */
  averageCompressionTime: number;
  /** Average decompression time in milliseconds */
  averageDecompressionTime: number;
  /** Total bytes saved through compression */
  totalBytesSaved: number;
  /** Compression success rate (0-1) */
  successRate: number;
  /** Statistics by algorithm */
  byAlgorithm: Record<
    CompressionAlgorithm,
    {
      count: number;
      averageRatio: number;
      averageTime: number;
    }
  >;
}

/**
 * Compression utility class for meeting transcription data
 */
export class CompressionUtils {
  private stats: CompressionStats;
  private defaultConfig: CompressionConfig;

  constructor(defaultConfig?: Partial<CompressionConfig>) {
    this.defaultConfig = {
      algorithm: 'gzip',
      level: 'balanced',
      compressTranscription: true,
      compressSummary: false,
      minSizeThreshold: 1024, // 1KB
      maxCompressionTime: 5000, // 5 seconds
      ...defaultConfig,
    };

    this.stats = {
      totalCompressions: 0,
      totalDecompressions: 0,
      averageCompressionRatio: 0,
      averageCompressionTime: 0,
      averageDecompressionTime: 0,
      totalBytesSaved: 0,
      successRate: 1,
      byAlgorithm: {
        gzip: { count: 0, averageRatio: 0, averageTime: 0 },
        deflate: { count: 0, averageRatio: 0, averageTime: 0 },
        lz4: { count: 0, averageRatio: 0, averageTime: 0 },
        none: { count: 0, averageRatio: 1, averageTime: 0 },
      },
    };
  }

  /**
   * Compress text data using specified configuration
   */
  public async compressText(text: string, config?: Partial<CompressionConfig>): Promise<CompressionResult> {
    const startTime = Date.now();
    const effectiveConfig = { ...this.defaultConfig, ...config };
    const originalData = new TextEncoder().encode(text);
    const originalSize = originalData.length;

    // Check size threshold
    if (originalSize < effectiveConfig.minSizeThreshold) {
      return {
        success: false,
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 1,
        compressionTime: Date.now() - startTime,
        algorithm: effectiveConfig.algorithm,
        error: {
          code: 'SIZE_THRESHOLD_NOT_MET',
          message: `Data size (${originalSize}) is below compression threshold (${effectiveConfig.minSizeThreshold})`,
        },
      };
    }

    try {
      let compressedData: Uint8Array;

      switch (effectiveConfig.algorithm) {
        case 'gzip':
          compressedData = await this.compressWithGzip(originalData, effectiveConfig);
          break;
        case 'deflate':
          compressedData = await this.compressWithDeflate(originalData, effectiveConfig);
          break;
        case 'lz4':
          compressedData = await this.compressWithLZ4(originalData, effectiveConfig);
          break;
        case 'none':
          compressedData = originalData;
          break;
        default:
          throw new Error(`Unsupported compression algorithm: ${effectiveConfig.algorithm}`);
      }

      const compressionTime = Date.now() - startTime;

      // Check compression time limit
      if (compressionTime > effectiveConfig.maxCompressionTime) {
        return {
          success: false,
          originalSize,
          compressedSize: originalSize,
          compressionRatio: 1,
          compressionTime,
          algorithm: effectiveConfig.algorithm,
          error: {
            code: 'COMPRESSION_TIMEOUT',
            message: `Compression took ${compressionTime}ms, exceeding limit of ${effectiveConfig.maxCompressionTime}ms`,
          },
        };
      }

      const compressedSize = compressedData.length;
      const compressionRatio = compressedSize / originalSize;

      // Update statistics
      this.updateCompressionStats(
        effectiveConfig.algorithm,
        compressionRatio,
        compressionTime,
        originalSize - compressedSize,
        true,
      );

      return {
        success: true,
        data: compressedData,
        originalSize,
        compressedSize,
        compressionRatio,
        compressionTime,
        algorithm: effectiveConfig.algorithm,
      };
    } catch (error) {
      const compressionTime = Date.now() - startTime;
      this.updateCompressionStats(effectiveConfig.algorithm, 1, compressionTime, 0, false);

      return {
        success: false,
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 1,
        compressionTime,
        algorithm: effectiveConfig.algorithm,
        error: {
          code: 'COMPRESSION_FAILED',
          message: `Compression failed: ${error instanceof Error ? error.message : String(error)}`,
        },
      };
    }
  }

  /**
   * Decompress data back to text
   */
  public async decompressText(
    compressedData: Uint8Array,
    algorithm: CompressionAlgorithm,
  ): Promise<DecompressionResult> {
    const startTime = Date.now();
    const compressedSize = compressedData.length;

    try {
      let decompressedData: Uint8Array;

      switch (algorithm) {
        case 'gzip':
          decompressedData = await this.decompressGzip(compressedData);
          break;
        case 'deflate':
          decompressedData = await this.decompressDeflate(compressedData);
          break;
        case 'lz4':
          decompressedData = await this.decompressLZ4(compressedData);
          break;
        case 'none':
          decompressedData = compressedData;
          break;
        default:
          throw new Error(`Unsupported decompression algorithm: ${algorithm}`);
      }

      const decompressionTime = Date.now() - startTime;
      const decompressedSize = decompressedData.length;
      const decompressedText = new TextDecoder().decode(decompressedData);

      // Update statistics
      this.updateDecompressionStats(decompressionTime, true);

      return {
        success: true,
        data: decompressedText,
        compressedSize,
        decompressedSize,
        decompressionTime,
      };
    } catch (error) {
      const decompressionTime = Date.now() - startTime;
      this.updateDecompressionStats(decompressionTime, false);

      return {
        success: false,
        compressedSize,
        decompressedSize: 0,
        decompressionTime,
        error: {
          code: 'DECOMPRESSION_FAILED',
          message: `Decompression failed: ${error instanceof Error ? error.message : String(error)}`,
        },
      };
    }
  }

  /**
   * Estimate compression ratio for text without actually compressing
   */
  public estimateCompressionRatio(text: string, algorithm: CompressionAlgorithm): number {
    // Simple heuristic based on text characteristics
    const textLength = text.length;

    if (textLength === 0) return 1;

    // Calculate character frequency for entropy estimation
    const charFreq = new Map<string, number>();
    for (const char of text) {
      charFreq.set(char, (charFreq.get(char) || 0) + 1);
    }

    // Calculate entropy
    let entropy = 0;
    for (const freq of charFreq.values()) {
      const probability = freq / textLength;
      entropy -= probability * Math.log2(probability);
    }

    // Estimate compression ratio based on entropy and algorithm
    const maxEntropy = Math.log2(charFreq.size);
    const entropyRatio = entropy / maxEntropy;

    switch (algorithm) {
      case 'gzip':
        return Math.max(0.1, 0.3 + entropyRatio * 0.4); // 10-70% compression
      case 'deflate':
        return Math.max(0.15, 0.35 + entropyRatio * 0.4); // 15-75% compression
      case 'lz4':
        return Math.max(0.4, 0.6 + entropyRatio * 0.2); // 40-80% compression (fast but less efficient)
      case 'none':
        return 1; // No compression
      default:
        return 0.5; // Conservative estimate
    }
  }

  /**
   * Get optimal compression configuration for text
   */
  public getOptimalConfig(
    text: string,
    constraints?: {
      maxTime?: number;
      minRatio?: number;
      prioritizeSpeed?: boolean;
    },
  ): CompressionConfig {
    const textSize = new TextEncoder().encode(text).length;
    const { maxTime = 5000, minRatio = 0.7, prioritizeSpeed = false } = constraints || {};

    // Choose algorithm based on constraints
    let algorithm: CompressionAlgorithm;
    let level: CompressionLevel;

    if (prioritizeSpeed || textSize > 1024 * 1024) {
      // > 1MB
      algorithm = 'lz4';
      level = 'fast';
    } else if (textSize < 10 * 1024) {
      // < 10KB
      algorithm = 'deflate';
      level = 'balanced';
    } else {
      algorithm = 'gzip';
      level = 'balanced';
    }

    // Adjust level based on time constraints
    if (maxTime < 1000) {
      level = 'fast';
    } else if (maxTime > 10000) {
      level = 'maximum';
    }

    return {
      algorithm,
      level,
      compressTranscription: true,
      compressSummary: textSize > 5 * 1024, // Only compress summaries > 5KB
      minSizeThreshold: 1024,
      maxCompressionTime: maxTime,
      targetRatio: minRatio,
    };
  }

  /**
   * Get compression statistics
   */
  public getStats(): CompressionStats {
    return { ...this.stats };
  }

  /**
   * Reset compression statistics
   */
  public resetStats(): void {
    this.stats = {
      totalCompressions: 0,
      totalDecompressions: 0,
      averageCompressionRatio: 0,
      averageCompressionTime: 0,
      averageDecompressionTime: 0,
      totalBytesSaved: 0,
      successRate: 1,
      byAlgorithm: {
        gzip: { count: 0, averageRatio: 0, averageTime: 0 },
        deflate: { count: 0, averageRatio: 0, averageTime: 0 },
        lz4: { count: 0, averageRatio: 0, averageTime: 0 },
        none: { count: 0, averageRatio: 1, averageTime: 0 },
      },
    };
  }

  /**
   * Compress data using Gzip
   */
  private async compressWithGzip(data: Uint8Array, config: CompressionConfig): Promise<Uint8Array> {
    if ('CompressionStream' in globalThis) {
      return this.compressWithStream('gzip', data);
    } else {
      // Fallback: return original data (could implement a JS-based gzip library)
      console.warn('CompressionStream not available, compression skipped');
      return data;
    }
  }

  /**
   * Compress data using Deflate
   */
  private async compressWithDeflate(data: Uint8Array, config: CompressionConfig): Promise<Uint8Array> {
    if ('CompressionStream' in globalThis) {
      return this.compressWithStream('deflate', data);
    } else {
      // Fallback: return original data
      console.warn('CompressionStream not available, compression skipped');
      return data;
    }
  }

  /**
   * Compress data using LZ4 (fallback to deflate)
   */
  private async compressWithLZ4(data: Uint8Array, config: CompressionConfig): Promise<Uint8Array> {
    // LZ4 is not natively supported in browsers, use deflate as fallback
    console.debug('LZ4 not available, using deflate as fallback');
    return this.compressWithDeflate(data, config);
  }

  /**
   * Generic compression using Compression Streams API
   */
  private async compressWithStream(format: 'gzip' | 'deflate', data: Uint8Array): Promise<Uint8Array> {
    const compressionStream = new CompressionStream(format);
    const writer = compressionStream.writable.getWriter();
    const reader = compressionStream.readable.getReader();

    // Write data to compression stream
    await writer.write(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
    await writer.close();

    // Read compressed chunks
    const chunks: Uint8Array[] = [];
    let done = false;

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        chunks.push(value);
      }
    }

    // Combine chunks into single array
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;

    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }

  /**
   * Decompress Gzip data
   */
  private async decompressGzip(data: Uint8Array): Promise<Uint8Array> {
    if ('DecompressionStream' in globalThis) {
      return this.decompressWithStream('gzip', data);
    } else {
      // Fallback: return original data
      console.warn('DecompressionStream not available, decompression skipped');
      return data;
    }
  }

  /**
   * Decompress Deflate data
   */
  private async decompressDeflate(data: Uint8Array): Promise<Uint8Array> {
    if ('DecompressionStream' in globalThis) {
      return this.decompressWithStream('deflate', data);
    } else {
      // Fallback: return original data
      console.warn('DecompressionStream not available, decompression skipped');
      return data;
    }
  }

  /**
   * Decompress LZ4 data (fallback to deflate)
   */
  private async decompressLZ4(data: Uint8Array): Promise<Uint8Array> {
    // LZ4 is not natively supported, use deflate as fallback
    console.debug('LZ4 not available, using deflate as fallback');
    return this.decompressDeflate(data);
  }

  /**
   * Generic decompression using Decompression Streams API
   */
  private async decompressWithStream(format: 'gzip' | 'deflate', data: Uint8Array): Promise<Uint8Array> {
    const decompressionStream = new DecompressionStream(format);
    const writer = decompressionStream.writable.getWriter();
    const reader = decompressionStream.readable.getReader();

    // Write compressed data to decompression stream
    await writer.write(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
    await writer.close();

    // Read decompressed chunks
    const chunks: Uint8Array[] = [];
    let done = false;

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        chunks.push(value);
      }
    }

    // Combine chunks into single array
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;

    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }

  /**
   * Update compression statistics
   */
  private updateCompressionStats(
    algorithm: CompressionAlgorithm,
    ratio: number,
    time: number,
    bytesSaved: number,
    success: boolean,
  ): void {
    this.stats.totalCompressions++;

    // Update overall averages
    const total = this.stats.totalCompressions;
    this.stats.averageCompressionRatio = (this.stats.averageCompressionRatio * (total - 1) + ratio) / total;
    this.stats.averageCompressionTime = (this.stats.averageCompressionTime * (total - 1) + time) / total;
    this.stats.totalBytesSaved += bytesSaved;

    // Update success rate
    const successCount = Math.round(this.stats.successRate * (total - 1)) + (success ? 1 : 0);
    this.stats.successRate = successCount / total;

    // Update algorithm-specific stats
    const algoStats = this.stats.byAlgorithm[algorithm];
    algoStats.count++;
    algoStats.averageRatio = (algoStats.averageRatio * (algoStats.count - 1) + ratio) / algoStats.count;
    algoStats.averageTime = (algoStats.averageTime * (algoStats.count - 1) + time) / algoStats.count;
  }

  /**
   * Update decompression statistics
   */
  private updateDecompressionStats(time: number, success: boolean): void {
    this.stats.totalDecompressions++;

    const total = this.stats.totalDecompressions;
    this.stats.averageDecompressionTime = (this.stats.averageDecompressionTime * (total - 1) + time) / total;
  }
}
