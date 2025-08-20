/**
 * Azure Speech API token management
 * Handles authentication token lifecycle, automatic renewal, and expiration management
 * Based on Azure Cognitive Services token patterns
 */

import type {
  AuthConfig,
  TokenInfo,
  TokenRefreshResult,
  AuthenticationError,
  AuthenticationErrorType,
  TokenValidationResult,
  AuthenticationStatus,
  AuthenticationEvent,
  AuthenticationEventType,
} from '../types/auth';
import type { AzureRegion } from '../types/index';

/**
 * Token refresh configuration
 */
interface TokenRefreshConfig {
  /** Enable automatic token refresh */
  autoRefresh: boolean;
  /** Refresh interval in milliseconds */
  refreshInterval: number;
  /** Refresh token before expiry (milliseconds) */
  refreshBeforeExpiry: number;
  /** Maximum retry attempts for refresh */
  maxRetryAttempts: number;
  /** Base delay between retry attempts (milliseconds) */
  retryBaseDelay: number;
  /** Maximum delay between retries (milliseconds) */
  maxRetryDelay: number;
}

/**
 * Default token refresh configuration
 */
const DEFAULT_REFRESH_CONFIG: TokenRefreshConfig = {
  autoRefresh: true,
  refreshInterval: 9 * 60 * 1000, // 9 minutes (tokens expire after 10 minutes)
  refreshBeforeExpiry: 2 * 60 * 1000, // Refresh 2 minutes before expiry
  maxRetryAttempts: 3,
  retryBaseDelay: 1000,
  maxRetryDelay: 10000,
};

/**
 * Azure Speech Service token endpoints
 */
const TOKEN_ENDPOINTS: Record<AzureRegion, string> = {
  eastus: 'https://eastus.api.cognitive.microsoft.com/sts/v1.0/issueToken',
  eastus2: 'https://eastus2.api.cognitive.microsoft.com/sts/v1.0/issueToken',
  westus: 'https://westus.api.cognitive.microsoft.com/sts/v1.0/issueToken',
  westus2: 'https://westus2.api.cognitive.microsoft.com/sts/v1.0/issueToken',
  westus3: 'https://westus3.api.cognitive.microsoft.com/sts/v1.0/issueToken',
  centralus: 'https://centralus.api.cognitive.microsoft.com/sts/v1.0/issueToken',
  northcentralus: 'https://northcentralus.api.cognitive.microsoft.com/sts/v1.0/issueToken',
  southcentralus: 'https://southcentralus.api.cognitive.microsoft.com/sts/v1.0/issueToken',
  westcentralus: 'https://westcentralus.api.cognitive.microsoft.com/sts/v1.0/issueToken',
  northeurope: 'https://northeurope.api.cognitive.microsoft.com/sts/v1.0/issueToken',
  westeurope: 'https://westeurope.api.cognitive.microsoft.com/sts/v1.0/issueToken',
  uksouth: 'https://uksouth.api.cognitive.microsoft.com/sts/v1.0/issueToken',
  ukwest: 'https://ukwest.api.cognitive.microsoft.com/sts/v1.0/issueToken',
  francecentral: 'https://francecentral.api.cognitive.microsoft.com/sts/v1.0/issueToken',
  germanynorth: 'https://germanynorth.api.cognitive.microsoft.com/sts/v1.0/issueToken',
  swedencentral: 'https://swedencentral.api.cognitive.microsoft.com/sts/v1.0/issueToken',
  switzerlandnorth: 'https://switzerlandnorth.api.cognitive.microsoft.com/sts/v1.0/issueToken',
  southeastasia: 'https://southeastasia.api.cognitive.microsoft.com/sts/v1.0/issueToken',
  eastasia: 'https://eastasia.api.cognitive.microsoft.com/sts/v1.0/issueToken',
  australiaeast: 'https://australiaeast.api.cognitive.microsoft.com/sts/v1.0/issueToken',
  australiasoutheast: 'https://australiasoutheast.api.cognitive.microsoft.com/sts/v1.0/issueToken',
  centralindia: 'https://centralindia.api.cognitive.microsoft.com/sts/v1.0/issueToken',
  japaneast: 'https://japaneast.api.cognitive.microsoft.com/sts/v1.0/issueToken',
  japanwest: 'https://japanwest.api.cognitive.microsoft.com/sts/v1.0/issueToken',
  koreacentral: 'https://koreacentral.api.cognitive.microsoft.com/sts/v1.0/issueToken',
  canadacentral: 'https://canadacentral.api.cognitive.microsoft.com/sts/v1.0/issueToken',
  brazilsouth: 'https://brazilsouth.api.cognitive.microsoft.com/sts/v1.0/issueToken',
  southafricanorth: 'https://southafricanorth.api.cognitive.microsoft.com/sts/v1.0/issueToken',
  uaenorth: 'https://uaenorth.api.cognitive.microsoft.com/sts/v1.0/issueToken',
};

