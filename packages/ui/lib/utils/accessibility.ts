/**
 * Accessibility Utilities
 *
 * Implements ARIA label management, keyboard navigation, screen reader compatibility,
 * and focus management to ensure accessibility compliance across all components.
 */

/**
 * ARIA role types for semantic elements
 */
export type AriaRole =
  | 'button'
  | 'link'
  | 'menuitem'
  | 'tab'
  | 'tabpanel'
  | 'dialog'
  | 'alertdialog'
  | 'alert'
  | 'status'
  | 'log'
  | 'marquee'
  | 'timer'
  | 'progressbar'
  | 'slider'
  | 'spinbutton'
  | 'textbox'
  | 'combobox'
  | 'listbox'
  | 'option'
  | 'tree'
  | 'treeitem'
  | 'grid'
  | 'gridcell'
  | 'row'
  | 'columnheader'
  | 'rowheader'
  | 'group'
  | 'region'
  | 'landmark'
  | 'banner'
  | 'main'
  | 'navigation'
  | 'contentinfo'
  | 'complementary'
  | 'search'
  | 'form'
  | 'application';

/**
 * Keyboard navigation directions
 */
export type NavigationDirection = 'up' | 'down' | 'left' | 'right' | 'first' | 'last';

/**
 * Focus trap configuration
 */
export interface FocusTrapConfig {
  /** Container element to trap focus within */
  container: HTMLElement;
  /** Initial element to focus */
  initialFocus?: HTMLElement | string;
  /** Element to return focus to when trap is released */
  returnFocus?: HTMLElement;
  /** Whether to allow focus outside on tab */
  allowOutsideClick?: boolean;
  /** Callback when focus trap is activated */
  onActivate?: () => void;
  /** Callback when focus trap is deactivated */
  onDeactivate?: () => void;
}

/**
 * Screen reader announcement configuration
 */
export interface AnnouncementConfig {
  /** Message to announce */
  message: string;
  /** Announcement priority */
  priority?: 'polite' | 'assertive';
  /** Whether to announce immediately */
  immediate?: boolean;
  /** Clear previous announcements */
  clear?: boolean;
}

/**
 * Keyboard shortcut configuration
 */
export interface KeyboardShortcut {
  /** Key combination (e.g., 'ctrl+shift+s') */
  key: string;
  /** Description for users */
  description: string;
  /** Handler function */
  handler: (event: KeyboardEvent) => void;
  /** Whether shortcut is enabled */
  enabled?: boolean;
  /** Scope (global or specific element) */
  scope?: HTMLElement | 'global';
}

/**
 * Focus management utilities
 */
export class FocusManager {
  private static instance: FocusManager | null = null;
  private focusStack: HTMLElement[] = [];
  private activeTraps: Set<FocusTrapConfig> = new Set();

  static getInstance(): FocusManager {
    if (!FocusManager.instance) {
      FocusManager.instance = new FocusManager();
    }
    return FocusManager.instance;
  }

