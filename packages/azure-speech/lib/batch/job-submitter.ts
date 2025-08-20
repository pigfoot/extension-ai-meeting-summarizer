/**
 * Azure Speech batch transcription job submitter
 * Handles submission of transcription jobs to Azure Speech Service
 * with job configuration and parameter management
 */

import { JobValidator } from './job-validator';
import type { JobValidationResult as _JobValidationResult } from './job-validator';
import type { AuthConfig } from '../types/auth';
import type {
  TranscriptionJob,
  TranscriptionConfig,
  CreateTranscriptionJobRequest,
  BatchTranscriptionJob,
  BatchTranscriptionConfig,
  BatchJobStatus,
  AzureRegion,
  ErrorDetails,
} from '../types/index';

/**
 * Job submission error types
 */
export type JobSubmissionErrorType =
  | 'VALIDATION_FAILED'
  | 'AUTHENTICATION_ERROR'
  | 'NETWORK_ERROR'
  | 'QUOTA_EXCEEDED'
  | 'INVALID_AUDIO_URL'
  | 'SERVICE_UNAVAILABLE'
  | 'TIMEOUT'
  | 'UNKNOWN_ERROR';

/**
 * Job submission error
 */
export interface JobSubmissionError {
  /** Error type */
  type: JobSubmissionErrorType;
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
 * Job submission result
 */
export interface JobSubmissionResult {
  /** Whether submission was successful */
  success: boolean;
  /** Created transcription job */
  job?: TranscriptionJob;
  /** Azure batch job information */
  azureJob?: BatchTranscriptionJob;
  /** Submission error if failed */
  error?: JobSubmissionError;
  /** Job submission duration in milliseconds */
  submissionTime: number;
  /** Submission timestamp */
  submittedAt: Date;
}

/**
 * Job submission configuration
 */
export interface JobSubmissionConfig {
  /** Maximum retry attempts */
  maxRetryAttempts: number;
  /** Base delay between retries (ms) */
  retryBaseDelay: number;
  /** Maximum delay between retries (ms) */
  retryMaxDelay: number;
  /** Request timeout (ms) */
  timeout: number;
  /** Enable validation before submission */
  enableValidation: boolean;
  /** Custom job ID prefix */
  jobIdPrefix?: string;
}

/**
 * Default submission configuration
 */
const DEFAULT_SUBMISSION_CONFIG: JobSubmissionConfig = {
  maxRetryAttempts: 3,
  retryBaseDelay: 1000,
  retryMaxDelay: 30000,
  timeout: 30000,
  enableValidation: true,
  jobIdPrefix: 'meeting-transcription',
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
 * Create job submission error
 */
const createSubmissionError = (
  type: JobSubmissionErrorType,
  message: string,
  statusCode?: number,
  retryable: boolean = false,
  retryAfter?: number,
  azureError?: ErrorDetails,
): JobSubmissionError => ({
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
 * Generate unique job ID
 */
const generateJobId = (prefix: string = 'job'): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`;
};

/**
 * Convert transcription config to Azure batch config
 */
const createBatchConfig = (
  audioUrl: string,
  config: TranscriptionConfig,
  displayName?: string,
): BatchTranscriptionConfig => ({
  audioUrl,
  language: config.language,
  displayName: displayName || `Transcription ${new Date().toISOString()}`,
  description: `Meeting transcription job created at ${new Date().toISOString()}`,
  properties: {
    diarizationEnabled: config.enableSpeakerDiarization,
    profanityFilterMode: config.enableProfanityFilter ? 'Masked' : 'None',
    punctuationMode: 'DictatedAndAutomatic',
    wordLevelTimestampsEnabled: true,
  },
});

/**
 * Map Azure job status to our job status
 */
const mapAzureJobStatus = (azureStatus: BatchJobStatus): TranscriptionJob['status'] => {
  switch (azureStatus) {
    case 'NotStarted':
      return 'submitted';
    case 'Running':
      return 'processing';
    case 'Succeeded':
      return 'completed';
    case 'Failed':
      return 'failed';
    case 'Cancelled':
      return 'cancelled';
    default:
      return 'submitted';
  }
};

/**
 * Azure Speech batch transcription job submitter
 */
export class JobSubmitter {
  private authConfig: AuthConfig;
  private submissionConfig: JobSubmissionConfig;
  private accessToken: string | null = null;

  constructor(authConfig: AuthConfig, submissionConfig?: Partial<JobSubmissionConfig>) {
    this.authConfig = authConfig;
    this.submissionConfig = { ...DEFAULT_SUBMISSION_CONFIG, ...submissionConfig };
  }

  /**
   * Submit a transcription job to Azure Speech Service
   */
  async submitJob(request: CreateTranscriptionJobRequest, accessToken?: string): Promise<JobSubmissionResult> {
    const startTime = Date.now();

    try {
      // Use provided token or stored token
      if (accessToken) {
        this.accessToken = accessToken;
      }

      if (!this.accessToken) {
        const error = createSubmissionError('AUTHENTICATION_ERROR', 'No access token available for job submission');

        return {
          success: false,
          error,
          submissionTime: Date.now() - startTime,
          submittedAt: new Date(),
        };
      }

      // Validate job if enabled
      if (this.submissionConfig.enableValidation) {
        const validationResult = await JobValidator.validateJob(request);

        if (!validationResult.isValid) {
          const error = createSubmissionError(
            'VALIDATION_FAILED',
            `Job validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`,
          );

          return {
            success: false,
            error,
            submissionTime: Date.now() - startTime,
            submittedAt: new Date(),
          };
        }
      }

      // Submit job with retry logic
      const result = await this.submitJobWithRetry(request);

      return {
        ...result,
        submissionTime: Date.now() - startTime,
        submittedAt: new Date(),
      };
    } catch (error) {
      const submissionError = createSubmissionError(
        'UNKNOWN_ERROR',
        `Unexpected error during job submission: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      return {
        success: false,
        error: submissionError,
        submissionTime: Date.now() - startTime,
        submittedAt: new Date(),
      };
    }
  }

  /**
   * Submit job with retry logic
   */
  private async submitJobWithRetry(
    request: CreateTranscriptionJobRequest,
  ): Promise<Omit<JobSubmissionResult, 'submissionTime' | 'submittedAt'>> {
    let lastError: JobSubmissionError | undefined;

    for (let attempt = 1; attempt <= this.submissionConfig.maxRetryAttempts; attempt++) {
      try {
        const result = await this.performJobSubmission(request);

        if (result.success) {
          return result;
        }

        lastError = result.error;

        // If error is not retryable, break immediately
        if (!result.error?.retryable) {
          break;
        }

        // If this is not the last attempt, wait before retrying
        if (attempt < this.submissionConfig.maxRetryAttempts) {
          const delay =
            result.error.retryAfter ||
            calculateBackoffDelay(attempt, this.submissionConfig.retryBaseDelay, this.submissionConfig.retryMaxDelay);

          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        lastError = createSubmissionError(
          'UNKNOWN_ERROR',
          `Attempt ${attempt} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    return {
      success: false,
      error: lastError || createSubmissionError('UNKNOWN_ERROR', 'All retry attempts failed'),
    };
  }

  /**
   * Perform the actual job submission to Azure
   */
  private async performJobSubmission(
    request: CreateTranscriptionJobRequest,
  ): Promise<Omit<JobSubmissionResult, 'submissionTime' | 'submittedAt'>> {
    const endpoint = BATCH_TRANSCRIPTION_ENDPOINTS[this.authConfig.serviceRegion as AzureRegion];

    if (!endpoint) {
      const error = createSubmissionError(
        'UNKNOWN_ERROR',
        `No batch transcription endpoint found for region: ${this.authConfig.serviceRegion}`,
      );

      return { success: false, error };
    }

    // Generate job ID
    const jobId = generateJobId(this.submissionConfig.jobIdPrefix);

    // Create batch configuration
    const batchConfig = createBatchConfig(request.audioUrl, request.config, `Meeting Transcription ${jobId}`);

    // Prepare API request
    const apiUrl = `${endpoint}/speechtotext/v3.0/transcriptions`;
    const requestBody = {
      contentUrls: [batchConfig.audioUrl],
      locale: batchConfig.language,
      displayName: batchConfig.displayName,
      description: batchConfig.description,
      properties: batchConfig.properties,
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.submissionConfig.timeout);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': this.authConfig.subscriptionKey,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorType: JobSubmissionErrorType;
        let retryable = false;
        let retryAfter: number | undefined;

        switch (response.status) {
          case 400:
            errorType = 'INVALID_AUDIO_URL';
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

        const error = createSubmissionError(
          errorType,
          `Azure API error: HTTP ${response.status} ${response.statusText}`,
          response.status,
          retryable,
          retryAfter,
          azureError,
        );

        return { success: false, error };
      }

      // Parse successful response
      const azureJob: BatchTranscriptionJob = await response.json();

      // Create our transcription job object
      const extractedId = azureJob.self.split('/').pop();
      const transcriptionJob: TranscriptionJob = {
        jobId,
        audioUrl: request.audioUrl,
        status: mapAzureJobStatus(azureJob.status),
        progress: azureJob.status === 'NotStarted' ? 0 : 10, // Initial progress
        submittedAt: new Date(),
        config: request.config,
        retryCount: 0,
        ...(extractedId && { azureJobId: extractedId }),
      };

      return {
        success: true,
        job: transcriptionJob,
        azureJob,
      };
    } catch (error) {
      let errorType: JobSubmissionErrorType;
      let retryable = false;

      if (error instanceof Error && error.name === 'AbortError') {
        errorType = 'TIMEOUT';
        retryable = true;
      } else {
        errorType = 'NETWORK_ERROR';
        retryable = true;
      }

      const submissionError = createSubmissionError(
        errorType,
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        retryable,
      );

      return { success: false, error: submissionError };
    }
  }

  /**
   * Submit multiple jobs concurrently
   */
  async submitBatchJobs(
    requests: CreateTranscriptionJobRequest[],
    accessToken?: string,
    concurrencyLimit: number = 5,
  ): Promise<JobSubmissionResult[]> {
    // Process jobs in batches to avoid overwhelming the API
    const results: JobSubmissionResult[] = [];

    for (let i = 0; i < requests.length; i += concurrencyLimit) {
      const batch = requests.slice(i, i + concurrencyLimit);

      const batchPromises = batch.map(request => this.submitJob(request, accessToken));

      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          // Handle rejected promise
          const error = createSubmissionError('UNKNOWN_ERROR', `Batch job ${i + index} failed: ${result.reason}`);

          results.push({
            success: false,
            error,
            submissionTime: 0,
            submittedAt: new Date(),
          });
        }
      });

      // Add delay between batches to avoid rate limiting
      if (i + concurrencyLimit < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
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
   * Update submission configuration
   */
  updateSubmissionConfig(config: Partial<JobSubmissionConfig>): void {
    this.submissionConfig = { ...this.submissionConfig, ...config };
  }

  /**
   * Get current configuration
   */
  getConfiguration(): {
    authConfig: AuthConfig;
    submissionConfig: JobSubmissionConfig;
    hasAccessToken: boolean;
  } {
    return {
      authConfig: { ...this.authConfig },
      submissionConfig: { ...this.submissionConfig },
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

    const endpoint = BATCH_TRANSCRIPTION_ENDPOINTS[this.authConfig.serviceRegion as AzureRegion];

    if (!endpoint) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: `No endpoint found for region: ${this.authConfig.serviceRegion}`,
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
