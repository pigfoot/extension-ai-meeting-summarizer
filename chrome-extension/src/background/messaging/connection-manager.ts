/**
 * Component connection manager for Chrome Extension messaging
 * Handles component lifecycle, heartbeat monitoring, and connection state management
 */

import type { ComponentRegistration, ComponentType, Connection, MessageEnvelope } from '../types';

/**
 * Connection state types
 */
export type ConnectionState = 'connecting' | 'connected' | 'disconnecting' | 'disconnected' | 'error' | 'timeout';

/**
 * Connection event types
 */
export type ConnectionEventType =
  | 'connected'
  | 'disconnected'
  | 'heartbeat'
  | 'error'
  | 'timeout'
  | 'message_received'
  | 'message_sent';

/**
 * Connection event data
 */
export interface ConnectionEvent {
  /** Event type */
  type: ConnectionEventType;
  /** Component ID */
  componentId: string;
  /** Component type */
  componentType: ComponentType;
  /** Event timestamp */
  timestamp: string;
  /** Event data */
  data?: Record<string, unknown>;
  /** Error information if applicable */
  error?: string;
}

/**
 * Connection health metrics
 */
export interface ConnectionHealth {
  /** Connection state */
  state: ConnectionState;
  /** Last successful heartbeat */
  lastHeartbeat: string;
  /** Response time in milliseconds */
  responseTime: number;
  /** Error count in current session */
  errorCount: number;
  /** Messages sent count */
  messagesSent: number;
  /** Messages received count */
  messagesReceived: number;
  /** Connection uptime in milliseconds */
  uptime: number;
  /** Quality score (0-100) */
  qualityScore: number;
}

/**
 * Connection configuration
 */
export interface ConnectionConfig {
  /** Heartbeat interval in milliseconds */
  heartbeatInterval: number;
  /** Connection timeout in milliseconds */
  connectionTimeout: number;
  /** Maximum retry attempts */
  maxRetryAttempts: number;
  /** Retry delay in milliseconds */
  retryDelay: number;
  /** Enable automatic reconnection */
  autoReconnect: boolean;
  /** Health check configuration */
  healthCheck: {
    /** Enable health monitoring */
    enabled: boolean;
    /** Health check interval in milliseconds */
    interval: number;
    /** Minimum quality score threshold */
    qualityThreshold: number;
  };
}

/**
 * Connection statistics
 */
export interface ConnectionStats {
  /** Total connections established */
  totalConnections: number;
  /** Active connections count */
  activeConnections: number;
  /** Connections by component type */
  connectionsByType: Record<ComponentType, number>;
  /** Total messages exchanged */
  totalMessages: number;
  /** Messages sent */
  messagesSent: number;
  /** Messages received */
  messagesReceived: number;
  /** Average response time */
  averageResponseTime: number;
  /** Connection errors */
  connectionErrors: number;
  /** Last connection timestamp */
  lastConnection?: string;
}

/**
 * Component connection manager
 */
export class ConnectionManager {
  private config: ConnectionConfig;
  private connections = new Map<string, Connection>();
  private connectionHealth = new Map<string, ConnectionHealth>();
  private heartbeatIntervals = new Map<string, NodeJS.Timeout>();
  private eventHandlers = new Map<ConnectionEventType, Set<(event: ConnectionEvent) => void>>();
  private stats: ConnectionStats;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(config: ConnectionConfig) {
    this.config = config;
    this.stats = this.initializeStats();

    if (this.config.healthCheck.enabled) {
      this.startHealthChecking();
    }
  }

