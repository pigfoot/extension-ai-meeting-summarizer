/**
 * Page Analyzer
 * Coordinates comprehensive page analysis and content detection
 */

import { sharePointAnalyzer } from '../analyzers/sharepoint-analyzer';
import { teamsAnalyzer } from '../analyzers/teams-analyzer';
import { domainAdapter } from '../compatibility/domain-adapter';
import { tenantConfig } from '../compatibility/tenant-config';
import { contentIndicators } from '../detection/content-indicators';
import { domainDetector } from '../detection/domain-detector';
import { pageClassifier } from '../detection/page-classifier';
import { teamsDetector } from '../detection/teams-detector';
import { agendaExtractor } from '../extraction/agenda-extractor';
import { metadataExtractor } from '../extraction/metadata-extractor';
import { metadataFormatter } from '../extraction/metadata-formatter';
import { participantParser } from '../extraction/participant-parser';
import type { MeetingDetection, PageAnalysisResult } from '../types/index';

/**
 * Comprehensive page analysis coordination and orchestration
 */
export class PageAnalyzer {
  private analysisCache: Map<string, CachedAnalysis> = new Map();
  private observers: Set<AnalysisObserver> = new Set();
  private isAnalyzing: boolean = false;

  constructor() {
    this.setupDynamicObservation();
  }

  /**
   * Perform comprehensive page analysis
   */
  async analyzePage(document: Document, url: string, options: AnalysisOptions = {}): Promise<PageAnalysisResult> {
    const cacheKey = this.generateCacheKey(url, _document);

    // Check cache first
    if (!options.forceRefresh) {
      const cached = this.getCachedAnalysis(cacheKey);
      if (cached) {
        return cached.result;
      }
    }

    this.isAnalyzing = true;
    this.notifyObservers('analysis_started', { url });

    try {
      const result = await this.performFullAnalysis(document, url, options);

      // Cache the result
      this.cacheAnalysis(cacheKey, result);

      this.notifyObservers('analysis_completed', { url, result });
      return result;
    } catch (error) {
      this.notifyObservers('analysis_failed', { url, error });
      throw error;
    } finally {
      this.isAnalyzing = false;
    }
  }

  /**
   * Quick meeting detection check
   */
  async quickDetection(document: Document, url: string): Promise<MeetingDetection> {
    const detectionSteps = [
      // Step 1: Domain detection
      () => domainDetector.detectSharePointDomain(url),

      // Step 2: Page classification
      () => pageClassifier.classifyPage(url, _document),

      // Step 3: Content indicators
      () => contentIndicators.detectContentIndicators(document, url, 'sharepoint'),

      // Step 4: Teams detection (if applicable)
      () => this.detectTeamsContent(document, url),
    ];

    const results = await Promise.all(detectionSteps.map(step => this.safeExecute(step)));

    return this.compileMeetingDetection(results, url);
  }

  /**
   * Extract meeting metadata with full context
   */
  async extractMeetingData(
    document: Document,
    url: string,
    _options: ExtractionOptions = {},
  ): Promise<ComprehensiveMeetingData> {
    void _options;
    // Detect tenant configuration
    const tenantConfiguration = tenantConfig.detectTenantConfig(url, document);
    const adapter = domainAdapter.createAdapter(new URL(url).hostname, tenantConfiguration);

    // Extract core metadata
    const metadata = metadataExtractor.extractMeetingMetadata(document, url);

    // Extract participant information
    const participants = participantParser.extractParticipants(document);
    const participantCount = participantParser.extractParticipantCount(document);

    // Extract agenda information
    const agenda = agendaExtractor.extractAgenda(document);

    // Format all extracted data
    const formatted = metadataFormatter.formatMeetingMetadata(metadata, agenda, participants, participantCount);

    return {
      metadata: formatted,
      tenantConfig: tenantConfiguration,
      adapter: {
        domain: adapter.domain,
        adaptedSelectors: adapter.adaptSelectors([]),
        permissions: adapter.adaptPermissions({}),
      },
      extractionContext: {
        url,
        timestamp: new Date(),
        quality: formatted.quality,
        completeness: this.assessDataCompleteness(formatted),
      },
    };
  }

