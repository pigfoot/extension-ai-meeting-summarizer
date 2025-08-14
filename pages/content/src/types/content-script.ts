/**
 * Content Script Types
 *
 * Type definitions for content script operations including DOM manipulation,
 * event handling, UI injection, and page context management.
 */

/**
 * Represents an injection point where UI components can be inserted into the DOM
 */
export interface InjectionPoint {
  /** Unique identifier for the injection point */
  id: string;
  /** CSS selector to locate the target element */
  selector: string;
  /** Method to use for injecting content */
  method: 'append' | 'prepend' | 'replace' | 'overlay' | 'before' | 'after';
  /** Priority level for injection point selection (higher = preferred) */
  priority: number;
  /** Whether this injection point is currently available */
  isAvailable: boolean;
  /** Validation function to check if injection point is valid */
  validate?: () => boolean;
  /** Fallback injection points if this one fails */
  fallbacks?: InjectionPoint[];
}

/**
 * UI component configuration for injection into host pages
 */
export interface UIComponent {
  /** Type of UI component */
  type: 'transcribe-button' | 'progress-indicator' | 'status-panel' | 'summary-display';
  /** Unique identifier for the component instance */
  id: string;
  /** Target injection point */
  injectionPoint: InjectionPoint;
  /** Component properties */
  props: Record<string, unknown>;
  /** CSS styling configuration */
  styling: {
    /** Whether to isolate styles from host page */
    isolation: boolean;
    /** Whether to adapt to host page theme */
    themeAdaptation: boolean;
    /** Responsive breakpoints for the component */
    responsiveBreakpoints: string[];
    /** Custom CSS classes to apply */
    customClasses?: string[];
  };
  /** Component state */
  state: 'idle' | 'initializing' | 'active' | 'error' | 'destroyed';
  /** Cleanup function for component removal */
  cleanup: () => void;
  /** Event handlers attached to this component */
  eventHandlers: EventHandlerConfig[];
}

/**
 * Page context information for content script operations
 */
export interface PageContext {
  /** Current page URL */
  url: string;
  /** Detected page type */
  pageType: 'sharepoint' | 'teams' | 'outlook' | 'unknown';
  /** Page layout information */
  layout: {
    /** Main content container selector */
    mainContainer: string;
    /** Available injection points */
    injectionPoints: InjectionPoint[];
    /** Page theme information */
    theme: 'light' | 'dark' | 'auto';
    /** Responsive breakpoint currently active */
    breakpoint: 'mobile' | 'tablet' | 'desktop';
  };
  /** Meeting-related content found on page */
  meetingContent: {
    /** Meeting recordings detected */
    recordings: MeetingRecording[];
    /** Meeting metadata available */
    metadata: Record<string, unknown>;
    /** User permissions for content */
    permissions: PermissionSet;
  };
  /** Currently active features */
  activeFeatures: Set<string>;
  /** Page integration status */
  integrationStatus: 'pending' | 'active' | 'error' | 'disabled';
  /** Unique identifier for this page context */
  contextId: string;
}

/**
 * Event handler configuration for DOM event management
 */
export interface EventHandlerConfig {
  /** Event type to listen for */
  eventType: string;
  /** CSS selector for event delegation */
  selector: string;
  /** Event handler function */
  handler: (event: Event) => void;
  /** Event listener options */
  options: AddEventListenerOptions;
  /** Handler priority for conflict resolution */
  priority: number;
  /** Cleanup function to remove event listener */
  cleanup: () => void;
  /** Conflict resolution strategy */
  conflictResolution: 'override' | 'chain' | 'ignore';
  /** Whether this handler is currently active */
  isActive: boolean;
}

/**
 * DOM manipulation utilities interface
 */
export interface DOMManipulator {
  /** Safely inject element into DOM at specified injection point */
  injectElement(element: HTMLElement, injectionPoint: InjectionPoint): boolean;
  /** Remove element from DOM with proper cleanup */
  removeElement(element: HTMLElement): void;
  /** Find optimal injection point from available options */
  findInjectionPoint(candidates: InjectionPoint[]): InjectionPoint | null;
  /** Validate that injection point is still available */
  validateInjectionPoint(injectionPoint: InjectionPoint): boolean;
  /** Create element with proper styling and attributes */
  createElement(config: ElementConfig): HTMLElement;
  /** Apply CSS isolation to prevent style conflicts */
  applyStyleIsolation(element: HTMLElement): void;
}

/**
 * Configuration for creating DOM elements
 */
export interface ElementConfig {
  /** HTML tag name */
  tagName: string;
  /** Element attributes */
  attributes: Record<string, string>;
  /** CSS classes to apply */
  classes: string[];
  /** Inline styles */
  styles: Record<string, string>;
  /** Text content */
  textContent?: string;
  /** Child elements */
  children?: ElementConfig[];
}

/**
 * Meeting recording information
 */
export interface MeetingRecording {
  /** Recording identifier */
  id: string;
  /** Recording title */
  title: string;
  /** Recording URL */
  url: string;
  /** Recording duration in seconds */
  duration?: number;
  /** File format */
  format: 'mp4' | 'mp3' | 'wav' | 'm4a' | 'webm';
  /** File size in bytes */
  size?: number;
  /** Whether recording is accessible to current user */
  isAccessible: boolean;
}

/**
 * User permissions for page content
 */
export interface PermissionSet {
  /** Can view meeting content */
  canView: boolean;
  /** Can download recordings */
  canDownload: boolean;
  /** Can share content with others */
  canShare: boolean;
  /** Can edit meeting metadata */
  canEdit: boolean;
  /** Requires authentication */
  requiresAuth: boolean;
  /** Additional restrictions */
  restrictions: string[];
}

/**
 * Page monitor for detecting dynamic changes
 */
export interface PageMonitor {
  /** Start monitoring page for changes */
  startMonitoring(): void;
  /** Stop monitoring page */
  stopMonitoring(): void;
  /** Check if monitoring is active */
  isMonitoring(): boolean;
  /** Register callback for page changes */
  onPageChange(callback: (changes: PageChange[]) => void): void;
  /** Register callback for new content detection */
  onContentDetection(callback: (content: MeetingRecording[]) => void): void;
}

/**
 * Page change event information
 */
export interface PageChange {
  /** Type of change detected */
  type: 'navigation' | 'content-added' | 'content-removed' | 'layout-change';
  /** Affected DOM elements */
  elements: Element[];
  /** Timestamp of change */
  timestamp: number;
  /** Whether change affects meeting content */
  affectsMeetingContent: boolean;
}

/**
 * Content script lifecycle management
 */
export interface ContentScriptLifecycle {
  /** Initialize content script */
  initialize(context: PageContext): Promise<void>;
  /** Activate features based on page content */
  activate(): Promise<void>;
  /** Deactivate and cleanup resources */
  deactivate(): Promise<void>;
  /** Handle page navigation */
  handleNavigation(newUrl: string): Promise<void>;
  /** Check if content script is active */
  isActive(): boolean;
}
