/**
 * Job queue manager for transcription job orchestration
 * Implements priority queue with concurrent processing limits and resource allocation
 */

import type {
  JobPriority,
  JobProcessingStatus,
  ProcessingLimits,
  OrchestrationJob,
  JobQueueConfig,
  JobQueueState,
  JobSchedulerConfig,
  JobOrchestrationError,
  OrchestrationMetrics,
} from '../types';

/**
 * Job state change event emitted when job moves between queue states
 */
export interface JobStateChangeEvent {
  /** Job identifier */
  jobId: string;
  /** Previous state */
  previousState: 'queued' | 'processing' | 'completed' | 'failed';
  /** New state */
  newState: 'queued' | 'processing' | 'completed' | 'failed';
  /** The job object */
  job: OrchestrationJob;
  /** Change timestamp */
  timestamp: string;
  /** Change context */
  context?: string;
}

/**
 * Queue operation result
 */
export interface QueueOperationResult {
  /** Whether operation was successful */
  success: boolean;
  /** Operation result message */
  message: string;
  /** Job ID if applicable */
  jobId?: string;
  /** Operation timestamp */
  timestamp: string;
}

/**
 * Resource allocation result
 */
export interface ResourceAllocation {
  /** Whether resources were allocated */
  allocated: boolean;
  /** Allocated memory in MB */
  memoryMB: number;
  /** Allocated API quota */
  apiQuota: number;
  /** Allocated processing slots */
  processingSlots: number;
  /** Allocation timestamp */
  allocatedAt: string;
  /** Allocation expiry time */
  expiresAt: string;
}

/**
 * Job queue manager for orchestrating transcription jobs
 */
export class JobQueueManager {
  private config: JobQueueConfig;
  private state: JobQueueState;
  private schedulerConfig: JobSchedulerConfig;
  private processingInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;
  private resourceAllocations = new Map<string, ResourceAllocation>();
  private stateChangeHandlers = new Set<(event: JobStateChangeEvent) => void>();

  constructor(config: JobQueueConfig, schedulerConfig: JobSchedulerConfig) {
    this.config = config;
    this.schedulerConfig = schedulerConfig;
    this.state = this.createInitialState();

    if (this.schedulerConfig.enabled) {
      this.startJobScheduler();
    }

    if (this.config.monitoring.enabled) {
      this.startMetricsCollection();
    }
  }

  /**
   * Add a job to the queue
   */
  async enqueueJob(job: OrchestrationJob): Promise<QueueOperationResult> {
    const result: QueueOperationResult = {
      success: false,
      message: '',
      jobId: job.jobId,
      timestamp: new Date().toISOString(),
    };

    try {
      // Check queue capacity
      if (this.getTotalQueuedJobs() >= this.config.maxSize) {
        result.message = 'Queue is at maximum capacity';
        return result;
      }

      // Validate job
      if (!this.validateJob(job)) {
        result.message = 'Job validation failed';
        return result;
      }

      // Update job execution context
      job.executionContext.status = 'queued';
      job.executionContext.queuedAt = new Date().toISOString();

      // Add to appropriate priority queue
      const priorityQueue = this.state.queuedJobs.get(job.executionContext.priority) || [];
      priorityQueue.push(job);
      this.state.queuedJobs.set(job.executionContext.priority, priorityQueue);

      // Update metrics
      this.updateQueueMetrics();

      result.success = true;
      result.message = `Job queued with priority: ${job.executionContext.priority}`;

      // Trigger immediate scheduling check if enabled
      if (this.schedulerConfig.enabled) {
        setTimeout(() => this.processNextJobs(), 0);
      }
    } catch (error) {
      result.message = error instanceof Error ? error.message : String(error);
      console.error(`[JobQueueManager] Failed to enqueue job ${job.jobId}:`, error);
    }

    return result;
  }

