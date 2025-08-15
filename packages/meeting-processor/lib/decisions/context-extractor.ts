/**
 * Context extractor for decision identification
 * Implements decision context and reasoning extraction
 * with background information and factor identification.
 */

export interface DecisionContext {
  background: string;
  reasoning: string[];
  factors: Array<{
    factor: string;
    type: 'supporting' | 'opposing' | 'neutral';
    weight: number;
  }>;
  alternatives: string[];
  constraints: string[];
}

export class ContextExtractor {
  extractContext(decisionText: string, surroundingText: string): DecisionContext {
    const reasoningPatterns = [
      /because\s+([^.!?]+)/gi,
      /due\s+to\s+([^.!?]+)/gi,
      /since\s+([^.!?]+)/gi,
      /the\s+reason\s+is\s+([^.!?]+)/gi,
    ];

    const alternativePatterns = [/alternative\s+([^.!?]+)/gi, /option\s+([^.!?]+)/gi, /we\s+could\s+([^.!?]+)/gi];

    const constraintPatterns = [
      /constraint\s+([^.!?]+)/gi,
      /limitation\s+([^.!?]+)/gi,
      /budget\s+([^.!?]+)/gi,
      /time\s+constraint\s+([^.!?]+)/gi,
    ];

    const reasoning: string[] = [];
    const alternatives: string[] = [];
    const constraints: string[] = [];

    // Extract reasoning
    for (const pattern of reasoningPatterns) {
      let match;
      while ((match = pattern.exec(surroundingText)) !== null) {
        if (match[1]) {
          reasoning.push(match[1].trim());
        }
      }
    }

    // Extract alternatives
    for (const pattern of alternativePatterns) {
      let match;
      while ((match = pattern.exec(surroundingText)) !== null) {
        if (match[1]) {
          alternatives.push(match[1].trim());
        }
      }
    }

    // Extract constraints
    for (const pattern of constraintPatterns) {
      let match;
      while ((match = pattern.exec(surroundingText)) !== null) {
        if (match[1]) {
          constraints.push(match[1].trim());
        }
      }
    }

    return {
      background: this.extractBackground(surroundingText),
      reasoning,
      factors: this.identifyFactors(reasoning),
      alternatives,
      constraints,
    };
  }

  private extractBackground(text: string): string {
    // Extract first few sentences as background
    const sentences = text.split(/[.!?]+/).slice(0, 3);
    return sentences.join('. ').trim();
  }

  private identifyFactors(reasoning: string[]): DecisionContext['factors'] {
    return reasoning.map(reason => ({
      factor: reason,
      type: 'supporting' as const, // Simplified - could analyze sentiment
      weight: 1.0,
    }));
  }
}