  /**
   * Establish connection with a component
   */
  async connect(registration: ComponentRegistration): Promise<Connection> {
    const componentId = registration.componentId;

    try {
      // Check if already connected
      const existingConnection = this.connections.get(componentId);
      if (existingConnection && existingConnection.state === 'connected') {
        console.warn(`[ConnectionManager] Component ${componentId} already connected`);
        return existingConnection;
      }

      // Create new connection
      const connection = this.createConnection(registration);
      this.connections.set(componentId, connection);

      // Initialize health tracking
      this.initializeConnectionHealth(componentId, registration.type);

      // Start connection process
      await this.performConnection(connection);

      // Start heartbeat monitoring
      this.startHeartbeat(componentId);

      // Emit connection event
      this.emitConnectionEvent({
        type: 'connected',
        componentId,
        componentType: registration.type,
        timestamp: new Date().toISOString(),
        data: {
          connectionId: connection.id,
          port: connection.port,
        },
      });

      // Update statistics
      this.updateConnectionStats('connected', registration.type);

      return connection;
    } catch (error) {
      console.error(`[ConnectionManager] Failed to connect to ${componentId}:`, error);

      // Emit error event
      this.emitConnectionEvent({
        type: 'error',
        componentId,
        componentType: registration.type,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Disconnect from a component
   */
  async disconnect(componentId: string): Promise<void> {
    const connection = this.connections.get(componentId);
    if (!connection) {
      console.warn(`[ConnectionManager] Component ${componentId} not connected`);
      return;
    }

    try {
      // Update connection state
      connection.state = 'disconnecting';

      // Stop heartbeat
      this.stopHeartbeat(componentId);

      // Close Chrome extension port
      if (connection.port) {
        connection.port.disconnect();
      }

      // Update connection state
      connection.state = 'disconnected';
      connection.disconnectedAt = new Date().toISOString();

      // Emit disconnect event
      this.emitConnectionEvent({
        type: 'disconnected',
        componentId,
        componentType: connection.componentType,
        timestamp: new Date().toISOString(),
        data: {
          duration: connection.disconnectedAt
            ? new Date(connection.disconnectedAt).getTime() - new Date(connection.connectedAt || 0).getTime()
            : 0,
        },
      });

      // Clean up
      this.connections.delete(componentId);
      this.connectionHealth.delete(componentId);

      // Update statistics
      this.updateConnectionStats('disconnected', connection.componentType);
    } catch (error) {
      console.error(`[ConnectionManager] Error disconnecting from ${componentId}:`, error);
      throw error;
    }
  }

  /**
   * Send message to a connected component
   */
  async sendMessage(componentId: string, envelope: MessageEnvelope): Promise<boolean> {
    const connection = this.connections.get(componentId);
    if (!connection || connection.state !== 'connected') {
      console.warn(`[ConnectionManager] Component ${componentId} not connected`);
      return false;
    }

    try {
      const startTime = Date.now();

      // Send message through Chrome extension port
      if (connection.port) {
        connection.port.postMessage(envelope);
      } else {
        // Fallback to chrome.runtime.sendMessage for content scripts
        await chrome.tabs.sendMessage(connection.tabId || 0, envelope);
      }

      // Update connection health
      const health = this.connectionHealth.get(componentId);
      if (health) {
        health.messagesSent++;
        health.responseTime = Date.now() - startTime;
        this.updateQualityScore(componentId);
      }

      // Emit message sent event
      this.emitConnectionEvent({
        type: 'message_sent',
        componentId,
        componentType: connection.componentType,
        timestamp: new Date().toISOString(),
        data: {
          messageId: envelope.messageId,
          messageType: envelope.type,
          size: JSON.stringify(envelope).length,
        },
      });

      // Update statistics
      this.stats.messagesSent++;
      this.stats.totalMessages++;

      return true;
    } catch (error) {
      console.error(`[ConnectionManager] Failed to send message to ${componentId}:`, error);

      // Update error count
      const health = this.connectionHealth.get(componentId);
      if (health) {
        health.errorCount++;
        this.updateQualityScore(componentId);
      }

      return false;
    }
  }

  /**
   * Handle incoming message from a component
   */
  handleIncomingMessage(componentId: string, envelope: MessageEnvelope): void {
    const connection = this.connections.get(componentId);
    if (!connection) {
      console.warn(`[ConnectionManager] Received message from unconnected component: ${componentId}`);
      return;
    }

    try {
      // Update connection health
      const health = this.connectionHealth.get(componentId);
      if (health) {
        health.messagesReceived++;
        health.lastHeartbeat = new Date().toISOString();
        this.updateQualityScore(componentId);
      }

      // Update last activity
      connection.lastActivity = new Date().toISOString();

      // Handle specific message types
      if (envelope.type === 'health.check') {
        // Respond to health check immediately
        const response = {
          success: true,
          data: {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            connectionId: connection.id,
            componentId,
          },
          metadata: {
            correlationId: envelope.metadata?.correlationId,
            source: 'background-service',
          },
        };

        if (connection.port) {
          connection.port.postMessage(response);
        }
      }

      // Emit message received event
      this.emitConnectionEvent({
        type: 'message_received',
        componentId,
        componentType: connection.componentType,
        timestamp: new Date().toISOString(),
        data: {
          messageId: envelope.messageId,
          messageType: envelope.type,
          size: JSON.stringify(envelope).length,
        },
      });

      // Update statistics
      this.stats.messagesReceived++;
      this.stats.totalMessages++;
    } catch (error) {
      console.error(`[ConnectionManager] Error handling incoming message from ${componentId}:`, error);
    }
  }

  /**
   * Handle incoming port connection from chrome.runtime.onConnect
   */
  handleConnection(port: chrome.runtime.Port): void {
    try {
      // Extract component info from port name
      const componentId = port.name || `unknown-${Date.now()}`;
      const componentType: ComponentType = port.name === 'content-script' ? 'content_script' : 'popup';

      console.log(`[ConnectionManager] Handling new connection: ${componentId} (${componentType})`);

      // Create connection object
      const connection: Connection = {
        id: `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        componentId,
        componentType,
        state: 'connected',
        port,
        tabId: port.sender?.tab?.id,
        windowId: port.sender?.tab?.windowId,
        frameId: port.sender?.frameId,
        connectedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        messageCount: 0,
        metadata: {
          userAgent: 'unknown',
        },
      };

      // Store connection
      this.connections.set(componentId, connection);

      // Initialize health tracking
      this.initializeConnectionHealth(componentId, componentType);

      // Set up port event listeners
      port.onMessage.addListener(message => {
        this.handleIncomingMessage(componentId, message);
      });

      port.onDisconnect.addListener(() => {
        console.log(`[ConnectionManager] Port disconnected: ${componentId}`);
        connection.state = 'disconnected';
        connection.disconnectedAt = new Date().toISOString();

        // Clean up
        this.stopHeartbeat(componentId);
        this.connections.delete(componentId);
        this.connectionHealth.delete(componentId);

        // Emit disconnect event
        this.emitConnectionEvent({
          type: 'disconnected',
          componentId,
          componentType,
          timestamp: new Date().toISOString(),
        });
      });

      // Start heartbeat monitoring
      this.startHeartbeat(componentId);

      // Emit connection event
      this.emitConnectionEvent({
        type: 'connected',
        componentId,
        componentType,
        timestamp: new Date().toISOString(),
        data: {
          connectionId: connection.id,
        },
      });

      // Update statistics
      this.updateConnectionStats('connected', componentType);

      console.log(`[ConnectionManager] Successfully handled connection: ${componentId}`);
    } catch (error) {
      console.error('[ConnectionManager] Error handling connection:', error);
    }
  }

  /**
   * Get connection by component ID
   */
  getConnection(componentId: string): Connection | undefined {
    return this.connections.get(componentId);
  }

  /**
   * Get all active connections
   */
  getActiveConnections(): Connection[] {
    return Array.from(this.connections.values()).filter(conn => conn.state === 'connected');
  }

  /**
   * Get connections by component type
   */
  getConnectionsByType(componentType: ComponentType): Connection[] {
    return Array.from(this.connections.values()).filter(conn => conn.componentType === componentType);
  }

  /**
   * Get connection health
   */
  getConnectionHealth(componentId: string): ConnectionHealth | undefined {
    return this.connectionHealth.get(componentId);
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): ConnectionStats {
    this.updateActiveConnectionsCount();
    return { ...this.stats };
  }

  /**
   * Register connection event handler
   */
  onConnectionEvent(eventType: ConnectionEventType, handler: (event: ConnectionEvent) => void): void {
    const handlers = this.eventHandlers.get(eventType) || new Set();
    handlers.add(handler);
    this.eventHandlers.set(eventType, handlers);
  }

  /**
   * Remove connection event handler
   */
  removeConnectionEventHandler(eventType: ConnectionEventType, handler: (event: ConnectionEvent) => void): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Update connection configuration
   */
  updateConfig(config: Partial<ConnectionConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart health checking if configuration changed
    if (config.healthCheck) {
      this.stopHealthChecking();
      if (this.config.healthCheck.enabled) {
        this.startHealthChecking();
      }
    }
  }

  /**
   * Shutdown connection manager
   */
  async shutdown(): Promise<void> {
    // Stop health checking
    this.stopHealthChecking();

    // Disconnect all components
    const componentIds = Array.from(this.connections.keys());
    for (const componentId of componentIds) {
      try {
        await this.disconnect(componentId);
      } catch (error) {
        console.warn(`[ConnectionManager] Error disconnecting ${componentId} during shutdown:`, error);
      }
    }

    // Clear all data
    this.connections.clear();
    this.connectionHealth.clear();
    this.eventHandlers.clear();

    // Stop all heartbeat intervals
    for (const interval of this.heartbeatIntervals.values()) {
      clearInterval(interval);
    }
    this.heartbeatIntervals.clear();
  }

  /**
   * Create connection object
   */
  private createConnection(registration: ComponentRegistration): Connection {
    return {
      id: `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      componentId: registration.componentId,
      componentType: registration.type,
      state: 'connecting',
      port: null, // Will be set during connection
      tabId: registration.tabId,
      windowId: registration.windowId,
      frameId: registration.frameId,
      connectedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      messageCount: 0,
      metadata: {
        userAgent: navigator.userAgent,
        capabilities: registration.capabilities,
      },
    };
  }

  /**
   * Perform actual connection
   */
  private async performConnection(connection: Connection): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, this.config.connectionTimeout);

      try {
        // For content scripts, establish connection via tabs
        if (connection.componentType === 'content_script' && connection.tabId) {
          // Connect to content script via chrome.tabs.connect
          const port = chrome.tabs.connect(connection.tabId, {
            name: `meeting-summarizer-${connection.componentId}`,
            frameId: connection.frameId,
          });

          port.onConnect.addListener(() => {
            clearTimeout(timeout);
            connection.state = 'connected';
            connection.port = port;
            connection.connectedAt = new Date().toISOString();
            resolve();
          });

          port.onDisconnect.addListener(() => {
            connection.state = 'disconnected';
            connection.disconnectedAt = new Date().toISOString();
          });

          port.onMessage.addListener(message => {
            this.handleIncomingMessage(connection.componentId, message);
          });
        } else {
          // For extension pages, they will connect to us
          // We'll mark as connected immediately for now
          clearTimeout(timeout);
          connection.state = 'connected';
          connection.connectedAt = new Date().toISOString();
          resolve();
        }
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * Initialize connection health tracking
   */
  private initializeConnectionHealth(componentId: string, _componentType: ComponentType): void {
    const health: ConnectionHealth = {
      state: 'connecting',
      lastHeartbeat: new Date().toISOString(),
      responseTime: 0,
      errorCount: 0,
      messagesSent: 0,
      messagesReceived: 0,
      uptime: 0,
      qualityScore: 100,
    };

    this.connectionHealth.set(componentId, health);
  }

  /**
   * Start heartbeat monitoring for a component
   */
  private startHeartbeat(componentId: string): void {
    if (this.heartbeatIntervals.has(componentId)) {
      return;
    }

    const interval = setInterval(async () => {
      await this.performHeartbeat(componentId);
    }, this.config.heartbeatInterval);

    this.heartbeatIntervals.set(componentId, interval);
  }

  /**
   * Stop heartbeat monitoring for a component
   */
  private stopHeartbeat(componentId: string): void {
    const interval = this.heartbeatIntervals.get(componentId);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(componentId);
    }
  }

  /**
   * Perform heartbeat check
   */
  private async performHeartbeat(componentId: string): Promise<void> {
    const connection = this.connections.get(componentId);
    const health = this.connectionHealth.get(componentId);

    if (!connection || !health) {
      return;
    }

    try {
      const startTime = Date.now();

      // Send heartbeat message
      const heartbeatEnvelope: MessageEnvelope = {
        messageId: `heartbeat-${Date.now()}`,
        type: 'health_check',
        priority: 'low',
        deliveryMode: 'unicast',
        source: {
          componentId: 'connection-manager',
          type: 'background',
        },
        target: {
          componentId,
        },
        payload: {
          type: 'heartbeat',
          timestamp: new Date().toISOString(),
        },
        metadata: {
          timestamp: new Date().toISOString(),
          tags: ['heartbeat'],
          requiresAck: true,
        },
        delivery: {
          attempts: 0,
          maxAttempts: 1,
          timeout: 5000,
          confirmations: [],
        },
      };

      const success = await this.sendMessage(componentId, heartbeatEnvelope);

      if (success) {
        health.lastHeartbeat = new Date().toISOString();
        health.responseTime = Date.now() - startTime;
        health.state = 'connected';

        // Emit heartbeat event
        this.emitConnectionEvent({
          type: 'heartbeat',
          componentId,
          componentType: connection.componentType,
          timestamp: new Date().toISOString(),
          data: {
            responseTime: health.responseTime,
            qualityScore: health.qualityScore,
          },
        });
      } else {
        health.errorCount++;

        // Check if should trigger timeout
        const lastHeartbeat = new Date(health.lastHeartbeat).getTime();
        const now = Date.now();

        if (now - lastHeartbeat > this.config.heartbeatInterval * 3) {
          health.state = 'timeout';

          this.emitConnectionEvent({
            type: 'timeout',
            componentId,
            componentType: connection.componentType,
            timestamp: new Date().toISOString(),
            data: {
              lastHeartbeat: health.lastHeartbeat,
              timeoutDuration: now - lastHeartbeat,
            },
          });

          // Attempt reconnection if enabled
          if (this.config.autoReconnect) {
            await this.attemptReconnection(componentId);
          }
        }
      }

      this.updateQualityScore(componentId);
    } catch (error) {
      console.error(`[ConnectionManager] Heartbeat failed for ${componentId}:`, error);

      if (health) {
        health.errorCount++;
        health.state = 'error';
        this.updateQualityScore(componentId);
      }
    }
  }

  /**
   * Attempt to reconnect to a component
   */
  private async attemptReconnection(componentId: string): Promise<void> {
    try {
      // First disconnect cleanly
      await this.disconnect(componentId);

      // Wait for retry delay
      await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));

      // Attempt to reconnect would require the original registration
      // For now, just log the attempt
    } catch (error) {
      console.error(`[ConnectionManager] Reconnection failed for ${componentId}:`, error);
    }
  }

  /**
   * Update connection quality score
   */
  private updateQualityScore(componentId: string): void {
    const health = this.connectionHealth.get(componentId);
    if (!health) return;

    // Calculate quality score based on various factors
    let score = 100;

    // Penalize errors
    score -= Math.min(health.errorCount * 10, 50);

    // Penalize high response times
    if (health.responseTime > 1000) {
      score -= Math.min((health.responseTime - 1000) / 100, 30);
    }

    // Penalize connection state issues
    if (health.state === 'error') score -= 30;
    if (health.state === 'timeout') score -= 20;

    // Ensure score is within bounds
    health.qualityScore = Math.max(0, Math.min(100, score));
  }

  /**
   * Emit connection event
   */
  private emitConnectionEvent(event: ConnectionEvent): void {
    const handlers = this.eventHandlers.get(event.type);
    if (!handlers) return;

    for (const handler of handlers) {
      try {
        handler(event);
      } catch (error) {
        console.error(`[ConnectionManager] Event handler error for ${event.type}:`, error);
      }
    }
  }

  /**
   * Start health checking
   */
  private startHealthChecking(): void {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheck.interval);
  }

  /**
   * Stop health checking
   */
  private stopHealthChecking(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Perform health checks on all connections
   */
  private performHealthChecks(): void {
    for (const [componentId, health] of this.connectionHealth) {
      // Check if quality score is below threshold
      if (health.qualityScore < this.config.healthCheck.qualityThreshold) {
        console.warn(`[ConnectionManager] Poor connection quality for ${componentId}: ${health.qualityScore}`);

        // Emit poor health event
        const connection = this.connections.get(componentId);
        if (connection) {
          this.emitConnectionEvent({
            type: 'error',
            componentId,
            componentType: connection.componentType,
            timestamp: new Date().toISOString(),
            data: {
              reason: 'poor_quality',
              qualityScore: health.qualityScore,
            },
          });
        }
      }

      // Update uptime
      const connection = this.connections.get(componentId);
      if (connection && connection.connectedAt) {
        health.uptime = Date.now() - new Date(connection.connectedAt).getTime();
      }
    }
  }

  /**
   * Update connection statistics
   */
  private updateConnectionStats(action: 'connected' | 'disconnected', _componentType: ComponentType): void {
    if (action === 'connected') {
      this.stats.totalConnections++;
      this.stats.lastConnection = new Date().toISOString();
    }

    this.updateActiveConnectionsCount();
    this.updateConnectionsByType();
  }

  /**
   * Update active connections count
   */
  private updateActiveConnectionsCount(): void {
    this.stats.activeConnections = Array.from(this.connections.values()).filter(
      conn => conn.state === 'connected',
    ).length;
  }

  /**
   * Update connections by type count
   */
  private updateConnectionsByType(): void {
    const counts: Record<ComponentType, number> = {
      background: 0,
      content_script: 0,
      popup: 0,
      options: 0,
      sidepanel: 0,
      devtools: 0,
      offscreen: 0,
    };

    for (const connection of this.connections.values()) {
      if (connection.state === 'connected') {
        counts[connection.componentType]++;
      }
    }

    this.stats.connectionsByType = counts;
  }

  /**
   * Initialize connection statistics
   */
  private initializeStats(): ConnectionStats {
    return {
      totalConnections: 0,
      activeConnections: 0,
      connectionsByType: {
        background: 0,
        content_script: 0,
        popup: 0,
        options: 0,
        sidepanel: 0,
        devtools: 0,
        offscreen: 0,
      },
      totalMessages: 0,
      messagesSent: 0,
      messagesReceived: 0,
      averageResponseTime: 0,
      connectionErrors: 0,
    };
  }
}
