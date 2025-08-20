/**
 * Authentication types for Azure Speech API integration
 * Handles credential management, token lifecycle, and authentication security
 * Based on Azure Cognitive Services authentication patterns
 */

import type { AzureRegion } from './index';

/**
 * Authentication configuration interface
 */
export interface AuthConfig {
  /** Azure subscription key */
  subscriptionKey: string;
  /** Azure service region */
  serviceRegion: AzureRegion;
  /** Custom endpoint URL (optional) */
  endpoint?: string;
  /** Token refresh interval in milliseconds */
  tokenRefreshInterval?: number;
  /** Enable automatic token refresh */
  autoRefresh?: boolean;
}

/**
 * Authentication token information
 */
export interface TokenInfo {
  /** Access token value */
  token: string;
  /** Token type (e.g., 'Bearer') */
  tokenType: string;
  /** Token expiration time */
  expiresAt: Date;
  /** Token issue time */
  issuedAt: Date;
  /** Token scope */
  scope?: string;
  /** Refresh token (if applicable) */
  refreshToken?: string;
}

/**
 * Authentication error types
 */
export type AuthenticationErrorType =
  | 'INVALID_SUBSCRIPTION_KEY'
  | 'INVALID_REGION'
  | 'EXPIRED_TOKEN'
  | 'NETWORK_ERROR'
  | 'QUOTA_EXCEEDED'
  | 'FORBIDDEN'
  | 'UNAUTHORIZED'
  | 'SERVICE_UNAVAILABLE'
  | 'TIMEOUT'
  | 'UNKNOWN_ERROR';

/**
 * Authentication error interface
 */
export interface AuthenticationError {
  /** Error type classification */
  type: AuthenticationErrorType;
  /** Human-readable error message */
  message: string;
  /** HTTP status code (if applicable) */
  statusCode?: number;
  /** Detailed error information */
  details?: {
    /** Azure error code */
    azureErrorCode?: string;
    /** Request ID for tracking */
    requestId?: string;
    /** Correlation ID */
    correlationId?: string;
    /** Additional error context */
    context?: Record<string, unknown>;
  };
  /** Whether this error is retryable */
  retryable: boolean;
  /** Suggested retry delay in milliseconds */
  retryAfter?: number;
  /** Error timestamp */
  timestamp: Date;
}

/**
 * Credential validation result
 */
export interface CredentialValidationResult {
  /** Whether credentials are valid */
  isValid: boolean;
  /** Validation errors (if any) */
  errors: AuthenticationError[];
  /** Validation warnings */
  warnings: string[];
  /** Validated region */
  validatedRegion?: AzureRegion;
  /** Validation timestamp */
  validatedAt: Date;
  /** Quota information */
  quotaInfo?: {
    /** Current usage */
    usage: number;
    /** Usage limit */
    limit: number;
    /** Reset period */
    resetPeriod: string;
  };
}

/**
 * Token refresh result
 */
export interface TokenRefreshResult {
  /** Whether refresh was successful */
  success: boolean;
  /** New token information */
  tokenInfo?: TokenInfo;
  /** Refresh error (if any) */
  error?: AuthenticationError;
  /** Time until next refresh */
  nextRefreshIn?: number;
}

/**
 * Authentication status
 */
export type AuthenticationStatus =
  | 'not_configured'
  | 'configuring'
  | 'authenticated'
  | 'expired'
  | 'error'
  | 'refreshing';

/**
 * Authentication state interface
 */
export interface AuthenticationState {
  /** Current authentication status */
  status: AuthenticationStatus;
  /** Current token information */
  tokenInfo?: TokenInfo;
  /** Authentication configuration */
  config?: AuthConfig;
  /** Last authentication error */
  lastError?: AuthenticationError;
  /** Next token refresh time */
  nextRefresh?: Date;
  /** Authentication metrics */
  metrics: {
    /** Total authentication attempts */
    totalAttempts: number;
    /** Successful authentications */
    successfulAuth: number;
    /** Failed authentications */
    failedAuth: number;
    /** Last successful authentication */
    lastSuccess?: Date;
    /** Average response time */
    averageResponseTime: number;
  };
}

