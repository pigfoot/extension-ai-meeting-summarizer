/**
 * Error Display Component
 *
 * Implements error message display with resolution actions, error categorization
 * and help link integration. Displays errors with actionable guidance.
 */

import { cn } from '../utils';
import { useState } from 'react';
import type React from 'react';

/**
 * Error severity levels
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Error categories
 */
export type ErrorCategory =
  | 'network'
  | 'authentication'
  | 'validation'
  | 'configuration'
  | 'storage'
  | 'api'
  | 'parsing'
  | 'timeout'
  | 'quota'
  | 'unknown';

/**
 * Error resolution action
 */
export interface ErrorAction {
  /** Action label */
  label: string;
  /** Action handler */
  action: () => void | Promise<void>;
  /** Action type */
  type?: 'primary' | 'secondary' | 'danger';
  /** Whether action is loading */
  loading?: boolean;
  /** Whether action is disabled */
  disabled?: boolean;
  /** Action icon */
  icon?: string;
}

/**
 * Help link information
 */
export interface HelpLink {
  /** Link text */
  text: string;
  /** Link URL */
  url: string;
  /** Whether link opens in new tab */
  external?: boolean;
  /** Link icon */
  icon?: string;
}

/**
 * Error information interface
 */
export interface ErrorInfo {
  /** Error title */
  title: string;
  /** Error message */
  message: string;
  /** Error code */
  code?: string;
  /** Error category */
  category: ErrorCategory;
  /** Error severity */
  severity: ErrorSeverity;
  /** Detailed error description */
  details?: string;
  /** Technical error details */
  technicalDetails?: string;
  /** Stack trace */
  stackTrace?: string;
  /** Timestamp when error occurred */
  timestamp?: Date;
  /** Whether error is recoverable */
  recoverable?: boolean;
  /** Resolution suggestions */
  suggestions?: string[];
  /** Error actions */
  actions?: ErrorAction[];
  /** Help links */
  helpLinks?: HelpLink[];
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Error display component props
 */
export interface ErrorDisplayProps {
  /** Error information */
  error: ErrorInfo;
  /** Show detailed information */
  showDetails?: boolean;
  /** Show technical details */
  showTechnicalDetails?: boolean;
  /** Show stack trace */
  showStackTrace?: boolean;
  /** Show timestamp */
  showTimestamp?: boolean;
  /** Compact mode */
  compact?: boolean;
  /** Custom class name */
  className?: string;
  /** Dismissible error */
  dismissible?: boolean;
  /** Dismiss handler */
  onDismiss?: () => void;
  /** Collapsible details */
  collapsible?: boolean;
  /** Default expanded state */
  defaultExpanded?: boolean;
}

/**
 * Get error icon based on category and severity
 */
const getErrorIcon = (category: ErrorCategory, severity: ErrorSeverity): string => {
  if (severity === 'critical') return '🚨';

  switch (category) {
    case 'network':
      return '🌐';
    case 'authentication':
      return '🔐';
    case 'validation':
      return '✋';
    case 'configuration':
      return '⚙️';
    case 'storage':
      return '💾';
    case 'api':
      return '🔌';
    case 'parsing':
      return '📝';
    case 'timeout':
      return '⏰';
    case 'quota':
      return '📊';
    case 'unknown':
    default:
      return '❌';
  }
};

/**
 * Get error colors based on severity
 */
const getErrorColors = (
  severity: ErrorSeverity,
): {
  bg: string;
  border: string;
  text: string;
  icon: string;
} => {
  switch (severity) {
    case 'low':
      return {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-800',
        icon: 'text-blue-600',
      };
    case 'medium':
      return {
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        text: 'text-yellow-800',
        icon: 'text-yellow-600',
      };
    case 'high':
      return {
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        text: 'text-orange-800',
        icon: 'text-orange-600',
      };
    case 'critical':
      return {
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-800',
        icon: 'text-red-600',
      };
    default:
      return {
        bg: 'bg-gray-50',
        border: 'border-gray-200',
        text: 'text-gray-800',
        icon: 'text-gray-600',
      };
  }
};

/**
 * Format error category for display
 */
const formatCategory = (category: ErrorCategory): string => {
  switch (category) {
    case 'network':
      return 'Network Error';
    case 'authentication':
      return 'Authentication Error';
    case 'validation':
      return 'Validation Error';
    case 'configuration':
      return 'Configuration Error';
    case 'storage':
      return 'Storage Error';
    case 'api':
      return 'API Error';
    case 'parsing':
      return 'Parsing Error';
    case 'timeout':
      return 'Timeout Error';
    case 'quota':
      return 'Quota Error';
    case 'unknown':
    default:
      return 'Unknown Error';
  }
};

/**
 * Format timestamp for display
 */
const formatTimestamp = (timestamp: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - timestamp.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours > 0) {
    return `${diffHours}h ago`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes}m ago`;
  } else {
    return 'Just now';
  }
};

/**
 * Error action button component
 */
const ErrorActionButton: React.FC<{
  action: ErrorAction;
  compact?: boolean;
}> = ({ action, compact = false }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (action.disabled || isLoading) return;

    setIsLoading(true);
    try {
      await action.action();
    } catch (error) {
      console.error('Error action failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getButtonClasses = () => {
    const baseClasses =
      'inline-flex items-center gap-2 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
    const sizeClasses = compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm';

    switch (action.type) {
      case 'primary':
        return `${baseClasses} ${sizeClasses} bg-blue-600 text-white hover:bg-blue-700`;
      case 'danger':
        return `${baseClasses} ${sizeClasses} bg-red-600 text-white hover:bg-red-700`;
      case 'secondary':
      default:
        return `${baseClasses} ${sizeClasses} bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300`;
    }
  };

  return (
    <button onClick={handleClick} disabled={action.disabled || isLoading} className={getButtonClasses()}>
      {action.icon && !isLoading && <span>{action.icon}</span>}
      {isLoading && <span className="animate-spin">⏳</span>}
      <span>{isLoading && action.loading ? 'Loading...' : action.label}</span>
    </button>
  );
};

/**
 * Help link component
 */
const HelpLinkComponent: React.FC<{
  helpLink: HelpLink;
  compact?: boolean;
}> = ({ helpLink, compact = false }) => {
  const linkClasses = cn(
    'inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline transition-colors',
    compact ? 'text-xs' : 'text-sm',
  );

  return (
    <a
      href={helpLink.url}
      className={linkClasses}
      target={helpLink.external ? '_blank' : undefined}
      rel={helpLink.external ? 'noopener noreferrer' : undefined}>
      {helpLink.icon && <span>{helpLink.icon}</span>}
      <span>{helpLink.text}</span>
      {helpLink.external && <span>🔗</span>}
    </a>
  );
};

/**
 * Expandable details section component
 */
const ExpandableDetails: React.FC<{
  title: string;
  content: string;
  compact?: boolean;
  defaultExpanded?: boolean;
}> = ({ title, content, compact = false, defaultExpanded = false }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="rounded border border-gray-200">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-gray-50',
          compact ? 'text-sm' : 'text-base',
        )}>
        <span className="font-medium text-gray-700">{title}</span>
        <span className={cn('transform transition-transform', isExpanded ? 'rotate-180' : '')}>▼</span>
      </button>
      {isExpanded && (
        <div className={cn('border-t border-gray-200 bg-gray-50 px-3 py-2')}>
          <pre
            className={cn(
              'overflow-x-auto whitespace-pre-wrap font-mono text-gray-600',
              compact ? 'text-xs' : 'text-sm',
            )}>
            {content}
          </pre>
        </div>
      )}
    </div>
  );
};

/**
 * Main ErrorDisplay component
 */
export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  showDetails = true,
  showTechnicalDetails = false,
  showStackTrace = false,
  showTimestamp = true,
  compact = false,
  className,
  dismissible = false,
  onDismiss,
  collapsible = true,
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isDismissed, setIsDismissed] = useState(false);

  const colors = getErrorColors(error.severity);
  const icon = getErrorIcon(error.category, error.severity);
  const categoryLabel = formatCategory(error.category);

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  if (isDismissed) {
    return null;
  }

  const containerPadding = compact ? 'p-3' : 'p-4';
  const titleSize = compact ? 'text-sm' : 'text-base';
  const textSize = compact ? 'text-xs' : 'text-sm';

  return (
    <div className={cn('rounded-lg border', colors.bg, colors.border, containerPadding, className)}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className={cn('flex-shrink-0 text-xl', colors.icon)}>{icon}</span>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <h3 className={cn('font-semibold', colors.text, titleSize)}>{error.title}</h3>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-medium',
                  colors.bg.replace('50', '100'),
                  colors.text,
                )}>
                {categoryLabel}
              </span>
              {error.code && (
                <span className={cn('rounded bg-gray-100 px-2 py-0.5 font-mono text-gray-700', textSize)}>
                  {error.code}
                </span>
              )}
            </div>
            <p className={cn(colors.text, textSize)}>{error.message}</p>
            {showTimestamp && error.timestamp && (
              <p className={cn('mt-1 text-gray-500', compact ? 'text-xs' : 'text-xs')}>
                {formatTimestamp(error.timestamp)}
              </p>
            )}
          </div>
        </div>

        <div className="ml-3 flex items-center gap-2">
          {collapsible && showDetails && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={cn('rounded p-1 transition-colors hover:bg-gray-200', colors.text)}
              title={isExpanded ? 'Collapse details' : 'Expand details'}>
              <span className={cn('transform transition-transform', isExpanded ? 'rotate-180' : '')}>▼</span>
            </button>
          )}
          {dismissible && (
            <button
              onClick={handleDismiss}
              className={cn('rounded p-1 transition-colors hover:bg-gray-200', colors.text)}
              title="Dismiss">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Details */}
      {showDetails && (!collapsible || isExpanded) && (
        <div className="mt-4 space-y-3">
          {/* Error Details */}
          {error.details && (
            <div>
              <h4 className={cn('mb-2 font-medium', colors.text, textSize)}>Details</h4>
              <p className={cn('text-gray-700', textSize)}>{error.details}</p>
            </div>
          )}

          {/* Suggestions */}
          {error.suggestions && error.suggestions.length > 0 && (
            <div>
              <h4 className={cn('mb-2 font-medium', colors.text, textSize)}>Suggested Solutions</h4>
              <ul className={cn('list-inside list-disc space-y-1 text-gray-700', textSize)}>
                {error.suggestions.map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          {error.actions && error.actions.length > 0 && (
            <div>
              <h4 className={cn('mb-2 font-medium', colors.text, textSize)}>Actions</h4>
              <div className="flex flex-wrap gap-2">
                {error.actions.map((action, index) => (
                  <ErrorActionButton key={index} action={action} compact={compact} />
                ))}
              </div>
            </div>
          )}

          {/* Help Links */}
          {error.helpLinks && error.helpLinks.length > 0 && (
            <div>
              <h4 className={cn('mb-2 font-medium', colors.text, textSize)}>Help & Documentation</h4>
              <div className="flex flex-wrap gap-3">
                {error.helpLinks.map((helpLink, index) => (
                  <HelpLinkComponent key={index} helpLink={helpLink} compact={compact} />
                ))}
              </div>
            </div>
          )}

          {/* Technical Details */}
          {showTechnicalDetails && error.technicalDetails && (
            <ExpandableDetails
              title="Technical Details"
              content={error.technicalDetails}
              compact={compact}
              defaultExpanded={false}
            />
          )}

          {/* Stack Trace */}
          {showStackTrace && error.stackTrace && (
            <ExpandableDetails
              title="Stack Trace"
              content={error.stackTrace}
              compact={compact}
              defaultExpanded={false}
            />
          )}

          {/* Metadata */}
          {error.metadata && Object.keys(error.metadata).length > 0 && (
            <ExpandableDetails
              title="Additional Information"
              content={JSON.stringify(error.metadata, null, 2)}
              compact={compact}
              defaultExpanded={false}
            />
          )}

          {/* Recovery Status */}
          {error.recoverable !== undefined && (
            <div
              className={cn(
                'rounded border px-3 py-2',
                error.recoverable
                  ? 'border-green-200 bg-green-50 text-green-800'
                  : 'border-red-200 bg-red-50 text-red-800',
              )}>
              <div className="flex items-center gap-2">
                <span>{error.recoverable ? '✅' : '⚠️'}</span>
                <span className={cn('font-medium', textSize)}>
                  {error.recoverable ? 'Recoverable Error' : 'Critical Error'}
                </span>
              </div>
              <p className={cn('mt-1', compact ? 'text-xs' : 'text-sm')}>
                {error.recoverable
                  ? 'This error can typically be resolved by following the suggested actions.'
                  : 'This error requires immediate attention and may affect system functionality.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Error list component for displaying multiple errors
 */
export interface ErrorListProps {
  /** Array of errors */
  errors: ErrorInfo[];
  /** Show error numbers */
  showNumbers?: boolean;
  /** Compact mode */
  compact?: boolean;
  /** Custom class name */
  className?: string;
  /** Error dismiss handler */
  onErrorDismiss?: (index: number) => void;
  /** Clear all errors handler */
  onClearAll?: () => void;
}

/**
 * Error list component
 */
export const ErrorList: React.FC<ErrorListProps> = ({
  errors,
  showNumbers = true,
  compact = false,
  className,
  onErrorDismiss,
  onClearAll,
}) => {
  if (errors.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className={cn('font-semibold text-gray-900', compact ? 'text-base' : 'text-lg')}>
          Errors ({errors.length})
        </h3>
        {onClearAll && errors.length > 0 && (
          <button
            onClick={onClearAll}
            className={cn(
              'rounded border border-red-300 px-3 py-1 text-red-600 transition-colors hover:bg-red-50',
              compact ? 'text-xs' : 'text-sm',
            )}>
            Clear All
          </button>
        )}
      </div>

      {/* Error List */}
      <div className="space-y-2">
        {errors.map((error, index) => (
          <div key={index} className="relative">
            {showNumbers && (
              <div
                className={cn(
                  'absolute -left-8 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-red-100 font-medium text-red-800',
                  compact ? 'text-xs' : 'text-sm',
                )}>
                {index + 1}
              </div>
            )}
            <ErrorDisplay
              error={error}
              compact={compact}
              dismissible={!!onErrorDismiss}
              onDismiss={() => onErrorDismiss?.(index)}
              defaultExpanded={false}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
