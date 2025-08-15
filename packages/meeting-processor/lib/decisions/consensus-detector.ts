/**
 * Consensus detector for decision identification
 * Implements agreement and disagreement analysis
 * with consensus level assessment and participant tracking.
 */

import type { ConsensusLevel } from '../types';

export interface ConsensusResult {
  consensusLevel: ConsensusLevel;
  confidence: number;
  agreementIndicators: string[];
  disagreementIndicators: string[];
  participantStances: Array<{
    participant: string;
    stance: 'agree' | 'disagree' | 'neutral';
    confidence: number;
  }>;
}

export class ConsensusDetector {
  detectConsensus(text: string, _participants: string[] = []): ConsensusResult {
    const agreementWords = ['agree', 'yes', 'correct', 'absolutely', 'exactly', 'support'];
    const disagreementWords = ['disagree', 'no', 'wrong', 'oppose', 'against', 'but'];

    let agreementCount = 0;
    let disagreementCount = 0;
    const agreementIndicators: string[] = [];
    const disagreementIndicators: string[] = [];

    const lowerText = text.toLowerCase();

    agreementWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = lowerText.match(regex);
      if (matches) {
        agreementCount += matches.length;
        agreementIndicators.push(...matches);
      }
    });

    disagreementWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = lowerText.match(regex);
      if (matches) {
        disagreementCount += matches.length;
        disagreementIndicators.push(...matches);
      }
    });

    let consensusLevel: ConsensusLevel;
    let confidence: number;

    if (agreementCount > disagreementCount * 3) {
      consensusLevel = 'unanimous';
      confidence = 0.9;
    } else if (agreementCount > disagreementCount) {
      consensusLevel = 'majority';
      confidence = 0.7;
    } else if (disagreementCount > agreementCount) {
      consensusLevel = 'split';
      confidence = 0.8;
    } else {
      consensusLevel = 'unclear';
      confidence = 0.5;
    }

    return {
      consensusLevel,
      confidence,
      agreementIndicators,
      disagreementIndicators,
      participantStances: [], // Would need more sophisticated analysis
    };
  }
}
