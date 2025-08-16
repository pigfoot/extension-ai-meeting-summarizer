/**
 * Progress Monitor Hook
 *
 * Implements React hook for progress monitoring with real-time updates and error state management.
 * Monitors and displays transcription progress.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type {
  JobProgress,
  NotificationQueue,
  ProgressUpdate,
  ProgressMetrics,
  ProgressStage,
  ProgressError,
  Notification as ProgressNotification,
} from '../types/progress';

/**
 * Progress monitoring service interface
 */
interface ProgressService {
  /** Subscribe to progress updates */
  subscribe(jobId: string, callback: (update: ProgressUpdate) => void): () => void;
  /** Get current progress for a job */
  getProgress(jobId: string): Promise<JobProgress>;
  /** Get progress history */
  getProgressHistory(jobId: string): Promise<ProgressUpdate[]>;
  /** Cancel progress monitoring */
  cancelMonitoring(jobId: string): Promise<void>;
  /** Get progress metrics */
  getMetrics(jobId: string): Promise<ProgressMetrics>;
}

/**
 * Hook configuration options
 */
interface UseProgressMonitorOptions {
  /** Jobs to monitor */
  jobIds?: string[];
  /** Update interval in milliseconds */
  updateInterval?: number;
  /** Enable real-time updates */
  enableRealTimeUpdates?: boolean;
  /** Enable progress notifications */
  enableNotifications?: boolean;
  /** Enable performance metrics */
  enableMetrics?: boolean;
  /** Maximum history length */
  maxHistoryLength?: number;
  /** Progress service instance */
  progressService?: ProgressService;
  /** Error handler */
  onError?: (error: ProgressError) => void;
  /** Progress completion handler */
  onComplete?: (jobId: string, result: unknown) => void;
  /** Stage change handler */
  onStageChange?: (jobId: string, stage: ProgressStage) => void;
  /** Enable debug logging */
  enableDebugLogging?: boolean;
}

/**
 * Progress calculation utilities
 */
class ProgressCalculator {
  /**
   * Calculate overall progress from multiple stages
   */
  static calculateOverallProgress(stages: ProgressStage[]): number {
    if (stages.length === 0) return 0;

    const weights = stages.reduce((sum, stage) => sum + stage.weight, 0);
    const weightedProgress = stages.reduce((sum, stage) => sum + stage.progress * stage.weight, 0);

    return weights > 0 ? weightedProgress / weights : 0;
  }

  /**
   * Estimate completion time based on progress
   */
  static estimateCompletion(currentProgress: number, startTime: Date, recentUpdates: ProgressUpdate[]): Date | null {
    if (currentProgress <= 0 || currentProgress >= 100) return null;

    const now = new Date();
    const elapsed = now.getTime() - startTime.getTime();

    // Use recent progress velocity for more accurate estimation
    if (recentUpdates.length >= 2) {
      const recent = recentUpdates.slice(-5); // Last 5 updates
      const velocities = recent
        .slice(1)
        .map((update, index) => {
          const prev = recent[index];
          if (!prev) return 0;
          const timeDiff = update.timestamp.getTime() - prev.timestamp.getTime();
          const progressDiff = update.progress - prev.progress;
          return progressDiff / timeDiff; // Progress per millisecond
        })
        .filter(v => v > 0);

      const avgVelocity = velocities.reduce((sum, v) => sum + v, 0) / velocities.length;

      if (avgVelocity > 0) {
        const remainingProgress = 100 - currentProgress;
        const estimatedRemainingTime = remainingProgress / avgVelocity;
        return new Date(now.getTime() + estimatedRemainingTime);
      }
    }

    // Fallback to simple linear estimation
    const progressRate = currentProgress / elapsed;
    if (progressRate > 0) {
      const remainingTime = (100 - currentProgress) / progressRate;
      return new Date(now.getTime() + remainingTime);
    }

    return null;
  }

  /**
   * Calculate progress velocity (progress per second)
   */
  static calculateVelocity(updates: ProgressUpdate[]): number {
    if (updates.length < 2) return 0;

    const recent = updates.slice(-10); // Last 10 updates
    if (recent.length < 2) return 0;

    const first = recent[0];
    const last = recent[recent.length - 1];

    if (!first || !last) return 0;

    const timeDiff = (last.timestamp.getTime() - first.timestamp.getTime()) / 1000; // seconds
    const progressDiff = last.progress - first.progress;

    return timeDiff > 0 ? progressDiff / timeDiff : 0;
  }

