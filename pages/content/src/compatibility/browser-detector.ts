/**
 * Browser Detector
 *
 * Browser and version detection with feature capability assessment
 * for different browsers and cross-browser compatibility.
 */

/**
 * Supported browser types
 */
export type BrowserType = 'chrome' | 'firefox' | 'safari' | 'edge' | 'opera' | 'brave' | 'chromium' | 'unknown';

/**
 * Browser platform types
 */
export type BrowserPlatform = 'windows' | 'macos' | 'linux' | 'android' | 'ios' | 'unknown';

/**
 * Browser engine types
 */
export type BrowserEngine = 'blink' | 'gecko' | 'webkit' | 'edge-html' | 'unknown';

/**
 * Browser detection result
 */
export interface BrowserInfo {
  /** Browser type */
  type: BrowserType;
  /** Browser name */
  name: string;
  /** Browser version */
  version: string;
  /** Major version number */
  majorVersion: number;
  /** Browser engine */
  engine: BrowserEngine;
  /** Engine version */
  engineVersion: string;
  /** Platform information */
  platform: BrowserPlatform;
  /** User agent string */
  userAgent: string;
  /** Whether browser is mobile */
  isMobile: boolean;
  /** Whether browser is in private/incognito mode */
  isPrivate: boolean;
  /** Browser capabilities */
  capabilities: BrowserCapabilities;
  /** Browser limitations */
  limitations: BrowserLimitations;
  /** Feature support matrix */
  features: FeatureSupportMatrix;
}

/**
 * Browser capabilities
 */
export interface BrowserCapabilities {
  /** Extension API support */
  extensions: {
    manifestV3: boolean;
    manifestV2: boolean;
    contentScripts: boolean;
    backgroundService: boolean;
    webAccessibleResources: boolean;
    crossOriginRequests: boolean;
    storageApi: boolean;
    messagePassingApi: boolean;
  };
  /** Web APIs support */
  webApis: {
    fetch: boolean;
    webWorkers: boolean;
    serviceWorkers: boolean;
    webAssembly: boolean;
    webRTC: boolean;
    mediaRecorder: boolean;
    speechRecognition: boolean;
    notifications: boolean;
    clipboard: boolean;
    fullscreen: boolean;
  };
  /** DOM features */
  dom: {
    mutationObserver: boolean;
    intersectionObserver: boolean;
    resizeObserver: boolean;
    customElements: boolean;
    shadowDOM: boolean;
    webComponents: boolean;
  };
  /** JavaScript features */
  javascript: {
    es6: boolean;
    es2017: boolean;
    es2020: boolean;
    modules: boolean;
    dynamicImports: boolean;
    asyncAwait: boolean;
    promises: boolean;
    weakMap: boolean;
    proxy: boolean;
  };
  /** CSS features */
  css: {
    grid: boolean;
    flexbox: boolean;
    customProperties: boolean;
    containment: boolean;
    transforms3d: boolean;
    animations: boolean;
    transitions: boolean;
  };
  /** Media capabilities */
  media: {
    audioContext: boolean;
    videoPlayback: boolean;
    mediaStreams: boolean;
    webm: boolean;
    h264: boolean;
    av1: boolean;
  };
}

/**
 * Browser limitations
 */
export interface BrowserLimitations {
  /** Maximum values */
  maxValues: {
    localStorage: number;
    sessionStorage: number;
    indexedDB: number;
    webWorkers: number;
    connections: number;
    fileSize: number;
  };
  /** Security restrictions */
  security: {
    crossOriginIframes: boolean;
    mixedContent: boolean;
    selfSignedCerts: boolean;
    cookieRestrictions: boolean;
    corsRestrictions: boolean;
  };
  /** Performance limitations */
  performance: {
    slowJavaScript: boolean;
    limitedMemory: boolean;
    slowNetworking: boolean;
    batterySaving: boolean;
  };
  /** Feature restrictions */
  features: {
    noAutoplay: boolean;
    noPopups: boolean;
    noFullscreen: boolean;
    noClipboard: boolean;
    noNotifications: boolean;
  };
}

/**
 * Feature support matrix
 */
