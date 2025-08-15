/**
 * Permission Checker
 *
 * User permission evaluation and access control validation for recording
 * content and feature availability in content scripts.
 */

import { ContentAnalyzer } from './content-analyzer';
import { eventManager } from '../utils/event-manager';
import type { ContentAnalysisResult } from './content-analyzer';
import type { PermissionSet, AuthenticationStatus } from '../types/page-integration';

/**
 * Permission evaluation result
 */
export interface PermissionEvaluationResult {
  /** Overall permission status */
  hasAccess: boolean;
  /** Specific permissions granted */
  permissions: PermissionSet;
  /** Reasons for denied permissions */
  deniedReasons: PermissionDenialReason[];
  /** Authentication status */
  authStatus: AuthenticationStatus;
  /** User role information */
  userRole: UserRole;
  /** Content-specific permissions */
  contentPermissions: Map<string, ContentPermissionDetails>;
  /** Feature-specific permissions */
  featurePermissions: Map<string, FeaturePermissionDetails>;
  /** Evaluation metadata */
  evaluationMetadata: PermissionEvaluationMetadata;
}

/**
 * Permission denial reasons
 */
export interface PermissionDenialReason {
  /** Denial type */
  type: 'authentication' | 'authorization' | 'content-restriction' | 'feature-limitation' | 'policy-violation';
  /** Denial code */
  code: string;
  /** Human-readable message */
  message: string;
  /** Suggested actions */
  suggestedActions: string[];
  /** Recovery options */
  recoveryOptions: PermissionRecoveryOption[];
}

/**
 * User role information
 */
export interface UserRole {
  /** Primary role */
  primary: 'owner' | 'member' | 'guest' | 'viewer' | 'contributor' | 'admin' | 'unknown';
  /** Secondary roles */
  secondary: string[];
  /** Role capabilities */
  capabilities: string[];
  /** Role restrictions */
  restrictions: string[];
  /** Role metadata */
  metadata: Record<string, unknown>;
}

/**
 * Content permission details
 */
export interface ContentPermissionDetails {
  /** Content identifier */
  contentId: string;
  /** Content type */
  contentType: string;
  /** Access level granted */
  accessLevel: 'full' | 'restricted' | 'view-only' | 'no-access';
  /** Specific permissions */
  permissions: {
    canView: boolean;
    canDownload: boolean;
    canShare: boolean;
    canTranscribe: boolean;
    canProcess: boolean;
  };
  /** Permission source */
  source: 'explicit' | 'inherited' | 'default' | 'policy';
  /** Expiration date */
  expiresAt?: Date;
}

/**
 * Feature permission details
 */
export interface FeaturePermissionDetails {
  /** Feature identifier */
  featureId: string;
  /** Feature enabled status */
  enabled: boolean;
  /** Usage limitations */
  limitations: {
    maxUsage?: number;
    timeRestrictions?: string[];
    sizeRestrictions?: number;
    formatRestrictions?: string[];
  };
  /** Permission level */
  level: 'full' | 'limited' | 'trial' | 'disabled';
  /** Configuration overrides */
  overrides: Record<string, unknown>;
}

/**
 * Permission recovery option
 */
export interface PermissionRecoveryOption {
  /** Recovery action type */
  type: 'login' | 'request-access' | 'upgrade-plan' | 'contact-admin' | 'retry' | 'fallback';
  /** Action description */
  description: string;
  /** Action URL or handler */
  action: string | (() => Promise<void>);
  /** Estimated success probability */
  successProbability: number;
  /** Required user interaction */
  requiresInteraction: boolean;
}

/**
 * Permission evaluation metadata
 */
export interface PermissionEvaluationMetadata {
  /** Evaluation timestamp */
  evaluatedAt: Date;
  /** Evaluation duration */
  duration: number;
  /** Evaluator version */
  version: string;
  /** Evaluation context */
  context: {
    pageUrl: string;
    userAgent: string;
    sessionId: string;
    contentAnalysisId: string;
  };
  /** Cache information */
  cache: {
    hit: boolean;
    key: string;
    ttl: number;
  };
}

/**
 * Permission check configuration
 */
