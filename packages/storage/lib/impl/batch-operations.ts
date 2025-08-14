/**
 * Batch operations manager for performance optimization
 * Implements batched read/write operations with transaction-like semantics
 */

/**
 * Batch operation types
 */
export type BatchOperationType = 'read' | 'write' | 'delete' | 'clear' | 'update';

/**
 * Individual batch operation
 */
export interface BatchOperation {
  /** Operation identifier */
  operationId: string;
  /** Operation type */
  type: BatchOperationType;
  /** Storage key */
  key: string;
  /** Data for write/update operations */
  data?: unknown;
  /** Conditional update data */
  conditions?:
    | {
        /** Only if key exists */
        ifExists?: boolean | undefined;
        /** Only if key doesn't exist */
        ifNotExists?: boolean | undefined;
        /** Expected value for conditional update */
        expectedValue?: unknown;
        /** Version for optimistic locking */
        expectedVersion?: number | undefined;
      }
    | undefined;
  /** Operation metadata */
  metadata?:
    | {
        /** Operation priority */
        priority?: 'low' | 'normal' | 'high' | 'critical' | undefined;
        /** Operation timeout */
        timeout?: number | undefined;
        /** Retry attempts */
        retryAttempts?: number | undefined;
        /** Tags for grouping */
        tags?: string[] | undefined;
      }
    | undefined;
}

/**
 * Batch operation result
 */
export interface BatchOperationResult {
  /** Operation identifier */
  operationId: string;
  /** Whether operation succeeded */
  success: boolean;
  /** Result data for read operations */
  data?: unknown;
  /** Error message if failed */
  error?: string;
  /** Operation duration in milliseconds */
  duration: number;
  /** Bytes processed */
  bytesProcessed: number;
  /** Operation timestamp */
  timestamp: string;
}

/**
 * Batch execution result
 */
export interface BatchExecutionResult {
  /** Batch identifier */
  batchId: string;
  /** Total operations in batch */
  totalOperations: number;
  /** Successful operations */
  successfulOperations: number;
  /** Failed operations */
  failedOperations: number;
  /** Individual operation results */
  results: BatchOperationResult[];
  /** Total execution duration */
  totalDuration: number;
  /** Total bytes processed */
  totalBytesProcessed: number;
  /** Batch execution timestamp */
  executedAt: string;
  /** Transaction rollback performed */
  rolledBack: boolean;
  /** Overall batch success */
  success: boolean;
}

/**
 * Batch transaction options
 */
export interface BatchTransactionOptions {
  /** Enable atomic transactions */
  atomic: boolean;
  /** Auto-rollback on partial failure */
  autoRollback: boolean;
  /** Maximum batch size */
  maxBatchSize: number;
  /** Batch timeout in milliseconds */
  timeout: number;
  /** Enable operation ordering */
  preserveOrder: boolean;
  /** Enable parallel execution */
  enableParallel: boolean;
  /** Maximum parallel operations */
  maxParallel: number;
}

/**
 * Batch performance metrics
 */
export interface BatchPerformanceMetrics {
  /** Total batches executed */
  totalBatches: number;
  /** Total operations processed */
  totalOperations: number;
  /** Average batch size */
  averageBatchSize: number;
  /** Average batch duration */
  averageBatchDuration: number;
  /** Average operations per second */
  operationsPerSecond: number;
  /** Success rate percentage */
  successRate: number;
  /** Rollback rate percentage */
  rollbackRate: number;
  /** Performance by operation type */
  performanceByType: Record<
    BatchOperationType,
    {
      count: number;
      averageDuration: number;
      successRate: number;
    }
  >;
  /** Batch size distribution */
  batchSizeDistribution: Record<string, number>;
  /** Last execution timestamp */
  lastExecution?: string;
  /** Metrics timestamp */
  timestamp: string;
}

/**
 * Batch operations manager configuration
 */
