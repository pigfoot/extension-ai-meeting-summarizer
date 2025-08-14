/**
 * Azure Speech language manager
 * Implements multi-language support and detection with language-specific
 * configuration and formatting for mixed-language content
 */

import type { AzureRegion } from '../types/index';

/**
 * Supported Azure Speech languages with their configurations
 */
export interface LanguageConfig {
  /** Language code (e.g., 'en-US', 'zh-CN') */
  code: string;
  /** Human-readable language name */
  name: string;
  /** Native language name */
  nativeName: string;
  /** Azure Speech Service locale */
  locale: string;
  /** Primary region for this language */
  primaryRegion: AzureRegion;
  /** Alternative regions supporting this language */
  supportedRegions: AzureRegion[];
  /** Whether language supports speaker diarization */
  supportsSpeakerDiarization: boolean;
  /** Whether language supports custom models */
  supportsCustomModels: boolean;
  /** Text direction (ltr or rtl) */
  direction: 'ltr' | 'rtl';
  /** Language-specific formatting rules */
  formatting: {
    /** Decimal separator */
    decimalSeparator: string;
    /** Thousands separator */
    thousandsSeparator: string;
    /** Date format pattern */
    dateFormat: string;
    /** Time format pattern */
    timeFormat: string;
    /** Currency symbol */
    currencySymbol: string;
    /** Number formatting locale */
    numberLocale: string;
  };
  /** Language-specific speech recognition settings */
  speechSettings: {
    /** Confidence threshold for this language */
    confidenceThreshold: number;
    /** Language-specific profanity filtering rules */
    profanityRules: 'strict' | 'moderate' | 'lenient';
    /** Punctuation handling preferences */
    punctuationPreferences: string[];
    /** Common speech patterns and fillers */
    speechPatterns: string[];
  };
}

/**
 * Language detection result
 */
