/**
 * Content Indicators
 * Detects meeting recording patterns and monitors dynamic content
 */

import type { MeetingPlatform } from '../types/index';
import type { ContentIndicator, PageChangeEvent, PageMonitorConfig } from '../types/page';

/**
 * Meeting recording detection and dynamic content monitoring
 */
export class ContentIndicators {
  private observers = new Map<string, MutationObserver>();
  private changeCallbacks = new Map<string, (event: PageChangeEvent) => void>();
  private monitorConfigs = new Map<string, PageMonitorConfig>();

  constructor() {
    this.initializeIndicatorPatterns();
  }

  /**
   * Detect content indicators in page content
   */
  detectContentIndicators(document: Document, url: string, platform: MeetingPlatform): ContentIndicator[] {
    return this.detectMeetingRecordings(document, platform);
  }

  /**
   * Detect meeting recording indicators in page content
   */
  detectMeetingRecordings(document: Document, platform: MeetingPlatform): ContentIndicator[] {
    const indicators: ContentIndicator[] = [];

    try {
      // Audio/Video player detection
      indicators.push(...this.detectMediaPlayers(document));

      // Recording link detection
      indicators.push(...this.detectRecordingLinks(document, platform));

      // Download button detection
      indicators.push(...this.detectDownloadButtons(document));

      // Transcript content detection
      indicators.push(...this.detectTranscriptContent(document));

      // Meeting metadata detection
      indicators.push(...this.detectMeetingMetadata(document));

      // Platform-specific indicators
      indicators.push(...this.detectPlatformSpecificContent(document, platform));
    } catch (error) {
      console.error('Meeting recording detection error:', error);
    }

    return indicators;
  }

  /**
   * Start monitoring page for dynamic content changes
   */
  startDynamicMonitoring(
    document: Document,
    config: PageMonitorConfig,
    callback: (event: PageChangeEvent) => void,
  ): string {
    const monitorId = this.generateMonitorId();

    this.monitorConfigs.set(monitorId, config);
    this.changeCallbacks.set(monitorId, callback);

    const observer = new MutationObserver(mutations => {
      this.processMutations(mutations, config, callback);
    });

    // Configure observer options
    const observerConfig: MutationObserverInit = {
      childList: config.childListChanges,
      attributes: config.attributeChanges,
      subtree: config.subtreeChanges,
      attributeOldValue: true,
      characterData: true,
      characterDataOldValue: true,
    };

    // Start observing
    observer.observe(document.body, observerConfig);
    this.observers.set(monitorId, observer);

    return monitorId;
  }

  /**
   * Stop dynamic content monitoring
   */
  stopDynamicMonitoring(monitorId: string): void {
    const observer = this.observers.get(monitorId);
    if (observer) {
      observer.disconnect();
      this.observers.delete(monitorId);
    }

    this.changeCallbacks.delete(monitorId);
    this.monitorConfigs.delete(monitorId);
  }

  /**
   * Detect meeting presence in Single Page Application navigation
   */
  detectSPAMeetingContent(oldUrl: string, newUrl: string, document: Document): SPANavigationResult {
    const contentChanged = this.analyzeContentChange(oldUrl, newUrl);
    const newIndicators = this.detectMeetingRecordings(document, this.getPlatformFromUrl(newUrl));

    return {
      navigationDetected: oldUrl !== newUrl,
      contentChanged,
      meetingContentFound: newIndicators.length > 0,
      indicators: newIndicators,
      confidence: this.calculateNavigationConfidence(contentChanged, newIndicators),
      timestamp: new Date(),
    };
  }

