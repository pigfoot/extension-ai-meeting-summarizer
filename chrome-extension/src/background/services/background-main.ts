/**
 * Background service main coordination
 * Implements central coordination for all background services and subsystems
 */

import { APICoordinator } from '../azure/api-coordinator';
import { AzureClientCoordinator } from '../azure/client-coordinator';
import { RateLimitManager } from '../azure/rate-limit-manager';
import { JobCoordinator } from '../jobs/job-coordinator';
import { JobNotificationService } from '../jobs/job-notifications';
import { JobQueueManager } from '../jobs/job-queue-manager';
import { JobTracker } from '../jobs/job-tracker';
import { LifecycleCoordinator } from '../lifecycle/lifecycle-coordinator';
import { StartupManager } from '../lifecycle/startup-manager';
import { SuspensionHandler } from '../lifecycle/suspension-handler';
import { BroadcastManager } from '../messaging/broadcast-manager';
import { ConnectionManager } from '../messaging/connection-manager';
import { MessageRouter } from '../messaging/message-router';
import { SyncCoordinator } from '../messaging/sync-coordinator';
import { ErrorAggregator } from '../monitoring/error-aggregator';
import { PerformanceMonitor } from '../monitoring/performance-monitor';
import { BatchProcessor } from '../storage/batch-processor';
import { ConflictResolver } from '../storage/conflict-resolver';
import { QuotaManager } from '../storage/quota-manager';
import { StorageCoordinator } from '../storage/storage-coordinator';

/**
 * Background service initialization status
 */
export type ServiceInitStatus = 'pending' | 'initializing' | 'ready' | 'error' | 'shutdown';

/**
 * Subsystem health status
 */
export interface SubsystemHealth {
  /** Subsystem name */
  name: string;
  /** Health status */
  status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
  /** Last health check timestamp */
  lastCheck: string;
  /** Health metrics */
  metrics: {
    /** Uptime percentage */
    uptime: number;
    /** Response time in milliseconds */
    responseTime: number;
    /** Error rate percentage */
    errorRate: number;
    /** Memory usage in MB */
    memoryUsage: number;
  };
  /** Issues if unhealthy */
  issues?: string[];
}

/**
 * Background service configuration
 */
export interface BackgroundServiceConfig {
  /** Enable performance monitoring */
  enablePerformanceMonitoring: boolean;
  /** Enable error aggregation */
  enableErrorAggregation: boolean;
  /** Enable job orchestration */
  enableJobOrchestration: boolean;
  /** Enable Azure integration */
  enableAzureIntegration: boolean;
  /** Enable storage coordination */
  enableStorageCoordination: boolean;
  /** Enable messaging coordination */
  enableMessagingCoordination: boolean;
  /** Health check interval in milliseconds */
  healthCheckInterval: number;
  /** Service recovery settings */
  recovery: {
    /** Enable automatic recovery */
    enableAutoRecovery: boolean;
    /** Maximum recovery attempts */
    maxRetryAttempts: number;
    /** Recovery delay in milliseconds */
    recoveryDelay: number;
  };
  /** Debug settings */
  debug: {
    /** Enable debug logging */
    enableDebugLogging: boolean;
    /** Log performance metrics */
    logPerformanceMetrics: boolean;
    /** Log subsystem status */
    logSubsystemStatus: boolean;
  };
}

/**
 * Background service statistics
 */
export interface BackgroundServiceStats {
  /** Service start time */
  startTime: string;
  /** Service uptime in milliseconds */
  uptime: number;
  /** Total operations processed */
  totalOperations: number;
  /** Successful operations */
  successfulOperations: number;
  /** Failed operations */
  failedOperations: number;
  /** Service restarts */
  restartCount: number;
  /** Subsystem statistics */
  subsystems: {
    /** Total subsystems */
    total: number;
    /** Healthy subsystems */
    healthy: number;
    /** Degraded subsystems */
    degraded: number;
    /** Unhealthy subsystems */
    unhealthy: number;
    /** Offline subsystems */
    offline: number;
  };
  /** Last statistics update */
  lastUpdate: string;
}

