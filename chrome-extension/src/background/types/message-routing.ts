/**
 * Message routing types for cross-component communication
 * Handles inter-component messaging, broadcasting, and subscription management
 */

/**
 * Extension component types that can participate in messaging
 */
export type ComponentType =
  | 'background' // Service Worker background script
  | 'content_script' // Content script in web pages
  | 'popup' // Extension popup interface
  | 'options' // Extension options page
  | 'sidepanel' // Side panel interface
  | 'devtools' // Developer tools integration
  | 'offscreen'; // Offscreen document for processing

/**
 * Message types for different communication patterns
 */
export type MessageType =
  | 'detection_event' // Meeting page detection events
  | 'job_status' // Transcription job status updates
  | 'job_progress' // Job progress notifications
  | 'config_change' // Configuration updates
  | 'storage_sync' // Storage synchronization events
  | 'error_report' // Error reporting and logging
  | 'health_check' // Component health monitoring
  | 'broadcast' // General broadcast messages
  | 'request_response' // Request/response communication
  | 'subscription' // Subscription management
  | 'notification'; // User notifications

/**
 * Message priority levels for routing decisions
 */
export type MessagePriority =
  | 'critical' // Immediate processing required
  | 'urgent' // High priority, process soon
  | 'normal' // Standard priority processing
  | 'low' // Background processing
  | 'bulk'; // Batch processing suitable

/**
 * Message delivery modes
 */
export type DeliveryMode =
  | 'unicast' // Send to specific component
  | 'multicast' // Send to group of components
  | 'broadcast' // Send to all listening components
  | 'anycast'; // Send to any available component of type

/**
 * Component registration information
 */
export interface ComponentRegistration {
  /** Component identifier */
  componentId: string;
  /** Component type */
  type: ComponentType;
  /** Component display name */
  name: string;
  /** Tab ID for content scripts */
  tabId?: number;
  /** Frame ID for content scripts */
  frameId?: number;
  /** Window ID for extension pages */
  windowId?: number;
  /** Component capabilities */
  capabilities: {
    /** Can handle background processing */
    backgroundProcessing: boolean;
    /** Can display notifications */
    notifications: boolean;
    /** Can access storage */
    storage: boolean;
    /** Can make external API calls */
    externalAPI: boolean;
    /** Supported message types */
    supportedMessages: MessageType[];
  };
  /** Component health status */
  health: {
    /** Whether component is responsive */
    responsive: boolean;
    /** Last heartbeat timestamp (ISO 8601) */
    lastHeartbeat: string;
    /** Response time in milliseconds */
    responseTime: number;
    /** Error count in current session */
    errorCount: number;
  };
  /** Registration timestamp (ISO 8601) */
  registeredAt: string;
  /** Last activity timestamp (ISO 8601) */
  lastActivity: string;
}

/**
 * Message envelope with routing metadata
 */
export interface MessageEnvelope {
  /** Message identifier */
  messageId: string;
  /** Message type */
  type: MessageType;
  /** Message priority */
  priority: MessagePriority;
  /** Delivery mode */
  deliveryMode: DeliveryMode;
  /** Source component */
  source: {
    /** Component ID */
    componentId: string;
    /** Component type */
    type: ComponentType;
    /** Tab ID if applicable */
    tabId?: number;
  };
  /** Target specification */
  target: {
    /** Specific component ID (for unicast) */
    componentId?: string;
    /** Target component type(s) */
    componentTypes?: ComponentType[];
    /** Tab ID filter */
    tabId?: number;
    /** Window ID filter */
    windowId?: number;
  };
  /** Message payload */
  payload: unknown;
  /** Message metadata */
  metadata: {
    /** Message creation timestamp (ISO 8601) */
    timestamp: string;
    /** Message expiration time (ISO 8601) */
    expiresAt?: string;
    /** Correlation ID for request/response */
    correlationId?: string;
    /** Reply-to information */
    replyTo?: {
      componentId: string;
      messageId: string;
    };
    /** Message tags for filtering */
    tags: string[];
    /** Whether message requires acknowledgment */
    requiresAck: boolean;
  };
  /** Delivery tracking */
  delivery: {
    /** Number of delivery attempts */
    attempts: number;
    /** Maximum delivery attempts */
    maxAttempts: number;
    /** Delivery timeout in milliseconds */
    timeout: number;
    /** Delivery confirmations */
    confirmations: Array<{
      componentId: string;
      timestamp: string;
      success: boolean;
    }>;
  };
}

/**
 * Subscription configuration for message filtering
 */
