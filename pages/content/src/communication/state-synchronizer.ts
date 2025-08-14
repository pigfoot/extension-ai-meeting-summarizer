/**
 * State Synchronizer
 *
 * Cross-tab state synchronization with conflict resolution and consistency
 * management for content script state coordination.
 */

import { eventSubscriber } from './event-subscriber';
import { messageDispatcher } from './message-dispatcher';

/**
 * State types that can be synchronized
 */
export type SynchronizedStateType =
  | 'transcription.session'
  | 'meeting.context'
  | 'page.integration'
  | 'ui.components'
  | 'user.preferences'
  | 'content.cache'
  | 'feature.flags';

/**
 * State operation types
 */
export type StateOperationType = 'set' | 'update' | 'delete' | 'merge';

/**
 * State change event
 */
export interface StateChangeEvent {
  /** State type */
  stateType: SynchronizedStateType;
  /** Operation performed */
  operation: StateOperationType;
  /** State key */
  key: string;
  /** New value */
  value: unknown;
  /** Previous value */
  previousValue?: unknown;
  /** Change timestamp */
  timestamp: Date;
  /** Source tab ID */
  sourceTabId: string;
  /** Change version */
  version: number;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * State conflict resolution strategy
 */
export type ConflictResolutionStrategy = 'latest-wins' | 'merge' | 'manual' | 'source-priority' | 'custom';

/**
 * State conflict information
 */
export interface StateConflict {
  /** Conflict ID */
  conflictId: string;
  /** State type */
  stateType: SynchronizedStateType;
  /** State key */
  key: string;
  /** Current value */
  currentValue: unknown;
  /** Incoming value */
  incomingValue: unknown;
  /** Current version */
  currentVersion: number;
  /** Incoming version */
  incomingVersion: number;
  /** Source of current value */
  currentSource: string;
  /** Source of incoming value */
  incomingSource: string;
  /** Conflict timestamp */
  timestamp: Date;
}

/**
 * State synchronization configuration
 */
export interface StateSyncConfig {
  /** State types to synchronize */
  stateTypes: SynchronizedStateType[];
  /** Conflict resolution strategy */
  conflictResolution: ConflictResolutionStrategy;
  /** Custom conflict resolver */
  customResolver?: (conflict: StateConflict) => unknown;
  /** Enable optimistic updates */
  optimisticUpdates: boolean;
  /** Synchronization priority */
  priority: 'low' | 'medium' | 'high';
  /** Enable change broadcasting */
  broadcastChanges: boolean;
  /** Maximum state size in bytes */
  maxStateSize?: number;
  /** State TTL in milliseconds */
  stateTTL?: number;
}

/**
 * Synchronized state entry
 */
interface SynchronizedState {
  /** State value */
  value: unknown;
  /** Current version */
  version: number;
  /** Last modified timestamp */
  lastModified: Date;
  /** Source tab ID */
  sourceTabId: string;
  /** State metadata */
  metadata?: Record<string, unknown>;
  /** TTL timestamp */
  expiresAt?: Date;
}

/**
 * State subscription
 */
interface StateSubscription {
  /** Subscription ID */
  id: string;
  /** State type */
  stateType: SynchronizedStateType;
  /** State key pattern */
  keyPattern: string | RegExp;
  /** Change callback */
  callback: (event: StateChangeEvent) => void;
  /** Filter function */
  filter?: (event: StateChangeEvent) => boolean;
  /** Subscription options */
  options: StateSyncConfig;
}

/**
 * Synchronizer configuration
 */
export interface SynchronizerConfig {
  /** Current tab ID */
  tabId: string;
  /** Enable debug logging */
  enableDebugLogging: boolean;
  /** State cleanup interval */
  cleanupInterval: number;
  /** Maximum conflicts to track */
  maxConflicts: number;
  /** State persistence enabled */
  enablePersistence: boolean;
  /** Storage quota in bytes */
  storageQuota: number;
  /** Broadcast channel name */
  broadcastChannel: string;
}

/**
 * Synchronizer statistics
 */
export interface SynchronizerStatistics {
  /** Total state entries */
  totalStates: number;
  /** States by type */
  statesByType: Record<SynchronizedStateType, number>;
  /** Total synchronizations */
  totalSynchronizations: number;
  /** Conflicts resolved */
  conflictsResolved: number;
  /** Active subscriptions */
  activeSubscriptions: number;
  /** Storage usage in bytes */
  storageUsage: number;
  /** Last cleanup timestamp */
  lastCleanup: Date;
  /** Synchronization errors */
  synchronizationErrors: number;
}

/**
 * State synchronizer for cross-tab coordination
 */
export class StateSynchronizer {
  private static instance: StateSynchronizer;
  private config: SynchronizerConfig;
  private states: Map<string, Map<string, SynchronizedState>> = new Map();
  private subscriptions: Map<string, StateSubscription> = new Map();
  private conflicts: Map<string, StateConflict> = new Map();
  private broadcastChannel: BroadcastChannel | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private statistics: SynchronizerStatistics;
  private versionCounters: Map<string, number> = new Map();

