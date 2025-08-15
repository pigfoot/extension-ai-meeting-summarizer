/**
 * Azure Speech error recovery service
 * Coordinates all error recovery operations with comprehensive error handling
 * and job persistence for automatic retry after outages
 */

import { CircuitBreaker } from './circuit-breaker';
import { ErrorClassifier } from './error-classifier';
import { RetryManager } from './retry-manager';
import { ErrorCategory } from '../types/errors';
import type { CircuitBreakerConfig, CircuitBreakerStats } from './circuit-breaker';
import type { ErrorClassification } from './error-classifier';
import type { RetryConfig } from './retry-manager';
import type { TranscriptionJob, TranscriptionError } from '../types';
import type { TranscriptionErrorType, RetryStrategy, ErrorSeverity } from '../types/errors';

/**
 * Recovery strategy configuration
 */
export interface RecoveryStrategyConfig {
  /** Maximum number of recovery attempts */
  maxRecoveryAttempts: number;
  /** Base delay between recovery attempts (ms) */
  recoveryDelay: number;
  /** Whether to persist failed jobs for later retry */
  persistFailedJobs: boolean;
  /** Maximum time to keep failed jobs (ms) */
  failedJobRetentionTime: number;
  /** Whether to enable automatic recovery */
  automaticRecovery: boolean;
  /** Interval for automatic recovery checks (ms) */
  automaticRecoveryInterval: number;
  /** User notification settings */
  notifications: {
    /** Whether to notify users of failures */
    enabled: boolean;
    /** Minimum severity level for notifications */
    minSeverity: number;
    /** Categories that should trigger notifications */
    categories: Set<ErrorCategory>;
  };
}

/**
 * Recovery attempt result
 */
export interface RecoveryAttemptResult {
  /** Whether recovery was successful */
  success: boolean;
  /** Recovered job if successful */
  recoveredJob?: TranscriptionJob;
  /** Recovery error if failed */
  error?: TranscriptionError;
  /** Error classification */
  errorClassification?: ErrorClassification;
  /** Recovery strategy used */
  strategy: RecoveryStrategy;
  /** Number of attempts made */
  attempts: number;
  /** Recovery duration in milliseconds */
  duration: number;
  /** Recovery timestamp */
  recoveredAt: Date;
}

/**
 * Failed job record for persistence
 */
export interface FailedJobRecord {
  /** Original job */
  job: TranscriptionJob;
  /** Original error */
  error: TranscriptionError;
  /** Error classification */
  errorClassification: ErrorClassification;
  /** Number of recovery attempts made */
  recoveryAttempts: number;
  /** Timestamp when job failed */
  failedAt: Date;
  /** Last recovery attempt timestamp */
  lastAttempt?: Date;
  /** Whether job is eligible for retry */
  retryable: boolean;
  /** Scheduled retry time */
  retryAfter?: Date;
}

/**
 * Recovery system status
 */
export interface RecoverySystemStatus {
  /** Whether recovery system is active */
  active: boolean;
  /** Circuit breaker status */
  circuitBreaker: CircuitBreakerStats;
  /** Number of jobs pending recovery */
  pendingRecovery: number;
  /** Number of jobs in retry queue */
  retryQueue: number;
  /** Recovery statistics */
  stats: {
    /** Total recovery attempts */
    totalAttempts: number;
    /** Successful recoveries */
    successfulRecoveries: number;
    /** Failed recoveries */
    failedRecoveries: number;
    /** Recovery success rate */
    successRate: number;
  };
  /** Last recovery attempt */
  lastRecovery?: Date;
  /** Status timestamp */
  timestamp: Date;
}

/**
 * Recovery strategy types
 */
export type RecoveryStrategy =
  | 'IMMEDIATE_RETRY'
  | 'DELAYED_RETRY'
  | 'CIRCUIT_BREAKER'
  | 'USER_INTERVENTION'
  | 'GRACEFUL_DEGRADATION'
  | 'JOB_PERSISTENCE';

/**
 * Recovery operation function type
 */
export type RecoveryOperation<T> = (job: TranscriptionJob) => Promise<T>;

/**
 * Recovery notification callback
 */
export type RecoveryNotificationCallback = (
  event: 'JOB_FAILED' | 'RECOVERY_STARTED' | 'RECOVERY_SUCCESS' | 'RECOVERY_FAILED' | 'USER_ACTION_REQUIRED',
  data: {
    job: TranscriptionJob;
    error?: TranscriptionError;
    classification?: ErrorClassification;
    recoveryResult?: RecoveryAttemptResult;
  },
) => void;

/**
 * Default recovery configuration
 */
