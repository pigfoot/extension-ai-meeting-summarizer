/**
 * Loading State Manager
 *
 * Loading state coordination and user feedback management during
 * content analysis and feature activation.
 */

import { eventManager } from '../utils/event-manager';

/**
 * Loading state types
 */
export type LoadingState =
  | 'idle'
  | 'initializing'
  | 'analyzing'
  | 'processing'
  | 'loading'
  | 'error'
  | 'completed'
  | 'cancelled';

/**
 * Loading operation types
 */
export type LoadingOperationType =
  | 'content-analysis'
  | 'permission-check'
  | 'feature-activation'
  | 'component-injection'
  | 'data-fetch'
  | 'transcription'
  | 'file-processing'
  | 'authentication';

/**
 * Loading operation configuration
 */
export interface LoadingOperation {
  /** Unique operation ID */
  id: string;
  /** Operation type */
  type: LoadingOperationType;
  /** Operation description */
  description: string;
  /** Current state */
  state: LoadingState;
  /** Progress percentage (0-100) */
  progress: number;
  /** Operation start time */
  startTime: Date;
  /** Estimated duration in milliseconds */
  estimatedDuration?: number;
  /** Current step information */
  currentStep?: LoadingStep;
  /** Error information if failed */
  error?: LoadingError;
  /** Operation metadata */
  metadata: Record<string, unknown>;
  /** Cancellation handler */
  cancelHandler?: () => Promise<void>;
  /** Progress callback */
  onProgress?: (progress: number, step?: LoadingStep) => void;
  /** Completion callback */
  onComplete?: (result: unknown) => void;
  /** Error callback */
  onError?: (error: LoadingError) => void;
}

/**
 * Loading step information
 */
export interface LoadingStep {
  /** Step identifier */
  id: string;
  /** Step name */
  name: string;
  /** Step description */
  description: string;
  /** Step progress (0-100) */
  progress: number;
  /** Step start time */
  startTime: Date;
  /** Estimated step duration */
  estimatedDuration?: number;
  /** Step metadata */
  metadata: Record<string, unknown>;
}

/**
 * Loading error information
 */
export interface LoadingError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Error type */
  type: 'network' | 'permission' | 'timeout' | 'validation' | 'processing' | 'unknown';
  /** Error details */
  details?: Record<string, unknown>;
  /** Recovery suggestions */
  recoverySuggestions: string[];
  /** Retry options */
  retryOptions?: LoadingRetryOptions;
  /** Original error */
  originalError?: Error;
}

/**
 * Loading retry options
 */
export interface LoadingRetryOptions {
  /** Whether retry is available */
  canRetry: boolean;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Current retry count */
  currentRetries: number;
  /** Retry delay in milliseconds */
  retryDelay: number;
  /** Exponential backoff factor */
  backoffFactor: number;
  /** Retry handler */
  retryHandler: () => Promise<void>;
}

/**
 * Loading UI configuration
 */
export interface LoadingUIConfig {
  /** Show progress indicators */
  showProgress: boolean;
  /** Show progress percentage */
  showPercentage: boolean;
  /** Show estimated time */
  showEstimatedTime: boolean;
  /** Show current step */
  showCurrentStep: boolean;
  /** Show cancel button */
  showCancelButton: boolean;
  /** Animation settings */
  animation: {
    type: 'spinner' | 'progress-bar' | 'dots' | 'pulse';
    speed: 'slow' | 'normal' | 'fast';
    color: string;
  };
  /** Position settings */
  position: {
    target: 'body' | 'container' | 'inline';
    placement: 'top' | 'center' | 'bottom' | 'overlay';
    offset: { x: number; y: number };
  };
  /** Theme settings */
  theme: {
    variant: 'light' | 'dark' | 'auto';
    size: 'small' | 'medium' | 'large';
    style: 'minimal' | 'detailed' | 'compact';
  };
}

/**
 * Loading manager statistics
 */
export interface LoadingManagerStats {
  /** Total operations processed */
  totalOperations: number;
  /** Currently active operations */
  activeOperations: number;
  /** Completed operations */
  completedOperations: number;
  /** Failed operations */
  failedOperations: number;
  /** Average operation duration */
  averageDuration: number;
  /** Success rate */
  successRate: number;
  /** Current memory usage */
  memoryUsage: number;
}

/**
 * Loading manager for coordinating loading states and user feedback
 */
