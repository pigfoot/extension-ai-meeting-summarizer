/**
 * Progress Indicator Component
 *
 * React component for transcription progress display with real-time
 * progress updates and status messaging for content script injection.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { UIComponent } from '../types/content-script';
import type React from 'react';

/**
 * Progress phase information
 */
export interface ProgressPhase {
  /** Phase identifier */
  id: string;
  /** Phase name */
  name: string;
  /** Phase description */
  description: string;
  /** Phase progress (0-100) */
  progress: number;
  /** Phase status */
  status: 'pending' | 'active' | 'completed' | 'error';
  /** Estimated duration in seconds */
  estimatedDuration?: number;
  /** Actual duration in seconds */
  actualDuration?: number;
}

/**
 * Progress indicator props
 */
export interface ProgressIndicatorProps {
  /** Overall progress (0-100) */
  progress?: number;
  /** Current status message */
  status?: string;
  /** Progress phases */
  phases?: ProgressPhase[];
  /** Current active phase */
  currentPhase?: string;
  /** Show percentage */
  showPercentage?: boolean;
  /** Show time estimates */
  showTimeEstimate?: boolean;
  /** Show phase details */
  showPhases?: boolean;
  /** Indicator variant */
  variant?: 'linear' | 'circular' | 'stepped' | 'minimal';
  /** Size */
  size?: 'small' | 'medium' | 'large';
  /** Color scheme */
  colorScheme?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'auto';
  /** Animation type */
  animation?: 'smooth' | 'pulse' | 'glow' | 'none';
  /** Whether progress is indeterminate */
  indeterminate?: boolean;
  /** Error state */
  error?: string;
  /** Success state */
  isComplete?: boolean;
  /** Show cancel button */
  allowCancel?: boolean;
  /** Progress update handler */
  onProgressUpdate?: (progress: number) => void;
  /** Phase change handler */
  onPhaseChange?: (phase: ProgressPhase) => void;
  /** Cancel handler */
  onCancel?: () => void;
  /** Error handler */
  onError?: (error: string) => void;
  /** Completion handler */
  onComplete?: () => void;
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
 * Internal progress state
 */
interface ProgressState {
  /** Current progress value */
  currentProgress: number;
  /** Progress start time */
  startTime: Date;
  /** Current phase index */
  currentPhaseIndex: number;
  /** Estimated completion time */
  estimatedCompletion?: Date;
  /** Progress history for velocity calculation */
  progressHistory: Array<{ progress: number; timestamp: Date }>;
  /** Whether animation is active */
  isAnimating: boolean;
}

/**
 * Default progress phases for transcription
 */
const DEFAULT_TRANSCRIPTION_PHASES: ProgressPhase[] = [
  {
    id: 'preparation',
    name: 'Preparing',
    description: 'Setting up transcription service',
    progress: 0,
    status: 'pending',
    estimatedDuration: 5,
  },
  {
    id: 'extraction',
    name: 'Extracting Audio',
    description: 'Processing audio from meeting recording',
    progress: 0,
    status: 'pending',
    estimatedDuration: 15,
  },
  {
    id: 'transcription',
    name: 'Transcribing',
    description: 'Converting speech to text',
    progress: 0,
    status: 'pending',
    estimatedDuration: 60,
  },
  {
    id: 'processing',
    name: 'Processing',
    description: 'Analyzing and formatting results',
    progress: 0,
    status: 'pending',
    estimatedDuration: 20,
  },
  {
    id: 'completion',
    name: 'Finalizing',
    description: 'Preparing transcription summary',
    progress: 0,
    status: 'pending',
    estimatedDuration: 10,
  },
];

/**
 * Progress Indicator Component
 */
export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  progress = 0,
  status = 'Processing...',
  phases = DEFAULT_TRANSCRIPTION_PHASES,
  _currentPhase,
  showPercentage = true,
  showTimeEstimate = true,
  showPhases = false,
  variant = 'linear',
  size = 'medium',
  colorScheme = 'auto',
  animation = 'smooth',
  indeterminate = false,
  error,
  isComplete = false,
  allowCancel = false,
  onProgressUpdate,
  onPhaseChange,
  onCancel,
  _onError,
  onComplete,
  _adaptToTheme = true,
  className = '',
  style = {},
  ariaLabel,
  testId,
}) => {
  const [progressState, setProgressState] = useState<ProgressState>({
    currentProgress: progress,
    startTime: new Date(),
    currentPhaseIndex: 0,
    progressHistory: [],
    isAnimating: false,
  });

  const animationRef = useRef<number>();
  const progressRef = useRef<HTMLDivElement>(null);

  // Update progress with animation
  useEffect(() => {
    if (indeterminate || progressState.currentProgress === progress) return;

    setProgressState(prev => ({
      ...prev,
      isAnimating: true,
    }));

    const startProgress = progressState.currentProgress;
    const targetProgress = Math.max(0, Math.min(100, progress));
    const duration = animation === 'smooth' ? 500 : 0;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progressRatio = Math.min(elapsed / duration, 1);

      const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
      const easedProgress = easeOut(progressRatio);

      const currentProgress = startProgress + (targetProgress - startProgress) * easedProgress;

      setProgressState(prev => ({
        ...prev,
        currentProgress,
        progressHistory: [
          ...prev.progressHistory.slice(-10), // Keep last 10 entries
          { progress: currentProgress, timestamp: new Date() },
        ],
      }));

      if (progressRatio < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setProgressState(prev => ({
          ...prev,
          currentProgress: targetProgress,
          isAnimating: false,
        }));
        onProgressUpdate?.(targetProgress);
      }
    };

    if (duration > 0) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      setProgressState(prev => ({
        ...prev,
        currentProgress: targetProgress,
        isAnimating: false,
      }));
      onProgressUpdate?.(targetProgress);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [progress, animation, indeterminate, onProgressUpdate, progressState.currentProgress]);

  // Update current phase based on progress
  useEffect(() => {
    if (!phases.length) return;

    const phaseProgress = progressState.currentProgress / 100;
    const phaseIndex = Math.floor(phaseProgress * phases.length);
    const actualPhaseIndex = Math.min(phaseIndex, phases.length - 1);

    if (actualPhaseIndex !== progressState.currentPhaseIndex) {
      setProgressState(prev => ({
        ...prev,
        currentPhaseIndex: actualPhaseIndex,
      }));

      const newPhase = phases[actualPhaseIndex];
      if (newPhase) {
        onPhaseChange?.(newPhase);
      }
    }
  }, [progressState.currentProgress, progressState.currentPhaseIndex, phases, onPhaseChange]);

  // Handle completion
  useEffect(() => {
    if (progressState.currentProgress >= 100 && !isComplete) {
      onComplete?.();
    }
  }, [progressState.currentProgress, isComplete, onComplete]);

  // Calculate time estimates
  const getTimeEstimate = useCallback(() => {
    if (!showTimeEstimate || progressState.progressHistory.length < 2) {
      return null;
    }

    const history = progressState.progressHistory;
    const recent = history.slice(-5); // Use last 5 data points

    if (recent.length < 2) return null;

    const firstPoint = recent[0];
    const lastPoint = recent[recent.length - 1];
    const timeDiff = lastPoint.timestamp.getTime() - firstPoint.timestamp.getTime();
    const progressDiff = lastPoint.progress - firstPoint.progress;

    if (progressDiff <= 0 || timeDiff <= 0) return null;

    const remainingProgress = 100 - progressState.currentProgress;
    const velocity = progressDiff / timeDiff; // progress per ms
    const estimatedTimeMs = remainingProgress / velocity;
    const estimatedTime = Math.round(estimatedTimeMs / 1000); // Convert to seconds

    return {
      remaining: estimatedTime,
      velocity: velocity * 1000, // progress per second
    };
  }, [showTimeEstimate, progressState.progressHistory, progressState.currentProgress]);

  // Format time duration
  const formatDuration = useCallback((seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  }, []);

  // Get color classes based on scheme and theme
  const getColorClasses = useCallback(() => {
    let scheme = colorScheme;

    if (scheme === 'auto') {
      if (error) {
        scheme = 'red';
      } else if (isComplete || progressState.currentProgress >= 100) {
        scheme = 'green';
      } else {
        scheme = 'blue';
      }
    }

    const colorMap = {
      blue: {
        bg: 'bg-blue-600',
        bgLight: 'bg-blue-200',
        text: 'text-blue-700',
        border: 'border-blue-300',
      },
      green: {
        bg: 'bg-green-600',
        bgLight: 'bg-green-200',
        text: 'text-green-700',
        border: 'border-green-300',
      },
      purple: {
        bg: 'bg-purple-600',
        bgLight: 'bg-purple-200',
        text: 'text-purple-700',
        border: 'border-purple-300',
      },
      orange: {
        bg: 'bg-orange-600',
        bgLight: 'bg-orange-200',
        text: 'text-orange-700',
        border: 'border-orange-300',
      },
      red: {
        bg: 'bg-red-600',
        bgLight: 'bg-red-200',
        text: 'text-red-700',
        border: 'border-red-300',
      },
    };

    return colorMap[scheme];
  }, [colorScheme, error, isComplete, progressState.currentProgress]);

  // Get size classes
  const getSizeClasses = useCallback(() => {
    const sizeMap = {
      small: {
        container: 'p-3',
        bar: 'h-2',
        text: 'text-xs',
        circle: 'w-16 h-16',
      },
      medium: {
        container: 'p-4',
        bar: 'h-3',
        text: 'text-sm',
        circle: 'w-24 h-24',
      },
      large: {
        container: 'p-6',
        bar: 'h-4',
        text: 'text-base',
        circle: 'w-32 h-32',
      },
    };

    return sizeMap[size];
  }, [size]);

  // Get animation classes
  const getAnimationClasses = useCallback(() => {
    if (animation === 'none') return '';

    const baseClasses = ['transition-all', 'duration-300'];

    if (animation === 'pulse' && progressState.isAnimating) {
      baseClasses.push('animate-pulse');
    }

    if (animation === 'glow') {
      baseClasses.push('shadow-glow');
    }

    return baseClasses.join(' ');
  }, [animation, progressState.isAnimating]);

  // Render linear progress bar
  const renderLinearProgress = useCallback(() => {
    const colors = getColorClasses();
    const sizes = getSizeClasses();
    const animations = getAnimationClasses();

    return (
      <div className="w-full">
        <div className={`${sizes.bar} ${colors.bgLight} overflow-hidden rounded-full ${animations}`}>
          <div
            ref={progressRef}
            className={`h-full ${colors.bg} transition-all duration-300 ease-out ${
              indeterminate ? 'animate-pulse' : ''
            }`}
            style={{
              width: indeterminate ? '100%' : `${progressState.currentProgress}%`,
              transform: indeterminate ? 'translateX(-100%)' : 'none',
              animation: indeterminate ? 'indeterminate 2s infinite linear' : 'none',
            }}
            role="progressbar"
            aria-valuenow={indeterminate ? undefined : progressState.currentProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={ariaLabel || status}
          />
        </div>
      </div>
    );
  }, [
    getColorClasses,
    getSizeClasses,
    getAnimationClasses,
    indeterminate,
    progressState.currentProgress,
    ariaLabel,
    status,
  ]);

  // Render circular progress
  const renderCircularProgress = useCallback(() => {
    const colors = getColorClasses();
    const sizes = getSizeClasses();
    const radius = 45;
    const circumference = 2 * Math.PI * radius;
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (progressState.currentProgress / 100) * circumference;

    return (
      <div className={`${sizes.circle} relative`}>
        <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className={colors.bgLight}
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            className={colors.bg}
            style={{
              strokeDasharray,
              strokeDashoffset: indeterminate ? 0 : strokeDashoffset,
              transition: 'stroke-dashoffset 0.3s ease-out',
              animation: indeterminate ? 'spin 2s linear infinite' : 'none',
            }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`${sizes.text} font-semibold ${colors.text}`}>
            {indeterminate ? '...' : `${Math.round(progressState.currentProgress)}%`}
          </span>
        </div>
      </div>
    );
  }, [getColorClasses, getSizeClasses, progressState.currentProgress, indeterminate]);

  // Render stepped progress
  const renderSteppedProgress = useCallback(() => {
    const colors = getColorClasses();
    const currentPhaseObj = phases[progressState.currentPhaseIndex];

    return (
      <div className="w-full">
        <div className="mb-2 flex items-center justify-between">
          {phases.map((phase, index) => (
            <div key={phase.id} className={`flex items-center ${index < phases.length - 1 ? 'flex-1' : ''}`}>
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium ${
                  index <= progressState.currentPhaseIndex
                    ? `${colors.bg} ${colors.border} text-white`
                    : `border-gray-300 bg-gray-200 text-gray-500`
                }`}>
                {index < progressState.currentPhaseIndex ? '✓' : index + 1}
              </div>
              {index < phases.length - 1 && (
                <div
                  className={`mx-2 h-1 flex-1 ${index < progressState.currentPhaseIndex ? colors.bg : 'bg-gray-200'}`}
                />
              )}
            </div>
          ))}
        </div>
        {currentPhaseObj && (
          <div className="text-center">
            <div className={`font-medium ${colors.text}`}>{currentPhaseObj.name}</div>
            <div className="text-sm text-gray-600">{currentPhaseObj.description}</div>
          </div>
        )}
      </div>
    );
  }, [getColorClasses, phases, progressState.currentPhaseIndex]);

  // Render minimal progress
  const renderMinimalProgress = useCallback(() => {
    const colors = getColorClasses();

    return (
      <div className="flex items-center space-x-3">
        <div
          className={`h-4 w-4 rounded-full ${colors.bg} ${
            indeterminate || progressState.isAnimating ? 'animate-pulse' : ''
          }`}
        />
        <span className="text-sm text-gray-600">{status}</span>
        {showPercentage && !indeterminate && (
          <span className={`text-sm font-medium ${colors.text}`}>{Math.round(progressState.currentProgress)}%</span>
        )}
      </div>
    );
  }, [
    getColorClasses,
    indeterminate,
    progressState.isAnimating,
    progressState.currentProgress,
    status,
    showPercentage,
  ]);

  // Render progress variant
  const renderProgress = useCallback(() => {
    switch (variant) {
      case 'circular':
        return renderCircularProgress();
      case 'stepped':
        return renderSteppedProgress();
      case 'minimal':
        return renderMinimalProgress();
      default:
        return renderLinearProgress();
    }
  }, [variant, renderCircularProgress, renderSteppedProgress, renderMinimalProgress, renderLinearProgress]);

  // Get time estimate display
  const timeEstimate = getTimeEstimate();
  const sizes = getSizeClasses();
  const colors = getColorClasses();

  return (
    <div
      className={`meeting-summarizer-progress ${sizes.container} rounded-lg border bg-white ${colors.border} ${className}`}
      style={style}
      data-testid={testId}
      data-component-type="progress-indicator"
      data-progress={progressState.currentProgress}
      data-variant={variant}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex-1">
          <div className={`font-medium ${colors.text} ${sizes.text}`}>
            {error ? 'Error' : isComplete ? 'Complete!' : status}
          </div>
          {error && <div className="mt-1 text-sm text-red-600">{error}</div>}
        </div>

        {allowCancel && !isComplete && !error && (
          <button onClick={onCancel} className="rounded p-1 text-gray-400 hover:text-gray-600" aria-label="Cancel">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
            </svg>
          </button>
        )}
      </div>

      {/* Progress */}
      <div className="mb-3">{renderProgress()}</div>

      {/* Footer */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <div>
          {showPercentage && !indeterminate && variant !== 'circular' && (
            <span className={`font-medium ${colors.text}`}>{Math.round(progressState.currentProgress)}%</span>
          )}
        </div>

        <div className="text-right">
          {timeEstimate && (
            <div>
              <span>~{formatDuration(timeEstimate.remaining)} remaining</span>
            </div>
          )}
        </div>
      </div>

      {/* Phase details */}
      {showPhases && variant !== 'stepped' && (
        <div className="mt-3 border-t border-gray-200 pt-3">
          <div className="space-y-2">
            {phases.map((phase, index) => (
              <div
                key={phase.id}
                className={`flex items-center justify-between text-sm ${
                  index === progressState.currentPhaseIndex ? colors.text : 'text-gray-500'
                }`}>
                <span>{phase.name}</span>
                <span>
                  {index < progressState.currentPhaseIndex
                    ? '✓'
                    : index === progressState.currentPhaseIndex
                      ? '●'
                      : '○'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Screen reader announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {!indeterminate && `Progress: ${Math.round(progressState.currentProgress)}%`}
        {phases[progressState.currentPhaseIndex] && `, Current phase: ${phases[progressState.currentPhaseIndex].name}`}
        {timeEstimate && `, Estimated time remaining: ${formatDuration(timeEstimate.remaining)}`}
      </div>

      <style jsx>{`
        @keyframes indeterminate {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        @keyframes spin {
          0% {
            transform: rotate(-90deg);
          }
          100% {
            transform: rotate(270deg);
          }
        }

        .shadow-glow {
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
        }
      `}</style>
    </div>
  );
};

/**
 * Create progress indicator UI component configuration
 */
export const createProgressIndicatorComponent = (props: Partial<ProgressIndicatorProps> = {}): UIComponent => ({
  id: `progress-indicator-${Date.now()}`,
  type: 'progress-indicator',
  component: ProgressIndicator,
  props: {
    variant: 'linear',
    size: 'medium',
    colorScheme: 'auto',
    animation: 'smooth',
    showPercentage: true,
    showTimeEstimate: true,
    adaptToTheme: true,
    ...props,
  },
  styling: {
    isolation: true,
    themeAdaptation: true,
    responsiveBreakpoints: ['mobile', 'tablet', 'desktop'],
    customClasses: ['meeting-summarizer-progress'],
    zIndex: 1000,
  },
  eventHandlers: [],
  injectionPoint: props.injectionPoint,
  lifecycle: {
    onMount: () => console.log('Progress indicator mounted'),
    onUnmount: () => console.log('Progress indicator unmounted'),
  },
  cleanup: () => {
    console.log('Progress indicator cleanup completed');
  },
});

/**
 * Progress indicator variants for different contexts
 */
export const ProgressIndicatorVariants = {
  /**
   * Compact linear progress for toolbars
   */
  compact: (props: Partial<ProgressIndicatorProps> = {}) =>
    createProgressIndicatorComponent({
      variant: 'minimal',
      size: 'small',
      showTimeEstimate: false,
      showPhases: false,
      ...props,
    }),

  /**
   * Detailed progress with phases
   */
  detailed: (props: Partial<ProgressIndicatorProps> = {}) =>
    createProgressIndicatorComponent({
      variant: 'stepped',
      size: 'large',
      showTimeEstimate: true,
      showPhases: true,
      ...props,
    }),

  /**
   * Circular progress for overlays
   */
  circular: (props: Partial<ProgressIndicatorProps> = {}) =>
    createProgressIndicatorComponent({
      variant: 'circular',
      size: 'medium',
      showTimeEstimate: false,
      ...props,
    }),

  /**
   * Indeterminate loading
   */
  loading: (props: Partial<ProgressIndicatorProps> = {}) =>
    createProgressIndicatorComponent({
      variant: 'linear',
      size: 'medium',
      indeterminate: true,
      showPercentage: false,
      showTimeEstimate: false,
      ...props,
    }),
};

export default ProgressIndicator;
