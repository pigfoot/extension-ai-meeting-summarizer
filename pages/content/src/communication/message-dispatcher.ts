/**
 * Message Dispatcher
 *
 * Structured messaging to background service with message validation
 * and response handling for reliable content script communication.
 */

import type { MessagePayload, BackgroundResponse } from '../types/communication';

/**
 * Message types for background service communication
 */
export type MessageType =
  | 'transcription.start'
  | 'transcription.stop'
  | 'transcription.status'
  | 'meeting.detect'
  | 'meeting.info'
  | 'content.extract'
  | 'page.integration'
  | 'storage.get'
  | 'storage.set'
  | 'settings.get'
  | 'settings.update'
  | 'error.report'
  | 'health.check';

/**
 * Message priority levels
 */
export type MessagePriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Message request configuration
 */
export interface MessageRequest<T = unknown> {
  /** Message type */
  type: MessageType;
  /** Message payload */
  payload: T;
  /** Message priority */
  priority?: MessagePriority;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Number of retry attempts */
  retries?: number;
  /** Whether to expect a response */
  expectResponse?: boolean;
  /** Correlation ID for tracking */
  correlationId?: string;
  /** Message metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Message response wrapper
 */
export interface MessageResponse<T = unknown> {
  /** Whether request was successful */
  success: boolean;
  /** Response data */
  data?: T;
  /** Error information */
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  /** Response metadata */
  metadata?: Record<string, unknown>;
  /** Correlation ID */
  correlationId?: string;
  /** Response timestamp */
  timestamp: Date;
}

/**
 * Message dispatch options
 */
export interface DispatchOptions {
  /** Override timeout */
  timeout?: number;
  /** Override retry count */
  retries?: number;
  /** Priority override */
  priority?: MessagePriority;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Success callback */
  onSuccess?: (response: MessageResponse) => void;
  /** Error callback */
  onError?: (error: Error) => void;
  /** Progress callback for long operations */
  onProgress?: (progress: { current: number; total: number; message?: string }) => void;
}

/**
 * Pending message information
 */
interface PendingMessage {
  /** Message request */
  request: MessageRequest;
  /** Promise resolve function */
  resolve: (response: MessageResponse) => void;
  /** Promise reject function */
  reject: (error: Error) => void;
  /** Timeout ID */
  timeoutId: NodeJS.Timeout;
  /** Number of attempts made */
  attempts: number;
  /** Start timestamp */
  startTime: Date;
  /** Options */
  options: DispatchOptions;
}

/**
 * Dispatcher configuration
 */
export interface DispatcherConfig {
  /** Default timeout in milliseconds */
  defaultTimeout: number;
  /** Default retry attempts */
  defaultRetries: number;
  /** Maximum concurrent messages */
  maxConcurrentMessages: number;
  /** Message queue size limit */
  maxQueueSize: number;
  /** Enable debug logging */
  enableDebugLogging: boolean;
  /** Connection retry delay */
  connectionRetryDelay: number;
  /** Health check interval */
  healthCheckInterval: number;
}

/**
 * Dispatcher statistics
 */
export interface DispatcherStatistics {
  /** Total messages sent */
  totalSent: number;
  /** Successful responses */
  successfulResponses: number;
  /** Failed responses */
  failedResponses: number;
  /** Average response time */
  averageResponseTime: number;
  /** Pending messages count */
  pendingMessages: number;
  /** Queue size */
  queueSize: number;
  /** Connection status */
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error';
  /** Last health check */
  lastHealthCheck: Date;
}

/**
 * Message validation error
 */
export class MessageValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value: unknown,
  ) {
    super(message);
    this.name = 'MessageValidationError';
  }
}

/**
 * Message timeout error
 */
export class MessageTimeoutError extends Error {
  constructor(
    message: string,
    public correlationId: string,
    public timeout: number,
  ) {
    super(message);
    this.name = 'MessageTimeoutError';
  }
}

/**
 * Background service connection error
 */
