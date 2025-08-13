/**
 * Tenant Compatibility Types
 * Defines types for cross-tenant detection and SharePoint configurations
 */

import type { MeetingPlatform } from './page';

/**
 * SharePoint version enumeration
 */
export type SharePointVersion = 'sharepoint_online' | 'sharepoint_2019' | 'sharepoint_2016' | 'unknown';

/**
 * Domain configuration for detection
 */
export interface DomainConfig {
  /** Domain name */
  domain: string;
  /** Platform type */
  platform: MeetingPlatform;
  /** Configuration settings */
  settings: Record<string, unknown>;
}

/**
 * Tenant information and configuration
 */
export interface TenantInfo {
  /** Tenant unique identifier */
  tenantId: string;
  /** Tenant display name */
  name: string;
  /** Primary domain */
  primaryDomain: string;
  /** Additional domains associated with tenant */
  additionalDomains: string[];
  /** SharePoint configuration */
  sharePointConfig: SharePointConfig;
  /** Teams configuration */
  teamsConfig: TeamsConfig;
  /** Tenant region/geo location */
  region: TenantRegion;
  /** Tenant type (corporate, education, etc.) */
  type: TenantType;
  /** Custom configuration overrides */
  customConfig?: TenantCustomConfig;
  /** Last updated timestamp */
  lastUpdated: Date;
}

/**
 * SharePoint-specific configuration
 */
export interface SharePointConfig {
  /** SharePoint version */
  version: SharePointVersion;
  /** Root site collection URL */
  rootSiteUrl: string;
  /** My Sites host URL */
  mySitesUrl?: string;
  /** Custom master pages */
  customMasterPages?: string[];
  /** Site template configurations */
  siteTemplates: SiteTemplate[];
  /** Document library configurations */
  documentLibraries: DocumentLibraryConfig[];
  /** Custom CSS/branding */
  customBranding?: BrandingConfig;
  /** Security and permissions */
  security: SecurityConfig;
  /** Feature flags */
  features: TenantFeatureFlags;
}

/**
 * Teams-specific configuration
 */
export interface TeamsConfig {
  /** Teams tenant URL */
  teamsUrl: string;
  /** Supported Teams clients */
  supportedClients: TeamsClientType[];
  /** Recording storage location */
  recordingStorage: RecordingStorageType;
  /** Meeting policies */
  meetingPolicies: MeetingPolicy[];
  /** Custom apps configuration */
  customApps?: CustomAppConfig[];
  /** Integration settings */
  integrations: IntegrationConfig;
}

/**
 * Domain configuration for detection
 */
export interface DomainDetectionConfig {
  /** Domain pattern (supports wildcards) */
  domain: string;
  /** Platform type for this domain */
  platform: MeetingPlatform;
  /** Tenant this domain belongs to */
  tenantId?: string;
  /** Custom detection rules */
  detectionRules: DomainDetectionRule[];
  /** URL patterns for meeting content */
  meetingUrlPatterns: string[];
  /** Authentication requirements */
  authRequirements: AuthRequirement[];
  /** Custom headers or cookies needed */
  customHeaders?: Record<string, string>;
  /** SSL/security requirements */
  securityRequirements: SecurityRequirement[];
}

/**
 * Site template configuration
 */
export interface SiteTemplate {
  /** Template ID */
  templateId: string;
  /** Template name */
  name: string;
  /** Template type */
  type: SiteTemplateType;
  /** Meeting-related features enabled */
  meetingFeatures: MeetingFeature[];
  /** Custom selectors for this template */
  customSelectors?: string[];
}

/**
 * Document library configuration
 */
export interface DocumentLibraryConfig {
  /** Library name */
  name: string;
  /** Library URL */
  url: string;
  /** Content types allowed */
  contentTypes: string[];
  /** Meeting recording patterns */
  recordingPatterns: string[];
  /** Folder structure patterns */
  folderPatterns: string[];
  /** Permission levels */
  permissions: LibraryPermission[];
}

/**
 * Branding configuration
 */
export interface BrandingConfig {
  /** Custom CSS files */
  customCss: string[];
  /** Custom JavaScript files */
  customJs: string[];
  /** Logo URLs */
  logos: LogoConfig[];
  /** Color scheme */
  colorScheme: ColorScheme;
  /** Custom fonts */
  fonts?: FontConfig[];
}

/**
 * Security configuration
 */
export interface SecurityConfig {
  /** Authentication method */
  authMethod: AuthMethod;
  /** Required permissions */
  requiredPermissions: Permission[];
  /** IP restrictions */
  ipRestrictions?: string[];
  /** Allowed origins for CORS */
  allowedOrigins?: string[];
  /** Conditional access policies */
  conditionalAccess?: ConditionalAccessPolicy[];
  /** External sharing settings */
  externalSharing: ExternalSharingPolicy;
}

/**
 * Feature flags configuration
 */
export interface TenantFeatureFlags {
  /** Modern experience enabled */
  modernExperience: boolean;
  /** Meeting recording enabled */
  meetingRecording: boolean;
  /** Stream integration enabled */
  streamIntegration: boolean;
  /** Teams integration enabled */
  teamsIntegration: boolean;
  /** Whether recordings are available */
  hasRecordings?: boolean | undefined;
  /** Whether transcripts are available */
  hasTranscripts?: boolean | undefined;
  /** Custom features */
  customFeatures: Record<string, boolean>;
}

/**
 * Domain detection rule
 */
export interface DomainDetectionRule {
  /** Rule name */
  name: string;
  /** URL pattern to match */
  urlPattern: string;
  /** CSS selectors to check */
  selectors: string[];
  /** Expected content patterns */
  contentPatterns: string[];
  /** Confidence weight */
  confidence: number;
  /** Required headers */
  requiredHeaders?: string[];
}

