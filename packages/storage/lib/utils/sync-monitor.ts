/**
 * Sync status monitor with tracking and user notifications
 * Implements connection monitoring and sync health checks for user visibility
 */

import type {
  SyncStatus,
  SyncMonitorConfig,
  SyncHealthStatus,
  SyncNotification,
  SyncHealthCheck,
  SyncEvent,
  SyncEventType,
} from '../types/cache';

/**
 * Connection quality assessment
 */
export interface ConnectionQuality {
  /** Quality level */
  level: 'excellent' | 'good' | 'fair' | 'poor' | 'offline';
  /** Quality score (0-100) */
  score: number;
  /** Connection details */
  details: {
    /** Online status */
    online: boolean;
    /** Connection type */
    type: string;
    /** Effective speed */
    effectiveType: string;
    /** Round-trip time */
    rtt: number;
    /** Downlink speed */
    downlink: number;
    /** Save data mode */
    saveData: boolean;
  };
  /** Assessment timestamp */
  timestamp: string;
}

/**
 * User notification config
 */
export interface NotificationConfig {
  /** Enable notifications */
  enabled: boolean;
  /** Notification types to show */
  types: SyncEventType[];
  /** Show success notifications */
  showSuccess: boolean;
  /** Show error notifications */
  showErrors: boolean;
  /** Auto-dismiss timeout */
  autoTimeout: number;
  /** Maximum notifications to show */
  maxNotifications: number;
}

/**
 * Sync monitoring statistics
 */
export interface SyncMonitorStats {
  /** Total sync events monitored */
  totalEvents: number;
  /** Events by type */
  eventsByType: Record<SyncEventType, number>;
  /** Health checks performed */
  healthChecks: number;
  /** Notifications sent */
  notificationsSent: number;
  /** Average health score */
  averageHealthScore: number;
  /** Monitoring uptime */
  monitoringUptime: number;
  /** Last health check */
  lastHealthCheck?: string;
  /** Statistics timestamp */
  lastUpdated: string;
}

/**
 * Sync status monitor with comprehensive health tracking
 */
export class SyncStatusMonitor {
  private config: SyncMonitorConfig;
  private stats: SyncMonitorStats;
  private eventHistory: SyncEvent[] = [];
  private healthHistory: SyncHealthCheck[] = [];
  private currentStatus: SyncStatus | null = null;
  private connectionQuality: ConnectionQuality | null = null;
  private isMonitoring = false;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private startTime = Date.now();

  // Event listeners
  private eventListeners = new Map<SyncEventType, Set<(event: SyncEvent) => void>>();
  private statusChangeListeners = new Set<(status: SyncStatus) => void>();
  private healthChangeListeners = new Set<(health: SyncHealthCheck) => void>();
  private notificationListeners = new Set<(notification: SyncNotification) => void>();

  constructor(config: Partial<SyncMonitorConfig> = {}) {
    this.config = {
      enableDetailedMonitoring: config.enableDetailedMonitoring !== false,
      enableHealthChecks: config.enableHealthChecks !== false,
      healthCheckInterval: config.healthCheckInterval || 60000, // 1 minute
      maxOfflineTime: config.maxOfflineTime || 300000, // 5 minutes
      connectionCheckInterval: config.connectionCheckInterval || 30, // 30 seconds
      enableEventTracking: config.enableEventTracking !== false,
      maxEventHistory: config.maxEventHistory || 1000,
      enableNotifications: config.enableNotifications !== false,
      notificationConfig: {
        enabled: true,
        types: ['sync_failed', 'conflict_detected'],
        showSuccess: false,
        showErrors: true,
        autoTimeout: 5000,
        enableSound: false,
        maxNotifications: 5,
        ...config.notificationConfig,
      },
      thresholds: {
        performanceThreshold: 5000, // 5 seconds
        queueSizeThreshold: 50,
        conflictRate: 0.1, // 10%
        errorRate: {
          healthy: 0.01, // 1%
          elevated: 0.05, // 5%
          critical: 0.1, // 10%
        },
        healthScore: {
          healthy: 80,
          degraded: 60,
          unhealthy: 40,
        },
        performance: {
          good: 2000, // 2 seconds
          acceptable: 5000, // 5 seconds
          poor: 10000, // 10 seconds
          healthy: 2000,
          elevated: 5000,
          critical: 10000,
        },
        errorRateThresholds: {
          healthy: 1, // 1%
          elevated: 5, // 5%
          critical: 10, // 10%
        },
        queueSize: {
          healthy: 10,
          elevated: 30,
          critical: 50,
          backlogged: 50,
        },
        ...config.thresholds,
      },
    };

    this.stats = this.initializeStats();

    if (this.config.enableHealthChecks) {
      this.startHealthMonitoring();
    }

    // Setup network monitoring
    this.setupNetworkMonitoring();
  }

