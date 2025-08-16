/**
 * Status Indicator Component
 *
 * Implements status badges and connection indicators with color-coded status
 * and icon representations. Shows system status and connection health.
 */

import { cn } from '../utils';
import type React from 'react';

/**
 * Status types for system states
 */
export type SystemStatus = 'online' | 'offline' | 'connecting' | 'error' | 'warning' | 'maintenance' | 'unknown';

/**
 * Connection status types
 */
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'reconnecting' | 'failed' | 'timeout';

/**
 * Service health status types
 */
export type HealthStatus = 'healthy' | 'degraded' | 'partial_outage' | 'major_outage' | 'maintenance' | 'unknown';

/**
 * Processing status types
 */
export type ProcessingStatus = 'idle' | 'processing' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'queued';

/**
 * Generic status type union
 */
export type Status = SystemStatus | ConnectionStatus | HealthStatus | ProcessingStatus;

/**
 * Status indicator sizes
 */
export type StatusSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Status indicator variants
 */
export type StatusVariant = 'badge' | 'dot' | 'pill' | 'outline' | 'subtle';

/**
 * Base status indicator props
 */
export interface StatusIndicatorProps {
  /** Status value */
  status: Status;
  /** Status text label */
  label?: string;
  /** Additional description */
  description?: string;
  /** Component size */
  size?: StatusSize;
  /** Visual variant */
  variant?: StatusVariant;
  /** Show pulse animation */
  pulse?: boolean;
  /** Show status icon */
  showIcon?: boolean;
  /** Custom icon override */
  customIcon?: string;
  /** Custom class name */
  className?: string;
  /** Show tooltip on hover */
  tooltip?: boolean;
  /** Custom tooltip text */
  tooltipText?: string;
  /** Click handler */
  onClick?: () => void;
  /** Accessibility label */
  ariaLabel?: string;
}

/**
 * Connection indicator specific props
 */
export interface ConnectionIndicatorProps extends Omit<StatusIndicatorProps, 'status'> {
  /** Connection status */
  status: ConnectionStatus;
  /** Signal strength (0-100) */
  signalStrength?: number;
  /** Connection type */
  connectionType?: 'ethernet' | 'wifi' | 'cellular' | 'bluetooth';
  /** Latency in milliseconds */
  latency?: number;
  /** Show signal bars */
  showSignalBars?: boolean;
}

/**
 * System health indicator props
 */
export interface SystemHealthIndicatorProps extends Omit<StatusIndicatorProps, 'status'> {
  /** Health status */
  status: HealthStatus;
  /** Health score (0-100) */
  healthScore?: number;
  /** Show health percentage */
  showHealthScore?: boolean;
  /** Affected services count */
  affectedServices?: number;
}

/**
 * Get status configuration
 */
