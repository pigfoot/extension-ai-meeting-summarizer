/**
 * Rate limiter for Azure Speech API requests
 * Implements API rate limiting to prevent quota exceeded errors
 * Provides request queuing and throttling mechanisms
 */

import type { SpeechServiceQuota } from '../types';
import type { TranscriptionError } from '../types/errors';
import { TranscriptionErrorType, ErrorCategory, RetryStrategy, ErrorSeverity } from '../types/errors';

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  /** Maximum requests per minute */
  requestsPerMinute: number;
  /** Maximum requests per hour */
  requestsPerHour: number;
  /** Maximum requests per day */
  requestsPerDay: number;
  /** Maximum concurrent requests */
  maxConcurrentRequests: number;
  /** Enable request queuing */
  enableQueuing: boolean;
  /** Maximum queue size */
  maxQueueSize: number;
  /** Queue timeout in milliseconds */
  queueTimeout: number;
  /** Enable adaptive rate limiting */
  enableAdaptive: boolean;
}

/**
 * Request metadata
 */
interface RequestMetadata {
  id: string;
  timestamp: Date;
  priority: 'low' | 'normal' | 'high';
  source: string;
  retryCount: number;
}

/**
 * Rate limiter statistics
 */
export interface RateLimiterStats {
  /** Total requests processed */
  totalRequests: number;
  /** Requests allowed through */
  allowedRequests: number;
  /** Requests rate limited */
  rateLimitedRequests: number;
  /** Requests currently queued */
  queuedRequests: number;
  /** Average queue wait time */
  averageQueueTime: number;
  /** Current requests per minute */
  currentRPM: number;
  /** Current requests per hour */
  currentRPH: number;
  /** Current requests per day */
  currentRPD: number;
  /** Active concurrent requests */
  activeConcurrentRequests: number;
}

/**
 * Rate limiter implementation
 */
export class AzureSpeechRateLimiter {
  private config: RateLimiterConfig;
  private requestHistory: RequestMetadata[] = [];
  private requestQueue: Array<{
    metadata: RequestMetadata;
    resolve: (allowed: boolean) => void;
    reject: (error: Error) => void;
    queuedAt: Date;
  }> = [];
  private activeConcurrentRequests = 0;
  private stats: RateLimiterStats;
  private quotaInfo?: SpeechServiceQuota;
  private adaptiveMultiplier = 1.0;

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = {
      requestsPerMinute: 20,
      requestsPerHour: 1000,
      requestsPerDay: 10000,
      maxConcurrentRequests: 5,
      enableQueuing: true,
      maxQueueSize: 100,
      queueTimeout: 30000, // 30 seconds
      enableAdaptive: true,
      ...config,
    };

    this.stats = {
      totalRequests: 0,
      allowedRequests: 0,
      rateLimitedRequests: 0,
      queuedRequests: 0,
      averageQueueTime: 0,
      currentRPM: 0,
      currentRPH: 0,
      currentRPD: 0,
      activeConcurrentRequests: 0,
    };

    // Start queue processor
    this.startQueueProcessor();

    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Check if request should be allowed
   */
  async allowRequest(source: string = 'unknown', priority: 'low' | 'normal' | 'high' = 'normal'): Promise<boolean> {
    const metadata: RequestMetadata = {
      id: this.generateRequestId(),
      timestamp: new Date(),
      priority,
      source,
      retryCount: 0,
    };

    this.stats.totalRequests++;

    // Check immediate availability
    if (this.canProcessImmediately(metadata)) {
      this.processRequest(metadata);
      this.stats.allowedRequests++;
      return true;
    }

    // If queuing is disabled, reject immediately
    if (!this.config.enableQueuing) {
      this.stats.rateLimitedRequests++;
      return false;
    }

    // Add to queue if possible
    if (this.requestQueue.length >= this.config.maxQueueSize) {
      this.stats.rateLimitedRequests++;
      throw this.createRateLimitError('Queue is full');
    }

    // Queue the request
    return new Promise((resolve, reject) => {
      const queueEntry = {
        metadata,
        resolve,
        reject,
        queuedAt: new Date(),
      };

      // Insert based on priority
      this.insertByPriority(queueEntry);
      this.stats.queuedRequests++;

      // Set timeout
      setTimeout(() => {
        const index = this.requestQueue.indexOf(queueEntry);
        if (index !== -1) {
          this.requestQueue.splice(index, 1);
          this.stats.queuedRequests--;
          reject(this.createRateLimitError('Queue timeout'));
        }
      }, this.config.queueTimeout);
    });
  }

  /**
   * Mark request as completed
   */
  completeRequest(requestId: string): void {
    this.activeConcurrentRequests = Math.max(0, this.activeConcurrentRequests - 1);
    this.stats.activeConcurrentRequests = this.activeConcurrentRequests;
  }

