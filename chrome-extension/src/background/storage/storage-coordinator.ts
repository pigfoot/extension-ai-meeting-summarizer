/**
 * Storage coordinator for multi-layer storage coordination
 * Implements StorageCoordinator with transaction management and consistency guarantees
 */

// Storage coordinator types - remove unused imports for lint compliance

/**
 * Storage layer types
 */
export type StorageLayer = 'memory' | 'local' | 'sync' | 'indexeddb' | 'session';

/**
 * Storage operation types
 */
export type StorageOperation = 'read' | 'write' | 'delete' | 'clear' | 'migrate';

/**
 * Transaction isolation levels
 */
export type IsolationLevel = 'read_uncommitted' | 'read_committed' | 'repeatable_read' | 'serializable';

/**
 * Storage transaction context
 */
export interface StorageTransaction {
  /** Transaction identifier */
  transactionId: string;
  /** Isolation level */
  isolationLevel: IsolationLevel;
  /** Operations in this transaction */
  operations: StorageTransactionOperation[];
  /** Transaction status */
  status: 'pending' | 'committed' | 'aborted' | 'failed';
  /** Transaction start time */
  startTime: string;
  /** Transaction timeout in milliseconds */
  timeout: number;
  /** Associated storage layers */
  layers: StorageLayer[];
  /** Transaction metadata */
  metadata: {
    /** Source component */
    source: string;
    /** Transaction priority */
    priority: 'low' | 'normal' | 'high';
    /** Rollback on any failure */
    rollbackOnFailure: boolean;
  };
}

/**
 * Storage transaction operation
 */
export interface StorageTransactionOperation {
  /** Operation identifier */
  operationId: string;
  /** Operation type */
  type: StorageOperation;
  /** Target storage layer */
  layer: StorageLayer;
  /** Storage key */
  key: string;
  /** Data payload (for write operations) */
  data?: unknown;
  /** Operation options */
  options?: {
    /** Enable compression */
    compress?: boolean;
    /** TTL for cache entries */
    ttl?: number;
    /** Merge strategy for conflicts */
    mergeStrategy?: 'overwrite' | 'merge' | 'preserve';
  };
  /** Operation status */
  status: 'pending' | 'completed' | 'failed';
  /** Execution timestamp */
  executedAt?: string;
  /** Error information */
  error?: string;
}

/**
 * Storage layer configuration
 */
export interface StorageLayerConfig {
  /** Layer identifier */
  layer: StorageLayer;
  /** Enable this layer */
  enabled: boolean;
  /** Layer priority (higher = preferred) */
  priority: number;
  /** Maximum storage size in bytes */
  maxSize: number;
  /** Default TTL for entries */
  defaultTTL: number;
  /** Enable compression */
  enableCompression: boolean;
  /** Consistency requirements */
  consistency: {
    /** Require write confirmation */
    requireWriteConfirmation: boolean;
    /** Read preference */
    readPreference: 'fastest' | 'consistent' | 'latest';
    /** Conflict resolution strategy */
    conflictResolution: 'last_write_wins' | 'manual' | 'merge';
  };
}

/**
 * Multi-layer read result
 */
export interface MultiLayerReadResult<T = unknown> {
  /** Retrieved data */
  data: T | null;
  /** Source layer */
  sourceLayer: StorageLayer;
  /** Data timestamp */
  timestamp: string;
  /** Whether data was found */
  found: boolean;
  /** Cache hit/miss information */
  cacheInfo: {
    /** Layers checked */
    layersChecked: StorageLayer[];
    /** Cache hits by layer */
    hits: StorageLayer[];
    /** Cache misses by layer */
    misses: StorageLayer[];
  };
}

/**
 * Storage coordination statistics
 */
