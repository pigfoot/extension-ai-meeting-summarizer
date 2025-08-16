/**
 * Meeting List Component
 *
 * Displays a chronological list of recent meetings with titles, dates, and transcription status.
 * Provides quick access to meeting summaries and transcription results in the popup interface.
 */

import { cn } from '@extension/ui';
import type { MeetingRecord, MeetingStatus, MeetingSource } from '@extension/shared';
import type React from 'react';

/**
 * Meeting list component props
 */
interface MeetingListProps {
  /** List of meetings to display */
  meetings: MeetingRecord[];
  /** Maximum number of meetings to show */
  maxMeetings?: number;
  /** Whether to show meeting descriptions */
  showDescriptions?: boolean;
  /** Whether to show participant count */
  showParticipantCount?: boolean;
  /** Whether to show action item count */
  showActionItems?: boolean;
  /** Meeting click handler */
  onMeetingClick?: (meeting: MeetingRecord) => void;
  /** Transcription action handler */
  onTranscriptionClick?: (meeting: MeetingRecord) => void;
  /** Summary action handler */
  onSummaryClick?: (meeting: MeetingRecord) => void;
  /** Custom class name */
  className?: string;
  /** Whether component is in compact mode */
  compact?: boolean;
  /** Loading state */
  isLoading?: boolean;
  /** Error state */
  error?: string;
}

/**
 * Individual meeting item component props
 */
interface MeetingItemProps {
  /** Meeting record */
  meeting: MeetingRecord;
  /** Whether to show description */
  showDescription?: boolean;
  /** Whether to show participant count */
  showParticipantCount?: boolean;
  /** Whether to show action items */
  showActionItems?: boolean;
  /** Click handlers */
  onMeetingClick?: (meeting: MeetingRecord) => void;
  onTranscriptionClick?: (meeting: MeetingRecord) => void;
  onSummaryClick?: (meeting: MeetingRecord) => void;
  /** Whether component is in compact mode */
  compact?: boolean;
}

/**
 * Meeting status badge component
 */