export interface PermissionCheckConfig {
  /** Check depth level */
  depth: 'basic' | 'detailed' | 'comprehensive';
  /** Include content analysis */
  includeContentAnalysis: boolean;
  /** Check feature permissions */
  checkFeaturePermissions: boolean;
  /** Cache evaluation results */
  useCache: boolean;
  /** Cache TTL in seconds */
  cacheTtl: number;
  /** Fail-safe mode */
  failSafe: boolean;
  /** Timeout for permission checks */
  timeout: number;
}

/**
 * SharePoint permission indicators
 */
export interface SharePointPermissionIndicators {
  /** User display name element */
  userDisplayName?: Element;
  /** User profile menu */
  userProfileMenu?: Element;
  /** Permission indicators */
  permissionElements: Element[];
  /** Site permissions */
  sitePermissions: string[];
  /** Document library permissions */
  libraryPermissions: string[];
  /** Item-level permissions */
  itemPermissions: Map<string, string[]>;
}

/**
 * Teams permission indicators
 */
export interface TeamsPermissionIndicators {
  /** Meeting role indicators */
  meetingRole?: string;
  /** Participant status */
  participantStatus?: string;
  /** Recording permissions */
  recordingPermissions: string[];
  /** Chat permissions */
  chatPermissions: string[];
  /** Screen share permissions */
  screenSharePermissions: string[];
}

/**
 * Permission checker for analyzing user access rights
 */
export class PermissionChecker {
  private contentAnalyzer: ContentAnalyzer;
  private permissionCache: Map<string, PermissionEvaluationResult> = new Map();
  private evaluationCount = 0;

  constructor(contentAnalyzer: ContentAnalyzer) {
    this.contentAnalyzer = contentAnalyzer;
    this.setupPermissionMonitoring();
  }

  /**
   * Evaluate user permissions for page content
   */
  async evaluatePermissions(
    contentAnalysis: ContentAnalysisResult,
    config: Partial<PermissionCheckConfig> = {},
  ): Promise<PermissionEvaluationResult> {
    const fullConfig = this.buildConfig(config);
    const startTime = Date.now();

    try {
      // Check cache first
      if (fullConfig.useCache) {
        const cached = this.getCachedResult(contentAnalysis.analysisId);
        if (cached) {
          return cached;
        }
      }

      // Evaluate permissions
      const result = await this.performPermissionEvaluation(contentAnalysis, fullConfig);

      // Update evaluation metadata
      result.evaluationMetadata.duration = Date.now() - startTime;
      result.evaluationMetadata.evaluatedAt = new Date();

      // Cache result
      if (fullConfig.useCache) {
        this.cacheResult(contentAnalysis.analysisId, result, fullConfig.cacheTtl);
      }

      return result;
    } catch (error) {
      console.error('Permission evaluation failed:', error);

      if (fullConfig.failSafe) {
        return this.createFailSafeResult(contentAnalysis, error as Error);
      }

      throw error;
    }
  }

  /**
   * Check permissions for specific content item
   */
  async checkContentPermissions(
    contentId: string,
    contentType: string,
    element?: Element,
  ): Promise<ContentPermissionDetails> {
    try {
      const pageType = this.detectPageType();

      if (pageType === 'sharepoint') {
        return await this.checkSharePointContentPermissions(contentId, contentType, element);
      } else if (pageType === 'teams') {
        return await this.checkTeamsContentPermissions(contentId, contentType, element);
      } else {
        return this.createDefaultContentPermissions(contentId, contentType);
      }
    } catch (error) {
      console.error('Content permission check failed:', error);
      return this.createRestrictedContentPermissions(contentId, contentType);
    }
  }

  /**
   * Check permissions for specific feature
   */
  async checkFeaturePermissions(featureId: string): Promise<FeaturePermissionDetails> {
    try {
      const userRole = await this.evaluateUserRole();
      const pageContext = await this.getPageContext();

      return {
        featureId,
        enabled: this.isFeatureEnabled(featureId, userRole, pageContext),
        limitations: this.getFeatureLimitations(featureId, userRole),
        level: this.getFeatureLevel(featureId, userRole),
        overrides: this.getFeatureOverrides(featureId, pageContext),
      };
    } catch (error) {
      console.error('Feature permission check failed:', error);
      return this.createDisabledFeaturePermissions(featureId);
    }
  }

