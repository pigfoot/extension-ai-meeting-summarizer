/**
 * Cache eviction manager with LRU policies and intelligent cleanup
 * Implements size management and access pattern-based optimization
 */

import type { CacheEntry, EvictionPolicy, EvictionStrategy, EvictionResult, EvictionMetrics } from '../types/cache';

/**
 * Eviction configuration options
 */
export interface EvictionConfig {
  /** Primary eviction policy */
  policy: EvictionPolicy;
  /** Backup eviction strategies */
  strategies: EvictionStrategy[];
  /** Memory pressure thresholds */
  memoryThresholds: {
    /** Warning threshold (percentage) */
    warning: number;
    /** Critical threshold (percentage) */
    critical: number;
    /** Emergency threshold (percentage) */
    emergency: number;
  };
  /** Size-based eviction settings */
  sizeSettings: {
    /** Maximum cache entries */
    maxEntries: number;
    /** Maximum memory usage in bytes */
    maxMemoryBytes: number;
    /** Target utilization after cleanup */
    targetUtilization: number;
  };
  /** Time-based eviction settings */
  timeSettings: {
    /** Maximum age for entries (ms) */
    maxAge: number;
    /** Idle time before eviction (ms) */
    maxIdleTime: number;
    /** Cleanup interval (ms) */
    cleanupInterval: number;
  };
  /** Performance settings */
  performance: {
    /** Maximum entries to evict per operation */
    maxEvictionsPerRun: number;
    /** Enable background cleanup */
    enableBackgroundCleanup: boolean;
    /** Enable predictive eviction */
    enablePredictiveEviction: boolean;
  };
}

/**
 * Eviction candidate information
 */
export interface EvictionCandidate<T = unknown> {
  /** Cache entry key */
  key: string;
  /** Cache entry data */
  entry: CacheEntry<T>;
  /** Eviction score (higher = more likely to evict) */
  score: number;
  /** Reasons for eviction consideration */
  reasons: string[];
  /** Estimated memory savings */
  memorySavings: number;
}

/**
 * Eviction operation result
 */
export interface EvictionOperationResult {
  /** Whether operation was successful */
  success: boolean;
  /** Number of entries evicted */
  evictedCount: number;
  /** Memory freed in bytes */
  memoryFreed: number;
  /** Eviction duration in milliseconds */
  duration: number;
  /** Evicted entry keys */
  evictedKeys: string[];
  /** Eviction strategy used */
  strategyUsed: EvictionStrategy;
  /** Error message if operation failed */
  error?: string;
}

/**
 * Access pattern analysis
 */
export interface AccessPatternAnalysis {
  /** Frequency-based scores */
  frequency: Map<string, number>;
  /** Recency-based scores */
  recency: Map<string, number>;
  /** Size impact scores */
  sizeImpact: Map<string, number>;
  /** Predicted access probability */
  accessProbability: Map<string, number>;
  /** Analysis timestamp */
  analyzedAt: string;
}

/**
 * Intelligent cache eviction manager
 */
export class CacheEvictionManager<T = unknown> {
  private config: EvictionConfig;
  private metrics: EvictionMetrics;
  private accessPatterns = new Map<string, Array<{ timestamp: number; type: 'read' | 'write' }>>();
  private cleanupTimer: NodeJS.Timeout | null = null;
  private evictionHistory: Array<{ timestamp: string; count: number; strategy: EvictionStrategy }> = [];

  constructor(config: Partial<EvictionConfig> = {}) {
    this.config = {
      policy: config.policy || 'lru',
      strategies: config.strategies || (['lru', 'size', 'smart'] as EvictionStrategy[]),
      memoryThresholds: {
        warning: 70,
        critical: 85,
        emergency: 95,
        ...config.memoryThresholds,
      },
      sizeSettings: {
        maxEntries: 1000,
        maxMemoryBytes: 100 * 1024 * 1024, // 100MB
        targetUtilization: 0.8,
        ...config.sizeSettings,
      },
      timeSettings: {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        maxIdleTime: 2 * 60 * 60 * 1000, // 2 hours
        cleanupInterval: 5 * 60 * 1000, // 5 minutes
        ...config.timeSettings,
      },
      performance: {
        maxEvictionsPerRun: 50,
        enableBackgroundCleanup: true,
        enablePredictiveEviction: true,
        ...config.performance,
      },
    };

    this.metrics = this.initializeMetrics();

    if (this.config.performance.enableBackgroundCleanup) {
      this.startBackgroundCleanup();
    }
  }

