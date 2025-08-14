/**
 * Teams Page Analyzer
 * Specialized analysis for Teams meeting pages and channel conversations
 */

import { pageClassifier } from '../detection/page-classifier';
import { teamsDetector } from '../detection/teams-detector';
import type { TeamsMeetingContext } from '../detection/teams-detector';
import type { MeetingMessage, StreamVideoInfo } from '../types/analyzer';
import type { MeetingMetadata } from '../types/index';
import type { PageAnalysisResult, ContentIndicator, AnalyzedElement, ElementType } from '../types/page';

/**
 * Teams-specific page analysis and meeting detection
 */
export class TeamsAnalyzer {
  private teamsSelectors: TeamsSelectors;
  private recordingPatterns: RegExp[] = [];

  constructor() {
    this.teamsSelectors = new TeamsSelectors();
    this.initializeRecordingPatterns();
  }

  /**
   * Analyze Teams page for meeting content
   */
  async analyzeTeamsPage(url: string, document: Document): Promise<PageAnalysisResult> {
    const startTime = Date.now();

    try {
      // Basic page classification
      const basicAnalysis = await pageClassifier.classifyPage(url, document);

      // Teams-specific analysis
      const teamsElements = this.analyzeTeamsStructure(document);
      const meetingContext = teamsDetector.identifyMeetingContext(url, document);
      const channelInfo = this.analyzeChannelConversation(document);
      const recordingInfo = this.analyzeTeamsRecordings(document);

      // Combine indicators
      const indicators = [
        ...basicAnalysis.indicators,
        ...this.getTeamsContextIndicators(meetingContext),
        ...this.getChannelIndicators(channelInfo),
        ...this.getRecordingIndicators(recordingInfo),
      ];

      return {
        ...basicAnalysis,
        platform: 'teams',
        elements: [...basicAnalysis.elements, ...teamsElements],
        indicators,
        confidence: this.calculateTeamsConfidence(indicators, meetingContext),
        analysisTime: Date.now() - startTime,
        pageMetadata: {
          ...basicAnalysis.pageMetadata,
          ...this.extractTeamsMetadata(document, url),
        },
      };
    } catch (error) {
      console.error('Teams analysis error:', error);
      throw error;
    }
  }

  /**
   * Analyze page for general page analysis interface
   */
  async analyzePage(document: Document, url: string): Promise<unknown> {
    const analysis = await this.analyzeTeamsPage(url, document);
    return {
      platform: 'teams' as const,
      confidence: analysis.confidence,
      isMeetingPage: analysis.confidence > 0.5,
      indicators: analysis.indicators || [],
      elements: analysis.elements || [],
      status: 'completed' as const,
      analysisTime: Date.now(),
      url: url,
      errors: analysis.errors || [],
      pageMetadata: analysis.pageMetadata || {},
    };
  }

