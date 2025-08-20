/**
 * Job tracker for monitoring transcription job progress and status
 * Handles job lifecycle events, status transitions, and progress monitoring
 */

import type { JobProcessingStatus, OrchestrationJob, JobProgressInfo, JobOrchestrationError } from '../types';

/**
 * Job status change event
 */
export interface JobStatusChangeEvent {
  /** Job identifier */
  jobId: string;
  /** Previous status */
  previousStatus: JobProcessingStatus;
  /** New status */
  newStatus: JobProcessingStatus;
  /** Change timestamp */
  timestamp: string;
  /** Change reason */
  reason?: string;
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Job progress update event
 */
export interface JobProgressUpdateEvent {
  /** Job identifier */
  jobId: string;
  /** Progress percentage (0-100) */
  progress: number;
  /** Current processing stage */
  stage: string;
  /** Stage-specific details */
  stageDetails?: Record<string, unknown>;
  /** Estimated remaining time in milliseconds */
  estimatedRemainingTime?: number;
  /** Update timestamp */
  timestamp: string;
}

/**
 * Job lifecycle event
 */
export interface JobLifecycleEvent {
  /** Event type */
  type: 'created' | 'queued' | 'started' | 'progress' | 'completed' | 'failed' | 'cancelled' | 'timeout';
  /** Job identifier */
  jobId: string;
  /** Event timestamp */
  timestamp: string;
  /** Event data */
  data?: Record<string, unknown>;
}

/**
 * Job tracking configuration
 */
export interface JobTrackingConfig {
  /** Enable detailed progress tracking */
  enableProgressTracking: boolean;
  /** Progress update interval in milliseconds */
  progressUpdateInterval: number;
  /** Enable job lifecycle event logging */
  enableEventLogging: boolean;
  /** Maximum number of events to keep per job */
  maxEventsPerJob: number;
  /** Enable performance metrics collection */
  enablePerformanceMetrics: boolean;
  /** Job timeout settings */
  timeouts: {
    /** Default job timeout in milliseconds */
    defaultTimeout: number;
    /** Timeout per priority level */
    priorityTimeouts: Record<string, number>;
  };
}

/**
 * Job tracking statistics
 */
export interface JobTrackingStats {
  /** Total jobs tracked */
  totalJobs: number;
  /** Jobs by status */
  jobsByStatus: Record<JobProcessingStatus, number>;
  /** Average job duration by priority */
  avgDurationByPriority: Record<string, number>;
  /** Success rate percentage */
  successRate: number;
  /** Most common failure reasons */
  commonFailures: Array<{
    reason: string;
    count: number;
  }>;
  /** Performance metrics */
  performance: {
    /** Average response time */
    avgResponseTime: number;
    /** Throughput (jobs per hour) */
    throughput: number;
    /** Resource utilization percentage */
    resourceUtilization: number;
  };
  /** Last update timestamp */
  lastUpdated: string;
}

/**
 * Job tracker for comprehensive job monitoring
 */
export class JobTracker {
  private config: JobTrackingConfig;
  private trackedJobs = new Map<string, OrchestrationJob>();
  private jobEvents = new Map<string, JobLifecycleEvent[]>();
  private jobProgress = new Map<string, JobProgressInfo>();
  private statusChangeHandlers = new Set<(event: JobStatusChangeEvent) => void>();
  private progressUpdateHandlers = new Set<(event: JobProgressUpdateEvent) => void>();
  private lifecycleEventHandlers = new Set<(event: JobLifecycleEvent) => void>();
  private progressUpdateInterval: NodeJS.Timeout | null = null;
  private stats: JobTrackingStats;

  constructor(config: JobTrackingConfig) {
    this.config = config;
    this.stats = this.initializeStats();

    if (this.config.enableProgressTracking) {
      this.startProgressTracking();
    }
  }

  /**
   * Start tracking a job
   */
  startTracking(job: OrchestrationJob): void {
    this.trackedJobs.set(job.jobId, job);
    this.jobEvents.set(job.jobId, []);
    this.initializeJobProgress(job);

    this.recordLifecycleEvent({
      type: 'created',
      jobId: job.jobId,
      timestamp: new Date().toISOString(),
      data: {
        priority: job.executionContext.priority,
        audioUrl: job.audioUrl,
      },
    });

    console.log(`[JobTracker] Started tracking job: ${job.jobId}`);
  }

