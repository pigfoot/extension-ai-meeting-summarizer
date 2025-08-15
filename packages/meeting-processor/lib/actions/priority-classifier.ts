/**
 * Priority classifier for action item extraction
 * Implements priority level assignment based on context
 * with urgency detection and importance scoring.
 */

import type { Priority } from '../types';

export interface PriorityResult {
  priority: Priority;
  confidence: number;
  indicators: string[];
  urgencyScore: number;
  importanceScore: number;
}

export class PriorityClassifier {
  classifyPriority(text: string, hasDeadline: boolean = false): PriorityResult {
    const lowerText = text.toLowerCase();
    let urgencyScore = 0;
    let importanceScore = 0;
    const indicators: string[] = [];

    // High priority indicators
    const highPriorityWords = ['urgent', 'critical', 'asap', 'immediately', 'priority', 'emergency'];
    const mediumPriorityWords = ['important', 'soon', 'needed', 'required'];
    const lowPriorityWords = ['eventually', 'when possible', 'nice to have', 'optional'];

    for (const word of highPriorityWords) {
      if (lowerText.includes(word)) {
        urgencyScore += 0.8;
        importanceScore += 0.7;
        indicators.push(word);
      }
    }

    for (const word of mediumPriorityWords) {
      if (lowerText.includes(word)) {
        urgencyScore += 0.5;
        importanceScore += 0.5;
        indicators.push(word);
      }
    }

    for (const word of lowPriorityWords) {
      if (lowerText.includes(word)) {
        urgencyScore -= 0.3;
        importanceScore -= 0.3;
        indicators.push(word);
      }
    }

    // Deadline affects priority
    if (hasDeadline) {
      urgencyScore += 0.3;
      indicators.push('has deadline');
    }

    // Determine final priority
    const overallScore = (urgencyScore + importanceScore) / 2;
    let priority: Priority;
    let confidence: number;

    if (overallScore > 0.6) {
      priority = 'high';
      confidence = Math.min(overallScore, 1.0);
    } else if (overallScore > 0.2) {
      priority = 'medium';
      confidence = 0.7;
    } else {
      priority = 'low';
      confidence = 0.6;
    }

    return {
      priority,
      confidence,
      indicators,
      urgencyScore: Math.max(0, Math.min(1, urgencyScore)),
      importanceScore: Math.max(0, Math.min(1, importanceScore)),
    };
  }
}