  /**
   * Get all focusable elements within a container
   */
  getFocusableElements(container: HTMLElement): HTMLElement[] {
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]',
    ].join(', ');

    const elements = Array.from(container.querySelectorAll(focusableSelectors)) as HTMLElement[];
    return elements.filter(el => this.isVisible(el) && this.isInteractive(el));
  }

  /**
   * Check if element is visible and interactive
   */
  private isVisible(element: HTMLElement): boolean {
    const style = window.getComputedStyle(element);
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      element.offsetWidth > 0 &&
      element.offsetHeight > 0
    );
  }

  /**
   * Check if element is interactive
   */
  private isInteractive(element: HTMLElement): boolean {
    const style = window.getComputedStyle(element);
    return style.pointerEvents !== 'none' && !element.hasAttribute('inert');
  }

  /**
   * Set focus with fallback
   */
  setFocus(element: HTMLElement | string, options?: FocusOptions): boolean {
    const targetElement = typeof element === 'string' ? (document.querySelector(element) as HTMLElement) : element;

    if (!targetElement) return false;

    try {
      targetElement.focus(options);
      return document.activeElement === targetElement;
    } catch (error) {
      console.warn('Focus failed:', error);
      return false;
    }
  }

  /**
   * Save current focus for later restoration
   */
  saveFocus(): void {
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement && activeElement !== document.body) {
      this.focusStack.push(activeElement);
    }
  }

  /**
   * Restore previously saved focus
   */
  restoreFocus(): boolean {
    const element = this.focusStack.pop();
    if (element) {
      return this.setFocus(element);
    }
    return false;
  }

  /**
   * Create and manage focus trap
   */
  createFocusTrap(config: FocusTrapConfig): () => void {
    const { container, initialFocus, returnFocus, allowOutsideClick } = config;

    // Save current focus
    const previousFocus = document.activeElement as HTMLElement;

    // Set initial focus
    if (initialFocus) {
      const targetElement =
        typeof initialFocus === 'string' ? (container.querySelector(initialFocus) as HTMLElement) : initialFocus;

      if (targetElement) {
        this.setFocus(targetElement);
      }
    } else {
      // Focus first focusable element
      const focusableElements = this.getFocusableElements(container);
      if (focusableElements.length > 0 && focusableElements[0]) {
        this.setFocus(focusableElements[0]);
      }
    }

    // Handle keyboard events
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        this.handleTabInTrap(event, container);
      } else if (event.key === 'Escape' && !allowOutsideClick) {
        event.preventDefault();
        deactivate();
      }
    };

    // Handle click outside
    const handleClickOutside = (event: MouseEvent) => {
      if (!allowOutsideClick && !container.contains(event.target as Node)) {
        event.preventDefault();
        event.stopPropagation();
        // Return focus to container
        const focusableElements = this.getFocusableElements(container);
        if (focusableElements.length > 0 && focusableElements[0]) {
          this.setFocus(focusableElements[0]);
        }
      }
    };

    // Add event listeners
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('click', handleClickOutside, true);

    // Track active trap
    this.activeTraps.add(config);
    config.onActivate?.();

    // Return deactivation function
    const deactivate = () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('click', handleClickOutside, true);
      this.activeTraps.delete(config);

      // Restore focus
      const focusTarget = returnFocus || previousFocus;
      if (focusTarget) {
        this.setFocus(focusTarget);
      }

      config.onDeactivate?.();
    };

    return deactivate;
  }

  /**
   * Handle tab navigation within trap
   */
  private handleTabInTrap(event: KeyboardEvent, container: HTMLElement): void {
    const focusableElements = this.getFocusableElements(container);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const currentElement = document.activeElement as HTMLElement;

    if (!firstElement || !lastElement) return;

    if (event.shiftKey) {
      // Shift + Tab (backwards)
      if (currentElement === firstElement || !container.contains(currentElement)) {
        event.preventDefault();
        this.setFocus(lastElement);
      }
    } else {
      // Tab (forwards)
      if (currentElement === lastElement || !container.contains(currentElement)) {
        event.preventDefault();
        this.setFocus(firstElement);
      }
    }
  }
}

/**
 * ARIA label and attribute management
 */
export class AriaManager {
  private static labelIdCounter = 0;
  private static descriptionIdCounter = 0;