export class LoadingManager {
  private operations: Map<string, LoadingOperation> = new Map();
  private operationCount = 0;
  private completedOperations = 0;
  private failedOperations = 0;
  private totalDuration = 0;
  private uiElements: Map<string, HTMLElement> = new Map();
  private defaultConfig: LoadingUIConfig;
  private cleanupHandlers: Set<() => void> = new Set();

  constructor() {
    this.defaultConfig = this.createDefaultUIConfig();
    this.setupEventHandlers();
  }

  /**
   * Start a new loading operation
   */
  startOperation(
    config: Partial<LoadingOperation> & {
      type: LoadingOperationType;
      description: string;
    },
  ): LoadingOperation {
    const operation: LoadingOperation = {
      id: config.id || this.generateOperationId(),
      type: config.type,
      description: config.description,
      state: 'initializing',
      progress: 0,
      startTime: new Date(),
      metadata: config.metadata || {},
      ...config,
    };

    this.operations.set(operation.id, operation);
    this.operationCount++;

    // Show loading UI
    this.showLoadingUI(operation);

    // Start progress tracking
    this.startProgressTracking(operation);

    // Emit operation start event
    eventManager.emitEvent('loading-operation-start', { operation });

    return operation;
  }

  /**
   * Update operation progress
   */
  updateProgress(operationId: string, progress: number, step?: Partial<LoadingStep>): void {
    const operation = this.operations.get(operationId);
    if (!operation) {
      console.warn(`Loading operation not found: ${operationId}`);
      return;
    }

    // Update progress
    operation.progress = Math.max(0, Math.min(100, progress));
    operation.state = progress >= 100 ? 'completed' : 'processing';

    // Update current step
    if (step) {
      operation.currentStep = {
        id: step.id || 'step-' + Date.now(),
        name: step.name || 'Processing',
        description: step.description || '',
        progress: step.progress || progress,
        startTime: step.startTime || new Date(),
        estimatedDuration: step.estimatedDuration,
        metadata: step.metadata || {},
        ...step,
      };
    }

    // Update UI
    this.updateLoadingUI(operation);

    // Call progress callback
    if (operation.onProgress) {
      operation.onProgress(progress, operation.currentStep);
    }

    // Emit progress event
    eventManager.emitEvent('loading-progress', { operation, progress, step });

    // Check if completed
    if (progress >= 100) {
      this.completeOperation(operationId);
    }
  }

  /**
   * Complete an operation
   */
  completeOperation(operationId: string, result?: unknown): void {
    const operation = this.operations.get(operationId);
    if (!operation) {
      console.warn(`Loading operation not found: ${operationId}`);
      return;
    }

    // Update operation state
    operation.state = 'completed';
    operation.progress = 100;

    // Calculate duration
    const duration = Date.now() - operation.startTime.getTime();
    this.totalDuration += duration;
    this.completedOperations++;

    // Hide loading UI
    this.hideLoadingUI(operation);

    // Call completion callback
    if (operation.onComplete) {
      operation.onComplete(result);
    }

    // Emit completion event
    eventManager.emitEvent('loading-operation-complete', { operation, result, duration });

    // Clean up operation
    setTimeout(() => {
      this.operations.delete(operationId);
    }, 5000); // Keep for 5 seconds for debugging
  }

  /**
   * Fail an operation with error
   */
  failOperation(operationId: string, error: Partial<LoadingError>): void {
    const operation = this.operations.get(operationId);
    if (!operation) {
      console.warn(`Loading operation not found: ${operationId}`);
      return;
    }

    // Create error information
    const loadingError: LoadingError = {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'An unknown error occurred',
      type: error.type || 'unknown',
      details: error.details || {},
      recoverySuggestions: error.recoverySuggestions || ['Try again later'],
      retryOptions: error.retryOptions,
      originalError: error.originalError,
    };

    // Update operation state
    operation.state = 'error';
    operation.error = loadingError;
    this.failedOperations++;

    // Update UI to show error
    this.showErrorUI(operation);

    // Call error callback
    if (operation.onError) {
      operation.onError(loadingError);
    }

    // Emit error event
    eventManager.emitEvent('loading-operation-error', { operation, error: loadingError });
  }

