/**
 * Content analyzer coordinator for meeting processing
 * Orchestrates preprocessing, detection, and segmentation operations
 * to provide comprehensive content analysis coordination.
 */

import { ContentSegmenter } from './content-segmenter';
import { LanguageDetector } from './language-detector';
import { TextPreprocessor } from './text-preprocessor';
import type { PreprocessingResult } from './text-preprocessor';
import type {
  ContentAnalysis,
  LanguageAnalysis,
  TopicIdentification,
  SentimentAnalysis,
  ConfidenceScore,
  TextSegmentation,
} from '../types/analysis';
import type { TextSegment } from '../types/index';

/**
 * Content analysis configuration
 */
export interface ContentAnalysisConfig {
  /** Enable speaker identification */
  enableSpeakerIdentification: boolean;
  /** Enable sentiment analysis */
  enableSentimentAnalysis: boolean;
  /** Enable topic modeling */
  enableTopicModeling: boolean;
  /** Enable multilanguage support */
  enableMultilanguageSupport: boolean;
  /** Enable cultural context preservation */
  enableCulturalContextPreservation: boolean;
  /** Processing timeout in milliseconds */
  processingTimeout: number;
  /** Quality threshold for results (0.0-1.0) */
  qualityThreshold: number;
}

/**
 * Content analyzer class that coordinates all analysis operations
 */
export class ContentAnalyzer {
  private config: ContentAnalysisConfig;
  private textPreprocessor!: TextPreprocessor;
  private languageDetector!: LanguageDetector;
  private contentSegmenter!: ContentSegmenter;

  constructor(config: Partial<ContentAnalysisConfig> = {}) {
    this.config = {
      enableSpeakerIdentification: true,
      enableSentimentAnalysis: true,
      enableTopicModeling: true,
      enableMultilanguageSupport: true,
      enableCulturalContextPreservation: true,
      processingTimeout: 30000, // 30 seconds
      qualityThreshold: 0.7,
      ...config,
    };

    this.initializeComponents();
  }

