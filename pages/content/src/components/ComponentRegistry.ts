/**
 * Component Registry
 *
 * Component registration and lifecycle management with component cleanup
 * and memory management for injected React components.
 */

import { injectionController } from '../injection/injection-controller';
import { eventManager } from '../utils/event-manager';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { UIComponent } from '../types/content-script';
import type React from 'react';
import type ReactDOM from 'react-dom/client';

/**
 * Component registration information
 */
export interface ComponentRegistration {
  /** Component identifier */
  id: string;
  /** Component type */
  type: string;
  /** React component */
  component: React.ComponentType<Record<string, unknown>>;
  /** Component props */
  props: Record<string, unknown>;
  /** DOM element where component is mounted */
  element: HTMLElement;
  /** React root instance */
  root: ReactDOM.Root;
  /** Registration timestamp */
  registeredAt: Date;
  /** Last update timestamp */
  lastUpdated: Date;
  /** Component state */
  state: 'mounting' | 'mounted' | 'updating' | 'unmounting' | 'unmounted' | 'error';
  /** Error information if any */
  error?: Error;
  /** Cleanup functions */
  cleanupFunctions: Array<() => void>;
  /** Event listener registrations */
  eventRegistrations: string[];
  /** Child component registrations */
  children: Set<string>;
  /** Parent component registration */
  parent?: string;
}

/**
 * Registry configuration
 */
export interface RegistryConfig {
  /** Maximum number of components to track */
  maxComponents: number;
  /** Enable performance monitoring */
  enablePerformanceMonitoring: boolean;
  /** Enable memory leak detection */
  enableMemoryLeakDetection: boolean;
  /** Component cleanup timeout in ms */
  cleanupTimeout: number;
  /** Automatic cleanup interval in ms */
  autoCleanupInterval: number;
  /** Enable debug logging */
  enableDebugLogging: boolean;
}

/**
 * Registry statistics
 */
export interface RegistryStatistics {
  /** Total components registered */
  totalRegistered: number;
  /** Currently active components */
  activeComponents: number;
  /** Components by type */
  componentsByType: Record<string, number>;
  /** Components by state */
  componentsByState: Record<string, number>;
  /** Memory usage estimation */
  estimatedMemoryUsage: number;
  /** Performance metrics */
  performanceMetrics: {
    averageMountTime: number;
    averageUpdateTime: number;
    totalRenderTime: number;
    errorRate: number;
  };
  /** Last cleanup timestamp */
  lastCleanup: Date;
}

/**
 * Component lifecycle event
 */
export interface ComponentLifecycleEvent {
  /** Event type */
  type: 'mount' | 'update' | 'unmount' | 'error';
  /** Component ID */
  componentId: string;
  /** Component type */
  componentType: string;
  /** Event timestamp */
  timestamp: Date;
  /** Performance data */
  performance?: {
    duration: number;
    memoryDelta: number;
  };
  /** Error information */
  error?: Error;
  /** Additional data */
  data?: unknown;
}

/**
 * Component registry for managing React component lifecycle
 */
export class ComponentRegistry {
  private static instance: ComponentRegistry;
  private registrations: Map<string, ComponentRegistration> = new Map();
  private typeIndex: Map<string, Set<string>> = new Map();
  private parentChildIndex: Map<string, Set<string>> = new Map();
  private config: RegistryConfig;
  private lifecycleCallbacks: Array<(event: ComponentLifecycleEvent) => void> = [];
  private cleanupInterval: NodeJS.Timeout | null = null;
  private performanceObserver: PerformanceObserver | null = null;

  constructor(config: Partial<RegistryConfig> = {}) {
    this.config = {
      maxComponents: 100,
      enablePerformanceMonitoring: true,
      enableMemoryLeakDetection: true,
      cleanupTimeout: 30000,
      autoCleanupInterval: 60000,
      enableDebugLogging: false,
      ...config,
    };

    this.initializePerformanceMonitoring();
    this.startAutoCleanup();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<RegistryConfig>): ComponentRegistry {
    if (!ComponentRegistry.instance) {
      ComponentRegistry.instance = new ComponentRegistry(config);
    }
    return ComponentRegistry.instance;
  }

