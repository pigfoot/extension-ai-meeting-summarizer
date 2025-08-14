/**
 * Error aggregator for Service Worker error collection and analytics
 * Implements comprehensive error tracking, categorization, and reporting
 */

/**
 * Error severity levels
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Error categories
 */
export type ErrorCategory =
  | 'api'
  | 'storage'
  | 'network'
  | 'parsing'
  | 'validation'
  | 'runtime'
  | 'permission'
  | 'timeout'
  | 'memory'
  | 'unknown';

/**
 * Error source components
 */
export type ErrorSource =
  | 'background'
  | 'content'
  | 'popup'
  | 'options'
  | 'azure'
  | 'storage'
  | 'messaging'
  | 'jobs'
  | 'lifecycle'
  | 'external';

/**
 * Error context information
 */
export interface ErrorContext {
  /** User agent information */
  userAgent: string;
  /** Extension version */
  extensionVersion: string;
  /** Chrome version */
  chromeVersion: string;
  /** Component state at time of error */
  componentState?: Record<string, unknown>;
  /** Request/operation context */
  operationContext?: {
    /** Operation identifier */
    operationId: string;
    /** Operation type */
    operationType: string;
    /** Operation parameters */
    parameters?: Record<string, unknown>;
    /** Operation start time */
    startTime: string;
  };
  /** User interaction context */
  userContext?: {
    /** User action that triggered error */
    userAction: string;
    /** Page URL when error occurred */
    pageUrl?: string;
    /** Tab information */
    tabInfo?: {
      id: number;
      url: string;
      title: string;
    };
  };
}

/**
 * Aggregated error information
 */
export interface AggregatedError {
  /** Error identifier */
  errorId: string;
  /** Error hash for grouping */
  errorHash: string;
  /** Error message */
  message: string;
  /** Error stack trace */
  stack?: string;
  /** Error severity */
  severity: ErrorSeverity;
  /** Error category */
  category: ErrorCategory;
  /** Error source component */
  source: ErrorSource;
  /** First occurrence timestamp */
  firstOccurrence: string;
  /** Last occurrence timestamp */
  lastOccurrence: string;
  /** Occurrence count */
  occurrenceCount: number;
  /** Error context */
  context: ErrorContext;
  /** Error resolution status */
  resolved: boolean;
  /** Error acknowledgment */
  acknowledged: boolean;
  /** Related error patterns */
  relatedPatterns: string[];
  /** Error impact assessment */
  impact: {
    /** Affected users estimate */
    affectedUsers: number;
    /** Service disruption level */
    serviceDisruption: 'none' | 'minimal' | 'moderate' | 'severe';
    /** Business impact */
    businessImpact: 'low' | 'medium' | 'high';
  };
}

/**
 * Error pattern information
 */
export interface ErrorPattern {
  /** Pattern identifier */
  patternId: string;
  /** Pattern description */
  description: string;
  /** Pattern regex or matching criteria */
  matcher: string | RegExp;
  /** Pattern category */
  category: ErrorCategory;
  /** Pattern severity */
  severity: ErrorSeverity;
  /** Occurrence count */
  occurrenceCount: number;
  /** Pattern detection timestamp */
  detectedAt: string;
  /** Last occurrence timestamp */
  lastOccurrence: string;
  /** Associated error IDs */
  associatedErrors: string[];
}

/**
 * Error analytics data
 */
export interface ErrorAnalytics {
  /** Total errors collected */
  totalErrors: number;
  /** Errors by severity */
  errorsBySeverity: Record<ErrorSeverity, number>;
  /** Errors by category */
  errorsByCategory: Record<ErrorCategory, number>;
  /** Errors by source */
  errorsBySource: Record<ErrorSource, number>;
  /** Error trends */
  trends: {
    /** Hourly error rate */
    hourlyRate: number;
    /** Daily error rate */
    dailyRate: number;
    /** Weekly trend direction */
    weeklyTrend: 'increasing' | 'stable' | 'decreasing';
    /** Most common error patterns */
    topPatterns: string[];
  };
  /** Error resolution metrics */
  resolution: {
    /** Resolution rate percentage */
    resolutionRate: number;
    /** Average resolution time */
    avgResolutionTime: number;
    /** Unresolved critical errors */
    unresolvedCritical: number;
  };
  /** Last analysis timestamp */
  lastAnalysis: string;
}

/**
 * Error reporting configuration
 */
