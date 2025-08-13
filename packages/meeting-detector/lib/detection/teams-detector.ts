/**
 * Teams Domain Detector
 * Specialized detection for Microsoft Teams interfaces and meeting contexts
 */

import type { MeetingPlatform } from '../types/index';
import type { TenantInfo } from '../types/tenant';

/**
 * Microsoft Teams domain and interface detection
 */
export class TeamsDetector {
  private teamsPatterns: RegExp[] = [];
  private tenantCache = new Map<string, TenantInfo>();
  private interfaceCache = new Map<string, TeamsInterfaceInfo>();

  constructor() {
    this.initializeTeamsPatterns();
  }

  /**
   * Detect Teams domain and interface type
   */
  detectTeamsDomain(url: string): TeamsDomainInfo | null {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      const pathname = urlObj.pathname;

      // Check for Teams web client
      if (this.isTeamsWebClient(hostname, pathname)) {
        return {
          domain: hostname,
          platform: 'teams',
          interfaceType: 'web_client',
          tenantId: this.extractTenantFromTeamsUrl(url),
          confidence: 0.95,
          detectionMethod: 'teams_web_client',
        };
      }

      // Check for Teams embedded interfaces
      if (this.isTeamsEmbedded(hostname, pathname)) {
        return {
          domain: hostname,
          platform: 'teams',
          interfaceType: 'embedded',
          tenantId: this.extractTenantFromTeamsUrl(url),
          confidence: 0.9,
          detectionMethod: 'teams_embedded',
        };
      }

      // Check for Teams mobile web
      if (this.isTeamsMobileWeb(hostname, pathname)) {
        return {
          domain: hostname,
          platform: 'teams',
          interfaceType: 'mobile_web',
          tenantId: this.extractTenantFromTeamsUrl(url),
          confidence: 0.85,
          detectionMethod: 'teams_mobile',
        };
      }

      // Check for Teams meeting join links
      if (this.isTeamsMeetingLink(hostname, pathname)) {
        return {
          domain: hostname,
          platform: 'teams',
          interfaceType: 'meeting_join',
          tenantId: this.extractTenantFromTeamsUrl(url),
          confidence: 0.8,
          detectionMethod: 'teams_meeting_link',
        };
      }

      return null;
    } catch (error) {
      console.error('Teams domain detection error:', error);
      return null;
    }
  }

  /**
   * Identify Teams meeting context from URL and page content
   */
  identifyMeetingContext(url: string, document?: Document): TeamsMeetingContext | null {
    try {
      const urlContext = this.analyzeMeetingUrl(url);
      const pageContext = document ? this.analyzeMeetingPage(document) : null;

      if (!urlContext && !pageContext) {
        return null;
      }

      return {
        meetingId: urlContext?.meetingId || pageContext?.meetingId,
        threadId: urlContext?.threadId || pageContext?.threadId,
        channelId: urlContext?.channelId || pageContext?.channelId,
        conversationId: urlContext?.conversationId || pageContext?.conversationId,
        tenantId: urlContext?.tenantId || pageContext?.tenantId,
        meetingType: this.determineMeetingType(urlContext, pageContext),
        contextSource: urlContext ? 'url' : 'page',
        confidence: this.calculateContextConfidence(urlContext, pageContext),
      };
    } catch (error) {
      console.error('Meeting context identification error:', error);
      return null;
    }
  }

  /**
   * Extract Teams meeting information from URL parameters
   */
  extractMeetingInfo(url: string): TeamsMeetingInfo | null {
    try {
      const urlObj = new URL(url);
      const params = urlObj.searchParams;

      // Extract meeting ID from various parameter formats
      const meetingId =
        params.get('meetingId') ||
        params.get('mId') ||
        params.get('conference-id') ||
        this.extractMeetingIdFromPath(urlObj.pathname);

      if (!meetingId) {
        return null;
      }

      return {
        meetingId,
        organizerId: params.get('organizerId') || params.get('oid'),
        threadId: params.get('threadId') || params.get('tid'),
        channelId: params.get('channelId') || params.get('cid'),
        conversationId: params.get('conversationId'),
        messageId: params.get('messageId'),
        tenantId: params.get('tenantId') || this.extractTenantFromTeamsUrl(url),
        joinUrl: this.extractJoinUrl(url),
        dialInNumber: params.get('dialin'),
        conferenceId: params.get('conference-id'),
        passcode: params.get('passcode'),
        isRecurring: params.get('recurring') === 'true',
        timezone: params.get('timezone'),
        startTime: this.parseDateTime(params.get('startTime')),
        endTime: this.parseDateTime(params.get('endTime')),
      };
    } catch (error) {
      console.error('Meeting info extraction error:', error);
      return null;
    }
  }

  /**
   * Validate Teams meeting access
   */
  async validateMeetingAccess(url: string): Promise<TeamsMeetingAccess> {
    try {
      const meetingInfo = this.extractMeetingInfo(url);

      if (!meetingInfo) {
        return {
          accessible: false,
          requiresAuth: false,
          error: 'Invalid meeting URL',
        };
      }

      // Attempt to fetch meeting details (without authentication)
      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'no-cors', // Avoid CORS issues
      });

      return {
        accessible: response.ok || response.type === 'opaque',
        requiresAuth: response.status === 401 || response.status === 403,
        meetingId: meetingInfo.meetingId,
        statusCode: response.status,
        responseType: response.type,
      };
    } catch (error) {
      return {
        accessible: false,
        requiresAuth: true,
        error: error instanceof Error ? error.message : 'Access validation failed',
      };
    }
  }

  /**
   * Check if URL is a Teams recording link
   */
  isTeamsRecordingUrl(url: string): boolean {
    try {
      const urlLower = url.toLowerCase();
      void urlLower; // Used for URL pattern matching

      // Check for various Teams recording URL patterns
      const recordingPatterns = [
        /\/recording/i,
        /\/playback/i,
        /\/watch/i,
        /recordingId=/i,
        /microsoft\.com.*recording/i,
        /teams\.microsoft\.com.*recording/i,
        /stream\.microsoft\.com/i,
      ];

      return recordingPatterns.some(pattern => pattern.test(url));
    } catch {
      return false;
    }
  }

  /**
   * Get Teams interface capabilities
   */
  getInterfaceCapabilities(interfaceType: TeamsInterfaceType): TeamsCapabilities {
    const baseCapabilities = {
      canJoinMeeting: true,
      canViewRecordings: false,
      canDownloadRecordings: false,
      canAccessTranscripts: false,
      canViewParticipants: false,
      canAccessChat: false,
      hasFullFeatures: false,
    };

    switch (interfaceType) {
      case 'web_client':
        return {
          ...baseCapabilities,
          canViewRecordings: true,
          canDownloadRecordings: true,
          canAccessTranscripts: true,
          canViewParticipants: true,
          canAccessChat: true,
          hasFullFeatures: true,
        };

      case 'desktop_client':
        return {
          ...baseCapabilities,
          canViewRecordings: true,
          canDownloadRecordings: true,
          canAccessTranscripts: true,
          canViewParticipants: true,
          canAccessChat: true,
          hasFullFeatures: true,
        };

      case 'mobile_web':
        return {
          ...baseCapabilities,
          canViewRecordings: true,
          canAccessTranscripts: true,
          canViewParticipants: true,
          canAccessChat: true,
        };

      case 'embedded':
        return {
          ...baseCapabilities,
          canViewRecordings: true,
          canAccessTranscripts: true,
        };

      case 'meeting_join':
        return baseCapabilities;

      default:
        return baseCapabilities;
    }
  }

  // Private methods

  private initializeTeamsPatterns(): void {
    this.teamsPatterns = [
      /^teams\.microsoft\.com$/,
      /^.*\.teams\.microsoft\.com$/,
      /^teams\.live\.com$/,
      /^.*\.teams\.live\.com$/,
      /^.*\.microsoftstream\.com$/,
      /^join\.microsoft\.com$/,
    ];
  }

  private isTeamsWebClient(hostname: string, pathname: string): boolean {
    return (
      (hostname === 'teams.microsoft.com' || hostname.endsWith('.teams.microsoft.com')) && !pathname.includes('/join')
    );
  }

  private isTeamsEmbedded(hostname: string, pathname: string): boolean {
    return (
      (hostname.includes('teams.microsoft.com') || hostname.includes('microsoftstream.com')) &&
      (pathname.includes('/embed') || pathname.includes('/embedded'))
    );
  }

  private isTeamsMobileWeb(hostname: string, pathname: string): boolean {
    return (
      (hostname.includes('teams.microsoft.com') || hostname.includes('teams.live.com')) &&
      (pathname.includes('/mobile') || pathname.includes('/m/'))
    );
  }

  private isTeamsMeetingLink(hostname: string, pathname: string): boolean {
    return (
      (hostname === 'teams.microsoft.com' ||
        hostname === 'join.microsoft.com' ||
        hostname.includes('teams.live.com')) &&
      (pathname.includes('/join') || pathname.includes('/meeting'))
    );
  }

  private extractTenantFromTeamsUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);

      // Method 1: From query parameters
      const tenantId = urlObj.searchParams.get('tenantId') || urlObj.searchParams.get('tid');
      if (tenantId) {
        return tenantId;
      }

      // Method 2: From hostname subdomain
      const hostnameParts = urlObj.hostname.split('.');
      if (hostnameParts.length > 2 && hostnameParts[0] !== 'teams') {
        return hostnameParts[0] || null;
      }

      // Method 3: From path segments
      const pathMatch = urlObj.pathname.match(/\/tenant\/([^/]+)/);
      if (pathMatch) {
        return pathMatch[1] || null;
      }

      return null;
    } catch {
      return null;
    }
  }

  private analyzeMeetingUrl(url: string): MeetingUrlContext | null {
    try {
      const urlObj = new URL(url);
      const params = urlObj.searchParams;
      const pathname = urlObj.pathname;

      // Extract IDs from URL
      const meetingId = this.extractMeetingIdFromUrl(url);
      const threadId = params.get('threadId') || params.get('tid');
      const channelId = params.get('channelId') || params.get('cid');
      const conversationId = params.get('conversationId');
      const tenantId = this.extractTenantFromTeamsUrl(url);

      if (!meetingId && !threadId && !channelId) {
        return null;
      }

      return {
        meetingId,
        threadId,
        channelId,
        conversationId,
        tenantId,
        urlType: this.determineMeetingUrlType(pathname),
      };
    } catch {
      return null;
    }
  }

  private analyzeMeetingPage(document: Document): MeetingPageContext | null {
    try {
      // Look for Teams-specific attributes and data
      const meetingId = this.extractMeetingIdFromPage(document);
      const threadId = this.extractThreadIdFromPage(document);
      const channelId = this.extractChannelIdFromPage(document);
      const tenantId = this.extractTenantIdFromPage(document);

      if (!meetingId && !threadId && !channelId) {
        return null;
      }

      return {
        meetingId,
        threadId,
        channelId,
        tenantId,
        pageType: this.determineTeamsPageType(document),
      };
    } catch {
      return null;
    }
  }

  private extractMeetingIdFromUrl(url: string): string | null {
    const patterns = [
      /meetingId=([^&]+)/i,
      /mId=([^&]+)/i,
      /conference-id=([^&]+)/i,
      /\/meeting\/([^/?]+)/i,
      /\/join\/([^/?]+)/i,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return decodeURIComponent(match[1]);
      }
    }

    return null;
  }

  private extractMeetingIdFromPath(pathname: string): string | null {
    const pathPatterns = [/\/meeting\/([^/?]+)/, /\/join\/([^/?]+)/, /\/conference\/([^/?]+)/];

    for (const pattern of pathPatterns) {
      const match = pathname.match(pattern);
      if (match && match[1]) {
        return decodeURIComponent(match[1]);
      }
    }

    return null;
  }

  private extractJoinUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);

      // If this is already a join URL, return it
      if (urlObj.pathname.includes('/join')) {
        return url;
      }

      // Extract join URL from parameters
      const joinUrl = urlObj.searchParams.get('joinUrl') || urlObj.searchParams.get('join');

      return joinUrl ? decodeURIComponent(joinUrl) : null;
    } catch {
      return null;
    }
  }

  private parseDateTime(dateTimeString: string | null): Date | undefined {
    if (!dateTimeString) return undefined;

    try {
      const date = new Date(dateTimeString);
      return isNaN(date.getTime()) ? undefined : date;
    } catch {
      return undefined;
    }
  }

  private determineMeetingType(
    urlContext: MeetingUrlContext | null,
    pageContext: MeetingPageContext | null,
  ): TeamsMeetingType {
    // Determine meeting type based on available context
    if (urlContext?.channelId || pageContext?.channelId) {
      return 'channel_meeting';
    }

    if (urlContext?.threadId || pageContext?.threadId) {
      return 'chat_meeting';
    }

    if (urlContext?.meetingId || pageContext?.meetingId) {
      return 'scheduled_meeting';
    }

    return 'unknown';
  }

  private calculateContextConfidence(
    urlContext: MeetingUrlContext | null,
    pageContext: MeetingPageContext | null,
  ): number {
    let confidence = 0.5;

    if (urlContext) {
      confidence += 0.3;
      if (urlContext.meetingId) confidence += 0.1;
      if (urlContext.tenantId) confidence += 0.1;
    }

    if (pageContext) {
      confidence += 0.2;
      if (pageContext.meetingId) confidence += 0.1;
    }

    return Math.min(1.0, confidence);
  }

  private determineMeetingUrlType(pathname: string): string {
    if (pathname.includes('/join')) return 'join_link';
    if (pathname.includes('/meeting')) return 'meeting_details';
    if (pathname.includes('/channel')) return 'channel_view';
    if (pathname.includes('/chat')) return 'chat_view';
    return 'unknown';
  }

  private extractMeetingIdFromPage(document: Document): string | null {
    // Look for meeting ID in various page elements
    const selectors = ['[data-tid*="meeting"]', '[data-meeting-id]', '[id*="meeting"]'];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const meetingId = element.getAttribute('data-meeting-id') || element.getAttribute('data-tid');
        if (meetingId) return meetingId;
      }
    }

    return null;
  }

  private extractThreadIdFromPage(document: Document): string | null {
    const element = document.querySelector('[data-thread-id]');
    return element?.getAttribute('data-thread-id') || null;
  }

  private extractChannelIdFromPage(document: Document): string | null {
    const element = document.querySelector('[data-channel-id]');
    return element?.getAttribute('data-channel-id') || null;
  }

  private extractTenantIdFromPage(document: Document): string | null {
    const element = document.querySelector('[data-tenant-id]');
    return element?.getAttribute('data-tenant-id') || null;
  }

  private determineTeamsPageType(document: Document): string {
    const body = document.body;
    const classes = body.className.toLowerCase();

    if (classes.includes('meeting')) return 'meeting_page';
    if (classes.includes('channel')) return 'channel_page';
    if (classes.includes('chat')) return 'chat_page';
    if (classes.includes('calendar')) return 'calendar_page';

    return 'unknown';
  }
}

