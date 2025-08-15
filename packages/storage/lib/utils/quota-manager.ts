/**
 * Storage quota management with intelligent cleanup and recommendations
 * Implements quota monitoring, cleanup strategies, and storage optimization
 */

/**
 * Storage type for quota management
 */
export type StorageType = 'local' | 'sync' | 'session' | 'memory';

/**
 * Quota status levels
 */
export type QuotaStatus = 'healthy' | 'warning' | 'critical' | 'exceeded' | 'unknown';

/**
 * Cleanup strategy types
 */
export type CleanupStrategy = 'lru' | 'size_based' | 'age_based' | 'priority_based' | 'smart';

/**
 * Storage quota information
 */
export interface StorageQuotaInfo {
  /** Storage type */
  storageType: StorageType;
  /** Used bytes */
  usedBytes: number;
  /** Available bytes */
  availableBytes: number;
  /** Total quota bytes */
  totalQuota: number;
  /** Usage percentage */
  usagePercentage: number;
  /** Quota status */
  status: QuotaStatus;
  /** Items count */
  itemsCount: number;
  /** Average item size */
  averageItemSize: number;
  /** Largest item size */
  largestItemSize: number;
  /** Growth rate (bytes per hour) */
  growthRate: number;
  /** Estimated time until full */
  timeUntilFull?: number | undefined;
  /** Last updated timestamp */
  lastUpdated: string;
}

/**
 * Cleanup recommendation
 */
export interface CleanupRecommendation {
  /** Recommendation ID */
  id: string;
  /** Cleanup strategy */
  strategy: CleanupStrategy;
  /** Target storage type */
  storageType: StorageType;
  /** Estimated bytes to free */
  estimatedBytesFreed: number;
  /** Items to remove count */
  itemsToRemove: number;
  /** Cleanup priority */
  priority: 'low' | 'medium' | 'high' | 'urgent';
  /** Recommendation title */
  title: string;
  /** Detailed description */
  description: string;
  /** Risk assessment */
  risk: {
    /** Risk level */
    level: 'low' | 'medium' | 'high';
    /** Risk description */
    description: string;
    /** Reversible operation */
    reversible: boolean;
  };
  /** Keys affected by cleanup */
  affectedKeys: string[];
  /** Estimated cleanup duration */
  estimatedDuration: number;
  /** Created timestamp */
  createdAt: string;
}

/**
 * Cleanup execution result
 */
export interface CleanupResult {
  /** Cleanup recommendation ID */
  recommendationId: string;
  /** Whether cleanup succeeded */
  success: boolean;
  /** Bytes actually freed */
  bytesFreed: number;
  /** Items actually removed */
  itemsRemoved: number;
  /** Cleanup duration */
  duration: number;
  /** Keys that were removed */
  removedKeys: string[];
  /** Error message if failed */
  error?: string;
  /** Cleanup timestamp */
  executedAt: string;
}

/**
 * Storage item metadata for quota management
 */
export interface StorageItemMetadata {
  /** Item key */
  key: string;
  /** Item size in bytes */
  size: number;
  /** Last accessed timestamp */
  lastAccessed: string;
  /** Created timestamp */
  createdAt: string;
  /** Access count */
  accessCount: number;
  /** Item priority */
  priority: 'low' | 'normal' | 'high' | 'critical';
  /** Item type/category */
  category: string;
  /** TTL (time to live) in milliseconds */
  ttl?: number;
  /** Whether item is compressed */
  compressed: boolean;
  /** Whether item can be cleaned up */
  cleanupAllowed: boolean;
}

/**
 * Quota manager configuration
 */
export interface QuotaManagerConfig {
  /** Monitoring settings */
  monitoring: {
    /** Enable quota monitoring */
    enabled: boolean;
    /** Check interval in milliseconds */
    checkInterval: number;
    /** Enable growth tracking */
    trackGrowth: boolean;
    /** Growth calculation window (hours) */
    growthWindow: number;
  };
  /** Warning thresholds */
  thresholds: {
    /** Warning threshold percentage */
    warning: number;
    /** Critical threshold percentage */
    critical: number;
    /** Growth rate warning (bytes/hour) */
    growthWarning: number;
  };
  /** Cleanup settings */
  cleanup: {
    /** Enable automatic cleanup */
    enableAutoCleanup: boolean;
    /** Auto-cleanup threshold */
    autoCleanupThreshold: number;
    /** Default cleanup strategy */
    defaultStrategy: CleanupStrategy;
    /** Cleanup batch size */
    batchSize: number;
    /** Safety margin (bytes to keep free) */
    safetyMargin: number;
  };
  /** Storage type specific limits */
  limits: Record<
    StorageType,
    {
      /** Maximum total bytes */
      maxBytes: number;
      /** Maximum items count */
      maxItems: number;
      /** Maximum bytes per item */
      maxBytesPerItem: number;
    }
  >;
  /** Optimization settings */
  optimization: {
    /** Enable compression recommendations */
    enableCompressionRecommendations: boolean;
    /** Enable storage migration recommendations */
    enableMigrationRecommendations: boolean;
    /** Minimum item size for compression */
    compressionThreshold: number;
  };
}

