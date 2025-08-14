/**
 * Background service types barrel exports
 * Provides centralized access to all background service type definitions
 */

// Service Worker types
export type {
  LifecycleEvent,
  ServiceWorkerStatus,
  ResourceLimits,
  PerformanceMetrics,
  StartupConfig,
  ServiceWorkerError,
  Connection,
  SubsystemStatus,
  ServiceWorkerState,
  StateSerializationConfig,
  LifecycleEventHandler,
  LifecycleEventData,
  HealthCheck,
  RecoveryStrategy,
  InitializationResult,
} from './service-worker';

// Job orchestration types
export type {
  JobPriority,
  JobProcessingStatus,
  ProcessingLimits,
  JobExecutionContext,
  OrchestrationJob,
  JobQueueConfig,
  JobQueueState,
  JobSchedulerConfig,
  JobProgressInfo,
  JobOrchestrationError,
  OrchestrationMetrics,
  JobDependency,
  JobOrchestrator,
} from './job-orchestration';

// Message routing types
export type {
  ComponentType,
  MessageType,
  MessagePriority,
  DeliveryMode,
  ComponentRegistration,
  MessageEnvelope,
  MessageSubscription,
  BroadcastConfig,
  RoutingRule,
  RoutingMetrics,
  CrossTabSyncConfig,
  MessageRouterConfig,
  MessageRouter,
} from './message-routing';
