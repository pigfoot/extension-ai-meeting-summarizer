/**
 * Browser Compatibility Types
 *
 * Type definitions for cross-browser compatibility, API adaptation,
 * and feature fallback management in content scripts.
 */

/**
 * Supported browser types for the extension
 */
export type SupportedBrowser = 'chrome' | 'firefox' | 'edge' | 'safari';

/**
 * Browser feature capabilities and limitations
 */
export interface BrowserFeatures {
  /** Browser type */
  browser: SupportedBrowser;
  /** Browser version */
  version: string;
  /** Manifest version supported */
  manifestVersion: 2 | 3;
  /** Extension API capabilities */
  apiCapabilities: APICapabilities;
  /** DOM and JavaScript features */
  domFeatures: DOMFeatures;
  /** Content script specific features */
  contentScriptFeatures: ContentScriptFeatures;
  /** Performance characteristics */
  performanceProfile: PerformanceProfile;
  /** Known limitations */
  limitations: BrowserLimitation[];
}

/**
 * Extension API capabilities by browser
 */
export interface APICapabilities {
  /** Chrome extension APIs */
  chrome: {
    /** Storage API support */
    storage: boolean;
    /** Runtime messaging */
    runtime: boolean;
    /** Tabs API */
    tabs: boolean;
    /** Scripting API (MV3) */
    scripting: boolean;
    /** Notifications API */
    notifications: boolean;
    /** Context menus */
    contextMenus: boolean;
    /** Web navigation */
    webNavigation: boolean;
    /** Identity API */
    identity: boolean;
    /** Side panel API */
    sidePanel: boolean;
    /** Offscreen documents */
    offscreen: boolean;
  };
  /** Browser-specific API mappings */
  browserSpecific: {
    /** Firefox uses 'menus' instead of 'contextMenus' */
    menuApiName: 'contextMenus' | 'menus';
    /** Background script type */
    backgroundType: 'service-worker' | 'persistent' | 'event-page';
    /** Content security policy requirements */
    cspRequirements: string[];
  };
  /** Feature detection results */
  featureDetection: {
    /** MutationObserver support */
    mutationObserver: boolean;
    /** IntersectionObserver support */
    intersectionObserver: boolean;
    /** ResizeObserver support */
    resizeObserver: boolean;
    /** CustomElements support */
    customElements: boolean;
    /** Shadow DOM support */
    shadowDOM: boolean;
    /** ES6 modules support */
    esModules: boolean;
  };
}

/**
 * DOM and JavaScript feature support
 */
export interface DOMFeatures {
  /** CSS features */
  css: {
    /** CSS Custom Properties (variables) */
    customProperties: boolean;
    /** CSS Grid support */
    grid: boolean;
    /** CSS Flexbox support */
    flexbox: boolean;
    /** CSS containment */
    containment: boolean;
    /** CSS scroll behavior */
    scrollBehavior: boolean;
  };
  /** JavaScript features */
  javascript: {
    /** ES6+ features support level */
    esVersion: 'es5' | 'es6' | 'es2017' | 'es2018' | 'es2020' | 'es2022';
    /** Async/await support */
    asyncAwait: boolean;
    /** Modules support */
    modules: boolean;
    /** Dynamic imports */
    dynamicImports: boolean;
    /** Optional chaining */
    optionalChaining: boolean;
    /** Nullish coalescing */
    nullishCoalescing: boolean;
  };
  /** DOM API support */
  domAPIs: {
    /** querySelector/querySelectorAll */
    querySelectors: boolean;
    /** addEventListener/removeEventListener */
    eventListeners: boolean;
    /** requestAnimationFrame */
    requestAnimationFrame: boolean;
    /** Intersection Observer */
    intersectionObserver: boolean;
    /** Mutation Observer */
    mutationObserver: boolean;
    /** Resize Observer */
    resizeObserver: boolean;
  };
}

/**
 * Content script specific feature support
 */