export interface MessageSubscription {
  /** Subscription identifier */
  subscriptionId: string;
  /** Subscribing component */
  componentId: string;
  /** Message types to subscribe to */
  messageTypes: MessageType[];
  /** Message filters */
  filters: {
    /** Source component filters */
    sourceFilters?: {
      /** Component types to include */
      includeTypes?: ComponentType[];
      /** Component types to exclude */
      excludeTypes?: ComponentType[];
      /** Specific component IDs */
      componentIds?: string[];
    };
    /** Priority filters */
    priorityFilter?: {
      /** Minimum priority level */
      minimumPriority: MessagePriority;
    };
    /** Content filters */
    contentFilters?: {
      /** Required tags */
      requiredTags?: string[];
      /** Excluded tags */
      excludedTags?: string[];
      /** Payload filters (JSON path expressions) */
      payloadFilters?: Record<string, unknown>;
    };
    /** Temporal filters */
    temporalFilters?: {
      /** Only messages newer than timestamp */
      newerThan?: string;
      /** Only messages older than timestamp */
      olderThan?: string;
    };
  };
  /** Subscription options */
  options: {
    /** Enable message buffering when component offline */
    bufferWhenOffline: boolean;
    /** Maximum buffer size */
    maxBufferSize: number;
    /** Message ordering guarantee */
    preserveOrder: boolean;
    /** Delivery reliability */
    deliveryMode: 'at_most_once' | 'at_least_once' | 'exactly_once';
  };
  /** Subscription creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last message delivery timestamp (ISO 8601) */
  lastDelivery?: string;
}

/**
 * Broadcast channel configuration
 */
export interface BroadcastConfig {
  /** Channel identifier */
  channelId: string;
  /** Channel name */
  name: string;
  /** Channel description */
  description: string;
  /** Message types allowed on this channel */
  allowedMessageTypes: MessageType[];
  /** Channel access control */
  accessControl: {
    /** Components allowed to publish */
    publishers: ComponentType[];
    /** Components allowed to subscribe */
    subscribers: ComponentType[];
    /** Require authentication for access */
    requireAuth: boolean;
  };
  /** Channel behavior settings */
  behavior: {
    /** Enable message persistence */
    persistent: boolean;
    /** Message retention period in milliseconds */
    retentionPeriod: number;
    /** Maximum concurrent subscribers */
    maxSubscribers: number;
    /** Rate limiting configuration */
    rateLimit: {
      /** Maximum messages per minute */
      messagesPerMinute: number;
      /** Burst allowance */
      burstSize: number;
    };
  };
  /** Channel monitoring */
  monitoring: {
    /** Enable delivery tracking */
    trackDelivery: boolean;
    /** Enable performance metrics */
    enableMetrics: boolean;
    /** Log message activity */
    logActivity: boolean;
  };
}

/**
 * Message routing rule configuration
 */
export interface RoutingRule {
  /** Rule identifier */
  ruleId: string;
  /** Rule name */
  name: string;
  /** Rule priority (higher numbers processed first) */
  priority: number;
  /** Rule condition */
  condition: {
    /** Message type conditions */
    messageTypes?: MessageType[];
    /** Source component conditions */
    sourceTypes?: ComponentType[];
    /** Target component conditions */
    targetTypes?: ComponentType[];
    /** Priority conditions */
    priorities?: MessagePriority[];
    /** Custom condition function */
    customCondition?: (envelope: MessageEnvelope) => boolean;
  };
  /** Routing actions */
  actions: {
    /** Transform message before routing */
    transform?: (envelope: MessageEnvelope) => MessageEnvelope;
    /** Override delivery mode */
    deliveryMode?: DeliveryMode;
    /** Add routing metadata */
    addMetadata?: Record<string, unknown>;
    /** Route to specific components */
    routeTo?: string[];
    /** Prevent routing to components */
    blockRouting?: string[];
    /** Log routing decision */
    logRouting?: boolean;
  };
  /** Rule status */
  enabled: boolean;
  /** Rule creation timestamp (ISO 8601) */
  createdAt: string;
}

/**
 * Message routing metrics and statistics
 */
