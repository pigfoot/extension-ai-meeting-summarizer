/**
 * Confidence Calculator
 * Implements detection confidence scoring and accuracy estimation for detected meeting content
 */

import type { MeetingPlatform, DetectionConfig } from '../types/index';
import type { ContentIndicator, PageAnalysisResult } from '../types/page';
import type { TenantInfo } from '../types/tenant';

/**
 * Advanced confidence calculation for meeting detection accuracy
 */
export class ConfidenceCalculator {
  private historicalData: Map<string, HistoricalConfidenceData> = new Map();
  private platformWeights: Map<MeetingPlatform, PlatformWeights> = new Map();
  private indicatorWeights: Map<string, number> = new Map();
  private calibrationData: CalibrationData = {
    totalPredictions: 0,
    correctPredictions: 0,
    confidenceBuckets: new Map(),
  };

  constructor() {
    this.initializePlatformWeights();
    this.initializeIndicatorWeights();
  }

  /**
   * Calculate overall confidence score for meeting detection
   */
  calculateDetectionConfidence(
    pageAnalysis: PageAnalysisResult,
    tenantInfo?: TenantInfo,
    detectionConfig?: DetectionConfig,
  ): ConfidenceResult {
    const factors = this.gatherConfidenceFactors(pageAnalysis, tenantInfo, detectionConfig);
    const baseConfidence = this.calculateBaseConfidence(factors);
    const adjustedConfidence = this.applyAdjustments(baseConfidence, factors);
    const finalConfidence = this.applyCalibration(adjustedConfidence);

    return {
      confidence: Math.min(1, Math.max(0, finalConfidence)),
      factors,
      breakdown: this.createConfidenceBreakdown(factors),
      reliability: this.calculateReliability(factors),
      recommendations: this.generateRecommendations(factors),
    };
  }

  /**
   * Calculate indicator-specific confidence
   */
  calculateIndicatorConfidence(indicator: ContentIndicator, context: IndicatorContext): IndicatorConfidenceResult {
    const strengthScore = this.calculateStrengthScore(indicator);
    const contextScore = this.calculateContextScore(indicator, context);
    const historicalScore = this.getHistoricalScore(indicator, context);
    const positionScore = this.calculatePositionScore(indicator);

    const weights = {
      strength: 0.4,
      context: 0.3,
      historical: 0.2,
      position: 0.1,
    };

    const weightedScore =
      strengthScore * weights.strength +
      contextScore * weights.context +
      historicalScore * weights.historical +
      positionScore * weights.position;

    return {
      confidence: Math.min(1, Math.max(0, weightedScore)),
      components: {
        strength: strengthScore,
        context: contextScore,
        historical: historicalScore,
        position: positionScore,
      },
      factors: this.getIndicatorFactors(indicator, context),
      adjustments: this.getIndicatorAdjustments(indicator),
    };
  }

  /**
   * Calculate confidence for URL extraction
   */
  calculateUrlConfidence(url: string, extractionMethod: string, context: UrlExtractionContext): UrlConfidenceResult {
    const methodScore = this.getMethodScore(extractionMethod);
    const formatScore = this.getFormatScore(url);
    const accessibilityScore = this.getAccessibilityScore(url, context);
    const validationScore = this.getValidationScore(url);

    const totalScore = (methodScore + formatScore + accessibilityScore + validationScore) / 4;

    return {
      confidence: Math.min(1, Math.max(0, totalScore)),
      breakdown: {
        method: methodScore,
        format: formatScore,
        accessibility: accessibilityScore,
        validation: validationScore,
      },
      riskFactors: this.identifyUrlRiskFactors(url),
      suggestions: this.generateUrlSuggestions(url, totalScore),
    };
  }

