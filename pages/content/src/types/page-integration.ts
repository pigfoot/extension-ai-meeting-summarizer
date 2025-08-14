/**
 * Page Integration Types
 *
 * Type definitions for page integration context, feature activation,
 * and access control in content scripts.
 */

import type {
  MeetingDetection,
  RecordingPermissions,
  AudioUrlInfo,
  DetectionConfig,
} from '@extension/meeting-detector';

/**
 * Page integration context for content script operations
 * Extends meeting detection with content script specific information
 */
export interface PageIntegrationContext {
  /** Unique identifier for this integration context */
  contextId: string;

  /** Current page URL */
  pageUrl: string;

  /** Page title */
  pageTitle: string;

  /** Detected meeting information */
  meetingDetection: MeetingDetection | null;

  /** Available meeting content on the page */
  availableContent: MeetingContentInfo[];

  /** User access permissions for page content */
  userPermissions: AccessControl;

  /** Current page integration status */
  integrationStatus: IntegrationStatus;

  /** Features available for activation */
  availableFeatures: FeatureDescriptor[];

  /** Currently active features */
  activeFeatures: Set<string>;

  /** Page layout and injection points */
  pageLayout: PageLayoutInfo;

  /** Context creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;

  /** Context metadata */
  metadata: Record<string, unknown>;
}

/**
 * Meeting content information found on the page
 */
export interface MeetingContentInfo {
  /** Content identifier */
  id: string;

  /** Content type */
  type: 'recording' | 'transcript' | 'summary' | 'metadata';

  /** Content title or name */
  title: string;

  /** Content location/URL */
  location: string;

  /** Audio/video information if applicable */
  audioInfo?: AudioUrlInfo;

  /** Content accessibility status */
  accessibility: ContentAccessibility;

  /** User permissions for this content */
  permissions: RecordingPermissions;

  /** Content format and quality */
  format: {
    type: string;
    quality?: string;
    duration?: number;
    size?: number;
  };

  /** Whether content is currently loading */
  isLoading: boolean;

  /** Content discovery confidence */
  confidence: number;
}

/**
 * Feature activation management interface
 */
export interface FeatureActivation {
  /** Feature identifier */
  featureId: string;

  /** Feature display name */
  displayName: string;

  /** Feature description */
  description: string;

  /** Whether feature is currently available */
  isAvailable: boolean;

  /** Whether feature is currently active */
  isActive: boolean;

  /** Activation prerequisites */
  prerequisites: ActivationPrerequisite[];

  /** Feature activation state */
  activationState: ActivationState;

  /** Required permissions for activation */
  requiredPermissions: string[];

  /** Feature configuration */
  config: FeatureConfig;

  /** Feature priority for display ordering */
  priority: number;

  /** Activation timestamp */
  activatedAt?: Date;

  /** Feature usage analytics */
  analytics: FeatureAnalytics;
}

/**
 * Access control for page content and features
 */
export interface AccessControl {
  /** User identity information */
  userInfo: {
    /** User identifier */
    userId?: string;
    /** User display name */
    displayName?: string;
    /** User email */
    email?: string;
    /** User roles */
    roles: string[];
  };

  /** Page-level permissions */
  pagePermissions: {
    /** Can view page content */
    canView: boolean;
    /** Can interact with page elements */
    canInteract: boolean;
    /** Can access meeting content */
    canAccessMeetings: boolean;
    /** Can download recordings */
    canDownload: boolean;
    /** Can share content */
    canShare: boolean;
  };

  /** Content-specific permissions */
  contentPermissions: Map<string, RecordingPermissions>;

  /** Feature access permissions */
  featurePermissions: Map<string, FeaturePermission>;

  /** Authentication status */
  authenticationStatus: AuthenticationStatus;

  /** Permission evaluation timestamp */
  evaluatedAt: Date;

  /** Permission expiration */
  expiresAt?: Date;
}

/**
 * Page layout information for UI injection
 */
export interface PageLayoutInfo {
  /** Page type */
  pageType: 'sharepoint' | 'teams' | 'outlook' | 'unknown';

  /** Layout variant */
  layoutVariant: string;

  /** Main content containers */
  containers: {
    /** Main content area selector */
    main: string;
    /** Sidebar selector */
    sidebar?: string;
    /** Header selector */
    header?: string;
    /** Footer selector */
    footer?: string;
  };

  /** Available injection points */
  injectionPoints: InjectionPointInfo[];

  /** Theme information */
  theme: {
    /** Color scheme */
    colorScheme: 'light' | 'dark' | 'auto';
    /** Theme name */
    themeName?: string;
    /** Custom CSS variables */
    cssVariables: Record<string, string>;
  };

  /** Responsive breakpoint */
  breakpoint: 'mobile' | 'tablet' | 'desktop' | 'wide';

  /** Layout constraints */
  constraints: {
    /** Maximum width for injected content */
    maxWidth?: number;
    /** Available height */
    availableHeight?: number;
    /** Layout restrictions */
    restrictions: string[];
  };
}

/**
 * Injection point information
 */
export interface InjectionPointInfo {
  /** Point identifier */
  id: string;