  /**
   * Remove a job from the queue
   */
  async dequeueJob(jobId: string): Promise<QueueOperationResult> {
    const result: QueueOperationResult = {
      success: false,
      message: '',
      jobId,
      timestamp: new Date().toISOString(),
    };

    try {
      let found = false;

      // Search in queued jobs
      for (const [_priority, jobs] of this.state.queuedJobs) {
        const index = jobs.findIndex(_job => _job.jobId === jobId);
        if (index !== -1) {
          jobs.splice(index, 1);
          found = true;
          break;
        }
      }

      // Search in processing jobs
      if (!found && this.state.processingJobs.has(jobId)) {
        const _job = this.state.processingJobs.get(jobId)!;
        this.state.processingJobs.delete(jobId);
        this.releaseResources(jobId);
        found = true;
      }

      if (found) {
        this.updateQueueMetrics();
        result.success = true;
        result.message = 'Job removed from queue';
      } else {
        result.message = 'Job not found in queue';
      }
    } catch (error) {
      result.message = error instanceof Error ? error.message : String(error);
      console.error(`[JobQueueManager] Failed to dequeue job ${jobId}:`, error);
    }

    return result;
  }

  /**
   * Get next job to process based on queue mode and priorities
   */
  async getNextJob(): Promise<OrchestrationJob | null> {
    try {
      // Check if we can process more jobs
      if (!this.canProcessMoreJobs()) {
        return null;
      }

      let nextJob: OrchestrationJob | null = null;

      switch (this.config.mode) {
        case 'priority':
          nextJob = this.getNextJobByPriority();
          break;
        case 'fifo':
          nextJob = this.getNextJobFIFO();
          break;
        case 'round_robin':
          nextJob = this.getNextJobRoundRobin();
          break;
        case 'shortest_job_first':
          nextJob = this.getNextJobShortest();
          break;
        default:
          nextJob = this.getNextJobByPriority();
      }

      if (nextJob) {
        // Allocate resources for the job
        const allocation = await this.allocateResources(nextJob);

        if (!allocation.allocated) {
          return null; // Cannot allocate resources
        }

        // Move job to processing
        this.moveJobToProcessing(nextJob);
        nextJob.executionContext.allocatedResources = {
          memoryMB: allocation.memoryMB,
          apiQuota: allocation.apiQuota,
          processingSlots: allocation.processingSlots,
        };
      }

      return nextJob;
    } catch (error) {
      console.error('[JobQueueManager] Failed to get next job:', error);
      return null;
    }
  }

  /**
   * Mark job as completed and update metrics
   */
  async completeJob(jobId: string, result: unknown): Promise<QueueOperationResult> {
    const operationResult: QueueOperationResult = {
      success: false,
      message: '',
      jobId,
      timestamp: new Date().toISOString(),
    };

    try {
      const job = this.state.processingJobs.get(jobId);
      if (!job) {
        operationResult.message = 'Job not found in processing queue';
        return operationResult;
      }

      // Update job status
      job.executionContext.status = 'completed';
      job.executionContext.completedAt = new Date().toISOString();

      // Move to completed jobs
      this.state.processingJobs.delete(jobId);
      this.state.completedJobs.set(jobId, job);

      // Release resources
      this.releaseResources(jobId);

      // Trigger completion callback
      if (job.callbacks.onComplete) {
        try {
          job.callbacks.onComplete(result, job.executionContext);
        } catch (error) {
          console.warn(`[JobQueueManager] Completion callback failed for job ${jobId}:`, error);
        }
      }

      // Update metrics
      this.updateQueueMetrics();
      this.state.metrics.totalJobsProcessed++;

      // Cleanup old completed jobs
      this.cleanupCompletedJobs();

      operationResult.success = true;
      operationResult.message = 'Job completed successfully';
    } catch (error) {
      operationResult.message = error instanceof Error ? error.message : String(error);
      console.error(`[JobQueueManager] Failed to complete job ${jobId}:`, error);
    }

    return operationResult;
  }

