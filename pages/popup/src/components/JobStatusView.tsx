/**
 * Job Status View Component
 *
 * Displays current transcription jobs with progress indicators and estimated completion times.
 * Provides a comprehensive view of active, queued, and recently completed jobs in the popup interface.
 */

import { cn } from '@extension/ui';
import type { JobDisplayInfo } from '../types/popup-state';
import type React from 'react';

/**
 * Job status view component props
 */
interface JobStatusViewProps {
  /** List of jobs to display */
  jobs: JobDisplayInfo[];
  /** Whether to show completed jobs */
  showCompleted?: boolean;
  /** Maximum number of jobs to display */
  maxJobs?: number;
  /** Whether to show detailed information */
  showDetails?: boolean;
  /** Job action handlers */
  onJobAction?: (action: 'pause' | 'resume' | 'cancel', jobId: string) => void;
  /** Job click handler for details */
  onJobClick?: (job: JobDisplayInfo) => void;
  /** Custom class name */
  className?: string;
  /** Whether component is in compact mode */
  compact?: boolean;
}

/**
 * Individual job item component
 */
interface JobItemProps {
  /** Job information */
  job: JobDisplayInfo;
  /** Whether to show detailed information */
  showDetails?: boolean;
  /** Job action handler */
  onAction?: (action: 'pause' | 'resume' | 'cancel', jobId: string) => void;
  /** Job click handler */
  onClick?: (job: JobDisplayInfo) => void;
  /** Whether component is in compact mode */
  compact?: boolean;
}

/**
 * Progress bar component for job progress
 */
const JobProgressBar: React.FC<{
  progress: number;
  status: JobDisplayInfo['status'];
  compact?: boolean;
}> = ({ progress, status, compact = false }) => {
  const getProgressColor = () => {
    switch (status) {
      case 'processing':
        return 'bg-blue-500';
      case 'paused':
        return 'bg-yellow-500';
      case 'completed':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'cancelled':
        return 'bg-gray-500';
      default:
        return 'bg-gray-300';
    }
  };

  const progressBarHeight = compact ? 'h-1' : 'h-2';

  return (
    <div className={cn('w-full overflow-hidden rounded-full bg-gray-200', progressBarHeight)}>
      <div
        className={cn('rounded-full transition-all duration-300 ease-in-out', getProgressColor(), progressBarHeight)}
        style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
      />
    </div>
  );
};

/**
 * Status badge component
 */
const StatusBadge: React.FC<{
  status: JobDisplayInfo['status'];
  compact?: boolean;
}> = ({ status, compact = false }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'idle':
        return { color: 'bg-gray-100 text-gray-800', text: 'Idle', icon: '⏸️' };
      case 'processing':
        return { color: 'bg-blue-100 text-blue-800', text: 'Processing', icon: '⚙️' };
      case 'paused':
        return { color: 'bg-yellow-100 text-yellow-800', text: 'Paused', icon: '⏸️' };
      case 'completed':
        return { color: 'bg-green-100 text-green-800', text: 'Completed', icon: '✅' };
      case 'failed':
        return { color: 'bg-red-100 text-red-800', text: 'Failed', icon: '❌' };
      case 'cancelled':
        return { color: 'bg-gray-100 text-gray-600', text: 'Cancelled', icon: '🚫' };
      default:
        return { color: 'bg-gray-100 text-gray-800', text: 'Unknown', icon: '❓' };
    }
  };

  const config = getStatusConfig();
  const badgeSize = compact ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm';

  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full font-medium', config.color, badgeSize)}>
      {!compact && <span>{config.icon}</span>}
      <span>{config.text}</span>
    </span>
  );
};

/**
 * Priority indicator component
 */
const PriorityIndicator: React.FC<{
  priority: JobDisplayInfo['priority'];
  compact?: boolean;
}> = ({ priority, compact = false }) => {
  const getPriorityConfig = () => {
    switch (priority) {
      case 'high':
        return { color: 'text-red-600', text: 'High', icon: '🔴' };
      case 'normal':
        return { color: 'text-blue-600', text: 'Normal', icon: '🔵' };
      case 'low':
        return { color: 'text-green-600', text: 'Low', icon: '🟢' };
      default:
        return { color: 'text-gray-600', text: 'Normal', icon: '⚪' };
    }
  };

  const config = getPriorityConfig();

  if (compact) {
    return <span className={cn('text-xs', config.color)}>{config.icon}</span>;
  }

  return (
    <span className={cn('inline-flex items-center gap-1 text-sm font-medium', config.color)}>
      <span>{config.icon}</span>
      <span>{config.text}</span>
    </span>
  );
};

