/**
 * Sync coordinator for cross-tab state synchronization
 * Handles conflict resolution, data merging, and consistency management
 */

import type { MessageRouter } from './message-router';
import type { CrossTabSyncConfig, MessageEnvelope } from '../types';

/**
 * Sync data types that can be synchronized
 */
export type SyncDataType =
  | 'job_status'
  | 'config'
  | 'cache'
  | 'user_preferences'
  | 'session_state'
  | 'meeting_data'
  | 'transcription_results';

/**
 * Sync operation types
 */
export type SyncOperationType = 'create' | 'update' | 'delete' | 'merge' | 'conflict_resolution';

/**
 * Sync event payload
 */
export interface SyncEvent {
  /** Unique sync event ID */
  eventId: string;
  /** Data type being synchronized */
  dataType: SyncDataType;
  /** Operation type */
  operation: SyncOperationType;
  /** Data payload */
  data: unknown;
  /** Source component/tab information */
  source: {
    componentId: string;
    tabId?: number;
    timestamp: string;
  };
  /** Data version/timestamp for conflict resolution */
  version: string;
  /** Sync metadata */
  metadata: {
    /** Whether this is a batch operation */
    isBatch: boolean;
    /** Batch ID for grouped operations */
    batchId?: string;
    /** Conflict resolution strategy to use */
    conflictStrategy?: 'last_write_wins' | 'merge' | 'user_choice' | 'custom';
    /** Custom merge instructions */
    mergeInstructions?: Record<string, unknown>;
  };
}

/**
 * Sync conflict information
 */
export interface SyncConflict {
  /** Conflict ID */
  conflictId: string;
  /** Data type in conflict */
  dataType: SyncDataType;
  /** Key/identifier of conflicting data */
  dataKey: string;
  /** Local version of the data */
  localVersion: {
    data: unknown;
    version: string;
    timestamp: string;
    source: string;
  };
  /** Remote version of the data */
  remoteVersion: {
    data: unknown;
    version: string;
    timestamp: string;
    source: string;
  };
  /** Suggested resolution */
  suggestedResolution: 'use_local' | 'use_remote' | 'merge' | 'manual';
  /** Conflict detection timestamp */
  detectedAt: string;
}

/**
 * Sync resolution result
 */
export interface SyncResolutionResult {
  /** Conflict ID */
  conflictId: string;
  /** Resolution strategy used */
  strategy: 'last_write_wins' | 'merge' | 'user_choice' | 'custom';
  /** Resolved data */
  resolvedData: unknown;
  /** Whether resolution was successful */
  success: boolean;
  /** Resolution timestamp */
  resolvedAt: string;
  /** Any warnings or notes */
  warnings?: string[];
}

/**
 * Sync statistics
 */
export interface SyncStats {
  /** Total sync operations */
  totalOperations: number;
  /** Operations by type */
  operationsByType: Record<SyncOperationType, number>;
  /** Operations by data type */
  operationsByDataType: Record<SyncDataType, number>;
  /** Successful synchronizations */
  successfulSyncs: number;
  /** Failed synchronizations */
  failedSyncs: number;
  /** Conflicts detected */
  conflictsDetected: number;
  /** Conflicts resolved */
  conflictsResolved: number;
  /** Average sync time in milliseconds */
  averageSyncTime: number;
  /** Last sync timestamp */
  lastSync?: string;
}

/**
 * Sync coordinator for cross-tab state synchronization
 */
export class SyncCoordinator {
  private config: CrossTabSyncConfig;
  private messageRouter: MessageRouter;
  private syncDataStore = new Map<string, { data: unknown; version: string; timestamp: string }>();
  private pendingConflicts = new Map<string, SyncConflict>();
  private stats: SyncStats;
  private syncInterval: NodeJS.Timeout | null = null;
  private batchOperations = new Map<string, SyncEvent[]>();

