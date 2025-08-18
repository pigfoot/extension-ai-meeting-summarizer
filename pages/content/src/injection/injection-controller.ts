/**
 * Injection Controller
 *
 * UIInjectionController with safe component injection, styling isolation,
 * and responsive design support for content scripts.
 */

import { DOM } from '../utils/dom-utils';
import { eventManager } from '../utils/event-manager';
import type { UIComponent, InjectionPoint } from '../types/content-script';
// import type { DOMManipulator } from '../types/content-script';

/**
 * Component injection configuration
 */
export interface ComponentInjectionConfig {
  /** Component configuration */
  component: UIComponent;
  /** Injection options */
  options: InjectionOptions;
  /** Success callback */
  onSuccess?: (element: HTMLElement) => void;
  /** Error callback */
  onError?: (error: Error) => void;
}

/**
 * Injection options
 */
export interface InjectionOptions {
  /** Whether to apply style isolation */
  isolateStyles: boolean;
  /** Whether to make component responsive */
  responsive: boolean;
  /** Custom CSS to inject */
  customCSS?: string;
  /** Animation configuration */
  animation?: AnimationConfig;
  /** Accessibility configuration */
  accessibility?: AccessibilityConfig;
  /** Lifecycle hooks */
  lifecycle?: LifecycleHooks;
}

/**
 * Animation configuration for injected components
 */
export interface AnimationConfig {
  /** Animation type */
  type: 'fade' | 'slide' | 'scale' | 'none';
  /** Animation duration in milliseconds */
  duration: number;
  /** Animation easing function */
  easing: 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear';
  /** Delay before animation starts */
  delay?: number;
}

/**
 * Accessibility configuration
 */
export interface AccessibilityConfig {
  /** ARIA label */
  ariaLabel?: string;
  /** ARIA role */
  ariaRole?: string;
  /** ARIA described by */
  ariaDescribedBy?: string;
  /** Tab index */
  tabIndex?: number;
  /** Whether component is focusable */
  focusable: boolean;
  /** Keyboard navigation support */
  keyboardNavigation: boolean;
}

/**
 * Component lifecycle hooks
 */
export interface LifecycleHooks {
  /** Called before injection */
  beforeInject?: (element: HTMLElement) => void;
  /** Called after injection */
  afterInject?: (element: HTMLElement) => void;
  /** Called before removal */
  beforeRemove?: (element: HTMLElement) => void;
  /** Called after removal */
  afterRemove?: () => void;
  /** Called on component update */
  onUpdate?: (element: HTMLElement, changes: unknown) => void;
}

/**
 * Injection result information
 */
export interface InjectionResult {
  /** Whether injection was successful */
  success: boolean;
  /** Injected element (if successful) */
  element?: HTMLElement;
  /** Error information (if failed) */
  error?: Error;
  /** Component ID */
  componentId: string;
  /** Injection timestamp */
  timestamp: Date;
  /** Injection point used */
  injectionPoint?: InjectionPoint;
}

/**
 * Component update configuration
 */
export interface ComponentUpdate {
  /** Component ID to update */
  componentId: string;
  /** New properties */
  props?: Record<string, unknown>;
  /** New styling */
  styling?: Partial<UIComponent['styling']>;
  /** Update animation */
  animation?: AnimationConfig;
}

/**
 * UI injection controller for managing component injection
 */
export class UIInjectionController {
  private static instance: UIInjectionController;
  private injectedComponents: Map<string, UIComponent> = new Map();
  private componentElements: Map<string, HTMLElement> = new Map();
  private resizeObserver: ResizeObserver | null = null;
  private styleSheets: Map<string, string> = new Map();
  private animationQueue: Map<string, Promise<void>> = new Map();

  /**
   * Get singleton instance
   */
  static getInstance(): UIInjectionController {
    if (!UIInjectionController.instance) {
      UIInjectionController.instance = new UIInjectionController();
    }
    return UIInjectionController.instance;
  }

  constructor() {
    this.initializeResizeObserver();
    this.setupGlobalStyles();
  }

