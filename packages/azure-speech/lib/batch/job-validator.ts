/**
 * Azure Speech batch transcription job validator
 * Validates audio URLs, format compatibility, and Azure service limits
 * for meeting transcription processing
 */

import type {
  TranscriptionConfig,
  CreateTranscriptionJobRequest,
  AudioFormat,
  BatchTranscriptionConfig,
} from '../types/index';

/**
 * Job validation result
 */
export interface _JobValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Job validation error types
 */
export type JobValidationErrorType =
  | 'INVALID_AUDIO_URL'
  | 'UNSUPPORTED_FORMAT'
  | 'FILE_TOO_LARGE'
  | 'DURATION_TOO_LONG'
  | 'INVALID_LANGUAGE'
  | 'INVALID_CONFIG'
  | 'NETWORK_UNREACHABLE'
  | 'AUTHENTICATION_REQUIRED'
  | 'QUOTA_EXCEEDED'
  | 'CONCURRENT_LIMIT'
  | 'UNSUPPORTED_ENCODING';

/**
 * Job validation error
 */
export interface JobValidationError {
  /** Error type */
  type: JobValidationErrorType;
  /** Error message */
  message: string;
  /** Field that caused the error */
  field?: string;
  /** Additional error context */
  context?: Record<string, unknown>;
}

/**
 * Job validation result
 */
export interface JobValidationResult {
  /** Whether validation passed */
  isValid: boolean;
  /** Validation errors */
  errors: JobValidationError[];
  /** Validation warnings */
  warnings: string[];
  /** Estimated file size in bytes */
  estimatedSize?: number;
  /** Estimated duration in seconds */
  estimatedDuration?: number;
  /** Audio format information */
  audioInfo?: AudioFileInfo;
  /** Validation timestamp */
  validatedAt: Date;
}

/**
 * Audio file information
 */
export interface AudioFileInfo {
  /** File format */
  format: AudioFormat;
  /** MIME type */
  mimeType: string;
  /** File size in bytes */
  size?: number;
  /** Duration in seconds */
  duration?: number;
  /** Sample rate in Hz */
  sampleRate?: number;
  /** Number of channels */
  channels?: number;
  /** Bit rate in kbps */
  bitRate?: number;
  /** Encoding information */
  encoding?: string;
}

/**
 * Azure Speech service limits
 */
const AZURE_LIMITS = {
  /** Maximum file size in bytes (1 GB) */
  MAX_FILE_SIZE: 1024 * 1024 * 1024,
  /** Maximum audio duration in seconds (4 hours) */
  MAX_DURATION: 4 * 60 * 60,
  /** Maximum concurrent jobs per subscription */
  MAX_CONCURRENT_JOBS: 200,
  /** Supported audio formats */
  SUPPORTED_FORMATS: ['wav', 'mp3', 'mp4', 'flac', 'ogg', 'webm'] as AudioFormat[],
  /** Supported sample rates */
  SUPPORTED_SAMPLE_RATES: [8000, 16000, 22050, 44100, 48000],
  /** Maximum speakers for diarization */
  MAX_SPEAKERS: 10,
  /** Minimum confidence threshold */
  MIN_CONFIDENCE: 0.0,
  /** Maximum confidence threshold */
  MAX_CONFIDENCE: 1.0,
  /** Maximum custom vocabulary size */
  MAX_VOCABULARY_SIZE: 5000,
} as const;

/**
 * Supported MIME types mapping
 */
const MIME_TYPE_MAP: Record<AudioFormat, string[]> = {
  wav: ['audio/wav', 'audio/wave', 'audio/x-wav'],
  mp3: ['audio/mpeg', 'audio/mp3'],
  mp4: ['audio/mp4', 'audio/x-m4a', 'video/mp4'],
  flac: ['audio/flac', 'audio/x-flac'],
  ogg: ['audio/ogg', 'audio/vorbis'],
  webm: ['audio/webm'],
};

/**
 * Language validation regex patterns
 */