  /**
   * Calculate metadata extraction confidence
   */
  calculateMetadataConfidence(
    extractedMetadata: Record<string, unknown>,
    extractionSources: string[],
  ): MetadataConfidenceResult {
    const fieldScores: Record<string, number> = {};
    const fieldSources: Record<string, string[]> = {};

    for (const [field, value] of Object.entries(extractedMetadata)) {
      fieldScores[field] = this.calculateFieldConfidence(field, value);
      fieldSources[field] = this.getFieldSources(field, extractionSources);
    }

    const overallScore = this.calculateOverallMetadataScore(fieldScores);
    const completeness = this.calculateCompletenessScore(extractedMetadata);
    const consistency = this.calculateConsistencyScore();

    return {
      confidence: Math.min(1, Math.max(0, overallScore)),
      fieldScores,
      fieldSources,
      completeness,
      consistency,
      missingFields: this.identifyMissingFields(extractedMetadata),
      qualityMetrics: this.calculateQualityMetrics(extractedMetadata),
    };
  }

  /**
   * Update confidence based on validation results
   */
  updateConfidenceWithValidation(
    originalConfidence: number,
    validationResults: ValidationResult[],
  ): ConfidenceUpdateResult {
    let adjustedConfidence = originalConfidence;
    const adjustments: ConfidenceAdjustment[] = [];

    for (const result of validationResults) {
      const adjustment = this.calculateValidationAdjustment(result);
      adjustedConfidence = Math.min(1, Math.max(0, adjustedConfidence + adjustment.delta));
      adjustments.push(adjustment);
    }

    return {
      originalConfidence,
      adjustedConfidence,
      adjustments,
      improvement: adjustedConfidence - originalConfidence,
      validationImpact: this.summarizeValidationImpact(adjustments),
    };
  }

  /**
   * Learn from detection outcomes to improve future confidence calculations
   */
  learnFromOutcome(prediction: ConfidenceResult, actualOutcome: DetectionOutcome): LearningResult {
    const wasCorrect = this.evaluatePrediction(prediction, actualOutcome);

    // Update calibration data
    this.updateCalibrationData(prediction.confidence, wasCorrect);

    // Update historical data
    this.updateHistoricalData();

    // Adjust weights if necessary
    const weightAdjustments = this.calculateWeightAdjustments();
    this.applyWeightAdjustments();

    return {
      wasCorrect,
      confidenceError: Math.abs(prediction.confidence - (wasCorrect ? 1 : 0)),
      weightAdjustments,
      calibrationUpdate: this.getCalibrationUpdate(),
      recommendations: this.generateLearningRecommendations(prediction, actualOutcome),
    };
  }

  /**
   * Get confidence calibration statistics
   */
  getCalibrationStatistics(): CalibrationStatistics {
    const buckets: CalibrationBucket[] = [];

    for (const [range, data] of this.calibrationData.confidenceBuckets) {
      if (data.count > 0) {
        buckets.push({
          range,
          predictedConfidence: data.totalConfidence / data.count,
          actualAccuracy: data.correctCount / data.count,
          count: data.count,
          calibrationError: Math.abs(data.totalConfidence / data.count - data.correctCount / data.count),
        });
      }
    }

    const overallAccuracy =
      this.calibrationData.totalPredictions > 0
        ? this.calibrationData.correctPredictions / this.calibrationData.totalPredictions
        : 0;

    return {
      overallAccuracy,
      totalPredictions: this.calibrationData.totalPredictions,
      buckets,
      averageCalibrationError: this.calculateAverageCalibrationError(buckets),
      isWellCalibrated: this.isWellCalibrated(buckets),
    };
  }

  // Private methods

  private gatherConfidenceFactors(
    pageAnalysis: PageAnalysisResult,
    tenantInfo?: TenantInfo,
    detectionConfig?: DetectionConfig,
  ): ConfidenceFactors {
    return {
      platformConfidence: this.calculatePlatformConfidence(pageAnalysis.platform),
      indicatorStrength: this.calculateIndicatorStrength(pageAnalysis.indicators),
      elementCount: pageAnalysis.elements.length,
      analysisTime: pageAnalysis.analysisTime,
      errorCount: pageAnalysis.errors.length,
      pageMetadata: pageAnalysis.pageMetadata,
      tenantInfo,
      detectionConfig,
      historicalAccuracy: this.getHistoricalAccuracy(pageAnalysis.platform),
      urlPattern: this.analyzeUrlPattern(pageAnalysis.url),
    };
  }

