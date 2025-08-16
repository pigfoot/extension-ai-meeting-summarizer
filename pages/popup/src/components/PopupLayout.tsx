/**
 * Popup Layout Component
 *
 * Implements responsive layout for popup constraints (400px width) with navigation
 * and view switching for popup interface. Provides optimized layout for extension popup.
 */

import { JobStatusView } from './JobStatusView';
import { MeetingList } from './MeetingList';
import { SummaryPreview } from './SummaryPreview';
import { cn } from '@extension/ui';
import { useState, useCallback, useEffect, useMemo } from 'react';
import type {
  PopupState,
  PopupView,
  PopupNavigation,
  UIPreferences,
  ConnectionStatus,
  PopupError,
  QuickActionConfig,
} from '../types/popup-state';
import type { MeetingRecord } from '@extension/shared';
import type React from 'react';

// Import popup-specific components

/**
 * Popup layout component props
 */
interface PopupLayoutProps {
  /** Current popup state */
  state: PopupState;
  /** State update handlers */
  onStateChange: (updates: Partial<PopupState>) => void;
  /** Navigation handlers */
  onNavigate: (view: PopupView, params?: Record<string, string>) => void;
  /** Job action handlers */
  onJobAction?: (action: string, jobId: string) => void;
  /** Meeting selection handler */
  onMeetingSelect?: (meeting: MeetingRecord) => void;
  /** Quick action handlers */
  onQuickAction?: (actionId: string) => void;
  /** Settings action handlers */
  onSettingsAction?: (action: string, value?: unknown) => void;
  /** Refresh data handler */
  onRefresh?: () => Promise<void>;
  /** Custom class name */
  className?: string;
}

/**
 * Navigation tab configuration
 */
interface NavTab {
  id: PopupView;
  label: string;
  icon: string;
  shortLabel?: string;
  badge?: number | string;
  disabled?: boolean;
}

/**
 * Get navigation tabs configuration
 */
const getNavigationTabs = (state: PopupState): NavTab[] => [
  {
    id: 'jobs',
    label: 'Active Jobs',
    shortLabel: 'Jobs',
    icon: '⚡',
    badge: state.activeJobs.filter(job => job.status === 'processing').length || undefined,
  },
  {
    id: 'meetings',
    label: 'Recent Meetings',
    shortLabel: 'Meetings',
    icon: '📋',
    badge: state.recentMeetings.length || undefined,
  },
  {
    id: 'summary',
    label: 'Summary',
    shortLabel: 'Summary',
    icon: '📝',
    disabled: !state.selectedMeeting,
  },
  {
    id: 'settings',
    label: 'Settings',
    shortLabel: 'Settings',
    icon: '⚙️',
  },
];

/**
 * Header component with navigation
 */
const PopupHeader: React.FC<{
  currentView: PopupView;
  tabs: NavTab[];
  connectionStatus: ConnectionStatus;
  onNavigate: (view: PopupView) => void;
  onRefresh?: () => void;
  compact?: boolean;
}> = ({ currentView, tabs, connectionStatus, onNavigate, onRefresh, compact = false }) => {
  const getConnectionIndicator = () => {
    switch (connectionStatus) {
      case 'connected':
        return { icon: '🟢', label: 'Connected', color: 'text-green-600' };
      case 'disconnected':
        return { icon: '🔴', label: 'Disconnected', color: 'text-red-600' };
      case 'error':
        return { icon: '⚠️', label: 'Error', color: 'text-orange-600' };
      case 'reconnecting':
        return { icon: '🟡', label: 'Reconnecting', color: 'text-yellow-600' };
      default:
        return { icon: '⚪', label: 'Unknown', color: 'text-gray-600' };
    }
  };

  const connection = getConnectionIndicator();

  return (
    <div
      className={cn(
        'flex items-center justify-between border-b border-gray-200 bg-white px-3 py-2',
        compact && 'px-2 py-1',
      )}>
      {/* Navigation Tabs */}
      <div className="flex min-w-0 flex-1 items-center gap-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => !tab.disabled && onNavigate(tab.id)}
            disabled={tab.disabled}
            className={cn(
              'relative flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors',
              currentView === tab.id
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
              tab.disabled && 'cursor-not-allowed opacity-50',
              compact && 'px-1',
            )}
            title={tab.label}>
            <span className="text-sm">{tab.icon}</span>
            <span className={cn('hidden sm:inline', compact && 'sr-only')}>{compact ? tab.shortLabel : tab.label}</span>
            {tab.badge && (
              <span className="ml-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-xs text-white">
                {typeof tab.badge === 'number' && tab.badge > 99 ? '99+' : tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Connection Status & Actions */}
      <div className="flex items-center gap-2">
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-1 text-gray-500 transition-colors hover:text-gray-700"
            title="Refresh">
            <span className="text-sm">🔄</span>
          </button>
        )}

        <div className={cn('flex items-center gap-1', connection.color)} title={`Status: ${connection.label}`}>
          <span className="text-xs">{connection.icon}</span>
          {!compact && <span className="text-xs font-medium">{connection.label}</span>}
        </div>
      </div>
    </div>
  );
};

