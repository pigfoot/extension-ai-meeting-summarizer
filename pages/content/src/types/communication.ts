/**
 * Communication Types
 *
 * Type definitions for content script to background service communication,
 * event subscription, and cross-tab synchronization.
 */

import type { MessagePriority, ComponentType } from '@extension/background';

// Unused type imports commented out
// import type { MessageEnvelope, MessageType } from '@extension/background';

/**
 * Message payload for content script to background communication
 */
export interface MessagePayload {
  /** Message action type */
  action: MessageAction;
  /** Message data */
  data: MessageData;
  /** Message context */
  context: MessageContext;
  /** Request metadata */
  metadata: MessageMetadata;
}

/**
 * Background service response structure
 */
export interface BackgroundResponse<T = unknown> {
  /** Response success status */
  success: boolean;
  /** Response data */
  data?: T;
  /** Error information if request failed */
  error?: ResponseError;
  /** Response metadata */
  metadata: ResponseMetadata;
  /** Request correlation ID */
  correlationId: string;
}

/**
 * Event subscription for background service events
 */
export interface EventSubscription {
  /** Subscription identifier */
  subscriptionId: string;
  /** Event types to subscribe to */
  eventTypes: BackgroundEventType[];
  /** Subscription filters */
  filters: SubscriptionFilters;
  /** Event handler function */
  handler: EventHandler;
  /** Subscription options */
  options: SubscriptionOptions;
  /** Whether subscription is active */
  isActive: boolean;
  /** Subscription creation time */
  createdAt: Date;
}

/**
 * Message actions for different communication patterns
 */
export type MessageAction =
  | 'transcription.start'
  | 'transcription.stop'
  | 'transcription.status'
  | 'detection.analyze'
  | 'detection.result'
  | 'content.register'
  | 'content.update'
  | 'feature.activate'
  | 'feature.deactivate'
  | 'config.get'
  | 'config.update'
  | 'storage.get'
  | 'storage.set'
  | 'notification.show'
  | 'health.check'
  | 'error.report';

/**
 * Background event types for subscriptions
 */
export type BackgroundEventType =
  | 'job.started'
  | 'job.progress'
  | 'job.completed'
  | 'job.failed'
  | 'config.changed'
  | 'storage.updated'
  | 'error.occurred'
  | 'health.changed'
  | 'tab.activated'
  | 'tab.updated'
  | 'extension.installed'
  | 'extension.updated';

/**
 * Message data for different action types
 */
export type MessageData =
  | TranscriptionRequestData
  | DetectionRequestData
  | FeatureActivationData
  | ConfigurationData
  | StorageData
  | NotificationData
  | ErrorReportData
  | HealthCheckData
  | ContentRegistrationData;

/**
 * Transcription request data
 */
export interface TranscriptionRequestData {
  /** Audio/video URL to transcribe */
  mediaUrl: string;
  /** Meeting metadata */
  meetingMetadata: {
    title: string;
    date?: Date;
    participants: string[];
    duration?: number;
  };
  /** Transcription options */
  options: {
    language: string;
    outputFormat: 'text' | 'vtt' | 'srt' | 'detailed';
    enableSpeakerSeparation: boolean;
    enableSentimentAnalysis: boolean;
  };
  /** Authentication tokens if required */
  authTokens?: Array<{
    type: string;
    value: string;
  }>;
}

/**
 * Detection request data
 */
export interface DetectionRequestData {
  /** Page URL to analyze */
  pageUrl: string;
  /** Page content to analyze */
  pageContent?: string;
  /** Detection configuration */
  config: {
    timeoutMs: number;
    includePartialResults: boolean;
    minConfidence: number;
    extractAudioUrls: boolean;
  };
}

/**
 * Feature activation data
 */
export interface FeatureActivationData {
  /** Feature identifier */
  featureId: string;
  /** Feature configuration */
  config: Record<string, unknown>;
  /** Target injection point */
  injectionPoint?: string;
  /** Page context */
  pageContext: {
    url: string;
    title: string;
    pageType: string;
  };
}

/**
 * Configuration data
 */
export interface ConfigurationData {
  /** Configuration section */
  section: string;
  /** Configuration key */
  key?: string;
  /** Configuration value */
  value?: unknown;
  /** Whether to sync across tabs */
  syncAcrossTabs: boolean;
}

/**
 * Storage data
 */
export interface StorageData {
  /** Storage area */
  area: 'local' | 'sync' | 'session';
  /** Storage key */
  key: string;
  /** Storage value */
  value?: unknown;
  /** Storage options */
  options?: {
    encrypted: boolean;
    expiration?: Date;
    tags?: string[];
  };
}

