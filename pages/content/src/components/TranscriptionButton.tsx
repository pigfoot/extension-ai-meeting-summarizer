/**
 * Transcription Button Component
 *
 * React component for transcription initiation with loading states
 * and accessibility features for content script injection.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { UIComponent } from '../types/content-script';
import type React from 'react';

/**
 * Transcription button props
 */
export interface TranscriptionButtonProps {
  /** Button text */
  text?: string;
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  /** Button size */
  size?: 'small' | 'medium' | 'large';
  /** Loading state */
  isLoading?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Progress value (0-100) */
  progress?: number;
  /** Show progress indicator */
  showProgress?: boolean;
  /** Icon to display */
  icon?: 'microphone' | 'play' | 'stop' | 'download' | 'none';
  /** Click handler */
  onClick?: () => void;
  /** Progress update handler */
  onProgressUpdate?: (progress: number) => void;
  /** Error handler */
  onError?: (error: Error) => void;
  /** Theme adaptation */
  adaptToTheme?: boolean;
  /** Tooltip text */
  tooltip?: string;
  /** Keyboard shortcut */
  shortcut?: string;
  /** Custom CSS classes */
  className?: string;
  /** Custom styles */
  style?: React.CSSProperties;
  /** ARIA label */
  ariaLabel?: string;
  /** Test ID for testing */
  testId?: string;
}

/**
 * Button state
 */
interface ButtonState {
  /** Current state */
  state: 'idle' | 'loading' | 'processing' | 'success' | 'error';
  /** Progress percentage */
  progress: number;
  /** Error message */
  error?: string;
  /** Last action timestamp */
  lastAction?: Date;
}

/**
 * Transcription button icons
 */
const ButtonIcons = {
  microphone: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 11a3 3 0 1 1-6 0V5a3 3 0 1 1 6 0v6zM8 4.5a2.5 2.5 0 1 0-5 0v6a2.5 2.5 0 1 0 5 0v-6z" />
      <path d="M11 8a.5.5 0 0 1-1 0V7a.5.5 0 0 1 1 0v1zM4.5 8H2a.5.5 0 0 1 0-1h2.5a.5.5 0 0 1 0 1zM8 6.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" />
    </svg>
  ),
  play: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
      <path d="M6.271 5.055a.5.5 0 0 1 .52.038L11 7.055a.5.5 0 0 1 0 .89L6.791 9.907a.5.5 0 0 1-.791-.389v-4.036a.5.5 0 0 1 .271-.427z" />
    </svg>
  ),
  stop: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
      <path d="M5.5 5.5A.5.5 0 0 1 6 5h4a.5.5 0 0 1 .5.5v5a.5.5 0 0 1-.5.5H6a.5.5 0 0 1-.5-.5v-5z" />
    </svg>
  ),
  download: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z" />
      <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z" />
    </svg>
  ),
  loading: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="animate-spin">
      <path d="M8 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM2 8a6 6 0 1 1 12 0A6 6 0 0 1 2 8z" opacity="0.3" />
      <path d="M8 2a6 6 0 0 1 6 6 .5.5 0 1 1-1 0 5 5 0 0 0-5-5V2z" />
    </svg>
  ),
};

/**
 * Transcription Button Component
 */
