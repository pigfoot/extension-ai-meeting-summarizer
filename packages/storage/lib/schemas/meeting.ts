/**
 * Meeting storage schema for the Meeting Summarizer Chrome Extension
 * Provides storage schemas and validation functions for meeting-related data structures
 * building upon the existing storage base architecture.
 */

import { createStorage } from '../base/base';
import { StorageEnum } from '../base/enums';
import type { BaseStorageType, StorageConfigType } from '../base/types';
// Use generic types to avoid circular dependency with shared package
interface MeetingRecord {
  id: string;
  title: string;
  description?: string;
  url: string;
  startTime: string | Date;
  endTime?: string | Date;
  duration?: number;
  participants: string[];
  organizer?: string;
  platform: 'teams' | 'sharepoint' | 'unknown';
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  createdAt: string | Date;
  updatedAt: string | Date;
  transcriptionText?: string;
  transcriptionStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  transcriptionId?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  isArchived?: boolean;
  recordingUrl?: string;
  summary?: string;
  actionItems?: Array<{
    text: string;
    assignee?: string;
    completed: boolean;
  }>;
}

interface MeetingSearchCriteria {
  query?: string;
  status?: string[];
  source?: string[];
  startDate?: string;
  endDate?: string;
  sortBy?: 'startTime' | 'title' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

interface MeetingSearchResults {
  meetings: MeetingRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

interface MeetingAnalytics {
  totalMeetings: number;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
  averageDuration: number;
  totalRecordedTime: number;
  transcribedMeetings: number;
  summarizedMeetings: number;
  totalActionItems: number;
  completedActionItems: number;
  topParticipants: string[];
}
interface CachedTranscription {
  transcriptionId: string;
  transcriptionText: string;
  meetingId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  confidence?: number;
  language?: string;
  speakers?: Array<{
    id: string;
    name?: string;
    segments: Array<{
      text: string;
      start: number;
      end: number;
      confidence: number;
    }>;
  }>;
  segments?: Array<{
    text: string;
    start: number;
    end: number;
    speaker?: string;
    confidence: number;
  }>;
  createdAt: string;
  updatedAt: string;
  audioUrl?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
  cachedAt: string;
  expiresAt: string;
  checksum: string;
}

/**
 * Meeting validation error types
 */
export type MeetingValidationError =
  | 'INVALID_ID'
  | 'MISSING_TITLE'
  | 'INVALID_DATES'
  | 'INVALID_STATUS'
  | 'INVALID_PARTICIPANTS'
  | 'MISSING_ORGANIZER'
  | 'INVALID_TRANSCRIPTION'
  | 'INVALID_SUMMARY'
  | 'INVALID_ACTION_ITEMS'
  | 'STORAGE_QUOTA_EXCEEDED';

/**
 * Meeting validation result
 */
export interface MeetingValidationResult {
  /** Whether validation passed */
  isValid: boolean;
  /** Validation errors if any */
  errors: MeetingValidationError[];
  /** Warning messages */
  warnings: string[];
  /** Validation timestamp */
  validatedAt: string;
}

/**
 * Meeting storage statistics
 */
export interface MeetingStorageStats {
  /** Total number of meetings stored */
  totalMeetings: number;
  /** Total storage size in bytes */
  totalStorageSize: number;
  /** Storage usage by meeting status */
  storageByStatus: Record<string, number>;
  /** Oldest meeting timestamp */
  oldestMeeting?: string;
  /** Newest meeting timestamp */
  newestMeeting?: string;
  /** Average meeting storage size */
  averageMeetingSize: number;
  /** Storage efficiency ratio */
  storageEfficiency: number;
}


/**
 * Meeting storage configuration extending base storage config
 */
export interface MeetingStorageConfig extends StorageConfigType<Record<string, MeetingRecord>> {
  /** Maximum number of meetings to store */
  maxMeetings?: number;
  /** Auto-cleanup old meetings after days */
  autoCleanupDays?: number;
  /** Enable compression for large meetings */
  enableCompression?: boolean;
  /** Backup to sync storage */
  syncBackup?: boolean;
}

/**
 * Transcription cache configuration
 */
export interface TranscriptionCacheConfig extends StorageConfigType<Record<string, CachedTranscription>> {
  /** Cache expiry time in hours */
  cacheExpiryHours?: number;
  /** Maximum cache size in MB */
  maxCacheSize?: number;
  /** LRU eviction enabled */
  enableLRU?: boolean;
}

/**
 * Meeting record serialization utilities
 */
export const meetingRecordSerialization = {
  /**
   * Serialize meeting record for storage
   */
  serialize: (meetings: Record<string, MeetingRecord>): string => {
    try {
      // Convert dates to ISO strings and compress if needed
      const serializedMeetings = Object.fromEntries(
        Object.entries(meetings).map(([id, meeting]) => [
          id,
          {
            ...meeting,
            startTime:
              typeof meeting.startTime === 'string' ? meeting.startTime : new Date(meeting.startTime).toISOString(),
            endTime: meeting.endTime
              ? typeof meeting.endTime === 'string'
                ? meeting.endTime
                : new Date(meeting.endTime).toISOString()
              : undefined,
            createdAt:
              typeof meeting.createdAt === 'string' ? meeting.createdAt : new Date(meeting.createdAt).toISOString(),
            updatedAt:
              typeof meeting.updatedAt === 'string' ? meeting.updatedAt : new Date(meeting.updatedAt).toISOString(),
          },
        ]),
      );

      return JSON.stringify(serializedMeetings);
    } catch (error) {
      console.error('Failed to serialize meeting records:', error);
      return JSON.stringify({});
    }
  },

  /**
   * Deserialize meeting record from storage
   */
  deserialize: (text: string): Record<string, MeetingRecord> => {
    try {
      if (!text || text.trim() === '') {
        return {};
      }

      const parsed = JSON.parse(text);

      // Validate and convert dates back to proper format
      return Object.fromEntries(
        Object.entries(parsed).map(([id, meeting]) => {
          const typedMeeting = meeting as MeetingRecord;
          return [
            id,
            {
              ...typedMeeting,
              startTime: new Date(typedMeeting.startTime).toISOString(),
              endTime: typedMeeting.endTime ? new Date(typedMeeting.endTime).toISOString() : undefined,
              createdAt: new Date(typedMeeting.createdAt).toISOString(),
              updatedAt: new Date(typedMeeting.updatedAt).toISOString(),
            } as MeetingRecord,
          ];
        }),
      );
    } catch (error) {
      console.error('Failed to deserialize meeting records:', error);
      return {};
    }
  },
};


/**
 * Transcription cache serialization utilities
 */
export const transcriptionCacheSerialization = {
  /**
   * Serialize transcription cache for storage
   */
  serialize: (cache: Record<string, CachedTranscription>): string => {
    try {
      const serializedCache = Object.fromEntries(
        Object.entries(cache).map(([key, transcription]) => [
          key,
          {
            ...transcription,
            cachedAt:
              typeof transcription.cachedAt === 'string'
                ? transcription.cachedAt
                : new Date(transcription.cachedAt).toISOString(),
            expiresAt:
              typeof transcription.expiresAt === 'string'
                ? transcription.expiresAt
                : new Date(transcription.expiresAt).toISOString(),
          },
        ]),
      );

      return JSON.stringify(serializedCache);
    } catch (error) {
      console.error('Failed to serialize transcription cache:', error);
      return JSON.stringify({});
    }
  },

  /**
   * Deserialize transcription cache from storage
   */
  deserialize: (text: string): Record<string, CachedTranscription> => {
    try {
      if (!text || text.trim() === '') {
        return {};
      }

      const parsed = JSON.parse(text);
      const now = new Date();

      // Filter out expired cache entries during deserialization
      return Object.fromEntries(
        Object.entries(parsed)
          .map(([key, transcription]) => {
            const typedTranscription = transcription as CachedTranscription & {
              cachedAt: string;
              expiresAt: string;
            };
            return [
              key,
              {
                ...typedTranscription,
                cachedAt: new Date(typedTranscription.cachedAt).toISOString(),
                expiresAt: new Date(typedTranscription.expiresAt).toISOString(),
              },
            ];
          })
          .filter(([, transcription]) => {
            const typed = transcription as CachedTranscription;
            return new Date(typed.expiresAt) > now;
          }),
      );
    } catch (error) {
      console.error('Failed to deserialize transcription cache:', error);
      return {};
    }
  },
};

/**
 * Validates a meeting record according to business rules
 */
export const validateMeetingRecord = (meeting: Partial<MeetingRecord>): MeetingValidationResult => {
  const errors: MeetingValidationError[] = [];
  const warnings: string[] = [];

  // Required field validations
  if (!meeting.id || typeof meeting.id !== 'string' || meeting.id.trim() === '') {
    errors.push('INVALID_ID');
  }

  if (!meeting.title || typeof meeting.title !== 'string' || meeting.title.trim() === '') {
    errors.push('MISSING_TITLE');
  }

  if (!meeting.startTime) {
    errors.push('INVALID_DATES');
  } else {
    const startTime = new Date(meeting.startTime);
    if (isNaN(startTime.getTime())) {
      errors.push('INVALID_DATES');
    }

    if (meeting.endTime) {
      const endTime = new Date(meeting.endTime);
      if (isNaN(endTime.getTime()) || endTime <= startTime) {
        errors.push('INVALID_DATES');
      }
    }
  }

  if (
    !meeting.status ||
    !['scheduled', 'in-progress', 'completed', 'cancelled', 'processing'].includes(meeting.status)
  ) {
    errors.push('INVALID_STATUS');
  }

  if (!meeting.organizer) {
    errors.push('MISSING_ORGANIZER');
  }

  if (!meeting.participants || !Array.isArray(meeting.participants) || meeting.participants.length === 0) {
    errors.push('INVALID_PARTICIPANTS');
  }

  // Transcription validation if present
  if (meeting.transcriptionText) {
    if (typeof meeting.transcriptionText !== 'string' || meeting.transcriptionText.trim() === '') {
      errors.push('INVALID_TRANSCRIPTION');
    }
  }

  // Summary validation if present
  if (meeting.summary) {
    if (typeof meeting.summary !== 'string' || meeting.summary.trim() === '') {
      errors.push('INVALID_SUMMARY');
    }
  }

  // Action items validation if present
  if (meeting.actionItems) {
    if (!Array.isArray(meeting.actionItems)) {
      errors.push('INVALID_ACTION_ITEMS');
    } else {
      meeting.actionItems.forEach(item => {
        if (!item.text || typeof item.text !== 'string') {
          errors.push('INVALID_ACTION_ITEMS');
        }
      });
    }
  }

  // Performance warnings
  if (meeting.transcriptionText && meeting.transcriptionText.length > 100000) {
    warnings.push('Large transcription may impact performance');
  }

  if (meeting.actionItems && meeting.actionItems.length > 50) {
    warnings.push('Large number of action items may impact performance');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    validatedAt: new Date().toISOString(),
  };
};

/**
 * Meeting storage schema for validation
 */
export const meetingStorageSchema = {
  serialize: meetingRecordSerialization.serialize,
  deserialize: meetingRecordSerialization.deserialize,
  validate: validateMeetingRecord,
};

/**
 * Meeting storage schema type
 */
export type MeetingStorageSchemaType = typeof meetingStorageSchema;

/**
 * Validates transcription cache entry
 */
export const validateCachedTranscription = (cache: Partial<CachedTranscription>): boolean =>
  !!(cache.meetingId && cache.transcriptionText && cache.cachedAt && cache.expiresAt && cache.checksum);

/**
 * Creates meeting records storage with enhanced configuration
 */
export const createMeetingStorage = (config?: MeetingStorageConfig): BaseStorageType<Record<string, MeetingRecord>> => {
  const defaultConfig: MeetingStorageConfig = {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
    maxMeetings: 1000,
    autoCleanupDays: 90,
    enableCompression: true,
    syncBackup: false,
    serialization: meetingRecordSerialization,
  };

  const finalConfig = { ...defaultConfig, ...config };

  return createStorage('meetings', {}, finalConfig);
};

/**
 * Creates transcription cache storage with LRU configuration
 */
export const createTranscriptionCacheStorage = (
  config?: TranscriptionCacheConfig,
): BaseStorageType<Record<string, CachedTranscription>> => {
  const defaultConfig: TranscriptionCacheConfig = {
    storageEnum: StorageEnum.Local,
    liveUpdate: false,
    cacheExpiryHours: 24,
    maxCacheSize: 50, // 50MB
    enableLRU: true,
    serialization: transcriptionCacheSerialization,
  };

  const finalConfig = { ...defaultConfig, ...config };

  return createStorage('transcriptionCache', {}, finalConfig);
};

/**
 * Creates meeting analytics storage
 */
export const createMeetingAnalyticsStorage = (): BaseStorageType<MeetingAnalytics> => {
  const defaultAnalytics: MeetingAnalytics = {
    totalMeetings: 0,
    byStatus: {
      scheduled: 0,
      'in-progress': 0,
      completed: 0,
      cancelled: 0,
      processing: 0,
    },
    bySource: {
      sharepoint: 0,
      teams: 0,
      zoom: 0,
      other: 0,
    },
    averageDuration: 0,
    totalRecordedTime: 0,
    transcribedMeetings: 0,
    summarizedMeetings: 0,
    totalActionItems: 0,
    completedActionItems: 0,
    topParticipants: [],
  };

  return createStorage('meetingAnalytics', defaultAnalytics, {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
    serialization: {
      serialize: (analytics: MeetingAnalytics) => JSON.stringify(analytics),
      deserialize: (text: string) => {
        try {
          return text ? JSON.parse(text) : defaultAnalytics;
        } catch {
          return defaultAnalytics;
        }
      },
    },
  });
};

/**
 * Utility functions for meeting storage management
 */
export const meetingStorageUtils = {
  /**
   * Search meetings based on criteria
   */
  async searchMeetings(
    storage: BaseStorageType<Record<string, MeetingRecord>>,
    criteria: MeetingSearchCriteria,
  ): Promise<MeetingSearchResults> {
    const allMeetings = await storage.get();
    const meetings = Object.values(allMeetings);

    let filteredMeetings = meetings;

    // Apply filters
    if (criteria.query) {
      const query = criteria.query.toLowerCase();
      filteredMeetings = filteredMeetings.filter(
        meeting =>
          meeting.title.toLowerCase().includes(query) ||
          meeting.description?.toLowerCase().includes(query) ||
          meeting.transcriptionText?.toLowerCase().includes(query),
      );
    }

    if (criteria.status && criteria.status.length > 0) {
      filteredMeetings = filteredMeetings.filter(meeting => criteria.status!.includes(meeting.status));
    }

    if (criteria.source && criteria.source.length > 0) {
      filteredMeetings = filteredMeetings.filter(meeting => criteria.source!.includes(meeting.platform));
    }

    if (criteria.startDate) {
      const startDate = new Date(criteria.startDate);
      filteredMeetings = filteredMeetings.filter(meeting => new Date(meeting.startTime) >= startDate);
    }

    if (criteria.endDate) {
      const endDate = new Date(criteria.endDate);
      filteredMeetings = filteredMeetings.filter(meeting => new Date(meeting.startTime) <= endDate);
    }

    // Apply sorting
    const sortBy = criteria.sortBy || 'startTime';
    const sortOrder = criteria.sortOrder || 'desc';

    filteredMeetings.sort((a, b) => {
      let aValue: string | number = '';
      let bValue: string | number = '';

      switch (sortBy) {
        case 'startTime':
          aValue = new Date(a.startTime).getTime();
          bValue = new Date(b.startTime).getTime();
          break;
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case 'updatedAt':
          aValue = new Date(a.updatedAt).getTime();
          bValue = new Date(b.updatedAt).getTime();
          break;
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    // Apply pagination
    const page = criteria.page || 1;
    const limit = criteria.limit || 20;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    const paginatedMeetings = filteredMeetings.slice(startIndex, endIndex);

    return {
      meetings: paginatedMeetings,
      total: filteredMeetings.length,
      page,
      limit,
      totalPages: Math.ceil(filteredMeetings.length / limit),
      hasMore: endIndex < filteredMeetings.length,
    };
  },

  /**
   * Calculate storage statistics
   */
  async calculateStorageStats(storage: BaseStorageType<Record<string, MeetingRecord>>): Promise<MeetingStorageStats> {
    const allMeetings = await storage.get();
    const meetings = Object.values(allMeetings);

    if (meetings.length === 0) {
      return {
        totalMeetings: 0,
        totalStorageSize: 0,
        storageByStatus: {},
        averageMeetingSize: 0,
        storageEfficiency: 1,
      };
    }

    const serialized = meetingRecordSerialization.serialize(allMeetings);
    const totalStorageSize = new Blob([serialized]).size;

    const storageByStatus: Record<string, number> = {};
    const firstMeeting = meetings[0];
    if (!firstMeeting) {
      return {
        totalMeetings: 0,
        totalStorageSize: 0,
        storageByStatus: {},
        averageMeetingSize: 0,
        storageEfficiency: 1,
      };
    }
    let oldestMeeting = firstMeeting.startTime;
    let newestMeeting = firstMeeting.startTime;

    meetings.forEach(meeting => {
      storageByStatus[meeting.status] = (storageByStatus[meeting.status] || 0) + 1;

      if (meeting.startTime < oldestMeeting) {
        oldestMeeting = meeting.startTime;
      }
      if (meeting.startTime > newestMeeting) {
        newestMeeting = meeting.startTime;
      }
    });

    return {
      totalMeetings: meetings.length,
      totalStorageSize,
      storageByStatus,
      oldestMeeting: typeof oldestMeeting === 'string' ? oldestMeeting : oldestMeeting.toISOString(),
      newestMeeting: typeof newestMeeting === 'string' ? newestMeeting : newestMeeting.toISOString(),
      averageMeetingSize: totalStorageSize / meetings.length,
      storageEfficiency: 0.85, // Estimated compression efficiency
    };
  },

  /**
   * Clean up old meetings based on retention policy
   */
  async cleanupOldMeetings(
    storage: BaseStorageType<Record<string, MeetingRecord>>,
    retentionDays: number = 90,
  ): Promise<number> {
    const allMeetings = await storage.get();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const toKeep: Record<string, MeetingRecord> = {};
    let removedCount = 0;

    Object.entries(allMeetings).forEach(([id, meeting]) => {
      if (new Date(meeting.startTime) >= cutoffDate) {
        toKeep[id] = meeting;
      } else {
        removedCount++;
      }
    });

    await storage.set(toKeep);
    return removedCount;
  },
};
