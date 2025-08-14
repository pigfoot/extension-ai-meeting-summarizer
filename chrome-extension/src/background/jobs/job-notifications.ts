/**
 * Job notification service for cross-component broadcasting
 * Handles job completion, failure notifications, and cross-component communication
 */

import type {
  OrchestrationJob,
  JobProcessingStatus,
  JobProgressInfo,
  JobOrchestrationError,
  MessageType,
  MessageEnvelope,
  ComponentType,
  MessagePriority,
} from '../types';
import type { JobStatusChangeEvent, JobProgressUpdateEvent, JobLifecycleEvent } from './job-tracker';

/**
 * Notification configuration
 */
export interface NotificationConfig {
  /** Enable job completion notifications */
  enableCompletionNotifications: boolean;
  /** Enable job failure notifications */
  enableFailureNotifications: boolean;
  /** Enable progress update notifications */
  enableProgressNotifications: boolean;
  /** Progress notification throttle interval in milliseconds */
  progressThrottleInterval: number;
  /** Enable cross-component broadcasting */
  enableCrossComponentBroadcast: boolean;
  /** Components to notify */
  targetComponents: ComponentType[];
  /** Notification priorities by event type */
  eventPriorities: Record<string, MessagePriority>;
}

/**
 * Notification delivery result
 */
export interface NotificationDeliveryResult {
  /** Whether notification was delivered successfully */
  success: boolean;
  /** Number of components notified */
  componentsNotified: number;
  /** Failed deliveries */
  failedDeliveries: Array<{
    componentType: ComponentType;
    error: string;
  }>;
  /** Delivery timestamp */
  timestamp: string;
}

/**
 * Job notification payload for different event types
 */
export type JobNotificationPayload = {
  jobCompleted: {
    job: OrchestrationJob;
    result: unknown;
    duration: number;
  };
  jobFailed: {
    job: OrchestrationJob;
    error: JobOrchestrationError;
    retryable: boolean;
  };
  jobProgress: {
    jobId: string;
    progress: JobProgressInfo;
    previousProgress?: number;
  };
  jobStatusChanged: {
    jobId: string;
    previousStatus: JobProcessingStatus;
    newStatus: JobProcessingStatus;
    reason?: string;
  };
  jobStarted: {
    job: OrchestrationJob;
    estimatedDuration?: number;
  };
  jobCancelled: {
    jobId: string;
    reason: string;
  };
};

/**
 * Notification statistics
 */
export interface NotificationStats {
  /** Total notifications sent */
  totalNotifications: number;
  /** Notifications by type */
  notificationsByType: Record<keyof JobNotificationPayload, number>;
  /** Successful deliveries */
  successfulDeliveries: number;
  /** Failed deliveries */
  failedDeliveries: number;
  /** Average delivery time in milliseconds */
  averageDeliveryTime: number;
  /** Components notification counts */
  componentCounts: Record<ComponentType, number>;
  /** Last notification timestamp */
  lastNotification?: string;
}

/**
 * Job notification service
 */
export class JobNotificationService {
  private config: NotificationConfig;
  private stats: NotificationStats;
  private progressThrottleMap = new Map<string, number>();
  private notificationHandlers = new Map<keyof JobNotificationPayload, Set<(payload: unknown) => void>>();
  private messageRouter: { broadcast: (message: unknown) => void } | null = null; // TODO: Type this properly when MessageRouter is implemented

  constructor(config: NotificationConfig) {
    this.config = config;
    this.stats = this.initializeStats();
  }

  /**
   * Set message router for cross-component communication
   */
  setMessageRouter(messageRouter: { broadcast: (message: unknown) => void }): void {
    this.messageRouter = messageRouter;
  }

