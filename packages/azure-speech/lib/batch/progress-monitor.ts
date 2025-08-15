/**
 * Azure Speech batch transcription progress monitor
 * Monitors job status with intelligent polling and progress estimation
 * for Azure batch transcription jobs
 */

import type { AuthConfig } from '../types/auth';
import type {
  TranscriptionJob,
  BatchTranscriptionJob,
  BatchJobStatus,
  TranscriptionJobStatus,
  AzureRegion,
  ErrorDetails,
} from '../types/index';

/**
 * Progress monitoring error types
 */
export type ProgressMonitorErrorType =
  | 'JOB_NOT_FOUND'
  | 'AUTHENTICATION_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'QUOTA_EXCEEDED'
  | 'SERVICE_UNAVAILABLE'
  | 'INVALID_JOB_ID'
  | 'MONITORING_DISABLED'
  | 'UNKNOWN_ERROR';

/**
 * Progress monitoring error
 */
export interface ProgressMonitorError {
  /** Error type */
  type: ProgressMonitorErrorType;
  /** Error message */
  message: string;
  /** HTTP status code if applicable */
  statusCode?: number;
  /** Azure error details */
  azureError?: ErrorDetails;
  /** Whether the error is retryable */
  retryable: boolean;
  /** Suggested retry delay in milliseconds */
  retryAfter?: number;
  /** Error timestamp */
  timestamp: Date;
}

/**
 * Job progress information
 */
export interface JobProgress {
  /** Job ID */
  jobId: string;
  /** Azure job ID */
  azureJobId: string;
  /** Current job status */
  status: TranscriptionJobStatus;
  /** Progress percentage (0-100) */
  progress: number;
  /** Estimated completion time */
  estimatedCompletionTime?: Date;
  /** Estimated remaining time in seconds */
  estimatedRemainingTime?: number;
  /** Last update timestamp */
  lastUpdated: Date;
  /** Processing statistics */
  statistics: {
    /** Total polling attempts */
    pollAttempts: number;
    /** Time since job submission */
    elapsedTime: number;
    /** Average processing time per minute of audio */
    averageProcessingRate?: number;
    /** Job start time */
    jobStartTime?: Date;
  };
}

/**
 * Progress monitoring result
 */
export interface ProgressMonitorResult {
  /** Whether monitoring was successful */
  success: boolean;
  /** Job progress information */
  progress?: JobProgress;
  /** Azure batch job details */
  azureJob?: BatchTranscriptionJob;
  /** Monitoring error if failed */
  error?: ProgressMonitorError;
  /** Response time in milliseconds */
  responseTime: number;
  /** Monitor timestamp */
  monitoredAt: Date;
}

/**
 * Progress monitoring configuration
 */
export interface ProgressMonitorConfig {
  /** Base polling interval in milliseconds */
  basePollInterval: number;
  /** Maximum polling interval in milliseconds */
  maxPollInterval: number;
  /** Maximum number of polling attempts */
  maxPollAttempts: number;
  /** Request timeout in milliseconds */
  timeout: number;
  /** Enable adaptive polling based on job progress */
  enableAdaptivePolling: boolean;
  /** Progress estimation algorithm */
  progressEstimation: 'linear' | 'exponential' | 'adaptive';
  /** Maximum job duration for timeout detection (ms) */
  maxJobDuration: number;
}

/**
 * Progress monitoring callback
 */
export type ProgressCallback = (progress: JobProgress) => void;

/**
 * Status change callback
 */
export type StatusChangeCallback = (
  oldStatus: TranscriptionJobStatus,
  newStatus: TranscriptionJobStatus,
  progress: JobProgress,
) => void;

/**
 * Default monitoring configuration
 */
const DEFAULT_MONITOR_CONFIG: ProgressMonitorConfig = {
  basePollInterval: 5000,
  maxPollInterval: 60000,
  maxPollAttempts: 720, // 6 hours with 30s intervals
  timeout: 30000,
  enableAdaptivePolling: true,
  progressEstimation: 'adaptive',
  maxJobDuration: 4 * 60 * 60 * 1000, // 4 hours
};

/**
 * Azure Speech batch transcription endpoints by region
 */
