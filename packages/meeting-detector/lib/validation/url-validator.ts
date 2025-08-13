/**
 * URL Validator
 * Validates media URLs for accessibility, format, and security
 */

import type { MediaFormat, UrlAccessibility } from '../types/index';

/**
 * Media URL validation and security checking
 */
export class UrlValidator {
  private validationCache = new Map<string, CachedValidation>();
  private domainWhitelist: Set<string> = new Set();
  private domainBlacklist: Set<string> = new Set();
  private securityPatterns: RegExp[] = [];

  constructor() {
    this.initializeDomainLists();
    this.initializeSecurityPatterns();
  }

  /**
   * Validate media URL for accessibility and format
   */
  async validateMediaUrl(url: string): Promise<UrlValidationResult> {
    const result: UrlValidationResult = {
      url,
      isValid: false,
      isAccessible: false,
      accessibility: 'unknown',
      format: 'unknown',
      securityCheck: 'unknown',
      errors: [],
      warnings: [],
      metadata: {},
    };

    try {
      // Check cache first
      const cached = this.getCachedValidation(url);
      if (cached) {
        return cached;
      }

      // Basic URL validation
      const urlValidation = this.validateUrlStructure(url);
      Object.assign(result, urlValidation);

      if (!result.isValid) {
        return this.cacheAndReturn(result);
      }

      // Security validation
      const securityCheck = this.performSecurityCheck(url);
      result.securityCheck = securityCheck.status;
      result.warnings.push(...securityCheck.warnings);
      result.errors.push(...securityCheck.errors);

      if (securityCheck.status === 'blocked') {
        result.accessibility = 'permission_denied';
        return this.cacheAndReturn(result);
      }

      // Format validation
      result.format = this.validateMediaFormat(url);

      // Accessibility check
      const accessibilityCheck = await this.checkUrlAccessibility(url);
      result.isAccessible = accessibilityCheck.accessible;
      result.accessibility = accessibilityCheck.accessibility;
      result.metadata = accessibilityCheck.metadata;

      if (accessibilityCheck.errors.length > 0) {
        result.errors.push(...accessibilityCheck.errors);
      }
    } catch (error) {
      result.errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return this.cacheAndReturn(result);
  }

  /**
   * Batch validate multiple URLs
   */
  async validateMultipleUrls(urls: string[]): Promise<UrlValidationResult[]> {
    const results: UrlValidationResult[] = [];

    // Process in batches to avoid overwhelming the network
    const batchSize = 5;
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      const batchPromises = batch.map(url => this.validateMediaUrl(url));

      try {
        const batchResults = await Promise.allSettled(batchPromises);

        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            results.push({
              url: batch[results.length % batch.length] || 'unknown', // Approximate URL for failed validation
              isValid: false,
              isAccessible: false,
              accessibility: 'unknown',
              format: 'unknown',
              securityCheck: 'unknown',
              errors: [`Validation failed: ${result.reason}`],
              warnings: [],
              metadata: {},
            });
          }
        }

        // Add delay between batches to be respectful
        if (i + batchSize < urls.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error('Batch validation error:', error);
      }
    }

