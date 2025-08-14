/**
 * Lifecycle coordinator for Service Worker management
 * Coordinates all Service Worker lifecycle operations, health monitoring, and recovery
 */

import { StartupManager } from './startup-manager';
import { StatePersistenceManager } from './state-persistence';
import { SuspensionHandler } from './suspension-handler';
import type { SubsystemInitializer } from './startup-manager';
import type { StateSerializationConfig } from './state-persistence';
import type { CleanupConfig } from './suspension-handler';
import type {
  ServiceWorkerState,
  StartupConfig,
  LifecycleEvent,
  LifecycleEventData,
  LifecycleEventHandler,
  HealthCheck,
  RecoveryStrategy,
  ServiceWorkerError,
  InitializationResult,
} from '../types';

/**
 * Lifecycle coordinator configuration
 */
export interface LifecycleCoordinatorConfig {
  /** Startup configuration */
  startup: StartupConfig;
  /** State serialization configuration */
  serialization: StateSerializationConfig;
  /** Resource cleanup configuration */
  cleanup: CleanupConfig;
  /** Health monitoring configuration */
  healthMonitoring: {
    /** Enable health monitoring */
    enabled: boolean;
    /** Health check interval in milliseconds */
    checkInterval: number;
    /** Health check timeout in milliseconds */
    checkTimeout: number;
    /** Enable automatic recovery */
    autoRecovery: boolean;
  };
  /** Event handling configuration */
  eventHandling: {
    /** Enable event logging */
    enableLogging: boolean;
    /** Maximum event handlers per event type */
    maxHandlersPerEvent: number;
    /** Event handler timeout in milliseconds */
    handlerTimeout: number;
  };
}

/**
 * Lifecycle coordinator for comprehensive Service Worker management
 */
export class LifecycleCoordinator {
  private config: LifecycleCoordinatorConfig;
  private state: ServiceWorkerState;
  private startupManager: StartupManager;
  private persistenceManager: StatePersistenceManager;
  private suspensionHandler: SuspensionHandler;

  private eventHandlers: Map<LifecycleEvent, LifecycleEventHandler[]> = new Map();
  private healthChecks: Map<string, HealthCheck> = new Map();
  private recoveryStrategies: Map<string, RecoveryStrategy> = new Map();

  private healthMonitoringInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private isShuttingDown = false;

  constructor(config: LifecycleCoordinatorConfig) {
    this.config = config;
    this.state = this.createInitialState();

    // Initialize components
    this.startupManager = new StartupManager(config.startup);
    this.persistenceManager = new StatePersistenceManager(config.serialization);
    this.suspensionHandler = new SuspensionHandler(this.persistenceManager, config.cleanup);

    // Setup default event handlers
    this.setupDefaultEventHandlers();

    // Setup default health checks
    this.setupDefaultHealthChecks();

    // Setup default recovery strategies
    this.setupDefaultRecoveryStrategies();
  }

  /**
   * Initialize the Service Worker lifecycle system
   */
  async initialize(): Promise<InitializationResult> {
    if (this.isInitialized) {
      return {
        success: true,
        duration: 0,
        initializedSubsystems: [],
        failedSubsystems: [],
        warnings: ['Already initialized'],
        finalState: this.state,
      };
    }

    try {
      console.log('[LifecycleCoordinator] Starting initialization');

      // Fire startup event
      await this.fireLifecycleEvent('startup', {
        previousStatus: this.state.status,
        currentStatus: 'initializing',
      });

      // Initialize startup manager
      const result = await this.startupManager.initialize();

      // Update state with initialization result
      this.state = result.finalState;
      this.isInitialized = result.success;

      if (result.success) {
        // Start health monitoring
        if (this.config.healthMonitoring.enabled) {
          this.startHealthMonitoring();
        }

        // Start periodic state persistence
        this.persistenceManager.schedulePeriodicPersistence(
          () => this.state,
          () => [], // TODO: Get job queues from job orchestrator
          () => [], // TODO: Get active jobs from job orchestrator
          60000, // Every minute
        );

        // Fire activate event
        await this.fireLifecycleEvent('activate', {
          previousStatus: 'initializing',
          currentStatus: 'active',
        });

        console.log('[LifecycleCoordinator] Initialization completed successfully');
      } else {
        await this.fireLifecycleEvent('error', {
          previousStatus: 'initializing',
          currentStatus: 'error',
        });
      }

      return result;
    } catch (error) {
      console.error('[LifecycleCoordinator] Initialization failed:', error);

      const errorResult: InitializationResult = {
        success: false,
        duration: 0,
        initializedSubsystems: [],
        failedSubsystems: [
          {
            name: 'LifecycleCoordinator',
            error: this.createLifecycleError(error),
          },
        ],
        warnings: [],
        finalState: this.state,
      };

      await this.fireLifecycleEvent('error', {
        previousStatus: this.state.status,
        currentStatus: 'error',
      });

      return errorResult;
    }
  }