/**
 * Event listener type for token events
 */
type TokenEventListener = (event: AuthenticationEvent) => void;

/**
 * Create authentication error
 */
const createAuthError = (
  type: AuthenticationErrorType,
  message: string,
  statusCode?: number,
  retryable: boolean = false,
  retryAfter?: number,
): AuthenticationError => ({
  type,
  message,
  retryable,
  timestamp: new Date(),
  details: {},
  ...(statusCode !== undefined && { statusCode }),
  ...(retryAfter !== undefined && { retryAfter }),
});

/**
 * Create authentication event
 */
const createAuthEvent = (
  type: AuthenticationEventType,
  message: string,
  metadata?: Record<string, unknown>,
  error?: AuthenticationError,
): AuthenticationEvent => ({
  type,
  timestamp: new Date(),
  message,
  context: {
    requestId: crypto.randomUUID(),
    userAgent: navigator.userAgent,
  },
  ...(metadata && { metadata }),
  ...(error && { error }),
});

/**
 * Calculate exponential backoff delay
 */
const calculateBackoffDelay = (attempt: number, baseDelay: number, maxDelay: number): number => {
  const delay = baseDelay * Math.pow(2, attempt - 1);
  const jitter = Math.random() * 0.1 * delay;
  return Math.min(delay + jitter, maxDelay);
};

/**
 * Azure Speech API token manager
 */
export class TokenManager {
  private config: AuthConfig;
  private refreshConfig: TokenRefreshConfig;
  private currentToken: TokenInfo | null = null;
  private refreshTimeout: ReturnType<typeof setTimeout> | null = null;
  private isRefreshing = false;
  private refreshPromise: Promise<TokenRefreshResult> | null = null;
  private eventListeners = new Set<TokenEventListener>();
  private retryAttempts = 0;

  constructor(config: AuthConfig, refreshConfig?: Partial<TokenRefreshConfig>) {
    this.config = config;
    this.refreshConfig = { ...DEFAULT_REFRESH_CONFIG, ...refreshConfig };
  }

  /**
   * Get current token information
   */
  getCurrentToken(): TokenInfo | null {
    return this.currentToken;
  }

  /**
   * Check if current token is valid
   */
  isTokenValid(): boolean {
    if (!this.currentToken) {
      return false;
    }

    const now = new Date();
    return now < this.currentToken.expiresAt;
  }

  /**
   * Check if token needs refresh
   */
  needsRefresh(): boolean {
    if (!this.currentToken) {
      return true;
    }

    const now = new Date();
    const refreshTime = new Date(this.currentToken.expiresAt.getTime() - this.refreshConfig.refreshBeforeExpiry);

    return now >= refreshTime;
  }

  /**
   * Get token status
   */
  getTokenStatus(): AuthenticationStatus {
    if (!this.currentToken) {
      return 'not_configured';
    }

    if (this.isRefreshing) {
      return 'refreshing';
    }

    if (!this.isTokenValid()) {
      return 'expired';
    }

    if (this.needsRefresh()) {
      return 'expired';
    }

    return 'authenticated';
  }

  /**
   * Validate current token
   */
  validateToken(): TokenValidationResult {
    const errors: string[] = [];

    if (!this.currentToken) {
      errors.push('No token available');
      return {
        isValid: false,
        isExpired: true,
        errors,
      };
    }

    const now = new Date();
    const isExpired = now >= this.currentToken.expiresAt;
    const timeUntilExpiry = this.currentToken.expiresAt.getTime() - now.getTime();

    if (isExpired) {
      errors.push('Token has expired');
    }

    if (timeUntilExpiry < 60000) {
      errors.push('Token expires soon (less than 1 minute)');
    }

    return {
      isValid: !isExpired,
      isExpired,
      timeUntilExpiry: Math.max(0, timeUntilExpiry),
      errors,
      claims: {
        expiresAt: this.currentToken.expiresAt.toISOString(),
        issuedAt: this.currentToken.issuedAt.toISOString(),
        tokenType: this.currentToken.tokenType,
      },
    };
  }

