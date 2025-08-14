/**
 * Meeting Storage Service
 * Implements complete meeting data storage service with CRUD operations,
 * batch processing, search/filter capabilities, and storage optimization.
 */

import { MeetingStorageBase } from './meeting-storage-base';
import type { MeetingSearchCriteria } from './meeting-index';
import type { StorageOperationResult, MeetingStorageConfig } from './meeting-storage-base';
import type {
  MeetingStorageRecord,
  StoragePriority,
  BatchStorageOperation,
  StorageQuotaInfo,
  MeetingRecord,
} from '../types/meeting';

export interface MeetingSearchResults {
  meetings: MeetingRecord[];
  totalCount: number;
  hasMore: boolean;
  nextCursor?: string;
}

/**
 * Storage operation options
 */
export interface StorageOperationOptions {
  /** Whether to validate data before storage */
  validate?: boolean;
  /** Whether to compress large data */
  compress?: boolean;
  /** Storage priority for the record */
  priority?: StoragePriority;
  /** User-defined tags for organization */
  tags?: string[];
  /** Whether to update existing records */
  upsert?: boolean;
}

/**
 * Search options for meeting queries
 */
export interface SearchOptions {
  /** Whether to include compressed transcription content in results */
  includeTranscriptions?: boolean;
  /** Whether to perform case-sensitive search */
  caseSensitive?: boolean;
  /** Maximum number of results to return */
  maxResults?: number;
  /** Search timeout in milliseconds */
  timeout?: number;
}

/**
 * Meeting storage service providing comprehensive meeting data management
 */
export class MeetingStorage extends MeetingStorageBase {
  private searchIndex: Map<string, Set<string>> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();
  private participantIndex: Map<string, Set<string>> = new Map();

  constructor(config: MeetingStorageConfig = {}) {
    super('meeting-storage', [], config);

    // Initialize indexes
    this.initializeIndexes();
  }

  /**
   * Initialize search indexes from existing data
   */
  private async initializeIndexes(): Promise<void> {
    try {
      const records = await this.storage.get();
      this.rebuildIndexes(records);
    } catch (error) {
      console.error('Failed to initialize storage indexes:', error);
    }
  }

  /**
   * Rebuild all search indexes
   */
  private rebuildIndexes(records: MeetingStorageRecord[]): void {
    this.searchIndex.clear();
    this.tagIndex.clear();
    this.participantIndex.clear();

    for (const record of records) {
      this.updateIndexes(record);
    }
  }

  /**
   * Update search indexes for a record
   */
  private updateIndexes(record: MeetingStorageRecord): void {
    // Update search index
    const searchTerms = this.extractSearchTerms(record);
    searchTerms.forEach(term => {
      if (!this.searchIndex.has(term)) {
        this.searchIndex.set(term, new Set());
      }
      this.searchIndex.get(term)!.add(record.id);
    });

    // Update tag index
    record.tags.forEach(tag => {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(record.id);
    });

    // Update participant index
    record.meeting.participants.forEach(participant => {
      if (participant.name && participant.email) {
        const participantKey = `${participant.name.toLowerCase()}:${participant.email.toLowerCase()}`;
        if (!this.participantIndex.has(participantKey)) {
          this.participantIndex.set(participantKey, new Set());
        }
        this.participantIndex.get(participantKey)!.add(record.id);
      }
    });
  }

  /**
   * Remove record from indexes
   */
  private removeFromIndexes(recordId: string): void {
    // Remove from search index
    this.searchIndex.forEach((recordIds, term) => {
      recordIds.delete(recordId);
      if (recordIds.size === 0) {
        this.searchIndex.delete(term);
      }
    });

    // Remove from tag index
    this.tagIndex.forEach((recordIds, tag) => {
      recordIds.delete(recordId);
      if (recordIds.size === 0) {
        this.tagIndex.delete(tag);
      }
    });

    // Remove from participant index
    this.participantIndex.forEach((recordIds, participant) => {
      recordIds.delete(recordId);
      if (recordIds.size === 0) {
        this.participantIndex.delete(participant);
      }
    });
  }

  /**
   * Extract search terms from a meeting record
   */
  private extractSearchTerms(record: MeetingStorageRecord): string[] {
    const terms: string[] = [];

    // Add meeting title and description
    if (record.meeting.title) {
      terms.push(...record.meeting.title.toLowerCase().split(/\s+/));
    }
    if (record.meeting.description) {
      terms.push(...record.meeting.description.toLowerCase().split(/\s+/));
    }

    // Add searchable text
    if (record.searchableText) {
      terms.push(...record.searchableText.toLowerCase().split(/\s+/));
    }

    // Add participant names
    record.meeting.participants.forEach(participant => {
      if (participant.name) {
        terms.push(...participant.name.toLowerCase().split(/\s+/));
      }
    });

    // Add tags
    terms.push(...record.tags.map(tag => tag.toLowerCase()));

    // Filter out empty terms and duplicates
    return [...new Set(terms.filter(term => term.length > 2))];
  }

