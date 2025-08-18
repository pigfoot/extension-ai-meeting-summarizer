/**
 * Page Router
 *
 * Page type detection and handler routing with fallback handling
 * for unknown page types in content scripts.
 */

import { SharePointPageHandler } from './sharepoint-handler';
import { TeamsPageHandler } from './teams-handler';
import type { PageIntegrationContext } from '../types/page-integration';

/**
 * Page type detection result
 */
export interface PageTypeDetection {
  /** Detected page type */
  pageType: 'sharepoint' | 'teams' | 'unknown';
  /** Detection confidence (0-1) */
  confidence: number;
  /** Detection details */
  details: {
    /** URL indicators found */
    urlIndicators: string[];
    /** DOM indicators found */
    domIndicators: string[];
    /** Platform indicators */
    platformIndicators: string[];
    /** Detection method used */
    method: 'url' | 'dom' | 'hybrid';
  };
  /** Fallback handlers available */
  fallbacks: string[];
}

/**
 * Page handler interface
 */
export interface PageHandler {
  /** Initialize handler for current page */
  initialize(): Promise<PageIntegrationContext | null>;
  /** Get optimal injection point for component */
  getOptimalInjectionPoint(componentType: string): unknown;
  /** Get page information */
  getPageInfo(): unknown;
  /** Cleanup handler resources */
  cleanup(): void;
}

/**
 * Handler registration information
 */
export interface HandlerRegistration {
  /** Handler name */
  name: string;
  /** Handler class constructor */
  handler: new () => PageHandler;
  /** Detection patterns */
  patterns: {
    /** URL patterns */
    urlPatterns: RegExp[];
    /** DOM selectors */
    domSelectors: string[];
    /** Platform indicators */
    platformChecks: (() => boolean)[];
  };
  /** Priority (higher = checked first) */
  priority: number;
  /** Whether this is a fallback handler */
  isFallback: boolean;
}

/**
 * Router configuration
 */
export interface RouterConfig {
  /** Maximum detection time in milliseconds */
  maxDetectionTime: number;
  /** Whether to enable fallback handlers */
  enableFallbacks: boolean;
  /** Whether to cache detection results */
  cacheDetections: boolean;
  /** Detection retry attempts */
  retryAttempts: number;
  /** Retry delay in milliseconds */
  retryDelay: number;
}

/**
 * Page router for content script handler management
 */
export class PageRouter {
  private static instance: PageRouter;
  private handlers: Map<string, HandlerRegistration> = new Map();
  private currentHandler: PageHandler | null = null;
  private currentPageType: string | null = null;
  private detectionCache: Map<string, PageTypeDetection> = new Map();
  private config: RouterConfig;

  constructor(config: Partial<RouterConfig> = {}) {
    this.config = {
      maxDetectionTime: 5000,
      enableFallbacks: true,
      cacheDetections: true,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config,
    };

    this.registerBuiltInHandlers();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<RouterConfig>): PageRouter {
    if (!PageRouter.instance) {
      PageRouter.instance = new PageRouter(config);
    }
    return PageRouter.instance;
  }

  /**
   * Register built-in page handlers
   */
  private registerBuiltInHandlers(): void {
    // Register SharePoint handler
    this.registerHandler({
      name: 'sharepoint',
      handler: SharePointPageHandler,
      patterns: {
        urlPatterns: [
          /sharepoint\.com/i,
          /\.sharepoint\./i,
          /\/_layouts\//i,
          /\/sites\//i,
          /\/forms\//i,
          /\/sitepages\//i,
        ],
        domSelectors: [
          '[data-sp-feature-tag]',
          '.ms-webpart-chrome',
          '#s4-workspace',
          '.od-TopBar',
          '[data-automationid="SiteHeader"]',
          '_spPageContextInfo',
        ],
        platformChecks: [
          () => (window as Window & { _spPageContextInfo?: unknown })._spPageContextInfo !== undefined,
          () => (window as Window & { SP?: unknown }).SP !== undefined,
          () => document.querySelector('[data-sp-feature-tag]') !== null,
        ],
      },
      priority: 10,
      isFallback: false,
    });

    // Register Teams handler
    this.registerHandler({
      name: 'teams',
      handler: TeamsPageHandler,
      patterns: {
        urlPatterns: [
          /teams\.microsoft\.com/i,
          /teams\.live\.com/i,
          /teams-for-business\.microsoft\.com/i,
          /\/meetup-join\//i,
          /\/l\/meetup-join\//i,
        ],
        domSelectors: [
          '[data-tid]',
          '[data-app="teams"]',
          '.ts-calling-screen',
          '.teams-app',
          '.meeting-stage',
          '.teams-meeting',
          '#teams-app-chrome',
          '.calling-controls',
        ],
        platformChecks: [
          () => navigator.userAgent.includes('Teams/'),
          () => navigator.userAgent.includes('MSTeams'),
          () => document.querySelector('[data-tid]') !== null,
          () => document.querySelector('.ts-calling-screen') !== null,
        ],
      },
      priority: 10,
      isFallback: false,
    });
  }

