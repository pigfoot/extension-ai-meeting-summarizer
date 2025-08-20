/**
 * Azure Speech Service configuration form component
 * Provides comprehensive UI for setting up and testing Azure Speech API credentials
 * with real-time validation and secure storage integration.
 */

import { cn } from '@extension/ui';
import { useState, useCallback, useEffect } from 'react';
import type { AzureSpeechConfig, AzureRegion } from '@extension/shared/lib/types/azure';
import type React from 'react';

/**
 * Form state interface
 */
interface FormState {
  subscriptionKey: string;
  serviceRegion: AzureRegion;
  language: string;
  endpoint?: string;
  enableLogging: boolean;
}

/**
 * Form validation errors
 */
interface FormErrors {
  subscriptionKey?: string;
  serviceRegion?: string;
  language?: string;
  endpoint?: string;
}

/**
 * Azure configuration form props
 */
interface AzureConfigFormProps {
  /** Initial configuration values */
  initialConfig?: Partial<AzureSpeechConfig>;
  /** Called when configuration is saved */
  onSave?: (config: AzureSpeechConfig) => void;
  /** Called when configuration is tested */
  onTest?: (config: AzureSpeechConfig) => Promise<boolean>;
  /** Whether form is in loading state */
  loading?: boolean;
  /** External form errors */
  errors?: FormErrors;
  /** CSS class name */
  className?: string;
}

/**
 * Available Azure regions
 */
const AZURE_REGIONS: { value: AzureRegion; label: string }[] = [
  { value: 'eastus', label: 'East US' },
  { value: 'westus', label: 'West US' },
  { value: 'westus2', label: 'West US 2' },
  { value: 'eastus2', label: 'East US 2' },
  { value: 'centralus', label: 'Central US' },
  { value: 'northcentralus', label: 'North Central US' },
  { value: 'southcentralus', label: 'South Central US' },
  { value: 'westcentralus', label: 'West Central US' },
  { value: 'canadacentral', label: 'Canada Central' },
  { value: 'brazilsouth', label: 'Brazil South' },
  { value: 'eastasia', label: 'East Asia' },
  { value: 'southeastasia', label: 'Southeast Asia' },
  { value: 'japaneast', label: 'Japan East' },
  { value: 'japanwest', label: 'Japan West' },
  { value: 'koreacentral', label: 'Korea Central' },
  { value: 'australiaeast', label: 'Australia East' },
  { value: 'centralindia', label: 'Central India' },
  { value: 'uksouth', label: 'UK South' },
  { value: 'francecentral', label: 'France Central' },
  { value: 'northeurope', label: 'North Europe' },
  { value: 'westeurope', label: 'West Europe' },
];

/**
 * Supported languages
 */
const SUPPORTED_LANGUAGES = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'zh-CN', label: '中文 (簡體)' },
  { value: 'zh-TW', label: '中文 (繁體)' },
  { value: 'ja-JP', label: '日本語' },
  { value: 'ko-KR', label: '한국어' },
  { value: 'es-ES', label: 'Español' },
  { value: 'fr-FR', label: 'Français' },
  { value: 'de-DE', label: 'Deutsch' },
  { value: 'it-IT', label: 'Italiano' },
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'ru-RU', label: 'Русский' },
];

