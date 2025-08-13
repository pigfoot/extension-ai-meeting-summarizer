/**
 * Teams Link Resolver
 * Resolves Teams deep links to recording content and extracts meeting IDs
 */

import type { TeamsMeetingInfo } from '../detection/teams-detector';

/**
 * Teams deep link resolution and URL construction
 */
export class TeamsLinkResolver {
  private linkPatterns: Map<string, LinkPattern> = new Map();
  private urlCache = new Map<string, ResolvedLink>();

  constructor() {
    this.initializeLinkPatterns();
  }

  /**
   * Resolve Teams deep link to actual recording resource
   */
  async resolveTeamsLink(url: string): Promise<ResolvedLink | null> {
    try {
      // Check cache first
      if (this.urlCache.has(url)) {
        return this.urlCache.get(url) || null;
      }

      const urlObj = new URL(url);
      const resolved = await this.performLinkResolution(urlObj);

      if (resolved) {
        this.urlCache.set(url, resolved);
      }

      return resolved;
    } catch (error) {
      console.error('Teams link resolution error:', error);
      return null;
    }
  }

  /**
   * Extract meeting ID from various Teams URL formats
   */
  extractMeetingId(url: string): MeetingIdInfo | null {
    try {
      const urlObj = new URL(url);

      // Try different extraction methods
      const methods = [
        () => this.extractFromQueryParams(urlObj),
        () => this.extractFromPath(urlObj),
        () => this.extractFromFragment(urlObj),
        () => this.extractFromEncodedData(urlObj),
      ];

      for (const method of methods) {
        const result = method();
        if (result) {
          return result;
        }
      }

      return null;
    } catch (error) {
      console.error('Meeting ID extraction error:', error);
      return null;
    }
  }

  /**
   * Construct direct recording URL from meeting information
   */
  constructRecordingUrl(meetingInfo: TeamsMeetingInfo): string | null {
    try {
      if (!meetingInfo.meetingId) {
        return null;
      }

      // Try different URL construction patterns
      const patterns = [
        this.constructStreamUrl(meetingInfo),
        this.constructSharePointUrl(meetingInfo),
        this.constructTeamsDirectUrl(meetingInfo),
      ];

      // Return the first successful pattern
      for (const pattern of patterns) {
        if (pattern) {
          return pattern;
        }
      }

      return null;
    } catch (error) {
      console.error('Recording URL construction error:', error);
      return null;
    }
  }

  /**
   * Resolve Teams meeting join link to recording resources
   */
  async resolveMeetingJoinLink(joinUrl: string): Promise<MeetingResolution | null> {
    try {
      const meetingInfo = this.extractMeetingInfoFromJoinUrl(joinUrl);
      if (!meetingInfo) {
        return null;
      }

      // Attempt to find associated recordings
      const recordings = await this.findAssociatedRecordings(meetingInfo);

      return {
        meetingInfo,
        recordings,
        recordingUrls: recordings.map(r => r.url),
        confidence: this.calculateResolutionConfidence(meetingInfo, recordings),
        resolvedAt: new Date(),
      };
    } catch (error) {
      console.error('Join link resolution error:', error);
      return null;
    }
  }

  /**
   * Parse Teams deep link parameters
   */
  parseDeepLinkParams(url: string): DeepLinkParams {
    const params: DeepLinkParams = {};

    try {
      const urlObj = new URL(url);

      // Standard parameters
      const meetingId = urlObj.searchParams.get('meetingId');
      params.meetingId = meetingId || undefined;
      const threadId = urlObj.searchParams.get('threadId');
      params.threadId = threadId || undefined;
      const channelId = urlObj.searchParams.get('channelId');
      if (channelId) params.channelId = channelId;
      const conversationId = urlObj.searchParams.get('conversationId');
      if (conversationId) params.conversationId = conversationId;
      const messageId = urlObj.searchParams.get('messageId');
      if (messageId) params.messageId = messageId;
      const tenantId = urlObj.searchParams.get('tenantId');
      if (tenantId) params.tenantId = tenantId;

      // Alternative parameter names
      if (!params.meetingId) {
        const mId = urlObj.searchParams.get('mId');
        const conferenceId = urlObj.searchParams.get('conference-id');
        if (mId) {
          params.meetingId = mId;
        } else if (conferenceId) {
          params.meetingId = conferenceId;
        }
      }

      if (!params.threadId) {
        const tid = urlObj.searchParams.get('tid');
        if (tid) params.threadId = tid;
      }

      if (!params.channelId) {
        const cid = urlObj.searchParams.get('cid');
        if (cid) params.channelId = cid;
      }

      // Extract from path if not in query params
      if (!params.meetingId) {
        const pathMatch = urlObj.pathname.match(/\/meeting\/([^/?]+)/);
        if (pathMatch && pathMatch[1]) {
          params.meetingId = decodeURIComponent(pathMatch[1]);
        }
      }

      // Additional parameters
      const recordingId = urlObj.searchParams.get('recordingId');
      if (recordingId) params.recordingId = recordingId;
      const videoId = urlObj.searchParams.get('videoId');
      if (videoId) params.videoId = videoId;
      params.startTime = this.parseTimeParam(urlObj.searchParams.get('t') || urlObj.searchParams.get('startTime'));
      params.endTime = this.parseTimeParam(urlObj.searchParams.get('endTime'));
    } catch (error) {
      console.error('Deep link parameter parsing error:', error);
    }

    return params;
  }

