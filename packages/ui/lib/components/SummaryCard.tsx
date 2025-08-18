/**
 * Summary Card Component
 *
 * Implements organized summary display with sections and collapsible sections
 * for overview, key points, and decisions. Displays comprehensive meeting summaries.
 */

import { cn } from '../utils';
import { useState, useCallback, useMemo } from 'react';
import type {
  SummaryDisplayProps,
  SummarySection,
  SummaryDisplayMode,
  ExportFormat,
  SummaryCardState,
  SummaryCardActions,
  SummaryDisplayPreferences,
} from '../types/summary';
import type { MeetingSummary, MeetingRecord } from '@extension/shared';
import type React from 'react';

/**
 * Section configuration with metadata
 */
interface SectionConfig {
  id: SummarySection;
  title: string;
  icon: string;
  description: string;
  defaultExpanded: boolean;
  priority: number;
}

/**
 * Get section configurations
 */
const getSectionConfigs = (): SectionConfig[] => [
  {
    id: 'overview',
    title: 'Meeting Overview',
    icon: '📋',
    description: 'High-level summary of the meeting',
    defaultExpanded: true,
    priority: 1,
  },
  {
    id: 'keyPoints',
    title: 'Key Discussion Points',
    icon: '💡',
    description: 'Important topics and insights discussed',
    defaultExpanded: true,
    priority: 2,
  },
  {
    id: 'decisions',
    title: 'Decisions Made',
    icon: '✅',
    description: 'Important decisions and agreements reached',
    defaultExpanded: true,
    priority: 3,
  },
  {
    id: 'nextSteps',
    title: 'Next Steps',
    icon: '👥',
    description: 'Follow-up actions and next steps identified',
    defaultExpanded: true,
    priority: 4,
  },
  {
    id: 'participants',
    title: 'Participants',
    icon: '👥',
    description: 'Meeting participants and their contributions',
    defaultExpanded: false,
    priority: 5,
  },
  {
    id: 'actionItems',
    title: 'Action Items',
    icon: '📝',
    description: 'Specific tasks and assignments',
    defaultExpanded: false,
    priority: 6,
  },
];

/**
 * Get section content from summary
 */
const getSectionContent = (
  section: SummarySection,
  summary: MeetingSummary,
  meeting: MeetingRecord,
): string | string[] | null => {
  switch (section) {
    case 'overview':
      return summary.overview || null;
    case 'keyPoints':
      return summary.keyPoints?.length > 0 ? summary.keyPoints : null;
    case 'decisions':
      return summary.decisions?.length > 0 ? summary.decisions : null;
    case 'nextSteps':
      return summary.nextSteps?.length > 0 ? summary.nextSteps : null;
    case 'participants':
      return (
        summary.participantsSummary ||
        (meeting.participants?.length > 0 ? meeting.participants.map(p => `${p.name} (${p.email})`).join(', ') : null)
      );
    case 'actionItems':
      return meeting.actionItems && meeting.actionItems.length > 0
        ? meeting.actionItems.map(item => `${item.title} - ${item.assignee?.name || 'Unassigned'} (${item.priority})`)
        : null;
    default:
      return null;
  }
};

/**
 * Section content renderer component
 */
