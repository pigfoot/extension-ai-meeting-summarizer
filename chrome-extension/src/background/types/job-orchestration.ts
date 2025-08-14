/**
 * Job orchestration types for background service coordination
 * Manages transcription job queuing, processing, and lifecycle management
 */

import type { TranscriptionJob } from '@extension/azure-speech';

/**
 * Job priority levels for queue ordering
 */
export type JobPriority =
  | 'urgent' // User-initiated immediate requests
  | 'high' // User-visible pending operations
  | 'normal' // Standard background processing
  | 'low' // Cleanup and maintenance tasks
  | 'idle'; // Background optimization when system idle

/**
 * Job processing status within orchestration system
 */
export type JobProcessingStatus =
  | 'queued' // Job is waiting in queue
  | 'allocated' // Job has been assigned resources
  | 'processing' // Job is actively being processed
  | 'waiting' // Job is waiting for external dependency
  | 'paused' // Job processing is temporarily suspended
  | 'completed' // Job finished successfully
  | 'failed' // Job failed and cannot be retried
  | 'cancelled' // Job was cancelled by user or system
  | 'expired'; // Job exceeded maximum processing time

/**
 * Resource allocation limits for concurrent processing
 */
export interface ProcessingLimits {
  /** Maximum number of concurrent jobs */
  maxConcurrentJobs: number;
  /** Maximum memory usage per job in MB */
  maxMemoryPerJob: number;
  /** Maximum total memory usage in MB */
  maxTotalMemory: number;
  /** Maximum API calls per minute */
  maxAPICallsPerMinute: number;
  /** Maximum job processing time in milliseconds */
  maxJobProcessingTime: number;
  /** Maximum queue size */
  maxQueueSize: number;
  /** Priority allocation ratios */
  priorityAllocations: {
    urgent: number;
    high: number;
    normal: number;
    low: number;
    idle: number;
  };
}

/**
 * Job execution context and metadata
 */
export interface JobExecutionContext {
  /** Job identifier */
  jobId: string;
  /** Job priority level */
  priority: JobPriority;
  /** Current processing status */
  status: JobProcessingStatus;
  /** Job creation timestamp (ISO 8601) */
  createdAt: string;
  /** Job queue entry timestamp (ISO 8601) */
  queuedAt: string;
  /** Job processing start timestamp (ISO 8601) */
  startedAt?: string;
  /** Job completion timestamp (ISO 8601) */
  completedAt?: string;
  /** Number of retry attempts */
  retryCount: number;
  /** Maximum allowed retries */
  maxRetries: number;
  /** Estimated completion time (ISO 8601) */
  estimatedCompletion?: string;
  /** Resource allocation for this job */
  allocatedResources: {
    memoryMB: number;
    apiQuota: number;
    processingSlots: number;
  };
  /** Job execution metadata */
  metadata: {
    /** Source component that created the job */
    source: string;
    /** User session identifier */
    sessionId?: string;
    /** Job dependencies */
    dependencies: string[];
    /** Job tags for categorization */
    tags: string[];
  };
}

/**
 * Enhanced transcription job with orchestration context
 */
export interface OrchestrationJob extends TranscriptionJob {
  /** Orchestration-specific execution context */
  executionContext: JobExecutionContext;
  /** Job processing callbacks */
  callbacks: {
    /** Progress update callback */
    onProgress?: (progress: number, context: JobExecutionContext) => void;
    /** Completion callback */
    onComplete?: (result: unknown, context: JobExecutionContext) => void;
    /** Error callback */
    onError?: (error: Error, context: JobExecutionContext) => void;
    /** Cancellation callback */
    onCancel?: (reason: string, context: JobExecutionContext) => void;
  };
  /** External dependencies this job requires */
  dependencies: {
    /** Azure API access requirements */
    azureAPI: boolean;
    /** Storage access requirements */
    storage: boolean;
    /** Network connectivity requirements */
    network: boolean;
    /** Specific service dependencies */
    services: string[];
  };
}

/**
 * Job queue configuration and management
 */
