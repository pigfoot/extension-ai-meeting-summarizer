/**
 * API call coordinator for Azure Speech service coordination
 * Handles API call distribution, concurrent call management, and resource optimization
 */

import type { AzureClientCoordinator } from './client-coordinator';
import type { RateLimitManager, APIRequestInfo } from './rate-limit-manager';
import type { AzureSpeechConfig, TranscriptionJob, CreateTranscriptionJobRequest } from '@extension/azure-speech';

/**
 * API call types supported by coordinator
 */
export type APICallType =
  | 'create_transcription'
  | 'get_transcription'
  | 'list_transcriptions'
  | 'delete_transcription'
  | 'get_health'
  | 'authenticate';

/**
 * API call request
 */
export interface APICallRequest {
  /** Request identifier */
  requestId: string;
  /** API call type */
  callType: APICallType;
  /** Request priority */
  priority: 'low' | 'normal' | 'high' | 'urgent';
  /** Azure configuration */
  azureConfig: AzureSpeechConfig;
  /** Request payload */
  payload: unknown;
  /** Request options */
  options: {
    /** Request timeout in milliseconds */
    timeout: number;
    /** Maximum retry attempts */
    maxRetries: number;
    /** Enable request caching */
    enableCaching: boolean;
    /** Cache TTL in milliseconds */
    cacheTTL?: number;
  };
  /** Request metadata */
  metadata: {
    /** Source component */
    source: string;
    /** Job ID if applicable */
    jobId?: string;
    /** User session ID */
    sessionId?: string;
    /** Request tags */
    tags: string[];
  };
}

/**
 * API call response
 */
export interface APICallResponse<T = unknown> {
  /** Request identifier */
  requestId: string;
  /** Whether call was successful */
  success: boolean;
  /** Response data */
  data?: T;
  /** Error information */
  error?: {
    /** Error code */
    code: string;
    /** Error message */
    message: string;
    /** Error details */
    details?: Record<string, unknown>;
    /** Whether error is retryable */
    retryable: boolean;
  };
  /** Response metadata */
  metadata: {
    /** Response timestamp */
    timestamp: string;
    /** Processing duration in milliseconds */
    duration: number;
    /** Azure region used */
    region: string;
    /** Client ID used */
    clientId?: string;
    /** Retry count */
    retryCount: number;
    /** Whether response was cached */
    fromCache: boolean;
  };
}

/**
 * Coordinator configuration
 */
export interface APICoordinatorConfig {
  /** Maximum concurrent API calls */
  maxConcurrentCalls: number;
  /** Default request timeout */
  defaultTimeout: number;
  /** Default retry attempts */
  defaultRetries: number;
  /** Enable response caching */
  enableCaching: boolean;
  /** Cache size limit */
  cacheSize: number;
  /** Enable request deduplication */
  enableDeduplication: boolean;
  /** Load balancing strategy */
  loadBalancing: 'round_robin' | 'least_loaded' | 'region_affinity';
  /** Health check configuration */
  healthCheck: {
    /** Enable health checking */
    enabled: boolean;
    /** Health check interval */
    interval: number;
    /** Health check timeout */
    timeout: number;
  };
}

/**
 * Coordinator statistics
 */
export interface CoordinatorStats {
  /** Total API calls made */
  totalCalls: number;
  /** Successful calls */
  successfulCalls: number;
  /** Failed calls */
  failedCalls: number;
  /** Cached responses served */
  cachedResponses: number;
  /** Deduplicated calls */
  deduplicatedCalls: number;
  /** Average response time */
  avgResponseTime: number;
  /** Current concurrent calls */
  currentConcurrentCalls: number;
  /** Calls by type */
  callsByType: Record<APICallType, number>;
  /** Error rates by type */
  errorRatesByType: Record<APICallType, number>;
  /** Last update timestamp */
  lastUpdated: string;
}

/**
 * API call coordinator for Azure Speech service management
 */
export class APICoordinator {
  private config: APICoordinatorConfig;
  private rateLimitManager: RateLimitManager;
  private clientCoordinator: AzureClientCoordinator;
  private activeRequests = new Map<string, APICallRequest>();
  private responseCache = new Map<string, { response: APICallResponse; expiresAt: number }>();
  private pendingRequests = new Map<string, Set<string>>(); // For deduplication
  private stats: CoordinatorStats;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(
    config: APICoordinatorConfig,
    rateLimitManager: RateLimitManager,
    clientCoordinator: AzureClientCoordinator,
  ) {
    this.config = config;
    this.rateLimitManager = rateLimitManager;
    this.clientCoordinator = clientCoordinator;
    this.stats = this.initializeStats();

    if (this.config.healthCheck.enabled) {
      this.startHealthChecking();
    }
  }

