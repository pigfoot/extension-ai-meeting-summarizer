/**
 * Offline sync queue for operation queuing during offline scenarios
 * Implements automatic sync when connection is restored with reliable recovery
 */

import type {
  SyncOperation,
  SyncPriority,
  OfflineQueueItem,
  OfflineQueueConfig,
  OfflineQueueStats,
} from '../types/cache';

/**
 * Queue operation result
 */
export interface QueueOperationResult {
  /** Operation identifier */
  operationId: string;
  /** Whether operation was successful */
  success: boolean;
  /** Result data */
  result?: unknown;
  /** Error message if failed */
  error?: string;
  /** Operation duration */
  duration: number;
  /** Execution timestamp */
  executedAt: string;
}

/**
 * Batch processing result
 */
export interface BatchProcessingResult {
  /** Total operations processed */
  totalProcessed: number;
  /** Successful operations */
  successful: number;
  /** Failed operations */
  failed: number;
  /** Processing duration */
  duration: number;
  /** Individual results */
  results: QueueOperationResult[];
  /** Processing timestamp */
  processedAt: string;
}

/**
 * Network status information
 */
export interface NetworkStatus {
  /** Whether network is online */
  online: boolean;
  /** Connection type */
  connectionType: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
  /** Effective connection speed */
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g' | 'unknown';
  /** Round-trip time estimate */
  rtt: number;
  /** Downlink speed estimate */
  downlink: number;
  /** Whether connection is metered */
  saveData: boolean;
}

/**
 * Offline queue item with persistence metadata
 */
interface PersistedQueueItem extends OfflineQueueItem {
  /** Persistence timestamp */
  persistedAt: string;
  /** Retry count */
  retryCount: number;
  /** Last retry timestamp */
  lastRetry?: string;
  /** Failure reason if any */
  failureReason?: string;
}

/**
 * Offline sync queue with intelligent recovery and persistence
 */
export class OfflineQueue {
  private config: OfflineQueueConfig;
  private queue: PersistedQueueItem[] = [];
  private stats: OfflineQueueStats;
  private isOnline = navigator.onLine;
  private networkInfo: NetworkStatus | null = null;
  private processingQueue = false;
  private processTimer: NodeJS.Timeout | null = null;
  private persistenceKey = 'offline_sync_queue';
  private operationCallbacks = new Map<string, (result: QueueOperationResult) => void>();

  constructor(config: Partial<OfflineQueueConfig> = {}) {
    this.config = {
      maxQueueSize: config.maxQueueSize || 1000,
      defaultPriority: config.defaultPriority || 'normal',
      maxRetries: config.maxRetries || config.maxRetryAttempts || 5,
      maxRetryAttempts: config.maxRetryAttempts || 5,
      retryDelay: config.retryDelay || config.retryDelayBase || 1000,
      retryDelayBase: config.retryDelayBase || 1000,
      retryDelayMax: config.retryDelayMax || 300000, // 5 minutes
      retryDelayMultiplier: config.retryDelayMultiplier || 2,
      persistQueue: config.persistQueue ?? config.enablePersistence ?? true,
      enablePersistence: config.enablePersistence !== false,
      enableBatching: config.enableBatching !== false,
      batchSize: config.batchSize || 10,
      batchTimeout: config.batchTimeout || 5000,
      enableNetworkOptimization: config.enableNetworkOptimization !== false,
      minConnectionQuality: config.minConnectionQuality || '2g',
      enablePriorityQueuing: config.enablePriorityQueuing !== false,
    };

    this.stats = this.initializeStats();

    // Setup network monitoring
    this.setupNetworkMonitoring();

    // Load persisted queue
    if (this.config.enablePersistence) {
      this.loadPersistedQueue();
    }

    // Start processing timer
    this.startProcessingTimer();
  }

  /**
   * Add operation to offline queue
   */
  async addOperation(
    operation: SyncOperation,
    key: string,
    data: unknown,
    priority: SyncPriority = 'normal',
    metadata?: Record<string, unknown>,
  ): Promise<string> {
    const operationId = this.generateOperationId();
    const timestamp = new Date().toISOString();

    const queueItem: PersistedQueueItem = {
      id: operationId,
      operation,
      key,
      data,
      priority,
      createdAt: timestamp,
      retryCount: 0,
      maxRetries: this.config.maxRetryAttempts,
      metadata: {
        queuedAt: timestamp,
        deviceId: this.getDeviceId(),
        userAgent: navigator.userAgent,
        ...metadata,
      },
      persistedAt: timestamp,
    };

    // Check queue size limit
    if (this.queue.length >= this.config.maxQueueSize) {
      await this.makeRoomInQueue();
    }

    // Add to queue
    this.queue.push(queueItem);
    this.sortQueueByPriority();

    // Persist queue if enabled
    if (this.config.enablePersistence) {
      await this.persistQueue();
    }

    // Update statistics
    this.stats.totalQueued++;
    this.stats.queueSize = this.queue.length;

    console.log(`[OfflineQueue] Operation queued: ${operationId} (${operation}:${priority})`);

    // Try immediate processing if online
    if (this.isOnline && this.isConnectionGoodEnough()) {
      setImmediate(() => this.processQueue());
    }

    return operationId;
  }

