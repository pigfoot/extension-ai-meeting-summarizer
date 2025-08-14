/**
 * Azure Speech error classifier
 * Categorizes different failure types and maps them to appropriate recovery strategies
 * with comprehensive error analysis and classification
 */

import { ErrorCategory, RetryStrategy, TranscriptionErrorType, ErrorSeverity } from '../types/errors';
import type { TranscriptionError } from '../types/errors';
import type { ErrorDetails } from '../types/index';

/**
 * Error classification result
 */
export interface ErrorClassification {
  /** Original error */
  error: Error | TranscriptionError;
  /** Error category */
  category: ErrorCategory;
  /** Recommended retry strategy */
  retryStrategy: RetryStrategy;
  /** Whether the error is retryable */
  retryable: boolean;
  /** Severity level (1-5, 5 being most severe) */
  severity: number;
  /** Suggested action for the user */
  userAction?: string;
  /** Technical details for debugging */
  technicalDetails: string;
  /** Whether the error requires user intervention */
  requiresUserIntervention: boolean;
  /** Estimated recovery time in milliseconds */
  estimatedRecoveryTime?: number;
  /** Classification timestamp */
  classifiedAt: Date;
}

/**
 * HTTP status code ranges
 */
const HTTP_STATUS_RANGES = {
  CLIENT_ERROR: { min: 400, max: 499 },
  SERVER_ERROR: { min: 500, max: 599 },
  RATE_LIMIT: [429],
  AUTHENTICATION: [401, 403],
  NOT_FOUND: [404],
  TIMEOUT: [408, 504],
  SERVICE_UNAVAILABLE: [503],
} as const;

/**
 * Azure-specific error codes
 */
const AZURE_ERROR_CODES = {
  QUOTA_EXCEEDED: ['QuotaExceeded', 'RateLimitExceeded', 'ConcurrentRequestLimitExceeded'],
  AUTHENTICATION_FAILED: ['Unauthorized', 'Forbidden', 'InvalidSubscriptionKey', 'InvalidApiKey'],
  INVALID_REQUEST: ['InvalidRequest', 'BadRequest', 'ValidationError', 'InvalidParameter'],
  RESOURCE_NOT_FOUND: ['NotFound', 'ResourceNotFound', 'TranscriptionNotFound'],
  SERVICE_ERROR: ['InternalServerError', 'ServiceUnavailable', 'ServiceError'],
  TIMEOUT: ['RequestTimeout', 'GatewayTimeout', 'OperationTimeout'],
  UNSUPPORTED_MEDIA: ['UnsupportedMediaType', 'InvalidAudioFormat', 'AudioTooLong', 'AudioTooShort'],
} as const;

/**
 * Network error patterns
 */
const NETWORK_ERROR_PATTERNS = [
  /network/i,
  /connection/i,
  /fetch/i,
  /cors/i,
  /dns/i,
  /timeout/i,
  /abort/i,
  /socket/i,
] as const;

/**
 * Audio-specific error patterns
 */
const AUDIO_ERROR_PATTERNS = [/audio/i, /media/i, /codec/i, /format/i, /duration/i, /sample/i, /bitrate/i] as const;

/**
 * Get HTTP status code from error
 */
function getHttpStatusCode(error: Error | TranscriptionError): number | undefined {
  if ('statusCode' in error && typeof error.statusCode === 'number') {
    return error.statusCode;
  }

  if ('status' in error && typeof error.status === 'number') {
    return error.status;
  }

  // Try to extract from message
  if (error.message) {
    const statusMatch = error.message.match(/(?:status|code)[:\s]*(\d{3})/i);
    if (statusMatch && statusMatch[1]) {
      return parseInt(statusMatch[1], 10);
    }
  }

  return undefined;
}

/**
 * Get Azure error code from error details
 */
function getAzureErrorCode(error: Error | TranscriptionError): string | undefined {
  if ('azureError' in error && error.azureError) {
    const azureError = error.azureError as ErrorDetails;
    return azureError.code;
  }

  if ('code' in error && typeof error.code === 'string') {
    return error.code;
  }

  return undefined;
}

/**
 * Check if error matches patterns
 */
