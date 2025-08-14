/**
 * Domain Adapter
 * Adapts detection logic for different SharePoint and Teams domains/configurations
 */

import type { TenantConfiguration } from './tenant-config';

/**
 * Cross-domain adaptation for different SharePoint and Teams configurations
 */
export class DomainAdapter {
  private adapterCache: Map<string, AdapterInstance> = new Map();
  private patterns: Map<string, DomainPattern[]> = new Map();

  constructor() {
    this.initializeDomainPatterns();
  }

  /**
   * Create adapter instance for specific domain/tenant
   */
  createAdapter(domain: string, tenantConfig: TenantConfiguration): AdapterInstance {
    const cacheKey = `${domain}-${tenantConfig.tenantId}`;

    // Return cached adapter if available
    const cached = this.adapterCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Create new adapter instance
    const adapter = this.buildAdapter(domain, tenantConfig);
    this.adapterCache.set(cacheKey, adapter);

    return adapter;
  }

  /**
   * Adapt selectors for specific domain configuration
   */
  adaptSelectors(baseSelectors: string[], domain: string, tenantConfig: TenantConfiguration): string[] {
    const adapter = this.createAdapter(domain, tenantConfig);
    return adapter.adaptSelectors(baseSelectors);
  }

  /**
   * Adapt URLs for cross-domain access
   */
  adaptUrls(
    urls: string[],
    sourceDomain: string,
    targetDomain: string,
    tenantConfig: TenantConfiguration,
  ): AdaptedUrl[] {
    const adapter = this.createAdapter(targetDomain, tenantConfig);
    return urls.map(url => adapter.adaptUrl(url, sourceDomain));
  }

  /**
   * Get domain-specific extraction patterns
   */
  getExtractionPatterns(domain: string): ExtractionPattern[] {
    const patterns = this.patterns.get(domain);
    if (patterns) {
      return this.convertToExtractionPatterns(patterns);
    }

    // Return default patterns for unknown domains
    return this.getDefaultExtractionPatterns();
  }