  /**
   * Update quota information from Azure API
   */
  updateQuotaInfo(quotaInfo: SpeechServiceQuota): void {
    this.quotaInfo = quotaInfo;

    // Adaptive rate limiting based on quota usage
    if (this.config.enableAdaptive) {
      const usageRatio = quotaInfo.current / quotaInfo.limit;

      if (usageRatio > 0.9) {
        // Slow down significantly when approaching limit
        this.adaptiveMultiplier = 0.1;
      } else if (usageRatio > 0.7) {
        // Moderate slowdown
        this.adaptiveMultiplier = 0.5;
      } else if (usageRatio > 0.5) {
        // Slight slowdown
        this.adaptiveMultiplier = 0.8;
      } else {
        // Normal rate
        this.adaptiveMultiplier = 1.0;
      }
    }
  }

  /**
   * Get current statistics
   */
  getStats(): RateLimiterStats {
    this.updateCurrentRates();
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      allowedRequests: 0,
      rateLimitedRequests: 0,
      queuedRequests: this.requestQueue.length,
      averageQueueTime: 0,
      currentRPM: 0,
      currentRPH: 0,
      currentRPD: 0,
      activeConcurrentRequests: this.activeConcurrentRequests,
    };
  }

  /**
   * Clear request queue
   */
  clearQueue(): void {
    const queuedRequests = this.requestQueue.splice(0);
    queuedRequests.forEach(entry => {
      entry.reject(this.createRateLimitError('Queue cleared'));
    });
    this.stats.queuedRequests = 0;
  }

  /**
   * Get quota information
   */
  getQuotaInfo(): SpeechServiceQuota | undefined {
    return this.quotaInfo;
  }

  /**
   * Check if request can be processed immediately
   */
  private canProcessImmediately(metadata: RequestMetadata): boolean {
    // Check concurrent request limit
    if (this.activeConcurrentRequests >= this.config.maxConcurrentRequests) {
      return false;
    }

    // Check rate limits with adaptive multiplier
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const recentRequests = this.requestHistory.filter(req => req.timestamp >= oneMinuteAgo);
    const hourlyRequests = this.requestHistory.filter(req => req.timestamp >= oneHourAgo);
    const dailyRequests = this.requestHistory.filter(req => req.timestamp >= oneDayAgo);

    const adjustedRPM = Math.floor(this.config.requestsPerMinute * this.adaptiveMultiplier);
    const adjustedRPH = Math.floor(this.config.requestsPerHour * this.adaptiveMultiplier);
    const adjustedRPD = Math.floor(this.config.requestsPerDay * this.adaptiveMultiplier);

    return (
      recentRequests.length < adjustedRPM && hourlyRequests.length < adjustedRPH && dailyRequests.length < adjustedRPD
    );
  }

  /**
   * Process request and update tracking
   */
  private processRequest(metadata: RequestMetadata): void {
    this.requestHistory.push(metadata);
    this.activeConcurrentRequests++;
    this.stats.activeConcurrentRequests = this.activeConcurrentRequests;
  }

  /**
   * Insert request into queue by priority
   */
  private insertByPriority(queueEntry: {
    metadata: RequestMetadata;
    resolve: (allowed: boolean) => void;
    reject: (error: Error) => void;
    queuedAt: Date;
  }): void {
    const priorityOrder: Record<string, number> = { high: 0, normal: 1, low: 2 };
    const entryPriority = queueEntry?.metadata?.priority;
    const priority = priorityOrder[entryPriority] ?? 1; // Default to normal priority

    let insertIndex = this.requestQueue.length;
    for (let i = 0; i < this.requestQueue.length; i++) {
      const entry = this.requestQueue[i];
      if (!entry) continue;
      
      const existingEntryPriority = entry.metadata?.priority;
      const existingPriority = priorityOrder[existingEntryPriority] ?? 1;
      if (priority < existingPriority) {
        insertIndex = i;
        break;
      }
    }

    this.requestQueue.splice(insertIndex, 0, queueEntry);
  }

  /**
   * Start queue processor
   */
  private startQueueProcessor(): void {
    setInterval(() => {
      if (this.requestQueue.length === 0) {
        return;
      }

      const entry = this.requestQueue[0];
      if (!entry) return;
      
      if (this.canProcessImmediately(entry.metadata)) {
        this.requestQueue.shift();
        this.stats.queuedRequests--;

        // Calculate queue wait time
        const waitTime = Date.now() - (entry.queuedAt?.getTime() ?? Date.now());
        this.updateAverageQueueTime(waitTime);

        this.processRequest(entry.metadata);
        this.stats.allowedRequests++;
        entry.resolve(true);
      }
    }, 100); // Check every 100ms
  }

  /**
   * Start cleanup interval to remove old requests
   */
  private startCleanupInterval(): void {
    setInterval(
      () => {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        this.requestHistory = this.requestHistory.filter(req => req.timestamp >= oneDayAgo);
      },
      60 * 60 * 1000,
    ); // Clean up every hour
  }

  /**
   * Update current rate calculations
   */
  private updateCurrentRates(): void {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    this.stats.currentRPM = this.requestHistory.filter(req => req.timestamp >= oneMinuteAgo).length;
    this.stats.currentRPH = this.requestHistory.filter(req => req.timestamp >= oneHourAgo).length;
    this.stats.currentRPD = this.requestHistory.filter(req => req.timestamp >= oneDayAgo).length;
  }

  /**
   * Update average queue time
   */
  private updateAverageQueueTime(newWaitTime: number): void {
    const alpha = 0.1; // Exponential moving average factor
    this.stats.averageQueueTime = this.stats.averageQueueTime * (1 - alpha) + newWaitTime * alpha;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create rate limit error
   */
  private createRateLimitError(message: string): TranscriptionError {
    return {
      name: 'TranscriptionError',
      type: TranscriptionErrorType.RATE_LIMIT_EXCEEDED,
      category: ErrorCategory.QUOTA,
      message: `Rate limit exceeded: ${message}`,
      retryable: true,
      retryStrategy: RetryStrategy.EXPONENTIAL_BACKOFF,
      retryAfter: this.calculateRetryAfter(),
      severity: ErrorSeverity.MEDIUM,
      timestamp: new Date(),
      notifyUser: true,
      recoverySuggestions: [
        'Wait for rate limit to reset',
        'Consider upgrading your Azure subscription',
        'Reduce request frequency',
      ],
    };
  }

  /**
   * Calculate suggested retry delay
   */
  private calculateRetryAfter(): number {
    const now = new Date();
    const oneMinuteFromNow = new Date(now.getTime() + 60 * 1000);

    // Find when we'll have capacity again
    const recentRequests = this.requestHistory.filter(req => req.timestamp >= new Date(now.getTime() - 60 * 1000));

    if (recentRequests.length >= this.config.requestsPerMinute) {
      // Find the oldest request in the current minute window
      const oldestRequest = recentRequests.reduce((oldest, current) =>
        current.timestamp < oldest.timestamp ? current : oldest,
      );

      // Suggest waiting until that request falls outside the window
      return Math.max(1000, oneMinuteFromNow.getTime() - oldestRequest.timestamp.getTime());
    }

    return 5000; // Default 5 seconds
  }
}

