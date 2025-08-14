/**
 * Analysis Orchestrator
 * Orchestrates the complete meeting detection and analysis workflow
 */

import { pageAnalyzer } from './page-analyzer';
import { tenantConfig } from '../compatibility/tenant-config';
import { domainDetector } from '../detection/domain-detector';
import { urlValidator } from '../validation/url-validator';
import type { MeetingDetection, PageAnalysisResult } from '../types/index';

/**
 * High-level orchestration of meeting detection and analysis workflows
 */
export class AnalysisOrchestrator {
  private activeWorkflows: Map<string, ActiveWorkflow> = new Map();
  private workflowHistory: WorkflowHistoryEntry[] = [];
  private metrics: AnalysisMetrics = {
    totalAnalyses: 0,
    successfulAnalyses: 0,
    failedAnalyses: 0,
    averageProcessingTime: 0,
    platformDistribution: new Map(),
    errorTypes: new Map(),
  };

  constructor() {
    this.setupMetricsCollection();
  }

  /**
   * Execute complete meeting detection workflow
   */
  async executeMeetingDetection(
    document: Document,
    url: string,
    options: WorkflowOptions = {},
  ): Promise<MeetingDetectionResult> {
    const workflowId = this.generateWorkflowId();
    const workflow = this.createWorkflow('meeting_detection', workflowId, url);

    try {
      this.startWorkflow(workflow);

      // Step 1: URL Validation
      await this.executeStep(workflow, 'url_validation', async () => {
        const validations = await urlValidator.validateMultipleUrls([url]);
        const validation = validations[0];
        if (!validation?.isValid) {
          throw new Error(`Invalid URL: ${validation?.errors?.join(', ') || 'Unknown validation error'}`);
        }
        return validation;
      });

      // Step 2: Domain Detection
      await this.executeStep(workflow, 'domain_detection', async () => domainDetector.detectSharePointDomain(url));

      // Step 3: Quick Detection
      const detection = await this.executeStep(workflow, 'quick_detection', async () =>
        pageAnalyzer.quickDetection(document, url),
      );

      // Step 4: Enhanced Analysis (if meeting detected)
      let analysisResult: PageAnalysisResult | null = null;
      if (detection.isMeetingPage && options.performFullAnalysis) {
        analysisResult = await this.executeStep(workflow, 'full_analysis', async () =>
          pageAnalyzer.analyzePage(document, url, {
            includeTenantConfig: options.includeTenantConfig,
            includeParticipants: options.includeParticipants,
            includeAgenda: options.includeAgenda,
          }),
        );
      }

      this.completeWorkflow(workflow, 'success');

      return {
        workflowId,
        detection,
        analysis: analysisResult,
        workflow: {
          id: workflowId,
          type: 'meeting_detection',
          status: 'completed',
          steps: workflow.steps,
          duration: Date.now() - workflow.startTime,
          metadata: workflow.metadata,
        },
      };
    } catch (error) {
      this.completeWorkflow(workflow, 'failed', error);
      throw error;
    }
  }

  /**
   * Execute comprehensive page analysis workflow
   */
  async executePageAnalysis(
    document: Document,
    url: string,
    options: AnalysisWorkflowOptions = {},
  ): Promise<PageAnalysisWorkflowResult> {
    const workflowId = this.generateWorkflowId();
    const workflow = this.createWorkflow('page_analysis', workflowId, url);

    try {
      this.startWorkflow(workflow);

      // Step 1: Pre-Analysis Checks
      await this.executeStep(workflow, 'pre_analysis', async () => this.performPreAnalysisChecks(document, url));

      // Step 2: Tenant Configuration
      const tenantConfiguration = await this.executeStep(workflow, 'tenant_config', async () =>
        tenantConfig.detectTenantConfig(url, document),
      );

      // Step 3: Core Analysis
      const analysis = await this.executeStep(workflow, 'core_analysis', async () =>
        pageAnalyzer.analyzePage(document, url, {
          forceRefresh: options.forceRefresh,
          includeTenantConfig: true,
          includeParticipants: options.includeParticipants,
          includeAgenda: options.includeAgenda,
        }),
      );

      // Step 4: Enhanced Data Extraction
      let meetingData = null;
      if (analysis.isMeetingPage && options.extractMeetingData) {
        meetingData = await this.executeStep(workflow, 'data_extraction', async () =>
          pageAnalyzer.extractMeetingData(document, url, {
            includeTenantConfig: true,
            includeParticipants: options.includeParticipants,
            includeAgenda: options.includeAgenda,
          }),
        );
      }

      // Step 5: Quality Assessment
      const qualityAssessment = await this.executeStep(workflow, 'quality_assessment', async () =>
        this.assessAnalysisQuality(analysis, meetingData),
      );

      this.completeWorkflow(workflow, 'success');

      return {
        workflowId,
        analysis,
        meetingData,
        tenantConfig: tenantConfiguration,
        quality: qualityAssessment,
        workflow: {
          id: workflowId,
          type: 'page_analysis',
          status: 'completed',
          steps: workflow.steps,
          duration: Date.now() - workflow.startTime,
          metadata: workflow.metadata,
        },
      };
    } catch (error) {
      this.completeWorkflow(workflow, 'failed', error);
      throw error;
    }
  }

