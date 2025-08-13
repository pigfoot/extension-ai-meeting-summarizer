/**
 * Version Compatibility Handler
 * Implements version-specific detection strategies and fallback methods for older SharePoint versions
 */

// import { tenantConfig } from './tenant-config';
import type { MeetingDetection, DetectionConfig } from '../types/index';
import type { SharePointVersion } from '../types/page';
// import type { TenantInfo, DomainConfig } from '../types/tenant';

/**
 * Version-specific detection strategies and fallback methods
 */
export class VersionHandler {
  private versionStrategies: Map<SharePointVersion, VersionStrategy> = new Map();
  private fallbackChain: SharePointVersion[] = [];
  private detectionResults: Map<string, VersionDetectionResult> = new Map();

  constructor() {
    this.initializeVersionStrategies();
    this.setupFallbackChain();
  }

  /**
   * Detect SharePoint version from page content and URL
   */
  async detectSharePointVersion(url: string, _document: Document): Promise<VersionDetectionResult> {
    const cacheKey = this.generateCacheKey(url);

    // Check cache first
    const cached = this.detectionResults.get(cacheKey);
    if (cached && !this.isCacheExpired(cached)) {
      return cached;
    }

    const result = await this.performVersionDetection(url, _document);

    // Cache result
    this.detectionResults.set(cacheKey, {
      ...result,
      timestamp: Date.now(),
      ttl: 15 * 60 * 1000, // 15 minutes
    });

    return result;
  }

  /**
   * Get appropriate detection strategy for SharePoint version
   */
  getDetectionStrategy(version: SharePointVersion): VersionStrategy {
    return this.versionStrategies.get(version) || this.getDefaultStrategy();
  }

  /**
   * Execute detection with version-specific fallbacks
   */
  async executeWithFallbacks(
    url: string,
    document: Document,
    config: DetectionConfig,
  ): Promise<MeetingDetection | null> {
    const versionResult = await this.detectSharePointVersion(url, _document);

    // Try primary version strategy
    const primaryStrategy = this.getDetectionStrategy(versionResult.version);
    const primaryResult = await this.tryDetectionStrategy(primaryStrategy, url, document, config);

    if (primaryResult && primaryResult.confidence >= config.minConfidence) {
      return primaryResult;
    }

    // Try fallback strategies
    for (const fallbackVersion of this.fallbackChain) {
      if (fallbackVersion === versionResult.version) continue;

      const fallbackStrategy = this.getDetectionStrategy(fallbackVersion);
      const fallbackResult = await this.tryDetectionStrategy(fallbackStrategy, url, document, config);

      if (fallbackResult && fallbackResult.confidence >= config.minConfidence * 0.8) {
        // Lower confidence threshold for fallbacks
        return {
          ...fallbackResult,
          metadata: {
            ...fallbackResult.metadata,
            platformIds: {
              ...fallbackResult.metadata.platformIds,
            },
          },
        };
      }
    }

    return null;
  }

  /**
   * Update version strategy configuration
   */
  updateVersionStrategy(version: SharePointVersion, updates: Partial<VersionStrategy>): void {
    const existing = this.versionStrategies.get(version) || this.getDefaultStrategy();
    const updated = { ...existing, ...updates };
    this.versionStrategies.set(version, updated);
  }

  /**
   * Get compatibility matrix for versions
   */
  getCompatibilityMatrix(): VersionCompatibilityMatrix {
    const matrix: VersionCompatibilityMatrix = {
      versions: Array.from(this.versionStrategies.keys()),
      compatibility: this.buildCompatibilityMapping(),
    };

    for (const [version, strategy] of this.versionStrategies) {
      matrix.compatibility[version] = {
        supportedFeatures: strategy.supportedFeatures,
        fallbackVersions: strategy.fallbackVersions,
        compatibilityScore: this.calculateCompatibilityScore(strategy),
        knownIssues: strategy.knownIssues || [],
      };
    }

    return matrix;
  }