const BATCH_TRANSCRIPTION_ENDPOINTS: Record<AzureRegion, string> = {
  eastus: 'https://eastus.api.cognitive.microsoft.com',
  eastus2: 'https://eastus2.api.cognitive.microsoft.com',
  westus: 'https://westus.api.cognitive.microsoft.com',
  westus2: 'https://westus2.api.cognitive.microsoft.com',
  westus3: 'https://westus3.api.cognitive.microsoft.com',
  centralus: 'https://centralus.api.cognitive.microsoft.com',
  northcentralus: 'https://northcentralus.api.cognitive.microsoft.com',
  southcentralus: 'https://southcentralus.api.cognitive.microsoft.com',
  westcentralus: 'https://westcentralus.api.cognitive.microsoft.com',
  northeurope: 'https://northeurope.api.cognitive.microsoft.com',
  westeurope: 'https://westeurope.api.cognitive.microsoft.com',
  uksouth: 'https://uksouth.api.cognitive.microsoft.com',
  ukwest: 'https://ukwest.api.cognitive.microsoft.com',
  francecentral: 'https://francecentral.api.cognitive.microsoft.com',
  germanynorth: 'https://germanynorth.api.cognitive.microsoft.com',
  swedencentral: 'https://swedencentral.api.cognitive.microsoft.com',
  switzerlandnorth: 'https://switzerlandnorth.api.cognitive.microsoft.com',
  southeastasia: 'https://southeastasia.api.cognitive.microsoft.com',
  eastasia: 'https://eastasia.api.cognitive.microsoft.com',
  australiaeast: 'https://australiaeast.api.cognitive.microsoft.com',
  australiasoutheast: 'https://australiasoutheast.api.cognitive.microsoft.com',
  centralindia: 'https://centralindia.api.cognitive.microsoft.com',
  japaneast: 'https://japaneast.api.cognitive.microsoft.com',
  japanwest: 'https://japanwest.api.cognitive.microsoft.com',
  koreacentral: 'https://koreacentral.api.cognitive.microsoft.com',
  canadacentral: 'https://canadacentral.api.cognitive.microsoft.com',
  brazilsouth: 'https://brazilsouth.api.cognitive.microsoft.com',
  southafricanorth: 'https://southafricanorth.api.cognitive.microsoft.com',
  uaenorth: 'https://uaenorth.api.cognitive.microsoft.com',
};

/**
 * Progress tracking statistics
 */
interface ProgressStatistics {
  /** Job start time */
  startTime: Date;
  /** Last status check time */
  lastCheckTime: Date;
  /** Number of status checks performed */
  checkCount: number;
  /** Status transitions */
  statusTransitions: {
    from: TranscriptionJobStatus;
    to: TranscriptionJobStatus;
    timestamp: Date;
  }[];
  /** Progress updates */
  progressUpdates: {
    progress: number;
    timestamp: Date;
    estimatedCompletion?: Date;
  }[];
}

/**
 * Create progress monitor error
 */
const createProgressMonitorError = (
  type: ProgressMonitorErrorType,
  message: string,
  statusCode?: number,
  retryable: boolean = false,
  retryAfter?: number,
  azureError?: ErrorDetails,
): ProgressMonitorError => ({
  type,
  message,
  retryable,
  timestamp: new Date(),
  ...(statusCode !== undefined && { statusCode }),
  ...(azureError && { azureError }),
  ...(retryAfter !== undefined && { retryAfter }),
});

/**
 * Calculate adaptive polling interval
 */
const calculateAdaptiveInterval = (
  baseInterval: number,
  maxInterval: number,
  currentProgress: number,
  checkCount: number,
  jobStatus: TranscriptionJobStatus,
): number => {
  // Start with base interval
  let interval = baseInterval;

  // Adjust based on job status
  switch (jobStatus) {
    case 'submitted':
    case 'pending':
      // Poll more frequently for new jobs
      interval = baseInterval;
      break;
    case 'processing':
      // Adaptive interval based on progress
      if (currentProgress < 10) {
        interval = baseInterval * 1.5; // Slower polling for early stages
      } else if (currentProgress > 80) {
        interval = baseInterval * 0.8; // Faster polling near completion
      } else {
        interval = baseInterval;
      }
      break;
    case 'completed':
    case 'failed':
    case 'cancelled':
      // No need to poll finished jobs
      return 0;
  }

  // Add exponential backoff for many checks
  if (checkCount > 10) {
    const backoffMultiplier = Math.min(Math.pow(1.2, Math.floor(checkCount / 10)), 4);
    interval *= backoffMultiplier;
  }

  // Apply jitter to prevent thundering herd
  const jitter = Math.random() * 0.1 * interval;
  interval += jitter;

  return Math.min(interval, maxInterval);
};

