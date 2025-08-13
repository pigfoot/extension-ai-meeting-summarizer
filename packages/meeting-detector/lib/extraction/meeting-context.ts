/**
 * Meeting Context Extractor
 * Extracts meeting context and recording access information from Teams interfaces
 */

import { teamsDetector } from '../detection/teams-detector';
import type { TeamsMeetingContext } from '../detection/teams-detector';

/**
 * Teams meeting context extraction and recording availability checking
 */
export class MeetingContextExtractor {
  private contextCache = new Map<string, ExtractedContext>();
  private permissionCache = new Map<string, RecordingPermissions>();

  constructor() {}

  /**
   * Extract comprehensive meeting context from Teams interface
   */
  async extractMeetingContext(url: string, document: Document): Promise<ExtractedContext | null> {
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(url, document);
      if (this.contextCache.has(cacheKey)) {
        return this.contextCache.get(cacheKey) || null;
      }

      // Extract basic meeting context
      const meetingContext = teamsDetector.identifyMeetingContext(url, document);
      if (!meetingContext) {
        return null;
      }

      // Extract detailed meeting information
      const meetingInfo = this.extractDetailedMeetingInfo(document, url);

      // Extract recording availability
      const recordingAvailability = await this.checkRecordingAvailability(meetingContext, document);

      // Extract participant information
      const participantInfo = this.extractParticipantInfo(document);

      // Extract meeting timeline
      const timeline = this.extractMeetingTimeline(document);

      // Extract permission context
      const permissions = await this.extractPermissionContext(meetingContext, document);

      const context: ExtractedContext = {
        meetingContext,
        meetingInfo,
        recordingAvailability,
        participantInfo,
        timeline,
        permissions,
        extractedAt: new Date(),
        confidence: this.calculateContextConfidence(meetingContext, meetingInfo, recordingAvailability),
      };

      // Cache the result
      this.contextCache.set(cacheKey, context);

      return context;
    } catch (error) {
      console.error('Meeting context extraction error:', error);
      return null;
    }
  }

  /**
   * Check recording availability and access permissions
   */
  async checkRecordingAvailability(
    meetingContext: TeamsMeetingContext,
    document: Document,
  ): Promise<RecordingAvailabilityInfo> {
    const availability: RecordingAvailabilityInfo = {
      hasRecording: false,
      recordingUrls: [],
      accessLevel: 'none',
      restrictions: [],
      streamIntegration: false,
      downloadable: false,
    };

    try {
      // Check for recording indicators in the page
      const recordingIndicators = this.findRecordingIndicators(document);
      availability.hasRecording = recordingIndicators.length > 0;

      // Extract recording URLs
      availability.recordingUrls = this.extractRecordingUrls(document, recordingIndicators);

      // Check Stream integration
      availability.streamIntegration = this.checkStreamIntegration(document);

      // Determine access level
      availability.accessLevel = this.determineAccessLevel(document, recordingIndicators);

      // Check if downloadable
      availability.downloadable = this.checkDownloadability(document);

      // Identify restrictions
      availability.restrictions = this.identifyAccessRestrictions(document);

      // Validate recording URLs
      if (availability.recordingUrls.length > 0) {
        availability.urlValidation = await this.validateRecordingUrls(availability.recordingUrls);
      }
    } catch (error) {
      console.error('Recording availability check error:', error);
    }

    return availability;
  }

  /**
   * Extract participant information and roles
   */
  extractParticipantInfo(document: Document): ParticipantInfo {
    const info: ParticipantInfo = {
      currentUser: null,
      organizer: null,
      participants: [],
      totalCount: 0,
      roles: new Map(),
    };

    try {
      // Extract current user information
      info.currentUser = this.extractCurrentUser(document);

      // Extract meeting organizer
      info.organizer = this.extractMeetingOrganizer(document);

      // Extract participant list
      info.participants = this.extractParticipantList(document);
      info.totalCount = info.participants.length;

      // Extract participant roles
      info.roles = this.extractParticipantRoles(document);
    } catch (error) {
      console.error('Participant info extraction error:', error);
    }

    return info;
  }

  /**
   * Extract meeting timeline and events
   */
  extractMeetingTimeline(document: Document): MeetingTimeline {
    const timeline: MeetingTimeline = {
      scheduledStart: undefined,
      actualStart: undefined,
      scheduledEnd: undefined,
      actualEnd: undefined,
      duration: undefined,
      events: [],
    };

    try {
      // Extract scheduled times
      timeline.scheduledStart = this.extractScheduledStartTime();
      timeline.scheduledEnd = this.extractScheduledEndTime();

      // Extract actual times from meeting history
      timeline.actualStart = this.extractActualStartTime();
      timeline.actualEnd = this.extractActualEndTime();

      // Calculate duration
      if (timeline.actualStart && timeline.actualEnd) {
        timeline.duration = timeline.actualEnd.getTime() - timeline.actualStart.getTime();
      }

      // Extract meeting events
      timeline.events = this.extractMeetingEvents(document);
    } catch (error) {
      console.error('Timeline extraction error:', error);
    }

    return timeline;
  }

  /**
   * Extract permission context for recordings
   */
  async extractPermissionContext(
    meetingContext: TeamsMeetingContext,
    document: Document,
  ): Promise<RecordingPermissions> {
    const cacheKey = meetingContext.meetingId || 'unknown';

    // Check cache first
    if (this.permissionCache.has(cacheKey)) {
      return this.permissionCache.get(cacheKey)!;
    }

    const permissions: RecordingPermissions = {
      canAccess: false,
      canDownload: false,
      canShare: false,
      canTranscript: false,
      restrictions: [],
      expirationDate: undefined,
      requiresAuth: true,
    };

    try {
      // Check UI elements for permission indicators
      permissions.canAccess = this.checkAccessPermission(document);
      permissions.canDownload = this.checkDownloadPermission(document);
      permissions.canShare = this.checkSharePermission(document);
      permissions.canTranscript = this.checkTranscriptPermission(document);

      // Extract restriction information
      permissions.restrictions = this.extractPermissionRestrictions();

      // Check for expiration dates
      permissions.expirationDate = this.extractExpirationDate();

      // Determine authentication requirements
      permissions.requiresAuth = this.determineAuthRequirement(document);

      // Cache the result
      this.permissionCache.set(cacheKey, permissions);
    } catch (error) {
      console.error('Permission context extraction error:', error);
    }

    return permissions;
  }

  // Private methods

  private generateCacheKey(url: string, document: Document): string {
    const urlHash = btoa(url).substring(0, 16);
    const titleHash = btoa(document.title || '').substring(0, 8);
    return `${urlHash}-${titleHash}`;
  }

  private extractDetailedMeetingInfo(document: Document, url: string): DetailedMeetingInfo {
    return {
      title: this.extractMeetingTitle(document),
      description: this.extractMeetingDescription(document),
      location: this.extractMeetingLocation(document),
      isRecurring: this.checkIfRecurring(document),
      meetingType: this.determineMeetingType(document, url),
      chatId: this.extractChatId(document),
      conferenceId: this.extractConferenceId(document),
      dialInInfo: this.extractDialInInfo(document),
    };
  }

  private findRecordingIndicators(document: Document): RecordingIndicator[] {
    const indicators: RecordingIndicator[] = [];

    // Common recording indicator selectors
    const selectors = [
      '[data-tid*="recording"]',
      '[class*="recording"]',
      'a[href*="recording"]',
      'a[href*="playback"]',
      'a[href*="stream"]',
      '.recording-link',
      '.playback-link',
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        indicators.push({
          element,
          selector,
          text: element.textContent || '',
          href: element.getAttribute('href'),
          type: this.classifyRecordingIndicator(element),
        });
      }
    }

    return indicators;
  }

  private extractRecordingUrls(document: Document, indicators: RecordingIndicator[]): string[] {
    const urls: string[] = [];

    // Extract URLs from indicators
    for (const indicator of indicators) {
      if (indicator.href) {
        urls.push(indicator.href);
      }
    }

    // Look for additional recording URLs in data attributes
    const dataElements = document.querySelectorAll('[data-recording-url], [data-stream-url]');
    for (const element of dataElements) {
      const url = element.getAttribute('data-recording-url') || element.getAttribute('data-stream-url');
      if (url) {
        urls.push(url);
      }
    }

    // Remove duplicates and validate
    return [...new Set(urls)].filter(url => this.isValidRecordingUrl(url));
  }

  private checkStreamIntegration(document: Document): boolean {
    const streamIndicators = [
      'iframe[src*="microsoftstream.com"]',
      '[data-component*="Stream"]',
      '.stream-player',
      '[class*="stream"]',
    ];

    return streamIndicators.some(selector => document.querySelector(selector) !== null);
  }

  private determineAccessLevel(document: Document, indicators: RecordingIndicator[]): AccessLevel {
    // Check for download buttons or links
    const hasDownload = indicators.some(
      i => i.text.toLowerCase().includes('download') || i.element.hasAttribute('download'),
    );

    // Check for view/play buttons
    const hasView = indicators.some(
      i =>
        i.text.toLowerCase().includes('play') ||
        i.text.toLowerCase().includes('watch') ||
        i.text.toLowerCase().includes('view'),
    );

    // Check for restricted access indicators
    const hasRestrictions = document.querySelector('.access-restricted, .permission-denied') !== null;

    if (hasRestrictions) return 'restricted';
    if (hasDownload) return 'full';
    if (hasView) return 'view_only';
    return 'none';
  }

  private checkDownloadability(document: Document): boolean {
    const downloadSelectors = [
      'a[download]',
      '[data-action="download"]',
      '.download-button',
      'button[title*="download"]',
    ];

    return downloadSelectors.some(selector => document.querySelector(selector) !== null);
  }

  private identifyAccessRestrictions(document: Document): string[] {
    const restrictions: string[] = [];

    // Check for common restriction messages
    const restrictionSelectors = [
      '.access-denied',
      '.permission-required',
      '.login-required',
      '.subscription-required',
    ];

    for (const selector of restrictionSelectors) {
      const element = document.querySelector(selector);
      if (element?.textContent) {
        restrictions.push(element.textContent.trim());
      }
    }

    // Check for permission-related text
    const bodyText = document.body.textContent?.toLowerCase() || '';
    const restrictionKeywords = [
      'permission denied',
      'access restricted',
      'login required',
      'not authorized',
      'subscription required',
    ];

    for (const keyword of restrictionKeywords) {
      if (bodyText.includes(keyword)) {
        restrictions.push(keyword);
      }
    }

    return restrictions;
  }

  private async validateRecordingUrls(urls: string[]): Promise<UrlValidationResult[]> {
    const results: UrlValidationResult[] = [];

    for (const url of urls) {
      try {
        const response = await fetch(url, { method: 'HEAD', mode: 'no-cors' });
        results.push({
          url,
          accessible: response.ok || response.type === 'opaque',
          statusCode: response.status,
          contentType: response.headers.get('content-type'),
          lastChecked: new Date(),
        });
      } catch (error) {
        results.push({
          url,
          accessible: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          lastChecked: new Date(),
        });
      }
    }

    return results;
  }

  private extractCurrentUser(document: Document): UserInfo | null {
    const userSelectors = ['[data-tid="current-user"]', '.current-user', '.user-profile', '[aria-label*="profile"]'];

    for (const selector of userSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        return {
          name: element.textContent?.trim() || 'Unknown',
          email: element.getAttribute('data-email') || undefined,
          id: element.getAttribute('data-user-id') || undefined,
          role: 'participant',
        };
      }
    }

    return null;
  }

  private extractMeetingOrganizer(document: Document): UserInfo | null {
    const organizerSelectors = ['[data-tid="organizer"]', '.meeting-organizer', '.organizer-info'];

    for (const selector of organizerSelectors) {
      const element = document.querySelector(selector);
      if (element?.textContent) {
        return {
          name: element.textContent.trim(),
          role: 'organizer',
        };
      }
    }

    return null;
  }

  private extractParticipantList(document: Document): UserInfo[] {
    const participants: UserInfo[] = [];

    const participantSelectors = ['[data-tid="participant"]', '.participant-item', '.attendee-list .attendee'];

    for (const selector of participantSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const name = element.textContent?.trim();
        if (name) {
          participants.push({
            name,
            email: element.getAttribute('data-email') || undefined,
            id: element.getAttribute('data-user-id') || undefined,
            role: 'participant',
          });
        }
      }
    }

    return participants;
  }

  private extractParticipantRoles(document: Document): Map<string, string> {
    const roles = new Map<string, string>();

    // Extract roles from UI elements
    const roleElements = document.querySelectorAll('[data-participant-role]');
    for (const element of roleElements) {
      const name = element.textContent?.trim();
      const role = element.getAttribute('data-participant-role');
      if (name && role) {
        roles.set(name, role);
      }
    }

    return roles;
  }

  private extractMeetingEvents(document: Document): MeetingEvent[] {
    const events: MeetingEvent[] = [];

    // Look for timeline or history elements
    const timelineElements = document.querySelectorAll('.timeline-item, .meeting-event, .chat-message');

    for (const element of timelineElements) {
      const event = this.parseEventElement(element);
      if (event) {
        events.push(event);
      }
    }

    return events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private parseEventElement(element: Element): MeetingEvent | null {
    const timestamp = this.extractTimestamp(element);
    const type = this.determineEventType(element);
    const description = element.textContent?.trim();

    if (!timestamp || !description) {
      return null;
    }

    return {
      timestamp,
      type,
      description,
      participant: this.extractEventParticipant(element),
    };
  }

  private calculateContextConfidence(
    meetingContext: TeamsMeetingContext,
    meetingInfo: DetailedMeetingInfo,
    recordingAvailability: RecordingAvailabilityInfo,
  ): number {
    let confidence = 0.3; // Base confidence

    // Boost for meeting context
    confidence += meetingContext.confidence * 0.3;

    // Boost for meeting info completeness
    if (meetingInfo.title) confidence += 0.1;
    if (meetingInfo.description) confidence += 0.05;
    if (meetingInfo.location) confidence += 0.05;

    // Boost for recording availability
    if (recordingAvailability.hasRecording) confidence += 0.2;
    if (recordingAvailability.recordingUrls.length > 0) confidence += 0.1;

    return Math.min(1.0, confidence);
  }

  // Additional helper methods would be implemented here...
  // For brevity, showing method signatures

  private extractMeetingTitle(document: Document): string {
    return document.querySelector('h1, [data-tid="meeting-title"]')?.textContent?.trim() || '';
  }

  private extractMeetingDescription(document: Document): string | undefined {
    return document.querySelector('[data-tid="meeting-description"]')?.textContent?.trim();
  }

  private extractMeetingLocation(document: Document): string | undefined {
    return document.querySelector('[data-tid="meeting-location"]')?.textContent?.trim();
  }

  private checkIfRecurring(document: Document): boolean {
    try {
      const textContent: string | null = document.textContent;
      if (!textContent) return false;
      return (textContent as string).toLowerCase().includes('recurring');
    } catch {
      return false;
    }
  }

  private determineMeetingType(document: Document, url: string): string {
    if (url.includes('channel')) return 'channel_meeting';
    if (url.includes('chat')) return 'chat_meeting';
    return 'scheduled_meeting';
  }

  private extractChatId(document: Document): string | undefined {
    return document.querySelector('[data-chat-id]')?.getAttribute('data-chat-id') || undefined;
  }

  private extractConferenceId(document: Document): string | undefined {
    return document.querySelector('[data-conference-id]')?.getAttribute('data-conference-id') || undefined;
  }

  private extractDialInInfo(document: Document): DialInInfo | undefined {
    const dialInElement = document.querySelector('.dial-in-info, [data-dial-in]');
    if (!dialInElement) return undefined;

    return {
      number: dialInElement.getAttribute('data-phone') || '',
      conferenceId: dialInElement.getAttribute('data-conference-id') || '',
      passcode: dialInElement.getAttribute('data-passcode') || undefined,
    };
  }

  private classifyRecordingIndicator(element: Element): string {
    const text = element.textContent?.toLowerCase() || '';
    const href = element.getAttribute('href')?.toLowerCase() || '';

    if (text.includes('download') || href.includes('download')) return 'download_link';
    if (text.includes('play') || text.includes('watch')) return 'play_link';
    if (href.includes('stream')) return 'stream_link';
    return 'recording_reference';
  }

  private isValidRecordingUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return (
        urlObj.protocol === 'https:' &&
        (urlObj.hostname.includes('microsoftstream.com') ||
          urlObj.hostname.includes('sharepoint.com') ||
          urlObj.hostname.includes('teams.microsoft.com'))
      );
    } catch {
      return false;
    }
  }

  private checkAccessPermission(document: Document): boolean {
    return !document.querySelector('.access-denied, .permission-denied');
  }

  private checkDownloadPermission(document: Document): boolean {
    return document.querySelector('[data-action="download"], .download-button') !== null;
  }

  private checkSharePermission(document: Document): boolean {
    return document.querySelector('[data-action="share"], .share-button') !== null;
  }

  private checkTranscriptPermission(document: Document): boolean {
    return document.querySelector('.transcript, [data-transcript]') !== null;
  }

  private extractPermissionRestrictions(): string[] {
    return []; // Implementation would extract restriction messages
  }

  private extractExpirationDate(): Date | undefined {
    return undefined; // Implementation would extract expiration dates
  }

  private determineAuthRequirement(document: Document): boolean {
    return document.querySelector('.login-required, .auth-required') !== null;
  }

  private extractScheduledStartTime(): Date | undefined {
    return undefined; // Implementation would extract scheduled start time
  }

  private extractScheduledEndTime(): Date | undefined {
    return undefined; // Implementation would extract scheduled end time
  }

  private extractActualStartTime(): Date | undefined {
    return undefined; // Implementation would extract actual start time
  }

  private extractActualEndTime(): Date | undefined {
    return undefined; // Implementation would extract actual end time
  }

  private extractTimestamp(element: Element): Date | null {
    const timeElement = element.querySelector('time[datetime]');
    if (timeElement) {
      const datetime = timeElement.getAttribute('datetime');
      return datetime ? new Date(datetime) : null;
    }
    return null;
  }

  private determineEventType(element: Element): string {
    const text = element.textContent?.toLowerCase() || '';
    if (text.includes('joined')) return 'participant_joined';
    if (text.includes('left')) return 'participant_left';
    if (text.includes('started')) return 'meeting_started';
    if (text.includes('ended')) return 'meeting_ended';
    if (text.includes('recording')) return 'recording_event';
    return 'general';
  }

  private extractEventParticipant(element: Element): string | undefined {
    return element.querySelector('.participant-name')?.textContent?.trim();
  }
}

