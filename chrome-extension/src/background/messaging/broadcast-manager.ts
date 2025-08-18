/**
 * Broadcast manager for cross-component event broadcasting
 * Handles detection events, progress updates, and selective broadcasting
 */

import type { MessageRouter } from './message-router';
import type {
  BroadcastConfig,
  MessageEnvelope,
  ComponentType,
  MessageType,
  MessagePriority,
  ComponentRegistration,
} from '../types';

/**
 * Broadcast event types
 */
export type BroadcastEventType =
  | 'meeting_detected'
  | 'meeting_lost'
  | 'transcription_started'
  | 'transcription_progress'
  | 'transcription_completed'
  | 'transcription_failed'
  | 'config_updated'
  | 'storage_synced'
  | 'error_occurred'
  | 'system_status_changed';

/**
 * Broadcast event payload
 */
export interface BroadcastEvent {
  /** Event type */
  type: BroadcastEventType;
  /** Event payload */
  payload: unknown;
  /** Event priority */
  priority: MessagePriority;
  /** Target components (optional - defaults to all) */
  targets?: ComponentType[];
  /** Event metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Broadcast delivery result
 */
export interface BroadcastDeliveryResult {
  /** Broadcast event ID */
  eventId: string;
  /** Whether broadcast was successful */
  success: boolean;
  /** Number of components reached */
  componentsReached: number;
  /** Number of components that failed to receive */
  componentsFailed: number;
  /** Delivery duration in milliseconds */
  duration: number;
  /** Failed component details */
  failures: Array<{
    componentId: string;
    componentType: ComponentType;
    error: string;
  }>;
  /** Broadcast timestamp */
  timestamp: string;
}

/**
 * Subscription management for broadcasts
 */
export interface BroadcastSubscription {
  /** Subscription ID */
  subscriptionId: string;
  /** Component ID */
  componentId: string;
  /** Event types to subscribe to */
  eventTypes: BroadcastEventType[];
  /** Component type filters */
  componentTypeFilter?: ComponentType[];
  /** Priority threshold */
  priorityThreshold?: MessagePriority;
  /** Custom filter function */
  customFilter?: (event: BroadcastEvent) => boolean;
  /** Subscription timestamp */
  createdAt: string;
}

/**
 * Broadcast statistics
 */
export interface BroadcastStats {
  /** Total broadcasts sent */
  totalBroadcasts: number;
  /** Broadcasts by event type */
  broadcastsByType: Record<BroadcastEventType, number>;
  /** Successful deliveries */
  successfulDeliveries: number;
  /** Failed deliveries */
  failedDeliveries: number;
  /** Average delivery time */
  avgDeliveryTime: number;
  /** Components reached statistics */
  componentsReached: {
    total: number;
    byType: Record<ComponentType, number>;
  };
  /** Last broadcast timestamp */
  lastBroadcast?: string;
}

/**
 * Broadcast manager for cross-component communication
 */
export class BroadcastManager {
  private messageRouter: MessageRouter;
  private channels = new Map<string, BroadcastConfig>();
  private subscriptions = new Map<string, BroadcastSubscription>();
  private stats: BroadcastStats;
  private eventHistory: Array<{ event: BroadcastEvent; result: BroadcastDeliveryResult }> = [];
  private maxHistorySize = 100;

  constructor(messageRouter: MessageRouter) {
    this.messageRouter = messageRouter;
    this.stats = this.initializeStats();

    // Setup default broadcast channels
    this.setupDefaultChannels();
  }