  /**
   * Extract meeting metadata from Teams page
   */
  extractMeetingMetadata(document: Document, url: string): MeetingMetadata {
    const metadata: Partial<MeetingMetadata> = {
      title: '',
      participants: [],
      topics: [],
    };

    try {
      // Extract meeting context
      const meetingContext = teamsDetector.identifyMeetingContext(url, document);

      // Extract title
      metadata.title = this.extractMeetingTitle(document);

      // Extract date and time
      metadata.date = this.extractMeetingDateTime(document);

      // Extract organizer
      metadata.organizer = this.extractMeetingOrganizer(document);

      // Extract participants
      metadata.participants = this.extractMeetingParticipants(document);

      // Extract duration
      metadata.duration = this.extractMeetingDuration(document);

      // Extract topics from conversation
      metadata.topics = this.extractConversationTopics(document);

      // Extract Teams-specific IDs
      metadata.platformIds = {
        meetingId: meetingContext?.meetingId || undefined,
        threadId: meetingContext?.threadId || undefined,
        conversationId: meetingContext?.conversationId || undefined,
        channelId: meetingContext?.channelId || undefined,
      };

      // Extract location context
      metadata.location = this.extractMeetingLocation(document);

      // Extract permissions
      metadata.permissions = this.extractMeetingPermissions(document) as {
        canAccess: boolean;
        canDownload: boolean;
        canShare: boolean;
        restrictions?: string[];
      };
    } catch (error) {
      console.error('Teams metadata extraction error:', error);
    }

    return {
      title: metadata.title || 'Teams Meeting',
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
   * Analyze Teams channel conversation for meeting recordings
   */
  analyzeChannelConversation(document: Document): ChannelConversationInfo {
    const info: ChannelConversationInfo = {
      isChannelConversation: false,
      channelName: '',
      teamName: '',
      messageCount: 0,
      hasRecordings: false,
      recordings: [],
      meetingMessages: [],
    };

    try {
      // Check if this is a channel conversation
      info.isChannelConversation = this.isChannelConversationPage(document);

      if (!info.isChannelConversation) {
        return info;
      }

      // Extract channel and team names
      info.channelName = this.extractChannelName(document);
      info.teamName = this.extractTeamName(document);

      // Count messages
      info.messageCount = this.countChannelMessages(document);

      // Find meeting-related messages
      info.meetingMessages = this.findMeetingMessages(document);

      // Find recordings in messages
      info.recordings = this.findRecordingsInMessages(document);
      info.hasRecordings = info.recordings.length > 0;
    } catch (error) {
      console.error('Channel conversation analysis error:', error);
    }

    return info;
  }

  // Private methods

  private initializeRecordingPatterns(): void {
    this.recordingPatterns = [/recording/i, /recorded/i, /playback/i, /watch.*meeting/i, /meeting.*recording/i];
  }

  private analyzeTeamsStructure(document: Document): AnalyzedElement[] {
    const elements: AnalyzedElement[] = [];

    // Analyze key Teams components
    const componentSelectors = [
      { selector: this.teamsSelectors.navigation, type: 'navigation_element' as const },
      { selector: this.teamsSelectors.commandBar, type: 'toolbar' as const },
      { selector: this.teamsSelectors.sidebar, type: 'sidebar' as const },
      { selector: this.teamsSelectors.contentArea, type: 'content_area' as const },
    ];

    for (const { selector, type } of componentSelectors) {
      const componentElements = document.querySelectorAll(selector);
      for (const element of componentElements) {
        elements.push(this.analyzeElement(element, type));
      }
    }

    return elements;
  }

  private analyzeElement(element: Element, elementType: ElementType): AnalyzedElement {
    return {
      tagName: element.tagName,
      classes: Array.from(element.classList),
      id: element.id || undefined,
      textContent: element.textContent?.substring(0, 200) || '',
      attributes: this.getElementAttributes(element),
      selector: this.getElementSelector(element),
      elementType: elementType,
      relevance: this.calculateElementRelevance(element, elementType),
    };
  }

  private analyzeTeamsRecordings(document: Document): TeamsRecordingInfo {
    const info: TeamsRecordingInfo = {
      hasRecordings: false,
      recordings: [],
      recordingLinks: [],
      streamVideos: [],
    };

    try {
      // Find recording-specific elements
      const recordingElements = document.querySelectorAll(this.teamsSelectors.recordings);

      for (const element of recordingElements) {
        const recording = this.extractRecordingInfo(element);
        if (recording) {
          info.recordings.push(recording);
        }
      }

      // Find recording links in messages
      const links = document.querySelectorAll('a[href]');
      for (const link of links) {
        const href = link.getAttribute('href') || '';
        if (teamsDetector.isTeamsRecordingUrl(href)) {
          info.recordingLinks.push({
            url: href,
            title: link.textContent || '',
            element: this.getElementSelector(link),
          });
        }
      }

      // Find embedded Stream videos
      const streamIframes = document.querySelectorAll('iframe[src*="microsoftstream.com"]');
      for (const iframe of streamIframes) {
        const streamInfo = this.extractStreamVideoInfo(iframe);
        if (streamInfo) {
          info.streamVideos.push(streamInfo);
        }
      }

      info.hasRecordings = info.recordings.length > 0 || info.recordingLinks.length > 0 || info.streamVideos.length > 0;
    } catch (error) {
      console.error('Teams recording analysis error:', error);
    }

    return info;
  }

  private getTeamsContextIndicators(context: TeamsMeetingContext | null): ContentIndicator[] {
    const indicators: ContentIndicator[] = [];

    if (context) {
      indicators.push({
        type: 'teams_channel',
        strength: context.confidence,
        selector: 'body',
        content: `Teams Meeting Context: ${context.meetingType}`,
        priority: 'high',
        context: {
          meetingType: context.meetingType,
          meetingId: context.meetingId,
          channelId: context.channelId,
          threadId: context.threadId,
        },
      });
    }

    return indicators;
  }

  private getChannelIndicators(info: ChannelConversationInfo): ContentIndicator[] {
    const indicators: ContentIndicator[] = [];

    if (info.isChannelConversation) {
      indicators.push({
        type: 'teams_channel',
        strength: 0.8,
        selector: this.teamsSelectors.contentArea,
        content: `Channel: ${info.channelName} in ${info.teamName}`,
        priority: 'medium',
        context: {
          channelName: info.channelName,
          teamName: info.teamName,
          messageCount: info.messageCount,
          hasRecordings: info.hasRecordings,
        },
      });

      // Add indicators for meeting messages
      for (const message of info.meetingMessages) {
        indicators.push({
          type: 'meeting_metadata',
          strength: 0.7,
          selector: message.selector,
          content: message.content.substring(0, 100),
          priority: 'medium',
          context: {
            messageType: message.type,
            timestamp: message.timestamp,
          },
        });
      }
    }

    return indicators;
  }

  private getRecordingIndicators(info: TeamsRecordingInfo): ContentIndicator[] {
    const indicators: ContentIndicator[] = [];

    if (info.hasRecordings) {
      // Add indicators for direct recordings
      for (const recording of info.recordings) {
        indicators.push({
          type: 'recording_link',
          strength: 0.9,
          selector: recording.selector,
          content: recording.title,
          priority: 'critical',
          context: {
            platform: 'teams',
            recordingType: recording.type,
            duration: recording.duration,
          },
        });
      }

      // Add indicators for recording links
      for (const link of info.recordingLinks) {
        indicators.push({
          type: 'recording_link',
          strength: 0.8,
          selector: link.element,
          content: link.title,
          priority: 'critical',
          context: {
            platform: 'teams',
            url: link.url,
          },
        });
      }

      // Add indicators for Stream videos
      for (const video of info.streamVideos) {
        indicators.push({
          type: 'video_player',
          strength: 0.9,
          selector: 'iframe',
          content: video.title,
          priority: 'critical',
          context: {
            platform: 'stream',
            videoId: video.videoId,
            embedded: true,
          },
        });
      }
    }

    return indicators;
  }

  private calculateTeamsConfidence(indicators: ContentIndicator[], meetingContext: TeamsMeetingContext | null): number {
    let confidence = 0.5;

    // Boost confidence for Teams-specific indicators
    const teamsIndicators = indicators.filter(i => i.type === 'teams_channel' || i.context?.platform === 'teams');

    confidence += teamsIndicators.length * 0.1;

    // Boost confidence for meeting context
    if (meetingContext) {
      confidence += meetingContext.confidence * 0.3;
    }

    // Boost confidence for recordings
    const recordingIndicators = indicators.filter(i => i.type === 'recording_link' || i.type === 'video_player');
    confidence += recordingIndicators.length * 0.15;

    return Math.min(1.0, confidence);
  }

  private extractTeamsMetadata(document: Document, url: string): Record<string, unknown> {
    const meetingInfo = teamsDetector.extractMeetingInfo(url);

    return {
      teamsUrl: url,
      meetingId: meetingInfo?.meetingId,
      tenantId: meetingInfo?.tenantId,
      threadId: meetingInfo?.threadId,
      channelId: meetingInfo?.channelId,
      interfaceType: this.detectInterfaceType(document),
    };
  }

  // Helper methods for metadata extraction
  private extractMeetingTitle(document: Document): string {
    const titleSelectors = [this.teamsSelectors.meetingTitle, 'h1', '[data-tid="meeting-title"]', '.meeting-header h1'];

    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element?.textContent) {
        return element.textContent.trim();
      }
    }

    return document.title || 'Teams Meeting';
  }