  /**
   * Evaluate user role and capabilities
   */
  async evaluateUserRole(): Promise<UserRole> {
    try {
      const pageType = this.detectPageType();

      if (pageType === 'sharepoint') {
        return await this.evaluateSharePointUserRole();
      } else if (pageType === 'teams') {
        return await this.evaluateTeamsUserRole();
      } else {
        return this.createUnknownUserRole();
      }
    } catch (error) {
      console.error('User role evaluation failed:', error);
      return this.createUnknownUserRole();
    }
  }

  /**
   * Perform comprehensive permission evaluation
   */
  private async performPermissionEvaluation(
    contentAnalysis: ContentAnalysisResult,
    config: PermissionCheckConfig,
  ): Promise<PermissionEvaluationResult> {
    this.evaluationCount++;

    // Evaluate user role
    const userRole = await this.evaluateUserRole();

    // Check authentication status
    const authStatus = this.checkAuthenticationStatus();

    // Evaluate content permissions
    const contentPermissions = new Map<string, ContentPermissionDetails>();
    if (config.includeContentAnalysis) {
      for (const content of contentAnalysis.detectedContent) {
        const permissions = await this.checkContentPermissions(content.id, content.type, content.element);
        contentPermissions.set(content.id, permissions);
      }
    }

    // Evaluate feature permissions
    const featurePermissions = new Map<string, FeaturePermissionDetails>();
    if (config.checkFeaturePermissions) {
      const features = ['transcription', 'download', 'share', 'export'];
      for (const feature of features) {
        const permissions = await this.checkFeaturePermissions(feature);
        featurePermissions.set(feature, permissions);
      }
    }

    // Determine overall access
    const hasAccess = this.determineOverallAccess(userRole, authStatus, contentPermissions, featurePermissions);

    // Generate permissions set
    const permissions = this.generatePermissionSet(userRole, contentPermissions, featurePermissions);

    // Identify denial reasons
    const deniedReasons = this.identifyDenialReasons(
      hasAccess,
      userRole,
      authStatus,
      contentPermissions,
      featurePermissions,
    );

    return {
      hasAccess,
      permissions,
      deniedReasons,
      authStatus,
      userRole,
      contentPermissions,
      featurePermissions,
      evaluationMetadata: this.createEvaluationMetadata(contentAnalysis),
    };
  }

  /**
   * Check SharePoint content permissions
   */
  private async checkSharePointContentPermissions(
    contentId: string,
    contentType: string,
    element?: Element,
  ): Promise<ContentPermissionDetails> {
    const indicators = this.getSharePointPermissionIndicators(element);

    return {
      contentId,
      contentType,
      accessLevel: this.determineSharePointAccessLevel(indicators),
      permissions: {
        canView: this.canViewSharePointContent(indicators),
        canDownload: this.canDownloadSharePointContent(indicators),
        canShare: this.canShareSharePointContent(indicators),
        canTranscribe: this.canTranscribeSharePointContent(indicators),
        canProcess: this.canProcessSharePointContent(indicators),
      },
      source: 'explicit',
    };
  }

  /**
   * Check Teams content permissions
   */
  private async checkTeamsContentPermissions(
    contentId: string,
    contentType: string,
    element?: Element,
  ): Promise<ContentPermissionDetails> {
    const indicators = this.getTeamsPermissionIndicators(element);

    return {
      contentId,
      contentType,
      accessLevel: this.determineTeamsAccessLevel(indicators),
      permissions: {
        canView: this.canViewTeamsContent(indicators),
        canDownload: this.canDownloadTeamsContent(indicators),
        canShare: this.canShareTeamsContent(indicators),
        canTranscribe: this.canTranscribeTeamsContent(indicators),
        canProcess: this.canProcessTeamsContent(indicators),
      },
      source: 'inherited',
    };
  }

