/**
 * Progress Monitoring Types
 *
 * Type definitions for progress monitoring and status display components,
 * including job progress tracking, notification management, and status indicators.
 */

/**
 * Job execution status for progress display
 */
export type JobStatus = 'idle' | 'pending' | 'processing' | 'paused' | 'completed' | 'failed' | 'cancelled';

/**
 * Overall system processing status
 */
export type OverallStatus = 'idle' | 'processing' | 'paused' | 'error' | 'maintenance';

/**
 * Progress bar animation state
 */
export type ProgressBarState = 'normal' | 'pulsing' | 'error' | 'success';

/**
 * Notification priority levels
 */
export type NotificationPriority = 'critical' | 'high' | 'normal' | 'low';

/**
 * Notification display types
 */
export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'progress';

/**
 * Error severity levels for display
 */
export type ErrorSeverity = 'critical' | 'error' | 'warning' | 'info';

/**
 * Connection status with background service
 */
export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting' | 'error';

/**
 * Complete progress display state for monitoring components
 */
export interface ProgressDisplayState {
  /** Individual job progress tracking */
  jobProgress: Map<string, JobProgress>;
  /** Overall system processing status */
  overallStatus: OverallStatus;
  /** Estimated completion time for all active jobs */
  estimatedCompletion?: Date;
  /** Error states for individual jobs */
  errorStates: Map<string, ErrorState>;
  /** Queue of pending notifications */
  notificationQueue: Notification[];
  /** Current connection status with background service */
  connectionStatus: ConnectionStatus;
  /** Total progress percentage across all jobs */
  totalProgress: number;
  /** Number of active jobs */
  activeJobCount: number;
  /** Number of queued jobs */
  queuedJobCount: number;
  /** Performance metrics */
  performanceMetrics: PerformanceMetrics;
  /** Last update timestamp */
  lastUpdate: Date;
}

/**
 * Individual job progress information
 */
export interface JobProgress {
  /** Job unique identifier */
  jobId: string;
  /** Associated meeting identifier */
  meetingId?: string;
  /** Job display name or title */
  title?: string;
  /** Current job status */
  status: JobStatus;
  /** Progress percentage (0-100) */
  progress: number;
  /** Current processing stage */
  stage: ProgressStage;
  /** All processing stages */
  stages: ProgressStage[];
  /** Current processing phase (legacy) */
  phase?: ProcessingPhase;
  /** Estimated completion time */
  estimatedCompletion?: Date;
  /** Time remaining in seconds */
  timeRemaining?: number;
  /** Processing start time */
  startTime: Date;
  /** Last update time */
  lastUpdate?: Date;
  /** Processing completion time */
  endTime?: Date;
  /** Audio file size being processed */
  fileSize?: number;
  /** Bytes processed so far */
  bytesProcessed?: number;
  /** Processing speed in bytes per second */
  processingSpeed?: number;
  /** Error information if job failed */
  error?: JobError;
  /** Whether job can be paused */
  canPause?: boolean;
  /** Whether job can be cancelled */
  canCancel?: boolean;
  /** Whether job can be retried */
  canRetry?: boolean;
  /** Job priority level */
  priority?: NotificationPriority;
  /** Progress bar visual state */
  progressBarState?: ProgressBarState;
  /** Detailed status message */
  statusMessage?: string;
  /** Current processing message */
  message?: string;
}

/**
 * Job processing phases
 */
export interface ProcessingPhase {
  /** Phase identifier */
  id: 'initializing' | 'uploading' | 'transcribing' | 'processing' | 'finalizing';
  /** Human-readable phase name */
  name: string;
  /** Phase description */
  description: string;
  /** Whether this phase is currently active */
  active: boolean;
  /** Whether this phase is completed */
  completed: boolean;
  /** Phase progress percentage (0-100) */
  progress: number;
  /** Estimated duration for this phase */
  estimatedDuration?: number;
  /** Actual duration if completed */
  actualDuration?: number;
}

/**
 * Job error information for display
 */
