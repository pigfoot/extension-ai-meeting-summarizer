/**
 * Summary Display Types
 *
 * Type definitions for meeting summary display components,
 * including summary cards, action items, transcription viewers, and export functionality.
 */

import type {
  MeetingRecord,
  MeetingSummary,
  ActionItem,
  TranscriptionResult,
  TranscriptionSegment,
  ActionItemPriority,
  ActionItemStatus,
} from '@extension/shared';

/**
 * Export format options
 */
export type ExportFormat = 'text' | 'json' | 'pdf' | 'docx' | 'html' | 'csv';

/**
 * Summary section types
 */
export type SummarySection = 'overview' | 'keyPoints' | 'decisions' | 'nextSteps' | 'actionItems' | 'participants';

/**
 * Display mode for summary content
 */
export type SummaryDisplayMode = 'full' | 'compact' | 'preview';

/**
 * Action item display grouping options
 */
export type ActionItemGrouping = 'none' | 'priority' | 'assignee' | 'status' | 'dueDate';

/**
 * Transcription search result highlighting
 */
export type HighlightType = 'search' | 'speaker' | 'timestamp' | 'keyword';

/**
 * Summary card component props
 */
export interface SummaryDisplayProps {
  /** Meeting summary to display */
  summary: MeetingSummary;
  /** Associated meeting record */
  meeting: MeetingRecord;
  /** Display mode */
  mode?: SummaryDisplayMode;
  /** Sections to display */
  sections?: SummarySection[];
  /** Whether sections are collapsible */
  collapsible?: boolean;
  /** Initially expanded sections */
  expandedSections?: SummarySection[];
  /** Custom class name */
  className?: string;
  /** Section expansion handler */
  onSectionToggle?: (section: SummarySection, expanded: boolean) => void;
  /** Section click handler */
  onSectionClick?: (section: SummarySection) => void;
  /** Export handler */
  onExport?: (format: ExportFormat) => void;
  /** Whether to show export options */
  showExportOptions?: boolean;
  /** Whether to show metadata */
  showMetadata?: boolean;
  /** Custom section rendering */
  customSectionRenderer?: (section: SummarySection, content: unknown) => React.ReactNode;
}

/**
 * Action item display configuration
 */
export interface ActionItemDisplay {
  /** Action item data */
  item: ActionItem;
  /** Display mode */
  mode: 'full' | 'compact' | 'minimal';
  /** Whether item is expandable */
  expandable: boolean;
  /** Whether item is currently expanded */
  expanded: boolean;
  /** Whether to show assignee information */
  showAssignee: boolean;
  /** Whether to show due date */
  showDueDate: boolean;
  /** Whether to show priority indicator */
  showPriority: boolean;
  /** Whether to show status badge */
  showStatus: boolean;
  /** Whether to show action buttons */
  showActions: boolean;
  /** Custom styling based on priority */
  priorityStyling: PriorityStyling;
  /** Custom styling based on status */
  statusStyling: StatusStyling;
  /** Interactive actions available */
  availableActions: ItemAction[];
}

/**
 * Priority-based styling configuration
 */
export interface PriorityStyling {
  /** Border color for priority indication */
  borderColor: string;
  /** Background color for priority indication */
  backgroundColor: string;
  /** Text color for priority labels */
  textColor: string;
  /** Icon to display for priority */
  icon?: string;
  /** Whether to use animated indicators */
  animated: boolean;
}

/**
 * Status-based styling configuration
 */
export interface StatusStyling {
  /** Badge color for status */
  badgeColor: string;
  /** Badge text color */
  textColor: string;
  /** Status icon */
  icon?: string;
  /** Progress indicator percentage if applicable */
  progress?: number;
  /** Whether status allows interactions */
  interactive: boolean;
}

/**
 * Available actions for action items
 */
export interface ItemAction {
  /** Action identifier */
  id: string;
  /** Action label */
  label: string;
  /** Action icon */
  icon?: string;
  /** Action type for styling */
  type: 'primary' | 'secondary' | 'danger' | 'success';
  /** Whether action is available */
  enabled: boolean;
  /** Action handler */
  handler: (item: ActionItem) => void | Promise<void>;
  /** Confirmation message if needed */
  confirmationMessage?: string;
}