  /**
   * Generate unique ID for ARIA attributes
   */
  static generateId(prefix: string = 'aria'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set ARIA label for element
   */
  static setLabel(element: HTMLElement, label: string): void {
    element.setAttribute('aria-label', label);
  }

  /**
   * Create and associate ARIA label element
   */
  static createLabel(element: HTMLElement, labelText: string): HTMLElement {
    const labelId = this.generateId('label');

    // Create label element
    const labelElement = document.createElement('span');
    labelElement.id = labelId;
    labelElement.textContent = labelText;
    labelElement.className = 'sr-only'; // Screen reader only

    // Insert label before target element
    element.parentNode?.insertBefore(labelElement, element);

    // Associate with element
    element.setAttribute('aria-labelledby', labelId);

    return labelElement;
  }

  /**
   * Set ARIA description for element
   */
  static setDescription(element: HTMLElement, description: string): HTMLElement {
    const descId = this.generateId('desc');

    // Create description element
    const descElement = document.createElement('span');
    descElement.id = descId;
    descElement.textContent = description;
    descElement.className = 'sr-only';

    // Insert after target element
    element.parentNode?.insertBefore(descElement, element.nextSibling);

    // Associate with element
    const existingDescribedBy = element.getAttribute('aria-describedby');
    const describedBy = existingDescribedBy ? `${existingDescribedBy} ${descId}` : descId;
    element.setAttribute('aria-describedby', describedBy);

    return descElement;
  }

  /**
   * Set ARIA expanded state
   */
  static setExpanded(element: HTMLElement, expanded: boolean): void {
    element.setAttribute('aria-expanded', expanded.toString());
  }

  /**
   * Set ARIA selected state
   */
  static setSelected(element: HTMLElement, selected: boolean): void {
    element.setAttribute('aria-selected', selected.toString());
  }

  /**
   * Set ARIA checked state
   */
  static setChecked(element: HTMLElement, checked: boolean | 'mixed'): void {
    element.setAttribute('aria-checked', checked.toString());
  }

  /**
   * Set ARIA pressed state
   */
  static setPressed(element: HTMLElement, pressed: boolean): void {
    element.setAttribute('aria-pressed', pressed.toString());
  }

  /**
   * Set ARIA disabled state
   */
  static setDisabled(element: HTMLElement, disabled: boolean): void {
    element.setAttribute('aria-disabled', disabled.toString());
    if (disabled) {
      element.setAttribute('tabindex', '-1');
    } else {
      element.removeAttribute('tabindex');
    }
  }

  /**
   * Set ARIA live region
   */
  static setLiveRegion(element: HTMLElement, politeness: 'polite' | 'assertive' | 'off'): void {
    element.setAttribute('aria-live', politeness);
    if (politeness !== 'off') {
      element.setAttribute('aria-atomic', 'true');
    }
  }

  /**
   * Set ARIA role
   */
  static setRole(element: HTMLElement, role: AriaRole): void {
    element.setAttribute('role', role);
  }

  /**
   * Remove ARIA attributes
   */
  static removeAttributes(element: HTMLElement, attributes: string[]): void {
    attributes.forEach(attr => {
      if (attr.startsWith('aria-')) {
        element.removeAttribute(attr);
      }
    });
  }
}

/**
 * Screen reader announcements
 */
export class ScreenReaderAnnouncer {
  private static instance: ScreenReaderAnnouncer | null = null;
  private politeRegion: HTMLElement | null = null;
  private assertiveRegion: HTMLElement | null = null;

  static getInstance(): ScreenReaderAnnouncer {
    if (!ScreenReaderAnnouncer.instance) {
      ScreenReaderAnnouncer.instance = new ScreenReaderAnnouncer();
    }
    return ScreenReaderAnnouncer.instance;
  }

  constructor() {
    this.createLiveRegions();
  }

  /**
   * Create ARIA live regions for announcements
   */
  private createLiveRegions(): void {
    // Polite region
    this.politeRegion = document.createElement('div');
    this.politeRegion.setAttribute('aria-live', 'polite');
    this.politeRegion.setAttribute('aria-atomic', 'true');
    this.politeRegion.className = 'sr-only';
    this.politeRegion.id = 'sr-polite-region';

    // Assertive region
    this.assertiveRegion = document.createElement('div');
    this.assertiveRegion.setAttribute('aria-live', 'assertive');
    this.assertiveRegion.setAttribute('aria-atomic', 'true');
    this.assertiveRegion.className = 'sr-only';
    this.assertiveRegion.id = 'sr-assertive-region';

    // Add to document
    document.body.appendChild(this.politeRegion);
    document.body.appendChild(this.assertiveRegion);
  }

  /**
   * Make announcement to screen readers
   */
  announce(config: AnnouncementConfig): void {
    const { message, priority = 'polite', immediate = false, clear = false } = config;

    const region = priority === 'assertive' ? this.assertiveRegion : this.politeRegion;
    if (!region) return;

    if (clear) {
      region.textContent = '';
    }

    if (immediate) {
      region.textContent = message;
    } else {
      // Small delay to ensure screen reader picks up the change
      setTimeout(() => {
        region.textContent = message;
      }, 100);
    }

    // Clear after announcement to allow repeat announcements
    setTimeout(() => {
      if (region.textContent === message) {
        region.textContent = '';
      }
    }, 1000);
  }

  /**
   * Announce status change
   */
  announceStatus(status: string, priority: 'polite' | 'assertive' = 'polite'): void {
    this.announce({
      message: `Status: ${status}`,
      priority,
      immediate: true,
    });
  }

  /**
   * Announce navigation change
   */
  announceNavigation(location: string): void {
    this.announce({
      message: `Navigated to ${location}`,
      priority: 'polite',
    });
  }

  /**
   * Announce error
   */
  announceError(error: string): void {
    this.announce({
      message: `Error: ${error}`,
      priority: 'assertive',
      immediate: true,
    });
  }