  /**
   * Start monitoring sync operations
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.startTime = Date.now();

    console.log('[SyncStatusMonitor] Monitoring started');

    // Record monitoring start event
    this.recordEvent('sync_started', {
      operationCount: 0,
    });
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    this.stopHealthMonitoring();

    console.log('[SyncStatusMonitor] Monitoring stopped');
  }

  /**
   * Record sync event
   */
  recordEvent(type: SyncEventType, data?: SyncEvent['data']): void {
    if (!this.config.enableEventTracking) return;

    const event: SyncEvent = {
      type,
      timestamp: new Date().toISOString(),
      data: data ?? undefined,
    };

    this.eventHistory.push(event);
    this.stats.totalEvents++;
    this.stats.eventsByType[type]++;

    // Limit event history size
    if (this.eventHistory.length > this.config.maxEventHistory) {
      this.eventHistory = this.eventHistory.slice(-Math.floor(this.config.maxEventHistory / 2));
    }

    // Notify event listeners
    this.notifyEventListeners(event);

    // Handle special events
    this.handleSpecialEvent(event);

    console.debug(`[SyncStatusMonitor] Event recorded: ${type}`, data);
  }

  /**
   * Update sync status
   */
  updateStatus(status: SyncStatus): void {
    const previousStatus = this.currentStatus;
    this.currentStatus = status;

    // Check for status changes
    if (previousStatus && this.hasStatusChanged(previousStatus, status)) {
      this.notifyStatusChangeListeners(status);

      // Record status change events
      if (status.online !== previousStatus.online) {
        this.recordEvent(status.online ? 'connection_restored' : 'offline_detected', {
          networkStatus: status.online,
        });
      }
    }
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<SyncHealthCheck> {
    const timestamp = new Date().toISOString();
    let totalScore = 0;
    let checkCount = 0;
    const recommendations: string[] = [];

    // Network check
    const networkCheck = await this.checkNetworkHealth();
    totalScore += this.getHealthScore(networkCheck.status);
    checkCount++;

    // Quota check
    const quotaCheck = await this.checkQuotaHealth();
    totalScore += this.getHealthScore(quotaCheck.status);
    checkCount++;
    if (quotaCheck.status !== 'healthy') {
      recommendations.push(`Storage quota at ${quotaCheck.utilization}% - consider cleanup`);
    }

    // Performance check
    const performanceCheck = this.checkPerformanceHealth();
    totalScore += this.getHealthScore(performanceCheck.status);
    checkCount++;
    if (performanceCheck.status !== 'healthy') {
      recommendations.push(`Sync performance is ${performanceCheck.status} (${performanceCheck.averageTime}ms avg)`);
    }

    // Error rate check
    const errorCheck = this.checkErrorHealth();
    totalScore += this.getHealthScore(errorCheck.status);
    checkCount++;
    if (errorCheck.status !== 'healthy') {
      recommendations.push(`Error rate is ${errorCheck.status} (${errorCheck.errorRate}%)`);
    }

    // Queue health check
    const queueCheck = this.checkQueueHealth();
    totalScore += this.getHealthScore(queueCheck.status);
    checkCount++;
    if (queueCheck.status !== 'healthy') {
      recommendations.push(`Sync queue is ${queueCheck.status} (${queueCheck.queueSize} items)`);
    }

    // Calculate overall health
    const overallScore = checkCount > 0 ? totalScore / checkCount : 0;
    const overallStatus = this.getOverallHealthStatus(overallScore);

    const healthCheck: SyncHealthCheck = {
      status: overallStatus,
      score: overallScore,
      timestamp,
      checks: {
        network: networkCheck,
        quota: quotaCheck,
        performance: performanceCheck,
        errors: errorCheck,
        queue: queueCheck,
      },
      recommendations,
    };

    // Store in history
    this.healthHistory.push(healthCheck);
    this.stats.healthChecks++;

    // Limit history size
    if (this.healthHistory.length > 100) {
      this.healthHistory = this.healthHistory.slice(-50);
    }

    // Update average health score
    this.stats.averageHealthScore =
      (this.stats.averageHealthScore * (this.stats.healthChecks - 1) + overallScore) / this.stats.healthChecks;

    this.stats.lastHealthCheck = timestamp;

    // Notify health change listeners
    this.notifyHealthChangeListeners(healthCheck);

    console.log(`[SyncStatusMonitor] Health check completed: ${overallStatus} (${overallScore.toFixed(1)})`);

    return healthCheck;
  }

  /**
   * Get current sync status
   */
  getCurrentStatus(): SyncStatus | null {
    return this.currentStatus ? { ...this.currentStatus } : null;
  }

  /**
   * Get latest health check
   */
  getLatestHealthCheck(): SyncHealthCheck | null {
    if (this.healthHistory.length === 0) return null;
    const latest = this.healthHistory[this.healthHistory.length - 1];
    return latest ?? null;
  }

  /**
   * Get connection quality
   */
  getConnectionQuality(): ConnectionQuality | null {
    return this.connectionQuality ? { ...this.connectionQuality } : null;
  }

  /**
   * Get recent sync events
   */
  getRecentEvents(limit: number = 50, type?: SyncEventType): SyncEvent[] {
    let events = this.eventHistory;

    if (type) {
      events = events.filter(event => event.type === type);
    }

    return events.slice(-limit).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Get monitoring statistics
   */
  getStats(): SyncMonitorStats {
    this.updateStatsCalculations();
    return { ...this.stats };
  }

  /**
   * Add event listener
   */
  addEventListener(type: SyncEventType, listener: (event: SyncEvent) => void): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    this.eventListeners.get(type)!.add(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(type: SyncEventType, listener: (event: SyncEvent) => void): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Add status change listener
   */
  onStatusChange(listener: (status: SyncStatus) => void): void {
    this.statusChangeListeners.add(listener);
  }

  /**
   * Add health change listener
   */
  onHealthChange(listener: (health: SyncHealthCheck) => void): void {
    this.healthChangeListeners.add(listener);
  }

  /**
   * Add notification listener
   */
  onNotification(listener: (notification: SyncNotification) => void): void {
    this.notificationListeners.add(listener);
  }

  /**
   * Update monitoring configuration
   */
  updateConfig(config: Partial<SyncMonitorConfig>): void {
    this.config = { ...this.config, ...config };

    if (this.config.enableHealthChecks && !this.healthCheckTimer) {
      this.startHealthMonitoring();
    } else if (!this.config.enableHealthChecks && this.healthCheckTimer) {
      this.stopHealthMonitoring();
    }

    console.log('[SyncStatusMonitor] Configuration updated');
  }

  /**
   * Clear event history
   */
  clearEventHistory(): number {
    const count = this.eventHistory.length;
    this.eventHistory = [];
    console.log(`[SyncStatusMonitor] Cleared ${count} events from history`);
    return count;
  }

  /**
   * Shutdown monitor
   */
  shutdown(): void {
    console.log('[SyncStatusMonitor] Shutting down');

    this.stopMonitoring();
    this.eventListeners.clear();
    this.statusChangeListeners.clear();
    this.healthChangeListeners.clear();
    this.notificationListeners.clear();
    this.eventHistory = [];
    this.healthHistory = [];

    console.log('[SyncStatusMonitor] Shutdown completed');
  }

  /**
   * Check network health
   */
  private async checkNetworkHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'offline';
    details: string;
  }> {
    if (!navigator.onLine) {
      return {
        status: 'offline',
        details: 'No network connection detected',
      };
    }

    if (this.connectionQuality) {
      const quality = this.connectionQuality.level;

      switch (quality) {
        case 'excellent':
        case 'good':
          return {
            status: 'healthy',
            details: `Network quality: ${quality} (${this.connectionQuality.details.effectiveType})`,
          };
        case 'fair':
          return {
            status: 'degraded',
            details: `Network quality: ${quality} (${this.connectionQuality.details.effectiveType})`,
          };
        case 'poor':
          return {
            status: 'degraded',
            details: `Network quality: ${quality} (${this.connectionQuality.details.effectiveType})`,
          };
        default:
          return {
            status: 'degraded',
            details: 'Unknown network quality',
          };
      }
    }

    return {
      status: 'healthy',
      details: 'Network connection available',
    };
  }

  /**
   * Check storage quota health
   */
  private async checkQuotaHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    details: string;
    utilization: number;
  }> {
    try {
      const usage = await chrome.storage.sync.getBytesInUse();
      const quota = chrome.storage.sync.QUOTA_BYTES || 102400; // 100KB default
      const utilization = (usage / quota) * 100;

      if (utilization < 70) {
        return {
          status: 'healthy',
          details: `Quota usage: ${utilization.toFixed(1)}%`,
          utilization,
        };
      } else if (utilization < 90) {
        return {
          status: 'warning',
          details: `Quota usage: ${utilization.toFixed(1)}% - approaching limit`,
          utilization,
        };
      } else {
        return {
          status: 'critical',
          details: `Quota usage: ${utilization.toFixed(1)}% - very close to limit`,
          utilization,
        };
      }
    } catch (error) {
      return {
        status: 'warning',
        details: `Unable to check quota: ${error}`,
        utilization: 0,
      };
    }
  }

  /**
   * Check sync performance health
   */
  private checkPerformanceHealth(): {
    status: 'healthy' | 'slow' | 'poor';
    details: string;
    averageTime: number;
  } {
    // Calculate average sync time from recent events
    const syncEvents = this.eventHistory.filter(e => e.type === 'sync_completed' && e.data?.duration).slice(-10); // Last 10 sync operations

    if (syncEvents.length === 0) {
      return {
        status: 'healthy',
        details: 'No recent sync operations to analyze',
        averageTime: 0,
      };
    }

    const averageTime = syncEvents.reduce((sum, event) => sum + (event.data?.duration || 0), 0) / syncEvents.length;

    if (averageTime <= this.config.thresholds.performance.good) {
      return {
        status: 'healthy',
        details: `Average sync time: ${averageTime.toFixed(0)}ms`,
        averageTime,
      };
    } else if (averageTime <= this.config.thresholds.performance.acceptable) {
      return {
        status: 'slow',
        details: `Average sync time: ${averageTime.toFixed(0)}ms - slower than optimal`,
        averageTime,
      };
    } else {
      return {
        status: 'poor',
        details: `Average sync time: ${averageTime.toFixed(0)}ms - performance issues detected`,
        averageTime,
      };
    }
  }

  /**
   * Check error rate health
   */
  private checkErrorHealth(): {
    status: 'healthy' | 'some' | 'many';
    details: string;
    errorRate: number;
  } {
    const recentEvents = this.eventHistory.slice(-50); // Last 50 events
    const failedEvents = recentEvents.filter(e => e.type === 'sync_failed').length;
    const totalSyncEvents = recentEvents.filter(e => e.type === 'sync_completed' || e.type === 'sync_failed').length;

    if (totalSyncEvents === 0) {
      return {
        status: 'healthy',
        details: 'No recent sync operations',
        errorRate: 0,
      };
    }

    const errorRate = (failedEvents / totalSyncEvents) * 100;

    if (errorRate <= this.config.thresholds.errorRateThresholds.healthy) {
      return {
        status: 'healthy',
        details: `Error rate: ${errorRate.toFixed(1)}%`,
        errorRate: errorRate,
      };
    } else if (errorRate <= this.config.thresholds.errorRateThresholds.elevated) {
      return {
        status: 'some',
        details: `Error rate: ${errorRate.toFixed(1)}% - higher than normal`,
        errorRate: errorRate,
      };
    } else {
      return {
        status: 'many',
        details: `Error rate: ${errorRate.toFixed(1)}% - significant issues detected`,
        errorRate: errorRate,
      };
    }
  }

  /**
   * Check queue health
   */
  private checkQueueHealth(): {
    status: 'healthy' | 'backed_up' | 'overflowing';
    details: string;
    queueSize: number;
  } {
    const queueSize = this.currentStatus?.queueSize || 0;

    if (queueSize <= this.config.thresholds.queueSize.healthy) {
      return {
        status: 'healthy',
        details: `Queue size: ${queueSize} items`,
        queueSize: queueSize,
      };
    } else if (queueSize <= this.config.thresholds.queueSize.backlogged) {
      return {
        status: 'backed_up',
        details: `Queue size: ${queueSize} items - processing backlog`,
        queueSize: queueSize,
      };
    } else {
      return {
        status: 'overflowing',
        details: `Queue size: ${queueSize} items - potential sync issues`,
        queueSize: queueSize,
      };
    }
  }

  /**
   * Get health score from status
   */
  private getHealthScore(status: string): number {
    switch (status) {
      case 'healthy':
        return 100;
      case 'good':
        return 85;
      case 'fair':
        return 70;
      case 'degraded':
        return 60;
      case 'warning':
        return 50;
      case 'slow':
        return 40;
      case 'some':
        return 30;
      case 'backed_up':
        return 25;
      case 'poor':
        return 20;
      case 'critical':
        return 10;
      case 'many':
        return 8;
      case 'overflowing':
        return 5;
      case 'offline':
        return 0;
      default:
        return 50;
    }
  }

  /**
   * Get overall health status from score
   */
  private getOverallHealthStatus(score: number): SyncHealthStatus {
    if (score >= this.config.thresholds.healthScore.healthy) {
      return 'healthy';
    } else if (score >= this.config.thresholds.healthScore.degraded) {
      return 'degraded';
    } else {
      return 'critical';
    }
  }

  /**
   * Setup network monitoring
   */
  private setupNetworkMonitoring(): void {
    // Update connection quality
    const updateConnectionQuality = () => {
      const connection = (navigator as { connection?: { effectiveType?: string; rtt?: number } }).connection;
      const online = navigator.onLine;

      let quality: ConnectionQuality['level'] = 'offline';
      let score = 0;

      if (online) {
        if (connection) {
          const effectiveType = connection.effectiveType || 'unknown';
          const rtt = connection.rtt || 0;

          switch (effectiveType) {
            case '4g':
              quality = 'excellent';
              score = 95;
              break;
            case '3g':
              quality = 'good';
              score = 75;
              break;
            case '2g':
              quality = 'fair';
              score = 50;
              break;
            case 'slow-2g':
              quality = 'poor';
              score = 25;
              break;
            default:
              quality = 'good';
              score = 75;
          }

          // Adjust score based on RTT
          if (rtt > 500) score = Math.max(score - 20, 0);
          else if (rtt > 200) score = Math.max(score - 10, 0);
        } else {
          quality = 'good';
          score = 75;
        }
      }

      this.connectionQuality = {
        level: quality,
        score,
        details: {
          online,
          type: 'unknown',
          effectiveType: connection?.effectiveType || 'unknown',
          rtt: connection?.rtt || 0,
          downlink: 0,
          saveData: false,
        },
        timestamp: new Date().toISOString(),
      };
    };

    updateConnectionQuality();

    // Monitor network changes
    window.addEventListener('online', () => {
      updateConnectionQuality();
      this.recordEvent('connection_restored', { networkStatus: true });
    });

    window.addEventListener('offline', () => {
      updateConnectionQuality();
      this.recordEvent('offline_detected', { networkStatus: false });
    });

    // Monitor connection changes
    if ('connection' in navigator) {
      (
        navigator as { connection: { addEventListener: (event: string, handler: () => void) => void } }
      ).connection.addEventListener('change', updateConnectionQuality);
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckTimer) return;

    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);

    console.log('[SyncStatusMonitor] Health monitoring started');
  }