export interface JobError {
  /** Error type */
  type: 'network' | 'authentication' | 'processing' | 'quota' | 'timeout' | 'unknown';
  /** Error severity level */
  severity: ErrorSeverity;
  /** User-friendly error message */
  message: string;
  /** Technical error details */
  details?: string;
  /** Error code if available */
  code?: string;
  /** Timestamp when error occurred */
  timestamp: Date;
  /** Whether error is recoverable */
  recoverable: boolean;
  /** Suggested recovery actions */
  recoveryActions?: string[];
  /** Whether error should be retried automatically */
  autoRetry: boolean;
  /** Number of retry attempts made */
  retryCount: number;
  /** Maximum retry attempts allowed */
  maxRetries: number;
}

/**
 * Error state information for components
 */
export interface ErrorState {
  /** Associated job identifier */
  jobId: string;
  /** Error information */
  error: JobError;
  /** Whether error is currently displayed */
  displayed: boolean;
  /** Whether user has acknowledged the error */
  acknowledged: boolean;
  /** Error display preferences */
  displayOptions: ErrorDisplayOptions;
}

/**
 * Error display configuration
 */
export interface ErrorDisplayOptions {
  /** Show detailed error information */
  showDetails: boolean;
  /** Show recovery action buttons */
  showActions: boolean;
  /** Auto-dismiss timeout in seconds */
  autoDismissTimeout?: number;
  /** Whether error can be dismissed by user */
  dismissible: boolean;
  /** Whether to show retry button */
  showRetryButton: boolean;
  /** Whether to show report button */
  showReportButton: boolean;
}

/**
 * Notification information for user feedback
 */
export interface Notification {
  /** Notification unique identifier */
  id: string;
  /** Notification type */
  type: NotificationType;
  /** Priority level */
  priority: NotificationPriority;
  /** Notification title */
  title: string;
  /** Notification message */
  message: string;
  /** Notification icon or emoji */
  icon?: string;
  /** Associated job ID if applicable */
  jobId?: string;
  /** Associated meeting ID if applicable */
  meetingId?: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Display duration in seconds */
  duration?: number;
  /** Whether notification can be dismissed */
  dismissible: boolean;
  /** Whether notification has been read */
  read: boolean;
  /** Action buttons available */
  actions?: NotificationAction[];
  /** Additional data payload */
  data?: Record<string, unknown>;
  /** Whether notification should persist across sessions */
  persistent: boolean;
}

/**
 * Notification action button
 */
export interface NotificationAction {
  /** Action identifier */
  id: string;
  /** Button label */
  label: string;
  /** Action type */
  type: 'primary' | 'secondary' | 'danger';
  /** Action handler */
  action: () => void | Promise<void>;
  /** Whether action closes the notification */
  closesNotification: boolean;
  /** Action icon */
  icon?: string;
  /** Whether action is disabled */
  disabled?: boolean;
}

/**
 * Notification queue management
 */
export interface NotificationQueue {
  /** Queue of pending notifications */
  queue: Notification[];
  /** Currently displayed notifications */
  displayed: Notification[];
  /** Maximum notifications to display simultaneously */
  maxDisplayed: number;
  /** Default display duration in seconds */
  defaultDuration: number;
  /** Whether queue is paused */
  paused: boolean;
  /** Queue processing statistics */
  stats: NotificationStats;
}

/**
 * Notification statistics
 */
export interface NotificationStats {
  /** Total notifications created */
  totalCreated: number;
  /** Total notifications displayed */
  totalDisplayed: number;
  /** Total notifications dismissed */
  totalDismissed: number;
  /** Total notifications expired */
  totalExpired: number;
  /** Average display duration */
  averageDisplayDuration: number;
  /** Notifications by type count */
  countByType: Record<NotificationType, number>;
  /** Notifications by priority count */
  countByPriority: Record<NotificationPriority, number>;
}

/**
 * Performance metrics for progress monitoring
 */
export interface PerformanceMetrics {
  /** Average processing speed in bytes per second */
  averageProcessingSpeed: number;
  /** Peak processing speed achieved */
  peakProcessingSpeed: number;
  /** Total processing time across all jobs */
  totalProcessingTime: number;
  /** Average job completion time */
  averageJobTime: number;
  /** System resource usage */
  resourceUsage: ResourceUsage;
  /** Processing efficiency percentage */
  efficiency: number;
  /** Throughput in jobs per hour */
  throughput: number;
  /** Error rate percentage */
  errorRate: number;
  /** Retry rate percentage */
  retryRate: number;
}