const getStatusConfig = (
  status: Status,
): {
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  icon: string;
  label: string;
} => {
  switch (status) {
    // System statuses
    case 'online':
      return {
        color: 'green',
        bgColor: 'bg-green-100',
        borderColor: 'border-green-200',
        textColor: 'text-green-800',
        icon: '🟢',
        label: 'Online',
      };
    case 'offline':
      return {
        color: 'gray',
        bgColor: 'bg-gray-100',
        borderColor: 'border-gray-200',
        textColor: 'text-gray-800',
        icon: '⚫',
        label: 'Offline',
      };
    case 'connecting':
      return {
        color: 'blue',
        bgColor: 'bg-blue-100',
        borderColor: 'border-blue-200',
        textColor: 'text-blue-800',
        icon: '🔄',
        label: 'Connecting',
      };

    // Connection statuses
    case 'connected':
      return {
        color: 'green',
        bgColor: 'bg-green-100',
        borderColor: 'border-green-200',
        textColor: 'text-green-800',
        icon: '📶',
        label: 'Connected',
      };
    case 'disconnected':
      return {
        color: 'red',
        bgColor: 'bg-red-100',
        borderColor: 'border-red-200',
        textColor: 'text-red-800',
        icon: '📵',
        label: 'Disconnected',
      };
    case 'reconnecting':
      return {
        color: 'yellow',
        bgColor: 'bg-yellow-100',
        borderColor: 'border-yellow-200',
        textColor: 'text-yellow-800',
        icon: '🔄',
        label: 'Reconnecting',
      };

    // Health statuses
    case 'healthy':
      return {
        color: 'green',
        bgColor: 'bg-green-100',
        borderColor: 'border-green-200',
        textColor: 'text-green-800',
        icon: '💚',
        label: 'Healthy',
      };
    case 'degraded':
      return {
        color: 'yellow',
        bgColor: 'bg-yellow-100',
        borderColor: 'border-yellow-200',
        textColor: 'text-yellow-800',
        icon: '⚠️',
        label: 'Degraded',
      };
    case 'partial_outage':
      return {
        color: 'orange',
        bgColor: 'bg-orange-100',
        borderColor: 'border-orange-200',
        textColor: 'text-orange-800',
        icon: '🔶',
        label: 'Partial Outage',
      };
    case 'major_outage':
      return {
        color: 'red',
        bgColor: 'bg-red-100',
        borderColor: 'border-red-200',
        textColor: 'text-red-800',
        icon: '🔴',
        label: 'Major Outage',
      };

    // Processing statuses
    case 'idle':
      return {
        color: 'gray',
        bgColor: 'bg-gray-100',
        borderColor: 'border-gray-200',
        textColor: 'text-gray-800',
        icon: '⏳',
        label: 'Idle',
      };
    case 'processing':
      return {
        color: 'blue',
        bgColor: 'bg-blue-100',
        borderColor: 'border-blue-200',
        textColor: 'text-blue-800',
        icon: '⚙️',
        label: 'Processing',
      };
    case 'paused':
      return {
        color: 'yellow',
        bgColor: 'bg-yellow-100',
        borderColor: 'border-yellow-200',
        textColor: 'text-yellow-800',
        icon: '⏸️',
        label: 'Paused',
      };
    case 'completed':
      return {
        color: 'green',
        bgColor: 'bg-green-100',
        borderColor: 'border-green-200',
        textColor: 'text-green-800',
        icon: '✅',
        label: 'Completed',
      };
    case 'failed':
      return {
        color: 'red',
        bgColor: 'bg-red-100',
        borderColor: 'border-red-200',
        textColor: 'text-red-800',
        icon: '❌',
        label: 'Failed',
      };
    case 'cancelled':
      return {
        color: 'gray',
        bgColor: 'bg-gray-100',
        borderColor: 'border-gray-200',
        textColor: 'text-gray-800',
        icon: '🚫',
        label: 'Cancelled',
      };
    case 'queued':
      return {
        color: 'purple',
        bgColor: 'bg-purple-100',
        borderColor: 'border-purple-200',
        textColor: 'text-purple-800',
        icon: '📋',
        label: 'Queued',
      };

    // Common statuses
    case 'error':
      return {
        color: 'red',
        bgColor: 'bg-red-100',
        borderColor: 'border-red-200',
        textColor: 'text-red-800',
        icon: '⚠️',
        label: 'Error',
      };
    case 'warning':
      return {
        color: 'yellow',
        bgColor: 'bg-yellow-100',
        borderColor: 'border-yellow-200',
        textColor: 'text-yellow-800',
        icon: '⚠️',
        label: 'Warning',
      };
    case 'maintenance':
      return {
        color: 'indigo',
        bgColor: 'bg-indigo-100',
        borderColor: 'border-indigo-200',
        textColor: 'text-indigo-800',
        icon: '🔧',
        label: 'Maintenance',
      };
    case 'timeout':
      return {
        color: 'red',
        bgColor: 'bg-red-100',
        borderColor: 'border-red-200',
        textColor: 'text-red-800',
        icon: '⏰',
        label: 'Timeout',
      };
    case 'unknown':
    default:
      return {
        color: 'gray',
        bgColor: 'bg-gray-100',
        borderColor: 'border-gray-200',
        textColor: 'text-gray-800',
        icon: '❓',
        label: 'Unknown',
      };
  }
};

/**
 * Get size classes
 */
const getSizeClasses = (
  size: StatusSize,
): {
  padding: string;
  textSize: string;
  iconSize: string;
  dotSize: string;
} => {
  switch (size) {
    case 'xs':
      return {
        padding: 'px-1.5 py-0.5',
        textSize: 'text-xs',
        iconSize: 'text-xs',
        dotSize: 'w-1.5 h-1.5',
      };
    case 'sm':
      return {
        padding: 'px-2 py-1',
        textSize: 'text-xs',
        iconSize: 'text-sm',
        dotSize: 'w-2 h-2',
      };
    case 'md':
      return {
        padding: 'px-2.5 py-1.5',
        textSize: 'text-sm',
        iconSize: 'text-base',
        dotSize: 'w-2.5 h-2.5',
      };
    case 'lg':
      return {
        padding: 'px-3 py-2',
        textSize: 'text-base',
        iconSize: 'text-lg',
        dotSize: 'w-3 h-3',
      };
    case 'xl':
      return {
        padding: 'px-4 py-2.5',
        textSize: 'text-lg',
        iconSize: 'text-xl',
        dotSize: 'w-4 h-4',
      };
    default:
      return {
        padding: 'px-2.5 py-1.5',
        textSize: 'text-sm',
        iconSize: 'text-base',
        dotSize: 'w-2.5 h-2.5',
      };
  }
};

