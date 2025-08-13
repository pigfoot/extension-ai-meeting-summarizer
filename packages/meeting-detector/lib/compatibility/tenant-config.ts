/**
 * Tenant Configuration
 * Manages configuration for different SharePoint and Teams tenants
 */

/**
 * Cross-tenant configuration management for SharePoint and Teams environments
 */
export class TenantConfig {
  private tenantConfigs: Map<string, TenantConfiguration> = new Map();
  private defaultConfig: TenantConfiguration;
  private configCache: Map<string, CachedTenantConfig> = new Map();

  constructor() {
    this.defaultConfig = this.createDefaultConfiguration();
    this.initializeKnownTenants();
  }

  /**
   * Get configuration for a specific tenant
   */
  getTenantConfig(tenantId: string): TenantConfiguration {
    // Check cache first
    const cached = this.configCache.get(tenantId);
    if (cached && !this.isCacheExpired(cached)) {
      return cached.config;
    }

    // Get from stored configs
    const config = this.tenantConfigs.get(tenantId) || this.defaultConfig;

    // Cache the result
    this.configCache.set(tenantId, {
      config,
      timestamp: Date.now(),
      ttl: 30 * 60 * 1000, // 30 minutes
    });

    return config;
  }

  /**
   * Auto-detect tenant configuration from URL and page content
   */
  detectTenantConfig(url: string, document: Document): TenantConfiguration {
    const tenantId = this.extractTenantId(url);

    if (tenantId) {
      const existingConfig = this.getTenantConfig(tenantId);

      // Enhance configuration with detected features
      return this.enhanceConfigWithDetection(existingConfig, document, url);
    }

    // Create dynamic configuration based on detection
    return this.createDynamicConfiguration(document, url);
  }

  /**
   * Register a new tenant configuration
   */
  registerTenant(tenantId: string, config: Partial<TenantConfiguration>): void {
    const fullConfig = this.mergeWithDefaults(config);
    this.tenantConfigs.set(tenantId, fullConfig);

    // Clear cache for this tenant
    this.configCache.delete(tenantId);
  }

  /**
   * Update existing tenant configuration
   */
  updateTenantConfig(tenantId: string, updates: Partial<TenantConfiguration>): void {
    const existing = this.tenantConfigs.get(tenantId) || this.defaultConfig;
    const updated = { ...existing, ...updates };

    this.tenantConfigs.set(tenantId, updated);
    this.configCache.delete(tenantId);
  }

  /**
   * Get domain patterns for tenant detection
   */
  getDomainPatterns(): DomainPattern[] {
    const patterns: DomainPattern[] = [];

    for (const [tenantId, config] of this.tenantConfigs) {
      patterns.push(
        ...config.domainPatterns.map(pattern => ({
          ...pattern,
          tenantId,
        })),
      );
    }

    return patterns;
  }

  /**
   * Validate tenant configuration
   */
  validateConfig(config: TenantConfiguration): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields validation
    if (!config.tenantId) {
      errors.push('Tenant ID is required');
    }

    if (!config.domainPatterns || config.domainPatterns.length === 0) {
      errors.push('At least one domain pattern is required');
    }

    // Validate domain patterns
    for (const pattern of config.domainPatterns) {
      try {
        new RegExp(pattern.pattern);
      } catch {
        errors.push(`Invalid regex pattern: ${pattern.pattern}`);
      }
    }

    // Validate selectors
    if (config.selectors.meetingTitle.length === 0) {
      warnings.push('No meeting title selectors defined');
    }

