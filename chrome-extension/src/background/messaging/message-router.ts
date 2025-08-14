/**
 * Message router for cross-component communication
 * Implements MessageRouter with component registration, routing, and conflict prevention
 */

import type {
  MessageRouter as IMessageRouter,
  ComponentRegistration,
  MessageEnvelope,
  MessageSubscription,
  RoutingMetrics,
  MessageRouterConfig,
  ComponentType,
  MessageType,
  MessagePriority,
  RoutingRule,
} from '../types';

/**
 * Message validation result
 */
export interface MessageValidationResult {
  /** Whether message is valid */
  valid: boolean;
  /** Validation error message */
  error?: string;
  /** Validation warnings */
  warnings: string[];
}

/**
 * Route resolution result
 */
export interface RouteResolutionResult {
  /** Target components for message delivery */
  targets: ComponentRegistration[];
  /** Applied routing rules */
  appliedRules: string[];
  /** Routing decision reasons */
  reasons: string[];
}

/**
 * Message router implementation for cross-component communication
 */
export class MessageRouter implements IMessageRouter {
  private config: MessageRouterConfig;
  private components = new Map<string, ComponentRegistration>();
  private subscriptions = new Map<string, MessageSubscription>();
  private messageQueue: MessageEnvelope[] = [];
  private processingInterval: NodeJS.Timeout | null = null;
  private metrics: RoutingMetrics;
  private rateLimiters = new Map<string, { count: number; resetTime: number }>();

  constructor(config: MessageRouterConfig) {
    this.config = config;
    this.metrics = this.initializeMetrics();

    if (this.config.performance.enablePrioritization) {
      this.startMessageProcessing();
    }
  }

  /**
   * Register a component for message routing
   */
  async registerComponent(registration: ComponentRegistration): Promise<void> {
    try {
      // Validate registration
      if (!this.validateComponentRegistration(registration)) {
        throw new Error(`Invalid component registration: ${registration.componentId}`);
      }

      // Check for duplicate registration
      if (this.components.has(registration.componentId)) {
        console.warn(`[MessageRouter] Component ${registration.componentId} already registered, updating`);
      }

      // Register component
      this.components.set(registration.componentId, {
        ...registration,
        registeredAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
      });

      console.log(`[MessageRouter] Component registered: ${registration.componentId} (${registration.type})`);

      // Update metrics
      this.updateComponentMetrics();
    } catch (error) {
      console.error(`[MessageRouter] Failed to register component ${registration.componentId}:`, error);
      throw error;
    }
  }

  /**
   * Unregister a component
   */
  async unregisterComponent(componentId: string): Promise<void> {
    try {
      const component = this.components.get(componentId);
      if (!component) {
        console.warn(`[MessageRouter] Component ${componentId} not found for unregistration`);
        return;
      }

      // Remove component
      this.components.delete(componentId);

      // Remove related subscriptions
      const subscriptionsToRemove = Array.from(this.subscriptions.entries())
        .filter(([_, sub]) => sub.componentId === componentId)
        .map(([subId, _]) => subId);

      for (const subId of subscriptionsToRemove) {
        this.subscriptions.delete(subId);
      }

      // Remove pending messages for this component
      this.messageQueue = this.messageQueue.filter(msg => msg.target.componentId !== componentId);

      console.log(`[MessageRouter] Component unregistered: ${componentId}`);

      // Update metrics
      this.updateComponentMetrics();
    } catch (error) {
      console.error(`[MessageRouter] Failed to unregister component ${componentId}:`, error);
      throw error;
    }
  }

