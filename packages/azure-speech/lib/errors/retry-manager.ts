/**
 * Azure Speech retry manager
 * Implements exponential backoff retry logic with maximum attempt limits
 * and intelligent retry scheduling based on error classification
 */

import { ErrorClassifier } from './error-classifier';
import { ErrorCategory, RetryStrategy } from '../types/errors';
import type { ErrorClassification } from './error-classifier';

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Base delay in milliseconds */
  baseDelay: number;
  /** Maximum delay in milliseconds */
  maxDelay: number;
  /** Exponential backoff multiplier */
  backoffMultiplier: number;
  /** Maximum jitter factor (0-1) */
  jitterFactor: number;
  /** Timeout for each attempt in milliseconds */
  attemptTimeout: number;
  /** Categories of errors that should be retried */
  retryableCategories: Set<ErrorCategory>;
  /** Whether to reset delay on successful retry */
  resetDelayOnSuccess: boolean;
}

/**
 * Retry attempt result
 */
export interface RetryAttempt<T> {
  /** Attempt number (1-based) */
  attemptNumber: number;
  /** Whether the attempt was successful */
  success: boolean;
  /** Result data if successful */
  result?: T;
  /** Error if failed */
  error?: Error;
  /** Error classification */
  errorClassification?: ErrorClassification;
  /** Delay before this attempt (ms) */
  delayBefore: number;
  /** Duration of the attempt (ms) */
  duration: number;
  /** Timestamp of the attempt */
  timestamp: Date;
}

/**
 * Retry execution result
 */
export interface RetryResult<T> {
  /** Whether the operation eventually succeeded */
  success: boolean;
  /** Final result if successful */
  result?: T;
  /** Final error if all attempts failed */
  error?: Error;
  /** Final error classification */
  errorClassification?: ErrorClassification;
  /** Total number of attempts made */
  totalAttempts: number;
  /** Total time spent including delays (ms) */
  totalTime: number;
  /** All retry attempts */
  attempts: RetryAttempt<T>[];
  /** Whether retries were exhausted */
  retriesExhausted: boolean;
  /** Execution timestamp */
  executedAt: Date;
}

/**
 * Retry operation function type
 */
export type RetryOperation<T> = (attemptNumber: number, signal?: AbortSignal) => Promise<T>;

/**
 * Retry progress callback
 */
export type RetryProgressCallback<T> = (attempt: RetryAttempt<T>) => void;

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
  attemptTimeout: 60000,
  retryableCategories: new Set([ErrorCategory.NETWORK, ErrorCategory.SERVICE, ErrorCategory.QUOTA]),
  resetDelayOnSuccess: true,
};

/**
 * Strategy-specific retry configurations
 */
const STRATEGY_CONFIGS: Record<RetryStrategy, Partial<RetryConfig>> = {
  [RetryStrategy.NONE]: {
    maxAttempts: 1,
  },
  [RetryStrategy.LINEAR_BACKOFF]: {
    maxAttempts: 3,
    baseDelay: 2000,
    maxDelay: 10000,
    backoffMultiplier: 1, // Linear progression
    jitterFactor: 0.2,
  },
  [RetryStrategy.EXPONENTIAL_BACKOFF]: {
    maxAttempts: 5,
    baseDelay: 1000,
    maxDelay: 60000,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
  },
  [RetryStrategy.CUSTOM]: {
    maxAttempts: 7,
    baseDelay: 500,
    maxDelay: 30000,
    backoffMultiplier: 1.5,
    jitterFactor: 0.15,
  },
  [RetryStrategy.IMMEDIATE]: {
    maxAttempts: 3,
    baseDelay: 0,
    maxDelay: 1000,
    backoffMultiplier: 1,
    jitterFactor: 0,
  },
  [RetryStrategy.FIXED_DELAY]: {
    maxAttempts: 3,
    baseDelay: 5000,
    maxDelay: 5000,
    backoffMultiplier: 1,
    jitterFactor: 0.1,
  },
};

/**
 * Calculate retry delay based on strategy
 */
function calculateDelay(attemptNumber: number, strategy: RetryStrategy, config: RetryConfig): number {
  if (strategy === RetryStrategy.NONE || attemptNumber <= 1) {
    return 0;
  }

  let delay: number;

  switch (strategy) {
    case RetryStrategy.LINEAR_BACKOFF:
      delay = config.baseDelay * attemptNumber;
      break;

    case RetryStrategy.EXPONENTIAL_BACKOFF:
    case RetryStrategy.CUSTOM:
      delay = config.baseDelay * Math.pow(config.backoffMultiplier, attemptNumber - 1);
      break;

    default:
      delay = config.baseDelay;
  }

  // Add jitter to prevent thundering herd
  const jitter = delay * config.jitterFactor * (Math.random() - 0.5);
  delay += jitter;

  // Cap at maximum delay
  return Math.min(Math.max(delay, 0), config.maxDelay);
}

