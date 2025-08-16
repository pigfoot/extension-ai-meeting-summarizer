/**
 * Storage Management Component
 *
 * Implements storage usage display and cleanup options with statistics visualization
 * and quota monitoring. Provides comprehensive storage management interface.
 */

import { cn } from '@extension/ui';
import { useState, useEffect, useCallback } from 'react';
import type { StorageStatistics, StorageCategoryUsage, StorageRecommendation } from '../types/options-state';
import type React from 'react';

/**
 * Storage management component props
 */
interface StorageManagementProps {
  /** Current storage statistics */
  statistics?: StorageStatistics;
  /** Whether data is loading */
  isLoading?: boolean;
  /** Error message */
  error?: string;
  /** Storage refresh handler */
  onRefresh?: () => Promise<void>;
  /** Cleanup execution handler */
  onCleanup?: (categories: string[]) => Promise<void>;
  /** Bulk cleanup handler */
  onBulkCleanup?: () => Promise<void>;
  /** Custom class name */
  className?: string;
  /** Whether component is in compact mode */
  compact?: boolean;
}

/**
 * Storage category card component
 */
interface CategoryCardProps {
  category: StorageCategoryUsage;
  onCleanup?: (category: string) => void;
  compact?: boolean;
  disabled?: boolean;
}

/**
 * Storage recommendation item component
 */
interface RecommendationItemProps {
  recommendation: StorageRecommendation;
  onExecute?: (recommendation: StorageRecommendation) => void;
  compact?: boolean;
  disabled?: boolean;
}

/**
 * Storage health status indicator component
 */
const HealthStatusIndicator: React.FC<{
  status: 'healthy' | 'warning' | 'critical';
  compact?: boolean;
}> = ({ status, compact = false }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'healthy':
        return {
          color: 'bg-green-100 text-green-800 border-green-200',
          text: 'Healthy',
          icon: '✅',
          description: 'Storage is in good condition',
        };
      case 'warning':
        return {
          color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          text: 'Warning',
          icon: '⚠️',
          description: 'Storage usage is getting high',
        };
      case 'critical':
        return {
          color: 'bg-red-100 text-red-800 border-red-200',
          text: 'Critical',
          icon: '🚨',
          description: 'Storage is critically full',
        };
      default:
        return {
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          text: 'Unknown',
          icon: '❓',
          description: 'Storage status unknown',
        };
    }
  };

  const config = getStatusConfig();
  const badgeSize = compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm';

  return (
    <div className="flex items-center gap-2">
      <span className={cn('inline-flex items-center gap-1.5 rounded-full border font-medium', config.color, badgeSize)}>
        <span>{config.icon}</span>
        <span>{config.text}</span>
      </span>
      {!compact && <span className="text-sm text-gray-600">{config.description}</span>}
    </div>
  );
};

/**
 * Storage usage progress bar component
 */