export interface ContentScriptFeatures {
  /** Injection capabilities */
  injection: {
    /** Automatic injection support */
    automaticInjection: boolean;
    /** Dynamic injection support */
    dynamicInjection: boolean;
    /** World context isolation */
    worldContext: 'isolated' | 'main' | 'shared' | 'none';
    /** CSS injection support */
    cssInjection: boolean;
  };
  /** Messaging capabilities */
  messaging: {
    /** Runtime messaging */
    runtimeMessaging: boolean;
    /** Port-based messaging */
    portMessaging: boolean;
    /** Cross-frame messaging */
    crossFrameMessaging: boolean;
    /** Message size limits (in bytes) */
    maxMessageSize: number;
  };
  /** DOM manipulation */
  domManipulation: {
    /** Safe DOM insertion */
    safeDOMInsertion: boolean;
    /** Shadow DOM support */
    shadowDOM: boolean;
    /** Custom elements */
    customElements: boolean;
    /** Event delegation */
    eventDelegation: boolean;
  };
  /** Storage access */
  storageAccess: {
    /** Extension storage API */
    extensionStorage: boolean;
    /** Local storage access */
    localStorage: boolean;
    /** Session storage access */
    sessionStorage: boolean;
    /** IndexedDB access */
    indexedDB: boolean;
  };
}

/**
 * Browser performance characteristics
 */
export interface PerformanceProfile {
  /** Memory constraints */
  memory: {
    /** Estimated memory limit (MB) */
    estimatedLimit: number;
    /** Memory pressure handling */
    pressureHandling: 'aggressive' | 'moderate' | 'lenient';
    /** Garbage collection frequency */
    gcFrequency: 'high' | 'medium' | 'low';
  };
  /** Processing performance */
  processing: {
    /** DOM manipulation speed */
    domSpeed: 'fast' | 'medium' | 'slow';
    /** JavaScript execution speed */
    jsSpeed: 'fast' | 'medium' | 'slow';
    /** Event handling responsiveness */
    eventResponsiveness: 'fast' | 'medium' | 'slow';
  };
  /** Network performance */
  network: {
    /** Concurrent request limit */
    maxConcurrentRequests: number;
    /** Request timeout defaults */
    defaultTimeouts: {
      fetch: number;
      xhr: number;
      websocket: number;
    };
  };
}

/**
 * Browser-specific limitations
 */
export interface BrowserLimitation {
  /** Limitation category */
  category: 'api' | 'performance' | 'security' | 'compatibility';
  /** Limitation severity */
  severity: 'critical' | 'major' | 'minor' | 'cosmetic';
  /** Limitation description */
  description: string;
  /** Affected functionality */
  affectedFeatures: string[];
  /** Workaround availability */
  workaround?: LimitationWorkaround;
  /** Impact on user experience */
  userImpact: 'none' | 'minimal' | 'moderate' | 'significant';
}

/**
 * Workaround for browser limitations
 */
export interface LimitationWorkaround {
  /** Workaround type */
  type: 'polyfill' | 'fallback' | 'alternative' | 'graceful-degradation';
  /** Workaround description */
  description: string;
  /** Implementation complexity */
  complexity: 'low' | 'medium' | 'high';
  /** Performance impact */
  performanceImpact: 'none' | 'minimal' | 'moderate' | 'significant';
  /** Workaround function */
  implementation?: () => void;
}

/**
 * Cross-browser compatibility layer interface
 */
export interface CompatibilityLayer {
  /** Browser detection */
  browserInfo: BrowserInfo;
  /** Feature detection results */
  features: BrowserFeatures;
  /** API adapters */
  apiAdapters: APIAdapterRegistry;
  /** Feature fallbacks */
  fallbacks: FeatureFallbackRegistry;
  /** Performance optimizations */
  optimizations: PerformanceOptimizations;
}

/**
 * Browser information
 */
export interface BrowserInfo {
  /** Detected browser type */
  browser: SupportedBrowser;
  /** Browser version */
  version: string;
  /** User agent string */
  userAgent: string;
  /** Platform information */
  platform: {
    os: 'windows' | 'macos' | 'linux' | 'android' | 'ios' | 'unknown';
    arch: 'x86' | 'x64' | 'arm' | 'arm64' | 'unknown';
    mobile: boolean;
  };
  /** Extension runtime information */
  runtime: {
    manifestVersion: 2 | 3;
    extensionId: string;
    contextType: 'content-script' | 'background' | 'popup' | 'options';
  };
}

/**
 * API adapter registry for cross-browser compatibility
 */
export interface APIAdapterRegistry {
  /** Storage API adapter */
  storage: StorageAdapter;
  /** Messaging API adapter */
  messaging: MessagingAdapter;
  /** DOM API adapter */
  dom: DOMAdapter;
  /** Event API adapter */
  events: EventAdapter;
  /** Notification API adapter */
  notifications: NotificationAdapter;
}

