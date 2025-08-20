/**
 * Message router for cross-component communication
 * Implements MessageRouter with component registration, routing, and conflict prevention
 */

// import { analysisOrchestrator } from '@extension/meeting-detector';
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
import type { AudioUrlInfo } from '@extension/meeting-detector';

// Import meeting detection capabilities

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
  }

  /**
   * Flush pending messages
   */
  async flushMessages(): Promise<void> {
    const _pendingCount = this.messageQueue.length;

    try {
      while (this.messageQueue.length > 0) {
        await this.processNextMessage();
      }
    } catch (error) {
      console.error('[MessageRouter] Error flushing messages:', error);
      throw error;
    }
  }

  /**
   * Shutdown the message router
   */
  async shutdown(): Promise<void> {
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
   * Select best quality audio URL from detected URLs
   */
  private selectBestAudioUrl(audioUrls: AudioUrlInfo[]): string {
    if (!audioUrls || audioUrls.length === 0) {
      throw new Error('No audio URLs provided');
    }

    // Priority order: MP4 > WAV > MP3, with quality preference
    const formatPriority = ['mp4', 'wav', 'mp3'];

    for (const format of formatPriority) {
      const urlsOfFormat = audioUrls.filter(
        url => url.format?.toLowerCase() === format || url.url.toLowerCase().includes(`.${format}`),
      );

      if (urlsOfFormat.length > 0) {
        // Sort by quality indicators: size, resolution, bitrate
        const sortedUrls = urlsOfFormat.sort((a, b) => {
          // Prefer larger files (usually higher quality)
          if (a.size && b.size) {
            return b.size - a.size;
          }

          // Prefer URLs with quality indicators in filename
          const aQuality = this.extractQualityScore(a.url);
          const bQuality = this.extractQualityScore(b.url);

          return bQuality - aQuality;
        });

        return sortedUrls[0].url;
      }
    }

    // Fallback to first available URL if no format matches
    return audioUrls[0].url;
  }

  /**
   * Extract quality score from URL for sorting
   */
  private extractQualityScore(url: string): number {
    let score = 0;

    // Check for quality indicators in URL
    if (url.includes('1080p') || url.includes('hd')) score += 100;
    else if (url.includes('720p')) score += 80;
    else if (url.includes('480p')) score += 60;
    else if (url.includes('360p')) score += 40;

    // Check for bitrate indicators
    if (url.includes('high')) score += 50;
    else if (url.includes('medium')) score += 30;
    else if (url.includes('low')) score += 10;

    return score;
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
          // Log routing action implementation would go here
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
  }

  /**
   * Stop message processing
   */
  private stopMessageProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
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

  /**
   * Set background main reference for accessing other services
   */
  setBackgroundMain(backgroundMain: unknown): void {
    this.backgroundMain = backgroundMain;
  }

  private backgroundMain: unknown;

  /**
   * Route message from chrome runtime
   */
  async routeMessage(message: unknown, _sender: chrome.runtime.MessageSender): Promise<unknown> {
    try {
      // Basic message validation
      if (!message || typeof message !== 'object') {
        throw new Error('Invalid message format');
      }

      const msg = message as Record<string, unknown>;

      // Handle different message types
      switch (msg.type) {
        case 'GET_STATUS':
          return {
            status: 'connected',
            timestamp: new Date().toISOString(),
            services: {
              messageRouter: true,
              backgroundMain: !!this.backgroundMain,
              jobCoordinator: !!this.backgroundMain?.getSubsystem('jobCoordinator'),
            },
          };

        case 'START_AUDIO_CAPTURE':
          return await this.handleStartAudioCapture(msg);

        case 'STOP_AUDIO_CAPTURE':
          return await this.handleStopAudioCapture(msg);

        case 'GET_ACTIVE_JOBS':
          return await this.handleGetActiveJobs();

        case 'GET_RECENT_MEETINGS':
          return await this.handleGetRecentMeetings();

        case 'health.check':
          return {
            success: true,
            data: {
              status: 'healthy',
              timestamp: new Date().toISOString(),
              services: {
                messageRouter: true,
                backgroundMain: !!this.backgroundMain,
                jobCoordinator: !!this.backgroundMain?.getSubsystem('jobCoordinator'),
              },
            },
            metadata: {
              correlationId: msg.metadata?.correlationId,
              source: 'background-service',
            },
          };

        default:
          console.warn('[MessageRouter] Unknown message type:', msg.type);
          return {
            error: 'Unknown message type',
            type: msg.type,
          };
      }
    } catch (error) {
      console.error('[MessageRouter] Error routing message:', error);
      return {
        error: 'Message routing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle start audio capture request
   */
  private async handleStartAudioCapture(msg: { audioUrl?: string; source?: string }): Promise<unknown> {
    try {
      if (!this.backgroundMain) {
        console.error('[MessageRouter] Background service not available');
        throw new Error('Background service not available');
      }

      const jobCoordinator = this.backgroundMain.getSubsystem('jobCoordinator');
      const jobQueueManager = this.backgroundMain.getSubsystem('jobQueueManager');
      const jobTracker = this.backgroundMain.getSubsystem('jobTracker');

      if (!jobCoordinator || !jobQueueManager || !jobTracker) {
        console.error('[MessageRouter] Job services not available', {
          jobCoordinator: !!jobCoordinator,
          jobQueueManager: !!jobQueueManager,
          jobTracker: !!jobTracker,
        });
        throw new Error('Job services not available');
      }

      // Step 1: Detect content using meeting-detector with detailed progress tracking
      let audioUrl: string;
      let meetingMetadata: Record<string, unknown> = {};

      try {
        // Phase 1: Initialize content detection

        // Get active tab for content detection
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs.length || !tabs[0].id) {
          throw new Error('No active tab found for content detection');
        }

        const activeTab = tabs[0];

        // Phase 2: Execute content detection in the active tab
        let detectionResults: {
          success: boolean;
          error?: string;
          audioUrls?: AudioUrlInfo[];
          metadata?: Record<string, unknown>;
        };

        try {
          // First attempt: Try to communicate with declaratively injected content script
          detectionResults = await chrome.tabs.sendMessage(activeTab.id, {
            type: 'DETECT_MEETING_CONTENT',
            tabId: activeTab.id,
            url: activeTab.url,
          });
        } catch (sendMessageError) {
          console.warn(
            '[MessageRouter] Declarative content script not responding, attempting programmatic injection:',
            sendMessageError,
          );

          // Phase 2B: Fallback to programmatic content script injection
          try {
            // Inject diagnostic content script programmatically
            await chrome.scripting.executeScript({
              target: { tabId: activeTab.id },
              files: ['content/all.iife.js'],
            });

            console.log('[MessageRouter] Programmatic content script injection completed');

            // Wait a moment for script to initialize
            await new Promise(resolve => setTimeout(resolve, 500));

            // Retry communication
            detectionResults = await chrome.tabs.sendMessage(activeTab.id, {
              type: 'DETECT_MEETING_CONTENT',
              tabId: activeTab.id,
              url: activeTab.url,
            });

            console.log('[MessageRouter] Content detection successful after programmatic injection');
          } catch (injectionError) {
            console.error('[MessageRouter] Programmatic injection also failed:', injectionError);
            throw new Error(
              `Content script injection failed: ${injectionError instanceof Error ? injectionError.message : 'Unknown injection error'}`,
            );
          }
        }

        if (!detectionResults || !detectionResults.success) {
          throw new Error(detectionResults?.error || 'Content detection failed');
        }

        // Phase 3: Validate detection results
        if (!detectionResults.audioUrls || detectionResults.audioUrls.length === 0) {
          throw new Error('No meeting recordings found on current page');
        }

        // Phase 4: Select best quality URL
        audioUrl = this.selectBestAudioUrl(detectionResults.audioUrls);
        meetingMetadata = detectionResults.metadata || {};
      } catch (detectionError) {
        console.error('[MessageRouter] Content detection failed:', detectionError);

        const errorMessage = detectionError instanceof Error ? detectionError.message : 'Unknown error';

        // Provide specific error handling based on error type
        if (errorMessage.includes('No active tab found')) {
          throw {
            type: 'content_detection',
            error: 'No active tab available for content detection',
            recovery: [
              'Make sure you have a SharePoint or Teams tab open and active',
              'Navigate to a meeting page with recordings',
              'Try refreshing the page and attempting again',
            ],
            userMessage: 'Please open a SharePoint page with meeting recordings and try again',
          };
        }

        if (errorMessage.includes('No meeting recordings found')) {
          throw {
            type: 'content_detection',
            error: 'No meeting recordings detected on current page',
            recovery: [
              'Ensure you are on a SharePoint page with meeting recordings',
              'Check that the meeting has recorded content available',
              'Verify you have permission to access the meeting recordings',
              'Try navigating to a different meeting page',
            ],
            userMessage: 'No meeting recordings found. Please navigate to a SharePoint page with recorded meetings.',
          };
        }

        if (errorMessage.includes('Content detection failed')) {
          throw {
            type: 'content_detection',
            error: 'Failed to analyze page content for meeting recordings',
            recovery: [
              'Check that you have permission to access the meeting content',
              'Ensure the page has fully loaded before attempting transcription',
              'Try refreshing the page and waiting for content to load',
              'Verify the page contains Teams meeting recordings',
            ],
            userMessage:
              'Unable to detect meeting content. Please ensure you have access to the recordings and try again.',
          };
        }

        if (errorMessage.includes('permission') || errorMessage.includes('access')) {
          throw {
            type: 'content_detection',
            error: 'Insufficient permissions to access meeting recordings',
            recovery: [
              'Contact your IT administrator to verify SharePoint permissions',
              'Ensure you are logged into SharePoint with the correct account',
              'Check that the meeting organizer has shared recordings with you',
              'Try accessing the meeting through Teams directly',
            ],
            userMessage:
              'You do not have permission to access these meeting recordings. Please contact your administrator.',
          };
        }

        // Fallback to provided URL or throw detailed error
        if (msg.audioUrl && msg.audioUrl !== 'system://audio-capture') {
          audioUrl = msg.audioUrl;
          meetingMetadata = {
            title: 'Manual Audio Input',
            audioSource: 'manual_url',
            detectionFallback: true,
          };
        } else {
          throw {
            type: 'content_detection',
            error: `Content detection failed: ${errorMessage}`,
            recovery: [
              'Navigate to a SharePoint page with Teams meeting recordings',
              'Ensure you have access permissions to the meeting content',
              'Check your internet connection and SharePoint accessibility',
              'Try refreshing the page and attempting transcription again',
              'Contact support if the issue persists',
            ],
            userMessage:
              'Unable to detect meeting content. Please navigate to a SharePoint page with accessible meeting recordings.',
          };
        }
      }

      // Create a transcription job with real URL
      const jobId = `transcription_${Date.now()}`;
      const job = {
        jobId,
        audioUrl, // Real SharePoint URL from content detection
        priority: 'normal' as const,
        config: {
          language: meetingMetadata.language || 'en-US',
          enableSpeakerDiarization: true,
          enableProfanityFilter: false,
          outputFormat: 'detailed',
        },
        executionContext: {
          priority: 'normal' as const,
          timeout: 300000, // 5 minutes
          status: 'queued' as const,
          startTime: new Date().toISOString(),
          metadata: {
            source: msg.source || 'popup',
            sessionId: `session_${Date.now()}`,
            audioSource: 'sharepoint_recording',
            meetingTitle: meetingMetadata.title,
            meetingDate: meetingMetadata.date,
            participants: meetingMetadata.participants,
            detectionConfidence: meetingMetadata.confidence,
          },
        },
      };

      // Submit job through JobCoordinator for proper lifecycle management
      console.log('[MessageRouter] 🚀 Submitting job through JobCoordinator:', jobId);
      const coordinator = this.backgroundMain.getSubsystem('jobCoordinator');

      if (!coordinator) {
        throw new Error('JobCoordinator not available');
      }

      const submittedJobId = await coordinator.submitJob(job);
      console.log('[MessageRouter] ✅ Job successfully submitted via JobCoordinator:', submittedJobId);

      return {
        success: true,
        message: 'Transcription job started with real meeting recording',
        job: {
          id: jobId,
          title: meetingMetadata.title || 'Meeting Transcription',
          status: 'queued',
          startTime: new Date().toISOString(),
          source: 'sharepoint_recording',
          audioUrl: audioUrl,
          metadata: meetingMetadata,
        },
      };
    } catch (error) {
      console.error('[MessageRouter] Failed to start audio capture:', error);

      // Handle structured error objects from content detection
      if (error && typeof error === 'object' && 'type' in error) {
        const structuredError = error as Record<string, unknown>;
        return {
          success: false,
          error: structuredError.error || 'Content detection failed',
          errorType: structuredError.type || 'unknown',
          message: structuredError.userMessage || 'Failed to start transcription',
          recovery: structuredError.recovery || [],
          details: structuredError,
        };
      }

      // Handle regular Error objects
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: 'system',
        message: 'Failed to start transcription',
        recovery: [
          'Check your internet connection',
          'Ensure you are on a valid SharePoint or Teams page',
          'Try refreshing the page and attempting again',
          'Contact support if the issue persists',
        ],
      };
    }
  }

  /**
   * Handle stop audio capture request
   */
  private async handleStopAudioCapture(msg: { jobId?: string }): Promise<unknown> {
    try {
      if (!this.backgroundMain) {
        throw new Error('Background service not available');
      }

      const jobCoordinator = this.backgroundMain.getSubsystem('jobCoordinator');
      if (jobCoordinator && msg.jobId) {
        // Try to cancel the job
        // Note: This would need to be implemented in JobCoordinator
      }

      return {
        success: true,
        message: 'Audio capture stop requested',
      };
    } catch (error) {
      console.error('[MessageRouter] Failed to stop audio capture:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle get active jobs request
   */
  private async handleGetActiveJobs(): Promise<unknown> {
    try {
      if (!this.backgroundMain) {
        console.warn('[MessageRouter] No backgroundMain available for GET_ACTIVE_JOBS');
        return { jobs: [] };
      }

      const jobTracker = this.backgroundMain.getSubsystem('jobTracker');
      if (jobTracker) {
        // Get jobs that are not completed or failed
        const allJobs = jobTracker.getAllJobs();

        const activeJobs = allJobs.filter(
          (job: Record<string, unknown>) =>
            job.executionContext?.status === 'processing' ||
            job.executionContext?.status === 'queued' ||
            job.executionContext?.status === 'paused',
        );

        // Convert to popup-friendly format
        const formattedJobs = activeJobs.map((job: Record<string, unknown>) => {
          const progress = jobTracker.getJobProgress(job.jobId);
          const formatted = {
            id: job.jobId,
            title: `Transcription - ${job.executionContext.metadata?.audioSource || 'Unknown'}`,
            status: job.executionContext.status,
            progress: progress?.progressPercentage || 0,
            stage: progress?.currentStage || 'initializing',
            startTime: job.executionContext.startTime,
            estimatedCompletion: progress?.estimatedCompletion,
            error: job.executionContext.lastError?.message,
          };
          return formatted;
        });

        const response = { jobs: formattedJobs };
        return response;
      } else {
        console.warn('[MessageRouter] JobTracker subsystem not available');
        return { jobs: [] };
      }
    } catch (error) {
      console.error('[MessageRouter] Failed to get active jobs:', error);
      return { jobs: [] };
    }
  }

  /**
   * Handle get recent meetings request
   */
  private async handleGetRecentMeetings(): Promise<unknown> {
    try {
      // This would connect to storage to get recent meetings
      // For now, return empty array
      return { meetings: [] };
    } catch (error) {
      console.error('[MessageRouter] Failed to get recent meetings:', error);
      return { meetings: [] };
    }
  }
}
