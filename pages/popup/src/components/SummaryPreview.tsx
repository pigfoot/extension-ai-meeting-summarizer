/**
 * Summary Preview Component
 *
 * Provides quick summary preview with expand options, highlighting action items and key points.
 * Enables quick access to meeting summaries in the popup interface.
 */

import { cn } from '@extension/ui';
import { useState } from 'react';
import type {
  MeetingSummary,
  ActionItem,
  MeetingRecord,
  ActionItemPriority,
  ActionItemStatus,
} from '@extension/shared';
import type React from 'react';

/**
 * Summary preview component props
 */
interface SummaryPreviewProps {
  /** Meeting record with summary */
  meeting: MeetingRecord;
  /** Summary to preview */
  summary: MeetingSummary;
  /** Associated action items */
  actionItems?: ActionItem[];
  /** Whether to show in expanded mode by default */
  defaultExpanded?: boolean;
  /** Maximum number of items to show in preview */
  maxPreviewItems?: number;
  /** Whether to show quality score */
  showQualityScore?: boolean;
  /** Whether to show metadata */
  showMetadata?: boolean;
  /** Click handlers */
  onFullSummaryClick?: (meeting: MeetingRecord) => void;
  onActionItemClick?: (actionItem: ActionItem) => void;
  onExpandToggle?: (expanded: boolean) => void;
  /** Custom class name */
  className?: string;
  /** Whether component is in compact mode */
  compact?: boolean;
}

/**
 * Action item priority indicator
 */
const ActionItemPriorityBadge: React.FC<{
  priority: ActionItemPriority;
  compact?: boolean;
}> = ({ priority, compact = false }) => {
  const getPriorityConfig = () => {
    switch (priority) {
      case 'critical':
        return { color: 'bg-red-100 text-red-800 border-red-200', text: 'Critical', icon: '🔴' };
      case 'high':
        return { color: 'bg-orange-100 text-orange-800 border-orange-200', text: 'High', icon: '🟠' };
      case 'medium':
        return { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', text: 'Medium', icon: '🟡' };
      case 'low':
        return { color: 'bg-green-100 text-green-800 border-green-200', text: 'Low', icon: '🟢' };
      default:
        return { color: 'bg-gray-100 text-gray-800 border-gray-200', text: 'Normal', icon: '⚪' };
    }
  };

  const config = getPriorityConfig();
  const badgeSize = compact ? 'px-1 py-0.5 text-xs' : 'px-1.5 py-0.5 text-xs';

  return (
    <span className={cn('inline-flex items-center gap-1 rounded border font-medium', config.color, badgeSize)}>
      <span>{config.icon}</span>
      {!compact && <span>{config.text}</span>}
    </span>
  );
};

/**
 * Action item status badge
 */
const ActionItemStatusBadge: React.FC<{
  status: ActionItemStatus;
  compact?: boolean;
}> = ({ status, compact = false }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'pending':
        return { color: 'bg-blue-100 text-blue-800', text: 'Pending', icon: '⏳' };
      case 'in-progress':
        return { color: 'bg-purple-100 text-purple-800', text: 'In Progress', icon: '🔄' };
      case 'completed':
        return { color: 'bg-green-100 text-green-800', text: 'Completed', icon: '✅' };
      case 'cancelled':
        return { color: 'bg-gray-100 text-gray-600', text: 'Cancelled', icon: '❌' };
      default:
        return { color: 'bg-gray-100 text-gray-800', text: 'Unknown', icon: '❓' };
    }
  };

  const config = getStatusConfig();
  const badgeSize = compact ? 'px-1 py-0.5 text-xs' : 'px-1.5 py-0.5 text-xs';

  return (
    <span className={cn('inline-flex items-center gap-1 rounded font-medium', config.color, badgeSize)}>
      <span>{config.icon}</span>
      {!compact && <span>{config.text}</span>}
    </span>
  );
};

/**
 * Action item preview component
 */