  private calculateBaseConfidence(factors: ConfidenceFactors): number {
    let confidence = 0;

    // Platform confidence (30%)
    confidence += factors.platformConfidence * 0.3;

    // Indicator strength (25%)
    confidence += factors.indicatorStrength * 0.25;

    // Element count factor (15%)
    const elementFactor = Math.min(1, factors.elementCount / 10);
    confidence += elementFactor * 0.15;

    // Historical accuracy (20%)
    confidence += factors.historicalAccuracy * 0.2;

    // Error penalty (10%)
    const errorPenalty = Math.min(0.1, factors.errorCount * 0.02);
    confidence += 0.1 - errorPenalty;

    return confidence;
  }

  private applyAdjustments(baseConfidence: number, factors: ConfidenceFactors): number {
    let adjusted = baseConfidence;

    // Speed adjustment (faster analysis might be less thorough)
    if (factors.analysisTime < 100) {
      adjusted *= 0.95;
    }

    // Tenant-specific adjustments
    if (factors.tenantInfo) {
      const tenantReliability = this.getTenantReliability(factors.tenantInfo);
      adjusted *= 0.8 + tenantReliability * 0.2;
    }

    // URL pattern adjustment
    if (factors.urlPattern.isStandard) {
      adjusted *= 1.05;
    } else if (factors.urlPattern.isUnusual) {
      adjusted *= 0.9;
    }

    return adjusted;
  }

  private applyCalibration(confidence: number): number {
    // Apply learned calibration corrections
    const bucket = this.getConfidenceBucket(confidence);
    const bucketData = this.calibrationData.confidenceBuckets.get(bucket);

    if (bucketData && bucketData.count > 10) {
      const actualAccuracy = bucketData.correctCount / bucketData.count;
      const predictedAccuracy = bucketData.totalConfidence / bucketData.count;

      if (Math.abs(actualAccuracy - predictedAccuracy) > 0.1) {
        // Apply calibration correction
        return confidence * (actualAccuracy / predictedAccuracy);
      }
    }

    return confidence;
  }

  private calculateStrengthScore(indicator: ContentIndicator): number {
    let score = indicator.strength;

    // Adjust based on element visibility
    const element = document.querySelector(indicator.selector);
    if (element) {
      const isVisible = this.isElementVisible(element);
      if (!isVisible) score *= 0.6;

      // Check content relevance
      const contentRelevance = this.assessContentRelevance(element, indicator.type);
      score *= contentRelevance;
    } else {
      score = 0;
    }

    return score;
  }

  private calculateContextScore(indicator: ContentIndicator, context: IndicatorContext): number {
    let score = 0.5; // Base context score

    // Platform-specific adjustments
    const platformWeight = this.platformWeights.get(context.platform);
    if (platformWeight) {
      score *= platformWeight.contextReliability;
    }

    // Surrounding elements boost confidence
    if (context.surroundingIndicators && context.surroundingIndicators.length > 0) {
      score += Math.min(0.3, context.surroundingIndicators.length * 0.1);
    }

    return Math.min(1, score);
  }

  private getHistoricalScore(indicator: ContentIndicator, context: IndicatorContext): number {
    const key = `${context.platform}_${indicator.type}`;
    const historical = this.historicalData.get(key);

    if (!historical || historical.sampleSize < 10) {
      return 0.5; // Default score for insufficient data
    }

    return historical.successRate;
  }

  private calculatePositionScore(indicator: ContentIndicator): number {
    const element = document.querySelector(indicator.selector);
    if (!element) return 0;

    let score = 0.5;

    // Above the fold is generally better
    const rect = element.getBoundingClientRect();
    if (rect.top < window.innerHeight) {
      score += 0.2;
    }

    // Prominent positioning
    if (rect.width > window.innerWidth * 0.5) {
      score += 0.1;
    }

    return Math.min(1, score);
  }

