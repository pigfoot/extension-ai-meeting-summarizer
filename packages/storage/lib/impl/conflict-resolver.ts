/**
 * Conflict resolution with last-write-wins and user notification
 * Implements conflict detection and manual resolution options for sync conflicts
 */

import type { SyncConflict, ConflictResolutionStrategy } from '../types/cache';

/**
 * Conflict resolution result
 */
export interface ConflictResolutionResult {
  /** Whether resolution was successful */
  success: boolean;
  /** Resolved data */
  resolvedData?: unknown;
  /** Resolution strategy used */
  strategy: ConflictResolutionStrategy;
  /** Resolution timestamp */
  resolvedAt: string;
  /** Resolution details */
  details: {
    /** Original conflict ID */
    conflictId: string;
    /** Data sources involved */
    sources: string[];
    /** Resolution method applied */
    method: string;
    /** User intervention required */
    userInterventionRequired: boolean;
    /** Backup created */
    backupCreated: boolean;
  };
  /** Error message if resolution failed */
  error?: string | undefined;
}

/**
 * Conflict analysis result
 */
export interface ConflictAnalysis {
  /** Conflict severity */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Conflict type classification */
  type: 'data_type' | 'timestamp' | 'version' | 'structure' | 'content';
  /** Recommended resolution strategy */
  recommendedStrategy: ConflictResolutionStrategy;
  /** Analysis confidence score */
  confidence: number;
  /** Detailed analysis */
  analysis: {
    /** Data differences found */
    differences: Array<{
      path: string;
      localValue: unknown;
      remoteValue: unknown;
      type: 'modified' | 'added' | 'deleted';
    }>;
    /** Compatibility assessment */
    compatibility: 'compatible' | 'incompatible' | 'unknown';
    /** Merge feasibility */
    mergeable: boolean;
  };
}

/**
 * User notification for conflicts
 */
export interface ConflictNotification {
  /** Notification ID */
  notificationId: string;
  /** Conflict ID */
  conflictId: string;
  /** Notification type */
  type: 'info' | 'warning' | 'error';
  /** User-friendly title */
  title: string;
  /** Detailed message */
  message: string;
  /** Available actions */
  actions: Array<{
    id: string;
    label: string;
    strategy: ConflictResolutionStrategy;
    primary: boolean;
  }>;
  /** Notification timestamp */
  timestamp: string;
  /** Auto-dismiss timeout */
  autoTimeout?: number;
}

/**
 * Conflict resolution configuration
 */
export interface ConflictResolverConfig {
  /** Default resolution strategy */
  defaultStrategy: ConflictResolutionStrategy;
  /** Enable automatic resolution */
  enableAutoResolution: boolean;
  /** Auto-resolution thresholds */
  autoResolutionThresholds: {
    /** Maximum time difference for auto-resolution (ms) */
    maxTimeDifference: number;
    /** Minimum confidence for auto-resolution */
    minConfidence: number;
    /** Enable auto-resolution for low severity conflicts */
    enableLowSeverityAuto: boolean;
  };
  /** User notification settings */
  notifications: {
    /** Enable user notifications */
    enabled: boolean;
    /** Show notifications for auto-resolved conflicts */
    showAutoResolved: boolean;
    /** Notification timeout in milliseconds */
    timeout: number;
  };
  /** Backup settings */
  backup: {
    /** Create backups before resolution */
    enableBackup: boolean;
    /** Maximum number of backups to keep */
    maxBackups: number;
    /** Backup retention period in milliseconds */
    retentionPeriod: number;
  };
  /** Advanced options */
  advanced: {
    /** Enable deep object merging */
    enableDeepMerge: boolean;
    /** Enable conflict history tracking */
    trackHistory: boolean;
    /** Maximum conflicts to track in history */
    maxHistorySize: number;
  };
}

/**
 * Conflict resolution statistics
 */
export interface ConflictResolutionStats {
  /** Total conflicts resolved */
  totalResolved: number;
  /** Resolutions by strategy */
  resolutionsByStrategy: Record<ConflictResolutionStrategy, number>;
  /** Auto-resolved conflicts */
  autoResolved: number;
  /** Manual resolutions */
  manualResolutions: number;
  /** Failed resolutions */
  failedResolutions: number;
  /** Average resolution time */
  averageResolutionTime: number;
  /** User intervention rate */
  userInterventionRate: number;
  /** Success rate */
  successRate: number;
  /** Last resolution timestamp */
  lastResolution?: string;
  /** Statistics update timestamp */
  lastUpdated: string;
}

