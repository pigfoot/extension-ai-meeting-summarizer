/**
 * Job coordinator for Azure API coordination and job execution
 * Implements JobOrchestrator with Azure Speech services integration
 */

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
import type { TranscriptionResult, CreateTranscriptionJobRequest } from '@extension/azure-speech';

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
}

/**
 * Job coordinator for orchestrating transcription job execution
 */
export class JobCoordinator implements JobOrchestrator {
  private queueManager: JobQueueManager;
  private jobTracker: JobTracker;
  private azureConfig: AzureIntegrationConfig;
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private activeExecutions = new Map<string, Promise<JobExecutionResult>>();

  constructor(queueManager: JobQueueManager, jobTracker: JobTracker, azureConfig: AzureIntegrationConfig) {
    this.queueManager = queueManager;
    this.jobTracker = jobTracker;
    this.azureConfig = azureConfig;

    // Start job processing
    this.startJobProcessing();
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
    if (this.processingInterval || !this.isProcessing) return;

    this.processingInterval = setInterval(async () => {
      await this.processJobs();
    }, 1000); // Check for jobs every second

    console.log('[JobCoordinator] Job processing started');
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
    if (!this.isProcessing || !this.azureConfig.enabled) return;

    try {
      // Check if we can process more jobs
      if (this.activeExecutions.size >= this.azureConfig.maxConcurrentCalls) {
        return;
      }

      // Get next job from queue
      const job = await this.queueManager.getNextJob();
      if (!job) return;

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
      const transcriptionResult = await this.executeAzureTranscription(job, transcriptionRequest);

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
    _request: CreateTranscriptionJobRequest,
  ): Promise<TranscriptionResult> {
    // Update progress - submitting to Azure
    this.jobTracker.updateJobProgress(job.jobId, 10, 'submitting_to_azure');

    // TODO: Integrate with Azure Speech package
    // For now, simulate transcription process
    const simulationSteps = [
      { progress: 20, stage: 'audio_validation', delay: 2000 },
      { progress: 40, stage: 'transcription_processing', delay: 5000 },
      { progress: 70, stage: 'speaker_diarization', delay: 3000 },
      { progress: 90, stage: 'result_compilation', delay: 2000 },
      { progress: 100, stage: 'completed', delay: 1000 },
    ];

    for (const step of simulationSteps) {
      await new Promise(resolve => setTimeout(resolve, step.delay));
      this.jobTracker.updateJobProgress(
        job.jobId,
        step.progress,
        step.stage,
        { azureJobId: `azure-${job.jobId}` },
        step.progress < 100 ? (simulationSteps.length - simulationSteps.indexOf(step)) * 2000 : 0,
      );
    }

    // Create mock transcription result
    const mockResult: TranscriptionResult = {
      jobId: job.jobId,
      text: 'This is a mock transcription result for testing purposes.',
      confidence: 0.95,
      duration: 300, // 5 minutes
      speakers: [
        {
          speakerId: 'speaker-1',
          displayName: 'Speaker 1',
          totalSpeakingTime: 180,
          confidence: 0.92,
        },
        {
          speakerId: 'speaker-2',
          displayName: 'Speaker 2',
          totalSpeakingTime: 120,
          confidence: 0.89,
        },
      ],
      segments: [
        {
          text: 'Hello, welcome to our meeting.',
          startTime: 0,
          endTime: 3,
          speakerId: 'speaker-1',
          confidence: 0.95,
          words: [],
        },
        {
          text: 'Thank you, glad to be here.',
          startTime: 4,
          endTime: 7,
          speakerId: 'speaker-2',
          confidence: 0.92,
          words: [],
        },
      ],
      metadata: {
        audioFormat: 'mp3',
        sampleRate: 44100,
        channels: 2,
        processingTime:
          Date.now() - new Date(job.executionContext.startedAt || job.executionContext.createdAt).getTime(),
        fileSize: 1024000, // 1MB
        language: job.config.language,
      },
    };

    return mockResult;
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
