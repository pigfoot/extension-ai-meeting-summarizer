/**
 * Language detector for meeting content analysis
 * Handles language detection, mixed-language content processing,
 * and language-specific processing configuration.
 */

import type { LanguageAnalysis, AnalysisLanguage } from '../types/analysis';

/**
 * Language detection configuration
 */
export interface LanguageDetectionConfig {
  /** Primary languages to prioritize in detection */
  priorityLanguages: AnalysisLanguage[];
  /** Minimum confidence threshold for language detection */
  confidenceThreshold: number;
  /** Enable detection of mixed-language content */
  enableMixedLanguageDetection: boolean;
  /** Sample size for language detection (number of words) */
  sampleSize: number;
  /** Use statistical methods for detection */
  useStatisticalMethods: boolean;
  /** Enable cultural context detection */
  enableCulturalContext: boolean;
}

/**
 * Language-specific processing configuration
 */
export interface LanguageProcessingConfig {
  /** Language code */
  language: AnalysisLanguage;
  /** Text segmentation rules */
  segmentation: {
    sentenceBoundary: RegExp;
    wordBoundary: RegExp;
    punctuation: RegExp;
  };
  /** Common words to ignore during processing */
  stopWords: Set<string>;
  /** Language-specific filler words */
  fillerWords: Set<string>;
  /** Number formatting patterns */
  numberPatterns: RegExp[];
  /** Date/time formatting patterns */
  dateTimePatterns: RegExp[];
  /** Cultural context markers */
  culturalMarkers: string[];
}

/**
 * Language detection result for a text segment
 */
export interface SegmentLanguageResult {
  /** Text segment */
  text: string;
  /** Start position in original text */
  startOffset: number;
  /** End position in original text */
  endOffset: number;
  /** Detected language */
  language: AnalysisLanguage;
  /** Detection confidence (0.0-1.0) */
  confidence: number;
  /** Alternative language candidates */
  alternatives: Array<{
    language: AnalysisLanguage;
    confidence: number;
  }>;
}

/**
 * Language characteristic patterns for different languages
 */
const LANGUAGE_PATTERNS: Record<
  AnalysisLanguage,
  {
    characterSets: RegExp[];
    commonWords: Set<string>;
    grammarPatterns: RegExp[];
    punctuationStyle: RegExp[];
  }