export const TranscriptionButton: React.FC<TranscriptionButtonProps> = ({
  text = 'Transcribe',
  variant = 'primary',
  size = 'medium',
  isLoading = false,
  disabled = false,
  progress = 0,
  showProgress = false,
  icon = 'microphone',
  onClick,
  _onProgressUpdate,
  onError,
  adaptToTheme = true,
  tooltip,
  shortcut,
  className = '',
  style = {},
  ariaLabel,
  testId,
}) => {
  const [buttonState, setButtonState] = useState<ButtonState>({
    state: 'idle',
    progress: 0,
  });

  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const progressRef = useRef<number>(progress);

  // Update progress ref when prop changes
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  // Update button state based on props
  useEffect(() => {
    setButtonState(prev => ({
      ...prev,
      state: isLoading ? 'loading' : disabled ? 'idle' : prev.state,
      progress: progress,
    }));
  }, [isLoading, disabled, progress]);

  // Handle progress animation
  useEffect(() => {
    if (showProgress && progress > 0) {
      const interval = setInterval(() => {
        setButtonState(prev => {
          const newProgress = Math.min(prev.progress + 1, progressRef.current);
          if (newProgress >= 100) {
            clearInterval(interval);
            return { ...prev, progress: newProgress, state: 'success' };
          }
          return { ...prev, progress: newProgress, state: 'processing' };
        });
      }, 50);

      return () => clearInterval(interval);
    }
  }, [showProgress, progress]);

  // Handle click with debouncing
  const handleClick = useCallback(() => {
    if (disabled || isLoading || buttonState.state === 'loading') {
      return;
    }

    try {
      setButtonState(prev => ({
        ...prev,
        state: 'loading',
        lastAction: new Date(),
      }));

      onClick?.();
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      setButtonState(prev => ({
        ...prev,
        state: 'error',
        error: err.message,
      }));
      onError?.(err);
    }
  }, [disabled, isLoading, buttonState.state, onClick, onError]);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setIsPressed(true);
        handleClick();
      }

      // Handle keyboard shortcut
      if (shortcut && event.key.toLowerCase() === shortcut.toLowerCase()) {
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          handleClick();
        }
      }
    },
    [handleClick, shortcut],
  );

  const handleKeyUp = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      setIsPressed(false);
    }
  }, []);

  // Get button classes
  const getButtonClasses = useCallback(() => {
    const baseClasses = [
      'meeting-summarizer-transcribe-btn',
      'inline-flex',
      'items-center',
      'justify-center',
      'font-medium',
      'transition-all',
      'duration-200',
      'focus:outline-none',
      'focus:ring-2',
      'focus:ring-offset-2',
      'disabled:opacity-50',
      'disabled:cursor-not-allowed',
      'relative',
      'overflow-hidden',
    ];

    // Size classes
    const sizeClasses = {
      small: ['px-3', 'py-1.5', 'text-sm', 'rounded'],
      medium: ['px-4', 'py-2', 'text-sm', 'rounded-md'],
      large: ['px-6', 'py-3', 'text-base', 'rounded-lg'],
    };

    // Variant classes
    const variantClasses = {
      primary: [
        'bg-blue-600',
        'text-white',
        'border-transparent',
        'hover:bg-blue-700',
        'focus:ring-blue-500',
        'active:bg-blue-800',
      ],
      secondary: [
        'bg-gray-600',
        'text-white',
        'border-transparent',
        'hover:bg-gray-700',
        'focus:ring-gray-500',
        'active:bg-gray-800',
      ],
      outline: [
        'bg-transparent',
        'text-blue-600',
        'border',
        'border-blue-600',
        'hover:bg-blue-50',
        'focus:ring-blue-500',
        'active:bg-blue-100',
      ],
      ghost: [
        'bg-transparent',
        'text-gray-600',
        'border-transparent',
        'hover:bg-gray-100',
        'focus:ring-gray-500',
        'active:bg-gray-200',
      ],
    };

    // State classes
    const stateClasses = {
      loading: ['animate-pulse'],
      processing: ['animate-pulse'],
      success: ['bg-green-600', 'text-white'],
      error: ['bg-red-600', 'text-white'],
    };

    // Interactive state classes
    const interactiveClasses = [];
    if (isHovered && !disabled) interactiveClasses.push('transform', 'scale-105');
    if (isFocused) interactiveClasses.push('ring-2');
    if (isPressed) interactiveClasses.push('transform', 'scale-95');

    return [
      ...baseClasses,
      ...sizeClasses[size],
      ...(buttonState.state === 'idle' ? variantClasses[variant] : []),
      ...(stateClasses[buttonState.state] || []),
      ...interactiveClasses,
      className,
    ].join(' ');
  }, [variant, size, className, buttonState.state, isHovered, isFocused, isPressed, disabled]);

  // Get button content
  const getButtonContent = useCallback(() => {
    const iconElement = icon !== 'none' && (
      <span className="mr-2 flex-shrink-0">
        {buttonState.state === 'loading' || buttonState.state === 'processing'
          ? ButtonIcons.loading
          : ButtonIcons[icon]}
      </span>
    );

    const textElement = (
      <span className="flex-1 text-center">
        {buttonState.state === 'loading'
          ? 'Processing...'
          : buttonState.state === 'processing'
            ? `Processing ${Math.round(buttonState.progress)}%`
            : buttonState.state === 'success'
              ? 'Complete!'
              : buttonState.state === 'error'
                ? 'Error'
                : text}
      </span>
    );

    return (
      <>
        {iconElement}
        {textElement}
        {showProgress && buttonState.progress > 0 && (
          <div
            className="absolute bottom-0 left-0 h-1 bg-white bg-opacity-30 transition-all duration-300"
            style={{ width: `${buttonState.progress}%` }}
          />
        )}
      </>
    );
  }, [icon, buttonState, text, showProgress]);

  // Get tooltip content
  const getTooltipContent = useCallback(() => {
    if (tooltip) return tooltip;
    if (shortcut) return `${text} (${shortcut})`;
    return text;
  }, [tooltip, shortcut, text]);

  // Theme adaptation styles
  const getThemeStyles = useCallback((): React.CSSProperties => {
    if (!adaptToTheme) return style;

    const rootStyle = getComputedStyle(document.documentElement);
    const isDark =
      document.body.classList.contains('dark') ||
      document.body.classList.contains('dark-theme') ||
      rootStyle.getPropertyValue('--theme-type') === 'dark';

    const themeStyles: React.CSSProperties = {
      ...style,
    };

    if (isDark && variant === 'primary') {
      themeStyles.backgroundColor = '#374151';
      themeStyles.borderColor = '#4B5563';
    }

    return themeStyles;
  }, [adaptToTheme, style, variant]);

  return (
    <button
      ref={buttonRef}
      type="button"
      className={getButtonClasses()}
      style={getThemeStyles()}
      disabled={disabled || buttonState.state === 'loading'}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      aria-label={ariaLabel || getTooltipContent()}
      aria-disabled={disabled}
      aria-busy={buttonState.state === 'loading' || buttonState.state === 'processing'}
      aria-describedby={showProgress ? `${testId}-progress` : undefined}
      title={getTooltipContent()}
      data-testid={testId}
      data-component-type="transcribe-button"
      data-state={buttonState.state}>
      {getButtonContent()}

      {/* Screen reader progress announcement */}
      {showProgress && buttonState.progress > 0 && (
        <span id={`${testId}-progress`} className="sr-only" aria-live="polite" aria-atomic="true">
          {`Processing ${Math.round(buttonState.progress)}% complete`}
        </span>
      )}
    </button>
  );
};