    if (config.selectors.participantList.length === 0) {
      warnings.push('No participant list selectors defined');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Export tenant configurations
   */
  exportConfigurations(): ExportedTenantConfigs {
    const configs: Record<string, TenantConfiguration> = {};

    for (const [tenantId, config] of this.tenantConfigs) {
      configs[tenantId] = config;
    }

    return {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      configs,
      defaultConfig: this.defaultConfig,
    };
  }

  /**
   * Import tenant configurations
   */
  importConfigurations(exported: ExportedTenantConfigs): void {
    // Validate import format
    if (!exported.configs || !exported.version) {
      throw new Error('Invalid configuration format');
    }

    // Clear existing configs
    this.tenantConfigs.clear();
    this.configCache.clear();

    // Import configurations
    for (const [tenantId, config] of Object.entries(exported.configs)) {
      const validation = this.validateConfig(config);
      if (validation.isValid) {
        this.tenantConfigs.set(tenantId, config);
      } else {
        console.warn(`Skipping invalid tenant config ${tenantId}:`, validation.errors);
      }
    }

    // Update default config if provided
    if (exported.defaultConfig) {
      this.defaultConfig = exported.defaultConfig;
    }
  }

  // Private methods

  private createDefaultConfiguration(): TenantConfiguration {
    return {
      tenantId: 'default',
      displayName: 'Default Configuration',
      region: 'global',
      environment: 'production',

      domainPatterns: [
        {
          pattern: '\\.sharepoint\\.com',
          type: 'sharepoint',
          confidence: 0.9,
        },
        {
          pattern: 'teams\\.microsoft\\.com',
          type: 'teams',
          confidence: 0.95,
        },
      ],

      selectors: {
        meetingTitle: [
          'h1[data-automation-id*="meeting"]',
          '.meeting-title',
          '[data-tid="meeting-title"]',
          '.conversation-title',
        ],
        organizer: ['[data-tid="organizer"]', '.meeting-organizer', '.created-by'],
        participants: ['.participant-list .participant', '[data-automation-id="participants"] .name'],
        participantList: ['.participant-list', '.attendee-list', '[data-automation-id="participants"]'],
        agenda: ['.agenda', '.meeting-agenda', '.agenda-items'],
        mediaElements: ['video[src]', 'audio[src]', '[data-media-url]'],
        recordingIndicators: ['.recording-indicator', '[data-recording]', '.stream-video'],
      },

      features: {
        hasRecordings: true,
        hasTranscripts: true,
        hasParticipantList: true,
        hasAgenda: true,
        hasChat: true,
        hasScreenSharing: true,
        supportsDownload: false,
        requiresAuth: true,
      },

      apiEndpoints: {
        graph: 'https://graph.microsoft.com',
        stream: undefined,
        sharepoint: undefined,
      },

      customization: {
        dateFormat: 'en-US',
        timeZone: 'UTC',
        language: 'en',
        theme: 'default',
      },

      security: {
        allowCrossDomain: false,
        requireSSL: true,
        allowedOrigins: [],
        cspDirectives: [],
      },
    };
  }

  private initializeKnownTenants(): void {
    // Microsoft tenant (for demo/testing)
    this.registerTenant('microsoft', {
      tenantId: 'microsoft',
      displayName: 'Microsoft Corporation',
      region: 'global',
      environment: 'production',
      domainPatterns: [
        {
          pattern: 'microsoft\\.sharepoint\\.com',
          type: 'sharepoint',
          confidence: 1.0,
        },
        {
          pattern: 'teams\\.microsoft\\.com.*microsoft',
          type: 'teams',
          confidence: 1.0,
        },
      ],
      features: {
        ...this.defaultConfig.features,
        hasRecordings: true,
        hasTranscripts: true,
        supportsDownload: true,
      },
    });

    // Government cloud tenant
    this.registerTenant('government', {
      tenantId: 'government',
      displayName: 'Government Cloud',
      region: 'us-gov',
      environment: 'government',
      domainPatterns: [
        {
          pattern: '\\.sharepoint-mil\\.us',
          type: 'sharepoint',
          confidence: 1.0,
        },
        {
          pattern: 'dod\\.teams\\.microsoft\\.us',
          type: 'teams',
          confidence: 1.0,
        },
      ],
      apiEndpoints: {
        graph: 'https://graph.microsoft.us',
        stream: 'https://stream-mil.azure.us',
        sharepoint: 'https://tenant.sharepoint-mil.us',
      },
      security: {
        allowCrossDomain: false,
        requireSSL: true,
        allowedOrigins: ['*.mil', '*.gov'],
        cspDirectives: ["default-src 'self' *.mil *.gov"],
      },
    });

    // European cloud tenant
    this.registerTenant('europe', {
      tenantId: 'europe',
      displayName: 'European Cloud',
      region: 'europe',
      environment: 'production',
      domainPatterns: [
        {
          pattern: '\\.sharepoint\\.de',
          type: 'sharepoint',
          confidence: 1.0,
        },
        {
          pattern: 'teams\\.microsoft\\.de',
          type: 'teams',
          confidence: 1.0,
        },
      ],
      customization: {
        dateFormat: 'de-DE',
        timeZone: 'Europe/Berlin',
        language: 'de',
        theme: 'european',
      },
    });
  }

  private extractTenantId(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;

      // Extract from SharePoint URLs
      const sharepointMatch = hostname.match(/^([^.]+)\.sharepoint\.com/);
      if (sharepointMatch && sharepointMatch[1]) {
        return sharepointMatch[1];
      }

      // Extract from Teams URLs
      const teamsMatch = urlObj.searchParams.get('tenantId');
      if (teamsMatch) {
        return teamsMatch;
      }

      // Extract from subdomain
      const subdomainMatch = hostname.match(/^([^.]+)\./);
      if (subdomainMatch && subdomainMatch[1] && subdomainMatch[1] !== 'www') {
        return subdomainMatch[1];
      }
    } catch {
      // Ignore URL parsing errors
    }

    return null;
  }

