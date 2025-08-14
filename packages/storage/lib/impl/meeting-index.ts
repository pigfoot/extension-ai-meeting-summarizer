/**
 * Meeting Metadata Index
 * Implements searchable text indexing for meeting content with
 * date, participant, and keyword search functionality for efficient retrieval.
 */

import type { MeetingStorageRecord, MeetingSearchIndex, SpeakerInfo } from '../types/meeting';

export interface MeetingSearchCriteria {
  query?: string;
  keywords?: string[];
  participants?: SpeakerInfo[];
  participant?: string; // For backwards compatibility
  dateRange?: { start: string; end: string };
  startDate?: string;
  endDate?: string;
  tags?: string[];
  status?: string[];
  source?: string[];
  sortBy?: 'startTime' | 'title' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

/**
 * Index update operation types
 */
export type IndexOperation = 'add' | 'update' | 'remove' | 'rebuild';

/**
 * Index statistics for monitoring and optimization
 */
export interface IndexStats {
  /** Total number of indexed meetings */
  totalMeetings: number;
  /** Total number of search terms */
  totalTerms: number;
  /** Total number of participants */
  totalParticipants: number;
  /** Total number of tags */
  totalTags: number;
  /** Index size in bytes */
  indexSize: number;
  /** Last index update timestamp */
  lastUpdated: string;
  /** Index update frequency per hour */
  updateFrequency: number;
  /** Search performance metrics */
  searchMetrics: {
    /** Average search time in milliseconds */
    averageSearchTime: number;
    /** Total searches performed */
    totalSearches: number;
    /** Cache hit rate */
    cacheHitRate: number;
  };
}

/**
 * Search result with relevance scoring
 */
export interface IndexedSearchResult {
  /** Meeting record ID */
  meetingId: string;
  /** Relevance score (0-1) */
  relevance: number;
  /** Matching search terms */
  matchingTerms: string[];
  /** Context snippets for matched terms */
  snippets: Array<{
    /** Text snippet containing the match */
    text: string;
    /** Highlighted match within the snippet */
    highlight: string;
    /** Field where the match was found */
    field: string;
  }>;
}

/**
 * Meeting metadata index for efficient search and retrieval
 */
export class MeetingIndex {
  // Primary search indexes
  private termIndex: Map<string, Set<string>> = new Map();
  private participantIndex: Map<string, Set<string>> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();
  private dateIndex: Map<string, Set<string>> = new Map();

  // Metadata tracking
  private meetingMetadata: Map<string, MeetingSearchIndex> = new Map();
  private indexStats: IndexStats;
  private searchCache: Map<string, IndexedSearchResult[]> = new Map();

  // Configuration
  private readonly maxCacheSize = 100;
  private readonly minTermLength = 2;
  private readonly maxTermLength = 50;
  private readonly stopWords = new Set([
    'the',
    'be',
    'to',
    'of',
    'and',
    'a',
    'in',
    'that',
    'have',
    'i',
    'it',
    'for',
    'not',
    'on',
    'with',
    'he',
    'as',
    'you',
    'do',
    'at',
    'this',
    'but',
    'his',
    'by',
    'from',
  ]);

  constructor() {
    this.indexStats = {
      totalMeetings: 0,
      totalTerms: 0,
      totalParticipants: 0,
      totalTags: 0,
      indexSize: 0,
      lastUpdated: new Date().toISOString(),
      updateFrequency: 0,
      searchMetrics: {
        averageSearchTime: 0,
        totalSearches: 0,
        cacheHitRate: 0,
      },
    };
  }