  /**
   * Announce success
   */
  announceSuccess(message: string): void {
    this.announce({
      message: `Success: ${message}`,
      priority: 'polite',
    });
  }
}

/**
 * Keyboard navigation utilities
 */
export class KeyboardNavigationManager {
  private shortcuts: Map<string, KeyboardShortcut> = new Map();
  private navigationGroups: Map<string, HTMLElement[]> = new Map();

  /**
   * Register keyboard shortcut
   */
  registerShortcut(id: string, shortcut: KeyboardShortcut): () => void {
    this.shortcuts.set(id, shortcut);

    const handler = (event: Event) => {
      const keyboardEvent = event as KeyboardEvent;
      if (this.matchesShortcut(keyboardEvent, shortcut.key) && shortcut.enabled !== false) {
        // Check scope
        if (shortcut.scope && shortcut.scope !== 'global') {
          if (!shortcut.scope.contains(event.target as Node)) {
            return;
          }
        }

        keyboardEvent.preventDefault();
        shortcut.handler(keyboardEvent);
      }
    };

    const target = shortcut.scope === 'global' ? document : shortcut.scope || document;
    target.addEventListener('keydown', handler);

    // Return unregister function
    return () => {
      this.shortcuts.delete(id);
      target.removeEventListener('keydown', handler);
    };
  }

  /**
   * Check if keyboard event matches shortcut
   */
  private matchesShortcut(event: KeyboardEvent, shortcutKey: string): boolean {
    const keys = shortcutKey.toLowerCase().split('+');
    const modifiers = keys.filter(key => ['ctrl', 'alt', 'shift', 'meta'].includes(key));
    const mainKey = keys.find(key => !['ctrl', 'alt', 'shift', 'meta'].includes(key));

    const hasCtrl = modifiers.includes('ctrl') ? event.ctrlKey : !event.ctrlKey;
    const hasAlt = modifiers.includes('alt') ? event.altKey : !event.altKey;
    const hasShift = modifiers.includes('shift') ? event.shiftKey : !event.shiftKey;
    const hasMeta = modifiers.includes('meta') ? event.metaKey : !event.metaKey;

    const keyMatches = mainKey ? event.key.toLowerCase() === mainKey : true;

    return hasCtrl && hasAlt && hasShift && hasMeta && keyMatches;
  }

  /**
   * Create navigation group
   */
  createNavigationGroup(id: string, elements: HTMLElement[]): void {
    this.navigationGroups.set(id, elements);

    elements.forEach((element, index) => {
      element.addEventListener('keydown', event => {
        this.handleArrowNavigation(event, elements, index);
      });
    });
  }

  /**
   * Handle arrow key navigation within group
   */
  private handleArrowNavigation(event: KeyboardEvent, elements: HTMLElement[], currentIndex: number): void {
    let newIndex = currentIndex;

    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault();
        newIndex = currentIndex > 0 ? currentIndex - 1 : elements.length - 1;
        break;
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault();
        newIndex = currentIndex < elements.length - 1 ? currentIndex + 1 : 0;
        break;
      case 'Home':
        event.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        newIndex = elements.length - 1;
        break;
      default:
        return;
    }

    const focusManager = FocusManager.getInstance();
    const targetElement = elements[newIndex];
    if (targetElement) {
      focusManager.setFocus(targetElement);
    }
  }

  /**
   * Get all registered shortcuts for help display
   */
  getShortcuts(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values());
  }

  /**
   * Clear all shortcuts
   */
  clearShortcuts(): void {
    this.shortcuts.clear();
  }
}

/**
 * Color contrast utilities
 */
export class ColorContrastChecker {
  /**
   * Calculate relative luminance
   */
  static getRelativeLuminance(color: string): number {
    const rgb = this.hexToRgb(color);
    if (!rgb) return 0;

    const [r, g, b] = rgb.map(c => {
      const sRGB = c / 255;
      return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
    });

    if (r === undefined || g === undefined || b === undefined) return 0;

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /**
   * Calculate contrast ratio between two colors
   */
  static getContrastRatio(color1: string, color2: string): number {
    const lum1 = this.getRelativeLuminance(color1);
    const lum2 = this.getRelativeLuminance(color2);

    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);

    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Check if contrast ratio meets WCAG standards
   */
  static meetsWCAG(
    color1: string,
    color2: string,
    level: 'AA' | 'AAA' = 'AA',
    size: 'normal' | 'large' = 'normal',
  ): boolean {
    const ratio = this.getContrastRatio(color1, color2);

    if (level === 'AAA') {
      return size === 'large' ? ratio >= 4.5 : ratio >= 7;
    } else {
      return size === 'large' ? ratio >= 3 : ratio >= 4.5;
    }
  }

  /**
   * Convert hex color to RGB
   */
  private static hexToRgb(hex: string): [number, number, number] | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result || !result[1] || !result[2] || !result[3]) return null;
    return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)];
  }
}