  /**
   * Register callback for operation completion
   */
  onOperationComplete(operationId: string, callback: (result: QueueOperationResult) => void): void {
    this.operationCallbacks.set(operationId, callback);
  }

  /**
   * Get current queue status
   */
  getQueueStatus(): {
    size: number;
    processing: boolean;
    online: boolean;
    networkQuality: string;
    pendingByPriority: Record<SyncPriority, number>;
    oldestItem?: string;
    estimatedProcessingTime: number;
  } {
    const pendingByPriority: Record<SyncPriority, number> = {
      immediate: 0,
      critical: 0,
      high: 0,
      medium: 0,
      normal: 0,
      low: 0,
    };

    for (const item of this.queue) {
      pendingByPriority[item.priority]++;
    }

    const oldestItem =
      this.queue.length > 0
        ? this.queue.reduce((oldest, item) =>
            new Date(item.persistedAt) < new Date(oldest.persistedAt) ? item : oldest,
          ).persistedAt
        : undefined;

    // Estimate processing time based on queue size and network
    const avgProcessingTime = this.stats.averageProcessingTime || 1000;
    const batchCount = this.config.enableBatching
      ? Math.ceil(this.queue.length / this.config.batchSize)
      : this.queue.length;
    const estimatedProcessingTime = batchCount * avgProcessingTime;

    return {
      size: this.queue.length,
      processing: this.processingQueue,
      online: this.isOnline,
      networkQuality: this.networkInfo?.effectiveType || 'unknown',
      pendingByPriority,
      ...(oldestItem && { oldestItem }),
      estimatedProcessingTime,
    };
  }

  /**
   * Get offline queue statistics
   */
  getStats(): OfflineQueueStats {
    this.updateStatsCalculations();
    return { ...this.stats };
  }

  /**
   * Force process queue immediately
   */
  async forceProcessQueue(): Promise<BatchProcessingResult> {
    console.log('[OfflineQueue] Force processing queue');
    return await this.processQueue(true);
  }

  /**
   * Clear all queued operations
   */
  async clearQueue(): Promise<number> {
    const count = this.queue.length;
    this.queue = [];
    this.stats.queueSize = 0;

    if (this.config.enablePersistence) {
      await this.persistQueue();
    }

    console.log(`[OfflineQueue] Queue cleared: ${count} operations removed`);
    return count;
  }

  /**
   * Remove specific operation from queue
   */
  async removeOperation(operationId: string): Promise<boolean> {
    const index = this.queue.findIndex(item => item.id === operationId);

    if (index >= 0) {
      this.queue.splice(index, 1);
      this.stats.queueSize = this.queue.length;

      if (this.config.enablePersistence) {
        await this.persistQueue();
      }

      console.log(`[OfflineQueue] Operation removed: ${operationId}`);
      return true;
    }

    return false;
  }

  /**
   * Update offline queue configuration
   */
  updateConfig(config: Partial<OfflineQueueConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[OfflineQueue] Configuration updated');
  }

  /**
   * Shutdown offline queue
   */
  async shutdown(): Promise<void> {
    console.log('[OfflineQueue] Shutting down');

    this.stopProcessingTimer();

    // Process remaining operations if online
    if (this.isOnline && this.queue.length > 0) {
      console.log(`[OfflineQueue] Processing ${this.queue.length} remaining operations`);
      await this.processQueue(true);
    }

    // Final persistence
    if (this.config.enablePersistence && this.queue.length > 0) {
      await this.persistQueue();
    }

    this.queue = [];
    this.operationCallbacks.clear();

    console.log('[OfflineQueue] Shutdown completed');
  }

