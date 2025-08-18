/**
 * Transcription Viewer Component
 *
 * Implements searchable transcription text display with speaker identification
 * and timestamp navigation. Displays full transcription with search and navigation.
 */

import { cn } from '../utils';
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type {
  TranscriptionViewerProps,
  SearchHighlight,
  TranscriptionDisplayPreferences,
  ExportFormat,
  TranscriptionViewerState as _TranscriptionViewerState,
  TranscriptionViewerActions as _TranscriptionViewerActions,
} from '../types/summary';
import type {
  TranscriptionResult,
  TranscriptionSegment,
  TranscriptionWord,
  MeetingRecord as _MeetingRecord,
} from '@extension/shared';
import type React from 'react';

/**
 * Format timestamp for display
 */
const formatTimestamp = (seconds: number, format: 'relative' | 'absolute' | 'duration' = 'absolute'): string => {
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  switch (format) {
    case 'relative':
      if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    case 'absolute':
      if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    case 'duration':
      return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
    default:
      return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
};

/**
 * Get speaker display name
 */
const getSpeakerDisplay = (segment: TranscriptionSegment, displayMode: 'name' | 'initial' | 'id' | 'none'): string => {
  switch (displayMode) {
    case 'name':
      return segment.speakerName || segment.speakerId || 'Unknown Speaker';
    case 'initial': {
      const name = segment.speakerName || segment.speakerId || 'Unknown';
      return name
        .split(' ')
        .map(n => n.charAt(0))
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    case 'id':
      return segment.speakerId || 'Unknown';
    case 'none':
      return '';
    default:
      return segment.speakerName || 'Speaker';
  }
};

/**
 * Search functionality hook
 */
const useTranscriptionSearch = (transcription: TranscriptionResult, onSearch?: (query: string) => void) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchHighlight[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);

  const performSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      onSearch?.(query);

      if (!query.trim()) {
        setSearchResults([]);
        setCurrentSearchIndex(0);
        return;
      }

      const results: SearchHighlight[] = [];
      const normalizedQuery = query.toLowerCase();

      transcription.segments.forEach(segment => {
        const text = segment.text.toLowerCase();
        let startIndex = 0;

        while (true) {
          const index = text.indexOf(normalizedQuery, startIndex);
          if (index === -1) break;

          results.push({
            start: index,
            end: index + normalizedQuery.length,
            type: 'search',
            context: segment.text.substring(Math.max(0, index - 20), index + normalizedQuery.length + 20),
            segmentId: segment.id,
          });

          startIndex = index + 1;
        }
      });

      setSearchResults(results);
      setCurrentSearchIndex(0);
    },
    [transcription, onSearch],
  );

  const nextSearchResult = useCallback(() => {
    if (searchResults.length === 0) return;
    setCurrentSearchIndex(prev => (prev + 1) % searchResults.length);
  }, [searchResults.length]);

  const previousSearchResult = useCallback(() => {
    if (searchResults.length === 0) return;
    setCurrentSearchIndex(prev => (prev - 1 + searchResults.length) % searchResults.length);
  }, [searchResults.length]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setCurrentSearchIndex(0);
  }, []);

  return {
    searchQuery,
    searchResults,
    currentSearchIndex,
    performSearch,
    nextSearchResult,
    previousSearchResult,
    clearSearch,
  };
};

/**
 * Search controls component
 */