const MeetingStatusBadge: React.FC<{
  status: MeetingStatus;
  hasTranscription?: boolean;
  hasSummary?: boolean;
  compact?: boolean;
}> = ({ status, hasTranscription, hasSummary, compact = false }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'scheduled':
        return {
          color: 'bg-blue-100 text-blue-800 border-blue-200',
          text: 'Scheduled',
          icon: '📅',
        };
      case 'in-progress':
        return {
          color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          text: 'In Progress',
          icon: '🔴',
        };
      case 'completed':
        return {
          color: 'bg-green-100 text-green-800 border-green-200',
          text: 'Completed',
          icon: '✅',
        };
      case 'processing':
        return {
          color: 'bg-purple-100 text-purple-800 border-purple-200',
          text: 'Processing',
          icon: '⚙️',
        };
      case 'cancelled':
        return {
          color: 'bg-gray-100 text-gray-600 border-gray-200',
          text: 'Cancelled',
          icon: '🚫',
        };
      default:
        return {
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          text: 'Unknown',
          icon: '❓',
        };
    }
  };

  const config = getStatusConfig();
  const badgeSize = compact ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm';

  return (
    <div className="flex items-center gap-1">
      <span className={cn('inline-flex items-center gap-1 rounded-full border font-medium', config.color, badgeSize)}>
        {!compact && <span>{config.icon}</span>}
        <span>{config.text}</span>
      </span>

      {/* Transcription/Summary indicators */}
      {(hasTranscription || hasSummary) && (
        <div className="flex items-center gap-0.5">
          {hasTranscription && (
            <span
              className={cn(
                'inline-flex items-center justify-center rounded-full bg-blue-100 text-blue-600',
                compact ? 'h-4 w-4 text-xs' : 'h-5 w-5 text-sm',
              )}
              title="Has transcription">
              📝
            </span>
          )}
          {hasSummary && (
            <span
              className={cn(
                'inline-flex items-center justify-center rounded-full bg-green-100 text-green-600',
                compact ? 'h-4 w-4 text-xs' : 'h-5 w-5 text-sm',
              )}
              title="Has summary">
              📄
            </span>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Meeting source indicator component
 */
const MeetingSourceIndicator: React.FC<{
  source: MeetingSource;
  compact?: boolean;
}> = ({ source, compact = false }) => {
  const getSourceConfig = () => {
    switch (source) {
      case 'sharepoint':
        return { icon: '📂', text: 'SharePoint', color: 'text-blue-600' };
      case 'teams':
        return { icon: '👥', text: 'Teams', color: 'text-purple-600' };
      case 'zoom':
        return { icon: '🎥', text: 'Zoom', color: 'text-blue-500' };
      case 'other':
        return { icon: '🌐', text: 'Other', color: 'text-gray-600' };
      default:
        return { icon: '❓', text: 'Unknown', color: 'text-gray-600' };
    }
  };

  const config = getSourceConfig();

  if (compact) {
    return (
      <span className={cn('text-sm', config.color)} title={config.text}>
        {config.icon}
      </span>
    );
  }

  return (
    <span className={cn('inline-flex items-center gap-1 text-sm', config.color)}>
      <span>{config.icon}</span>
      <span>{config.text}</span>
    </span>
  );
};

/**
 * Meeting duration display component
 */
const MeetingDuration: React.FC<{
  startTime: string;
  endTime?: string;
  duration?: number;
  compact?: boolean;
}> = ({ startTime, endTime, duration, compact = false }) => {
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isYesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toDateString() === date.toDateString();

    if (isToday) {
      return `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (isYesterday) {
      return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const calculatedDuration =
    duration || (endTime ? Math.floor((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000) : null);

  const textSize = compact ? 'text-xs' : 'text-sm';

  return (
    <div className={cn('text-gray-600', textSize)}>
      <div className="flex items-center gap-1">
        <span>🕐</span>
        <span>{formatDate(startTime)}</span>
      </div>
      {calculatedDuration && (
        <div className="flex items-center gap-1">
          <span>⏱️</span>
          <span>{formatDuration(calculatedDuration)}</span>
        </div>
      )}
    </div>
  );
};

/**
 * Meeting action buttons component
 */
const MeetingActions: React.FC<{
  meeting: MeetingRecord;
  onTranscriptionClick?: (meeting: MeetingRecord) => void;
  onSummaryClick?: (meeting: MeetingRecord) => void;
  compact?: boolean;
}> = ({ meeting, onTranscriptionClick, onSummaryClick, compact = false }) => {
  const buttonSize = compact ? 'p-1 text-xs' : 'px-2 py-1 text-sm';

  const hasTranscription = !!meeting.transcription;
  const hasSummary = !!meeting.summary;

  if (!hasTranscription && !hasSummary) {
    return null;
  }

  return (
    <div className="flex items-center gap-1">
      {hasTranscription && onTranscriptionClick && (
        <button
          onClick={e => {
            e.stopPropagation();
            onTranscriptionClick(meeting);
          }}
          className={cn(
            'rounded border border-blue-300 bg-blue-50 text-blue-700 transition-colors hover:bg-blue-100',
            buttonSize,
          )}
          title="View transcription">
          {compact ? '📝' : '📝 Transcript'}
        </button>
      )}
      {hasSummary && onSummaryClick && (
        <button
          onClick={e => {
            e.stopPropagation();
            onSummaryClick(meeting);
          }}
          className={cn(
            'rounded border border-green-300 bg-green-50 text-green-700 transition-colors hover:bg-green-100',
            buttonSize,
          )}
          title="View summary">
          {compact ? '📄' : '📄 Summary'}
        </button>
      )}
    </div>
  );
};

/**
 * Individual meeting item component
 */
const MeetingItem: React.FC<MeetingItemProps> = ({
  meeting,
  showDescription = false,
  showParticipantCount = true,
  showActionItems = true,
  onMeetingClick,
  onTranscriptionClick,
  onSummaryClick,
  compact = false,
}) => {
  const handleClick = () => {
    onMeetingClick?.(meeting);
  };

  const itemPadding = compact ? 'p-2' : 'p-3';
  const titleSize = compact ? 'text-sm' : 'text-base';

  const actionItemCount = meeting.actionItems?.length || 0;
  const participantCount = meeting.participants?.length || 0;

  return (
    <div
      className={cn(
        'cursor-pointer rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md',
        itemPadding,
      )}
      onClick={handleClick}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      role="button"
      tabIndex={0}>
      {/* Header: Title, Status, Source */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className={cn('truncate font-medium text-gray-900', titleSize)}>{meeting.title}</h3>
          {showDescription && meeting.description && !compact && (
            <p className="mt-1 line-clamp-2 text-sm text-gray-600">{meeting.description}</p>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <MeetingSourceIndicator source={meeting.source} compact={compact} />
        </div>
      </div>

      {/* Status and Indicators */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <MeetingStatusBadge
          status={meeting.status}
          hasTranscription={!!meeting.transcription}
          hasSummary={!!meeting.summary}
          compact={compact}
        />
        <MeetingDuration
          startTime={meeting.startTime}
          endTime={meeting.endTime}
          duration={meeting.metadata?.duration}
          compact={compact}
        />
      </div>

      {/* Metadata and Actions */}
      <div className="flex items-center justify-between gap-2">
        <div className={cn('flex items-center gap-3 text-gray-500', compact ? 'text-xs' : 'text-sm')}>
          {showParticipantCount && participantCount > 0 && (
            <span className="flex items-center gap-1">
              <span>👤</span>
              <span>{participantCount}</span>
            </span>
          )}
          {showActionItems && actionItemCount > 0 && (
            <span className="flex items-center gap-1">
              <span>✓</span>
              <span>{actionItemCount} tasks</span>
            </span>
          )}
          {meeting.organizer && <span className="truncate">by {meeting.organizer.name}</span>}
        </div>
        <MeetingActions
          meeting={meeting}
          onTranscriptionClick={onTranscriptionClick}
          onSummaryClick={onSummaryClick}
          compact={compact}
        />
      </div>
    </div>
  );
};

/**
 * Loading skeleton component
 */
const MeetingListSkeleton: React.FC<{ count?: number; compact?: boolean }> = ({ count = 3, compact = false }) => {
  const itemHeight = compact ? 'h-16' : 'h-20';
  const itemPadding = compact ? 'p-2' : 'p-3';

  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={cn('animate-pulse rounded-lg border border-gray-200 bg-white', itemHeight, itemPadding)}>
          <div className="mb-2 flex items-center justify-between">
            <div className={cn('rounded bg-gray-200', compact ? 'h-3 w-32' : 'h-4 w-40')} />
            <div className={cn('rounded bg-gray-200', compact ? 'h-3 w-16' : 'h-4 w-20')} />
          </div>
          <div className="flex items-center justify-between">
            <div className={cn('rounded bg-gray-200', compact ? 'h-2 w-24' : 'h-3 w-32')} />
            <div className={cn('rounded bg-gray-200', compact ? 'h-2 w-20' : 'h-3 w-24')} />
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Main MeetingList component
 */
export const MeetingList: React.FC<MeetingListProps> = ({
  meetings,
  maxMeetings = 10,
  showDescriptions = false,
  showParticipantCount = true,
  showActionItems = true,
  onMeetingClick,
  onTranscriptionClick,
  onSummaryClick,
  className,
  compact = false,
  isLoading = false,
  error,
}) => {
  // Sort meetings by start time (most recent first)
  const sortedMeetings = [...meetings].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
  );

  // Limit number of meetings displayed
  const displayedMeetings = sortedMeetings.slice(0, maxMeetings);

  const containerPadding = compact ? 'p-2' : 'p-4';
  const headerSize = compact ? 'text-base' : 'text-lg';
  const sectionGap = compact ? 'space-y-2' : 'space-y-3';

  // Loading state
  if (isLoading) {
    return (
      <div className={cn(containerPadding, className)}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className={cn('font-semibold text-gray-900', headerSize)}>Recent Meetings</h2>
        </div>
        <MeetingListSkeleton count={3} compact={compact} />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn('text-center', containerPadding, className)}>
        <div className="text-red-500">
          <div className="mb-2 text-4xl">⚠️</div>
          <p className={compact ? 'text-sm' : 'text-base'}>{error}</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (displayedMeetings.length === 0) {
    return (
      <div className={cn('text-center', containerPadding, className)}>
        <div className="text-gray-500">
          <div className="mb-2 text-4xl">📅</div>
          <p className={compact ? 'text-sm' : 'text-base'}>No recent meetings</p>
          <p className={cn('mt-1', compact ? 'text-xs' : 'text-sm')}>
            Meetings will appear here once you start transcribing
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(containerPadding, className)}>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className={cn('font-semibold text-gray-900', headerSize)}>Recent Meetings</h2>
        <span className={cn('text-gray-600', compact ? 'text-xs' : 'text-sm')}>
          {displayedMeetings.length} of {meetings.length}
        </span>
      </div>

      {/* Meeting List */}
      <div className={cn(sectionGap)}>
        {displayedMeetings.map(meeting => (
          <MeetingItem
            key={meeting.id}
            meeting={meeting}
            showDescription={showDescriptions}
            showParticipantCount={showParticipantCount}
            showActionItems={showActionItems}
            onMeetingClick={onMeetingClick}
            onTranscriptionClick={onTranscriptionClick}
            onSummaryClick={onSummaryClick}
            compact={compact}
          />
        ))}
      </div>

      {/* Footer */}
      {!compact && meetings.length > maxMeetings && (
        <div className="mt-4 border-t border-gray-200 pt-4">
          <div className="text-center">
            <span className="text-sm text-gray-600">+{meetings.length - maxMeetings} more meetings</span>
          </div>
        </div>
      )}
    </div>
  );
};