function matchesPatterns(message: string, patterns: readonly RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(message));
}

/**
 * Classify HTTP status code
 */
function classifyHttpStatus(statusCode: number): {
  category: ErrorCategory;
  retryStrategy: RetryStrategy;
  retryable: boolean;
  severity: number;
} {
  if (HTTP_STATUS_RANGES.RATE_LIMIT.includes(statusCode as 429)) {
    return {
      category: ErrorCategory.QUOTA,
      retryStrategy: RetryStrategy.EXPONENTIAL_BACKOFF,
      retryable: true,
      severity: 3,
    };
  }

  if (HTTP_STATUS_RANGES.AUTHENTICATION.includes(statusCode as 401 | 403)) {
    return {
      category: ErrorCategory.AUTHENTICATION,
      retryStrategy: RetryStrategy.NONE,
      retryable: false,
      severity: 4,
    };
  }

  if (HTTP_STATUS_RANGES.NOT_FOUND.includes(statusCode as 404)) {
    return {
      category: ErrorCategory.CONFIGURATION,
      retryStrategy: RetryStrategy.NONE,
      retryable: false,
      severity: 3,
    };
  }

  if (HTTP_STATUS_RANGES.TIMEOUT.includes(statusCode as 408 | 504)) {
    return {
      category: ErrorCategory.NETWORK,
      retryStrategy: RetryStrategy.LINEAR_BACKOFF,
      retryable: true,
      severity: 2,
    };
  }

  if (HTTP_STATUS_RANGES.SERVICE_UNAVAILABLE.includes(statusCode as 503)) {
    return {
      category: ErrorCategory.SERVICE,
      retryStrategy: RetryStrategy.EXPONENTIAL_BACKOFF,
      retryable: true,
      severity: 3,
    };
  }

  if (statusCode >= HTTP_STATUS_RANGES.SERVER_ERROR.min) {
    return {
      category: ErrorCategory.SERVICE,
      retryStrategy: RetryStrategy.EXPONENTIAL_BACKOFF,
      retryable: true,
      severity: 4,
    };
  }

  if (statusCode >= HTTP_STATUS_RANGES.CLIENT_ERROR.min) {
    return {
      category: ErrorCategory.CONFIGURATION,
      retryStrategy: RetryStrategy.NONE,
      retryable: false,
      severity: 3,
    };
  }

  return {
    category: ErrorCategory.UNKNOWN,
    retryStrategy: RetryStrategy.NONE,
    retryable: false,
    severity: 3,
  };
}

/**
 * Classify Azure error code
 */
function classifyAzureError(errorCode: string): {
  category: ErrorCategory;
  retryStrategy: RetryStrategy;
  retryable: boolean;
  severity: number;
} {
  if (AZURE_ERROR_CODES.QUOTA_EXCEEDED.includes(errorCode as any)) {
    return {
      category: ErrorCategory.QUOTA,
      retryStrategy: RetryStrategy.EXPONENTIAL_BACKOFF,
      retryable: true,
      severity: 3,
    };
  }

  if (AZURE_ERROR_CODES.AUTHENTICATION_FAILED.includes(errorCode as any)) {
    return {
      category: ErrorCategory.AUTHENTICATION,
      retryStrategy: RetryStrategy.NONE,
      retryable: false,
      severity: 4,
    };
  }

  if (AZURE_ERROR_CODES.INVALID_REQUEST.includes(errorCode as any)) {
    return {
      category: ErrorCategory.CONFIGURATION,
      retryStrategy: RetryStrategy.NONE,
      retryable: false,
      severity: 3,
    };
  }

  if (AZURE_ERROR_CODES.RESOURCE_NOT_FOUND.includes(errorCode as any)) {
    return {
      category: ErrorCategory.CONFIGURATION,
      retryStrategy: RetryStrategy.NONE,
      retryable: false,
      severity: 3,
    };
  }

  if (AZURE_ERROR_CODES.SERVICE_ERROR.includes(errorCode as any)) {
    return {
      category: ErrorCategory.SERVICE,
      retryStrategy: RetryStrategy.EXPONENTIAL_BACKOFF,
      retryable: true,
      severity: 4,
    };
  }

  if (AZURE_ERROR_CODES.TIMEOUT.includes(errorCode as any)) {
    return {
      category: ErrorCategory.NETWORK,
      retryStrategy: RetryStrategy.LINEAR_BACKOFF,
      retryable: true,
      severity: 2,
    };
  }

  if (AZURE_ERROR_CODES.UNSUPPORTED_MEDIA.includes(errorCode as any)) {
    return {
      category: ErrorCategory.AUDIO,
      retryStrategy: RetryStrategy.NONE,
      retryable: false,
      severity: 3,
    };
  }

  return {
    category: ErrorCategory.UNKNOWN,
    retryStrategy: RetryStrategy.NONE,
    retryable: false,
    severity: 3,
  };
}