const SearchControls: React.FC<{
  searchQuery: string;
  searchResults: SearchHighlight[];
  currentSearchIndex: number;
  onSearch: (query: string) => void;
  onNext: () => void;
  onPrevious: () => void;
  onClear: () => void;
  compact?: boolean;
}> = ({ searchQuery, searchResults, currentSearchIndex, onSearch, onNext, onPrevious, onClear, compact = false }) => (
  <div className={cn('flex items-center gap-2 border-b border-gray-200 bg-gray-50 p-3', compact && 'p-2')}>
    <div className="relative flex-1">
      <input
        type="text"
        value={searchQuery}
        onChange={e => onSearch(e.target.value)}
        placeholder="Search transcription..."
        className={cn(
          'w-full rounded-md border border-gray-300 px-3 py-2 pr-8 focus:border-blue-500 focus:ring-2 focus:ring-blue-500',
          compact && 'px-2 py-1 text-sm',
        )}
      />
      {searchQuery && (
        <button
          onClick={onClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 transform text-gray-400 hover:text-gray-600">
          ✕
        </button>
      )}
    </div>

    {searchResults.length > 0 && (
      <>
        <div className={cn('text-gray-600', compact ? 'text-xs' : 'text-sm')}>
          {currentSearchIndex + 1} of {searchResults.length}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onPrevious}
            disabled={searchResults.length === 0}
            className={cn(
              'rounded border border-gray-300 px-2 py-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50',
              compact ? 'text-xs' : 'text-sm',
            )}>
            ↑
          </button>
          <button
            onClick={onNext}
            disabled={searchResults.length === 0}
            className={cn(
              'rounded border border-gray-300 px-2 py-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50',
              compact ? 'text-xs' : 'text-sm',
            )}>
            ↓
          </button>
        </div>
      </>
    )}
  </div>
);

/**
 * Highlight text with search results
 */
const HighlightedText: React.FC<{
  text: string;
  highlights: SearchHighlight[];
  segmentId: string;
  className?: string;
}> = ({ text, highlights, segmentId, className }) => {
  const segmentHighlights = highlights.filter(h => h.segmentId === segmentId);

  if (segmentHighlights.length === 0) {
    return <span className={className}>{text}</span>;
  }

  const parts: Array<{ text: string; highlighted: boolean }> = [];
  let lastEnd = 0;

  segmentHighlights
    .sort((a, b) => a.start - b.start)
    .forEach(highlight => {
      // Add text before highlight
      if (highlight.start > lastEnd) {
        parts.push({ text: text.slice(lastEnd, highlight.start), highlighted: false });
      }

      // Add highlighted text
      parts.push({ text: text.slice(highlight.start, highlight.end), highlighted: true });
      lastEnd = highlight.end;
    });

  // Add remaining text
  if (lastEnd < text.length) {
    parts.push({ text: text.slice(lastEnd), highlighted: false });
  }

  return (
    <span className={className}>
      {parts.map((part, index) => (
        <span key={index} className={part.highlighted ? 'rounded bg-yellow-300 px-0.5 text-yellow-900' : ''}>
          {part.text}
        </span>
      ))}
    </span>
  );
};

/**
 * Confidence indicator component
 */