  /**
   * Issue a new authentication token
   */
  async issueToken(timeout: number = 10000): Promise<TokenRefreshResult> {
    const tokenEndpoint = TOKEN_ENDPOINTS[this.config.serviceRegion as AzureRegion];

    if (!tokenEndpoint) {
      const error = createAuthError(
        'INVALID_REGION',
        `No token endpoint found for region: ${this.config.serviceRegion}`,
      );
      this.emitEvent('token_refresh_failure', 'Token refresh failed: invalid region', undefined, error);
      return { success: false, error };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': this.config.subscriptionKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorType: AuthenticationErrorType;
        let message: string;
        let retryable = false;

        switch (response.status) {
          case 401:
            errorType = 'UNAUTHORIZED';
            message = 'Invalid subscription key';
            break;
          case 403:
            errorType = 'FORBIDDEN';
            message = 'Access denied. Check subscription key permissions';
            break;
          case 429:
            errorType = 'QUOTA_EXCEEDED';
            message = 'Token request quota exceeded';
            retryable = true;
            break;
          case 503:
            errorType = 'SERVICE_UNAVAILABLE';
            message = 'Token service temporarily unavailable';
            retryable = true;
            break;
          default:
            errorType = 'NETWORK_ERROR';
            message = `HTTP ${response.status}: ${response.statusText}`;
            retryable = response.status >= 500;
        }

        const error = createAuthError(errorType, message, response.status, retryable);
        this.emitEvent(
          'token_refresh_failure',
          `Token refresh failed: ${message}`,
          { statusCode: response.status },
          error,
        );
        return { success: false, error };
      }

      const tokenValue = await response.text();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // Azure tokens expire after 10 minutes

      const tokenInfo: TokenInfo = {
        token: tokenValue,
        tokenType: 'Bearer',
        expiresAt,
        issuedAt: now,
        scope: 'speechtotext',
      };

      this.currentToken = tokenInfo;
      this.retryAttempts = 0;

      // Schedule next refresh if auto-refresh is enabled
      if (this.refreshConfig.autoRefresh) {
        this.scheduleRefresh();
      }

      const nextRefreshIn = this.refreshConfig.refreshInterval;
      this.emitEvent('token_refresh_success', 'Token refreshed successfully', {
        expiresAt: expiresAt.toISOString(),
        nextRefreshIn,
      });

      return {
        success: true,
        tokenInfo,
        nextRefreshIn,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = createAuthError('TIMEOUT', `Token request timed out after ${timeout}ms`, undefined, true);
        this.emitEvent('token_refresh_failure', 'Token refresh timed out', { timeout }, timeoutError);
        return { success: false, error: timeoutError };
      }

      const networkError = createAuthError(
        'NETWORK_ERROR',
        `Network error during token refresh: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        true,
      );

      this.emitEvent(
        'token_refresh_failure',
        'Token refresh network error',
        { error: error instanceof Error ? error.message : 'Unknown' },
        networkError,
      );
      return { success: false, error: networkError };
    }
  }

  /**
   * Refresh the current token
   */
  async refreshToken(): Promise<TokenRefreshResult> {
    // If already refreshing, return the existing promise
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;

    this.refreshPromise = this.performRefreshWithRetry();

    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  /**
   * Perform token refresh with retry logic
   */
  private async performRefreshWithRetry(): Promise<TokenRefreshResult> {
    let lastError: AuthenticationError | undefined;

    for (let attempt = 1; attempt <= this.refreshConfig.maxRetryAttempts; attempt++) {
      this.retryAttempts = attempt;

      try {
        const result = await this.issueToken();

        if (result.success) {
          return result;
        }

        lastError = result.error;

        // If error is not retryable, break immediately
        if (!result.error?.retryable) {
          break;
        }

        // If this is not the last attempt, wait before retrying
        if (attempt < this.refreshConfig.maxRetryAttempts) {
          const delay = calculateBackoffDelay(
            attempt,
            this.refreshConfig.retryBaseDelay,
            this.refreshConfig.maxRetryDelay,
          );

          this.emitEvent(
            'token_refresh_failure',
            `Token refresh attempt ${attempt} failed, retrying in ${delay}ms`,
            {
              attempt,
              maxAttempts: this.refreshConfig.maxRetryAttempts,
              delay,
              error: result.error.message,
            },
            result.error,
          );

          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        lastError = createAuthError(
          'UNKNOWN_ERROR',
          `Unexpected error during token refresh: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        break;
      }
    }

