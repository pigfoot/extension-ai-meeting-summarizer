/**
 * Cache management utilities for the Meeting Summarizer Chrome Extension
 * Provides LRU cache implementation, cleanup functions, and performance optimization
 * for transcription results and meeting data caching.
 */

import type { BaseStorageType } from '../base/types.js';
// Use specific interface instead of generic type
interface CachedTranscription {
  transcriptionId: string;
  transcriptionText: string;
  meetingId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  confidence?: number;
  language?: string;
  speakers?: Array<{
    id: string;
    name?: string;
    segments: Array<{
      text: string;
      start: number;
      end: number;
      confidence: number;
    }>;
  }>;
  segments?: Array<{
    text: string;
    start: number;
    end: number;
    speaker?: string;
    confidence: number;
  }>;
  createdAt: string;
  updatedAt: string;
  audioUrl?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Cache entry metadata for LRU management
 */
export interface CacheEntryMetadata {
  /** Cache entry key */
  key: string;
  /** Size of cached data in bytes */
  size: number;
  /** Number of times accessed */
  accessCount: number;
  /** Last access timestamp */
  lastAccessed: string;
  /** Creation timestamp */
  createdAt: string;
  /** Expiry timestamp */
  expiresAt: string;
  /** Priority level for cache eviction */
  priority: CachePriority;
  /** Tags for categorization */
  tags: string[];
}

/**
 * Cache priority levels for eviction strategy
 */
export type CachePriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Cache statistics
 */
export interface CacheStatistics {
  /** Total cache entries */
  totalEntries: number;
  /** Total cache size in bytes */
  totalSize: number;
  /** Cache hit rate percentage */
  hitRate: number;
  /** Cache miss rate percentage */
  missRate: number;
  /** Total cache hits */
  totalHits: number;
  /** Total cache misses */
  totalMisses: number;
  /** Average entry size in bytes */
  averageEntrySize: number;
  /** Cache efficiency score (0-1) */
  efficiencyScore: number;
  /** Memory pressure level */
  memoryPressure: 'low' | 'medium' | 'high' | 'critical';
  /** Last cleanup timestamp */
  lastCleanup: string;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /** Maximum cache size in bytes */
  maxSize: number;
  /** Maximum number of entries */
  maxEntries: number;
  /** Default TTL in milliseconds */
  defaultTTL: number;
  /** Cleanup interval in milliseconds */
  cleanupInterval: number;
  /** Enable LRU eviction */
  enableLRU: boolean;
  /** Enable compression */
  enableCompression: boolean;
  /** Compression threshold in bytes */
  compressionThreshold: number;
  /** Memory pressure threshold (0-1) */
  memoryPressureThreshold: number;
}

/**
 * Cache operation result
 */
export interface CacheOperationResult<T = unknown> {
  /** Whether operation was successful */
  success: boolean;
  /** Result data if successful */
  data?: T;
  /** Error message if failed */
  error?: string;
  /** Cache hit/miss status */
  cacheStatus: 'hit' | 'miss' | 'error';
  /** Operation timestamp */
  timestamp: string;
  /** Execution time in milliseconds */
  executionTime: number;
}

/**
 * LRU Cache implementation for transcription results
 */
export class TranscriptionLRUCache {
  private cache: Map<string, CachedTranscription> = new Map();
  private metadata: Map<string, CacheEntryMetadata> = new Map();
  private config: CacheConfig;
  private statistics: CacheStatistics;
  private cleanupTimer: NodeJS.Timeout | undefined;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 50 * 1024 * 1024, // 50MB
      maxEntries: 1000,
      defaultTTL: 24 * 60 * 60 * 1000, // 24 hours
      cleanupInterval: 60 * 60 * 1000, // 1 hour
      enableLRU: true,
      enableCompression: true,
      compressionThreshold: 1024, // 1KB
      memoryPressureThreshold: 0.8,
      ...config,
    };

    this.statistics = {
      totalEntries: 0,
      totalSize: 0,
      hitRate: 0,
      missRate: 0,
      totalHits: 0,
      totalMisses: 0,
      averageEntrySize: 0,
      efficiencyScore: 1,
      memoryPressure: 'low',
      lastCleanup: new Date().toISOString(),
    };

