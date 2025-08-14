/**
 * Event Subscriber
 *
 * Background service event subscription with progress update and status
 * change handling for content script event processing.
 */

import { messageDispatcher } from './message-dispatcher';
// Event subscription functionality
// import type { EventSubscription } from '../types/communication';

/**
 * Event types from background service
 */
export type BackgroundEventType =
  | 'transcription.progress'
  | 'transcription.completed'
  | 'transcription.failed'
  | 'transcription.cancelled'
  | 'meeting.detected'
  | 'meeting.analysis.completed'
  | 'content.extracted'
  | 'storage.updated'
  | 'settings.changed'
  | 'error.occurred'
  | 'connection.status'
  | 'system.notification';

/**
 * Event severity levels
 */
export type EventSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Background event data
 */
export interface BackgroundEvent<T = unknown> {
  /** Event type */
  type: BackgroundEventType;
  /** Event data */
  data: T;
  /** Event severity */
  severity: EventSeverity;
  /** Event timestamp */
  timestamp: Date;
  /** Event source */
  source: string;
  /** Event ID */
  eventId: string;
  /** Correlation ID for tracking */
  correlationId?: string;
  /** Event metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Event handler function type
 */
export type EventHandler<T = unknown> = (event: BackgroundEvent<T>) => void | Promise<void>;

/**
 * Event subscription configuration
 */
export interface EventSubscriptionConfig {
  /** Event types to subscribe to */
  eventTypes: BackgroundEventType[];
  /** Event handler function */
  handler: EventHandler;
  /** Filter function for events */
  filter?: (event: BackgroundEvent) => boolean;
  /** Whether to receive historical events */
  includeHistory?: boolean;
  /** Maximum events to buffer */
  bufferSize?: number;
  /** Priority for event processing */
  priority?: 'low' | 'medium' | 'high';
  /** Whether subscription is active */
  active?: boolean;
  /** Subscription metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Event buffer for handling bursts
 */
interface EventBuffer {
  /** Buffered events */
  events: BackgroundEvent[];
  /** Buffer size limit */
  maxSize: number;
  /** Last flush timestamp */
  lastFlush: Date;
  /** Flush interval timer */
  flushTimer?: NodeJS.Timeout;
}

/**
 * Subscription state
 */
interface SubscriptionState {
  /** Subscription configuration */
  config: EventSubscriptionConfig;
  /** Event buffer */
  buffer: EventBuffer;
  /** Total events received */
  eventsReceived: number;
  /** Total events processed */
  eventsProcessed: number;
  /** Last event timestamp */
  lastEventTime?: Date;
  /** Error count */
  errorCount: number;
  /** Subscription status */
  status: 'active' | 'paused' | 'error' | 'stopped';
  /** Created timestamp */
  createdAt: Date;
}

/**
 * Subscriber configuration
 */
export interface SubscriberConfig {
  /** Maximum subscriptions */
  maxSubscriptions: number;
  /** Default buffer size */
  defaultBufferSize: number;
  /** Buffer flush interval in ms */
  bufferFlushInterval: number;
  /** Enable debug logging */
  enableDebugLogging: boolean;
  /** Event processing timeout */
  eventProcessingTimeout: number;
  /** Maximum event history */
  maxEventHistory: number;
  /** Reconnection delay */
  reconnectionDelay: number;
}

/**
 * Subscriber statistics
 */
export interface SubscriberStatistics {
  /** Total subscriptions */
  totalSubscriptions: number;
  /** Active subscriptions */
  activeSubscriptions: number;
  /** Total events received */
  totalEventsReceived: number;
  /** Total events processed */
  totalEventsProcessed: number;
  /** Events by type */
  eventsByType: Record<BackgroundEventType, number>;
  /** Events by severity */
  eventsBySeverity: Record<EventSeverity, number>;
  /** Average processing time */
  averageProcessingTime: number;
  /** Error rate */
  errorRate: number;
  /** Connection status */
  connectionStatus: string;
  /** Last event timestamp */
  lastEventTime?: Date;
}

/**
 * Event subscriber for background service events
 */
export class EventSubscriber {
  private static instance: EventSubscriber;
  private config: SubscriberConfig;
  private subscriptions: Map<string, SubscriptionState> = new Map();
  private eventHistory: BackgroundEvent[] = [];
  private globalEventHandlers: Map<BackgroundEventType, Set<EventHandler>> = new Map();
  private isConnected: boolean = false;
  private connectionListener: chrome.runtime.Port | null = null;
  private statistics: SubscriberStatistics;
  private processingQueue: BackgroundEvent[] = [];
  private processingQueueTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<SubscriberConfig> = {}) {
    this.config = {
      maxSubscriptions: 50,
      defaultBufferSize: 100,
      bufferFlushInterval: 1000,
      enableDebugLogging: false,
      eventProcessingTimeout: 5000,
      maxEventHistory: 1000,
      reconnectionDelay: 2000,
      ...config,
    };

    this.statistics = {
      totalSubscriptions: 0,
      activeSubscriptions: 0,
      totalEventsReceived: 0,
      totalEventsProcessed: 0,
      eventsByType: {} as Record<BackgroundEventType, number>,
      eventsBySeverity: {} as Record<EventSeverity, number>,
      averageProcessingTime: 0,
      errorRate: 0,
      connectionStatus: 'disconnected',
    };

    this.initializeConnection();
    this.startProcessingQueue();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<SubscriberConfig>): EventSubscriber {
    if (!EventSubscriber.instance) {
      EventSubscriber.instance = new EventSubscriber(config);
    }
    return EventSubscriber.instance;
  }