  /**
   * Add or update a meeting in the index
   */
  public indexMeeting(record: MeetingStorageRecord): void {
    const startTime = Date.now();

    try {
      // Remove existing index entries if updating
      if (this.meetingMetadata.has(record.id)) {
        this.removeMeetingFromIndex(record.id);
      }

      // Extract and index search terms
      const searchTerms = this.extractSearchTerms(record);
      this.indexTerms(record.id, searchTerms);

      // Index participants
      this.indexParticipants(record.id, record.meeting.participants);

      // Index tags
      this.indexTags(record.id, record.tags);

      // Index date
      if (record.meeting.startTime) {
        const startTimeStr =
          typeof record.meeting.startTime === 'string'
            ? record.meeting.startTime
            : new Date(record.meeting.startTime).toISOString();
        this.indexDate(record.id, startTimeStr);
      }

      // Create and store metadata
      const metadata: MeetingSearchIndex = {
        meetingId: record.id,
        searchTerms,
        fullTextContent: record.searchableText,
        participantNames: record.meeting.participants
          .map(p => p.name)
          .filter((name): name is string => name !== undefined),
        tags: record.tags,
        indexMetadata: {
          indexedAt: new Date().toISOString(),
          indexVersion: '1.0.0',
          termCount: searchTerms.length,
        },
      };

      this.meetingMetadata.set(record.id, metadata);

      // Update statistics
      this.updateIndexStats();

      // Clear search cache since index changed
      this.clearSearchCache();

      const duration = Date.now() - startTime;
      console.debug(`Indexed meeting ${record.id} in ${duration}ms`);
    } catch (error) {
      console.error('Failed to index meeting:', error);
    }
  }

  /**
   * Remove a meeting from the index
   */
  public removeMeeting(meetingId: string): void {
    this.removeMeetingFromIndex(meetingId);
    this.updateIndexStats();
    this.clearSearchCache();
  }

  /**
   * Search meetings using the index
   */
  public searchMeetings(criteria: MeetingSearchCriteria): IndexedSearchResult[] {
    const startTime = Date.now();

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(criteria);
      if (this.searchCache.has(cacheKey)) {
        this.updateSearchMetrics(Date.now() - startTime, true);
        return this.searchCache.get(cacheKey)!;
      }

      let candidateIds = new Set<string>();
      let isFirstFilter = true;

      // Text search
      if (criteria.query) {
        const queryTerms = this.normalizeText(criteria.query)
          .split(/\s+/)
          .filter(term => term.length >= this.minTermLength);

        const textMatches = this.searchByTerms(queryTerms);
        if (isFirstFilter) {
          candidateIds = textMatches;
          isFirstFilter = false;
        } else {
          candidateIds = this.intersectSets(candidateIds, textMatches);
        }
      }

      // Participant search
      if (criteria.participant) {
        const participantMatches = this.searchByParticipant(criteria.participant);
        if (isFirstFilter) {
          candidateIds = participantMatches;
          isFirstFilter = false;
        } else {
          candidateIds = this.intersectSets(candidateIds, participantMatches);
        }
      }

      // Tag search
      if (criteria.tags && criteria.tags.length > 0) {
        const tagMatches = this.searchByTags(criteria.tags);
        if (isFirstFilter) {
          candidateIds = tagMatches;
          isFirstFilter = false;
        } else {
          candidateIds = this.intersectSets(candidateIds, tagMatches);
        }
      }

      // Date range search
      if (criteria.startDate || criteria.endDate) {
        const dateMatches = this.searchByDateRange(criteria.startDate, criteria.endDate);
        if (isFirstFilter) {
          candidateIds = dateMatches;
          isFirstFilter = false;
        } else {
          candidateIds = this.intersectSets(candidateIds, dateMatches);
        }
      }

      // If no filters were applied, return all meetings
      if (isFirstFilter) {
        candidateIds = new Set(this.meetingMetadata.keys());
      }

      // Calculate relevance scores and create results
      const results = this.calculateRelevanceScores(Array.from(candidateIds), criteria);

      // Sort by relevance
      results.sort((a, b) => b.relevance - a.relevance);

      // Apply pagination limits if specified
      const page = criteria.page ?? 1;
      const limit = criteria.limit ?? 20;
      const startIndex = (page - 1) * limit;
      const paginatedResults = results.slice(startIndex, startIndex + limit);

      // Cache results
      this.cacheSearchResults(cacheKey, paginatedResults);

      const duration = Date.now() - startTime;
      this.updateSearchMetrics(duration, false);

      return paginatedResults;
    } catch (error) {
      console.error('Search failed:', error);
      return [];
    }
  }

  /**
   * Rebuild the entire index from meeting records
   */
  public rebuildIndex(records: MeetingStorageRecord[]): void {
    console.info('Rebuilding meeting index...');

    // Clear all indexes
    this.clearAllIndexes();

    // Re-index all records
    for (const record of records) {
      this.indexMeeting(record);
    }

    console.info(`Index rebuilt with ${records.length} meetings`);
  }

