/**
 * Performance monitor for Service Worker performance monitoring
 * Implements comprehensive performance tracking and optimization alerts
 */

/**
 * Performance metric types
 */
export type PerformanceMetricType = 'memory' | 'cpu' | 'storage' | 'network' | 'api' | 'cache' | 'execution';

/**
 * Performance alert severity levels
 */
export type AlertSeverity = 'info' | 'warning' | 'critical' | 'emergency';

/**
 * Performance threshold configuration
 */
export interface PerformanceThresholds {
  /** Memory usage thresholds */
  memory: {
    /** Warning threshold in MB */
    warning: number;
    /** Critical threshold in MB */
    critical: number;
    /** Emergency threshold in MB */
    emergency: number;
  };
  /** CPU usage thresholds */
  cpu: {
    /** Warning threshold percentage */
    warning: number;
    /** Critical threshold percentage */
    critical: number;
    /** Emergency threshold percentage */
    emergency: number;
  };
  /** Response time thresholds */
  responseTime: {
    /** Warning threshold in milliseconds */
    warning: number;
    /** Critical threshold in milliseconds */
    critical: number;
    /** Emergency threshold in milliseconds */
    emergency: number;
  };
  /** Error rate thresholds */
  errorRate: {
    /** Warning threshold percentage */
    warning: number;
    /** Critical threshold percentage */
    critical: number;
    /** Emergency threshold percentage */
    emergency: number;
  };
}

/**
 * Performance metric data point
 */
export interface PerformanceMetric {
  /** Metric type */
  type: PerformanceMetricType;
  /** Metric name */
  name: string;
  /** Metric value */
  value: number;
  /** Metric unit */
  unit: string;
  /** Measurement timestamp */
  timestamp: string;
  /** Metric tags for categorization */
  tags: Record<string, string>;
  /** Metric metadata */
  metadata?: {
    /** Source component */
    source: string;
    /** Metric context */
    context: string;
    /** Sample size */
    sampleSize?: number;
  };
}

/**
 * Performance alert
 */
export interface PerformanceAlert {
  /** Alert identifier */
  alertId: string;
  /** Alert severity */
  severity: AlertSeverity;
  /** Alert type */
  type: PerformanceMetricType;
  /** Alert message */
  message: string;
  /** Current metric value */
  currentValue: number;
  /** Threshold that was exceeded */
  threshold: number;
  /** Affected component */
  component: string;
  /** Alert timestamp */
  timestamp: string;
  /** Alert context */
  context: {
    /** Additional metrics at alert time */
    contextMetrics: Record<string, number>;
    /** Suggested actions */
    suggestedActions: string[];
    /** Impact assessment */
    impact: 'low' | 'medium' | 'high';
  };
  /** Alert acknowledgment */
  acknowledged: boolean;
  /** Alert resolution */
  resolved: boolean;
}

/**
 * Memory usage statistics
 */
export interface MemoryStats {
  /** Used heap size in bytes */
  usedJSHeapSize: number;
  /** Total heap size in bytes */
  totalJSHeapSize: number;
  /** Heap size limit in bytes */
  jsHeapSizeLimit: number;
  /** Memory usage percentage */
  usagePercent: number;
  /** Memory growth trend */
  growthTrend: 'stable' | 'increasing' | 'decreasing' | 'volatile';
  /** Measurement timestamp */
  timestamp: string;
}

/**
 * Performance snapshot
 */
export interface PerformanceSnapshot {
  /** Snapshot identifier */
  snapshotId: string;
  /** Snapshot timestamp */
  timestamp: string;
  /** Memory statistics */
  memory: MemoryStats;
  /** API response times */
  apiPerformance: {
    /** Average response time */
    avgResponseTime: number;
    /** 95th percentile response time */
    p95ResponseTime: number;
    /** Request count */
    requestCount: number;
    /** Error rate percentage */
    errorRate: number;
  };
  /** Cache performance */
  cachePerformance: {
    /** Cache hit rate percentage */
    hitRate: number;
    /** Cache size in bytes */
    cacheSize: number;
    /** Cache operations per second */
    operationsPerSecond: number;
  };
  /** Service Worker execution metrics */
  executionMetrics: {
    /** Average task execution time */
    avgTaskTime: number;
    /** Active task count */
    activeTasks: number;
    /** Completed tasks */
    completedTasks: number;
    /** Failed tasks */
    failedTasks: number;
  };
  /** Storage performance */
  storagePerformance: {
    /** Storage usage in bytes */
    storageUsage: number;
    /** Storage quota utilization percentage */
    quotaUtilization: number;
    /** Average I/O operation time */
    avgIOTime: number;
  };
}