/**
 * Get variant classes
 */
const getVariantClasses = (
  variant: StatusVariant,
  statusConfig: ReturnType<typeof getStatusConfig>,
  sizeClasses: ReturnType<typeof getSizeClasses>,
): string => {
  const baseClasses = 'inline-flex items-center font-medium';

  switch (variant) {
    case 'badge':
      return cn(
        baseClasses,
        'rounded-full border',
        statusConfig.bgColor,
        statusConfig.borderColor,
        statusConfig.textColor,
        sizeClasses.padding,
      );
    case 'dot':
      return cn(baseClasses, 'gap-1.5', statusConfig.textColor);
    case 'pill':
      return cn(baseClasses, 'rounded-full', statusConfig.bgColor, statusConfig.textColor, sizeClasses.padding);
    case 'outline':
      return cn(
        baseClasses,
        'rounded border-2',
        statusConfig.borderColor,
        statusConfig.textColor,
        'bg-transparent',
        sizeClasses.padding,
      );
    case 'subtle':
      return cn(baseClasses, 'rounded', statusConfig.textColor, sizeClasses.padding);
    default:
      return cn(
        baseClasses,
        'rounded-full border',
        statusConfig.bgColor,
        statusConfig.borderColor,
        statusConfig.textColor,
        sizeClasses.padding,
      );
  }
};

/**
 * Base StatusIndicator component
 */
