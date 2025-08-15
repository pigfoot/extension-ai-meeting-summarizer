/**
 * Storage performance monitor with operation timing and optimization
 * Implements memory usage monitoring and quota tracking for storage optimization
 */

/**
 * Performance metric types
 */
export type PerformanceMetricType = 'read' | 'write' | 'delete' | 'clear' | 'batch' | 'sync' | 'cache';

/**
 * Storage operation timing
 */
export interface OperationTiming {
  /** Operation identifier */
  operationId: string;
  /** Operation type */
  type: PerformanceMetricType;
  /** Storage layer */
  layer: 'local' | 'sync' | 'session' | 'memory' | 'cache';
  /** Operation start time */
  startTime: number;
  /** Operation end time */
  endTime: number;
  /** Duration in milliseconds */
  duration: number;
  /** Data size in bytes */
  dataSize: number;
  /** Whether operation was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Operation metadata */
  metadata?:
    | {
        /** Number of items processed */
        itemCount?: number | undefined;
        /** Compression ratio if applicable */
        compressionRatio?: number | undefined;
        /** Cache hit/miss for read operations */
        cacheHit?: boolean | undefined;
      }
    | undefined;
}

/**
 * Memory usage snapshot
 */
export interface MemorySnapshot {
  /** Snapshot timestamp */
  timestamp: string;
  /** Total memory usage in bytes */
  totalMemory: number;
  /** Memory usage by component */
  componentUsage: {
    /** Cache memory usage */
    cache: number;
    /** Queue memory usage */
    queue: number;
    /** Index memory usage */
    index: number;
    /** Temporary data */
    temporary: number;
    /** Other components */
    other: number;
  };
  /** Memory pressure level */
  pressureLevel: 'low' | 'medium' | 'high' | 'critical';
  /** Available memory estimate */
  availableMemory: number;
  /** Memory growth rate */
  growthRate: number;
}

/**
 * Storage quota information
 */
export interface QuotaInfo {
  /** Storage type */
  storageType: 'local' | 'sync' | 'session';
  /** Used bytes */
  usedBytes: number;
  /** Total quota bytes */
  quotaBytes: number;
  /** Usage percentage */
  usagePercent: number;
  /** Quota status */
  status: 'healthy' | 'warning' | 'critical' | 'exceeded';
  /** Estimated time until full */
  timeUntilFull?: number | undefined;
  /** Last update timestamp */
  lastUpdated: string;
}

/**
 * Performance optimization recommendation
 */
export interface OptimizationRecommendation {
  /** Recommendation ID */
  id: string;
  /** Recommendation type */
  type: 'compression' | 'caching' | 'cleanup' | 'batching' | 'indexing' | 'optimization';
  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Recommendation title */
  title: string;
  /** Detailed description */
  description: string;
  /** Estimated impact */
  estimatedImpact: {
    /** Memory savings in bytes */
    memorySavings?: number;
    /** Performance improvement percentage */
    performanceImprovement?: number;
    /** Storage savings in bytes */
    storageSavings?: number;
  };
  /** Implementation effort */
  effort: 'low' | 'medium' | 'high';
  /** Recommendation timestamp */
  timestamp: string;
}

/**
 * Performance analytics data
 */
export interface PerformanceAnalytics {
  /** Total operations monitored */
  totalOperations: number;
  /** Operations by type */
  operationsByType: Record<PerformanceMetricType, number>;
  /** Operations by layer */
  operationsByLayer: Record<string, number>;
  /** Average operation times */
  averageTimes: Record<PerformanceMetricType, number>;
  /** 95th percentile times */
  p95Times: Record<PerformanceMetricType, number>;
  /** Throughput (operations per second) */
  throughput: Record<PerformanceMetricType, number>;
  /** Error rates */
  errorRates: Record<PerformanceMetricType, number>;
  /** Memory efficiency metrics */
  memoryEfficiency: {
    /** Average memory per operation */
    avgMemoryPerOperation: number;
    /** Memory utilization percentage */
    utilizationPercent: number;
    /** Memory fragmentation estimate */
    fragmentationPercent: number;
  };
  /** Storage efficiency metrics */
  storageEfficiency: {
    /** Compression ratio */
    compressionRatio: number;
    /** Cache hit rate */
    cacheHitRate: number;
    /** Storage utilization */
    utilizationPercent: number;
  };
  /** Analysis period */
  analysisPeriod: {
    /** Start time */
    startTime: string;
    /** End time */
    endTime: string;
    /** Duration in milliseconds */
    duration: number;
  };
}

