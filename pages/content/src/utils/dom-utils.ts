/**
 * DOM Utilities
 *
 * Safe DOM manipulation and injection utilities for content scripts.
 * Provides cross-browser compatible DOM operations with proper cleanup.
 */

import type { InjectionPoint, ElementConfig, DOMManipulator } from '../types/content-script';

/**
 * Safe DOM manipulation utilities
 */
export class DOMUtils implements DOMManipulator {
  private static instance: DOMUtils;
  private injectedElements: WeakSet<HTMLElement> = new WeakSet();
  private styleSheets: Map<string, CSSStyleSheet> = new Map();

  /**
   * Get singleton instance
   */
  static getInstance(): DOMUtils {
    if (!DOMUtils.instance) {
      DOMUtils.instance = new DOMUtils();
    }
    return DOMUtils.instance;
  }

  /**
   * Safely inject element into DOM at specified injection point
   */
  injectElement(element: HTMLElement, injectionPoint: InjectionPoint): boolean {
    try {
      if (!this.validateInjectionPoint(injectionPoint)) {
        return false;
      }

      const targetElement = document.querySelector(injectionPoint.selector);
      if (!targetElement) {
        return false;
      }

      // Apply safety attributes
      this.applySafetyAttributes(element);

      // Perform injection based on method
      switch (injectionPoint.method) {
        case 'append':
          targetElement.appendChild(element);
          break;
        case 'prepend':
          targetElement.insertBefore(element, targetElement.firstChild);
          break;
        case 'replace':
          if (targetElement.parentNode) {
            targetElement.parentNode.replaceChild(element, targetElement);
          }
          break;
        case 'overlay':
          this.createOverlay(element, targetElement);
          break;
        case 'before':
          if (targetElement.parentNode) {
            targetElement.parentNode.insertBefore(element, targetElement);
          }
          break;
        case 'after':
          if (targetElement.parentNode && targetElement.nextSibling) {
            targetElement.parentNode.insertBefore(element, targetElement.nextSibling);
          } else if (targetElement.parentNode) {
            targetElement.parentNode.appendChild(element);
          }
          break;
        default:
          return false;
      }

      // Track injected element
      this.injectedElements.add(element);

      // Mark element as injected by extension
      element.setAttribute('data-meeting-summarizer-injected', 'true');

      return true;
    } catch (error) {
      console.error('Failed to inject element:', error);
      return false;
    }
  }

