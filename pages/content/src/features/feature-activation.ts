/**
 * Feature Activation Manager
 *
 * Context-aware feature activation based on content analysis with
 * dynamic feature enablement and resource management.
 */

import { contentAnalyzer } from '../analysis/content-analyzer';
import { backgroundCoordinator } from '../communication/background-coordinator';
import { componentRegistry } from '../components/ComponentRegistry';
import { eventManager } from '../utils/event-manager';
import type { ContentAnalysisResult, ContentChangeEvent } from '../analysis/content-analyzer';

/**
 * Feature types that can be activated
 */
export type FeatureType =
  | 'transcription.button'
  | 'transcription.controls'
  | 'progress.indicator'
  | 'status.panel'
  | 'meeting.detector'
  | 'content.extractor'
  | 'recording.helper'
  | 'ui.overlay';

/**
 * Feature activation context
 */
export interface FeatureActivationContext {
  /** Content analysis result */
  contentAnalysis: ContentAnalysisResult;
  /** User preferences */
  userPreferences: {
    autoActivate: boolean;
    enabledFeatures: FeatureType[];
    disabledFeatures: FeatureType[];
    adaptiveMode: boolean;
  };
  /** Page context */
  pageContext: {
    url: string;
    platform: string;
    meetingActive: boolean;
    hasPermissions: boolean;
  };
  /** Resource constraints */
  resourceConstraints: {
    memoryLimit: number;
    performanceMode: 'low' | 'medium' | 'high';
    batteryLevel?: number;
  };
}

/**
 * Feature configuration
 */
export interface FeatureConfig {
  /** Feature identifier */
  id: string;
  /** Feature type */
  type: FeatureType;
  /** Feature priority */
  priority: 'low' | 'medium' | 'high' | 'critical';
  /** Activation conditions */
  activationConditions: {
    minMeetingConfidence: number;
    requiredIndicators: string[];
    platformCompatibility: string[];
    contentTypes: string[];
  };
  /** Resource requirements */
  resourceRequirements: {
    memoryUsage: number;
    cpuIntensive: boolean;
    networkAccess: boolean;
    permissions: string[];
  };
  /** Dependencies */
  dependencies: {
    requiredFeatures: FeatureType[];
    conflictingFeatures: FeatureType[];
    optionalFeatures: FeatureType[];
  };
  /** Component configuration */
  componentConfig?: {
    componentId: string;
    props: Record<string, unknown>;
    injectionPoint?: string;
  };
}

/**
 * Feature activation result
 */
export interface FeatureActivationResult {
  /** Whether activation was successful */
  success: boolean;
  /** Activated feature ID */
  featureId: string;
  /** Feature type */
  featureType: FeatureType;
  /** Activation timestamp */
  timestamp: Date;
  /** Error information if activation failed */
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  /** Resource usage */
  resourceUsage: {
    memory: number;
    cpu: number;
    components: number;
  };
  /** Activation context */
  context: FeatureActivationContext;
}

/**
 * Feature state
 */
export interface FeatureState {
  /** Feature configuration */
  config: FeatureConfig;
  /** Current status */
  status: 'inactive' | 'activating' | 'active' | 'deactivating' | 'error';
  /** Activation result */
  activationResult?: FeatureActivationResult;
  /** Associated component IDs */
  componentIds: string[];
  /** Event listeners */
  eventListeners: string[];
  /** Resource usage */
  resourceUsage: {
    memory: number;
    cpu: number;
    network: number;
  };
  /** Activation timestamp */
  activatedAt?: Date;
  /** Last update timestamp */
  lastUpdated: Date;
  /** Error information */
  error?: Error;
}

/**
 * Activation manager configuration
 */
export interface ActivationConfig {
  /** Enable automatic feature activation */
  autoActivation: boolean;
  /** Activation delay in milliseconds */
  activationDelay: number;
  /** Resource monitoring enabled */
  enableResourceMonitoring: boolean;
  /** Maximum concurrent features */
  maxConcurrentFeatures: number;
  /** Performance optimization mode */
  performanceMode: 'conservative' | 'balanced' | 'aggressive';
  /** Feature update strategy */
  updateStrategy: 'immediate' | 'batched' | 'throttled';
  /** Debug logging enabled */
  enableDebugLogging: boolean;
}