export interface FeatureSupportMatrix {
  /** Content script features */
  contentScripts: {
    dynamicInjection: boolean;
    crossFrame: boolean;
    documentStart: boolean;
    documentEnd: boolean;
    allFrames: boolean;
    matchAboutBlank: boolean;
  };
  /** Message passing features */
  messaging: {
    runtimeConnect: boolean;
    runtimeSendMessage: boolean;
    onMessage: boolean;
    onConnect: boolean;
    onDisconnect: boolean;
    externalMessage: boolean;
  };
  /** Storage features */
  storage: {
    local: boolean;
    sync: boolean;
    managed: boolean;
    session: boolean;
    unlimitedStorage: boolean;
  };
  /** Permission features */
  permissions: {
    activeTab: boolean;
    tabs: boolean;
    host: boolean;
    scripting: boolean;
    storage: boolean;
    webRequest: boolean;
  };
}

/**
 * Browser compatibility report
 */
export interface CompatibilityReport {
  /** Overall compatibility score (0-100) */
  score: number;
  /** Compatibility level */
  level: 'excellent' | 'good' | 'fair' | 'poor' | 'unsupported';
  /** Supported features */
  supportedFeatures: string[];
  /** Unsupported features */
  unsupportedFeatures: string[];
  /** Recommended workarounds */
  workarounds: CompatibilityWorkaround[];
  /** Performance recommendations */
  recommendations: string[];
  /** Known issues */
  knownIssues: BrowserIssue[];
}

/**
 * Compatibility workaround
 */
export interface CompatibilityWorkaround {
  /** Feature being worked around */
  feature: string;
  /** Workaround description */
  description: string;
  /** Implementation strategy */
  strategy: 'polyfill' | 'fallback' | 'graceful-degradation' | 'alternative-api';
  /** Performance impact */
  performanceImpact: 'none' | 'minimal' | 'moderate' | 'significant';
  /** Compatibility level achieved */
  compatibilityLevel: 'full' | 'partial' | 'basic';
}

/**
 * Known browser issue
 */
export interface BrowserIssue {
  /** Issue identifier */
  id: string;
  /** Issue description */
  description: string;
  /** Affected versions */
  affectedVersions: string[];
  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Workaround available */
  hasWorkaround: boolean;
  /** Issue status */
  status: 'open' | 'fixed' | 'wontfix' | 'investigating';
  /** Reference links */
  references: string[];
}

/**
 * Browser detector for identifying browser capabilities and limitations
 */
export class BrowserDetector {
  private browserInfo: BrowserInfo | null = null;
  private compatibilityReport: CompatibilityReport | null = null;
  private featureCache: Map<string, boolean> = new Map();

  constructor() {
    this.detectBrowser();
  }

  /**
   * Get comprehensive browser information
   */
  getBrowserInfo(): BrowserInfo {
    if (!this.browserInfo) {
      this.detectBrowser();
    }
    return this.browserInfo!;
  }

  /**
   * Get browser compatibility report
   */
  getCompatibilityReport(): CompatibilityReport {
    if (!this.compatibilityReport) {
      this.generateCompatibilityReport();
    }
    return this.compatibilityReport!;
  }

  /**
   * Check if specific feature is supported
   */
  isFeatureSupported(feature: string): boolean {
    if (this.featureCache.has(feature)) {
      return this.featureCache.get(feature)!;
    }

    const supported = this.checkFeatureSupport(feature);
    this.featureCache.set(feature, supported);
    return supported;
  }

  /**
   * Get recommended polyfills
   */
  getRecommendedPolyfills(): string[] {
    const polyfills: string[] = [];
    const info = this.getBrowserInfo();

    // Check for missing features and recommend polyfills
    if (!info.capabilities.javascript.es6) {
      polyfills.push('core-js', 'babel-polyfill');
    }

    if (!info.capabilities.javascript.promises) {
      polyfills.push('es6-promise');
    }

    if (!info.capabilities.webApis.fetch) {
      polyfills.push('whatwg-fetch');
    }

    if (!info.capabilities.dom.mutationObserver) {
      polyfills.push('mutation-observer');
    }

    if (!info.capabilities.dom.intersectionObserver) {
      polyfills.push('intersection-observer');
    }

    return polyfills;
  }

