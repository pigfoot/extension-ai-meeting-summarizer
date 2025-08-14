/**
 * Event Manager
 *
 * Event listener registration and cleanup with event delegation
 * and memory leak prevention for content scripts.
 */

import { domUtils } from './dom-utils';
import type { EventHandlerConfig } from '../types/content-script';

/**
 * Event listener registration with cleanup tracking
 */
export interface EventListenerRegistration {
  /** Unique registration ID */
  id: string;
  /** Target element */
  target: Element | Window | Document;
  /** Event type */
  eventType: string;
  /** Event handler function */
  handler: EventListener;
  /** Listener options */
  options?: AddEventListenerOptions;
  /** Cleanup function */
  cleanup: () => void;
  /** Registration timestamp */
  registeredAt: Date;
  /** Whether listener is active */
  isActive: boolean;
}

/**
 * Event delegation configuration
 */
export interface EventDelegationConfig {
  /** Container element for delegation */
  container: Element;
  /** Target selector for delegation */
  targetSelector: string;
  /** Event type */
  eventType: string;
  /** Delegated event handler */
  handler: (event: Event, target: Element) => void;
  /** Handler options */
  options?: AddEventListenerOptions;
}

/**
 * Throttle/debounce configuration for event handlers
 */
export interface ThrottleDebounceConfig {
  /** Throttle delay in milliseconds */
  throttleDelay?: number;
  /** Debounce delay in milliseconds */
  debounceDelay?: number;
  /** Leading edge execution for throttle */
  leading?: boolean;
  /** Trailing edge execution for throttle */
  trailing?: boolean;
}

/**
 * Event manager for content script event handling
 */
export class EventManager {
  private static instance: EventManager;
  private registrations: Map<string, EventListenerRegistration> = new Map();
  private delegationHandlers: Map<string, EventListener> = new Map();
  private throttledHandlers: Map<string, (...args: unknown[]) => unknown> = new Map();
  private debouncedHandlers: Map<string, (...args: unknown[]) => unknown> = new Map();
  private nextId: number = 1;

  /**
   * Get singleton instance
   */
  static getInstance(): EventManager {
    if (!EventManager.instance) {
      EventManager.instance = new EventManager();
    }
    return EventManager.instance;
  }

  /**
   * Register event listener with automatic cleanup tracking
   */
  addEventListener(
    target: Element | Window | Document,
    eventType: string,
    handler: EventListener,
    options?: AddEventListenerOptions,
  ): string {
    const id = this.generateId();

    // Create cleanup function
    const cleanup = () => {
      try {
        target.removeEventListener(eventType, handler, options);
        this.registrations.delete(id);
      } catch (error) {
        console.warn('Failed to remove event listener:', error);
      }
    };

    // Add event listener
    target.addEventListener(eventType, handler, options);

    // Track registration
    const registration: EventListenerRegistration = {
      id,
      target,
      eventType,
      handler,
      options,
      cleanup,
      registeredAt: new Date(),
      isActive: true,
    };

    this.registrations.set(id, registration);
    return id;
  }

  /**
   * Remove event listener by registration ID
   */
  removeEventListener(registrationId: string): boolean {
    const registration = this.registrations.get(registrationId);
    if (!registration) {
      return false;
    }

    registration.cleanup();
    registration.isActive = false;
    return true;
  }

  /**
   * Set up event delegation for dynamic content
   */
  setupEventDelegation(config: EventDelegationConfig): string {
    const id = this.generateId();

    // Create delegated event handler
    const delegatedHandler = (event: Event) => {
      const target = event.target as Element;
      if (!target) return;

      // Find matching target element
      const matchingTarget = this.findMatchingTarget(target, config.targetSelector, config.container);
      if (matchingTarget) {
        config.handler(event, matchingTarget);
      }
    };

    // Register the delegated handler
    const registrationId = this.addEventListener(config.container, config.eventType, delegatedHandler, config.options);

    // Store delegation handler
    this.delegationHandlers.set(id, delegatedHandler);

    return registrationId;
  }

  /**
   * Create throttled event handler
   */
  createThrottledHandler<T extends (...args: unknown[]) => unknown>(
    handler: T,
    delay: number,
    options: { leading?: boolean; trailing?: boolean } = {},
  ): T {
    const id = this.generateId();
    let lastCall = 0;
    let timeoutId: NodeJS.Timeout | null = null;
    let _lastArgs: Parameters<T>;

    const throttledFunction = ((...args: Parameters<T>) => {
      lastArgs = args;
      const now = Date.now();

      const callFunction = () => {
        lastCall = now;
        return handler(...args);
      };

      if (lastCall === 0 && options.leading !== false) {
        return callFunction();
      }

      if (now - lastCall >= delay) {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        return callFunction();
      }

      if (!timeoutId && options.trailing !== false) {
        timeoutId = setTimeout(
          () => {
            timeoutId = null;
            if (options.trailing !== false) {
              callFunction();
            }
          },
          delay - (now - lastCall),
        );
      }
    }) as T;

    this.throttledHandlers.set(id, throttledFunction);
    return throttledFunction;
  }