  /**
   * Smooth progress using exponential moving average
   */
  static smoothProgress(currentProgress: number, newProgress: number, alpha: number = 0.3): number {
    return alpha * newProgress + (1 - alpha) * currentProgress;
  }
}

/**
 * Mock progress service for development
 */
const createMockProgressService = (): ProgressService => {
  const subscribers = new Map<string, Set<(update: ProgressUpdate) => void>>();
  const progressData = new Map<string, JobProgress>();
  const progressHistory = new Map<string, ProgressUpdate[]>();

  const simulateProgress = (jobId: string) => {
    const callbacks = subscribers.get(jobId);
    if (!callbacks || callbacks.size === 0) return;

    const current = progressData.get(jobId) || {
      jobId,
      progress: 0,
      stage: { id: 'audio-processing', name: 'Processing Audio', progress: 0, weight: 1 },
      stages: [
        { id: 'audio-processing', name: 'Processing Audio', progress: 0, weight: 0.3 },
        { id: 'transcription', name: 'Transcribing', progress: 0, weight: 0.5 },
        { id: 'analysis', name: 'Analyzing', progress: 0, weight: 0.2 },
      ],
      startTime: new Date(),
      status: 'processing',
      message: 'Processing audio file...',
    };

    // Simulate progress increment
    const increment = Math.random() * 5 + 2; // 2-7% progress
    const newProgress = Math.min(100, current.progress + increment);

    // Update current stage
    let currentStageIndex = current.stages.findIndex(s => s.id === current.stage.id);
    if (currentStageIndex === -1) currentStageIndex = 0;

    const currentStage = current.stages[currentStageIndex];
    if (!currentStage) return;

    const stageProgress = Math.min(100, currentStage.progress + increment * 2);
    currentStage.progress = stageProgress;

    // Move to next stage if current is complete
    if (stageProgress >= 100 && currentStageIndex < current.stages.length - 1) {
      currentStageIndex++;
      const nextStage = current.stages[currentStageIndex];
      if (nextStage) {
        current.stage = nextStage;
      }
    }

    const updatedProgress: JobProgress = {
      ...current,
      progress: newProgress,
      stage: current.stages[currentStageIndex] || current.stage,
      stages: [...current.stages],
      lastUpdate: new Date(),
      status: newProgress >= 100 ? 'completed' : 'processing',
      message:
        newProgress >= 100
          ? 'Transcription completed!'
          : currentStageIndex === 0
            ? 'Processing audio file...'
            : currentStageIndex === 1
              ? 'Generating transcription...'
              : 'Analyzing content...',
    };

    progressData.set(jobId, updatedProgress);

    const update: ProgressUpdate = {
      jobId,
      progress: newProgress,
      stage: updatedProgress.stage,
      timestamp: new Date(),
      message: updatedProgress.message || '',
      metrics: {
        totalDuration: new Date().getTime() - current.startTime.getTime(),
        averageSpeed: Math.random() * 2 + 1,
        peakSpeed: Math.random() * 4 + 2,
        processingSpeed: Math.random() * 2 + 1,
        velocity: Math.random() * 3 + 1,
        efficiency: Math.random() * 0.3 + 0.7,
        stageMetrics: [],
        ...(ProgressCalculator.estimateCompletion(newProgress, current.startTime, progressHistory.get(jobId) || []) && {
          estimatedCompletion: ProgressCalculator.estimateCompletion(
            newProgress,
            current.startTime,
            progressHistory.get(jobId) || [],
          )!,
        }),
      },
    };

    // Store history
    const history = progressHistory.get(jobId) || [];
    history.push(update);
    if (history.length > 50) history.shift(); // Keep last 50 updates
    progressHistory.set(jobId, history);

    // Notify subscribers
    callbacks.forEach(callback => callback(update));

    // Continue simulation if not complete
    if (newProgress < 100) {
      setTimeout(() => simulateProgress(jobId), 1000 + Math.random() * 2000);
    }
  };

  return {
    subscribe(jobId: string, callback: (update: ProgressUpdate) => void) {
      if (!subscribers.has(jobId)) {
        subscribers.set(jobId, new Set());
        // Start simulation for new job
        if (!progressData.has(jobId)) {
          simulateProgress(jobId);
        }
      }

      subscribers.get(jobId)!.add(callback);

      return () => {
        const callbacks = subscribers.get(jobId);
        if (callbacks) {
          callbacks.delete(callback);
          if (callbacks.size === 0) {
            subscribers.delete(jobId);
          }
        }
      };
    },

    async getProgress(jobId: string) {
      await new Promise(resolve => setTimeout(resolve, 100));
      return (
        progressData.get(jobId) || {
          jobId,
          progress: 0,
          stage: { id: 'audio-processing', name: 'Processing Audio', progress: 0, weight: 1 },
          stages: [],
          startTime: new Date(),
          status: 'pending',
          message: 'Preparing to start...',
        }
      );
    },

    async getProgressHistory(jobId: string) {
      await new Promise(resolve => setTimeout(resolve, 50));
      return progressHistory.get(jobId) || [];
    },

    async cancelMonitoring(jobId: string) {
      subscribers.delete(jobId);
      progressData.delete(jobId);
      progressHistory.delete(jobId);
    },

    async getMetrics(jobId: string) {
      const history = progressHistory.get(jobId) || [];
      const current = progressData.get(jobId);

      return {
        totalDuration: current ? new Date().getTime() - current.startTime.getTime() : 0,
        averageSpeed:
          history.length > 0
            ? history.reduce((sum, h) => sum + (h.metrics?.processingSpeed || 0), 0) / history.length
            : 0,
        peakSpeed: Math.max(...history.map(h => h.metrics?.processingSpeed || 0)),
        efficiency:
          history.length > 0 ? history.reduce((sum, h) => sum + (h.metrics?.efficiency || 0), 0) / history.length : 0,
        velocity:
          history.length > 0 ? history.reduce((sum, h) => sum + (h.metrics?.velocity || 0), 0) / history.length : 0,
        processingSpeed:
          history.length > 0
            ? history.reduce((sum, h) => sum + (h.metrics?.processingSpeed || 0), 0) / history.length
            : 0,
        stageMetrics:
          current?.stages.map(stage => ({
            stageId: stage.id,
            duration: 0,
            averageSpeed: 0,
            efficiency: Math.random() * 0.3 + 0.7,
          })) || [],
      };
    },
  };
};

