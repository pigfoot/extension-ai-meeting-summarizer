/**
 * Transcription cache with URL hash-based lookup and validation
 * Implements specialized caching for Azure Speech API transcription results
 */

import { CacheBase } from './cache-base';
import type {
  CacheOptions,
  CacheOperationResult,
  TranscriptionData,
  TranscriptionCacheEntry,
  TranscriptionCacheMetadata,
} from '../types/cache';

/**
 * Transcription cache options
 */
export interface TranscriptionCacheOptions extends CacheOptions {
  /** Enable URL hash validation */
  enableUrlHashValidation?: boolean;
  /** Enable transcription content validation */
  enableContentValidation?: boolean;
  /** Maximum transcription text length to cache */
  maxTranscriptionLength?: number;
  /** Minimum confidence threshold for caching */
  minConfidenceThreshold?: number;
}

/**
 * URL hash calculation result
 */
export interface URLHashCalculation {
  /** Primary hash (URL + auth headers) */
  primaryHash: string;
  /** Content hash (audio content if available) */
  contentHash?: string;
  /** Metadata used in hash calculation */
  metadata: {
    url: string;
    timestamp: string;
    userAgent: string;
    referrer?: string;
  };
}

/**
 * Cache lookup result
 */
export interface TranscriptionCacheLookup {
  /** Whether transcription was found in cache */
  found: boolean;
  /** Cached transcription data */
  data?: TranscriptionData;
  /** Cache entry metadata */
  metadata?: TranscriptionCacheMetadata;
  /** Hash used for lookup */
  hash: string;
  /** Cache statistics at lookup time */
  cacheStats: {
    size: number;
    hitRatio: number;
    memoryUsage: number;
  };
}

/**
 * Specialized cache for Azure Speech API transcription results
 */
export class TranscriptionCache extends CacheBase<TranscriptionData> {
  private hashCache = new Map<string, URLHashCalculation>();
  private readonly transcriptionOptions: Required<TranscriptionCacheOptions>;

  constructor(options: Partial<TranscriptionCacheOptions> = {}) {
    const defaultOptions: TranscriptionCacheOptions = {
      maxSize: 500, // Store up to 500 transcriptions
      maxSizeBytes: 100 * 1024 * 1024, // 100MB for transcription data
      ttl: 7 * 24 * 60 * 60 * 1000, // 7 days
      evictionPolicy: 'lru',
      enableIntegrityCheck: true,
      enableMetrics: true,
      enableEvents: true,
      compressionThreshold: 5 * 1024, // 5KB
      maxMemoryUsage: 0.8,
      enableUrlHashValidation: true,
      enableContentValidation: true,
      maxTranscriptionLength: 1000000, // 1M characters
      minConfidenceThreshold: 0.7, // 70% confidence
    };

    super({ ...defaultOptions, ...options });
    this.transcriptionOptions = { ...defaultOptions, ...options } as Required<TranscriptionCacheOptions>;
  }