/**
 * Performance monitor configuration
 */
export interface PerformanceMonitorConfig {
  /** Enable performance monitoring */
  enabled: boolean;
  /** Enable operation timing */
  enableTiming: boolean;
  /** Enable memory monitoring */
  enableMemoryMonitoring: boolean;
  /** Enable quota tracking */
  enableQuotaTracking: boolean;
  /** Memory snapshot interval */
  memorySnapshotInterval: number;
  /** Quota check interval */
  quotaCheckInterval: number;
  /** Analytics calculation interval */
  analyticsInterval: number;
  /** Data retention settings */
  retention: {
    /** Operation timing retention period */
    timingRetention: number;
    /** Memory snapshot retention period */
    memoryRetention: number;
    /** Analytics retention period */
    analyticsRetention: number;
  };
  /** Performance thresholds */
  thresholds: {
    /** Slow operation threshold (ms) */
    slowOperation: number;
    /** Memory pressure threshold (bytes) */
    memoryPressure: number;
    /** Quota warning threshold (percent) */
    quotaWarning: number;
    /** Quota critical threshold (percent) */
    quotaCritical: number;
  };
  /** Optimization settings */
  optimization: {
    /** Enable automatic optimization */
    enableAutoOptimization: boolean;
    /** Optimization triggers */
    triggers: {
      /** Memory pressure trigger */
      memoryPressure: boolean;
      /** Performance degradation trigger */
      performanceDegradation: boolean;
      /** Quota pressure trigger */
      quotaPressure: boolean;
    };
  };
}

/**
 * Storage performance monitor with comprehensive optimization tracking
 */
export class StoragePerformanceMonitor {
  private config: PerformanceMonitorConfig;
  private operationTimings: OperationTiming[] = [];
  private memorySnapshots: MemorySnapshot[] = [];
  private quotaInfo = new Map<string, QuotaInfo>();
  private recommendations: OptimizationRecommendation[] = [];
  private analytics: PerformanceAnalytics | null = null;

  private memoryTimer: NodeJS.Timeout | null = null;
  private quotaTimer: NodeJS.Timeout | null = null;
  private analyticsTimer: NodeJS.Timeout | null = null;
  private startTime = Date.now();

  // Event listeners
  private operationListeners = new Set<(timing: OperationTiming) => void>();
  private memoryListeners = new Set<(snapshot: MemorySnapshot) => void>();
  private quotaListeners = new Set<(quota: QuotaInfo) => void>();
  private recommendationListeners = new Set<(recommendation: OptimizationRecommendation) => void>();

  constructor(config: Partial<PerformanceMonitorConfig> = {}) {
    this.config = {
      enabled: config.enabled !== false,
      enableTiming: config.enableTiming !== false,
      enableMemoryMonitoring: config.enableMemoryMonitoring !== false,
      enableQuotaTracking: config.enableQuotaTracking !== false,
      memorySnapshotInterval: config.memorySnapshotInterval || 60000, // 1 minute
      quotaCheckInterval: config.quotaCheckInterval || 300000, // 5 minutes
      analyticsInterval: config.analyticsInterval || 600000, // 10 minutes
      retention: {
        timingRetention: 24 * 60 * 60 * 1000, // 24 hours
        memoryRetention: 24 * 60 * 60 * 1000, // 24 hours
        analyticsRetention: 7 * 24 * 60 * 60 * 1000, // 7 days
        ...config.retention,
      },
      thresholds: {
        slowOperation: 1000, // 1 second
        memoryPressure: 50 * 1024 * 1024, // 50MB
        quotaWarning: 80, // 80%
        quotaCritical: 95, // 95%
        ...config.thresholds,
      },
      optimization: {
        enableAutoOptimization: true,
        triggers: {
          memoryPressure: true,
          performanceDegradation: true,
          quotaPressure: true,
        },
        ...config.optimization,
      },
    };

    if (this.config.enabled) {
      this.startMonitoring();
    }
  }