  /**
   * Get SharePoint permission indicators
   */
  private getSharePointPermissionIndicators(element?: Element): SharePointPermissionIndicators {
    return {
      userDisplayName: document.querySelector('[data-automationid="PersonaCardUserName"]') || undefined,
      userProfileMenu: document.querySelector('[data-automationid="PersonaCard"]') || undefined,
      permissionElements: Array.from(document.querySelectorAll('[data-automation-key*="permission"]')),
      sitePermissions: this.extractSharePointSitePermissions(),
      libraryPermissions: this.extractSharePointLibraryPermissions(),
      itemPermissions: this.extractSharePointItemPermissions(element),
    };
  }

  /**
   * Get Teams permission indicators
   */
  private getTeamsPermissionIndicators(_element?: Element): TeamsPermissionIndicators {
    return {
      meetingRole: this.extractTeamsMeetingRole(),
      participantStatus: this.extractTeamsParticipantStatus(),
      recordingPermissions: this.extractTeamsRecordingPermissions(),
      chatPermissions: this.extractTeamsChatPermissions(),
      screenSharePermissions: this.extractTeamsScreenSharePermissions(),
    };
  }

  /**
   * Evaluate SharePoint user role
   */
  private async evaluateSharePointUserRole(): Promise<UserRole> {
    const indicators = this.getSharePointPermissionIndicators();

    let primary: UserRole['primary'] = 'unknown';
    const capabilities: string[] = [];
    const restrictions: string[] = [];

    // Determine role from site permissions
    if (indicators.sitePermissions.includes('Full Control')) {
      primary = 'admin';
      capabilities.push('full-control', 'manage-permissions', 'delete-items');
    } else if (indicators.sitePermissions.includes('Design')) {
      primary = 'contributor';
      capabilities.push('edit-items', 'add-items', 'delete-own-items');
    } else if (indicators.sitePermissions.includes('Edit')) {
      primary = 'member';
      capabilities.push('edit-items', 'add-items');
    } else if (indicators.sitePermissions.includes('Read')) {
      primary = 'viewer';
      capabilities.push('view-items');
      restrictions.push('no-edit', 'no-delete');
    }

    return {
      primary,
      secondary: [],
      capabilities,
      restrictions,
      metadata: {
        sitePermissions: indicators.sitePermissions,
        libraryPermissions: indicators.libraryPermissions,
      },
    };
  }

  /**
   * Evaluate Teams user role
   */
  private async evaluateTeamsUserRole(): Promise<UserRole> {
    const indicators = this.getTeamsPermissionIndicators();

    let primary: UserRole['primary'] = 'unknown';
    const capabilities: string[] = [];
    const restrictions: string[] = [];

    // Determine role from meeting indicators
    switch (indicators.meetingRole) {
      case 'organizer':
        primary = 'owner';
        capabilities.push('manage-meeting', 'record', 'admit-participants');
        break;
      case 'presenter':
        primary = 'contributor';
        capabilities.push('present', 'share-screen', 'manage-chat');
        break;
      case 'attendee':
        primary = 'member';
        capabilities.push('participate', 'chat');
        restrictions.push('no-present', 'no-record');
        break;
      default:
        primary = 'guest';
        restrictions.push('limited-features');
    }

    return {
      primary,
      secondary: [],
      capabilities,
      restrictions,
      metadata: {
        meetingRole: indicators.meetingRole,
        participantStatus: indicators.participantStatus,
      },
    };
  }

  /**
   * Extract SharePoint site permissions
   */
  private extractSharePointSitePermissions(): string[] {
    const permissions: string[] = [];

    // Look for permission indicators in page context
    const pageContext = (window as { _spPageContextInfo?: { userPermissions?: string[] } })._spPageContextInfo;
    if (pageContext?.userPermissions) {
      permissions.push(...pageContext.userPermissions);
    }

    // Check for UI permission indicators
    if (document.querySelector('[data-automationid="CommandBar"] button[name="Edit"]')) {
      permissions.push('Edit');
    }

    if (document.querySelector('[data-automationid="CommandBar"] button[name="Delete"]')) {
      permissions.push('Delete');
    }

    return permissions;
  }

