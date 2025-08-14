/**
 * Page Monitor
 * Implements DOM change monitoring for dynamic content with performance optimization
 */

import type { DetectionConfig } from '../types/index';
import type { ContentIndicator } from '../types/page';

/**
 * Performance-optimized page monitoring for dynamic meeting content detection
 */
export class PageMonitor {
  private observers: Map<string, MutationObserver> = new Map();
  private changeCallbacks: Map<string, ChangeCallback[]> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private performanceMetrics: Map<string, PerformanceMetrics> = new Map();
  private isMonitoring: boolean = false;

  // Configuration
  private readonly defaultConfig: MonitoringConfig = {
    debounceDelay: 500,
    maxObservers: 10,
    performanceThreshold: 100,
    batchSize: 50,
    enablePerformanceMonitoring: true,
    mutationTypes: {
      childList: true,
      subtree: true,
      attributes: true,
      attributeOldValue: false,
      characterData: false,
      characterDataOldValue: false,
    },
  };

  constructor(private config: MonitoringConfig = {}) {
    this.config = { ...this.defaultConfig, ...config };
    this.setupPerformanceMonitoring();
  }

  /**
   * Start monitoring DOM changes for meeting content
   */
  startMonitoring(targetSelector: string = 'body', callback: ChangeCallback, options: MonitoringOptions = {}): string {
    const monitorId = this.generateMonitorId(targetSelector, options);

    if (this.observers.has(monitorId)) {
      this.addCallback(monitorId, callback);
      return monitorId;
    }

    const target = document.querySelector(targetSelector);
    if (!target) {
      throw new Error(`Target element not found: ${targetSelector}`);
    }

    // Create optimized mutation observer
    const observer = this.createOptimizedObserver(monitorId, options);

    // Start observing
    observer.observe(target, {
      ...this.config.mutationTypes,
      ...options.mutationTypes,
    });

    this.observers.set(monitorId, observer);
    this.addCallback(monitorId, callback);
    this.initializePerformanceMetrics(monitorId);

    this.isMonitoring = true;
    return monitorId;
  }

  /**
   * Stop monitoring specific target
   */
  stopMonitoring(monitorId: string): boolean {
    const observer = this.observers.get(monitorId);
    if (!observer) {
      return false;
    }

    observer.disconnect();
    this.observers.delete(monitorId);
    this.changeCallbacks.delete(monitorId);

    // Clear any pending debounce timers
    const timer = this.debounceTimers.get(monitorId);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(monitorId);
    }

    this.performanceMetrics.delete(monitorId);

    // Check if we should stop global monitoring
    if (this.observers.size === 0) {
      this.isMonitoring = false;
    }