/**
 * Conflict resolver with intelligent resolution strategies
 */
export class ConflictResolver {
  private config: ConflictResolverConfig;
  private stats: ConflictResolutionStats;
  private conflictHistory: SyncConflict[] = [];
  private pendingConflicts = new Map<string, SyncConflict>();
  private resolutionCallbacks = new Map<string, (result: ConflictResolutionResult) => void>();
  private notificationCallbacks = new Set<(notification: ConflictNotification) => void>();

  constructor(config: Partial<ConflictResolverConfig> = {}) {
    this.config = {
      defaultStrategy: config.defaultStrategy || 'last_write_wins',
      enableAutoResolution: config.enableAutoResolution !== false,
      autoResolutionThresholds: {
        maxTimeDifference: 60000, // 1 minute
        minConfidence: 0.8,
        enableLowSeverityAuto: true,
        ...config.autoResolutionThresholds,
      },
      notifications: {
        enabled: true,
        showAutoResolved: false,
        timeout: 30000, // 30 seconds
        ...config.notifications,
      },
      backup: {
        enableBackup: true,
        maxBackups: 10,
        retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
        ...config.backup,
      },
      advanced: {
        enableDeepMerge: true,
        trackHistory: true,
        maxHistorySize: 100,
        ...config.advanced,
      },
    };

    this.stats = this.initializeStats();
  }

  /**
   * Resolve sync conflict
   */
  async resolveConflict(
    conflict: SyncConflict,
    strategy?: ConflictResolutionStrategy,
    userChoices?: Record<string, unknown>,
  ): Promise<ConflictResolutionResult> {
    const startTime = Date.now();
    const resolvedAt = new Date().toISOString();
    const conflictId = conflict.conflictId || this.generateConflictId();

    try {
      console.log(`[ConflictResolver] Resolving conflict: ${conflictId} (strategy: ${strategy || 'auto'})`);

      // Store conflict as pending
      this.pendingConflicts.set(conflictId, conflict);

      // Analyze conflict if no strategy provided
      const selectedStrategy = strategy || (await this.selectResolutionStrategy(conflict));

      // Create backup if enabled
      let backupCreated = false;
      if (this.config.backup.enableBackup) {
        backupCreated = await this.createConflictBackup(conflict);
      }

      // Apply resolution strategy
      const resolutionResult = await this.applyResolutionStrategy(conflict, selectedStrategy, userChoices);

      const result: ConflictResolutionResult = {
        success: resolutionResult.success,
        resolvedData: resolutionResult.resolvedData,
        strategy: selectedStrategy,
        resolvedAt,
        details: {
          conflictId,
          sources: [conflict.localSource || 'local', conflict.remoteSource || 'remote'],
          method: resolutionResult.method || selectedStrategy,
          userInterventionRequired: selectedStrategy === 'manual',
          backupCreated,
        },
        error: resolutionResult.error,
      };

      // Update statistics
      this.updateResolutionStats(result, Date.now() - startTime);

      // Add to history if tracking enabled
      if (this.config.advanced.trackHistory) {
        this.addToHistory(conflict);
      }

      // Send notification if enabled
      if (this.config.notifications.enabled) {
        await this.sendResolutionNotification(conflict, result);
      }

      // Execute callback if registered
      const callback = this.resolutionCallbacks.get(conflictId);
      if (callback) {
        try {
          callback(result);
        } catch (error) {
          console.warn(`[ConflictResolver] Callback failed for ${conflictId}:`, error);
        }
        this.resolutionCallbacks.delete(conflictId);
      }

      // Remove from pending
      this.pendingConflicts.delete(conflictId);

      console.log(`[ConflictResolver] Conflict resolved: ${conflictId} (${result.success ? 'success' : 'failed'})`);

      return result;
    } catch (error) {
      const result: ConflictResolutionResult = {
        success: false,
        strategy: strategy || this.config.defaultStrategy,
        resolvedAt,
        details: {
          conflictId,
          sources: [conflict.localSource || 'local', conflict.remoteSource || 'remote'],
          method: 'error',
          userInterventionRequired: true,
          backupCreated: false,
        },
        error: error instanceof Error ? error.message : String(error),
      };

      this.updateResolutionStats(result, Date.now() - startTime);
      this.pendingConflicts.delete(conflictId);

      console.error(`[ConflictResolver] Conflict resolution failed: ${conflictId}:`, error);

      return result;
    }
  }