export interface BatchOperationsConfig {
  /** Default batch size */
  defaultBatchSize: number;
  /** Maximum batch size */
  maxBatchSize: number;
  /** Batch timeout */
  defaultTimeout: number;
  /** Enable transactions */
  enableTransactions: boolean;
  /** Default transaction options */
  defaultTransactionOptions: BatchTransactionOptions;
  /** Performance tracking */
  enablePerformanceTracking: boolean;
  /** Auto-flush settings */
  autoFlush: {
    /** Enable auto-flush */
    enabled: boolean;
    /** Flush interval in milliseconds */
    interval: number;
    /** Flush threshold (number of pending operations) */
    threshold: number;
  };
  /** Storage layer settings */
  storage: {
    /** Enable compression for large batches */
    enableCompression: boolean;
    /** Compression threshold in bytes */
    compressionThreshold: number;
    /** Enable integrity checks */
    enableIntegrityChecks: boolean;
  };
}

/**
 * Pending batch context
 */
interface PendingBatch {
  /** Batch identifier */
  batchId: string;
  /** Operations in batch */
  operations: BatchOperation[];
  /** Transaction options */
  options: BatchTransactionOptions;
  /** Created timestamp */
  createdAt: string;
  /** Promise resolver */
  resolve: (result: BatchExecutionResult) => void;
  /** Promise rejector */
  reject: (error: Error) => void;
}

/**
 * Batch operations manager with transaction support
 */
export class BatchOperationsManager {
  private config: BatchOperationsConfig;
  private pendingOperations: BatchOperation[] = [];
  private activeBatches = new Map<string, Promise<BatchExecutionResult>>();
  private metrics: BatchPerformanceMetrics;
  private autoFlushTimer: NodeJS.Timeout | null = null;

  // Storage backup for rollback operations
  private transactionBackups = new Map<string, Record<string, unknown>>();

  constructor(config: Partial<BatchOperationsConfig> = {}) {
    this.config = {
      defaultBatchSize: config.defaultBatchSize || 50,
      maxBatchSize: config.maxBatchSize || 100,
      defaultTimeout: config.defaultTimeout || 30000,
      enableTransactions: config.enableTransactions !== false,
      defaultTransactionOptions: {
        atomic: true,
        autoRollback: true,
        maxBatchSize: 100,
        timeout: 30000,
        preserveOrder: true,
        enableParallel: false,
        maxParallel: 5,
        ...config.defaultTransactionOptions,
      },
      enablePerformanceTracking: config.enablePerformanceTracking !== false,
      autoFlush: {
        enabled: true,
        interval: 5000, // 5 seconds
        threshold: 20, // 20 operations
        ...config.autoFlush,
      },
      storage: {
        enableCompression: true,
        compressionThreshold: 10240, // 10KB
        enableIntegrityChecks: true,
        ...config.storage,
      },
    };

    this.metrics = this.initializeMetrics();

    if (this.config.autoFlush.enabled) {
      this.startAutoFlush();
    }
  }

  /**
   * Add operation to batch
   */
  addOperation(operation: Omit<BatchOperation, 'operationId'>): string {
    const operationId = this.generateOperationId();
    const batchOperation: BatchOperation = {
      ...operation,
      operationId,
    };

    this.pendingOperations.push(batchOperation);

    console.debug(`[BatchOperationsManager] Operation added: ${operationId} (${operation.type}:${operation.key})`);

    // Auto-flush if threshold reached
    if (this.config.autoFlush.enabled && this.pendingOperations.length >= this.config.autoFlush.threshold) {
      setImmediate(() => this.flush());
    }

    return operationId;
  }

  /**
   * Add read operation
   */
  addRead(key: string, metadata?: BatchOperation['metadata']): string {
    return this.addOperation({
      type: 'read',
      key,
      metadata,
    });
  }

  /**
   * Add write operation
   */
  addWrite(key: string, data: unknown, metadata?: BatchOperation['metadata']): string {
    return this.addOperation({
      type: 'write',
      key,
      data,
      metadata,
    });
  }