  /**
   * Inject UI component into page
   */
  async injectComponent(config: ComponentInjectionConfig): Promise<InjectionResult> {
    const { component, options } = config;
    const startTime = Date.now();

    try {
      // Check if component already exists
      if (this.injectedComponents.has(component.id)) {
        throw new Error(`Component ${component.id} already injected`);
      }

      // Find optimal injection point
      const injectionPoint = this.findOptimalInjectionPoint(component);
      if (!injectionPoint) {
        throw new Error('No suitable injection point found');
      }

      // Create component element
      const element = await this.createComponentElement(component, options);

      // Apply lifecycle hooks
      options.lifecycle?.beforeInject?.(element);

      // Inject element into DOM
      const injectionSuccess = DOM.injectElement(element, injectionPoint);
      if (!injectionSuccess) {
        throw new Error('Failed to inject element into DOM');
      }

      // Apply post-injection setup
      await this.setupInjectedComponent(element, component, options);

      // Store component references
      this.injectedComponents.set(component.id, component);
      this.componentElements.set(component.id, element);

      // Apply lifecycle hooks
      options.lifecycle?.afterInject?.(element);

      // Call success callback
      config.onSuccess?.(element);

      const result: InjectionResult = {
        success: true,
        element,
        componentId: component.id,
        timestamp: new Date(startTime),
        injectionPoint,
      };

      return result;
    } catch (error) {
      const injectionError = error instanceof Error ? error : new Error('Unknown injection error');

      // Call error callback
      config.onError?.(injectionError);

      return {
        success: false,
        error: injectionError,
        componentId: component.id,
        timestamp: new Date(startTime),
      };
    }
  }

  /**
   * Remove component from page
   */
  async removeComponent(componentId: string): Promise<boolean> {
    const component = this.injectedComponents.get(componentId);
    const element = this.componentElements.get(componentId);

    if (!component || !element) {
      return false;
    }

    try {
      // Apply lifecycle hooks
      component.cleanup?.();

      // Handle removal animation
      if (component.styling.isolation) {
        await this.animateRemoval(element);
      }

      // Remove from DOM
      DOM.removeElement(element);

      // Clean up references
      this.injectedComponents.delete(componentId);
      this.componentElements.delete(componentId);

      // Remove associated styles
      this.removeComponentStyles(componentId);

      return true;
    } catch (error) {
      console.error('Failed to remove component:', error);
      return false;
    }
  }

  /**
   * Update existing component
   */
  async updateComponent(update: ComponentUpdate): Promise<boolean> {
    const component = this.injectedComponents.get(update.componentId);
    const element = this.componentElements.get(update.componentId);

    if (!component || !element) {
      return false;
    }

    try {
      // Update component configuration
      if (update.props) {
        component.props = { ...component.props, ...update.props };
      }

      if (update.styling) {
        component.styling = { ...component.styling, ...update.styling };
      }

      // Apply updates to DOM element
      await this.applyComponentUpdates(element, component, update);

      // Trigger lifecycle hook
      // Apply lifecycle hook if it exists
      interface ComponentWithLifecycle {
        lifecycle?: LifecycleHooks;
      }
      const lifecycleHooks = (component as ComponentWithLifecycle).lifecycle;
      lifecycleHooks?.onUpdate?.(element, update);

      return true;
    } catch (error) {
      console.error('Failed to update component:', error);
      return false;
    }
  }

  /**
   * Get injected component element
   */
  getComponentElement(componentId: string): HTMLElement | null {
    return this.componentElements.get(componentId) || null;
  }

  /**
   * Get all injected components
   */
  getInjectedComponents(): UIComponent[] {
    return Array.from(this.injectedComponents.values());
  }

  /**
   * Check if component is injected
   */
  isComponentInjected(componentId: string): boolean {
    return this.injectedComponents.has(componentId);
  }

  /**
   * Remove all injected components
   */
  async removeAllComponents(): Promise<void> {
    const componentIds = Array.from(this.injectedComponents.keys());

    await Promise.all(componentIds.map(id => this.removeComponent(id)));
  }

  /**
   * Setup responsive behavior for component
   */
  setupResponsiveBehavior(element: HTMLElement, component: UIComponent): void {
    if (!this.resizeObserver) return;

    this.resizeObserver.observe(element);

    // Add resize handler
    const handleResize = () => {
      this.handleComponentResize(element, component);
    };

    eventManager.addEventListener(window, 'resize', handleResize, { passive: true });
  }

