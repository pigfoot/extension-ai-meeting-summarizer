/**
 * Service Worker types for background service management and coordination
 * Provides type safety for Chrome Extension v3 Service Worker operations
 */

/**
 * Service Worker lifecycle events
 */
export type LifecycleEvent =
  | 'startup' // Service Worker is starting up
  | 'install' // Extension is being installed
  | 'activate' // Service Worker is being activated
  | 'suspend' // Service Worker is going idle
  | 'wakeup' // Service Worker is waking from idle
  | 'shutdown' // Service Worker is shutting down
  | 'error'; // Lifecycle error occurred

/**
 * Service Worker operational status
 */
export type ServiceWorkerStatus =
  | 'initializing' // Service Worker is starting up
  | 'active' // Service Worker is running normally
  | 'idle' // Service Worker is idle but ready
  | 'suspended' // Service Worker is suspended
  | 'error' // Service Worker encountered an error
  | 'terminating'; // Service Worker is shutting down

/**
 * Resource usage limits for Service Worker operations
 */
export interface ResourceLimits {
  /** Maximum memory usage in MB */
  maxMemoryMB: number;
  /** Maximum concurrent jobs */
  maxConcurrentJobs: number;
  /** Maximum API calls per minute */
  maxAPICallsPerMinute: number;
  /** Storage quota threshold (0-1) */
  storageQuotaThreshold: number;
  /** CPU usage threshold (0-1) */
  cpuUsageThreshold: number;
}

/**
 * Performance metrics for Service Worker monitoring
 */
export interface PerformanceMetrics {
  /** Current memory usage in MB */
  memoryUsageMB: number;
  /** CPU usage percentage (0-1) */
  cpuUsage: number;
  /** Number of active connections */
  activeConnections: number;
  /** Number of pending jobs */
  pendingJobs: number;
  /** Average response time in milliseconds */
  averageResponseTime: number;
  /** Messages processed per second */
  messagesPerSecond: number;
  /** Error rate (0-1) */
  errorRate: number;
  /** Last performance update timestamp (ISO 8601) */
  lastUpdated: string;
}

/**
 * Service Worker startup configuration
 */
export interface StartupConfig {
  /** Enable state restoration from storage */
  enableStateRestoration: boolean;
  /** Maximum startup time in milliseconds */
  maxStartupTime: number;
  /** Enable performance monitoring */
  enablePerformanceMonitoring: boolean;
  /** Resource limits configuration */
  resourceLimits: ResourceLimits;
  /** Enable automatic error recovery */
  enableAutoRecovery: boolean;
  /** Debug mode settings */
  debug: {
    /** Enable verbose logging */
    verbose: boolean;
    /** Log performance metrics */
    logPerformance: boolean;
    /** Log lifecycle events */
    logLifecycle: boolean;
  };
}

/**
 * Error information for Service Worker operations
 */
export interface ServiceWorkerError {
  /** Error identifier */
  id: string;
  /** Error type classification */
  type: 'lifecycle' | 'memory' | 'storage' | 'network' | 'api' | 'unknown';
  /** Error severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Error message */
  message: string;
  /** Error details */
  details?: unknown;
  /** Error timestamp (ISO 8601) */
  timestamp: string;
  /** Stack trace if available */
  stack?: string;
  /** Component that generated the error */
  source: string;
  /** Whether error requires immediate attention */
  requiresAttention: boolean;
  /** Recovery suggestions */
  recoverySuggestions?: string[];
}

/**
 * Component connection information
 */