    return results;
  }

  /**
   * Check if URL is from trusted domain
   */
  isDomainTrusted(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.toLowerCase();

      // Check whitelist first
      if (this.domainWhitelist.size > 0) {
        return Array.from(this.domainWhitelist).some(trusted => domain === trusted || domain.endsWith(`.${trusted}`));
      }

      // Check blacklist
      return !Array.from(this.domainBlacklist).some(blocked => domain === blocked || domain.endsWith(`.${blocked}`));
    } catch {
      return false;
    }
  }

  /**
   * Add domain to whitelist
   */
  addTrustedDomain(domain: string): void {
    this.domainWhitelist.add(domain.toLowerCase());
  }

  /**
   * Add domain to blacklist
   */
  addBlockedDomain(domain: string): void {
    this.domainBlacklist.add(domain.toLowerCase());
  }

  /**
   * Clear validation cache
   */
  clearCache(): void {
    this.validationCache.clear();
  }

  /**
   * Get validation statistics
   */
  getValidationStats(): ValidationStats {
    const cached = Array.from(this.validationCache.values());

    return {
      totalValidated: cached.length,
      validUrls: cached.filter(v => v.result.isValid).length,
      accessibleUrls: cached.filter(v => v.result.isAccessible).length,
      secureUrls: cached.filter(v => v.result.securityCheck === 'passed').length,
      cacheHitRatio: cached.length > 0 ? cached.filter(v => v.cacheHit).length / cached.length : 0,
    };
  }

  // Private methods

  private initializeDomainLists(): void {
    // Trusted domains for meeting content
    const trustedDomains = [
      'microsoftstream.com',
      'sharepoint.com',
      'onedrive.live.com',
      'teams.microsoft.com',
      'office.com',
      'microsoft.com',
    ];

    trustedDomains.forEach(domain => this.addTrustedDomain(domain));

    // Blocked domains (example of potentially malicious domains)
    const blockedDomains = ['example-malicious.com', 'suspicious-site.net'];

    blockedDomains.forEach(domain => this.addBlockedDomain(domain));
  }

  private initializeSecurityPatterns(): void {
    this.securityPatterns = [
      // Suspicious URL patterns
      /[<>'"]/, // HTML injection attempts
      /javascript:/i, // JavaScript protocols
      /data:/i, // Data URLs (can be suspicious)
      /file:/i, // File protocols
      /ftp:/i, // FTP protocols

      // Suspicious query parameters
      /[?&]exec=/i, // Execution parameters
      /[?&]cmd=/i, // Command parameters
      /[?&]eval=/i, // Eval parameters

      // Suspicious file extensions in URLs
      /\.(exe|bat|cmd|scr|vbs|js)(?|$)/i,
    ];
  }

  private validateUrlStructure(url: string): Partial<UrlValidationResult> {
    const result: Partial<UrlValidationResult> = {
      isValid: false,
      errors: [],
      warnings: [],
    };

    try {
      const urlObj = new URL(url);

      // Check protocol
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        result.errors!.push(`Unsupported protocol: ${urlObj.protocol}`);
        return result;
      }

      // Check for suspicious characters
      if (this.containsSuspiciousCharacters(url)) {
        result.errors!.push('URL contains suspicious characters');
        return result;
      }

      // Check URL length (extremely long URLs can be suspicious)
      if (url.length > 2048) {
        result.warnings!.push('URL is unusually long');
      }

      // Check hostname validity
      if (!this.isValidHostname(urlObj.hostname)) {
        result.errors!.push('Invalid hostname');
        return result;
      }

      result.isValid = true;
    } catch (error) {
      result.errors!.push(`Invalid URL format: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  private performSecurityCheck(url: string): SecurityCheckResult {
    const result: SecurityCheckResult = {
      status: 'unknown',
      warnings: [],
      errors: [],
    };

    try {
      // Check against security patterns
      for (const pattern of this.securityPatterns) {
        if (pattern.test(url)) {
          result.status = 'blocked';
          result.errors.push(`URL matches suspicious pattern: ${pattern.source}`);
          return result;
        }
      }

      // Check domain trust
      if (!this.isDomainTrusted(url)) {
        result.status = 'warning';
        result.warnings.push('URL is from untrusted domain');
      } else {
        result.status = 'passed';
      }

      // Check for HTTPS
      const urlObj = new URL(url);
      if (urlObj.protocol !== 'https:') {
        result.warnings.push('URL does not use HTTPS');
        if (result.status === 'passed') {
          result.status = 'warning';
        }
      }
    } catch (error) {
      result.status = 'error';
      result.errors.push(`Security check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  private validateMediaFormat(url: string): MediaFormat {
    const urlLower = url.toLowerCase();

    // Check file extensions
    if (urlLower.includes('.mp4')) return 'mp4';
    if (urlLower.includes('.mp3')) return 'mp3';
    if (urlLower.includes('.wav')) return 'wav';
    if (urlLower.includes('.m4a')) return 'm4a';
    if (urlLower.includes('.webm')) return 'webm';
    if (urlLower.includes('.m3u8')) return 'hls';
    if (urlLower.includes('.mpd')) return 'dash';

    // Check domain-specific patterns
    if (urlLower.includes('microsoftstream.com')) return 'mp4';
    if (urlLower.includes('sharepoint.com') && urlLower.includes('recording')) return 'mp4';

    return 'unknown';
  }

  private async checkUrlAccessibility(url: string): Promise<AccessibilityCheckResult> {
    const result: AccessibilityCheckResult = {
      accessible: false,
      accessibility: 'unknown',
      metadata: {},
      errors: [],
    };

    try {
      // Attempt HEAD request to check accessibility
      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'no-cors', // Avoid CORS issues for basic checks
        cache: 'no-cache',
      });

      if (response.ok) {
        result.accessible = true;
        result.accessibility = 'accessible';

        // Extract metadata from headers
        result.metadata = {
          contentType: response.headers.get('content-type'),
          contentLength: response.headers.get('content-length'),
          lastModified: response.headers.get('last-modified'),
          etag: response.headers.get('etag'),
          cacheControl: response.headers.get('cache-control'),
        };
      } else if (response.status === 401 || response.status === 403) {
        result.accessibility = 'authentication_required';
        result.errors.push(`Authentication required (HTTP ${response.status})`);
      } else if (response.status === 404) {
        result.accessibility = 'not_found';
        result.errors.push('Resource not found (HTTP 404)');
      } else {
        result.accessibility = 'unknown';
        result.errors.push(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('CORS')) {
        result.accessibility = 'unknown';
        result.errors.push('CORS policy prevents access check');
      } else if (error instanceof TypeError && error.message.includes('network')) {
        result.accessibility = 'not_found';
        result.errors.push('Network error - resource may not exist');
      } else {
        result.accessibility = 'unknown';
        result.errors.push(`Access check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return result;
  }

  private containsSuspiciousCharacters(url: string): boolean {
    // Check for characters that might indicate injection attempts
    const suspiciousChars = /<|>|"|'|`|\$\{|\$\(/;
    return suspiciousChars.test(url);
  }

  private isValidHostname(hostname: string): boolean {
    // Basic hostname validation
    if (!hostname || hostname.length === 0) return false;
    if (hostname.length > 253) return false;

    // Check for valid characters
    const hostnameRegex = /^[a-zA-Z0-9.-]+$/;
    if (!hostnameRegex.test(hostname)) return false;

    // Check for valid structure
    const parts = hostname.split('.');
    for (const part of parts) {
      if (part.length === 0 || part.length > 63) return false;
      if (part.startsWith('-') || part.endsWith('-')) return false;
    }

    return true;
  }

  private getCachedValidation(url: string): UrlValidationResult | null {
    const cached = this.validationCache.get(url);

    if (cached) {
      // Check if cache is still valid (5 minutes)
      const maxAge = 5 * 60 * 1000;
      if (Date.now() - cached.timestamp < maxAge) {
        cached.cacheHit = true;
        return cached.result;
      } else {
        this.validationCache.delete(url);
      }
    }

    return null;
  }

  private cacheAndReturn(result: UrlValidationResult): UrlValidationResult {
    this.validationCache.set(result.url, {
      result,
      timestamp: Date.now(),
      cacheHit: false,
    });

    return result;
  }
}

// Supporting interfaces

export interface UrlValidationResult {
  url: string;
  isValid: boolean;
  isAccessible: boolean;
  accessibility: UrlAccessibility;
  format: MediaFormat;
  securityCheck: SecurityStatus;
  errors: string[];
  warnings: string[];
  metadata: Record<string, unknown>;
}

interface SecurityCheckResult {
  status: SecurityStatus;
  warnings: string[];
  errors: string[];
}

interface AccessibilityCheckResult {
  accessible: boolean;
  accessibility: UrlAccessibility;
  metadata: Record<string, unknown>;
  errors: string[];
}

interface CachedValidation {
  result: UrlValidationResult;
  timestamp: number;
  cacheHit: boolean;
}

export interface ValidationStats {
  totalValidated: number;
  validUrls: number;
  accessibleUrls: number;
  secureUrls: number;
  cacheHitRatio: number;
}

export type SecurityStatus = 'passed' | 'warning' | 'blocked' | 'error' | 'unknown';

// Create singleton instance
export const urlValidator = new UrlValidator();
