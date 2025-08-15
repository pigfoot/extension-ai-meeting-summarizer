/**
 * Compatibility Manager
 *
 * Feature adaptation and graceful degradation coordinator with
 * browser-specific optimizations and cross-browser compatibility.
 */

import { apiAdapter } from './api-adapter';
import { browserDetector } from './browser-detector';
import { eventManager } from '../utils/event-manager';
import type { AdaptedAPI } from './api-adapter';
import type { BrowserInfo, CompatibilityReport } from './browser-detector';

/**
 * Compatibility strategy types
 */
export type CompatibilityStrategy = 'full-support' | 'graceful-degradation' | 'polyfill' | 'fallback' | 'unsupported';

/**
 * Feature compatibility status
 */
export interface FeatureCompatibility {
  /** Feature identifier */
  featureId: string;
  /** Feature name */
  name: string;
  /** Compatibility strategy */
  strategy: CompatibilityStrategy;
  /** Support level */
  supportLevel: 'full' | 'partial' | 'limited' | 'none';
  /** Performance impact */
  performanceImpact: 'none' | 'minimal' | 'moderate' | 'significant' | 'severe';
  /** Implementation status */
  implementationStatus: 'native' | 'polyfilled' | 'fallback' | 'disabled';
  /** Configuration options */
  config: FeatureConfig;
  /** Workaround information */
  workaround?: CompatibilityWorkaround;
  /** Known issues */
  knownIssues: string[];
  /** Performance metrics */
  metrics: FeatureMetrics;
}

/**
 * Feature configuration
 */
export interface FeatureConfig {
  /** Enable feature */
  enabled: boolean;
  /** Configuration options */
  options: Record<string, unknown>;
  /** Timeout settings */
  timeout: number;
  /** Retry settings */
  retry: {
    maxAttempts: number;
    delay: number;
    backoff: number;
  };
  /** Performance thresholds */
  performance: {
    maxExecutionTime: number;
    maxMemoryUsage: number;
    maxCpuUsage: number;
  };
}

/**
 * Compatibility workaround
 */
export interface CompatibilityWorkaround {
  /** Workaround type */
  type: 'polyfill' | 'shim' | 'alternative' | 'manual';
  /** Implementation function */
  implementation: () => Promise<boolean>;
  /** Verification function */
  verify: () => boolean;
  /** Performance cost */
  cost: number;
  /** Reliability score */
  reliability: number;
  /** Dependencies */
  dependencies: string[];
  /** Cleanup function */
  cleanup?: () => void;
}

/**
 * Feature metrics
 */
export interface FeatureMetrics {
  /** Execution time */
  executionTime: number;
  /** Memory usage */
  memoryUsage: number;
  /** CPU usage */
  cpuUsage: number;
  /** Success rate */
  successRate: number;
  /** Error count */
  errorCount: number;
  /** Usage count */
  usageCount: number;
  /** Last updated */
  lastUpdated: Date;
}

/**
 * Browser optimization profile
 */
export interface BrowserOptimization {
  /** Target browser */
  browser: string;
  /** Version range */
  versionRange: string;
  /** Optimizations */
  optimizations: {
    /** Performance optimizations */
    performance: string[];
    /** Memory optimizations */
    memory: string[];
    /** Compatibility workarounds */
    compatibility: string[];
    /** Feature flags */
    features: Record<string, boolean>;
  };
  /** Configuration overrides */
  configOverrides: Record<string, unknown>;
  /** Custom implementations */
  customImplementations: Map<string, (...args: unknown[]) => unknown>;
}

/**
 * Compatibility session
 */
export interface CompatibilitySession {
  /** Session ID */
  sessionId: string;
  /** Browser information */
  browserInfo: BrowserInfo;
  /** Compatibility report */
  compatibilityReport: CompatibilityReport;
  /** Feature status */
  features: Map<string, FeatureCompatibility>;
  /** Active workarounds */
  workarounds: Map<string, CompatibilityWorkaround>;
  /** Performance metrics */
  sessionMetrics: SessionMetrics;
  /** Error log */
  errorLog: CompatibilityError[];
  /** Created timestamp */
  createdAt: Date;
  /** Last updated */
  updatedAt: Date;
}