  private initializePlatformWeights(): void {
    this.platformWeights.set('sharepoint', {
      baseReliability: 0.85,
      contextReliability: 0.8,
      urlPatternWeight: 0.9,
      metadataWeight: 0.7,
    });

    this.platformWeights.set('teams', {
      baseReliability: 0.9,
      contextReliability: 0.85,
      urlPatternWeight: 0.95,
      metadataWeight: 0.8,
    });

    this.platformWeights.set('unknown', {
      baseReliability: 0.5,
      contextReliability: 0.5,
      urlPatternWeight: 0.6,
      metadataWeight: 0.5,
    });
  }

  private initializeIndicatorWeights(): void {
    this.indicatorWeights.set('media_player', 0.9);
    this.indicatorWeights.set('recording_controls', 0.85);
    this.indicatorWeights.set('meeting_title', 0.7);
    this.indicatorWeights.set('participant_list', 0.6);
    this.indicatorWeights.set('meeting_metadata', 0.5);
    this.indicatorWeights.set('navigation_breadcrumb', 0.4);
  }

  private calculatePlatformConfidence(platform: MeetingPlatform): number {
    const weights = this.platformWeights.get(platform);
    return weights?.baseReliability || 0.5;
  }

  private calculateIndicatorStrength(indicators: ContentIndicator[]): number {
    if (indicators.length === 0) return 0;

    let totalWeight = 0;
    let weightedSum = 0;

    for (const indicator of indicators) {
      const weight = this.indicatorWeights.get(indicator.type) || 0.5;
      totalWeight += weight;
      weightedSum += indicator.strength * weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  private getHistoricalAccuracy(platform: MeetingPlatform): number {
    const historical = this.historicalData.get(platform);
    return historical?.successRate || 0.5;
  }

  private analyzeUrlPattern(url: string): UrlPatternAnalysis {
    try {
      const urlObj = new URL(url);
      const isStandard = this.isStandardMeetingUrl(urlObj);
      const isUnusual = this.isUnusualMeetingUrl(urlObj);

      return { isStandard, isUnusual, complexity: this.calculateUrlComplexity(urlObj) };
    } catch {
      return { isStandard: false, isUnusual: true, complexity: 1 };
    }
  }

  private isStandardMeetingUrl(url: URL): boolean {
    const standardPatterns = [
      /sharepoint\.com.*meeting/i,
      /teams\.microsoft\.com.*meeting/i,
      /stream\.microsoft\.com/i,
    ];

    return standardPatterns.some(pattern => pattern.test(url.href));
  }

  private isUnusualMeetingUrl(url: URL): boolean {
    return (
      !this.isStandardMeetingUrl(url) &&
      (url.href.includes('localhost') || url.href.includes('test') || url.hostname.split('.').length > 4)
    );
  }

  private calculateUrlComplexity(url: URL): number {
    let complexity = 0;
    complexity += url.pathname.split('/').length * 0.1;
    complexity += url.searchParams.toString().length * 0.01;
    complexity += url.hash.length * 0.02;
    return Math.min(1, complexity);
  }

  private getTenantReliability(tenantInfo: TenantInfo): number {
    // Calculate based on tenant configuration quality
    let reliability = 0.5;

    if (tenantInfo.sharePointConfig.features.hasRecordings) reliability += 0.2;
    if (tenantInfo.sharePointConfig.features.hasTranscripts) reliability += 0.1;
    if (tenantInfo.teamsConfig.recordingStorage === 'stream') reliability += 0.1;
    if (tenantInfo.type === 'enterprise') reliability += 0.1;

    return Math.min(1, reliability);
  }

  private createConfidenceBreakdown(factors: ConfidenceFactors): ConfidenceBreakdown {
    return {
      platform: factors.platformConfidence,
      indicators: factors.indicatorStrength,
      elements: Math.min(1, factors.elementCount / 10),
      historical: factors.historicalAccuracy,
      speed: factors.analysisTime < 100 ? 0.95 : 1.0,
      errors: Math.max(0, 1 - factors.errorCount * 0.1),
    };
  }

  private calculateReliability(factors: ConfidenceFactors): number {
    // Reliability based on consistency of factors
    const scores = [factors.platformConfidence, factors.indicatorStrength, factors.historicalAccuracy];

    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;

    // Lower variance means higher reliability
    return Math.max(0, 1 - variance);
  }

  private generateRecommendations(factors: ConfidenceFactors): string[] {
    const recommendations: string[] = [];

    if (factors.indicatorStrength < 0.5) {
      recommendations.push('Consider increasing detection timeout for better indicator analysis');
    }

    if (factors.errorCount > 2) {
      recommendations.push('Review page loading conditions - high error count detected');
    }

    if (factors.analysisTime < 50) {
      recommendations.push('Analysis completed very quickly - consider deeper inspection');
    }

    if (factors.elementCount < 3) {
      recommendations.push('Few relevant elements found - page may still be loading');
    }

    return recommendations;
  }

  private isElementVisible(element: Element): boolean {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);

    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  }

  private assessContentRelevance(element: Element, indicatorType: string): number {
    const content = element.textContent?.toLowerCase() || '';

    const relevanceKeywords: Record<string, string[]> = {
      media_player: ['video', 'audio', 'play', 'pause', 'stream'],
      meeting_title: ['meeting', 'conference', 'call', 'session'],
      participant_list: ['participants', 'attendees', 'people', 'members'],
      recording_controls: ['record', 'stop', 'start', 'recording'],
    };

    const keywords = relevanceKeywords[indicatorType] || [];
    const matches = keywords.filter(keyword => content.includes(keyword)).length;

    return Math.min(1, matches / Math.max(1, keywords.length));
  }

  private getMethodScore(method: string): number {
    const methodScores: Record<string, number> = {
      direct_attribute: 0.9,
      dom_traversal: 0.7,
      text_extraction: 0.6,
      pattern_matching: 0.5,
      heuristic: 0.4,
    };

    return methodScores[method] || 0.3;
  }

  private getFormatScore(url: string): number {
    try {
      const urlObj = new URL(url);

      // Check for media file extensions
      const mediaExtensions = ['.mp4', '.mp3', '.wav', '.m4a', '.webm'];
      if (mediaExtensions.some(ext => urlObj.pathname.endsWith(ext))) {
        return 0.9;
      }

      // Check for streaming patterns
      if (urlObj.href.includes('stream') || urlObj.href.includes('media')) {
        return 0.8;
      }

      return 0.6;
    } catch {
      return 0.2;
    }
  }

  private getAccessibilityScore(url: string, context: UrlExtractionContext): number {
    // This would involve actual accessibility testing
    // For now, return estimated score based on URL patterns
    return context.authenticationPresent ? 0.8 : 0.6;
  }

  private getValidationScore(url: string): number {
    // This would involve actual URL validation
    // For now, return estimated score based on format
    try {
      new URL(url);
      return 0.8;
    } catch {
      return 0.2;
    }
  }

  private identifyUrlRiskFactors(url: string): string[] {
    const risks: string[] = [];

    try {
      const urlObj = new URL(url);

      if (!url.startsWith('https://')) {
        risks.push('Non-HTTPS URL');
      }

      if (urlObj.hostname === 'localhost' || urlObj.hostname.includes('test')) {
        risks.push('Development/test environment');
      }

      if (url.length > 500) {
        risks.push('Unusually long URL');
      }
    } catch {
      risks.push('Invalid URL format');
    }

    return risks;
  }

  private generateUrlSuggestions(url: string, confidence: number): string[] {
    const suggestions: string[] = [];

    if (confidence < 0.5) {
      suggestions.push('Consider validating URL accessibility before processing');
    }

    if (confidence < 0.3) {
      suggestions.push('URL appears unreliable - consider alternative extraction methods');
    }

    return suggestions;
  }

  private calculateFieldConfidence(field: string, value: unknown): number {
    if (value === null || value === undefined || value === '') {
      return 0;
    }

    // Field-specific confidence calculations
    const fieldConfidenceMap: Record<string, (val: unknown) => number> = {
      title: val => (typeof val === 'string' && val.length > 5 ? 0.8 : 0.3),
      date: val => (val instanceof Date || typeof val === 'string' ? 0.9 : 0.2),
      participants: val => (Array.isArray(val) && val.length > 0 ? 0.7 : 0.2),
      duration: val => (typeof val === 'number' && val > 0 ? 0.8 : 0.3),
    };

    const calculator = fieldConfidenceMap[field];
    return calculator ? calculator(value) : 0.5;
  }

  private getFieldSources(field: string, sources: string[]): string[] {
    // Map field to likely sources
    return sources.filter(source => source.includes(field) || source.includes('metadata'));
  }

  private calculateOverallMetadataScore(fieldScores: Record<string, number>): number {
    const scores = Object.values(fieldScores);
    return scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
  }

  private calculateCompletenessScore(metadata: Record<string, unknown>): number {
    const expectedFields = ['title', 'date', 'participants', 'organizer'];
    const presentFields = expectedFields.filter(
      field => metadata[field] !== null && metadata[field] !== undefined && metadata[field] !== '',
    );

    return presentFields.length / expectedFields.length;
  }

  private calculateConsistencyScore(): number {
    // Check for consistency between related fields
    // This is a simplified implementation
    return 0.8; // Assume good consistency for now
  }

  private identifyMissingFields(metadata: Record<string, unknown>): string[] {
    const expectedFields = ['title', 'date', 'participants', 'organizer'];
    return expectedFields.filter(
      field => metadata[field] === null || metadata[field] === undefined || metadata[field] === '',
    );
  }

  private calculateQualityMetrics(metadata: Record<string, unknown>): QualityMetrics {
    return {
      completeness: this.calculateCompletenessScore(metadata),
      accuracy: 0.8, // Would be calculated based on validation
      consistency: this.calculateConsistencyScore(),
      freshness: 0.9, // Would be based on extraction time vs content age
    };
  }

  private calculateValidationAdjustment(result: ValidationResult): ConfidenceAdjustment {
    let delta = 0;
    let reason = '';

    switch (result.type) {
      case 'url_accessible':
        delta = result.success ? 0.1 : -0.2;
        reason = `URL accessibility ${result.success ? 'confirmed' : 'failed'}`;
        break;
      case 'metadata_verified':
        delta = result.success ? 0.05 : -0.1;
        reason = `Metadata verification ${result.success ? 'passed' : 'failed'}`;
        break;
      case 'content_loaded':
        delta = result.success ? 0.15 : -0.3;
        reason = `Content loading ${result.success ? 'successful' : 'failed'}`;
        break;
      default:
        delta = result.success ? 0.02 : -0.05;
        reason = `General validation ${result.success ? 'passed' : 'failed'}`;
    }

    return { delta, reason, type: result.type };
  }

  private summarizeValidationImpact(adjustments: ConfidenceAdjustment[]): ValidationImpact {
    const positive = adjustments.filter(adj => adj.delta > 0);
    const negative = adjustments.filter(adj => adj.delta < 0);

    return {
      totalAdjustment: adjustments.reduce((sum, adj) => sum + adj.delta, 0),
      positiveAdjustments: positive.length,
      negativeAdjustments: negative.length,
      significantChanges: adjustments.filter(adj => Math.abs(adj.delta) > 0.1).length,
    };
  }

  private evaluatePrediction(prediction: ConfidenceResult, outcome: DetectionOutcome): boolean {
    // Simple evaluation: high confidence predictions should be correct
    if (prediction.confidence > 0.8) {
      return outcome.actuallyFoundMeeting;
    } else if (prediction.confidence < 0.3) {
      return !outcome.actuallyFoundMeeting;
    } else {
      // Medium confidence - consider it correct if reasonably close
      return true;
    }
  }

  private updateCalibrationData(confidence: number, wasCorrect: boolean): void {
    this.calibrationData.totalPredictions++;
    if (wasCorrect) {
      this.calibrationData.correctPredictions++;
    }

    const bucket = this.getConfidenceBucket(confidence);
    if (!this.calibrationData.confidenceBuckets.has(bucket)) {
      this.calibrationData.confidenceBuckets.set(bucket, {
        totalConfidence: 0,
        correctCount: 0,
        count: 0,
      });
    }

    const bucketData = this.calibrationData.confidenceBuckets.get(bucket)!;
    bucketData.totalConfidence += confidence;
    bucketData.count++;
    if (wasCorrect) {
      bucketData.correctCount++;
    }
  }

  private getConfidenceBucket(confidence: number): string {
    const bucket = Math.floor(confidence * 10) / 10;
    return `${bucket.toFixed(1)}-${(bucket + 0.1).toFixed(1)}`;
  }

  private updateHistoricalData(): void {
    // Update historical success rates for different contexts
    // This is a simplified implementation
  }

  private calculateWeightAdjustments(): WeightAdjustments {
    // Calculate how to adjust weights based on prediction accuracy
    return {
      platformWeights: {},
      indicatorWeights: {},
      factorWeights: {},
    };
  }

  private applyWeightAdjustments(): void {
    // Apply the calculated weight adjustments
    // This is a simplified implementation
  }

  private getCalibrationUpdate(): CalibrationUpdate {
    return {
      totalSamples: this.calibrationData.totalPredictions,
      overallAccuracy:
        this.calibrationData.totalPredictions > 0
          ? this.calibrationData.correctPredictions / this.calibrationData.totalPredictions
          : 0,
      lastUpdate: new Date(),
    };
  }

  private generateLearningRecommendations(prediction: ConfidenceResult, outcome: DetectionOutcome): string[] {
    const recommendations: string[] = [];

    if (!outcome.actuallyFoundMeeting && prediction.confidence > 0.7) {
      recommendations.push('Consider reducing confidence for similar detection patterns');
    }

    if (outcome.actuallyFoundMeeting && prediction.confidence < 0.3) {
      recommendations.push('Consider increasing confidence for similar detection patterns');
    }

    return recommendations;
  }

  private calculateAverageCalibrationError(buckets: CalibrationBucket[]): number {
    if (buckets.length === 0) return 0;

    const totalError = buckets.reduce((sum, bucket) => sum + bucket.calibrationError, 0);
    return totalError / buckets.length;
  }

  private isWellCalibrated(buckets: CalibrationBucket[]): boolean {
    const avgError = this.calculateAverageCalibrationError(buckets);
    return avgError < 0.1; // Well calibrated if average error is less than 10%
  }

  private getIndicatorFactors(indicator: ContentIndicator, context: IndicatorContext): string[] {
    const factors: string[] = [];

    if (indicator.strength > 0.8) factors.push('High strength indicator');
    if (context.surroundingIndicators && context.surroundingIndicators.length > 2) {
      factors.push('Multiple supporting indicators');
    }

    return factors;
  }

  private getIndicatorAdjustments(indicator: ContentIndicator): string[] {
    const adjustments: string[] = [];

    const element = document.querySelector(indicator.selector);
    if (element && !this.isElementVisible(element)) {
      adjustments.push('Reduced confidence due to element visibility');
    }

    return adjustments;
  }
}

// Supporting interfaces and types

export interface ConfidenceResult {
  confidence: number;
  factors: ConfidenceFactors;
  breakdown: ConfidenceBreakdown;
  reliability: number;
  recommendations: string[];
}

export interface ConfidenceFactors {
  platformConfidence: number;
  indicatorStrength: number;
  elementCount: number;
  analysisTime: number;
  errorCount: number;
  pageMetadata: unknown;
  tenantInfo?: TenantInfo | undefined;
  detectionConfig?: DetectionConfig | undefined;
  historicalAccuracy: number;
  urlPattern: UrlPatternAnalysis;
}

export interface ConfidenceBreakdown {
  platform: number;
  indicators: number;
  elements: number;
  historical: number;
  speed: number;
  errors: number;
}

export interface IndicatorContext {
  platform: MeetingPlatform;
  surroundingIndicators?: ContentIndicator[];
  pageUrl?: string;
  tenantInfo?: TenantInfo;
}

export interface IndicatorConfidenceResult {
  confidence: number;
  components: {
    strength: number;
    context: number;
    historical: number;
    position: number;
  };
  factors: string[];
  adjustments: string[];
}

export interface UrlExtractionContext {
  extractionMethod: string;
  authenticationPresent: boolean;
  pageContext: string;
}

export interface UrlConfidenceResult {
  confidence: number;
  breakdown: {
    method: number;
    format: number;
    accessibility: number;
    validation: number;
  };
  riskFactors: string[];
  suggestions: string[];
}

export interface MetadataConfidenceResult {
  confidence: number;
  fieldScores: Record<string, number>;
  fieldSources: Record<string, string[]>;
  completeness: number;
  consistency: number;
  missingFields: string[];
  qualityMetrics: QualityMetrics;
}

export interface QualityMetrics {
  completeness: number;
  accuracy: number;
  consistency: number;
  freshness: number;
}

export interface ValidationResult {
  type: string;
  success: boolean;
  details?: Record<string, unknown>;
}

export interface ConfidenceUpdateResult {
  originalConfidence: number;
  adjustedConfidence: number;
  adjustments: ConfidenceAdjustment[];
  improvement: number;
  validationImpact: ValidationImpact;
}

export interface ConfidenceAdjustment {
  delta: number;
  reason: string;
  type: string;
}

export interface ValidationImpact {
  totalAdjustment: number;
  positiveAdjustments: number;
  negativeAdjustments: number;
  significantChanges: number;
}

export interface DetectionOutcome {
  actuallyFoundMeeting: boolean;
  userConfirmed?: boolean;
  validationResults?: ValidationResult[];
}

export interface LearningResult {
  wasCorrect: boolean;
  confidenceError: number;
  weightAdjustments: WeightAdjustments;
  calibrationUpdate: CalibrationUpdate;
  recommendations: string[];
}

export interface WeightAdjustments {
  platformWeights: Record<string, number>;
  indicatorWeights: Record<string, number>;
  factorWeights: Record<string, number>;
}

export interface CalibrationUpdate {
  totalSamples: number;
  overallAccuracy: number;
  lastUpdate: Date;
}

export interface CalibrationStatistics {
  overallAccuracy: number;
  totalPredictions: number;
  buckets: CalibrationBucket[];
  averageCalibrationError: number;
  isWellCalibrated: boolean;
}

export interface CalibrationBucket {
  range: string;
  predictedConfidence: number;
  actualAccuracy: number;
  count: number;
  calibrationError: number;
}

interface PlatformWeights {
  baseReliability: number;
  contextReliability: number;
  urlPatternWeight: number;
  metadataWeight: number;
}

interface UrlPatternAnalysis {
  isStandard: boolean;
  isUnusual: boolean;
  complexity: number;
}

interface HistoricalConfidenceData {
  successRate: number;
  sampleSize: number;
  lastUpdated: Date;
}

interface CalibrationData {
  totalPredictions: number;
  correctPredictions: number;
  confidenceBuckets: Map<
    string,
    {
      totalConfidence: number;
      correctCount: number;
      count: number;
    }
  >;
}

// Create singleton instance
export const confidenceCalculator = new ConfidenceCalculator();
