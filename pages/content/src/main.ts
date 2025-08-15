/**
 * Content Script Main
 *
 * Main content script initialization and coordination entry point.
 * Orchestrates all content script functionality including page detection,
 * compatibility management, and background service communication.
 */

import { permissionChecker } from './analysis/permission-checker';
import { backgroundCoordinator } from './communication/background-coordinator';
import { compatibilityManager } from './compatibility/compatibility-manager';
import { loadingManager } from './features/loading-manager';
import { pageRouter } from './pages/page-router';
import { eventManager } from './utils/event-manager';
import { mutationObserver } from './utils/mutation-observer';
import type { PageIntegrationContext } from './types/page-integration';

/**
 * Main initialization state
 */
export type MainInitializationState =
  | 'uninitialized'
  | 'compatibility-check'
  | 'permission-check'
  | 'page-analysis'
  | 'service-connection'
  | 'feature-activation'
  | 'initialized'
  | 'error'
  | 'shutdown';

/**
 * Main configuration options
 */
export interface MainConfig {
  /** Auto-initialize on load */
  autoInitialize: boolean;
  /** Enable debug logging */
  debug: boolean;
  /** Initialization timeout (ms) */
  timeout: number;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Performance monitoring */
  performanceMonitoring: boolean;
  /** Error reporting */
  errorReporting: boolean;
  /** Graceful degradation */
  gracefulDegradation: boolean;
  /** Feature priorities */
  featurePriorities: Record<string, number>;
  /** Compatibility requirements */
  compatibilityRequirements: {
    minBrowserScore: number;
    requiredFeatures: string[];
    optionalFeatures: string[];
  };
}

/**
 * Initialization result
 */
export interface InitializationResult {
  /** Initialization success */
  success: boolean;
  /** Current state */
  state: MainInitializationState;
  /** Integration context */
  context: PageIntegrationContext | null;
  /** Error information */
  error?: InitializationError;
  /** Performance metrics */
  metrics: InitializationMetrics;
  /** Enabled features */
  enabledFeatures: string[];
  /** Warning messages */
  warnings: string[];
}

/**
 * Initialization error
 */
export interface InitializationError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Error type */
  type: 'compatibility' | 'permission' | 'network' | 'timeout' | 'unknown';
  /** Error details */
  details: unknown;
  /** Recovery suggestions */
  suggestions: string[];
  /** Retry possible */
  retryable: boolean;
}

/**
 * Initialization metrics
 */
export interface InitializationMetrics {
  /** Total initialization time */
  totalTime: number;
  /** Compatibility check time */
  compatibilityTime: number;
  /** Permission check time */
  permissionTime: number;
  /** Page analysis time */
  pageAnalysisTime: number;
  /** Service connection time */
  serviceConnectionTime: number;
  /** Feature activation time */
  featureActivationTime: number;
  /** Memory usage */
  memoryUsage: number;
  /** Errors encountered */
  errorCount: number;
  /** Retries performed */
  retryCount: number;
}

/**
 * Content script event data
 */
export interface ContentScriptEventData {
  /** Event type */
  type: string;
  /** Event source */
  source: 'main' | 'page-router' | 'background' | 'compatibility' | 'features';
  /** Event payload */
  payload: unknown;
  /** Timestamp */
  timestamp: Date;
  /** Context information */
  context?: PageIntegrationContext;
}

/**
 * Main content script coordinator
 */
export class ContentScriptMain {
  private state: MainInitializationState = 'uninitialized';
  private config: MainConfig;
  private context: PageIntegrationContext | null = null;
  private retryCount = 0;
  private initializationStartTime = 0;
  private metrics: InitializationMetrics;
  private enabledFeatures: Set<string> = new Set();
  private cleanupHandlers: Set<() => void> = new Set();
  private errorHandlers: Map<string, (error: unknown) => void> = new Map();

  constructor(config?: Partial<MainConfig>) {
    this.config = this.buildConfig(config);
    this.metrics = this.createInitializationMetrics();

    this.setupErrorHandlers();
    this.setupEventHandlers();

    if (this.config.autoInitialize) {
      this.initialize();
    }
  }