  /**
   * Remove element from DOM with proper cleanup
   */
  removeElement(element: HTMLElement): void {
    try {
      // Clean up event listeners
      this.cleanupElementEventListeners(element);

      // Remove from parent
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }

      // Remove from tracking
      this.injectedElements.delete(element);

      // Clean up any child elements
      const childElements = element.querySelectorAll('[data-meeting-summarizer-injected]');
      childElements.forEach(child => {
        if (child instanceof HTMLElement) {
          this.injectedElements.delete(child);
        }
      });
    } catch (error) {
      console.error('Failed to remove element:', error);
    }
  }

  /**
   * Find optimal injection point from available options
   */
  findInjectionPoint(candidates: InjectionPoint[]): InjectionPoint | null {
    // Sort by priority (higher priority first)
    const sortedCandidates = candidates
      .filter(point => this.validateInjectionPoint(point))
      .sort((a, b) => b.priority - a.priority);

    // Return first valid candidate
    for (const candidate of sortedCandidates) {
      if (candidate.isAvailable && document.querySelector(candidate.selector)) {
        return candidate;
      }
    }

    // Try fallbacks
    for (const candidate of sortedCandidates) {
      if (candidate.fallbacks) {
        const fallbackPoint = this.findInjectionPoint(candidate.fallbacks);
        if (fallbackPoint) {
          return fallbackPoint;
        }
      }
    }

    return null;
  }

  /**
   * Validate that injection point is still available
   */
  validateInjectionPoint(injectionPoint: InjectionPoint): boolean {
    try {
      // Check if selector is valid
      document.querySelector(injectionPoint.selector);

      // Run custom validation if provided
      if (injectionPoint.validate && !injectionPoint.validate()) {
        return false;
      }

      // Check if target element exists
      const targetElement = document.querySelector(injectionPoint.selector);
      return targetElement !== null;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Create element with proper styling and attributes
   */
  createElement(config: ElementConfig): HTMLElement {
    const element = document.createElement(config.tagName);

    // Set attributes
    Object.entries(config.attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });

    // Set classes
    if (config.classes.length > 0) {
      element.className = config.classes.join(' ');
    }

    // Set styles
    Object.entries(config.styles).forEach(([property, value]) => {
      element.style.setProperty(property, value);
    });

    // Set text content
    if (config.textContent) {
      element.textContent = config.textContent;
    }

    // Add child elements
    if (config.children) {
      config.children.forEach(childConfig => {
        const childElement = this.createElement(childConfig);
        element.appendChild(childElement);
      });
    }

    return element;
  }

  /**
   * Apply CSS isolation to prevent style conflicts
   */
  applyStyleIsolation(element: HTMLElement): void {
    // Create shadow DOM if supported
    if (element.attachShadow && typeof element.attachShadow === 'function') {
      try {
        const shadowRoot = element.attachShadow({ mode: 'closed' });

        // Move element content to shadow DOM
        while (element.firstChild) {
          shadowRoot.appendChild(element.firstChild);
        }

        return;
      } catch (_error) {
        // Fallback to CSS isolation
      }
    }

    // Fallback: Apply CSS containment
    element.style.contain = 'layout style paint';
    element.style.isolation = 'isolate';

    // Add namespace prefix to prevent conflicts
    const originalClassName = element.className;
    element.className = `meeting-summarizer-isolated ${originalClassName}`;
  }

  /**
   * Get all elements injected by the extension
   */
  getInjectedElements(): HTMLElement[] {
    return Array.from(document.querySelectorAll('[data-meeting-summarizer-injected="true"]')).filter(
      el => el instanceof HTMLElement,
    ) as HTMLElement[];
  }

  /**
   * Clean up all injected elements
   */
  cleanupAllInjectedElements(): void {
    const injectedElements = this.getInjectedElements();
    injectedElements.forEach(element => this.removeElement(element));
  }

  /**
   * Create CSS stylesheet for the extension
   */
  createStyleSheet(id: string, css: string): void {
    // Remove existing stylesheet if it exists
    this.removeStyleSheet(id);

    const style = document.createElement('style');
    style.id = `meeting-summarizer-styles-${id}`;
    style.textContent = css;

    // Inject into head
    (document.head || document.documentElement).appendChild(style);

    // Store reference
    if (style.sheet) {
      this.styleSheets.set(id, style.sheet);
    }
  }

  /**
   * Remove CSS stylesheet
   */
  removeStyleSheet(id: string): void {
    const existingStyle = document.getElementById(`meeting-summarizer-styles-${id}`);
    if (existingStyle) {
      existingStyle.remove();
    }
    this.styleSheets.delete(id);
  }

  /**
   * Check if element is visible in viewport
   */
  isElementVisible(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    const windowWidth = window.innerWidth || document.documentElement.clientWidth;

    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= windowHeight &&
      rect.right <= windowWidth &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  /**
   * Wait for element to appear in DOM
   */
  waitForElement(selector: string, timeout: number = 5000): Promise<Element | null> {
    return new Promise(resolve => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      // Timeout fallback
      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  }

  /**
   * Get element's computed styles
   */
  getComputedStyles(element: HTMLElement): CSSStyleDeclaration {
    return window.getComputedStyle(element);
  }

  /**
   * Check if element matches selector (cross-browser)
   */
  matches(element: Element, selector: string): boolean {
    if (element.matches) {
      return element.matches(selector);
    }

    // Fallback for older browsers
    interface ElementWithLegacyMethods extends Element {
      matchesSelector?: (selector: string) => boolean;
      msMatchesSelector?: (selector: string) => boolean;
      mozMatchesSelector?: (selector: string) => boolean;
      webkitMatchesSelector?: (selector: string) => boolean;
    }

    const elementWithLegacy = element as ElementWithLegacyMethods;
    const matches =
      elementWithLegacy.matchesSelector ||
      elementWithLegacy.msMatchesSelector ||
      elementWithLegacy.mozMatchesSelector ||
      elementWithLegacy.webkitMatchesSelector;

    if (matches) {
      return matches.call(element, selector);
    }

    // Final fallback
    const elements = (element.parentNode || document).querySelectorAll(selector);
    return Array.from(elements).includes(element);
  }

  /**
   * Safely set innerHTML with sanitization
   */
  setInnerHTML(element: HTMLElement, html: string): void {
    // Basic HTML sanitization
    const sanitizedHTML = this.sanitizeHTML(html);
    element.innerHTML = sanitizedHTML;
  }

  /**
   * Basic HTML sanitization
   */
  private sanitizeHTML(html: string): string {
    // Remove script tags and event handlers
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/\s*on\w+\s*=\s*"[^"]*"/gi, '')
      .replace(/\s*on\w+\s*=\s*'[^']*'/gi, '')
      .replace(/javascript:/gi, '');
  }

  /**
   * Apply safety attributes to prevent conflicts
   */
  private applySafetyAttributes(element: HTMLElement): void {
    // Prevent event bubbling conflicts
    element.style.pointerEvents = element.style.pointerEvents || 'auto';

    // Set z-index to ensure proper layering
    if (!element.style.zIndex && !element.style.position) {
      element.style.position = 'relative';
      element.style.zIndex = '10000';
    }

    // Add extension identifier
    element.setAttribute('data-extension', 'meeting-summarizer');
    element.setAttribute('data-version', '1.0.0');
  }

  /**
   * Create overlay positioning
   */
  private createOverlay(overlay: HTMLElement, target: HTMLElement): void {
    // Set overlay positioning
    overlay.style.position = 'absolute';
    overlay.style.zIndex = '10001';

    // Position relative to target
    const rect = target.getBoundingClientRect();
    overlay.style.top = `${rect.top + window.scrollY}px`;
    overlay.style.left = `${rect.left + window.scrollX}px`;

    // Append to body to avoid clipping
    document.body.appendChild(overlay);

    // Update position on scroll/resize
    const updatePosition = () => {
      const newRect = target.getBoundingClientRect();
      overlay.style.top = `${newRect.top + window.scrollY}px`;
      overlay.style.left = `${newRect.left + window.scrollX}px`;
    };

    window.addEventListener('scroll', updatePosition, { passive: true });
    window.addEventListener('resize', updatePosition, { passive: true });

    // Store cleanup functions
    interface ElementWithCleanup extends HTMLElement {
      _cleanupFunctions?: (() => void)[];
    }

    (overlay as ElementWithCleanup)._cleanupFunctions = [
      () => window.removeEventListener('scroll', updatePosition),
      () => window.removeEventListener('resize', updatePosition),
    ];
  }

  /**
   * Clean up event listeners for element
   */
  private cleanupElementEventListeners(element: HTMLElement): void {
    // Run stored cleanup functions
    interface ElementWithCleanup extends HTMLElement {
      _cleanupFunctions?: (() => void)[];
    }

    const cleanupFunctions = (element as ElementWithCleanup)._cleanupFunctions;
    if (Array.isArray(cleanupFunctions)) {
      cleanupFunctions.forEach(cleanup => {
        try {
          cleanup();
        } catch (error) {
          console.warn('Failed to run cleanup function:', error);
        }
      });
    }

    // Remove all data attributes
    Array.from(element.attributes).forEach(attr => {
      if (attr.name.startsWith('data-meeting-summarizer-')) {
        element.removeAttribute(attr.name);
      }
    });
  }
}

/**
 * Utility functions for common DOM operations
 */
export const domUtils = {
  /**
   * Get DOM utilities instance
   */
  getInstance: () => DOMUtils.getInstance(),

  /**
   * Create a safe DOM element
   */
  createElement: (tagName: string, options: Partial<ElementConfig> = {}): HTMLElement => {
    const config: ElementConfig = {
      tagName,
      attributes: options.attributes || {},
      classes: options.classes || [],
      styles: options.styles || {},
      textContent: options.textContent,
      children: options.children,
    };
    return DOMUtils.getInstance().createElement(config);
  },

  /**
   * Find element with timeout
   */
  findElement: (selector: string, timeout?: number): Promise<Element | null> =>
    DOMUtils.getInstance().waitForElement(selector, timeout),

  /**
   * Check if selector is valid
   */
  isValidSelector: (selector: string): boolean => {
    try {
      document.querySelector(selector);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Get element's position relative to viewport
   */
  getElementPosition: (element: HTMLElement): { top: number; left: number; width: number; height: number } => {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    };
  },

  /**
   * Check if element is in viewport
   */
  isInViewport: (element: HTMLElement): boolean => DOMUtils.getInstance().isElementVisible(element),

  /**
   * Cleanup all extension elements
   */
  cleanup: (): void => {
    DOMUtils.getInstance().cleanupAllInjectedElements();
  },
};

// Export singleton instance
export const DOM = DOMUtils.getInstance();
