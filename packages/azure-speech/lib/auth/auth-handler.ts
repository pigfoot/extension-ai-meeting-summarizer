/**
 * Azure Speech API authentication handler
 * Coordinates authentication operations including credential management,
 * token lifecycle, and secure storage integration
 */

import { CredentialValidator } from './credential-validator';
import { TokenManager } from './token-manager';
import type {
  AuthConfig,
  AuthenticationState,
  AuthenticationStatus,
  AuthenticationError,
  AuthenticationEvent,
  AuthManagerConfig,
  CredentialValidationResult,
  TokenRefreshResult,
  TokenInfo,
  HealthCheckResult,
  ApiKeyValidationOptions,
} from '../types/auth';

/**
 * Authentication handler configuration
 */
interface AuthHandlerConfig {
  /** Storage key for encrypted credentials */
  storageKey: string;
  /** Enable automatic token refresh */
  autoRefresh: boolean;
  /** Enable credential validation on startup */
  validateOnStartup: boolean;
  /** Health check interval in milliseconds */
  healthCheckInterval: number;
  /** Maximum authentication attempts */
  maxAuthAttempts: number;
}

/**
 * Default authentication handler configuration
 */
const DEFAULT_AUTH_HANDLER_CONFIG: AuthHandlerConfig = {
  storageKey: 'azure-speech-credentials',
  autoRefresh: true,
  validateOnStartup: true,
  healthCheckInterval: 5 * 60 * 1000, // 5 minutes
  maxAuthAttempts: 3,
};

/**
 * Secure storage interface for credentials
 */
interface SecureStorage {
  /** Store encrypted credentials */
  store(key: string, data: string): Promise<void>;
  /** Retrieve encrypted credentials */
  retrieve(key: string): Promise<string | null>;
  /** Remove stored credentials */
  remove(key: string): Promise<void>;
  /** Check if credentials exist */
  exists(key: string): Promise<boolean>;
}

/**
 * Authentication event listener
 */
type AuthEventListener = (event: AuthenticationEvent) => void;

/**
 * Create authentication error
 */
function createAuthError(type: string, message: string, retryable: boolean = false): AuthenticationError {
  return {
    type: type as any,
    message,
    retryable,
    timestamp: new Date(),
    details: {},
  };
}

/**
 * Create authentication event
 */
function createAuthEvent(
  type: string,
  message: string,
  metadata?: Record<string, unknown>,
  error?: AuthenticationError,
): AuthenticationEvent {
  const event: AuthenticationEvent = {
    type: type as any,
    timestamp: new Date(),
    message,
    context: {
      requestId: crypto.randomUUID(),
      userAgent: navigator.userAgent,
    },
  };
  
  if (metadata !== undefined) {
    event.metadata = metadata;
  }
  
  if (error !== undefined) {
    event.error = error;
  }
  
  return event;
}

/**
 * Azure Speech API authentication handler
 */
export class AuthenticationHandler {
  private config: AuthHandlerConfig;
  private authConfig: AuthConfig | null = null;
  private tokenManager: TokenManager | null = null;
  private secureStorage: SecureStorage | null = null;
  private eventListeners = new Set<AuthEventListener>();
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private authAttempts = 0;
  private lastError: AuthenticationError | null = null;
  private isInitializing = false;

  /** Authentication state */
  private authState: AuthenticationState = {
    status: 'not_configured',
    metrics: {
      totalAttempts: 0,
      successfulAuth: 0,
      failedAuth: 0,
      averageResponseTime: 0,
    },
  };

  constructor(config?: Partial<AuthHandlerConfig>, secureStorage?: SecureStorage) {
    this.config = { ...DEFAULT_AUTH_HANDLER_CONFIG, ...config };
    this.secureStorage = secureStorage || null;
  }

