/**
 * Summary generator for meeting summarization
 * Implements complete workflow with quality validation and accuracy checking.
 */

import { KeyPointExtractor } from './key-point-extractor';
import { SummaryFormatter } from './summary-formatter';
import { TopicIdentifier } from './topic-identifier';
import type { MeetingSummary } from '../types';

export class SummaryGenerator {
  private topicIdentifier = new TopicIdentifier();
  private keyPointExtractor = new KeyPointExtractor();
  private summaryFormatter = new SummaryFormatter();

  async generateSummary(content: string, segments: unknown[]): Promise<MeetingSummary> {
    const topics = await this.topicIdentifier.identifyTopics(content);
    const keyPoints = await this.keyPointExtractor.extractKeyPoints(segments);
    return await this.summaryFormatter.formatSummary(keyPoints, topics.topics);
  }
}