  /**
   * Execute monitoring workflow for dynamic content
   */
  async executeMonitoringWorkflow(
    document: Document,
    url: string,
    options: MonitoringWorkflowOptions = {},
  ): Promise<MonitoringWorkflowResult> {
    const workflowId = this.generateWorkflowId();
    const workflow = this.createWorkflow('monitoring', workflowId, url);

    try {
      this.startWorkflow(workflow);

      // Step 1: Initial Analysis
      const initialAnalysis = await this.executeStep(workflow, 'initial_analysis', async () =>
        pageAnalyzer.analyzePage(document, url),
      );

      // Step 2: Setup Monitoring
      const monitoringSession = await this.executeStep(workflow, 'setup_monitoring', async () =>
        pageAnalyzer.startDynamicMonitoring(document, url, changes => {
          this.handleContentChanges(workflowId, changes, options.onContentChange);
        }),
      );

      // Step 3: Configure Monitoring Rules
      await this.executeStep(workflow, 'configure_monitoring', async () =>
        this.configureMonitoringRules(monitoringSession, options.rules),
      );

      this.completeWorkflow(workflow, 'success');

      return {
        workflowId,
        initialAnalysis,
        monitoringSession,
        workflow: {
          id: workflowId,
          type: 'monitoring',
          status: 'active',
          steps: workflow.steps,
          duration: Date.now() - workflow.startTime,
          metadata: workflow.metadata,
        },
      };
    } catch (error) {
      this.completeWorkflow(workflow, 'failed', error);
      throw error;
    }
  }

  /**
   * Execute batch analysis workflow for multiple pages
   */
  async executeBatchAnalysis(
    pages: BatchAnalysisPage[],
    options: BatchAnalysisOptions = {},
  ): Promise<BatchAnalysisResult> {
    const workflowId = this.generateWorkflowId();
    const workflow = this.createWorkflow('batch_analysis', workflowId, 'batch');

    try {
      this.startWorkflow(workflow);

      const results: PageAnalysisResult[] = [];
      const errors: BatchAnalysisError[] = [];

      // Process pages in parallel or sequential based on options
      if (options.parallel && pages.length <= (options.maxConcurrency || 5)) {
        const promises = pages.map(async (page, index) => {
          try {
            const result = await pageAnalyzer.analyzePage(page.document, page.url, {
              timeout: options.pageTimeout,
            });
            return { index, result, error: null };
          } catch (error) {
            return { index, result: null, error };
          }
        });

        const outcomes = await Promise.all(promises);

        for (const outcome of outcomes) {
          if (outcome.result) {
            results.push(outcome.result);
          } else {
            errors.push({
              pageIndex: outcome.index,
              url: pages[outcome.index]?.url || 'unknown',
              error: outcome.error,
            });
          }
        }
      } else {
        // Sequential processing
        for (let i = 0; i < pages.length; i++) {
          try {
            const page = pages[i];
            if (page) {
              const result = await pageAnalyzer.analyzePage(page.document, page.url, { timeout: options.pageTimeout });
              results.push(result);
            }
          } catch (error) {
            errors.push({
              pageIndex: i,
              url: pages[i]?.url || 'unknown',
              error,
            });
          }
        }
      }

      // Generate batch summary
      const summary = this.generateBatchSummary(results, errors);

      this.completeWorkflow(workflow, 'success');

      return {
        workflowId,
        results,
        errors,
        summary,
        workflow: {
          id: workflowId,
          type: 'batch_analysis',
          status: 'completed',
          steps: workflow.steps,
          duration: Date.now() - workflow.startTime,
          metadata: workflow.metadata,
        },
      };
    } catch (error) {
      this.completeWorkflow(workflow, 'failed', error);
      throw error;
    }
  }