export class ConnectionError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = 'ConnectionError';
  }
}

/**
 * Message dispatcher for background service communication
 */
export class MessageDispatcher {
  private static instance: MessageDispatcher;
  private config: DispatcherConfig;
  private pendingMessages: Map<string, PendingMessage> = new Map();
  private messageQueue: MessageRequest[] = [];
  private statistics: DispatcherStatistics;
  private isConnected: boolean = false;
  private connectionPort: chrome.runtime.Port | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private messageIdCounter: number = 0;

  constructor(config: Partial<DispatcherConfig> = {}) {
    this.config = {
      defaultTimeout: 30000,
      defaultRetries: 3,
      maxConcurrentMessages: 10,
      maxQueueSize: 100,
      enableDebugLogging: false,
      connectionRetryDelay: 1000,
      healthCheckInterval: 30000,
      ...config,
    };

    this.statistics = {
      totalSent: 0,
      successfulResponses: 0,
      failedResponses: 0,
      averageResponseTime: 0,
      pendingMessages: 0,
      queueSize: 0,
      connectionStatus: 'disconnected',
      lastHealthCheck: new Date(),
    };

    this.initializeConnection();
    this.startHealthCheck();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<DispatcherConfig>): MessageDispatcher {
    if (!MessageDispatcher.instance) {
      MessageDispatcher.instance = new MessageDispatcher(config);
    }
    return MessageDispatcher.instance;
  }

  /**
   * Send message to background service
   */
  async sendMessage<T = unknown, R = unknown>(
    request: MessageRequest<T>,
    options: DispatchOptions = {},
  ): Promise<MessageResponse<R>> {
    // Validate message
    this.validateMessage(request);

    // Generate correlation ID if not provided
    if (!request.correlationId) {
      request.correlationId = this.generateCorrelationId();
    }

    // Apply defaults
    const finalRequest: MessageRequest<T> = {
      priority: 'medium',
      timeout: this.config.defaultTimeout,
      retries: this.config.defaultRetries,
      expectResponse: true,
      ...request,
    };

    const finalOptions: DispatchOptions = {
      timeout: finalRequest.timeout,
      retries: finalRequest.retries,
      priority: finalRequest.priority,
      ...options,
    };

    this.log(`Sending message: ${finalRequest.type} (${finalRequest.correlationId})`);

    // Check queue size
    if (this.messageQueue.length >= this.config.maxQueueSize) {
      throw new Error('Message queue is full');
    }

    // Check concurrent message limit
    if (this.pendingMessages.size >= this.config.maxConcurrentMessages) {
      // Add to queue
      this.messageQueue.push(finalRequest);
      this.statistics.queueSize = this.messageQueue.length;

      return new Promise((resolve, reject) => {
        // Will be processed when a slot becomes available
        const checkQueue = () => {
          if (this.pendingMessages.size < this.config.maxConcurrentMessages) {
            const queuedRequest = this.messageQueue.shift();
            if (queuedRequest && queuedRequest.correlationId === finalRequest.correlationId) {
              this.statistics.queueSize = this.messageQueue.length;
              this.dispatchMessage(finalRequest, finalOptions).then(resolve).catch(reject);
            } else {
              setTimeout(checkQueue, 100);
            }
          } else {
            setTimeout(checkQueue, 100);
          }
        };
        checkQueue();
      });
    }

    return this.dispatchMessage(finalRequest, finalOptions);
  }

  /**
   * Send message without expecting response (fire and forget)
   */
  async sendNotification<T = unknown>(type: MessageType, payload: T, options: DispatchOptions = {}): Promise<void> {
    const request: MessageRequest<T> = {
      type,
      payload,
      expectResponse: false,
      priority: options.priority || 'low',
      correlationId: this.generateCorrelationId(),
    };

    await this.sendMessage(request, { ...options, timeout: 5000 });
  }

  /**
   * Get dispatcher statistics
   */
  getStatistics(): DispatcherStatistics {
    this.statistics.pendingMessages = this.pendingMessages.size;
    this.statistics.queueSize = this.messageQueue.length;
    return { ...this.statistics };
  }

