/**
 * Options Page State Types
 *
 * Type definitions for options page state management, including
 * Azure API configuration, validation, storage management, and user preferences.
 */

import type { AzureSpeechConfig, AzureRegion, MeetingRecord } from '@extension/shared';

/**
 * Represents the current tab or section in the options page
 */
export type OptionsView = 'azure' | 'preferences' | 'storage' | 'about';

/**
 * Configuration test result status
 */
export type TestStatus = 'idle' | 'testing' | 'success' | 'failure';

/**
 * Validation severity levels
 */
export type ValidationSeverity = 'error' | 'warning' | 'info';

/**
 * Complete options page state containing all configuration and UI data
 */
export interface OptionsPageState {
  /** Azure Speech Service configuration */
  azureConfig: AzureSpeechConfig;
  /** Whether current configuration is valid */
  isConfigValid: boolean;
  /** Configuration test results */
  testResults?: ConfigTestResult;
  /** Storage usage statistics */
  storageStats: StorageStatistics;
  /** User preferences for extension behavior */
  userPreferences: UserPreferences;
  /** Whether form has unsaved changes */
  isDirty: boolean;
  /** Form validation errors */
  validationErrors: ValidationError[];
  /** Current active view in options */
  currentView: OptionsView;
  /** Loading state for async operations */
  isLoading: boolean;
  /** Current error state if any */
  error?: OptionsError;
  /** Form submission state */
  isSubmitting: boolean;
  /** Last save timestamp */
  lastSaved?: Date;
  /** Available regions for Azure configuration */
  availableRegions: AzureRegionInfo[];
  /** Supported languages for transcription */
  supportedLanguages: LanguageOption[];
}

/**
 * Azure API configuration form state
 */
export interface ConfigurationForm {
  /** Azure subscription key */
  subscriptionKey: string;
  /** Azure service region */
  region: AzureRegion;
  /** Default transcription language */
  language: string;
  /** Custom endpoint URL */
  endpoint?: string;
  /** Enable diagnostic logging */
  enableLogging: boolean;
  /** Enable advanced features */
  enableAdvancedFeatures: boolean;
  /** Timeout configuration in seconds */
  timeoutSeconds: number;
  /** Retry attempts for failed requests */
  retryAttempts: number;
  /** Connection test status */
  testStatus: TestStatus;
  /** Form validation state */
  validationState: FormValidationState;
}

/**
 * Form validation state for real-time feedback
 */
export interface FormValidationState {
  /** Whether form is currently being validated */
  isValidating: boolean;
  /** Whether all fields are valid */
  isValid: boolean;
  /** Field-specific validation states */
  fieldValidation: Record<string, FieldValidation>;
  /** Form-level validation messages */
  formMessages: ValidationMessage[];
  /** Last validation timestamp */
  lastValidated?: Date;
}

/**
 * Individual field validation state
 */
export interface FieldValidation {
  /** Whether field is valid */
  isValid: boolean;
  /** Whether field is currently being validated */
  isValidating: boolean;
  /** Validation messages for this field */
  messages: ValidationMessage[];
  /** Whether field has been touched by user */
  isTouched: boolean;
  /** Field value at last validation */
  lastValidatedValue?: string;
}

/**
 * Validation message with severity and context
 */
export interface ValidationMessage {
  /** Message severity level */
  severity: ValidationSeverity;
  /** Human-readable message */
  message: string;
  /** Error code for programmatic handling */
  code?: string;
  /** Field name this message relates to */
  field?: string;
  /** Additional context or help text */
  context?: string;
  /** Suggested fix or action */
  suggestion?: string;
}

/**
 * Configuration test result information
 */
export interface ConfigTestResult {
  /** Test execution status */
  status: TestStatus;
  /** Test start timestamp */
  startTime: Date;
  /** Test completion timestamp */
  endTime?: Date;
  /** Test duration in milliseconds */
  duration?: number;
  /** Whether test was successful */
  success: boolean;
  /** Test result message */
  message: string;
  /** Detailed test results */
  details?: TestDetails;
  /** Error information if test failed */
  error?: TestError;
  /** Performance metrics from test */
  metrics?: TestMetrics;
}

/**
 * Detailed test execution information
 */
export interface TestDetails {
  /** Connection test results */
  connection: {
    success: boolean;
    latency: number;
    endpoint: string;
  };
  /** Authentication test results */
  authentication: {
    success: boolean;
    keyValid: boolean;
    permissions: string[];
  };
  /** Service availability test */
  service: {
    available: boolean;
    version: string;
    features: string[];
  };
  /** Region-specific test results */
  region: {
    optimal: boolean;
    latency: number;
    alternatives: AzureRegion[];
  };
}