export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  description,
  size = 'md',
  variant = 'badge',
  pulse = false,
  showIcon = true,
  customIcon,
  className,
  tooltip = false,
  tooltipText,
  onClick,
  ariaLabel,
}) => {
  const statusConfig = getStatusConfig(status);
  const sizeClasses = getSizeClasses(size);
  const variantClasses = getVariantClasses(variant, statusConfig, sizeClasses);

  const displayLabel = label || statusConfig.label;
  const displayIcon = customIcon || statusConfig.icon;

  const shouldPulse = pulse && (status === 'connecting' || status === 'reconnecting' || status === 'processing');

  const content = (
    <span
      className={cn(
        variantClasses,
        shouldPulse && 'animate-pulse',
        onClick && 'cursor-pointer hover:opacity-75',
        className,
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel || `Status: ${displayLabel}`}
      title={tooltip ? tooltipText || `${displayLabel}${description ? `: ${description}` : ''}` : undefined}>
      {variant === 'dot' ? (
        <span
          className={cn(
            'flex-shrink-0 rounded-full',
            statusConfig.bgColor.replace('bg-', 'bg-').replace('-100', '-500'),
            sizeClasses.dotSize,
            shouldPulse && 'animate-pulse',
          )}
        />
      ) : (
        showIcon && <span className={cn(sizeClasses.iconSize, shouldPulse && 'animate-spin')}>{displayIcon}</span>
      )}

      {(variant !== 'dot' || !showIcon) && displayLabel && (
        <span className={cn(sizeClasses.textSize, showIcon && variant !== 'dot' && 'ml-1.5')}>{displayLabel}</span>
      )}

      {variant === 'dot' && displayLabel && <span className={cn(sizeClasses.textSize)}>{displayLabel}</span>}
    </span>
  );

  if (description && !tooltip) {
    return (
      <div className="flex flex-col gap-1">
        {content}
        <span className={cn('text-gray-600', size === 'xs' ? 'text-xs' : 'text-sm')}>{description}</span>
      </div>
    );
  }

  return content;
};

/**
 * Connection status indicator with signal strength
 */
export const ConnectionIndicator: React.FC<ConnectionIndicatorProps> = ({
  status,
  signalStrength,
  connectionType,
  latency,
  showSignalBars = false,
  ...props
}) => {
  const getConnectionIcon = (): string => {
    if (showSignalBars && signalStrength !== undefined) {
      if (signalStrength >= 80) return '📶';
      if (signalStrength >= 60) return '📶';
      if (signalStrength >= 40) return '📶';
      if (signalStrength >= 20) return '📶';
      return '📵';
    }

    switch (connectionType) {
      case 'ethernet':
        return '🌐';
      case 'wifi':
        return '📶';
      case 'cellular':
        return '📱';
      case 'bluetooth':
        return '🔵';
      default:
        return '📶';
    }
  };

  const getLatencyStatus = (): string => {
    if (!latency) return '';
    if (latency < 50) return 'excellent';
    if (latency < 100) return 'good';
    if (latency < 200) return 'fair';
    return 'poor';
  };

  const latencyStatus = getLatencyStatus();
  const description = [
    signalStrength !== undefined && `Signal: ${signalStrength}%`,
    latency !== undefined && `Latency: ${latency}ms (${latencyStatus})`,
    connectionType && `Type: ${connectionType}`,
  ]
    .filter(Boolean)
    .join(' • ');

  return <StatusIndicator {...props} status={status} customIcon={getConnectionIcon()} description={description} />;
};

/**
 * System health indicator with health score
 */
export const SystemHealthIndicator: React.FC<SystemHealthIndicatorProps> = ({
  status,
  healthScore,
  showHealthScore = false,
  affectedServices,
  ...props
}) => {
  const getHealthLabel = (): string => {
    const baseLabel = getStatusConfig(status).label;
    if (showHealthScore && healthScore !== undefined) {
      return `${baseLabel} (${healthScore}%)`;
    }
    return baseLabel;
  };

  const description = [
    healthScore !== undefined && `Health Score: ${healthScore}%`,
    affectedServices !== undefined && affectedServices > 0 && `${affectedServices} services affected`,
  ]
    .filter(Boolean)
    .join(' • ');

  return <StatusIndicator {...props} status={status} label={getHealthLabel()} description={description} />;
};

/**
 * Multi-status indicator for showing multiple statuses
 */
export interface MultiStatusIndicatorProps {
  /** Array of status items */
  statuses: Array<{
    status: Status;
    label?: string;
    description?: string;
  }>;
  /** Component size */
  size?: StatusSize;
  /** Visual variant */
  variant?: StatusVariant;
  /** Layout direction */
  direction?: 'horizontal' | 'vertical';
  /** Custom class name */
  className?: string;
}

/**
 * Multi-status indicator component
 */
export const MultiStatusIndicator: React.FC<MultiStatusIndicatorProps> = ({
  statuses,
  size = 'md',
  variant = 'badge',
  direction = 'horizontal',
  className,
}) => {
  const gapClass = direction === 'horizontal' ? 'gap-2' : 'gap-1';
  const directionClass = direction === 'horizontal' ? 'flex-row' : 'flex-col';

  return (
    <div className={cn('flex', directionClass, gapClass, className)}>
      {statuses.map((item, index) => (
        <StatusIndicator
          key={index}
          status={item.status}
          {...(item.label && { label: item.label })}
          {...(item.description && { description: item.description })}
          size={size}
          variant={variant}
        />
      ))}
    </div>
  );
};

/**
 * Status timeline component for showing status history
 */
export interface StatusTimelineProps {
  /** Timeline entries */
  entries: Array<{
    status: Status;
    timestamp: Date;
    label?: string;
    description?: string;
  }>;
  /** Show timestamps */
  showTimestamps?: boolean;
  /** Compact mode */
  compact?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * Status timeline component
 */
export const StatusTimeline: React.FC<StatusTimelineProps> = ({
  entries,
  showTimestamps = true,
  compact = false,
  className,
}) => {
  const formatTimestamp = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMinutes > 0) return `${diffMinutes}m ago`;
    return 'Just now';
  };

  return (
    <div className={cn('space-y-3', className)}>
      {entries.map((entry, index) => (
        <div key={index} className="flex items-center gap-3">
          <StatusIndicator
            status={entry.status}
            {...(entry.label && { label: entry.label })}
            size={compact ? 'sm' : 'md'}
            variant="dot"
          />
          <div className="min-w-0 flex-1">
            {entry.description && (
              <p className={cn('text-gray-700', compact ? 'text-sm' : 'text-base')}>{entry.description}</p>
            )}
            {showTimestamps && (
              <p className={cn('text-gray-500', compact ? 'text-xs' : 'text-sm')}>{formatTimestamp(entry.timestamp)}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