const ActionItemPreview: React.FC<{
  actionItem: ActionItem;
  onClick?: (actionItem: ActionItem) => void;
  compact?: boolean;
}> = ({ actionItem, onClick, compact = false }) => {
  const handleClick = () => {
    onClick?.(actionItem);
  };

  const formatDueDate = (dueDateString: string): string => {
    const dueDate = new Date(dueDateString);
    const now = new Date();
    const diffTime = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return `Overdue by ${Math.abs(diffDays)} days`;
    } else if (diffDays === 0) {
      return 'Due today';
    } else if (diffDays === 1) {
      return 'Due tomorrow';
    } else if (diffDays <= 7) {
      return `Due in ${diffDays} days`;
    } else {
      return dueDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const itemPadding = compact ? 'p-2' : 'p-2.5';
  const titleSize = compact ? 'text-xs' : 'text-sm';

  return (
    <div
      className={cn(
        'cursor-pointer rounded border border-gray-200 bg-gray-50 transition-colors hover:bg-gray-100',
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
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={cn('truncate font-medium text-gray-900', titleSize)}>{actionItem.title}</p>
          {actionItem.assignee && (
            <p className={cn('truncate text-gray-600', compact ? 'text-xs' : 'text-xs')}>
              Assigned to {actionItem.assignee.name}
            </p>
          )}
          {actionItem.dueDate && (
            <p className={cn('text-gray-500', compact ? 'text-xs' : 'text-xs')}>{formatDueDate(actionItem.dueDate)}</p>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <ActionItemPriorityBadge priority={actionItem.priority} compact={compact} />
          <ActionItemStatusBadge status={actionItem.status} compact={compact} />
        </div>
      </div>
    </div>
  );
};

/**
 * Key points list component
 */
const KeyPointsList: React.FC<{
  keyPoints: string[];
  maxItems?: number;
  compact?: boolean;
}> = ({ keyPoints, maxItems = 3, compact = false }) => {
  const displayedPoints = keyPoints.slice(0, maxItems);
  const hasMore = keyPoints.length > maxItems;

  const listItemSize = compact ? 'text-xs' : 'text-sm';

  return (
    <div className="space-y-1">
      {displayedPoints.map((point, index) => (
        <div key={index} className="flex items-start gap-2">
          <span className="mt-0.5 flex-shrink-0 text-blue-500">•</span>
          <span className={cn('text-gray-700', listItemSize)}>{point}</span>
        </div>
      ))}
      {hasMore && (
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex-shrink-0 text-gray-400">•</span>
          <span className={cn('italic text-gray-500', listItemSize)}>
            +{keyPoints.length - maxItems} more points...
          </span>
        </div>
      )}
    </div>
  );
};

/**
 * Decisions list component
 */
const DecisionsList: React.FC<{
  decisions: string[];
  maxItems?: number;
  compact?: boolean;
}> = ({ decisions, maxItems = 2, compact = false }) => {
  const displayedDecisions = decisions.slice(0, maxItems);
  const hasMore = decisions.length > maxItems;

  const listItemSize = compact ? 'text-xs' : 'text-sm';

  return (
    <div className="space-y-1">
      {displayedDecisions.map((decision, index) => (
        <div key={index} className="flex items-start gap-2">
          <span className="mt-0.5 flex-shrink-0 text-green-500">✓</span>
          <span className={cn('text-gray-700', listItemSize)}>{decision}</span>
        </div>
      ))}
      {hasMore && (
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex-shrink-0 text-gray-400">✓</span>
          <span className={cn('italic text-gray-500', listItemSize)}>
            +{decisions.length - maxItems} more decisions...
          </span>
        </div>
      )}
    </div>
  );
};

/**
 * Quality score indicator
 */
const QualityScoreIndicator: React.FC<{
  score: number;
  compact?: boolean;
}> = ({ score, compact = false }) => {
  const getScoreColor = () => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreLabel = () => {
    if (score >= 0.8) return 'High';
    if (score >= 0.6) return 'Medium';
    return 'Low';
  };

  const textSize = compact ? 'text-xs' : 'text-sm';

  return (
    <div className={cn('flex items-center gap-1', getScoreColor(), textSize)}>
      <span>⭐</span>
      <span>
        Quality: {getScoreLabel()} ({Math.round(score * 100)}%)
      </span>
    </div>
  );
};

/**
 * Summary metadata component
 */
const SummaryMetadata: React.FC<{
  summary: MeetingSummary;
  compact?: boolean;
}> = ({ summary, compact = false }) => {
  const formatGeneratedAt = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffTime / (1000 * 60));

    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffMinutes < 1440) {
      const hours = Math.floor(diffMinutes / 60);
      return `${hours}h ago`;
    } else {
      const days = Math.floor(diffMinutes / 1440);
      return `${days}d ago`;
    }
  };

  const textSize = compact ? 'text-xs' : 'text-sm';

  return (
    <div className={cn('flex items-center gap-3 text-gray-500', textSize)}>
      <span>Generated {formatGeneratedAt(summary.generatedAt)}</span>
      {summary.aiModel && <span>via {summary.aiModel}</span>}
      {summary.qualityScore && <QualityScoreIndicator score={summary.qualityScore} compact={compact} />}
    </div>
  );
};

/**
 * Main SummaryPreview component
 */
export const SummaryPreview: React.FC<SummaryPreviewProps> = ({
  meeting,
  summary,
  actionItems = [],
  defaultExpanded = false,
  maxPreviewItems = 3,
  _showQualityScore = true,
  showMetadata = true,
  onFullSummaryClick,
  onActionItemClick,
  onExpandToggle,
  className,
  compact = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const handleExpandToggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    onExpandToggle?.(newExpanded);
  };

  const handleFullSummaryClick = () => {
    onFullSummaryClick?.(meeting);
  };

  const containerPadding = compact ? 'p-3' : 'p-4';
  const headerSize = compact ? 'text-sm' : 'text-base';
  const sectionGap = compact ? 'space-y-2' : 'space-y-3';

  // Filter high priority action items for preview
  const priorityActionItems = actionItems
    .filter(item => item.priority === 'critical' || item.priority === 'high')
    .slice(0, maxPreviewItems);

  const hasContent = summary.keyPoints.length > 0 || summary.decisions.length > 0 || actionItems.length > 0;

  if (!hasContent) {
    return (
      <div className={cn('text-center', containerPadding, className)}>
        <div className="text-gray-500">
          <div className="mb-2 text-2xl">📄</div>
          <p className={compact ? 'text-sm' : 'text-base'}>No summary available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-lg border border-gray-200 bg-white shadow-sm', className)}>
      {/* Header */}
      <div className={cn('border-b border-gray-200', containerPadding)}>
        <div className="flex items-center justify-between">
          <h3 className={cn('font-semibold text-gray-900', headerSize)}>📄 Meeting Summary</h3>
          <div className="flex items-center gap-2">
            {actionItems.length > 0 && (
              <span className={cn('text-gray-600', compact ? 'text-xs' : 'text-sm')}>{actionItems.length} tasks</span>
            )}
            <button
              onClick={handleExpandToggle}
              className={cn('text-blue-600 transition-colors hover:text-blue-800', compact ? 'text-xs' : 'text-sm')}>
              {isExpanded ? '📋 Collapse' : '📋 Expand'}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={cn(containerPadding)}>
        <div className={cn(sectionGap)}>
          {/* Overview */}
          <div>
            <p className={cn('text-gray-700', compact ? 'text-sm' : 'text-base')}>{summary.overview}</p>
          </div>

          {/* Preview Mode Content */}
          {!isExpanded && (
            <>
              {/* Key Points Preview */}
              {summary.keyPoints.length > 0 && (
                <div>
                  <h4 className={cn('mb-2 font-medium text-gray-900', compact ? 'text-sm' : 'text-sm')}>
                    🔑 Key Points
                  </h4>
                  <KeyPointsList keyPoints={summary.keyPoints} maxItems={compact ? 2 : 3} compact={compact} />
                </div>
              )}

              {/* High Priority Action Items */}
              {priorityActionItems.length > 0 && (
                <div>
                  <h4 className={cn('mb-2 font-medium text-gray-900', compact ? 'text-sm' : 'text-sm')}>
                    ⚡ Priority Tasks
                  </h4>
                  <div className="space-y-1.5">
                    {priorityActionItems.map(actionItem => (
                      <ActionItemPreview
                        key={actionItem.id}
                        actionItem={actionItem}
                        onClick={onActionItemClick}
                        compact={compact}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Expanded Mode Content */}
          {isExpanded && (
            <>
              {/* All Key Points */}
              {summary.keyPoints.length > 0 && (
                <div>
                  <h4 className={cn('mb-2 font-medium text-gray-900', compact ? 'text-sm' : 'text-sm')}>
                    🔑 Key Points ({summary.keyPoints.length})
                  </h4>
                  <KeyPointsList keyPoints={summary.keyPoints} maxItems={summary.keyPoints.length} compact={compact} />
                </div>
              )}

              {/* Decisions */}
              {summary.decisions.length > 0 && (
                <div>
                  <h4 className={cn('mb-2 font-medium text-gray-900', compact ? 'text-sm' : 'text-sm')}>
                    ✅ Decisions ({summary.decisions.length})
                  </h4>
                  <DecisionsList decisions={summary.decisions} maxItems={summary.decisions.length} compact={compact} />
                </div>
              )}

              {/* All Action Items */}
              {actionItems.length > 0 && (
                <div>
                  <h4 className={cn('mb-2 font-medium text-gray-900', compact ? 'text-sm' : 'text-sm')}>
                    📋 Action Items ({actionItems.length})
                  </h4>
                  <div className="space-y-1.5">
                    {actionItems.map(actionItem => (
                      <ActionItemPreview
                        key={actionItem.id}
                        actionItem={actionItem}
                        onClick={onActionItemClick}
                        compact={compact}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Next Steps */}
              {summary.nextSteps.length > 0 && (
                <div>
                  <h4 className={cn('mb-2 font-medium text-gray-900', compact ? 'text-sm' : 'text-sm')}>
                    🚀 Next Steps ({summary.nextSteps.length})
                  </h4>
                  <div className="space-y-1">
                    {summary.nextSteps.map((step, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <span className="mt-0.5 flex-shrink-0 text-purple-500">→</span>
                        <span className={cn('text-gray-700', compact ? 'text-xs' : 'text-sm')}>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Metadata */}
          {showMetadata && <SummaryMetadata summary={summary} compact={compact} />}

          {/* Actions */}
          <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-2">
            <div className={cn('text-gray-500', compact ? 'text-xs' : 'text-sm')}>
              {!isExpanded && <span>Click expand to see full summary</span>}
            </div>
            <button
              onClick={handleFullSummaryClick}
              className={cn(
                'rounded border border-blue-200 bg-blue-50 px-3 py-1.5 text-blue-700 transition-colors hover:bg-blue-100',
                compact ? 'text-xs' : 'text-sm',
              )}>
              📄 View Full Summary
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