/**
 * System resource usage information
 */
export interface ResourceUsage {
  /** Memory usage in MB */
  memoryUsage: number;
  /** CPU usage percentage */
  cpuUsage: number;
  /** Network bandwidth usage in KB/s */
  networkUsage: number;
  /** Storage space used in MB */
  storageUsage: number;
  /** Peak resource usage values */
  peaks: {
    memory: number;
    cpu: number;
    network: number;
    storage: number;
  };
}

/**
 * Progress monitoring configuration
 */
export interface ProgressMonitorConfig {
  /** Update interval in milliseconds */
  updateInterval: number;
  /** Enable detailed progress tracking */
  enableDetailedTracking: boolean;
  /** Enable performance metrics */
  enablePerformanceMetrics: boolean;
  /** Maximum number of completed jobs to retain */
  maxCompletedJobs: number;
  /** Auto-cleanup interval in minutes */
  cleanupInterval: number;
  /** Notification display preferences */
  notificationPreferences: NotificationPreferences;
  /** Error handling preferences */
  errorHandling: ErrorHandlingPreferences;
}

/**
 * Notification display preferences
 */
export interface NotificationPreferences {
  /** Enable desktop notifications */
  enableDesktop: boolean;
  /** Enable in-app notifications */
  enableInApp: boolean;
  /** Enable sound notifications */
  enableSound: boolean;
  /** Default notification duration */
  defaultDuration: number;
  /** Maximum simultaneous notifications */
  maxSimultaneous: number;
  /** Notification position */
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  /** Enable notification grouping */
  enableGrouping: boolean;
}

/**
 * Error handling preferences
 */
export interface ErrorHandlingPreferences {
  /** Auto-retry failed jobs */
  enableAutoRetry: boolean;
  /** Maximum auto-retry attempts */
  maxAutoRetries: number;
  /** Retry delay in seconds */
  retryDelay: number;
  /** Show detailed error information */
  showDetailedErrors: boolean;
  /** Enable error reporting */
  enableErrorReporting: boolean;
  /** Auto-dismiss non-critical errors */
  autoDismissErrors: boolean;
}

/**
 * Progress monitoring state actions
 */
export interface ProgressMonitorActions {
  /** Update job progress */
  updateJobProgress: (jobId: string, progress: Partial<JobProgress>) => void;
  /** Add new job to monitoring */
  addJob: (job: JobProgress) => void;
  /** Remove job from monitoring */
  removeJob: (jobId: string) => void;
  /** Clear completed jobs */
  clearCompleted: () => void;
  /** Pause job processing */
  pauseJob: (jobId: string) => Promise<void>;
  /** Resume job processing */
  resumeJob: (jobId: string) => Promise<void>;
  /** Cancel job processing */
  cancelJob: (jobId: string) => Promise<void>;
  /** Retry failed job */
  retryJob: (jobId: string) => Promise<void>;
  /** Add notification to queue */
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => void;
  /** Dismiss notification */
  dismissNotification: (notificationId: string) => void;
  /** Clear all notifications */
  clearNotifications: () => void;
  /** Update connection status */
  updateConnectionStatus: (status: ConnectionStatus) => void;
  /** Reset all progress state */
  reset: () => void;
}

/**
 * Progress bar component props
 */
export interface ProgressBarProps {
  /** Progress percentage (0-100) */
  progress: number;
  /** Progress bar state for styling */
  state?: ProgressBarState;
  /** Show percentage text */
  showPercentage?: boolean;
  /** Show time remaining */
  showTimeRemaining?: boolean;
  /** Estimated time remaining in seconds */
  timeRemaining?: number;
  /** Progress bar height */
  height?: 'small' | 'medium' | 'large';
  /** Custom class name */
  className?: string;
  /** Progress bar label */
  label?: string;
  /** Whether to animate progress changes */
  animated?: boolean;
  /** Color scheme */
  colorScheme?: 'blue' | 'green' | 'red' | 'yellow' | 'gray';
}

/**
 * Status indicator component props
 */
