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
// Unused imports commented out for now
// import { injectionController } from './injection/injection-controller';
import { pageMonitor } from './pages/page-monitor';
import { pageRouter } from './pages/page-router';
// import { domManipulator } from './utils/dom-utils';
import { eventManager } from './utils/event-manager';
// import { mutationObserver } from './utils/mutation-observer';

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

    // Initialize page monitor
    pageMonitor.startMonitoring({
      enableNavigationDetection: true,
      enableContentChangeDetection: true,
    });

    // Setup page change handler
    const unsubscribe = pageMonitor.onPageChange(change => {
      this.log(`Page change detected: ${change.type}`);

      // Re-analyze content on significant changes
      if (change.severity === 'major') {
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
   * Log debug message
   */
  private log(message: string): void {
    if (this.config.enableDebugLogging) {
    }
  }
}

// Create and export the main content script instance
export const contentScript = ContentScript.getInstance({
  enableDebugLogging: process.env.NODE_ENV === 'development',
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

// Global exposure for debugging in development
if (process.env.NODE_ENV === 'development') {
  interface WindowWithDebug extends Window {
    contentScript?: unknown;
    contentScriptUtils?: unknown;
  }
  (window as WindowWithDebug).contentScript = contentScript;
  (window as WindowWithDebug).contentScriptUtils = contentScriptUtils;
}

// Setup message handling for background service communication
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.type === 'DETECT_MEETING_CONTENT') {
    // Handle content detection request
    handleContentDetection(message, sender, sendResponse);
    return true; // Keep message channel open for async response
  }

  // Handle other message types if needed
  return false;
});

/**
 * Handle content detection request from background service
 */
async function handleContentDetection(message: any, sender: any, sendResponse: (response: any) => void) {
  try {

    // Ensure content script is initialized
    if (!contentScript.isReady()) {
      await contentScript.initialize();
    }

    // Use content analyzer to detect meeting content
    const analysis = await contentAnalyzer.analyzeContent();


    // Check if this is a meeting page with sufficient confidence
    if (analysis.meetingConfidence < 0.3) {
      sendResponse({
        success: false,
        error: 'Page does not appear to contain meeting content',
        details: 'Content analysis indicates low meeting confidence',
        analysis: analysis,
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

    // Success response
    sendResponse({
      success: true,
      audioUrls: audioUrls,
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
}

/**
 * Detect media URLs on the current page
 */
async function detectMediaUrls(): Promise<string[]> {
  const mediaUrls: string[] = [];

  try {
    // Look for SharePoint Stream video URLs
    const videoElements = document.querySelectorAll('video[src], video source[src]');
    videoElements.forEach(element => {
      const src = element.getAttribute('src');
      if (src && (src.includes('.mp4') || src.includes('.webm') || src.includes('stream'))) {
        mediaUrls.push(src);
      }
    });

    // Look for audio elements
    const audioElements = document.querySelectorAll('audio[src], audio source[src]');
    audioElements.forEach(element => {
      const src = element.getAttribute('src');
      if (src && (src.includes('.mp3') || src.includes('.wav') || src.includes('.m4a'))) {
        mediaUrls.push(src);
      }
    });

    // Look for SharePoint-specific patterns in the page
    const scripts = document.querySelectorAll('script');
    scripts.forEach(script => {
      if (script.textContent) {
        // Look for Stream URLs in JavaScript
        const streamMatches = script.textContent.match(/https:\/\/[^"'\s]*\.mp4[^"'\s]*/g);
        if (streamMatches) {
          streamMatches.forEach(url => {
            if (!mediaUrls.includes(url)) {
              mediaUrls.push(url);
            }
          });
        }
      }
    });

    // Look for data attributes and hidden inputs that might contain media URLs
    const mediaInputs = document.querySelectorAll('[data-video-url], [data-audio-url], [data-stream-url]');
    mediaInputs.forEach(element => {
      const videoUrl = element.getAttribute('data-video-url');
      const audioUrl = element.getAttribute('data-audio-url');
      const streamUrl = element.getAttribute('data-stream-url');

      if (videoUrl && !mediaUrls.includes(videoUrl)) mediaUrls.push(videoUrl);
      if (audioUrl && !mediaUrls.includes(audioUrl)) mediaUrls.push(audioUrl);
      if (streamUrl && !mediaUrls.includes(streamUrl)) mediaUrls.push(streamUrl);
    });

    return mediaUrls;
  } catch (error) {
    console.error('[ContentScript] Error detecting media URLs:', error);
    return [];
  }
}

/**
 * Extract meeting metadata from the current page
 */
function extractMeetingMetadata(): any {
  const metadata: any = {
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
}

// Automatic cleanup on page unload
window.addEventListener('beforeunload', () => {
  contentScript.shutdown().catch(error => {
    console.error('Content script shutdown error:', error);
  });
});
