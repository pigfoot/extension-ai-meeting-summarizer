/**
 * Azure Speech integration package for Meeting Summarizer Chrome Extension
 * Provides centralized API access for Azure Speech SDK integration
 * Exports all Azure Speech services and utilities
 */

// Internal imports for service implementation
import { AuthenticationHandler } from './auth/auth-handler';
import { JobValidator } from './batch/job-validator';
import { JobSubmitter } from './batch/job-submitter';
import { ProgressMonitor } from './batch/progress-monitor';
import { ResultRetriever } from './batch/result-retriever';
import { ErrorRecoveryService } from './errors/recovery-service';

// Type imports
import type { 
  TranscriptionJob,
  TranscriptionConfig
} from './types';
import type {
  AuthConfig
} from './types/auth';

// Core types
export type * from './types';
export type * from './types/auth';
export type * from './types/errors';

// Configuration and builders
export {
  SpeechConfigBuilder,
  createSpeechConfig,
  SpeechConfigPresets,
  LanguagePresets,
  RegionalEndpoints,
  validateSpeechConfig,
  getOptimalRegion,
  ConfigUtils,
} from './config/speech-config';

// Client management
export {
  AzureSpeechClient,
  SpeechClientFactory,
  createSpeechClient,
  createSpeechClientWithBuilder,
  ClientUtils,
} from './client/speech-client-factory';

export {
  SpeechClientManager,
  getClientManager,
  initializeGlobalClientManager,
  shutdownGlobalClientManager,
  ClientManagerUtils,
} from './client/speech-client-manager';

// Rate limiting utilities
export { AzureSpeechRateLimiter, getRateLimiter, resetGlobalRateLimiter, RateLimiterUtils } from './utils/rate-limiter';

// Authentication modules (Phase 3 - Complete)
export { CredentialValidator } from './auth/credential-validator';
export { TokenManager } from './auth/token-manager';
export { AuthenticationHandler } from './auth/auth-handler';
export { AuthErrorRecovery } from './auth/auth-recovery';

// Batch Transcription Service (Phase 4 - Complete)  
export { JobValidator } from './batch/job-validator';
export { JobSubmitter } from './batch/job-submitter';
export { ProgressMonitor } from './batch/progress-monitor';
export { ResultRetriever } from './batch/result-retriever';

// Batch Transcription Coordination (Phase 6 - Complete)
export { JobManager } from './batch/job-manager';
export { BatchTranscriptionService } from './batch/batch-transcription-service';

// Multi-language Support (Phase 6 - Complete) 
export { LanguageManager } from './language/language-manager';

// Error Recovery and Resilience (Phase 5 - Complete)
export { ErrorClassifier } from './errors/error-classifier';
export { RetryManager } from './errors/retry-manager';
export { CircuitBreaker } from './errors/circuit-breaker';
export { ErrorRecoveryService } from './errors/recovery-service';

// Legacy alias for backward compatibility
export { ErrorRecoveryService as ErrorRecoverySystem } from './errors/recovery-service';

/**
 * Main Azure Speech Integration Service
 * Provides high-level API for Azure Speech functionality
 */
export class AzureSpeechService {
  private clientManager?: any; // SpeechClientManager - keeping as any due to circular dependency
  private authHandler?: AuthenticationHandler;
  private jobValidator?: JobValidator;
  private jobSubmitter?: JobSubmitter;
  private progressMonitor?: ProgressMonitor;
  private resultRetriever?: ResultRetriever;
  private errorRecovery?: ErrorRecoveryService;

  constructor(config: unknown) {
    console.warn(
      'AzureSpeechService: Using partial implementation - Phase 4 batch transcription and Phase 5 error recovery completed',
    );
    this.initializeServices(config);
  }

  private initializeServices(config: unknown): void {
    // Initialize real services with proper type handling
    this.authHandler = new AuthenticationHandler();
    this.jobValidator = new JobValidator();
    this.jobSubmitter = new JobSubmitter(config as AuthConfig);
    this.progressMonitor = new ProgressMonitor(config as AuthConfig);
    this.resultRetriever = new ResultRetriever(config as AuthConfig);
    this.errorRecovery = new ErrorRecoveryService();
  }

  /**
   * Initialize the Azure Speech service
   */
  async initialize(): Promise<void> {
    console.warn('AzureSpeechService.initialize: Stub implementation');
    // In full implementation, this would:
    // 1. Initialize client manager
    // 2. Validate authentication
    // 3. Setup error recovery
    // 4. Test connectivity
  }

