/**
 * Meeting processor types for AI-powered content processing
 * Provides comprehensive type definitions for processing results,
 * summaries, action items, and decision identification.
 */

/**
 * Priority levels for action items and decisions
 */
export type Priority = 'high' | 'medium' | 'low';

/**
 * Consensus levels for decision identification
 */
export type ConsensusLevel = 'unanimous' | 'majority' | 'split' | 'unclear';

/**
 * Impact levels for decisions
 */
export type ImpactLevel = 'high' | 'medium' | 'low';

/**
 * Action item status during processing
 */
export type ActionItemStatus = 'identified' | 'validated' | 'disputed';

/**
 * Processing quality levels
 */
export type QualityLevel = 'excellent' | 'good' | 'acceptable' | 'fair' | 'poor' | 'unacceptable';

/**
 * Reference to a text segment in the original transcription
 */
export interface TextSegment {
  /** Start position in the full text */
  startOffset: number;
  /** End position in the full text */
  endOffset: number;
  /** The referenced text content */
  text: string;
  /** Start time in seconds from meeting start */
  startTime?: number;
  /** End time in seconds from meeting start */
  endTime?: number;
  /** Speaker who said this segment */
  speakerId?: string;
}

/**
 * Topic summary within the meeting
 */
export interface TopicSummary {
  /** Topic identifier */
  id: string;
  /** Topic title or main theme */
  title: string;
  /** Brief description of the topic */
  description: string;
  /** Time spent discussing this topic in seconds */
  duration?: number;
  /** Key points discussed under this topic */
  keyPoints: string[];
  /** Participants who contributed to this topic */
  participants: string[];
  /** Reference to source segments */
  sources: TextSegment[];
}

/**
 * Processing configuration for content analysis
 */
export interface ProcessingConfiguration {
  /** Language for processing (ISO 639-1 code) */
  language: string;
  /** Enable speaker identification */
  enableSpeakerIdentification: boolean;
  /** Enable sentiment analysis */
  enableSentimentAnalysis: boolean;
  /** Minimum confidence threshold for extraction */
  confidenceThreshold: number;
  /** Maximum summary length in words */
  maxSummaryLength: number;
  /** Enable cultural context preservation */
  preserveCulturalContext: boolean;
}

/**
 * Processing confidence metrics
 */
export interface ProcessingConfidence {
  /** Overall processing confidence (0.0-1.0) */
  overall: number;
  /** Summary generation confidence */
  summary: number;
  /** Action item extraction confidence */
  actionItems: number;
  /** Decision identification confidence */
  decisions: number;
  /** Topic identification confidence */
  topics: number;
  /** Language detection confidence */
  languageDetection: number;
}

/**
 * Metadata about the processing operation
 */
export interface ProcessingMetadata {
  /** Processing algorithm version */
  algorithmVersion: string;
  /** Processing start timestamp */
  startedAt: Date;
  /** Processing completion timestamp */
  completedAt: Date;
  /** Processing duration in milliseconds */
  duration: number;
  /** Total words processed */
  wordsProcessed: number;
  /** Configuration used for processing */
  configuration: ProcessingConfiguration;
  /** Quality assessment */
  quality: QualityLevel;
  /** Any warnings or issues during processing */
  warnings: string[];
}

/**
 * Main processing result containing all extracted information
 */
export interface ProcessingResult {
  /** Associated meeting identifier */
  meetingId: string;
  /** Generated meeting summary */
  summary: MeetingSummary;
  /** Extracted action items */
  actionItems: ActionItem[];
  /** Identified decisions */
  decisions: Decision[];
  /** Key topics discussed */
  keyTopics: TopicSummary[];
  /** Processing metadata and metrics */
  processingMetadata: ProcessingMetadata;
  /** Confidence scores for all processing results */
  confidence: ProcessingConfidence;
  /** When this result was generated */
  generatedAt: Date;
}

/**
 * Comprehensive meeting summary with structured content
 */
export interface MeetingSummary {
  /** High-level meeting overview */
  overview: string;
  /** Important discussion points */
  keyPoints: string[];
  /** Meeting results and conclusions */
  outcomes: string[];
  /** Follow-up actions and plans */
  nextSteps: string[];
  /** Structured summary content */
  structure: {
    /** Meeting opening summary */
    introduction?: string;
    /** Main discussion content */
    mainDiscussion: string;
    /** Meeting conclusion */
    conclusion?: string;
  };
  /** Topic-wise summaries */
  topics: TopicSummary[];
  /** Overall sentiment of the meeting */
  sentiment?: 'positive' | 'neutral' | 'negative';
  /** Estimated reading time in minutes */
  readingTime: number;
}

/**
 * Extracted action item with assignment and deadline information
 */
export interface ActionItem {
  /** Unique action item identifier */
  id: string;
  /** Clear description of the action */
  task: string;
  /** Identified responsible party */
  assignee?: string | undefined;
  /** Extracted or inferred deadline */
  deadline?: Date | undefined;
  /** Priority level of the action */
  priority: Priority;
  /** Surrounding discussion context */
  context: string;
  /** Reference to original transcription */
  source: TextSegment;
  /** Extraction confidence (0.0-1.0) */
  confidence: number;
  /** Processing status */
  status: ActionItemStatus;
  /** Estimated effort or complexity */
  estimatedEffort?: 'low' | 'medium' | 'high';
  /** Dependencies on other action items */
  dependencies: string[];
}

/**
 * Identified decision with context and participants
 */
export interface Decision {
  /** Unique decision identifier */
  id: string;
  /** Clear statement of what was decided */
  decision: string;
  /** Background and reasoning for the decision */
  context: string;
  /** People involved in making the decision */
  participants: string[];
  /** Level of consensus reached */
  consensus: ConsensusLevel;
  /** Expected impact of the decision */
  impact: ImpactLevel;
  /** How the decision will be implemented */
  implementation?: string | undefined;
  /** Reference to original transcription */
  source: TextSegment;
  /** Identification confidence (0.0-1.0) */
  confidence: number;
  /** Decision category or type */
  category?: 'strategic' | 'operational' | 'technical' | 'administrative';
  /** Expected completion timeline */
  timeline?: string | undefined;
}
