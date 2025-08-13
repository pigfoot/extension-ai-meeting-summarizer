/**
 * Metadata Extractor
 * Extracts meeting title, date, organizer, and other metadata from page content
 */

import type { MeetingMetadata } from '../types/index';

/**
 * Comprehensive meeting metadata extraction from page content
 */
export class MetadataExtractor {
  private extractionPatterns: Map<string, ExtractionPattern[]> = new Map();
  private dateFormats: RegExp[] = [];
  private titlePatterns: RegExp[] = [];

  constructor() {
    this.initializeExtractionPatterns();
    this.initializeDateFormats();
    this.initializeTitlePatterns();
  }

  /**
   * Extract comprehensive meeting metadata from page
   */
  extractMeetingMetadata(document: Document, url: string): MeetingMetadata {
    const metadata: Partial<MeetingMetadata> = {
      participants: [],
      topics: [],
    };

    try {
      // Extract meeting title
      metadata.title = this.extractMeetingTitle(document);

      // Extract meeting date and time
      metadata.date = this.extractMeetingDate(document);

      // Extract meeting organizer
      metadata.organizer = this.extractOrganizer(document);

      // Extract participants list
      metadata.participants = this.extractParticipants(document);

      // Extract meeting duration
      metadata.duration = this.extractDuration(document);

      // Extract meeting topics
      metadata.topics = this.extractTopics(document);

      // Extract platform-specific IDs
      metadata.platformIds = this.extractPlatformIds(document, url);

      // Extract meeting location
      metadata.location = this.extractLocation(document);

      // Extract permissions
      metadata.permissions = this.extractPermissions(document);
    } catch (error) {
      console.error('Metadata extraction error:', error);
    }

    return {
      title: metadata.title || 'Unknown Meeting',
      participants: metadata.participants || [],
      topics: metadata.topics || [],
      date: metadata.date,
      organizer: metadata.organizer,
      duration: metadata.duration,
      platformIds: metadata.platformIds,
      location: metadata.location,
      permissions: metadata.permissions,
    };
  }

  /**
   * Extract meeting title from various sources
   */
  extractMeetingTitle(document: Document): string {
    const titleSources = [
      // Primary title sources
      () =>
        this.extractFromSelectors(document, [
          'h1[data-automation-id*="meeting"]',
          '[data-tid="meeting-title"]',
          '.meeting-title',
          '.conversation-title',
          '.channel-name',
        ]),

      // Secondary title sources
      () => this.extractFromSelectors(document, ['h1', 'h2', '.page-title', '.content-title']),

      // Document title
      () => this.extractFromDocumentTitle(document),

      // Meta tags
      () => this.extractFromMetaTags(document, ['og:title', 'twitter:title']),

      // Breadcrumb navigation
      () => this.extractFromBreadcrumbs(document),
    ];

    for (const source of titleSources) {
      const title = source();
      if (title && this.isMeetingTitle(title)) {
        return this.cleanTitle(title);
      }
    }

    return '';
  }

  /**
   * Extract meeting date and time
   */
  extractMeetingDate(document: Document): Date | undefined {
    const dateSources = [
      // Structured date elements
      () => this.extractFromTimeElements(document),

      // Date attributes
      () => this.extractFromDateAttributes(document),

      // Text content parsing
      () => this.extractFromTextContent(document),

      // Meta tags
      () => this.extractDateFromMetaTags(document, ['article:published_time', 'meeting:date']),
    ];

    for (const source of dateSources) {
      const date = source();
      if (date && this.isValidMeetingDate(date)) {
        return date;
      }
    }

    return undefined;
  }

  /**
   * Extract meeting organizer information
   */
  extractOrganizer(document: Document): string | undefined {
    const organizerSources = [
      // Specific organizer elements
      () =>
        this.extractFromSelectors(document, [
          '[data-tid="organizer"]',
          '.meeting-organizer',
          '.organizer-name',
          '.created-by',
          '.author',
        ]),

      // User profile elements
      () => this.extractFromUserProfiles(document),

      // Meta tags
      () => this.extractFromMetaTags(document, ['author', 'creator']),

      // Structured data
      () => this.extractFromStructuredData(document, 'organizer'),
    ];

    for (const source of organizerSources) {
      const organizer = source();
      if (organizer && this.isValidPersonName(organizer)) {
        return this.cleanPersonName(organizer);
      }
    }

    return undefined;
  }

