/**
 * Content Analyzer
 *
 * Content analysis for meeting detection and context understanding with
 * content classification and meeting content recognition.
 */

import { pageRouter } from '../pages/page-router';
import { eventManager } from '../utils/event-manager';
import { mutationObserver } from '../utils/mutation-observer';

/**
 * Content types for analysis
 */
export type ContentType =
  | 'meeting.video'
  | 'meeting.audio'
  | 'meeting.transcript'
  | 'meeting.recording'
  | 'document.text'
  | 'document.presentation'
  | 'interface.controls'
  | 'interface.participants'
  | 'interface.chat'
  | 'unknown';

/**
 * Meeting content indicators
 */
export interface MeetingIndicators {
  /** Video elements present */
  hasVideo: boolean;
  /** Audio elements present */
  hasAudio: boolean;
  /** Meeting controls present */
  hasControls: boolean;
  /** Participant list present */
  hasParticipants: boolean;
  /** Chat interface present */
  hasChat: boolean;
  /** Recording indicators present */
  hasRecording: boolean;
  /** Transcript elements present */
  hasTranscript: boolean;
  /** Meeting title or subject present */
  hasMeetingTitle: boolean;
}

/**
 * Content analysis result
 */
export interface ContentAnalysisResult {
  /** Content type detected */
  contentType: ContentType;
  /** Meeting detection confidence (0-1) */
  meetingConfidence: number;
  /** Meeting indicators found */
  meetingIndicators: MeetingIndicators;
  /** Relevant elements found */
  elements: {
    video: HTMLVideoElement[];
    audio: HTMLAudioElement[];
    controls: HTMLElement[];
    participants: HTMLElement[];
    chat: HTMLElement[];
    transcript: HTMLElement[];
  };
  /** Content context */
  context: {
    pageType: string;
    platform: string;
    meetingState: 'scheduled' | 'active' | 'ended' | 'recording' | 'unknown';
    participants: number;
    duration?: number;
  };
  /** Analysis metadata */
  metadata: {
    timestamp: Date;
    analysisMethod: string;
    confidence: number;
    version: string;
  };
}

/**
 * Analysis configuration
 */
export interface AnalysisConfig {
  /** Enable real-time content monitoring */
  enableRealTimeMonitoring: boolean;
  /** Analysis interval in milliseconds */
  analysisInterval: number;
  /** Meeting detection threshold (0-1) */
  meetingThreshold: number;
  /** Content change detection sensitivity */
  changeSensitivity: 'low' | 'medium' | 'high';
  /** Platform-specific detection rules */
  platformRules: {
    sharepoint: boolean;
    teams: boolean;
    generic: boolean;
  };
  /** Advanced analysis features */
  advancedFeatures: {
    semanticAnalysis: boolean;
    contextLearning: boolean;
    patternRecognition: boolean;
  };
  /** Performance settings */
  performance: {
    maxAnalysisTime: number;
    cacheResults: boolean;
    throttleUpdates: boolean;
  };
}

/**
 * Content change event
 */
export interface ContentChangeEvent {
  /** Change type */
  type: 'structure' | 'content' | 'state' | 'visibility';
  /** Changed elements */
  elements: HTMLElement[];
  /** Analysis result */
  analysis: ContentAnalysisResult;
  /** Change severity */
  severity: 'minor' | 'moderate' | 'major' | 'critical';
  /** Timestamp */
  timestamp: Date;
}

/**
 * Analyzer statistics
 */
export interface AnalyzerStatistics {
  /** Total analyses performed */
  totalAnalyses: number;
  /** Meeting content detected */
  meetingContentDetected: number;
  /** Average analysis time */
  averageAnalysisTime: number;
  /** Content types detected */
  contentTypesDetected: Record<ContentType, number>;
  /** Platform detections */
  platformDetections: Record<string, number>;
  /** Error rate */
  errorRate: number;
  /** Last analysis timestamp */
  lastAnalysis: Date;
}

/**
 * Content analyzer for meeting detection and context understanding
 */
export class ContentAnalyzer {
  private static instance: ContentAnalyzer;
  private config: AnalysisConfig;
  private analysisCache: Map<string, ContentAnalysisResult> = new Map();
  private changeListeners: Array<(event: ContentChangeEvent) => void> = [];
  private analysisInterval: NodeJS.Timeout | null = null;
  private statistics: AnalyzerStatistics;
  private lastAnalysisHash: string = '';
  private isAnalyzing: boolean = false;