  /**
   * Initialize authentication handler
   */
  async initialize(): Promise<void> {
    if (this.isInitializing) {
      return;
    }

    this.isInitializing = true;

    try {
      this.updateAuthState({ status: 'configuring' });
      this.emitEvent('authentication_initialization', 'Initializing authentication handler');

      // Load stored credentials if available
      if (this.secureStorage) {
        await this.loadStoredCredentials();
      }

      // Validate credentials on startup if configured
      if (this.config.validateOnStartup && this.authConfig) {
        await this.validateCredentials();
      }

      // Start health checks
      if (this.config.healthCheckInterval > 0) {
        this.startHealthChecks();
      }

      this.emitEvent('authentication_initialization', 'Authentication handler initialized successfully');
    } catch (error) {
      const authError = createAuthError(
        'INITIALIZATION_ERROR',
        `Failed to initialize authentication handler: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      this.lastError = authError;
      this.updateAuthState({ status: 'error', lastError: authError });
      this.emitEvent('authentication_failure', 'Authentication handler initialization failed', undefined, authError);

      throw authError;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Configure authentication with Azure credentials
   */
  async configureAuth(
    config: AuthConfig,
    options?: Partial<ApiKeyValidationOptions>,
  ): Promise<CredentialValidationResult> {
    this.updateAuthState({ status: 'configuring' });
    this.authAttempts = 0;

    try {
      // Validate credentials
      const validationResult = await CredentialValidator.validateCredentials(config, options);

      if (!validationResult.isValid) {
        const error = createAuthError(
          'INVALID_CREDENTIALS',
          `Credential validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`,
        );

        this.lastError = error;
        this.updateAuthState({ status: 'error', lastError: error });
        this.emitEvent(
          'authentication_failure',
          'Credential validation failed',
          { errors: validationResult.errors },
          error,
        );

        return validationResult;
      }

      // Store credentials securely
      if (this.secureStorage) {
        await this.storeCredentials(config);
      }

      // Update configuration
      this.authConfig = config;

      // Initialize token manager
      this.tokenManager = new TokenManager(config, {
        autoRefresh: this.config.autoRefresh,
      });

      // Set up token event listeners
      this.tokenManager.addEventListener(event => {
        this.handleTokenEvent(event);
      });

      // Issue initial token
      const tokenResult = await this.tokenManager.refreshToken();

      if (!tokenResult.success) {
        const error = tokenResult.error || createAuthError('TOKEN_REFRESH_FAILED', 'Failed to issue initial token');
        this.lastError = error;
        this.updateAuthState({ status: 'error', lastError: error });
        this.emitEvent('authentication_failure', 'Initial token issuance failed', undefined, error);

        return {
          ...validationResult,
          isValid: false,
          errors: [...validationResult.errors, error],
        };
      }

      // Update authentication state
      const stateUpdate: Partial<AuthenticationState> = {
        status: 'authenticated',
        config,
      };
      
      if (tokenResult.tokenInfo !== undefined) {
        stateUpdate.tokenInfo = tokenResult.tokenInfo;
      }
      
      if (tokenResult.nextRefreshIn !== undefined) {
        stateUpdate.nextRefresh = new Date(Date.now() + tokenResult.nextRefreshIn);
      }
      
      this.updateAuthState(stateUpdate);

      this.authState.metrics.successfulAuth++;
      this.emitEvent('authentication_success', 'Authentication configured successfully', {
        region: config.region,
        hasCustomEndpoint: !!config.endpoint,
      });

      return validationResult;
    } catch (error) {
      this.authState.metrics.failedAuth++;
      const authError = createAuthError(
        'CONFIGURATION_ERROR',
        `Authentication configuration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      this.lastError = authError;
      this.updateAuthState({ status: 'error', lastError: authError });
      this.emitEvent('authentication_failure', 'Authentication configuration failed', undefined, authError);

      throw authError;
    } finally {
      this.authState.metrics.totalAttempts++;
    }
  }

  /**
   * Get current authentication status
   */
  getAuthenticationStatus(): AuthenticationStatus {
    if (this.tokenManager) {
      return this.tokenManager.getTokenStatus();
    }

    return this.authState.status;
  }

  /**
   * Get authentication state
   */
  getAuthenticationState(): AuthenticationState {
    return { ...this.authState };
  }

  /**
   * Get current token
   */
  getCurrentToken(): TokenInfo | null {
    return this.tokenManager?.getCurrentToken() || null;
  }

  /**
   * Check if authentication is ready
   */
  isAuthenticated(): boolean {
    return this.getAuthenticationStatus() === 'authenticated' && this.tokenManager?.isTokenValid() === true;
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(): Promise<TokenRefreshResult> {
    if (!this.tokenManager) {
      const error = createAuthError('NOT_CONFIGURED', 'Authentication not configured');
      return { success: false, error };
    }

    this.updateAuthState({ status: 'refreshing' });

    try {
      const result = await this.tokenManager.refreshToken();

      if (result.success) {
        const refreshStateUpdate: Partial<AuthenticationState> = {
          status: 'authenticated',
        };
        
        if (result.tokenInfo !== undefined) {
          refreshStateUpdate.tokenInfo = result.tokenInfo;
        }
        
        if (result.nextRefreshIn !== undefined) {
          refreshStateUpdate.nextRefresh = new Date(Date.now() + result.nextRefreshIn);
        }
        
        this.updateAuthState(refreshStateUpdate);
      } else {
        this.lastError = result.error || createAuthError('TOKEN_REFRESH_FAILED', 'Token refresh failed');
        this.updateAuthState({ status: 'error', lastError: this.lastError });
      }

      return result;
    } catch (error) {
      const authError = createAuthError(
        'TOKEN_REFRESH_ERROR',
        `Token refresh error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      this.lastError = authError;
      this.updateAuthState({ status: 'error', lastError: authError });

      return { success: false, error: authError };
    }
  }

  /**
   * Validate current credentials
   */
  async validateCredentials(options?: Partial<ApiKeyValidationOptions>): Promise<CredentialValidationResult> {
    if (!this.authConfig) {
      return {
        isValid: false,
        errors: [createAuthError('NOT_CONFIGURED', 'No credentials configured')],
        warnings: [],
        validatedAt: new Date(),
      };
    }

    return CredentialValidator.validateCredentials(this.authConfig, options);
  }

  /**
   * Perform health check
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    if (!this.authConfig) {
      return {
        isHealthy: false,
        responseTime: 0,
        timestamp: new Date(),
        endpoints: [],
        serviceStatus: 'outage',
        errors: [createAuthError('NOT_CONFIGURED', 'No credentials configured for health check')],
      };
    }

    const healthResult = await CredentialValidator.healthCheck(this.authConfig);

    this.emitEvent('service_health_check', `Health check completed: ${healthResult.serviceStatus}`, {
      isHealthy: healthResult.isHealthy,
      responseTime: healthResult.responseTime,
      endpointCount: healthResult.endpoints.length,
    });

    return healthResult;
  }

  /**
   * Clear authentication
   */
  async clearAuth(): Promise<void> {
    // Stop token manager
    if (this.tokenManager) {
      this.tokenManager.dispose();
      this.tokenManager = null;
    }

    // Clear stored credentials
    if (this.secureStorage) {
      await this.secureStorage.remove(this.config.storageKey);
    }

    // Reset state
    this.authConfig = null;
    this.lastError = null;
    this.authAttempts = 0;

    // Reset authentication state
    this.authState = {
      status: 'not_configured',
      metrics: this.authState.metrics, // Preserve metrics
    };

    this.emitEvent('authentication_cleared', 'Authentication cleared');
  }

  /**
   * Load stored credentials from secure storage
   */
  private async loadStoredCredentials(): Promise<void> {
    if (!this.secureStorage) {
      return;
    }

    try {
      const storedData = await this.secureStorage.retrieve(this.config.storageKey);

      if (storedData) {
        const credentials = JSON.parse(storedData) as AuthConfig;
        this.authConfig = credentials;

        this.emitEvent('credentials_loaded', 'Stored credentials loaded successfully');
      }
    } catch (error) {
      this.emitEvent('credentials_load_error', 'Failed to load stored credentials', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Store credentials securely
   */
  private async storeCredentials(config: AuthConfig): Promise<void> {
    if (!this.secureStorage) {
      return;
    }

    try {
      const credentialData = JSON.stringify(config);
      await this.secureStorage.store(this.config.storageKey, credentialData);

      this.emitEvent('credentials_stored', 'Credentials stored securely');
    } catch (error) {
      this.emitEvent('credentials_store_error', 'Failed to store credentials', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error('Health check failed:', error);
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * Stop health checks
   */
  private stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Handle token manager events
   */
  private handleTokenEvent(event: AuthenticationEvent): void {
    // Update authentication state based on token events
    switch (event.type) {
      case 'token_refresh_success':
        const token = this.tokenManager?.getCurrentToken();
        this.updateAuthState({
          status: 'authenticated',
          ...(token && { tokenInfo: token }),
        });
        break;

      case 'token_refresh_failure':
        this.lastError = event.error || createAuthError('TOKEN_REFRESH_FAILED', 'Token refresh failed');
        this.updateAuthState({
          status: 'error',
          lastError: this.lastError,
        });
        break;
    }

    // Forward token events to our listeners
    this.emitEvent(event.type, event.message, event.metadata, event.error);
  }

  /**
   * Update authentication state
   */
  private updateAuthState(updates: Partial<AuthenticationState>): void {
    this.authState = {
      ...this.authState,
      ...updates,
    };
  }

  /**
   * Add event listener
   */
  addEventListener(listener: AuthEventListener): void {
    this.eventListeners.add(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: AuthEventListener): void {
    this.eventListeners.delete(listener);
  }

  /**
   * Emit authentication event
   */
  private emitEvent(
    type: string,
    message: string,
    metadata?: Record<string, unknown>,
    error?: AuthenticationError,
  ): void {
    const event = createAuthEvent(type, message, metadata, error);

    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (listenerError) {
        console.error('Error in auth event listener:', listenerError);
      }
    });
  }

  /**
   * Get authentication statistics
   */
  getStatistics(): {
    status: AuthenticationStatus;
    hasConfig: boolean;
    hasToken: boolean;
    isTokenValid: boolean;
    totalAttempts: number;
    successfulAuth: number;
    failedAuth: number;
    lastError?: string;
    nextRefresh?: string;
  } {
    const stats = {
      status: this.getAuthenticationStatus(),
      hasConfig: !!this.authConfig,
      hasToken: !!this.getCurrentToken(),
      isTokenValid: this.tokenManager?.isTokenValid() || false,
      totalAttempts: this.authState.metrics.totalAttempts,
      successfulAuth: this.authState.metrics.successfulAuth,
      failedAuth: this.authState.metrics.failedAuth,
      ...(this.lastError?.message && { lastError: this.lastError.message }),
      ...(this.authState.nextRefresh && { nextRefresh: this.authState.nextRefresh.toISOString() }),
    };

    return stats;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stopHealthChecks();

    if (this.tokenManager) {
      this.tokenManager.dispose();
      this.tokenManager = null;
    }

    this.eventListeners.clear();
    this.authConfig = null;
    this.lastError = null;
  }
}
