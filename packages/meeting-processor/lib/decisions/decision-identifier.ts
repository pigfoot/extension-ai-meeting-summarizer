/**
 * Decision identifier for decision identification
 * Implements complete workflow with decision owner identification and impact assessment.
 */

import { ConsensusDetector } from './consensus-detector';
import { ContextExtractor } from './context-extractor';
import { PatternAnalyzer } from './pattern-analyzer';
import type { Decision, TextSegment } from '../types';

export class DecisionIdentifier {
  private patternAnalyzer = new PatternAnalyzer();
  private consensusDetector = new ConsensusDetector();
  private contextExtractor = new ContextExtractor();

  async identifyDecisions(text: string, segments: TextSegment[]): Promise<Decision[]> {
    const decisions: Decision[] = [];
    let decisionId = 1;

    for (const segment of segments) {
      const patterns = this.patternAnalyzer.analyzeDecisionPatterns(segment.text);

      if (patterns.length > 0) {
        const consensus = this.consensusDetector.detectConsensus(segment.text);
        const context = this.contextExtractor.extractContext(segment.text, text);

        const decision: Decision = {
          id: `decision-${decisionId++}`,
          decision: this.extractDecisionStatement(segment.text, patterns),
          context: context.background,
          participants: this.extractParticipants(segment.text),
          consensus: consensus.consensusLevel,
          impact: this.assessImpact(segment.text),
          implementation: this.extractImplementation(segment.text),
          source: {
            startOffset: segment.startOffset || 0,
            endOffset: segment.endOffset || segment.text.length,
            text: segment.text,
          },
          confidence: Math.min(patterns[0]?.pattern.confidence || 0.5, consensus.confidence),
          category: this.categorizeDecision(segment.text),
          timeline: this.extractTimeline(segment.text),
        };

        decisions.push(decision);
      }
    }

    return decisions;
  }

  private extractDecisionStatement(
    text: string,
    patterns: Array<{ match: string; pattern: unknown; position: number }>,
  ): string {
    // Extract the actual decision statement
    const sentences = text.split(/[.!?]+/);
    for (const sentence of sentences) {
      if (patterns.some(p => sentence.toLowerCase().includes(p.match.toLowerCase()))) {
        return sentence.trim();
      }
    }
    return text.slice(0, 100) + '...'; // Fallback
  }

  private extractParticipants(text: string): string[] {
    // Simple participant extraction - could be enhanced
    const participants: string[] = [];
    const namePatterns = [
      /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g, // Full names
      /\b(Mr|Ms|Dr|Prof)\.?\s+[A-Z][a-z]+\b/g, // Titles with names
    ];

    for (const pattern of namePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        participants.push(match[0]);
      }
    }

    return [...new Set(participants)]; // Remove duplicates
  }

  private assessImpact(text: string): 'high' | 'medium' | 'low' {
    const highImpactWords = ['critical', 'major', 'significant', 'strategic', 'important'];
    const lowImpactWords = ['minor', 'small', 'simple', 'trivial'];

    const lowerText = text.toLowerCase();

    if (highImpactWords.some(word => lowerText.includes(word))) {
      return 'high';
    }

    if (lowImpactWords.some(word => lowerText.includes(word))) {
      return 'low';
    }

    return 'medium';
  }

  private extractImplementation(text: string): string | undefined {
    const implementationPatterns = [
      /will\s+implement\s+([^.!?]+)/gi,
      /implementation\s+([^.!?]+)/gi,
      /next\s+steps?\s+([^.!?]+)/gi,
    ];

    for (const pattern of implementationPatterns) {
      const match = pattern.exec(text);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  private categorizeDecision(text: string): 'strategic' | 'operational' | 'technical' | 'administrative' {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('strategy') || lowerText.includes('strategic')) {
      return 'strategic';
    }

    if (lowerText.includes('technical') || lowerText.includes('technology')) {
      return 'technical';
    }

    if (lowerText.includes('admin') || lowerText.includes('process')) {
      return 'administrative';
    }

    return 'operational';
  }

  private extractTimeline(text: string): string | undefined {
    const timelinePatterns = [/by\s+([^.!?]+)/gi, /within\s+([^.!?]+)/gi, /deadline\s+([^.!?]+)/gi];

    for (const pattern of timelinePatterns) {
      const match = pattern.exec(text);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }
}
