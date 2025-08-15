/**
 * Azure Speech batch transcription result retriever
 * Retrieves and processes completed transcription results from Azure Speech Service
 * with comprehensive result parsing and formatting
 */

import type { AuthConfig } from '../types/auth';
import type {
  AzureRegion,
  TranscriptionJob,
  TranscriptionResult,
  TranscriptionSegment,
  TranscriptionWord,
  SpeakerInfo,
  ErrorDetails,
} from '../types/index';

/**
 * Result retrieval error types
 */
export type ResultRetrievalErrorType =
  | 'JOB_NOT_COMPLETED'
  | 'RESULTS_NOT_FOUND'
  | 'AUTHENTICATION_ERROR'
  | 'NETWORK_ERROR'
  | 'PARSE_ERROR'
  | 'TIMEOUT'
  | 'QUOTA_EXCEEDED'
  | 'SERVICE_UNAVAILABLE'
  | 'INVALID_JOB_ID'
  | 'CORRUPTED_DATA'
  | 'UNKNOWN_ERROR';

/**
 * Result retrieval error
 */
export interface ResultRetrievalError {
  /** Error type */
  type: ResultRetrievalErrorType;
  /** Error message */
  message: string;
  /** HTTP status code if applicable */
  statusCode?: number;
  /** Azure error details */
  azureError?: ErrorDetails;
  /** Whether the error is retryable */
  retryable: boolean;
  /** Suggested retry delay in milliseconds */
  retryAfter?: number;
  /** Error timestamp */
  timestamp: Date;
}

/**
 * Azure transcription file information
 */
interface AzureTranscriptionFile {
  /** File URL */
  self: string;
  /** File name */
  name: string;
  /** File kind (e.g., 'Transcription', 'Audio') */
  kind: string;
  /** File properties */
  properties: {
    /** File size in bytes */
    size: number;
    /** Creation timestamp */
    createdDateTime: string;
  };
  /** Links to other files */
  links?: {
    /** Content download URL */
    contentUrl: string;
  };
}

/**
 * Azure transcription files response
 */
interface AzureTranscriptionFiles {
  /** Array of transcription files */
  values: AzureTranscriptionFile[];
  /** Next page link if available */
  '@nextLink'?: string;
}

/**
 * Raw Azure transcription result
 */
interface AzureTranscriptionData {
  /** Audio source information */
  source: string;
  /** Transcription timestamp */
  timestamp: string;
  /** Duration in ticks */
  durationInTicks: number;
  /** Duration in ISO format */
  duration: string;
  /** Combined results from all recognizers */
  combinedRecognizedPhrases: Array<{
    /** Recognition channel */
    channel: number;
    /** Lexical text */
    lexical: string;
    /** ITN (Inverse Text Normalization) text */
    itn: string;
    /** Masked ITN text */
    maskedITN: string;
    /** Display text */
    display: string;
  }>;
  /** Recognized phrases with detailed information */
  recognizedPhrases: Array<{
    /** Recognition channel */
    channel: number;
    /** Recognition status */
    recognitionStatus: string;
    /** Speaker ID */
    speaker?: number;
    /** Start offset in ticks */
    offsetInTicks: number;
    /** Duration in ticks */
    durationInTicks: number;
    /** NBest results */
    nBest: Array<{
      /** Confidence score */
      confidence: number;
      /** Lexical text */
      lexical: string;
      /** ITN text */
      itn: string;
      /** Masked ITN text */
      maskedITN: string;
      /** Display text */
      display: string;
      /** Word-level details */
      words?: Array<{
        /** Word text */
        word: string;
        /** Start offset in ticks */
        offsetInTicks: number;
        /** Duration in ticks */
        durationInTicks: number;
        /** Word confidence */
        confidence: number;
      }>;
    }>;
  }>;
}

/**
 * Result retrieval configuration
 */
export interface ResultRetrievalConfig {
  /** Maximum retry attempts */
  maxRetryAttempts: number;
  /** Base delay between retries (ms) */
  retryBaseDelay: number;
  /** Maximum delay between retries (ms) */
  retryMaxDelay: number;
  /** Request timeout (ms) */
  timeout: number;
  /** Maximum file size to download (bytes) */
  maxFileSize: number;
  /** Include word-level timestamps */
  includeWordTimestamps: boolean;
  /** Minimum confidence threshold for segments */
  minConfidenceThreshold: number;
  /** Enable speaker diarization processing */
  processSpeakerDiarization: boolean;
}

