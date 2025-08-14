/**
 * Manifest configuration types for cross-browser compatibility
 * Provides type definitions for browser-specific manifest generation,
 * browser detection, and manifest configuration management.
 */

import type { ManifestType } from '@extension/shared';

/**
 * Supported target browsers
 */
export type TargetBrowser = 'chrome' | 'firefox' | 'edge' | 'safari';

/**
 * Browser version requirements
 */
export interface BrowserVersionRequirement {
  /** Minimum required version */
  minVersion: string;
  /** Maximum supported version (optional) */
  maxVersion?: string;
  /** Recommended version */
  recommendedVersion?: string;
}

/**
 * Browser-specific settings for manifest generation
 */
export interface BrowserSpecificSettings {
  /** Chrome-specific settings */
  chrome?: {
    /** Minimum Chrome version */
    minVersion: string;
    /** Chrome extension store requirements */
    storeRequirements?: {
      /** Content Security Policy restrictions */
      cspRestrictions?: string[];
      /** Required permissions */
      requiredPermissions?: string[];
    };
    /** Chrome-specific API availability */
    apiSupport?: {
      /** Side panel API support */
      sidePanel?: boolean;
      /** Offscreen API support */
      offscreen?: boolean;
      /** Service worker API support */
      serviceWorker?: boolean;
    };
  };

  /** Firefox-specific settings */
  firefox?: {
    /** Gecko-specific configuration */
    gecko: {
      /** Extension ID for AMO */
      id: string;
      /** Minimum Firefox version */
      strict_min_version: string;
      /** Update URL for self-hosted extensions */
      update_url?: string;
    };
    /** Firefox-specific API differences */
    apiDifferences?: {
      /** Storage API limitations */
      storageQuota?: number;
      /** Background script type */
      backgroundType?: 'page' | 'script';
      /** Content script injection differences */
      contentScriptInjection?: 'automatic' | 'manual';
    };
  };

  /** Edge-specific settings */
  edge?: {
    /** Minimum Edge version */
    minVersion: string;
    /** Edge store requirements */
    storeRequirements?: {
      /** Required capabilities */
      capabilities?: string[];
      /** Microsoft Store specific settings */
      storeSettings?: Record<string, unknown>;
    };
  };

  /** Safari-specific settings */
  safari?: {
    /** Minimum Safari version */
    minVersion: string;
    /** Safari extension bundle configuration */
    bundle?: {
      /** Bundle identifier */
      identifier: string;
      /** App Store requirements */
      appStoreRequirements?: Record<string, unknown>;
    };
  };
}

/**
 * Manifest generation configuration
 */
export interface BrowserManifestConfig {
  /** Base manifest configuration */
  baseManifest: ManifestType;
  /** Target browser */
  targetBrowser: TargetBrowser;
  /** Browser-specific overrides */
  browserOverrides?: Partial<ManifestType>;
  /** Browser-specific settings */
  browserSettings: BrowserSpecificSettings;
  /** Development mode configuration */
  development?: {
    /** Enable development features */
    enableDevFeatures?: boolean;
    /** Hot reload configuration */
    hotReload?: boolean;
    /** Debug mode settings */
    debugMode?: boolean;
  };
  /** Build environment */
  environment: 'development' | 'staging' | 'production';
  /** Feature flags for conditional manifest entries */
  featureFlags?: ManifestFeatureFlags;
}

/**
 * Feature flags that affect manifest generation
 */
export interface ManifestFeatureFlags {
  /** Enable side panel (Chrome only) */
  enableSidePanel?: boolean;
  /** Enable offscreen documents */
  enableOffscreen?: boolean;
  /** Enable content script injection on all sites */
  enableAllSitesAccess?: boolean;
  /** Enable host permissions for SharePoint */
  enableSharePointAccess?: boolean;
  /** Enable notifications */
  enableNotifications?: boolean;
  /** Enable context menus */
  enableContextMenus?: boolean;
  /** Enable declarative content */
  enableDeclarativeContent?: boolean;
  /** Enable web navigation */
  enableWebNavigation?: boolean;
}

/**
 * Manifest validation result
 */
export interface ManifestValidationResult {
  /** Whether manifest is valid */
  isValid: boolean;
  /** Validation errors */
  errors: ManifestValidationError[];
  /** Validation warnings */
  warnings: string[];
  /** Browser compatibility issues */
  compatibilityIssues: BrowserCompatibilityIssue[];
  /** Validation timestamp */
  validatedAt: string;
}