  constructor(config: CrossTabSyncConfig, messageRouter: MessageRouter) {
    this.config = config;
    this.messageRouter = messageRouter;
    this.stats = this.initializeStats();

    if (this.config.strategy === 'periodic') {
      this.startPeriodicSync();
    }
  }

  /**
   * Synchronize data across tabs
   */
  async syncData(
    dataType: SyncDataType,
    key: string,
    data: unknown,
    operation: SyncOperationType = 'update',
  ): Promise<boolean> {
    const startTime = Date.now();

    try {

      // Create sync event
      const syncEvent = this.createSyncEvent(dataType, key, data, operation);

      // Apply locally first
      await this.applyLocalSync(syncEvent);

      // Broadcast to other tabs if enabled
      if (this.shouldBroadcastSync(dataType)) {
        await this.broadcastSyncEvent(syncEvent);
      }

      // Update statistics
      this.updateSyncStats(operation, Date.now() - startTime, true);

      return true;
    } catch (error) {
      console.error(`[SyncCoordinator] Sync failed for ${dataType}:${key}:`, error);
      this.updateSyncStats(operation, Date.now() - startTime, false);
      return false;
    }
  }

  /**
   * Handle incoming sync event from another tab
   */
  async handleSyncEvent(event: SyncEvent): Promise<void> {
    try {

      // Check for conflicts
      const conflict = await this.detectConflict(event);

      if (conflict) {
        console.warn(`[SyncCoordinator] Conflict detected for ${event.dataType}`);
        await this.handleConflict(conflict);
      } else {
        // Apply sync directly
        await this.applyRemoteSync(event);
      }
    } catch (error) {
      console.error(`[SyncCoordinator] Failed to handle sync event:`, error);
    }
  }

  /**
   * Resolve a sync conflict
   */
  async resolveConflict(
    conflictId: string,
    strategy: 'use_local' | 'use_remote' | 'merge' | 'custom',
    customData?: unknown,
  ): Promise<SyncResolutionResult> {
    const conflict = this.pendingConflicts.get(conflictId);
    if (!conflict) {
      throw new Error(`Conflict ${conflictId} not found`);
    }

    const result: SyncResolutionResult = {
      conflictId,
      strategy,
      resolvedData: null,
      success: false,
      resolvedAt: new Date().toISOString(),
    };

    try {
      switch (strategy) {
        case 'use_local':
          result.resolvedData = conflict.localVersion.data;
          break;

        case 'use_remote':
          result.resolvedData = conflict.remoteVersion.data;
          break;

        case 'merge':
          result.resolvedData = await this.mergeData(
            conflict.localVersion.data,
            conflict.remoteVersion.data,
            conflict.dataType,
          );
          break;

        case 'custom':
          if (customData === undefined) {
            throw new Error('Custom data required for custom resolution strategy');
          }
          result.resolvedData = customData;
          break;

        default:
          throw new Error(`Unknown resolution strategy: ${strategy}`);
      }

      // Apply resolved data
      const syncEvent = this.createSyncEvent(
        conflict.dataType,
        conflict.dataKey,
        result.resolvedData,
        'conflict_resolution',
      );

      await this.applyLocalSync(syncEvent);
      await this.broadcastSyncEvent(syncEvent);

      // Remove conflict
      this.pendingConflicts.delete(conflictId);

      result.success = true;
      this.stats.conflictsResolved++;

    } catch (error) {
      result.success = false;
      result.warnings = [error instanceof Error ? error.message : String(error)];

      console.error(`[SyncCoordinator] Failed to resolve conflict ${conflictId}:`, error);
    }

    return result;
  }

  /**
   * Get all pending conflicts
   */
  getPendingConflicts(): SyncConflict[] {
    return Array.from(this.pendingConflicts.values());
  }

  /**
   * Get sync statistics
   */
  getSyncStats(): SyncStats {
    return { ...this.stats };
  }