export interface ErrorReportingConfig {
  /** Enable error collection */
  enabled: boolean;
  /** Enable automatic error reporting */
  autoReporting: boolean;
  /** Error retention period in milliseconds */
  retentionPeriod: number;
  /** Maximum errors to store */
  maxErrors: number;
  /** Minimum severity for collection */
  minSeverity: ErrorSeverity;
  /** Enable pattern detection */
  enablePatternDetection: boolean;
  /** Enable context collection */
  enableContextCollection: boolean;
  /** Reporting endpoints */
  reportingEndpoints: {
    /** Console logging */
    console: boolean;
    /** Chrome storage */
    storage: boolean;
    /** External analytics service */
    external?: {
      enabled: boolean;
      endpoint: string;
      apiKey?: string;
    };
  };
  /** Privacy settings */
  privacy: {
    /** Exclude sensitive data */
    excludeSensitiveData: boolean;
    /** Anonymize user data */
    anonymizeUserData: boolean;
    /** Exclude URLs */
    excludeUrls: boolean;
  };
}

/**
 * Error aggregator statistics
 */
export interface ErrorAggregatorStats {
  /** Total errors processed */
  totalErrorsProcessed: number;
  /** Errors by processing status */
  processingStats: {
    /** Successfully processed */
    processed: number;
    /** Failed to process */
    failed: number;
    /** Skipped due to filters */
    skipped: number;
  };
  /** Pattern detection stats */
  patternStats: {
    /** Total patterns detected */
    totalPatterns: number;
    /** Active patterns */
    activePatterns: number;
    /** Pattern detection accuracy */
    detectionAccuracy: number;
  };
  /** Performance metrics */
  performance: {
    /** Average processing time */
    avgProcessingTime: number;
    /** Memory usage */
    memoryUsage: number;
    /** Processing throughput */
    throughput: number;
  };
  /** Last update timestamp */
  lastUpdated: string;
}

/**
 * Error aggregator for comprehensive error management
 */
