/**
 * Page Monitor
 *
 * Page navigation and SPA route change detection with content change
 * monitoring and re-initialization triggers for content scripts.
 */

import { pageRouter } from './page-router';
import { eventManager } from '../utils/event-manager';
import { mutationObserver } from '../utils/mutation-observer';
import type { PageChange } from '../types/content-script';
import type { PageIntegrationContext } from '../types/page-integration';

/**
 * Navigation change event
 */
export interface NavigationChange {
  /** Change type */
  type: 'pushstate' | 'replacestate' | 'popstate' | 'hashchange' | 'fullpage';
  /** Previous URL */
  previousUrl: string;
  /** Current URL */
  currentUrl: string;
  /** Timestamp */
  timestamp: Date;
  /** Whether this is a SPA navigation */
  isSPANavigation: boolean;
  /** Navigation triggers */
  triggers: string[];
}

/**
 * Content change event
 */
export interface ContentChange {
  /** Change ID */
  id: string;
  /** Change type */
  type: 'major-layout' | 'minor-layout' | 'content-added' | 'content-removed' | 'attribute-change';
  /** Affected elements */
  elements: Element[];
  /** Change significance */
  significance: 'low' | 'medium' | 'high' | 'critical';
  /** Whether this affects meeting content */
  affectsMeetingContent: boolean;
  /** Whether re-initialization is recommended */
  requiresReinitialization: boolean;
  /** Timestamp */
  timestamp: Date;
  /** Change details */
  details: {
    mutationCount: number;
    addedNodesCount: number;
    removedNodesCount: number;
    attributeChanges: string[];
  };
}

/**
 * Monitor configuration
 */
export interface MonitorConfig {
  /** Whether to monitor navigation changes */
  monitorNavigation: boolean;
  /** Whether to monitor content changes */
  monitorContent: boolean;
  /** Whether to auto-reinitialize on significant changes */
  autoReinitialize: boolean;
  /** Debounce delay for content changes (ms) */
  contentChangeDebounce: number;
  /** Threshold for significant content changes */
  significanceThreshold: {
    low: number;
    medium: number;
    high: number;
  };
  /** Maximum re-initialization attempts */
  maxReinitAttempts: number;
  /** Re-initialization delay (ms) */
  reinitDelay: number;
}

/**
 * Monitor statistics
 */
export interface MonitorStatistics {
  /** Navigation changes detected */
  navigationChanges: number;
  /** Content changes detected */
  contentChanges: number;
  /** Re-initializations triggered */
  reinitializations: number;
  /** Failed re-initializations */
  failedReinits: number;
  /** Monitoring start time */
  startTime: Date;
  /** Last activity time */
  lastActivity: Date;
  /** Current status */
  status: 'active' | 'paused' | 'stopped';
}

/**
 * Page monitor for SPA navigation and content changes
 */
export class PageMonitor {
  private static instance: PageMonitor;
  private config: MonitorConfig;
  private isMonitoring: boolean = false;
  private currentUrl: string;
  private previousUrl: string;
  private navigationCallbacks: Array<(change: NavigationChange) => void> = [];
  private contentCallbacks: Array<(change: ContentChange) => void> = [];
  private reinitCallbacks: Array<(context: PageIntegrationContext | null) => void> = [];
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private statistics: MonitorStatistics;
  private reinitAttempts: number = 0;
  private lastSignificantChange: Date | null = null;

  constructor(config: Partial<MonitorConfig> = {}) {
    this.config = {
      monitorNavigation: true,
      monitorContent: true,
      autoReinitialize: true,
      contentChangeDebounce: 1000,
      significanceThreshold: {
        low: 5,
        medium: 15,
        high: 30,
      },
      maxReinitAttempts: 3,
      reinitDelay: 2000,
      ...config,
    };

    this.currentUrl = window.location.href;
    this.previousUrl = this.currentUrl;

    this.statistics = {
      navigationChanges: 0,
      contentChanges: 0,
      reinitializations: 0,
      failedReinits: 0,
      startTime: new Date(),
      lastActivity: new Date(),
      status: 'stopped',
    };
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<MonitorConfig>): PageMonitor {
    if (!PageMonitor.instance) {
      PageMonitor.instance = new PageMonitor(config);
    }
    return PageMonitor.instance;
  }