  /**
   * Register custom page handler
   */
  registerHandler(registration: HandlerRegistration): void {
    this.handlers.set(registration.name, registration);
  }

  /**
   * Unregister page handler
   */
  unregisterHandler(name: string): boolean {
    return this.handlers.delete(name);
  }

  /**
   * Detect current page type
   */
  async detectPageType(): Promise<PageTypeDetection> {
    const cacheKey = window.location.href;

    // Check cache first
    if (this.config.cacheDetections && this.detectionCache.has(cacheKey)) {
      return this.detectionCache.get(cacheKey)!;
    }

    const startTime = Date.now();
    let bestMatch: PageTypeDetection | null = null;
    let attempts = 0;

    while (attempts < this.config.retryAttempts) {
      try {
        // Check if we've exceeded max detection time
        if (Date.now() - startTime > this.config.maxDetectionTime) {
          break;
        }

        bestMatch = await this.performDetection();

        // If we found a confident match, use it
        if (bestMatch && bestMatch.confidence >= 0.8) {
          break;
        }

        attempts++;

        // Wait before retry (except on last attempt)
        if (attempts < this.config.retryAttempts) {
          await this.delay(this.config.retryDelay);
        }
      } catch (error) {
        console.warn(`Page detection attempt ${attempts + 1} failed:`, error);
        attempts++;
      }
    }

    // If no good match found, create unknown result
    if (!bestMatch || bestMatch.confidence < 0.5) {
      bestMatch = {
        pageType: 'unknown',
        confidence: 0,
        details: {
          urlIndicators: [],
          domIndicators: [],
          platformIndicators: [],
          method: 'hybrid',
        },
        fallbacks: this.getFallbackHandlers(),
      };
    }

    // Cache result
    if (this.config.cacheDetections) {
      this.detectionCache.set(cacheKey, bestMatch);
    }

    return bestMatch;
  }

  /**
   * Perform page type detection
   */
  private async performDetection(): Promise<PageTypeDetection> {
    const results: Array<{ name: string; score: number; indicators: unknown }> = [];

    // Test each registered handler
    for (const [name, registration] of this.handlers.entries()) {
      if (registration.isFallback && !this.config.enableFallbacks) {
        continue;
      }

      const score = await this.calculateHandlerScore(registration);
      const indicators = this.getDetectionIndicators(registration);

      results.push({ name, score, indicators });
    }

    // Sort by score (highest first)
    results.sort((a, b) => b.score - a.score);

    const bestResult = results[0];

    if (!bestResult || bestResult.score === 0) {
      return {
        pageType: 'unknown',
        confidence: 0,
        details: {
          urlIndicators: [],
          domIndicators: [],
          platformIndicators: [],
          method: 'hybrid',
        },
        fallbacks: this.getFallbackHandlers(),
      };
    }

    return {
      pageType: bestResult.name as 'sharepoint' | 'teams' | 'unknown',
      confidence: Math.min(bestResult.score / 100, 1),
      details: {
        urlIndicators: bestResult.indicators.urlMatches,
        domIndicators: bestResult.indicators.domMatches,
        platformIndicators: bestResult.indicators.platformMatches,
        method: 'hybrid',
      },
      fallbacks: this.getFallbackHandlers(),
    };
  }

  /**
   * Calculate handler detection score
   */
  private async calculateHandlerScore(registration: HandlerRegistration): Promise<number> {
    let score = 0;
    const maxScore = 100;

    // URL pattern matching (40% weight)
    const urlScore = this.calculateUrlScore(registration.patterns.urlPatterns);
    score += urlScore * 0.4;

    // DOM selector matching (40% weight)
    const domScore = await this.calculateDomScore(registration.patterns.domSelectors);
    score += domScore * 0.4;

    // Platform checks (20% weight)
    const platformScore = this.calculatePlatformScore(registration.patterns.platformChecks);
    score += platformScore * 0.2;

    // Priority bonus
    score += registration.priority * 0.01;

    return Math.min(score, maxScore);
  }

