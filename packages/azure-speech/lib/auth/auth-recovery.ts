/**
 * Azure Speech API authentication error recovery
 * Implements comprehensive error recovery strategies and user notification
 * for authentication failures with graceful degradation
 */

import { CredentialValidator } from './credential-validator';
import type { AuthenticationHandler } from './auth-handler';
import type {
  AuthConfig,
  AuthenticationError,
  AuthenticationErrorType,
  AuthenticationEvent,
  AuthenticationStatus,
  CredentialValidationResult,
  TokenRefreshResult,
  HealthCheckResult,
} from '../types/auth';

/**
 * Recovery strategy types
 */
export type RecoveryStrategyType =
  | 'IMMEDIATE_RETRY'
  | 'EXPONENTIAL_BACKOFF'
  | 'USER_INTERVENTION'
  | 'CREDENTIAL_REFRESH'
  | 'FALLBACK_MODE'
  | 'SERVICE_DEGRADATION'
  | 'MANUAL_RECOVERY';

/**
 * Recovery action types
 */
export type RecoveryActionType =
  | 'RETRY_AUTHENTICATION'
  | 'REFRESH_TOKEN'
  | 'VALIDATE_CREDENTIALS'
  | 'NOTIFY_USER'
  | 'ENABLE_FALLBACK'
  | 'CLEAR_CACHE'
  | 'RESTART_SERVICE'
  | 'LOG_ERROR';

/**
 * User notification types
 */
export type NotificationType =
  | 'ERROR'
  | 'WARNING'
  | 'INFO'
  | 'SUCCESS'
  | 'CREDENTIAL_REQUIRED'
  | 'SERVICE_DEGRADED'
  | 'RECOVERY_SUCCESS';

/**
 * Recovery strategy configuration
 */
interface RecoveryStrategy {
  /** Strategy type */
  type: RecoveryStrategyType;
  /** Maximum retry attempts */
  maxAttempts: number;
  /** Base delay between attempts (ms) */
  baseDelay: number;
  /** Maximum delay between attempts (ms) */
  maxDelay: number;
  /** Whether to notify user */
  notifyUser: boolean;
  /** Recovery actions to perform */
  actions: RecoveryActionType[];
  /** Conditions for applying this strategy */
  conditions: {
    /** Error types this strategy applies to */
    errorTypes: AuthenticationErrorType[];
    /** Whether error is retryable */
    retryable?: boolean;
    /** Maximum response time threshold (ms) */
    maxResponseTime?: number;
  };
}

/**
 * User notification interface
 */