  /**
   * Get browser performance tier
   */
  getPerformanceTier(): 'high' | 'medium' | 'low' {
    const info = this.getBrowserInfo();

    // High performance browsers
    if (
      ['chrome', 'firefox', 'safari', 'edge'].includes(info.type) &&
      info.majorVersion >= 90 &&
      !info.isMobile &&
      !info.limitations.performance.slowJavaScript
    ) {
      return 'high';
    }

    // Low performance indicators
    if (
      info.isMobile ||
      info.limitations.performance.slowJavaScript ||
      info.limitations.performance.limitedMemory ||
      info.majorVersion < 80
    ) {
      return 'low';
    }

    return 'medium';
  }

  /**
   * Check if browser is officially supported
   */
  isOfficiallySupported(): boolean {
    const info = this.getBrowserInfo();

    // Supported browsers with minimum versions
    const supportedBrowsers: Record<BrowserType, number> = {
      chrome: 88,
      firefox: 78,
      safari: 14,
      edge: 88,
      opera: 74,
      brave: 88,
      chromium: 88,
      unknown: 0,
    };

    const minVersion = supportedBrowsers[info.type];
    return minVersion > 0 && info.majorVersion >= minVersion;
  }

  /**
   * Detect browser information
   */
  private detectBrowser(): void {
    const userAgent = navigator.userAgent;
    const type = this.detectBrowserType(userAgent);
    const version = this.detectBrowserVersion(userAgent, type);
    const majorVersion = this.extractMajorVersion(version);
    const engine = this.detectBrowserEngine(userAgent, type);
    const engineVersion = this.detectEngineVersion(userAgent, engine);
    const platform = this.detectPlatform(userAgent);
    const isMobile = this.detectMobileDevice(userAgent);
    const isPrivate = this.detectPrivateMode();

    this.browserInfo = {
      type,
      name: this.getBrowserName(type),
      version,
      majorVersion,
      engine,
      engineVersion,
      platform,
      userAgent,
      isMobile,
      isPrivate,
      capabilities: this.detectCapabilities(),
      limitations: this.detectLimitations(),
      features: this.detectFeatureSupport(),
    };
  }

  /**
   * Detect browser type from user agent
   */
  private detectBrowserType(userAgent: string): BrowserType {
    const ua = userAgent.toLowerCase();

    // Check for specific browsers
    if (ua.includes('edg/')) return 'edge';
    if (ua.includes('opr/') || ua.includes('opera/')) return 'opera';
    if (ua.includes('brave/')) return 'brave';
    if (ua.includes('firefox/')) return 'firefox';
    if (ua.includes('safari/') && !ua.includes('chrome/')) return 'safari';
    if (ua.includes('chrome/') && !ua.includes('chromium/')) return 'chrome';
    if (ua.includes('chromium/')) return 'chromium';

    return 'unknown';
  }

  /**
   * Detect browser version
   */
  private detectBrowserVersion(userAgent: string, type: BrowserType): string {
    const ua = userAgent.toLowerCase();
    let versionMatch: RegExpMatchArray | null = null;

    switch (type) {
      case 'chrome':
        versionMatch = ua.match(/chrome\/([\d.]+)/);
        break;
      case 'firefox':
        versionMatch = ua.match(/firefox\/([\d.]+)/);
        break;
      case 'safari':
        versionMatch = ua.match(/version\/([\d.]+)/);
        break;
      case 'edge':
        versionMatch = ua.match(/edg\/([\d.]+)/);
        break;
      case 'opera':
        versionMatch = ua.match(/(?:opr|opera)\/([\d.]+)/);
        break;
      case 'brave':
        versionMatch = ua.match(/brave\/([\d.]+)/);
        break;
      case 'chromium':
        versionMatch = ua.match(/chromium\/([\d.]+)/);
        break;
    }

    return versionMatch ? versionMatch[1] : 'unknown';
  }

  /**
   * Extract major version number
   */
  private extractMajorVersion(version: string): number {
    const major = version.split('.')[0];
    return parseInt(major, 10) || 0;
  }

  /**
   * Detect browser engine
   */
  private detectBrowserEngine(userAgent: string, type: BrowserType): BrowserEngine {
    const ua = userAgent.toLowerCase();

    switch (type) {
      case 'chrome':
      case 'edge':
      case 'opera':
      case 'brave':
      case 'chromium':
        return 'blink';
      case 'firefox':
        return 'gecko';
      case 'safari':
        return 'webkit';
      default:
        if (ua.includes('webkit')) return 'webkit';
        if (ua.includes('gecko')) return 'gecko';
        if (ua.includes('trident')) return 'edge-html';
        return 'unknown';
    }
  }

