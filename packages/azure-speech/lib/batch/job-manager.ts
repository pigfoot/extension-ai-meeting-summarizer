/**
 * Azure Speech batch transcription job manager
 * Manages job lifecycle, state tracking, concurrent job management with resource limits
 * and comprehensive coordination of all transcription operations
 */

import { JobSubmitter } from './job-submitter';
import { JobValidator } from './job-validator';
import { ProgressMonitor } from './progress-monitor';
import { ResultRetriever } from './result-retriever';
import { ErrorRecoveryService } from '../errors/recovery-service';
import { ErrorCategory, TranscriptionErrorType, RetryStrategy, ErrorSeverity } from '../types/errors';
import type { AuthConfig } from '../types/auth';
import type {
  TranscriptionJob,
  TranscriptionResult,
  BatchTranscriptionConfig,
  TranscriptionJobStatus,
  CreateTranscriptionJobRequest,
} from '../types/index';

/**
 * Job manager configuration
 */
export interface JobManagerConfig {
  /** Maximum concurrent jobs */
  maxConcurrentJobs: number;
  /** Maximum jobs in queue */
  maxQueueSize: number;
  /** Default job timeout in milliseconds */
  defaultJobTimeout: number;
  /** Job cleanup interval in milliseconds */
  cleanupInterval: number;
  /** Maximum job retention time in milliseconds */
  maxJobRetention: number;
  /** Enable automatic retry for failed jobs */
  autoRetry: boolean;
  /** Maximum retry attempts per job */
  maxRetryAttempts: number;
  /** Enable job persistence */
  enablePersistence: boolean;
  /** Job status polling interval in milliseconds */
  statusPollingInterval: number;
}

/**
 * Job priority levels
 */
export type JobPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Job manager statistics
 */
export interface JobManagerStats {
  /** Total jobs processed */
  totalJobs: number;
  /** Currently active jobs */
  activeJobs: number;
  /** Jobs in queue */
  queuedJobs: number;
  /** Completed jobs */
  completedJobs: number;
  /** Failed jobs */
  failedJobs: number;
  /** Average job duration in milliseconds */
  averageJobDuration: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Resource utilization (0-1) */
  resourceUtilization: number;
  /** Queue wait time in milliseconds */
  averageQueueWaitTime: number;
  /** Last statistics update */
  lastUpdated: Date;
}

/**
 * Managed job wrapper
 */
interface ManagedJob {
  /** Base transcription job */
  job: TranscriptionJob;
  /** Job priority */
  priority: JobPriority;
  /** Job creation request */
  request: CreateTranscriptionJobRequest;
  /** Job status tracking */
  status: {
    /** Current status */
    current: TranscriptionJobStatus;
    /** Status history */
    history: Array<{ status: TranscriptionJobStatus; timestamp: Date; message?: string }>;
    /** Last status check */
    lastCheck: Date;
  };
  /** Timing information */
  timing: {
    /** When job was queued */
    queued: Date;
    /** When job started processing */
    started?: Date;
    /** When job completed */
    completed?: Date;
    /** Total processing time */
    duration?: number;
    /** Queue wait time */
    queueWaitTime?: number;
  };
  /** Retry information */
  retry: {
    /** Number of retry attempts */
    attempts: number;
    /** Last retry timestamp */
    lastRetry?: Date;
    /** Retry reason */
    reason?: string;
  };
  /** Associated monitoring and retrieval instances */
  monitors: {
    /** Progress monitor instance */
    progressMonitor?: ProgressMonitor;
    /** Result retriever instance */
    resultRetriever?: ResultRetriever;
  };
  /** Job configuration */
  config: BatchTranscriptionConfig;
  /** Job result when completed */
  result?: TranscriptionResult;
  /** Job error if failed */
  error?: Error;
}

/**
 * Job queue event types
 */
export type JobQueueEvent =
  | 'job_queued'
  | 'job_started'
  | 'job_progress'
  | 'job_completed'
  | 'job_failed'
  | 'job_retried'
  | 'queue_full'
  | 'resource_limit'
  | 'manager_stats';

/**
 * Job queue event callback
 */
