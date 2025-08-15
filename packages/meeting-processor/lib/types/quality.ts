/**
 * Quality metrics and validation types for meeting processor
 * Provides type definitions for processing confidence, validation results,
 * accuracy assessment, and content validation functionality.
 */

/**
 * Validation status for processing results
 */
export type ValidationStatus = 'passed' | 'warning' | 'failed' | 'pending';

/**
 * Accuracy levels for different processing aspects
 */
export type AccuracyLevel = 'excellent' | 'good' | 'acceptable' | 'poor' | 'unacceptable';

/**
 * Quality assessment categories
 */
export type QualityCategory = 'transcription' | 'summarization' | 'extraction' | 'identification' | 'overall';

/**
 * Validation rule types
 */
export type ValidationRuleType = 'required' | 'format' | 'range' | 'consistency' | 'semantic';

/**
 * Processing confidence metrics with detailed breakdown
 */
export interface ProcessingConfidence {
  /** Overall processing confidence (0.0-1.0) */
  overall: number;
  /** Confidence by processing stage */
  byStage: {
    /** Text preprocessing confidence */
    preprocessing: number;
    /** Language detection confidence */
    languageDetection: number;
    /** Speaker identification confidence */
    speakerIdentification: number;
    /** Content segmentation confidence */
    segmentation: number;
    /** Topic identification confidence */
    topicIdentification: number;
    /** Summary generation confidence */
    summaryGeneration: number;
    /** Action item extraction confidence */
    actionItemExtraction: number;
    /** Decision identification confidence */
    decisionIdentification: number;
  };
  /** Confidence by content type */
  byContentType: {
    /** Factual content confidence */
    factual: number;
    /** Opinion/sentiment confidence */
    opinion: number;
    /** Action-oriented content confidence */
    actionable: number;
    /** Decision-related content confidence */
    decisional: number;
  };
  /** Factors affecting confidence */
  factors: {
    /** Audio/transcript quality impact */
    inputQuality: number;
    /** Content complexity impact */
    contentComplexity: number;
    /** Language consistency impact */
    languageConsistency: number;
    /** Speaker clarity impact */
    speakerClarity: number;
    /** Technical terminology impact */
    terminologyComplexity: number;
  };
  /** Timestamp when confidence was calculated */
  calculatedAt: Date;
}

/**
 * Validation rule definition
 */
export interface ValidationRule {
  /** Rule identifier */
  id: string;
  /** Rule name */
  name: string;
  /** Rule description */
  description: string;
  /** Rule type */
  type: ValidationRuleType;
  /** Rule category */
  category: QualityCategory;
  /** Rule severity level */
  severity: 'critical' | 'major' | 'minor' | 'info';
  /** Whether rule is enabled */
  enabled: boolean;
  /** Rule parameters */
  parameters: Record<string, unknown>;
}

/**
 * Individual validation result
 */
export interface ValidationResult {
  /** Validation identifier */
  id: string;
  /** Associated rule that was applied */
  ruleId: string;
  /** Validation status */
  status: ValidationStatus;
  /** Validation score (0.0-1.0) */
  score: number;
  /** Validation message */
  message: string;
  /** Detailed explanation if validation failed */
  details?: string;
  /** Suggested fixes or improvements */
  suggestions: string[];
  /** Affected content or elements */
  affectedElements: Array<{
    type: 'summary' | 'action_item' | 'decision' | 'topic' | 'segment';
    id: string;
    description: string;
  }>;
  /** Validation timestamp */
  validatedAt: Date;
}

/**
 * Accuracy assessment for different aspects
 */