  /**
   * Extract meeting participants
   */
  extractParticipants(document: Document): string[] {
    const participants: string[] = [];

    try {
      const participantSources = [
        // Participant list elements
        () => this.extractFromParticipantLists(document),

        // Attendee elements
        () => this.extractFromAttendeeElements(document),

        // User mentions in content
        () => this.extractFromUserMentions(document),

        // Avatar/profile elements
        () => this.extractFromAvatarElements(document),
      ];

      for (const source of participantSources) {
        const sourceParticipants = source();
        participants.push(...sourceParticipants);
      }

      // Remove duplicates and clean names
      const uniqueParticipants = [...new Set(participants)]
        .filter(name => this.isValidPersonName(name))
        .map(name => this.cleanPersonName(name));

      return uniqueParticipants;
    } catch (error) {
      console.error('Participant extraction error:', error);
      return [];
    }
  }

  /**
   * Extract meeting duration
   */
  extractDuration(document: Document): number | undefined {
    const durationSources = [
      // Duration attributes
      () => this.extractFromDurationAttributes(document),

      // Media duration
      () => this.extractFromMediaElements(document),

      // Text content duration
      () => this.extractDurationFromText(document),

      // Structured data
      () => this.extractFromStructuredData(document, 'duration'),
    ];

    for (const source of durationSources) {
      const duration = source();
      if (duration && duration > 0) {
        return duration;
      }
    }

    return undefined;
  }

  /**
   * Extract meeting topics and agenda items
   */
  extractTopics(document: Document): string[] {
    const topics: string[] = [];

    try {
      const topicSources = [
        // Agenda items
        () => this.extractFromAgendaElements(document),

        // Topic/subject elements
        () => this.extractFromTopicElements(document),

        // Content headings
        () => this.extractFromContentHeadings(document),

        // Tag elements
        () => this.extractFromTagElements(document),

        // Text analysis
        () => this.extractTopicsFromContent(document),
      ];

      for (const source of topicSources) {
        const sourceTopics = source();
        topics.push(...sourceTopics);
      }

      // Remove duplicates and clean topics
      const uniqueTopics = [...new Set(topics)]
        .filter(topic => this.isValidTopic(topic))
        .map(topic => this.cleanTopic(topic));

      return uniqueTopics.slice(0, 10); // Limit to top 10 topics
    } catch (error) {
      console.error('Topic extraction error:', error);
      return [];
    }
  }

  // Private methods

  private initializeExtractionPatterns(): void {
    // SharePoint patterns
    this.extractionPatterns.set('sharepoint', [
      {
        type: 'title',
        selectors: ['.ms-core-pageTitle', '[data-automation-id="pageTitle"]'],
        attribute: 'textContent',
        confidence: 0.9,
      },
      {
        type: 'organizer',
        selectors: ['.ms-DocumentCard-details .ms-DocumentCard-title'],
        attribute: 'textContent',
        confidence: 0.7,
      },
    ]);

    // Teams patterns
    this.extractionPatterns.set('teams', [
      {
        type: 'title',
        selectors: ['[data-tid="meeting-title"]', '.ts-title'],
        attribute: 'textContent',
        confidence: 0.95,
      },
      {
        type: 'participants',
        selectors: ['[data-tid="participant"]', '.participant-name'],
        attribute: 'textContent',
        confidence: 0.8,
      },
    ]);
  }

  private initializeDateFormats(): void {
    this.dateFormats = [
      // ISO formats
      /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      /\d{4}-\d{2}-\d{2}/,

      // Common formats
      /\d{1,2}\/\d{1,2}\/\d{4}/,
      /\d{1,2}-\d{1,2}-\d{4}/,
      /\d{4}\/\d{1,2}\/\d{1,2}/,

      // Written formats
      /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i,
      /\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/i,

      // Time formats
      /\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?/i,
    ];
  }

