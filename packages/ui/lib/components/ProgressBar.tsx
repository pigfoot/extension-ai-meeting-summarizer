/**
 * Progress Bar Component
 *
 * Implements animated progress bar with percentage and time estimates.
 * Adds error states and completion animations for transcription progress display.
 */

import { cn } from '../utils';
import { useState, useEffect, useMemo } from 'react';
import type React from 'react';

/**
 * Progress status types
 */
export type ProgressStatus = 'idle' | 'active' | 'paused' | 'completed' | 'error' | 'cancelled';

/**
 * Progress bar size variants
 */
export type ProgressSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Progress bar color variants
 */
export type ProgressColor = 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray';

/**
 * Time estimate information
 */
export interface TimeEstimate {
  /** Estimated remaining time in milliseconds */
  remaining?: number;
  /** Estimated completion time */
  completionTime?: Date;
  /** Processing rate (items per second) */
  rate?: number;
  /** Time since start in milliseconds */
  elapsed?: number;
}

/**
 * Progress bar component props
 */
export interface ProgressBarProps {
  /** Progress value (0-100) */
  value: number;
  /** Maximum value (default: 100) */
  max?: number;
  /** Current status */
  status?: ProgressStatus;
  /** Progress bar size */
  size?: ProgressSize;
  /** Progress bar color theme */
  color?: ProgressColor;
  /** Show percentage text */
  showPercentage?: boolean;
  /** Show time estimates */
  showTimeEstimate?: boolean;
  /** Time estimate data */
  timeEstimate?: TimeEstimate;
  /** Custom label text */
  label?: string;
  /** Custom status text */
  statusText?: string;
  /** Enable animations */
  animated?: boolean;
  /** Enable striped pattern */
  striped?: boolean;
  /** Enable pulse animation */
  pulse?: boolean;
  /** Show completion animation */
  showCompletionAnimation?: boolean;
  /** Custom class name */
  className?: string;
  /** Compact mode */
  compact?: boolean;
  /** Accessibility label */
  ariaLabel?: string;
  /** Additional info text */
  info?: string;
  /** Error message */
  errorMessage?: string;
  /** Success message */
  successMessage?: string;
}

/**
 * Get progress bar height based on size
 */
const getProgressHeight = (size: ProgressSize): string => {
  switch (size) {
    case 'xs':
      return 'h-1';
    case 'sm':
      return 'h-2';
    case 'md':
      return 'h-3';
    case 'lg':
      return 'h-4';
    case 'xl':
      return 'h-6';
    default:
      return 'h-3';
  }
};

/**
 * Get text size based on progress bar size
 */
const getTextSize = (size: ProgressSize): string => {
  switch (size) {
    case 'xs':
      return 'text-xs';
    case 'sm':
      return 'text-xs';
    case 'md':
      return 'text-sm';
    case 'lg':
      return 'text-base';
    case 'xl':
      return 'text-lg';
    default:
      return 'text-sm';
  }
};

/**
 * Get color classes for progress bar
 */
const getColorClasses = (
  color: ProgressColor,
  status: ProgressStatus,
): {
  bg: string;
  text: string;
  border?: string;
} => {
  // Override color based on status
  if (status === 'error') {
    return {
      bg: 'bg-red-500',
      text: 'text-red-700',
      border: 'border-red-200',
    };
  }

  if (status === 'completed') {
    return {
      bg: 'bg-green-500',
      text: 'text-green-700',
      border: 'border-green-200',
    };
  }

  if (status === 'paused') {
    return {
      bg: 'bg-yellow-500',
      text: 'text-yellow-700',
      border: 'border-yellow-200',
    };
  }

  if (status === 'cancelled') {
    return {
      bg: 'bg-gray-500',
      text: 'text-gray-700',
      border: 'border-gray-200',
    };
  }

  // Use specified color for active/idle states
  switch (color) {
    case 'blue':
      return {
        bg: 'bg-blue-500',
        text: 'text-blue-700',
      };
    case 'green':
      return {
        bg: 'bg-green-500',
        text: 'text-green-700',
      };
    case 'yellow':
      return {
        bg: 'bg-yellow-500',
        text: 'text-yellow-700',
      };
    case 'red':
      return {
        bg: 'bg-red-500',
        text: 'text-red-700',
      };
    case 'purple':
      return {
        bg: 'bg-purple-500',
        text: 'text-purple-700',
      };
    case 'gray':
      return {
        bg: 'bg-gray-500',
        text: 'text-gray-700',
      };
    default:
      return {
        bg: 'bg-blue-500',
        text: 'text-blue-700',
      };
  }
};

/**
 * Format time duration
 */
const formatDuration = (milliseconds: number): string => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
};

/**
 * Format completion time
 */
const formatCompletionTime = (date: Date): string => {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();

  if (diffMs < 0) return 'Overdue';

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours > 0) {
    return `~${diffHours}h ${diffMinutes % 60}m`;
  } else if (diffMinutes > 0) {
    return `~${diffMinutes}m`;
  } else {
    return '<1m';
  }
};

