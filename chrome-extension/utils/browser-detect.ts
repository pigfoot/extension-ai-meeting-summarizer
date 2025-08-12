/**
 * Browser detection utility for cross-browser manifest generation
 * Provides browser detection, capability detection, and browser-specific
 * configuration management for the Meeting Summarizer Chrome Extension.
 */

import type { 
  TargetBrowser, 
  BrowserCapabilities, 
  BrowserVersionRequirement,
  BrowserCompatibilityIssue 
} from '../src/types/manifest.js';

/**
 * Browser user agent patterns for detection
 */
const BROWSER_PATTERNS: Record<TargetBrowser, RegExp[]> = {
  chrome: [
    /Chrome\/(\d+)/,
    /Chromium\/(\d+)/,
  ],
  firefox: [
    /Firefox\/(\d+)/,
    /Gecko\/.*Firefox\/(\d+)/,
  ],
  edge: [
    /Edg\/(\d+)/,
    /Edge\/(\d+)/,
  ],
  safari: [
    /Safari\/(\d+)/,
    /Version\/(\d+).*Safari/,
  ],
};

/**
 * Known browser version requirements for extension compatibility
 */
const BROWSER_VERSION_REQUIREMENTS: Record<TargetBrowser, BrowserVersionRequirement> = {
  chrome: {
    minVersion: '109',
    recommendedVersion: '120',
  },
  firefox: {
    minVersion: '109',
    recommendedVersion: '121',
  },
  edge: {
    minVersion: '109',
    recommendedVersion: '120',
  },
  safari: {
    minVersion: '16',
    recommendedVersion: '17',
  },
};

/**
 * Browser-specific API support matrix
 */
const BROWSER_API_SUPPORT: Record<TargetBrowser, Record<string, boolean>> = {
  chrome: {
    sidePanel: true,
    offscreen: true,
    serviceWorker: true,
    declarativeContent: true,
    webNavigation: true,
    notifications: true,
    contextMenus: true,
    storage: true,
    scripting: true,
    tabs: true,
    activeTab: true,
    identity: true,
  },
  firefox: {
    sidePanel: false, // Not supported in Firefox
    offscreen: false, // Not supported in Firefox
    serviceWorker: false, // Limited support
    declarativeContent: true,
    webNavigation: true,
    notifications: true,
    contextMenus: true,
    storage: true,
    scripting: true,
    tabs: true,
    activeTab: true,
    identity: false, // Different implementation
  },
  edge: {
    sidePanel: true,
    offscreen: true,
    serviceWorker: true,
    declarativeContent: true,
    webNavigation: true,
    notifications: true,
    contextMenus: true,
    storage: true,
    scripting: true,
    tabs: true,
    activeTab: true,
    identity: true,
  },
  safari: {
    sidePanel: false, // Not supported
    offscreen: false, // Not supported
    serviceWorker: false, // Limited support
    declarativeContent: false, // Not supported
    webNavigation: true,
    notifications: true,
    contextMenus: true,
    storage: true,
    scripting: true,
    tabs: true,
    activeTab: true,
    identity: false, // Different implementation
  },
};

/**
 * Browser-specific permission names and limitations
 */
const BROWSER_PERMISSION_MAPPINGS: Record<TargetBrowser, Record<string, string | null>> = {
  chrome: {
    storage: 'storage',
    scripting: 'scripting',
    tabs: 'tabs',
    notifications: 'notifications',
    sidePanel: 'sidePanel',
    offscreen: 'offscreen',
    contextMenus: 'contextMenus',
    webNavigation: 'webNavigation',
    activeTab: 'activeTab',
    identity: 'identity',
  },
  firefox: {
    storage: 'storage',
    scripting: 'scripting',
    tabs: 'tabs',
    notifications: 'notifications',
    sidePanel: null, // Not supported
    offscreen: null, // Not supported
    contextMenus: 'menus', // Different name in Firefox
    webNavigation: 'webNavigation',
    activeTab: 'activeTab',
    identity: null, // Not supported
  },
  edge: {
    storage: 'storage',
    scripting: 'scripting',
    tabs: 'tabs',
    notifications: 'notifications',
    sidePanel: 'sidePanel',
    offscreen: 'offscreen',
    contextMenus: 'contextMenus',
    webNavigation: 'webNavigation',
    activeTab: 'activeTab',
    identity: 'identity',
  },
  safari: {
    storage: 'storage',
    scripting: 'scripting',
    tabs: 'tabs',
    notifications: 'notifications',
    sidePanel: null, // Not supported
    offscreen: null, // Not supported
    contextMenus: 'contextMenus',
    webNavigation: 'webNavigation',
    activeTab: 'activeTab',
    identity: null, // Not supported
  },
};

/**
 * Detect browser type from user agent string
 */
