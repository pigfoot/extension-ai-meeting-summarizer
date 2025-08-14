/**
 * Azure error handler for specialized Azure Speech API error handling
 * Implements error classification, retry strategies, and recovery recommendations
 */

import type {
  TranscriptionError,
  ErrorCategory,
  TranscriptionErrorType,
  RetryStrategy,
  ErrorSeverity,
} from '@extension/azure-speech';

/**
 * Azure-specific error types
 */
export type AzureErrorType =
  | 'authentication_failed'
  | 'subscription_key_invalid'
  | 'quota_exceeded'
  | 'rate_limit_exceeded'
  | 'region_unavailable'
  | 'audio_format_unsupported'
  | 'audio_too_large'
  | 'audio_too_short'
  | 'language_not_supported'
  | 'service_unavailable'
  | 'request_timeout'
  | 'internal_server_error'
  | 'bad_request'
  | 'resource_not_found'
  | 'concurrent_limit_exceeded';

/**
 * Error classification result
 */
export interface ErrorClassification {
  /** Azure-specific error type */
  azureErrorType: AzureErrorType;
  /** General error category */
  category: ErrorCategory;
  /** Error severity level */
  severity: ErrorSeverity;
  /** Whether error is retryable */
  retryable: boolean;
  /** Recommended retry strategy */
  retryStrategy: RetryStrategy;
  /** User-friendly error message */
  userMessage: string;
  /** Technical error details */
  technicalDetails: string;
  /** Recovery suggestions */
  recoverySuggestions: string[];
}

/**
 * Retry configuration for Azure errors
 */
export interface AzureRetryConfig {
  /** Maximum retry attempts */
  maxAttempts: number;
  /** Initial delay in milliseconds */
  initialDelay: number;
  /** Maximum delay in milliseconds */
  maxDelay: number;
  /** Exponential backoff factor */
  backoffFactor: number;
  /** Enable jitter to prevent thundering herd */
  enableJitter: boolean;
  /** Specific conditions for retry */
  retryConditions: {
    /** HTTP status codes to retry */
    statusCodes: number[];
    /** Error codes to retry */
    errorCodes: string[];
    /** Custom retry condition */
    customCondition?: (error: unknown) => boolean;
  };
}

/**
 * Error recovery action
 */
export interface RecoveryAction {
  /** Action type */
  type: 'retry' | 'fallback' | 'notify_user' | 'escalate' | 'ignore';
  /** Action description */
  description: string;
  /** Action priority */
  priority: number;
  /** Whether action can be automated */
  automated: boolean;
  /** Action execution function */
  execute?: () => Promise<void>;
}

/**
 * Error handling context
 */
export interface ErrorHandlingContext {
  /** Request that caused the error */
  requestId: string;
  /** API call type */
  apiCallType: string;
  /** Azure configuration used */
  azureConfig: {
    region: string;
    subscriptionKey: string;
    language: string;
  };
  /** Retry attempt number */
  retryAttempt: number;
  /** Request timestamp */
  requestTimestamp: string;
  /** Additional context data */
  metadata: Record<string, unknown>;
}

/**
 * Error handling statistics
 */
export interface ErrorHandlingStats {
  /** Total errors handled */
  totalErrors: number;
  /** Errors by type */
  errorsByType: Record<AzureErrorType, number>;
  /** Errors by severity */
  errorsBySeverity: Record<ErrorSeverity, number>;
  /** Successful recoveries */
  successfulRecoveries: number;
  /** Failed recoveries */
  failedRecoveries: number;
  /** Most common error types */
  commonErrors: Array<{
    type: AzureErrorType;
    count: number;
    percentage: number;
  }>;
  /** Recovery success rate */
  recoverySuccessRate: number;
  /** Last error timestamp */
  lastError?: string;
  /** Statistics update timestamp */
  lastUpdated: string;
}

/**
 * Azure error handler for comprehensive error management
 */
export class AzureErrorHandler {
  private retryConfig: AzureRetryConfig;
  private stats: ErrorHandlingStats;
  private errorPatterns: Map<RegExp, AzureErrorType> = new Map();
  private recoveryActions: Map<AzureErrorType, RecoveryAction[]> = new Map();

  constructor(retryConfig: AzureRetryConfig) {
    this.retryConfig = retryConfig;
    this.stats = this.initializeStats();

    this.initializeErrorPatterns();
    this.initializeRecoveryActions();
  }