export interface StatusIndicatorProps {
  /** Current status */
  status: JobStatus | ConnectionStatus;
  /** Status label text */
  label?: string;
  /** Show status text */
  showText?: boolean;
  /** Indicator size */
  size?: 'small' | 'medium' | 'large';
  /** Custom class name */
  className?: string;
  /** Whether to animate status changes */
  animated?: boolean;
  /** Tooltip text */
  tooltip?: string;
  /** Click handler */
  onClick?: () => void;
}

/**
 * Error display component props
 */
export interface ErrorDisplayProps {
  /** Error information to display */
  error: JobError;
  /** Display options */
  options?: Partial<ErrorDisplayOptions>;
  /** Error dismissal handler */
  onDismiss?: () => void;
  /** Retry action handler */
  onRetry?: () => void;
  /** Report error handler */
  onReport?: (error: JobError) => void;
  /** Custom class name */
  className?: string;
}

/**
 * Notification display component props
 */
export interface NotificationDisplayProps {
  /** Notification to display */
  notification: Notification;
  /** Dismissal handler */
  onDismiss?: (id: string) => void;
  /** Action handler */
  onAction?: (actionId: string, notificationId: string) => void;
  /** Custom class name */
  className?: string;
  /** Position for display */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

/**
 * Additional types for useProgressMonitor hook
 */

/**
 * Progress state for hook management
 */
export interface ProgressState {
  /** Job progress states */
  progressStates: Map<string, JobProgress>;
  /** Progress history */
  progressHistory: Map<string, ProgressUpdate[]>;
  /** Progress metrics */
  progressMetrics: Map<string, ProgressMetrics>;
  /** Notification queue */
  notifications: NotificationQueue;
  /** Monitoring status */
  isMonitoring: boolean;
  /** Error state */
  error: ProgressError | null;
}

/**
 * Progress update event
 */
export interface ProgressUpdate {
  /** Job identifier */
  jobId: string;
  /** Current progress percentage */
  progress: number;
  /** Current stage */
  stage: ProgressStage;
  /** Update timestamp */
  timestamp: Date;
  /** Progress message */
  message: string;
  /** Progress metrics */
  metrics?: ProgressMetrics;
}

/**
 * Progress metrics for monitoring
 */
export interface ProgressMetrics {
  /** Total processing duration */
  totalDuration: number;
  /** Average processing speed */
  averageSpeed: number;
  /** Peak processing speed */
  peakSpeed: number;
  /** Processing efficiency */
  efficiency: number;
  /** Stage-specific metrics */
  stageMetrics: StageMetrics[];
  /** Processing completion estimate */
  estimatedCompletion?: Date;
  /** Processing velocity */
  velocity: number;
  /** Processing speed in operations per second */
  processingSpeed: number;
}

/**
 * Stage-specific metrics
 */
export interface StageMetrics {
  /** Stage identifier */
  stageId: string;
  /** Stage duration */
  duration: number;
  /** Average speed for this stage */
  averageSpeed: number;
  /** Stage efficiency */
  efficiency: number;
}

/**
 * Progress event for monitoring
 */
export interface ProgressEvent {
  /** Event type */
  type: 'start' | 'progress' | 'stage_change' | 'complete' | 'error' | 'pause' | 'resume' | 'cancel';
  /** Job identifier */
  jobId: string;
  /** Event timestamp */
  timestamp: Date;
  /** Event data */
  data?: unknown;
  /** Associated stage */
  stage?: ProgressStage;
  /** Event message */
  message?: string;
}

/**
 * Progress stage information
 */
export interface ProgressStage {
  /** Stage identifier */
  id: string;
  /** Stage display name */
  name: string;
  /** Stage progress percentage */
  progress: number;
  /** Stage weight for overall progress calculation */
  weight: number;
  /** Stage description */
  description?: string;
  /** Stage status */
  status?: 'pending' | 'active' | 'completed' | 'error';
  /** Stage start time */
  startTime?: Date;
  /** Stage end time */
  endTime?: Date;
}

/**
 * Progress error information
 */
export interface ProgressError {
  /** Error type */
  type: 'network' | 'subscription' | 'processing' | 'timeout' | 'unknown';
  /** Error message */
  message: string;
  /** Associated job ID */
  jobId?: string;
  /** Error timestamp */
  timestamp: Date;
  /** Whether error is recoverable */
  recoverable: boolean;
  /** Error details */
  details?: string;
  /** Error code */
  code?: string;
}