  /**
   * Cancel an operation
   */
  async cancelOperation(operationId: string): Promise<void> {
    const operation = this.operations.get(operationId);
    if (!operation) {
      console.warn(`Loading operation not found: ${operationId}`);
      return;
    }

    try {
      // Call cancel handler if available
      if (operation.cancelHandler) {
        await operation.cancelHandler();
      }

      // Update operation state
      operation.state = 'cancelled';

      // Hide loading UI
      this.hideLoadingUI(operation);

      // Emit cancellation event
      eventManager.emitEvent('loading-operation-cancelled', { operation });

      // Clean up operation
      this.operations.delete(operationId);
    } catch (error) {
      console.error('Failed to cancel operation:', error);
      this.failOperation(operationId, {
        code: 'CANCELLATION_FAILED',
        message: 'Failed to cancel operation',
        type: 'processing',
        originalError: error as Error,
      });
    }
  }

  /**
   * Cancel all active operations
   */
  async cancelAllOperations(): Promise<void> {
    const activeOperations = Array.from(this.operations.keys());

    await Promise.all(activeOperations.map(id => this.cancelOperation(id)));
  }

  /**
   * Get operation by ID
   */
  getOperation(operationId: string): LoadingOperation | undefined {
    return this.operations.get(operationId);
  }

  /**
   * Get all active operations
   */
  getActiveOperations(): LoadingOperation[] {
    return Array.from(this.operations.values()).filter(op =>
      ['initializing', 'analyzing', 'processing', 'loading'].includes(op.state),
    );
  }

  /**
   * Get operations by type
   */
  getOperationsByType(type: LoadingOperationType): LoadingOperation[] {
    return Array.from(this.operations.values()).filter(op => op.type === type);
  }

  /**
   * Get loading manager statistics
   */
  getStats(): LoadingManagerStats {
    const activeOps = this.getActiveOperations().length;
    const avgDuration = this.completedOperations > 0 ? this.totalDuration / this.completedOperations : 0;
    const successRate = this.operationCount > 0 ? this.completedOperations / this.operationCount : 0;

    return {
      totalOperations: this.operationCount,
      activeOperations: activeOps,
      completedOperations: this.completedOperations,
      failedOperations: this.failedOperations,
      averageDuration: avgDuration,
      successRate: successRate,
      memoryUsage: this.calculateMemoryUsage(),
    };
  }

  /**
   * Show loading UI for operation
   */
  private showLoadingUI(operation: LoadingOperation): void {
    const config = this.defaultConfig;

    // Create loading element
    const loadingElement = this.createLoadingElement(operation, config);

    // Insert into page
    const targetElement = this.getTargetElement(config.position.target);
    if (targetElement) {
      targetElement.appendChild(loadingElement);
      this.uiElements.set(operation.id, loadingElement);
    }
  }

  /**
   * Update loading UI
   */
  private updateLoadingUI(operation: LoadingOperation): void {
    const element = this.uiElements.get(operation.id);
    if (!element) return;

    // Update progress
    const progressBar = element.querySelector('.loading-progress') as HTMLElement;
    if (progressBar) {
      progressBar.style.width = `${operation.progress}%`;
    }

    // Update percentage
    const percentageElement = element.querySelector('.loading-percentage') as HTMLElement;
    if (percentageElement) {
      percentageElement.textContent = `${Math.round(operation.progress)}%`;
    }

    // Update current step
    const stepElement = element.querySelector('.loading-step') as HTMLElement;
    if (stepElement && operation.currentStep) {
      stepElement.textContent = operation.currentStep.name;
    }

    // Update estimated time
    const timeElement = element.querySelector('.loading-time') as HTMLElement;
    if (timeElement && operation.estimatedDuration) {
      const elapsed = Date.now() - operation.startTime.getTime();
      const remaining = Math.max(0, operation.estimatedDuration - elapsed);
      timeElement.textContent = this.formatDuration(remaining);
    }
  }

  /**
   * Show error UI
   */
  private showErrorUI(operation: LoadingOperation): void {
    const element = this.uiElements.get(operation.id);
    if (!element || !operation.error) return;

    // Replace loading content with error content
    element.innerHTML = `
      <div class="loading-error">
        <div class="error-icon">⚠️</div>
        <div class="error-message">${operation.error.message}</div>
        <div class="error-suggestions">
          ${operation.error.recoverySuggestions
            .map(suggestion => `<div class="suggestion">${suggestion}</div>`)
            .join('')}
        </div>
        ${operation.error.retryOptions?.canRetry ? '<button class="retry-button">Retry</button>' : ''}
        <button class="dismiss-button">Dismiss</button>
      </div>
    `;

    // Add event listeners
    const retryButton = element.querySelector('.retry-button');
    if (retryButton && operation.error.retryOptions) {
      retryButton.addEventListener('click', () => {
        if (operation.error?.retryOptions?.retryHandler) {
          operation.error.retryOptions.retryHandler();
        }
      });
    }

    const dismissButton = element.querySelector('.dismiss-button');
    if (dismissButton) {
      dismissButton.addEventListener('click', () => {
        this.hideLoadingUI(operation);
      });
    }
  }

