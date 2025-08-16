/**
 * Job coordinator for Azure API coordination and job execution
 * Implements JobOrchestrator with Azure Speech services integration
 */

import { AzureSpeechService } from '@extension/azure-speech';
import type { JobQueueManager } from './job-queue-manager';
import type {
  JobOrchestrator,
  JobProcessingStatus,
  OrchestrationJob,
  JobProgressInfo,
  OrchestrationMetrics,
  ProcessingLimits,
  JobOrchestrationError,
} from '../types';
import type { JobTracker } from './job-tracker';
import type {
  TranscriptionResult,
  CreateTranscriptionJobRequest,
  AzureSpeechConfig,
  TranscriptionJob,
} from '@extension/azure-speech';

/**
 * Job execution result
 */
export interface JobExecutionResult {
  /** Whether execution was successful */
  success: boolean;
  /** Job identifier */
  jobId: string;
  /** Execution result data */
  result?: TranscriptionResult;
  /** Error details if execution failed */
  error?: JobOrchestrationError;
  /** Execution duration in milliseconds */
  duration: number;
  /** Execution timestamp */
  timestamp: string;
}

/**
 * Azure Speech error with recovery information
 */
export interface AzureSpeechError extends Error {
  /** Error type classification */
  type:
    | 'quota_exceeded'
    | 'authentication_error'
    | 'network_error'
    | 'audio_error'
    | 'permission_error'
    | 'service_unavailable'
    | 'unknown_error';
  /** Whether this error is retryable */
  retryable: boolean;
  /** Recommended retry delay in milliseconds */
  retryAfter?: number;
  /** User-friendly recovery suggestions */
  recovery: string[];
  /** Original error object */
  originalError: unknown;
}

/**
 * Azure integration configuration
 */
export interface AzureIntegrationConfig {
  /** Enable Azure API integration */
  enabled: boolean;
  /** Maximum concurrent Azure API calls */
  maxConcurrentCalls: number;
  /** API call timeout in milliseconds */
  apiTimeout: number;
  /** Enable automatic retry for failed calls */
  enableRetry: boolean;
  /** Retry configuration */
  retry: {
    /** Maximum retry attempts */
    maxAttempts: number;
    /** Initial retry delay in milliseconds */
    initialDelay: number;
    /** Exponential backoff factor */
    backoffFactor: number;
    /** Maximum retry delay in milliseconds */
    maxDelay: number;
  };
  /** Azure Speech service configuration */
  speechConfig?: AzureSpeechConfig;
}

/**
 * Job coordinator for orchestrating transcription job execution
 */
export class JobCoordinator implements JobOrchestrator {
  private queueManager: JobQueueManager;
  private jobTracker: JobTracker;
  private azureConfig: AzureIntegrationConfig;
  private azureSpeechService?: AzureSpeechService;
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private activeExecutions = new Map<string, Promise<JobExecutionResult>>();

  constructor(queueManager: JobQueueManager, jobTracker: JobTracker, azureConfig: AzureIntegrationConfig) {
    this.queueManager = queueManager;
    this.jobTracker = jobTracker;
    this.azureConfig = azureConfig;

    console.log('[JobCoordinator] Constructor initialized with config:', {
      azureEnabled: azureConfig.enabled,
      maxConcurrentCalls: azureConfig.maxConcurrentCalls,
      apiTimeout: azureConfig.apiTimeout,
    });

    // Enable processing and start job processing
    this.isProcessing = true;
    console.log('[JobCoordinator] Setting isProcessing to true and starting job processing');
    this.startJobProcessing();
  }