  /**
   * Perform comprehensive content analysis
   */
  async analyzeContent(meetingId: string, originalText: string): Promise<ContentAnalysis> {
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      // Step 1: Preprocess text
      const preprocessingResult = await this.textPreprocessor.processText(originalText);

      // Step 2: Detect language
      const languageAnalysis = await this.languageDetector.detectLanguage(preprocessingResult.processedText);

      // Step 3: Segment content
      const segmentation = await this.contentSegmenter.segmentContent(
        preprocessingResult.processedText,
        preprocessingResult.speakers.map(s => ({ name: s.name || s.id, position: 0 })),
        languageAnalysis,
      );

      // Step 4: Analyze logical flow
      const _logicalFlow = await this.contentSegmenter.analyzeLogicalFlow(segmentation.segments);

      // Convert segments to TextSegment format for topic and sentiment analysis
      const textSegments: TextSegment[] = segmentation.segments.map(segment => {
        const textSegment: TextSegment = {
          startOffset: segment.startOffset,
          endOffset: segment.endOffset,
          text: segment.text,
        };

        if (segment.startTime !== undefined) {
          textSegment.startTime = segment.startTime;
        }
        if (segment.endTime !== undefined) {
          textSegment.endTime = segment.endTime;
        }
        if (segment.primarySpeaker !== undefined) {
          textSegment.speakerId = segment.primarySpeaker;
        }

        return textSegment;
      });

      // Step 5: Topic identification
      const topics = await this.identifyTopics(textSegments, languageAnalysis);

      // Step 6: Sentiment analysis (if enabled)
      let sentiment: SentimentAnalysis | undefined;
      if (this.config.enableSentimentAnalysis) {
        sentiment = await this.analyzeSentiment(textSegments, languageAnalysis);
      }

      // Step 7: Calculate confidence scores
      const confidence = this.calculateConfidenceScores(preprocessingResult, languageAnalysis, segmentation, topics);

      const completedAt = new Date();
      const duration = completedAt.getTime() - startTime;

      const result: ContentAnalysis = {
        id: `analysis-${Date.now()}`,
        meetingId,
        originalText,
        language: languageAnalysis,
        speakers: preprocessingResult.speakers,
        confidence,
        segmentation,
        topics,
        metadata: {
          version: '1.0.0',
          startedAt: new Date(startTime),
          completedAt,
          duration,
          wordCount: originalText.split(/\s+/).length,
          speakerCount: preprocessingResult.speakers.length,
          warnings,
        },
        features: {
          speakerIdentification: this.config.enableSpeakerIdentification,
          sentimentAnalysis: this.config.enableSentimentAnalysis,
          topicModeling: this.config.enableTopicModeling,
          multilanguageSupport: this.config.enableMultilanguageSupport,
          culturalContextPreservation: this.config.enableCulturalContextPreservation,
        },
      };

      if (sentiment) {
        result.sentiment = sentiment;
      }

      return result;
    } catch (error) {
      warnings.push(`Analysis error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new Error(`Content analysis failed: ${warnings.join(', ')}`);
    }
  }

  /**
   * Initialize analysis components
   */
  private initializeComponents(): void {
    this.textPreprocessor = new TextPreprocessor({
      removeFillersAndHesitations: true,
      normalizePunctuation: true,
      processSpeakerLabels: this.config.enableSpeakerIdentification,
      parseTimestamps: true,
      removeRepetition: true,
    });

    this.languageDetector = new LanguageDetector({
      enableMixedLanguageDetection: this.config.enableMultilanguageSupport,
      confidenceThreshold: this.config.qualityThreshold,
    });

    this.contentSegmenter = new ContentSegmenter(
      {
        strategy: 'hybrid',
        enableSemanticAnalysis: this.config.enableTopicModeling,
        languageSpecificRules: this.config.enableMultilanguageSupport,
      },
      this.languageDetector,
    );
  }

  /**
   * Identify topics in segments
   */
  private async identifyTopics(
    segments: TextSegment[],
    _languageAnalysis: LanguageAnalysis,
  ): Promise<TopicIdentification> {
    // Simplified topic identification - can be enhanced with ML models
    const topics: TopicIdentification['topics'] = [];
    const topicKeywords = new Map<string, number>();

    segments.forEach(segment => {
      // Extract keywords from segment text (simplified approach)
      const words = segment.text
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3);
      words.forEach((keyword: string) => {
        topicKeywords.set(keyword, (topicKeywords.get(keyword) || 0) + 1);
      });
    });

    const sortedKeywords = Array.from(topicKeywords.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // Group keywords into topics
    let topicId = 1;
    const keywordGroups = this.groupKeywordsIntoTopics(sortedKeywords);

    for (const group of keywordGroups) {
      const firstKeyword = group.keywords[0];
      if (firstKeyword) {
        topics.push({
          id: `topic-${topicId++}`,
          name: firstKeyword, // Use most frequent keyword as topic name
          description: `Discussion about ${group.keywords.join(', ')}`,
          keywords: group.keywords,
          importance: group.score,
          duration: 0, // Can be calculated from segments
          speakers: [],
          relatedTopics: [],
        });
      }
    }

    return {
      topics,
      method: 'keyword' as const,
      coherenceScore: 0.8, // Default score
    };
  }

  /**
   * Analyze sentiment in segments
   */
  private async analyzeSentiment(
    segments: TextSegment[],
    _languageAnalysis: LanguageAnalysis,
  ): Promise<SentimentAnalysis> {
    // Simplified sentiment analysis - can be enhanced with ML models
    const positiveWords = new Set(['good', 'great', 'excellent', 'positive', 'agree', 'success', 'happy']);
    const negativeWords = new Set(['bad', 'terrible', 'negative', 'disagree', 'problem', 'issue', 'concern']);

    let totalPositive = 0;
    let totalNegative = 0;
    let _totalWords = 0;

    const bySpeaker: SentimentAnalysis['bySpeaker'] = [];
    const byTopic: SentimentAnalysis['byTopic'] = [];
    const timeline: SentimentAnalysis['timeline'] = [];

    segments.forEach((segment, index) => {
      const words = segment.text.toLowerCase().split(/\s+/);
      let positive = 0;
      let negative = 0;

      words.forEach((word: string) => {
        if (positiveWords.has(word)) positive++;
        if (negativeWords.has(word)) negative++;
      });

      totalPositive += positive;
      totalNegative += negative;
      _totalWords += words.length;

      // Timeline sentiment
      const segmentSentiment = positive > negative ? 'positive' : negative > positive ? 'negative' : 'neutral';

      timeline.push({
        timeOffset: index * 30, // Approximate time
        sentiment: segmentSentiment,
        intensity: Math.abs(positive - negative) / words.length,
      });
    });

    const overallSentiment: SentimentAnalysis['overall'] =
      totalPositive > totalNegative * 2
        ? 'very-positive'
        : totalPositive > totalNegative
          ? 'positive'
          : totalNegative > totalPositive * 2
            ? 'very-negative'
            : totalNegative > totalPositive
              ? 'negative'
              : 'neutral';

    return {
      overall: overallSentiment,
      confidence: 0.7,
      bySpeaker,
      byTopic,
      timeline,
    };
  }

  /**
   * Calculate comprehensive confidence scores
   */
  private calculateConfidenceScores(
    preprocessingResult: PreprocessingResult,
    languageAnalysis: LanguageAnalysis,
    segmentation: TextSegmentation,
    _topics: TopicIdentification,
  ): ConfidenceScore {
    const overall =
      languageAnalysis.confidence * 0.2 +
      0.8 * 0.2 + // preprocessing confidence
      0.8 * 0.2 + // segmentation confidence
      0.7 * 0.2 + // topics confidence
      0.8 * 0.2; // overall processing confidence

    const result: ConfidenceScore = {
      overall,
      transcriptQuality: 0.8,
      speakerIdentification: preprocessingResult.speakers.length > 0 ? 0.8 : 0.5,
      segmentation: segmentation.totalSegments > 0 ? 0.8 : 0.5,
      languageDetection: languageAnalysis.confidence,
      topicIdentification: 0.7,
      factors: {
        audioQuality: 'high' as const,
        backgroundNoise: 'low' as const,
        speechClarity: 'high' as const,
        languageConsistency: languageAnalysis.isMultilingual ? 'medium' : ('high' as const),
      },
    };

    if (this.config.enableSentimentAnalysis) {
      result.sentimentAnalysis = 0.7;
    }

    return result;
  }

  /**
   * Group keywords into topic clusters
   */
  private groupKeywordsIntoTopics(
    sortedKeywords: Array<[string, number]>,
  ): Array<{ keywords: string[]; score: number }> {
    // Simple grouping - can be enhanced with semantic similarity
    const groups: Array<{ keywords: string[]; score: number }> = [];
    const used = new Set<string>();

    if (sortedKeywords.length === 0) {
      return groups;
    }

    const firstKeyword = sortedKeywords[0];
    if (!firstKeyword) {
      return groups;
    }

    const maxCount = firstKeyword[1]; // Store the highest count for normalization

    for (const [keyword, count] of sortedKeywords) {
      if (used.has(keyword)) continue;

      const group = {
        keywords: [keyword],
        score: count / maxCount, // Normalize by highest count
      };

      // Find related keywords (simplified)
      for (const [otherKeyword, otherCount] of sortedKeywords) {
        if (used.has(otherKeyword) || otherKeyword === keyword) continue;

        // Simple similarity check
        if (this.areKeywordsSimilar(keyword, otherKeyword)) {
          group.keywords.push(otherKeyword);
          group.score += (otherCount / maxCount) * 0.5;
          used.add(otherKeyword);
        }
      }

      used.add(keyword);
      groups.push(group);

      if (groups.length >= 5) break; // Limit to top 5 topics
    }

    return groups;
  }

  /**
   * Check if keywords are similar (simplified)
   */
  private areKeywordsSimilar(keyword1: string, keyword2: string): boolean {
    // Very simple similarity check - can be enhanced
    return (
      keyword1.startsWith(keyword2.slice(0, 3)) ||
      keyword2.startsWith(keyword1.slice(0, 3)) ||
      keyword1.includes(keyword2) ||
      keyword2.includes(keyword1)
    );
  }
}