  private initializeTitlePatterns(): void {
    this.titlePatterns = [
      /meeting/i,
      /call/i,
      /conference/i,
      /discussion/i,
      /session/i,
      /standup/i,
      /sync/i,
      /review/i,
      /planning/i,
      /retrospective/i,
    ];
  }

  private extractFromSelectors(document: Document, selectors: string[]): string {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element?.textContent?.trim()) {
        return element.textContent.trim();
      }
    }
    return '';
  }

  private extractFromDocumentTitle(document: Document): string {
    return document.title?.trim() || '';
  }

  private extractFromMetaTags(document: Document, properties: string[]): string {
    for (const property of properties) {
      const meta = document.querySelector(`meta[property="${property}"], meta[name="${property}"]`);
      const content = meta?.getAttribute('content');
      if (content?.trim()) {
        return content.trim();
      }
    }
    return '';
  }

  private extractDateFromMetaTags(document: Document, properties: string[]): Date | undefined {
    for (const property of properties) {
      const meta = document.querySelector(`meta[property="${property}"], meta[name="${property}"]`);
      const content = meta?.getAttribute('content');
      if (content?.trim()) {
        try {
          return new Date(content.trim());
        } catch {
          continue;
        }
      }
    }
    return undefined;
  }

  private extractFromBreadcrumbs(document: Document): string {
    const breadcrumbSelectors = [
      '.breadcrumb .active',
      '.breadcrumb li:last-child',
      '[aria-label*="breadcrumb"] li:last-child',
      '.navigation-breadcrumb .current',
    ];

    return this.extractFromSelectors(document, breadcrumbSelectors);
  }

  private extractFromTimeElements(document: Document): Date | undefined {
    const timeElements = document.querySelectorAll('time[datetime]');

    for (const timeElement of timeElements) {
      const datetime = timeElement.getAttribute('datetime');
      if (datetime) {
        try {
          return new Date(datetime);
        } catch {
          continue;
        }
      }
    }

    return undefined;
  }

  private extractFromDateAttributes(document: Document): Date | undefined {
    const dateAttributes = ['data-date', 'data-datetime', 'data-created', 'data-modified', 'data-meeting-date'];

    for (const attr of dateAttributes) {
      const elements = document.querySelectorAll(`[${attr}]`);
      for (const element of elements) {
        const dateValue = element.getAttribute(attr);
        if (dateValue) {
          try {
            return new Date(dateValue);
          } catch {
            continue;
          }
        }
      }
    }

    return undefined;
  }

  private extractFromTextContent(document: Document): Date | undefined {
    const textContent = document.body.textContent || '';

    for (const pattern of this.dateFormats) {
      const match = textContent.match(pattern);
      if (match) {
        try {
          return new Date(match[0]);
        } catch {
          continue;
        }
      }
    }

    return undefined;
  }

  private extractFromUserProfiles(document: Document): string {
    const profileSelectors = [
      '.user-profile .name',
      '.profile-card .display-name',
      '.author-info .name',
      '.user-info .full-name',
    ];

    return this.extractFromSelectors(document, profileSelectors);
  }

  private extractFromStructuredData(document: Document, property: string): unknown {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');

    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent || '');
        if (data[property]) {
          return data[property];
        }
      } catch {
        continue;
      }
    }

    return undefined;
  }

  private extractFromParticipantLists(document: Document): string[] {
    const participants: string[] = [];
    const listSelectors = [
      '.participant-list .participant',
      '.attendee-list .attendee',
      '.member-list .member',
      '[data-automation-id="participants"] .name',
    ];

    for (const selector of listSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const name = element.textContent?.trim();
        if (name) {
          participants.push(name);
        }
      }
    }

    return participants;
  }

  private extractFromAttendeeElements(document: Document): string[] {
    const attendeeSelectors = ['[data-tid="attendee"]', '.attendee-name', '.participant-display-name'];

    return this.extractTextFromElements(document, attendeeSelectors);
  }

  private extractFromUserMentions(document: Document): string[] {
    const mentions: string[] = [];
    const mentionPatterns = [/@([A-Za-z\s]+)/g, /@\[([^\]]+)\]/g];

    const textContent = document.body.textContent || '';

    for (const pattern of mentionPatterns) {
      const matches = textContent.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          mentions.push(match[1].trim());
        }
      }
    }

    return mentions;
  }

  private extractFromAvatarElements(document: Document): string[] {
    const avatars: string[] = [];
    const avatarSelectors = ['.avatar[title]', '.user-avatar[alt]', '.profile-picture[title]'];

    for (const selector of avatarSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const name = element.getAttribute('title') || element.getAttribute('alt');
        if (name?.trim()) {
          avatars.push(name.trim());
        }
      }
    }

    return avatars;
  }

  private extractFromDurationAttributes(document: Document): number | undefined {
    const durationSelectors = ['[data-duration]', '[duration]', '[data-length]'];

    for (const selector of durationSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const duration =
          element.getAttribute('data-duration') ||
          element.getAttribute('duration') ||
          element.getAttribute('data-length');
        if (duration) {
          const parsed = this.parseDuration(duration);
          if (parsed) return parsed;
        }
      }
    }

    return undefined;
  }

  private extractFromMediaElements(document: Document): number | undefined {
    const mediaElements = document.querySelectorAll('audio, video');

    for (const media of mediaElements) {
      const htmlMedia = media as HTMLMediaElement;
      if (htmlMedia.duration && !isNaN(htmlMedia.duration)) {
        return htmlMedia.duration;
      }
    }

    return undefined;
  }

  private extractDurationFromText(document: Document): number | undefined {
    const textContent = document.body.textContent || '';
    const durationPatterns = [
      /duration:?\s*(\d+:\d+(?::\d+)?)/i,
      /length:?\s*(\d+:\d+(?::\d+)?)/i,
      /(\d+)\s*(?:hours?|hrs?)/i,
      /(\d+)\s*(?:minutes?|mins?)/i,
    ];

    for (const pattern of durationPatterns) {
      const match = textContent.match(pattern);
      if (match && match[1]) {
        const parsed = this.parseDuration(match[1]);
        if (parsed) return parsed;
      }
    }

    return undefined;
  }

  private extractFromAgendaElements(document: Document): string[] {
    const agendaSelectors = ['.agenda-item', '.agenda li', '[data-automation-id="agenda"] li', '.meeting-agenda .item'];

    return this.extractTextFromElements(document, agendaSelectors);
  }

  private extractFromTopicElements(document: Document): string[] {
    const topicSelectors = ['.topic', '.subject', '.meeting-topic', '[data-topic]'];

    return this.extractTextFromElements(document, topicSelectors);
  }

  private extractFromContentHeadings(document: Document): string[] {
    const headings: string[] = [];
    const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');

    for (const heading of headingElements) {
      const text = heading.textContent?.trim();
      if (text && text.length > 3 && text.length < 100) {
        headings.push(text);
      }
    }

    return headings;
  }

  private extractFromTagElements(document: Document): string[] {
    const tagSelectors = ['.tag', '.label', '.category', '.keyword'];

    return this.extractTextFromElements(document, tagSelectors);
  }

  private extractTopicsFromContent(document: Document): string[] {
    // Simple topic extraction from text content
    const content = document.body.textContent || '';
    const sentences = content
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 10 && s.length < 200);

    return sentences.slice(0, 5); // Return first 5 meaningful sentences as topics
  }

  private extractTextFromElements(document: Document, selectors: string[]): string[] {
    const texts: string[] = [];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const text = element.textContent?.trim();
        if (text) {
          texts.push(text);
        }
      }
    }

    return texts;
  }

  // Validation and cleaning methods

  private isMeetingTitle(title: string): boolean {
    if (!title || title.length < 3 || title.length > 200) {
      return false;
    }

    // Check for meeting-related keywords
    return this.titlePatterns.some(pattern => pattern.test(title));
  }

  private isValidMeetingDate(date: Date): boolean {
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

    return date >= oneYearAgo && date <= oneYearFromNow;
  }

  private isValidPersonName(name: string): boolean {
    if (!name || name.length < 2 || name.length > 100) {
      return false;
    }

    // Basic validation for person names
    const namePattern = /^[A-Za-z\s,.-]+$/;
    return namePattern.test(name) && !name.includes('@');
  }

  private isValidTopic(topic: string): boolean {
    return Boolean(topic) && topic.length >= 3 && topic.length <= 500;
  }

  private cleanTitle(title: string): string {
    return title.replace(/^\s*-\s*/, '').trim();
  }

  private cleanPersonName(name: string): string {
    return name.replace(/[,()]/g, '').trim();
  }

  private cleanTopic(topic: string): string {
    return topic.replace(/^[-•*]\s*/, '').trim();
  }

  private parseDuration(durationStr: string): number | undefined {
    try {
      // Parse HH:MM:SS or MM:SS format
      const timeParts = durationStr
        .split(':')
        .map(p => parseInt(p.trim()))
        .filter(p => !isNaN(p));

      if (
        timeParts.length === 3 &&
        timeParts[0] !== undefined &&
        timeParts[1] !== undefined &&
        timeParts[2] !== undefined
      ) {
        return timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
      } else if (timeParts.length === 2 && timeParts[0] !== undefined && timeParts[1] !== undefined) {
        return timeParts[0] * 60 + timeParts[1];
      } else if (timeParts.length === 1 && timeParts[0] !== undefined) {
        return timeParts[0] * 60; // Assume minutes
      }
    } catch {
      // Try parsing as number (assume seconds)
      const num = parseInt(durationStr);
      if (!isNaN(num)) {
        return num;
      }
    }

    return undefined;
  }

  private extractPlatformIds(document: Document, url: string): Record<string, unknown> {
    const ids: Record<string, unknown> = {};

    // Extract from URL
    try {
      const urlObj = new URL(url);
      ids.meetingId = urlObj.searchParams.get('meetingId');
      ids.threadId = urlObj.searchParams.get('threadId');
      ids.channelId = urlObj.searchParams.get('channelId');
    } catch {
      // Ignore URL parsing errors
    }

    // Extract from data attributes
    const dataElements = document.querySelectorAll('[data-meeting-id], [data-thread-id], [data-channel-id]');
    for (const element of dataElements) {
      if (element.hasAttribute('data-meeting-id')) {
        ids.meetingId = element.getAttribute('data-meeting-id');
      }
      if (element.hasAttribute('data-thread-id')) {
        ids.threadId = element.getAttribute('data-thread-id');
      }
      if (element.hasAttribute('data-channel-id')) {
        ids.channelId = element.getAttribute('data-channel-id');
      }
    }

    return Object.keys(ids).length > 0 ? ids : undefined;
  }

  private extractLocation(document: Document): string | undefined {
    const locationSelectors = ['[data-tid="meeting-location"]', '.meeting-location', '.location', '[data-location]'];

    return this.extractFromSelectors(document, locationSelectors) || undefined;
  }

  private extractPermissions(document: Document): Record<string, unknown> {
    const permissions: Record<string, unknown> = {
      canAccess: true,
      canDownload: false,
      canShare: false,
    };

    // Check for download buttons/links
    permissions.canDownload =
      document.querySelector('a[download], .download-button, [data-action="download"]') !== null;

    // Check for share buttons
    permissions.canShare = document.querySelector('.share-button, [data-action="share"]') !== null;

    // Check for access restrictions
    const restrictionElements = document.querySelectorAll('.access-denied, .permission-required, .restricted');
    if (restrictionElements.length > 0) {
      permissions.restrictions = Array.from(restrictionElements)
        .map(el => el.textContent?.trim())
        .filter(Boolean);
    }

    return permissions;
  }
}

// Supporting interfaces

interface ExtractionPattern {
  type: string;
  selectors: string[];
  attribute: string;
  confidence: number;
}

// Create singleton instance
export const metadataExtractor = new MetadataExtractor();