/**
 * Session metrics
 */
export interface SessionMetrics {
  /** Total features checked */
  featuresChecked: number;
  /** Features supported natively */
  nativeSupport: number;
  /** Features requiring polyfills */
  polyfillRequired: number;
  /** Features using fallbacks */
  fallbackRequired: number;
  /** Unsupported features */
  unsupported: number;
  /** Overall compatibility score */
  compatibilityScore: number;
  /** Performance score */
  performanceScore: number;
  /** Total adaptation time */
  adaptationTime: number;
  /** Memory overhead */
  memoryOverhead: number;
}

/**
 * Compatibility error
 */
export interface CompatibilityError {
  /** Error ID */
  id: string;
  /** Feature related to error */
  feature: string;
  /** Error type */
  type: 'polyfill-failed' | 'fallback-failed' | 'feature-unsupported' | 'performance-degraded';
  /** Error message */
  message: string;
  /** Error details */
  details: unknown;
  /** Timestamp */
  timestamp: Date;
  /** Recovery attempted */
  recoveryAttempted: boolean;
  /** Recovery successful */
  recoverySuccessful: boolean;
}

/**
 * Compatibility manager configuration
 */
export interface CompatibilityManagerConfig {
  /** Enable automatic adaptation */
  autoAdapt: boolean;
  /** Performance monitoring */
  performanceMonitoring: boolean;
  /** Error reporting */
  errorReporting: boolean;
  /** Graceful degradation */
  gracefulDegradation: boolean;
  /** Maximum adaptation time */
  maxAdaptationTime: number;
  /** Feature priorities */
  featurePriorities: Record<string, number>;
  /** Performance budgets */
  performanceBudgets: {
    maxAdaptationTime: number;
    maxMemoryOverhead: number;
    maxPolyfillSize: number;
  };
  /** Browser-specific settings */
  browserSettings: Map<string, BrowserOptimization>;
}

/**
 * Compatibility manager for coordinating cross-browser adaptations
 */
export class CompatibilityManager {
  private browserInfo: BrowserInfo;
  private compatibilityReport: CompatibilityReport;
  private adaptedAPI: AdaptedAPI;
  private config: CompatibilityManagerConfig;
  private session: CompatibilitySession;
  private featureRegistry: Map<string, FeatureCompatibility> = new Map();
  private optimizationProfiles: Map<string, BrowserOptimization> = new Map();
  private performanceObserver: PerformanceObserver | null = null;

  constructor(config?: Partial<CompatibilityManagerConfig>) {
    this.browserInfo = browserDetector.getBrowserInfo();
    this.compatibilityReport = browserDetector.getCompatibilityReport();
    this.adaptedAPI = apiAdapter.getAPI();
    this.config = this.buildConfig(config);
    this.session = this.createSession();

    this.initializeOptimizationProfiles();
    this.initializeFeatureRegistry();
    this.setupPerformanceMonitoring();

    if (this.config.autoAdapt) {
      this.performAutoAdaptation();
    }
  }

  /**
   * Initialize compatibility adaptations
   */
  async initialize(): Promise<void> {
    const startTime = Date.now();

    try {
      // Perform compatibility analysis
      await this.analyzeCompatibility();

      // Apply browser-specific optimizations
      await this.applyBrowserOptimizations();

      // Initialize required polyfills
      await this.initializePolyfills();

      // Setup workarounds
      await this.setupWorkarounds();

      // Verify implementations
      await this.verifyImplementations();

      // Update session metrics
      this.updateSessionMetrics();

      const adaptationTime = Date.now() - startTime;
      this.session.sessionMetrics.adaptationTime = adaptationTime;

      // Emit initialization complete event
      eventManager.emitEvent('compatibility-initialized', {
        session: this.session,
        adaptationTime,
      });
    } catch (error) {
      this.handleCompatibilityError('initialization', error as Error);
      throw error;
    }
  }