  private enhanceConfigWithDetection(
    config: TenantConfiguration,
    document: Document,
    _url: string,
  ): TenantConfiguration {
    void _url;
    const enhanced = { ...config };

    // Detect additional features
    enhanced.features = {
      ...enhanced.features,
      hasRecordings: this.detectRecordingCapability(document),
      hasTranscripts: this.detectTranscriptCapability(document),
      hasParticipantList: this.detectParticipantList(document),
      hasAgenda: this.detectAgenda(document),
      hasChat: this.detectChat(document),
      hasScreenSharing: this.detectScreenSharing(document),
    };

    // Detect language and region
    const detectedLanguage = this.detectLanguage(document);
    if (detectedLanguage && detectedLanguage !== enhanced.customization.language) {
      enhanced.customization = {
        ...enhanced.customization,
        language: detectedLanguage,
      };
    }

    return enhanced;
  }

  private createDynamicConfiguration(document: Document, url: string): TenantConfiguration {
    const tenantId = this.extractTenantId(url) || 'unknown';

    return {
      ...this.defaultConfig,
      tenantId,
      displayName: `Dynamic Configuration (${tenantId})`,
      features: {
        hasRecordings: this.detectRecordingCapability(document),
        hasTranscripts: this.detectTranscriptCapability(document),
        hasParticipantList: this.detectParticipantList(document),
        hasAgenda: this.detectAgenda(document),
        hasChat: this.detectChat(document),
        hasScreenSharing: this.detectScreenSharing(document),
        supportsDownload: this.detectDownloadCapability(document),
        requiresAuth: true, // Always assume auth required for security
      },
      customization: {
        ...this.defaultConfig.customization,
        language: this.detectLanguage(document) || 'en',
      },
    };
  }

  private mergeWithDefaults(partial: Partial<TenantConfiguration>): TenantConfiguration {
    return {
      ...this.defaultConfig,
      ...partial,
      selectors: {
        ...this.defaultConfig.selectors,
        ...partial.selectors,
      },
      features: {
        ...this.defaultConfig.features,
        ...partial.features,
      },
      apiEndpoints: {
        ...this.defaultConfig.apiEndpoints,
        ...partial.apiEndpoints,
      },
      customization: {
        ...this.defaultConfig.customization,
        ...partial.customization,
      },
      security: {
        ...this.defaultConfig.security,
        ...partial.security,
      },
    };
  }

  private isCacheExpired(cached: CachedTenantConfig): boolean {
    return Date.now() - cached.timestamp > cached.ttl;
  }

  // Feature detection methods

  private detectRecordingCapability(document: Document): boolean {
    const recordingIndicators = [
      '.recording-indicator',
      '[data-recording]',
      '.stream-video',
      'video[src*="stream"]',
      '.meeting-recording',
    ];

    return recordingIndicators.some(selector => document.querySelector(selector) !== null);
  }

  private detectTranscriptCapability(document: Document): boolean {
    const transcriptIndicators = [
      '.transcript',
      '.captions',
      '[data-transcript]',
      '.meeting-transcript',
      '.live-captions',
    ];

    return transcriptIndicators.some(selector => document.querySelector(selector) !== null);
  }

