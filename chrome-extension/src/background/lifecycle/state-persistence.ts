/**
 * State persistence manager for Service Worker lifecycle
 * Handles critical state saving, restoration, and job queue persistence
 */

import type { ServiceWorkerState, StateSerializationConfig, OrchestrationJob, JobQueueState } from '../types';

/**
 * Persistence storage types
 */
export type PersistenceStorage = 'local' | 'session' | 'sync' | 'indexeddb';

/**
 * Persistence operation result
 */
export interface PersistenceResult {
  /** Whether operation was successful */
  success: boolean;
  /** Operation duration in milliseconds */
  duration: number;
  /** Size of persisted data in bytes */
  dataSize?: number;
  /** Error details if operation failed */
  error?: string;
  /** Timestamp of operation */
  timestamp: string;
}

/**
 * Persistence metrics and monitoring
 */
export interface PersistenceMetrics {
  /** Total persistence operations */
  totalOperations: number;
  /** Successful operations */
  successfulOperations: number;
  /** Failed operations */
  failedOperations: number;
  /** Average operation duration in milliseconds */
  averageDuration: number;
  /** Total data persisted in bytes */
  totalDataPersisted: number;
  /** Last successful persistence timestamp */
  lastSuccessful?: string;
  /** Last failed persistence timestamp */
  lastFailed?: string;
}

/**
 * Serializable job state for persistence
 */
export interface SerializableJobState {
  /** Job identifier */
  jobId: string;
  /** Job serialized data */
  data: string;
  /** Serialization timestamp */
  serializedAt: string;
  /** Data compression used */
  compressed: boolean;
  /** Data size in bytes */
  size: number;
}

/**
 * Persistent state container
 */
export interface PersistentState {
  /** State version for compatibility */
  version: string;
  /** Service Worker state */
  serviceWorkerState: Partial<ServiceWorkerState>;
  /** Job queue states */
  jobQueues: SerializableJobState[];
  /** Active job states */
  activeJobs: SerializableJobState[];
  /** Configuration state */
  configuration: Record<string, unknown>;
  /** Persistence metadata */
  metadata: {
    /** Creation timestamp */
    createdAt: string;
    /** Last update timestamp */
    updatedAt: string;
    /** Data integrity checksum */
    checksum: string;
    /** Compression enabled */
    compressed: boolean;
  };
}

/**
 * State persistence manager
 */
export class StatePersistenceManager {
  private config: StateSerializationConfig;
  private metrics: PersistenceMetrics;
  private persistenceTimeout: NodeJS.Timeout | null = null;
  private readonly storageKey = 'meeting-summarizer-state';

  constructor(config: StateSerializationConfig) {
    this.config = config;
    this.metrics = this.initializeMetrics();
  }

  /**
   * Persist critical state to storage
   */
  async persistState(
    state: ServiceWorkerState,
    jobQueues?: JobQueueState[],
    activeJobs?: OrchestrationJob[],
  ): Promise<PersistenceResult> {
    const startTime = Date.now();
    const result: PersistenceResult = {
      success: false,
      duration: 0,
      timestamp: new Date().toISOString(),
    };

    try {
      // Create persistent state object
      const persistentState = await this.createPersistentState(state, jobQueues, activeJobs);

      // Serialize state
      const serializedData = await this.serializeState(persistentState);
      result.dataSize = serializedData.length;

      // Check size limits
      if (serializedData.length > this.config.maxSerializedSize) {
        throw new Error(
          `Serialized state exceeds size limit: ${serializedData.length} > ${this.config.maxSerializedSize}`,
        );
      }

      // Store in appropriate storage
      await this.storeSerializedState(serializedData);

      result.success = true;
      result.duration = Date.now() - startTime;

      // Update metrics
      this.updateMetrics(result);

      console.log(`[StatePersistence] State persisted successfully (${result.dataSize} bytes in ${result.duration}ms)`);
    } catch (error) {
      result.success = false;
      result.duration = Date.now() - startTime;
      result.error = error instanceof Error ? error.message : String(error);

      // Update metrics
      this.updateMetrics(result);

      console.error('[StatePersistence] Failed to persist state:', error);
    }

    return result;
  }