/**
 * Estimate progress based on job status and time elapsed
 */
const estimateProgress = (status: BatchJobStatus, elapsedTime: number, estimatedDuration?: number): number => {
  switch (status) {
    case 'NotStarted':
      return 0;
    case 'Running':
      if (estimatedDuration) {
        // Linear progress estimation based on elapsed time
        const linearProgress = Math.min((elapsedTime / estimatedDuration) * 100, 95);
        return Math.max(linearProgress, 5); // Ensure some progress is shown
      } else {
        // Default progress estimation for running jobs
        const minutes = elapsedTime / (1000 * 60);
        if (minutes < 1) return 5;
        if (minutes < 5) return 15;
        if (minutes < 15) return 35;
        if (minutes < 30) return 60;
        return Math.min(80, 60 + (minutes - 30) * 0.5);
      }
    case 'Succeeded':
      return 100;
    case 'Failed':
    case 'Cancelled':
      return 0;
    default:
      return 0;
  }
};

/**
 * Estimate completion time
 */
const estimateCompletionTime = (
  startTime: Date,
  currentProgress: number,
  status: TranscriptionJobStatus,
): Date | undefined => {
  if (status === 'completed' || currentProgress >= 100) {
    return new Date();
  }

  if (currentProgress <= 0 || status === 'failed' || status === 'cancelled') {
    return undefined;
  }

  const elapsedTime = Date.now() - startTime.getTime();
  const estimatedTotalTime = (elapsedTime / currentProgress) * 100;
  const remainingTime = estimatedTotalTime - elapsedTime;

  return new Date(Date.now() + remainingTime);
};

/**
 * Map Azure job status to our job status
 */
const mapAzureJobStatus = (azureStatus: BatchJobStatus): TranscriptionJobStatus => {
  switch (azureStatus) {
    case 'NotStarted':
      return 'submitted';
    case 'Running':
      return 'processing';
    case 'Succeeded':
      return 'completed';
    case 'Failed':
      return 'failed';
    case 'Cancelled':
      return 'cancelled';
    default:
      return 'submitted';
  }
};

/**
 * Azure Speech batch transcription progress monitor
 */
export class ProgressMonitor {
  private authConfig: AuthConfig;
  private monitorConfig: ProgressMonitorConfig;
  private accessToken: string | null = null;
  private activeMonitors = new Map<
    string,
    {
      jobId: string;
      intervalId: NodeJS.Timeout;
      statistics: ProgressStatistics;
      callbacks: {
        progress: ProgressCallback[];
        statusChange: StatusChangeCallback[];
      };
    }
  >();

  constructor(authConfig: AuthConfig, monitorConfig?: Partial<ProgressMonitorConfig>) {
    this.authConfig = authConfig;
    this.monitorConfig = { ...DEFAULT_MONITOR_CONFIG, ...monitorConfig };
  }