const StorageProgressBar: React.FC<{
  usagePercentage: number;
  showLabel?: boolean;
  compact?: boolean;
}> = ({ usagePercentage, showLabel = true, compact = false }) => {
  const getProgressColor = () => {
    if (usagePercentage >= 90) return 'bg-red-500';
    if (usagePercentage >= 75) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  const height = compact ? 'h-2' : 'h-3';

  return (
    <div className="space-y-1">
      <div className={cn('w-full overflow-hidden rounded-full bg-gray-200', height)}>
        <div
          className={cn('h-full transition-all duration-300', getProgressColor())}
          style={{ width: `${Math.min(100, Math.max(0, usagePercentage))}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between text-xs text-gray-600">
          <span>{usagePercentage.toFixed(1)}% used</span>
          <span>{(100 - usagePercentage).toFixed(1)}% free</span>
        </div>
      )}
    </div>
  );
};

/**
 * Format bytes utility
 */
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const decimals = 2;

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = parseFloat((bytes / Math.pow(k, i)).toFixed(decimals));

  return `${size} ${units[i]}`;
};

/**
 * Storage category card component
 */
const CategoryCard: React.FC<CategoryCardProps> = ({ category, onCleanup, compact = false, disabled = false }) => {
  const cardPadding = compact ? 'p-3' : 'p-4';
  const titleSize = compact ? 'text-sm' : 'text-base';

  const getCategoryIcon = () => {
    switch (category.category) {
      case 'meetings':
        return '📅';
      case 'transcriptions':
        return '📝';
      case 'cache':
        return '💾';
      case 'config':
        return '⚙️';
      case 'logs':
        return '📋';
      default:
        return '📁';
    }
  };

  const handleCleanup = () => {
    if (disabled || !category.cleanable) return;
    onCleanup?.(category.category);
  };

  return (
    <div className={cn('rounded-lg border border-gray-200 bg-white shadow-sm', cardPadding)}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{getCategoryIcon()}</span>
          <div>
            <h3 className={cn('font-medium text-gray-900', titleSize)}>{category.name}</h3>
            <p className={cn('text-gray-600', compact ? 'text-xs' : 'text-sm')}>{category.itemCount} items</p>
          </div>
        </div>
        <div className="text-right">
          <p className={cn('font-semibold text-gray-900', compact ? 'text-sm' : 'text-base')}>
            {formatBytes(category.bytesUsed)}
          </p>
          <p className={cn('text-gray-600', compact ? 'text-xs' : 'text-sm')}>{category.percentage.toFixed(1)}%</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <StorageProgressBar usagePercentage={category.percentage} showLabel={false} compact={compact} />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <span className={cn('text-gray-500', compact ? 'text-xs' : 'text-sm')}>
          {category.cleanable ? 'Can be cleaned' : 'System files'}
        </span>
        {category.cleanable && (
          <button
            onClick={handleCleanup}
            disabled={disabled}
            className={cn(
              'rounded border px-3 py-1 transition-colors',
              compact ? 'text-xs' : 'text-sm',
              disabled
                ? 'cursor-not-allowed border-gray-300 text-gray-500'
                : 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100',
            )}>
            Clean Up
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Storage recommendation item component
 */
const RecommendationItem: React.FC<RecommendationItemProps> = ({
  recommendation,
  onExecute,
  compact = false,
  disabled = false,
}) => {
  const itemPadding = compact ? 'p-3' : 'p-4';

  const getPriorityConfig = () => {
    switch (recommendation.priority) {
      case 'high':
        return { color: 'text-red-600', icon: '🔴', bgColor: 'bg-red-50' };
      case 'medium':
        return { color: 'text-yellow-600', icon: '🟡', bgColor: 'bg-yellow-50' };
      case 'low':
        return { color: 'text-green-600', icon: '🟢', bgColor: 'bg-green-50' };
      default:
        return { color: 'text-gray-600', icon: '⚪', bgColor: 'bg-gray-50' };
    }
  };

  const getTypeIcon = () => {
    switch (recommendation.type) {
      case 'cleanup':
        return '🧹';
      case 'archive':
        return '📦';
      case 'compress':
        return '🗜️';
      case 'delete':
        return '🗑️';
      default:
        return '🔧';
    }
  };

  const priority = getPriorityConfig();

  const handleExecute = () => {
    if (disabled) return;
    onExecute?.(recommendation);
  };

  return (
    <div className={cn('rounded-lg border border-gray-200 bg-white shadow-sm', itemPadding)}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-lg">{getTypeIcon()}</span>
            <span className={priority.color}>{priority.icon}</span>
            <h4 className={cn('font-medium text-gray-900', compact ? 'text-sm' : 'text-base')}>
              {recommendation.description}
            </h4>
          </div>

          <div className="mb-2 flex items-center gap-4">
            <span className={cn('text-gray-600', compact ? 'text-xs' : 'text-sm')}>
              💾 {formatBytes(recommendation.estimatedSavings)}
            </span>
            <span className={cn('text-gray-600', compact ? 'text-xs' : 'text-sm')}>
              Priority: {recommendation.priority}
            </span>
          </div>

          <p className={cn('text-gray-700', compact ? 'text-xs' : 'text-sm')}>{recommendation.action}</p>
        </div>

        <div className="ml-4 flex flex-col items-end gap-2">
          <button
            onClick={handleExecute}
            disabled={disabled || !recommendation.autoAction}
            className={cn(
              'rounded px-3 py-1.5 font-medium transition-colors',
              compact ? 'text-xs' : 'text-sm',
              disabled || !recommendation.autoAction
                ? 'cursor-not-allowed bg-gray-100 text-gray-500'
                : 'bg-blue-600 text-white hover:bg-blue-700',
            )}>
            {recommendation.autoAction ? 'Execute' : 'Manual'}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Storage statistics overview component
 */
const StorageOverview: React.FC<{
  statistics: StorageStatistics;
  compact?: boolean;
}> = ({ statistics, compact = false }) => {
  const containerPadding = compact ? 'p-4' : 'p-6';
  const titleSize = compact ? 'text-lg' : 'text-xl';

  const formatLastCleanup = (dateString?: string): string => {
    if (!dateString) return 'Never';

    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={cn('rounded-lg border border-gray-200 bg-white shadow-sm', containerPadding)}>
      <h2 className={cn('mb-4 font-semibold text-gray-900', titleSize)}>Storage Overview</h2>

      {/* Main Usage */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <span className={compact ? 'text-sm' : 'text-base'}>Storage Usage</span>
          <span className={cn('font-semibold', compact ? 'text-sm' : 'text-base')}>
            {formatBytes(statistics.totalUsed)} / {formatBytes(statistics.totalAvailable)}
          </span>
        </div>
        <StorageProgressBar usagePercentage={statistics.usagePercentage} compact={compact} />
      </div>

      {/* Health Status */}
      <div className="mb-6">
        <h3 className={cn('mb-2 font-medium text-gray-900', compact ? 'text-sm' : 'text-base')}>Health Status</h3>
        <HealthStatusIndicator status={statistics.healthStatus} compact={compact} />
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className={cn('text-gray-600', compact ? 'text-xs' : 'text-sm')}>Meetings</p>
          <p className={cn('font-semibold text-gray-900', compact ? 'text-sm' : 'text-base')}>
            {statistics.meetingCount}
          </p>
        </div>
        <div>
          <p className={cn('text-gray-600', compact ? 'text-xs' : 'text-sm')}>Cached Items</p>
          <p className={cn('font-semibold text-gray-900', compact ? 'text-sm' : 'text-base')}>
            {statistics.cacheCount}
          </p>
        </div>
        <div className="col-span-2">
          <p className={cn('text-gray-600', compact ? 'text-xs' : 'text-sm')}>Last Cleanup</p>
          <p className={cn('font-semibold text-gray-900', compact ? 'text-sm' : 'text-base')}>
            {formatLastCleanup(statistics.lastCleanup)}
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * Loading skeleton component
 */
const StorageLoadingSkeleton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const containerPadding = compact ? 'p-4' : 'p-6';

  return (
    <div className={cn('space-y-6', containerPadding)}>
      <div className="animate-pulse">
        <div className={cn('rounded bg-gray-200', compact ? 'h-6 w-40' : 'h-8 w-48')} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="animate-pulse rounded-lg border p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-gray-200" />
              <div className="space-y-1">
                <div className="h-4 w-20 rounded bg-gray-200" />
                <div className="h-3 w-16 rounded bg-gray-200" />
              </div>
            </div>
            <div className="mb-3 h-3 w-full rounded bg-gray-200" />
            <div className="flex justify-between">
              <div className="h-3 w-16 rounded bg-gray-200" />
              <div className="h-6 w-16 rounded bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Main StorageManagement component
 */
export const StorageManagement: React.FC<StorageManagementProps> = ({
  statistics,
  isLoading = false,
  error,
  onRefresh,
  onCleanup,
  onBulkCleanup,
  className,
  compact = false,
}) => {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    if (!onRefresh || isRefreshing) return;

    setIsRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      console.error('Failed to refresh storage statistics:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh, isRefreshing]);

  // Handle category cleanup
  const handleCategoryCleanup = useCallback(
    async (category: string) => {
      if (!onCleanup || isCleaningUp) return;

      setIsCleaningUp(true);
      try {
        await onCleanup([category]);
        // Refresh statistics after cleanup
        await handleRefresh();
      } catch (error) {
        console.error('Failed to cleanup category:', error);
      } finally {
        setIsCleaningUp(false);
      }
    },
    [onCleanup, isCleaningUp, handleRefresh],
  );

  // Handle bulk cleanup
  const handleBulkCleanup = useCallback(async () => {
    if (!onBulkCleanup || isCleaningUp) return;

    setIsCleaningUp(true);
    try {
      await onBulkCleanup();
      setSelectedCategories([]);
      // Refresh statistics after cleanup
      await handleRefresh();
    } catch (error) {
      console.error('Failed to perform bulk cleanup:', error);
    } finally {
      setIsCleaningUp(false);
    }
  }, [onBulkCleanup, isCleaningUp, handleRefresh]);

  // Handle recommendation execution
  const handleRecommendationExecute = useCallback(
    async (recommendation: StorageRecommendation) => {
      console.log('Executing recommendation:', recommendation);
      // Implementation would depend on the specific recommendation
      await handleRefresh();
    },
    [handleRefresh],
  );

  const containerPadding = compact ? 'p-4' : 'p-6';
  const sectionGap = compact ? 'space-y-4' : 'space-y-6';
  const headerSize = compact ? 'text-xl' : 'text-2xl';

  // Loading state
  if (isLoading) {
    return (
      <div className={cn(className)}>
        <StorageLoadingSkeleton compact={compact} />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn('text-center', containerPadding, className)}>
        <div className="text-red-500">
          <div className="mb-4 text-4xl">⚠️</div>
          <h2 className={cn('mb-2 font-semibold', compact ? 'text-lg' : 'text-xl')}>Storage Error</h2>
          <p className={compact ? 'text-sm' : 'text-base'}>{error}</p>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="mt-4 rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700">
            {isRefreshing ? 'Retrying...' : 'Retry'}
          </button>
        </div>
      </div>
    );
  }

  // No statistics available
  if (!statistics) {
    return (
      <div className={cn('text-center', containerPadding, className)}>
        <div className="text-gray-500">
          <div className="mb-4 text-4xl">📊</div>
          <h2 className={cn('mb-2 font-semibold', compact ? 'text-lg' : 'text-xl')}>No Storage Data</h2>
          <p className={compact ? 'text-sm' : 'text-base'}>Storage statistics are not available</p>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="mt-4 rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700">
            {isRefreshing ? 'Loading...' : 'Load Statistics'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(containerPadding, sectionGap, className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className={cn('font-bold text-gray-900', headerSize)}>Storage Management</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={cn(
              'rounded border border-gray-300 px-3 py-2 text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50',
              compact ? 'text-sm' : 'text-base',
            )}>
            {isRefreshing ? '🔄 Refreshing...' : '🔄 Refresh'}
          </button>
          {statistics.recommendations.length > 0 && (
            <button
              onClick={handleBulkCleanup}
              disabled={isCleaningUp}
              className={cn(
                'rounded bg-red-600 px-3 py-2 text-white transition-colors hover:bg-red-700 disabled:opacity-50',
                compact ? 'text-sm' : 'text-base',
              )}>
              {isCleaningUp ? '🧹 Cleaning...' : '🧹 Bulk Cleanup'}
            </button>
          )}
        </div>
      </div>

      <div className={sectionGap}>
        {/* Storage Overview */}
        <StorageOverview statistics={statistics} compact={compact} />

        {/* Storage Categories */}
        <div>
          <h2 className={cn('mb-4 font-semibold text-gray-900', compact ? 'text-lg' : 'text-xl')}>
            Storage by Category
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {statistics.categoryUsage.map(category => (
              <CategoryCard
                key={category.category}
                category={category}
                onCleanup={handleCategoryCleanup}
                compact={compact}
                disabled={isCleaningUp}
              />
            ))}
          </div>
        </div>

        {/* Storage Recommendations */}
        {statistics.recommendations.length > 0 && (
          <div>
            <h2 className={cn('mb-4 font-semibold text-gray-900', compact ? 'text-lg' : 'text-xl')}>
              Optimization Recommendations ({statistics.recommendations.length})
            </h2>
            <div className="space-y-3">
              {statistics.recommendations.map((recommendation, index) => (
                <RecommendationItem
                  key={index}
                  recommendation={recommendation}
                  onExecute={handleRecommendationExecute}
                  compact={compact}
                  disabled={isCleaningUp}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty State for Recommendations */}
        {statistics.recommendations.length === 0 && (
          <div className="py-8 text-center">
            <div className="text-gray-500">
              <div className="mb-2 text-4xl">✨</div>
              <h3 className={cn('mb-1 font-medium', compact ? 'text-base' : 'text-lg')}>Storage is Optimized</h3>
              <p className={compact ? 'text-sm' : 'text-base'}>No cleanup recommendations at this time</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