  /**
   * Mark job as failed and handle error
   */
  async failJob(jobId: string, error: JobOrchestrationError): Promise<QueueOperationResult> {
    const operationResult: QueueOperationResult = {
      success: false,
      message: '',
      jobId,
      timestamp: new Date().toISOString(),
    };

    try {
      const job = this.state.processingJobs.get(jobId);
      if (!job) {
        operationResult.message = 'Job not found in processing queue';
        return operationResult;
      }

      // Check if job can be retried
      if (job.executionContext.retryCount < job.executionContext.maxRetries && error.recoverable) {
        // Retry the job
        job.executionContext.retryCount++;
        job.executionContext.status = 'queued';

        // Add back to queue with exponential backoff delay
        const delay = Math.min(1000 * Math.pow(2, job.executionContext.retryCount), 30000);
        setTimeout(() => {
          this.requeueJob(job);
        }, delay);

        operationResult.success = true;
        operationResult.message = `Job scheduled for retry (attempt ${job.executionContext.retryCount + 1})`;
      } else {
        // Mark as permanently failed
        job.executionContext.status = 'failed';
        job.executionContext.completedAt = new Date().toISOString();

        this.state.processingJobs.delete(jobId);
        this.state.failedJobs.set(jobId, job);

        // Trigger error callback
        if (job.callbacks.onError) {
          try {
            job.callbacks.onError(new Error(error.message), job.executionContext);
          } catch (callbackError) {
            console.warn(`[JobQueueManager] Error callback failed for job ${jobId}:`, callbackError);
          }
        }

        operationResult.success = true;
        operationResult.message = 'Job marked as failed';
      }

      // Release resources
      this.releaseResources(jobId);

      // Update metrics
      this.updateQueueMetrics();
    } catch (processingError) {
      operationResult.message = processingError instanceof Error ? processingError.message : String(processingError);
      console.error(`[JobQueueManager] Failed to handle job failure for ${jobId}:`, processingError);
    }

    return operationResult;
  }

  /**
   * Get current queue state and metrics
   */
  getState(): JobQueueState {
    return { ...this.state };
  }

  /**
   * Get queue metrics
   */
  getMetrics(): OrchestrationMetrics {
    const totalJobs = this.getTotalQueuedJobs() + this.state.processingJobs.size;
    const jobsByStatus: Record<JobProcessingStatus, number> = {
      queued: this.getTotalQueuedJobs(),
      allocated: 0,
      processing: this.state.processingJobs.size,
      waiting: 0,
      paused: 0,
      completed: this.state.completedJobs.size,
      failed: this.state.failedJobs.size,
      cancelled: 0,
      expired: 0,
    };

    const jobsByPriority: Record<JobPriority, number> = {
      urgent: this.state.queuedJobs.get('urgent')?.length || 0,
      high: this.state.queuedJobs.get('high')?.length || 0,
      normal: this.state.queuedJobs.get('normal')?.length || 0,
      low: this.state.queuedJobs.get('low')?.length || 0,
      idle: this.state.queuedJobs.get('idle')?.length || 0,
    };

    return {
      totalJobs,
      jobsByStatus,
      jobsByPriority,
      avgProcessingTimes: {
        urgent: 0, // TODO: Calculate from completed jobs
        high: 0,
        normal: 0,
        low: 0,
        idle: 0,
      },
      resourceUtilization: {
        memory: (this.state.resourceUsage.memoryUsage / this.config.processingLimits.maxTotalMemory) * 100,
        apiQuota: (this.state.resourceUsage.activeAPICalls / this.config.processingLimits.maxAPICallsPerMinute) * 100,
        processingSlots:
          (this.state.resourceUsage.usedProcessingSlots / this.config.processingLimits.maxConcurrentJobs) * 100,
      },
      errors: {
        total: this.state.failedJobs.size,
        byType: {
          queue_full: 0, // TODO: Track error types
          resource_exhausted: 0,
          dependency_failed: 0,
          timeout: 0,
          internal_error: 0,
          external_api_error: 0,
        },
        errorRate: this.state.failedJobs.size / Math.max(1, this.state.metrics.totalJobsProcessed),
      },
      performance: {
        jobsPerHour: this.state.metrics.jobsPerHour,
        avgWaitTime: this.state.metrics.averageWaitTime,
        p95ProcessingTime: this.state.metrics.averageProcessingTime * 1.5, // Approximation
        throughput: this.state.metrics.jobsPerHour / 60,
      },
      lastUpdated: this.state.metrics.lastUpdated,
    };
  }