  /**
   * Add conditional update operation
   */
  addConditionalUpdate(
    key: string,
    data: unknown,
    conditions: BatchOperation['conditions'],
    metadata?: BatchOperation['metadata'],
  ): string {
    return this.addOperation({
      type: 'update',
      key,
      data,
      conditions,
      metadata,
    });
  }

  /**
   * Add delete operation
   */
  addDelete(key: string, metadata?: BatchOperation['metadata']): string {
    return this.addOperation({
      type: 'delete',
      key,
      metadata,
    });
  }

  /**
   * Execute batch operations immediately
   */
  async flush(options?: Partial<BatchTransactionOptions>): Promise<BatchExecutionResult> {
    if (this.pendingOperations.length === 0) {
      return this.createEmptyBatchResult();
    }

    const batchId = this.generateBatchId();
    const operations = [...this.pendingOperations];
    this.pendingOperations = [];

    const transactionOptions = {
      ...this.config.defaultTransactionOptions,
      ...options,
    };

    console.log(`[BatchOperationsManager] Executing batch: ${batchId} (${operations.length} operations)`);

    return await this.executeBatch(batchId, operations, transactionOptions);
  }

  /**
   * Execute specific operations as a batch
   */
  async executeBatch(
    batchId: string,
    operations: BatchOperation[],
    options: BatchTransactionOptions,
  ): Promise<BatchExecutionResult> {
    const startTime = Date.now();

    // Check if batch is already being executed
    if (this.activeBatches.has(batchId)) {
      return await this.activeBatches.get(batchId)!;
    }

    // Create batch execution promise
    const batchPromise = this.performBatchExecution(batchId, operations, options);
    this.activeBatches.set(batchId, batchPromise);

    try {
      const result = await batchPromise;

      // Update metrics
      if (this.config.enablePerformanceTracking) {
        this.updateMetrics(result);
      }

      return result;
    } finally {
      this.activeBatches.delete(batchId);
    }
  }

  /**
   * Get pending operations count
   */
  getPendingCount(): number {
    return this.pendingOperations.length;
  }

  /**
   * Get active batches count
   */
  getActiveBatchesCount(): number {
    return this.activeBatches.size;
  }

  /**
   * Get batch performance metrics
   */
  getMetrics(): BatchPerformanceMetrics {
    this.updateMetricsCalculations();
    return { ...this.metrics };
  }

  /**
   * Clear all pending operations
   */
  clearPending(): number {
    const count = this.pendingOperations.length;
    this.pendingOperations = [];
    console.log(`[BatchOperationsManager] Cleared ${count} pending operations`);
    return count;
  }

  /**
   * Update batch operations configuration
   */
  updateConfig(config: Partial<BatchOperationsConfig>): void {
    const wasAutoFlushEnabled = this.config.autoFlush.enabled;
    this.config = { ...this.config, ...config };

    // Handle auto-flush timer changes
    if (this.config.autoFlush.enabled && !wasAutoFlushEnabled) {
      this.startAutoFlush();
    } else if (!this.config.autoFlush.enabled && wasAutoFlushEnabled) {
      this.stopAutoFlush();
    } else if (this.config.autoFlush.enabled) {
      // Restart with new interval
      this.stopAutoFlush();
      this.startAutoFlush();
    }

    console.log('[BatchOperationsManager] Configuration updated');
  }

  /**
   * Shutdown batch operations manager
   */
  async shutdown(): Promise<void> {
    console.log('[BatchOperationsManager] Shutting down');

    this.stopAutoFlush();

    // Execute remaining pending operations
    if (this.pendingOperations.length > 0) {
      console.log(`[BatchOperationsManager] Flushing ${this.pendingOperations.length} pending operations`);
      await this.flush();
    }

    // Wait for active batches to complete
    if (this.activeBatches.size > 0) {
      console.log(`[BatchOperationsManager] Waiting for ${this.activeBatches.size} active batches`);
      await Promise.allSettled(this.activeBatches.values());
    }

    this.pendingOperations = [];
    this.activeBatches.clear();
    this.transactionBackups.clear();

    console.log('[BatchOperationsManager] Shutdown completed');
  }

