/**
 * Mutation Observer Utility
 *
 * Efficient DOM change monitoring with debounced observation
 * and relevant change filtering for content scripts.
 */

import { domUtils } from './dom-utils';
import type { PageChange, PageMonitor } from '../types/content-script';

/**
 * Meeting content interface
 */
interface MeetingContent {
  id: string;
  type: 'video' | 'audio' | 'recording' | 'link' | 'unknown';
  element: Element;
  metadata?: Record<string, unknown>;
}

/**
 * Mutation observer configuration options
 */
export interface MutationObserverConfig {
  /** Observer target selector or element */
  target: string | Element;
  /** Observer options */
  options: MutationObserverInit;
  /** Debounce delay for change events */
  debounceDelay: number;
  /** Filter function for relevant changes */
  filter?: (mutations: MutationRecord[]) => MutationRecord[];
  /** Callback for processed changes */
  callback: (changes: PageChange[]) => void;
}

/**
 * Change detection filters
 */
export interface ChangeFilters {
  /** Meeting content related selectors */
  meetingContentSelectors: string[];
  /** UI control selectors */
  uiControlSelectors: string[];
  /** Ignore selectors (changes to ignore) */
  ignoreSelectors: string[];
  /** Minimum change significance */
  minSignificance: 'low' | 'medium' | 'high';
}

/**
 * Enhanced mutation observer with content script specific features
 */
export class EnhancedMutationObserver implements PageMonitor {
  private observers: Map<string, MutationObserver> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private changeCallbacks: Map<string, (changes: PageChange[]) => void> = new Map();
  private contentCallbacks: Map<string, (content: MeetingContent[]) => void> = new Map();
  private isMonitoring: boolean = false;
  private defaultFilters: ChangeFilters;

  constructor() {
    this.defaultFilters = {
      meetingContentSelectors: [
        '[data-recording]',
        '[data-meeting]',
        '.recording-item',
        '.meeting-item',
        '.video-player',
        '.audio-player',
        '[href*="recording"]',
        '[href*="meeting"]',
      ],
      uiControlSelectors: ['button', '.btn', '.control', '.toolbar', '.menu', '.dropdown'],
      ignoreSelectors: [
        '.tooltip',
        '.popover',
        '.loading',
        '.spinner',
        '[data-meeting-summarizer-injected]',
        '.meeting-summarizer-isolated',
      ],
      minSignificance: 'medium',
    };
  }

  /**
   * Start monitoring DOM changes for meeting content
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;

    // Start main content monitoring
    this.observeElement('main-content', {
      target: 'body',
      options: {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['href', 'src', 'data-recording', 'data-meeting'],
      },
      debounceDelay: 500,
      filter: this.filterRelevantChanges.bind(this),
      callback: this.handlePageChanges.bind(this),
    });

    // Start navigation monitoring
    this.observeNavigation();
  }

  /**
   * Stop monitoring page
   */
  stopMonitoring(): void {
    this.isMonitoring = false;

    // Disconnect all observers
    this.observers.forEach(observer => {
      observer.disconnect();
    });
    this.observers.clear();

    // Clear debounce timers
    this.debounceTimers.forEach(timer => {
      clearTimeout(timer);
    });
    this.debounceTimers.clear();

    // Clear callbacks
    this.changeCallbacks.clear();
    this.contentCallbacks.clear();
  }

  /**
   * Check if monitoring is active
   */
  getMonitoringStatus(): boolean {
    return this.isMonitoring;
  }

  /**
   * Register callback for page changes
   */
  onPageChange(callback: (changes: PageChange[]) => void): void {
    this.changeCallbacks.set('page-change', callback);
  }

  /**
   * Register callback for new content detection
   */
  onContentDetection(callback: (content: MeetingContent[]) => void): void {
    this.contentCallbacks.set('content-detection', callback);
  }

  /**
   * Observe specific element with configuration
   */
  observeElement(id: string, config: MutationObserverConfig): void {
    // Stop existing observer if any
    this.stopObserver(id);

    const target = typeof config.target === 'string' ? document.querySelector(config.target) : config.target;

    if (!target) {
      console.warn(`Target element not found for observer: ${id}`);
      return;
    }

    const observer = new MutationObserver(mutations => {
      this.processMutations(id, mutations, config);
    });

    observer.observe(target, config.options);
    this.observers.set(id, observer);
  }

