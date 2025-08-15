/**
 * Azure Speech circuit breaker
 * Implements circuit breaker pattern for service outages with automatic recovery
 * and comprehensive service health monitoring
 */

import { ErrorClassifier } from './error-classifier';
import { ErrorCategory } from '../types/errors';
import type { ErrorClassification } from './error-classifier';

/**
 * Circuit breaker states
 */
export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Failure threshold to open circuit */
  failureThreshold: number;
  /** Success threshold to close circuit from half-open state */
  successThreshold: number;
  /** Timeout before attempting to close circuit (ms) */
  timeout: number;
  /** Rolling window size for failure tracking */
  rollingWindowSize: number;
  /** Rolling window time span (ms) */
  rollingWindowTime: number;
  /** Error categories that should trigger circuit breaker */
  triggerCategories: Set<ErrorCategory>;
  /** Minimum requests before circuit can open */
  minimumRequests: number;
  /** Whether to allow some requests through in half-open state */
  allowPartialTraffic: boolean;
  /** Percentage of traffic to allow in half-open state (0-1) */
  halfOpenTrafficRatio: number;
}

/**
 * Circuit breaker call result
 */
export interface CircuitBreakerResult<T> {
  /** Whether the call was allowed through the circuit breaker */
  allowed: boolean;
  /** Result if call was successful */
  result?: T;
  /** Error if call failed */
  error?: Error;
  /** Error classification if call failed */
  errorClassification?: ErrorClassification;
  /** Current circuit breaker state */
  state: CircuitBreakerState;
  /** Call duration in milliseconds */
  duration: number;
  /** Timestamp of the call */
  timestamp: Date;
  /** Whether call was rejected due to circuit breaker */
  rejectedByCircuit: boolean;
}

/**
 * Circuit breaker statistics
 */
export interface CircuitBreakerStats {
  /** Current state */
  state: CircuitBreakerState;
  /** Failure rate in current window (0-1) */
  failureRate: number;
  /** Total calls in current window */
  totalCalls: number;
  /** Failed calls in current window */
  failedCalls: number;
  /** Successful calls in current window */
  successfulCalls: number;
  /** Calls rejected by circuit breaker */
  rejectedCalls: number;
  /** Time since state last changed (ms) */
  timeSinceStateChange: number;
  /** Time until next state transition attempt (ms) */
  timeUntilNextAttempt: number;
  /** Last error that triggered state change */
  lastError?: ErrorClassification;
  /** Statistics collection timestamp */
  timestamp: Date;
}

/**
 * Call record for tracking
 */
interface CallRecord {
  /** Call timestamp */
  timestamp: Date;
  /** Whether call was successful */
  success: boolean;
  /** Error classification if failed */
  errorClassification?: ErrorClassification;
  /** Call duration */
  duration: number;
}

/**
 * Circuit breaker operation function type
 */
export type CircuitBreakerOperation<T> = () => Promise<T>;

/**
 * Circuit breaker event callback
 */
export type CircuitBreakerEventCallback = (
  event: 'OPEN' | 'CLOSE' | 'HALF_OPEN' | 'CALL_SUCCESS' | 'CALL_FAILURE' | 'CALL_REJECTED',
  stats: CircuitBreakerStats,
) => void;

/**
 * Default circuit breaker configuration
 */
const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 0.5, // 50% failure rate
  successThreshold: 3, // 3 consecutive successes
  timeout: 60000, // 1 minute
  rollingWindowSize: 10,
  rollingWindowTime: 60000, // 1 minute
  triggerCategories: new Set([ErrorCategory.SERVICE, ErrorCategory.NETWORK, ErrorCategory.UNKNOWN]),
  minimumRequests: 5,
  allowPartialTraffic: true,
  halfOpenTrafficRatio: 0.1, // 10% of traffic
};

/**
 * Create circuit breaker rejection error
 */
const createRejectionError = (state: CircuitBreakerState): Error =>
  new Error(`Circuit breaker is ${state}. Service calls are temporarily blocked to prevent cascading failures.`);

/**
 * Azure Speech circuit breaker
 */
