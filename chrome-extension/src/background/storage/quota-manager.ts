/**
 * Quota manager for storage quota monitoring and cleanup coordination
 * Implements intelligent cleanup strategies and user notifications
 */

/**
 * Storage quota information
 */
export interface StorageQuotaInfo {
  /** Total available storage in bytes */
  quota: number;
  /** Currently used storage in bytes */
  usage: number;
  /** Available storage in bytes */
  available: number;
  /** Usage percentage */
  usagePercent: number;
  /** Storage breakdown by type */
  breakdown: {
    meetings: number;
    transcriptions: number;
    cache: number;
    config: number;
    temp: number;
    other: number;
  };
  /** Last updated timestamp */
  lastUpdated: string;
}

/**
 * Cleanup strategy configuration
 */
export interface CleanupStrategy {
  /** Strategy identifier */
  id: string;
  /** Strategy name */
  name: string;
  /** Strategy description */
  description: string;
  /** Trigger threshold percentage */
  triggerThreshold: number;
  /** Target reduction percentage */
  targetReduction: number;
  /** Strategy priority (higher = executed first) */
  priority: number;
  /** Whether strategy is enabled */
  enabled: boolean;
  /** Cleanup function */
  execute: (quotaInfo: StorageQuotaInfo) => Promise<CleanupResult>;
}

/**
 * Cleanup operation result
 */
export interface CleanupResult {
  /** Whether cleanup was successful */
  success: boolean;
  /** Amount of storage freed in bytes */
  bytesFreed: number;
  /** Number of items cleaned */
  itemsCleaned: number;
  /** Cleanup duration in milliseconds */
  duration: number;
  /** Cleanup details */
  details: {
    /** Items cleaned by category */
    categories: Record<string, number>;
    /** Errors encountered */
    errors: string[];
    /** Warnings generated */
    warnings: string[];
  };
  /** Cleanup timestamp */
  timestamp: string;
}

/**
 * Quota threshold configuration
 */
export interface QuotaThresholds {
  /** Warning threshold percentage */
  warning: number;
  /** Critical threshold percentage */
  critical: number;
  /** Emergency cleanup threshold percentage */
  emergency: number;
  /** Aggressive cleanup threshold percentage */
  aggressive: number;
}

/**
 * User notification configuration
 */
export interface NotificationConfig {
  /** Enable quota notifications */
  enabled: boolean;
  /** Show warning notifications */
  showWarnings: boolean;
  /** Show critical notifications */
  showCritical: boolean;
  /** Show cleanup completion notifications */
  showCleanupResults: boolean;
  /** Notification display duration in milliseconds */
  displayDuration: number;
  /** Minimum time between notifications */
  cooldownPeriod: number;
}

/**
 * Quota monitoring statistics
 */
export interface QuotaStats {
  /** Total cleanup operations performed */
  totalCleanups: number;
  /** Successful cleanups */
  successfulCleanups: number;
  /** Failed cleanups */
  failedCleanups: number;
  /** Total bytes freed */
  totalBytesFreed: number;
  /** Total items cleaned */
  totalItemsCleaned: number;
  /** Average cleanup duration */
  avgCleanupDuration: number;
  /** Cleanup operations by strategy */
  cleanupsByStrategy: Record<string, number>;
  /** Quota violations */
  quotaViolations: number;
  /** Last cleanup timestamp */
  lastCleanup?: string;
  /** Statistics update timestamp */
  lastUpdated: string;
}

/**
 * Quota manager for intelligent storage management
 */
export class QuotaManager {
  private thresholds: QuotaThresholds;
  private notificationConfig: NotificationConfig;
  private cleanupStrategies = new Map<string, CleanupStrategy>();
  private stats: QuotaStats;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastNotification = new Map<string, number>();
  private cleanupInProgress = false;

