/**
 * Azure Speech API types for the Meeting Summarizer Chrome Extension
 * Provides type safety for Azure Speech operations and batch transcription
 * Based on Azure Cognitive Services Speech SDK specifications
 */

// Import error types for internal use
import type { TranscriptionError } from './errors';

/**
 * Azure Speech service regions
 */
export type AzureRegion =
  | 'eastus'
  | 'westus'
  | 'westus2'
  | 'westus3'
  | 'eastus2'
  | 'centralus'
  | 'northcentralus'
  | 'southcentralus'
  | 'westcentralus'
  | 'canadacentral'
  | 'brazilsouth'
  | 'eastasia'
  | 'southeastasia'
  | 'japaneast'
  | 'japanwest'
  | 'koreacentral'
  | 'australiaeast'
  | 'australiasoutheast'
  | 'centralindia'
  | 'uksouth'
  | 'ukwest'
  | 'francecentral'
  | 'germanynorth'
  | 'swedencentral'
  | 'switzerlandnorth'
  | 'northeurope'
  | 'westeurope'
  | 'southafricanorth'
  | 'uaenorth';

/**
 * Audio format types supported by Azure Speech
 */
export type AudioFormat = 'wav' | 'mp3' | 'mp4' | 'flac' | 'ogg' | 'webm';

/**
 * Audio encoding types
 */
export type AudioEncoding = 'pcm' | 'mulaw' | 'alaw' | 'linear16' | 'flac' | 'opus';

/**
 * Recognition status from Azure Speech API
 */
export type RecognitionStatus = 'Success' | 'NoMatch' | 'InitialSilenceTimeout' | 'BabbleTimeout' | 'Error';

/**
 * Recognition mode for Azure Speech
 */
export type RecognitionMode = 'Interactive' | 'Conversation' | 'Dictation';

/**
 * Profanity filter options
 */
export type ProfanityOption = 'None' | 'Removed' | 'Tags' | 'Masked';

/**
 * Speaker diarization status
 */
export type DiarizationStatus = 'NotStarted' | 'Running' | 'Succeeded' | 'Failed';

/**
 * Azure Speech configuration interface
 */
export interface AzureSpeechConfig {
  subscriptionKey: string;
  serviceRegion: AzureRegion;
  language: string;
  enableLogging?: boolean;
  endpoint?: string;
}

/**
 * Audio configuration for Azure Speech
 */
export interface AudioConfig {
  format: AudioFormat;
  encoding: AudioEncoding;
  sampleRate: number;
  channels: number;
  bitRate?: number;
}

/**
 * Speech client interface
 */
export interface SpeechClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  startTranscription(): Promise<void>;
  stopTranscription(): Promise<void>;
}

/**
 * Speech client status
 */
export type SpeechClientStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Transcription job status
 */
export type TranscriptionJobStatus = 'pending' | 'submitted' | 'processing' | 'completed' | 'failed' | 'cancelled';

/**
 * Batch job status from Azure
 */
export type BatchJobStatus = 'NotStarted' | 'Running' | 'Succeeded' | 'Failed' | 'Cancelled';

/**
 * Transcription configuration interface
 */
export interface TranscriptionConfig {
  /** Primary language code (e.g., 'en-US', 'zh-CN') */
  language: string;
  /** Enable speaker diarization for multi-participant meetings */
  enableSpeakerDiarization: boolean;
  /** Enable profanity filter */
  enableProfanityFilter: boolean;
  /** Output format preference */
  outputFormat: 'detailed' | 'simple';
  /** Confidence threshold (0.0-1.0) */
  confidenceThreshold: number;
  /** Maximum number of speakers for diarization */
  maxSpeakers?: number;
  /** Domain-specific vocabulary */
  customVocabulary?: string[];
  /** Recognition mode */
  recognitionMode?: RecognitionMode;
  /** Profanity handling */
  profanityOption?: ProfanityOption;
}

/**
 * Transcription job interface
 */
export interface TranscriptionJob {
  /** Unique job identifier */
  jobId: string;
  /** SharePoint audio URL */
  audioUrl: string;
  /** Azure batch transcription job ID */
  azureJobId?: string;
  /** Current job status */
  status: TranscriptionJobStatus;
  /** Completion percentage (0-100) */
  progress: number;
  /** Job submission timestamp */
  submittedAt: Date;
  /** Job completion timestamp */
  completedAt?: Date;
  /** Transcription configuration */
  config: TranscriptionConfig;
  /** Number of retry attempts */
  retryCount: number;
  /** Last error encountered */
  lastError?: TranscriptionError;
  /** Estimated completion time */
  estimatedCompletionTime?: Date;
}

/**
 * Speaker information for diarization
 */
