/**
 * Azure Speech API types for the Meeting Summarizer Chrome Extension
 * Provides comprehensive type definitions for Azure Speech Service integration,
 * including configuration, client interfaces, and API response types.
 */

/**
 * Azure Speech Service regions
 */
export type AzureRegion = 
  | 'eastus' | 'eastus2' | 'southcentralus' | 'westus2' | 'westus3'
  | 'australiaeast' | 'southeastasia' | 'northeurope' | 'swedencentral'
  | 'uksouth' | 'westeurope' | 'centralus' | 'southafricanorth'
  | 'centralindia' | 'eastasia' | 'japaneast' | 'koreacentral';

/**
 * Supported audio formats for Azure Speech Service
 */
export type AudioFormat = 
  | 'wav' | 'mp3' | 'ogg' | 'webm' | 'flac' | 'aac' | 'm4a';

/**
 * Audio encoding types supported by Azure Speech
 */
export type AudioEncoding = 
  | 'PCM' | 'ALAW' | 'MULAW' | 'DVI_ADPCM' | 'GSM610' | 'G722_ADPCM'
  | 'MPEG_Layer3' | 'OGG_OPUS' | 'WEBM_OPUS' | 'AMR_WB' | 'FLAC' | 'AAC';

/**
 * Recognition result status from Azure Speech Service
 */
export type RecognitionStatus = 
  | 'Success' | 'NoMatch' | 'InitialSilenceTimeout' | 'BabbleTimeout'
  | 'Error' | 'EndOfDictation' | 'Canceled';

/**
 * Speech recognition modes
 */
export type RecognitionMode = 'Interactive' | 'Conversation' | 'Dictation';

/**
 * Profanity filtering options
 */
export type ProfanityOption = 'Masked' | 'Removed' | 'Raw';

/**
 * Diarization status for speaker identification
 */
export type DiarizationStatus = 'Success' | 'Failed' | 'NotRequested';

/**
 * Azure Speech Service configuration interface
 */
export interface AzureSpeechConfig {
  /** Azure subscription key for Speech Service */
  subscriptionKey: string;
  /** Azure region where Speech Service is deployed */
  serviceRegion: AzureRegion;
  /** Custom endpoint URL (optional, overrides default region endpoint) */
  endpoint?: string;
  /** Primary language for speech recognition (e.g., 'en-US', 'zh-TW') */
  language: string;
  /** Additional languages for multi-language recognition */
  additionalLanguages?: string[];
  /** Recognition mode for different use cases */
  recognitionMode: RecognitionMode;
  /** Output format preference */
  outputFormat: 'simple' | 'detailed';
  /** Enable speaker diarization (speaker identification) */
  enableSpeakerDiarization: boolean;
  /** Maximum number of speakers to identify */
  maxSpeakers?: number;
  /** Enable word-level timestamps */
  enableWordTimestamps: boolean;
  /** Profanity handling option */
  profanityOption: ProfanityOption;
  /** Enable phrase hints for domain-specific terms */
  enablePhraseHints: boolean;
  /** Custom phrase hints for better recognition */
  phraseHints?: string[];
  /** Custom speech model deployment ID */
  customModelId?: string;
  /** Request timeout in milliseconds */
  requestTimeout: number;
  /** Enable automatic punctuation */
  enableAutomaticPunctuation: boolean;
  /** Enable sentiment analysis */
  enableSentimentAnalysis?: boolean;
}

/**
 * Audio configuration for speech recognition
 */
export interface AudioConfig {
  /** Audio format */
  format: AudioFormat;
  /** Audio encoding */
  encoding: AudioEncoding;
  /** Sample rate in Hz */
  sampleRate: number;
  /** Number of audio channels */
  channels: number;
  /** Bits per sample */
  bitsPerSample: number;
  /** Audio source URL or blob */
  audioSource: string | Blob | ArrayBuffer;
  /** Audio duration in seconds */
  duration?: number;
  /** Audio file size in bytes */
  fileSize?: number;
}

/**
 * Speech recognition client interface
 */