  /**
   * Initialize the content script system
   */
  async initialize(): Promise<InitializationResult> {
    this.initializationStartTime = performance.now();
    const operationId = loadingManager.startOperation({
      type: 'content-analysis',
      description: 'Initializing content script system',
      estimatedDuration: this.config.timeout,
    });

    try {
      this.setState('compatibility-check');
      await this.performCompatibilityCheck(operationId);

      this.setState('permission-check');
      await this.performPermissionCheck(operationId);

      this.setState('page-analysis');
      await this.performPageAnalysis(operationId);

      this.setState('service-connection');
      await this.establishServiceConnection(operationId);

      this.setState('feature-activation');
      await this.activateFeatures(operationId);

      this.setState('initialized');
      loadingManager.completeOperation(operationId, { success: true });

      const result = this.createInitializationResult(true);
      this.emitEvent('initialized', result);

      return result;
    } catch (error) {
      this.setState('error');
      loadingManager.failOperation(operationId, {
        code: 'INITIALIZATION_FAILED',
        message: (error as Error).message,
        type: 'processing',
        originalError: error as Error,
      });

      const result = this.createInitializationResult(false, error as Error);

      if (this.shouldRetry(error as Error)) {
        this.log('Retrying initialization...', 'warn');
        return this.retryInitialization();
      }

      this.emitEvent('initialization-failed', result);
      return result;
    }
  }

  /**
   * Shutdown the content script system
   */
  async shutdown(): Promise<void> {
    this.setState('shutdown');

    try {
      // Stop all operations
      await loadingManager.cancelAllOperations();

      // Cleanup features
      this.cleanupFeatures();

      // Disconnect from background service
      await backgroundCoordinator.disconnect();

      // Cleanup compatibility manager
      compatibilityManager.cleanup();

      // Cleanup page monitoring
      pageRouter.cleanup();

      // Run cleanup handlers
      this.cleanupHandlers.forEach(handler => {
        try {
          handler();
        } catch (error) {
          this.log(`Cleanup handler error: ${error}`, 'warn');
        }
      });

      this.cleanupHandlers.clear();

      this.emitEvent('shutdown', { timestamp: new Date() });
    } catch (error) {
      this.log(`Shutdown error: ${error}`, 'error');
    }
  }

  /**
   * Get current initialization state
   */
  getState(): MainInitializationState {
    return this.state;
  }

  /**
   * Get current integration context
   */
  getContext(): PageIntegrationContext | null {
    return this.context;
  }

  /**
   * Get initialization metrics
   */
  getMetrics(): InitializationMetrics {
    return { ...this.metrics };
  }

  /**
   * Get enabled features
   */
  getEnabledFeatures(): string[] {
    return Array.from(this.enabledFeatures);
  }

  /**
   * Check if feature is enabled
   */
  isFeatureEnabled(feature: string): boolean {
    return this.enabledFeatures.has(feature);
  }

  /**
   * Add cleanup handler
   */
  addCleanupHandler(handler: () => void): void {
    this.cleanupHandlers.add(handler);
  }

  /**
   * Remove cleanup handler
   */
  removeCleanupHandler(handler: () => void): void {
    this.cleanupHandlers.delete(handler);
  }

  /**
   * Private implementation methods
   */

