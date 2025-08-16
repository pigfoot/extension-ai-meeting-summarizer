/**
 * Job Controls Component
 *
 * Implements pause, resume, cancel controls for active jobs with confirmation dialogs
 * and state management. Provides comprehensive job management controls in the popup interface.
 */

import { cn } from '@extension/ui';
import { useState } from 'react';
import type { JobDisplayInfo } from '../types/popup-state';
import type React from 'react';

/**
 * Available job actions
 */
type JobAction = 'pause' | 'resume' | 'cancel' | 'retry';

/**
 * Job controls component props
 */
interface JobControlsProps {
  /** Job to control */
  job: JobDisplayInfo;
  /** Action handler */
  onAction?: (action: JobAction, jobId: string) => Promise<void>;
  /** Custom class name */
  className?: string;
  /** Whether component is in compact mode */
  compact?: boolean;
  /** Whether to show confirmation dialogs */
  showConfirmation?: boolean;
  /** Loading states for actions */
  loadingStates?: Partial<Record<JobAction, boolean>>;
  /** Disabled actions */
  disabledActions?: JobAction[];
}

/**
 * Confirmation dialog component props
 */
interface ConfirmationDialogProps {
  /** Whether dialog is open */
  isOpen: boolean;
  /** Dialog title */
  title: string;
  /** Dialog message */
  message: string;
  /** Confirm button text */
  confirmText: string;
  /** Cancel button text */
  cancelText?: string;
  /** Confirmation type for styling */
  type?: 'warning' | 'danger' | 'info';
  /** Whether action is loading */
  isLoading?: boolean;
  /** Confirm handler */
  onConfirm: () => void;
  /** Cancel handler */
  onCancel: () => void;
}

/**
 * Action button configuration
 */
interface ActionButtonConfig {
  action: JobAction;
  label: string;
  icon: string;
  variant: 'primary' | 'secondary' | 'warning' | 'danger';
  loadingText: string;
  confirmationTitle: string;
  confirmationMessage: string;
  confirmText: string;
}

/**
 * Confirmation dialog component
 */