  /**
   * Update processing limits
   */
  updateLimits(limits: Partial<ProcessingLimits>): void {
    this.config.processingLimits = { ...this.config.processingLimits, ...limits };
  }

  /**
   * Pause job processing
   */
  pauseProcessing(): void {
    this.schedulerConfig.enabled = false;
    this.stopJobScheduler();
  }

  /**
   * Resume job processing
   */
  resumeProcessing(): void {
    this.schedulerConfig.enabled = true;
    this.startJobScheduler();
  }

  /**
   * Shutdown the job queue manager
   */
  async shutdown(): Promise<void> {
    this.stopJobScheduler();
    this.stopMetricsCollection();

    // Cancel all queued jobs
    for (const [_priority, jobs] of this.state.queuedJobs) {
      for (const job of jobs) {
        if (job.callbacks.onCancel) {
          try {
            job.callbacks.onCancel('System shutdown', job.executionContext);
          } catch (error) {
            console.warn(`[JobQueueManager] Cancel callback failed for job ${job.jobId}:`, error);
          }
        }
      }
    }

    this.state.queuedJobs.clear();
  }

  /**
   * Get next job by priority
   */
  private getNextJobByPriority(): OrchestrationJob | null {
    const priorities: JobPriority[] = ['urgent', 'high', 'normal', 'low', 'idle'];

    for (const priority of priorities) {
      const jobs = this.state.queuedJobs.get(priority);
      if (jobs && jobs.length > 0) {
        const job = jobs.shift()!;
        return job;
      }
    }
    return null;
  }

  /**
   * Get next job using FIFO
   */
  private getNextJobFIFO(): OrchestrationJob | null {
    let oldestJob: OrchestrationJob | null = null;
    let oldestPriority: JobPriority | null = null;
    let oldestIndex = -1;

    for (const [priority, jobs] of this.state.queuedJobs) {
      if (jobs.length > 0) {
        const job = jobs[0];
        if (!oldestJob || new Date(job.executionContext.queuedAt) < new Date(oldestJob.executionContext.queuedAt)) {
          oldestJob = job;
          oldestPriority = priority;
          oldestIndex = 0;
        }
      }
    }

    if (oldestJob && oldestPriority !== null) {
      this.state.queuedJobs.get(oldestPriority)!.splice(oldestIndex, 1);
    }

    return oldestJob;
  }

  /**
   * Get next job using round-robin
   */
  private getNextJobRoundRobin(): OrchestrationJob | null {
    // Simple round-robin implementation
    const priorities: JobPriority[] = ['urgent', 'high', 'normal', 'low', 'idle'];

    for (const priority of priorities) {
      const jobs = this.state.queuedJobs.get(priority);
      if (jobs && jobs.length > 0) {
        return jobs.shift()!;
      }
    }

    return null;
  }

  /**
   * Get shortest job first
   */
  private getNextJobShortest(): OrchestrationJob | null {
    let shortestJob: OrchestrationJob | null = null;
    let shortestPriority: JobPriority | null = null;
    let shortestIndex = -1;

    for (const [priority, jobs] of this.state.queuedJobs) {
      for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        // Use estimated completion time as job length
        const estimatedDuration = job.executionContext.estimatedCompletion
          ? new Date(job.executionContext.estimatedCompletion).getTime() - Date.now()
          : 60000; // Default 1 minute

        if (
          !shortestJob ||
          estimatedDuration <
            (shortestJob.executionContext.estimatedCompletion
              ? new Date(shortestJob.executionContext.estimatedCompletion).getTime() - Date.now()
              : 60000)
        ) {
          shortestJob = job;
          shortestPriority = priority;
          shortestIndex = i;
        }
      }
    }

    if (shortestJob && shortestPriority !== null) {
      this.state.queuedJobs.get(shortestPriority)!.splice(shortestIndex, 1);
    }