  /**
   * Analyze conflict for resolution recommendations
   */
  async analyzeConflict(conflict: SyncConflict): Promise<ConflictAnalysis> {
    try {
      const analysis: ConflictAnalysis = {
        severity: 'medium',
        type: 'content',
        recommendedStrategy: this.config.defaultStrategy,
        confidence: 0.5,
        analysis: {
          differences: [],
          compatibility: 'unknown',
          mergeable: false,
        },
      };

      // Analyze data types
      const localType = typeof conflict.localData;
      const remoteType = typeof conflict.remoteData;

      if (localType !== remoteType) {
        analysis.type = 'data_type';
        analysis.severity = 'high';
        analysis.recommendedStrategy = 'manual';
        analysis.confidence = 0.9;
        analysis.analysis.compatibility = 'incompatible';
        return analysis;
      }

      // Analyze timestamps
      const timeDiff = this.calculateTimeDifference(conflict);
      if (timeDiff !== null) {
        if (timeDiff > this.config.autoResolutionThresholds.maxTimeDifference) {
          analysis.type = 'timestamp';
          analysis.severity = 'medium';
          analysis.recommendedStrategy = 'last_write_wins';
        } else {
          analysis.severity = 'low';
          analysis.recommendedStrategy = 'merge';
        }
        analysis.confidence = Math.min(0.9, 0.5 + (1 - timeDiff / 3600000)); // Confidence decreases with age
      }

      // Analyze data structure and content
      if (localType === 'object' && remoteType === 'object') {
        const differences = this.findDataDifferences(conflict.localData, conflict.remoteData);
        analysis.analysis.differences = differences;
        analysis.analysis.mergeable = this.config.advanced.enableDeepMerge && differences.length < 10;

        if (differences.length === 0) {
          analysis.severity = 'low';
          analysis.recommendedStrategy = 'no_conflict';
          analysis.confidence = 1.0;
        } else if (analysis.analysis.mergeable) {
          analysis.recommendedStrategy = 'merge';
          analysis.confidence = 0.8;
        }

        // Check for structural changes
        const hasStructuralChanges = differences.some(d => d.type === 'added' || d.type === 'deleted');
        if (hasStructuralChanges) {
          analysis.type = 'structure';
          analysis.severity = 'high';
        }
      }

      return analysis;
    } catch (error) {
      console.warn('[ConflictResolver] Conflict analysis failed:', error);

      return {
        severity: 'critical',
        type: 'content',
        recommendedStrategy: 'manual',
        confidence: 0.1,
        analysis: {
          differences: [],
          compatibility: 'unknown',
          mergeable: false,
        },
      };
    }
  }

  /**
   * Register callback for conflict resolution
   */
  onConflictResolved(conflictId: string, callback: (result: ConflictResolutionResult) => void): void {
    this.resolutionCallbacks.set(conflictId, callback);
  }

  /**
   * Register callback for conflict notifications
   */
  onNotification(callback: (notification: ConflictNotification) => void): void {
    this.notificationCallbacks.add(callback);
  }

  /**
   * Get pending conflicts
   */
  getPendingConflicts(): SyncConflict[] {
    return Array.from(this.pendingConflicts.values());
  }

  /**
   * Get conflict resolution statistics
   */
  getStats(): ConflictResolutionStats {
    this.updateStatsCalculations();
    return { ...this.stats };
  }

  /**
   * Get conflict history
   */
  getConflictHistory(limit: number = 50): SyncConflict[] {
    return this.conflictHistory
      .slice(-limit)
      .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
  }

  /**
   * Update conflict resolver configuration
   */
  updateConfig(config: Partial<ConflictResolverConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[ConflictResolver] Configuration updated');
  }

  /**
   * Clear conflict history
   */
  clearHistory(): number {
    const count = this.conflictHistory.length;
    this.conflictHistory = [];
    console.log(`[ConflictResolver] Cleared ${count} conflict history entries`);
    return count;
  }

  /**
   * Shutdown conflict resolver
   */
  async shutdown(): Promise<void> {
    console.log('[ConflictResolver] Shutting down');

    // Resolve pending conflicts with default strategy
    const pendingConflicts = Array.from(this.pendingConflicts.values());
    if (pendingConflicts.length > 0) {
      console.log(`[ConflictResolver] Auto-resolving ${pendingConflicts.length} pending conflicts`);

      const resolutionPromises = pendingConflicts.map(conflict =>
        this.resolveConflict(conflict, this.config.defaultStrategy),
      );

      await Promise.allSettled(resolutionPromises);
    }

    this.pendingConflicts.clear();
    this.resolutionCallbacks.clear();
    this.notificationCallbacks.clear();

    console.log('[ConflictResolver] Shutdown completed');
  }