const LANGUAGE_PATTERNS = {
  /** Standard language codes (e.g., en-US, zh-CN) */
  STANDARD: /^[a-z]{2}-[A-Z]{2}$/,
  /** Azure supported languages */
  SUPPORTED: [
    'ar-EG',
    'ar-SA',
    'bg-BG',
    'ca-ES',
    'cs-CZ',
    'da-DK',
    'de-DE',
    'el-GR',
    'en-AU',
    'en-CA',
    'en-GB',
    'en-IN',
    'en-NZ',
    'en-US',
    'es-ES',
    'es-MX',
    'et-EE',
    'fi-FI',
    'fr-CA',
    'fr-FR',
    'he-IL',
    'hi-IN',
    'hr-HR',
    'hu-HU',
    'it-IT',
    'ja-JP',
    'ko-KR',
    'lt-LT',
    'lv-LV',
    'nb-NO',
    'nl-NL',
    'pl-PL',
    'pt-BR',
    'pt-PT',
    'ro-RO',
    'ru-RU',
    'sk-SK',
    'sl-SI',
    'sv-SE',
    'th-TH',
    'tr-TR',
    'uk-UA',
    'zh-CN',
    'zh-HK',
    'zh-TW',
  ],
};

/**
 * URL validation utilities
 */
const UrlValidator = {
  /**
   * Validate URL format and accessibility
   */
  validateUrl(url: string): JobValidationError[] {
    const errors: JobValidationError[] = [];

    if (!url || typeof url !== 'string') {
      errors.push({
        type: 'INVALID_AUDIO_URL',
        message: 'Audio URL is required and must be a string',
        field: 'audioUrl',
      });
      return errors;
    }

    // Basic URL format validation
    try {
      const urlObj = new URL(url);

      // Check protocol
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        errors.push({
          type: 'INVALID_AUDIO_URL',
          message: 'Audio URL must use HTTP or HTTPS protocol',
          field: 'audioUrl',
          context: { protocol: urlObj.protocol },
        });
      }

      // Check for SharePoint/Teams patterns
      if (!this.isSharePointUrl(url) && !this.isTeamsUrl(url)) {
        errors.push({
          type: 'INVALID_AUDIO_URL',
          message: 'Audio URL must be from SharePoint or Teams',
          field: 'audioUrl',
          context: { hostname: urlObj.hostname },
        });
      }
    } catch (error) {
      errors.push({
        type: 'INVALID_AUDIO_URL',
        message: 'Invalid URL format',
        field: 'audioUrl',
        context: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
    }

    return errors;
  },

  /**
   * Check if URL is from SharePoint
   */
  isSharePointUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return (
        urlObj.hostname.includes('sharepoint.com') ||
        urlObj.hostname.includes('sharepoint.') ||
        urlObj.pathname.includes('/_layouts/')
      );
    } catch {
      return false;
    }
  },

  /**
   * Check if URL is from Teams
   */
  isTeamsUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return (
        urlObj.hostname.includes('teams.microsoft.com') ||
        urlObj.hostname.includes('teams.live.com') ||
        urlObj.pathname.includes('/teams/')
      );
    } catch {
      return false;
    }
  },

  /**
   * Extract file extension from URL
   */
  extractFileExtension(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const lastDot = pathname.lastIndexOf('.');

      if (lastDot > -1) {
        return pathname.substring(lastDot + 1).toLowerCase();
      }
    } catch {
      // URL parsing failed
    }

    return null;
  },
};

/**
 * Audio format validation utilities
 */