// Supporting interfaces and types

export interface TeamsDomainInfo {
  domain: string;
  platform: MeetingPlatform;
  interfaceType: TeamsInterfaceType;
  tenantId: string | null;
  confidence: number;
  detectionMethod: string;
}

export interface TeamsMeetingContext {
  meetingId?: string | null | undefined;
  threadId?: string | null | undefined;
  channelId?: string | null | undefined;
  conversationId?: string | null | undefined;
  tenantId?: string | null | undefined;
  meetingType: TeamsMeetingType;
  contextSource: 'url' | 'page';
  confidence: number;
}

export interface TeamsMeetingInfo {
  meetingId: string;
  organizerId?: string | null | undefined;
  threadId?: string | null | undefined;
  channelId?: string | null | undefined;
  conversationId?: string | null | undefined;
  messageId?: string | null | undefined;
  tenantId?: string | null | undefined;
  joinUrl?: string | null | undefined;
  dialInNumber?: string | null | undefined;
  conferenceId?: string | null | undefined;
  passcode?: string | null | undefined;
  isRecurring?: boolean | undefined;
  timezone?: string | null | undefined;
  startTime?: Date | undefined;
  endTime?: Date | undefined;
}

export interface TeamsMeetingAccess {
  accessible: boolean;
  requiresAuth: boolean;
  meetingId?: string;
  statusCode?: number;
  responseType?: string;
  error?: string;
}

export interface TeamsCapabilities {
  canJoinMeeting: boolean;
  canViewRecordings: boolean;
  canDownloadRecordings: boolean;
  canAccessTranscripts: boolean;
  canViewParticipants: boolean;
  canAccessChat: boolean;
  hasFullFeatures: boolean;
}

interface TeamsInterfaceInfo {
  type: TeamsInterfaceType;
  capabilities: TeamsCapabilities;
  version?: string;
}

interface MeetingUrlContext {
  meetingId?: string | null;
  threadId?: string | null;
  channelId?: string | null;
  conversationId?: string | null;
  tenantId?: string | null;
  urlType: string;
}

interface MeetingPageContext {
  meetingId?: string | null;
  threadId?: string | null;
  channelId?: string | null;
  conversationId?: string | null;
  tenantId?: string | null;
  pageType: string;
}

export type TeamsInterfaceType = 'web_client' | 'desktop_client' | 'mobile_web' | 'embedded' | 'meeting_join';

export type TeamsMeetingType = 'scheduled_meeting' | 'channel_meeting' | 'chat_meeting' | 'instant_meeting' | 'unknown';

// Create singleton instance
export const teamsDetector = new TeamsDetector();
