/**
 * Permission Checker
 * Implements access permission validation and graceful handling of access restrictions
 */

import { urlValidator } from './url-validator';
import type { RecordingPermissions, AuthTokenInfo, UrlAccessibility } from '../types/index';
import type { TenantInfo, SecurityConfig } from '../types/tenant';

/**
 * Permission validation and access control for meeting content
 */
export class PermissionChecker {
  private permissionCache: Map<string, CachedPermissionResult> = new Map();
  private accessAttempts: Map<string, AccessAttemptLog> = new Map();
  private securityPolicies: Map<string, SecurityPolicy> = new Map();

  constructor() {
    this.initializeDefaultSecurityPolicies();
  }

  /**
   * Check user access permissions for meeting content
   */
  async checkMeetingAccess(
    url: string,
    tenantInfo?: TenantInfo,
    authTokens?: AuthTokenInfo[],
  ): Promise<PermissionCheckResult> {
    const cacheKey = this.generateCacheKey(url, authTokens);

    // Check cache first
    const cached = this.permissionCache.get(cacheKey);
    if (cached && !this.isCacheExpired(cached)) {
      return cached.result;
    }

    // Perform permission check
    const result = await this.performPermissionCheck(url, tenantInfo, authTokens);

    // Cache result
    this.permissionCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
      ttl: this.getTtlForResult(result),
    });

    // Log access attempt
    this.logAccessAttempt(url, result);

    return result;
  }

  /**
   * Validate recording permissions
   */
  async validateRecordingPermissions(
    url: string,
    tenantInfo?: TenantInfo,
    authTokens?: AuthTokenInfo[],
  ): Promise<RecordingPermissions> {
    const accessCheck = await this.checkMeetingAccess(url, tenantInfo, authTokens);

    if (!accessCheck.hasAccess) {
      return {
        canAccess: false,
        canDownload: false,
        canShare: false,
        restrictions: accessCheck.restrictions.map(r => r.description),
        expiresAt: accessCheck.expiresAt,
      };
    }

    // Check specific recording permissions
    const recordingPermissions = await this.checkRecordingSpecificPermissions(url, tenantInfo, authTokens);

    return {
      canAccess: true,
      canDownload: recordingPermissions.canDownload,
      canShare: recordingPermissions.canShare,
      restrictions: recordingPermissions.restrictions,
      expiresAt: recordingPermissions.expiresAt,
    };
  }

  /**
   * Check URL accessibility with authentication
   */
  async checkUrlAccessibility(url: string, authTokens?: AuthTokenInfo[]): Promise<UrlAccessibilityResult> {
    try {
      // First validate URL format
      const urlValidations = await urlValidator.validateMultipleUrls([url]);
      const urlValidation = urlValidations[0];
      if (!urlValidation?.isValid) {
        return {
          accessibility: 'not_found',
          canAccess: false,
          statusCode: 400,
          error: urlValidation?.errors?.[0] || 'URL validation failed',
        };
      }

      // Attempt to access the URL
      const accessResult = await this.attemptUrlAccess(url, authTokens);

      return {
        accessibility: this.mapStatusToAccessibility(accessResult.statusCode),
        canAccess: accessResult.statusCode >= 200 && accessResult.statusCode < 300,
        statusCode: accessResult.statusCode,
        headers: accessResult.headers,
        requiresAuth: accessResult.requiresAuth,
        authMethods: accessResult.supportedAuthMethods,
      };
    } catch (error) {
      return {
        accessibility: 'unknown',
        canAccess: false,
        statusCode: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle access restriction gracefully
   */
  async handleAccessRestriction(
    restriction: AccessRestriction,
    context: AccessContext,
  ): Promise<RestrictionHandlingResult> {
    void this.getSecurityPolicy(context.tenantId);

    switch (restriction.type) {
      case 'authentication_required':
        return this.handleAuthenticationRequired();

      case 'permission_denied':
        return this.handlePermissionDenied();

      case 'content_expired':
        return this.handleContentExpired();

      case 'geographic_restriction':
        return this.handleGeographicRestriction();

      case 'license_restriction':
        return this.handleLicenseRestriction();

      default:
        return this.handleUnknownRestriction();
    }
  }

  /**
   * Generate access suggestions for restricted content
   */
  generateAccessSuggestions(restrictions: AccessRestriction[]): AccessSuggestion[] {
    const suggestions: AccessSuggestion[] = [];

    for (const restriction of restrictions) {
      switch (restriction.type) {
        case 'authentication_required':
          suggestions.push({
            type: 'authentication',
            title: 'Authentication Required',
            description: 'Please sign in to access this content',
            action: 'login',
            priority: 'high',
            estimatedTime: '1-2 minutes',
          });
          break;

        case 'permission_denied':
          suggestions.push({
            type: 'permission',
            title: 'Request Access',
            description: 'Contact the meeting organizer for access',
            action: 'contact_organizer',
            priority: 'medium',
            estimatedTime: '24-48 hours',
          });
          break;

        case 'content_expired':
          suggestions.push({
            type: 'content',
            title: 'Content Expired',
            description: 'This recording is no longer available',
            action: 'check_alternative',
            priority: 'low',
            estimatedTime: 'N/A',
          });
          break;

        case 'geographic_restriction':
          suggestions.push({
            type: 'location',
            title: 'Geographic Restriction',
            description: 'Access limited by location policy',
            action: 'check_vpn_policy',
            priority: 'medium',
            estimatedTime: 'Variable',
          });
          break;

        case 'license_restriction':
          suggestions.push({
            type: 'license',
            title: 'License Required',
            description: 'Upgrade license to access premium features',
            action: 'upgrade_license',
            priority: 'medium',
            estimatedTime: '5-10 minutes',
          });
          break;
      }
    }

    return suggestions.sort((a, b) => this.comparePriority(a.priority, b.priority));
  }

  /**
   * Validate security compliance
   */
  async validateSecurityCompliance(
    url: string,
    tenantInfo: TenantInfo,
    authTokens?: AuthTokenInfo[],
  ): Promise<SecurityComplianceResult> {
    const violations: SecurityViolation[] = [];
    const warnings: string[] = [];

    // Check SSL/TLS requirements
    if (!url.startsWith('https://')) {
      violations.push({
        type: 'transport_security',
        severity: 'high',
        description: 'Non-HTTPS URLs are not allowed',
        recommendation: 'Use HTTPS URLs only',
      });
    }

    // Check domain whitelist
    const domainCheck = await this.validateDomainWhitelist(url, tenantInfo.sharePointConfig.security);
    if (!domainCheck.isAllowed) {
      violations.push({
        type: 'domain_restriction',
        severity: 'high',
        description: 'Domain not in allowed list',
        recommendation: 'Contact administrator to whitelist domain',
      });
    }

    // Check token security
    if (authTokens) {
      const tokenValidation = this.validateTokenSecurity(authTokens);
      violations.push(...tokenValidation.violations);
      warnings.push(...tokenValidation.warnings);
    }

    // Check IP restrictions
    const ipCheck = await this.validateIpRestrictions(tenantInfo.sharePointConfig.security);
    if (!ipCheck.isAllowed) {
      violations.push({
        type: 'ip_restriction',
        severity: 'medium',
        description: 'Access not allowed from current IP',
        recommendation: 'Access from approved IP range',
      });
    }

    return {
      isCompliant: violations.length === 0,
      violations,
      warnings,
      riskLevel: this.calculateRiskLevel(violations),
      recommendations: violations.map(v => v.recommendation),
    };
  }

  /**
   * Get access logs for audit purposes
   */
  getAccessLogs(filters?: AccessLogFilters): AccessLogEntry[] {
    const logs: AccessLogEntry[] = [];

    for (const [url, attemptLog] of this.accessAttempts) {
      for (const attempt of attemptLog.attempts) {
        if (this.matchesFilters(attempt, filters)) {
          logs.push({
            url,
            timestamp: attempt.timestamp,
            result: attempt.result,
            userAgent: attempt.userAgent,
            ipAddress: attempt.ipAddress,
            authMethod: attempt.authMethod,
          });
        }
      }
    }

    return logs.sort((a, b) => b.timestamp - a.timestamp);
  }

  // Private methods

  private async performPermissionCheck(
    url: string,
    tenantInfo?: TenantInfo,
    authTokens?: AuthTokenInfo[],
  ): Promise<PermissionCheckResult> {
    const restrictions: AccessRestriction[] = [];
    let hasAccess = true;
    let expiresAt: Date | undefined;

    try {
      // Check URL accessibility
      const accessibilityResult = await this.checkUrlAccessibility(url, authTokens);

      if (!accessibilityResult.canAccess) {
        hasAccess = false;

        switch (accessibilityResult.accessibility) {
          case 'authentication_required':
            restrictions.push({
              type: 'authentication_required',
              description: 'Authentication is required to access this content',
              severity: 'medium',
            });
            break;

          case 'permission_denied':
            restrictions.push({
              type: 'permission_denied',
              description: 'You do not have permission to access this content',
              severity: 'high',
            });
            break;

          case 'not_found':
            restrictions.push({
              type: 'content_not_found',
              description: 'The requested content was not found',
              severity: 'high',
            });
            break;
        }
      }

      // Check tenant-specific restrictions
      if (tenantInfo) {
        const tenantRestrictions = await this.checkTenantRestrictions(url, tenantInfo);
        restrictions.push(...tenantRestrictions);

        if (tenantRestrictions.some(r => r.severity === 'high')) {
          hasAccess = false;
        }
      }

      // Check token expiration
      if (authTokens) {
        const tokenExpiration = this.checkTokenExpiration(authTokens);
        if (tokenExpiration.hasExpiredTokens) {
          hasAccess = false;
          restrictions.push({
            type: 'authentication_required',
            description: 'Authentication tokens have expired',
            severity: 'medium',
          });
        }
        expiresAt = tokenExpiration.earliestExpiration;
      }
    } catch (error) {
      hasAccess = false;
      restrictions.push({
        type: 'unknown_error',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        severity: 'high',
      });
    }

    return {
      hasAccess,
      restrictions,
      expiresAt,
      lastChecked: new Date(),
      checkMethod: 'comprehensive',
    };
  }

  private async attemptUrlAccess(url: string, authTokens?: AuthTokenInfo[]): Promise<UrlAccessAttemptResult> {
    // This would make an actual HTTP request in a real implementation
    // For now, we'll simulate the behavior

    try {
      const urlObj = new URL(url);

      // Simulate different responses based on URL patterns
      if (urlObj.hostname.includes('sharepoint') || urlObj.hostname.includes('teams')) {
        if (!authTokens || authTokens.length === 0) {
          return {
            statusCode: 401,
            requiresAuth: true,
            supportedAuthMethods: ['bearer', 'cookie'],
            headers: { 'www-authenticate': 'Bearer' },
          };
        }

        // Check if tokens are valid (simplified)
        const hasValidToken = authTokens.some(token => token.type === 'bearer' && token.value.length > 0);

        if (hasValidToken) {
          return {
            statusCode: 200,
            requiresAuth: true,
            supportedAuthMethods: ['bearer'],
            headers: { 'content-type': 'application/json' },
          };
        } else {
          return {
            statusCode: 403,
            requiresAuth: true,
            supportedAuthMethods: ['bearer'],
            headers: { 'www-authenticate': 'Bearer' },
          };
        }
      }

      // Default response for other URLs
      return {
        statusCode: 200,
        requiresAuth: false,
        supportedAuthMethods: [],
        headers: { 'content-type': 'text/html' },
      };
    } catch {
      return {
        statusCode: 400,
        requiresAuth: false,
        supportedAuthMethods: [],
        headers: {},
      };
    }
  }

  private mapStatusToAccessibility(statusCode: number): UrlAccessibility {
    if (statusCode >= 200 && statusCode < 300) {
      return 'accessible';
    } else if (statusCode === 401) {
      return 'authentication_required';
    } else if (statusCode === 403) {
      return 'permission_denied';
    } else if (statusCode === 404) {
      return 'not_found';
    } else {
      return 'unknown';
    }
  }

  private async checkRecordingSpecificPermissions(
    url: string,
    tenantInfo?: TenantInfo,
    authTokens?: AuthTokenInfo[],
  ): Promise<RecordingSpecificPermissions> {
    // Check download permissions
    const canDownload = await this.checkDownloadPermission(url, tenantInfo);

    // Check sharing permissions
    const canShare = await this.checkSharingPermission(url, tenantInfo);

    // Check any specific restrictions
    const restrictions = await this.getRecordingRestrictions(url, tenantInfo);

    // Calculate expiration
    const expiresAt = this.calculateRecordingExpiration(url, tenantInfo, authTokens);

    const result: RecordingSpecificPermissions = {
      canDownload,
      canShare,
      restrictions,
    };
    if (expiresAt !== undefined) {
      result.expiresAt = expiresAt;
    }
    return result;
  }

  private async checkDownloadPermission(url: string, tenantInfo?: TenantInfo): Promise<boolean> {
    // Check if downloads are allowed by tenant policy
    if (tenantInfo?.sharePointConfig.features.meetingRecording === false) {
      return false;
    }

    // Check if user has download permissions
    // This would integrate with actual permission APIs
    return true; // Simplified for demo
  }

  private async checkSharingPermission(url: string, tenantInfo?: TenantInfo): Promise<boolean> {
    // Check tenant sharing policies
    if (tenantInfo?.sharePointConfig.security.externalSharing.enabled === false) {
      return false;
    }

    // Check user-specific sharing permissions
    return true; // Simplified for demo
  }

  private async getRecordingRestrictions(url: string, tenantInfo?: TenantInfo): Promise<string[]> {
    const restrictions: string[] = [];

    if (tenantInfo?.sharePointConfig.security.externalSharing.enabled === false) {
      restrictions.push('External sharing disabled');
    }

    // Check for additional restrictions
    // This would integrate with tenant policies

    return restrictions;
  }

  private calculateRecordingExpiration(
    url: string,
    tenantInfo?: TenantInfo,
    authTokens?: AuthTokenInfo[],
  ): Date | undefined {
    // Find earliest token expiration
    if (authTokens) {
      const tokenExpirations = authTokens.map(token => token.expiresAt).filter(date => date !== undefined) as Date[];

      if (tokenExpirations.length > 0) {
        return new Date(Math.min(...tokenExpirations.map(d => d.getTime())));
      }
    }

    // Check for content-specific expiration policies
    // This would integrate with content management policies

    return undefined;
  }

  private async checkTenantRestrictions(url: string, tenantInfo: TenantInfo): Promise<AccessRestriction[]> {
    const restrictions: AccessRestriction[] = [];

    // Check IP restrictions
    if (tenantInfo.sharePointConfig.security.conditionalAccess) {
      // Simplified IP check
      restrictions.push({
        type: 'ip_restriction',
        description: 'Access restricted by IP policy',
        severity: 'medium',
      });
    }

    return restrictions;
  }

  private checkTokenExpiration(authTokens: AuthTokenInfo[]): TokenExpirationResult {
    const expiredTokens = authTokens.filter(token => token.expiresAt && token.expiresAt < new Date());

    const validExpirations = authTokens
      .map(token => token.expiresAt)
      .filter(date => date && date > new Date()) as Date[];

    const result: TokenExpirationResult = {
      hasExpiredTokens: expiredTokens.length > 0,
      expiredCount: expiredTokens.length,
    };

    if (validExpirations.length > 0) {
      result.earliestExpiration = new Date(Math.min(...validExpirations.map(d => d.getTime())));
    }

    return result;
  }

  private initializeDefaultSecurityPolicies(): void {
    this.securityPolicies.set('default', {
      allowedDomains: ['*.sharepoint.com', '*.microsoftonline.com', 'teams.microsoft.com'],
      blockedDomains: [],
      requireHttps: true,
      maxTokenAge: 24 * 60 * 60 * 1000, // 24 hours
      allowCrossDomain: false,
      ipWhitelist: [],
      maxAccessAttempts: 5,
      lockoutDuration: 15 * 60 * 1000, // 15 minutes
    });
  }

  private getSecurityPolicy(tenantId?: string): SecurityPolicy {
    return this.securityPolicies.get(tenantId || 'default') || this.securityPolicies.get('default')!;
  }

  private async validateDomainWhitelist(url: string, securityConfig: SecurityConfig): Promise<{ isAllowed: boolean }> {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      // Check against allowed origins
      if (securityConfig.allowedOrigins && securityConfig.allowedOrigins.length > 0) {
        const isAllowed = securityConfig.allowedOrigins.some((origin: string) => {
          if (origin.includes('*')) {
            const pattern = origin.replace(/\*/g, '.*');
            return new RegExp(pattern).test(hostname);
          }
          return hostname === origin || hostname.endsWith('.' + origin);
        });

        return { isAllowed };
      }

      // If no specific allowed origins, default to allowed
      return { isAllowed: true };
    } catch {
      return { isAllowed: false };
    }
  }

  private validateTokenSecurity(authTokens: AuthTokenInfo[]): {
    violations: SecurityViolation[];
    warnings: string[];
  } {
    const violations: SecurityViolation[] = [];
    const warnings: string[] = [];

    for (const token of authTokens) {
      // Check token age
      if (token.expiresAt && token.expiresAt < new Date()) {
        violations.push({
          type: 'token_expired',
          severity: 'high',
          description: 'Authentication token has expired',
          recommendation: 'Refresh authentication token',
        });
      }

      // Check token strength (simplified)
      if (token.value.length < 32) {
        warnings.push('Short authentication token detected');
      }
    }

    return { violations, warnings };
  }

  private async validateIpRestrictions(securityConfig: SecurityConfig): Promise<{ isAllowed: boolean }> {
    // In a real implementation, this would check the client's IP address
    // For now, assume allowed unless specifically restricted

    if (securityConfig.ipRestrictions && securityConfig.ipRestrictions.length > 0) {
      // Simplified IP validation - in practice would check actual client IP
      return { isAllowed: true }; // Assume allowed for demo
    }

    return { isAllowed: true };
  }

  private calculateRiskLevel(violations: SecurityViolation[]): 'low' | 'medium' | 'high' | 'critical' {
    const highCount = violations.filter(v => v.severity === 'high').length;
    const mediumCount = violations.filter(v => v.severity === 'medium').length;

    if (highCount > 0) return 'high';
    if (mediumCount > 2) return 'medium';
    if (mediumCount > 0) return 'medium';
    return 'low';
  }

  private handleAuthenticationRequired(): RestrictionHandlingResult {
    return {
      canProceed: false,
      suggestedAction: 'authenticate',
      message: 'Please authenticate to access this content',
      retryAfter: 0,
      alternatives: ['Contact administrator', 'Use alternative access method'],
    };
  }

  private handlePermissionDenied(): RestrictionHandlingResult {
    return {
      canProceed: false,
      suggestedAction: 'request_access',
      message: 'You do not have permission to access this content',
      retryAfter: undefined,
      alternatives: ['Contact meeting organizer', 'Request access from administrator'],
    };
  }

  private handleContentExpired(): RestrictionHandlingResult {
    return {
      canProceed: false,
      suggestedAction: 'check_alternative',
      message: 'This content has expired and is no longer available',
      retryAfter: undefined,
      alternatives: ['Check for backup copies', 'Contact content owner'],
    };
  }

  private handleGeographicRestriction(): RestrictionHandlingResult {
    return {
      canProceed: false,
      suggestedAction: 'check_location',
      message: 'Access is restricted from your current location',
      retryAfter: undefined,
      alternatives: ['Access from approved location', 'Contact administrator'],
    };
  }

  private handleLicenseRestriction(): RestrictionHandlingResult {
    return {
      canProceed: false,
      suggestedAction: 'upgrade_license',
      message: 'This content requires a premium license',
      retryAfter: undefined,
      alternatives: ['Upgrade license', 'Contact administrator', 'Use basic features'],
    };
  }

  private handleUnknownRestriction(): RestrictionHandlingResult {
    return {
      canProceed: false,
      suggestedAction: 'contact_support',
      message: 'Access is restricted for unknown reasons',
      retryAfter: undefined,
      alternatives: ['Contact technical support', 'Try again later'],
    };
  }

  private comparePriority(a: string, b: string): number {
    const priorities = { high: 3, medium: 2, low: 1 };
    return (priorities[b as keyof typeof priorities] || 0) - (priorities[a as keyof typeof priorities] || 0);
  }

  private logAccessAttempt(url: string, result: PermissionCheckResult): void {
    const attemptLog = this.accessAttempts.get(url) || { attempts: [] };

    attemptLog.attempts.push({
      timestamp: Date.now(),
      result: result.hasAccess ? 'success' : 'denied',
      userAgent: navigator.userAgent,
      ipAddress: 'unknown', // Would be populated in server environment
      authMethod: 'token', // Would be determined from actual auth method
    });

    // Keep only last 100 attempts
    if (attemptLog.attempts.length > 100) {
      attemptLog.attempts = attemptLog.attempts.slice(-100);
    }

    this.accessAttempts.set(url, attemptLog);
  }

  private matchesFilters(attempt: AccessAttempt, filters?: AccessLogFilters): boolean {
    if (!filters) return true;

    if (filters.startDate && attempt.timestamp < filters.startDate.getTime()) {
      return false;
    }

    if (filters.endDate && attempt.timestamp > filters.endDate.getTime()) {
      return false;
    }

    if (filters.result && attempt.result !== filters.result) {
      return false;
    }

    return true;
  }

  private generateCacheKey(url: string, authTokens?: AuthTokenInfo[]): string {
    const tokenHash = authTokens ? authTokens.map(t => t.value.substring(0, 8)).join(',') : 'none';

    return `${url}:${tokenHash}`;
  }

  private isCacheExpired(cached: CachedPermissionResult): boolean {
    return Date.now() - cached.timestamp > cached.ttl;
  }

  private getTtlForResult(result: PermissionCheckResult): number {
    // Cache successful results longer than failures
    return result.hasAccess ? 15 * 60 * 1000 : 5 * 60 * 1000; // 15min vs 5min
  }
}

// Supporting interfaces and types

export interface PermissionCheckResult {
  hasAccess: boolean;
  restrictions: AccessRestriction[];
  expiresAt?: Date | undefined;
  lastChecked: Date;
  checkMethod: string;
}

export interface AccessRestriction {
  type:
    | 'authentication_required'
    | 'permission_denied'
    | 'content_expired'
    | 'geographic_restriction'
    | 'license_restriction'
    | 'ip_restriction'
    | 'content_not_found'
    | 'unknown_error';
  description: string;
  severity: 'low' | 'medium' | 'high';
  details?: Record<string, unknown>;
}

export interface AccessContext {
  tenantId?: string;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface AccessSuggestion {
  type: 'authentication' | 'permission' | 'content' | 'location' | 'license';
  title: string;
  description: string;
  action: string;
  priority: 'low' | 'medium' | 'high';
  estimatedTime: string;
}

export interface RestrictionHandlingResult {
  canProceed: boolean;
  suggestedAction: string;
  message: string;
  retryAfter?: number | undefined;
  alternatives: string[];
}

export interface UrlAccessibilityResult {
  accessibility: UrlAccessibility;
  canAccess: boolean;
  statusCode: number;
  headers?: Record<string, string>;
  requiresAuth?: boolean;
  authMethods?: string[];
  error?: string;
}

export interface UrlAccessAttemptResult {
  statusCode: number;
  requiresAuth: boolean;
  supportedAuthMethods: string[];
  headers: Record<string, string>;
}

export interface SecurityComplianceResult {
  isCompliant: boolean;
  violations: SecurityViolation[];
  warnings: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
}

export interface SecurityViolation {
  type: 'transport_security' | 'domain_restriction' | 'token_expired' | 'ip_restriction' | 'certificate_invalid';
  severity: 'low' | 'medium' | 'high';
  description: string;
  recommendation: string;
}

export interface SecurityPolicy {
  allowedDomains: string[];
  blockedDomains: string[];
  requireHttps: boolean;
  maxTokenAge: number;
  allowCrossDomain: boolean;
  ipWhitelist: string[];
  maxAccessAttempts: number;
  lockoutDuration: number;
}

export interface RecordingSpecificPermissions {
  canDownload: boolean;
  canShare: boolean;
  restrictions: string[];
  expiresAt?: Date;
}

export interface TokenExpirationResult {
  hasExpiredTokens: boolean;
  expiredCount: number;
  earliestExpiration?: Date;
}

export interface CachedPermissionResult {
  result: PermissionCheckResult;
  timestamp: number;
  ttl: number;
}

export interface AccessAttemptLog {
  attempts: AccessAttempt[];
}

export interface AccessAttempt {
  timestamp: number;
  result: 'success' | 'denied' | 'error';
  userAgent: string;
  ipAddress: string;
  authMethod: string;
}

export interface AccessLogEntry {
  url: string;
  timestamp: number;
  result: 'success' | 'denied' | 'error';
  userAgent: string;
  ipAddress: string;
  authMethod: string;
}

export interface AccessLogFilters {
  startDate?: Date;
  endDate?: Date;
  result?: 'success' | 'denied' | 'error';
  userAgent?: string;
}

// Create singleton instance
export const permissionChecker = new PermissionChecker();
