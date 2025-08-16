/**
 * Notification Manager Component
 *
 * Implements toast notifications for job completion with notification queuing
 * and auto-dismiss functionality. Manages completion notifications and alerts.
 */

import { cn } from '../utils';
import React, { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Notification types
 */
export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'loading';

/**
 * Notification priority levels
 */
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Notification position
 */
export type NotificationPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

/**
 * Notification action
 */
export interface NotificationAction {
  /** Action label */
  label: string;
  /** Action handler */
  action: () => void | Promise<void>;
  /** Action style */
  style?: 'primary' | 'secondary' | 'danger';
}

/**
 * Notification interface
 */
export interface Notification {
  /** Unique notification ID */
  id: string;
  /** Notification type */
  type: NotificationType;
  /** Notification title */
  title: string;
  /** Notification message */
  message?: string;
  /** Notification priority */
  priority?: NotificationPriority;
  /** Auto-dismiss timeout in milliseconds */
  timeout?: number;
  /** Whether notification is persistent */
  persistent?: boolean;
  /** Custom icon */
  icon?: string;
  /** Notification actions */
  actions?: NotificationAction[];
  /** Progress value (0-100) for loading notifications */
  progress?: number;
  /** Timestamp when notification was created */
  timestamp: Date;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Notification manager props
 */
export interface NotificationManagerProps {
  /** Notification position */
  position?: NotificationPosition;
  /** Maximum number of notifications to show */
  maxNotifications?: number;
  /** Default timeout for auto-dismiss */
  defaultTimeout?: number;
  /** Enable sound notifications */
  enableSound?: boolean;
  /** Compact mode */
  compact?: boolean;
  /** Custom class name */
  className?: string;
  /** Notification dismiss handler */
  onNotificationDismiss?: (notification: Notification) => void;
  /** Notification action handler */
  onNotificationAction?: (notification: Notification, action: NotificationAction) => void;
}

/**
 * Individual notification component props
 */
export interface NotificationItemProps {
  /** Notification data */
  notification: Notification;
  /** Dismiss handler */
  onDismiss: (id: string) => void;
  /** Action handler */
  onAction: (action: NotificationAction) => void;
  /** Compact mode */
  compact?: boolean;
  /** Show animation */
  animate?: boolean;
}

/**
 * Get notification icon
 */
const getNotificationIcon = (type: NotificationType, customIcon?: string): string => {
  if (customIcon) return customIcon;

  switch (type) {
    case 'success':
      return '✅';
    case 'error':
      return '❌';
    case 'warning':
      return '⚠️';
    case 'info':
      return 'ℹ️';
    case 'loading':
      return '⏳';
    default:
      return 'ℹ️';
  }
};

/**
 * Get notification colors
 */
const getNotificationColors = (
  type: NotificationType,
): {
  bg: string;
  border: string;
  text: string;
  icon: string;
} => {
  switch (type) {
    case 'success':
      return {
        bg: 'bg-green-50',
        border: 'border-green-200',
        text: 'text-green-800',
        icon: 'text-green-600',
      };
    case 'error':
      return {
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-800',
        icon: 'text-red-600',
      };
    case 'warning':
      return {
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        text: 'text-yellow-800',
        icon: 'text-yellow-600',
      };
    case 'info':
      return {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-800',
        icon: 'text-blue-600',
      };
    case 'loading':
      return {
        bg: 'bg-gray-50',
        border: 'border-gray-200',
        text: 'text-gray-800',
        icon: 'text-gray-600',
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
 * Get position classes
 */
const getPositionClasses = (position: NotificationPosition): string => {
  switch (position) {
    case 'top-left':
      return 'top-4 left-4';
    case 'top-center':
      return 'top-4 left-1/2 transform -translate-x-1/2';
    case 'top-right':
      return 'top-4 right-4';
    case 'bottom-left':
      return 'bottom-4 left-4';
    case 'bottom-center':
      return 'bottom-4 left-1/2 transform -translate-x-1/2';
    case 'bottom-right':
      return 'bottom-4 right-4';
    default:
      return 'top-4 right-4';
  }
};

/**
 * Progress bar component for loading notifications
 */
const NotificationProgress: React.FC<{
  progress: number;
  type: NotificationType;
  compact?: boolean;
}> = ({ progress, type, compact = false }) => {
  const colors = getNotificationColors(type);
  const height = compact ? 'h-1' : 'h-2';

  return (
    <div className={cn('mt-2 w-full overflow-hidden rounded-full bg-gray-200', height)}>
      <div
        className={cn(
          'h-full rounded-full transition-all duration-300',
          colors.icon.replace('text-', 'bg-').replace('-600', '-500'),
        )}
        style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
      />
    </div>
  );
};

/**
 * Notification action button component
 */
const NotificationActionButton: React.FC<{
  action: NotificationAction;
  onAction: () => void;
  compact?: boolean;
}> = ({ action, onAction, compact = false }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      await action.action();
      onAction();
    } catch (error) {
      console.error('Notification action failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getButtonClasses = () => {
    const baseClasses = 'inline-flex items-center gap-1 rounded font-medium transition-colors disabled:opacity-50';
    const sizeClasses = compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm';

    switch (action.style) {
      case 'primary':
        return `${baseClasses} ${sizeClasses} bg-blue-600 text-white hover:bg-blue-700`;
      case 'danger':
        return `${baseClasses} ${sizeClasses} bg-red-600 text-white hover:bg-red-700`;
      case 'secondary':
      default:
        return `${baseClasses} ${sizeClasses} bg-white text-gray-700 border border-gray-300 hover:bg-gray-50`;
    }
  };

  return (
    <button onClick={handleClick} disabled={isLoading} className={getButtonClasses()}>
      {isLoading && <span className="animate-spin">⏳</span>}
      <span>{action.label}</span>
    </button>
  );
};

/**
 * Individual notification component
 */
const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onDismiss,
  onAction,
  compact = false,
  animate = true,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const colors = getNotificationColors(notification.type);
  const icon = getNotificationIcon(notification.type, notification.icon);

  // Handle auto-dismiss
  useEffect(() => {
    if (notification.timeout && !notification.persistent) {
      timeoutRef.current = setTimeout(() => {
        handleDismiss();
      }, notification.timeout);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [notification.timeout, notification.persistent]);

  // Handle entry animation
  useEffect(() => {
    if (animate) {
      const timer = setTimeout(() => setIsVisible(true), 50);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(true);
    }
    return undefined;
  }, [animate]);

  const handleDismiss = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (animate) {
      setIsExiting(true);
      setTimeout(() => {
        onDismiss(notification.id);
      }, 300);
    } else {
      onDismiss(notification.id);
    }
  };

  const handleAction = (action: NotificationAction) => {
    onAction(action);
  };

  const containerPadding = compact ? 'p-3' : 'p-4';
  const titleSize = compact ? 'text-sm' : 'text-base';
  const messageSize = compact ? 'text-xs' : 'text-sm';

  return (
    <div
      className={cn(
        'w-full max-w-sm rounded-lg border shadow-lg transition-all duration-300 ease-in-out',
        colors.bg,
        colors.border,
        animate && !isVisible && 'translate-x-full transform opacity-0',
        animate && isVisible && !isExiting && 'translate-x-0 transform opacity-100',
        animate && isExiting && 'translate-x-full scale-95 transform opacity-0',
        containerPadding,
      )}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn('mt-0.5 flex-shrink-0', colors.icon)}>
          <span className={cn(notification.type === 'loading' ? 'animate-spin' : '', compact ? 'text-lg' : 'text-xl')}>
            {icon}
          </span>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <h4 className={cn('font-semibold', colors.text, titleSize)}>{notification.title}</h4>
              {notification.message && <p className={cn('mt-1', colors.text, messageSize)}>{notification.message}</p>}
            </div>

            {/* Dismiss button */}
            {!notification.persistent && (
              <button
                onClick={handleDismiss}
                className={cn(
                  'ml-2 flex-shrink-0 rounded transition-colors hover:bg-gray-200',
                  compact ? 'p-1' : 'p-1.5',
                )}
                title="Dismiss">
                <span className={cn(colors.text, compact ? 'text-sm' : 'text-base')}>✕</span>
              </button>
            )}
          </div>

          {/* Progress bar for loading notifications */}
          {notification.type === 'loading' && notification.progress !== undefined && (
            <NotificationProgress progress={notification.progress} type={notification.type} compact={compact} />
          )}

          {/* Actions */}
          {notification.actions && notification.actions.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              {notification.actions.map((action, index) => (
                <NotificationActionButton
                  key={index}
                  action={action}
                  onAction={() => handleAction(action)}
                  compact={compact}
                />
              ))}
            </div>
          )}

          {/* Timestamp */}
          {!compact && <div className="mt-2 text-xs text-gray-500">{notification.timestamp.toLocaleTimeString()}</div>}
        </div>
      </div>
    </div>
  );
};

/**
 * Notification queue manager hook
 */
const useNotificationQueue = (maxNotifications: number = 5) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [queue, setQueue] = useState<Notification[]>([]);

  const addNotification = useCallback(
    (notification: Omit<Notification, 'id' | 'timestamp'>) => {
      const newNotification: Notification = {
        ...notification,
        id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
      };

      setNotifications(current => {
        const updated = [...current, newNotification];

        // If we exceed the max, queue the older ones
        if (updated.length > maxNotifications) {
          const visible = updated.slice(-maxNotifications);
          const queued = updated.slice(0, -maxNotifications);
          setQueue(prevQueue => [...prevQueue, ...queued]);
          return visible;
        }

        return updated;
      });

      return newNotification.id;
    },
    [maxNotifications],
  );

  const removeNotification = useCallback(
    (id: string) => {
      setNotifications(current => {
        const updated = current.filter((n): n is Notification => n != null && n.id !== id);

        // If we have queued notifications, show the next one
        if (queue.length > 0 && updated.length < maxNotifications) {
          const nextNotification = queue[0];
          if (nextNotification) {
            setQueue(prevQueue => prevQueue.slice(1));
            return [...updated, nextNotification];
          }
        }

        return updated;
      });
    },
    [queue, maxNotifications],
  );

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
    setQueue([]);
  }, []);

  return {
    notifications,
    queue,
    addNotification,
    removeNotification,
    clearAllNotifications,
  };
};

