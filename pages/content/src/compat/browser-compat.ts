/**
 * Browser Compatibility Layer
 *
 * Cross-browser compatibility handling with feature detection and
 * API polyfills for consistent behavior across browsers.
 */

import type { BrowserFeatures, CompatibilityLayer, FeatureFallback } from '../types/browser-compat';

/**
 * Browser detection result
 */
export interface BrowserInfo {
  /** Browser name */
  name: 'chrome' | 'firefox' | 'safari' | 'edge' | 'opera' | 'unknown';
  /** Browser version */
  version: string;
  /** Major version number */
  majorVersion: number;
  /** Engine name */
  engine: 'blink' | 'gecko' | 'webkit' | 'unknown';
  /** Operating system */
  platform: 'windows' | 'macos' | 'linux' | 'android' | 'ios' | 'unknown';
  /** Whether browser is mobile */
  isMobile: boolean;
  /** Whether browser supports extensions */
  supportsExtensions: boolean;
}

/**
 * Feature support levels
 */
export type FeatureSupportLevel = 'full' | 'partial' | 'polyfill' | 'unsupported';

/**
 * Feature detection result
 */
export interface FeatureDetectionResult {
  /** Feature name */
  feature: string;
  /** Support level */
  support: FeatureSupportLevel;
  /** Native implementation available */
  native: boolean;
  /** Polyfill available */
  polyfillAvailable: boolean;
  /** Version where feature was introduced */
  sinceVersion?: string;
  /** Additional notes */
  notes?: string;
}

/**
 * Compatibility configuration
 */
export interface CompatibilityConfig {
  /** Enable automatic polyfills */
  enablePolyfills: boolean;
  /** Enable feature detection logging */
  enableFeatureLogging: boolean;
  /** Strict compatibility mode */
  strictMode: boolean;
  /** Fallback strategy */
  fallbackStrategy: 'graceful' | 'strict' | 'disabled';
  /** Minimum browser versions */
  minimumVersions: {
    chrome: number;
    firefox: number;
    safari: number;
    edge: number;
  };
  /** Features to force enable/disable */
  featureOverrides: Record<string, boolean>;
}

/**
 * Cross-browser compatibility layer
 */
export class BrowserCompatibility {
  private static instance: BrowserCompatibility;
  private browserInfo: BrowserInfo;
  private config: CompatibilityConfig;
  private featureCache: Map<string, FeatureDetectionResult> = new Map();
  private polyfills: Map<string, () => void> = new Map();
  private fallbacks: Map<string, FeatureFallback> = new Map();

  constructor(config: Partial<CompatibilityConfig> = {}) {
    this.config = {
      enablePolyfills: true,
      enableFeatureLogging: false,
      strictMode: false,
      fallbackStrategy: 'graceful',
      minimumVersions: {
        chrome: 88,
        firefox: 78,
        safari: 14,
        edge: 88,
      },
      featureOverrides: {},
      ...config,
    };

    this.browserInfo = this.detectBrowser();
    this.initializePolyfills();
    this.initializeFallbacks();
    this.validateBrowserSupport();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<CompatibilityConfig>): BrowserCompatibility {
    if (!BrowserCompatibility.instance) {
      BrowserCompatibility.instance = new BrowserCompatibility(config);
    }
    return BrowserCompatibility.instance;
  }

  /**
   * Get browser information
   */
  getBrowserInfo(): BrowserInfo {
    return { ...this.browserInfo };
  }

  /**
   * Check if feature is supported
   */
  isFeatureSupported(feature: string): boolean {
    const detection = this.detectFeature(feature);
    return detection.support !== 'unsupported';
  }

  /**
   * Get feature support level
   */
  getFeatureSupport(feature: string): FeatureDetectionResult {
    return this.detectFeature(feature);
  }