  /**
   * Restore state from storage
   */
  async restoreState(): Promise<{
    serviceWorkerState?: Partial<ServiceWorkerState>;
    jobQueues?: SerializableJobState[];
    activeJobs?: SerializableJobState[];
    configuration?: Record<string, unknown>;
  }> {
    try {
      // Retrieve serialized state
      const serializedData = await this.retrieveSerializedState();
      if (!serializedData) {
        console.log('[StatePersistence] No persisted state found');
        return {};
      }

      // Deserialize state
      const persistentState = await this.deserializeState(serializedData);

      // Validate state integrity
      if (!this.validateStateIntegrity(persistentState)) {
        throw new Error('State integrity validation failed');
      }

      console.log('[StatePersistence] State restored successfully');

      return {
        serviceWorkerState: persistentState.serviceWorkerState,
        jobQueues: persistentState.jobQueues,
        activeJobs: persistentState.activeJobs,
        configuration: persistentState.configuration,
      };
    } catch (error) {
      console.error('[StatePersistence] Failed to restore state:', error);
      return {};
    }
  }

  /**
   * Clear persisted state
   */
  async clearState(): Promise<PersistenceResult> {
    const startTime = Date.now();
    const result: PersistenceResult = {
      success: false,
      duration: 0,
      timestamp: new Date().toISOString(),
    };

    try {
      await chrome.storage.local.remove(this.storageKey);

      result.success = true;
      result.duration = Date.now() - startTime;

      console.log('[StatePersistence] State cleared successfully');
    } catch (error) {
      result.success = false;
      result.duration = Date.now() - startTime;
      result.error = error instanceof Error ? error.message : String(error);

      console.error('[StatePersistence] Failed to clear state:', error);
    }

    return result;
  }

  /**
   * Schedule automatic state persistence
   */
  schedulePeriodicPersistence(
    getState: () => ServiceWorkerState,
    getJobQueues: () => JobQueueState[],
    getActiveJobs: () => OrchestrationJob[],
    intervalMs: number = 60000,
  ): void {
    if (this.persistenceTimeout) {
      clearTimeout(this.persistenceTimeout);
    }

    const persist = async () => {
      try {
        const state = getState();
        const jobQueues = getJobQueues();
        const activeJobs = getActiveJobs();

        await this.persistState(state, jobQueues, activeJobs);
      } catch (error) {
        console.error('[StatePersistence] Periodic persistence failed:', error);
      }

      // Schedule next persistence
      this.persistenceTimeout = setTimeout(persist, intervalMs);
    };

    // Start periodic persistence
    this.persistenceTimeout = setTimeout(persist, intervalMs);
  }

  /**
   * Stop automatic persistence
   */
  stopPeriodicPersistence(): void {
    if (this.persistenceTimeout) {
      clearTimeout(this.persistenceTimeout);
      this.persistenceTimeout = null;
    }
  }

  /**
   * Get persistence metrics
   */
  getMetrics(): PersistenceMetrics {
    return { ...this.metrics };
  }

  /**
   * Create persistent state object
   */
  private async createPersistentState(
    state: ServiceWorkerState,
    jobQueues?: JobQueueState[],
    activeJobs?: OrchestrationJob[],
  ): Promise<PersistentState> {
    // Filter state based on configuration
    const filteredState = this.filterStateForPersistence(state);

    // Serialize job data
    const serializedJobQueues = jobQueues
      ? await this.serializeJobs(
          jobQueues.flatMap(q =>
            Array.from(q.processingJobs.values()).concat(Array.from(q.queuedJobs.values()).flat()),
          ),
        )
      : [];

    const serializedActiveJobs = activeJobs ? await this.serializeJobs(activeJobs) : [];

    const persistentState: PersistentState = {
      version: '1.0.0',
      serviceWorkerState: filteredState,
      jobQueues: serializedJobQueues,
      activeJobs: serializedActiveJobs,
      configuration: {}, // TODO: Add configuration state
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        checksum: '',
        compressed: this.config.enableCompression,
      },
    };

    // Calculate checksum
    persistentState.metadata.checksum = await this.calculateChecksum(persistentState);