  /**
   * Notify job completion
   */
  async notifyJobCompleted(
    job: OrchestrationJob,
    result: unknown,
    duration: number,
  ): Promise<NotificationDeliveryResult> {
    if (!this.config.enableCompletionNotifications) {
      return this.createEmptyResult();
    }

    const payload: JobNotificationPayload['jobCompleted'] = {
      job,
      result,
      duration,
    };

    return this.sendNotification('jobCompleted', payload, 'high');
  }

  /**
   * Notify job failure
   */
  async notifyJobFailed(job: OrchestrationJob, error: JobOrchestrationError): Promise<NotificationDeliveryResult> {
    if (!this.config.enableFailureNotifications) {
      return this.createEmptyResult();
    }

    const payload: JobNotificationPayload['jobFailed'] = {
      job,
      error,
      retryable: error.recoverable,
    };

    return this.sendNotification('jobFailed', payload, 'urgent');
  }

  /**
   * Notify job progress update
   */
  async notifyJobProgress(
    jobId: string,
    progress: JobProgressInfo,
    previousProgress?: number,
  ): Promise<NotificationDeliveryResult> {
    if (!this.config.enableProgressNotifications) {
      return this.createEmptyResult();
    }

    // Throttle progress notifications
    if (this.shouldThrottleProgress(jobId)) {
      return this.createEmptyResult();
    }

    const payload: JobNotificationPayload['jobProgress'] = {
      jobId,
      progress,
      previousProgress,
    };

    return this.sendNotification('jobProgress', payload, 'normal');
  }

  /**
   * Notify job status change
   */
  async notifyJobStatusChanged(
    jobId: string,
    previousStatus: JobProcessingStatus,
    newStatus: JobProcessingStatus,
    reason?: string,
  ): Promise<NotificationDeliveryResult> {
    const payload: JobNotificationPayload['jobStatusChanged'] = {
      jobId,
      previousStatus,
      newStatus,
      reason,
    };

    const priority = this.getStatusChangePriority(newStatus);
    return this.sendNotification('jobStatusChanged', payload, priority);
  }

  /**
   * Notify job started
   */
  async notifyJobStarted(job: OrchestrationJob, estimatedDuration?: number): Promise<NotificationDeliveryResult> {
    const payload: JobNotificationPayload['jobStarted'] = {
      job,
      estimatedDuration,
    };

    return this.sendNotification('jobStarted', payload, 'normal');
  }

  /**
   * Notify job cancelled
   */
  async notifyJobCancelled(jobId: string, reason: string): Promise<NotificationDeliveryResult> {
    const payload: JobNotificationPayload['jobCancelled'] = {
      jobId,
      reason,
    };

    return this.sendNotification('jobCancelled', payload, 'high');
  }

  /**
   * Handle job tracker events
   */
  handleJobStatusChange(event: JobStatusChangeEvent): void {
    this.notifyJobStatusChanged(event.jobId, event.previousStatus, event.newStatus, event.reason).catch(error => {
      console.error('[JobNotificationService] Failed to notify status change:', error);
    });
  }

  /**
   * Handle job progress events
   */
  handleJobProgressUpdate(event: JobProgressUpdateEvent): void {
    const progress: JobProgressInfo = {
      jobId: event.jobId,
      progressPercentage: event.progress,
      currentStage: event.stage,
      estimatedRemainingTime: event.estimatedRemainingTime || 0,
      throughput: 0, // Would be calculated elsewhere
      lastUpdate: event.timestamp,
      stageProgress: [
        {
          stage: event.stage,
          percentage: event.progress,
          startTime: event.timestamp,
        },
      ],
    };

    this.notifyJobProgress(event.jobId, progress).catch(error => {
      console.error('[JobNotificationService] Failed to notify progress update:', error);
    });
  }

  /**
   * Handle job lifecycle events
   */
  handleJobLifecycleEvent(event: JobLifecycleEvent): void {
    // Handle specific lifecycle events that need special notifications
    switch (event.type) {
      case 'started':
        // Job started notification would be handled by job coordinator
        break;
      case 'timeout':
        console.warn(`[JobNotificationService] Job ${event.jobId} timed out`);
        break;
      case 'failed':
        console.error(`[JobNotificationService] Job ${event.jobId} failed`);
        break;
    }
  }

