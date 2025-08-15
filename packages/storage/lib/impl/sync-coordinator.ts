/**
 * Sync coordinator for Chrome Storage sync API integration
 * Implements selective synchronization for configuration vs. transcription data
 */

import type { SyncStatus, SyncConflict, SyncMetrics, SyncOperation } from '../types/cache';

/**
 * Sync operation result
 */
export interface SyncResult {
  /** Operation success status */
  success: boolean;
  /** Data synchronized */
  data?: unknown;
  /** Bytes transferred */
  bytesTransferred: number;
  /** Sync duration in milliseconds */
  duration: number;
  /** Conflicts detected */
  conflicts: SyncConflict[];
  /** Error message if failed */
  error?: string;
}

/**
 * Sync data classification
 */
export type SyncDataType = 'config' | 'transcription' | 'preferences' | 'cache' | 'metadata';

/**
 * Sync operation priority
 */
export type SyncPriority = 'immediate' | 'high' | 'normal' | 'low' | 'background';

/**
 * Sync strategy options
 */
export interface SyncStrategy {
  /** Data types to synchronize */
  dataTypes: SyncDataType[];
  /** Sync frequency in milliseconds */
  frequency: number;
  /** Enable conflict resolution */
  enableConflictResolution: boolean;
  /** Maximum sync attempts */
  maxAttempts: number;
  /** Sync timeout in milliseconds */
  timeout: number;
}

/**
 * Sync coordinator configuration
 */
export interface SyncCoordinatorConfig {
  /** Enable synchronization */
  enabled: boolean;
  /** Sync strategies by priority */
  strategies: Record<SyncPriority, SyncStrategy>;
  /** Chrome Storage quota limits */
  quotaLimits: {
    /** Maximum items to sync */
    maxItems: number;
    /** Maximum total bytes */
    maxBytes: number;
    /** Maximum bytes per item */
    maxBytesPerItem: number;
  };
  /** Selective sync settings */
  selectiveSync: {
    /** Enable config synchronization */
    enableConfigSync: boolean;
    /** Enable transcription metadata sync */
    enableTranscriptionMetadataSync: boolean;
    /** Enable preferences sync */
    enablePreferencesSync: boolean;
    /** Exclude large data from sync */
    excludeLargeData: boolean;
  };
  /** Network settings */
  network: {
    /** Enable offline queue */
    enableOfflineQueue: boolean;
    /** Retry backoff multiplier */
    retryBackoffMultiplier: number;
    /** Maximum retry delay */
    maxRetryDelay: number;
  };
}

/**
 * Sync item metadata
 */
export interface SyncItemMetadata {
  /** Data type classification */
  dataType: SyncDataType;
  /** Last modification timestamp */
  lastModified: string;
  /** Device/browser identifier */
  deviceId: string;
  /** Data version */
  version: number;
  /** Sync priority */
  priority: SyncPriority;
  /** Checksum for integrity */
  checksum: string;
  /** Compressed data flag */
  compressed: boolean;
  /** Original size before compression */
  originalSize: number;
}

/**
 * Sync queue item
 */
export interface SyncQueueItem {
  /** Operation identifier */
  operationId: string;
  /** Operation type */
  operation: SyncOperation;
  /** Storage key */
  key: string;
  /** Data to sync (for write operations) */
  data?: unknown;
  /** Item metadata */
  metadata: SyncItemMetadata;
  /** Operation priority */
  priority: SyncPriority;
  /** Retry count */
  retryCount: number;
  /** Scheduled execution time */
  scheduledAt: string;
  /** Created timestamp */
  createdAt: string;
}

/**
 * Sync execution result
 */
export interface SyncExecutionResult {
  /** Operation identifier */
  operationId: string;
  /** Whether operation succeeded */
  success: boolean;
  /** Sync result details */
  result?: SyncResult;
  /** Error message if failed */
  error?: string;
  /** Execution duration */
  duration: number;
  /** Bytes transferred */
  bytesTransferred: number;
  /** Conflicts encountered */
  conflicts: SyncConflict[];
}

/**
 * Chrome Storage sync coordinator with selective synchronization
 */
