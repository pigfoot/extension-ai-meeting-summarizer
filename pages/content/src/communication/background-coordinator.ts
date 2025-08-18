/**
 * Background Coordinator
 *
 * BackgroundCoordinator with connection management, retry logic and disconnection
 * handling for coordinating all background service communication.
 */

import { eventSubscriber } from './event-subscriber';
import { messageDispatcher } from './message-dispatcher';
import { stateSynchronizer } from './state-synchronizer';
import type { BackgroundEventType, EventHandler } from './event-subscriber';
import type { MessageRequest, MessageResponse } from './message-dispatcher';
import type { SynchronizedStateType } from './state-synchronizer';

/**
 * Coordinator configuration
 */
export interface CoordinatorConfig {
  /** Enable automatic reconnection */
  autoReconnect: boolean;
  /** Reconnection attempts */
  maxReconnectAttempts: number;
  /** Reconnection delay in ms */
  reconnectDelay: number;
  /** Health check interval in ms */
  healthCheckInterval: number;
  /** Connection timeout in ms */
  connectionTimeout: number;
  /** Enable state synchronization */
  enableStateSynchronization: boolean;
  /** Enable event subscription */
  enableEventSubscription: boolean;
  /** Enable debug logging */
  enableDebugLogging: boolean;
  /** Startup sequence timeout */
  startupTimeout: number;
}

/**
 * Connection status
 */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed' | 'degraded';

/**
 * Service health status
 */
export interface ServiceHealth {
  /** Message dispatcher status */
  messageDispatcher: {
    status: ConnectionStatus;
    lastActivity: Date;
    statistics: Record<string, unknown>;
  };
  /** Event subscriber status */
  eventSubscriber: {
    status: ConnectionStatus;
    lastActivity: Date;
    statistics: Record<string, unknown>;
  };
  /** State synchronizer status */
  stateSynchronizer: {
    status: ConnectionStatus;
    lastActivity: Date;
    statistics: Record<string, unknown>;
  };
  /** Overall health score (0-100) */
  healthScore: number;
  /** Last health check */
  lastHealthCheck: Date;
}

/**
 * Coordinator statistics
 */
export interface CoordinatorStatistics {
  /** Connection status */
  connectionStatus: ConnectionStatus;
  /** Uptime in milliseconds */
  uptime: number;
  /** Total reconnection attempts */
  reconnectionAttempts: number;
  /** Successful connections */
  successfulConnections: number;
  /** Failed connections */
  failedConnections: number;
  /** Total messages sent */
  totalMessagesSent: number;
  /** Total events received */
  totalEventsReceived: number;
  /** Total state synchronizations */
  totalStateSynchronizations: number;
  /** Service health */
  serviceHealth: ServiceHealth;
  /** Last activity timestamp */
  lastActivity: Date;
  /** Coordinator start time */
  startTime: Date;
}

/**
 * Connection event
 */
export interface ConnectionEvent {
  /** Event type */
  type: 'connected' | 'disconnected' | 'reconnecting' | 'failed' | 'degraded';
  /** Event timestamp */
  timestamp: Date;
  /** Connection status */
  status: ConnectionStatus;
  /** Error information if applicable */
  error?: Error;
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Startup sequence step
 */
interface StartupStep {
  /** Step name */
  name: string;
  /** Step function */
  execute: () => Promise<void>;
  /** Step timeout */
  timeout: number;
  /** Whether step is critical */
  critical: boolean;
  /** Retry attempts */
  retries: number;
}

/**
 * Background service coordinator
 */
export class BackgroundCoordinator {
  private static instance: BackgroundCoordinator;
  private config: CoordinatorConfig;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private connectionCallbacks: Array<(event: ConnectionEvent) => void> = [];
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private statistics: CoordinatorStatistics;
  private reconnectAttempts: number = 0;
  private isInitialized: boolean = false;
  private startupPromise: Promise<void> | null = null;