  /**
   * Create debounced event handler
   */
  createDebouncedHandler<T extends (...args: unknown[]) => unknown>(
    handler: T,
    delay: number,
    immediate: boolean = false,
  ): T {
    const id = this.generateId();
    let timeoutId: NodeJS.Timeout | null = null;

    const debouncedFunction = ((...args: Parameters<T>) => {
      const callNow = immediate && !timeoutId;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        timeoutId = null;
        if (!immediate) {
          handler(...args);
        }
      }, delay);

      if (callNow) {
        handler(...args);
      }
    }) as T;

    this.debouncedHandlers.set(id, debouncedFunction);
    return debouncedFunction;
  }

  /**
   * Register event handler with configuration
   */
  registerHandler(config: EventHandlerConfig): string {
    const target = config.selector ? document.querySelector(config.selector) : document;

    if (!target) {
      throw new Error(`Target element not found: ${config.selector}`);
    }

    let handler = config.handler;

    // Apply throttling/debouncing if needed
    if (this.shouldThrottleEvent(config.eventType)) {
      handler = this.createThrottledHandler(handler, 100);
    }

    // Handle conflict resolution
    if (this.hasConflictingHandler(target, config.eventType)) {
      switch (config.conflictResolution) {
        case 'ignore':
          return '';
        case 'override':
          this.removeConflictingHandlers(target, config.eventType);
          break;
        case 'chain':
          handler = this.createChainedHandler(target, config.eventType, handler);
          break;
      }
    }

    const registrationId = this.addEventListener(target, config.eventType, handler, config.options);

    // Update registration with config info
    const registration = this.registrations.get(registrationId);
    if (registration) {
      // TypeScript doesn't allow direct modification of readonly properties
      // but we need to update the registration config
      Object.assign(registration, { config, priority: config.priority });
    }

    return registrationId;
  }

  /**
   * Remove all event listeners
   */
  removeAllEventListeners(): void {
    const registrationIds = Array.from(this.registrations.keys());
    registrationIds.forEach(id => this.removeEventListener(id));

    // Clear handler caches
    this.delegationHandlers.clear();
    this.throttledHandlers.clear();
    this.debouncedHandlers.clear();
  }

  /**
   * Get active event listeners count
   */
  getActiveListenerCount(): number {
    return Array.from(this.registrations.values()).filter(reg => reg.isActive).length;
  }

  /**
   * Get event listener statistics
   */
  getStatistics(): {
    total: number;
    active: number;
    byEventType: Record<string, number>;
    byTarget: Record<string, number>;
    registrationDates: Date[];
  } {
    const stats = {
      total: this.registrations.size,
      active: 0,
      byEventType: {} as Record<string, number>,
      byTarget: {} as Record<string, number>,
      registrationDates: [] as Date[],
    };

    this.registrations.forEach(registration => {
      if (registration.isActive) {
        stats.active++;
      }

      // Count by event type
      stats.byEventType[registration.eventType] = (stats.byEventType[registration.eventType] || 0) + 1;

      // Count by target type
      const targetType = this.getTargetType(registration.target);
      stats.byTarget[targetType] = (stats.byTarget[targetType] || 0) + 1;

      stats.registrationDates.push(registration.registeredAt);
    });

    return stats;
  }

  /**
   * Clean up inactive listeners
   */
  cleanupInactiveListeners(): number {
    const inactiveIds: string[] = [];

    this.registrations.forEach((registration, id) => {
      if (!registration.isActive) {
        inactiveIds.push(id);
      }
    });

    inactiveIds.forEach(id => {
      this.registrations.delete(id);
    });

    return inactiveIds.length;
  }

  /**
   * Create safe event handler with error handling
   */
  createSafeHandler(handler: EventListener): EventListener {
    return (event: Event) => {
      try {
        handler(event);
      } catch (error) {
        console.error('Event handler error:', error);
        // Optionally report error to background service
        this.reportHandlerError(error, event);
      }
    };
  }

  /**
   * Add keyboard shortcut handler
   */
  addKeyboardShortcut(
    keys: string[],
    handler: (event: KeyboardEvent) => void,
    options: { preventDefault?: boolean; stopPropagation?: boolean } = {},
  ): string {
    const keyHandler = (event: KeyboardEvent) => {
      if (this.matchesKeyCombo(event, keys)) {
        if (options.preventDefault) {
          event.preventDefault();
        }
        if (options.stopPropagation) {
          event.stopPropagation();
        }
        handler(event);
      }
    };

    return this.addEventListener(document, 'keydown', keyHandler, { passive: false });
  }

  /**
   * Generate unique registration ID
   */
  private generateId(): string {
    return `event-${this.nextId++}-${Date.now()}`;
  }

  /**
   * Find matching target element for delegation
   */
  private findMatchingTarget(element: Element, selector: string, container: Element): Element | null {
    let current: Element | null = element;

    while (current && current !== container) {
      if (domUtils.getInstance().matches(current, selector)) {
        return current;
      }
      current = current.parentElement;
    }

    return null;
  }

  /**
   * Check if event type should be throttled
   */
  private shouldThrottleEvent(eventType: string): boolean {
    const throttledEvents = ['scroll', 'resize', 'mousemove', 'pointermove'];
    return throttledEvents.includes(eventType);
  }

  /**
   * Check for conflicting handlers
   */
  private hasConflictingHandler(target: Element | Window | Document, eventType: string): boolean {
    return Array.from(this.registrations.values()).some(
      reg => reg.target === target && reg.eventType === eventType && reg.isActive,
    );
  }

  /**
   * Remove conflicting handlers
   */
  private removeConflictingHandlers(target: Element | Window | Document, eventType: string): void {
    const conflictingIds: string[] = [];

    this.registrations.forEach((registration, id) => {
      if (registration.target === target && registration.eventType === eventType && registration.isActive) {
        conflictingIds.push(id);
      }
    });

    conflictingIds.forEach(id => this.removeEventListener(id));
  }

  /**
   * Create chained handler
   */
  private createChainedHandler(
    target: Element | Window | Document,
    eventType: string,
    newHandler: EventListener,
  ): EventListener {
    const existingHandlers: EventListener[] = [];

    this.registrations.forEach(registration => {
      if (registration.target === target && registration.eventType === eventType && registration.isActive) {
        existingHandlers.push(registration.handler);
      }
    });

    return (event: Event) => {
      // Execute existing handlers first
      existingHandlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.warn('Chained handler error:', error);
        }
      });

      // Execute new handler
      newHandler(event);
    };
  }

  /**
   * Get target type description
   */
  private getTargetType(target: Element | Window | Document): string {
    if (target === window) return 'window';
    if (target === document) return 'document';
    if (target instanceof Element) return target.tagName.toLowerCase();
    return 'unknown';
  }

  /**
   * Report handler error
   */
  private reportHandlerError(error: Error | unknown, event: Event): void {
    // Create error report
    const errorReport = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      eventType: event.type,
      targetElement: event.target,
      timestamp: new Date().toISOString(),
    };

    // Log error
    console.error('Event handler error reported:', errorReport);

    // TODO: Send to background service for logging
  }

  /**
   * Check if keyboard event matches key combination
   */
  private matchesKeyCombo(event: KeyboardEvent, keys: string[]): boolean {
    const pressedKeys = [];

    if (event.ctrlKey) pressedKeys.push('ctrl');
    if (event.altKey) pressedKeys.push('alt');
    if (event.shiftKey) pressedKeys.push('shift');
    if (event.metaKey) pressedKeys.push('meta');

    pressedKeys.push(event.key.toLowerCase());

    return keys.length === pressedKeys.length && keys.every(key => pressedKeys.includes(key.toLowerCase()));
  }
}