  constructor(config: Partial<SynchronizerConfig> = {}) {
    this.config = {
      tabId: this.generateTabId(),
      enableDebugLogging: false,
      cleanupInterval: 60000,
      maxConflicts: 100,
      enablePersistence: true,
      storageQuota: 10 * 1024 * 1024, // 10MB
      broadcastChannel: 'meeting-summarizer-state-sync',
      ...config,
    };

    this.statistics = {
      totalStates: 0,
      statesByType: {} as Record<SynchronizedStateType, number>,
      totalSynchronizations: 0,
      conflictsResolved: 0,
      activeSubscriptions: 0,
      storageUsage: 0,
      lastCleanup: new Date(),
      synchronizationErrors: 0,
    };

    this.initializeBroadcastChannel();
    this.setupEventSubscriptions();
    this.startCleanupInterval();
    this.loadPersistedState();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<SynchronizerConfig>): StateSynchronizer {
    if (!StateSynchronizer.instance) {
      StateSynchronizer.instance = new StateSynchronizer(config);
    }
    return StateSynchronizer.instance;
  }

  /**
   * Set synchronized state
   */
  async setState(
    stateType: SynchronizedStateType,
    key: string,
    value: unknown,
    options: Partial<StateSyncConfig> = {},
  ): Promise<void> {
    const config = this.getDefaultConfig(options);

    try {
      // Validate state size
      if (config.maxStateSize) {
        const serializedSize = JSON.stringify(value).length * 2; // Rough UTF-16 size
        if (serializedSize > config.maxStateSize) {
          throw new Error(`State size exceeds maximum: ${serializedSize} > ${config.maxStateSize}`);
        }
      }

      const stateKey = this.getStateKey(stateType, key);
      const currentState = this.getState(stateType, key);
      const version = this.getNextVersion(stateKey);

      const newState: SynchronizedState = {
        value,
        version,
        lastModified: new Date(),
        sourceTabId: this.config.tabId,
        metadata: options.metadata,
        expiresAt: config.stateTTL ? new Date(Date.now() + config.stateTTL) : undefined,
      };

      // Store state
      this.storeState(stateType, key, newState);

      // Create change event
      const changeEvent: StateChangeEvent = {
        stateType,
        operation: 'set',
        key,
        value,
        previousValue: currentState?.value,
        timestamp: newState.lastModified,
        sourceTabId: this.config.tabId,
        version,
        metadata: options.metadata,
      };

      // Broadcast change if enabled
      if (config.broadcastChanges) {
        await this.broadcastStateChange(changeEvent);
      }

      // Notify subscribers
      this.notifySubscribers(changeEvent);

      // Persist to storage if enabled
      if (this.config.enablePersistence) {
        await this.persistState(stateType, key, newState);
      }

      this.statistics.totalSynchronizations++;
      this.log(`State set: ${stateType}.${key} = ${JSON.stringify(value).substring(0, 100)}`);
    } catch (error) {
      this.statistics.synchronizationErrors++;
      this.log(`State set error: ${error}`);
      throw error;
    }
  }

  /**
   * Get synchronized state
   */
  getState(stateType: SynchronizedStateType, key: string): SynchronizedState | null {
    const stateMap = this.states.get(stateType);
    if (!stateMap) {
      return null;
    }

    const state = stateMap.get(key);
    if (!state) {
      return null;
    }

    // Check if state has expired
    if (state.expiresAt && state.expiresAt < new Date()) {
      this.deleteState(stateType, key);
      return null;
    }

    return state;
  }

