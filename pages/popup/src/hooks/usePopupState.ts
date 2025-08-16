/**
 * Popup State Manager Hook
 *
 * Implements React hook for popup state management with background service integration
 * and real-time updates. Manages popup interface state and data.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  PopupState,
  PopupView,
  PopupStateActions,
  JobDisplayInfo,
  UIPreferences,
  ConnectionStatus,
  PopupError,
  JobActions,
  PopupNavigation,
  PopupPerformance,
} from '../types/popup-state';
import type { MeetingRecord } from '@extension/shared';

/**
 * Background service communication interface
 */
interface BackgroundService {
  /** Get current jobs */
  getActiveJobs(): Promise<JobDisplayInfo[]>;
  /** Get recent meetings */
  getRecentMeetings(limit?: number): Promise<MeetingRecord[]>;
  /** Job control actions */
  controlJob(action: 'pause' | 'resume' | 'cancel', jobId: string): Promise<void>;
  /** Get user preferences */
  getPreferences(): Promise<UIPreferences>;
  /** Update user preferences */
  updatePreferences(preferences: Partial<UIPreferences>): Promise<void>;
  /** Subscribe to updates */
  subscribe(callback: (event: BackgroundEvent) => void): () => void;
  /** Check connection status */
  ping(): Promise<boolean>;
}

/**
 * Background service events
 */
interface BackgroundEvent {
  type: 'job-update' | 'meeting-update' | 'connection-change' | 'error';
  data: unknown;
  timestamp: Date;
}

/**
 * Hook configuration options
 */
interface UsePopupStateOptions {
  /** Auto-refresh interval in seconds */
  refreshInterval?: number;
  /** Maximum number of recent meetings to load */
  maxRecentMeetings?: number;
  /** Whether to enable real-time updates */
  enableRealTimeUpdates?: boolean;
  /** Initial view to display */
  initialView?: PopupView;
  /** Background service instance */
  backgroundService?: BackgroundService;
  /** Error handler */
  onError?: (error: PopupError) => void;
  /** Performance monitoring */
  enablePerformanceMonitoring?: boolean;
}

/**
 * Default UI preferences
 */
const defaultUIPreferences: UIPreferences = {
  defaultView: 'jobs',
  maxRecentMeetings: 10,
  compactMode: false,
  showProgressNotifications: true,
  refreshInterval: 30,
  showTooltips: true,
  theme: 'auto',
  enableAnimations: true,
  accessibility: {
    highContrast: false,
    reducedMotion: false,
    screenReaderMode: false,
    largeText: false,
    enhancedFocus: false,
    keyboardNavigation: true,
  },
  quickActions: [],
};

/**
 * Mock background service for development
 */
const createMockBackgroundService = (): BackgroundService => {
  const subscribers = new Set<(event: BackgroundEvent) => void>();

  return {
    async getActiveJobs() {
      await new Promise(resolve => setTimeout(resolve, 100));
      return [
        {
          jobId: 'job-1',
          meetingTitle: 'Weekly Team Standup',
          meetingId: 'meeting-1',
          status: 'processing',
          progress: 65,
          estimatedCompletion: new Date(Date.now() + 5 * 60 * 1000),
          timeRemaining: 300,
          fileSize: 25600000,
          startTime: new Date(Date.now() - 10 * 60 * 1000),
          canPause: true,
          canCancel: true,
          priority: 'normal',
          audioUrl: 'https://example.com/audio/meeting-1.mp3',
        },
      ];
    },

    async getRecentMeetings(limit = 10) {
      await new Promise(resolve => setTimeout(resolve, 150));
      return Array.from({ length: Math.min(limit, 5) }, (_, i) => ({
        id: `meeting-${i + 1}`,
        title: `Meeting ${i + 1}`,
        description: `Description for meeting ${i + 1}`,
        startTime: new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
        status: 'completed' as const,
        source: 'teams' as const,
        participants: [
          {
            id: 'user-1',
            name: 'John Doe',
            email: 'john.doe@example.com',
            role: 'organizer' as const,
            attended: true,
          },
        ],
        organizer: {
          id: 'user-1',
          name: 'John Doe',
          email: 'john.doe@example.com',
          role: 'organizer' as const,
          attended: true,
        },
        metadata: {
          duration: 3600,
          language: 'en-US',
          tags: ['weekly', 'standup'],
        },
        createdAt: new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000).toISOString(),
      }));
    },

    async controlJob(action, jobId) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const event: BackgroundEvent = {
        type: 'job-update',
        data: {
          action,
          jobId,
          status: action === 'cancel' ? 'cancelled' : action === 'pause' ? 'paused' : 'processing',
        },
        timestamp: new Date(),
      };
      subscribers.forEach(callback => callback(event));
    },

    async getPreferences() {
      await new Promise(resolve => setTimeout(resolve, 50));
      return defaultUIPreferences;
    },

    async updatePreferences(preferences) {
      await new Promise(resolve => setTimeout(resolve, 100));
      const event: BackgroundEvent = {
        type: 'job-update',
        data: { preferences },
        timestamp: new Date(),
      };
      subscribers.forEach(callback => callback(event));
    },

    subscribe(callback) {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },

    async ping() {
      await new Promise(resolve => setTimeout(resolve, 10));
      return true;
    },
  };
};

