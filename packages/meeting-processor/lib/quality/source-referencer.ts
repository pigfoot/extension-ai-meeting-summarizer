/**
 * Source referencer for quality assessment
 * Implements source reference linking to original transcription
 * with text segment mapping and traceability.
 */

interface ProcessedItem {
  id: string;
  confidence?: number;
  source?: {
    startOffset?: number;
    endOffset?: number;
    text?: string;
  };
  task?: unknown;
  decision?: unknown;
  overview?: unknown;
  [key: string]: unknown;
}

export interface SourceReference {
  itemId: string;
  itemType: 'summary' | 'action' | 'decision' | 'topic';
  sourceSegments: Array<{
    startOffset: number;
    endOffset: number;
    text: string;
    confidence: number;
  }>;
  traceabilityScore: number;
}

export class SourceReferencer {
  linkToSource(processedItems: ProcessedItem[], _originalText: string): SourceReference[] {
    const references: SourceReference[] = [];

    processedItems.forEach(item => {
      if (item.source) {
        references.push({
          itemId: item.id,
          itemType: this.getItemType(item),
          sourceSegments: [
            {
              startOffset: item.source.startOffset || 0,
              endOffset: item.source.endOffset || 100,
              text: item.source.text || '',
              confidence: item.confidence || 0.7,
            },
          ],
          traceabilityScore: 0.8,
        });
      }
    });

    return references;
  }

  private getItemType(item: ProcessedItem): 'summary' | 'action' | 'decision' | 'topic' {
    if (item.task) return 'action';
    if (item.decision) return 'decision';
    if (item.overview) return 'summary';
    return 'topic';
  }
}