  /**
   * Calculate URL pattern score
   */
  private calculateUrlScore(urlPatterns: RegExp[]): number {
    const currentUrl = window.location.href;
    let matches = 0;

    for (const pattern of urlPatterns) {
      if (pattern.test(currentUrl)) {
        matches++;
      }
    }

    return urlPatterns.length > 0 ? (matches / urlPatterns.length) * 100 : 0;
  }

  /**
   * Calculate DOM selector score
   */
  private async calculateDomScore(domSelectors: string[]): Promise<number> {
    let matches = 0;

    for (const selector of domSelectors) {
      try {
        // Handle special case for global variables
        if (!selector.startsWith('[') && !selector.startsWith('.') && !selector.startsWith('#')) {
          if ((window as Window & Record<string, unknown>)[selector] !== undefined) {
            matches++;
          }
        } else {
          if (document.querySelector(selector)) {
            matches++;
          }
        }
      } catch (_error) {
        // Invalid selector, skip
        continue;
      }
    }

    return domSelectors.length > 0 ? (matches / domSelectors.length) * 100 : 0;
  }

  /**
   * Calculate platform check score
   */
  private calculatePlatformScore(platformChecks: (() => boolean)[]): number {
    let matches = 0;

    for (const check of platformChecks) {
      try {
        if (check()) {
          matches++;
        }
      } catch (_error) {
        // Check failed, skip
        continue;
      }
    }

    return platformChecks.length > 0 ? (matches / platformChecks.length) * 100 : 0;
  }

  /**
   * Get detection indicators for a handler
   */
  private getDetectionIndicators(registration: HandlerRegistration): Record<string, unknown> {
    const currentUrl = window.location.href;
    const indicators = {
      urlMatches: [] as string[],
      domMatches: [] as string[],
      platformMatches: [] as string[],
    };

    // Check URL patterns
    registration.patterns.urlPatterns.forEach(pattern => {
      if (pattern.test(currentUrl)) {
        indicators.urlMatches.push(pattern.source);
      }
    });

    // Check DOM selectors
    registration.patterns.domSelectors.forEach(selector => {
      try {
        if (!selector.startsWith('[') && !selector.startsWith('.') && !selector.startsWith('#')) {
          if ((window as Window & Record<string, unknown>)[selector] !== undefined) {
            indicators.domMatches.push(selector);
          }
        } else {
          if (document.querySelector(selector)) {
            indicators.domMatches.push(selector);
          }
        }
      } catch (_error) {
        // Invalid selector
      }
    });

    // Check platform checks
    registration.patterns.platformChecks.forEach((check, index) => {
      try {
        if (check()) {
          indicators.platformMatches.push(`check-${index}`);
        }
      } catch (_error) {
        // Check failed
      }
    });

    return indicators;
  }

  /**
   * Get available fallback handlers
   */
  private getFallbackHandlers(): string[] {
    return Array.from(this.handlers.values())
      .filter(reg => reg.isFallback)
      .map(reg => reg.name);
  }

  /**
   * Route to appropriate page handler
   */
  async routeToHandler(): Promise<PageIntegrationContext | null> {
    try {
      // Cleanup current handler if any
      if (this.currentHandler) {
        this.currentHandler.cleanup();
        this.currentHandler = null;
        this.currentPageType = null;
      }

      // Detect page type
      const detection = await this.detectPageType();

      if (detection.pageType === 'unknown') {
        console.warn('Unknown page type detected, no handler available');
        return null;
      }

      // Get handler registration
      const registration = this.handlers.get(detection.pageType);
      if (!registration) {
        console.error(`No handler registered for page type: ${detection.pageType}`);
        return null;
      }

      // Create and initialize handler
      this.currentHandler = new registration.handler();
      this.currentPageType = detection.pageType;

      // Initialize handler
      const context = await this.currentHandler.initialize();

      if (!context) {
        console.warn(`Handler ${detection.pageType} failed to initialize`);
        this.currentHandler.cleanup();
        this.currentHandler = null;
        this.currentPageType = null;
      }

      return context;
    } catch (error) {
      console.error('Failed to route to page handler:', error);

      // Cleanup on error
      if (this.currentHandler) {
        this.currentHandler.cleanup();
        this.currentHandler = null;
        this.currentPageType = null;
      }

      return null;
    }
  }

  /**
   * Get current active handler
   */
  getCurrentHandler(): PageHandler | null {
    return this.currentHandler;
  }

  /**
   * Get current page type
   */
  getCurrentPageType(): string | null {
    return this.currentPageType;
  }

