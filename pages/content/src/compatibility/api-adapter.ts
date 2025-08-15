/**
 * API Adapter
 *
 * Cross-browser API adaptation layer with fallback implementations
 * for missing features and browser-specific API differences.
 */

import { browserDetector } from './browser-detector';
import { eventManager } from '../utils/event-manager';
import type { BrowserInfo } from './browser-detector';

/**
 * Adapted API interface
 */
export interface AdaptedAPI {
  /** Browser information */
  browser: BrowserInfo;
  /** Extension APIs */
  extension: ExtensionAPIAdapter;
  /** Web APIs */
  web: WebAPIAdapter;
  /** DOM APIs */
  dom: DOMAPIAdapter;
  /** Storage APIs */
  storage: StorageAPIAdapter;
  /** Messaging APIs */
  messaging: MessagingAPIAdapter;
}

/**
 * Extension API adapter
 */
export interface ExtensionAPIAdapter {
  /** Runtime API */
  runtime: {
    sendMessage: (message: unknown, options?: unknown) => Promise<unknown>;
    connect: (connectInfo?: unknown) => unknown;
    getManifest: () => unknown;
    getURL: (path: string) => string;
    onMessage: {
      addListener: (callback: (...args: unknown[]) => void) => void;
      removeListener: (callback: (...args: unknown[]) => void) => void;
    };
    onConnect: {
      addListener: (callback: (...args: unknown[]) => void) => void;
      removeListener: (callback: (...args: unknown[]) => void) => void;
    };
  };
  /** Scripting API */
  scripting: {
    executeScript: (injection: unknown) => Promise<unknown[]>;
    insertCSS: (injection: unknown) => Promise<void>;
    removeCSS: (injection: unknown) => Promise<void>;
  };
  /** Tabs API */
  tabs: {
    query: (queryInfo: unknown) => Promise<unknown[]>;
    sendMessage: (tabId: number, message: unknown) => Promise<unknown>;
    create: (createProperties: unknown) => Promise<unknown>;
    update: (tabId: number, updateProperties: unknown) => Promise<unknown>;
  };
  /** Storage API */
  storage: {
    local: StorageArea;
    sync: StorageArea;
    session?: StorageArea;
    managed?: StorageArea;
  };
}

/**
 * Storage area interface
 */
export interface StorageArea {
  get: (keys?: string | string[] | object) => Promise<Record<string, unknown>>;
  set: (items: object) => Promise<void>;
  remove: (keys: string | string[]) => Promise<void>;
  clear: () => Promise<void>;
  getBytesInUse?: (keys?: string | string[]) => Promise<number>;
  onChanged?: {
    addListener: (callback: (changes: Record<string, unknown>) => void) => void;
    removeListener: (callback: (changes: Record<string, unknown>) => void) => void;
  };
}

/**
 * Web API adapter
 */
export interface WebAPIAdapter {
  /** Fetch API */
  fetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
  /** Web Workers */
  Worker: typeof Worker | null;
  /** Service Workers */
  serviceWorker: ServiceWorkerContainer | null;
  /** Notifications */
  Notification: typeof Notification | null;
  /** Clipboard API */
  clipboard: ClipboardAPIAdapter;
  /** Media APIs */
  media: MediaAPIAdapter;
}

/**
 * Clipboard API adapter
 */
export interface ClipboardAPIAdapter {
  writeText: (text: string) => Promise<void>;
  readText: () => Promise<string>;
  write?: (data: ClipboardItems) => Promise<void>;
  read?: () => Promise<ClipboardItems>;
}

/**
 * Media API adapter
 */
export interface MediaAPIAdapter {
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  MediaRecorder: typeof MediaRecorder | null;
  AudioContext: typeof AudioContext | null;
}

/**
 * DOM API adapter
 */
export interface DOMAPIAdapter {
  /** MutationObserver */
  MutationObserver: typeof MutationObserver | MutationObserverPolyfill;
  /** IntersectionObserver */
  IntersectionObserver: typeof IntersectionObserver | IntersectionObserverPolyfill;
  /** ResizeObserver */
  ResizeObserver: typeof ResizeObserver | ResizeObserverPolyfill;
  /** Custom Elements */
  customElements: CustomElementRegistry | null;
  /** Query selectors */
  querySelector: (selector: string, context?: Element | Document) => Element | null;
  querySelectorAll: (selector: string, context?: Element | Document) => NodeList;
  /** Event handling */
  addEventListener: (
    target: EventTarget,
    type: string,
    listener: EventListener,
    options?: AddEventListenerOptions,
  ) => void;
  removeEventListener: (
    target: EventTarget,
    type: string,
    listener: EventListener,
    options?: EventListenerOptions,
  ) => void;
}

/**
 * Storage API adapter
 */
export interface StorageAPIAdapter {
  /** localStorage wrapper */
  local: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
    clear: () => void;
    length: number;
    key: (index: number) => string | null;
  };
  /** sessionStorage wrapper */
  session: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
    clear: () => void;
    length: number;
    key: (index: number) => string | null;
  };
  /** IndexedDB wrapper */
  indexedDB: IDBFactoryAdapter;
}

