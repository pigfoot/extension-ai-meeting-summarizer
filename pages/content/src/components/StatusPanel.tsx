/**
 * Status Panel Component
 *
 * React component for status display and error handling with contextual
 * messaging and recovery action buttons for content script injection.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { UIComponent } from '../types/content-script';
import type React from 'react';

/**
 * Status severity levels
 */
export type StatusSeverity = 'info' | 'success' | 'warning' | 'error' | 'loading';

/**
 * Action button configuration
 */
export interface StatusAction {
  /** Action identifier */
  id: string;
  /** Button label */
  label: string;
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  /** Action handler */
  onClick: () => void;
  /** Whether action is loading */
  loading?: boolean;
  /** Whether action is disabled */
  disabled?: boolean;
  /** Icon for the action */
  icon?: 'retry' | 'close' | 'download' | 'share' | 'settings' | 'help';
}

/**
 * Status message with metadata
 */
export interface StatusMessage {
  /** Message ID */
  id: string;
  /** Message text */
  text: string;
  /** Message severity */
  severity: StatusSeverity;
  /** Timestamp */
  timestamp: Date;
  /** Additional details */
  details?: string;
  /** Related actions */
  actions?: StatusAction[];
  /** Whether message can be dismissed */
  dismissible?: boolean;
  /** Auto-dismiss timeout in ms */
  autoHideDelay?: number;
}

/**
 * Status panel props
 */
export interface StatusPanelProps {
  /** Panel title */
  title?: string;
  /** Current status message */
  message?: string;
  /** Status severity */
  severity?: StatusSeverity;
  /** Additional details */
  details?: string;
  /** Status messages history */
  messages?: StatusMessage[];
  /** Available actions */
  actions?: StatusAction[];
  /** Show message history */
  showHistory?: boolean;
  /** Maximum messages to keep in history */
  maxHistoryItems?: number;
  /** Panel variant */
  variant?: 'default' | 'compact' | 'floating' | 'embedded';
  /** Panel size */
  size?: 'small' | 'medium' | 'large';
  /** Whether panel is collapsible */
  collapsible?: boolean;
  /** Initial collapsed state */
  initiallyCollapsed?: boolean;
  /** Whether to show timestamps */
  showTimestamps?: boolean;
  /** Whether panel can be dismissed */
  dismissible?: boolean;
  /** Auto-hide delay for success messages */
  autoHideSuccessDelay?: number;
  /** Message update handler */
  onMessageUpdate?: (message: StatusMessage) => void;
  /** Action handler */
  onAction?: (action: StatusAction) => void;
  /** Dismiss handler */
  onDismiss?: () => void;
  /** Collapse handler */
  onCollapse?: (collapsed: boolean) => void;
  /** Theme adaptation */
  adaptToTheme?: boolean;
  /** Custom CSS classes */
  className?: string;
  /** Custom styles */
  style?: React.CSSProperties;
  /** ARIA label */
  ariaLabel?: string;
  /** Test ID */
  testId?: string;
}

/**
 * Panel state
 */
interface PanelState {
  /** Whether panel is collapsed */
  isCollapsed: boolean;
  /** Whether panel is visible */
  isVisible: boolean;
  /** Message history */
  messageHistory: StatusMessage[];
  /** Auto-hide timers */
  autoHideTimers: Map<string, NodeJS.Timeout>;
}

/**
 * Status icons
 */
const StatusIcons = {
  info: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
        clipRule="evenodd"
      />
    </svg>
  ),
  success: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
    </svg>
  ),
  warning: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
        clipRule="evenodd"
      />
    </svg>
  ),
  error: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
        clipRule="evenodd"
      />
    </svg>
  ),
  loading: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" className="animate-spin">
      <path d="M10 3a7 7 0 100 14 7 7 0 000-14zM2 10a8 8 0 1116 0 8 8 0 01-16 0z" opacity="0.3" />
      <path d="M10 2a8 8 0 018 8 1 1 0 11-2 0 6 6 0 00-6-6V2z" />
    </svg>
  ),
};

