/**
 * Speech configuration builder for Azure Speech SDK
 * Centralizes Azure Speech SDK configuration with subscription key and region management
 * Provides language selection and output format configuration
 */

import type { AzureSpeechConfig, AzureRegion, TranscriptionConfig, RecognitionMode, ProfanityOption } from '../types';

/**
 * Speech configuration builder class
 */
export class SpeechConfigBuilder {
  private config: AzureSpeechConfig;
  private transcriptionConfig?: TranscriptionConfig;

  constructor(subscriptionKey: string, serviceRegion: AzureRegion) {
    this.config = {
      subscriptionKey,
      serviceRegion,
      language: 'en-US', // Default language
      enableLogging: false,
    };
  }

  /**
   * Set the primary language for speech recognition
   */
  setLanguage(language: string): SpeechConfigBuilder {
    this.config.language = language;
    return this;
  }

  /**
   * Set custom endpoint URL
   */
  setEndpoint(endpoint: string): SpeechConfigBuilder {
    this.config.endpoint = endpoint;
    return this;
  }

  /**
   * Enable or disable SDK logging
   */
  setLogging(enabled: boolean): SpeechConfigBuilder {
    this.config.enableLogging = enabled;
    return this;
  }

  /**
   * Set transcription-specific configuration
   */
  setTranscriptionConfig(config: TranscriptionConfig): SpeechConfigBuilder {
    this.transcriptionConfig = config;
    return this;
  }

  /**
   * Build the final Azure Speech SDK configuration
   */
  build(): AzureSpeechConfig {
    // Apply transcription config if provided
    if (this.transcriptionConfig) {
      this.config.language = this.transcriptionConfig.language;
    }

    return { ...this.config };
  }

  /**
   * Get configuration for Azure Speech SDK initialization
   */
  getSDKConfig(): {
    subscriptionKey: string;
    region: string;
    language: string;
    endpoint?: string;
  } {
    return {
      subscriptionKey: this.config.subscriptionKey,
      region: this.config.serviceRegion,
      language: this.config.language,
      ...(this.config.endpoint && { endpoint: this.config.endpoint }),
    };
  }
}

/**
 * Factory function to create SpeechConfigBuilder
 */
export const createSpeechConfig = (subscriptionKey: string, region: AzureRegion): SpeechConfigBuilder =>
  new SpeechConfigBuilder(subscriptionKey, region);

/**
 * Default speech configuration presets
 */
export const SpeechConfigPresets = {
  /**
   * High accuracy configuration for meeting transcription
   */
  MEETING_TRANSCRIPTION: {
    recognitionMode: 'Conversation' as RecognitionMode,
    enableSpeakerDiarization: true,
    enableProfanityFilter: true,
    outputFormat: 'detailed' as const,
    confidenceThreshold: 0.7,
    profanityOption: 'Masked' as ProfanityOption,
  },

  /**
   * Fast processing configuration for quick transcription
   */
  FAST_TRANSCRIPTION: {
    recognitionMode: 'Interactive' as RecognitionMode,
    enableSpeakerDiarization: false,
    enableProfanityFilter: false,
    outputFormat: 'simple' as const,
    confidenceThreshold: 0.5,
    profanityOption: 'None' as ProfanityOption,
  },

  /**
   * High quality configuration for important recordings
   */
  HIGH_QUALITY: {
    recognitionMode: 'Dictation' as RecognitionMode,
    enableSpeakerDiarization: true,
    enableProfanityFilter: true,
    outputFormat: 'detailed' as const,
    confidenceThreshold: 0.8,
    profanityOption: 'Removed' as ProfanityOption,
  },
} as const;

/**
 * Language configuration presets
 */
export const LanguagePresets = {
  ENGLISH_US: 'en-US',
  ENGLISH_UK: 'en-GB',
  CHINESE_SIMPLIFIED: 'zh-CN',
  CHINESE_TRADITIONAL: 'zh-TW',
  JAPANESE: 'ja-JP',
  KOREAN: 'ko-KR',
  SPANISH: 'es-ES',
  FRENCH: 'fr-FR',
  GERMAN: 'de-DE',
  ITALIAN: 'it-IT',
  PORTUGUESE: 'pt-BR',
  RUSSIAN: 'ru-RU',
} as const;

/**
 * Regional endpoint mapping
 */