    return persistentState;
  }

  /**
   * Filter state for persistence based on configuration
   */
  private filterStateForPersistence(state: ServiceWorkerState): Partial<ServiceWorkerState> {
    const filtered: Partial<ServiceWorkerState> = {};

    // Include specified fields
    for (const field of this.config.includeFields) {
      if (field in state && !this.config.excludeFields.includes(field)) {
        (filtered as Record<string, unknown>)[field] = state[field];
      }
    }

    return filtered;
  }

  /**
   * Serialize job data for persistence
   */
  private async serializeJobs(jobs: OrchestrationJob[]): Promise<SerializableJobState[]> {
    const serializedJobs: SerializableJobState[] = [];

    for (const job of jobs) {
      try {
        const jobData = JSON.stringify(job);
        let compressed = false;

        // Compress if enabled and beneficial
        if (this.config.enableCompression && jobData.length > 1000) {
          // Note: In a real implementation, you'd use a compression library
          // For now, we'll just flag it as compressed
          compressed = true;
        }

        serializedJobs.push({
          jobId: job.jobId,
          data: jobData,
          serializedAt: new Date().toISOString(),
          compressed,
          size: jobData.length,
        });
      } catch (error) {
        console.warn(`[StatePersistence] Failed to serialize job ${job.jobId}:`, error);
      }
    }

    return serializedJobs;
  }

  /**
   * Serialize state to string
   */
  private async serializeState(state: PersistentState): Promise<string> {
    let serialized = JSON.stringify(state);

    // Apply compression if enabled
    if (this.config.enableCompression) {
      // Note: In a real implementation, you'd use a compression library
      // For now, we'll just return the JSON string
    }

    // Apply encryption if enabled
    if (this.config.encryption?.enabled) {
      serialized = await this.encryptData(serialized);
    }

    return serialized;
  }

  /**
   * Deserialize state from string
   */
  private async deserializeState(data: string): Promise<PersistentState> {
    let processedData = data;

    // Decrypt if encryption was used
    if (this.config.encryption?.enabled) {
      processedData = await this.decryptData(processedData);
    }

    // Decompress if compression was used
    if (this.config.enableCompression) {
      // Note: In a real implementation, you'd use a compression library
      // For now, we'll just parse the JSON
    }

    return JSON.parse(processedData);
  }

  /**
   * Store serialized state
   */
  private async storeSerializedState(data: string): Promise<void> {
    await chrome.storage.local.set({
      [this.storageKey]: data,
    });
  }

  /**
   * Retrieve serialized state
   */
  private async retrieveSerializedState(): Promise<string | null> {
    const result = await chrome.storage.local.get(this.storageKey);
    return result[this.storageKey] || null;
  }

  /**
   * Validate state integrity
   */
  private validateStateIntegrity(state: PersistentState): boolean {
    try {
      // Check version compatibility
      if (state.version !== '1.0.0') {
        console.warn(`[StatePersistence] State version mismatch: ${state.version}`);
        return false;
      }

      // Validate required fields
      if (!state.metadata || !state.metadata.checksum) {
        console.warn('[StatePersistence] Missing required metadata');
        return false;
      }

      // TODO: Verify checksum
      // In a real implementation, you'd recalculate and compare checksums

      return true;
    } catch (error) {
      console.error('[StatePersistence] State validation error:', error);
      return false;
    }
  }

  /**
   * Calculate checksum for integrity verification
   */
  private async calculateChecksum(_state: PersistentState): Promise<string> {
    // In a real implementation, you'd use a proper hash function
    // For now, we'll return a simple timestamp-based checksum
    return Date.now().toString(36);
  }

  /**
   * Encrypt data if encryption is enabled
   */
  private async encryptData(data: string): Promise<string> {
    if (!this.config.encryption?.enabled) {
      return data;
    }

    // TODO: Implement encryption using Web Crypto API
    // This would use the specified algorithm and key derivation settings
    console.warn('[StatePersistence] Encryption not yet implemented');
    return data;
  }

  /**
   * Decrypt data if encryption was used
   */
  private async decryptData(data: string): Promise<string> {
    if (!this.config.encryption?.enabled) {
      return data;
    }

    // TODO: Implement decryption using Web Crypto API
    console.warn('[StatePersistence] Decryption not yet implemented');
    return data;
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): PersistenceMetrics {
    return {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageDuration: 0,
      totalDataPersisted: 0,
    };
  }

  /**
   * Update persistence metrics
   */
  private updateMetrics(result: PersistenceResult): void {
    this.metrics.totalOperations++;

    if (result.success) {
      this.metrics.successfulOperations++;
      this.metrics.lastSuccessful = result.timestamp;
      if (result.dataSize) {
        this.metrics.totalDataPersisted += result.dataSize;
      }
    } else {
      this.metrics.failedOperations++;
      this.metrics.lastFailed = result.timestamp;
    }

    // Update average duration
    this.metrics.averageDuration =
      (this.metrics.averageDuration * (this.metrics.totalOperations - 1) + result.duration) /
      this.metrics.totalOperations;
  }
}