  private async performCompatibilityCheck(operationId: string): Promise<void> {
    const startTime = performance.now();

    try {
      loadingManager.updateProgress(operationId, 20, {
        name: 'Compatibility Check',
        description: 'Checking browser compatibility',
      });

      // Initialize compatibility manager
      await compatibilityManager.initialize();

      // Get compatibility report
      const report = compatibilityManager.getSession().compatibilityReport;

      // Check minimum requirements
      if (report.score < this.config.compatibilityRequirements.minBrowserScore) {
        throw new Error(
          `Browser compatibility score ${report.score} below minimum ${this.config.compatibilityRequirements.minBrowserScore}`,
        );
      }

      // Check required features
      const unsupportedRequired = this.config.compatibilityRequirements.requiredFeatures.filter(
        feature => !compatibilityManager.checkFeatureCompatibility(feature).supportLevel,
      );

      if (unsupportedRequired.length > 0) {
        throw new Error(`Required features not supported: ${unsupportedRequired.join(', ')}`);
      }

      this.metrics.compatibilityTime = performance.now() - startTime;
      this.log('Compatibility check completed', 'info');
    } catch (error) {
      this.metrics.compatibilityTime = performance.now() - startTime;
      this.metrics.errorCount++;
      throw new Error(`Compatibility check failed: ${(error as Error).message}`);
    }
  }

  private async performPermissionCheck(operationId: string): Promise<void> {
    const startTime = performance.now();

    try {
      loadingManager.updateProgress(operationId, 40, {
        name: 'Permission Check',
        description: 'Checking user permissions',
      });

      // Perform basic permission evaluation
      const userRole = await permissionChecker.evaluateUserRole();

      // Check if user has basic access
      if (userRole.primary === 'unknown' || userRole.restrictions.includes('no-access')) {
        throw new Error('User does not have sufficient permissions');
      }

      this.metrics.permissionTime = performance.now() - startTime;
      this.log('Permission check completed', 'info');
    } catch (error) {
      this.metrics.permissionTime = performance.now() - startTime;
      this.metrics.errorCount++;

      if (this.config.gracefulDegradation) {
        this.log(`Permission check warning: ${(error as Error).message}`, 'warn');
      } else {
        throw new Error(`Permission check failed: ${(error as Error).message}`);
      }
    }
  }

  private async performPageAnalysis(operationId: string): Promise<void> {
    const startTime = performance.now();

    try {
      loadingManager.updateProgress(operationId, 60, {
        name: 'Page Analysis',
        description: 'Analyzing page content and structure',
      });

      // Initialize page router and analyze page
      this.context = await pageRouter.initializePageIntegration();

      if (!this.context) {
        throw new Error('Failed to create page integration context');
      }

      // Start page monitoring
      pageRouter.startMonitoring();

      this.metrics.pageAnalysisTime = performance.now() - startTime;
      this.log('Page analysis completed', 'info');
    } catch (error) {
      this.metrics.pageAnalysisTime = performance.now() - startTime;
      this.metrics.errorCount++;
      throw new Error(`Page analysis failed: ${(error as Error).message}`);
    }
  }

  private async establishServiceConnection(operationId: string): Promise<void> {
    const startTime = performance.now();

    try {
      loadingManager.updateProgress(operationId, 80, {
        name: 'Service Connection',
        description: 'Connecting to background service',
      });

      // Connect to background service
      await backgroundCoordinator.connect();

      // Verify connection
      if (!backgroundCoordinator.isConnected()) {
        throw new Error('Failed to establish background service connection');
      }

      this.metrics.serviceConnectionTime = performance.now() - startTime;
      this.log('Service connection established', 'info');
    } catch (error) {
      this.metrics.serviceConnectionTime = performance.now() - startTime;
      this.metrics.errorCount++;

      if (this.config.gracefulDegradation) {
        this.log(`Service connection warning: ${(error as Error).message}`, 'warn');
      } else {
        throw new Error(`Service connection failed: ${(error as Error).message}`);
      }
    }
  }

  private async activateFeatures(operationId: string): Promise<void> {
    const startTime = performance.now();

    try {
      loadingManager.updateProgress(operationId, 95, {
        name: 'Feature Activation',
        description: 'Activating content script features',
      });

      if (!this.context) {
        throw new Error('No page context available for feature activation');
      }

      // Activate features based on context and permissions
      const availableFeatures = this.determineAvailableFeatures();

      for (const feature of availableFeatures) {
        try {
          const success = await this.activateFeature(feature);
          if (success) {
            this.enabledFeatures.add(feature);
            this.log(`Feature activated: ${feature}`, 'info');
          }
        } catch (error) {
          this.log(`Feature activation failed: ${feature} - ${error}`, 'warn');
          this.metrics.errorCount++;
        }
      }

      this.metrics.featureActivationTime = performance.now() - startTime;
      this.log(`Feature activation completed: ${this.enabledFeatures.size} features enabled`, 'info');
    } catch (error) {
      this.metrics.featureActivationTime = performance.now() - startTime;
      this.metrics.errorCount++;
      throw new Error(`Feature activation failed: ${(error as Error).message}`);
    }
  }

