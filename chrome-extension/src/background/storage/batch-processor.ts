/**
 * Batch processor for optimized storage operations
 * Implements batched storage operations with intelligent queuing and transaction management
 */

/**
 * Batch operation types
 */
export type BatchOperation = 'read' | 'write' | 'delete' | 'clear';

/**
 * Storage layer for batch operations
 */
export type BatchStorageLayer = 'memory' | 'local' | 'sync' | 'session' | 'indexeddb';

/**
 * Batch processing strategy
 */
export type BatchStrategy = 'immediate' | 'time_based' | 'size_based' | 'adaptive';

/**
 * Individual batch operation
 */
export interface BatchOperationItem {
  /** Operation identifier */
  operationId: string;
  /** Operation type */
  type: BatchOperation;
  /** Target storage layer */
  layer: BatchStorageLayer;
  /** Storage key */
  key: string;
  /** Data payload (for write operations) */
  data?: unknown;
  /** Operation priority */
  priority: 'low' | 'normal' | 'high' | 'critical';
  /** Operation options */
  options?: {
    /** Enable compression */
    compress?: boolean;
    /** TTL for cache entries */
    ttl?: number;
    /** Merge strategy for conflicts */
    mergeStrategy?: 'overwrite' | 'merge' | 'preserve';
    /** Retry count */
    retryCount?: number;
  };
  /** Operation timestamp */
  timestamp: string;
  /** Completion callback */
  callback?: (result: BatchOperationResult) => void;
}

/**
 * Batch operation result
 */
export interface BatchOperationResult {
  /** Operation identifier */
  operationId: string;
  /** Whether operation was successful */
  success: boolean;
  /** Result data (for read operations) */
  data?: unknown;
  /** Error message if failed */
  error?: string;
  /** Execution duration in milliseconds */
  duration: number;
  /** Execution timestamp */
  executedAt: string;
}

/**
 * Batch processing result
 */
export interface BatchProcessingResult {
  /** Batch identifier */
  batchId: string;
  /** Total operations processed */
  totalOperations: number;
  /** Successful operations */
  successfulOperations: number;
  /** Failed operations */
  failedOperations: number;
  /** Batch processing duration */
  duration: number;
  /** Individual operation results */
  results: BatchOperationResult[];
  /** Batch processing details */
  details: {
    /** Operations by type */
    operationsByType: Record<BatchOperation, number>;
    /** Operations by layer */
    operationsByLayer: Record<BatchStorageLayer, number>;
    /** Errors encountered */
    errors: string[];
    /** Warnings generated */
    warnings: string[];
  };
  /** Processing timestamp */
  timestamp: string;
}

/**
 * Batch queue configuration
 */
export interface BatchQueueConfig {
  /** Maximum batch size */
  maxBatchSize: number;
  /** Maximum wait time before processing (ms) */
  maxWaitTime: number;
  /** Minimum batch size to trigger processing */
  minBatchSize: number;
  /** Enable automatic batching */
  enableAutoBatching: boolean;
  /** Batch processing strategy */
  strategy: BatchStrategy;
  /** Priority-based processing */
  priorityProcessing: boolean;
  /** Maximum concurrent batches */
  maxConcurrentBatches: number;
  /** Retry configuration */
  retryConfig: {
    /** Maximum retry attempts */
    maxRetries: number;
    /** Base retry delay in milliseconds */
    baseRetryDelay: number;
    /** Exponential backoff multiplier */
    backoffMultiplier: number;
  };
}

/**
 * Batch queue statistics
 */
export interface BatchQueueStats {
  /** Total batches processed */
  totalBatches: number;
  /** Total operations processed */
  totalOperations: number;
  /** Successful batches */
  successfulBatches: number;
  /** Failed batches */
  failedBatches: number;
  /** Average batch size */
  avgBatchSize: number;
  /** Average processing time */
  avgProcessingTime: number;
  /** Queue size by priority */
  queueSizeByPriority: Record<string, number>;
  /** Operations by type */
  operationsByType: Record<BatchOperation, number>;
  /** Operations by layer */
  operationsByLayer: Record<BatchStorageLayer, number>;
  /** Throughput (operations per second) */
  throughput: number;
  /** Cache hit rate for read operations */
  cacheHitRate: number;
  /** Last processing timestamp */
  lastProcessing?: string;
  /** Statistics update timestamp */
  lastUpdated: string;
}