  /**
   * Find optimal injection point for component
   */
  private findOptimalInjectionPoint(component: UIComponent): InjectionPoint | null {
    // Use component's specified injection point
    if (component.injectionPoint) {
      if (DOM.validateInjectionPoint(component.injectionPoint)) {
        return component.injectionPoint;
      }
    }

    // Find fallback injection points
    const fallbackPoints: InjectionPoint[] = [
      {
        id: 'main-content',
        selector: 'main, [role="main"], .main-content',
        method: 'append',
        priority: 3,
        isAvailable: true,
      },
      {
        id: 'body-end',
        selector: 'body',
        method: 'append',
        priority: 2,
        isAvailable: true,
      },
      {
        id: 'document-end',
        selector: 'html',
        method: 'append',
        priority: 1,
        isAvailable: true,
      },
    ];

    return DOM.findInjectionPoint(fallbackPoints);
  }

  /**
   * Create component element with styling and configuration
   */
  private async createComponentElement(component: UIComponent, options: InjectionOptions): Promise<HTMLElement> {
    // Create base element based on component type
    let element: HTMLElement;

    switch (component.type) {
      case 'transcribe-button':
        element = this.createTranscribeButton(component);
        break;
      case 'progress-indicator':
        element = this.createProgressIndicator(component);
        break;
      case 'status-panel':
        element = this.createStatusPanel(component);
        break;
      case 'summary-display':
        element = this.createSummaryDisplay(component);
        break;
      default:
        element = DOM.createElement({
          tagName: 'div',
          attributes: { id: component.id },
          classes: ['meeting-summarizer-component'],
          styles: {},
        });
    }

    // Apply styling
    await this.applyComponentStyling(element, component, options);

    // Apply accessibility
    this.applyAccessibility(element, options.accessibility);

    // Setup responsive behavior
    if (options.responsive) {
      this.setupResponsiveBehavior(element, component);
    }

    return element;
  }

  /**
   * Create transcription button component
   */
  private createTranscribeButton(component: UIComponent): HTMLElement {
    const button = DOM.createElement({
      tagName: 'button',
      attributes: {
        id: component.id,
        type: 'button',
        'data-component-type': 'transcribe-button',
      },
      classes: ['meeting-summarizer-btn', 'transcribe-btn'],
      styles: {
        padding: '8px 16px',
        border: 'none',
        borderRadius: '4px',
        backgroundColor: '#0078d4',
        color: 'white',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '500',
      },
      textContent: component.props.text || 'Transcribe',
    });

    // Add hover effects
    eventManager.addEventListener(button, 'mouseenter', () => {
      button.style.backgroundColor = '#106ebe';
    });

    eventManager.addEventListener(button, 'mouseleave', () => {
      button.style.backgroundColor = '#0078d4';
    });

    return button;
  }

  /**
   * Create progress indicator component
   */
  private createProgressIndicator(component: UIComponent): HTMLElement {
    const container = DOM.createElement({
      tagName: 'div',
      attributes: {
        id: component.id,
        'data-component-type': 'progress-indicator',
      },
      classes: ['meeting-summarizer-progress'],
      styles: {
        padding: '12px',
        border: '1px solid #e0e0e0',
        borderRadius: '4px',
        backgroundColor: '#f9f9f9',
        minWidth: '200px',
      },
    });

    const progressBar = DOM.createElement({
      tagName: 'div',
      classes: ['progress-bar'],
      styles: {
        width: '100%',
        height: '8px',
        backgroundColor: '#e0e0e0',
        borderRadius: '4px',
        overflow: 'hidden',
      },
    });

    const progressFill = DOM.createElement({
      tagName: 'div',
      classes: ['progress-fill'],
      styles: {
        height: '100%',
        backgroundColor: '#0078d4',
        width: '0%',
        transition: 'width 0.3s ease',
      },
    });

    const progressText = DOM.createElement({
      tagName: 'div',
      classes: ['progress-text'],
      styles: {
        marginTop: '8px',
        fontSize: '12px',
        color: '#666',
        textAlign: 'center',
      },
      textContent: component.props.text || 'Processing...',
    });

    progressBar.appendChild(progressFill);
    container.appendChild(progressBar);
    container.appendChild(progressText);

    return container;
  }

