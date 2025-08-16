/**
 * Preferences Panel Component
 *
 * Implements auto-transcription and notification settings with summary format
 * and language preference controls. Provides comprehensive user preference management.
 */

import { cn } from '@extension/ui';
import { useState, useCallback } from 'react';
import type {
  UserPreferences,
  GeneralPreferences,
  TranscriptionPreferences,
  NotificationPreferences,
  PrivacyPreferences,
  InterfacePreferences,
  ExportPreferences,
  NotificationType,
} from '../types/options-state';
import type React from 'react';

/**
 * Preferences panel component props
 */
interface PreferencesPanelProps {
  /** Current user preferences */
  preferences: UserPreferences;
  /** Preferences update handler */
  onPreferencesChange?: (preferences: Partial<UserPreferences>) => void;
  /** Whether form is loading */
  isLoading?: boolean;
  /** Whether form has unsaved changes */
  isDirty?: boolean;
  /** Save handler */
  onSave?: () => Promise<void>;
  /** Reset handler */
  onReset?: () => void;
  /** Custom class name */
  className?: string;
  /** Whether component is in compact mode */
  compact?: boolean;
}

/**
 * Toggle switch component
 */
interface ToggleSwitchProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  compact?: boolean;
}

/**
 * Select field component
 */
interface SelectFieldProps {
  id: string;
  label: string;
  description?: string;
  value: string;
  options: Array<{ value: string; label: string; description?: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
  compact?: boolean;
}

/**
 * Number input field component
 */
interface NumberFieldProps {
  id: string;
  label: string;
  description?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  disabled?: boolean;
  compact?: boolean;
}

/**
 * Time input field component
 */
interface TimeFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  compact?: boolean;
}

/**
 * Toggle switch component
 */
const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  id,
  label,
  description,
  checked,
  onChange,
  disabled = false,
  compact = false,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.checked);
  };

  return (
    <div className={cn('flex items-start justify-between', compact ? 'py-2' : 'py-3')}>
      <div className="mr-4 min-w-0 flex-1">
        <label
          htmlFor={id}
          className={cn('cursor-pointer font-medium text-gray-900', compact ? 'text-sm' : 'text-base')}>
          {label}
        </label>
        {description && <p className={cn('mt-1 text-gray-600', compact ? 'text-xs' : 'text-sm')}>{description}</p>}
      </div>
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => onChange(!checked)}
          disabled={disabled}
          className={cn(
            'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            checked ? 'bg-blue-600' : 'bg-gray-200',
          )}
          role="switch"
          aria-checked={checked}
          aria-labelledby={id}>
          <span
            className={cn(
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
              checked ? 'translate-x-5' : 'translate-x-0',
            )}
          />
        </button>
        <input
          type="checkbox"
          id={id}
          className="sr-only"
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
};

/**
 * Select field component
 */
const SelectField: React.FC<SelectFieldProps> = ({
  id,
  label,
  description,
  value,
  options,
  onChange,
  disabled = false,
  compact = false,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className={compact ? 'space-y-1' : 'space-y-2'}>
      <label htmlFor={id} className={cn('block font-medium text-gray-900', compact ? 'text-sm' : 'text-base')}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        className={cn(
          'block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500',
          compact ? 'py-1 text-sm' : 'py-2 text-base',
        )}>
        {options.map(option => (
          <option key={option.value} value={option.value} title={option.description}>
            {option.label}
          </option>
        ))}
      </select>
      {description && <p className={cn('text-gray-600', compact ? 'text-xs' : 'text-sm')}>{description}</p>}
    </div>
  );
};

/**
 * Number input field component
 */
const NumberField: React.FC<NumberFieldProps> = ({
  id,
  label,
  description,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
  disabled = false,
  compact = false,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    if (!isNaN(newValue)) {
      onChange(newValue);
    }
  };

  return (
    <div className={compact ? 'space-y-1' : 'space-y-2'}>
      <label htmlFor={id} className={cn('block font-medium text-gray-900', compact ? 'text-sm' : 'text-base')}>
        {label}
      </label>
      <div className="relative">
        <input
          type="number"
          id={id}
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={handleChange}
          disabled={disabled}
          className={cn(
            'block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500',
            unit ? 'pr-12' : '',
            compact ? 'py-1 text-sm' : 'py-2 text-base',
          )}
        />
        {unit && (
          <div
            className={cn(
              'pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500',
              compact ? 'text-xs' : 'text-sm',
            )}>
            {unit}
          </div>
        )}
      </div>
      {description && <p className={cn('text-gray-600', compact ? 'text-xs' : 'text-sm')}>{description}</p>}
    </div>
  );
};

