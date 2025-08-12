/**
 * Error types and recovery strategies for Azure Speech API integration
 * Provides comprehensive error handling types for robust transcription services
 * Based on Azure Cognitive Services error patterns and recovery best practices
 */

/**
 * Error category classification
 */
export enum ErrorCategory {
  /** Authentication and authorization errors */
  AUTHENTICATION = 'authentication',
  /** Network connectivity and timeout errors */
  NETWORK = 'network',
  /** API quota and rate limiting errors */
  QUOTA = 'quota',
  /** Audio file format and accessibility errors */
  AUDIO = 'audio',
  /** Azure service availability errors */
  SERVICE = 'service',
  /** Configuration and setup errors */
  CONFIGURATION = 'configuration',
  /** Unknown or unclassified errors */
  UNKNOWN = 'unknown',
}

/**
 * Specific transcription error types
 */
export enum TranscriptionErrorType {
  // Authentication errors
  INVALID_SUBSCRIPTION_KEY = 'INVALID_SUBSCRIPTION_KEY',
  EXPIRED_SUBSCRIPTION = 'EXPIRED_SUBSCRIPTION',
  INVALID_REGION = 'INVALID_REGION',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',

  // Network errors
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  DNS_RESOLUTION_FAILED = 'DNS_RESOLUTION_FAILED',
  SSL_CERTIFICATE_ERROR = 'SSL_CERTIFICATE_ERROR',

  // Quota errors
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  CONCURRENT_REQUEST_LIMIT = 'CONCURRENT_REQUEST_LIMIT',
  MONTHLY_USAGE_EXCEEDED = 'MONTHLY_USAGE_EXCEEDED',

  // Audio errors
  INVALID_AUDIO_URL = 'INVALID_AUDIO_URL',
  AUDIO_FORMAT_UNSUPPORTED = 'AUDIO_FORMAT_UNSUPPORTED',
  AUDIO_FILE_TOO_LARGE = 'AUDIO_FILE_TOO_LARGE',
  AUDIO_FILE_CORRUPTED = 'AUDIO_FILE_CORRUPTED',
  AUDIO_DURATION_TOO_LONG = 'AUDIO_DURATION_TOO_LONG',
  AUDIO_INACCESSIBLE = 'AUDIO_INACCESSIBLE',

  // Service errors
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_MAINTENANCE = 'SERVICE_MAINTENANCE',
  TEMPORARY_FAILURE = 'TEMPORARY_FAILURE',

  // Configuration errors
  INVALID_LANGUAGE = 'INVALID_LANGUAGE',
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION',
  MISSING_REQUIRED_PARAMETER = 'MISSING_REQUIRED_PARAMETER',

  // Processing errors
  TRANSCRIPTION_FAILED = 'TRANSCRIPTION_FAILED',
  JOB_TIMEOUT = 'JOB_TIMEOUT',
  JOB_CANCELLED = 'JOB_CANCELLED',
  RESULT_NOT_AVAILABLE = 'RESULT_NOT_AVAILABLE',

