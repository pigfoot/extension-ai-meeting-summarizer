/**
 * Content segmenter for meeting content analysis
 * Handles meeting content segmentation by topic, speaker, and logical flow analysis.
 * Provides section identification and structured content organization.
 */

import type { LanguageDetector } from './language-detector';
import type { TextSegmentation, SegmentType, LanguageAnalysis } from '../types/analysis';

/**
 * Content segmentation configuration
 */
export interface SegmentationConfig {
  /** Segmentation strategy to use */
  strategy: 'speaker-based' | 'topic-based' | 'time-based' | 'hybrid';
  /** Minimum segment length in words */
  minSegmentLength: number;
  /** Maximum segment length in words */
  maxSegmentLength: number;
  /** Topic coherence threshold (0.0-1.0) */
  topicCoherenceThreshold: number;
  /** Speaker change sensitivity (0.0-1.0) */
  speakerChangeSensitivity: number;
  /** Enable semantic similarity analysis */
  enableSemanticAnalysis: boolean;
  /** Time-based segmentation interval in seconds */
  timeBasedInterval?: number;
  /** Language-specific segmentation rules */
  languageSpecificRules: boolean;
}

/**
 * Topic boundary indicators
 */
export interface TopicBoundary {
  /** Position in text where topic changes */
  position: number;
  /** Confidence in topic boundary (0.0-1.0) */
  confidence: number;
  /** Type of boundary */
  type: 'hard' | 'soft';
  /** Previous topic keywords */
  previousTopicKeywords: string[];
  /** New topic keywords */
  newTopicKeywords: string[];
  /** Transition indicators */
  transitionIndicators: string[];
}

/**
 * Speaker change detection result
 */
export interface SpeakerChange {
  /** Position in text where speaker changes */
  position: number;
  /** Previous speaker identifier */
  previousSpeaker?: string;
  /** New speaker identifier */
  newSpeaker?: string;
  /** Confidence in speaker change (0.0-1.0) */
  confidence: number;
  /** Speaker change indicators found */
  indicators: string[];
}

/**
 * Logical flow analysis result
 */
export interface LogicalFlow {
  /** Flow structure identified */
  structure: {
    /** Introduction segments */
    introduction: number[];
    /** Main discussion segments */
    mainDiscussion: number[];
    /** Decision points */
    decisions: number[];
    /** Action items */
    actions: number[];
    /** Conclusion segments */
    conclusion: number[];
  };
  /** Flow transitions between segments */
  transitions: Array<{
    fromSegment: number;
    toSegment: number;
    transitionType: 'continuation' | 'topic-shift' | 'speaker-change' | 'conclusion';
    strength: number;
  }>;
  /** Overall flow coherence score */
  coherenceScore: number;
}

/**
 * Topic transition indicators for different languages
 */