export type JobQueueEventCallback = (
  event: JobQueueEvent,
  data: {
    jobId?: string;
    job?: ManagedJob;
    progress?: number;
    error?: Error;
    stats?: JobManagerStats;
    message?: string;
  },
) => void;

/**
 * Default job manager configuration
 */
const DEFAULT_JOB_MANAGER_CONFIG: JobManagerConfig = {
  maxConcurrentJobs: 5,
  maxQueueSize: 50,
  defaultJobTimeout: 30 * 60 * 1000, // 30 minutes
  cleanupInterval: 5 * 60 * 1000, // 5 minutes
  maxJobRetention: 24 * 60 * 60 * 1000, // 24 hours
  autoRetry: true,
  maxRetryAttempts: 3,
  enablePersistence: true,
  statusPollingInterval: 30 * 1000, // 30 seconds
};

/**
 * Priority-based job queue with resource management
 */
class PriorityJobQueue {
  private queues: Map<JobPriority, ManagedJob[]> = new Map([
    ['urgent', []],
    ['high', []],
    ['normal', []],
    ['low', []],
  ]);

  private priorityOrder: JobPriority[] = ['urgent', 'high', 'normal', 'low'];

  /**
   * Add job to appropriate priority queue
   */
  enqueue(job: ManagedJob): void {
    const queue = this.queues.get(job.priority)!;
    queue.push(job);

    // Sort by queued time within same priority
    queue.sort((a, b) => a.timing.queued.getTime() - b.timing.queued.getTime());
  }

  /**
   * Get next job from highest priority queue
   */
  dequeue(): ManagedJob | null {
    for (const priority of this.priorityOrder) {
      const queue = this.queues.get(priority)!;
      if (queue.length > 0) {
        return queue.shift()!;
      }
    }
    return null;
  }

  /**
   * Get total queue size
   */
  size(): number {
    return Array.from(this.queues.values()).reduce((total, queue) => total + queue.length, 0);
  }

  /**
   * Get queue size by priority
   */
  sizeByPriority(priority: JobPriority): number {
    return this.queues.get(priority)?.length || 0;
  }

  /**
   * Clear all queues
   */
  clear(): void {
    this.queues.forEach(queue => (queue.length = 0));
  }

  /**
   * Get all jobs in queue
   */
  getAllJobs(): ManagedJob[] {
    const allJobs: ManagedJob[] = [];
    for (const priority of this.priorityOrder) {
      allJobs.push(...this.queues.get(priority)!);
    }
    return allJobs;
  }

  /**
   * Remove specific job from queue
   */
  remove(jobId: string): boolean {
    for (const queue of this.queues.values()) {
      const index = queue.findIndex(job => job.job.jobId === jobId);
      if (index !== -1) {
        queue.splice(index, 1);
        return true;
      }
    }
    return false;
  }
}

/**
 * Azure Speech batch transcription job manager
 */
export class JobManager {
  private config: JobManagerConfig;
  private authConfig: AuthConfig;
  private jobValidator: JobValidator;
  private jobSubmitter: JobSubmitter;
  private errorRecovery: ErrorRecoveryService;

  private jobQueue: PriorityJobQueue = new PriorityJobQueue();
  private activeJobs: Map<string, ManagedJob> = new Map();
  private completedJobs: Map<string, ManagedJob> = new Map();
  private failedJobs: Map<string, ManagedJob> = new Map();

  private processingInterval: ReturnType<typeof setInterval> | null = null;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private statsInterval: ReturnType<typeof setInterval> | null = null;

  private eventCallbacks = new Set<JobQueueEventCallback>();
  private isProcessing = false;
  private isShuttingDown = false;

  private statistics: JobManagerStats = {
    totalJobs: 0,
    activeJobs: 0,
    queuedJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    averageJobDuration: 0,
    successRate: 0,
    resourceUtilization: 0,
    averageQueueWaitTime: 0,
    lastUpdated: new Date(),
  };

  constructor(authConfig: AuthConfig, config?: Partial<JobManagerConfig>) {
    this.config = { ...DEFAULT_JOB_MANAGER_CONFIG, ...config };
    this.authConfig = authConfig;

    this.jobValidator = new JobValidator();
    this.jobSubmitter = new JobSubmitter(authConfig);
    this.errorRecovery = new ErrorRecoveryService();
  }

