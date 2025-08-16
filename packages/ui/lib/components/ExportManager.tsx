/**
 * Export Manager Component
 *
 * Implements multi-format export functionality with format selection and download management.
 * Exports summaries and transcriptions in various formats.
 */

import { cn } from '../utils';
import { useState, useCallback, useMemo } from 'react';
import type {
  ExportManagerProps,
  ExportFormat,
  ExportFormatOption,
  ExportContentOptions,
  ExportStylingOptions,
  ExportNamingOptions,
  ExportMetadataOptions,
  ContentFilter,
} from '../types/summary';
import type { MeetingRecord } from '@extension/shared';
import type React from 'react';

/**
 * Default export format configurations
 */
const getDefaultExportFormats = (): ExportFormatOption[] => [
  {
    format: 'text',
    name: 'Plain Text',
    description: 'Simple text format with basic formatting',
    extension: 'txt',
    mimeType: 'text/plain',
    available: true,
    previewable: true,
    estimatedSize: '~50KB',
  },
  {
    format: 'json',
    name: 'JSON Data',
    description: 'Structured data format for developers',
    extension: 'json',
    mimeType: 'application/json',
    available: true,
    previewable: true,
    estimatedSize: '~100KB',
  },
  {
    format: 'pdf',
    name: 'PDF Document',
    description: 'Professional document format with formatting',
    extension: 'pdf',
    mimeType: 'application/pdf',
    available: true,
    previewable: false,
    estimatedSize: '~500KB',
  },
  {
    format: 'docx',
    name: 'Word Document',
    description: 'Microsoft Word compatible format',
    extension: 'docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    available: true,
    previewable: false,
    estimatedSize: '~300KB',
  },
  {
    format: 'html',
    name: 'HTML Page',
    description: 'Web page format with styling',
    extension: 'html',
    mimeType: 'text/html',
    available: true,
    previewable: true,
    estimatedSize: '~80KB',
  },
  {
    format: 'csv',
    name: 'CSV Spreadsheet',
    description: 'Comma-separated values for data analysis',
    extension: 'csv',
    mimeType: 'text/csv',
    available: true,
    previewable: true,
    estimatedSize: '~30KB',
  },
];

/**
 * Generate filename based on naming options
 */
const generateFilename = (meeting: MeetingRecord, format: ExportFormat, namingOptions: ExportNamingOptions): string => {
  const parts: string[] = [];

  // Custom prefix
  if (namingOptions.customPrefix) {
    parts.push(namingOptions.customPrefix);
  }

  // Meeting title
  if (namingOptions.includeMeetingTitle && meeting.title) {
    parts.push(meeting.title.replace(/[^a-zA-Z0-9\s-_]/g, ''));
  }

  // Meeting date
  if (namingOptions.includeMeetingDate && meeting.startTime) {
    const date = new Date(meeting.startTime);
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    if (dateStr) {
      parts.push(dateStr);
    }
  }

  // Export timestamp
  if (namingOptions.includeTimestamp) {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').split('T')[0];
    if (timestamp) {
      parts.push(timestamp);
    }
  }

  // Custom suffix
  if (namingOptions.customSuffix) {
    parts.push(namingOptions.customSuffix);
  }

  // Join parts and sanitize
  let filename = parts.join('_').replace(/\s+/g, '_');

  if (namingOptions.sanitizeFilename) {
    filename = filename.replace(/[^a-zA-Z0-9\-_]/g, '');
  }

  // Truncate if too long
  if (filename.length > namingOptions.maxFilenameLength) {
    filename = filename.substring(0, namingOptions.maxFilenameLength);
  }

  // Add extension
  const extension = getDefaultExportFormats().find(f => f.format === format)?.extension || 'txt';
  return `${filename}.${extension}`;
};

/**
 * Format selector component
 */