  constructor(config: Partial<AnalysisConfig> = {}) {
    this.config = {
      enableRealTimeMonitoring: true,
      analysisInterval: 2000,
      meetingThreshold: 0.3,
      changeSensitivity: 'medium',
      platformRules: {
        sharepoint: true,
        teams: true,
        generic: true,
      },
      advancedFeatures: {
        semanticAnalysis: false,
        contextLearning: false,
        patternRecognition: true,
      },
      performance: {
        maxAnalysisTime: 5000,
        cacheResults: true,
        throttleUpdates: true,
      },
      ...config,
    };

    this.statistics = {
      totalAnalyses: 0,
      meetingContentDetected: 0,
      averageAnalysisTime: 0,
      contentTypesDetected: {} as Record<ContentType, number>,
      platformDetections: {},
      errorRate: 0,
      lastAnalysis: new Date(),
    };

    this.initializeMonitoring();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<AnalysisConfig>): ContentAnalyzer {
    if (!ContentAnalyzer.instance) {
      ContentAnalyzer.instance = new ContentAnalyzer(config);
    }
    return ContentAnalyzer.instance;
  }

  /**
   * Analyze current page content
   */
  async analyzeContent(): Promise<ContentAnalysisResult> {
    if (this.isAnalyzing) {
      // Return cached result if analysis is in progress
      const cached = this.getCachedAnalysis();
      if (cached) {
        return cached;
      }
    }

    const startTime = performance.now();
    this.isAnalyzing = true;

    try {
      const analysis = await this.performAnalysis();

      // Cache result
      if (this.config.performance.cacheResults) {
        const cacheKey = this.generateCacheKey();
        this.analysisCache.set(cacheKey, analysis);
      }

      // Update statistics
      this.updateStatistics(performance.now() - startTime, analysis);

      return analysis;
    } catch (error) {
      this.statistics.errorRate = this.calculateErrorRate();
      throw error;
    } finally {
      this.isAnalyzing = false;
    }
  }

  /**
   * Get meeting indicators
   */
  getMeetingIndicators(): MeetingIndicators {
    return {
      hasVideo: this.detectVideoElements().length > 0,
      hasAudio: this.detectAudioElements().length > 0,
      hasControls: this.detectMeetingControls().length > 0,
      hasParticipants: this.detectParticipantElements().length > 0,
      hasChat: this.detectChatElements().length > 0,
      hasRecording: this.detectRecordingIndicators().length > 0,
      hasTranscript: this.detectTranscriptElements().length > 0,
      hasMeetingTitle: this.detectMeetingTitle() !== null,
    };
  }

  /**
   * Check if content indicates a meeting
   */
  async isMeetingContent(): Promise<boolean> {
    const analysis = await this.analyzeContent();
    return analysis.meetingConfidence >= this.config.meetingThreshold;
  }

  /**
   * Register content change listener
   */
  onContentChange(listener: (event: ContentChangeEvent) => void): () => void {
    this.changeListeners.push(listener);

    return () => {
      const index = this.changeListeners.indexOf(listener);
      if (index > -1) {
        this.changeListeners.splice(index, 1);
      }
    };
  }

  /**
   * Get analyzer statistics
   */
  getStatistics(): AnalyzerStatistics {
    return { ...this.statistics };
  }

  /**
   * Initialize content monitoring
   */
  private initializeMonitoring(): void {
    if (!this.config.enableRealTimeMonitoring) {
      return;
    }

    // Setup mutation observer for content changes
    mutationObserver.observe(
      document.documentElement,
      {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'id', 'data-*'],
      },
      mutations => {
        this.handleContentMutations(mutations);
      },
    );

    // Setup periodic analysis
    this.startPeriodicAnalysis();