export interface LanguageDetectionResult {
  /** Detected language code */
  language: string;
  /** Detection confidence (0-1) */
  confidence: number;
  /** Alternative language candidates */
  alternatives: Array<{ language: string; confidence: number }>;
  /** Whether detection is reliable */
  reliable: boolean;
  /** Detection method used */
  method: 'content' | 'url' | 'metadata' | 'user_preference' | 'fallback';
  /** Additional detection metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Mixed language content segment
 */
export interface LanguageSegment {
  /** Segment text */
  text: string;
  /** Detected language */
  language: string;
  /** Start position in original text */
  startIndex: number;
  /** End position in original text */
  endIndex: number;
  /** Detection confidence */
  confidence: number;
  /** Whether segment needs translation */
  needsTranslation: boolean;
}

/**
 * Language formatting options
 */
export interface LanguageFormattingOptions {
  /** Target language for formatting */
  targetLanguage: string;
  /** Format numbers according to language rules */
  formatNumbers: boolean;
  /** Format dates according to language rules */
  formatDates: boolean;
  /** Apply language-specific punctuation */
  applyPunctuation: boolean;
  /** Handle right-to-left text */
  handleRTL: boolean;
  /** Preserve original formatting */
  preserveOriginal: boolean;
}

/**
 * Multi-language configuration
 */
export interface MultiLanguageConfig {
  /** Primary language for the content */
  primaryLanguage: string;
  /** Secondary languages to detect */
  secondaryLanguages: string[];
  /** Language detection threshold */
  detectionThreshold: number;
  /** Enable automatic language switching */
  autoLanguageSwitching: boolean;
  /** Enable mixed-language processing */
  enableMixedLanguage: boolean;
  /** Fallback language when detection fails */
  fallbackLanguage: string;
  /** Maximum number of languages per content */
  maxLanguagesPerContent: number;
}

/**
 * Comprehensive language support database
 */
const SUPPORTED_LANGUAGES: Record<string, LanguageConfig> = {
  'en-US': {
    code: 'en-US',
    name: 'English (United States)',
    nativeName: 'English (United States)',
    locale: 'en-US',
    primaryRegion: 'eastus',
    supportedRegions: ['eastus', 'westus', 'eastus2', 'westus2', 'centralus', 'northcentralus', 'southcentralus'],
    supportsSpeakerDiarization: true,
    supportsCustomModels: true,
    direction: 'ltr',
    formatting: {
      decimalSeparator: '.',
      thousandsSeparator: ',',
      dateFormat: 'MM/dd/yyyy',
      timeFormat: 'hh:mm:ss a',
      currencySymbol: '$',
      numberLocale: 'en-US',
    },
    speechSettings: {
      confidenceThreshold: 0.7,
      profanityRules: 'moderate',
      punctuationPreferences: ['.', ',', '?', '!', ';', ':'],
      speechPatterns: ['um', 'uh', 'like', 'you know', 'actually'],
    },
  },
  'en-GB': {
    code: 'en-GB',
    name: 'English (United Kingdom)',
    nativeName: 'English (United Kingdom)',
    locale: 'en-GB',
    primaryRegion: 'westeurope',
    supportedRegions: ['westeurope', 'northeurope', 'uksouth', 'ukwest'],
    supportsSpeakerDiarization: true,
    supportsCustomModels: true,
    direction: 'ltr',
    formatting: {
      decimalSeparator: '.',
      thousandsSeparator: ',',
      dateFormat: 'dd/MM/yyyy',
      timeFormat: 'HH:mm:ss',
      currencySymbol: '£',
      numberLocale: 'en-GB',
    },
    speechSettings: {
      confidenceThreshold: 0.7,
      profanityRules: 'moderate',
      punctuationPreferences: ['.', ',', '?', '!', ';', ':'],
      speechPatterns: ['erm', 'ah', 'right', 'you see', 'indeed'],
    },
  },
  'zh-CN': {
    code: 'zh-CN',
    name: 'Chinese (Mandarin, Simplified)',
    nativeName: '中文（简体）',
    locale: 'zh-CN',
    primaryRegion: 'eastasia',
    supportedRegions: ['eastasia', 'southeastasia'],
    supportsSpeakerDiarization: true,
    supportsCustomModels: true,
    direction: 'ltr',
    formatting: {
      decimalSeparator: '.',
      thousandsSeparator: ',',
      dateFormat: 'yyyy年MM月dd日',
      timeFormat: 'HH:mm:ss',
      currencySymbol: '¥',
      numberLocale: 'zh-CN',
    },
    speechSettings: {
      confidenceThreshold: 0.6,
      profanityRules: 'strict',
      punctuationPreferences: ['。', '，', '？', '！', '；', '：'],
      speechPatterns: ['那个', '就是', '然后', '嗯', '额'],
    },
  },
  'ja-JP': {
    code: 'ja-JP',
    name: 'Japanese',
    nativeName: '日本語',
    locale: 'ja-JP',
    primaryRegion: 'japaneast',
    supportedRegions: ['japaneast', 'japanwest'],
    supportsSpeakerDiarization: true,
    supportsCustomModels: true,
    direction: 'ltr',
    formatting: {
      decimalSeparator: '.',
      thousandsSeparator: ',',
      dateFormat: 'yyyy年MM月dd日',
      timeFormat: 'HH:mm:ss',
      currencySymbol: '¥',
      numberLocale: 'ja-JP',
    },
    speechSettings: {
      confidenceThreshold: 0.6,
      profanityRules: 'strict',
      punctuationPreferences: ['。', '、', '？', '！', '；', '：'],
      speechPatterns: ['あの', 'えっと', 'まあ', 'そう', 'はい'],
    },
  },
  'es-ES': {
    code: 'es-ES',
    name: 'Spanish (Spain)',
    nativeName: 'Español (España)',
    locale: 'es-ES',
    primaryRegion: 'westeurope',
    supportedRegions: ['westeurope', 'northeurope'],
    supportsSpeakerDiarization: true,
    supportsCustomModels: true,
    direction: 'ltr',
    formatting: {
      decimalSeparator: ',',
      thousandsSeparator: '.',
      dateFormat: 'dd/MM/yyyy',
      timeFormat: 'HH:mm:ss',
      currencySymbol: '€',
      numberLocale: 'es-ES',
    },
    speechSettings: {
      confidenceThreshold: 0.7,
      profanityRules: 'moderate',
      punctuationPreferences: ['.', ',', '¿', '?', '¡', '!', ';', ':'],
      speechPatterns: ['este', 'bueno', 'pues', 'eh', 'vale'],
    },
  },
  'fr-FR': {
    code: 'fr-FR',
    name: 'French (France)',
    nativeName: 'Français (France)',
    locale: 'fr-FR',
    primaryRegion: 'westeurope',
    supportedRegions: ['westeurope', 'northeurope', 'francecentral'],
    supportsSpeakerDiarization: true,
    supportsCustomModels: true,
    direction: 'ltr',
    formatting: {
      decimalSeparator: ',',
      thousandsSeparator: ' ',
      dateFormat: 'dd/MM/yyyy',
      timeFormat: 'HH:mm:ss',
      currencySymbol: '€',
      numberLocale: 'fr-FR',
    },
    speechSettings: {
      confidenceThreshold: 0.7,
      profanityRules: 'moderate',
      punctuationPreferences: ['.', ',', '?', '!', ';', ':', '«', '»'],
      speechPatterns: ['euh', 'alors', 'donc', 'ben', 'hein'],
    },
  },
  'de-DE': {
    code: 'de-DE',
    name: 'German (Germany)',
    nativeName: 'Deutsch (Deutschland)',
    locale: 'de-DE',
    primaryRegion: 'westeurope',
    supportedRegions: ['westeurope', 'northeurope', 'germanynorth'],
    supportsSpeakerDiarization: true,
    supportsCustomModels: true,
    direction: 'ltr',
    formatting: {
      decimalSeparator: ',',
      thousandsSeparator: '.',
      dateFormat: 'dd.MM.yyyy',
      timeFormat: 'HH:mm:ss',
      currencySymbol: '€',
      numberLocale: 'de-DE',
    },
    speechSettings: {
      confidenceThreshold: 0.7,
      profanityRules: 'moderate',
      punctuationPreferences: ['.', ',', '?', '!', ';', ':'],
      speechPatterns: ['äh', 'also', 'ja', 'nein', 'eben'],
    },
  },
  'ar-SA': {
    code: 'ar-SA',
    name: 'Arabic (Saudi Arabia)',
    nativeName: 'العربية (المملكة العربية السعودية)',
    locale: 'ar-SA',
    primaryRegion: 'uaenorth',
    supportedRegions: ['uaenorth'],
    supportsSpeakerDiarization: true,
    supportsCustomModels: false,
    direction: 'rtl',
    formatting: {
      decimalSeparator: '.',
      thousandsSeparator: ',',
      dateFormat: 'dd/MM/yyyy',
      timeFormat: 'HH:mm:ss',
      currencySymbol: 'ر.س',
      numberLocale: 'ar-SA',
    },
    speechSettings: {
      confidenceThreshold: 0.6,
      profanityRules: 'strict',
      punctuationPreferences: ['؟', '!', '؛', ':', '.', ','],
      speechPatterns: ['يعني', 'طيب', 'اه', 'لا', 'نعم'],
    },
  },
};

/**
 * Default multi-language configuration
 */
const DEFAULT_MULTI_LANGUAGE_CONFIG: MultiLanguageConfig = {
  primaryLanguage: 'en-US',
  secondaryLanguages: ['en-GB', 'es-ES', 'fr-FR', 'de-DE'],
  detectionThreshold: 0.7,
  autoLanguageSwitching: true,
  enableMixedLanguage: true,
  fallbackLanguage: 'en-US',
  maxLanguagesPerContent: 3,
};

/**
 * Language detection patterns
 */
const LANGUAGE_PATTERNS: Record<string, RegExp[]> = {
  'en-US': [/\b(the|and|or|but|in|on|at|to|for|of|with|by)\b/gi, /\b(hello|hi|yes|no|please|thank|you)\b/gi],
  'zh-CN': [/[\u4e00-\u9fff]+/g, /\b(的|是|在|了|有|我|你|他|她|它)\b/gi],
  'ja-JP': [/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]+/g, /\b(です|ます|ある|いる|する|なる)\b/gi],
  'es-ES': [/\b(el|la|los|las|un|una|y|o|pero|en|de|con|por)\b/gi, /\b(hola|sí|no|por favor|gracias)\b/gi],
  'fr-FR': [/\b(le|la|les|un|une|et|ou|mais|dans|de|avec|par)\b/gi, /\b(bonjour|oui|non|s'il vous plaît|merci)\b/gi],
  'de-DE': [/\b(der|die|das|ein|eine|und|oder|aber|in|von|mit|für)\b/gi, /\b(hallo|ja|nein|bitte|danke)\b/gi],
  'ar-SA': [/[\u0600-\u06ff]+/g, /\b(في|من|إلى|على|عن|مع|هذا|هذه|التي|الذي)\b/gi],
};

/**
 * Azure Speech language manager
 */
export class LanguageManager {
  private config: MultiLanguageConfig;
  private detectionCache = new Map<string, LanguageDetectionResult>();
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  constructor(config?: Partial<MultiLanguageConfig>) {
    this.config = { ...DEFAULT_MULTI_LANGUAGE_CONFIG, ...config };
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): LanguageConfig[] {
    return Object.values(SUPPORTED_LANGUAGES);
  }

  /**
   * Get language configuration
   */
  getLanguageConfig(languageCode: string): LanguageConfig | null {
    return SUPPORTED_LANGUAGES[languageCode] || null;
  }

  /**
   * Check if language is supported
   */
  isLanguageSupported(languageCode: string): boolean {
    return languageCode in SUPPORTED_LANGUAGES;
  }

  /**
   * Get languages supported in a specific region
   */
  getLanguagesForRegion(region: AzureRegion): LanguageConfig[] {
    return Object.values(SUPPORTED_LANGUAGES).filter(
      lang => lang.primaryRegion === region || lang.supportedRegions.includes(region),
    );
  }

  /**
   * Get optimal region for a language
   */
  getOptimalRegion(languageCode: string): AzureRegion | null {
    const config = this.getLanguageConfig(languageCode);
    return config?.primaryRegion || null;
  }

  /**
   * Detect language from text content
   */
  async detectLanguage(
    text: string,
    options?: {
      candidateLanguages?: string[];
      minConfidence?: number;
      maxAlternatives?: number;
    },
  ): Promise<LanguageDetectionResult> {
    const cacheKey = `${text.substring(0, 100)}-${JSON.stringify(options)}`;

    // Check cache
    const cached = this.detectionCache.get(cacheKey);
    if (
      cached &&
      cached.metadata &&
      typeof cached.metadata === 'object' &&
      'timestamp' in cached.metadata &&
      typeof cached.metadata.timestamp === 'number' &&
      Date.now() - cached.metadata.timestamp < this.CACHE_TTL
    ) {
      return cached;
    }

    const candidateLanguages = options?.candidateLanguages || Object.keys(SUPPORTED_LANGUAGES);
    const minConfidence = options?.minConfidence || this.config.detectionThreshold;
    const maxAlternatives = options?.maxAlternatives || 3;

    const scores: Array<{ language: string; score: number }> = [];

    // Pattern-based detection
    for (const language of candidateLanguages) {
      if (!this.isLanguageSupported(language)) continue;

      const patterns = LANGUAGE_PATTERNS[language] || [];
      let score = 0;
      let totalMatches = 0;

      for (const pattern of patterns) {
        const matches = text.match(pattern);
        if (matches) {
          totalMatches += matches.length;
        }
      }

      // Calculate score based on match density
      score = totalMatches / Math.max(text.split(/\s+/).length, 1);

      // Boost score for languages with special characters
      if (language === 'zh-CN' || language === 'ja-JP' || language === 'ar-SA') {
        const specialCharMatches = text.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\u0600-\u06ff]/g);
        if (specialCharMatches) {
          score += specialCharMatches.length / text.length;
        }
      }

      scores.push({ language, score });
    }

    // Sort by score
    scores.sort((a, b) => b.score - a.score);

    const topResult = scores[0];
    const confidence = Math.min(topResult?.score || 0, 1);
    const reliable = confidence >= minConfidence && topResult !== undefined;

    const result: LanguageDetectionResult = {
      language: reliable && topResult ? topResult.language : this.config.fallbackLanguage,
      confidence,
      alternatives: scores.slice(1, maxAlternatives + 1).map(s => ({
        language: s.language,
        confidence: Math.min(s.score, 1),
      })),
      reliable,
      method: 'content',
      metadata: {
        timestamp: Date.now(),
        textLength: text.length,
        candidateLanguages: candidateLanguages.length,
      },
    };

    // Cache result
    this.detectionCache.set(cacheKey, result);

    return result;
  }