  /**
   * Start operation timing
   */
  startOperation(
    type: PerformanceMetricType,
    layer: OperationTiming['layer'],
    metadata?: OperationTiming['metadata'],
  ): string {
    if (!this.config.enabled || !this.config.enableTiming) {
      return '';
    }

    const operationId = this.generateOperationId();
    const startTime = performance.now();

    // Store partial timing (will be completed when operation ends)
    const timing: Partial<OperationTiming> = {
      operationId,
      type,
      layer,
      startTime,
      metadata,
    };

    // Store in a temporary map for completion
    const monitor = this as unknown as { pendingOperations?: Map<string, unknown> };
    monitor.pendingOperations = monitor.pendingOperations || new Map();
    monitor.pendingOperations.set(operationId, timing);

    return operationId;
  }

  /**
   * End operation timing
   */
  endOperation(operationId: string, success: boolean, dataSize: number = 0, error?: string): void {
    if (!this.config.enabled || !this.config.enableTiming || !operationId) {
      return;
    }

    const pendingOperations = (this as { pendingOperations?: Map<string, unknown> }).pendingOperations || new Map();
    const partialTiming = pendingOperations.get(operationId);

    if (!partialTiming) {
      console.warn(`[StoragePerformanceMonitor] No pending operation found: ${operationId}`);
      return;
    }

    const endTime = performance.now();
    const duration = endTime - partialTiming.startTime;

    const completeTiming: OperationTiming = {
      ...partialTiming,
      endTime,
      duration,
      dataSize,
      success,
      error,
    } as OperationTiming;

    this.operationTimings.push(completeTiming);
    pendingOperations.delete(operationId);

    // Cleanup old timings
    this.cleanupOldTimings();

    // Notify listeners
    this.notifyOperationListeners(completeTiming);

    // Check for performance issues
    this.checkPerformanceIssues(completeTiming);

    console.debug(`[StoragePerformanceMonitor] Operation completed: ${completeTiming.type} (${duration.toFixed(2)}ms)`);
  }

  /**
   * Record memory snapshot
   */
  recordMemorySnapshot(): MemorySnapshot {
    const timestamp = new Date().toISOString();

    // Estimate memory usage (simplified calculation)
    const cacheMemory = this.estimateCacheMemory();
    const queueMemory = this.estimateQueueMemory();
    const indexMemory = this.estimateIndexMemory();
    const temporaryMemory = this.estimateTemporaryMemory();
    const otherMemory = this.estimateOtherMemory();

    const totalMemory = cacheMemory + queueMemory + indexMemory + temporaryMemory + otherMemory;

    // Calculate growth rate
    const growthRate = this.calculateMemoryGrowthRate(totalMemory);

    // Determine pressure level
    const pressureLevel = this.calculateMemoryPressure(totalMemory);

    const snapshot: MemorySnapshot = {
      timestamp,
      totalMemory,
      componentUsage: {
        cache: cacheMemory,
        queue: queueMemory,
        index: indexMemory,
        temporary: temporaryMemory,
        other: otherMemory,
      },
      pressureLevel,
      availableMemory: Math.max(0, this.config.thresholds.memoryPressure - totalMemory),
      growthRate,
    };

    this.memorySnapshots.push(snapshot);
    this.cleanupOldMemorySnapshots();

    // Notify listeners
    this.notifyMemoryListeners(snapshot);

    // Check for memory pressure
    if (pressureLevel === 'high' || pressureLevel === 'critical') {
      this.generateMemoryRecommendations(snapshot);
    }

    return snapshot;
  }

  /**
   * Update quota information
   */
  async updateQuotaInfo(): Promise<void> {
    if (!this.config.enabled || !this.config.enableQuotaTracking) {
      return;
    }

    try {
      // Check each storage type
      const storageTypes: Array<{ type: 'local' | 'sync' | 'session'; api: chrome.storage.StorageArea }> = [
        { type: 'local', api: chrome.storage.local },
        { type: 'sync', api: chrome.storage.sync },
        { type: 'session', api: chrome.storage.session },
      ];

      for (const { type, api } of storageTypes) {
        try {
          const usedBytes = await api.getBytesInUse();
          const quotaBytes = this.getQuotaLimit(type);
          const usagePercent = (usedBytes / quotaBytes) * 100;
          const status = this.getQuotaStatus(usagePercent);

          const quotaInfo: QuotaInfo = {
            storageType: type,
            usedBytes,
            quotaBytes,
            usagePercent,
            status,
            timeUntilFull: this.estimateTimeUntilFull(type, usedBytes),
            lastUpdated: new Date().toISOString(),
          };

          this.quotaInfo.set(type, quotaInfo);

          // Notify listeners
          this.notifyQuotaListeners(quotaInfo);

          // Generate recommendations for quota pressure
          if (status === 'warning' || status === 'critical') {
            this.generateQuotaRecommendations(quotaInfo);
          }
        } catch (error) {
          console.warn(`[StoragePerformanceMonitor] Failed to check ${type} quota:`, error);
        }
      }
    } catch (error) {
      console.error('[StoragePerformanceMonitor] Quota update failed:', error);
    }
  }