  /**
   * Start monitoring page changes
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    // STRONG ARCHITECTURAL PROTECTION: Never start monitoring on unsupported pages
    const currentUrl = window.location.href;
    const isSupportedPage = this.isSupportedPageUrl(currentUrl);

    console.log(`[PageMonitor] STRONG PROTECTION CHECK - URL: ${currentUrl}, Supported: ${isSupportedPage}`);

    if (!isSupportedPage) {
      console.log('[PageMonitor] STRONG PROTECTION ACTIVE - refusing to start monitoring on unsupported page');
      return; // Completely refuse to start monitoring
    }

    console.log('[PageMonitor] STRONG PROTECTION PASSED - starting monitoring');

    this.isMonitoring = true;
    this.statistics.status = 'active';
    this.statistics.startTime = new Date();

    // Start navigation monitoring
    if (this.config.monitorNavigation) {
      this.setupNavigationMonitoring();
    }

    // Start content monitoring
    if (this.config.monitorContent) {
      this.setupContentMonitoring();
    }

    // Setup periodic health checks
    this.setupHealthChecks();
  }

  /**
   * Stop monitoring page changes
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    this.statistics.status = 'stopped';

    // Stop mutation observer
    mutationObserver.stopMonitoring();

    // Clear debounce timers
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();

    // Clear callbacks
    this.navigationCallbacks.length = 0;
    this.contentCallbacks.length = 0;
    this.reinitCallbacks.length = 0;
  }

  /**
   * Pause monitoring temporarily
   */
  pauseMonitoring(): void {
    if (this.isMonitoring) {
      this.statistics.status = 'paused';
      mutationObserver.stopMonitoring();
    }
  }

  /**
   * Resume monitoring
   */
  resumeMonitoring(): void {
    if (this.isMonitoring && this.statistics.status === 'paused') {
      this.statistics.status = 'active';
      if (this.config.monitorContent) {
        mutationObserver.startMonitoring();
      }
    }
  }