  /**
   * Extract SharePoint library permissions
   */
  private extractSharePointLibraryPermissions(): string[] {
    const permissions: string[] = [];

    // Check for library-specific permission indicators
    const commandBar = document.querySelector('[data-automationid="CommandBar"]');
    if (commandBar) {
      if (commandBar.querySelector('button[name="Upload"]')) {
        permissions.push('Add Items');
      }
      if (commandBar.querySelector('button[name="New"]')) {
        permissions.push('Add Items');
      }
      if (commandBar.querySelector('button[name="Share"]')) {
        permissions.push('Share');
      }
    }

    return permissions;
  }

  /**
   * Extract SharePoint item permissions
   */
  private extractSharePointItemPermissions(element?: Element): Map<string, string[]> {
    const itemPermissions = new Map<string, string[]>();

    if (element) {
      const permissions: string[] = [];

      // Check for item-specific context menu
      const contextMenu = element.querySelector('[data-automationid="ContextualMenu"]');
      if (contextMenu) {
        if (contextMenu.querySelector('[name="Download"]')) {
          permissions.push('Download');
        }
        if (contextMenu.querySelector('[name="Share"]')) {
          permissions.push('Share');
        }
        if (contextMenu.querySelector('[name="Delete"]')) {
          permissions.push('Delete');
        }
      }

      const itemId = element.getAttribute('data-item-id') || 'unknown';
      itemPermissions.set(itemId, permissions);
    }

    return itemPermissions;
  }

  /**
   * Extract Teams meeting role
   */
  private extractTeamsMeetingRole(): string | undefined {
    // Look for meeting role indicators
    const roleElement = document.querySelector('[data-tid="meeting-role"]');
    if (roleElement) {
      return roleElement.textContent?.toLowerCase().trim();
    }

    // Check for organizer indicators
    if (document.querySelector('[data-tid="meeting-organizer-indicator"]')) {
      return 'organizer';
    }

    // Check for presenter indicators
    if (document.querySelector('[data-tid="presenter-indicator"]')) {
      return 'presenter';
    }

    return undefined;
  }

  /**
   * Extract Teams participant status
   */
  private extractTeamsParticipantStatus(): string | undefined {
    const statusElement = document.querySelector('[data-tid="participant-status"]');
    return statusElement?.textContent?.toLowerCase().trim();
  }

  /**
   * Extract Teams recording permissions
   */
  private extractTeamsRecordingPermissions(): string[] {
    const permissions: string[] = [];

    if (document.querySelector('[data-tid="recording-button"]:not([disabled])')) {
      permissions.push('start-recording');
    }

    if (document.querySelector('[data-tid="stop-recording-button"]')) {
      permissions.push('stop-recording');
    }

    return permissions;
  }

  /**
   * Extract Teams chat permissions
   */
  private extractTeamsChatPermissions(): string[] {
    const permissions: string[] = [];

    if (document.querySelector('[data-tid="send-message-button"]:not([disabled])')) {
      permissions.push('send-messages');
    }

    if (document.querySelector('[data-tid="chat-settings"]')) {
      permissions.push('manage-chat');
    }

    return permissions;
  }

  /**
   * Extract Teams screen share permissions
   */
  private extractTeamsScreenSharePermissions(): string[] {
    const permissions: string[] = [];

    if (document.querySelector('[data-tid="share-screen-button"]:not([disabled])')) {
      permissions.push('share-screen');
    }

    return permissions;
  }

  /**
   * Helper methods for permission evaluation
   */
  private detectPageType(): 'sharepoint' | 'teams' | 'unknown' {
    if (window.location.hostname.includes('sharepoint.com') || document.querySelector('[data-sp-feature-tag]')) {
      return 'sharepoint';
    }

    if (window.location.hostname.includes('teams.microsoft.com') || document.querySelector('[data-tid]')) {
      return 'teams';
    }

    return 'unknown';
  }

  private checkAuthenticationStatus(): AuthenticationStatus {
    // Check for authentication indicators
    const userElement = document.querySelector('[data-automationid="PersonaCardUserName"], [data-tid="user-profile"]');

    if (userElement) {
      return 'authenticated';
    }

    const signInElement = document.querySelector('[data-automation-key="sign-in"], [data-tid="sign-in"]');
    if (signInElement) {
      return 'unauthenticated';
    }

    return 'unknown';
  }