  /**
   * Handle Azure API error with classification and recovery
   */
  async handleError(
    error: unknown,
    context: ErrorHandlingContext,
  ): Promise<{
    classification: ErrorClassification;
    actions: RecoveryAction[];
    shouldRetry: boolean;
    retryDelay: number;
  }> {
    try {
      console.log(`[AzureErrorHandler] Handling error for request: ${context.requestId}`);

      // Classify the error
      const classification = this.classifyError(error, context);

      // Get recovery actions
      const actions = this.getRecoveryActions(classification.azureErrorType);

      // Determine retry behavior
      const shouldRetry = this.shouldRetryError(classification, context);
      const retryDelay = shouldRetry ? this.calculateRetryDelay(context.retryAttempt) : 0;

      // Update statistics
      this.updateErrorStats(classification);

      // Create transcription error for logging
      const _transcriptionError = this.createTranscriptionError(error, classification, context);

      console.log(`[AzureErrorHandler] Error classified as ${classification.azureErrorType} (retry: ${shouldRetry})`);

      return {
        classification,
        actions,
        shouldRetry,
        retryDelay,
      };
    } catch (handlingError) {
      console.error('[AzureErrorHandler] Error in error handling:', handlingError);

      // Return safe defaults
      return {
        classification: this.createDefaultClassification(error),
        actions: [],
        shouldRetry: false,
        retryDelay: 0,
      };
    }
  }

  /**
   * Classify error type and characteristics
   */
  classifyError(error: unknown, context: ErrorHandlingContext): ErrorClassification {
    let azureErrorType: AzureErrorType = 'internal_server_error';
    let category: ErrorCategory = 'system';
    let severity: ErrorSeverity = 'medium';

    // Extract error information
    const errorMessage = this.extractErrorMessage(error);
    const statusCode = this.extractStatusCode(error);
    const errorCode = this.extractErrorCode(error);

    // Classify by HTTP status code
    if (statusCode) {
      azureErrorType = this.classifyByStatusCode(statusCode);
    }

    // Classify by error code
    if (errorCode) {
      azureErrorType = this.classifyByErrorCode(errorCode);
    }

    // Classify by error message patterns
    if (errorMessage) {
      azureErrorType = this.classifyByMessage(errorMessage);
    }

    // Determine category and severity
    ({ category, severity } = this.determineCategoryAndSeverity(azureErrorType));

    // Determine if retryable
    const retryable = this.isRetryableError(azureErrorType, statusCode);

    // Get retry strategy
    const retryStrategy = this.getRetryStrategy(azureErrorType);

    // Generate user-friendly message
    const userMessage = this.generateUserMessage(azureErrorType);

    // Generate technical details
    const technicalDetails = this.generateTechnicalDetails(error, azureErrorType, context);

    // Get recovery suggestions
    const recoverySuggestions = this.getRecoverySuggestions(azureErrorType);

    return {
      azureErrorType,
      category,
      severity,
      retryable,
      retryStrategy,
      userMessage,
      technicalDetails,
      recoverySuggestions,
    };
  }

  /**
   * Execute recovery actions for error type
   */
  async executeRecovery(errorType: AzureErrorType, _context: ErrorHandlingContext): Promise<boolean> {
    const actions = this.recoveryActions.get(errorType) || [];

    // Sort actions by priority
    const sortedActions = actions.sort((a, b) => b.priority - a.priority);

    for (const action of sortedActions) {
      if (action.automated && action.execute) {
        try {
          console.log(`[AzureErrorHandler] Executing recovery action: ${action.description}`);
          await action.execute();

          this.stats.successfulRecoveries++;
          return true;
        } catch (recoveryError) {
          console.error(`[AzureErrorHandler] Recovery action failed: ${action.description}:`, recoveryError);
          this.stats.failedRecoveries++;
        }
      }
    }

    return false;
  }

  /**
   * Get error handling statistics
   */
  getStats(): ErrorHandlingStats {
    this.updateCommonErrors();
    this.updateRecoverySuccessRate();
    this.stats.lastUpdated = new Date().toISOString();
    return { ...this.stats };
  }