  /**
   * Detect language from URL patterns
   */
  detectLanguageFromUrl(url: string): LanguageDetectionResult {
    // Common URL language patterns
    const urlPatterns: Record<string, RegExp> = {
      'zh-CN': /[\/\-\.](zh|cn|chinese)([\/\-\.]|$)/i,
      'ja-JP': /[\/\-\.](ja|jp|japanese)([\/\-\.]|$)/i,
      'es-ES': /[\/\-\.](es|spanish|spain)([\/\-\.]|$)/i,
      'fr-FR': /[\/\-\.](fr|french|france)([\/\-\.]|$)/i,
      'de-DE': /[\/\-\.](de|german|germany|deutsch)([\/\-\.]|$)/i,
      'ar-SA': /[\/\-\.](ar|arabic|saudi)([\/\-\.]|$)/i,
      'en-GB': /[\/\-\.](en-gb|uk|british)([\/\-\.]|$)/i,
      'en-US': /[\/\-\.](en|us|american|english)([\/\-\.]|$)/i,
    };

    for (const [language, pattern] of Object.entries(urlPatterns)) {
      if (pattern.test(url)) {
        return {
          language,
          confidence: 0.8,
          alternatives: [],
          reliable: true,
          method: 'url',
          metadata: { url, pattern: pattern.source },
        };
      }
    }

    return {
      language: this.config.fallbackLanguage,
      confidence: 0.3,
      alternatives: [],
      reliable: false,
      method: 'url',
      metadata: { url },
    };
  }

