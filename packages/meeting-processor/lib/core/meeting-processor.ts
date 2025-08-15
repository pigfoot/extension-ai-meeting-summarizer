/**
 * Main meeting processor coordinating all processing operations
 * Implements complete processing workflow with performance monitoring and error handling.
 */

import { ContentAnalyzer } from '../analysis/content-analyzer';
import { DecisionIdentifier } from '../decisions/decision-identifier';
import { ActionItemExtractor } from '../extractors/action-item-extractor';
import { MultiLanguageProcessor } from '../language/multi-language-processor';
import { QualityAssessor } from '../quality/quality-assessor';
import { SummaryGenerator } from '../summarization/summary-generator';
import type { ProcessingResult, TextSegment } from '../types';

export interface MeetingProcessorConfig {
  enablePerformanceMonitoring: boolean;
  timeoutMs: number;
  qualityThreshold: number;
  enableMultiLanguage: boolean;
}

export class MeetingProcessor {
  private config: MeetingProcessorConfig;
  private contentAnalyzer!: ContentAnalyzer;
  private summaryGenerator!: SummaryGenerator;
  private actionItemExtractor!: ActionItemExtractor;
  private decisionIdentifier!: DecisionIdentifier;
  private multiLanguageProcessor!: MultiLanguageProcessor;
  private qualityAssessor!: QualityAssessor;

  constructor(config: Partial<MeetingProcessorConfig> = {}) {
    this.config = {
      enablePerformanceMonitoring: true,
      timeoutMs: 60000,
      qualityThreshold: 0.7,
      enableMultiLanguage: true,
      ...config,
    };

    this.initializeComponents();
  }

  async processMeeting(meetingId: string, transcriptionText: string): Promise<ProcessingResult> {
    const startTime = Date.now();

    try {
      // Step 1: Content Analysis
      const contentAnalysis = await this.contentAnalyzer.analyzeContent(meetingId, transcriptionText);

      // Step 2: Multi-language processing
      let _languageResult;
      if (this.config.enableMultiLanguage) {
        _languageResult = await this.multiLanguageProcessor.processMultiLanguageContent(transcriptionText);
      }

      // Step 3: Generate summary
      const summary = await this.summaryGenerator.generateSummary(
        transcriptionText,
        contentAnalysis.segmentation.segments,
      );

      // Convert segments to TextSegment format
      const textSegments: TextSegment[] = contentAnalysis.segmentation.segments.map(segment => {
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

      // Step 4: Extract action items
      const actionItems = await this.actionItemExtractor.extractActionItems(transcriptionText, textSegments);

      // Step 5: Identify decisions
      const decisions = await this.decisionIdentifier.identifyDecisions(transcriptionText, textSegments);

      // Step 6: Extract key topics
      const keyTopics = contentAnalysis.topics.topics.map(topic => ({
        id: topic.id,
        title: topic.name,
        description: topic.description || '',
        duration: topic.duration || 0,
        keyPoints: topic.keywords,
        participants: topic.speakers,
        sources: [],
      }));

      // Step 7: Quality assessment
      const qualityMetrics = this.qualityAssessor.assessQuality(
        meetingId,
        {
          id: meetingId,
          summary,
          actionItems,
          decisions,
          topics: keyTopics,
        },
        transcriptionText,
      );

      const completedAt = new Date();
      const duration = completedAt.getTime() - startTime;

      const result: ProcessingResult = {
        meetingId,
        summary,
        actionItems,
        decisions,
        keyTopics,
        processingMetadata: {
          algorithmVersion: '1.0.0',
          startedAt: new Date(startTime),
          completedAt,
          duration,
          wordsProcessed: transcriptionText.split(/\s+/).length,
          configuration: {
            language: contentAnalysis.language.primaryLanguage,
            enableSpeakerIdentification: true,
            enableSentimentAnalysis: true,
            confidenceThreshold: this.config.qualityThreshold,
            maxSummaryLength: 500,
            preserveCulturalContext: this.config.enableMultiLanguage,
          },
          quality: qualityMetrics.qualityLevel,
          warnings: [],
        },
        confidence: {
          overall: qualityMetrics.confidence.overall,
          summary: qualityMetrics.confidence.byStage.summaryGeneration,
          actionItems: qualityMetrics.confidence.byStage.actionItemExtraction,
          decisions: qualityMetrics.confidence.byStage.decisionIdentification,
          topics: qualityMetrics.confidence.byStage.topicIdentification,
          languageDetection: qualityMetrics.confidence.byStage.languageDetection,
        },
        generatedAt: completedAt,
      };

      return result;
    } catch (error) {
      throw new Error(`Meeting processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private initializeComponents(): void {
    this.contentAnalyzer = new ContentAnalyzer({
      enableSpeakerIdentification: true,
      enableSentimentAnalysis: true,
      enableTopicModeling: true,
      enableMultilanguageSupport: this.config.enableMultiLanguage,
      processingTimeout: this.config.timeoutMs,
      qualityThreshold: this.config.qualityThreshold,
    });

    this.summaryGenerator = new SummaryGenerator();
    this.actionItemExtractor = new ActionItemExtractor();
    this.decisionIdentifier = new DecisionIdentifier();
    this.multiLanguageProcessor = new MultiLanguageProcessor();
    this.qualityAssessor = new QualityAssessor();
  }
}