/**
 * Main progress monitoring hook
 */
export const useProgressMonitor = (options: UseProgressMonitorOptions = {}) => {
  const {
    jobIds = [],
    updateInterval = 1000,
    enableRealTimeUpdates = true,
    enableNotifications = true,
    enableMetrics = false,
    maxHistoryLength = 100,
    progressService: externalProgressService,
    onError,
    onComplete,
    onStageChange,
    enableDebugLogging = false,
  } = options;

  // Service
  const progressService = useRef(externalProgressService || createMockProgressService());

  // State
  const [progressStates, setProgressStates] = useState<Map<string, JobProgress>>(new Map());
  const [progressHistory, setProgressHistory] = useState<Map<string, ProgressUpdate[]>>(new Map());
  const [progressMetrics, setProgressMetrics] = useState<Map<string, ProgressMetrics>>(new Map());
  const [notifications, setNotifications] = useState<NotificationQueue>({
    queue: [],
    displayed: [],
    maxDisplayed: 3,
    defaultDuration: 5000,
    paused: false,
    stats: {
      totalCreated: 0,
      totalDisplayed: 0,
      totalDismissed: 0,
      totalExpired: 0,
      averageDisplayDuration: 0,
      countByType: {
        success: 0,
        error: 0,
        warning: 0,
        info: 0,
        progress: 0,
      },
      countByPriority: {
        critical: 0,
        high: 0,
        normal: 0,
        low: 0,
      },
    },
  });
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [error, setError] = useState<ProgressError | null>(null);

  // Refs
  const unsubscribers = useRef<Map<string, () => void>>(new Map());
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastProgressRef = useRef<Map<string, number>>(new Map());

  // Debug logging
  const debugLog = useCallback(
    (message: string, data?: unknown) => {
      if (enableDebugLogging) {
        console.log(`[ProgressMonitor] ${message}`, data);
      }
    },
    [enableDebugLogging],
  );

  // Handle progress update
  const handleProgressUpdate = useCallback(
    (update: ProgressUpdate) => {
      debugLog('Progress update received', update);

      setProgressStates(prev => {
        const current = prev.get(update.jobId);
        const newProgress: JobProgress = {
          jobId: update.jobId,
          progress: update.progress,
          stage: update.stage,
          stages: current?.stages || [],
          startTime: current?.startTime || new Date(),
          lastUpdate: update.timestamp,
          status: update.progress >= 100 ? 'completed' : 'processing',
          message: update.message,
          ...(update.metrics?.estimatedCompletion && { estimatedCompletion: update.metrics.estimatedCompletion }),
        };

        const newMap = new Map(prev);
        newMap.set(update.jobId, newProgress);
        return newMap;
      });

      // Update history
      setProgressHistory(prev => {
        const history = prev.get(update.jobId) || [];
        const newHistory = [...history, update];

        // Trim history if too long
        if (newHistory.length > maxHistoryLength) {
          newHistory.splice(0, newHistory.length - maxHistoryLength);
        }

        const newMap = new Map(prev);
        newMap.set(update.jobId, newHistory);
        return newMap;
      });

      // Check for stage changes
      const lastProgress = lastProgressRef.current.get(update.jobId) || 0;
      if (update.progress !== lastProgress) {
        onStageChange?.(update.jobId, update.stage);
        lastProgressRef.current.set(update.jobId, update.progress);
      }

      // Check for completion
      if (update.progress >= 100) {
        onComplete?.(update.jobId, update);

        // Add completion notification
        if (enableNotifications) {
          setNotifications(prev => ({
            ...prev,
            queue: [
              ...prev.queue,
              {
                id: `completion-${update.jobId}-${Date.now()}`,
                type: 'success',
                title: 'Job Completed',
                jobId: update.jobId,
                message: `Job ${update.jobId} completed successfully`,
                createdAt: new Date(),
                priority: 'normal',
                dismissible: true,
                read: false,
                persistent: false,
                duration: 5000,
              },
            ],
          }));
        }
      }
    },
    [debugLog, maxHistoryLength, onStageChange, onComplete, enableNotifications],
  );

  // Start monitoring jobs
  const startMonitoring = useCallback(
    (jobIdList: string[]) => {
      debugLog('Starting monitoring for jobs', jobIdList);
      setIsMonitoring(true);

      jobIdList.forEach(jobId => {
        if (!unsubscribers.current.has(jobId)) {
          try {
            const unsubscribe = progressService.current.subscribe(jobId, handleProgressUpdate);
            unsubscribers.current.set(jobId, unsubscribe);
            debugLog(`Subscribed to job ${jobId}`);
          } catch (_error) {
            const progressError: ProgressError = {
              type: 'subscription',
              message: `Failed to subscribe to job ${jobId}`,
              jobId,
              timestamp: new Date(),
              recoverable: true,
            };
            setError(progressError);
            onError?.(progressError);
          }
        }
      });

      // Start metrics collection if enabled
      if (enableMetrics && !updateIntervalRef.current) {
        updateIntervalRef.current = setInterval(async () => {
          for (const jobId of jobIdList) {
            try {
              const metrics = await progressService.current.getMetrics(jobId);
              setProgressMetrics(prev => {
                const newMap = new Map(prev);
                newMap.set(jobId, metrics);
                return newMap;
              });
            } catch (error) {
              debugLog(`Failed to get metrics for job ${jobId}`, error);
            }
          }
        }, updateInterval);
      }
    },
    [debugLog, handleProgressUpdate, enableMetrics, updateInterval, onError],
  );

  // Stop monitoring jobs
  const stopMonitoring = useCallback(
    (jobIdList?: string[]) => {
      const jobsToStop = jobIdList || Array.from(unsubscribers.current.keys());
      debugLog('Stopping monitoring for jobs', jobsToStop);

      jobsToStop.forEach(jobId => {
        const unsubscribe = unsubscribers.current.get(jobId);
        if (unsubscribe) {
          unsubscribe();
          unsubscribers.current.delete(jobId);
          debugLog(`Unsubscribed from job ${jobId}`);
        }
      });

      if (unsubscribers.current.size === 0) {
        setIsMonitoring(false);
        if (updateIntervalRef.current) {
          clearInterval(updateIntervalRef.current);
          updateIntervalRef.current = null;
        }
      }
    },
    [debugLog],
  );

  // Get progress for specific job
  const getJobProgress = useCallback(
    (jobId: string): JobProgress | undefined => progressStates.get(jobId),
    [progressStates],
  );

  // Get progress history for specific job
  const getJobHistory = useCallback(
    (jobId: string): ProgressUpdate[] => progressHistory.get(jobId) || [],
    [progressHistory],
  );

  // Get metrics for specific job
  const getJobMetrics = useCallback(
    (jobId: string): ProgressMetrics | undefined => progressMetrics.get(jobId),
    [progressMetrics],
  );

  // Calculate overall progress across all jobs
  const overallProgress = useMemo(() => {
    const jobs = Array.from(progressStates.values());
    if (jobs.length === 0) return 0;

    const totalProgress = jobs.reduce((sum, job) => sum + job.progress, 0);
    return totalProgress / jobs.length;
  }, [progressStates]);

  // Get active jobs
  const activeJobs = useMemo(
    () => Array.from(progressStates.values()).filter(job => job.status === 'processing' || job.status === 'pending'),
    [progressStates],
  );

  // Get completed jobs
  const completedJobs = useMemo(
    () => Array.from(progressStates.values()).filter(job => job.status === 'completed'),
    [progressStates],
  );

  // Clear notifications
  const clearNotifications = useCallback(() => {
    setNotifications(prev => ({
      ...prev,
      notifications: [],
    }));
  }, []);

  // Remove specific notification
  const removeNotification = useCallback((notificationId: string) => {
    setNotifications(prev => ({
      ...prev,
      queue: prev.queue.filter((n: ProgressNotification) => n.id !== notificationId),
    }));
  }, []);

  // Reset monitoring state
  const reset = useCallback(() => {
    stopMonitoring();
    setProgressStates(new Map());
    setProgressHistory(new Map());
    setProgressMetrics(new Map());
    setNotifications(prev => ({
      ...prev,
      notifications: [],
    }));
    setError(null);
    lastProgressRef.current.clear();
  }, [stopMonitoring]);

  // Effect to start/stop monitoring based on jobIds
  useEffect(() => {
    if (enableRealTimeUpdates && jobIds.length > 0) {
      startMonitoring(jobIds);
    }

    return () => {
      if (enableRealTimeUpdates) {
        stopMonitoring(jobIds);
      }
    };
  }, [jobIds, enableRealTimeUpdates, startMonitoring, stopMonitoring]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      stopMonitoring();
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    },
    [stopMonitoring],
  );

  return {
    // State
    progressStates: Array.from(progressStates.values()),
    progressHistory,
    progressMetrics,
    notifications,
    isMonitoring,
    error,

    // Computed values
    overallProgress,
    activeJobs,
    completedJobs,
    hasActiveJobs: activeJobs.length > 0,
    hasCompletedJobs: completedJobs.length > 0,
    totalJobs: progressStates.size,

    // Actions
    startMonitoring,
    stopMonitoring,
    reset,
    clearNotifications,
    removeNotification,

    // Getters
    getJobProgress,
    getJobHistory,
    getJobMetrics,

    // Utilities
    calculateOverallProgress: ProgressCalculator.calculateOverallProgress,
    estimateCompletion: ProgressCalculator.estimateCompletion,
    calculateVelocity: ProgressCalculator.calculateVelocity,
  };
};

