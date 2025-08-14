/**
 * Service Worker startup manager
 * Handles Service Worker initialization, subsystem startup, and state restoration
 */

import type {
  ServiceWorkerState,
  ServiceWorkerStatus,
  StartupConfig,
  InitializationResult,
  ServiceWorkerError,
  LifecycleEvent,
} from '../types';

/**
 * Subsystem initialization interface
 */
export interface SubsystemInitializer {
  /** Subsystem name */
  name: string;
  /** Dependencies required before initialization */
  dependencies: string[];
  /** Whether subsystem is critical for operation */
  critical: boolean;
  /** Initialization function */
  initialize: (config: StartupConfig) => Promise<void>;
  /** Health check function */
  healthCheck: () => Promise<boolean>;
  /** Cleanup function for shutdown */
  cleanup?: () => Promise<void>;
}

/**
 * Startup manager for Service Worker initialization
 */
export class StartupManager {
  private state: ServiceWorkerState;
  private config: StartupConfig;
  private subsystems: Map<string, SubsystemInitializer> = new Map();
  private initializationPromise: Promise<InitializationResult> | null = null;
  private startupTimeout: NodeJS.Timeout | null = null;

  constructor(config: StartupConfig) {
    this.config = config;
    this.state = this.createInitialState();
  }

  /**
   * Register a subsystem for initialization
   */
  registerSubsystem(subsystem: SubsystemInitializer): void {
    this.subsystems.set(subsystem.name, subsystem);

    // Initialize subsystem status tracking
    this.state.subsystems.set(subsystem.name, {
      name: subsystem.name,
      status: 'inactive',
      dependencies: subsystem.dependencies,
      critical: subsystem.critical,
    });

    if (this.config.debug.verbose) {
      console.log(`[StartupManager] Registered subsystem: ${subsystem.name}`);
    }
  }