/**
 * Main background service coordinator
 */
export class BackgroundMain {
  private config: BackgroundServiceConfig;
  private initStatus: ServiceInitStatus = 'pending';
  private subsystems = new Map<string, unknown>();
  private health = new Map<string, SubsystemHealth>();
  private stats: BackgroundServiceStats;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private startTime = Date.now();
  private restartCount = 0;

  // Core subsystem instances
  private startupManager?: StartupManager;
  private statePersistence?: StatePersistenceManager;
  private suspensionHandler?: SuspensionHandler;
  private lifecycleCoordinator?: LifecycleCoordinator;
  private jobQueueManager?: JobQueueManager;
  private jobCoordinator?: JobCoordinator;
  private jobTracker?: JobTracker;
  private jobNotificationSystem?: JobNotificationService;
  private messageRouter?: MessageRouter;
  private broadcastManager?: BroadcastManager;
  private syncCoordinator?: SyncCoordinator;
  private connectionManager?: ConnectionManager;
  private clientCoordinator?: AzureClientCoordinator;
  private rateLimitManager?: RateLimitManager;
  private apiCoordinator?: APICoordinator;
  private errorHandler?: AzureErrorHandler;
  private storageCoordinator?: StorageCoordinator;
  private quotaManager?: QuotaManager;
  private batchProcessor?: BatchProcessor;
  private conflictResolver?: ConflictResolver;
  private performanceMonitor?: PerformanceMonitor;
  private errorAggregator?: ErrorAggregator;

  constructor(config: Partial<BackgroundServiceConfig> = {}) {
    this.config = {
      enablePerformanceMonitoring: true,
      enableErrorAggregation: true,
      enableJobOrchestration: true,
      enableAzureIntegration: true,
      enableStorageCoordination: true,
      enableMessagingCoordination: true,
      healthCheckInterval: 30000, // 30 seconds
      recovery: {
        enableAutoRecovery: true,
        maxRetryAttempts: 3,
        recoveryDelay: 5000, // 5 seconds
      },
      debug: {
        enableDebugLogging: false,
        logPerformanceMetrics: false,
        logSubsystemStatus: false,
      },
      ...config,
    };

    this.stats = this.initializeStats();
  }

  /**
   * Initialize background service
   */
  async initialize(): Promise<void> {
    console.log('[BackgroundMain] Initializing background service');

    this.initStatus = 'initializing';

    try {
      // Initialize monitoring subsystems first
      await this.initializeMonitoring();

      // Initialize core lifecycle subsystems
      await this.initializeLifecycle();

      // Initialize storage subsystems
      if (this.config.enableStorageCoordination) {
        await this.initializeStorage();
      }

      // Initialize messaging subsystems
      if (this.config.enableMessagingCoordination) {
        await this.initializeMessaging();
      }

      // Initialize job orchestration subsystems
      if (this.config.enableJobOrchestration) {
        await this.initializeJobOrchestration();
      }

      // Initialize Azure integration subsystems
      if (this.config.enableAzureIntegration) {
        await this.initializeAzureIntegration();
      }

      // Start health monitoring
      this.startHealthMonitoring();

      // Register service worker event handlers
      this.registerEventHandlers();

      this.initStatus = 'ready';
      console.log('[BackgroundMain] Background service initialized successfully');

      // Update statistics
      this.updateStats();
    } catch (error) {
      this.initStatus = 'error';
      console.error('[BackgroundMain] Failed to initialize background service:', error);

      if (this.errorAggregator) {
        await this.errorAggregator.recordError(error as Error, {
          severity: 'critical',
          category: 'runtime',
          source: 'background',
        });
      }

      throw error;
    }
  }

  /**
   * Get service initialization status
   */
  getInitStatus(): ServiceInitStatus {
    return this.initStatus;
  }

  /**
   * Get subsystem health status
   */
  getSubsystemHealth(): SubsystemHealth[] {
    return Array.from(this.health.values());
  }