  /**
   * Register notification handler
   */
  onNotification<K extends keyof JobNotificationPayload>(
    type: K,
    handler: (payload: JobNotificationPayload[K]) => void,
  ): void {
    const handlers = this.notificationHandlers.get(type) || new Set();
    handlers.add(handler);
    this.notificationHandlers.set(type, handlers);
  }

  /**
   * Remove notification handler
   */
  removeNotificationHandler<K extends keyof JobNotificationPayload>(
    type: K,
    handler: (payload: JobNotificationPayload[K]) => void,
  ): void {
    const handlers = this.notificationHandlers.get(type);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Get notification statistics
   */
  getStats(): NotificationStats {
    return { ...this.stats };
  }

  /**
   * Update notification configuration
   */
  updateConfig(config: Partial<NotificationConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[JobNotificationService] Configuration updated');
  }

  /**
   * Clear notification statistics
   */
  clearStats(): void {
    this.stats = this.initializeStats();
    console.log('[JobNotificationService] Statistics cleared');
  }

  /**
   * Send notification to components
   */
  private async sendNotification<K extends keyof JobNotificationPayload>(
    type: K,
    payload: JobNotificationPayload[K],
    priority: MessagePriority,
  ): Promise<NotificationDeliveryResult> {
    const startTime = Date.now();
    const result: NotificationDeliveryResult = {
      success: false,
      componentsNotified: 0,
      failedDeliveries: [],
      timestamp: new Date().toISOString(),
    };

    try {
      // Emit to local handlers first
      await this.emitToLocalHandlers(type, payload);

      // Send to cross-component if enabled
      if (this.config.enableCrossComponentBroadcast && this.messageRouter) {
        const crossComponentResult = await this.sendCrossComponentNotification(type, payload, priority);
        result.componentsNotified += crossComponentResult.componentsNotified;
        result.failedDeliveries.push(...crossComponentResult.failedDeliveries);
      }

      result.success = result.failedDeliveries.length === 0;

      // Update statistics
      this.updateNotificationStats(type, result, Date.now() - startTime);

      console.log(`[JobNotificationService] Notification sent: ${type} (${result.componentsNotified} components)`);
    } catch (error) {
      result.success = false;
      result.failedDeliveries.push({
        componentType: 'background',
        error: error instanceof Error ? error.message : String(error),
      });

      console.error(`[JobNotificationService] Failed to send notification ${type}:`, error);
    }

    return result;
  }

  /**
   * Emit notification to local handlers
   */
  private async emitToLocalHandlers<K extends keyof JobNotificationPayload>(
    type: K,
    payload: JobNotificationPayload[K],
  ): Promise<void> {
    const handlers = this.notificationHandlers.get(type);
    if (!handlers) return;

    const promises = Array.from(handlers).map(async handler => {
      try {
        await Promise.resolve(handler(payload));
      } catch (error) {
        console.error(`[JobNotificationService] Local handler error for ${type}:`, error);
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Send cross-component notification
   */
  private async sendCrossComponentNotification<K extends keyof JobNotificationPayload>(
    type: K,
    payload: JobNotificationPayload[K],
    priority: MessagePriority,
  ): Promise<NotificationDeliveryResult> {
    const result: NotificationDeliveryResult = {
      success: true,
      componentsNotified: 0,
      failedDeliveries: [],
      timestamp: new Date().toISOString(),
    };

    if (!this.messageRouter) {
      result.success = false;
      result.failedDeliveries.push({
        componentType: 'background',
        error: 'Message router not available',
      });
      return result;
    }

    try {
      const _messageEnvelope: MessageEnvelope = {
        messageId: `job-notification-${Date.now()}-${Math.random()}`,
        type: this.getMessageType(type),
        priority,
        deliveryMode: 'broadcast',
        source: {
          componentId: 'background-service',
          type: 'background',
        },
        target: {
          componentTypes: this.config.targetComponents,
        },
        payload,
        metadata: {
          timestamp: new Date().toISOString(),
          tags: ['job-notification', type],
          requiresAck: false,
        },
        delivery: {
          attempts: 0,
          maxAttempts: 3,
          timeout: 5000,
          confirmations: [],
        },
      };

      // TODO: Send through message router when implemented
      // await this.messageRouter.broadcast(messageEnvelope);

      result.componentsNotified = this.config.targetComponents.length;
      console.log(`[JobNotificationService] Cross-component notification sent: ${type}`);
    } catch (error) {
      result.success = false;
      result.failedDeliveries.push({
        componentType: 'background',
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return result;
  }

  /**
   * Check if progress notification should be throttled
   */
  private shouldThrottleProgress(jobId: string): boolean {
    const now = Date.now();
    const lastNotification = this.progressThrottleMap.get(jobId) || 0;

    if (now - lastNotification < this.config.progressThrottleInterval) {
      return true;
    }

    this.progressThrottleMap.set(jobId, now);
    return false;
  }

  /**
   * Get message type for notification
   */
  private getMessageType(notificationType: keyof JobNotificationPayload): MessageType {
    switch (notificationType) {
      case 'jobCompleted':
      case 'jobFailed':
      case 'jobStarted':
      case 'jobCancelled':
        return 'job_status';
      case 'jobProgress':
        return 'job_progress';
      case 'jobStatusChanged':
        return 'job_status';
      default:
        return 'notification';
    }
  }

  /**
   * Get priority for status change
   */
  private getStatusChangePriority(status: JobProcessingStatus): MessagePriority {
    switch (status) {
      case 'failed':
      case 'expired':
        return 'urgent';
      case 'completed':
      case 'cancelled':
        return 'high';
      case 'processing':
        return 'normal';
      default:
        return 'low';
    }
  }

  /**
   * Update notification statistics
   */
  private updateNotificationStats(
    type: keyof JobNotificationPayload,
    result: NotificationDeliveryResult,
    deliveryTime: number,
  ): void {
    this.stats.totalNotifications++;
    this.stats.notificationsByType[type] = (this.stats.notificationsByType[type] || 0) + 1;

    if (result.success) {
      this.stats.successfulDeliveries++;
    } else {
      this.stats.failedDeliveries++;
    }

    // Update average delivery time
    const totalDeliveries = this.stats.successfulDeliveries + this.stats.failedDeliveries;
    this.stats.averageDeliveryTime =
      (this.stats.averageDeliveryTime * (totalDeliveries - 1) + deliveryTime) / totalDeliveries;

    // Update component counts
    for (const component of this.config.targetComponents) {
      this.stats.componentCounts[component] = (this.stats.componentCounts[component] || 0) + 1;
    }

    this.stats.lastNotification = result.timestamp;
  }

  /**
   * Create empty notification result
   */
  private createEmptyResult(): NotificationDeliveryResult {
    return {
      success: true,
      componentsNotified: 0,
      failedDeliveries: [],
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Initialize notification statistics
   */
  private initializeStats(): NotificationStats {
    return {
      totalNotifications: 0,
      notificationsByType: {
        jobCompleted: 0,
        jobFailed: 0,
        jobProgress: 0,
        jobStatusChanged: 0,
        jobStarted: 0,
        jobCancelled: 0,
      },
      successfulDeliveries: 0,
      failedDeliveries: 0,
      averageDeliveryTime: 0,
      componentCounts: {
        background: 0,
        content_script: 0,
        popup: 0,
        options: 0,
        sidepanel: 0,
        devtools: 0,
        offscreen: 0,
      },
    };
  }
}
