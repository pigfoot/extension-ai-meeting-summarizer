/**
 * Domain Detector
 * Identifies SharePoint domains and tenant configurations
 */

import type { MeetingPlatform } from '../types/index';
import type { TenantInfo, DomainConfig, SharePointConfig } from '../types/tenant';

/**
 * SharePoint domain detection and validation
 */
export class DomainDetector {
  private customDomains: DomainConfig[] = [];
  private tenantCache = new Map<string, TenantInfo>();
  private domainPatterns: RegExp[] = [];

  constructor(customDomains: DomainConfig[] = []) {
    this.customDomains = customDomains;
    this.initializeDomainPatterns();
  }

  /**
   * Detect SharePoint domain from URL
   */
  detectSharePointDomain(url: string): SharePointDomainInfo | null {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      // Check custom domains first
      const customDomain = this.checkCustomDomains(hostname);
      if (customDomain) {
        return {
          domain: hostname,
          platform: customDomain.platform,
          tenantId: customDomain.tenantId || null,
          isCustomDomain: true,
          confidence: 0.9,
          detectionMethod: 'custom_config',
        };
      }

      // Check standard SharePoint patterns
      const standardPattern = this.checkStandardPatterns(hostname);
      if (standardPattern) {
        return standardPattern;
      }

      // Check subdomain patterns
      const subdomainPattern = this.checkSubdomainPatterns(hostname);
      if (subdomainPattern) {
        return subdomainPattern;
      }

      return null;
    } catch (error) {
      console.error('Domain detection error:', error);
      return null;
    }
  }

  /**
   * Get tenant information for domain
   */
  async getTenantInfo(domain: string): Promise<TenantInfo | null> {
    // Check cache first
    if (this.tenantCache.has(domain)) {
      return this.tenantCache.get(domain) || null;
    }

    try {
      const tenantInfo = await this.fetchTenantInfo(domain);
      if (tenantInfo) {
        this.tenantCache.set(domain, tenantInfo);
      }
      return tenantInfo;
    } catch (error) {
      console.error('Failed to fetch tenant info:', error);
      return null;
    }
  }

  /**
   * Validate if domain supports meeting content
   */
  async validateMeetingSupport(domain: string): Promise<MeetingSupportInfo> {
    const tenantInfo = await this.getTenantInfo(domain);

    if (!tenantInfo) {
      return {
        supported: false,
        confidence: 0,
        features: [],
        limitations: ['Unknown tenant configuration'],
      };
    }

    const features = this.analyzeMeetingFeatures(tenantInfo);
    const limitations = this.analyzeLimitations(tenantInfo);

    return {
      supported: features.length > 0,
      confidence: this.calculateSupportConfidence(features, limitations),
      features,
      limitations,
    };
  }

  /**
   * Extract tenant ID from SharePoint URL
   */
  extractTenantId(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;

      // Try different extraction methods

      // Method 1: Extract from standard SharePoint Online URLs
      const onlineMatch = hostname.match(/^([^.]+)\.sharepoint\.com$/);
      if (onlineMatch && onlineMatch[1]) {
        return onlineMatch[1];
      }

      // Method 2: Extract from my sites URLs
      const mysitesMatch = hostname.match(/^([^.]+)-my\.sharepoint\.com$/);
      if (mysitesMatch && mysitesMatch[1]) {
        return mysitesMatch[1];
      }

      // Method 3: Extract from custom domains (if configured)
      const customDomain = this.customDomains.find(d => hostname.includes(d.domain.replace('*', '')));
      if (customDomain?.tenantId) {
        return customDomain.tenantId;
      }

      // Method 4: Try to extract from URL path
      const pathMatch = url.match(/\/sites\/([^/]+)/);
      if (pathMatch) {
        return pathMatch[1] || null;
      }

      return null;
    } catch (error) {
      console.error('Tenant ID extraction error:', error);
      return null;
    }
  }

  /**
   * Check if URL belongs to SharePoint Online
   */
  isSharePointOnline(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      return (
        hostname.endsWith('.sharepoint.com') ||
        hostname.includes('sharepoint.com') ||
        this.customDomains.some(d => this.matchesDomainPattern(hostname, d.domain))
      );
    } catch {
      return false;
    }
  }

  /**
   * Check if URL belongs to on-premises SharePoint
   */
  isSharePointOnPremises(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      // Check for common on-premises patterns
      const onPremPatterns = [/sharepoint/i, /sites/i, /teams/i, /_layouts/i];

      // Must not be SharePoint Online
      if (this.isSharePointOnline(url)) {
        return false;
      }

      // Check for SharePoint indicators in URL path or hostname
      return onPremPatterns.some(pattern => pattern.test(hostname) || pattern.test(urlObj.pathname));
    } catch {
      return false;
    }
  }

  /**
   * Get SharePoint version information
   */
  async getSharePointVersion(url: string): Promise<SharePointVersionInfo> {
    try {
      if (this.isSharePointOnline(url)) {
        return {
          version: 'SharePoint Online',
          build: 'Unknown',
          features: ['Modern Experience', 'Teams Integration', 'Stream Integration'],
          supportLevel: 'full',
        };
      }

      // For on-premises, we'd need to make requests to detect version
      // This is a simplified version
      return {
        version: 'SharePoint On-Premises',
        build: 'Unknown',
        features: ['Classic Experience'],
        supportLevel: 'limited',
      };
    } catch (error) {
      console.error('Version detection error:', error);
      return {
        version: 'Unknown',
        build: 'Unknown',
        features: [],
        supportLevel: 'none',
      };
    }
  }

  // Private methods

  private initializeDomainPatterns(): void {
    // Standard SharePoint Online patterns
    this.domainPatterns = [
      /^[^.]+\.sharepoint\.com$/,
      /^[^.]+\.onmicrosoft\.com$/,
      /^[^.]+\.microsoftstream\.com$/,
      // Add more patterns as needed
    ];
  }

  private checkCustomDomains(hostname: string): DomainConfig | null {
    return this.customDomains.find(domain => this.matchesDomainPattern(hostname, domain.domain)) || null;
  }

  private checkStandardPatterns(hostname: string): SharePointDomainInfo | null {
    // SharePoint Online patterns
    if (hostname.endsWith('.sharepoint.com')) {
      const tenantMatch = hostname.match(/^([^.]+)\.sharepoint\.com$/);
      if (tenantMatch) {
        return {
          domain: hostname,
          platform: 'sharepoint' as MeetingPlatform,
          tenantId: tenantMatch[1] || null,
          isCustomDomain: false,
          confidence: 0.95,
          detectionMethod: 'standard_pattern',
        };
      }
    }

    // Teams URLs
    if (hostname.includes('teams.microsoft.com')) {
      return {
        domain: hostname,
        platform: 'teams' as MeetingPlatform,
        tenantId: null,
        isCustomDomain: false,
        confidence: 0.9,
        detectionMethod: 'teams_pattern',
      };
    }

    return null;
  }

  private checkSubdomainPatterns(hostname: string): SharePointDomainInfo | null {
    // Check for SharePoint subdomains
    const subdomainPatterns = [
      { pattern: /^([^.]+)-my\.sharepoint\.com$/, type: 'mysite' },
      { pattern: /^([^.]+)-admin\.sharepoint\.com$/, type: 'admin' },
      { pattern: /^([^.]+)\.onmicrosoft\.com$/, type: 'tenant' },
    ];

    for (const { pattern, type } of subdomainPatterns) {
      const match = hostname.match(pattern);
      if (match) {
        return {
          domain: hostname,
          platform: 'sharepoint' as MeetingPlatform,
          tenantId: match[1] || null,
          isCustomDomain: false,
          confidence: 0.8,
          detectionMethod: `subdomain_${type}`,
        };
      }
    }

    return null;
  }

  private matchesDomainPattern(hostname: string, pattern: string): boolean {
    // Convert wildcard pattern to regex
    const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*');

    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(hostname);
  }

  private async fetchTenantInfo(domain: string): Promise<TenantInfo | null> {
    // In a real implementation, this would make API calls to get tenant info
    // For now, return a mock based on domain analysis

    const tenantId = this.extractTenantId(`https://${domain}`);
    if (!tenantId) {
      return null;
    }

    return {
      tenantId,
      name: `${tenantId} Tenant`,
      primaryDomain: domain,
      additionalDomains: [],
      sharePointConfig: {} as SharePointConfig,
      teamsConfig: {} as unknown,
      region: 'north_america' as unknown,
      type: 'corporate' as unknown,
      lastUpdated: new Date(),
    };
  }

  private analyzeMeetingFeatures(tenantInfo: TenantInfo): string[] {
    const features: string[] = [];

    // Basic SharePoint features
    features.push('Document Library Access');

    // Check for Teams integration
    if (tenantInfo.teamsConfig) {
      features.push('Teams Integration');
    }

    // Check for Stream integration
    if (tenantInfo.sharePointConfig?.features?.streamIntegration) {
      features.push('Stream Integration');
    }

    return features;
  }

  private analyzeLimitations(tenantInfo: TenantInfo): string[] {
    const limitations: string[] = [];

    // Check for security restrictions
    if (tenantInfo.sharePointConfig?.security?.externalSharing?.enabled === false) {
      limitations.push('External sharing disabled');
    }

    return limitations;
  }

  private calculateSupportConfidence(features: string[], limitations: string[]): number {
    const baseScore = features.length * 0.3;
    const penaltyScore = limitations.length * 0.1;
    return Math.max(0, Math.min(1, baseScore - penaltyScore));
  }
}

// Supporting interfaces

export interface SharePointDomainInfo {
  domain: string;
  platform: MeetingPlatform;
  tenantId: string | null;
  isCustomDomain: boolean;
  confidence: number;
  detectionMethod: string;
}

export interface MeetingSupportInfo {
  supported: boolean;
  confidence: number;
  features: string[];
  limitations: string[];
}

export interface SharePointVersionInfo {
  version: string;
  build: string;
  features: string[];
  supportLevel: 'full' | 'limited' | 'none';
}

// Create singleton instance
export const domainDetector = new DomainDetector();