const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText,
  cancelText = 'Cancel',
  type = 'warning',
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const getTypeStyles = () => {
    switch (type) {
      case 'danger':
        return {
          headerColor: 'text-red-600',
          confirmButton: 'bg-red-600 hover:bg-red-700 text-white',
          icon: '⚠️',
        };
      case 'warning':
        return {
          headerColor: 'text-yellow-600',
          confirmButton: 'bg-yellow-600 hover:bg-yellow-700 text-white',
          icon: '⚠️',
        };
      case 'info':
        return {
          headerColor: 'text-blue-600',
          confirmButton: 'bg-blue-600 hover:bg-blue-700 text-white',
          icon: 'ℹ️',
        };
      default:
        return {
          headerColor: 'text-gray-600',
          confirmButton: 'bg-gray-600 hover:bg-gray-700 text-white',
          icon: '❓',
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">{styles.icon}</span>
            <h3 className={cn('text-lg font-semibold', styles.headerColor)}>{title}</h3>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-4">
          <p className="text-gray-700">{message}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-4 py-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={cn(
              'rounded px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
              styles.confirmButton,
            )}>
            {isLoading ? (
              <span className="flex items-center gap-1">
                <span className="animate-spin">⏳</span>
                <span>Processing...</span>
              </span>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Action button component
 */
const ActionButton: React.FC<{
  config: ActionButtonConfig;
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  compact?: boolean;
}> = ({ config, onClick, disabled = false, isLoading = false, compact = false }) => {
  const getVariantStyles = () => {
    switch (config.variant) {
      case 'primary':
        return 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600';
      case 'secondary':
        return 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300';
      case 'warning':
        return 'bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500';
      case 'danger':
        return 'bg-red-600 hover:bg-red-700 text-white border-red-600';
      default:
        return 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300';
    }
  };

  const buttonSize = compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm';

  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={cn(
        'inline-flex items-center gap-1.5 rounded border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        getVariantStyles(),
        buttonSize,
      )}
      title={config.label}>
      <span>{config.icon}</span>
      {!compact && <span>{isLoading ? config.loadingText : config.label}</span>}
      {isLoading && <span className="ml-1 animate-spin">⏳</span>}
    </button>
  );
};

/**
 * Get action button configurations
 */
const getActionConfigs = (job: JobDisplayInfo): ActionButtonConfig[] => {
  const configs: ActionButtonConfig[] = [];

  // Pause action for processing jobs
  if (job.status === 'processing' && job.canPause) {
    configs.push({
      action: 'pause',
      label: 'Pause',
      icon: '⏸️',
      variant: 'warning',
      loadingText: 'Pausing...',
      confirmationTitle: 'Pause Transcription Job',
      confirmationMessage: `Are you sure you want to pause the transcription for "${job.meetingTitle}"? You can resume it later.`,
      confirmText: 'Pause Job',
    });
  }

  // Resume action for paused jobs
  if (job.status === 'paused') {
    configs.push({
      action: 'resume',
      label: 'Resume',
      icon: '▶️',
      variant: 'primary',
      loadingText: 'Resuming...',
      confirmationTitle: 'Resume Transcription Job',
      confirmationMessage: `Resume the transcription for "${job.meetingTitle}"?`,
      confirmText: 'Resume Job',
    });
  }

  // Cancel action for active jobs
  if ((job.status === 'processing' || job.status === 'paused' || job.status === 'idle') && job.canCancel) {
    configs.push({
      action: 'cancel',
      label: 'Cancel',
      icon: '🗙',
      variant: 'danger',
      loadingText: 'Cancelling...',
      confirmationTitle: 'Cancel Transcription Job',
      confirmationMessage: `Are you sure you want to cancel the transcription for "${job.meetingTitle}"? This action cannot be undone and you'll lose any progress.`,
      confirmText: 'Cancel Job',
    });
  }

  // Retry action for failed jobs
  if (job.status === 'failed') {
    configs.push({
      action: 'retry',
      label: 'Retry',
      icon: '🔄',
      variant: 'primary',
      loadingText: 'Retrying...',
      confirmationTitle: 'Retry Transcription Job',
      confirmationMessage: `Retry the transcription for "${job.meetingTitle}"?`,
      confirmText: 'Retry Job',
    });
  }

  return configs;
};

/**
 * Main JobControls component
 */
export const JobControls: React.FC<JobControlsProps> = ({
  job,
  onAction,
  className,
  compact = false,
  showConfirmation = true,
  loadingStates = {},
  disabledActions = [],
}) => {
  const [confirmationDialog, setConfirmationDialog] = useState<{
    isOpen: boolean;
    config?: ActionButtonConfig;
  }>({ isOpen: false });

  const actionConfigs = getActionConfigs(job);
  const availableConfigs = actionConfigs.filter(config => !disabledActions.includes(config.action));

  const handleActionClick = (config: ActionButtonConfig) => {
    if (showConfirmation && (config.action === 'cancel' || config.action === 'pause')) {
      setConfirmationDialog({ isOpen: true, config });
    } else {
      executeAction(config.action);
    }
  };

  const executeAction = async (action: JobAction) => {
    try {
      await onAction?.(action, job.jobId);
      setConfirmationDialog({ isOpen: false });
    } catch (error) {
      console.error(`Failed to ${action} job:`, error);
      // Keep dialog open on error so user can retry
    }
  };

  const handleConfirmAction = () => {
    if (confirmationDialog.config) {
      executeAction(confirmationDialog.config.action);
    }
  };

  const handleCancelConfirmation = () => {
    setConfirmationDialog({ isOpen: false });
  };

  // Don't render if no actions are available
  if (availableConfigs.length === 0) {
    return null;
  }

  const containerClasses = compact ? 'flex gap-1' : 'flex gap-2';

  return (
    <>
      <div className={cn(containerClasses, className)}>
        {availableConfigs.map(config => (
          <ActionButton
            key={config.action}
            config={config}
            onClick={() => handleActionClick(config)}
            disabled={disabledActions.includes(config.action)}
            isLoading={loadingStates[config.action]}
            compact={compact}
          />
        ))}
      </div>

      {/* Confirmation Dialog */}
      {confirmationDialog.config && (
        <ConfirmationDialog
          isOpen={confirmationDialog.isOpen}
          title={confirmationDialog.config.confirmationTitle}
          message={confirmationDialog.config.confirmationMessage}
          confirmText={confirmationDialog.config.confirmText}
          type={confirmationDialog.config.variant === 'danger' ? 'danger' : 'warning'}
          isLoading={loadingStates[confirmationDialog.config.action]}
          onConfirm={handleConfirmAction}
          onCancel={handleCancelConfirmation}
        />
      )}
    </>
  );
};

/**
 * Bulk job controls component for managing multiple jobs
 */
interface BulkJobControlsProps {
  /** Jobs to control */
  jobs: JobDisplayInfo[];
  /** Selected job IDs */
  selectedJobIds?: string[];
  /** Bulk action handler */
  onBulkAction?: (action: JobAction, jobIds: string[]) => Promise<void>;
  /** Custom class name */
  className?: string;
  /** Whether component is in compact mode */
  compact?: boolean;
  /** Loading states for bulk actions */
  loadingStates?: Partial<Record<JobAction, boolean>>;
}

export const BulkJobControls: React.FC<BulkJobControlsProps> = ({
  jobs,
  selectedJobIds = [],
  onBulkAction,
  className,
  compact = false,
  loadingStates = {},
}) => {
  const [confirmationDialog, setConfirmationDialog] = useState<{
    isOpen: boolean;
    action?: JobAction;
    title?: string;
    message?: string;
  }>({ isOpen: false });

  const selectedJobs = jobs.filter(job => selectedJobIds.includes(job.jobId));

  // Determine available bulk actions
  const canPauseAll = selectedJobs.some(job => job.status === 'processing' && job.canPause);
  const canResumeAll = selectedJobs.some(job => job.status === 'paused');
  const canCancelAll = selectedJobs.some(
    job => (job.status === 'processing' || job.status === 'paused' || job.status === 'idle') && job.canCancel,
  );

  const handleBulkAction = (action: JobAction) => {
    const actionableJobs = selectedJobs.filter(job => {
      switch (action) {
        case 'pause':
          return job.status === 'processing' && job.canPause;
        case 'resume':
          return job.status === 'paused';
        case 'cancel':
          return (job.status === 'processing' || job.status === 'paused' || job.status === 'idle') && job.canCancel;
        default:
          return false;
      }
    });

    if (actionableJobs.length === 0) return;

    const titles = actionableJobs.map(job => job.meetingTitle).join(', ');

    setConfirmationDialog({
      isOpen: true,
      action,
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} Multiple Jobs`,
      message: `Are you sure you want to ${action} ${actionableJobs.length} job(s)? This will affect: ${titles}`,
    });
  };

  const executeBulkAction = async () => {
    if (!confirmationDialog.action) return;

    const actionableJobIds = selectedJobs
      .filter(job => {
        switch (confirmationDialog.action) {
          case 'pause':
            return job.status === 'processing' && job.canPause;
          case 'resume':
            return job.status === 'paused';
          case 'cancel':
            return (job.status === 'processing' || job.status === 'paused' || job.status === 'idle') && job.canCancel;
          default:
            return false;
        }
      })
      .map(job => job.jobId);

    try {
      await onBulkAction?.(confirmationDialog.action, actionableJobIds);
      setConfirmationDialog({ isOpen: false });
    } catch (error) {
      console.error(`Failed to ${confirmationDialog.action} jobs:`, error);
    }
  };

  if (selectedJobIds.length === 0) {
    return null;
  }

  const buttonSize = compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm';

  return (
    <>
      <div className={cn('flex items-center gap-2 rounded border border-blue-200 bg-blue-50 p-2', className)}>
        <span className={cn('text-blue-700', compact ? 'text-xs' : 'text-sm')}>{selectedJobIds.length} selected</span>
        <div className="flex gap-1">
          {canPauseAll && (
            <button
              onClick={() => handleBulkAction('pause')}
              disabled={loadingStates.pause}
              className={cn(
                'rounded border border-yellow-500 bg-yellow-500 text-white hover:bg-yellow-600 disabled:opacity-50',
                buttonSize,
              )}>
              ⏸️ {!compact && 'Pause All'}
            </button>
          )}
          {canResumeAll && (
            <button
              onClick={() => handleBulkAction('resume')}
              disabled={loadingStates.resume}
              className={cn(
                'rounded border border-blue-600 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50',
                buttonSize,
              )}>
              ▶️ {!compact && 'Resume All'}
            </button>
          )}
          {canCancelAll && (
            <button
              onClick={() => handleBulkAction('cancel')}
              disabled={loadingStates.cancel}
              className={cn(
                'rounded border border-red-600 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50',
                buttonSize,
              )}>
              🗙 {!compact && 'Cancel All'}
            </button>
          )}
        </div>
      </div>

      {/* Bulk Confirmation Dialog */}
      {confirmationDialog.action && (
        <ConfirmationDialog
          isOpen={confirmationDialog.isOpen}
          title={confirmationDialog.title || ''}
          message={confirmationDialog.message || ''}
          confirmText={`${confirmationDialog.action.charAt(0).toUpperCase() + confirmationDialog.action.slice(1)} Jobs`}
          type={confirmationDialog.action === 'cancel' ? 'danger' : 'warning'}
          isLoading={loadingStates[confirmationDialog.action]}
          onConfirm={executeBulkAction}
          onCancel={() => setConfirmationDialog({ isOpen: false })}
        />
      )}
    </>
  );
};