  /**
   * Start monitoring a transcription job
   */
  async startMonitoring(
    job: TranscriptionJob,
    accessToken?: string,
    onProgress?: ProgressCallback,
    onStatusChange?: StatusChangeCallback,
  ): Promise<ProgressMonitorResult> {
    if (!job.azureJobId) {
      const error = createProgressMonitorError('INVALID_JOB_ID', 'Job does not have an Azure job ID');

      return {
        success: false,
        error,
        responseTime: 0,
        monitoredAt: new Date(),
      };
    }

    // Use provided token or stored token
    if (accessToken) {
      this.accessToken = accessToken;
    }

    if (!this.accessToken) {
      const error = createProgressMonitorError(
        'AUTHENTICATION_ERROR',
        'No access token available for progress monitoring',
      );

      return {
        success: false,
        error,
        responseTime: 0,
        monitoredAt: new Date(),
      };
    }

    // Stop existing monitoring for this job
    this.stopMonitoring(job.jobId);

    // Initialize monitoring data
    const statistics: ProgressStatistics = {
      startTime: job.submittedAt,
      lastCheckTime: new Date(),
      checkCount: 0,
      statusTransitions: [],
      progressUpdates: [],
    };

    const callbacks = {
      progress: onProgress ? [onProgress] : [],
      statusChange: onStatusChange ? [onStatusChange] : [],
    };

    // Perform initial status check
    const initialResult = await this.checkJobStatus(job.azureJobId);

    if (!initialResult.success) {
      return initialResult;
    }

    // Setup periodic monitoring
    const intervalId = setInterval(async () => {
      try {
        await this.performStatusCheck(job.jobId, job.azureJobId!);
      } catch (error) {
        console.error(`Error monitoring job ${job.jobId}:`, error);
      }
    }, this.monitorConfig.basePollInterval);

    this.activeMonitors.set(job.jobId, {
      jobId: job.jobId,
      intervalId,
      statistics,
      callbacks,
    });

    return initialResult;
  }

  /**
   * Stop monitoring a transcription job
   */
  stopMonitoring(jobId: string): void {
    const monitor = this.activeMonitors.get(jobId);
    if (monitor) {
      clearInterval(monitor.intervalId);
      this.activeMonitors.delete(jobId);
    }
  }

  /**
   * Stop all active monitoring
   */
  stopAllMonitoring(): void {
    const jobIds = Array.from(this.activeMonitors.keys());
    for (const jobId of jobIds) {
      this.stopMonitoring(jobId);
    }
  }

  /**
   * Get current progress for a job
   */
  async getJobProgress(azureJobId: string, accessToken?: string): Promise<ProgressMonitorResult> {
    if (accessToken) {
      this.accessToken = accessToken;
    }

    if (!this.accessToken) {
      const error = createProgressMonitorError(
        'AUTHENTICATION_ERROR',
        'No access token available for progress monitoring',
      );

      return {
        success: false,
        error,
        responseTime: 0,
        monitoredAt: new Date(),
      };
    }

    return await this.checkJobStatus(azureJobId);
  }

  /**
   * Add progress callback to existing monitoring
   */
  addProgressCallback(jobId: string, callback: ProgressCallback): boolean {
    const monitor = this.activeMonitors.get(jobId);
    if (monitor) {
      monitor.callbacks.progress.push(callback);
      return true;
    }
    return false;
  }

  /**
   * Add status change callback to existing monitoring
   */
  addStatusChangeCallback(jobId: string, callback: StatusChangeCallback): boolean {
    const monitor = this.activeMonitors.get(jobId);
    if (monitor) {
      monitor.callbacks.statusChange.push(callback);
      return true;
    }
    return false;
  }