/**
 * Batch processing queue
 */
interface BatchQueue {
  /** Queue items by priority */
  critical: BatchOperationItem[];
  high: BatchOperationItem[];
  normal: BatchOperationItem[];
  low: BatchOperationItem[];
}

/**
 * Batch processor for optimized storage operations
 */
export class BatchProcessor {
  private config: BatchQueueConfig;
  private queue: BatchQueue;
  private stats: BatchQueueStats;
  private processingTimer: NodeJS.Timeout | null = null;
  private activeBatches = new Set<string>();
  private operationCallbacks = new Map<string, (result: BatchOperationResult) => void>();

  constructor(config: Partial<BatchQueueConfig> = {}) {
    this.config = {
      maxBatchSize: 50,
      maxWaitTime: 5000, // 5 seconds
      minBatchSize: 5,
      enableAutoBatching: true,
      strategy: 'adaptive',
      priorityProcessing: true,
      maxConcurrentBatches: 3,
      retryConfig: {
        maxRetries: 3,
        baseRetryDelay: 1000,
        backoffMultiplier: 2,
      },
      ...config,
    };

    this.queue = {
      critical: [],
      high: [],
      normal: [],
      low: [],
    };

    this.stats = this.initializeStats();

    if (this.config.enableAutoBatching) {
      this.startAutoBatching();
    }
  }

  /**
   * Add operation to batch queue
   */
  async addOperation(operation: Omit<BatchOperationItem, 'operationId' | 'timestamp'>): Promise<string> {
    const operationId = `batch-op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const batchItem: BatchOperationItem = {
      ...operation,
      operationId,
      timestamp: new Date().toISOString(),
    };

    // Add to appropriate priority queue
    this.queue[operation.priority].push(batchItem);

    // Store callback if provided
    if (operation.callback) {
      this.operationCallbacks.set(operationId, operation.callback);
    }

    console.log(
      `[BatchProcessor] Operation queued: ${operationId} (${operation.type}:${operation.layer}:${operation.key})`,
    );

    // Trigger immediate processing for critical operations
    if (operation.priority === 'critical' || this.shouldTriggerImmediate()) {
      this.triggerBatchProcessing();
    }

    return operationId;
  }

  /**
   * Process batch immediately
   */
  async processBatch(operations?: BatchOperationItem[]): Promise<BatchProcessingResult> {
    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    console.log(`[BatchProcessor] Processing batch: ${batchId}`);

    try {
      this.activeBatches.add(batchId);

      // Use provided operations or collect from queue
      const batchOperations = operations || this.collectBatchOperations();

      if (batchOperations.length === 0) {
        return this.createEmptyBatchResult(batchId, startTime);
      }

      // Group operations by layer for efficient processing
      const operationsByLayer = this.groupOperationsByLayer(batchOperations);

      // Process operations by layer
      const results: BatchOperationResult[] = [];
      const errors: string[] = [];
      const warnings: string[] = [];

      for (const [layer, layerOperations] of operationsByLayer.entries()) {
        try {
          const layerResults = await this.processLayerOperations(layer, layerOperations);
          results.push(...layerResults);
        } catch (error) {
          const errorMessage = `Layer ${layer} processing failed: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMessage);
          console.error(`[BatchProcessor] ${errorMessage}`);