  /**
   * Register navigation change callback
   */
  onNavigationChange(callback: (change: NavigationChange) => void): () => void {
    this.navigationCallbacks.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.navigationCallbacks.indexOf(callback);
      if (index > -1) {
        this.navigationCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Register content change callback
   */
  onContentChange(callback: (change: ContentChange) => void): () => void {
    this.contentCallbacks.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.contentCallbacks.indexOf(callback);
      if (index > -1) {
        this.contentCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Register re-initialization callback
   */
  onReinitialization(callback: (context: PageIntegrationContext | null) => void): void {
    this.reinitCallbacks.push(callback);
  }

  /**
   * Force re-initialization
   */
  async forceReinitialization(): Promise<PageIntegrationContext | null> {
    return this.handleReinitialization('manual-trigger');
  }

  /**
   * Setup navigation monitoring
   */
  private setupNavigationMonitoring(): void {
    // Intercept history API methods
    this.interceptHistoryAPI();

    // Listen for popstate events (back/forward buttons)
    eventManager.addEventListener(
      window,
      'popstate',
      event => {
        this.handleNavigationEvent('popstate', event);
      },
      { passive: true },
    );

    // Listen for hashchange events
    eventManager.addEventListener(
      window,
      'hashchange',
      event => {
        this.handleNavigationEvent('hashchange', event);
      },
      { passive: true },
    );

    // Listen for page visibility changes
    eventManager.addEventListener(
      document,
      'visibilitychange',
      () => {
        if (!document.hidden) {
          this.checkForURLChange();
        }
      },
      { passive: true },
    );

    // Listen for focus events (tab switching)
    eventManager.addEventListener(
      window,
      'focus',
      () => {
        this.checkForURLChange();
      },
      { passive: true },
    );
  }

  /**
   * Intercept history API methods
   */
  private interceptHistoryAPI(): void {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    // Intercept pushState
    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      this.handleNavigationEvent('pushstate');
    };

    // Intercept replaceState
    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      this.handleNavigationEvent('replacestate');
    };

    // Store original methods for cleanup
    interface PageMonitorWithHistory {
      originalPushState?: typeof history.pushState;
      originalReplaceState?: typeof history.replaceState;
    }
    (this as PageMonitorWithHistory).originalPushState = originalPushState;
    (this as PageMonitorWithHistory).originalReplaceState = originalReplaceState;
  }

  /**
   * Setup content monitoring
   */
  private setupContentMonitoring(): void {
    // Start mutation observer
    mutationObserver.startMonitoring();

    // Register for page changes
    mutationObserver.onPageChange(changes => {
      this.handlePageChanges(changes);
    });

    // Register for content detection
    mutationObserver.onContentDetection(content => {
      this.handleContentDetection(content);
    });
  }

  /**
   * Setup periodic health checks
   */
  private setupHealthChecks(): void {
    // Check for URL changes every 5 seconds
    setInterval(() => {
      if (this.isMonitoring) {
        this.checkForURLChange();
      }
    }, 5000);

    // Validate handler state every 30 seconds
    setInterval(() => {
      if (this.isMonitoring) {
        this.validateHandlerState();
      }
    }, 30000);
  }

  /**
   * Handle navigation events
   */
  private handleNavigationEvent(type: NavigationChange['type'], _event?: Event): void {
    this.checkForURLChange(type);
  }

  /**
   * Check for URL changes
   */
  private checkForURLChange(triggerType?: NavigationChange['type']): void {
    const currentUrl = window.location.href;

    if (currentUrl !== this.currentUrl) {
      const previousUrl = this.currentUrl;
      this.previousUrl = this.currentUrl;
      this.currentUrl = currentUrl;

      const navigationChange: NavigationChange = {
        type: triggerType || 'fullpage',
        previousUrl,
        currentUrl,
        timestamp: new Date(),
        isSPANavigation: this.isSPANavigation(previousUrl, currentUrl),
        triggers: triggerType ? [triggerType] : ['url-check'],
      };

      this.processNavigationChange(navigationChange);
    }
  }

  /**
   * Process navigation change
   */
  private async processNavigationChange(change: NavigationChange): Promise<void> {
    this.statistics.navigationChanges++;
    this.statistics.lastActivity = new Date();

    // Notify callbacks
    this.navigationCallbacks.forEach(callback => {
      try {
        callback(change);
      } catch (error) {
        console.error('Navigation callback error:', error);
      }
    });

    // Check if handler re-initialization is needed
    if (change.isSPANavigation || this.isSignificantNavigation(change)) {
      await this.scheduleReinitialization('navigation-change');
    }
  }

  /**
   * Check if navigation is SPA-based
   */
  private isSPANavigation(previousUrl: string, currentUrl: string): boolean {
    try {
      const prev = new URL(previousUrl);
      const curr = new URL(currentUrl);

      // Same origin and different path/hash = likely SPA
      return prev.origin === curr.origin && (prev.pathname !== curr.pathname || prev.hash !== curr.hash);
    } catch {
      return false;
    }
  }

  /**
   * Check if navigation is significant enough for re-initialization
   */
  private isSignificantNavigation(change: NavigationChange): boolean {
    try {
      const prev = new URL(change.previousUrl);
      const curr = new URL(change.currentUrl);

      // Different pathname is significant
      if (prev.pathname !== curr.pathname) {
        return true;
      }

      // Hash changes in specific patterns
      const significantHashPatterns = [
        /\/meetup-join\//,
        /\/calendar\//,
        /\/conversations\//,
        /\/files\//,
        /\/apps\//,
        /\/meeting\//,
        /\/teams\//,
      ];

      return significantHashPatterns.some(pattern => pattern.test(curr.hash) !== pattern.test(prev.hash));
    } catch {
      return false;
    }
  }

  /**
   * Handle page changes from mutation observer
   */
  private handlePageChanges(changes: PageChange[]): void {
    if (changes.length === 0) return;

    // Convert to content changes
    const contentChanges = changes.map(change => this.convertToContentChange(change));

    // Group by significance
    const significantChanges = contentChanges.filter(
      change => change.significance === 'high' || change.significance === 'critical',
    );

    if (significantChanges.length > 0) {
      this.processSignificantContentChanges(significantChanges);
    }

    // Process all changes
    contentChanges.forEach(change => this.processContentChange(change));
  }

  /**
   * Convert page change to content change
   */
  private convertToContentChange(pageChange: PageChange): ContentChange {
    const significance = this.calculateChangeSignificance(pageChange);
    const requiresReinitialization = this.shouldReinitialize(pageChange, significance);

    return {
      id: `content-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: this.mapChangeType(pageChange.type),
      elements: pageChange.elements || [],
      significance,
      affectsMeetingContent: pageChange.affectsMeetingContent || false,
      requiresReinitialization,
      timestamp: new Date(pageChange.timestamp || Date.now()),
      details: {
        mutationCount: 1,
        addedNodesCount: pageChange.type === 'content-added' ? 1 : 0,
        removedNodesCount: pageChange.type === 'content-removed' ? 1 : 0,
        attributeChanges: [],
      },
    };
  }

  /**
   * Map page change type to content change type
   */
  private mapChangeType(pageChangeType: string): ContentChange['type'] {
    switch (pageChangeType) {
      case 'content-added':
        return 'content-added';
      case 'content-removed':
        return 'content-removed';
      case 'layout-change':
        return 'major-layout';
      case 'navigation':
        return 'major-layout';
      default:
        return 'minor-layout';
    }
  }

  /**
   * Calculate change significance
   */
  private calculateChangeSignificance(change: PageChange): ContentChange['significance'] {
    let score = 0;

    // Base score from change type
    switch (change.type) {
      case 'navigation':
        score += 25;
        break;
      case 'layout-change':
        score += 15;
        break;
      case 'content-added':
      case 'content-removed':
        score += 10;
        break;
      default:
        score += 5;
    }

    // Meeting content affects significance
    if (change.affectsMeetingContent) {
      score += 20;
    }

    // Multiple elements increase significance
    const elementCount = change.elements?.length || 0;
    if (elementCount > 5) {
      score += 10;
    } else if (elementCount > 1) {
      score += 5;
    }

    // Determine significance level
    if (score >= this.config.significanceThreshold.high) {
      return 'critical';
    } else if (score >= this.config.significanceThreshold.medium) {
      return 'high';
    } else if (score >= this.config.significanceThreshold.low) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Check if change should trigger re-initialization
   */
  private shouldReinitialize(change: PageChange, significance: ContentChange['significance']): boolean {
    // Always reinitialize for critical changes
    if (significance === 'critical') {
      return true;
    }

    // Reinitialize for high significance meeting content changes
    if (significance === 'high' && change.affectsMeetingContent) {
      return true;
    }

    // Reinitialize for navigation changes
    if (change.type === 'navigation') {
      return true;
    }

    return false;
  }

  /**
   * Process content change
   */
  private processContentChange(change: ContentChange): void {
    this.statistics.contentChanges++;
    this.statistics.lastActivity = new Date();

    // Debounce content change notifications
    this.debounceContentChange(change);
  }

  /**
   * Debounce content change notifications
   */
  private debounceContentChange(change: ContentChange): void {
    const debounceKey = `content-${change.type}-${change.significance}`;

    // Clear existing timer
    const existingTimer = this.debounceTimers.get(debounceKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.notifyContentChange(change);
      this.debounceTimers.delete(debounceKey);
    }, this.config.contentChangeDebounce);

    this.debounceTimers.set(debounceKey, timer);
  }

  /**
   * Notify content change callbacks
   */
  private notifyContentChange(change: ContentChange): void {
    this.contentCallbacks.forEach(callback => {
      try {
        callback(change);
      } catch (error) {
        console.error('Content change callback error:', error);
      }
    });
  }

  /**
   * Process significant content changes
   */
  private async processSignificantContentChanges(changes: ContentChange[]): Promise<void> {
    this.lastSignificantChange = new Date();

    // Check if any changes require re-initialization
    const needsReinit = changes.some(change => change.requiresReinitialization);

    if (needsReinit && this.config.autoReinitialize) {
      await this.scheduleReinitialization('content-change');
    }
  }

  /**
   * Handle content detection
   */
  private handleContentDetection(content: unknown[]): void {
    if (content.length > 0) {
      // Create content change for new meeting content
      const contentChange: ContentChange = {
        id: `detected-${Date.now()}`,
        type: 'content-added',
        elements: content.map(c => c.element).filter(Boolean),
        significance: 'medium',
        affectsMeetingContent: true,
        requiresReinitialization: false,
        timestamp: new Date(),
        details: {
          mutationCount: content.length,
          addedNodesCount: content.length,
          removedNodesCount: 0,
          attributeChanges: [],
        },
      };

      this.processContentChange(contentChange);
    }
  }

  /**
   * Schedule re-initialization
   */
  private async scheduleReinitialization(reason: string): Promise<void> {
    if (this.reinitAttempts >= this.config.maxReinitAttempts) {
      console.warn('Maximum re-initialization attempts reached');
      return;
    }

    // Debounce re-initialization
    const reinitKey = 'reinit';
    const existingTimer = this.debounceTimers.get(reinitKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      await this.handleReinitialization(reason);
      this.debounceTimers.delete(reinitKey);
    }, this.config.reinitDelay);

    this.debounceTimers.set(reinitKey, timer);
  }

  /**
   * Handle re-initialization
   */
  private async handleReinitialization(_reason: string): Promise<PageIntegrationContext | null> {
    try {
      this.reinitAttempts++;
      this.statistics.reinitializations++;

      // Use page router to handle re-initialization
      const context = await pageRouter.handlePageChange();

      if (context) {
        this.reinitAttempts = 0; // Reset on success
      } else {
        console.warn('Page re-initialization returned null context');
      }

      // Notify callbacks
      this.reinitCallbacks.forEach(callback => {
        try {
          callback(context);
        } catch (error) {
          console.error('Re-initialization callback error:', error);
        }
      });

      return context;
    } catch (error) {
      this.statistics.failedReinits++;
      console.error('Page re-initialization failed:', error);
      return null;
    }
  }

  /**
   * Validate handler state
   */
  private async validateHandlerState(): Promise<void> {
    try {
      // First check if this is a supported page type by URL
      const currentUrl = window.location.href;
      const isSupportedPage = this.isSupportedPageUrl(currentUrl);

      // For unsupported pages, skip handler validation entirely
      if (!isSupportedPage) {
        // Skip validation for unsupported page types - this is normal behavior
        return;
      }

      const currentHandler = pageRouter.getCurrentHandler();
      const currentPageType = pageRouter.getCurrentPageType();

      if (!currentHandler || !currentPageType) {
        console.warn('No active handler detected, attempting re-initialization');
        await this.scheduleReinitialization('handler-validation');
        return;
      }

      // Check if page type has changed
      const hasChanged = await pageRouter.hasPageChanged();
      if (hasChanged) {
        await this.scheduleReinitialization('page-type-change');
      }
    } catch (error) {
      console.error('Handler state validation failed:', error);
    }
  }

  /**
   * Check if the current URL is a supported page type
   */
  private isSupportedPageUrl(url: string): boolean {
    // Only SharePoint and Teams pages are supported
    const supportedPatterns = [
      /sharepoint\.com/i,
      /\.sharepoint\./i,
      /\/_layouts\//i,
      /\/personal\//i,
      /stream\.aspx/i,
      /teams\.microsoft\.com/i,
      /teams\.live\.com/i,
      /teams-for-business\.microsoft\.com/i,
      /\/meetup-join\//i,
      /\/l\/meetup-join\//i,
    ];

    return supportedPatterns.some(pattern => pattern.test(url));
  }

  /**
   * Get monitoring statistics
   */
  getStatistics(): MonitorStatistics {
    return { ...this.statistics };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<MonitorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): MonitorConfig {
    return { ...this.config };
  }

  /**
   * Reset statistics
   */
  resetStatistics(): void {
    this.statistics = {
      navigationChanges: 0,
      contentChanges: 0,
      reinitializations: 0,
      failedReinits: 0,
      startTime: new Date(),
      lastActivity: new Date(),
      status: this.statistics.status,
    };
    this.reinitAttempts = 0;
  }

  /**
   * Cleanup monitor
   */
  cleanup(): void {
    this.stopMonitoring();

    // Restore original history methods
    interface PageMonitorWithHistory {
      originalPushState?: typeof history.pushState;
      originalReplaceState?: typeof history.replaceState;
    }
    const monitor = this as PageMonitorWithHistory;
    if (monitor.originalPushState) {
      history.pushState = monitor.originalPushState;
    }
    if (monitor.originalReplaceState) {
      history.replaceState = monitor.originalReplaceState;
    }
  }
}

// Export singleton instance
export const pageMonitor = PageMonitor.getInstance();

// Export utility functions
export const monitorUtils = {
  /**
   * Get monitor instance
   */
  getInstance: (config?: Partial<MonitorConfig>) => PageMonitor.getInstance(config),

  /**
   * Start monitoring
   */
  start: (): void => {
    pageMonitor.startMonitoring();
  },

  /**
   * Stop monitoring
   */
  stop: (): void => {
    pageMonitor.stopMonitoring();
  },

  /**
   * Force re-initialization
   */
  forceReinit: (): Promise<PageIntegrationContext | null> => pageMonitor.forceReinitialization(),

  /**
   * Get statistics
   */
  getStats: (): MonitorStatistics => pageMonitor.getStatistics(),

  /**
   * Register callbacks
   */
  onNavigation: (callback: (change: NavigationChange) => void): void => {
    pageMonitor.onNavigationChange(callback);
  },

  onContent: (callback: (change: ContentChange) => void): void => {
    pageMonitor.onContentChange(callback);
  },

  onReinit: (callback: (context: PageIntegrationContext | null) => void): void => {
    pageMonitor.onReinitialization(callback);
  },

  /**
   * Cleanup monitor
   */
  cleanup: (): void => {
    pageMonitor.cleanup();
  },
};