  /**
   * Start the job manager
   */
  start(): void {
    if (this.isProcessing) return;

    this.isProcessing = true;
    this.isShuttingDown = false;

    // Start job processing
    this.processingInterval = setInterval(() => {
      this.processJobQueue();
    }, 1000); // Check every second

    // Start cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanupCompletedJobs();
    }, this.config.cleanupInterval);

    // Start statistics updates
    this.statsInterval = setInterval(() => {
      this.updateStatistics();
    }, 10000); // Update every 10 seconds

    this.emitEvent('manager_stats', { message: 'Job manager started', stats: this.statistics });
  }

  /**
   * Stop the job manager
   */
  async stop(): Promise<void> {
    this.isShuttingDown = true;

    // Stop intervals
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }

    // Wait for active jobs to complete or timeout
    const activeJobIds = Array.from(this.activeJobs.keys());

    if (activeJobIds.length > 0) {
      console.log(`Waiting for ${activeJobIds.length} active jobs to complete...`);

      // Wait up to 30 seconds for jobs to complete
      const maxWaitTime = 30000;
      const startTime = Date.now();

      while (this.activeJobs.size > 0 && Date.now() - startTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Cancel remaining jobs
      for (const job of this.activeJobs.values()) {
        await this.cancelJob(job.job.jobId);
      }
    }

    this.isProcessing = false;
    this.emitEvent('manager_stats', { message: 'Job manager stopped', stats: this.statistics });
  }

  /**
   * Submit a new transcription job
   */
  async submitJob(
    request: CreateTranscriptionJobRequest,
    priority: JobPriority = 'normal',
    config?: Partial<BatchTranscriptionConfig>,
  ): Promise<{ success: boolean; jobId?: string; error?: string }> {
    try {
      // Check queue capacity
      if (this.jobQueue.size() >= this.config.maxQueueSize) {
        this.emitEvent('queue_full', {
          message: `Queue full: ${this.jobQueue.size()}/${this.config.maxQueueSize}`,
        });
        return { success: false, error: 'Job queue is full' };
      }

      // Validate job request
      const validationResult = await JobValidator.validateJob(request);
      if (!validationResult.isValid) {
        return {
          success: false,
          error: `Job validation failed: ${validationResult.errors.join(', ')}`,
        };
      }

      // Create job
      const jobId = crypto.randomUUID();
      const now = new Date();

      const job: TranscriptionJob = {
        jobId,
        status: 'pending',
        audioUrl: request.audioUrl,
        progress: 0,
        submittedAt: now,
        config: request.config,
        retryCount: 0,
      };

      const managedJob: ManagedJob = {
        job,
        priority,
        request,
        status: {
          current: 'pending',
          history: [{ status: 'pending', timestamp: now }],
          lastCheck: now,
        },
        timing: {
          queued: now,
        },
        retry: {
          attempts: 0,
        },
        monitors: {},
        config: { ...this.config, ...config } as BatchTranscriptionConfig,
      };

      // Add to queue
      this.jobQueue.enqueue(managedJob);
      this.statistics.totalJobs++;
      this.updateStatistics();

      this.emitEvent('job_queued', {
        jobId,
        job: managedJob,
        message: `Job queued with priority: ${priority}`,
      });

      return { success: true, jobId };
    } catch (error) {
      return {
        success: false,
        error: `Failed to submit job: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): {
    status?: TranscriptionJobStatus;
    progress?: number;
    result?: TranscriptionResult;
    error?: string;
    timing?: ManagedJob['timing'];
  } {
    // Check active jobs
    const activeJob = this.activeJobs.get(jobId);
    if (activeJob) {
      return {
        status: activeJob.status.current,
        progress: this.calculateJobProgress(activeJob),
        timing: activeJob.timing,
      };
    }

    // Check completed jobs
    const completedJob = this.completedJobs.get(jobId);
    if (completedJob) {
      return {
        status: completedJob.status.current,
        progress: 100,
        ...(completedJob.result && { result: completedJob.result }),
        timing: completedJob.timing,
      };
    }

    // Check failed jobs
    const failedJob = this.failedJobs.get(jobId);
    if (failedJob) {
      return {
        status: failedJob.status.current,
        progress: 0,
        ...(failedJob.error?.message && { error: failedJob.error.message }),
        timing: failedJob.timing,
      };
    }

    // Check queue
    const queuedJobs = this.jobQueue.getAllJobs();
    const queuedJob = queuedJobs.find(job => job.job.jobId === jobId);
    if (queuedJob) {
      return {
        status: 'pending',
        progress: 0,
        timing: queuedJob.timing,
      };
    }

    return {};
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    // Try to remove from queue first
    if (this.jobQueue.remove(jobId)) {
      this.emitEvent('job_failed', {
        jobId,
        message: 'Job cancelled while queued',
      });
      return true;
    }

    // Cancel active job
    const activeJob = this.activeJobs.get(jobId);
    if (activeJob) {
      try {
        // Stop monitoring
        if (activeJob.monitors.progressMonitor) {
          activeJob.monitors.progressMonitor.stopAllMonitoring();
        }

        // Update status
        this.updateJobStatus(activeJob, 'cancelled', 'Job cancelled by user');

        // Move to failed jobs
        this.activeJobs.delete(jobId);
        this.failedJobs.set(jobId, activeJob);

        this.emitEvent('job_failed', {
          jobId,
          job: activeJob,
          message: 'Job cancelled',
        });

        return true;
      } catch (error) {
        console.error(`Failed to cancel job ${jobId}:`, error);
        return false;
      }
    }

    return false;
  }

  /**
   * Process job queue
   */
  private async processJobQueue(): Promise<void> {
    if (this.isShuttingDown) return;

    // Check if we can start more jobs
    const availableSlots = this.config.maxConcurrentJobs - this.activeJobs.size;
    if (availableSlots <= 0) {
      return;
    }

    // Process available slots
    for (let i = 0; i < availableSlots; i++) {
      const job = this.jobQueue.dequeue();
      if (!job) break;

      this.startJob(job);
    }
  }

  /**
   * Start processing a job
   */
  private async startJob(managedJob: ManagedJob): Promise<void> {
    const { job } = managedJob;

    try {
      // Update timing
      managedJob.timing.started = new Date();
      managedJob.timing.queueWaitTime = managedJob.timing.started.getTime() - managedJob.timing.queued.getTime();

      // Add to active jobs
      this.activeJobs.set(job.jobId, managedJob);
      this.updateJobStatus(managedJob, 'processing', 'Job started processing');

      this.emitEvent('job_started', {
        jobId: job.jobId,
        job: managedJob,
        message: 'Job processing started',
      });

      // Submit job to Azure
      const submissionResult = await this.jobSubmitter.submitJob(managedJob.request);

      if (!submissionResult.success || !submissionResult.job) {
        throw new Error(submissionResult.error?.message || 'Job submission failed');
      }

      // Update job with Azure job ID
      if (submissionResult.job.azureJobId) {
        managedJob.job.azureJobId = submissionResult.job.azureJobId;
      }
      this.updateJobStatus(managedJob, 'submitted', 'Job submitted to Azure');

      // Start progress monitoring
      await this.startProgressMonitoring(managedJob);
    } catch (error) {
      await this.handleJobError(managedJob, error instanceof Error ? error : new Error('Unknown error'));
    }
  }

  /**
   * Start progress monitoring for a job
   */
  private async startProgressMonitoring(managedJob: ManagedJob): Promise<void> {
    const progressMonitor = new ProgressMonitor(this.authConfig);
    managedJob.monitors.progressMonitor = progressMonitor;

    try {
      const monitoringResult = await progressMonitor.startMonitoring(managedJob.job, undefined, progress => {
        this.updateJobStatus(managedJob, progress.status);

        this.emitEvent('job_progress', {
          jobId: managedJob.job.jobId,
          job: managedJob,
          progress: progress.progress,
        });

        // Check if job completed
        if (progress.status === 'completed') {
          this.handleJobCompletion(managedJob);
        } else if (progress.status === 'failed') {
          this.handleJobError(managedJob, new Error('Job failed'));
        }
      });

      if (!monitoringResult.success) {
        throw new Error(monitoringResult.error?.message || 'Failed to start monitoring');
      }
    } catch (error) {
      await this.handleJobError(managedJob, error instanceof Error ? error : new Error('Monitoring failed'));
    }
  }

  /**
   * Handle job completion
   */
  private async handleJobCompletion(managedJob: ManagedJob): Promise<void> {
    try {
      // Retrieve results
      const resultRetriever = new ResultRetriever(this.authConfig);
      managedJob.monitors.resultRetriever = resultRetriever;

      const retrievalResult = await resultRetriever.retrieveResults(managedJob.job);

      if (retrievalResult.success && retrievalResult.result) {
        // Update job with results
        managedJob.result = retrievalResult.result;
        managedJob.timing.completed = new Date();
        managedJob.timing.duration = managedJob.timing.completed.getTime() - managedJob.timing.started!.getTime();

        this.updateJobStatus(managedJob, 'completed', 'Job completed successfully');

        // Move to completed jobs
        this.activeJobs.delete(managedJob.job.jobId);
        this.completedJobs.set(managedJob.job.jobId, managedJob);

        this.emitEvent('job_completed', {
          jobId: managedJob.job.jobId,
          job: managedJob,
          message: 'Job completed successfully',
        });
      } else {
        throw new Error(retrievalResult.error?.message || 'Failed to retrieve results');
      }
    } catch (error) {
      await this.handleJobError(managedJob, error instanceof Error ? error : new Error('Result retrieval failed'));
    }
  }

  /**
   * Handle job error
   */
  private async handleJobError(managedJob: ManagedJob, error: Error): Promise<void> {
    managedJob.error = error;

    // Check if we should retry
    if (this.config.autoRetry && managedJob.retry.attempts < this.config.maxRetryAttempts) {
      managedJob.retry.attempts++;
      managedJob.retry.lastRetry = new Date();
      managedJob.retry.reason = error.message;

      this.updateJobStatus(
        managedJob,
        'processing',
        `Retrying job (attempt ${managedJob.retry.attempts}/${this.config.maxRetryAttempts})`,
      );

      // Re-queue the job with delay
      setTimeout(
        () => {
          if (!this.isShuttingDown) {
            this.jobQueue.enqueue(managedJob);
            this.activeJobs.delete(managedJob.job.jobId);
          }
        },
        Math.min(1000 * Math.pow(2, managedJob.retry.attempts), 30000),
      ); // Exponential backoff, max 30s

      this.emitEvent('job_retried', {
        jobId: managedJob.job.jobId,
        job: managedJob,
        error,
        message: `Job retry attempt ${managedJob.retry.attempts}`,
      });
    } else {
      // Job failed permanently
      managedJob.timing.completed = new Date();
      this.updateJobStatus(managedJob, 'failed', error.message);

      // Move to failed jobs
      this.activeJobs.delete(managedJob.job.jobId);
      this.failedJobs.set(managedJob.job.jobId, managedJob);

      this.emitEvent('job_failed', {
        jobId: managedJob.job.jobId,
        job: managedJob,
        error,
        message: 'Job failed permanently',
      });

      // Attempt error recovery
      try {
        await this.errorRecovery.handleJobFailure(managedJob.job, {
          name: 'TranscriptionError',
          type: TranscriptionErrorType.UNKNOWN_ERROR,
          message: error.message,
          category: ErrorCategory.UNKNOWN,
          retryable: false,
          retryStrategy: RetryStrategy.NONE,
          severity: ErrorSeverity.HIGH,
          notifyUser: false,
          timestamp: new Date(),
        });
      } catch (recoveryError) {
        console.error('Error recovery failed:', recoveryError);
      }
    }
  }

  /**
   * Update job status
   */
  private updateJobStatus(managedJob: ManagedJob, status: TranscriptionJobStatus, message?: string): void {
    managedJob.status.current = status;
    managedJob.status.lastCheck = new Date();
    managedJob.status.history.push({
      status,
      timestamp: new Date(),
      ...(message && { message }),
    });

    managedJob.job.status = status;
  }

  /**
   * Calculate job progress
   */
  private calculateJobProgress(managedJob: ManagedJob): number {
    switch (managedJob.status.current) {
      case 'pending':
        return 0;
      case 'submitted':
        return 25;
      case 'processing':
        return 50;
      case 'completed':
        return 100;
      case 'failed':
      case 'cancelled':
        return 0;
      default:
        return 0;
    }
  }

  /**
   * Clean up completed jobs
   */
  private cleanupCompletedJobs(): void {
    const cutoffTime = Date.now() - this.config.maxJobRetention;

    // Clean completed jobs
    for (const [jobId, job] of this.completedJobs.entries()) {
      if (job.timing.completed && job.timing.completed.getTime() < cutoffTime) {
        this.completedJobs.delete(jobId);
      }
    }

    // Clean failed jobs
    for (const [jobId, job] of this.failedJobs.entries()) {
      if (job.timing.completed && job.timing.completed.getTime() < cutoffTime) {
        this.failedJobs.delete(jobId);
      }
    }
  }

  /**
   * Update statistics
   */
  private updateStatistics(): void {
    const now = new Date();

    this.statistics.activeJobs = this.activeJobs.size;
    this.statistics.queuedJobs = this.jobQueue.size();
    this.statistics.completedJobs = this.completedJobs.size;
    this.statistics.failedJobs = this.failedJobs.size;

    // Calculate success rate
    const totalProcessed = this.statistics.completedJobs + this.statistics.failedJobs;
    this.statistics.successRate = totalProcessed > 0 ? this.statistics.completedJobs / totalProcessed : 0;

    // Calculate resource utilization
    this.statistics.resourceUtilization = this.statistics.activeJobs / this.config.maxConcurrentJobs;

    // Calculate average job duration
    const completedJobsArray = Array.from(this.completedJobs.values());
    if (completedJobsArray.length > 0) {
      const totalDuration = completedJobsArray.reduce((sum, job) => sum + (job.timing.duration || 0), 0);
      this.statistics.averageJobDuration = totalDuration / completedJobsArray.length;
    }

    // Calculate average queue wait time
    const allJobs = [...completedJobsArray, ...Array.from(this.failedJobs.values())];
    if (allJobs.length > 0) {
      const totalWaitTime = allJobs.reduce((sum, job) => sum + (job.timing.queueWaitTime || 0), 0);
      this.statistics.averageQueueWaitTime = totalWaitTime / allJobs.length;
    }

    this.statistics.lastUpdated = now;
  }

  /**
   * Emit event to callbacks
   */
  private emitEvent(event: JobQueueEvent, data: Parameters<JobQueueEventCallback>[1]): void {
    this.eventCallbacks.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Error in job queue event callback:', error);
      }
    });
  }

  /**
   * Add event listener
   */
  addEventListener(callback: JobQueueEventCallback): void {
    this.eventCallbacks.add(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(callback: JobQueueEventCallback): void {
    this.eventCallbacks.delete(callback);
  }

  /**
   * Get current statistics
   */
  getStatistics(): JobManagerStats {
    this.updateStatistics();
    return { ...this.statistics };
  }

  /**
   * Get all job IDs by status
   */
  getJobsByStatus(status: TranscriptionJobStatus): string[] {
    const jobs: string[] = [];

    // Check active jobs
    for (const [jobId, job] of this.activeJobs.entries()) {
      if (job.status.current === status) {
        jobs.push(jobId);
      }
    }

    // Check completed jobs
    if (status === 'completed') {
      jobs.push(...Array.from(this.completedJobs.keys()));
    }

    // Check failed jobs
    if (status === 'failed') {
      jobs.push(...Array.from(this.failedJobs.keys()));
    }

    // Check queued jobs
    if (status === 'pending') {
      const queuedJobs = this.jobQueue.getAllJobs();
      jobs.push(...queuedJobs.map(job => job.job.jobId));
    }

    return jobs;
  }

  /**
   * Get detailed job information
   */
  getJobDetails(jobId: string): ManagedJob | null {
    return (
      this.activeJobs.get(jobId) ||
      this.completedJobs.get(jobId) ||
      this.failedJobs.get(jobId) ||
      this.jobQueue.getAllJobs().find(job => job.job.jobId === jobId) ||
      null
    );
  }

  /**
   * Update job manager configuration
   */
  updateConfig(config: Partial<JobManagerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): JobManagerConfig {
    return { ...this.config };
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.stop();
    this.eventCallbacks.clear();
    this.activeJobs.clear();
    this.completedJobs.clear();
    this.failedJobs.clear();
    this.jobQueue.clear();
  }
}