/**
 * Result retrieval result
 */
export interface ResultRetrievalResult {
  /** Whether retrieval was successful */
  success: boolean;
  /** Transcription result data */
  result?: TranscriptionResult;
  /** Raw Azure files information */
  files?: AzureTranscriptionFile[];
  /** Retrieval error if failed */
  error?: ResultRetrievalError;
  /** Retrieval duration in milliseconds */
  retrievalTime: number;
  /** Retrieved timestamp */
  retrievedAt: Date;
}

/**
 * Default retrieval configuration
 */
const DEFAULT_RETRIEVAL_CONFIG: ResultRetrievalConfig = {
  maxRetryAttempts: 3,
  retryBaseDelay: 2000,
  retryMaxDelay: 30000,
  timeout: 60000,
  maxFileSize: 100 * 1024 * 1024, // 100MB
  includeWordTimestamps: true,
  minConfidenceThreshold: 0.5,
  processSpeakerDiarization: true,
};

/**
 * Azure Speech batch transcription endpoints by region
 */
const BATCH_TRANSCRIPTION_ENDPOINTS: Record<AzureRegion, string> = {
  eastus: 'https://eastus.api.cognitive.microsoft.com',
  eastus2: 'https://eastus2.api.cognitive.microsoft.com',
  westus: 'https://westus.api.cognitive.microsoft.com',
  westus2: 'https://westus2.api.cognitive.microsoft.com',
  westus3: 'https://westus3.api.cognitive.microsoft.com',
  centralus: 'https://centralus.api.cognitive.microsoft.com',
  northcentralus: 'https://northcentralus.api.cognitive.microsoft.com',
  southcentralus: 'https://southcentralus.api.cognitive.microsoft.com',
  westcentralus: 'https://westcentralus.api.cognitive.microsoft.com',
  northeurope: 'https://northeurope.api.cognitive.microsoft.com',
  westeurope: 'https://westeurope.api.cognitive.microsoft.com',
  uksouth: 'https://uksouth.api.cognitive.microsoft.com',
  ukwest: 'https://ukwest.api.cognitive.microsoft.com',
  francecentral: 'https://francecentral.api.cognitive.microsoft.com',
  germanynorth: 'https://germanynorth.api.cognitive.microsoft.com',
  swedencentral: 'https://swedencentral.api.cognitive.microsoft.com',
  switzerlandnorth: 'https://switzerlandnorth.api.cognitive.microsoft.com',
  southeastasia: 'https://southeastasia.api.cognitive.microsoft.com',
  eastasia: 'https://eastasia.api.cognitive.microsoft.com',
  australiaeast: 'https://australiaeast.api.cognitive.microsoft.com',
  australiasoutheast: 'https://australiasoutheast.api.cognitive.microsoft.com',
  centralindia: 'https://centralindia.api.cognitive.microsoft.com',
  japaneast: 'https://japaneast.api.cognitive.microsoft.com',
  japanwest: 'https://japanwest.api.cognitive.microsoft.com',
  koreacentral: 'https://koreacentral.api.cognitive.microsoft.com',
  canadacentral: 'https://canadacentral.api.cognitive.microsoft.com',
  brazilsouth: 'https://brazilsouth.api.cognitive.microsoft.com',
  southafricanorth: 'https://southafricanorth.api.cognitive.microsoft.com',
  uaenorth: 'https://uaenorth.api.cognitive.microsoft.com',
};

/**
 * Convert Azure ticks to seconds
 */
const ticksToSeconds = (ticks: number): number => ticks / 10000000; // Azure uses 100-nanosecond ticks

/**
 * Parse ISO 8601 duration to seconds
 */
const parseDuration = (isoDuration: string): number => {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseFloat(match[3] || '0');

  return hours * 3600 + minutes * 60 + seconds;
};

/**
 * Create result retrieval error
 */