  /**
   * Cache transcription result by URL
   */
  async cacheTranscription(
    audioUrl: string,
    transcriptionData: TranscriptionData,
    options?: {
      authHeaders?: Record<string, string>;
      contentHash?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<CacheOperationResult<void>> {
    try {
      // Validate transcription data
      const validationResult = this.validateTranscriptionData(transcriptionData);
      if (!validationResult.valid) {
        return this.createOperationResult(false, undefined, validationResult.error, Date.now());
      }

      // Calculate URL hash
      const hashResult = await this.calculateUrlHash(audioUrl, options?.authHeaders, options?.contentHash);

      // Create enhanced metadata
      const now = new Date().toISOString();
      const metadata: TranscriptionCacheMetadata = {
        createdAt: now,
        updatedAt: now,
        lastAccessed: now,
        version: 1,
        priority: 5,
        tags: [],
        sizeCategory: 'medium',
        accessPattern: 'unknown',
        urlHash: hashResult.primaryHash,
        ...(hashResult.contentHash && { contentHash: hashResult.contentHash }),
        confidence: transcriptionData.confidence,
        language: transcriptionData.language,
        duration: transcriptionData.duration,
        textLength: transcriptionData.text.length,
        wordCount: transcriptionData.words?.length || 0,
        cacheTimestamp: now,
        ...(transcriptionData.azureMetadata?.requestId && {
          azureRequestId: transcriptionData.azureMetadata.requestId,
        }),
        ...options?.metadata,
      };

      // Cache with enhanced TTL based on confidence
      const confidenceMultiplier = Math.max(0.5, transcriptionData.confidence);
      const adjustedTtl = (this.options.ttl || 7 * 24 * 60 * 60 * 1000) * confidenceMultiplier;

      const result = await this.set(hashResult.primaryHash, transcriptionData, {
        ttl: adjustedTtl,
        metadata,
      });

      // Also cache hash calculation for future lookups
      this.hashCache.set(audioUrl, hashResult);

      return result;
    } catch (error) {
      return this.createOperationResult(
        false,
        undefined,
        error instanceof Error ? error.message : String(error),
        Date.now(),
      );
    }
  }

  /**
   * Lookup transcription by URL
   */
  async lookupTranscription(
    audioUrl: string,
    options?: {
      authHeaders?: Record<string, string>;
      contentHash?: string;
      requireMinConfidence?: boolean;
    },
  ): Promise<TranscriptionCacheLookup> {
    try {
      // Calculate URL hash
      const hashResult = await this.calculateUrlHash(audioUrl, options?.authHeaders, options?.contentHash);

      // Attempt cache lookup
      const cacheResult = await this.get(hashResult.primaryHash);

      const cacheStats = {
        size: this.size(),
        hitRatio: this.calculateHitRatio(),
        memoryUsage: this.getMemoryUsage().usedBytes,
      };

      if (!cacheResult.success || !cacheResult.data) {
        return {
          found: false,
          hash: hashResult.primaryHash,
          cacheStats,
        };
      }

      // Validate confidence threshold if required
      if (
        options?.requireMinConfidence &&
        cacheResult.data.confidence < this.transcriptionOptions.minConfidenceThreshold
      ) {
        return {
          found: false,
          hash: hashResult.primaryHash,
          cacheStats,
        };
      }

      // Extract metadata from cache entry
      const cacheEntry = this.cache.get(hashResult.primaryHash);
      const metadata = cacheEntry?.metadata as TranscriptionCacheMetadata;

      return {
        found: true,
        data: cacheResult.data,
        metadata,
        hash: hashResult.primaryHash,
        cacheStats,
      };
    } catch (error) {
      console.warn('[TranscriptionCache] Lookup failed:', error);

      return {
        found: false,
        hash: '',
        cacheStats: {
          size: this.size(),
          hitRatio: this.calculateHitRatio(),
          memoryUsage: this.getMemoryUsage().usedBytes,
        },
      };
    }
  }

  /**
   * Get cached transcriptions by language
   */
  async getTranscriptionsByLanguage(language: string): Promise<
    Array<{
      hash: string;
      data: TranscriptionData;
      metadata: TranscriptionCacheMetadata;
    }>
  > {
    const results: Array<{
      hash: string;
      data: TranscriptionData;
      metadata: TranscriptionCacheMetadata;
    }> = [];

    for (const [hash, entry] of this.cache.entries()) {
      if (!this.isExpired(entry) && entry.data.language === language) {
        const metadata = entry.metadata as TranscriptionCacheMetadata;
        results.push({
          hash,
          data: entry.data,
          metadata,
        });
      }
    }

    return results.sort((a, b) => b.data.confidence - a.data.confidence);
  }

  /**
   * Get cached transcriptions by confidence range
   */
  async getTranscriptionsByConfidence(
    minConfidence: number,
    maxConfidence: number = 1.0,
  ): Promise<
    Array<{
      hash: string;
      data: TranscriptionData;
      metadata: TranscriptionCacheMetadata;
    }>
  > {
    const results: Array<{
      hash: string;
      data: TranscriptionData;
      metadata: TranscriptionCacheMetadata;
    }> = [];

    for (const [hash, entry] of this.cache.entries()) {
      if (!this.isExpired(entry) && entry.data.confidence >= minConfidence && entry.data.confidence <= maxConfidence) {
        const metadata = entry.metadata as TranscriptionCacheMetadata;
        results.push({
          hash,
          data: entry.data,
          metadata,
        });
      }
    }

    return results.sort((a, b) => new Date(b.data.timestamp).getTime() - new Date(a.data.timestamp).getTime());
  }

  /**
   * Clear transcriptions older than specified date
   */
  async clearOldTranscriptions(cutoffDate: Date): Promise<number> {
    let removedCount = 0;
    const cutoffTime = cutoffDate.getTime();

    for (const [hash, entry] of this.cache.entries()) {
      const entryTime = new Date(entry.data.timestamp).getTime();

      if (entryTime < cutoffTime) {
        await this.delete(hash);
        removedCount++;
      }
    }

    return removedCount;
  }

  /**
   * Get transcription cache analytics
   */
  getAnalytics(): {
    totalTranscriptions: number;
    languageDistribution: Record<string, number>;
    averageConfidence: number;
    averageDuration: number;
    totalDuration: number;
    confidenceDistribution: {
      high: number; // > 0.9
      medium: number; // 0.7-0.9
      low: number; // < 0.7
    };
    sizeDistribution: {
      small: number; // < 1KB
      medium: number; // 1KB-10KB
      large: number; // > 10KB
    };
  } {
    const analytics = {
      totalTranscriptions: 0,
      languageDistribution: {} as Record<string, number>,
      averageConfidence: 0,
      averageDuration: 0,
      totalDuration: 0,
      confidenceDistribution: {
        high: 0,
        medium: 0,
        low: 0,
      },
      sizeDistribution: {
        small: 0,
        medium: 0,
        large: 0,
      },
    };

    let totalConfidence = 0;

    for (const entry of this.cache.values()) {
      if (this.isExpired(entry)) continue;

      const data = entry.data;
      analytics.totalTranscriptions++;

      // Language distribution
      analytics.languageDistribution[data.language] = (analytics.languageDistribution[data.language] || 0) + 1;

      // Confidence analytics
      totalConfidence += data.confidence;

      if (data.confidence > 0.9) {
        analytics.confidenceDistribution.high++;
      } else if (data.confidence >= 0.7) {
        analytics.confidenceDistribution.medium++;
      } else {
        analytics.confidenceDistribution.low++;
      }

      // Duration analytics
      analytics.totalDuration += data.duration;

      // Size analytics
      const textSize = data.text.length;
      if (textSize < 1024) {
        analytics.sizeDistribution.small++;
      } else if (textSize < 10240) {
        analytics.sizeDistribution.medium++;
      } else {
        analytics.sizeDistribution.large++;
      }
    }

    if (analytics.totalTranscriptions > 0) {
      analytics.averageConfidence = totalConfidence / analytics.totalTranscriptions;
      analytics.averageDuration = analytics.totalDuration / analytics.totalTranscriptions;
    }

    return analytics;
  }

  /**
   * Calculate data size for transcription data
   */
  protected calculateDataSize(data: TranscriptionData): number {
    let size = 0;

    // Text content
    size += new TextEncoder().encode(data.text).length;

    // Words array
    if (data.words) {
      size += JSON.stringify(data.words).length;
    }

    // Other string fields
    size += new TextEncoder().encode(data.language).length;
    size += new TextEncoder().encode(data.timestamp).length;

    // Azure metadata
    if (data.azureMetadata) {
      size += JSON.stringify(data.azureMetadata).length;
    }

    // Numbers (rough estimate)
    size += 24; // confidence + duration + numbers

    return size;
  }

  /**
   * Calculate checksum for transcription data
   */
  protected async calculateChecksum(data: TranscriptionData): Promise<string> {
    const content = JSON.stringify({
      text: data.text,
      confidence: data.confidence,
      language: data.language,
      duration: data.duration,
      wordCount: data.words?.length || 0,
    });

    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));

    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Validate transcription data integrity
   */
  protected async validateIntegrity(entry: TranscriptionCacheEntry): Promise<boolean> {
    if (!this.transcriptionOptions.enableContentValidation) return true;
    if (!entry.metadata?.checksum) return true;

    try {
      const currentChecksum = await this.calculateChecksum(entry.data);
      return currentChecksum === entry.metadata.checksum;
    } catch (error) {
      console.warn('[TranscriptionCache] Integrity validation failed:', error);
      return false;
    }
  }

  /**
   * Calculate URL hash for cache key generation
   */
  private async calculateUrlHash(
    audioUrl: string,
    authHeaders?: Record<string, string>,
    contentHash?: string,
  ): Promise<URLHashCalculation> {
    // Check if we have a cached calculation
    const cached = this.hashCache.get(audioUrl);
    if (cached && !contentHash) return cached;

    // Normalize URL (remove query parameters that might change)
    const url = new URL(audioUrl);
    const normalizedUrl = `${url.protocol}//${url.host}${url.pathname}`;

    // Create hash input
    const hashInput = {
      url: normalizedUrl,
      authHeaders: authHeaders
        ? Object.keys(authHeaders)
            .sort()
            .map(key => `${key}:${authHeaders[key]}`)
            .join(';')
        : '',
      contentHash: contentHash || '',
      timestamp: new Date().toISOString().split('T')[0], // Daily variation
    };

    const hashContent = JSON.stringify(hashInput);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(hashContent);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const primaryHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const result: URLHashCalculation = {
      primaryHash,
      ...(contentHash && { contentHash }),
      metadata: {
        url: audioUrl,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        ...(document.referrer && { referrer: document.referrer }),
      },
    };

    return result;
  }

  /**
   * Validate transcription data
   */
  private validateTranscriptionData(data: TranscriptionData): { valid: boolean; error?: string } {
    // Check required fields
    if (!data.text || typeof data.text !== 'string') {
      return { valid: false, error: 'Invalid or missing transcription text' };
    }

    if (typeof data.confidence !== 'number' || data.confidence < 0 || data.confidence > 1) {
      return { valid: false, error: 'Invalid confidence score (must be 0-1)' };
    }

    if (!data.language || typeof data.language !== 'string') {
      return { valid: false, error: 'Invalid or missing language' };
    }

    if (typeof data.duration !== 'number' || data.duration <= 0) {
      return { valid: false, error: 'Invalid duration (must be positive number)' };
    }

    // Check size limits
    if (data.text.length > this.transcriptionOptions.maxTranscriptionLength) {
      return {
        valid: false,
        error: `Transcription text too long (max ${this.transcriptionOptions.maxTranscriptionLength} characters)`,
      };
    }

    // Check confidence threshold
    if (data.confidence < this.transcriptionOptions.minConfidenceThreshold) {
      return { valid: false, error: `Confidence too low (min ${this.transcriptionOptions.minConfidenceThreshold})` };
    }

    // Validate words array if present
    if (data.words && Array.isArray(data.words)) {
      for (const word of data.words) {
        if (
          !word.word ||
          typeof word.word !== 'string' ||
          typeof word.start !== 'number' ||
          typeof word.end !== 'number' ||
          typeof word.confidence !== 'number'
        ) {
          return { valid: false, error: 'Invalid word timing data structure' };
        }
      }
    }

    return { valid: true };
  }
}