  /**
   * Handle graceful shutdown
   */
  async shutdown(reason: string = 'Manual shutdown'): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;

    try {
      console.log(`[LifecycleCoordinator] Starting shutdown: ${reason}`);

      // Fire shutdown event
      await this.fireLifecycleEvent('shutdown', {
        previousStatus: this.state.status,
        currentStatus: 'terminating',
        data: { reason },
      });

      // Stop health monitoring
      this.stopHealthMonitoring();

      // Stop periodic persistence
      this.persistenceManager.stopPeriodicPersistence();

      // Handle suspension
      const suspensionResult = await this.suspensionHandler.handleSuspension(
        this.state,
        [], // TODO: Get active jobs
        [], // TODO: Get job queues
      );

      if (!suspensionResult.success) {
        console.warn('[LifecycleCoordinator] Suspension completed with errors');
      }

      this.state.status = 'terminating';
      console.log('[LifecycleCoordinator] Shutdown completed');
    } catch (error) {
      console.error('[LifecycleCoordinator] Shutdown failed:', error);

      // Emergency shutdown
      await this.suspensionHandler.handleEmergencyShutdown(this.state, 'Shutdown error');
    }
  }

  /**
   * Handle Service Worker suspension
   */
  async handleSuspension(): Promise<void> {
    try {
      console.log('[LifecycleCoordinator] Handling suspension');

      await this.fireLifecycleEvent('suspend', {
        previousStatus: this.state.status,
        currentStatus: 'suspended',
      });

      const result = await this.suspensionHandler.handleSuspension(
        this.state,
        [], // TODO: Get active jobs
        [], // TODO: Get job queues
      );

      if (result.success) {
        this.state.status = 'suspended';
        this.state.suspensionCount++;
      }
    } catch (error) {
      console.error('[LifecycleCoordinator] Suspension handling failed:', error);
      this.addError(this.createLifecycleError(error));
    }
  }

  /**
   * Handle Service Worker wake-up
   */
  async handleWakeup(): Promise<void> {
    try {
      console.log('[LifecycleCoordinator] Handling wake-up');

      const result = await this.suspensionHandler.handleWakeup();

      if (result.success && result.restoredState) {
        // Merge restored state
        this.state = { ...this.state, ...result.restoredState };
      }

      await this.fireLifecycleEvent('wakeup', {
        previousStatus: 'suspended',
        currentStatus: 'active',
      });

      this.state.status = 'active';
    } catch (error) {
      console.error('[LifecycleCoordinator] Wake-up handling failed:', error);
      this.addError(this.createLifecycleError(error));
    }
  }

  /**
   * Register a subsystem with the startup manager
   */
  registerSubsystem(subsystem: SubsystemInitializer): void {
    this.startupManager.registerSubsystem(subsystem);
  }

  /**
   * Register a lifecycle event handler
   */
  registerEventHandler(handler: LifecycleEventHandler): void {
    const handlers = this.eventHandlers.get(handler.event) || [];

    if (handlers.length >= this.config.eventHandling.maxHandlersPerEvent) {
      throw new Error(`Maximum handlers exceeded for event: ${handler.event}`);
    }

    // Insert handler in priority order (higher priority first)
    const insertIndex = handlers.findIndex(h => h.priority < handler.priority);
    if (insertIndex === -1) {
      handlers.push(handler);
    } else {
      handlers.splice(insertIndex, 0, handler);
    }

    this.eventHandlers.set(handler.event, handlers);
  }

  /**
   * Register a health check
   */
  registerHealthCheck(healthCheck: HealthCheck): void {
    this.healthChecks.set(healthCheck.id, healthCheck);
  }

  /**
   * Register a recovery strategy
   */
  registerRecoveryStrategy(strategy: RecoveryStrategy): void {
    this.recoveryStrategies.set(strategy.id, strategy);
  }

  /**
   * Get current Service Worker state
   */
  getState(): ServiceWorkerState {
    return { ...this.state };
  }

  /**
   * Update lifecycle configuration
   */
  updateConfig(config: Partial<LifecycleCoordinatorConfig>): void {
    this.config = { ...this.config, ...config };

    if (config.startup) {
      this.startupManager.updateConfig(config.startup);
    }
  }

  /**
   * Fire a lifecycle event
   */
  private async fireLifecycleEvent(event: LifecycleEvent, data: Partial<LifecycleEventData> = {}): Promise<void> {
    const eventData: LifecycleEventData = {
      event,
      timestamp: new Date().toISOString(),
      previousStatus: this.state.status,
      currentStatus: this.state.status,
      forced: false,
      source: 'extension',
      ...data,
    };

    if (this.config.eventHandling.enableLogging) {
      console.log(`[LifecycleCoordinator] Firing event: ${event}`);
    }

    const handlers = this.eventHandlers.get(event) || [];

    for (const handler of handlers) {
      try {
        const timeoutPromise = new Promise<void>((_, reject) => {
          setTimeout(() => reject(new Error('Handler timeout')), this.config.eventHandling.handlerTimeout);
        });

        const handlerPromise = Promise.resolve(handler.handler(eventData));

        await Promise.race([handlerPromise, timeoutPromise]);
      } catch (error) {
        console.error(`[LifecycleCoordinator] Event handler failed for ${event}:`, error);

        if (handler.errorHandling === 'fail') {
          throw error;
        } else if (handler.errorHandling === 'retry') {
          // TODO: Implement retry logic
        }
        // 'ignore' and 'log' are handled by the logging above
      }
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.healthMonitoringInterval) {
      return;
    }

    this.healthMonitoringInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthMonitoring.checkInterval);

    console.log('[LifecycleCoordinator] Health monitoring started');
  }

  /**
   * Stop health monitoring
   */
  private stopHealthMonitoring(): void {
    if (this.healthMonitoringInterval) {
      clearInterval(this.healthMonitoringInterval);
      this.healthMonitoringInterval = null;
    }
  }

  /**
   * Perform health checks
   */
  private async performHealthChecks(): Promise<void> {
    for (const [id, healthCheck] of this.healthChecks) {
      try {
        const startTime = Date.now();

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Health check timeout')), healthCheck.timeout);
        });

        const checkPromise = healthCheck.execute();
        const result = await Promise.race([checkPromise, timeoutPromise]);

        const duration = Date.now() - startTime;

        healthCheck.lastCheck = new Date().toISOString();
        healthCheck.lastResult = {
          passed: result.passed,
          duration,
          message: result.message,
          data: result.data,
        };

        if (!result.passed && healthCheck.critical) {
          console.warn(`[LifecycleCoordinator] Critical health check failed: ${id}`);

          if (this.config.healthMonitoring.autoRecovery) {
            await this.attemptRecovery(id, result.message || 'Health check failed');
          }
        }
      } catch (error) {
        console.error(`[LifecycleCoordinator] Health check error for ${id}:`, error);

        healthCheck.lastCheck = new Date().toISOString();
        healthCheck.lastResult = {
          passed: false,
          duration: this.config.healthMonitoring.checkTimeout,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    }
  }

  /**
   * Attempt recovery using registered strategies
   */
  private async attemptRecovery(healthCheckId: string, reason: string): Promise<void> {
    console.log(`[LifecycleCoordinator] Attempting recovery for ${healthCheckId}: ${reason}`);

    // TODO: Implement recovery strategy selection and execution
    // This would involve:
    // 1. Finding appropriate recovery strategies
    // 2. Executing them in order
    // 3. Monitoring recovery success
    // 4. Falling back to emergency procedures if needed
  }

  /**
   * Setup default event handlers
   */
  private setupDefaultEventHandlers(): void {
    // Error event handler
    this.registerEventHandler({
      event: 'error',
      priority: 1000,
      handler: async eventData => {
        console.error('[LifecycleCoordinator] Error event received:', eventData);
        this.state.status = 'error';
      },
      required: true,
      timeout: 5000,
      errorHandling: 'log',
    });

    // Startup event handler
    this.registerEventHandler({
      event: 'startup',
      priority: 1000,
      handler: async eventData => {
        console.log('[LifecycleCoordinator] Startup event received');
        this.state.startupTime = eventData.timestamp;
      },
      required: false,
      timeout: 1000,
      errorHandling: 'log',
    });
  }

  /**
   * Setup default health checks
   */
  private setupDefaultHealthChecks(): void {
    // Memory usage health check
    this.registerHealthCheck({
      id: 'memory-usage',
      description: 'Monitor memory usage',
      interval: 30000,
      timeout: 5000,
      critical: false,
      execute: async () => {
        const memoryUsage = this.state.performanceMetrics.memoryUsageMB;
        const memoryLimit = this.config.startup.resourceLimits.maxMemoryMB;

        return {
          passed: memoryUsage < memoryLimit * 0.9, // 90% threshold
          message: `Memory usage: ${memoryUsage}MB / ${memoryLimit}MB`,
          data: { memoryUsage, memoryLimit },
        };
      },
    });

    // Error rate health check
    this.registerHealthCheck({
      id: 'error-rate',
      description: 'Monitor error rate',
      interval: 60000,
      timeout: 5000,
      critical: true,
      execute: async () => {
        const errorRate = this.state.performanceMetrics.errorRate;

        return {
          passed: errorRate < 0.1, // 10% threshold
          message: `Error rate: ${(errorRate * 100).toFixed(2)}%`,
          data: { errorRate },
        };
      },
    });
  }

  /**
   * Setup default recovery strategies
   */
  private setupDefaultRecoveryStrategies(): void {
    // Memory cleanup recovery
    this.registerRecoveryStrategy({
      id: 'memory-cleanup',
      errorTypes: ['memory'],
      severityLevels: ['medium', 'high'],
      maxAttempts: 3,
      retryDelay: 5000,
      resetOnSuccess: true,
      execute: async (error, attempt) => {
        console.log(`[LifecycleCoordinator] Memory cleanup attempt ${attempt}`);

        // TODO: Implement memory cleanup
        // This would involve:
        // 1. Clearing caches
        // 2. Garbage collection hints
        // 3. Releasing non-essential resources

        return true; // Simulate success
      },
    });
  }

  /**
   * Create initial state
   */
  private createInitialState(): ServiceWorkerState {
    const manifest = chrome.runtime.getManifest();

    return {
      startupTime: new Date().toISOString(),
      status: 'initializing',
      lastHeartbeat: new Date().toISOString(),
      suspensionCount: 0,
      restoredJobs: 0,
      activeConnections: new Map(),
      performanceMetrics: {
        memoryUsageMB: 0,
        cpuUsage: 0,
        activeConnections: 0,
        pendingJobs: 0,
        averageResponseTime: 0,
        messagesPerSecond: 0,
        errorRate: 0,
        lastUpdated: new Date().toISOString(),
      },
      errorLog: [],
      configVersion: '1.0.0',
      subsystems: new Map(),
      capabilities: {
        backgroundSync: 'serviceWorker' in navigator,
        notifications: 'Notification' in globalThis,
        storageSync: chrome?.storage?.sync !== undefined,
        indexedDB: 'indexedDB' in globalThis,
        webAssembly: 'WebAssembly' in globalThis,
      },
      extensionInfo: {
        version: manifest.version,
        installedAt: new Date().toISOString(),
        installReason: 'install',
      },
    };
  }

  /**
   * Add error to error log
   */
  private addError(error: ServiceWorkerError): void {
    this.state.errorLog.push(error);

    // Keep error log size manageable
    if (this.state.errorLog.length > 100) {
      this.state.errorLog = this.state.errorLog.slice(-50);
    }
  }

  /**
   * Create lifecycle error
   */
  private createLifecycleError(error: unknown): ServiceWorkerError {
    return {
      id: `lifecycle-${Date.now()}`,
      type: 'lifecycle',
      severity: 'high',
      message: error instanceof Error ? error.message : String(error),
      details: error,
      timestamp: new Date().toISOString(),
      stack: error instanceof Error ? error.stack : undefined,
      source: 'LifecycleCoordinator',
      requiresAttention: true,
      recoverySuggestions: ['Check system resources', 'Restart the extension', 'Clear extension storage'],
    };
  }
}