    // Start periodic cleanup
    this.startPeriodicCleanup();
  }

  /**
   * Get cached transcription
   */
  async get(key: string): Promise<CacheOperationResult<CachedTranscription>> {
    const startTime = performance.now();

    try {
      const entry = this.cache.get(key);
      const metadata = this.metadata.get(key);

      if (!entry || !metadata) {
        this.statistics.totalMisses++;
        this.updateStatistics();

        return {
          success: false,
          cacheStatus: 'miss',
          timestamp: new Date().toISOString(),
          executionTime: performance.now() - startTime,
        };
      }

      // Check if entry has expired
      if (new Date(metadata.expiresAt) < new Date()) {
        this.delete(key);
        this.statistics.totalMisses++;
        this.updateStatistics();

        return {
          success: false,
          cacheStatus: 'miss',
          timestamp: new Date().toISOString(),
          executionTime: performance.now() - startTime,
        };
      }

      // Update access metadata for LRU
      metadata.accessCount++;
      metadata.lastAccessed = new Date().toISOString();
      this.metadata.set(key, metadata);

      // Move to end (most recently used) if LRU is enabled
      if (this.config.enableLRU) {
        this.cache.delete(key);
        this.cache.set(key, entry);
      }

      this.statistics.totalHits++;
      this.updateStatistics();

      return {
        success: true,
        data: entry,
        cacheStatus: 'hit',
        timestamp: new Date().toISOString(),
        executionTime: performance.now() - startTime,
      };
    } catch (error) {
      this.statistics.totalMisses++;
      this.updateStatistics();

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown cache error',
        cacheStatus: 'error',
        timestamp: new Date().toISOString(),
        executionTime: performance.now() - startTime,
      };
    }
  }

  /**
   * Set cached transcription
   */
  async set(
    key: string,
    value: CachedTranscription,
    options: {
      ttl?: number;
      priority?: CachePriority;
      tags?: string[];
    } = {},
  ): Promise<CacheOperationResult<void>> {
    const startTime = performance.now();

    try {
      const ttl = options.ttl || this.config.defaultTTL;
      const expiresAt = new Date(Date.now() + ttl).toISOString();

      // Calculate entry size
      const entrySize = this.calculateEntrySize(value);

      // Check if we need to make space
      await this.ensureSpace(entrySize);

      // Create metadata
      const metadata: CacheEntryMetadata = {
        key,
        size: entrySize,
        accessCount: 1,
        lastAccessed: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        expiresAt,
        priority: options.priority || 'medium',
        tags: options.tags || [],
      };

      // Store entry and metadata
      this.cache.set(key, value);
      this.metadata.set(key, metadata);

      // Update statistics
      this.statistics.totalEntries = this.cache.size;
      this.statistics.totalSize += entrySize;
      this.updateStatistics();

      return {
        success: true,
        cacheStatus: 'hit',
        timestamp: new Date().toISOString(),
        executionTime: performance.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown cache error',
        cacheStatus: 'error',
        timestamp: new Date().toISOString(),
        executionTime: performance.now() - startTime,
      };
    }
  }

  /**
   * Delete cached entry
   */
  delete(key: string): boolean {
    const metadata = this.metadata.get(key);
    const deleted = this.cache.delete(key);

    if (deleted && metadata) {
      this.metadata.delete(key);
      this.statistics.totalEntries = this.cache.size;
      this.statistics.totalSize -= metadata.size;
      this.updateStatistics();
    }

    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.metadata.clear();
    this.statistics.totalEntries = 0;
    this.statistics.totalSize = 0;
    this.updateStatistics();
  }

  /**
   * Get cache statistics
   */
  getStatistics(): CacheStatistics {
    return { ...this.statistics };
  }

  /**
   * Get all cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Get cache size in bytes
   */
  size(): number {
    return this.statistics.totalSize;
  }

  /**
   * Get number of entries
   */
  count(): number {
    return this.cache.size;
  }

  /**
   * Manually trigger cleanup
   */
  async cleanup(): Promise<number> {
    let removedCount = 0;
    const now = new Date();

    // Remove expired entries
    for (const [key, metadata] of this.metadata.entries()) {
      if (new Date(metadata.expiresAt) < now) {
        this.delete(key);
        removedCount++;
      }
    }

    // Check memory pressure and evict if necessary
    if (this.getMemoryPressure() > this.config.memoryPressureThreshold) {
      removedCount += await this.evictLRU();
    }

    this.statistics.lastCleanup = new Date().toISOString();
    return removedCount;
  }

  /**
   * Get entries by tags
   */
  getByTags(tags: string[]): Array<{ key: string; value: CachedTranscription }> {
    const results: Array<{ key: string; value: CachedTranscription }> = [];

    for (const [key, metadata] of this.metadata.entries()) {
      if (tags.some(tag => metadata.tags.includes(tag))) {
        const value = this.cache.get(key);
        if (value) {
          results.push({ key, value });
        }
      }
    }

    return results;
  }

  /**
   * Calculate entry size in bytes
   */
  private calculateEntrySize(entry: CachedTranscription): number {
    try {
      const serialized = JSON.stringify(entry);
      return new Blob([serialized]).size;
    } catch {
      // Fallback estimation
      return entry.transcriptionText.length * 2 + 1000; // Approximate
    }
  }

  /**
   * Ensure there's space for new entry
   */
  private async ensureSpace(requiredSize: number): Promise<void> {
    // Check if we exceed max entries
    if (this.cache.size >= this.config.maxEntries) {
      await this.evictLRU(1);
    }

    // Check if we exceed max size
    while (this.statistics.totalSize + requiredSize > this.config.maxSize) {
      const evicted = await this.evictLRU(1);
      if (evicted === 0) break; // Can't evict more
    }
  }

  /**
   * Evict least recently used entries
   */
  private async evictLRU(count?: number): Promise<number> {
    if (!this.config.enableLRU) return 0;

    // Sort entries by last accessed time and priority
    const sortedEntries = Array.from(this.metadata.entries()).sort((a, b) => {
      const priorityWeight = {
        critical: 4,
        high: 3,
        medium: 2,
        low: 1,
      };

      // First sort by priority (lower priority gets evicted first)
      const priorityDiff = priorityWeight[a[1].priority] - priorityWeight[b[1].priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Then by last accessed time (older gets evicted first)
      return new Date(a[1].lastAccessed).getTime() - new Date(b[1].lastAccessed).getTime();
    });

    const evictCount = count || Math.max(1, Math.floor(this.cache.size * 0.1)); // Evict 10% by default
    let evicted = 0;

    for (let i = 0; i < Math.min(evictCount, sortedEntries.length); i++) {
      const entry = sortedEntries[i];
      if (entry) {
        const [key] = entry;
        if (this.delete(key)) {
          evicted++;
        }
      }
    }

    return evicted;
  }

  /**
   * Calculate memory pressure (0-1)
   */
  private getMemoryPressure(): number {
    const sizeRatio = this.statistics.totalSize / this.config.maxSize;
    const countRatio = this.cache.size / this.config.maxEntries;
    return Math.max(sizeRatio, countRatio);
  }

  /**
   * Update cache statistics
   */
  private updateStatistics(): void {
    const totalRequests = this.statistics.totalHits + this.statistics.totalMisses;

    this.statistics.hitRate = totalRequests > 0 ? (this.statistics.totalHits / totalRequests) * 100 : 0;
    this.statistics.missRate = 100 - this.statistics.hitRate;
    this.statistics.averageEntrySize = this.cache.size > 0 ? this.statistics.totalSize / this.cache.size : 0;
    this.statistics.efficiencyScore = this.calculateEfficiencyScore();
    this.statistics.memoryPressure = this.getMemoryPressureLevel();
  }

  /**
   * Calculate cache efficiency score
   */
  private calculateEfficiencyScore(): number {
    const hitRateScore = this.statistics.hitRate / 100;
    const memoryEfficiency = 1 - this.getMemoryPressure();
    const accessPattern = this.calculateAccessPatternScore();

    return hitRateScore * 0.5 + memoryEfficiency * 0.3 + accessPattern * 0.2;
  }

  /**
   * Calculate access pattern score
   */
  private calculateAccessPatternScore(): number {
    if (this.metadata.size === 0) return 1;

    const entries = Array.from(this.metadata.values());
    const totalAccess = entries.reduce((sum, meta) => sum + meta.accessCount, 0);
    const avgAccess = totalAccess / entries.length;

    // Higher score for more evenly distributed access patterns
    const variance = entries.reduce((sum, meta) => sum + Math.pow(meta.accessCount - avgAccess, 2), 0) / entries.length;
    const coefficient = Math.sqrt(variance) / avgAccess;

    return Math.max(0, 1 - coefficient / 2);
  }

  /**
   * Get memory pressure level
   */
  private getMemoryPressureLevel(): 'low' | 'medium' | 'high' | 'critical' {
    const pressure = this.getMemoryPressure();

    if (pressure < 0.5) return 'low';
    if (pressure < 0.7) return 'medium';
    if (pressure < 0.9) return 'high';
    return 'critical';
  }

  /**
   * Start periodic cleanup
   */
  private startPeriodicCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch(error => {
        console.error('Cache cleanup failed:', error);
      });
    }, this.config.cleanupInterval);
  }

  /**
   * Stop periodic cleanup
   */
  stopPeriodicCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * Dispose of cache resources
   */
  dispose(): void {
    this.stopPeriodicCleanup();
    this.clear();
  }
}

