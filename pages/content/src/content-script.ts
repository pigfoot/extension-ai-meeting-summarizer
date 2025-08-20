/**
 * Main Content Script
 *
 * Primary entry point for content script system with initialization,
 * lifecycle management, and coordination of all content script components.
 */

import { contentAnalyzer } from './analysis/content-analyzer';
import { backgroundCoordinator } from './communication/background-coordinator';
import { browserCompatibility } from './compat/browser-compat';
import { componentRegistry } from './components/ComponentRegistry';
import { featureActivationManager } from './features/feature-activation';
import { pageMonitor } from './pages/page-monitor';
import { pageRouter } from './pages/page-router';
import { SharePointPageHandler } from './pages/sharepoint-handler';
import { eventManager } from './utils/event-manager';
import { IS_DEV } from '@extension/env';

/**
 * Content script initialization state
 */
export type InitializationState = 'uninitialized' | 'initializing' | 'initialized' | 'error' | 'shutdown';

/**
 * Content script configuration
 */
export interface ContentScriptConfig {
  /** Enable automatic initialization */
  autoInitialize: boolean;
  /** Enable debug logging */
  enableDebugLogging: boolean;
  /** Initialization timeout in milliseconds */
  initializationTimeout: number;
  /** Enable performance monitoring */
  enablePerformanceMonitoring: boolean;
  /** Feature activation delay */
  featureActivationDelay: number;
  /** Enable error reporting */
  enableErrorReporting: boolean;
  /** Compatibility mode */
  compatibilityMode: 'strict' | 'permissive' | 'auto';
  /** Maximum initialization retries */
  maxInitRetries: number;
}

/**
 * Content script statistics
 */
export interface ContentScriptStatistics {
  /** Initialization state */
  state: InitializationState;
  /** Initialization timestamp */
  initializedAt?: Date;
  /** Initialization duration in milliseconds */
  initializationDuration?: number;
  /** Active features count */
  activeFeaturesCount: number;
  /** Active components count */
  activeComponentsCount: number;
  /** Background connection status */
  backgroundConnectionStatus: string;
  /** Browser compatibility score */
  compatibilityScore: number;
  /** Error count */
  errorCount: number;
  /** Performance metrics */
  performanceMetrics: {
    memoryUsage: number;
    cpuUsage: number;
    responseTime: number;
  };
  /** Last activity timestamp */
  lastActivity: Date;
}

/**
 * Content script event types
 */
export type ContentScriptEvent =
  | 'initialized'
  | 'feature-activated'
  | 'component-registered'
  | 'content-analyzed'
  | 'error-occurred'
  | 'shutdown';

/**
 * Content script event data
 */
export interface ContentScriptEventData {
  /** Event type */
  type: ContentScriptEvent;
  /** Event timestamp */
  timestamp: Date;
  /** Event data */
  data: unknown;
  /** Event source */
  source: string;
}

/**
 * Main content script coordinator
 */
export class ContentScript {
  private static instance: ContentScript;
  private config: ContentScriptConfig;
  private state: InitializationState = 'uninitialized';
  private initializationPromise: Promise<void> | null = null;
  private eventListeners: Array<(event: ContentScriptEventData) => void> = [];
  private cleanupFunctions: Array<() => void | Promise<void>> = [];
  private statistics: ContentScriptStatistics;
  private errorCount: number = 0;
  private initRetries: number = 0;