  /**
   * Send a message to target component(s)
   */
  async sendMessage(envelope: MessageEnvelope): Promise<string> {
    const startTime = Date.now();

    try {
      // Validate message
      const validation = this.validateMessage(envelope);
      if (!validation.valid) {
        throw new Error(`Message validation failed: ${validation.error}`);
      }

      // Check rate limits
      if (!this.checkRateLimit(envelope.source.componentId)) {
        throw new Error('Rate limit exceeded');
      }

      // Apply routing rules
      const routedEnvelope = this.applyRoutingRules(envelope);

      // Resolve target components
      const resolution = await this.resolveTargets(routedEnvelope);
      if (resolution.targets.length === 0) {
        throw new Error('No valid targets found for message');
      }

      // Queue or send message immediately
      if (this.config.performance.enablePrioritization) {
        this.queueMessage(routedEnvelope);
      } else {
        await this.deliverMessage(routedEnvelope, resolution.targets);
      }

      // Update metrics
      this.updateRoutingMetrics(envelope.type, Date.now() - startTime, true);

      console.log(`[MessageRouter] Message queued: ${envelope.messageId} -> ${resolution.targets.length} targets`);

      return envelope.messageId;
    } catch (error) {
      this.updateRoutingMetrics(envelope.type, Date.now() - startTime, false);
      console.error(`[MessageRouter] Failed to send message ${envelope.messageId}:`, error);
      throw error;
    }
  }

  /**
   * Subscribe to specific message types
   */
  async subscribe(subscription: MessageSubscription): Promise<string> {
    try {
      // Validate subscription
      if (!this.validateSubscription(subscription)) {
        throw new Error(`Invalid subscription: ${subscription.subscriptionId}`);
      }

      // Check if component is registered
      if (!this.components.has(subscription.componentId)) {
        throw new Error(`Component ${subscription.componentId} not registered`);
      }

      // Store subscription
      this.subscriptions.set(subscription.subscriptionId, {
        ...subscription,
        createdAt: new Date().toISOString(),
      });

      console.log(
        `[MessageRouter] Subscription created: ${subscription.subscriptionId} for ${subscription.componentId}`,
      );

      return subscription.subscriptionId;
    } catch (error) {
      console.error(`[MessageRouter] Failed to create subscription ${subscription.subscriptionId}:`, error);
      throw error;
    }
  }

  /**
   * Unsubscribe from messages
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    try {
      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) {
        console.warn(`[MessageRouter] Subscription ${subscriptionId} not found`);
        return;
      }

      this.subscriptions.delete(subscriptionId);

      console.log(`[MessageRouter] Subscription removed: ${subscriptionId}`);
    } catch (error) {
      console.error(`[MessageRouter] Failed to unsubscribe ${subscriptionId}:`, error);
      throw error;
    }
  }

  /**
   * Broadcast message to all listening components
   */
  async broadcast(message: MessageEnvelope): Promise<void> {
    try {
      // Set delivery mode to broadcast
      const broadcastMessage: MessageEnvelope = {
        ...message,
        deliveryMode: 'broadcast',
        target: {
          componentTypes: Object.keys(this.components.values()) as ComponentType[],
        },
      };

      await this.sendMessage(broadcastMessage);

      console.log(`[MessageRouter] Broadcast message sent: ${message.messageId}`);
    } catch (error) {
      console.error(`[MessageRouter] Failed to broadcast message ${message.messageId}:`, error);
      throw error;
    }
  }

  /**
   * Get component health status
   */
  async getComponentHealth(componentId: string): Promise<ComponentRegistration['health'] | undefined> {
    const component = this.components.get(componentId);
    return component?.health;
  }

  /**
   * Get routing metrics
   */
  async getMetrics(): Promise<RoutingMetrics> {
    this.updateMetricsTimestamp();
    return { ...this.metrics };
  }

  /**
   * Update routing configuration
   */
  async updateConfig(config: Partial<MessageRouterConfig>): Promise<void> {
    this.config = { ...this.config, ...config };

    // Restart processing if configuration changed
    if (config.performance && this.processingInterval) {
      this.stopMessageProcessing();
      this.startMessageProcessing();
    }

    console.log('[MessageRouter] Configuration updated');
  }

  /**
   * Flush pending messages
   */
  async flushMessages(): Promise<void> {
    const pendingCount = this.messageQueue.length;

    try {
      while (this.messageQueue.length > 0) {
        await this.processNextMessage();
      }

      console.log(`[MessageRouter] Flushed ${pendingCount} pending messages`);
    } catch (error) {
      console.error('[MessageRouter] Error flushing messages:', error);
      throw error;
    }
  }