/**
 * Action items list component props
 */
export interface ActionItemsListProps {
  /** List of action items to display */
  items: ActionItem[];
  /** Display grouping option */
  grouping?: ActionItemGrouping;
  /** Display mode for all items */
  displayMode?: 'full' | 'compact' | 'minimal';
  /** Whether items are expandable */
  expandable?: boolean;
  /** Filter options */
  filters?: ActionItemFilters;
  /** Sort options */
  sorting?: ActionItemSorting;
  /** Custom class name */
  className?: string;
  /** Item selection handler */
  onItemSelect?: (item: ActionItem) => void;
  /** Item action handler */
  onItemAction?: (action: string, item: ActionItem) => void;
  /** Filter change handler */
  onFilterChange?: (filters: ActionItemFilters) => void;
  /** Sort change handler */
  onSortChange?: (sorting: ActionItemSorting) => void;
  /** Whether to show group headers */
  showGroupHeaders?: boolean;
  /** Whether to show item count */
  showItemCount?: boolean;
  /** Maximum items to display per group */
  maxItemsPerGroup?: number;
}

/**
 * Action item filtering options
 */
export interface ActionItemFilters {
  /** Filter by priority levels */
  priorities?: ActionItemPriority[];
  /** Filter by status values */
  statuses?: ActionItemStatus[];
  /** Filter by assignee */
  assignees?: string[];
  /** Filter by due date range */
  dueDateRange?: {
    start?: Date;
    end?: Date;
  };
  /** Filter by tags */
  tags?: string[];
  /** Search query for title/description */
  searchQuery?: string;
  /** Filter by overdue items */
  showOverdue?: boolean;
  /** Filter by completed items */
  showCompleted?: boolean;
}

/**
 * Action item sorting options
 */
export interface ActionItemSorting {
  /** Sort field */
  field: 'priority' | 'dueDate' | 'status' | 'assignee' | 'createdAt' | 'title';
  /** Sort direction */
  direction: 'asc' | 'desc';
  /** Secondary sort field */
  secondaryField?: 'priority' | 'dueDate' | 'status' | 'assignee' | 'createdAt' | 'title';
  /** Secondary sort direction */
  secondaryDirection?: 'asc' | 'desc';
}

/**
 * Transcription viewer component props
 */
export interface TranscriptionViewerProps {
  /** Transcription result to display */
  transcription: TranscriptionResult;
  /** Associated meeting record */
  meeting: MeetingRecord;
  /** Whether to show speaker identification */
  showSpeakers?: boolean;
  /** Whether to show timestamps */
  showTimestamps?: boolean;
  /** Whether to show confidence scores */
  showConfidence?: boolean;
  /** Search functionality */
  searchable?: boolean;
  /** Current search query */
  searchQuery?: string;
  /** Search results highlighting */
  highlights?: SearchHighlight[];
  /** Whether text is selectable */
  selectable?: boolean;
  /** Custom class name */
  className?: string;
  /** Segment click handler */
  onSegmentClick?: (segment: TranscriptionSegment) => void;
  /** Text selection handler */
  onTextSelect?: (selectedText: string, segment: TranscriptionSegment) => void;
  /** Search handler */
  onSearch?: (query: string) => void;
  /** Navigation to timestamp */
  onTimestampClick?: (timestamp: number) => void;
  /** Export handler */
  onExport?: (format: ExportFormat) => void;
  /** Display preferences */
  displayPreferences?: TranscriptionDisplayPreferences;
}

/**
 * Search result highlighting information
 */
export interface SearchHighlight {
  /** Start position in text */
  start: number;
  /** End position in text */
  end: number;
  /** Highlight type */
  type: HighlightType;
  /** Additional context */
  context?: string;
  /** Segment ID containing the highlight */
  segmentId?: string;
}

/**
 * Transcription display preferences
 */
