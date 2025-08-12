/**
 * Chrome Extension specific types for the Meeting Summarizer
 * Provides type definitions for Chrome Extension APIs, storage schemas,
 * message passing, and background service communication.
 */

import type { MeetingRecord, ActionItem } from './meeting.js';
import type { AzureSpeechConfig } from './azure.js';

/**
 * Chrome Extension message types for inter-component communication
 */
export type ExtensionMessageType = 
  | 'MEETING_DETECTED'
  | 'START_TRANSCRIPTION'
  | 'STOP_TRANSCRIPTION'
  | 'TRANSCRIPTION_COMPLETE'
  | 'TRANSCRIPTION_ERROR'
  | 'SAVE_MEETING'
  | 'GET_MEETINGS'
  | 'DELETE_MEETING'
  | 'UPDATE_CONFIG'
  | 'GET_CONFIG'
  | 'NOTIFICATION_SHOW'
  | 'TAB_UPDATED'
  | 'STORAGE_CHANGED'
  | 'CONTEXT_MENU_CLICKED'
  | 'SIDE_PANEL_OPENED'
  | 'SERVICE_WORKER_READY';

/**
 * Background service worker status
 */
export type ServiceWorkerStatus = 'active' | 'inactive' | 'installing' | 'error';

/**
 * Extension notification types
 */
export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'progress';

/**
 * Chrome storage area types
 */
export type StorageArea = 'local' | 'sync' | 'session' | 'managed';

/**
 * Chrome storage keys used by the extension
 */
export interface ChromeStorageKeys {
  /** Meeting records storage key */
  meetings: 'meetings';
  /** Azure Speech configuration key */
  azureConfig: 'azureConfig';
  /** User preferences key */
  userPreferences: 'userPreferences';
  /** Transcription cache key */
  transcriptionCache: 'transcriptionCache';
  /** URL hash cache for duplicate detection */
  urlHashCache: 'urlHashCache';
  /** Extension settings key */
  extensionSettings: 'extensionSettings';
  /** Authentication tokens key */
  authTokens: 'authTokens';
  /** Analytics data key */
  analyticsData: 'analyticsData';
}

/**
 * Complete Chrome Extension storage schema
 */
export interface ExtensionStorageSchema {
  /** Meeting records indexed by meeting ID */
  meetings: Record<string, MeetingRecord>;
  /** Azure Speech Service configuration */
  azureConfig?: AzureSpeechConfig;
  /** User preferences and settings */
  userPreferences: UserPreferences;
  /** Cached transcription results for performance */
  transcriptionCache: Record<string, CachedTranscription>;
  /** URL hash cache for duplicate detection */
  urlHashCache: Record<string, string>;
  /** Extension-specific settings */
  extensionSettings: ExtensionSettings;
  /** Authentication tokens for external services */
  authTokens?: AuthTokens;
  /** Analytics and usage data */
  analyticsData: AnalyticsData;
}

/**
 * User preferences and configuration
 */
export interface UserPreferences {
  /** Preferred language for transcription */
  defaultLanguage: string;
  /** Auto-start transcription when meeting detected */
  autoStartTranscription: boolean;
  /** Show desktop notifications */
  enableNotifications: boolean;
  /** Automatically save transcriptions */
  autoSaveTranscriptions: boolean;
  /** Enable speaker diarization by default */
  enableSpeakerDiarization: boolean;
  /** Default transcription quality setting */
  transcriptionQuality: 'fast' | 'balanced' | 'accurate';
  /** Theme preference */
  theme: 'light' | 'dark' | 'system';
  /** Maximum storage size in MB */
  maxStorageSize: number;
  /** Data retention period in days */
  dataRetentionDays: number;
  /** Privacy settings */
  privacySettings: PrivacySettings;
  /** Keyboard shortcuts */
  keyboardShortcuts: KeyboardShortcuts;
}

/**
 * Privacy and security settings
 */
export interface PrivacySettings {
  /** Share usage analytics */
  shareAnalytics: boolean;
  /** Store transcriptions locally only */
  localStorageOnly: boolean;
  /** Encrypt sensitive data */
  encryptData: boolean;
  /** Auto-delete transcriptions after retention period */
  autoDeleteOldData: boolean;
  /** Require confirmation for data sharing */
  confirmDataSharing: boolean;
}

/**
 * Keyboard shortcuts configuration
 */
export interface KeyboardShortcuts {
  /** Start/stop transcription shortcut */
  toggleTranscription: string;
  /** Open side panel shortcut */
  openSidePanel: string;
  /** Save current meeting shortcut */
  saveMeeting: string;
  /** Quick summary shortcut */
  quickSummary: string;
}

/**
 * Extension-specific settings
 */
export interface ExtensionSettings {
  /** Extension version */
  version: string;
  /** Installation timestamp */
  installedAt: string;
  /** Last update timestamp */
  lastUpdatedAt: string;
  /** Feature flags */
  featureFlags: FeatureFlags;
  /** Debug mode enabled */
  debugMode: boolean;
  /** Telemetry collection enabled */
  telemetryEnabled: boolean;
  /** Update channel preference */
  updateChannel: 'stable' | 'beta' | 'dev';
}