/**
 * Test error information
 */
export interface TestError {
  /** Error type */
  type: 'network' | 'authentication' | 'configuration' | 'service' | 'unknown';
  /** Error code from Azure API */
  code?: string;
  /** Detailed error message */
  message: string;
  /** Technical error details */
  details?: string;
  /** Suggested resolution steps */
  resolution?: string[];
  /** Whether error is recoverable */
  recoverable: boolean;
}

/**
 * Test performance metrics
 */
export interface TestMetrics {
  /** Connection establishment time */
  connectionTime: number;
  /** Authentication time */
  authTime: number;
  /** Total test duration */
  totalTime: number;
  /** Network latency */
  latency: number;
  /** Bandwidth estimation */
  bandwidth?: number;
}

/**
 * Storage usage statistics and management
 */
export interface StorageStatistics {
  /** Total storage used in bytes */
  totalUsed: number;
  /** Maximum storage available in bytes */
  totalAvailable: number;
  /** Storage usage percentage */
  usagePercentage: number;
  /** Storage breakdown by category */
  categoryUsage: StorageCategoryUsage[];
  /** Number of stored meetings */
  meetingCount: number;
  /** Number of cached transcriptions */
  cacheCount: number;
  /** Last cleanup timestamp */
  lastCleanup?: Date;
  /** Storage health status */
  healthStatus: 'healthy' | 'warning' | 'critical';
  /** Optimization recommendations */
  recommendations: StorageRecommendation[];
}

/**
 * Storage usage by category
 */
export interface StorageCategoryUsage {
  /** Category identifier */
  category: 'meetings' | 'transcriptions' | 'cache' | 'config' | 'logs';
  /** Category display name */
  name: string;
  /** Bytes used by this category */
  bytesUsed: number;
  /** Percentage of total storage */
  percentage: number;
  /** Number of items in category */
  itemCount: number;
  /** Whether category can be cleaned */
  cleanable: boolean;
}

/**
 * Storage optimization recommendation
 */
export interface StorageRecommendation {
  /** Recommendation type */
  type: 'cleanup' | 'archive' | 'compress' | 'delete';
  /** Priority level */
  priority: 'high' | 'medium' | 'low';
  /** Description of recommendation */
  description: string;
  /** Estimated storage savings in bytes */
  estimatedSavings: number;
  /** Action required from user */
  action: string;
  /** Whether action is automatically available */
  autoAction: boolean;
}

/**
 * User preferences for extension behavior
 */
export interface UserPreferences {
  /** General behavior preferences */
  general: GeneralPreferences;
  /** Transcription-specific preferences */
  transcription: TranscriptionPreferences;
  /** Notification preferences */
  notifications: NotificationPreferences;
  /** Privacy and security preferences */
  privacy: PrivacyPreferences;
  /** UI and accessibility preferences */
  interface: InterfacePreferences;
  /** Export and sharing preferences */
  export: ExportPreferences;
}

/**
 * General extension behavior preferences
 */
export interface GeneralPreferences {
  /** Auto-start transcription when meeting detected */
  autoStartTranscription: boolean;
  /** Auto-save transcriptions */
  autoSaveTranscriptions: boolean;
  /** Default transcription language */
  defaultLanguage: string;
  /** Keep extension active in background */
  keepActive: boolean;
  /** Check for updates automatically */
  autoUpdate: boolean;
  /** Send anonymous usage statistics */
  allowAnalytics: boolean;
}

/**
 * Transcription behavior preferences
 */
export interface TranscriptionPreferences {
  /** Audio quality preference */
  audioQuality: 'high' | 'balanced' | 'fast';
  /** Enable speaker identification */
  enableSpeakerIdentification: boolean;
  /** Enable profanity filtering */
  filterProfanity: boolean;
  /** Enable punctuation auto-correction */
  autoCorrectPunctuation: boolean;
  /** Confidence threshold for transcription */
  confidenceThreshold: number;
  /** Maximum transcription duration in minutes */
  maxDuration: number;
  /** Enable real-time transcription preview */
  realtimePreview: boolean;
}

/**
 * Notification preferences
 */
export interface NotificationPreferences {
  /** Enable desktop notifications */
  enableDesktop: boolean;
  /** Enable in-browser notifications */
  enableInBrowser: boolean;
  /** Enable sound notifications */
  enableSound: boolean;
  /** Notification types to show */
  types: NotificationType[];
  /** Quiet hours for notifications */
  quietHours?: {
    enabled: boolean;
    startTime: string;
    endTime: string;
  };
}

/**
 * Notification type configuration
 */