          // Create failure results for this layer's operations
          for (const operation of layerOperations) {
            results.push(this.createFailureResult(operation, errorMessage, startTime));
          }
        }
      }

      // Create batch result
      const batchResult = this.createBatchResult(batchId, batchOperations, results, errors, warnings, startTime);

      // Execute callbacks
      this.executeCallbacks(results);

      // Update statistics
      this.updateBatchStats(batchResult);

      console.log(
        `[BatchProcessor] Batch completed: ${batchId} (${results.length} operations, ${batchResult.duration}ms)`,
      );

      return batchResult;
    } finally {
      this.activeBatches.delete(batchId);
    }
  }

  /**
   * Process read operations in batch
   */
  async batchRead(
    keys: string[],
    layer: BatchStorageLayer,
    options?: {
      priority?: 'low' | 'normal' | 'high' | 'critical';
      enableCaching?: boolean;
    },
  ): Promise<Record<string, unknown>> {
    const operations: BatchOperationItem[] = keys.map(key => ({
      operationId: `read-${key}-${Date.now()}`,
      type: 'read' as const,
      layer,
      key,
      priority: options?.priority || 'normal',
      timestamp: new Date().toISOString(),
      options: {
        ...options,
      },
    }));

    const result = await this.processBatch(operations);
    const readResults: Record<string, unknown> = {};

    for (const opResult of result.results) {
      if (opResult.success && opResult.data !== undefined) {
        const operation = operations.find(op => op.operationId === opResult.operationId);
        if (operation) {
          readResults[operation.key] = opResult.data;
        }
      }
    }

    return readResults;
  }

  /**
   * Process write operations in batch
   */
  async batchWrite(
    data: Record<string, unknown>,
    layer: BatchStorageLayer,
    options?: {
      priority?: 'low' | 'normal' | 'high' | 'critical';
      compress?: boolean;
      ttl?: number;
    },
  ): Promise<string[]> {
    const operations: BatchOperationItem[] = Object.entries(data).map(([key, value]) => ({
      operationId: `write-${key}-${Date.now()}`,
      type: 'write' as const,
      layer,
      key,
      data: value,
      priority: options?.priority || 'normal',
      timestamp: new Date().toISOString(),
      options: {
        ...options,
      },
    }));

    const result = await this.processBatch(operations);
    return result.results.filter(r => r.success).map(r => r.operationId);
  }

  /**
   * Process delete operations in batch
   */
  async batchDelete(
    keys: string[],
    layer: BatchStorageLayer,
    options?: {
      priority?: 'low' | 'normal' | 'high' | 'critical';
    },
  ): Promise<string[]> {
    const operations: BatchOperationItem[] = keys.map(key => ({
      operationId: `delete-${key}-${Date.now()}`,
      type: 'delete' as const,
      layer,
      key,
      priority: options?.priority || 'normal',
      timestamp: new Date().toISOString(),
      options: {
        ...options,
      },
    }));

    const result = await this.processBatch(operations);
    return result.results.filter(r => r.success).map(r => r.operationId);
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    totalItems: number;
    itemsByPriority: Record<string, number>;
    activeBatches: number;
    estimatedProcessingTime: number;
  } {
    const itemsByPriority = {
      critical: this.queue.critical.length,
      high: this.queue.high.length,
      normal: this.queue.normal.length,
      low: this.queue.low.length,
    };

    const totalItems = Object.values(itemsByPriority).reduce((sum, count) => sum + count, 0);
    const estimatedProcessingTime = Math.ceil(totalItems / this.config.maxBatchSize) * this.stats.avgProcessingTime;

    return {
      totalItems,
      itemsByPriority,
      activeBatches: this.activeBatches.size,
      estimatedProcessingTime,
    };
  }

  /**
   * Get batch processing statistics
   */
  getStats(): BatchQueueStats {
    this.updateThroughput();
    this.stats.lastUpdated = new Date().toISOString();
    return { ...this.stats };
  }

  /**
   * Update batch processor configuration
   */
  updateConfig(config: Partial<BatchQueueConfig>): void {
    this.config = { ...this.config, ...config };

    if (this.config.enableAutoBatching && !this.processingTimer) {
      this.startAutoBatching();
    } else if (!this.config.enableAutoBatching && this.processingTimer) {
      this.stopAutoBatching();
    }

    console.log('[BatchProcessor] Configuration updated');
  }

  /**
   * Clear all queued operations
   */
  clearQueue(): number {
    const totalCleared =
      this.queue.critical.length + this.queue.high.length + this.queue.normal.length + this.queue.low.length;

    this.queue.critical = [];
    this.queue.high = [];
    this.queue.normal = [];
    this.queue.low = [];

    this.operationCallbacks.clear();

    console.log(`[BatchProcessor] Queue cleared: ${totalCleared} operations removed`);

    return totalCleared;
  }

  /**
   * Shutdown batch processor
   */
  async shutdown(): Promise<void> {
    console.log('[BatchProcessor] Shutting down');

    this.stopAutoBatching();

    // Wait for active batches to complete
    while (this.activeBatches.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Process remaining queue items
    if (this.getTotalQueueSize() > 0) {
      console.log('[BatchProcessor] Processing remaining queue items during shutdown');
      await this.processBatch();
    }

    this.clearQueue();

    console.log('[BatchProcessor] Shutdown completed');
  }

  /**
   * Collect batch operations from queue
   */
  private collectBatchOperations(): BatchOperationItem[] {
    const operations: BatchOperationItem[] = [];
    const maxSize = this.config.maxBatchSize;

    // Collect by priority order
    const priorityQueues = ['critical', 'high', 'normal', 'low'] as const;

    for (const priority of priorityQueues) {
      const queue = this.queue[priority];
      const takeCount = Math.min(queue.length, maxSize - operations.length);

      if (takeCount > 0) {
        operations.push(...queue.splice(0, takeCount));
      }

      if (operations.length >= maxSize) {
        break;
      }
    }

    return operations;
  }

  /**
   * Group operations by storage layer
   */
  private groupOperationsByLayer(operations: BatchOperationItem[]): Map<BatchStorageLayer, BatchOperationItem[]> {
    const groups = new Map<BatchStorageLayer, BatchOperationItem[]>();

    for (const operation of operations) {
      if (!groups.has(operation.layer)) {
        groups.set(operation.layer, []);
      }
      groups.get(operation.layer)!.push(operation);
    }

    return groups;
  }

  /**
   * Process operations for specific storage layer
   */
  private async processLayerOperations(
    layer: BatchStorageLayer,
    operations: BatchOperationItem[],
  ): Promise<BatchOperationResult[]> {
    const results: BatchOperationResult[] = [];

    switch (layer) {
      case 'memory':
        results.push(...(await this.processMemoryOperations(operations)));
        break;

      case 'local':
        results.push(...(await this.processLocalStorageOperations(operations)));
        break;

      case 'sync':
        results.push(...(await this.processSyncStorageOperations(operations)));
        break;

      case 'session':
        results.push(...(await this.processSessionStorageOperations(operations)));
        break;

      case 'indexeddb':
        results.push(...(await this.processIndexedDBOperations(operations)));
        break;

      default:
        throw new Error(`Unsupported storage layer: ${layer}`);
    }

    return results;
  }

  /**
   * Process Chrome local storage operations
   */
  private async processLocalStorageOperations(operations: BatchOperationItem[]): Promise<BatchOperationResult[]> {
    const results: BatchOperationResult[] = [];

    // Group operations by type for efficient processing
    const readOps = operations.filter(op => op.type === 'read');
    const writeOps = operations.filter(op => op.type === 'write');
    const deleteOps = operations.filter(op => op.type === 'delete');

    // Process read operations in batch
    if (readOps.length > 0) {
      try {
        const keys = readOps.map(op => op.key);
        const startTime = Date.now();
        const result = await chrome.storage.local.get(keys);
        const duration = Date.now() - startTime;

        for (const operation of readOps) {
          const found = operation.key in result;
          results.push({
            operationId: operation.operationId,
            success: true,
            data: found ? result[operation.key] : null,
            duration: duration / readOps.length, // Distribute duration
            executedAt: new Date().toISOString(),
          });
        }
      } catch (error) {
        for (const operation of readOps) {
          results.push(this.createFailureResult(operation, error instanceof Error ? error.message : String(error)));
        }
      }
    }

    // Process write operations in batch
    if (writeOps.length > 0) {
      try {
        const writeData: Record<string, unknown> = {};
        for (const operation of writeOps) {
          writeData[operation.key] = operation.data;
        }

        const startTime = Date.now();
        await chrome.storage.local.set(writeData);
        const duration = Date.now() - startTime;

        for (const operation of writeOps) {
          results.push({
            operationId: operation.operationId,
            success: true,
            duration: duration / writeOps.length,
            executedAt: new Date().toISOString(),
          });
        }
      } catch (error) {
        for (const operation of writeOps) {
          results.push(this.createFailureResult(operation, error instanceof Error ? error.message : String(error)));
        }
      }
    }

    // Process delete operations in batch
    if (deleteOps.length > 0) {
      try {
        const keys = deleteOps.map(op => op.key);
        const startTime = Date.now();
        await chrome.storage.local.remove(keys);
        const duration = Date.now() - startTime;

        for (const operation of deleteOps) {
          results.push({
            operationId: operation.operationId,
            success: true,
            duration: duration / deleteOps.length,
            executedAt: new Date().toISOString(),
          });
        }
      } catch (error) {
        for (const operation of deleteOps) {
          results.push(this.createFailureResult(operation, error instanceof Error ? error.message : String(error)));
        }
      }
    }

    return results;
  }

  /**
   * Process Chrome sync storage operations
   */
  private async processSyncStorageOperations(operations: BatchOperationItem[]): Promise<BatchOperationResult[]> {
    const results: BatchOperationResult[] = [];

    // Group operations by type
    const readOps = operations.filter(op => op.type === 'read');
    const writeOps = operations.filter(op => op.type === 'write');
    const deleteOps = operations.filter(op => op.type === 'delete');

    // Process read operations
    if (readOps.length > 0) {
      try {
        const keys = readOps.map(op => op.key);
        const startTime = Date.now();
        const result = await chrome.storage.sync.get(keys);
        const duration = Date.now() - startTime;

        for (const operation of readOps) {
          const found = operation.key in result;
          results.push({
            operationId: operation.operationId,
            success: true,
            data: found ? result[operation.key] : null,
            duration: duration / readOps.length,
            executedAt: new Date().toISOString(),
          });
        }
      } catch (error) {
        for (const operation of readOps) {
          results.push(this.createFailureResult(operation, error instanceof Error ? error.message : String(error)));
        }
      }
    }

    // Process write operations
    if (writeOps.length > 0) {
      try {
        const writeData: Record<string, unknown> = {};
        for (const operation of writeOps) {
          writeData[operation.key] = operation.data;
        }

        const startTime = Date.now();
        await chrome.storage.sync.set(writeData);
        const duration = Date.now() - startTime;

        for (const operation of writeOps) {
          results.push({
            operationId: operation.operationId,
            success: true,
            duration: duration / writeOps.length,
            executedAt: new Date().toISOString(),
          });
        }
      } catch (error) {
        for (const operation of writeOps) {
          results.push(this.createFailureResult(operation, error instanceof Error ? error.message : String(error)));
        }
      }
    }

    // Process delete operations
    if (deleteOps.length > 0) {
      try {
        const keys = deleteOps.map(op => op.key);
        const startTime = Date.now();
        await chrome.storage.sync.remove(keys);
        const duration = Date.now() - startTime;

        for (const operation of deleteOps) {
          results.push({
            operationId: operation.operationId,
            success: true,
            duration: duration / deleteOps.length,
            executedAt: new Date().toISOString(),
          });
        }
      } catch (error) {
        for (const operation of deleteOps) {
          results.push(this.createFailureResult(operation, error instanceof Error ? error.message : String(error)));
        }
      }
    }

    return results;
  }

  /**
   * Process Chrome session storage operations
   */
  private async processSessionStorageOperations(operations: BatchOperationItem[]): Promise<BatchOperationResult[]> {
    const results: BatchOperationResult[] = [];

    // Group operations by type
    const readOps = operations.filter(op => op.type === 'read');
    const writeOps = operations.filter(op => op.type === 'write');
    const deleteOps = operations.filter(op => op.type === 'delete');

    // Process read operations
    if (readOps.length > 0) {
      try {
        const keys = readOps.map(op => op.key);
        const startTime = Date.now();
        const result = await chrome.storage.session.get(keys);
        const duration = Date.now() - startTime;

        for (const operation of readOps) {
          const found = operation.key in result;
          results.push({
            operationId: operation.operationId,
            success: true,
            data: found ? result[operation.key] : null,
            duration: duration / readOps.length,
            executedAt: new Date().toISOString(),
          });
        }
      } catch (error) {
        for (const operation of readOps) {
          results.push(this.createFailureResult(operation, error instanceof Error ? error.message : String(error)));
        }
      }
    }

    // Process write operations
    if (writeOps.length > 0) {
      try {
        const writeData: Record<string, unknown> = {};
        for (const operation of writeOps) {
          writeData[operation.key] = operation.data;
        }

        const startTime = Date.now();
        await chrome.storage.session.set(writeData);
        const duration = Date.now() - startTime;

        for (const operation of writeOps) {
          results.push({
            operationId: operation.operationId,
            success: true,
            duration: duration / writeOps.length,
            executedAt: new Date().toISOString(),
          });
        }
      } catch (error) {
        for (const operation of writeOps) {
          results.push(this.createFailureResult(operation, error instanceof Error ? error.message : String(error)));
        }
      }
    }

    // Process delete operations
    if (deleteOps.length > 0) {
      try {
        const keys = deleteOps.map(op => op.key);
        const startTime = Date.now();
        await chrome.storage.session.remove(keys);
        const duration = Date.now() - startTime;

        for (const operation of deleteOps) {
          results.push({
            operationId: operation.operationId,
            success: true,
            duration: duration / deleteOps.length,
            executedAt: new Date().toISOString(),
          });
        }
      } catch (error) {
        for (const operation of deleteOps) {
          results.push(this.createFailureResult(operation, error instanceof Error ? error.message : String(error)));
        }
      }
    }

    return results;
  }

  /**
   * Process memory operations (placeholder)
   */
  private async processMemoryOperations(operations: BatchOperationItem[]): Promise<BatchOperationResult[]> {
    // This would integrate with the memory cache from StorageCoordinator
    // For now, return successful placeholders
    return operations.map(operation => ({
      operationId: operation.operationId,
      success: true,
      data: operation.type === 'read' ? null : undefined,
      duration: 1,
      executedAt: new Date().toISOString(),
    }));
  }

  /**
   * Process IndexedDB operations (placeholder)
   */
  private async processIndexedDBOperations(operations: BatchOperationItem[]): Promise<BatchOperationResult[]> {
    // TODO: Implement IndexedDB batch operations
    return operations.map(operation => ({
      operationId: operation.operationId,
      success: false,
      error: 'IndexedDB operations not yet implemented',
      duration: 0,
      executedAt: new Date().toISOString(),
    }));
  }

  /**
   * Create failure result for operation
   */
  private createFailureResult(operation: BatchOperationItem, error: string, baseTime?: number): BatchOperationResult {
    return {
      operationId: operation.operationId,
      success: false,
      error,
      duration: baseTime ? Date.now() - baseTime : 0,
      executedAt: new Date().toISOString(),
    };
  }

  /**
   * Create batch processing result
   */
  private createBatchResult(
    batchId: string,
    operations: BatchOperationItem[],
    results: BatchOperationResult[],
    errors: string[],
    warnings: string[],
    startTime: number,
  ): BatchProcessingResult {
    const successfulOperations = results.filter(r => r.success).length;
    const failedOperations = results.filter(r => !r.success).length;

    const operationsByType: Record<BatchOperation, number> = {
      read: 0,
      write: 0,
      delete: 0,
      clear: 0,
    };

    const operationsByLayer: Record<BatchStorageLayer, number> = {
      memory: 0,
      local: 0,
      sync: 0,
      session: 0,
      indexeddb: 0,
    };

    for (const operation of operations) {
      operationsByType[operation.type]++;
      operationsByLayer[operation.layer]++;
    }

    return {
      batchId,
      totalOperations: operations.length,
      successfulOperations,
      failedOperations,
      duration: Date.now() - startTime,
      results,
      details: {
        operationsByType,
        operationsByLayer,
        errors,
        warnings,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create empty batch result
   */
  private createEmptyBatchResult(batchId: string, startTime: number): BatchProcessingResult {
    return {
      batchId,
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      duration: Date.now() - startTime,
      results: [],
      details: {
        operationsByType: { read: 0, write: 0, delete: 0, clear: 0 },
        operationsByLayer: { memory: 0, local: 0, sync: 0, session: 0, indexeddb: 0 },
        errors: [],
        warnings: ['No operations to process'],
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Execute callbacks for completed operations
   */
  private executeCallbacks(results: BatchOperationResult[]): void {
    for (const result of results) {
      const callback = this.operationCallbacks.get(result.operationId);
      if (callback) {
        try {
          callback(result);
        } catch (error) {
          console.warn(`[BatchProcessor] Callback failed for ${result.operationId}:`, error);
        }
        this.operationCallbacks.delete(result.operationId);
      }
    }
  }

  /**
   * Update batch processing statistics
   */
  private updateBatchStats(result: BatchProcessingResult): void {
    this.stats.totalBatches++;
    this.stats.totalOperations += result.totalOperations;

    if (result.failedOperations === 0) {
      this.stats.successfulBatches++;
    } else {
      this.stats.failedBatches++;
    }

    // Update average batch size
    this.stats.avgBatchSize = this.stats.totalOperations / this.stats.totalBatches;

    // Update average processing time
    this.stats.avgProcessingTime =
      (this.stats.avgProcessingTime * (this.stats.totalBatches - 1) + result.duration) / this.stats.totalBatches;

    // Update operations by type and layer
    for (const [type, count] of Object.entries(result.details.operationsByType)) {
      this.stats.operationsByType[type as BatchOperation] += count;
    }

    for (const [layer, count] of Object.entries(result.details.operationsByLayer)) {
      this.stats.operationsByLayer[layer as BatchStorageLayer] += count;
    }

    this.stats.lastProcessing = result.timestamp;
  }

  /**
   * Update queue size statistics
   */
  private updateQueueSizeStats(): void {
    this.stats.queueSizeByPriority = {
      critical: this.queue.critical.length,
      high: this.queue.high.length,
      normal: this.queue.normal.length,
      low: this.queue.low.length,
    };
  }

  /**
   * Update throughput calculation
   */
  private updateThroughput(): void {
    const recentTimeWindow = 60000; // 1 minute
    const now = Date.now();

    if (this.stats.lastProcessing) {
      const lastProcessingTime = new Date(this.stats.lastProcessing).getTime();
      const timeDiff = now - lastProcessingTime;

      if (timeDiff > 0 && timeDiff <= recentTimeWindow) {
        // Calculate operations per second based on recent activity
        this.stats.throughput = (this.stats.totalOperations / timeDiff) * 1000;
      } else {
        this.stats.throughput = 0; // No recent activity
      }
    }
  }

  /**
   * Check if immediate processing should be triggered
   */
  private shouldTriggerImmediate(): boolean {
    const totalQueueSize = this.getTotalQueueSize();

    return (
      totalQueueSize >= this.config.maxBatchSize ||
      (totalQueueSize >= this.config.minBatchSize && this.config.strategy === 'size_based')
    );
  }

  /**
   * Get total queue size across all priorities
   */
  private getTotalQueueSize(): number {
    return this.queue.critical.length + this.queue.high.length + this.queue.normal.length + this.queue.low.length;
  }

  /**
   * Trigger batch processing
   */
  private triggerBatchProcessing(): void {
    if (this.activeBatches.size >= this.config.maxConcurrentBatches) {
      return; // Too many active batches
    }

    // Schedule immediate processing
    setImmediate(() => {
      this.processBatch().catch(error => {
        console.error('[BatchProcessor] Batch processing failed:', error);
      });
    });
  }

  /**
   * Start automatic batching timer
   */
  private startAutoBatching(): void {
    if (this.processingTimer) {
      return;
    }

    this.processingTimer = setInterval(() => {
      const totalQueueSize = this.getTotalQueueSize();

      if (totalQueueSize >= this.config.minBatchSize) {
        this.triggerBatchProcessing();
      }
    }, this.config.maxWaitTime);

    console.log('[BatchProcessor] Auto-batching started');
  }

  /**
   * Stop automatic batching timer
   */
  private stopAutoBatching(): void {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = null;
      console.log('[BatchProcessor] Auto-batching stopped');
    }
  }

  /**
   * Initialize batch queue statistics
   */
  private initializeStats(): BatchQueueStats {
    return {
      totalBatches: 0,
      totalOperations: 0,
      successfulBatches: 0,
      failedBatches: 0,
      avgBatchSize: 0,
      avgProcessingTime: 0,
      queueSizeByPriority: {
        critical: 0,
        high: 0,
        normal: 0,
        low: 0,
      },
      operationsByType: {
        read: 0,
        write: 0,
        delete: 0,
        clear: 0,
      },
      operationsByLayer: {
        memory: 0,
        local: 0,
        sync: 0,
        session: 0,
        indexeddb: 0,
      },
      throughput: 0,
      cacheHitRate: 0,
      lastUpdated: new Date().toISOString(),
    };
  }
}