/**
 * Notification data
 */
export interface NotificationData {
  /** Notification type */
  type: 'info' | 'success' | 'warning' | 'error';
  /** Notification title */
  title: string;
  /** Notification message */
  message: string;
  /** Notification options */
  options?: {
    duration?: number;
    actions?: Array<{
      id: string;
      title: string;
      action: () => void;
    }>;
    persistent?: boolean;
  };
}

/**
 * Error report data
 */
export interface ErrorReportData {
  /** Error type */
  errorType: string;
  /** Error message */
  message: string;
  /** Error stack trace */
  stack?: string;
  /** Error context */
  context: {
    url: string;
    userAgent: string;
    timestamp: Date;
    userId?: string;
  };
  /** Additional error details */
  details: Record<string, unknown>;
}

/**
 * Health check data
 */
export interface HealthCheckData {
  /** Component being checked */
  component: string;
  /** Health status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Health metrics */
  metrics?: {
    responseTime: number;
    errorRate: number;
    lastActivity: Date;
  };
}

/**
 * Content registration data
 */
export interface ContentRegistrationData {
  /** Content script identifier */
  contentScriptId: string;
  /** Tab information */
  tabInfo: {
    id: number;
    url: string;
    title: string;
  };
  /** Capabilities */
  capabilities: string[];
  /** Page integration context */
  integrationContext: {
    pageType: string;
    features: string[];
    injectionPoints: string[];
  };
}

/**
 * Message context information
 */
export interface MessageContext {
  /** Source tab ID */
  tabId: number;
  /** Source frame ID */
  frameId?: number;
  /** Source URL */
  sourceUrl: string;
  /** User session information */
  session: {
    sessionId: string;
    userId?: string;
    startTime: Date;
  };
  /** Request timing */
  timing: {
    requestStart: number;
    timeout: number;
  };
}

/**
 * Message metadata
 */
export interface MessageMetadata {
  /** Message ID */
  messageId: string;
  /** Message timestamp */
  timestamp: Date;
  /** Message priority */
  priority: MessagePriority;
  /** Correlation ID for request tracking */
  correlationId: string;
  /** Request timeout in milliseconds */
  timeout: number;
  /** Whether response is required */
  requiresResponse: boolean;
  /** Message tags for filtering */
  tags: string[];
}

/**
 * Response error information
 */
export interface ResponseError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Error details */
  details?: Record<string, unknown>;
  /** Whether error is retryable */
  retryable: boolean;
  /** Suggested retry delay in milliseconds */
  retryDelay?: number;
}

/**
 * Response metadata
 */
export interface ResponseMetadata {
  /** Response timestamp */
  timestamp: Date;
  /** Processing duration in milliseconds */
  processingTime: number;
  /** Response source component */
  source: string;
  /** Response version */
  version: string;
  /** Additional metadata */
  extra?: Record<string, unknown>;
}

/**
 * Subscription filters for event filtering
 */
export interface SubscriptionFilters {
  /** Filter by source tab */
  tabIds?: number[];
  /** Filter by event priority */
  priorities?: MessagePriority[];
  /** Filter by event tags */
  tags?: {
    include?: string[];
    exclude?: string[];
  };
  /** Custom filter function */
  customFilter?: (event: BackgroundEvent) => boolean;
}

/**
 * Event handler function type
 */
export type EventHandler = (event: BackgroundEvent) => void | Promise<void>;

/**
 * Background event structure
 */
export interface BackgroundEvent {
  /** Event ID */
  eventId: string;
  /** Event type */
  type: BackgroundEventType;
  /** Event data */
  data: unknown;
  /** Event source */
  source: {
    component: ComponentType;
    componentId: string;
    tabId?: number;
  };
  /** Event timestamp */
  timestamp: Date;
  /** Event metadata */
  metadata: {
    priority: MessagePriority;
    tags: string[];
    correlationId?: string;
  };
}

/**
 * Subscription options
 */
export interface SubscriptionOptions {
  /** Buffer events when content script is inactive */
  bufferWhenInactive: boolean;
  /** Maximum buffer size */
  maxBufferSize: number;
  /** Preserve event order */
  preserveOrder: boolean;
  /** Automatic resubscription on reconnect */
  autoResubscribe: boolean;
  /** Subscription timeout in milliseconds */
  timeout?: number;
}

/**
 * Communication state for connection management
 */
export interface CommunicationState {
  /** Connection status */
  connectionStatus: ConnectionStatus;
  /** Active subscriptions */
  activeSubscriptions: Map<string, EventSubscription>;
  /** Pending requests */
  pendingRequests: Map<string, PendingRequest>;
  /** Message queue for offline scenarios */
  messageQueue: QueuedMessage[];
  /** Communication metrics */
  metrics: CommunicationMetrics;
  /** Last heartbeat timestamp */
  lastHeartbeat: Date;
}