  constructor(config: Partial<ContentScriptConfig> = {}) {
    this.config = {
      autoInitialize: true,
      enableDebugLogging: false,
      initializationTimeout: 30000,
      enablePerformanceMonitoring: true,
      featureActivationDelay: 1000,
      enableErrorReporting: true,
      compatibilityMode: 'auto',
      maxInitRetries: 3,
      ...config,
    };

    this.statistics = this.createInitialStatistics();
    this.setupErrorHandling();

    // ARCHITECTURAL FIX: Only initialize on supported pages
    const pageSupported = this.isSupportedPage();
    const currentUrl = window.location.href;

    // FORCE DEBUG OUTPUT - always log this regardless of debug setting
    console.log(`[ContentScript] ARCHITECTURAL CHECK - URL: ${currentUrl}, Supported: ${pageSupported}`);

    if (!pageSupported) {
      console.log('[ContentScript] ARCHITECTURAL FIX ACTIVE - skipping initialization for unsupported page');
      this.state = 'initialized'; // Mark as initialized but inactive
      return;
    }

    console.log('[ContentScript] ARCHITECTURAL CHECK PASSED - proceeding with full initialization');

    if (this.config.autoInitialize) {
      this.initialize().catch(error => {
        this.handleInitializationError(error);
      });
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<ContentScriptConfig>): ContentScript {
    if (!ContentScript.instance) {
      ContentScript.instance = new ContentScript(config);
    }
    return ContentScript.instance;
  }

  /**
   * Initialize content script system
   */
  async initialize(): Promise<void> {
    if (this.state === 'initialized') {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization();
    return this.initializationPromise;
  }

  /**
   * Get current initialization state
   */
  getState(): InitializationState {
    return this.state;
  }

  /**
   * Check if content script is ready
   */
  isReady(): boolean {
    return this.state === 'initialized';
  }

  /**
   * Get content script statistics
   */
  getStatistics(): ContentScriptStatistics {
    this.updateStatistics();
    return { ...this.statistics };
  }

  /**
   * Register event listener
   */
  addEventListener(listener: (event: ContentScriptEventData) => void): () => void {
    this.eventListeners.push(listener);

    return () => {
      const index = this.eventListeners.indexOf(listener);
      if (index > -1) {
        this.eventListeners.splice(index, 1);
      }
    };
  }

  /**
   * Manually trigger feature activation
   */
  async activateFeatures(): Promise<void> {
    if (this.state !== 'initialized') {
      throw new Error('Content script not initialized');
    }

    try {
      const analysis = await contentAnalyzer.analyzeContent();

      if (analysis.meetingConfidence > 0.5) {
        this.log('Meeting content detected, activating features');
        this.emitEvent('content-analyzed', { analysis });
      }
    } catch (error) {
      this.handleError('Feature activation failed', error);
    }
  }

  /**
   * Get active features
   */
  getActiveFeatures(): unknown[] {
    return featureActivationManager.getActiveFeatures();
  }

  /**
   * Get active components
   */
  getActiveComponents(): unknown[] {
    return componentRegistry.getAllComponents();
  }

  /**
   * Shutdown content script
   */
  async shutdown(): Promise<void> {
    if (this.state === 'shutdown') {
      return;
    }

    this.log('Shutting down content script system');
    this.state = 'shutdown';

    try {
      // Run cleanup functions
      await Promise.all(
        this.cleanupFunctions.map(cleanup =>
          Promise.resolve(cleanup()).catch(error => this.log(`Cleanup error: ${error}`)),
        ),
      );

      // Cleanup all subsystems
      await Promise.all([
        featureActivationManager.cleanup(),
        componentRegistry.cleanup(),
        backgroundCoordinator.cleanup(),
        contentAnalyzer.cleanup(),
      ]);

      // Clear event listeners
      this.eventListeners.length = 0;
      this.cleanupFunctions.length = 0;

      this.emitEvent('shutdown', {});
      this.log('Content script shutdown completed');
    } catch (error) {
      this.handleError('Shutdown error', error);
    }
  }

  /**
   * Perform initialization sequence
   */
  private async performInitialization(): Promise<void> {
    const startTime = performance.now();

    try {
      this.state = 'initializing';
      this.log('Starting content script initialization');

      // Step 1: Browser compatibility check
      await this.initializeBrowserCompatibility();

      // Step 2: Background service connection
      await this.initializeBackgroundConnection();

      // Step 3: Page analysis and routing
      await this.initializePageAnalysis();

      // Step 4: Content monitoring
      await this.initializeContentMonitoring();

      // Step 5: Feature activation system
      await this.initializeFeatureActivation();

      // Step 6: Component system
      await this.initializeComponentSystem();

      // Step 7: Event management
      await this.initializeEventManagement();

      // Step 8: Performance monitoring
      if (this.config.enablePerformanceMonitoring) {
        await this.initializePerformanceMonitoring();
      }

      // Step 9: Error reporting
      if (this.config.enableErrorReporting) {
        await this.initializeErrorReporting();
      }

      // Complete initialization
      const endTime = performance.now();
      this.state = 'initialized';
      this.statistics.initializedAt = new Date();
      this.statistics.initializationDuration = endTime - startTime;

      this.log(`Content script initialized successfully in ${this.statistics.initializationDuration}ms`);
      this.emitEvent('initialized', {
        duration: this.statistics.initializationDuration,
        features: this.getActiveFeatures().length,
        components: this.getActiveComponents().length,
      });

      // Start feature activation after delay
      setTimeout(() => {
        this.activateFeatures().catch(error => {
          this.handleError('Initial feature activation failed', error);
        });
      }, this.config.featureActivationDelay);
    } catch (error) {
      this.state = 'error';
      this.handleInitializationError(error);
      throw error;
    }
  }

  /**
   * Initialize browser compatibility
   */
  private async initializeBrowserCompatibility(): Promise<void> {
    this.log('Initializing browser compatibility layer');

    const compatibility = browserCompatibility.getCompatibilityLayer();

    if (!compatibility.isSupported && this.config.compatibilityMode === 'strict') {
      throw new Error('Browser not supported in strict mode');
    }

    if (compatibility.compatibilityScore < 0.5 && this.config.compatibilityMode === 'auto') {
      this.log('Low compatibility score, enabling fallbacks');
    }

    this.log(`Browser: ${compatibility.browserInfo.name} ${compatibility.browserInfo.version}`);
    this.log(`Compatibility score: ${compatibility.compatibilityScore}`);
  }

  /**
   * Initialize background connection
   */
  private async initializeBackgroundConnection(): Promise<void> {
    this.log('Initializing background service connection');

    await backgroundCoordinator.initialize();

    if (!backgroundCoordinator.isReady()) {
      throw new Error('Failed to connect to background service');
    }

    // Setup connection monitoring
    const unsubscribe = backgroundCoordinator.onConnectionStatusChange(event => {
      this.log(`Background connection status: ${event.status}`);

      if (event.status === 'failed') {
        this.handleError('Background connection failed', event.error);
      }
    });

    this.cleanupFunctions.push(unsubscribe);
  }

  /**
   * Initialize page analysis
   */
  private async initializePageAnalysis(): Promise<void> {
    this.log('Initializing page analysis and routing');

    // Initialize page router
    const pageContext = pageRouter.getCurrentPageContext();
    this.log(`Page detected: ${pageContext.pageType} on ${pageContext.platform}`);

    // Route to appropriate page handler immediately
    try {
      const integrationContext = await pageRouter.routeToHandler();
      if (integrationContext) {
        this.log(`Page handler initialized successfully for: ${pageContext.pageType}`);
      } else {
        this.log(`Warning: Page handler initialization returned null for: ${pageContext.pageType}`);
      }
    } catch (error) {
      this.log(`Error during initial page handler routing: ${error}`);
      // Don't throw - allow initialization to continue with monitoring
    }

    // Initialize page monitor
    pageMonitor.startMonitoring({
      enableNavigationDetection: true,
      enableContentChangeDetection: true,
    });

    // Setup page change handler
    const unsubscribe = pageMonitor.onContentChange(change => {
      this.log(`Page change detected: ${change.type}`);

      // Re-analyze content on significant changes
      if (change.significance === 'high' || change.significance === 'critical') {
        this.activateFeatures().catch(error => {
          this.handleError('Feature reactivation failed', error);
        });
      }
    });

    this.cleanupFunctions.push(unsubscribe);
  }

  /**
   * Initialize content monitoring
   */
  private async initializeContentMonitoring(): Promise<void> {
    this.log('Initializing content monitoring');

    // Setup content analyzer
    const unsubscribe = contentAnalyzer.onContentChange(event => {
      this.log(`Content change detected: ${event.type} (${event.severity})`);
      this.emitEvent('content-analyzed', { event });
    });

    this.cleanupFunctions.push(unsubscribe);
  }

  /**
   * Initialize feature activation
   */
  private async initializeFeatureActivation(): Promise<void> {
    this.log('Initializing feature activation system');

    // Setup feature activation monitoring
    const unsubscribe = featureActivationManager.onFeatureActivation(result => {
      this.log(`Feature ${result.featureType} activation: ${result.success ? 'success' : 'failed'}`);
      this.emitEvent('feature-activated', { result });
    });

    this.cleanupFunctions.push(unsubscribe);
  }

  /**
   * Initialize component system
   */
  private async initializeComponentSystem(): Promise<void> {
    this.log('Initializing component system');

    // Setup component lifecycle monitoring
    const unsubscribe = componentRegistry.onLifecycleEvent(event => {
      if (event.type === 'mount') {
        this.log(`Component registered: ${event.componentType} (${event.componentId})`);
        this.emitEvent('component-registered', { event });
      }
    });

    this.cleanupFunctions.push(unsubscribe);
  }

  /**
   * Initialize event management
   */
  private async initializeEventManagement(): Promise<void> {
    this.log('Initializing event management');

    // Setup global error handling
    const cleanup = eventManager.registerHandler({
      element: window,
      event: 'error',
      handler: event => {
        this.handleError('Unhandled error', event.error);
      },
      options: { passive: true },
    });

    this.cleanupFunctions.push(() => {
      eventManager.removeEventListener(cleanup);
    });

    // Setup unhandled promise rejection handling
    const cleanupPromise = eventManager.registerHandler({
      element: window,
      event: 'unhandledrejection',
      handler: event => {
        this.handleError('Unhandled promise rejection', event.reason);
      },
      options: { passive: true },
    });

    this.cleanupFunctions.push(() => {
      eventManager.removeEventListener(cleanupPromise);
    });

    // Setup beforeunload cleanup
    const cleanupBeforeUnload = eventManager.registerHandler({
      element: window,
      event: 'beforeunload',
      handler: () => {
        this.shutdown().catch(error => {
          this.log(`Shutdown error during beforeunload: ${error}`);
        });
      },
      options: { passive: true },
    });

    this.cleanupFunctions.push(() => {
      eventManager.removeEventListener(cleanupBeforeUnload);
    });
  }

  /**
   * Initialize performance monitoring
   */
  private async initializePerformanceMonitoring(): Promise<void> {
    this.log('Initializing performance monitoring');

    // Setup periodic performance monitoring
    const performanceMonitor = setInterval(() => {
      this.updatePerformanceMetrics();
    }, 30000); // Every 30 seconds

    this.cleanupFunctions.push(() => {
      clearInterval(performanceMonitor);
    });
  }

  /**
   * Initialize error reporting
   */
  private async initializeErrorReporting(): Promise<void> {
    this.log('Initializing error reporting');

    // Setup error reporting to background service
    // This would typically send errors to a logging service
  }

  /**
   * Handle initialization error
   */
  private handleInitializationError(error: Error | unknown): void {
    this.errorCount++;
    this.initRetries++;

    this.log(`Initialization error (attempt ${this.initRetries}): ${error}`);

    if (this.initRetries < this.config.maxInitRetries) {
      this.log(`Retrying initialization in 2 seconds...`);

      setTimeout(() => {
        this.state = 'uninitialized';
        this.initializationPromise = null;
        this.initialize().catch(retryError => {
          this.log(`Retry failed: ${retryError}`);
        });
      }, 2000);
    } else {
      this.log('Maximum initialization retries reached');
      this.emitEvent('error-occurred', { error, type: 'initialization' });
    }
  }

  /**
   * Handle general errors
   */
  private handleError(message: string, error: Error | unknown): void {
    this.errorCount++;
    this.log(`Error: ${message} - ${error}`);

    this.emitEvent('error-occurred', {
      message,
      error,
      timestamp: new Date(),
    });

    if (this.config.enableErrorReporting) {
      // Report error to background service
      backgroundCoordinator
        .sendMessage({
          type: 'error.report',
          payload: {
            message,
            error: error?.toString(),
            stack: error?.stack,
            timestamp: Date.now(),
            context: {
              state: this.state,
              url: window.location.href,
              userAgent: navigator.userAgent,
            },
          },
        })
        .catch(reportError => {
          this.log(`Error reporting failed: ${reportError}`);
        });
    }
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    // Catch unhandled errors during initialization
    window.addEventListener('error', event => {
      if (this.state === 'initializing') {
        this.handleInitializationError(event.error);
      }
    });

    window.addEventListener('unhandledrejection', event => {
      if (this.state === 'initializing') {
        this.handleInitializationError(event.reason);
      }
    });
  }

  /**
   * Emit event to listeners
   */
  private emitEvent(type: ContentScriptEvent, data: unknown): void {
    const event: ContentScriptEventData = {
      type,
      timestamp: new Date(),
      data,
      source: 'content-script',
    };

    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        this.log(`Event listener error: ${error}`);
      }
    });
  }

  /**
   * Create initial statistics
   */
  private createInitialStatistics(): ContentScriptStatistics {
    return {
      state: this.state,
      activeFeaturesCount: 0,
      activeComponentsCount: 0,
      backgroundConnectionStatus: 'disconnected',
      compatibilityScore: 0,
      errorCount: 0,
      performanceMetrics: {
        memoryUsage: 0,
        cpuUsage: 0,
        responseTime: 0,
      },
      lastActivity: new Date(),
    };
  }

  /**
   * Update statistics
   */
  private updateStatistics(): void {
    this.statistics.state = this.state;
    this.statistics.activeFeaturesCount = this.getActiveFeatures().length;
    this.statistics.activeComponentsCount = this.getActiveComponents().length;
    this.statistics.backgroundConnectionStatus = backgroundCoordinator.getConnectionStatus();
    this.statistics.compatibilityScore = browserCompatibility.getCompatibilityLayer().compatibilityScore;
    this.statistics.errorCount = this.errorCount;
    this.statistics.lastActivity = new Date();
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(): void {
    // Estimate memory usage
    const memoryUsage = this.estimateMemoryUsage();

    // Measure response time with a simple ping
    const startTime = performance.now();
    Promise.resolve().then(() => {
      const responseTime = performance.now() - startTime;

      this.statistics.performanceMetrics = {
        memoryUsage,
        cpuUsage: 0, // Would need more sophisticated measurement
        responseTime,
      };
    });
  }

  /**
   * Estimate memory usage
   */
  private estimateMemoryUsage(): number {
    // Rough estimation based on active components and features
    const componentMemory = this.getActiveComponents().length * 1024; // 1KB per component
    const featureMemory = this.getActiveFeatures().length * 512; // 512B per feature
    const baseMemory = 10240; // 10KB base usage

    return baseMemory + componentMemory + featureMemory;
  }

  /**
   * Check if current page is supported by this extension
   */
  private isSupportedPage(): boolean {
    const currentUrl = window.location.href;

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

    // Test each pattern and log details
    const matches = supportedPatterns.map(pattern => {
      const match = pattern.test(currentUrl);
      return { pattern: pattern.source, match };
    });

    const isSupported = matches.some(m => m.match);

    // FORCE DEBUG OUTPUT - always log this
    console.log(`[ContentScript] DETAILED PAGE SUPPORT CHECK:`);
    console.log(`  URL: ${currentUrl}`);
    console.log(`  Pattern matches:`, matches);
    console.log(`  Final result: ${isSupported}`);

    return isSupported;
  }

  /**
   * Log debug message
   */
  private log(message: string): void {
    if (this.config.enableDebugLogging) {
      console.log(`[ContentScript] ${message}`);
    }
  }
}