  constructor(config: Partial<CoordinatorConfig> = {}) {
    this.config = {
      autoReconnect: true,
      maxReconnectAttempts: 5,
      reconnectDelay: 2000,
      healthCheckInterval: 30000,
      connectionTimeout: 10000,
      enableStateSynchronization: true,
      enableEventSubscription: true,
      enableDebugLogging: false,
      startupTimeout: 30000,
      ...config,
    };

    this.statistics = {
      connectionStatus: 'disconnected',
      uptime: 0,
      reconnectionAttempts: 0,
      successfulConnections: 0,
      failedConnections: 0,
      totalMessagesSent: 0,
      totalEventsReceived: 0,
      totalStateSynchronizations: 0,
      serviceHealth: this.createInitialServiceHealth(),
      lastActivity: new Date(),
      startTime: new Date(),
    };
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<CoordinatorConfig>): BackgroundCoordinator {
    if (!BackgroundCoordinator.instance) {
      BackgroundCoordinator.instance = new BackgroundCoordinator(config);
    }
    return BackgroundCoordinator.instance;
  }

  /**
   * Initialize coordinator and all services
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.startupPromise) {
      return this.startupPromise;
    }

    this.startupPromise = this.performInitialization();
    return this.startupPromise;
  }

  /**
   * Perform initialization sequence
   */
  private async performInitialization(): Promise<void> {
    this.log('Starting background coordinator initialization...');
    this.updateConnectionStatus('connecting');

    const startupSteps: StartupStep[] = [
      {
        name: 'Initialize Message Dispatcher',
        execute: () => this.initializeMessageDispatcher(),
        timeout: 5000,
        critical: true,
        retries: 3,
      },
      {
        name: 'Initialize Event Subscriber',
        execute: () => this.initializeEventSubscriber(),
        timeout: 5000,
        critical: this.config.enableEventSubscription,
        retries: 2,
      },
      {
        name: 'Initialize State Synchronizer',
        execute: () => this.initializeStateSynchronizer(),
        timeout: 5000,
        critical: this.config.enableStateSynchronization,
        retries: 2,
      },
      {
        name: 'Perform Health Check',
        execute: () => this.performHealthCheck(),
        timeout: 3000,
        critical: false,
        retries: 1,
      },
      {
        name: 'Setup Event Handlers',
        execute: () => this.setupEventHandlers(),
        timeout: 2000,
        critical: true,
        retries: 1,
      },
      {
        name: 'Start Health Monitoring',
        execute: () => this.startHealthMonitoring(),
        timeout: 1000,
        critical: false,
        retries: 1,
      },
    ];

    try {
      for (const step of startupSteps) {
        await this.executeStartupStep(step);
      }

      this.isInitialized = true;
      this.updateConnectionStatus('connected');
      this.statistics.successfulConnections++;

      this.log('Background coordinator initialization completed successfully');
    } catch (error) {
      this.updateConnectionStatus('failed');
      this.statistics.failedConnections++;
      this.log(`Initialization failed: ${error}`);

      if (this.config.autoReconnect) {
        this.scheduleReconnection();
      }

      throw error;
    }
  }