/**
 * Get status icon
 */
const getStatusIcon = (status: ProgressStatus): string => {
  switch (status) {
    case 'idle':
      return '⏳';
    case 'active':
      return '🔄';
    case 'paused':
      return '⏸️';
    case 'completed':
      return '✅';
    case 'error':
      return '❌';
    case 'cancelled':
      return '🚫';
    default:
      return '⏳';
  }
};

/**
 * Get status text
 */
const getStatusText = (status: ProgressStatus): string => {
  switch (status) {
    case 'idle':
      return 'Ready';
    case 'active':
      return 'Processing';
    case 'paused':
      return 'Paused';
    case 'completed':
      return 'Completed';
    case 'error':
      return 'Error';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Unknown';
  }
};

/**
 * Progress bar component
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  status = 'idle',
  size = 'md',
  color = 'blue',
  showPercentage = true,
  showTimeEstimate = false,
  timeEstimate,
  label,
  statusText,
  animated = true,
  striped = false,
  pulse = false,
  showCompletionAnimation = true,
  className,
  compact = false,
  ariaLabel,
  info,
  errorMessage,
  successMessage,
}) => {
  const [showCompletion, setShowCompletion] = useState(false);
  const [prevValue, setPrevValue] = useState(value);

  // Calculate percentage
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  // Get styling classes
  const colorClasses = getColorClasses(color, status);
  const heightClass = getProgressHeight(size);
  const textSizeClass = getTextSize(size);

  // Handle completion animation
  useEffect(() => {
    if (showCompletionAnimation && status === 'completed' && prevValue < max && value >= max) {
      setShowCompletion(true);
      const timer = setTimeout(() => setShowCompletion(false), 2000);
      return () => clearTimeout(timer);
    }
    setPrevValue(value);
    return undefined;
  }, [value, max, prevValue, status, showCompletionAnimation]);

  // Memoize time estimate text
  const timeEstimateText = useMemo(() => {
    if (!timeEstimate) return null;

    const parts: string[] = [];

    if (timeEstimate.remaining) {
      parts.push(`${formatDuration(timeEstimate.remaining)} remaining`);
    }

    if (timeEstimate.completionTime) {
      parts.push(`ETA ${formatCompletionTime(timeEstimate.completionTime)}`);
    }

    if (timeEstimate.rate) {
      parts.push(`${timeEstimate.rate.toFixed(1)}/s`);
    }

    return parts.join(' • ');
  }, [timeEstimate]);

  return (
    <div className={cn('w-full', className)}>
      {/* Header */}
      {(!compact || label || statusText) && (
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {!compact && <span className="text-lg">{getStatusIcon(status)}</span>}
            <span className={cn('font-medium text-gray-900', textSizeClass)}>{label || getStatusText(status)}</span>
            {statusText && <span className={cn('text-gray-600', textSizeClass)}>{statusText}</span>}
          </div>
          {showPercentage && (
            <span className={cn('font-semibold', colorClasses.text, textSizeClass)}>{percentage.toFixed(0)}%</span>
          )}
        </div>
      )}

      {/* Progress Bar */}
      <div className="relative">
        <div
          className={cn(
            'w-full overflow-hidden rounded-full bg-gray-200',
            heightClass,
            colorClasses.border && `border ${colorClasses.border}`,
          )}>
          <div
            className={cn(
              'relative h-full overflow-hidden rounded-full transition-all duration-300 ease-out',
              colorClasses.bg,
              animated && 'transition-all duration-500',
              striped && 'bg-stripes',
              pulse && status === 'active' && 'animate-pulse',
            )}
            style={{ width: `${percentage}%` }}
            role="progressbar"
            aria-valuenow={value}
            aria-valuemin={0}
            aria-valuemax={max}
            aria-label={ariaLabel || `Progress: ${percentage.toFixed(0)}%`}>
            {/* Animated stripes */}
            {striped && status === 'active' && (
              <div className="animate-slide absolute inset-0 bg-gradient-to-r from-transparent via-transparent via-white to-transparent opacity-20" />
            )}

            {/* Shimmer effect for active state */}
            {animated && status === 'active' && (
              <div className="animate-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-transparent via-white to-transparent opacity-30" />
            )}
          </div>
        </div>

        {/* Completion animation overlay */}
        {showCompletion && <div className="absolute inset-0 animate-ping rounded-full bg-green-400 opacity-75" />}
      </div>

      {/* Footer Information */}
      {!compact && (
        <div className="mt-2 space-y-1">
          {/* Time Estimate */}
          {showTimeEstimate && timeEstimateText && (
            <div className={cn('text-gray-600', textSizeClass)}>{timeEstimateText}</div>
          )}

          {/* Additional Info */}
          {info && <div className={cn('text-gray-600', textSizeClass)}>{info}</div>}

          {/* Error Message */}
          {status === 'error' && errorMessage && (
            <div className={cn('font-medium text-red-600', textSizeClass)}>❌ {errorMessage}</div>
          )}

          {/* Success Message */}
          {status === 'completed' && successMessage && (
            <div className={cn('font-medium text-green-600', textSizeClass)}>✅ {successMessage}</div>
          )}

          {/* Elapsed Time */}
          {timeEstimate?.elapsed && (
            <div className={cn('text-gray-500', textSizeClass)}>Elapsed: {formatDuration(timeEstimate.elapsed)}</div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Multi-step progress bar component for complex processes
 */
export interface Step {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  progress?: number;
  description?: string;
}

export interface MultiStepProgressProps {
  /** Array of steps */
  steps: Step[];
  /** Current active step index */
  currentStep: number;
  /** Show step descriptions */
  showDescriptions?: boolean;
  /** Compact mode */
  compact?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * Multi-step progress component
 */
export const MultiStepProgress: React.FC<MultiStepProgressProps> = ({
  steps,
  currentStep,
  showDescriptions = false,
  compact = false,
  className,
}) => {
  const textSizeClass = compact ? 'text-xs' : 'text-sm';

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const isActive = index === currentStep;
          const isCompleted = step.status === 'completed';
          const isError = step.status === 'error';

          return (
            <div key={step.id} className={cn('flex items-center', !isLast && 'flex-1')}>
              {/* Step indicator */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors',
                    compact && 'h-6 w-6',
                    isCompleted && 'border-green-500 bg-green-500 text-white',
                    isError && 'border-red-500 bg-red-500 text-white',
                    isActive && !isCompleted && !isError && 'border-blue-500 bg-blue-500 text-white',
                    !isActive && !isCompleted && !isError && 'border-gray-300 bg-gray-200 text-gray-600',
                  )}>
                  {isCompleted ? (
                    <span className={compact ? 'text-xs' : 'text-sm'}>✓</span>
                  ) : isError ? (
                    <span className={compact ? 'text-xs' : 'text-sm'}>✕</span>
                  ) : (
                    <span className={cn('font-bold', compact ? 'text-xs' : 'text-sm')}>{index + 1}</span>
                  )}
                </div>

                <div className="mt-2 text-center">
                  <div
                    className={cn(
                      'font-medium',
                      textSizeClass,
                      isActive && 'text-blue-600',
                      isCompleted && 'text-green-600',
                      isError && 'text-red-600',
                      !isActive && !isCompleted && !isError && 'text-gray-600',
                    )}>
                    {step.label}
                  </div>
                  {showDescriptions && step.description && (
                    <div className={cn('mt-1 text-gray-500', compact ? 'text-xs' : 'text-xs')}>{step.description}</div>
                  )}
                  {step.progress !== undefined && isActive && (
                    <div className="mt-1">
                      <ProgressBar value={step.progress} size="xs" compact showPercentage={false} className="w-16" />
                    </div>
                  )}
                </div>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={cn('mx-2 h-0.5 flex-1 transition-colors', isCompleted ? 'bg-green-500' : 'bg-gray-300')}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Circular progress component
 */
export interface CircularProgressProps {
  /** Progress value (0-100) */
  value: number;
  /** Circle size in pixels */
  size?: number;
  /** Stroke width */
  strokeWidth?: number;
  /** Progress color */
  color?: ProgressColor;
  /** Show percentage in center */
  showPercentage?: boolean;
  /** Show status icon in center */
  showStatusIcon?: boolean;
  /** Current status */
  status?: ProgressStatus;
  /** Custom class name */
  className?: string;
}

/**
 * Circular progress component
 */
export const CircularProgress: React.FC<CircularProgressProps> = ({
  value,
  size = 64,
  strokeWidth = 4,
  color = 'blue',
  showPercentage = true,
  showStatusIcon = false,
  status = 'active',
  className,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min(Math.max(value, 0), 100);
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const colorClasses = getColorClasses(color, status);

  // Map color to stroke color
  const getStrokeColor = () => {
    if (status === 'error') return '#ef4444';
    if (status === 'completed') return '#10b981';
    if (status === 'paused') return '#f59e0b';
    if (status === 'cancelled') return '#6b7280';

    switch (color) {
      case 'blue':
        return '#3b82f6';
      case 'green':
        return '#10b981';
      case 'yellow':
        return '#f59e0b';
      case 'red':
        return '#ef4444';
      case 'purple':
        return '#8b5cf6';
      case 'gray':
        return '#6b7280';
      default:
        return '#3b82f6';
    }
  };

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} className="-rotate-90 transform">
        {/* Background circle */}
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />

        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getStrokeColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-300 ease-out"
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex items-center justify-center">
        {showStatusIcon ? (
          <span style={{ fontSize: size * 0.25 }}>{getStatusIcon(status)}</span>
        ) : showPercentage ? (
          <span className={cn('font-bold', colorClasses.text)} style={{ fontSize: size * 0.2 }}>
            {percentage.toFixed(0)}%
          </span>
        ) : null}
      </div>
    </div>
  );
};