interface UserNotification {
  /** Notification ID */
  id: string;
  /** Notification type */
  type: NotificationType;
  /** Title of the notification */
  title: string;
  /** Notification message */
  message: string;
  /** Suggested actions for user */
  actions?: {
    /** Action label */
    label: string;
    /** Action handler function */
    handler: () => Promise<void> | void;
    /** Whether action is primary */
    primary?: boolean;
  }[];
  /** Auto-dismiss timeout (ms) */
  timeout?: number;
  /** Notification priority */
  priority: 'low' | 'medium' | 'high' | 'critical';
  /** Timestamp when notification was created */
  timestamp: Date;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Recovery attempt result
 */
interface RecoveryAttemptResult {
  /** Whether recovery was successful */
  success: boolean;
  /** Recovery strategy used */
  strategy: RecoveryStrategyType;
  /** Number of attempts made */
  attempts: number;
  /** Total time taken (ms) */
  duration: number;
  /** Error if recovery failed */
  error?: AuthenticationError;
  /** Actions performed during recovery */
  actions: RecoveryActionType[];
  /** User notifications sent */
  notifications: UserNotification[];
}

/**
 * Recovery statistics
 */
interface RecoveryStatistics {
  /** Total recovery attempts */
  totalAttempts: number;
  /** Successful recoveries */
  successfulRecoveries: number;
  /** Failed recoveries */
  failedRecoveries: number;
  /** Most common error types */
  commonErrors: Record<AuthenticationErrorType, number>;
  /** Most effective strategies */
  strategyEffectiveness: Record<RecoveryStrategyType, { attempts: number; successes: number }>;
  /** Average recovery time */
  averageRecoveryTime: number;
  /** Last recovery attempt */
  lastRecovery?: Date;
}

/**
 * User notification handler
 */
type NotificationHandler = (notification: UserNotification) => void;

/**
 * Recovery event listener
 */
type RecoveryEventListener = (event: RecoveryEvent) => void;

/**
 * Recovery event
 */
interface RecoveryEvent {
  /** Event type */
  type: 'recovery_started' | 'recovery_completed' | 'recovery_failed' | 'notification_sent';
  /** Event timestamp */
  timestamp: Date;
  /** Event message */
  message: string;
  /** Recovery attempt result */
  result?: RecoveryAttemptResult;
  /** Notification sent */
  notification?: UserNotification;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Default recovery strategies
 */
const DEFAULT_RECOVERY_STRATEGIES: RecoveryStrategy[] = [
  {
    type: 'IMMEDIATE_RETRY',
    maxAttempts: 2,
    baseDelay: 1000,
    maxDelay: 5000,
    notifyUser: false,
    actions: ['RETRY_AUTHENTICATION'],
    conditions: {
      errorTypes: ['NETWORK_ERROR', 'TIMEOUT'],
      retryable: true,
      maxResponseTime: 30000,
    },
  },
  {
    type: 'EXPONENTIAL_BACKOFF',
    maxAttempts: 5,
    baseDelay: 2000,
    maxDelay: 30000,
    notifyUser: false,
    actions: ['RETRY_AUTHENTICATION', 'LOG_ERROR'],
    conditions: {
      errorTypes: ['SERVICE_UNAVAILABLE', 'QUOTA_EXCEEDED'],
      retryable: true,
    },
  },
  {
    type: 'CREDENTIAL_REFRESH',
    maxAttempts: 3,
    baseDelay: 0,
    maxDelay: 0,
    notifyUser: true,
    actions: ['VALIDATE_CREDENTIALS', 'REFRESH_TOKEN', 'NOTIFY_USER'],
    conditions: {
      errorTypes: ['UNAUTHORIZED', 'FORBIDDEN', 'EXPIRED_TOKEN'],
    },
  },
  {
    type: 'USER_INTERVENTION',
    maxAttempts: 1,
    baseDelay: 0,
    maxDelay: 0,
    notifyUser: true,
    actions: ['NOTIFY_USER', 'LOG_ERROR'],
    conditions: {
      errorTypes: ['INVALID_SUBSCRIPTION_KEY', 'INVALID_REGION'],
      retryable: false,
    },
  },
  {
    type: 'FALLBACK_MODE',
    maxAttempts: 1,
    baseDelay: 0,
    maxDelay: 0,
    notifyUser: true,
    actions: ['ENABLE_FALLBACK', 'NOTIFY_USER'],
    conditions: {
      errorTypes: ['SERVICE_UNAVAILABLE'],
      retryable: false,
    },
  },
];

/**
 * Calculate exponential backoff delay
 */
function calculateBackoffDelay(attempt: number, baseDelay: number, maxDelay: number): number {
  const delay = baseDelay * Math.pow(2, attempt - 1);
  const jitter = Math.random() * 0.1 * delay;
  return Math.min(delay + jitter, maxDelay);
}

/**
 * Create user notification
 */
function createNotification(
  type: NotificationType,
  title: string,
  message: string,
  priority: UserNotification['priority'] = 'medium',
  actions?: UserNotification['actions'],
  timeout?: number,
): UserNotification {
  const notification: UserNotification = {
    id: crypto.randomUUID(),
    type,
    title,
    message,
    priority,
    timestamp: new Date(),
  };

  if (actions !== undefined) {
    notification.actions = actions;
  }

  if (timeout !== undefined) {
    notification.timeout = timeout;
  }

  return notification;
}

/**
 * Authentication error recovery system
 */
export class AuthErrorRecovery {
  private authHandler: AuthenticationHandler | null = null;
  private recoveryStrategies: RecoveryStrategy[] = [...DEFAULT_RECOVERY_STRATEGIES];
  private notificationHandlers = new Set<NotificationHandler>();
  private eventListeners = new Set<RecoveryEventListener>();
  private statistics: RecoveryStatistics = {
    totalAttempts: 0,
    successfulRecoveries: 0,
    failedRecoveries: 0,
    commonErrors: {} as Record<AuthenticationErrorType, number>,
    strategyEffectiveness: {} as Record<RecoveryStrategyType, { attempts: number; successes: number }>,
    averageRecoveryTime: 0,
  };
  private recoveryInProgress = false;
  private fallbackModeEnabled = false;

  constructor(authHandler?: AuthenticationHandler) {
    this.authHandler = authHandler || null;
  }