  /**
   * Detect domain type and configuration
   */
  analyzeDomain(url: string, document: Document): DomainAnalysis {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;

      return {
        hostname,
        type: this.detectDomainType(hostname),
        region: this.detectRegion(hostname, document),
        environment: this.detectEnvironment(hostname, document),
        tenant: this.extractTenantInfo(hostname, urlObj),
        features: this.detectDomainFeatures(document),
        customizations: this.detectCustomizations(document),
        security: this.detectSecuritySettings(document),
      };
    } catch {
      return this.createFailsafeDomainAnalysis(url);
    }
  }

  /**
   * Validate cross-domain compatibility
   */
  validateCompatibility(
    sourceDomain: string,
    targetDomain: string,
    tenantConfig: TenantConfiguration,
    document: Document,
  ): CompatibilityResult {
    const sourceAnalysis = this.analyzeDomain(sourceDomain, document);
    const targetAnalysis = this.analyzeDomain(targetDomain, document);

    return {
      compatible: this.areDomainsCompatible(sourceAnalysis, targetAnalysis),
      issues: this.identifyCompatibilityIssues(sourceAnalysis, targetAnalysis),
      adaptations: this.suggestAdaptations(sourceAnalysis, targetAnalysis),
      security: this.validateSecurityCompatibility(sourceAnalysis, targetAnalysis, tenantConfig),
    };
  }

  // Private methods

  private initializeDomainPatterns(): void {
    // SharePoint Online patterns
    this.patterns.set('sharepoint.com', [
      {
        type: 'title',
        pattern: '.ms-core-pageTitle',
        confidence: 0.9,
        region: 'global',
      },
      {
        type: 'participant',
        pattern: '.ms-DocumentCard-details .ms-DocumentCard-title',
        confidence: 0.8,
        region: 'global',
      },
    ]);

    // SharePoint Government patterns
    this.patterns.set('sharepoint-mil.us', [
      {
        type: 'title',
        pattern: '.ms-core-pageTitle, .gov-page-title',
        confidence: 0.9,
        region: 'us-gov',
      },
      {
        type: 'security',
        pattern: '.gov-classification',
        confidence: 1.0,
        region: 'us-gov',
      },
    ]);

    // Teams patterns
    this.patterns.set('teams.microsoft.com', [
      {
        type: 'title',
        pattern: '[data-tid="meeting-title"], .ts-title',
        confidence: 0.95,
        region: 'global',
      },
      {
        type: 'participant',
        pattern: '[data-tid="participant"], .participant-name',
        confidence: 0.9,
        region: 'global',
      },
    ]);

    // European Teams patterns
    this.patterns.set('teams.microsoft.de', [
      {
        type: 'title',
        pattern: '[data-tid="meeting-title"], .ts-title, .de-meeting-title',
        confidence: 0.95,
        region: 'europe',
      },
      {
        type: 'localization',
        pattern: '.de-locale-indicator',
        confidence: 0.8,
        region: 'europe',
      },
    ]);
  }

  private buildAdapter(domain: string, tenantConfig: TenantConfiguration): AdapterInstance {
    return {
      domain,
      tenantConfig,

      adaptSelectors: (baseSelectors: string[]) => this.adaptSelectorsForDomain(baseSelectors, domain, tenantConfig),

      adaptUrl: (url: string, sourceDomain: string) => this.adaptUrlForDomain(url, sourceDomain, domain, tenantConfig),

      adaptApiCall: (endpoint: string, params: unknown) => this.adaptApiForDomain(endpoint, params, tenantConfig),

      adaptPermissions: (permissions: unknown) => this.adaptPermissionsForDomain(permissions, tenantConfig),
    };
  }

  private adaptSelectorsForDomain(
    baseSelectors: string[],
    domain: string,
    tenantConfig: TenantConfiguration,
  ): string[] {
    const adaptedSelectors = [...baseSelectors];

    // Add domain-specific selectors
    const domainPatterns = this.patterns.get(domain);
    if (domainPatterns) {
      for (const pattern of domainPatterns) {
        adaptedSelectors.push(pattern.pattern);
      }
    }

    // Add tenant-specific selectors
    if (tenantConfig.selectors) {
      adaptedSelectors.push(...tenantConfig.selectors.meetingTitle);
    }

    // Remove duplicates and sort by confidence (if available)
    return [...new Set(adaptedSelectors)];
  }

  private adaptUrlForDomain(
    url: string,
    sourceDomain: string,
    targetDomain: string,
    tenantConfig: TenantConfiguration,
  ): AdaptedUrl {
    try {
      const urlObj = new URL(url);
      const adaptedUrl = { ...urlObj };

      // Adapt hostname for cross-domain access
      if (sourceDomain !== targetDomain) {
        adaptedUrl.hostname = this.mapDomainHostname(urlObj.hostname, targetDomain);
      }

      // Apply tenant-specific URL transformations
      if (tenantConfig.environment === 'government') {
        adaptedUrl.hostname = this.adaptForGovernmentCloud(adaptedUrl.hostname);
      }

      // Add authentication parameters if required
      if (tenantConfig.security.requiresAuth) {
        adaptedUrl.searchParams.set('auth', 'required');
      }

      return {
        original: url,
        adapted: adaptedUrl.toString(),
        changes: this.detectUrlChanges(url, adaptedUrl.toString()),
        secure: adaptedUrl.protocol === 'https:',
        crossDomain: sourceDomain !== targetDomain,
      };
    } catch {
      return {
        original: url,
        adapted: url,
        changes: [],
        secure: false,
        crossDomain: false,
        error: 'URL adaptation failed',
      };
    }
  }

  private adaptApiForDomain(endpoint: string, params: unknown, tenantConfig: TenantConfiguration): ApiCallAdaptation {
    const adaptedEndpoint = this.adaptApiEndpoint(endpoint, tenantConfig);
    const adaptedParams = this.adaptApiParams(params, tenantConfig);
    const headers = this.buildApiHeaders(tenantConfig);

    return {
      endpoint: adaptedEndpoint,
      params: adaptedParams,
      headers,
      method: 'GET',
      timeout: 30000,
    };
  }

  private adaptPermissionsForDomain(permissions: unknown, tenantConfig: TenantConfiguration): unknown {
    const adapted = { ...(permissions as Record<string, unknown>) };

    // Apply tenant-specific permission restrictions
    if (tenantConfig.environment === 'government') {
      adapted.requiresClassification = true;
      adapted.auditRequired = true;
    }

    if (!tenantConfig.features.supportsDownload) {
      adapted.canDownload = false;
    }

    return adapted;
  }

  private detectDomainType(hostname: string): DomainType {
    if (hostname.includes('sharepoint')) return 'sharepoint';
    if (hostname.includes('teams.microsoft')) return 'teams';
    if (hostname.includes('stream')) return 'stream';
    if (hostname.includes('onedrive')) return 'onedrive';
    return 'unknown';
  }

  private detectRegion(hostname: string, document: Document): string {
    // Detect from hostname
    if (hostname.includes('.us')) return 'us';
    if (hostname.includes('.de')) return 'europe';
    if (hostname.includes('.gov')) return 'us-gov';
    if (hostname.includes('-mil.')) return 'us-mil';

    // Detect from page content
    const content = document.body.textContent || '';
    if (/classification|classified|secret/i.test(content)) return 'us-gov';

    return 'global';
  }

  private detectEnvironment(hostname: string, document: Document): string {
    void document;
    if (hostname.includes('gov') || hostname.includes('mil')) return 'government';
    if (hostname.includes('staging') || hostname.includes('test')) return 'staging';
    if (hostname.includes('dev')) return 'development';
    return 'production';
  }

  private extractTenantInfo(hostname: string, urlObj: URL): TenantInfo {
    // Extract tenant ID from various sources
    const subdomainMatch = hostname.match(/^([^.]+)\./);
    const tenantParam = urlObj.searchParams.get('tenantId');

    return {
      id: tenantParam || (subdomainMatch ? subdomainMatch[1] : null) || null,
      name: this.deriveTenantName(hostname),
      verified: this.isTenantVerified(hostname),
    };
  }

  private detectDomainFeatures(document: Document): DomainFeature[] {
    const features: DomainFeature[] = [];

    const featureDetectors = [
      { feature: 'recording', selector: '.recording-indicator, [data-recording]' },
      { feature: 'transcript', selector: '.transcript, .captions' },
      { feature: 'chat', selector: '.chat, .messages' },
      { feature: 'participants', selector: '.participant-list, .attendee-list' },
      { feature: 'agenda', selector: '.agenda, .meeting-agenda' },
      { feature: 'screenshare', selector: '.screen-share, .presentation-view' },
    ];

    for (const detector of featureDetectors) {
      if (document.querySelector(detector.selector)) {
        features.push({
          name: detector.feature,
          available: true,
          selector: detector.selector,
        });
      }
    }

    return features;
  }

  private detectCustomizations(document: Document): DomainCustomization[] {
    const customizations: DomainCustomization[] = [];

    // Detect theme/branding
    const themeElement = document.querySelector('[data-theme], .theme-');
    if (themeElement) {
      customizations.push({
        type: 'theme',
        value: themeElement.getAttribute('data-theme') || 'custom',
        selector: themeElement.tagName.toLowerCase(),
      });
    }

    // Detect language
    const langElement = document.documentElement;
    if (langElement.lang) {
      customizations.push({
        type: 'language',
        value: langElement.lang,
        selector: 'html[lang]',
      });
    }

    return customizations;
  }

  private detectSecuritySettings(document: Document): SecurityFeature[] {
    const features: SecurityFeature[] = [];

    // Check for CSP headers (would need to be passed in)
    // Check for security indicators in page
    const securityIndicators = [
      { type: 'classification', selector: '.classification, .security-level' },
      { type: 'auth_required', selector: '.auth-required, .login-required' },
      { type: 'encryption', selector: '.encrypted, .secure-indicator' },
    ];

    for (const indicator of securityIndicators) {
      if (document.querySelector(indicator.selector)) {
        features.push({
          type: indicator.type,
          enabled: true,
          selector: indicator.selector,
        });
      }
    }

    return features;
  }

  private createFailsafeDomainAnalysis(url: string): DomainAnalysis {
    return {
      hostname: new URL(url).hostname,
      type: 'unknown',
      region: 'global',
      environment: 'production',
      tenant: { id: null, name: 'Unknown', verified: false },
      features: [],
      customizations: [],
      security: [],
    };
  }

  private areDomainsCompatible(source: DomainAnalysis, target: DomainAnalysis): boolean {
    // Basic compatibility checks
    if (source.type !== target.type) return false;
    if (
      source.region !== target.region &&
      (source.environment === 'government' || target.environment === 'government')
    ) {
      return false;
    }
    return true;
  }

  private identifyCompatibilityIssues(source: DomainAnalysis, target: DomainAnalysis): string[] {
    const issues: string[] = [];

    if (source.type !== target.type) {
      issues.push(`Domain type mismatch: ${source.type} vs ${target.type}`);
    }

    if (source.region !== target.region) {
      issues.push(`Region mismatch: ${source.region} vs ${target.region}`);
    }

    if (source.environment !== target.environment) {
      issues.push(`Environment mismatch: ${source.environment} vs ${target.environment}`);
    }

    return issues;
  }

  private suggestAdaptations(source: DomainAnalysis, target: DomainAnalysis): string[] {
    const adaptations: string[] = [];

    if (source.region !== target.region) {
      adaptations.push('Use region-specific API endpoints');
    }

    if (source.environment === 'government' || target.environment === 'government') {
      adaptations.push('Apply government cloud security requirements');
    }

    return adaptations;
  }

  private validateSecurityCompatibility(
    source: DomainAnalysis,
    target: DomainAnalysis,
    tenantConfig: TenantConfiguration,
  ): SecurityCompatibility {
    return {
      compatible: true, // Simplified for now
      warnings: [],
      requirements: tenantConfig.security.allowedOrigins,
    };
  }

  // Helper methods

  private convertToExtractionPatterns(patterns: DomainPattern[]): ExtractionPattern[] {
    return patterns.map(pattern => ({
      type: pattern.type,
      selector: pattern.pattern,
      confidence: pattern.confidence,
      region: pattern.region,
    }));
  }

  private getDefaultExtractionPatterns(): ExtractionPattern[] {
    return [
      { type: 'title', selector: 'h1, .title', confidence: 0.5, region: 'global' },
      { type: 'participant', selector: '.participant, .attendee', confidence: 0.5, region: 'global' },
    ];
  }

  private mapDomainHostname(sourceHostname: string, targetDomain: string): string {
    // Simple domain mapping logic
    const subdomain = sourceHostname.split('.')[0];
    return `${subdomain}.${targetDomain}`;
  }

  private adaptForGovernmentCloud(hostname: string): string {
    return hostname.replace('.com', '.us').replace('sharepoint', 'sharepoint-mil');
  }

  private detectUrlChanges(original: string, adapted: string): string[] {
    const changes: string[] = [];

    try {
      const originalUrl = new URL(original);
      const adaptedUrl = new URL(adapted);

      if (originalUrl.hostname !== adaptedUrl.hostname) {
        changes.push(`hostname: ${originalUrl.hostname} → ${adaptedUrl.hostname}`);
      }

      if (originalUrl.protocol !== adaptedUrl.protocol) {
        changes.push(`protocol: ${originalUrl.protocol} → ${adaptedUrl.protocol}`);
      }
    } catch {
      changes.push('URL parsing failed');
    }

    return changes;
  }

  private adaptApiEndpoint(endpoint: string, tenantConfig: TenantConfiguration): string {
    // Use tenant-specific API endpoints
    if (endpoint.includes('graph.microsoft.com') && tenantConfig.apiEndpoints.graph) {
      return endpoint.replace('graph.microsoft.com', new URL(tenantConfig.apiEndpoints.graph).hostname);
    }

    return endpoint;
  }

  private adaptApiParams(params: unknown, tenantConfig: TenantConfiguration): unknown {
    const adapted = { ...(params as Record<string, unknown>) };

    // Add tenant-specific parameters
    if (tenantConfig.tenantId !== 'default') {
      adapted.tenantId = tenantConfig.tenantId;
    }

    return adapted;
  }

  private buildApiHeaders(tenantConfig: TenantConfiguration): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (tenantConfig.security.requireSSL) {
      headers['Strict-Transport-Security'] = 'max-age=31536000';
    }

    return headers;
  }

  private deriveTenantName(hostname: string): string {
    const subdomain = hostname.split('.')[0];
    if (!subdomain) return 'Unknown Tenant';
    return subdomain.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  private isTenantVerified(hostname: string): boolean {
    // Simple verification check
    return hostname.includes('microsoft.com') || hostname.includes('.gov') || hostname.includes('.mil');
  }
}