const DEFAULT_RECOVERY_CONFIG: RecoveryStrategyConfig = {
  maxRecoveryAttempts: 3,
  recoveryDelay: 30000, // 30 seconds
  persistFailedJobs: true,
  failedJobRetentionTime: 24 * 60 * 60 * 1000, // 24 hours
  automaticRecovery: true,
  automaticRecoveryInterval: 5 * 60 * 1000, // 5 minutes
  notifications: {
    enabled: true,
    minSeverity: 3,
    categories: new Set([
      ErrorCategory.AUTHENTICATION,
      ErrorCategory.AUDIO,
      ErrorCategory.CONFIGURATION,
      ErrorCategory.SERVICE,
    ]),
  },
};

/**
 * Recovery strategies by error category
 */
const RECOVERY_STRATEGIES: Record<ErrorCategory, RecoveryStrategy> = {
  [ErrorCategory.NETWORK]: 'DELAYED_RETRY',
  [ErrorCategory.QUOTA]: 'DELAYED_RETRY',
  [ErrorCategory.AUTHENTICATION]: 'USER_INTERVENTION',
  [ErrorCategory.CONFIGURATION]: 'USER_INTERVENTION',
  [ErrorCategory.AUDIO]: 'USER_INTERVENTION',
  [ErrorCategory.SERVICE]: 'CIRCUIT_BREAKER',
  [ErrorCategory.UNKNOWN]: 'DELAYED_RETRY',
};

/**
 * Azure Speech error recovery system
 */
export class ErrorRecoveryService {
  private config: RecoveryStrategyConfig;
  private retryManager: RetryManager;
  private circuitBreaker: CircuitBreaker;
  private failedJobs: Map<string, FailedJobRecord> = new Map();
  private recoveryStats = {
    totalAttempts: 0,
    successfulRecoveries: 0,
    failedRecoveries: 0,
  };
  private notificationCallback?: RecoveryNotificationCallback;
  private automaticRecoveryTimer?: NodeJS.Timeout;
  private isActive = false;

  constructor(
    config?: Partial<RecoveryStrategyConfig>,
    retryConfig?: Partial<RetryConfig>,
    circuitBreakerConfig?: Partial<CircuitBreakerConfig>,
  ) {
    this.config = { ...DEFAULT_RECOVERY_CONFIG, ...config };
    this.retryManager = new RetryManager(retryConfig);
    this.circuitBreaker = new CircuitBreaker(circuitBreakerConfig);

    // Set up circuit breaker event handling
    this.circuitBreaker.setEventCallback((event, _stats) => {
      if (event === 'OPEN' && this.config.automaticRecovery) {
        this.scheduleAutomaticRecovery();
      }
    });
  }

  /**
   * Start the recovery system
   */
  start(): void {
    if (this.isActive) return;

    this.isActive = true;

    if (this.config.automaticRecovery) {
      this.startAutomaticRecovery();
    }
  }

  /**
   * Stop the recovery system
   */
  stop(): void {
    if (!this.isActive) return;

    this.isActive = false;

    if (this.automaticRecoveryTimer) {
      clearInterval(this.automaticRecoveryTimer);
      delete this.automaticRecoveryTimer;
    }
  }

  /**
   * Handle a failed transcription job
   */
  async handleJobFailure(
    job: TranscriptionJob,
    error: TranscriptionError,
    context?: Record<string, unknown>,
  ): Promise<RecoveryAttemptResult> {
    const classification = ErrorClassifier.classifyError(error);

    // Notify about job failure
    this.notifyEvent('JOB_FAILED', { job, error, classification });

    // Store failed job for persistence
    if (this.config.persistFailedJobs) {
      this.persistFailedJob(job, error, classification);
    }

    // Determine recovery strategy
    const strategy = this.determineRecoveryStrategy(classification);

    // Attempt recovery based on strategy
    return this.executeRecoveryStrategy(job, error, classification, strategy, context);
  }

  /**
   * Recover from a specific error
   */
  async recoverFromError(error: TranscriptionError, context?: Record<string, unknown>): Promise<RecoveryAttemptResult> {
    const classification = ErrorClassifier.classifyError(error);
    const strategy = this.determineRecoveryStrategy(classification);

    // Create a dummy job for error-only recovery
    const dummyJob: TranscriptionJob = {
      jobId: `recovery-${Date.now()}`,
      status: 'failed',
      audioUrl: '',
      progress: 0,
      submittedAt: new Date(),
      config: {
        language: 'en-US',
        enableSpeakerDiarization: false,
        enableProfanityFilter: false,
        outputFormat: 'detailed',
        confidenceThreshold: 0.5,
      },
      retryCount: 0,
    };

    return this.executeRecoveryStrategy(dummyJob, error, classification, strategy, context);
  }

