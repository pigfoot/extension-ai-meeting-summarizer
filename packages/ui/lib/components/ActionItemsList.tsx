/**
 * Action Items List Component
 *
 * Implements action items display with assignments and deadlines,
 * priority indicators and status tracking. Displays and manages meeting action items.
 */

import { cn } from '../utils';
import { useState, useCallback, useMemo } from 'react';
import type {
  ActionItemsListProps,
  ActionItemDisplay,
  ActionItemGrouping,
  ActionItemFilters,
  ActionItemSorting,
  ItemAction,
  PriorityStyling,
  StatusStyling,
} from '../types/summary';
import type { ActionItem, ActionItemPriority, ActionItemStatus, MeetingParticipant } from '@extension/shared';
import type React from 'react';

/**
 * Get priority styling configuration
 */
const getPriorityStyling = (priority: ActionItemPriority): PriorityStyling => {
  switch (priority) {
    case 'critical':
      return {
        borderColor: 'border-red-500',
        backgroundColor: 'bg-red-50',
        textColor: 'text-red-800',
        icon: '🚨',
        animated: true,
      };
    case 'high':
      return {
        borderColor: 'border-orange-400',
        backgroundColor: 'bg-orange-50',
        textColor: 'text-orange-800',
        icon: '⚡',
        animated: false,
      };
    case 'medium':
      return {
        borderColor: 'border-yellow-400',
        backgroundColor: 'bg-yellow-50',
        textColor: 'text-yellow-800',
        icon: '⚠️',
        animated: false,
      };
    case 'low':
      return {
        borderColor: 'border-gray-300',
        backgroundColor: 'bg-gray-50',
        textColor: 'text-gray-700',
        icon: '📝',
        animated: false,
      };
    default:
      return {
        borderColor: 'border-gray-300',
        backgroundColor: 'bg-gray-50',
        textColor: 'text-gray-700',
        icon: '📝',
        animated: false,
      };
  }
};

/**
 * Get status styling configuration
 */
const getStatusStyling = (status: ActionItemStatus): StatusStyling => {
  switch (status) {
    case 'pending':
      return {
        badgeColor: 'bg-gray-100 text-gray-800 border-gray-200',
        textColor: 'text-gray-700',
        icon: '⏳',
        interactive: true,
      };
    case 'in-progress':
      return {
        badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
        textColor: 'text-blue-700',
        icon: '🔄',
        progress: 50,
        interactive: true,
      };
    case 'completed':
      return {
        badgeColor: 'bg-green-100 text-green-800 border-green-200',
        textColor: 'text-green-700',
        icon: '✅',
        progress: 100,
        interactive: false,
      };
    case 'cancelled':
      return {
        badgeColor: 'bg-red-100 text-red-800 border-red-200',
        textColor: 'text-red-700',
        icon: '❌',
        interactive: false,
      };
    default:
      return {
        badgeColor: 'bg-gray-100 text-gray-800 border-gray-200',
        textColor: 'text-gray-700',
        icon: '❓',
        interactive: true,
      };
  }
};

/**
 * Format due date for display
 */
const formatDueDate = (
  dueDate: string,
): { text: string; isOverdue: boolean; urgency: 'urgent' | 'soon' | 'normal' } => {
  const due = new Date(dueDate);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  const isOverdue = diffMs < 0;

  let urgency: 'urgent' | 'soon' | 'normal' = 'normal';
  if (isOverdue || diffDays <= 0) urgency = 'urgent';
  else if (diffDays <= 3) urgency = 'soon';

  let text: string;
  if (isOverdue) {
    const overdueDays = Math.abs(diffDays);
    text = `${overdueDays} day${overdueDays !== 1 ? 's' : ''} overdue`;
  } else if (diffDays === 0) {
    text = 'Due today';
  } else if (diffDays === 1) {
    text = 'Due tomorrow';
  } else if (diffDays <= 7) {
    text = `Due in ${diffDays} days`;
  } else {
    text = due.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: due.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }

  return { text, isOverdue, urgency };
};