  /**
   * Execute API call with coordination and optimization
   */
  async executeCall<T = unknown>(request: APICallRequest): Promise<APICallResponse<T>> {
    const startTime = Date.now();

    try {
      console.log(`[APICoordinator] Executing API call: ${request.callType} (${request.requestId})`);

      // Check cache first
      if (this.config.enableCaching && request.options.enableCaching) {
        const cachedResponse = this.getCachedResponse<T>(request);
        if (cachedResponse) {
          this.stats.cachedResponses++;
          this.updateStats();
          return cachedResponse;
        }
      }

      // Check for duplicate requests
      if (this.config.enableDeduplication) {
        const duplicateResponse = await this.handleDuplication<T>(request);
        if (duplicateResponse) {
          this.stats.deduplicatedCalls++;
          this.updateStats();
          return duplicateResponse;
        }
      }

      // Check rate limits
      const rateLimitInfo: APIRequestInfo = {
        requestId: request.requestId,
        type: this.mapCallTypeToRequestType(request.callType),
        priority: request.priority,
        estimatedDuration: this.estimateCallDuration(request.callType),
        timestamp: Date.now(),
        retryCount: 0,
      };

      const canProceed = await this.rateLimitManager.canProcessRequest(rateLimitInfo);
      if (!canProceed.allowed) {
        // Queue request if rate limited
        await this.rateLimitManager.queueRequest(rateLimitInfo);

        // Wait for rate limit delay
        if (canProceed.delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, canProceed.delayMs));
        }
      }

      // Get Azure client
      const clientConnection = await this.clientCoordinator.getClient(request.azureConfig);

      // Record request start
      this.activeRequests.set(request.requestId, request);
      this.rateLimitManager.recordRequestStart(request.requestId);

      // Execute the actual API call
      const response = await this.performAPICall<T>(request, clientConnection.clientId);

      // Record completion
      const duration = Date.now() - startTime;
      this.rateLimitManager.recordRequestCompletion(request.requestId, response.success, duration);
      this.activeRequests.delete(request.requestId);

      // Cache successful responses
      if (response.success && this.config.enableCaching && request.options.enableCaching) {
        this.cacheResponse(request, response);
      }

      // Update statistics
      this.updateCallStats(request.callType, response.success, duration);

      // Release client
      await this.clientCoordinator.releaseClient(clientConnection.clientId);

      console.log(`[APICoordinator] API call completed: ${request.callType} (${duration}ms)`);

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Clean up on error
      this.activeRequests.delete(request.requestId);
      this.rateLimitManager.recordRequestCompletion(request.requestId, false, duration);

      // Create error response
      const errorResponse: APICallResponse<T> = {
        requestId: request.requestId,
        success: false,
        error: {
          code: 'API_CALL_ERROR',
          message: error instanceof Error ? error.message : String(error),
          retryable: this.isRetryableError(error),
        },
        metadata: {
          timestamp: new Date().toISOString(),
          duration,
          region: request.azureConfig.region,
          retryCount: 0,
          fromCache: false,
        },
      };

      this.updateCallStats(request.callType, false, duration);

      console.error(`[APICoordinator] API call failed: ${request.callType}:`, error);