    return shortestJob;
  }

  /**
   * Check if we can process more jobs
   */
  private canProcessMoreJobs(): boolean {
    const concurrentCheck = this.state.processingJobs.size < this.config.processingLimits.maxConcurrentJobs;
    const memoryCheck = this.state.resourceUsage.memoryUsage < this.config.processingLimits.maxTotalMemory;
    const apiCheck = this.state.resourceUsage.activeAPICalls < this.config.processingLimits.maxAPICallsPerMinute;

    return concurrentCheck && memoryCheck && apiCheck;
  }

  /**
   * Allocate resources for a job
   */
  private async allocateResources(job: OrchestrationJob): Promise<ResourceAllocation> {
    const allocation: ResourceAllocation = {
      allocated: false,
      memoryMB: 0,
      apiQuota: 0,
      processingSlots: 0,
      allocatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour expiry
    };

    try {
      // Calculate required resources based on job priority
      const priorityMultiplier = this.getPriorityMultiplier(job.executionContext.priority);
      const baseMemory = this.config.processingLimits.maxMemoryPerJob;
      const requiredMemory = Math.min(baseMemory * priorityMultiplier, this.config.processingLimits.maxMemoryPerJob);

      // Check if resources are available
      const memoryAvailable =
        this.state.resourceUsage.memoryUsage + requiredMemory <= this.config.processingLimits.maxTotalMemory;
      const slotsAvailable =
        this.state.resourceUsage.usedProcessingSlots < this.config.processingLimits.maxConcurrentJobs;
      const apiAvailable = this.state.resourceUsage.activeAPICalls < this.config.processingLimits.maxAPICallsPerMinute;

      if (memoryAvailable && slotsAvailable && apiAvailable) {
        allocation.allocated = true;
        allocation.memoryMB = requiredMemory;
        allocation.apiQuota = 1; // One API call per job
        allocation.processingSlots = 1;

        // Update resource usage
        this.state.resourceUsage.memoryUsage += requiredMemory;
        this.state.resourceUsage.usedProcessingSlots++;
        this.state.resourceUsage.activeAPICalls++;

        // Store allocation
        this.resourceAllocations.set(job.jobId, allocation);
      }
    } catch (error) {
      console.error(`[JobQueueManager] Resource allocation failed for job ${job.jobId}:`, error);
    }

    return allocation;
  }

  /**
   * Release resources for a job
   */
  private releaseResources(jobId: string): void {
    const allocation = this.resourceAllocations.get(jobId);
    if (allocation && allocation.allocated) {
      this.state.resourceUsage.memoryUsage -= allocation.memoryMB;
      this.state.resourceUsage.usedProcessingSlots -= allocation.processingSlots;
      this.state.resourceUsage.activeAPICalls -= allocation.apiQuota;

      this.resourceAllocations.delete(jobId);
    }
  }

  /**
   * Move job to processing state
   */
  private moveJobToProcessing(job: OrchestrationJob): void {
    const previousState = job.executionContext.status;
    job.executionContext.status = 'processing';
    job.executionContext.startedAt = new Date().toISOString();
    this.state.processingJobs.set(job.jobId, job);

    // Emit state change event for JobTracker synchronization
    this.emitStateChange({
      jobId: job.jobId,
      previousState: previousState as 'queued' | 'processing' | 'completed' | 'failed',
      newState: 'processing',
      job,
      timestamp: new Date().toISOString(),
      context: 'job_coordinator_processing_start',
    });
  }

  /**
   * Requeue a job for retry
   */
  private requeueJob(job: OrchestrationJob): void {
    const priorityQueue = this.state.queuedJobs.get(job.executionContext.priority) || [];
    priorityQueue.push(job);
    this.state.queuedJobs.set(job.executionContext.priority, priorityQueue);
  }

  /**
   * Get priority multiplier for resource allocation
   */
  private getPriorityMultiplier(priority: JobPriority): number {
    switch (priority) {
      case 'urgent':
        return 2.0;
      case 'high':
        return 1.5;
      case 'normal':
        return 1.0;
      case 'low':
        return 0.7;
      case 'idle':
        return 0.5;
      default:
        return 1.0;
    }
  }

  /**
   * Validate job before queuing
   */
  private validateJob(job: OrchestrationJob): boolean {
    if (!job.jobId || !job.executionContext || !job.audioUrl) {
      return false;
    }
    return true;
  }

  /**
   * Register handler for job state changes
   */
  onStateChange(handler: (event: JobStateChangeEvent) => void): void {
    this.stateChangeHandlers.add(handler);
  }

  /**
   * Remove state change handler
   */
  removeStateChangeHandler(handler: (event: JobStateChangeEvent) => void): void {
    this.stateChangeHandlers.delete(handler);
  }

  /**
   * Emit state change event
   */
  private emitStateChange(event: JobStateChangeEvent): void {
    for (const handler of this.stateChangeHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('[JobQueueManager] State change handler error:', error);
      }
    }
  }

  /**
   * Get total number of queued jobs
   */
  private getTotalQueuedJobs(): number {
    let total = 0;
    for (const jobs of this.state.queuedJobs.values()) {
      total += jobs.length;
    }
    return total;
  }

  /**
   * Process next jobs if scheduler is enabled
   */
  private async processNextJobs(): Promise<void> {
    if (!this.schedulerConfig.enabled) return;

    try {
      while (this.canProcessMoreJobs()) {
        const nextJob = await this.getNextJob();
        if (!nextJob) break;

        // Job would be processed by the job coordinator
      }
    } catch (error) {
      console.error('[JobQueueManager] Error processing jobs:', error);
    }
  }

  /**
   * Start job scheduler
   */
  private startJobScheduler(): void {
    if (this.processingInterval) return;

    this.processingInterval = setInterval(() => {
      this.processNextJobs();
    }, this.schedulerConfig.schedulingInterval);
  }

  /**
   * Stop job scheduler
   */
  private stopJobScheduler(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    if (this.metricsInterval) return;

    this.metricsInterval = setInterval(() => {
      this.updateQueueMetrics();
    }, this.config.monitoring.metricsInterval);
  }

  /**
   * Stop metrics collection
   */
  private stopMetricsCollection(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  /**
   * Update queue metrics
   */
  private updateQueueMetrics(): void {
    this.state.resourceUsage.queueUtilization = (this.getTotalQueuedJobs() / this.config.maxSize) * 100;

    this.state.metrics.lastUpdated = new Date().toISOString();

    // Calculate jobs per hour
    const now = Date.now();
    const _hourAgo = now - 3600000;
    // This would require tracking job completion times
    // For now, use a simple calculation
    this.state.metrics.jobsPerHour = this.state.metrics.totalJobsProcessed;
  }

  /**
   * Cleanup old completed jobs
   */
  private cleanupCompletedJobs(): void {
    const maxCompleted = 50; // Keep last 50 completed jobs
    if (this.state.completedJobs.size > maxCompleted) {
      const sortedEntries = Array.from(this.state.completedJobs.entries()).sort((a, b) => {
        const timeA = new Date(a[1].executionContext.completedAt || 0).getTime();
        const timeB = new Date(b[1].executionContext.completedAt || 0).getTime();
        return timeB - timeA; // Most recent first
      });

      this.state.completedJobs.clear();
      sortedEntries.slice(0, maxCompleted).forEach(([jobId, job]) => {
        this.state.completedJobs.set(jobId, job);
      });
    }
  }

  /**
   * Create initial queue state
   */
  private createInitialState(): JobQueueState {
    return {
      config: this.config,
      queuedJobs: new Map([
        ['urgent', []],
        ['high', []],
        ['normal', []],
        ['low', []],
        ['idle', []],
      ]),
      processingJobs: new Map(),
      completedJobs: new Map(),
      failedJobs: new Map(),
      resourceUsage: {
        memoryUsage: 0,
        activeAPICalls: 0,
        usedProcessingSlots: 0,
        queueUtilization: 0,
      },
      metrics: {
        totalJobsProcessed: 0,
        jobsPerHour: 0,
        averageProcessingTime: 0,
        averageWaitTime: 0,
        successRate: 100,
        lastUpdated: new Date().toISOString(),
      },
    };
  }
}