  /**
   * Get current page context
   */
  getCurrentPageContext(): { pageType: string; platform: string; confidence: number } {
    // Return cached detection or perform quick detection
    const currentUrl = window.location.href;
    const cached = this.detectionCache.get(currentUrl);

    if (cached) {
      return {
        pageType: cached.pageType,
        platform: this.determinePlatform(cached.pageType),
        confidence: cached.confidence,
      };
    }

    // Quick synchronous detection for basic cases
    let pageType: string = 'unknown';
    let confidence = 0;

    if (currentUrl.includes('sharepoint')) {
      pageType = 'sharepoint';
      confidence = 0.8;
    } else if (currentUrl.includes('teams.microsoft.com')) {
      pageType = 'teams';
      confidence = 0.8;
    }

    return {
      pageType,
      platform: this.determinePlatform(pageType),
      confidence,
    };
  }

  /**
   * Determine platform from page type
   */
  private determinePlatform(pageType: string): string {
    switch (pageType) {
      case 'sharepoint':
        return 'SharePoint';
      case 'teams':
        return 'Microsoft Teams';
      default:
        return 'Unknown';
    }
  }

  /**
   * Check if handler is available for page type
   */
  hasHandlerForPageType(pageType: string): boolean {
    return this.handlers.has(pageType);
  }

  /**
   * Get optimal injection point from current handler
   */
  getOptimalInjectionPoint(componentType: string): unknown {
    if (!this.currentHandler) {
      return null;
    }

    return this.currentHandler.getOptimalInjectionPoint(componentType);
  }

  /**
   * Get page information from current handler
   */
  getPageInfo(): unknown {
    if (!this.currentHandler) {
      return null;
    }

    return this.currentHandler.getPageInfo();
  }

  /**
   * Force page type re-detection
   */
  async redetectPageType(): Promise<PageTypeDetection> {
    // Clear cache for current URL
    const cacheKey = window.location.href;
    this.detectionCache.delete(cacheKey);

    return this.detectPageType();
  }

  /**
   * Check if current page has changed significantly
   */
  async hasPageChanged(): Promise<boolean> {
    const currentDetection = await this.detectPageType();
    return currentDetection.pageType !== this.currentPageType;
  }

  /**
   * Handle page navigation or significant changes
   */
  async handlePageChange(): Promise<PageIntegrationContext | null> {
    const hasChanged = await this.hasPageChanged();

    if (hasChanged) {
      return this.routeToHandler();
    }

    return null;
  }

  /**
   * Get router statistics
   */
  getStatistics(): {
    totalHandlers: number;
    activeHandler: string | null;
    cacheSize: number;
    detectionHistory: Array<{ pageType: string; confidence: number; timestamp: Date }>;
  } {
    const detectionHistory = Array.from(this.detectionCache.entries()).map(([_url, detection]) => ({
      pageType: detection.pageType,
      confidence: detection.confidence,
      timestamp: new Date(), // In real implementation, we'd track this
    }));

    return {
      totalHandlers: this.handlers.size,
      activeHandler: this.currentPageType,
      cacheSize: this.detectionCache.size,
      detectionHistory,
    };
  }

  /**
   * Clear detection cache
   */
  clearCache(): void {
    this.detectionCache.clear();
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup router and current handler
   */
  cleanup(): void {
    if (this.currentHandler) {
      this.currentHandler.cleanup();
      this.currentHandler = null;
      this.currentPageType = null;
    }

    this.clearCache();
  }
}

// Export singleton instance
export const pageRouter = PageRouter.getInstance();

// Export utility functions
export const routerUtils = {
  /**
   * Get router instance
   */
  getInstance: (config?: Partial<RouterConfig>) => PageRouter.getInstance(config),

  /**
   * Quick page type detection
   */
  detectPageType: (): Promise<PageTypeDetection> => pageRouter.detectPageType(),

  /**
   * Quick handler routing
   */
  routeToHandler: (): Promise<PageIntegrationContext | null> => pageRouter.routeToHandler(),

  /**
   * Get current handler
   */
  getCurrentHandler: (): PageHandler | null => pageRouter.getCurrentHandler(),

  /**
   * Get current page context
   */
  getCurrentPageContext: (): { pageType: string; platform: string; confidence: number } =>
    pageRouter.getCurrentPageContext(),

  /**
   * Handle page changes
   */
  handlePageChange: (): Promise<PageIntegrationContext | null> => pageRouter.handlePageChange(),

  /**
   * Cleanup all handlers
   */
  cleanup: (): void => {
    pageRouter.cleanup();
  },
};