export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitBreakerState = 'CLOSED';
  private callHistory: CallRecord[] = [];
  private lastStateChange: Date = new Date();
  private consecutiveSuccesses = 0;
  private halfOpenCallCount = 0;
  private eventCallback?: CircuitBreakerEventCallback;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute operation through circuit breaker
   */
  async execute<T>(operation: CircuitBreakerOperation<T>): Promise<CircuitBreakerResult<T>> {
    const startTime = Date.now();

    // Check if call should be allowed
    if (!this.shouldAllowCall()) {
      const error = createRejectionError(this.state);
      const result: CircuitBreakerResult<T> = {
        allowed: false,
        error,
        state: this.state,
        duration: Date.now() - startTime,
        timestamp: new Date(),
        rejectedByCircuit: true,
      };

      this.recordRejection();
      this.notifyEvent('CALL_REJECTED');
      return result;
    }

    // Execute the operation
    try {
      const operationResult = await operation();
      const duration = Date.now() - startTime;

      // Record successful call
      this.recordSuccess(duration);

      const result: CircuitBreakerResult<T> = {
        allowed: true,
        result: operationResult,
        state: this.state,
        duration,
        timestamp: new Date(),
        rejectedByCircuit: false,
      };

      this.notifyEvent('CALL_SUCCESS');
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const callError = error instanceof Error ? error : new Error('Unknown error');
      const errorClassification = ErrorClassifier.classifyError(callError);

      // Record failed call
      this.recordFailure(duration, errorClassification);

      const result: CircuitBreakerResult<T> = {
        allowed: true,
        error: callError,
        errorClassification,
        state: this.state,
        duration,
        timestamp: new Date(),
        rejectedByCircuit: false,
      };

      this.notifyEvent('CALL_FAILURE');
      return result;
    }
  }

  /**
   * Check if call should be allowed based on current state
   */
  private shouldAllowCall(): boolean {
    const now = Date.now();

    switch (this.state) {
      case 'CLOSED':
        return true;

      case 'OPEN': {
        // Check if timeout has passed
        const timeSinceOpen = now - this.lastStateChange.getTime();
        if (timeSinceOpen >= this.config.timeout) {
          this.transitionToHalfOpen();
          return true;
        }
        return false;
      }

      case 'HALF_OPEN':
        // Allow some traffic through
        if (this.config.allowPartialTraffic) {
          this.halfOpenCallCount++;
          // Allow traffic based on ratio
          return Math.random() < this.config.halfOpenTrafficRatio;
        } else {
          // Allow limited number of test calls
          return this.halfOpenCallCount < this.config.successThreshold;
        }

      default:
        return false;
    }
  }

  /**
   * Record successful call
   */
  private recordSuccess(duration: number): void {
    const callRecord: CallRecord = {
      timestamp: new Date(),
      success: true,
      duration,
    };

    this.addCallRecord(callRecord);

    // Handle state transitions
    if (this.state === 'HALF_OPEN') {
      this.consecutiveSuccesses++;
      if (this.consecutiveSuccesses >= this.config.successThreshold) {
        this.transitionToClosed();
      }
    } else if (this.state === 'CLOSED') {
      this.consecutiveSuccesses++;
    }
  }

  /**
   * Record failed call
   */
  private recordFailure(duration: number, errorClassification: ErrorClassification): void {
    const callRecord: CallRecord = {
      timestamp: new Date(),
      success: false,
      errorClassification,
      duration,
    };

    this.addCallRecord(callRecord);
    this.consecutiveSuccesses = 0;

    // Check if error should trigger circuit breaker
    if (this.shouldTriggerOnError(errorClassification)) {
      // Check if we should open the circuit
      if (this.state === 'CLOSED' && this.shouldOpenCircuit()) {
        this.transitionToOpen(errorClassification);
      } else if (this.state === 'HALF_OPEN') {
        // Any failure in half-open state returns to open
        this.transitionToOpen(errorClassification);
      }
    }
  }

  /**
   * Record rejected call
   */
  private recordRejection(): void {
    // Rejections don't count as calls for failure rate calculation
    // but we track them for statistics
  }

  /**
   * Add call record to history
   */
  private addCallRecord(record: CallRecord): void {
    this.callHistory.push(record);
    this.cleanupOldRecords();
  }

  /**
   * Remove old records outside the rolling window
   */
  private cleanupOldRecords(): void {
    const now = Date.now();
    const cutoffTime = now - this.config.rollingWindowTime;

    this.callHistory = this.callHistory.filter(record => record.timestamp.getTime() > cutoffTime);

    // Also limit by window size
    if (this.callHistory.length > this.config.rollingWindowSize) {
      this.callHistory = this.callHistory.slice(-this.config.rollingWindowSize);
    }
  }

  /**
   * Check if error should trigger circuit breaker
   */
  private shouldTriggerOnError(errorClassification: ErrorClassification): boolean {
    return this.config.triggerCategories.has(errorClassification.category);
  }

  /**
   * Check if circuit should be opened
   */
  private shouldOpenCircuit(): boolean {
    const recentCalls = this.getRecentCalls();

    if (recentCalls.length < this.config.minimumRequests) {
      return false;
    }

    const failures = recentCalls.filter(call => !call.success).length;
    const failureRate = failures / recentCalls.length;

    return failureRate >= this.config.failureThreshold;
  }

  /**
   * Get recent calls within the rolling window
   */
  private getRecentCalls(): CallRecord[] {
    this.cleanupOldRecords();
    return this.callHistory;
  }

  /**
   * Transition to OPEN state
   */
  private transitionToOpen(_errorClassification?: ErrorClassification): void {
    this.state = 'OPEN';
    this.lastStateChange = new Date();
    this.consecutiveSuccesses = 0;
    this.halfOpenCallCount = 0;

    this.notifyEvent('OPEN');
  }

  /**
   * Transition to HALF_OPEN state
   */
  private transitionToHalfOpen(): void {
    this.state = 'HALF_OPEN';
    this.lastStateChange = new Date();
    this.consecutiveSuccesses = 0;
    this.halfOpenCallCount = 0;

    this.notifyEvent('HALF_OPEN');
  }

  /**
   * Transition to CLOSED state
   */
  private transitionToClosed(): void {
    this.state = 'CLOSED';
    this.lastStateChange = new Date();
    this.consecutiveSuccesses = 0;
    this.halfOpenCallCount = 0;

    this.notifyEvent('CLOSE');
  }

  /**
   * Notify event callback
   */
  private notifyEvent(event: 'OPEN' | 'CLOSE' | 'HALF_OPEN' | 'CALL_SUCCESS' | 'CALL_FAILURE' | 'CALL_REJECTED'): void {
    if (this.eventCallback) {
      const stats = this.getStats();
      this.eventCallback(event, stats);
    }
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    const recentCalls = this.getRecentCalls();
    const failedCalls = recentCalls.filter(call => !call.success).length;
    const successfulCalls = recentCalls.length - failedCalls;
    const failureRate = recentCalls.length > 0 ? failedCalls / recentCalls.length : 0;

    const now = Date.now();
    const timeSinceStateChange = now - this.lastStateChange.getTime();

    let timeUntilNextAttempt = 0;
    if (this.state === 'OPEN') {
      timeUntilNextAttempt = Math.max(0, this.config.timeout - timeSinceStateChange);
    }

    // Find last error
    const lastFailure = [...recentCalls].reverse().find(call => !call.success);

    return {
      state: this.state,
      failureRate,
      totalCalls: recentCalls.length,
      failedCalls,
      successfulCalls,
      rejectedCalls: 0, // We don't track rejected calls in history
      timeSinceStateChange,
      timeUntilNextAttempt,
      timestamp: new Date(),
      ...(lastFailure?.errorClassification && { lastError: lastFailure.errorClassification }),
    };
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Force state transition (for testing or manual intervention)
   */
  forceState(state: CircuitBreakerState): void {
    switch (state) {
      case 'OPEN':
        this.transitionToOpen();
        break;
      case 'HALF_OPEN':
        this.transitionToHalfOpen();
        break;
      case 'CLOSED':
        this.transitionToClosed();
        break;
    }
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset(): void {
    this.state = 'CLOSED';
    this.callHistory = [];
    this.lastStateChange = new Date();
    this.consecutiveSuccesses = 0;
    this.halfOpenCallCount = 0;
  }

  /**
   * Set event callback
   */
  setEventCallback(callback: CircuitBreakerEventCallback): void {
    this.eventCallback = callback;
  }

  /**
   * Clear event callback
   */
  clearEventCallback(): void {
    delete this.eventCallback;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CircuitBreakerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): CircuitBreakerConfig {
    return { ...this.config };
  }

  /**
   * Check if circuit breaker is allowing calls
   */
  isAllowingCalls(): boolean {
    return this.shouldAllowCall();
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    healthy: boolean;
    state: CircuitBreakerState;
    failureRate: number;
    message: string;
  } {
    const stats = this.getStats();

    let healthy: boolean;
    let message: string;

    switch (this.state) {
      case 'CLOSED':
        healthy = stats.failureRate < this.config.failureThreshold;
        message = healthy ? 'Service is healthy' : 'Service is experiencing some failures';
        break;

      case 'HALF_OPEN':
        healthy = false;
        message = 'Service is recovering, allowing limited traffic';
        break;

      case 'OPEN':
        healthy = false;
        message = 'Service is unhealthy, circuit breaker is protecting against failures';
        break;

      default:
        healthy = false;
        message = 'Unknown circuit breaker state';
    }

    return {
      healthy,
      state: this.state,
      failureRate: stats.failureRate,
      message,
    };
  }
}