  private buildConfig(config: Partial<PermissionCheckConfig>): PermissionCheckConfig {
    return {
      depth: 'detailed',
      includeContentAnalysis: true,
      checkFeaturePermissions: true,
      useCache: true,
      cacheTtl: 300, // 5 minutes
      failSafe: true,
      timeout: 10000, // 10 seconds
      ...config,
    };
  }

  private getCachedResult(analysisId: string): PermissionEvaluationResult | null {
    return this.permissionCache.get(analysisId) || null;
  }

  private cacheResult(analysisId: string, result: PermissionEvaluationResult, ttl: number): void {
    this.permissionCache.set(analysisId, result);

    // Set expiration
    setTimeout(() => {
      this.permissionCache.delete(analysisId);
    }, ttl * 1000);
  }

  private createFailSafeResult(contentAnalysis: ContentAnalysisResult, _error: Error): PermissionEvaluationResult {
    return {
      hasAccess: false,
      permissions: this.createRestrictedPermissionSet(),
      deniedReasons: [
        {
          type: 'authentication',
          code: 'EVALUATION_FAILED',
          message: 'Permission evaluation failed due to technical error',
          suggestedActions: ['Refresh the page', 'Try again later'],
          recoveryOptions: [
            {
              type: 'retry',
              description: 'Retry permission evaluation',
              action: () => this.evaluatePermissions(contentAnalysis),
              successProbability: 0.7,
              requiresInteraction: false,
            },
          ],
        },
      ],
      authStatus: 'unknown',
      userRole: this.createUnknownUserRole(),
      contentPermissions: new Map(),
      featurePermissions: new Map(),
      evaluationMetadata: this.createEvaluationMetadata(contentAnalysis),
    };
  }

  private createEvaluationMetadata(contentAnalysis: ContentAnalysisResult): PermissionEvaluationMetadata {
    return {
      evaluatedAt: new Date(),
      duration: 0,
      version: '1.0.0',
      context: {
        pageUrl: window.location.href,
        userAgent: navigator.userAgent,
        sessionId: 'unknown',
        contentAnalysisId: contentAnalysis.analysisId,
      },
      cache: {
        hit: false,
        key: contentAnalysis.analysisId,
        ttl: 300,
      },
    };
  }

  private createUnknownUserRole(): UserRole {
    return {
      primary: 'unknown',
      secondary: [],
      capabilities: [],
      restrictions: ['unknown-permissions'],
      metadata: {},
    };
  }

  private createRestrictedPermissionSet(): PermissionSet {
    return {
      userInfo: { roles: [] },
      pagePermissions: {
        canView: true,
        canInteract: false,
        canAccessMeetings: false,
        canDownload: false,
        canShare: false,
      },
      contentPermissions: new Map(),
      featurePermissions: new Map(),
      authenticationStatus: 'unknown',
      evaluatedAt: new Date(),
    };
  }

  private determineOverallAccess(
    userRole: UserRole,
    authStatus: AuthenticationStatus,
    contentPermissions: Map<string, ContentPermissionDetails>,
    featurePermissions: Map<string, FeaturePermissionDetails>,
  ): boolean {
    // Require authentication
    if (authStatus !== 'authenticated') {
      return false;
    }

    // Check if user has any meaningful permissions
    if (userRole.primary === 'unknown' || userRole.restrictions.includes('no-access')) {
      return false;
    }

    // Check if any content is accessible
    const hasAccessibleContent = Array.from(contentPermissions.values()).some(cp => cp.permissions.canView);

    // Check if any features are enabled
    const hasEnabledFeatures = Array.from(featurePermissions.values()).some(fp => fp.enabled);

    return hasAccessibleContent || hasEnabledFeatures;
  }

  private generatePermissionSet(
    userRole: UserRole,
    contentPermissions: Map<string, ContentPermissionDetails>,
    featurePermissions: Map<string, FeaturePermissionDetails>,
  ): PermissionSet {
    return {
      userInfo: {
        roles: [userRole.primary, ...userRole.secondary],
      },
      pagePermissions: {
        canView: true,
        canInteract: userRole.capabilities.length > 0,
        canAccessMeetings: contentPermissions.size > 0,
        canDownload: Array.from(contentPermissions.values()).some(cp => cp.permissions.canDownload),
        canShare: Array.from(contentPermissions.values()).some(cp => cp.permissions.canShare),
      },
      contentPermissions,
      featurePermissions,
      authenticationStatus: 'authenticated',
      evaluatedAt: new Date(),
    };
  }

