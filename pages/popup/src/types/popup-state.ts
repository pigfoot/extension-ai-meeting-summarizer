/**
 * Popup State Types
 *
 * Type definitions for popup interface state management, including
 * active job tracking, meeting display, and user interface preferences.
 */

import type { MeetingRecord } from '@extension/shared';

/**
 * Represents the current view or tab in the popup interface
 */
export type PopupView = 'jobs' | 'meetings' | 'settings' | 'summary';

/**
 * Connection status between popup and background service
 */
export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'reconnecting';

/**
 * Job display status for UI representation
 */
export type JobDisplayStatus = 'idle' | 'processing' | 'paused' | 'completed' | 'failed' | 'cancelled';

/**
 * Complete popup interface state containing all UI-relevant data
 */
export interface PopupState {
  /** Currently active transcription jobs */
  activeJobs: JobDisplayInfo[];
  /** Recent meeting records for quick access */
  recentMeetings: MeetingRecord[];
  /** Current active view in the popup */
  currentView: PopupView;
  /** Connection status with background service */
  connectionStatus: ConnectionStatus;
  /** Timestamp of last successful update from background */
  lastUpdate: Date;
  /** User interface preferences */
  userPreferences: UIPreferences;
  /** Loading state for async operations */
  isLoading: boolean;
  /** Current error state if any */
  error?: PopupError;
  /** Selected meeting for detailed view */
  selectedMeeting?: MeetingRecord;
  /** Quick actions availability */
  availableActions: string[];
}

/**
 * Job information optimized for popup display
 */
export interface JobDisplayInfo {
  /** Job unique identifier */
  jobId: string;
  /** Meeting title for display */
  meetingTitle: string;
  /** Meeting identifier associated with this job */
  meetingId: string;
  /** Current job status */
  status: JobDisplayStatus;
  /** Progress percentage (0-100) */
  progress: number;
  /** Estimated completion time */
  estimatedCompletion?: Date;
  /** Time remaining in seconds */
  timeRemaining?: number;
  /** File size being processed in bytes */
  fileSize?: number;
  /** Processing start time */
  startTime: Date;
  /** Processing completion time */
  endTime?: Date;
  /** Error message if job failed */
  errorMessage?: string;
  /** Whether job can be paused */
  canPause: boolean;
  /** Whether job can be cancelled */
  canCancel: boolean;
  /** Job priority level */
  priority: 'high' | 'normal' | 'low';
  /** Source audio URL being processed */
  audioUrl: string;
}

/**
 * UI-specific preferences for popup interface
 */
export interface UIPreferences {
  /** Default view to show when popup opens */
  defaultView: PopupView;
  /** Number of recent meetings to display */
  maxRecentMeetings: number;
  /** Enable compact mode for smaller displays */
  compactMode: boolean;
  /** Show job progress notifications */
  showProgressNotifications: boolean;
  /** Auto-refresh interval in seconds */
  refreshInterval: number;
  /** Enable tooltips and help text */
  showTooltips: boolean;
  /** Color theme preference */
  theme: 'light' | 'dark' | 'auto';
  /** Animation and transition preferences */
  enableAnimations: boolean;
  /** Accessibility preferences */
  accessibility: AccessibilitySettings;
  /** Quick action button configuration */
  quickActions: QuickActionConfig[];
}

/**
 * Accessibility settings for popup interface
 */
export interface AccessibilitySettings {
  /** High contrast mode */
  highContrast: boolean;
  /** Reduced motion preference */
  reducedMotion: boolean;
  /** Screen reader optimizations */
  screenReaderMode: boolean;
  /** Large text mode */
  largeText: boolean;
  /** Focus indicators enhancement */
  enhancedFocus: boolean;
  /** Keyboard navigation preferences */
  keyboardNavigation: boolean;
}

/**
 * Quick action button configuration
 */
export interface QuickActionConfig {
  /** Action identifier */
  id: string;
  /** Display label */
  label: string;
  /** Icon name or identifier */
  icon: string;
  /** Whether action is enabled */
  enabled: boolean;
  /** Action priority for ordering */
  priority: number;
  /** Action type */
  type: 'primary' | 'secondary' | 'danger';
  /** Tooltip text */
  tooltip?: string;
  /** Keyboard shortcut */
  shortcut?: string;
}

/**
 * Error information for popup display
 */
export interface PopupError {
  /** Error type */
  type: 'connection' | 'authentication' | 'storage' | 'api' | 'unknown';
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
}

/**
 * Meeting list filter configuration
 */
export interface MeetingListFilter {
  /** Search query for meeting titles */
  searchQuery: string;
  /** Status filter */
  statusFilter: 'all' | 'completed' | 'processing' | 'failed';
  /** Date range filter */
  dateRange: {
    startDate?: Date;
    endDate?: Date;
  };
  /** Sort configuration */
  sortBy: 'date' | 'title' | 'status' | 'duration';
  /** Sort direction */
  sortDirection: 'asc' | 'desc';
  /** Number of meetings to display */
  limit: number;
}

/**
 * Job management actions available in popup
 */
export interface JobActions {
  /** Pause an active job */
  pause: (jobId: string) => Promise<void>;
  /** Resume a paused job */
  resume: (jobId: string) => Promise<void>;
  /** Cancel a job */
  cancel: (jobId: string) => Promise<void>;
  /** Retry a failed job */
  retry: (jobId: string) => Promise<void>;
  /** Get job details */
  getDetails: (jobId: string) => Promise<JobDisplayInfo>;
  /** Update job priority */
  updatePriority: (jobId: string, priority: 'high' | 'normal' | 'low') => Promise<void>;
}

/**
 * Navigation state for popup interface
 */
export interface PopupNavigation {
  /** Current view */
  currentView: PopupView;
  /** View history for back navigation */
  viewHistory: PopupView[];
  /** Whether back navigation is available */
  canGoBack: boolean;
  /** Navigation parameters */
  params: Record<string, string>;
}

/**
 * Performance metrics for popup interface
 */
export interface PopupPerformance {
  /** Initial load time in milliseconds */
  loadTime: number;
  /** Last render time in milliseconds */
  renderTime: number;
  /** Memory usage in bytes */
  memoryUsage: number;
  /** Number of re-renders */
  renderCount: number;
  /** Background sync latency */
  syncLatency: number;
}

/**
 * Popup state update actions
 */
export interface PopupStateActions {
  /** Update active jobs list */
  updateJobs: (jobs: JobDisplayInfo[]) => void;
  /** Update recent meetings list */
  updateMeetings: (meetings: MeetingRecord[]) => void;
  /** Set current view */
  setView: (view: PopupView) => void;
  /** Update connection status */
  setConnectionStatus: (status: ConnectionStatus) => void;
  /** Set error state */
  setError: (error: PopupError | null) => void;
  /** Set loading state */
  setLoading: (loading: boolean) => void;
  /** Update user preferences */
  updatePreferences: (preferences: Partial<UIPreferences>) => void;
  /** Select meeting for detailed view */
  selectMeeting: (meeting: MeetingRecord | null) => void;
  /** Refresh all data from background */
  refreshData: () => Promise<void>;
}