// Create and export the main content script instance
export const contentScript = ContentScript.getInstance({
  enableDebugLogging: IS_DEV,
  autoInitialize: true,
});

// Export utility functions
export const contentScriptUtils = {
  /**
   * Get content script instance
   */
  getInstance: (config?: Partial<ContentScriptConfig>) => ContentScript.getInstance(config),

  /**
   * Initialize content script
   */
  initialize: (): Promise<void> => contentScript.initialize(),

  /**
   * Check if ready
   */
  isReady: (): boolean => contentScript.isReady(),

  /**
   * Get state
   */
  getState: (): InitializationState => contentScript.getState(),

  /**
   * Get statistics
   */
  getStats: (): ContentScriptStatistics => contentScript.getStatistics(),

  /**
   * Activate features
   */
  activateFeatures: (): Promise<void> => contentScript.activateFeatures(),

  /**
   * Get active features
   */
  getActiveFeatures: (): unknown[] => contentScript.getActiveFeatures(),

  /**
   * Get active components
   */
  getActiveComponents: (): unknown[] => contentScript.getActiveComponents(),

  /**
   * Add event listener
   */
  addEventListener: (listener: (event: ContentScriptEventData) => void): (() => void) =>
    contentScript.addEventListener(listener),

  /**
   * Shutdown
   */
  shutdown: (): Promise<void> => contentScript.shutdown(),
};