  /**
   * Check if dispatcher is connected to background service
   */
  isConnectionHealthy(): boolean {
    return this.isConnected && this.connectionPort !== null;
  }

  /**
   * Manually reconnect to background service
   */
  async reconnect(): Promise<void> {
    this.log('Manual reconnection requested');
    this.cleanup();
    await this.initializeConnection();
  }

  /**
   * Clear all pending messages and queue
   */
  clearPendingMessages(): void {
    // Reject all pending messages
    this.pendingMessages.forEach(pending => {
      clearTimeout(pending.timeoutId);
      pending.reject(new ConnectionError('Connection lost', 'CONNECTION_LOST'));
    });
    this.pendingMessages.clear();

    // Clear queue
    this.messageQueue.length = 0;
    this.statistics.queueSize = 0;
    this.statistics.pendingMessages = 0;

    this.log('Cleared all pending messages');
  }

  /**
   * Dispatch message implementation
   */
  private async dispatchMessage<T = unknown, R = unknown>(
    request: MessageRequest<T>,
    options: DispatchOptions,
  ): Promise<MessageResponse<R>> {
    return new Promise<MessageResponse<R>>((resolve, reject) => {
      const startTime = new Date();

      // Setup timeout
      const timeoutId = setTimeout(() => {
        this.pendingMessages.delete(request.correlationId!);
        this.statistics.failedResponses++;

        const error = new MessageTimeoutError(
          `Message timeout after ${options.timeout}ms`,
          request.correlationId!,
          options.timeout!,
        );

        options.onError?.(error);
        reject(error);
      }, options.timeout);

      // Store pending message
      const pending: PendingMessage = {
        request,
        resolve,
        reject,
        timeoutId,
        attempts: 0,
        startTime,
        options,
      };

      this.pendingMessages.set(request.correlationId!, pending);

      // Send message
      this.sendToBackground(request)
        .then(() => {
          this.statistics.totalSent++;
          pending.attempts++;
        })
        .catch(error => {
          clearTimeout(timeoutId);
          this.pendingMessages.delete(request.correlationId!);
          this.statistics.failedResponses++;

          options.onError?.(error);
          reject(error);
        });
    });
  }

  /**
   * Send message to background service
   */
  private async sendToBackground(request: MessageRequest): Promise<void> {
    if (!this.isConnectionHealthy()) {
      await this.ensureConnection();
    }

    const messagePayload: MessagePayload = {
      type: request.type,
      data: request.payload,
      metadata: {
        correlationId: request.correlationId,
        priority: request.priority,
        timestamp: new Date().toISOString(),
        source: 'content-script',
        ...request.metadata,
      },
    };

    if (this.connectionPort) {
      this.connectionPort.postMessage(messagePayload);
    } else {
      // Fallback to chrome.runtime.sendMessage
      chrome.runtime.sendMessage(messagePayload);
    }
  }

  /**
   * Initialize connection to background service
   */
  private async initializeConnection(): Promise<void> {
    try {
      this.statistics.connectionStatus = 'connecting';

      // Create port connection
      this.connectionPort = chrome.runtime.connect({ name: 'content-script' });

      // Setup message listener
      this.connectionPort.onMessage.addListener((response: BackgroundResponse) => {
        this.handleBackgroundResponse(response);
      });

      // Setup disconnect listener
      this.connectionPort.onDisconnect.addListener(() => {
        this.handleConnectionDisconnect();
      });

      this.isConnected = true;
      this.statistics.connectionStatus = 'connected';
      this.log('Connected to background service');

      // Process queued messages
      this.processMessageQueue();
    } catch (error) {
      this.statistics.connectionStatus = 'error';
      this.log(`Connection failed: ${error}`);

      // Retry connection
      setTimeout(() => {
        if (!this.isConnected) {
          this.initializeConnection();
        }
      }, this.config.connectionRetryDelay);
    }
  }

