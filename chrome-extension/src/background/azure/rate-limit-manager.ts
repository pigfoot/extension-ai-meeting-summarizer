/**
 * Rate limit manager for Azure Speech API quota management
 * Implements intelligent queuing, backoff strategies, and quota monitoring
 */

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Requests per minute limit */
  requestsPerMinute: number;
  /** Requests per hour limit */
  requestsPerHour: number;
  /** Requests per day limit */
  requestsPerDay: number;
  /** Concurrent request limit */
  concurrentRequests: number;
  /** Enable adaptive rate limiting */
  enableAdaptive: boolean;
  /** Backoff strategy configuration */
  backoff: {
    /** Initial delay in milliseconds */
    initialDelay: number;
    /** Maximum delay in milliseconds */
    maxDelay: number;
    /** Exponential backoff factor */
    factor: number;
    /** Maximum retry attempts */
    maxRetries: number;
  };
}

/**
 * Rate limit bucket for tracking usage
 */
export interface RateLimitBucket {
  /** Bucket identifier */
  bucketId: string;
  /** Current request count */
  currentCount: number;
  /** Maximum allowed requests */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Window start time */
  windowStart: number;
  /** Requests in current window */
  requests: Array<{
    timestamp: number;
    duration: number;
    success: boolean;
  }>;
}

/**
 * API request info for rate limiting
 */
export interface APIRequestInfo {
  /** Request identifier */
  requestId: string;
  /** Request type */
  type: 'transcription' | 'authentication' | 'health_check';
  /** Request priority */
  priority: 'low' | 'normal' | 'high' | 'urgent';
  /** Estimated processing time */
  estimatedDuration: number;
  /** Request timestamp */
  timestamp: number;
  /** Retry count */
  retryCount: number;
}

/**
 * Rate limit violation info
 */
export interface RateLimitViolation {
  /** Violation timestamp */
  timestamp: string;
  /** Violation type */
  type: 'requests_per_minute' | 'requests_per_hour' | 'requests_per_day' | 'concurrent_limit';
  /** Current usage */
  currentUsage: number;
  /** Limit that was exceeded */
  limit: number;
  /** Recommended delay */
  recommendedDelay: number;
  /** Request that caused violation */
  requestInfo: APIRequestInfo;
}

/**
 * Rate limit statistics
 */
export interface RateLimitStats {
  /** Total requests processed */
  totalRequests: number;
  /** Successful requests */
  successfulRequests: number;
  /** Rate limited requests */
  rateLimitedRequests: number;
  /** Current requests per minute */
  currentRPM: number;
  /** Current requests per hour */
  currentRPH: number;
  /** Current requests per day */
  currentRPD: number;
  /** Current concurrent requests */
  currentConcurrent: number;
  /** Average response time */
  avgResponseTime: number;
  /** Rate limit violations */
  violations: number;
  /** Quota utilization percentage */
  quotaUtilization: {
    minute: number;
    hour: number;
    day: number;
    concurrent: number;
  };
  /** Last update timestamp */
  lastUpdated: string;
}

/**
 * Rate limit manager for Azure API quota management
 */
export class RateLimitManager {
  private config: RateLimitConfig;
  private buckets: Map<string, RateLimitBucket> = new Map();
  private requestQueue: APIRequestInfo[] = [];
  private activeRequests = new Set<string>();
  private stats: RateLimitStats;
  private violations: RateLimitViolation[] = [];
  private adaptiveConfig: RateLimitConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.adaptiveConfig = { ...config };
    this.stats = this.initializeStats();

    // Initialize rate limit buckets
    this.initializeBuckets();