export interface SpeakerInfo {
  /** Speaker identifier */
  speakerId: string;
  /** Speaker display name */
  displayName?: string;
  /** Total speaking time in seconds */
  totalSpeakingTime: number;
  /** Confidence score for speaker identification */
  confidence: number;
}

/**
 * Time-aligned transcription segment
 */
export interface TranscriptionSegment {
  /** Segment text */
  text: string;
  /** Start time in seconds */
  startTime: number;
  /** End time in seconds */
  endTime: number;
  /** Speaker ID for this segment */
  speakerId?: string;
  /** Confidence score for this segment */
  confidence: number;
  /** Individual word results */
  words?: TranscriptionWord[];
}

/**
 * Individual word in transcription
 */
export interface TranscriptionWord {
  /** Word text */
  word: string;
  /** Start time in seconds */
  startTime: number;
  /** End time in seconds */
  endTime: number;
  /** Word confidence score */
  confidence: number;
}

/**
 * Complete transcription result
 */
export interface TranscriptionResult {
  /** Associated job ID */
  jobId: string;
  /** Complete transcription text */
  text: string;
  /** Overall confidence score */
  confidence: number;
  /** Audio duration in seconds */
  duration: number;
  /** Speaker diarization results */
  speakers?: SpeakerInfo[];
  /** Time-aligned segments */
  segments: TranscriptionSegment[];
  /** Audio and processing metadata */
  metadata: {
    audioFormat: string;
    sampleRate: number;
    channels: number;
    processingTime: number;
    fileSize?: number;
    language: string;
  };
}

/**
 * Speech recognition result from Azure
 */
export interface SpeechRecognitionResult {
  text: string;
  reason: RecognitionStatus;
  resultId: string;
  duration: number;
  offset: number;
  confidence?: number;
}

/**
 * Recognition result with alternatives
 */
export interface RecognitionResult {
  text: string;
  confidence: number;
  alternatives?: AlternativeResult[];
  sentiment?: SentimentResult;
}

/**
 * Alternative recognition result
 */
export interface AlternativeResult {
  text: string;
  confidence: number;
}

/**
 * Word-level result
 */
export interface WordResult {
  word: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

/**
 * Sentiment analysis result
 */
export interface SentimentResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
}

/**
 * Speaker diarization result
 */
export interface SpeakerDiarizationResult {
  speakers: SpeakerSegment[];
  totalSpeakers: number;
}

/**
 * Speaker segment information
 */
export interface SpeakerSegment {
  speakerId: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

/**
 * Error details for failures
 */
export interface ErrorDetails {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Batch transcription job configuration
 */
export interface BatchTranscriptionConfig {
  audioUrl: string;
  language: string;
  displayName: string;
  description?: string;
  properties: {
    diarizationEnabled: boolean;
    profanityFilterMode: ProfanityOption;
    punctuationMode: 'None' | 'Dictated' | 'Automatic' | 'DictatedAndAutomatic';
    wordLevelTimestampsEnabled: boolean;
  };
}

/**
 * Batch transcription job from Azure API
 */
export interface BatchTranscriptionJob {
  self: string;
  model?: {
    self: string;
  };
  links: {
    files: string;
  };
  properties: {
    diarizationEnabled: boolean;
    wordLevelTimestampsEnabled: boolean;
    channels?: number[];
    profanityFilterMode: ProfanityOption;
    punctuationMode: string;
  };
  lastActionDateTime: string;
  status: BatchJobStatus;
  createdDateTime: string;
  displayName: string;
  description?: string;
  locale: string;
  error?: ErrorDetails;
}

/**
 * Speech service quota information
 */
export interface SpeechServiceQuota {
  /** Current usage count */
  current: number;
  /** Maximum allowed quota */
  limit: number;
  /** Reset period in seconds */
  resetPeriod: number;
  /** Time until reset */
  timeUntilReset: number;
}

/**
 * Create transcription job request
 */
export interface CreateTranscriptionJobRequest {
  audioUrl: string;
  config: TranscriptionConfig;
  metadata?: Record<string, unknown>;
}

/**
 * Transcription session information
 */
export interface TranscriptionSession {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
}

/**
 * Speech service metrics
 */
export interface SpeechServiceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageProcessingTime: number;
  quotaUsage: SpeechServiceQuota;
}

// Export error types
export { ErrorCategory, TranscriptionErrorType, RetryStrategy, ErrorSeverity } from './errors';

export type {
  TranscriptionError,
  ErrorRecoveryConfig,
  ErrorRecoveryRule,
  CircuitBreakerState,
  CircuitBreakerStatus,
  ErrorContext,
  ErrorAnalysis,
  ErrorNotificationConfig,
  ErrorMetrics,
  ErrorEvent,
} from './errors';