/**
 * Connection status
 */
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting' | 'error';

/**
 * Pending request information
 */
export interface PendingRequest {
  /** Request ID */
  requestId: string;
  /** Request message */
  message: MessagePayload;
  /** Request timeout */
  timeout: number;
  /** Request start time */
  startTime: Date;
  /** Resolve function */
  resolve: (response: BackgroundResponse) => void;
  /** Reject function */
  reject: (error: Error) => void;
  /** Retry count */
  retryCount: number;
  /** Maximum retries */
  maxRetries: number;
}

/**
 * Queued message for offline scenarios
 */
export interface QueuedMessage {
  /** Message ID */
  messageId: string;
  /** Message payload */
  message: MessagePayload;
  /** Queue timestamp */
  queuedAt: Date;
  /** Message priority */
  priority: MessagePriority;
  /** Retry attempts */
  retryAttempts: number;
  /** Maximum queue time in milliseconds */
  maxQueueTime: number;
}

/**
 * Communication metrics
 */
export interface CommunicationMetrics {
  /** Total messages sent */
  messagesSent: number;
  /** Total responses received */
  responsesReceived: number;
  /** Total errors */
  errorsCount: number;
  /** Average response time */
  averageResponseTime: number;
  /** Connection uptime percentage */
  uptimePercentage: number;
  /** Message queue size */
  queueSize: number;
  /** Active subscriptions count */
  activeSubscriptionsCount: number;
}

/**
 * Message dispatcher interface for sending messages to background
 */
export interface MessageDispatcher {
  /** Send message to background service */
  sendMessage<T = unknown>(
    action: MessageAction,
    data: MessageData,
    options?: MessageOptions,
  ): Promise<BackgroundResponse<T>>;

  /** Send message without waiting for response */
  sendMessageAsync(action: MessageAction, data: MessageData, options?: MessageOptions): Promise<string>;

  /** Check if connection to background is active */
  isConnected(): boolean;

  /** Get communication metrics */
  getMetrics(): CommunicationMetrics;

  /** Flush pending messages */
  flushQueue(): Promise<void>;
}

/**
 * Event subscriber interface for background events
 */
export interface EventSubscriber {
  /** Subscribe to background events */
  subscribe(eventTypes: BackgroundEventType[], handler: EventHandler, options?: SubscriptionOptions): Promise<string>;

  /** Unsubscribe from events */
  unsubscribe(subscriptionId: string): Promise<void>;

  /** Get active subscriptions */
  getSubscriptions(): EventSubscription[];

  /** Check subscription status */
  isSubscribed(subscriptionId: string): boolean;
}

/**
 * Message options for customizing message behavior
 */
export interface MessageOptions {
  /** Message priority */
  priority?: MessagePriority;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Message tags */
  tags?: string[];
  /** Whether to queue message if offline */
  queueIfOffline?: boolean;
  /** Correlation ID for tracking */
  correlationId?: string;
}

/**
 * Cross-tab synchronization interface
 */
export interface CrossTabSync {
  /** Broadcast message to other tabs */
  broadcast(message: unknown, options?: BroadcastOptions): Promise<void>;

  /** Listen for broadcast messages */
  onBroadcast(handler: (message: unknown, source: TabInfo) => void): string;

  /** Stop listening for broadcasts */
  stopListening(listenerId: string): void;

  /** Synchronize data across tabs */
  syncData(key: string, data: unknown, options?: SyncOptions): Promise<void>;

  /** Get synchronized data */
  getSyncedData(key: string): Promise<unknown>;
}

/**
 * Broadcast options
 */
export interface BroadcastOptions {
  /** Target tab IDs */
  targetTabs?: number[];
  /** Exclude current tab */
  excludeSelf?: boolean;
  /** Message priority */
  priority?: MessagePriority;
  /** Message expiration */
  expiresIn?: number;
}

/**
 * Sync options
 */
export interface SyncOptions {
  /** Conflict resolution strategy */
  conflictResolution?: 'merge' | 'overwrite' | 'ignore';
  /** Sync timeout */
  timeout?: number;
  /** Enable encryption */
  encrypted?: boolean;
}

/**
 * Tab information
 */
export interface TabInfo {
  /** Tab ID */
  id: number;
  /** Tab URL */
  url: string;
  /** Tab title */
  title: string;
  /** Tab active status */
  active: boolean;
  /** Window ID */
  windowId: number;
}