  /**
   * Get synchronized data
   */
  getSyncedData(dataType: SyncDataType, key?: string): Map<string, unknown> | unknown {
    if (key) {
      const syncKey = `${dataType}:${key}`;
      const syncEntry = this.syncDataStore.get(syncKey);
      return syncEntry?.data;
    }

    // Return all data for the type
    const typeData = new Map<string, unknown>();
    const prefix = `${dataType}:`;

    for (const [syncKey, syncEntry] of this.syncDataStore) {
      if (syncKey.startsWith(prefix)) {
        const key = syncKey.substring(prefix.length);
        typeData.set(key, syncEntry.data);
      }
    }

    return typeData;
  }

  /**
   * Clear synchronized data
   */
  async clearSyncedData(dataType?: SyncDataType): Promise<void> {
    if (dataType) {
      // Clear specific data type
      const prefix = `${dataType}:`;
      const keysToDelete = Array.from(this.syncDataStore.keys()).filter(key => key.startsWith(prefix));

      for (const key of keysToDelete) {
        this.syncDataStore.delete(key);
      }

    } else {
      // Clear all data
      this.syncDataStore.clear();
    }

    // Broadcast clear operation
    const clearEvent = this.createSyncEvent(dataType || 'session_state', 'clear_all', null, 'delete');

    await this.broadcastSyncEvent(clearEvent);
  }

  /**
   * Update sync configuration
   */
  updateConfig(config: Partial<CrossTabSyncConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart periodic sync if strategy changed
    if (config.strategy) {
      this.stopPeriodicSync();
      if (config.strategy === 'periodic') {
        this.startPeriodicSync();
      }
    }

  }

  /**
   * Shutdown sync coordinator
   */
  async shutdown(): Promise<void> {

    this.stopPeriodicSync();

    // Flush any pending batch operations
    for (const [batchId, operations] of this.batchOperations) {
      try {
        await this.processBatchOperations(batchId, operations);
      } catch (error) {
        console.warn(`[SyncCoordinator] Failed to flush batch ${batchId}:`, error);
      }
    }

    this.batchOperations.clear();
    this.pendingConflicts.clear();

  }

  /**
   * Create sync event
   */
  private createSyncEvent(dataType: SyncDataType, key: string, data: unknown, operation: SyncOperationType): SyncEvent {
    return {
      eventId: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      dataType,
      operation,
      data,
      source: {
        componentId: 'background-sync-coordinator',
        timestamp: new Date().toISOString(),
      },
      version: this.generateVersion(),
      metadata: {
        isBatch: false,
        conflictStrategy: this.config.conflictResolution,
      },
    };
  }

  /**
   * Apply sync locally
   */
  private async applyLocalSync(event: SyncEvent): Promise<void> {
    const syncKey = `${event.dataType}:${this.extractKeyFromEvent(event)}`;

    switch (event.operation) {
      case 'create':
      case 'update':
      case 'conflict_resolution':
        this.syncDataStore.set(syncKey, {
          data: event.data,
          version: event.version,
          timestamp: event.source.timestamp,
        });
        break;

      case 'delete':
        this.syncDataStore.delete(syncKey);
        break;

      case 'merge': {
        const existing = this.syncDataStore.get(syncKey);
        if (existing) {
          const mergedData = await this.mergeData(existing.data, event.data, event.dataType);
          this.syncDataStore.set(syncKey, {
            data: mergedData,
            version: event.version,
            timestamp: event.source.timestamp,
          });
        } else {
          this.syncDataStore.set(syncKey, {
            data: event.data,
            version: event.version,
            timestamp: event.source.timestamp,
          });
        }
        break;
      }
    }

  }

  /**
   * Apply remote sync
   */
  private async applyRemoteSync(event: SyncEvent): Promise<void> {
    // Apply the same logic as local sync, but from remote source
    await this.applyLocalSync(event);
  }

