/**
 * Conflict resolver for storage layer data conflicts
 * Implements intelligent conflict detection and resolution strategies
 */

/**
 * Conflict types
 */
export type ConflictType =
  | 'version_mismatch'
  | 'timestamp_conflict'
  | 'schema_conflict'
  | 'data_corruption'
  | 'concurrent_modification';

/**
 * Resolution strategies
 */
export type ResolutionStrategy =
  | 'last_write_wins'
  | 'first_write_wins'
  | 'merge'
  | 'manual'
  | 'backup_and_overwrite'
  | 'prefer_source';

/**
 * Storage layer for conflict resolution
 */
export type ConflictStorageLayer = 'memory' | 'local' | 'sync' | 'session' | 'indexeddb';

/**
 * Data conflict information
 */
export interface DataConflict {
  /** Conflict identifier */
  conflictId: string;
  /** Conflict type */
  type: ConflictType;
  /** Storage key in conflict */
  key: string;
  /** Conflicting storage layers */
  layers: ConflictStorageLayer[];
  /** Conflict severity */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Data versions in conflict */
  conflictingData: ConflictingDataVersion[];
  /** Conflict detection timestamp */
  detectedAt: string;
  /** Resolution status */
  status: 'pending' | 'resolving' | 'resolved' | 'failed' | 'manual_required';
  /** Resolution metadata */
  resolution?: {
    /** Resolution strategy used */
    strategy: ResolutionStrategy;
    /** Chosen data version */
    chosenVersion?: string;
    /** Resolution timestamp */
    resolvedAt: string;
    /** Resolution details */
    details: string;
  };
  /** User intervention required */
  requiresUserIntervention: boolean;
}

/**
 * Conflicting data version
 */
export interface ConflictingDataVersion {
  /** Version identifier */
  versionId: string;
  /** Source storage layer */
  sourceLayer: ConflictStorageLayer;
  /** Data content */
  data: unknown;
  /** Data timestamp */
  timestamp: string;
  /** Data checksum */
  checksum: string;
  /** Version metadata */
  metadata: {
    /** Creation timestamp */
    createdAt: string;
    /** Last modified timestamp */
    modifiedAt: string;
    /** Modification count */
    modificationCount: number;
    /** Data source */
    source: string;
  };
}

/**
 * Conflict resolution result
 */
export interface ConflictResolutionResult {
  /** Conflict identifier */
  conflictId: string;
  /** Whether resolution was successful */
  success: boolean;
  /** Resolution strategy used */
  strategy: ResolutionStrategy;
  /** Resolved data */
  resolvedData?: unknown;
  /** Target layers for propagation */
  targetLayers: ConflictStorageLayer[];
  /** Resolution duration in milliseconds */
  duration: number;
  /** Resolution details */
  details: {
    /** Data versions considered */
    versionsConsidered: number;
    /** Chosen version ID */
    chosenVersionId?: string;
    /** Backup created */
    backupCreated: boolean;
    /** Merge conflicts encountered */
    mergeConflicts: string[];
    /** Warnings generated */
    warnings: string[];
    /** Errors encountered */
    errors: string[];
  };
  /** Resolution timestamp */
  timestamp: string;
}

/**
 * Conflict detection configuration
 */
export interface ConflictDetectionConfig {
  /** Enable automatic conflict detection */
  enableAutoDetection: boolean;
  /** Detection interval in milliseconds */
  detectionInterval: number;
  /** Timestamp tolerance in milliseconds */
  timestampTolerance: number;
  /** Enable checksum validation */
  enableChecksumValidation: boolean;
  /** Conflict severity thresholds */
  severityThresholds: {
    /** High severity threshold (hours) */
    highSeverityHours: number;
    /** Critical severity threshold (hours) */
    criticalSeverityHours: number;
  };
  /** Auto-resolution settings */
  autoResolution: {
    /** Enable automatic resolution */
    enabled: boolean;
    /** Maximum auto-resolution attempts */
    maxAttempts: number;
    /** Strategies allowed for auto-resolution */
    allowedStrategies: ResolutionStrategy[];
  };
}