  private identifyDenialReasons(
    hasAccess: boolean,
    userRole: UserRole,
    authStatus: AuthenticationStatus,
    _contentPermissions: Map<string, ContentPermissionDetails>,
    _featurePermissions: Map<string, FeaturePermissionDetails>,
  ): PermissionDenialReason[] {
    const reasons: PermissionDenialReason[] = [];

    if (!hasAccess) {
      if (authStatus !== 'authenticated') {
        reasons.push({
          type: 'authentication',
          code: 'NOT_AUTHENTICATED',
          message: 'User is not authenticated',
          suggestedActions: ['Sign in to your account'],
          recoveryOptions: [
            {
              type: 'login',
              description: 'Sign in to access content',
              action: '/login',
              successProbability: 0.9,
              requiresInteraction: true,
            },
          ],
        });
      }

      if (userRole.primary === 'unknown' || userRole.restrictions.includes('no-access')) {
        reasons.push({
          type: 'authorization',
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'User does not have sufficient permissions',
          suggestedActions: ['Contact your administrator for access'],
          recoveryOptions: [
            {
              type: 'request-access',
              description: 'Request access from administrator',
              action: '/request-access',
              successProbability: 0.5,
              requiresInteraction: true,
            },
          ],
        });
      }
    }

    return reasons;
  }

  private determineSharePointAccessLevel(
    indicators: SharePointPermissionIndicators,
  ): ContentPermissionDetails['accessLevel'] {
    if (indicators.sitePermissions.includes('Full Control')) {
      return 'full';
    } else if (indicators.sitePermissions.includes('Edit') || indicators.sitePermissions.includes('Contribute')) {
      return 'restricted';
    } else if (indicators.sitePermissions.includes('Read')) {
      return 'view-only';
    } else {
      return 'no-access';
    }
  }

  private determineTeamsAccessLevel(indicators: TeamsPermissionIndicators): ContentPermissionDetails['accessLevel'] {
    if (indicators.meetingRole === 'organizer') {
      return 'full';
    } else if (indicators.meetingRole === 'presenter') {
      return 'restricted';
    } else if (indicators.meetingRole === 'attendee') {
      return 'view-only';
    } else {
      return 'no-access';
    }
  }

  private canViewSharePointContent(indicators: SharePointPermissionIndicators): boolean {
    return indicators.sitePermissions.some(p => ['Read', 'Edit', 'Contribute', 'Full Control'].includes(p));
  }

  private canDownloadSharePointContent(indicators: SharePointPermissionIndicators): boolean {
    return (
      indicators.libraryPermissions.includes('Download') ||
      indicators.sitePermissions.some(p => ['Edit', 'Contribute', 'Full Control'].includes(p))
    );
  }

  private canShareSharePointContent(indicators: SharePointPermissionIndicators): boolean {
    return (
      indicators.libraryPermissions.includes('Share') ||
      indicators.sitePermissions.some(p => ['Contribute', 'Full Control'].includes(p))
    );
  }

  private canTranscribeSharePointContent(indicators: SharePointPermissionIndicators): boolean {
    return this.canViewSharePointContent(indicators);
  }

  private canProcessSharePointContent(indicators: SharePointPermissionIndicators): boolean {
    return this.canViewSharePointContent(indicators);
  }

  private canViewTeamsContent(indicators: TeamsPermissionIndicators): boolean {
    return indicators.meetingRole !== undefined;
  }

  private canDownloadTeamsContent(indicators: TeamsPermissionIndicators): boolean {
    return ['organizer', 'presenter'].includes(indicators.meetingRole || '');
  }

  private canShareTeamsContent(indicators: TeamsPermissionIndicators): boolean {
    return ['organizer', 'presenter'].includes(indicators.meetingRole || '');
  }

  private canTranscribeTeamsContent(indicators: TeamsPermissionIndicators): boolean {
    return this.canViewTeamsContent(indicators);
  }