export function detectBrowserFromUserAgent(userAgent: string): TargetBrowser | null {
  // Check each browser pattern
  for (const [browser, patterns] of Object.entries(BROWSER_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(userAgent)) {
        return browser as TargetBrowser;
      }
    }
  }
  
  return null;
}

/**
 * Extract browser version from user agent string
 */
export function extractBrowserVersion(userAgent: string, browser: TargetBrowser): string | null {
  const patterns = BROWSER_PATTERNS[browser];
  
  for (const pattern of patterns) {
    const match = userAgent.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Detect browser capabilities based on browser type and version
 */
export function detectBrowserCapabilities(browser: TargetBrowser, version?: string): BrowserCapabilities {
  const apiSupport = BROWSER_API_SUPPORT[browser];
  const permissionMappings = BROWSER_PERMISSION_MAPPINGS[browser];
  
  // Get supported permissions (filter out null mappings)
  const supportedPermissions = Object.entries(permissionMappings)
    .filter(([_, mapped]) => mapped !== null)
    .map(([_, mapped]) => mapped as string);
  
  // Get supported APIs
  const supportedAPIs = Object.entries(apiSupport)
    .filter(([_, supported]) => supported)
    .map(([api, _]) => api);
  
  // Browser-specific store requirements
  const storeRequirements = getStoreRequirements(browser);
  
  // Known limitations
  const limitations = getBrowserLimitations(browser);
  
  return {
    browser,
    version: version || 'unknown',
    manifestVersion: browser === 'firefox' ? 2 : 3, // Firefox still uses v2 in some cases
    supportedPermissions,
    supportedAPIs,
    storeRequirements,
    limitations,
  };
}

/**
 * Get store requirements for specific browser
 */
function getStoreRequirements(browser: TargetBrowser): BrowserCapabilities['storeRequirements'] {
  switch (browser) {
    case 'chrome':
      return {
        csp: "script-src 'self'; object-src 'self';",
        permissions: ['storage', 'scripting'],
        hostPermissions: ['https://*.sharepoint.com/*', 'https://*.office.com/*'],
      };
    
    case 'firefox':
      return {
        permissions: ['storage', 'scripting', 'tabs'],
        hostPermissions: ['https://*.sharepoint.com/*', 'https://*.office.com/*'],
      };
    
    case 'edge':
      return {
        csp: "script-src 'self'; object-src 'self';",
        permissions: ['storage', 'scripting'],
        hostPermissions: ['https://*.sharepoint.com/*', 'https://*.office.com/*'],
      };
    
    case 'safari':
      return {
        permissions: ['storage', 'scripting'],
        hostPermissions: ['https://*.sharepoint.com/*', 'https://*.office.com/*'],
      };
    
    default:
      return {};
  }
}

/**
 * Get known limitations for specific browser
 */
function getBrowserLimitations(browser: TargetBrowser): string[] {
  switch (browser) {
    case 'chrome':
      return [
        'Service worker lifecycle limitations',
        'Storage quota restrictions',
      ];
    
    case 'firefox':
      return [
        'No sidePanel API support',
        'Different background script model',
        'Limited service worker support',
        'Different permission names (menus vs contextMenus)',
        'No identity API support',
      ];
    
    case 'edge':
      return [
        'Service worker lifecycle limitations',
        'Storage quota restrictions',
      ];
    
    case 'safari':
      return [
        'No sidePanel API support',
        'No offscreen API support',
        'Limited service worker support',
        'No declarativeContent API support',
        'No identity API support',
        'Different extension architecture',
      ];
    
    default:
      return [];
  }
}

/**
 * Check if browser version meets minimum requirements
 */
export function checkBrowserCompatibility(browser: TargetBrowser, version: string): {
  compatible: boolean;
  issues: BrowserCompatibilityIssue[];
} {
  const requirements = BROWSER_VERSION_REQUIREMENTS[browser];
  const issues: BrowserCompatibilityIssue[] = [];
  
  const versionNum = parseInt(version);
  const minVersionNum = parseInt(requirements.minVersion);
  const recommendedVersionNum = requirements.recommendedVersion ? parseInt(requirements.recommendedVersion) : null;
  
  let compatible = true;
  
  // Check minimum version
  if (versionNum < minVersionNum) {
    compatible = false;
    issues.push({
      browser,
      severity: 'error',
      description: `Browser version ${version} is below minimum required version ${requirements.minVersion}`,
      property: 'version',
      suggestedFix: `Update ${browser} to version ${requirements.minVersion} or higher`,
    });
  }
  
  // Check recommended version
  if (recommendedVersionNum && versionNum < recommendedVersionNum) {
    issues.push({
      browser,
      severity: 'warning',
      description: `Browser version ${version} is below recommended version ${requirements.recommendedVersion}`,
      property: 'version',
      suggestedFix: `Update ${browser} to version ${requirements.recommendedVersion} for best experience`,
    });
  }
  
  return { compatible, issues };
}

/**
 * Get browser-specific manifest adjustments
 */
export function getBrowserManifestAdjustments(browser: TargetBrowser): {
  remove: string[];
  modify: Record<string, unknown>;
  add: Record<string, unknown>;
} {
  switch (browser) {
    case 'chrome':
      return {
        remove: [],
        modify: {},
        add: {},
      };
    
    case 'firefox':
      return {
        remove: ['sidePanel', 'offscreen'],
        modify: {
          background: {
            scripts: ['background.js'],
            persistent: false,
          },
          permissions: {
            contextMenus: 'menus', // Firefox uses 'menus' instead of 'contextMenus'
          },
          browser_specific_settings: {
            gecko: {
              id: 'meeting-summarizer@example.com',
              strict_min_version: '109.0',
            },
          },
        },
        add: {
          applications: {
            gecko: {
              id: 'meeting-summarizer@example.com',
              strict_min_version: '109.0',
            },
          },
        },
      };
    
    case 'edge':
      return {
        remove: [],
        modify: {},
        add: {},
      };
    
    case 'safari':
      return {
        remove: ['sidePanel', 'offscreen', 'declarativeContent'],
        modify: {
          background: {
            scripts: ['background.js'],
            persistent: false,
          },
        },
        add: {},
      };
    
    default:
      return {
        remove: [],
        modify: {},
        add: {},
      };
  }
}

/**
 * Detect current runtime browser environment
 */
export function detectRuntimeBrowser(): TargetBrowser | null {
  // Check if we're in a browser environment
  if (typeof navigator === 'undefined') {
    return null;
  }
  
  const userAgent = navigator.userAgent;
  return detectBrowserFromUserAgent(userAgent);
}

/**
 * Check if browser supports specific feature
 */
export function checkBrowserFeatureSupport(browser: TargetBrowser, feature: string): boolean {
  const apiSupport = BROWSER_API_SUPPORT[browser];
  return apiSupport[feature] === true;
}

/**
 * Get mapped permission name for browser
 */
export function getMappedPermissionName(browser: TargetBrowser, permission: string): string | null {
  const mappings = BROWSER_PERMISSION_MAPPINGS[browser];
  return mappings[permission] || null;
}

/**
 * Filter permissions based on browser support
 */
export function filterPermissionsForBrowser(browser: TargetBrowser, permissions: string[]): string[] {
  return permissions
    .map(permission => getMappedPermissionName(browser, permission))
    .filter((permission): permission is string => permission !== null);
}

/**
 * Get browser-specific content script configurations
 */
export function getBrowserContentScriptConfig(browser: TargetBrowser): {
  injectionStrategy: 'automatic' | 'manual';
  worldContext: 'ISOLATED' | 'MAIN' | undefined;
  runAt: 'document_start' | 'document_end' | 'document_idle';
} {
  switch (browser) {
    case 'chrome':
    case 'edge':
      return {
        injectionStrategy: 'automatic',
        worldContext: 'ISOLATED',
        runAt: 'document_idle',
      };
    
    case 'firefox':
      return {
        injectionStrategy: 'automatic',
        worldContext: undefined, // Firefox doesn't support world context
        runAt: 'document_idle',
      };
    
    case 'safari':
      return {
        injectionStrategy: 'manual',
        worldContext: undefined,
        runAt: 'document_end',
      };
    
    default:
      return {
        injectionStrategy: 'automatic',
        worldContext: 'ISOLATED',
        runAt: 'document_idle',
      };
  }
}

/**
 * Utility functions for browser detection and configuration
 */
export const browserDetectUtils = {
  detectBrowserFromUserAgent,
  extractBrowserVersion,
  detectBrowserCapabilities,
  checkBrowserCompatibility,
  getBrowserManifestAdjustments,
  detectRuntimeBrowser,
  checkBrowserFeatureSupport,
  getMappedPermissionName,
  filterPermissionsForBrowser,
  getBrowserContentScriptConfig,
  
  /**
   * Get all supported browsers
   */
  getSupportedBrowsers(): TargetBrowser[] {
    return Object.keys(BROWSER_PATTERNS) as TargetBrowser[];
  },
  
  /**
   * Get browser version requirements
   */
  getBrowserVersionRequirements(browser: TargetBrowser): BrowserVersionRequirement {
    return BROWSER_VERSION_REQUIREMENTS[browser];
  },
  
  /**
   * Check if browser is Chromium-based
   */
  isChromiumBased(browser: TargetBrowser): boolean {
    return ['chrome', 'edge'].includes(browser);
  },
  
  /**
   * Check if browser supports Manifest V3
   */
  supportsManifestV3(browser: TargetBrowser): boolean {
    return ['chrome', 'edge'].includes(browser);
  },
  
  /**
   * Get recommended manifest version for browser
   */
  getRecommendedManifestVersion(browser: TargetBrowser): 2 | 3 {
    return this.supportsManifestV3(browser) ? 3 : 2;
  },
};