export const RegionalEndpoints = {
  eastus: 'https://eastus.api.cognitive.microsoft.com',
  westus: 'https://westus.api.cognitive.microsoft.com',
  westus2: 'https://westus2.api.cognitive.microsoft.com',
  eastus2: 'https://eastus2.api.cognitive.microsoft.com',
  centralus: 'https://centralus.api.cognitive.microsoft.com',
  northcentralus: 'https://northcentralus.api.cognitive.microsoft.com',
  southcentralus: 'https://southcentralus.api.cognitive.microsoft.com',
  westcentralus: 'https://westcentralus.api.cognitive.microsoft.com',
  canadacentral: 'https://canadacentral.api.cognitive.microsoft.com',
  brazilsouth: 'https://brazilsouth.api.cognitive.microsoft.com',
  eastasia: 'https://eastasia.api.cognitive.microsoft.com',
  southeastasia: 'https://southeastasia.api.cognitive.microsoft.com',
  japaneast: 'https://japaneast.api.cognitive.microsoft.com',
  japanwest: 'https://japanwest.api.cognitive.microsoft.com',
  koreacentral: 'https://koreacentral.api.cognitive.microsoft.com',
  australiaeast: 'https://australiaeast.api.cognitive.microsoft.com',
  centralindia: 'https://centralindia.api.cognitive.microsoft.com',
  uksouth: 'https://uksouth.api.cognitive.microsoft.com',
  francecentral: 'https://francecentral.api.cognitive.microsoft.com',
  northeurope: 'https://northeurope.api.cognitive.microsoft.com',
  westeurope: 'https://westeurope.api.cognitive.microsoft.com',
} as const;

/**
 * Validate speech configuration
 */
export const validateSpeechConfig = (
  config: AzureSpeechConfig,
): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];

  // Validate subscription key
  if (!config.subscriptionKey || config.subscriptionKey.trim().length === 0) {
    errors.push('Subscription key is required');
  } else if (config.subscriptionKey.length !== 32) {
    errors.push('Subscription key must be 32 characters long');
  }

  // Validate region
  if (!config.serviceRegion) {
    errors.push('Region is required');
  } else if (!(config.serviceRegion in RegionalEndpoints)) {
    errors.push(`Unsupported region: ${config.serviceRegion}`);
  }

  // Validate language
  if (!config.language) {
    errors.push('Language is required');
  } else if (!/^[a-z]{2}-[A-Z]{2}$/.test(config.language)) {
    errors.push('Language must be in format "xx-XX" (e.g., "en-US")');
  }

  // Validate endpoint if provided
  if (config.endpoint) {
    try {
      new URL(config.endpoint);
    } catch {
      errors.push('Invalid endpoint URL format');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Get optimal region based on user location (placeholder implementation)
 */
export const getOptimalRegion = (): AzureRegion =>
  // In a real implementation, this would use geolocation or network latency tests
  // For now, return a sensible default
  'eastus';

/**
 * Configuration utilities
 */
export const ConfigUtils = {
  /**
   * Create configuration for multi-language support
   */
  createMultiLanguageConfig(primaryLanguage: string): TranscriptionConfig {
    return {
      language: primaryLanguage,
      enableSpeakerDiarization: true,
      enableProfanityFilter: true,
      outputFormat: 'detailed',
      confidenceThreshold: 0.6,
      customVocabulary: [], // Could be populated with multi-language terms
      recognitionMode: 'Conversation',
    };
  },

  /**
   * Create configuration optimized for meeting recordings
   */
  createMeetingConfig(language: string = 'en-US'): TranscriptionConfig {
    return {
      ...SpeechConfigPresets.MEETING_TRANSCRIPTION,
      language,
      maxSpeakers: 10, // Typical meeting size
      customVocabulary: [
        // Common meeting terms
        'SharePoint',
        'Teams',
        'Outlook',
        'PowerPoint',
        'Excel',
        'agenda',
        'action items',
        'follow up',
        'Q&A',
        'breakout',
      ],
    };
  },

  /**
   * Merge user preferences with default configuration
   */
  mergeWithDefaults(
    userConfig: Partial<TranscriptionConfig>,
    defaults = SpeechConfigPresets.MEETING_TRANSCRIPTION,
  ): TranscriptionConfig {
    const baseConfig = {
      language: 'en-US', // Default language
      enableSpeakerDiarization: false,
      enableProfanityFilter: false,
      outputFormat: 'detailed' as const,
      confidenceThreshold: 0.5,
    };

    const mergedConfig = {
      ...baseConfig,
      ...defaults,
      ...userConfig,
    };

    // Apply critical safety overrides
    return {
      ...mergedConfig,
      enableProfanityFilter:
        userConfig.enableProfanityFilter ?? defaults.enableProfanityFilter ?? baseConfig.enableProfanityFilter,
      confidenceThreshold: Math.max(
        userConfig.confidenceThreshold ?? defaults.confidenceThreshold ?? baseConfig.confidenceThreshold,
        0.3,
      ),
    };
  },
};