  /**
   * Check job status from Azure
   */
  private async checkJobStatus(azureJobId: string): Promise<ProgressMonitorResult> {
    const startTime = Date.now();
    const endpoint = BATCH_TRANSCRIPTION_ENDPOINTS[this.authConfig.region as AzureRegion];

    if (!endpoint) {
      const error = createProgressMonitorError(
        'UNKNOWN_ERROR',
        `No batch transcription endpoint found for region: ${this.authConfig.region}`,
      );

      return {
        success: false,
        error,
        responseTime: Date.now() - startTime,
        monitoredAt: new Date(),
      };
    }

    const apiUrl = `${endpoint}/speechtotext/v3.0/transcriptions/${azureJobId}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.monitorConfig.timeout);

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Ocp-Apim-Subscription-Key': this.authConfig.subscriptionKey,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorType: ProgressMonitorErrorType;
        let retryable = false;
        let retryAfter: number | undefined;

        switch (response.status) {
          case 404:
            errorType = 'JOB_NOT_FOUND';
            break;
          case 401:
          case 403:
            errorType = 'AUTHENTICATION_ERROR';
            break;
          case 429: {
            errorType = 'QUOTA_EXCEEDED';
            retryable = true;
            const retryHeader = response.headers.get('retry-after');
            retryAfter = retryHeader ? parseInt(retryHeader, 10) * 1000 : 60000;
            break;
          }
          case 503:
            errorType = 'SERVICE_UNAVAILABLE';
            retryable = true;
            retryAfter = 30000;
            break;
          default:
            errorType = 'NETWORK_ERROR';
            retryable = response.status >= 500;
        }

        let azureError: ErrorDetails | undefined;
        try {
          const errorResponse = await response.json();
          azureError = errorResponse.error || errorResponse;
        } catch {
          // Failed to parse error response
        }

        const error = createProgressMonitorError(
          errorType,
          `Azure API error: HTTP ${response.status} ${response.statusText}`,
          response.status,
          retryable,
          retryAfter,
          azureError,
        );

        return {
          success: false,
          error,
          responseTime: Date.now() - startTime,
          monitoredAt: new Date(),
        };
      }

      // Parse successful response
      const azureJob: BatchTranscriptionJob = await response.json();

      // Calculate progress information
      const jobStartTime = new Date(azureJob.createdDateTime);
      const elapsedTime = Date.now() - jobStartTime.getTime();
      const status = mapAzureJobStatus(azureJob.status);
      const progress = estimateProgress(azureJob.status, elapsedTime);
      const estimatedCompletionTime = estimateCompletionTime(jobStartTime, progress, status);
      // const _estimatedRemainingTime = estimatedCompletionTime
      //   ? Math.max(0, Math.round((estimatedCompletionTime.getTime() - Date.now()) / 1000))
      //   : undefined;

      const jobProgress: JobProgress = {
        jobId: '', // Will be set by caller
        azureJobId,
        status,
        progress,
        lastUpdated: new Date(),
        statistics: {
          pollAttempts: 1,
          elapsedTime: elapsedTime,
          jobStartTime,
        },
        ...(estimatedCompletionTime && { estimatedCompletionTime }),
      };

      return {
        success: true,
        progress: jobProgress,
        azureJob,
        responseTime: Date.now() - startTime,
        monitoredAt: new Date(),
      };
    } catch (error) {
      let errorType: ProgressMonitorErrorType;
      let retryable = false;

      if (error instanceof Error && error.name === 'AbortError') {
        errorType = 'TIMEOUT';
        retryable = true;
      } else {
        errorType = 'NETWORK_ERROR';
        retryable = true;
      }

      const monitorError = createProgressMonitorError(
        errorType,
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        retryable,
      );

      return {
        success: false,
        error: monitorError,
        responseTime: Date.now() - startTime,
        monitoredAt: new Date(),
      };
    }
  }

  /**
   * Perform status check for active monitoring
   */
  private async performStatusCheck(jobId: string, azureJobId: string): Promise<void> {
    const monitor = this.activeMonitors.get(jobId);
    if (!monitor) {
      return;
    }

    const result = await this.checkJobStatus(azureJobId);

    if (!result.success || !result.progress) {
      // Handle monitoring errors
      if (result.error?.retryable) {
        // Continue monitoring on retryable errors
        return;
      } else {
        // Stop monitoring on non-retryable errors
        this.stopMonitoring(jobId);
        return;
      }
    }

    const progress = result.progress;
    progress.jobId = jobId;

    // Update statistics
    monitor.statistics.lastCheckTime = new Date();
    monitor.statistics.checkCount++;

    // Track status transitions
    const lastTransition = monitor.statistics.statusTransitions[monitor.statistics.statusTransitions.length - 1];
    const lastStatus = lastTransition?.to || ('pending' as TranscriptionJobStatus);

    if (lastStatus !== progress.status) {
      monitor.statistics.statusTransitions.push({
        from: lastStatus,
        to: progress.status,
        timestamp: new Date(),
      });

      // Notify status change callbacks
      monitor.callbacks.statusChange.forEach(callback => {
        try {
          callback(lastStatus, progress.status, progress);
        } catch (error) {
          console.error('Error in status change callback:', error);
        }
      });
    }

    // Track progress updates
    const progressUpdate: { progress: number; timestamp: Date; estimatedCompletion?: Date } = {
      progress: progress.progress,
      timestamp: new Date(),
    };

    if (progress.estimatedCompletionTime) {
      progressUpdate.estimatedCompletion = progress.estimatedCompletionTime;
    }

    monitor.statistics.progressUpdates.push(progressUpdate);

    // Update progress statistics
    progress.statistics = {
      ...progress.statistics,
      pollAttempts: monitor.statistics.checkCount,
    };

    // Notify progress callbacks
    monitor.callbacks.progress.forEach(callback => {
      try {
        callback(progress);
      } catch (error) {
        console.error('Error in progress callback:', error);
      }
    });

    // Stop monitoring if job is complete
    if (progress.status === 'completed' || progress.status === 'failed' || progress.status === 'cancelled') {
      this.stopMonitoring(jobId);
      return;
    }

    // Adjust polling interval if adaptive polling is enabled
    if (this.monitorConfig.enableAdaptivePolling) {
      const newInterval = calculateAdaptiveInterval(
        this.monitorConfig.basePollInterval,
        this.monitorConfig.maxPollInterval,
        progress.progress,
        monitor.statistics.checkCount,
        progress.status,
      );

      if (newInterval !== this.monitorConfig.basePollInterval) {
        clearInterval(monitor.intervalId);

        if (newInterval > 0) {
          monitor.intervalId = setInterval(async () => {
            try {
              await this.performStatusCheck(jobId, azureJobId);
            } catch (error) {
              console.error(`Error monitoring job ${jobId}:`, error);
            }
          }, newInterval);
        }
      }
    }

    // Check for maximum attempts or duration
    if (monitor.statistics.checkCount >= this.monitorConfig.maxPollAttempts) {
      console.warn(`Maximum polling attempts reached for job ${jobId}`);
      this.stopMonitoring(jobId);
    }

    const jobDuration = Date.now() - monitor.statistics.startTime.getTime();
    if (jobDuration >= this.monitorConfig.maxJobDuration) {
      console.warn(`Maximum job duration exceeded for job ${jobId}`);
      this.stopMonitoring(jobId);
    }
  }

  /**
   * Update access token
   */
  updateAccessToken(token: string): void {
    this.accessToken = token;
  }

  /**
   * Update authentication configuration
   */
  updateAuthConfig(config: AuthConfig): void {
    this.authConfig = config;
  }

  /**
   * Update monitoring configuration
   */
  updateMonitorConfig(config: Partial<ProgressMonitorConfig>): void {
    this.monitorConfig = { ...this.monitorConfig, ...config };
  }

  /**
   * Get current configuration
   */
  getConfiguration(): {
    authConfig: AuthConfig;
    monitorConfig: ProgressMonitorConfig;
    activeJobCount: number;
    hasAccessToken: boolean;
  } {
    return {
      authConfig: { ...this.authConfig },
      monitorConfig: { ...this.monitorConfig },
      activeJobCount: this.activeMonitors.size,
      hasAccessToken: !!this.accessToken,
    };
  }

  /**
   * Get monitoring statistics for a job
   */
  getJobStatistics(jobId: string): ProgressStatistics | null {
    const monitor = this.activeMonitors.get(jobId);
    return monitor ? { ...monitor.statistics } : null;
  }

  /**
   * Get all active job IDs
   */
  getActiveJobIds(): string[] {
    return Array.from(this.activeMonitors.keys());
  }

  /**
   * Test connectivity to Azure batch transcription service
   */
  async testConnectivity(accessToken?: string): Promise<{
    success: boolean;
    responseTime: number;
    error?: string;
  }> {
    const startTime = Date.now();

    if (accessToken) {
      this.accessToken = accessToken;
    }

    if (!this.accessToken) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: 'No access token available',
      };
    }

    const endpoint = BATCH_TRANSCRIPTION_ENDPOINTS[this.authConfig.region as AzureRegion];

    if (!endpoint) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: `No endpoint found for region: ${this.authConfig.region}`,
      };
    }

    try {
      const response = await fetch(`${endpoint}/speechtotext/v3.0/transcriptions`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Ocp-Apim-Subscription-Key': this.authConfig.subscriptionKey,
        },
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        return { success: true, responseTime };
      } else {
        return {
          success: false,
          responseTime,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stopAllMonitoring();
    this.accessToken = null;
  }
}