  /**
   * Select appropriate resolution strategy
   */
  private async selectResolutionStrategy(conflict: SyncConflict): Promise<ConflictResolutionStrategy> {
    if (!this.config.enableAutoResolution) {
      return 'manual';
    }

    const analysis = await this.analyzeConflict(conflict);

    // Check if auto-resolution is appropriate
    if (analysis.confidence < this.config.autoResolutionThresholds.minConfidence) {
      return 'manual';
    }

    if (analysis.severity === 'critical' || analysis.severity === 'high') {
      return 'manual';
    }

    if (analysis.severity === 'low' && !this.config.autoResolutionThresholds.enableLowSeverityAuto) {
      return 'manual';
    }

    return analysis.recommendedStrategy;
  }

  /**
   * Apply resolution strategy
   */
  private async applyResolutionStrategy(
    conflict: SyncConflict,
    strategy: ConflictResolutionStrategy,
    userChoices?: Record<string, unknown>,
  ): Promise<{
    success: boolean;
    resolvedData?: unknown;
    method?: string;
    error?: string;
  }> {
    switch (strategy) {
      case 'last_write_wins':
        return this.applyLastWriteWins(conflict);

      case 'first_write_wins':
        return this.applyFirstWriteWins(conflict);

      case 'merge':
        return this.applyMergeStrategy(conflict);

      case 'local_wins':
        return {
          success: true,
          resolvedData: conflict.localData,
          method: 'local_wins',
        };

      case 'remote_wins':
        return {
          success: true,
          resolvedData: conflict.remoteData,
          method: 'remote_wins',
        };

      case 'manual':
        return this.applyManualStrategy(conflict, userChoices);

      case 'no_conflict':
        return {
          success: true,
          resolvedData: conflict.localData, // Assuming they're the same
          method: 'no_conflict',
        };

      default:
        return {
          success: false,
          error: `Unsupported resolution strategy: ${strategy}`,
        };
    }
  }

  /**
   * Apply last write wins strategy
   */
  private async applyLastWriteWins(conflict: SyncConflict): Promise<{
    success: boolean;
    resolvedData?: unknown;
    method?: string;
  }> {
    const localTime = new Date(conflict.localTimestamp || 0).getTime();
    const remoteTime = new Date(conflict.remoteTimestamp || 0).getTime();

    const useLocal = localTime >= remoteTime;

    return {
      success: true,
      resolvedData: useLocal ? conflict.localData : conflict.remoteData,
      method: `last_write_wins_${useLocal ? 'local' : 'remote'}`,
    };
  }

  /**
   * Apply first write wins strategy
   */
  private async applyFirstWriteWins(conflict: SyncConflict): Promise<{
    success: boolean;
    resolvedData?: unknown;
    method?: string;
  }> {
    const localTime = new Date(conflict.localTimestamp || 0).getTime();
    const remoteTime = new Date(conflict.remoteTimestamp || 0).getTime();

    const useLocal = localTime <= remoteTime;

    return {
      success: true,
      resolvedData: useLocal ? conflict.localData : conflict.remoteData,
      method: `first_write_wins_${useLocal ? 'local' : 'remote'}`,
    };
  }

  /**
   * Apply merge strategy
   */
  private async applyMergeStrategy(conflict: SyncConflict): Promise<{
    success: boolean;
    resolvedData?: unknown;
    method?: string;
    error?: string;
  }> {
    try {
      if (!this.config.advanced.enableDeepMerge) {
        return {
          success: false,
          error: 'Deep merge not enabled',
        };
      }

      // Simple merge for objects
      if (
        typeof conflict.localData === 'object' &&
        typeof conflict.remoteData === 'object' &&
        conflict.localData !== null &&
        conflict.remoteData !== null
      ) {
        const merged = this.deepMerge(conflict.localData, conflict.remoteData);

        return {
          success: true,
          resolvedData: merged,
          method: 'deep_merge',
        };
      }

      // For non-objects, fall back to last write wins
      return this.applyLastWriteWins(conflict);
    } catch (error) {
      return {
        success: false,
        error: `Merge failed: ${error}`,
      };
    }
  }