export class SyncCoordinator {
  private config: SyncCoordinatorConfig;
  private syncQueue: SyncQueueItem[] = [];
  private activeOperations = new Map<string, Promise<SyncExecutionResult>>();
  private syncMetrics: SyncMetrics;
  private syncTimer: NodeJS.Timeout | null = null;
  private deviceId: string;
  private isOnline = navigator.onLine;
  private lastSyncAttempt: string | null = null;

  constructor(config: Partial<SyncCoordinatorConfig> = {}) {
    this.config = {
      enabled: config.enabled !== false,
      strategies: {
        immediate: {
          dataTypes: ['config', 'preferences'],
          frequency: 0, // Immediate
          enableConflictResolution: true,
          maxAttempts: 3,
          timeout: 5000,
        },
        high: {
          dataTypes: ['config', 'preferences', 'metadata'],
          frequency: 30000, // 30 seconds
          enableConflictResolution: true,
          maxAttempts: 2,
          timeout: 10000,
        },
        normal: {
          dataTypes: ['transcription', 'cache'],
          frequency: 300000, // 5 minutes
          enableConflictResolution: false,
          maxAttempts: 1,
          timeout: 15000,
        },
        low: {
          dataTypes: ['cache'],
          frequency: 1800000, // 30 minutes
          enableConflictResolution: false,
          maxAttempts: 1,
          timeout: 30000,
        },
        background: {
          dataTypes: ['cache'],
          frequency: 3600000, // 1 hour
          enableConflictResolution: false,
          maxAttempts: 1,
          timeout: 60000,
        },
        ...config.strategies,
      },
      quotaLimits: {
        maxItems: 512, // Chrome Storage sync limit
        maxBytes: 102400, // 100KB limit
        maxBytesPerItem: 8192, // 8KB per item limit
        ...config.quotaLimits,
      },
      selectiveSync: {
        enableConfigSync: true,
        enableTranscriptionMetadataSync: true,
        enablePreferencesSync: true,
        excludeLargeData: true,
        ...config.selectiveSync,
      },
      network: {
        enableOfflineQueue: true,
        retryBackoffMultiplier: 2,
        maxRetryDelay: 300000, // 5 minutes
        ...config.network,
      },
    };

    this.deviceId = this.generateDeviceId();
    this.syncMetrics = this.initializeMetrics();

    // Setup network monitoring
    this.setupNetworkMonitoring();

    if (this.config.enabled) {
      this.startSyncTimer();
    }
  }

  /**
   * Queue data for synchronization
   */
  async queueSync(
    key: string,
    data: unknown,
    dataType: SyncDataType,
    priority: SyncPriority = 'normal',
  ): Promise<string> {
    if (!this.config.enabled) {
      throw new Error('Sync coordinator is disabled');
    }

    // Check if data type is enabled for sync
    if (!this.isDataTypeEnabled(dataType)) {
      throw new Error(`Sync disabled for data type: ${dataType}`);
    }

    // Validate data size
    const dataSize = this.calculateDataSize(data);
    if (dataSize > this.config.quotaLimits.maxBytesPerItem) {
      if (this.config.selectiveSync.excludeLargeData) {
        console.warn(`[SyncCoordinator] Skipping large data item: ${key} (${dataSize} bytes)`);
        return '';
      } else {
        throw new Error(`Data too large for sync: ${dataSize} bytes (max: ${this.config.quotaLimits.maxBytesPerItem})`);
      }
    }

    const operationId = this.generateOperationId();
    const metadata: SyncItemMetadata = {
      dataType,
      lastModified: new Date().toISOString(),
      deviceId: this.deviceId,
      version: 1,
      priority,
      checksum: await this.calculateChecksum(data),
      compressed: dataSize > 1024, // Compress if > 1KB
      originalSize: dataSize,
    };

    const queueItem: SyncQueueItem = {
      operationId,
      operation: 'update',
      key,
      data,
      metadata,
      priority,
      retryCount: 0,
      scheduledAt: this.calculateScheduledTime(priority),
      createdAt: new Date().toISOString(),
    };

    this.syncQueue.push(queueItem);
    this.sortSyncQueue();

    console.log(`[SyncCoordinator] Queued sync operation: ${operationId} (${dataType}:${priority})`);

    // Immediate execution for high-priority items
    if (priority === 'immediate' && this.isOnline) {
      setImmediate(() => this.processSyncQueue());
    }

    return operationId;
  }