export interface JobQueueConfig {
  /** Queue identifier */
  queueId: string;
  /** Queue processing mode */
  mode: 'fifo' | 'priority' | 'round_robin' | 'shortest_job_first';
  /** Maximum queue size */
  maxSize: number;
  /** Queue processing limits */
  processingLimits: ProcessingLimits;
  /** Queue persistence settings */
  persistence: {
    /** Enable queue persistence across restarts */
    enabled: boolean;
    /** Storage key for queue persistence */
    storageKey: string;
    /** Persistence interval in milliseconds */
    persistenceInterval: number;
    /** Maximum persisted queue size */
    maxPersistedSize: number;
  };
  /** Queue monitoring configuration */
  monitoring: {
    /** Enable queue performance monitoring */
    enabled: boolean;
    /** Metrics collection interval in milliseconds */
    metricsInterval: number;
    /** Enable queue health checks */
    enableHealthChecks: boolean;
  };
}

/**
 * Job queue operational state
 */
export interface JobQueueState {
  /** Queue configuration */
  config: JobQueueConfig;
  /** Jobs currently in queue by priority */
  queuedJobs: Map<JobPriority, OrchestrationJob[]>;
  /** Jobs currently being processed */
  processingJobs: Map<string, OrchestrationJob>;
  /** Completed jobs (limited history) */
  completedJobs: Map<string, OrchestrationJob>;
  /** Failed jobs for analysis */
  failedJobs: Map<string, OrchestrationJob>;
  /** Current resource usage */
  resourceUsage: {
    /** Current memory usage in MB */
    memoryUsage: number;
    /** Active API calls count */
    activeAPICalls: number;
    /** Processing slots in use */
    usedProcessingSlots: number;
    /** Queue utilization percentage */
    queueUtilization: number;
  };
  /** Queue performance metrics */
  metrics: {
    /** Total jobs processed */
    totalJobsProcessed: number;
    /** Jobs processed per hour */
    jobsPerHour: number;
    /** Average processing time in milliseconds */
    averageProcessingTime: number;
    /** Current queue wait time in milliseconds */
    averageWaitTime: number;
    /** Success rate percentage */
    successRate: number;
    /** Last metrics update timestamp (ISO 8601) */
    lastUpdated: string;
  };
}

/**
 * Job scheduler configuration for background processing
 */
export interface JobSchedulerConfig {
  /** Scheduler identifier */
  schedulerId: string;
  /** Enable automatic job scheduling */
  enabled: boolean;
  /** Scheduling algorithm */
  algorithm: 'round_robin' | 'least_loaded' | 'priority_weighted' | 'fair_share';
  /** Scheduling interval in milliseconds */
  schedulingInterval: number;
  /** Load balancing strategy */
  loadBalancing: {
    /** Enable dynamic load balancing */
    enabled: boolean;
    /** Load threshold for job redistribution */
    loadThreshold: number;
    /** Rebalancing frequency in milliseconds */
    rebalanceInterval: number;
  };
  /** Resource management settings */
  resourceManagement: {
    /** Enable dynamic resource allocation */
    dynamicAllocation: boolean;
    /** Resource allocation algorithm */
    allocationAlgorithm: 'first_fit' | 'best_fit' | 'worst_fit';
    /** Resource reclamation timeout in milliseconds */
    reclamationTimeout: number;
  };
}

/**
 * Job progress tracking information
 */
export interface JobProgressInfo {
  /** Job identifier */
  jobId: string;
  /** Current progress percentage (0-100) */
  progressPercentage: number;
  /** Current processing stage */
  currentStage: string;
  /** Estimated remaining time in milliseconds */
  estimatedRemainingTime: number;
  /** Processing throughput (items/second) */
  throughput: number;
  /** Last progress update timestamp (ISO 8601) */
  lastUpdate: string;
  /** Stage-specific progress details */
  stageProgress: {
    /** Current stage name */
    stage: string;
    /** Stage progress percentage */
    percentage: number;
    /** Stage start time (ISO 8601) */
    startTime: string;
    /** Estimated stage completion time (ISO 8601) */
    estimatedCompletion?: string;
  }[];
}

/**
 * Job orchestration error information
 */