    // Setup event listeners for dynamic content
    this.setupEventListeners();
  }

  /**
   * Perform content analysis
   */
  private async performAnalysis(): Promise<ContentAnalysisResult> {
    const timeout = this.config.performance.maxAnalysisTime;

    return Promise.race([
      this.doAnalysis(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Analysis timeout')), timeout)),
    ]);
  }

  /**
   * Execute analysis logic
   */
  private async doAnalysis(): Promise<ContentAnalysisResult> {
    // Detect content elements
    const videoElements = this.detectVideoElements();
    const audioElements = this.detectAudioElements();
    const controlElements = this.detectMeetingControls();
    const participantElements = this.detectParticipantElements();
    const chatElements = this.detectChatElements();
    const transcriptElements = this.detectTranscriptElements();

    // Analyze meeting indicators
    const meetingIndicators = this.getMeetingIndicators();

    // Calculate meeting confidence
    const meetingConfidence = this.calculateMeetingConfidence(meetingIndicators);

    // Determine content type
    const contentType = this.determineContentType(meetingIndicators, meetingConfidence);

    // Analyze context
    const context = await this.analyzeContext(meetingIndicators);

    return {
      contentType,
      meetingConfidence,
      meetingIndicators,
      elements: {
        video: videoElements,
        audio: audioElements,
        controls: controlElements,
        participants: participantElements,
        chat: chatElements,
        transcript: transcriptElements,
      },
      context,
      metadata: {
        timestamp: new Date(),
        analysisMethod: 'comprehensive',
        confidence: meetingConfidence,
        version: '1.0.0',
      },
    };
  }

  /**
   * Detect video elements
   */
  private detectVideoElements(): HTMLVideoElement[] {
    const selectors = [
      'video',
      '[data-tid="video"]',
      '.video-element',
      '.meeting-video',
      '[role="video"]',
      // SharePoint Stream video players
      '.od-video-player video',
      '.ms-stream-video video',
      '[data-automation-id*="video"] video',
    ];

    return this.findElementsBySelectors<HTMLVideoElement>(selectors);
  }

  /**
   * Detect audio elements
   */
  private detectAudioElements(): HTMLAudioElement[] {
    const selectors = ['audio', '[data-tid="audio"]', '.audio-element', '.meeting-audio', '[role="audio"]'];

    return this.findElementsBySelectors<HTMLAudioElement>(selectors);
  }

  /**
   * Detect meeting controls
   */
  private detectMeetingControls(): HTMLElement[] {
    const selectors = [
      '[data-tid="call-controls"]',
      '.meeting-controls',
      '.call-controls',
      '[aria-label*="mute"]',
      '[aria-label*="camera"]',
      '[aria-label*="end call"]',
      '[aria-label*="leave meeting"]',
      '.ms-Toggle', // Teams style
    ];

    return this.findElementsBySelectors(selectors);
  }

  /**
   * Detect participant elements
   */
  private detectParticipantElements(): HTMLElement[] {
    const selectors = [
      '[data-tid="participants"]',
      '.participants-list',
      '.attendees',
      '[aria-label*="participant"]',
      '[aria-label*="attendee"]',
      '.roster',
    ];

    return this.findElementsBySelectors(selectors);
  }

  /**
   * Detect chat elements
   */
  private detectChatElements(): HTMLElement[] {
    const selectors = [
      '[data-tid="chat"]',
      '.chat-container',
      '.meeting-chat',
      '[aria-label*="chat"]',
      '.conversation',
      '.messages',
    ];

    return this.findElementsBySelectors(selectors);
  }

  /**
   * Detect recording indicators
   */
  private detectRecordingIndicators(): HTMLElement[] {
    const selectors = [
      '[data-tid="recording"]',
      '.recording-indicator',
      '[aria-label*="recording"]',
      '.rec-indicator',
      '[title*="recording"]',
      // SharePoint recording indicators
      '[data-automation-id*="Recording"]',
      '.ms-DocumentCard[title*="Recording"]',
      '.ms-DocumentCard[title*="Meeting Recording"]',
      '[href*="Meeting+Recording"]',
      '[data-automation-id="pageTitle"][title*="Meeting Recording"]',
    ];

    // Check URL for SharePoint recording patterns
    const hasRecordingUrl =
      window.location.href.includes('Meeting+Recording') ||
      window.location.href.includes('stream.aspx') ||
      window.location.href.includes('Recording.mp4');

    const elements = this.findElementsBySelectors(selectors);

    // If URL indicates recording page, consider it as having recording indicator
    if (hasRecordingUrl && elements.length === 0) {
      // Create a virtual indicator element for URL-based detection
      const virtualIndicator = document.createElement('div');
      virtualIndicator.setAttribute('data-virtual-recording-indicator', 'true');
      elements.push(virtualIndicator);
    }

    return elements;
  }

  /**
   * Detect transcript elements
   */
  private detectTranscriptElements(): HTMLElement[] {
    const selectors = [
      '[data-tid="transcript"]',
      '.transcript',
      '.captions',
      '.subtitles',
      '[aria-label*="transcript"]',
      '[aria-label*="caption"]',
    ];

    return this.findElementsBySelectors(selectors);
  }

  /**
   * Detect meeting title
   */
  private detectMeetingTitle(): HTMLElement | null {
    const selectors = [
      '[data-tid="meeting-title"]',
      '.meeting-title',
      '.call-title',
      'h1[aria-label*="meeting"]',
      '[role="heading"][aria-level="1"]',
      // SharePoint meeting title selectors
      '[data-automation-id="pageTitle"]',
      '.ms-DocumentCard-title',
      'h1',
      'title',
    ];

    for (const selector of selectors) {
      const element = document.querySelector<HTMLElement>(selector);
      if (element && element.textContent) {
        // Check if title contains meeting-related keywords
        const text = element.textContent.toLowerCase();
        if (
          text.includes('meeting') ||
          text.includes('recording') ||
          text.includes('sync') ||
          text.includes('call') ||
          text.includes('conference') ||
          text.includes('taskforce') ||
          text.includes('.mp4')
        ) {
          return element;
        }
      }
    }

    // Check document title as fallback
    if (document.title) {
      const titleText = document.title.toLowerCase();
      if (
        titleText.includes('meeting') ||
        titleText.includes('recording') ||
        titleText.includes('sync') ||
        titleText.includes('call') ||
        titleText.includes('conference') ||
        titleText.includes('.mp4')
      ) {
        const titleElement = document.createElement('div');
        titleElement.textContent = document.title;
        titleElement.setAttribute('data-virtual-title', 'true');
        return titleElement;
      }
    }

    return null;
  }

  /**
   * Find elements by multiple selectors
   */
  private findElementsBySelectors<T extends HTMLElement = HTMLElement>(selectors: string[]): T[] {
    const elements: T[] = [];

    for (const selector of selectors) {
      try {
        const found = document.querySelectorAll<T>(selector);
        elements.push(...Array.from(found));
      } catch (_error) {
        // Ignore invalid selectors
      }
    }

    // Remove duplicates
    return Array.from(new Set(elements));
  }

  /**
   * Calculate meeting confidence score
   */
  private calculateMeetingConfidence(indicators: MeetingIndicators): number {
    let score = 0;
    let maxScore = 0;

    // Video presence (high weight)
    maxScore += 30;
    if (indicators.hasVideo) score += 30;

    // Audio presence (high weight)
    maxScore += 25;
    if (indicators.hasAudio) score += 25;

    // Meeting controls (medium weight)
    maxScore += 20;
    if (indicators.hasControls) score += 20;

    // Participants (medium weight)
    maxScore += 15;
    if (indicators.hasParticipants) score += 15;

    // Recording indicator (low weight)
    maxScore += 5;
    if (indicators.hasRecording) score += 5;

    // Chat (low weight)
    maxScore += 3;
    if (indicators.hasChat) score += 3;

    // Transcript (low weight)
    maxScore += 2;
    if (indicators.hasTranscript) score += 2;

    return maxScore > 0 ? score / maxScore : 0;
  }

  /**
   * Determine content type
   */
  private determineContentType(indicators: MeetingIndicators, confidence: number): ContentType {
    if (confidence >= this.config.meetingThreshold) {
      if (indicators.hasVideo) {
        return 'meeting.video';
      } else if (indicators.hasAudio) {
        return 'meeting.audio';
      } else if (indicators.hasTranscript) {
        return 'meeting.transcript';
      } else if (indicators.hasRecording) {
        return 'meeting.recording';
      }
    }

    // Check for document content
    if (this.hasDocumentContent()) {
      return 'document.text';
    }

    if (this.hasPresentationContent()) {
      return 'document.presentation';
    }

    return 'unknown';
  }

  /**
   * Check for document content
   */
  private hasDocumentContent(): boolean {
    const documentSelectors = ['.document', '.doc-content', '[role="document"]', '.text-content'];

    return documentSelectors.some(selector => document.querySelector(selector) !== null);
  }

  /**
   * Check for presentation content
   */
  private hasPresentationContent(): boolean {
    const presentationSelectors = ['.presentation', '.slides', '.powerpoint', '[role="presentation"]'];

    return presentationSelectors.some(selector => document.querySelector(selector) !== null);
  }

  /**
   * Analyze context information
   */
  private async analyzeContext(indicators: MeetingIndicators): Promise<ContentAnalysisResult['context']> {
    const pageContext = pageRouter.getCurrentPageContext();

    return {
      pageType: pageContext.pageType,
      platform: pageContext.platform,
      meetingState: this.determineMeetingState(indicators),
      participants: this.countParticipants(),
      duration: this.detectMeetingDuration(),
    };
  }

  /**
   * Determine meeting state
   */
  private determineMeetingState(indicators: MeetingIndicators): ContentAnalysisResult['context']['meetingState'] {
    if (indicators.hasRecording) {
      return 'recording';
    }

    if (indicators.hasVideo || indicators.hasAudio) {
      return 'active';
    }

    if (indicators.hasControls || indicators.hasParticipants) {
      return 'scheduled';
    }

    return 'unknown';
  }

  /**
   * Count participants
   */
  private countParticipants(): number {
    const participantElements = this.detectParticipantElements();

    // Try to count individual participant elements
    let count = 0;
    for (const element of participantElements) {
      const participants = element.querySelectorAll('[data-participant], .participant, .attendee');
      count += participants.length;
    }

    return Math.max(count, participantElements.length);
  }

  /**
   * Detect meeting duration
   */
  private detectMeetingDuration(): number | undefined {
    const durationSelectors = ['[data-tid="meeting-duration"]', '.meeting-duration', '.call-duration', '.elapsed-time'];

    for (const selector of durationSelectors) {
      const element = document.querySelector<HTMLElement>(selector);
      if (element) {
        const text = element.textContent || '';
        const duration = this.parseDuration(text);
        if (duration !== undefined) {
          return duration;
        }
      }
    }

    return undefined;
  }

  /**
   * Parse duration from text
   */
  private parseDuration(text: string): number | undefined {
    // Match formats like "1:23:45", "23:45", "1h 23m"
    const timePatterns = [
      /(\d+):(\d+):(\d+)/, // HH:MM:SS
      /(\d+):(\d+)/, // MM:SS
      /(\d+)h\s*(\d+)m/, // Xh Ym
      /(\d+)m\s*(\d+)s/, // Xm Ys
    ];

    for (const pattern of timePatterns) {
      const match = text.match(pattern);
      if (match) {
        const [, ...groups] = match;
        const numbers = groups.map(g => parseInt(g, 10));

        if (numbers.length === 3) {
          // HH:MM:SS
          return numbers[0] * 3600 + numbers[1] * 60 + numbers[2];
        } else if (numbers.length === 2) {
          // Could be MM:SS or Xh Ym or Xm Ys
          if (pattern.source.includes('h')) {
            return numbers[0] * 3600 + numbers[1] * 60;
          } else if (pattern.source.includes('m')) {
            return numbers[0] * 60 + numbers[1];
          } else {
            return numbers[0] * 60 + numbers[1];
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Handle content mutations
   */
  private handleContentMutations(mutations: MutationRecord[]): void {
    if (!this.config.performance.throttleUpdates) {
      this.triggerAnalysis();
      return;
    }

    // Check if mutations are significant
    const significantChange = mutations.some(mutation => {
      if (mutation.type === 'childList') {
        return mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0;
      }
      if (mutation.type === 'attributes') {
        return ['class', 'id', 'data-tid'].includes(mutation.attributeName || '');
      }
      return false;
    });

    if (significantChange) {
      this.triggerAnalysis();
    }
  }

  /**
   * Trigger analysis with debouncing
   */
  private triggerAnalysis(): void {
    // Debounce analysis requests
    clearTimeout(this.analysisInterval);
    this.analysisInterval = setTimeout(async () => {
      try {
        const analysis = await this.analyzeContent();
        this.notifyContentChange(analysis);
      } catch (error) {
        console.error('Analysis error:', error);
      }
    }, this.config.analysisInterval);
  }

  /**
   * Start periodic analysis
   */
  private startPeriodicAnalysis(): void {
    setInterval(async () => {
      try {
        await this.analyzeContent();
      } catch (_error) {
        // Ignore periodic analysis errors
      }
    }, this.config.analysisInterval * 5); // Less frequent than change-triggered analysis
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for navigation changes
    eventManager.registerHandler({
      element: window,
      event: 'popstate',
      handler: () => this.triggerAnalysis(),
      options: { passive: true },
    });

    // Listen for visibility changes
    eventManager.registerHandler({
      element: document,
      event: 'visibilitychange',
      handler: () => {
        if (!document.hidden) {
          this.triggerAnalysis();
        }
      },
      options: { passive: true },
    });
  }

  /**
   * Notify content change listeners
   */
  private notifyContentChange(analysis: ContentAnalysisResult): void {
    const contentHash = this.generateContentHash(analysis);

    if (contentHash === this.lastAnalysisHash) {
      return; // No significant change
    }

    this.lastAnalysisHash = contentHash;

    const event: ContentChangeEvent = {
      type: 'content',
      elements: [...analysis.elements.video, ...analysis.elements.audio, ...analysis.elements.controls],
      analysis,
      severity: this.determineSeverity(analysis),
      timestamp: new Date(),
    };

    this.changeListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Content change listener error:', error);
      }
    });
  }

  /**
   * Determine change severity
   */
  private determineSeverity(analysis: ContentAnalysisResult): ContentChangeEvent['severity'] {
    if (analysis.meetingConfidence >= 0.9) {
      return 'critical';
    } else if (analysis.meetingConfidence >= 0.7) {
      return 'major';
    } else if (analysis.meetingConfidence >= 0.4) {
      return 'moderate';
    } else {
      return 'minor';
    }
  }

  /**
   * Generate content hash for change detection
   */
  private generateContentHash(analysis: ContentAnalysisResult): string {
    const hashData = {
      contentType: analysis.contentType,
      confidence: Math.round(analysis.meetingConfidence * 100),
      indicators: analysis.meetingIndicators,
      elementCounts: {
        video: analysis.elements.video.length,
        audio: analysis.elements.audio.length,
        controls: analysis.elements.controls.length,
        participants: analysis.elements.participants.length,
      },
    };

    return btoa(JSON.stringify(hashData));
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(): string {
    return `analysis-${window.location.href}-${Date.now()}`;
  }

  /**
   * Get cached analysis
   */
  private getCachedAnalysis(): ContentAnalysisResult | null {
    const cacheKey = this.generateCacheKey();
    return this.analysisCache.get(cacheKey) || null;
  }

  /**
   * Update statistics
   */
  private updateStatistics(analysisTime: number, analysis: ContentAnalysisResult): void {
    this.statistics.totalAnalyses++;
    this.statistics.lastAnalysis = new Date();

    // Update average analysis time
    const currentAverage = this.statistics.averageAnalysisTime;
    const totalAnalyses = this.statistics.totalAnalyses;
    this.statistics.averageAnalysisTime = (currentAverage * (totalAnalyses - 1) + analysisTime) / totalAnalyses;

    // Update content type statistics
    this.statistics.contentTypesDetected[analysis.contentType] =
      (this.statistics.contentTypesDetected[analysis.contentType] || 0) + 1;

    // Update meeting detection count
    if (analysis.meetingConfidence >= this.config.meetingThreshold) {
      this.statistics.meetingContentDetected++;
    }

    // Update platform statistics
    const platform = analysis.context.platform;
    this.statistics.platformDetections[platform] = (this.statistics.platformDetections[platform] || 0) + 1;
  }

  /**
   * Calculate error rate
   */
  private calculateErrorRate(): number {
    // This would be implemented based on error tracking
    return 0;
  }

  /**
   * Cleanup analyzer
   */
  cleanup(): void {
    if (this.analysisInterval) {
      clearTimeout(this.analysisInterval);
      this.analysisInterval = null;
    }

    this.analysisCache.clear();
    this.changeListeners.length = 0;
  }
}

// Export singleton instance
export const contentAnalyzer = ContentAnalyzer.getInstance();

// Export utility functions
export const analyzerUtils = {
  /**
   * Get analyzer instance
   */
  getInstance: (config?: Partial<AnalysisConfig>) => ContentAnalyzer.getInstance(config),

  /**
   * Quick meeting detection
   */
  isMeeting: async (): Promise<boolean> => contentAnalyzer.isMeetingContent(),

  /**
   * Get meeting indicators
   */
  getMeetingIndicators: (): MeetingIndicators => contentAnalyzer.getMeetingIndicators(),

  /**
   * Analyze current content
   */
  analyze: (): Promise<ContentAnalysisResult> => contentAnalyzer.analyzeContent(),

  /**
   * Monitor content changes
   */
  onContentChange: (listener: (event: ContentChangeEvent) => void): (() => void) =>
    contentAnalyzer.onContentChange(listener),

  /**
   * Get statistics
   */
  getStats: (): AnalyzerStatistics => contentAnalyzer.getStatistics(),

  /**
   * Cleanup analyzer
   */
  cleanup: (): void => {
    contentAnalyzer.cleanup();
  },
};