  /**
   * Shutdown the message router
   */
  async shutdown(): Promise<void> {
    console.log('[MessageRouter] Shutting down');

    // Stop message processing
    this.stopMessageProcessing();

    // Flush remaining messages
    try {
      await this.flushMessages();
    } catch (error) {
      console.warn('[MessageRouter] Error flushing messages during shutdown:', error);
    }

    // Clear all data
    this.components.clear();
    this.subscriptions.clear();
    this.messageQueue = [];
    this.rateLimiters.clear();

    console.log('[MessageRouter] Shutdown completed');
  }

  /**
   * Validate message envelope
   */
  private validateMessage(envelope: MessageEnvelope): MessageValidationResult {
    const result: MessageValidationResult = {
      valid: true,
      warnings: [],
    };

    // Check required fields
    if (!envelope.messageId || !envelope.type || !envelope.source.componentId) {
      result.valid = false;
      result.error = 'Missing required message fields';
      return result;
    }

    // Check message size
    if (this.config.settings.enableValidation) {
      const messageSize = JSON.stringify(envelope.payload).length;
      if (messageSize > this.config.settings.maxMessageSize) {
        result.valid = false;
        result.error = `Message size exceeds limit: ${messageSize} > ${this.config.settings.maxMessageSize}`;
        return result;
      }
    }

    // Check if source component is registered
    if (!this.components.has(envelope.source.componentId)) {
      result.warnings.push(`Source component ${envelope.source.componentId} not registered`);
    }

    // Check message expiration
    if (envelope.metadata.expiresAt) {
      const expiryTime = new Date(envelope.metadata.expiresAt).getTime();
      if (Date.now() > expiryTime) {
        result.valid = false;
        result.error = 'Message has expired';
        return result;
      }
    }

    return result;
  }

  /**
   * Validate component registration
   */
  private validateComponentRegistration(registration: ComponentRegistration): boolean {
    return Boolean(registration.componentId && registration.type && registration.name && registration.capabilities);
  }

  /**
   * Validate subscription
   */
  private validateSubscription(subscription: MessageSubscription): boolean {
    return Boolean(subscription.subscriptionId && subscription.componentId && subscription.messageTypes.length > 0);
  }

  /**
   * Check rate limits for component
   */
  private checkRateLimit(componentId: string): boolean {
    const now = Date.now();
    const rateLimiter = this.rateLimiters.get(componentId);

    if (!rateLimiter || now > rateLimiter.resetTime) {
      // Reset or create rate limiter
      this.rateLimiters.set(componentId, {
        count: 1,
        resetTime: now + 60000, // 1 minute window
      });
      return true;
    }

    // Check if under rate limit (100 messages per minute default)
    if (rateLimiter.count < 100) {
      rateLimiter.count++;
      return true;
    }

    return false;
  }

  /**
   * Apply routing rules to message
   */
  private applyRoutingRules(envelope: MessageEnvelope): MessageEnvelope {
    let modifiedEnvelope = { ...envelope };

    // Sort rules by priority (higher first)
    const sortedRules = [...this.config.routingRules]
      .filter(rule => rule.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      if (this.ruleMatches(rule, modifiedEnvelope)) {
        // Apply rule actions
        if (rule.actions.transform) {
          modifiedEnvelope = rule.actions.transform(modifiedEnvelope);
        }

        if (rule.actions.deliveryMode) {
          modifiedEnvelope.deliveryMode = rule.actions.deliveryMode;
        }

        if (rule.actions.addMetadata) {
          modifiedEnvelope.metadata = {
            ...modifiedEnvelope.metadata,
            ...rule.actions.addMetadata,
          };
        }

        if (rule.actions.logRouting) {
          console.log(`[MessageRouter] Applied routing rule: ${rule.name} to message ${envelope.messageId}`);
        }
      }
    }

    return modifiedEnvelope;
  }