/**
 * Check if error should be retried
 */
function shouldRetry(
  error: Error,
  attemptNumber: number,
  config: RetryConfig,
): { shouldRetry: boolean; classification: ErrorClassification } {
  const classification = ErrorClassifier.classifyError(error);

  // Check if we've exceeded max attempts
  if (attemptNumber >= config.maxAttempts) {
    return { shouldRetry: false, classification };
  }

  // Check if error category is retryable
  if (!config.retryableCategories.has(classification.category)) {
    return { shouldRetry: false, classification };
  }

  // Check if error is marked as retryable
  if (!classification.retryable) {
    return { shouldRetry: false, classification };
  }

  return { shouldRetry: true, classification };
}

/**
 * Create abort signal with timeout
 */
function createTimeoutSignal(timeoutMs: number, parentSignal?: AbortSignal): AbortSignal {
  const controller = new AbortController();

  // Handle parent signal abortion
  if (parentSignal?.aborted) {
    controller.abort();
    return controller.signal;
  }

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  // Handle parent signal abortion
  const parentHandler = () => {
    clearTimeout(timeoutId);
    controller.abort();
  };

  if (parentSignal) {
    parentSignal.addEventListener('abort', parentHandler, { once: true });
  }

  // Clean up timeout on completion
  controller.signal.addEventListener(
    'abort',
    () => {
      clearTimeout(timeoutId);
      if (parentSignal) {
        parentSignal.removeEventListener('abort', parentHandler);
      }
    },
    { once: true },
  );

  return controller.signal;
}

/**
 * Azure Speech retry manager
 */
export class RetryManager {
  private config: RetryConfig;

  constructor(config?: Partial<RetryConfig>) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  /**
   * Execute an operation with retry logic
   */
  async executeWithRetry<T>(
    operation: RetryOperation<T>,
    options?: {
      strategy?: RetryStrategy;
      config?: Partial<RetryConfig>;
      signal?: AbortSignal;
      onProgress?: RetryProgressCallback<T>;
    },
  ): Promise<RetryResult<T>> {
    const startTime = Date.now();
    const strategy = options?.strategy || RetryStrategy.EXPONENTIAL_BACKOFF;
    const config = {
      ...this.config,
      ...STRATEGY_CONFIGS[strategy],
      ...options?.config,
    };

    const attempts: RetryAttempt<T>[] = [];
    let lastError: Error | undefined;
    let lastClassification: ErrorClassification | undefined;

    for (let attemptNumber = 1; attemptNumber <= config.maxAttempts; attemptNumber++) {
      // Check if operation was cancelled
      if (options?.signal?.aborted) {
        lastError = new Error('Operation was cancelled');
        break;
      }

      // Calculate delay for this attempt
      const delayBefore = calculateDelay(attemptNumber, strategy, config);

      // Wait for delay (except for first attempt)
      if (delayBefore > 0) {
        try {
          await new Promise<void>((resolve, reject) => {
            const timeoutId = setTimeout(resolve, delayBefore);

            const abortHandler = () => {
              clearTimeout(timeoutId);
              reject(new Error('Operation was cancelled during delay'));
            };

            if (options?.signal) {
              options.signal.addEventListener('abort', abortHandler, { once: true });
            }
          });
        } catch (delayError) {
          lastError = delayError instanceof Error ? delayError : new Error('Delay cancelled');
          break;
        }
      }

      // Execute the attempt
      const attemptStart = Date.now();
      let attemptResult: RetryAttempt<T>;

      try {
        // Create timeout signal for this attempt
        const attemptSignal = createTimeoutSignal(config.attemptTimeout, options?.signal);

        const result = await operation(attemptNumber, attemptSignal);

        attemptResult = {
          attemptNumber,
          success: true,
          result,
          delayBefore,
          duration: Date.now() - attemptStart,
          timestamp: new Date(),
        };

        attempts.push(attemptResult);

        // Notify progress
        if (options?.onProgress) {
          options.onProgress(attemptResult);
        }

        // Success! Return immediately
        return {
          success: true,
          result,
          totalAttempts: attemptNumber,
          totalTime: Date.now() - startTime,
          attempts,
          retriesExhausted: false,
          executedAt: new Date(),
        };
      } catch (error) {
        const attemptError = error instanceof Error ? error : new Error('Unknown error');
        lastError = attemptError;

        // Classify the error
        const classification = ErrorClassifier.classifyError(attemptError);
        lastClassification = classification;

        attemptResult = {
          attemptNumber,
          success: false,
          error: attemptError,
          errorClassification: classification,
          delayBefore,
          duration: Date.now() - attemptStart,
          timestamp: new Date(),
        };

        attempts.push(attemptResult);

        // Notify progress
        if (options?.onProgress) {
          options.onProgress(attemptResult);
        }

        // Check if we should retry
        const { shouldRetry: retry } = shouldRetry(attemptError, attemptNumber, config);

        if (!retry) {
          break;
        }
      }
    }

    // All attempts failed
    return {
      success: false,
      ...(lastError && { error: lastError }),
      ...(lastClassification && { errorClassification: lastClassification }),
      totalAttempts: attempts.length,
      totalTime: Date.now() - startTime,
      attempts,
      retriesExhausted: attempts.length >= config.maxAttempts,
      executedAt: new Date(),
    };
  }