  /**
   * Stop tracking a job
   */
  stopTracking(jobId: string): void {
    const job = this.trackedJobs.get(jobId);
    if (!job) return;

    // Only stop tracking if job is in a final state
    const finalStates: JobProcessingStatus[] = ['completed', 'failed', 'cancelled'];
    if (!finalStates.includes(job.executionContext.status)) {
      console.warn(
        `[JobTracker] Attempted to stop tracking job ${jobId} in non-final state: ${job.executionContext.status}`,
      );
      return;
    }

    console.log(`[JobTracker] Stopping tracking for job ${jobId} (status: ${job.executionContext.status})`);
    this.trackedJobs.delete(jobId);
    this.jobProgress.delete(jobId);

    // Keep events for completed/failed jobs, clean up for cancelled
    if (job.executionContext.status === 'cancelled') {
      this.jobEvents.delete(jobId);
    }
  }

  /**
   * Update job status
   */
  updateJobStatus(
    jobId: string,
    newStatus: JobProcessingStatus,
    reason?: string,
    context?: Record<string, unknown>,
  ): void {
    const job = this.trackedJobs.get(jobId);
    if (!job) {
      console.warn(`[JobTracker] Cannot update status for unknown job: ${jobId}`);
      return;
    }

    const previousStatus = job.executionContext.status;
    job.executionContext.status = newStatus;

    // Record status change event
    const statusChangeEvent: JobStatusChangeEvent = {
      jobId,
      previousStatus,
      newStatus,
      timestamp: new Date().toISOString(),
      reason,
      context,
    };

    this.emitStatusChange(statusChangeEvent);

    // Record lifecycle event
    const lifecycleType = this.getLifecycleEventType(newStatus);
    if (lifecycleType) {
      this.recordLifecycleEvent({
        type: lifecycleType,
        jobId,
        timestamp: new Date().toISOString(),
        data: { reason, context },
      });
    }

    // Update statistics
    this.updateStats();

    console.log(`[JobTracker] Job ${jobId} status changed: ${previousStatus} -> ${newStatus}`);
  }

  /**
   * Update job progress
   */
  updateJobProgress(
    jobId: string,
    progress: number,
    stage: string,
    stageDetails?: Record<string, unknown>,
    estimatedRemainingTime?: number,
  ): void {
    const job = this.trackedJobs.get(jobId);
    if (!job) return;

    const progressInfo: JobProgressInfo = {
      jobId,
      progressPercentage: Math.max(0, Math.min(100, progress)),
      currentStage: stage,
      estimatedRemainingTime: estimatedRemainingTime || 0,
      throughput: 0, // Would be calculated based on actual processing
      lastUpdate: new Date().toISOString(),
      stageProgress: [
        {
          stage,
          percentage: progress,
          startTime: new Date().toISOString(),
          estimatedCompletion: estimatedRemainingTime
            ? new Date(Date.now() + estimatedRemainingTime).toISOString()
            : undefined,
        },
      ],
    };

    this.jobProgress.set(jobId, progressInfo);

    // Emit progress update event
    const progressEvent: JobProgressUpdateEvent = {
      jobId,
      progress,
      stage,
      stageDetails,
      estimatedRemainingTime,
      timestamp: new Date().toISOString(),
    };

    this.emitProgressUpdate(progressEvent);

    // Record lifecycle event for significant progress milestones
    if (progress === 0 || progress === 100 || progress % 25 === 0) {
      this.recordLifecycleEvent({
        type: 'progress',
        jobId,
        timestamp: new Date().toISOString(),
        data: { progress, stage },
      });
    }

    console.log(`[JobTracker] Job ${jobId} progress: ${progress}% (${stage})`);
  }

  /**
   * Record job error
   */
  recordJobError(jobId: string, error: JobOrchestrationError): void {
    const job = this.trackedJobs.get(jobId);
    if (!job) return;

    this.recordLifecycleEvent({
      type: 'failed',
      jobId,
      timestamp: new Date().toISOString(),
      data: {
        errorType: error.type,
        errorMessage: error.message,
        severity: error.severity,
        recoverable: error.recoverable,
      },
    });

    console.log(`[JobTracker] Job ${jobId} error recorded: ${error.message}`);
  }

  /**
   * Get job progress information
   */
  getJobProgress(jobId: string): JobProgressInfo | undefined {
    return this.jobProgress.get(jobId);
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): OrchestrationJob | undefined {
    return this.trackedJobs.get(jobId);
  }

  /**
   * Get jobs by status
   */
  getJobsByStatus(status: JobProcessingStatus): OrchestrationJob[] {
    return Array.from(this.trackedJobs.values()).filter(job => job.executionContext.status === status);
  }