/**
 * Quota manager statistics
 */
export interface QuotaManagerStats {
  /** Total cleanups performed */
  totalCleanups: number;
  /** Total bytes freed */
  totalBytesFreed: number;
  /** Total items removed */
  totalItemsRemoved: number;
  /** Cleanup success rate */
  cleanupSuccessRate: number;
  /** Average bytes freed per cleanup */
  averageBytesFreedPerCleanup: number;
  /** Cleanups by strategy */
  cleanupsByStrategy: Record<CleanupStrategy, number>;
  /** Warning events count */
  warningEvents: number;
  /** Critical events count */
  criticalEvents: number;
  /** Auto-cleanups performed */
  autoCleanups: number;
  /** Manual cleanups performed */
  manualCleanups: number;
  /** Last cleanup timestamp */
  lastCleanup?: string;
  /** Statistics timestamp */
  lastUpdated: string;
}

/**
 * Storage growth tracking data
 */
interface GrowthDataPoint {
  /** Timestamp */
  timestamp: string;
  /** Used bytes at this time */
  usedBytes: number;
  /** Items count at this time */
  itemsCount: number;
}

/**
 * Storage quota manager with intelligent cleanup
 */
export class StorageQuotaManager {
  private config: QuotaManagerConfig;
  private stats: QuotaManagerStats;
  private growthHistory: Map<StorageType, GrowthDataPoint[]> = new Map();
  private itemMetadataCache: Map<string, StorageItemMetadata> = new Map();
  private monitoringTimer: NodeJS.Timeout | null = null;
  private lastQuotaCheck: Map<StorageType, StorageQuotaInfo> = new Map();

  // Event listeners
  private quotaListeners = new Set<(info: StorageQuotaInfo) => void>();
  private cleanupListeners = new Set<(result: CleanupResult) => void>();
  private recommendationListeners = new Set<(recommendation: CleanupRecommendation) => void>();

  constructor(config: Partial<QuotaManagerConfig> = {}) {
    this.config = {
      monitoring: {
        enabled: config.monitoring?.enabled !== false,
        checkInterval: config.monitoring?.checkInterval || 300000, // 5 minutes
        trackGrowth: config.monitoring?.trackGrowth !== false,
        growthWindow: config.monitoring?.growthWindow || 24, // 24 hours
        ...config.monitoring,
      },
      thresholds: {
        warning: 75, // 75%
        critical: 90, // 90%
        growthWarning: 1024 * 1024, // 1MB/hour
        ...config.thresholds,
      },
      cleanup: {
        enableAutoCleanup: config.cleanup?.enableAutoCleanup !== false,
        autoCleanupThreshold: 85, // 85%
        defaultStrategy: 'smart',
        batchSize: 50,
        safetyMargin: 1024 * 1024, // 1MB
        ...config.cleanup,
      },
      limits: {
        local: {
          maxBytes: 10 * 1024 * 1024, // 10MB
          maxItems: 1000,
          maxBytesPerItem: 1024 * 1024, // 1MB
        },
        sync: {
          maxBytes: 100 * 1024, // 100KB
          maxItems: 512,
          maxBytesPerItem: 8 * 1024, // 8KB
        },
        session: {
          maxBytes: 10 * 1024 * 1024, // 10MB
          maxItems: 1000,
          maxBytesPerItem: 1024 * 1024, // 1MB
        },
        memory: {
          maxBytes: 50 * 1024 * 1024, // 50MB
          maxItems: 2000,
          maxBytesPerItem: 5 * 1024 * 1024, // 5MB
        },
        ...config.limits,
      },
      optimization: {
        enableCompressionRecommendations: true,
        enableMigrationRecommendations: true,
        compressionThreshold: 1024, // 1KB
        ...config.optimization,
      },
    };

    this.stats = this.initializeStats();

    if (this.config.monitoring.enabled) {
      this.startMonitoring();
    }
  }