/**
 * Conflict resolver statistics
 */
export interface ConflictResolverStats {
  /** Total conflicts detected */
  totalConflicts: number;
  /** Conflicts by type */
  conflictsByType: Record<ConflictType, number>;
  /** Conflicts by severity */
  conflictsBySeverity: Record<string, number>;
  /** Resolved conflicts */
  resolvedConflicts: number;
  /** Failed resolutions */
  failedResolutions: number;
  /** Manual interventions required */
  manualInterventions: number;
  /** Resolution strategies used */
  strategiesUsed: Record<ResolutionStrategy, number>;
  /** Average resolution time */
  avgResolutionTime: number;
  /** Success rate */
  successRate: number;
  /** Auto-resolution success rate */
  autoResolutionSuccessRate: number;
  /** Last conflict detection */
  lastDetection?: string;
  /** Statistics update timestamp */
  lastUpdated: string;
}

/**
 * Conflict resolver for intelligent data conflict management
 */
export class ConflictResolver {
  private config: ConflictDetectionConfig;
  private activeConflicts = new Map<string, DataConflict>();
  private resolvedConflicts = new Map<string, DataConflict>();
  private stats: ConflictResolverStats;
  private detectionInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<ConflictDetectionConfig> = {}) {
    this.config = {
      enableAutoDetection: true,
      detectionInterval: 300000, // 5 minutes
      timestampTolerance: 5000, // 5 seconds
      enableChecksumValidation: true,
      severityThresholds: {
        highSeverityHours: 24,
        criticalSeverityHours: 72,
      },
      autoResolution: {
        enabled: true,
        maxAttempts: 3,
        allowedStrategies: ['last_write_wins', 'merge', 'prefer_source'],
      },
      ...config,
    };

    this.stats = this.initializeStats();

    if (this.config.enableAutoDetection) {
      this.startConflictDetection();
    }
  }

  /**
   * Detect conflicts across storage layers
   */
  async detectConflicts(keys?: string[]): Promise<DataConflict[]> {
    console.log('[ConflictResolver] Starting conflict detection');

    try {
      const conflicts: DataConflict[] = [];
      const keysToCheck = keys || (await this.getAllStorageKeys());

      for (const key of keysToCheck) {
        const keyConflicts = await this.detectKeyConflicts(key);
        conflicts.push(...keyConflicts);
      }

      // Store detected conflicts
      for (const conflict of conflicts) {
        this.activeConflicts.set(conflict.conflictId, conflict);
      }

      // Update statistics
      this.updateDetectionStats(conflicts);

      console.log(`[ConflictResolver] Detected ${conflicts.length} conflicts`);

      // Trigger auto-resolution if enabled
      if (this.config.autoResolution.enabled && conflicts.length > 0) {
        setTimeout(() => this.autoResolveConflicts(), 0);
      }

      return conflicts;
    } catch (error) {
      console.error('[ConflictResolver] Conflict detection failed:', error);
      return [];
    }
  }

  /**
   * Resolve specific conflict
   */
  async resolveConflict(
    conflictId: string,
    strategy: ResolutionStrategy,
    options?: {
      /** Target layers to propagate resolved data */
      targetLayers?: ConflictStorageLayer[];
      /** Create backup before resolution */
      createBackup?: boolean;
      /** Manual resolution data */
      manualData?: unknown;
    },
  ): Promise<ConflictResolutionResult> {
    const startTime = Date.now();

    const conflict = this.activeConflicts.get(conflictId);
    if (!conflict) {
      throw new Error(`Conflict not found: ${conflictId}`);
    }

    console.log(`[ConflictResolver] Resolving conflict: ${conflictId} with strategy: ${strategy}`);

    try {
      conflict.status = 'resolving';

      // Create backup if requested
      let backupCreated = false;
      if (options?.createBackup) {
        await this.createConflictBackup(conflict);
        backupCreated = true;
      }

      // Apply resolution strategy
      const resolutionResult = await this.applyResolutionStrategy(conflict, strategy, options);

      // Propagate resolved data to target layers
      const targetLayers = options?.targetLayers || conflict.layers;
      await this.propagateResolvedData(conflict.key, resolutionResult.resolvedData, targetLayers);

      // Create final result
      const result: ConflictResolutionResult = {
        conflictId,
        success: resolutionResult.success,
        strategy,
        resolvedData: resolutionResult.resolvedData,
        targetLayers,
        duration: Date.now() - startTime,
        details: {
          versionsConsidered: conflict.conflictingData.length,
          chosenVersionId: resolutionResult.chosenVersionId,
          backupCreated,
          mergeConflicts: resolutionResult.mergeConflicts || [],
          warnings: resolutionResult.warnings || [],
          errors: resolutionResult.errors || [],
        },
        timestamp: new Date().toISOString(),
      };

      // Update conflict status
      if (result.success) {
        conflict.status = 'resolved';
        conflict.resolution = {
          strategy,
          chosenVersion: result.details.chosenVersionId,
          resolvedAt: result.timestamp,
          details: `Resolved using ${strategy} strategy`,
        };

        // Move to resolved conflicts
        this.resolvedConflicts.set(conflictId, conflict);
        this.activeConflicts.delete(conflictId);
      } else {
        conflict.status = 'failed';
      }

      // Update statistics
      this.updateResolutionStats(result);

      console.log(`[ConflictResolver] Conflict resolution completed: ${conflictId} (success: ${result.success})`);

      return result;
    } catch (error) {
      conflict.status = 'failed';

      const result: ConflictResolutionResult = {
        conflictId,
        success: false,
        strategy,
        targetLayers: options?.targetLayers || conflict.layers,
        duration: Date.now() - startTime,
        details: {
          versionsConsidered: conflict.conflictingData.length,
          backupCreated: false,
          mergeConflicts: [],
          warnings: [],
          errors: [error instanceof Error ? error.message : String(error)],
        },
        timestamp: new Date().toISOString(),
      };

      this.updateResolutionStats(result);

      console.error(`[ConflictResolver] Conflict resolution failed: ${conflictId}:`, error);

      return result;
    }
  }

  /**
   * Get active conflicts
   */
  getActiveConflicts(): DataConflict[] {
    return Array.from(this.activeConflicts.values());
  }

  /**
   * Get resolved conflicts
   */
  getResolvedConflicts(): DataConflict[] {
    return Array.from(this.resolvedConflicts.values());
  }

  /**
   * Get conflict by ID
   */
  getConflict(conflictId: string): DataConflict | null {
    return this.activeConflicts.get(conflictId) || this.resolvedConflicts.get(conflictId) || null;
  }

  /**
   * Clear resolved conflicts
   */
  clearResolvedConflicts(): number {
    const count = this.resolvedConflicts.size;
    this.resolvedConflicts.clear();
    console.log(`[ConflictResolver] Cleared ${count} resolved conflicts`);
    return count;
  }

  /**
   * Update conflict resolver configuration
   */
  updateConfig(config: Partial<ConflictDetectionConfig>): void {
    this.config = { ...this.config, ...config };

    if (this.config.enableAutoDetection && !this.detectionInterval) {
      this.startConflictDetection();
    } else if (!this.config.enableAutoDetection && this.detectionInterval) {
      this.stopConflictDetection();
    }

    console.log('[ConflictResolver] Configuration updated');
  }

  /**
   * Get conflict resolver statistics
   */
  getStats(): ConflictResolverStats {
    this.updateSuccessRates();
    this.stats.lastUpdated = new Date().toISOString();
    return { ...this.stats };
  }

  /**
   * Force manual resolution for conflict
   */
  async forceManualResolution(conflictId: string, resolvedData: unknown): Promise<ConflictResolutionResult> {
    return await this.resolveConflict(conflictId, 'manual', {
      manualData: resolvedData,
      createBackup: true,
    });
  }

  /**
   * Shutdown conflict resolver
   */
  async shutdown(): Promise<void> {
    console.log('[ConflictResolver] Shutting down');

    this.stopConflictDetection();

    // Create final backup of unresolved conflicts
    if (this.activeConflicts.size > 0) {
      console.log(`[ConflictResolver] Creating backup of ${this.activeConflicts.size} unresolved conflicts`);
      await this.backupUnresolvedConflicts();
    }

    this.activeConflicts.clear();
    this.resolvedConflicts.clear();

    console.log('[ConflictResolver] Shutdown completed');
  }

  /**
   * Detect conflicts for specific key
   */
  private async detectKeyConflicts(key: string): Promise<DataConflict[]> {
    const conflicts: DataConflict[] = [];

    try {
      // Get data from all layers
      const layerData = await this.getKeyDataFromAllLayers(key);

      if (layerData.length <= 1) {
        return conflicts; // No conflict with single or no data
      }

      // Check for conflicts between versions
      const conflictingVersions = this.findConflictingVersions(layerData);

      if (conflictingVersions.length > 1) {
        const conflictType = this.determineConflictType(conflictingVersions);
        const severity = this.calculateConflictSeverity(conflictingVersions);

        const conflict: DataConflict = {
          conflictId: `conflict-${key}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: conflictType,
          key,
          layers: conflictingVersions.map(v => v.sourceLayer),
          severity,
          conflictingData: conflictingVersions,
          detectedAt: new Date().toISOString(),
          status: 'pending',
          requiresUserIntervention: this.requiresUserIntervention(conflictType, severity),
        };

        conflicts.push(conflict);
      }
    } catch (error) {
      console.warn(`[ConflictResolver] Failed to detect conflicts for key ${key}:`, error);
    }

    return conflicts;
  }

  /**
   * Get data for key from all storage layers
   */
  private async getKeyDataFromAllLayers(key: string): Promise<ConflictingDataVersion[]> {
    const versions: ConflictingDataVersion[] = [];
    const layers: ConflictStorageLayer[] = ['memory', 'local', 'sync', 'session'];

    for (const layer of layers) {
      try {
        const data = await this.getDataFromLayer(key, layer);

        if (data !== null) {
          const version: ConflictingDataVersion = {
            versionId: `${layer}-${Date.now()}`,
            sourceLayer: layer,
            data,
            timestamp: new Date().toISOString(),
            checksum: this.calculateChecksum(data),
            metadata: {
              createdAt: new Date().toISOString(),
              modifiedAt: new Date().toISOString(),
              modificationCount: 1,
              source: layer,
            },
          };

          versions.push(version);
        }
      } catch (error) {
        console.warn(`[ConflictResolver] Failed to get data from ${layer}:`, error);
      }
    }

    return versions;
  }

  /**
   * Get data from specific storage layer
   */
  private async getDataFromLayer(key: string, layer: ConflictStorageLayer): Promise<unknown> {
    switch (layer) {
      case 'local': {
        const localResult = await chrome.storage.local.get(key);
        return key in localResult ? localResult[key] : null;
      }

      case 'sync': {
        const syncResult = await chrome.storage.sync.get(key);
        return key in syncResult ? syncResult[key] : null;
      }

      case 'session': {
        const sessionResult = await chrome.storage.session.get(key);
        return key in sessionResult ? sessionResult[key] : null;
      }

      case 'memory':
        // This would integrate with memory cache from StorageCoordinator
        return null;

      case 'indexeddb':
        // TODO: Implement IndexedDB access
        return null;

      default:
        return null;
    }
  }

  /**
   * Find conflicting versions among data versions
   */
  private findConflictingVersions(versions: ConflictingDataVersion[]): ConflictingDataVersion[] {
    if (versions.length <= 1) {
      return versions;
    }

    // Group by checksum to find different versions
    const checksumGroups = new Map<string, ConflictingDataVersion[]>();

    for (const version of versions) {
      const checksum = version.checksum;
      if (!checksumGroups.has(checksum)) {
        checksumGroups.set(checksum, []);
      }
      checksumGroups.get(checksum)!.push(version);
    }

    // If all have same checksum, no conflict
    if (checksumGroups.size === 1) {
      return [];
    }

    // Return all versions if there are conflicts
    return versions;
  }

  /**
   * Determine conflict type based on versions
   */
  private determineConflictType(versions: ConflictingDataVersion[]): ConflictType {
    // Check for timestamp conflicts
    const timestamps = versions.map(v => new Date(v.timestamp).getTime());
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);

    if (maxTime - minTime > this.config.timestampTolerance) {
      return 'timestamp_conflict';
    }

    // Check for schema conflicts
    const dataTypes = new Set(versions.map(v => typeof v.data));
    if (dataTypes.size > 1) {
      return 'schema_conflict';
    }

    // Check for concurrent modifications
    const recentTimestamp = Date.now() - 10000; // 10 seconds
    const recentVersions = versions.filter(v => new Date(v.timestamp).getTime() > recentTimestamp);
    if (recentVersions.length > 1) {
      return 'concurrent_modification';
    }

    // Default to version mismatch
    return 'version_mismatch';
  }

  /**
   * Calculate conflict severity
   */
  private calculateConflictSeverity(versions: ConflictingDataVersion[]): 'low' | 'medium' | 'high' | 'critical' {
    const now = Date.now();
    const oldestTimestamp = Math.min(...versions.map(v => new Date(v.timestamp).getTime()));
    const ageHours = (now - oldestTimestamp) / (1000 * 60 * 60);

    if (ageHours > this.config.severityThresholds.criticalSeverityHours) {
      return 'critical';
    }

    if (ageHours > this.config.severityThresholds.highSeverityHours) {
      return 'high';
    }

    // Check for data type conflicts
    const dataTypes = new Set(versions.map(v => typeof v.data));
    if (dataTypes.size > 1) {
      return 'high';
    }

    return versions.length > 2 ? 'medium' : 'low';
  }

  /**
   * Check if conflict requires user intervention
   */
  private requiresUserIntervention(type: ConflictType, severity: 'low' | 'medium' | 'high' | 'critical'): boolean {
    return type === 'schema_conflict' || type === 'data_corruption' || severity === 'critical';
  }

  /**
   * Apply resolution strategy to conflict
   */
  private async applyResolutionStrategy(
    conflict: DataConflict,
    strategy: ResolutionStrategy,
    options?: unknown,
  ): Promise<{
    success: boolean;
    resolvedData?: unknown;
    chosenVersionId?: string;
    mergeConflicts?: string[];
    warnings?: string[];
    errors?: string[];
  }> {
    switch (strategy) {
      case 'last_write_wins':
        return this.applyLastWriteWins(conflict);

      case 'first_write_wins':
        return this.applyFirstWriteWins(conflict);

      case 'merge':
        return this.applyMergeStrategy(conflict);

      case 'manual':
        return this.applyManualResolution(conflict, options?.manualData);

      case 'backup_and_overwrite':
        return this.applyBackupAndOverwrite(conflict);

      case 'prefer_source':
        return this.applyPreferSourceStrategy(conflict);

      default:
        throw new Error(`Unsupported resolution strategy: ${strategy}`);
    }
  }

  /**
   * Apply last write wins strategy
   */
  private async applyLastWriteWins(conflict: DataConflict): Promise<{
    success: boolean;
    resolvedData?: unknown;
    chosenVersionId?: string;
  }> {
    const latestVersion = conflict.conflictingData.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )[0];

    return {
      success: true,
      resolvedData: latestVersion.data,
      chosenVersionId: latestVersion.versionId,
    };
  }

  /**
   * Apply first write wins strategy
   */
  private async applyFirstWriteWins(conflict: DataConflict): Promise<{
    success: boolean;
    resolvedData?: unknown;
    chosenVersionId?: string;
  }> {
    const earliestVersion = conflict.conflictingData.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    )[0];

    return {
      success: true,
      resolvedData: earliestVersion.data,
      chosenVersionId: earliestVersion.versionId,
    };
  }

  /**
   * Apply merge strategy
   */
  private async applyMergeStrategy(conflict: DataConflict): Promise<{
    success: boolean;
    resolvedData?: unknown;
    chosenVersionId?: string;
    mergeConflicts?: string[];
    warnings?: string[];
  }> {
    try {
      const mergeResult = this.mergeConflictingData(conflict.conflictingData);

      return {
        success: mergeResult.success,
        resolvedData: mergeResult.mergedData,
        chosenVersionId: 'merged',
        mergeConflicts: mergeResult.conflicts,
        warnings: mergeResult.warnings,
      };
    } catch (error) {
      return {
        success: false,
        mergeConflicts: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Apply manual resolution
   */
  private async applyManualResolution(
    conflict: DataConflict,
    manualData: unknown,
  ): Promise<{
    success: boolean;
    resolvedData?: unknown;
    chosenVersionId?: string;
  }> {
    if (manualData === undefined) {
      return {
        success: false,
      };
    }

    return {
      success: true,
      resolvedData: manualData,
      chosenVersionId: 'manual',
    };
  }

  /**
   * Apply backup and overwrite strategy
   */
  private async applyBackupAndOverwrite(conflict: DataConflict): Promise<{
    success: boolean;
    resolvedData?: unknown;
    chosenVersionId?: string;
  }> {
    // Create backup of all versions
    await this.createConflictBackup(conflict);

    // Use last write wins as the overwrite strategy
    return this.applyLastWriteWins(conflict);
  }

  /**
   * Apply prefer source strategy (prefer persistent storage)
   */
  private async applyPreferSourceStrategy(conflict: DataConflict): Promise<{
    success: boolean;
    resolvedData?: unknown;
    chosenVersionId?: string;
  }> {
    // Preference order: sync > local > session > memory
    const layerPriority = ['sync', 'local', 'session', 'memory'];

    for (const preferredLayer of layerPriority) {
      const version = conflict.conflictingData.find(v => v.sourceLayer === preferredLayer);
      if (version) {
        return {
          success: true,
          resolvedData: version.data,
          chosenVersionId: version.versionId,
        };
      }
    }

    // Fallback to last write wins
    return this.applyLastWriteWins(conflict);
  }

  /**
   * Merge conflicting data versions
   */
  private mergeConflictingData(versions: ConflictingDataVersion[]): {
    success: boolean;
    mergedData?: unknown;
    conflicts: string[];
    warnings: string[];
  } {
    const conflicts: string[] = [];
    const warnings: string[] = [];

    try {
      // Only merge objects
      const objectVersions = versions.filter(
        v => typeof v.data === 'object' && v.data !== null && !Array.isArray(v.data),
      );

      if (objectVersions.length === 0) {
        // Can't merge non-objects, fall back to latest
        const latest = versions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

        warnings.push('Cannot merge non-object data, using latest version');

        return {
          success: true,
          mergedData: latest.data,
          conflicts,
          warnings,
        };
      }

      // Merge objects
      const mergedData: Record<string, unknown> = {};
      const allKeys = new Set<string>();

      // Collect all keys
      for (const version of objectVersions) {
        const data = version.data as Record<string, unknown>;
        Object.keys(data).forEach(key => allKeys.add(key));
      }

      // Merge each key
      for (const key of allKeys) {
        const keyVersions = objectVersions
          .map(v => ({
            value: (v.data as Record<string, unknown>)[key],
            timestamp: v.timestamp,
            layer: v.sourceLayer,
          }))
          .filter(kv => kv.value !== undefined);

        if (keyVersions.length === 1) {
          mergedData[key] = keyVersions[0].value;
        } else if (keyVersions.length > 1) {
          // Check if all values are the same
          const uniqueValues = new Set(keyVersions.map(kv => JSON.stringify(kv.value)));

          if (uniqueValues.size === 1) {
            mergedData[key] = keyVersions[0].value;
          } else {
            // Conflict detected, use latest
            const latestKeyVersion = keyVersions.sort(
              (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
            )[0];

            mergedData[key] = latestKeyVersion.value;
            conflicts.push(`Key '${key}' has conflicting values, using latest from ${latestKeyVersion.layer}`);
          }
        }
      }

      return {
        success: true,
        mergedData,
        conflicts,
        warnings,
      };
    } catch (error) {
      conflicts.push(`Merge failed: ${error instanceof Error ? error.message : String(error)}`);

      return {
        success: false,
        conflicts,
        warnings,
      };
    }
  }

  /**
   * Propagate resolved data to target layers
   */
  private async propagateResolvedData(key: string, data: unknown, targetLayers: ConflictStorageLayer[]): Promise<void> {
    const propagationPromises = targetLayers.map(layer => this.writeToLayer(key, data, layer));

    try {
      await Promise.allSettled(propagationPromises);
    } catch (error) {
      console.warn(`[ConflictResolver] Failed to propagate resolved data for key ${key}:`, error);
    }
  }

  /**
   * Write data to specific storage layer
   */
  private async writeToLayer(key: string, data: unknown, layer: ConflictStorageLayer): Promise<void> {
    switch (layer) {
      case 'local':
        await chrome.storage.local.set({ [key]: data });
        break;

      case 'sync':
        await chrome.storage.sync.set({ [key]: data });
        break;

      case 'session':
        await chrome.storage.session.set({ [key]: data });
        break;

      case 'memory':
        // This would integrate with memory cache from StorageCoordinator
        break;

      case 'indexeddb':
        // TODO: Implement IndexedDB write
        break;
    }
  }

  /**
   * Create backup of conflict data
   */
  private async createConflictBackup(conflict: DataConflict): Promise<void> {
    const backupKey = `conflict_backup_${conflict.conflictId}_${Date.now()}`;
    const backupData = {
      conflict,
      backupTimestamp: new Date().toISOString(),
    };

    try {
      await chrome.storage.local.set({ [backupKey]: backupData });
      console.log(`[ConflictResolver] Backup created: ${backupKey}`);
    } catch (error) {
      console.warn(`[ConflictResolver] Failed to create backup for conflict ${conflict.conflictId}:`, error);
    }
  }

  /**
   * Get all storage keys from all layers
   */
  private async getAllStorageKeys(): Promise<string[]> {
    const allKeys = new Set<string>();

    try {
      // Get keys from local storage
      const localData = await chrome.storage.local.get();
      Object.keys(localData).forEach(key => allKeys.add(key));

      // Get keys from sync storage
      const syncData = await chrome.storage.sync.get();
      Object.keys(syncData).forEach(key => allKeys.add(key));

      // Get keys from session storage
      const sessionData = await chrome.storage.session.get();
      Object.keys(sessionData).forEach(key => allKeys.add(key));
    } catch (error) {
      console.warn('[ConflictResolver] Failed to get storage keys:', error);
    }

    return Array.from(allKeys);
  }

  /**
   * Calculate checksum for data
   */
  private calculateChecksum(data: unknown): string {
    // Simple checksum based on JSON string
    const jsonString = JSON.stringify(data);
    let hash = 0;

    for (let i = 0; i < jsonString.length; i++) {
      const char = jsonString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return hash.toString(36);
  }

  /**
   * Auto-resolve conflicts using allowed strategies
   */
  private async autoResolveConflicts(): Promise<void> {
    const conflicts = Array.from(this.activeConflicts.values()).filter(
      c => c.status === 'pending' && !c.requiresUserIntervention,
    );

    console.log(`[ConflictResolver] Auto-resolving ${conflicts.length} conflicts`);

    for (const conflict of conflicts) {
      for (const strategy of this.config.autoResolution.allowedStrategies) {
        try {
          const result = await this.resolveConflict(conflict.conflictId, strategy);

          if (result.success) {
            console.log(`[ConflictResolver] Auto-resolved conflict ${conflict.conflictId} using ${strategy}`);
            break;
          }
        } catch (error) {
          console.warn(`[ConflictResolver] Auto-resolution failed for ${conflict.conflictId} with ${strategy}:`, error);
        }
      }
    }
  }

  /**
   * Backup unresolved conflicts during shutdown
   */
  private async backupUnresolvedConflicts(): Promise<void> {
    const backupKey = `unresolved_conflicts_${Date.now()}`;
    const backupData = {
      conflicts: Array.from(this.activeConflicts.values()),
      backupTimestamp: new Date().toISOString(),
    };

    try {
      await chrome.storage.local.set({ [backupKey]: backupData });
      console.log(`[ConflictResolver] Unresolved conflicts backed up: ${backupKey}`);
    } catch (error) {
      console.error('[ConflictResolver] Failed to backup unresolved conflicts:', error);
    }
  }

  /**
   * Start automatic conflict detection
   */
  private startConflictDetection(): void {
    if (this.detectionInterval) {
      return;
    }

    this.detectionInterval = setInterval(() => {
      this.detectConflicts().catch(error => {
        console.error('[ConflictResolver] Automatic conflict detection failed:', error);
      });
    }, this.config.detectionInterval);

    console.log('[ConflictResolver] Conflict detection started');
  }

  /**
   * Stop automatic conflict detection
   */
  private stopConflictDetection(): void {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
      console.log('[ConflictResolver] Conflict detection stopped');
    }
  }

  /**
   * Update detection statistics
   */
  private updateDetectionStats(conflicts: DataConflict[]): void {
    this.stats.totalConflicts += conflicts.length;

    for (const conflict of conflicts) {
      this.stats.conflictsByType[conflict.type]++;
      this.stats.conflictsBySeverity[conflict.severity]++;
    }

    this.stats.lastDetection = new Date().toISOString();
  }

  /**
   * Update resolution statistics
   */
  private updateResolutionStats(result: ConflictResolutionResult): void {
    this.stats.strategiesUsed[result.strategy]++;

    if (result.success) {
      this.stats.resolvedConflicts++;
    } else {
      this.stats.failedResolutions++;
    }

    // Update average resolution time
    const totalResolutions = this.stats.resolvedConflicts + this.stats.failedResolutions;
    this.stats.avgResolutionTime =
      (this.stats.avgResolutionTime * (totalResolutions - 1) + result.duration) / totalResolutions;
  }

  /**
   * Update success rates
   */
  private updateSuccessRates(): void {
    const totalResolutions = this.stats.resolvedConflicts + this.stats.failedResolutions;
    this.stats.successRate = totalResolutions > 0 ? (this.stats.resolvedConflicts / totalResolutions) * 100 : 0;

    const autoResolutions =
      this.stats.strategiesUsed.last_write_wins +
      this.stats.strategiesUsed.merge +
      this.stats.strategiesUsed.prefer_source;

    this.stats.autoResolutionSuccessRate = autoResolutions > 0 ? (autoResolutions / totalResolutions) * 100 : 0;
  }

  /**
   * Initialize conflict resolver statistics
   */
  private initializeStats(): ConflictResolverStats {
    return {
      totalConflicts: 0,
      conflictsByType: {
        version_mismatch: 0,
        timestamp_conflict: 0,
        schema_conflict: 0,
        data_corruption: 0,
        concurrent_modification: 0,
      },
      conflictsBySeverity: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      },
      resolvedConflicts: 0,
      failedResolutions: 0,
      manualInterventions: 0,
      strategiesUsed: {
        last_write_wins: 0,
        first_write_wins: 0,
        merge: 0,
        manual: 0,
        backup_and_overwrite: 0,
        prefer_source: 0,
      },
      avgResolutionTime: 0,
      successRate: 0,
      autoResolutionSuccessRate: 0,
      lastUpdated: new Date().toISOString(),
    };
  }
}