  /**
   * Validate and normalize Teams URLs
   */
  normalizeTeamsUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);

      // Ensure it's a valid Teams domain
      if (!this.isValidTeamsDomain(urlObj.hostname)) {
        return null;
      }

      // Normalize query parameters
      const normalizedParams = this.normalizeQueryParams(urlObj.searchParams);

      // Reconstruct URL
      const normalizedUrl = new URL(urlObj.origin + urlObj.pathname);
      normalizedParams.forEach((value, key) => {
        normalizedUrl.searchParams.set(key, value);
      });

      return normalizedUrl.toString();
    } catch {
      return null;
    }
  }

  // Private methods

  private initializeLinkPatterns(): void {
    this.linkPatterns.set('teams_meeting', {
      pattern: /teams\.microsoft\.com.*\/meeting/,
      resolver: this.resolveMeetingLink.bind(this),
    });

    this.linkPatterns.set('teams_channel', {
      pattern: /teams\.microsoft\.com.*\/channel/,
      resolver: this.resolveChannelLink.bind(this),
    });

    this.linkPatterns.set('teams_chat', {
      pattern: /teams\.microsoft\.com.*\/chat/,
      resolver: this.resolveChatLink.bind(this),
    });

    this.linkPatterns.set('stream_video', {
      pattern: /microsoftstream\.com.*\/video/,
      resolver: this.resolveStreamLink.bind(this),
    });

    this.linkPatterns.set('join_link', {
      pattern: /(teams\.microsoft\.com|join\.microsoft\.com).*\/join/,
      resolver: this.resolveJoinLink.bind(this),
    });
  }

  private async performLinkResolution(urlObj: URL): Promise<ResolvedLink | null> {
    const url = urlObj.toString();

    // Find matching pattern
    for (const [type, pattern] of this.linkPatterns) {
      if (pattern.pattern.test(url)) {
        try {
          return await pattern.resolver(urlObj);
        } catch (error) {
          console.error(`Link resolution error for ${type}:`, error);
          continue;
        }
      }
    }

    return null;
  }

  private extractFromQueryParams(urlObj: URL): MeetingIdInfo | null {
    const meetingId =
      urlObj.searchParams.get('meetingId') ||
      urlObj.searchParams.get('mId') ||
      urlObj.searchParams.get('conference-id');

    if (meetingId) {
      return {
        meetingId: decodeURIComponent(meetingId),
        source: 'query_params',
        confidence: 0.9,
      };
    }

    return null;
  }

  private extractFromPath(urlObj: URL): MeetingIdInfo | null {
    const pathPatterns = [/\/meeting\/([^/?]+)/, /\/join\/([^/?]+)/, /\/conference\/([^/?]+)/, /\/m\/([^/?]+)/];

    for (const pattern of pathPatterns) {
      const match = urlObj.pathname.match(pattern);
      if (match && match[1]) {
        return {
          meetingId: decodeURIComponent(match[1]),
          source: 'path',
          confidence: 0.8,
        };
      }
    }

    return null;
  }

  private extractFromFragment(urlObj: URL): MeetingIdInfo | null {
    if (!urlObj.hash) {
      return null;
    }

    const fragment = urlObj.hash.substring(1);
    const fragmentUrl = new URLSearchParams(fragment);

    const meetingId = fragmentUrl.get('meetingId') || fragmentUrl.get('mId');
    if (meetingId) {
      return {
        meetingId: decodeURIComponent(meetingId),
        source: 'fragment',
        confidence: 0.7,
      };
    }

    return null;
  }

  private extractFromEncodedData(urlObj: URL): MeetingIdInfo | null {
    // Try to extract from base64 encoded data in URL
    const dataParam = urlObj.searchParams.get('data') || urlObj.searchParams.get('payload');

    if (dataParam) {
      try {
        const decoded = atob(dataParam);
        const data = JSON.parse(decoded);

        if (data.meetingId || data.mId) {
          return {
            meetingId: data.meetingId || data.mId,
            source: 'encoded_data',
            confidence: 0.6,
          };
        }
      } catch {
        // Ignore decoding errors
      }
    }

    return null;
  }

  private constructStreamUrl(meetingInfo: TeamsMeetingInfo): string | null {
    if (!meetingInfo.tenantId || !meetingInfo.meetingId) {
      return null;
    }

    try {
      // Construct Stream URL pattern
      const streamUrl = new URL('https://web.microsoftstream.com');
      streamUrl.pathname = `/video/${meetingInfo.meetingId}`;

      if (meetingInfo.tenantId) {
        streamUrl.searchParams.set('tenantId', meetingInfo.tenantId);
      }

      return streamUrl.toString();
    } catch {
      return null;
    }
  }

  private constructSharePointUrl(meetingInfo: TeamsMeetingInfo): string | null {
    if (!meetingInfo.tenantId || !meetingInfo.meetingId) {
      return null;
    }

    try {
      // Construct SharePoint recording URL pattern
      const sharePointUrl = new URL(`https://${meetingInfo.tenantId}.sharepoint.com`);
      sharePointUrl.pathname = `/sites/RecordingLibrary/Shared%20Documents/${meetingInfo.meetingId}.mp4`;

      return sharePointUrl.toString();
    } catch {
      return null;
    }
  }

  private constructTeamsDirectUrl(meetingInfo: TeamsMeetingInfo): string | null {
    if (!meetingInfo.meetingId) {
      return null;
    }

    try {
      // Construct direct Teams recording URL
      const teamsUrl = new URL('https://teams.microsoft.com');
      teamsUrl.pathname = `/recording/${meetingInfo.meetingId}`;

      if (meetingInfo.tenantId) {
        teamsUrl.searchParams.set('tenantId', meetingInfo.tenantId);
      }

      return teamsUrl.toString();
    } catch {
      return null;
    }
  }

  private extractMeetingInfoFromJoinUrl(joinUrl: string): TeamsMeetingInfo | null {
    try {
      const urlObj = new URL(joinUrl);
      const params = urlObj.searchParams;

      const meetingId = params.get('meetingId') || params.get('mId') || this.extractFromPath(urlObj)?.meetingId;

      if (!meetingId) {
        return null;
      }

      return {
        meetingId,
        organizerId: params.get('organizerId'),
        threadId: params.get('threadId'),
        channelId: params.get('channelId'),
        conversationId: params.get('conversationId'),
        tenantId: params.get('tenantId'),
        joinUrl,
        dialInNumber: params.get('dialin'),
        conferenceId: params.get('conference-id'),
        passcode: params.get('passcode'),
      };
    } catch {
      return null;
    }
  }

  private async findAssociatedRecordings(meetingInfo: TeamsMeetingInfo): Promise<RecordingReference[]> {
    const recordings: RecordingReference[] = [];

    try {
      // Try different recording URL patterns
      const possibleUrls = [
        this.constructStreamUrl(meetingInfo),
        this.constructSharePointUrl(meetingInfo),
        this.constructTeamsDirectUrl(meetingInfo),
      ].filter(Boolean) as string[];

      // Test each URL for accessibility
      for (const url of possibleUrls) {
        try {
          const response = await fetch(url, { method: 'HEAD', mode: 'no-cors' });
          recordings.push({
            url,
            type: this.determineRecordingType(url),
            accessible: response.ok || response.type === 'opaque',
            lastChecked: new Date(),
          });
        } catch {
          // URL not accessible, continue
        }
      }
    } catch (error) {
      console.error('Recording search error:', error);
    }

    return recordings;
  }

  private calculateResolutionConfidence(meetingInfo: TeamsMeetingInfo, recordings: RecordingReference[]): number {
    let confidence = 0.3; // Base confidence

    // Boost for meeting ID presence
    if (meetingInfo.meetingId) confidence += 0.3;

    // Boost for tenant ID
    if (meetingInfo.tenantId) confidence += 0.2;

    // Boost for accessible recordings
    const accessibleRecordings = recordings.filter(r => r.accessible);
    confidence += accessibleRecordings.length * 0.1;

    return Math.min(1.0, confidence);
  }

  private parseTimeParam(timeParam: string | null): number | undefined {
    if (!timeParam) return undefined;

    try {
      // Parse time in seconds
      if (/^\d+$/.test(timeParam)) {
        return parseInt(timeParam);
      }

      // Parse time in MM:SS or HH:MM:SS format
      const timeParts = timeParam
        .split(':')
        .map(p => parseInt(p))
        .filter(p => !isNaN(p));
      if (timeParts.length === 2 && timeParts[0] !== undefined && timeParts[1] !== undefined) {
        return timeParts[0] * 60 + timeParts[1];
      } else if (
        timeParts.length === 3 &&
        timeParts[0] !== undefined &&
        timeParts[1] !== undefined &&
        timeParts[2] !== undefined
      ) {
        return timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
      }
    } catch {
      // Ignore parsing errors
    }

    return undefined;
  }

  private isValidTeamsDomain(hostname: string): boolean {
    const validDomains = ['teams.microsoft.com', 'teams.live.com', 'join.microsoft.com', 'microsoftstream.com'];

    return validDomains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
  }

  private normalizeQueryParams(searchParams: URLSearchParams): URLSearchParams {
    const normalized = new URLSearchParams();

    // Normalize parameter names
    const paramMappings = {
      mId: 'meetingId',
      tid: 'threadId',
      cid: 'channelId',
      'conference-id': 'meetingId',
    };

    for (const [key, value] of searchParams) {
      const normalizedKey = paramMappings[key as keyof typeof paramMappings] || key;
      normalized.set(normalizedKey, value);
    }

    return normalized;
  }

  private determineRecordingType(url: string): string {
    if (url.includes('microsoftstream.com')) return 'stream';
    if (url.includes('sharepoint.com')) return 'sharepoint';
    if (url.includes('teams.microsoft.com')) return 'teams';
    return 'unknown';
  }

  // Link resolution methods
  private async resolveMeetingLink(urlObj: URL): Promise<ResolvedLink> {
    return {
      originalUrl: urlObj.toString(),
      resolvedUrl: urlObj.toString(),
      type: 'meeting',
      accessible: true,
      metadata: this.parseDeepLinkParams(urlObj.toString()),
    };
  }

  private async resolveChannelLink(urlObj: URL): Promise<ResolvedLink> {
    return {
      originalUrl: urlObj.toString(),
      resolvedUrl: urlObj.toString(),
      type: 'channel',
      accessible: true,
      metadata: this.parseDeepLinkParams(urlObj.toString()),
    };
  }

  private async resolveChatLink(urlObj: URL): Promise<ResolvedLink> {
    return {
      originalUrl: urlObj.toString(),
      resolvedUrl: urlObj.toString(),
      type: 'chat',
      accessible: true,
      metadata: this.parseDeepLinkParams(urlObj.toString()),
    };
  }

  private async resolveStreamLink(urlObj: URL): Promise<ResolvedLink> {
    return {
      originalUrl: urlObj.toString(),
      resolvedUrl: urlObj.toString(),
      type: 'stream_video',
      accessible: true,
      metadata: this.parseDeepLinkParams(urlObj.toString()),
    };
  }

  private async resolveJoinLink(urlObj: URL): Promise<ResolvedLink> {
    return {
      originalUrl: urlObj.toString(),
      resolvedUrl: urlObj.toString(),
      type: 'join_link',
      accessible: true,
      metadata: this.parseDeepLinkParams(urlObj.toString()),
    };
  }
}

// Supporting interfaces

export interface ResolvedLink {
  originalUrl: string;
  resolvedUrl: string;
  type: string;
  accessible: boolean;
  metadata?: unknown;
  error?: string;
}

export interface MeetingIdInfo {
  meetingId: string;
  source: 'query_params' | 'path' | 'fragment' | 'encoded_data';
  confidence: number;
}

export interface MeetingResolution {
  meetingInfo: TeamsMeetingInfo;
  recordings: RecordingReference[];
  recordingUrls: string[];
  confidence: number;
  resolvedAt: Date;
}

export interface DeepLinkParams {
  meetingId?: string | undefined;
  threadId?: string | undefined;
  channelId?: string | undefined;
  conversationId?: string | undefined;
  messageId?: string | undefined;
  tenantId?: string | undefined;
  recordingId?: string | undefined;
  videoId?: string | undefined;
  startTime?: number | undefined;
  endTime?: number | undefined;
}

interface RecordingReference {
  url: string;
  type: string;
  accessible: boolean;
  lastChecked: Date;
}

interface LinkPattern {
  pattern: RegExp;
  resolver: (urlObj: URL) => Promise<ResolvedLink>;
}

// Create singleton instance
export const teamsLinkResolver = new TeamsLinkResolver();