  /**
   * Detect mixed-language content segments
   */
  async detectMixedLanguageSegments(text: string): Promise<LanguageSegment[]> {
    if (!this.config.enableMixedLanguage) {
      const detection = await this.detectLanguage(text);
      return [
        {
          text,
          language: detection.language,
          startIndex: 0,
          endIndex: text.length,
          confidence: detection.confidence,
          needsTranslation: detection.language !== this.config.primaryLanguage,
        },
      ];
    }

    const segments: LanguageSegment[] = [];
    const sentences = text.split(/[.!?。！？]+/).filter(s => s.trim().length > 0);
    let currentIndex = 0;

    for (const sentence of sentences) {
      const detection = await this.detectLanguage(sentence.trim());
      const startIndex = text.indexOf(sentence, currentIndex);
      const endIndex = startIndex + sentence.length;

      segments.push({
        text: sentence.trim(),
        language: detection.language,
        startIndex,
        endIndex,
        confidence: detection.confidence,
        needsTranslation: detection.language !== this.config.primaryLanguage,
      });

      currentIndex = endIndex;
    }

    return segments;
  }

  /**
   * Format text according to language-specific rules
   */
  formatText(text: string, languageCode: string, options?: LanguageFormattingOptions): string {
    const config = this.getLanguageConfig(languageCode);
    if (!config) return text;

    const opts: LanguageFormattingOptions = {
      targetLanguage: languageCode,
      formatNumbers: true,
      formatDates: true,
      applyPunctuation: true,
      handleRTL: true,
      preserveOriginal: false,
      ...options,
    };

    let formattedText = text;

    // Format numbers
    if (opts.formatNumbers) {
      formattedText = this.formatNumbers(formattedText, config);
    }

    // Format dates
    if (opts.formatDates) {
      formattedText = this.formatDates(formattedText, config);
    }

    // Apply punctuation rules
    if (opts.applyPunctuation) {
      formattedText = this.applyPunctuationRules(formattedText, config);
    }

    // Handle RTL text
    if (opts.handleRTL && config.direction === 'rtl') {
      formattedText = this.handleRTLText(formattedText);
    }

    return formattedText;
  }