const FormatSelector: React.FC<{
  formats: ExportFormatOption[];
  selectedFormat: ExportFormat;
  onFormatChange: (format: ExportFormat) => void;
  compact?: boolean;
}> = ({ formats, selectedFormat, onFormatChange, compact = false }) => (
  <div className="space-y-3">
    <h3 className={cn('font-semibold text-gray-900', compact ? 'text-sm' : 'text-base')}>Export Format</h3>

    <div className={cn('grid gap-3', compact ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3')}>
      {formats
        .filter(f => f.available)
        .map(format => (
          <button
            key={format.format}
            onClick={() => onFormatChange(format.format)}
            disabled={!format.available}
            className={cn(
              'rounded-lg border p-3 text-left transition-all duration-200',
              selectedFormat === format.format
                ? 'border-blue-500 bg-blue-50 text-blue-900'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
              !format.available && 'cursor-not-allowed opacity-50',
              compact && 'p-2',
            )}>
            <div className="mb-1 flex items-center justify-between">
              <span className={cn('font-medium', compact ? 'text-sm' : 'text-base')}>{format.name}</span>
              {format.estimatedSize && (
                <span className={cn('text-gray-500', compact ? 'text-xs' : 'text-sm')}>{format.estimatedSize}</span>
              )}
            </div>
            <p className={cn('text-gray-600', compact ? 'text-xs' : 'text-sm')}>{format.description}</p>
            {format.previewable && (
              <div className="mt-2">
                <span className="inline-flex items-center rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">
                  Previewable
                </span>
              </div>
            )}
          </button>
        ))}
    </div>
  </div>
);

/**
 * Content options component
 */
const ContentOptionsPanel: React.FC<{
  options: ExportContentOptions;
  onOptionsChange: (options: Partial<ExportContentOptions>) => void;
  compact?: boolean;
}> = ({ options, onOptionsChange, compact = false }) => {
  const handleToggle = (key: keyof ExportContentOptions) => {
    onOptionsChange({ [key]: !(options[key] as boolean) });
  };

  return (
    <div className="space-y-3">
      <h3 className={cn('font-semibold text-gray-900', compact ? 'text-sm' : 'text-base')}>Content Options</h3>

      <div className={cn('grid gap-2', compact ? 'grid-cols-1' : 'grid-cols-2')}>
        {[
          { key: 'includeMetadata', label: 'Meeting Metadata' },
          { key: 'includeParticipants', label: 'Participants' },
          { key: 'includeSummary', label: 'Summary' },
          { key: 'includeActionItems', label: 'Action Items' },
          { key: 'includeTranscription', label: 'Full Transcription' },
          { key: 'includeTimestamps', label: 'Timestamps' },
          { key: 'includeSpeakers', label: 'Speaker IDs' },
          { key: 'includeConfidence', label: 'Confidence Scores' },
        ].map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={options[key as keyof ExportContentOptions] as boolean}
              onChange={() => handleToggle(key as keyof ExportContentOptions)}
              className="rounded"
            />
            <span className={cn('text-gray-700', compact ? 'text-sm' : 'text-base')}>{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

/**
 * Styling options component
 */
const StylingOptionsPanel: React.FC<{
  options: ExportStylingOptions;
  onOptionsChange: (options: Partial<ExportStylingOptions>) => void;
  compact?: boolean;
}> = ({ options, onOptionsChange, compact = false }) => (
  <div className="space-y-3">
    <h3 className={cn('font-semibold text-gray-900', compact ? 'text-sm' : 'text-base')}>Styling Options</h3>

    <div className="space-y-3">
      {/* Color Scheme */}
      <div>
        <label className={cn('mb-1 block text-gray-700', compact ? 'text-sm' : 'text-base')}>Color Scheme</label>
        <select
          value={options.colorScheme}
          onChange={e =>
            onOptionsChange({
              colorScheme: e.target.value as ExportStylingOptions['colorScheme'],
            })
          }
          className={cn('w-full rounded border border-gray-300 px-3 py-2', compact ? 'py-1 text-sm' : 'text-base')}>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="print">Print Optimized</option>
        </select>
      </div>

      {/* Font Family */}
      <div>
        <label className={cn('mb-1 block text-gray-700', compact ? 'text-sm' : 'text-base')}>Font Family</label>
        <select
          value={options.fontFamily}
          onChange={e => onOptionsChange({ fontFamily: e.target.value })}
          className={cn('w-full rounded border border-gray-300 px-3 py-2', compact ? 'py-1 text-sm' : 'text-base')}>
          <option value="Arial">Arial</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Helvetica">Helvetica</option>
          <option value="Georgia">Georgia</option>
          <option value="Courier New">Courier New</option>
        </select>
      </div>

      {/* Font Size */}
      <div>
        <label className={cn('mb-1 block text-gray-700', compact ? 'text-sm' : 'text-base')}>
          Font Size: {options.fontSize}pt
        </label>
        <input
          type="range"
          min="8"
          max="18"
          value={options.fontSize}
          onChange={e => onOptionsChange({ fontSize: Number(e.target.value) })}
          className="w-full"
        />
      </div>

      {/* Page Layout */}
      <div>
        <label className={cn('mb-1 block text-gray-700', compact ? 'text-sm' : 'text-base')}>Page Layout</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="pageLayout"
              value="portrait"
              checked={options.pageLayout === 'portrait'}
              onChange={e => onOptionsChange({ pageLayout: e.target.value as 'portrait' | 'landscape' })}
            />
            <span className={compact ? 'text-sm' : 'text-base'}>Portrait</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="pageLayout"
              value="landscape"
              checked={options.pageLayout === 'landscape'}
              onChange={e => onOptionsChange({ pageLayout: e.target.value as 'portrait' | 'landscape' })}
            />
            <span className={compact ? 'text-sm' : 'text-base'}>Landscape</span>
          </label>
        </div>
      </div>

      {/* Header/Footer */}
      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={options.headerFooter.includeHeader}
            onChange={e =>
              onOptionsChange({
                headerFooter: { ...options.headerFooter, includeHeader: e.target.checked },
              })
            }
            className="rounded"
          />
          <span className={compact ? 'text-sm' : 'text-base'}>Include Header</span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={options.headerFooter.includeFooter}
            onChange={e =>
              onOptionsChange({
                headerFooter: { ...options.headerFooter, includeFooter: e.target.checked },
              })
            }
            className="rounded"
          />
          <span className={compact ? 'text-sm' : 'text-base'}>Include Footer</span>
        </label>
      </div>
    </div>
  </div>
);

/**
 * Naming options component
 */
const NamingOptionsPanel: React.FC<{
  options: ExportNamingOptions;
  onOptionsChange: (options: Partial<ExportNamingOptions>) => void;
  meeting: MeetingRecord;
  selectedFormat: ExportFormat;
  compact?: boolean;
}> = ({ options, onOptionsChange, meeting, selectedFormat, compact = false }) => {
  const previewFilename = useMemo(
    () => generateFilename(meeting, selectedFormat, options),
    [meeting, selectedFormat, options],
  );

  return (
    <div className="space-y-3">
      <h3 className={cn('font-semibold text-gray-900', compact ? 'text-sm' : 'text-base')}>File Naming</h3>

      <div className="space-y-3">
        {/* Naming template */}
        <div>
          <label className={cn('mb-1 block text-gray-700', compact ? 'text-sm' : 'text-base')}>Naming Template</label>
          <input
            type="text"
            value={options.template}
            onChange={e => onOptionsChange({ template: e.target.value })}
            placeholder="{prefix}_{title}_{date}_{suffix}"
            className={cn('w-full rounded border border-gray-300 px-3 py-2', compact ? 'py-1 text-sm' : 'text-base')}
          />
        </div>

        {/* Include options */}
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={options.includeMeetingTitle}
              onChange={e => onOptionsChange({ includeMeetingTitle: e.target.checked })}
              className="rounded"
            />
            <span className={compact ? 'text-sm' : 'text-base'}>Include Meeting Title</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={options.includeMeetingDate}
              onChange={e => onOptionsChange({ includeMeetingDate: e.target.checked })}
              className="rounded"
            />
            <span className={compact ? 'text-sm' : 'text-base'}>Include Meeting Date</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={options.includeTimestamp}
              onChange={e => onOptionsChange({ includeTimestamp: e.target.checked })}
              className="rounded"
            />
            <span className={compact ? 'text-sm' : 'text-base'}>Include Export Timestamp</span>
          </label>
        </div>

        {/* Custom prefix/suffix */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={cn('mb-1 block text-gray-700', compact ? 'text-sm' : 'text-base')}>Prefix</label>
            <input
              type="text"
              value={options.customPrefix || ''}
              onChange={e => {
                const value = e.target.value;
                onOptionsChange(value ? { customPrefix: value } : {});
              }}
              placeholder="meeting"
              className={cn('w-full rounded border border-gray-300 px-3 py-2', compact ? 'py-1 text-sm' : 'text-base')}
            />
          </div>

          <div>
            <label className={cn('mb-1 block text-gray-700', compact ? 'text-sm' : 'text-base')}>Suffix</label>
            <input
              type="text"
              value={options.customSuffix || ''}
              onChange={e => {
                const value = e.target.value;
                onOptionsChange(value ? { customSuffix: value } : {});
              }}
              placeholder="export"
              className={cn('w-full rounded border border-gray-300 px-3 py-2', compact ? 'py-1 text-sm' : 'text-base')}
            />
          </div>
        </div>

        {/* Preview */}
        <div className="rounded border bg-gray-50 p-3">
          <span className={cn('text-gray-600', compact ? 'text-sm' : 'text-base')}>Preview:</span>
          <span className={cn('ml-2 font-mono', compact ? 'text-sm' : 'text-base')}>{previewFilename}</span>
        </div>
      </div>
    </div>
  );
};

/**
 * Export progress component
 */
const ExportProgress: React.FC<{
  isExporting: boolean;
  progress: number;
  compact?: boolean;
}> = ({ isExporting, progress, compact = false }) => {
  if (!isExporting) return null;

  return (
    <div className={cn('rounded border border-blue-200 bg-blue-50 p-4', compact && 'p-3')}>
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        <div className="flex-1">
          <div className="mb-1 flex items-center justify-between">
            <span className={cn('font-medium text-blue-900', compact ? 'text-sm' : 'text-base')}>Exporting...</span>
            <span className={cn('text-blue-700', compact ? 'text-sm' : 'text-base')}>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-blue-200">
            <div
              className="h-2 rounded-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Main ExportManager component
 */
export const ExportManager: React.FC<ExportManagerProps> = ({
  meeting,
  options,
  onExport,
  onProgress,
  onComplete,
  onError,
  className,
  isExporting = false,
  exportProgress = 0,
  showFormatSelection = true,
  showContentOptions = true,
  showStylingOptions = false,
  showNamingOptions = true,
}) => {
  // State management
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>(options.defaultFormat);
  const [contentOptions, setContentOptions] = useState<ExportContentOptions>(options.contentOptions);
  const [stylingOptions, setStylingOptions] = useState<ExportStylingOptions>(options.stylingOptions);
  const [namingOptions, setNamingOptions] = useState<ExportNamingOptions>(options.namingOptions);
  const [activeTab, setActiveTab] = useState<'format' | 'content' | 'styling' | 'naming'>('format');

  // Available formats from options or defaults
  const availableFormats = useMemo(
    () => (options.formats.length > 0 ? options.formats : getDefaultExportFormats()),
    [options.formats],
  );

  // Handle export
  const handleExport = useCallback(async () => {
    if (!onExport || isExporting) return;

    try {
      await onExport(selectedFormat, contentOptions);
      const filename = generateFilename(meeting, selectedFormat, namingOptions);
      onComplete?.(filename, selectedFormat);
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Export failed'));
    }
  }, [onExport, isExporting, selectedFormat, contentOptions, meeting, namingOptions, onComplete, onError]);

  // Update content options
  const handleContentOptionsChange = useCallback((newOptions: Partial<ExportContentOptions>) => {
    setContentOptions(prev => ({ ...prev, ...newOptions }));
  }, []);

  // Update styling options
  const handleStylingOptionsChange = useCallback((newOptions: Partial<ExportStylingOptions>) => {
    setStylingOptions(prev => ({ ...prev, ...newOptions }));
  }, []);

  // Update naming options
  const handleNamingOptionsChange = useCallback((newOptions: Partial<ExportNamingOptions>) => {
    setNamingOptions(prev => ({ ...prev, ...newOptions }));
  }, []);

  const isCompact = !showStylingOptions && !showNamingOptions;

  return (
    <div className={cn('rounded-lg border border-gray-200 bg-white', className)}>
      {/* Header */}
      <div className={cn('flex items-center justify-between border-b border-gray-200 p-4', isCompact && 'p-3')}>
        <div>
          <h2 className={cn('font-bold text-gray-900', isCompact ? 'text-lg' : 'text-xl')}>Export Meeting Data</h2>
          <p className={cn('mt-1 text-gray-600', isCompact ? 'text-sm' : 'text-base')}>{meeting.title}</p>
        </div>

        <button
          onClick={handleExport}
          disabled={isExporting}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50',
            isCompact && 'px-3 py-1 text-sm',
          )}>
          {isExporting ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>Exporting...</span>
            </>
          ) : (
            <>
              <span>📥</span>
              <span>Export</span>
            </>
          )}
        </button>
      </div>

      {/* Export Progress */}
      <ExportProgress isExporting={isExporting} progress={exportProgress} compact={isCompact} />

      {/* Navigation Tabs */}
      {(showContentOptions || showStylingOptions || showNamingOptions) && (
        <div className="border-b border-gray-200">
          <nav className="flex">
            {showFormatSelection && (
              <button
                onClick={() => setActiveTab('format')}
                className={cn(
                  'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                  activeTab === 'format'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700',
                )}>
                Format
              </button>
            )}
            {showContentOptions && (
              <button
                onClick={() => setActiveTab('content')}
                className={cn(
                  'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                  activeTab === 'content'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700',
                )}>
                Content
              </button>
            )}
            {showStylingOptions && (
              <button
                onClick={() => setActiveTab('styling')}
                className={cn(
                  'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                  activeTab === 'styling'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700',
                )}>
                Styling
              </button>
            )}
            {showNamingOptions && (
              <button
                onClick={() => setActiveTab('naming')}
                className={cn(
                  'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                  activeTab === 'naming'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700',
                )}>
                Naming
              </button>
            )}
          </nav>
        </div>
      )}

      {/* Content */}
      <div className={cn('p-4', isCompact && 'p-3')}>
        {/* Format Selection */}
        {((activeTab === 'format' && showFormatSelection) ||
          (!showContentOptions && !showStylingOptions && !showNamingOptions)) && (
          <FormatSelector
            formats={availableFormats}
            selectedFormat={selectedFormat}
            onFormatChange={setSelectedFormat}
            compact={isCompact}
          />
        )}

        {/* Content Options */}
        {activeTab === 'content' && showContentOptions && (
          <ContentOptionsPanel
            options={contentOptions}
            onOptionsChange={handleContentOptionsChange}
            compact={isCompact}
          />
        )}

        {/* Styling Options */}
        {activeTab === 'styling' && showStylingOptions && (
          <StylingOptionsPanel
            options={stylingOptions}
            onOptionsChange={handleStylingOptionsChange}
            compact={isCompact}
          />
        )}

        {/* Naming Options */}
        {activeTab === 'naming' && showNamingOptions && (
          <NamingOptionsPanel
            options={namingOptions}
            onOptionsChange={handleNamingOptionsChange}
            meeting={meeting}
            selectedFormat={selectedFormat}
            compact={isCompact}
          />
        )}
      </div>

      {/* Footer */}
      <div className={cn('rounded-b-lg border-t border-gray-200 bg-gray-50 px-4 py-3', isCompact && 'px-3 py-2')}>
        <div className="flex items-center justify-between">
          <div className={cn('text-gray-600', isCompact ? 'text-sm' : 'text-base')}>
            <span>Selected format: </span>
            <span className="font-medium">
              {availableFormats.find(f => f.format === selectedFormat)?.name || selectedFormat}
            </span>
          </div>

          <div className={cn('text-gray-500', isCompact ? 'text-xs' : 'text-sm')}>
            Estimated size: {availableFormats.find(f => f.format === selectedFormat)?.estimatedSize || 'Unknown'}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Quick export button for simple exports
 */
export const QuickExportButton: React.FC<{
  meeting: MeetingRecord;
  format: ExportFormat;
  onExport: (format: ExportFormat) => void;
  className?: string;
  children?: React.ReactNode;
}> = ({ meeting, format, onExport, className, children }) => {
  const formatInfo = getDefaultExportFormats().find(f => f.format === format);

  return (
    <button
      onClick={() => onExport(format)}
      className={cn(
        'inline-flex items-center gap-2 rounded bg-gray-100 px-3 py-1 text-sm text-gray-700 transition-colors hover:bg-gray-200',
        className,
      )}
      title={`Export as ${formatInfo?.name || format}`}>
      {children || (
        <>
          <span>📥</span>
          <span>{formatInfo?.name || format.toUpperCase()}</span>
        </>
      )}
    </button>
  );
};

/**
 * Compact export manager for limited space
 */
export const CompactExportManager: React.FC<
  Omit<ExportManagerProps, 'showStylingOptions' | 'showNamingOptions'>
> = props => <ExportManager {...props} showStylingOptions={false} showNamingOptions={false} />;