/**
 * Generate user action suggestion
 */
function generateUserAction(category: ErrorCategory, statusCode?: number, azureCode?: string): string | undefined {
  switch (category) {
    case ErrorCategory.AUTHENTICATION:
      return 'Please check your Azure Speech Service subscription key and region configuration';

    case ErrorCategory.QUOTA:
      return 'Azure API rate limit exceeded. Please wait and try again, or upgrade your subscription';

    case ErrorCategory.AUDIO:
      return 'Please check that the audio file is in a supported format (WAV, MP3, MP4) and not corrupted';

    case ErrorCategory.CONFIGURATION:
      if (statusCode === 404) {
        return 'The requested resource was not found. Please check the audio URL';
      }
      return 'Please check the transcription request parameters and audio URL';

    case ErrorCategory.NETWORK:
      return 'Network connection issue. Please check your internet connection and try again';

    case ErrorCategory.SERVICE:
      return 'Azure Speech Service is experiencing issues. Please try again later';

    default:
      return 'An unexpected error occurred. Please try again or contact support';
  }
}

/**
 * Estimate recovery time based on error type
 */
function estimateRecoveryTime(category: ErrorCategory, retryStrategy: RetryStrategy): number | undefined {
  switch (category) {
    case ErrorCategory.QUOTA:
      return 60000; // 1 minute

    case ErrorCategory.NETWORK:
      return 5000; // 5 seconds

    case ErrorCategory.SERVICE:
      return 120000; // 2 minutes

    case ErrorCategory.AUTHENTICATION:
    case ErrorCategory.CONFIGURATION:
    case ErrorCategory.AUDIO:
      return undefined; // Requires user intervention

    default:
      return 30000; // 30 seconds
  }
}

/**
 * Azure Speech error classifier
 */
export class ErrorClassifier {
  /**
   * Classify an error and determine recovery strategy
   */
  static classifyError(error: Error | TranscriptionError): ErrorClassification {
    const statusCode = getHttpStatusCode(error);
    const azureCode = getAzureErrorCode(error);
    const message = error.message || '';

    let classification = {
      category: ErrorCategory.UNKNOWN,
      retryStrategy: RetryStrategy.NONE,
      retryable: false,
      severity: 3,
    };

    // Classify based on Azure error code first (most specific)
    if (azureCode) {
      classification = classifyAzureError(azureCode);
    }
    // Then by HTTP status code
    else if (statusCode) {
      classification = classifyHttpStatus(statusCode);
    }
    // Finally by error message patterns
    else {
      if (matchesPatterns(message, NETWORK_ERROR_PATTERNS)) {
        classification = {
          category: ErrorCategory.NETWORK,
          retryStrategy: RetryStrategy.LINEAR_BACKOFF,
          retryable: true,
          severity: 2,
        };
      } else if (matchesPatterns(message, AUDIO_ERROR_PATTERNS)) {
        classification = {
          category: ErrorCategory.AUDIO,
          retryStrategy: RetryStrategy.NONE,
          retryable: false,
          severity: 3,
        };
      } else if (message.toLowerCase().includes('auth')) {
        classification = {
          category: ErrorCategory.AUTHENTICATION,
          retryStrategy: RetryStrategy.NONE,
          retryable: false,
          severity: 4,
        };
      } else if (message.toLowerCase().includes('timeout')) {
        classification = {
          category: ErrorCategory.NETWORK,
          retryStrategy: RetryStrategy.LINEAR_BACKOFF,
          retryable: true,
          severity: 2,
        };
      }
    }

    const userAction = generateUserAction(classification.category, statusCode, azureCode);
    const estimatedRecoveryTime = estimateRecoveryTime(classification.category, classification.retryStrategy);

    const requiresUserIntervention =
      !classification.retryable ||
      classification.category === ErrorCategory.AUTHENTICATION ||
      classification.category === ErrorCategory.AUDIO ||
      classification.category === ErrorCategory.CONFIGURATION;

    // Generate technical details
    let technicalDetails = `Error: ${message}`;
    if (statusCode) technicalDetails += `, HTTP Status: ${statusCode}`;
    if (azureCode) technicalDetails += `, Azure Code: ${azureCode}`;
    if ('azureError' in error && error.azureError) {
      technicalDetails += `, Azure Details: ${JSON.stringify(error.azureError)}`;
    }

    return {
      error,
      category: classification.category,
      retryStrategy: classification.retryStrategy,
      retryable: classification.retryable,
      severity: classification.severity,
      ...(userAction && { userAction }),
      technicalDetails,
      requiresUserIntervention,
      ...(estimatedRecoveryTime !== undefined && { estimatedRecoveryTime }),
      classifiedAt: new Date(),
    };
  }

