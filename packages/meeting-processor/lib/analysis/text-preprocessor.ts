/**
 * Text preprocessor for meeting content analysis
 * Handles text cleaning, normalization, segmentation, speaker identification,
 * and timestamp parsing to prepare transcription text for processing.
 */

import type { SpeakerInfo, TextSegmentation, SegmentType } from '../types/analysis';

/**
 * Text preprocessing configuration
 */
export interface PreprocessingConfig {
  /** Remove filler words and hesitations */
  removeFillersAndHesitations: boolean;
  /** Normalize punctuation and spacing */
  normalizePunctuation: boolean;
  /** Handle speaker labels */
  processSpeakerLabels: boolean;
  /** Parse timestamps */
  parseTimestamps: boolean;
  /** Minimum segment length in words */
  minSegmentLength: number;
  /** Maximum segment length in words */
  maxSegmentLength: number;
  /** Languages to optimize for */
  targetLanguages: string[];
  /** Remove repetitive content */
  removeRepetition: boolean;
}

/**
 * Preprocessing result
 */
export interface PreprocessingResult {
  /** Cleaned and normalized text */
  processedText: string;
  /** Original text length */
  originalLength: number;
  /** Processed text length */
  processedLength: number;
  /** Identified speakers */
  speakers: SpeakerInfo[];
  /** Text segments */
  segments: TextSegmentation['segments'];
  /** Preprocessing statistics */
  statistics: {
    /** Words removed */
    wordsRemoved: number;
    /** Filler words removed */
    fillersRemoved: number;
    /** Repetitions removed */
    repetitionsRemoved: number;
    /** Speaker changes detected */
    speakerChanges: number;
    /** Timestamp markers found */
    timestampMarkers: number;
  };
  /** Processing warnings */
  warnings: string[];
}

/**
 * Speaker label patterns for different formats
 */
const SPEAKER_PATTERNS = [
  // "Speaker 1:" or "John Doe:"
  /^([A-Za-z0-9\s]+):\s*/,
  // "[Speaker 1]" or "[John Doe]"
  /^\[([A-Za-z0-9\s]+)\]\s*/,
  // ">> Speaker 1 <<" or ">> John Doe <<"
  /^>>\s*([A-Za-z0-9\s]+)\s*<<\s*/,
  // "(Speaker 1)" or "(John Doe)"
  /^\(([A-Za-z0-9\s]+)\)\s*/,
];

/**
 * Timestamp patterns for different formats
 */
const TIMESTAMP_PATTERNS = [
  // [00:12:34] or [12:34]
  /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g,
  // (00:12:34) or (12:34)
  /\((\d{1,2}:\d{2}(?::\d{2})?)\)/g,
  // 00:12:34 or 12:34
  /\b(\d{1,2}:\d{2}(?::\d{2})?)\b/g,
];

/**
 * Common filler words and hesitations in multiple languages
 */
const FILLER_WORDS = new Set([
  // English
  'um',
  'uh',
  'ah',
  'er',
  'eh',
  'you know',
  'like',
  'so',
  'well',
  'okay',
  'right',
  'actually',
  'basically',
  'literally',
  'kind of',
  'sort of',
  // Chinese
  '嗯',
  '啊',
  '呃',
  '那個',
  '就是',
  '然後',
  '對啊',
  '這樣',
  // Japanese
  'あの',
  'えー',
  'えーと',
  'そうですね',
  'まあ',
  // Korean
  '음',
  '어',
  '그',
  '뭐',
  '그런데',
  // Spanish
  'eh',
  'mm',
  'este',
  'bueno',
  'entonces',
  // French
  'euh',
  'ben',
  'alors',
  'donc',
  'enfin',
]);

/**
 * Text preprocessor class for meeting transcriptions
 */
export class TextPreprocessor {
  private config: PreprocessingConfig;
  private speakerMap: Map<string, SpeakerInfo> = new Map();
  private segmentCounter = 0;

  constructor(config: Partial<PreprocessingConfig> = {}) {
    this.config = {
      removeFillersAndHesitations: true,
      normalizePunctuation: true,
      processSpeakerLabels: true,
      parseTimestamps: true,
      minSegmentLength: 5,
      maxSegmentLength: 200,
      targetLanguages: ['en', 'zh', 'ja', 'ko'],
      removeRepetition: true,
      ...config,
    };
  }