/**
 * Hook for monitoring a single job
 */
export const useSingleJobProgress = (jobId: string, options: Omit<UseProgressMonitorOptions, 'jobIds'> = {}) => {
  const monitor = useProgressMonitor({ ...options, jobIds: jobId ? [jobId] : [] });

  return {
    ...monitor,
    progress: monitor.getJobProgress(jobId),
    history: monitor.getJobHistory(jobId),
    metrics: monitor.getJobMetrics(jobId),
    isActive: monitor.activeJobs.some(job => job.jobId === jobId),
    isCompleted: monitor.completedJobs.some(job => job.jobId === jobId),
  };
};

/**
 * Hook for progress notifications
 */
export const useProgressNotifications = (
  jobIds: string[],
  options: { enableSound?: boolean; enableDesktop?: boolean } = {},
) => {
  const { enableSound = false, enableDesktop = true } = options;
  const [soundEnabled, setSoundEnabled] = useState(enableSound);

  const monitor = useProgressMonitor({
    jobIds,
    enableNotifications: true,
    onComplete: useCallback(
      (jobId, _result) => {
        // Desktop notification
        if (enableDesktop && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('Job Completed', {
            body: `Transcription job ${jobId} has been completed successfully.`,
            icon: '/icon-48.png',
          });
        }

        // Sound notification
        if (soundEnabled) {
          const audio = new Audio('/notification.mp3');
          audio.play().catch(console.error);
        }
      },
      [enableDesktop, soundEnabled],
    ),
  });

  // Request notification permission
  useEffect(() => {
    if (enableDesktop && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [enableDesktop]);

  return {
    ...monitor,
    soundEnabled,
    setSoundEnabled,
    notificationPermission: 'Notification' in window ? Notification.permission : 'denied',
  };
};

export default useProgressMonitor;