/**
 * Manifest validation error types
 */
export type ManifestValidationError =
  | 'INVALID_MANIFEST_VERSION'
  | 'MISSING_REQUIRED_FIELD'
  | 'INVALID_PERMISSIONS'
  | 'INVALID_HOST_PERMISSIONS'
  | 'INVALID_CONTENT_SCRIPTS'
  | 'INVALID_BACKGROUND_SCRIPT'
  | 'INVALID_ACTION'
  | 'INVALID_ICONS'
  | 'BROWSER_INCOMPATIBLE_FEATURE'
  | 'INVALID_CSP'
  | 'INVALID_WEB_ACCESSIBLE_RESOURCES';

/**
 * Browser compatibility issue
 */
export interface BrowserCompatibilityIssue {
  /** Browser where issue occurs */
  browser: TargetBrowser;
  /** Severity of the issue */
  severity: 'error' | 'warning' | 'info';
  /** Issue description */
  description: string;
  /** Affected manifest property */
  property: string;
  /** Suggested fix */
  suggestedFix?: string;
  /** Alternative approach */
  alternative?: string;
}

/**
 * Browser capability detection result
 */
export interface BrowserCapabilities {
  /** Browser type */
  browser: TargetBrowser;
  /** Browser version */
  version: string;
  /** Supported manifest version */
  manifestVersion: number;
  /** Supported permissions */
  supportedPermissions: string[];
  /** Supported APIs */
  supportedAPIs: string[];
  /** Extension store requirements */
  storeRequirements: {
    /** Content Security Policy requirements */
    csp?: string;
    /** Required permissions */
    permissions?: string[];
    /** Host permission restrictions */
    hostPermissions?: string[];
  };
  /** Known limitations */
  limitations: string[];
}

/**
 * Manifest generation context
 */
export interface ManifestGenerationContext {
  /** Build configuration */
  buildConfig: {
    /** Build mode */
    mode: 'development' | 'production';
    /** Output directory */
    outputDir: string;
    /** Source directory */
    sourceDir: string;
    /** Asset directory */
    assetDir: string;
  };
  /** Package information */
  packageInfo: {
    /** Package name */
    name: string;
    /** Package version */
    version: string;
    /** Package description */
    description: string;
    /** Package author */
    author?: string;
    /** Package homepage */
    homepage?: string;
  };
  /** Environment variables */
  env: Record<string, string>;
  /** Feature toggles */
  features: ManifestFeatureFlags;
}

/**
 * Content script configuration for different browsers
 */
export interface BrowserContentScriptConfig {
  /** Base content script configuration */
  base: chrome.runtime.ManifestV3['content_scripts'];
  /** Browser-specific overrides */
  browserOverrides: Partial<Record<TargetBrowser, chrome.runtime.ManifestV3['content_scripts']>>;
  /** Match patterns for different environments */
  matchPatterns: {
    /** SharePoint Online patterns */
    sharepoint: string[];
    /** Microsoft Teams patterns */
    teams: string[];
    /** Generic meeting platform patterns */
    generic: string[];
    /** Development patterns */
    development?: string[];
  };
}

/**
 * Background script configuration for different browsers
 */
export interface BrowserBackgroundConfig {
  /** Service worker configuration (Chrome, Edge) */
  serviceWorker?: {
    /** Service worker script path */
    service_worker: string;
    /** Module type */
    type?: 'module';
  };
  /** Background page configuration (Firefox fallback) */
  backgroundPage?: {
    /** Background page script paths */
    scripts: string[];
    /** Whether background page is persistent */
    persistent: boolean;
  };
  /** Background script type preference by browser */
  browserPreferences: Record<TargetBrowser, 'service_worker' | 'background_page'>;
}

/**
 * Permissions configuration for different browsers
 */
export interface BrowserPermissionsConfig {
  /** Core permissions required by all browsers */
  core: string[];
  /** Optional permissions that can be requested at runtime */
  optional: string[];
  /** Browser-specific permission mappings */
  browserMappings: Partial<
    Record<
      TargetBrowser,
      {
        /** Permissions to add for this browser */
        add?: string[];
        /** Permissions to remove for this browser */
        remove?: string[];
        /** Permission name mappings */
        rename?: Record<string, string>;
      }
    >
  >;
  /** Host permissions configuration */
  hostPermissions: {
    /** Required host permissions */
    required: string[];
    /** Optional host permissions */
    optional: string[];
    /** Environment-specific patterns */
    patterns: {
      /** Production environment patterns */
      production: string[];
      /** Development environment patterns */
      development: string[];
    };
  };
}