export interface SpeechClient {
  /** Initialize the speech client with configuration */
  initialize(config: AzureSpeechConfig): Promise<void>;
  /** Start continuous speech recognition */
  startContinuousRecognition(audioConfig: AudioConfig): Promise<string>;
  /** Stop continuous speech recognition */
  stopContinuousRecognition(): Promise<void>;
  /** Recognize speech from audio file */
  recognizeFromFile(audioConfig: AudioConfig): Promise<SpeechRecognitionResult>;
  /** Recognize speech from audio stream */
  recognizeFromStream(audioStream: ReadableStream): Promise<SpeechRecognitionResult>;
  /** Get recognition status */
  getStatus(): SpeechClientStatus;
  /** Set phrase hints for better recognition */
  setPhraseHints(hints: string[]): void;
  /** Dispose of client resources */
  dispose(): void;
}

/**
 * Speech client status information
 */
export interface SpeechClientStatus {
  /** Whether client is initialized */
  isInitialized: boolean;
  /** Whether recognition is active */
  isRecognizing: boolean;
  /** Current connection status */
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error';
  /** Last error message if any */
  lastError?: string;
  /** Number of recognition requests made */
  requestCount: number;
  /** Total recognition time in milliseconds */
  totalRecognitionTime: number;
}

/**
 * Complete speech recognition result from Azure
 */
export interface SpeechRecognitionResult {
  /** Unique identifier for this recognition result */
  resultId: string;
  /** Recognition status */
  status: RecognitionStatus;
  /** Recognized text */
  text: string;
  /** Detailed recognition results */
  results: RecognitionResult[];
  /** Speaker diarization results if enabled */
  speakers?: SpeakerDiarizationResult;
  /** Recognition confidence score (0-1) */
  confidence: number;
  /** Audio offset in ticks (100ns units) */
  offset: number;
  /** Audio duration in ticks */
  duration: number;
  /** Error details if recognition failed */
  errorDetails?: ErrorDetails;
  /** Additional properties from Azure response */
  properties?: Record<string, string>;
}

/**
 * Individual recognition result segment
 */
export interface RecognitionResult {
  /** Result identifier */
  resultId: string;
  /** Recognition result type */
  resultType: 'Final' | 'Partial' | 'NoMatch';
  /** Recognized text for this segment */
  text: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Start time offset in ticks */
  offset: number;
  /** Duration in ticks */
  duration: number;
  /** Word-level details if enabled */
  words?: WordResult[];
  /** Best alternative results */
  alternatives?: AlternativeResult[];
  /** Sentiment analysis if enabled */
  sentiment?: SentimentResult;
  /** Language detection result */
  language?: string;
}

/**
 * Word-level recognition result
 */
export interface WordResult {
  /** The recognized word */
  word: string;
  /** Confidence score for this word (0-1) */
  confidence: number;
  /** Word start time offset in ticks */
  offset: number;
  /** Word duration in ticks */
  duration: number;
}

/**
 * Alternative recognition result
 */
export interface AlternativeResult {
  /** Alternative text */
  text: string;
  /** Confidence score for this alternative */
  confidence: number;
  /** Word-level details for alternative */
  words?: WordResult[];
}

/**
 * Sentiment analysis result
 */
export interface SentimentResult {
  /** Overall sentiment */
  sentiment: 'positive' | 'negative' | 'neutral';
  /** Sentiment confidence score (0-1) */
  confidence: number;
  /** Positive sentiment score */
  positive: number;
  /** Negative sentiment score */
  negative: number;
  /** Neutral sentiment score */
  neutral: number;
}

/**
 * Speaker diarization result
 */
export interface SpeakerDiarizationResult {
  /** Diarization processing status */
  status: DiarizationStatus;
  /** Number of speakers identified */
  speakerCount: number;
  /** Speaker segments with timing */
  speakers: SpeakerSegment[];
  /** Error message if diarization failed */
  error?: string;
}

/**
 * Individual speaker segment
 */
export interface SpeakerSegment {
  /** Speaker identifier (e.g., 'Speaker 1', 'Speaker 2') */
  speakerId: string;
  /** Segment start time offset in ticks */
  offset: number;
  /** Segment duration in ticks */
  duration: number;
  /** Confidence score for speaker identification */
  confidence: number;
  /** Associated text for this speaker segment */
  text?: string;
}