/**
 * Storage API adapter for cross-browser compatibility
 */
export interface StorageAdapter {
  /** Get stored value */
  get(key: string): Promise<unknown>;
  /** Set stored value */
  set(key: string, value: unknown): Promise<void>;
  /** Remove stored value */
  remove(key: string): Promise<void>;
  /** Clear all stored values */
  clear(): Promise<void>;
  /** Get storage quota information */
  getQuota(): Promise<{ used: number; available: number }>;
  /** Listen for storage changes */
  onChanged(callback: (changes: StorageChange[]) => void): () => void;
}

/**
 * Storage change event
 */
export interface StorageChange {
  key: string;
  oldValue?: unknown;
  newValue?: unknown;
  areaName: 'local' | 'sync' | 'session';
}

/**
 * Messaging API adapter
 */
export interface MessagingAdapter {
  /** Send message to background */
  sendToBackground<T = unknown>(message: unknown): Promise<T>;
  /** Send message to tab */
  sendToTab<T = unknown>(tabId: number, message: unknown): Promise<T>;
  /** Listen for messages */
  onMessage(callback: (message: unknown, sender: MessageSender) => unknown): () => void;
  /** Create long-lived connection */
  connect(name?: string): MessagePort;
}

/**
 * Message sender information
 */
export interface MessageSender {
  tab?: {
    id: number;
    url: string;
    title: string;
  };
  frameId?: number;
  id?: string;
  url?: string;
}

/**
 * Message port for long-lived connections
 */
export interface MessagePort {
  /** Send message through port */
  postMessage(message: unknown): void;
  /** Listen for messages */
  onMessage(callback: (message: unknown) => void): () => void;
  /** Listen for disconnect events */
  onDisconnect(callback: () => void): () => void;
  /** Disconnect the port */
  disconnect(): void;
}

/**
 * DOM API adapter
 */
export interface DOMAdapter {
  /** Safe element creation */
  createElement(tagName: string, attributes?: Record<string, string>): HTMLElement;
  /** Safe element insertion */
  insertElement(element: HTMLElement, target: Element, position: InsertPosition): boolean;
  /** Element removal with cleanup */
  removeElement(element: HTMLElement): void;
  /** Cross-browser event handling */
  addEventListener(element: Element, event: string, handler: EventListener, options?: EventListenerOptions): () => void;
  /** Safe CSS manipulation */
  setStyles(element: HTMLElement, styles: Record<string, string>): void;
  /** Cross-browser selector matching */
  matches(element: Element, selector: string): boolean;
}

/**
 * Event API adapter
 */
export interface EventAdapter {
  /** Create custom event */
  createEvent(type: string, detail?: unknown): Event;
  /** Dispatch event */
  dispatchEvent(element: Element, event: Event): boolean;
  /** Event delegation */
  delegate(container: Element, selector: string, event: string, handler: EventListener): () => void;
  /** Throttle event handler */
  throttle<T extends (...args: unknown[]) => unknown>(fn: T, delay: number): T;
  /** Debounce event handler */
  debounce<T extends (...args: unknown[]) => unknown>(fn: T, delay: number): T;
}

/**
 * Notification API adapter
 */
export interface NotificationAdapter {
  /** Show notification */
  show(title: string, options: NotificationOptions): Promise<string>;
  /** Clear notification */
  clear(notificationId: string): Promise<void>;
  /** Listen for notification events */
  onClicked(callback: (notificationId: string) => void): () => void;
  /** Check notification permission */
  checkPermission(): Promise<'granted' | 'denied' | 'default'>;
}

/**
 * Notification options
 */
export interface NotificationOptions {
  message: string;
  iconUrl?: string;
  type?: 'basic' | 'image' | 'list' | 'progress';
  priority?: 0 | 1 | 2;
  buttons?: Array<{ title: string; iconUrl?: string }>;
  requireInteraction?: boolean;
  silent?: boolean;
}

/**
 * Feature fallback registry
 */
export interface FeatureFallbackRegistry {
  /** DOM observer fallbacks */
  observers: ObserverFallbacks;
  /** CSS feature fallbacks */
  css: CSSFallbacks;
  /** JavaScript feature fallbacks */
  javascript: JavaScriptFallbacks;
  /** API fallbacks */
  apis: APIFallbacks;
}