    // Start cleanup task
    this.startCleanupTask();
  }

  /**
   * Check if request can be processed within rate limits
   */
  async canProcessRequest(requestInfo: APIRequestInfo): Promise<{
    allowed: boolean;
    delayMs: number;
    reason?: string;
  }> {
    try {
      // Check concurrent request limit
      if (this.activeRequests.size >= this.getCurrentConcurrentLimit()) {
        return {
          allowed: false,
          delayMs: this.calculateBackoffDelay(requestInfo.retryCount),
          reason: 'Concurrent request limit exceeded',
        };
      }

      // Check per-minute limit
      const minuteBucket = this.buckets.get('minute');
      if (minuteBucket && !this.canMakeRequest(minuteBucket)) {
        return {
          allowed: false,
          delayMs: this.calculateWindowDelay(minuteBucket),
          reason: 'Requests per minute limit exceeded',
        };
      }

      // Check per-hour limit
      const hourBucket = this.buckets.get('hour');
      if (hourBucket && !this.canMakeRequest(hourBucket)) {
        return {
          allowed: false,
          delayMs: this.calculateWindowDelay(hourBucket),
          reason: 'Requests per hour limit exceeded',
        };
      }

      // Check per-day limit
      const dayBucket = this.buckets.get('day');
      if (dayBucket && !this.canMakeRequest(dayBucket)) {
        return {
          allowed: false,
          delayMs: this.calculateWindowDelay(dayBucket),
          reason: 'Requests per day limit exceeded',
        };
      }

      return { allowed: true, delayMs: 0 };
    } catch (error) {
      console.error('[RateLimitManager] Error checking request limits:', error);
      return {
        allowed: false,
        delayMs: 5000,
        reason: 'Rate limit check error',
      };
    }
  }

  /**
   * Queue request for processing with rate limiting
   */
  async queueRequest(requestInfo: APIRequestInfo): Promise<void> {
    console.log(`[RateLimitManager] Queuing request: ${requestInfo.requestId} (${requestInfo.type})`);

    // Add to queue with priority ordering
    this.insertRequestByPriority(requestInfo);

    // Process queue
    await this.processQueue();
  }

  /**
   * Record request start for rate limit tracking
   */
  recordRequestStart(requestId: string): void {
    this.activeRequests.add(requestId);

    // Update buckets
    const now = Date.now();
    for (const bucket of this.buckets.values()) {
      bucket.currentCount++;
      bucket.requests.push({
        timestamp: now,
        duration: 0,
        success: true, // Will be updated on completion
      });
    }

    // Update statistics
    this.stats.totalRequests++;
    this.stats.currentConcurrent = this.activeRequests.size;
    this.updateCurrentRates();
  }

  /**
   * Record request completion
   */
  recordRequestCompletion(requestId: string, success: boolean, duration: number): void {
    this.activeRequests.delete(requestId);

    // Update request records
    const now = Date.now();
    for (const bucket of this.buckets.values()) {
      const request = bucket.requests.find(r => Math.abs(r.timestamp - (now - duration)) < 1000);
      if (request) {
        request.duration = duration;
        request.success = success;
      }
    }

    // Update statistics
    if (success) {
      this.stats.successfulRequests++;
    }

    this.stats.currentConcurrent = this.activeRequests.size;
    this.updateAverageResponseTime(duration);
    this.updateCurrentRates();

    // Apply adaptive rate limiting if enabled
    if (this.config.enableAdaptive) {
      this.applyAdaptiveAdjustments(success, duration);
    }

    console.log(`[RateLimitManager] Request completed: ${requestId} (success: ${success}, duration: ${duration}ms)`);
  }

  /**
   * Record rate limit violation
   */
  recordViolation(violation: RateLimitViolation): void {
    this.violations.push(violation);
    this.stats.violations++;
    this.stats.rateLimitedRequests++;

    // Keep only recent violations
    if (this.violations.length > 100) {
      this.violations = this.violations.slice(-100);
    }

    console.warn(
      `[RateLimitManager] Rate limit violation: ${violation.type} (${violation.currentUsage}/${violation.limit})`,
    );
  }

  /**
   * Get current rate limit statistics
   */
  getStats(): RateLimitStats {
    this.updateCurrentRates();
    this.updateQuotaUtilization();
    this.stats.lastUpdated = new Date().toISOString();
    return { ...this.stats };
  }

  /**
   * Get recent rate limit violations
   */
  getRecentViolations(minutes: number = 60): RateLimitViolation[] {
    const cutoff = Date.now() - minutes * 60 * 1000;
    return this.violations.filter(v => new Date(v.timestamp).getTime() > cutoff);
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    queueLength: number;
    activeRequests: number;
    averageWaitTime: number;
    requestsByPriority: Record<string, number>;
  } {
    const requestsByPriority = {
      urgent: 0,
      high: 0,
      normal: 0,
      low: 0,
    };

    for (const request of this.requestQueue) {
      requestsByPriority[request.priority]++;
    }

    return {
      queueLength: this.requestQueue.length,
      activeRequests: this.activeRequests.size,
      averageWaitTime: this.calculateAverageWaitTime(),
      requestsByPriority,
    };
  }

  /**
   * Update rate limit configuration
   */
  updateConfig(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config };
    this.adaptiveConfig = { ...this.config };

    // Reinitialize buckets with new limits
    this.initializeBuckets();

    console.log('[RateLimitManager] Configuration updated');
  }

  /**
   * Clear rate limit history and reset counters
   */
  reset(): void {
    this.buckets.clear();
    this.requestQueue = [];
    this.activeRequests.clear();
    this.violations = [];
    this.stats = this.initializeStats();

    this.initializeBuckets();

    console.log('[RateLimitManager] Rate limits reset');
  }

  /**
   * Shutdown rate limit manager
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.buckets.clear();
    this.requestQueue = [];
    this.activeRequests.clear();
    this.violations = [];

    console.log('[RateLimitManager] Shutdown completed');
  }

  /**
   * Initialize rate limit buckets
   */
  private initializeBuckets(): void {
    this.buckets.clear();

    // Minute bucket
    this.buckets.set('minute', {
      bucketId: 'minute',
      currentCount: 0,
      maxRequests: this.config.requestsPerMinute,
      windowMs: 60 * 1000,
      windowStart: Date.now(),
      requests: [],
    });

    // Hour bucket
    this.buckets.set('hour', {
      bucketId: 'hour',
      currentCount: 0,
      maxRequests: this.config.requestsPerHour,
      windowMs: 60 * 60 * 1000,
      windowStart: Date.now(),
      requests: [],
    });

    // Day bucket
    this.buckets.set('day', {
      bucketId: 'day',
      currentCount: 0,
      maxRequests: this.config.requestsPerDay,
      windowMs: 24 * 60 * 60 * 1000,
      windowStart: Date.now(),
      requests: [],
    });
  }

  /**
   * Check if request can be made within bucket limits
   */
  private canMakeRequest(bucket: RateLimitBucket): boolean {
    this.cleanupBucket(bucket);
    return bucket.currentCount < bucket.maxRequests;
  }

  /**
   * Clean up expired requests from bucket
   */
  private cleanupBucket(bucket: RateLimitBucket): void {
    const now = Date.now();
    const windowStart = now - bucket.windowMs;

    // Remove expired requests
    bucket.requests = bucket.requests.filter(req => req.timestamp >= windowStart);
    bucket.currentCount = bucket.requests.length;

    // Update window start if needed
    if (bucket.requests.length === 0) {
      bucket.windowStart = now;
    }
  }

  /**
   * Calculate delay until bucket window resets
   */
  private calculateWindowDelay(bucket: RateLimitBucket): number {
    if (bucket.requests.length === 0) return 0;

    const oldestRequest = bucket.requests[0];
    const windowEnd = oldestRequest.timestamp + bucket.windowMs;
    const delay = Math.max(0, windowEnd - Date.now());

    return delay + 1000; // Add 1 second buffer
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(retryCount: number): number {
    const { initialDelay, maxDelay, factor } = this.config.backoff;
    const delay = Math.min(initialDelay * Math.pow(factor, retryCount), maxDelay);

    // Add jitter to prevent thundering herd
    const jitter = delay * 0.1 * Math.random();
    return Math.floor(delay + jitter);
  }

  /**
   * Insert request into queue by priority
   */
  private insertRequestByPriority(requestInfo: APIRequestInfo): void {
    const priorities = ['urgent', 'high', 'normal', 'low'];
    const requestPriorityIndex = priorities.indexOf(requestInfo.priority);

    let insertIndex = this.requestQueue.length;
    for (let i = 0; i < this.requestQueue.length; i++) {
      const queuedPriorityIndex = priorities.indexOf(this.requestQueue[i].priority);
      if (requestPriorityIndex < queuedPriorityIndex) {
        insertIndex = i;
        break;
      }
    }

    this.requestQueue.splice(insertIndex, 0, requestInfo);
  }

  /**
   * Process request queue
   */
  private async processQueue(): Promise<void> {
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue[0];

      const canProcess = await this.canProcessRequest(request);
      if (!canProcess.allowed) {
        if (canProcess.delayMs > 0) {
          console.log(`[RateLimitManager] Delaying queue processing: ${canProcess.delayMs}ms (${canProcess.reason})`);
          setTimeout(() => this.processQueue(), canProcess.delayMs);
        }
        break;
      }

      // Remove from queue and start processing
      this.requestQueue.shift();
      this.recordRequestStart(request.requestId);

      console.log(`[RateLimitManager] Processing request: ${request.requestId}`);
    }
  }

  /**
   * Get current concurrent limit (may be adjusted adaptively)
   */
  private getCurrentConcurrentLimit(): number {
    return this.adaptiveConfig.concurrentRequests;
  }

  /**
   * Apply adaptive rate limiting adjustments
   */
  private applyAdaptiveAdjustments(success: boolean, duration: number): void {
    const currentSuccessRate = this.stats.successfulRequests / Math.max(1, this.stats.totalRequests);

    // If success rate is low, reduce limits
    if (currentSuccessRate < 0.8) {
      this.adaptiveConfig.concurrentRequests = Math.max(1, Math.floor(this.adaptiveConfig.concurrentRequests * 0.9));
      console.log(`[RateLimitManager] Adaptive: Reduced concurrent limit to ${this.adaptiveConfig.concurrentRequests}`);
    }
    // If success rate is high and response times are good, gradually increase
    else if (currentSuccessRate > 0.95 && duration < 3000) {
      this.adaptiveConfig.concurrentRequests = Math.min(
        this.config.concurrentRequests,
        this.adaptiveConfig.concurrentRequests + 1,
      );
    }
  }

  /**
   * Update current request rates
   */
  private updateCurrentRates(): void {
    const _now = Date.now();

    // Calculate RPM
    const minuteBucket = this.buckets.get('minute');
    if (minuteBucket) {
      this.cleanupBucket(minuteBucket);
      this.stats.currentRPM = minuteBucket.currentCount;
    }

    // Calculate RPH
    const hourBucket = this.buckets.get('hour');
    if (hourBucket) {
      this.cleanupBucket(hourBucket);
      this.stats.currentRPH = hourBucket.currentCount;
    }

    // Calculate RPD
    const dayBucket = this.buckets.get('day');
    if (dayBucket) {
      this.cleanupBucket(dayBucket);
      this.stats.currentRPD = dayBucket.currentCount;
    }
  }

  /**
   * Update quota utilization percentages
   */
  private updateQuotaUtilization(): void {
    this.stats.quotaUtilization = {
      minute: (this.stats.currentRPM / this.config.requestsPerMinute) * 100,
      hour: (this.stats.currentRPH / this.config.requestsPerHour) * 100,
      day: (this.stats.currentRPD / this.config.requestsPerDay) * 100,
      concurrent: (this.stats.currentConcurrent / this.config.concurrentRequests) * 100,
    };
  }

  /**
   * Update average response time
   */
  private updateAverageResponseTime(duration: number): void {
    const totalRequests = this.stats.successfulRequests;
    if (totalRequests === 1) {
      this.stats.avgResponseTime = duration;
    } else {
      this.stats.avgResponseTime = (this.stats.avgResponseTime * (totalRequests - 1) + duration) / totalRequests;
    }
  }

  /**
   * Calculate average wait time in queue
   */
  private calculateAverageWaitTime(): number {
    if (this.requestQueue.length === 0) return 0;

    const now = Date.now();
    const totalWaitTime = this.requestQueue.reduce((sum, request) => sum + (now - request.timestamp), 0);

    return totalWaitTime / this.requestQueue.length;
  }

  /**
   * Start cleanup task for expired data
   */
  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(() => {
      // Clean up all buckets
      for (const bucket of this.buckets.values()) {
        this.cleanupBucket(bucket);
      }

      // Clean up old violations (keep last 24 hours)
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
      this.violations = this.violations.filter(v => new Date(v.timestamp).getTime() > dayAgo);
    }, 60000); // Every minute
  }

  /**
   * Initialize rate limit statistics
   */
  private initializeStats(): RateLimitStats {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      rateLimitedRequests: 0,
      currentRPM: 0,
      currentRPH: 0,
      currentRPD: 0,
      currentConcurrent: 0,
      avgResponseTime: 0,
      violations: 0,
      quotaUtilization: {
        minute: 0,
        hour: 0,
        day: 0,
        concurrent: 0,
      },
      lastUpdated: new Date().toISOString(),
    };
  }
}