  /**
   * Execute startup step with timeout and retries
   */
  private async executeStartupStep(step: StartupStep): Promise<void> {
    let attempts = 0;
    const maxAttempts = step.retries + 1;

    while (attempts < maxAttempts) {
      try {
        this.log(`Executing step: ${step.name} (attempt ${attempts + 1}/${maxAttempts})`);

        await Promise.race([
          step.execute(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Step timeout: ${step.name}`)), step.timeout),
          ),
        ]);

        this.log(`Step completed: ${step.name}`);
        return;
      } catch (error) {
        attempts++;
        this.log(`Step failed: ${step.name} - ${error}`);

        if (attempts >= maxAttempts) {
          if (step.critical) {
            throw new Error(`Critical step failed: ${step.name} - ${error}`);
          } else {
            this.log(`Non-critical step failed, continuing: ${step.name}`);
            return;
          }
        }

        // Wait before retry
        await this.delay(1000 * attempts);
      }
    }
  }

  /**
   * Send message through message dispatcher
   */
  async sendMessage<T = unknown, R = unknown>(request: MessageRequest<T>): Promise<MessageResponse<R>> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const response = await messageDispatcher.sendMessage<T, R>(request);
      this.statistics.totalMessagesSent++;
      this.statistics.lastActivity = new Date();
      return response;
    } catch (error) {
      this.handleCommunicationError(error);
      throw error;
    }
  }

  /**
   * Subscribe to background events
   */
  subscribeToEvents<T = unknown>(
    eventTypes: BackgroundEventType | BackgroundEventType[],
    handler: EventHandler<T>,
  ): string {
    if (!this.isInitialized) {
      throw new Error('Coordinator not initialized');
    }

    const subscriptionId = eventSubscriber.subscribe(eventTypes, event => {
      this.statistics.totalEventsReceived++;
      this.statistics.lastActivity = new Date();
      handler(event);
    });

    return subscriptionId;
  }

  /**
   * Set synchronized state
   */
  async setState<T = unknown>(stateType: SynchronizedStateType, key: string, value: T): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      await stateSynchronizer.setState(stateType, key, value);
      this.statistics.totalStateSynchronizations++;
      this.statistics.lastActivity = new Date();
    } catch (error) {
      this.handleCommunicationError(error);
      throw error;
    }
  }

  /**
   * Get synchronized state
   */
  getState<T = unknown>(stateType: SynchronizedStateType, key: string): T | null {
    if (!this.isInitialized) {
      return null;
    }

    const state = stateSynchronizer.getState(stateType, key);
    return state ? state.value : null;
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Check if coordinator is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.connectionStatus === 'connected';
  }

  /**
   * Get coordinator statistics
   */
  getStatistics(): CoordinatorStatistics {
    this.updateStatistics();
    return { ...this.statistics };
  }

  /**
   * Register connection status callback
   */
  onConnectionStatusChange(callback: (event: ConnectionEvent) => void): () => void {
    this.connectionCallbacks.push(callback);

    return () => {
      const index = this.connectionCallbacks.indexOf(callback);
      if (index > -1) {
        this.connectionCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Force reconnection
   */
  async reconnect(): Promise<void> {
    this.log('Manual reconnection requested');

    // Reset initialization state
    this.isInitialized = false;
    this.startupPromise = null;

    // Clear any existing reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Cleanup existing connections
    await this.cleanup();

    // Reinitialize
    await this.initialize();
  }

  /**
   * Initialize message dispatcher
   */
  private async initializeMessageDispatcher(): Promise<void> {
    // Message dispatcher should auto-initialize when used
    // Verify connection with a health check
    try {
      await messageDispatcher.sendMessage({
        type: 'health.check',
        payload: { source: 'coordinator' },
        timeout: 3000,
        retries: 1,
      });
    } catch (error) {
      throw new Error(`Message dispatcher initialization failed: ${error}`);
    }
  }

  /**
   * Initialize event subscriber
   */
  private async initializeEventSubscriber(): Promise<void> {
    if (!this.config.enableEventSubscription) {
      return;
    }

    // Event subscriber should auto-initialize
    // Test with a dummy subscription
    const testSubscription = eventSubscriber.subscribe('system.notification', () => {});
    eventSubscriber.unsubscribe(testSubscription);
  }

  /**
   * Initialize state synchronizer
   */
  private async initializeStateSynchronizer(): Promise<void> {
    if (!this.config.enableStateSynchronization) {
      return;
    }

    // Skip test call to avoid persistence/messaging dependencies during initialization
    // State synchronizer is already initialized via singleton, so this step is mainly for verification
    this.log('State synchronizer initialization step completed (singleton already initialized)');
  }

  /**
   * Setup event handlers
   */
  private async setupEventHandlers(): Promise<void> {
    // Setup disconnect handling
    if (this.config.enableEventSubscription) {
      eventSubscriber.addEventListener('connection.status', event => {
        this.handleConnectionStatusEvent(event);
      });
    }

    // Setup window/tab event handlers
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });

    window.addEventListener('online', () => {
      if (this.connectionStatus === 'disconnected' || this.connectionStatus === 'failed') {
        this.reconnect();
      }
    });

    window.addEventListener('offline', () => {
      this.updateConnectionStatus('disconnected');
    });
  }

  /**
   * Start health monitoring
   */
  private async startHealthMonitoring(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const [messageStats, eventStats, stateStats] = await Promise.all([
        messageDispatcher.getStatistics(),
        eventSubscriber.getStatistics(),
        stateSynchronizer.getStatistics(),
      ]);

      this.statistics.serviceHealth = {
        messageDispatcher: {
          status: messageStats.connectionStatus === 'connected' ? 'connected' : 'disconnected',
          lastActivity: new Date(),
          statistics: messageStats,
        },
        eventSubscriber: {
          status: eventStats.connectionStatus === 'connected' ? 'connected' : 'disconnected',
          lastActivity: eventStats.lastEventTime || new Date(),
          statistics: eventStats,
        },
        stateSynchronizer: {
          status: 'connected', // State synchronizer doesn't have connection status
          lastActivity: new Date(),
          statistics: stateStats,
        },
        healthScore: this.calculateHealthScore(messageStats, eventStats, stateStats),
        lastHealthCheck: new Date(),
      };

      // Update overall connection status based on health
      this.updateConnectionStatusFromHealth();
    } catch (error) {
      this.log(`Health check failed: ${error}`);
      this.updateConnectionStatus('degraded');
    }
  }

  /**
   * Calculate health score
   */
  private calculateHealthScore(
    messageStats: Record<string, unknown>,
    eventStats: Record<string, unknown>,
    stateStats: Record<string, unknown>,
  ): number {
    let score = 0;

    // Message dispatcher health (40%)
    if (messageStats.connectionStatus === 'connected') {
      score += 40;
    }

    // Event subscriber health (30%)
    if (eventStats.connectionStatus === 'connected') {
      score += 30;
    }

    // State synchronizer health (20%)
    if (stateStats.totalStates >= 0) {
      score += 20;
    }

    // Recent activity bonus (10%)
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    if (this.statistics.lastActivity.getTime() > fiveMinutesAgo) {
      score += 10;
    }

    return Math.min(score, 100);
  }

  /**
   * Update connection status from health check
   */
  private updateConnectionStatusFromHealth(): void {
    const health = this.statistics.serviceHealth;

    if (health.healthScore >= 80) {
      this.updateConnectionStatus('connected');
    } else if (health.healthScore >= 50) {
      this.updateConnectionStatus('degraded');
    } else {
      this.updateConnectionStatus('disconnected');

      if (this.config.autoReconnect) {
        this.scheduleReconnection();
      }
    }
  }

  /**
   * Handle connection status event
   */
  private handleConnectionStatusEvent(event: Record<string, unknown>): void {
    const status = event.data?.status;

    if (status === 'disconnected' || status === 'error') {
      this.updateConnectionStatus('disconnected');

      if (this.config.autoReconnect) {
        this.scheduleReconnection();
      }
    }
  }

  /**
   * Handle communication error
   */
  private handleCommunicationError(error: Error | unknown): void {
    this.log(`Communication error: ${error}`);

    if (error.name === 'ConnectionError' || error.name === 'MessageTimeoutError') {
      this.updateConnectionStatus('disconnected');

      if (this.config.autoReconnect) {
        this.scheduleReconnection();
      }
    }
  }

  /**
   * Schedule reconnection
   */
  private scheduleReconnection(): void {
    if (this.reconnectTimeout || this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      return;
    }

    this.updateConnectionStatus('reconnecting');
    this.reconnectAttempts++;
    this.statistics.reconnectionAttempts++;

    const delay = this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    this.log(`Scheduling reconnection in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(async () => {
      this.reconnectTimeout = null;

      try {
        await this.reconnect();
        this.reconnectAttempts = 0; // Reset on successful reconnection
      } catch (error) {
        this.log(`Reconnection attempt ${this.reconnectAttempts} failed: ${error}`);

        if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
          this.scheduleReconnection();
        } else {
          this.updateConnectionStatus('failed');
          this.log('Maximum reconnection attempts reached');
        }
      }
    }, delay);
  }

  /**
   * Update connection status
   */
  private updateConnectionStatus(status: ConnectionStatus): void {
    if (this.connectionStatus === status) {
      return;
    }

    const previousStatus = this.connectionStatus;
    this.connectionStatus = status;
    this.statistics.connectionStatus = status;

    const event: ConnectionEvent = {
      type: status,
      timestamp: new Date(),
      status,
      context: { previousStatus },
    };

    this.connectionCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        this.log(`Connection callback error: ${error}`);
      }
    });

    this.log(`Connection status changed: ${previousStatus} -> ${status}`);
  }

  /**
   * Update statistics
   */
  private updateStatistics(): void {
    this.statistics.uptime = Date.now() - this.statistics.startTime.getTime();
  }

  /**
   * Create initial service health
   */
  private createInitialServiceHealth(): ServiceHealth {
    return {
      messageDispatcher: {
        status: 'disconnected',
        lastActivity: new Date(),
        statistics: {},
      },
      eventSubscriber: {
        status: 'disconnected',
        lastActivity: new Date(),
        statistics: {},
      },
      stateSynchronizer: {
        status: 'disconnected',
        lastActivity: new Date(),
        statistics: {},
      },
      healthScore: 0,
      lastHealthCheck: new Date(),
    };
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log debug message
   */
  private log(message: string): void {
    if (this.config.enableDebugLogging) {
      console.log(`[BackgroundCoordinator] ${message}`);
    }
  }

  /**
   * Cleanup coordinator
   */
  async cleanup(): Promise<void> {
    this.log('Cleaning up background coordinator...');

    // Stop health monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Clear reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Cleanup services
    try {
      await Promise.all([messageDispatcher.cleanup(), eventSubscriber.cleanup(), stateSynchronizer.cleanup()]);
    } catch (error) {
      this.log(`Cleanup error: ${error}`);
    }

    // Reset state
    this.isInitialized = false;
    this.startupPromise = null;
    this.updateConnectionStatus('disconnected');
    this.connectionCallbacks.length = 0;

    this.log('Background coordinator cleanup completed');
  }
}

// Export singleton instance
export const backgroundCoordinator = BackgroundCoordinator.getInstance();

// Export utility functions
export const coordinatorUtils = {
  /**
   * Get coordinator instance
   */
  getInstance: (config?: Partial<CoordinatorConfig>) => BackgroundCoordinator.getInstance(config),

  /**
   * Initialize coordinator
   */
  initialize: (): Promise<void> => backgroundCoordinator.initialize(),

  /**
   * Send message to background service
   */
  sendMessage: <T = unknown, R = unknown>(request: MessageRequest<T>): Promise<MessageResponse<R>> =>
    backgroundCoordinator.sendMessage(request),

  /**
   * Subscribe to background events
   */
  subscribeToEvents: <T = unknown>(
    eventTypes: BackgroundEventType | BackgroundEventType[],
    handler: EventHandler<T>,
  ): string => backgroundCoordinator.subscribeToEvents(eventTypes, handler),

  /**
   * Set synchronized state
   */
  setState: <T = unknown>(stateType: SynchronizedStateType, key: string, value: T): Promise<void> =>
    backgroundCoordinator.setState(stateType, key, value),

  /**
   * Get synchronized state
   */
  getState: <T = unknown>(stateType: SynchronizedStateType, key: string): T | null =>
    backgroundCoordinator.getState(stateType, key),

  /**
   * Check if ready
   */
  isReady: (): boolean => backgroundCoordinator.isReady(),

  /**
   * Get connection status
   */
  getStatus: (): ConnectionStatus => backgroundCoordinator.getConnectionStatus(),

  /**
   * Get statistics
   */
  getStats: (): CoordinatorStatistics => backgroundCoordinator.getStatistics(),

  /**
   * Register connection status callback
   */
  onStatusChange: (callback: (event: ConnectionEvent) => void): (() => void) =>
    backgroundCoordinator.onConnectionStatusChange(callback),

  /**
   * Force reconnection
   */
  reconnect: (): Promise<void> => backgroundCoordinator.reconnect(),

  /**
   * Cleanup coordinator
   */
  cleanup: (): Promise<void> => backgroundCoordinator.cleanup(),
};