/**
 * Priority indicator component
 */
const PriorityIndicator: React.FC<{
  priority: ActionItemPriority;
  styling: PriorityStyling;
  compact?: boolean;
}> = ({ priority, styling, compact = false }) => (
  <div
    className={cn(
      'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium',
      styling.backgroundColor,
      styling.borderColor,
      styling.textColor,
      styling.animated && 'animate-pulse',
    )}>
    <span>{styling.icon}</span>
    {!compact && <span className="capitalize">{priority}</span>}
  </div>
);

/**
 * Status badge component
 */
const StatusBadge: React.FC<{
  status: ActionItemStatus;
  styling: StatusStyling;
  showProgress?: boolean;
  compact?: boolean;
}> = ({ status, styling, showProgress = false, compact = false }) => (
  <div className="flex items-center gap-2">
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium',
        styling.badgeColor,
      )}>
      <span>{styling.icon}</span>
      {!compact && <span className="capitalize">{status.replace('-', ' ')}</span>}
    </div>
    {showProgress && styling.progress !== undefined && (
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200">
        <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${styling.progress}%` }} />
      </div>
    )}
  </div>
);

/**
 * Due date display component
 */
const DueDateDisplay: React.FC<{
  dueDate: string;
  compact?: boolean;
}> = ({ dueDate, compact = false }) => {
  const { text, isOverdue, urgency } = formatDueDate(dueDate);

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded px-2 py-1 text-xs',
        isOverdue && 'bg-red-100 text-red-800',
        urgency === 'soon' && !isOverdue && 'bg-orange-100 text-orange-800',
        urgency === 'normal' && 'bg-gray-100 text-gray-700',
      )}>
      <span>{isOverdue ? '⚠️' : urgency === 'soon' ? '⏰' : '📅'}</span>
      {!compact && <span>{text}</span>}
    </div>
  );
};

/**
 * Assignee display component
 */
const AssigneeDisplay: React.FC<{
  assignee?: MeetingParticipant;
  compact?: boolean;
}> = ({ assignee, compact = false }) => {
  if (!assignee) {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs text-gray-600',
          compact && 'px-1',
        )}>
        <span>👤</span>
        {!compact && <span>Unassigned</span>}
      </div>
    );
  }

  const initials = assignee.name
    .split(' ')
    .map(name => name.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded bg-blue-50 px-2 py-1 text-xs text-blue-800',
        compact && 'gap-1 px-1',
      )}>
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-200 text-xs font-semibold">
        {initials}
      </div>
      {!compact && <span>{assignee.name}</span>}
    </div>
  );
};

/**
 * Action buttons component
 */
const ActionButtons: React.FC<{
  item: ActionItem;
  actions: ItemAction[];
  compact?: boolean;
}> = ({ item, actions, compact = false }) => {
  const [loadingActions, setLoadingActions] = useState<Set<string>>(new Set());

  const handleAction = useCallback(
    async (action: ItemAction) => {
      if (!action.enabled || loadingActions.has(action.id)) return;

      if (action.confirmationMessage) {
        if (!window.confirm(action.confirmationMessage)) return;
      }

      setLoadingActions(prev => new Set(prev).add(action.id));

      try {
        await action.handler(item);
      } catch (error) {
        console.error('Action failed:', error);
      } finally {
        setLoadingActions(prev => {
          const newSet = new Set(prev);
          newSet.delete(action.id);
          return newSet;
        });
      }
    },
    [item, loadingActions],
  );

  return (
    <div className="flex items-center gap-1">
      {actions.map(action => (
        <button
          key={action.id}
          onClick={() => handleAction(action)}
          disabled={!action.enabled || loadingActions.has(action.id)}
          className={cn(
            'inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
            action.type === 'primary' && 'bg-blue-600 text-white hover:bg-blue-700',
            action.type === 'secondary' && 'bg-gray-100 text-gray-700 hover:bg-gray-200',
            action.type === 'danger' && 'bg-red-600 text-white hover:bg-red-700',
            action.type === 'success' && 'bg-green-600 text-white hover:bg-green-700',
            compact && 'px-1',
          )}>
          {loadingActions.has(action.id) ? (
            <span className="animate-spin">⏳</span>
          ) : (
            action.icon && <span>{action.icon}</span>
          )}
          {!compact && <span>{action.label}</span>}
        </button>
      ))}
    </div>
  );
};

/**
 * Individual action item component
 */
const ActionItemCard: React.FC<{
  item: ActionItem;
  display: ActionItemDisplay;
  onSelect?: (item: ActionItem) => void;
  onAction?: (action: string, item: ActionItem) => void;
}> = ({ item, display, onSelect, onAction }) => {
  const [isExpanded, setIsExpanded] = useState(display.expanded);

  const priorityStyling = getPriorityStyling(item.priority);
  const statusStyling = getStatusStyling(item.status);

  const cardPadding = display.mode === 'minimal' ? 'p-2' : display.mode === 'compact' ? 'p-3' : 'p-4';
  const isCompact = display.mode !== 'full';

  return (
    <div
      className={cn(
        'rounded-lg border bg-white transition-all duration-200',
        priorityStyling.borderColor,
        'hover:shadow-md',
        onSelect && 'cursor-pointer',
        cardPadding,
      )}
      onClick={onSelect ? () => onSelect(item) : undefined}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            {display.showPriority && (
              <PriorityIndicator priority={item.priority} styling={priorityStyling} compact={isCompact} />
            )}
            {display.showStatus && (
              <StatusBadge
                status={item.status}
                styling={statusStyling}
                showProgress={display.mode === 'full'}
                compact={isCompact}
              />
            )}
          </div>

          <h3 className={cn('mb-1 font-semibold text-gray-900', display.mode === 'minimal' ? 'text-sm' : 'text-base')}>
            {item.title}
          </h3>

          {item.description && display.mode !== 'minimal' && (
            <p className={cn('mb-2 text-gray-600', display.mode === 'compact' ? 'text-sm' : 'text-base')}>
              {display.mode === 'compact' && item.description.length > 100
                ? `${item.description.substring(0, 100)}...`
                : item.description}
            </p>
          )}
        </div>

        {display.expandable && (
          <button
            onClick={e => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-1 text-gray-400 transition-colors hover:text-gray-600">
            <span className={cn('transform transition-transform', isExpanded ? 'rotate-180' : '')}>▼</span>
          </button>
        )}
      </div>

      {/* Metadata */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {display.showAssignee && item.assignee && <AssigneeDisplay assignee={item.assignee} compact={isCompact} />}
          {display.showDueDate && item.dueDate && <DueDateDisplay dueDate={item.dueDate} compact={isCompact} />}
        </div>

        {item.tags && item.tags.length > 0 && display.mode === 'full' && (
          <div className="flex items-center gap-1">
            {item.tags.slice(0, 3).map(tag => (
              <span key={tag} className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">
                {tag}
              </span>
            ))}
            {item.tags.length > 3 && <span className="text-xs text-gray-500">+{item.tags.length - 3}</span>}
          </div>
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && display.expandable && (
        <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
          {item.description && (
            <div>
              <h4 className="mb-1 text-sm font-medium text-gray-700">Description</h4>
              <p className="text-sm text-gray-600">{item.description}</p>
            </div>
          )}

          {item.tags && item.tags.length > 0 && (
            <div>
              <h4 className="mb-1 text-sm font-medium text-gray-700">Tags</h4>
              <div className="flex flex-wrap gap-1">
                {item.tags.map(tag => (
                  <span key={tag} className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-gray-500">
            Created: {new Date(item.createdAt).toLocaleDateString()}
            {item.updatedAt !== item.createdAt && <> • Updated: {new Date(item.updatedAt).toLocaleDateString()}</>}
          </div>
        </div>
      )}

      {/* Actions */}
      {display.showActions && display.availableActions.length > 0 && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <ActionButtons item={item} actions={display.availableActions} compact={isCompact} />
        </div>
      )}
    </div>
  );
};

/**
 * Group header component
 */
const GroupHeader: React.FC<{
  title: string;
  count: number;
  grouping: ActionItemGrouping;
  compact?: boolean;
}> = ({ title, count, grouping, compact = false }) => {
  const getGroupIcon = (grouping: ActionItemGrouping) => {
    switch (grouping) {
      case 'priority':
        return '⚡';
      case 'status':
        return '📊';
      case 'assignee':
        return '👤';
      case 'dueDate':
        return '📅';
      default:
        return '📁';
    }
  };

  return (
    <div
      className={cn('mb-3 flex items-center gap-2 border-b border-gray-200 pb-2', compact ? 'text-sm' : 'text-base')}>
      <span>{getGroupIcon(grouping)}</span>
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{count}</span>
    </div>
  );
};

/**
 * Filter controls component
 */
const FilterControls: React.FC<{
  filters: ActionItemFilters;
  onFilterChange: (filters: ActionItemFilters) => void;
  compact?: boolean;
}> = ({ filters, onFilterChange, compact = false }) => (
  <div className={cn('mb-4 flex flex-wrap gap-2', compact && 'text-sm')}>
    {/* Priority filter */}
    <select
      value={filters.priorities?.[0] || ''}
      onChange={e => {
        const newFilters = { ...filters };
        if (e.target.value) {
          newFilters.priorities = [e.target.value as ActionItemPriority];
        } else {
          delete newFilters.priorities;
        }
        onFilterChange(newFilters);
      }}
      className="rounded border border-gray-300 px-3 py-1 text-sm">
      <option value="">All Priorities</option>
      <option value="critical">Critical</option>
      <option value="high">High</option>
      <option value="medium">Medium</option>
      <option value="low">Low</option>
    </select>

    {/* Status filter */}
    <select
      value={filters.statuses?.[0] || ''}
      onChange={e => {
        const newFilters = { ...filters };
        if (e.target.value) {
          newFilters.statuses = [e.target.value as ActionItemStatus];
        } else {
          delete newFilters.statuses;
        }
        onFilterChange(newFilters);
      }}
      className="rounded border border-gray-300 px-3 py-1 text-sm">
      <option value="">All Statuses</option>
      <option value="pending">Pending</option>
      <option value="in-progress">In Progress</option>
      <option value="completed">Completed</option>
      <option value="cancelled">Cancelled</option>
    </select>

    {/* Search */}
    <input
      type="text"
      placeholder="Search action items..."
      value={filters.searchQuery || ''}
      onChange={e => {
        const newFilters = { ...filters };
        if (e.target.value) {
          newFilters.searchQuery = e.target.value;
        } else {
          delete newFilters.searchQuery;
        }
        onFilterChange(newFilters);
      }}
      className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-1 text-sm"
    />
  </div>
);

/**
 * Sort controls component
 */
const SortControls: React.FC<{
  sorting: ActionItemSorting;
  onSortChange: (sorting: ActionItemSorting) => void;
  compact?: boolean;
}> = ({ sorting, onSortChange, compact = false }) => (
  <div className={cn('mb-4 flex items-center gap-2', compact && 'text-sm')}>
    <span className="text-gray-600">Sort by:</span>
    <select
      value={sorting.field}
      onChange={e =>
        onSortChange({
          ...sorting,
          field: e.target.value as ActionItemSorting['field'],
        })
      }
      className="rounded border border-gray-300 px-2 py-1 text-sm">
      <option value="priority">Priority</option>
      <option value="dueDate">Due Date</option>
      <option value="status">Status</option>
      <option value="assignee">Assignee</option>
      <option value="createdAt">Created</option>
      <option value="title">Title</option>
    </select>

    <button
      onClick={() =>
        onSortChange({
          ...sorting,
          direction: sorting.direction === 'asc' ? 'desc' : 'asc',
        })
      }
      className="rounded border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50">
      {sorting.direction === 'asc' ? '▲' : '▼'}
    </button>
  </div>
);

/**
 * Main ActionItemsList component
 */
export const ActionItemsList: React.FC<ActionItemsListProps> = ({
  items,
  grouping = 'none',
  displayMode = 'full',
  expandable = false,
  filters,
  sorting = { field: 'priority', direction: 'desc' },
  className,
  onItemSelect,
  onItemAction,
  onFilterChange,
  onSortChange,
  showGroupHeaders = true,
  showItemCount = true,
  maxItemsPerGroup = 10,
}) => {
  // Filter items
  const filteredItems = useMemo(
    () =>
      items.filter(item => {
        if (filters?.priorities && !filters.priorities.includes(item.priority)) return false;
        if (filters?.statuses && !filters.statuses.includes(item.status)) return false;
        if (filters?.assignees && item.assignee && !filters.assignees.includes(item.assignee.email)) return false;
        if (filters?.searchQuery) {
          const query = filters.searchQuery.toLowerCase();
          if (!item.title.toLowerCase().includes(query) && !item.description?.toLowerCase().includes(query))
            return false;
        }
        if (filters?.showOverdue === false) {
          if (item.dueDate && new Date(item.dueDate) < new Date()) return false;
        }
        if (filters?.showCompleted === false && item.status === 'completed') return false;

        return true;
      }),
    [items, filters],
  );

  // Sort items
  const sortedItems = useMemo(
    () =>
      [...filteredItems].sort((a, b) => {
        const getFieldValue = (item: ActionItem, field: ActionItemSorting['field']) => {
          switch (field) {
            case 'priority':
              const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
              return priorityOrder[item.priority] || 0;
            case 'dueDate':
              return item.dueDate ? new Date(item.dueDate).getTime() : 0;
            case 'status':
              const statusOrder = { pending: 1, 'in-progress': 2, completed: 3, cancelled: 4 };
              return statusOrder[item.status] || 0;
            case 'assignee':
              return item.assignee?.name || 'Unassigned';
            case 'createdAt':
              return new Date(item.createdAt).getTime();
            case 'title':
              return item.title;
            default:
              return '';
          }
        };

        const aValue = getFieldValue(a, sorting.field);
        const bValue = getFieldValue(b, sorting.field);

        let comparison = 0;
        if (aValue < bValue) comparison = -1;
        if (aValue > bValue) comparison = 1;

        return sorting.direction === 'asc' ? comparison : -comparison;
      }),
    [filteredItems, sorting],
  );

  // Group items
  const groupedItems = useMemo(() => {
    if (grouping === 'none') {
      return [{ title: 'All Items', items: sortedItems }];
    }

    const groups = new Map<string, ActionItem[]>();

    sortedItems.forEach(item => {
      let groupKey: string;
      let groupTitle: string;

      switch (grouping) {
        case 'priority':
          groupKey = item.priority;
          groupTitle = `${item.priority.charAt(0).toUpperCase()}${item.priority.slice(1)} Priority`;
          break;
        case 'status':
          groupKey = item.status;
          groupTitle = item.status.charAt(0).toUpperCase() + item.status.slice(1).replace('-', ' ');
          break;
        case 'assignee':
          groupKey = item.assignee?.email || 'unassigned';
          groupTitle = item.assignee?.name || 'Unassigned';
          break;
        case 'dueDate':
          if (!item.dueDate) {
            groupKey = 'no-due-date';
            groupTitle = 'No Due Date';
          } else {
            const due = new Date(item.dueDate);
            const now = new Date();
            const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays < 0) {
              groupKey = 'overdue';
              groupTitle = 'Overdue';
            } else if (diffDays === 0) {
              groupKey = 'today';
              groupTitle = 'Due Today';
            } else if (diffDays <= 7) {
              groupKey = 'this-week';
              groupTitle = 'This Week';
            } else if (diffDays <= 30) {
              groupKey = 'this-month';
              groupTitle = 'This Month';
            } else {
              groupKey = 'later';
              groupTitle = 'Later';
            }
          }
          break;
        default:
          groupKey = 'all';
          groupTitle = 'All Items';
      }

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      const group = groups.get(groupKey);
      if (group) {
        group.push(item);
      }
    });

    return Array.from(groups.entries()).map(([key, items]) => ({
      title:
        items.length > 0
          ? grouping === 'assignee' && key !== 'unassigned'
            ? items[0]?.assignee?.name || key
            : key
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ')
          : key,
      items: items.slice(0, maxItemsPerGroup),
    }));
  }, [sortedItems, grouping, maxItemsPerGroup]);

  // Create action item display configuration
  const createItemDisplay = (item: ActionItem): ActionItemDisplay => ({
    item,
    mode: displayMode,
    expandable,
    expanded: false,
    showAssignee: true,
    showDueDate: true,
    showPriority: true,
    showStatus: true,
    showActions: displayMode !== 'minimal',
    priorityStyling: getPriorityStyling(item.priority),
    statusStyling: getStatusStyling(item.status),
    availableActions: [
      {
        id: 'edit',
        label: 'Edit',
        icon: '✏️',
        type: 'secondary',
        enabled: item.status !== 'completed',
        handler: item => onItemAction?.('edit', item),
      },
      {
        id: 'complete',
        label: 'Complete',
        icon: '✅',
        type: 'success',
        enabled: item.status !== 'completed' && item.status !== 'cancelled',
        handler: item => onItemAction?.('complete', item),
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: '🗑️',
        type: 'danger',
        enabled: true,
        confirmationMessage: 'Are you sure you want to delete this action item?',
        handler: item => onItemAction?.('delete', item),
      },
    ],
  });

  const isCompact = displayMode !== 'full';

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={cn('font-bold text-gray-900', isCompact ? 'text-lg' : 'text-xl')}>Action Items</h2>
          {showItemCount && (
            <p className={cn('text-gray-600', isCompact ? 'text-sm' : 'text-base')}>
              {filteredItems.length} of {items.length} items
            </p>
          )}
        </div>
      </div>

      {/* Controls */}
      {(onFilterChange || onSortChange) && (
        <div className="space-y-3">
          {onFilterChange && filters && (
            <FilterControls filters={filters} onFilterChange={onFilterChange} compact={isCompact} />
          )}
          {onSortChange && <SortControls sorting={sorting} onSortChange={onSortChange} compact={isCompact} />}
        </div>
      )}

      {/* Items */}
      {filteredItems.length === 0 ? (
        <div className="py-8 text-center text-gray-500">
          <p className={isCompact ? 'text-sm' : 'text-base'}>No action items found matching your criteria.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedItems.map((group, groupIndex) => (
            <div key={groupIndex}>
              {showGroupHeaders && grouping !== 'none' && (
                <GroupHeader title={group.title} count={group.items.length} grouping={grouping} compact={isCompact} />
              )}

              <div
                className={cn(
                  'grid gap-3',
                  displayMode === 'minimal' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1',
                )}>
                {group.items.map(item => (
                  <ActionItemCard
                    key={item.id}
                    item={item}
                    display={createItemDisplay(item)}
                    {...(onItemSelect && { onSelect: onItemSelect })}
                    {...(onItemAction && { onAction: onItemAction })}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Compact action items list for use in sidebars or constrained spaces
 */
export const CompactActionItemsList: React.FC<Omit<ActionItemsListProps, 'displayMode'>> = props => (
  <ActionItemsList {...props} displayMode="compact" />
);

/**
 * Minimal action items list for dashboard widgets
 */
export const MinimalActionItemsList: React.FC<Omit<ActionItemsListProps, 'displayMode' | 'expandable'>> = props => (
  <ActionItemsList {...props} displayMode="minimal" expandable={false} />
);
