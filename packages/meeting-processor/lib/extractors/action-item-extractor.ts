/**
 * Action item extractor coordinating all action processing
 * Implements complete action item extraction workflow
 * with validation and confidence scoring.
 */

import { AssignmentDetector } from '../actions/assignment-detector';
import { DeadlineExtractor } from '../actions/deadline-extractor';
import { PatternRecognizer } from '../actions/pattern-recognizer';
import { PriorityClassifier } from '../actions/priority-classifier';
import type { ActionItem, TextSegment } from '../types';

export class ActionItemExtractor {
  private patternRecognizer = new PatternRecognizer();
  private assignmentDetector = new AssignmentDetector();
  private deadlineExtractor = new DeadlineExtractor();
  private priorityClassifier = new PriorityClassifier();

  async extractActionItems(text: string, segments: TextSegment[]): Promise<ActionItem[]> {
    const actionItems: ActionItem[] = [];
    let actionId = 1;

    for (const segment of segments) {
      const patterns = this.patternRecognizer.recognizeActionPatterns(segment.text);

      if (patterns.length > 0) {
        const assignment = this.assignmentDetector.detectAssignment(segment.text, segment.speakerId);
        const deadline = this.deadlineExtractor.extractDeadline(segment.text);
        const priority = this.priorityClassifier.classifyPriority(segment.text, !!deadline);

        const actionItem: ActionItem = {
          id: `action-${actionId++}`,
          task: this.extractTaskDescription(segment.text, patterns),
          assignee: assignment?.assignee,
          deadline: deadline?.deadline,
          priority: priority.priority,
          context: segment.text,
          source: {
            startOffset: segment.startOffset || 0,
            endOffset: segment.endOffset || segment.text.length,
            text: segment.text,
          },
          confidence: this.calculateActionConfidence(patterns, assignment, deadline, priority),
          status: 'identified',
          dependencies: [],
        };

        actionItems.push(actionItem);
      }
    }

    return actionItems;
  }

  private extractTaskDescription(text: string, patterns: Array<{ match: string }>): string {
    // Extract clean task description
    const sentences = text.split(/[.!?]+/);
    for (const sentence of sentences) {
      if (patterns.some(p => sentence.toLowerCase().includes(p.match.toLowerCase()))) {
        return sentence.trim().replace(/^(will|should|need to)\s+/i, '');
      }
    }
    return text.slice(0, 100) + '...';
  }

  private calculateActionConfidence(
    patterns: unknown[],
    assignment: unknown,
    deadline: unknown,
    priority: unknown,
  ): number {
    let confidence = 0.5;

    if (patterns.length > 0) confidence += 0.2;
    if (assignment && typeof assignment === 'object' && 'confidence' in assignment)
      confidence += (assignment as { confidence: number }).confidence * 0.2;
    if (deadline && typeof deadline === 'object' && 'confidence' in deadline)
      confidence += (deadline as { confidence: number }).confidence * 0.2;
    if (priority && typeof priority === 'object' && 'confidence' in priority)
      confidence += (priority as { confidence: number }).confidence * 0.1;

    return Math.min(confidence, 1.0);
  }
}