  /**
   * Queue delete operation for synchronization
   */
  async queueDelete(key: string, dataType: SyncDataType, priority: SyncPriority = 'normal'): Promise<string> {
    if (!this.config.enabled) {
      throw new Error('Sync coordinator is disabled');
    }

    const operationId = this.generateOperationId();
    const metadata: SyncItemMetadata = {
      dataType,
      lastModified: new Date().toISOString(),
      deviceId: this.deviceId,
      version: 1,
      priority,
      checksum: '',
      compressed: false,
      originalSize: 0,
    };

    const queueItem: SyncQueueItem = {
      operationId,
      operation: 'delete',
      key,
      metadata,
      priority,
      retryCount: 0,
      scheduledAt: this.calculateScheduledTime(priority),
      createdAt: new Date().toISOString(),
    };

    this.syncQueue.push(queueItem);
    this.sortSyncQueue();

    console.log(`[SyncCoordinator] Queued delete operation: ${operationId} (${dataType}:${priority})`);

    return operationId;
  }

  /**
   * Sync data from Chrome Storage
   */
  async syncFromRemote(keys?: string[]): Promise<{
    synced: Record<string, unknown>;
    conflicts: SyncConflict[];
    errors: string[];
  }> {
    if (!this.config.enabled) {
      throw new Error('Sync coordinator is disabled');
    }

    try {
      const startTime = Date.now();
      const synced: Record<string, unknown> = {};
      const conflicts: SyncConflict[] = [];
      const errors: string[] = [];

      // Get data from Chrome Storage sync
      const remoteData = keys ? await chrome.storage.sync.get(keys) : await chrome.storage.sync.get();

      for (const [key, value] of Object.entries(remoteData)) {
        try {
          // Parse metadata if available
          const metadata = this.extractMetadata(value);

          if (metadata) {
            // Check for conflicts
            const conflict = await this.checkForConflict(key, value, metadata);

            if (conflict) {
              conflicts.push(conflict);

              // Resolve conflict if enabled
              if (this.config.strategies[metadata.priority].enableConflictResolution) {
                const resolved = await this.resolveConflict(conflict);
                if (resolved) {
                  synced[key] = resolved.resolvedData;
                }
              }
            } else {
              synced[key] = this.extractData(value);
            }
          } else {
            // Data without metadata, use as-is
            synced[key] = value;
          }
        } catch (error) {
          errors.push(`Failed to process ${key}: ${error}`);
        }
      }

      // Update metrics
      this.syncMetrics.totalOperations++;
      this.syncMetrics.dataSynced += this.calculateDataSize(synced);
      this.syncMetrics.lastSyncAt = new Date().toISOString();
      this.syncMetrics.averageSyncTime = this.updateAverageTime(
        this.syncMetrics.averageSyncTime,
        Date.now() - startTime,
        this.syncMetrics.totalOperations,
      );

      return { synced, conflicts, errors };
    } catch (error) {
      this.syncMetrics.failedOperations++;
      throw new Error(`Remote sync failed: ${error}`);
    }
  }