  // Unknown errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Retry strategy options
 */
export enum RetryStrategy {
  /** No retry attempt */
  NONE = 'none',
  /** Immediate retry */
  IMMEDIATE = 'immediate',
  /** Fixed delay retry */
  FIXED_DELAY = 'fixed_delay',
  /** Exponential backoff retry */
  EXPONENTIAL_BACKOFF = 'exponential_backoff',
  /** Linear backoff retry */
  LINEAR_BACKOFF = 'linear_backoff',
  /** Custom retry logic */
  CUSTOM = 'custom',
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  /** Low severity - warning level */
  LOW = 'low',
  /** Medium severity - error level */
  MEDIUM = 'medium',
  /** High severity - critical error */
  HIGH = 'high',
  /** Critical severity - system failure */
  CRITICAL = 'critical',
}

/**
 * Transcription error interface
 */
export interface TranscriptionError extends Error {
  /** Error type classification */
  type: TranscriptionErrorType;
  /** Error category */
  category: ErrorCategory;
  /** Human-readable error message */
  message: string;
  /** Error name (inherited from Error interface) */
  name: string;
  /** Technical error details */
  details?: {
    /** HTTP status code */
    statusCode?: number;
    /** Azure error code */
    azureErrorCode?: string;
    /** Request ID for tracking */
    requestId?: string;
    /** Correlation ID */
    correlationId?: string;
    /** Stack trace (development only) */
    stackTrace?: string;
    /** Additional context */
    context?: Record<string, unknown>;
  };
  /** Whether this error can be retried */
  retryable: boolean;
  /** Recommended retry strategy */
  retryStrategy: RetryStrategy;
  /** Suggested retry delay in milliseconds */
  retryAfter?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Error severity level */
  severity: ErrorSeverity;
  /** Error timestamp */
  timestamp: Date;
  /** Recovery suggestions */
  recoverySuggestions?: string[];
  /** Whether to notify user */
  notifyUser: boolean;
}

/**
 * Error recovery configuration
 */
export interface ErrorRecoveryConfig {
  /** Enable automatic retry */
  enableRetry: boolean;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Base retry delay in milliseconds */
  baseDelay: number;
  /** Maximum retry delay in milliseconds */
  maxDelay: number;
  /** Exponential backoff multiplier */
  backoffMultiplier: number;
  /** Jitter factor for randomization */
  jitterFactor: number;
  /** Circuit breaker configuration */
  circuitBreaker: {
    /** Enable circuit breaker */
    enabled: boolean;
    /** Failure threshold to open circuit */
    failureThreshold: number;
    /** Success threshold to close circuit */
    successThreshold: number;
    /** Timeout before trying again (ms) */
    timeout: number;
  };
  /** Error categorization rules */
  errorRules: ErrorRecoveryRule[];
}

/**
 * Error recovery rule
 */
export interface ErrorRecoveryRule {
  /** Error types this rule applies to */
  errorTypes: TranscriptionErrorType[];
  /** Error categories this rule applies to */
  categories: ErrorCategory[];
  /** Recovery strategy to use */
  strategy: RetryStrategy;
  /** Override retry configuration */
  retryConfig?: {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
  };
  /** Custom recovery function */
  customRecovery?: string; // Function name reference
  /** Stop retry conditions */
  stopConditions?: {
    /** Stop after this many consecutive failures */
    maxConsecutiveFailures: number;
    /** Stop after this total time (ms) */
    maxTotalTime: number;
    /** Stop on specific error types */
    stopOnErrors: TranscriptionErrorType[];
  };
}

/**
 * Circuit breaker states
 */
export enum CircuitBreakerState {
  /** Circuit is closed - normal operation */
  CLOSED = 'closed',
  /** Circuit is open - blocking requests */
  OPEN = 'open',
  /** Circuit is half-open - testing recovery */
  HALF_OPEN = 'half_open',
}

/**
 * Circuit breaker status
 */
export interface CircuitBreakerStatus {
  /** Current circuit state */
  state: CircuitBreakerState;
  /** Failure count */
  failureCount: number;
  /** Success count */
  successCount: number;
  /** Last failure time */
  lastFailureTime?: Date;
  /** Last success time */
  lastSuccessTime?: Date;
  /** Next retry time */
  nextRetryTime?: Date;
  /** Circuit metrics */
  metrics: {
    /** Total requests */
    totalRequests: number;
    /** Failed requests */
    failedRequests: number;
    /** Success rate percentage */
    successRate: number;
    /** Average response time */
    averageResponseTime: number;
  };
}

/**
 * Error context information
 */
export interface ErrorContext {
  /** Request context */
  request: {
    /** Request ID */
    id: string;
    /** Request URL */
    url?: string;
    /** Request method */
    method?: string;
    /** Request headers (sanitized) */
    headers?: Record<string, string>;
    /** Request timestamp */
    timestamp: Date;
  };
  /** User context */
  user: {
    /** Session ID */
    sessionId: string;
    /** User agent */
    userAgent?: string;
    /** Browser version */
    browserVersion?: string;
  };
  /** System context */
  system: {
    /** Extension version */
    extensionVersion: string;
    /** Azure SDK version */
    azureSdkVersion?: string;
    /** Operating system */
    platform?: string;
  };
  /** Job context */
  job?: {
    /** Job ID */
    jobId: string;
    /** Audio URL */
    audioUrl: string;
    /** Configuration used */
    config: Record<string, unknown>;
    /** Retry attempt number */
    retryAttempt: number;
  };
}

/**
 * Error analysis result
 */
export interface ErrorAnalysis {
  /** Analyzed error */
  error: TranscriptionError;
  /** Root cause analysis */
  rootCause: {
    /** Primary cause category */
    category: ErrorCategory;
    /** Confidence in analysis (0-1) */
    confidence: number;
    /** Contributing factors */
    factors: string[];
    /** Recommended actions */
    recommendations: string[];
  };
  /** Similar error patterns */
  patterns: {
    /** Pattern frequency */
    frequency: number;
    /** Pattern description */
    description: string;
    /** Success rate for this pattern */
    successRate: number;
  }[];
  /** Recovery probability */
  recoveryProbability: number;
  /** Estimated recovery time */
  estimatedRecoveryTime?: number;
}

/**
 * Error notification configuration
 */
export interface ErrorNotificationConfig {
  /** Enable user notifications */
  enabled: boolean;
  /** Severity threshold for notifications */
  severityThreshold: ErrorSeverity;
  /** Notification frequency limits */
  frequency: {
    /** Maximum notifications per hour */
    maxPerHour: number;
    /** Minimum time between notifications (ms) */
    minInterval: number;
    /** Cool-down period after errors resolved (ms) */
    coolDownPeriod: number;
  };
  /** Notification channels */
  channels: {
    /** Browser notifications */
    browser: boolean;
    /** Console logging */
    console: boolean;
    /** Badge notifications */
    badge: boolean;
  };
  /** Message templates */
  templates: {
    /** Template for each error type */
    [key in TranscriptionErrorType]?: {
      title: string;
      message: string;
      actions?: string[];
    };
  };
}

/**
 * Error metrics interface
 */
export interface ErrorMetrics {
  /** Total error count */
  totalErrors: number;
  /** Errors by category */
  byCategory: Record<ErrorCategory, number>;
  /** Errors by type */
  byType: Record<TranscriptionErrorType, number>;
  /** Error rate (errors per request) */
  errorRate: number;
  /** Recovery success rate */
  recoveryRate: number;
  /** Average time to recovery */
  averageRecoveryTime: number;
  /** Time window for these metrics */
  timeWindow: {
    start: Date;
    end: Date;
  };
}

/**
 * Error event for logging and analytics
 */
export interface ErrorEvent {
  /** Event ID */
  id: string;
  /** Event type */
  type: 'error_occurred' | 'error_recovered' | 'error_escalated' | 'circuit_opened' | 'circuit_closed';
  /** Associated error */
  error: TranscriptionError;
  /** Event context */
  context: ErrorContext;
  /** Event timestamp */
  timestamp: Date;
  /** Recovery attempts made */
  recoveryAttempts: number;
  /** Whether error was resolved */
  resolved: boolean;
  /** Resolution time (if resolved) */
  resolutionTime?: number;
}