  /**
   * Subscribe to events
   */
  subscribe(
    eventTypes: BackgroundEventType | BackgroundEventType[],
    handler: EventHandler,
    options: Partial<EventSubscriptionConfig> = {},
  ): string {
    const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes];
    const subscriptionId = this.generateSubscriptionId();

    if (this.subscriptions.size >= this.config.maxSubscriptions) {
      throw new Error('Maximum subscriptions exceeded');
    }

    const config: EventSubscriptionConfig = {
      eventTypes: types,
      handler,
      filter: options.filter,
      includeHistory: options.includeHistory || false,
      bufferSize: options.bufferSize || this.config.defaultBufferSize,
      priority: options.priority || 'medium',
      active: options.active !== false,
      metadata: options.metadata,
    };

    const subscriptionState: SubscriptionState = {
      config,
      buffer: {
        events: [],
        maxSize: config.bufferSize!,
        lastFlush: new Date(),
      },
      eventsReceived: 0,
      eventsProcessed: 0,
      errorCount: 0,
      status: 'active',
      createdAt: new Date(),
    };

    this.subscriptions.set(subscriptionId, subscriptionState);
    this.statistics.totalSubscriptions++;
    this.updateActiveSubscriptions();

    // Register with background service
    this.registerSubscription(subscriptionId, config);

    // Send historical events if requested
    if (config.includeHistory) {
      this.sendHistoricalEvents(subscriptionId, config);
    }

    this.log(`Subscription created: ${subscriptionId} for events: ${types.join(', ')}`);
    return subscriptionId;
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return false;
    }

    // Clear buffer timer
    if (subscription.buffer.flushTimer) {
      clearTimeout(subscription.buffer.flushTimer);
    }

    // Remove subscription
    this.subscriptions.delete(subscriptionId);
    this.updateActiveSubscriptions();

    // Unregister with background service
    this.unregisterSubscription(subscriptionId);