/**
 * Time remaining display component
 */
const TimeRemaining: React.FC<{
  timeRemaining?: number;
  estimatedCompletion?: Date;
  compact?: boolean;
}> = ({ timeRemaining, estimatedCompletion, compact = false }) => {
  const formatTimeRemaining = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const formatEstimatedCompletion = (date: Date): string => {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 60) {
      return `${diffMins} min`;
    } else {
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return `${hours}h ${mins}m`;
    }
  };

  if (!timeRemaining && !estimatedCompletion) {
    return null;
  }

  const textSize = compact ? 'text-xs' : 'text-sm';

  return (
    <div className={cn('text-gray-600', textSize)}>
      {timeRemaining && (
        <div className="flex items-center gap-1">
          <span>⏱️</span>
          <span>{formatTimeRemaining(timeRemaining)}</span>
        </div>
      )}
      {estimatedCompletion && (
        <div className="flex items-center gap-1">
          <span>🕐</span>
          <span>ETA: {formatEstimatedCompletion(estimatedCompletion)}</span>
        </div>
      )}
    </div>
  );
};

/**
 * Job action buttons component
 */
const JobActions: React.FC<{
  job: JobDisplayInfo;
  onAction?: (action: 'pause' | 'resume' | 'cancel', jobId: string) => void;
  compact?: boolean;
}> = ({ job, onAction, compact = false }) => {
  const handleAction = (action: 'pause' | 'resume' | 'cancel') => {
    onAction?.(action, job.jobId);
  };

  const buttonSize = compact ? 'p-1 text-xs' : 'px-2 py-1 text-sm';

  const canShowActions = job.status === 'processing' || job.status === 'paused';

  if (!canShowActions || !onAction) {
    return null;
  }

  return (
    <div className="flex items-center gap-1">
      {job.canPause && job.status === 'processing' && (
        <button
          onClick={() => handleAction('pause')}
          className={cn(
            'rounded border border-yellow-300 bg-yellow-50 text-yellow-700 transition-colors hover:bg-yellow-100',
            buttonSize,
          )}
          title="Pause job">
          {compact ? '⏸️' : '⏸️ Pause'}
        </button>
      )}
      {job.status === 'paused' && (
        <button
          onClick={() => handleAction('resume')}
          className={cn(
            'rounded border border-blue-300 bg-blue-50 text-blue-700 transition-colors hover:bg-blue-100',
            buttonSize,
          )}
          title="Resume job">
          {compact ? '▶️' : '▶️ Resume'}
        </button>
      )}
      {job.canCancel && (
        <button
          onClick={() => handleAction('cancel')}
          className={cn(
            'rounded border border-red-300 bg-red-50 text-red-700 transition-colors hover:bg-red-100',
            buttonSize,
          )}
          title="Cancel job">
          {compact ? '🗙' : '🗙 Cancel'}
        </button>
      )}
    </div>
  );
};

/**
 * Individual job item component
 */