/**
 * Notification sound manager
 */
const useNotificationSound = (enabled: boolean = false) => {
  const audioContextRef = useRef<AudioContext | null>(null);

  const playNotificationSound = useCallback(
    (type: NotificationType) => {
      if (!enabled || typeof window === 'undefined') return;

      try {
        // Create audio context if not exists
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }

        const ctx = audioContextRef.current;
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        // Configure sound based on notification type
        switch (type) {
          case 'success':
            oscillator.frequency.setValueAtTime(800, ctx.currentTime);
            oscillator.frequency.setValueAtTime(1000, ctx.currentTime + 0.1);
            break;
          case 'error':
            oscillator.frequency.setValueAtTime(400, ctx.currentTime);
            oscillator.frequency.setValueAtTime(300, ctx.currentTime + 0.1);
            break;
          case 'warning':
            oscillator.frequency.setValueAtTime(600, ctx.currentTime);
            break;
          case 'info':
          default:
            oscillator.frequency.setValueAtTime(500, ctx.currentTime);
            break;
        }

        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.2);
      } catch (error) {
        console.warn('Failed to play notification sound:', error);
      }
    },
    [enabled],
  );

  return { playNotificationSound };
};

/**
 * Main NotificationManager component
 */
export const NotificationManager: React.FC<
  NotificationManagerProps & {
    notifications?: Notification[];
    onNotificationAdd?: (notification: Omit<Notification, 'id' | 'timestamp'>) => string;
    onNotificationRemove?: (id: string) => void;
    onNotificationClear?: () => void;
  }