/**
 * Feature flags for gradual rollout
 */
export interface FeatureFlags {
  /** Enable real-time transcription */
  realTimeTranscription: boolean;
  /** Enable AI summarization */
  aiSummarization: boolean;
  /** Enable action item extraction */
  actionItemExtraction: boolean;
  /** Enable multi-language support */
  multiLanguageSupport: boolean;
  /** Enable batch processing */
  batchProcessing: boolean;
  /** Enable speaker identification */
  speakerIdentification: boolean;
  /** Enable sentiment analysis */
  sentimentAnalysis: boolean;
}

/**
 * Cached transcription data for performance optimization
 */
export interface CachedTranscription {
  /** Meeting ID associated with this cache */
  meetingId: string;
  /** Cached transcription text */
  transcriptionText: string;
  /** Cache timestamp */
  cachedAt: string;
  /** Cache expiry timestamp */
  expiresAt: string;
  /** Cache hit count */
  hitCount: number;
  /** File size of cached data */
  dataSize: number;
  /** Checksum for data integrity */
  checksum: string;
}

/**
 * Authentication tokens for external services
 */
export interface AuthTokens {
  /** Azure access token */
  azureToken?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
    tokenType: string;
  };
  /** SharePoint access token */
  sharepointToken?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
    scope: string[];
  };
  /** Microsoft Graph token */
  graphToken?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
    scope: string[];
  };
}

/**
 * Analytics and usage tracking data
 */
export interface AnalyticsData {
  /** Extension usage statistics */
  usageStats: UsageStatistics;
  /** Error tracking data */
  errorTracking: ErrorTrackingData;
  /** Performance metrics */
  performanceMetrics: PerformanceMetrics;
  /** Feature usage tracking */
  featureUsage: FeatureUsageStats;
}

/**
 * Extension usage statistics
 */
export interface UsageStatistics {
  /** Total meetings processed */
  totalMeetings: number;
  /** Total transcription time in minutes */
  totalTranscriptionTime: number;
  /** Number of sessions */
  sessionCount: number;
  /** Average session duration in minutes */
  averageSessionDuration: number;
  /** Daily active usage */
  dailyUsage: Record<string, number>;
  /** Weekly active usage */
  weeklyUsage: Record<string, number>;
  /** Most used features */
  popularFeatures: Record<string, number>;
}

/**
 * Error tracking and diagnostics
 */
export interface ErrorTrackingData {
  /** Recent errors */
  recentErrors: ErrorReport[];
  /** Error frequency by type */
  errorFrequency: Record<string, number>;
  /** Critical errors count */
  criticalErrorCount: number;
  /** Last error timestamp */
  lastErrorAt?: string;
}

/**
 * Individual error report
 */
export interface ErrorReport {
  /** Error identifier */
  errorId: string;
  /** Error type/category */
  errorType: string;
  /** Error message */
  message: string;
  /** Error stack trace */
  stackTrace?: string;
  /** Timestamp when error occurred */
  timestamp: string;
  /** User action that triggered error */
  userAction?: string;
  /** Extension state when error occurred */
  extensionState?: Record<string, unknown>;
}

/**
 * Performance metrics tracking
 */
export interface PerformanceMetrics {
  /** Average transcription processing time */
  avgTranscriptionTime: number;
  /** Memory usage statistics */
  memoryUsage: MemoryUsageStats;
  /** Storage usage statistics */
  storageUsage: StorageUsageStats;
  /** Network performance metrics */
  networkMetrics: NetworkMetrics;
  /** Extension load time metrics */
  loadTimeMetrics: LoadTimeMetrics;
}

/**
 * Memory usage statistics
 */
export interface MemoryUsageStats {
  /** Current memory usage in MB */
  currentUsage: number;
  /** Peak memory usage in MB */
  peakUsage: number;
  /** Average memory usage in MB */
  averageUsage: number;
  /** Memory usage trend */
  usageTrend: 'increasing' | 'stable' | 'decreasing';
}

/**
 * Storage usage statistics
 */
export interface StorageUsageStats {
  /** Total storage used in MB */
  totalUsed: number;
  /** Storage quota in MB */
  quota: number;
  /** Storage usage percentage */
  usagePercentage: number;
  /** Storage by data type */
  byDataType: Record<string, number>;
}

/**
 * Network performance metrics
 */
export interface NetworkMetrics {
  /** Average API response time in ms */
  avgResponseTime: number;
  /** Request success rate percentage */
  successRate: number;
  /** Total API requests made */
  totalRequests: number;
  /** Failed requests count */
  failedRequests: number;
  /** Bandwidth usage in KB */
  bandwidthUsage: number;
}

/**
 * Extension load time metrics
 */