/**
 * Utility functions for common accessibility tasks
 */
export const a11yUtils = {
  /**
   * Add screen reader only CSS class
   */
  addScreenReaderOnlyStyles(): void {
    const styleId = 'a11y-sr-only-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .sr-only {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        padding: 0 !important;
        margin: -1px !important;
        overflow: hidden !important;
        clip: rect(0, 0, 0, 0) !important;
        white-space: nowrap !important;
        border: 0 !important;
      }
      
      .sr-only-focusable:focus {
        position: static !important;
        width: auto !important;
        height: auto !important;
        padding: inherit !important;
        margin: inherit !important;
        overflow: visible !important;
        clip: auto !important;
        white-space: normal !important;
      }
    `;

    document.head.appendChild(style);
  },

  /**
   * Ensure element has accessible name
   */
  ensureAccessibleName(element: HTMLElement): void {
    const hasAccessibleName =
      element.getAttribute('aria-label') ||
      element.getAttribute('aria-labelledby') ||
      element.textContent?.trim() ||
      (element as HTMLImageElement).alt ||
      (element as HTMLElement).title;

    if (!hasAccessibleName) {
      console.warn('Element lacks accessible name:', element);
      AriaManager.setLabel(element, 'Unlabeled element');
    }
  },

  /**
   * Check and fix common accessibility issues
   */
  auditElement(element: HTMLElement): string[] {
    const issues: string[] = [];

    // Check for accessible name
    const hasAccessibleName =
      element.getAttribute('aria-label') || element.getAttribute('aria-labelledby') || element.textContent?.trim();

    if (!hasAccessibleName && ['button', 'link', 'input'].includes(element.tagName.toLowerCase())) {
      issues.push('Interactive element lacks accessible name');
    }

    // Check color contrast
    const style = window.getComputedStyle(element);
    const backgroundColor = style.backgroundColor;
    const color = style.color;

    if (backgroundColor !== 'rgba(0, 0, 0, 0)' && backgroundColor !== 'transparent') {
      // Only check if element has non-transparent background
      try {
        if (!ColorContrastChecker.meetsWCAG(color, backgroundColor)) {
          issues.push('Insufficient color contrast');
        }
      } catch (_error) {
        // Could not parse colors
      }
    }

    // Check for keyboard accessibility
    const isInteractive = ['button', 'a', 'input', 'select', 'textarea'].includes(element.tagName.toLowerCase());

    if (isInteractive && element.tabIndex < 0) {
      issues.push('Interactive element not keyboard accessible');
    }

    return issues;
  },

  /**
   * Get accessibility information for element
   */
  getAccessibilityInfo(element: HTMLElement): Record<string, string | number | boolean | string[] | null> {
    return {
      role: element.getAttribute('role') || element.tagName.toLowerCase(),
      label: element.getAttribute('aria-label') || element.textContent?.trim() || 'No label',
      describedBy: element.getAttribute('aria-describedby'),
      labelledBy: element.getAttribute('aria-labelledby'),
      expanded: element.getAttribute('aria-expanded'),
      selected: element.getAttribute('aria-selected'),
      checked: element.getAttribute('aria-checked'),
      disabled: element.getAttribute('aria-disabled') || element.hasAttribute('disabled'),
      tabIndex: element.tabIndex,
      focusable: element.tabIndex >= 0 || element.hasAttribute('tabindex'),
      issues: this.auditElement(element),
    };
  },
};

// Initialize screen reader only styles
a11yUtils.addScreenReaderOnlyStyles();

// Export instances for easy access
export const focusManager = FocusManager.getInstance();
export const screenReader = ScreenReaderAnnouncer.getInstance();
export const keyboardNav = new KeyboardNavigationManager();

/**
 * React hook for accessibility features
 */
export const useA11y = () => ({
  focusManager,
  screenReader,
  keyboardNav,
  AriaManager,
  ColorContrastChecker,
  utils: a11yUtils,
});