/**
 * Performance monitoring utilities
 */
const createPerformanceMonitor = (): PopupPerformance => {
  const _startTime = performance.now();

  return {
    loadTime: 0,
    renderTime: 0,
    memoryUsage: 0,
    renderCount: 0,
    syncLatency: 0,
  };
};

/**
 * Main popup state management hook
 */
export const usePopupState = (options: UsePopupStateOptions = {}) => {
  const {
    refreshInterval = 30,
    maxRecentMeetings = 10,
    enableRealTimeUpdates = true,
    initialView = 'jobs',
    backgroundService: externalBackgroundService,
    onError,
    enablePerformanceMonitoring = false,
  } = options;

  // State
  const [state, setState] = useState<PopupState>({
    activeJobs: [],
    recentMeetings: [],
    currentView: initialView,
    connectionStatus: 'disconnected',
    lastUpdate: new Date(),
    userPreferences: defaultUIPreferences,
    isLoading: true,
    error: undefined,
    selectedMeeting: undefined,
    availableActions: [],
  });

  // Refs
  const backgroundService = useRef<BackgroundService>(externalBackgroundService || createMockBackgroundService());
  const refreshIntervalRef = useRef<NodeJS.Timeout>();
  const unsubscribeRef = useRef<() => void>();
  const performanceRef = useRef<PopupPerformance>(
    enablePerformanceMonitoring ? createPerformanceMonitor() : ({} as PopupPerformance),
  );
  const renderCountRef = useRef(0);

  // Update performance metrics
  useEffect(() => {
    if (enablePerformanceMonitoring) {
      renderCountRef.current++;
      performanceRef.current.renderCount = renderCountRef.current;
      performanceRef.current.renderTime = performance.now();

      if (performanceRef.current.loadTime === 0) {
        performanceRef.current.loadTime = performance.now();
      }
    }
  });

  // Connection management
  const checkConnection = useCallback(async (): Promise<ConnectionStatus> => {
    try {
      const start = performance.now();
      const isConnected = await backgroundService.current.ping();
      const latency = performance.now() - start;

      if (enablePerformanceMonitoring) {
        performanceRef.current.syncLatency = latency;
      }

      return isConnected ? 'connected' : 'disconnected';
    } catch (_error) {
      return 'error';
    }
  }, [enablePerformanceMonitoring]);

  // Load initial data
  const loadInitialData = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: undefined }));

    try {
      const [jobs, meetings, preferences, connectionStatus] = await Promise.all([
        backgroundService.current.getActiveJobs(),
        backgroundService.current.getRecentMeetings(maxRecentMeetings),
        backgroundService.current.getPreferences(),
        checkConnection(),
      ]);

      setState(prev => ({
        ...prev,
        activeJobs: jobs,
        recentMeetings: meetings,
        userPreferences: { ...defaultUIPreferences, ...preferences },
        connectionStatus,
        lastUpdate: new Date(),
        isLoading: false,
        availableActions: ['refresh', 'settings', 'help'],
      }));
    } catch (_error) {
      const popupError: PopupError = {
        type: 'unknown',
        message: error instanceof Error ? error.message : 'Failed to load data',
        timestamp: new Date(),
        recoverable: true,
        recoveryActions: ['Try refreshing the popup', 'Check your internet connection'],
      };

      setState(prev => ({
        ...prev,
        error: popupError,
        isLoading: false,
        connectionStatus: 'error',
      }));

      onError?.(popupError);
    }
  }, [maxRecentMeetings, checkConnection, onError]);

  // Background event handler
  const handleBackgroundEvent = useCallback(
    (event: BackgroundEvent) => {
      switch (event.type) {
        case 'job-update':
          setState(prev => ({
            ...prev,
            activeJobs: prev.activeJobs.map(job => (job.jobId === event.data.jobId ? { ...job, ...event.data } : job)),
            lastUpdate: event.timestamp,
          }));
          break;

        case 'meeting-update':
          setState(prev => ({
            ...prev,
            recentMeetings: event.data.meetings || prev.recentMeetings,
            lastUpdate: event.timestamp,
          }));
          break;

        case 'connection-change':
          setState(prev => ({
            ...prev,
            connectionStatus: event.data.status,
            lastUpdate: event.timestamp,
          }));
          break;

        case 'error': {
          const error: PopupError = {
            type: event.data.type || 'unknown',
            message: event.data.message,
            timestamp: event.timestamp,
            recoverable: event.data.recoverable ?? true,
            recoveryActions: event.data.recoveryActions,
          };
          setState(prev => ({ ...prev, error }));
          onError?.(error);
          break;
        }
      }
    },
    [onError],
  );

  // State actions
  const actions: PopupStateActions = {
    updateJobs: useCallback((jobs: JobDisplayInfo[]) => {
      setState(prev => ({ ...prev, activeJobs: jobs, lastUpdate: new Date() }));
    }, []),

    updateMeetings: useCallback((meetings: MeetingRecord[]) => {
      setState(prev => ({ ...prev, recentMeetings: meetings, lastUpdate: new Date() }));
    }, []),

    setView: useCallback((view: PopupView) => {
      setState(prev => ({ ...prev, currentView: view }));
    }, []),

    setConnectionStatus: useCallback((status: ConnectionStatus) => {
      setState(prev => ({ ...prev, connectionStatus: status, lastUpdate: new Date() }));
    }, []),

    setError: useCallback((error: PopupError | null) => {
      setState(prev => ({ ...prev, error: error || undefined }));
    }, []),

    setLoading: useCallback((loading: boolean) => {
      setState(prev => ({ ...prev, isLoading: loading }));
    }, []),

    updatePreferences: useCallback(
      async (preferences: Partial<UIPreferences>) => {
        try {
          await backgroundService.current.updatePreferences(preferences);
          setState(prev => ({
            ...prev,
            userPreferences: { ...prev.userPreferences, ...preferences },
            lastUpdate: new Date(),
          }));
        } catch (_error) {
          const popupError: PopupError = {
            type: 'unknown',
            message: 'Failed to update preferences',
            timestamp: new Date(),
            recoverable: true,
          };
          setState(prev => ({ ...prev, error: popupError }));
          onError?.(popupError);
        }
      },
      [onError],
    ),

    selectMeeting: useCallback((meeting: MeetingRecord | null) => {
      setState(prev => ({ ...prev, selectedMeeting: meeting || undefined }));
    }, []),

    refreshData: useCallback(async () => {
      await loadInitialData();
    }, [loadInitialData]),
  };

  // Job actions
  const jobActions: JobActions = {
    pause: useCallback(
      async (jobId: string) => {
        try {
          await backgroundService.current.controlJob('pause', jobId);
        } catch (_error) {
          const popupError: PopupError = {
            type: 'unknown',
            message: 'Failed to pause job',
            timestamp: new Date(),
            recoverable: true,
          };
          actions.setError(popupError);
        }
      },
      [actions],
    ),

    resume: useCallback(
      async (jobId: string) => {
        try {
          await backgroundService.current.controlJob('resume', jobId);
        } catch (_error) {
          const popupError: PopupError = {
            type: 'unknown',
            message: 'Failed to resume job',
            timestamp: new Date(),
            recoverable: true,
          };
          actions.setError(popupError);
        }
      },
      [actions],
    ),

    cancel: useCallback(
      async (jobId: string) => {
        try {
          await backgroundService.current.controlJob('cancel', jobId);
        } catch (_error) {
          const popupError: PopupError = {
            type: 'unknown',
            message: 'Failed to cancel job',
            timestamp: new Date(),
            recoverable: true,
          };
          actions.setError(popupError);
        }
      },
      [actions],
    ),

    retry: useCallback(async (jobId: string) => {
      // Implementation would depend on background service API
      console.log('Retry job:', jobId);
    }, []),

    getDetails: useCallback(
      async (jobId: string) => {
        const job = state.activeJobs.find(j => j.jobId === jobId);
        if (!job) {
          throw new Error('Job not found');
        }
        return job;
      },
      [state.activeJobs],
    ),

    updatePriority: useCallback(async (jobId: string, priority: 'high' | 'normal' | 'low') => {
      setState(prev => ({
        ...prev,
        activeJobs: prev.activeJobs.map(job => (job.jobId === jobId ? { ...job, priority } : job)),
        lastUpdate: new Date(),
      }));
    }, []),
  };

  // Setup effect
  useEffect(() => {
    loadInitialData();

    // Setup real-time updates
    if (enableRealTimeUpdates) {
      unsubscribeRef.current = backgroundService.current.subscribe(handleBackgroundEvent);
    }

    // Setup refresh interval
    if (refreshInterval > 0) {
      refreshIntervalRef.current = setInterval(() => {
        checkConnection().then(status => {
          if (status === 'connected') {
            loadInitialData();
          } else {
            setState(prev => ({ ...prev, connectionStatus: status }));
          }
        });
      }, refreshInterval * 1000);
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [loadInitialData, enableRealTimeUpdates, refreshInterval, checkConnection, handleBackgroundEvent]);

  // Memory monitoring (if enabled)
  useEffect(() => {
    if (enablePerformanceMonitoring && 'memory' in performance) {
      performanceRef.current.memoryUsage = (performance as { memory?: { usedJSHeapSize?: number } }).memory?.usedJSHeapSize || 0;
    }
  });

  return {
    // State
    state,

    // Actions
    actions,

    // Job actions
    jobActions,

    // Utility functions
    isConnected: state.connectionStatus === 'connected',
    hasActiveJobs: state.activeJobs.length > 0,
    hasError: !!state.error,
    isLoading: state.isLoading,

    // Performance metrics (if enabled)
    performance: enablePerformanceMonitoring ? performanceRef.current : undefined,

    // Manual refresh
    refresh: actions.refreshData,
  };
};

/**
 * Hook for managing popup navigation
 */
export const usePopupNavigation = (initialView: PopupView = 'jobs') => {
  const [navigation, setNavigation] = useState<PopupNavigation>({
    currentView: initialView,
    viewHistory: [initialView],
    canGoBack: false,
    params: {},
  });

  const navigateTo = useCallback((view: PopupView, params: Record<string, string> = {}) => {
    setNavigation(prev => ({
      currentView: view,
      viewHistory: [...prev.viewHistory, view].slice(-10), // Keep last 10 views
      canGoBack: prev.viewHistory.length > 0,
      params,
    }));
  }, []);

  const goBack = useCallback(() => {
    setNavigation(prev => {
      if (prev.viewHistory.length <= 1) return prev;

      const newHistory = prev.viewHistory.slice(0, -1);
      const previousView = newHistory[newHistory.length - 1];

      return {
        currentView: previousView,
        viewHistory: newHistory,
        canGoBack: newHistory.length > 1,
        params: {},
      };
    });
  }, []);

  const clearHistory = useCallback(() => {
    setNavigation(prev => ({
      ...prev,
      viewHistory: [prev.currentView],
      canGoBack: false,
    }));
  }, []);

  return {
    navigation,
    navigateTo,
    goBack,
    clearHistory,
  };
};

/**
 * Hook for popup keyboard shortcuts
 */
export const usePopupKeyboard = (actions: PopupStateActions) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts when popup is focused
      if (!document.hasFocus()) return;

      switch (event.key) {
        case 'F5':
          event.preventDefault();
          actions.refreshData();
          break;
        case 'Escape':
          actions.setError(null);
          break;
        case '1':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            actions.setView('jobs');
          }
          break;
        case '2':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            actions.setView('meetings');
          }
          break;
        case '3':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            actions.setView('summary');
          }
          break;
        case '4':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            actions.setView('settings');
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [actions]);
};

export default usePopupState;