  /**
   * Check if routing rule matches message
   */
  private ruleMatches(rule: RoutingRule, envelope: MessageEnvelope): boolean {
    const condition = rule.condition;

    // Check message types
    if (condition.messageTypes && !condition.messageTypes.includes(envelope.type)) {
      return false;
    }

    // Check source types
    if (condition.sourceTypes && !condition.sourceTypes.includes(envelope.source.type)) {
      return false;
    }

    // Check priorities
    if (condition.priorities && !condition.priorities.includes(envelope.priority)) {
      return false;
    }

    // Check custom condition
    if (condition.customCondition && !condition.customCondition(envelope)) {
      return false;
    }

    return true;
  }

  /**
   * Resolve target components for message
   */
  private async resolveTargets(envelope: MessageEnvelope): Promise<RouteResolutionResult> {
    const result: RouteResolutionResult = {
      targets: [],
      appliedRules: [],
      reasons: [],
    };

    const allComponents = Array.from(this.components.values());

    switch (envelope.deliveryMode) {
      case 'unicast':
        if (envelope.target.componentId) {
          const component = this.components.get(envelope.target.componentId);
          if (component && this.componentCanReceive(component, envelope)) {
            result.targets.push(component);
            result.reasons.push(`Direct unicast to ${envelope.target.componentId}`);
          }
        }
        break;

      case 'multicast': {
        const targetTypes = envelope.target.componentTypes || [];
        for (const component of allComponents) {
          if (targetTypes.includes(component.type) && this.componentCanReceive(component, envelope)) {
            result.targets.push(component);
          }
        }
        result.reasons.push(`Multicast to types: ${targetTypes.join(', ')}`);
        break;
      }

      case 'broadcast':
        for (const component of allComponents) {
          if (this.componentCanReceive(component, envelope)) {
            result.targets.push(component);
          }
        }
        result.reasons.push('Broadcast to all components');
        break;

      case 'anycast': {
        const availableComponents = allComponents.filter(component => this.componentCanReceive(component, envelope));
        if (availableComponents.length > 0) {
          // Select least loaded component
          const selected = availableComponents.reduce((prev, current) =>
            prev.health.responseTime < current.health.responseTime ? prev : current,
          );
          result.targets.push(selected);
          result.reasons.push(`Anycast to least loaded: ${selected.componentId}`);
        }
        break;
      }
    }

    // Filter by subscriptions
    result.targets = result.targets.filter(component => this.hasMatchingSubscription(component.componentId, envelope));

    return result;
  }

  /**
   * Check if component can receive message
   */
  private componentCanReceive(component: ComponentRegistration, envelope: MessageEnvelope): boolean {
    // Check if component is responsive
    if (!component.health.responsive) {
      return false;
    }

    // Check capabilities
    if (!component.capabilities.supportedMessages.includes(envelope.type)) {
      return false;
    }

    // Check tab/window filters
    if (envelope.target.tabId && component.tabId !== envelope.target.tabId) {
      return false;
    }

    if (envelope.target.windowId && component.windowId !== envelope.target.windowId) {
      return false;
    }

    return true;
  }

  /**
   * Check if component has matching subscription
   */
  private hasMatchingSubscription(componentId: string, envelope: MessageEnvelope): boolean {
    const componentSubscriptions = Array.from(this.subscriptions.values()).filter(
      sub => sub.componentId === componentId,
    );

    return componentSubscriptions.some(
      sub => sub.messageTypes.includes(envelope.type) && this.subscriptionFiltersMatch(sub, envelope),
    );
  }