  /**
   * Create status panel component
   */
  private createStatusPanel(component: UIComponent): HTMLElement {
    const panel = DOM.createElement({
      tagName: 'div',
      attributes: {
        id: component.id,
        'data-component-type': 'status-panel',
      },
      classes: ['meeting-summarizer-status'],
      styles: {
        padding: '16px',
        border: '1px solid #e0e0e0',
        borderRadius: '6px',
        backgroundColor: 'white',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        maxWidth: '400px',
      },
    });

    const title = DOM.createElement({
      tagName: 'h3',
      classes: ['status-title'],
      styles: {
        margin: '0 0 8px 0',
        fontSize: '16px',
        fontWeight: '600',
        color: '#333',
      },
      textContent: component.props.title || 'Status',
    });

    const message = DOM.createElement({
      tagName: 'p',
      classes: ['status-message'],
      styles: {
        margin: '0',
        fontSize: '14px',
        color: '#666',
        lineHeight: '1.4',
      },
      textContent: component.props.message || '',
    });

    panel.appendChild(title);
    panel.appendChild(message);

    return panel;
  }

  /**
   * Create summary display component
   */
  private createSummaryDisplay(component: UIComponent): HTMLElement {
    const display = DOM.createElement({
      tagName: 'div',
      attributes: {
        id: component.id,
        'data-component-type': 'summary-display',
      },
      classes: ['meeting-summarizer-summary'],
      styles: {
        padding: '20px',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        backgroundColor: 'white',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        maxWidth: '600px',
        maxHeight: '400px',
        overflow: 'auto',
      },
    });

    return display;
  }

  /**
   * Apply component styling with isolation
   */
  private async applyComponentStyling(
    element: HTMLElement,
    component: UIComponent,
    options: InjectionOptions,
  ): Promise<void> {
    // Apply style isolation if requested
    if (options.isolateStyles || component.styling.isolation) {
      DOM.applyStyleIsolation(element);
    }

    // Apply theme adaptation
    if (component.styling.themeAdaptation) {
      this.applyThemeAdaptation(element);
    }

    // Apply custom CSS
    if (options.customCSS) {
      this.applyCustomCSS(component.id, options.customCSS);
    }

    // Apply responsive classes
    if (component.styling.responsiveBreakpoints.length > 0) {
      this.applyResponsiveClasses(element, component.styling.responsiveBreakpoints);
    }
  }

  /**
   * Setup injected component with animation and event handlers
   */
  private async setupInjectedComponent(
    element: HTMLElement,
    component: UIComponent,
    options: InjectionOptions,
  ): Promise<void> {
    // Apply entrance animation
    if (options.animation && options.animation.type !== 'none') {
      await this.animateEntrance(element, options.animation);
    }

    // Setup component event handlers
    this.setupComponentEventHandlers(element, component);

    // Mark component as ready
    element.setAttribute('data-component-ready', 'true');
  }

  /**
   * Apply theme adaptation to component
   */
  private applyThemeAdaptation(element: HTMLElement): void {
    // Detect current page theme
    const isDarkMode = this.detectDarkMode();

    if (isDarkMode) {
      element.classList.add('dark-theme');
      // Apply dark theme styles
      this.applyDarkThemeStyles(element);
    } else {
      element.classList.add('light-theme');
      // Apply light theme styles
      this.applyLightThemeStyles(element);
    }
  }

  /**
   * Detect if page is using dark mode
   */
  private detectDarkMode(): boolean {
    // Check CSS variables or computed styles
    const rootStyle = getComputedStyle(document.documentElement);
    const bgColor = rootStyle.backgroundColor || rootStyle.getPropertyValue('--background-color');

    // Simple heuristic: if background is dark, assume dark mode
    if (bgColor.includes('rgb')) {
      const rgbValues = bgColor.match(/\d+/g);
      if (rgbValues && rgbValues.length >= 3) {
        const avg = (parseInt(rgbValues[0]) + parseInt(rgbValues[1]) + parseInt(rgbValues[2])) / 3;
        return avg < 128;
      }
    }

    // Check for common dark mode indicators
    return (
      document.body.classList.contains('dark') ||
      document.body.classList.contains('dark-mode') ||
      document.documentElement.classList.contains('dark-theme')
    );
  }

