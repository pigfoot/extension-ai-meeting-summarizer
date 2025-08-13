/**
 * Page Classifier
 * Classifies page types and identifies meeting-related content patterns
 */

import { domainDetector } from './domain-detector';
import type { MeetingPlatform, DetectionStatus } from '../types/index';
import type { PageAnalysisResult, ContentIndicator, IndicatorType, IndicatorPriority } from '../types/page';

/**
 * Page classification and meeting content identification
 */
export class PageClassifier {
  private indicatorWeights: Map<IndicatorType, number> = new Map();
  private platformPatterns: Map<MeetingPlatform, PlatformPattern[]> = new Map();

  constructor() {
    this.initializeIndicatorWeights();
    this.initializePlatformPatterns();
  }

  /**
   * Classify page and identify meeting content
   */
  async classifyPage(url: string, document?: Document): Promise<PageAnalysisResult> {
    const startTime = Date.now();
    const indicators: ContentIndicator[] = [];
    const errors: unknown[] = [];

    try {
      // Detect platform from domain
      const domainInfo = domainDetector.detectSharePointDomain(url);
      const platform = domainInfo?.platform || ('unknown' as MeetingPlatform);

      // Analyze page content if document is available
      if (document) {
        const contentIndicators = await this.analyzePageContent(document, platform);
        indicators.push(...contentIndicators);
      }

      // Analyze URL patterns
      const urlIndicators = this.analyzeUrlPatterns(url, platform);
      indicators.push(...urlIndicators);

      // Calculate overall confidence
      const confidence = this.calculateConfidence(indicators);

      // Determine status
      const status = this.determineStatus(indicators, errors);

      return {
        url,
        platform,
        indicators,
        elements: [], // Will be populated by DOM analyzer
        confidence,
        status,
        analysisTime: Date.now() - startTime,
        errors,
        pageMetadata: {
          title: document?.title || '',
          url,
          loadTime: 0,
          readyState: document?.readyState || 'loading',
          viewport: { width: 0, height: 0 },
          userAgent: navigator.userAgent,
        },
      };
    } catch (error) {
      errors.push({
        code: 'CLASSIFICATION_ERROR',
        message: 'Failed to classify page',
        stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        url,
        platform: 'unknown' as MeetingPlatform,
        indicators: [],
        elements: [],
        confidence: 0,
        status: 'failed' as DetectionStatus,
        analysisTime: Date.now() - startTime,
        errors,
        pageMetadata: {
          title: '',
          url,
          loadTime: 0,
          readyState: 'loading',
          viewport: { width: 0, height: 0 },
          userAgent: navigator.userAgent,
        },
      };
    }
  }

  /**
   * Check if page contains meeting content
   */
  containsMeetingContent(indicators: ContentIndicator[]): boolean {
    const criticalIndicators = indicators.filter(i => i.priority === 'critical' && i.strength > 0.7);

    const highIndicators = indicators.filter(i => i.priority === 'high' && i.strength > 0.5);

    return criticalIndicators.length > 0 || highIndicators.length >= 2;
  }

  /**
   * Get page type classification
   */
  getPageType(indicators: ContentIndicator[]): PageType {
    const indicatorTypes = indicators.map(i => i.type);

    // Meeting recording page
    if (
      indicatorTypes.includes('recording_link') ||
      indicatorTypes.includes('audio_player') ||
      indicatorTypes.includes('video_player')
    ) {
      return 'meeting_recording';
    }

    // Meeting detail page
    if (indicatorTypes.includes('meeting_title') && indicatorTypes.includes('meeting_date')) {
      return 'meeting_details';
    }

    // Document library with recordings
    if (
      indicatorTypes.includes('sharepoint_library') &&
      (indicatorTypes.includes('recording_link') || indicators.some(i => i.content?.includes('recording')))
    ) {
      return 'document_library';
    }

    // Teams channel with meeting content
    if (indicatorTypes.includes('teams_channel') && indicatorTypes.includes('meeting_metadata')) {
      return 'teams_channel';
    }

    // General page with some meeting indicators
    if (indicators.length > 0) {
      return 'general_with_meeting_content';
    }

    return 'unknown';
  }

  /**
   * Analyze meeting content quality
   */
  analyzeMeetingQuality(indicators: ContentIndicator[]): MeetingQualityInfo {
    const qualityFactors = {
      hasTitle: indicators.some(i => i.type === 'meeting_title'),
      hasDate: indicators.some(i => i.type === 'meeting_date'),
      hasParticipants: indicators.some(i => i.type === 'participant_list'),
      hasRecording: indicators.some(i => ['recording_link', 'audio_player', 'video_player'].includes(i.type)),
      hasTranscript: indicators.some(i => i.type === 'transcript_content'),
      hasMetadata: indicators.some(i => i.type === 'meeting_metadata'),
    };

    const qualityScore = Object.values(qualityFactors).filter(Boolean).length / Object.keys(qualityFactors).length;

    const missingElements = Object.entries(qualityFactors)
      .filter(([, present]) => !present)
      .map(([factor]) => factor);

    return {
      score: qualityScore,
      level: this.getQualityLevel(qualityScore),
      missingElements,
      recommendations: this.getQualityRecommendations(missingElements),
    };
  }

  // Private methods

  private initializeIndicatorWeights(): void {
    this.indicatorWeights.set('recording_link', 0.9);
    this.indicatorWeights.set('audio_player', 0.9);
    this.indicatorWeights.set('video_player', 0.9);
    this.indicatorWeights.set('meeting_title', 0.8);
    this.indicatorWeights.set('meeting_date', 0.7);
    this.indicatorWeights.set('participant_list', 0.7);
    this.indicatorWeights.set('transcript_content', 0.8);
    this.indicatorWeights.set('meeting_metadata', 0.6);
    this.indicatorWeights.set('download_button', 0.6);
    this.indicatorWeights.set('sharepoint_library', 0.5);
    this.indicatorWeights.set('teams_channel', 0.5);
    this.indicatorWeights.set('meeting_organizer', 0.5);
    this.indicatorWeights.set('duration_info', 0.4);
  }

  private initializePlatformPatterns(): void {
    // SharePoint patterns
    this.platformPatterns.set('sharepoint', [
      {
        name: 'Document Library',
        selectors: ['.ms-List', '.od-Files-list', '[data-automationid="DetailsList"]'],
        keywords: ['documents', 'library', 'files', 'recording'],
        confidence: 0.8,
      },
      {
        name: 'Meeting Workspace',
        selectors: ['.ms-MessageBar', '.meetingWorkspace', '[role="main"]'],
        keywords: ['meeting', 'agenda', 'minutes', 'recording'],
        confidence: 0.9,
      },
      {
        name: 'Stream Video',
        selectors: ['.video-player', '.stream-player', '[data-testid="video-player"]'],
        keywords: ['stream', 'video', 'recording', 'meeting'],
        confidence: 0.95,
      },
    ]);

    // Teams patterns
    this.platformPatterns.set('teams', [
      {
        name: 'Teams Channel',
        selectors: ['[data-tid="channel-view"]', '.ts-conversation', '.thread-body'],
        keywords: ['channel', 'conversation', 'meeting', 'recording'],
        confidence: 0.8,
      },
      {
        name: 'Teams Meeting',
        selectors: ['[data-tid="meeting-details"]', '.meeting-info', '.participants-list'],
        keywords: ['meeting', 'participants', 'recording', 'transcript'],
        confidence: 0.9,
      },
      {
        name: 'Teams Recording',
        selectors: ['[data-tid="recording-link"]', '.recording-item', '.media-player'],
        keywords: ['recording', 'playback', 'transcript', 'download'],
        confidence: 0.95,
      },
    ]);
  }

  private async analyzePageContent(document: Document, platform: MeetingPlatform): Promise<ContentIndicator[]> {
    const indicators: ContentIndicator[] = [];

    try {
      // Get platform-specific patterns
      const patterns = this.platformPatterns.get(platform) || [];

      // Analyze document structure
      for (const pattern of patterns) {
        const patternIndicators = this.analyzePattern(document, pattern, platform);
        indicators.push(...patternIndicators);
      }

      // Analyze text content for meeting keywords
      const textIndicators = this.analyzeTextContent(document);
      indicators.push(...textIndicators);

      // Analyze media elements
      const mediaIndicators = this.analyzeMediaElements(document);
      indicators.push(...mediaIndicators);

      // Analyze metadata elements
      const metadataIndicators = this.analyzeMetadataElements(document);
      indicators.push(...metadataIndicators);
    } catch (error) {
      console.error('Content analysis error:', error);
    }

    return indicators;
  }

  private analyzePattern(document: Document, pattern: PlatformPattern, platform: MeetingPlatform): ContentIndicator[] {
    const indicators: ContentIndicator[] = [];

    for (const selector of pattern.selectors) {
      try {
        const elements = document.querySelectorAll(selector);

        for (const element of elements) {
          const textContent = element.textContent?.toLowerCase() || '';

          // Check for pattern keywords
          const matchedKeywords = pattern.keywords.filter(keyword => textContent.includes(keyword.toLowerCase()));

          if (matchedKeywords.length > 0) {
            indicators.push({
              type: this.mapPatternToIndicatorType(pattern.name),
              strength: pattern.confidence * (matchedKeywords.length / pattern.keywords.length),
              selector,
              content: element.textContent?.substring(0, 100),
              priority: this.getIndicatorPriority(pattern.name),
              context: {
                platform,
                pattern: pattern.name,
                matchedKeywords,
              },
            });
          }
        }
      } catch (error) {
        console.error(`Pattern analysis error for ${pattern.name}:`, error);
      }
    }

    return indicators;
  }

  private analyzeTextContent(document: Document): ContentIndicator[] {
    const indicators: ContentIndicator[] = [];
    const textContent = document.body?.textContent?.toLowerCase() || '';

    // Meeting-related keywords with their indicator types
    const keywordPatterns = [
      { keywords: ['meeting recording', 'recorded meeting'], type: 'recording_link' as IndicatorType },
      { keywords: ['meeting transcript', 'meeting notes'], type: 'transcript_content' as IndicatorType },
      { keywords: ['participants:', 'attendees:'], type: 'participant_list' as IndicatorType },
      { keywords: ['meeting date:', 'scheduled:'], type: 'meeting_date' as IndicatorType },
      { keywords: ['organizer:', 'organized by:'], type: 'meeting_organizer' as IndicatorType },
      { keywords: ['duration:', 'length:'], type: 'duration_info' as IndicatorType },
    ];

    for (const pattern of keywordPatterns) {
      for (const keyword of pattern.keywords) {
        if (textContent.includes(keyword)) {
          indicators.push({
            type: pattern.type,
            strength: 0.6,
            selector: 'body',
            content: keyword,
            priority: 'medium' as IndicatorPriority,
            context: { source: 'text_analysis' },
          });
        }
      }
    }

    return indicators;
  }

  private analyzeMediaElements(document: Document): ContentIndicator[] {
    const indicators: ContentIndicator[] = [];

    // Audio elements
    const audioElements = document.querySelectorAll('audio, [type="audio"]');
    for (const element of audioElements) {
      indicators.push({
        type: 'audio_player',
        strength: 0.9,
        selector: this.getElementSelector(element),
        priority: 'critical' as IndicatorPriority,
        context: { elementType: 'audio' },
      });
    }

    // Video elements
    const videoElements = document.querySelectorAll('video, [type="video"]');
    for (const element of videoElements) {
      indicators.push({
        type: 'video_player',
        strength: 0.9,
        selector: this.getElementSelector(element),
        priority: 'critical' as IndicatorPriority,
        context: { elementType: 'video' },
      });
    }

    // Download links
    const downloadLinks = document.querySelectorAll('a[download], a[href*="download"]');
    for (const element of downloadLinks) {
      const href = element.getAttribute('href') || '';
      if (this.isMediaFile(href)) {
        indicators.push({
          type: 'download_button',
          strength: 0.7,
          selector: this.getElementSelector(element),
          content: element.textContent?.substring(0, 50),
          priority: 'high' as IndicatorPriority,
          context: { href },
        });
      }
    }

    return indicators;
  }

  private analyzeMetadataElements(document: Document): ContentIndicator[] {
    const indicators: ContentIndicator[] = [];

    // Title analysis
    const title = document.title;
    if (title && this.containsMeetingKeywords(title)) {
      indicators.push({
        type: 'meeting_title',
        strength: 0.8,
        selector: 'title',
        content: title,
        priority: 'high' as IndicatorPriority,
        context: { source: 'document_title' },
      });
    }

    // Meta tags
    const metaTags = document.querySelectorAll('meta[name], meta[property]');
    for (const meta of metaTags) {
      const content = meta.getAttribute('content') || '';
      if (this.containsMeetingKeywords(content)) {
        indicators.push({
          type: 'meeting_metadata',
          strength: 0.5,
          selector: this.getElementSelector(meta),
          content: content.substring(0, 100),
          priority: 'low' as IndicatorPriority,
          context: {
            name: meta.getAttribute('name') || meta.getAttribute('property'),
            source: 'meta_tag',
          },
        });
      }
    }

    return indicators;
  }

  private analyzeUrlPatterns(url: string, platform: MeetingPlatform): ContentIndicator[] {
    const indicators: ContentIndicator[] = [];

    // URL path analysis
    const urlLower = url.toLowerCase();
    void urlLower; // Used for URL pattern matching

    // Meeting-related URL patterns
    const urlPatterns = [
      { pattern: /recording/i, type: 'recording_link' as IndicatorType, strength: 0.8 },
      { pattern: /meeting/i, type: 'meeting_metadata' as IndicatorType, strength: 0.6 },
      { pattern: /transcript/i, type: 'transcript_content' as IndicatorType, strength: 0.7 },
      { pattern: /\.mp4|\.mp3|\.wav|\.m4a/i, type: 'recording_link' as IndicatorType, strength: 0.9 },
    ];

    for (const { pattern, type, strength } of urlPatterns) {
      if (pattern.test(url)) {
        indicators.push({
          type,
          strength,
          selector: 'url',
          content: url,
          priority: 'medium' as IndicatorPriority,
          context: { source: 'url_analysis', platform },
        });
      }
    }

    return indicators;
  }

  private calculateConfidence(indicators: ContentIndicator[]): number {
    if (indicators.length === 0) return 0;

    const weightedScore = indicators.reduce((total, indicator) => {
      const weight = this.indicatorWeights.get(indicator.type) || 0.5;
      return total + indicator.strength * weight;
    }, 0);

    const maxPossibleScore = indicators.length * 1.0;
    return Math.min(1, weightedScore / maxPossibleScore);
  }

  private determineStatus(indicators: ContentIndicator[], errors: unknown[]): DetectionStatus {
    if (errors.length > 0) return 'failed';
    if (indicators.length === 0) return 'failed';
    if (this.containsMeetingContent(indicators)) return 'completed';
    return 'partial';
  }

  private mapPatternToIndicatorType(patternName: string): IndicatorType {
    const mapping: Record<string, IndicatorType> = {
      'Document Library': 'sharepoint_library',
      'Meeting Workspace': 'meeting_metadata',
      'Stream Video': 'video_player',
      'Teams Channel': 'teams_channel',
      'Teams Meeting': 'meeting_metadata',
      'Teams Recording': 'recording_link',
    };

    return mapping[patternName] || 'meeting_metadata';
  }

  private getIndicatorPriority(patternName: string): IndicatorPriority {
    if (patternName.includes('Recording') || patternName.includes('Video')) {
      return 'critical';
    }
    if (patternName.includes('Meeting')) {
      return 'high';
    }
    return 'medium';
  }

  private getElementSelector(element: Element): string {
    // Simple selector generation
    let selector = element.tagName.toLowerCase();

    if (element.id) {
      selector += `#${element.id}`;
    }

    if (element.className) {
      const classes = element.className.toString().split(' ').filter(Boolean);
      if (classes.length > 0) {
        selector += `.${classes[0]}`;
      }
    }

    return selector;
  }

  private isMediaFile(url: string): boolean {
    const mediaExtensions = ['.mp4', '.mp3', '.wav', '.m4a', '.webm', '.ogg'];
    return mediaExtensions.some(ext => url.toLowerCase().includes(ext));
  }

  private containsMeetingKeywords(text: string): boolean {
    const keywords = [
      'meeting',
      'recording',
      'transcript',
      'participants',
      'organizer',
      'agenda',
      'minutes',
      'conference',
    ];
    const textLower = text.toLowerCase();
    return keywords.some(keyword => textLower.includes(keyword));
  }

  private getQualityLevel(score: number): QualityLevel {
    if (score >= 0.8) return 'excellent';
    if (score >= 0.6) return 'good';
    if (score >= 0.4) return 'fair';
    return 'poor';
  }

  private getQualityRecommendations(missingElements: string[]): string[] {
    const recommendations: string[] = [];

    if (missingElements.includes('hasTitle')) {
      recommendations.push('Add meeting title for better identification');
    }
    if (missingElements.includes('hasRecording')) {
      recommendations.push('Include recording link or media player');
    }
    if (missingElements.includes('hasParticipants')) {
      recommendations.push('Add participant list for context');
    }

    return recommendations;
  }
}

// Supporting interfaces and types

interface PlatformPattern {
  name: string;
  selectors: string[];
  keywords: string[];
  confidence: number;
}

export type PageType =
  | 'meeting_recording'
  | 'meeting_details'
  | 'document_library'
  | 'teams_channel'
  | 'general_with_meeting_content'
  | 'unknown';

export interface MeetingQualityInfo {
  score: number;
  level: QualityLevel;
  missingElements: string[];
  recommendations: string[];
}

export type QualityLevel = 'excellent' | 'good' | 'fair' | 'poor';

// Create singleton instance
export const pageClassifier = new PageClassifier();