export interface LoadTimeMetrics {
  /** Service worker initialization time in ms */
  serviceWorkerInit: number;
  /** Content script injection time in ms */
  contentScriptInit: number;
  /** UI component load time in ms */
  uiLoadTime: number;
  /** Extension ready time in ms */
  extensionReadyTime: number;
}

/**
 * Feature usage statistics
 */
export interface FeatureUsageStats {
  /** Transcription feature usage */
  transcription: FeatureUsage;
  /** Summarization feature usage */
  summarization: FeatureUsage;
  /** Action item extraction usage */
  actionItems: FeatureUsage;
  /** Side panel usage */
  sidePanel: FeatureUsage;
  /** Settings page usage */
  settings: FeatureUsage;
}

/**
 * Individual feature usage tracking
 */
export interface FeatureUsage {
  /** Number of times feature was used */
  usageCount: number;
  /** Last time feature was used */
  lastUsedAt: string;
  /** Total time spent using feature in seconds */
  totalTimeSpent: number;
  /** User satisfaction rating (1-5) */
  satisfactionRating?: number;
}

/**
 * Chrome Extension message structure
 */
export interface ExtensionMessage<T = unknown> {
  /** Message type identifier */
  type: ExtensionMessageType;
  /** Message payload data */
  payload: T;
  /** Sender information */
  sender?: MessageSender;
  /** Message timestamp */
  timestamp: string;
  /** Request ID for response correlation */
  requestId?: string;
  /** Whether response is expected */
  expectsResponse?: boolean;
}

/**
 * Message sender information
 */
export interface MessageSender {
  /** Sender component type */
  component: 'content-script' | 'background' | 'popup' | 'side-panel' | 'options';
  /** Tab ID if sent from content script */
  tabId?: number;
  /** Frame ID if sent from frame */
  frameId?: number;
  /** URL of sender if applicable */
  url?: string;
}

/**
 * Chrome Extension notification configuration
 */
export interface ExtensionNotification {
  /** Notification ID */
  id: string;
  /** Notification type */
  type: NotificationType;
  /** Notification title */
  title: string;
  /** Notification message */
  message: string;
  /** Icon URL for notification */
  iconUrl?: string;
  /** Notification actions */
  actions?: NotificationAction[];
  /** Auto-hide timeout in milliseconds */
  timeout?: number;
  /** Progress value for progress notifications (0-100) */
  progress?: number;
  /** Additional data attached to notification */
  data?: Record<string, unknown>;
}

/**
 * Notification action button
 */
export interface NotificationAction {
  /** Action identifier */
  id: string;
  /** Action button title */
  title: string;
  /** Action icon URL */
  iconUrl?: string;
}

/**
 * Chrome context menu item configuration
 */
export interface ContextMenuItem {
  /** Menu item ID */
  id: string;
  /** Menu item title */
  title: string;
  /** Menu item contexts where it appears */
  contexts: chrome.contextMenus.ContextType[];
  /** Parent menu item ID for submenus */
  parentId?: string;
  /** Menu item icon */
  icons?: Record<string, string>;
  /** Whether item is enabled */
  enabled: boolean;
  /** Whether item is visible */
  visible: boolean;
  /** Click handler function name */
  onclick?: string;
}

/**
 * Tab information for extension operations
 */
export interface ExtensionTab {
  /** Chrome tab ID */
  tabId: number;
  /** Tab URL */
  url: string;
  /** Tab title */
  title: string;
  /** Whether tab is active */
  active: boolean;
  /** Whether meeting is detected on this tab */
  hasMeeting: boolean;
  /** Transcription status for this tab */
  transcriptionStatus: 'idle' | 'active' | 'paused' | 'error';
  /** Last activity timestamp */
  lastActivity: string;
}

/**
 * Service worker state and status
 */
export interface ServiceWorkerState {
  /** Service worker status */
  status: ServiceWorkerStatus;
  /** Installation timestamp */
  installedAt: string;
  /** Last activity timestamp */
  lastActivity: string;
  /** Active connections count */
  activeConnections: number;
  /** Pending tasks count */
  pendingTasks: number;
  /** Memory usage in MB */
  memoryUsage: number;
  /** Service worker version */
  version: string;
}

/**
 * Extension permissions and capabilities
 */
export interface ExtensionPermissions {
  /** Required permissions */
  required: chrome.permissions.Permissions;
  /** Optional permissions */
  optional: chrome.permissions.Permissions;
  /** Currently granted permissions */
  granted: chrome.permissions.Permissions;
  /** Permissions that can be requested at runtime */
  requestable: chrome.permissions.Permissions;
}

/**
 * Storage operation result
 */
export interface StorageResult<T = unknown> {
  /** Whether operation was successful */
  success: boolean;
  /** Result data if successful */
  data?: T;
  /** Error message if failed */
  error?: string;
  /** Operation timestamp */
  timestamp: string;
  /** Storage area used */
  storageArea: StorageArea;
  /** Data size in bytes */
  dataSize?: number;
}