  /**
   * Process transcription text with all preprocessing steps
   */
  async processText(text: string): Promise<PreprocessingResult> {
    const _startTime = Date.now();
    const originalLength = text.length;
    let processedText = text;
    const warnings: string[] = [];
    const statistics = {
      wordsRemoved: 0,
      fillersRemoved: 0,
      repetitionsRemoved: 0,
      speakerChanges: 0,
      timestampMarkers: 0,
    };

    try {
      // Step 1: Parse timestamps and speaker labels
      const { text: textWithoutTimestamps, timestamps } = this.extractTimestamps(processedText);
      processedText = textWithoutTimestamps;
      statistics.timestampMarkers = timestamps.length;

      const { text: textWithoutSpeakers, speakers } = this.extractSpeakers(processedText);
      processedText = textWithoutSpeakers;
      statistics.speakerChanges = speakers.length;

      // Step 2: Clean and normalize text
      if (this.config.normalizePunctuation) {
        processedText = this.normalizePunctuation(processedText);
      }

      if (this.config.removeFillersAndHesitations) {
        const { text: cleanText, removed } = this.removeFillersAndHesitations(processedText);
        processedText = cleanText;
        statistics.fillersRemoved = removed;
      }

      if (this.config.removeRepetition) {
        const { text: deduplicatedText, removed } = this.removeRepetitions(processedText);
        processedText = deduplicatedText;
        statistics.repetitionsRemoved = removed;
      }

      // Step 3: Segment text
      const segments = this.segmentText(processedText, speakers, timestamps);

      // Step 4: Calculate statistics
      const originalWords = this.countWords(text);
      const processedWords = this.countWords(processedText);
      statistics.wordsRemoved = originalWords - processedWords;

      // Step 5: Build speaker info
      const speakerInfos = this.buildSpeakerInfo(speakers, segments);

      return {
        processedText,
        originalLength,
        processedLength: processedText.length,
        speakers: speakerInfos,
        segments,
        statistics,
        warnings,
      };
    } catch (error) {
      warnings.push(`Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);

      // Return minimal result on error
      return {
        processedText: text,
        originalLength,
        processedLength: text.length,
        speakers: [],
        segments: [],
        statistics,
        warnings,
      };
    }
  }

  /**
   * Extract timestamps from text
   */
  private extractTimestamps(text: string): { text: string; timestamps: Array<{ time: string; position: number }> } {
    const timestamps: Array<{ time: string; position: number }> = [];
    let cleanText = text;

    for (const pattern of TIMESTAMP_PATTERNS) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (match[1] && match.index !== undefined) {
          timestamps.push({
            time: match[1],
            position: match.index,
          });
        }
      }
      cleanText = cleanText.replace(pattern, ' ');
    }

    return {
      text: cleanText.replace(/\s+/g, ' ').trim(),
      timestamps: timestamps.sort((a, b) => a.position - b.position),
    };
  }

  /**
   * Extract speaker labels from text
   */
  private extractSpeakers(text: string): { text: string; speakers: Array<{ name: string; position: number }> } {
    const speakers: Array<{ name: string; position: number }> = [];
    const lines = text.split('\n');
    const cleanLines: string[] = [];
    let currentPosition = 0;

    for (const line of lines) {
      let cleanLine = line.trim();
      let _speakerFound = false;

      for (const pattern of SPEAKER_PATTERNS) {
        const match = line.match(pattern);
        if (match && match[1]) {
          const speakerName = match[1].trim();
          speakers.push({
            name: speakerName,
            position: currentPosition,
          });
          cleanLine = line.replace(pattern, '').trim();
          _speakerFound = true;
          break;
        }
      }

      if (cleanLine) {
        cleanLines.push(cleanLine);
        currentPosition += cleanLine.length + 1;
      }
    }

    return {
      text: cleanLines.join(' ').replace(/\s+/g, ' ').trim(),
      speakers,
    };
  }

  /**
   * Normalize punctuation and spacing
   */
  private normalizePunctuation(text: string): string {
    return (
      text
        // Normalize quotes
        .replace(/[""'']/g, '"')
        .replace(/['']/g, "'")
        // Normalize dashes
        .replace(/[—–−]/g, '-')
        // Normalize ellipses
        .replace(/\.{3,}/g, '...')
        // Fix spacing around punctuation
        .replace(/\s*([.!?;:,])\s*/g, '$1 ')
        .replace(/\s*([()[\]{}])\s*/g, ' $1 ')
        // Remove excessive whitespace
        .replace(/\s+/g, ' ')
        .trim()
    );
  }

  /**
   * Remove filler words and hesitations
   */
  private removeFillersAndHesitations(text: string): { text: string; removed: number } {
    const words = text.split(/\s+/);
    const originalCount = words.length;

    const cleanWords = words.filter(word => {
      const cleanWord = word.toLowerCase().replace(/[.,!?;:]/g, '');
      return !FILLER_WORDS.has(cleanWord);
    });

    return {
      text: cleanWords.join(' '),
      removed: originalCount - cleanWords.length,
    };
  }

  /**
   * Remove repetitive content
   */
  private removeRepetitions(text: string): { text: string; removed: number } {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim());
    const uniqueSentences: string[] = [];
    const seen = new Set<string>();
    let removedCount = 0;

    for (const sentence of sentences) {
      const normalized = sentence.toLowerCase().trim();
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        uniqueSentences.push(sentence.trim());
      } else {
        removedCount++;
      }
    }

    return {
      text: uniqueSentences.join('. ') + (uniqueSentences.length > 0 ? '.' : ''),
      removed: removedCount,
    };
  }

  /**
   * Segment text into logical parts
   */
  private segmentText(
    text: string,
    _speakers: Array<{ name: string; position: number }>,
    _timestamps: Array<{ time: string; position: number }>,
  ): TextSegmentation['segments'] {
    const words = text.split(/\s+/);
    const segments: TextSegmentation['segments'] = [];
    let currentSegment: string[] = [];
    let segmentStartOffset = 0;
    let currentSpeaker: string | undefined;

    const wordsPerSegment = Math.min(this.config.maxSegmentLength, Math.max(this.config.minSegmentLength, 50));

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (word) {
        currentSegment.push(word);
      }

      // Check if we should create a new segment
      const shouldCreateSegment =
        currentSegment.length >= wordsPerSegment ||
        i === words.length - 1 ||
        this.shouldBreakSegment(currentSegment.join(' '));

      if (shouldCreateSegment && currentSegment.length >= this.config.minSegmentLength) {
        const segmentText = currentSegment.join(' ');
        const segmentType = this.classifySegmentType(segmentText);

        segments.push({
          id: `segment-${++this.segmentCounter}`,
          text: segmentText,
          type: segmentType,
          startOffset: segmentStartOffset,
          endOffset: segmentStartOffset + segmentText.length,
          primarySpeaker: currentSpeaker,
          confidence: 0.8, // Default confidence, can be improved with ML
          keywords: this.extractKeywords(segmentText),
        });

        segmentStartOffset += segmentText.length + 1;
        currentSegment = [];
      }
    }

    return segments;
  }

  /**
   * Determine if a segment should be broken at this point
   */
  private shouldBreakSegment(text: string): boolean {
    // Break on strong sentence endings
    if (/[.!?]\s*$/.test(text)) {
      return true;
    }

    // Break on topic transitions
    const transitionWords = ['however', 'meanwhile', 'furthermore', 'in addition', 'on the other hand'];
    const lastSentence = text.split(/[.!?]/).pop()?.toLowerCase() || '';

    return transitionWords.some(word => lastSentence.includes(word));
  }

  /**
   * Classify segment type based on content
   */
  private classifySegmentType(text: string): SegmentType {
    const lowerText = text.toLowerCase();

    // Decision indicators
    if (/\b(decided|decide|agreed|agree|concluded|resolution|final)\b/.test(lowerText)) {
      return 'decision';
    }

    // Action indicators
    if (/\b(will|should|need to|action|task|assign|responsible|deadline)\b/.test(lowerText)) {
      return 'action';
    }

    // Introduction indicators
    if (/\b(welcome|start|begin|agenda|today|meeting)\b/.test(lowerText)) {
      return 'introduction';
    }

    // Conclusion indicators
    if (/\b(conclusion|summary|end|closing|next time|follow up)\b/.test(lowerText)) {
      return 'conclusion';
    }

    // Default to discussion
    return 'discussion';
  }

  /**
   * Extract keywords from text segment
   */
  private extractKeywords(text: string): string[] {
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !FILLER_WORDS.has(word));

    // Simple keyword extraction - can be enhanced with NLP
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
   * Build speaker information from extracted data
   */
  private buildSpeakerInfo(
    speakers: Array<{ name: string; position: number }>,
    segments: TextSegmentation['segments'],
  ): SpeakerInfo[] {
    const speakerStats = new Map<
      string,
      {
        segments: number;
        totalText: string;
        speakingTime: number;
      }
    >();

    // Aggregate speaker statistics
    speakers.forEach(speaker => {
      if (!speakerStats.has(speaker.name)) {
        speakerStats.set(speaker.name, {
          segments: 0,
          totalText: '',
          speakingTime: 0,
        });
      }
    });

    segments.forEach(segment => {
      if (segment.primarySpeaker) {
        const stats = speakerStats.get(segment.primarySpeaker);
        if (stats) {
          stats.segments++;
          stats.totalText += ' ' + segment.text;
          stats.speakingTime += (segment.endTime || 0) - (segment.startTime || 0);
        }
      }
    });

    // Convert to SpeakerInfo format
    return Array.from(speakerStats.entries()).map(([name, stats], index) => ({
      id: `speaker-${index + 1}`,
      name,
      speakingTime: stats.speakingTime,
      speechSegments: stats.segments,
      identificationConfidence: 'likely' as const,
    }));
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0).length;
  }
}