  /**
   * Detect engine version
   */
  private detectEngineVersion(userAgent: string, engine: BrowserEngine): string {
    const ua = userAgent.toLowerCase();
    let versionMatch: RegExpMatchArray | null = null;

    switch (engine) {
      case 'blink':
        versionMatch = ua.match(/chrome\/([\d.]+)/);
        break;
      case 'gecko':
        versionMatch = ua.match(/rv:([\d.]+)/);
        break;
      case 'webkit':
        versionMatch = ua.match(/webkit\/([\d.]+)/);
        break;
      case 'edge-html':
        versionMatch = ua.match(/edge\/([\d.]+)/);
        break;
    }

    return versionMatch ? versionMatch[1] : 'unknown';
  }

  /**
   * Detect platform
   */
  private detectPlatform(userAgent: string): BrowserPlatform {
    const ua = userAgent.toLowerCase();

    if (ua.includes('windows')) return 'windows';
    if (ua.includes('macintosh') || ua.includes('mac os')) return 'macos';
    if (ua.includes('linux')) return 'linux';
    if (ua.includes('android')) return 'android';
    if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) return 'ios';

    return 'unknown';
  }

  /**
   * Detect mobile device
   */
  private detectMobileDevice(userAgent: string): boolean {
    const ua = userAgent.toLowerCase();
    const mobileIndicators = [
      'mobile',
      'android',
      'iphone',
      'ipad',
      'ipod',
      'blackberry',
      'windows phone',
      'opera mini',
    ];

    return mobileIndicators.some(indicator => ua.includes(indicator));
  }

  /**
   * Detect private/incognito mode
   */
  private detectPrivateMode(): boolean {
    try {
      // Chrome/Edge incognito detection
      if ('webkitRequestFileSystem' in window) {
        return new Promise<boolean>(resolve => {
          const w = window as {
            webkitRequestFileSystem?: (type: number, size: number, success: () => void, error: () => void) => void;
            TEMPORARY?: number;
          };
          if (w.webkitRequestFileSystem && w.TEMPORARY) {
            w.webkitRequestFileSystem(
              w.TEMPORARY,
              1,
              () => resolve(false),
              () => resolve(true),
            );
          } else {
            resolve(false);
          }
        });
      }

      // Firefox private mode detection
      if ('MozAppearance' in document.documentElement.style) {
        const db = indexedDB.open('test');
        db.onerror = () => true;
        db.onsuccess = () => false;
        return db as unknown;
      }

      // Safari private mode detection
      try {
        localStorage.setItem('test', '1');
        localStorage.removeItem('test');
        return false;
      } catch {
        return true;
      }
    } catch {
      return false;
    }
  }

  /**
   * Get browser display name
   */
  private getBrowserName(type: BrowserType): string {
    const names: Record<BrowserType, string> = {
      chrome: 'Google Chrome',
      firefox: 'Mozilla Firefox',
      safari: 'Safari',
      edge: 'Microsoft Edge',
      opera: 'Opera',
      brave: 'Brave',
      chromium: 'Chromium',
      unknown: 'Unknown Browser',
    };

    return names[type];
  }

  /**
   * Detect browser capabilities
   */
  private detectCapabilities(): BrowserCapabilities {
    return {
      extensions: {
        manifestV3: this.hasManifestV3Support(),
        manifestV2: this.hasManifestV2Support(),
        contentScripts: this.hasContentScriptSupport(),
        backgroundService: this.hasBackgroundServiceSupport(),
        webAccessibleResources: this.hasWebAccessibleResourcesSupport(),
        crossOriginRequests: this.hasCrossOriginRequestSupport(),
        storageApi: this.hasStorageApiSupport(),
        messagePassingApi: this.hasMessagePassingSupport(),
      },
      webApis: {
        fetch: typeof fetch !== 'undefined',
        webWorkers: typeof Worker !== 'undefined',
        serviceWorkers: 'serviceWorker' in navigator,
        webAssembly: typeof WebAssembly !== 'undefined',
        webRTC: 'RTCPeerConnection' in window,
        mediaRecorder: 'MediaRecorder' in window,
        speechRecognition: 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window,
        notifications: 'Notification' in window,
        clipboard: 'clipboard' in navigator,
        fullscreen: 'requestFullscreen' in document.documentElement,
      },
      dom: {
        mutationObserver: typeof MutationObserver !== 'undefined',
        intersectionObserver: typeof IntersectionObserver !== 'undefined',
        resizeObserver: typeof ResizeObserver !== 'undefined',
        customElements: 'customElements' in window,
        shadowDOM: 'attachShadow' in Element.prototype,
        webComponents: 'customElements' in window && 'attachShadow' in Element.prototype,
      },
      javascript: {
        es6: this.hasES6Support(),
        es2017: this.hasES2017Support(),
        es2020: this.hasES2020Support(),
        modules: this.hasModuleSupport(),
        dynamicImports: this.hasDynamicImportSupport(),
        asyncAwait: this.hasAsyncAwaitSupport(),
        promises: typeof Promise !== 'undefined',
        weakMap: typeof WeakMap !== 'undefined',
        proxy: typeof Proxy !== 'undefined',
      },
      css: {
        grid: CSS.supports('display', 'grid'),
        flexbox: CSS.supports('display', 'flex'),
        customProperties: CSS.supports('--custom-property', 'value'),
        containment: CSS.supports('contain', 'layout'),
        transforms3d: CSS.supports('transform', 'translateZ(0)'),
        animations: CSS.supports('animation', 'test'),
        transitions: CSS.supports('transition', 'test'),
      },
      media: {
        audioContext: 'AudioContext' in window || 'webkitAudioContext' in window,
        videoPlayback: 'HTMLVideoElement' in window,
        mediaStreams: 'MediaStream' in window,
        webm: this.hasVideoFormatSupport('webm'),
        h264: this.hasVideoFormatSupport('h264'),
        av1: this.hasVideoFormatSupport('av1'),
      },
    };
  }

  /**
   * Detect browser limitations
   */
  private detectLimitations(): BrowserLimitations {
    const _info = this.getBrowserInfo();

    return {
      maxValues: {
        localStorage: this.getLocalStorageLimit(),
        sessionStorage: this.getSessionStorageLimit(),
        indexedDB: this.getIndexedDBLimit(),
        webWorkers: this.getWebWorkerLimit(),
        connections: this.getConnectionLimit(),
        fileSize: this.getFileSizeLimit(),
      },
      security: {
        crossOriginIframes: this.hasCrossOriginIframeRestrictions(),
        mixedContent: this.hasMixedContentRestrictions(),
        selfSignedCerts: this.hasSelfSignedCertRestrictions(),
        cookieRestrictions: this.hasCookieRestrictions(),
        corsRestrictions: this.hasCorsRestrictions(),
      },
      performance: {
        slowJavaScript: this.hasSlowJavaScriptExecution(),
        limitedMemory: this.hasLimitedMemory(),
        slowNetworking: this.hasSlowNetworking(),
        batterySaving: this.hasBatterySavingMode(),
      },
      features: {
        noAutoplay: this.hasAutoplayRestrictions(),
        noPopups: this.hasPopupRestrictions(),
        noFullscreen: this.hasFullscreenRestrictions(),
        noClipboard: this.hasClipboardRestrictions(),
        noNotifications: this.hasNotificationRestrictions(),
      },
    };
  }

  /**
   * Detect feature support matrix
   */
  private detectFeatureSupport(): FeatureSupportMatrix {
    return {
      contentScripts: {
        dynamicInjection: this.hasContentScriptDynamicInjection(),
        crossFrame: this.hasContentScriptCrossFrame(),
        documentStart: this.hasContentScriptDocumentStart(),
        documentEnd: this.hasContentScriptDocumentEnd(),
        allFrames: this.hasContentScriptAllFrames(),
        matchAboutBlank: this.hasContentScriptMatchAboutBlank(),
      },
      messaging: {
        runtimeConnect: this.hasRuntimeConnect(),
        runtimeSendMessage: this.hasRuntimeSendMessage(),
        onMessage: this.hasOnMessage(),
        onConnect: this.hasOnConnect(),
        onDisconnect: this.hasOnDisconnect(),
        externalMessage: this.hasExternalMessage(),
      },
      storage: {
        local: this.hasLocalStorage(),
        sync: this.hasSyncStorage(),
        managed: this.hasManagedStorage(),
        session: this.hasSessionStorage(),
        unlimitedStorage: this.hasUnlimitedStorage(),
      },
      permissions: {
        activeTab: this.hasActiveTabPermission(),
        tabs: this.hasTabsPermission(),
        host: this.hasHostPermission(),
        scripting: this.hasScriptingPermission(),
        storage: this.hasStoragePermission(),
        webRequest: this.hasWebRequestPermission(),
      },
    };
  }

  /**
   * Generate compatibility report
   */
  private generateCompatibilityReport(): void {
    const info = this.getBrowserInfo();
    const supportedFeatures: string[] = [];
    const unsupportedFeatures: string[] = [];
    const workarounds: CompatibilityWorkaround[] = [];
    const recommendations: string[] = [];
    const knownIssues: BrowserIssue[] = [];

    // Analyze features
    this.analyzeExtensionFeatures(supportedFeatures, unsupportedFeatures, workarounds);
    this.analyzeWebApiFeatures(supportedFeatures, unsupportedFeatures, workarounds);
    this.analyzeDomFeatures(supportedFeatures, unsupportedFeatures, workarounds);

    // Generate recommendations
    if (info.majorVersion < 90) {
      recommendations.push('Consider upgrading to a newer browser version for better performance');
    }

    if (info.isMobile) {
      recommendations.push('Mobile browser detected - some features may have limited functionality');
    }

    // Add known issues
    knownIssues.push(...this.getKnownIssues(info));

    // Calculate compatibility score
    const totalFeatures = supportedFeatures.length + unsupportedFeatures.length;
    const score = totalFeatures > 0 ? (supportedFeatures.length / totalFeatures) * 100 : 0;

    // Determine compatibility level
    let level: CompatibilityReport['level'];
    if (score >= 90) level = 'excellent';
    else if (score >= 75) level = 'good';
    else if (score >= 60) level = 'fair';
    else if (score >= 40) level = 'poor';
    else level = 'unsupported';

    this.compatibilityReport = {
      score,
      level,
      supportedFeatures,
      unsupportedFeatures,
      workarounds,
      recommendations,
      knownIssues,
    };
  }

  /**
   * Check specific feature support
   */
  private checkFeatureSupport(feature: string): boolean {
    // Implementation would check specific features
    // This is a simplified version
    const info = this.getBrowserInfo();

    switch (feature) {
      case 'content-scripts':
        return info.capabilities.extensions.contentScripts;
      case 'background-service':
        return info.capabilities.extensions.backgroundService;
      case 'storage-api':
        return info.capabilities.extensions.storageApi;
      case 'fetch':
        return info.capabilities.webApis.fetch;
      case 'web-workers':
        return info.capabilities.webApis.webWorkers;
      case 'mutation-observer':
        return info.capabilities.dom.mutationObserver;
      default:
        return false;
    }
  }

  // Helper methods for capability detection
  private hasManifestV3Support(): boolean {
    return (
      typeof chrome !== 'undefined' &&
      chrome.runtime &&
      chrome.runtime.getManifest &&
      chrome.runtime.getManifest().manifest_version === 3
    );
  }

  private hasManifestV2Support(): boolean {
    return typeof chrome !== 'undefined' && chrome.runtime;
  }

  private hasContentScriptSupport(): boolean {
    return typeof chrome !== 'undefined' && chrome.scripting;
  }

  private hasBackgroundServiceSupport(): boolean {
    return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onStartup;
  }

  private hasWebAccessibleResourcesSupport(): boolean {
    return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL;
  }

  private hasCrossOriginRequestSupport(): boolean {
    return typeof chrome !== 'undefined' && chrome.runtime;
  }

  private hasStorageApiSupport(): boolean {
    return typeof chrome !== 'undefined' && chrome.storage;
  }

  private hasMessagePassingSupport(): boolean {
    return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage;
  }

  private hasES6Support(): boolean {
    try {
      eval('class Test {}; const test = () => {}; let test2 = 1;');
      return true;
    } catch {
      return false;
    }
  }

  private hasES2017Support(): boolean {
    try {
      eval('async function test() { await Promise.resolve(); }');
      return true;
    } catch {
      return false;
    }
  }

  private hasES2020Support(): boolean {
    try {
      eval('const test = obj?.prop ?? "default";');
      return true;
    } catch {
      return false;
    }
  }

  private hasModuleSupport(): boolean {
    const script = document.createElement('script');
    return 'noModule' in script;
  }

  private hasDynamicImportSupport(): boolean {
    try {
      eval('import("./test.js")');
      return true;
    } catch {
      return false;
    }
  }

  private hasAsyncAwaitSupport(): boolean {
    try {
      eval('async function test() { await 1; }');
      return true;
    } catch {
      return false;
    }
  }

  private hasVideoFormatSupport(format: string): boolean {
    const video = document.createElement('video');
    switch (format) {
      case 'webm':
        return video.canPlayType('video/webm') !== '';
      case 'h264':
        return video.canPlayType('video/mp4; codecs="avc1.42E01E"') !== '';
      case 'av1':
        return video.canPlayType('video/mp4; codecs="av01.0.05M.08"') !== '';
      default:
        return false;
    }
  }

  // Storage and performance limit detection methods
  private getLocalStorageLimit(): number {
    // Simplified - would need actual testing
    return 5 * 1024 * 1024; // 5MB typical
  }

  private getSessionStorageLimit(): number {
    return 5 * 1024 * 1024; // 5MB typical
  }

  private getIndexedDBLimit(): number {
    // Browser dependent, simplified
    return 50 * 1024 * 1024; // 50MB minimum
  }

  private getWebWorkerLimit(): number {
    return navigator.hardwareConcurrency || 4;
  }

  private getConnectionLimit(): number {
    return 6; // Typical HTTP/1.1 limit
  }

  private getFileSizeLimit(): number {
    return 100 * 1024 * 1024; // 100MB typical
  }

  // Security restriction detection methods
  private hasCrossOriginIframeRestrictions(): boolean {
    return true; // Most browsers have these restrictions
  }

  private hasMixedContentRestrictions(): boolean {
    return location.protocol === 'https:';
  }

  private hasSelfSignedCertRestrictions(): boolean {
    return true; // Modern browsers restrict these
  }

  private hasCookieRestrictions(): boolean {
    return true; // SameSite restrictions
  }

  private hasCorsRestrictions(): boolean {
    return true; // All browsers have CORS
  }

  // Performance limitation detection
  private hasSlowJavaScriptExecution(): boolean {
    const info = this.getBrowserInfo();
    return info.isMobile || info.majorVersion < 80;
  }

  private hasLimitedMemory(): boolean {
    return navigator.deviceMemory ? navigator.deviceMemory < 4 : false;
  }

  private hasSlowNetworking(): boolean {
    const nav = navigator as { connection?: { effectiveType?: string } };
    return nav.connection?.effectiveType === 'slow-2g' || nav.connection?.effectiveType === '2g';
  }

  private hasBatterySavingMode(): boolean {
    const nav = navigator as { getBattery?: () => unknown };
    return nav.getBattery ? false : false; // Would need battery API
  }

  // Feature restriction detection
  private hasAutoplayRestrictions(): boolean {
    return true; // Most browsers now restrict autoplay
  }

  private hasPopupRestrictions(): boolean {
    return true; // All browsers restrict popups
  }

  private hasFullscreenRestrictions(): boolean {
    return false; // Generally supported
  }

  private hasClipboardRestrictions(): boolean {
    return location.protocol !== 'https:';
  }

  private hasNotificationRestrictions(): boolean {
    return Notification.permission === 'denied';
  }

  // Extension-specific feature detection
  private hasContentScriptDynamicInjection(): boolean {
    return typeof chrome !== 'undefined' && chrome.scripting && chrome.scripting.executeScript;
  }

  private hasContentScriptCrossFrame(): boolean {
    return this.hasContentScriptSupport();
  }

  private hasContentScriptDocumentStart(): boolean {
    return this.hasContentScriptSupport();
  }

  private hasContentScriptDocumentEnd(): boolean {
    return this.hasContentScriptSupport();
  }

  private hasContentScriptAllFrames(): boolean {
    return this.hasContentScriptSupport();
  }

  private hasContentScriptMatchAboutBlank(): boolean {
    return this.hasContentScriptSupport();
  }

  private hasRuntimeConnect(): boolean {
    return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.connect;
  }

  private hasRuntimeSendMessage(): boolean {
    return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage;
  }

  private hasOnMessage(): boolean {
    return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage;
  }

  private hasOnConnect(): boolean {
    return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onConnect;
  }

  private hasOnDisconnect(): boolean {
    return this.hasOnConnect();
  }

  private hasExternalMessage(): boolean {
    return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessageExternal;
  }

  private hasLocalStorage(): boolean {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  }

  private hasSyncStorage(): boolean {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync;
  }

  private hasManagedStorage(): boolean {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.managed;
  }

  private hasSessionStorage(): boolean {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session;
  }

  private hasUnlimitedStorage(): boolean {
    return this.hasStorageApiSupport();
  }

  private hasActiveTabPermission(): boolean {
    return this.hasContentScriptSupport();
  }

  private hasTabsPermission(): boolean {
    return typeof chrome !== 'undefined' && chrome.tabs;
  }

  private hasHostPermission(): boolean {
    return this.hasContentScriptSupport();
  }

  private hasScriptingPermission(): boolean {
    return typeof chrome !== 'undefined' && chrome.scripting;
  }

  private hasStoragePermission(): boolean {
    return this.hasStorageApiSupport();
  }

  private hasWebRequestPermission(): boolean {
    return typeof chrome !== 'undefined' && chrome.webRequest;
  }

  // Feature analysis methods
  private analyzeExtensionFeatures(
    supported: string[],
    unsupported: string[],
    workarounds: CompatibilityWorkaround[],
  ): void {
    const capabilities = this.browserInfo!.capabilities.extensions;

    if (capabilities.contentScripts) {
      supported.push('Content Scripts');
    } else {
      unsupported.push('Content Scripts');
      workarounds.push({
        feature: 'Content Scripts',
        description: 'Use alternative injection methods',
        strategy: 'alternative-api',
        performanceImpact: 'moderate',
        compatibilityLevel: 'partial',
      });
    }

    if (capabilities.backgroundService) {
      supported.push('Background Service');
    } else {
      unsupported.push('Background Service');
    }

    if (capabilities.storageApi) {
      supported.push('Storage API');
    } else {
      unsupported.push('Storage API');
      workarounds.push({
        feature: 'Storage API',
        description: 'Use localStorage/sessionStorage',
        strategy: 'fallback',
        performanceImpact: 'minimal',
        compatibilityLevel: 'basic',
      });
    }
  }

  private analyzeWebApiFeatures(
    supported: string[],
    unsupported: string[],
    workarounds: CompatibilityWorkaround[],
  ): void {
    const capabilities = this.browserInfo!.capabilities.webApis;

    if (capabilities.fetch) {
      supported.push('Fetch API');
    } else {
      unsupported.push('Fetch API');
      workarounds.push({
        feature: 'Fetch API',
        description: 'Use XMLHttpRequest or axios',
        strategy: 'polyfill',
        performanceImpact: 'minimal',
        compatibilityLevel: 'full',
      });
    }

    if (capabilities.webWorkers) {
      supported.push('Web Workers');
    } else {
      unsupported.push('Web Workers');
    }
  }

  private analyzeDomFeatures(supported: string[], unsupported: string[], workarounds: CompatibilityWorkaround[]): void {
    const capabilities = this.browserInfo!.capabilities.dom;

    if (capabilities.mutationObserver) {
      supported.push('MutationObserver');
    } else {
      unsupported.push('MutationObserver');
      workarounds.push({
        feature: 'MutationObserver',
        description: 'Use mutation events or polling',
        strategy: 'polyfill',
        performanceImpact: 'significant',
        compatibilityLevel: 'partial',
      });
    }
  }

  private getKnownIssues(info: BrowserInfo): BrowserIssue[] {
    const issues: BrowserIssue[] = [];

    // Add known issues based on browser type and version
    if (info.type === 'firefox' && info.majorVersion < 78) {
      issues.push({
        id: 'firefox-manifest-v3',
        description: 'Manifest V3 not fully supported',
        affectedVersions: ['< 78'],
        severity: 'high',
        hasWorkaround: true,
        status: 'fixed',
        references: ['https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions'],
      });
    }

    if (info.type === 'safari' && info.majorVersion < 14) {
      issues.push({
        id: 'safari-extension-api',
        description: 'Limited extension API support',
        affectedVersions: ['< 14'],
        severity: 'medium',
        hasWorkaround: false,
        status: 'fixed',
        references: ['https://developer.apple.com/safari/'],
      });
    }

    return issues;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.featureCache.clear();
    this.browserInfo = null;
    this.compatibilityReport = null;
  }
}

// Export singleton instance
export const browserDetector = new BrowserDetector();