// Export singleton instance
export const eventManager = EventManager.getInstance();

// Export utility functions
export const eventUtils = {
  /**
   * Create safe event listener
   */
  createSafeListener: (handler: EventListener): EventListener => eventManager.createSafeHandler(handler),

  /**
   * Add event listener with cleanup
   */
  addListener: (
    target: Element | Window | Document,
    event: string,
    handler: EventListener,
    options?: AddEventListenerOptions,
  ): (() => void) => {
    const id = eventManager.addEventListener(target, event, handler, options);
    return () => eventManager.removeEventListener(id);
  },

  /**
   * Add delegated event listener
   */
  addDelegatedListener: (
    container: Element,
    selector: string,
    event: string,
    handler: (event: Event, target: Element) => void,
    options?: AddEventListenerOptions,
  ): (() => void) => {
    const id = eventManager.setupEventDelegation({
      container,
      targetSelector: selector,
      eventType: event,
      handler,
      options,
    });
    return () => eventManager.removeEventListener(id);
  },

  /**
   * Throttle function
   */
  throttle: <T extends (...args: unknown[]) => unknown>(fn: T, delay: number): T =>
    eventManager.createThrottledHandler(fn, delay),

  /**
   * Debounce function
   */
  debounce: <T extends (...args: unknown[]) => unknown>(fn: T, delay: number): T =>
    eventManager.createDebouncedHandler(fn, delay),

  /**
   * Get event manager instance
   */
  getInstance: () => eventManager,

  /**
   * Clean up all event listeners
   */
  cleanup: () => {
    eventManager.removeAllEventListeners();
  },
};