    this.emitEvent(
      'token_refresh_failure',
      `Token refresh failed after ${this.refreshConfig.maxRetryAttempts} attempts`,
      {
        maxAttempts: this.refreshConfig.maxRetryAttempts,
        finalError: lastError?.message,
      },
      lastError,
    );

    return {
      success: false,
      error: lastError || createAuthError('UNKNOWN_ERROR', 'Token refresh failed with unknown error'),
    };
  }

  /**
   * Schedule automatic token refresh
   */
  private scheduleRefresh(): void {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }

    if (!this.refreshConfig.autoRefresh || !this.currentToken) {
      return;
    }

    const now = new Date();
    const refreshTime = new Date(this.currentToken.expiresAt.getTime() - this.refreshConfig.refreshBeforeExpiry);
    const delay = Math.max(0, refreshTime.getTime() - now.getTime());

    this.refreshTimeout = setTimeout(() => {
      this.refreshToken().catch(error => {
        console.error('Automatic token refresh failed:', error);
      });
    }, delay);
  }

  /**
   * Start automatic token refresh
   */
  startAutoRefresh(): void {
    this.refreshConfig.autoRefresh = true;
    this.scheduleRefresh();
  }

  /**
   * Stop automatic token refresh
   */
  stopAutoRefresh(): void {
    this.refreshConfig.autoRefresh = false;

    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }
  }

  /**
   * Clear current token
   */
  clearToken(): void {
    this.currentToken = null;
    this.stopAutoRefresh();
    this.emitEvent('authentication_failure', 'Token cleared');
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AuthConfig>): void {
    this.config = { ...this.config, ...config };

    // Clear current token if subscription key or region changed
    if (config.subscriptionKey || config.serviceRegion) {
      this.clearToken();
    }
  }

  /**
   * Update refresh configuration
   */
  updateRefreshConfig(refreshConfig: Partial<TokenRefreshConfig>): void {
    const wasAutoRefresh = this.refreshConfig.autoRefresh;
    this.refreshConfig = { ...this.refreshConfig, ...refreshConfig };

    // Restart auto refresh if configuration changed
    if (wasAutoRefresh && this.refreshConfig.autoRefresh) {
      this.scheduleRefresh();
    } else if (!this.refreshConfig.autoRefresh) {
      this.stopAutoRefresh();
    }
  }

  /**
   * Add event listener
   */
  addEventListener(listener: TokenEventListener): void {
    this.eventListeners.add(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: TokenEventListener): void {
    this.eventListeners.delete(listener);
  }

  /**
   * Emit authentication event
   */
  private emitEvent(
    type: AuthenticationEventType,
    message: string,
    metadata?: Record<string, unknown>,
    error?: AuthenticationError,
  ): void {
    const event = createAuthEvent(type, message, metadata, error);

    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (listenerError) {
        console.error('Error in token event listener:', listenerError);
      }
    });
  }

  /**
   * Get token manager statistics
   */
  getStatistics(): {
    hasToken: boolean;
    isValid: boolean;
    expiresAt?: string;
    timeUntilExpiry?: number;
    autoRefreshEnabled: boolean;
    retryAttempts: number;
    isRefreshing: boolean;
  } {
    const expiresAt = this.currentToken?.expiresAt.toISOString();
    const timeUntilExpiry = this.currentToken
      ? Math.max(0, this.currentToken.expiresAt.getTime() - Date.now())
      : undefined;

    return {
      hasToken: !!this.currentToken,
      isValid: this.isTokenValid(),
      autoRefreshEnabled: this.refreshConfig.autoRefresh,
      retryAttempts: this.retryAttempts,
      isRefreshing: this.isRefreshing,
      ...(expiresAt && { expiresAt }),
      ...(timeUntilExpiry !== undefined && { timeUntilExpiry }),
    };
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stopAutoRefresh();
    this.eventListeners.clear();
    this.currentToken = null;
    this.refreshPromise = null;
  }
}
