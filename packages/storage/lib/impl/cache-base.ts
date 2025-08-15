/**
 * Cache base class implementing LRU cache foundation with integrity checking
 * Provides performance monitoring and cache statistics for intelligent caching
 */

import type { CacheEntry, CacheStats, CacheOptions, CacheMetrics, CacheOperationResult } from '../types/cache';

/**
 * Cache event types for monitoring
 */
export type CacheEventType = 'hit' | 'miss' | 'set' | 'delete' | 'evict' | 'clear';

/**
 * Cache event data
 */
export interface CacheEvent {
  /** Event type */
  type: CacheEventType;
  /** Cache key involved */
  key: string;
  /** Event timestamp */
  timestamp: string;
  /** Additional event data */
  data?: {
    /** Hit ratio at time of event */
    hitRatio?: number;
    /** Cache size at time of event */
    cacheSize?: number;
    /** Evicted entry data */
    evictedEntry?: CacheEntry<unknown>;
  };
}

/**
 * Cache event listener function
 */
export type CacheEventListener = (event: CacheEvent) => void;

/**
 * Abstract base class for intelligent caching with LRU eviction and integrity checking
 */
export abstract class CacheBase<T = unknown> {
  protected cache = new Map<string, CacheEntry<T>>();
  protected accessOrder = new Map<string, number>();
  protected options: Required<CacheOptions>;
  protected stats: CacheStats;
  protected metrics: CacheMetrics;
  protected eventListeners = new Map<CacheEventType, Set<CacheEventListener>>();
  protected accessCounter = 0;
  protected startTime = Date.now();

  constructor(options: Partial<CacheOptions> = {}) {
    this.options = {
      maxSize: options.maxSize || 100,
      maxSizeBytes: options.maxSizeBytes || 50 * 1024 * 1024, // 50MB default
      defaultTTL: options.defaultTTL || 60 * 60, // 1 hour default (seconds)
      ttl: options.ttl || 60 * 60 * 1000, // 1 hour default (milliseconds)
      enableCompression: options.enableCompression !== false,
      evictionPolicy: options.evictionPolicy || 'lru',
      enableIntegrityCheck: options.enableIntegrityCheck !== false,
      enableMetrics: options.enableMetrics !== false,
      enableEvents: options.enableEvents !== false,
      compressionThreshold: options.compressionThreshold || 1024, // 1KB
      maxMemoryUsage: options.maxMemoryUsage || 0.8, // 80% of available memory
    };

    this.stats = this.initializeStats();
    this.metrics = this.initializeMetrics();
  }

