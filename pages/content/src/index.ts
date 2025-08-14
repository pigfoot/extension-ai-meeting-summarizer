/**
 * Content Script System Entry Point
 *
 * Main exports for the complete content script system including all
 * components, utilities, and management systems.
 */

// Main content script
export {
  contentScript,
  contentScriptUtils,
  type ContentScriptConfig,
  type ContentScriptStatistics,
  type ContentScriptEvent,
  type ContentScriptEventData,
  type InitializationState,
} from './content-script';

// Type definitions (selective exports to avoid conflicts)
export type {
  UIComponent,
  InjectionPoint,
  DOMManipulator,
  EventHandlerConfig,
  CrossBrowserCompatibility,
  PageChange,
  ContentScriptFeature,
} from './types/content-script';

export type {
  PageIntegrationContext,
  MeetingContentInfo,
  UserPermissions,
  PageLayout,
  InjectionPointInfo,
} from './types/page-integration';

export type {
  MessageType as CommunicationMessageType,
  MessageRequest as CommunicationRequest,
  MessageResponse as CommunicationResponse,
} from './types/communication';

export type {
  BrowserInfo as BrowserCompatInfo,
  FeatureDetectionResult as BrowserFeatureDetection,
} from './types/browser-compat';

// Utilities
export { domManipulator, domUtils, type DOMManipulatorConfig } from './utils/dom-utils';

export { mutationObserver, observerUtils, type EnhancedMutationObserverConfig } from './utils/mutation-observer';

export { eventManager, eventUtils, type EventManagerConfig } from './utils/event-manager';

// Page handlers
export { sharePointHandler, type SharePointContext } from './pages/sharepoint-handler';

export { teamsHandler, type TeamsContext } from './pages/teams-handler';

export { pageRouter, routerUtils, type PageRouterConfig } from './pages/page-router';

export { pageMonitor, monitorUtils, type PageMonitorConfig } from './pages/page-monitor';

// UI Components
export {
  componentRegistry,
  registryUtils,
  type ComponentRegistration,
  type RegistryConfig,
  type RegistryStatistics,
} from './components/ComponentRegistry';

// Communication layer
export {
  messageDispatcher,
  dispatcherUtils,
  type MessageType,
  type MessageRequest,
  type MessageResponse,
  type DispatcherConfig,
} from './communication/message-dispatcher';

export {
  eventSubscriber,
  subscriberUtils,
  type BackgroundEventType,
  type EventHandler,
  type EventSubscriptionConfig,
} from './communication/event-subscriber';

export {
  stateSynchronizer,
  syncUtils,
  type SynchronizedStateType,
  type StateChangeEvent,
  type SynchronizerConfig,
} from './communication/state-synchronizer';

export {
  backgroundCoordinator,
  coordinatorUtils,
  type CoordinatorConfig,
  type ConnectionStatus,
  type CoordinatorStatistics,
} from './communication/background-coordinator';

// Feature activation and analysis
export {
  contentAnalyzer,
  analyzerUtils,
  type ContentType,
  type ContentAnalysisResult,
  type MeetingIndicators,
  type AnalysisConfig,
} from './analysis/content-analyzer';

export {
  featureActivationManager,
  activationUtils,
  type FeatureType,
  type FeatureConfig,
  type FeatureActivationResult,
  type ActivationConfig,
} from './features/feature-activation';

// Browser compatibility
export {
  browserCompatibility,
  compatUtils,
  type BrowserInfo,
  type FeatureDetectionResult,
  type CompatibilityConfig,
} from './compat/browser-compat';

// Injection system
export {
  injectionController,
  injectionUtils,
  type InjectionResult,
  type InjectionConfig,
} from './injection/injection-controller';

// Convenience exports for common use cases
export const ContentScriptSystem = {
  // Main system
  main: contentScript,
  utils: contentScriptUtils,

  // Core utilities
  dom: domManipulator,
  events: eventManager,
  mutations: mutationObserver,

  // Page handling
  router: pageRouter,
  monitor: pageMonitor,
  sharepoint: sharePointHandler,
  teams: teamsHandler,

  // Communication
  background: backgroundCoordinator,
  messages: messageDispatcher,
  eventSub: eventSubscriber,
  stateSync: stateSynchronizer,

  // Components and features
  components: componentRegistry,
  features: featureActivationManager,
  injection: injectionController,

  // Analysis and compatibility
  analyzer: contentAnalyzer,
  compat: browserCompatibility,

  // Quick actions
  async initialize() {
    return contentScript.initialize();
  },

  async analyzeContent() {
    return contentAnalyzer.analyzeContent();
  },

  async activateFeatures() {
    return contentScript.activateFeatures();
  },

  isReady() {
    return contentScript.isReady();
  },

  getStats() {
    return {
      main: contentScript.getStatistics(),
      features: featureActivationManager.getStatistics(),
      components: componentRegistry.getStatistics(),
      communication: backgroundCoordinator.getStatistics(),
      analysis: contentAnalyzer.getStatistics(),
    };
  },

  async cleanup() {
    return contentScript.shutdown();
  },
} as const;

// Default export
export default ContentScriptSystem;