    this.log(`Subscription removed: ${subscriptionId}`);
    return true;
  }

  /**
   * Add global event handler
   */
  addEventListener<T = unknown>(eventType: BackgroundEventType, handler: EventHandler<T>): () => void {
    if (!this.globalEventHandlers.has(eventType)) {
      this.globalEventHandlers.set(eventType, new Set());
    }

    this.globalEventHandlers.get(eventType)!.add(handler);

    return () => {
      const handlers = this.globalEventHandlers.get(eventType);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.globalEventHandlers.delete(eventType);
        }
      }
    };
  }

  /**
   * Pause subscription
   */
  pauseSubscription(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return false;
    }

    subscription.status = 'paused';
    subscription.config.active = false;
    this.updateActiveSubscriptions();

    this.log(`Subscription paused: ${subscriptionId}`);
    return true;
  }

  /**
   * Resume subscription
   */
  resumeSubscription(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return false;
    }

    subscription.status = 'active';
    subscription.config.active = true;
    this.updateActiveSubscriptions();

    this.log(`Subscription resumed: ${subscriptionId}`);
    return true;
  }

  /**
   * Get subscription information
   */
  getSubscription(subscriptionId: string): SubscriptionState | null {
    return this.subscriptions.get(subscriptionId) || null;
  }

  /**
   * Get all subscriptions
   */
  getAllSubscriptions(): Map<string, SubscriptionState> {
    return new Map(this.subscriptions);
  }

  /**
   * Get subscriber statistics
   */
  getStatistics(): SubscriberStatistics {
    return { ...this.statistics };
  }

  /**
   * Clear event history
   */
  clearEventHistory(): void {
    this.eventHistory.length = 0;
    this.log('Event history cleared');
  }

  /**
   * Get event history
   */
  getEventHistory(eventType?: BackgroundEventType, limit?: number): BackgroundEvent[] {
    let events = this.eventHistory;

    if (eventType) {
      events = events.filter(event => event.type === eventType);
    }

    if (limit) {
      events = events.slice(-limit);
    }

    return [...events];
  }

  /**
   * Initialize connection to background service
   */
  private async initializeConnection(): Promise<void> {
    try {
      this.statistics.connectionStatus = 'connecting';

      // Create event listener port
      this.connectionListener = chrome.runtime.connect({ name: 'event-subscriber' });

      // Setup message listener for events
      this.connectionListener.onMessage.addListener((event: BackgroundEvent) => {
        this.handleBackgroundEvent(event);
      });

      // Setup disconnect listener
      this.connectionListener.onDisconnect.addListener(() => {
        this.handleConnectionDisconnect();
      });

      // Setup browser event listeners
      this.setupBrowserEventListeners();

      this.isConnected = true;
      this.statistics.connectionStatus = 'connected';
      this.log('Connected to background service for events');
    } catch (error) {
      this.statistics.connectionStatus = 'error';
      this.log(`Event connection failed: ${error}`);

      // Retry connection
      setTimeout(() => {
        if (!this.isConnected) {
          this.initializeConnection();
        }
      }, this.config.reconnectionDelay);
    }
  }

  /**
   * Setup browser event listeners
   */
  private setupBrowserEventListeners(): void {
    // Listen for runtime messages (fallback)
    chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
      if (message.type && message.type.startsWith('event.')) {
        const event: BackgroundEvent = {
          type: message.type.replace('event.', '') as BackgroundEventType,
          data: message.data,
          severity: message.severity || 'info',
          timestamp: new Date(message.timestamp || Date.now()),
          source: message.source || 'background',
          eventId: message.eventId || this.generateEventId(),
          correlationId: message.correlationId,
          metadata: message.metadata,
        };

        this.handleBackgroundEvent(event);
      }
    });

    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, areaName) => {
      const event: BackgroundEvent = {
        type: 'storage.updated',
        data: { changes, areaName },
        severity: 'info',
        timestamp: new Date(),
        source: 'browser',
        eventId: this.generateEventId(),
      };

      this.handleBackgroundEvent(event);
    });
  }

  /**
   * Handle event from background service
   */
  private handleBackgroundEvent(event: BackgroundEvent): void {
    this.statistics.totalEventsReceived++;
    this.statistics.lastEventTime = event.timestamp;

    // Update event type statistics
    this.statistics.eventsByType[event.type] = (this.statistics.eventsByType[event.type] || 0) + 1;

    // Update severity statistics
    this.statistics.eventsBySeverity[event.severity] = (this.statistics.eventsBySeverity[event.severity] || 0) + 1;

    // Add to history
    this.addToEventHistory(event);

    // Add to processing queue
    this.processingQueue.push(event);

    this.log(`Event received: ${event.type} (${event.eventId})`);
  }

  /**
   * Handle connection disconnect
   */
  private handleConnectionDisconnect(): void {
    this.isConnected = false;
    this.connectionListener = null;
    this.statistics.connectionStatus = 'disconnected';
    this.log('Disconnected from background service');

    // Mark all subscriptions as paused
    this.subscriptions.forEach(subscription => {
      if (subscription.status === 'active') {
        subscription.status = 'paused';
      }
    });

    // Attempt reconnection
    setTimeout(() => {
      if (!this.isConnected) {
        this.initializeConnection();
      }
    }, this.config.reconnectionDelay);
  }

  /**
   * Start processing queue
   */
  private startProcessingQueue(): void {
    this.processingQueueTimer = setInterval(() => {
      this.processEventQueue();
    }, 100); // Process every 100ms
  }

  /**
   * Process event queue
   */
  private async processEventQueue(): Promise<void> {
    if (this.processingQueue.length === 0) {
      return;
    }

    const events = this.processingQueue.splice(0, 10); // Process up to 10 events per batch

    for (const event of events) {
      await this.processEvent(event);
    }
  }

  /**
   * Process individual event
   */
  private async processEvent(event: BackgroundEvent): Promise<void> {
    const startTime = performance.now();

    try {
      // Process subscriptions
      await this.processSubscriptions(event);

      // Process global handlers
      await this.processGlobalHandlers(event);

      const endTime = performance.now();
      this.updateProcessingTime(endTime - startTime);
      this.statistics.totalEventsProcessed++;
    } catch (error) {
      this.log(`Event processing error: ${error}`);
      this.statistics.errorRate = this.calculateErrorRate();
    }
  }

  /**
   * Process event for subscriptions
   */
  private async processSubscriptions(event: BackgroundEvent): Promise<void> {
    const promises: Promise<void>[] = [];

    this.subscriptions.forEach((subscription, subscriptionId) => {
      if (!subscription.config.active || subscription.status !== 'active') {
        return;
      }

      if (!subscription.config.eventTypes.includes(event.type)) {
        return;
      }

      if (subscription.config.filter && !subscription.config.filter(event)) {
        return;
      }

      const promise = this.processSubscriptionEvent(subscriptionId, subscription, event);
      promises.push(promise);
    });

    await Promise.allSettled(promises);
  }

  /**
   * Process event for specific subscription
   */
  private async processSubscriptionEvent(
    subscriptionId: string,
    subscription: SubscriptionState,
    event: BackgroundEvent,
  ): Promise<void> {
    try {
      subscription.eventsReceived++;

      // Add to buffer
      subscription.buffer.events.push(event);

      // Check if buffer should be flushed
      if (subscription.buffer.events.length >= subscription.buffer.maxSize) {
        await this.flushSubscriptionBuffer(subscriptionId, subscription);
      } else {
        // Schedule buffer flush
        this.scheduleBufferFlush(subscriptionId, subscription);
      }
    } catch (error) {
      subscription.errorCount++;
      subscription.status = 'error';
      this.log(`Subscription error ${subscriptionId}: ${error}`);
    }
  }

  /**
   * Flush subscription buffer
   */
  private async flushSubscriptionBuffer(subscriptionId: string, subscription: SubscriptionState): Promise<void> {
    if (subscription.buffer.events.length === 0) {
      return;
    }

    const events = subscription.buffer.events.splice(0);
    subscription.buffer.lastFlush = new Date();

    try {
      for (const event of events) {
        await Promise.race([
          subscription.config.handler(event),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Handler timeout')), this.config.eventProcessingTimeout),
          ),
        ]);

        subscription.eventsProcessed++;
        subscription.lastEventTime = event.timestamp;
      }
    } catch (error) {
      subscription.errorCount++;
      this.log(`Handler error for ${subscriptionId}: ${error}`);
    }
  }

  /**
   * Schedule buffer flush
   */
  private scheduleBufferFlush(subscriptionId: string, subscription: SubscriptionState): void {
    if (subscription.buffer.flushTimer) {
      return; // Already scheduled
    }

    subscription.buffer.flushTimer = setTimeout(() => {
      subscription.buffer.flushTimer = undefined;
      this.flushSubscriptionBuffer(subscriptionId, subscription);
    }, this.config.bufferFlushInterval);
  }

  /**
   * Process global event handlers
   */
  private async processGlobalHandlers(event: BackgroundEvent): Promise<void> {
    const handlers = this.globalEventHandlers.get(event.type);
    if (!handlers || handlers.size === 0) {
      return;
    }

    const promises = Array.from(handlers).map(handler =>
      Promise.race([
        handler(event),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Global handler timeout')), this.config.eventProcessingTimeout),
        ),
      ]).catch(error => {
        this.log(`Global handler error for ${event.type}: ${error}`);
      }),
    );

    await Promise.allSettled(promises);
  }

  /**
   * Add event to history
   */
  private addToEventHistory(event: BackgroundEvent): void {
    this.eventHistory.push(event);

    // Trim history if it exceeds maximum
    if (this.eventHistory.length > this.config.maxEventHistory) {
      this.eventHistory.splice(0, this.eventHistory.length - this.config.maxEventHistory);
    }
  }

  /**
   * Register subscription with background service
   */
  private async registerSubscription(subscriptionId: string, config: EventSubscriptionConfig): Promise<void> {
    try {
      await messageDispatcher.sendMessage({
        type: 'event.subscribe',
        payload: {
          subscriptionId,
          eventTypes: config.eventTypes,
          priority: config.priority,
          metadata: config.metadata,
        },
        timeout: 5000,
      });
    } catch (error) {
      this.log(`Failed to register subscription ${subscriptionId}: ${error}`);
    }
  }

  /**
   * Unregister subscription with background service
   */
  private async unregisterSubscription(subscriptionId: string): Promise<void> {
    try {
      await messageDispatcher.sendMessage({
        type: 'event.unsubscribe',
        payload: { subscriptionId },
        timeout: 5000,
      });
    } catch (error) {
      this.log(`Failed to unregister subscription ${subscriptionId}: ${error}`);
    }
  }

  /**
   * Send historical events to subscription
   */
  private sendHistoricalEvents(subscriptionId: string, config: EventSubscriptionConfig): void {
    const historicalEvents = this.eventHistory.filter(
      event => config.eventTypes.includes(event.type) && (!config.filter || config.filter(event)),
    );

    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return;
    }

    historicalEvents.forEach(event => {
      subscription.buffer.events.push(event);
    });

    if (subscription.buffer.events.length > 0) {
      this.scheduleBufferFlush(subscriptionId, subscription);
    }
  }

  /**
   * Update active subscriptions count
   */
  private updateActiveSubscriptions(): void {
    this.statistics.activeSubscriptions = Array.from(this.subscriptions.values()).filter(
      sub => sub.status === 'active',
    ).length;
  }

  /**
   * Update processing time statistics
   */
  private updateProcessingTime(processingTime: number): void {
    const currentAverage = this.statistics.averageProcessingTime;
    const totalProcessed = this.statistics.totalEventsProcessed;

    this.statistics.averageProcessingTime = (currentAverage * totalProcessed + processingTime) / (totalProcessed + 1);
  }

  /**
   * Calculate error rate
   */
  private calculateErrorRate(): number {
    const totalErrors = Array.from(this.subscriptions.values()).reduce((sum, sub) => sum + sub.errorCount, 0);

    return totalErrors / Math.max(this.statistics.totalEventsProcessed, 1);
  }

  /**
   * Generate subscription ID
   */
  private generateSubscriptionId(): string {
    return `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate event ID
   */
  private generateEventId(): string {
    return `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log debug message
   */
  private log(message: string): void {
    if (this.config.enableDebugLogging) {
      console.log(`[EventSubscriber] ${message}`);
    }
  }

  /**
   * Cleanup subscriber
   */
  cleanup(): void {
    // Clear processing timer
    if (this.processingQueueTimer) {
      clearInterval(this.processingQueueTimer);
      this.processingQueueTimer = null;
    }

    // Clear all subscription buffers
    this.subscriptions.forEach(subscription => {
      if (subscription.buffer.flushTimer) {
        clearTimeout(subscription.buffer.flushTimer);
      }
    });

    // Clear subscriptions
    this.subscriptions.clear();

    // Clear global handlers
    this.globalEventHandlers.clear();

    // Disconnect from background service
    if (this.connectionListener) {
      this.connectionListener.disconnect();
      this.connectionListener = null;
    }

    this.isConnected = false;
    this.statistics.connectionStatus = 'disconnected';

    this.log('Event subscriber cleanup completed');
  }
}