> = ({
  position = 'top-right',
  maxNotifications = 5,
  defaultTimeout = 5000,
  enableSound = false,
  compact = false,
  className,
  onNotificationDismiss,
  onNotificationAction,
  notifications: externalNotifications,
  onNotificationAdd,
  onNotificationRemove,
  onNotificationClear,
}) => {
  const {
    notifications: internalNotifications,
    queue,
    addNotification,
    removeNotification,
    clearAllNotifications,
  } = useNotificationQueue(maxNotifications);

  const { playNotificationSound } = useNotificationSound(enableSound);

  // Use external notifications if provided, otherwise use internal state
  const notifications = externalNotifications || internalNotifications;

  const handleNotificationDismiss = (id: string) => {
    const notification = notifications.find(n => n.id === id);
    if (notification) {
      onNotificationDismiss?.(notification);
    }

    if (onNotificationRemove) {
      onNotificationRemove(id);
    } else {
      removeNotification(id);
    }
  };

  const handleNotificationAction = (notification: Notification, action: NotificationAction) => {
    onNotificationAction?.(notification, action);
  };

  // Expose notification management methods
  React.useImperativeHandle(
    onNotificationAdd as any,
    () => ({
      addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => {
        const id = addNotification({
          ...notification,
          timeout: notification.timeout || defaultTimeout,
        });

        // Play sound for new notifications
        if (enableSound) {
          playNotificationSound(notification.type);
        }

        return id;
      },
      removeNotification,
      clearAllNotifications: onNotificationClear || clearAllNotifications,
    }),
    [
      addNotification,
      removeNotification,
      clearAllNotifications,
      defaultTimeout,
      enableSound,
      playNotificationSound,
      onNotificationClear,
    ],
  );

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className={cn('pointer-events-none fixed z-50', getPositionClasses(position), className)}>
      <div className="pointer-events-auto space-y-3">
        {notifications.map(notification => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onDismiss={handleNotificationDismiss}
            onAction={action => handleNotificationAction(notification, action)}
            compact={compact}
            animate={true}
          />
        ))}

        {/* Queue indicator */}
        {queue.length > 0 && (
          <div
            className={cn(
              'rounded border border-gray-200 bg-gray-100 p-2 text-center text-gray-600',
              compact ? 'text-xs' : 'text-sm',
            )}>
            +{queue.length} more notification{queue.length !== 1 ? 's' : ''} queued
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Notification context and provider for global notification management
 */
export interface NotificationContextValue {
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => string;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  notifications: Notification[];
}

const NotificationContext = React.createContext<NotificationContextValue | undefined>(undefined);

/**
 * Notification provider component
 */
export const NotificationProvider: React.FC<{
  children: React.ReactNode;
  maxNotifications?: number;
  defaultTimeout?: number;
  enableSound?: boolean;
  position?: NotificationPosition;
  compact?: boolean;
}> = ({
  children,
  maxNotifications = 5,
  defaultTimeout = 5000,
  enableSound = false,
  position = 'top-right',
  compact = false,
}) => {
  const { notifications, addNotification, removeNotification, clearAllNotifications } =
    useNotificationQueue(maxNotifications);

  const { playNotificationSound } = useNotificationSound(enableSound);

  const handleAddNotification = useCallback(
    (notification: Omit<Notification, 'id' | 'timestamp'>) => {
      const id = addNotification({
        ...notification,
        timeout: notification.timeout || defaultTimeout,
      });

      if (enableSound) {
        playNotificationSound(notification.type);
      }

      return id;
    },
    [addNotification, defaultTimeout, enableSound, playNotificationSound],
  );

  const contextValue: NotificationContextValue = {
    addNotification: handleAddNotification,
    removeNotification,
    clearNotifications: clearAllNotifications,
    notifications,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <NotificationManager
        notifications={notifications}
        onNotificationRemove={removeNotification}
        onNotificationClear={clearAllNotifications}
        position={position}
        maxNotifications={maxNotifications}
        compact={compact}
      />
    </NotificationContext.Provider>
  );
};

/**
 * Hook to use notification context
 */
export const useNotifications = (): NotificationContextValue => {
  const context = React.useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

/**
 * Utility functions for common notification types
 */
export const createNotification = {
  success: (
    title: string,
    message?: string,
    options?: Partial<Notification>,
  ): Omit<Notification, 'id' | 'timestamp'> => ({
    type: 'success',
    title,
    message: message || '',
    ...options,
  }),

  error: (
    title: string,
    message?: string,
    options?: Partial<Notification>,
  ): Omit<Notification, 'id' | 'timestamp'> => ({
    type: 'error',
    title,
    message: message || '',
    persistent: true,
    ...options,
  }),

  warning: (
    title: string,
    message?: string,
    options?: Partial<Notification>,
  ): Omit<Notification, 'id' | 'timestamp'> => ({
    type: 'warning',
    title,
    message: message || '',
    ...options,
  }),

  info: (title: string, message?: string, options?: Partial<Notification>): Omit<Notification, 'id' | 'timestamp'> => ({
    type: 'info',
    title,
    message: message || '',
    ...options,
  }),

  loading: (
    title: string,
    message?: string,
    progress?: number,
    options?: Partial<Notification>,
  ): Omit<Notification, 'id' | 'timestamp'> => ({
    type: 'loading',
    title,
    message: message || '',
    progress: progress || 0,
    persistent: true,
    ...options,
  }),
};