  /**
   * Perform actual batch execution
   */
  private async performBatchExecution(
    batchId: string,
    operations: BatchOperation[],
    options: BatchTransactionOptions,
  ): Promise<BatchExecutionResult> {
    const startTime = Date.now();
    const results: BatchOperationResult[] = [];
    let totalBytesProcessed = 0;
    let rolledBack = false;

    try {
      // Create backup for atomic transactions
      if (options.atomic && this.config.enableTransactions) {
        await this.createTransactionBackup(batchId, operations);
      }

      // Split into smaller batches if needed
      const batches = this.splitIntoBatches(operations, options.maxBatchSize);

      for (const batch of batches) {
        let batchResults: BatchOperationResult[];

        if (options.enableParallel && !options.preserveOrder) {
          batchResults = await this.executeParallelBatch(batch, options);
        } else {
          batchResults = await this.executeSequentialBatch(batch, options);
        }

        results.push(...batchResults);
        totalBytesProcessed += batchResults.reduce((sum, r) => sum + r.bytesProcessed, 0);

        // Check for failures in atomic mode
        if (options.atomic && batchResults.some(r => !r.success)) {
          if (options.autoRollback) {
            await this.rollbackTransaction(batchId);
            rolledBack = true;
            break;
          }
        }
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.length - successful;

      const batchResult: BatchExecutionResult = {
        batchId,
        totalOperations: operations.length,
        successfulOperations: successful,
        failedOperations: failed,
        results,
        totalDuration: Date.now() - startTime,
        totalBytesProcessed,
        executedAt: new Date().toISOString(),
        rolledBack,
        success: failed === 0 && !rolledBack,
      };

      // Cleanup transaction backup
      if (options.atomic && this.config.enableTransactions) {
        this.transactionBackups.delete(batchId);
      }

      console.log(
        `[BatchOperationsManager] Batch completed: ${batchId} (${successful}/${operations.length} successful)`,
      );

      return batchResult;
    } catch (error) {
      // Rollback on error if atomic
      if (options.atomic && options.autoRollback && this.config.enableTransactions) {
        try {
          await this.rollbackTransaction(batchId);
          rolledBack = true;
        } catch (rollbackError) {
          console.error(`[BatchOperationsManager] Rollback failed for ${batchId}:`, rollbackError);
        }
      }

      throw new Error(`Batch execution failed: ${error}`);
    }
  }

  /**
   * Execute batch operations in parallel
   */
  private async executeParallelBatch(
    operations: BatchOperation[],
    options: BatchTransactionOptions,
  ): Promise<BatchOperationResult[]> {
    const maxParallel = Math.min(operations.length, options.maxParallel);
    const results: BatchOperationResult[] = [];

    // Execute in parallel chunks
    for (let i = 0; i < operations.length; i += maxParallel) {
      const chunk = operations.slice(i, i + maxParallel);
      const chunkPromises = chunk.map(op => this.executeOperation(op));

      const chunkResults = await Promise.allSettled(chunkPromises);

      for (let j = 0; j < chunkResults.length; j++) {
        const result = chunkResults[j];
        const operation = chunk[j];
        if (!result || !operation) continue;

        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            operationId: operation.operationId,
            success: false,
            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
            duration: 0,
            bytesProcessed: 0,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    return results;
  }

  /**
   * Execute batch operations sequentially
   */
  private async executeSequentialBatch(
    operations: BatchOperation[],
    options: BatchTransactionOptions,
  ): Promise<BatchOperationResult[]> {
    const results: BatchOperationResult[] = [];

    for (const operation of operations) {
      try {
        const result = await this.executeOperation(operation);
        results.push(result);
      } catch (error) {
        results.push({
          operationId: operation.operationId,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          duration: 0,
          bytesProcessed: 0,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return results;
  }

  /**
   * Execute individual operation
   */
  private async executeOperation(operation: BatchOperation): Promise<BatchOperationResult> {
    const startTime = Date.now();

    try {
      let data: unknown;
      let bytesProcessed = 0;

      switch (operation.type) {
        case 'read': {
          const result = await chrome.storage.local.get(operation.key);
          data = result[operation.key];
          bytesProcessed = this.calculateDataSize(result);
          break;
        }

        case 'write': {
          const writeData = { [operation.key]: operation.data };
          await chrome.storage.local.set(writeData);
          data = operation.data;
          bytesProcessed = this.calculateDataSize(writeData);
          break;
        }

        case 'update': {
          if (operation.conditions) {
            const existing = await chrome.storage.local.get(operation.key);
            const hasKey = operation.key in existing;

            // Check conditions
            if (operation.conditions.ifExists && !hasKey) {
              throw new Error('Key does not exist');
            }
            if (operation.conditions.ifNotExists && hasKey) {
              throw new Error('Key already exists');
            }
            if (
              operation.conditions.expectedValue !== undefined &&
              existing[operation.key] !== operation.conditions.expectedValue
            ) {
              throw new Error('Expected value mismatch');
            }
          }

          const updateData = { [operation.key]: operation.data };
          await chrome.storage.local.set(updateData);
          data = operation.data;
          bytesProcessed = this.calculateDataSize(updateData);
          break;
        }

        case 'delete': {
          await chrome.storage.local.remove(operation.key);
          bytesProcessed = operation.key.length;
          break;
        }

        case 'clear': {
          await chrome.storage.local.clear();
          bytesProcessed = 0;
          break;
        }

        default:
          throw new Error(`Unsupported operation type: ${operation.type}`);
      }

      return {
        operationId: operation.operationId,
        success: true,
        data,
        duration: Date.now() - startTime,
        bytesProcessed,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        operationId: operation.operationId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
        bytesProcessed: 0,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Create transaction backup
   */
  private async createTransactionBackup(batchId: string, operations: BatchOperation[]): Promise<void> {
    try {
      const keysToBackup = operations
        .filter(op => op.type === 'write' || op.type === 'update' || op.type === 'delete')
        .map(op => op.key);

      if (keysToBackup.length === 0) return;

      const backup = await chrome.storage.local.get(keysToBackup);
      this.transactionBackups.set(batchId, backup);
    } catch (error) {
      console.warn(`[BatchOperationsManager] Failed to create backup for ${batchId}:`, error);
    }
  }

  /**
   * Rollback transaction
   */
  private async rollbackTransaction(batchId: string): Promise<void> {
    const backup = this.transactionBackups.get(batchId);
    if (!backup) {
      console.warn(`[BatchOperationsManager] No backup found for rollback: ${batchId}`);
      return;
    }

    try {
      // Restore backed up data
      const keysToRestore = Object.keys(backup);
      if (keysToRestore.length > 0) {
        await chrome.storage.local.set(backup);
      }

      console.log(
        `[BatchOperationsManager] Transaction rolled back: ${batchId} (${keysToRestore.length} keys restored)`,
      );
    } catch (error) {
      console.error(`[BatchOperationsManager] Rollback failed for ${batchId}:`, error);
      throw error;
    }
  }

  /**
   * Split operations into smaller batches
   */
  private splitIntoBatches(operations: BatchOperation[], maxBatchSize: number): BatchOperation[][] {
    const batches: BatchOperation[][] = [];

    for (let i = 0; i < operations.length; i += maxBatchSize) {
      batches.push(operations.slice(i, i + maxBatchSize));
    }

    return batches;
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
   * Start auto-flush timer
   */
  private startAutoFlush(): void {
    if (this.autoFlushTimer) return;

    this.autoFlushTimer = setInterval(() => {
      if (this.pendingOperations.length > 0) {
        this.flush();
      }
    }, this.config.autoFlush.interval);

    console.log(`[BatchOperationsManager] Auto-flush started (${this.config.autoFlush.interval}ms)`);
  }

  /**
   * Stop auto-flush timer
   */
  private stopAutoFlush(): void {
    if (this.autoFlushTimer) {
      clearInterval(this.autoFlushTimer);
      this.autoFlushTimer = null;
      console.log('[BatchOperationsManager] Auto-flush stopped');
    }
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(result: BatchExecutionResult): void {
    this.metrics.totalBatches++;
    this.metrics.totalOperations += result.totalOperations;

    // Update averages
    this.metrics.averageBatchSize = this.metrics.totalOperations / this.metrics.totalBatches;
    this.metrics.averageBatchDuration =
      (this.metrics.averageBatchDuration * (this.metrics.totalBatches - 1) + result.totalDuration) /
      this.metrics.totalBatches;

    // Update rates
    const totalSuccessful = this.metrics.totalOperations - result.failedOperations;
    this.metrics.successRate = (totalSuccessful / this.metrics.totalOperations) * 100;

    if (result.rolledBack) {
      this.metrics.rollbackRate =
        (this.metrics.rollbackRate * (this.metrics.totalBatches - 1) + 100) / this.metrics.totalBatches;
    }

    // Update performance by type
    for (const opResult of result.results) {
      const operation = opResult.operationId;
      // This is simplified - in a real implementation you'd track the operation type
      const type: BatchOperationType = 'write'; // Placeholder

      if (!this.metrics.performanceByType[type]) {
        this.metrics.performanceByType[type] = {
          count: 0,
          averageDuration: 0,
          successRate: 0,
        };
      }

      const typeMetrics = this.metrics.performanceByType[type];
      typeMetrics.count++;
      typeMetrics.averageDuration =
        (typeMetrics.averageDuration * (typeMetrics.count - 1) + opResult.duration) / typeMetrics.count;
      typeMetrics.successRate =
        (typeMetrics.successRate * (typeMetrics.count - 1) + (opResult.success ? 100 : 0)) / typeMetrics.count;
    }

    // Update batch size distribution
    const sizeRange = this.getBatchSizeRange(result.totalOperations);
    this.metrics.batchSizeDistribution[sizeRange] = (this.metrics.batchSizeDistribution[sizeRange] || 0) + 1;

    this.metrics.lastExecution = result.executedAt;
  }

  /**
   * Update metrics calculations
   */
  private updateMetricsCalculations(): void {
    if (this.metrics.totalBatches > 0 && this.metrics.averageBatchDuration > 0) {
      this.metrics.operationsPerSecond = this.metrics.averageBatchSize / (this.metrics.averageBatchDuration / 1000);
    }
    this.metrics.timestamp = new Date().toISOString();
  }

  /**
   * Get batch size range for distribution tracking
   */
  private getBatchSizeRange(size: number): string {
    if (size <= 10) return '1-10';
    if (size <= 25) return '11-25';
    if (size <= 50) return '26-50';
    if (size <= 100) return '51-100';
    return '100+';
  }

  /**
   * Create empty batch result
   */
  private createEmptyBatchResult(): BatchExecutionResult {
    return {
      batchId: this.generateBatchId(),
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      results: [],
      totalDuration: 0,
      totalBytesProcessed: 0,
      executedAt: new Date().toISOString(),
      rolledBack: false,
      success: true,
    };
  }

  /**
   * Generate operation ID
   */
  private generateOperationId(): string {
    return `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate batch ID
   */
  private generateBatchId(): string {
    return `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Initialize performance metrics
   */
  private initializeMetrics(): BatchPerformanceMetrics {
    return {
      totalBatches: 0,
      totalOperations: 0,
      averageBatchSize: 0,
      averageBatchDuration: 0,
      operationsPerSecond: 0,
      successRate: 0,
      rollbackRate: 0,
      performanceByType: {
        read: { count: 0, averageDuration: 0, successRate: 0 },
        write: { count: 0, averageDuration: 0, successRate: 0 },
        delete: { count: 0, averageDuration: 0, successRate: 0 },
        clear: { count: 0, averageDuration: 0, successRate: 0 },
        update: { count: 0, averageDuration: 0, successRate: 0 },
      },
      batchSizeDistribution: {},
      timestamp: new Date().toISOString(),
    };
  }
}