  /**
   * Get service statistics
   */
  getStats(): BackgroundServiceStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Get subsystem instance
   */
  getSubsystem<T>(name: string): T | undefined {
    return this.subsystems.get(name) as T;
  }

  /**
   * Update service configuration
   */
  async updateConfig(config: Partial<BackgroundServiceConfig>): Promise<void> {
    console.log('[BackgroundMain] Updating configuration');

    const previousConfig = { ...this.config };
    this.config = { ...this.config, ...config };

    try {
      // Handle configuration changes that require subsystem updates
      if (previousConfig.enablePerformanceMonitoring !== this.config.enablePerformanceMonitoring) {
        if (this.config.enablePerformanceMonitoring && !this.performanceMonitor) {
          await this.initializePerformanceMonitoring();
        } else if (!this.config.enablePerformanceMonitoring && this.performanceMonitor) {
          await this.performanceMonitor.shutdown();
          this.subsystems.delete('performanceMonitor');
          this.health.delete('performanceMonitor');
        }
      }

      if (previousConfig.enableErrorAggregation !== this.config.enableErrorAggregation) {
        if (this.config.enableErrorAggregation && !this.errorAggregator) {
          await this.initializeErrorAggregation();
        } else if (!this.config.enableErrorAggregation && this.errorAggregator) {
          await this.errorAggregator.shutdown();
          this.subsystems.delete('errorAggregator');
          this.health.delete('errorAggregator');
        }
      }

      // Update health check interval
      if (previousConfig.healthCheckInterval !== this.config.healthCheckInterval) {
        this.restartHealthMonitoring();
      }

      console.log('[BackgroundMain] Configuration updated successfully');
    } catch (error) {
      console.error('[BackgroundMain] Failed to update configuration:', error);

      if (this.errorAggregator) {
        await this.errorAggregator.recordError(error as Error, {
          severity: 'high',
          category: 'runtime',
          source: 'background',
        });
      }

      throw error;
    }
  }

  /**
   * Restart background service
   */
  async restart(): Promise<void> {
    console.log('[BackgroundMain] Restarting background service');

    try {
      // Shutdown current service
      await this.shutdown();

      // Reset state
      this.initStatus = 'pending';
      this.subsystems.clear();
      this.health.clear();
      this.restartCount++;

      // Reinitialize
      await this.initialize();

      console.log('[BackgroundMain] Background service restarted successfully');
    } catch (error) {
      console.error('[BackgroundMain] Failed to restart background service:', error);
      throw error;
    }
  }

  /**
   * Shutdown background service
   */
  async shutdown(): Promise<void> {
    console.log('[BackgroundMain] Shutting down background service');

    this.initStatus = 'shutdown';

    // Stop health monitoring
    this.stopHealthMonitoring();

    // Shutdown subsystems in reverse order
    const subsystemNames = [
      'errorAggregator',
      'performanceMonitor',
      'conflictResolver',
      'batchProcessor',
      'quotaManager',
      'storageCoordinator',
      'errorHandler',
      'apiCoordinator',
      'rateLimitManager',
      'clientCoordinator',
      'connectionManager',
      'syncCoordinator',
      'broadcastManager',
      'messageRouter',
      'jobNotificationSystem',
      'jobTracker',
      'jobCoordinator',
      'jobQueueManager',
      'lifecycleCoordinator',
      'suspensionHandler',
      'statePersistence',
      'startupManager',
    ];

    for (const name of subsystemNames) {
      const subsystem = this.subsystems.get(name);
      if (subsystem && typeof subsystem.shutdown === 'function') {
        try {
          await subsystem.shutdown();
          console.log(`[BackgroundMain] ${name} shutdown completed`);
        } catch (error) {
          console.warn(`[BackgroundMain] Failed to shutdown ${name}:`, error);
        }
      }
    }

    this.subsystems.clear();
    this.health.clear();

    console.log('[BackgroundMain] Background service shutdown completed');
  }

  /**
   * Initialize monitoring subsystems
   */
  private async initializeMonitoring(): Promise<void> {
    if (this.config.enableErrorAggregation) {
      await this.initializeErrorAggregation();
    }

    if (this.config.enablePerformanceMonitoring) {
      await this.initializePerformanceMonitoring();
    }
  }