  /**
   * Determine if error is recoverable through retry
   */
  static isRecoverable(error: Error | TranscriptionError): boolean {
    const classification = this.classifyError(error);
    return classification.retryable;
  }

  /**
   * Get retry strategy for error
   */
  static getRetryStrategy(error: Error | TranscriptionError): RetryStrategy {
    const classification = this.classifyError(error);
    return classification.retryStrategy;
  }

  /**
   * Get error severity level
   */
  static getErrorSeverity(error: Error | TranscriptionError): number {
    const classification = this.classifyError(error);
    return classification.severity;
  }

  /**
   * Check if error requires user intervention
   */
  static requiresUserIntervention(error: Error | TranscriptionError): boolean {
    const classification = this.classifyError(error);
    return classification.requiresUserIntervention;
  }

  /**
   * Get user-friendly error message
   */
  static getUserFriendlyMessage(error: Error | TranscriptionError): string {
    const classification = this.classifyError(error);
    return classification.userAction || 'An unexpected error occurred';
  }

  /**
   * Classify multiple errors and return aggregated statistics
   */
  static classifyErrors(errors: Array<Error | TranscriptionError>): {
    classifications: ErrorClassification[];
    stats: {
      total: number;
      retryable: number;
      requiresIntervention: number;
      byCategory: Record<ErrorCategory, number>;
      bySeverity: Record<number, number>;
    };
  } {
    const classifications = errors.map(error => this.classifyError(error));

    const stats = {
      total: classifications.length,
      retryable: classifications.filter(c => c.retryable).length,
      requiresIntervention: classifications.filter(c => c.requiresUserIntervention).length,
      byCategory: {} as Record<ErrorCategory, number>,
      bySeverity: {} as Record<number, number>,
    };

    // Count by category
    for (const classification of classifications) {
      stats.byCategory[classification.category] = (stats.byCategory[classification.category] || 0) + 1;
    }

    // Count by severity
    for (const classification of classifications) {
      stats.bySeverity[classification.severity] = (stats.bySeverity[classification.severity] || 0) + 1;
    }

    return { classifications, stats };
  }

  /**
   * Create a TranscriptionError from a generic error
   */
  static createTranscriptionError(error: Error, category?: ErrorCategory, retryable?: boolean): TranscriptionError {
    const classification = category ? { category, retryable: retryable ?? false } : this.classifyError(error);

    return {
      name: 'TranscriptionError',
      message: error.message,
      type: TranscriptionErrorType.UNKNOWN_ERROR,
      category: classification.category,
      retryable: classification.retryable,
      retryStrategy: RetryStrategy.NONE,
      severity: ErrorSeverity.MEDIUM,
      notifyUser: false,
      timestamp: new Date(),
      originalError: error,
    } as TranscriptionError;
  }
}