const ConfidenceIndicator: React.FC<{
  confidence: number;
  threshold: number;
  compact?: boolean;
}> = ({ confidence, threshold, compact = false }) => {
  const getConfidenceColor = (confidence: number, threshold: number) => {
    if (confidence >= threshold) return 'bg-green-500';
    if (confidence >= threshold * 0.7) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getConfidenceText = (confidence: number) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  return (
    <div className={cn('inline-flex items-center gap-1', compact ? 'text-xs' : 'text-sm')}>
      <div className={cn('h-2 w-2 rounded-full', getConfidenceColor(confidence, threshold))} />
      {!compact && (
        <span className="text-gray-500">
          {getConfidenceText(confidence)} ({Math.round(confidence * 100)}%)
        </span>
      )}
    </div>
  );
};

/**
 * Word-level timing component
 */
const WordTimingDisplay: React.FC<{
  words: TranscriptionWord[];
  onTimestampClick?: (timestamp: number) => void;
  compact?: boolean;
}> = ({ words, onTimestampClick, compact = false }) => (
  <div className={cn('mt-2 flex flex-wrap gap-1 rounded bg-gray-50 p-2 text-xs', compact && 'text-xs')}>
    {words.map((word, index) => (
      <button
        key={index}
        onClick={() => onTimestampClick?.(word.startTime)}
        className={cn('rounded px-1 transition-colors hover:bg-blue-100', word.confidence < 0.5 && 'text-red-600')}
        title={`${word.word} (${Math.round(word.confidence * 100)}% confidence)`}>
        {word.word}
      </button>
    ))}
  </div>
);

/**
 * Individual transcription segment component
 */
const TranscriptionSegmentComponent: React.FC<{
  segment: TranscriptionSegment;
  displayPreferences: TranscriptionDisplayPreferences;
  highlights: SearchHighlight[];
  isSelected?: boolean;
  onSegmentClick?: (segment: TranscriptionSegment) => void;
  onTimestampClick?: (timestamp: number) => void;
  onTextSelect?: (selectedText: string, segment: TranscriptionSegment) => void;
}> = ({
  segment,
  displayPreferences,
  highlights,
  isSelected = false,
  onSegmentClick,
  onTimestampClick,
  onTextSelect,
}) => {
  const [selectedText, setSelectedText] = useState('');
  const segmentRef = useRef<HTMLDivElement>(null);

  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      const text = selection.toString().trim();
      setSelectedText(text);
      onTextSelect?.(text, segment);
    }
  }, [segment, onTextSelect]);

  const speakerDisplay = getSpeakerDisplay(segment, displayPreferences.speakerDisplay);
  const timestampDisplay = formatTimestamp(segment.startTime, displayPreferences.timestampFormat);

  const showConfidence = segment.confidence < displayPreferences.confidenceThreshold;

  return (
    <div
      ref={segmentRef}
      className={cn(
        'border-l-4 p-3 transition-all duration-200',
        isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200',
        onSegmentClick && 'cursor-pointer hover:bg-gray-50',
        displayPreferences.lineSpacing === 'compact' && 'py-2',
        displayPreferences.lineSpacing === 'relaxed' && 'py-4',
      )}
      onClick={() => onSegmentClick?.(segment)}>
      {/* Segment Header */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Speaker */}
          {displayPreferences.speakerDisplay !== 'none' && speakerDisplay && (
            <div
              className={cn(
                'flex items-center gap-2',
                displayPreferences.fontSize === 'small'
                  ? 'text-sm'
                  : displayPreferences.fontSize === 'large'
                    ? 'text-lg'
                    : 'text-base',
              )}>
              {displayPreferences.speakerDisplay === 'initial' ? (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-800">
                  {speakerDisplay}
                </div>
              ) : (
                <span className="font-medium text-gray-700">{speakerDisplay}</span>
              )}
            </div>
          )}

          {/* Timestamp */}
          <button
            onClick={e => {
              e.stopPropagation();
              onTimestampClick?.(segment.startTime);
            }}
            className={cn(
              'font-mono text-blue-600 transition-colors hover:text-blue-800',
              displayPreferences.fontSize === 'small' ? 'text-xs' : 'text-sm',
            )}
            title="Jump to this time">
            {timestampDisplay}
          </button>

          {/* Confidence Indicator */}
          {showConfidence && (
            <ConfidenceIndicator
              confidence={segment.confidence}
              threshold={displayPreferences.confidenceThreshold}
              compact={displayPreferences.fontSize === 'small'}
            />
          )}
        </div>

        {/* Duration */}
        <span className={cn('text-gray-500', displayPreferences.fontSize === 'small' ? 'text-xs' : 'text-sm')}>
          {formatTimestamp(segment.endTime - segment.startTime, 'duration')}
        </span>
      </div>

      {/* Transcript Text */}
      <div
        onMouseUp={handleTextSelection}
        className={cn(
          'select-text leading-relaxed text-gray-900',
          displayPreferences.fontSize === 'small'
            ? 'text-sm'
            : displayPreferences.fontSize === 'large'
              ? 'text-lg'
              : 'text-base',
          displayPreferences.lineSpacing === 'compact' && 'leading-tight',
          displayPreferences.lineSpacing === 'relaxed' && 'leading-loose',
        )}>
        <HighlightedText text={segment.text} highlights={highlights} segmentId={segment.id} />
      </div>

      {/* Word-level timing */}
      {displayPreferences.showWordTiming && segment.words && segment.words.length > 0 && (
        <WordTimingDisplay
          words={segment.words}
          {...(onTimestampClick && { onTimestampClick })}
          compact={displayPreferences.fontSize === 'small'}
        />
      )}

      {/* Selected text indicator */}
      {selectedText && (
        <div className="mt-2 rounded border border-blue-200 bg-blue-50 p-2 text-sm">
          <span className="text-blue-700">Selected: "{selectedText}"</span>
        </div>
      )}
    </div>
  );
};

