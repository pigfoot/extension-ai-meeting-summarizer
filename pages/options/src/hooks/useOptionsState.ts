/**
 * Options State Manager Hook
 *
 * Implements React hook for options page state management with configuration persistence
 * and validation coordination. Manages options page state and configuration.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type {
  OptionsPageState,
  OptionsView,
  OptionsStateActions,
  ConfigurationForm,
  ConfigTestResult,
  ValidationError,
  OptionsError,
  StorageStatistics,
  UserPreferences,
  FormValidationState,
  FieldValidation,
  ValidationMessage,
  AzureRegionInfo,
  LanguageOption,
} from '../types/options-state';
import type { AzureSpeechConfig, AzureRegion } from '@extension/shared';

/**
 * Storage service interface for persistence
 */
interface StorageService {
  /** Load configuration from storage */
  loadConfig(): Promise<AzureSpeechConfig>;
  /** Save configuration to storage */
  saveConfig(config: AzureSpeechConfig): Promise<void>;
  /** Load user preferences */
  loadPreferences(): Promise<UserPreferences>;
  /** Save user preferences */
  savePreferences(preferences: UserPreferences): Promise<void>;
  /** Get storage statistics */
  getStorageStats(): Promise<StorageStatistics>;
  /** Clean up storage */
  cleanupStorage(categories: string[]): Promise<void>;
  /** Export configuration */
  exportConfig(): Promise<string>;
  /** Import configuration */
  importConfig(config: string): Promise<void>;
}

/**
 * Validation service interface
 */
interface ValidationService {
  /** Test Azure configuration */
  testConfiguration(config: AzureSpeechConfig): Promise<ConfigTestResult>;
  /** Validate configuration form */
  validateForm(form: ConfigurationForm): Promise<FormValidationState>;
  /** Validate individual field */
  validateField(field: string, value: any, config: AzureSpeechConfig): Promise<FieldValidation>;
  /** Get available regions */
  getAvailableRegions(): Promise<AzureRegionInfo[]>;
  /** Get supported languages */
  getSupportedLanguages(): Promise<LanguageOption[]>;
}

/**
 * Hook configuration options
 */
interface UseOptionsStateOptions {
  /** Auto-save delay in milliseconds */
  autoSaveDelay?: number;
  /** Enable real-time validation */
  enableRealtimeValidation?: boolean;
  /** Enable auto-save */
  enableAutoSave?: boolean;
  /** Initial view */
  initialView?: OptionsView;
  /** Storage service instance */
  storageService?: StorageService;
  /** Validation service instance */
  validationService?: ValidationService;
  /** Error handler */
  onError?: (error: OptionsError) => void;
  /** Save success handler */
  onSaveSuccess?: () => void;
  /** Validation change handler */
  onValidationChange?: (isValid: boolean) => void;
}

/**
 * Default configurations
 */
const defaultAzureConfig: AzureSpeechConfig = {
  subscriptionKey: '',
  region: 'eastus',
  language: 'en-US',
  endpoint: '',
  enableLogging: false,
};

const defaultUserPreferences: UserPreferences = {
  general: {
    autoStartTranscription: true,
    autoSaveTranscriptions: true,
    defaultLanguage: 'en-US',
    keepActive: false,
    autoUpdate: true,
    allowAnalytics: false,
  },
  transcription: {
    audioQuality: 'balanced',
    enableSpeakerIdentification: true,
    filterProfanity: false,
    autoCorrectPunctuation: true,
    confidenceThreshold: 0.7,
    maxDuration: 120,
    realtimePreview: false,
  },
  notifications: {
    enableDesktop: true,
    enableInBrowser: true,
    enableSound: false,
    types: [
      { type: 'completion', enabled: true, priority: 'normal', timeout: 5000 },
      { type: 'error', enabled: true, priority: 'high', timeout: 0 },
      { type: 'warning', enabled: true, priority: 'normal', timeout: 10000 },
      { type: 'info', enabled: false, priority: 'low', timeout: 3000 },
    ],
  },
  privacy: {
    localStorageOnly: true,
    autoDeleteOld: false,
    retentionDays: 30,
    encryptStorage: false,
    confirmExport: true,
    allowCrashReports: false,
  },
  interface: {
    theme: 'auto',
    language: 'en',
    compactMode: false,
    fontSize: 'medium',
    highContrast: false,
    reducedMotion: false,
    showTooltips: true,
  },
  export: {
    defaultFormat: 'text',
    includeMetadata: true,
    includeTimestamps: true,
    includeSpeakers: true,
    defaultLocation: 'downloads',
  },
};