/**
 * Authentication requirement
 */
export interface AuthRequirement {
  /** Authentication type */
  type: AuthType;
  /** Required scope */
  scope?: string;
  /** Token endpoint */
  tokenEndpoint?: string;
  /** Additional parameters */
  parameters?: Record<string, string>;
}

/**
 * Security requirement
 */
export interface SecurityRequirement {
  /** Requirement type */
  type: SecurityRequirementType;
  /** Requirement value */
  value: string;
  /** Whether requirement is mandatory */
  mandatory: boolean;
}

/**
 * Meeting policy configuration
 */
export interface MeetingPolicy {
  /** Policy name */
  name: string;
  /** Policy type */
  type: MeetingPolicyType;
  /** Policy settings */
  settings: Record<string, unknown>;
  /** Applies to user groups */
  userGroups?: string[];
}

/**
 * Custom app configuration
 */
export interface CustomAppConfig {
  /** App ID */
  appId: string;
  /** App name */
  name: string;
  /** App permissions */
  permissions: string[];
  /** Configuration settings */
  settings: Record<string, unknown>;
}

/**
 * Integration configuration
 */
export interface IntegrationConfig {
  /** SharePoint integration enabled */
  sharePoint: boolean;
  /** Stream integration enabled */
  stream: boolean;
  /** OneDrive integration enabled */
  oneDrive: boolean;
  /** Custom integrations */
  custom: Record<string, boolean>;
}

/**
 * Tenant custom configuration
 */
export interface TenantCustomConfig {
  /** Custom detection patterns */
  detectionPatterns: Record<string, string[]>;
  /** Custom URL mappings */
  urlMappings: Record<string, string>;
  /** Custom metadata fields */
  metadataFields: string[];
  /** API endpoints */
  apiEndpoints: Record<string, string>;
  /** Timeout configurations */
  timeouts: Record<string, number>;
}

// Enums and types

/**
 * Tenant regions
 */
export type TenantRegion =
  | 'north_america'
  | 'europe'
  | 'asia_pacific'
  | 'australia'
  | 'canada'
  | 'india'
  | 'japan'
  | 'south_america'
  | 'africa'
  | 'unknown';

/**
 * Tenant types
 */
export enum TenantType {
  CORPORATE = 'corporate',
  EDUCATION = 'education',
  GOVERNMENT = 'government',
  NON_PROFIT = 'non_profit',
  SMALL_BUSINESS = 'small_business',
  ENTERPRISE = 'enterprise',
}

/**
 * Site template types
 */
export enum SiteTemplateType {
  TEAM_SITE = 'team_site',
  COMMUNICATION_SITE = 'communication_site',
  PROJECT_SITE = 'project_site',
  MEETING_WORKSPACE = 'meeting_workspace',
  DOCUMENT_CENTER = 'document_center',
  CUSTOM = 'custom',
}

/**
 * Meeting features
 */
export enum MeetingFeature {
  RECORDING = 'recording',
  TRANSCRIPTION = 'transcription',
  LIVE_CAPTIONS = 'live_captions',
  BREAKOUT_ROOMS = 'breakout_rooms',
  WHITEBOARD = 'whiteboard',
  SCREEN_SHARING = 'screen_sharing',
  FILE_SHARING = 'file_sharing',
}

/**
 * Teams client types
 */
export enum TeamsClientType {
  WEB = 'web',
  DESKTOP = 'desktop',
  MOBILE = 'mobile',
  ROOM_SYSTEM = 'room_system',
}

/**
 * Recording storage types
 */
export enum RecordingStorageType {
  STREAM = 'stream',
  SHAREPOINT = 'sharepoint',
  ONEDRIVE = 'onedrive',
  EXTERNAL = 'external',
}

/**
 * Authentication methods
 */
export enum AuthMethod {
  NTLM = 'ntlm',
  OAUTH2 = 'oauth2',
  SAML = 'saml',
  FORMS = 'forms',
  ANONYMOUS = 'anonymous',
}

/**
 * Authentication types
 */
export enum AuthType {
  BEARER_TOKEN = 'bearer_token',
  COOKIE = 'cookie',
  BASIC_AUTH = 'basic_auth',
  DIGEST_AUTH = 'digest_auth',
  CERTIFICATE = 'certificate',
}

/**
 * Security requirement types
 */
export enum SecurityRequirementType {
  TLS_VERSION = 'tls_version',
  CERTIFICATE_VALIDATION = 'certificate_validation',
  CORS_POLICY = 'cors_policy',
  CSP_POLICY = 'csp_policy',
}

/**
 * Meeting policy types
 */
export enum MeetingPolicyType {
  RECORDING_POLICY = 'recording_policy',
  TRANSCRIPTION_POLICY = 'transcription_policy',
  PARTICIPANT_POLICY = 'participant_policy',
  SHARING_POLICY = 'sharing_policy',
}

/**
 * Additional supporting types
 */
export interface LibraryPermission {
  level: 'read' | 'write' | 'full_control';
  users: string[];
  groups: string[];
}

export interface LogoConfig {
  type: 'header' | 'favicon' | 'splash';
  url: string;
  dimensions?: { width: number; height: number };
}

export interface ColorScheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

export interface FontConfig {
  family: string;
  url: string;
  weight?: number;
}

export interface Permission {
  name: string;
  scope: string;
  required: boolean;
}

export interface ConditionalAccessPolicy {
  name: string;
  conditions: Record<string, unknown>;
  actions: Record<string, unknown>;
}

export interface ExternalSharingPolicy {
  enabled: boolean;
  allowedDomains?: string[];
  restrictions?: string[];
}