  private canProcessTeamsContent(indicators: TeamsPermissionIndicators): boolean {
    return this.canViewTeamsContent(indicators);
  }

  private createDefaultContentPermissions(contentId: string, contentType: string): ContentPermissionDetails {
    return {
      contentId,
      contentType,
      accessLevel: 'view-only',
      permissions: {
        canView: true,
        canDownload: false,
        canShare: false,
        canTranscribe: false,
        canProcess: false,
      },
      source: 'default',
    };
  }

  private createRestrictedContentPermissions(contentId: string, contentType: string): ContentPermissionDetails {
    return {
      contentId,
      contentType,
      accessLevel: 'no-access',
      permissions: {
        canView: false,
        canDownload: false,
        canShare: false,
        canTranscribe: false,
        canProcess: false,
      },
      source: 'policy',
    };
  }

  private createDisabledFeaturePermissions(featureId: string): FeaturePermissionDetails {
    return {
      featureId,
      enabled: false,
      limitations: {},
      level: 'disabled',
      overrides: {},
    };
  }

  private isFeatureEnabled(featureId: string, userRole: UserRole, _pageContext: unknown): boolean {
    // Basic feature availability based on user role
    switch (featureId) {
      case 'transcription':
        return userRole.capabilities.includes('view-items') || userRole.capabilities.includes('participate');
      case 'download':
        return userRole.capabilities.includes('download') || userRole.capabilities.includes('edit-items');
      case 'share':
        return userRole.capabilities.includes('share') || userRole.capabilities.includes('manage-meeting');
      case 'export':
        return userRole.capabilities.includes('edit-items') || userRole.capabilities.includes('contribute');
      default:
        return false;
    }
  }

  private getFeatureLimitations(featureId: string, userRole: UserRole): FeaturePermissionDetails['limitations'] {
    const limitations: FeaturePermissionDetails['limitations'] = {};

    // Apply role-based limitations
    if (userRole.primary === 'guest' || userRole.primary === 'viewer') {
      limitations.maxUsage = 5;
      limitations.timeRestrictions = ['business-hours-only'];
      limitations.sizeRestrictions = 100 * 1024 * 1024; // 100MB
    }

    return limitations;
  }

  private getFeatureLevel(featureId: string, userRole: UserRole): FeaturePermissionDetails['level'] {
    if (userRole.primary === 'admin' || userRole.primary === 'owner') {
      return 'full';
    } else if (userRole.primary === 'contributor' || userRole.primary === 'member') {
      return 'limited';
    } else if (userRole.primary === 'viewer' || userRole.primary === 'guest') {
      return 'trial';
    } else {
      return 'disabled';
    }
  }

  private getFeatureOverrides(_featureId: string, _pageContext: unknown): Record<string, unknown> {
    return {};
  }

  private async getPageContext(): Promise<{ url: string; title: string; type: unknown }> {
    return {
      url: window.location.href,
      title: document.title,
      type: this.detectPageType(),
    };
  }

  /**
   * Setup permission monitoring for dynamic changes
   */
  private setupPermissionMonitoring(): void {
    // Monitor for permission-related DOM changes
    eventManager.addEventHandler('permission-change', event => {
      this.handlePermissionChange(event);
    });

    // Monitor for authentication state changes
    eventManager.addEventHandler('auth-change', event => {
      this.handleAuthenticationChange(event);
    });
  }

  private handlePermissionChange(_event: Event): void {
    // Clear relevant cache entries
    this.permissionCache.clear();
  }

  private handleAuthenticationChange(_event: Event): void {
    // Clear all cache entries on auth changes
    this.permissionCache.clear();
  }

  /**
   * Get evaluation statistics
   */
  getEvaluationStats(): { count: number; cacheSize: number } {
    return {
      count: this.evaluationCount,
      cacheSize: this.permissionCache.size,
    };
  }

  /**
   * Clear permission cache
   */
  clearCache(): void {
    this.permissionCache.clear();
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.permissionCache.clear();
    eventManager.removeEventHandler('permission-change');
    eventManager.removeEventHandler('auth-change');
  }
}

// Export singleton instance
export const permissionChecker = new PermissionChecker(new ContentAnalyzer());