  /**
   * Initialize all registered subsystems
   */
  async initialize(): Promise<InitializationResult> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization();
    return this.initializationPromise;
  }

  /**
   * Get current Service Worker state
   */
  getState(): ServiceWorkerState {
    return { ...this.state };
  }

  /**
   * Update startup configuration
   */
  updateConfig(config: Partial<StartupConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Perform the actual initialization process
   */
  private async performInitialization(): Promise<InitializationResult> {
    const startTime = Date.now();
    const result: InitializationResult = {
      success: false,
      duration: 0,
      initializedSubsystems: [],
      failedSubsystems: [],
      warnings: [],
      finalState: this.state,
    };

    try {
      // Set startup timeout if configured
      if (this.config.maxStartupTime > 0) {
        this.startupTimeout = setTimeout(() => {
          throw new Error(`Startup timeout exceeded: ${this.config.maxStartupTime}ms`);
        }, this.config.maxStartupTime);
      }

      // Update state to initializing
      this.updateServiceWorkerStatus('initializing');
      this.logLifecycleEvent('startup');

      // Restore state if enabled
      if (this.config.enableStateRestoration) {
        await this.restorePersistedState();
      }

      // Initialize subsystems in dependency order
      const initializationOrder = this.calculateInitializationOrder();

      for (const subsystemName of initializationOrder) {
        try {
          await this.initializeSubsystem(subsystemName);
          result.initializedSubsystems.push(subsystemName);
        } catch (error) {
          const subsystem = this.subsystems.get(subsystemName);
          const initError = this.createSubsystemError(subsystemName, error);

          result.failedSubsystems.push({
            name: subsystemName,
            error: initError,
          });

          // If critical subsystem failed, abort initialization
          if (subsystem?.critical) {
            throw new Error(`Critical subsystem failed: ${subsystemName}`);
          }

          result.warnings.push(`Non-critical subsystem failed: ${subsystemName}`);
        }
      }

      // Check if enough subsystems initialized successfully
      const criticalSubsystems = Array.from(this.subsystems.values()).filter(s => s.critical);
      const initializedCritical = criticalSubsystems.filter(s => result.initializedSubsystems.includes(s.name));

      if (initializedCritical.length < criticalSubsystems.length) {
        throw new Error('Not enough critical subsystems initialized');
      }

      // Update final state
      this.updateServiceWorkerStatus('active');
      this.state.lastHeartbeat = new Date().toISOString();

      // Start performance monitoring if enabled
      if (this.config.enablePerformanceMonitoring) {
        this.startPerformanceMonitoring();
      }

      result.success = true;
      result.duration = Date.now() - startTime;
      result.finalState = { ...this.state };

      if (this.config.debug.verbose) {
        console.log(`[StartupManager] Initialization completed in ${result.duration}ms`);
      }

      this.logLifecycleEvent('activate');
    } catch (error) {
      this.updateServiceWorkerStatus('error');
      this.addError(this.createInitializationError(error));

      result.success = false;
      result.duration = Date.now() - startTime;
      result.finalState = { ...this.state };

      console.error('[StartupManager] Initialization failed:', error);
    } finally {
      if (this.startupTimeout) {
        clearTimeout(this.startupTimeout);
        this.startupTimeout = null;
      }
    }

    return result;
  }

  /**
   * Initialize a specific subsystem
   */
  private async initializeSubsystem(name: string): Promise<void> {
    const subsystem = this.subsystems.get(name);
    if (!subsystem) {
      throw new Error(`Subsystem not found: ${name}`);
    }

    // Update subsystem status
    const status = this.state.subsystems.get(name);
    if (status) {
      status.status = 'initializing';
    }

    if (this.config.debug.verbose) {
      console.log(`[StartupManager] Initializing subsystem: ${name}`);
    }

    try {
      await subsystem.initialize(this.config);

      // Update status on success
      if (status) {
        status.status = 'active';
        status.initializedAt = new Date().toISOString();
      }

      if (this.config.debug.verbose) {
        console.log(`[StartupManager] Subsystem initialized: ${name}`);
      }
    } catch (error) {
      // Update status on failure
      if (status) {
        status.status = 'error';
        status.lastError = this.createSubsystemError(name, error);
      }
      throw error;
    }
  }

  /**
   * Calculate subsystem initialization order based on dependencies
   */
  private calculateInitializationOrder(): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: string[] = [];

    const visit = (name: string): void => {
      if (visited.has(name)) return;
      if (visiting.has(name)) {
        throw new Error(`Circular dependency detected involving: ${name}`);
      }

      visiting.add(name);

      const subsystem = this.subsystems.get(name);
      if (subsystem) {
        for (const dependency of subsystem.dependencies) {
          if (this.subsystems.has(dependency)) {
            visit(dependency);
          }
        }
      }

      visiting.delete(name);
      visited.add(name);
      order.push(name);
    };

    for (const name of this.subsystems.keys()) {
      visit(name);
    }

    return order;
  }

  /**
   * Restore persisted state from storage
   */
  private async restorePersistedState(): Promise<void> {
    try {
      // This would integrate with the storage system
      // For now, we'll just log the attempt
      if (this.config.debug.verbose) {
        console.log('[StartupManager] Attempting to restore persisted state');
      }

      // TODO: Integrate with storage package to restore:
      // - Job queues
      // - Configuration
      // - Suspended operations
      // - Error history

      this.state.restoredJobs = 0; // Placeholder
    } catch (error) {
      console.warn('[StartupManager] Failed to restore persisted state:', error);
    }
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    if (!this.config.enablePerformanceMonitoring) return;

    // Start performance metrics collection
    setInterval(() => {
      this.updatePerformanceMetrics();
    }, 30000); // Update every 30 seconds

    if (this.config.debug.logPerformance) {
      console.log('[StartupManager] Performance monitoring started');
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(): void {
    const metrics = this.state.performanceMetrics;

    // Update basic metrics
    metrics.lastUpdated = new Date().toISOString();

    // Get memory usage if available
    if ('performance' in globalThis && 'memory' in performance) {
      const memory = (performance as { memory: { usedJSHeapSize: number } }).memory;
      metrics.memoryUsageMB = memory.usedJSHeapSize / 1024 / 1024;
    }

    // Update other metrics would require integration with:
    // - Job orchestration for active connections and pending jobs
    // - Message router for messages per second
    // - Error aggregator for error rate
  }

  /**
   * Create initial Service Worker state
   */
  private createInitialState(): ServiceWorkerState {
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
        version: chrome.runtime.getManifest().version,
        installedAt: new Date().toISOString(),
        installReason: 'install',
      },
    };
  }

  /**
   * Update Service Worker status
   */
  private updateServiceWorkerStatus(status: ServiceWorkerStatus): void {
    this.state.status = status;
    this.state.lastHeartbeat = new Date().toISOString();
  }

  /**
   * Log lifecycle event
   */
  private logLifecycleEvent(event: LifecycleEvent): void {
    if (this.config.debug.logLifecycle) {
      console.log(`[StartupManager] Lifecycle event: ${event}`);
    }
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
   * Create subsystem error
   */
  private createSubsystemError(subsystemName: string, error: unknown): ServiceWorkerError {
    return {
      id: `subsystem-${subsystemName}-${Date.now()}`,
      type: 'lifecycle',
      severity: 'high',
      message: `Subsystem initialization failed: ${subsystemName}`,
      details: error,
      timestamp: new Date().toISOString(),
      stack: error instanceof Error ? error.stack : undefined,
      source: 'StartupManager',
      requiresAttention: true,
      recoverySuggestions: ['Check subsystem dependencies', 'Verify configuration settings', 'Restart the extension'],
    };
  }

  /**
   * Create initialization error
   */
  private createInitializationError(error: unknown): ServiceWorkerError {
    return {
      id: `initialization-${Date.now()}`,
      type: 'lifecycle',
      severity: 'critical',
      message: 'Service Worker initialization failed',
      details: error,
      timestamp: new Date().toISOString(),
      stack: error instanceof Error ? error.stack : undefined,
      source: 'StartupManager',
      requiresAttention: true,
      recoverySuggestions: [
        'Check extension permissions',
        'Verify Chrome version compatibility',
        'Clear extension storage',
        'Reinstall the extension',
      ],
    };
  }
}