// Global exposure for debugging and testing (development mode only)
interface WindowWithDebug extends Window {
  contentScript?: unknown;
  contentScriptUtils?: unknown;
}

if (IS_DEV) {
  (window as WindowWithDebug).contentScript = contentScript;
  (window as WindowWithDebug).contentScriptUtils = contentScriptUtils;
}

// Setup message handling for background service communication
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // ONLY handle content detection, let ALL other messages pass through
  if (message.type === 'DETECT_MEETING_CONTENT') {
    console.log('[ContentScript] Handling DETECT_MEETING_CONTENT');
    // Handle content detection request
    handleContentDetection(message, sender, sendResponse);
    return true; // Keep message channel open for async response
  }

  // CRITICAL: Return false for all other messages to let background service handle them
  console.log('[ContentScript] Ignoring message type:', message.type, '- letting background handle it');
  return false;
});

/**
 * Handle content detection request from background service
 */
const handleContentDetection = async (
  message: { type: string; tabId?: number; url?: string },
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void,
) => {
  try {
    // Check if this is a supported page first
    const currentUrl = window.location.href;
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

    const isSupported = supportedPatterns.some(pattern => pattern.test(currentUrl));

    if (!isSupported) {
      sendResponse({
        success: false,
        error: 'Page type not supported by this extension',
        details: `Extension only supports SharePoint and Teams pages. Current page: ${currentUrl}`,
        pageInfo: {
          url: currentUrl,
          title: document.title,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Ensure content script is initialized
    if (!contentScript.isReady()) {
      await contentScript.initialize();
    }

    // Use content analyzer to detect meeting content
    const analysis = await contentAnalyzer.analyzeContent();

    // Debug logging for analysis results
    console.log('[ContentScript] Content analysis results:', {
      meetingConfidence: analysis.meetingConfidence,
      contentType: analysis.contentType,
      meetingIndicators: analysis.meetingIndicators,
      elements: {
        video: analysis.elements.video.length,
        audio: analysis.elements.audio.length,
        controls: analysis.elements.controls.length,
        participants: analysis.elements.participants.length,
        recording: analysis.elements.transcript.length,
      },
      context: analysis.context,
      pageUrl: window.location.href,
      pageTitle: document.title,
    });

    // Check if this is a meeting page with sufficient confidence
    if (analysis.meetingConfidence < 0.3) {
      console.log('[ContentScript] Low meeting confidence detected:', analysis.meetingConfidence);
      sendResponse({
        success: false,
        error: 'Page does not appear to contain meeting content',
        details: `Content analysis indicates low meeting confidence: ${analysis.meetingConfidence}`,
        analysis: analysis,
        debug: {
          pageUrl: window.location.href,
          pageTitle: document.title,
          meetingIndicators: analysis.meetingIndicators,
        },
      });
      return;
    }

    // Try to detect audio/video URLs using the content analyzer
    // For SharePoint pages, we need to look for Stream video URLs
    const audioUrls = await detectMediaUrls();

    if (!audioUrls || audioUrls.length === 0) {
      sendResponse({
        success: false,
        error: 'No meeting recordings found on current page',
        details: 'Could not detect any audio or video content URLs',
        analysis: analysis,
      });
      return;
    }

    // Extract meeting metadata
    const metadata = extractMeetingMetadata();

    // Convert string URLs to AudioUrlInfo format expected by message-router
    const audioUrlInfos = audioUrls.map(url => ({
      url: url,
      format: extractFormatFromUrl(url),
      quality: 'unknown',
      size: undefined,
      duration: undefined,
    }));

    console.log('[ContentScript] Converted audio URLs:', audioUrlInfos);

    // Success response
    sendResponse({
      success: true,
      audioUrls: audioUrlInfos,
      metadata: metadata,
      analysis: analysis,
      pageInfo: {
        url: window.location.href,
        title: document.title,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[ContentScript] Content detection error:', error);

    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      details: 'Exception thrown during content detection',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
};

/**
 * Detect media URLs on the current page
 */
const detectMediaUrls = async (): Promise<string[]> => {
  const mediaUrls: string[] = [];

  try {
    console.log('[ContentScript] Starting media URL detection for:', window.location.href);

    // Check if this is a SharePoint page and use specialized handler
    const isSharePointPage =
      window.location.hostname.includes('sharepoint.com') ||
      window.location.href.includes('sharepoint') ||
      document.querySelector('[data-sp-feature-tag]') !== null;

    if (isSharePointPage) {
      console.log('[ContentScript] SharePoint page detected, using SharePoint handler');

      try {
        const sharePointHandler = new SharePointPageHandler();
        const integrationContext = await sharePointHandler.initialize();

        if (integrationContext && integrationContext.availableContent.length > 0) {
          console.log('[ContentScript] SharePoint handler found content:', integrationContext.availableContent);

          // Extract URLs from SharePoint handler results
          integrationContext.availableContent.forEach(content => {
            if (content.location && !mediaUrls.includes(content.location)) {
              mediaUrls.push(content.location);
              console.log('[ContentScript] Added SharePoint URL:', content.location);
            }
          });
        } else {
          console.log('[ContentScript] SharePoint handler found no content, falling back to direct detection');
        }

        // Get recordings directly from SharePoint handler
        const recordings = sharePointHandler.getMeetingRecordings();
        recordings.forEach(recording => {
          if (recording.url && !mediaUrls.includes(recording.url)) {
            mediaUrls.push(recording.url);
            console.log('[ContentScript] Added recording URL:', recording.url);
          }
        });

        // Cleanup handler
        sharePointHandler.cleanup();
      } catch (sharePointError) {
        console.error('[ContentScript] SharePoint handler error:', sharePointError);
        console.log('[ContentScript] Falling back to generic detection');
      }
    }

    // If SharePoint detection failed or found nothing, use fallback detection
    if (mediaUrls.length === 0) {
      console.log('[ContentScript] Using fallback media detection');

      // Strategy 1: Look for video/audio elements
      const videoElements = document.querySelectorAll('video[src], video source[src]');
      videoElements.forEach(element => {
        const src = element.getAttribute('src');
        if (src && (src.includes('.mp4') || src.includes('.webm') || src.includes('stream'))) {
          mediaUrls.push(src);
          console.log('[ContentScript] Added video element URL:', src);
        }
      });

      const audioElements = document.querySelectorAll('audio[src], audio source[src]');
      audioElements.forEach(element => {
        const src = element.getAttribute('src');
        if (src && (src.includes('.mp3') || src.includes('.wav') || src.includes('.m4a'))) {
          mediaUrls.push(src);
          console.log('[ContentScript] Added audio element URL:', src);
        }
      });

      // Strategy 2: For SharePoint Stream pages, extract direct media URLs
      if (isSharePointPage && window.location.href.includes('stream.aspx')) {
        const directMediaUrls = extractSharePointDirectMediaUrls();
        directMediaUrls.forEach(url => {
          if (!mediaUrls.includes(url)) {
            mediaUrls.push(url);
            console.log('[ContentScript] Added SharePoint direct media URL:', url);
          }
        });

        // Fallback: If no direct URLs found, try to construct download URL from page URL
        if (directMediaUrls.length === 0) {
          const constructedUrl = constructSharePointDirectUrl(window.location.href);
          if (constructedUrl) {
            mediaUrls.push(constructedUrl);
            console.log('[ContentScript] Added constructed SharePoint URL:', constructedUrl);
          }
        }
      }

      // Strategy 3: Look for SharePoint-specific patterns in JavaScript
      const scripts = document.querySelectorAll('script');
      scripts.forEach(script => {
        if (script.textContent) {
          const streamMatches = script.textContent.match(/https:\/\/[^"'\s]*\.mp4[^"'\s]*/g);
          if (streamMatches) {
            streamMatches.forEach(url => {
              if (!mediaUrls.includes(url)) {
                mediaUrls.push(url);
                console.log('[ContentScript] Added script URL:', url);
              }
            });
          }
        }
      });

      // Strategy 4: Look for data attributes
      const mediaInputs = document.querySelectorAll('[data-video-url], [data-audio-url], [data-stream-url]');
      mediaInputs.forEach(element => {
        const videoUrl = element.getAttribute('data-video-url');
        const audioUrl = element.getAttribute('data-audio-url');
        const streamUrl = element.getAttribute('data-stream-url');

        if (videoUrl && !mediaUrls.includes(videoUrl)) {
          mediaUrls.push(videoUrl);
          console.log('[ContentScript] Added data-video-url:', videoUrl);
        }
        if (audioUrl && !mediaUrls.includes(audioUrl)) {
          mediaUrls.push(audioUrl);
          console.log('[ContentScript] Added data-audio-url:', audioUrl);
        }
        if (streamUrl && !mediaUrls.includes(streamUrl)) {
          mediaUrls.push(streamUrl);
          console.log('[ContentScript] Added data-stream-url:', streamUrl);
        }
      });
    }

    console.log('[ContentScript] Final media URLs detected:', mediaUrls);
    return mediaUrls;
  } catch (error) {
    console.error('[ContentScript] Error detecting media URLs:', error);
    return [];
  }
};

/**
 * Extract direct media URLs from SharePoint Stream pages
 */
const extractSharePointDirectMediaUrls = (): string[] => {
  const directUrls: string[] = [];

  console.log('[ContentScript] Extracting direct media URLs from SharePoint Stream page...');

  // Strategy 1: Check video element sources
  const videoElements = document.querySelectorAll('video');
  videoElements.forEach((video, index) => {
    console.log(`[ContentScript] Video element ${index}:`, {
      src: video.src,
      currentSrc: video.currentSrc,
      tagName: video.tagName,
    });

    // Check for direct media URLs (not blob URLs)
    if (video.src && !video.src.startsWith('blob:') && !video.src.startsWith('data:')) {
      directUrls.push(video.src);
      console.log('[ContentScript] Found direct video src:', video.src);
    }

    if (video.currentSrc && !video.currentSrc.startsWith('blob:') && !video.currentSrc.startsWith('data:')) {
      directUrls.push(video.currentSrc);
      console.log('[ContentScript] Found direct video currentSrc:', video.currentSrc);
    }

    // Check source elements within video
    const sources = video.querySelectorAll('source');
    sources.forEach(source => {
      const src = source.getAttribute('src');
      if (src && !src.startsWith('blob:') && !src.startsWith('data:')) {
        directUrls.push(src);
        console.log('[ContentScript] Found source element URL:', src);
      }
    });
  });

  // Strategy 2: Look for hidden inputs with media URLs
  const hiddenInputs = document.querySelectorAll('input[type="hidden"]');
  hiddenInputs.forEach(input => {
    const value = input.value;
    if (value && (value.includes('.mp4') || value.includes('.wav') || value.includes('.mp3'))) {
      if (value.startsWith('http')) {
        directUrls.push(value);
        console.log('[ContentScript] Found URL in hidden input:', value);
      }
    }
  });

  // Strategy 3: Search for media URLs in data attributes
  const elementsWithData = document.querySelectorAll('[data-video-url], [data-media-url], [data-stream-url]');
  elementsWithData.forEach(element => {
    const videoUrl = element.getAttribute('data-video-url');
    const mediaUrl = element.getAttribute('data-media-url');
    const streamUrl = element.getAttribute('data-stream-url');

    [videoUrl, mediaUrl, streamUrl].forEach(url => {
      if (url && url.startsWith('http') && !url.includes('stream.aspx')) {
        directUrls.push(url);
        console.log('[ContentScript] Found URL in data attribute:', url);
      }
    });
  });

  // Strategy 4: Parse JavaScript variables for media URLs
  const scripts = document.querySelectorAll('script:not([src])');
  scripts.forEach(script => {
    const content = script.textContent || '';

    // Look for common SharePoint media URL patterns
    const mediaUrlPatterns = [
      /["']https:\/\/[^"'\s]*\.mp4[^"'\s]*["']/g,
      /["']https:\/\/[^"'\s]*\.wav[^"'\s]*["']/g,
      /["']https:\/\/[^"'\s]*\.mp3[^"'\s]*["']/g,
      /videoUrl\s*:\s*["']([^"']+)["']/g,
      /mediaUrl\s*:\s*["']([^"']+)["']/g,
      /downloadUrl\s*:\s*["']([^"']+)["']/g,
    ];

    mediaUrlPatterns.forEach(pattern => {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        let url = match[1] || match[0];
        // Remove quotes
        url = url.replace(/^["']|["']$/g, '');

        if (url.startsWith('http') && !url.includes('stream.aspx')) {
          directUrls.push(url);
          console.log('[ContentScript] Found URL in script:', url);
        }
      }
    });
  });

  // Remove duplicates
  const uniqueUrls = [...new Set(directUrls)];
  console.log('[ContentScript] Extracted direct media URLs:', uniqueUrls);

  return uniqueUrls;
};

/**
 * Construct direct download URL from SharePoint Stream page URL
 */
const constructSharePointDirectUrl = (pageUrl: string): string | null => {
  try {
    console.log('[ContentScript] Attempting to construct direct URL from:', pageUrl);

    const url = new URL(pageUrl);
    const idParam = url.searchParams.get('id');

    if (!idParam) {
      console.log('[ContentScript] No id parameter found in URL');
      return null;
    }

    console.log('[ContentScript] Found id parameter:', idParam);

    // SharePoint direct download URL pattern: Replace _layouts/15/stream.aspx with direct file path
    // Original: https://tenant.sharepoint.com/_layouts/15/stream.aspx?id=/path/to/file.mp4
    // Direct:   https://tenant.sharepoint.com/path/to/file.mp4

    const baseUrl = `${url.protocol}//${url.hostname}`;
    const directPath = idParam.startsWith('/') ? idParam : `/${idParam}`;
    const directUrl = `${baseUrl}${directPath}`;

    console.log('[ContentScript] Constructed direct URL:', directUrl);

    // Verify it looks like a media file
    if (directUrl.match(/\.(mp4|wav|mp3|webm)$/i)) {
      return directUrl;
    } else {
      console.log('[ContentScript] Constructed URL does not appear to be a media file');
      return null;
    }
  } catch (error) {
    console.error('[ContentScript] Error constructing direct URL:', error);
    return null;
  }
};

/**
 * Extract format from URL
 */
const extractFormatFromUrl = (url: string): string => {
  if (url.includes('.mp4')) return 'mp4';
  if (url.includes('.mp3')) return 'mp3';
  if (url.includes('.wav')) return 'wav';
  if (url.includes('.webm')) return 'webm';
  if (url.includes('stream.aspx') || url.includes('stream')) return 'stream';
  return 'unknown';
};

/**
 * Extract meeting metadata from the current page
 */
const extractMeetingMetadata = (): Record<string, unknown> => {
  const metadata: Record<string, unknown> = {
    title: document.title,
    url: window.location.href,
    timestamp: new Date().toISOString(),
  };

  try {
    // Try to extract meeting title from page content
    const titleSelectors = ['h1', '[data-automation-id="pageTitle"]', '.ms-DocumentCard-title', '[role="heading"]'];

    for (const selector of titleSelectors) {
      const titleElement = document.querySelector(selector);
      if (titleElement && titleElement.textContent) {
        metadata.meetingTitle = titleElement.textContent.trim();
        break;
      }
    }

    // Try to extract date information
    const dateElements = document.querySelectorAll('[data-automation-id*="date"], .ms-DatePicker, time');
    dateElements.forEach(element => {
      if (element.textContent && element.textContent.match(/\d{1,2}\/\d{1,2}\/\d{4}/)) {
        metadata.meetingDate = element.textContent.trim();
      }
    });

    // Try to extract participant information
    const participantElements = document.querySelectorAll(
      '[data-automation-id*="participant"], .ms-Persona-primaryText',
    );
    const participants: string[] = [];
    participantElements.forEach(element => {
      if (element.textContent) {
        participants.push(element.textContent.trim());
      }
    });
    if (participants.length > 0) {
      metadata.participants = participants;
    }
  } catch (error) {
    console.error('[ContentScript] Error extracting metadata:', error);
  }

  return metadata;
};

// Automatic cleanup on page unload
window.addEventListener('beforeunload', () => {
  contentScript.shutdown().catch(error => {
    console.error('Content script shutdown error:', error);
  });
});
