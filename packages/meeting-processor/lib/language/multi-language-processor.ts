/**
 * Multi-language processor for content processing
 * Implements language-specific processing coordination
 * with cultural context preservation and terminology handling.
 */

import { LanguageDetector } from '../analysis/language-detector';
import type { LanguageAnalysis, AnalysisLanguage } from '../types/analysis';

export interface MultiLanguageConfig {
  enableCulturalContext: boolean;
  preserveTerminology: boolean;
  handleMixedLanguage: boolean;
  defaultLanguage: AnalysisLanguage;
}

export class MultiLanguageProcessor {
  private languageDetector: LanguageDetector;
  private config: MultiLanguageConfig;

  constructor(config: Partial<MultiLanguageConfig> = {}) {
    this.config = {
      enableCulturalContext: true,
      preserveTerminology: true,
      handleMixedLanguage: true,
      defaultLanguage: 'en',
      ...config,
    };

    this.languageDetector = new LanguageDetector({
      enableMixedLanguageDetection: this.config.handleMixedLanguage,
    });
  }

  async processMultiLanguageContent(text: string): Promise<{
    processedText: string;
    languageAnalysis: LanguageAnalysis;
    culturalContext: Record<string, unknown>;
    terminology: string[];
  }> {
    const languageAnalysis = await this.languageDetector.detectLanguage(text);

    return {
      processedText: text,
      languageAnalysis,
      culturalContext: this.extractCulturalContext(text, languageAnalysis),
      terminology: this.extractTerminology(text, languageAnalysis),
    };
  }

  private extractCulturalContext(text: string, analysis: LanguageAnalysis): Record<string, unknown> {
    return {
      language: analysis.primaryLanguage,
      isMultilingual: analysis.isMultilingual,
      culturalMarkers: [],
    };
  }

  private extractTerminology(text: string, _analysis: LanguageAnalysis): string[] {
    // Extract technical terminology
    const terms = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    return [...new Set(terms)].slice(0, 20);
  }
}