  /**
   * Subscribe to state changes
   */
  subscribeToStateChanges(
    stateType: SynchronizedStateType,
    keyPattern: string | RegExp,
    callback: (event: StateChangeEvent) => void,
    options: Partial<StateSyncConfig> = {},
  ): string {
    const subscriptionId = this.generateSubscriptionId();
    const config = this.getDefaultConfig(options);

    const subscription: StateSubscription = {
      id: subscriptionId,
      stateType,
      keyPattern,
      callback,
      filter: options.customResolver ? undefined : undefined,
      options: config,
    };

    this.subscriptions.set(subscriptionId, subscription);
    this.statistics.activeSubscriptions++;

    this.log(`State subscription created: ${subscriptionId} for ${stateType}.${keyPattern}`);
    return subscriptionId;
  }

  /**
   * Get synchronizer statistics
   */
  getStatistics(): SynchronizerStatistics {
    this.updateStatistics();
    return { ...this.statistics };
  }

  /**
   * Initialize broadcast channel
   */
  private initializeBroadcastChannel(): void {
    if (typeof BroadcastChannel === 'undefined') {
      this.log('BroadcastChannel not available, using fallback');
      return;
    }

    try {
      this.broadcastChannel = new BroadcastChannel(this.config.broadcastChannel);

      this.broadcastChannel.onmessage = event => {
        this.handleBroadcastMessage(event.data);
      };

      this.log('Broadcast channel initialized');
    } catch (error) {
      this.log(`Broadcast channel initialization failed: ${error}`);
    }
  }