  /**
   * Initialize error aggregation
   */
  private async initializeErrorAggregation(): Promise<void> {
    console.log('[BackgroundMain] Initializing error aggregation');

    this.errorAggregator = new ErrorAggregator({
      enabled: true,
      autoReporting: true,
      enablePatternDetection: true,
      enableContextCollection: true,
    });

    this.subsystems.set('errorAggregator', this.errorAggregator);
    this.updateSubsystemHealth('errorAggregator', 'healthy');
  }

  /**
   * Initialize performance monitoring
   */
  private async initializePerformanceMonitoring(): Promise<void> {
    console.log('[BackgroundMain] Initializing performance monitoring');

    this.performanceMonitor = new PerformanceMonitor({
      enabled: true,
      enableAutoOptimization: true,
      enableAlerts: true,
    });

    this.subsystems.set('performanceMonitor', this.performanceMonitor);
    this.updateSubsystemHealth('performanceMonitor', 'healthy');
  }

  /**
   * Initialize lifecycle subsystems
   */
  private async initializeLifecycle(): Promise<void> {
    console.log('[BackgroundMain] Initializing lifecycle subsystems');

    // Initialize startup manager
    this.startupManager = new StartupManager();
    this.subsystems.set('startupManager', this.startupManager);
    this.updateSubsystemHealth('startupManager', 'healthy');

    // Initialize state persistence
    this.statePersistence = new StatePersistenceManager();
    this.subsystems.set('statePersistence', this.statePersistence);
    this.updateSubsystemHealth('statePersistence', 'healthy');

    // Initialize suspension handler
    this.suspensionHandler = new SuspensionHandler();
    this.subsystems.set('suspensionHandler', this.suspensionHandler);
    this.updateSubsystemHealth('suspensionHandler', 'healthy');

    // Initialize lifecycle coordinator
    this.lifecycleCoordinator = new LifecycleCoordinator({
      startupManager: this.startupManager,
      statePersistence: this.statePersistence,
      suspensionHandler: this.suspensionHandler,
    });
    this.subsystems.set('lifecycleCoordinator', this.lifecycleCoordinator);
    this.updateSubsystemHealth('lifecycleCoordinator', 'healthy');
  }

  /**
   * Initialize storage subsystems
   */
  private async initializeStorage(): Promise<void> {
    console.log('[BackgroundMain] Initializing storage subsystems');

    // Initialize storage coordinator
    this.storageCoordinator = new StorageCoordinator();
    this.subsystems.set('storageCoordinator', this.storageCoordinator);
    this.updateSubsystemHealth('storageCoordinator', 'healthy');

    // Initialize quota manager
    this.quotaManager = new QuotaManager();
    this.subsystems.set('quotaManager', this.quotaManager);
    this.updateSubsystemHealth('quotaManager', 'healthy');

    // Initialize batch processor
    this.batchProcessor = new BatchProcessor();
    this.subsystems.set('batchProcessor', this.batchProcessor);
    this.updateSubsystemHealth('batchProcessor', 'healthy');

    // Initialize conflict resolver
    this.conflictResolver = new ConflictResolver();
    this.subsystems.set('conflictResolver', this.conflictResolver);
    this.updateSubsystemHealth('conflictResolver', 'healthy');
  }

  /**
   * Initialize messaging subsystems
   */
  private async initializeMessaging(): Promise<void> {
    console.log('[BackgroundMain] Initializing messaging subsystems');

    // Initialize message router
    this.messageRouter = new MessageRouter();
    this.subsystems.set('messageRouter', this.messageRouter);
    this.updateSubsystemHealth('messageRouter', 'healthy');

    // Initialize broadcast manager
    this.broadcastManager = new BroadcastManager(this.messageRouter);
    this.subsystems.set('broadcastManager', this.broadcastManager);
    this.updateSubsystemHealth('broadcastManager', 'healthy');

    // Initialize sync coordinator
    this.syncCoordinator = new SyncCoordinator(this.broadcastManager);
    this.subsystems.set('syncCoordinator', this.syncCoordinator);
    this.updateSubsystemHealth('syncCoordinator', 'healthy');

    // Initialize connection manager
    this.connectionManager = new ConnectionManager(this.messageRouter);
    this.subsystems.set('connectionManager', this.connectionManager);
    this.updateSubsystemHealth('connectionManager', 'healthy');
  }

