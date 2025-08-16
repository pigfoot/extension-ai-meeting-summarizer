/**
 * Background service main coordination
 * Implements central coordination for all background services and subsystems
 */

import { APICoordinator } from '../azure/api-coordinator';
import { AzureClientCoordinator } from '../azure/client-coordinator';
import { AzureErrorHandler } from '../azure/error-handler';
import { RateLimitManager } from '../azure/rate-limit-manager';
import { JobCoordinator } from '../jobs/job-coordinator';
import { JobNotificationService } from '../jobs/job-notifications';
import { JobQueueManager } from '../jobs/job-queue-manager';
import { JobTracker } from '../jobs/job-tracker';
import { LifecycleCoordinator } from '../lifecycle/lifecycle-coordinator';
import { StartupManager } from '../lifecycle/startup-manager';
import { StatePersistenceManager } from '../lifecycle/state-persistence';
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
import { analysisOrchestrator, pageMonitor } from '@extension/meeting-detector';
import type { AzureSpeechConfig } from '@extension/azure-speech';

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

      // Initialize content detection services
      await this.initializeContentDetection();

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
   * Get comprehensive integration status
   */
  async getIntegrationStatus(): Promise<{
    azureSpeech: {
      configured: boolean;
      initialized: boolean;
      healthy: boolean;
      issues: string[];
    };
    contentDetection: {
      available: boolean;
      healthy: boolean;
      issues: string[];
    };
    transcriptionFlow: {
      ready: boolean;
      issues: string[];
    };
    overallStatus: 'ready' | 'degraded' | 'offline';
    lastCheck: string;
  }> {
    try {
      // Check Azure Speech status
      const azureStatus = await this.getAzureConfigurationStatus();
      const jobCoordinator = this.getSubsystem<JobCoordinator>('jobCoordinator');

      const azureSpeech = {
        configured: azureStatus.configured,
        initialized: jobCoordinator?.isAzureSpeechAvailable() || false,
        healthy: azureStatus.valid && (jobCoordinator?.isAzureSpeechAvailable() || false),
        issues: azureStatus.issues,
      };

      // Check content detection status
      const contentStatus = await this.getContentDetectionStatus();
      const contentDetection = {
        available: contentStatus.available,
        healthy: contentStatus.healthy,
        issues: contentStatus.issues,
      };

      // Check overall transcription flow readiness
      const transcriptionReady = azureSpeech.healthy && contentDetection.healthy;
      const transcriptionIssues: string[] = [];

      if (!azureSpeech.configured) {
        transcriptionIssues.push('Azure Speech not configured');
      }
      if (!azureSpeech.initialized) {
        transcriptionIssues.push('Azure Speech service not initialized');
      }
      if (!contentDetection.available) {
        transcriptionIssues.push('Content detection services not available');
      }
      if (!contentDetection.healthy) {
        transcriptionIssues.push('Content detection services unhealthy');
      }

      // Determine overall status
      let overallStatus: 'ready' | 'degraded' | 'offline';
      if (transcriptionReady) {
        overallStatus = 'ready';
      } else if (azureSpeech.configured || contentDetection.available) {
        overallStatus = 'degraded';
      } else {
        overallStatus = 'offline';
      }

      return {
        azureSpeech,
        contentDetection,
        transcriptionFlow: {
          ready: transcriptionReady,
          issues: transcriptionIssues,
        },
        overallStatus,
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[BackgroundMain] Failed to get integration status:', error);
      return {
        azureSpeech: {
          configured: false,
          initialized: false,
          healthy: false,
          issues: ['Status check failed'],
        },
        contentDetection: {
          available: false,
          healthy: false,
          issues: ['Status check failed'],
        },
        transcriptionFlow: {
          ready: false,
          issues: ['Status check failed'],
        },
        overallStatus: 'offline',
        lastCheck: new Date().toISOString(),
      };
    }
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
   * Load Azure Speech configuration from storage
   */
  private async loadAzureConfiguration(): Promise<AzureSpeechConfig | null> {
    try {

      // Load from chrome.storage.sync for cross-device synchronization
      const result = await chrome.storage.sync.get(['azureSpeechConfig']);

      if (!result.azureSpeechConfig) {
        console.warn('[BackgroundMain] No Azure Speech configuration found in storage');
        return null;
      }

      const config = result.azureSpeechConfig as AzureSpeechConfig;

      // Validate required configuration fields
      if (!config.subscriptionKey || !config.serviceRegion) {
        console.error('[BackgroundMain] Azure Speech configuration missing required fields:', {
          hasSubscriptionKey: !!config.subscriptionKey,
          hasServiceRegion: !!config.serviceRegion,
        });
        return null;
      }

      return config;
    } catch (error) {
      console.error('[BackgroundMain] Failed to load Azure Speech configuration:', error);

      if (this.errorAggregator) {
        await this.errorAggregator.recordError(error as Error, {
          severity: 'medium',
          category: 'configuration',
          source: 'background',
        });
      }

      return null;
    }
  }

  /**
   * Validate Azure Speech configuration
   */
  private validateAzureConfiguration(config: AzureSpeechConfig): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check required fields
    if (!config.subscriptionKey) {
      issues.push('Azure Speech subscription key is required');
    } else if (typeof config.subscriptionKey !== 'string' || config.subscriptionKey.length < 20) {
      issues.push('Azure Speech subscription key appears to be invalid');
    }

    if (!config.serviceRegion) {
      issues.push('Azure Speech service region is required');
    } else if (typeof config.serviceRegion !== 'string' || !/^[a-z]+[a-z0-9]*$/.test(config.serviceRegion)) {
      issues.push('Azure Speech service region format is invalid');
    }

    // Check optional fields if provided
    if (config.endpoint && (typeof config.endpoint !== 'string' || !config.endpoint.startsWith('https://'))) {
      issues.push('Azure Speech endpoint must be a valid HTTPS URL');
    }

    if (config.language && typeof config.language !== 'string') {
      issues.push('Azure Speech language must be a string');
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Get Azure Speech configuration status
   */
  async getAzureConfigurationStatus(): Promise<{
    configured: boolean;
    valid: boolean;
    issues: string[];
    lastCheck: string;
  }> {
    try {
      const config = await this.loadAzureConfiguration();

      if (!config) {
        return {
          configured: false,
          valid: false,
          issues: ['No Azure Speech configuration found'],
          lastCheck: new Date().toISOString(),
        };
      }

      const validation = this.validateAzureConfiguration(config);

      return {
        configured: true,
        valid: validation.valid,
        issues: validation.issues,
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      return {
        configured: false,
        valid: false,
        issues: [`Configuration check failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        lastCheck: new Date().toISOString(),
      };
    }
  }

  /**
   * Update service configuration
   */
  async updateConfig(config: Partial<BackgroundServiceConfig>): Promise<void> {

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

    } catch (error) {
      console.error('[BackgroundMain] Failed to restart background service:', error);
      throw error;
    }
  }

  /**
   * Shutdown background service
   */
  async shutdown(): Promise<void> {

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
        } catch (error) {
          console.warn(`[BackgroundMain] Failed to shutdown ${name}:`, error);
        }
      }
    }

    this.subsystems.clear();
    this.health.clear();

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

    this.performanceMonitor = new PerformanceMonitor({
      enabled: true,
      monitoringInterval: 60000, // 1 minute
      metricCollectionInterval: 15000, // 15 seconds
      thresholds: {
        memory: {
          warning: 100, // 100MB
          critical: 200, // 200MB
          emergency: 300, // 300MB
        },
        cpu: {
          warning: 70, // 70%
          critical: 85, // 85%
          emergency: 95, // 95%
        },
        responseTime: {
          warning: 1000, // 1 second
          critical: 3000, // 3 seconds
          emergency: 5000, // 5 seconds
        },
        errorRate: {
          warning: 5, // 5%
          critical: 10, // 10%
          emergency: 20, // 20%
        },
      },
      enableAutoOptimization: true,
      enableAlerts: true,
      alertCooldown: 300000, // 5 minutes
      metricRetention: 86400000, // 24 hours
      enableAdvancedMetrics: true,
    });

    this.subsystems.set('performanceMonitor', this.performanceMonitor);
    this.updateSubsystemHealth('performanceMonitor', 'healthy');
  }

  /**
   * Initialize lifecycle subsystems
   */
  private async initializeLifecycle(): Promise<void> {

    // Initialize startup manager
    this.startupManager = new StartupManager({
      enableStateRestoration: true,
      maxStartupTime: 30000,
      enablePerformanceMonitoring: true,
      resourceLimits: {
        maxMemoryMB: 200,
        maxConcurrentJobs: 10,
        maxAPICallsPerMinute: 100,
        storageQuotaThreshold: 0.8,
        cpuUsageThreshold: 0.8,
      },
      enableAutoRecovery: true,
      debug: {
        verbose: process.env.NODE_ENV === 'development',
        logPerformance: process.env.NODE_ENV === 'development',
        logLifecycle: process.env.NODE_ENV === 'development',
      },
    });
    this.subsystems.set('startupManager', this.startupManager);
    this.updateSubsystemHealth('startupManager', 'healthy');

    // Initialize state persistence
    this.statePersistence = new StatePersistenceManager({
      includeFields: [],
      excludeFields: [],
      enableCompression: true,
      maxSerializedSize: 1024 * 1024, // 1MB
    });
    this.subsystems.set('statePersistence', this.statePersistence);
    this.updateSubsystemHealth('statePersistence', 'healthy');

    // Initialize suspension handler
    this.suspensionHandler = new SuspensionHandler(this.statePersistence, {
      cleanupTimeout: 5000,
      preserveSessionData: true,
      cleanupStrategies: {},
    });
    this.subsystems.set('suspensionHandler', this.suspensionHandler);
    this.updateSubsystemHealth('suspensionHandler', 'healthy');

    // Initialize lifecycle coordinator
    this.lifecycleCoordinator = new LifecycleCoordinator({
      startup: {
        subsystems: [],
        sequentialStartup: true,
        startupTimeout: 30000,
        enableProgressReporting: true,
      },
      serialization: {
        includeFields: [],
        excludeFields: [],
        enableCompression: true,
        maxSerializedSize: 1024 * 1024, // 1MB
      },
      cleanup: {
        cleanupTimeout: 5000,
        preserveSessionData: true,
        cleanupStrategies: {},
      },
      healthMonitoring: {
        enabled: true,
        checkInterval: 30000,
        checkTimeout: 5000,
        autoRecovery: true,
      },
      eventHandling: {
        enableLogging: process.env.NODE_ENV === 'development',
        maxHandlersPerEvent: 10,
        handlerTimeout: 5000,
      },
    });
    this.subsystems.set('lifecycleCoordinator', this.lifecycleCoordinator);
    this.updateSubsystemHealth('lifecycleCoordinator', 'healthy');
  }

  /**
   * Initialize storage subsystems
   */
  private async initializeStorage(): Promise<void> {

    // Initialize storage coordinator
    this.storageCoordinator = new StorageCoordinator();
    this.subsystems.set('storageCoordinator', this.storageCoordinator);
    this.updateSubsystemHealth('storageCoordinator', 'healthy');

    // Initialize quota manager
    this.quotaManager = new QuotaManager(
      {
        warning: 70, // 70% usage warning
        critical: 85, // 85% usage critical
        emergency: 95, // 95% usage emergency
        aggressive: 90, // 90% usage aggressive cleanup
      },
      {
        enabled: true,
        showWarnings: true,
        showCritical: true,
        showCleanupResults: true,
        displayDuration: 5000, // 5 seconds
        cooldownPeriod: 300000, // 5 minutes between notifications
      },
    );
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

    // Initialize message router
    this.messageRouter = new MessageRouter({
      performance: {
        enablePrioritization: true,
        queueSizeLimit: 1000,
        processingInterval: 100,
        batchSize: 50,
      },
      security: {
        enableEncryption: false,
        enableSignatureValidation: false,
        trustedOrigins: [],
      },
      reliability: {
        enableRetries: true,
        maxRetryAttempts: 3,
        retryDelay: 1000,
        enableDeadLetterQueue: true,
      },
      monitoring: {
        enableMetrics: true,
        enableLogging: process.env.NODE_ENV === 'development',
        logLevel: 'info',
      },
      rateLimiting: {
        enabled: true,
        maxRequestsPerMinute: 1000,
        windowSize: 60000,
      },
    });

    // Set reference to this BackgroundMain instance for cross-service communication
    this.messageRouter.setBackgroundMain(this);

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
    this.connectionManager = new ConnectionManager({
      heartbeatInterval: 30000, // 30 seconds
      connectionTimeout: 10000, // 10 seconds
      maxRetryAttempts: 3,
      retryDelay: 2000, // 2 seconds
      autoReconnect: true,
      healthCheck: {
        enabled: true,
        interval: 60000, // 1 minute
        qualityThreshold: 70, // 70%
      },
    });
    this.subsystems.set('connectionManager', this.connectionManager);
    this.updateSubsystemHealth('connectionManager', 'healthy');
  }

  /**
   * Initialize job orchestration subsystems
   */
  private async initializeJobOrchestration(): Promise<void> {

    // Initialize job queue manager
    this.jobQueueManager = new JobQueueManager(
      {
        queueId: 'main-transcription-queue',
        mode: 'priority', // 使用優先級調度
        maxSize: 1000,
        processingLimits: {
          maxConcurrentJobs: 5,
          maxMemoryPerJob: 100, // 100MB per job
          maxTotalMemory: 500, // 500MB total
          maxAPICallsPerMinute: 100,
          maxJobProcessingTime: 300000, // 5 minutes
        },
        persistence: {
          enabled: false, // 暫時禁用持久化
          storageKey: 'transcription-queue',
          interval: 30000, // 30 seconds
        },
        priorityHandling: {
          enablePreemption: true,
          maxWaitTime: 300000, // 5 minutes
          priorityWeights: {
            critical: 10,
            high: 5,
            normal: 2,
            low: 1,
          },
        },
        retryPolicy: {
          enabled: true,
          maxRetries: 3,
          retryDelay: 5000,
          backoffMultiplier: 2,
        },
        monitoring: {
          enabled: true,
          collectMetrics: true,
          alertThresholds: {
            queueSizeWarning: 100,
            queueSizeCritical: 500,
            processingTimeWarning: 60000,
            processingTimeCritical: 300000,
          },
        },
      },
      {
        enabled: true,
        schedulingInterval: 1000,
        batchSize: 3,
        loadBalancing: {
          enabled: true,
          algorithm: 'round-robin',
        },
        resourceManagement: {
          enableResourceTracking: true,
          memoryThreshold: 0.8,
          cpuThreshold: 0.8,
        },
      },
    );
    this.subsystems.set('jobQueueManager', this.jobQueueManager);
    this.updateSubsystemHealth('jobQueueManager', 'healthy');

    // Initialize job tracker first (JobCoordinator needs it)
    this.jobTracker = new JobTracker({
      enableProgressTracking: true,
      progressUpdateInterval: 5000, // 5 seconds
      enableEventLogging: true,
      maxEventsPerJob: 100,
      enablePerformanceMetrics: true,
      timeouts: {
        defaultTimeout: 300000, // 5 minutes
        priorityTimeouts: {
          critical: 600000, // 10 minutes
          high: 450000, // 7.5 minutes
          normal: 300000, // 5 minutes
          low: 180000, // 3 minutes
        },
      },
    });
    this.subsystems.set('jobTracker', this.jobTracker);
    this.updateSubsystemHealth('jobTracker', 'healthy');

    // Initialize job coordinator with all required parameters
    this.jobCoordinator = new JobCoordinator(this.jobQueueManager, this.jobTracker, {
      enabled: true,
      maxConcurrentCalls: 3,
      apiTimeout: 30000, // 30 seconds
      enableRetry: true,
      retry: {
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        exponentialBackoff: true,
      },
      healthCheck: {
        enabled: true,
        interval: 60000, // 1 minute
        timeout: 5000, // 5 seconds
      },
      monitoring: {
        enableMetrics: true,
        metricsInterval: 30000, // 30 seconds
      },
    });
    this.subsystems.set('jobCoordinator', this.jobCoordinator);
    this.updateSubsystemHealth('jobCoordinator', 'healthy');

    // Initialize job notification system
    this.jobNotificationSystem = new JobNotificationService(this.broadcastManager);
    this.subsystems.set('jobNotificationSystem', this.jobNotificationSystem);
    this.updateSubsystemHealth('jobNotificationSystem', 'healthy');
  }

  /**
   * Initialize Azure integration subsystems
   */
  private async initializeAzureIntegration(): Promise<void> {

    // Initialize client coordinator
    this.clientCoordinator = new AzureClientCoordinator({
      maxClients: 5,
      idleTimeout: 300000, // 5 minutes
      enableReuse: true,
      creationTimeout: 10000, // 10 seconds
      healthCheckInterval: 60000, // 1 minute
    });
    this.subsystems.set('clientCoordinator', this.clientCoordinator);
    this.updateSubsystemHealth('clientCoordinator', 'healthy');

    // Initialize rate limit manager
    this.rateLimitManager = new RateLimitManager({
      globalLimits: {
        requestsPerSecond: 10,
        requestsPerMinute: 100,
        requestsPerHour: 1000,
        concurrentRequests: 5,
      },
      perServiceLimits: {
        speechToText: {
          requestsPerSecond: 5,
          requestsPerMinute: 50,
          requestsPerHour: 500,
          concurrentRequests: 3,
        },
        textToSpeech: {
          requestsPerSecond: 3,
          requestsPerMinute: 30,
          requestsPerHour: 300,
          concurrentRequests: 2,
        },
      },
      adaptiveScaling: {
        enabled: true,
        scaleUpThreshold: 0.8,
        scaleDownThreshold: 0.5,
        maxScaleFactor: 2,
        minScaleFactor: 0.1,
      },
      violationHandling: {
        enableRetries: true,
        maxRetries: 3,
        retryDelay: 2000,
        exponentialBackoff: true,
      },
      monitoring: {
        enableMetrics: true,
        enableViolationLogging: true,
        cleanupInterval: 300000, // 5 minutes
      },
    });
    this.subsystems.set('rateLimitManager', this.rateLimitManager);
    this.updateSubsystemHealth('rateLimitManager', 'healthy');

    // Initialize API coordinator
    this.apiCoordinator = new APICoordinator(
      {
        maxConcurrentCalls: 5,
        defaultTimeout: 30000, // 30 seconds
        defaultRetries: 3,
        enableCaching: true,
        cacheSize: 100,
        enableDeduplication: true,
        loadBalancing: 'least_loaded',
        healthCheck: {
          enabled: true,
          interval: 60000, // 1 minute
          timeout: 5000, // 5 seconds
          retryDelay: 2000, // 2 seconds
        },
        circuitBreaker: {
          enabled: true,
          failureThreshold: 5,
          resetTimeout: 60000, // 1 minute
          halfOpenRetries: 2,
        },
        requestDeduplication: {
          enabled: true,
          windowSize: 30000, // 30 seconds
          maxDuplicates: 3,
        },
        priorityHandling: {
          enabled: true,
          urgentQueueSize: 10,
          highQueueSize: 20,
          normalQueueSize: 50,
          lowQueueSize: 100,
        },
      },
      this.rateLimitManager,
      this.clientCoordinator,
    );
    this.subsystems.set('apiCoordinator', this.apiCoordinator);
    this.updateSubsystemHealth('apiCoordinator', 'healthy');

    // Initialize error handler
    this.errorHandler = new AzureErrorHandler({
      enabled: true,
      maxRetries: 3,
      baseDelay: 1000, // 1 second
      maxDelay: 30000, // 30 seconds
      backoffMultiplier: 2,
      jitterEnabled: true,
      retryableErrors: ['network_error', 'timeout', 'rate_limit', 'service_unavailable', 'authentication_expired'],
      circuitBreaker: {
        enabled: true,
        failureThreshold: 5,
        resetTimeout: 60000, // 1 minute
        halfOpenRetries: 2,
      },
      monitoring: {
        enableMetrics: true,
        enableErrorReporting: true,
        aggregationInterval: 60000, // 1 minute
      },
    });
    this.subsystems.set('errorHandler', this.errorHandler);
    this.updateSubsystemHealth('errorHandler', 'healthy');

    // Load Azure Speech configuration and initialize JobCoordinator Azure integration
    await this.initializeJobCoordinatorAzureIntegration();
  }

  /**
   * Initialize content detection services
   */
  private async initializeContentDetection(): Promise<void> {
    try {

      // Initialize analysis orchestrator
      // Note: analysisOrchestrator is a singleton service that manages meeting detection workflows
      try {
        // Verify the service is available and functional
        const healthCheck = await this.performContentDetectionHealthCheck();

        if (healthCheck.healthy) {
          this.updateSubsystemHealth('contentDetection', 'healthy');
          this.subsystems.set('contentDetection', { analysisOrchestrator, pageMonitor });
        } else {
          console.warn(
            '[BackgroundMain] Content detection services initialized but health check failed:',
            healthCheck.issues,
          );
          this.updateSubsystemHealth('contentDetection', 'degraded', healthCheck.issues);
          this.subsystems.set('contentDetection', { analysisOrchestrator, pageMonitor });
        }
      } catch (error) {
        console.error(
          '[BackgroundMain] Content detection services available but initialization verification failed:',
          error,
        );
        this.updateSubsystemHealth('contentDetection', 'degraded', [
          `Initialization verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ]);
        // Still register the services as they may work despite the health check failure
        this.subsystems.set('contentDetection', { analysisOrchestrator, pageMonitor });
      }
    } catch (error) {
      console.error('[BackgroundMain] Failed to initialize content detection services:', error);
      this.updateSubsystemHealth('contentDetection', 'unhealthy', [
        `Service initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ]);

      // Record error for monitoring
      if (this.errorAggregator) {
        await this.errorAggregator.recordError(error as Error, {
          severity: 'medium',
          category: 'service_initialization',
          source: 'background',
        });
      }

      // Don't throw - allow other services to initialize
      console.warn('[BackgroundMain] Continuing initialization without content detection services');
    }
  }

  /**
   * Perform content detection health check
   */
  private async performContentDetectionHealthCheck(): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      // Check if analysis orchestrator is available
      if (!analysisOrchestrator) {
        issues.push('Analysis orchestrator is not available');
      }

      // Check if page monitor is available
      if (!pageMonitor) {
        issues.push('Page monitor is not available');
      }

      // For background service, we can't directly test DOM operations
      // but we can verify the services are properly exported
      if (typeof analysisOrchestrator === 'object' && analysisOrchestrator !== null) {
      } else {
        issues.push('Analysis orchestrator is not properly exported');
      }

      if (typeof pageMonitor === 'object' && pageMonitor !== null) {
      } else {
        issues.push('Page monitor is not properly exported');
      }

      return {
        healthy: issues.length === 0,
        issues,
      };
    } catch (error) {
      issues.push(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        healthy: false,
        issues,
      };
    }
  }

  /**
   * Get content detection service status
   */
  async getContentDetectionStatus(): Promise<{
    available: boolean;
    healthy: boolean;
    issues: string[];
    lastCheck: string;
  }> {
    try {
      const contentDetection = this.subsystems.get('contentDetection');

      if (!contentDetection) {
        return {
          available: false,
          healthy: false,
          issues: ['Content detection services not initialized'],
          lastCheck: new Date().toISOString(),
        };
      }

      const healthCheck = await this.performContentDetectionHealthCheck();

      return {
        available: true,
        healthy: healthCheck.healthy,
        issues: healthCheck.issues,
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      return {
        available: false,
        healthy: false,
        issues: [`Status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        lastCheck: new Date().toISOString(),
      };
    }
  }

  /**
   * Initialize JobCoordinator Azure Speech integration
   */
  private async initializeJobCoordinatorAzureIntegration(): Promise<void> {
    try {

      // Load Azure Speech configuration
      const azureConfig = await this.loadAzureConfiguration();

      if (!azureConfig) {
        console.warn(
          '[BackgroundMain] No Azure Speech configuration available - JobCoordinator will operate without Azure Speech integration',
        );
        this.updateSubsystemHealth('azureSpeechIntegration', 'degraded', ['No Azure Speech configuration found']);
        return;
      }

      // Validate configuration
      const validation = this.validateAzureConfiguration(azureConfig);
      if (!validation.valid) {
        console.error('[BackgroundMain] Invalid Azure Speech configuration:', validation.issues);
        this.updateSubsystemHealth('azureSpeechIntegration', 'unhealthy', validation.issues);
        return;
      }

      // Initialize Azure Speech service in JobCoordinator
      if (this.jobCoordinator) {
        try {
          await this.jobCoordinator.initialize(azureConfig);
          this.updateSubsystemHealth('azureSpeechIntegration', 'healthy');
        } catch (error) {
          console.error('[BackgroundMain] Failed to initialize JobCoordinator Azure Speech integration:', error);
          this.updateSubsystemHealth('azureSpeechIntegration', 'unhealthy', [
            `Azure Speech initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          ]);

          // Record error for monitoring
          if (this.errorAggregator) {
            await this.errorAggregator.recordError(error as Error, {
              severity: 'high',
              category: 'configuration',
              source: 'background',
            });
          }
        }
      } else {
        console.error('[BackgroundMain] JobCoordinator not available for Azure Speech integration');
        this.updateSubsystemHealth('azureSpeechIntegration', 'unhealthy', ['JobCoordinator not initialized']);
      }
    } catch (error) {
      console.error('[BackgroundMain] Failed to initialize JobCoordinator Azure integration:', error);
      this.updateSubsystemHealth('azureSpeechIntegration', 'unhealthy', [
        `Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ]);
    }
  }

  /**
   * Register service worker event handlers
   */
  private registerEventHandlers(): void {

    // Handle extension startup
    chrome.runtime.onStartup.addListener(() => {
      this.handleExtensionStartup();
    });

    // Handle extension installation
    chrome.runtime.onInstalled.addListener(details => {
      this.handleExtensionInstalled(details);
    });

    // Handle service worker suspension
    chrome.runtime.onSuspend.addListener(() => {
      this.handleSuspension();
    });

    // Handle messages from other extension components
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async response
    });

    // Handle connection requests
    chrome.runtime.onConnect.addListener(port => {
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
      // StartupManager initialization is handled separately during service startup

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

  }

  /**
   * Stop health monitoring
   */
  private stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
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

    // Perform integration-specific health checks
    await this.performIntegrationHealthChecks();

    this.updateStats();
  }

  /**
   * Perform health checks for integration services
   */
  private async performIntegrationHealthChecks(): Promise<void> {
    try {
      // Check Azure Speech integration health
      if (this.jobCoordinator) {
        try {
          const azureAvailable = this.jobCoordinator.isAzureSpeechAvailable();
          if (azureAvailable) {
            this.updateSubsystemHealth('azureSpeechIntegration', 'healthy');
          } else {
            // Check if Azure configuration exists
            const azureStatus = await this.getAzureConfigurationStatus();
            if (azureStatus.configured) {
              this.updateSubsystemHealth('azureSpeechIntegration', 'degraded', [
                'Azure Speech service not available despite configuration',
              ]);
            } else {
              this.updateSubsystemHealth('azureSpeechIntegration', 'offline', ['Azure Speech not configured']);
            }
          }
        } catch (error) {
          this.updateSubsystemHealth('azureSpeechIntegration', 'unhealthy', [
            `Azure Speech health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          ]);
        }
      }

      // Check content detection service health
      try {
        const contentStatus = await this.getContentDetectionStatus();
        if (contentStatus.healthy) {
          this.updateSubsystemHealth('contentDetection', 'healthy');
        } else if (contentStatus.available) {
          this.updateSubsystemHealth('contentDetection', 'degraded', contentStatus.issues);
        } else {
          this.updateSubsystemHealth('contentDetection', 'unhealthy', contentStatus.issues);
        }
      } catch (error) {
        this.updateSubsystemHealth('contentDetection', 'unhealthy', [
          `Content detection health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ]);
      }

      // Check overall transcription workflow health
      try {
        const integrationStatus = await this.getIntegrationStatus();
        if (integrationStatus.transcriptionFlow.ready) {
          this.updateSubsystemHealth('transcriptionWorkflow', 'healthy');
        } else if (integrationStatus.overallStatus === 'degraded') {
          this.updateSubsystemHealth('transcriptionWorkflow', 'degraded', integrationStatus.transcriptionFlow.issues);
        } else {
          this.updateSubsystemHealth('transcriptionWorkflow', 'unhealthy', integrationStatus.transcriptionFlow.issues);
        }
      } catch (error) {
        this.updateSubsystemHealth('transcriptionWorkflow', 'unhealthy', [
          `Transcription workflow health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ]);
      }

      if (this.config.debug.logSubsystemStatus) {
        const integrationStatus = await this.getIntegrationStatus();
      }
    } catch (error) {
      console.error('[BackgroundMain] Integration health checks failed:', error);
    }
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