  /**
   * Initialize Azure Speech service with configuration
   */
  async initialize(azureConfig?: AzureSpeechConfig): Promise<void> {
    try {
      console.log('[JobCoordinator] Initializing Azure Speech service...');

      // Use provided config or fall back to config in azureConfig
      const speechConfig = azureConfig || this.azureConfig.speechConfig;

      if (!speechConfig) {
        console.warn('[JobCoordinator] No Azure Speech configuration provided');
        return;
      }

      // Validate required configuration fields
      if (!speechConfig.subscriptionKey || !speechConfig.serviceRegion) {
        throw new Error('Azure Speech configuration missing required fields: subscriptionKey and serviceRegion');
      }

      // Initialize Azure Speech service
      this.azureSpeechService = new AzureSpeechService(speechConfig);
      await this.azureSpeechService.initialize();

      console.log('[JobCoordinator] Azure Speech service initialized successfully');

      // Update Azure integration config to enabled
      this.azureConfig.enabled = true;
    } catch (error) {
      console.error('[JobCoordinator] Failed to initialize Azure Speech service:', error);
      this.azureSpeechService = undefined;
      this.azureConfig.enabled = false;
      throw new Error(
        `Azure Speech initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Check if Azure Speech service is available
   */
  isAzureSpeechAvailable(): boolean {
    return !!this.azureSpeechService && this.azureConfig.enabled;
  }

  /**
   * Validate Azure Speech configuration
   */
  private validateAzureConfig(config: AzureSpeechConfig): void {
    const requiredFields = ['subscriptionKey', 'serviceRegion'];
    const missingFields = requiredFields.filter(field => !config[field as keyof AzureSpeechConfig]);

    if (missingFields.length > 0) {
      throw new Error(`Azure Speech configuration missing required fields: ${missingFields.join(', ')}`);
    }

    // Validate subscription key format (basic validation)
    if (typeof config.subscriptionKey !== 'string' || config.subscriptionKey.length < 20) {
      throw new Error('Invalid Azure Speech subscription key format');
    }

    // Validate service region format
    if (typeof config.serviceRegion !== 'string' || !/^[a-z]+[a-z0-9]*$/.test(config.serviceRegion)) {
      throw new Error('Invalid Azure Speech service region format');
    }
  }

  /**
   * Submit a new job to the orchestration system
   */
  async submitJob(job: OrchestrationJob): Promise<string> {
    try {
      console.log(`[JobCoordinator] Submitting job: ${job.jobId}`);

      // Start tracking the job
      this.jobTracker.startTracking(job);

      // Queue the job
      const queueResult = await this.queueManager.enqueueJob(job);

      if (!queueResult.success) {
        const error: JobOrchestrationError = {
          errorId: `queue-${Date.now()}`,
          jobId: job.jobId,
          type: 'queue_full',
          severity: 'medium',
          message: queueResult.message,
          details: { stack: '', context: {}, recoverySuggestions: [] },
          timestamp: new Date().toISOString(),
          recoverable: true,
        };

        this.jobTracker.recordJobError(job.jobId, error);
        throw new Error(queueResult.message);
      }

      // Update job status
      this.jobTracker.updateJobStatus(job.jobId, 'queued', 'Job submitted successfully');

      return job.jobId;
    } catch (error) {
      console.error(`[JobCoordinator] Failed to submit job ${job.jobId}:`, error);
      throw error;
    }
  }

  /**
   * Cancel a job by ID
   */
  async cancelJob(jobId: string, reason: string): Promise<boolean> {
    try {
      console.log(`[JobCoordinator] Cancelling job: ${jobId} - ${reason}`);

      // Cancel active execution if running
      const activeExecution = this.activeExecutions.get(jobId);
      if (activeExecution) {
        // Note: In a real implementation, you'd need to cancel the Azure API call
        this.activeExecutions.delete(jobId);
      }

      // Remove from queue
      const dequeueResult = await this.queueManager.dequeueJob(jobId);

      // Update job status
      this.jobTracker.updateJobStatus(jobId, 'cancelled', reason);

      // Stop tracking
      this.jobTracker.stopTracking(jobId);

      return dequeueResult.success;
    } catch (error) {
      console.error(`[JobCoordinator] Failed to cancel job ${jobId}:`, error);
      return false;
    }
  }

  /**
   * Get job status and progress
   */
  async getJobStatus(jobId: string): Promise<JobProgressInfo | undefined> {
    return this.jobTracker.getJobProgress(jobId);
  }

  /**
   * Get all jobs by status
   */
  async getJobsByStatus(status: JobProcessingStatus): Promise<OrchestrationJob[]> {
    return this.jobTracker.getJobsByStatus(status);
  }

  /**
   * Get queue metrics and statistics
   */
  async getMetrics(): Promise<OrchestrationMetrics> {
    return this.queueManager.getMetrics();
  }

  /**
   * Update processing limits
   */
  async updateLimits(limits: Partial<ProcessingLimits>): Promise<void> {
    this.queueManager.updateLimits(limits);
    console.log('[JobCoordinator] Processing limits updated');
  }

  /**
   * Pause job processing
   */
  async pauseProcessing(): Promise<void> {
    this.isProcessing = false;
    this.queueManager.pauseProcessing();
    this.stopJobProcessing();
    console.log('[JobCoordinator] Job processing paused');
  }

  /**
   * Resume job processing
   */
  async resumeProcessing(): Promise<void> {
    this.isProcessing = true;
    this.queueManager.resumeProcessing();
    this.startJobProcessing();
    console.log('[JobCoordinator] Job processing resumed');
  }

  /**
   * Get system health status
   */
  async getHealthStatus(): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = [];
    let healthy = true;

    try {
      // Check queue health
      const queueState = this.queueManager.getState();
      const queueUtilization = queueState.resourceUsage.queueUtilization;

      if (queueUtilization > 90) {
        issues.push(`Queue utilization high: ${queueUtilization.toFixed(1)}%`);
        healthy = false;
      }

      // Check resource utilization
      const memoryUtilization =
        (queueState.resourceUsage.memoryUsage / queueState.config.processingLimits.maxTotalMemory) * 100;
      if (memoryUtilization > 90) {
        issues.push(`Memory utilization high: ${memoryUtilization.toFixed(1)}%`);
        healthy = false;
      }

      // Check processing capability
      if (!this.isProcessing) {
        issues.push('Job processing is paused');
        healthy = false;
      }

      // Check Azure integration
      if (!this.azureConfig.enabled) {
        issues.push('Azure integration is disabled');
        healthy = false;
      }

      // Check for failed jobs
      const stats = this.jobTracker.getStats();
      if (stats.successRate < 80) {
        issues.push(`Low success rate: ${stats.successRate.toFixed(1)}%`);
        healthy = false;
      }
    } catch (error) {
      issues.push(`Health check error: ${error instanceof Error ? error.message : String(error)}`);
      healthy = false;
    }

    return { healthy, issues };
  }

  /**
   * Shutdown the job coordinator
   */
  async shutdown(): Promise<void> {
    console.log('[JobCoordinator] Shutting down');

    this.isProcessing = false;
    this.stopJobProcessing();

    // Wait for active executions to complete or timeout
    const shutdownTimeout = 30000; // 30 seconds
    const activeExecutions = Array.from(this.activeExecutions.values());

    if (activeExecutions.length > 0) {
      console.log(`[JobCoordinator] Waiting for ${activeExecutions.length} active executions to complete`);

      try {
        await Promise.race([
          Promise.allSettled(activeExecutions),
          new Promise(resolve => setTimeout(resolve, shutdownTimeout)),
        ]);
      } catch {
        console.warn('[JobCoordinator] Some executions did not complete during shutdown');
      }
    }

    // Shutdown components
    await this.queueManager.shutdown();
    this.jobTracker.shutdown();

    console.log('[JobCoordinator] Shutdown completed');
  }

  /**
   * Start job processing
   */
  private startJobProcessing(): void {
    console.log(
      `[JobCoordinator] startJobProcessing called - isProcessing: ${this.isProcessing}, processingInterval exists: ${!!this.processingInterval}`,
    );

    if (this.processingInterval || !this.isProcessing) {
      console.log(
        '[JobCoordinator] startJobProcessing early return - processing interval already exists or processing disabled',
      );
      return;
    }

    this.processingInterval = setInterval(async () => {
      await this.processJobs();
    }, 1000); // Check for jobs every second

    console.log('[JobCoordinator] Job processing started - interval ID:', this.processingInterval);
  }

  /**
   * Stop job processing
   */
  private stopJobProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      console.log('[JobCoordinator] Job processing stopped');
    }
  }

  /**
   * Process jobs from the queue
   */
  private async processJobs(): Promise<void> {
    console.log(
      `[JobCoordinator] processJobs called - isProcessing: ${this.isProcessing}, azureEnabled: ${this.azureConfig.enabled}`,
    );
    console.log(
      `[JobCoordinator] Active executions: ${this.activeExecutions.size}/${this.azureConfig.maxConcurrentCalls}`,
    );

    if (!this.isProcessing || !this.azureConfig.enabled) {
      console.log('[JobCoordinator] Processing disabled or Azure not enabled - skipping job processing');
      return;
    }

    try {
      // Check if we can process more jobs
      if (this.activeExecutions.size >= this.azureConfig.maxConcurrentCalls) {
        console.log(
          `[JobCoordinator] Max concurrent jobs reached: ${this.activeExecutions.size}/${this.azureConfig.maxConcurrentCalls}`,
        );
        return;
      }

      // Get next job from queue
      console.log('[JobCoordinator] Checking for next job in queue...');
      const job = await this.queueManager.getNextJob();

      if (!job) {
        console.log('[JobCoordinator] No jobs available in queue');
        return;
      }

      console.log(`[JobCoordinator] Starting execution of job: ${job.jobId}`);

      // Start job execution
      const executionPromise = this.executeJob(job);
      this.activeExecutions.set(job.jobId, executionPromise);

      // Handle execution completion
      executionPromise
        .then(result => this.handleJobCompletion(result))
        .catch(error => this.handleJobError(job.jobId, error))
        .finally(() => this.activeExecutions.delete(job.jobId));
    } catch (error) {
      console.error('[JobCoordinator] Error processing jobs:', error);
    }
  }

  /**
   * Execute a transcription job
   */
  private async executeJob(job: OrchestrationJob): Promise<JobExecutionResult> {
    const startTime = Date.now();
    const result: JobExecutionResult = {
      success: false,
      jobId: job.jobId,
      duration: 0,
      timestamp: new Date().toISOString(),
    };

    try {
      console.log(`[JobCoordinator] Executing job: ${job.jobId}`);

      // Update job status to processing
      this.jobTracker.updateJobStatus(job.jobId, 'processing', 'Job execution started');

      // Update progress - job started
      console.log(`[JobCoordinator] Setting initial progress for job: ${job.jobId}`);
      this.jobTracker.updateJobProgress(job.jobId, 0, 'initializing', {}, 300000); // 5 min estimate

      // Create Azure transcription request
      const transcriptionRequest: CreateTranscriptionJobRequest = {
        audioUrl: job.audioUrl,
        config: job.config,
        metadata: {
          jobId: job.jobId,
          priority: job.executionContext.priority,
          sessionId: job.executionContext.metadata.sessionId,
        },
      };

      // Execute transcription (simulated for now)
      console.log(`[JobCoordinator] Starting Azure transcription simulation for job: ${job.jobId}`);
      const transcriptionResult = await this.executeAzureTranscription(job, transcriptionRequest);
      console.log(`[JobCoordinator] Azure transcription simulation completed for job: ${job.jobId}`);

      result.success = true;
      result.result = transcriptionResult;
      result.duration = Date.now() - startTime;

      console.log(`[JobCoordinator] Job ${job.jobId} executed successfully in ${result.duration}ms`);
    } catch (error) {
      result.success = false;
      result.duration = Date.now() - startTime;
      result.error = this.createExecutionError(job.jobId, error);

      console.error(`[JobCoordinator] Job ${job.jobId} execution failed:`, error);
    }

    return result;
  }

  /**
   * Execute Azure transcription (integration point)
   */
  private async executeAzureTranscription(
    job: OrchestrationJob,
    request: CreateTranscriptionJobRequest,
  ): Promise<TranscriptionResult> {
    console.log(`[JobCoordinator] executeAzureTranscription started for job: ${job.jobId}`);

    // Check if Azure Speech service is available
    if (!this.isAzureSpeechAvailable()) {
      throw new Error('Azure Speech service not initialized or not available');
    }

    try {
      // Update progress - submitting to Azure
      console.log(`[JobCoordinator] Updating progress to 10% - submitting_to_azure`);
      this.jobTracker.updateJobProgress(job.jobId, 10, 'submitting_to_azure');

      // Step 1: Submit real transcription job to Azure Speech API with error handling
      console.log(
        `[JobCoordinator] Submitting transcription job to Azure Speech API for audio URL: ${request.audioUrl}`,
      );

      const azureJobResult = await this.callWithCircuitBreaker(() =>
        this.retryWithBackoff(
          () =>
            this.azureSpeechService!.startTranscription(request.audioUrl, {
              language: request.config.language || 'en-US',
              enableSpeakerDiarization: request.config.enableSpeakerDiarization || true,
              enableProfanityFilter: request.config.enableProfanityFilter || false,
              outputFormat: request.config.outputFormat || 'detailed',
            }),
          this.azureConfig.retry?.maxAttempts || 3,
          this.azureConfig.retry?.initialDelay || 1000,
        ),
      );

      if (!azureJobResult.jobId) {
        throw new Error(`Azure job submission failed: ${azureJobResult.message || 'Unknown error'}`);
      }

      console.log(`[JobCoordinator] Azure transcription job submitted successfully: ${azureJobResult.jobId}`);

      // Update progress - job submitted
      this.jobTracker.updateJobProgress(job.jobId, 20, 'azure_queued', {
        azureJobId: azureJobResult.jobId,
      });

      // Step 2: Monitor real Azure transcription progress
      const transcriptionResult = await this.monitorAzureTranscription(job.jobId, azureJobResult.jobId);

      console.log(`[JobCoordinator] Azure transcription completed for job: ${job.jobId}`);
      return transcriptionResult;
    } catch (error) {
      console.error(`[JobCoordinator] Azure transcription failed for job ${job.jobId}:`, error);

      // Handle Azure Speech specific errors with recovery strategies
      const handledError = await this.handleAzureSpeechError(error, job.jobId, request);

      // Update progress to indicate failure
      this.jobTracker.updateJobProgress(job.jobId, 0, 'failed', {
        error: handledError.message,
        errorType: handledError.type,
        recovery: handledError.recovery,
        retryable: handledError.retryable,
      });

      throw handledError;
    }
  }

  /**
   * Monitor Azure transcription job progress
   */
  private async monitorAzureTranscription(localJobId: string, azureJobId: string): Promise<TranscriptionResult> {
    const maxAttempts = 120; // 10 minutes with 5-second intervals
    const pollInterval = 5000; // 5 seconds
    let attempts = 0;

    console.log(`[JobCoordinator] Starting to monitor Azure job: ${azureJobId}`);

    while (attempts < maxAttempts) {
      try {
        // Get real Azure transcription status with error handling
        const statusResult = await this.callWithCircuitBreaker(() =>
          this.azureSpeechService!.getTranscriptionStatus(azureJobId),
        );

        console.log(
          `[JobCoordinator] Azure job ${azureJobId} status: ${statusResult.status} (attempt ${attempts + 1}/${maxAttempts})`,
        );

        // Update progress based on real Azure status
        this.updateProgressFromAzureStatus(localJobId, statusResult);

        if (statusResult.status === 'completed') {
          console.log(`[JobCoordinator] Azure transcription completed for job: ${azureJobId}`);

          // Retrieve actual transcription results
          const transcriptionJob: TranscriptionJob = {
            jobId: azureJobId,
            status: 'completed',
            audioUrl: '', // Not needed for result retrieval
            config: {}, // Not needed for result retrieval
            metadata: statusResult.metadata || {},
          };

          const transcriptionResult = await this.callWithCircuitBreaker(() =>
            this.azureSpeechService!.getTranscriptionResult(transcriptionJob),
          );

          // Update final progress
          this.jobTracker.updateJobProgress(localJobId, 100, 'completed', {
            azureJobId: azureJobId,
            confidence: transcriptionResult.confidence,
            duration: transcriptionResult.duration,
          });

          return {
            jobId: localJobId,
            text: transcriptionResult.text,
            confidence: transcriptionResult.confidence,
            duration: transcriptionResult.duration,
            speakers: transcriptionResult.speakers || [],
            segments: transcriptionResult.segments || [],
            metadata: {
              ...transcriptionResult.metadata,
              azureJobId: azureJobId,
              processingTime: Date.now() - Date.now(), // Will be calculated properly
              language: transcriptionResult.metadata?.language || 'en-US',
            },
          };
        }

        if (statusResult.status === 'failed') {
          const errorMessage = statusResult.message || 'Azure transcription failed without specific error message';
          console.error(`[JobCoordinator] Azure transcription failed for job ${azureJobId}: ${errorMessage}`);
          throw new Error(`Azure transcription failed: ${errorMessage}`);
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        attempts++;
      } catch (error) {
        console.error(`[JobCoordinator] Error polling Azure job status for ${azureJobId}:`, error);
        attempts++;

        // If we're near the end of attempts, throw the error
        if (attempts >= maxAttempts - 5) {
          throw error;
        }

        // Otherwise, continue polling after a longer delay
        await new Promise(resolve => setTimeout(resolve, pollInterval * 2));
      }
    }

    // Timeout reached
    const timeoutError = new Error(`Azure transcription timeout after ${(maxAttempts * pollInterval) / 1000} seconds`);
    console.error(`[JobCoordinator] ${timeoutError.message} for job ${azureJobId}`);
    throw timeoutError;
  }

  /**
   * Handle Azure Speech specific errors with recovery strategies
   */
  private async handleAzureSpeechError(
    error: unknown,
    jobId: string,
    request: CreateTranscriptionJobRequest,
  ): Promise<AzureSpeechError> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`[JobCoordinator] Analyzing Azure Speech error for job ${jobId}: ${errorMessage}`);

    // Classify error type and determine recovery strategy
    if (errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
      return {
        type: 'quota_exceeded',
        message: 'Azure Speech API quota exceeded',
        retryable: true,
        retryAfter: 60000, // 1 minute
        recovery: [
          'Azure Speech API quota has been exceeded',
          'The job will be retried automatically after the quota resets',
          'Consider upgrading your Azure Speech service plan for higher limits',
          'Monitor your usage in the Azure portal',
        ],
        originalError: error,
      };
    }

    if (errorMessage.includes('authentication') || errorMessage.includes('401') || errorMessage.includes('403')) {
      return {
        type: 'authentication_error',
        message: 'Azure Speech API authentication failed',
        retryable: false,
        recovery: [
          'Azure Speech API credentials are invalid or expired',
          'Check your subscription key and service region in settings',
          'Verify your Azure Speech service is active and properly configured',
          'Contact your IT administrator if you need new credentials',
        ],
        originalError: error,
      };
    }

    if (errorMessage.includes('timeout') || errorMessage.includes('network') || errorMessage.includes('connection')) {
      return {
        type: 'network_error',
        message: 'Network connectivity issues with Azure Speech API',
        retryable: true,
        retryAfter: 5000, // 5 seconds
        recovery: [
          'Network connectivity issue detected',
          'Check your internet connection',
          'The job will be retried automatically',
          'If the issue persists, contact your network administrator',
        ],
        originalError: error,
      };
    }

    if (errorMessage.includes('audio') || errorMessage.includes('format') || errorMessage.includes('unsupported')) {
      return {
        type: 'audio_error',
        message: 'Audio file format or content issues',
        retryable: false,
        recovery: [
          'The audio file format is not supported or corrupted',
          'Ensure the meeting recording is in a supported format (MP3, WAV, MP4)',
          'Check that the SharePoint URL is accessible and contains valid audio content',
          'Try with a different meeting recording',
        ],
        originalError: error,
      };
    }

    if (errorMessage.includes('permission') || errorMessage.includes('access')) {
      return {
        type: 'permission_error',
        message: 'Access denied to audio content',
        retryable: false,
        recovery: [
          'You do not have permission to access the meeting recording',
          'Contact the meeting organizer to share the recording with you',
          'Verify you are logged into SharePoint with the correct account',
          'Check your SharePoint permissions for this content',
        ],
        originalError: error,
      };
    }

    if (errorMessage.includes('service unavailable') || errorMessage.includes('502') || errorMessage.includes('503')) {
      return {
        type: 'service_unavailable',
        message: 'Azure Speech service temporarily unavailable',
        retryable: true,
        retryAfter: 30000, // 30 seconds
        recovery: [
          'Azure Speech service is temporarily unavailable',
          'This is likely a temporary Azure service issue',
          'The job will be retried automatically',
          'Check Azure service status if the issue persists',
        ],
        originalError: error,
      };
    }

    // Default error handling for unknown errors
    return {
      type: 'unknown_error',
      message: `Azure Speech transcription failed: ${errorMessage}`,
      retryable: true,
      retryAfter: 10000, // 10 seconds
      recovery: [
        'An unexpected error occurred during transcription',
        'The job will be retried automatically',
        'If the issue persists, please contact support',
        'Error details: ' + errorMessage,
      ],
      originalError: error,
    };
  }

  /**
   * Implement retry logic with exponential backoff
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    initialDelay: number = 1000,
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`[JobCoordinator] Retry attempt ${attempt}/${maxAttempts}`);
        return await operation();
      } catch (error) {
        lastError = error;
        console.error(`[JobCoordinator] Attempt ${attempt} failed:`, error);

        if (attempt === maxAttempts) {
          console.error(`[JobCoordinator] All ${maxAttempts} attempts failed`);
          break;
        }

        // Exponential backoff: 1s, 2s, 4s, 8s...
        const delay = initialDelay * Math.pow(2, attempt - 1);
        console.log(`[JobCoordinator] Waiting ${delay}ms before retry attempt ${attempt + 1}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Circuit breaker pattern for Azure Speech API calls
   */
  private circuitBreakerState = {
    failures: 0,
    lastFailureTime: 0,
    state: 'closed' as 'closed' | 'open' | 'half-open',
  };

  private async callWithCircuitBreaker<T>(operation: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const failureThreshold = 5;
    const timeout = 60000; // 1 minute

    // Check if circuit breaker should reset
    if (this.circuitBreakerState.state === 'open' && now - this.circuitBreakerState.lastFailureTime > timeout) {
      console.log('[JobCoordinator] Circuit breaker moving to half-open state');
      this.circuitBreakerState.state = 'half-open';
    }

    // Reject if circuit is open
    if (this.circuitBreakerState.state === 'open') {
      throw new Error('Azure Speech service circuit breaker is OPEN - service temporarily unavailable');
    }

    try {
      const result = await operation();

      // Success - reset circuit breaker
      if (this.circuitBreakerState.failures > 0) {
        console.log('[JobCoordinator] Circuit breaker reset after successful operation');
        this.circuitBreakerState.failures = 0;
        this.circuitBreakerState.state = 'closed';
      }

      return result;
    } catch (error) {
      this.circuitBreakerState.failures++;
      this.circuitBreakerState.lastFailureTime = now;

      if (this.circuitBreakerState.failures >= failureThreshold) {
        console.error(`[JobCoordinator] Circuit breaker OPEN after ${this.circuitBreakerState.failures} failures`);
        this.circuitBreakerState.state = 'open';
      }

      throw error;
    }
  }

  /**
   * Update progress based on Azure Speech API status
   */
  private updateProgressFromAzureStatus(localJobId: string, azureStatus: any): void {
    const stageMapping: Record<string, { progress: number; stage: string }> = {
      notStarted: { progress: 25, stage: 'azure_queued' },
      running: { progress: 50, stage: 'azure_processing' },
      processing: { progress: 60, stage: 'azure_analyzing' },
      succeeded: { progress: 95, stage: 'azure_finalizing' },
      completed: { progress: 100, stage: 'completed' },
      failed: { progress: 0, stage: 'failed' },
    };

    const mapping = stageMapping[azureStatus.status] || { progress: 40, stage: 'azure_processing' };

    console.log(`[JobCoordinator] Updating progress for ${localJobId}: ${mapping.progress}% - ${mapping.stage}`);

    this.jobTracker.updateJobProgress(localJobId, mapping.progress, mapping.stage, {
      azureJobId: azureStatus.jobId,
      azureStatus: azureStatus.status,
      azureProgress: azureStatus.progress,
    });
  }

  /**
   * Handle job completion
   */
  private async handleJobCompletion(result: JobExecutionResult): Promise<void> {
    try {
      if (result.success) {
        // Update progress to 100%
        this.jobTracker.updateJobProgress(result.jobId, 100, 'completed');

        // Complete the job in queue manager
        await this.queueManager.completeJob(result.jobId, result.result);

        // Update job status
        this.jobTracker.updateJobStatus(result.jobId, 'completed', 'Job completed successfully');

        console.log(`[JobCoordinator] Job ${result.jobId} completed successfully`);
      } else {
        await this.handleJobError(result.jobId, result.error || new Error('Unknown execution error'));
      }
    } catch (error) {
      console.error(`[JobCoordinator] Error handling job completion for ${result.jobId}:`, error);
    }
  }

  /**
   * Handle job error
   */
  private async handleJobError(jobId: string, error: unknown): Promise<void> {
    try {
      const orchestrationError =
        error instanceof Error ? this.createExecutionError(jobId, error) : (error as JobOrchestrationError);

      // Record error in tracker
      this.jobTracker.recordJobError(jobId, orchestrationError);

      // Handle error in queue manager (may retry or mark as failed)
      await this.queueManager.failJob(jobId, orchestrationError);

      console.error(`[JobCoordinator] Job ${jobId} failed:`, orchestrationError.message);
    } catch (handlingError) {
      console.error(`[JobCoordinator] Error handling job error for ${jobId}:`, handlingError);
    }
  }

  /**
   * Create execution error
   */
  private createExecutionError(jobId: string, error: unknown): JobOrchestrationError {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    return {
      errorId: `exec-${jobId}-${Date.now()}`,
      jobId,
      type: this.classifyError(message),
      severity: this.determineSeverity(message),
      message,
      details: {
        stack,
        context: { timestamp: new Date().toISOString() },
        recoverySuggestions: this.getRecoverySuggestions(message),
      },
      timestamp: new Date().toISOString(),
      recoverable: this.isRecoverable(message),
      retryConfig: this.isRecoverable(message)
        ? {
            maxRetries: this.azureConfig.retry.maxAttempts,
            retryDelay: this.azureConfig.retry.initialDelay,
            backoffFactor: this.azureConfig.retry.backoffFactor,
          }
        : undefined,
    };
  }

  /**
   * Classify error type
   */
  private classifyError(message: string): JobOrchestrationError['type'] {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('timeout')) return 'timeout';
    if (lowerMessage.includes('network') || lowerMessage.includes('connection')) return 'external_api_error';
    if (lowerMessage.includes('quota') || lowerMessage.includes('rate limit')) return 'resource_exhausted';
    if (lowerMessage.includes('dependency')) return 'dependency_failed';

    return 'internal_error';
  }

  /**
   * Determine error severity
   */
  private determineSeverity(message: string): JobOrchestrationError['severity'] {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('critical') || lowerMessage.includes('fatal')) return 'critical';
    if (lowerMessage.includes('timeout') || lowerMessage.includes('quota')) return 'high';
    if (lowerMessage.includes('retry') || lowerMessage.includes('temporary')) return 'medium';

    return 'low';
  }

  /**
   * Check if error is recoverable
   */
  private isRecoverable(message: string): boolean {
    const lowerMessage = message.toLowerCase();

    // Non-recoverable errors
    if (
      lowerMessage.includes('invalid') ||
      lowerMessage.includes('unauthorized') ||
      lowerMessage.includes('forbidden')
    ) {
      return false;
    }

    // Recoverable errors
    return (
      lowerMessage.includes('timeout') ||
      lowerMessage.includes('network') ||
      lowerMessage.includes('rate limit') ||
      lowerMessage.includes('temporary')
    );
  }

  /**
   * Get recovery suggestions
   */
  private getRecoverySuggestions(message: string): string[] {
    const lowerMessage = message.toLowerCase();
    const suggestions: string[] = [];

    if (lowerMessage.includes('timeout')) {
      suggestions.push('Increase timeout settings', 'Check network connectivity');
    }

    if (lowerMessage.includes('rate limit')) {
      suggestions.push('Reduce request frequency', 'Check API quota');
    }

    if (lowerMessage.includes('network')) {
      suggestions.push('Check internet connection', 'Verify Azure endpoint accessibility');
    }

    if (suggestions.length === 0) {
      suggestions.push('Check system logs', 'Contact support if issue persists');
    }

    return suggestions;
  }
}