  /** CSS selector */
  selector: string;

  /** Injection method */
  method: 'append' | 'prepend' | 'replace' | 'overlay';

  /** Point priority */
  priority: number;

  /** Whether point is currently available */
  isAvailable: boolean;

  /** Point validation function */
  validate: () => boolean;

  /** Supported feature types */
  supportedFeatures: string[];

  /** Layout constraints for this point */
  constraints: {
    maxWidth?: number;
    maxHeight?: number;
    positioning: 'static' | 'relative' | 'absolute' | 'fixed';
  };
}

/**
 * Feature descriptor for available functionality
 */
export interface FeatureDescriptor {
  /** Feature identifier */
  id: string;

  /** Feature name */
  name: string;

  /** Feature category */
  category: 'transcription' | 'summarization' | 'analysis' | 'export';

  /** Feature description */
  description: string;

  /** Required capabilities */
  requiredCapabilities: string[];

  /** Compatible content types */
  compatibleContent: string[];

  /** UI component type for this feature */
  componentType: string;

  /** Feature availability conditions */
  availabilityConditions: AvailabilityCondition[];

  /** Default configuration */
  defaultConfig: Record<string, unknown>;
}

/**
 * Feature activation prerequisite
 */
export interface ActivationPrerequisite {
  /** Prerequisite type */
  type: 'permission' | 'content' | 'authentication' | 'capability';

  /** Prerequisite description */
  description: string;

  /** Whether prerequisite is met */
  isMet: boolean;

  /** Prerequisite value or identifier */
  value: string;

  /** How to resolve if not met */
  resolution?: string;
}

/**
 * Feature availability condition
 */
export interface AvailabilityCondition {
  /** Condition type */
  type: 'content-present' | 'permission-granted' | 'capability-available' | 'page-type';

  /** Condition parameters */
  parameters: Record<string, unknown>;

  /** Whether condition is currently satisfied */
  isSatisfied: boolean;

  /** Condition evaluation function */
  evaluate: (context: PageIntegrationContext) => boolean;
}

/**
 * Feature configuration
 */
export interface FeatureConfig {
  /** Feature settings */
  settings: Record<string, unknown>;

  /** UI preferences */
  ui: {
    /** Preferred injection point */
    preferredInjectionPoint?: string;
    /** Display style */
    displayStyle: 'button' | 'panel' | 'overlay' | 'inline';
    /** Size preference */
    size: 'small' | 'medium' | 'large';
  };

  /** Behavior configuration */
  behavior: {
    /** Auto-activation enabled */
    autoActivate: boolean;
    /** Show progress indicators */
    showProgress: boolean;
    /** Enable notifications */
    enableNotifications: boolean;
  };
}

/**
 * Feature permission details
 */
export interface FeaturePermission {
  /** Permission granted */
  granted: boolean;

  /** Permission level */
  level: 'none' | 'read' | 'write' | 'admin';

  /** Permission restrictions */
  restrictions: string[];

  /** Permission source */
  source: 'user' | 'admin' | 'policy' | 'default';

  /** Permission expiration */
  expiresAt?: Date;
}

/**
 * Feature usage analytics
 */
export interface FeatureAnalytics {
  /** Number of times activated */
  activationCount: number;

  /** Last activation time */
  lastActivated?: Date;

  /** Average usage duration */
  averageUsageDuration: number;

  /** Success rate */
  successRate: number;

  /** Common error types */
  errorTypes: string[];
}

// Type unions and enums

/**
 * Content accessibility status
 */
export type ContentAccessibility =
  | 'accessible'
  | 'authentication_required'
  | 'permission_denied'
  | 'not_found'
  | 'loading'
  | 'error';

/**
 * Integration status
 */
export type IntegrationStatus = 'initializing' | 'active' | 'partial' | 'error' | 'disabled';

/**
 * Feature activation state
 */
export type ActivationState = 'unavailable' | 'available' | 'activating' | 'active' | 'deactivating' | 'error';

/**
 * Authentication status
 */
export type AuthenticationStatus = 'authenticated' | 'unauthenticated' | 'expired' | 'pending' | 'error';

/**
 * Context-aware feature activation manager interface
 */
export interface ContextAwareFeatureManager {
  /** Analyze page context and determine available features */
  analyzeContext(detectionConfig: DetectionConfig): Promise<PageIntegrationContext>;

  /** Activate features based on context */
  activateFeatures(context: PageIntegrationContext, featureIds: string[]): Promise<FeatureActivation[]>;

  /** Deactivate features */
  deactivateFeatures(featureIds: string[]): Promise<boolean>;

  /** Update context when page changes */
  updateContext(changes: ContextChange[]): Promise<PageIntegrationContext>;

  /** Get current integration context */
  getCurrentContext(): PageIntegrationContext | null;
}

/**
 * Context change event
 */
export interface ContextChange {
  /** Change type */
  type: 'content-added' | 'content-removed' | 'permission-changed' | 'layout-changed';

  /** Affected elements or data */
  affected: unknown;

  /** Change timestamp */
  timestamp: Date;

  /** Whether change requires feature re-evaluation */
  requiresReEvaluation: boolean;
}