  /**
   * Monitor page changes for dynamic content updates
   */
  startDynamicMonitoring(
    document: Document,
    url: string,
    callback: (changes: ContentChange[]) => void,
  ): MonitoringSession {
    const session: MonitoringSession = {
      id: this.generateSessionId(),
      url,
      startTime: Date.now(),
      callback,
      observer: null,
      active: true,
    };

    // Set up mutation observer
    session.observer = new MutationObserver(mutations => {
      if (!session.active) return;

      const changes = this.processMutations(mutations, _document);
      if (changes.length > 0) {
        callback(changes);
      }
    });

    session.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-automation-id', 'class', 'data-tid'],
    });

    return session;
  }

  /**
   * Stop dynamic monitoring
   */
  stopDynamicMonitoring(session: MonitoringSession): void {
    if (session.observer) {
      session.observer.disconnect();
    }
    session.active = false;
  }

  /**
   * Add analysis observer
   */
  addObserver(observer: AnalysisObserver): void {
    this.observers.add(observer);
  }

  /**
   * Remove analysis observer
   */
  removeObserver(observer: AnalysisObserver): void {
    this.observers.delete(observer);
  }

  /**
   * Clear analysis cache
   */
  clearCache(): void {
    this.analysisCache.clear();
  }

  /**
   * Get current analysis status
   */
  getAnalysisStatus(): AnalysisStatus {
    return {
      isAnalyzing: this.isAnalyzing,
      cacheSize: this.analysisCache.size,
      observerCount: this.observers.size,
    };
  }

  // Private methods

  private async performFullAnalysis(
    document: Document,
    url: string,
    options: AnalysisOptions,
  ): Promise<PageAnalysisResult> {
    const startTime = performance.now();

    // Phase 1: Basic Detection
    const detection = await this.quickDetection(document, url);

    if (!detection.isMeetingPage) {
      return {
        url,
        isMeetingPage: false,
        confidence: detection.confidence,
        platform: 'unknown' as const,
        indicators: [],
        elements: [],
        status: 'completed' as const,
        analysisTime: Date.now(),
        errors: [],
        pageMetadata: {
          title: document.title || '',
          url: url,
          loadTime: 0,
          readyState: document.readyState,
          viewport: {
            width: window.innerWidth || 0,
            height: window.innerHeight || 0,
          },
          userAgent: navigator.userAgent || '',
        },
        processingTime: performance.now() - startTime,
      };
    }

    // Phase 2: Platform-Specific Analysis
    const _platformAnalysis = await this.performPlatformAnalysis(document, url, detection.platform);
    void _platformAnalysis;

    // Phase 3: Content Extraction
    const contentData = await this.extractMeetingData(document, url, {
      includeTenantConfig: options.includeTenantConfig,
      includeParticipants: options.includeParticipants,
      includeAgenda: options.includeAgenda,
    });

    // Phase 4: Cross-Domain Analysis
    const crossDomainAnalysis = domainAdapter.analyzeDomain(url, _document);

    return {
      url,
      isMeetingPage: true,
      confidence: detection.confidence,
      platform: detection.platform,
      indicators: detection.contentIndicators || [],
      elements: [],
      status: 'completed' as const,
      analysisTime: Date.now(),
      errors: [],
      pageMetadata: {
        title: document.title || '',
        url: url,
        loadTime: 0,
        readyState: document.readyState,
        viewport: {
          width: window.innerWidth || 0,
          height: window.innerHeight || 0,
        },
        userAgent: navigator.userAgent || '',
      },
      meetingData: contentData,
      domainAnalysis: crossDomainAnalysis,
      processingTime: performance.now() - startTime,
    };
  }

  private async performPlatformAnalysis(document: Document, url: string, platform: string): Promise<unknown> {
    switch (platform) {
      case 'sharepoint':
        return sharePointAnalyzer.analyzePage(document, url);

      case 'teams':
        return teamsAnalyzer.analyzePage(document, url);

      default:
        return {
          platform: 'unknown',
          features: [],
          confidence: 0,
        };
    }
  }

  private detectTeamsContent(document: Document, url: string): unknown {
    if (url.includes('teams.microsoft.com')) {
      return teamsDetector.detectTeamsDomain(url);
    }
    return null;
  }

  private compileMeetingDetection(results: unknown[], url: string): MeetingDetection {
    const [domainResult, pageResult, contentResult, teamsResult] = results;

    // Calculate overall confidence
    const confidenceScores = [
      domainResult?.confidence || 0,
      pageResult?.confidence || 0,
      contentResult?.confidence || 0,
      teamsResult?.confidence || 0,
    ].filter(score => score > 0);

    const overallConfidence =
      confidenceScores.length > 0
        ? confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length
        : 0;

    // Determine if this is a meeting page
    const isMeetingPage = overallConfidence >= 0.5;

    // Determine platform
    const platform = this.determinePlatform(domainResult, teamsResult, url);

    return {
      id: `detection_${Date.now()}`,
      platform,
      confidence: overallConfidence,
      isMeetingPage,
      metadata: {
        title: '',
        participants: [],
        topics: [],
      },
      audioInfo: null,
      detectedAt: new Date(),
      status: 'completed' as const,
      domainDetection: domainResult,
      pageClassification: pageResult,
      contentIndicators: contentResult,
      teamsDetection: teamsResult,
    };
  }

  private determinePlatform(
    domainResult: unknown,
    teamsResult: unknown,
    url: string,
  ): 'sharepoint' | 'teams' | 'unknown' {
    if (teamsResult?.isTeamsMeeting) return 'teams';
    if (domainResult?.isSharePoint) return 'sharepoint';
    if (url.includes('stream.microsoft.com')) return 'unknown';
    return 'unknown';
  }

  private setupDynamicObservation(): void {
    // Set up global observers for page changes
    if (typeof window !== 'undefined') {
      // Listen for navigation changes
      window.addEventListener('popstate', () => {
        this.clearCache();
      });

      // Listen for hash changes
      window.addEventListener('hashchange', () => {
        this.clearCache();
      });
    }
  }

  private processMutations(mutations: MutationRecord[], _document: Document): ContentChange[] {
    void _document;
    const changes: ContentChange[] = [];

    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const change = this.analyzeAddedElement(node as Element);
            if (change) changes.push(change);
          }
        }
      }

      if (mutation.type === 'attributes') {
        const change = this.analyzeAttributeChange(mutation);
        if (change) changes.push(change);
      }
    }

    return changes;
  }

  private analyzeAddedElement(element: Element): ContentChange | null {
    // Check if the added element indicates meeting content
    const meetingIndicators = [
      '.participant',
      '.attendee',
      '.meeting-',
      '[data-tid*="meeting"]',
      '.agenda',
      '.recording',
    ];

    for (const indicator of meetingIndicators) {
      if (element.matches(indicator) || element.querySelector(indicator)) {
        return {
          type: 'element_added',
          selector: this.getElementSelector(element),
          content: element.textContent?.trim() || '',
          timestamp: Date.now(),
        };
      }
    }

    return null;
  }

  private analyzeAttributeChange(mutation: MutationRecord): ContentChange | null {
    const target = mutation.target as Element;
    const attributeName = mutation.attributeName;

    if (attributeName && this.isMeetingRelevantAttribute(attributeName)) {
      return {
        type: 'attribute_changed',
        selector: this.getElementSelector(target),
        attribute: attributeName,
        newValue: target.getAttribute(attributeName),
        timestamp: Date.now(),
      };
    }

    return null;
  }

  private isMeetingRelevantAttribute(attributeName: string): boolean {
    const relevantAttributes = ['data-automation-id', 'data-tid', 'data-participant', 'data-meeting', 'class'];

    return relevantAttributes.includes(attributeName);
  }

  private getElementSelector(element: Element): string {
    // Generate a simple selector for the element
    const tagName = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : '';
    const className = element.className ? `.${element.className.split(' ')[0]}` : '';

    return `${tagName}${id}${className}`;
  }

  private assessDataCompleteness(data: unknown): number {
    let score = 0;
    let maxScore = 0;

    const checkField = (field: unknown, weight: number) => {
      maxScore += weight;
      if (field) score += weight;
    };

    // Assess basic metadata completeness
    checkField(data.basic?.title, 20);
    checkField(data.basic?.organizer, 15);
    checkField(data.timestamps?.scheduled, 10);
    checkField(data.participants?.list?.length > 0, 20);
    checkField(data.agenda?.available, 15);
    checkField(data.technical?.mediaInfo?.has_recording, 10);
    checkField(data.permissions?.canView, 10);

    return maxScore > 0 ? (score / maxScore) * 100 : 0;
  }

  private generateCacheKey(url: string, document: Document): string {
    const urlHash = this.simpleHash(url);
    const contentHash = this.simpleHash(document.title + document.body.textContent?.substring(0, 1000));
    return `${urlHash}-${contentHash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private getCachedAnalysis(cacheKey: string): CachedAnalysis | null {
    const cached = this.analysisCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached;
    }
    return null;
  }

  private cacheAnalysis(cacheKey: string, result: PageAnalysisResult): void {
    this.analysisCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
      ttl: 5 * 60 * 1000, // 5 minutes
    });

    // Clean up old cache entries
    if (this.analysisCache.size > 50) {
      this.cleanupCache();
    }
  }

  private cleanupCache(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, cached] of this.analysisCache) {
      if (now - cached.timestamp > cached.ttl) {
        toDelete.push(key);
      }
    }

    toDelete.forEach(key => this.analysisCache.delete(key));
  }

  private generateSessionId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private notifyObservers(event: string, data: unknown): void {
    this.observers.forEach(observer => {
      try {
        observer.onAnalysisEvent?.(event, data);
      } catch (error) {
        console.error('Observer notification error:', error);
      }
    });
  }

  private async safeExecute<T>(fn: () => T): Promise<T | null> {
    try {
      return await fn();
    } catch (error) {
      console.error('Safe execution error:', error);
      return null;
    }
  }
}

// Supporting interfaces and types

export interface AnalysisOptions {
  forceRefresh?: boolean | undefined;
  includeTenantConfig?: boolean | undefined;
  includeParticipants?: boolean | undefined;
  includeAgenda?: boolean | undefined;
  timeout?: number | undefined;
}

export interface ExtractionOptions {
  includeTenantConfig?: boolean | undefined;
  includeParticipants?: boolean | undefined;
  includeAgenda?: boolean | undefined;
  includeMetadata?: boolean | undefined;
}

export interface ComprehensiveMeetingData {
  metadata: unknown; // FormattedMeetingMetadata
  tenantConfig: unknown; // TenantConfiguration
  adapter: {
    domain: string;
    adaptedSelectors: string[];
    permissions: unknown;
  };
  extractionContext: {
    url: string;
    timestamp: Date;
    quality: unknown;
    completeness: number;
  };
}

export interface MonitoringSession {
  id: string;
  url: string;
  startTime: number;
  callback: (changes: ContentChange[]) => void;
  observer: MutationObserver | null;
  active: boolean;
}

export interface ContentChange {
  type: 'element_added' | 'element_removed' | 'attribute_changed' | 'text_changed';
  selector: string;
  content?: string;
  attribute?: string;
  newValue?: string | null;
  timestamp: number;
}

export interface AnalysisObserver {
  onAnalysisEvent?: (event: string, data: unknown) => void;
}

export interface AnalysisStatus {
  isAnalyzing: boolean;
  cacheSize: number;
  observerCount: number;
}

export interface CachedAnalysis {
  result: PageAnalysisResult;
  timestamp: number;
  ttl: number;
}

// Extend existing PageAnalysisResult interface
declare module '../types/page' {
  interface PageAnalysisResult {
    meetingData?: ComprehensiveMeetingData;
    domainAnalysis?: unknown;
    processingTime?: number;
  }
}

// Create singleton instance
export const pageAnalyzer = new PageAnalyzer();