  /**
   * Register React component
   */
  async registerComponent(uiComponent: UIComponent): Promise<string> {
    const startTime = performance.now();

    try {
      // Check component limit
      if (this.registrations.size >= this.config.maxComponents) {
        await this.cleanupInactiveComponents();

        if (this.registrations.size >= this.config.maxComponents) {
          throw new Error('Maximum component limit reached');
        }
      }

      // Create container element
      const container = this.createComponentContainer(uiComponent);

      // Create React root
      const root = createRoot(container);

      // Create registration
      const registration: ComponentRegistration = {
        id: uiComponent.id,
        type: uiComponent.type,
        component: uiComponent.component,
        props: uiComponent.props || {},
        element: container,
        root,
        registeredAt: new Date(),
        lastUpdated: new Date(),
        state: 'mounting',
        cleanupFunctions: [],
        eventRegistrations: [],
        children: new Set(),
        parent: uiComponent.parent,
      };

      // Store registration
      this.registrations.set(uiComponent.id, registration);

      // Update type index
      if (!this.typeIndex.has(uiComponent.type)) {
        this.typeIndex.set(uiComponent.type, new Set());
      }
      this.typeIndex.get(uiComponent.type)!.add(uiComponent.id);

      // Update parent-child index
      if (uiComponent.parent) {
        if (!this.parentChildIndex.has(uiComponent.parent)) {
          this.parentChildIndex.set(uiComponent.parent, new Set());
        }
        this.parentChildIndex.get(uiComponent.parent)!.add(uiComponent.id);

        const parentRegistration = this.registrations.get(uiComponent.parent);
        if (parentRegistration) {
          parentRegistration.children.add(uiComponent.id);
        }
      }

      // Inject component into DOM
      await this.injectComponent(registration, uiComponent);

      // Render React component
      await this.renderComponent(registration);

      // Setup cleanup
      this.setupComponentCleanup(registration, uiComponent);

      // Update state
      registration.state = 'mounted';

      const endTime = performance.now();

      // Emit lifecycle event
      this.emitLifecycleEvent({
        type: 'mount',
        componentId: uiComponent.id,
        componentType: uiComponent.type,
        timestamp: new Date(),
        performance: {
          duration: endTime - startTime,
          memoryDelta: this.estimateMemoryUsage(registration),
        },
      });

      this.log(`Component ${uiComponent.id} registered successfully`);
      return uiComponent.id;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Registration failed');

      // Clean up on error
      const registration = this.registrations.get(uiComponent.id);
      if (registration) {
        registration.state = 'error';
        registration.error = err;
        await this.cleanupRegistration(registration);
      }

      this.emitLifecycleEvent({
        type: 'error',
        componentId: uiComponent.id,
        componentType: uiComponent.type,
        timestamp: new Date(),
        error: err,
      });

      throw err;
    }
  }

  /**
   * Update component props
   */
  async updateComponent(componentId: string, newProps: Record<string, unknown>): Promise<boolean> {
    const startTime = performance.now();
    const registration = this.registrations.get(componentId);

    if (!registration) {
      return false;
    }

    try {
      registration.state = 'updating';
      registration.props = { ...registration.props, ...newProps };
      registration.lastUpdated = new Date();

      // Re-render component with new props
      await this.renderComponent(registration);

      registration.state = 'mounted';

      const endTime = performance.now();

      this.emitLifecycleEvent({
        type: 'update',
        componentId,
        componentType: registration.type,
        timestamp: new Date(),
        performance: {
          duration: endTime - startTime,
          memoryDelta: 0, // Updates typically don't change memory significantly
        },
      });

      this.log(`Component ${componentId} updated successfully`);
      return true;
    } catch (error) {
      registration.state = 'error';
      registration.error = error instanceof Error ? error : new Error('Update failed');

      this.emitLifecycleEvent({
        type: 'error',
        componentId,
        componentType: registration.type,
        timestamp: new Date(),
        error: registration.error,
      });

      return false;
    }
  }