  private determineAvailableFeatures(): string[] {
    const features: string[] = [];

    // Core features
    features.push('page-monitoring', 'content-analysis');

    // Context-dependent features
    if (this.context?.availableContent.length > 0) {
      features.push('meeting-detection', 'content-extraction');
    }

    // Permission-dependent features
    if (this.context?.userPermissions.pagePermissions.canAccessMeetings) {
      features.push('transcription-controls', 'meeting-summary');
    }

    // Browser-dependent features
    const compatibility = compatibilityManager.getCompatibilityReport();
    if (compatibility.score >= 80) {
      features.push('advanced-ui', 'performance-monitoring');
    }

    return features;
  }

  private async activateFeature(feature: string): Promise<boolean> {
    try {
      switch (feature) {
        case 'page-monitoring':
          return this.activatePageMonitoring();
        case 'content-analysis':
          return this.activateContentAnalysis();
        case 'meeting-detection':
          return this.activateMeetingDetection();
        case 'transcription-controls':
          return this.activateTranscriptionControls();
        default:
          this.log(`Unknown feature: ${feature}`, 'warn');
          return false;
      }
    } catch (error) {
      this.log(`Feature activation error [${feature}]: ${error}`, 'error');
      return false;
    }
  }

  private activatePageMonitoring(): boolean {
    try {
      // Setup mutation observation
      mutationObserver.startMonitoring();

      // Setup page change detection
      pageRouter.onPageChange(newContext => {
        this.handlePageChange(newContext);
      });

      return true;
    } catch (error) {
      this.log(`Page monitoring activation failed: ${error}`, 'error');
      return false;
    }
  }

  private activateContentAnalysis(): boolean {
    try {
      // Setup content analysis event handlers
      eventManager.addEventHandler('content-detected', event => {
        this.handleContentDetected(event);
      });

      return true;
    } catch (error) {
      this.log(`Content analysis activation failed: ${error}`, 'error');
      return false;
    }
  }

  private activateMeetingDetection(): boolean {
    try {
      // Enable meeting detection features
      if (this.context) {
        // Setup meeting content monitoring
        this.context.availableContent.forEach(content => {
          this.log(`Meeting content detected: ${content.title}`, 'info');
        });
      }

      return true;
    } catch (error) {
      this.log(`Meeting detection activation failed: ${error}`, 'error');
      return false;
    }
  }

  private activateTranscriptionControls(): boolean {
    try {
      // Activate transcription UI components
      // This would integrate with the injection controller
      // and component registry to show transcription controls

      return true;
    } catch (error) {
      this.log(`Transcription controls activation failed: ${error}`, 'error');
      return false;
    }
  }

  private handlePageChange(newContext: PageIntegrationContext): void {
    this.log('Page change detected, updating context', 'info');
    this.context = newContext;

    // Re-evaluate features for new context
    this.reevaluateFeatures();

    this.emitEvent('page-changed', { context: newContext });
  }

  private handleContentDetected(event: { content?: unknown }): void {
    this.log('New content detected', 'info');

    // Update context with new content
    if (this.context && event.content && this.isValidMeetingContent(event.content)) {
      this.context.availableContent.push(event.content);
    }

    this.emitEvent('content-detected', event);
  }