/**
 * Web accessible resources configuration
 */
export interface BrowserWebAccessibleResourcesConfig {
  /** Resource patterns by type */
  resources: {
    /** JavaScript files */
    scripts: string[];
    /** CSS files */
    styles: string[];
    /** Image files */
    images: string[];
    /** Other assets */
    assets: string[];
  };
  /** Match patterns for resource access */
  matches: string[];
  /** Browser-specific resource configurations */
  browserConfigs: Partial<
    Record<
      TargetBrowser,
      {
        /** Additional resources for this browser */
        additionalResources?: string[];
        /** Resource restrictions */
        restrictions?: string[];
      }
    >
  >;
}

/**
 * Icon configuration for different browsers
 */
export interface BrowserIconConfig {
  /** Icon sizes and paths */
  icons: Record<string, string>;
  /** Browser-specific icon requirements */
  browserRequirements: Partial<
    Record<
      TargetBrowser,
      {
        /** Required icon sizes */
        requiredSizes: string[];
        /** Recommended icon sizes */
        recommendedSizes?: string[];
        /** Icon format requirements */
        formats?: string[];
      }
    >
  >;
  /** Action icon configuration */
  actionIcon?: {
    /** Default icon */
    default_icon: string | Record<string, string>;
    /** Browser-specific action icons */
    browserIcons?: Partial<Record<TargetBrowser, string | Record<string, string>>>;
  };
}

/**
 * Complete browser manifest configuration
 */
export interface CompleteBrowserManifestConfig {
  /** Base manifest properties */
  base: {
    /** Manifest version */
    manifest_version: number;
    /** Extension name */
    name: string;
    /** Extension version */
    version: string;
    /** Extension description */
    description: string;
  };
  /** Browser-specific settings */
  browserSettings: BrowserSpecificSettings;
  /** Content scripts configuration */
  contentScripts: BrowserContentScriptConfig;
  /** Background scripts configuration */
  background: BrowserBackgroundConfig;
  /** Permissions configuration */
  permissions: BrowserPermissionsConfig;
  /** Web accessible resources configuration */
  webAccessibleResources: BrowserWebAccessibleResourcesConfig;
  /** Icons configuration */
  icons: BrowserIconConfig;
  /** Additional browser-specific configurations */
  additionalConfigs?: Partial<Record<TargetBrowser, Record<string, unknown>>>;
}

/**
 * Manifest template for different browsers
 */
export interface ManifestTemplate {
  /** Template identifier */
  templateId: string;
  /** Target browser */
  browser: TargetBrowser;
  /** Template version */
  version: string;
  /** Manifest template content */
  template: Partial<ManifestType>;
  /** Required placeholders */
  placeholders: string[];
  /** Optional placeholders */
  optionalPlaceholders?: string[];
  /** Template validation rules */
  validationRules?: ManifestValidationRule[];
}

/**
 * Manifest validation rule
 */
export interface ManifestValidationRule {
  /** Rule identifier */
  ruleId: string;
  /** Property path to validate */
  propertyPath: string;
  /** Validation type */
  validationType: 'required' | 'type' | 'enum' | 'pattern' | 'custom';
  /** Validation configuration */
  config: {
    /** Expected type */
    type?: string;
    /** Allowed values for enum validation */
    allowedValues?: unknown[];
    /** Regular expression pattern */
    pattern?: string;
    /** Custom validation function name */
    customValidator?: string;
  };
  /** Error message template */
  errorMessage: string;
  /** Rule severity */
  severity: 'error' | 'warning';
}

/**
 * Manifest generation result
 */
export interface ManifestGenerationResult {
  /** Generated manifest */
  manifest: ManifestType;
  /** Target browser */
  browser: TargetBrowser;
  /** Generation success status */
  success: boolean;
  /** Generation errors */
  errors: string[];
  /** Generation warnings */
  warnings: string[];
  /** Applied transformations */
  transformations: string[];
  /** Validation result */
  validation: ManifestValidationResult;
  /** Generation timestamp */
  generatedAt: string;
  /** Output file path */
  outputPath?: string;
}