  /**
   * Initialize job orchestration subsystems
   */
  private async initializeJobOrchestration(): Promise<void> {
    console.log('[BackgroundMain] Initializing job orchestration subsystems');

    // Initialize job queue manager
    this.jobQueueManager = new JobQueueManager();
    this.subsystems.set('jobQueueManager', this.jobQueueManager);
    this.updateSubsystemHealth('jobQueueManager', 'healthy');

    // Initialize job coordinator
    this.jobCoordinator = new JobCoordinator(this.jobQueueManager);
    this.subsystems.set('jobCoordinator', this.jobCoordinator);
    this.updateSubsystemHealth('jobCoordinator', 'healthy');

    // Initialize job tracker
    this.jobTracker = new JobTracker();
    this.subsystems.set('jobTracker', this.jobTracker);
    this.updateSubsystemHealth('jobTracker', 'healthy');

    // Initialize job notification system
    this.jobNotificationSystem = new JobNotificationService(this.broadcastManager);
    this.subsystems.set('jobNotificationSystem', this.jobNotificationSystem);
    this.updateSubsystemHealth('jobNotificationSystem', 'healthy');
  }

  /**
   * Initialize Azure integration subsystems
   */
  private async initializeAzureIntegration(): Promise<void> {
    console.log('[BackgroundMain] Initializing Azure integration subsystems');

    // Initialize client coordinator
    this.clientCoordinator = new AzureClientCoordinator();
    this.subsystems.set('clientCoordinator', this.clientCoordinator);
    this.updateSubsystemHealth('clientCoordinator', 'healthy');

    // Initialize rate limit manager
    this.rateLimitManager = new RateLimitManager();
    this.subsystems.set('rateLimitManager', this.rateLimitManager);
    this.updateSubsystemHealth('rateLimitManager', 'healthy');

    // Initialize API coordinator
    this.apiCoordinator = new APICoordinator(this.rateLimitManager);
    this.subsystems.set('apiCoordinator', this.apiCoordinator);
    this.updateSubsystemHealth('apiCoordinator', 'healthy');

    // Initialize error handler
    this.errorHandler = new AzureErrorHandler();
    this.subsystems.set('errorHandler', this.errorHandler);
    this.updateSubsystemHealth('errorHandler', 'healthy');
  }