const SectionContent: React.FC<{
  section: SummarySection;
  content: string | string[] | null;
  mode: SummaryDisplayMode;
  maxContentLength?: number;
}> = ({ section, content, mode, maxContentLength = 500 }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!content) {
    return <div className="py-2 text-sm italic text-gray-500">No {section} available for this meeting.</div>;
  }

  if (typeof content === 'string') {
    const shouldTruncate = mode === 'compact' && content.length > maxContentLength;
    const displayContent = shouldTruncate && !isExpanded ? `${content.substring(0, maxContentLength)}...` : content;

    return (
      <div className="space-y-2">
        <p className={cn('leading-relaxed text-gray-700', mode === 'compact' ? 'text-sm' : 'text-base')}>
          {displayContent}
        </p>
        {shouldTruncate && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm font-medium text-blue-600 transition-colors hover:text-blue-800">
            {isExpanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>
    );
  }

  if (Array.isArray(content)) {
    const maxItems = mode === 'preview' ? 3 : mode === 'compact' ? 5 : content.length;
    const displayItems = isExpanded ? content : content.slice(0, maxItems);
    const hasMore = content.length > maxItems;

    return (
      <div className="space-y-2">
        <ul className="space-y-2">
          {displayItems.map((item, index) => (
            <li key={index} className="flex items-start gap-2">
              <span className="mt-1 flex-shrink-0 text-blue-500">•</span>
              <span className={cn('leading-relaxed text-gray-700', mode === 'compact' ? 'text-sm' : 'text-base')}>
                {item}
              </span>
            </li>
          ))}
        </ul>
        {hasMore && !isExpanded && (
          <button
            onClick={() => setIsExpanded(true)}
            className="text-sm font-medium text-blue-600 transition-colors hover:text-blue-800">
            Show {content.length - maxItems} more items
          </button>
        )}
        {isExpanded && hasMore && (
          <button
            onClick={() => setIsExpanded(false)}
            className="text-sm font-medium text-blue-600 transition-colors hover:text-blue-800">
            Show less
          </button>
        )}
      </div>
    );
  }

  return null;
};

/**
 * Section header component
 */
const SectionHeader: React.FC<{
  config: SectionConfig;
  isExpanded: boolean;
  isCollapsible: boolean;
  mode: SummaryDisplayMode;
  onToggle: () => void;
  onCopy?: () => void;
}> = ({ config, isExpanded, isCollapsible, mode, onToggle, onCopy }) => {
  const iconSize = mode === 'compact' ? 'text-lg' : 'text-xl';
  const titleSize = mode === 'compact' ? 'text-base' : 'text-lg';

  return (
    <div className="flex items-center justify-between">
      <button
        onClick={isCollapsible ? onToggle : undefined}
        disabled={!isCollapsible}
        className={cn(
          'flex flex-1 items-center gap-3 text-left transition-colors',
          isCollapsible ? 'cursor-pointer hover:text-blue-600' : 'cursor-default',
        )}>
        <span className={cn('flex-shrink-0', iconSize)}>{config.icon}</span>
        <div className="flex-1">
          <h3 className={cn('font-semibold text-gray-900', titleSize)}>{config.title}</h3>
          {mode === 'full' && <p className="mt-0.5 text-xs text-gray-500">{config.description}</p>}
        </div>
        {isCollapsible && (
          <span className={cn('text-gray-400 transition-transform', isExpanded ? 'rotate-180' : 'rotate-0')}>▼</span>
        )}
      </button>

      {onCopy && mode !== 'preview' && (
        <button
          onClick={onCopy}
          className="ml-2 rounded p-1.5 text-gray-400 transition-colors hover:text-gray-600"
          title="Copy section content">
          📋
        </button>
      )}
    </div>
  );
};

/**
 * Summary metadata component
 */
const SummaryMetadata: React.FC<{
  summary: MeetingSummary;
  meeting: MeetingRecord;
  mode: SummaryDisplayMode;
}> = ({ summary, meeting, mode }) => {
  if (mode === 'preview') return null;

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className={cn('space-y-2 border-t border-gray-200 pt-3', mode === 'compact' ? 'text-xs' : 'text-sm')}>
      <div className="flex items-center justify-between text-gray-500">
        <span>Meeting: {formatDate(meeting.startTime)}</span>
        <span>Summary: {formatDate(summary.generatedAt)}</span>
      </div>

      {(summary.aiModel || summary.qualityScore) && (
        <div className="flex items-center justify-between text-gray-500">
          {summary.aiModel && <span>Generated by {summary.aiModel}</span>}
          {summary.qualityScore && <span>Quality Score: {Math.round(summary.qualityScore * 100)}%</span>}
        </div>
      )}

      <div className="flex items-center justify-between text-gray-500">
        <span>
          {meeting.participants.length} participant{meeting.participants.length !== 1 ? 's' : ''}
        </span>
        {meeting.metadata.duration && <span>Duration: {Math.round(meeting.metadata.duration / 60)} minutes</span>}
      </div>
    </div>
  );
};

/**
 * Export options component
 */