  /**
   * Execute operation with automatic error recovery
   */
  async executeWithRecovery<T>(
    operation: RecoveryOperation<T>,
    job: TranscriptionJob,
  ): Promise<{ result?: T; recoveryResult?: RecoveryAttemptResult }> {
    try {
      // Try to execute through circuit breaker
      const circuitResult = await this.circuitBreaker.execute(async () => await operation(job));

      if (circuitResult.allowed && !circuitResult.error) {
        return circuitResult.result !== undefined ? { result: circuitResult.result } : {};
      }

      // Handle circuit breaker rejection or error
      if (circuitResult.rejectedByCircuit) {
        const error: TranscriptionError = {
          name: 'TranscriptionError',
          message: 'Operation rejected by circuit breaker',
          type: 'SERVICE_UNAVAILABLE' as TranscriptionErrorType,
          category: ErrorCategory.SERVICE,
          retryable: true,
          retryStrategy: 'none' as RetryStrategy,
          severity: 'medium' as ErrorSeverity,
          timestamp: new Date(),
          notifyUser: false,
        };

        const recoveryResult = await this.handleJobFailure(job, error);
        return { recoveryResult };
      }

      if (circuitResult.error) {
        const transcriptionError = ErrorClassifier.createTranscriptionError(circuitResult.error);
        const recoveryResult = await this.handleJobFailure(job, transcriptionError);
        return { recoveryResult };
      }
    } catch (error) {
      const transcriptionError = ErrorClassifier.createTranscriptionError(
        error instanceof Error ? error : new Error('Unknown error'),
      );
      const recoveryResult = await this.handleJobFailure(job, transcriptionError);
      return { recoveryResult };
    }

    return {};
  }

  /**
   * Determine recovery strategy based on error classification
   */
  private determineRecoveryStrategy(classification: ErrorClassification): RecoveryStrategy {
    // Check if user intervention is required
    if (classification.requiresUserIntervention) {
      return 'USER_INTERVENTION';
    }

    // Check if error is retryable
    if (!classification.retryable) {
      return 'GRACEFUL_DEGRADATION';
    }

    // Use category-based strategy
    return RECOVERY_STRATEGIES[classification.category] || 'DELAYED_RETRY';
  }

  /**
   * Execute recovery strategy
   */
  private async executeRecoveryStrategy(
    job: TranscriptionJob,
    error: TranscriptionError,
    classification: ErrorClassification,
    strategy: RecoveryStrategy,
    _context?: Record<string, unknown>,
  ): Promise<RecoveryAttemptResult> {
    const startTime = Date.now();
    this.recoveryStats.totalAttempts++;

    this.notifyEvent('RECOVERY_STARTED', { job, error, classification });

    try {
      let result: RecoveryAttemptResult;

      switch (strategy) {
        case 'IMMEDIATE_RETRY':
          result = await this.executeImmediateRetry(job, error, classification);
          break;

        case 'DELAYED_RETRY':
          result = await this.executeDelayedRetry(job, error, classification);
          break;

        case 'CIRCUIT_BREAKER':
          result = await this.executeCircuitBreakerRecovery(job, error, classification);
          break;

        case 'USER_INTERVENTION':
          result = this.executeUserIntervention(job, error, classification);
          break;

        case 'GRACEFUL_DEGRADATION':
          result = this.executeGracefulDegradation(job, error, classification);
          break;

        case 'JOB_PERSISTENCE':
          result = this.executeJobPersistence(job, error, classification);
          break;

        default:
          result = await this.executeDelayedRetry(job, error, classification);
      }

      result.duration = Date.now() - startTime;
      result.recoveredAt = new Date();

      if (result.success) {
        this.recoveryStats.successfulRecoveries++;
        this.notifyEvent('RECOVERY_SUCCESS', { job, recoveryResult: result });
      } else {
        this.recoveryStats.failedRecoveries++;
        this.notifyEvent('RECOVERY_FAILED', { job, error, recoveryResult: result });
      }

      return result;
    } catch (recoveryError) {
      this.recoveryStats.failedRecoveries++;

      const result: RecoveryAttemptResult = {
        success: false,
        error: ErrorClassifier.createTranscriptionError(
          recoveryError instanceof Error ? recoveryError : new Error('Recovery failed'),
        ),
        strategy,
        attempts: 1,
        duration: Date.now() - startTime,
        recoveredAt: new Date(),
      };

      this.notifyEvent('RECOVERY_FAILED', { job, error, recoveryResult: result });
      return result;
    }
  }