const JobItem: React.FC<JobItemProps> = ({ job, showDetails = true, onAction, onClick, compact = false }) => {
  const handleClick = () => {
    onClick?.(job);
  };

  const itemPadding = compact ? 'p-2' : 'p-3';
  const titleSize = compact ? 'text-sm' : 'text-base';

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
      {/* Header: Title, Status, Priority */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className={cn('truncate font-medium text-gray-900', titleSize)}>{job.meetingTitle}</h3>
          {showDetails && !compact && (
            <p className="truncate text-sm text-gray-500">Job ID: {job.jobId.slice(0, 8)}...</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <PriorityIndicator priority={job.priority} compact={compact} />
          <StatusBadge status={job.status} compact={compact} />
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-2">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className={cn('text-gray-600', compact ? 'text-xs' : 'text-sm')}>Progress: {job.progress}%</span>
          {showDetails && (
            <TimeRemaining
              timeRemaining={job.timeRemaining}
              estimatedCompletion={job.estimatedCompletion}
              compact={compact}
            />
          )}
        </div>
        <JobProgressBar progress={job.progress} status={job.status} compact={compact} />
      </div>

      {/* Details and Actions */}
      {showDetails && (
        <div className="flex items-center justify-between gap-2">
          <div className={cn('text-gray-500', compact ? 'text-xs' : 'text-sm')}>
            {job.fileSize && <span>Size: {(job.fileSize / (1024 * 1024)).toFixed(1)} MB</span>}
            {job.processingSpeed && <span className="ml-2">Speed: {(job.processingSpeed / 1024).toFixed(1)} KB/s</span>}
          </div>
          <JobActions job={job} onAction={onAction} compact={compact} />
        </div>
      )}

      {/* Error Message */}
      {job.errorMessage && job.status === 'failed' && (
        <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          <span className="font-medium">Error:</span> {job.errorMessage}
        </div>
      )}
    </div>
  );
};

/**
 * Main JobStatusView component
 */
export const JobStatusView: React.FC<JobStatusViewProps> = ({
  jobs,
  showCompleted = false,
  maxJobs = 10,
  showDetails = true,
  onJobAction,
  onJobClick,
  className,
  compact = false,
}) => {
  // Filter jobs based on showCompleted preference
  const filteredJobs = jobs.filter(job => {
    if (showCompleted) return true;
    return job.status !== 'completed' && job.status !== 'cancelled';
  });

  // Limit number of jobs displayed
  const displayedJobs = filteredJobs.slice(0, maxJobs);

  // Group jobs by status for better organization
  const activeJobs = displayedJobs.filter(job => job.status === 'processing' || job.status === 'paused');
  const queuedJobs = displayedJobs.filter(job => job.status === 'idle');
  const completedJobs = displayedJobs.filter(
    job => job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled',
  );

  const containerPadding = compact ? 'p-2' : 'p-4';
  const headerSize = compact ? 'text-base' : 'text-lg';
  const sectionGap = compact ? 'space-y-2' : 'space-y-3';

  if (displayedJobs.length === 0) {
    return (
      <div className={cn('text-center', containerPadding, className)}>
        <div className="text-gray-500">
          <div className="mb-2 text-4xl">📭</div>
          <p className={compact ? 'text-sm' : 'text-base'}>No active transcription jobs</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(containerPadding, className)}>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className={cn('font-semibold text-gray-900', headerSize)}>Job Status</h2>
        <span className={cn('text-gray-600', compact ? 'text-xs' : 'text-sm')}>
          {activeJobs.length} active, {queuedJobs.length} queued
        </span>
      </div>

      {/* Active Jobs */}
      {activeJobs.length > 0 && (
        <div className="mb-4">
          {!compact && <h3 className="mb-2 text-sm font-medium text-gray-700">Active Jobs ({activeJobs.length})</h3>}
          <div className={cn(sectionGap)}>
            {activeJobs.map(job => (
              <JobItem
                key={job.jobId}
                job={job}
                showDetails={showDetails}
                onAction={onJobAction}
                onClick={onJobClick}
                compact={compact}
              />
            ))}
          </div>
        </div>
      )}

      {/* Queued Jobs */}
      {queuedJobs.length > 0 && (
        <div className="mb-4">
          {!compact && <h3 className="mb-2 text-sm font-medium text-gray-700">Queued Jobs ({queuedJobs.length})</h3>}
          <div className={cn(sectionGap)}>
            {queuedJobs.map(job => (
              <JobItem
                key={job.jobId}
                job={job}
                showDetails={showDetails}
                onAction={onJobAction}
                onClick={onJobClick}
                compact={compact}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completed Jobs */}
      {showCompleted && completedJobs.length > 0 && (
        <div>
          {!compact && <h3 className="mb-2 text-sm font-medium text-gray-700">Recent Jobs ({completedJobs.length})</h3>}
          <div className={cn(sectionGap)}>
            {completedJobs.map(job => (
              <JobItem
                key={job.jobId}
                job={job}
                showDetails={showDetails}
                onAction={onJobAction}
                onClick={onJobClick}
                compact={compact}
              />
            ))}
          </div>
        </div>
      )}

      {/* Summary Footer */}
      {!compact && displayedJobs.length > 0 && (
        <div className="mt-4 border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              Showing {displayedJobs.length} of {filteredJobs.length} jobs
            </span>
            {filteredJobs.length > maxJobs && <span>+{filteredJobs.length - maxJobs} more</span>}
          </div>
        </div>
      )}
    </div>
  );
};