export class ErrorAggregator {
  private config: ErrorReportingConfig;
  private errors = new Map<string, AggregatedError>();
  private patterns = new Map<string, ErrorPattern>();
  private analytics: ErrorAnalytics;
  private stats: ErrorAggregatorStats;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<ErrorReportingConfig> = {}) {
    this.config = {
      enabled: true,
      autoReporting: true,
      retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
      maxErrors: 1000,
      minSeverity: 'low',
      enablePatternDetection: true,
      enableContextCollection: true,
      reportingEndpoints: {
        console: true,
        storage: true,
        external: {
          enabled: false,
          endpoint: '',
        },
      },
      privacy: {
        excludeSensitiveData: true,
        anonymizeUserData: true,
        excludeUrls: false,
      },
      ...config,
    };

    this.analytics = this.initializeAnalytics();
    this.stats = this.initializeStats();

    if (this.config.enabled) {
      this.startCleanupTimer();
      this.setupGlobalErrorHandlers();
    }
  }

  /**
   * Record error occurrence
   */
  async recordError(
    error: Error | string,
    options?: {
      severity?: ErrorSeverity;
      category?: ErrorCategory;
      source?: ErrorSource;
      context?: Partial<ErrorContext>;
      operationId?: string;
    },
  ): Promise<string> {
    if (!this.config.enabled) {
      return '';
    }

    const startTime = Date.now();

    try {
      // Normalize error information
      const errorInfo = this.normalizeError(error);
      const severity = options?.severity || this.determineSeverity(errorInfo, options?.category);

      // Check minimum severity filter
      if (!this.meetsSeverityThreshold(severity)) {
        this.stats.processingStats.skipped++;
        return '';
      }

      // Generate error hash for grouping
      const errorHash = this.generateErrorHash(errorInfo.message, errorInfo.stack, options?.source);

      // Check if error already exists
      let aggregatedError = this.findErrorByHash(errorHash);

      if (aggregatedError) {
        // Update existing error
        aggregatedError.lastOccurrence = new Date().toISOString();
        aggregatedError.occurrenceCount++;

        // Update context if provided
        if (options?.context) {
          aggregatedError.context = { ...aggregatedError.context, ...options.context };
        }
      } else {
        // Create new aggregated error
        const errorId = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const context = await this.collectErrorContext(options?.context, options?.operationId);

        aggregatedError = {
          errorId,
          errorHash,
          message: errorInfo.message,
          stack: errorInfo.stack,
          severity,
          category: options?.category || this.categorizeError(errorInfo),
          source: options?.source || 'unknown',
          firstOccurrence: new Date().toISOString(),
          lastOccurrence: new Date().toISOString(),
          occurrenceCount: 1,
          context,
          resolved: false,
          acknowledged: false,
          relatedPatterns: [],
          impact: this.assessErrorImpact(severity, options?.category),
        };

        this.errors.set(errorId, aggregatedError);
      }

      // Detect patterns
      if (this.config.enablePatternDetection) {
        await this.detectPatterns(aggregatedError);
      }

      // Report error
      if (this.config.autoReporting) {
        await this.reportError(aggregatedError);
      }

      // Update analytics
      this.updateAnalytics(aggregatedError);

      // Update statistics
      this.stats.totalErrorsProcessed++;
      this.stats.processingStats.processed++;
      this.stats.performance.avgProcessingTime = this.updateAverageTime(
        this.stats.performance.avgProcessingTime,
        Date.now() - startTime,
        this.stats.processingStats.processed,
      );

      console.debug(`[ErrorAggregator] Error recorded: ${aggregatedError.errorId} (${severity})`);

      return aggregatedError.errorId;
    } catch (processingError) {
      this.stats.processingStats.failed++;
      console.error('[ErrorAggregator] Failed to record error:', processingError);
      return '';
    }
  }

  /**
   * Get aggregated errors
   */
  getErrors(options?: {
    severity?: ErrorSeverity;
    category?: ErrorCategory;
    source?: ErrorSource;
    resolved?: boolean;
    acknowledged?: boolean;
    limit?: number;
  }): AggregatedError[] {
    let filteredErrors = Array.from(this.errors.values());

    // Apply filters
    if (options?.severity) {
      filteredErrors = filteredErrors.filter(error => error.severity === options.severity);
    }

    if (options?.category) {
      filteredErrors = filteredErrors.filter(error => error.category === options.category);
    }

    if (options?.source) {
      filteredErrors = filteredErrors.filter(error => error.source === options.source);
    }

    if (options?.resolved !== undefined) {
      filteredErrors = filteredErrors.filter(error => error.resolved === options.resolved);
    }

    if (options?.acknowledged !== undefined) {
      filteredErrors = filteredErrors.filter(error => error.acknowledged === options.acknowledged);
    }

    // Sort by last occurrence (most recent first)
    filteredErrors.sort((a, b) => new Date(b.lastOccurrence).getTime() - new Date(a.lastOccurrence).getTime());

    // Apply limit
    if (options?.limit && options.limit > 0) {
      filteredErrors = filteredErrors.slice(0, options.limit);
    }

    return filteredErrors;
  }

  /**
   * Get error patterns
   */
  getPatterns(options?: { category?: ErrorCategory; minOccurrences?: number; active?: boolean }): ErrorPattern[] {
    let filteredPatterns = Array.from(this.patterns.values());

    if (options?.category) {
      filteredPatterns = filteredPatterns.filter(pattern => pattern.category === options.category);
    }

    if (options?.minOccurrences) {
      filteredPatterns = filteredPatterns.filter(pattern => pattern.occurrenceCount >= options.minOccurrences!);
    }

    if (options?.active) {
      const recentThreshold = Date.now() - 24 * 60 * 60 * 1000; // Last 24 hours
      filteredPatterns = filteredPatterns.filter(
        pattern => new Date(pattern.lastOccurrence).getTime() >= recentThreshold,
      );
    }

    return filteredPatterns.sort((a, b) => b.occurrenceCount - a.occurrenceCount);
  }

  /**
   * Get error analytics
   */
  getAnalytics(): ErrorAnalytics {
    this.updateTrends();
    this.analytics.lastAnalysis = new Date().toISOString();
    return { ...this.analytics };
  }

  /**
   * Acknowledge error
   */
  acknowledgeError(errorId: string): boolean {
    const error = this.errors.get(errorId);
    if (error) {
      error.acknowledged = true;
      console.log(`[ErrorAggregator] Error acknowledged: ${errorId}`);
      return true;
    }
    return false;
  }

  /**
   * Resolve error
   */
  resolveError(errorId: string, resolutionNotes?: string): boolean {
    const error = this.errors.get(errorId);
    if (error) {
      error.resolved = true;
      error.acknowledged = true;

      // Update analytics
      this.analytics.resolution.resolutionRate = this.calculateResolutionRate();

      console.log(`[ErrorAggregator] Error resolved: ${errorId}`);

      if (resolutionNotes) {
        console.log(`[ErrorAggregator] Resolution notes: ${resolutionNotes}`);
      }

      return true;
    }
    return false;
  }

  /**
   * Get error statistics
   */
  getStats(): ErrorAggregatorStats {
    this.updatePerformanceStats();
    this.stats.lastUpdated = new Date().toISOString();
    return { ...this.stats };
  }

  /**
   * Clear resolved errors
   */
  clearResolvedErrors(): number {
    const resolvedErrors = Array.from(this.errors.entries()).filter(([, error]) => error.resolved);

    for (const [errorId] of resolvedErrors) {
      this.errors.delete(errorId);
    }

    console.log(`[ErrorAggregator] Cleared ${resolvedErrors.length} resolved errors`);

    return resolvedErrors.length;
  }

  /**
   * Export error data
   */
  exportErrors(options?: {
    format?: 'json' | 'csv';
    includeResolved?: boolean;
    dateRange?: {
      start: string;
      end: string;
    };
  }): string {
    const errors = this.getErrors({
      resolved: options?.includeResolved,
    });

    // Apply date range filter
    let filteredErrors = errors;
    if (options?.dateRange) {
      const startTime = new Date(options.dateRange.start).getTime();
      const endTime = new Date(options.dateRange.end).getTime();

      filteredErrors = errors.filter(error => {
        const errorTime = new Date(error.lastOccurrence).getTime();
        return errorTime >= startTime && errorTime <= endTime;
      });
    }

    // Export based on format
    if (options?.format === 'csv') {
      return this.exportToCSV(filteredErrors);
    } else {
      return JSON.stringify(
        {
          exportTimestamp: new Date().toISOString(),
          errorCount: filteredErrors.length,
          errors: filteredErrors,
          analytics: this.getAnalytics(),
        },
        null,
        2,
      );
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ErrorReportingConfig>): void {
    const wasEnabled = this.config.enabled;
    this.config = { ...this.config, ...config };

    if (this.config.enabled && !wasEnabled) {
      this.startCleanupTimer();
      this.setupGlobalErrorHandlers();
    } else if (!this.config.enabled && wasEnabled) {
      this.stopCleanupTimer();
    }

    console.log('[ErrorAggregator] Configuration updated');
  }

  /**
   * Shutdown error aggregator
   */
  async shutdown(): Promise<void> {
    console.log('[ErrorAggregator] Shutting down');

    this.stopCleanupTimer();

    // Export final error report if enabled
    if (this.config.reportingEndpoints.storage && this.errors.size > 0) {
      try {
        const finalReport = this.exportErrors();
        await chrome.storage.local.set({
          [`error_final_report_${Date.now()}`]: finalReport,
        });
      } catch (error) {
        console.warn('[ErrorAggregator] Failed to save final report:', error);
      }
    }

    this.errors.clear();
    this.patterns.clear();

    console.log('[ErrorAggregator] Shutdown completed');
  }

  /**
   * Normalize error information
   */
  private normalizeError(error: Error | string): { message: string; stack?: string } {
    if (typeof error === 'string') {
      return { message: error };
    }

    return {
      message: error.message || 'Unknown error',
      stack: error.stack,
    };
  }

  /**
   * Determine error severity
   */
  private determineSeverity(errorInfo: { message: string; stack?: string }, category?: ErrorCategory): ErrorSeverity {
    const message = errorInfo.message.toLowerCase();

    // Critical patterns
    if (
      message.includes('out of memory') ||
      message.includes('quota exceeded') ||
      message.includes('service unavailable') ||
      category === 'memory'
    ) {
      return 'critical';
    }

    // High severity patterns
    if (
      message.includes('network error') ||
      message.includes('timeout') ||
      message.includes('permission denied') ||
      category === 'api' ||
      category === 'network'
    ) {
      return 'high';
    }

    // Medium severity patterns
    if (
      message.includes('validation') ||
      message.includes('parsing') ||
      category === 'validation' ||
      category === 'parsing'
    ) {
      return 'medium';
    }

    // Default to low severity
    return 'low';
  }

  /**
   * Check if error meets severity threshold
   */
  private meetsSeverityThreshold(severity: ErrorSeverity): boolean {
    const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 };
    const minLevel = severityLevels[this.config.minSeverity];
    const errorLevel = severityLevels[severity];

    return errorLevel >= minLevel;
  }

  /**
   * Generate error hash for grouping
   */
  private generateErrorHash(message: string, stack?: string, source?: ErrorSource): string {
    // Normalize message by removing dynamic parts
    const normalizedMessage = message
      .replace(/\d+/g, '[NUM]') // Replace numbers
      .replace(/https?:\/\/[^\s]+/g, '[URL]') // Replace URLs
      .replace(/id-\w+/g, '[ID]') // Replace IDs
      .replace(/uuid-[\w-]+/g, '[UUID]'); // Replace UUIDs

    // Use first few lines of stack trace for more specific grouping
    let stackSignature = '';
    if (stack) {
      const stackLines = stack.split('\n').slice(0, 3);
      stackSignature = stackLines.join('|');
    }

    const hashInput = `${normalizedMessage}|${stackSignature}|${source || ''}`;

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < hashInput.length; i++) {
      const char = hashInput.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return Math.abs(hash).toString(36);
  }

  /**
   * Find error by hash
   */
  private findErrorByHash(hash: string): AggregatedError | undefined {
    for (const error of this.errors.values()) {
      if (error.errorHash === hash) {
        return error;
      }
    }
    return undefined;
  }

  /**
   * Categorize error automatically
   */
  private categorizeError(errorInfo: { message: string; stack?: string }): ErrorCategory {
    const message = errorInfo.message.toLowerCase();

    if (message.includes('network') || message.includes('fetch')) return 'network';
    if (message.includes('storage') || message.includes('quota')) return 'storage';
    if (message.includes('api') || message.includes('http')) return 'api';
    if (message.includes('parse') || message.includes('json')) return 'parsing';
    if (message.includes('validation') || message.includes('invalid')) return 'validation';
    if (message.includes('timeout') || message.includes('abort')) return 'timeout';
    if (message.includes('permission') || message.includes('access')) return 'permission';
    if (message.includes('memory') || message.includes('heap')) return 'memory';
    if (message.includes('runtime') || message.includes('reference')) return 'runtime';

    return 'unknown';
  }

  /**
   * Collect error context information
   */
  private async collectErrorContext(
    providedContext?: Partial<ErrorContext>,
    operationId?: string,
  ): Promise<ErrorContext> {
    const context: ErrorContext = {
      userAgent: navigator.userAgent,
      extensionVersion: chrome.runtime.getManifest().version,
      chromeVersion: this.extractChromeVersion(navigator.userAgent),
      ...providedContext,
    };

    // Add operation context if provided
    if (operationId) {
      context.operationContext = {
        operationId,
        operationType: 'unknown',
        startTime: new Date().toISOString(),
        ...providedContext?.operationContext,
      };
    }

    // Collect tab information if available
    if (!this.config.privacy.excludeUrls) {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs.length > 0 && tabs[0]) {
          context.userContext = {
            userAction: 'unknown',
            pageUrl: tabs[0].url,
            tabInfo: {
              id: tabs[0].id!,
              url: tabs[0].url!,
              title: tabs[0].title || '',
            },
            ...providedContext?.userContext,
          };
        }
      } catch (_error) {
        // Ignore tab access errors
      }
    }

    return context;
  }

  /**
   * Extract Chrome version from user agent
   */
  private extractChromeVersion(userAgent: string): string {
    const match = userAgent.match(/Chrome\/(\d+\.\d+\.\d+\.\d+)/);
    return match ? match[1] : 'unknown';
  }

  /**
   * Assess error impact
   */
  private assessErrorImpact(severity: ErrorSeverity, category?: ErrorCategory): AggregatedError['impact'] {
    let serviceDisruption: AggregatedError['impact']['serviceDisruption'] = 'none';
    let businessImpact: AggregatedError['impact']['businessImpact'] = 'low';

    // Assess service disruption
    if (severity === 'critical') {
      serviceDisruption = 'severe';
      businessImpact = 'high';
    } else if (severity === 'high') {
      serviceDisruption = category === 'api' || category === 'network' ? 'moderate' : 'minimal';
      businessImpact = 'medium';
    } else if (severity === 'medium') {
      serviceDisruption = 'minimal';
    }

    return {
      affectedUsers: 1, // Estimate, would need actual user tracking
      serviceDisruption,
      businessImpact,
    };
  }

  /**
   * Detect error patterns
   */
  private async detectPatterns(error: AggregatedError): Promise<void> {
    // Check against existing patterns
    for (const pattern of this.patterns.values()) {
      if (this.matchesPattern(error, pattern)) {
        pattern.occurrenceCount++;
        pattern.lastOccurrence = error.lastOccurrence;
        pattern.associatedErrors.push(error.errorId);
        error.relatedPatterns.push(pattern.patternId);
        return;
      }
    }

    // Create new pattern if this error occurs frequently
    const similarErrors = Array.from(this.errors.values()).filter(e => e.errorHash === error.errorHash);

    if (similarErrors.length >= 3) {
      // Threshold for pattern detection
      const patternId = `pattern-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const pattern: ErrorPattern = {
        patternId,
        description: `Recurring error: ${error.message.substring(0, 100)}...`,
        matcher: error.message,
        category: error.category,
        severity: error.severity,
        occurrenceCount: similarErrors.length,
        detectedAt: new Date().toISOString(),
        lastOccurrence: error.lastOccurrence,
        associatedErrors: similarErrors.map(e => e.errorId),
      };

      this.patterns.set(patternId, pattern);

      // Update related errors
      for (const similarError of similarErrors) {
        similarError.relatedPatterns.push(patternId);
      }

      this.stats.patternStats.totalPatterns++;
      console.log(`[ErrorAggregator] New error pattern detected: ${patternId}`);
    }
  }

  /**
   * Check if error matches pattern
   */
  private matchesPattern(error: AggregatedError, pattern: ErrorPattern): boolean {
    if (pattern.matcher instanceof RegExp) {
      return pattern.matcher.test(error.message);
    } else {
      return error.message.includes(pattern.matcher);
    }
  }

  /**
   * Report error to configured endpoints
   */
  private async reportError(error: AggregatedError): Promise<void> {
    // Console reporting
    if (this.config.reportingEndpoints.console) {
      const logLevel = error.severity === 'critical' || error.severity === 'high' ? 'error' : 'warn';
      console[logLevel](`[ErrorReport] ${error.severity.toUpperCase()}: ${error.message}`, {
        errorId: error.errorId,
        category: error.category,
        source: error.source,
        occurrences: error.occurrenceCount,
      });
    }

    // Storage reporting
    if (this.config.reportingEndpoints.storage) {
      try {
        const reportKey = `error_report_${error.errorId}`;
        await chrome.storage.local.set({
          [reportKey]: this.sanitizeErrorForStorage(error),
        });
      } catch (storageError) {
        console.warn('[ErrorAggregator] Failed to store error report:', storageError);
      }
    }

    // External reporting
    if (this.config.reportingEndpoints.external?.enabled && this.config.reportingEndpoints.external.endpoint) {
      try {
        await this.sendExternalReport(error);
      } catch (externalError) {
        console.warn('[ErrorAggregator] Failed to send external error report:', externalError);
      }
    }
  }

  /**
   * Sanitize error for storage (remove sensitive data)
   */
  private sanitizeErrorForStorage(error: AggregatedError): Partial<AggregatedError> {
    const sanitized = { ...error };

    if (this.config.privacy.excludeSensitiveData) {
      // Remove potentially sensitive stack trace information
      if (sanitized.stack) {
        sanitized.stack = sanitized.stack
          .replace(/file:\/\/[^\s]+/g, '[FILE_PATH]')
          .replace(/chrome-extension:\/\/[^\s]+/g, '[EXTENSION_PATH]');
      }

      // Remove sensitive context data
      if (sanitized.context.componentState) {
        delete sanitized.context.componentState;
      }
    }

    if (this.config.privacy.excludeUrls && sanitized.context.userContext) {
      delete sanitized.context.userContext.pageUrl;
      if (sanitized.context.userContext.tabInfo) {
        delete sanitized.context.userContext.tabInfo.url;
      }
    }

    if (this.config.privacy.anonymizeUserData) {
      sanitized.context.userAgent = 'anonymized';
    }

    return sanitized;
  }

  /**
   * Send error report to external service
   */
  private async sendExternalReport(error: AggregatedError): Promise<void> {
    const endpoint = this.config.reportingEndpoints.external!;

    const payload = {
      errorId: error.errorId,
      message: error.message,
      severity: error.severity,
      category: error.category,
      source: error.source,
      occurrenceCount: error.occurrenceCount,
      timestamp: error.lastOccurrence,
      context: this.sanitizeErrorForStorage(error).context,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (endpoint.apiKey) {
      headers.Authorization = `Bearer ${endpoint.apiKey}`;
    }

    await fetch(endpoint.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
  }

  /**
   * Export errors to CSV format
   */
  private exportToCSV(errors: AggregatedError[]): string {
    const headers = [
      'Error ID',
      'Message',
      'Severity',
      'Category',
      'Source',
      'Occurrences',
      'First Occurrence',
      'Last Occurrence',
      'Resolved',
      'Acknowledged',
    ];

    const rows = errors.map(error => [
      error.errorId,
      `"${error.message.replace(/"/g, '""')}"`, // Escape quotes
      error.severity,
      error.category,
      error.source,
      error.occurrenceCount.toString(),
      error.firstOccurrence,
      error.lastOccurrence,
      error.resolved ? 'Yes' : 'No',
      error.acknowledged ? 'Yes' : 'No',
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  /**
   * Update error analytics
   */
  private updateAnalytics(error: AggregatedError): void {
    this.analytics.totalErrors = this.errors.size;
    this.analytics.errorsBySeverity[error.severity]++;
    this.analytics.errorsByCategory[error.category]++;
    this.analytics.errorsBySource[error.source]++;
  }

  /**
   * Update trend analysis
   */
  private updateTrends(): void {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;
    const oneWeek = 7 * oneDay;

    const recentErrors = Array.from(this.errors.values());

    // Calculate hourly rate
    const hourlyErrors = recentErrors.filter(error => new Date(error.lastOccurrence).getTime() >= now - oneHour);
    this.analytics.trends.hourlyRate = hourlyErrors.length;

    // Calculate daily rate
    const dailyErrors = recentErrors.filter(error => new Date(error.lastOccurrence).getTime() >= now - oneDay);
    this.analytics.trends.dailyRate = dailyErrors.length;

    // Calculate weekly trend
    const weeklyErrors = recentErrors.filter(error => new Date(error.lastOccurrence).getTime() >= now - oneWeek);

    const previousWeekErrors = recentErrors.filter(error => {
      const errorTime = new Date(error.lastOccurrence).getTime();
      return errorTime >= now - 2 * oneWeek && errorTime < now - oneWeek;
    });

    if (previousWeekErrors.length === 0) {
      this.analytics.trends.weeklyTrend = 'stable';
    } else {
      const changePercent = ((weeklyErrors.length - previousWeekErrors.length) / previousWeekErrors.length) * 100;

      if (changePercent > 10) {
        this.analytics.trends.weeklyTrend = 'increasing';
      } else if (changePercent < -10) {
        this.analytics.trends.weeklyTrend = 'decreasing';
      } else {
        this.analytics.trends.weeklyTrend = 'stable';
      }
    }

    // Update top patterns
    this.analytics.trends.topPatterns = Array.from(this.patterns.values())
      .sort((a, b) => b.occurrenceCount - a.occurrenceCount)
      .slice(0, 5)
      .map(pattern => pattern.patternId);
  }

  /**
   * Calculate resolution rate
   */
  private calculateResolutionRate(): number {
    const totalErrors = this.errors.size;
    const resolvedErrors = Array.from(this.errors.values()).filter(error => error.resolved).length;

    return totalErrors > 0 ? (resolvedErrors / totalErrors) * 100 : 0;
  }

  /**
   * Update performance statistics
   */
  private updatePerformanceStats(): void {
    // Update memory usage (approximate)
    const errorDataSize = JSON.stringify(Array.from(this.errors.values())).length;
    const patternDataSize = JSON.stringify(Array.from(this.patterns.values())).length;
    this.stats.performance.memoryUsage = errorDataSize + patternDataSize;

    // Update pattern detection accuracy
    const totalPatterns = this.patterns.size;
    const activePatterns = Array.from(this.patterns.values()).filter(pattern => {
      const recentThreshold = Date.now() - 24 * 60 * 60 * 1000;
      return new Date(pattern.lastOccurrence).getTime() >= recentThreshold;
    }).length;

    this.stats.patternStats.totalPatterns = totalPatterns;
    this.stats.patternStats.activePatterns = activePatterns;
    this.stats.patternStats.detectionAccuracy = totalPatterns > 0 ? (activePatterns / totalPatterns) * 100 : 0;

    // Update throughput
    const _totalProcessed = this.stats.processingStats.processed;
    const processingTime = this.stats.performance.avgProcessingTime;
    this.stats.performance.throughput = processingTime > 0 ? 1000 / processingTime : 0;
  }

  /**
   * Update average time calculation
   */
  private updateAverageTime(currentAvg: number, newTime: number, count: number): number {
    return (currentAvg * (count - 1) + newTime) / count;
  }

  /**
   * Setup global error handlers
   */
  private setupGlobalErrorHandlers(): void {
    // Handle unhandled errors
    globalThis.addEventListener('error', event => {
      this.recordError(event.error || event.message, {
        severity: 'high',
        category: 'runtime',
        source: 'background',
        context: {
          userAgent: navigator.userAgent,
          extensionVersion: chrome.runtime.getManifest().version,
          chromeVersion: this.extractChromeVersion(navigator.userAgent),
        },
      });
    });

    // Handle unhandled promise rejections
    globalThis.addEventListener('unhandledrejection', event => {
      this.recordError(event.reason || 'Unhandled promise rejection', {
        severity: 'high',
        category: 'runtime',
        source: 'background',
        context: {
          userAgent: navigator.userAgent,
          extensionVersion: chrome.runtime.getManifest().version,
          chromeVersion: this.extractChromeVersion(navigator.userAgent),
        },
      });
    });
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupInterval) {
      return;
    }

    this.cleanupInterval = setInterval(
      () => {
        this.cleanupOldErrors();
      },
      60 * 60 * 1000,
    ); // Run every hour

    console.log('[ErrorAggregator] Cleanup timer started');
  }

  /**
   * Stop cleanup timer
   */
  private stopCleanupTimer(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('[ErrorAggregator] Cleanup timer stopped');
    }
  }

  /**
   * Cleanup old errors
   */
  private cleanupOldErrors(): void {
    const cutoffTime = Date.now() - this.config.retentionPeriod;
    const originalErrorCount = this.errors.size;
    const originalPatternCount = this.patterns.size;

    // Remove old errors
    for (const [errorId, error] of this.errors.entries()) {
      if (new Date(error.lastOccurrence).getTime() < cutoffTime) {
        this.errors.delete(errorId);
      }
    }

    // Remove old patterns
    for (const [patternId, pattern] of this.patterns.entries()) {
      if (new Date(pattern.lastOccurrence).getTime() < cutoffTime) {
        this.patterns.delete(patternId);
      }
    }

    // Enforce maximum error limit
    if (this.errors.size > this.config.maxErrors) {
      const errorArray = Array.from(this.errors.entries()).sort(
        ([, a], [, b]) => new Date(a.lastOccurrence).getTime() - new Date(b.lastOccurrence).getTime(),
      );

      const errorsToRemove = errorArray.slice(0, this.errors.size - this.config.maxErrors);
      for (const [errorId] of errorsToRemove) {
        this.errors.delete(errorId);
      }
    }

    const removedErrors = originalErrorCount - this.errors.size;
    const removedPatterns = originalPatternCount - this.patterns.size;

    if (removedErrors > 0 || removedPatterns > 0) {
      console.log(`[ErrorAggregator] Cleanup completed: ${removedErrors} errors, ${removedPatterns} patterns removed`);
    }
  }

  /**
   * Initialize error analytics
   */
  private initializeAnalytics(): ErrorAnalytics {
    return {
      totalErrors: 0,
      errorsBySeverity: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      },
      errorsByCategory: {
        api: 0,
        storage: 0,
        network: 0,
        parsing: 0,
        validation: 0,
        runtime: 0,
        permission: 0,
        timeout: 0,
        memory: 0,
        unknown: 0,
      },
      errorsBySource: {
        background: 0,
        content: 0,
        popup: 0,
        options: 0,
        azure: 0,
        storage: 0,
        messaging: 0,
        jobs: 0,
        lifecycle: 0,
        external: 0,
      },
      trends: {
        hourlyRate: 0,
        dailyRate: 0,
        weeklyTrend: 'stable',
        topPatterns: [],
      },
      resolution: {
        resolutionRate: 0,
        avgResolutionTime: 0,
        unresolvedCritical: 0,
      },
      lastAnalysis: new Date().toISOString(),
    };
  }

  /**
   * Initialize error aggregator statistics
   */
  private initializeStats(): ErrorAggregatorStats {
    return {
      totalErrorsProcessed: 0,
      processingStats: {
        processed: 0,
        failed: 0,
        skipped: 0,
      },
      patternStats: {
        totalPatterns: 0,
        activePatterns: 0,
        detectionAccuracy: 0,
      },
      performance: {
        avgProcessingTime: 0,
        memoryUsage: 0,
        throughput: 0,
      },
      lastUpdated: new Date().toISOString(),
    };
  }
}