/**
 * Global rate limiter instance
 */
let globalRateLimiter: AzureSpeechRateLimiter | undefined;

/**
 * Get or create global rate limiter instance
 */
export function getRateLimiter(config?: Partial<RateLimiterConfig>): AzureSpeechRateLimiter {
  if (!globalRateLimiter) {
    globalRateLimiter = new AzureSpeechRateLimiter(config);
  }
  return globalRateLimiter;
}

/**
 * Reset global rate limiter
 */
export function resetGlobalRateLimiter(): void {
  globalRateLimiter = undefined;
}

/**
 * Rate limiter utility functions
 */
export const RateLimiterUtils = {
  /**
   * Create rate limiter optimized for meeting transcription
   */
  createMeetingRateLimiter(): AzureSpeechRateLimiter {
    return new AzureSpeechRateLimiter({
      requestsPerMinute: 10, // Conservative for large files
      requestsPerHour: 500,
      requestsPerDay: 5000,
      maxConcurrentRequests: 3,
      enableQueuing: true,
      maxQueueSize: 50,
      queueTimeout: 60000, // 1 minute for large files
      enableAdaptive: true,
    });
  },

  /**
   * Create rate limiter for high-volume processing
   */
  createHighVolumeRateLimiter(): AzureSpeechRateLimiter {
    return new AzureSpeechRateLimiter({
      requestsPerMinute: 50,
      requestsPerHour: 2000,
      requestsPerDay: 20000,
      maxConcurrentRequests: 10,
      enableQueuing: true,
      maxQueueSize: 200,
      queueTimeout: 30000,
      enableAdaptive: true,
    });
  },

  /**
   * Calculate optimal rate limits based on quota
   */
  calculateOptimalLimits(quota: SpeechServiceQuota): Partial<RateLimiterConfig> {
    const safetyMargin = 0.8; // Use 80% of available quota
    const dailyLimit = Math.floor(quota.limit * safetyMargin);
    const hourlyLimit = Math.floor(dailyLimit / 24);
    const minuteLimit = Math.floor(hourlyLimit / 60);

    return {
      requestsPerDay: dailyLimit,
      requestsPerHour: hourlyLimit,
      requestsPerMinute: Math.max(1, minuteLimit),
    };
  },
};