      return errorResponse;
    }
  }

  /**
   * Create transcription job via Azure API
   */
  async createTranscription(
    azureConfig: AzureSpeechConfig,
    transcriptionRequest: CreateTranscriptionJobRequest,
    options?: Partial<APICallRequest['options']>,
  ): Promise<APICallResponse<TranscriptionJob>> {
    const request: APICallRequest = {
      requestId: `create-transcription-${Date.now()}`,
      callType: 'create_transcription',
      priority: 'normal',
      azureConfig,
      payload: transcriptionRequest,
      options: {
        timeout: 30000,
        maxRetries: 3,
        enableCaching: false,
        ...options,
      },
      metadata: {
        source: 'api-coordinator',
        jobId: transcriptionRequest.metadata?.jobId as string,
        tags: ['transcription', 'create'],
      },
    };

    return this.executeCall<TranscriptionJob>(request);
  }

  /**
   * Get transcription job status
   */
  async getTranscription(
    azureConfig: AzureSpeechConfig,
    jobId: string,
    options?: Partial<APICallRequest['options']>,
  ): Promise<APICallResponse<TranscriptionJob>> {
    const request: APICallRequest = {
      requestId: `get-transcription-${jobId}-${Date.now()}`,
      callType: 'get_transcription',
      priority: 'high',
      azureConfig,
      payload: { jobId },
      options: {
        timeout: 15000,
        maxRetries: 2,
        enableCaching: true,
        cacheTTL: 30000, // 30 seconds
        ...options,
      },
      metadata: {
        source: 'api-coordinator',
        jobId,
        tags: ['transcription', 'status'],
      },
    };

    return this.executeCall<TranscriptionJob>(request);
  }

  /**
   * List transcription jobs
   */
  async listTranscriptions(
    azureConfig: AzureSpeechConfig,
    options?: Partial<APICallRequest['options']>,
  ): Promise<APICallResponse<TranscriptionJob[]>> {
    const request: APICallRequest = {
      requestId: `list-transcriptions-${Date.now()}`,
      callType: 'list_transcriptions',
      priority: 'low',
      azureConfig,
      payload: {},
      options: {
        timeout: 20000,
        maxRetries: 2,
        enableCaching: true,
        cacheTTL: 60000, // 1 minute
        ...options,
      },
      metadata: {
        source: 'api-coordinator',
        tags: ['transcription', 'list'],
      },
    };

    return this.executeCall<TranscriptionJob[]>(request);
  }

  /**
   * Perform health check on Azure service
   */
  async performHealthCheck(azureConfig: AzureSpeechConfig): Promise<APICallResponse<{ healthy: boolean }>> {
    const request: APICallRequest = {
      requestId: `health-check-${Date.now()}`,
      callType: 'get_health',
      priority: 'low',
      azureConfig,
      payload: {},
      options: {
        timeout: this.config.healthCheck.timeout,
        maxRetries: 1,
        enableCaching: false,
      },
      metadata: {
        source: 'health-checker',
        tags: ['health', 'monitoring'],
      },
    };

    return this.executeCall<{ healthy: boolean }>(request);
  }

  /**
   * Get coordinator statistics
   */
  getStats(): CoordinatorStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Get active request information
   */
  getActiveRequests(): APICallRequest[] {
    return Array.from(this.activeRequests.values());
  }

  /**
   * Clear response cache
   */
  clearCache(): void {
    this.responseCache.clear();
    console.log('[APICoordinator] Response cache cleared');
  }

  /**
   * Update coordinator configuration
   */
  updateConfig(config: Partial<APICoordinatorConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart health checking if interval changed
    if (config.healthCheck) {
      this.stopHealthChecking();
      if (this.config.healthCheck.enabled) {
        this.startHealthChecking();
      }
    }

    console.log('[APICoordinator] Configuration updated');
  }

  /**
   * Shutdown coordinator
   */
  async shutdown(): Promise<void> {
    console.log('[APICoordinator] Shutting down');

    this.stopHealthChecking();

    // Wait for active requests to complete (with timeout)
    const shutdownTimeout = 30000;
    const startTime = Date.now();

    while (this.activeRequests.size > 0 && Date.now() - startTime < shutdownTimeout) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (this.activeRequests.size > 0) {
      console.warn(`[APICoordinator] ${this.activeRequests.size} requests still active during shutdown`);
    }

    // Clear caches and state
    this.responseCache.clear();
    this.pendingRequests.clear();
    this.activeRequests.clear();

    console.log('[APICoordinator] Shutdown completed');
  }

  /**
   * Perform actual API call implementation
   */
  private async performAPICall<T>(request: APICallRequest, clientId: string): Promise<APICallResponse<T>> {
    const startTime = Date.now();

    // Simulate API call based on type
    let responseData: T;
    let success = true;

    try {
      switch (request.callType) {
        case 'create_transcription':
          responseData = await this.simulateCreateTranscription(request.payload as CreateTranscriptionJobRequest);
          break;

        case 'get_transcription':
          responseData = await this.simulateGetTranscription((request.payload as { jobId: string }).jobId);
          break;

        case 'list_transcriptions':
          responseData = await this.simulateListTranscriptions();
          break;

        case 'get_health':
          responseData = await this.simulateHealthCheck();
          break;

        case 'authenticate':
          responseData = await this.simulateAuthentication(request.azureConfig);
          break;

        default:
          throw new Error(`Unsupported API call type: ${request.callType}`);
      }
    } catch (error) {
      success = false;
      throw error;
    }

    const response: APICallResponse<T> = {
      requestId: request.requestId,
      success,
      data: responseData,
      metadata: {
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        region: request.azureConfig.region,
        clientId,
        retryCount: 0,
        fromCache: false,
      },
    };

    return response;
  }

  /**
   * Simulate Azure transcription creation
   */
  private async simulateCreateTranscription(
    transcriptionRequest: CreateTranscriptionJobRequest,
  ): Promise<TranscriptionJob> {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    const mockJob: TranscriptionJob = {
      jobId: `azure-job-${Date.now()}`,
      audioUrl: transcriptionRequest.audioUrl,
      status: 'submitted',
      progress: 0,
      submittedAt: new Date(),
      config: transcriptionRequest.config,
      retryCount: 0,
    };

    return mockJob;
  }

  /**
   * Simulate getting transcription status
   */
  private async simulateGetTranscription(jobId: string): Promise<TranscriptionJob> {
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

    const mockJob: TranscriptionJob = {
      jobId,
      audioUrl: 'https://example.com/audio.mp3',
      status: Math.random() > 0.3 ? 'completed' : 'processing',
      progress: Math.floor(Math.random() * 100),
      submittedAt: new Date(Date.now() - 300000),
      config: {
        language: 'en-US',
        enableSpeakerDiarization: true,
        enableProfanityFilter: false,
        outputFormat: 'detailed',
        confidenceThreshold: 0.7,
      },
      retryCount: 0,
    };

    return mockJob;
  }

  /**
   * Simulate listing transcriptions
   */
  private async simulateListTranscriptions(): Promise<TranscriptionJob[]> {
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1500));

    const mockJobs: TranscriptionJob[] = [
      {
        jobId: 'job-1',
        audioUrl: 'https://example.com/audio1.mp3',
        status: 'completed',
        progress: 100,
        submittedAt: new Date(Date.now() - 600000),
        config: {
          language: 'en-US',
          enableSpeakerDiarization: true,
          enableProfanityFilter: false,
          outputFormat: 'detailed',
          confidenceThreshold: 0.7,
        },
        retryCount: 0,
      },
    ];

    return mockJobs;
  }

  /**
   * Simulate health check
   */
  private async simulateHealthCheck(): Promise<{ healthy: boolean }> {
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 500));
    return { healthy: Math.random() > 0.1 }; // 90% healthy
  }

  /**
   * Simulate authentication
   */
  private async simulateAuthentication(
    config: AzureSpeechConfig,
  ): Promise<{ token: string; expiresIn: number; region: string }> {
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 700));
    return {
      token: `mock-token-${Date.now()}`,
      expiresIn: 3600,
      region: config.region,
    };
  }

  /**
   * Get cached response if available and valid
   */
  private getCachedResponse<T>(request: APICallRequest): APICallResponse<T> | null {
    const cacheKey = this.generateCacheKey(request);
    const cached = this.responseCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      // Update metadata to indicate cache hit
      const response = { ...cached.response } as APICallResponse<T>;
      response.metadata.fromCache = true;
      response.metadata.timestamp = new Date().toISOString();

      console.log(`[APICoordinator] Cache hit for ${request.callType}`);
      return response;
    }

    return null;
  }

  /**
   * Cache API response
   */
  private cacheResponse(request: APICallRequest, response: APICallResponse): void {
    if (!this.config.enableCaching) return;

    const cacheKey = this.generateCacheKey(request);
    const ttl = request.options.cacheTTL || 300000; // Default 5 minutes
    const expiresAt = Date.now() + ttl;

    this.responseCache.set(cacheKey, { response, expiresAt });

    // Cleanup old cache entries if size limit exceeded
    if (this.responseCache.size > this.config.cacheSize) {
      this.cleanupCache();
    }
  }

  /**
   * Handle request deduplication
   */
  private async handleDuplication<T>(request: APICallRequest): Promise<APICallResponse<T> | null> {
    const dedupeKey = this.generateDeduplicationKey(request);
    const existingRequests = this.pendingRequests.get(dedupeKey);

    if (existingRequests && existingRequests.size > 0) {
      console.log(`[APICoordinator] Deduplicating request: ${request.callType}`);

      // Wait for existing request to complete
      // This is a simplified implementation - in reality you'd use proper promise coordination
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check cache for result
      return this.getCachedResponse<T>(request);
    }

    // Track this request for deduplication
    if (!existingRequests) {
      this.pendingRequests.set(dedupeKey, new Set());
    }
    this.pendingRequests.get(dedupeKey)!.add(request.requestId);

    return null;
  }

  /**
   * Generate cache key for request
   */
  private generateCacheKey(request: APICallRequest): string {
    const keyParts = [request.callType, request.azureConfig.region, JSON.stringify(request.payload)];
    return keyParts.join('|');
  }

  /**
   * Generate deduplication key for request
   */
  private generateDeduplicationKey(request: APICallRequest): string {
    return this.generateCacheKey(request);
  }

  /**
   * Cleanup old cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, cached] of this.responseCache) {
      if (cached.expiresAt <= now) {
        expiredKeys.push(key);
      }
    }

    // Remove expired entries
    for (const key of expiredKeys) {
      this.responseCache.delete(key);
    }

    // If still over limit, remove oldest entries
    if (this.responseCache.size > this.config.cacheSize) {
      const entries = Array.from(this.responseCache.entries());
      entries.sort((a, b) => a[1].expiresAt - b[1].expiresAt);

      const toRemove = entries.slice(0, entries.length - this.config.cacheSize);
      for (const [key] of toRemove) {
        this.responseCache.delete(key);
      }
    }
  }

  /**
   * Map API call type to rate limit request type
   */
  private mapCallTypeToRequestType(callType: APICallType): APIRequestInfo['type'] {
    switch (callType) {
      case 'create_transcription':
      case 'get_transcription':
      case 'list_transcriptions':
      case 'delete_transcription':
        return 'transcription';
      case 'authenticate':
        return 'authentication';
      case 'get_health':
        return 'health_check';
      default:
        return 'transcription';
    }
  }

  /**
   * Estimate API call duration
   */
  private estimateCallDuration(callType: APICallType): number {
    switch (callType) {
      case 'create_transcription':
        return 2000;
      case 'get_transcription':
        return 800;
      case 'list_transcriptions':
        return 1200;
      case 'delete_transcription':
        return 500;
      case 'authenticate':
        return 600;
      case 'get_health':
        return 300;
      default:
        return 1000;
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('timeout') ||
        message.includes('network') ||
        message.includes('temporary') ||
        message.includes('rate limit')
      );
    }
    return false;
  }

  /**
   * Update call statistics
   */
  private updateCallStats(callType: APICallType, success: boolean, duration: number): void {
    this.stats.totalCalls++;
    this.stats.callsByType[callType] = (this.stats.callsByType[callType] || 0) + 1;

    if (success) {
      this.stats.successfulCalls++;
    } else {
      this.stats.failedCalls++;
      const totalCalls = this.stats.callsByType[callType];
      const failedCalls = (this.stats.errorRatesByType[callType] || 0) + 1;
      this.stats.errorRatesByType[callType] = (failedCalls / totalCalls) * 100;
    }

    // Update average response time
    const totalSuccessful = this.stats.successfulCalls;
    if (success && totalSuccessful > 0) {
      this.stats.avgResponseTime = (this.stats.avgResponseTime * (totalSuccessful - 1) + duration) / totalSuccessful;
    }
  }

  /**
   * Update general statistics
   */
  private updateStats(): void {
    this.stats.currentConcurrentCalls = this.activeRequests.size;
    this.stats.lastUpdated = new Date().toISOString();
  }

  /**
   * Start health checking
   */
  private startHealthChecking(): void {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = setInterval(async () => {
      // This would perform health checks on configured Azure endpoints
      console.log('[APICoordinator] Performing health checks');
    }, this.config.healthCheck.interval);

    console.log('[APICoordinator] Health checking started');
  }

  /**
   * Stop health checking
   */
  private stopHealthChecking(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      console.log('[APICoordinator] Health checking stopped');
    }
  }

  /**
   * Initialize coordinator statistics
   */
  private initializeStats(): CoordinatorStats {
    return {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      cachedResponses: 0,
      deduplicatedCalls: 0,
      avgResponseTime: 0,
      currentConcurrentCalls: 0,
      callsByType: {
        create_transcription: 0,
        get_transcription: 0,
        list_transcriptions: 0,
        delete_transcription: 0,
        get_health: 0,
        authenticate: 0,
      },
      errorRatesByType: {
        create_transcription: 0,
        get_transcription: 0,
        list_transcriptions: 0,
        delete_transcription: 0,
        get_health: 0,
        authenticate: 0,
      },
      lastUpdated: new Date().toISOString(),
    };
  }
}