  private detectParticipantList(document: Document): boolean {
    const participantIndicators = [
      '.participant-list',
      '.attendee-list',
      '[data-automation-id="participants"]',
      '.roster',
      '.people-list',
    ];

    return participantIndicators.some(selector => document.querySelector(selector) !== null);
  }

  private detectAgenda(document: Document): boolean {
    const agendaIndicators = ['.agenda', '.meeting-agenda', '.agenda-items', '[data-agenda]', '.topics'];

    return agendaIndicators.some(selector => document.querySelector(selector) !== null);
  }

  private detectChat(document: Document): boolean {
    const chatIndicators = ['.chat', '.messages', '.conversation', '[data-chat]', '.meeting-chat'];

    return chatIndicators.some(selector => document.querySelector(selector) !== null);
  }

  private detectScreenSharing(document: Document): boolean {
    const screenShareIndicators = [
      '.screen-share',
      '.shared-screen',
      '[data-screen-share]',
      '.presentation-view',
      '.desktop-share',
    ];

    return screenShareIndicators.some(selector => document.querySelector(selector) !== null);
  }

  private detectDownloadCapability(document: Document): boolean {
    const downloadIndicators = ['a[download]', '.download-button', '[data-action="download"]', '.export-button'];

    return downloadIndicators.some(selector => document.querySelector(selector) !== null);
  }

  private detectLanguage(document: Document): string | null {
    // Try to detect language from HTML lang attribute
    const htmlLang = document.documentElement.lang;
    if (htmlLang) {
      return htmlLang.toLowerCase();
    }

    // Try to detect from content
    const content = document.body.textContent || '';

    const languagePatterns = [
      { lang: 'zh-tw', pattern: /[\u4e00-\u9fff]/ },
      { lang: 'ja', pattern: /[\u3040-\u309f\u30a0-\u30ff]/ },
      { lang: 'ko', pattern: /[\uac00-\ud7af]/ },
      { lang: 'de', pattern: /\b(der|die|das|und|mit|für|in|auf|von)\b/i },
      { lang: 'fr', pattern: /\b(le|la|de|du|avec|pour|dans|sur)\b/i },
      { lang: 'es', pattern: /\b(el|la|de|en|con|para|por|sobre)\b/i },
    ];

    for (const { lang, pattern } of languagePatterns) {
      if (pattern.test(content)) {
        return lang;
      }
    }

    return null;
  }
}

// Supporting interfaces and types

export interface TenantConfiguration {
  tenantId: string;
  displayName: string;
  region: string;
  environment: 'production' | 'staging' | 'development' | 'government';

  domainPatterns: DomainPattern[];
  selectors: TenantSelectors;
  features: TenantFeatures;
  apiEndpoints: ApiEndpoints;
  customization: TenantCustomization;
  security: SecuritySettings;
}

export interface DomainPattern {
  pattern: string;
  type: 'sharepoint' | 'teams' | 'stream' | 'other';
  confidence: number;
  tenantId?: string;
}

export interface TenantSelectors {
  meetingTitle: string[];
  organizer: string[];
  participants: string[];
  participantList: string[];
  agenda: string[];
  mediaElements: string[];
  recordingIndicators: string[];
}

export interface TenantFeatures {
  hasRecordings: boolean;
  hasTranscripts: boolean;
  hasParticipantList: boolean;
  hasAgenda: boolean;
  hasChat: boolean;
  hasScreenSharing: boolean;
  supportsDownload: boolean;
  requiresAuth: boolean;
}

export interface ApiEndpoints {
  graph: string;
  stream?: string | undefined;
  sharepoint?: string | undefined;
}

export interface TenantCustomization {
  dateFormat: string;
  timeZone: string;
  language: string;
  theme: string;
}

export interface SecuritySettings {
  allowCrossDomain: boolean;
  requireSSL: boolean;
  requiresAuth?: boolean | undefined;
  allowedOrigins: string[];
  cspDirectives: string[];
}

export interface CachedTenantConfig {
  config: TenantConfiguration;
  timestamp: number;
  ttl: number;
}

export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ExportedTenantConfigs {
  version: string;
  timestamp: string;
  configs: Record<string, TenantConfiguration>;
  defaultConfig: TenantConfiguration;
}

// Create singleton instance
export const tenantConfig = new TenantConfig();