  /**
   * Format numbers according to language rules
   */
  private formatNumbers(text: string, config: LanguageConfig): string {
    const numberPattern = /\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\b/g;

    return text.replace(numberPattern, match => {
      const number = parseFloat(match.replace(/,/g, ''));
      if (isNaN(number)) return match;

      return new Intl.NumberFormat(config.formatting.numberLocale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(number);
    });
  }

  /**
   * Format dates according to language rules
   */
  private formatDates(text: string, config: LanguageConfig): string {
    const datePattern = /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/g;

    return text.replace(datePattern, match => {
      try {
        const date = new Date(match);
        if (isNaN(date.getTime())) return match;

        return new Intl.DateTimeFormat(config.locale).format(date);
      } catch {
        return match;
      }
    });
  }

  /**
   * Apply language-specific punctuation rules
   */
  private applyPunctuationRules(text: string, config: LanguageConfig): string {
    // This is a simplified implementation
    // In a real implementation, you would have more sophisticated rules

    if (config.code === 'es-ES') {
      // Add Spanish question marks
      text = text.replace(/(\s|^)([A-Z][^.!?]*\?)/g, '$1¿$2');
      text = text.replace(/(\s|^)([A-Z][^.!?]*!)/g, '$1¡$2');
    }

    if (config.code === 'fr-FR') {
      // Add French quotation marks
      text = text.replace(/"([^"]*)"/g, '« $1 »');
    }

    return text;
  }