  private reevaluateFeatures(): void {
    // Re-evaluate which features should be enabled
    const availableFeatures = this.determineAvailableFeatures();
    const currentFeatures = Array.from(this.enabledFeatures);

    // Disable features no longer available
    currentFeatures.forEach(feature => {
      if (!availableFeatures.includes(feature)) {
        this.disableFeature(feature);
      }
    });

    // Enable new features
    availableFeatures.forEach(feature => {
      if (!this.enabledFeatures.has(feature)) {
        this.activateFeature(feature).then(success => {
          if (success) {
            this.enabledFeatures.add(feature);
          }
        });
      }
    });
  }

  private disableFeature(feature: string): void {
    this.enabledFeatures.delete(feature);
    this.log(`Feature disabled: ${feature}`, 'info');
  }

  private cleanupFeatures(): void {
    this.enabledFeatures.forEach(feature => {
      this.disableFeature(feature);
    });
  }

  private shouldRetry(error: Error): boolean {
    return (
      this.retryCount < this.config.maxRetries &&
      !error.message.includes('permission') &&
      !error.message.includes('compatibility')
    );
  }

  private async retryInitialization(): Promise<InitializationResult> {
    this.retryCount++;
    this.metrics.retryCount = this.retryCount;

    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, 1000 * this.retryCount));

    return this.initialize();
  }

  private setState(newState: MainInitializationState): void {
    const oldState = this.state;
    this.state = newState;

    this.log(`State transition: ${oldState} -> ${newState}`, 'debug');
    this.emitEvent('state-changed', { oldState, newState });
  }

  private createInitializationResult(success: boolean, error?: Error): InitializationResult {
    this.updateMetrics();

    return {
      success,
      state: this.state,
      context: this.context,
      error: error ? this.createInitializationError(error) : undefined,
      metrics: this.metrics,
      enabledFeatures: this.getEnabledFeatures(),
      warnings: this.collectWarnings(),
    };
  }

  private createInitializationError(error: Error): InitializationError {
    return {
      code: 'INIT_ERROR',
      message: error.message,
      type: this.categorizeError(error),
      details: error,
      suggestions: this.generateErrorSuggestions(error),
      retryable: this.shouldRetry(error),
    };
  }

  private categorizeError(error: Error): InitializationError['type'] {
    const message = error.message.toLowerCase();

    if (message.includes('compatibility') || message.includes('browser')) {
      return 'compatibility';
    } else if (message.includes('permission') || message.includes('access')) {
      return 'permission';
    } else if (message.includes('network') || message.includes('connection')) {
      return 'network';
    } else if (message.includes('timeout')) {
      return 'timeout';
    } else {
      return 'unknown';
    }
  }

  private generateErrorSuggestions(error: Error): string[] {
    const suggestions: string[] = [];
    const message = error.message.toLowerCase();

    if (message.includes('compatibility')) {
      suggestions.push('Try using a different browser', 'Update your browser to the latest version');
    } else if (message.includes('permission')) {
      suggestions.push('Check page permissions', 'Try refreshing the page');
    } else if (message.includes('network')) {
      suggestions.push('Check your internet connection', 'Try again later');
    } else {
      suggestions.push('Try refreshing the page', 'Contact support if the problem persists');
    }

    return suggestions;
  }

  private collectWarnings(): string[] {
    const warnings: string[] = [];

    if (this.metrics.errorCount > 0) {
      warnings.push(`${this.metrics.errorCount} errors occurred during initialization`);
    }

    if (this.metrics.retryCount > 0) {
      warnings.push(`Initialization required ${this.metrics.retryCount} retries`);
    }

    const compatibility = compatibilityManager.getCompatibilityReport();
    if (compatibility.level !== 'excellent') {
      warnings.push(`Browser compatibility: ${compatibility.level}`);
    }

    return warnings;
  }

  private updateMetrics(): void {
    this.metrics.totalTime = performance.now() - this.initializationStartTime;

    // Estimate memory usage
    if ('memory' in performance) {
      this.metrics.memoryUsage = (performance as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize;
    }
  }

  private createInitializationMetrics(): InitializationMetrics {
    return {
      totalTime: 0,
      compatibilityTime: 0,
      permissionTime: 0,
      pageAnalysisTime: 0,
      serviceConnectionTime: 0,
      featureActivationTime: 0,
      memoryUsage: 0,
      errorCount: 0,
      retryCount: 0,
    };
  }

  private setupErrorHandlers(): void {
    // Global error handler
    this.errorHandlers.set('global', error => {
      this.log(`Global error: ${error}`, 'error');
      this.metrics.errorCount++;
    });

    // Setup error event listeners
    window.addEventListener('error', this.errorHandlers.get('global')!);
    window.addEventListener('unhandledrejection', event => {
      this.errorHandlers.get('global')!(event.reason);
    });
  }

  private setupEventHandlers(): void {
    // Background service events
    eventManager.addEventHandler('background-disconnected', () => {
      this.log('Background service disconnected', 'warn');
      if (this.state === 'initialized') {
        this.handleServiceDisconnection();
      }
    });

    // Compatibility events
    eventManager.addEventHandler('compatibility-error', event => {
      this.log(`Compatibility error: ${event.error.message}`, 'warn');
    });

    // Page events
    eventManager.addEventHandler('page-navigation', () => {
      this.log('Page navigation detected', 'info');
    });
  }

  private handleServiceDisconnection(): void {
    this.log('Attempting to reconnect to background service', 'info');

    // Try to reconnect
    backgroundCoordinator.reconnect().catch(error => {
      this.log(`Reconnection failed: ${error}`, 'error');
    });
  }

  private emitEvent(type: string, data: unknown): void {
    const eventData: ContentScriptEventData = {
      type,
      source: 'main',
      payload: data,
      timestamp: new Date(),
      ...(this.context && { context: this.context }),
    };

    eventManager.emitEvent(`content-script-${type}`, eventData);
  }

  private log(message: string, level: 'debug' | 'info' | 'warn' | 'error' = 'info'): void {
    if (!this.config.debug && level === 'debug') return;

    const prefix = '[ContentScript]';
    const timestamp = new Date().toISOString();
    const logMessage = `${prefix} ${timestamp} [${level.toUpperCase()}] ${message}`;

    switch (level) {
      case 'debug':
        console.debug(logMessage);
        break;
      case 'info':
        console.info(logMessage);
        break;
      case 'warn':
        console.warn(logMessage);
        break;
      case 'error':
        console.error(logMessage);
        break;
    }
  }

  private isValidMeetingContent(content: unknown): content is PageIntegrationContext['availableContent'][0] {
    return (
      typeof content === 'object' &&
      content !== null &&
      'id' in content &&
      'type' in content &&
      'title' in content &&
      'location' in content
    );
  }

  private buildConfig(config?: Partial<MainConfig>): MainConfig {
    return {
      autoInitialize: true,
      debug: false,
      timeout: 30000, // 30 seconds
      maxRetries: 3,
      performanceMonitoring: true,
      errorReporting: true,
      gracefulDegradation: true,
      featurePriorities: {
        'page-monitoring': 10,
        'content-analysis': 9,
        'meeting-detection': 8,
        'transcription-controls': 7,
      },
      compatibilityRequirements: {
        minBrowserScore: 60,
        requiredFeatures: ['content-scripts', 'storage-api'],
        optionalFeatures: ['web-workers', 'mutation-observer'],
      },
      ...config,
    };
  }
}

// Create and export main instance
export const contentScriptMain = new ContentScriptMain();

// Auto-initialize when script loads (if not in test environment)
if (typeof window !== 'undefined' && !window.location.href.includes('test')) {
  // Initialize after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (contentScriptMain.getState() === 'uninitialized') {
        contentScriptMain.initialize().catch(error => {
          console.error('Content script initialization failed:', error);
        });
      }
    });
  } else {
    // DOM is already ready
    if (contentScriptMain.getState() === 'uninitialized') {
      contentScriptMain.initialize().catch(error => {
        console.error('Content script initialization failed:', error);
      });
    }
  }
}

// Handle page unload
window.addEventListener('beforeunload', () => {
  contentScriptMain.shutdown();
});