  /**
   * Validate recording accessibility
   */
  async validateRecordingAccess(url: string): Promise<RecordingAccessInfo> {
    try {
      // Attempt to fetch resource information
      const response = await fetch(url, { method: 'HEAD' });

      return {
        accessible: response.ok,
        statusCode: response.status,
        contentType: response.headers.get('content-type'),
        contentLength: parseInt(response.headers.get('content-length') || '0'),
        requiresAuth: response.status === 401 || response.status === 403,
        lastModified: response.headers.get('last-modified'),
        cacheControl: response.headers.get('cache-control'),
      };
    } catch (error) {
      return {
        accessible: false,
        statusCode: 0,
        requiresAuth: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Private methods

  private initializeIndicatorPatterns(): void {
    // Initialize detection patterns and selectors
  }

  private detectMediaPlayers(document: Document): ContentIndicator[] {
    const indicators: ContentIndicator[] = [];

    // HTML5 audio elements
    const audioElements = document.querySelectorAll('audio');
    for (const audio of audioElements) {
      indicators.push({
        type: 'audio_player',
        strength: 0.9,
        selector: this.getElementSelector(audio),
        content: audio.getAttribute('src') || audio.currentSrc,
        priority: 'critical',
        context: {
          duration: audio.duration || 0,
          currentTime: audio.currentTime || 0,
          controls: audio.hasAttribute('controls'),
        },
      });
    }

    // HTML5 video elements
    const videoElements = document.querySelectorAll('video');
    for (const video of videoElements) {
      indicators.push({
        type: 'video_player',
        strength: 0.9,
        selector: this.getElementSelector(video),
        content: video.getAttribute('src') || video.currentSrc,
        priority: 'critical',
        context: {
          duration: video.duration || 0,
          currentTime: video.currentTime || 0,
          controls: video.hasAttribute('controls'),
          width: video.videoWidth,
          height: video.videoHeight,
        },
      });
    }

    // Custom video players (common selectors)
    const customPlayerSelectors = [
      '[class*="video-player"]',
      '[class*="media-player"]',
      '[data-testid*="player"]',
      '.player-container',
      '#video-container',
    ];

    for (const selector of customPlayerSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        if (this.isLikelyMediaPlayer(element)) {
          indicators.push({
            type: 'video_player',
            strength: 0.7,
            selector,
            content: element.textContent?.substring(0, 100),
            priority: 'high',
            context: {
              customPlayer: true,
              elementType: element.tagName,
            },
          });
        }
      }
    }

    return indicators;
  }

  private detectRecordingLinks(document: Document, platform: MeetingPlatform): ContentIndicator[] {
    const indicators: ContentIndicator[] = [];

    // Direct recording file links
    const recordingPatterns = [
      /\.mp4(?|$)/i,
      /\.mp3(?|$)/i,
      /\.wav(?|$)/i,
      /\.m4a(?|$)/i,
      /\.webm(?|$)/i,
      /recording/i,
      /playback/i,
    ];

    const links = document.querySelectorAll('a[href]');
    for (const link of links) {
      const href = link.getAttribute('href') || '';
      const linkText = link.textContent?.toLowerCase() || '';

      for (const pattern of recordingPatterns) {
        if (pattern.test(href) || pattern.test(linkText)) {
          indicators.push({
            type: 'recording_link',
            strength: this.calculateLinkStrength(href, linkText, pattern),
            selector: this.getElementSelector(link),
            content: link.textContent?.substring(0, 100),
            priority: 'critical',
            context: {
              href,
              pattern: pattern.source,
              platform,
            },
          });
          break; // Only add one indicator per link
        }
      }
    }

    // Platform-specific recording patterns
    if (platform === 'sharepoint') {
      indicators.push(...this.detectSharePointRecordings(document));
    } else if (platform === 'teams') {
      indicators.push(...this.detectTeamsRecordings(document));
    }

    return indicators;
  }

  private detectDownloadButtons(document: Document): ContentIndicator[] {
    const indicators: ContentIndicator[] = [];

    // Download attribute links
    const downloadLinks = document.querySelectorAll('a[download]');
    for (const link of downloadLinks) {
      const href = link.getAttribute('href') || '';
      if (this.isMediaFile(href)) {
        indicators.push({
          type: 'download_button',
          strength: 0.8,
          selector: this.getElementSelector(link),
          content: link.textContent?.substring(0, 50),
          priority: 'high',
          context: {
            href,
            downloadAttr: link.getAttribute('download'),
          },
        });
      }
    }

    // Download button patterns
    const downloadSelectors = [
      'button[class*="download"]',
      '[data-action="download"]',
      '[title*="download"]',
      '.download-btn',
      '.btn-download',
    ];

    for (const selector of downloadSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const text = element.textContent?.toLowerCase() || '';
        if (text.includes('download') || text.includes('save')) {
          indicators.push({
            type: 'download_button',
            strength: 0.6,
            selector,
            content: element.textContent?.substring(0, 50),
            priority: 'medium',
            context: {
              elementType: element.tagName,
              buttonType: 'download',
            },
          });
        }
      }
    }

    return indicators;
  }

  private detectTranscriptContent(document: Document): ContentIndicator[] {
    const indicators: ContentIndicator[] = [];

    // Transcript-specific selectors and patterns
    const transcriptSelectors = [
      '[class*="transcript"]',
      '[data-testid*="transcript"]',
      '.captions',
      '.subtitles',
      '[class*="caption"]',
    ];

    for (const selector of transcriptSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const textContent = element.textContent || '';
        if (this.isLikelyTranscript(textContent)) {
          indicators.push({
            type: 'transcript_content',
            strength: 0.8,
            selector,
            content: textContent.substring(0, 200),
            priority: 'high',
            context: {
              length: textContent.length,
              wordCount: textContent.split(/\s+/).length,
            },
          });
        }
      }
    }

    // Text content analysis for transcript patterns
    const textNodes = this.getTextNodes(document.body);
    for (const node of textNodes) {
      const text = node.textContent || '';
      if (this.isLikelyTranscript(text) && text.length > 500) {
        indicators.push({
          type: 'transcript_content',
          strength: 0.6,
          selector: this.getNodeSelector(node),
          content: text.substring(0, 200),
          priority: 'medium',
          context: {
            length: text.length,
            nodeType: 'text',
            parentTag: node.parentElement?.tagName,
          },
        });
      }
    }

    return indicators;
  }