  /**
   * Handle response from background service
   */
  private handleBackgroundResponse(response: BackgroundResponse): void {
    const correlationId = response.metadata?.correlationId;

    if (!correlationId) {
      this.log('Received response without correlation ID');
      return;
    }

    const pending = this.pendingMessages.get(correlationId);
    if (!pending) {
      this.log(`No pending message found for correlation ID: ${correlationId}`);
      return;
    }

    // Clear timeout
    clearTimeout(pending.timeoutId);
    this.pendingMessages.delete(correlationId);

    // Calculate response time
    const responseTime = Date.now() - pending.startTime.getTime();
    this.updateResponseTimeStatistics(responseTime);

    // Create response
    const messageResponse: MessageResponse = {
      success: response.success,
      data: response.data,
      error: response.error,
      metadata: response.metadata,
      correlationId,
      timestamp: new Date(),
    };

    if (response.success) {
      this.statistics.successfulResponses++;
      pending.options.onSuccess?.(messageResponse);
      pending.resolve(messageResponse);
    } else {
      this.statistics.failedResponses++;

      // Check if retry is needed
      if (pending.attempts < pending.options.retries! && this.shouldRetry(response)) {
        this.log(`Retrying message ${correlationId} (attempt ${pending.attempts + 1})`);
        this.retryMessage(pending);
      } else {
        const error = new Error(response.error?.message || 'Background service error');
        pending.options.onError?.(error);
        pending.reject(error);
      }
    }
  }

  /**
   * Handle connection disconnect
   */
  private handleConnectionDisconnect(): void {
    this.isConnected = false;
    this.connectionPort = null;
    this.statistics.connectionStatus = 'disconnected';
    this.log('Disconnected from background service');

    // Attempt reconnection
    setTimeout(() => {
      if (!this.isConnected) {
        this.initializeConnection();
      }
    }, this.config.connectionRetryDelay);
  }

  /**
   * Ensure connection is established
   */
  private async ensureConnection(): Promise<void> {
    if (this.isConnectionHealthy()) {
      return;
    }

    return new Promise((resolve, reject) => {
      const maxAttempts = 5;
      let attempts = 0;

      const tryConnect = () => {
        attempts++;

        if (this.isConnectionHealthy()) {
          resolve();
          return;
        }

        if (attempts >= maxAttempts) {
          reject(new ConnectionError('Failed to establish connection', 'CONNECTION_FAILED'));
          return;
        }

        this.initializeConnection()
          .then(() => {
            if (this.isConnectionHealthy()) {
              resolve();
            } else {
              setTimeout(tryConnect, this.config.connectionRetryDelay);
            }
          })
          .catch(() => {
            setTimeout(tryConnect, this.config.connectionRetryDelay);
          });
      };

      tryConnect();
    });
  }