  /**
   * Get job events
   */
  getJobEvents(jobId: string): JobLifecycleEvent[] {
    return this.jobEvents.get(jobId) || [];
  }

  /**
   * Get all tracked jobs
   */
  getAllJobs(): OrchestrationJob[] {
    const jobs = Array.from(this.trackedJobs.values());

    // Debug logging for state sync diagnosis
    console.log('[JobTracker] getAllJobs() called:', {
      totalTracked: jobs.length,
      jobStatuses: jobs.map(job => ({
        id: job.jobId,
        status: job.executionContext.status,
        startedAt: job.executionContext.startedAt,
      })),
      mapSize: this.trackedJobs.size,
    });

    return jobs;
  }

  /**
   * Get tracking statistics
   */
  getStats(): JobTrackingStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Register status change handler
   */
  onStatusChange(handler: (event: JobStatusChangeEvent) => void): void {
    this.statusChangeHandlers.add(handler);
  }

  /**
   * Register progress update handler
   */
  onProgressUpdate(handler: (event: JobProgressUpdateEvent) => void): void {
    this.progressUpdateHandlers.add(handler);
  }

  /**
   * Register lifecycle event handler
   */
  onLifecycleEvent(handler: (event: JobLifecycleEvent) => void): void {
    this.lifecycleEventHandlers.add(handler);
  }

  /**
   * Remove event handlers
   */
  removeStatusChangeHandler(handler: (event: JobStatusChangeEvent) => void): void {
    this.statusChangeHandlers.delete(handler);
  }

  removeProgressUpdateHandler(handler: (event: JobProgressUpdateEvent) => void): void {
    this.progressUpdateHandlers.delete(handler);
  }

  removeLifecycleEventHandler(handler: (event: JobLifecycleEvent) => void): void {
    this.lifecycleEventHandlers.delete(handler);
  }

  /**
   * Clean up tracking data
   */
  cleanup(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [jobId, job] of this.trackedJobs) {
      const jobAge = now - new Date(job.executionContext.createdAt).getTime();

      if (
        jobAge > maxAge &&
        (job.executionContext.status === 'completed' ||
          job.executionContext.status === 'failed' ||
          job.executionContext.status === 'cancelled')
      ) {
        this.stopTracking(jobId);
      }
    }

    console.log('[JobTracker] Cleanup completed');
  }

  /**
   * Shutdown the job tracker
   */
  shutdown(): void {
    if (this.progressUpdateInterval) {
      clearInterval(this.progressUpdateInterval);
      this.progressUpdateInterval = null;
    }

    this.statusChangeHandlers.clear();
    this.progressUpdateHandlers.clear();
    this.lifecycleEventHandlers.clear();

    console.log('[JobTracker] Shutdown completed');
  }

  /**
   * Initialize job progress tracking
   */
  private initializeJobProgress(job: OrchestrationJob): void {
    const progressInfo: JobProgressInfo = {
      jobId: job.jobId,
      progressPercentage: 0,
      currentStage: 'initializing',
      estimatedRemainingTime: 0,
      throughput: 0,
      lastUpdate: new Date().toISOString(),
      stageProgress: [
        {
          stage: 'initializing',
          percentage: 0,
          startTime: new Date().toISOString(),
        },
      ],
    };

    this.jobProgress.set(job.jobId, progressInfo);
  }

  /**
   * Start progress tracking
   */
  private startProgressTracking(): void {
    if (this.progressUpdateInterval) return;

    this.progressUpdateInterval = setInterval(() => {
      this.updateJobTimeouts();
    }, this.config.progressUpdateInterval);
  }

  /**
   * Update job timeouts and detect stalled jobs
   */
  private updateJobTimeouts(): void {
    const now = Date.now();

    for (const [jobId, job] of this.trackedJobs) {
      const timeout = this.getJobTimeout(job);
      const startTime = new Date(job.executionContext.startedAt || job.executionContext.createdAt).getTime();

      if (job.executionContext.status === 'processing' && now - startTime > timeout) {
        this.recordLifecycleEvent({
          type: 'timeout',
          jobId,
          timestamp: new Date().toISOString(),
          data: { timeout, duration: now - startTime },
        });

        console.warn(`[JobTracker] Job ${jobId} timed out after ${timeout}ms`);
      }
    }
  }