// Supporting interfaces

export interface ExtractedContext {
  meetingContext: TeamsMeetingContext;
  meetingInfo: DetailedMeetingInfo;
  recordingAvailability: RecordingAvailabilityInfo;
  participantInfo: ParticipantInfo;
  timeline: MeetingTimeline;
  permissions: RecordingPermissions;
  extractedAt: Date;
  confidence: number;
}

export interface RecordingAvailabilityInfo {
  hasRecording: boolean;
  recordingUrls: string[];
  accessLevel: AccessLevel;
  restrictions: string[];
  streamIntegration: boolean;
  downloadable: boolean;
  urlValidation?: UrlValidationResult[];
}

export interface ParticipantInfo {
  currentUser: UserInfo | null;
  organizer: UserInfo | null;
  participants: UserInfo[];
  totalCount: number;
  roles: Map<string, string>;
}

export interface MeetingTimeline {
  scheduledStart?: Date | undefined;
  actualStart?: Date | undefined;
  scheduledEnd?: Date | undefined;
  actualEnd?: Date | undefined;
  duration?: number | undefined;
  events: MeetingEvent[];
}

export interface RecordingPermissions {
  canAccess: boolean;
  canDownload: boolean;
  canShare: boolean;
  canTranscript: boolean;
  restrictions: string[];
  expirationDate?: Date | undefined;
  requiresAuth: boolean;
}

interface DetailedMeetingInfo {
  title: string;
  description?: string | undefined;
  location?: string | undefined;
  isRecurring: boolean;
  meetingType: string;
  chatId?: string | undefined;
  conferenceId?: string | undefined;
  dialInInfo?: DialInInfo | undefined;
}

interface RecordingIndicator {
  element: Element;
  selector: string;
  text: string;
  href: string | null;
  type: string;
}

interface UserInfo {
  name: string;
  email?: string | undefined;
  id?: string | undefined;
  role: string;
}

interface MeetingEvent {
  timestamp: Date;
  type: string;
  description: string;
  participant?: string | undefined;
}

interface DialInInfo {
  number: string;
  conferenceId: string;
  passcode?: string | undefined;
}

interface UrlValidationResult {
  url: string;
  accessible: boolean;
  statusCode?: number;
  contentType?: string | null;
  error?: string;
  lastChecked: Date;
}

export type AccessLevel = 'none' | 'view_only' | 'full' | 'restricted';

// Create singleton instance
export const meetingContextExtractor = new MeetingContextExtractor();