  /**
   * Execute immediate retry strategy
   */
  private async executeImmediateRetry(
    _job: TranscriptionJob,
    _error: TranscriptionError,
    _classification: ErrorClassification,
  ): Promise<RecoveryAttemptResult> {
    // Implementation would depend on the specific operation
    // For now, return a placeholder result
    return {
      success: false,
      error: ErrorClassifier.createTranscriptionError(
        new Error('Immediate retry not implemented for this operation type'),
      ),
      strategy: 'IMMEDIATE_RETRY',
      attempts: 1,
      duration: 0,
      recoveredAt: new Date(),
    };
  }

  /**
   * Execute delayed retry strategy
   */
  private async executeDelayedRetry(
    job: TranscriptionJob,
    _error: TranscriptionError,
    _classification: ErrorClassification,
  ): Promise<RecoveryAttemptResult> {
    // Schedule job for later retry
    const retryAfter = new Date(Date.now() + this.config.recoveryDelay);

    if (this.config.persistFailedJobs) {
      const failedRecord = this.failedJobs.get(job.jobId);
      if (failedRecord) {
        failedRecord.retryAfter = retryAfter;
        failedRecord.lastAttempt = new Date();
      }
    }

    return {
      success: false,
      error: ErrorClassifier.createTranscriptionError(
        new Error(`Job scheduled for retry at ${retryAfter.toISOString()}`),
      ),
      strategy: 'DELAYED_RETRY',
      attempts: 1,
      duration: 0,
      recoveredAt: new Date(),
    };
  }

  /**
   * Execute circuit breaker recovery
   */
  private async executeCircuitBreakerRecovery(
    _job: TranscriptionJob,
    _error: TranscriptionError,
    _classification: ErrorClassification,
  ): Promise<RecoveryAttemptResult> {
    // Circuit breaker will handle the recovery automatically
    // We just need to wait for it to transition to half-open state

    return {
      success: false,
      error: ErrorClassifier.createTranscriptionError(
        new Error('Operation blocked by circuit breaker, waiting for service recovery'),
      ),
      strategy: 'CIRCUIT_BREAKER',
      attempts: 1,
      duration: 0,
      recoveredAt: new Date(),
    };
  }

  /**
   * Execute user intervention strategy
   */
  private executeUserIntervention(
    job: TranscriptionJob,
    error: TranscriptionError,
    classification: ErrorClassification,
  ): RecoveryAttemptResult {
    this.notifyEvent('USER_ACTION_REQUIRED', { job, error, classification });

    return {
      success: false,
      error: ErrorClassifier.createTranscriptionError(
        new Error(`User intervention required: ${classification.userAction || 'Please check configuration'}`),
      ),
      strategy: 'USER_INTERVENTION',
      attempts: 1,
      duration: 0,
      recoveredAt: new Date(),
    };
  }

  /**
   * Execute graceful degradation strategy
   */
  private executeGracefulDegradation(
    _job: TranscriptionJob,
    _error: TranscriptionError,
    _classification: ErrorClassification,
  ): RecoveryAttemptResult {
    return {
      success: false,
      error: ErrorClassifier.createTranscriptionError(
        new Error('Operation failed and is not recoverable, gracefully degrading'),
      ),
      strategy: 'GRACEFUL_DEGRADATION',
      attempts: 1,
      duration: 0,
      recoveredAt: new Date(),
    };
  }

  /**
   * Execute job persistence strategy
   */
  private executeJobPersistence(
    job: TranscriptionJob,
    error: TranscriptionError,
    classification: ErrorClassification,
  ): RecoveryAttemptResult {
    this.persistFailedJob(job, error, classification);

    return {
      success: true,
      recoveredJob: { ...job, status: 'pending' },
      strategy: 'JOB_PERSISTENCE',
      attempts: 1,
      duration: 0,
      recoveredAt: new Date(),
    };
  }

  /**
   * Persist failed job for later recovery
   */
  private persistFailedJob(
    job: TranscriptionJob,
    error: TranscriptionError,
    classification: ErrorClassification,
  ): void {
    const existing = this.failedJobs.get(job.jobId);

    const record: FailedJobRecord = {
      job,
      error,
      errorClassification: classification,
      recoveryAttempts: existing ? existing.recoveryAttempts + 1 : 1,
      failedAt: existing?.failedAt || new Date(),
      lastAttempt: new Date(),
      retryable: classification.retryable,
    };

    this.failedJobs.set(job.jobId, record);
  }

  /**
   * Start automatic recovery process
   */
  private startAutomaticRecovery(): void {
    if (this.automaticRecoveryTimer) return;

    this.automaticRecoveryTimer = setInterval(() => {
      this.processAutomaticRecovery();
    }, this.config.automaticRecoveryInterval);
  }