/**
 * Mock storage service
 */
const createMockStorageService = (): StorageService => ({
  async loadConfig() {
    await new Promise(resolve => setTimeout(resolve, 100));
    const stored = localStorage.getItem('azure-config');
    return stored ? { ...defaultAzureConfig, ...JSON.parse(stored) } : defaultAzureConfig;
  },

  async saveConfig(config) {
    await new Promise(resolve => setTimeout(resolve, 50));
    localStorage.setItem('azure-config', JSON.stringify(config));
  },

  async loadPreferences() {
    await new Promise(resolve => setTimeout(resolve, 80));
    const stored = localStorage.getItem('user-preferences');
    return stored ? { ...defaultUserPreferences, ...JSON.parse(stored) } : defaultUserPreferences;
  },

  async savePreferences(preferences) {
    await new Promise(resolve => setTimeout(resolve, 50));
    localStorage.setItem('user-preferences', JSON.stringify(preferences));
  },

  async getStorageStats() {
    await new Promise(resolve => setTimeout(resolve, 150));
    return {
      totalUsed: 2560000,
      totalAvailable: 10485760,
      usagePercentage: 24.4,
      categoryUsage: [
        {
          category: 'meetings',
          name: 'Meeting Records',
          bytesUsed: 1024000,
          percentage: 40,
          itemCount: 25,
          cleanable: true,
        },
        {
          category: 'transcriptions',
          name: 'Transcriptions',
          bytesUsed: 768000,
          percentage: 30,
          itemCount: 18,
          cleanable: true,
        },
        { category: 'cache', name: 'Cache Data', bytesUsed: 512000, percentage: 20, itemCount: 150, cleanable: true },
        {
          category: 'config',
          name: 'Configuration',
          bytesUsed: 256000,
          percentage: 10,
          itemCount: 1,
          cleanable: false,
        },
      ],
      meetingCount: 25,
      cacheCount: 150,
      healthStatus: 'healthy',
      recommendations: [
        {
          type: 'cleanup',
          priority: 'low',
          description: 'Clean up old cache data to free up space',
          estimatedSavings: 256000,
          action: 'Clean cache',
          autoAction: true,
        },
      ],
    };
  },

  async cleanupStorage(categories) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Cleaned up categories:', categories);
  },

  async exportConfig() {
    const config = await this.loadConfig();
    const preferences = await this.loadPreferences();
    return JSON.stringify({ config, preferences }, null, 2);
  },

  async importConfig(configString) {
    const data = JSON.parse(configString);
    if (data.config) await this.saveConfig(data.config);
    if (data.preferences) await this.savePreferences(data.preferences);
  },
});

/**
 * Mock validation service
 */
