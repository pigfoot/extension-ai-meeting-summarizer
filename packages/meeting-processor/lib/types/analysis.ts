/**
 * Content analysis types for meeting processor
 * Provides type definitions for content analysis, speaker identification,
 * confidence scoring, text segmentation, and language analysis.
 */

/**
 * Supported languages for analysis
 */
export type AnalysisLanguage = 'en' | 'zh' | 'ja' | 'ko' | 'es' | 'fr' | 'de' | 'pt' | 'auto';

/**
 * Analysis confidence levels
 */
export type AnalysisConfidence = 'very-high' | 'high' | 'medium' | 'low' | 'very-low';

/**
 * Speaker identification confidence levels
 */
export type SpeakerConfidence = 'certain' | 'likely' | 'possible' | 'uncertain';

/**
 * Text segment types for classification
 */
export type SegmentType = 'introduction' | 'discussion' | 'decision' | 'action' | 'conclusion' | 'off-topic';

/**
 * Language analysis results
 */
export interface LanguageAnalysis {
  /** Detected primary language */
  primaryLanguage: AnalysisLanguage;
  /** Confidence in language detection (0.0-1.0) */
  confidence: number;
  /** Secondary languages detected */
  secondaryLanguages: Array<{
    language: AnalysisLanguage;
    confidence: number;
    percentage: number;
  }>;
  /** Whether the content is multilingual */
  isMultilingual: boolean;
  /** Regional dialect if detected */
  dialect?: string | undefined;
}

/**
 * Speaker information and characteristics
 */
export interface SpeakerInfo {
  /** Unique speaker identifier */
  id: string;
  /** Speaker name if identified */
  name?: string;
  /** Speaker role or title */
  role?: string;
  /** Gender identification if available */
  gender?: 'male' | 'female' | 'unknown';
  /** Estimated age group */
  ageGroup?: 'young' | 'middle' | 'senior' | 'unknown';
  /** Speaking time in seconds */
  speakingTime: number;
  /** Number of times speaker spoke */
  speechSegments: number;
  /** Average confidence in speaker identification */
  identificationConfidence: SpeakerConfidence;
  /** Voice characteristics */
  voiceCharacteristics?: {
    pitch: 'high' | 'medium' | 'low';
    pace: 'fast' | 'medium' | 'slow';
    volume: 'loud' | 'medium' | 'quiet';
  };
}

/**
 * Confidence scoring for different analysis aspects
 */
export interface ConfidenceScore {
  /** Overall confidence (0.0-1.0) */
  overall: number;
  /** Transcript quality confidence */
  transcriptQuality: number;
  /** Speaker identification confidence */
  speakerIdentification: number;
  /** Content segmentation confidence */
  segmentation: number;
  /** Language detection confidence */
  languageDetection: number;
  /** Topic identification confidence */
  topicIdentification: number;
  /** Sentiment analysis confidence */
  sentimentAnalysis?: number;
  /** Factors affecting confidence */
  factors: {
    audioQuality: AnalysisConfidence;
    backgroundNoise: AnalysisConfidence;
    speechClarity: AnalysisConfidence;
    languageConsistency: AnalysisConfidence;
  };
}

/**
 * Text segmentation result
 */
export interface TextSegmentation {
  /** Segmented text parts */
  segments: Array<{
    /** Segment identifier */
    id: string;
    /** Segment text content */
    text: string;
    /** Segment type classification */
    type: SegmentType;
    /** Start position in full text */
    startOffset: number;
    /** End position in full text */
    endOffset: number;
    /** Start time in seconds */
    startTime?: number | undefined;
    /** End time in seconds */
    endTime?: number | undefined;
    /** Primary speaker for this segment */
    primarySpeaker?: string | undefined;
    /** Confidence in segmentation */
    confidence: number;
    /** Keywords or topics in this segment */
    keywords: string[];
  }>;
  /** Total number of segments */
  totalSegments: number;
  /** Average segment length in words */
  averageLength: number;
  /** Segmentation methodology used */
  methodology: 'speaker-based' | 'topic-based' | 'time-based' | 'hybrid';
}

/**
 * Sentiment analysis results
 */
export interface SentimentAnalysis {
  /** Overall meeting sentiment */
  overall: 'very-positive' | 'positive' | 'neutral' | 'negative' | 'very-negative';
  /** Sentiment confidence (0.0-1.0) */
  confidence: number;
  /** Sentiment by speaker */
  bySpeaker: Array<{
    speakerId: string;
    sentiment: 'positive' | 'neutral' | 'negative';
    confidence: number;
    emotionalTone: string[];
  }>;
  /** Sentiment by topic */
  byTopic: Array<{
    topicId: string;
    sentiment: 'positive' | 'neutral' | 'negative';
    confidence: number;
  }>;
  /** Sentiment evolution over time */
  timeline: Array<{
    timeOffset: number;
    sentiment: 'positive' | 'neutral' | 'negative';
    intensity: number;
  }>;
}

/**
 * Topic modeling and identification
 */
export interface TopicIdentification {
  /** Identified topics */
  topics: Array<{
    /** Topic identifier */
    id: string;
    /** Topic name or title */
    name: string;
    /** Topic description */
    description?: string;
    /** Keywords associated with topic */
    keywords: string[];
    /** Topic importance score (0.0-1.0) */
    importance: number;
    /** Time spent on topic in seconds */
    duration: number;
    /** Speakers who discussed this topic */
    speakers: string[];
    /** Related topics */
    relatedTopics: string[];
  }>;
  /** Topic modeling method used */
  method: 'lda' | 'keyword' | 'semantic' | 'hybrid';
  /** Overall topic coherence score */
  coherenceScore: number;
}

/**
 * Comprehensive content analysis result
 */
export interface ContentAnalysis {
  /** Analysis identifier */
  id: string;
  /** Associated meeting ID */
  meetingId: string;
  /** Original text being analyzed */
  originalText: string;
  /** Language analysis results */
  language: LanguageAnalysis;
  /** Speaker information */
  speakers: SpeakerInfo[];
  /** Overall confidence scoring */
  confidence: ConfidenceScore;
  /** Text segmentation results */
  segmentation: TextSegmentation;
  /** Sentiment analysis (if enabled) */
  sentiment?: SentimentAnalysis;
  /** Topic identification results */
  topics: TopicIdentification;
  /** Analysis metadata */
  metadata: {
    /** Analysis algorithm version */
    version: string;
    /** Analysis start time */
    startedAt: Date;
    /** Analysis completion time */
    completedAt: Date;
    /** Processing duration in milliseconds */
    duration: number;
    /** Total words analyzed */
    wordCount: number;
    /** Unique speakers detected */
    speakerCount: number;
    /** Processing warnings or issues */
    warnings: string[];
  };
  /** Feature flags for enabled analysis */
  features: {
    speakerIdentification: boolean;
    sentimentAnalysis: boolean;
    topicModeling: boolean;
    multilanguageSupport: boolean;
    culturalContextPreservation: boolean;
  };
}