/**
 * Time input field component
 */
const TimeField: React.FC<TimeFieldProps> = ({ id, label, value, onChange, disabled = false, compact = false }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className={compact ? 'space-y-1' : 'space-y-2'}>
      <label htmlFor={id} className={cn('block font-medium text-gray-900', compact ? 'text-sm' : 'text-base')}>
        {label}
      </label>
      <input
        type="time"
        id={id}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        className={cn(
          'block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500',
          compact ? 'py-1 text-sm' : 'py-2 text-base',
        )}
      />
    </div>
  );
};

/**
 * Notification types configuration component
 */
const NotificationTypesConfig: React.FC<{
  types: NotificationType[];
  onChange: (types: NotificationType[]) => void;
  disabled?: boolean;
  compact?: boolean;
}> = ({ types, onChange, disabled = false, compact = false }) => {
  const handleTypeChange = (typeId: string, field: keyof NotificationType, value: boolean | string | number) => {
    const updatedTypes = types.map(type => (type.type === typeId ? { ...type, [field]: value } : type));
    onChange(updatedTypes);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'completion':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '📢';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'completion':
        return 'Completion Notifications';
      case 'error':
        return 'Error Notifications';
      case 'warning':
        return 'Warning Notifications';
      case 'info':
        return 'Information Notifications';
      default:
        return type;
    }
  };

  return (
    <div className="space-y-3">
      <h4 className={cn('font-medium text-gray-900', compact ? 'text-sm' : 'text-base')}>Notification Types</h4>
      <div className="space-y-3">
        {types.map(notificationType => (
          <div key={notificationType.type} className={cn('rounded-lg border border-gray-200', compact ? 'p-3' : 'p-4')}>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{getTypeIcon(notificationType.type)}</span>
                <span className={cn('font-medium text-gray-900', compact ? 'text-sm' : 'text-base')}>
                  {getTypeLabel(notificationType.type)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleTypeChange(notificationType.type, 'enabled', !notificationType.enabled)}
                disabled={disabled}
                className={cn(
                  'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                  notificationType.enabled ? 'bg-blue-600' : 'bg-gray-200',
                )}>
                <span
                  className={cn(
                    'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                    notificationType.enabled ? 'translate-x-4' : 'translate-x-0',
                  )}
                />
              </button>
            </div>

            {notificationType.enabled && (
              <div className="grid grid-cols-2 gap-3">
                <SelectField
                  id={`${notificationType.type}-priority`}
                  label="Priority"
                  value={notificationType.priority}
                  options={[
                    { value: 'high', label: 'High' },
                    { value: 'normal', label: 'Normal' },
                    { value: 'low', label: 'Low' },
                  ]}
                  onChange={value => handleTypeChange(notificationType.type, 'priority', value)}
                  disabled={disabled}
                  compact={compact}
                />
                <NumberField
                  id={`${notificationType.type}-timeout`}
                  label="Auto-dismiss"
                  value={notificationType.timeout || 5}
                  min={0}
                  max={60}
                  unit="sec"
                  onChange={value => handleTypeChange(notificationType.type, 'timeout', value)}
                  disabled={disabled}
                  compact={compact}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Main PreferencesPanel component
 */
export const PreferencesPanel: React.FC<PreferencesPanelProps> = ({
  preferences,
  onPreferencesChange,
  isLoading = false,
  isDirty = false,
  onSave,
  onReset,
  className,
  compact = false,
}) => {
  const [activeTab, setActiveTab] = useState<string>('general');

  // Handle preference updates
  const updatePreferences = useCallback(
    (section: keyof UserPreferences, updates: Partial<any>) => {
      onPreferencesChange?.({
        [section]: {
          ...preferences[section],
          ...updates,
        },
      });
    },
    [preferences, onPreferencesChange],
  );

  const containerPadding = compact ? 'p-4' : 'p-6';
  const sectionGap = compact ? 'space-y-4' : 'space-y-6';
  const headerSize = compact ? 'text-xl' : 'text-2xl';

  const tabs = [
    { id: 'general', label: 'General', icon: '⚙️' },
    { id: 'transcription', label: 'Transcription', icon: '📝' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    { id: 'privacy', label: 'Privacy', icon: '🔒' },
    { id: 'interface', label: 'Interface', icon: '🎨' },
    { id: 'export', label: 'Export', icon: '📤' },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div className={sectionGap}>
            <h3 className={cn('font-semibold text-gray-900', compact ? 'text-lg' : 'text-xl')}>General Settings</h3>
            <div className="space-y-4">
              <ToggleSwitch
                id="auto-start"
                label="Auto-start Transcription"
                description="Automatically begin transcribing when a meeting is detected"
                checked={preferences.general.autoStartTranscription}
                onChange={checked => updatePreferences('general', { autoStartTranscription: checked })}
                disabled={isLoading}
                compact={compact}
              />
              <ToggleSwitch
                id="auto-save"
                label="Auto-save Transcriptions"
                description="Automatically save completed transcriptions"
                checked={preferences.general.autoSaveTranscriptions}
                onChange={checked => updatePreferences('general', { autoSaveTranscriptions: checked })}
                disabled={isLoading}
                compact={compact}
              />
              <SelectField
                id="default-language"
                label="Default Language"
                description="Primary language for speech recognition"
                value={preferences.general.defaultLanguage}
                options={[
                  { value: 'en-US', label: 'English (US)' },
                  { value: 'en-GB', label: 'English (UK)' },
                  { value: 'zh-CN', label: '中文 (簡體)' },
                  { value: 'zh-TW', label: '中文 (繁體)' },
                  { value: 'ja-JP', label: '日本語' },
                  { value: 'ko-KR', label: '한국어' },
                  { value: 'es-ES', label: 'Español' },
                  { value: 'fr-FR', label: 'Français' },
                  { value: 'de-DE', label: 'Deutsch' },
                ]}
                onChange={value => updatePreferences('general', { defaultLanguage: value })}
                disabled={isLoading}
                compact={compact}
              />
              <ToggleSwitch
                id="keep-active"
                label="Keep Extension Active"
                description="Maintain extension activity in background"
                checked={preferences.general.keepActive}
                onChange={checked => updatePreferences('general', { keepActive: checked })}
                disabled={isLoading}
                compact={compact}
              />
              <ToggleSwitch
                id="auto-update"
                label="Automatic Updates"
                description="Check for and install updates automatically"
                checked={preferences.general.autoUpdate}
                onChange={checked => updatePreferences('general', { autoUpdate: checked })}
                disabled={isLoading}
                compact={compact}
              />
              <ToggleSwitch
                id="analytics"
                label="Usage Analytics"
                description="Send anonymous usage statistics to help improve the extension"
                checked={preferences.general.allowAnalytics}
                onChange={checked => updatePreferences('general', { allowAnalytics: checked })}
                disabled={isLoading}
                compact={compact}
              />
            </div>
          </div>
        );

      case 'transcription':
        return (
          <div className={sectionGap}>
            <h3 className={cn('font-semibold text-gray-900', compact ? 'text-lg' : 'text-xl')}>
              Transcription Settings
            </h3>
            <div className="space-y-4">
              <SelectField
                id="audio-quality"
                label="Audio Quality"
                description="Balance between speed and accuracy"
                value={preferences.transcription.audioQuality}
                options={[
                  { value: 'fast', label: 'Fast', description: 'Fastest processing, lower accuracy' },
                  { value: 'balanced', label: 'Balanced', description: 'Good balance of speed and accuracy' },
                  { value: 'high', label: 'High Quality', description: 'Best accuracy, slower processing' },
                ]}
                onChange={value =>
                  updatePreferences('transcription', { audioQuality: value as 'high' | 'balanced' | 'fast' })
                }
                disabled={isLoading}
                compact={compact}
              />
              <ToggleSwitch
                id="speaker-identification"
                label="Speaker Identification"
                description="Identify and label different speakers in meetings"
                checked={preferences.transcription.enableSpeakerIdentification}
                onChange={checked => updatePreferences('transcription', { enableSpeakerIdentification: checked })}
                disabled={isLoading}
                compact={compact}
              />
              <ToggleSwitch
                id="profanity-filter"
                label="Profanity Filter"
                description="Filter out inappropriate language from transcripts"
                checked={preferences.transcription.filterProfanity}
                onChange={checked => updatePreferences('transcription', { filterProfanity: checked })}
                disabled={isLoading}
                compact={compact}
              />
              <ToggleSwitch
                id="auto-punctuation"
                label="Auto-correct Punctuation"
                description="Automatically add punctuation to transcripts"
                checked={preferences.transcription.autoCorrectPunctuation}
                onChange={checked => updatePreferences('transcription', { autoCorrectPunctuation: checked })}
                disabled={isLoading}
                compact={compact}
              />
              <NumberField
                id="confidence-threshold"
                label="Confidence Threshold"
                description="Minimum confidence level for accepted transcriptions"
                value={Math.round(preferences.transcription.confidenceThreshold * 100)}
                min={0}
                max={100}
                unit="%"
                onChange={value => updatePreferences('transcription', { confidenceThreshold: value / 100 })}
                disabled={isLoading}
                compact={compact}
              />
              <NumberField
                id="max-duration"
                label="Maximum Duration"
                description="Maximum meeting duration to transcribe"
                value={preferences.transcription.maxDuration}
                min={1}
                max={480}
                unit="min"
                onChange={value => updatePreferences('transcription', { maxDuration: value })}
                disabled={isLoading}
                compact={compact}
              />
              <ToggleSwitch
                id="realtime-preview"
                label="Real-time Preview"
                description="Show transcription results as they're processed"
                checked={preferences.transcription.realtimePreview}
                onChange={checked => updatePreferences('transcription', { realtimePreview: checked })}
                disabled={isLoading}
                compact={compact}
              />
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className={sectionGap}>
            <h3 className={cn('font-semibold text-gray-900', compact ? 'text-lg' : 'text-xl')}>
              Notification Settings
            </h3>
            <div className="space-y-4">
              <ToggleSwitch
                id="desktop-notifications"
                label="Desktop Notifications"
                description="Show system notifications on desktop"
                checked={preferences.notifications.enableDesktop}
                onChange={checked => updatePreferences('notifications', { enableDesktop: checked })}
                disabled={isLoading}
                compact={compact}
              />
              <ToggleSwitch
                id="browser-notifications"
                label="In-browser Notifications"
                description="Show notifications within the browser"
                checked={preferences.notifications.enableInBrowser}
                onChange={checked => updatePreferences('notifications', { enableInBrowser: checked })}
                disabled={isLoading}
                compact={compact}
              />
              <ToggleSwitch
                id="sound-notifications"
                label="Sound Notifications"
                description="Play sound alerts for notifications"
                checked={preferences.notifications.enableSound}
                onChange={checked => updatePreferences('notifications', { enableSound: checked })}
                disabled={isLoading}
                compact={compact}
              />

              {/* Quiet Hours */}
              <div className="rounded-lg border border-gray-200 p-4">
                <ToggleSwitch
                  id="quiet-hours"
                  label="Quiet Hours"
                  description="Disable notifications during specified hours"
                  checked={preferences.notifications.quietHours?.enabled || false}
                  onChange={checked =>
                    updatePreferences('notifications', {
                      quietHours: {
                        ...preferences.notifications.quietHours,
                        enabled: checked,
                        startTime: preferences.notifications.quietHours?.startTime || '22:00',
                        endTime: preferences.notifications.quietHours?.endTime || '08:00',
                      },
                    })
                  }
                  disabled={isLoading}
                  compact={compact}
                />
                {preferences.notifications.quietHours?.enabled && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <TimeField
                      id="quiet-start"
                      label="Start Time"
                      value={preferences.notifications.quietHours.startTime}
                      onChange={value =>
                        updatePreferences('notifications', {
                          quietHours: { ...preferences.notifications.quietHours!, startTime: value },
                        })
                      }
                      disabled={isLoading}
                      compact={compact}
                    />
                    <TimeField
                      id="quiet-end"
                      label="End Time"
                      value={preferences.notifications.quietHours.endTime}
                      onChange={value =>
                        updatePreferences('notifications', {
                          quietHours: { ...preferences.notifications.quietHours!, endTime: value },
                        })
                      }
                      disabled={isLoading}
                      compact={compact}
                    />
                  </div>
                )}
              </div>

              {/* Notification Types */}
              <NotificationTypesConfig
                types={preferences.notifications.types}
                onChange={types => updatePreferences('notifications', { types })}
                disabled={isLoading}
                compact={compact}
              />
            </div>
          </div>
        );

      case 'privacy':
        return (
          <div className={sectionGap}>
            <h3 className={cn('font-semibold text-gray-900', compact ? 'text-lg' : 'text-xl')}>Privacy Settings</h3>
            <div className="space-y-4">
              <ToggleSwitch
                id="local-storage-only"
                label="Local Storage Only"
                description="Store all data locally instead of cloud sync"
                checked={preferences.privacy.localStorageOnly}
                onChange={checked => updatePreferences('privacy', { localStorageOnly: checked })}
                disabled={isLoading}
                compact={compact}
              />
              <ToggleSwitch
                id="auto-delete-old"
                label="Auto-delete Old Data"
                description="Automatically remove old transcriptions after specified time"
                checked={preferences.privacy.autoDeleteOld}
                onChange={checked => updatePreferences('privacy', { autoDeleteOld: checked })}
                disabled={isLoading}
                compact={compact}
              />
              {preferences.privacy.autoDeleteOld && (
                <NumberField
                  id="retention-days"
                  label="Retention Period"
                  description="Days to keep transcriptions before auto-deletion"
                  value={preferences.privacy.retentionDays}
                  min={1}
                  max={365}
                  unit="days"
                  onChange={value => updatePreferences('privacy', { retentionDays: value })}
                  disabled={isLoading}
                  compact={compact}
                />
              )}
              <ToggleSwitch
                id="encrypt-storage"
                label="Encrypt Stored Data"
                description="Encrypt all stored transcriptions and metadata"
                checked={preferences.privacy.encryptStorage}
                onChange={checked => updatePreferences('privacy', { encryptStorage: checked })}
                disabled={isLoading}
                compact={compact}
              />
              <ToggleSwitch
                id="confirm-export"
                label="Confirm Data Export"
                description="Require confirmation before exporting sensitive data"
                checked={preferences.privacy.confirmExport}
                onChange={checked => updatePreferences('privacy', { confirmExport: checked })}
                disabled={isLoading}
                compact={compact}
              />
              <ToggleSwitch
                id="crash-reports"
                label="Crash Reports"
                description="Send anonymous crash reports to help improve stability"
                checked={preferences.privacy.allowCrashReports}
                onChange={checked => updatePreferences('privacy', { allowCrashReports: checked })}
                disabled={isLoading}
                compact={compact}
              />
            </div>
          </div>
        );

      case 'interface':
        return (
          <div className={sectionGap}>
            <h3 className={cn('font-semibold text-gray-900', compact ? 'text-lg' : 'text-xl')}>Interface Settings</h3>
            <div className="space-y-4">
              <SelectField
                id="theme"
                label="Theme"
                description="Visual appearance of the extension"
                value={preferences.interface.theme}
                options={[
                  { value: 'light', label: 'Light Theme' },
                  { value: 'dark', label: 'Dark Theme' },
                  { value: 'auto', label: 'System Default' },
                ]}
                onChange={value => updatePreferences('interface', { theme: value as 'light' | 'dark' | 'auto' })}
                disabled={isLoading}
                compact={compact}
              />
              <SelectField
                id="interface-language"
                label="Interface Language"
                description="Language for extension interface"
                value={preferences.interface.language}
                options={[
                  { value: 'en', label: 'English' },
                  { value: 'zh-TW', label: '繁體中文' },
                  { value: 'zh-CN', label: '简体中文' },
                  { value: 'ja', label: '日本語' },
                  { value: 'ko', label: '한국어' },
                ]}
                onChange={value => updatePreferences('interface', { language: value })}
                disabled={isLoading}
                compact={compact}
              />
              <ToggleSwitch
                id="compact-mode"
                label="Compact Mode"
                description="Use smaller interface elements to save space"
                checked={preferences.interface.compactMode}
                onChange={checked => updatePreferences('interface', { compactMode: checked })}
                disabled={isLoading}
                compact={compact}
              />
              <SelectField
                id="font-size"
                label="Font Size"
                description="Text size throughout the interface"
                value={preferences.interface.fontSize}
                options={[
                  { value: 'small', label: 'Small' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'large', label: 'Large' },
                ]}
                onChange={value => updatePreferences('interface', { fontSize: value as 'small' | 'medium' | 'large' })}
                disabled={isLoading}
                compact={compact}
              />
              <ToggleSwitch
                id="high-contrast"
                label="High Contrast"
                description="Increase contrast for better visibility"
                checked={preferences.interface.highContrast}
                onChange={checked => updatePreferences('interface', { highContrast: checked })}
                disabled={isLoading}
                compact={compact}
              />
              <ToggleSwitch
                id="reduced-motion"
                label="Reduced Motion"
                description="Minimize animations and transitions"
                checked={preferences.interface.reducedMotion}
                onChange={checked => updatePreferences('interface', { reducedMotion: checked })}
                disabled={isLoading}
                compact={compact}
              />
              <ToggleSwitch
                id="show-tooltips"
                label="Show Tooltips"
                description="Display helpful tooltips and hints"
                checked={preferences.interface.showTooltips}
                onChange={checked => updatePreferences('interface', { showTooltips: checked })}
                disabled={isLoading}
                compact={compact}
              />
            </div>
          </div>
        );

      case 'export':
        return (
          <div className={sectionGap}>
            <h3 className={cn('font-semibold text-gray-900', compact ? 'text-lg' : 'text-xl')}>Export Settings</h3>
            <div className="space-y-4">
              <SelectField
                id="default-format"
                label="Default Export Format"
                description="Preferred format for exporting transcriptions"
                value={preferences.export.defaultFormat}
                options={[
                  { value: 'text', label: 'Plain Text (.txt)' },
                  { value: 'json', label: 'JSON (.json)' },
                  { value: 'pdf', label: 'PDF Document (.pdf)' },
                  { value: 'docx', label: 'Word Document (.docx)' },
                ]}
                onChange={value =>
                  updatePreferences('export', { defaultFormat: value as 'text' | 'json' | 'pdf' | 'docx' })
                }
                disabled={isLoading}
                compact={compact}
              />
              <ToggleSwitch
                id="include-metadata"
                label="Include Metadata"
                description="Add meeting details and processing information to exports"
                checked={preferences.export.includeMetadata}
                onChange={checked => updatePreferences('export', { includeMetadata: checked })}
                disabled={isLoading}
                compact={compact}
              />
              <ToggleSwitch
                id="include-timestamps"
                label="Include Timestamps"
                description="Add timing information to exported transcripts"
                checked={preferences.export.includeTimestamps}
                onChange={checked => updatePreferences('export', { includeTimestamps: checked })}
                disabled={isLoading}
                compact={compact}
              />
              <ToggleSwitch
                id="include-speakers"
                label="Include Speaker Names"
                description="Add speaker identification to exported transcripts"
                checked={preferences.export.includeSpeakers}
                onChange={checked => updatePreferences('export', { includeSpeakers: checked })}
                disabled={isLoading}
                compact={compact}
              />
              <SelectField
                id="default-location"
                label="Default Export Location"
                description="Where to save exported files"
                value={preferences.export.defaultLocation}
                options={[
                  { value: 'downloads', label: 'Downloads Folder' },
                  { value: 'documents', label: 'Documents Folder' },
                  { value: 'custom', label: 'Custom Path' },
                ]}
                onChange={value =>
                  updatePreferences('export', { defaultLocation: value as 'downloads' | 'documents' | 'custom' })
                }
                disabled={isLoading}
                compact={compact}
              />
              {preferences.export.defaultLocation === 'custom' && (
                <div className={compact ? 'space-y-1' : 'space-y-2'}>
                  <label className={cn('block font-medium text-gray-900', compact ? 'text-sm' : 'text-base')}>
                    Custom Export Path
                  </label>
                  <input
                    type="text"
                    value={preferences.export.customPath || ''}
                    onChange={e => updatePreferences('export', { customPath: e.target.value })}
                    placeholder="/path/to/export/folder"
                    disabled={isLoading}
                    className={cn(
                      'block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500',
                      compact ? 'py-1 text-sm' : 'py-2 text-base',
                    )}
                  />
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={cn(containerPadding, className)}>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className={cn('font-bold text-gray-900', headerSize)}>Preferences</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={onReset}
            disabled={isLoading || !isDirty}
            className={cn(
              'rounded border border-gray-300 px-3 py-2 text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50',
              compact ? 'text-sm' : 'text-base',
            )}>
            Reset
          </button>
          <button
            onClick={onSave}
            disabled={isLoading || !isDirty}
            className={cn(
              'rounded bg-blue-600 px-3 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50',
              compact ? 'text-sm' : 'text-base',
            )}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex space-x-8" aria-label="Tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'whitespace-nowrap border-b-2 font-medium transition-colors',
                compact ? 'px-1 py-2 text-sm' : 'px-1 py-3 text-base',
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
              )}>
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-96">{renderTabContent()}</div>

      {/* Save Notification */}
      {isDirty && (
        <div className="fixed bottom-4 right-4 rounded-lg bg-blue-600 px-4 py-2 text-white shadow-lg">
          <p className="text-sm">You have unsaved changes</p>
        </div>
      )}
    </div>
  );
};