  /**
   * Stop specific observer
   */
  stopObserver(id: string): void {
    const observer = this.observers.get(id);
    if (observer) {
      observer.disconnect();
      this.observers.delete(id);
    }

    const timer = this.debounceTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(id);
    }
  }

  /**
   * Process mutations with debouncing and filtering
   */
  private processMutations(id: string, mutations: MutationRecord[], config: MutationObserverConfig): void {
    // Clear existing timer
    const existingTimer = this.debounceTimers.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounced timer
    const timer = setTimeout(() => {
      const filteredMutations = config.filter ? config.filter(mutations) : mutations;

      if (filteredMutations.length > 0) {
        const changes = this.convertMutationsToChanges(filteredMutations);
        config.callback(changes);
      }

      this.debounceTimers.delete(id);
    }, config.debounceDelay);

    this.debounceTimers.set(id, timer);
  }

  /**
   * Filter mutations for relevant changes
   */
  private filterRelevantChanges(mutations: MutationRecord[]): MutationRecord[] {
    return mutations.filter(mutation => {
      // Skip mutations on ignored elements
      if (this.isIgnoredElement(mutation.target as Element)) {
        return false;
      }

      // Check for meeting content changes
      if (this.isMeetingContentChange(mutation)) {
        return true;
      }

      // Check for UI control changes
      if (this.isUIControlChange(mutation)) {
        return true;
      }

      // Check for significant attribute changes
      if (this.isSignificantAttributeChange(mutation)) {
        return true;
      }

      // Check for significant node changes
      if (this.isSignificantNodeChange(mutation)) {
        return true;
      }

      return false;
    });
  }

  /**
   * Convert mutations to page changes
   */
  private convertMutationsToChanges(mutations: MutationRecord[]): PageChange[] {
    const changes: PageChange[] = [];

    mutations.forEach(mutation => {
      const changeType = this.getChangeType(mutation);
      const affectedElements = this.getAffectedElements(mutation);

      changes.push({
        type: changeType,
        elements: affectedElements,
        timestamp: Date.now(),
        affectsMeetingContent: this.affectsMeetingContent(mutation),
      });
    });

    return changes;
  }

  /**
   * Determine change type from mutation
   */
  private getChangeType(mutation: MutationRecord): PageChange['type'] {
    switch (mutation.type) {
      case 'childList':
        if (mutation.addedNodes.length > 0) {
          return 'content-added';
        } else if (mutation.removedNodes.length > 0) {
          return 'content-removed';
        }
        return 'layout-change';

      case 'attributes': {
        const attributeName = mutation.attributeName;
        if (attributeName === 'href' || attributeName === 'src') {
          return 'navigation';
        }
        return 'layout-change';
      }

      default:
        return 'layout-change';
    }
  }

  /**
   * Get elements affected by mutation
   */
  private getAffectedElements(mutation: MutationRecord): Element[] {
    const elements: Element[] = [];

    // Add the target element
    if (mutation.target instanceof Element) {
      elements.push(mutation.target);
    }

    // Add added nodes
    mutation.addedNodes.forEach(node => {
      if (node instanceof Element) {
        elements.push(node);
      }
    });

    // Add removed nodes (if still accessible)
    mutation.removedNodes.forEach(node => {
      if (node instanceof Element) {
        elements.push(node);
      }
    });

    return elements;
  }

  /**
   * Check if change affects meeting content
   */
  private affectsMeetingContent(mutation: MutationRecord): boolean {
    const target = mutation.target as Element;

    // Check target element
    if (this.isMeetingContentElement(target)) {
      return true;
    }

    // Check added nodes
    for (const node of Array.from(mutation.addedNodes)) {
      if (node instanceof Element && this.isMeetingContentElement(node)) {
        return true;
      }
    }

    // Check removed nodes
    for (const node of Array.from(mutation.removedNodes)) {
      if (node instanceof Element && this.isMeetingContentElement(node)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if element is meeting content related
   */
  private isMeetingContentElement(element: Element): boolean {
    return this.defaultFilters.meetingContentSelectors.some(selector => {
      try {
        return domUtils.getInstance().matches(element, selector);
      } catch {
        return false;
      }
    });
  }

  /**
   * Check if element should be ignored
   */
  private isIgnoredElement(element: Element): boolean {
    return this.defaultFilters.ignoreSelectors.some(selector => {
      try {
        return domUtils.getInstance().matches(element, selector);
      } catch {
        return false;
      }
    });
  }

  /**
   * Check if mutation is meeting content change
   */
  private isMeetingContentChange(mutation: MutationRecord): boolean {
    return this.affectsMeetingContent(mutation);
  }

  /**
   * Check if mutation is UI control change
   */
  private isUIControlChange(mutation: MutationRecord): boolean {
    const target = mutation.target as Element;

    return this.defaultFilters.uiControlSelectors.some(selector => {
      try {
        return domUtils.getInstance().matches(target, selector);
      } catch {
        return false;
      }
    });
  }

  /**
   * Check if attribute change is significant
   */
  private isSignificantAttributeChange(mutation: MutationRecord): boolean {
    if (mutation.type !== 'attributes') {
      return false;
    }

    const significantAttributes = [
      'href',
      'src',
      'data-recording',
      'data-meeting',
      'class',
      'id',
      'style',
      'hidden',
      'disabled',
    ];

    return significantAttributes.includes(mutation.attributeName || '');
  }

  /**
   * Check if node change is significant
   */
  private isSignificantNodeChange(mutation: MutationRecord): boolean {
    if (mutation.type !== 'childList') {
      return false;
    }

    // Significant if adding/removing multiple nodes
    if (mutation.addedNodes.length > 1 || mutation.removedNodes.length > 1) {
      return true;
    }

    // Significant if adding/removing element nodes (not just text)
    const hasElementNodes =
      Array.from(mutation.addedNodes).some(node => node.nodeType === Node.ELEMENT_NODE) ||
      Array.from(mutation.removedNodes).some(node => node.nodeType === Node.ELEMENT_NODE);

    return hasElementNodes;
  }

  /**
   * Handle page changes
   */
  private handlePageChanges(changes: PageChange[]): void {
    // Notify page change callbacks
    this.changeCallbacks.forEach(callback => {
      try {
        callback(changes);
      } catch (error) {
        console.error('Error in page change callback:', error);
      }
    });

    // Detect new meeting content
    const newContent = this.detectNewMeetingContent(changes);
    if (newContent.length > 0) {
      this.contentCallbacks.forEach(callback => {
        try {
          callback(newContent);
        } catch (error) {
          console.error('Error in content detection callback:', error);
        }
      });
    }
  }

  /**
   * Detect new meeting content from changes
   */
  private detectNewMeetingContent(changes: PageChange[]): MeetingContent[] {
    const newContent: MeetingContent[] = [];

    changes.forEach(change => {
      if (change.type === 'content-added' && change.affectsMeetingContent) {
        change.elements.forEach(element => {
          if (this.isMeetingContentElement(element)) {
            const contentInfo = this.extractMeetingContentInfo(element);
            if (contentInfo) {
              newContent.push(contentInfo);
            }
          }
        });
      }
    });

    return newContent;
  }

  /**
   * Extract meeting content information from element
   */
  private extractMeetingContentInfo(element: Element): MeetingContent | null {
    try {
      const links = element.querySelectorAll('a[href*="recording"], a[href*="meeting"]');
      const videos = element.querySelectorAll('video, audio');
      const recordingData = element.getAttribute('data-recording');
      const meetingData = element.getAttribute('data-meeting');

      if (links.length > 0 || videos.length > 0 || recordingData || meetingData) {
        return {
          element,
          links: Array.from(links),
          videos: Array.from(videos),
          recordingData,
          meetingData,
          timestamp: Date.now(),
        };
      }
    } catch (error) {
      console.warn('Failed to extract meeting content info:', error);
    }

    return null;
  }

  /**
   * Observe navigation changes
   */
  private observeNavigation(): void {
    // Listen for history changes (SPA navigation)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      this.handleNavigationChange();
    };

    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      this.handleNavigationChange();
    };

    // Listen for popstate events
    window.addEventListener(
      'popstate',
      () => {
        this.handleNavigationChange();
      },
      { passive: true },
    );

    // Listen for hash changes
    window.addEventListener(
      'hashchange',
      () => {
        this.handleNavigationChange();
      },
      { passive: true },
    );
  }

  /**
   * Handle navigation changes
   */
  private handleNavigationChange(): void {
    const changes: PageChange[] = [
      {
        type: 'navigation',
        elements: [document.documentElement],
        timestamp: Date.now(),
        affectsMeetingContent: true,
      },
    ];

    this.handlePageChanges(changes);
  }

  /**
   * Update filters
   */
  updateFilters(filters: Partial<ChangeFilters>): void {
    this.defaultFilters = {
      ...this.defaultFilters,
      ...filters,
    };
  }

  /**
   * Get current filters
   */
  getFilters(): ChangeFilters {
    return { ...this.defaultFilters };
  }
}

// Export singleton instance
export const mutationObserver = new EnhancedMutationObserver();

// Export utility functions
export const mutationUtils = {
  /**
   * Create a simple mutation observer
   */
  createObserver: (
    target: Element,
    callback: (mutations: MutationRecord[]) => void,
    options: MutationObserverInit = { childList: true, subtree: true },
  ): MutationObserver => {
    const observer = new MutationObserver(callback);
    observer.observe(target, options);
    return observer;
  },

  /**
   * Observe element until condition is met
   */
  observeUntil: (target: Element, condition: () => boolean, timeout: number = 10000): Promise<boolean> =>
    new Promise(resolve => {
      if (condition()) {
        resolve(true);
        return;
      }

      const observer = new MutationObserver(() => {
        if (condition()) {
          observer.disconnect();
          resolve(true);
        }
      });

      observer.observe(target, {
        childList: true,
        subtree: true,
        attributes: true,
      });

      setTimeout(() => {
        observer.disconnect();
        resolve(false);
      }, timeout);
    }),

  /**
   * Get the mutation observer instance
   */
  getInstance: () => mutationObserver,
};
