/**
 * Azure Speech batch transcription service
 * Provides high-level batch transcription API with complete workflow management
 * and integration with storage for job persistence
 */

import { JobManager } from './job-manager';
import { AuthenticationHandler } from '../auth/auth-handler';
import { ErrorRecoveryService } from '../errors/recovery-service';
import type { JobManagerConfig, JobPriority } from './job-manager';
import type { AuthConfig } from '../types/auth';
import type {
  TranscriptionResult,
  BatchTranscriptionConfig,
  CreateTranscriptionJobRequest,
  TranscriptionJobStatus,
  TranscriptionJob,
} from '../types/index';

/**
 * Batch transcription service configuration
 */
export interface BatchTranscriptionServiceConfig {
  /** Job manager configuration */
  jobManager: Partial<JobManagerConfig>;
  /** Default batch configuration */
  defaultBatchConfig: Partial<BatchTranscriptionConfig>;
  /** Enable automatic service health monitoring */
  enableHealthMonitoring: boolean;
  /** Health check interval in milliseconds */
  healthCheckInterval: number;
  /** Enable job persistence to storage */
  enableJobPersistence: boolean;
  /** Storage key prefix for persisted jobs */
  storageKeyPrefix: string;
  /** Maximum batch size for bulk operations */
  maxBatchSize: number;
  /** Enable metrics collection */
  enableMetrics: boolean;
  /** Metrics collection interval in milliseconds */
  metricsInterval: number;
}

/**
 * Batch operation result
 */
export interface BatchOperationResult {
  /** Operation success status */
  success: boolean;
  /** Successfully processed jobs */
  successfulJobs: string[];
  /** Failed jobs with errors */
  failedJobs: Array<{ jobId: string; error: string }>;
  /** Total processing time in milliseconds */
  processingTime: number;
  /** Operation summary */
  summary: {
    /** Total jobs in batch */
    total: number;
    /** Successfully processed count */
    successful: number;
    /** Failed count */
    failed: number;
    /** Success rate (0-1) */
    successRate: number;
  };
}

/**
 * Service health status
 */
export interface ServiceHealthStatus {
  /** Overall service health */
  healthy: boolean;
  /** Individual component health */
  components: {
    /** Authentication service health */
    authentication: { healthy: boolean; message: string };
    /** Job manager health */
    jobManager: { healthy: boolean; message: string };
    /** Azure service connectivity */
    azureService: { healthy: boolean; message: string };
    /** Error recovery service */
    errorRecovery: { healthy: boolean; message: string };
  };
  /** Service metrics */
  metrics: {
    /** Active jobs count */
    activeJobs: number;
    /** Queue length */
    queueLength: number;
    /** Success rate over last hour */
    recentSuccessRate: number;
    /** Average response time */
    averageResponseTime: number;
  };
  /** Last health check timestamp */
  lastCheck: Date;
}

/**
 * Service event types
 */
export type ServiceEvent =
  | 'service_started'
  | 'service_stopped'
  | 'health_check'
  | 'batch_submitted'
  | 'batch_completed'
  | 'batch_failed'
  | 'job_persisted'
  | 'job_restored'
  | 'metrics_updated';

/**
 * Service event callback
 */
export type ServiceEventCallback = (
  event: ServiceEvent,
  data: {
    message?: string;
    jobIds?: string[];
    batchResult?: BatchOperationResult;
    health?: ServiceHealthStatus;
    metrics?: ServiceMetrics;
    error?: Error;
  },
) => void;

/**
 * Persisted job data for storage
 */
interface PersistedJobData {
  /** Job details */
  job: TranscriptionJob;
  /** Original request */
  request: CreateTranscriptionJobRequest;
  /** Job priority */
  priority: JobPriority;
  /** Batch configuration */
  config: BatchTranscriptionConfig;
  /** Persistence timestamp */
  persistedAt: Date;
  /** Job status when persisted */
  status: TranscriptionJobStatus;
  /** Retry attempts */
  retryAttempts: number;
}

/**
 * Service metrics
 */