export interface JobOrchestrationError {
  /** Error identifier */
  errorId: string;
  /** Job identifier that encountered error */
  jobId: string;
  /** Error type classification */
  type: 'queue_full' | 'resource_exhausted' | 'dependency_failed' | 'timeout' | 'internal_error' | 'external_api_error';
  /** Error severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Error message */
  message: string;
  /** Detailed error information */
  details: {
    /** Stack trace if available */
    stack?: string;
    /** Error context */
    context: Record<string, unknown>;
    /** Recovery suggestions */
    recoverySuggestions: string[];
  };
  /** Error timestamp (ISO 8601) */
  timestamp: string;
  /** Whether error is recoverable */
  recoverable: boolean;
  /** Retry configuration for recoverable errors */
  retryConfig?: {
    /** Maximum retry attempts */
    maxRetries: number;
    /** Retry delay in milliseconds */
    retryDelay: number;
    /** Exponential backoff factor */
    backoffFactor: number;
  };
}

/**
 * Job orchestration performance metrics
 */
export interface OrchestrationMetrics {
  /** Total jobs processed */
  totalJobs: number;
  /** Jobs by status */
  jobsByStatus: Record<JobProcessingStatus, number>;
  /** Jobs by priority */
  jobsByPriority: Record<JobPriority, number>;
  /** Average processing times by priority */
  avgProcessingTimes: Record<JobPriority, number>;
  /** Resource utilization metrics */
  resourceUtilization: {
    /** Memory utilization percentage */
    memory: number;
    /** API quota utilization percentage */
    apiQuota: number;
    /** Processing slot utilization percentage */
    processingSlots: number;
  };
  /** Error metrics */
  errors: {
    /** Total error count */
    total: number;
    /** Errors by type */
    byType: Record<JobOrchestrationError['type'], number>;
    /** Error rate percentage */
    errorRate: number;
  };
  /** Performance metrics */
  performance: {
    /** Jobs processed per hour */
    jobsPerHour: number;
    /** Average queue wait time in milliseconds */
    avgWaitTime: number;
    /** 95th percentile processing time in milliseconds */
    p95ProcessingTime: number;
    /** System throughput (jobs/minute) */
    throughput: number;
  };
  /** Last metrics update timestamp (ISO 8601) */
  lastUpdated: string;
}

/**
 * Job dependency resolution information
 */
export interface JobDependency {
  /** Dependency identifier */
  dependencyId: string;
  /** Dependency type */
  type: 'service' | 'resource' | 'data' | 'configuration' | 'external_api';
  /** Dependency name */
  name: string;
  /** Current dependency status */
  status: 'available' | 'unavailable' | 'degraded' | 'unknown';
  /** Last dependency check timestamp (ISO 8601) */
  lastCheck: string;
  /** Dependency health metrics */
  health: {
    /** Availability percentage */
    availability: number;
    /** Response time in milliseconds */
    responseTime: number;
    /** Error rate percentage */
    errorRate: number;
  };
  /** Retry configuration for failed dependencies */
  retryConfig: {
    /** Maximum retry attempts */
    maxRetries: number;
    /** Retry interval in milliseconds */
    retryInterval: number;
    /** Dependency timeout in milliseconds */
    timeout: number;
  };
}

/**
 * Job orchestration coordinator interface
 */
export interface JobOrchestrator {
  /** Submit a new job to the orchestration system */
  submitJob(job: OrchestrationJob): Promise<string>;
  /** Cancel a job by ID */
  cancelJob(jobId: string, reason: string): Promise<boolean>;
  /** Get job status and progress */
  getJobStatus(jobId: string): Promise<JobProgressInfo | undefined>;
  /** Get all jobs by status */
  getJobsByStatus(status: JobProcessingStatus): Promise<OrchestrationJob[]>;
  /** Get queue metrics and statistics */
  getMetrics(): Promise<OrchestrationMetrics>;
  /** Update processing limits */
  updateLimits(limits: Partial<ProcessingLimits>): Promise<void>;
  /** Pause job processing */
  pauseProcessing(): Promise<void>;
  /** Resume job processing */
  resumeProcessing(): Promise<void>;
  /** Get system health status */
  getHealthStatus(): Promise<{ healthy: boolean; issues: string[] }>;
}