  private extractMeetingDateTime(document: Document): Date | undefined {
    const dateSelectors = ['[data-tid="meeting-datetime"]', '.meeting-time', 'time[datetime]'];

    for (const selector of dateSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const datetime = element.getAttribute('datetime') || element.textContent;
        if (datetime) {
          try {
            return new Date(datetime);
          } catch {
            continue;
          }
        }
      }
    }

    return undefined;
  }

  private extractMeetingOrganizer(document: Document): string | undefined {
    const organizerSelectors = ['[data-tid="meeting-organizer"]', '.meeting-organizer', '.organizer-name'];

    for (const selector of organizerSelectors) {
      const element = document.querySelector(selector);
      if (element?.textContent) {
        return element.textContent.trim();
      }
    }

    return undefined;
  }

  private extractMeetingParticipants(document: Document): string[] {
    const participants: string[] = [];

    const participantSelectors = [this.teamsSelectors.participants, '[data-tid="participant"]', '.participant-name'];

    for (const selector of participantSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const name = element.textContent?.trim();
        if (name && !participants.includes(name)) {
          participants.push(name);
        }
      }
    }

    return participants;
  }

  private extractMeetingDuration(document: Document): number | undefined {
    const durationSelectors = ['[data-tid="meeting-duration"]', '.meeting-duration', '.duration'];

    for (const selector of durationSelectors) {
      const element = document.querySelector(selector);
      if (element?.textContent) {
        const duration = this.parseDuration(element.textContent);
        if (duration) return duration;
      }
    }

    return undefined;
  }

  private extractConversationTopics(document: Document): string[] {
    const topics: string[] = [];

    // Extract topics from conversation messages
    const messages = document.querySelectorAll(this.teamsSelectors.messages);
    for (const message of messages) {
      const text = message.textContent || '';
      const extractedTopics = this.extractTopicsFromText(text);
      topics.push(...extractedTopics);
    }

    return [...new Set(topics)]; // Remove duplicates
  }

  private extractMeetingLocation(document: Document): string | undefined {
    const locationSelectors = ['[data-tid="meeting-location"]', '.meeting-location', '.location'];

    for (const selector of locationSelectors) {
      const element = document.querySelector(selector);
      if (element?.textContent) {
        return element.textContent.trim();
      }
    }

    return undefined;
  }

  private extractMeetingPermissions(document: Document): unknown {
    // Extract permissions based on available UI elements
    const canRecord = document.querySelector('[data-tid="record-button"]') !== null;
    const canShare = document.querySelector('[data-tid="share-button"]') !== null;
    const canDownload = document.querySelector('[data-tid="download-button"]') !== null;

    return {
      canAccess: true,
      canDownload,
      canShare,
      restrictions: canRecord ? [] : ['Recording not available'],
    };
  }

  // Additional helper methods...
  private getElementAttributes(element: Element): Record<string, string> {
    const attributes: Record<string, string> = {};
    for (const attr of element.attributes) {
      attributes[attr.name] = attr.value;
    }
    return attributes;
  }

  private getElementSelector(element: Element): string {
    if (element.id) return `#${element.id}`;

    let selector = element.tagName.toLowerCase();
    if (element.className) {
      const classes = element.className.toString().split(' ').filter(Boolean);
      if (classes.length > 0) {
        selector += `.${classes[0]}`;
      }
    }
    return selector;
  }

  private calculateElementRelevance(element: Element, elementType: ElementType): number {
    let relevance = 0.5;

    const text = element.textContent?.toLowerCase() || '';
    if (text.includes('meeting') || text.includes('recording')) relevance += 0.3;
    if (elementType === 'media_player') relevance += 0.4;

    return Math.min(1.0, relevance);
  }

  private isChannelConversationPage(document: Document): boolean {
    return document.querySelector(this.teamsSelectors.channelView) !== null;
  }

  private extractChannelName(document: Document): string {
    const element = document.querySelector(this.teamsSelectors.channelName);
    return element?.textContent?.trim() || '';
  }

  private extractTeamName(document: Document): string {
    const element = document.querySelector(this.teamsSelectors.teamName);
    return element?.textContent?.trim() || '';
  }

  private countChannelMessages(document: Document): number {
    return document.querySelectorAll(this.teamsSelectors.messages).length;
  }

  private findMeetingMessages(document: Document): MeetingMessage[] {
    const messages: MeetingMessage[] = [];
    const messageElements = document.querySelectorAll(this.teamsSelectors.messages);

    for (const element of messageElements) {
      const text = element.textContent || '';
      if (this.isMeetingRelatedMessage(text)) {
        const message: MeetingMessage = {
          content: text,
          selector: this.getElementSelector(element),
          type: this.determineMeetingMessageType(text),
          timestamp: this.extractMessageTimestamp(element),
        };
        messages.push(message);
      }
    }

    return messages;
  }

  private findRecordingsInMessages(document: Document): RecordingInfo[] {
    const recordings: RecordingInfo[] = [];
    const links = document.querySelectorAll('a[href]');

    for (const link of links) {
      const href = link.getAttribute('href') || '';
      if (teamsDetector.isTeamsRecordingUrl(href)) {
        recordings.push({
          title: link.textContent || '',
          url: href,
          selector: this.getElementSelector(link),
          type: 'link',
        });
      }
    }

    return recordings;
  }

  private extractRecordingInfo(element: Element): RecordingInfo | null {
    const text = element.textContent || '';
    if (!this.recordingPatterns.some(pattern => pattern.test(text))) {
      return null;
    }

    return {
      title: text.substring(0, 100),
      selector: this.getElementSelector(element),
      type: 'element',
    };
  }

  private extractStreamVideoInfo(iframe: Element): StreamVideoInfo | null {
    const src = iframe.getAttribute('src');
    if (!src || !src.includes('microsoftstream.com')) {
      return null;
    }

    const title = iframe.getAttribute('title') || 'Stream Video';
    const videoIdMatch = src.match(/\/video\/([^/?]+)/);

    return {
      url: src,
      title,
      videoId: videoIdMatch ? videoIdMatch[1] : '',
    };
  }

  private detectInterfaceType(document: Document): string {
    const body = document.body.className.toLowerCase();

    if (body.includes('desktop')) return 'desktop_client';
    if (body.includes('mobile')) return 'mobile_web';
    if (body.includes('embedded')) return 'embedded';

    return 'web_client';
  }

  private parseDuration(text: string): number | undefined {
    const patterns = [
      /(\d+):(\d+):(\d+)/, // HH:MM:SS
      /(\d+):(\d+)/, // MM:SS
      /(\d+)\s*(?:hours?|hrs?)/i,
      /(\d+)\s*(?:minutes?|mins?)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        if (match.length === 4 && match[1] && match[2] && match[3]) {
          // HH:MM:SS
          return parseInt(match[1], 10) * 3600 + parseInt(match[2], 10) * 60 + parseInt(match[3], 10);
        } else if (match.length === 3 && match[1] && match[2]) {
          // MM:SS
          return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
        } else if (text.includes('hour') && match[1]) {
          return parseInt(match[1], 10) * 3600;
        } else if (text.includes('minute') && match[1]) {
          return parseInt(match[1], 10) * 60;
        }
      }
    }

    return undefined;
  }

  private extractTopicsFromText(text: string): string[] {
    // Simple topic extraction - could be enhanced with NLP
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    return sentences.slice(0, 3).map(s => s.trim().substring(0, 50));
  }

  private isMeetingRelatedMessage(text: string): boolean {
    const keywords = ['meeting', 'recording', 'started', 'ended', 'joined', 'left'];
    const textLower = text.toLowerCase();
    return keywords.some(keyword => textLower.includes(keyword));
  }

  private determineMeetingMessageType(text: string): string {
    const textLower = text.toLowerCase();

    if (textLower.includes('started')) return 'meeting_started';
    if (textLower.includes('ended')) return 'meeting_ended';
    if (textLower.includes('recording')) return 'recording_notification';
    if (textLower.includes('joined')) return 'participant_joined';

    return 'meeting_related';
  }

  private extractMessageTimestamp(element: Element): Date | undefined {
    const timeElement = element.querySelector('time[datetime]');
    if (timeElement) {
      const datetime = timeElement.getAttribute('datetime');
      if (datetime) {
        try {
          return new Date(datetime);
        } catch {
          return undefined;
        }
      }
    }
    return undefined;
  }
}