  /**
   * Get compatible API for feature
   */
  getCompatibleAPI<T = unknown>(feature: string): T | null {
    const detection = this.detectFeature(feature);

    if (detection.support === 'unsupported') {
      return null;
    }

    if (detection.native && detection.support === 'full') {
      return this.getNativeAPI<T>(feature);
    }

    if (detection.polyfillAvailable && this.config.enablePolyfills) {
      this.applyPolyfill(feature);
      return this.getNativeAPI<T>(feature);
    }

    const fallback = this.fallbacks.get(feature);
    if (fallback) {
      return fallback.implementation as T;
    }

    return null;
  }

  /**
   * Apply polyfill for feature
   */
  applyPolyfill(feature: string): boolean {
    const polyfill = this.polyfills.get(feature);
    if (!polyfill) {
      return false;
    }

    try {
      polyfill();
      this.log(`Applied polyfill for: ${feature}`);
      return true;
    } catch (error) {
      this.log(`Failed to apply polyfill for ${feature}: ${error}`);
      return false;
    }
  }

  /**
   * Check browser version compatibility
   */
  isVersionSupported(): boolean {
    const minVersions = this.config.minimumVersions;
    const browser = this.browserInfo;

    switch (browser.name) {
      case 'chrome':
        return browser.majorVersion >= minVersions.chrome;
      case 'firefox':
        return browser.majorVersion >= minVersions.firefox;
      case 'safari':
        return browser.majorVersion >= minVersions.safari;
      case 'edge':
        return browser.majorVersion >= minVersions.edge;
      default:
        return !this.config.strictMode;
    }
  }

  /**
   * Get browser features
   */
  getBrowserFeatures(): BrowserFeatures {
    return {
      extensionAPI: this.detectFeature('extensionAPI').support !== 'unsupported',
      webComponents: this.detectFeature('webComponents').support !== 'unsupported',
      shadowDOM: this.detectFeature('shadowDOM').support !== 'unsupported',
      customElements: this.detectFeature('customElements').support !== 'unsupported',
      mutationObserver: this.detectFeature('mutationObserver').support !== 'unsupported',
      intersectionObserver: this.detectFeature('intersectionObserver').support !== 'unsupported',
      broadcastChannel: this.detectFeature('broadcastChannel').support !== 'unsupported',
      serviceWorker: this.detectFeature('serviceWorker').support !== 'unsupported',
      webRTC: this.detectFeature('webRTC').support !== 'unsupported',
      mediaRecorder: this.detectFeature('mediaRecorder').support !== 'unsupported',
      permissions: this.detectFeature('permissions').support !== 'unsupported',
      storage: this.detectFeature('storage').support !== 'unsupported',
      performanceObserver: this.detectFeature('performanceObserver').support !== 'unsupported',
      resizeObserver: this.detectFeature('resizeObserver').support !== 'unsupported',
    };
  }

  /**
   * Get compatibility layer
   */
  getCompatibilityLayer(): CompatibilityLayer {
    return {
      browserInfo: this.browserInfo,
      features: this.getBrowserFeatures(),
      polyfillsApplied: Array.from(this.polyfills.keys()),
      fallbacksAvailable: Array.from(this.fallbacks.keys()),
      isSupported: this.isVersionSupported(),
      compatibilityScore: this.calculateCompatibilityScore(),
    };
  }

  /**
   * Detect browser information
   */
  private detectBrowser(): BrowserInfo {
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;

    // Detect browser name and version
    let name: BrowserInfo['name'] = 'unknown';
    let version = '';
    let majorVersion = 0;
    let engine: BrowserInfo['engine'] = 'unknown';

    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
      name = 'chrome';
      const match = userAgent.match(/Chrome\/(\d+\.[\d.]+)/);
      version = match ? match[1] : '';
      majorVersion = match ? parseInt(match[1].split('.')[0], 10) : 0;
      engine = 'blink';
    } else if (userAgent.includes('Firefox')) {
      name = 'firefox';
      const match = userAgent.match(/Firefox\/(\d+\.[\d.]+)/);
      version = match ? match[1] : '';
      majorVersion = match ? parseInt(match[1].split('.')[0], 10) : 0;
      engine = 'gecko';
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      name = 'safari';
      const match = userAgent.match(/Version\/(\d+\.[\d.]+)/);
      version = match ? match[1] : '';
      majorVersion = match ? parseInt(match[1].split('.')[0], 10) : 0;
      engine = 'webkit';
    } else if (userAgent.includes('Edg')) {
      name = 'edge';
      const match = userAgent.match(/Edg\/(\d+\.[\d.]+)/);
      version = match ? match[1] : '';
      majorVersion = match ? parseInt(match[1].split('.')[0], 10) : 0;
      engine = 'blink';
    } else if (userAgent.includes('Opera') || userAgent.includes('OPR')) {
      name = 'opera';
      const match = userAgent.match(/(?:Opera|OPR)\/(\d+\.[\d.]+)/);
      version = match ? match[1] : '';
      majorVersion = match ? parseInt(match[1].split('.')[0], 10) : 0;
      engine = 'blink';
    }