  /**
   * Process automatic recovery for eligible jobs
   */
  private async processAutomaticRecovery(): Promise<void> {
    if (!this.isActive) return;

    const now = new Date();
    const eligibleJobs: FailedJobRecord[] = [];

    // Find jobs eligible for retry
    for (const record of this.failedJobs.values()) {
      if (
        record.retryable &&
        record.recoveryAttempts < this.config.maxRecoveryAttempts &&
        (!record.retryAfter || record.retryAfter <= now)
      ) {
        eligibleJobs.push(record);
      }
    }

    // Process eligible jobs
    for (const record of eligibleJobs) {
      try {
        const recoveryResult = await this.executeRecoveryStrategy(
          record.job,
          record.error,
          record.errorClassification,
          this.determineRecoveryStrategy(record.errorClassification),
        );

        if (recoveryResult.success) {
          this.failedJobs.delete(record.job.jobId);
        }
      } catch (error) {
        // Log error and continue with next job
        console.error(`Automatic recovery failed for job ${record.job.jobId}:`, error);
      }
    }

    // Clean up old failed jobs
    this.cleanupOldFailedJobs();
  }

  /**
   * Schedule automatic recovery
   */
  private scheduleAutomaticRecovery(): void {
    if (!this.config.automaticRecovery) return;

    // Schedule a one-time recovery check
    setTimeout(() => {
      this.processAutomaticRecovery();
    }, this.config.recoveryDelay);
  }

  /**
   * Clean up old failed jobs
   */
  private cleanupOldFailedJobs(): void {
    const cutoffTime = new Date(Date.now() - this.config.failedJobRetentionTime);

    for (const [jobId, record] of this.failedJobs.entries()) {
      if (record.failedAt < cutoffTime) {
        this.failedJobs.delete(jobId);
      }
    }
  }

  /**
   * Notify event callback
   */
  private notifyEvent(
    event: 'JOB_FAILED' | 'RECOVERY_STARTED' | 'RECOVERY_SUCCESS' | 'RECOVERY_FAILED' | 'USER_ACTION_REQUIRED',
    data: {
      job: TranscriptionJob;
      error?: TranscriptionError;
      classification?: ErrorClassification;
      recoveryResult?: RecoveryAttemptResult;
    },
  ): void {
    if (!this.notificationCallback || !this.config.notifications.enabled) return;

    // Check if notification should be sent based on severity and category
    if (data.classification) {
      if (data.classification.severity < this.config.notifications.minSeverity) return;
      if (!this.config.notifications.categories.has(data.classification.category)) return;
    }

    this.notificationCallback(event, data);
  }

  /**
   * Get recovery system status
   */
  getStatus(): RecoverySystemStatus {
    const pendingRecovery = Array.from(this.failedJobs.values()).filter(
      record => record.retryable && record.recoveryAttempts < this.config.maxRecoveryAttempts,
    ).length;

    const retryQueue = Array.from(this.failedJobs.values()).filter(
      record => record.retryAfter && record.retryAfter > new Date(),
    ).length;

    const successRate =
      this.recoveryStats.totalAttempts > 0
        ? this.recoveryStats.successfulRecoveries / this.recoveryStats.totalAttempts
        : 0;

    return {
      active: this.isActive,
      circuitBreaker: this.circuitBreaker.getStats(),
      pendingRecovery,
      retryQueue,
      stats: {
        ...this.recoveryStats,
        successRate,
      },
      timestamp: new Date(),
    };
  }

  /**
   * Get failed jobs
   */
  getFailedJobs(): FailedJobRecord[] {
    return Array.from(this.failedJobs.values());
  }

  /**
   * Clear failed job
   */
  clearFailedJob(jobId: string): boolean {
    return this.failedJobs.delete(jobId);
  }

  /**
   * Clear all failed jobs
   */
  clearAllFailedJobs(): void {
    this.failedJobs.clear();
  }

  /**
   * Set notification callback
   */
  setNotificationCallback(callback: RecoveryNotificationCallback): void {
    this.notificationCallback = callback;
  }

  /**
   * Clear notification callback
   */
  clearNotificationCallback(): void {
    delete this.notificationCallback;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RecoveryStrategyConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): RecoveryStrategyConfig {
    return { ...this.config };
  }

  /**
   * Get circuit breaker instance
   */
  getCircuitBreaker(): CircuitBreaker {
    return this.circuitBreaker;
  }

  /**
   * Get retry manager instance
   */
  getRetryManager(): RetryManager {
    return this.retryManager;
  }
}