    return true;
  }

  /**
   * Stop all monitoring
   */
  stopAllMonitoring(): void {
    for (const monitorId of this.observers.keys()) {
      this.stopMonitoring(monitorId);
    }
  }

  /**
   * Monitor specific content indicators
   */
  monitorContentIndicators(
    indicators: ContentIndicator[],
    callback: IndicatorChangeCallback,
    options: IndicatorMonitoringOptions = {},
  ): string[] {
    const monitorIds: string[] = [];

    for (const indicator of indicators) {
      try {
        const element = document.querySelector(indicator.selector);
        if (element) {
          const monitorId = this.startMonitoring(
            indicator.selector,
            changes => this.handleIndicatorChanges(changes, indicator, callback),
            {
              debounceDelay: options.debounceDelay || 300,
              targetAttributes: options.watchAttributes || ['class', 'data-*'],
              priority: indicator.priority === 'high' ? 'high' : 'normal',
            },
          );
          monitorIds.push(monitorId);
        }
      } catch (error) {
        console.warn(`Failed to monitor indicator ${indicator.selector}:`, error);
      }
    }

    return monitorIds;
  }

  /**
   * Monitor for new meeting content appearing
   */
  monitorForNewContent(_detectionConfig: DetectionConfig, callback: NewContentCallback): string {
    const contentSelectors = this.getContentSelectors();
    void contentSelectors; // TODO: Use for content monitoring

    return this.startMonitoring(
      'body',
      changes => {
        this.analyzeChangesForNewContent(changes, _detectionConfig, callback);
      },
      {
        debounceDelay: 1000,
        priority: 'high',
        mutationTypes: {
          childList: true,
          subtree: true,
          attributes: false,
        },
      },
    );
  }

  /**
   * Get current monitoring status
   */
  getMonitoringStatus(): MonitoringStatus {
    const activeMonitors = Array.from(this.observers.keys());
    const totalCallbacks = Array.from(this.changeCallbacks.values()).reduce(
      (sum, callbacks) => sum + callbacks.length,
      0,
    );

    return {
      isActive: this.isMonitoring,
      activeMonitors: activeMonitors.length,
      totalCallbacks,
      monitorIds: activeMonitors,
      performanceMetrics: this.getAggregatedPerformanceMetrics(),
    };
  }

  /**
   * Get performance metrics for monitoring optimization
   */
  getPerformanceMetrics(monitorId?: string): PerformanceMetrics | AggregatedMetrics {
    if (monitorId) {
      return this.performanceMetrics.get(monitorId) || this.createEmptyMetrics();
    }

    return this.getAggregatedPerformanceMetrics();
  }

  /**
   * Optimize monitoring performance based on metrics
   */
  optimizePerformance(): OptimizationResult {
    const optimizations: string[] = [];
    let optimizedCount = 0;

    for (const [monitorId, metrics] of this.performanceMetrics) {
      if (metrics.averageProcessingTime > this.config.performanceThreshold!) {
        // Increase debounce delay for slow monitors
        this.updateMonitorConfig(monitorId, {
          debounceDelay: Math.min(2000, (this.config.debounceDelay || 500) * 2),
        });
        optimizations.push(`Increased debounce delay for ${monitorId}`);
        optimizedCount++;
      }

      if (metrics.mutationCount > 1000) {
        // Reduce observation scope for high-volume monitors
        this.optimizeObserverScope(monitorId);
        optimizations.push(`Reduced observation scope for ${monitorId}`);
        optimizedCount++;
      }
    }

    return {
      optimizedMonitors: optimizedCount,
      optimizations,
      newConfiguration: this.config,
    };
  }

  // Private methods

  private createOptimizedObserver(monitorId: string, options: MonitoringOptions): MutationObserver {
    return new MutationObserver(mutations => {
      this.handleMutations(monitorId, mutations, options);
    });
  }

  private handleMutations(monitorId: string, mutations: MutationRecord[], options: MonitoringOptions): void {
    const startTime = performance.now();

    // Update performance metrics
    this.updatePerformanceMetrics(monitorId, {
      mutationCount: mutations.length,
      lastActivity: Date.now(),
    });

    // Apply debouncing if configured
    const debounceDelay = options.debounceDelay || this.config.debounceDelay!;

    if (debounceDelay > 0) {
      this.debouncedProcessMutations(monitorId, mutations, options, startTime);
    } else {
      this.processMutations(monitorId, mutations, options, startTime);
    }
  }

  private debouncedProcessMutations(
    monitorId: string,
    mutations: MutationRecord[],
    options: MonitoringOptions,
    startTime: number,
  ): void {
    // Clear existing timer
    const existingTimer = this.debounceTimers.get(monitorId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.processMutations(monitorId, mutations, options, startTime);
      this.debounceTimers.delete(monitorId);
    }, options.debounceDelay || this.config.debounceDelay!);

    this.debounceTimers.set(monitorId, timer);
  }

  private processMutations(
    monitorId: string,
    mutations: MutationRecord[],
    options: MonitoringOptions,
    startTime: number,
  ): void {
    try {
      // Filter and process mutations
      const relevantMutations = this.filterRelevantMutations(mutations, options);

      if (relevantMutations.length === 0) {
        return;
      }

      // Create change summary
      const changes = this.createChangesSummary(relevantMutations);

      // Execute callbacks
      const callbacks = this.changeCallbacks.get(monitorId) || [];
      for (const callback of callbacks) {
        try {
          callback(changes);
        } catch (error) {
          console.error(`Error in change callback:`, error);
        }
      }

      // Update performance metrics
      const processingTime = performance.now() - startTime;
      this.updatePerformanceMetrics(monitorId, {
        averageProcessingTime: processingTime,
        callbackCount: callbacks.length,
      });
    } catch (error) {
      console.error(`Error processing mutations for ${monitorId}:`, error);
    }
  }

  private filterRelevantMutations(mutations: MutationRecord[], options: MonitoringOptions): MutationRecord[] {
    return mutations.filter(mutation => {
      // Filter by mutation type
      if (mutation.type === 'attributes' && options.targetAttributes) {
        const attributeName = mutation.attributeName;
        if (!attributeName) return false;

        return options.targetAttributes.some(attr => {
          if (attr.endsWith('*')) {
            return attributeName.startsWith(attr.slice(0, -1));
          }
          return attributeName === attr;
        });
      }

      // Filter by target elements
      if (options.targetElements) {
        const target = mutation.target as Element;
        return options.targetElements.some(selector => {
          try {
            return target.matches(selector) || target.querySelector(selector);
          } catch {
            return false;
          }
        });
      }

      return true;
    });
  }

  private createChangesSummary(mutations: MutationRecord[]): PageChangesSummary {
    const addedElements: Element[] = [];
    const removedElements: Element[] = [];
    const modifiedElements: Element[] = [];
    const attributeChanges: AttributeChange[] = [];

    for (const mutation of mutations) {
      switch (mutation.type) {
        case 'childList':
          addedElements.push(
            ...(Array.from(mutation.addedNodes).filter(node => node.nodeType === Node.ELEMENT_NODE) as Element[]),
          );

          removedElements.push(
            ...(Array.from(mutation.removedNodes).filter(node => node.nodeType === Node.ELEMENT_NODE) as Element[]),
          );
          break;

        case 'attributes':
          if (mutation.target.nodeType === Node.ELEMENT_NODE) {
            const element = mutation.target as Element;
            modifiedElements.push(element);

            if (mutation.attributeName) {
              attributeChanges.push({
                element,
                attributeName: mutation.attributeName,
                oldValue: mutation.oldValue,
                newValue: element.getAttribute(mutation.attributeName),
              });
            }
          }
          break;
      }
    }

    return {
      addedElements,
      removedElements,
      modifiedElements,
      attributeChanges,
      timestamp: Date.now(),
      mutationCount: mutations.length,
    };
  }

  private handleIndicatorChanges(
    changes: PageChangesSummary,
    indicator: ContentIndicator,
    callback: IndicatorChangeCallback,
  ): void {
    // Check if changes affect the indicator
    const isAffected = this.isIndicatorAffected(changes, indicator);

    if (isAffected) {
      callback({
        indicator,
        changes,
        newStrength: this.calculateIndicatorStrength(indicator),
        isStillPresent: this.isIndicatorStillPresent(indicator),
      });
    }
  }

  private isIndicatorAffected(changes: PageChangesSummary, indicator: ContentIndicator): boolean {
    // Check if indicator element was modified
    const indicatorElement = document.querySelector(indicator.selector);
    if (!indicatorElement) return false;

    // Check if element itself was modified
    if (changes.modifiedElements.includes(indicatorElement)) {
      return true;
    }

    // Check if children were added/removed
    const hasChildChanges =
      changes.addedElements.some(el => indicatorElement.contains(el)) ||
      changes.removedElements.some(el => indicatorElement.contains(el));

    return hasChildChanges;
  }

  private calculateIndicatorStrength(indicator: ContentIndicator): number {
    try {
      const element = document.querySelector(indicator.selector);
      if (!element) return 0;

      // Calculate strength based on element visibility and content
      let strength = indicator.strength;

      // Adjust for visibility
      const isVisible = this.isElementVisible(element);
      if (!isVisible) {
        strength *= 0.5;
      }

      // Adjust for content presence
      const hasContent = element.textContent?.trim().length || 0;
      if (hasContent === 0) {
        strength *= 0.7;
      }

      return Math.min(1, Math.max(0, strength));
    } catch {
      return 0;
    }
  }

  private isIndicatorStillPresent(indicator: ContentIndicator): boolean {
    return document.querySelector(indicator.selector) !== null;
  }

  private analyzeChangesForNewContent(
    changes: PageChangesSummary,
    _config: DetectionConfig,
    callback: NewContentCallback,
  ): void {
    // Look for meeting-related content in added elements
    const meetingElements = this.findMeetingElements(changes.addedElements);

    if (meetingElements.length > 0) {
      callback({
        newElements: meetingElements,
        changes,
        confidence: this.calculateNewContentConfidence(meetingElements),
        timestamp: Date.now(),
      });
    }
  }

  private findMeetingElements(elements: Element[]): Element[] {
    const meetingSelectors = [
      '[data-automation-id*="meeting"]',
      '.meeting',
      '.conference',
      '.video-container',
      '.stream-player',
      '[data-tid*="meeting"]',
    ];

    const meetingElements: Element[] = [];

    for (const element of elements) {
      for (const selector of meetingSelectors) {
        try {
          if (element.matches(selector) || element.querySelector(selector)) {
            meetingElements.push(element);
            break;
          }
        } catch {
          // Invalid selector, continue
        }
      }
    }

    return meetingElements;
  }

  private calculateNewContentConfidence(elements: Element[]): number {
    if (elements.length === 0) return 0;

    let totalConfidence = 0;
    for (const element of elements) {
      let confidence = 0.5; // Base confidence

      // Increase confidence for specific indicators
      if (element.querySelector('video, audio')) confidence += 0.3;
      if (element.textContent?.toLowerCase().includes('meeting')) confidence += 0.2;
      if (element.textContent?.toLowerCase().includes('recording')) confidence += 0.2;

      totalConfidence += Math.min(1, confidence);
    }

    return Math.min(1, totalConfidence / elements.length);
  }

  private isElementVisible(element: Element): boolean {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && window.getComputedStyle(element).visibility !== 'hidden';
  }

  private getContentSelectors(): string[] {
    return [
      'video[src]',
      'audio[src]',
      '[data-stream-url]',
      '.meeting-content',
      '.video-container',
      '.stream-player',
      '[data-automation-id*="meeting"]',
      '[data-tid*="meeting"]',
    ];
  }

  private generateMonitorId(targetSelector: string, options: MonitoringOptions): string {
    const optionsHash = JSON.stringify(options).slice(0, 8);
    return `monitor_${targetSelector.replace(/[^a-zA-Z0-9]/g, '_')}_${optionsHash}`;
  }

  private addCallback(monitorId: string, callback: ChangeCallback): void {
    const existingCallbacks = this.changeCallbacks.get(monitorId) || [];
    existingCallbacks.push(callback);
    this.changeCallbacks.set(monitorId, existingCallbacks);
  }

  private setupPerformanceMonitoring(): void {
    if (!this.config.enablePerformanceMonitoring) return;

    // Monitor overall performance impact
    setInterval(() => {
      this.checkPerformanceImpact();
    }, 30000); // Check every 30 seconds
  }

  private checkPerformanceImpact(): void {
    const totalObservers = this.observers.size;
    const totalMetrics = Array.from(this.performanceMetrics.values());

    if (totalObservers > (this.config.maxObservers || 10)) {
      console.warn(`Too many observers active: ${totalObservers}. Consider optimization.`);
    }

    const avgProcessingTime = totalMetrics.reduce((sum, m) => sum + m.averageProcessingTime, 0) / totalMetrics.length;
    if (avgProcessingTime > (this.config.performanceThreshold || 100)) {
      console.warn(`High average processing time: ${avgProcessingTime}ms. Consider optimization.`);
    }
  }

  private initializePerformanceMetrics(monitorId: string): void {
    this.performanceMetrics.set(monitorId, this.createEmptyMetrics());
  }

  private createEmptyMetrics(): PerformanceMetrics {
    return {
      mutationCount: 0,
      averageProcessingTime: 0,
      callbackCount: 0,
      lastActivity: Date.now(),
      startTime: Date.now(),
    };
  }

  private updatePerformanceMetrics(monitorId: string, updates: Partial<PerformanceMetrics>): void {
    const existing = this.performanceMetrics.get(monitorId) || this.createEmptyMetrics();

    // Calculate running averages
    const newMetrics = { ...existing };

    if (updates.averageProcessingTime !== undefined) {
      newMetrics.averageProcessingTime = (existing.averageProcessingTime + updates.averageProcessingTime) / 2;
    }

    if (updates.mutationCount !== undefined) {
      newMetrics.mutationCount += updates.mutationCount;
    }

    Object.assign(newMetrics, updates);
    this.performanceMetrics.set(monitorId, newMetrics);
  }

  private getAggregatedPerformanceMetrics(): AggregatedMetrics {
    const allMetrics = Array.from(this.performanceMetrics.values());

    if (allMetrics.length === 0) {
      return {
        totalMonitors: 0,
        totalMutations: 0,
        averageProcessingTime: 0,
        totalCallbacks: 0,
      };
    }

    return {
      totalMonitors: allMetrics.length,
      totalMutations: allMetrics.reduce((sum, m) => sum + m.mutationCount, 0),
      averageProcessingTime: allMetrics.reduce((sum, m) => sum + m.averageProcessingTime, 0) / allMetrics.length,
      totalCallbacks: allMetrics.reduce((sum, m) => sum + m.callbackCount, 0),
    };
  }

  private updateMonitorConfig(monitorId: string, newConfig: Partial<MonitoringConfig>): void {
    // In a full implementation, this would update the specific monitor's configuration
    Object.assign(this.config, newConfig);
  }

  private optimizeObserverScope(monitorId: string): void {
    // In a full implementation, this would reduce the observation scope
    // For now, just log the optimization
    console.log(`Optimizing observer scope for ${monitorId}`);
  }
}