  /**
   * Check feature compatibility
   */
  checkFeatureCompatibility(featureId: string): FeatureCompatibility {
    if (this.featureRegistry.has(featureId)) {
      return this.featureRegistry.get(featureId)!;
    }

    const compatibility = this.analyzeFeatureCompatibility(featureId);
    this.featureRegistry.set(featureId, compatibility);
    this.session.features.set(featureId, compatibility);

    return compatibility;
  }

  /**
   * Adapt feature for current browser
   */
  async adaptFeature(featureId: string): Promise<boolean> {
    const startTime = performance.now();

    try {
      const compatibility = this.checkFeatureCompatibility(featureId);

      switch (compatibility.strategy) {
        case 'full-support':
          return true;

        case 'polyfill':
          return await this.applyPolyfill(featureId, compatibility);

        case 'fallback':
          return await this.applyFallback(featureId, compatibility);

        case 'graceful-degradation':
          return await this.applyGracefulDegradation(featureId, compatibility);

        case 'unsupported':
          this.handleUnsupportedFeature(featureId, compatibility);
          return false;

        default:
          return false;
      }
    } catch (error) {
      this.handleCompatibilityError(featureId, error as Error);
      return false;
    } finally {
      const executionTime = performance.now() - startTime;
      this.updateFeatureMetrics(featureId, { executionTime });
    }
  }