/**
 * Health check result for authentication
 */
export interface HealthCheckResult {
  /** Whether service is healthy */
  isHealthy: boolean;
  /** Response time in milliseconds */
  responseTime: number;
  /** Health check timestamp */
  timestamp: Date;
  /** Service endpoints checked */
  endpoints: {
    /** Endpoint URL */
    url: string;
    /** Endpoint status */
    status: 'healthy' | 'unhealthy' | 'timeout';
    /** Response time for this endpoint */
    responseTime: number;
  }[];
  /** Overall service status */
  serviceStatus: 'operational' | 'degraded' | 'outage';
  /** Health check errors */
  errors: AuthenticationError[];
}

/**
 * Credential rotation configuration
 */
export interface CredentialRotationConfig {
  /** Enable automatic rotation */
  enabled: boolean;
  /** Rotation interval in days */
  rotationInterval: number;
  /** Warning period before expiration (days) */
  warningPeriod: number;
  /** Backup subscription key */
  backupKey?: string;
  /** Notification preferences */
  notifications: {
    /** Email notifications */
    email?: string;
    /** Webhook URL for notifications */
    webhook?: string;
  };
}

/**
 * Authentication event types
 */
export type AuthenticationEventType =
  | 'authentication_success'
  | 'authentication_failure'
  | 'token_refresh_success'
  | 'token_refresh_failure'
  | 'credential_rotation'
  | 'quota_warning'
  | 'quota_exceeded'
  | 'service_health_check';

/**
 * Authentication event interface
 */
export interface AuthenticationEvent {
  /** Event type */
  type: AuthenticationEventType;
  /** Event timestamp */
  timestamp: Date;
  /** Event message */
  message: string;
  /** Event metadata */
  metadata?: Record<string, unknown>;
  /** Associated error (if any) */
  error?: AuthenticationError;
  /** Request context */
  context: {
    /** User agent */
    userAgent?: string;
    /** Request ID */
    requestId: string;
    /** Session ID */
    sessionId?: string;
  };
}

/**
 * API key validation options
 */
export interface ApiKeyValidationOptions {
  /** Test endpoint connectivity */
  testConnectivity: boolean;
  /** Validate region availability */
  validateRegion: boolean;
  /** Check quota limits */
  checkQuota: boolean;
  /** Timeout for validation (ms) */
  timeout: number;
  /** Skip cache for fresh validation */
  skipCache: boolean;
}

/**
 * Authentication manager configuration
 */
export interface AuthManagerConfig {
  /** Authentication configuration */
  authConfig: AuthConfig;
  /** Token refresh settings */
  tokenRefresh: {
    /** Enable automatic refresh */
    enabled: boolean;
    /** Refresh interval (ms) */
    interval: number;
    /** Refresh before expiry (ms) */
    beforeExpiry: number;
  };
  /** Retry configuration */
  retry: {
    /** Maximum retry attempts */
    maxAttempts: number;
    /** Base delay between retries (ms) */
    baseDelay: number;
    /** Maximum delay between retries (ms) */
    maxDelay: number;
    /** Exponential backoff multiplier */
    backoffMultiplier: number;
  };
  /** Health check configuration */
  healthCheck: {
    /** Enable health checks */
    enabled: boolean;
    /** Health check interval (ms) */
    interval: number;
    /** Health check timeout (ms) */
    timeout: number;
  };
}

/**
 * Token validation result
 */
export interface TokenValidationResult {
  /** Whether token is valid */
  isValid: boolean;
  /** Whether token is expired */
  isExpired: boolean;
  /** Time until expiration (ms) */
  timeUntilExpiry?: number;
  /** Validation errors */
  errors: string[];
  /** Token claims (if available) */
  claims?: Record<string, unknown>;
}