    // Detect platform
    let platformName: BrowserInfo['platform'] = 'unknown';
    if (platform.includes('Win')) {
      platformName = 'windows';
    } else if (platform.includes('Mac')) {
      platformName = 'macos';
    } else if (platform.includes('Linux')) {
      platformName = 'linux';
    } else if (userAgent.includes('Android')) {
      platformName = 'android';
    } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      platformName = 'ios';
    }

    // Detect mobile
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

    // Check extension support
    const supportsExtensions = typeof chrome !== 'undefined' && typeof chrome.runtime !== 'undefined';

    return {
      name,
      version,
      majorVersion,
      engine,
      platform: platformName,
      isMobile,
      supportsExtensions,
    };
  }

  /**
   * Detect feature support
   */
  private detectFeature(feature: string): FeatureDetectionResult {
    // Check cache first
    if (this.featureCache.has(feature)) {
      return this.featureCache.get(feature)!;
    }

    // Check override
    if (this.config.featureOverrides[feature] !== undefined) {
      const result: FeatureDetectionResult = {
        feature,
        support: this.config.featureOverrides[feature] ? 'full' : 'unsupported',
        native: this.config.featureOverrides[feature],
        polyfillAvailable: false,
        notes: 'Overridden by configuration',
      };
      this.featureCache.set(feature, result);
      return result;
    }

    let result: FeatureDetectionResult;

    switch (feature) {
      case 'extensionAPI':
        result = this.detectExtensionAPI();
        break;
      case 'webComponents':
        result = this.detectWebComponents();
        break;
      case 'shadowDOM':
        result = this.detectShadowDOM();
        break;
      case 'customElements':
        result = this.detectCustomElements();
        break;
      case 'mutationObserver':
        result = this.detectMutationObserver();
        break;
      case 'intersectionObserver':
        result = this.detectIntersectionObserver();
        break;
      case 'broadcastChannel':
        result = this.detectBroadcastChannel();
        break;
      case 'serviceWorker':
        result = this.detectServiceWorker();
        break;
      case 'webRTC':
        result = this.detectWebRTC();
        break;
      case 'mediaRecorder':
        result = this.detectMediaRecorder();
        break;
      case 'permissions':
        result = this.detectPermissions();
        break;
      case 'storage':
        result = this.detectStorage();
        break;
      case 'performanceObserver':
        result = this.detectPerformanceObserver();
        break;
      case 'resizeObserver':
        result = this.detectResizeObserver();
        break;
      default:
        result = {
          feature,
          support: 'unsupported',
          native: false,
          polyfillAvailable: false,
          notes: 'Unknown feature',
        };
    }

    this.featureCache.set(feature, result);

    if (this.config.enableFeatureLogging) {
      this.log(`Feature detection: ${feature} = ${result.support}`);
    }

    return result;
  }

  /**
   * Detect extension API support
   */
  private detectExtensionAPI(): FeatureDetectionResult {
    const hasChrome = typeof chrome !== 'undefined';
    const hasRuntime = hasChrome && typeof chrome.runtime !== 'undefined';
    const hasTabs = hasChrome && typeof chrome.tabs !== 'undefined';

    if (hasRuntime && hasTabs) {
      return {
        feature: 'extensionAPI',
        support: 'full',
        native: true,
        polyfillAvailable: false,
      };
    }

    return {
      feature: 'extensionAPI',
      support: 'unsupported',
      native: false,
      polyfillAvailable: false,
      notes: 'Extension environment required',
    };
  }

  /**
   * Detect Web Components support
   */
  private detectWebComponents(): FeatureDetectionResult {
    const hasCustomElements = 'customElements' in window;
    const hasShadowDOM = 'attachShadow' in Element.prototype;
    const hasTemplates = 'content' in document.createElement('template');

    if (hasCustomElements && hasShadowDOM && hasTemplates) {
      return {
        feature: 'webComponents',
        support: 'full',
        native: true,
        polyfillAvailable: true,
      };
    }

    return {
      feature: 'webComponents',
      support: 'polyfill',
      native: false,
      polyfillAvailable: true,
      notes: 'Requires polyfill for full support',
    };
  }

  /**
   * Detect Shadow DOM support
   */
  private detectShadowDOM(): FeatureDetectionResult {
    const hasAttachShadow = 'attachShadow' in Element.prototype;

    if (hasAttachShadow) {
      return {
        feature: 'shadowDOM',
        support: 'full',
        native: true,
        polyfillAvailable: true,
      };
    }

    return {
      feature: 'shadowDOM',
      support: 'polyfill',
      native: false,
      polyfillAvailable: true,
    };
  }

  /**
   * Detect Custom Elements support
   */
  private detectCustomElements(): FeatureDetectionResult {
    const hasCustomElements = 'customElements' in window;

    if (hasCustomElements) {
      return {
        feature: 'customElements',
        support: 'full',
        native: true,
        polyfillAvailable: true,
      };
    }

    return {
      feature: 'customElements',
      support: 'polyfill',
      native: false,
      polyfillAvailable: true,
    };
  }

  /**
   * Detect Mutation Observer support
   */
  private detectMutationObserver(): FeatureDetectionResult {
    const hasMutationObserver = 'MutationObserver' in window;

    if (hasMutationObserver) {
      return {
        feature: 'mutationObserver',
        support: 'full',
        native: true,
        polyfillAvailable: true,
      };
    }

    return {
      feature: 'mutationObserver',
      support: 'polyfill',
      native: false,
      polyfillAvailable: true,
      notes: 'Can fallback to mutation events',
    };
  }

  /**
   * Detect Intersection Observer support
   */
  private detectIntersectionObserver(): FeatureDetectionResult {
    const hasIntersectionObserver = 'IntersectionObserver' in window;

    if (hasIntersectionObserver) {
      return {
        feature: 'intersectionObserver',
        support: 'full',
        native: true,
        polyfillAvailable: true,
      };
    }

    return {
      feature: 'intersectionObserver',
      support: 'polyfill',
      native: false,
      polyfillAvailable: true,
    };
  }

  /**
   * Detect Broadcast Channel support
   */
  private detectBroadcastChannel(): FeatureDetectionResult {
    const hasBroadcastChannel = 'BroadcastChannel' in window;

    if (hasBroadcastChannel) {
      return {
        feature: 'broadcastChannel',
        support: 'full',
        native: true,
        polyfillAvailable: true,
      };
    }

    return {
      feature: 'broadcastChannel',
      support: 'polyfill',
      native: false,
      polyfillAvailable: true,
      notes: 'Can use storage events as fallback',
    };
  }

  /**
   * Detect Service Worker support
   */
  private detectServiceWorker(): FeatureDetectionResult {
    const hasServiceWorker = 'serviceWorker' in navigator;

    if (hasServiceWorker) {
      return {
        feature: 'serviceWorker',
        support: 'full',
        native: true,
        polyfillAvailable: false,
      };
    }

    return {
      feature: 'serviceWorker',
      support: 'unsupported',
      native: false,
      polyfillAvailable: false,
      notes: 'Requires HTTPS and modern browser',
    };
  }

  /**
   * Detect WebRTC support
   */
  private detectWebRTC(): FeatureDetectionResult {
    const hasRTCPeerConnection =
      'RTCPeerConnection' in window || 'webkitRTCPeerConnection' in window || 'mozRTCPeerConnection' in window;

    if (hasRTCPeerConnection) {
      return {
        feature: 'webRTC',
        support: 'full',
        native: true,
        polyfillAvailable: true,
      };
    }

    return {
      feature: 'webRTC',
      support: 'unsupported',
      native: false,
      polyfillAvailable: false,
    };
  }

  /**
   * Detect Media Recorder support
   */
  private detectMediaRecorder(): FeatureDetectionResult {
    const hasMediaRecorder = 'MediaRecorder' in window;

    if (hasMediaRecorder) {
      return {
        feature: 'mediaRecorder',
        support: 'full',
        native: true,
        polyfillAvailable: true,
      };
    }

    return {
      feature: 'mediaRecorder',
      support: 'polyfill',
      native: false,
      polyfillAvailable: true,
      notes: 'Polyfill available with limited codec support',
    };
  }

  /**
   * Detect Permissions API support
   */
  private detectPermissions(): FeatureDetectionResult {
    const hasPermissions = 'permissions' in navigator;

    if (hasPermissions) {
      return {
        feature: 'permissions',
        support: 'full',
        native: true,
        polyfillAvailable: false,
      };
    }

    return {
      feature: 'permissions',
      support: 'partial',
      native: false,
      polyfillAvailable: false,
      notes: 'Can check specific permissions individually',
    };
  }

  /**
   * Detect Storage API support
   */
  private detectStorage(): FeatureDetectionResult {
    const hasLocalStorage = 'localStorage' in window;
    const hasSessionStorage = 'sessionStorage' in window;
    const hasIndexedDB = 'indexedDB' in window;

    if (hasLocalStorage && hasSessionStorage && hasIndexedDB) {
      return {
        feature: 'storage',
        support: 'full',
        native: true,
        polyfillAvailable: true,
      };
    }

    return {
      feature: 'storage',
      support: 'partial',
      native: hasLocalStorage,
      polyfillAvailable: true,
      notes: 'Some storage APIs may be missing',
    };
  }

  /**
   * Detect Performance Observer support
   */
  private detectPerformanceObserver(): FeatureDetectionResult {
    const hasPerformanceObserver = 'PerformanceObserver' in window;

    if (hasPerformanceObserver) {
      return {
        feature: 'performanceObserver',
        support: 'full',
        native: true,
        polyfillAvailable: false,
      };
    }

    return {
      feature: 'performanceObserver',
      support: 'partial',
      native: false,
      polyfillAvailable: false,
      notes: 'Can use performance.now() as fallback',
    };
  }

  /**
   * Detect Resize Observer support
   */
  private detectResizeObserver(): FeatureDetectionResult {
    const hasResizeObserver = 'ResizeObserver' in window;

    if (hasResizeObserver) {
      return {
        feature: 'resizeObserver',
        support: 'full',
        native: true,
        polyfillAvailable: true,
      };
    }

    return {
      feature: 'resizeObserver',
      support: 'polyfill',
      native: false,
      polyfillAvailable: true,
    };
  }

  /**
   * Get native API
   */
  private getNativeAPI<T>(feature: string): T | null {
    switch (feature) {
      case 'mutationObserver':
        return window.MutationObserver as T;
      case 'intersectionObserver':
        return window.IntersectionObserver as T;
      case 'broadcastChannel':
        return window.BroadcastChannel as T;
      case 'resizeObserver':
        return window.ResizeObserver as T;
      case 'performanceObserver':
        return window.PerformanceObserver as T;
      default:
        return null;
    }
  }

  /**
   * Initialize polyfills
   */
  private initializePolyfills(): void {
    // Intersection Observer polyfill
    this.polyfills.set('intersectionObserver', () => {
      if (!('IntersectionObserver' in window)) {
        // Would load intersection-observer polyfill
        this.log('Loading IntersectionObserver polyfill');
      }
    });

    // Resize Observer polyfill
    this.polyfills.set('resizeObserver', () => {
      if (!('ResizeObserver' in window)) {
        // Would load resize-observer-polyfill
        this.log('Loading ResizeObserver polyfill');
      }
    });

    // Broadcast Channel polyfill
    this.polyfills.set('broadcastChannel', () => {
      if (!('BroadcastChannel' in window)) {
        // Would implement storage-based polyfill
        this.createBroadcastChannelPolyfill();
      }
    });

    // Mutation Observer polyfill
    this.polyfills.set('mutationObserver', () => {
      if (!('MutationObserver' in window)) {
        // Would implement mutation events fallback
        this.createMutationObserverPolyfill();
      }
    });
  }

  /**
   * Initialize fallbacks
   */
  private initializeFallbacks(): void {
    // Custom storage fallback
    this.fallbacks.set('storage', {
      condition: () => !('localStorage' in window),
      implementation: this.createStorageFallback(),
      description: 'In-memory storage fallback',
    });

    // Performance timing fallback
    this.fallbacks.set('performanceObserver', {
      condition: () => !('PerformanceObserver' in window),
      implementation: this.createPerformanceFallback(),
      description: 'Basic performance timing fallback',
    });
  }

  /**
   * Create Broadcast Channel polyfill
   */
  private createBroadcastChannelPolyfill(): void {
    if ('BroadcastChannel' in window) {
      return;
    }

    class BroadcastChannelPolyfill {
      private name: string;
      private listeners: Array<(event: MessageEvent) => void> = [];

      constructor(name: string) {
        this.name = name;
        window.addEventListener('storage', this.handleStorageEvent.bind(this));
      }

      postMessage(data: unknown): void {
        const message = {
          type: 'broadcast-channel-polyfill',
          channel: this.name,
          data,
          timestamp: Date.now(),
        };
        localStorage.setItem(`bc_${this.name}_${Date.now()}`, JSON.stringify(message));
      }

      addEventListener(type: string, listener: (event: MessageEvent) => void): void {
        if (type === 'message') {
          this.listeners.push(listener);
        }
      }

      removeEventListener(type: string, listener: (event: MessageEvent) => void): void {
        if (type === 'message') {
          const index = this.listeners.indexOf(listener);
          if (index > -1) {
            this.listeners.splice(index, 1);
          }
        }
      }

      close(): void {
        this.listeners.length = 0;
        window.removeEventListener('storage', this.handleStorageEvent.bind(this));
      }

      private handleStorageEvent(event: StorageEvent): void {
        if (!event.key?.startsWith(`bc_${this.name}_`) || !event.newValue) {
          return;
        }

        try {
          const message = JSON.parse(event.newValue);
          if (message.type === 'broadcast-channel-polyfill' && message.channel === this.name) {
            const messageEvent = new MessageEvent('message', { data: message.data });
            this.listeners.forEach(listener => listener(messageEvent));
          }
        } catch (_error) {
          // Ignore invalid messages
        }
      }
    }

    interface WindowWithBroadcastChannel extends Window {
      BroadcastChannel?: unknown;
    }
    (window as WindowWithBroadcastChannel).BroadcastChannel = BroadcastChannelPolyfill;
  }

  /**
   * Create Mutation Observer polyfill
   */
  private createMutationObserverPolyfill(): void {
    if ('MutationObserver' in window) {
      return;
    }

    // Simple polyfill using mutation events (deprecated but works in old browsers)
    class MutationObserverPolyfill {
      private callback: MutationCallback;
      private target: Node | null = null;

      constructor(callback: MutationCallback) {
        this.callback = callback;
      }

      observe(target: Node, options: MutationObserverInit): void {
        this.target = target;

        if (options.childList) {
          target.addEventListener('DOMNodeInserted', this.handleMutation.bind(this), false);
          target.addEventListener('DOMNodeRemoved', this.handleMutation.bind(this), false);
        }

        if (options.attributes) {
          target.addEventListener('DOMAttrModified', this.handleMutation.bind(this), false);
        }
      }

      disconnect(): void {
        if (this.target) {
          this.target.removeEventListener('DOMNodeInserted', this.handleMutation.bind(this), false);
          this.target.removeEventListener('DOMNodeRemoved', this.handleMutation.bind(this), false);
          this.target.removeEventListener('DOMAttrModified', this.handleMutation.bind(this), false);
          this.target = null;
        }
      }

      private handleMutation(): void {
        // Simple implementation - would need more work for full compatibility
        const mutations: MutationRecord[] = [];
        this.callback(mutations, this);
      }
    }

    interface WindowWithMutationObserver extends Window {
      MutationObserver?: unknown;
    }
    (window as WindowWithMutationObserver).MutationObserver = MutationObserverPolyfill;
  }

  /**
   * Create storage fallback
   */
  private createStorageFallback(): Storage {
    const storage = new Map<string, string>();

    return {
      getItem: (key: string) => storage.get(key) || null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
      get length() {
        return storage.size;
      },
      key: (index: number) => Array.from(storage.keys())[index] || null,
    };
  }

  /**
   * Create performance fallback
   */
  private createPerformanceFallback(): Performance {
    return {
      now: () => Date.now(),
      mark: () => {},
      measure: () => {},
      getEntriesByType: () => [],
      getEntriesByName: () => [],
    };
  }

  /**
   * Calculate compatibility score
   */
  private calculateCompatibilityScore(): number {
    const features = [
      'extensionAPI',
      'mutationObserver',
      'intersectionObserver',
      'broadcastChannel',
      'storage',
      'performanceObserver',
    ];

    const scores = features.map(feature => {
      const detection = this.detectFeature(feature);
      switch (detection.support) {
        case 'full':
          return 1.0;
        case 'partial':
          return 0.7;
        case 'polyfill':
          return 0.5;
        case 'unsupported':
          return 0.0;
        default:
          return 0.0;
      }
    });

    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  /**
   * Validate browser support
   */
  private validateBrowserSupport(): void {
    if (!this.isVersionSupported()) {
      const message = `Browser ${this.browserInfo.name} ${this.browserInfo.version} may not be fully supported`;

      if (this.config.strictMode) {
        throw new Error(message);
      } else {
        this.log(message);
      }
    }

    // Check essential features
    const essentialFeatures = ['extensionAPI', 'mutationObserver'];
    for (const feature of essentialFeatures) {
      const detection = this.detectFeature(feature);
      if (detection.support === 'unsupported') {
        const message = `Essential feature not supported: ${feature}`;

        if (this.config.strictMode) {
          throw new Error(message);
        } else {
          this.log(message);
        }
      }
    }
  }

  /**
   * Log message
   */
  private log(message: string): void {
    if (this.config.enableFeatureLogging) {
      console.log(`[BrowserCompatibility] ${message}`);
    }
  }
}

// Export singleton instance
export const browserCompatibility = BrowserCompatibility.getInstance();

// Export utility functions
export const compatUtils = {
  /**
   * Get compatibility instance
   */
  getInstance: (config?: Partial<CompatibilityConfig>) => BrowserCompatibility.getInstance(config),

  /**
   * Check if feature is supported
   */
  isSupported: (feature: string): boolean => browserCompatibility.isFeatureSupported(feature),

  /**
   * Get compatible API
   */
  getAPI: <T = unknown>(feature: string): T | null => browserCompatibility.getCompatibleAPI<T>(feature),

  /**
   * Get browser info
   */
  getBrowser: (): BrowserInfo => browserCompatibility.getBrowserInfo(),

  /**
   * Get browser features
   */
  getFeatures: (): BrowserFeatures => browserCompatibility.getBrowserFeatures(),

  /**
   * Check version support
   */
  isVersionSupported: (): boolean => browserCompatibility.isVersionSupported(),

  /**
   * Get compatibility layer
   */
  getCompatibilityLayer: (): CompatibilityLayer => browserCompatibility.getCompatibilityLayer(),

  /**
   * Apply polyfill
   */
  applyPolyfill: (feature: string): boolean => browserCompatibility.applyPolyfill(feature),
};