const FormatValidator = {
  /**
   * Validate audio format compatibility
   */
  validateFormat(url: string): { errors: JobValidationError[]; format?: AudioFormat } {
    const errors: JobValidationError[] = [];

    const extension = UrlValidator.extractFileExtension(url);

    if (!extension) {
      errors.push({
        type: 'UNSUPPORTED_FORMAT',
        message: 'Unable to determine audio format from URL',
        field: 'audioUrl',
      });
      return { errors };
    }

    const format = extension as AudioFormat;

    if (!AZURE_LIMITS.SUPPORTED_FORMATS.includes(format)) {
      errors.push({
        type: 'UNSUPPORTED_FORMAT',
        message: `Audio format '${extension}' is not supported. Supported formats: ${AZURE_LIMITS.SUPPORTED_FORMATS.join(', ')}`,
        field: 'audioUrl',
        context: { detectedFormat: extension, supportedFormats: AZURE_LIMITS.SUPPORTED_FORMATS },
      });
      return { errors };
    }

    return { errors, format };
  },

  /**
   * Get MIME type for format
   */
  getMimeType(format: AudioFormat): string {
    const mimeTypes = MIME_TYPE_MAP[format];
    return (mimeTypes && mimeTypes[0]) || 'application/octet-stream';
  },

  /**
   * Estimate file size based on duration and format
   */
  estimateFileSize(duration: number, format: AudioFormat, sampleRate: number = 44100, channels: number = 2): number {
    // Rough estimates based on typical encoding
    const estimates: Record<AudioFormat, number> = {
      wav: (sampleRate * channels * 16) / 8, // 16-bit PCM
      mp3: (128 * 1000) / 8, // 128 kbps
      mp4: (128 * 1000) / 8, // 128 kbps AAC
      flac: ((sampleRate * channels * 16) / 8) * 0.6, // ~60% of WAV
      ogg: (128 * 1000) / 8, // 128 kbps Vorbis
      webm: (128 * 1000) / 8, // 128 kbps Opus
    };

    const bytesPerSecond = estimates[format] || estimates.mp3;
    return Math.round(duration * bytesPerSecond);
  },
};

/**
 * Configuration validation utilities
 */
const ConfigValidator = {
  /**
   * Validate transcription configuration
   */
  validateConfig(config: TranscriptionConfig): JobValidationError[] {
    const errors: JobValidationError[] = [];

    // Language validation
    if (!config.language) {
      errors.push({
        type: 'INVALID_LANGUAGE',
        message: 'Language is required',
        field: 'config.language',
      });
    } else if (!LANGUAGE_PATTERNS.STANDARD.test(config.language)) {
      errors.push({
        type: 'INVALID_LANGUAGE',
        message: 'Language must be in format "xx-XX" (e.g., "en-US")',
        field: 'config.language',
        context: { providedLanguage: config.language },
      });
    } else if (!LANGUAGE_PATTERNS.SUPPORTED.includes(config.language)) {
      errors.push({
        type: 'INVALID_LANGUAGE',
        message: `Language '${config.language}' is not supported by Azure Speech`,
        field: 'config.language',
        context: {
          providedLanguage: config.language,
          supportedLanguages: LANGUAGE_PATTERNS.SUPPORTED.slice(0, 10), // Show first 10
        },
      });
    }

    // Confidence threshold validation
    if (
      config.confidenceThreshold < AZURE_LIMITS.MIN_CONFIDENCE ||
      config.confidenceThreshold > AZURE_LIMITS.MAX_CONFIDENCE
    ) {
      errors.push({
        type: 'INVALID_CONFIG',
        message: `Confidence threshold must be between ${AZURE_LIMITS.MIN_CONFIDENCE} and ${AZURE_LIMITS.MAX_CONFIDENCE}`,
        field: 'config.confidenceThreshold',
        context: {
          provided: config.confidenceThreshold,
          min: AZURE_LIMITS.MIN_CONFIDENCE,
          max: AZURE_LIMITS.MAX_CONFIDENCE,
        },
      });
    }

    // Speaker diarization validation
    if (config.enableSpeakerDiarization && config.maxSpeakers) {
      if (config.maxSpeakers < 2 || config.maxSpeakers > AZURE_LIMITS.MAX_SPEAKERS) {
        errors.push({
          type: 'INVALID_CONFIG',
          message: `Maximum speakers must be between 2 and ${AZURE_LIMITS.MAX_SPEAKERS}`,
          field: 'config.maxSpeakers',
          context: {
            provided: config.maxSpeakers,
            min: 2,
            max: AZURE_LIMITS.MAX_SPEAKERS,
          },
        });
      }
    }

    // Custom vocabulary validation
    if (config.customVocabulary && config.customVocabulary.length > AZURE_LIMITS.MAX_VOCABULARY_SIZE) {
      errors.push({
        type: 'INVALID_CONFIG',
        message: `Custom vocabulary cannot exceed ${AZURE_LIMITS.MAX_VOCABULARY_SIZE} entries`,
        field: 'config.customVocabulary',
        context: {
          provided: config.customVocabulary.length,
          max: AZURE_LIMITS.MAX_VOCABULARY_SIZE,
        },
      });
    }

    return errors;
  },
};