  /**
   * Calculate performance analytics
   */
  calculateAnalytics(): PerformanceAnalytics {
    const endTime = Date.now();
    const startTime = endTime - this.config.analyticsInterval;
    const recentTimings = this.operationTimings.filter(timing => timing.startTime >= startTime);

    const analytics: PerformanceAnalytics = {
      totalOperations: recentTimings.length,
      operationsByType: {} as Record<PerformanceMetricType, number>,
      operationsByLayer: {},
      averageTimes: {} as Record<PerformanceMetricType, number>,
      p95Times: {} as Record<PerformanceMetricType, number>,
      throughput: {} as Record<PerformanceMetricType, number>,
      errorRates: {} as Record<PerformanceMetricType, number>,
      memoryEfficiency: {
        avgMemoryPerOperation: 0,
        utilizationPercent: 0,
        fragmentationPercent: 0,
      },
      storageEfficiency: {
        compressionRatio: 0,
        cacheHitRate: 0,
        utilizationPercent: 0,
      },
      analysisPeriod: {
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        duration: this.config.analyticsInterval,
      },
    };

    // Calculate operations by type and layer
    for (const timing of recentTimings) {
      analytics.operationsByType[timing.type] = (analytics.operationsByType[timing.type] || 0) + 1;
      analytics.operationsByLayer[timing.layer] = (analytics.operationsByLayer[timing.layer] || 0) + 1;
    }

    // Calculate performance metrics by type
    const metricTypes: PerformanceMetricType[] = ['read', 'write', 'delete', 'clear', 'batch', 'sync', 'cache'];

    for (const type of metricTypes) {
      const typeTimings = recentTimings.filter(t => t.type === type);

      if (typeTimings.length > 0) {
        // Average time
        analytics.averageTimes[type] = typeTimings.reduce((sum, t) => sum + t.duration, 0) / typeTimings.length;

        // 95th percentile
        const sortedDurations = typeTimings.map(t => t.duration).sort((a, b) => a - b);
        const p95Index = Math.floor(sortedDurations.length * 0.95);
        analytics.p95Times[type] = sortedDurations[p95Index] || 0;

        // Throughput (operations per second)
        analytics.throughput[type] = typeTimings.length / (this.config.analyticsInterval / 1000);

        // Error rate
        const errorCount = typeTimings.filter(t => !t.success).length;
        analytics.errorRates[type] = (errorCount / typeTimings.length) * 100;
      } else {
        analytics.averageTimes[type] = 0;
        analytics.p95Times[type] = 0;
        analytics.throughput[type] = 0;
        analytics.errorRates[type] = 0;
      }
    }

    // Calculate memory efficiency
    if (recentTimings.length > 0) {
      const totalDataSize = recentTimings.reduce((sum, t) => sum + t.dataSize, 0);
      analytics.memoryEfficiency.avgMemoryPerOperation = totalDataSize / recentTimings.length;
    }

    const latestMemorySnapshot = this.getLatestMemorySnapshot();
    if (latestMemorySnapshot) {
      analytics.memoryEfficiency.utilizationPercent =
        (latestMemorySnapshot.totalMemory / this.config.thresholds.memoryPressure) * 100;
    }

    // Calculate storage efficiency
    const compressionTimings = recentTimings.filter(t => t.metadata?.compressionRatio);
    if (compressionTimings.length > 0) {
      analytics.storageEfficiency.compressionRatio =
        compressionTimings.reduce((sum, t) => sum + (t.metadata?.compressionRatio || 1), 0) / compressionTimings.length;
    }

    const cacheTimings = recentTimings.filter(t => t.type === 'cache' || t.metadata?.cacheHit !== undefined);
    if (cacheTimings.length > 0) {
      const cacheHits = cacheTimings.filter(t => t.metadata?.cacheHit === true).length;
      analytics.storageEfficiency.cacheHitRate = (cacheHits / cacheTimings.length) * 100;
    }

    this.analytics = analytics;
    return analytics;
  }