  /**
   * Apply manual strategy
   */
  private async applyManualStrategy(
    conflict: SyncConflict,
    userChoices?: Record<string, unknown>,
  ): Promise<{
    success: boolean;
    resolvedData?: unknown;
    method?: string;
    error?: string;
  }> {
    if (!userChoices) {
      return {
        success: false,
        error: 'Manual resolution requires user choices',
      };
    }

    return {
      success: true,
      resolvedData: userChoices.resolvedData,
      method: 'manual',
    };
  }

  /**
   * Create conflict backup
   */
  private async createConflictBackup(conflict: SyncConflict): Promise<boolean> {
    try {
      const backupKey = `conflict_backup_${conflict.key}_${Date.now()}`;
      const backupData = {
        originalConflict: conflict,
        backupTimestamp: new Date().toISOString(),
      };

      // Store backup in local storage
      await chrome.storage.local.set({ [backupKey]: backupData });

      // Cleanup old backups
      await this.cleanupOldBackups();

      return true;
    } catch (error) {
      console.warn('[ConflictResolver] Failed to create backup:', error);
      return false;
    }
  }

  /**
   * Cleanup old backups
   */
  private async cleanupOldBackups(): Promise<void> {
    try {
      const allData = await chrome.storage.local.get();
      const backupKeys = Object.keys(allData).filter(key => key.startsWith('conflict_backup_'));

      if (backupKeys.length > this.config.backup.maxBackups) {
        // Sort by timestamp and remove oldest
        const backupsWithTime = backupKeys.map(key => ({
          key,
          timestamp: allData[key]?.backupTimestamp || '0',
        }));

        backupsWithTime.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

        const toRemove = backupsWithTime
          .slice(0, backupsWithTime.length - this.config.backup.maxBackups)
          .map(backup => backup.key);

        if (toRemove.length > 0) {
          await chrome.storage.local.remove(toRemove);
        }
      }

      // Remove expired backups
      const cutoffTime = Date.now() - this.config.backup.retentionPeriod;
      const expiredKeys = backupKeys.filter(key => {
        const backup = allData[key];
        return backup && new Date(backup.backupTimestamp).getTime() < cutoffTime;
      });

      if (expiredKeys.length > 0) {
        await chrome.storage.local.remove(expiredKeys);
      }
    } catch (error) {
      console.warn('[ConflictResolver] Failed to cleanup old backups:', error);
    }
  }

  /**
   * Send resolution notification
   */
  private async sendResolutionNotification(conflict: SyncConflict, result: ConflictResolutionResult): Promise<void> {
    if (!this.config.notifications.enabled) return;
    if (!this.config.notifications.showAutoResolved && result.strategy !== 'manual') return;

    const notification: ConflictNotification = {
      notificationId: this.generateNotificationId(),
      conflictId: result.details.conflictId,
      type: result.success ? 'info' : 'error',
      title: result.success ? 'Conflict Resolved' : 'Conflict Resolution Failed',
      message: result.success
        ? `Sync conflict for "${conflict.key}" resolved using ${result.strategy} strategy.`
        : `Failed to resolve sync conflict for "${conflict.key}": ${result.error}`,
      actions: [],
      timestamp: new Date().toISOString(),
      autoTimeout: this.config.notifications.timeout,
    };

    // Send to all registered callbacks
    for (const callback of this.notificationCallbacks) {
      try {
        callback(notification);
      } catch (error) {
        console.warn('[ConflictResolver] Notification callback failed:', error);
      }
    }
  }

  /**
   * Calculate time difference between conflicting data
   */
  private calculateTimeDifference(conflict: SyncConflict): number | null {
    if (!conflict.localTimestamp || !conflict.remoteTimestamp) {
      return null;
    }

    const localTime = new Date(conflict.localTimestamp).getTime();
    const remoteTime = new Date(conflict.remoteTimestamp).getTime();

    return Math.abs(localTime - remoteTime);
  }