  /**
   * Apply dark theme styles
   */
  private applyDarkThemeStyles(element: HTMLElement): void {
    element.style.setProperty('--bg-color', '#2d2d2d');
    element.style.setProperty('--text-color', '#ffffff');
    element.style.setProperty('--border-color', '#555555');
  }

  /**
   * Apply light theme styles
   */
  private applyLightThemeStyles(element: HTMLElement): void {
    element.style.setProperty('--bg-color', '#ffffff');
    element.style.setProperty('--text-color', '#333333');
    element.style.setProperty('--border-color', '#e0e0e0');
  }

  /**
   * Apply custom CSS for component
   */
  private applyCustomCSS(componentId: string, css: string): void {
    const styleId = `component-${componentId}`;
    DOM.createStyleSheet(styleId, css);
    this.styleSheets.set(componentId, styleId);
  }

  /**
   * Remove component styles
   */
  private removeComponentStyles(componentId: string): void {
    const styleId = this.styleSheets.get(componentId);
    if (styleId) {
      DOM.removeStyleSheet(styleId);
      this.styleSheets.delete(componentId);
    }
  }

  /**
   * Apply responsive classes
   */
  private applyResponsiveClasses(element: HTMLElement, breakpoints: string[]): void {
    breakpoints.forEach(breakpoint => {
      element.classList.add(`responsive-${breakpoint}`);
    });
  }

  /**
   * Apply accessibility configuration
   */
  private applyAccessibility(element: HTMLElement, config?: AccessibilityConfig): void {
    if (!config) return;

    if (config.ariaLabel) {
      element.setAttribute('aria-label', config.ariaLabel);
    }

    if (config.ariaRole) {
      element.setAttribute('role', config.ariaRole);
    }

    if (config.ariaDescribedBy) {
      element.setAttribute('aria-describedby', config.ariaDescribedBy);
    }

    if (config.tabIndex !== undefined) {
      element.setAttribute('tabindex', config.tabIndex.toString());
    }

    if (config.focusable) {
      element.setAttribute('tabindex', '0');
    }

    if (config.keyboardNavigation) {
      this.setupKeyboardNavigation(element);
    }
  }

  /**
   * Setup keyboard navigation for component
   */
  private setupKeyboardNavigation(element: HTMLElement): void {
    eventManager.addEventListener(element, 'keydown', event => {
      const keyEvent = event as KeyboardEvent;

      switch (keyEvent.key) {
        case 'Enter':
        case ' ':
          // Trigger click for interactive elements
          if (element.click) {
            keyEvent.preventDefault();
            element.click();
          }
          break;
        case 'Escape':
          // Close component if applicable
          if (element.classList.contains('closeable')) {
            const componentId = element.id;
            this.removeComponent(componentId);
          }
          break;
      }
    });
  }

  /**
   * Setup component event handlers
   */
  private setupComponentEventHandlers(element: HTMLElement, component: UIComponent): void {
    component.eventHandlers.forEach(handlerConfig => {
      eventManager.registerHandler({
        ...handlerConfig,
        selector: `#${component.id}`,
      });
    });
  }

  /**
   * Animate component entrance
   */
  private async animateEntrance(element: HTMLElement, config: AnimationConfig): Promise<void> {
    return new Promise(resolve => {
      const { type, duration, easing, delay = 0 } = config;

      // Set initial state
      switch (type) {
        case 'fade':
          element.style.opacity = '0';
          break;
        case 'slide':
          element.style.transform = 'translateY(-20px)';
          element.style.opacity = '0';
          break;
        case 'scale':
          element.style.transform = 'scale(0.8)';
          element.style.opacity = '0';
          break;
      }

      // Apply transition
      element.style.transition = `all ${duration}ms ${easing}`;

      // Start animation after delay
      setTimeout(() => {
        switch (type) {
          case 'fade':
            element.style.opacity = '1';
            break;
          case 'slide':
            element.style.transform = 'translateY(0)';
            element.style.opacity = '1';
            break;
          case 'scale':
            element.style.transform = 'scale(1)';
            element.style.opacity = '1';
            break;
        }

        // Clean up after animation
        setTimeout(() => {
          element.style.transition = '';
          resolve();
        }, duration);
      }, delay);
    });
  }