  constructor(thresholds: QuotaThresholds, notificationConfig: NotificationConfig) {
    this.thresholds = thresholds;
    this.notificationConfig = notificationConfig;
    this.stats = this.initializeStats();

    this.setupDefaultCleanupStrategies();
    this.startQuotaMonitoring();
  }

  /**
   * Get current storage quota information
   */
  async getQuotaInfo(): Promise<StorageQuotaInfo> {
    try {
      // Get Chrome storage usage
      const localUsage = await this.getStorageUsage('local');
      const syncUsage = await this.getStorageUsage('sync');
      const sessionUsage = await this.getStorageUsage('session');

      // Estimate quotas (Chrome storage limits)
      const localQuota = 10 * 1024 * 1024; // 10MB for local storage (estimate)
      const syncQuota = 100 * 1024; // 100KB for sync storage
      const sessionQuota = 10 * 1024 * 1024; // 10MB for session storage (estimate)

      const totalUsage = localUsage + syncUsage + sessionUsage;
      const totalQuota = localQuota + syncQuota + sessionQuota;

      // Get storage breakdown
      const breakdown = await this.getStorageBreakdown();

      const quotaInfo: StorageQuotaInfo = {
        quota: totalQuota,
        usage: totalUsage,
        available: totalQuota - totalUsage,
        usagePercent: (totalUsage / totalQuota) * 100,
        breakdown,
        lastUpdated: new Date().toISOString(),
      };

      return quotaInfo;
    } catch (error) {
      console.error('[QuotaManager] Failed to get quota info:', error);

      // Return default quota info on error
      return {
        quota: 10 * 1024 * 1024,
        usage: 0,
        available: 10 * 1024 * 1024,
        usagePercent: 0,
        breakdown: {
          meetings: 0,
          transcriptions: 0,
          cache: 0,
          config: 0,
          temp: 0,
          other: 0,
        },
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  /**
   * Perform quota check and cleanup if needed
   */
  async checkQuotaAndCleanup(): Promise<boolean> {
    if (this.cleanupInProgress) {
      console.log('[QuotaManager] Cleanup already in progress, skipping');
      return false;
    }

    try {
      const quotaInfo = await this.getQuotaInfo();

      console.log(
        `[QuotaManager] Quota check: ${quotaInfo.usagePercent.toFixed(1)}% used (${quotaInfo.usage}/${quotaInfo.quota} bytes)`,
      );

      // Check thresholds and trigger appropriate actions
      if (quotaInfo.usagePercent >= this.thresholds.emergency) {
        await this.handleEmergencyCleanup(quotaInfo);
        return true;
      } else if (quotaInfo.usagePercent >= this.thresholds.aggressive) {
        await this.handleAggressiveCleanup(quotaInfo);
        return true;
      } else if (quotaInfo.usagePercent >= this.thresholds.critical) {
        await this.handleCriticalCleanup(quotaInfo);
        await this.sendNotification('critical', quotaInfo);
        return true;
      } else if (quotaInfo.usagePercent >= this.thresholds.warning) {
        await this.sendNotification('warning', quotaInfo);
        return false;
      }

      return false;
    } catch (error) {
      console.error('[QuotaManager] Quota check failed:', error);
      return false;
    }
  }

  /**
   * Force cleanup using specified strategies
   */
  async forceCleanup(strategyIds?: string[]): Promise<CleanupResult> {
    if (this.cleanupInProgress) {
      throw new Error('Cleanup already in progress');
    }

    this.cleanupInProgress = true;

    try {
      console.log('[QuotaManager] Starting forced cleanup');

      const quotaInfo = await this.getQuotaInfo();
      const strategies = strategyIds
        ? (strategyIds.map(id => this.cleanupStrategies.get(id)).filter(Boolean) as CleanupStrategy[])
        : Array.from(this.cleanupStrategies.values()).filter(s => s.enabled);

      const totalResult = await this.executeCleanupStrategies(strategies, quotaInfo);

      // Update statistics
      this.updateCleanupStats(totalResult);

      // Send notification if enabled
      if (this.notificationConfig.showCleanupResults) {
        await this.sendCleanupNotification(totalResult);
      }

      console.log(`[QuotaManager] Forced cleanup completed: ${totalResult.bytesFreed} bytes freed`);

      return totalResult;
    } finally {
      this.cleanupInProgress = false;
    }
  }

  /**
   * Register cleanup strategy
   */
  registerCleanupStrategy(strategy: CleanupStrategy): void {
    this.cleanupStrategies.set(strategy.id, strategy);
    console.log(`[QuotaManager] Cleanup strategy registered: ${strategy.id}`);
  }

  /**
   * Remove cleanup strategy
   */
  removeCleanupStrategy(strategyId: string): void {
    this.cleanupStrategies.delete(strategyId);
    console.log(`[QuotaManager] Cleanup strategy removed: ${strategyId}`);
  }

  /**
   * Update quota thresholds
   */
  updateThresholds(thresholds: Partial<QuotaThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
    console.log('[QuotaManager] Quota thresholds updated');
  }

  /**
   * Update notification configuration
   */
  updateNotificationConfig(config: Partial<NotificationConfig>): void {
    this.notificationConfig = { ...this.notificationConfig, ...config };
    console.log('[QuotaManager] Notification configuration updated');
  }

  /**
   * Get quota management statistics
   */
  getStats(): QuotaStats {
    this.stats.lastUpdated = new Date().toISOString();
    return { ...this.stats };
  }

  /**
   * Get available cleanup strategies
   */
  getCleanupStrategies(): CleanupStrategy[] {
    return Array.from(this.cleanupStrategies.values());
  }

  /**
   * Estimate cleanup impact for strategies
   */
  async estimateCleanupImpact(strategyIds: string[]): Promise<{
    estimatedBytesFreed: number;
    estimatedItemsAffected: number;
    riskLevel: 'low' | 'medium' | 'high';
    warnings: string[];
  }> {
    const quotaInfo = await this.getQuotaInfo();
    let estimatedBytesFreed = 0;
    let estimatedItemsAffected = 0;
    const warnings: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    for (const strategyId of strategyIds) {
      const strategy = this.cleanupStrategies.get(strategyId);
      if (!strategy) continue;

      // Estimate based on strategy type and current usage
      const estimate = this.estimateStrategyImpact(strategy, quotaInfo);
      estimatedBytesFreed += estimate.bytes;
      estimatedItemsAffected += estimate.items;

      if (estimate.risk === 'high') {
        riskLevel = 'high';
        warnings.push(`Strategy ${strategy.name} has high risk of data loss`);
      } else if (estimate.risk === 'medium' && riskLevel === 'low') {
        riskLevel = 'medium';
      }
    }

    return {
      estimatedBytesFreed,
      estimatedItemsAffected,
      riskLevel,
      warnings,
    };
  }

  /**
   * Start quota monitoring
   */
  startQuotaMonitoring(intervalMs: number = 300000): void {
    // Default 5 minutes
    if (this.monitoringInterval) {
      return;
    }

    this.monitoringInterval = setInterval(async () => {
      await this.checkQuotaAndCleanup();
    }, intervalMs);

    console.log('[QuotaManager] Quota monitoring started');
  }

  /**
   * Stop quota monitoring
   */
  stopQuotaMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('[QuotaManager] Quota monitoring stopped');
    }
  }

  /**
   * Shutdown quota manager
   */
  async shutdown(): Promise<void> {
    console.log('[QuotaManager] Shutting down');

    this.stopQuotaMonitoring();

    // Wait for any ongoing cleanup to complete
    while (this.cleanupInProgress) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.cleanupStrategies.clear();
    this.lastNotification.clear();

    console.log('[QuotaManager] Shutdown completed');
  }

  /**
   * Get storage usage for specific Chrome storage area
   */
  private async getStorageUsage(area: 'local' | 'sync' | 'session'): Promise<number> {
    try {
      const result = await chrome.storage[area].getBytesInUse();
      return result;
    } catch (error) {
      console.warn(`[QuotaManager] Failed to get ${area} storage usage:`, error);
      return 0;
    }
  }

  /**
   * Get detailed storage breakdown by category
   */
  private async getStorageBreakdown(): Promise<StorageQuotaInfo['breakdown']> {
    try {
      // Get all storage keys
      const localData = await chrome.storage.local.get();
      const syncData = await chrome.storage.sync.get();
      const sessionData = await chrome.storage.session.get();

      const breakdown = {
        meetings: 0,
        transcriptions: 0,
        cache: 0,
        config: 0,
        temp: 0,
        other: 0,
      };

      // Categorize storage usage
      const categorizeKey = (key: string, data: unknown): keyof typeof breakdown => {
        const _size = JSON.stringify(data).length;

        if (key.includes('meeting')) return 'meetings';
        if (key.includes('transcription')) return 'transcriptions';
        if (key.includes('cache')) return 'cache';
        if (key.includes('config') || key.includes('settings')) return 'config';
        if (key.includes('temp') || key.includes('tmp')) return 'temp';
        return 'other';
      };

      // Categorize local storage
      for (const [key, data] of Object.entries(localData)) {
        const category = categorizeKey(key, data);
        breakdown[category] += JSON.stringify(data).length;
      }

      // Categorize sync storage
      for (const [key, data] of Object.entries(syncData)) {
        const category = categorizeKey(key, data);
        breakdown[category] += JSON.stringify(data).length;
      }

      // Categorize session storage
      for (const [key, data] of Object.entries(sessionData)) {
        const category = categorizeKey(key, data);
        breakdown[category] += JSON.stringify(data).length;
      }

      return breakdown;
    } catch (error) {
      console.error('[QuotaManager] Failed to get storage breakdown:', error);
      return {
        meetings: 0,
        transcriptions: 0,
        cache: 0,
        config: 0,
        temp: 0,
        other: 0,
      };
    }
  }

  /**
   * Handle emergency cleanup (>95% usage)
   */
  private async handleEmergencyCleanup(quotaInfo: StorageQuotaInfo): Promise<void> {
    console.warn('[QuotaManager] Emergency cleanup triggered');

    this.stats.quotaViolations++;

    // Execute most aggressive strategies first
    const emergencyStrategies = Array.from(this.cleanupStrategies.values())
      .filter(s => s.enabled && s.priority >= 90)
      .sort((a, b) => b.priority - a.priority);

    if (emergencyStrategies.length > 0) {
      await this.executeCleanupStrategies(emergencyStrategies, quotaInfo);
    }

    await this.sendNotification('emergency', quotaInfo);
  }

  /**
   * Handle aggressive cleanup (>90% usage)
   */
  private async handleAggressiveCleanup(quotaInfo: StorageQuotaInfo): Promise<void> {
    console.warn('[QuotaManager] Aggressive cleanup triggered');

    const aggressiveStrategies = Array.from(this.cleanupStrategies.values())
      .filter(s => s.enabled && s.priority >= 70)
      .sort((a, b) => b.priority - a.priority);

    if (aggressiveStrategies.length > 0) {
      await this.executeCleanupStrategies(aggressiveStrategies, quotaInfo);
    }
  }

  /**
   * Handle critical cleanup (>80% usage)
   */
  private async handleCriticalCleanup(quotaInfo: StorageQuotaInfo): Promise<void> {
    console.warn('[QuotaManager] Critical cleanup triggered');

    const criticalStrategies = Array.from(this.cleanupStrategies.values())
      .filter(s => s.enabled && s.priority >= 50)
      .sort((a, b) => b.priority - a.priority);

    if (criticalStrategies.length > 0) {
      await this.executeCleanupStrategies(criticalStrategies, quotaInfo);
    }
  }

  /**
   * Execute cleanup strategies
   */
  private async executeCleanupStrategies(
    strategies: CleanupStrategy[],
    quotaInfo: StorageQuotaInfo,
  ): Promise<CleanupResult> {
    const totalResult: CleanupResult = {
      success: true,
      bytesFreed: 0,
      itemsCleaned: 0,
      duration: 0,
      details: {
        categories: {},
        errors: [],
        warnings: [],
      },
      timestamp: new Date().toISOString(),
    };

    const startTime = Date.now();

    for (const strategy of strategies) {
      try {
        console.log(`[QuotaManager] Executing cleanup strategy: ${strategy.name}`);

        const strategyResult = await strategy.execute(quotaInfo);

        totalResult.bytesFreed += strategyResult.bytesFreed;
        totalResult.itemsCleaned += strategyResult.itemsCleaned;
        totalResult.details.errors.push(...strategyResult.details.errors);
        totalResult.details.warnings.push(...strategyResult.details.warnings);

        // Merge categories
        for (const [category, count] of Object.entries(strategyResult.details.categories)) {
          totalResult.details.categories[category] = (totalResult.details.categories[category] || 0) + count;
        }

        if (!strategyResult.success) {
          totalResult.success = false;
          totalResult.details.errors.push(`Strategy ${strategy.name} failed`);
        }

        this.stats.cleanupsByStrategy[strategy.id] = (this.stats.cleanupsByStrategy[strategy.id] || 0) + 1;

        console.log(`[QuotaManager] Strategy ${strategy.name} freed ${strategyResult.bytesFreed} bytes`);
      } catch (error) {
        console.error(`[QuotaManager] Strategy ${strategy.name} failed:`, error);
        totalResult.success = false;
        totalResult.details.errors.push(
          `Strategy ${strategy.name} error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    totalResult.duration = Date.now() - startTime;

    return totalResult;
  }

  /**
   * Send user notification
   */
  private async sendNotification(
    type: 'warning' | 'critical' | 'emergency',
    quotaInfo: StorageQuotaInfo,
  ): Promise<void> {
    if (!this.notificationConfig.enabled) return;

    // Check cooldown period
    const lastNotificationTime = this.lastNotification.get(type) || 0;
    const now = Date.now();

    if (now - lastNotificationTime < this.notificationConfig.cooldownPeriod) {
      return;
    }

    // Check if this notification type is enabled
    if (type === 'warning' && !this.notificationConfig.showWarnings) return;
    if (type === 'critical' && !this.notificationConfig.showCritical) return;

    try {
      let title: string;
      let message: string;

      switch (type) {
        case 'warning':
          title = 'Storage Usage Warning';
          message = `Storage is ${quotaInfo.usagePercent.toFixed(1)}% full. Consider cleaning up old data.`;
          break;

        case 'critical':
          title = 'Storage Usage Critical';
          message = `Storage is ${quotaInfo.usagePercent.toFixed(1)}% full. Automatic cleanup has been triggered.`;
          break;

        case 'emergency':
          title = 'Storage Emergency';
          message = `Storage is ${quotaInfo.usagePercent.toFixed(1)}% full. Emergency cleanup in progress.`;
          break;
      }

      // Create Chrome notification
      if (chrome.notifications) {
        await chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon-48.png'),
          title,
          message,
        });
      }

      this.lastNotification.set(type, now);

      console.log(`[QuotaManager] Notification sent: ${type}`);
    } catch (error) {
      console.error('[QuotaManager] Failed to send notification:', error);
    }
  }

  /**
   * Send cleanup completion notification
   */
  private async sendCleanupNotification(result: CleanupResult): Promise<void> {
    if (!this.notificationConfig.showCleanupResults) return;

    try {
      const bytesFreedMB = (result.bytesFreed / (1024 * 1024)).toFixed(1);

      const message = result.success
        ? `Cleanup completed: ${bytesFreedMB}MB freed, ${result.itemsCleaned} items cleaned`
        : `Cleanup completed with errors: ${bytesFreedMB}MB freed`;

      if (chrome.notifications) {
        await chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon-48.png'),
          title: 'Storage Cleanup Complete',
          message,
        });
      }
    } catch (error) {
      console.error('[QuotaManager] Failed to send cleanup notification:', error);
    }
  }

  /**
   * Estimate impact of a cleanup strategy
   */
  private estimateStrategyImpact(
    strategy: CleanupStrategy,
    quotaInfo: StorageQuotaInfo,
  ): { bytes: number; items: number; risk: 'low' | 'medium' | 'high' } {
    // This is a simplified estimation
    // In reality, you'd analyze actual data to provide accurate estimates

    let estimatedBytes = 0;
    let estimatedItems = 0;
    let risk: 'low' | 'medium' | 'high' = 'low';

    switch (strategy.id) {
      case 'clear-temp-cache':
        estimatedBytes = quotaInfo.breakdown.temp + quotaInfo.breakdown.cache;
        estimatedItems = 50; // Estimated number of temp/cache items
        risk = 'low';
        break;

      case 'cleanup-old-transcriptions':
        estimatedBytes = quotaInfo.breakdown.transcriptions * 0.5; // 50% of transcriptions
        estimatedItems = 10; // Estimated old transcriptions
        risk = 'medium';
        break;

      case 'cleanup-old-meetings':
        estimatedBytes = quotaInfo.breakdown.meetings * 0.3; // 30% of meetings
        estimatedItems = 5; // Estimated old meetings
        risk = 'high';
        break;

      default:
        estimatedBytes = quotaInfo.usage * 0.1; // 10% of total usage
        estimatedItems = 5;
        risk = 'medium';
    }

    return {
      bytes: Math.floor(estimatedBytes),
      items: estimatedItems,
      risk,
    };
  }

  /**
   * Setup default cleanup strategies
   */
  private setupDefaultCleanupStrategies(): void {
    // Clear temporary cache strategy
    this.registerCleanupStrategy({
      id: 'clear-temp-cache',
      name: 'Clear Temporary Cache',
      description: 'Removes temporary cache and session data',
      triggerThreshold: 70,
      targetReduction: 10,
      priority: 90,
      enabled: true,
      execute: async _quotaInfo => {
        const startTime = Date.now();
        let bytesFreed = 0;
        let itemsCleaned = 0;
        const errors: string[] = [];

        try {
          // Clear session storage
          const sessionData = await chrome.storage.session.get();
          const tempKeys = Object.keys(sessionData).filter(
            key => key.includes('temp') || key.includes('cache') || key.includes('tmp'),
          );

          for (const key of tempKeys) {
            bytesFreed += JSON.stringify(sessionData[key]).length;
          }

          if (tempKeys.length > 0) {
            await chrome.storage.session.remove(tempKeys);
            itemsCleaned = tempKeys.length;
          }
        } catch (error) {
          errors.push(`Failed to clear temp cache: ${error instanceof Error ? error.message : String(error)}`);
        }

        return {
          success: errors.length === 0,
          bytesFreed,
          itemsCleaned,
          duration: Date.now() - startTime,
          details: {
            categories: { temp: itemsCleaned },
            errors,
            warnings: [],
          },
          timestamp: new Date().toISOString(),
        };
      },
    });

    // Cleanup old transcriptions strategy
    this.registerCleanupStrategy({
      id: 'cleanup-old-transcriptions',
      name: 'Cleanup Old Transcriptions',
      description: 'Removes transcriptions older than 30 days',
      triggerThreshold: 80,
      targetReduction: 20,
      priority: 70,
      enabled: true,
      execute: async _quotaInfo => {
        const startTime = Date.now();
        let bytesFreed = 0;
        let itemsCleaned = 0;
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
          const localData = await chrome.storage.local.get();
          const oldTranscriptions: string[] = [];
          const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

          for (const [key, data] of Object.entries(localData)) {
            if (key.includes('transcription') && typeof data === 'object' && data !== null) {
              const transcriptionData = data as { createdAt?: string; timestamp?: string };
              const createdAt = new Date(transcriptionData.createdAt || transcriptionData.timestamp || 0).getTime();

              if (createdAt < thirtyDaysAgo) {
                oldTranscriptions.push(key);
                bytesFreed += JSON.stringify(data).length;
              }
            }
          }

          if (oldTranscriptions.length > 0) {
            await chrome.storage.local.remove(oldTranscriptions);
            itemsCleaned = oldTranscriptions.length;
            warnings.push(`Removed ${oldTranscriptions.length} old transcriptions`);
          }
        } catch (error) {
          errors.push(
            `Failed to cleanup old transcriptions: ${error instanceof Error ? error.message : String(error)}`,
          );
        }

        return {
          success: errors.length === 0,
          bytesFreed,
          itemsCleaned,
          duration: Date.now() - startTime,
          details: {
            categories: { transcriptions: itemsCleaned },
            errors,
            warnings,
          },
          timestamp: new Date().toISOString(),
        };
      },
    });

    // Cleanup old meetings strategy (high risk)
    this.registerCleanupStrategy({
      id: 'cleanup-old-meetings',
      name: 'Cleanup Old Meetings',
      description: 'Removes meeting data older than 60 days (high risk)',
      triggerThreshold: 95,
      targetReduction: 30,
      priority: 50,
      enabled: false, // Disabled by default due to high risk
      execute: async _quotaInfo => {
        const startTime = Date.now();
        let bytesFreed = 0;
        let itemsCleaned = 0;
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
          const localData = await chrome.storage.local.get();
          const oldMeetings: string[] = [];
          const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000;

          for (const [key, data] of Object.entries(localData)) {
            if (key.includes('meeting') && typeof data === 'object' && data !== null) {
              const meetingData = data as { createdAt?: string; timestamp?: string };
              const createdAt = new Date(meetingData.createdAt || meetingData.timestamp || 0).getTime();

              if (createdAt < sixtyDaysAgo) {
                oldMeetings.push(key);
                bytesFreed += JSON.stringify(data).length;
              }
            }
          }

          if (oldMeetings.length > 0) {
            await chrome.storage.local.remove(oldMeetings);
            itemsCleaned = oldMeetings.length;
            warnings.push(`Removed ${oldMeetings.length} old meetings (HIGH RISK)`);
          }
        } catch (error) {
          errors.push(`Failed to cleanup old meetings: ${error instanceof Error ? error.message : String(error)}`);
        }

        return {
          success: errors.length === 0,
          bytesFreed,
          itemsCleaned,
          duration: Date.now() - startTime,
          details: {
            categories: { meetings: itemsCleaned },
            errors,
            warnings,
          },
          timestamp: new Date().toISOString(),
        };
      },
    });
  }

  /**
   * Update cleanup statistics
   */
  private updateCleanupStats(result: CleanupResult): void {
    this.stats.totalCleanups++;

    if (result.success) {
      this.stats.successfulCleanups++;
    } else {
      this.stats.failedCleanups++;
    }

    this.stats.totalBytesFreed += result.bytesFreed;
    this.stats.totalItemsCleaned += result.itemsCleaned;

    // Update average cleanup duration
    this.stats.avgCleanupDuration =
      (this.stats.avgCleanupDuration * (this.stats.totalCleanups - 1) + result.duration) / this.stats.totalCleanups;

    this.stats.lastCleanup = result.timestamp;
  }

  /**
   * Initialize quota statistics
   */
  private initializeStats(): QuotaStats {
    return {
      totalCleanups: 0,
      successfulCleanups: 0,
      failedCleanups: 0,
      totalBytesFreed: 0,
      totalItemsCleaned: 0,
      avgCleanupDuration: 0,
      cleanupsByStrategy: {},
      quotaViolations: 0,
      lastUpdated: new Date().toISOString(),
    };
  }
}