  /**
   * Get current performance analytics
   */
  getAnalytics(): PerformanceAnalytics | null {
    return this.analytics ? { ...this.analytics } : null;
  }

  /**
   * Get recent operation timings
   */
  getRecentTimings(type?: PerformanceMetricType, limit: number = 100): OperationTiming[] {
    let timings = this.operationTimings;

    if (type) {
      timings = timings.filter(timing => timing.type === type);
    }

    return timings.slice(-limit).sort((a, b) => b.startTime - a.startTime);
  }

  /**
   * Get memory snapshots
   */
  getMemorySnapshots(limit: number = 50): MemorySnapshot[] {
    return this.memorySnapshots
      .slice(-limit)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Get quota information
   */
  getQuotaInfo(): QuotaInfo[] {
    return Array.from(this.quotaInfo.values());
  }

  /**
   * Get optimization recommendations
   */
  getRecommendations(severity?: OptimizationRecommendation['severity']): OptimizationRecommendation[] {
    let recommendations = this.recommendations;

    if (severity) {
      recommendations = recommendations.filter(rec => rec.severity === severity);
    }

    return recommendations.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Add event listeners
   */
  onOperation(listener: (timing: OperationTiming) => void): void {
    this.operationListeners.add(listener);
  }

  onMemorySnapshot(listener: (snapshot: MemorySnapshot) => void): void {
    this.memoryListeners.add(listener);
  }

  onQuotaUpdate(listener: (quota: QuotaInfo) => void): void {
    this.quotaListeners.add(listener);
  }

  onRecommendation(listener: (recommendation: OptimizationRecommendation) => void): void {
    this.recommendationListeners.add(listener);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PerformanceMonitorConfig>): void {
    const wasEnabled = this.config.enabled;
    this.config = { ...this.config, ...config };

    if (this.config.enabled && !wasEnabled) {
      this.startMonitoring();
    } else if (!this.config.enabled && wasEnabled) {
      this.stopMonitoring();
    }

    console.log('[StoragePerformanceMonitor] Configuration updated');
  }

  /**
   * Shutdown performance monitor
   */
  shutdown(): void {
    console.log('[StoragePerformanceMonitor] Shutting down');

    this.stopMonitoring();
    this.operationTimings = [];
    this.memorySnapshots = [];
    this.quotaInfo.clear();
    this.recommendations = [];
    this.analytics = null;

    // Clear listeners
    this.operationListeners.clear();
    this.memoryListeners.clear();
    this.quotaListeners.clear();
    this.recommendationListeners.clear();

    console.log('[StoragePerformanceMonitor] Shutdown completed');
  }

  /**
   * Start monitoring timers
   */
  private startMonitoring(): void {
    if (this.config.enableMemoryMonitoring) {
      this.memoryTimer = setInterval(() => {
        this.recordMemorySnapshot();
      }, this.config.memorySnapshotInterval);
    }

    if (this.config.enableQuotaTracking) {
      this.quotaTimer = setInterval(() => {
        this.updateQuotaInfo();
      }, this.config.quotaCheckInterval);
    }

    this.analyticsTimer = setInterval(() => {
      this.calculateAnalytics();
    }, this.config.analyticsInterval);

    console.log('[StoragePerformanceMonitor] Monitoring started');
  }

  /**
   * Stop monitoring timers
   */
  private stopMonitoring(): void {
    if (this.memoryTimer) {
      clearInterval(this.memoryTimer);
      this.memoryTimer = null;
    }

    if (this.quotaTimer) {
      clearInterval(this.quotaTimer);
      this.quotaTimer = null;
    }

    if (this.analyticsTimer) {
      clearInterval(this.analyticsTimer);
      this.analyticsTimer = null;
    }

    console.log('[StoragePerformanceMonitor] Monitoring stopped');
  }

  /**
   * Check for performance issues
   */
  private checkPerformanceIssues(timing: OperationTiming): void {
    // Check for slow operations
    if (timing.duration > this.config.thresholds.slowOperation) {
      this.generatePerformanceRecommendation({
        type: 'optimization',
        severity: timing.duration > this.config.thresholds.slowOperation * 2 ? 'high' : 'medium',
        title: 'Slow Operation Detected',
        description: `${timing.type} operation on ${timing.layer} took ${timing.duration.toFixed(0)}ms`,
        estimatedImpact: {
          performanceImprovement: 50,
        },
        effort: 'medium',
      });
    }

    // Check for large data operations
    if (timing.dataSize > 1024 * 1024) {
      // > 1MB
      this.generatePerformanceRecommendation({
        type: 'compression',
        severity: 'medium',
        title: 'Large Data Operation',
        description: `Operation processed ${(timing.dataSize / 1024 / 1024).toFixed(1)}MB of data`,
        estimatedImpact: {
          memorySavings: timing.dataSize * 0.5, // Assume 50% compression
        },
        effort: 'low',
      });
    }
  }

  /**
   * Generate performance recommendation
   */
  private generatePerformanceRecommendation(
    recommendation: Omit<OptimizationRecommendation, 'id' | 'timestamp'>,
  ): void {
    const fullRecommendation: OptimizationRecommendation = {
      ...recommendation,
      id: this.generateRecommendationId(),
      timestamp: new Date().toISOString(),
    };

    this.recommendations.push(fullRecommendation);

    // Limit recommendations
    if (this.recommendations.length > 100) {
      this.recommendations = this.recommendations.slice(-50);
    }

    // Notify listeners
    this.notifyRecommendationListeners(fullRecommendation);
  }

  /**
   * Generate memory recommendations
   */
  private generateMemoryRecommendations(snapshot: MemorySnapshot): void {
    if (snapshot.componentUsage.cache > snapshot.totalMemory * 0.5) {
      this.generatePerformanceRecommendation({
        type: 'caching',
        severity: 'high',
        title: 'High Cache Memory Usage',
        description: 'Cache is using more than 50% of total memory',
        estimatedImpact: {
          memorySavings: snapshot.componentUsage.cache * 0.3,
        },
        effort: 'low',
      });
    }

    if (snapshot.componentUsage.queue > snapshot.totalMemory * 0.3) {
      this.generatePerformanceRecommendation({
        type: 'batching',
        severity: 'medium',
        title: 'High Queue Memory Usage',
        description: 'Operation queue is using significant memory',
        estimatedImpact: {
          memorySavings: snapshot.componentUsage.queue * 0.4,
        },
        effort: 'medium',
      });
    }
  }

  /**
   * Generate quota recommendations
   */
  private generateQuotaRecommendations(quota: QuotaInfo): void {
    if (quota.status === 'warning') {
      this.generatePerformanceRecommendation({
        type: 'cleanup',
        severity: 'medium',
        title: `${quota.storageType} Storage Warning`,
        description: `${quota.storageType} storage is ${quota.usagePercent.toFixed(1)}% full`,
        estimatedImpact: {
          storageSavings: quota.usedBytes * 0.2,
        },
        effort: 'low',
      });
    } else if (quota.status === 'critical') {
      this.generatePerformanceRecommendation({
        type: 'cleanup',
        severity: 'critical',
        title: `${quota.storageType} Storage Critical`,
        description: `${quota.storageType} storage is nearly full (${quota.usagePercent.toFixed(1)}%)`,
        estimatedImpact: {
          storageSavings: quota.usedBytes * 0.3,
        },
        effort: 'low',
      });
    }
  }

  // Memory estimation methods (simplified)
  private estimateCacheMemory(): number {
    // Estimate based on cache operations
    const cacheOperations = this.operationTimings.filter(t => t.type === 'cache');
    return cacheOperations.reduce((sum, op) => sum + op.dataSize, 0);
  }

  private estimateQueueMemory(): number {
    // Estimate queue memory usage
    return 1024 * 1024; // 1MB estimate
  }

  private estimateIndexMemory(): number {
    // Estimate index memory usage
    return 512 * 1024; // 512KB estimate
  }

  private estimateTemporaryMemory(): number {
    // Estimate temporary data memory
    return 256 * 1024; // 256KB estimate
  }

  private estimateOtherMemory(): number {
    // Estimate other component memory
    return 512 * 1024; // 512KB estimate
  }

  private calculateMemoryGrowthRate(currentMemory: number): number {
    if (this.memorySnapshots.length < 2) return 0;

    const previousSnapshot = this.memorySnapshots[this.memorySnapshots.length - 2];
    if (!previousSnapshot) return 0;

    const timeDiff = Date.now() - new Date(previousSnapshot.timestamp).getTime();
    const memoryDiff = currentMemory - previousSnapshot.totalMemory;

    return timeDiff > 0 ? (memoryDiff / timeDiff) * 1000 : 0; // bytes per second
  }

  private calculateMemoryPressure(totalMemory: number): MemorySnapshot['pressureLevel'] {
    const pressureRatio = totalMemory / this.config.thresholds.memoryPressure;

    if (pressureRatio >= 1) return 'critical';
    if (pressureRatio >= 0.8) return 'high';
    if (pressureRatio >= 0.6) return 'medium';
    return 'low';
  }

  private getQuotaLimit(type: 'local' | 'sync' | 'session'): number {
    switch (type) {
      case 'local':
        return 10 * 1024 * 1024; // 10MB
      case 'sync':
        return 100 * 1024; // 100KB
      case 'session':
        return 10 * 1024 * 1024; // 10MB
      default:
        return 1024 * 1024; // 1MB
    }
  }

  private getQuotaStatus(usagePercent: number): QuotaInfo['status'] {
    if (usagePercent >= 100) return 'exceeded';
    if (usagePercent >= this.config.thresholds.quotaCritical) return 'critical';
    if (usagePercent >= this.config.thresholds.quotaWarning) return 'warning';
    return 'healthy';
  }

  private estimateTimeUntilFull(type: string, usedBytes: number): number | undefined {
    // Simple estimation based on recent growth
    const recentOperations = this.operationTimings.filter(t => t.layer === type && t.type === 'write').slice(-10);

    if (recentOperations.length === 0) return undefined;

    const totalDataWritten = recentOperations.reduce((sum, op) => sum + (op?.dataSize ?? 0), 0);
    const lastOp = recentOperations[recentOperations.length - 1];
    const firstOp = recentOperations[0];
    const timeSpan = (lastOp?.startTime ?? 0) - (firstOp?.startTime ?? 0);

    if (timeSpan <= 0) return undefined;

    const writeRate = totalDataWritten / timeSpan; // bytes per ms
    const quotaLimit = this.getQuotaLimit(type as 'local' | 'sync' | 'session');
    const remainingBytes = quotaLimit - usedBytes;

    return writeRate > 0 ? remainingBytes / writeRate : undefined;
  }

  private getLatestMemorySnapshot(): MemorySnapshot | null {
    const latest = this.memorySnapshots[this.memorySnapshots.length - 1];
    return latest ?? null;
  }

  private cleanupOldTimings(): void {
    const cutoffTime = Date.now() - this.config.retention.timingRetention;
    this.operationTimings = this.operationTimings.filter(timing => timing.startTime >= cutoffTime);
  }

  private cleanupOldMemorySnapshots(): void {
    const cutoffTime = Date.now() - this.config.retention.memoryRetention;
    this.memorySnapshots = this.memorySnapshots.filter(
      snapshot => new Date(snapshot.timestamp).getTime() >= cutoffTime,
    );
  }

  // Notification methods
  private notifyOperationListeners(timing: OperationTiming): void {
    for (const listener of this.operationListeners) {
      try {
        listener(timing);
      } catch (error) {
        console.warn('[StoragePerformanceMonitor] Operation listener failed:', error);
      }
    }
  }

  private notifyMemoryListeners(snapshot: MemorySnapshot): void {
    for (const listener of this.memoryListeners) {
      try {
        listener(snapshot);
      } catch (error) {
        console.warn('[StoragePerformanceMonitor] Memory listener failed:', error);
      }
    }
  }

  private notifyQuotaListeners(quota: QuotaInfo): void {
    for (const listener of this.quotaListeners) {
      try {
        listener(quota);
      } catch (error) {
        console.warn('[StoragePerformanceMonitor] Quota listener failed:', error);
      }
    }
  }

  private notifyRecommendationListeners(recommendation: OptimizationRecommendation): void {
    for (const listener of this.recommendationListeners) {
      try {
        listener(recommendation);
      } catch (error) {
        console.warn('[StoragePerformanceMonitor] Recommendation listener failed:', error);
      }
    }
  }

  // ID generation
  private generateOperationId(): string {
    return `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRecommendationId(): string {
    return `rec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