  /**
   * Get job timeout based on priority
   */
  private getJobTimeout(job: OrchestrationJob): number {
    const priorityTimeout = this.config.timeouts.priorityTimeouts[job.executionContext.priority];
    return priorityTimeout || this.config.timeouts.defaultTimeout;
  }

  /**
   * Record lifecycle event
   */
  private recordLifecycleEvent(event: JobLifecycleEvent): void {
    if (!this.config.enableEventLogging) return;

    const events = this.jobEvents.get(event.jobId) || [];
    events.push(event);

    // Limit number of events per job
    if (events.length > this.config.maxEventsPerJob) {
      events.splice(0, events.length - this.config.maxEventsPerJob);
    }

    this.jobEvents.set(event.jobId, events);

    // Emit to handlers
    this.emitLifecycleEvent(event);
  }

  /**
   * Get lifecycle event type from job status
   */
  private getLifecycleEventType(status: JobProcessingStatus): JobLifecycleEvent['type'] | null {
    switch (status) {
      case 'queued':
        return 'queued';
      case 'processing':
        return 'started';
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      case 'cancelled':
        return 'cancelled';
      default:
        return null;
    }
  }

  /**
   * Emit status change event
   */
  private emitStatusChange(event: JobStatusChangeEvent): void {
    for (const handler of this.statusChangeHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('[JobTracker] Status change handler error:', error);
      }
    }
  }

  /**
   * Emit progress update event
   */
  private emitProgressUpdate(event: JobProgressUpdateEvent): void {
    for (const handler of this.progressUpdateHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('[JobTracker] Progress update handler error:', error);
      }
    }
  }

  /**
   * Emit lifecycle event
   */
  private emitLifecycleEvent(event: JobLifecycleEvent): void {
    for (const handler of this.lifecycleEventHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('[JobTracker] Lifecycle event handler error:', error);
      }
    }
  }

  /**
   * Update statistics
   */
  private updateStats(): void {
    const jobs = Array.from(this.trackedJobs.values());

    this.stats.totalJobs = jobs.length;
    this.stats.lastUpdated = new Date().toISOString();

    // Count jobs by status
    const statusCounts: Record<JobProcessingStatus, number> = {
      queued: 0,
      allocated: 0,
      processing: 0,
      waiting: 0,
      paused: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      expired: 0,
    };

    for (const job of jobs) {
      statusCounts[job.executionContext.status]++;
    }

    this.stats.jobsByStatus = statusCounts;

    // Calculate success rate
    const completedJobs = statusCounts.completed;
    const failedJobs = statusCounts.failed + statusCounts.cancelled + statusCounts.expired;
    const totalFinished = completedJobs + failedJobs;

    this.stats.successRate = totalFinished > 0 ? (completedJobs / totalFinished) * 100 : 100;

    // Update performance metrics
    this.updatePerformanceMetrics(jobs);
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(jobs: OrchestrationJob[]): void {
    if (!this.config.enablePerformanceMetrics) return;

    const completedJobs = jobs.filter(job => job.executionContext.status === 'completed');

    if (completedJobs.length > 0) {
      const totalDuration = completedJobs.reduce((sum, job) => {
        const startTime = new Date(job.executionContext.startedAt || job.executionContext.createdAt).getTime();
        const endTime = new Date(job.executionContext.completedAt || Date.now()).getTime();
        return sum + (endTime - startTime);
      }, 0);

      this.stats.performance.avgResponseTime = totalDuration / completedJobs.length;

      // Calculate throughput (jobs per hour)
      const now = Date.now();
      const recentJobs = completedJobs.filter(job => {
        const completedTime = new Date(job.executionContext.completedAt || 0).getTime();
        return now - completedTime < 3600000; // Last hour
      });

      this.stats.performance.throughput = recentJobs.length;
    }

    // Resource utilization would require integration with resource monitoring
    this.stats.performance.resourceUtilization = 0; // Placeholder
  }

  /**
   * Initialize statistics
   */
  private initializeStats(): JobTrackingStats {
    return {
      totalJobs: 0,
      jobsByStatus: {
        queued: 0,
        allocated: 0,
        processing: 0,
        waiting: 0,
        paused: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        expired: 0,
      },
      avgDurationByPriority: {
        urgent: 0,
        high: 0,
        normal: 0,
        low: 0,
        idle: 0,
      },
      successRate: 100,
      commonFailures: [],
      performance: {
        avgResponseTime: 0,
        throughput: 0,
        resourceUtilization: 0,
      },
      lastUpdated: new Date().toISOString(),
    };
  }
}