/**
 * Cache utilities for storage integration
 */
export const cacheUtils = {
  /**
   * Create transcription cache instance
   */
  createTranscriptionCache(config?: Partial<CacheConfig>): TranscriptionLRUCache {
    return new TranscriptionLRUCache(config);
  },

  /**
   * Sync cache with storage
   */
  async syncCacheWithStorage(
    cache: TranscriptionLRUCache,
    storage: BaseStorageType<Record<string, CachedTranscription>>,
  ): Promise<void> {
    try {
      const storageData = await storage.get();

      // Clear current cache
      cache.clear();

      // Load data from storage into cache
      for (const [key, value] of Object.entries(storageData)) {
        await cache.set(key, value);
      }
    } catch (error) {
      console.error('Failed to sync cache with storage:', error);
    }
  },

  /**
   * Persist cache to storage
   */
  async persistCacheToStorage(
    cache: TranscriptionLRUCache,
    storage: BaseStorageType<Record<string, CachedTranscription>>,
  ): Promise<void> {
    try {
      const cacheData: Record<string, CachedTranscription> = {};

      for (const key of cache.keys()) {
        const result = await cache.get(key);
        if (result.success && result.data) {
          cacheData[key] = result.data;
        }
      }

      await storage.set(cacheData);
    } catch (error) {
      console.error('Failed to persist cache to storage:', error);
    }
  },

  /**
   * Generate cache key for meeting transcription
   */
  generateTranscriptionCacheKey(
    meetingId: string,
    options?: {
      language?: string;
      quality?: string;
      speakerDiarization?: boolean;
    },
  ): string {
    const parts = [meetingId];

    if (options?.language) {
      parts.push(`lang-${options.language}`);
    }

    if (options?.quality) {
      parts.push(`quality-${options.quality}`);
    }

    if (options?.speakerDiarization) {
      parts.push('diarization');
    }

    return parts.join('_');
  },

  /**
   * Calculate optimal cache configuration based on available storage
   */
  calculateOptimalCacheConfig(availableStorageMB: number): CacheConfig {
    const maxSizeMB = Math.min(availableStorageMB * 0.3, 100); // Use up to 30% of available storage, max 100MB

    return {
      maxSize: maxSizeMB * 1024 * 1024, // Convert to bytes
      maxEntries: Math.max(100, Math.floor(maxSizeMB * 10)), // Approximately 10 entries per MB
      defaultTTL: 24 * 60 * 60 * 1000, // 24 hours
      cleanupInterval: 60 * 60 * 1000, // 1 hour
      enableLRU: true,
      enableCompression: maxSizeMB > 50, // Enable compression for larger caches
      compressionThreshold: 1024,
      memoryPressureThreshold: 0.8,
    };
  },

  /**
   * Get cache performance recommendations
   */
  getCachePerformanceRecommendations(statistics: CacheStatistics): string[] {
    const recommendations: string[] = [];

    if (statistics.hitRate < 70) {
      recommendations.push('Consider increasing cache size or TTL to improve hit rate');
    }

    if (statistics.memoryPressure === 'high' || statistics.memoryPressure === 'critical') {
      recommendations.push('Cache is under memory pressure, consider cleanup or size reduction');
    }

    if (statistics.efficiencyScore < 0.7) {
      recommendations.push('Cache efficiency is low, review access patterns and eviction strategy');
    }

    if (statistics.averageEntrySize > 1024 * 1024) {
      // 1MB
      recommendations.push('Large average entry size detected, consider compression');
    }

    const daysSinceCleanup = (Date.now() - new Date(statistics.lastCleanup).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCleanup > 1) {
      recommendations.push('Consider running cache cleanup more frequently');
    }

    return recommendations;
  },
};
