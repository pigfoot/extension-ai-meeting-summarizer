/**
 * Content Page UI Components
 *
 * Implements compact UI elements for content script injection with theme adaptation
 * and non-intrusive design. Provides UI components for content page integration.
 */

import { cn } from '../utils';
import React, { useState, useCallback, useEffect, useMemo } from 'react';

/**
 * Theme configuration for content page integration
 */
interface ContentTheme {
  mode: 'light' | 'dark' | 'auto';
  colors: {
    background: string;
    text: string;
    border: string;
    accent: string;
    success: string;
    warning: string;
    error: string;
    overlay: string;
  };
  shadows: {
    small: string;
    medium: string;
    large: string;
  };
  borderRadius: string;
  fontSize: string;
}

/**
 * Position configuration for floating elements
 */
interface PositionConfig {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  offset: { x: number; y: number };
  draggable: boolean;
}

/**
 * Recording status type
 */
type RecordingStatus = 'idle' | 'recording' | 'processing' | 'completed' | 'error';

/**
 * Get default theme based on system/page preferences
 */
const getDefaultTheme = (mode: 'light' | 'dark' | 'auto' = 'auto'): ContentTheme => {
  const isDark = mode === 'dark' || (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return {
    mode: isDark ? 'dark' : 'light',
    colors: {
      background: isDark ? '#1f2937' : '#ffffff',
      text: isDark ? '#f9fafb' : '#1f2937',
      border: isDark ? '#374151' : '#e5e7eb',
      accent: '#3b82f6',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      overlay: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.5)',
    },
    shadows: {
      small: isDark
        ? '0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px 0 rgba(0, 0, 0, 0.2)'
        : '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      medium: isDark
        ? '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)'
        : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      large: isDark
        ? '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)'
        : '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    },
    borderRadius: '8px',
    fontSize: '14px',
  };
};

/**
 * Base styled wrapper for content page components
 */
const ContentWrapper: React.FC<{
  theme?: ContentTheme;
  position?: PositionConfig;
  className?: string;
  children: React.ReactNode;
  draggable?: boolean;
  onPositionChange?: (position: { x: number; y: number }) => void;
}> = ({ theme: externalTheme, position, className, children, draggable = false, onPositionChange }) => {
  const theme = externalTheme || getDefaultTheme();
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [currentPosition, setCurrentPosition] = useState(position?.offset || { x: 20, y: 20 });

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!draggable) return;
      e.preventDefault();
      setIsDragging(true);
      const rect = e.currentTarget.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    },
    [draggable],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !draggable) return;
      const newPosition = {
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      };
      setCurrentPosition(newPosition);
      onPositionChange?.(newPosition);
    },
    [isDragging, draggable, dragOffset, onPositionChange],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
    return undefined;
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const positionStyles = useMemo(() => {
    if (!position) return {};

    const styles: React.CSSProperties = {
      position: 'fixed',
      zIndex: 999999,
      left: currentPosition.x,
      top: currentPosition.y,
    };

    if (position.position.includes('right')) {
      styles.right = currentPosition.x;
      styles.left = 'auto';
    }
    if (position.position.includes('bottom')) {
      styles.bottom = currentPosition.y;
      styles.top = 'auto';
    }
    if (position.position === 'center') {
      styles.left = '50%';
      styles.top = '50%';
      styles.transform = 'translate(-50%, -50%)';
    }

    return styles;
  }, [position, currentPosition]);

  return (
    <div
      className={cn('content-ui-wrapper', draggable && 'cursor-move', isDragging && 'select-none', className)}
      style={{
        ...positionStyles,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: theme.fontSize,
        lineHeight: '1.4',
        color: theme.colors.text,
        backgroundColor: theme.colors.background,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.borderRadius,
        boxShadow: theme.shadows.medium,
        isolation: 'isolate',
        // Reset any potential inherited styles
        margin: 0,
        padding: 0,
        textAlign: 'left',
        direction: 'ltr',
      }}
      onMouseDown={handleMouseDown}>
      {children}
    </div>
  );
};

/**
 * Compact recording indicator
 */
interface RecordingIndicatorProps {
  status: RecordingStatus;
  duration?: number;
  progress?: number;
  onToggle?: () => void;
  onStop?: () => void;
  theme?: ContentTheme;
  minimized?: boolean;
  onMinimizeToggle?: () => void;
}