/**
 * Performance monitoring configuration
 */
export interface PerformanceMonitorConfig {
  /** Enable performance monitoring */
  enabled: boolean;
  /** Monitoring interval in milliseconds */
  monitoringInterval: number;
  /** Metric collection interval in milliseconds */
  metricCollectionInterval: number;
  /** Performance thresholds */
  thresholds: PerformanceThresholds;
  /** Enable automatic optimization */
  enableAutoOptimization: boolean;
  /** Enable performance alerts */
  enableAlerts: boolean;
  /** Alert notification settings */
  alertNotifications: {
    /** Send console notifications */
    console: boolean;
    /** Send Chrome notifications */
    chrome: boolean;
    /** Log to storage */
    storage: boolean;
  };
  /** Data retention settings */
  dataRetention: {
    /** Metric retention period in milliseconds */
    metricRetentionPeriod: number;
    /** Alert retention period in milliseconds */
    alertRetentionPeriod: number;
    /** Snapshot retention period in milliseconds */
    snapshotRetentionPeriod: number;
  };
}

/**
 * Performance monitoring statistics
 */
export interface PerformanceMonitorStats {
  /** Total metrics collected */
  totalMetrics: number;
  /** Metrics by type */
  metricsByType: Record<PerformanceMetricType, number>;
  /** Total alerts generated */
  totalAlerts: number;
  /** Alerts by severity */
  alertsBySeverity: Record<AlertSeverity, number>;
  /** Average monitoring overhead */
  avgMonitoringOverhead: number;
  /** Performance improvements detected */
  improvementsDetected: number;
  /** Last optimization timestamp */
  lastOptimization?: string;
  /** Monitoring uptime */
  uptimePercent: number;
  /** Statistics update timestamp */
  lastUpdated: string;
}

/**
 * Performance monitor for comprehensive Service Worker monitoring
 */
export class PerformanceMonitor {
  private config: PerformanceMonitorConfig;
  private metrics: PerformanceMetric[] = [];
  private alerts: PerformanceAlert[] = [];
  private snapshots: PerformanceSnapshot[] = [];
  private stats: PerformanceMonitorStats;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private metricCollectionInterval: NodeJS.Timeout | null = null;
  private startTime = Date.now();
  private lastMemoryMeasurement: MemoryStats | null = null;

  constructor(config: Partial<PerformanceMonitorConfig> = {}) {
    this.config = {
      enabled: true,
      monitoringInterval: 60000, // 1 minute
      metricCollectionInterval: 15000, // 15 seconds
      thresholds: {
        memory: {
          warning: 50, // 50MB
          critical: 100, // 100MB
          emergency: 150, // 150MB
        },
        cpu: {
          warning: 70, // 70%
          critical: 85, // 85%
          emergency: 95, // 95%
        },
        responseTime: {
          warning: 1000, // 1 second
          critical: 3000, // 3 seconds
          emergency: 5000, // 5 seconds
        },
        errorRate: {
          warning: 5, // 5%
          critical: 10, // 10%
          emergency: 20, // 20%
        },
      },
      enableAutoOptimization: true,
      enableAlerts: true,
      alertNotifications: {
        console: true,
        chrome: true,
        storage: true,
      },
      dataRetention: {
        metricRetentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
        alertRetentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
        snapshotRetentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
      },
      ...config,
    };

    this.stats = this.initializeStats();

    if (this.config.enabled) {
      this.startMonitoring();
    }
  }