  private detectMeetingMetadata(document: Document): ContentIndicator[] {
    const indicators: ContentIndicator[] = [];

    // Meeting title detection
    const titleSelectors = ['h1', 'h2', 'h3', '[class*="title"]', '[class*="subject"]', '[data-testid*="title"]'];

    for (const selector of titleSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const text = element.textContent || '';
        if (this.isMeetingTitle(text)) {
          indicators.push({
            type: 'meeting_title',
            strength: 0.7,
            selector,
            content: text.substring(0, 100),
            priority: 'high',
            context: {
              tagName: element.tagName,
              position: this.getElementPosition(element),
            },
          });
        }
      }
    }

    // Participant list detection
    const participantSelectors = [
      '[class*="participant"]',
      '[class*="attendee"]',
      '.user-list',
      '[data-testid*="participant"]',
    ];

    for (const selector of participantSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const participants = this.extractParticipants(element);
        if (participants.length > 0) {
          indicators.push({
            type: 'participant_list',
            strength: 0.6,
            selector,
            content: participants.join(', ').substring(0, 100),
            priority: 'medium',
            context: {
              count: participants.length,
              participants: participants.slice(0, 5), // Limit for privacy
            },
          });
        }
      }
    }

    // Date/time detection
    const dateSelectors = ['[class*="date"]', '[class*="time"]', 'time', '[datetime]'];

    for (const selector of dateSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const dateInfo = this.extractDateInfo(element);
        if (dateInfo) {
          indicators.push({
            type: 'meeting_date',
            strength: 0.5,
            selector,
            content: dateInfo.formatted,
            priority: 'medium',
            context: dateInfo
              ? ({
                  date: dateInfo.date.toISOString(),
                  formatted: dateInfo.formatted,
                  iso: dateInfo.iso,
                  source: dateInfo.source,
                } as Record<string, unknown>)
              : {},
          });
        }
      }
    }

    return indicators;
  }

  private detectPlatformSpecificContent(document: Document, platform: MeetingPlatform): ContentIndicator[] {
    switch (platform) {
      case 'sharepoint':
        return this.detectSharePointSpecificContent(document);
      case 'teams':
        return this.detectTeamsSpecificContent(document);
      default:
        return [];
    }
  }

  private detectSharePointRecordings(document: Document): ContentIndicator[] {
    const indicators: ContentIndicator[] = [];

    // SharePoint Stream integration
    const streamSelectors = ['[class*="stream"]', '[data-component*="Stream"]', '.video-tile', '.media-tile'];

    for (const selector of streamSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        if (this.hasVideoContent(element)) {
          indicators.push({
            type: 'recording_link',
            strength: 0.8,
            selector,
            content: element.textContent?.substring(0, 100),
            priority: 'high',
            context: {
              platform: 'sharepoint',
              integration: 'stream',
            },
          });
        }
      }
    }

    return indicators;
  }

  private detectTeamsRecordings(document: Document): ContentIndicator[] {
    const indicators: ContentIndicator[] = [];

    // Teams-specific recording indicators
    const teamsSelectors = ['[data-tid*="recording"]', '[data-tid*="playback"]', '.recording-link', '.teams-recording'];

    for (const selector of teamsSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        indicators.push({
          type: 'recording_link',
          strength: 0.9,
          selector,
          content: element.textContent?.substring(0, 100),
          priority: 'critical',
          context: {
            platform: 'teams',
            teamsSpecific: true,
          },
        });
      }
    }

    return indicators;
  }

  private detectSharePointSpecificContent(document: Document): ContentIndicator[] {
    const indicators: ContentIndicator[] = [];

    // Document library indicators
    const librarySelectors = ['.ms-List', '.od-Files-list', '[data-automationid="DetailsList"]'];

    for (const selector of librarySelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        indicators.push({
          type: 'sharepoint_library',
          strength: 0.7,
          selector,
          content: 'SharePoint Document Library',
          priority: 'medium',
          context: {
            platform: 'sharepoint',
            itemCount: element.children.length,
          },
        });
      }
    }

    return indicators;
  }

  private detectTeamsSpecificContent(document: Document): ContentIndicator[] {
    const indicators: ContentIndicator[] = [];

    // Teams channel indicators
    const channelSelectors = ['[data-tid="channel-view"]', '.ts-conversation', '.thread-body'];

    for (const selector of channelSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        indicators.push({
          type: 'teams_channel',
          strength: 0.8,
          selector,
          content: 'Teams Channel Content',
          priority: 'medium',
          context: {
            platform: 'teams',
            messageCount: element.querySelectorAll('[data-tid="message"]').length,
          },
        });
      }
    }

    return indicators;
  }

  private processMutations(
    mutations: MutationRecord[],
    config: PageMonitorConfig,
    callback: (event: PageChangeEvent) => void,
  ): void {
    const events: PageChangeEvent[] = [];

    for (const mutation of mutations) {
      if (mutation.type === 'childList' && config.childListChanges) {
        // Handle added nodes
        for (const node of Array.from(mutation.addedNodes)) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            events.push({
              type: 'element_added',
              selector: this.getElementSelector(node as Element),
              timestamp: new Date(),
              addedNodes: [node],
            });
          }
        }

        // Handle removed nodes
        for (const node of Array.from(mutation.removedNodes)) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            events.push({
              type: 'element_removed',
              selector: this.getElementSelector(node as Element),
              timestamp: new Date(),
              removedNodes: [node],
            });
          }
        }
      }

      if (mutation.type === 'attributes' && config.attributeChanges) {
        const target = mutation.target as Element;
        events.push({
          type: 'attribute_changed',
          selector: this.getElementSelector(target),
          timestamp: new Date(),
          oldValue: mutation.oldValue || undefined,
          newValue: target.getAttribute(mutation.attributeName || '') || undefined,
        });
      }
    }

    // Process events with debouncing
    this.debounceAndCallback(events, config.debounceMs, callback);
  }

  private debounceAndCallback(
    events: PageChangeEvent[],
    debounceMs: number,
    callback: (event: PageChangeEvent) => void,
  ): void {
    // Simple debouncing - in production, use a more sophisticated approach
    setTimeout(() => {
      for (const event of events) {
        callback(event);
      }
    }, debounceMs);
  }

  // Helper methods

  private generateMonitorId(): string {
    return `monitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getElementSelector(element: Element): string {
    if (element.id) {
      return `#${element.id}`;
    }

    let selector = element.tagName.toLowerCase();

    if (element.className) {
      const classes = element.className.toString().split(' ').filter(Boolean);
      if (classes.length > 0) {
        selector += `.${classes[0]}`;
      }
    }

    return selector;
  }

  private getNodeSelector(node: Node): string {
    if (node.parentElement) {
      return this.getElementSelector(node.parentElement);
    }
    return 'unknown';
  }

  private isLikelyMediaPlayer(element: Element): boolean {
    const text = element.textContent?.toLowerCase() || '';
    const className = element.className.toString().toLowerCase();

    return (
      text.includes('play') ||
      text.includes('pause') ||
      className.includes('player') ||
      className.includes('video') ||
      className.includes('audio')
    );
  }

  private calculateLinkStrength(href: string, linkText: string, pattern: RegExp): number {
    let strength = 0.6; // Base strength

    if (pattern.test(href)) strength += 0.2;
    if (pattern.test(linkText)) strength += 0.1;
    if (href.includes('recording')) strength += 0.1;

    return Math.min(1.0, strength);
  }

  private isMediaFile(url: string): boolean {
    const mediaExtensions = ['.mp4', '.mp3', '.wav', '.m4a', '.webm', '.ogg'];
    return mediaExtensions.some(ext => url.toLowerCase().includes(ext));
  }

  private isLikelyTranscript(text: string): boolean {
    if (text.length < 100) return false;

    // Check for transcript patterns
    const transcriptPatterns = [
      /\d{1,2}:\d{2}/g, // Timestamps
      /Speaker \d+:/gi,
      /\[SPEAKER\]/gi,
      />>.*?:/g, // Speaker indicators
    ];

    const matches = transcriptPatterns.reduce((count, pattern) => count + (text.match(pattern) || []).length, 0);

    return matches > 3; // Has enough transcript-like patterns
  }

  private isMeetingTitle(text: string): boolean {
    const meetingKeywords = [
      'meeting',
      'conference',
      'call',
      'session',
      'standup',
      'retrospective',
      'planning',
      'review',
      'sync',
      'discussion',
    ];

    const textLower = text.toLowerCase();
    return meetingKeywords.some(keyword => textLower.includes(keyword));
  }

  private getElementPosition(element: Element): { top: number; left: number } {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
    };
  }

  private extractParticipants(element: Element): string[] {
    // Simple participant extraction - look for names
    const text = element.textContent || '';
    const lines = text
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    // Filter lines that look like names
    return lines.filter(
      line => line.length > 2 && line.length < 50 && /^[A-Za-z\s,.-]+$/.test(line) && !line.includes('@'), // Exclude emails for privacy
    );
  }

  private extractDateInfo(element: Element): DateInfo | null {
    const datetime = element.getAttribute('datetime');
    const text = element.textContent || '';

    try {
      let date: Date;

      if (datetime) {
        date = new Date(datetime);
      } else {
        // Try to parse text content
        date = new Date(text);
      }

      if (isNaN(date.getTime())) {
        return null;
      }

      return {
        date,
        formatted: date.toLocaleString(),
        iso: date.toISOString(),
        source: datetime ? 'datetime_attr' : 'text_content',
      };
    } catch {
      return null;
    }
  }

  private hasVideoContent(element: Element): boolean {
    return (
      element.querySelector('video') !== null ||
      element.querySelector('iframe[src*="video"]') !== null ||
      element.textContent?.toLowerCase().includes('video') === true
    );
  }

  private getTextNodes(element: Element): Text[] {
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);

    let node;
    while ((node = walker.nextNode())) {
      if (node.textContent && node.textContent.trim().length > 50) {
        textNodes.push(node as Text);
      }
    }

    return textNodes;
  }

  private analyzeContentChange(oldUrl: string, newUrl: string): boolean {
    // Simple URL-based change detection
    return oldUrl !== newUrl;
  }

  private getPlatformFromUrl(url: string): MeetingPlatform {
    if (url.includes('sharepoint')) return 'sharepoint';
    if (url.includes('teams')) return 'teams';
    return 'unknown';
  }

  private calculateNavigationConfidence(contentChanged: boolean, indicators: ContentIndicator[]): number {
    let confidence = 0.5;

    if (contentChanged) confidence += 0.2;
    if (indicators.length > 0) confidence += 0.3;

    return Math.min(1.0, confidence);
  }
}

// Supporting interfaces

export interface SPANavigationResult {
  navigationDetected: boolean;
  contentChanged: boolean;
  meetingContentFound: boolean;
  indicators: ContentIndicator[];
  confidence: number;
  timestamp: Date;
}

export interface RecordingAccessInfo {
  accessible: boolean;
  statusCode: number;
  contentType?: string | null;
  contentLength?: number;
  requiresAuth: boolean;
  lastModified?: string | null;
  cacheControl?: string | null;
  error?: string;
}

interface DateInfo {
  date: Date;
  formatted: string;
  iso: string;
  source: 'datetime_attr' | 'text_content';
}

// Create singleton instance
export const contentIndicators = new ContentIndicators();