/**
 * Create transcription button UI component configuration
 */
export const createTranscriptionButtonComponent = (props: Partial<TranscriptionButtonProps> = {}): UIComponent => ({
  id: `transcribe-btn-${Date.now()}`,
  type: 'transcribe-button',
  component: TranscriptionButton,
  props: {
    text: 'Transcribe',
    variant: 'primary',
    size: 'medium',
    icon: 'microphone',
    adaptToTheme: true,
    ...props,
  },
  styling: {
    isolation: true,
    themeAdaptation: true,
    responsiveBreakpoints: ['mobile', 'tablet', 'desktop'],
    customClasses: ['meeting-summarizer-transcribe-btn'],
    zIndex: 1000,
  },
  eventHandlers: [
    {
      eventType: 'click',
      handler: props.onClick || (() => console.log('Transcribe button clicked')),
      options: { passive: false },
      priority: 10,
      conflictResolution: 'override',
    },
  ],
  injectionPoint: props.injectionPoint,
  lifecycle: {
    onMount: () => console.log('Transcription button mounted'),
    onUnmount: () => console.log('Transcription button unmounted'),
  },
  cleanup: () => {
    // Cleanup any button-specific resources
    console.log('Transcription button cleanup completed');
  },
});

/**
 * Transcription button variants for different contexts
 */
export const TranscriptionButtonVariants = {
  /**
   * Primary button for main transcription action
   */
  primary: (props: Partial<TranscriptionButtonProps> = {}) =>
    createTranscriptionButtonComponent({
      variant: 'primary',
      size: 'medium',
      icon: 'microphone',
      text: 'Start Transcription',
      ...props,
    }),

  /**
   * Compact button for toolbar or sidebar
   */
  compact: (props: Partial<TranscriptionButtonProps> = {}) =>
    createTranscriptionButtonComponent({
      variant: 'outline',
      size: 'small',
      icon: 'microphone',
      text: 'Transcribe',
      ...props,
    }),

  /**
   * Large prominent button for landing areas
   */
  prominent: (props: Partial<TranscriptionButtonProps> = {}) =>
    createTranscriptionButtonComponent({
      variant: 'primary',
      size: 'large',
      icon: 'microphone',
      text: 'Transcribe Meeting',
      ...props,
    }),

  /**
   * Ghost button for minimal interfaces
   */
  minimal: (props: Partial<TranscriptionButtonProps> = {}) =>
    createTranscriptionButtonComponent({
      variant: 'ghost',
      size: 'small',
      icon: 'microphone',
      text: '',
      tooltip: 'Transcribe',
      ...props,
    }),

  /**
   * Processing button with progress
   */
  withProgress: (props: Partial<TranscriptionButtonProps> = {}) =>
    createTranscriptionButtonComponent({
      variant: 'primary',
      size: 'medium',
      icon: 'microphone',
      text: 'Transcribing',
      showProgress: true,
      isLoading: true,
      ...props,
    }),
};

export default TranscriptionButton;