  /**
   * Start transcription of an audio URL
   */
  async startTranscription(
    audioUrl: string,
    config?: Partial<TranscriptionConfig>,
  ): Promise<{ jobId: string; status: string; message: string }> {
    try {
      if (!this.authHandler?.isAuthenticated()) {
        return {
          jobId: '',
          status: 'failed',
          message: 'Authentication required before starting transcription',
        };
      }

      if (!this.jobSubmitter) {
        return {
          jobId: '',
          status: 'failed',
          message: 'Job submitter not initialized',
        };
      }

      const defaultConfig = {
        language: 'en-US',
        enableSpeakerDiarization: true,
        enableProfanityFilter: false,
        outputFormat: 'detailed' as const,
        confidenceThreshold: 0.5,
      };

      const jobRequest = {
        audioUrl,
        config: { ...defaultConfig, ...config },
      };

      const result = await this.jobSubmitter.submitJob(jobRequest);

      if (result.success && result.job) {
        return {
          jobId: result.job.jobId,
          status: result.job.status,
          message: 'Transcription job submitted successfully',
        };
      } else {
        return {
          jobId: '',
          status: 'failed',
          message: result.error?.message || 'Failed to submit transcription job',
        };
      }
    } catch (error) {
      return {
        jobId: '',
        status: 'failed',
        message: `Error starting transcription: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get transcription status
   */
  async getTranscriptionStatus(
    azureJobId: string,
  ): Promise<{ jobId: string; status: string; progress: number; message: string }> {
    try {
      if (!this.progressMonitor) {
        return {
          jobId: azureJobId,
          status: 'failed',
          progress: 0,
          message: 'Progress monitor not initialized',
        };
      }

      const result = await this.progressMonitor.getJobProgress(azureJobId);

      if (result.success && result.progress) {
        return {
          jobId: result.progress.jobId || azureJobId,
          status: result.progress.status,
          progress: result.progress.progress,
          message: 'Status retrieved successfully',
        };
      } else {
        return {
          jobId: azureJobId,
          status: 'failed',
          progress: 0,
          message: result.error?.message || 'Failed to get transcription status',
        };
      }
    } catch (error) {
      return {
        jobId: azureJobId,
        status: 'failed',
        progress: 0,
        message: `Error getting transcription status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get transcription result
   */
  async getTranscriptionResult(job: TranscriptionJob): Promise<{
    jobId: string;
    text: string;
    confidence: number;
    speakers: unknown[];
    segments: unknown[];
    metadata: {
      audioFormat: string;
      sampleRate: number;
      channels: number;
      processingTime: number;
      language: string;
    };
  }> {
    try {
      if (!this.resultRetriever) {
        const jobId = job.jobId;
        return {
          jobId,
          text: 'Result retriever not initialized',
          confidence: 0,
          speakers: [],
          segments: [],
          metadata: {
            audioFormat: 'unknown',
            sampleRate: 0,
            channels: 0,
            processingTime: 0,
            language: 'en-US',
          },
        };
      }

      const result = await this.resultRetriever.retrieveResults(job);

      if (result.success && result.result) {
        return {
          jobId: result.result.jobId,
          text: result.result.text,
          confidence: result.result.confidence,
          speakers: result.result.speakers || [],
          segments: result.result.segments || [],
          metadata: result.result.metadata,
        };
      } else {
        const jobId = job.jobId;
        return {
          jobId,
          text: result.error?.message || 'Failed to retrieve transcription results',
          confidence: 0,
          speakers: [],
          segments: [],
          metadata: {
            audioFormat: 'unknown',
            sampleRate: 0,
            channels: 0,
            processingTime: 0,
            language: 'en-US',
          },
        };
      }
    } catch (error) {
      const jobId = job.jobId;
      return {
        jobId,
        text: `Error retrieving transcription result: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 0,
        speakers: [],
        segments: [],
        metadata: {
          audioFormat: 'unknown',
          sampleRate: 0,
          channels: 0,
          processingTime: 0,
          language: 'en-US',
        },
      };
    }
  }

  /**
   * Test Azure Speech service connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.authHandler?.isAuthenticated()) {
        return false;
      }

      if (!this.jobSubmitter) {
        return false;
      }

      const connectivityResult = await this.jobSubmitter.testConnectivity();
      return connectivityResult.success;
    } catch (error) {
      console.error('Error testing connection:', error);
      return false;
    }
  }

  /**
   * Validate Azure Speech configuration
   */
  validateConfiguration(config: unknown): { isValid: boolean; errors: string[] } {
    try {
      if (!this.authHandler) {
        return {
          isValid: false,
          errors: ['Authentication handler not initialized'],
        };
      }

      // Basic validation - in a real implementation, this would validate the config structure
      if (!config || typeof config !== 'object') {
        return {
          isValid: false,
          errors: ['Invalid configuration object'],
        };
      }

      return {
        isValid: true,
        errors: [],
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Configuration validation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      };
    }
  }

  /**
   * Dispose service and clean up resources
   */
  async dispose(): Promise<void> {
    try {
      // Clean up progress monitor
      if (this.progressMonitor) {
        this.progressMonitor.dispose();
        delete this.progressMonitor;
      }

      // Clean up authentication handler
      if (this.authHandler) {
        await this.authHandler.dispose();
        delete this.authHandler;
      }

      // Clean up other services
      delete this.jobValidator;
      delete this.jobSubmitter;
      delete this.resultRetriever;
      delete this.errorRecovery;
      delete this.clientManager;
    } catch (error) {
      console.error('Error during service disposal:', error);
    }
  }
}

// Convenience functions
export const createAzureSpeechService = (_config: unknown): AzureSpeechService => new AzureSpeechService(_config);

export const validateAzureConfig = (_config: unknown): boolean => (
  console.warn('validateAzureConfig: Stub implementation'),
  false
);

export const createSpeechClientConfig = (
  subscriptionKey: string,
  region: string,
): { subscriptionKey: string; region: string; language: string; enableLogging: boolean } => {
  console.warn('createSpeechClientConfig: Stub implementation');
  return {
    subscriptionKey,
    region,
    language: 'en-US',
    enableLogging: false,
  };
};

// Default export
export default AzureSpeechService;