// Supporting interfaces and types

export interface MonitoringConfig {
  debounceDelay?: number;
  maxObservers?: number;
  performanceThreshold?: number;
  batchSize?: number;
  enablePerformanceMonitoring?: boolean;
  mutationTypes?: MutationObserverInit;
}

export interface MonitoringOptions {
  debounceDelay?: number;
  targetAttributes?: string[];
  targetElements?: string[];
  priority?: 'low' | 'normal' | 'high';
  mutationTypes?: MutationObserverInit;
}

export interface IndicatorMonitoringOptions {
  debounceDelay?: number;
  watchAttributes?: string[];
}

export interface PageChangesSummary {
  addedElements: Element[];
  removedElements: Element[];
  modifiedElements: Element[];
  attributeChanges: AttributeChange[];
  timestamp: number;
  mutationCount: number;
}

export interface AttributeChange {
  element: Element;
  attributeName: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface IndicatorChange {
  indicator: ContentIndicator;
  changes: PageChangesSummary;
  newStrength: number;
  isStillPresent: boolean;
}

export interface NewContentNotification {
  newElements: Element[];
  changes: PageChangesSummary;
  confidence: number;
  timestamp: number;
}

export interface MonitoringStatus {
  isActive: boolean;
  activeMonitors: number;
  totalCallbacks: number;
  monitorIds: string[];
  performanceMetrics: AggregatedMetrics;
}

export interface PerformanceMetrics {
  mutationCount: number;
  averageProcessingTime: number;
  callbackCount: number;
  lastActivity: number;
  startTime: number;
}

export interface AggregatedMetrics {
  totalMonitors: number;
  totalMutations: number;
  averageProcessingTime: number;
  totalCallbacks: number;
}

export interface OptimizationResult {
  optimizedMonitors: number;
  optimizations: string[];
  newConfiguration: MonitoringConfig;
}

// Callback types
export type ChangeCallback = (changes: PageChangesSummary) => void;
export type IndicatorChangeCallback = (change: IndicatorChange) => void;
export type NewContentCallback = (notification: NewContentNotification) => void;

// Create singleton instance
export const pageMonitor = new PageMonitor();