/**
 * Activation manager statistics
 */
export interface ActivationStatistics {
  /** Total features activated */
  totalActivated: number;
  /** Currently active features */
  activeFeatures: number;
  /** Activation success rate */
  successRate: number;
  /** Average activation time */
  averageActivationTime: number;
  /** Resource usage */
  resourceUsage: {
    totalMemory: number;
    totalCpu: number;
    totalComponents: number;
  };
  /** Features by type */
  featuresByType: Record<FeatureType, number>;
  /** Error rate by feature type */
  errorRates: Record<FeatureType, number>;
  /** Last activation timestamp */
  lastActivation: Date;
}

/**
 * Feature activation manager
 */
export class FeatureActivationManager {
  private static instance: FeatureActivationManager;
  private config: ActivationConfig;
  private featureConfigs: Map<FeatureType, FeatureConfig> = new Map();
  private featureStates: Map<string, FeatureState> = new Map();
  private activationQueue: Array<{ feature: FeatureConfig; context: FeatureActivationContext }> = [];
  private statistics: ActivationStatistics;
  private activationCallbacks: Array<(result: FeatureActivationResult) => void> = [];
  private contentChangeUnsubscribe: (() => void) | null = null;
  private resourceMonitorInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<ActivationConfig> = {}) {
    this.config = {
      autoActivation: true,
      activationDelay: 1000,
      enableResourceMonitoring: true,
      maxConcurrentFeatures: 10,
      performanceMode: 'balanced',
      updateStrategy: 'throttled',
      enableDebugLogging: false,
      ...config,
    };

    this.statistics = {
      totalActivated: 0,
      activeFeatures: 0,
      successRate: 0,
      averageActivationTime: 0,
      resourceUsage: {
        totalMemory: 0,
        totalCpu: 0,
        totalComponents: 0,
      },
      featuresByType: {} as Record<FeatureType, number>,
      errorRates: {} as Record<FeatureType, number>,
      lastActivation: new Date(),
    };

    this.initializeFeatures();
    this.setupContentMonitoring();
    this.startResourceMonitoring();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<ActivationConfig>): FeatureActivationManager {
    if (!FeatureActivationManager.instance) {
      FeatureActivationManager.instance = new FeatureActivationManager(config);
    }
    return FeatureActivationManager.instance;
  }

  /**
   * Register feature configuration
   */
  registerFeature(featureConfig: FeatureConfig): void {
    this.featureConfigs.set(featureConfig.type, featureConfig);
    this.log(`Feature registered: ${featureConfig.type}`);
  }

  /**
   * Activate feature manually
   */
  async activateFeature(
    featureType: FeatureType,
    context?: Partial<FeatureActivationContext>,
  ): Promise<FeatureActivationResult> {
    const featureConfig = this.featureConfigs.get(featureType);
    if (!featureConfig) {
      throw new Error(`Feature not registered: ${featureType}`);
    }

    const activationContext = context
      ? { ...(await this.createActivationContext()), ...context }
      : await this.createActivationContext();

    return this.performActivation(featureConfig, activationContext);
  }

  /**
   * Deactivate feature
   */
  async deactivateFeature(featureId: string): Promise<boolean> {
    const featureState = this.featureStates.get(featureId);
    if (!featureState || featureState.status !== 'active') {
      return false;
    }

    try {
      featureState.status = 'deactivating';

      // Cleanup components
      for (const componentId of featureState.componentIds) {
        await componentRegistry.unregisterComponent(componentId);
      }

      // Cleanup event listeners
      featureState.eventListeners.forEach(listenerId => {
        eventManager.removeEventListener(listenerId);
      });

      // Remove feature state
      this.featureStates.delete(featureId);

      this.updateStatistics();
      this.log(`Feature deactivated: ${featureId}`);

      return true;
    } catch (error) {
      featureState.status = 'error';
      featureState.error = error instanceof Error ? error : new Error('Deactivation failed');
      return false;
    }
  }

  /**
   * Get active features
   */
  getActiveFeatures(): FeatureState[] {
    return Array.from(this.featureStates.values()).filter(state => state.status === 'active');
  }

  /**
   * Get feature state
   */
  getFeatureState(featureId: string): FeatureState | null {
    return this.featureStates.get(featureId) || null;
  }

  /**
   * Check if feature is active
   */
  isFeatureActive(featureType: FeatureType): boolean {
    return Array.from(this.featureStates.values()).some(
      state => state.config.type === featureType && state.status === 'active',
    );
  }

  /**
   * Register activation callback
   */
  onFeatureActivation(callback: (result: FeatureActivationResult) => void): () => void {
    this.activationCallbacks.push(callback);

    return () => {
      const index = this.activationCallbacks.indexOf(callback);
      if (index > -1) {
        this.activationCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get activation statistics
   */
  getStatistics(): ActivationStatistics {
    this.updateStatistics();
    return { ...this.statistics };
  }

  /**
   * Initialize default features
   */
  private initializeFeatures(): void {
    const defaultFeatures: FeatureConfig[] = [
      {
        id: 'transcription-button',
        type: 'transcription.button',
        priority: 'high',
        activationConditions: {
          minMeetingConfidence: 0.7,
          requiredIndicators: ['hasVideo', 'hasAudio'],
          platformCompatibility: ['teams', 'sharepoint'],
          contentTypes: ['meeting.video', 'meeting.audio'],
        },
        resourceRequirements: {
          memoryUsage: 1024, // 1KB
          cpuIntensive: false,
          networkAccess: false,
          permissions: [],
        },
        dependencies: {
          requiredFeatures: [],
          conflictingFeatures: [],
          optionalFeatures: ['progress.indicator'],
        },
        componentConfig: {
          componentId: 'transcription-button',
          props: {},
          injectionPoint: 'meeting-controls',
        },
      },
      {
        id: 'progress-indicator',
        type: 'progress.indicator',
        priority: 'medium',
        activationConditions: {
          minMeetingConfidence: 0.8,
          requiredIndicators: ['hasVideo'],
          platformCompatibility: ['teams', 'sharepoint'],
          contentTypes: ['meeting.video'],
        },
        resourceRequirements: {
          memoryUsage: 2048, // 2KB
          cpuIntensive: false,
          networkAccess: true,
          permissions: [],
        },
        dependencies: {
          requiredFeatures: ['transcription.button'],
          conflictingFeatures: [],
          optionalFeatures: [],
        },
        componentConfig: {
          componentId: 'progress-indicator',
          props: {},
          injectionPoint: 'meeting-ui',
        },
      },
      {
        id: 'status-panel',
        type: 'status.panel',
        priority: 'low',
        activationConditions: {
          minMeetingConfidence: 0.6,
          requiredIndicators: [],
          platformCompatibility: ['teams', 'sharepoint', 'generic'],
          contentTypes: ['meeting.video', 'meeting.audio', 'meeting.recording'],
        },
        resourceRequirements: {
          memoryUsage: 4096, // 4KB
          cpuIntensive: false,
          networkAccess: false,
          permissions: [],
        },
        dependencies: {
          requiredFeatures: [],
          conflictingFeatures: [],
          optionalFeatures: ['transcription.button'],
        },
        componentConfig: {
          componentId: 'status-panel',
          props: {},
          injectionPoint: 'page-overlay',
        },
      },
    ];

    defaultFeatures.forEach(feature => {
      this.registerFeature(feature);
    });
  }

  /**
   * Setup content monitoring
   */
  private setupContentMonitoring(): void {
    if (!this.config.autoActivation) {
      return;
    }

    this.contentChangeUnsubscribe = contentAnalyzer.onContentChange(event => {
      this.handleContentChange(event);
    });
  }

  /**
   * Handle content change
   */
  private async handleContentChange(event: ContentChangeEvent): Promise<void> {
    if (event.severity === 'minor') {
      return; // Ignore minor changes
    }

    try {
      const context = await this.createActivationContext(event.analysis);
      await this.evaluateFeatureActivation(context);
    } catch (error) {
      this.log(`Content change handling error: ${error}`);
    }
  }

  /**
   * Create activation context
   */
  private async createActivationContext(contentAnalysis?: ContentAnalysisResult): Promise<FeatureActivationContext> {
    const analysis = contentAnalysis || (await contentAnalyzer.analyzeContent());

    // Get user preferences (would normally come from storage)
    const userPreferences = {
      autoActivate: true,
      enabledFeatures: Array.from(this.featureConfigs.keys()),
      disabledFeatures: [] as FeatureType[],
      adaptiveMode: true,
    };

    // Get page context
    const pageContext = {
      url: window.location.href,
      platform: analysis.context.platform,
      meetingActive: analysis.context.meetingState === 'active',
      hasPermissions: true, // Would check actual permissions
    };

    // Get resource constraints
    const resourceConstraints = {
      memoryLimit: 50 * 1024 * 1024, // 50MB
      performanceMode:
        this.config.performanceMode === 'conservative'
          ? ('low' as const)
          : this.config.performanceMode === 'aggressive'
            ? ('high' as const)
            : ('medium' as const),
      batteryLevel: this.getBatteryLevel(),
    };

    return {
      contentAnalysis: analysis,
      userPreferences,
      pageContext,
      resourceConstraints,
    };
  }

  /**
   * Evaluate feature activation
   */
  private async evaluateFeatureActivation(context: FeatureActivationContext): Promise<void> {
    const candidateFeatures = this.selectCandidateFeatures(context);

    for (const featureConfig of candidateFeatures) {
      if (this.shouldActivateFeature(featureConfig, context)) {
        if (this.config.updateStrategy === 'immediate') {
          await this.performActivation(featureConfig, context);
        } else {
          this.queueActivation(featureConfig, context);
        }
      }
    }

    // Process queue if using batched strategy
    if (this.config.updateStrategy === 'batched') {
      await this.processActivationQueue();
    }
  }

  /**
   * Select candidate features for activation
   */
  private selectCandidateFeatures(context: FeatureActivationContext): FeatureConfig[] {
    const candidates: FeatureConfig[] = [];

    for (const [featureType, featureConfig] of this.featureConfigs) {
      // Skip if feature is disabled by user
      if (context.userPreferences.disabledFeatures.includes(featureType)) {
        continue;
      }

      // Skip if feature is already active
      if (this.isFeatureActive(featureType)) {
        continue;
      }

      // Check platform compatibility
      if (!featureConfig.activationConditions.platformCompatibility.includes(context.pageContext.platform)) {
        continue;
      }

      // Check content type compatibility
      if (!featureConfig.activationConditions.contentTypes.includes(context.contentAnalysis.contentType)) {
        continue;
      }

      candidates.push(featureConfig);
    }

    // Sort by priority
    return candidates.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Check if feature should be activated
   */
  private shouldActivateFeature(featureConfig: FeatureConfig, context: FeatureActivationContext): boolean {
    // Check meeting confidence threshold
    if (context.contentAnalysis.meetingConfidence < featureConfig.activationConditions.minMeetingConfidence) {
      return false;
    }

    // Check required indicators
    const indicators = context.contentAnalysis.meetingIndicators;
    for (const indicator of featureConfig.activationConditions.requiredIndicators) {
      if (!(indicators as Record<string, unknown>)[indicator]) {
        return false;
      }
    }

    // Check resource constraints
    if (!this.checkResourceConstraints(featureConfig, context)) {
      return false;
    }

    // Check dependencies
    if (!this.checkDependencies(featureConfig)) {
      return false;
    }

    // Check concurrent feature limit
    if (this.getActiveFeatures().length >= this.config.maxConcurrentFeatures) {
      return false;
    }

    return true;
  }

  /**
   * Check resource constraints
   */
  private checkResourceConstraints(featureConfig: FeatureConfig, context: FeatureActivationContext): boolean {
    // Check memory limit
    const currentMemoryUsage = this.getCurrentMemoryUsage();
    if (currentMemoryUsage + featureConfig.resourceRequirements.memoryUsage > context.resourceConstraints.memoryLimit) {
      return false;
    }

    // Check performance mode
    if (context.resourceConstraints.performanceMode === 'low' && featureConfig.resourceRequirements.cpuIntensive) {
      return false;
    }

    // Check battery level
    if (
      context.resourceConstraints.batteryLevel !== undefined &&
      context.resourceConstraints.batteryLevel < 0.2 &&
      featureConfig.resourceRequirements.cpuIntensive
    ) {
      return false;
    }

    return true;
  }

  /**
   * Check feature dependencies
   */
  private checkDependencies(featureConfig: FeatureConfig): boolean {
    // Check required features
    for (const requiredFeature of featureConfig.dependencies.requiredFeatures) {
      if (!this.isFeatureActive(requiredFeature)) {
        return false;
      }
    }

    // Check conflicting features
    for (const conflictingFeature of featureConfig.dependencies.conflictingFeatures) {
      if (this.isFeatureActive(conflictingFeature)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Queue feature activation
   */
  private queueActivation(featureConfig: FeatureConfig, context: FeatureActivationContext): void {
    this.activationQueue.push({ feature: featureConfig, context });
  }

  /**
   * Process activation queue
   */
  private async processActivationQueue(): Promise<void> {
    if (this.activationQueue.length === 0) {
      return;
    }

    const batch = this.activationQueue.splice(0, 5); // Process up to 5 at a time

    await Promise.all(
      batch.map(({ feature, context }) =>
        this.performActivation(feature, context).catch(error => {
          this.log(`Queued activation failed: ${error}`);
        }),
      ),
    );
  }

  /**
   * Perform feature activation
   */
  private async performActivation(
    featureConfig: FeatureConfig,
    context: FeatureActivationContext,
  ): Promise<FeatureActivationResult> {
    const startTime = performance.now();
    const featureId = `${featureConfig.id}-${Date.now()}`;

    try {
      // Create feature state
      const featureState: FeatureState = {
        config: featureConfig,
        status: 'activating',
        componentIds: [],
        eventListeners: [],
        resourceUsage: {
          memory: 0,
          cpu: 0,
          network: 0,
        },
        lastUpdated: new Date(),
      };

      this.featureStates.set(featureId, featureState);

      // Activate component if configured
      if (featureConfig.componentConfig) {
        await this.activateComponent(featureConfig, featureState, context);
      }

      // Setup feature-specific functionality
      await this.setupFeatureFunctionality(featureConfig, featureState, context);

      // Update state
      featureState.status = 'active';
      featureState.activatedAt = new Date();
      featureState.resourceUsage.memory = featureConfig.resourceRequirements.memoryUsage;

      const endTime = performance.now();

      // Create activation result
      const result: FeatureActivationResult = {
        success: true,
        featureId,
        featureType: featureConfig.type,
        timestamp: new Date(),
        resourceUsage: {
          memory: featureState.resourceUsage.memory,
          cpu: featureState.resourceUsage.cpu,
          components: featureState.componentIds.length,
        },
        context,
      };

      featureState.activationResult = result;

      // Update statistics
      this.updateActivationStatistics(result, endTime - startTime);

      // Notify callbacks
      this.notifyActivationCallbacks(result);

      this.log(`Feature activated: ${featureConfig.type} (${featureId})`);
      return result;
    } catch (error) {
      // Handle activation error
      const featureState = this.featureStates.get(featureId);
      if (featureState) {
        featureState.status = 'error';
        featureState.error = error instanceof Error ? error : new Error('Activation failed');
      }

      const result: FeatureActivationResult = {
        success: false,
        featureId,
        featureType: featureConfig.type,
        timestamp: new Date(),
        error: {
          code: 'ACTIVATION_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error,
        },
        resourceUsage: {
          memory: 0,
          cpu: 0,
          components: 0,
        },
        context,
      };

      this.notifyActivationCallbacks(result);
      throw error;
    }
  }

  /**
   * Activate component
   */
  private async activateComponent(
    featureConfig: FeatureConfig,
    featureState: FeatureState,
    context: FeatureActivationContext,
  ): Promise<void> {
    if (!featureConfig.componentConfig) {
      return;
    }

    const { componentId, props, injectionPoint } = featureConfig.componentConfig;

    // Get component by ID (would be imported from components)
    const component = this.getComponentByType(featureConfig.type);
    if (!component) {
      throw new Error(`Component not found for feature: ${featureConfig.type}`);
    }

    // Register component
    const registeredId = await componentRegistry.registerComponent({
      id: componentId,
      type: featureConfig.type,
      component,
      props: {
        ...props,
        featureContext: context,
      },
      injectionPoint: injectionPoint ? { selector: injectionPoint } : undefined,
    });

    featureState.componentIds.push(registeredId);
  }

  /**
   * Setup feature functionality
   */
  private async setupFeatureFunctionality(
    featureConfig: FeatureConfig,
    featureState: FeatureState,
    context: FeatureActivationContext,
  ): Promise<void> {
    // Feature-specific setup would go here
    switch (featureConfig.type) {
      case 'transcription.button':
        await this.setupTranscriptionButton(featureState, context);
        break;
      case 'progress.indicator':
        await this.setupProgressIndicator(featureState, context);
        break;
      case 'status.panel':
        await this.setupStatusPanel(featureState, context);
        break;
      default:
        // Generic setup
        break;
    }
  }

  /**
   * Setup transcription button functionality
   */
  private async setupTranscriptionButton(
    featureState: FeatureState,
    _context: FeatureActivationContext,
  ): Promise<void> {
    // Register event handlers for transcription control
    const buttonClickHandler = eventManager.registerHandler({
      element: document,
      event: 'click',
      handler: async event => {
        const target = event.target as HTMLElement;
        if (target.closest('[data-feature="transcription-button"]')) {
          await this.handleTranscriptionToggle();
        }
      },
      options: { passive: false },
    });

    featureState.eventListeners.push(buttonClickHandler);
  }

  /**
   * Setup progress indicator functionality
   */
  private async setupProgressIndicator(featureState: FeatureState, _context: FeatureActivationContext): Promise<void> {
    // Subscribe to transcription progress events
    const subscriptionId = backgroundCoordinator.subscribeToEvents('transcription.progress', event => {
      // Update progress indicator component
      const componentId = featureState.componentIds[0];
      if (componentId) {
        componentRegistry.updateComponent(componentId, {
          progress: event.data.progress,
          status: event.data.status,
        });
      }
    });

    featureState.eventListeners.push(subscriptionId);
  }

  /**
   * Setup status panel functionality
   */
  private async setupStatusPanel(featureState: FeatureState, _context: FeatureActivationContext): Promise<void> {
    // Subscribe to various status events
    const subscriptionId = backgroundCoordinator.subscribeToEvents(
      ['transcription.progress', 'transcription.completed', 'error.occurred'],
      event => {
        // Update status panel component
        const componentId = featureState.componentIds[0];
        if (componentId) {
          componentRegistry.updateComponent(componentId, {
            status: event.data,
            timestamp: event.timestamp,
          });
        }
      },
    );

    featureState.eventListeners.push(subscriptionId);
  }

  /**
   * Handle transcription toggle
   */
  private async handleTranscriptionToggle(): Promise<void> {
    try {
      await backgroundCoordinator.sendMessage({
        type: 'transcription.toggle',
        payload: {
          action: 'toggle',
          timestamp: Date.now(),
        },
      });
    } catch (error) {
      this.log(`Transcription toggle error: ${error}`);
    }
  }

  /**
   * Get component by feature type
   */
  private getComponentByType(_featureType: FeatureType): React.ComponentType<Record<string, unknown>> | null {
    // This would import and return actual React components
    // For now, return a placeholder
    return null;
  }

  /**
   * Start resource monitoring
   */
  private startResourceMonitoring(): void {
    if (!this.config.enableResourceMonitoring) {
      return;
    }

    this.resourceMonitorInterval = setInterval(() => {
      this.monitorResources();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Monitor resource usage
   */
  private monitorResources(): void {
    const memoryUsage = this.getCurrentMemoryUsage();
    const activeFeatures = this.getActiveFeatures();

    // Check for resource constraints
    if (memoryUsage > 100 * 1024 * 1024) {
      // 100MB
      this.log('High memory usage detected, considering feature deactivation');
      // Could implement feature deactivation logic here
    }

    // Update resource statistics
    this.statistics.resourceUsage = {
      totalMemory: memoryUsage,
      totalCpu: this.getCurrentCpuUsage(),
      totalComponents: activeFeatures.reduce((sum, state) => sum + state.componentIds.length, 0),
    };
  }

  /**
   * Get current memory usage
   */
  private getCurrentMemoryUsage(): number {
    return Array.from(this.featureStates.values()).reduce((total, state) => total + state.resourceUsage.memory, 0);
  }

  /**
   * Get current CPU usage
   */
  private getCurrentCpuUsage(): number {
    return Array.from(this.featureStates.values()).reduce((total, state) => total + state.resourceUsage.cpu, 0);
  }

  /**
   * Get battery level
   */
  private getBatteryLevel(): number | undefined {
    // Would use Navigator.getBattery() if available
    return undefined;
  }

  /**
   * Update activation statistics
   */
  private updateActivationStatistics(result: FeatureActivationResult, activationTime: number): void {
    this.statistics.totalActivated++;
    this.statistics.lastActivation = result.timestamp;

    // Update average activation time
    const currentAverage = this.statistics.averageActivationTime;
    const totalActivated = this.statistics.totalActivated;
    this.statistics.averageActivationTime = (currentAverage * (totalActivated - 1) + activationTime) / totalActivated;

    // Update feature type statistics
    this.statistics.featuresByType[result.featureType] = (this.statistics.featuresByType[result.featureType] || 0) + 1;

    // Update success rate
    const successfulActivations = Array.from(this.featureStates.values()).filter(
      state => state.status === 'active',
    ).length;
    this.statistics.successRate = successfulActivations / this.statistics.totalActivated;
  }

  /**
   * Update general statistics
   */
  private updateStatistics(): void {
    this.statistics.activeFeatures = this.getActiveFeatures().length;
  }

  /**
   * Notify activation callbacks
   */
  private notifyActivationCallbacks(result: FeatureActivationResult): void {
    this.activationCallbacks.forEach(callback => {
      try {
        callback(result);
      } catch (error) {
        this.log(`Activation callback error: ${error}`);
      }
    });
  }

  /**
   * Log debug message
   */
  private log(message: string): void {
    if (this.config.enableDebugLogging) {
      console.log(`[FeatureActivationManager] ${message}`);
    }
  }

  /**
   * Cleanup activation manager
   */
  async cleanup(): Promise<void> {
    // Stop content monitoring
    if (this.contentChangeUnsubscribe) {
      this.contentChangeUnsubscribe();
      this.contentChangeUnsubscribe = null;
    }

    // Stop resource monitoring
    if (this.resourceMonitorInterval) {
      clearInterval(this.resourceMonitorInterval);
      this.resourceMonitorInterval = null;
    }

    // Deactivate all features
    const featureIds = Array.from(this.featureStates.keys());
    await Promise.all(featureIds.map(id => this.deactivateFeature(id)));

    // Clear callbacks
    this.activationCallbacks.length = 0;
    this.activationQueue.length = 0;

    this.log('Feature activation manager cleanup completed');
  }
}

// Export singleton instance
export const featureActivationManager = FeatureActivationManager.getInstance();

// Export utility functions
export const activationUtils = {
  /**
   * Get activation manager instance
   */
  getInstance: (config?: Partial<ActivationConfig>) => FeatureActivationManager.getInstance(config),

  /**
   * Activate feature
   */
  activate: (featureType: FeatureType, context?: Partial<FeatureActivationContext>): Promise<FeatureActivationResult> =>
    featureActivationManager.activateFeature(featureType, context),

  /**
   * Deactivate feature
   */
  deactivate: (featureId: string): Promise<boolean> => featureActivationManager.deactivateFeature(featureId),

  /**
   * Check if feature is active
   */
  isActive: (featureType: FeatureType): boolean => featureActivationManager.isFeatureActive(featureType),

  /**
   * Get active features
   */
  getActive: (): FeatureState[] => featureActivationManager.getActiveFeatures(),

  /**
   * Register feature
   */
  register: (config: FeatureConfig): void => {
    featureActivationManager.registerFeature(config);
  },

  /**
   * Get statistics
   */
  getStats: (): ActivationStatistics => featureActivationManager.getStatistics(),

  /**
   * Monitor activation events
   */
  onActivation: (callback: (result: FeatureActivationResult) => void): (() => void) =>
    featureActivationManager.onFeatureActivation(callback),

  /**
   * Cleanup
   */
  cleanup: (): Promise<void> => featureActivationManager.cleanup(),
};