export interface AccuracyAssessment {
  /** Assessment identifier */
  id: string;
  /** Overall accuracy level */
  overall: AccuracyLevel;
  /** Accuracy by category */
  byCategory: Record<
    QualityCategory,
    {
      level: AccuracyLevel;
      score: number;
      details: string;
    }
  >;
  /** Comparison with reference data (if available) */
  referenceComparison?: {
    /** Reference data identifier */
    referenceId: string;
    /** Similarity score (0.0-1.0) */
    similarity: number;
    /** Differences identified */
    differences: Array<{
      type: 'missing' | 'extra' | 'modified';
      description: string;
      severity: 'critical' | 'major' | 'minor';
    }>;
  };
  /** Assessment methodology */
  methodology: 'automated' | 'manual' | 'hybrid';
  /** Assessment timestamp */
  assessedAt: Date;
}

/**
 * Content validation results
 */
export interface ContentValidation {
  /** Validation identifier */
  id: string;
  /** Associated processing result ID */
  processingResultId: string;
  /** Overall validation status */
  overallStatus: ValidationStatus;
  /** Individual validation results */
  results: ValidationResult[];
  /** Validation summary */
  summary: {
    /** Total rules applied */
    totalRules: number;
    /** Number of passed validations */
    passed: number;
    /** Number of warnings */
    warnings: number;
    /** Number of failed validations */
    failed: number;
    /** Overall validation score (0.0-1.0) */
    score: number;
  };
  /** Critical issues that need attention */
  criticalIssues: Array<{
    type: 'accuracy' | 'completeness' | 'consistency' | 'relevance';
    severity: 'critical' | 'major';
    description: string;
    impact: string;
    recommendations: string[];
  }>;
  /** Validation configuration used */
  configuration: {
    /** Rules applied */
    rules: ValidationRule[];
    /** Thresholds used */
    thresholds: Record<string, number>;
    /** Features enabled */
    features: string[];
  };
  /** Validation timestamp */
  validatedAt: Date;
}

/**
 * Comprehensive quality metrics for processing results
 */
export interface QualityMetrics {
  /** Quality assessment identifier */
  id: string;
  /** Associated meeting ID */
  meetingId: string;
  /** Overall quality score (0.0-1.0) */
  overallScore: number;
  /** Quality level assessment */
  qualityLevel: AccuracyLevel;
  /** Processing confidence metrics */
  confidence: ProcessingConfidence;
  /** Validation results */
  validation: ContentValidation;
  /** Accuracy assessment */
  accuracy: AccuracyAssessment;
  /** Quality metrics by component */
  componentMetrics: {
    /** Summary quality metrics */
    summary: {
      completeness: number;
      accuracy: number;
      readability: number;
      relevance: number;
    };
    /** Action items quality metrics */
    actionItems: {
      extraction_accuracy: number;
      assignment_accuracy: number;
      deadline_accuracy: number;
      priority_accuracy: number;
    };
    /** Decisions quality metrics */
    decisions: {
      identification_accuracy: number;
      context_completeness: number;
      consensus_accuracy: number;
      impact_assessment: number;
    };
    /** Topics quality metrics */
    topics: {
      identification_accuracy: number;
      coverage_completeness: number;
      relevance_score: number;
      coherence_score: number;
    };
  };
  /** Quality improvement recommendations */
  recommendations: Array<{
    category: QualityCategory;
    priority: 'high' | 'medium' | 'low';
    description: string;
    expectedImprovement: number;
    effort: 'low' | 'medium' | 'high';
  }>;
  /** Benchmarking data */
  benchmarks: {
    /** Industry standard comparison */
    industryStandard?: number;
    /** Historical performance comparison */
    historicalAverage?: number;
    /** Similar meetings comparison */
    similarMeetings?: number;
    /** Model performance baseline */
    modelBaseline?: number;
  };
  /** Quality assessment metadata */
  metadata: {
    /** Assessment method used */
    assessmentMethod: string;
    /** Quality model version */
    modelVersion: string;
    /** Assessment duration in milliseconds */
    assessmentDuration: number;
    /** Quality assessor information */
    assessor: 'automated' | 'human' | 'hybrid';
    /** Assessment timestamp */
    assessedAt: Date;
  };
}