  /**
   * Process message queue
   */
  private processMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.pendingMessages.size < this.config.maxConcurrentMessages) {
      const request = this.messageQueue.shift()!;
      this.statistics.queueSize = this.messageQueue.length;

      // Re-dispatch queued message
      this.dispatchMessage(request, {
        timeout: request.timeout,
        retries: request.retries,
        priority: request.priority,
      }).catch(error => {
        this.log(`Queued message failed: ${error.message}`);
      });
    }
  }

  /**
   * Retry failed message
   */
  private retryMessage(pending: PendingMessage): void {
    // Setup new timeout
    const timeoutId = setTimeout(() => {
      this.pendingMessages.delete(pending.request.correlationId!);
      this.statistics.failedResponses++;

      const error = new MessageTimeoutError(
        `Message timeout after ${pending.options.timeout}ms`,
        pending.request.correlationId!,
        pending.options.timeout!,
      );

      pending.reject(error);
    }, pending.options.timeout!);

    // Update pending message
    pending.timeoutId = timeoutId;
    pending.startTime = new Date();

    // Re-store pending message
    this.pendingMessages.set(pending.request.correlationId!, pending);

    // Retry sending
    this.sendToBackground(pending.request).catch(error => {
      clearTimeout(timeoutId);
      this.pendingMessages.delete(pending.request.correlationId!);
      pending.reject(error);
    });
  }

  /**
   * Check if message should be retried
   */
  private shouldRetry(response: BackgroundResponse): boolean {
    // Don't retry client errors (4xx-like)
    if (response.error?.code?.startsWith('CLIENT_')) {
      return false;
    }

    // Don't retry validation errors
    if (response.error?.code === 'VALIDATION_ERROR') {
      return false;
    }

    // Retry server errors and network issues
    return true;
  }

  /**
   * Validate message before sending
   */
  private validateMessage(request: MessageRequest): void {
    if (!request.type) {
      throw new MessageValidationError('Message type is required', 'type', request.type);
    }

    if (request.payload === undefined) {
      throw new MessageValidationError('Message payload is required', 'payload', request.payload);
    }

    if (request.timeout && request.timeout <= 0) {
      throw new MessageValidationError('Timeout must be positive', 'timeout', request.timeout);
    }

    if (request.retries && request.retries < 0) {
      throw new MessageValidationError('Retries must be non-negative', 'retries', request.retries);
    }
  }

  /**
   * Generate unique correlation ID
   */
  private generateCorrelationId(): string {
    return `msg-${Date.now()}-${++this.messageIdCounter}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update response time statistics
   */
  private updateResponseTimeStatistics(responseTime: number): void {
    const total = this.statistics.successfulResponses + this.statistics.failedResponses;
    const currentAverage = this.statistics.averageResponseTime;

    this.statistics.averageResponseTime = (currentAverage * (total - 1) + responseTime) / total;
  }

  /**
   * Start health check interval
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.sendMessage({
          type: 'health.check',
          payload: { timestamp: Date.now() },
          timeout: 5000,
          retries: 1,
        });

        this.statistics.lastHealthCheck = new Date();
      } catch (error) {
        this.log(`Health check failed: ${error}`);

        if (!this.isConnectionHealthy()) {
          this.reconnect();
        }
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * Log debug message
   */
  private log(message: string): void {
    if (this.config.enableDebugLogging) {
      console.log(`[MessageDispatcher] ${message}`);
    }
  }

  /**
   * Cleanup dispatcher
   */
  cleanup(): void {
    // Stop health check
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Clear pending messages
    this.clearPendingMessages();

    // Disconnect port
    if (this.connectionPort) {
      this.connectionPort.disconnect();
      this.connectionPort = null;
    }

    this.isConnected = false;
    this.statistics.connectionStatus = 'disconnected';

    this.log('Dispatcher cleanup completed');
  }
}

// Export singleton instance
export const messageDispatcher = MessageDispatcher.getInstance();

// Export utility functions
export const dispatcherUtils = {
  /**
   * Get dispatcher instance
   */
  getInstance: (config?: Partial<DispatcherConfig>) => MessageDispatcher.getInstance(config),

  /**
   * Send message with default options
   */
  send: <T = unknown, R = unknown>(
    type: MessageType,
    payload: T,
    options?: DispatchOptions,
  ): Promise<MessageResponse<R>> => messageDispatcher.sendMessage({ type, payload }, options),

  /**
   * Send notification (no response expected)
   */
  notify: <T = unknown>(type: MessageType, payload: T, options?: DispatchOptions): Promise<void> =>
    messageDispatcher.sendNotification(type, payload, options),

  /**
   * Get connection status
   */
  isConnected: (): boolean => messageDispatcher.isConnectionHealthy(),

  /**
   * Get statistics
   */
  getStats: (): DispatcherStatistics => messageDispatcher.getStatistics(),

  /**
   * Reconnect to background service
   */
  reconnect: (): Promise<void> => messageDispatcher.reconnect(),

  /**
   * Cleanup dispatcher
   */
  cleanup: (): void => {
    messageDispatcher.cleanup();
  },
};