/**
 * Error display component
 */
const ErrorDisplay: React.FC<{
  error: PopupError;
  onDismiss: () => void;
  onRetry?: () => void;
  compact?: boolean;
}> = ({ error, onDismiss, onRetry, compact = false }) => (
  <div className={cn('m-3 rounded border border-red-200 bg-red-50 p-3', compact && 'm-2 p-2')}>
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-red-500">⚠️</span>
          <h3 className={cn('font-medium text-red-900', compact ? 'text-sm' : 'text-base')}>
            {error.type.charAt(0).toUpperCase() + error.type.slice(1)} Error
          </h3>
        </div>
        <p className={cn('mt-1 text-red-700', compact ? 'text-xs' : 'text-sm')}>{error.message}</p>
        {error.recoveryActions && error.recoveryActions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {error.recoverable && onRetry && (
              <button
                onClick={onRetry}
                className={cn(
                  'rounded bg-red-600 px-2 py-1 text-xs text-white transition-colors hover:bg-red-700',
                  compact && 'px-1 text-xs',
                )}>
                Retry
              </button>
            )}
            <button
              onClick={onDismiss}
              className={cn(
                'rounded bg-gray-300 px-2 py-1 text-xs text-gray-700 transition-colors hover:bg-gray-400',
                compact && 'px-1 text-xs',
              )}>
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  </div>
);

/**
 * Quick actions component
 */
const QuickActions: React.FC<{
  actions: QuickActionConfig[];
  onAction: (actionId: string) => void;
  compact?: boolean;
}> = ({ actions, onAction, compact = false }) => {
  if (actions.length === 0) return null;

  const enabledActions = actions.filter(action => action.enabled);
  if (enabledActions.length === 0) return null;

  return (
    <div className={cn('border-t border-gray-200 bg-gray-50 p-3', compact && 'p-2')}>
      <div className="flex items-center justify-center gap-2">
        {enabledActions.slice(0, 3).map(action => (
          <button
            key={action.id}
            onClick={() => onAction(action.id)}
            className={cn(
              'inline-flex items-center gap-1 rounded px-3 py-1.5 text-xs font-medium transition-colors',
              action.type === 'primary' && 'bg-blue-600 text-white hover:bg-blue-700',
              action.type === 'secondary' && 'bg-gray-200 text-gray-700 hover:bg-gray-300',
              action.type === 'danger' && 'bg-red-600 text-white hover:bg-red-700',
              compact && 'px-2 py-1',
            )}
            title={action.tooltip || action.label}>
            <span>{action.icon}</span>
            {!compact && <span>{action.label}</span>}
          </button>
        ))}
      </div>
    </div>
  );
};

/**
 * Settings view component
 */
const SettingsView: React.FC<{
  preferences: UIPreferences;
  onPreferencesChange: (preferences: Partial<UIPreferences>) => void;
  onAction?: (action: string, value?: unknown) => void;
  compact?: boolean;
}> = ({ preferences, onPreferencesChange, onAction, compact = false }) => (
  <div className={cn('space-y-4 p-3', compact && 'space-y-3 p-2')}>
    <div>
      <h3 className={cn('mb-2 font-semibold text-gray-900', compact ? 'text-sm' : 'text-base')}>Display Preferences</h3>

      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={preferences.compactMode}
            onChange={e => onPreferencesChange({ compactMode: e.target.checked })}
            className="rounded"
          />
          <span className={cn('text-gray-700', compact ? 'text-sm' : 'text-base')}>Compact Mode</span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={preferences.showProgressNotifications}
            onChange={e => onPreferencesChange({ showProgressNotifications: e.target.checked })}
            className="rounded"
          />
          <span className={cn('text-gray-700', compact ? 'text-sm' : 'text-base')}>Progress Notifications</span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={preferences.enableAnimations}
            onChange={e => onPreferencesChange({ enableAnimations: e.target.checked })}
            className="rounded"
          />
          <span className={cn('text-gray-700', compact ? 'text-sm' : 'text-base')}>Enable Animations</span>
        </label>
      </div>
    </div>

    <div>
      <h3 className={cn('mb-2 font-semibold text-gray-900', compact ? 'text-sm' : 'text-base')}>Default View</h3>
      <select
        value={preferences.defaultView}
        onChange={e => onPreferencesChange({ defaultView: e.target.value as PopupView })}
        className={cn('w-full rounded border border-gray-300 px-3 py-2', compact ? 'py-1 text-sm' : 'text-base')}>
        <option value="jobs">Active Jobs</option>
        <option value="meetings">Recent Meetings</option>
        <option value="summary">Summary</option>
        <option value="settings">Settings</option>
      </select>
    </div>

    <div>
      <h3 className={cn('mb-2 font-semibold text-gray-900', compact ? 'text-sm' : 'text-base')}>Actions</h3>
      <div className="space-y-2">
        <button
          onClick={() => onAction?.('clearCache')}
          className={cn(
            'w-full rounded bg-gray-100 px-3 py-2 text-left text-gray-700 transition-colors hover:bg-gray-200',
            compact ? 'py-1 text-sm' : 'text-base',
          )}>
          Clear Cache
        </button>

        <button
          onClick={() => onAction?.('openOptions')}
          className={cn(
            'w-full rounded bg-blue-100 px-3 py-2 text-left text-blue-700 transition-colors hover:bg-blue-200',
            compact ? 'py-1 text-sm' : 'text-base',
          )}>
          Open Full Settings
        </button>
      </div>
    </div>
  </div>
);

/**
 * Main PopupLayout component
 */
export const PopupLayout: React.FC<PopupLayoutProps> = ({
  state,
  onStateChange,
  onNavigate,
  onJobAction,
  onMeetingSelect,
  onQuickAction,
  onSettingsAction,
  onRefresh,
  className,
}) => {
  // Local navigation state
  const [navigation, setNavigation] = useState<PopupNavigation>({
    currentView: state.currentView,
    viewHistory: [state.currentView],
    canGoBack: false,
    params: {},
  });

  // Compute if we should use compact mode
  const isCompact = state.userPreferences.compactMode;

  // Navigation tabs configuration
  const navigationTabs = useMemo(() => getNavigationTabs(state), [state]);

  // Handle view navigation
  const handleNavigate = useCallback(
    (view: PopupView, params: Record<string, string> = {}) => {
      const newNavigation: PopupNavigation = {
        currentView: view,
        viewHistory: [...navigation.viewHistory, view].slice(-5), // Keep last 5 views
        canGoBack: navigation.viewHistory.length > 0,
        params,
      };

      setNavigation(newNavigation);
      onNavigate(view, params);
      onStateChange({ currentView: view });
    },
    [navigation, onNavigate, onStateChange],
  );

  // Handle back navigation
  const handleGoBack = useCallback(() => {
    if (!navigation.canGoBack || navigation.viewHistory.length <= 1) return;

    const newHistory = navigation.viewHistory.slice(0, -1);
    const previousView = newHistory[newHistory.length - 1];

    const newNavigation: PopupNavigation = {
      currentView: previousView,
      viewHistory: newHistory,
      canGoBack: newHistory.length > 1,
      params: {},
    };

    setNavigation(newNavigation);
    onNavigate(previousView);
    onStateChange({ currentView: previousView });
  }, [navigation, onNavigate, onStateChange]);

  // Handle error dismissal
  const handleErrorDismiss = useCallback(() => {
    onStateChange({ error: undefined });
  }, [onStateChange]);

  // Handle preferences change
  const handlePreferencesChange = useCallback(
    (preferences: Partial<UIPreferences>) => {
      onStateChange({
        userPreferences: { ...state.userPreferences, ...preferences },
      });
    },
    [state.userPreferences, onStateChange],
  );

  // Handle quick actions
  const handleQuickAction = useCallback(
    (actionId: string) => {
      onQuickAction?.(actionId);
    },
    [onQuickAction],
  );

  // Update local navigation when state changes
  useEffect(() => {
    if (state.currentView !== navigation.currentView) {
      setNavigation(prev => ({
        ...prev,
        currentView: state.currentView,
      }));
    }
  }, [state.currentView, navigation.currentView]);

  // Render main content based on current view
  const renderMainContent = () => {
    const contentProps = {
      compact: isCompact,
      className: 'flex-1 min-h-0 overflow-y-auto',
    };

    switch (state.currentView) {
      case 'jobs':
        return (
          <JobStatusView
            jobs={state.activeJobs}
            showCompleted={true}
            maxJobs={isCompact ? 5 : 10}
            showDetails={!isCompact}
            onJobAction={onJobAction}
            onJobClick={job => {
              onStateChange({ selectedMeeting: state.recentMeetings.find(m => m.id === job.meetingId) });
              handleNavigate('summary');
            }}
            {...contentProps}
          />
        );

      case 'meetings':
        return (
          <MeetingList
            meetings={state.recentMeetings}
            maxMeetings={isCompact ? 8 : 15}
            showSummaryPreview={!isCompact}
            onMeetingSelect={meeting => {
              onMeetingSelect?.(meeting);
              onStateChange({ selectedMeeting: meeting });
              handleNavigate('summary');
            }}
            {...contentProps}
          />
        );

      case 'summary':
        return state.selectedMeeting ? (
          <SummaryPreview
            meeting={state.selectedMeeting}
            showFullSummary={!isCompact}
            showActionItems={true}
            onActionItemClick={_item => {
              // Handle action item click
            }}
            onExportRequest={_format => {
              // Handle export request
            }}
            {...contentProps}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-center">
            <div className="text-gray-500">
              <p className={isCompact ? 'text-sm' : 'text-base'}>
                No meeting selected. Please select a meeting from the meetings tab.
              </p>
              <button
                onClick={() => handleNavigate('meetings')}
                className="mt-2 text-blue-600 underline hover:text-blue-800">
                Go to Meetings
              </button>
            </div>
          </div>
        );

      case 'settings':
        return (
          <SettingsView
            preferences={state.userPreferences}
            onPreferencesChange={handlePreferencesChange}
            onAction={onSettingsAction}
            compact={isCompact}
          />
        );

      default:
        return (
          <div className="flex h-full items-center justify-center p-8 text-center">
            <div className="text-gray-500">
              <p className={isCompact ? 'text-sm' : 'text-base'}>View not found: {state.currentView}</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div
      className={cn(
        'flex h-[600px] w-[400px] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white',
        isCompact && 'h-[500px]',
        className,
      )}>
      {/* Header with Navigation */}
      <PopupHeader
        currentView={state.currentView}
        tabs={navigationTabs}
        connectionStatus={state.connectionStatus}
        onNavigate={handleNavigate}
        onRefresh={onRefresh}
        compact={isCompact}
      />

      {/* Error Display */}
      {state.error && (
        <ErrorDisplay error={state.error} onDismiss={handleErrorDismiss} onRetry={onRefresh} compact={isCompact} />
      )}

      {/* Loading State */}
      {state.isLoading && (
        <div className="flex items-center justify-center border-b border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <span className={cn('text-blue-700', isCompact ? 'text-sm' : 'text-base')}>Loading...</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex min-h-0 flex-1 flex-col">{renderMainContent()}</div>

      {/* Quick Actions */}
      {state.userPreferences.quickActions.length > 0 && (
        <QuickActions actions={state.userPreferences.quickActions} onAction={handleQuickAction} compact={isCompact} />
      )}

      {/* Footer */}
      <div
        className={cn(
          'flex items-center justify-between border-t border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500',
          isCompact && 'px-2 py-1',
        )}>
        <div className="flex items-center gap-2">
          {navigation.canGoBack && (
            <button onClick={handleGoBack} className="text-blue-600 hover:text-blue-800" title="Go back">
              ← Back
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span>Last update: {state.lastUpdate.toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
};

/**
 * Compact popup layout for smaller screens
 */
export const CompactPopupLayout: React.FC<PopupLayoutProps> = props => {
  const compactState = {
    ...props.state,
    userPreferences: {
      ...props.state.userPreferences,
      compactMode: true,
    },
  };

  return <PopupLayout {...props} state={compactState} />;
};

/**
 * Full popup layout with all features enabled
 */
export const FullPopupLayout: React.FC<PopupLayoutProps> = props => {
  const fullState = {
    ...props.state,
    userPreferences: {
      ...props.state.userPreferences,
      compactMode: false,
      showProgressNotifications: true,
      enableAnimations: true,
    },
  };

  return <PopupLayout {...props} state={fullState} />;
};