  /**
   * Record performance metric
   */
  recordMetric(metric: Omit<PerformanceMetric, 'timestamp'>): void {
    const timestampedMetric: PerformanceMetric = {
      ...metric,
      timestamp: new Date().toISOString(),
    };

    this.metrics.push(timestampedMetric);
    this.stats.totalMetrics++;
    this.stats.metricsByType[metric.type]++;

    // Check for threshold violations
    this.checkThresholds(timestampedMetric);

    // Clean up old metrics
    this.cleanupOldMetrics();

    console.debug(`[PerformanceMonitor] Metric recorded: ${metric.name} = ${metric.value} ${metric.unit}`);
  }

  /**
   * Record API performance metric
   */
  recordApiPerformance(options: {
    endpoint: string;
    method: string;
    responseTime: number;
    success: boolean;
    statusCode?: number;
  }): void {
    this.recordMetric({
      type: 'api',
      name: 'api_response_time',
      value: options.responseTime,
      unit: 'ms',
      tags: {
        endpoint: options.endpoint,
        method: options.method,
        success: options.success.toString(),
        statusCode: options.statusCode?.toString() || 'unknown',
      },
      metadata: {
        source: 'api-monitor',
        context: 'api_performance',
      },
    });
  }

  /**
   * Record memory usage metric
   */
  recordMemoryUsage(): void {
    if ('memory' in performance) {
      const memoryInfo = (
        performance as { memory: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }
      ).memory;

      const memoryStats: MemoryStats = {
        usedJSHeapSize: memoryInfo.usedJSHeapSize,
        totalJSHeapSize: memoryInfo.totalJSHeapSize,
        jsHeapSizeLimit: memoryInfo.jsHeapSizeLimit,
        usagePercent: (memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100,
        growthTrend: this.calculateMemoryTrend(memoryInfo.usedJSHeapSize),
        timestamp: new Date().toISOString(),
      };

      this.recordMetric({
        type: 'memory',
        name: 'heap_usage',
        value: memoryInfo.usedJSHeapSize / (1024 * 1024), // Convert to MB
        unit: 'MB',
        tags: {
          trend: memoryStats.growthTrend,
        },
        metadata: {
          source: 'memory-monitor',
          context: 'memory_usage',
        },
      });

      this.lastMemoryMeasurement = memoryStats;
    }
  }

  /**
   * Record cache performance metric
   */
  recordCachePerformance(options: {
    operation: 'hit' | 'miss' | 'write' | 'eviction';
    cacheType: string;
    duration?: number;
    size?: number;
  }): void {
    this.recordMetric({
      type: 'cache',
      name: `cache_${options.operation}`,
      value: options.duration || 1,
      unit: options.duration ? 'ms' : 'count',
      tags: {
        operation: options.operation,
        cacheType: options.cacheType,
      },
      metadata: {
        source: 'cache-monitor',
        context: 'cache_performance',
        sampleSize: options.size,
      },
    });
  }

  /**
   * Record execution performance metric
   */
  recordExecutionTime(options: { component: string; operation: string; duration: number; success: boolean }): void {
    this.recordMetric({
      type: 'execution',
      name: 'execution_time',
      value: options.duration,
      unit: 'ms',
      tags: {
        component: options.component,
        operation: options.operation,
        success: options.success.toString(),
      },
      metadata: {
        source: 'execution-monitor',
        context: 'execution_performance',
      },
    });
  }

  /**
   * Create performance snapshot
   */
  async createSnapshot(): Promise<PerformanceSnapshot> {
    const snapshotId = `snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Collect current memory stats
    this.recordMemoryUsage();
    const memoryStats = this.lastMemoryMeasurement || this.getDefaultMemoryStats();

    // Calculate API performance
    const apiMetrics = this.getRecentMetrics('api', 300000); // Last 5 minutes
    const apiPerformance = this.calculateApiPerformance(apiMetrics);

    // Calculate cache performance
    const cacheMetrics = this.getRecentMetrics('cache', 300000);
    const cachePerformance = this.calculateCachePerformance(cacheMetrics);

    // Calculate execution metrics
    const executionMetrics = this.getRecentMetrics('execution', 300000);
    const executionPerf = this.calculateExecutionPerformance(executionMetrics);

    // Calculate storage performance
    const storagePerformance = await this.calculateStoragePerformance();

    const snapshot: PerformanceSnapshot = {
      snapshotId,
      timestamp: new Date().toISOString(),
      memory: memoryStats,
      apiPerformance,
      cachePerformance,
      executionMetrics: executionPerf,
      storagePerformance,
    };

    this.snapshots.push(snapshot);
    this.cleanupOldSnapshots();

    console.log(`[PerformanceMonitor] Performance snapshot created: ${snapshotId}`);

    return snapshot;
  }

  /**
   * Get performance alerts
   */
  getAlerts(options?: { severity?: AlertSeverity; acknowledged?: boolean; resolved?: boolean }): PerformanceAlert[] {
    let filteredAlerts = this.alerts;

    if (options?.severity) {
      filteredAlerts = filteredAlerts.filter(alert => alert.severity === options.severity);
    }

    if (options?.acknowledged !== undefined) {
      filteredAlerts = filteredAlerts.filter(alert => alert.acknowledged === options.acknowledged);
    }

    if (options?.resolved !== undefined) {
      filteredAlerts = filteredAlerts.filter(alert => alert.resolved === options.resolved);
    }

    return filteredAlerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.alertId === alertId);
    if (alert) {
      alert.acknowledged = true;
      console.log(`[PerformanceMonitor] Alert acknowledged: ${alertId}`);
      return true;
    }
    return false;
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.alertId === alertId);
    if (alert) {
      alert.resolved = true;
      alert.acknowledged = true;
      console.log(`[PerformanceMonitor] Alert resolved: ${alertId}`);
      return true;
    }
    return false;
  }

  /**
   * Get recent metrics
   */
  getRecentMetrics(type?: PerformanceMetricType, timeWindowMs: number = 300000): PerformanceMetric[] {
    const cutoffTime = Date.now() - timeWindowMs;

    return this.metrics.filter(metric => {
      const metricTime = new Date(metric.timestamp).getTime();
      return metricTime >= cutoffTime && (!type || metric.type === type);
    });
  }

  /**
   * Get performance statistics
   */
  getStats(): PerformanceMonitorStats {
    this.updateUptimePercent();
    this.stats.lastUpdated = new Date().toISOString();
    return { ...this.stats };
  }

  /**
   * Update monitoring configuration
   */
  updateConfig(config: Partial<PerformanceMonitorConfig>): void {
    const wasEnabled = this.config.enabled;
    this.config = { ...this.config, ...config };

    if (this.config.enabled && !wasEnabled) {
      this.startMonitoring();
    } else if (!this.config.enabled && wasEnabled) {
      this.stopMonitoring();
    }

    console.log('[PerformanceMonitor] Configuration updated');
  }

  /**
   * Trigger performance optimization
   */
  async triggerOptimization(): Promise<{
    applied: string[];
    suggested: string[];
  }> {
    const applied: string[] = [];
    const suggested: string[] = [];

    console.log('[PerformanceMonitor] Starting performance optimization');

    try {
      // Memory optimization
      if (this.lastMemoryMeasurement && this.lastMemoryMeasurement.usagePercent > 75) {
        if ('gc' in globalThis && typeof (globalThis as { gc?: () => void }).gc === 'function') {
          (globalThis as { gc: () => void }).gc();
          applied.push('Triggered garbage collection');
        } else {
          suggested.push('Consider reducing memory usage or enabling garbage collection');
        }
      }

      // Cache optimization
      const recentCacheMetrics = this.getRecentMetrics('cache', 600000); // Last 10 minutes
      const cacheHitRate = this.calculateCacheHitRate(recentCacheMetrics);

      if (cacheHitRate < 60) {
        suggested.push('Consider optimizing cache strategy or increasing cache size');
      }

      // Storage optimization
      const storagePerf = await this.calculateStoragePerformance();
      if (storagePerf.quotaUtilization > 80) {
        suggested.push('Consider implementing storage cleanup or data compression');
      }

      // API optimization
      const recentApiMetrics = this.getRecentMetrics('api', 600000);
      const avgResponseTime = this.calculateAverageResponseTime(recentApiMetrics);

      if (avgResponseTime > this.config.thresholds.responseTime.warning) {
        suggested.push('Consider implementing request batching or API call optimization');
      }

      this.stats.lastOptimization = new Date().toISOString();
      this.stats.improvementsDetected += applied.length;

      console.log(
        `[PerformanceMonitor] Optimization completed: ${applied.length} applied, ${suggested.length} suggested`,
      );

      return { applied, suggested };
    } catch (error) {
      console.error('[PerformanceMonitor] Optimization failed:', error);
      return { applied, suggested };
    }
  }

  /**
   * Shutdown performance monitor
   */
  async shutdown(): Promise<void> {
    console.log('[PerformanceMonitor] Shutting down');

    this.stopMonitoring();

    // Create final snapshot
    if (this.config.enabled) {
      await this.createSnapshot();
    }

    // Clear data
    this.metrics = [];
    this.alerts = [];
    this.snapshots = [];

    console.log('[PerformanceMonitor] Shutdown completed');
  }

  /**
   * Check metric thresholds and create alerts
   */
  private checkThresholds(metric: PerformanceMetric): void {
    if (!this.config.enableAlerts) return;

    const { type, value, name, tags } = metric;
    let threshold: number | null = null;
    let severity: AlertSeverity | null = null;

    // Check memory thresholds
    if (type === 'memory' && name === 'heap_usage') {
      if (value >= this.config.thresholds.memory.emergency) {
        threshold = this.config.thresholds.memory.emergency;
        severity = 'emergency';
      } else if (value >= this.config.thresholds.memory.critical) {
        threshold = this.config.thresholds.memory.critical;
        severity = 'critical';
      } else if (value >= this.config.thresholds.memory.warning) {
        threshold = this.config.thresholds.memory.warning;
        severity = 'warning';
      }
    }

    // Check API response time thresholds
    if (type === 'api' && name === 'api_response_time') {
      if (value >= this.config.thresholds.responseTime.emergency) {
        threshold = this.config.thresholds.responseTime.emergency;
        severity = 'emergency';
      } else if (value >= this.config.thresholds.responseTime.critical) {
        threshold = this.config.thresholds.responseTime.critical;
        severity = 'critical';
      } else if (value >= this.config.thresholds.responseTime.warning) {
        threshold = this.config.thresholds.responseTime.warning;
        severity = 'warning';
      }
    }

    // Create alert if threshold exceeded
    if (threshold !== null && severity !== null) {
      this.createAlert({
        severity,
        type,
        message: `${name} exceeded ${severity} threshold`,
        currentValue: value,
        threshold,
        component: tags.component || tags.source || 'unknown',
        context: {
          contextMetrics: this.getContextMetrics(),
          suggestedActions: this.getSuggestedActions(type, severity),
          impact: this.assessImpact(type, severity),
        },
      });
    }
  }

  /**
   * Create performance alert
   */
  private createAlert(alertData: Omit<PerformanceAlert, 'alertId' | 'timestamp' | 'acknowledged' | 'resolved'>): void {
    const alert: PerformanceAlert = {
      ...alertData,
      alertId: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      acknowledged: false,
      resolved: false,
    };

    this.alerts.push(alert);
    this.stats.totalAlerts++;
    this.stats.alertsBySeverity[alert.severity]++;

    // Send notifications
    this.sendAlertNotifications(alert);

    console.warn(`[PerformanceMonitor] Alert created: ${alert.severity} - ${alert.message}`);

    // Trigger auto-optimization for critical/emergency alerts
    if (this.config.enableAutoOptimization && (alert.severity === 'critical' || alert.severity === 'emergency')) {
      setImmediate(() => this.triggerOptimization());
    }
  }

  /**
   * Send alert notifications
   */
  private async sendAlertNotifications(alert: PerformanceAlert): Promise<void> {
    // Console notification
    if (this.config.alertNotifications.console) {
      const logLevel = alert.severity === 'emergency' || alert.severity === 'critical' ? 'error' : 'warn';
      console[logLevel](
        `[PerformanceAlert] ${alert.severity.toUpperCase()}: ${alert.message} (${alert.currentValue} > ${alert.threshold})`,
      );
    }

    // Chrome notification
    if (this.config.alertNotifications.chrome && chrome.notifications) {
      try {
        await chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon-48.png'),
          title: `Performance Alert - ${alert.severity.toUpperCase()}`,
          message: `${alert.message}\nCurrent: ${alert.currentValue}, Threshold: ${alert.threshold}`,
        });
      } catch (error) {
        console.warn('[PerformanceMonitor] Failed to send Chrome notification:', error);
      }
    }

    // Storage notification
    if (this.config.alertNotifications.storage) {
      try {
        const alertKey = `perf_alert_${alert.alertId}`;
        await chrome.storage.local.set({ [alertKey]: alert });
      } catch (error) {
        console.warn('[PerformanceMonitor] Failed to store alert:', error);
      }
    }
  }

  /**
   * Calculate memory growth trend
   */
  private calculateMemoryTrend(currentUsage: number): 'stable' | 'increasing' | 'decreasing' | 'volatile' {
    if (!this.lastMemoryMeasurement) {
      return 'stable';
    }

    const previousUsage = this.lastMemoryMeasurement.usedJSHeapSize;
    const difference = currentUsage - previousUsage;
    const percentChange = Math.abs(difference / previousUsage) * 100;

    if (percentChange < 5) {
      return 'stable';
    } else if (percentChange > 20) {
      return 'volatile';
    } else if (difference > 0) {
      return 'increasing';
    } else {
      return 'decreasing';
    }
  }

  /**
   * Calculate API performance metrics
   */
  private calculateApiPerformance(metrics: PerformanceMetric[]): PerformanceSnapshot['apiPerformance'] {
    const apiMetrics = metrics.filter(m => m.type === 'api' && m.name === 'api_response_time');

    if (apiMetrics.length === 0) {
      return {
        avgResponseTime: 0,
        p95ResponseTime: 0,
        requestCount: 0,
        errorRate: 0,
      };
    }

    const responseTimes = apiMetrics.map(m => m.value);
    const successCount = apiMetrics.filter(m => m.tags.success === 'true').length;

    responseTimes.sort((a, b) => a - b);
    const p95Index = Math.floor(responseTimes.length * 0.95);

    return {
      avgResponseTime: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
      p95ResponseTime: responseTimes[p95Index] || 0,
      requestCount: apiMetrics.length,
      errorRate: ((apiMetrics.length - successCount) / apiMetrics.length) * 100,
    };
  }

  /**
   * Calculate cache performance metrics
   */
  private calculateCachePerformance(metrics: PerformanceMetric[]): PerformanceSnapshot['cachePerformance'] {
    const cacheMetrics = metrics.filter(m => m.type === 'cache');

    if (cacheMetrics.length === 0) {
      return {
        hitRate: 0,
        cacheSize: 0,
        operationsPerSecond: 0,
      };
    }

    const hitRate = this.calculateCacheHitRate(cacheMetrics);
    const timeSpan = this.getMetricsTimeSpan(cacheMetrics) / 1000; // Convert to seconds
    const operationsPerSecond = timeSpan > 0 ? cacheMetrics.length / timeSpan : 0;

    return {
      hitRate,
      cacheSize: 0, // Would need integration with actual cache implementation
      operationsPerSecond,
    };
  }

  /**
   * Calculate execution performance metrics
   */
  private calculateExecutionPerformance(metrics: PerformanceMetric[]): PerformanceSnapshot['executionMetrics'] {
    const execMetrics = metrics.filter(m => m.type === 'execution');

    if (execMetrics.length === 0) {
      return {
        avgTaskTime: 0,
        activeTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
      };
    }

    const avgTaskTime = execMetrics.reduce((sum, m) => sum + m.value, 0) / execMetrics.length;
    const completedTasks = execMetrics.filter(m => m.tags.success === 'true').length;
    const failedTasks = execMetrics.filter(m => m.tags.success === 'false').length;

    return {
      avgTaskTime,
      activeTasks: 0, // Would need integration with actual task system
      completedTasks,
      failedTasks,
    };
  }

  /**
   * Calculate storage performance
   */
  private async calculateStoragePerformance(): Promise<PerformanceSnapshot['storagePerformance']> {
    try {
      // Get storage usage
      const localUsage = await chrome.storage.local.getBytesInUse();
      const syncUsage = await chrome.storage.sync.getBytesInUse();
      const sessionUsage = await chrome.storage.session.getBytesInUse();

      const totalUsage = localUsage + syncUsage + sessionUsage;
      const quotaLimit = 10 * 1024 * 1024; // Approximate 10MB limit
      const quotaUtilization = (totalUsage / quotaLimit) * 100;

      // Calculate average I/O time from storage metrics
      const storageMetrics = this.getRecentMetrics('storage', 300000);
      const avgIOTime =
        storageMetrics.length > 0 ? storageMetrics.reduce((sum, m) => sum + m.value, 0) / storageMetrics.length : 0;

      return {
        storageUsage: totalUsage,
        quotaUtilization,
        avgIOTime,
      };
    } catch (error) {
      console.warn('[PerformanceMonitor] Failed to calculate storage performance:', error);
      return {
        storageUsage: 0,
        quotaUtilization: 0,
        avgIOTime: 0,
      };
    }
  }

  /**
   * Calculate cache hit rate
   */
  private calculateCacheHitRate(cacheMetrics: PerformanceMetric[]): number {
    const hits = cacheMetrics.filter(m => m.name === 'cache_hit').length;
    const misses = cacheMetrics.filter(m => m.name === 'cache_miss').length;
    const total = hits + misses;

    return total > 0 ? (hits / total) * 100 : 0;
  }

  /**
   * Calculate average response time
   */
  private calculateAverageResponseTime(apiMetrics: PerformanceMetric[]): number {
    const responseTimes = apiMetrics.filter(m => m.name === 'api_response_time').map(m => m.value);

    return responseTimes.length > 0 ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length : 0;
  }

  /**
   * Get context metrics for alerts
   */
  private getContextMetrics(): Record<string, number> {
    const recentMetrics = this.getRecentMetrics(undefined, 60000); // Last minute
    const contextMetrics: Record<string, number> = {};

    // Memory usage
    const memoryMetrics = recentMetrics.filter(m => m.type === 'memory');
    if (memoryMetrics.length > 0) {
      contextMetrics.currentMemoryUsage = memoryMetrics[memoryMetrics.length - 1].value;
    }

    // API response time
    const apiMetrics = recentMetrics.filter(m => m.type === 'api');
    if (apiMetrics.length > 0) {
      contextMetrics.avgApiResponseTime = this.calculateAverageResponseTime(apiMetrics);
    }

    // Cache hit rate
    const cacheMetrics = recentMetrics.filter(m => m.type === 'cache');
    if (cacheMetrics.length > 0) {
      contextMetrics.cacheHitRate = this.calculateCacheHitRate(cacheMetrics);
    }

    return contextMetrics;
  }

  /**
   * Get suggested actions for alert type and severity
   */
  private getSuggestedActions(type: PerformanceMetricType, severity: AlertSeverity): string[] {
    const actions: string[] = [];

    switch (type) {
      case 'memory':
        actions.push('Review memory usage patterns');
        if (severity === 'critical' || severity === 'emergency') {
          actions.push('Trigger garbage collection');
          actions.push('Clear unnecessary caches');
          actions.push('Reduce active data structures');
        }
        break;

      case 'api':
        actions.push('Review API call patterns');
        if (severity === 'critical' || severity === 'emergency') {
          actions.push('Implement request throttling');
          actions.push('Add request caching');
          actions.push('Optimize API endpoints');
        }
        break;

      case 'cache':
        actions.push('Optimize cache configuration');
        actions.push('Review cache eviction policies');
        break;

      case 'storage':
        actions.push('Review storage usage');
        actions.push('Implement data cleanup');
        break;

      default:
        actions.push('Review component performance');
    }

    return actions;
  }

  /**
   * Assess impact level for alert
   */
  private assessImpact(type: PerformanceMetricType, severity: AlertSeverity): 'low' | 'medium' | 'high' {
    if (severity === 'emergency') return 'high';
    if (severity === 'critical') return 'high';
    if (severity === 'warning' && (type === 'memory' || type === 'api')) return 'medium';
    return 'low';
  }

  /**
   * Get metrics time span in milliseconds
   */
  private getMetricsTimeSpan(metrics: PerformanceMetric[]): number {
    if (metrics.length === 0) return 0;

    const timestamps = metrics.map(m => new Date(m.timestamp).getTime());
    return Math.max(...timestamps) - Math.min(...timestamps);
  }

  /**
   * Get default memory stats
   */
  private getDefaultMemoryStats(): MemoryStats {
    return {
      usedJSHeapSize: 0,
      totalJSHeapSize: 0,
      jsHeapSizeLimit: 0,
      usagePercent: 0,
      growthTrend: 'stable',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Start performance monitoring
   */
  private startMonitoring(): void {
    if (this.monitoringInterval || this.metricCollectionInterval) {
      return;
    }

    // Start metric collection
    this.metricCollectionInterval = setInterval(() => {
      this.recordMemoryUsage();
    }, this.config.metricCollectionInterval);

    // Start monitoring tasks
    this.monitoringInterval = setInterval(async () => {
      await this.createSnapshot();
      this.cleanupOldData();
    }, this.config.monitoringInterval);

    console.log('[PerformanceMonitor] Monitoring started');
  }

  /**
   * Stop performance monitoring
   */
  private stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.metricCollectionInterval) {
      clearInterval(this.metricCollectionInterval);
      this.metricCollectionInterval = null;
    }

    console.log('[PerformanceMonitor] Monitoring stopped');
  }

  /**
   * Cleanup old metrics
   */
  private cleanupOldMetrics(): void {
    const cutoffTime = Date.now() - this.config.dataRetention.metricRetentionPeriod;
    const originalLength = this.metrics.length;

    this.metrics = this.metrics.filter(metric => new Date(metric.timestamp).getTime() >= cutoffTime);

    if (this.metrics.length < originalLength) {
      console.debug(`[PerformanceMonitor] Cleaned up ${originalLength - this.metrics.length} old metrics`);
    }
  }

  /**
   * Cleanup old alerts
   */
  private cleanupOldAlerts(): void {
    const cutoffTime = Date.now() - this.config.dataRetention.alertRetentionPeriod;
    const originalLength = this.alerts.length;

    this.alerts = this.alerts.filter(alert => new Date(alert.timestamp).getTime() >= cutoffTime);

    if (this.alerts.length < originalLength) {
      console.debug(`[PerformanceMonitor] Cleaned up ${originalLength - this.alerts.length} old alerts`);
    }
  }

  /**
   * Cleanup old snapshots
   */
  private cleanupOldSnapshots(): void {
    const cutoffTime = Date.now() - this.config.dataRetention.snapshotRetentionPeriod;
    const originalLength = this.snapshots.length;

    this.snapshots = this.snapshots.filter(snapshot => new Date(snapshot.timestamp).getTime() >= cutoffTime);

    if (this.snapshots.length < originalLength) {
      console.debug(`[PerformanceMonitor] Cleaned up ${originalLength - this.snapshots.length} old snapshots`);
    }
  }

  /**
   * Cleanup all old data
   */
  private cleanupOldData(): void {
    this.cleanupOldMetrics();
    this.cleanupOldAlerts();
    this.cleanupOldSnapshots();
  }

  /**
   * Update uptime percentage
   */
  private updateUptimePercent(): void {
    const totalTime = Date.now() - this.startTime;
    const expectedMetrics = Math.floor(totalTime / this.config.metricCollectionInterval);

    if (expectedMetrics > 0) {
      this.stats.uptimePercent = (this.stats.totalMetrics / expectedMetrics) * 100;
    }
  }

  /**
   * Initialize performance monitor statistics
   */
  private initializeStats(): PerformanceMonitorStats {
    return {
      totalMetrics: 0,
      metricsByType: {
        memory: 0,
        cpu: 0,
        storage: 0,
        network: 0,
        api: 0,
        cache: 0,
        execution: 0,
      },
      totalAlerts: 0,
      alertsBySeverity: {
        info: 0,
        warning: 0,
        critical: 0,
        emergency: 0,
      },
      avgMonitoringOverhead: 0,
      improvementsDetected: 0,
      uptimePercent: 0,
      lastUpdated: new Date().toISOString(),
    };
  }
}