/**
 * File size and duration estimation utilities
 */
const SizeEstimator = {
  /**
   * Estimate audio file properties from URL
   */
  async estimateFileProperties(url: string): Promise<{
    size?: number;
    duration?: number;
    error?: string;
  }> {
    try {
      // For now, we'll use HEAD request to get file size
      // In a real implementation, you might want to use additional methods
      // to determine duration without downloading the entire file
      const response = await fetch(url, { method: 'HEAD' });

      if (!response.ok) {
        return { error: `HTTP ${response.status}: ${response.statusText}` };
      }

      const contentLength = response.headers.get('content-length');
      const size = contentLength ? parseInt(contentLength, 10) : undefined;

      // For duration estimation, we'd need to either:
      // 1. Read audio metadata (requires partial download)
      // 2. Use a separate service
      // 3. Estimate based on file size and format
      // For now, we'll provide a rough estimate based on size and format

      let duration: number | undefined;
      if (size) {
        const contentType = response.headers.get('content-type') || '';
        const estimatedFormat = this.guessFormatFromMimeType(contentType);
        if (estimatedFormat) {
          duration = this.estimateDurationFromSize(size, estimatedFormat);
        }
      }

      return {
        ...(size !== undefined && { size }),
        ...(duration !== undefined && { duration }),
      };
    } catch (error) {
      return {
        error: `Failed to fetch file information: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },

  /**
   * Guess audio format from MIME type
   */
  guessFormatFromMimeType(mimeType: string): AudioFormat | null {
    const normalizedMimeType = mimeType.toLowerCase();

    for (const [format, mimeTypes] of Object.entries(MIME_TYPE_MAP)) {
      if (mimeTypes.some(type => normalizedMimeType.includes(type))) {
        return format as AudioFormat;
      }
    }

    return null;
  },

  /**
   * Estimate duration from file size and format
   */
  estimateDurationFromSize(size: number, format: AudioFormat): number {
    // Rough estimates - in practice, you'd want more sophisticated analysis
    const bytesPerSecond: Record<AudioFormat, number> = {
      wav: 176400, // 44.1kHz stereo 16-bit
      mp3: 16000, // 128 kbps
      mp4: 16000, // 128 kbps AAC
      flac: 105840, // ~60% of WAV
      ogg: 16000, // 128 kbps Vorbis
      webm: 16000, // 128 kbps Opus
    };

    const bps = bytesPerSecond[format] || bytesPerSecond.mp3;
    return Math.round(size / bps);
  },
};

/**
 * Azure Speech batch transcription job validator
 */
export class JobValidator {
  /**
   * Validate a transcription job request
   */
  static async validateJob(request: CreateTranscriptionJobRequest): Promise<JobValidationResult> {
    const errors: JobValidationError[] = [];
    const warnings: string[] = [];
    let estimatedSize: number | undefined;
    let estimatedDuration: number | undefined;
    let audioInfo: AudioFileInfo | undefined;

    // Validate audio URL
    const urlErrors = UrlValidator.validateUrl(request.audioUrl);
    errors.push(...urlErrors);

    // Validate audio format
    const { errors: formatErrors, format } = FormatValidator.validateFormat(request.audioUrl);
    errors.push(...formatErrors);

    // Validate configuration
    const configErrors = ConfigValidator.validateConfig(request.config);
    errors.push(...configErrors);

    // If basic validation passed, attempt to get file information
    if (errors.length === 0 && format) {
      try {
        const fileProps = await SizeEstimator.estimateFileProperties(request.audioUrl);

        if (fileProps.error) {
          warnings.push(`Could not retrieve file information: ${fileProps.error}`);
        } else {
          estimatedSize = fileProps.size;
          estimatedDuration = fileProps.duration;

          // Check file size limits
          if (estimatedSize && estimatedSize > AZURE_LIMITS.MAX_FILE_SIZE) {
            errors.push({
              type: 'FILE_TOO_LARGE',
              message: `File size ${Math.round(estimatedSize / 1024 / 1024)}MB exceeds Azure limit of ${Math.round(AZURE_LIMITS.MAX_FILE_SIZE / 1024 / 1024)}MB`,
              field: 'audioUrl',
              context: {
                fileSize: estimatedSize,
                maxSize: AZURE_LIMITS.MAX_FILE_SIZE,
              },
            });
          }

          // Check duration limits
          if (estimatedDuration && estimatedDuration > AZURE_LIMITS.MAX_DURATION) {
            errors.push({
              type: 'DURATION_TOO_LONG',
              message: `Audio duration ${Math.round(estimatedDuration / 60)}min exceeds Azure limit of ${Math.round(AZURE_LIMITS.MAX_DURATION / 60)}min`,
              field: 'audioUrl',
              context: {
                duration: estimatedDuration,
                maxDuration: AZURE_LIMITS.MAX_DURATION,
              },
            });
          }

          // Create audio info
          audioInfo = {
            format,
            mimeType: FormatValidator.getMimeType(format),
            ...(estimatedSize !== undefined && { size: estimatedSize }),
            ...(estimatedDuration !== undefined && { duration: estimatedDuration }),
          };

          // Add warnings for large files
          if (estimatedSize && estimatedSize > AZURE_LIMITS.MAX_FILE_SIZE * 0.8) {
            warnings.push('File size is close to Azure limits - processing may take longer');
          }

          if (estimatedDuration && estimatedDuration > AZURE_LIMITS.MAX_DURATION * 0.8) {
            warnings.push('Audio duration is close to Azure limits - consider splitting into smaller segments');
          }
        }
      } catch (error) {
        warnings.push(
          `Failed to validate file properties: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      validatedAt: new Date(),
      ...(estimatedSize !== undefined && { estimatedSize }),
      ...(estimatedDuration !== undefined && { estimatedDuration }),
      ...(audioInfo && { audioInfo }),
    };
  }

  /**
   * Validate batch transcription configuration
   */
  static validateBatchConfig(config: BatchTranscriptionConfig): JobValidationResult {
    const errors: JobValidationError[] = [];
    const warnings: string[] = [];

    // Validate audio URL
    const urlErrors = UrlValidator.validateUrl(config.audioUrl);
    errors.push(...urlErrors);

    // Validate language
    if (!config.language) {
      errors.push({
        type: 'INVALID_LANGUAGE',
        message: 'Language is required',
        field: 'language',
      });
    } else if (!LANGUAGE_PATTERNS.SUPPORTED.includes(config.language)) {
      errors.push({
        type: 'INVALID_LANGUAGE',
        message: `Language '${config.language}' is not supported`,
        field: 'language',
      });
    }

    // Validate display name
    if (!config.displayName || config.displayName.trim().length === 0) {
      errors.push({
        type: 'INVALID_CONFIG',
        message: 'Display name is required',
        field: 'displayName',
      });
    } else if (config.displayName.length > 200) {
      errors.push({
        type: 'INVALID_CONFIG',
        message: 'Display name cannot exceed 200 characters',
        field: 'displayName',
      });
    }

    // Validate description length
    if (config.description && config.description.length > 1000) {
      warnings.push('Description is very long - consider shortening for better readability');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      validatedAt: new Date(),
    };
  }

  /**
   * Quick validation for audio URL only
   */
  static validateAudioUrl(url: string): JobValidationResult {
    const urlErrors = UrlValidator.validateUrl(url);
    const { errors: formatErrors } = FormatValidator.validateFormat(url);

    const errors = [...urlErrors, ...formatErrors];

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
      validatedAt: new Date(),
    };
  }

  /**
   * Get Azure Speech service limits
   */
  static getLimits(): typeof AZURE_LIMITS {
    return { ...AZURE_LIMITS };
  }

  /**
   * Get supported audio formats
   */
  static getSupportedFormats(): AudioFormat[] {
    return [...AZURE_LIMITS.SUPPORTED_FORMATS];
  }

  /**
   * Get supported languages
   */
  static getSupportedLanguages(): string[] {
    return [...LANGUAGE_PATTERNS.SUPPORTED];
  }
}
