/**
 * Meeting Core Package - Index
 * 
 * Central barrel export for meeting-specific utilities and components.
 * This package provides the foundation for meeting functionality including
 * transcription management, meeting detection, and data processing.
 */

// Re-export types from shared package for convenience
export type {
  // Meeting domain types
  MeetingRecord,
  MeetingParticipant,
  MeetingMetadata,
  MeetingStatus,
  MeetingSource,
  MeetingSearchCriteria,
  MeetingSearchResults,
  MeetingAnalytics,
  
  // Transcription types
  TranscriptionResult,
  TranscriptionSegment,
  TranscriptionWord,
  TranscriptionConfidence,
  
  // Meeting summary types
  MeetingSummary,
  ActionItem,
  ActionItemPriority,
  ActionItemStatus,
  
  // Azure Speech types
  AzureSpeechConfig,
  AudioConfig,
  SpeechClient,
  SpeechClientStatus,
  SpeechRecognitionResult,
  RecognitionResult,
  SpeakerDiarizationResult,
  
  // Extension storage types
  ExtensionStorageSchema,
  UserPreferences,
  CachedTranscription,
} from '@extension/shared';

// Re-export storage utilities for meeting functionality
export {
  // Meeting storage
  createMeetingStorage,
  validateMeetingRecord,
  validateCachedTranscription,
  meetingStorageUtils,
  meetingRecordSerialization,
  transcriptionCacheSerialization,
  
  // Configuration storage
  createSecureAzureConfigStorage,
  createUserPreferencesStorage,
  createExtensionSettingsStorage,
  createConfigHistoryStorage,
  createConfigBackupStorage,
  validateAzureConfig,
  encryptionUtils,
  configUtils,
  
  // Cache management
  TranscriptionLRUCache,
  cacheUtils,
} from '@extension/storage';

/**
 * Package version and metadata
 */
export const MEETING_CORE_VERSION = '0.5.0';
export const PACKAGE_NAME = '@extension/meeting-core';

/**
 * Meeting Core constants
 */
export const MEETING_CONSTANTS = {
  // Default configuration values
  DEFAULT_LANGUAGE: 'en-US',
  DEFAULT_TRANSCRIPTION_QUALITY: 'balanced' as const,
  DEFAULT_CACHE_TTL: 24 * 60 * 60 * 1000, // 24 hours
  DEFAULT_STORAGE_QUOTA: 500 * 1024 * 1024, // 500MB
  
  // Meeting detection patterns
  SHAREPOINT_PATTERNS: [
    /.*\.sharepoint\.com\/.*\/SitePages\/.*\.aspx/,
    /.*\.office\.com\/.*\/SitePages\/.*\.aspx/,
    /.*\.microsoftonline\.com\/.*\/SitePages\/.*\.aspx/,
  ],
  
  TEAMS_PATTERNS: [
    /.*\.teams\.microsoft\.com\/.*\/conversations\/.*/,
    /.*\.teams\.microsoft\.com\/.*\/meetings\/.*/,
  ],
  
  // File type patterns for meeting recordings
  VIDEO_PATTERNS: [
    /\.(mp4|webm|avi|mov|wmv|flv|mkv)$/i,
  ],
  
  AUDIO_PATTERNS: [
    /\.(mp3|wav|ogg|aac|m4a|flac|wma)$/i,
  ],
  
  // API limits and constraints
  MAX_AUDIO_SIZE: 25 * 1024 * 1024, // 25MB (Azure Speech limit)
  MAX_PARTICIPANTS: 100,
  MAX_ACTION_ITEMS: 50,
  MAX_TRANSCRIPT_LENGTH: 1000000, // 1M characters
  
  // Cache configuration
  CACHE_LIMITS: {
    MAX_ENTRIES: 1000,
    MAX_SIZE: 50 * 1024 * 1024, // 50MB
    DEFAULT_TTL: 24 * 60 * 60 * 1000, // 24 hours
    CLEANUP_INTERVAL: 60 * 60 * 1000, // 1 hour
  },
  
  // Storage keys
  STORAGE_KEYS: {
    MEETINGS: 'meetings',
    AZURE_CONFIG: 'azureConfig',
    USER_PREFERENCES: 'userPreferences',
    TRANSCRIPTION_CACHE: 'transcriptionCache',
    EXTENSION_SETTINGS: 'extensionSettings',
    CONFIG_HISTORY: 'configHistory',
  },
} as const;

/**
 * Meeting utility functions namespace
 */