const TOPIC_TRANSITION_PATTERNS = {
  en: [
    /\b(now|next|moving on|let's discuss|regarding|concerning|another|furthermore|however|meanwhile)\b/gi,
    /\b(in addition|on the other hand|speaking of|as for|turning to)\b/gi,
    /\b(let's talk about|shifting gears|changing topics)\b/gi,
  ],
  zh: [/\b(現在|接下來|然後|另外|關於|至於|說到|轉到)\b/gi, /\b(接著|再來|還有|除此之外|順便說)\b/gi],
  ja: [/\b(さて|では|それでは|次に|続いて|ところで|について)\b/gi, /\b(さらに|また|一方|他方)\b/gi],
  ko: [/\b(이제|다음|그러면|그런데|한편|또한|또|그리고)\b/gi, /\b(계속해서|이어서|추가로)\b/gi],
};

/**
 * Speaker change indicators
 */
const SPEAKER_CHANGE_PATTERNS = [
  /\b(speaker \d+|person \d+|\w+:|\[\w+\]|>>\w+<<)\b/gi,
  /\b(mr\.|ms\.|dr\.|prof\.)\s+\w+/gi,
  /\b(john|jane|mike|sarah|david|lisa|alex|mary)\b/gi, // Common names - expandable
];

/**
 * Meeting section indicators
 */
const SECTION_INDICATORS = {
  introduction: [
    /\b(welcome|start|begin|agenda|today|meeting|good morning|good afternoon)\b/gi,
    /\b(let's start|shall we begin|opening|kick off)\b/gi,
  ],
  discussion: [
    /\b(discuss|talk about|consider|examine|analyze|review)\b/gi,
    /\b(what do you think|opinions|thoughts|feedback)\b/gi,
  ],
  decision: [
    /\b(decide|decision|agreed|conclude|resolved|final|confirmed)\b/gi,
    /\b(we decided|it was decided|consensus|vote|approved)\b/gi,
  ],
  action: [
    /\b(action|task|todo|assign|responsible|deadline|due|will do)\b/gi,
    /\b(next steps|follow up|action items|deliverables)\b/gi,
  ],
  conclusion: [
    /\b(conclusion|summary|wrap up|end|closing|finally|to summarize)\b/gi,
    /\b(in conclusion|to conclude|that's all|meeting adjourned)\b/gi,
  ],
};

/**
 * Content segmenter class for meeting transcriptions
 */
export class ContentSegmenter {
  private config: SegmentationConfig;
  private languageDetector?: LanguageDetector | undefined;

  constructor(config: Partial<SegmentationConfig> = {}, languageDetector?: LanguageDetector) {
    this.config = {
      strategy: 'hybrid',
      minSegmentLength: 10,
      maxSegmentLength: 200,
      topicCoherenceThreshold: 0.7,
      speakerChangeSensitivity: 0.8,
      enableSemanticAnalysis: true,
      languageSpecificRules: true,
      ...config,
    };
    this.languageDetector = languageDetector;
  }

  /**
   * Segment text according to configured strategy
   */
  async segmentContent(
    text: string,
    speakers?: Array<{ name: string; position: number }>,
    languageAnalysis?: LanguageAnalysis,
  ): Promise<TextSegmentation> {
    const _words = text.split(/\s+/);
    let segments: TextSegmentation['segments'] = [];

    switch (this.config.strategy) {
      case 'speaker-based':
        segments = await this.segmentBySpeaker(text, speakers);
        break;
      case 'topic-based':
        segments = await this.segmentByTopic(text, languageAnalysis);
        break;
      case 'time-based':
        segments = await this.segmentByTime(text);
        break;
      case 'hybrid':
      default:
        segments = await this.segmentHybrid(text, speakers, languageAnalysis);
        break;
    }

    return {
      segments,
      totalSegments: segments.length,
      averageLength: segments.reduce((sum, seg) => sum + seg.text.split(/\s+/).length, 0) / segments.length,
      methodology: this.config.strategy,
    };
  }

  /**
   * Analyze logical flow of the content
   */
  async analyzeLogicalFlow(segments: TextSegmentation['segments']): Promise<LogicalFlow> {
    const structure = {
      introduction: [] as number[],
      mainDiscussion: [] as number[],
      decisions: [] as number[],
      actions: [] as number[],
      conclusion: [] as number[],
    };

    const transitions: LogicalFlow['transitions'] = [];

    // Classify segments by section type
    segments.forEach((segment, index) => {
      const sectionType = this.classifySection(segment.text);

      switch (sectionType) {
        case 'introduction':
          structure.introduction.push(index);
          break;
        case 'decision':
          structure.decisions.push(index);
          break;
        case 'action':
          structure.actions.push(index);
          break;
        case 'conclusion':
          structure.conclusion.push(index);
          break;
        default:
          structure.mainDiscussion.push(index);
          break;
      }
    });

    // Analyze transitions between segments
    for (let i = 0; i < segments.length - 1; i++) {
      const currentSegment = segments[i];
      const nextSegment = segments[i + 1];

      if (!currentSegment || !nextSegment) {
        continue;
      }

      const transitionType = this.analyzeTransition(currentSegment, nextSegment);
      const strength = this.calculateTransitionStrength(currentSegment, nextSegment);

      transitions.push({
        fromSegment: i,
        toSegment: i + 1,
        transitionType,
        strength,
      });
    }

    // Calculate overall coherence score
    const coherenceScore = this.calculateCoherenceScore(segments, transitions);

    return {
      structure,
      transitions,
      coherenceScore,
    };
  }

  /**
   * Segment by speaker changes
   */
  private async segmentBySpeaker(
    text: string,
    speakers?: Array<{ name: string; position: number }>,
  ): Promise<TextSegmentation['segments']> {
    const _segments: TextSegmentation['segments'] = [];

    if (!speakers || speakers.length === 0) {
      // Detect speaker changes automatically
      const speakerChanges = this.detectSpeakerChanges(text);
      return this.createSegmentsFromBoundaries(
        text,
        speakerChanges.map(sc => sc.position),
      );
    }

    // Use provided speaker information
    const boundaries = speakers.map(s => s.position).sort((a, b) => a - b);
    return this.createSegmentsFromBoundaries(text, boundaries);
  }

  /**
   * Segment by topic boundaries
   */
  private async segmentByTopic(
    text: string,
    languageAnalysis?: LanguageAnalysis,
  ): Promise<TextSegmentation['segments']> {
    const language = languageAnalysis?.primaryLanguage || 'en';
    const topicBoundaries = await this.detectTopicBoundaries(text, language);
    const boundaries = topicBoundaries
      .filter(tb => tb.confidence > this.config.topicCoherenceThreshold)
      .map(tb => tb.position);

    return this.createSegmentsFromBoundaries(text, boundaries);
  }

  /**
   * Segment by time intervals
   */
  private async segmentByTime(text: string): Promise<TextSegmentation['segments']> {
    const words = text.split(/\s+/);
    const interval = this.config.timeBasedInterval || 60; // 60 seconds default
    const wordsPerSecond = 2.5; // Average speaking rate
    const wordsPerInterval = interval * wordsPerSecond;

    const segments: TextSegmentation['segments'] = [];
    let segmentId = 1;

    for (let i = 0; i < words.length; i += wordsPerInterval) {
      const segmentWords = words.slice(i, Math.min(i + wordsPerInterval, words.length));
      const segmentText = segmentWords.join(' ');

      if (segmentText.trim() && segmentWords.length > 0) {
        const firstWord = segmentWords[0];
        const lastWord = segmentWords[segmentWords.length - 1];

        if (!firstWord || !lastWord) {
          continue;
        }

        segments.push({
          id: `segment-${segmentId++}`,
          text: segmentText,
          type: this.classifySegmentType(segmentText),
          startOffset: text.indexOf(firstWord),
          endOffset: text.indexOf(lastWord) + lastWord.length,
          startTime: i / wordsPerSecond,
          endTime: (i + segmentWords.length) / wordsPerSecond,
          confidence: 0.8,
          keywords: this.extractKeywords(segmentText),
        });
      }
    }

    return segments;
  }

  /**
   * Hybrid segmentation combining multiple strategies
   */
  private async segmentHybrid(
    text: string,
    speakers?: Array<{ name: string; position: number }>,
    languageAnalysis?: LanguageAnalysis,
  ): Promise<TextSegmentation['segments']> {
    // Get boundaries from different strategies
    const speakerBoundaries = speakers
      ? speakers.map(s => s.position)
      : this.detectSpeakerChanges(text).map(sc => sc.position);

    const language = languageAnalysis?.primaryLanguage || 'en';
    const topicBoundaries = (await this.detectTopicBoundaries(text, language))
      .filter(tb => tb.confidence > this.config.topicCoherenceThreshold)
      .map(tb => tb.position);

    // Combine and deduplicate boundaries
    const allBoundaries = [...new Set([...speakerBoundaries, ...topicBoundaries, 0])].sort((a, b) => a - b);

    // Create segments with enhanced information
    const segments = this.createSegmentsFromBoundaries(text, allBoundaries);

    // Enhance segments with additional analysis
    return segments.map(segment => ({
      ...segment,
      type: this.classifySegmentType(segment.text),
      confidence: this.calculateSegmentConfidence(segment, speakerBoundaries, topicBoundaries),
      keywords: this.extractKeywords(segment.text),
    }));
  }

  /**
   * Detect speaker changes in text
   */
  private detectSpeakerChanges(text: string): SpeakerChange[] {
    const changes: SpeakerChange[] = [];

    for (const pattern of SPEAKER_CHANGE_PATTERNS) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (match.index !== undefined) {
          changes.push({
            position: match.index,
            confidence: 0.8,
            indicators: [match[0]],
          });
        }
      }
    }

    // Remove duplicates and sort by position
    return changes
      .filter((change, index, arr) => {
        if (index === 0) return true;
        const previousChange = arr[index - 1];
        return previousChange ? Math.abs(change.position - previousChange.position) > 10 : true;
      })
      .sort((a, b) => a.position - b.position);
  }

  /**
   * Detect topic boundaries in text
   */
  private async detectTopicBoundaries(text: string, language: string = 'en'): Promise<TopicBoundary[]> {
    const boundaries: TopicBoundary[] = [];
    const patterns =
      TOPIC_TRANSITION_PATTERNS[language as keyof typeof TOPIC_TRANSITION_PATTERNS] || TOPIC_TRANSITION_PATTERNS.en;

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        boundaries.push({
          position: match.index,
          confidence: 0.7,
          type: 'soft',
          previousTopicKeywords: [],
          newTopicKeywords: [],
          transitionIndicators: [match[0]],
        });
      }
    }

    // Enhance with semantic analysis if enabled
    if (this.config.enableSemanticAnalysis) {
      return this.enhanceTopicBoundaries(text, boundaries);
    }

    return boundaries.sort((a, b) => a.position - b.position);
  }

  /**
   * Create segments from boundary positions
   */
  private createSegmentsFromBoundaries(text: string, boundaries: number[]): TextSegmentation['segments'] {
    const segments: TextSegmentation['segments'] = [];
    const sortedBoundaries = [...new Set(boundaries)].sort((a, b) => a - b);

    for (let i = 0; i < sortedBoundaries.length; i++) {
      const start = sortedBoundaries[i];
      if (start === undefined) {
        continue;
      }

      const nextBoundary = sortedBoundaries[i + 1];
      const end = i < sortedBoundaries.length - 1 && nextBoundary !== undefined ? nextBoundary : text.length;

      const segmentText = text.slice(start, end).trim();

      if (segmentText && this.isValidSegment(segmentText)) {
        segments.push({
          id: `segment-${i + 1}`,
          text: segmentText,
          type: this.classifySegmentType(segmentText),
          startOffset: start,
          endOffset: end,
          confidence: 0.8,
          keywords: this.extractKeywords(segmentText),
        });
      }
    }

    return segments;
  }

  /**
   * Classify segment type based on content
   */
  private classifySegmentType(text: string): SegmentType {
    const lowerText = text.toLowerCase();

    // Check each section type
    for (const [sectionType, patterns] of Object.entries(SECTION_INDICATORS)) {
      for (const pattern of patterns) {
        if (pattern.test(lowerText)) {
          return sectionType as SegmentType;
        }
      }
    }

    return 'discussion'; // Default
  }

  /**
   * Classify section type (similar to segment type but more comprehensive)
   */
  private classifySection(text: string): string {
    return this.classifySegmentType(text);
  }

  /**
   * Analyze transition between segments
   */
  private analyzeTransition(
    currentSegment: TextSegmentation['segments'][0],
    nextSegment: TextSegmentation['segments'][0],
  ): LogicalFlow['transitions'][0]['transitionType'] {
    // Speaker change detection
    if (currentSegment.primarySpeaker !== nextSegment.primarySpeaker) {
      return 'speaker-change';
    }

    // Topic shift detection
    const currentKeywords = new Set(currentSegment.keywords);
    const nextKeywords = new Set(nextSegment.keywords);
    const overlap = [...currentKeywords].filter(k => nextKeywords.has(k)).length;
    const totalKeywords = currentKeywords.size + nextKeywords.size;

    if (totalKeywords > 0 && overlap / totalKeywords < 0.3) {
      return 'topic-shift';
    }

    // Conclusion detection
    if (nextSegment.type === 'conclusion' || currentSegment.text.toLowerCase().includes('conclusion')) {
      return 'conclusion';
    }

    return 'continuation';
  }

  /**
   * Calculate transition strength between segments
   */
  private calculateTransitionStrength(
    currentSegment: TextSegmentation['segments'][0],
    nextSegment: TextSegmentation['segments'][0],
  ): number {
    let strength = 0.5; // Base strength

    // Keyword overlap increases strength
    const currentKeywords = new Set(currentSegment.keywords);
    const nextKeywords = new Set(nextSegment.keywords);
    const overlap = [...currentKeywords].filter(k => nextKeywords.has(k)).length;
    const totalKeywords = currentKeywords.size + nextKeywords.size;

    if (totalKeywords > 0) {
      strength += (overlap / totalKeywords) * 0.3;
    }

    // Same speaker increases strength
    if (currentSegment.primarySpeaker === nextSegment.primarySpeaker) {
      strength += 0.2;
    }

    return Math.min(strength, 1.0);
  }

  /**
   * Calculate overall coherence score
   */
  private calculateCoherenceScore(
    segments: TextSegmentation['segments'],
    transitions: LogicalFlow['transitions'],
  ): number {
    if (transitions.length === 0) return 1.0;

    const averageStrength = transitions.reduce((sum, t) => sum + t.strength, 0) / transitions.length;
    const continuityScore = transitions.filter(t => t.transitionType === 'continuation').length / transitions.length;

    return averageStrength * 0.6 + continuityScore * 0.4;
  }

  /**
   * Calculate segment confidence based on multiple factors
   */
  private calculateSegmentConfidence(
    segment: TextSegmentation['segments'][0],
    speakerBoundaries: number[],
    topicBoundaries: number[],
  ): number {
    let confidence = 0.5; // Base confidence

    // Length factor
    const wordCount = segment.text.split(/\s+/).length;
    if (wordCount >= this.config.minSegmentLength && wordCount <= this.config.maxSegmentLength) {
      confidence += 0.2;
    }

    // Boundary alignment
    const nearSpeakerBoundary = speakerBoundaries.some(b => Math.abs(b - segment.startOffset) < 10);
    const nearTopicBoundary = topicBoundaries.some(b => Math.abs(b - segment.startOffset) < 10);

    if (nearSpeakerBoundary) confidence += 0.15;
    if (nearTopicBoundary) confidence += 0.15;

    return Math.min(confidence, 1.0);
  }

  /**
   * Extract keywords from text segment
   */
  private extractKeywords(text: string): string[] {
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);

    // Simple frequency-based keyword extraction
    const wordFreq = new Map<string, number>();
    words.forEach(word => {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    });

    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  /**
   * Check if segment is valid based on length and content
   */
  private isValidSegment(text: string): boolean {
    const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
    return wordCount >= this.config.minSegmentLength && wordCount <= this.config.maxSegmentLength;
  }

  /**
   * Enhance topic boundaries with semantic analysis
   */
  private async enhanceTopicBoundaries(text: string, boundaries: TopicBoundary[]): Promise<TopicBoundary[]> {
    // Simplified semantic enhancement - can be expanded with ML models
    return boundaries.map(boundary => {
      const beforeText = text.slice(Math.max(0, boundary.position - 100), boundary.position);
      const afterText = text.slice(boundary.position, boundary.position + 100);

      const previousKeywords = this.extractKeywords(beforeText);
      const newKeywords = this.extractKeywords(afterText);

      // Calculate semantic distance
      const commonKeywords = previousKeywords.filter(k => newKeywords.includes(k));
      const semanticDistance = 1 - commonKeywords.length / Math.max(previousKeywords.length, newKeywords.length, 1);

      return {
        ...boundary,
        confidence: Math.min(boundary.confidence + semanticDistance * 0.3, 1.0),
        previousTopicKeywords: previousKeywords,
        newTopicKeywords: newKeywords,
        type: semanticDistance > 0.7 ? 'hard' : 'soft',
      };
    });
  }
}