export const RecordingIndicator: React.FC<RecordingIndicatorProps> = ({
  status,
  duration = 0,
  progress = 0,
  onToggle,
  onStop,
  theme: externalTheme,
  minimized = false,
  onMinimizeToggle,
}) => {
  const theme = externalTheme || getDefaultTheme();

  const getStatusColor = (status: RecordingStatus) => {
    switch (status) {
      case 'recording':
        return theme.colors.error;
      case 'processing':
        return theme.colors.warning;
      case 'completed':
        return theme.colors.success;
      case 'error':
        return theme.colors.error;
      default:
        return theme.colors.text;
    }
  };

  const getStatusIcon = (status: RecordingStatus) => {
    switch (status) {
      case 'recording':
        return '🔴';
      case 'processing':
        return '⏳';
      case 'completed':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '⚪';
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (minimized) {
    return (
      <ContentWrapper
        theme={theme}
        position={{ position: 'top-right', offset: { x: 20, y: 20 }, draggable: true }}
        draggable>
        <button
          onClick={onMinimizeToggle}
          className="flex items-center gap-1 rounded-full px-2 py-1 transition-all hover:opacity-80"
          style={{
            backgroundColor: theme.colors.background,
            border: `1px solid ${theme.colors.border}`,
            color: getStatusColor(status),
          }}
          title={`Recording ${status} - Click to expand`}>
          <span className="text-xs">{getStatusIcon(status)}</span>
          {status === 'recording' && (
            <span className="h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: theme.colors.error }} />
          )}
        </button>
      </ContentWrapper>
    );
  }

  return (
    <ContentWrapper
      theme={theme}
      position={{ position: 'top-right', offset: { x: 20, y: 20 }, draggable: true }}
      draggable>
      <div className="min-w-[200px] p-3" style={{ backgroundColor: theme.colors.background }}>
        {/* Header */}
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>{getStatusIcon(status)}</span>
            <span className="text-sm font-medium capitalize" style={{ color: getStatusColor(status) }}>
              {status === 'recording'
                ? 'Recording'
                : status === 'processing'
                  ? 'Processing'
                  : status === 'completed'
                    ? 'Completed'
                    : status === 'error'
                      ? 'Error'
                      : 'Ready'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onMinimizeToggle}
              className="rounded p-1 transition-opacity hover:opacity-70"
              style={{ color: theme.colors.text }}
              title="Minimize">
              <span className="text-xs">−</span>
            </button>
          </div>
        </div>

        {/* Duration */}
        {status === 'recording' && (
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs" style={{ color: theme.colors.text }}>
              Duration:
            </span>
            <span className="font-mono text-xs" style={{ color: theme.colors.accent }}>
              {formatDuration(duration)}
            </span>
          </div>
        )}

        {/* Progress */}
        {status === 'processing' && (
          <div className="mb-2">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span style={{ color: theme.colors.text }}>Processing</span>
              <span style={{ color: theme.colors.accent }}>{Math.round(progress)}%</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full" style={{ backgroundColor: theme.colors.border }}>
              <div
                className="h-full transition-all duration-300"
                style={{
                  backgroundColor: theme.colors.accent,
                  width: `${progress}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-2">
          {status === 'idle' && onToggle && (
            <button
              onClick={onToggle}
              className="flex-1 rounded px-3 py-1.5 text-xs font-medium transition-all hover:opacity-90"
              style={{
                backgroundColor: theme.colors.accent,
                color: '#ffffff',
              }}>
              Start Recording
            </button>
          )}

          {status === 'recording' && (
            <>
              {onToggle && (
                <button
                  onClick={onToggle}
                  className="rounded px-3 py-1.5 text-xs font-medium transition-all hover:opacity-90"
                  style={{
                    backgroundColor: theme.colors.warning,
                    color: '#ffffff',
                  }}>
                  Pause
                </button>
              )}
              {onStop && (
                <button
                  onClick={onStop}
                  className="rounded px-3 py-1.5 text-xs font-medium transition-all hover:opacity-90"
                  style={{
                    backgroundColor: theme.colors.error,
                    color: '#ffffff',
                  }}>
                  Stop
                </button>
              )}
            </>
          )}

          {status === 'completed' && (
            <button
              className="flex-1 rounded px-3 py-1.5 text-xs font-medium transition-all hover:opacity-90"
              style={{
                backgroundColor: theme.colors.success,
                color: '#ffffff',
              }}>
              View Summary
            </button>
          )}
        </div>
      </div>
    </ContentWrapper>
  );
};

/**
 * Floating action button
 */
interface FloatingActionButtonProps {
  icon?: string;
  label?: string;
  onClick?: () => void;
  theme?: ContentTheme;
  position?: PositionConfig;
  pulse?: boolean;
  disabled?: boolean;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  icon = '🎙️',
  label = 'Record',
  onClick,
  theme: externalTheme,
  position,
  pulse = false,
  disabled = false,
}) => {
  const theme = externalTheme || getDefaultTheme();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <ContentWrapper
      theme={theme}
      position={position || { position: 'bottom-right', offset: { x: 20, y: 20 }, draggable: true }}
      draggable>
      <button
        onClick={onClick}
        disabled={disabled}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          'relative flex items-center gap-2 rounded-full px-4 py-3 font-medium transition-all duration-200',
          pulse && 'animate-pulse',
          disabled && 'cursor-not-allowed opacity-50',
        )}
        style={{
          backgroundColor: theme.colors.accent,
          color: '#ffffff',
          boxShadow: theme.shadows.large,
          transform: isHovered && !disabled ? 'scale(1.05)' : 'scale(1)',
        }}
        title={label}>
        <span className="text-lg">{icon}</span>
        {isHovered && <span className="whitespace-nowrap text-sm">{label}</span>}
      </button>
    </ContentWrapper>
  );
};

/**
 * Compact notification toast
 */
interface NotificationToastProps {
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  onDismiss?: () => void;
  theme?: ContentTheme;
  position?: PositionConfig;
  showIcon?: boolean;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  message,
  type = 'info',
  duration = 5000,
  onDismiss,
  theme: externalTheme,
  position,
  showIcon = true,
}) => {
  const theme = externalTheme || getDefaultTheme();
  const [isVisible, setIsVisible] = useState(true);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success':
        return theme.colors.success;
      case 'warning':
        return theme.colors.warning;
      case 'error':
        return theme.colors.error;
      default:
        return theme.colors.accent;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      default:
        return 'ℹ️';
    }
  };

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onDismiss?.(), 300);
      }, duration);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [duration, onDismiss]);

  if (!isVisible) return null;

  return (
    <ContentWrapper
      theme={theme}
      position={position || { position: 'top-right', offset: { x: 20, y: 60 }, draggable: false }}
      className={cn(
        'transition-all duration-300',
        isVisible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0',
      )}>
      <div
        className="flex max-w-xs items-start gap-2 p-3"
        style={{
          backgroundColor: theme.colors.background,
          borderLeft: `4px solid ${getTypeColor(type)}`,
        }}>
        {showIcon && <span className="flex-shrink-0 text-sm">{getTypeIcon(type)}</span>}

        <div className="min-w-0 flex-1">
          <p className="break-words text-sm" style={{ color: theme.colors.text }}>
            {message}
          </p>
        </div>

        {onDismiss && (
          <button
            onClick={() => {
              setIsVisible(false);
              setTimeout(() => onDismiss(), 300);
            }}
            className="flex-shrink-0 rounded p-0.5 transition-opacity hover:opacity-70"
            style={{ color: theme.colors.text }}>
            <span className="text-xs">×</span>
          </button>
        )}
      </div>
    </ContentWrapper>
  );
};

/**
 * Compact progress overlay
 */
interface ProgressOverlayProps {
  visible: boolean;
  progress: number;
  message?: string;
  theme?: ContentTheme;
  onCancel?: () => void;
  blur?: boolean;
}

export const ProgressOverlay: React.FC<ProgressOverlayProps> = ({
  visible,
  progress,
  message = 'Processing...',
  theme: externalTheme,
  onCancel,
  blur = true,
}) => {
  const theme = externalTheme || getDefaultTheme();

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center transition-all duration-200"
      style={{
        backgroundColor: theme.colors.overlay,
        zIndex: 1000000,
        backdropFilter: blur ? 'blur(4px)' : 'none',
      }}>
      <ContentWrapper theme={theme}>
        <div className="min-w-[200px] p-6 text-center">
          {/* Progress Circle */}
          <div className="relative mx-auto mb-4 h-16 w-16">
            <svg className="h-16 w-16 -rotate-90 transform" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" strokeWidth="4" style={{ stroke: theme.colors.border }} />
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                strokeWidth="4"
                strokeLinecap="round"
                style={{
                  stroke: theme.colors.accent,
                  strokeDasharray: `${2 * Math.PI * 28}`,
                  strokeDashoffset: `${2 * Math.PI * 28 * (1 - progress / 100)}`,
                }}
                className="transition-all duration-300"
              />
            </svg>
            <div
              className="absolute inset-0 flex items-center justify-center text-sm font-medium"
              style={{ color: theme.colors.text }}>
              {Math.round(progress)}%
            </div>
          </div>

          {/* Message */}
          <p className="mb-4 text-sm" style={{ color: theme.colors.text }}>
            {message}
          </p>

          {/* Cancel Button */}
          {onCancel && (
            <button
              onClick={onCancel}
              className="rounded px-4 py-2 text-sm font-medium transition-all hover:opacity-90"
              style={{
                backgroundColor: theme.colors.border,
                color: theme.colors.text,
              }}>
              Cancel
            </button>
          )}
        </div>
      </ContentWrapper>
    </div>
  );
};

/**
 * Compact status badge
 */
interface StatusBadgeProps {
  status: string;
  count?: number;
  color?: string;
  theme?: ContentTheme;
  position?: PositionConfig;
  onClick?: () => void;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  count,
  color,
  theme: externalTheme,
  position,
  onClick,
}) => {
  const theme = externalTheme || getDefaultTheme();
  const badgeColor = color || theme.colors.accent;

  return (
    <ContentWrapper
      theme={theme}
      position={position || { position: 'top-left', offset: { x: 20, y: 20 }, draggable: false }}>
      <button
        onClick={onClick}
        disabled={!onClick}
        className={cn(
          'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all',
          onClick && 'cursor-pointer hover:opacity-80',
        )}
        style={{
          backgroundColor: badgeColor,
          color: '#ffffff',
        }}>
        <span>{status}</span>
        {count !== undefined && (
          <span
            className="rounded-full px-1.5 py-0.5 text-xs font-bold"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.3)',
              color: '#ffffff',
            }}>
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
    </ContentWrapper>
  );
};

/**
 * Theme provider for content page components
 */
interface ContentThemeProviderProps {
  theme?: Partial<ContentTheme>;
  children: React.ReactNode;
}

export const ContentThemeProvider: React.FC<ContentThemeProviderProps> = ({ theme: partialTheme, children }) => {
  const theme = useMemo(() => {
    const defaultTheme = getDefaultTheme();
    return partialTheme ? { ...defaultTheme, ...partialTheme } : defaultTheme;
  }, [partialTheme]);

  return (
    <div data-content-theme={theme.mode}>
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, { theme } as any);
        }
        return child;
      })}
    </div>
  );
};

/**
 * Content page UI container
 */
interface ContentPageUIProps {
  theme?: Partial<ContentTheme>;
  children: React.ReactNode;
  namespace?: string;
}

export const ContentPageUI: React.FC<ContentPageUIProps> = ({ theme, children, namespace = 'meeting-summarizer' }) => {
  // Create isolated styles to prevent conflicts
  useEffect(() => {
    const styleId = `${namespace}-content-styles`;
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .${namespace}-content * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      
      .${namespace}-content *:focus {
        outline: 2px solid #3b82f6;
        outline-offset: 2px;
      }
      
      .${namespace}-content button {
        border: none;
        background: none;
        cursor: pointer;
        font-family: inherit;
      }
      
      .${namespace}-content input {
        border: none;
        background: none;
        font-family: inherit;
      }
    `;

    document.head.appendChild(style);

    return () => {
      const existingStyle = document.getElementById(styleId);
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, [namespace]);

  return (
    <div className={`${namespace}-content`}>
      <ContentThemeProvider theme={theme || {}}>{children}</ContentThemeProvider>
    </div>
  );
};

/**
 * Utility function to inject content UI into page
 */
export const injectContentUI = (component: React.ReactElement, container?: HTMLElement) => {
  const targetContainer = container || document.body;
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
    z-index: 999999;
  `;
  wrapper.addEventListener('mousedown', e => e.stopPropagation());
  wrapper.addEventListener('click', e => e.stopPropagation());
  wrapper.style.pointerEvents = 'auto';

  targetContainer.appendChild(wrapper);

  return {
    wrapper,
    destroy: () => {
      if (wrapper && wrapper.parentNode) {
        wrapper.parentNode.removeChild(wrapper);
      }
    },
  };
};
