/**
 * Meeting Detector Package
 * Main entry point for meeting content detection and analysis
 */

// Core types
export type * from './types/index';

// Detection services
export { domainDetector } from './detection/domain-detector';
export { pageClassifier } from './detection/page-classifier';
export { contentIndicators } from './detection/content-indicators';
export { teamsDetector } from './detection/teams-detector';

// Analyzers
export { sharePointAnalyzer } from './analyzers/sharepoint-analyzer';
export { teamsAnalyzer } from './analyzers/teams-analyzer';

// URL extraction and validation
export { mediaUrlScanner } from './extraction/media-url-scanner';
export { manifestResolver } from './extraction/manifest-resolver';
export { authTokenPreserver } from './extraction/auth-token-preserver';
export { meetingContextExtractor } from './extraction/meeting-context';

// Metadata extraction
export { metadataExtractor } from './extraction/metadata-extractor';
export { participantParser } from './extraction/participant-parser';
export { agendaExtractor } from './extraction/agenda-extractor';
export { metadataFormatter } from './extraction/metadata-formatter';

// Validation
export { urlValidator } from './validation/url-validator';
export { permissionChecker } from './validation/permission-checker';

// Cross-tenant compatibility
export { tenantConfig } from './compatibility/tenant-config';
export { domainAdapter } from './compatibility/domain-adapter';
export { versionHandler } from './compatibility/version-handler';
export { regionalHandler } from './compatibility/regional-handler';

// Analysis coordination
export { pageAnalyzer } from './coordination/page-analyzer';
export { analysisOrchestrator } from './coordination/analysis-orchestrator';

// Monitoring
export { pageMonitor } from './monitoring/page-monitor';

// Utilities
export { teamsLinkResolver } from './utils/teams-link-resolver';
export { confidenceCalculator } from './utils/confidence-calculator';

// Types are already exported via export type * from './types/index' above