  /**
   * Set authentication handler
   */
  setAuthHandler(authHandler: AuthenticationHandler): void {
    this.authHandler = authHandler;
  }

  /**
   * Attempt to recover from authentication error
   */
  async recoverFromError(
    error: AuthenticationError,
    context?: Record<string, unknown>,
  ): Promise<RecoveryAttemptResult> {
    if (this.recoveryInProgress) {
      return {
        success: false,
        strategy: 'MANUAL_RECOVERY',
        attempts: 0,
        duration: 0,
        error: {
          ...error,
          type: 'UNKNOWN_ERROR',
          message: 'Recovery already in progress',
        },
        actions: [],
        notifications: [],
      };
    }

    this.recoveryInProgress = true;
    const startTime = Date.now();
    const notifications: UserNotification[] = [];
    const actionsPerformed: RecoveryActionType[] = [];

    try {
      // Find applicable recovery strategy
      const strategy = this.findRecoveryStrategy(error);

      if (!strategy) {
        const notification = createNotification(
          'ERROR',
          'Authentication Error',
          `No recovery strategy available for error: ${error.message}`,
          'high',
        );

        notifications.push(notification);
        this.sendNotification(notification);

        return {
          success: false,
          strategy: 'MANUAL_RECOVERY',
          attempts: 0,
          duration: Date.now() - startTime,
          error,
          actions: actionsPerformed,
          notifications,
        };
      }

      this.emitEvent('recovery_started', `Starting recovery with strategy: ${strategy.type}`, {
        errorType: error.type,
        strategy: strategy.type,
        context,
      });

      // Update statistics
      this.updateStatistics(error.type, strategy.type);

      // Attempt recovery
      let attempts = 0;
      let lastError = error;

      for (attempts = 1; attempts <= strategy.maxAttempts; attempts++) {
        try {
          // Perform recovery actions
          const actionResults = await this.performRecoveryActions(strategy.actions, error, context);
          actionsPerformed.push(...actionResults.actions);
          notifications.push(...actionResults.notifications);

          // Check if recovery was successful
          if (await this.verifyRecovery()) {
            const duration = Date.now() - startTime;

            this.statistics.successfulRecoveries++;
            this.updateStrategyEffectiveness(strategy.type, true);

            const successNotification = createNotification(
              'SUCCESS',
              'Recovery Successful',
              'Authentication has been restored',
              'medium',
              undefined,
              5000,
            );

            notifications.push(successNotification);
            this.sendNotification(successNotification);

            const result: RecoveryAttemptResult = {
              success: true,
              strategy: strategy.type,
              attempts,
              duration,
              actions: actionsPerformed,
              notifications,
            };

            this.emitEvent('recovery_completed', 'Recovery successful', { result });
            return result;
          }

          // If not the last attempt, wait before retrying
          if (attempts < strategy.maxAttempts) {
            const delay = calculateBackoffDelay(attempts, strategy.baseDelay, strategy.maxDelay);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        } catch (recoveryError) {
          lastError = recoveryError instanceof Error ? { ...error, message: recoveryError.message } : error;
        }
      }

      // Recovery failed
      this.statistics.failedRecoveries++;
      this.updateStrategyEffectiveness(strategy.type, false);

      // Send failure notification if configured
      if (strategy.notifyUser) {
        const failureNotification = createNotification(
          'ERROR',
          'Recovery Failed',
          `Unable to recover from authentication error: ${lastError.message}`,
          'critical',
          this.createRecoveryActions(error),
        );

        notifications.push(failureNotification);
        this.sendNotification(failureNotification);
      }

      const result: RecoveryAttemptResult = {
        success: false,
        strategy: strategy.type,
        attempts,
        duration: Date.now() - startTime,
        error: lastError,
        actions: actionsPerformed,
        notifications,
      };

      this.emitEvent('recovery_failed', 'Recovery failed', { result });
      return result;
    } finally {
      this.recoveryInProgress = false;
      this.statistics.totalAttempts++;

      const totalTime = Date.now() - startTime;
      this.statistics.averageRecoveryTime =
        (this.statistics.averageRecoveryTime * (this.statistics.totalAttempts - 1) + totalTime) /
        this.statistics.totalAttempts;

      this.statistics.lastRecovery = new Date();
    }
  }

  /**
   * Find applicable recovery strategy for error
   */
  private findRecoveryStrategy(error: AuthenticationError): RecoveryStrategy | null {
    for (const strategy of this.recoveryStrategies) {
      const { conditions } = strategy;

      // Check if error type matches
      if (!conditions.errorTypes.includes(error.type)) {
        continue;
      }

      // Check retryable condition
      if (conditions.retryable !== undefined && conditions.retryable !== error.retryable) {
        continue;
      }

      return strategy;
    }

    return null;
  }

  /**
   * Perform recovery actions
   */
  private async performRecoveryActions(
    actions: RecoveryActionType[],
    error: AuthenticationError,
    context?: Record<string, unknown>,
  ): Promise<{ actions: RecoveryActionType[]; notifications: UserNotification[] }> {
    const performedActions: RecoveryActionType[] = [];
    const notifications: UserNotification[] = [];

    for (const action of actions) {
      try {
        switch (action) {
          case 'RETRY_AUTHENTICATION':
            if (this.authHandler) {
              await this.authHandler.refreshToken();
            }
            performedActions.push(action);
            break;

          case 'REFRESH_TOKEN':
            if (this.authHandler) {
              await this.authHandler.refreshToken();
            }
            performedActions.push(action);
            break;

          case 'VALIDATE_CREDENTIALS':
            if (this.authHandler) {
              await this.authHandler.validateCredentials();
            }
            performedActions.push(action);
            break;

          case 'NOTIFY_USER':
            const notification = this.createErrorNotification(error, context);
            notifications.push(notification);
            this.sendNotification(notification);
            performedActions.push(action);
            break;

          case 'ENABLE_FALLBACK':
            this.fallbackModeEnabled = true;
            const fallbackNotification = createNotification(
              'WARNING',
              'Fallback Mode Enabled',
              'Operating with limited functionality until service is restored',
              'medium',
            );
            notifications.push(fallbackNotification);
            this.sendNotification(fallbackNotification);
            performedActions.push(action);
            break;

          case 'CLEAR_CACHE':
            // Clear any cached credentials or tokens
            if (this.authHandler) {
              await this.authHandler.clearAuth();
            }
            performedActions.push(action);
            break;

          case 'LOG_ERROR':
            console.error('Authentication error recovery:', error, context);
            performedActions.push(action);
            break;

          case 'RESTART_SERVICE':
            // Restart authentication service
            if (this.authHandler) {
              await this.authHandler.initialize();
            }
            performedActions.push(action);
            break;
        }
      } catch (actionError) {
        console.error(`Recovery action ${action} failed:`, actionError);
      }
    }

    return { actions: performedActions, notifications };
  }

  /**
   * Verify if recovery was successful
   */
  private async verifyRecovery(): Promise<boolean> {
    if (!this.authHandler) {
      return false;
    }

    try {
      return this.authHandler.isAuthenticated();
    } catch {
      return false;
    }
  }

  /**
   * Create error notification
   */
  private createErrorNotification(error: AuthenticationError, context?: Record<string, unknown>): UserNotification {
    let title: string;
    let message: string;
    let priority: UserNotification['priority'];
    let actions: UserNotification['actions'];

    switch (error.type) {
      case 'INVALID_SUBSCRIPTION_KEY':
        title = 'Invalid Subscription Key';
        message = 'Your Azure subscription key is invalid. Please check your configuration.';
        priority = 'critical';
        actions = this.createRecoveryActions(error);
        break;

      case 'EXPIRED_TOKEN':
        title = 'Token Expired';
        message = 'Your authentication token has expired and could not be refreshed automatically.';
        priority = 'high';
        actions = this.createRecoveryActions(error);
        break;

      case 'QUOTA_EXCEEDED':
        title = 'Quota Exceeded';
        message = 'Your Azure API quota has been exceeded. Service will resume when quota resets.';
        priority = 'high';
        break;

      case 'SERVICE_UNAVAILABLE':
        title = 'Service Unavailable';
        message = 'Azure Speech Service is temporarily unavailable. Retrying automatically.';
        priority = 'medium';
        break;

      default:
        title = 'Authentication Error';
        message = error.message;
        priority = 'medium';
        actions = this.createRecoveryActions(error);
    }

    return createNotification('ERROR', title, message, priority, actions);
  }

  /**
   * Create recovery actions for user
   */
  private createRecoveryActions(error: AuthenticationError): UserNotification['actions'] {
    const actions: UserNotification['actions'] = [];

    switch (error.type) {
      case 'INVALID_SUBSCRIPTION_KEY':
      case 'INVALID_REGION':
        actions.push({
          label: 'Update Configuration',
          handler: () => {
            // This would typically open the options page
            chrome.runtime.openOptionsPage?.();
          },
          primary: true,
        });
        break;

      case 'EXPIRED_TOKEN':
      case 'UNAUTHORIZED':
        actions.push({
          label: 'Retry Authentication',
          handler: async () => {
            if (this.authHandler) {
              await this.authHandler.refreshToken();
            }
          },
          primary: true,
        });
        break;

      case 'SERVICE_UNAVAILABLE':
        actions.push({
          label: 'Check Service Status',
          handler: () => {
            window.open('https://status.azure.com/en-us/status', '_blank');
          },
        });
        break;
    }

    return actions;
  }

  /**
   * Update error statistics
   */
  private updateStatistics(errorType: AuthenticationErrorType, strategyType: RecoveryStrategyType): void {
    // Update error counts
    this.statistics.commonErrors[errorType] = (this.statistics.commonErrors[errorType] || 0) + 1;

    // Update strategy attempts
    if (!this.statistics.strategyEffectiveness[strategyType]) {
      this.statistics.strategyEffectiveness[strategyType] = { attempts: 0, successes: 0 };
    }
    this.statistics.strategyEffectiveness[strategyType].attempts++;
  }

  /**
   * Update strategy effectiveness
   */
  private updateStrategyEffectiveness(strategyType: RecoveryStrategyType, success: boolean): void {
    if (success && this.statistics.strategyEffectiveness[strategyType]) {
      this.statistics.strategyEffectiveness[strategyType].successes++;
    }
  }

  /**
   * Send notification to handlers
   */
  private sendNotification(notification: UserNotification): void {
    this.notificationHandlers.forEach(handler => {
      try {
        handler(notification);
      } catch (error) {
        console.error('Error in notification handler:', error);
      }
    });

    this.emitEvent('notification_sent', 'User notification sent', { notification });
  }

  /**
   * Emit recovery event
   */
  private emitEvent(type: RecoveryEvent['type'], message: string, metadata?: Record<string, unknown>): void {
    const event: RecoveryEvent = {
      type,
      timestamp: new Date(),
      message,
    };

    if (metadata !== undefined) {
      event.metadata = metadata;
    }

    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in recovery event listener:', error);
      }
    });
  }

