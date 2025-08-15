/**
 * Pattern recognizer for action item extraction
 * Implements natural language patterns for action identification
 * with commitment and responsibility language detection.
 */

export interface ActionPattern {
  pattern: RegExp;
  confidence: number;
  type: 'commitment' | 'assignment' | 'deadline' | 'task';
}

export class PatternRecognizer {
  private patterns: ActionPattern[] = [
    { pattern: /will\s+\w+/gi, confidence: 0.8, type: 'commitment' },
    { pattern: /should\s+\w+/gi, confidence: 0.7, type: 'task' },
    { pattern: /need\s+to\s+\w+/gi, confidence: 0.8, type: 'task' },
    { pattern: /assigned\s+to\s+\w+/gi, confidence: 0.9, type: 'assignment' },
  ];

  recognizeActionPatterns(text: string): Array<{ match: string; pattern: ActionPattern; position: number }> {
    const results: Array<{ match: string; pattern: ActionPattern; position: number }> = [];

    for (const pattern of this.patterns) {
      let match;
      while ((match = pattern.pattern.exec(text)) !== null) {
        results.push({
          match: match[0],
          pattern,
          position: match.index,
        });
      }
    }

    return results;
  }
}