  /**
   * Register service worker event handlers
   */
  private registerEventHandlers(): void {
    console.log('[BackgroundMain] Registering event handlers');

    // Handle extension startup
    chrome.runtime.onStartup.addListener(() => {
      console.log('[BackgroundMain] Extension startup detected');
      this.handleExtensionStartup();
    });

    // Handle extension installation
    chrome.runtime.onInstalled.addListener(details => {
      console.log('[BackgroundMain] Extension installed/updated:', details.reason);
      this.handleExtensionInstalled(details);
    });

    // Handle service worker suspension
    chrome.runtime.onSuspend.addListener(() => {
      console.log('[BackgroundMain] Service worker suspension detected');
      this.handleSuspension();
    });

    // Handle messages from other extension components
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async response
    });

    // Handle connection requests
    chrome.runtime.onConnect.addListener(port => {
      console.log('[BackgroundMain] Connection established:', port.name);
      this.handleConnection(port);
    });
  }

  /**
   * Handle extension startup
   */
  private async handleExtensionStartup(): Promise<void> {
    try {
      if (this.startupManager) {
        await this.startupManager.handleStartup();
      }

      if (this.performanceMonitor) {
        this.performanceMonitor.recordMetric({
          type: 'execution',
          name: 'extension_startup',
          value: 1,
          unit: 'count',
          tags: {
            event: 'startup',
            component: 'background',
          },
          metadata: {
            source: 'background-main',
            context: 'extension_lifecycle',
          },
        });
      }
    } catch (error) {
      console.error('[BackgroundMain] Failed to handle extension startup:', error);

      if (this.errorAggregator) {
        await this.errorAggregator.recordError(error as Error, {
          severity: 'high',
          category: 'runtime',
          source: 'background',
        });
      }
    }
  }

  /**
   * Handle extension installation/update
   */
  private async handleExtensionInstalled(details: chrome.runtime.InstalledDetails): Promise<void> {
    try {
      if (this.startupManager) {
        await this.startupManager.handleInstallation(details);
      }

      if (this.performanceMonitor) {
        this.performanceMonitor.recordMetric({
          type: 'execution',
          name: 'extension_installed',
          value: 1,
          unit: 'count',
          tags: {
            reason: details.reason,
            component: 'background',
          },
          metadata: {
            source: 'background-main',
            context: 'extension_lifecycle',
          },
        });
      }
    } catch (error) {
      console.error('[BackgroundMain] Failed to handle extension installation:', error);

      if (this.errorAggregator) {
        await this.errorAggregator.recordError(error as Error, {
          severity: 'medium',
          category: 'runtime',
          source: 'background',
        });
      }
    }
  }

  /**
   * Handle service worker suspension
   */
  private async handleSuspension(): Promise<void> {
    try {
      console.log('[BackgroundMain] Handling service worker suspension');

      if (this.suspensionHandler) {
        await this.suspensionHandler.handleSuspension();
      }

      if (this.statePersistence) {
        await this.statePersistence.persistState();
      }
    } catch (error) {
      console.error('[BackgroundMain] Failed to handle suspension:', error);
    }
  }

  /**
   * Handle message from extension components
   */
  private async handleMessage(
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ): Promise<void> {
    try {
      if (this.messageRouter) {
        const response = await this.messageRouter.routeMessage(message, sender);
        sendResponse(response);
      } else {
        sendResponse({ error: 'Message router not available' });
      }
    } catch (error) {
      console.error('[BackgroundMain] Failed to handle message:', error);
      sendResponse({ error: 'Message handling failed' });

      if (this.errorAggregator) {
        await this.errorAggregator.recordError(error as Error, {
          severity: 'medium',
          category: 'runtime',
          source: 'background',
        });
      }
    }
  }

  /**
   * Handle connection from extension components
   */
  private handleConnection(port: chrome.runtime.Port): void {
    try {
      if (this.connectionManager) {
        this.connectionManager.handleConnection(port);
      }
    } catch (error) {
      console.error('[BackgroundMain] Failed to handle connection:', error);

      if (this.errorAggregator) {
        this.errorAggregator.recordError(error as Error, {
          severity: 'medium',
          category: 'runtime',
          source: 'background',
        });
      }
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      return;
    }

    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);

    console.log('[BackgroundMain] Health monitoring started');
  }

  /**
   * Stop health monitoring
   */
  private stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      console.log('[BackgroundMain] Health monitoring stopped');
    }
  }

  /**
   * Restart health monitoring
   */
  private restartHealthMonitoring(): void {
    this.stopHealthMonitoring();
    this.startHealthMonitoring();
  }

  /**
   * Perform health check on all subsystems
   */
  private async performHealthCheck(): Promise<void> {
    if (this.config.debug.logSubsystemStatus) {
      console.log('[BackgroundMain] Performing health check');
    }

    for (const [name, subsystem] of this.subsystems.entries()) {
      try {
        const health = await this.checkSubsystemHealth(name, subsystem);
        this.health.set(name, health);

        // Handle unhealthy subsystems
        if (health.status === 'unhealthy' && this.config.recovery.enableAutoRecovery) {
          await this.attemptSubsystemRecovery(name, subsystem);
        }
      } catch (error) {
        console.warn(`[BackgroundMain] Health check failed for ${name}:`, error);
        this.updateSubsystemHealth(name, 'unhealthy', [`Health check failed: ${error}`]);
      }
    }

    this.updateStats();
  }

  /**
   * Check health of individual subsystem
   */
  private async checkSubsystemHealth(name: string, subsystem: unknown): Promise<SubsystemHealth> {
    const startTime = Date.now();

    try {
      // Check if subsystem has health check method
      let status: SubsystemHealth['status'] = 'healthy';
      const issues: string[] = [];

      if (typeof subsystem.getStats === 'function') {
        const stats = subsystem.getStats();

        // Analyze stats for health indicators
        if (stats.errorRate && stats.errorRate > 10) {
          status = 'degraded';
          issues.push(`High error rate: ${stats.errorRate}%`);
        }

        if (stats.responseTime && stats.responseTime > 5000) {
          status = 'degraded';
          issues.push(`High response time: ${stats.responseTime}ms`);
        }
      }

      const responseTime = Date.now() - startTime;

      return {
        name,
        status,
        lastCheck: new Date().toISOString(),
        metrics: {
          uptime: 100, // Would need more sophisticated tracking
          responseTime,
          errorRate: 0, // Would need error tracking per subsystem
          memoryUsage: 0, // Would need memory tracking per subsystem
        },
        issues: issues.length > 0 ? issues : undefined,
      };
    } catch (error) {
      return {
        name,
        status: 'unhealthy',
        lastCheck: new Date().toISOString(),
        metrics: {
          uptime: 0,
          responseTime: Date.now() - startTime,
          errorRate: 100,
          memoryUsage: 0,
        },
        issues: [`Health check error: ${error}`],
      };
    }
  }

  /**
   * Attempt to recover unhealthy subsystem
   */
  private async attemptSubsystemRecovery(name: string, subsystem: unknown): Promise<void> {
    console.warn(`[BackgroundMain] Attempting recovery for unhealthy subsystem: ${name}`);

    try {
      // Try restart if subsystem supports it
      if (typeof subsystem.restart === 'function') {
        await subsystem.restart();
        this.updateSubsystemHealth(name, 'healthy');
        console.log(`[BackgroundMain] Successfully recovered subsystem: ${name}`);
      }
    } catch (error) {
      console.error(`[BackgroundMain] Failed to recover subsystem ${name}:`, error);

      if (this.errorAggregator) {
        await this.errorAggregator.recordError(error as Error, {
          severity: 'high',
          category: 'runtime',
          source: 'background',
        });
      }
    }
  }

  /**
   * Update subsystem health status
   */
  private updateSubsystemHealth(name: string, status: SubsystemHealth['status'], issues?: string[]): void {
    const health: SubsystemHealth = {
      name,
      status,
      lastCheck: new Date().toISOString(),
      metrics: {
        uptime: status === 'healthy' ? 100 : status === 'degraded' ? 75 : 0,
        responseTime: 0,
        errorRate: 0,
        memoryUsage: 0,
      },
      issues,
    };

    this.health.set(name, health);
  }

  /**
   * Update service statistics
   */
  private updateStats(): void {
    const now = Date.now();
    this.stats.uptime = now - this.startTime;
    this.stats.restartCount = this.restartCount;

    // Update subsystem counts
    let healthy = 0;
    let degraded = 0;
    let unhealthy = 0;
    let offline = 0;

    for (const health of this.health.values()) {
      switch (health.status) {
        case 'healthy':
          healthy++;
          break;
        case 'degraded':
          degraded++;
          break;
        case 'unhealthy':
          unhealthy++;
          break;
        case 'offline':
          offline++;
          break;
      }
    }

    this.stats.subsystems = {
      total: this.subsystems.size,
      healthy,
      degraded,
      unhealthy,
      offline,
    };

    this.stats.lastUpdate = new Date().toISOString();
  }

  /**
   * Initialize service statistics
   */
  private initializeStats(): BackgroundServiceStats {
    return {
      startTime: new Date().toISOString(),
      uptime: 0,
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      restartCount: 0,
      subsystems: {
        total: 0,
        healthy: 0,
        degraded: 0,
        unhealthy: 0,
        offline: 0,
      },
      lastUpdate: new Date().toISOString(),
    };
  }
}