  /**
   * Add notification handler
   */
  addNotificationHandler(handler: NotificationHandler): void {
    this.notificationHandlers.add(handler);
  }

  /**
   * Remove notification handler
   */
  removeNotificationHandler(handler: NotificationHandler): void {
    this.notificationHandlers.delete(handler);
  }

  /**
   * Add recovery event listener
   */
  addEventListener(listener: RecoveryEventListener): void {
    this.eventListeners.add(listener);
  }

  /**
   * Remove recovery event listener
   */
  removeEventListener(listener: RecoveryEventListener): void {
    this.eventListeners.delete(listener);
  }

  /**
   * Add custom recovery strategy
   */
  addRecoveryStrategy(strategy: RecoveryStrategy): void {
    this.recoveryStrategies.push(strategy);
  }

  /**
   * Remove recovery strategy
   */
  removeRecoveryStrategy(strategyType: RecoveryStrategyType): void {
    this.recoveryStrategies = this.recoveryStrategies.filter(s => s.type !== strategyType);
  }

  /**
   * Check if fallback mode is enabled
   */
  isFallbackModeEnabled(): boolean {
    return this.fallbackModeEnabled;
  }

  /**
   * Disable fallback mode
   */
  disableFallbackMode(): void {
    this.fallbackModeEnabled = false;

    const notification = createNotification(
      'SUCCESS',
      'Service Restored',
      'Full functionality has been restored',
      'medium',
      undefined,
      5000,
    );

    this.sendNotification(notification);
  }

  /**
   * Get recovery statistics
   */
  getStatistics(): RecoveryStatistics {
    return { ...this.statistics };
  }

  /**
   * Reset statistics
   */
  resetStatistics(): void {
    this.statistics = {
      totalAttempts: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      commonErrors: {} as Record<AuthenticationErrorType, number>,
      strategyEffectiveness: {} as Record<RecoveryStrategyType, { attempts: number; successes: number }>,
      averageRecoveryTime: 0,
    };
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.notificationHandlers.clear();
    this.eventListeners.clear();
    this.authHandler = null;
    this.recoveryInProgress = false;
    this.fallbackModeEnabled = false;
  }
}