  /**
   * Store a new meeting record
   */
  public async createMeeting(
    meeting: MeetingRecord,
    options: StorageOperationOptions = {},
  ): Promise<StorageOperationResult<MeetingStorageRecord>> {
    const startTime = Date.now();

    try {
      // Generate storage record
      const record = await this.createStorageRecord(meeting, options);

      // Validate record if enabled
      if (options.validate ?? this.config.enableValidation) {
        const validation = this.validateRecord(record);
        if (!validation.success) {
          return {
            success: false,
            error: validation.error ?? {
              code: 'VALIDATION_FAILED',
              message: 'Record validation failed'
            }
          };
        }
      }

      // Get current records
      const records = await this.storage.get();

      // Check for existing record
      const existingIndex = records.findIndex(r => r.id === record.id);
      if (existingIndex >= 0 && !options.upsert) {
        return {
          success: false,
          error: {
            code: 'RECORD_EXISTS',
            message: `Meeting record with ID ${record.id} already exists`,
          },
        };
      }

      // Store record
      if (existingIndex >= 0 && records[existingIndex]) {
        // Update existing record
        this.removeFromIndexes(records[existingIndex].id);
        records[existingIndex] = record;
      } else {
        // Add new record
        records.push(record);
      }

      // Update storage
      await this.storage.set(records);

      // Update indexes
      this.updateIndexes(record);

      const duration = Date.now() - startTime;
      this.updatePerformanceMetrics('write', duration, true);

      return {
        success: true,
        data: record,
        metrics: {
          duration,
          dataSize: record.storageSize,
          compressionRatio: record.storageMetadata.compressionRatio ?? 0,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.updatePerformanceMetrics('write', duration, false);

      return {
        success: false,
        error: {
          code: 'STORAGE_FAILED',
          message: `Failed to store meeting: ${error instanceof Error ? error.message : String(error)}`,
        },
      };
    }
  }

  /**
   * Retrieve a meeting record by ID
   */
  public async getMeeting(id: string): Promise<StorageOperationResult<MeetingStorageRecord>> {
    const startTime = Date.now();

    try {
      const records = await this.storage.get();
      const record = records.find(r => r.id === id);

      const duration = Date.now() - startTime;
      this.updatePerformanceMetrics('read', duration, true);

      if (!record) {
        return {
          success: false,
          error: {
            code: 'RECORD_NOT_FOUND',
            message: `Meeting record with ID ${id} not found`,
          },
        };
      }

      // Update access tracking
      record.lastAccessed = new Date().toISOString();
      record.accessCount += 1;

      // Save updated access info
      await this.storage.set(records);

      return {
        success: true,
        data: record,
        metrics: {
          duration,
          dataSize: record.storageSize,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.updatePerformanceMetrics('read', duration, false);

      return {
        success: false,
        error: {
          code: 'RETRIEVAL_FAILED',
          message: `Failed to retrieve meeting: ${error instanceof Error ? error.message : String(error)}`,
        },
      };
    }
  }

  /**
   * Update an existing meeting record
   */
  public async updateMeeting(
    id: string,
    updates: Partial<MeetingRecord>,
    options: StorageOperationOptions = {},
  ): Promise<StorageOperationResult<MeetingStorageRecord>> {
    const startTime = Date.now();

    try {
      const records = await this.storage.get();
      const recordIndex = records.findIndex(r => r.id === id);

      if (recordIndex === -1) {
        return {
          success: false,
          error: {
            code: 'RECORD_NOT_FOUND',
            message: `Meeting record with ID ${id} not found`,
          },
        };
      }

      const existingRecord = records[recordIndex];
      
      if (!existingRecord) {
        return {
          success: false,
          error: {
            code: 'RECORD_NOT_FOUND',
            message: `Meeting record with ID ${id} not found at index ${recordIndex}`,
          },
        };
      }

      // Remove from indexes before update
      this.removeFromIndexes(existingRecord.id);

      // Update meeting data
      const updatedMeeting = { ...existingRecord.meeting, ...updates };

      // Create updated storage record
      const updatedRecord = await this.createStorageRecord(updatedMeeting, {
        ...options,
        tags: options.tags ?? existingRecord.tags,
        priority: options.priority ?? existingRecord.priority,
      });

      // Preserve some metadata
      updatedRecord.id = existingRecord.id;
      updatedRecord.accessCount = existingRecord.accessCount;
      updatedRecord.storageMetadata.timestamps.stored = existingRecord.storageMetadata.timestamps.stored;
      updatedRecord.storageMetadata.timestamps.updated = new Date().toISOString();

      // Validate updated record
      if (options.validate ?? this.config.enableValidation) {
        const validation = this.validateRecord(updatedRecord);
        if (!validation.success) {
          return {
            success: false,
            error: validation.error ?? {
              code: 'VALIDATION_FAILED',
              message: 'Updated record validation failed'
            }
          };
        }
      }

      // Update record in storage
      records[recordIndex] = updatedRecord;
      await this.storage.set(records);

      // Update indexes
      this.updateIndexes(updatedRecord);

      const duration = Date.now() - startTime;
      this.updatePerformanceMetrics('write', duration, true);

      return {
        success: true,
        data: updatedRecord,
        metrics: {
          duration,
          dataSize: updatedRecord.storageSize,
          compressionRatio: updatedRecord.storageMetadata.compressionRatio ?? 0,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.updatePerformanceMetrics('write', duration, false);

      return {
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: `Failed to update meeting: ${error instanceof Error ? error.message : String(error)}`,
        },
      };
    }
  }

  /**
   * Delete a meeting record
   */
  public async deleteMeeting(id: string): Promise<StorageOperationResult<boolean>> {
    const startTime = Date.now();

    try {
      const records = await this.storage.get();
      const recordIndex = records.findIndex(r => r.id === id);

      if (recordIndex === -1) {
        return {
          success: false,
          error: {
            code: 'RECORD_NOT_FOUND',
            message: `Meeting record with ID ${id} not found`,
          },
        };
      }

      // Remove from indexes
      const recordToDelete = records[recordIndex];
      if (recordToDelete) {
        this.removeFromIndexes(recordToDelete.id);
      }

      // Remove from storage
      records.splice(recordIndex, 1);
      await this.storage.set(records);

      const duration = Date.now() - startTime;
      this.updatePerformanceMetrics('delete', duration, true);

      return {
        success: true,
        data: true,
        metrics: {
          duration,
          dataSize: 0,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.updatePerformanceMetrics('delete', duration, false);

      return {
        success: false,
        error: {
          code: 'DELETE_FAILED',
          message: `Failed to delete meeting: ${error instanceof Error ? error.message : String(error)}`,
        },
      };
    }
  }

  /**
   * Search meetings with filters and pagination
   */
  public async searchMeetings(
    criteria: MeetingSearchCriteria,
    options: SearchOptions = {},
  ): Promise<StorageOperationResult<MeetingSearchResults>> {
    const startTime = Date.now();

    try {
      const records = await this.storage.get();
      let filteredRecords = [...records];

      // Apply filters
      if (criteria.query) {
        const queryTerms = criteria.query.toLowerCase().split(/\s+/);
        const matchingIds = new Set<string>();

        queryTerms.forEach(term => {
          const recordIds = this.searchIndex.get(term);
          if (recordIds) {
            recordIds.forEach(id => matchingIds.add(id));
          }
        });

        filteredRecords = filteredRecords.filter(record => matchingIds.has(record.id));
      }

      if (criteria.status && criteria.status.length > 0) {
        filteredRecords = filteredRecords.filter(record => 
          criteria.status!.includes(record.storageMetadata.status)
        );
      }

      if (criteria.source && criteria.source.length > 0) {
        // Skip source filtering since it's not available in the current schema
        // filteredRecords = filteredRecords.filter(record => criteria.source!.includes(record.meeting.source));
      }

      if (criteria.startDate) {
        const startDate = new Date(criteria.startDate);
        filteredRecords = filteredRecords.filter(record => new Date(record.meeting.startTime) >= startDate);
      }

      if (criteria.endDate) {
        const endDate = new Date(criteria.endDate);
        filteredRecords = filteredRecords.filter(record => new Date(record.meeting.startTime) <= endDate);
      }

      if (criteria.participant) {
        const participantQuery = criteria.participant.toLowerCase();
        filteredRecords = filteredRecords.filter(record =>
          record.meeting.participants.some(
            p => (p.name?.toLowerCase().includes(participantQuery)) || (p.email?.toLowerCase().includes(participantQuery)),
          ),
        );
      }

      if (criteria.tags && criteria.tags.length > 0) {
        filteredRecords = filteredRecords.filter(record => criteria.tags!.some(tag => record.tags.includes(tag)));
      }

      // Apply sorting
      if (criteria.sortBy) {
        filteredRecords.sort((a, b) => {
          let aValue: Date | string;
          let bValue: Date | string;

          switch (criteria.sortBy) {
            case 'startTime':
              aValue = new Date(a.meeting.startTime);
              bValue = new Date(b.meeting.startTime);
              break;
            case 'title':
              aValue = a.meeting.title;
              bValue = b.meeting.title;
              break;
            case 'createdAt':
              aValue = new Date(a.storageMetadata.timestamps.stored);
              bValue = new Date(b.storageMetadata.timestamps.stored);
              break;
            case 'updatedAt':
              aValue = new Date(a.storageMetadata.timestamps.updated);
              bValue = new Date(b.storageMetadata.timestamps.updated);
              break;
            default:
              aValue = a.meeting.startTime;
              bValue = b.meeting.startTime;
          }

          if (aValue < bValue) return criteria.sortOrder === 'desc' ? 1 : -1;
          if (aValue > bValue) return criteria.sortOrder === 'desc' ? -1 : 1;
          return 0;
        });
      }

      // Apply pagination
      const page = criteria.page ?? 1;
      const limit = Math.min(criteria.limit ?? 20, options.maxResults ?? 100);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;

      const paginatedRecords = filteredRecords.slice(startIndex, endIndex);

      const duration = Date.now() - startTime;
      this.updatePerformanceMetrics('search', duration, true);

      return {
        success: true,
        data: {
          meetings: paginatedRecords.map(record => record.meeting),
          totalCount: filteredRecords.length,
          hasMore: endIndex < filteredRecords.length,
          ...(endIndex < filteredRecords.length && { nextCursor: `page_${page + 1}` }),
        },
        metrics: {
          duration,
          dataSize: paginatedRecords.reduce((sum, record) => sum + record.storageSize, 0),
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.updatePerformanceMetrics('search', duration, false);

      return {
        success: false,
        error: {
          code: 'SEARCH_FAILED',
          message: `Search failed: ${error instanceof Error ? error.message : String(error)}`,
        },
      };
    }
  }

  /**
   * Get all meeting records
   */
  public async getAllMeetings(): Promise<StorageOperationResult<MeetingStorageRecord[]>> {
    const startTime = Date.now();

    try {
      const records = await this.storage.get();
      const duration = Date.now() - startTime;

      this.updatePerformanceMetrics('read', duration, true);

      return {
        success: true,
        data: records,
        metrics: {
          duration,
          dataSize: records.reduce((sum, record) => sum + record.storageSize, 0),
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.updatePerformanceMetrics('read', duration, false);

      return {
        success: false,
        error: {
          code: 'RETRIEVAL_FAILED',
          message: `Failed to retrieve meetings: ${error instanceof Error ? error.message : String(error)}`,
        },
      };
    }
  }

  /**
   * Perform batch operations on multiple records
   */
  public async batchOperation(operation: BatchStorageOperation): Promise<StorageOperationResult<unknown[]>> {
    const startTime = Date.now();
    const results: Array<StorageOperationResult<unknown>> = [];

    try {
      for (const record of operation.records) {
        try {
          let result: StorageOperationResult<unknown>;

          switch (operation.operation) {
            case 'create':
              result = await this.createMeeting(record.meeting);
              break;
            case 'update':
              result = await this.updateMeeting(record.id, record.meeting);
              break;
            case 'delete':
              result = await this.deleteMeeting(record.id);
              break;
            default:
              result = {
                success: false,
                error: {
                  code: 'INVALID_OPERATION',
                  message: `Unsupported batch operation: ${operation.operation}`,
                },
              };
          }

          results.push(result);

          // Call progress callback if provided
          if (operation.onProgress) {
            operation.onProgress(results.length, operation.records.length, record.id);
          }

          // Check if we should continue on error
          if (!result.success && !operation.settings.continueOnError) {
            break;
          }
        } catch (error) {
          const errorResult = {
            success: false,
            error: {
              code: 'BATCH_ITEM_FAILED',
              message: `Batch item failed: ${error instanceof Error ? error.message : String(error)}`,
            },
          };

          results.push(errorResult);

          if (!operation.settings.continueOnError) {
            break;
          }
        }
      }

      const duration = Date.now() - startTime;
      const successCount = results.filter(r => r.success).length;

      return {
        success: successCount > 0,
        data: results,
        metrics: {
          duration,
          dataSize: operation.records.reduce((sum, record) => sum + record.storageSize, 0),
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        error: {
          code: 'BATCH_OPERATION_FAILED',
          message: `Batch operation failed: ${error instanceof Error ? error.message : String(error)}`,
        },
      };
    }
  }

  /**
   * Get storage quota information
   */
  public async getQuotaInfo(): Promise<StorageOperationResult<StorageQuotaInfo>> {
    try {
      // This is a simplified implementation - in production you'd query actual Chrome storage quotas
      const records = await this.storage.get();
      const totalSize = records.reduce((sum, record) => sum + record.storageSize, 0);

      // Estimate quota (Chrome local storage is typically 5MB per origin)
      const estimatedQuota = 5 * 1024 * 1024; // 5MB

      return {
        success: true,
        data: {
          totalQuota: estimatedQuota,
          usedStorage: totalSize,
          availableStorage: estimatedQuota - totalSize,
          usagePercentage: totalSize / estimatedQuota,
          breakdown: {
            meetingRecords: totalSize * 0.4,
            transcriptions: totalSize * 0.4,
            summaries: totalSize * 0.1,
            indexes: totalSize * 0.05,
            cache: totalSize * 0.04,
            configuration: totalSize * 0.01,
          },
          recommendations: {
            cleanupActions: [],
            ...(totalSize > estimatedQuota * 0.8 && { timeUntilFull: '1 week' }),
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'QUOTA_INFO_FAILED',
          message: `Failed to get quota info: ${error instanceof Error ? error.message : String(error)}`,
        },
      };
    }
  }

  /**
   * Create a storage record from meeting data
   */
  private async createStorageRecord(
    meeting: MeetingRecord,
    options: StorageOperationOptions,
  ): Promise<MeetingStorageRecord> {
    // Generate searchable text
    const searchableText = this.generateSearchableText(meeting);

    // Calculate storage size
    const meetingJson = JSON.stringify(meeting);
    const originalSize = new TextEncoder().encode(meetingJson).length;

    // Compress transcription if enabled and available
    let compressedTranscription: Uint8Array | undefined;
    let compressedSize = originalSize;

    if (meeting.transcription && (options.compress ?? this.config.defaultCompression.compressTranscription)) {
      const compressionResult = await this.compressData(meeting.transcription.fullText);
      if (compressionResult.success && compressionResult.data) {
        compressedTranscription = compressionResult.data;
        compressedSize = originalSize - meeting.transcription.fullText.length + compressedTranscription.length;
      }
    }

    // Create storage metadata
    const storageMetadata = this.createStorageMetadata('stored', originalSize, compressedSize);

    // Generate record ID (could be based on meeting URL + timestamp)
    const recordId = meeting.id || this.generateRecordId(meeting);

    // Create storage record
    const record: MeetingStorageRecord = {
      id: recordId,
      meeting,
      ...(compressedTranscription && { compressedTranscription }),
      searchableText,
      tags: options.tags ?? [],
      storageSize: compressedSize,
      storageMetadata,
      compressionConfig: this.config.defaultCompression,
      priority: options.priority ?? 'medium',
      checksum: '',
      lastAccessed: new Date().toISOString(),
      accessCount: 0,
    };

    // Calculate and set checksum
    record.checksum = this.calculateChecksum(record);

    return record;
  }

  /**
   * Generate searchable text from meeting data
   */
  private generateSearchableText(meeting: MeetingRecord): string {
    const textParts: string[] = [];

    if (meeting.title) textParts.push(meeting.title);
    if (meeting.description) textParts.push(meeting.description);
    if (meeting.transcription) textParts.push(meeting.transcription.fullText);
    if (meeting.summary) {
      if (meeting.summary.overview) {
        textParts.push(meeting.summary.overview);
      }
      textParts.push(...meeting.summary.keyPoints.filter(Boolean));
      textParts.push(...meeting.summary.decisions.filter(Boolean));
    }

    // Add participant names
    meeting.participants.forEach(participant => {
      if (participant.name) {
        textParts.push(participant.name);
      }
    });

    return textParts.join(' ').toLowerCase();
  }

  /**
   * Generate a unique record ID
   */
  private generateRecordId(meeting: MeetingRecord): string {
    const baseString = `${meeting.id || meeting.title}-${meeting.startTime}`;

    // Simple hash function for ID generation
    let hash = 0;
    for (let i = 0; i < baseString.length; i++) {
      const char = baseString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return `meeting-${Math.abs(hash).toString(16)}`;
  }
}