export interface TranscriptionDisplayPreferences {
  /** Font size */
  fontSize: 'small' | 'medium' | 'large';
  /** Line spacing */
  lineSpacing: 'compact' | 'normal' | 'relaxed';
  /** Whether to group by speaker */
  groupBySpeaker: boolean;
  /** Timestamp format */
  timestampFormat: 'relative' | 'absolute' | 'duration';
  /** Speaker name display */
  speakerDisplay: 'name' | 'initial' | 'id' | 'none';
  /** Confidence threshold for display */
  confidenceThreshold: number;
  /** Whether to show word-level timing */
  showWordTiming: boolean;
  /** Color scheme */
  colorScheme: 'light' | 'dark' | 'auto';
}

/**
 * Export options configuration
 */
export interface ExportOptions {
  /** Available export formats */
  formats: ExportFormatOption[];
  /** Default export format */
  defaultFormat: ExportFormat;
  /** Export content options */
  contentOptions: ExportContentOptions;
  /** Export styling options */
  stylingOptions: ExportStylingOptions;
  /** File naming options */
  namingOptions: ExportNamingOptions;
  /** Export metadata options */
  metadataOptions: ExportMetadataOptions;
}

/**
 * Individual export format configuration
 */
export interface ExportFormatOption {
  /** Format identifier */
  format: ExportFormat;
  /** Format display name */
  name: string;
  /** Format description */
  description: string;
  /** File extension */
  extension: string;
  /** MIME type */
  mimeType: string;
  /** Whether format is available */
  available: boolean;
  /** Format-specific options */
  options?: Record<string, unknown>;
  /** Preview availability */
  previewable: boolean;
  /** Estimated file size */
  estimatedSize?: string;
}

/**
 * Export content inclusion options
 */
export interface ExportContentOptions {
  /** Include meeting metadata */
  includeMetadata: boolean;
  /** Include participant information */
  includeParticipants: boolean;
  /** Include summary sections */
  includeSummary: boolean;
  /** Include action items */
  includeActionItems: boolean;
  /** Include full transcription */
  includeTranscription: boolean;
  /** Include timestamps */
  includeTimestamps: boolean;
  /** Include speaker identification */
  includeSpeakers: boolean;
  /** Include confidence scores */
  includeConfidence: boolean;
  /** Content filtering options */
  contentFilters: ContentFilter[];
}

/**
 * Content filtering for exports
 */
export interface ContentFilter {
  /** Filter type */
  type: 'speaker' | 'confidence' | 'time' | 'keyword';
  /** Filter value */
  value: string | number;
  /** Filter operator */
  operator: 'equals' | 'contains' | 'greater' | 'less' | 'between';
  /** Whether filter is inclusive */
  inclusive: boolean;
}

/**
 * Export styling and formatting options
 */
export interface ExportStylingOptions {
  /** Include styling information */
  includeStyles: boolean;
  /** Color scheme for export */
  colorScheme: 'light' | 'dark' | 'print';
  /** Font family */
  fontFamily: string;
  /** Font size */
  fontSize: number;
  /** Page layout for document formats */
  pageLayout: 'portrait' | 'landscape';
  /** Page margins */
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  /** Header and footer options */
  headerFooter: {
    includeHeader: boolean;
    includeFooter: boolean;
    headerText?: string;
    footerText?: string;
  };
}

/**
 * Export file naming options
 */
export interface ExportNamingOptions {
  /** Naming template */
  template: string;
  /** Include meeting date in filename */
  includeMeetingDate: boolean;
  /** Include meeting title in filename */
  includeMeetingTitle: boolean;
  /** Include export timestamp */
  includeTimestamp: boolean;
  /** File name sanitization */
  sanitizeFilename: boolean;
  /** Maximum filename length */
  maxFilenameLength: number;
  /** Custom filename prefix */
  customPrefix?: string;
  /** Custom filename suffix */
  customSuffix?: string;
}

/**
 * Export metadata inclusion options
 */
export interface ExportMetadataOptions {
  /** Include export information */
  includeExportInfo: boolean;
  /** Include system information */
  includeSystemInfo: boolean;
  /** Include user information */
  includeUserInfo: boolean;
  /** Include processing statistics */
  includeProcessingStats: boolean;
  /** Include version information */
  includeVersionInfo: boolean;
  /** Custom metadata fields */
  customFields?: Record<string, string>;
}

/**
 * Export manager component props
 */
