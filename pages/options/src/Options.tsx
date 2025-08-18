import '@src/Options.css';
import { AzureConfigForm, AzureConnectionTester } from './components';
import { t } from '@extension/i18n';
import { PROJECT_URL_OBJECT, useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import { cn, ErrorDisplay, LoadingSpinner, ToggleButton } from '@extension/ui';
import { useState, useEffect } from 'react';
import type { AzureSpeechConfig } from '@extension/shared/lib/types/azure';
import { chromeStorageService } from './services/chrome-storage-service';

type OptionsTab = 'general' | 'azure' | 'advanced';

const Options = () => {
  const { isLight } = useStorage(exampleThemeStorage);
  const [activeTab, setActiveTab] = useState<OptionsTab>('azure');
  const [azureConfig, setAzureConfig] = useState<AzureSpeechConfig | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const logo = isLight ? 'options/logo_horizontal.svg' : 'options/logo_horizontal_dark.svg';

  const goGithubSite = () => chrome.tabs.create(PROJECT_URL_OBJECT);

  const tabs: Array<{ id: OptionsTab; name: string; description: string }> = [
    { id: 'general', name: 'General', description: 'General extension settings' },
    { id: 'azure', name: 'Azure Speech', description: 'Configure Azure Speech Service' },
    { id: 'advanced', name: 'Advanced', description: 'Advanced configuration options' },
  ];

  // Load Azure configuration on component mount
  useEffect(() => {
    const loadAzureConfig = async () => {
      try {
        console.log('[Options] Loading Azure configuration...');
        const config = await chromeStorageService.loadConfig();
        setAzureConfig(config);
        console.log('[Options] Azure configuration loaded:', config);
      } catch (error) {
        console.error('[Options] Failed to load Azure configuration:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAzureConfig();
  }, []);

  /**
   * Handle Azure configuration save
   */
  const handleAzureConfigSave = async (config: AzureSpeechConfig) => {
    setIsSaving(true);
    try {
      console.log('[Options] Saving Azure config to Chrome storage:', config);
      
      // Save to Chrome storage using the real storage service
      await chromeStorageService.saveConfig(config);
      
      setAzureConfig(config);

      // Show success message (could use a toast notification)
      console.log('[Options] Azure configuration saved successfully to chrome.storage.sync');
    } catch (error) {
      console.error('[Options] Failed to save Azure configuration:', error);
      throw error; // Re-throw so the form can handle the error
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handle Azure connection test
   */
  const handleAzureConnectionTest = async (config: AzureSpeechConfig): Promise<boolean> => {
    try {
      // In real implementation, this would test the Azure connection
      console.log('Testing Azure connection:', config);

      // Simulate test delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Simulate random test results for demo
      const success = Math.random() > 0.3; // 70% success rate

      if (!success) {
        throw new Error('Connection test failed - check your credentials');
      }

      console.log('Azure connection test successful');
      return true;
    } catch (error) {
      console.error('Azure connection test failed:', error);
      throw error;
    }
  };

  return (
    <div className={cn('min-h-screen', isLight ? 'bg-slate-50 text-gray-900' : 'bg-gray-800 text-gray-100')}>
      {/* Header */}
      <div className={cn('border-b', isLight ? 'border-gray-200 bg-white' : 'border-gray-700 bg-gray-900')}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex items-center">
              <button onClick={goGithubSite} className="flex items-center">
                <img src={chrome.runtime.getURL(logo)} className="h-8 w-auto" alt="Meeting Summarizer" />
                <span className="ml-3 text-xl font-semibold">Meeting Summarizer</span>
              </button>
            </div>
            <div className="flex items-center space-x-4">
              <ToggleButton onClick={exampleThemeStorage.toggle}>{t('toggleTheme')}</ToggleButton>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className={cn('border-b', isLight ? 'border-gray-200' : 'border-gray-700')}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <nav className="-mb-px flex space-x-8">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'group inline-flex items-center border-b-2 px-1 py-4 text-sm font-medium',
                  activeTab === tab.id
                    ? isLight
                      ? 'border-blue-500 text-blue-600'
                      : 'border-blue-400 text-blue-400'
                    : isLight
                      ? 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                      : 'border-transparent text-gray-400 hover:border-gray-600 hover:text-gray-300',
                )}>
                <span>{tab.name}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {activeTab === 'general' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">General Settings</h2>
              <p className={cn('mt-1', isLight ? 'text-gray-600' : 'text-gray-400')}>
                Configure general extension preferences and behavior.
              </p>
            </div>

            <div
              className={cn(
                'rounded-lg border bg-white p-6',
                isLight ? 'border-gray-200' : 'border-gray-700 bg-gray-800',
              )}>
              <h3 className="mb-4 text-lg font-medium">Extension Preferences</h3>

              {/* Theme Toggle */}
              <div className="flex items-center justify-between py-3">
                <div>
                  <label htmlFor="dark-mode-toggle" className="text-sm font-medium">
                    Dark Mode
                  </label>
                  <p className={cn('text-sm', isLight ? 'text-gray-500' : 'text-gray-400')}>
                    Switch between light and dark themes
                  </p>
                </div>
                <ToggleButton id="dark-mode-toggle" onClick={exampleThemeStorage.toggle}>
                  {isLight ? 'Enable Dark Mode' : 'Enable Light Mode'}
                </ToggleButton>
              </div>

              {/* More general settings would go here */}
              <div className="mt-4 border-t pt-4">
                <p className={cn('text-sm', isLight ? 'text-gray-500' : 'text-gray-400')}>
                  Additional general settings will be available in future versions.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'azure' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">Azure Speech Configuration</h2>
              <p className={cn('mt-1', isLight ? 'text-gray-600' : 'text-gray-400')}>
                Configure your Azure Speech Service for meeting transcription.
              </p>
            </div>

            {/* Azure Configuration Form */}
            <div
              className={cn(
                'rounded-lg border bg-white p-6',
                isLight ? 'border-gray-200' : 'border-gray-700 bg-gray-800',
              )}>
              <h3 className="mb-4 text-lg font-medium">Service Configuration</h3>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner />
                  <span className="ml-2 text-sm text-gray-500">Loading Azure configuration...</span>
                </div>
              ) : (
                <AzureConfigForm
                  initialConfig={azureConfig}
                  onSave={handleAzureConfigSave}
                  onTest={handleAzureConnectionTest}
                  loading={isSaving}
                />
              )}
            </div>

            {/* Connection Testing */}
            <div
              className={cn(
                'rounded-lg border bg-white p-6',
                isLight ? 'border-gray-200' : 'border-gray-700 bg-gray-800',
              )}>
              <AzureConnectionTester
                config={azureConfig}
                testType="comprehensive"
                onTestComplete={results => {
                  console.log('Test completed:', results);
                }}
              />
            </div>

            {/* Service Status */}
            <div
              className={cn(
                'rounded-lg border bg-white p-6',
                isLight ? 'border-gray-200' : 'border-gray-700 bg-gray-800',
              )}>
              <h3 className="mb-4 text-lg font-medium">Service Status</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Configuration Status</span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-1 text-xs font-medium',
                      azureConfig ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800',
                    )}>
                    {azureConfig ? 'Configured' : 'Not Configured'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Service Availability</span>
                  <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
                    Stub Mode
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Last Test</span>
                  <span className={cn('text-sm', isLight ? 'text-gray-500' : 'text-gray-400')}>Never</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'advanced' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">Advanced Settings</h2>
              <p className={cn('mt-1', isLight ? 'text-gray-600' : 'text-gray-400')}>
                Advanced configuration options for power users.
              </p>
            </div>

            <div
              className={cn(
                'rounded-lg border bg-white p-6',
                isLight ? 'border-gray-200' : 'border-gray-700 bg-gray-800',
              )}>
              <h3 className="mb-4 text-lg font-medium">Debug Settings</h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label htmlFor="debug-logging" className="text-sm font-medium">
                      Debug Logging
                    </label>
                    <p className={cn('text-sm', isLight ? 'text-gray-500' : 'text-gray-400')}>
                      Enable detailed logging for troubleshooting
                    </p>
                  </div>
                  <input
                    id="debug-logging"
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label htmlFor="performance-monitoring" className="text-sm font-medium">
                      Performance Monitoring
                    </label>
                    <p className={cn('text-sm', isLight ? 'text-gray-500' : 'text-gray-400')}>
                      Track extension performance metrics
                    </p>
                  </div>
                  <input
                    id="performance-monitoring"
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="mt-6 border-t pt-4">
                <h4 className="mb-2 text-sm font-medium">Developer Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className={cn('font-medium', isLight ? 'text-gray-700' : 'text-gray-300')}>
                      Extension Version:
                    </span>
                    <span className={cn('ml-2', isLight ? 'text-gray-600' : 'text-gray-400')}>1.0.0-dev</span>
                  </div>
                  <div>
                    <span className={cn('font-medium', isLight ? 'text-gray-700' : 'text-gray-300')}>Build Date:</span>
                    <span className={cn('ml-2', isLight ? 'text-gray-600' : 'text-gray-400')}>
                      {new Date().toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Options, <LoadingSpinner />), ErrorDisplay);