  /**
   * Check if subscription filters match envelope
   */
  private subscriptionFiltersMatch(subscription: MessageSubscription, envelope: MessageEnvelope): boolean {
    const filters = subscription.filters;

    // Check source filters
    if (filters.sourceFilters) {
      const sourceFilters = filters.sourceFilters;

      if (sourceFilters.includeTypes && !sourceFilters.includeTypes.includes(envelope.source.type)) {
        return false;
      }

      if (sourceFilters.excludeTypes && sourceFilters.excludeTypes.includes(envelope.source.type)) {
        return false;
      }

      if (sourceFilters.componentIds && !sourceFilters.componentIds.includes(envelope.source.componentId)) {
        return false;
      }
    }

    // Check priority filter
    if (filters.priorityFilter) {
      const priorities: MessagePriority[] = ['bulk', 'low', 'normal', 'urgent', 'critical'];
      const minPriorityIndex = priorities.indexOf(filters.priorityFilter.minimumPriority);
      const messagePriorityIndex = priorities.indexOf(envelope.priority);

      if (messagePriorityIndex < minPriorityIndex) {
        return false;
      }
    }

    // Check content filters
    if (filters.contentFilters) {
      const contentFilters = filters.contentFilters;

      if (contentFilters.requiredTags) {
        const hasAllTags = contentFilters.requiredTags.every(tag => envelope.metadata.tags.includes(tag));
        if (!hasAllTags) return false;
      }

      if (contentFilters.excludedTags) {
        const hasExcludedTag = contentFilters.excludedTags.some(tag => envelope.metadata.tags.includes(tag));
        if (hasExcludedTag) return false;
      }
    }

    return true;
  }

  /**
   * Queue message for processing
   */
  private queueMessage(envelope: MessageEnvelope): void {
    // Insert message in priority order
    const priorityOrder: MessagePriority[] = ['critical', 'urgent', 'normal', 'low', 'bulk'];
    const insertIndex = this.messageQueue.findIndex(
      msg => priorityOrder.indexOf(msg.priority) > priorityOrder.indexOf(envelope.priority),
    );

    if (insertIndex === -1) {
      this.messageQueue.push(envelope);
    } else {
      this.messageQueue.splice(insertIndex, 0, envelope);
    }

    // Enforce queue size limit
    if (this.messageQueue.length > this.config.performance.queueSizeLimit) {
      const removed = this.messageQueue.splice(0, this.messageQueue.length - this.config.performance.queueSizeLimit);
      console.warn(`[MessageRouter] Queue overflow, dropped ${removed.length} messages`);
    }
  }

  /**
   * Deliver message to target components
   */
  private async deliverMessage(envelope: MessageEnvelope, targets: ComponentRegistration[]): Promise<void> {
    const deliveryPromises = targets.map(async target => {
      try {
        // Update last activity
        target.lastActivity = new Date().toISOString();

        // Simulate message delivery to component
        // In a real implementation, this would use Chrome extension messaging APIs
        console.log(`[MessageRouter] Delivering message ${envelope.messageId} to ${target.componentId}`);

        // Update delivery confirmations
        envelope.delivery.confirmations.push({
          componentId: target.componentId,
          timestamp: new Date().toISOString(),
          success: true,
        });
      } catch (error) {
        console.error(`[MessageRouter] Failed to deliver message to ${target.componentId}:`, error);

        envelope.delivery.confirmations.push({
          componentId: target.componentId,
          timestamp: new Date().toISOString(),
          success: false,
        });
      }
    });

    await Promise.allSettled(deliveryPromises);
  }

  /**
   * Start message processing
   */
  private startMessageProcessing(): void {
    if (this.processingInterval) return;

    this.processingInterval = setInterval(async () => {
      await this.processMessageBatch();
    }, this.config.performance.processingInterval);

    console.log('[MessageRouter] Message processing started');
  }