  /**
   * Stop health monitoring
   */
  private stopHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
      console.log('[SyncStatusMonitor] Health monitoring stopped');
    }
  }

  /**
   * Handle special events
   */
  private handleSpecialEvent(event: SyncEvent): void {
    // Send notifications for important events
    if (
      this.config.enableNotifications &&
      this.config.notificationConfig.enabled &&
      this.config.notificationConfig.types.includes(event.type)
    ) {
      this.sendNotification(event);
    }

    // Trigger health check for critical events
    if (event.type === 'sync_failed') {
      setImmediate(() => this.performHealthCheck());
    }
  }

  /**
   * Send notification
   */
  private sendNotification(event: SyncEvent): void {
    const notification: SyncNotification = {
      id: `notification-${Date.now()}`,
      type: this.getNotificationType(event.type),
      title: this.getNotificationTitle(event.type),
      message: this.getNotificationMessage(event),
      timestamp: event.timestamp,
      read: false,
      autoTimeout: this.config.notificationConfig.autoTimeout,
    };

    // Notify listeners
    for (const listener of this.notificationListeners) {
      try {
        listener(notification);
      } catch (error) {
        console.warn('[SyncStatusMonitor] Notification listener failed:', error);
      }
    }

    this.stats.notificationsSent++;
  }

  /**
   * Get notification type from event type
   */
  private getNotificationType(eventType: SyncEventType): 'info' | 'warning' | 'error' {
    switch (eventType) {
      case 'sync_failed':
        return 'error';
      case 'conflict_detected':
        return 'warning';
      default:
        return 'info';
    }
  }

  /**
   * Get notification title
   */
  private getNotificationTitle(eventType: SyncEventType): string {
    switch (eventType) {
      case 'sync_failed':
        return 'Sync Failed';
      case 'conflict_detected':
        return 'Sync Conflict Detected';
      case 'offline_detected':
        return 'Offline Mode';
      case 'connection_restored':
        return 'Back Online';
      default:
        return 'Sync Notification';
    }
  }

  /**
   * Get notification message
   */
  private getNotificationMessage(event: SyncEvent): string {
    switch (event.type) {
      case 'sync_failed':
        return `Sync operation failed: ${event.data?.error || 'Unknown error'}`;
      case 'conflict_detected':
        return 'A sync conflict was detected and needs resolution.';
      case 'offline_detected':
        return 'Sync is paused while offline. Operations will resume when online.';
      case 'connection_restored':
        return 'Connection restored. Sync operations will resume.';
      default:
        return `Sync event: ${event.type}`;
    }
  }

  /**
   * Check if status has changed
   */
  private hasStatusChanged(previous: SyncStatus, current: SyncStatus): boolean {
    return (
      previous.online !== current.online ||
      previous.queueSize !== current.queueSize ||
      previous.errors !== current.errors ||
      previous.conflicts !== current.conflicts
    );
  }

  /**
   * Notify event listeners
   */
  private notifyEventListeners(event: SyncEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (error) {
          console.warn(`[SyncStatusMonitor] Event listener failed for ${event.type}:`, error);
        }
      }
    }
  }

  /**
   * Notify status change listeners
   */
  private notifyStatusChangeListeners(status: SyncStatus): void {
    for (const listener of this.statusChangeListeners) {
      try {
        listener(status);
      } catch (error) {
        console.warn('[SyncStatusMonitor] Status change listener failed:', error);
      }
    }
  }

  /**
   * Notify health change listeners
   */
  private notifyHealthChangeListeners(health: SyncHealthCheck): void {
    for (const listener of this.healthChangeListeners) {
      try {
        listener(health);
      } catch (error) {
        console.warn('[SyncStatusMonitor] Health change listener failed:', error);
      }
    }
  }

  /**
   * Update statistics calculations
   */
  private updateStatsCalculations(): void {
    this.stats.monitoringUptime = this.isMonitoring ? Date.now() - this.startTime : 0;
    this.stats.lastUpdated = new Date().toISOString();
  }

  /**
   * Initialize monitoring statistics
   */
  private initializeStats(): SyncMonitorStats {
    return {
      totalEvents: 0,
      eventsByType: {
        sync_started: 0,
        sync_completed: 0,
        sync_failed: 0,
        conflict_detected: 0,
        conflict_resolved: 0,
        offline_detected: 0,
        connection_restored: 0,
      },
      healthChecks: 0,
      notificationsSent: 0,
      averageHealthScore: 0,
      monitoringUptime: 0,
      lastUpdated: new Date().toISOString(),
    };
  }
}