const createMockValidationService = (): ValidationService => ({
  async testConfiguration(config) {
    await new Promise(resolve => setTimeout(resolve, 2000));

    const success = config.subscriptionKey.length > 10 && config.region;

    return {
      status: success ? 'success' : 'failure',
      startTime: new Date(Date.now() - 2000),
      endTime: new Date(),
      duration: 2000,
      success,
      message: success ? 'Configuration test successful' : 'Invalid subscription key or region',
      details: success
        ? {
            connection: {
              success: true,
              latency: 156,
              endpoint: `https://${config.region}.api.cognitive.microsoft.com`,
            },
            authentication: { success: true, keyValid: true, permissions: ['speech-to-text', 'translation'] },
            service: { available: true, version: '3.1', features: ['speaker-identification', 'profanity-filter'] },
            region: { optimal: true, latency: 45, alternatives: ['westus', 'centralus'] },
          }
        : undefined,
      error: success
        ? undefined
        : {
            type: 'authentication',
            message: 'Invalid subscription key',
            recoverable: true,
            resolution: [
              'Check your Azure subscription key',
              'Verify the selected region',
              'Ensure your Azure account has Speech Services enabled',
            ],
          },
      metrics: {
        connectionTime: 234,
        authTime: 567,
        totalTime: 2000,
        latency: 156,
      },
    };
  },

  async validateForm(form) {
    await new Promise(resolve => setTimeout(resolve, 300));

    const fieldValidation: Record<string, FieldValidation> = {};
    const formMessages: ValidationMessage[] = [];

    // Validate subscription key
    if (!form.subscriptionKey) {
      fieldValidation.subscriptionKey = {
        isValid: false,
        isValidating: false,
        messages: [{ severity: 'error', message: 'Subscription key is required' }],
        isTouched: true,
      };
    } else if (form.subscriptionKey.length < 10) {
      fieldValidation.subscriptionKey = {
        isValid: false,
        isValidating: false,
        messages: [{ severity: 'error', message: 'Subscription key appears to be invalid' }],
        isTouched: true,
      };
    } else {
      fieldValidation.subscriptionKey = {
        isValid: true,
        isValidating: false,
        messages: [],
        isTouched: true,
      };
    }

    // Validate region
    fieldValidation.region = {
      isValid: !!form.region,
      isValidating: false,
      messages: form.region ? [] : [{ severity: 'error', message: 'Region is required' }],
      isTouched: true,
    };

    const isValid = Object.values(fieldValidation).every(field => field.isValid);

    return {
      isValidating: false,
      isValid,
      fieldValidation,
      formMessages,
      lastValidated: new Date(),
    };
  },

  async validateField(field, value, config) {
    await new Promise(resolve => setTimeout(resolve, 100));

    let isValid = true;
    const messages: ValidationMessage[] = [];

    switch (field) {
      case 'subscriptionKey':
        if (!value) {
          isValid = false;
          messages.push({ severity: 'error', message: 'Subscription key is required' });
        } else if (value.length < 10) {
          isValid = false;
          messages.push({ severity: 'warning', message: 'Subscription key appears to be short' });
        }
        break;
      case 'region':
        if (!value) {
          isValid = false;
          messages.push({ severity: 'error', message: 'Region is required' });
        }
        break;
    }

    return {
      isValid,
      isValidating: false,
      messages,
      isTouched: true,
      lastValidatedValue: value,
    };
  },

  async getAvailableRegions() {
    return [
      {
        id: 'eastus',
        name: 'East US',
        description: 'East US data center',
        recommended: true,
        features: ['speech-to-text'],
        status: 'available',
      },
      {
        id: 'westus',
        name: 'West US',
        description: 'West US data center',
        recommended: false,
        features: ['speech-to-text'],
        status: 'available',
      },
      {
        id: 'centralus',
        name: 'Central US',
        description: 'Central US data center',
        recommended: false,
        features: ['speech-to-text'],
        status: 'available',
      },
    ];
  },

  async getSupportedLanguages() {
    return [
      {
        code: 'en-US',
        name: 'English (US)',
        nativeName: 'English (United States)',
        popular: true,
        quality: 'excellent',
        features: ['speaker-id'],
      },
      {
        code: 'zh-CN',
        name: 'Chinese (Simplified)',
        nativeName: '中文（简体）',
        popular: true,
        quality: 'excellent',
        features: [],
      },
      {
        code: 'es-ES',
        name: 'Spanish (Spain)',
        nativeName: 'Español (España)',
        popular: true,
        quality: 'good',
        features: [],
      },
    ];
  },
});