// Export singleton instance
export const eventSubscriber = EventSubscriber.getInstance();

// Export utility functions
export const subscriberUtils = {
  /**
   * Get subscriber instance
   */
  getInstance: (config?: Partial<SubscriberConfig>) => EventSubscriber.getInstance(config),

  /**
   * Subscribe to single event type
   */
  on: <T = unknown>(
    eventType: BackgroundEventType,
    handler: EventHandler<T>,
    options?: Partial<EventSubscriptionConfig>,
  ): string => eventSubscriber.subscribe(eventType, handler, options),

  /**
   * Subscribe to multiple event types
   */
  onMultiple: <T = unknown>(
    eventTypes: BackgroundEventType[],
    handler: EventHandler<T>,
    options?: Partial<EventSubscriptionConfig>,
  ): string => eventSubscriber.subscribe(eventTypes, handler, options),

  /**
   * Unsubscribe from events
   */
  off: (subscriptionId: string): boolean => eventSubscriber.unsubscribe(subscriptionId),

  /**
   * Add global event listener
   */
  addEventListener: <T = unknown>(eventType: BackgroundEventType, handler: EventHandler<T>): (() => void) =>
    eventSubscriber.addEventListener(eventType, handler),

  /**
   * Get statistics
   */
  getStats: (): SubscriberStatistics => eventSubscriber.getStatistics(),

  /**
   * Get event history
   */
  getHistory: (eventType?: BackgroundEventType, limit?: number): BackgroundEvent[] =>
    eventSubscriber.getEventHistory(eventType, limit),

  /**
   * Cleanup subscriber
   */
  cleanup: (): void => {
    eventSubscriber.cleanup();
  },
};