export interface ExportManagerProps {
  /** Meeting data to export */
  meeting: MeetingRecord;
  /** Export options configuration */
  options: ExportOptions;
  /** Export trigger handler */
  onExport?: (format: ExportFormat, options: ExportContentOptions) => Promise<void>;
  /** Export progress handler */
  onProgress?: (progress: number) => void;
  /** Export completion handler */
  onComplete?: (filename: string, format: ExportFormat) => void;
  /** Export error handler */
  onError?: (error: Error) => void;
  /** Custom class name */
  className?: string;
  /** Whether export is currently in progress */
  isExporting?: boolean;
  /** Export progress percentage */
  exportProgress?: number;
  /** Show format selection */
  showFormatSelection?: boolean;
  /** Show content options */
  showContentOptions?: boolean;
  /** Show styling options */
  showStylingOptions?: boolean;
  /** Show naming options */
  showNamingOptions?: boolean;
}

/**
 * Summary card state management
 */
export interface SummaryCardState {
  /** Currently expanded sections */
  expandedSections: Set<SummarySection>;
  /** Loading states for sections */
  loadingStates: Map<SummarySection, boolean>;
  /** Error states for sections */
  errorStates: Map<SummarySection, string>;
  /** Section content cache */
  contentCache: Map<SummarySection, unknown>;
  /** Display preferences */
  displayPreferences: SummaryDisplayPreferences;
  /** Last update timestamp */
  lastUpdate: Date;
}

/**
 * Summary display preferences
 */
export interface SummaryDisplayPreferences {
  /** Default display mode */
  defaultMode: SummaryDisplayMode;
  /** Default expanded sections */
  defaultExpandedSections: SummarySection[];
  /** Enable section animations */
  animateTransitions: boolean;
  /** Show section icons */
  showSectionIcons: boolean;
  /** Show metadata by default */
  showMetadata: boolean;
  /** Enable keyboard navigation */
  enableKeyboardNavigation: boolean;
  /** Auto-collapse other sections */
  autoCollapse: boolean;
  /** Maximum content length before truncation */
  maxContentLength: number;
}

/**
 * Summary card actions
 */
export interface SummaryCardActions {
  /** Toggle section expansion */
  toggleSection: (section: SummarySection) => void;
  /** Expand all sections */
  expandAll: () => void;
  /** Collapse all sections */
  collapseAll: () => void;
  /** Refresh section content */
  refreshSection: (section: SummarySection) => Promise<void>;
  /** Update display preferences */
  updatePreferences: (preferences: Partial<SummaryDisplayPreferences>) => void;
  /** Export summary */
  exportSummary: (format: ExportFormat, options?: ExportContentOptions) => Promise<void>;
  /** Share summary */
  shareSummary: (section?: SummarySection) => void;
  /** Copy section content */
  copySectionContent: (section: SummarySection) => void;
}

/**
 * Transcription viewer state management
 */
export interface TranscriptionViewerState {
  /** Current search query */
  searchQuery: string;
  /** Search results */
  searchResults: SearchHighlight[];
  /** Current search result index */
  currentSearchIndex: number;
  /** Selected text range */
  selectedRange?: {
    start: number;
    end: number;
    segmentId: string;
  };
  /** Display preferences */
  displayPreferences: TranscriptionDisplayPreferences;
  /** Scroll position */
  scrollPosition: number;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error?: string;
}

/**
 * Transcription viewer actions
 */
export interface TranscriptionViewerActions {
  /** Search in transcription */
  search: (query: string) => void;
  /** Navigate to next search result */
  nextSearchResult: () => void;
  /** Navigate to previous search result */
  previousSearchResult: () => void;
  /** Clear search */
  clearSearch: () => void;
  /** Navigate to timestamp */
  navigateToTimestamp: (timestamp: number) => void;
  /** Select text */
  selectText: (start: number, end: number, segmentId: string) => void;
  /** Clear text selection */
  clearSelection: () => void;
  /** Update display preferences */
  updateDisplayPreferences: (preferences: Partial<TranscriptionDisplayPreferences>) => void;
  /** Export transcription */
  exportTranscription: (format: ExportFormat, options?: ExportContentOptions) => Promise<void>;
}