/**
 * Action icons
 */
const ActionIcons = {
  retry: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M8 3a5 5 0 104.546 2.914.5.5 0 00-.908-.417A4 4 0 118 4v1.5a.5.5 0 001 0V4.5A5 5 0 008 3z"
      />
      <path d="M8 4.466V.534a.25.25 0 01.41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 018 4.466z" />
    </svg>
  ),
  close: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z" />
    </svg>
  ),
  download: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M.5 9.9a.5.5 0 01.5.5v2.5a1 1 0 001 1h12a1 1 0 001-1v-2.5a.5.5 0 011 0v2.5a2 2 0 01-2 2H2a2 2 0 01-2-2v-2.5a.5.5 0 01.5-.5z" />
      <path d="M7.646 11.854a.5.5 0 00.708 0l3-3a.5.5 0 00-.708-.708L8.5 10.293V1.5a.5.5 0 00-1 0v8.793L5.354 8.146a.5.5 0 10-.708.708l3 3z" />
    </svg>
  ),
  share: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M11 2.5a2.5 2.5 0 11.603 1.628l-6.718 3.12a2.499 2.499 0 010 1.504l6.718 3.12a2.5 2.5 0 11-.488.876l-6.718-3.12a2.5 2.5 0 110-3.256l6.718-3.12A2.5 2.5 0 0111 2.5z" />
    </svg>
  ),
  settings: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 4.754a3.246 3.246 0 100 6.492 3.246 3.246 0 000-6.492zM5.754 8a2.246 2.246 0 114.492 0 2.246 2.246 0 01-4.492 0z" />
      <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 01-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 01-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 01.52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 011.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 011.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 01.52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 01-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 01-1.255-.52l-.094-.319z" />
    </svg>
  ),
  help: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 15A7 7 0 118 1a7 7 0 010 14zm0 1A8 8 0 108 0a8 8 0 000 16z" />
      <path d="M5.255 5.786a.237.237 0 00.241.247h.825c.138 0 .248-.113.266-.25.09-.656.54-1.134 1.342-1.134.686 0 1.314.343 1.314 1.168 0 .635-.374.927-.965 1.371-.673.489-1.206 1.06-1.168 1.987l.003.217a.25.25 0 00.25.246h.811a.25.25 0 00.25-.25v-.105c0-.718.273-.927 1.01-1.486.609-.463 1.244-.977 1.244-2.056 0-1.511-1.276-2.241-2.673-2.241-1.267 0-2.655.59-2.75 2.286zm1.557 5.763c0 .533.425.927 1.01.927.609 0 1.028-.394 1.028-.927 0-.552-.42-.94-1.029-.94-.584 0-1.009.388-1.009.94z" />
    </svg>
  ),
};

/**
 * Status Panel Component
 */