  /**
   * Hide loading UI
   */
  private hideLoadingUI(operation: LoadingOperation): void {
    const element = this.uiElements.get(operation.id);
    if (element && element.parentNode) {
      element.parentNode.removeChild(element);
      this.uiElements.delete(operation.id);
    }
  }

  /**
   * Create loading element
   */
  private createLoadingElement(operation: LoadingOperation, config: LoadingUIConfig): HTMLElement {
    const element = document.createElement('div');
    element.className = `loading-container loading-${operation.type}`;
    element.setAttribute('data-operation-id', operation.id);

    const html = `
      <div class="loading-content">
        <div class="loading-animation ${config.animation.type}"></div>
        <div class="loading-text">
          <div class="loading-description">${operation.description}</div>
          ${config.showCurrentStep ? '<div class="loading-step"></div>' : ''}
        </div>
        ${
          config.showProgress
            ? `
          <div class="loading-progress-container">
            <div class="loading-progress-bar">
              <div class="loading-progress" style="width: ${operation.progress}%"></div>
            </div>
            ${
              config.showPercentage
                ? `
              <div class="loading-percentage">${Math.round(operation.progress)}%</div>
            `
                : ''
            }
          </div>
        `
            : ''
        }
        ${config.showEstimatedTime ? '<div class="loading-time"></div>' : ''}
        ${
          config.showCancelButton
            ? `
          <button class="loading-cancel">Cancel</button>
        `
            : ''
        }
      </div>
    `;

    element.innerHTML = html;

    // Add styles
    this.applyLoadingStyles(element, config);

    // Add cancel handler
    if (config.showCancelButton) {
      const cancelButton = element.querySelector('.loading-cancel') as HTMLButtonElement;
      if (cancelButton) {
        cancelButton.addEventListener('click', () => {
          this.cancelOperation(operation.id);
        });
      }
    }

    return element;
  }

  /**
   * Apply loading styles
   */
  private applyLoadingStyles(element: HTMLElement, config: LoadingUIConfig): void {
    const styles = `
      .loading-container {
        position: ${config.position.placement === 'overlay' ? 'fixed' : 'relative'};
        z-index: 10000;
        background: ${config.theme.variant === 'dark' ? '#333' : '#fff'};
        border-radius: 8px;
        padding: 16px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: ${config.theme.size === 'small' ? '12px' : config.theme.size === 'large' ? '16px' : '14px'};
        color: ${config.theme.variant === 'dark' ? '#fff' : '#333'};
        max-width: 300px;
        min-width: 200px;
      }

      .loading-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
      }

      .loading-animation.spinner {
        width: 24px;
        height: 24px;
        border: 2px solid #e0e0e0;
        border-top: 2px solid ${config.animation.color};
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      .loading-animation.dots::after {
        content: '';
        animation: dots 1.5s infinite;
      }

      .loading-text {
        text-align: center;
      }

      .loading-description {
        font-weight: 500;
        margin-bottom: 4px;
      }

      .loading-step {
        font-size: 0.9em;
        opacity: 0.7;
      }

      .loading-progress-container {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .loading-progress-bar {
        flex: 1;
        height: 6px;
        background: #e0e0e0;
        border-radius: 3px;
        overflow: hidden;
      }

      .loading-progress {
        height: 100%;
        background: ${config.animation.color};
        transition: width 0.3s ease;
      }

      .loading-percentage {
        font-size: 0.8em;
        min-width: 35px;
        text-align: right;
      }

      .loading-time {
        font-size: 0.8em;
        opacity: 0.7;
      }

      .loading-cancel {
        background: transparent;
        border: 1px solid #ccc;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9em;
      }

      .loading-cancel:hover {
        background: #f5f5f5;
      }

      .loading-error {
        text-align: center;
      }

      .error-icon {
        font-size: 2em;
        margin-bottom: 8px;
      }

      .error-message {
        margin-bottom: 12px;
        font-weight: 500;
      }

      .error-suggestions {
        margin-bottom: 12px;
        font-size: 0.9em;
        opacity: 0.8;
      }

      .suggestion {
        margin-bottom: 4px;
      }

      .retry-button, .dismiss-button {
        background: ${config.animation.color};
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        margin: 0 4px;
        font-size: 0.9em;
      }

      .dismiss-button {
        background: #666;
      }

      .retry-button:hover {
        opacity: 0.9;
      }

      .dismiss-button:hover {
        opacity: 0.9;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      @keyframes dots {
        0%, 20% { content: ''; }
        40% { content: '.'; }
        60% { content: '..'; }
        80%, 100% { content: '...'; }
      }
    `;

    // Add styles to head if not already added
    if (!document.querySelector('#loading-manager-styles')) {
      const styleElement = document.createElement('style');
      styleElement.id = 'loading-manager-styles';
      styleElement.textContent = styles;
      document.head.appendChild(styleElement);
    }
  }