export interface StorageCoordinatorStats {
  /** Total operations */
  totalOperations: number;
  /** Operations by type */
  operationsByType: Record<StorageOperation, number>;
  /** Operations by layer */
  operationsByLayer: Record<StorageLayer, number>;
  /** Successful operations */
  successfulOperations: number;
  /** Failed operations */
  failedOperations: number;
  /** Cache hit rate */
  cacheHitRate: number;
  /** Average operation time */
  avgOperationTime: number;
  /** Transaction statistics */
  transactions: {
    /** Total transactions */
    total: number;
    /** Committed transactions */
    committed: number;
    /** Aborted transactions */
    aborted: number;
    /** Average transaction time */
    avgTransactionTime: number;
  };
  /** Storage layer utilization */
  layerUtilization: Record<
    StorageLayer,
    {
      /** Used space in bytes */
      usedSpace: number;
      /** Available space in bytes */
      availableSpace: number;
      /** Utilization percentage */
      utilizationPercent: number;
    }
  >;
  /** Last update timestamp */
  lastUpdated: string;
}

/**
 * Storage coordinator for multi-layer storage management
 */
export class StorageCoordinator {
  private layerConfigs = new Map<StorageLayer, StorageLayerConfig>();
  private activeTransactions = new Map<string, StorageTransaction>();
  private memoryCache = new Map<string, { data: unknown; expires: number; layer: StorageLayer }>();
  private stats: StorageCoordinatorStats;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.stats = this.initializeStats();
    this.setupDefaultLayerConfigs();
    this.startCleanupTask();
  }

  /**
   * Read data with multi-layer coordination
   */
  async read<T = unknown>(
    key: string,
    options?: {
      preferredLayers?: StorageLayer[];
      fallbackLayers?: StorageLayer[];
      enableCaching?: boolean;
    },
  ): Promise<MultiLayerReadResult<T>> {
    const startTime = Date.now();

    try {
      console.log(`[StorageCoordinator] Reading key: ${key}`);

      const result: MultiLayerReadResult<T> = {
        data: null,
        sourceLayer: 'memory',
        timestamp: new Date().toISOString(),
        found: false,
        cacheInfo: {
          layersChecked: [],
          hits: [],
          misses: [],
        },
      };

      // Determine layer order
      const layersToCheck = this.getReadLayerOrder(options?.preferredLayers);

      // Check each layer in order
      for (const layer of layersToCheck) {
        result.cacheInfo.layersChecked.push(layer);

        try {
          const layerResult = await this.readFromLayer<T>(key, layer);

          if (layerResult.found) {
            result.data = layerResult.data;
            result.sourceLayer = layer;
            result.found = true;
            result.timestamp = layerResult.timestamp;
            result.cacheInfo.hits.push(layer);

            // Cache in faster layers if enabled
            if (options?.enableCaching !== false) {
              await this.propagateToFasterLayers(key, layerResult.data, layer);
            }

            break;
          } else {
            result.cacheInfo.misses.push(layer);
          }
        } catch (_error) {
          console.warn(`[StorageCoordinator] Error reading from ${layer}:`, error);
          result.cacheInfo.misses.push(layer);
        }
      }

      // Update statistics
      this.updateReadStats(result, Date.now() - startTime);

      console.log(
        `[StorageCoordinator] Read completed: ${key} (found: ${result.found}, source: ${result.sourceLayer})`,
      );

      return result;
    } catch (_error) {
      console.error(`[StorageCoordinator] Read failed for key ${key}:`, error);
      this.stats.failedOperations++;
      throw error;
    }
  }

  /**
   * Write data with multi-layer coordination
   */
  async write<T = unknown>(
    key: string,
    data: T,
    options?: {
      targetLayers?: StorageLayer[];
      consistency?: 'eventual' | 'strong';
      ttl?: number;
      compress?: boolean;
    },
  ): Promise<boolean> {
    const startTime = Date.now();

    try {
      console.log(`[StorageCoordinator] Writing key: ${key}`);

      // Determine target layers
      const targetLayers = options?.targetLayers || this.getWriteLayerOrder();

      // Create transaction if strong consistency required
      if (options?.consistency === 'strong') {
        return await this.writeWithTransaction(key, data, targetLayers, options);
      }

      // Write to all target layers
      const writePromises = targetLayers.map(layer => this.writeToLayer(key, data, layer, options));

      const results = await Promise.allSettled(writePromises);
      const successCount = results.filter(r => r.status === 'fulfilled').length;

      // Consider successful if at least one layer succeeded
      const success = successCount > 0;

      // Update statistics
      this.updateWriteStats(targetLayers.length, successCount, Date.now() - startTime);

      console.log(`[StorageCoordinator] Write completed: ${key} (${successCount}/${targetLayers.length} layers)`);

      return success;
    } catch (_error) {
      console.error(`[StorageCoordinator] Write failed for key ${key}:`, error);
      this.stats.failedOperations++;
      return false;
    }
  }

  /**
   * Delete data from all layers
   */
  async delete(
    key: string,
    options?: {
      targetLayers?: StorageLayer[];
      consistency?: 'eventual' | 'strong';
    },
  ): Promise<boolean> {
    const startTime = Date.now();

    try {
      console.log(`[StorageCoordinator] Deleting key: ${key}`);

      const targetLayers = options?.targetLayers || Array.from(this.layerConfigs.keys());

      // Create transaction if strong consistency required
      if (options?.consistency === 'strong') {
        return await this.deleteWithTransaction(key, targetLayers);
      }

      // Delete from all layers
      const deletePromises = targetLayers.map(layer => this.deleteFromLayer(key, layer));

      const results = await Promise.allSettled(deletePromises);
      const successCount = results.filter(r => r.status === 'fulfilled').length;

      const success = successCount > 0;

      // Update statistics
      this.updateOperationStats('delete', Date.now() - startTime, success);

      console.log(`[StorageCoordinator] Delete completed: ${key} (${successCount}/${targetLayers.length} layers)`);

      return success;
    } catch (_error) {
      console.error(`[StorageCoordinator] Delete failed for key ${key}:`, error);
      this.stats.failedOperations++;
      return false;
    }
  }

  /**
   * Begin storage transaction
   */
  async beginTransaction(options: {
    isolationLevel?: IsolationLevel;
    timeout?: number;
    layers?: StorageLayer[];
    source?: string;
    priority?: 'low' | 'normal' | 'high';
  }): Promise<string> {
    const transactionId = `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const transaction: StorageTransaction = {
      transactionId,
      isolationLevel: options.isolationLevel || 'read_committed',
      operations: [],
      status: 'pending',
      startTime: new Date().toISOString(),
      timeout: options.timeout || 30000,
      layers: options.layers || Array.from(this.layerConfigs.keys()),
      metadata: {
        source: options.source || 'unknown',
        priority: options.priority || 'normal',
        rollbackOnFailure: true,
      },
    };

    this.activeTransactions.set(transactionId, transaction);

    console.log(`[StorageCoordinator] Transaction started: ${transactionId}`);

    // Set timeout for transaction
    setTimeout(() => {
      if (this.activeTransactions.has(transactionId)) {
        this.abortTransaction(transactionId, 'Transaction timeout');
      }
    }, transaction.timeout);

    return transactionId;
  }

  /**
   * Commit storage transaction
   */
  async commitTransaction(transactionId: string): Promise<boolean> {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    try {
      console.log(`[StorageCoordinator] Committing transaction: ${transactionId}`);

      // Execute all operations
      for (const operation of transaction.operations) {
        await this.executeTransactionOperation(operation);
      }

      // Mark as committed
      transaction.status = 'committed';
      this.activeTransactions.delete(transactionId);

      // Update statistics
      this.stats.transactions.committed++;

      console.log(`[StorageCoordinator] Transaction committed: ${transactionId}`);

      return true;
    } catch (_error) {
      console.error(`[StorageCoordinator] Transaction commit failed: ${transactionId}:`, error);

      // Rollback if configured
      if (transaction.metadata.rollbackOnFailure) {
        await this.rollbackTransaction(transactionId);
      }

      return false;
    }
  }

  /**
   * Abort storage transaction
   */
  async abortTransaction(transactionId: string, reason?: string): Promise<void> {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      return;
    }

    try {
      console.log(`[StorageCoordinator] Aborting transaction: ${transactionId} (${reason || 'Manual abort'})`);

      // Rollback executed operations
      await this.rollbackTransaction(transactionId);

      // Mark as aborted
      transaction.status = 'aborted';
      this.activeTransactions.delete(transactionId);

      // Update statistics
      this.stats.transactions.aborted++;
    } catch (_error) {
      console.error(`[StorageCoordinator] Transaction abort failed: ${transactionId}:`, error);
    }
  }

  /**
   * Get storage statistics
   */
  getStats(): StorageCoordinatorStats {
    this.updateLayerUtilization();
    this.updateCacheHitRate();
    this.stats.lastUpdated = new Date().toISOString();
    return { ...this.stats };
  }

  /**
   * Get active transactions
   */
  getActiveTransactions(): StorageTransaction[] {
    return Array.from(this.activeTransactions.values());
  }

  /**
   * Configure storage layer
   */
  configureLayer(layer: StorageLayer, config: Partial<StorageLayerConfig>): void {
    const existingConfig = this.layerConfigs.get(layer);
    const newConfig = { ...existingConfig, ...config } as StorageLayerConfig;
    this.layerConfigs.set(layer, newConfig);

    console.log(`[StorageCoordinator] Layer configured: ${layer}`);
  }

  /**
   * Clear all data from specified layers
   */
  async clearLayers(layers?: StorageLayer[]): Promise<boolean> {
    const targetLayers = layers || Array.from(this.layerConfigs.keys());

    try {
      const clearPromises = targetLayers.map(layer => this.clearLayer(layer));
      const results = await Promise.allSettled(clearPromises);
      const successCount = results.filter(r => r.status === 'fulfilled').length;

      console.log(`[StorageCoordinator] Cleared ${successCount}/${targetLayers.length} layers`);

      return successCount === targetLayers.length;
    } catch (_error) {
      console.error('[StorageCoordinator] Layer clearing failed:', error);
      return false;
    }
  }

  /**
   * Shutdown storage coordinator
   */
  async shutdown(): Promise<void> {
    console.log('[StorageCoordinator] Shutting down');

    // Stop cleanup task
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Abort active transactions
    const activeTransactionIds = Array.from(this.activeTransactions.keys());
    for (const transactionId of activeTransactionIds) {
      await this.abortTransaction(transactionId, 'System shutdown');
    }

    // Clear memory cache
    this.memoryCache.clear();

    console.log('[StorageCoordinator] Shutdown completed');
  }

  /**
   * Read from specific storage layer
   */
  private async readFromLayer<T>(
    key: string,
    layer: StorageLayer,
  ): Promise<{
    data: T | null;
    found: boolean;
    timestamp: string;
  }> {
    switch (layer) {
      case 'memory':
        return this.readFromMemoryCache<T>(key);

      case 'local':
        return this.readFromLocalStorage<T>(key);

      case 'sync':
        return this.readFromSyncStorage<T>(key);

      case 'session':
        return this.readFromSessionStorage<T>(key);

      case 'indexeddb':
        return this.readFromIndexedDB<T>(key);

      default:
        throw new Error(`Unsupported storage layer: ${layer}`);
    }
  }

  /**
   * Write to specific storage layer
   */
  private async writeToLayer<T>(
    key: string,
    data: T,
    layer: StorageLayer,
    _options?: Record<string, unknown>,
  ): Promise<void> {
    switch (layer) {
      case 'memory':
        await this.writeToMemoryCache(key, data, options);
        break;

      case 'local':
        await this.writeToLocalStorage(key, data, options);
        break;

      case 'sync':
        await this.writeToSyncStorage(key, data, options);
        break;

      case 'session':
        await this.writeToSessionStorage(key, data, options);
        break;

      case 'indexeddb':
        await this.writeToIndexedDB(key, data, options);
        break;

      default:
        throw new Error(`Unsupported storage layer: ${layer}`);
    }
  }

  /**
   * Delete from specific storage layer
   */
  private async deleteFromLayer(key: string, layer: StorageLayer): Promise<void> {
    switch (layer) {
      case 'memory':
        this.memoryCache.delete(key);
        break;

      case 'local':
        await chrome.storage.local.remove(key);
        break;

      case 'sync':
        await chrome.storage.sync.remove(key);
        break;

      case 'session':
        await chrome.storage.session.remove(key);
        break;

      case 'indexeddb':
        // TODO: Implement IndexedDB deletion
        break;

      default:
        throw new Error(`Unsupported storage layer: ${layer}`);
    }
  }

  /**
   * Memory cache operations
   */
  private async readFromMemoryCache<T>(key: string): Promise<{
    data: T | null;
    found: boolean;
    timestamp: string;
  }> {
    const cached = this.memoryCache.get(key);

    if (cached && cached.expires > Date.now()) {
      return {
        data: cached.data as T,
        found: true,
        timestamp: new Date().toISOString(),
      };
    }

    // Remove expired entry
    if (cached) {
      this.memoryCache.delete(key);
    }

    return {
      data: null,
      found: false,
      timestamp: new Date().toISOString(),
    };
  }

  private async writeToMemoryCache<T>(key: string, data: T, _options?: Record<string, unknown>): Promise<void> {
    const ttl = options?.ttl || 300000; // Default 5 minutes
    const expires = Date.now() + ttl;

    this.memoryCache.set(key, {
      data,
      expires,
      layer: 'memory',
    });
  }

  /**
   * Chrome storage operations
   */
  private async readFromLocalStorage<T>(key: string): Promise<{
    data: T | null;
    found: boolean;
    timestamp: string;
  }> {
    try {
      const result = await chrome.storage.local.get(key);
      const found = key in result;

      return {
        data: found ? result[key] : null,
        found,
        timestamp: new Date().toISOString(),
      };
    } catch (_error) {
      return {
        data: null,
        found: false,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private async writeToLocalStorage<T>(key: string, data: T, _options?: Record<string, unknown>): Promise<void> {
    await chrome.storage.local.set({ [key]: data });
  }

  private async readFromSyncStorage<T>(key: string): Promise<{
    data: T | null;
    found: boolean;
    timestamp: string;
  }> {
    try {
      const result = await chrome.storage.sync.get(key);
      const found = key in result;

      return {
        data: found ? result[key] : null,
        found,
        timestamp: new Date().toISOString(),
      };
    } catch (_error) {
      return {
        data: null,
        found: false,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private async writeToSyncStorage<T>(key: string, data: T, _options?: Record<string, unknown>): Promise<void> {
    await chrome.storage.sync.set({ [key]: data });
  }

  private async readFromSessionStorage<T>(key: string): Promise<{
    data: T | null;
    found: boolean;
    timestamp: string;
  }> {
    try {
      const result = await chrome.storage.session.get(key);
      const found = key in result;

      return {
        data: found ? result[key] : null,
        found,
        timestamp: new Date().toISOString(),
      };
    } catch (_error) {
      return {
        data: null,
        found: false,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private async writeToSessionStorage<T>(key: string, data: T, _options?: Record<string, unknown>): Promise<void> {
    await chrome.storage.session.set({ [key]: data });
  }

  private async readFromIndexedDB<T>(_key: string): Promise<{
    data: T | null;
    found: boolean;
    timestamp: string;
  }> {
    // TODO: Implement IndexedDB read
    return {
      data: null,
      found: false,
      timestamp: new Date().toISOString(),
    };
  }

  private async writeToIndexedDB<T>(_key: string, _data: T, _options?: Record<string, unknown>): Promise<void> {
    // TODO: Implement IndexedDB write
  }

  /**
   * Get read layer order based on performance and preferences
   */
  private getReadLayerOrder(preferredLayers?: StorageLayer[]): StorageLayer[] {
    if (preferredLayers) {
      return preferredLayers;
    }

    // Default order: fastest to slowest
    return ['memory', 'session', 'local', 'sync', 'indexeddb'].filter(
      layer => this.layerConfigs.get(layer as StorageLayer)?.enabled,
    );
  }

  /**
   * Get write layer order based on durability requirements
   */
  private getWriteLayerOrder(): StorageLayer[] {
    return Array.from(this.layerConfigs.entries())
      .filter(([_, config]) => config.enabled)
      .sort((a, b) => b[1].priority - a[1].priority)
      .map(([layer, _]) => layer);
  }

  /**
   * Propagate data to faster layers for caching
   */
  private async propagateToFasterLayers<T>(key: string, data: T, sourceLayer: StorageLayer): Promise<void> {
    const fasterLayers = this.getFasterLayers(sourceLayer);

    for (const layer of fasterLayers) {
      try {
        await this.writeToLayer(key, data, layer, { ttl: 300000 });
      } catch (_error) {
        console.warn(`[StorageCoordinator] Failed to propagate to ${layer}:`, error);
      }
    }
  }

  /**
   * Get layers that are faster than the source layer
   */
  private getFasterLayers(sourceLayer: StorageLayer): StorageLayer[] {
    const layerSpeed = {
      memory: 1,
      session: 2,
      local: 3,
      sync: 4,
      indexeddb: 5,
    };

    const sourceSpeed = layerSpeed[sourceLayer];

    return Object.entries(layerSpeed)
      .filter(([layer, speed]) => speed < sourceSpeed && this.layerConfigs.get(layer as StorageLayer)?.enabled)
      .map(([layer, _]) => layer as StorageLayer);
  }

  /**
   * Write with transaction coordination
   */
  private async writeWithTransaction<T>(
    key: string,
    data: T,
    targetLayers: StorageLayer[],
    _options?: Record<string, unknown>,
  ): Promise<boolean> {
    const transactionId = await this.beginTransaction({
      layers: targetLayers,
      source: 'storage-coordinator',
    });

    try {
      // Add write operations to transaction
      const transaction = this.activeTransactions.get(transactionId)!;

      for (const layer of targetLayers) {
        transaction.operations.push({
          operationId: `write-${layer}-${Date.now()}`,
          type: 'write',
          layer,
          key,
          data,
          options,
          status: 'pending',
        });
      }

      // Commit transaction
      return await this.commitTransaction(transactionId);
    } catch (_error) {
      await this.abortTransaction(transactionId, 'Write transaction failed');
      throw error;
    }
  }

  /**
   * Delete with transaction coordination
   */
  private async deleteWithTransaction(key: string, targetLayers: StorageLayer[]): Promise<boolean> {
    const transactionId = await this.beginTransaction({
      layers: targetLayers,
      source: 'storage-coordinator',
    });

    try {
      const transaction = this.activeTransactions.get(transactionId)!;

      for (const layer of targetLayers) {
        transaction.operations.push({
          operationId: `delete-${layer}-${Date.now()}`,
          type: 'delete',
          layer,
          key,
          status: 'pending',
        });
      }

      return await this.commitTransaction(transactionId);
    } catch (_error) {
      await this.abortTransaction(transactionId, 'Delete transaction failed');
      throw error;
    }
  }

  /**
   * Execute transaction operation
   */
  private async executeTransactionOperation(operation: StorageTransactionOperation): Promise<void> {
    try {
      operation.executedAt = new Date().toISOString();

      switch (operation.type) {
        case 'read':
          await this.readFromLayer(operation.key, operation.layer);
          break;

        case 'write':
          await this.writeToLayer(operation.key, operation.data, operation.layer, operation.options);
          break;

        case 'delete':
          await this.deleteFromLayer(operation.key, operation.layer);
          break;

        default:
          throw new Error(`Unsupported operation type: ${operation.type}`);
      }

      operation.status = 'completed';
    } catch (_error) {
      operation.status = 'failed';
      operation.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  /**
   * Rollback transaction operations
   */
  private async rollbackTransaction(transactionId: string): Promise<void> {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) return;

    // Rollback in reverse order
    const completedOps = transaction.operations.filter(op => op.status === 'completed').reverse();

    for (const operation of completedOps) {
      try {
        // Create inverse operation
        if (operation.type === 'write') {
          await this.deleteFromLayer(operation.key, operation.layer);
        }
        // Note: Read operations don't need rollback
        // Delete operations are harder to rollback (would need backup)
      } catch (_error) {
        console.warn(`[StorageCoordinator] Rollback failed for operation ${operation.operationId}:`, error);
      }
    }
  }

  /**
   * Clear specific storage layer
   */
  private async clearLayer(layer: StorageLayer): Promise<void> {
    switch (layer) {
      case 'memory':
        this.memoryCache.clear();
        break;

      case 'local':
        await chrome.storage.local.clear();
        break;

      case 'sync':
        await chrome.storage.sync.clear();
        break;

      case 'session':
        await chrome.storage.session.clear();
        break;

      case 'indexeddb':
        // TODO: Implement IndexedDB clear
        break;
    }
  }

  /**
   * Setup default layer configurations
   */
  private setupDefaultLayerConfigs(): void {
    this.configureLayer('memory', {
      layer: 'memory',
      enabled: true,
      priority: 5,
      maxSize: 50 * 1024 * 1024, // 50MB
      defaultTTL: 300000, // 5 minutes
      enableCompression: false,
      consistency: {
        requireWriteConfirmation: false,
        readPreference: 'fastest',
        conflictResolution: 'last_write_wins',
      },
    });

    this.configureLayer('session', {
      layer: 'session',
      enabled: true,
      priority: 4,
      maxSize: 10 * 1024 * 1024, // 10MB
      defaultTTL: 0, // Session lifetime
      enableCompression: true,
      consistency: {
        requireWriteConfirmation: false,
        readPreference: 'fastest',
        conflictResolution: 'last_write_wins',
      },
    });

    this.configureLayer('local', {
      layer: 'local',
      enabled: true,
      priority: 3,
      maxSize: 100 * 1024 * 1024, // 100MB
      defaultTTL: 0, // Persistent
      enableCompression: true,
      consistency: {
        requireWriteConfirmation: true,
        readPreference: 'consistent',
        conflictResolution: 'last_write_wins',
      },
    });

    this.configureLayer('sync', {
      layer: 'sync',
      enabled: true,
      priority: 2,
      maxSize: 100 * 1024, // 100KB
      defaultTTL: 0, // Persistent and synced
      enableCompression: true,
      consistency: {
        requireWriteConfirmation: true,
        readPreference: 'consistent',
        conflictResolution: 'manual',
      },
    });

    this.configureLayer('indexeddb', {
      layer: 'indexeddb',
      enabled: false, // Disabled by default
      priority: 1,
      maxSize: 1024 * 1024 * 1024, // 1GB
      defaultTTL: 0, // Persistent
      enableCompression: true,
      consistency: {
        requireWriteConfirmation: true,
        readPreference: 'consistent',
        conflictResolution: 'manual',
      },
    });
  }

  /**
   * Start cleanup task for expired data
   */
  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredData();
    }, 60000); // Every minute
  }

  /**
   * Cleanup expired data from memory cache
   */
  private cleanupExpiredData(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, cached] of this.memoryCache) {
      if (cached.expires <= now) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.memoryCache.delete(key);
    }

    if (expiredKeys.length > 0) {
      console.log(`[StorageCoordinator] Cleaned up ${expiredKeys.length} expired cache entries`);
    }
  }

  /**
   * Update statistics for read operations
   */
  private updateReadStats(result: MultiLayerReadResult, duration: number): void {
    this.stats.totalOperations++;
    this.stats.operationsByType.read++;

    if (result.found) {
      this.stats.successfulOperations++;
      this.stats.operationsByLayer[result.sourceLayer]++;
    } else {
      this.stats.failedOperations++;
    }

    this.updateAverageOperationTime(duration);
  }

  /**
   * Update statistics for write operations
   */
  private updateWriteStats(totalLayers: number, successfulLayers: number, duration: number): void {
    this.stats.totalOperations++;
    this.stats.operationsByType.write++;

    if (successfulLayers === totalLayers) {
      this.stats.successfulOperations++;
    } else {
      this.stats.failedOperations++;
    }

    this.updateAverageOperationTime(duration);
  }

  /**
   * Update general operation statistics
   */
  private updateOperationStats(operation: StorageOperation, duration: number, success: boolean): void {
    this.stats.totalOperations++;
    this.stats.operationsByType[operation]++;

    if (success) {
      this.stats.successfulOperations++;
    } else {
      this.stats.failedOperations++;
    }

    this.updateAverageOperationTime(duration);
  }

  /**
   * Update average operation time
   */
  private updateAverageOperationTime(duration: number): void {
    const totalOps = this.stats.totalOperations;
    this.stats.avgOperationTime = (this.stats.avgOperationTime * (totalOps - 1) + duration) / totalOps;
  }

  /**
   * Update cache hit rate
   */
  private updateCacheHitRate(): void {
    const totalReads = this.stats.operationsByType.read;
    const memoryReads = this.stats.operationsByLayer.memory || 0;

    this.stats.cacheHitRate = totalReads > 0 ? (memoryReads / totalReads) * 100 : 0;
  }

  /**
   * Update layer utilization (placeholder implementation)
   */
  private updateLayerUtilization(): void {
    // This would require actual storage usage measurement
    // For now, provide placeholder data
    for (const layer of this.layerConfigs.keys()) {
      this.stats.layerUtilization[layer] = {
        usedSpace: 0,
        availableSpace: 1000000,
        utilizationPercent: 0,
      };
    }
  }

  /**
   * Initialize storage coordinator statistics
   */
  private initializeStats(): StorageCoordinatorStats {
    return {
      totalOperations: 0,
      operationsByType: {
        read: 0,
        write: 0,
        delete: 0,
        clear: 0,
        migrate: 0,
      },
      operationsByLayer: {
        memory: 0,
        local: 0,
        sync: 0,
        indexeddb: 0,
        session: 0,
      },
      successfulOperations: 0,
      failedOperations: 0,
      cacheHitRate: 0,
      avgOperationTime: 0,
      transactions: {
        total: 0,
        committed: 0,
        aborted: 0,
        avgTransactionTime: 0,
      },
      layerUtilization: {
        memory: { usedSpace: 0, availableSpace: 0, utilizationPercent: 0 },
        local: { usedSpace: 0, availableSpace: 0, utilizationPercent: 0 },
        sync: { usedSpace: 0, availableSpace: 0, utilizationPercent: 0 },
        indexeddb: { usedSpace: 0, availableSpace: 0, utilizationPercent: 0 },
        session: { usedSpace: 0, availableSpace: 0, utilizationPercent: 0 },
      },
      lastUpdated: new Date().toISOString(),
    };
  }
}
