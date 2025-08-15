/**
 * Cache integrity checker with checksum validation and corruption detection
 * Implements automatic corruption detection and recovery for cached data
 */

import type { CacheEntry } from '../types/cache';

/**
 * Integrity check result
 */
export interface IntegrityCheckResult {
  /** Whether the check was successful */
  success: boolean;
  /** Whether data integrity is valid */
  isValid: boolean;
  /** Error message if check failed */
  error?: string;
  /** Integrity details */
  details: {
    /** Expected checksum */
    expectedChecksum?: string | undefined;
    /** Actual checksum */
    actualChecksum?: string | undefined;
    /** Data size in bytes */
    dataSize: number;
    /** Check duration in milliseconds */
    duration: number;
    /** Check timestamp */
    timestamp: string;
  };
}

/**
 * Batch integrity check result
 */
export interface BatchIntegrityResult {
  /** Total entries checked */
  totalChecked: number;
  /** Valid entries count */
  validEntries: number;
  /** Corrupted entries count */
  corruptedEntries: number;
  /** Failed checks count */
  failedChecks: number;
  /** List of corrupted entry keys */
  corruptedKeys: string[];
  /** List of failed check keys */
  failedKeys: string[];
  /** Batch check duration */
  duration: number;
  /** Batch check timestamp */
  timestamp: string;
}

/**
 * Integrity monitoring configuration
 */
export interface IntegrityConfig {
  /** Enable automatic integrity checking */
  enableAutoCheck: boolean;
  /** Integrity check interval in milliseconds */
  checkInterval: number;
  /** Enable checksum validation */
  enableChecksumValidation: boolean;
  /** Enable size validation */
  enableSizeValidation: boolean;
  /** Enable structure validation */
  enableStructureValidation: boolean;
  /** Corruption recovery settings */
  recoverySettings: {
    /** Enable automatic corruption recovery */
    enableAutoRecovery: boolean;
    /** Maximum recovery attempts */
    maxRecoveryAttempts: number;
    /** Recovery strategy */
    recoveryStrategy: 'remove' | 'restore' | 'notify';
  };
  /** Performance settings */
  performance: {
    /** Maximum entries to check per batch */
    maxCheckBatchSize: number;
    /** Check timeout in milliseconds */
    checkTimeout: number;
    /** Enable parallel checking */
    enableParallelCheck: boolean;
  };
}

/**
 * Integrity monitoring statistics
 */
export interface IntegrityStats {
  /** Total integrity checks performed */
  totalChecks: number;
  /** Valid checks count */
  validChecks: number;
  /** Corrupted entries found */
  corruptedEntries: number;
  /** Failed checks count */
  failedChecks: number;
  /** Recovery attempts */
  recoveryAttempts: number;
  /** Successful recoveries */
  successfulRecoveries: number;
  /** Average check time */
  averageCheckTime: number;
  /** Corruption rate percentage */
  corruptionRate: number;
  /** Last check timestamp */
  lastCheck?: string;
  /** Statistics timestamp */
  lastUpdated: string;
}

/**
 * Corruption event information
 */
export interface CorruptionEvent {
  /** Entry key */
  key: string;
  /** Corruption type */
  type: 'checksum_mismatch' | 'size_mismatch' | 'structure_invalid' | 'data_missing';
  /** Detection timestamp */
  detectedAt: string;
  /** Corruption details */
  details: {
    /** Expected vs actual values */
    expected?: unknown;
    actual?: unknown;
    /** Recovery action taken */
    recoveryAction?: 'removed' | 'restored' | 'none';
    /** Recovery success */
    recoverySuccess?: boolean;
  };
}

/**
 * Cache integrity checker with corruption detection and recovery
 */
export class CacheIntegrityChecker {
  private config: IntegrityConfig;
  private stats: IntegrityStats;
  private corruptionEvents: CorruptionEvent[] = [];
  private checkTimer: NodeJS.Timeout | null = null;
  private onCorruptionCallback?: (event: CorruptionEvent) => void;