export interface Connection {
  /** Connection identifier */
  id: string;
  /** Component type */
  type: 'content_script' | 'popup' | 'options' | 'devtools' | 'sidepanel';
  /** Tab ID for content scripts */
  tabId?: number;
  /** Window ID for extension pages */
  windowId?: number;
  /** Connection establishment timestamp (ISO 8601) */
  connectedAt: string;
  /** Last activity timestamp (ISO 8601) */
  lastActivity: string;
  /** Whether connection is active */
  active: boolean;
  /** Connection-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Service Worker subsystem status
 */
export interface SubsystemStatus {
  /** Subsystem name */
  name: string;
  /** Current status */
  status: 'inactive' | 'initializing' | 'active' | 'error' | 'suspended';
  /** Initialization timestamp (ISO 8601) */
  initializedAt?: string;
  /** Last error if any */
  lastError?: ServiceWorkerError;
  /** Subsystem-specific health metrics */
  healthMetrics?: Record<string, number>;
  /** Dependencies on other subsystems */
  dependencies: string[];
  /** Whether subsystem is critical for operation */
  critical: boolean;
}

/**
 * Comprehensive Service Worker state
 */
export interface ServiceWorkerState {
  /** Service Worker startup timestamp (ISO 8601) */
  startupTime: string;
  /** Current operational status */
  status: ServiceWorkerStatus;
  /** Last heartbeat timestamp (ISO 8601) */
  lastHeartbeat: string;
  /** Number of suspension cycles */
  suspensionCount: number;
  /** Number of jobs restored from storage */
  restoredJobs: number;
  /** Active component connections */
  activeConnections: Map<string, Connection>;
  /** Current performance metrics */
  performanceMetrics: PerformanceMetrics;
  /** Error log entries */
  errorLog: ServiceWorkerError[];
  /** Current configuration version */
  configVersion: string;
  /** Subsystem status tracking */
  subsystems: Map<string, SubsystemStatus>;
  /** Service Worker capabilities */
  capabilities: {
    /** Whether Service Worker supports background sync */
    backgroundSync: boolean;
    /** Whether notifications are supported */
    notifications: boolean;
    /** Whether storage sync is available */
    storageSync: boolean;
    /** Whether IndexedDB is available */
    indexedDB: boolean;
    /** Whether WebAssembly is supported */
    webAssembly: boolean;
  };
  /** Extension installation and update information */
  extensionInfo: {
    /** Extension version */
    version: string;
    /** Installation timestamp (ISO 8601) */
    installedAt: string;
    /** Last update timestamp (ISO 8601) */
    lastUpdated?: string;
    /** Installation reason */
    installReason: 'install' | 'update' | 'chrome_update' | 'shared_module_update';
  };
}

/**
 * State serialization configuration for persistence
 */
export interface StateSerializationConfig {
  /** Fields to include in serialization */
  includeFields: Array<keyof ServiceWorkerState>;
  /** Fields to exclude from serialization */
  excludeFields: Array<keyof ServiceWorkerState>;
  /** Enable compression for serialized state */
  enableCompression: boolean;
  /** Maximum serialized state size in bytes */
  maxSerializedSize: number;
  /** Encryption settings for sensitive data */
  encryption?: {
    /** Enable encryption for serialized state */
    enabled: boolean;
    /** Encryption algorithm to use */
    algorithm: 'AES-GCM' | 'AES-CBC';
    /** Key derivation settings */
    keyDerivation: {
      iterations: number;
      saltLength: number;
    };
  };
}

/**
 * Lifecycle event handler configuration
 */
export interface LifecycleEventHandler {
  /** Event type this handler responds to */
  event: LifecycleEvent;
  /** Handler priority (higher numbers execute first) */
  priority: number;
  /** Handler function */
  handler: (event: LifecycleEventData) => Promise<void> | void;
  /** Whether handler is required for successful event processing */
  required: boolean;
  /** Maximum execution time in milliseconds */
  timeout: number;
  /** Error handling strategy */
  errorHandling: 'ignore' | 'log' | 'retry' | 'fail';
}

/**
 * Lifecycle event data passed to handlers
 */
export interface LifecycleEventData {
  /** Event type */
  event: LifecycleEvent;
  /** Event timestamp (ISO 8601) */
  timestamp: string;
  /** Previous Service Worker status */
  previousStatus: ServiceWorkerStatus;
  /** Current Service Worker status */
  currentStatus: ServiceWorkerStatus;
  /** Event-specific data */
  data?: Record<string, unknown>;
  /** Whether this is a forced event (e.g., forced shutdown) */
  forced: boolean;
  /** Event source (browser, extension, user action) */
  source: 'browser' | 'extension' | 'user' | 'system';
}

/**
 * Health check configuration and results
 */
export interface HealthCheck {
  /** Health check identifier */
  id: string;
  /** Check description */
  description: string;
  /** Check interval in milliseconds */
  interval: number;
  /** Check timeout in milliseconds */
  timeout: number;
  /** Whether check is critical for operation */
  critical: boolean;
  /** Last check timestamp (ISO 8601) */
  lastCheck?: string;
  /** Last check result */
  lastResult?: {
    /** Whether check passed */
    passed: boolean;
    /** Check duration in milliseconds */
    duration: number;
    /** Check result message */
    message?: string;
    /** Additional check data */
    data?: Record<string, unknown>;
  };
  /** Check execution function */
  execute: () => Promise<{ passed: boolean; message?: string; data?: Record<string, unknown> }>;
}

/**
 * Service Worker recovery strategy
 */
export interface RecoveryStrategy {
  /** Strategy identifier */
  id: string;
  /** Error types this strategy can handle */
  errorTypes: ServiceWorkerError['type'][];
  /** Error severity levels this strategy applies to */
  severityLevels: ServiceWorkerError['severity'][];
  /** Maximum number of recovery attempts */
  maxAttempts: number;
  /** Delay between recovery attempts in milliseconds */
  retryDelay: number;
  /** Recovery execution function */
  execute: (error: ServiceWorkerError, attempt: number) => Promise<boolean>;
  /** Whether to reset error counters on successful recovery */
  resetOnSuccess: boolean;
}

/**
 * Service Worker initialization result
 */
export interface InitializationResult {
  /** Whether initialization was successful */
  success: boolean;
  /** Initialization duration in milliseconds */
  duration: number;
  /** Initialized subsystems */
  initializedSubsystems: string[];
  /** Failed subsystems */
  failedSubsystems: Array<{
    name: string;
    error: ServiceWorkerError;
  }>;
  /** Warning messages during initialization */
  warnings: string[];
  /** Final Service Worker state after initialization */
  finalState: ServiceWorkerState;
}