export const MeetingUtils = {
  /**
   * Generate unique meeting ID
   */
  generateMeetingId(): string {
    return `meeting_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },
  
  /**
   * Check if URL matches meeting patterns
   */
  isMeetingUrl(url: string): boolean {
    const patterns = [
      ...MEETING_CONSTANTS.SHAREPOINT_PATTERNS,
      ...MEETING_CONSTANTS.TEAMS_PATTERNS,
    ];
    
    return patterns.some(pattern => pattern.test(url));
  },
  
  /**
   * Extract meeting type from URL
   */
  getMeetingTypeFromUrl(url: string): 'sharepoint' | 'teams' | 'unknown' {
    if (MEETING_CONSTANTS.SHAREPOINT_PATTERNS.some(p => p.test(url))) {
      return 'sharepoint';
    }
    
    if (MEETING_CONSTANTS.TEAMS_PATTERNS.some(p => p.test(url))) {
      return 'teams';
    }
    
    return 'unknown';
  },
  
  /**
   * Check if file is a supported audio/video format
   */
  isSupportedMediaFile(filename: string): boolean {
    return [
      ...MEETING_CONSTANTS.VIDEO_PATTERNS,
      ...MEETING_CONSTANTS.AUDIO_PATTERNS,
    ].some(pattern => pattern.test(filename));
  },
  
  /**
   * Calculate meeting duration in minutes
   */
  calculateMeetingDuration(startTime: string, endTime?: string): number {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
  },
  
  /**
   * Format meeting duration for display
   */
  formatDuration(durationMinutes: number): string {
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    
    return `${minutes}m`;
  },
  
  /**
   * Generate cache key for transcription
   */
  generateCacheKey(meetingId: string, options: {
    language?: string;
    quality?: string;
    speakerDiarization?: boolean;
  } = {}): string {
    const parts = [meetingId];
    
    if (options.language) {
      parts.push(`lang-${options.language}`);
    }
    
    if (options.quality) {
      parts.push(`quality-${options.quality}`);
    }
    
    if (options.speakerDiarization) {
      parts.push('diarization');
    }
    
    return parts.join('_');
  },
  
  /**
   * Validate meeting record completeness
   */
  isValidMeetingRecord(meeting: Partial<import('@extension/shared').MeetingRecord>): meeting is import('@extension/shared').MeetingRecord {
    return !!(
      meeting.id &&
      meeting.title &&
      meeting.startTime &&
      meeting.status &&
      meeting.source &&
      meeting.participants &&
      meeting.organizer &&
      meeting.metadata &&
      meeting.createdAt &&
      meeting.updatedAt
    );
  },
  
  /**
   * Extract SharePoint site information from URL
   */
  extractSharePointSiteInfo(url: string): {
    tenant?: string;
    site?: string;
    list?: string;
    item?: string;
  } | null {
    const sharepointPattern = /https:\/\/([^.]+)\.sharepoint\.com\/sites\/([^\/]+)\/?/;
    const match = url.match(sharepointPattern);
    
    if (!match) return null;
    
    const result: { tenant?: string; site?: string; list?: string; item?: string; } = {};
    if (match[1]) result.tenant = match[1];
    if (match[2]) result.site = match[2];
    return result;
  },
} as const;

/**
 * Console logging utility with meeting context
 */
export const MeetingLogger = {
  info(message: string, data?: unknown): void {
    console.info(`[MeetingCore] ${message}`, data || '');
  },
  
  warn(message: string, data?: unknown): void {
    console.warn(`[MeetingCore] ${message}`, data || '');
  },
  
  error(message: string, error?: unknown): void {
    console.error(`[MeetingCore] ${message}`, error || '');
  },
  
  debug(message: string, data?: unknown): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[MeetingCore] ${message}`, data || '');
    }
  },
} as const;

/**
 * Meeting Core initialization and health check
 */
export const MeetingCore = {
  /**
   * Initialize meeting core package
   */
  async initialize(): Promise<boolean> {
    try {
      MeetingLogger.info('Initializing Meeting Core package', { version: MEETING_CORE_VERSION });
      
      // Perform any necessary initialization here
      // For now, just validate that required dependencies are available
      
      MeetingLogger.info('Meeting Core package initialized successfully');
      return true;
    } catch (error) {
      MeetingLogger.error('Failed to initialize Meeting Core package', error);
      return false;
    }
  },
  
  /**
   * Get package health status
   */
  getHealthStatus(): {
    healthy: boolean;
    version: string;
    dependencies: string[];
    issues: string[];
  } {
    const issues: string[] = [];
    const dependencies = ['@extension/shared', '@extension/storage'];
    
    // Check if running in supported environment
    if (typeof crypto === 'undefined') {
      issues.push('Crypto API not available');
    }
    
    if (typeof structuredClone === 'undefined') {
      issues.push('StructuredClone not available');
    }
    
    return {
      healthy: issues.length === 0,
      version: MEETING_CORE_VERSION,
      dependencies,
      issues,
    };
  },
} as const;

// Default export for convenience
export default MeetingCore;