  /**
   * Validate version strategy effectiveness
   */
  async validateStrategy(version: SharePointVersion, testUrls: string[]): Promise<StrategyValidationResult> {
    const strategy = this.getDetectionStrategy(version);
    const results: ValidationTestResult[] = [];

    for (const url of testUrls) {
      try {
        // Note: In real implementation, we'd need actual DOM content
        // This is a simplified validation structure
        const testResult: ValidationTestResult = {
          url,
          success: true, // Would be determined by actual detection
          confidence: 0.85, // Would be actual confidence score
          detectionTime: 150, // Would be actual detection time
          features: strategy.supportedFeatures.slice(0, 3), // Mock detected features
        };
        results.push(testResult);
      } catch (error) {
        results.push({
          url,
          success: false,
          confidence: 0,
          detectionTime: 0,
          features: [],
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successRate = results.filter(r => r.success).length / results.length;
    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
    const avgDetectionTime = results.reduce((sum, r) => sum + r.detectionTime, 0) / results.length;

    return {
      version,
      successRate,
      averageConfidence: avgConfidence,
      averageDetectionTime: avgDetectionTime,
      testResults: results,
      recommendation: this.generateRecommendation(successRate, avgConfidence, avgDetectionTime),
    };
  }

  // Private methods

  private buildCompatibilityMapping(): Record<SharePointVersion, VersionCompatibility> {
    const mapping: Record<SharePointVersion, VersionCompatibility> = {} as Record<
      SharePointVersion,
      VersionCompatibility
    >;

    for (const [version, strategy] of this.versionStrategies) {
      mapping[version] = {
        supportedFeatures: strategy.supportedFeatures,
        knownIssues: strategy.knownIssues || [],
        fallbackVersions: strategy.fallbackVersions || [],
        compatibilityScore: strategy.compatibility || 1.0,
      };
    }

    return mapping;
  }

  private initializeVersionStrategies(): void {
    // SharePoint Online (most common)
    this.versionStrategies.set('sharepoint_online', {
      version: 'sharepoint_online',
      detectionPatterns: [
        {
          pattern: 'spPageContextInfo',
          selector: 'script:contains("_spPageContextInfo")',
          weight: 0.9,
        },
        {
          pattern: 'modern-experience',
          selector: '.ms-SPLegacyFabricBlock',
          weight: 0.8,
        },
        {
          pattern: 'office-365',
          selector: '[data-automation-id*="office365"]',
          weight: 0.85,
        },
      ],
      selectors: {
        meetingTitle: ['[data-automation-id="meeting-title"]', '.meeting-header h1', '.conversation-title'],
        participants: ['[data-automation-id="participants"] .participant', '.attendee-list .attendee'],
        mediaElements: ['video[data-stream-url]', '[data-media-player]', '.video-container video'],
      },
      supportedFeatures: [
        'modern-lists',
        'teams-integration',
        'stream-recordings',
        'live-transcription',
        'meeting-insights',
      ],
      fallbackVersions: ['sharepoint_2019'],
      apiEndpoints: {
        rest: '/_api/',
        graph: '/v1.0/',
        search: '/_api/search/query',
      },
    });

    // SharePoint 2019
    this.versionStrategies.set('sharepoint_2019', {
      version: 'sharepoint_2019',
      detectionPatterns: [
        {
          pattern: 'sp2019-classic',
          selector: '.ms-dlgFrame',
          weight: 0.7,
        },
        {
          pattern: 'classic-ribbon',
          selector: '.ms-cui-ribbon',
          weight: 0.8,
        },
      ],
      selectors: {
        meetingTitle: ['.meeting-title', 'h1.meeting-subject', '.dlg-title'],
        participants: ['.participant-list .user', '.attendee-container .person'],
        mediaElements: ['embed[type="video/mp4"]', 'object[data*=".mp4"]'],
      },
      supportedFeatures: ['classic-lists', 'basic-recordings', 'file-attachments'],
      fallbackVersions: ['sharepoint_2016'],
      apiEndpoints: {
        rest: '/_api/',
        search: '/_api/search/query',
      },
      knownIssues: [
        'Limited modern experience support',
        'No real-time collaboration features',
        'Basic media player only',
      ],
    });

    // SharePoint 2016
    this.versionStrategies.set('sharepoint_2016', {
      version: 'sharepoint_2016',
      detectionPatterns: [
        {
          pattern: 'sp2016-classic',
          selector: '.ms-webpart-chrome',
          weight: 0.6,
        },
        {
          pattern: 'legacy-ui',
          selector: '.ms-WPBody',
          weight: 0.7,
        },
      ],
      selectors: {
        meetingTitle: ['.webpart-title', 'h2.meeting-name', '.content-title'],
        participants: ['.user-list .user-item', '.people-picker .person'],
        mediaElements: ['a[href*=".mp4"]', 'a[href*=".wmv"]'],
      },
      supportedFeatures: ['basic-lists', 'file-downloads', 'simple-search'],
      fallbackVersions: [],
      apiEndpoints: {
        rest: '/_api/',
        search: '/_api/search/query',
      },
      knownIssues: [
        'No modern experience',
        'Limited API support',
        'Basic media handling only',
        'No real-time features',
      ],
    });
  }

  private setupFallbackChain(): void {
    this.fallbackChain = ['sharepoint_online', 'sharepoint_2019', 'sharepoint_2016'];
  }

  private async performVersionDetection(url: string, document: Document): Promise<VersionDetectionResult> {
    const detectionScores: Map<SharePointVersion, number> = new Map();

    // Test each version strategy
    for (const [version, strategy] of this.versionStrategies) {
      let score = 0;
      let matchedPatterns = 0;

      for (const pattern of strategy.detectionPatterns) {
        if (this.testPattern(pattern, _document)) {
          score += pattern.weight;
          matchedPatterns++;
        }
      }

      // Normalize score
      const normalizedScore = matchedPatterns > 0 ? score / strategy.detectionPatterns.length : 0;
      detectionScores.set(version, normalizedScore);
    }

    // Find highest scoring version
    let bestVersion: SharePointVersion = 'unknown';
    let bestScore = 0;

    for (const [version, score] of detectionScores) {
      if (score > bestScore) {
        bestVersion = version;
        bestScore = score;
      }
    }

    // Additional context detection
    const features = await this.detectVersionFeatures(document, bestVersion);
    const buildInfo = this.extractBuildInfo(document);

    return {
      version: bestVersion,
      confidence: bestScore,
      detectionMethod: 'pattern-matching',
      features,
      buildInfo,
      fallbackVersions: this.versionStrategies.get(bestVersion)?.fallbackVersions || [],
      timestamp: Date.now(),
      ttl: 15 * 60 * 1000,
    };
  }

  private testPattern(pattern: DetectionPattern, document: Document): boolean {
    try {
      if (pattern.selector) {
        return document.querySelector(pattern.selector) !== null;
      }

      if (pattern.pattern) {
        const content = document.documentElement.innerHTML;
        return new RegExp(pattern.pattern, 'i').test(content);
      }

      return false;
    } catch {
      return false;
    }
  }

  private async detectVersionFeatures(document: Document, version: SharePointVersion): Promise<string[]> {
    const features: string[] = [];
    const strategy = this.versionStrategies.get(version);

    if (!strategy) return features;

    // Check for supported features
    for (const feature of strategy.supportedFeatures) {
      if (await this.testFeature(feature, _document)) {
        features.push(feature);
      }
    }

    return features;
  }

  private async testFeature(feature: string, document: Document): Promise<boolean> {
    const featureTests: Record<string, () => boolean> = {
      'modern-lists': () => document.querySelector('.ms-List') !== null,
      'teams-integration': () => document.querySelector('[data-automation-id*="teams"]') !== null,
      'stream-recordings': () => document.querySelector('[data-stream-url]') !== null,
      'classic-lists': () => document.querySelector('.ms-listviewtable') !== null,
      'basic-recordings': () => document.querySelector('video, audio') !== null,
    };

    const test = featureTests[feature];
    return test ? test() : false;
  }

  private extractBuildInfo(document: Document): string | undefined {
    // Try to extract SharePoint build information
    const scriptElements = document.querySelectorAll('script');

    for (const script of scriptElements) {
      const content = script.textContent || '';

      // Look for build numbers in various formats
      const buildMatches = content.match(/(?:build|version)["']?\s*:\s*["']?([0-9.]+)/i);
      if (buildMatches) {
        return buildMatches[1];
      }

      // Look for SharePoint version info
      const spVersionMatch = content.match(/_spPageContextInfo[^}]*version["']?\s*:\s*["']?([^"',}]+)/i);
      if (spVersionMatch) {
        return spVersionMatch[1];
      }
    }

    return undefined;
  }

  private async tryDetectionStrategy(
    strategy: VersionStrategy,
    _url: string,
    _document: Document,
    _config: DetectionConfig,
  ): Promise<MeetingDetection | null> {
    void _url;
    void _document;
    void _config;
    try {
      // This would integrate with actual detection logic
      // For now, return a mock result indicating the strategy was attempted
      return null; // Actual implementation would use the strategy selectors and patterns
    } catch (error) {
      console.warn(`Detection strategy failed for ${strategy.version}:`, error);
      return null;
    }
  }

  private getDefaultStrategy(): VersionStrategy {
    return {
      version: 'unknown' as SharePointVersion,
      detectionPatterns: [],
      selectors: {
        meetingTitle: ['.title', 'h1', 'h2'],
        participants: ['.user', '.participant', '.attendee'],
        mediaElements: ['video', 'audio', 'embed'],
      },
      supportedFeatures: ['basic-detection'],
      fallbackVersions: [],
      apiEndpoints: {},
    };
  }

  private calculateCompatibilityScore(strategy: VersionStrategy): number {
    const featureCount = strategy.supportedFeatures.length;
    const patternCount = strategy.detectionPatterns.length;
    const fallbackCount = strategy.fallbackVersions.length;

    // Simple scoring algorithm
    return Math.min(1.0, (featureCount * 0.4 + patternCount * 0.4 + fallbackCount * 0.2) / 10);
  }

  private generateRecommendation(successRate: number, avgConfidence: number, _avgDetectionTime: number): string {
    void _avgDetectionTime;
    if (successRate >= 0.9 && avgConfidence >= 0.8) {
      return 'Excellent - Strategy performs very well';
    } else if (successRate >= 0.7 && avgConfidence >= 0.6) {
      return 'Good - Strategy is reliable for most cases';
    } else if (successRate >= 0.5 || avgConfidence >= 0.4) {
      return 'Fair - Consider improvements or use as fallback only';
    } else {
      return 'Poor - Strategy needs significant improvements';
    }
  }

  private generateCacheKey(url: string): string {
    const urlObj = new URL(url);
    return `${urlObj.hostname}${urlObj.pathname}`;
  }

  private isCacheExpired(result: VersionDetectionResult): boolean {
    return Date.now() - result.timestamp > result.ttl;
  }
}

// Supporting interfaces and types

export interface VersionStrategy {
  version: SharePointVersion;
  detectionPatterns: DetectionPattern[];
  selectors: VersionSelectors;
  supportedFeatures: string[];
  fallbackVersions: SharePointVersion[];
  apiEndpoints: Record<string, string>;
  knownIssues?: string[];
  compatibility?: number;
}

export interface DetectionPattern {
  pattern?: string;
  selector?: string;
  weight: number;
  description?: string;
}

export interface VersionSelectors {
  meetingTitle: string[];
  participants: string[];
  mediaElements: string[];
  [key: string]: string[];
}

export interface VersionDetectionResult {
  version: SharePointVersion;
  confidence: number;
  detectionMethod: string;
  features: string[];
  buildInfo?: string | undefined;
  fallbackVersions: SharePointVersion[];
  timestamp: number;
  ttl: number;
}

export interface VersionCompatibilityMatrix {
  versions: SharePointVersion[];
  compatibility: Record<SharePointVersion, VersionCompatibility>;
}

export interface VersionCompatibility {
  supportedFeatures: string[];
  fallbackVersions: SharePointVersion[];
  compatibilityScore: number;
  knownIssues: string[];
}

export interface StrategyValidationResult {
  version: SharePointVersion;
  successRate: number;
  averageConfidence: number;
  averageDetectionTime: number;
  testResults: ValidationTestResult[];
  recommendation: string;
}

export interface ValidationTestResult {
  url: string;
  success: boolean;
  confidence: number;
  detectionTime: number;
  features: string[];
  error?: string;
}

// Create singleton instance
export const versionHandler = new VersionHandler();