export interface NotificationType {
  /** Type identifier */
  type: 'completion' | 'error' | 'warning' | 'info';
  /** Whether this type is enabled */
  enabled: boolean;
  /** Display priority */
  priority: 'high' | 'normal' | 'low';
  /** Auto-dismiss timeout in seconds */
  timeout?: number;
}

/**
 * Privacy and security preferences
 */
export interface PrivacyPreferences {
  /** Store transcriptions locally only */
  localStorageOnly: boolean;
  /** Automatically delete old transcriptions */
  autoDeleteOld: boolean;
  /** Days to keep transcriptions */
  retentionDays: number;
  /** Encrypt stored data */
  encryptStorage: boolean;
  /** Require confirmation for data export */
  confirmExport: boolean;
  /** Allow crash reporting */
  allowCrashReports: boolean;
}

/**
 * Interface and accessibility preferences
 */
export interface InterfacePreferences {
  /** UI theme preference */
  theme: 'light' | 'dark' | 'auto';
  /** Interface language */
  language: string;
  /** Enable compact mode */
  compactMode: boolean;
  /** Font size preference */
  fontSize: 'small' | 'medium' | 'large';
  /** Enable high contrast mode */
  highContrast: boolean;
  /** Enable reduced motion */
  reducedMotion: boolean;
  /** Show tooltips and help text */
  showTooltips: boolean;
}

/**
 * Export and sharing preferences
 */
export interface ExportPreferences {
  /** Default export format */
  defaultFormat: 'text' | 'json' | 'pdf' | 'docx';
  /** Include metadata in exports */
  includeMetadata: boolean;
  /** Include timestamps in exports */
  includeTimestamps: boolean;
  /** Include speaker names in exports */
  includeSpeakers: boolean;
  /** Default export location */
  defaultLocation: 'downloads' | 'documents' | 'custom';
  /** Custom export path */
  customPath?: string;
}

/**
 * Validation error information
 */
export interface ValidationError {
  /** Field name with error */
  field: string;
  /** Error type */
  type: 'required' | 'format' | 'range' | 'custom';
  /** Human-readable error message */
  message: string;
  /** Error severity */
  severity: ValidationSeverity;
  /** Error code for programmatic handling */
  code?: string;
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Options page error information
 */
export interface OptionsError {
  /** Error type */
  type: 'save' | 'load' | 'validation' | 'network' | 'storage' | 'unknown';
  /** User-friendly error message */
  message: string;
  /** Technical error details */
  details?: string;
  /** Error code if available */
  code?: string;
  /** Timestamp when error occurred */
  timestamp: Date;
  /** Whether error is recoverable */
  recoverable: boolean;
  /** Suggested recovery actions */
  recoveryActions?: string[];
  /** Stack trace for debugging */
  stack?: string;
}

/**
 * Azure region information
 */
export interface AzureRegionInfo {
  /** Region identifier */
  id: AzureRegion;
  /** Human-readable region name */
  name: string;
  /** Region description */
  description: string;
  /** Whether region is recommended for user */
  recommended: boolean;
  /** Estimated latency from user location */
  estimatedLatency?: number;
  /** Available features in this region */
  features: string[];
  /** Region status */
  status: 'available' | 'limited' | 'unavailable';
}

/**
 * Supported language option
 */
export interface LanguageOption {
  /** Language code (BCP 47) */
  code: string;
  /** Language display name */
  name: string;
  /** Native language name */
  nativeName: string;
  /** Whether language is commonly used */
  popular: boolean;
  /** Language family or group */
  family?: string;
  /** Quality rating for this language */
  quality: 'excellent' | 'good' | 'fair' | 'limited';
  /** Special features supported */
  features: string[];
}

/**
 * Options page state update actions
 */
export interface OptionsStateActions {
  /** Update Azure configuration */
  updateAzureConfig: (config: Partial<AzureSpeechConfig>) => void;
  /** Update user preferences */
  updatePreferences: (preferences: Partial<UserPreferences>) => void;
  /** Set current view */
  setView: (view: OptionsView) => void;
  /** Run configuration test */
  testConfiguration: () => Promise<ConfigTestResult>;
  /** Save all changes */
  saveChanges: () => Promise<void>;
  /** Reset to defaults */
  resetToDefaults: () => void;
  /** Clear validation errors */
  clearErrors: () => void;
  /** Set loading state */
  setLoading: (loading: boolean) => void;
  /** Set error state */
  setError: (error: OptionsError | null) => void;
  /** Refresh storage statistics */
  refreshStorageStats: () => Promise<void>;
  /** Clean up storage */
  cleanupStorage: (categories: string[]) => Promise<void>;
  /** Export configuration */
  exportConfig: () => Promise<void>;
  /** Import configuration */
  importConfig: (config: string) => Promise<void>;
}