  /**
   * Update retry configuration
   */
  updateRetryConfig(config: Partial<AzureRetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config };
    console.log('[AzureErrorHandler] Retry configuration updated');
  }

  /**
   * Clear error statistics
   */
  clearStats(): void {
    this.stats = this.initializeStats();
    console.log('[AzureErrorHandler] Error statistics cleared');
  }

  /**
   * Extract error message from various error types
   */
  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'object' && error !== null) {
      return (
        (error as { message?: string; description?: string }).message ||
        (error as { message?: string; description?: string }).description ||
        JSON.stringify(error)
      );
    }
    return String(error);
  }

  /**
   * Extract HTTP status code from error
   */
  private extractStatusCode(error: unknown): number | null {
    if (typeof error === 'object' && error !== null) {
      const err = error as { status?: number; statusCode?: number; code?: number };
      return err.status || err.statusCode || err.code || null;
    }
    return null;
  }

  /**
   * Extract error code from Azure response
   */
  private extractErrorCode(error: unknown): string | null {
    if (typeof error === 'object' && error !== null) {
      const err = error as { errorCode?: string; code?: string; error?: { code?: string } };
      return err.errorCode || err.code || err.error?.code || null;
    }
    return null;
  }

  /**
   * Classify error by HTTP status code
   */
  private classifyByStatusCode(statusCode: number): AzureErrorType {
    switch (statusCode) {
      case 400:
        return 'bad_request';
      case 401:
        return 'authentication_failed';
      case 403:
        return 'subscription_key_invalid';
      case 404:
        return 'resource_not_found';
      case 408:
        return 'request_timeout';
      case 413:
        return 'audio_too_large';
      case 429:
        return 'rate_limit_exceeded';
      case 500:
        return 'internal_server_error';
      case 503:
        return 'service_unavailable';
      default:
        return 'internal_server_error';
    }
  }

  /**
   * Classify error by Azure error code
   */
  private classifyByErrorCode(errorCode: string): AzureErrorType {
    const lowerCode = errorCode.toLowerCase();

    if (lowerCode.includes('auth')) return 'authentication_failed';
    if (lowerCode.includes('quota')) return 'quota_exceeded';
    if (lowerCode.includes('rate')) return 'rate_limit_exceeded';
    if (lowerCode.includes('region')) return 'region_unavailable';
    if (lowerCode.includes('format')) return 'audio_format_unsupported';
    if (lowerCode.includes('language')) return 'language_not_supported';
    if (lowerCode.includes('concurrent')) return 'concurrent_limit_exceeded';

    return 'internal_server_error';
  }

  /**
   * Classify error by message patterns
   */
  private classifyByMessage(message: string): AzureErrorType {
    const lowerMessage = message.toLowerCase();

    for (const [pattern, errorType] of this.errorPatterns) {
      if (pattern.test(lowerMessage)) {
        return errorType;
      }
    }

    return 'internal_server_error';
  }

  /**
   * Determine error category and severity
   */
  private determineCategoryAndSeverity(errorType: AzureErrorType): {
    category: ErrorCategory;
    severity: ErrorSeverity;
  } {
    switch (errorType) {
      case 'authentication_failed':
      case 'subscription_key_invalid':
        return { category: 'authentication', severity: 'high' };

      case 'quota_exceeded':
      case 'rate_limit_exceeded':
      case 'concurrent_limit_exceeded':
        return { category: 'quota', severity: 'medium' };

      case 'audio_format_unsupported':
      case 'audio_too_large':
      case 'audio_too_short':
      case 'language_not_supported':
        return { category: 'validation', severity: 'medium' };

      case 'service_unavailable':
      case 'region_unavailable':
        return { category: 'service', severity: 'high' };

      case 'request_timeout':
        return { category: 'network', severity: 'low' };

      default:
        return { category: 'system', severity: 'medium' };
    }
  }

  /**
   * Check if error type is retryable
   */
  private isRetryableError(errorType: AzureErrorType, statusCode: number | null): boolean {
    const retryableTypes: AzureErrorType[] = [
      'request_timeout',
      'service_unavailable',
      'internal_server_error',
      'rate_limit_exceeded',
    ];

    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];

    return retryableTypes.includes(errorType) || (statusCode !== null && retryableStatusCodes.includes(statusCode));
  }

  /**
   * Get retry strategy for error type
   */
  private getRetryStrategy(errorType: AzureErrorType): RetryStrategy {
    switch (errorType) {
      case 'rate_limit_exceeded':
      case 'quota_exceeded':
        return 'exponential_backoff';

      case 'request_timeout':
      case 'service_unavailable':
        return 'linear_backoff';

      case 'concurrent_limit_exceeded':
        return 'adaptive_backoff';

      default:
        return 'none';
    }
  }

  /**
   * Should retry this specific error
   */
  private shouldRetryError(classification: ErrorClassification, context: ErrorHandlingContext): boolean {
    if (!classification.retryable) {
      return false;
    }

    if (context.retryAttempt >= this.retryConfig.maxAttempts) {
      return false;
    }

    // Check custom retry conditions
    if (this.retryConfig.retryConditions.customCondition) {
      return this.retryConfig.retryConditions.customCondition(classification);
    }

    return true;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    const baseDelay = this.retryConfig.initialDelay;
    const maxDelay = this.retryConfig.maxDelay;
    const factor = this.retryConfig.backoffFactor;

    let delay = Math.min(baseDelay * Math.pow(factor, attempt), maxDelay);

    // Add jitter if enabled
    if (this.retryConfig.enableJitter) {
      const jitter = delay * 0.1 * Math.random();
      delay += jitter;
    }

    return Math.floor(delay);
  }

  /**
   * Generate user-friendly error message
   */
  private generateUserMessage(errorType: AzureErrorType): string {
    switch (errorType) {
      case 'authentication_failed':
        return 'Authentication failed. Please check your Azure credentials.';

      case 'quota_exceeded':
        return 'Azure quota exceeded. Please try again later or upgrade your plan.';

      case 'rate_limit_exceeded':
        return 'Rate limit exceeded. The request will be retried automatically.';

      case 'audio_format_unsupported':
        return 'Audio format not supported. Please use a supported format like MP3 or WAV.';

      case 'service_unavailable':
        return 'Azure service is temporarily unavailable. Please try again later.';

      default:
        return 'An error occurred while processing your request. Please try again.';
    }
  }

  /**
   * Generate technical error details
   */
  private generateTechnicalDetails(error: unknown, errorType: AzureErrorType, context: ErrorHandlingContext): string {
    const details = [
      `Error Type: ${errorType}`,
      `Request ID: ${context.requestId}`,
      `Region: ${context.azureConfig.region}`,
      `Retry Attempt: ${context.retryAttempt}`,
      `Timestamp: ${context.requestTimestamp}`,
    ];

    const errorMessage = this.extractErrorMessage(error);
    if (errorMessage) {
      details.push(`Error Message: ${errorMessage}`);
    }

    const statusCode = this.extractStatusCode(error);
    if (statusCode) {
      details.push(`Status Code: ${statusCode}`);
    }

    return details.join('\n');
  }

  /**
   * Get recovery suggestions for error type
   */
  private getRecoverySuggestions(errorType: AzureErrorType): string[] {
    switch (errorType) {
      case 'authentication_failed':
        return [
          'Verify your Azure subscription key',
          'Check if your key has expired',
          "Ensure you're using the correct region",
        ];

      case 'quota_exceeded':
        return ['Wait for quota reset', 'Upgrade your Azure plan', 'Distribute requests across multiple keys'];

      case 'audio_format_unsupported':
        return [
          'Convert audio to MP3 or WAV format',
          'Check audio file encoding',
          'Reduce audio file size if too large',
        ];

      default:
        return ['Try again later', 'Check network connectivity', 'Contact support if issue persists'];
    }
  }

  /**
   * Get recovery actions for error type
   */
  private getRecoveryActions(errorType: AzureErrorType): RecoveryAction[] {
    return this.recoveryActions.get(errorType) || [];
  }

  /**
   * Create transcription error object
   */
  private createTranscriptionError(
    originalError: unknown,
    classification: ErrorClassification,
    context: ErrorHandlingContext,
  ): TranscriptionError {
    return {
      id: `azure-error-${Date.now()}`,
      type: 'api' as TranscriptionErrorType,
      category: classification.category,
      severity: classification.severity,
      message: classification.userMessage,
      details: classification.technicalDetails,
      timestamp: new Date().toISOString(),
      retryStrategy: classification.retryStrategy,
      retryable: classification.retryable,
      context: {
        requestId: context.requestId,
        azureErrorType: classification.azureErrorType,
        region: context.azureConfig.region,
      },
      recoverySuggestions: classification.recoverySuggestions,
    };
  }

  /**
   * Create default classification for unknown errors
   */
  private createDefaultClassification(error: unknown): ErrorClassification {
    return {
      azureErrorType: 'internal_server_error',
      category: 'system',
      severity: 'medium',
      retryable: false,
      retryStrategy: 'none',
      userMessage: 'An unexpected error occurred',
      technicalDetails: this.extractErrorMessage(error),
      recoverySuggestions: ['Try again later', 'Contact support if issue persists'],
    };
  }

  /**
   * Initialize error pattern matching
   */
  private initializeErrorPatterns(): void {
    this.errorPatterns.set(/authentication.*failed/i, 'authentication_failed');
    this.errorPatterns.set(/invalid.*subscription.*key/i, 'subscription_key_invalid');
    this.errorPatterns.set(/quota.*exceeded/i, 'quota_exceeded');
    this.errorPatterns.set(/rate.*limit.*exceeded/i, 'rate_limit_exceeded');
    this.errorPatterns.set(/region.*unavailable/i, 'region_unavailable');
    this.errorPatterns.set(/unsupported.*format/i, 'audio_format_unsupported');
    this.errorPatterns.set(/file.*too.*large/i, 'audio_too_large');
    this.errorPatterns.set(/audio.*too.*short/i, 'audio_too_short');
    this.errorPatterns.set(/language.*not.*supported/i, 'language_not_supported');
    this.errorPatterns.set(/service.*unavailable/i, 'service_unavailable');
    this.errorPatterns.set(/timeout/i, 'request_timeout');
    this.errorPatterns.set(/concurrent.*limit/i, 'concurrent_limit_exceeded');
  }

  /**
   * Initialize recovery actions
   */
  private initializeRecoveryActions(): void {
    // Rate limit recovery
    this.recoveryActions.set('rate_limit_exceeded', [
      {
        type: 'retry',
        description: 'Wait and retry with exponential backoff',
        priority: 1,
        automated: true,
      },
    ]);

    // Authentication recovery
    this.recoveryActions.set('authentication_failed', [
      {
        type: 'notify_user',
        description: 'Notify user to check credentials',
        priority: 1,
        automated: true,
      },
    ]);

    // Service unavailable recovery
    this.recoveryActions.set('service_unavailable', [
      {
        type: 'retry',
        description: 'Retry after delay',
        priority: 1,
        automated: true,
      },
      {
        type: 'fallback',
        description: 'Use fallback service',
        priority: 2,
        automated: false,
      },
    ]);
  }

  /**
   * Update error statistics
   */
  private updateErrorStats(classification: ErrorClassification): void {
    this.stats.totalErrors++;

    this.stats.errorsByType[classification.azureErrorType] =
      (this.stats.errorsByType[classification.azureErrorType] || 0) + 1;

    this.stats.errorsBySeverity[classification.severity] =
      (this.stats.errorsBySeverity[classification.severity] || 0) + 1;

    this.stats.lastError = new Date().toISOString();
  }

  /**
   * Update common errors list
   */
  private updateCommonErrors(): void {
    const errorCounts = Object.entries(this.stats.errorsByType)
      .map(([type, count]) => ({
        type: type as AzureErrorType,
        count,
        percentage: (count / this.stats.totalErrors) * 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    this.stats.commonErrors = errorCounts;
  }

  /**
   * Update recovery success rate
   */
  private updateRecoverySuccessRate(): void {
    const totalRecoveries = this.stats.successfulRecoveries + this.stats.failedRecoveries;
    this.stats.recoverySuccessRate =
      totalRecoveries > 0 ? (this.stats.successfulRecoveries / totalRecoveries) * 100 : 0;
  }

  /**
   * Initialize error handling statistics
   */
  private initializeStats(): ErrorHandlingStats {
    return {
      totalErrors: 0,
      errorsByType: {
        authentication_failed: 0,
        subscription_key_invalid: 0,
        quota_exceeded: 0,
        rate_limit_exceeded: 0,
        region_unavailable: 0,
        audio_format_unsupported: 0,
        audio_too_large: 0,
        audio_too_short: 0,
        language_not_supported: 0,
        service_unavailable: 0,
        request_timeout: 0,
        internal_server_error: 0,
        bad_request: 0,
        resource_not_found: 0,
        concurrent_limit_exceeded: 0,
      },
      errorsBySeverity: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      },
      successfulRecoveries: 0,
      failedRecoveries: 0,
      commonErrors: [],
      recoverySuccessRate: 0,
      lastUpdated: new Date().toISOString(),
    };
  }
}