> = {
  en: {
    characterSets: [/^[a-zA-Z\s.,!?;:'"()-]+$/],
    commonWords: new Set([
      'the',
      'and',
      'is',
      'in',
      'to',
      'of',
      'a',
      'that',
      'it',
      'with',
      'for',
      'as',
      'was',
      'on',
      'are',
    ]),
    grammarPatterns: [/\b(is|are|was|were)\s+\w+ing\b/, /\b(a|an|the)\s+\w+/],
    punctuationStyle: [/[.!?]\s+[A-Z]/, /'s\b/, /n't\b/],
  },
  zh: {
    characterSets: [/[\u4e00-\u9fff]+/, /[\u3400-\u4dbf]+/],
    commonWords: new Set(['的', '是', '在', '了', '我', '有', '和', '就', '不', '人', '都', '一', '也', '說', '會']),
    grammarPatterns: [/的[\u4e00-\u9fff]+/, /[\u4e00-\u9fff]+了/, /[\u4e00-\u9fff]+著/],
    punctuationStyle: [/。/, /，/, /？/, /！/],
  },
  ja: {
    characterSets: [/[\u3040-\u309f]+/, /[\u30a0-\u30ff]+/, /[\u4e00-\u9faf]+/],
    commonWords: new Set([
      'です',
      'ます',
      'である',
      'ですが',
      'ました',
      'します',
      'ありがとう',
      'すみません',
      'こんにちは',
    ]),
    grammarPatterns: [/\w+です/, /\w+ます/, /\w+でした/, /\w+ました/],
    punctuationStyle: [/。/, /、/, /？/, /！/],
  },
  ko: {
    characterSets: [/[\uac00-\ud7af]+/, /[\u1100-\u11ff]+/, /[\u3130-\u318f]+/],
    commonWords: new Set([
      '이',
      '가',
      '는',
      '은',
      '을',
      '를',
      '의',
      '에',
      '에서',
      '로',
      '와',
      '과',
      '하다',
      '있다',
      '되다',
    ]),
    grammarPatterns: [/\w+입니다/, /\w+습니다/, /\w+했습니다/, /\w+됩니다/],
    punctuationStyle: [/\./, /,/, /\?/, /!/],
  },
  es: {
    characterSets: [/^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s.,!?;:'"()-]+$/],
    commonWords: new Set(['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da']),
    grammarPatterns: [/\bel\s+\w+/, /\bla\s+\w+/, /\w+ción\b/, /\w+dad\b/],
    punctuationStyle: [/¿.+\?/, /¡.+!/, /[.!?]\s+[A-ZÁÉÍÓÚÜÑ]/],
  },
  fr: {
    characterSets: [/^[a-zA-ZàâäéèêëïîôöùûüÿçÀÂÄÉÈÊËÏÎÔÖÙÛÜŸÇ\s.,!?;:'"()-]+$/],
    commonWords: new Set([
      'le',
      'de',
      'et',
      'à',
      'un',
      'il',
      'être',
      'et',
      'en',
      'avoir',
      'que',
      'pour',
      'dans',
      'ce',
      'son',
    ]),
    grammarPatterns: [/\ble\s+\w+/, /\bla\s+\w+/, /\w+tion\b/, /\w+ment\b/],
    punctuationStyle: [/[.!?]\s+[A-ZÀÂÄÉÈÊËÏÎÔÖÙÛÜŸÇ]/, /qu'/],
  },
  de: {
    characterSets: [/^[a-zA-ZäöüßÄÖÜ\s.,!?;:'"()-]+$/],
    commonWords: new Set([
      'der',
      'die',
      'und',
      'in',
      'den',
      'von',
      'zu',
      'das',
      'mit',
      'sich',
      'des',
      'auf',
      'für',
      'ist',
      'im',
    ]),
    grammarPatterns: [/\bder\s+\w+/, /\bdie\s+\w+/, /\bdas\s+\w+/, /\w+ung\b/, /\w+keit\b/],
    punctuationStyle: [/[.!?]\s+[A-ZÄÖÜ]/, /ß/],
  },
  pt: {
    characterSets: [/^[a-zA-ZáàâãéêíîóôõúçÁÀÂÃÉÊÍÎÓÔÕÚÇ\s.,!?;:'"()-]+$/],
    commonWords: new Set(['o', 'a', 'de', 'e', 'do', 'da', 'em', 'um', 'para', 'é', 'com', 'não', 'uma', 'os', 'no']),
    grammarPatterns: [/\bo\s+\w+/, /\ba\s+\w+/, /\w+ção\b/, /\w+mente\b/],
    punctuationStyle: [/[.!?]\s+[A-ZÁÀÂÃÉÊÍÎÓÔÕÚÇ]/, /ç/],
  },
  auto: {
    characterSets: [],
    commonWords: new Set(),
    grammarPatterns: [],
    punctuationStyle: [],
  },
};

/**
 * Language-specific stop words
 */
const STOP_WORDS: Record<AnalysisLanguage, Set<string>> = {
  en: new Set([
    'the',
    'and',
    'is',
    'in',
    'to',
    'of',
    'a',
    'that',
    'it',
    'with',
    'for',
    'as',
    'was',
    'on',
    'are',
    'but',
    'be',
    'have',
    'they',
    'not',
    'this',
    'can',
    'had',
    'his',
    'what',
    'said',
    'each',
    'which',
    'how',
    'their',
  ]),
  zh: new Set([
    '的',
    '是',
    '在',
    '了',
    '我',
    '有',
    '和',
    '就',
    '不',
    '人',
    '都',
    '一',
    '也',
    '說',
    '會',
    '這',
    '那',
    '你',
    '他',
    '她',
    '要',
    '可以',
    '沒有',
    '但是',
    '因為',
    '所以',
  ]),
  ja: new Set([
    'は',
    'が',
    'を',
    'に',
    'で',
    'と',
    'から',
    'まで',
    'より',
    'の',
    'です',
    'ます',
    'だ',
    'である',
    'した',
    'する',
    'という',
    'として',
    'ように',
    'ながら',
  ]),
  ko: new Set([
    '이',
    '가',
    '는',
    '은',
    '을',
    '를',
    '의',
    '에',
    '에서',
    '로',
    '와',
    '과',
    '하다',
    '있다',
    '되다',
    '그',
    '저',
    '이것',
    '그것',
    '저것',
    '여기',
    '거기',
    '저기',
  ]),
  es: new Set([
    'el',
    'la',
    'de',
    'que',
    'y',
    'a',
    'en',
    'un',
    'es',
    'se',
    'no',
    'te',
    'lo',
    'le',
    'da',
    'su',
    'por',
    'son',
    'con',
    'para',
    'al',
    'del',
    'los',
    'las',
  ]),
  fr: new Set([
    'le',
    'de',
    'et',
    'à',
    'un',
    'il',
    'être',
    'et',
    'en',
    'avoir',
    'que',
    'pour',
    'dans',
    'ce',
    'son',
    'une',
    'sur',
    'avec',
    'ne',
    'se',
    'pas',
    'tout',
    'plus',
    'par',
  ]),
  de: new Set([
    'der',
    'die',
    'und',
    'in',
    'den',
    'von',
    'zu',
    'das',
    'mit',
    'sich',
    'des',
    'auf',
    'für',
    'ist',
    'im',
    'dem',
    'nicht',
    'ein',
    'eine',
    'als',
    'auch',
    'nach',
    'wird',
    'an',
  ]),
  pt: new Set([
    'o',
    'a',
    'de',
    'e',
    'do',
    'da',
    'em',
    'um',
    'para',
    'é',
    'com',
    'não',
    'uma',
    'os',
    'no',
    'se',
    'na',
    'por',
    'mais',
    'as',
    'dos',
    'como',
    'mas',
    'foi',
    'ao',
  ]),
  auto: new Set(),
};

/**
 * Language detector class for meeting transcriptions
 */
export class LanguageDetector {
  private config: LanguageDetectionConfig;
  private processingConfigs: Map<AnalysisLanguage, LanguageProcessingConfig> = new Map();

  constructor(config: Partial<LanguageDetectionConfig> = {}) {
    this.config = {
      priorityLanguages: ['en', 'zh', 'ja', 'ko'],
      confidenceThreshold: 0.6,
      enableMixedLanguageDetection: true,
      sampleSize: 100,
      useStatisticalMethods: true,
      enableCulturalContext: true,
      ...config,
    };

    this.initializeProcessingConfigs();
  }

  /**
   * Detect language(s) in the given text
   */
  async detectLanguage(text: string): Promise<LanguageAnalysis> {
    const cleanText = this.cleanTextForDetection(text);
    const words = cleanText.split(/\s+/).filter(word => word.length > 0);

    if (words.length === 0) {
      return this.createEmptyResult();
    }

    // Sample text for detection if it's too long
    const sampleText =
      words.length > this.config.sampleSize ? words.slice(0, this.config.sampleSize).join(' ') : cleanText;

    // Detect primary language
    const languageScores = await this.calculateLanguageScores(sampleText);
    const sortedLanguages = Array.from(languageScores.entries()).sort((a, b) => b[1] - a[1]);

    const primaryLanguage = sortedLanguages[0]?.[0] || 'auto';
    const primaryConfidence = sortedLanguages[0]?.[1] || 0;

    // Check for mixed-language content
    let isMultilingual = false;
    const secondaryLanguages: LanguageAnalysis['secondaryLanguages'] = [];

    if (this.config.enableMixedLanguageDetection && words.length > 20) {
      const segments = await this.detectMixedLanguageSegments(cleanText);
      const languageDistribution = this.calculateLanguageDistribution(segments);

      isMultilingual = languageDistribution.size > 1;

      for (const [lang, percentage] of languageDistribution) {
        if (lang !== primaryLanguage && percentage > 0.1) {
          secondaryLanguages.push({
            language: lang,
            confidence: languageScores.get(lang) || 0,
            percentage,
          });
        }
      }
    }

    // Detect dialect if applicable
    const dialect = await this.detectDialect(sampleText, primaryLanguage);

    return {
      primaryLanguage,
      confidence: primaryConfidence,
      secondaryLanguages: secondaryLanguages.sort((a, b) => b.percentage - a.percentage),
      isMultilingual,
      dialect,
    };
  }

  /**
   * Get language-specific processing configuration
   */
  getProcessingConfig(language: AnalysisLanguage): LanguageProcessingConfig {
    return this.processingConfigs.get(language) || this.processingConfigs.get('en')!;
  }

  /**
   * Detect mixed-language segments in text
   */
  async detectMixedLanguageSegments(text: string): Promise<SegmentLanguageResult[]> {
    const sentences = this.splitIntoSentences(text);
    const segments: SegmentLanguageResult[] = [];
    let currentOffset = 0;

    for (const sentence of sentences) {
      if (sentence.trim().length === 0) {
        currentOffset += sentence.length;
        continue;
      }

      const languageScores = await this.calculateLanguageScores(sentence);
      const topLanguage = Array.from(languageScores.entries()).sort((a, b) => b[1] - a[1])[0];

      if (topLanguage) {
        const alternatives = Array.from(languageScores.entries())
          .filter(([lang]) => lang !== topLanguage[0])
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([language, confidence]) => ({ language, confidence }));

        segments.push({
          text: sentence.trim(),
          startOffset: currentOffset,
          endOffset: currentOffset + sentence.length,
          language: topLanguage[0],
          confidence: topLanguage[1],
          alternatives,
        });
      }

      currentOffset += sentence.length;
    }

    return segments;
  }

  /**
   * Initialize language-specific processing configurations
   */
  private initializeProcessingConfigs(): void {
    Object.keys(LANGUAGE_PATTERNS).forEach(lang => {
      const language = lang as AnalysisLanguage;
      if (language === 'auto') return;

      this.processingConfigs.set(language, {
        language,
        segmentation: this.createSegmentationRules(language),
        stopWords: STOP_WORDS[language],
        fillerWords: this.createFillerWords(language),
        numberPatterns: this.createNumberPatterns(language),
        dateTimePatterns: this.createDateTimePatterns(language),
        culturalMarkers: this.createCulturalMarkers(language),
      });
    });
  }

  /**
   * Calculate language scores for text
   */
  private async calculateLanguageScores(text: string): Promise<Map<AnalysisLanguage, number>> {
    const scores = new Map<AnalysisLanguage, number>();
    const words = text.toLowerCase().split(/\s+/);

    for (const [language, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
      if (language === 'auto') continue;

      const lang = language as AnalysisLanguage;
      let score = 0;

      // Character set matching
      const charsetScore = this.calculateCharsetScore(text, patterns.characterSets);
      score += charsetScore * 0.4;

      // Common words matching
      const commonWordsScore = this.calculateCommonWordsScore(words, patterns.commonWords);
      score += commonWordsScore * 0.3;

      // Grammar patterns matching
      const grammarScore = this.calculateGrammarScore(text, patterns.grammarPatterns);
      score += grammarScore * 0.2;

      // Punctuation style matching
      const punctuationScore = this.calculatePunctuationScore(text, patterns.punctuationStyle);
      score += punctuationScore * 0.1;

      // Priority language boost
      if (this.config.priorityLanguages.includes(lang)) {
        score *= 1.1;
      }

      scores.set(lang, Math.min(score, 1.0));
    }

    return scores;
  }

  /**
   * Calculate character set score
   */
  private calculateCharsetScore(text: string, charsets: RegExp[]): number {
    if (charsets.length === 0) return 0;

    const matchCount = charsets.reduce((count, regex) => {
      const matches = text.match(regex);
      return count + (matches?.length || 0);
    }, 0);

    return Math.min(matchCount / text.length, 1);
  }

  /**
   * Calculate common words score
   */
  private calculateCommonWordsScore(words: string[], commonWords: Set<string>): number {
    if (commonWords.size === 0) return 0;

    const matchCount = words.filter(word => commonWords.has(word.toLowerCase())).length;
    return words.length > 0 ? matchCount / words.length : 0;
  }

  /**
   * Calculate grammar patterns score
   */
  private calculateGrammarScore(text: string, patterns: RegExp[]): number {
    if (patterns.length === 0) return 0;

    const matchCount = patterns.reduce((count, regex) => {
      const matches = text.match(regex);
      return count + (matches?.length || 0);
    }, 0);

    const sentences = text.split(/[.!?]+/).length;
    return sentences > 0 ? Math.min(matchCount / sentences, 1) : 0;
  }

  /**
   * Calculate punctuation style score
   */
  private calculatePunctuationScore(text: string, patterns: RegExp[]): number {
    if (patterns.length === 0) return 0;

    const matchCount = patterns.reduce((count, regex) => {
      const matches = text.match(regex);
      return count + (matches?.length || 0);
    }, 0);

    const totalPunctuation = (text.match(/[.!?;:,]/g) || []).length;
    return totalPunctuation > 0 ? matchCount / totalPunctuation : 0;
  }

  /**
   * Clean text for language detection
   */
  private cleanTextForDetection(text: string): string {
    return text
      .replace(/\d+/g, ' ') // Remove numbers
      .replace(/[^\p{L}\p{M}\s.!?;:,]/gu, ' ') // Keep only letters, marks, and basic punctuation
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Split text into sentences
   */
  private splitIntoSentences(text: string): string[] {
    // Enhanced sentence splitting for multiple languages
    return text.split(/[.!?。！？]+/).filter(s => s.trim().length > 0);
  }

  /**
   * Calculate language distribution in segments
   */
  private calculateLanguageDistribution(segments: SegmentLanguageResult[]): Map<AnalysisLanguage, number> {
    const distribution = new Map<AnalysisLanguage, number>();
    const totalLength = segments.reduce((sum, seg) => sum + seg.text.length, 0);

    segments.forEach(segment => {
      const percentage = segment.text.length / totalLength;
      distribution.set(segment.language, (distribution.get(segment.language) || 0) + percentage);
    });

    return distribution;
  }

  /**
   * Detect dialect for the given language
   */
  private async detectDialect(text: string, language: AnalysisLanguage): Promise<string | undefined> {
    // Simplified dialect detection - can be enhanced
    const dialectMarkers: Record<AnalysisLanguage, Record<string, RegExp[]>> = {
      en: {
        US: [/\b(color|flavor|center)\b/, /\bzh?\b/],
        UK: [/\b(colour|flavour|centre)\b/, /\bzed\b/],
        AU: [/\b(arvo|brekkie|servo)\b/],
      },
      zh: {
        simplified: [/[\u4e00-\u9fff]/],
        traditional: [/[\u4e00-\u9fff]/], // More sophisticated detection needed
      },
      // Add more dialect patterns as needed
      ja: {},
      ko: {},
      es: {},
      fr: {},
      de: {},
      pt: {},
      auto: {},
    };

    const markers = dialectMarkers[language];
    if (!markers) return undefined;

    for (const [dialect, patterns] of Object.entries(markers)) {
      const score = patterns.reduce((count, regex) => {
        const matches = text.match(regex);
        return count + (matches?.length || 0);
      }, 0);

      if (score > 2) {
        return dialect;
      }
    }

    return undefined;
  }

  /**
   * Create empty language analysis result
   */
  private createEmptyResult(): LanguageAnalysis {
    return {
      primaryLanguage: 'auto',
      confidence: 0,
      secondaryLanguages: [],
      isMultilingual: false,
    };
  }

  /**
   * Create segmentation rules for language
   */
  private createSegmentationRules(language: AnalysisLanguage) {
    const rules = {
      en: {
        sentenceBoundary: /[.!?]+\s+/,
        wordBoundary: /\s+/,
        punctuation: /[.,!?;:]/g,
      },
      zh: {
        sentenceBoundary: /[。！？]+/,
        wordBoundary: /[\s\u3000]+/,
        punctuation: /[，。！？；：]/g,
      },
      ja: {
        sentenceBoundary: /[。！？]+/,
        wordBoundary: /[\s\u3000]+/,
        punctuation: /[、。！？]/g,
      },
    };

    return rules[language as keyof typeof rules] || rules.en;
  }

  /**
   * Create filler words set for language
   */
  private createFillerWords(language: AnalysisLanguage): Set<string> {
    const fillers = {
      en: ['um', 'uh', 'ah', 'like', 'you know', 'well', 'so'],
      zh: ['嗯', '啊', '呃', '那個', '就是', '然後'],
      ja: ['あの', 'えー', 'えーと', 'そうですね'],
      ko: ['음', '어', '그', '뭐'],
    };

    return new Set(fillers[language as keyof typeof fillers] || fillers.en);
  }

  /**
   * Create number patterns for language
   */
  private createNumberPatterns(_language: AnalysisLanguage): RegExp[] {
    return [/\d+/g, /\d{1,3}(,\d{3})*/g, /\d+\.\d+/g];
  }

  /**
   * Create date/time patterns for language
   */
  private createDateTimePatterns(_language: AnalysisLanguage): RegExp[] {
    return [/\d{1,2}[/:]\d{1,2}[/:]\d{2,4}/g, /\d{1,2}:\d{2}(:\d{2})?/g];
  }

  /**
   * Create cultural markers for language
   */
  private createCulturalMarkers(language: AnalysisLanguage): string[] {
    const markers = {
      en: ['thank you', 'please', 'excuse me', 'sorry'],
      zh: ['謝謝', '請', '不好意思', '對不起'],
      ja: ['ありがとう', 'すみません', 'お疲れ様'],
      ko: ['감사합니다', '죄송합니다', '안녕하세요'],
    };

    return markers[language as keyof typeof markers] || [];
  }
}
