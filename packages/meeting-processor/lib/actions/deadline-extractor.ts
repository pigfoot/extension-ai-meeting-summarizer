/**
 * Deadline extractor for action item extraction
 * Implements date and time reference extraction
 * with relative date parsing and deadline inference.
 */

export interface DeadlineResult {
  deadline: Date;
  confidence: number;
  originalText: string;
  type: 'absolute' | 'relative' | 'inferred';
}

export class DeadlineExtractor {
  extractDeadline(text: string): DeadlineResult | null {
    // Date patterns
    const absolutePatterns = [
      /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/g,
      /(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}/gi,
    ];

    const relativePatterns = [
      /(next\s+week|next\s+month|tomorrow|by\s+friday)/gi,
      /(in\s+\d+\s+days|in\s+a\s+week|by\s+end\s+of\s+week)/gi,
    ];

    // Check absolute dates first
    for (const pattern of absolutePatterns) {
      const match = pattern.exec(text);
      if (match && match[1]) {
        const date = new Date(match[1]);
        if (!isNaN(date.getTime())) {
          return {
            deadline: date,
            confidence: 0.9,
            originalText: match[1],
            type: 'absolute',
          };
        }
      }
    }

    // Check relative dates
    for (const pattern of relativePatterns) {
      const match = pattern.exec(text);
      if (match && match[1]) {
        const deadline = this.parseRelativeDate(match[1]);
        if (deadline) {
          return {
            deadline,
            confidence: 0.7,
            originalText: match[1],
            type: 'relative',
          };
        }
      }
    }

    return null;
  }

  private parseRelativeDate(text: string): Date | null {
    const now = new Date();
    const lowerText = text.toLowerCase();

    if (lowerText.includes('tomorrow')) {
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }

    if (lowerText.includes('next week')) {
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    if (lowerText.includes('next month')) {
      const nextMonth = new Date(now);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      return nextMonth;
    }

    // Add more relative date parsing as needed
    return null;
  }
}