/**
 * IndexedDB adapter
 */
export interface IDBFactoryAdapter {
  open: (name: string, version?: number) => Promise<IDBDatabase>;
  deleteDatabase: (name: string) => Promise<void>;
  databases?: () => Promise<IDBDatabaseInfo[]>;
}

/**
 * Messaging API adapter
 */
export interface MessagingAPIAdapter {
  /** Post message */
  postMessage: (message: unknown, targetOrigin: string, transfer?: Transferable[]) => void;
  /** Message event handling */
  onMessage: {
    addListener: (callback: (event: MessageEvent) => void) => void;
    removeListener: (callback: (event: MessageEvent) => void) => void;
  };
  /** Broadcast channel */
  BroadcastChannel: typeof BroadcastChannel | null;
}

/**
 * Polyfill interfaces
 */
export interface MutationObserverPolyfill {
  new (callback: MutationCallback): MutationObserver;
}

export interface IntersectionObserverPolyfill {
  new (callback: IntersectionObserverCallback, options?: IntersectionObserverInit): IntersectionObserver;
}

export interface ResizeObserverPolyfill {
  new (callback: ResizeObserverCallback): ResizeObserver;
}

/**
 * API adaptation configuration
 */
export interface APIAdapterConfig {
  /** Enable polyfills */
  enablePolyfills: boolean;
  /** Fallback strategies */
  fallbackStrategies: {
    fetch: 'xhr' | 'none';
    storage: 'localStorage' | 'memory' | 'none';
    messaging: 'postMessage' | 'polling' | 'none';
    observers: 'polling' | 'events' | 'none';
  };
  /** Error handling */
  errorHandling: {
    logErrors: boolean;
    throwOnUnsupported: boolean;
    gracefulDegradation: boolean;
  };
  /** Performance settings */
  performance: {
    useCache: boolean;
    cacheTTL: number;
    lazyLoad: boolean;
  };
}

/**
 * Cross-browser API adapter for unified API access
 */
export class APIAdapter {
  private browserInfo: BrowserInfo;
  private config: APIAdapterConfig;
  private apiCache: Map<string, unknown> = new Map();
  private polyfills: Map<string, unknown> = new Map();

  constructor(config?: Partial<APIAdapterConfig>) {
    this.browserInfo = browserDetector.getBrowserInfo();
    this.config = this.buildConfig(config);
    this.initializePolyfills();
  }

  /**
   * Get adapted API interface
   */
  getAPI(): AdaptedAPI {
    const cacheKey = 'adapted-api';

    if (this.config.performance.useCache && this.apiCache.has(cacheKey)) {
      return this.apiCache.get(cacheKey);
    }

    const api: AdaptedAPI = {
      browser: this.browserInfo,
      extension: this.createExtensionAPIAdapter(),
      web: this.createWebAPIAdapter(),
      dom: this.createDOMAPIAdapter(),
      storage: this.createStorageAPIAdapter(),
      messaging: this.createMessagingAPIAdapter(),
    };

    if (this.config.performance.useCache) {
      this.apiCache.set(cacheKey, api);

      // Set cache expiration
      setTimeout(() => {
        this.apiCache.delete(cacheKey);
      }, this.config.performance.cacheTTL);
    }

    return api;
  }

  /**
   * Create extension API adapter
   */
  private createExtensionAPIAdapter(): ExtensionAPIAdapter {
    return {
      runtime: {
        sendMessage: this.adaptRuntimeSendMessage(),
        connect: this.adaptRuntimeConnect(),
        getManifest: this.adaptGetManifest(),
        getURL: this.adaptGetURL(),
        onMessage: this.adaptOnMessage(),
        onConnect: this.adaptOnConnect(),
      },
      scripting: {
        executeScript: this.adaptExecuteScript(),
        insertCSS: this.adaptInsertCSS(),
        removeCSS: this.adaptRemoveCSS(),
      },
      tabs: {
        query: this.adaptTabsQuery(),
        sendMessage: this.adaptTabsSendMessage(),
        create: this.adaptTabsCreate(),
        update: this.adaptTabsUpdate(),
      },
      storage: {
        local: this.adaptStorageArea('local'),
        sync: this.adaptStorageArea('sync'),
        session: this.adaptStorageArea('session'),
        managed: this.adaptStorageArea('managed'),
      },
    };
  }

  /**
   * Create web API adapter
   */
  private createWebAPIAdapter(): WebAPIAdapter {
    return {
      fetch: this.adaptFetch(),
      Worker: this.adaptWorker(),
      serviceWorker: this.adaptServiceWorker(),
      Notification: this.adaptNotification(),
      clipboard: this.adaptClipboard(),
      media: this.adaptMedia(),
    };
  }

  /**
   * Create DOM API adapter
   */
  private createDOMAPIAdapter(): DOMAPIAdapter {
    return {
      MutationObserver: this.adaptMutationObserver(),
      IntersectionObserver: this.adaptIntersectionObserver(),
      ResizeObserver: this.adaptResizeObserver(),
      customElements: this.adaptCustomElements(),
      querySelector: this.adaptQuerySelector(),
      querySelectorAll: this.adaptQuerySelectorAll(),
      addEventListener: this.adaptAddEventListener(),
      removeEventListener: this.adaptRemoveEventListener(),
    };
  }