  /**
   * Process queued operations
   */
  private async processQueue(forceProcess: boolean = false): Promise<BatchProcessingResult> {
    if (this.processingQueue) {
      console.log('[OfflineQueue] Queue processing already in progress');
      return this.createEmptyBatchResult();
    }

    if (!forceProcess && (!this.isOnline || !this.isConnectionGoodEnough())) {
      console.log('[OfflineQueue] Skipping queue processing - network conditions not suitable');
      return this.createEmptyBatchResult();
    }

    if (this.queue.length === 0) {
      return this.createEmptyBatchResult();
    }

    this.processingQueue = true;
    const startTime = Date.now();

    try {
      console.log(`[OfflineQueue] Processing ${this.queue.length} queued operations`);

      let results: QueueOperationResult[] = [];

      if (this.config.enableBatching) {
        results = await this.processBatches();
      } else {
        results = await this.processSequentially();
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      const batchResult: BatchProcessingResult = {
        totalProcessed: results.length,
        successful,
        failed,
        duration: Date.now() - startTime,
        results,
        processedAt: new Date().toISOString(),
      };

      // Update statistics
      this.updateProcessingStats(batchResult);

      // Persist updated queue
      if (this.config.enablePersistence) {
        await this.persistQueue();
      }

      console.log(`[OfflineQueue] Batch processing completed: ${successful} successful, ${failed} failed`);

      return batchResult;
    } catch (error) {
      console.error('[OfflineQueue] Queue processing failed:', error);
      return this.createEmptyBatchResult();
    } finally {
      this.processingQueue = false;
    }
  }

  /**
   * Process operations in batches
   */
  private async processBatches(): Promise<QueueOperationResult[]> {
    const results: QueueOperationResult[] = [];
    const batchSize = this.config.batchSize;

    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, Math.min(batchSize, this.queue.length));
      const batchResults = await this.processBatch(batch);
      results.push(...batchResults);

      // Handle failed operations
      const failedOperations = batchResults
        .filter(r => !r.success)
        .map(r => batch.find(item => item.id === r.operationId)!)
        .filter(Boolean);

      for (const failedOp of failedOperations) {
        await this.handleFailedOperation(failedOp, batchResults.find(r => r.operationId === failedOp.id)!);
      }

      // Break if network conditions deteriorate
      if (!this.isOnline || !this.isConnectionGoodEnough()) {
        console.log('[OfflineQueue] Network conditions deteriorated, stopping batch processing');
        break;
      }
    }