  /**
   * Find differences between data objects
   */
  private findDataDifferences(
    local: unknown,
    remote: unknown,
    path: string = '',
  ): Array<{
    path: string;
    localValue: unknown;
    remoteValue: unknown;
    type: 'modified' | 'added' | 'deleted';
  }> {
    const differences: Array<{
      path: string;
      localValue: unknown;
      remoteValue: unknown;
      type: 'modified' | 'added' | 'deleted';
    }> = [];

    if (typeof local !== 'object' || typeof remote !== 'object' || local === null || remote === null) {
      if (local !== remote) {
        differences.push({
          path,
          localValue: local,
          remoteValue: remote,
          type: 'modified',
        });
      }
      return differences;
    }

    const localObj = local as Record<string, unknown>;
    const remoteObj = remote as Record<string, unknown>;

    const allKeys = new Set([...Object.keys(localObj), ...Object.keys(remoteObj)]);

    for (const key of allKeys) {
      const newPath = path ? `${path}.${key}` : key;
      const hasLocal = key in localObj;
      const hasRemote = key in remoteObj;

      if (hasLocal && hasRemote) {
        const subDiffs = this.findDataDifferences(localObj[key], remoteObj[key], newPath);
        differences.push(...subDiffs);
      } else if (hasLocal && !hasRemote) {
        differences.push({
          path: newPath,
          localValue: localObj[key],
          remoteValue: undefined,
          type: 'deleted',
        });
      } else if (!hasLocal && hasRemote) {
        differences.push({
          path: newPath,
          localValue: undefined,
          remoteValue: remoteObj[key],
          type: 'added',
        });
      }
    }

    return differences;
  }

  /**
   * Deep merge objects
   */
  private deepMerge(local: unknown, remote: unknown): unknown {
    if (typeof local !== 'object' || typeof remote !== 'object' || local === null || remote === null) {
      // For non-objects, prefer remote (assuming it's newer)
      return remote;
    }

    if (Array.isArray(local) && Array.isArray(remote)) {
      // Merge arrays by concatenation and deduplication
      return [...new Set([...local, ...remote])];
    }

    if (Array.isArray(local) || Array.isArray(remote)) {
      // Mixed array/object, prefer non-array
      return Array.isArray(local) ? remote : local;
    }

    const localObj = local as Record<string, unknown>;
    const remoteObj = remote as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...localObj };

    for (const [key, value] of Object.entries(remoteObj)) {
      if (key in merged) {
        merged[key] = this.deepMerge(merged[key], value);
      } else {
        merged[key] = value;
      }
    }

    return merged;
  }

  /**
   * Add conflict to history
   */
  private addToHistory(conflict: SyncConflict): void {
    this.conflictHistory.push(conflict);

    // Limit history size
    if (this.conflictHistory.length > this.config.advanced.maxHistorySize) {
      this.conflictHistory = this.conflictHistory.slice(-this.config.advanced.maxHistorySize / 2);
    }
  }

  /**
   * Update resolution statistics
   */
  private updateResolutionStats(result: ConflictResolutionResult, duration: number): void {
    this.stats.totalResolved++;

    if (result.success) {
      this.stats.resolutionsByStrategy[result.strategy]++;

      if (result.details.userInterventionRequired) {
        this.stats.manualResolutions++;
      } else {
        this.stats.autoResolved++;
      }
    } else {
      this.stats.failedResolutions++;
    }

    // Update average resolution time
    this.stats.averageResolutionTime =
      (this.stats.averageResolutionTime * (this.stats.totalResolved - 1) + duration) / this.stats.totalResolved;

    this.stats.lastResolution = result.resolvedAt;
  }

  /**
   * Update statistics calculations
   */
  private updateStatsCalculations(): void {
    const total = this.stats.totalResolved;
    const successful = total - this.stats.failedResolutions;

    this.stats.successRate = total > 0 ? (successful / total) * 100 : 0;
    this.stats.userInterventionRate = total > 0 ? (this.stats.manualResolutions / total) * 100 : 0;
    this.stats.lastUpdated = new Date().toISOString();
  }

  /**
   * Generate conflict ID
   */
  private generateConflictId(): string {
    return `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate notification ID
   */
  private generateNotificationId(): string {
    return `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Initialize resolution statistics
   */
  private initializeStats(): ConflictResolutionStats {
    return {
      totalResolved: 0,
      resolutionsByStrategy: {
        last_write_wins: 0,
        first_write_wins: 0,
        merge: 0,
        local_wins: 0,
        remote_wins: 0,
        manual: 0,
        no_conflict: 0,
        latest_timestamp: 0,
      },
      autoResolved: 0,
      manualResolutions: 0,
      failedResolutions: 0,
      averageResolutionTime: 0,
      userInterventionRate: 0,
      successRate: 0,
      lastUpdated: new Date().toISOString(),
    };
  }
}