  /**
   * Get browser optimization recommendations
   */
  getOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];
    const profile = this.getBrowserOptimizationProfile();

    if (profile) {
      recommendations.push(...profile.optimizations.performance);

      if (this.browserInfo.isMobile) {
        recommendations.push(
          'Enable mobile-specific optimizations',
          'Reduce animation complexity',
          'Minimize DOM manipulations',
        );
      }

      if (this.browserInfo.limitations.performance.slowJavaScript) {
        recommendations.push(
          'Use web workers for heavy computations',
          'Implement lazy loading',
          'Optimize event handlers',
        );
      }

      if (this.browserInfo.limitations.performance.limitedMemory) {
        recommendations.push('Implement memory cleanup', 'Use object pooling', 'Minimize memory allocations');
      }
    }

    return recommendations;
  }

  /**
   * Apply browser-specific optimizations
   */
  async applyBrowserOptimizations(): Promise<void> {
    const profile = this.getBrowserOptimizationProfile();
    if (!profile) return;

    // Apply performance optimizations
    for (const optimization of profile.optimizations.performance) {
      await this.applyOptimization(optimization);
    }

    // Apply memory optimizations
    for (const optimization of profile.optimizations.memory) {
      await this.applyOptimization(optimization);
    }

    // Apply compatibility workarounds
    for (const workaround of profile.optimizations.compatibility) {
      await this.applyOptimization(workaround);
    }

    // Apply feature flags
    Object.entries(profile.optimizations.features).forEach(([feature, enabled]) => {
      this.updateFeatureConfig(feature, { enabled });
    });

    // Apply configuration overrides
    Object.entries(profile.configOverrides).forEach(([key, value]) => {
      this.applyConfigOverride(key, value);
    });
  }

  /**
   * Monitor feature performance
   */
  monitorFeaturePerformance(featureId: string): void {
    if (!this.config.performanceMonitoring) return;

    const compatibility = this.featureRegistry.get(featureId);
    if (!compatibility) return;

    // Setup performance observers
    if (this.performanceObserver) {
      this.performanceObserver.observe({ entryTypes: ['measure', 'navigation'] });
    }

    // Monitor memory usage
    this.monitorMemoryUsage(featureId);

    // Monitor CPU usage
    this.monitorCPUUsage(featureId);

    // Setup performance budgets
    this.enforcePerformanceBudgets(featureId);
  }

  /**
   * Get compatibility session information
   */
  getSession(): CompatibilitySession {
    return this.session;
  }

  /**
   * Get feature metrics
   */
  getFeatureMetrics(featureId: string): FeatureMetrics | null {
    const compatibility = this.featureRegistry.get(featureId);
    return compatibility ? compatibility.metrics : null;
  }

  /**
   * Private implementation methods
   */

  private async analyzeCompatibility(): Promise<void> {
    // Analyze core extension features
    await this.analyzeExtensionFeatures();

    // Analyze web API features
    await this.analyzeWebAPIFeatures();

    // Analyze DOM features
    await this.analyzeDOMFeatures();

    // Analyze performance characteristics
    await this.analyzePerformanceCharacteristics();
  }

  private async analyzeExtensionFeatures(): Promise<void> {
    const features = [
      'content-scripts',
      'background-service',
      'storage-api',
      'messaging-api',
      'scripting-api',
      'tabs-api',
    ];

    for (const feature of features) {
      this.checkFeatureCompatibility(feature);
    }
  }

  private async analyzeWebAPIFeatures(): Promise<void> {
    const features = ['fetch-api', 'web-workers', 'service-workers', 'notifications', 'clipboard-api', 'media-api'];

    for (const feature of features) {
      this.checkFeatureCompatibility(feature);
    }
  }

  private async analyzeDOMFeatures(): Promise<void> {
    const features = ['mutation-observer', 'intersection-observer', 'resize-observer', 'custom-elements', 'shadow-dom'];

    for (const feature of features) {
      this.checkFeatureCompatibility(feature);
    }
  }

  private async analyzePerformanceCharacteristics(): Promise<void> {
    // Measure JavaScript execution performance
    const jsPerf = await this.measureJavaScriptPerformance();

    // Measure DOM manipulation performance
    const domPerf = await this.measureDOMPerformance();

    // Measure network performance
    const networkPerf = await this.measureNetworkPerformance();

    // Update session metrics
    this.session.sessionMetrics.performanceScore = (jsPerf + domPerf + networkPerf) / 3;
  }

  private analyzeFeatureCompatibility(featureId: string): FeatureCompatibility {
    const isSupported = this.isFeatureSupported(featureId);
    const strategy = this.determineCompatibilityStrategy(featureId, isSupported);
    const supportLevel = this.determineSupportLevel(featureId, isSupported);
    const performanceImpact = this.estimatePerformanceImpact(featureId, strategy);

    return {
      featureId,
      name: this.getFeatureName(featureId),
      strategy,
      supportLevel,
      performanceImpact,
      implementationStatus: isSupported ? 'native' : 'disabled',
      config: this.createFeatureConfig(featureId),
      knownIssues: this.getKnownIssues(featureId),
      metrics: this.createFeatureMetrics(),
    };
  }

  private isFeatureSupported(featureId: string): boolean {
    switch (featureId) {
      case 'content-scripts':
        return this.browserInfo.capabilities.extensions.contentScripts;
      case 'background-service':
        return this.browserInfo.capabilities.extensions.backgroundService;
      case 'storage-api':
        return this.browserInfo.capabilities.extensions.storageApi;
      case 'messaging-api':
        return this.browserInfo.capabilities.extensions.messagePassingApi;
      case 'fetch-api':
        return this.browserInfo.capabilities.webApis.fetch;
      case 'web-workers':
        return this.browserInfo.capabilities.webApis.webWorkers;
      case 'mutation-observer':
        return this.browserInfo.capabilities.dom.mutationObserver;
      case 'intersection-observer':
        return this.browserInfo.capabilities.dom.intersectionObserver;
      default:
        return false;
    }
  }

  private determineCompatibilityStrategy(featureId: string, isSupported: boolean): CompatibilityStrategy {
    if (isSupported) {
      return 'full-support';
    }

    const hasPolyfill = this.hasPolyfillAvailable(featureId);
    const hasFallback = this.hasFallbackAvailable(featureId);

    if (hasPolyfill) {
      return 'polyfill';
    } else if (hasFallback) {
      return 'fallback';
    } else if (this.config.gracefulDegradation) {
      return 'graceful-degradation';
    } else {
      return 'unsupported';
    }
  }

  private determineSupportLevel(featureId: string, isSupported: boolean): FeatureCompatibility['supportLevel'] {
    if (isSupported) {
      return 'full';
    }

    if (this.hasPolyfillAvailable(featureId)) {
      return 'partial';
    }

    if (this.hasFallbackAvailable(featureId)) {
      return 'limited';
    }

    return 'none';
  }

  private estimatePerformanceImpact(
    featureId: string,
    strategy: CompatibilityStrategy,
  ): FeatureCompatibility['performanceImpact'] {
    switch (strategy) {
      case 'full-support':
        return 'none';
      case 'polyfill':
        return this.browserInfo.isMobile ? 'moderate' : 'minimal';
      case 'fallback':
        return 'moderate';
      case 'graceful-degradation':
        return 'minimal';
      case 'unsupported':
        return 'none';
      default:
        return 'minimal';
    }
  }

  private async applyPolyfill(featureId: string, compatibility: FeatureCompatibility): Promise<boolean> {
    try {
      const polyfill = await this.loadPolyfill(featureId);
      if (polyfill) {
        await polyfill.initialize();
        compatibility.implementationStatus = 'polyfilled';
        return true;
      }
      return false;
    } catch (error) {
      this.handleCompatibilityError(`polyfill-${featureId}`, error as Error);
      return false;
    }
  }

  private async applyFallback(featureId: string, compatibility: FeatureCompatibility): Promise<boolean> {
    try {
      const fallback = this.createFallback(featureId);
      if (fallback) {
        await fallback.initialize();
        compatibility.implementationStatus = 'fallback';
        return true;
      }
      return false;
    } catch (error) {
      this.handleCompatibilityError(`fallback-${featureId}`, error as Error);
      return false;
    }
  }

  private async applyGracefulDegradation(featureId: string, compatibility: FeatureCompatibility): Promise<boolean> {
    try {
      const degradation = this.createGracefulDegradation(featureId);
      if (degradation) {
        await degradation.initialize();
        compatibility.implementationStatus = 'fallback';
        compatibility.supportLevel = 'limited';
        return true;
      }
      return false;
    } catch (error) {
      this.handleCompatibilityError(`degradation-${featureId}`, error as Error);
      return false;
    }
  }

  private handleUnsupportedFeature(featureId: string, compatibility: FeatureCompatibility): void {
    this.logCompatibilityError({
      id: `unsupported-${featureId}`,
      feature: featureId,
      type: 'feature-unsupported',
      message: `Feature ${featureId} is not supported in this browser`,
      details: { browserInfo: this.browserInfo },
      timestamp: new Date(),
      recoveryAttempted: false,
      recoverySuccessful: false,
    });

    compatibility.implementationStatus = 'disabled';
  }

  private async initializePolyfills(): Promise<void> {
    const polyfillFeatures = Array.from(this.featureRegistry.entries())
      .filter(([_, compatibility]) => compatibility.strategy === 'polyfill')
      .map(([featureId]) => featureId);

    for (const featureId of polyfillFeatures) {
      await this.adaptFeature(featureId);
    }
  }

  private async setupWorkarounds(): Promise<void> {
    const workaroundFeatures = Array.from(this.featureRegistry.entries())
      .filter(([_, compatibility]) => compatibility.workaround)
      .map(([featureId, compatibility]) => ({ featureId, workaround: compatibility.workaround! }));

    for (const { featureId, workaround } of workaroundFeatures) {
      try {
        const success = await workaround.implementation();
        if (success && workaround.verify()) {
          this.session.workarounds.set(featureId, workaround);
        }
      } catch (error) {
        this.handleCompatibilityError(`workaround-${featureId}`, error as Error);
      }
    }
  }

  private async verifyImplementations(): Promise<void> {
    for (const [featureId, compatibility] of this.featureRegistry) {
      const verified = await this.verifyFeatureImplementation(featureId, compatibility);
      if (!verified) {
        this.handleCompatibilityError(`verification-${featureId}`, new Error('Feature verification failed'));
      }
    }
  }

  private async verifyFeatureImplementation(featureId: string, _compatibility: FeatureCompatibility): Promise<boolean> {
    try {
      // Perform feature-specific verification
      switch (featureId) {
        case 'mutation-observer':
          return this.verifyMutationObserver();
        case 'fetch-api':
          return this.verifyFetchAPI();
        case 'storage-api':
          return this.verifyStorageAPI();
        default:
          return true; // Assume verified if no specific test
      }
    } catch (_error) {
      return false;
    }
  }

  private verifyMutationObserver(): boolean {
    try {
      const observer = new this.adaptedAPI.dom.MutationObserver(() => {});
      observer.observe(document.body, { childList: true });
      observer.disconnect();
      return true;
    } catch {
      return false;
    }
  }

  private verifyFetchAPI(): boolean {
    try {
      return typeof this.adaptedAPI.web.fetch === 'function';
    } catch {
      return false;
    }
  }

  private verifyStorageAPI(): boolean {
    try {
      return (
        this.adaptedAPI.extension.storage.local && typeof this.adaptedAPI.extension.storage.local.get === 'function'
      );
    } catch {
      return false;
    }
  }

  private getBrowserOptimizationProfile(): BrowserOptimization | null {
    const browserKey = `${this.browserInfo.type}-${this.browserInfo.majorVersion}`;
    return this.optimizationProfiles.get(browserKey) || this.optimizationProfiles.get(this.browserInfo.type) || null;
  }

  private initializeOptimizationProfiles(): void {
    // Chrome optimizations
    this.optimizationProfiles.set('chrome', {
      browser: 'chrome',
      versionRange: '>=88',
      optimizations: {
        performance: ['Enable V8 optimizations', 'Use passive event listeners', 'Implement RAF throttling'],
        memory: ['Enable garbage collection hints', 'Use WeakMap for caching', 'Implement object pooling'],
        compatibility: ['Use Chrome extension APIs directly', 'Enable manifest V3 features'],
        features: {
          'service-workers': true,
          'web-assembly': true,
          'offscreen-canvas': true,
        },
      },
      configOverrides: {
        maxWorkers: 8,
        cacheSize: 50 * 1024 * 1024, // 50MB
      },
      customImplementations: new Map(),
    });

    // Firefox optimizations
    this.optimizationProfiles.set('firefox', {
      browser: 'firefox',
      versionRange: '>=78',
      optimizations: {
        performance: ['Enable SpiderMonkey optimizations', 'Use requestIdleCallback', 'Minimize reflows'],
        memory: ['Enable cycle collection', 'Use memory pressure observers', 'Implement lazy initialization'],
        compatibility: ['Use WebExtensions API', 'Handle Promise differences'],
        features: {
          'web-assembly': true,
          'shared-array-buffer': false, // Security restrictions
        },
      },
      configOverrides: {
        maxWorkers: 4,
        cacheSize: 25 * 1024 * 1024, // 25MB
      },
      customImplementations: new Map(),
    });

    // Safari optimizations
    this.optimizationProfiles.set('safari', {
      browser: 'safari',
      versionRange: '>=14',
      optimizations: {
        performance: ['Enable WebKit optimizations', 'Use CSS animations over JS', 'Minimize DOM queries'],
        memory: ['Handle memory pressure', 'Use native API when available', 'Minimize event listeners'],
        compatibility: ['Handle Safari extension differences', 'Use WebKit-specific features'],
        features: {
          'web-assembly': true,
          'service-workers': false, // Limited support
        },
      },
      configOverrides: {
        maxWorkers: 2,
        cacheSize: 10 * 1024 * 1024, // 10MB
      },
      customImplementations: new Map(),
    });
  }

  private initializeFeatureRegistry(): void {
    const coreFeatures = [
      'content-scripts',
      'background-service',
      'storage-api',
      'messaging-api',
      'fetch-api',
      'web-workers',
      'mutation-observer',
      'intersection-observer',
    ];

    for (const feature of coreFeatures) {
      this.checkFeatureCompatibility(feature);
    }
  }

  private async performAutoAdaptation(): Promise<void> {
    try {
      await this.initialize();
    } catch (error) {
      console.error('Auto-adaptation failed:', error);
    }
  }

  private setupPerformanceMonitoring(): void {
    if (!this.config.performanceMonitoring) return;

    try {
      this.performanceObserver = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          this.processPerformanceEntry(entry);
        }
      });
    } catch (error) {
      console.warn('Performance monitoring not available:', error);
    }
  }

  private processPerformanceEntry(entry: PerformanceEntry): void {
    // Process performance entries for compatibility analysis
    if (entry.entryType === 'measure') {
      this.updatePerformanceMetrics(entry.name, entry.duration);
    }
  }

  private updatePerformanceMetrics(feature: string, duration: number): void {
    const compatibility = this.featureRegistry.get(feature);
    if (compatibility) {
      compatibility.metrics.executionTime = duration;
      compatibility.metrics.usageCount++;
      compatibility.metrics.lastUpdated = new Date();
    }
  }

  private updateSessionMetrics(): void {
    const metrics = this.session.sessionMetrics;

    metrics.featuresChecked = this.featureRegistry.size;
    metrics.nativeSupport = Array.from(this.featureRegistry.values()).filter(
      f => f.implementationStatus === 'native',
    ).length;
    metrics.polyfillRequired = Array.from(this.featureRegistry.values()).filter(
      f => f.implementationStatus === 'polyfilled',
    ).length;
    metrics.fallbackRequired = Array.from(this.featureRegistry.values()).filter(
      f => f.implementationStatus === 'fallback',
    ).length;
    metrics.unsupported = Array.from(this.featureRegistry.values()).filter(
      f => f.implementationStatus === 'disabled',
    ).length;

    const totalFeatures = metrics.featuresChecked;
    metrics.compatibilityScore =
      totalFeatures > 0
        ? ((metrics.nativeSupport + metrics.polyfillRequired * 0.8 + metrics.fallbackRequired * 0.6) / totalFeatures) *
          100
        : 0;
  }

  private updateFeatureMetrics(featureId: string, updates: Partial<FeatureMetrics>): void {
    const compatibility = this.featureRegistry.get(featureId);
    if (compatibility) {
      Object.assign(compatibility.metrics, updates);
      compatibility.metrics.lastUpdated = new Date();
    }
  }

  private createSession(): CompatibilitySession {
    return {
      sessionId: this.generateSessionId(),
      browserInfo: this.browserInfo,
      compatibilityReport: this.compatibilityReport,
      features: new Map(),
      workarounds: new Map(),
      sessionMetrics: this.createSessionMetrics(),
      errorLog: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private createSessionMetrics(): SessionMetrics {
    return {
      featuresChecked: 0,
      nativeSupport: 0,
      polyfillRequired: 0,
      fallbackRequired: 0,
      unsupported: 0,
      compatibilityScore: 0,
      performanceScore: 0,
      adaptationTime: 0,
      memoryOverhead: 0,
    };
  }

  private createFeatureConfig(_featureId: string): FeatureConfig {
    return {
      enabled: true,
      options: {},
      timeout: 10000,
      retry: {
        maxAttempts: 3,
        delay: 1000,
        backoff: 2,
      },
      performance: {
        maxExecutionTime: 5000,
        maxMemoryUsage: 10 * 1024 * 1024, // 10MB
        maxCpuUsage: 80, // 80%
      },
    };
  }

  private createFeatureMetrics(): FeatureMetrics {
    return {
      executionTime: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      successRate: 0,
      errorCount: 0,
      usageCount: 0,
      lastUpdated: new Date(),
    };
  }

  private handleCompatibilityError(context: string, error: Error): void {
    const compatibilityError: CompatibilityError = {
      id: `${context}-${Date.now()}`,
      feature: context,
      type: 'polyfill-failed',
      message: error.message,
      details: error,
      timestamp: new Date(),
      recoveryAttempted: false,
      recoverySuccessful: false,
    };

    this.logCompatibilityError(compatibilityError);

    if (this.config.errorReporting) {
      eventManager.emitEvent('compatibility-error', compatibilityError);
    }
  }

  private logCompatibilityError(error: CompatibilityError): void {
    this.session.errorLog.push(error);

    if (this.config.errorReporting) {
      console.error('Compatibility Error:', error);
    }
  }

  private generateSessionId(): string {
    return `compat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getFeatureName(featureId: string): string {
    const names: Record<string, string> = {
      'content-scripts': 'Content Scripts',
      'background-service': 'Background Service',
      'storage-api': 'Storage API',
      'messaging-api': 'Messaging API',
      'fetch-api': 'Fetch API',
      'web-workers': 'Web Workers',
      'mutation-observer': 'Mutation Observer',
      'intersection-observer': 'Intersection Observer',
    };

    return names[featureId] || featureId;
  }

  private getKnownIssues(featureId: string): string[] {
    // Return known issues for specific features in specific browsers
    const issues: Record<string, string[]> = {
      'mutation-observer': this.browserInfo.type === 'safari' ? ['Performance issues with large DOM trees'] : [],
      'fetch-api':
        this.browserInfo.type === 'firefox' && this.browserInfo.majorVersion < 80
          ? ['Limited support for certain headers']
          : [],
    };

    return issues[featureId] || [];
  }

  private hasPolyfillAvailable(featureId: string): boolean {
    const polyfills = ['mutation-observer', 'intersection-observer', 'resize-observer', 'fetch-api'];

    return polyfills.includes(featureId);
  }

  private hasFallbackAvailable(featureId: string): boolean {
    const fallbacks = ['storage-api', 'messaging-api', 'web-workers'];

    return fallbacks.includes(featureId);
  }

  private async loadPolyfill(_featureId: string): Promise<unknown> {
    // Implementation would dynamically load polyfills
    // This is a simplified version
    return null;
  }

  private createFallback(_featureId: string): unknown {
    // Implementation would create fallback implementations
    // This is a simplified version
    return null;
  }

  private createGracefulDegradation(_featureId: string): unknown {
    // Implementation would create graceful degradation strategies
    // This is a simplified version
    return null;
  }

  private async applyOptimization(_optimization: string): Promise<void> {
    // Implementation would apply specific optimizations
    // This is a simplified version
  }

  private updateFeatureConfig(feature: string, config: Partial<FeatureConfig>): void {
    const compatibility = this.featureRegistry.get(feature);
    if (compatibility) {
      Object.assign(compatibility.config, config);
    }
  }

  private applyConfigOverride(_key: string, _value: unknown): void {
    // Apply configuration overrides
  }

  private monitorMemoryUsage(_featureId: string): void {
    // Monitor memory usage for specific feature
  }

  private monitorCPUUsage(_featureId: string): void {
    // Monitor CPU usage for specific feature
  }

  private enforcePerformanceBudgets(_featureId: string): void {
    // Enforce performance budgets
  }

  private async measureJavaScriptPerformance(): Promise<number> {
    // Measure JavaScript execution performance
    return 100; // Placeholder
  }

  private async measureDOMPerformance(): Promise<number> {
    // Measure DOM manipulation performance
    return 100; // Placeholder
  }

  private async measureNetworkPerformance(): Promise<number> {
    // Measure network performance
    return 100; // Placeholder
  }

  private buildConfig(config?: Partial<CompatibilityManagerConfig>): CompatibilityManagerConfig {
    return {
      autoAdapt: true,
      performanceMonitoring: true,
      errorReporting: true,
      gracefulDegradation: true,
      maxAdaptationTime: 10000,
      featurePriorities: {
        'content-scripts': 10,
        'storage-api': 9,
        'messaging-api': 8,
        'fetch-api': 7,
      },
      performanceBudgets: {
        maxAdaptationTime: 5000,
        maxMemoryOverhead: 50 * 1024 * 1024, // 50MB
        maxPolyfillSize: 100 * 1024, // 100KB
      },
      browserSettings: new Map(),
      ...config,
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }

    this.featureRegistry.clear();
    this.optimizationProfiles.clear();

    // Cleanup workarounds
    this.session.workarounds.forEach(workaround => {
      if (workaround.cleanup) {
        workaround.cleanup();
      }
    });
  }
}

// Export singleton instance
export const compatibilityManager = new CompatibilityManager();