    return results;
  }

  /**
   * Process single batch of operations
   */
  private async processBatch(batch: PersistedQueueItem[]): Promise<QueueOperationResult[]> {
    const batchPromises = batch.map(item => this.processOperation(item));

    try {
      const results = await Promise.allSettled(batchPromises);

      return results.map((result, index) => {
        const item = batch[index];

        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          return {
            operationId: item?.id || `unknown-${index}`,
            success: false,
            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
            duration: 0,
            executedAt: new Date().toISOString(),
          };
        }
      });
    } catch (error) {
      // Fallback for batch failure
      return batch.map(item => ({
        operationId: item.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: 0,
        executedAt: new Date().toISOString(),
      }));
    }
  }

  /**
   * Process operations sequentially
   */
  private async processSequentially(): Promise<QueueOperationResult[]> {
    const results: QueueOperationResult[] = [];

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      const result = await this.processOperation(item);
      results.push(result);

      if (!result.success) {
        await this.handleFailedOperation(item, result);
      }

      // Execute callback if registered
      this.executeOperationCallback(result);

      // Break if network conditions deteriorate
      if (!this.isOnline || !this.isConnectionGoodEnough()) {
        console.log('[OfflineQueue] Network conditions deteriorated, stopping sequential processing');
        break;
      }
    }

    return results;
  }

  /**
   * Process individual operation
   */
  private async processOperation(item: PersistedQueueItem): Promise<QueueOperationResult> {
    const startTime = Date.now();

    try {
      // Simulate sync operation (would integrate with actual sync service)
      let result: unknown;

      switch (item.operation) {
        case 'create':
        case 'update':
          result = await this.performSyncWrite(item.key, item.data);
          break;

        case 'delete':
          result = await this.performSyncDelete(item.key);
          break;

        case 'sync':
          result = await this.performSyncRead(item.key);
          break;

        default:
          throw new Error(`Unsupported operation: ${item.operation}`);
      }

      return {
        operationId: item.id,
        success: true,
        result,
        duration: Date.now() - startTime,
        executedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        operationId: item.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
        executedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Handle failed operation (retry logic)
   */
  private async handleFailedOperation(item: PersistedQueueItem, result: QueueOperationResult): Promise<void> {
    item.retryCount++;
    item.lastRetry = new Date().toISOString();
    if (result.error) {
      item.failureReason = result.error;
    }

    if (item.retryCount >= this.config.maxRetryAttempts) {
      console.error(`[OfflineQueue] Max retries exceeded for ${item.id}: ${result.error}`);
      // Note: permanentFailures is not in OfflineQueueStats, commenting out
      // this.stats.permanentFailures++;
      return;
    }

    // Calculate retry delay
    const retryDelay = Math.min(
      this.config.retryDelayBase * Math.pow(this.config.retryDelayMultiplier, item.retryCount - 1),
      this.config.retryDelayMax,
    );

    // Schedule retry by adding back to queue
    setTimeout(() => {
      this.queue.unshift(item);
      this.sortQueueByPriority();
    }, retryDelay);

    console.log(`[OfflineQueue] Scheduling retry for ${item.id} in ${retryDelay}ms (attempt ${item.retryCount})`);
  }

  /**
   * Perform sync write operation
   */
  private async performSyncWrite(key: string, data: unknown): Promise<unknown> {
    // This would integrate with actual Chrome Storage sync
    await chrome.storage.sync.set({ [key]: data });
    return data;
  }

  /**
   * Perform sync delete operation
   */
  private async performSyncDelete(key: string): Promise<void> {
    await chrome.storage.sync.remove(key);
  }

  /**
   * Perform sync read operation
   */
  private async performSyncRead(key: string): Promise<unknown> {
    const result = await chrome.storage.sync.get(key);
    return result[key];
  }

  /**
   * Execute operation callback
   */
  private executeOperationCallback(result: QueueOperationResult): void {
    const callback = this.operationCallbacks.get(result.operationId);
    if (callback) {
      try {
        callback(result);
      } catch (error) {
        console.warn(`[OfflineQueue] Callback failed for ${result.operationId}:`, error);
      }
      this.operationCallbacks.delete(result.operationId);
    }
  }

  /**
   * Make room in queue by removing low-priority or old items
   */
  private async makeRoomInQueue(): Promise<void> {
    // Remove oldest low-priority items first
    const lowPriorityItems = this.queue
      .filter(item => item.priority === 'low')
      .sort((a, b) => new Date(a.persistedAt).getTime() - new Date(b.persistedAt).getTime());

    if (lowPriorityItems.length > 0) {
      const toRemove = lowPriorityItems[0];
      if (toRemove) {
        await this.removeOperation(toRemove.id);
        console.log(`[OfflineQueue] Removed low-priority item to make room: ${toRemove.id}`);
        return;
      }
    }

    // Remove oldest items regardless of priority
    const oldestItem = this.queue.sort(
      (a, b) => new Date(a.persistedAt).getTime() - new Date(b.persistedAt).getTime(),
    )[0];

    if (oldestItem) {
      await this.removeOperation(oldestItem.id);
      console.log(`[OfflineQueue] Removed oldest item to make room: ${oldestItem.id}`);
    }
  }

  /**
   * Sort queue by priority
   */
  private sortQueueByPriority(): void {
    if (!this.config.enablePriorityQueuing) return;

    const priorityOrder = { immediate: 0, critical: 1, high: 2, medium: 3, normal: 4, low: 5 };

    this.queue.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Within same priority, sort by queue time
      return new Date(a.persistedAt).getTime() - new Date(b.persistedAt).getTime();
    });
  }

  /**
   * Check if connection is good enough for processing
   */
  private isConnectionGoodEnough(): boolean {
    if (!this.config.enableNetworkOptimization) return true;
    if (!this.networkInfo) return true;

    const qualityOrder: Record<string, number> = { 'slow-2g': 0, '2g': 1, '3g': 2, '4g': 3, unknown: 2 };
    const minQuality = qualityOrder[this.config.minConnectionQuality] ?? 2;
    const currentQuality = qualityOrder[this.networkInfo.effectiveType] ?? 2;

    return currentQuality >= minQuality;
  }

  /**
   * Setup network monitoring
   */
  private setupNetworkMonitoring(): void {
    // Basic online/offline detection
    window.addEventListener('online', () => {
      console.log('[OfflineQueue] Network online, resuming processing');
      this.isOnline = true;
      this.processQueue();
    });

    window.addEventListener('offline', () => {
      console.log('[OfflineQueue] Network offline, pausing processing');
      this.isOnline = false;
    });

    // Enhanced network information if available
    if ('connection' in navigator) {
      const connection = (navigator as { connection?: { effectiveType?: string; downlink?: number; rtt?: number } })
        .connection;

      const updateNetworkInfo = () => {
        this.networkInfo = {
          online: this.isOnline,
          connectionType: connection.type || 'unknown',
          effectiveType: connection.effectiveType || 'unknown',
          rtt: connection.rtt || 0,
          downlink: connection.downlink || 0,
          saveData: connection.saveData || false,
        };
      };

      updateNetworkInfo();
      connection.addEventListener('change', updateNetworkInfo);
    }
  }

  /**
   * Start processing timer
   */
  private startProcessingTimer(): void {
    if (this.processTimer) return;

    this.processTimer = setInterval(() => {
      if (this.queue.length > 0 && this.isOnline && !this.processingQueue) {
        this.processQueue();
      }
    }, 30000); // Check every 30 seconds

    console.log('[OfflineQueue] Processing timer started');
  }

  /**
   * Stop processing timer
   */
  private stopProcessingTimer(): void {
    if (this.processTimer) {
      clearInterval(this.processTimer);
      this.processTimer = null;
      console.log('[OfflineQueue] Processing timer stopped');
    }
  }

  /**
   * Persist queue to storage
   */
  private async persistQueue(): Promise<void> {
    if (!this.config.enablePersistence) return;

    try {
      const queueData = {
        queue: this.queue,
        timestamp: new Date().toISOString(),
      };

      await chrome.storage.local.set({ [this.persistenceKey]: queueData });
    } catch (error) {
      console.warn('[OfflineQueue] Failed to persist queue:', error);
    }
  }

  /**
   * Load persisted queue from storage
   */
  private async loadPersistedQueue(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(this.persistenceKey);
      const queueData = result[this.persistenceKey];

      if (queueData && queueData.queue && Array.isArray(queueData.queue)) {
        this.queue = queueData.queue;
        this.sortQueueByPriority();
        this.stats.queueSize = this.queue.length;

        console.log(`[OfflineQueue] Loaded ${this.queue.length} persisted operations`);
      }
    } catch (error) {
      console.warn('[OfflineQueue] Failed to load persisted queue:', error);
    }
  }

  /**
   * Update processing statistics
   */
  private updateProcessingStats(result: BatchProcessingResult): void {
    this.stats.totalItems = this.queue.length;
    this.stats.totalQueued += result.totalProcessed;
    this.stats.totalSuccessful += result.successful;
    this.stats.totalFailed += result.failed;
    this.stats.queueSize = this.queue.length;

    // Update average processing time
    if (result.totalProcessed > 0) {
      const totalProcessed = this.stats.totalSuccessful + this.stats.totalFailed;
      if (totalProcessed > 0) {
        this.stats.averageProcessingTime =
          (this.stats.averageProcessingTime * (totalProcessed - result.totalProcessed) + result.duration) /
          totalProcessed;
      }
    }
  }

  /**
   * Update statistics calculations
   */
  private updateStatsCalculations(): void {
    // Update priority and operation breakdowns
    this.stats.itemsByPriority = {
      immediate: 0,
      critical: 0,
      high: 0,
      medium: 0,
      normal: 0,
      low: 0,
    };

    this.stats.itemsByOperation = {
      create: 0,
      update: 0,
      delete: 0,
      sync: 0,
    };

    for (const item of this.queue) {
      this.stats.itemsByPriority[item.priority]++;
      this.stats.itemsByOperation[item.operation]++;
    }

    this.stats.totalItems = this.queue.length;
    this.stats.queueSize = this.queue.length;
  }

  /**
   * Create empty batch result
   */
  private createEmptyBatchResult(): BatchProcessingResult {
    return {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      duration: 0,
      results: [],
      processedAt: new Date().toISOString(),
    };
  }

  /**
   * Generate operation ID
   */
  private generateOperationId(): string {
    return `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get device ID
   */
  private getDeviceId(): string {
    const stored = localStorage.getItem('offline-queue-device-id');
    if (stored) return stored;

    const deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('offline-queue-device-id', deviceId);
    return deviceId;
  }

  /**
   * Initialize offline queue statistics
   */
  private initializeStats(): OfflineQueueStats {
    return {
      totalItems: 0,
      totalQueued: 0,
      itemsByPriority: {
        immediate: 0,
        critical: 0,
        high: 0,
        medium: 0,
        normal: 0,
        low: 0,
      },
      itemsByOperation: {
        create: 0,
        update: 0,
        delete: 0,
        sync: 0,
      },
      totalFailed: 0,
      totalSuccessful: 0,
      queueSize: 0,
      averageProcessingTime: 0,
    };
  }
}
