/**
 * Analyzer-specific types for meeting detection
 */

import type { DetectionStatus, MeetingPlatform } from './index';

/**
 * Meeting message from teams chat
 */
export interface MeetingMessage {
  /** Message content */
  content: string;
  /** CSS selector where message was found */
  selector: string;
  /** Message type classification */
  type: string;
  /** Message timestamp */
  timestamp?: Date | undefined;
}

/**
 * Security settings for domain validation
 */
export interface SecuritySettings {
  /** Whether authentication is required */
  requiresAuth?: boolean | undefined;
  /** Allowed origins for security */
  allowedOrigins?: string[] | undefined;
  /** CORS settings */
  corsEnabled?: boolean | undefined;
  /** Security headers required */
  requiredHeaders?: string[] | undefined;
}

/**
 * Feature flags for platform functionality
 */
export interface FeatureFlags {
  /** Whether download is supported */
  supportsDownload?: boolean | undefined;
  /** Whether sharing is supported */
  supportsSharing?: boolean | undefined;
  /** Whether real-time detection is enabled */
  realTimeDetection?: boolean | undefined;
  /** Whether advanced analytics are enabled */
  advancedAnalytics?: boolean | undefined;
  /** Whether recordings are available */
  hasRecordings?: boolean | undefined;
  /** Whether transcripts are available */
  hasTranscripts?: boolean | undefined;
}

/**
 * Security configuration for validation
 */
export interface SecurityConfig {
  /** Allowed origins */
  allowedOrigins?: string[] | undefined;
  /** Required authentication methods */
  requiredAuth?: string[] | undefined;
  /** HTTPS requirement */
  httpsRequired?: boolean | undefined;
  /** Certificate validation */
  validateCertificates?: boolean | undefined;
}

/**
 * Recording-specific permissions
 */
export interface RecordingSpecificPermissions {
  /** Can download the recording */
  canDownload: boolean;
  /** Can share the recording */
  canShare: boolean;
  /** Access restrictions */
  restrictions?: string[] | undefined;
  /** Permission expiration */
  expiresAt?: Date | undefined;
}

/**
 * Token expiration analysis result
 */
export interface TokenExpirationResult {
  /** Whether any tokens have expired */
  hasExpiredTokens: boolean;
  /** Number of expired tokens */
  expiredCount: number;
  /** Earliest expiration date */
  earliestExpiration?: Date | undefined;
}

/**
 * Restriction handling result
 */
export interface RestrictionHandlingResult {
  /** Whether the operation can proceed */
  canProceed: boolean;
  /** Suggested action for user */
  suggestedAction: string;
  /** User-friendly message */
  message: string;
  /** Time to retry after (in seconds) */
  retryAfter?: number | undefined;
  /** Alternative actions */
  alternatives: string[];
}

/**
 * Video information extracted from page
 */
export interface VideoInfo {
  /** Video URL */
  url: string;
  /** Video title */
  title?: string | undefined;
  /** Video duration */
  duration?: number | undefined;
  /** Video format */
  format?: string | undefined;
  /** Video quality */
  quality?: string | undefined;
  /** Thumbnail URL */
  thumbnail?: string | undefined;
}

/**
 * Stream video information
 */
export interface StreamVideoInfo extends VideoInfo {
  /** Video ID from stream service */
  videoId?: string | undefined;
  /** Stream manifest URL */
  manifestUrl?: string | undefined;
  /** Stream protocol */
  protocol?: string | undefined;
  /** Stream bitrate */
  bitrate?: number | undefined;
}

/**
 * Embedded player information
 */
export interface EmbeddedPlayerInfo {
  /** Player type */
  type: string;
  /** Player configuration */
  config?: Record<string, unknown> | undefined;
  /** Media URLs */
  mediaUrls: string[];
  /** Player dimensions */
  dimensions?:
    | {
        width: number;
        height: number;
      }
    | undefined;
}

/**
 * Meeting analysis result
 */
export interface MeetingAnalysisResult {
  /** Detection status */
  status: DetectionStatus;
  /** Detected platform */
  platform: MeetingPlatform;
  /** Confidence score */
  confidence: number;
  /** Found video information */
  videoInfo?: VideoInfo[] | undefined;
  /** Stream information */
  streamInfo?: StreamVideoInfo[] | undefined;
  /** Player information */
  playerInfo?: EmbeddedPlayerInfo[] | undefined;
  /** Analysis errors */
  errors: string[];
  /** Analysis timestamp */
  analyzedAt: Date;
}
