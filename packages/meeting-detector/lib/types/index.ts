/**
 * Meeting Detector Core Types
 * Provides type definitions for content detection and analysis operations
 */

// Re-export types from other modules for convenience
export type { PageAnalysisResult, ContentIndicator, DOMSelector, MeetingPlatform } from './page';
export type { TenantInfo, SharePointVersion, DomainConfig } from './tenant';
export type {
  MeetingMessage,
  SecuritySettings,
  FeatureFlags,
  SecurityConfig,
  RecordingSpecificPermissions,
  TokenExpirationResult,
  RestrictionHandlingResult,
  VideoInfo,
  StreamVideoInfo,
  EmbeddedPlayerInfo,
  MeetingAnalysisResult,
} from './analyzer';

/**
 * Main meeting detection result interface
 */
export interface MeetingDetection {
  /** Unique identifier for this detection */
  id: string;
  /** Type of meeting platform detected */
  platform: 'sharepoint' | 'teams' | 'unknown';
  /** Confidence score for detection accuracy (0-1) */
  confidence: number;
  /** Whether this is a meeting page */
  isMeetingPage?: boolean | undefined;
  /** Detected meeting metadata */
  metadata: MeetingMetadata;
  /** Audio/video URL information */
  audioInfo: AudioUrlInfo | null;
  /** Detection timestamp */
  detectedAt: Date;
  /** Current detection status */
  status: DetectionStatus;
  /** Domain detection results */
  domainDetection?: unknown;
  /** Page classification results */
  pageClassification?: unknown;
  /** Content indicators results */
  contentIndicators?: unknown;
  /** Teams detection results */
  teamsDetection?: unknown;
  /** Any error that occurred during detection */
  error?: DetectionError | undefined;
}

/**
 * Audio/video URL information extracted from page
 */
export interface AudioUrlInfo {
  /** Direct media URL */
  url: string;
  /** Media format type */
  format: MediaFormat;
  /** File size in bytes (if available) */
  size?: number | undefined;
  /** Duration in seconds (if available) */
  duration?: number | undefined;
  /** Authentication tokens needed for access */
  authTokens?: AuthTokenInfo[] | undefined;
  /** URL accessibility status */
  accessibility: UrlAccessibility;
  /** Quality information */
  quality?: MediaQuality | undefined;
}

/**
 * Meeting metadata extracted from page content
 */
export interface MeetingMetadata {
  /** Meeting title/subject */
  title: string;
  /** Meeting date and time */
  date?: Date | undefined;
  /** Meeting organizer information */
  organizer?: string | undefined;
  /** List of participants */
  participants: string[];
  /** Meeting duration */
  duration?: number | undefined;
  /** Meeting topics/agenda */
  topics: string[];
  /** SharePoint/Teams specific IDs */
  platformIds?:
    | {
        meetingId?: string | undefined;
        threadId?: string | undefined;
        conversationId?: string | undefined;
        channelId?: string | undefined;
      }
    | undefined;
  /** Meeting location/context */
  location?: string | undefined;
  /** Recording permissions */
  permissions?: RecordingPermissions | undefined;
}

/**
 * Authentication token information for protected media
 */
export interface AuthTokenInfo {
  /** Token type (Bearer, Cookie, etc.) */
  type: AuthTokenType;
  /** Token value */
  value: string;
  /** Token expiration time */
  expiresAt?: Date | undefined;
  /** Token scope/domain */
  scope?: string | undefined;
}

/**
 * Recording permissions and access control
 */
export interface RecordingPermissions {
  /** Can current user access recording */
  canAccess: boolean;
  /** Can user download recording */
  canDownload: boolean;
  /** Can user share recording */
  canShare: boolean;
  /** Access restrictions */
  restrictions?: string[] | undefined;
  /** Expiration of access */
  expiresAt?: Date | undefined;
}

/**
 * Media quality information
 */
export interface MediaQuality {
  /** Audio bitrate */
  audioBitrate?: number | undefined;
  /** Video bitrate (if applicable) */
  videoBitrate?: number | undefined;
  /** Sample rate */
  sampleRate?: number | undefined;
  /** Resolution (for video) */
  resolution?: string | undefined;
  /** Codec information */
  codec?: string | undefined;
}

/**
 * Detection error information
 */
export interface DetectionError {
  /** Error code */
  code: DetectionErrorCode;
  /** Human-readable error message */
  message: string;
  /** Technical details */
  details?: string | undefined;
  /** Timestamp when error occurred */
  timestamp: Date;
  /** Whether error is recoverable */
  recoverable: boolean;
}

// Type definitions following project standards

/**
 * Media format types
 */
export type MediaFormat = 'mp4' | 'mp3' | 'wav' | 'm4a' | 'webm' | 'hls' | 'dash' | 'unknown';

/**
 * URL accessibility status
 */
export type UrlAccessibility = 'accessible' | 'authentication_required' | 'permission_denied' | 'not_found' | 'unknown';

/**
 * Authentication token types
 */
export type AuthTokenType = 'bearer' | 'cookie' | 'query_param' | 'header';

/**
 * Detection status
 */
export type DetectionStatus = 'detecting' | 'completed' | 'failed' | 'partial';

/**
 * Detection error codes
 */
export type DetectionErrorCode =
  | 'page_not_loaded'
  | 'no_meeting_content'
  | 'access_denied'
  | 'network_error'
  | 'parsing_error'
  | 'unsupported_platform'
  | 'invalid_url'
  | 'timeout';

/**
 * Detection configuration options
 */
export interface DetectionConfig {
  /** Maximum time to spend on detection (ms) */
  timeoutMs: number;
  /** Whether to include partial results */
  includePartialResults: boolean;
  /** Minimum confidence threshold */
  minConfidence: number;
  /** Whether to extract audio URLs */
  extractAudioUrls: boolean;
  /** Whether to validate URLs */
  validateUrls: boolean;
  /** Custom domain configurations */
  customDomains?: Array<{ domain: string; platform: string; settings: Record<string, unknown> }> | undefined;
  /** Debug mode */
  debug: boolean;
}

/**
 * Analysis workflow configuration
 */
export interface AnalysisWorkflow {
  /** Workflow identifier */
  id: string;
  /** Workflow name */
  name: string;
  /** Workflow steps */
  steps: AnalysisStep[];
  /** Parallel execution allowed */
  allowParallel: boolean;
  /** Timeout configuration */
  timeout: number;
}

/**
 * Analysis workflow step
 */
export interface AnalysisStep {
  /** Step identifier */
  id: string;
  /** Step name */
  name: string;
  /** Step type */
  type: 'detection' | 'extraction' | 'validation' | 'analysis';
  /** Dependencies */
  dependencies: string[];
  /** Configuration */
  config: Record<string, unknown>;
}

/**
 * Detection result analytics
 */
export interface DetectionAnalytics {
  /** Time taken for detection (ms) */
  detectionTimeMs: number;
  /** Number of URLs found */
  urlsFound: number;
  /** Number of accessible URLs */
  accessibleUrls: number;
  /** Confidence distribution */
  confidenceScores: number[];
  /** Platform detection accuracy */
  platformAccuracy: number;
  /** Error rate */
  errorRate: number;
}
