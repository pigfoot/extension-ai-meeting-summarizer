/**
 * Decision pattern analyzer for decision identification
 * Implements decision language pattern recognition
 * with consensus and resolution indicator detection.
 */

export interface DecisionPattern {
  pattern: RegExp;
  confidence: number;
  type: 'decision' | 'consensus' | 'resolution';
}

export class PatternAnalyzer {
  private patterns: DecisionPattern[] = [
    { pattern: /we\s+(decided|agreed|concluded)/gi, confidence: 0.9, type: 'decision' },
    { pattern: /(decision|resolution|agreed upon)/gi, confidence: 0.8, type: 'decision' },
    { pattern: /consensus\s+(is|was|reached)/gi, confidence: 0.9, type: 'consensus' },
    { pattern: /(approved|confirmed|finalized)/gi, confidence: 0.7, type: 'resolution' },
  ];

  analyzeDecisionPatterns(text: string): Array<{ match: string; pattern: DecisionPattern; position: number }> {
    const results: Array<{ match: string; pattern: DecisionPattern; position: number }> = [];

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