  /**
   * Animate component removal
   */
  private async animateRemoval(element: HTMLElement): Promise<void> {
    return new Promise(resolve => {
      element.style.transition = 'all 300ms ease-out';
      element.style.opacity = '0';
      element.style.transform = 'scale(0.8)';

      setTimeout(() => {
        resolve();
      }, 300);
    });
  }

  /**
   * Apply component updates
   */
  private async applyComponentUpdates(
    element: HTMLElement,
    component: UIComponent,
    update: ComponentUpdate,
  ): Promise<void> {
    // Update properties
    if (update.props) {
      Object.entries(update.props).forEach(([key, value]) => {
        if (key === 'text' && element.textContent !== undefined) {
          element.textContent = value;
        }
        // Add more property updates as needed
      });
    }

    // Update styling
    if (update.styling) {
      // Apply new styles
      Object.entries(update.styling).forEach(([key, value]) => {
        // Apply styling updates
        if (key === 'customClasses' && Array.isArray(value)) {
          value.forEach(className => element.classList.add(className));
        }
      });
    }

    // Apply update animation
    if (update.animation) {
      await this.animateUpdate(element, update.animation);
    }
  }

  /**
   * Animate component update
   */
  private async animateUpdate(element: HTMLElement, config: AnimationConfig): Promise<void> {
    return new Promise(resolve => {
      const { duration, easing } = config;

      // Add update highlight effect
      element.style.transition = `background-color ${duration}ms ${easing}`;
      const originalBg = element.style.backgroundColor;

      element.style.backgroundColor = '#fff3cd';

      setTimeout(() => {
        element.style.backgroundColor = originalBg;

        setTimeout(() => {
          element.style.transition = '';
          resolve();
        }, duration);
      }, 100);
    });
  }

  /**
   * Handle component resize
   */
  private handleComponentResize(element: HTMLElement, _component: UIComponent): void {
    const rect = element.getBoundingClientRect();

    // Apply responsive adjustments based on size
    if (rect.width < 300) {
      element.classList.add('compact');
    } else {
      element.classList.remove('compact');
    }

    if (rect.width < 200) {
      element.classList.add('mini');
    } else {
      element.classList.remove('mini');
    }
  }

  /**
   * Initialize resize observer
   */
  private initializeResizeObserver(): void {
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(entries => {
        entries.forEach(entry => {
          const element = entry.target as HTMLElement;
          const componentId = element.id;
          const component = this.injectedComponents.get(componentId);

          if (component) {
            this.handleComponentResize(element, component);
          }
        });
      });
    }
  }

  /**
   * Setup global styles for all components
   */
  private setupGlobalStyles(): void {
    const globalCSS = `
      .meeting-summarizer-component {
        box-sizing: border-box;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        line-height: 1.4;
      }
      
      .meeting-summarizer-component * {
        box-sizing: border-box;
      }
      
      .meeting-summarizer-component.compact {
        font-size: 12px;
        padding: 8px;
      }
      
      .meeting-summarizer-component.mini {
        font-size: 11px;
        padding: 4px;
      }
      
      .meeting-summarizer-component.dark-theme {
        background-color: var(--bg-color, #2d2d2d);
        color: var(--text-color, #ffffff);
        border-color: var(--border-color, #555555);
      }
      
      .meeting-summarizer-component.light-theme {
        background-color: var(--bg-color, #ffffff);
        color: var(--text-color, #333333);
        border-color: var(--border-color, #e0e0e0);
      }
    `;

    DOM.createStyleSheet('global-components', globalCSS);
  }
}

// Export singleton instance
export const injectionController = UIInjectionController.getInstance();

// Export utility functions
export const injectionUtils = {
  /**
   * Get injection controller instance
   */
  getInstance: () => injectionController,

  /**
   * Quick component injection
   */
  inject: async (component: UIComponent, options: Partial<InjectionOptions> = {}): Promise<InjectionResult> => {
    const config: ComponentInjectionConfig = {
      component,
      options: {
        isolateStyles: true,
        responsive: true,
        ...options,
      },
    };

    return injectionController.injectComponent(config);
  },

  /**
   * Quick component removal
   */
  remove: (componentId: string): Promise<boolean> => injectionController.removeComponent(componentId),

  /**
   * Cleanup all components
   */
  cleanup: (): Promise<void> => injectionController.removeAllComponents(),
};