interface ServiceMetrics {
  /** Total jobs processed since service start */
  totalJobsProcessed: number;
  /** Jobs processed in last hour */
  jobsLastHour: number;
  /** Average job duration */
  averageJobDuration: number;
  /** Success rate over different time periods */
  successRates: {
    lastHour: number;
    last24Hours: number;
    overall: number;
  };
  /** Resource utilization */
  resourceUtilization: number;
  /** Queue statistics */
  queueStats: {
    averageWaitTime: number;
    maxQueueLength: number;
    currentLength: number;
  };
  /** Error statistics */
  errorStats: {
    totalErrors: number;
    errorsLastHour: number;
    commonErrorTypes: Record<string, number>;
  };
  /** Metrics collection timestamp */
  collectedAt: Date;
}

/**
 * Default service configuration
 */
const DEFAULT_SERVICE_CONFIG: BatchTranscriptionServiceConfig = {
  jobManager: {
    maxConcurrentJobs: 10,
    maxQueueSize: 100,
    autoRetry: true,
    maxRetryAttempts: 3,
    enablePersistence: true,
  },
  defaultBatchConfig: {
    audioUrl: '',
    language: 'en-US',
    displayName: 'Default Batch Job',
    properties: {
      diarizationEnabled: false,
      wordLevelTimestampsEnabled: true,
      profanityFilterMode: 'Masked',
      punctuationMode: 'DictatedAndAutomatic',
    },
  },
  enableHealthMonitoring: true,
  healthCheckInterval: 5 * 60 * 1000, // 5 minutes
  enableJobPersistence: true,
  storageKeyPrefix: 'azure-speech-jobs',
  maxBatchSize: 50,
  enableMetrics: true,
  metricsInterval: 60 * 1000, // 1 minute
};

/**
 * Azure Speech batch transcription service
 */
export class BatchTranscriptionService {
  private config: BatchTranscriptionServiceConfig;
  private authConfig: AuthConfig;
  private authHandler: AuthenticationHandler;
  private jobManager: JobManager;
  private errorRecovery: ErrorRecoveryService;

  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private metricsInterval: ReturnType<typeof setInterval> | null = null;
  private isInitialized = false;
  private isRunning = false;

  private eventCallbacks = new Set<ServiceEventCallback>();
  private persistedJobs = new Map<string, PersistedJobData>();
  private metrics: ServiceMetrics = {
    totalJobsProcessed: 0,
    jobsLastHour: 0,
    averageJobDuration: 0,
    successRates: { lastHour: 0, last24Hours: 0, overall: 0 },
    resourceUtilization: 0,
    queueStats: { averageWaitTime: 0, maxQueueLength: 0, currentLength: 0 },
    errorStats: { totalErrors: 0, errorsLastHour: 0, commonErrorTypes: {} },
    collectedAt: new Date(),
  };

  constructor(authConfig: AuthConfig, config?: Partial<BatchTranscriptionServiceConfig>) {
    this.config = { ...DEFAULT_SERVICE_CONFIG, ...config };
    this.authConfig = authConfig;

    this.authHandler = new AuthenticationHandler();
    this.jobManager = new JobManager(authConfig, this.config.jobManager);
    this.errorRecovery = new ErrorRecoveryService();

    this.setupEventHandlers();
  }