  /**
   * Unregister component
   */
  async unregisterComponent(componentId: string): Promise<boolean> {
    const registration = this.registrations.get(componentId);

    if (!registration) {
      return false;
    }

    try {
      registration.state = 'unmounting';

      // Cleanup component
      await this.cleanupRegistration(registration);

      // Remove from registrations
      this.registrations.delete(componentId);

      // Update type index
      const typeSet = this.typeIndex.get(registration.type);
      if (typeSet) {
        typeSet.delete(componentId);
        if (typeSet.size === 0) {
          this.typeIndex.delete(registration.type);
        }
      }

      // Update parent-child index
      if (registration.parent) {
        const parentChildSet = this.parentChildIndex.get(registration.parent);
        if (parentChildSet) {
          parentChildSet.delete(componentId);
          if (parentChildSet.size === 0) {
            this.parentChildIndex.delete(registration.parent);
          }
        }

        const parentRegistration = this.registrations.get(registration.parent);
        if (parentRegistration) {
          parentRegistration.children.delete(componentId);
        }
      }

      // Remove child relationships
      this.parentChildIndex.delete(componentId);

      this.emitLifecycleEvent({
        type: 'unmount',
        componentId,
        componentType: registration.type,
        timestamp: new Date(),
      });

      this.log(`Component ${componentId} unregistered successfully`);
      return true;
    } catch (error) {
      registration.state = 'error';
      registration.error = error instanceof Error ? error : new Error('Unregister failed');
      return false;
    }
  }

  /**
   * Get component registration
   */
  getComponent(componentId: string): ComponentRegistration | null {
    return this.registrations.get(componentId) || null;
  }

  /**
   * Get components by type
   */
  getComponentsByType(type: string): ComponentRegistration[] {
    const componentIds = this.typeIndex.get(type) || new Set();
    return Array.from(componentIds)
      .map(id => this.registrations.get(id))
      .filter((reg): reg is ComponentRegistration => reg !== undefined);
  }

  /**
   * Get all registered components
   */
  getAllComponents(): ComponentRegistration[] {
    return Array.from(this.registrations.values());
  }

  /**
   * Check if component is registered
   */
  isComponentRegistered(componentId: string): boolean {
    return this.registrations.has(componentId);
  }

  /**
   * Get component children
   */
  getComponentChildren(componentId: string): ComponentRegistration[] {
    const childIds = this.parentChildIndex.get(componentId) || new Set();
    return Array.from(childIds)
      .map(id => this.registrations.get(id))
      .filter((reg): reg is ComponentRegistration => reg !== undefined);
  }