/**
 * Error details for failed recognition
 */
export interface ErrorDetails {
  /** Error code from Azure Speech Service */
  errorCode: string;
  /** Human-readable error message */
  message: string;
  /** Detailed error description */
  details?: string;
  /** HTTP status code if applicable */
  statusCode?: number;
  /** Request ID for tracking */
  requestId?: string;
  /** Timestamp when error occurred */
  timestamp: string;
}

/**
 * Batch transcription job configuration
 */
export interface BatchTranscriptionJob {
  /** Unique job identifier */
  jobId: string;
  /** Job display name */
  name: string;
  /** Job description */
  description?: string;
  /** Input audio URLs */
  contentUrls: string[];
  /** Transcription configuration */
  config: BatchTranscriptionConfig;
  /** Job status */
  status: BatchJobStatus;
  /** Job creation timestamp */
  createdAt: string;
  /** Job completion timestamp */
  completedAt?: string;
  /** Results download URLs */
  resultUrls?: string[];
  /** Error information if job failed */
  error?: ErrorDetails;
}

/**
 * Batch transcription configuration
 */
export interface BatchTranscriptionConfig {
  /** Language for transcription */
  language: string;
  /** Enable speaker diarization */
  diarization: boolean;
  /** Enable word-level timestamps */
  wordLevelTimestamps: boolean;
  /** Enable punctuation */
  punctuation: boolean;
  /** Profanity filtering option */
  profanityFilterMode: ProfanityOption;
  /** Custom model ID if using custom speech */
  customModelId?: string;
  /** Phrase hints for better accuracy */
  phraseHints?: string[];
}

/**
 * Batch job status types
 */
export type BatchJobStatus = 
  | 'NotStarted' | 'Running' | 'Succeeded' | 'Failed' | 'Cancelled';

/**
 * Azure Speech Service quota and usage information
 */
export interface SpeechServiceQuota {
  /** Current usage in requests */
  currentUsage: number;
  /** Request limit per time period */
  requestLimit: number;
  /** Time period for the limit (in seconds) */
  timePeriod: number;
  /** Remaining requests in current period */
  remainingRequests: number;
  /** Reset time for the quota period */
  resetTime: string;
  /** Concurrent request limit */
  concurrentLimit: number;
  /** Current concurrent requests */
  currentConcurrent: number;
}

/**
 * Transcription job creation request
 */
export interface CreateTranscriptionJobRequest {
  /** Job name */
  name: string;
  /** Job description */
  description?: string;
  /** Audio file URLs to transcribe */
  contentUrls: string[];
  /** Transcription language */
  language: string;
  /** Job configuration */
  config: BatchTranscriptionConfig;
  /** Webhook URL for job completion notifications */
  webhookUrl?: string;
}

/**
 * Real-time transcription session
 */
export interface TranscriptionSession {
  /** Session identifier */
  sessionId: string;
  /** Session configuration */
  config: AzureSpeechConfig;
  /** Session start time */
  startTime: string;
  /** Session status */
  status: 'active' | 'paused' | 'stopped' | 'error';
  /** Total recognition time in seconds */
  totalDuration: number;
  /** Number of words recognized */
  wordCount: number;
  /** Current audio input source */
  audioSource?: string;
  /** Last activity timestamp */
  lastActivity: string;
}

/**
 * Speech service metrics and analytics
 */
export interface SpeechServiceMetrics {
  /** Total recognition requests */
  totalRequests: number;
  /** Successful recognition requests */
  successfulRequests: number;
  /** Failed recognition requests */
  failedRequests: number;
  /** Average recognition accuracy */
  averageAccuracy: number;
  /** Total audio processed (in seconds) */
  totalAudioProcessed: number;
  /** Average processing time per request (in ms) */
  averageProcessingTime: number;
  /** Most common error codes */
  commonErrors: Array<{
    errorCode: string;
    count: number;
    percentage: number;
  }>;
  /** Usage by language */
  languageUsage: Record<string, number>;
  /** Daily usage statistics */
  dailyUsage: Array<{
    date: string;
    requestCount: number;
    audioMinutes: number;
  }>;
}