/**
 * Debounce utility
 */
const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

/**
 * Main options state management hook
 */
export const useOptionsState = (options: UseOptionsStateOptions = {}) => {
  const {
    autoSaveDelay = 2000,
    enableRealtimeValidation = true,
    enableAutoSave = true,
    initialView = 'azure',
    storageService: externalStorageService,
    validationService: externalValidationService,
    onError,
    onSaveSuccess,
    onValidationChange,
  } = options;

  // Services
  const storageService = useRef(externalStorageService || createMockStorageService());
  const validationService = useRef(externalValidationService || createMockValidationService());

  // State
  const [state, setState] = useState<OptionsPageState>({
    azureConfig: defaultAzureConfig,
    isConfigValid: false,
    testResults: undefined,
    storageStats: {
      totalUsed: 0,
      totalAvailable: 0,
      usagePercentage: 0,
      categoryUsage: [],
      meetingCount: 0,
      cacheCount: 0,
      healthStatus: 'healthy',
      recommendations: [],
    },
    userPreferences: defaultUserPreferences,
    isDirty: false,
    validationErrors: [],
    currentView: initialView,
    isLoading: true,
    error: undefined,
    isSubmitting: false,
    lastSaved: undefined,
    availableRegions: [],
    supportedLanguages: [],
  });

  // Auto-save trigger
  const debouncedConfig = useDebounce(state.azureConfig, autoSaveDelay);
  const debouncedPreferences = useDebounce(state.userPreferences, autoSaveDelay);

  // Load initial data
  const loadInitialData = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: undefined }));

    try {
      const [config, preferences, storageStats, regions, languages] = await Promise.all([
        storageService.current.loadConfig(),
        storageService.current.loadPreferences(),
        storageService.current.getStorageStats(),
        validationService.current.getAvailableRegions(),
        validationService.current.getSupportedLanguages(),
      ]);

      setState(prev => ({
        ...prev,
        azureConfig: config,
        userPreferences: preferences,
        storageStats,
        availableRegions: regions,
        supportedLanguages: languages,
        isLoading: false,
        isDirty: false,
      }));
    } catch (error) {
      const optionsError: OptionsError = {
        type: 'load',
        message: error instanceof Error ? error.message : 'Failed to load settings',
        timestamp: new Date(),
        recoverable: true,
        recoveryActions: ['Refresh the page', 'Check browser storage permissions'],
      };

      setState(prev => ({
        ...prev,
        error: optionsError,
        isLoading: false,
      }));

      onError?.(optionsError);
    }
  }, [onError]);

  // Validation logic
  const validateConfiguration = useCallback(
    async (config: AzureSpeechConfig) => {
      if (!enableRealtimeValidation) return;

      try {
        const form: ConfigurationForm = {
          subscriptionKey: config.subscriptionKey,
          region: config.region,
          language: config.language || 'en-US',
          endpoint: config.endpoint,
          enableLogging: config.enableLogging || false,
          enableAdvancedFeatures: false,
          timeoutSeconds: 30,
          retryAttempts: 3,
          testStatus: 'idle',
          validationState: {
            isValidating: true,
            isValid: false,
            fieldValidation: {},
            formMessages: [],
          },
        };

        const validationState = await validationService.current.validateForm(form);
        const validationErrors: ValidationError[] = [];

        Object.entries(validationState.fieldValidation).forEach(([field, validation]) => {
          validation.messages.forEach(message => {
            if (message.severity === 'error') {
              validationErrors.push({
                field,
                type: 'custom',
                message: message.message,
                severity: message.severity,
                code: message.code,
              });
            }
          });
        });

        setState(prev => ({
          ...prev,
          isConfigValid: validationState.isValid,
          validationErrors,
        }));

        onValidationChange?.(validationState.isValid);
      } catch (error) {
        console.error('Validation failed:', error);
      }
    },
    [enableRealtimeValidation, onValidationChange],
  );

  // Auto-save logic
  useEffect(() => {
    if (!enableAutoSave || state.isLoading || !state.isDirty) return;

    const saveConfig = async () => {
      try {
        await storageService.current.saveConfig(debouncedConfig);
        setState(prev => ({
          ...prev,
          isDirty: false,
          lastSaved: new Date(),
        }));
        onSaveSuccess?.();
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    };

    saveConfig();
  }, [debouncedConfig, enableAutoSave, state.isLoading, state.isDirty, onSaveSuccess]);

  // Auto-save preferences
  useEffect(() => {
    if (!enableAutoSave || state.isLoading) return;

    const savePreferences = async () => {
      try {
        await storageService.current.savePreferences(debouncedPreferences);
      } catch (error) {
        console.error('Preferences auto-save failed:', error);
      }
    };

    savePreferences();
  }, [debouncedPreferences, enableAutoSave, state.isLoading]);

  // Validate configuration when it changes
  useEffect(() => {
    if (!state.isLoading && state.isDirty) {
      validateConfiguration(state.azureConfig);
    }
  }, [state.azureConfig, state.isLoading, state.isDirty, validateConfiguration]);

  // State actions
  const actions: OptionsStateActions = {
    updateAzureConfig: useCallback((config: Partial<AzureSpeechConfig>) => {
      setState(prev => ({
        ...prev,
        azureConfig: { ...prev.azureConfig, ...config },
        isDirty: true,
      }));
    }, []),

    updatePreferences: useCallback((preferences: Partial<UserPreferences>) => {
      setState(prev => ({
        ...prev,
        userPreferences: { ...prev.userPreferences, ...preferences },
        isDirty: true,
      }));
    }, []),

    setView: useCallback((view: OptionsView) => {
      setState(prev => ({ ...prev, currentView: view }));
    }, []),

    testConfiguration: useCallback(async (): Promise<ConfigTestResult> => {
      setState(prev => ({ ...prev, isLoading: true }));

      try {
        const result = await validationService.current.testConfiguration(state.azureConfig);
        setState(prev => ({
          ...prev,
          testResults: result,
          isConfigValid: result.success,
          isLoading: false,
        }));
        return result;
      } catch (error) {
        const optionsError: OptionsError = {
          type: 'network',
          message: 'Failed to test configuration',
          timestamp: new Date(),
          recoverable: true,
        };
        setState(prev => ({ ...prev, error: optionsError, isLoading: false }));
        throw error;
      }
    }, [state.azureConfig]),

    saveChanges: useCallback(async () => {
      setState(prev => ({ ...prev, isSubmitting: true, error: undefined }));

      try {
        await Promise.all([
          storageService.current.saveConfig(state.azureConfig),
          storageService.current.savePreferences(state.userPreferences),
        ]);

        setState(prev => ({
          ...prev,
          isDirty: false,
          isSubmitting: false,
          lastSaved: new Date(),
        }));

        onSaveSuccess?.();
      } catch (error) {
        const optionsError: OptionsError = {
          type: 'save',
          message: error instanceof Error ? error.message : 'Failed to save settings',
          timestamp: new Date(),
          recoverable: true,
          recoveryActions: ['Try saving again', 'Check browser storage permissions'],
        };

        setState(prev => ({
          ...prev,
          error: optionsError,
          isSubmitting: false,
        }));

        onError?.(optionsError);
      }
    }, [state.azureConfig, state.userPreferences, onSaveSuccess, onError]),

    resetToDefaults: useCallback(() => {
      setState(prev => ({
        ...prev,
        azureConfig: defaultAzureConfig,
        userPreferences: defaultUserPreferences,
        isDirty: true,
        validationErrors: [],
      }));
    }, []),

    clearErrors: useCallback(() => {
      setState(prev => ({ ...prev, error: undefined, validationErrors: [] }));
    }, []),

    setLoading: useCallback((loading: boolean) => {
      setState(prev => ({ ...prev, isLoading: loading }));
    }, []),

    setError: useCallback((error: OptionsError | null) => {
      setState(prev => ({ ...prev, error: error || undefined }));
    }, []),

    refreshStorageStats: useCallback(async () => {
      try {
        const stats = await storageService.current.getStorageStats();
        setState(prev => ({ ...prev, storageStats: stats }));
      } catch (error) {
        console.error('Failed to refresh storage stats:', error);
      }
    }, []),

    cleanupStorage: useCallback(
      async (categories: string[]) => {
        setState(prev => ({ ...prev, isLoading: true }));

        try {
          await storageService.current.cleanupStorage(categories);
          const stats = await storageService.current.getStorageStats();
          setState(prev => ({
            ...prev,
            storageStats: stats,
            isLoading: false,
          }));
        } catch (error) {
          const optionsError: OptionsError = {
            type: 'storage',
            message: 'Failed to clean up storage',
            timestamp: new Date(),
            recoverable: true,
          };
          setState(prev => ({ ...prev, error: optionsError, isLoading: false }));
          onError?.(optionsError);
        }
      },
      [onError],
    ),

    exportConfig: useCallback(async () => {
      try {
        const configData = await storageService.current.exportConfig();
        const blob = new Blob([configData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `meeting-summarizer-config-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        const optionsError: OptionsError = {
          type: 'unknown',
          message: 'Failed to export configuration',
          timestamp: new Date(),
          recoverable: true,
        };
        setState(prev => ({ ...prev, error: optionsError }));
        onError?.(optionsError);
      }
    }, [onError]),

    importConfig: useCallback(
      async (configString: string) => {
        try {
          await storageService.current.importConfig(configString);
          await loadInitialData();
        } catch (error) {
          const optionsError: OptionsError = {
            type: 'unknown',
            message: 'Failed to import configuration',
            timestamp: new Date(),
            recoverable: true,
          };
          setState(prev => ({ ...prev, error: optionsError }));
          onError?.(optionsError);
        }
      },
      [loadInitialData, onError],
    ),
  };

  // Initialize
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  return {
    // State
    state,

    // Actions
    actions,

    // Computed values
    hasUnsavedChanges: state.isDirty,
    isConfigurationValid: state.isConfigValid,
    canSave: state.isDirty && !state.isSubmitting && !state.isLoading,
    canTest: !state.isLoading && state.azureConfig.subscriptionKey && state.azureConfig.region,

    // Utilities
    refresh: loadInitialData,
  };
};

/**
 * Hook for managing form validation
 */
export const useOptionsFormValidation = (config: AzureSpeechConfig, validationService?: ValidationService) => {
  const [fieldValidations, setFieldValidations] = useState<Record<string, FieldValidation>>({});
  const [isValidating, setIsValidating] = useState(false);
  const service = useRef(validationService || createMockValidationService());

  const validateField = useCallback(
    async (field: string, value: any) => {
      setIsValidating(true);
      setFieldValidations(prev => ({
        ...prev,
        [field]: { ...prev[field], isValidating: true },
      }));

      try {
        const validation = await service.current.validateField(field, value, config);
        setFieldValidations(prev => ({
          ...prev,
          [field]: validation,
        }));
      } catch (error) {
        console.error('Field validation failed:', error);
      } finally {
        setIsValidating(false);
      }
    },
    [config],
  );

  const clearFieldValidation = useCallback((field: string) => {
    setFieldValidations(prev => {
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });
  }, []);

  const isFormValid = useMemo(
    () => Object.values(fieldValidations).every(validation => validation.isValid),
    [fieldValidations],
  );

  return {
    fieldValidations,
    isValidating,
    isFormValid,
    validateField,
    clearFieldValidation,
  };
};

export default useOptionsState;