export const StatusPanel: React.FC<StatusPanelProps> = ({
  title = 'Status',
  message,
  severity = 'info',
  details,
  messages = [],
  actions = [],
  showHistory = false,
  maxHistoryItems = 10,
  variant = 'default',
  size = 'medium',
  collapsible = false,
  initiallyCollapsed = false,
  showTimestamps = false,
  dismissible = false,
  autoHideSuccessDelay = 5000,
  onMessageUpdate,
  onAction,
  onDismiss,
  onCollapse,
  _adaptToTheme = true,
  className = '',
  style = {},
  ariaLabel,
  testId,
}) => {
  const [panelState, setPanelState] = useState<PanelState>({
    isCollapsed: initiallyCollapsed,
    isVisible: true,
    messageHistory: [],
    autoHideTimers: new Map(),
  });

  const panelRef = useRef<HTMLDivElement>(null);

  // Update message history when messages prop changes
  useEffect(() => {
    if (messages.length > 0) {
      setPanelState(prev => ({
        ...prev,
        messageHistory: messages.slice(-maxHistoryItems),
      }));
    }
  }, [messages, maxHistoryItems]);

  // Add current message to history
  useEffect(() => {
    if (message) {
      const newMessage: StatusMessage = {
        id: `msg-${Date.now()}`,
        text: message,
        severity,
        timestamp: new Date(),
        details,
        actions,
        dismissible,
      };

      setPanelState(prev => ({
        ...prev,
        messageHistory: [...prev.messageHistory.slice(-(maxHistoryItems - 1)), newMessage],
      }));

      onMessageUpdate?.(newMessage);

      // Auto-hide success messages
      if (severity === 'success' && autoHideSuccessDelay > 0) {
        const timer = setTimeout(() => {
          onDismiss?.();
        }, autoHideSuccessDelay);

        setPanelState(prev => ({
          ...prev,
          autoHideTimers: new Map(prev.autoHideTimers).set(newMessage.id, timer),
        }));
      }
    }
  }, [
    message,
    severity,
    details,
    actions,
    dismissible,
    maxHistoryItems,
    autoHideSuccessDelay,
    onMessageUpdate,
    onDismiss,
  ]);

  // Cleanup timers on unmount
  useEffect(
    () => () => {
      panelState.autoHideTimers.forEach(timer => clearTimeout(timer));
    },
    [panelState.autoHideTimers],
  );

  // Handle collapse toggle
  const handleCollapseToggle = useCallback(() => {
    const newCollapsed = !panelState.isCollapsed;
    setPanelState(prev => ({
      ...prev,
      isCollapsed: newCollapsed,
    }));
    onCollapse?.(newCollapsed);
  }, [panelState.isCollapsed, onCollapse]);

  // Handle action click
  const handleActionClick = useCallback(
    (action: StatusAction) => {
      try {
        action.onClick();
        onAction?.(action);
      } catch (error) {
        console.error('Status panel action error:', error);
      }
    },
    [onAction],
  );

  // Handle message dismiss
  const handleMessageDismiss = useCallback((messageId: string) => {
    setPanelState(prev => {
      const timer = prev.autoHideTimers.get(messageId);
      if (timer) {
        clearTimeout(timer);
        prev.autoHideTimers.delete(messageId);
      }

      return {
        ...prev,
        messageHistory: prev.messageHistory.filter(msg => msg.id !== messageId),
        autoHideTimers: new Map(prev.autoHideTimers),
      };
    });
  }, []);

  // Get severity classes
  const getSeverityClasses = useCallback((msgSeverity: StatusSeverity) => {
    const severityMap = {
      info: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-800',
        icon: 'text-blue-500',
      },
      success: {
        bg: 'bg-green-50',
        border: 'border-green-200',
        text: 'text-green-800',
        icon: 'text-green-500',
      },
      warning: {
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        text: 'text-yellow-800',
        icon: 'text-yellow-500',
      },
      error: {
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-800',
        icon: 'text-red-500',
      },
      loading: {
        bg: 'bg-gray-50',
        border: 'border-gray-200',
        text: 'text-gray-800',
        icon: 'text-gray-500',
      },
    };

    return severityMap[msgSeverity];
  }, []);

  // Get size classes
  const getSizeClasses = useCallback(() => {
    const sizeMap = {
      small: {
        container: 'p-3',
        text: 'text-sm',
        title: 'text-base',
        button: 'px-2 py-1 text-xs',
      },
      medium: {
        container: 'p-4',
        text: 'text-sm',
        title: 'text-lg',
        button: 'px-3 py-1.5 text-sm',
      },
      large: {
        container: 'p-6',
        text: 'text-base',
        title: 'text-xl',
        button: 'px-4 py-2 text-sm',
      },
    };

    return sizeMap[size];
  }, [size]);

  // Get variant classes
  const getVariantClasses = useCallback(() => {
    const variantMap = {
      default: 'rounded-lg shadow-sm',
      compact: 'rounded border',
      floating: 'rounded-lg shadow-lg',
      embedded: 'border-0',
    };

    return variantMap[variant];
  }, [variant]);

  // Format timestamp
  const formatTimestamp = useCallback((timestamp: Date): string => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) {
      return 'Just now';
    } else if (minutes < 60) {
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else {
      return timestamp.toLocaleDateString();
    }
  }, []);

  // Render action button
  const renderActionButton = useCallback(
    (action: StatusAction) => {
      const sizes = getSizeClasses();

      const variantClasses = {
        primary: 'bg-blue-600 text-white hover:bg-blue-700',
        secondary: 'bg-gray-600 text-white hover:bg-gray-700',
        outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50',
        ghost: 'text-gray-600 hover:bg-gray-100',
      };

      return (
        <button
          key={action.id}
          onClick={() => handleActionClick(action)}
          disabled={action.disabled || action.loading}
          className={`${sizes.button} ${variantClasses[action.variant || 'outline']} flex items-center space-x-1 rounded font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50`}
          aria-label={action.label}>
          {action.icon && (
            <span className="flex-shrink-0">
              {action.loading ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="animate-spin">
                  <path d="M8 3a5 5 0 100 10 5 5 0 000-10zM2 8a6 6 0 1112 0A6 6 0 012 8z" opacity="0.3" />
                  <path d="M8 2a6 6 0 016 6 .5.5 0 11-1 0 5 5 0 00-5-5V2z" />
                </svg>
              ) : (
                ActionIcons[action.icon]
              )}
            </span>
          )}
          <span>{action.label}</span>
        </button>
      );
    },
    [getSizeClasses, handleActionClick],
  );

  // Render status message
  const renderStatusMessage = useCallback(
    (msg: StatusMessage, isLatest: boolean = false) => {
      const severityClasses = getSeverityClasses(msg.severity);
      const sizes = getSizeClasses();

      return (
        <div
          key={msg.id}
          className={`${severityClasses.bg} ${severityClasses.border} rounded-lg border p-3 ${
            isLatest ? 'ring-2 ring-blue-200' : ''
          }`}>
          <div className="flex items-start space-x-3">
            <div className={`flex-shrink-0 ${severityClasses.icon}`}>{StatusIcons[msg.severity]}</div>

            <div className="min-w-0 flex-1">
              <div className={`${sizes.text} ${severityClasses.text} font-medium`}>{msg.text}</div>

              {msg.details && (
                <div className={`mt-1 ${sizes.text} ${severityClasses.text} opacity-75`}>{msg.details}</div>
              )}

              {showTimestamps && <div className="mt-1 text-xs text-gray-500">{formatTimestamp(msg.timestamp)}</div>}

              {msg.actions && msg.actions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">{msg.actions.map(renderActionButton)}</div>
              )}
            </div>

            {msg.dismissible && (
              <button
                onClick={() => handleMessageDismiss(msg.id)}
                className="flex-shrink-0 rounded p-1 text-gray-400 hover:text-gray-600"
                aria-label="Dismiss">
                {ActionIcons.close}
              </button>
            )}
          </div>
        </div>
      );
    },
    [getSeverityClasses, getSizeClasses, showTimestamps, formatTimestamp, renderActionButton, handleMessageDismiss],
  );

  const sizes = getSizeClasses();
  const variantClasses = getVariantClasses();
  const currentMessage = panelState.messageHistory[panelState.messageHistory.length - 1];

  if (!panelState.isVisible) {
    return null;
  }

  return (
    <div
      ref={panelRef}
      className={`meeting-summarizer-status-panel bg-white ${variantClasses} ${sizes.container} ${className}`}
      style={style}
      data-testid={testId}
      data-component-type="status-panel"
      data-severity={severity}
      data-variant={variant}
      role="region"
      aria-label={ariaLabel || title}
      aria-live="polite">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className={`${sizes.title} font-semibold text-gray-900`}>{title}</h3>

        <div className="flex items-center space-x-2">
          {collapsible && (
            <button
              onClick={handleCollapseToggle}
              className="rounded p-1 text-gray-400 hover:text-gray-600"
              aria-label={panelState.isCollapsed ? 'Expand' : 'Collapse'}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
                className={`transform transition-transform ${panelState.isCollapsed ? 'rotate-180' : ''}`}>
                <path
                  fillRule="evenodd"
                  d="M1.646 4.646a.5.5 0 01.708 0L8 10.293l5.646-5.647a.5.5 0 01.708.708l-6 6a.5.5 0 01-.708 0l-6-6a.5.5 0 010-.708z"
                />
              </svg>
            </button>
          )}

          {dismissible && (
            <button
              onClick={onDismiss}
              className="rounded p-1 text-gray-400 hover:text-gray-600"
              aria-label="Dismiss panel">
              {ActionIcons.close}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {!panelState.isCollapsed && (
        <div className="space-y-3">
          {/* Current message */}
          {currentMessage && renderStatusMessage(currentMessage, true)}

          {/* Message history */}
          {showHistory && panelState.messageHistory.length > 1 && (
            <div className="space-y-2">
              <div className="border-t pt-3 text-sm font-medium text-gray-700">Recent Messages</div>
              {panelState.messageHistory
                .slice(0, -1)
                .reverse()
                .map(msg => renderStatusMessage(msg))}
            </div>
          )}

          {/* Global actions */}
          {actions.length > 0 && (
            <div className="border-t border-gray-200 pt-3">
              <div className="flex flex-wrap gap-2">{actions.map(renderActionButton)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Create status panel UI component configuration
 */
export const createStatusPanelComponent = (props: Partial<StatusPanelProps> = {}): UIComponent => ({
  id: `status-panel-${Date.now()}`,
  type: 'status-panel',
  component: StatusPanel,
  props: {
    variant: 'default',
    size: 'medium',
    severity: 'info',
    showTimestamps: false,
    collapsible: false,
    adaptToTheme: true,
    ...props,
  },
  styling: {
    isolation: true,
    themeAdaptation: true,
    responsiveBreakpoints: ['mobile', 'tablet', 'desktop'],
    customClasses: ['meeting-summarizer-status-panel'],
    zIndex: 1000,
  },
  eventHandlers: [],
  injectionPoint: props.injectionPoint,
  lifecycle: {
    onMount: () => console.log('Status panel mounted'),
    onUnmount: () => console.log('Status panel unmounted'),
  },
  cleanup: () => {
    console.log('Status panel cleanup completed');
  },
});

/**
 * Status panel variants for different contexts
 */
export const StatusPanelVariants = {
  /**
   * Error panel with retry action
   */
  error: (props: Partial<StatusPanelProps> = {}) =>
    createStatusPanelComponent({
      severity: 'error',
      variant: 'default',
      size: 'medium',
      dismissible: true,
      actions: [
        {
          id: 'retry',
          label: 'Retry',
          variant: 'primary',
          icon: 'retry',
          onClick: () => console.log('Retry clicked'),
        },
      ],
      ...props,
    }),

  /**
   * Success notification
   */
  success: (props: Partial<StatusPanelProps> = {}) =>
    createStatusPanelComponent({
      severity: 'success',
      variant: 'floating',
      size: 'medium',
      dismissible: true,
      autoHideSuccessDelay: 3000,
      ...props,
    }),

  /**
   * Compact status for sidebars
   */
  compact: (props: Partial<StatusPanelProps> = {}) =>
    createStatusPanelComponent({
      variant: 'compact',
      size: 'small',
      collapsible: true,
      showTimestamps: false,
      ...props,
    }),

  /**
   * Loading status with progress
   */
  loading: (props: Partial<StatusPanelProps> = {}) =>
    createStatusPanelComponent({
      severity: 'loading',
      variant: 'embedded',
      size: 'medium',
      dismissible: false,
      ...props,
    }),
};

export default StatusPanel;