const createRetrievalError = (
  type: ResultRetrievalErrorType,
  message: string,
  statusCode?: number,
  retryable: boolean = false,
  retryAfter?: number,
  azureError?: ErrorDetails,
): ResultRetrievalError => ({
  type,
  message,
  retryable,
  timestamp: new Date(),
  ...(statusCode !== undefined && { statusCode }),
  ...(azureError && { azureError }),
  ...(retryAfter !== undefined && { retryAfter }),
});

/**
 * Calculate exponential backoff delay
 */
const calculateBackoffDelay = (attempt: number, baseDelay: number, maxDelay: number): number => {
  const delay = baseDelay * Math.pow(2, attempt - 1);
  const jitter = Math.random() * 0.1 * delay;
  return Math.min(delay + jitter, maxDelay);
};

/**
 * Process speaker diarization data
 */
const processSpeakerData = (
  phrases: AzureTranscriptionData['recognizedPhrases'],
  _totalDuration: number,
): SpeakerInfo[] => {
  const speakerMap = new Map<
    number,
    {
      totalTime: number;
      confidenceSum: number;
      segmentCount: number;
    }
  >();

  // Aggregate speaker statistics
  for (const phrase of phrases) {
    if (phrase.speaker !== undefined && phrase.nBest.length > 0) {
      const speaker = phrase.speaker;
      const duration = ticksToSeconds(phrase.durationInTicks);
      const bestResult = phrase.nBest[0];
      if (!bestResult) continue;
      const confidence = bestResult.confidence;

      if (!speakerMap.has(speaker)) {
        speakerMap.set(speaker, {
          totalTime: 0,
          confidenceSum: 0,
          segmentCount: 0,
        });
      }

      const speakerData = speakerMap.get(speaker)!;
      speakerData.totalTime += duration;
      speakerData.confidenceSum += confidence;
      speakerData.segmentCount++;
    }
  }

  // Convert to SpeakerInfo array
  return Array.from(speakerMap.entries()).map(([speakerId, data]) => ({
    speakerId: `Speaker ${speakerId + 1}`,
    displayName: `Speaker ${speakerId + 1}`,
    totalSpeakingTime: data.totalTime,
    confidence: data.confidenceSum / data.segmentCount,
  }));
};

/**
 * Process transcription words
 */
const processWords = (
  words: AzureTranscriptionData['recognizedPhrases'][0]['nBest'][0]['words'],
  includeTimestamps: boolean,
): TranscriptionWord[] => {
  if (!words || !includeTimestamps) {
    return [];
  }

  return words.map(word => ({
    word: word.word,
    startTime: ticksToSeconds(word.offsetInTicks),
    endTime: ticksToSeconds(word.offsetInTicks + word.durationInTicks),
    confidence: word.confidence,
  }));
};

/**
 * Azure Speech batch transcription result retriever
 */
export class ResultRetriever {
  private authConfig: AuthConfig;
  private retrievalConfig: ResultRetrievalConfig;
  private accessToken: string | null = null;

  constructor(authConfig: AuthConfig, retrievalConfig?: Partial<ResultRetrievalConfig>) {
    this.authConfig = authConfig;
    this.retrievalConfig = { ...DEFAULT_RETRIEVAL_CONFIG, ...retrievalConfig };
  }