  /**
   * Setup event subscriptions
   */
  private setupEventSubscriptions(): void {
    // Subscribe to storage events for persistence
    eventSubscriber.addEventListener('storage.updated', event => {
      this.handleStorageUpdate(event);
    });

    // Subscribe to tab/window events
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });
  }

  /**
   * Handle broadcast message from other tabs
   */
  private async handleBroadcastMessage(message: Record<string, unknown>): Promise<void> {
    if (message.sourceTabId === this.config.tabId) {
      return; // Ignore our own messages
    }

    try {
      switch (message.type) {
        case 'state-change':
          await this.handleRemoteStateChange(message.event);
          break;

        default:
          this.log(`Unknown broadcast message type: ${message.type}`);
      }
    } catch (error) {
      this.log(`Broadcast message handling error: ${error}`);
    }
  }

  /**
   * Handle remote state change
   */
  private async handleRemoteStateChange(event: StateChangeEvent): Promise<void> {
    const currentState = this.getState(event.stateType, event.key);

    // Check for conflicts
    if (currentState && currentState.version !== event.version - 1) {
      await this.handleStateConflict(event, currentState);
      return;
    }

    // Apply remote change
    if (event.operation === 'delete') {
      const stateMap = this.states.get(event.stateType);
      if (stateMap) {
        stateMap.delete(event.key);
      }
    } else {
      const newState: SynchronizedState = {
        value: event.value,
        version: event.version,
        lastModified: event.timestamp,
        sourceTabId: event.sourceTabId,
        metadata: event.metadata,
      };

      this.storeState(event.stateType, event.key, newState);
    }

    // Notify local subscribers
    this.notifySubscribers(event);

    this.log(`Remote state change applied: ${event.stateType}.${event.key}`);
  }

  /**
   * Handle state conflict
   */
  private async handleStateConflict(incomingEvent: StateChangeEvent, currentState: SynchronizedState): Promise<void> {
    const conflict: StateConflict = {
      conflictId: this.generateConflictId(),
      stateType: incomingEvent.stateType,
      key: incomingEvent.key,
      currentValue: currentState.value,
      incomingValue: incomingEvent.value,
      currentVersion: currentState.version,
      incomingVersion: incomingEvent.version,
      currentSource: currentState.sourceTabId,
      incomingSource: incomingEvent.sourceTabId,
      timestamp: new Date(),
    };

    // Store conflict
    this.conflicts.set(conflict.conflictId, conflict);

    // Resolve based on strategy (latest-wins)
    const resolution =
      conflict.incomingVersion > conflict.currentVersion ? conflict.incomingValue : conflict.currentValue;

    if (resolution !== undefined) {
      // Apply resolution
      await this.setState(conflict.stateType, conflict.key, resolution, { broadcastChanges: true });

      this.statistics.conflictsResolved++;
      this.log(`Conflict resolved: ${conflict.conflictId}`);
    }

    // Clean up old conflicts
    this.cleanupConflicts();
  }

  /**
   * Broadcast state change to other tabs
   */
  private async broadcastStateChange(event: StateChangeEvent): Promise<void> {
    const message = {
      type: 'state-change',
      event,
      sourceTabId: this.config.tabId,
      timestamp: new Date(),
    };

    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage(message);
    }
  }

  /**
   * Store state in memory
   */
  private storeState(stateType: SynchronizedStateType, key: string, state: SynchronizedState): void {
    if (!this.states.has(stateType)) {
      this.states.set(stateType, new Map());
    }

    this.states.get(stateType)!.set(key, state);
    this.updateStatistics();
  }

  /**
   * Notify state change subscribers
   */
  private notifySubscribers(event: StateChangeEvent): void {
    this.subscriptions.forEach(subscription => {
      if (subscription.stateType !== event.stateType) {
        return;
      }

      if (!this.matchesPattern(event.key, subscription.keyPattern)) {
        return;
      }

      if (subscription.filter && !subscription.filter(event)) {
        return;
      }

      try {
        subscription.callback(event);
      } catch (error) {
        this.log(`Subscription callback error: ${error}`);
      }
    });
  }

  /**
   * Check if key matches pattern
   */
  private matchesPattern(key: string, pattern: string | RegExp): boolean {
    if (typeof pattern === 'string') {
      return key.includes(pattern) || key === pattern;
    } else {
      return pattern.test(key);
    }
  }

  /**
   * Persist state to storage
   */
  private async persistState(stateType: SynchronizedStateType, key: string, state: SynchronizedState): Promise<void> {
    try {
      const storageKey = `state-${stateType}-${key}`;

      await messageDispatcher.sendMessage({
        type: 'storage.set',
        payload: {
          key: storageKey,
          value: {
            ...state,
            lastModified: state.lastModified.toISOString(),
            expiresAt: state.expiresAt?.toISOString(),
          },
          area: 'local',
        },
      });
    } catch (error) {
      this.log(`State persistence failed: ${error}`);
    }
  }

  /**
   * Load persisted state
   */
  private async loadPersistedState(): Promise<void> {
    if (!this.config.enablePersistence) {
      return;
    }

    try {
      const response = await messageDispatcher.sendMessage({
        type: 'storage.get',
        payload: { area: 'local' },
      });

      if (response.success && response.data) {
        const storage = response.data;

        for (const [storageKey, value] of Object.entries(storage)) {
          if (storageKey.startsWith('state-') && value) {
            this.restorePersistedState(storageKey, value);
          }
        }
      }

      this.log('Persisted state loaded');
    } catch (error) {
      this.log(`Failed to load persisted state: ${error}`);
    }
  }

  /**
   * Restore persisted state entry
   */
  private restorePersistedState(storageKey: string, value: unknown): void {
    try {
      const [, stateType, ...keyParts] = storageKey.split('-');
      const key = keyParts.join('-');

      const state: SynchronizedState = {
        ...value,
        lastModified: new Date(value.lastModified),
        expiresAt: value.expiresAt ? new Date(value.expiresAt) : undefined,
      };

      // Check if state has expired
      if (state.expiresAt && state.expiresAt < new Date()) {
        return;
      }

      this.storeState(stateType as SynchronizedStateType, key, state);
    } catch (error) {
      this.log(`Failed to restore state ${storageKey}: ${error}`);
    }
  }

  /**
   * Handle storage update
   */
  private handleStorageUpdate(event: StorageEvent): void {
    // Handle storage-based state synchronization if needed
    this.log(`Storage updated: ${Object.keys(event.data.changes).length} changes`);
  }

  /**
   * Update statistics
   */
  private updateStatistics(): void {
    this.statistics.totalStates = 0;
    this.statistics.statesByType = {} as Record<SynchronizedStateType, number>;
    this.statistics.storageUsage = 0;

    this.states.forEach((stateMap, stateType) => {
      const count = stateMap.size;
      this.statistics.totalStates += count;
      this.statistics.statesByType[stateType] = count;

      // Estimate storage usage
      stateMap.forEach(state => {
        this.statistics.storageUsage += JSON.stringify(state).length * 2;
      });
    });
  }

  /**
   * Start cleanup interval
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Perform cleanup tasks
   */
  private performCleanup(): void {
    this.cleanupExpiredStates();
    this.cleanupConflicts();
    this.statistics.lastCleanup = new Date();
    this.log('Cleanup completed');
  }

  /**
   * Clean up expired states
   */
  private cleanupExpiredStates(): void {
    const now = new Date();
    let cleanedCount = 0;

    this.states.forEach(stateMap => {
      const expiredKeys: string[] = [];

      stateMap.forEach((state, key) => {
        if (state.expiresAt && state.expiresAt < now) {
          expiredKeys.push(key);
        }
      });

      expiredKeys.forEach(key => {
        stateMap.delete(key);
        cleanedCount++;
      });
    });

    if (cleanedCount > 0) {
      this.updateStatistics();
      this.log(`Cleaned up ${cleanedCount} expired states`);
    }
  }

  /**
   * Clean up old conflicts
   */
  private cleanupConflicts(): void {
    if (this.conflicts.size <= this.config.maxConflicts) {
      return;
    }

    const sortedConflicts = Array.from(this.conflicts.entries()).sort(
      ([, a], [, b]) => a.timestamp.getTime() - b.timestamp.getTime(),
    );

    const toRemove = sortedConflicts.slice(0, sortedConflicts.length - this.config.maxConflicts);

    toRemove.forEach(([conflictId]) => {
      this.conflicts.delete(conflictId);
    });

    this.log(`Cleaned up ${toRemove.length} old conflicts`);
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(options: Partial<StateSyncConfig>): StateSyncConfig {
    return {
      stateTypes: [],
      conflictResolution: 'latest-wins',
      optimisticUpdates: true,
      priority: 'medium',
      broadcastChanges: true,
      ...options,
    };
  }

  /**
   * Get state key
   */
  private getStateKey(stateType: SynchronizedStateType, key: string): string {
    return `${stateType}:${key}`;
  }

  /**
   * Get next version number
   */
  private getNextVersion(stateKey: string): number {
    const current = this.versionCounters.get(stateKey) || 0;
    const next = current + 1;
    this.versionCounters.set(stateKey, next);
    return next;
  }

  /**
   * Generate tab ID
   */
  private generateTabId(): string {
    return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate subscription ID
   */
  private generateSubscriptionId(): string {
    return `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate conflict ID
   */
  private generateConflictId(): string {
    return `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log debug message
   */
  private log(message: string): void {
    if (this.config.enableDebugLogging) {
      console.log(`[StateSynchronizer] ${message}`);
    }
  }

  /**
   * Delete state
   */
  async deleteState(
    stateType: SynchronizedStateType,
    key: string,
    _options: Partial<StateSyncConfig> = {},
  ): Promise<void> {
    const stateMap = this.states.get(stateType);
    if (stateMap) {
      stateMap.delete(key);
      this.updateStatistics();
    }
  }

  /**
   * Cleanup synchronizer
   */
  cleanup(): void {
    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Close broadcast channel
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }

    // Clear all data
    this.states.clear();
    this.subscriptions.clear();
    this.conflicts.clear();
    this.versionCounters.clear();

    this.log('State synchronizer cleanup completed');
  }
}

// Export singleton instance
export const stateSynchronizer = StateSynchronizer.getInstance();

// Export utility functions
export const syncUtils = {
  /**
   * Get synchronizer instance
   */
  getInstance: (config?: Partial<SynchronizerConfig>) => StateSynchronizer.getInstance(config),

  /**
   * Set state with default options
   */
  setState: <T = unknown>(
    stateType: SynchronizedStateType,
    key: string,
    value: T,
    options?: Partial<StateSyncConfig>,
  ): Promise<void> => stateSynchronizer.setState(stateType, key, value, options),

  /**
   * Get state value
   */
  getState: <T = unknown>(stateType: SynchronizedStateType, key: string): T | null => {
    const state = stateSynchronizer.getState(stateType, key);
    return state ? state.value : null;
  },

  /**
   * Subscribe to state changes
   */
  subscribe: (
    stateType: SynchronizedStateType,
    keyPattern: string | RegExp,
    callback: (event: StateChangeEvent) => void,
    options?: Partial<StateSyncConfig>,
  ): string => stateSynchronizer.subscribeToStateChanges(stateType, keyPattern, callback, options),

  /**
   * Get statistics
   */
  getStats: (): SynchronizerStatistics => stateSynchronizer.getStatistics(),

  /**
   * Cleanup synchronizer
   */
  cleanup: (): void => {
    stateSynchronizer.cleanup();
  },
};