const ExportOptions: React.FC<{
  onExport: (format: ExportFormat) => void;
  mode: SummaryDisplayMode;
}> = ({ onExport, mode }) => {
  if (mode === 'preview') return null;

  const exportFormats: { format: ExportFormat; label: string; icon: string }[] = [
    { format: 'text', label: 'Text', icon: '📄' },
    { format: 'pdf', label: 'PDF', icon: '📑' },
    { format: 'docx', label: 'Word', icon: '📘' },
    { format: 'json', label: 'JSON', icon: '🔧' },
  ];

  return (
    <div className="border-t border-gray-200 pt-3">
      <div className="flex items-center justify-between">
        <span className={cn('font-medium text-gray-700', mode === 'compact' ? 'text-sm' : 'text-base')}>
          Export Summary
        </span>
        <div className="flex items-center gap-1">
          {exportFormats.map(({ format, label, icon }) => (
            <button
              key={format}
              onClick={() => onExport(format)}
              className={cn(
                'inline-flex items-center gap-1 rounded px-2 py-1 text-gray-600 transition-colors hover:bg-blue-50 hover:text-blue-600',
                mode === 'compact' ? 'text-xs' : 'text-sm',
              )}
              title={`Export as ${label}`}>
              <span>{icon}</span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Main SummaryCard component
 */
export const SummaryCard: React.FC<SummaryDisplayProps> = ({
  summary,
  meeting,
  mode = 'full',
  sections = ['overview', 'keyPoints', 'decisions', 'nextSteps'],
  collapsible = true,
  expandedSections = ['overview', 'keyPoints'],
  className,
  onSectionToggle,
  onSectionClick,
  onExport,
  showExportOptions = false,
  showMetadata = true,
  customSectionRenderer,
}) => {
  // State management
  const [internalExpandedSections, setInternalExpandedSections] = useState<Set<SummarySection>>(
    new Set(expandedSections),
  );

  // Section configurations
  const sectionConfigs = useMemo(
    () =>
      getSectionConfigs()
        .filter(config => sections.includes(config.id))
        .sort((a, b) => a.priority - b.priority),
    [sections],
  );

  // Toggle section expansion
  const toggleSection = useCallback(
    (section: SummarySection) => {
      const newExpanded = new Set(internalExpandedSections);
      const isExpanded = newExpanded.has(section);

      if (isExpanded) {
        newExpanded.delete(section);
      } else {
        newExpanded.add(section);
      }

      setInternalExpandedSections(newExpanded);
      onSectionToggle?.(section, !isExpanded);
    },
    [internalExpandedSections, onSectionToggle],
  );

  // Copy section content
  const copySectionContent = useCallback(
    (section: SummarySection) => {
      const content = getSectionContent(section, summary, meeting);
      if (content) {
        const textContent = typeof content === 'string' ? content : content.join('\n• ');
        navigator.clipboard.writeText(textContent).catch(console.error);
      }
    },
    [summary, meeting],
  );

  // Handle section click
  const _handleSectionClick = useCallback(
    (section: SummarySection) => {
      onSectionClick?.(section);
    },
    [onSectionClick],
  );

  // Handle export
  const handleExport = useCallback(
    (format: ExportFormat) => {
      onExport?.(format);
    },
    [onExport],
  );

  const cardPadding = mode === 'compact' ? 'p-4' : 'p-6';
  const sectionSpacing = mode === 'compact' ? 'space-y-4' : 'space-y-6';

  return (
    <div className={cn('rounded-lg border border-gray-200 bg-white shadow-sm', cardPadding, className)}>
      {/* Card Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className={cn('font-bold text-gray-900', mode === 'compact' ? 'text-lg' : 'text-xl')}>Meeting Summary</h2>
          <p className={cn('mt-1 text-gray-600', mode === 'compact' ? 'text-sm' : 'text-base')}>{meeting.title}</p>
        </div>

        {mode !== 'preview' && (
          <div className="flex items-center gap-2">
            {collapsible && (
              <>
                <button
                  onClick={() => {
                    const allSections = new Set(sections);
                    setInternalExpandedSections(allSections);
                    sections.forEach(section => onSectionToggle?.(section, true));
                  }}
                  className="rounded px-2 py-1 text-xs text-blue-600 transition-colors hover:text-blue-800">
                  Expand All
                </button>
                <button
                  onClick={() => {
                    setInternalExpandedSections(new Set());
                    sections.forEach(section => onSectionToggle?.(section, false));
                  }}
                  className="rounded px-2 py-1 text-xs text-blue-600 transition-colors hover:text-blue-800">
                  Collapse All
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Summary Sections */}
      <div className={sectionSpacing}>
        {sectionConfigs.map(config => {
          const isExpanded = collapsible ? internalExpandedSections.has(config.id) : true;
          const content = getSectionContent(config.id, summary, meeting);
          const hasContent = content !== null;

          if (!hasContent && mode === 'preview') {
            return null;
          }

          return (
            <div key={config.id} className="overflow-hidden rounded-lg border border-gray-100">
              {/* Section Header */}
              <div
                className={cn('border-b border-gray-100 bg-gray-50', mode === 'compact' ? 'px-3 py-2' : 'px-4 py-3')}>
                <SectionHeader
                  config={config}
                  isExpanded={isExpanded}
                  isCollapsible={collapsible}
                  mode={mode}
                  onToggle={() => toggleSection(config.id)}
                  {...(hasContent && { onCopy: () => copySectionContent(config.id) })}
                />
              </div>

              {/* Section Content */}
              {isExpanded && (
                <div className={cn('bg-white', mode === 'compact' ? 'px-3 py-3' : 'px-4 py-4')}>
                  {customSectionRenderer ? (
                    customSectionRenderer(config.id, content)
                  ) : (
                    <SectionContent
                      section={config.id}
                      content={content}
                      mode={mode}
                      maxContentLength={mode === 'compact' ? 300 : 500}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {mode !== 'preview' && (
        <div className="mt-6 space-y-3">
          {showExportOptions && onExport && <ExportOptions onExport={handleExport} mode={mode} />}

          {showMetadata && <SummaryMetadata summary={summary} meeting={meeting} mode={mode} />}
        </div>
      )}
    </div>
  );
};

/**
 * Summary card actions hook for state management
 */
export const useSummaryCard = (
  defaultPreferences?: Partial<SummaryDisplayPreferences>,
): SummaryCardState & SummaryCardActions => {
  const [expandedSections, setExpandedSections] = useState<Set<SummarySection>>(new Set());
  const [loadingStates, setLoadingStates] = useState<Map<SummarySection, boolean>>(new Map());
  const [errorStates, setErrorStates] = useState<Map<SummarySection, string>>(new Map());
  const [contentCache, setContentCache] = useState<Map<SummarySection, unknown>>(new Map());
  const [displayPreferences, setDisplayPreferences] = useState<SummaryDisplayPreferences>({
    defaultMode: 'full',
    defaultExpandedSections: ['overview', 'keyPoints'],
    animateTransitions: true,
    showSectionIcons: true,
    showMetadata: true,
    enableKeyboardNavigation: true,
    autoCollapse: false,
    maxContentLength: 500,
    ...defaultPreferences,
  });

  const toggleSection = useCallback(
    (section: SummarySection) => {
      setExpandedSections(prev => {
        const newSet = new Set(prev);
        if (newSet.has(section)) {
          newSet.delete(section);
        } else {
          if (displayPreferences.autoCollapse) {
            newSet.clear();
          }
          newSet.add(section);
        }
        return newSet;
      });
    },
    [displayPreferences.autoCollapse],
  );

  const expandAll = useCallback(() => {
    const allSections: SummarySection[] = [
      'overview',
      'keyPoints',
      'decisions',
      'nextSteps',
      'participants',
      'actionItems',
    ];
    setExpandedSections(new Set(allSections));
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedSections(new Set());
  }, []);

  const refreshSection = useCallback(async (section: SummarySection) => {
    setLoadingStates(prev => new Map(prev).set(section, true));
    setErrorStates(prev => {
      const newMap = new Map(prev);
      newMap.delete(section);
      return newMap;
    });

    try {
      // This would typically make an API call to refresh section content
      await new Promise(resolve => setTimeout(resolve, 1000));

      setContentCache(prev => {
        const newMap = new Map(prev);
        newMap.set(section, `Refreshed content for ${section}`);
        return newMap;
      });
    } catch (error) {
      setErrorStates(prev => new Map(prev).set(section, error instanceof Error ? error.message : 'Refresh failed'));
    } finally {
      setLoadingStates(prev => {
        const newMap = new Map(prev);
        newMap.delete(section);
        return newMap;
      });
    }
  }, []);

  const updatePreferences = useCallback((preferences: Partial<SummaryDisplayPreferences>) => {
    setDisplayPreferences(prev => ({ ...prev, ...preferences }));
  }, []);

  const exportSummary = useCallback(async (format: ExportFormat, options?: any) => {
    // This would typically handle the export logic
    console.log('Exporting summary as', format, options);
  }, []);

  const shareSummary = useCallback((section?: SummarySection) => {
    // This would typically handle sharing logic
    console.log('Sharing summary', section ? `section: ${section}` : 'full summary');
  }, []);

  const copySectionContent = useCallback(
    (section: SummarySection) => {
      const content = contentCache.get(section);
      if (content) {
        navigator.clipboard.writeText(String(content)).catch(console.error);
      }
    },
    [contentCache],
  );

  return {
    // State
    expandedSections,
    loadingStates,
    errorStates,
    contentCache,
    displayPreferences,
    lastUpdate: new Date(),

    // Actions
    toggleSection,
    expandAll,
    collapseAll,
    refreshSection,
    updatePreferences,
    exportSummary,
    shareSummary,
    copySectionContent,
  };
};

/**
 * Compact summary card for use in lists or previews
 */
export const CompactSummaryCard: React.FC<Omit<SummaryDisplayProps, 'mode'>> = props => (
  <SummaryCard {...props} mode="compact" />
);

/**
 * Preview summary card for quick overview
 */
export const PreviewSummaryCard: React.FC<Omit<SummaryDisplayProps, 'mode' | 'sections'>> = props => (
  <SummaryCard
    {...props}
    mode="preview"
    sections={['overview', 'keyPoints']}
    collapsible={false}
    showExportOptions={false}
    showMetadata={false}
  />
);