/**
 * Display preferences controls
 */
const DisplayPreferencesControls: React.FC<{
  preferences: TranscriptionDisplayPreferences;
  onPreferencesChange: (preferences: Partial<TranscriptionDisplayPreferences>) => void;
  compact?: boolean;
}> = ({ preferences, onPreferencesChange, compact = false }) => (
  <div className={cn('space-y-3 border-b border-gray-200 bg-gray-50 p-3', compact && 'space-y-2 p-2')}>
    <div className="flex flex-wrap gap-4">
      {/* Font Size */}
      <div className="flex items-center gap-2">
        <label className={cn('text-gray-700', compact ? 'text-sm' : 'text-base')}>Font Size:</label>
        <select
          value={preferences.fontSize}
          onChange={e =>
            onPreferencesChange({
              fontSize: e.target.value as TranscriptionDisplayPreferences['fontSize'],
            })
          }
          className={cn('rounded border border-gray-300 px-2 py-1', compact ? 'text-sm' : 'text-base')}>
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </div>

      {/* Speaker Display */}
      <div className="flex items-center gap-2">
        <label className={cn('text-gray-700', compact ? 'text-sm' : 'text-base')}>Speaker:</label>
        <select
          value={preferences.speakerDisplay}
          onChange={e =>
            onPreferencesChange({
              speakerDisplay: e.target.value as TranscriptionDisplayPreferences['speakerDisplay'],
            })
          }
          className={cn('rounded border border-gray-300 px-2 py-1', compact ? 'text-sm' : 'text-base')}>
          <option value="name">Full Name</option>
          <option value="initial">Initials</option>
          <option value="id">Speaker ID</option>
          <option value="none">None</option>
        </select>
      </div>

      {/* Timestamp Format */}
      <div className="flex items-center gap-2">
        <label className={cn('text-gray-700', compact ? 'text-sm' : 'text-base')}>Time:</label>
        <select
          value={preferences.timestampFormat}
          onChange={e =>
            onPreferencesChange({
              timestampFormat: e.target.value as TranscriptionDisplayPreferences['timestampFormat'],
            })
          }
          className={cn('rounded border border-gray-300 px-2 py-1', compact ? 'text-sm' : 'text-base')}>
          <option value="absolute">Absolute</option>
          <option value="relative">Relative</option>
          <option value="duration">Duration</option>
        </select>
      </div>
    </div>

    <div className="flex flex-wrap gap-4">
      {/* Toggles */}
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={preferences.groupBySpeaker}
          onChange={e => onPreferencesChange({ groupBySpeaker: e.target.checked })}
          className="rounded"
        />
        <span className={cn('text-gray-700', compact ? 'text-sm' : 'text-base')}>Group by Speaker</span>
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={preferences.showWordTiming}
          onChange={e => onPreferencesChange({ showWordTiming: e.target.checked })}
          className="rounded"
        />
        <span className={cn('text-gray-700', compact ? 'text-sm' : 'text-base')}>Word Timing</span>
      </label>
    </div>
  </div>
);

/**
 * Export controls component
 */