  /**
   * Broadcast event to all listening components
   */
  async broadcastEvent(event: BroadcastEvent): Promise<BroadcastDeliveryResult> {
    const startTime = Date.now();
    const eventId = `broadcast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const result: BroadcastDeliveryResult = {
      eventId,
      success: false,
      componentsReached: 0,
      componentsFailed: 0,
      duration: 0,
      failures: [],
      timestamp: new Date().toISOString(),
    };

    try {
      // Create message envelope
      const envelope = this.createBroadcastEnvelope(eventId, event);

      // Get target components
      const targets = await this.resolveTargetComponents(event);

      if (targets.length === 0) {
        console.warn(`[BroadcastManager] No targets found for event: ${event.type}`);
        result.success = true; // Not an error if no targets
        result.duration = Date.now() - startTime;
        return result;
      }

      // Send to each target component
      const deliveryPromises = targets.map(target => this.deliverToComponent(envelope, target));

      const deliveryResults = await Promise.allSettled(deliveryPromises);

      // Process delivery results
      for (let i = 0; i < deliveryResults.length; i++) {
        const deliveryResult = deliveryResults[i];
        const target = targets[i];

        if (deliveryResult.status === 'fulfilled') {
          result.componentsReached++;
        } else {
          result.componentsFailed++;
          result.failures.push({
            componentId: target.componentId,
            componentType: target.type,
            error: deliveryResult.reason?.message || 'Unknown delivery error',
          });
        }
      }

      result.success = result.failures.length === 0;
      result.duration = Date.now() - startTime;

      // Update statistics
      this.updateBroadcastStats(event, result);

      // Store in event history
      this.addToEventHistory(event, result);
    } catch (error) {
      result.success = false;
      result.duration = Date.now() - startTime;
      result.failures.push({
        componentId: 'unknown',
        componentType: 'background',
        error: error instanceof Error ? error.message : String(error),
      });

      console.error(`[BroadcastManager] Broadcast failed for event ${event.type}:`, error);
    }

    return result;
  }

  /**
   * Broadcast meeting detection event
   */
  async broadcastMeetingDetected(
    meetingUrl: string,
    meetingTitle?: string,
    metadata?: Record<string, unknown>,
  ): Promise<BroadcastDeliveryResult> {
    const event: BroadcastEvent = {
      type: 'meeting_detected',
      payload: {
        meetingUrl,
        meetingTitle,
        detectedAt: new Date().toISOString(),
        ...metadata,
      },
      priority: 'high',
      targets: ['content_script', 'popup', 'sidepanel'],
    };

    return this.broadcastEvent(event);
  }

  /**
   * Broadcast transcription progress
   */
  async broadcastTranscriptionProgress(
    jobId: string,
    progress: number,
    stage: string,
    estimatedRemaining?: number,
  ): Promise<BroadcastDeliveryResult> {
    const event: BroadcastEvent = {
      type: 'transcription_progress',
      payload: {
        jobId,
        progress,
        stage,
        estimatedRemaining,
        timestamp: new Date().toISOString(),
      },
      priority: 'normal',
      targets: ['popup', 'sidepanel', 'content_script'],
    };

    return this.broadcastEvent(event);
  }

  /**
   * Broadcast transcription completion
   */
  async broadcastTranscriptionCompleted(
    jobId: string,
    result: unknown,
    duration: number,
  ): Promise<BroadcastDeliveryResult> {
    const event: BroadcastEvent = {
      type: 'transcription_completed',
      payload: {
        jobId,
        result,
        duration,
        completedAt: new Date().toISOString(),
      },
      priority: 'high',
      targets: ['popup', 'sidepanel', 'content_script'],
    };

    return this.broadcastEvent(event);
  }

  /**
   * Broadcast configuration change
   */
  async broadcastConfigChange(
    configKey: string,
    newValue: unknown,
    oldValue?: unknown,
  ): Promise<BroadcastDeliveryResult> {
    const event: BroadcastEvent = {
      type: 'config_updated',
      payload: {
        configKey,
        newValue,
        oldValue,
        changedAt: new Date().toISOString(),
      },
      priority: 'normal',
    };

    return this.broadcastEvent(event);
  }

  /**
   * Broadcast error event
   */
  async broadcastError(
    errorType: string,
    errorMessage: string,
    errorDetails?: Record<string, unknown>,
  ): Promise<BroadcastDeliveryResult> {
    const event: BroadcastEvent = {
      type: 'error_occurred',
      payload: {
        errorType,
        errorMessage,
        errorDetails,
        timestamp: new Date().toISOString(),
      },
      priority: 'urgent',
    };

    return this.broadcastEvent(event);
  }

  /**
   * Subscribe to broadcast events
   */
  async subscribeToBroadcasts(subscription: BroadcastSubscription): Promise<string> {
    try {
      // Validate subscription
      if (!this.validateSubscription(subscription)) {
        throw new Error(`Invalid broadcast subscription: ${subscription.subscriptionId}`);
      }

      // Store subscription
      this.subscriptions.set(subscription.subscriptionId, {
        ...subscription,
        createdAt: new Date().toISOString(),
      });

      return subscription.subscriptionId;
    } catch (error) {
      console.error(`[BroadcastManager] Failed to create subscription:`, error);
      throw error;
    }
  }

  /**
   * Unsubscribe from broadcast events
   */
  async unsubscribeFromBroadcasts(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      console.warn(`[BroadcastManager] Subscription ${subscriptionId} not found`);
      return;
    }

    this.subscriptions.delete(subscriptionId);
  }

  /**
   * Get broadcast statistics
   */
  getBroadcastStats(): BroadcastStats {
    return { ...this.stats };
  }

  /**
   * Get event history
   */
  getEventHistory(eventType?: BroadcastEventType): Array<{ event: BroadcastEvent; result: BroadcastDeliveryResult }> {
    if (eventType) {
      return this.eventHistory.filter(entry => entry.event.type === eventType);
    }
    return [...this.eventHistory];
  }

  /**
   * Create broadcast channels
   */
  createBroadcastChannel(config: BroadcastConfig): void {
    this.channels.set(config.channelId, config);
  }

  /**
   * Remove broadcast channel
   */
  removeBroadcastChannel(channelId: string): void {
    this.channels.delete(channelId);
  }

  /**
   * Clear statistics and history
   */
  clearStats(): void {
    this.stats = this.initializeStats();
    this.eventHistory = [];
  }

  /**
   * Create broadcast message envelope
   */
  private createBroadcastEnvelope(eventId: string, event: BroadcastEvent): MessageEnvelope {
    return {
      messageId: eventId,
      type: this.getMessageType(event.type),
      priority: event.priority,
      deliveryMode: 'broadcast',
      source: {
        componentId: 'broadcast-manager',
        type: 'background',
      },
      target: {
        componentTypes: event.targets,
      },
      payload: {
        eventType: event.type,
        ...event.payload,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        tags: ['broadcast', event.type],
        requiresAck: false,
        ...event.metadata,
      },
      delivery: {
        attempts: 0,
        maxAttempts: 3,
        timeout: 10000,
        confirmations: [],
      },
    };
  }

  /**
   * Resolve target components for broadcast
   */
  private async resolveTargetComponents(event: BroadcastEvent): Promise<ComponentRegistration[]> {
    // Get all registered components from message router
    const _routerMetrics = await this.messageRouter.getMetrics();

    // For now, we'll simulate component resolution
    // In a real implementation, this would query the message router for registered components
    const mockComponents: ComponentRegistration[] = [
      {
        componentId: 'popup-main',
        type: 'popup',
        name: 'Main Popup',
        capabilities: {
          backgroundProcessing: false,
          notifications: true,
          storage: true,
          externalAPI: false,
          supportedMessages: ['job_status', 'job_progress', 'notification'],
        },
        health: {
          responsive: true,
          lastHeartbeat: new Date().toISOString(),
          responseTime: 50,
          errorCount: 0,
        },
        registeredAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
      },
      {
        componentId: 'content-script-main',
        type: 'content_script',
        name: 'Main Content Script',
        tabId: 123,
        capabilities: {
          backgroundProcessing: false,
          notifications: false,
          storage: false,
          externalAPI: true,
          supportedMessages: ['detection_event', 'job_status'],
        },
        health: {
          responsive: true,
          lastHeartbeat: new Date().toISOString(),
          responseTime: 30,
          errorCount: 0,
        },
        registeredAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
      },
    ];

    // Filter components based on event targets
    let targetComponents = mockComponents;

    if (event.targets) {
      targetComponents = mockComponents.filter(comp => event.targets!.includes(comp.type));
    }

    // Apply subscription filters
    return targetComponents.filter(comp => this.componentMatchesSubscriptions(comp, event));
  }

  /**
   * Check if component matches any subscriptions for the event
   */
  private componentMatchesSubscriptions(component: ComponentRegistration, event: BroadcastEvent): boolean {
    const componentSubscriptions = Array.from(this.subscriptions.values()).filter(
      sub => sub.componentId === component.componentId,
    );

    if (componentSubscriptions.length === 0) {
      // If no subscriptions, allow all events (default behavior)
      return true;
    }

    return componentSubscriptions.some(sub => {
      // Check event type match
      if (!sub.eventTypes.includes(event.type)) {
        return false;
      }

      // Check priority threshold
      if (sub.priorityThreshold) {
        const priorities: MessagePriority[] = ['bulk', 'low', 'normal', 'urgent', 'critical'];
        const eventPriorityIndex = priorities.indexOf(event.priority);
        const thresholdIndex = priorities.indexOf(sub.priorityThreshold);
        if (eventPriorityIndex < thresholdIndex) {
          return false;
        }
      }

      // Check component type filter
      if (sub.componentTypeFilter && !sub.componentTypeFilter.includes(component.type)) {
        return false;
      }

      // Check custom filter
      if (sub.customFilter && !sub.customFilter(event)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Deliver broadcast to a specific component
   */
  private async deliverToComponent(envelope: MessageEnvelope, target: ComponentRegistration): Promise<void> {
    try {
      // Update envelope target to specific component
      const targetEnvelope: MessageEnvelope = {
        ...envelope,
        deliveryMode: 'unicast',
        target: {
          componentId: target.componentId,
          componentTypes: [target.type],
        },
      };

      // Send through message router
      await this.messageRouter.sendMessage(targetEnvelope);
    } catch (error) {
      console.error(`[BroadcastManager] Failed to deliver to ${target.componentId}:`, error);
      throw error;
    }
  }

  /**
   * Get message type for broadcast event
   */
  private getMessageType(eventType: BroadcastEventType): MessageType {
    switch (eventType) {
      case 'meeting_detected':
      case 'meeting_lost':
        return 'detection_event';
      case 'transcription_started':
      case 'transcription_completed':
      case 'transcription_failed':
        return 'job_status';
      case 'transcription_progress':
        return 'job_progress';
      case 'config_updated':
        return 'config_change';
      case 'storage_synced':
        return 'storage_sync';
      case 'error_occurred':
        return 'error_report';
      case 'system_status_changed':
        return 'health_check';
      default:
        return 'broadcast';
    }
  }

  /**
   * Validate broadcast subscription
   */
  private validateSubscription(subscription: BroadcastSubscription): boolean {
    return Boolean(subscription.subscriptionId && subscription.componentId && subscription.eventTypes.length > 0);
  }

  /**
   * Update broadcast statistics
   */
  private updateBroadcastStats(event: BroadcastEvent, result: BroadcastDeliveryResult): void {
    this.stats.totalBroadcasts++;
    this.stats.broadcastsByType[event.type] = (this.stats.broadcastsByType[event.type] || 0) + 1;

    this.stats.successfulDeliveries += result.componentsReached;
    this.stats.failedDeliveries += result.componentsFailed;

    // Update average delivery time
    const totalDeliveries = this.stats.successfulDeliveries + this.stats.failedDeliveries;
    if (totalDeliveries > 0) {
      this.stats.avgDeliveryTime =
        (this.stats.avgDeliveryTime * (totalDeliveries - result.componentsReached - result.componentsFailed) +
          result.duration * (result.componentsReached + result.componentsFailed)) /
        totalDeliveries;
    }

    this.stats.componentsReached.total += result.componentsReached;
    this.stats.lastBroadcast = result.timestamp;
  }

  /**
   * Add event to history
   */
  private addToEventHistory(event: BroadcastEvent, result: BroadcastDeliveryResult): void {
    this.eventHistory.push({ event, result });

    // Maintain history size limit
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Setup default broadcast channels
   */
  private setupDefaultChannels(): void {
    // Meeting events channel
    this.createBroadcastChannel({
      channelId: 'meeting-events',
      name: 'Meeting Events',
      description: 'Channel for meeting detection and status events',
      allowedMessageTypes: ['detection_event', 'job_status'],
      accessControl: {
        publishers: ['background', 'content_script'],
        subscribers: ['popup', 'sidepanel', 'content_script'],
        requireAuth: false,
      },
      behavior: {
        persistent: true,
        retentionPeriod: 3600000, // 1 hour
        maxSubscribers: 10,
        rateLimit: {
          messagesPerMinute: 100,
          burstSize: 10,
        },
      },
      monitoring: {
        trackDelivery: true,
        enableMetrics: true,
        logActivity: true,
      },
    });

    // System events channel
    this.createBroadcastChannel({
      channelId: 'system-events',
      name: 'System Events',
      description: 'Channel for system status and error events',
      allowedMessageTypes: ['error_report', 'health_check', 'config_change'],
      accessControl: {
        publishers: ['background'],
        subscribers: ['popup', 'options', 'sidepanel'],
        requireAuth: false,
      },
      behavior: {
        persistent: false,
        retentionPeriod: 300000, // 5 minutes
        maxSubscribers: 5,
        rateLimit: {
          messagesPerMinute: 50,
          burstSize: 5,
        },
      },
      monitoring: {
        trackDelivery: true,
        enableMetrics: true,
        logActivity: false,
      },
    });
  }

  /**
   * Initialize broadcast statistics
   */
  private initializeStats(): BroadcastStats {
    return {
      totalBroadcasts: 0,
      broadcastsByType: {
        meeting_detected: 0,
        meeting_lost: 0,
        transcription_started: 0,
        transcription_progress: 0,
        transcription_completed: 0,
        transcription_failed: 0,
        config_updated: 0,
        storage_synced: 0,
        error_occurred: 0,
        system_status_changed: 0,
      },
      successfulDeliveries: 0,
      failedDeliveries: 0,
      avgDeliveryTime: 0,
      componentsReached: {
        total: 0,
        byType: {
          background: 0,
          content_script: 0,
          popup: 0,
          options: 0,
          sidepanel: 0,
          devtools: 0,
          offscreen: 0,
        },
      },
    };
  }
}
