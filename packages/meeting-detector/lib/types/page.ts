/**
 * Page Analysis Types
 * Defines types for page structure analysis and DOM interaction
 */

import type { DetectionStatus } from './index';

/**
 * Meeting platform enumeration
 */
export type MeetingPlatform = 'sharepoint' | 'teams' | 'unknown';

/**
 * Result of page analysis operation
 */
export interface PageAnalysisResult {
  /** URL of analyzed page */
  url: string;
  /** Detected platform type */
  platform: MeetingPlatform;
  /** Whether this is a meeting page */
  isMeetingPage?: boolean | undefined;
  /** Page structure indicators found */
  indicators: ContentIndicator[];
  /** DOM elements relevant to meeting content */
  elements: AnalyzedElement[];
  /** Analysis confidence score (0-1) */
  confidence: number;
  /** Analysis status */
  status: DetectionStatus;
  /** Time taken for analysis (ms) */
  analysisTime: number;
  /** Any errors encountered */
  errors: AnalysisError[];
  /** Page metadata */
  pageMetadata: PageMetadata;
}

/**
 * Content indicator for meeting detection
 */
export interface ContentIndicator {
  /** Type of indicator */
  type: IndicatorType;
  /** Indicator strength/confidence (0-1) */
  strength: number;
  /** DOM selector where indicator was found */
  selector: string;
  /** Text content that triggered indicator */
  content?: string | undefined;
  /** Additional context information */
  context?: Record<string, unknown> | undefined;
  /** Position in page analysis priority */
  priority: IndicatorPriority;
}

/**
 * DOM selector configuration for finding elements
 */
export interface DOMSelector {
  /** CSS selector string */
  selector: string;
  /** Selector description */
  description: string;
  /** Platform this selector applies to */
  platform: MeetingPlatform | 'all';
  /** Element type this selector targets */
  elementType: ElementType;
  /** Whether this is a required selector */
  required: boolean;
  /** Fallback selectors if primary fails */
  fallbacks?: string[] | undefined;
  /** Validation function name */
  validator?: string | undefined;
}

/**
 * Analyzed DOM element information
 */
export interface AnalyzedElement {
  /** Element tag name */
  tagName: string;
  /** Element classes */
  classes: string[];
  /** Element ID */
  id?: string | undefined;
  /** Element text content */
  textContent: string;
  /** Element attributes */
  attributes: Record<string, string>;
  /** CSS selector path to element */
  selector: string;
  /** Element type classification */
  elementType: ElementType;
  /** Relevance score for meeting detection */
  relevance: number;
  /** Child elements */
  children?: AnalyzedElement[] | undefined;
}

/**
 * Page metadata information
 */
export interface PageMetadata {
  /** Page title */
  title: string;
  /** Page URL */
  url: string;
  /** Meta description */
  description?: string | undefined;
  /** Page language */
  language?: string | undefined;
  /** Last modified date */
  lastModified?: Date | undefined;
  /** Page load time */
  loadTime: number;
  /** Document ready state */
  readyState: string;
  /** Viewport dimensions */
  viewport: {
    width: number;
    height: number;
  };
  /** User agent information */
  userAgent: string;
}

/**
 * Analysis error information
 */
export interface AnalysisError {
  /** Error code */
  code: AnalysisErrorCode;
  /** Error message */
  message: string;
  /** Selector that caused error */
  selector?: string | undefined;
  /** Element that caused error */
  element?: string | undefined;
  /** Stack trace */
  stack?: string | undefined;
}

/**
 * Page change monitoring configuration
 */
export interface PageMonitorConfig {
  /** Elements to monitor for changes */
  watchSelectors: string[];
  /** Debounce time for change detection (ms) */
  debounceMs: number;
  /** Maximum number of change events to track */
  maxEvents: number;
  /** Whether to monitor attribute changes */
  attributeChanges: boolean;
  /** Whether to monitor child list changes */
  childListChanges: boolean;
  /** Whether to monitor subtree changes */
  subtreeChanges: boolean;
}

/**
 * Page change event
 */
export interface PageChangeEvent {
  /** Type of change detected */
  type: ChangeType;
  /** CSS selector of changed element */
  selector: string;
  /** Change timestamp */
  timestamp: Date;
  /** Old value (for attribute changes) */
  oldValue?: string | undefined;
  /** New value (for attribute changes) */
  newValue?: string | undefined;
  /** Added nodes (for childList changes) */
  addedNodes?: Node[] | undefined;
  /** Removed nodes (for childList changes) */
  removedNodes?: Node[] | undefined;
}

/**
 * SharePoint page structure patterns
 */
export interface SharePointPagePattern {
  /** Pattern name */
  name: string;
  /** Pattern description */
  description: string;
  /** CSS selectors that identify this pattern */
  selectors: DOMSelector[];
  /** SharePoint version compatibility */
  versions: SharePointVersion[];
  /** Confidence weight for this pattern */
  confidence: number;
  /** Meeting content indicators */
  meetingIndicators: string[];
}

/**
 * Teams page structure patterns
 */
export interface TeamsPagePattern {
  /** Pattern name */
  name: string;
  /** Pattern description */
  description: string;
  /** CSS selectors that identify this pattern */
  selectors: DOMSelector[];
  /** Teams interface type */
  interfaceType: TeamsInterfaceType;
  /** Confidence weight for this pattern */
  confidence: number;
  /** Meeting content indicators */
  meetingIndicators: string[];
}

// Enums and types

/**
 * Content indicator types
 */
export type IndicatorType =
  | 'meeting_title'
  | 'recording_link'
  | 'participant_list'
  | 'meeting_date'
  | 'audio_player'
  | 'video_player'
  | 'download_button'
  | 'transcript_content'
  | 'meeting_metadata'
  | 'sharepoint_library'
  | 'teams_channel'
  | 'meeting_organizer'
  | 'duration_info';

/**
 * Indicator priority levels
 */
export type IndicatorPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * DOM element types
 */
export type ElementType =
  | 'media_player'
  | 'download_link'
  | 'metadata_container'
  | 'participant_list'
  | 'navigation_element'
  | 'content_area'
  | 'sidebar'
  | 'toolbar'
  | 'form_element'
  | 'text_content';

/**
 * Analysis error codes
 */
export type AnalysisErrorCode =
  | 'selector_not_found'
  | 'element_not_accessible'
  | 'parsing_failed'
  | 'dom_not_ready'
  | 'security_error'
  | 'timeout'
  | 'invalid_content';

/**
 * Page change types
 */
export type ChangeType = 'element_added' | 'element_removed' | 'attribute_changed' | 'text_changed' | 'style_changed';

/**
 * SharePoint version types
 */
export type SharePointVersion = 'sharepoint_2019' | 'sharepoint_online' | 'sharepoint_2016' | 'unknown';

/**
 * Teams interface types
 */
export type TeamsInterfaceType = 'web_client' | 'desktop_client' | 'mobile_web' | 'embedded';

/**
 * Page analysis statistics
 */
export interface PageAnalysisStats {
  /** Total elements analyzed */
  totalElements: number;
  /** Elements found with meeting indicators */
  relevantElements: number;
  /** Time spent on DOM traversal (ms) */
  traversalTime: number;
  /** Time spent on pattern matching (ms) */
  patternMatchingTime: number;
  /** Number of selectors evaluated */
  selectorsEvaluated: number;
  /** Number of patterns matched */
  patternsMatched: number;
  /** Memory usage during analysis */
  memoryUsage?: number | undefined;
}