// Supporting interfaces and types

export interface AdapterInstance {
  domain: string;
  tenantConfig: TenantConfiguration;
  adaptSelectors: (baseSelectors: string[]) => string[];
  adaptUrl: (url: string, sourceDomain: string) => AdaptedUrl;
  adaptApiCall: (endpoint: string, params: unknown) => ApiCallAdaptation;
  adaptPermissions: (permissions: unknown) => unknown;
}

export interface DomainPattern {
  type: string;
  pattern: string;
  confidence: number;
  region: string;
}

export interface ExtractionPattern {
  type: string;
  selector: string;
  confidence: number;
  region: string;
}

export interface DomainAnalysis {
  hostname: string;
  type: DomainType;
  region: string;
  environment: string;
  tenant: TenantInfo;
  features: DomainFeature[];
  customizations: DomainCustomization[];
  security: SecurityFeature[];
}

export interface AdaptedUrl {
  original: string;
  adapted: string;
  changes: string[];
  secure: boolean;
  crossDomain: boolean;
  error?: string;
}

export interface ApiCallAdaptation {
  endpoint: string;
  params: unknown;
  headers: Record<string, string>;
  method: string;
  timeout: number;
}

export interface CompatibilityResult {
  compatible: boolean;
  issues: string[];
  adaptations: string[];
  security: SecurityCompatibility;
}

export interface TenantInfo {
  id: string | null;
  name: string;
  verified: boolean;
}

export interface DomainFeature {
  name: string;
  available: boolean;
  selector: string;
}

export interface DomainCustomization {
  type: string;
  value: string;
  selector: string;
}

export interface SecurityFeature {
  type: string;
  enabled: boolean;
  selector: string;
}

export interface SecurityCompatibility {
  compatible: boolean;
  warnings: string[];
  requirements: string[];
}

export type DomainType = 'sharepoint' | 'teams' | 'stream' | 'onedrive' | 'unknown';

// Create singleton instance
export const domainAdapter = new DomainAdapter();