  /**
   * Handle right-to-left text
   */
  private handleRTLText(text: string): string {
    // Add RTL markers for proper text direction
    return '\u202E' + text + '\u202C';
  }

  /**
   * Get speech configuration for language
   */
  getSpeechConfig(languageCode: string): {
    locale: string;
    confidenceThreshold: number;
    profanityAction: string;
    punctuationAction: string;
  } | null {
    const config = this.getLanguageConfig(languageCode);
    if (!config) return null;

    return {
      locale: config.locale,
      confidenceThreshold: config.speechSettings.confidenceThreshold,
      profanityAction: this.mapProfanityRules(config.speechSettings.profanityRules),
      punctuationAction: 'DictatedAndAutomatic',
    };
  }

  /**
   * Map profanity rules to Azure Speech actions
   */
  private mapProfanityRules(rules: 'strict' | 'moderate' | 'lenient'): string {
    switch (rules) {
      case 'strict':
        return 'Removed';
      case 'moderate':
        return 'Masked';
      case 'lenient':
        return 'None';
      default:
        return 'Masked';
    }
  }

  /**
   * Get language-specific speech patterns
   */
  getSpeechPatterns(languageCode: string): string[] {
    const config = this.getLanguageConfig(languageCode);
    return config?.speechSettings.speechPatterns || [];
  }

  /**
   * Update multi-language configuration
   */
  updateConfig(config: Partial<MultiLanguageConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): MultiLanguageConfig {
    return { ...this.config };
  }

  /**
   * Clear detection cache
   */
  clearCache(): void {
    this.detectionCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.detectionCache.size,
      hitRate: 0, // Would need to track hits/misses for accurate calculation
    };
  }

  /**
   * Validate language code format
   */
  validateLanguageCode(languageCode: string): boolean {
    return /^[a-z]{2}-[A-Z]{2}$/.test(languageCode);
  }

  /**
   * Get language family (for grouping similar languages)
   */
  getLanguageFamily(languageCode: string): string {
    const families: Record<string, string> = {
      'en-US': 'Germanic',
      'en-GB': 'Germanic',
      'de-DE': 'Germanic',
      'es-ES': 'Romance',
      'fr-FR': 'Romance',
      'zh-CN': 'Sino-Tibetan',
      'ja-JP': 'Japonic',
      'ar-SA': 'Semitic',
    };

    return families[languageCode] || 'Unknown';
  }

  /**
   * Get bidirectional text info
   */
  getTextDirection(languageCode: string): 'ltr' | 'rtl' | null {
    const config = this.getLanguageConfig(languageCode);
    return config?.direction || null;
  }
}