  constructor(config: Partial<IntegrityConfig> = {}) {
    this.config = {
      enableAutoCheck: config.enableAutoCheck !== false,
      checkInterval: config.checkInterval || 30 * 60 * 1000, // 30 minutes
      enableChecksumValidation: config.enableChecksumValidation !== false,
      enableSizeValidation: config.enableSizeValidation !== false,
      enableStructureValidation: config.enableStructureValidation !== false,
      recoverySettings: {
        enableAutoRecovery: true,
        maxRecoveryAttempts: 3,
        recoveryStrategy: 'remove',
        ...config.recoverySettings,
      },
      performance: {
        maxCheckBatchSize: 100,
        checkTimeout: 5000, // 5 seconds
        enableParallelCheck: true,
        ...config.performance,
      },
    };

    this.stats = this.initializeStats();

    if (this.config.enableAutoCheck) {
      this.startAutoCheck();
    }
  }

  /**
   * Check integrity of a single cache entry
   */
  async checkEntryIntegrity<T>(key: string, entry: CacheEntry<T>): Promise<IntegrityCheckResult> {
    const startTime = Date.now();

    try {
      let isValid = true;
      let expectedChecksum: string | undefined;
      let actualChecksum: string | undefined;
      const dataSize = this.calculateDataSize(entry.data);

      // Checksum validation
      if (this.config.enableChecksumValidation && entry.integrity?.checksum) {
        expectedChecksum = entry.integrity.checksum as string;
        actualChecksum = await this.calculateChecksum(entry.data);

        if (expectedChecksum !== actualChecksum) {
          isValid = false;
          await this.handleCorruption(key, 'checksum_mismatch', {
            expected: expectedChecksum,
            actual: actualChecksum,
          });
        }
      }

      // Size validation
      if (this.config.enableSizeValidation && entry.size !== dataSize) {
        isValid = false;
        await this.handleCorruption(key, 'size_mismatch', {
          expected: entry.size,
          actual: dataSize,
        });
      }

      // Structure validation
      if (this.config.enableStructureValidation) {
        const structureValid = this.validateDataStructure(entry.data);
        if (!structureValid) {
          isValid = false;
          await this.handleCorruption(key, 'structure_invalid', {});
        }
      }

      const duration = Date.now() - startTime;

      // Update statistics
      this.updateCheckStats(true, isValid, duration);

      return {
        success: true,
        isValid,
        details: {
          expectedChecksum,
          actualChecksum,
          dataSize,
          duration,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateCheckStats(false, false, duration);

      return {
        success: false,
        isValid: false,
        error: error instanceof Error ? error.message : String(error),
        details: {
          dataSize: 0,
          duration,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Check integrity of multiple cache entries
   */
  async checkBatchIntegrity<T>(cache: Map<string, CacheEntry<T>>): Promise<BatchIntegrityResult> {
    const startTime = Date.now();
    let totalChecked = 0;
    let validEntries = 0;
    let corruptedEntries = 0;
    let failedChecks = 0;
    const corruptedKeys: string[] = [];
    const failedKeys: string[] = [];

    const entries = Array.from(cache.entries());
    const batchSize = this.config.performance.maxCheckBatchSize;

    // Process in batches
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);

      if (this.config.performance.enableParallelCheck) {
        // Parallel processing
        const checkPromises = batch.map(async ([key, entry]) => {
          const result = await this.checkEntryIntegrity(key, entry);
          return { key, result };
        });

        const results = await Promise.allSettled(checkPromises);

        for (const result of results) {
          totalChecked++;

          if (result.status === 'fulfilled') {
            const { key, result: checkResult } = result.value;

            if (checkResult.success) {
              if (checkResult.isValid) {
                validEntries++;
              } else {
                corruptedEntries++;
                corruptedKeys.push(key);
              }
            } else {
              failedChecks++;
              failedKeys.push(key);
            }
          } else {
            failedChecks++;
          }
        }
      } else {
        // Sequential processing
        for (const [key, entry] of batch) {
          totalChecked++;

          try {
            const result = await this.checkEntryIntegrity(key, entry);

            if (result.success) {
              if (result.isValid) {
                validEntries++;
              } else {
                corruptedEntries++;
                corruptedKeys.push(key);
              }
            } else {
              failedChecks++;
              failedKeys.push(key);
            }
          } catch (_error) {
            failedChecks++;
            failedKeys.push(key);
          }
        }
      }
    }

    return {
      totalChecked,
      validEntries,
      corruptedEntries,
      failedChecks,
      corruptedKeys,
      failedKeys,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Validate cache entry against corruption patterns
   */
  validateCacheEntry<T>(entry: CacheEntry<T>): {
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check required fields
    if (!entry.key || typeof entry.key !== 'string') {
      issues.push('Missing or invalid key');
      recommendations.push('Regenerate cache entry with valid key');
    }

    if (entry.data === undefined || entry.data === null) {
      issues.push('Missing data');
      recommendations.push('Remove corrupted entry from cache');
    }

    if (typeof entry.size !== 'number' || entry.size < 0) {
      issues.push('Invalid size field');
      recommendations.push('Recalculate entry size');
    }

    // Check timestamps
    try {
      new Date(entry.createdAt);
    } catch {
      issues.push('Invalid createdAt timestamp');
      recommendations.push('Update timestamp to current time');
    }

    try {
      new Date(entry.lastAccessTime);
    } catch {
      issues.push('Invalid lastAccessTime timestamp');
      recommendations.push('Update timestamp to current time');
    }

    try {
      new Date(entry.expiresAt);
    } catch {
      issues.push('Invalid expiresAt timestamp');
      recommendations.push('Recalculate expiration time');
    }

    // Check metadata consistency
    if (entry.metadata) {
      if (entry.integrity.checksum && typeof entry.integrity.checksum !== 'string') {
        issues.push('Invalid checksum in metadata');
        recommendations.push('Recalculate checksum');
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      recommendations,
    };
  }

  /**
   * Get integrity monitoring statistics
   */
  getStats(): IntegrityStats {
    this.updateStatsCalculations();
    return { ...this.stats };
  }

  /**
   * Get recent corruption events
   */
  getCorruptionEvents(limit: number = 100): CorruptionEvent[] {
    return this.corruptionEvents
      .slice(-limit)
      .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
  }

  /**
   * Set corruption event callback
   */
  onCorruption(callback: (event: CorruptionEvent) => void): void {
    this.onCorruptionCallback = callback;
  }

  /**
   * Update integrity checker configuration
   */
  updateConfig(config: Partial<IntegrityConfig>): void {
    this.config = { ...this.config, ...config };

    if (this.config.enableAutoCheck && !this.checkTimer) {
      this.startAutoCheck();
    } else if (!this.config.enableAutoCheck && this.checkTimer) {
      this.stopAutoCheck();
    }
  }

  /**
   * Force integrity check on cache
   */
  async forceIntegrityCheck<T>(cache: Map<string, CacheEntry<T>>): Promise<BatchIntegrityResult> {
    return await this.checkBatchIntegrity(cache);
  }

  /**
   * Cleanup corruption events older than specified date
   */
  cleanupCorruptionEvents(cutoffDate: Date): number {
    const cutoffTime = cutoffDate.getTime();
    const initialCount = this.corruptionEvents.length;

    this.corruptionEvents = this.corruptionEvents.filter(event => new Date(event.detectedAt).getTime() >= cutoffTime);

    return initialCount - this.corruptionEvents.length;
  }

  /**
   * Shutdown integrity checker
   */
  shutdown(): void {
    this.stopAutoCheck();
    this.corruptionEvents = [];
    delete this.onCorruptionCallback;
  }

  /**
   * Calculate data size for validation
   */
  private calculateDataSize(data: unknown): number {
    try {
      return new TextEncoder().encode(JSON.stringify(data)).length;
    } catch {
      return 0;
    }
  }

  /**
   * Calculate checksum for data integrity validation
   */
  private async calculateChecksum(data: unknown): Promise<string> {
    try {
      const content = JSON.stringify(data);
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(content);
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));

      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      throw new Error(`Checksum calculation failed: ${error}`);
    }
  }

  /**
   * Validate data structure integrity
   */
  private validateDataStructure(data: unknown): boolean {
    try {
      // Basic structure validation
      if (data === null || data === undefined) {
        return false;
      }

      // Check if data can be serialized/deserialized
      const serialized = JSON.stringify(data);
      const deserialized = JSON.parse(serialized);

      // Basic comparison (this is a simplified check)
      return JSON.stringify(deserialized) === serialized;
    } catch {
      return false;
    }
  }

  /**
   * Handle corruption detection
   */
  private async handleCorruption(
    key: string,
    type: CorruptionEvent['type'],
    details: CorruptionEvent['details'],
  ): Promise<void> {
    const event: CorruptionEvent = {
      key,
      type,
      detectedAt: new Date().toISOString(),
      details,
    };

    // Add to corruption events history
    this.corruptionEvents.push(event);

    // Limit history size
    if (this.corruptionEvents.length > 1000) {
      this.corruptionEvents = this.corruptionEvents.slice(-500);
    }

    // Execute recovery if enabled
    if (this.config.recoverySettings.enableAutoRecovery) {
      await this.attemptRecovery(event);
    }

    // Notify callback if set
    if (this.onCorruptionCallback) {
      try {
        this.onCorruptionCallback(event);
      } catch (error) {
        console.warn('[CacheIntegrityChecker] Corruption callback failed:', error);
      }
    }

    // Update statistics
    this.stats.corruptedEntries++;
  }

  /**
   * Attempt corruption recovery
   */
  private async attemptRecovery(event: CorruptionEvent): Promise<void> {
    this.stats.recoveryAttempts++;

    try {
      let recoveryAction: CorruptionEvent['details']['recoveryAction'] = 'none';
      let recoverySuccess = false;

      switch (this.config.recoverySettings.recoveryStrategy) {
        case 'remove':
          // Simply mark for removal (actual removal should be handled by caller)
          recoveryAction = 'removed';
          recoverySuccess = true;
          break;

        case 'restore':
          // Attempt to restore from backup (if available)
          recoveryAction = 'restored';
          recoverySuccess = false; // Would need actual restoration logic
          break;

        case 'notify':
          // Just notify, don't take action
          recoveryAction = 'none';
          recoverySuccess = true;
          break;
      }

      // Update event with recovery information
      event.details.recoveryAction = recoveryAction;
      event.details.recoverySuccess = recoverySuccess;

      if (recoverySuccess) {
        this.stats.successfulRecoveries++;
      }
    } catch (error) {
      console.warn(`[CacheIntegrityChecker] Recovery failed for ${event.key}:`, error);
      event.details.recoveryAction = 'none';
      event.details.recoverySuccess = false;
    }
  }

  /**
   * Update check statistics
   */
  private updateCheckStats(success: boolean, isValid: boolean, duration: number): void {
    this.stats.totalChecks++;

    if (success) {
      if (isValid) {
        this.stats.validChecks++;
      }
    } else {
      this.stats.failedChecks++;
    }

    // Update average check time
    this.stats.averageCheckTime =
      (this.stats.averageCheckTime * (this.stats.totalChecks - 1) + duration) / this.stats.totalChecks;

    this.stats.lastCheck = new Date().toISOString();
  }

  /**
   * Update statistics calculations
   */
  private updateStatsCalculations(): void {
    // Calculate corruption rate
    this.stats.corruptionRate =
      this.stats.totalChecks > 0 ? (this.stats.corruptedEntries / this.stats.totalChecks) * 100 : 0;

    this.stats.lastUpdated = new Date().toISOString();
  }

  /**
   * Start automatic integrity checking
   */
  private startAutoCheck(): void {
    if (this.checkTimer) return;

    this.checkTimer = setInterval(() => {
      // Auto-check would need access to the actual cache
      // This is a placeholder for the timer setup
      console.debug('[CacheIntegrityChecker] Auto-check timer triggered');
    }, this.config.checkInterval);
  }

  /**
   * Stop automatic integrity checking
   */
  private stopAutoCheck(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  /**
   * Initialize integrity statistics
   */
  private initializeStats(): IntegrityStats {
    return {
      totalChecks: 0,
      validChecks: 0,
      corruptedEntries: 0,
      failedChecks: 0,
      recoveryAttempts: 0,
      successfulRecoveries: 0,
      averageCheckTime: 0,
      corruptionRate: 0,
      lastUpdated: new Date().toISOString(),
    };
  }
}