  /**
   * Broadcast sync event to other tabs
   */
  private async broadcastSyncEvent(event: SyncEvent): Promise<void> {
    try {
      const envelope: MessageEnvelope = {
        messageId: `sync-broadcast-${event.eventId}`,
        type: 'storage_sync',
        priority: 'normal',
        deliveryMode: 'broadcast',
        source: {
          componentId: 'sync-coordinator',
          type: 'background',
        },
        target: {
          componentTypes: this.config.targets.background ? ['background'] : [],
        },
        payload: event,
        metadata: {
          timestamp: new Date().toISOString(),
          tags: ['sync', event.dataType],
          requiresAck: false,
        },
        delivery: {
          attempts: 0,
          maxAttempts: 3,
          timeout: 5000,
          confirmations: [],
        },
      };

      await this.messageRouter.sendMessage(envelope);
    } catch (error) {
      console.error(`[SyncCoordinator] Failed to broadcast sync event:`, error);
    }
  }

  /**
   * Detect conflict between local and remote data
   */
  private async detectConflict(event: SyncEvent): Promise<SyncConflict | null> {
    const syncKey = `${event.dataType}:${this.extractKeyFromEvent(event)}`;
    const localData = this.syncDataStore.get(syncKey);

    if (!localData) {
      // No local data, no conflict
      return null;
    }

    // Check if versions conflict
    const localTime = new Date(localData.timestamp).getTime();
    const remoteTime = new Date(event.source.timestamp).getTime();
    const timeDiff = Math.abs(localTime - remoteTime);

    // If timestamps are very close (within 1 second), no conflict
    if (timeDiff < 1000) {
      return null;
    }

    // Check if data is actually different
    if (JSON.stringify(localData.data) === JSON.stringify(event.data)) {
      return null;
    }

    // Create conflict
    const conflict: SyncConflict = {
      conflictId: `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      dataType: event.dataType,
      dataKey: this.extractKeyFromEvent(event),
      localVersion: {
        data: localData.data,
        version: localData.version,
        timestamp: localData.timestamp,
        source: 'local',
      },
      remoteVersion: {
        data: event.data,
        version: event.version,
        timestamp: event.source.timestamp,
        source: event.source.componentId,
      },
      suggestedResolution: this.getSuggestedResolution(localData, event),
      detectedAt: new Date().toISOString(),
    };

    this.pendingConflicts.set(conflict.conflictId, conflict);
    this.stats.conflictsDetected++;

    return conflict;
  }

  /**
   * Handle detected conflict
   */
  private async handleConflict(conflict: SyncConflict): Promise<void> {
    console.warn(`[SyncCoordinator] Handling conflict: ${conflict.conflictId}`);

    // Apply default conflict resolution strategy
    switch (this.config.conflictResolution) {
      case 'last_write_wins': {
        const strategy = conflict.suggestedResolution === 'use_local' ? 'use_local' : 'use_remote';
        await this.resolveConflict(conflict.conflictId, strategy);
        break;
      }

      case 'merge':
        await this.resolveConflict(conflict.conflictId, 'merge');
        break;

      case 'user_choice':
        // Keep conflict pending for user resolution
        break;

      case 'custom':
        // Apply custom resolution logic
        await this.applyCustomResolution(conflict);
        break;
    }
  }

  /**
   * Merge data from two sources
   */
  private async mergeData(localData: unknown, remoteData: unknown, dataType: SyncDataType): Promise<unknown> {
    try {
      // Simple merge strategy for objects
      if (
        typeof localData === 'object' &&
        typeof remoteData === 'object' &&
        localData !== null &&
        remoteData !== null
      ) {
        if (Array.isArray(localData) && Array.isArray(remoteData)) {
          // Merge arrays (combine unique items)
          const combined = [...localData, ...remoteData];
          return Array.from(new Set(combined.map(item => JSON.stringify(item)))).map(item => JSON.parse(item));
        } else {
          // Merge objects (remote takes precedence for conflicts)
          return { ...localData, ...remoteData };
        }
      }

      // For primitive types, use remote data
      return remoteData;
    } catch (error) {
      console.warn(`[SyncCoordinator] Merge failed for ${dataType}, using remote data:`, error);
      return remoteData;
    }
  }

  /**
   * Get suggested resolution for conflict
   */
  private getSuggestedResolution(
    localData: { timestamp: string },
    remoteEvent: SyncEvent,
  ): 'use_local' | 'use_remote' | 'merge' | 'manual' {
    const localTime = new Date(localData.timestamp).getTime();
    const remoteTime = new Date(remoteEvent.source.timestamp).getTime();

    if (remoteTime > localTime) {
      return 'use_remote';
    } else if (localTime > remoteTime) {
      return 'use_local';
    } else {
      return 'merge';
    }
  }

  /**
   * Apply custom resolution logic
   */
  private async applyCustomResolution(conflict: SyncConflict): Promise<void> {
    // Implement custom resolution based on data type
    switch (conflict.dataType) {
      case 'user_preferences':
        // For preferences, merge settings
        await this.resolveConflict(conflict.conflictId, 'merge');
        break;

      case 'job_status':
        // For job status, use most recent
        await this.resolveConflict(conflict.conflictId, 'use_remote');
        break;

      default:
        // Default to last write wins
        await this.resolveConflict(conflict.conflictId, 'use_remote');
        break;
    }
  }

  /**
   * Check if data type should be broadcast
   */
  private shouldBroadcastSync(dataType: SyncDataType): boolean {
    return this.config.dataTypes.includes(dataType);
  }

  /**
   * Extract key from sync event
   */
  private extractKeyFromEvent(event: SyncEvent): string {
    // For now, use a simple key extraction
    // In a real implementation, this would depend on the data structure
    return event.eventId;
  }

  /**
   * Generate version string
   */
  private generateVersion(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start periodic sync
   */
  private startPeriodicSync(): void {
    if (this.syncInterval || !this.config.options.batchInterval) return;

    this.syncInterval = setInterval(() => {
      this.performPeriodicSync();
    }, this.config.options.batchInterval);

  }

  /**
   * Stop periodic sync
   */
  private stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Perform periodic sync
   */
  private async performPeriodicSync(): Promise<void> {
    try {
      // This would typically sync with a central storage or other tabs

      // For now, just update statistics
      this.stats.lastSync = new Date().toISOString();
    } catch (error) {
      console.error('[SyncCoordinator] Periodic sync failed:', error);
    }
  }

  /**
   * Process batch operations
   */
  private async processBatchOperations(batchId: string, operations: SyncEvent[]): Promise<void> {

    for (const operation of operations) {
      try {
        await this.handleSyncEvent(operation);
      } catch (error) {
        console.error(`[SyncCoordinator] Batch operation failed:`, error);
      }
    }
  }

  /**
   * Update sync statistics
   */
  private updateSyncStats(operation: SyncOperationType, duration: number, success: boolean): void {
    this.stats.totalOperations++;
    this.stats.operationsByType[operation] = (this.stats.operationsByType[operation] || 0) + 1;

    if (success) {
      this.stats.successfulSyncs++;
    } else {
      this.stats.failedSyncs++;
    }

    // Update average sync time
    const totalSyncs = this.stats.successfulSyncs + this.stats.failedSyncs;
    this.stats.averageSyncTime = (this.stats.averageSyncTime * (totalSyncs - 1) + duration) / totalSyncs;

    this.stats.lastSync = new Date().toISOString();
  }

  /**
   * Initialize sync statistics
   */
  private initializeStats(): SyncStats {
    return {
      totalOperations: 0,
      operationsByType: {
        create: 0,
        update: 0,
        delete: 0,
        merge: 0,
        conflict_resolution: 0,
      },
      operationsByDataType: {
        job_status: 0,
        config: 0,
        cache: 0,
        user_preferences: 0,
        session_state: 0,
        meeting_data: 0,
        transcription_results: 0,
      },
      successfulSyncs: 0,
      failedSyncs: 0,
      conflictsDetected: 0,
      conflictsResolved: 0,
      averageSyncTime: 0,
    };
  }
}