/**
 * Observer API fallbacks
 */
export interface ObserverFallbacks {
  /** MutationObserver fallback */
  mutationObserver?: PolyfillFunction;
  /** IntersectionObserver fallback */
  intersectionObserver?: PolyfillFunction;
  /** ResizeObserver fallback */
  resizeObserver?: PolyfillFunction;
}

/**
 * CSS feature fallbacks
 */
export interface CSSFallbacks {
  /** Custom properties fallback */
  customProperties?: PolyfillFunction;
  /** Grid layout fallback */
  grid?: PolyfillFunction;
  /** Flexbox fallback */
  flexbox?: PolyfillFunction;
}

/**
 * JavaScript feature fallbacks
 */
export interface JavaScriptFallbacks {
  /** Promise fallback */
  promises?: PolyfillFunction;
  /** Async/await fallback */
  asyncAwait?: PolyfillFunction;
  /** Array methods fallback */
  arrayMethods?: PolyfillFunction;
  /** Object methods fallback */
  objectMethods?: PolyfillFunction;
}

/**
 * API fallbacks
 */
export interface APIFallbacks {
  /** Fetch API fallback */
  fetch?: PolyfillFunction;
  /** requestAnimationFrame fallback */
  requestAnimationFrame?: PolyfillFunction;
  /** URL API fallback */
  url?: PolyfillFunction;
}

/**
 * Polyfill function type
 */
export type PolyfillFunction = () => void;

/**
 * Performance optimizations for different browsers
 */
export interface PerformanceOptimizations {
  /** DOM manipulation optimizations */
  dom: {
    /** Use document fragments for batch operations */
    useDocumentFragments: boolean;
    /** Throttle DOM updates */
    throttleUpdates: boolean;
    /** Optimize CSS selector usage */
    optimizeSelectors: boolean;
  };
  /** Memory management */
  memory: {
    /** Enable object pooling */
    enableObjectPooling: boolean;
    /** Cleanup intervals */
    cleanupIntervals: {
      dom: number;
      events: number;
      cache: number;
    };
  };
  /** Event handling */
  events: {
    /** Use passive event listeners */
    usePassiveListeners: boolean;
    /** Event delegation threshold */
    delegationThreshold: number;
    /** Debounce frequent events */
    debounceEvents: string[];
  };
}

/**
 * Browser compatibility checker interface
 */
export interface BrowserCompatibilityChecker {
  /** Check if browser meets minimum requirements */
  checkMinimumRequirements(): Promise<CompatibilityResult>;
  /** Detect browser features */
  detectFeatures(): Promise<BrowserFeatures>;
  /** Initialize compatibility layer */
  initializeCompatibilityLayer(): Promise<CompatibilityLayer>;
  /** Get recommended settings for browser */
  getRecommendedSettings(): Promise<BrowserSettings>;
}

/**
 * Compatibility check result
 */
export interface CompatibilityResult {
  /** Whether browser is compatible */
  compatible: boolean;
  /** Browser information */
  browserInfo: BrowserInfo;
  /** Compatibility issues found */
  issues: CompatibilityIssue[];
  /** Recommended actions */
  recommendations: string[];
}

/**
 * Compatibility issue
 */
export interface CompatibilityIssue {
  /** Issue severity */
  severity: 'error' | 'warning' | 'info';
  /** Issue description */
  description: string;
  /** Affected functionality */
  affects: string[];
  /** Possible solutions */
  solutions: string[];
  /** Whether issue is blocking */
  blocking: boolean;
}

/**
 * Browser-specific settings
 */
export interface BrowserSettings {
  /** Performance settings */
  performance: {
    /** Batch size for DOM operations */
    domBatchSize: number;
    /** Animation frame throttling */
    animationFrameThrottle: number;
    /** Memory cleanup frequency */
    memoryCleanupFrequency: number;
  };
  /** Security settings */
  security: {
    /** Content Security Policy */
    csp: string;
    /** Sandbox restrictions */
    sandbox: string[];
    /** HTTPS enforcement */
    httpsOnly: boolean;
  };
  /** Feature toggles */
  features: {
    /** Enable advanced features */
    enableAdvancedFeatures: boolean;
    /** Use experimental APIs */
    useExperimentalAPIs: boolean;
    /** Enable debug mode */
    debugMode: boolean;
  };
}