  /**
   * Retrieve transcription results for a completed job
   */
  async retrieveResults(job: TranscriptionJob, accessToken?: string): Promise<ResultRetrievalResult> {
    const startTime = Date.now();

    try {
      // Use provided token or stored token
      if (accessToken) {
        this.accessToken = accessToken;
      }

      if (!this.accessToken) {
        const error = createRetrievalError('AUTHENTICATION_ERROR', 'No access token available for result retrieval');

        return {
          success: false,
          error,
          retrievalTime: Date.now() - startTime,
          retrievedAt: new Date(),
        };
      }

      if (!job.azureJobId) {
        const error = createRetrievalError('INVALID_JOB_ID', 'Job does not have an Azure job ID');

        return {
          success: false,
          error,
          retrievalTime: Date.now() - startTime,
          retrievedAt: new Date(),
        };
      }

      if (job.status !== 'completed') {
        const error = createRetrievalError('JOB_NOT_COMPLETED', `Job status is '${job.status}', expected 'completed'`);

        return {
          success: false,
          error,
          retrievalTime: Date.now() - startTime,
          retrievedAt: new Date(),
        };
      }

      // Retrieve results with retry logic
      const result = await this.retrieveResultsWithRetry(job.azureJobId);

      if (result.success && result.result) {
        result.result.jobId = job.jobId;
      }

      return {
        ...result,
        retrievalTime: Date.now() - startTime,
        retrievedAt: new Date(),
      };
    } catch (error) {
      const retrievalError = createRetrievalError(
        'UNKNOWN_ERROR',
        `Unexpected error during result retrieval: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      return {
        success: false,
        error: retrievalError,
        retrievalTime: Date.now() - startTime,
        retrievedAt: new Date(),
      };
    }
  }

  /**
   * Retrieve results with retry logic
   */
  private async retrieveResultsWithRetry(
    azureJobId: string,
  ): Promise<Omit<ResultRetrievalResult, 'retrievalTime' | 'retrievedAt'>> {
    let lastError: ResultRetrievalError | undefined;

    for (let attempt = 1; attempt <= this.retrievalConfig.maxRetryAttempts; attempt++) {
      try {
        const result = await this.performResultRetrieval(azureJobId);

        if (result.success) {
          return result;
        }

        lastError = result.error;

        // If error is not retryable, break immediately
        if (!result.error?.retryable) {
          break;
        }

        // If this is not the last attempt, wait before retrying
        if (attempt < this.retrievalConfig.maxRetryAttempts) {
          const delay =
            result.error.retryAfter ||
            calculateBackoffDelay(attempt, this.retrievalConfig.retryBaseDelay, this.retrievalConfig.retryMaxDelay);

          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        lastError = createRetrievalError(
          'UNKNOWN_ERROR',
          `Attempt ${attempt} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    return {
      success: false,
      error: lastError || createRetrievalError('UNKNOWN_ERROR', 'All retry attempts failed'),
    };
  }

  /**
   * Perform the actual result retrieval
   */
  private async performResultRetrieval(
    azureJobId: string,
  ): Promise<Omit<ResultRetrievalResult, 'retrievalTime' | 'retrievedAt'>> {
    const endpoint = BATCH_TRANSCRIPTION_ENDPOINTS[this.authConfig.region as AzureRegion];

    if (!endpoint) {
      const error = createRetrievalError(
        'UNKNOWN_ERROR',
        `No batch transcription endpoint found for region: ${this.authConfig.region}`,
      );

      return { success: false, error };
    }

    try {
      // Get transcription files list
      const filesResult = await this.getTranscriptionFiles(azureJobId);

      if (!filesResult.success) {
        return filesResult;
      }

      const files = filesResult.files!;

      // Find transcription result file
      const transcriptionFile = files.find(file => file.kind === 'Transcription');

      if (!transcriptionFile) {
        const error = createRetrievalError('RESULTS_NOT_FOUND', 'No transcription result file found');

        return { success: false, error };
      }

      // Download and parse transcription data
      const transcriptionData = await this.downloadTranscriptionFile(transcriptionFile);

      if (!transcriptionData.success) {
        return transcriptionData;
      }

      // Process the transcription data
      const result = this.processTranscriptionData(transcriptionData.data!);

      return {
        success: true,
        result,
        files,
      };
    } catch (error) {
      const retrievalError = createRetrievalError(
        'NETWORK_ERROR',
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        true,
      );

      return { success: false, error: retrievalError };
    }
  }

  /**
   * Get transcription files from Azure
   */
  private async getTranscriptionFiles(azureJobId: string): Promise<{
    success: boolean;
    files?: AzureTranscriptionFile[];
    error?: ResultRetrievalError;
  }> {
    const endpoint = BATCH_TRANSCRIPTION_ENDPOINTS[this.authConfig.region as AzureRegion];
    const apiUrl = `${endpoint}/speechtotext/v3.0/transcriptions/${azureJobId}/files`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.retrievalConfig.timeout);

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Ocp-Apim-Subscription-Key': this.authConfig.subscriptionKey,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorType: ResultRetrievalErrorType;
        let retryable = false;
        let retryAfter: number | undefined;

        switch (response.status) {
          case 404:
            errorType = 'RESULTS_NOT_FOUND';
            break;
          case 401:
          case 403:
            errorType = 'AUTHENTICATION_ERROR';
            break;
          case 429: {
            errorType = 'QUOTA_EXCEEDED';
            retryable = true;
            const retryHeader = response.headers.get('retry-after');
            retryAfter = retryHeader ? parseInt(retryHeader, 10) * 1000 : 60000;
            break;
          }
          case 503:
            errorType = 'SERVICE_UNAVAILABLE';
            retryable = true;
            retryAfter = 30000;
            break;
          default:
            errorType = 'NETWORK_ERROR';
            retryable = response.status >= 500;
        }

        let azureError: ErrorDetails | undefined;
        try {
          const errorResponse = await response.json();
          azureError = errorResponse.error || errorResponse;
        } catch {
          // Failed to parse error response
        }

        const error = createRetrievalError(
          errorType,
          `Azure API error: HTTP ${response.status} ${response.statusText}`,
          response.status,
          retryable,
          retryAfter,
          azureError,
        );

        return { success: false, error };
      }

      const filesResponse: AzureTranscriptionFiles = await response.json();

      return {
        success: true,
        files: filesResponse.values,
      };
    } catch (error) {
      let errorType: ResultRetrievalErrorType;
      let retryable = false;

      if (error instanceof Error && error.name === 'AbortError') {
        errorType = 'TIMEOUT';
        retryable = true;
      } else {
        errorType = 'NETWORK_ERROR';
        retryable = true;
      }

      const retrievalError = createRetrievalError(
        errorType,
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        retryable,
      );

      return { success: false, error: retrievalError };
    }
  }

  /**
   * Download transcription file content
   */
  private async downloadTranscriptionFile(file: AzureTranscriptionFile): Promise<{
    success: boolean;
    data?: AzureTranscriptionData;
    error?: ResultRetrievalError;
  }> {
    if (!file.links?.contentUrl) {
      const error = createRetrievalError('CORRUPTED_DATA', 'Transcription file does not have a content URL');

      return { success: false, error };
    }

    // Check file size
    if (file.properties.size > this.retrievalConfig.maxFileSize) {
      const error = createRetrievalError(
        'CORRUPTED_DATA',
        `File size ${file.properties.size} bytes exceeds maximum allowed size ${this.retrievalConfig.maxFileSize} bytes`,
      );

      return { success: false, error };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.retrievalConfig.timeout);

      const response = await fetch(file.links.contentUrl, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = createRetrievalError(
          'NETWORK_ERROR',
          `Failed to download transcription file: HTTP ${response.status} ${response.statusText}`,
          response.status,
          response.status >= 500,
        );

        return { success: false, error };
      }

      const transcriptionText = await response.text();

      try {
        const transcriptionData: AzureTranscriptionData = JSON.parse(transcriptionText);

        return {
          success: true,
          data: transcriptionData,
        };
      } catch (parseError) {
        const error = createRetrievalError(
          'PARSE_ERROR',
          `Failed to parse transcription data: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`,
        );

        return { success: false, error };
      }
    } catch (error) {
      let errorType: ResultRetrievalErrorType;
      let retryable = false;

      if (error instanceof Error && error.name === 'AbortError') {
        errorType = 'TIMEOUT';
        retryable = true;
      } else {
        errorType = 'NETWORK_ERROR';
        retryable = true;
      }

      const retrievalError = createRetrievalError(
        errorType,
        `Download error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        retryable,
      );

      return { success: false, error: retrievalError };
    }
  }

  /**
   * Process raw Azure transcription data into our format
   */
  private processTranscriptionData(data: AzureTranscriptionData): TranscriptionResult {
    const duration = parseDuration(data.duration);
    const segments: TranscriptionSegment[] = [];
    let fullText = '';
    let totalConfidence = 0;
    let segmentCount = 0;

    // Process recognized phrases into segments
    for (const phrase of data.recognizedPhrases) {
      if (phrase.nBest.length === 0) continue;

      const bestResult = phrase.nBest[0];
      if (!bestResult) continue;

      // Filter by confidence threshold
      if (bestResult.confidence < this.retrievalConfig.minConfidenceThreshold) {
        continue;
      }

      const startTime = ticksToSeconds(phrase.offsetInTicks);
      const endTime = ticksToSeconds(phrase.offsetInTicks + phrase.durationInTicks);
      const words = this.retrievalConfig.includeWordTimestamps ? processWords(bestResult.words, true) : [];

      const segment: TranscriptionSegment = {
        text: bestResult.display,
        startTime,
        endTime,
        confidence: bestResult.confidence,
        words,
        ...(phrase.speaker !== undefined && { speakerId: `Speaker ${phrase.speaker + 1}` }),
      };

      segments.push(segment);
      fullText += (fullText ? ' ' : '') + bestResult.display;
      totalConfidence += bestResult.confidence;
      segmentCount++;
    }

    // Process speaker information if enabled
    const speakers = this.retrievalConfig.processSpeakerDiarization
      ? processSpeakerData(data.recognizedPhrases, duration)
      : [];

    // Calculate overall confidence
    const overallConfidence = segmentCount > 0 ? totalConfidence / segmentCount : 0;

    // Determine audio format from source URL
    let audioFormat = 'unknown';
    try {
      const url = new URL(data.source);
      const extension = url.pathname.split('.').pop()?.toLowerCase();
      if (extension) {
        audioFormat = extension;
      }
    } catch {
      // Failed to parse URL
    }

    return {
      jobId: '', // Will be set by caller
      text: fullText,
      confidence: overallConfidence,
      duration,
      segments,
      metadata: {
        audioFormat,
        sampleRate: 16000, // Default, Azure doesn't provide this in results
        channels: 1, // Default, Azure doesn't provide this in results
        processingTime: 0, // Not available from Azure results
        language: this.authConfig.region || 'unknown',
      },
      ...(speakers.length > 0 && { speakers }),
    };
  }

  /**
   * Check if transcription results are available for a job
   */
  async checkResultsAvailability(
    azureJobId: string,
    accessToken?: string,
  ): Promise<{
    available: boolean;
    files?: AzureTranscriptionFile[];
    error?: string;
  }> {
    if (accessToken) {
      this.accessToken = accessToken;
    }

    if (!this.accessToken) {
      return {
        available: false,
        error: 'No access token available',
      };
    }

    try {
      const filesResult = await this.getTranscriptionFiles(azureJobId);

      if (!filesResult.success) {
        return {
          available: false,
          error: filesResult.error?.message || 'Failed to check results availability',
        };
      }

      const transcriptionFile = filesResult.files?.find(file => file.kind === 'Transcription');

      return {
        available: !!transcriptionFile,
        ...(filesResult.files && { files: filesResult.files }),
      };
    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update access token
   */
  updateAccessToken(token: string): void {
    this.accessToken = token;
  }

  /**
   * Update authentication configuration
   */
  updateAuthConfig(config: AuthConfig): void {
    this.authConfig = config;
  }

  /**
   * Update retrieval configuration
   */
  updateRetrievalConfig(config: Partial<ResultRetrievalConfig>): void {
    this.retrievalConfig = { ...this.retrievalConfig, ...config };
  }

  /**
   * Get current configuration
   */
  getConfiguration(): {
    authConfig: AuthConfig;
    retrievalConfig: ResultRetrievalConfig;
    hasAccessToken: boolean;
  } {
    return {
      authConfig: { ...this.authConfig },
      retrievalConfig: { ...this.retrievalConfig },
      hasAccessToken: !!this.accessToken,
    };
  }

  /**
   * Test connectivity to Azure batch transcription service
   */
  async testConnectivity(accessToken?: string): Promise<{
    success: boolean;
    responseTime: number;
    error?: string;
  }> {
    const startTime = Date.now();

    if (accessToken) {
      this.accessToken = accessToken;
    }

    if (!this.accessToken) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: 'No access token available',
      };
    }

    const endpoint = BATCH_TRANSCRIPTION_ENDPOINTS[this.authConfig.region as AzureRegion];

    if (!endpoint) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: `No endpoint found for region: ${this.authConfig.region}`,
      };
    }

    try {
      const response = await fetch(`${endpoint}/speechtotext/v3.0/transcriptions`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Ocp-Apim-Subscription-Key': this.authConfig.subscriptionKey,
        },
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        return { success: true, responseTime };
      } else {
        return {
          success: false,
          responseTime,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