const ExportControls: React.FC<{
  onExport: (format: ExportFormat) => void;
  compact?: boolean;
}> = ({ onExport, compact = false }) => {
  const exportFormats: { format: ExportFormat; label: string; icon: string }[] = [
    { format: 'text', label: 'Text', icon: '📄' },
    { format: 'json', label: 'JSON', icon: '🔧' },
    { format: 'csv', label: 'CSV', icon: '📊' },
    { format: 'html', label: 'HTML', icon: '🌐' },
  ];

  return (
    <div className={cn('border-t border-gray-200 bg-gray-50 p-3', compact && 'p-2')}>
      <div className="flex items-center justify-between">
        <span className={cn('font-medium text-gray-700', compact ? 'text-sm' : 'text-base')}>Export Transcription</span>
        <div className="flex items-center gap-1">
          {exportFormats.map(({ format, label, icon }) => (
            <button
              key={format}
              onClick={() => onExport(format)}
              className={cn(
                'inline-flex items-center gap-1 rounded px-2 py-1 text-gray-600 transition-colors hover:bg-blue-50 hover:text-blue-600',
                compact ? 'text-xs' : 'text-sm',
              )}
              title={`Export as ${label}`}>
              <span>{icon}</span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Main TranscriptionViewer component
 */
export const TranscriptionViewer: React.FC<TranscriptionViewerProps> = ({
  transcription,
  meeting,
  showSpeakers = true,
  showTimestamps: _showTimestamps = true,
  showConfidence: _showConfidence = false,
  searchable = true,
  searchQuery: externalSearchQuery,
  highlights: externalHighlights = [],
  selectable = true,
  className,
  onSegmentClick,
  onTextSelect,
  onSearch,
  onTimestampClick,
  onExport,
  displayPreferences: externalPreferences,
}) => {
  // Default display preferences
  const defaultPreferences: TranscriptionDisplayPreferences = {
    fontSize: 'medium',
    lineSpacing: 'normal',
    groupBySpeaker: false,
    timestampFormat: 'absolute',
    speakerDisplay: showSpeakers ? 'name' : 'none',
    confidenceThreshold: 0.7,
    showWordTiming: false,
    colorScheme: 'auto',
  };

  const [displayPreferences, setDisplayPreferences] = useState<TranscriptionDisplayPreferences>({
    ...defaultPreferences,
    ...externalPreferences,
  });

  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [showPreferences, setShowPreferences] = useState(false);

  // Search functionality
  const {
    searchQuery,
    searchResults,
    currentSearchIndex,
    performSearch,
    nextSearchResult,
    previousSearchResult,
    clearSearch,
  } = useTranscriptionSearch(transcription, onSearch);

  // Use external search query if provided
  useEffect(() => {
    if (externalSearchQuery !== undefined && externalSearchQuery !== searchQuery) {
      performSearch(externalSearchQuery);
    }
  }, [externalSearchQuery, searchQuery, performSearch]);

  // Combine search highlights with external highlights
  const allHighlights = useMemo(() => [...searchResults, ...externalHighlights], [searchResults, externalHighlights]);

  // Group segments by speaker if enabled
  const groupedSegments = useMemo(() => {
    if (!displayPreferences.groupBySpeaker) {
      return [{ speaker: null, segments: transcription.segments }];
    }

    const groups = new Map<string, TranscriptionSegment[]>();

    transcription.segments.forEach(segment => {
      const speakerKey = segment.speakerId || segment.speakerName || 'Unknown';
      if (!groups.has(speakerKey)) {
        groups.set(speakerKey, []);
      }
      groups.get(speakerKey)!.push(segment);
    });

    return Array.from(groups.entries()).map(([speaker, segments]) => ({
      speaker,
      segments,
    }));
  }, [transcription.segments, displayPreferences.groupBySpeaker]);

  // Handle segment click
  const handleSegmentClick = useCallback(
    (segment: TranscriptionSegment) => {
      setSelectedSegmentId(segment.id);
      onSegmentClick?.(segment);
    },
    [onSegmentClick],
  );

  // Handle preferences change
  const handlePreferencesChange = useCallback((newPreferences: Partial<TranscriptionDisplayPreferences>) => {
    setDisplayPreferences(prev => ({ ...prev, ...newPreferences }));
  }, []);

  // Handle export
  const handleExport = useCallback(
    (format: ExportFormat) => {
      onExport?.(format);
    },
    [onExport],
  );

  const isCompact = displayPreferences.fontSize === 'small';

  return (
    <div className={cn('overflow-hidden rounded-lg border border-gray-200 bg-white', className)}>
      {/* Header */}
      <div
        className={cn('flex items-center justify-between border-b border-gray-200 bg-gray-50 p-4', isCompact && 'p-3')}>
        <div>
          <h2 className={cn('font-bold text-gray-900', isCompact ? 'text-lg' : 'text-xl')}>Meeting Transcription</h2>
          <div className={cn('mt-1 text-gray-600', isCompact ? 'text-sm' : 'text-base')}>
            {meeting.title} • {transcription.segments.length} segments • {transcription.language}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreferences(!showPreferences)}
            className={cn(
              'rounded border border-gray-300 px-3 py-1 text-gray-600 transition-colors hover:text-blue-600',
              isCompact ? 'px-2 text-sm' : 'text-base',
            )}>
            ⚙️ Settings
          </button>
        </div>
      </div>

      {/* Search Controls */}
      {searchable && (
        <SearchControls
          searchQuery={searchQuery}
          searchResults={searchResults}
          currentSearchIndex={currentSearchIndex}
          onSearch={performSearch}
          onNext={nextSearchResult}
          onPrevious={previousSearchResult}
          onClear={clearSearch}
          compact={isCompact}
        />
      )}

      {/* Display Preferences */}
      {showPreferences && (
        <DisplayPreferencesControls
          preferences={displayPreferences}
          onPreferencesChange={handlePreferencesChange}
          compact={isCompact}
        />
      )}

      {/* Transcription Content */}
      <div className="max-h-96 overflow-y-auto">
        {transcription.segments.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            <p className={isCompact ? 'text-sm' : 'text-base'}>No transcription segments available.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {groupedSegments.map((group, groupIndex) => (
              <div key={groupIndex}>
                {/* Speaker Group Header */}
                {displayPreferences.groupBySpeaker && group.speaker && (
                  <div className={cn('border-b border-blue-100 bg-blue-50 px-4 py-2', isCompact && 'px-3 py-1')}>
                    <h3 className={cn('font-semibold text-blue-900', isCompact ? 'text-sm' : 'text-base')}>
                      {getSpeakerDisplay({ speakerName: group.speaker } as TranscriptionSegment, 'name')}
                    </h3>
                  </div>
                )}

                {/* Segments */}
                {group.segments.map(segment => (
                  <TranscriptionSegmentComponent
                    key={segment.id}
                    segment={segment}
                    displayPreferences={displayPreferences}
                    highlights={allHighlights}
                    isSelected={selectedSegmentId === segment.id}
                    {...(selectable && handleSegmentClick && { onSegmentClick: handleSegmentClick })}
                    {...(onTimestampClick && { onTimestampClick })}
                    {...(onTextSelect && { onTextSelect })}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Export Controls */}
      {onExport && <ExportControls onExport={handleExport} compact={isCompact} />}
    </div>
  );
};

/**
 * Compact transcription viewer for use in sidebars
 */
export const CompactTranscriptionViewer: React.FC<Omit<TranscriptionViewerProps, 'displayPreferences'>> = props => (
  <TranscriptionViewer
    {...props}
    displayPreferences={{
      fontSize: 'small',
      lineSpacing: 'compact',
      groupBySpeaker: false,
      timestampFormat: 'relative',
      speakerDisplay: 'initial',
      confidenceThreshold: 0.7,
      showWordTiming: false,
      colorScheme: 'auto',
    }}
  />
);

/**
 * Search-focused transcription viewer
 */
export const SearchableTranscriptionViewer: React.FC<TranscriptionViewerProps> = props => (
  <TranscriptionViewer
    {...props}
    searchable={true}
    showConfidence={true}
    displayPreferences={{
      fontSize: 'medium',
      lineSpacing: 'normal',
      groupBySpeaker: false,
      timestampFormat: 'absolute',
      speakerDisplay: 'name',
      confidenceThreshold: 0.6,
      showWordTiming: true,
      colorScheme: 'auto',
      ...props.displayPreferences,
    }}
  />
);