  /**
   * Get target element for UI insertion
   */
  private getTargetElement(target: LoadingUIConfig['position']['target']): Element | null {
    switch (target) {
      case 'body':
        return document.body;
      case 'container':
        return (
          document.querySelector('[data-automationid="contentScrollRegion"]') ||
          document.querySelector('main') ||
          document.body
        );
      case 'inline':
        return (
          document.querySelector('.meeting-controls') ||
          document.querySelector('[data-automationid="CommandBar"]') ||
          document.body
        );
      default:
        return document.body;
    }
  }

  /**
   * Start progress tracking for operation
   */
  private startProgressTracking(operation: LoadingOperation): void {
    // Set up automatic progress updates if no manual updates
    const progressInterval = setInterval(() => {
      if (operation.state === 'completed' || operation.state === 'error' || operation.state === 'cancelled') {
        clearInterval(progressInterval);
        return;
      }

      // Simulate progress if no updates received
      if (operation.progress < 90) {
        const elapsed = Date.now() - operation.startTime.getTime();
        const estimatedTotal = operation.estimatedDuration || 10000; // 10 seconds default
        const estimatedProgress = Math.min(90, (elapsed / estimatedTotal) * 100);

        if (estimatedProgress > operation.progress) {
          this.updateProgress(operation.id, estimatedProgress);
        }
      }
    }, 500);

    // Clean up interval
    this.cleanupHandlers.add(() => clearInterval(progressInterval));
  }

  /**
   * Format duration for display
   */
  private formatDuration(milliseconds: number): string {
    const seconds = Math.ceil(milliseconds / 1000);

    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const remainingMinutes = Math.floor((seconds % 3600) / 60);
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Calculate memory usage
   */
  private calculateMemoryUsage(): number {
    // Estimate memory usage based on active operations
    const activeOps = this.getActiveOperations().length;
    const uiElements = this.uiElements.size;

    // Rough estimation: 1KB per operation + 2KB per UI element
    return activeOps * 1024 + uiElements * 2048;
  }

  /**
   * Create default UI configuration
   */
  private createDefaultUIConfig(): LoadingUIConfig {
    return {
      showProgress: true,
      showPercentage: true,
      showEstimatedTime: true,
      showCurrentStep: true,
      showCancelButton: true,
      animation: {
        type: 'spinner',
        speed: 'normal',
        color: '#0078d4',
      },
      position: {
        target: 'container',
        placement: 'center',
        offset: { x: 0, y: 0 },
      },
      theme: {
        variant: 'auto',
        size: 'medium',
        style: 'detailed',
      },
    };
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Monitor for page navigation
    eventManager.addEventHandler('page-navigation', () => {
      this.cancelAllOperations();
    });

    // Monitor for visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Pause operations when page is hidden
        this.pauseOperations();
      } else {
        // Resume operations when page is visible
        this.resumeOperations();
      }
    });
  }

  /**
   * Pause all operations
   */
  private pauseOperations(): void {
    const activeOps = this.getActiveOperations();
    activeOps.forEach(op => {
      if (op.state === 'processing') {
        op.state = 'idle';
      }
    });
  }

  /**
   * Resume all operations
   */
  private resumeOperations(): void {
    const pausedOps = Array.from(this.operations.values()).filter(op => op.state === 'idle');

    pausedOps.forEach(op => {
      op.state = 'processing';
    });
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // Cancel all operations
    this.cancelAllOperations();

    // Clean up UI elements
    this.uiElements.forEach(element => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });
    this.uiElements.clear();

    // Clean up handlers
    this.cleanupHandlers.forEach(handler => handler());
    this.cleanupHandlers.clear();

    // Clear operations
    this.operations.clear();

    // Remove styles
    const styleElement = document.querySelector('#loading-manager-styles');
    if (styleElement) {
      styleElement.remove();
    }
  }
}

// Export singleton instance
export const loadingManager = new LoadingManager();