export interface RoutingMetrics {
  /** Total messages processed */
  totalMessages: number;
  /** Messages by type */
  messagesByType: Record<MessageType, number>;
  /** Messages by priority */
  messagesByPriority: Record<MessagePriority, number>;
  /** Messages by delivery mode */
  messagesByDeliveryMode: Record<DeliveryMode, number>;
  /** Routing performance */
  performance: {
    /** Average routing time in milliseconds */
    avgRoutingTime: number;
    /** 95th percentile routing time */
    p95RoutingTime: number;
    /** Messages per second throughput */
    messagesPerSecond: number;
  };
  /** Delivery statistics */
  delivery: {
    /** Successful deliveries */
    successful: number;
    /** Failed deliveries */
    failed: number;
    /** Pending deliveries */
    pending: number;
    /** Average delivery time in milliseconds */
    avgDeliveryTime: number;
  };
  /** Error statistics */
  errors: {
    /** Routing errors */
    routingErrors: number;
    /** Delivery errors */
    deliveryErrors: number;
    /** Timeout errors */
    timeoutErrors: number;
    /** Validation errors */
    validationErrors: number;
  };
  /** Component statistics */
  components: {
    /** Active components */
    active: number;
    /** Registered components */
    registered: number;
    /** Responsive components */
    responsive: number;
    /** Components with errors */
    withErrors: number;
  };
  /** Last metrics update timestamp (ISO 8601) */
  lastUpdated: string;
}

/**
 * Cross-tab synchronization configuration
 */
export interface CrossTabSyncConfig {
  /** Synchronization identifier */
  syncId: string;
  /** Data types to synchronize */
  dataTypes: Array<'job_status' | 'config' | 'cache' | 'user_preferences' | 'session_state'>;
  /** Synchronization strategy */
  strategy: 'immediate' | 'batched' | 'periodic' | 'on_demand';
  /** Conflict resolution method */
  conflictResolution: 'last_write_wins' | 'merge' | 'user_choice' | 'custom';
  /** Synchronization options */
  options: {
    /** Enable change detection */
    changeDetection: boolean;
    /** Batch synchronization interval in milliseconds */
    batchInterval?: number;
    /** Maximum sync payload size in bytes */
    maxPayloadSize: number;
    /** Enable compression for large payloads */
    enableCompression: boolean;
  };
  /** Synchronization targets */
  targets: {
    /** Include background script */
    background: boolean;
    /** Include content scripts */
    contentScripts: boolean;
    /** Include extension pages */
    extensionPages: boolean;
    /** Include specific tab IDs */
    specificTabs?: number[];
  };
}

/**
 * Message router configuration and state
 */
export interface MessageRouterConfig {
  /** Router identifier */
  routerId: string;
  /** Registered components */
  components: Map<string, ComponentRegistration>;
  /** Active subscriptions */
  subscriptions: Map<string, MessageSubscription>;
  /** Broadcast channels */
  broadcastChannels: Map<string, BroadcastConfig>;
  /** Routing rules */
  routingRules: RoutingRule[];
  /** Cross-tab sync configuration */
  crossTabSync: CrossTabSyncConfig;
  /** Router settings */
  settings: {
    /** Enable message validation */
    enableValidation: boolean;
    /** Enable message compression */
    enableCompression: boolean;
    /** Default message timeout in milliseconds */
    defaultTimeout: number;
    /** Maximum message size in bytes */
    maxMessageSize: number;
    /** Enable debugging and logging */
    enableDebug: boolean;
  };
  /** Router performance tuning */
  performance: {
    /** Message queue size limit */
    queueSizeLimit: number;
    /** Processing batch size */
    batchSize: number;
    /** Processing interval in milliseconds */
    processingInterval: number;
    /** Enable message prioritization */
    enablePrioritization: boolean;
  };
}

/**
 * Message router interface for background service coordination
 */
export interface MessageRouter {
  /** Register a component for message routing */
  registerComponent(registration: ComponentRegistration): Promise<void>;
  /** Unregister a component */
  unregisterComponent(componentId: string): Promise<void>;
  /** Send a message to target component(s) */
  sendMessage(envelope: MessageEnvelope): Promise<string>;
  /** Subscribe to specific message types */
  subscribe(subscription: MessageSubscription): Promise<string>;
  /** Unsubscribe from messages */
  unsubscribe(subscriptionId: string): Promise<void>;
  /** Broadcast message to all listening components */
  broadcast(message: MessageEnvelope): Promise<void>;
  /** Get component health status */
  getComponentHealth(componentId: string): Promise<ComponentRegistration['health'] | undefined>;
  /** Get routing metrics */
  getMetrics(): Promise<RoutingMetrics>;
  /** Update routing configuration */
  updateConfig(config: Partial<MessageRouterConfig>): Promise<void>;
  /** Flush pending messages */
  flushMessages(): Promise<void>;
}