  /**
   * Execute with automatic strategy selection based on error type
   */
  async executeWithAutoRetry<T>(
    operation: RetryOperation<T>,
    options?: {
      config?: Partial<RetryConfig>;
      signal?: AbortSignal;
      onProgress?: RetryProgressCallback<T>;
    },
  ): Promise<RetryResult<T>> {
    // First attempt to determine strategy
    let strategy: RetryStrategy = RetryStrategy.EXPONENTIAL_BACKOFF;

    try {
      const result = await operation(1, options?.signal);
      return {
        success: true,
        result,
        totalAttempts: 1,
        totalTime: 0,
        attempts: [
          {
            attemptNumber: 1,
            success: true,
            result,
            delayBefore: 0,
            duration: 0,
            timestamp: new Date(),
          },
        ],
        retriesExhausted: false,
        executedAt: new Date(),
      };
    } catch (error) {
      const attemptError = error instanceof Error ? error : new Error('Unknown error');
      const classification = ErrorClassifier.classifyError(attemptError);
      strategy = classification.retryStrategy;
    }

    // Execute with determined strategy
    return this.executeWithRetry(operation, {
      ...options,
      strategy,
    });
  }

  /**
   * Execute multiple operations in parallel with retry
   */
  async executeParallelWithRetry<T>(
    operations: RetryOperation<T>[],
    options?: {
      strategy?: RetryStrategy;
      config?: Partial<RetryConfig>;
      concurrency?: number;
      signal?: AbortSignal;
      onProgress?: (index: number, attempt: RetryAttempt<T>) => void;
    },
  ): Promise<Array<RetryResult<T>>> {
    const concurrency = options?.concurrency || operations.length;
    const results: Array<RetryResult<T>> = [];

    // Process operations in batches
    for (let i = 0; i < operations.length; i += concurrency) {
      const batch = operations.slice(i, i + concurrency);

      const batchPromises = batch.map((operation, batchIndex) => {
        const operationIndex = i + batchIndex;

        return this.executeWithRetry(operation, {
          ...(options?.strategy && { strategy: options.strategy }),
          ...(options?.config && { config: options.config }),
          ...(options?.signal && { signal: options.signal }),
          ...(options?.onProgress && { onProgress: attempt => options.onProgress!(operationIndex, attempt) }),
        });
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Update retry configuration
   */
  updateConfig(config: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): RetryConfig {
    return { ...this.config };
  }

  /**
   * Get strategy-specific configuration
   */
  getStrategyConfig(strategy: RetryStrategy): RetryConfig {
    return {
      ...this.config,
      ...STRATEGY_CONFIGS[strategy],
    };
  }

  /**
   * Calculate total estimated time for retry sequence
   */
  estimateRetryTime(
    strategy: RetryStrategy,
    config?: Partial<RetryConfig>,
  ): {
    minTime: number;
    maxTime: number;
    averageTime: number;
  } {
    const finalConfig = {
      ...this.config,
      ...STRATEGY_CONFIGS[strategy],
      ...config,
    };

    let totalMinDelay = 0;
    let totalMaxDelay = 0;

    for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
      const baseDelay = calculateDelay(attempt, strategy, finalConfig);
      const minDelay = baseDelay * (1 - finalConfig.jitterFactor);
      const maxDelay = baseDelay * (1 + finalConfig.jitterFactor);

      totalMinDelay += Math.max(minDelay, 0);
      totalMaxDelay += Math.max(maxDelay, 0);
    }

    // Add attempt timeouts
    const totalAttemptTime = finalConfig.maxAttempts * finalConfig.attemptTimeout;

    return {
      minTime: totalMinDelay + totalAttemptTime,
      maxTime: totalMaxDelay + totalAttemptTime,
      averageTime: (totalMinDelay + totalMaxDelay) / 2 + totalAttemptTime,
    };
  }
}