  /**
   * Stop message processing
   */
  private stopMessageProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      console.log('[MessageRouter] Message processing stopped');
    }
  }

  /**
   * Process a batch of messages
   */
  private async processMessageBatch(): Promise<void> {
    const batchSize = Math.min(this.config.performance.batchSize, this.messageQueue.length);
    if (batchSize === 0) return;

    const batch = this.messageQueue.splice(0, batchSize);

    const processPromises = batch.map(_envelope => this.processNextMessage());
    await Promise.allSettled(processPromises);
  }

  /**
   * Process next message from queue
   */
  private async processNextMessage(): Promise<void> {
    const envelope = this.messageQueue.shift();
    if (!envelope) return;

    try {
      // Check if message has expired
      if (envelope.metadata.expiresAt && Date.now() > new Date(envelope.metadata.expiresAt).getTime()) {
        console.warn(`[MessageRouter] Message ${envelope.messageId} expired, dropping`);
        return;
      }

      // Resolve targets and deliver
      const resolution = await this.resolveTargets(envelope);
      if (resolution.targets.length > 0) {
        await this.deliverMessage(envelope, resolution.targets);
        this.metrics.delivery.successful++;
      } else {
        console.warn(`[MessageRouter] No targets found for message ${envelope.messageId}`);
        this.metrics.delivery.failed++;
      }
    } catch (error) {
      console.error(`[MessageRouter] Error processing message ${envelope.messageId}:`, error);
      this.metrics.delivery.failed++;
    }
  }

  /**
   * Update routing metrics
   */
  private updateRoutingMetrics(messageType: MessageType, duration: number, success: boolean): void {
    this.metrics.totalMessages++;
    this.metrics.messagesByType[messageType] = (this.metrics.messagesByType[messageType] || 0) + 1;

    if (success) {
      this.metrics.performance.messagesPerSecond = this.calculateMessagesPerSecond();

      // Update average routing time
      const totalSuccessful = this.metrics.delivery.successful + 1;
      this.metrics.performance.avgRoutingTime =
        (this.metrics.performance.avgRoutingTime * (totalSuccessful - 1) + duration) / totalSuccessful;
    } else {
      this.metrics.errors.routingErrors++;
    }
  }

  /**
   * Update component metrics
   */
  private updateComponentMetrics(): void {
    this.metrics.components.registered = this.components.size;
    this.metrics.components.active = Array.from(this.components.values()).filter(comp => comp.health.responsive).length;
    this.metrics.components.responsive = this.metrics.components.active;
    this.metrics.components.withErrors = Array.from(this.components.values()).filter(
      comp => comp.health.errorCount > 0,
    ).length;
  }

  /**
   * Calculate messages per second
   */
  private calculateMessagesPerSecond(): number {
    // Simple calculation - in reality you'd track messages over time windows
    return Math.round(this.metrics.totalMessages / Math.max(1, (Date.now() - this.getStartTime()) / 1000));
  }

  /**
   * Get router start time (placeholder)
   */
  private getStartTime(): number {
    // In a real implementation, you'd track the actual start time
    return Date.now() - 3600000; // 1 hour ago as placeholder
  }

  /**
   * Update metrics timestamp
   */
  private updateMetricsTimestamp(): void {
    this.metrics.lastUpdated = new Date().toISOString();
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): RoutingMetrics {
    return {
      totalMessages: 0,
      messagesByType: {
        detection_event: 0,
        job_status: 0,
        job_progress: 0,
        config_change: 0,
        storage_sync: 0,
        error_report: 0,
        health_check: 0,
        broadcast: 0,
        request_response: 0,
        subscription: 0,
        notification: 0,
      },
      messagesByPriority: {
        critical: 0,
        urgent: 0,
        normal: 0,
        low: 0,
        bulk: 0,
      },
      messagesByDeliveryMode: {
        unicast: 0,
        multicast: 0,
        broadcast: 0,
        anycast: 0,
      },
      performance: {
        avgRoutingTime: 0,
        p95RoutingTime: 0,
        messagesPerSecond: 0,
      },
      delivery: {
        successful: 0,
        failed: 0,
        pending: 0,
        avgDeliveryTime: 0,
      },
      errors: {
        routingErrors: 0,
        deliveryErrors: 0,
        timeoutErrors: 0,
        validationErrors: 0,
      },
      components: {
        active: 0,
        registered: 0,
        responsive: 0,
        withErrors: 0,
      },
      lastUpdated: new Date().toISOString(),
    };
  }
}