  /**
   * Get current sync status
   */
  getSyncStatus(): SyncStatus {
    const _queueStats = this.analyzeSyncQueue();

    return {
      state: this.syncQueue.length > 0 ? 'queued' : 'idle',
      online: this.isOnline,
      queueSize: this.syncQueue.length,
      errors: this.syncMetrics.failedOperations,
      conflicts: this.syncMetrics.conflictsDetected,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Get sync metrics
   */
  getMetrics(): SyncMetrics {
    this.updateMetricsCalculations();
    return { ...this.syncMetrics };
  }

  /**
   * Force immediate sync processing
   */
  async forceSyncNow(): Promise<SyncExecutionResult[]> {
    if (!this.config.enabled) {
      throw new Error('Sync coordinator is disabled');
    }

    console.log('[SyncCoordinator] Force syncing all queued operations');
    return await this.processSyncQueue(true);
  }

  /**
   * Clear sync queue
   */
  clearSyncQueue(): number {
    const count = this.syncQueue.length;
    this.syncQueue = [];
    console.log(`[SyncCoordinator] Cleared ${count} queued operations`);
    return count;
  }

  /**
   * Update sync coordinator configuration
   */
  updateConfig(config: Partial<SyncCoordinatorConfig>): void {
    this.config = { ...this.config, ...config };

    if (this.config.enabled && !this.syncTimer) {
      this.startSyncTimer();
    } else if (!this.config.enabled && this.syncTimer) {
      this.stopSyncTimer();
    }

    console.log('[SyncCoordinator] Configuration updated');
  }

  /**
   * Shutdown sync coordinator
   */
  async shutdown(): Promise<void> {
    console.log('[SyncCoordinator] Shutting down');

    this.stopSyncTimer();

    // Process remaining queue items if online
    if (this.isOnline && this.syncQueue.length > 0) {
      console.log(`[SyncCoordinator] Processing ${this.syncQueue.length} remaining queue items`);
      await this.processSyncQueue(true);
    }

    // Wait for active operations to complete
    if (this.activeOperations.size > 0) {
      console.log(`[SyncCoordinator] Waiting for ${this.activeOperations.size} active operations`);
      await Promise.allSettled(this.activeOperations.values());
    }

    this.syncQueue = [];
    this.activeOperations.clear();

    console.log('[SyncCoordinator] Shutdown completed');
  }

  /**
   * Process sync queue
   */
  private async processSyncQueue(forceAll: boolean = false): Promise<SyncExecutionResult[]> {
    if (!this.isOnline && !forceAll) {
      console.log('[SyncCoordinator] Offline, skipping sync processing');
      return [];
    }

    const results: SyncExecutionResult[] = [];
    const now = new Date().toISOString();
    this.lastSyncAttempt = now;

    // Filter items ready for processing
    const readyItems = this.syncQueue.filter(item => forceAll || item.scheduledAt <= now);

    if (readyItems.length === 0) {
      return results;
    }

    console.log(`[SyncCoordinator] Processing ${readyItems.length} sync operations`);

    // Group by priority for batch processing
    const groupedItems = this.groupItemsByPriority(readyItems);

    for (const [priority, items] of Object.entries(groupedItems)) {
      const strategy = this.config.strategies[priority as SyncPriority];

      for (const item of items) {
        try {
          const result = await this.executeSyncOperation(item, strategy);
          results.push(result);

          if (result.success) {
            // Remove from queue
            this.syncQueue = this.syncQueue.filter(q => q.operationId !== item.operationId);
          } else {
            // Handle retry
            await this.handleRetry(item, result.error);
          }
        } catch (error) {
          console.error(`[SyncCoordinator] Operation failed: ${item.operationId}:`, error);
          await this.handleRetry(item, error instanceof Error ? error.message : String(error));
        }
      }
    }

    return results;
  }

  /**
   * Execute individual sync operation
   */
  private async executeSyncOperation(item: SyncQueueItem, strategy: SyncStrategy): Promise<SyncExecutionResult> {
    const _startTime = Date.now();

    try {
      // Check if operation is already active
      if (this.activeOperations.has(item.operationId)) {
        return await this.activeOperations.get(item.operationId)!;
      }

      // Create operation promise
      const operationPromise = this.performSyncOperation(item, strategy);
      this.activeOperations.set(item.operationId, operationPromise);

      const result = await operationPromise;

      // Update metrics
      this.updateOperationMetrics(result);

      return result;
    } finally {
      this.activeOperations.delete(item.operationId);
    }
  }

  /**
   * Perform actual sync operation
   */
  private async performSyncOperation(item: SyncQueueItem, _strategy: SyncStrategy): Promise<SyncExecutionResult> {
    const startTime = Date.now();
    let bytesTransferred = 0;
    const conflicts: SyncConflict[] = [];

    try {
      switch (item.operation) {
        case 'update': {
          // Prepare data for Chrome Storage
          const storageData = this.prepareStorageData(item.data, item.metadata);
          bytesTransferred = this.calculateDataSize(storageData);

          // Check quota before writing
          const quotaCheck = await this.checkQuota(bytesTransferred);
          if (!quotaCheck.available) {
            throw new Error(`Quota exceeded: ${quotaCheck.message}`);
          }

          // Write to Chrome Storage sync
          await chrome.storage.sync.set({ [item.key]: storageData });
          break;
        }

        case 'delete': {
          await chrome.storage.sync.remove(item.key);
          break;
        }

        case 'sync': {
          const result = await chrome.storage.sync.get(item.key);
          bytesTransferred = this.calculateDataSize(result);
          break;
        }

        default:
          throw new Error(`Unsupported operation: ${item.operation}`);
      }

      return {
        operationId: item.operationId,
        success: true,
        duration: Date.now() - startTime,
        bytesTransferred,
        conflicts,
      };
    } catch (error) {
      return {
        operationId: item.operationId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
        bytesTransferred,
        conflicts,
      };
    }
  }

  /**
   * Handle operation retry
   */
  private async handleRetry(item: SyncQueueItem, error?: string): Promise<void> {
    const strategy = this.config.strategies[item.priority];

    if (item.retryCount >= strategy.maxAttempts) {
      console.error(`[SyncCoordinator] Max retries exceeded for ${item.operationId}: ${error}`);

      // Remove from queue
      this.syncQueue = this.syncQueue.filter(q => q.operationId !== item.operationId);
      this.syncMetrics.failedOperations++;
      return;
    }

    // Calculate retry delay
    const baseDelay = 1000; // 1 second
    const retryDelay = Math.min(
      baseDelay * Math.pow(this.config.network.retryBackoffMultiplier, item.retryCount),
      this.config.network.maxRetryDelay,
    );

    // Update retry info
    item.retryCount++;
    item.scheduledAt = new Date(Date.now() + retryDelay).toISOString();

    console.log(`[SyncCoordinator] Retrying ${item.operationId} in ${retryDelay}ms (attempt ${item.retryCount})`);
  }

  /**
   * Check Chrome Storage quota
   */
  private async checkQuota(additionalBytes: number): Promise<{ available: boolean; message?: string }> {
    try {
      const usage = await chrome.storage.sync.getBytesInUse();
      const available = usage + additionalBytes <= this.config.quotaLimits.maxBytes;

      if (!available) {
        return {
          available: false,
          message: `Would exceed quota: ${usage + additionalBytes} > ${this.config.quotaLimits.maxBytes}`,
        };
      }

      return { available: true };
    } catch (error) {
      return {
        available: false,
        message: `Quota check failed: ${error}`,
      };
    }
  }

  /**
   * Check if data type is enabled for sync
   */
  private isDataTypeEnabled(dataType: SyncDataType): boolean {
    switch (dataType) {
      case 'config':
        return this.config.selectiveSync.enableConfigSync;
      case 'transcription':
        return this.config.selectiveSync.enableTranscriptionMetadataSync;
      case 'preferences':
        return this.config.selectiveSync.enablePreferencesSync;
      case 'cache':
      case 'metadata':
        return true; // Always enabled
      default:
        return false;
    }
  }

  /**
   * Prepare data for Chrome Storage
   */
  private prepareStorageData(data: unknown, metadata: SyncItemMetadata): unknown {
    const storageItem = {
      __metadata: metadata,
      __data: data,
    };

    // Compress if enabled
    if (metadata.compressed) {
      // TODO: Implement compression
      return storageItem;
    }

    return storageItem;
  }

  /**
   * Extract metadata from storage item
   */
  private extractMetadata(value: unknown): SyncItemMetadata | null {
    if (typeof value === 'object' && value !== null && '__metadata' in value) {
      return (value as { __metadata: SyncItemMetadata }).__metadata;
    }
    return null;
  }

  /**
   * Extract data from storage item
   */
  private extractData(value: unknown): unknown {
    if (typeof value === 'object' && value !== null && '__data' in value) {
      return (value as { __data: unknown }).__data;
    }
    return value;
  }

  /**
   * Check for sync conflicts
   */
  private async checkForConflict(
    _key: string,
    _remoteValue: unknown,
    _metadata: SyncItemMetadata,
  ): Promise<SyncConflict | null> {
    // This is a simplified conflict detection
    // In a real implementation, you'd compare with local data
    return null;
  }

  /**
   * Resolve sync conflict
   */
  private async resolveConflict(_conflict: SyncConflict): Promise<{ resolvedData: unknown } | null> {
    // Simple last-write-wins resolution
    // In a real implementation, you'd have more sophisticated conflict resolution
    return null;
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
   * Calculate checksum for data integrity
   */
  private async calculateChecksum(data: unknown): Promise<string> {
    try {
      const content = JSON.stringify(data);
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(content);
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));

      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      return '';
    }
  }

  /**
   * Generate operation ID
   */
  private generateOperationId(): string {
    return `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate device ID
   */
  private generateDeviceId(): string {
    const stored = localStorage.getItem('sync-device-id');
    if (stored) return stored;

    const deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('sync-device-id', deviceId);
    return deviceId;
  }

  /**
   * Calculate scheduled time based on priority
   */
  private calculateScheduledTime(priority: SyncPriority): string {
    const strategy = this.config.strategies[priority];
    return new Date(Date.now() + strategy.frequency).toISOString();
  }

  /**
   * Sort sync queue by priority and scheduled time
   */
  private sortSyncQueue(): void {
    const priorityOrder = { immediate: 0, high: 1, normal: 2, low: 3, background: 4 };

    this.syncQueue.sort((a, b) => {
      // First by priority
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Then by scheduled time
      return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
    });
  }

  /**
   * Analyze sync queue
   */
  private analyzeSyncQueue(): {
    pendingByPriority: Record<SyncPriority, number>;
    totalPending: number;
  } {
    const pendingByPriority: Record<SyncPriority, number> = {
      immediate: 0,
      high: 0,
      normal: 0,
      low: 0,
      background: 0,
    };

    for (const item of this.syncQueue) {
      pendingByPriority[item.priority]++;
    }

    return {
      pendingByPriority,
      totalPending: this.syncQueue.length,
    };
  }

  /**
   * Group items by priority
   */
  private groupItemsByPriority(items: SyncQueueItem[]): Record<string, SyncQueueItem[]> {
    const groups: Record<string, SyncQueueItem[]> = {};

    for (const item of items) {
      if (!groups[item.priority]) {
        groups[item.priority] = [];
      }
      groups[item.priority]?.push(item);
    }

    return groups;
  }

  /**
   * Setup network monitoring
   */
  private setupNetworkMonitoring(): void {
    window.addEventListener('online', () => {
      console.log('[SyncCoordinator] Network online, resuming sync');
      this.isOnline = true;
      this.processSyncQueue();
    });

    window.addEventListener('offline', () => {
      console.log('[SyncCoordinator] Network offline, pausing sync');
      this.isOnline = false;
    });
  }

  /**
   * Start sync timer
   */
  private startSyncTimer(): void {
    if (this.syncTimer) return;

    // Use the highest frequency strategy for timer
    const minFrequency = Math.min(...Object.values(this.config.strategies).map(s => s.frequency));
    const timerFrequency = Math.max(minFrequency, 30000); // At least 30 seconds

    this.syncTimer = setInterval(() => {
      this.processSyncQueue();
    }, timerFrequency);

    console.log(`[SyncCoordinator] Sync timer started (${timerFrequency}ms)`);
  }

  /**
   * Stop sync timer
   */
  private stopSyncTimer(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      console.log('[SyncCoordinator] Sync timer stopped');
    }
  }

  /**
   * Update operation metrics
   */
  private updateOperationMetrics(result: SyncExecutionResult): void {
    this.syncMetrics.totalOperations++;
    this.syncMetrics.dataSynced += result.bytesTransferred;

    if (result.success) {
      this.syncMetrics.successfulOperations++;
    } else {
      this.syncMetrics.failedOperations++;
      this.syncMetrics.failedOperations++;
    }

    this.syncMetrics.conflictsDetected += result.conflicts.length;

    this.syncMetrics.averageSyncTime = this.updateAverageTime(
      this.syncMetrics.averageSyncTime,
      result.duration,
      this.syncMetrics.totalOperations,
    );
  }

  /**
   * Update metrics calculations
   */
  private updateMetricsCalculations(): void {
    // Update metrics calculations
    // Note: successRate and lastUpdated are not part of SyncMetrics interface
  }

  /**
   * Update average time calculation
   */
  private updateAverageTime(currentAvg: number, newTime: number, count: number): number {
    return (currentAvg * (count - 1) + newTime) / count;
  }

  /**
   * Initialize sync metrics
   */
  private initializeMetrics(): SyncMetrics {
    return {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageSyncTime: 0,
      dataSynced: 0,
      conflictsDetected: 0,
      conflictsResolved: 0,
    };
  }
}