// Teams-specific selectors
class TeamsSelectors {
  readonly navigation = '[data-tid="app-bar"], .app-bar';
  readonly commandBar = '[data-tid="command-bar"], .command-bar';
  readonly sidebar = '[data-tid="sidebar"], .sidebar';
  readonly contentArea = '[data-tid="content-area"], .content-area';
  readonly channelView = '[data-tid="channel-view"]';
  readonly channelName = '[data-tid="channel-name"]';
  readonly teamName = '[data-tid="team-name"]';
  readonly messages = '[data-tid="message"], .message';
  readonly participants = '[data-tid="participant"], .participant';
  readonly recordings = '[data-tid*="recording"], [class*="recording"]';
  readonly meetingTitle = '[data-tid="meeting-title"]';
}

// Supporting interfaces
interface ChannelConversationInfo {
  isChannelConversation: boolean;
  channelName: string;
  teamName: string;
  messageCount: number;
  hasRecordings: boolean;
  recordings: RecordingInfo[];
  meetingMessages: MeetingMessage[];
}

interface TeamsRecordingInfo {
  hasRecordings: boolean;
  recordings: RecordingInfo[];
  recordingLinks: RecordingLink[];
  streamVideos: StreamVideoInfo[];
}

interface RecordingInfo {
  title: string;
  selector: string;
  type: string;
  url?: string | undefined;
  duration?: number | undefined;
}

interface RecordingLink {
  url: string;
  title: string;
  element: string;
}

// Create singleton instance
export const teamsAnalyzer = new TeamsAnalyzer();