  /**
   * Get item from cache
   */
  async get(key: string): Promise<CacheOperationResult<T>> {
    const startTime = Date.now();

    try {
      const entry = this.cache.get(key);

      if (!entry) {
        this.recordCacheEvent('miss', key);
        this.stats.misses++;
        this.stats.totalRequests++;

        return this.createOperationResult<T>(false, undefined, undefined, startTime);
      }

      // Check if entry is expired
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        this.accessOrder.delete(key);
        this.recordCacheEvent('miss', key);
        this.stats.misses++;
        this.stats.totalRequests++;
        this.stats.expiredEntries++;

        return this.createOperationResult<T>(false, undefined, 'Entry expired', startTime);
      }

      // Validate integrity if enabled
      if (this.options.enableIntegrityCheck && !(await this.validateIntegrity(entry))) {
        this.cache.delete(key);
        this.accessOrder.delete(key);
        this.recordCacheEvent('miss', key);
        this.stats.misses++;
        this.stats.totalRequests++;
        this.stats.corruptedEntries++;

        return this.createOperationResult<T>(false, undefined, 'Integrity check failed', startTime);
      }

      // Update access order for LRU
      this.updateAccessOrder(key);

      // Update entry access info
      entry.lastAccessTime = Date.now();
      entry.accessCount++;

      this.recordCacheEvent('hit', key);
      this.stats.hits++;
      this.stats.totalRequests++;

      return this.createOperationResult(true, entry.data, undefined, startTime);
    } catch (error) {
      this.stats.errors++;
      return this.createOperationResult<T>(
        false,
        undefined,
        error instanceof Error ? error.message : String(error),
        startTime,
      );
    }
  }

  /**
   * Set item in cache
   */
  async set(
    key: string,
    data: T,
    options?: Partial<{ ttl: number; metadata: Record<string, unknown> }>,
  ): Promise<CacheOperationResult<void>> {
    const startTime = Date.now();

    try {
      // Check if we need to evict entries
      await this.ensureCapacity();

      // Calculate data size
      const dataSize = this.calculateDataSize(data);

      // Create cache entry
      const entry: CacheEntry<T> = {
        entryId: this.generateEntryId(),
        key,
        urlHash: this.generateUrlHash(key),
        sourceUrl: key,
        data,
        createdAt: new Date().toISOString(),
        size: dataSize,
        lastAccessTime: Date.now(),
        expiresAt: Date.now() + (options?.ttl ?? this.options.ttl ?? 3600000), // Default 1 hour
        accessCount: 0,
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastAccessed: new Date().toISOString(),
          expiresAt: new Date(Date.now() + (options?.ttl ?? this.options.ttl ?? 3600000)).toISOString(),
          ttl: (options?.ttl ?? this.options.ttl ?? 3600000) / 1000, // Convert to seconds
          version: 1,
          priority: 1,
          tags: [],
          sizeCategory: this.categorizeSize(dataSize),
          accessPattern: 'unknown',
          ...(options?.metadata || {}),
        },
        integrity: {
          checksum: this.options.enableIntegrityCheck ? await this.calculateChecksum(data) : '',
          checksumAlgorithm: 'sha256',
          lastVerified: new Date().toISOString(),
          verificationInterval: 24,
          status: 'verified',
        },
      };

      // Store in cache
      this.cache.set(key, entry);
      this.updateAccessOrder(key);

      this.recordCacheEvent('set', key);
      this.stats.writes++;
      this.stats.totalDataSize += dataSize;

      return this.createOperationResult<void>(true, undefined, undefined, startTime);
    } catch (error) {
      this.stats.errors++;
      return this.createOperationResult<void>(
        false,
        undefined,
        error instanceof Error ? error.message : String(error),
        startTime,
      );
    }
  }

  /**
   * Delete item from cache
   */
  async delete(key: string): Promise<CacheOperationResult<boolean>> {
    const startTime = Date.now();

    try {
      const entry = this.cache.get(key);

      if (entry) {
        this.cache.delete(key);
        this.accessOrder.delete(key);
        this.stats.totalDataSize -= entry.size;
        this.recordCacheEvent('delete', key);
        return this.createOperationResult<boolean>(true, true, undefined, startTime);
      }

      return this.createOperationResult<boolean>(true, false, undefined, startTime);
    } catch (error) {
      this.stats.errors++;
      return this.createOperationResult<boolean>(
        false,
        false,
        error instanceof Error ? error.message : String(error),
        startTime,
      );
    }
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    return entry !== undefined && !this.isExpired(entry);
  }

  /**
   * Get cache keys
   */
  keys(): string[] {
    const validKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (!this.isExpired(entry)) {
        validKeys.push(key);
      }
    }

    return validKeys;
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Clear entire cache
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.accessOrder.clear();
    this.stats.totalDataSize = 0;
    this.recordCacheEvent('clear', '*');
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    this.updateRuntimeStats();
    return { ...this.stats };
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Cleanup expired entries
   */
  async cleanup(): Promise<number> {
    let removedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        this.accessOrder.delete(key);
        this.stats.totalDataSize -= entry.size;
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.stats.expiredEntries += removedCount;
    }

    return removedCount;
  }

  /**
   * Force eviction of least recently used entries
   */
  async evictLRU(count: number = 1): Promise<CacheEntry<T>[]> {
    const evictedEntries: CacheEntry<T>[] = [];

    // Sort by access order (oldest first)
    const sortedEntries = Array.from(this.accessOrder.entries())
      .sort((a, b) => a[1] - b[1])
      .slice(0, count);

    for (const [key] of sortedEntries) {
      const entry = this.cache.get(key);
      if (entry) {
        this.cache.delete(key);
        this.accessOrder.delete(key);
        this.stats.totalDataSize -= entry.size;
        this.stats.evictions++;
        evictedEntries.push(entry);
        this.recordCacheEvent('evict', key, { evictedEntry: entry });
      }
    }

    return evictedEntries;
  }

  /**
   * Add event listener
   */
  addEventListener(eventType: CacheEventType, listener: CacheEventListener): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(eventType: CacheEventType, listener: CacheEventListener): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Get memory usage information
   */
  getMemoryUsage(): {
    usedBytes: number;
    maxBytes: number;
    utilizationPercent: number;
    entryCount: number;
    averageEntrySize: number;
  } {
    const entryCount = this.cache.size;
    const averageEntrySize = entryCount > 0 ? this.stats.totalDataSize / entryCount : 0;

    const maxBytes = this.options.maxSizeBytes || 0;
    return {
      usedBytes: this.stats.totalDataSize,
      maxBytes,
      utilizationPercent: maxBytes > 0 ? (this.stats.totalDataSize / maxBytes) * 100 : 0,
      entryCount,
      averageEntrySize,
    };
  }

  /**
   * Abstract method to calculate data size
   */
  protected abstract calculateDataSize(data: T): number;

  /**
   * Abstract method to calculate checksum for integrity checking
   */
  protected abstract calculateChecksum(data: T): Promise<string>;

  /**
   * Abstract method to validate data integrity
   */
  protected abstract validateIntegrity(entry: CacheEntry<T>): Promise<boolean>;

  /**
   * Check if entry is expired
   */
  protected isExpired(entry: CacheEntry<T>): boolean {
    return new Date() > new Date(entry.expiresAt);
  }

  /**
   * Update access order for LRU tracking
   */
  protected updateAccessOrder(key: string): void {
    this.accessOrder.set(key, ++this.accessCounter);
  }

  /**
   * Ensure cache capacity before adding new entries
   */
  protected async ensureCapacity(): Promise<void> {
    // Check entry count limit
    if (this.cache.size >= (this.options.maxSize ?? 100)) {
      await this.evictLRU(Math.ceil((this.options.maxSize ?? 100) * 0.1)); // Evict 10%
    }

    // Check size limit
    if (this.stats.totalDataSize >= (this.options.maxSizeBytes ?? 50 * 1024 * 1024)) {
      const targetSize = (this.options.maxSizeBytes ?? 50 * 1024 * 1024) * 0.8; // Target 80% usage

      while (this.stats.totalDataSize > targetSize && this.cache.size > 0) {
        await this.evictLRU(1);
      }
    }

    // Cleanup expired entries
    await this.cleanup();
  }

  /**
   * Record cache event
   */
  protected recordCacheEvent(type: CacheEventType, key: string, additionalData?: Partial<CacheEvent['data']>): void {
    if (!this.options.enableEvents) return;

    const event: CacheEvent = {
      type,
      key,
      timestamp: new Date().toISOString(),
      data: {
        hitRatio: this.calculateHitRatio(),
        cacheSize: this.cache.size,
        ...additionalData,
      },
    };

    const listeners = this.eventListeners.get(type);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (error) {
          console.warn(`Cache event listener error for ${type}:`, error);
        }
      }
    }
  }

  /**
   * Create operation result
   */
  protected createOperationResult<R = undefined>(
    success: boolean,
    data: R | undefined,
    error: string | undefined,
    startTime: number,
  ): CacheOperationResult<R> {
    const duration = Date.now() - startTime;

    if (this.options.enableMetrics) {
      this.metrics.averageOperationTime =
        (this.metrics.averageOperationTime * this.metrics.totalOperations + duration) /
        (this.metrics.totalOperations + 1);
      this.metrics.totalOperations++;
    }

    return {
      success,
      data: data ?? undefined,
      error: error ?? undefined,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Calculate current hit ratio
   */
  protected calculateHitRatio(): number {
    const totalRequests = this.stats.hits + this.stats.misses;
    return totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;
  }

  /**
   * Update runtime statistics
   */
  protected updateRuntimeStats(): void {
    this.stats.hitRatio = this.calculateHitRatio();
    this.stats.size = this.cache.size;
    this.stats.memoryUsage = this.getMemoryUsage().usedBytes;
    this.stats.lastUpdated = new Date().toISOString();
  }

  /**
   * Update performance metrics
   */
  protected updateMetrics(): void {
    const uptime = Date.now() - this.startTime;

    this.metrics.uptime = uptime;
    this.metrics.operationsPerSecond = this.metrics.totalOperations / (uptime / 1000);
    this.metrics.hitRatio = this.calculateHitRatio();
    this.metrics.memoryEfficiency = (this.stats.totalDataSize / (this.options.maxSizeBytes ?? 50 * 1024 * 1024)) * 100;
    this.metrics.lastUpdated = new Date().toISOString();
  }

  /**
   * Generate unique entry ID
   */
  protected generateEntryId(): string {
    return `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate URL hash
   */
  protected generateUrlHash(url: string): string {
    // Simple hash function for demo - in production use crypto.subtle.digest
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Categorize data size
   */
  protected categorizeSize(size: number): 'small' | 'medium' | 'large' | 'xlarge' {
    if (size < 1024) return 'small'; // < 1KB
    if (size < 1024 * 1024) return 'medium'; // < 1MB
    if (size < 10 * 1024 * 1024) return 'large'; // < 10MB
    return 'xlarge'; // >= 10MB
  }

  /**
   * Initialize cache statistics
   */
  protected initializeStats(): CacheStats {
    return {
      totalEntries: 0,
      hitRate: 0,
      missRate: 0,
      hits: 0,
      misses: 0,
      totalRequests: 0,
      expiredEntries: 0,
      corruptedEntries: 0,
      writes: 0,
      errors: 0,
      totalSize: 0,
      totalDataSize: 0,
      evictions: 0,
      maxSize: this.options.maxSizeBytes || 0,
      hitRatio: 0,
      size: 0,
      memoryUsage: 0,
      lastUpdated: new Date().toISOString(),
      usagePercentage: 0,
      tierDistribution: {
        memory: 0,
        disk: 0,
        compressed: 0,
        archived: 0,
      },
      statusDistribution: {
        active: 0,
        stale: 0,
        expired: 0,
        corrupted: 0,
        locked: 0,
        archived: 0,
      },
      performance: {
        averageLookupTime: 0,
        averageWriteTime: 0,
        averageEvictionTime: 0,
        throughput: 0,
        memoryUsage: {
          current: 0,
          peak: 0,
          average: 0,
        },
        diskIO: {
          bytesRead: 0,
          bytesWritten: 0,
          averageReadTime: 0,
          averageWriteTime: 0,
        },
      },
      eviction: {
        totalEvictions: 0,
        evictionsByPolicy: {
          lru: 0,
          lfu: 0,
          fifo: 0,
          lifo: 0,
          random: 0,
          ttl: 0,
        },
        evictionsByReason: {
          sizeLimitReached: 0,
          ttlExpired: 0,
          corruption: 0,
          manualCleanup: 0,
        },
        averageEvictionInterval: 0,
        spaceReclaimed: 0,
        evictionEfficiency: 0,
      },
      integrity: {
        totalChecks: 0,
        violationsFound: 0,
        violationRate: 0,
        corruptionTypes: {},
        recoverySuccessRate: 0,
        averageCheckTime: 0,
      },
      optimization: {
        overallCompressionRatio: 0,
        compressionSavings: 0,
        deduplicationSavings: 0,
        storageEfficiency: 0,
        recommendations: [],
      },
    };
  }

  /**
   * Initialize performance metrics
   */
  protected initializeMetrics(): CacheMetrics {
    return {
      operations: 0,
      totalOperations: 0,
      averageTime: 0,
      averageOperationTime: 0,
      hitRate: 0,
      hitRatio: 0,
      memoryUsage: 0,
      memoryEfficiency: 0,
      uptime: 0,
      operationsPerSecond: 0,
      lastUpdated: new Date().toISOString(),
    };
  }
}