  /**
   * Register lifecycle callback
   */
  onLifecycleEvent(callback: (event: ComponentLifecycleEvent) => void): () => void {
    this.lifecycleCallbacks.push(callback);

    return () => {
      const index = this.lifecycleCallbacks.indexOf(callback);
      if (index > -1) {
        this.lifecycleCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Clean up all components
   */
  async cleanupAllComponents(): Promise<void> {
    const componentIds = Array.from(this.registrations.keys());

    await Promise.all(componentIds.map(id => this.unregisterComponent(id)));

    this.log('All components cleaned up');
  }

  /**
   * Clean up inactive components
   */
  async cleanupInactiveComponents(): Promise<number> {
    const now = Date.now();
    const inactiveComponents: string[] = [];

    this.registrations.forEach((registration, id) => {
      const age = now - registration.lastUpdated.getTime();

      if (
        registration.state === 'error' ||
        registration.state === 'unmounted' ||
        (registration.state === 'mounted' && age > this.config.cleanupTimeout)
      ) {
        inactiveComponents.push(id);
      }
    });

    for (const id of inactiveComponents) {
      await this.unregisterComponent(id);
    }

    this.log(`Cleaned up ${inactiveComponents.length} inactive components`);
    return inactiveComponents.length;
  }

  /**
   * Get registry statistics
   */
  getStatistics(): RegistryStatistics {
    const componentsByType: Record<string, number> = {};
    const componentsByState: Record<string, number> = {};
    let totalMemory = 0;
    const totalMountTime = 0;
    const totalUpdateTime = 0;
    const totalRenderTime = 0;
    let errorCount = 0;

    this.registrations.forEach(registration => {
      // Count by type
      componentsByType[registration.type] = (componentsByType[registration.type] || 0) + 1;

      // Count by state
      componentsByState[registration.state] = (componentsByState[registration.state] || 0) + 1;

      // Estimate memory
      totalMemory += this.estimateMemoryUsage(registration);

      // Count errors
      if (registration.state === 'error') {
        errorCount++;
      }
    });

    return {
      totalRegistered: this.registrations.size,
      activeComponents: Array.from(this.registrations.values()).filter(reg => reg.state === 'mounted').length,
      componentsByType,
      componentsByState,
      estimatedMemoryUsage: totalMemory,
      performanceMetrics: {
        averageMountTime: totalMountTime / Math.max(this.registrations.size, 1),
        averageUpdateTime: totalUpdateTime / Math.max(this.registrations.size, 1),
        totalRenderTime,
        errorRate: errorCount / Math.max(this.registrations.size, 1),
      },
      lastCleanup: new Date(), // In real implementation, track this
    };
  }

  /**
   * Create component container element
   */
  private createComponentContainer(uiComponent: UIComponent): HTMLElement {
    const container = document.createElement('div');
    container.id = `component-container-${uiComponent.id}`;
    container.className = 'meeting-summarizer-component-container';
    container.setAttribute('data-component-id', uiComponent.id);
    container.setAttribute('data-component-type', uiComponent.type);

    // Apply isolation styles
    if (uiComponent.styling?.isolation) {
      container.style.isolation = 'isolate';
      container.style.contain = 'layout style paint';
    }

    return container;
  }

  /**
   * Inject component into DOM
   */
  private async injectComponent(registration: ComponentRegistration, uiComponent: UIComponent): Promise<void> {
    if (uiComponent.injectionPoint) {
      // Use injection controller to inject container
      const result = await injectionController.injectComponent({
        component: {
          ...uiComponent,
          component: () => createElement('div'), // Placeholder
        },
        options: {
          isolateStyles: uiComponent.styling?.isolation || false,
          responsive: true,
        },
      });

      if (!result.success || !result.element) {
        throw new Error('Failed to inject component container');
      }

      // Replace the injected element with our container
      result.element.parentNode?.replaceChild(registration.element, result.element);
    } else {
      // Fallback injection to body
      document.body.appendChild(registration.element);
    }
  }

  /**
   * Render React component
   */
  private async renderComponent(registration: ComponentRegistration): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        const element = createElement(registration.component, registration.props);

        registration.root.render(element);

        // Wait for next frame to ensure rendering is complete
        requestAnimationFrame(() => {
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Setup component cleanup
   */
  private setupComponentCleanup(registration: ComponentRegistration, uiComponent: UIComponent): void {
    // Register UI component event handlers
    if (uiComponent.eventHandlers) {
      uiComponent.eventHandlers.forEach(handler => {
        const registrationId = eventManager.registerHandler(handler);
        registration.eventRegistrations.push(registrationId);
      });
    }

    // Register lifecycle cleanup
    if (uiComponent.cleanup) {
      registration.cleanupFunctions.push(uiComponent.cleanup);
    }

    // Register lifecycle hooks
    if (uiComponent.lifecycle?.onMount) {
      uiComponent.lifecycle.onMount();
    }
  }

  /**
   * Cleanup component registration
   */
  private async cleanupRegistration(registration: ComponentRegistration): Promise<void> {
    try {
      // Call lifecycle hook
      const uiComponent = this.registrations.get(registration.id);
      interface ComponentWithLifecycle {
        lifecycle?: {
          onUnmount?: () => void;
        };
      }
      if (uiComponent && (uiComponent as ComponentWithLifecycle).lifecycle?.onUnmount) {
        (uiComponent as ComponentWithLifecycle).lifecycle.onUnmount();
      }

      // Unmount React component
      if (registration.root) {
        registration.root.unmount();
      }

      // Remove DOM element
      if (registration.element && registration.element.parentNode) {
        registration.element.parentNode.removeChild(registration.element);
      }

      // Clean up event listeners
      registration.eventRegistrations.forEach(id => {
        eventManager.removeEventListener(id);
      });
      registration.eventRegistrations.length = 0;

      // Run cleanup functions
      registration.cleanupFunctions.forEach(cleanup => {
        try {
          cleanup();
        } catch (error) {
          console.warn('Cleanup function error:', error);
        }
      });
      registration.cleanupFunctions.length = 0;

      // Clean up children
      const children = Array.from(registration.children);
      for (const childId of children) {
        await this.unregisterComponent(childId);
      }

      registration.state = 'unmounted';
    } catch (error) {
      console.error('Component cleanup error:', error);
      registration.state = 'error';
      registration.error = error instanceof Error ? error : new Error('Cleanup failed');
    }
  }

  /**
   * Estimate component memory usage
   */
  private estimateMemoryUsage(registration: ComponentRegistration): number {
    // Rough estimation based on DOM elements and React fibers
    const elementCount = registration.element.querySelectorAll('*').length + 1;
    const propsSize = JSON.stringify(registration.props).length;

    // Estimated memory per element (in bytes)
    const memoryPerElement = 1000; // 1KB per DOM element
    const memoryPerByte = 2; // 2 bytes per character in props

    return elementCount * memoryPerElement + propsSize * memoryPerByte;
  }

  /**
   * Initialize performance monitoring
   */
  private initializePerformanceMonitoring(): void {
    if (!this.config.enablePerformanceMonitoring || typeof PerformanceObserver === 'undefined') {
      return;
    }

    try {
      this.performanceObserver = new PerformanceObserver(list => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (entry.name.includes('component-render')) {
            this.log(`Component render performance: ${entry.name} took ${entry.duration}ms`);
          }
        });
      });

      this.performanceObserver.observe({ entryTypes: ['measure'] });
    } catch (error) {
      console.warn('Failed to initialize performance monitoring:', error);
    }
  }

  /**
   * Start automatic cleanup
   */
  private startAutoCleanup(): void {
    if (this.config.autoCleanupInterval > 0) {
      this.cleanupInterval = setInterval(async () => {
        await this.cleanupInactiveComponents();
      }, this.config.autoCleanupInterval);
    }
  }

  /**
   * Emit lifecycle event
   */
  private emitLifecycleEvent(event: ComponentLifecycleEvent): void {
    this.lifecycleCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Lifecycle callback error:', error);
      }
    });
  }

  /**
   * Log debug message
   */
  private log(message: string): void {
    if (this.config.enableDebugLogging) {
      console.log(`[ComponentRegistry] ${message}`);
    }
  }

  /**
   * Cleanup registry
   */
  async cleanup(): Promise<void> {
    // Stop auto cleanup
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Stop performance monitoring
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
      this.performanceObserver = null;
    }

    // Clean up all components
    await this.cleanupAllComponents();

    // Clear callbacks
    this.lifecycleCallbacks.length = 0;

    this.log('Registry cleanup completed');
  }
}

// Export singleton instance
export const componentRegistry = ComponentRegistry.getInstance();

// Export utility functions
export const registryUtils = {
  /**
   * Get registry instance
   */
  getInstance: (config?: Partial<RegistryConfig>) => ComponentRegistry.getInstance(config),

  /**
   * Register component
   */
  register: (component: UIComponent): Promise<string> => componentRegistry.registerComponent(component),

  /**
   * Unregister component
   */
  unregister: (componentId: string): Promise<boolean> => componentRegistry.unregisterComponent(componentId),

  /**
   * Update component
   */
  update: (componentId: string, props: Record<string, unknown>): Promise<boolean> =>
    componentRegistry.updateComponent(componentId, props),

  /**
   * Get component
   */
  get: (componentId: string): ComponentRegistration | null => componentRegistry.getComponent(componentId),

  /**
   * Get statistics
   */
  getStats: (): RegistryStatistics => componentRegistry.getStatistics(),

  /**
   * Cleanup all components
   */
  cleanup: (): Promise<void> => componentRegistry.cleanupAllComponents(),
};