export const AzureConfigForm: React.FC<AzureConfigFormProps> = ({
  initialConfig,
  onSave,
  onTest,
  loading = false,
  errors: externalErrors,
  className,
}) => {
  // Form state
  const [formState, setFormState] = useState<FormState>({
    subscriptionKey: initialConfig?.subscriptionKey || '',
    serviceRegion: initialConfig?.serviceRegion || 'eastus',
    language: initialConfig?.language || 'en-US',
    endpoint: initialConfig?.endpoint || '',
    enableLogging: initialConfig?.enableLogging || false,
  });

  // Form validation
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isValid, setIsValid] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isTestLoading, setIsTestLoading] = useState(false);

  /**
   * Validate form data
   */
  const validateForm = useCallback((state: FormState): FormErrors => {
    const errors: FormErrors = {};

    // Validate subscription key
    if (!state.subscriptionKey.trim()) {
      errors.subscriptionKey = 'Subscription key is required';
    } else if (state.subscriptionKey.length !== 32) {
      errors.subscriptionKey = 'Subscription key must be 32 characters long';
    } else if (!/^[a-f0-9]{32}$/i.test(state.subscriptionKey)) {
      errors.subscriptionKey = 'Subscription key must contain only hexadecimal characters';
    }

    // Validate service region
    if (!state.serviceRegion) {
      errors.serviceRegion = 'Service region is required';
    }

    // Validate language
    if (!state.language) {
      errors.language = 'Language is required';
    } else if (!/^[a-z]{2}-[A-Z]{2}$/.test(state.language)) {
      errors.language = 'Language must be in format "xx-XX" (e.g., "en-US")';
    }

    // Validate endpoint if provided
    if (state.endpoint && state.endpoint.trim()) {
      try {
        new URL(state.endpoint);
      } catch {
        errors.endpoint = 'Invalid endpoint URL format';
      }
    }

    return errors;
  }, []);

  /**
   * Handle form field changes
   */
  const handleFieldChange = useCallback((field: keyof FormState, value: string | boolean) => {
    setFormState(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  }, []);

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!isValid || loading) return;

      const config: AzureSpeechConfig = {
        subscriptionKey: formState.subscriptionKey.trim(),
        serviceRegion: formState.serviceRegion,
        language: formState.language,
        enableLogging: formState.enableLogging,
        ...(formState.endpoint && formState.endpoint.trim() && { endpoint: formState.endpoint.trim() }),
      };

      onSave?.(config);
    },
    [formState, isValid, loading, onSave],
  );

  /**
   * Handle configuration test
   */
  const handleTest = useCallback(async () => {
    if (!isValid || isTestLoading) return;

    setIsTestLoading(true);

    try {
      const config: AzureSpeechConfig = {
        subscriptionKey: formState.subscriptionKey.trim(),
        serviceRegion: formState.serviceRegion,
        language: formState.language,
        enableLogging: formState.enableLogging,
        ...(formState.endpoint && formState.endpoint.trim() && { endpoint: formState.endpoint.trim() }),
      };

      const result = await onTest?.(config);

      // You could show a success/failure message here
      console.log('Test result:', result);
    } catch (error) {
      console.error('Test failed:', error);
    } finally {
      setIsTestLoading(false);
    }
  }, [formState, isValid, isTestLoading, onTest]);

  /**
   * Update form validation when state changes
   */
  useEffect(() => {
    const errors = validateForm(formState);
    const mergedErrors = { ...errors, ...externalErrors };

    setFormErrors(mergedErrors);
    setIsValid(Object.keys(mergedErrors).length === 0);
  }, [formState, externalErrors, validateForm]);

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-6', className)}>
      {/* Subscription Key */}
      <div className="space-y-2">
        <label htmlFor="subscriptionKey" className="block text-sm font-medium">
          Azure Subscription Key
          <span className="ml-1 text-red-500">*</span>
        </label>
        <input
          id="subscriptionKey"
          type="password"
          value={formState.subscriptionKey}
          onChange={e => handleFieldChange('subscriptionKey', e.target.value)}
          placeholder="Enter your Azure Speech Service subscription key"
          className={cn(
            'w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
            formErrors.subscriptionKey
              ? 'border-red-300 focus:border-red-500'
              : 'border-gray-300 focus:border-blue-500',
          )}
          disabled={loading}
        />
        {formErrors.subscriptionKey && <p className="text-sm text-red-600">{formErrors.subscriptionKey}</p>}
        <p className="text-xs text-gray-500">Your subscription key will be stored securely and encrypted</p>
      </div>

      {/* Region */}
      <div className="space-y-2">
        <label htmlFor="region" className="block text-sm font-medium">
          Azure Region
          <span className="ml-1 text-red-500">*</span>
        </label>
        <select
          id="region"
          value={formState.serviceRegion}
          onChange={e => handleFieldChange('serviceRegion', e.target.value as AzureRegion)}
          className={cn(
            'w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
            formErrors.serviceRegion ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500',
          )}
          disabled={loading}>
          {AZURE_REGIONS.map(region => (
            <option key={region.value} value={region.value}>
              {region.label}
            </option>
          ))}
        </select>
        {formErrors.serviceRegion && <p className="text-sm text-red-600">{formErrors.serviceRegion}</p>}
        <p className="text-xs text-gray-500">Choose the region closest to your location for better performance</p>
      </div>

      {/* Language */}
      <div className="space-y-2">
        <label htmlFor="language" className="block text-sm font-medium">
          Default Language
          <span className="ml-1 text-red-500">*</span>
        </label>
        <select
          id="language"
          value={formState.language}
          onChange={e => handleFieldChange('language', e.target.value)}
          className={cn(
            'w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
            formErrors.language ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500',
          )}
          disabled={loading}>
          {SUPPORTED_LANGUAGES.map(lang => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
        {formErrors.language && <p className="text-sm text-red-600">{formErrors.language}</p>}
        <p className="text-xs text-gray-500">Primary language for speech recognition</p>
      </div>

      {/* Custom Endpoint (Optional) */}
      <div className="space-y-2">
        <label htmlFor="endpoint" className="block text-sm font-medium">
          Custom Endpoint (Optional)
        </label>
        <input
          id="endpoint"
          type="url"
          value={formState.endpoint}
          onChange={e => handleFieldChange('endpoint', e.target.value)}
          placeholder="https://your-custom-endpoint.api.cognitive.microsoft.com"
          className={cn(
            'w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
            formErrors.endpoint ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500',
          )}
          disabled={loading}
        />
        {formErrors.endpoint && <p className="text-sm text-red-600">{formErrors.endpoint}</p>}
        <p className="text-xs text-gray-500">Leave empty to use the default endpoint for your region</p>
      </div>

      {/* Enable Logging */}
      <div className="flex items-center space-x-2">
        <input
          id="enableLogging"
          type="checkbox"
          checked={formState.enableLogging}
          onChange={e => handleFieldChange('enableLogging', e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          disabled={loading}
        />
        <label htmlFor="enableLogging" className="text-sm font-medium">
          Enable debug logging
        </label>
      </div>
      <p className="ml-6 text-xs text-gray-500">
        Enable detailed logging for troubleshooting (not recommended for production)
      </p>

      {/* Action Buttons */}
      <div className="flex space-x-3 pt-4">
        <button
          type="submit"
          disabled={!isValid || loading || !isDirty}
          className={cn(
            'rounded-md px-4 py-2 font-medium transition-colors',
            isValid && isDirty && !loading
              ? 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
              : 'cursor-not-allowed bg-gray-300 text-gray-500',
          )}>
          {loading ? 'Saving...' : 'Save Configuration'}
        </button>

        {onTest && (
          <button
            type="button"
            onClick={handleTest}
            disabled={!isValid || isTestLoading}
            className={cn(
              'rounded-md border px-4 py-2 font-medium transition-colors',
              isValid && !isTestLoading
                ? 'border-blue-600 text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500'
                : 'cursor-not-allowed border-gray-300 text-gray-500',
            )}>
            {isTestLoading ? 'Testing...' : 'Test Connection'}
          </button>
        )}
      </div>

      {/* Help Text */}
      <div className="rounded-md border border-blue-200 bg-blue-50 p-4">
        <h4 className="mb-2 text-sm font-medium text-blue-800">How to get your Azure Speech Service credentials:</h4>
        <ol className="list-inside list-decimal space-y-1 text-sm text-blue-700">
          <li>Go to the Azure Portal (portal.azure.com)</li>
          <li>Create or navigate to your Speech Service resource</li>
          <li>Go to "Keys and Endpoint" in the left sidebar</li>
          <li>Copy one of the subscription keys and the region</li>
        </ol>
      </div>
    </form>
  );
};