  /**
   * Get quota information for storage type
   */
  async getQuotaInfo(storageType: StorageType): Promise<StorageQuotaInfo> {
    try {
      let usedBytes = 0;
      let itemsCount = 0;
      let largestItemSize = 0;

      switch (storageType) {
        case 'local': {
          const data = await chrome.storage.local.get();
          usedBytes = await chrome.storage.local.getBytesInUse();
          itemsCount = Object.keys(data).length;
          largestItemSize = this.findLargestItemSize(data);
          break;
        }
        case 'sync': {
          const data = await chrome.storage.sync.get();
          usedBytes = await chrome.storage.sync.getBytesInUse();
          itemsCount = Object.keys(data).length;
          largestItemSize = this.findLargestItemSize(data);
          break;
        }
        case 'session': {
          const data = await chrome.storage.session.get();
          usedBytes = await chrome.storage.session.getBytesInUse();
          itemsCount = Object.keys(data).length;
          largestItemSize = this.findLargestItemSize(data);
          break;
        }
        case 'memory': {
          // For in-memory storage, calculate from cache
          usedBytes = this.calculateMemoryUsage();
          itemsCount = this.itemMetadataCache.size;
          largestItemSize = this.findLargestCachedItemSize();
          break;
        }
      }

      const totalQuota = this.config.limits[storageType].maxBytes;
      const availableBytes = Math.max(0, totalQuota - usedBytes);
      const usagePercentage = (usedBytes / totalQuota) * 100;
      const status = this.determineQuotaStatus(usagePercentage);
      const averageItemSize = itemsCount > 0 ? usedBytes / itemsCount : 0;
      const growthRate = this.calculateGrowthRate(storageType);
      const timeUntilFull = this.estimateTimeUntilFull(usagePercentage, growthRate);

      const quotaInfo: StorageQuotaInfo = {
        storageType,
        usedBytes,
        availableBytes,
        totalQuota,
        usagePercentage,
        status,
        itemsCount,
        averageItemSize,
        largestItemSize,
        growthRate,
        timeUntilFull: timeUntilFull ?? undefined,
        lastUpdated: new Date().toISOString(),
      };

      // Update growth history
      if (this.config.monitoring.trackGrowth) {
        this.updateGrowthHistory(storageType, usedBytes, itemsCount);
      }

      // Store last check
      this.lastQuotaCheck.set(storageType, quotaInfo);

      // Notify listeners
      this.notifyQuotaListeners(quotaInfo);

      // Generate recommendations if needed
      if (status === 'warning' || status === 'critical') {
        const recommendations = await this.generateCleanupRecommendations(quotaInfo);
        for (const recommendation of recommendations) {
          this.notifyRecommendationListeners(recommendation);
        }

        // Auto-cleanup if enabled and threshold reached
        if (this.config.cleanup.enableAutoCleanup && usagePercentage >= this.config.cleanup.autoCleanupThreshold) {
          await this.performAutoCleanup(quotaInfo);
        }
      }

      return quotaInfo;
    } catch (error) {
      console.error(`[StorageQuotaManager] Failed to get quota info for ${storageType}:`, error);

      return {
        storageType,
        usedBytes: 0,
        availableBytes: 0,
        totalQuota: this.config.limits[storageType].maxBytes,
        usagePercentage: 0,
        status: 'unknown',
        itemsCount: 0,
        averageItemSize: 0,
        largestItemSize: 0,
        growthRate: 0,
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  /**
   * Generate cleanup recommendations
   */
  async generateCleanupRecommendations(quotaInfo: StorageQuotaInfo): Promise<CleanupRecommendation[]> {
    const recommendations: CleanupRecommendation[] = [];

    try {
      // Get storage data for analysis
      const storageData = await this.getStorageData(quotaInfo.storageType);
      const itemMetadata = await this.analyzeStorageItems(storageData);

      // LRU-based cleanup
      const lruRecommendation = this.generateLRURecommendation(quotaInfo, itemMetadata);
      if (lruRecommendation) recommendations.push(lruRecommendation);

      // Size-based cleanup
      const sizeRecommendation = this.generateSizeBasedRecommendation(quotaInfo, itemMetadata);
      if (sizeRecommendation) recommendations.push(sizeRecommendation);

      // Age-based cleanup
      const ageRecommendation = this.generateAgeBasedRecommendation(quotaInfo, itemMetadata);
      if (ageRecommendation) recommendations.push(ageRecommendation);

      // Priority-based cleanup
      const priorityRecommendation = this.generatePriorityBasedRecommendation(quotaInfo, itemMetadata);
      if (priorityRecommendation) recommendations.push(priorityRecommendation);

      // Smart cleanup (combination of strategies)
      const smartRecommendation = this.generateSmartRecommendation(quotaInfo, itemMetadata);
      if (smartRecommendation) recommendations.push(smartRecommendation);

      // Sort by priority and estimated effectiveness
      recommendations.sort((a, b) => {
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;

        return b.estimatedBytesFreed - a.estimatedBytesFreed;
      });

      return recommendations;
    } catch (error) {
      console.error('[StorageQuotaManager] Failed to generate cleanup recommendations:', error);
      return [];
    }
  }

  /**
   * Execute cleanup recommendation
   */
  async executeCleanup(recommendationId: string): Promise<CleanupResult> {
    const startTime = Date.now();

    try {
      // Find recommendation (this would be stored in a real implementation)
      const recommendation = await this.getRecommendation(recommendationId);
      if (!recommendation) {
        throw new Error(`Recommendation not found: ${recommendationId}`);
      }

      let bytesFreed = 0;
      const removedKeys: string[] = [];

      // Execute cleanup based on strategy
      for (const key of recommendation.affectedKeys) {
        try {
          // Get item size before removal
          const itemSize = await this.getItemSize(recommendation.storageType, key);

          // Remove the item
          await this.removeStorageItem(recommendation.storageType, key);

          bytesFreed += itemSize;
          removedKeys.push(key);
        } catch (error) {
          console.warn(`[StorageQuotaManager] Failed to remove ${key}:`, error);
        }
      }

      const result: CleanupResult = {
        recommendationId,
        success: removedKeys.length > 0,
        bytesFreed,
        itemsRemoved: removedKeys.length,
        duration: Date.now() - startTime,
        removedKeys,
        executedAt: new Date().toISOString(),
      };

      // Update statistics
      this.updateCleanupStats(result);

      // Notify listeners
      this.notifyCleanupListeners(result);

      console.log(
        `[StorageQuotaManager] Cleanup completed: ${bytesFreed} bytes freed, ${removedKeys.length} items removed`,
      );

      return result;
    } catch (error) {
      const result: CleanupResult = {
        recommendationId,
        success: false,
        bytesFreed: 0,
        itemsRemoved: 0,
        duration: Date.now() - startTime,
        removedKeys: [],
        error: error instanceof Error ? error.message : String(error),
        executedAt: new Date().toISOString(),
      };

      this.updateCleanupStats(result);
      return result;
    }
  }

  /**
   * Get quota manager statistics
   */
  getStats(): QuotaManagerStats {
    this.updateStatsCalculations();
    return { ...this.stats };
  }

  /**
   * Add quota change listener
   */
  onQuotaChange(listener: (info: StorageQuotaInfo) => void): void {
    this.quotaListeners.add(listener);
  }

  /**
   * Add cleanup completion listener
   */
  onCleanupComplete(listener: (result: CleanupResult) => void): void {
    this.cleanupListeners.add(listener);
  }

  /**
   * Add recommendation listener
   */
  onRecommendation(listener: (recommendation: CleanupRecommendation) => void): void {
    this.recommendationListeners.add(listener);
  }

  /**
   * Update quota manager configuration
   */
  updateConfig(config: Partial<QuotaManagerConfig>): void {
    const wasMonitoringEnabled = this.config.monitoring.enabled;
    this.config = { ...this.config, ...config };

    if (this.config.monitoring.enabled && !wasMonitoringEnabled) {
      this.startMonitoring();
    } else if (!this.config.monitoring.enabled && wasMonitoringEnabled) {
      this.stopMonitoring();
    }

    console.log('[StorageQuotaManager] Configuration updated');
  }

  /**
   * Force quota check for all storage types
   */
  async forceQuotaCheck(): Promise<StorageQuotaInfo[]> {
    const results: StorageQuotaInfo[] = [];
    const storageTypes: StorageType[] = ['local', 'sync', 'session', 'memory'];

    for (const storageType of storageTypes) {
      try {
        const info = await this.getQuotaInfo(storageType);
        results.push(info);
      } catch (error) {
        console.error(`[StorageQuotaManager] Failed to check ${storageType} quota:`, error);
      }
    }

    return results;
  }

  /**
   * Shutdown quota manager
   */
  async shutdown(): Promise<void> {
    console.log('[StorageQuotaManager] Shutting down');

    this.stopMonitoring();
    this.quotaListeners.clear();
    this.cleanupListeners.clear();
    this.recommendationListeners.clear();
    this.growthHistory.clear();
    this.itemMetadataCache.clear();
    this.lastQuotaCheck.clear();

    console.log('[StorageQuotaManager] Shutdown completed');
  }

  /**
   * Start monitoring timer
   */
  private startMonitoring(): void {
    if (this.monitoringTimer) return;

    this.monitoringTimer = setInterval(async () => {
      await this.forceQuotaCheck();
    }, this.config.monitoring.checkInterval);

    console.log(`[StorageQuotaManager] Monitoring started (${this.config.monitoring.checkInterval}ms)`);
  }

  /**
   * Stop monitoring timer
   */
  private stopMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
      console.log('[StorageQuotaManager] Monitoring stopped');
    }
  }

  /**
   * Determine quota status from usage percentage
   */
  private determineQuotaStatus(usagePercentage: number): QuotaStatus {
    if (usagePercentage >= 100) return 'exceeded';
    if (usagePercentage >= this.config.thresholds.critical) return 'critical';
    if (usagePercentage >= this.config.thresholds.warning) return 'warning';
    return 'healthy';
  }

  /**
   * Calculate growth rate for storage type
   */
  private calculateGrowthRate(storageType: StorageType): number {
    const history = this.growthHistory.get(storageType);
    if (!history || history.length < 2) return 0;

    const recent = history.slice(-2);
    const recent1 = recent[1];
    const recent0 = recent[0];
    if (!recent1 || !recent0) return 0;

    const timeDiff = new Date(recent1.timestamp).getTime() - new Date(recent0.timestamp).getTime();
    const sizeDiff = recent1.usedBytes - recent0.usedBytes;

    // Convert to bytes per hour
    return (sizeDiff / timeDiff) * (1000 * 60 * 60);
  }

  /**
   * Estimate time until storage is full
   */
  private estimateTimeUntilFull(usagePercentage: number, growthRate: number): number | undefined {
    if (growthRate <= 0 || usagePercentage >= 100) return undefined;

    const remainingPercentage = 100 - usagePercentage;
    // This is a simplified calculation
    const hoursUntilFull = (remainingPercentage / (growthRate / 1024 / 1024)) * 100;

    return hoursUntilFull > 0 ? hoursUntilFull * 3600000 : undefined; // Convert to milliseconds
  }

  /**
   * Update growth history
   */
  private updateGrowthHistory(storageType: StorageType, usedBytes: number, itemsCount: number): void {
    if (!this.growthHistory.has(storageType)) {
      this.growthHistory.set(storageType, []);
    }

    const history = this.growthHistory.get(storageType)!;
    const dataPoint: GrowthDataPoint = {
      timestamp: new Date().toISOString(),
      usedBytes,
      itemsCount,
    };

    history.push(dataPoint);

    // Keep only data within the growth window
    const cutoffTime = Date.now() - this.config.monitoring.growthWindow * 60 * 60 * 1000;
    this.growthHistory.set(
      storageType,
      history.filter(point => new Date(point.timestamp).getTime() >= cutoffTime),
    );
  }

  /**
   * Find largest item size in storage data
   */
  private findLargestItemSize(data: Record<string, unknown>): number {
    let maxSize = 0;

    for (const value of Object.values(data)) {
      const size = this.calculateDataSize(value);
      if (size > maxSize) {
        maxSize = size;
      }
    }

    return maxSize;
  }

  /**
   * Calculate memory usage from cache
   */
  private calculateMemoryUsage(): number {
    let totalSize = 0;

    for (const metadata of this.itemMetadataCache.values()) {
      totalSize += metadata.size;
    }

    return totalSize;
  }

  /**
   * Find largest cached item size
   */
  private findLargestCachedItemSize(): number {
    let maxSize = 0;

    for (const metadata of this.itemMetadataCache.values()) {
      if (metadata.size > maxSize) {
        maxSize = metadata.size;
      }
    }

    return maxSize;
  }

  /**
   * Get storage data for analysis
   */
  private async getStorageData(storageType: StorageType): Promise<Record<string, unknown>> {
    switch (storageType) {
      case 'local':
        return await chrome.storage.local.get();
      case 'sync':
        return await chrome.storage.sync.get();
      case 'session':
        return await chrome.storage.session.get();
      case 'memory': {
        // Return data from cache
        const memoryData: Record<string, unknown> = {};
        for (const [key, metadata] of this.itemMetadataCache.entries()) {
          memoryData[key] = { size: metadata.size }; // Simplified
        }
        return memoryData;
      }
      default:
        return {};
    }
  }

  /**
   * Analyze storage items to create metadata
   */
  private async analyzeStorageItems(data: Record<string, unknown>): Promise<StorageItemMetadata[]> {
    const items: StorageItemMetadata[] = [];

    for (const [key, value] of Object.entries(data)) {
      const metadata: StorageItemMetadata = {
        key,
        size: this.calculateDataSize(value),
        lastAccessed: new Date().toISOString(), // Simplified
        createdAt: new Date().toISOString(), // Simplified
        accessCount: 1, // Simplified
        priority: 'normal', // Default
        category: this.categorizeItem(key),
        compressed: false,
        cleanupAllowed: true,
      };

      items.push(metadata);
    }

    return items;
  }

  /**
   * Generate LRU cleanup recommendation
   */
  private generateLRURecommendation(
    quotaInfo: StorageQuotaInfo,
    items: StorageItemMetadata[],
  ): CleanupRecommendation | null {
    const sortedByAccess = items
      .filter(item => item.cleanupAllowed)
      .sort((a, b) => new Date(a.lastAccessed).getTime() - new Date(b.lastAccessed).getTime());

    const targetBytes = Math.ceil(quotaInfo.usedBytes * 0.2); // Free 20%
    const itemsToRemove = this.selectItemsForCleanup(sortedByAccess, targetBytes);

    if (itemsToRemove.length === 0) return null;

    return {
      id: this.generateRecommendationId(),
      strategy: 'lru',
      storageType: quotaInfo.storageType,
      estimatedBytesFreed: itemsToRemove.reduce((sum, item) => sum + item.size, 0),
      itemsToRemove: itemsToRemove.length,
      priority: quotaInfo.status === 'critical' ? 'high' : 'medium',
      title: 'Remove Least Recently Used Items',
      description: `Remove ${itemsToRemove.length} items that haven't been accessed recently`,
      risk: {
        level: 'low',
        description: 'Low risk - removes least recently used items',
        reversible: false,
      },
      affectedKeys: itemsToRemove.map(item => item.key),
      estimatedDuration: itemsToRemove.length * 10, // 10ms per item estimate
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Generate size-based cleanup recommendation
   */
  private generateSizeBasedRecommendation(
    quotaInfo: StorageQuotaInfo,
    items: StorageItemMetadata[],
  ): CleanupRecommendation | null {
    const sortedBySize = items.filter(item => item.cleanupAllowed).sort((a, b) => b.size - a.size);

    const targetBytes = Math.ceil(quotaInfo.usedBytes * 0.15); // Free 15%
    const itemsToRemove = this.selectItemsForCleanup(sortedBySize, targetBytes);

    if (itemsToRemove.length === 0) return null;

    return {
      id: this.generateRecommendationId(),
      strategy: 'size_based',
      storageType: quotaInfo.storageType,
      estimatedBytesFreed: itemsToRemove.reduce((sum, item) => sum + item.size, 0),
      itemsToRemove: itemsToRemove.length,
      priority: 'medium',
      title: 'Remove Largest Items',
      description: `Remove ${itemsToRemove.length} largest items to quickly free space`,
      risk: {
        level: 'medium',
        description: 'Medium risk - removes largest items which might be important',
        reversible: false,
      },
      affectedKeys: itemsToRemove.map(item => item.key),
      estimatedDuration: itemsToRemove.length * 15,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Generate age-based cleanup recommendation
   */
  private generateAgeBasedRecommendation(
    quotaInfo: StorageQuotaInfo,
    items: StorageItemMetadata[],
  ): CleanupRecommendation | null {
    const sortedByAge = items
      .filter(item => item.cleanupAllowed)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const targetBytes = Math.ceil(quotaInfo.usedBytes * 0.25); // Free 25%
    const itemsToRemove = this.selectItemsForCleanup(sortedByAge, targetBytes);

    if (itemsToRemove.length === 0) return null;

    return {
      id: this.generateRecommendationId(),
      strategy: 'age_based',
      storageType: quotaInfo.storageType,
      estimatedBytesFreed: itemsToRemove.reduce((sum, item) => sum + item.size, 0),
      itemsToRemove: itemsToRemove.length,
      priority: 'low',
      title: 'Remove Oldest Items',
      description: `Remove ${itemsToRemove.length} oldest items`,
      risk: {
        level: 'low',
        description: 'Low risk - removes oldest items',
        reversible: false,
      },
      affectedKeys: itemsToRemove.map(item => item.key),
      estimatedDuration: itemsToRemove.length * 10,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Generate priority-based cleanup recommendation
   */
  private generatePriorityBasedRecommendation(
    quotaInfo: StorageQuotaInfo,
    items: StorageItemMetadata[],
  ): CleanupRecommendation | null {
    const priorityOrder = { low: 0, normal: 1, high: 2, critical: 3 };
    const sortedByPriority = items
      .filter(item => item.cleanupAllowed && item.priority !== 'critical')
      .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    const targetBytes = Math.ceil(quotaInfo.usedBytes * 0.3); // Free 30%
    const itemsToRemove = this.selectItemsForCleanup(sortedByPriority, targetBytes);

    if (itemsToRemove.length === 0) return null;

    return {
      id: this.generateRecommendationId(),
      strategy: 'priority_based',
      storageType: quotaInfo.storageType,
      estimatedBytesFreed: itemsToRemove.reduce((sum, item) => sum + item.size, 0),
      itemsToRemove: itemsToRemove.length,
      priority: 'high',
      title: 'Remove Low Priority Items',
      description: `Remove ${itemsToRemove.length} low priority items`,
      risk: {
        level: 'low',
        description: 'Low risk - removes only low priority items',
        reversible: false,
      },
      affectedKeys: itemsToRemove.map(item => item.key),
      estimatedDuration: itemsToRemove.length * 8,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Generate smart cleanup recommendation
   */
  private generateSmartRecommendation(
    quotaInfo: StorageQuotaInfo,
    items: StorageItemMetadata[],
  ): CleanupRecommendation | null {
    // Smart strategy combines multiple factors
    const scoredItems = items
      .filter(item => item.cleanupAllowed)
      .map(item => ({
        item,
        score: this.calculateCleanupScore(item),
      }))
      .sort((a, b) => a.score - b.score); // Lower score = higher cleanup priority

    const targetBytes = Math.ceil(quotaInfo.usedBytes * 0.35); // Free 35%
    const itemsToRemove = this.selectItemsForCleanup(
      scoredItems.map(scored => scored.item),
      targetBytes,
    );

    if (itemsToRemove.length === 0) return null;

    return {
      id: this.generateRecommendationId(),
      strategy: 'smart',
      storageType: quotaInfo.storageType,
      estimatedBytesFreed: itemsToRemove.reduce((sum, item) => sum + item.size, 0),
      itemsToRemove: itemsToRemove.length,
      priority: quotaInfo.status === 'critical' ? 'urgent' : 'high',
      title: 'Smart Cleanup',
      description: `Intelligently remove ${itemsToRemove.length} items based on usage patterns and importance`,
      risk: {
        level: 'low',
        description: 'Low risk - uses intelligent selection algorithm',
        reversible: false,
      },
      affectedKeys: itemsToRemove.map(item => item.key),
      estimatedDuration: itemsToRemove.length * 12,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Calculate cleanup score for smart strategy
   */
  private calculateCleanupScore(item: StorageItemMetadata): number {
    const now = Date.now();
    const ageInHours = (now - new Date(item.createdAt).getTime()) / (1000 * 60 * 60);
    const lastAccessInHours = (now - new Date(item.lastAccessed).getTime()) / (1000 * 60 * 60);

    // Lower score = higher cleanup priority
    let score = 100;

    // Priority factor (higher priority = higher score)
    const priorityScores = { low: 10, normal: 30, high: 50, critical: 100 };
    score += priorityScores[item.priority];

    // Access frequency factor
    const accessFrequency = item.accessCount / Math.max(ageInHours, 1);
    score += accessFrequency * 20;

    // Last access recency factor
    score -= Math.min(lastAccessInHours, 168) * 0.5; // Cap at 1 week

    // Size factor (larger items get slightly lower scores for equal priority)
    score -= Math.log(item.size + 1) * 0.1;

    return Math.max(0, score);
  }

  /**
   * Select items for cleanup to reach target bytes
   */
  private selectItemsForCleanup(items: StorageItemMetadata[], targetBytes: number): StorageItemMetadata[] {
    const selected: StorageItemMetadata[] = [];
    let bytesSelected = 0;

    for (const item of items) {
      if (bytesSelected >= targetBytes) break;

      selected.push(item);
      bytesSelected += item.size;
    }

    return selected;
  }

  /**
   * Perform automatic cleanup
   */
  private async performAutoCleanup(quotaInfo: StorageQuotaInfo): Promise<void> {
    try {
      const recommendations = await this.generateCleanupRecommendations(quotaInfo);
      const smartRecommendation = recommendations.find(r => r.strategy === 'smart');

      if (smartRecommendation) {
        console.log(`[StorageQuotaManager] Performing auto-cleanup for ${quotaInfo.storageType}`);
        await this.executeCleanup(smartRecommendation.id);
        this.stats.autoCleanups++;
      }
    } catch (error) {
      console.error('[StorageQuotaManager] Auto-cleanup failed:', error);
    }
  }

  /**
   * Calculate data size in bytes
   */
  private calculateDataSize(data: unknown): number {
    try {
      return new TextEncoder().encode(JSON.stringify(data)).length;
    } catch {
      return 0;
    }
  }

  /**
   * Categorize item based on key
   */
  private categorizeItem(key: string): string {
    if (key.startsWith('config_')) return 'config';
    if (key.startsWith('cache_')) return 'cache';
    if (key.startsWith('transcription_')) return 'transcription';
    if (key.startsWith('temp_')) return 'temporary';
    return 'unknown';
  }

  /**
   * Get recommendation (placeholder for real implementation)
   */
  private async getRecommendation(_id: string): Promise<CleanupRecommendation | null> {
    // In a real implementation, this would retrieve stored recommendations
    return null;
  }

  /**
   * Get item size for specific storage type and key
   */
  private async getItemSize(storageType: StorageType, key: string): Promise<number> {
    try {
      let data: Record<string, unknown>;

      switch (storageType) {
        case 'local':
          data = await chrome.storage.local.get(key);
          break;
        case 'sync':
          data = await chrome.storage.sync.get(key);
          break;
        case 'session':
          data = await chrome.storage.session.get(key);
          break;
        case 'memory': {
          const metadata = this.itemMetadataCache.get(key);
          return metadata?.size || 0;
        }
        default:
          return 0;
      }

      return this.calculateDataSize(data[key]);
    } catch {
      return 0;
    }
  }

  /**
   * Remove storage item
   */
  private async removeStorageItem(storageType: StorageType, key: string): Promise<void> {
    switch (storageType) {
      case 'local':
        await chrome.storage.local.remove(key);
        break;
      case 'sync':
        await chrome.storage.sync.remove(key);
        break;
      case 'session':
        await chrome.storage.session.remove(key);
        break;
      case 'memory':
        this.itemMetadataCache.delete(key);
        break;
    }
  }

  /**
   * Update cleanup statistics
   */
  private updateCleanupStats(result: CleanupResult): void {
    this.stats.totalCleanups++;

    if (result.success) {
      this.stats.totalBytesFreed += result.bytesFreed;
      this.stats.totalItemsRemoved += result.itemsRemoved;
    }

    // Update success rate
    this.stats.cleanupSuccessRate =
      (this.stats.cleanupSuccessRate * (this.stats.totalCleanups - 1) + (result.success ? 100 : 0)) /
      this.stats.totalCleanups;

    // Update average bytes freed
    if (result.success && result.bytesFreed > 0) {
      const successfulCleanups = Math.floor((this.stats.totalCleanups * this.stats.cleanupSuccessRate) / 100);
      this.stats.averageBytesFreedPerCleanup = this.stats.totalBytesFreed / successfulCleanups;
    }

    this.stats.lastCleanup = result.executedAt;
  }

  /**
   * Update statistics calculations
   */
  private updateStatsCalculations(): void {
    this.stats.lastUpdated = new Date().toISOString();
  }

  /**
   * Generate recommendation ID
   */
  private generateRecommendationId(): string {
    return `cleanup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Notify quota listeners
   */
  private notifyQuotaListeners(info: StorageQuotaInfo): void {
    for (const listener of this.quotaListeners) {
      try {
        listener(info);
      } catch (error) {
        console.warn('[StorageQuotaManager] Quota listener failed:', error);
      }
    }
  }

  /**
   * Notify cleanup listeners
   */
  private notifyCleanupListeners(result: CleanupResult): void {
    for (const listener of this.cleanupListeners) {
      try {
        listener(result);
      } catch (error) {
        console.warn('[StorageQuotaManager] Cleanup listener failed:', error);
      }
    }
  }

  /**
   * Notify recommendation listeners
   */
  private notifyRecommendationListeners(recommendation: CleanupRecommendation): void {
    for (const listener of this.recommendationListeners) {
      try {
        listener(recommendation);
      } catch (error) {
        console.warn('[StorageQuotaManager] Recommendation listener failed:', error);
      }
    }
  }

  /**
   * Initialize quota manager statistics
   */
  private initializeStats(): QuotaManagerStats {
    return {
      totalCleanups: 0,
      totalBytesFreed: 0,
      totalItemsRemoved: 0,
      cleanupSuccessRate: 0,
      averageBytesFreedPerCleanup: 0,
      cleanupsByStrategy: {
        lru: 0,
        size_based: 0,
        age_based: 0,
        priority_based: 0,
        smart: 0,
      },
      warningEvents: 0,
      criticalEvents: 0,
      autoCleanups: 0,
      manualCleanups: 0,
      lastUpdated: new Date().toISOString(),
    };
  }
}