  /**
   * Get index statistics
   */
  public getIndexStats(): IndexStats {
    return { ...this.indexStats };
  }

  /**
   * Get suggestions for search terms
   */
  public getSuggestions(partial: string, maxSuggestions = 10): string[] {
    const normalizedPartial = this.normalizeText(partial);
    const suggestions: Array<{ term: string; frequency: number }> = [];

    for (const [term, meetingIds] of this.termIndex.entries()) {
      if (term.startsWith(normalizedPartial) && term !== normalizedPartial) {
        suggestions.push({
          term,
          frequency: meetingIds.size,
        });
      }
    }

    // Sort by frequency and return top suggestions
    return suggestions
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, maxSuggestions)
      .map(s => s.term);
  }

  /**
   * Extract search terms from a meeting record
   */
  private extractSearchTerms(record: MeetingStorageRecord): string[] {
    const terms = new Set<string>();

    // Extract from meeting title
    if (record.meeting.title) {
      this.addTermsFromText(record.meeting.title, terms);
    }

    // Extract from meeting description
    if (record.meeting.description) {
      this.addTermsFromText(record.meeting.description, terms);
    }

    // Extract from searchable text
    if (record.searchableText) {
      this.addTermsFromText(record.searchableText, terms);
    }

    // Extract from transcription
    if (record.meeting.transcription) {
      this.addTermsFromText(record.meeting.transcription.fullText, terms);
    }

    // Extract from summary
    if (record.meeting.summary) {
      if (record.meeting.summary.overview) {
        this.addTermsFromText(record.meeting.summary.overview, terms);
      }
      record.meeting.summary.keyPoints.forEach(point => {
        if (point) {
          this.addTermsFromText(point, terms);
        }
      });
      record.meeting.summary.decisions.forEach(decision => {
        if (decision) {
          this.addTermsFromText(decision, terms);
        }
      });
    }

    return Array.from(terms);
  }

  /**
   * Add terms from text to a set
   */
  private addTermsFromText(text: string, terms: Set<string>): void {
    const normalizedText = this.normalizeText(text);
    const words = normalizedText.split(/\s+/);

    for (const word of words) {
      if (this.isValidTerm(word)) {
        terms.add(word);
      }
    }
  }

  /**
   * Normalize text for indexing
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Check if a term is valid for indexing
   */
  private isValidTerm(term: string): boolean {
    return (
      term.length >= this.minTermLength &&
      term.length <= this.maxTermLength &&
      !this.stopWords.has(term) &&
      !/^\d+$/.test(term) // Exclude pure numbers
    );
  }

  /**
   * Index search terms for a meeting
   */
  private indexTerms(meetingId: string, terms: string[]): void {
    for (const term of terms) {
      if (!this.termIndex.has(term)) {
        this.termIndex.set(term, new Set());
      }
      this.termIndex.get(term)!.add(meetingId);
    }
  }

  /**
   * Index participants for a meeting
   */
  private indexParticipants(meetingId: string, participants: SpeakerInfo[]): void {
    for (const participant of participants) {
      const normalizedName = participant.name ? this.normalizeText(participant.name) : '';
      const normalizedEmail = participant.email ? this.normalizeText(participant.email) : '';

      // Index by name
      if (!this.participantIndex.has(normalizedName)) {
        this.participantIndex.set(normalizedName, new Set());
      }
      this.participantIndex.get(normalizedName)!.add(meetingId);

      // Index by email
      if (!this.participantIndex.has(normalizedEmail)) {
        this.participantIndex.set(normalizedEmail, new Set());
      }
      this.participantIndex.get(normalizedEmail)!.add(meetingId);
    }
  }

  /**
   * Index tags for a meeting
   */
  private indexTags(meetingId: string, tags: string[]): void {
    for (const tag of tags) {
      const normalizedTag = this.normalizeText(tag);
      if (!this.tagIndex.has(normalizedTag)) {
        this.tagIndex.set(normalizedTag, new Set());
      }
      this.tagIndex.get(normalizedTag)!.add(meetingId);
    }
  }

  /**
   * Index date for a meeting
   */
  private indexDate(meetingId: string, startTime: string): void {
    const date = new Date(startTime);
    const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD format

    if (dateKey && !this.dateIndex.has(dateKey)) {
      this.dateIndex.set(dateKey, new Set());
    }
    if (dateKey) {
      this.dateIndex.get(dateKey)!.add(meetingId);
    }
  }

  /**
   * Remove a meeting from all indexes
   */
  private removeMeetingFromIndex(meetingId: string): void {
    // Remove from term index
    for (const [term, meetingIds] of this.termIndex.entries()) {
      meetingIds.delete(meetingId);
      if (meetingIds.size === 0) {
        this.termIndex.delete(term);
      }
    }

    // Remove from participant index
    for (const [participant, meetingIds] of this.participantIndex.entries()) {
      meetingIds.delete(meetingId);
      if (meetingIds.size === 0) {
        this.participantIndex.delete(participant);
      }
    }

    // Remove from tag index
    for (const [tag, meetingIds] of this.tagIndex.entries()) {
      meetingIds.delete(meetingId);
      if (meetingIds.size === 0) {
        this.tagIndex.delete(tag);
      }
    }

    // Remove from date index
    for (const [date, meetingIds] of this.dateIndex.entries()) {
      meetingIds.delete(meetingId);
      if (meetingIds.size === 0) {
        this.dateIndex.delete(date);
      }
    }

    // Remove metadata
    this.meetingMetadata.delete(meetingId);
  }

  /**
   * Search by terms
   */
  private searchByTerms(terms: string[]): Set<string> {
    if (terms.length === 0) return new Set();

    const results = new Set<string>();
    let isFirstTerm = true;

    for (const term of terms) {
      const termMatches = this.termIndex.get(term) || new Set();

      if (isFirstTerm) {
        termMatches.forEach(id => results.add(id));
        isFirstTerm = false;
      } else {
        // Intersection with previous results
        const intersection = new Set<string>();
        for (const id of results) {
          if (termMatches.has(id)) {
            intersection.add(id);
          }
        }
        results.clear();
        intersection.forEach(id => results.add(id));
      }
    }

    return results;
  }

  /**
   * Search by participant
   */
  private searchByParticipant(participant: string): Set<string> {
    const normalizedParticipant = this.normalizeText(participant);
    const results = new Set<string>();

    for (const [indexedParticipant, meetingIds] of this.participantIndex.entries()) {
      if (indexedParticipant.includes(normalizedParticipant)) {
        meetingIds.forEach(id => results.add(id));
      }
    }

    return results;
  }

  /**
   * Search by tags
   */
  private searchByTags(tags: string[]): Set<string> {
    const results = new Set<string>();

    for (const tag of tags) {
      const normalizedTag = this.normalizeText(tag);
      const tagMatches = this.tagIndex.get(normalizedTag);
      if (tagMatches) {
        tagMatches.forEach(id => results.add(id));
      }
    }

    return results;
  }

  /**
   * Search by date range
   */
  private searchByDateRange(startDate?: string, endDate?: string): Set<string> {
    const results = new Set<string>();

    for (const [dateKey, meetingIds] of this.dateIndex.entries()) {
      const meetingDate = new Date(dateKey);

      let inRange = true;

      if (startDate) {
        const start = new Date(startDate);
        if (meetingDate < start) inRange = false;
      }

      if (endDate) {
        const end = new Date(endDate);
        if (meetingDate > end) inRange = false;
      }

      if (inRange) {
        meetingIds.forEach(id => results.add(id));
      }
    }

    return results;
  }

  /**
   * Calculate relevance scores for search results
   */
  private calculateRelevanceScores(meetingIds: string[], criteria: MeetingSearchCriteria): IndexedSearchResult[] {
    return meetingIds.map(meetingId => {
      const metadata = this.meetingMetadata.get(meetingId);
      if (!metadata) {
        return {
          meetingId,
          relevance: 0,
          matchingTerms: [],
          snippets: [],
        };
      }

      let relevance = 0;
      const matchingTerms: string[] = [];
      const snippets: Array<{ text: string; highlight: string; field: string }> = [];

      // Calculate relevance based on query terms
      if (criteria.query) {
        const queryTerms = this.normalizeText(criteria.query).split(/\s+/);
        for (const term of queryTerms) {
          if (metadata.searchTerms.includes(term)) {
            matchingTerms.push(term);
            relevance += 0.3;
          }
        }

        // Add snippets from full text content
        for (const term of queryTerms) {
          const snippet = this.extractSnippet(metadata.fullTextContent, term);
          if (snippet) {
            snippets.push({
              text: snippet,
              highlight: term,
              field: 'content',
            });
          }
        }
      }

      // Boost relevance for participant matches
      if (criteria.participant) {
        const normalizedParticipant = this.normalizeText(criteria.participant);
        for (const participantName of metadata.participantNames) {
          if (this.normalizeText(participantName).includes(normalizedParticipant)) {
            relevance += 0.2;
          }
        }
      }

      // Boost relevance for tag matches
      if (criteria.tags) {
        for (const tag of criteria.tags) {
          if (metadata.tags.includes(tag)) {
            relevance += 0.1;
          }
        }
      }

      return {
        meetingId,
        relevance: Math.min(1, relevance),
        matchingTerms,
        snippets: snippets.slice(0, 3), // Limit to 3 snippets
      };
    });
  }

  /**
   * Extract text snippet around a search term
   */
  private extractSnippet(text: string, term: string, contextLength = 100): string | null {
    const normalizedText = this.normalizeText(text);
    const normalizedTerm = this.normalizeText(term);
    const index = normalizedText.indexOf(normalizedTerm);

    if (index === -1) return null;

    const start = Math.max(0, index - contextLength / 2);
    const end = Math.min(text.length, index + term.length + contextLength / 2);

    let snippet = text.substring(start, end);

    // Add ellipsis if truncated
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';

    return snippet;
  }

  /**
   * Intersect two sets
   */
  private intersectSets<T>(set1: Set<T>, set2: Set<T>): Set<T> {
    const intersection = new Set<T>();
    for (const item of set1) {
      if (set2.has(item)) {
        intersection.add(item);
      }
    }
    return intersection;
  }

  /**
   * Generate cache key for search criteria
   */
  private generateCacheKey(criteria: MeetingSearchCriteria): string {
    return JSON.stringify(criteria);
  }

  /**
   * Cache search results
   */
  private cacheSearchResults(key: string, results: IndexedSearchResult[]): void {
    if (this.searchCache.size >= this.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.searchCache.keys().next().value;
      if (firstKey !== undefined) {
        this.searchCache.delete(firstKey);
      }
    }

    this.searchCache.set(key, results);
  }

  /**
   * Clear search cache
   */
  private clearSearchCache(): void {
    this.searchCache.clear();
  }

  /**
   * Clear all indexes
   */
  private clearAllIndexes(): void {
    this.termIndex.clear();
    this.participantIndex.clear();
    this.tagIndex.clear();
    this.dateIndex.clear();
    this.meetingMetadata.clear();
    this.clearSearchCache();
  }

  /**
   * Update index statistics
   */
  private updateIndexStats(): void {
    this.indexStats.totalMeetings = this.meetingMetadata.size;
    this.indexStats.totalTerms = this.termIndex.size;
    this.indexStats.totalParticipants = this.participantIndex.size;
    this.indexStats.totalTags = this.tagIndex.size;
    this.indexStats.lastUpdated = new Date().toISOString();

    // Estimate index size (rough approximation)
    this.indexStats.indexSize =
      this.termIndex.size * 20 + // Average term size
      this.participantIndex.size * 30 + // Average participant size
      this.tagIndex.size * 15 + // Average tag size
      this.meetingMetadata.size * 500; // Average metadata size
  }

  /**
   * Update search metrics
   */
  private updateSearchMetrics(duration: number, cacheHit: boolean): void {
    this.indexStats.searchMetrics.totalSearches++;

    const currentAvg = this.indexStats.searchMetrics.averageSearchTime;
    const totalSearches = this.indexStats.searchMetrics.totalSearches;
    this.indexStats.searchMetrics.averageSearchTime = (currentAvg * (totalSearches - 1) + duration) / totalSearches;

    if (cacheHit) {
      const currentHitRate = this.indexStats.searchMetrics.cacheHitRate;
      this.indexStats.searchMetrics.cacheHitRate = (currentHitRate * (totalSearches - 1) + 1) / totalSearches;
    } else {
      const currentHitRate = this.indexStats.searchMetrics.cacheHitRate;
      this.indexStats.searchMetrics.cacheHitRate = (currentHitRate * (totalSearches - 1)) / totalSearches;
    }
  }
}