  /**
   * Initialize the batch transcription service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize authentication
      await this.authHandler.initialize();
      await this.authHandler.configureAuth(this.authConfig);

      if (!this.authHandler.isAuthenticated()) {
        throw new Error('Authentication failed during service initialization');
      }

      // Start error recovery service
      this.errorRecovery.start();

      // Restore persisted jobs if enabled
      if (this.config.enableJobPersistence) {
        await this.restorePersistedJobs();
      }

      this.isInitialized = true;
      this.emitEvent('service_started', { message: 'Batch transcription service initialized successfully' });
    } catch (error) {
      const errorMessage = `Failed to initialize batch transcription service: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`;

      this.emitEvent('service_started', {
        message: errorMessage,
        error: error instanceof Error ? error : new Error(errorMessage),
      });

      throw new Error(errorMessage);
    }
  }

  /**
   * Start the batch transcription service
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.isRunning) return;

    // Start job manager
    this.jobManager.start();

    // Start health monitoring
    if (this.config.enableHealthMonitoring) {
      this.startHealthMonitoring();
    }

    // Start metrics collection
    if (this.config.enableMetrics) {
      this.startMetricsCollection();
    }

    this.isRunning = true;
    this.emitEvent('service_started', { message: 'Batch transcription service started' });
  }

  /**
   * Stop the batch transcription service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    // Stop intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    // Stop job manager
    await this.jobManager.stop();

    // Stop error recovery
    this.errorRecovery.stop();

    // Persist active jobs if enabled
    if (this.config.enableJobPersistence) {
      await this.persistActiveJobs();
    }

    this.isRunning = false;
    this.emitEvent('service_stopped', { message: 'Batch transcription service stopped' });
  }

  /**
   * Submit a single transcription job
   */
  async submitJob(
    audioUrl: string,
    options?: {
      language?: string;
      enableSpeakerDiarization?: boolean;
      enableWordLevelTimestamps?: boolean;
      profanityAction?: 'None' | 'Removed' | 'Masked';
      punctuationAction?: 'None' | 'Dictated' | 'Automatic' | 'DictatedAndAutomatic';
      customModel?: string;
      priority?: JobPriority;
      metadata?: Record<string, string>;
    },
  ): Promise<{ success: boolean; jobId?: string; error?: string }> {
    if (!this.isInitialized || !this.isRunning) {
      return { success: false, error: 'Service not initialized or not running' };
    }

    try {
      const request: CreateTranscriptionJobRequest = {
        audioUrl,
        config: {
          language: options?.language || this.config.defaultBatchConfig.language || 'en-US',
          enableSpeakerDiarization: options?.enableSpeakerDiarization ?? false,
          enableProfanityFilter: false,
          outputFormat: 'detailed',
          confidenceThreshold: 0.5,
        },
        ...(options?.metadata && { metadata: options.metadata as Record<string, unknown> }),
      };

      const result = await this.jobManager.submitJob(
        request,
        options?.priority || 'normal',
        this.config.defaultBatchConfig,
      );

      if (result.success && result.jobId && this.config.enableJobPersistence) {
        await this.persistJob(result.jobId, request, options?.priority || 'normal');
      }

      return result;
    } catch (error) {
      const errorMessage = `Failed to submit job: ${error instanceof Error ? error.message : 'Unknown error'}`;
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Submit multiple transcription jobs as a batch
   */
  async submitBatch(
    requests: Array<{
      audioUrl: string;
      language?: string;
      enableSpeakerDiarization?: boolean;
      enableWordLevelTimestamps?: boolean;
      profanityAction?: 'None' | 'Removed' | 'Masked';
      punctuationAction?: 'None' | 'Dictated' | 'Automatic' | 'DictatedAndAutomatic';
      customModel?: string;
      priority?: JobPriority;
      metadata?: Record<string, string>;
    }>,
  ): Promise<BatchOperationResult> {
    const startTime = Date.now();
    const successfulJobs: string[] = [];
    const failedJobs: Array<{ jobId: string; error: string }> = [];

    if (!this.isInitialized || !this.isRunning) {
      return {
        success: false,
        successfulJobs,
        failedJobs: requests.map((_, index) => ({
          jobId: `batch-${index}`,
          error: 'Service not initialized or not running',
        })),
        processingTime: Date.now() - startTime,
        summary: {
          total: requests.length,
          successful: 0,
          failed: requests.length,
          successRate: 0,
        },
      };
    }

    if (requests.length > this.config.maxBatchSize) {
      return {
        success: false,
        successfulJobs,
        failedJobs: [
          { jobId: 'batch', error: `Batch size ${requests.length} exceeds maximum ${this.config.maxBatchSize}` },
        ],
        processingTime: Date.now() - startTime,
        summary: {
          total: requests.length,
          successful: 0,
          failed: 1,
          successRate: 0,
        },
      };
    }

    // Process requests in parallel with concurrency limit
    const concurrencyLimit = Math.min(requests.length, 10);
    const chunks = this.chunkArray(requests, concurrencyLimit);

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (request, index) => {
        try {
          const result = await this.submitJob(request.audioUrl, request);

          if (result.success && result.jobId) {
            successfulJobs.push(result.jobId);
          } else {
            failedJobs.push({
              jobId: result.jobId || `batch-${index}`,
              error: result.error || 'Unknown error',
            });
          }
        } catch (error) {
          failedJobs.push({
            jobId: `batch-${index}`,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      });

      await Promise.all(chunkPromises);
    }

    const summary = {
      total: requests.length,
      successful: successfulJobs.length,
      failed: failedJobs.length,
      successRate: successfulJobs.length / requests.length,
    };

    const result: BatchOperationResult = {
      success: summary.successRate > 0.5, // Consider successful if > 50% success rate
      successfulJobs,
      failedJobs,
      processingTime: Date.now() - startTime,
      summary,
    };

    this.emitEvent(result.success ? 'batch_completed' : 'batch_failed', {
      message: `Batch operation completed: ${summary.successful}/${summary.total} successful`,
      jobIds: successfulJobs,
      batchResult: result,
    });

    return result;
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): {
    status?: TranscriptionJobStatus;
    progress?: number;
    result?: TranscriptionResult;
    error?: string;
    timing?: Record<string, unknown>;
  } {
    return this.jobManager.getJobStatus(jobId);
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const cancelled = await this.jobManager.cancelJob(jobId);

    if (cancelled && this.config.enableJobPersistence) {
      await this.removePersistedJob(jobId);
    }

    return cancelled;
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<ServiceHealthStatus> {
    const authHealth = this.authHandler.isAuthenticated();
    const jobManagerStats = this.jobManager.getStatistics();

    let azureServiceHealth = false;
    try {
      const healthCheck = await this.authHandler.performHealthCheck();
      azureServiceHealth = healthCheck.isHealthy;
    } catch {
      azureServiceHealth = false;
    }

    const errorRecoveryStatus = this.errorRecovery.getStatus();

    const healthStatus: ServiceHealthStatus = {
      healthy: authHealth && azureServiceHealth && jobManagerStats.successRate >= 0.5,
      components: {
        authentication: {
          healthy: authHealth,
          message: authHealth ? 'Authentication active' : 'Authentication failed',
        },
        jobManager: {
          healthy: jobManagerStats.successRate >= 0.5,
          message: `Success rate: ${(jobManagerStats.successRate * 100).toFixed(1)}%`,
        },
        azureService: {
          healthy: azureServiceHealth,
          message: azureServiceHealth ? 'Azure service accessible' : 'Azure service connectivity issues',
        },
        errorRecovery: {
          healthy: errorRecoveryStatus.active,
          message: errorRecoveryStatus.active ? 'Error recovery active' : 'Error recovery inactive',
        },
      },
      metrics: {
        activeJobs: jobManagerStats.activeJobs,
        queueLength: jobManagerStats.queuedJobs,
        recentSuccessRate: jobManagerStats.successRate,
        averageResponseTime: jobManagerStats.averageJobDuration,
      },
      lastCheck: new Date(),
    };

    this.emitEvent('health_check', { health: healthStatus });
    return healthStatus;
  }

  /**
   * Get service metrics
   */
  getMetrics(): ServiceMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Get jobs by status
   */
  getJobsByStatus(status: TranscriptionJobStatus): string[] {
    return this.jobManager.getJobsByStatus(status);
  }

  /**
   * Get all job details
   */
  getAllJobs(): Array<{ jobId: string; status: TranscriptionJobStatus; details: Record<string, unknown> }> {
    const allStatuses: TranscriptionJobStatus[] = [
      'pending',
      'submitted',
      'processing',
      'completed',
      'failed',
      'cancelled',
    ];
    const allJobs: Array<{ jobId: string; status: TranscriptionJobStatus; details: Record<string, unknown> }> = [];

    for (const status of allStatuses) {
      const jobIds = this.getJobsByStatus(status);
      for (const jobId of jobIds) {
        const details = this.jobManager.getJobDetails(jobId);
        if (details) {
          allJobs.push({ jobId, status, details: details as unknown as Record<string, unknown> });
        }
      }
    }

    return allJobs;
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Job manager events
    this.jobManager.addEventListener((event, data) => {
      switch (event) {
        case 'job_completed':
          this.metrics.totalJobsProcessed++;
          if (data.jobId && this.config.enableJobPersistence) {
            this.removePersistedJob(data.jobId);
          }
          break;
        case 'job_failed':
          this.metrics.errorStats.totalErrors++;
          break;
      }
    });
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.getHealthStatus();
      } catch (error) {
        console.error('Health check failed:', error);
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      this.updateMetrics();
      this.emitEvent('metrics_updated', { metrics: this.metrics });
    }, this.config.metricsInterval);
  }

  /**
   * Update service metrics
   */
  private updateMetrics(): void {
    const jobStats = this.jobManager.getStatistics();

    this.metrics.resourceUtilization = jobStats.resourceUtilization;
    this.metrics.queueStats.currentLength = jobStats.queuedJobs;
    this.metrics.queueStats.averageWaitTime = jobStats.averageQueueWaitTime;
    this.metrics.averageJobDuration = jobStats.averageJobDuration;
    this.metrics.successRates.overall = jobStats.successRate;
    this.metrics.collectedAt = new Date();

    // Update queue max length
    if (jobStats.queuedJobs > this.metrics.queueStats.maxQueueLength) {
      this.metrics.queueStats.maxQueueLength = jobStats.queuedJobs;
    }
  }

  /**
   * Persist a job to storage
   */
  private async persistJob(
    jobId: string,
    request: CreateTranscriptionJobRequest,
    priority: JobPriority,
  ): Promise<void> {
    try {
      const jobDetails = this.jobManager.getJobDetails(jobId);
      if (!jobDetails) return;

      const persistedData: PersistedJobData = {
        job: jobDetails.job,
        request,
        priority,
        config: jobDetails.config,
        persistedAt: new Date(),
        status: jobDetails.status.current,
        retryAttempts: jobDetails.retry.attempts,
      };

      this.persistedJobs.set(jobId, persistedData);
      this.emitEvent('job_persisted', { message: `Job ${jobId} persisted`, jobIds: [jobId] });
    } catch (error) {
      console.error(`Failed to persist job ${jobId}:`, error);
    }
  }

  /**
   * Remove persisted job
   */
  private async removePersistedJob(jobId: string): Promise<void> {
    this.persistedJobs.delete(jobId);
  }

  /**
   * Persist active jobs
   */
  private async persistActiveJobs(): Promise<void> {
    const activeJobIds = this.getJobsByStatus('processing');

    for (const jobId of activeJobIds) {
      const details = this.jobManager.getJobDetails(jobId);
      if (details) {
        await this.persistJob(jobId, details.request, details.priority);
      }
    }
  }

  /**
   * Restore persisted jobs
   */
  private async restorePersistedJobs(): Promise<void> {
    for (const [jobId, persistedData] of this.persistedJobs.entries()) {
      try {
        const result = await this.jobManager.submitJob(
          persistedData.request,
          persistedData.priority,
          persistedData.config,
        );

        if (result.success) {
          this.emitEvent('job_restored', {
            message: `Job ${jobId} restored successfully`,
            jobIds: [jobId],
          });
        }
      } catch (error) {
        console.error(`Failed to restore job ${jobId}:`, error);
      }
    }
  }

  /**
   * Chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Emit service event
   */
  private emitEvent(event: ServiceEvent, data: Parameters<ServiceEventCallback>[1]): void {
    this.eventCallbacks.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Error in service event callback:', error);
      }
    });
  }

  /**
   * Add event listener
   */
  addEventListener(callback: ServiceEventCallback): void {
    this.eventCallbacks.add(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(callback: ServiceEventCallback): void {
    this.eventCallbacks.delete(callback);
  }

  /**
   * Update service configuration
   */
  updateConfig(config: Partial<BatchTranscriptionServiceConfig>): void {
    this.config = { ...this.config, ...config };

    if (config.jobManager) {
      this.jobManager.updateConfig(config.jobManager);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): BatchTranscriptionServiceConfig {
    return { ...this.config };
  }

  /**
   * Test service connectivity
   */
  async testConnectivity(): Promise<{ success: boolean; message: string; responseTime: number }> {
    const startTime = Date.now();

    try {
      if (!this.authHandler.isAuthenticated()) {
        return {
          success: false,
          message: 'Authentication required',
          responseTime: Date.now() - startTime,
        };
      }

      const healthCheck = await this.authHandler.performHealthCheck();

      return {
        success: healthCheck.isHealthy,
        message: healthCheck.isHealthy ? 'Service connectivity OK' : 'Service connectivity issues',
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        message: `Connectivity test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    await this.stop();

    this.eventCallbacks.clear();
    this.persistedJobs.clear();

    this.jobManager.dispose();
    this.authHandler.dispose();
  }
}