  /**
   * Create storage API adapter
   */
  private createStorageAPIAdapter(): StorageAPIAdapter {
    return {
      local: this.adaptLocalStorage(),
      session: this.adaptSessionStorage(),
      indexedDB: this.adaptIndexedDB(),
    };
  }

  /**
   * Create messaging API adapter
   */
  private createMessagingAPIAdapter(): MessagingAPIAdapter {
    return {
      postMessage: this.adaptPostMessage(),
      onMessage: this.adaptMessageEvent(),
      BroadcastChannel: this.adaptBroadcastChannel(),
    };
  }

  /**
   * Extension API adapters
   */
  private adaptRuntimeSendMessage() {
    return async (message: unknown, options?: unknown): Promise<unknown> => {
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, options, response => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(response);
              }
            });
          });
        } else if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendMessage) {
          return browser.runtime.sendMessage(message, options);
        } else {
          throw new Error('Runtime sendMessage not supported');
        }
      } catch (error) {
        return this.handleAPIError('runtime.sendMessage', error);
      }
    };
  }

  private adaptRuntimeConnect() {
    return (connectInfo?: unknown): unknown => {
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.connect) {
          return chrome.runtime.connect(connectInfo);
        } else if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.connect) {
          return browser.runtime.connect(connectInfo);
        } else {
          throw new Error('Runtime connect not supported');
        }
      } catch (error) {
        return this.handleAPIError('runtime.connect', error);
      }
    };
  }

  private adaptGetManifest() {
    return (): unknown => {
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
          return chrome.runtime.getManifest();
        } else if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.getManifest) {
          return browser.runtime.getManifest();
        } else {
          return {}; // Fallback empty manifest
        }
      } catch (error) {
        return this.handleAPIError('runtime.getManifest', error);
      }
    };
  }

  private adaptGetURL() {
    return (path: string): string => {
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
          return chrome.runtime.getURL(path);
        } else if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.getURL) {
          return browser.runtime.getURL(path);
        } else {
          return path; // Fallback to original path
        }
      } catch (error) {
        this.handleAPIError('runtime.getURL', error);
        return path;
      }
    };
  }

  private adaptOnMessage() {
    const listeners = new Set<(...args: unknown[]) => unknown>();

    return {
      addListener: (callback: (...args: unknown[]) => unknown) => {
        listeners.add(callback);

        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
          chrome.runtime.onMessage.addListener(callback as never);
        } else if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.onMessage) {
          browser.runtime.onMessage.addListener(callback as never);
        }
      },
      removeListener: (callback: (...args: unknown[]) => unknown) => {
        listeners.delete(callback);

        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
          chrome.runtime.onMessage.removeListener(callback as never);
        } else if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.onMessage) {
          browser.runtime.onMessage.removeListener(callback as never);
        }
      },
    };
  }

  private adaptOnConnect() {
    const listeners = new Set<(...args: unknown[]) => unknown>();

    return {
      addListener: (callback: (...args: unknown[]) => unknown) => {
        listeners.add(callback);

        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onConnect) {
          chrome.runtime.onConnect.addListener(callback as never);
        } else if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.onConnect) {
          browser.runtime.onConnect.addListener(callback as never);
        }
      },
      removeListener: (callback: (...args: unknown[]) => unknown) => {
        listeners.delete(callback);

        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onConnect) {
          chrome.runtime.onConnect.removeListener(callback as never);
        } else if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.onConnect) {
          browser.runtime.onConnect.removeListener(callback as never);
        }
      },
    };
  }

  private adaptExecuteScript() {
    return async (injection: unknown): Promise<unknown[]> => {
      try {
        if (typeof chrome !== 'undefined' && chrome.scripting && chrome.scripting.executeScript) {
          return chrome.scripting.executeScript(injection);
        } else if (typeof browser !== 'undefined' && browser.scripting && browser.scripting.executeScript) {
          return browser.scripting.executeScript(injection);
        } else if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.executeScript) {
          // Fallback to Manifest V2 API
          return new Promise((resolve, reject) => {
            chrome.tabs.executeScript(
              injection.target?.tabId,
              {
                code: injection.func ? `(${injection.func})()` : injection.code,
                file: injection.files?.[0],
                allFrames: injection.target?.allFrames,
              },
              result => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  resolve(result || []);
                }
              },
            );
          });
        } else {
          throw new Error('Script execution not supported');
        }
      } catch (error) {
        return this.handleAPIError('scripting.executeScript', error);
      }
    };
  }

  private adaptInsertCSS() {
    return async (injection: unknown): Promise<void> => {
      try {
        if (typeof chrome !== 'undefined' && chrome.scripting && chrome.scripting.insertCSS) {
          return chrome.scripting.insertCSS(injection);
        } else if (typeof browser !== 'undefined' && browser.scripting && browser.scripting.insertCSS) {
          return browser.scripting.insertCSS(injection);
        } else if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.insertCSS) {
          // Fallback to Manifest V2 API
          return new Promise((resolve, reject) => {
            chrome.tabs.insertCSS(
              injection.target?.tabId,
              {
                code: injection.css,
                file: injection.files?.[0],
                allFrames: injection.target?.allFrames,
              },
              () => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  resolve();
                }
              },
            );
          });
        } else {
          throw new Error('CSS insertion not supported');
        }
      } catch (error) {
        return this.handleAPIError('scripting.insertCSS', error);
      }
    };
  }

  private adaptRemoveCSS() {
    return async (injection: unknown): Promise<void> => {
      try {
        if (typeof chrome !== 'undefined' && chrome.scripting && chrome.scripting.removeCSS) {
          return chrome.scripting.removeCSS(injection);
        } else if (typeof browser !== 'undefined' && browser.scripting && browser.scripting.removeCSS) {
          return browser.scripting.removeCSS(injection);
        } else if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.removeCSS) {
          // Fallback to Manifest V2 API
          return new Promise((resolve, reject) => {
            chrome.tabs.removeCSS(
              injection.target?.tabId,
              {
                code: injection.css,
                file: injection.files?.[0],
                allFrames: injection.target?.allFrames,
              },
              () => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  resolve();
                }
              },
            );
          });
        } else {
          throw new Error('CSS removal not supported');
        }
      } catch (error) {
        return this.handleAPIError('scripting.removeCSS', error);
      }
    };
  }

  private adaptTabsQuery() {
    return async (queryInfo: unknown): Promise<unknown[]> => {
      try {
        if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
          return new Promise((resolve, reject) => {
            chrome.tabs.query(queryInfo, tabs => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(tabs);
              }
            });
          });
        } else if (typeof browser !== 'undefined' && browser.tabs && browser.tabs.query) {
          return browser.tabs.query(queryInfo);
        } else {
          throw new Error('Tabs query not supported');
        }
      } catch (error) {
        return this.handleAPIError('tabs.query', error);
      }
    };
  }

  private adaptTabsSendMessage() {
    return async (tabId: number, message: unknown): Promise<unknown> => {
      try {
        if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.sendMessage) {
          return new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tabId, message, response => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(response);
              }
            });
          });
        } else if (typeof browser !== 'undefined' && browser.tabs && browser.tabs.sendMessage) {
          return browser.tabs.sendMessage(tabId, message);
        } else {
          throw new Error('Tabs sendMessage not supported');
        }
      } catch (error) {
        return this.handleAPIError('tabs.sendMessage', error);
      }
    };
  }

  private adaptTabsCreate() {
    return async (createProperties: unknown): Promise<unknown> => {
      try {
        if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
          return new Promise((resolve, reject) => {
            chrome.tabs.create(createProperties, tab => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(tab);
              }
            });
          });
        } else if (typeof browser !== 'undefined' && browser.tabs && browser.tabs.create) {
          return browser.tabs.create(createProperties);
        } else {
          // Fallback to window.open
          const _newWindow = window.open(createProperties.url, '_blank');
          return Promise.resolve({ id: Date.now(), url: createProperties.url });
        }
      } catch (error) {
        return this.handleAPIError('tabs.create', error);
      }
    };
  }

  private adaptTabsUpdate() {
    return async (tabId: number, updateProperties: unknown): Promise<unknown> => {
      try {
        if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.update) {
          return new Promise((resolve, reject) => {
            chrome.tabs.update(tabId, updateProperties, tab => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(tab);
              }
            });
          });
        } else if (typeof browser !== 'undefined' && browser.tabs && browser.tabs.update) {
          return browser.tabs.update(tabId, updateProperties);
        } else {
          throw new Error('Tabs update not supported');
        }
      } catch (error) {
        return this.handleAPIError('tabs.update', error);
      }
    };
  }

  private adaptStorageArea(area: string): StorageArea {
    const chromeStorage = (chrome as never)?.storage?.[area];
    const browserStorage = (browser as never)?.storage?.[area];

    return {
      get: async (keys?: string | string[] | object): Promise<unknown> => {
        try {
          if (chromeStorage) {
            return new Promise((resolve, reject) => {
              chromeStorage.get(keys, (result: unknown) => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  resolve(result);
                }
              });
            });
          } else if (browserStorage) {
            return browserStorage.get(keys);
          } else {
            return this.getStorageFallback(area, keys);
          }
        } catch (error) {
          return this.handleAPIError(`storage.${area}.get`, error);
        }
      },
      set: async (items: object): Promise<void> => {
        try {
          if (chromeStorage) {
            return new Promise((resolve, reject) => {
              chromeStorage.set(items, () => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  resolve();
                }
              });
            });
          } else if (browserStorage) {
            return browserStorage.set(items);
          } else {
            return this.setStorageFallback(area, items);
          }
        } catch (error) {
          return this.handleAPIError(`storage.${area}.set`, error);
        }
      },
      remove: async (keys: string | string[]): Promise<void> => {
        try {
          if (chromeStorage) {
            return new Promise((resolve, reject) => {
              chromeStorage.remove(keys, () => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  resolve();
                }
              });
            });
          } else if (browserStorage) {
            return browserStorage.remove(keys);
          } else {
            return this.removeStorageFallback(area, keys);
          }
        } catch (error) {
          return this.handleAPIError(`storage.${area}.remove`, error);
        }
      },
      clear: async (): Promise<void> => {
        try {
          if (chromeStorage) {
            return new Promise((resolve, reject) => {
              chromeStorage.clear(() => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  resolve();
                }
              });
            });
          } else if (browserStorage) {
            return browserStorage.clear();
          } else {
            return this.clearStorageFallback(area);
          }
        } catch (error) {
          return this.handleAPIError(`storage.${area}.clear`, error);
        }
      },
    };
  }

  /**
   * Web API adapters
   */
  private adaptFetch() {
    if (typeof fetch !== 'undefined') {
      return fetch.bind(window);
    } else if (this.config.fallbackStrategies.fetch === 'xhr') {
      return this.createXHRFallback();
    } else {
      return () => Promise.reject(new Error('Fetch not supported'));
    }
  }

  private adaptWorker() {
    return typeof Worker !== 'undefined' ? Worker : null;
  }

  private adaptServiceWorker() {
    return 'serviceWorker' in navigator ? navigator.serviceWorker : null;
  }

  private adaptNotification() {
    return typeof Notification !== 'undefined' ? Notification : null;
  }

  private adaptClipboard(): ClipboardAPIAdapter {
    return {
      writeText: async (text: string): Promise<void> => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          return navigator.clipboard.writeText(text);
        } else {
          return this.fallbackWriteText(text);
        }
      },
      readText: async (): Promise<string> => {
        if (navigator.clipboard && navigator.clipboard.readText) {
          return navigator.clipboard.readText();
        } else {
          return this.fallbackReadText();
        }
      },
    };
  }

  private adaptMedia(): MediaAPIAdapter {
    return {
      getUserMedia: (constraints: MediaStreamConstraints): Promise<MediaStream> => {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          return navigator.mediaDevices.getUserMedia(constraints);
        } else if ((navigator as never).getUserMedia) {
          return new Promise((resolve, reject) => {
            (navigator as never).getUserMedia(constraints, resolve, reject);
          });
        } else {
          return Promise.reject(new Error('getUserMedia not supported'));
        }
      },
      MediaRecorder: typeof MediaRecorder !== 'undefined' ? MediaRecorder : null,
      AudioContext:
        typeof AudioContext !== 'undefined'
          ? AudioContext
          : typeof (window as never).webkitAudioContext !== 'undefined'
            ? (window as never).webkitAudioContext
            : null,
    };
  }

  /**
   * DOM API adapters
   */
  private adaptMutationObserver() {
    if (typeof MutationObserver !== 'undefined') {
      return MutationObserver;
    } else if (this.polyfills.has('MutationObserver')) {
      return this.polyfills.get('MutationObserver');
    } else {
      return this.createMutationObserverPolyfill();
    }
  }

  private adaptIntersectionObserver() {
    if (typeof IntersectionObserver !== 'undefined') {
      return IntersectionObserver;
    } else if (this.polyfills.has('IntersectionObserver')) {
      return this.polyfills.get('IntersectionObserver');
    } else {
      return this.createIntersectionObserverPolyfill();
    }
  }

  private adaptResizeObserver() {
    if (typeof ResizeObserver !== 'undefined') {
      return ResizeObserver;
    } else if (this.polyfills.has('ResizeObserver')) {
      return this.polyfills.get('ResizeObserver');
    } else {
      return this.createResizeObserverPolyfill();
    }
  }

  private adaptCustomElements() {
    return 'customElements' in window ? window.customElements : null;
  }

  private adaptQuerySelector() {
    return (selector: string, context: Element | Document = document): Element | null => {
      try {
        return context.querySelector(selector);
      } catch (error) {
        this.handleAPIError('querySelector', error);
        return null;
      }
    };
  }

  private adaptQuerySelectorAll() {
    return (selector: string, context: Element | Document = document): NodeList => {
      try {
        return context.querySelectorAll(selector);
      } catch (error) {
        this.handleAPIError('querySelectorAll', error);
        return document.createNodeIterator(document.body, NodeFilter.SHOW_ELEMENT) as never;
      }
    };
  }

  private adaptAddEventListener() {
    return (target: EventTarget, type: string, listener: EventListener, options?: AddEventListenerOptions): void => {
      try {
        if (options && typeof options === 'object' && this.browserInfo.capabilities.dom.mutationObserver) {
          target.addEventListener(type, listener, options);
        } else {
          // Fallback for older browsers
          target.addEventListener(type, listener, typeof options === 'boolean' ? options : false);
        }
      } catch (error) {
        this.handleAPIError('addEventListener', error);
      }
    };
  }

  private adaptRemoveEventListener() {
    return (target: EventTarget, type: string, listener: EventListener, options?: EventListenerOptions): void => {
      try {
        if (options && typeof options === 'object' && this.browserInfo.capabilities.dom.mutationObserver) {
          target.removeEventListener(type, listener, options);
        } else {
          // Fallback for older browsers
          target.removeEventListener(type, listener, typeof options === 'boolean' ? options : false);
        }
      } catch (error) {
        this.handleAPIError('removeEventListener', error);
      }
    };
  }

  /**
   * Storage API adapters
   */
  private adaptLocalStorage() {
    const storage = window.localStorage;

    return {
      getItem: (key: string): string | null => {
        try {
          return storage.getItem(key);
        } catch (error) {
          this.handleAPIError('localStorage.getItem', error);
          return null;
        }
      },
      setItem: (key: string, value: string): void => {
        try {
          storage.setItem(key, value);
        } catch (error) {
          this.handleAPIError('localStorage.setItem', error);
        }
      },
      removeItem: (key: string): void => {
        try {
          storage.removeItem(key);
        } catch (error) {
          this.handleAPIError('localStorage.removeItem', error);
        }
      },
      clear: (): void => {
        try {
          storage.clear();
        } catch (error) {
          this.handleAPIError('localStorage.clear', error);
        }
      },
      get length(): number {
        try {
          return storage.length;
        } catch (error) {
          this.handleAPIError('localStorage.length', error);
          return 0;
        }
      },
      key: (index: number): string | null => {
        try {
          return storage.key(index);
        } catch (error) {
          this.handleAPIError('localStorage.key', error);
          return null;
        }
      },
    };
  }

  private adaptSessionStorage() {
    const storage = window.sessionStorage;

    return {
      getItem: (key: string): string | null => {
        try {
          return storage.getItem(key);
        } catch (error) {
          this.handleAPIError('sessionStorage.getItem', error);
          return null;
        }
      },
      setItem: (key: string, value: string): void => {
        try {
          storage.setItem(key, value);
        } catch (error) {
          this.handleAPIError('sessionStorage.setItem', error);
        }
      },
      removeItem: (key: string): void => {
        try {
          storage.removeItem(key);
        } catch (error) {
          this.handleAPIError('sessionStorage.removeItem', error);
        }
      },
      clear: (): void => {
        try {
          storage.clear();
        } catch (error) {
          this.handleAPIError('sessionStorage.clear', error);
        }
      },
      get length(): number {
        try {
          return storage.length;
        } catch (error) {
          this.handleAPIError('sessionStorage.length', error);
          return 0;
        }
      },
      key: (index: number): string | null => {
        try {
          return storage.key(index);
        } catch (error) {
          this.handleAPIError('sessionStorage.key', error);
          return null;
        }
      },
    };
  }

  private adaptIndexedDB(): IDBFactoryAdapter {
    const idb = window.indexedDB;

    return {
      open: (name: string, version?: number): Promise<IDBDatabase> =>
        new Promise((resolve, reject) => {
          try {
            const request = idb.open(name, version);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
          } catch (error) {
            reject(error);
          }
        }),
      deleteDatabase: (name: string): Promise<void> =>
        new Promise((resolve, reject) => {
          try {
            const request = idb.deleteDatabase(name);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
          } catch (error) {
            reject(error);
          }
        }),
      databases: idb.databases ? idb.databases.bind(idb) : undefined,
    };
  }

  /**
   * Messaging API adapters
   */
  private adaptPostMessage() {
    return (message: unknown, targetOrigin: string, transfer?: Transferable[]): void => {
      try {
        if (transfer) {
          window.postMessage(message, targetOrigin, transfer);
        } else {
          window.postMessage(message, targetOrigin);
        }
      } catch (error) {
        this.handleAPIError('postMessage', error);
      }
    };
  }

  private adaptMessageEvent() {
    const listeners = new Set<(event: MessageEvent) => void>();

    return {
      addListener: (callback: (event: MessageEvent) => void): void => {
        listeners.add(callback);
        window.addEventListener('message', callback);
      },
      removeListener: (callback: (event: MessageEvent) => void): void => {
        listeners.delete(callback);
        window.removeEventListener('message', callback);
      },
    };
  }

  private adaptBroadcastChannel() {
    return typeof BroadcastChannel !== 'undefined' ? BroadcastChannel : null;
  }

  /**
   * Polyfill implementations
   */
  private initializePolyfills(): void {
    if (this.config.enablePolyfills) {
      // Load polyfills as needed
      if (!this.browserInfo.capabilities.dom.mutationObserver) {
        this.polyfills.set('MutationObserver', this.createMutationObserverPolyfill());
      }

      if (!this.browserInfo.capabilities.dom.intersectionObserver) {
        this.polyfills.set('IntersectionObserver', this.createIntersectionObserverPolyfill());
      }

      if (!this.browserInfo.capabilities.dom.resizeObserver) {
        this.polyfills.set('ResizeObserver', this.createResizeObserverPolyfill());
      }
    }
  }

  private createMutationObserverPolyfill(): MutationObserverPolyfill {
    return class MutationObserverPolyfill {
      private callback: MutationCallback;
      private target: Node | null = null;
      private config: MutationObserverInit | null = null;
      private polling: boolean = false;
      private pollInterval: number = 100;
      private lastSnapshot: string = '';

      constructor(callback: MutationCallback) {
        this.callback = callback;
      }

      observe(target: Node, config: MutationObserverInit): void {
        this.target = target;
        this.config = config;
        this.startPolling();
      }

      disconnect(): void {
        this.stopPolling();
      }

      takeRecords(): MutationRecord[] {
        return [];
      }

      private startPolling(): void {
        if (this.polling || !this.target) return;

        this.polling = true;
        this.lastSnapshot = this.getSnapshot();

        const poll = () => {
          if (!this.polling || !this.target) return;

          const currentSnapshot = this.getSnapshot();
          if (currentSnapshot !== this.lastSnapshot) {
            // Simplified mutation record
            const record: MutationRecord = {
              type: 'childList',
              target: this.target!,
              addedNodes: document.createNodeIterator(this.target!, NodeFilter.SHOW_ALL) as never,
              removedNodes: document.createNodeIterator(this.target!, NodeFilter.SHOW_ALL) as never,
              previousSibling: null,
              nextSibling: null,
              attributeName: null,
              attributeNamespace: null,
              oldValue: null,
            };

            this.callback([record], this as never);
            this.lastSnapshot = currentSnapshot;
          }

          setTimeout(poll, this.pollInterval);
        };

        setTimeout(poll, this.pollInterval);
      }

      private stopPolling(): void {
        this.polling = false;
      }

      private getSnapshot(): string {
        if (!this.target) return '';
        return (this.target as Element).innerHTML || '';
      }
    } as never;
  }

  private createIntersectionObserverPolyfill(): IntersectionObserverPolyfill {
    return class IntersectionObserverPolyfill {
      private callback: IntersectionObserverCallback;
      private options: IntersectionObserverInit;
      private targets: Set<Element> = new Set();
      private polling: boolean = false;

      constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit = {}) {
        this.callback = callback;
        this.options = options;
      }

      observe(target: Element): void {
        this.targets.add(target);
        this.startPolling();
      }

      unobserve(target: Element): void {
        this.targets.delete(target);
        if (this.targets.size === 0) {
          this.stopPolling();
        }
      }

      disconnect(): void {
        this.targets.clear();
        this.stopPolling();
      }

      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }

      private startPolling(): void {
        if (this.polling) return;

        this.polling = true;

        const poll = () => {
          if (!this.polling) return;

          const entries: IntersectionObserverEntry[] = [];

          this.targets.forEach(target => {
            const rect = target.getBoundingClientRect();
            const isIntersecting = rect.top < window.innerHeight && rect.bottom > 0;

            const entry: IntersectionObserverEntry = {
              target,
              isIntersecting,
              intersectionRatio: isIntersecting ? 1 : 0,
              intersectionRect: rect,
              boundingClientRect: rect,
              rootBounds: {
                top: 0,
                left: 0,
                right: window.innerWidth,
                bottom: window.innerHeight,
                width: window.innerWidth,
                height: window.innerHeight,
              } as DOMRectReadOnly,
              time: Date.now(),
            };

            entries.push(entry);
          });

          if (entries.length > 0) {
            this.callback(entries, this as never);
          }

          setTimeout(poll, 100);
        };

        setTimeout(poll, 100);
      }

      private stopPolling(): void {
        this.polling = false;
      }
    } as never;
  }

  private createResizeObserverPolyfill(): ResizeObserverPolyfill {
    return class ResizeObserverPolyfill {
      private callback: ResizeObserverCallback;
      private targets: Map<Element, { width: number; height: number }> = new Map();
      private polling: boolean = false;

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }

      observe(target: Element): void {
        const rect = target.getBoundingClientRect();
        this.targets.set(target, { width: rect.width, height: rect.height });
        this.startPolling();
      }

      unobserve(target: Element): void {
        this.targets.delete(target);
        if (this.targets.size === 0) {
          this.stopPolling();
        }
      }

      disconnect(): void {
        this.targets.clear();
        this.stopPolling();
      }

      private startPolling(): void {
        if (this.polling) return;

        this.polling = true;

        const poll = () => {
          if (!this.polling) return;

          const entries: ResizeObserverEntry[] = [];

          this.targets.forEach((lastSize, target) => {
            const rect = target.getBoundingClientRect();

            if (rect.width !== lastSize.width || rect.height !== lastSize.height) {
              this.targets.set(target, { width: rect.width, height: rect.height });

              const entry: ResizeObserverEntry = {
                target,
                contentRect: rect,
                borderBoxSize: [{ blockSize: rect.height, inlineSize: rect.width }] as never,
                contentBoxSize: [{ blockSize: rect.height, inlineSize: rect.width }] as never,
                devicePixelContentBoxSize: [{ blockSize: rect.height, inlineSize: rect.width }] as never,
              };

              entries.push(entry);
            }
          });

          if (entries.length > 0) {
            this.callback(entries, this as never);
          }

          setTimeout(poll, 100);
        };

        setTimeout(poll, 100);
      }

      private stopPolling(): void {
        this.polling = false;
      }
    } as never;
  }

  /**
   * Fallback implementations
   */
  private createXHRFallback() {
    return (input: RequestInfo, init: RequestInit = {}): Promise<Response> =>
      new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const url = typeof input === 'string' ? input : input.url;

        xhr.open(init.method || 'GET', url);

        // Set headers
        if (init.headers) {
          const headers = new Headers(init.headers);
          headers.forEach((value, key) => {
            xhr.setRequestHeader(key, value);
          });
        }

        xhr.onload = () => {
          const response = new Response(xhr.responseText, {
            status: xhr.status,
            statusText: xhr.statusText,
            headers: new Headers(),
          });
          resolve(response);
        };

        xhr.onerror = () => reject(new Error('Network error'));
        xhr.ontimeout = () => reject(new Error('Request timeout'));

        xhr.send(init.body as string);
      });
  }

  private fallbackWriteText(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();

      try {
        const successful = document.execCommand('copy');
        if (successful) {
          resolve();
        } else {
          reject(new Error('Copy command failed'));
        }
      } catch (error) {
        reject(error);
      } finally {
        document.body.removeChild(textArea);
      }
    });
  }

  private fallbackReadText(): Promise<string> {
    return Promise.reject(new Error('Clipboard read not supported'));
  }

  /**
   * Storage fallbacks
   */
  private async getStorageFallback(area: string, keys?: unknown): Promise<unknown> {
    if (this.config.fallbackStrategies.storage === 'localStorage') {
      const result: Record<string, unknown> = {};
      const storage = area === 'session' ? sessionStorage : localStorage;

      if (typeof keys === 'string') {
        const value = storage.getItem(keys);
        if (value !== null) {
          result[keys] = JSON.parse(value);
        }
      } else if (Array.isArray(keys)) {
        keys.forEach(key => {
          const value = storage.getItem(key);
          if (value !== null) {
            result[key] = JSON.parse(value);
          }
        });
      } else if (keys === null || keys === undefined) {
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (key) {
            const value = storage.getItem(key);
            if (value !== null) {
              result[key] = JSON.parse(value);
            }
          }
        }
      }

      return result;
    } else {
      return {};
    }
  }

  private async setStorageFallback(area: string, items: object): Promise<void> {
    if (this.config.fallbackStrategies.storage === 'localStorage') {
      const storage = area === 'session' ? sessionStorage : localStorage;

      Object.entries(items).forEach(([key, value]) => {
        storage.setItem(key, JSON.stringify(value));
      });
    }
  }

  private async removeStorageFallback(area: string, keys: string | string[]): Promise<void> {
    if (this.config.fallbackStrategies.storage === 'localStorage') {
      const storage = area === 'session' ? sessionStorage : localStorage;
      const keyArray = Array.isArray(keys) ? keys : [keys];

      keyArray.forEach(key => {
        storage.removeItem(key);
      });
    }
  }

  private async clearStorageFallback(area: string): Promise<void> {
    if (this.config.fallbackStrategies.storage === 'localStorage') {
      const storage = area === 'session' ? sessionStorage : localStorage;
      storage.clear();
    }
  }

  /**
   * Error handling
   */
  private handleAPIError(api: string, error: unknown): unknown {
    if (this.config.errorHandling.logErrors) {
      console.error(`API Adapter Error [${api}]:`, error);
    }

    if (this.config.errorHandling.throwOnUnsupported && !this.config.errorHandling.gracefulDegradation) {
      throw error;
    }

    // Emit error event
    eventManager.emitEvent('api-adapter-error', { api, error });

    // Return appropriate fallback
    if (this.config.errorHandling.gracefulDegradation) {
      return this.getGracefulFallback(api);
    }

    return null;
  }

  private getGracefulFallback(api: string): unknown {
    // Return appropriate fallback values
    switch (api) {
      case 'runtime.sendMessage':
        return Promise.resolve(null);
      case 'runtime.connect':
        return { postMessage: () => {}, disconnect: () => {} };
      case 'runtime.getManifest':
        return {};
      case 'runtime.getURL':
        return '';
      case 'tabs.query':
        return Promise.resolve([]);
      case 'storage.local.get':
      case 'storage.sync.get':
        return Promise.resolve({});
      case 'storage.local.set':
      case 'storage.sync.set':
        return Promise.resolve();
      default:
        return null;
    }
  }

  /**
   * Configuration
   */
  private buildConfig(config?: Partial<APIAdapterConfig>): APIAdapterConfig {
    return {
      enablePolyfills: true,
      fallbackStrategies: {
        fetch: 'xhr',
        storage: 'localStorage',
        messaging: 'postMessage',
        observers: 'polling',
      },
      errorHandling: {
        logErrors: true,
        throwOnUnsupported: false,
        gracefulDegradation: true,
      },
      performance: {
        useCache: true,
        cacheTTL: 60000, // 1 minute
        lazyLoad: true,
      },
      ...config,
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.apiCache.clear();
    this.polyfills.clear();
  }
}

// Export singleton instance
export const apiAdapter = new APIAdapter();