  /**
   * Get workflow status
   */
  getWorkflowStatus(workflowId: string): WorkflowStatus | null {
    const workflow = this.activeWorkflows.get(workflowId);
    if (workflow) {
      return {
        id: workflowId,
        type: workflow.type,
        status: workflow.status,
        currentStep: workflow.currentStep,
        progress: this.calculateProgress(workflow),
        startTime: workflow.startTime,
        duration: Date.now() - workflow.startTime,
      };
    }

    // Check history
    const historyEntry = this.workflowHistory.find(entry => entry.workflowId === workflowId);
    if (historyEntry) {
      return {
        id: workflowId,
        type: historyEntry.type,
        status: historyEntry.status,
        currentStep: null,
        progress: 100,
        startTime: historyEntry.startTime,
        duration: historyEntry.duration,
      };
    }

    return null;
  }

  /**
   * Cancel active workflow
   */
  cancelWorkflow(workflowId: string): boolean {
    const workflow = this.activeWorkflows.get(workflowId);
    if (workflow) {
      workflow.status = 'cancelled';
      this.completeWorkflow(workflow, 'cancelled');
      return true;
    }
    return false;
  }

  /**
   * Get analysis metrics
   */
  getMetrics(): AnalysisMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalAnalyses: 0,
      successfulAnalyses: 0,
      failedAnalyses: 0,
      averageProcessingTime: 0,
      platformDistribution: new Map(),
      errorTypes: new Map(),
    };
  }

  // Private methods

  private generateWorkflowId(): string {
    return `workflow_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private createWorkflow(type: string, id: string, url: string): ActiveWorkflow {
    return {
      id,
      type,
      url,
      status: 'created',
      steps: [],
      currentStep: null,
      startTime: Date.now(),
      metadata: new Map(),
    };
  }

  private startWorkflow(workflow: ActiveWorkflow): void {
    workflow.status = 'running';
    workflow.startTime = Date.now();
    this.activeWorkflows.set(workflow.id, workflow);
  }

  private async executeStep<T>(workflow: ActiveWorkflow, stepName: string, stepFunction: () => Promise<T>): Promise<T> {
    const stepStart = Date.now();
    workflow.currentStep = stepName;

    const step: WorkflowStep = {
      name: stepName,
      status: 'running',
      startTime: stepStart,
      duration: 0,
      result: null,
      error: null,
    };

    workflow.steps.push(step);

    try {
      const result = await stepFunction();
      step.status = 'completed';
      step.duration = Date.now() - stepStart;
      step.result = result;
      return result;
    } catch (error) {
      step.status = 'failed';
      step.duration = Date.now() - stepStart;
      step.error = error;
      throw error;
    }
  }

  private completeWorkflow(
    workflow: ActiveWorkflow,
    status: 'success' | 'failed' | 'cancelled',
    error?: unknown,
  ): void {
    workflow.status = status === 'success' ? 'completed' : status;
    workflow.currentStep = null;

    // Move to history
    this.workflowHistory.push({
      workflowId: workflow.id,
      type: workflow.type,
      url: workflow.url,
      status,
      startTime: workflow.startTime,
      duration: Date.now() - workflow.startTime,
      steps: workflow.steps.length,
      error,
    });

    // Remove from active workflows
    this.activeWorkflows.delete(workflow.id);

    // Update metrics
    this.updateMetrics(workflow, status, error);

    // Cleanup old history entries
    if (this.workflowHistory.length > 100) {
      this.workflowHistory.splice(0, this.workflowHistory.length - 100);
    }
  }

  private calculateProgress(workflow: ActiveWorkflow): number {
    if (workflow.steps.length === 0) return 0;

    const completedSteps = workflow.steps.filter(
      step => step.status === 'completed' || step.status === 'failed',
    ).length;

    // Estimate total steps based on workflow type
    const estimatedTotalSteps = this.getEstimatedStepCount(workflow.type);

    return Math.min(100, (completedSteps / estimatedTotalSteps) * 100);
  }

  private getEstimatedStepCount(workflowType: string): number {
    const stepCounts: Record<string, number> = {
      meeting_detection: 4,
      page_analysis: 5,
      monitoring: 3,
      batch_analysis: 3,
    };
    return stepCounts[workflowType] || 5;
  }

  private async performPreAnalysisChecks(document: Document, url: string): Promise<PreAnalysisCheckResult> {
    return {
      documentReady: document.readyState === 'complete',
      urlValid: (await urlValidator.validateMultipleUrls([url]))[0]?.isValid || false,
      domainSupported: domainDetector.detectSharePointDomain(url) !== null,
      contentAccessible: document.body.children.length > 0,
    };
  }

  private assessAnalysisQuality(analysis: PageAnalysisResult, meetingData: unknown): QualityAssessment {
    let score = 0;
    const factors: QualityFactor[] = [];

    // Confidence score
    if (analysis.confidence >= 0.8) {
      score += 30;
      factors.push({ name: 'high_confidence', weight: 30, passed: true });
    } else if (analysis.confidence >= 0.5) {
      score += 15;
      factors.push({ name: 'medium_confidence', weight: 15, passed: true });
    }

    // Data completeness
    const typedMeetingData = meetingData as
      | { extractionContext?: { completeness?: number }; tenantConfig?: { tenantId?: string } }
      | null
      | undefined;
    const completeness = typedMeetingData?.extractionContext?.completeness;
    if (typeof completeness === 'number' && completeness >= 80) {
      score += 25;
      factors.push({ name: 'complete_data', weight: 25, passed: true });
    } else if (typeof completeness === 'number' && completeness >= 50) {
      score += 12;
      factors.push({ name: 'partial_data', weight: 12, passed: true });
    }

    // Platform detection
    if (analysis.platform !== 'unknown') {
      score += 20;
      factors.push({ name: 'platform_detected', weight: 20, passed: true });
    }

    // Processing time
    if (analysis.processingTime && analysis.processingTime < 1000) {
      score += 15;
      factors.push({ name: 'fast_processing', weight: 15, passed: true });
    }

    // Tenant configuration
    const tenantId = typedMeetingData?.tenantConfig?.tenantId;
    if (tenantId && typeof tenantId === 'string' && tenantId !== 'default') {
      score += 10;
      factors.push({ name: 'tenant_identified', weight: 10, passed: true });
    }

    return {
      overallScore: score,
      grade: this.scoreToGrade(score),
      factors,
      recommendations: this.generateQualityRecommendations(factors),
    };
  }

  private scoreToGrade(score: number): string {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private generateQualityRecommendations(factors: QualityFactor[]): string[] {
    const recommendations: string[] = [];

    const failedFactors = factors.filter(f => !f.passed);

    if (failedFactors.some(f => f.name.includes('confidence'))) {
      recommendations.push('Improve content detection patterns');
    }

    if (failedFactors.some(f => f.name.includes('data'))) {
      recommendations.push('Enhance metadata extraction capabilities');
    }

    if (failedFactors.some(f => f.name.includes('platform'))) {
      recommendations.push('Add platform-specific detection rules');
    }

    return recommendations;
  }

  private handleContentChanges(workflowId: string, changes: unknown[], callback?: (changes: unknown[]) => void): void {
    if (callback) {
      callback(changes);
    }

    // Update workflow metadata with change information
    const workflow = this.activeWorkflows.get(workflowId);
    if (workflow) {
      const changeCount =
        typeof workflow.metadata.get('changeCount') === 'number' ? (workflow.metadata.get('changeCount') as number) : 0;
      workflow.metadata.set('changeCount', changeCount + changes.length);
      workflow.metadata.set('lastChange', Date.now());
    }
  }

  private configureMonitoringRules(_session: unknown, _rules?: MonitoringRule[]): Promise<void> {
    void _session;
    void _rules;
    // Configure monitoring rules based on options
    return Promise.resolve();
  }

  private generateBatchSummary(results: PageAnalysisResult[], errors: BatchAnalysisError[]): BatchSummary {
    const meetingPages = results.filter(r => r.isMeetingPage);
    const platforms = new Map<string, number>();

    for (const result of results) {
      const count = platforms.get(result.platform) || 0;
      platforms.set(result.platform, count + 1);
    }

    return {
      totalPages: results.length + errors.length,
      successfulAnalyses: results.length,
      failedAnalyses: errors.length,
      meetingPagesFound: meetingPages.length,
      platformDistribution: Object.fromEntries(platforms),
      averageConfidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length,
      averageProcessingTime: results.reduce((sum, r) => sum + (r.processingTime || 0), 0) / results.length,
    };
  }

  private setupMetricsCollection(): void {
    // Initialize metrics tracking
    setInterval(() => {
      this.cleanupOldWorkflows();
    }, 60000); // Cleanup every minute
  }

  private updateMetrics(workflow: ActiveWorkflow, status: string, error?: unknown): void {
    this.metrics.totalAnalyses++;

    if (status === 'success') {
      this.metrics.successfulAnalyses++;
    } else {
      this.metrics.failedAnalyses++;
    }

    // Update average processing time
    const duration = Date.now() - workflow.startTime;
    this.metrics.averageProcessingTime =
      (this.metrics.averageProcessingTime * (this.metrics.totalAnalyses - 1) + duration) / this.metrics.totalAnalyses;

    // Update platform distribution (if available)
    // This would need to be extracted from workflow results

    // Update error types
    if (error) {
      const errorType = error.constructor.name || 'UnknownError';
      const count = this.metrics.errorTypes.get(errorType) || 0;
      this.metrics.errorTypes.set(errorType, count + 1);
    }
  }

  private cleanupOldWorkflows(): void {
    const oldThreshold = Date.now() - 24 * 60 * 60 * 1000; // 24 hours

    this.workflowHistory = this.workflowHistory.filter(entry => entry.startTime > oldThreshold);
  }
}

// Supporting interfaces and types

export interface WorkflowOptions {
  performFullAnalysis?: boolean;
  includeTenantConfig?: boolean;
  includeParticipants?: boolean;
  includeAgenda?: boolean;
  timeout?: number;
}

export interface AnalysisWorkflowOptions {
  forceRefresh?: boolean;
  includeParticipants?: boolean;
  includeAgenda?: boolean;
  extractMeetingData?: boolean;
  timeout?: number;
}

export interface MonitoringWorkflowOptions {
  rules?: MonitoringRule[];
  onContentChange?: (changes: unknown[]) => void;
  timeout?: number;
}

export interface BatchAnalysisOptions {
  parallel?: boolean;
  maxConcurrency?: number;
  pageTimeout?: number;
}

export interface MeetingDetectionResult {
  workflowId: string;
  detection: MeetingDetection;
  analysis: PageAnalysisResult | null;
  workflow: WorkflowSummary;
}

export interface PageAnalysisWorkflowResult {
  workflowId: string;
  analysis: PageAnalysisResult;
  meetingData: unknown;
  tenantConfig: unknown;
  quality: QualityAssessment;
  workflow: WorkflowSummary;
}

export interface MonitoringWorkflowResult {
  workflowId: string;
  initialAnalysis: PageAnalysisResult;
  monitoringSession: unknown;
  workflow: WorkflowSummary;
}

export interface BatchAnalysisResult {
  workflowId: string;
  results: PageAnalysisResult[];
  errors: BatchAnalysisError[];
  summary: BatchSummary;
  workflow: WorkflowSummary;
}

export interface ActiveWorkflow {
  id: string;
  type: string;
  url: string;
  status: 'created' | 'running' | 'completed' | 'failed' | 'cancelled';
  steps: WorkflowStep[];
  currentStep: string | null;
  startTime: number;
  metadata: Map<string, unknown>;
}

export interface WorkflowStep {
  name: string;
  status: 'running' | 'completed' | 'failed';
  startTime: number;
  duration: number;
  result: unknown;
  error: unknown;
}

export interface WorkflowSummary {
  id: string;
  type: string;
  status: string;
  steps: WorkflowStep[];
  duration: number;
  metadata: Map<string, unknown>;
}

export interface WorkflowStatus {
  id: string;
  type: string;
  status: string;
  currentStep: string | null;
  progress: number;
  startTime: number;
  duration: number;
}

export interface WorkflowHistoryEntry {
  workflowId: string;
  type: string;
  url: string;
  status: string;
  startTime: number;
  duration: number;
  steps: number;
  error?: unknown;
}

export interface AnalysisMetrics {
  totalAnalyses: number;
  successfulAnalyses: number;
  failedAnalyses: number;
  averageProcessingTime: number;
  platformDistribution: Map<string, number>;
  errorTypes: Map<string, number>;
}

export interface BatchAnalysisPage {
  document: Document;
  url: string;
  metadata?: unknown;
}

export interface BatchAnalysisError {
  pageIndex: number;
  url: string;
  error: unknown;
}

export interface BatchSummary {
  totalPages: number;
  successfulAnalyses: number;
  failedAnalyses: number;
  meetingPagesFound: number;
  platformDistribution: Record<string, number>;
  averageConfidence: number;
  averageProcessingTime: number;
}

export interface PreAnalysisCheckResult {
  documentReady: boolean;
  urlValid: boolean;
  domainSupported: boolean;
  contentAccessible: boolean;
}

export interface QualityAssessment {
  overallScore: number;
  grade: string;
  factors: QualityFactor[];
  recommendations: string[];
}

export interface QualityFactor {
  name: string;
  weight: number;
  passed: boolean;
}

export interface MonitoringRule {
  name: string;
  selector: string;
  action: 'detect' | 'ignore' | 'alert';
  condition?: string;
}

// Create singleton instance
export const analysisOrchestrator = new AnalysisOrchestrator();