  /**
   * Evaluate eviction candidates based on current cache state
   */
  evaluateEvictionCandidates(cache: Map<string, CacheEntry<T>>, currentMemoryUsage: number): EvictionCandidate<T>[] {
    const candidates: EvictionCandidate<T>[] = [];
    const memoryPressure = this.calculateMemoryPressure(currentMemoryUsage);

    for (const [key, entry] of cache.entries()) {
      const score = this.calculateEvictionScore(key, entry, memoryPressure);
      const reasons = this.getEvictionReasons(key, entry, memoryPressure);

      if (score > 0) {
        candidates.push({
          key,
          entry,
          score,
          reasons,
          memorySavings: entry.size,
        });
      }
    }

    // Sort by score (highest first)
    return candidates.sort((a, b) => b.score - a.score);
  }

  /**
   * Execute eviction operation
   */
  async executeEviction(
    cache: Map<string, CacheEntry<T>>,
    accessOrder: Map<string, number>,
    targetMemoryReduction: number,
  ): Promise<EvictionOperationResult> {
    const startTime = Date.now();

    try {
      const currentMemoryUsage = this.calculateTotalMemoryUsage(cache);
      const candidates = this.evaluateEvictionCandidates(cache, currentMemoryUsage);

      if (candidates.length === 0) {
        return {
          success: true,
          evictedCount: 0,
          memoryFreed: 0,
          duration: Date.now() - startTime,
          evictedKeys: [],
          strategyUsed: this.config.policy,
        };
      }

      // Select strategy based on current conditions
      const strategy = this.selectEvictionStrategy(currentMemoryUsage, candidates);

      // Execute eviction using selected strategy
      const result = await this.executeStrategy(strategy, cache, accessOrder, candidates, targetMemoryReduction);

      // Update metrics
      this.updateEvictionMetrics(result);

      // Record in history
      this.evictionHistory.push({
        timestamp: new Date().toISOString(),
        count: result.evictedCount,
        strategy: result.strategyUsed,
      });

      // Limit history size
      if (this.evictionHistory.length > 1000) {
        this.evictionHistory = this.evictionHistory.slice(-500);
      }

      return result;
    } catch (error) {
      return {
        success: false,
        evictedCount: 0,
        memoryFreed: 0,
        duration: Date.now() - startTime,
        evictedKeys: [],
        strategyUsed: this.config.policy,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Record access pattern for intelligent eviction
   */
  recordAccess(key: string, accessType: 'read' | 'write'): void {
    if (!this.accessPatterns.has(key)) {
      this.accessPatterns.set(key, []);
    }

    const patterns = this.accessPatterns.get(key)!;
    patterns.push({
      timestamp: Date.now(),
      type: accessType,
    });

    // Limit pattern history per key
    if (patterns.length > 100) {
      patterns.splice(0, patterns.length - 50);
    }

    // Clean up old patterns
    this.cleanupOldPatterns();
  }

  /**
   * Analyze access patterns for predictive eviction
   */
  analyzeAccessPatterns(): AccessPatternAnalysis {
    const frequency = new Map<string, number>();
    const recency = new Map<string, number>();
    const sizeImpact = new Map<string, number>();
    const accessProbability = new Map<string, number>();

    const now = Date.now();
    const recentWindow = 60 * 60 * 1000; // 1 hour

    for (const [key, patterns] of this.accessPatterns.entries()) {
      // Calculate frequency score
      const recentAccesses = patterns.filter(p => now - p.timestamp <= recentWindow);
      frequency.set(key, recentAccesses.length);

      // Calculate recency score
      const lastAccess = Math.max(...patterns.map(p => p.timestamp));
      const recencyScore = Math.max(0, 1 - (now - lastAccess) / recentWindow);
      recency.set(key, recencyScore);

      // Estimate access probability using frequency and recency
      const freq = recentAccesses.length;
      const rec = recencyScore;
      const probability = (freq * 0.7 + rec * 0.3) / (freq + rec + 1);
      accessProbability.set(key, probability);
    }

    return {
      frequency,
      recency,
      sizeImpact,
      accessProbability,
      analyzedAt: new Date().toISOString(),
    };
  }

  /**
   * Get eviction metrics
   */
  getMetrics(): EvictionMetrics {
    this.updateMetricsCalculations();
    return { ...this.metrics };
  }

  /**
   * Update eviction configuration
   */
  updateConfig(config: Partial<EvictionConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart background cleanup if settings changed
    if (this.config.performance.enableBackgroundCleanup && !this.cleanupTimer) {
      this.startBackgroundCleanup();
    } else if (!this.config.performance.enableBackgroundCleanup && this.cleanupTimer) {
      this.stopBackgroundCleanup();
    }
  }

  /**
   * Force cleanup of expired and idle entries
   */
  async forceCleanup(
    cache: Map<string, CacheEntry<T>>,
    accessOrder: Map<string, number>,
  ): Promise<EvictionOperationResult> {
    const startTime = Date.now();
    const evictedKeys: string[] = [];
    let memoryFreed = 0;

    const now = Date.now();

    for (const [key, entry] of cache.entries()) {
      let shouldEvict = false;
      const reasons: string[] = [];

      // Check expiration
      if (new Date() > new Date(entry.expiresAt)) {
        shouldEvict = true;
        reasons.push('expired');
      }

      // Check maximum age
      const age = now - new Date(entry.metadata.createdAt).getTime();
      if (age > this.config.timeSettings.maxAge) {
        shouldEvict = true;
        reasons.push('max_age_exceeded');
      }

      // Check idle time
      const idleTime = now - new Date(entry.lastAccessTime).getTime();
      if (idleTime > this.config.timeSettings.maxIdleTime) {
        shouldEvict = true;
        reasons.push('idle_timeout');
      }

      if (shouldEvict) {
        memoryFreed += entry.size;
        evictedKeys.push(key);
        cache.delete(key);
        accessOrder.delete(key);
        this.accessPatterns.delete(key);
      }
    }

    const result: EvictionOperationResult = {
      success: true,
      evictedCount: evictedKeys.length,
      memoryFreed,
      duration: Date.now() - startTime,
      evictedKeys,
      strategyUsed: 'smart',
    };

    this.updateEvictionMetrics(result);

    return result;
  }

  /**
   * Shutdown eviction manager
   */
  shutdown(): void {
    this.stopBackgroundCleanup();
    this.accessPatterns.clear();
    this.evictionHistory = [];
  }

  /**
   * Calculate eviction score for an entry
   */
  private calculateEvictionScore(key: string, entry: CacheEntry<T>, memoryPressure: number): number {
    let score = 0;

    // Age factor (older entries score higher)
    const age = Date.now() - new Date(entry.metadata.createdAt).getTime();
    const ageScore = Math.min(1, age / this.config.timeSettings.maxAge);
    score += ageScore * 0.3;

    // Idle time factor
    const idleTime = Date.now() - new Date(entry.lastAccessTime).getTime();
    const idleScore = Math.min(1, idleTime / this.config.timeSettings.maxIdleTime);
    score += idleScore * 0.3;

    // Access frequency factor (less frequent = higher score)
    const patterns = this.accessPatterns.get(key) || [];
    const recentAccesses = patterns.filter(p => Date.now() - p.timestamp <= 60 * 60 * 1000).length;
    const frequencyScore = Math.max(0, 1 - recentAccesses / 10);
    score += frequencyScore * 0.2;

    // Size factor (larger entries score higher under memory pressure)
    if (memoryPressure > this.config.memoryThresholds.warning) {
      const sizeScore = entry.size / (1024 * 1024); // MB
      score += Math.min(1, sizeScore / 10) * 0.2;
    }

    // Access count factor (less accessed = higher score)
    const accessScore = Math.max(0, 1 - entry.accessCount / 100);
    score += accessScore * 0.1;

    return Math.min(1, score);
  }

  /**
   * Get eviction reasons for an entry
   */
  private getEvictionReasons(key: string, entry: CacheEntry<T>, memoryPressure: number): string[] {
    const reasons: string[] = [];
    const now = Date.now();

    // Check expiration
    if (new Date() > new Date(entry.expiresAt)) {
      reasons.push('expired');
    }

    // Check age
    const age = now - new Date(entry.metadata.createdAt).getTime();
    if (age > this.config.timeSettings.maxAge) {
      reasons.push('max_age_exceeded');
    }

    // Check idle time
    const idleTime = now - new Date(entry.lastAccessTime).getTime();
    if (idleTime > this.config.timeSettings.maxIdleTime) {
      reasons.push('idle_timeout');
    }

    // Check memory pressure
    if (memoryPressure > this.config.memoryThresholds.critical) {
      reasons.push('memory_pressure');
    }

    // Check low access frequency
    const patterns = this.accessPatterns.get(key) || [];
    const recentAccesses = patterns.filter(p => now - p.timestamp <= 60 * 60 * 1000).length;
    if (recentAccesses === 0) {
      reasons.push('no_recent_access');
    }

    // Check large size
    if (entry.size > 1024 * 1024) {
      // > 1MB
      reasons.push('large_size');
    }

    return reasons;
  }

  /**
   * Calculate memory pressure percentage
   */
  private calculateMemoryPressure(currentMemoryUsage: number): number {
    return (currentMemoryUsage / this.config.sizeSettings.maxMemoryBytes) * 100;
  }

  /**
   * Calculate total memory usage
   */
  private calculateTotalMemoryUsage(cache: Map<string, CacheEntry<T>>): number {
    let total = 0;
    for (const entry of cache.values()) {
      total += entry.size;
    }
    return total;
  }

  /**
   * Select appropriate eviction strategy
   */
  private selectEvictionStrategy(currentMemoryUsage: number, candidates: EvictionCandidate<T>[]): EvictionStrategy {
    const memoryPressure = this.calculateMemoryPressure(currentMemoryUsage);

    if (memoryPressure > this.config.memoryThresholds.emergency) {
      return 'size'; // Aggressive size-based eviction
    } else if (memoryPressure > this.config.memoryThresholds.critical) {
      return 'lru'; // Standard LRU eviction
    } else if (candidates.some(c => c.reasons.includes('expired'))) {
      return 'ttl'; // Clean up expired entries first
    } else {
      return this.config.policy; // Use configured policy
    }
  }

  /**
   * Execute specific eviction strategy
   */
  private async executeStrategy(
    strategy: EvictionStrategy,
    cache: Map<string, CacheEntry<T>>,
    accessOrder: Map<string, number>,
    candidates: EvictionCandidate<T>[],
    targetMemoryReduction: number,
  ): Promise<EvictionOperationResult> {
    const startTime = Date.now();
    const evictedKeys: string[] = [];
    let memoryFreed = 0;
    let candidatesToEvict: EvictionCandidate<T>[] = [];

    switch (strategy) {
      case 'lru':
        // Sort by access order (oldest first)
        candidatesToEvict = candidates.sort((a, b) => (accessOrder.get(a.key) || 0) - (accessOrder.get(b.key) || 0));
        break;

      case 'size':
        // Sort by size (largest first)
        candidatesToEvict = candidates.sort((a, b) => b.entry.size - a.entry.size);
        break;

      case 'ttl':
        // Sort by age (oldest first)
        candidatesToEvict = candidates.sort(
          (a, b) => new Date(a.entry.metadata.createdAt).getTime() - new Date(b.entry.metadata.createdAt).getTime(),
        );
        break;

      case 'smart':
        // Use score-based sorting (already sorted by score)
        candidatesToEvict = candidates;
        break;

      default:
        candidatesToEvict = candidates;
    }

    // Evict entries until target is reached or max evictions hit
    let evictedCount = 0;
    for (const candidate of candidatesToEvict) {
      if (memoryFreed >= targetMemoryReduction || evictedCount >= this.config.performance.maxEvictionsPerRun) {
        break;
      }

      cache.delete(candidate.key);
      accessOrder.delete(candidate.key);
      this.accessPatterns.delete(candidate.key);

      evictedKeys.push(candidate.key);
      memoryFreed += candidate.memorySavings;
      evictedCount++;
    }

    return {
      success: true,
      evictedCount,
      memoryFreed,
      duration: Date.now() - startTime,
      evictedKeys,
      strategyUsed: strategy,
    };
  }

  /**
   * Update eviction metrics
   */
  private updateEvictionMetrics(result: EvictionOperationResult): void {
    this.metrics.totalEvictions += result.evictedCount;
    this.metrics.totalBytesFreed += result.memoryFreed;
    this.metrics.totalMemoryFreed += result.memoryFreed;
    this.metrics.totalEntriesRemoved += result.evictedCount;

    // Update average eviction time
    const totalOperations = this.metrics.totalEvictions;
    this.metrics.averageEvictionTime =
      (this.metrics.averageEvictionTime * (totalOperations - result.evictedCount) + result.duration) / totalOperations;

    // Update success rate
    this.metrics.successRate = result.success ? 1.0 : 0.9; // Simple success tracking

    // Update strategy statistics
    if (!this.metrics.evictionsByStrategy[result.strategyUsed]) {
      this.metrics.evictionsByStrategy[result.strategyUsed] = 0;
    }
    this.metrics.evictionsByStrategy[result.strategyUsed]++;

    this.metrics.lastEviction = new Date().toISOString();
  }

  /**
   * Update metrics calculations
   */
  private updateMetricsCalculations(): void {
    // Calculate eviction rate (evictions per hour)
    const historyWindow = 60 * 60 * 1000; // 1 hour
    const now = Date.now();
    const recentEvictions = this.evictionHistory.filter(e => now - new Date(e.timestamp).getTime() <= historyWindow);
    this.metrics.evictionRate = recentEvictions.reduce((sum, e) => sum + e.count, 0);

    // Calculate efficiency (memory freed per eviction)
    this.metrics.efficiency =
      this.metrics.totalEvictions > 0 ? this.metrics.totalMemoryFreed / this.metrics.totalEvictions : 0;

    this.metrics.lastUpdated = new Date().toISOString();
  }

  /**
   * Start background cleanup timer
   */
  private startBackgroundCleanup(): void {
    if (this.cleanupTimer) return;

    this.cleanupTimer = setInterval(() => {
      this.cleanupOldPatterns();
    }, this.config.timeSettings.cleanupInterval);
  }

  /**
   * Stop background cleanup timer
   */
  private stopBackgroundCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Clean up old access patterns
   */
  private cleanupOldPatterns(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [key, patterns] of this.accessPatterns.entries()) {
      const filteredPatterns = patterns.filter(p => now - p.timestamp <= maxAge);

      if (filteredPatterns.length === 0) {
        this.accessPatterns.delete(key);
      } else if (filteredPatterns.length !== patterns.length) {
        this.accessPatterns.set(key, filteredPatterns);
      }
    }
  }

  /**
   * Initialize eviction metrics
   */
  private initializeMetrics(): EvictionMetrics {
    return {
      totalEvictions: 0,
      totalBytesFreed: 0,
      totalMemoryFreed: 0,
      totalEntriesRemoved: 0,
      averageEvictionTime: 0,
      successRate: 1.0,
      evictionRate: 0,
      evictionsByStrategy: {
        lru: 0,
        lfu: 0,
        fifo: 0,
        lifo: 0,
        random: 0,
        ttl: 0,
        size: 0,
        smart: 0,
      },
      efficiency: 0,
      lastEviction: undefined as string | undefined,
      lastUpdated: new Date().toISOString(),
    };
  }
}
