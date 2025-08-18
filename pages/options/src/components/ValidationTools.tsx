/**
 * Validation Tools Component
 *
 * Implements Azure API connectivity testing, configuration validation and diagnostic tools.
 * Provides comprehensive testing and validation interface for extension configuration.
 */

import { cn } from '@extension/ui';
import { useState, useCallback, useEffect, useMemo } from 'react';
import type { ConfigTestResult, TestDetails, TestError, ConfigurationForm } from '../types/options-state';
import type { AzureSpeechConfig } from '@extension/shared';
import type React from 'react';

/**
 * Validation tools component props
 */
interface ValidationToolsProps {
  /** Current Azure configuration */
  azureConfig?: AzureSpeechConfig;
  /** Configuration form state */
  configForm?: ConfigurationForm;
  /** Test execution handler */
  onRunTest?: (config: AzureSpeechConfig) => Promise<ConfigTestResult>;
  /** Configuration validation handler */
  onValidateConfig?: (config: AzureSpeechConfig) => Promise<boolean>;
  /** Health check handler */
  onHealthCheck?: (config: AzureSpeechConfig) => Promise<ConfigTestResult>;
  /** Custom class name */
  className?: string;
  /** Whether component is in compact mode */
  compact?: boolean;
}

/**
 * Test result status indicator component
 */
interface StatusIndicatorProps {
  status: 'idle' | 'testing' | 'success' | 'failure';
  compact?: boolean;
}

/**
 * Test metric display component
 */
interface MetricDisplayProps {
  label: string;
  value: string | number;
  unit?: string;
  status?: 'good' | 'warning' | 'error';
  compact?: boolean;
}

/**
 * Diagnostic info component
 */
interface DiagnosticInfoProps {
  testResult?: ConfigTestResult;
  compact?: boolean;
}

/**
 * Test status indicator component
 */
const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, compact = false }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'idle':
        return {
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          icon: '⏳',
          text: 'Ready to test',
        };
      case 'testing':
        return {
          color: 'text-blue-600',
          bgColor: 'bg-blue-100',
          icon: '🔄',
          text: 'Testing...',
        };
      case 'success':
        return {
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          icon: '✅',
          text: 'Success',
        };
      case 'failure':
        return {
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          icon: '❌',
          text: 'Failed',
        };
      default:
        return {
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          icon: '❓',
          text: 'Unknown',
        };
    }
  };

  const config = getStatusConfig();
  const badgeSize = compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        config.color,
        config.bgColor,
        badgeSize,
      )}>
      <span className={status === 'testing' ? 'animate-spin' : ''}>{config.icon}</span>
      <span>{config.text}</span>
    </span>
  );
};

/**
 * Test metric display component
 */
const MetricDisplay: React.FC<MetricDisplayProps> = ({ label, value, unit, status = 'good', compact = false }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'good':
        return 'text-green-600';
      case 'warning':
        return 'text-yellow-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const valueSize = compact ? 'text-lg' : 'text-xl';
  const labelSize = compact ? 'text-xs' : 'text-sm';

  return (
    <div className="text-center">
      <div className={cn('font-bold', getStatusColor(), valueSize)}>
        {value}
        {unit && <span className="text-sm">{unit}</span>}
      </div>
      <div className={cn('text-gray-600', labelSize)}>{label}</div>
    </div>
  );
};

/**
 * Connection test section component
 */
const ConnectionTestSection: React.FC<{
  details?: TestDetails;
  compact?: boolean;
}> = ({ details, compact = false }) => {
  if (!details?.connection) return null;

  const sectionPadding = compact ? 'p-3' : 'p-4';
  const titleSize = compact ? 'text-sm' : 'text-base';

  return (
    <div className={cn('rounded-lg border border-gray-200 bg-white', sectionPadding)}>
      <h4 className={cn('mb-3 font-medium text-gray-900', titleSize)}>🌐 Connection Test</h4>
      <div className="grid grid-cols-3 gap-4">
        <MetricDisplay
          label="Status"
          value={details.connection.success ? 'Connected' : 'Failed'}
          status={details.connection.success ? 'good' : 'error'}
          compact={compact}
        />
        <MetricDisplay
          label="Latency"
          value={details.connection.latency}
          unit="ms"
          status={details.connection.latency < 1000 ? 'good' : details.connection.latency < 3000 ? 'warning' : 'error'}
          compact={compact}
        />
        <MetricDisplay
          label="Endpoint"
          value={
            details.connection.endpoint.includes('eastus')
              ? 'East US'
              : details.connection.endpoint.includes('westus')
                ? 'West US'
                : details.connection.endpoint.includes('westeurope')
                  ? 'West EU'
                  : 'Other'
          }
          compact={compact}
        />
      </div>
    </div>
  );
};

/**
 * Authentication test section component
 */
const AuthenticationTestSection: React.FC<{
  details?: TestDetails;
  compact?: boolean;
}> = ({ details, compact = false }) => {
  if (!details?.authentication) return null;

  const sectionPadding = compact ? 'p-3' : 'p-4';
  const titleSize = compact ? 'text-sm' : 'text-base';

  return (
    <div className={cn('rounded-lg border border-gray-200 bg-white', sectionPadding)}>
      <h4 className={cn('mb-3 font-medium text-gray-900', titleSize)}>🔐 Authentication Test</h4>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <MetricDisplay
            label="Authentication"
            value={details.authentication.success ? 'Valid' : 'Invalid'}
            status={details.authentication.success ? 'good' : 'error'}
            compact={compact}
          />
          <MetricDisplay
            label="Key Status"
            value={details.authentication.keyValid ? 'Valid' : 'Invalid'}
            status={details.authentication.keyValid ? 'good' : 'error'}
            compact={compact}
          />
        </div>
        {details.authentication.permissions.length > 0 && (
          <div>
            <h5 className={cn('mb-2 font-medium text-gray-900', compact ? 'text-xs' : 'text-sm')}>Permissions</h5>
            <div className="flex flex-wrap gap-2">
              {details.authentication.permissions.map((permission, index) => (
                <span
                  key={index}
                  className={cn('rounded-full bg-green-100 px-2 py-1 text-green-800', compact ? 'text-xs' : 'text-sm')}>
                  {permission}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Service test section component
 */
const ServiceTestSection: React.FC<{
  details?: TestDetails;
  compact?: boolean;
}> = ({ details, compact = false }) => {
  if (!details?.service) return null;

  const sectionPadding = compact ? 'p-3' : 'p-4';
  const titleSize = compact ? 'text-sm' : 'text-base';

  return (
    <div className={cn('rounded-lg border border-gray-200 bg-white', sectionPadding)}>
      <h4 className={cn('mb-3 font-medium text-gray-900', titleSize)}>🔧 Service Status</h4>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <MetricDisplay
            label="Availability"
            value={details.service.available ? 'Available' : 'Unavailable'}
            status={details.service.available ? 'good' : 'error'}
            compact={compact}
          />
          <MetricDisplay label="Version" value={details.service.version || 'Unknown'} compact={compact} />
        </div>
        {details.service.features.length > 0 && (
          <div>
            <h5 className={cn('mb-2 font-medium text-gray-900', compact ? 'text-xs' : 'text-sm')}>
              Available Features
            </h5>
            <div className="flex flex-wrap gap-2">
              {details.service.features.map((feature, index) => (
                <span
                  key={index}
                  className={cn('rounded-full bg-blue-100 px-2 py-1 text-blue-800', compact ? 'text-xs' : 'text-sm')}>
                  {feature}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Region optimization section component
 */
const RegionOptimizationSection: React.FC<{
  details?: TestDetails;
  compact?: boolean;
}> = ({ details, compact = false }) => {
  if (!details?.region) return null;

  const sectionPadding = compact ? 'p-3' : 'p-4';
  const titleSize = compact ? 'text-sm' : 'text-base';

  return (
    <div className={cn('rounded-lg border border-gray-200 bg-white', sectionPadding)}>
      <h4 className={cn('mb-3 font-medium text-gray-900', titleSize)}>🌍 Region Optimization</h4>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <MetricDisplay
            label="Current Region"
            value={details.region.optimal ? 'Optimal' : 'Suboptimal'}
            status={details.region.optimal ? 'good' : 'warning'}
            compact={compact}
          />
          <MetricDisplay
            label="Latency"
            value={details.region.latency}
            unit="ms"
            status={details.region.latency < 100 ? 'good' : details.region.latency < 300 ? 'warning' : 'error'}
            compact={compact}
          />
        </div>
        {details.region.alternatives.length > 0 && (
          <div>
            <h5 className={cn('mb-2 font-medium text-gray-900', compact ? 'text-xs' : 'text-sm')}>
              Alternative Regions
            </h5>
            <div className="flex flex-wrap gap-2">
              {details.region.alternatives.map((region, index) => (
                <span
                  key={index}
                  className={cn(
                    'rounded-full bg-yellow-100 px-2 py-1 text-yellow-800',
                    compact ? 'text-xs' : 'text-sm',
                  )}>
                  {region}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Error display component
 */
const ErrorDisplay: React.FC<{
  error: TestError;
  compact?: boolean;
}> = ({ error, compact = false }) => {
  const containerPadding = compact ? 'p-3' : 'p-4';
  const titleSize = compact ? 'text-sm' : 'text-base';

  const getErrorIcon = () => {
    switch (error.type) {
      case 'network':
        return '🌐';
      case 'authentication':
        return '🔐';
      case 'configuration':
        return '⚙️';
      case 'service':
        return '🔧';
      default:
        return '❌';
    }
  };

  return (
    <div className={cn('rounded-lg border border-red-200 bg-red-50', containerPadding)}>
      <div className="flex items-start gap-3">
        <span className="text-xl">{getErrorIcon()}</span>
        <div className="min-w-0 flex-1">
          <h4 className={cn('mb-1 font-medium text-red-900', titleSize)}>
            {error.type.charAt(0).toUpperCase() + error.type.slice(1)} Error
          </h4>
          <p className={cn('mb-2 text-red-800', compact ? 'text-sm' : 'text-base')}>{error.message}</p>
          {error.details && (
            <div className={cn('rounded bg-red-100 p-2 text-red-700', compact ? 'text-xs' : 'text-sm')}>
              <strong>Details:</strong> {error.details}
            </div>
          )}
          {error.resolution && error.resolution.length > 0 && (
            <div className="mt-3">
              <h5 className={cn('mb-1 font-medium text-red-900', compact ? 'text-xs' : 'text-sm')}>
                Suggested Solutions:
              </h5>
              <ul className={cn('list-inside list-disc space-y-1 text-red-800', compact ? 'text-xs' : 'text-sm')}>
                {error.resolution.map((solution, index) => (
                  <li key={index}>{solution}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-2 flex items-center gap-2">
            <span
              className={cn(
                'rounded-full px-2 py-1',
                error.recoverable ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800',
                compact ? 'text-xs' : 'text-sm',
              )}>
              {error.recoverable ? 'Recoverable' : 'Critical'}
            </span>
            {error.code && (
              <span className={cn('rounded bg-gray-100 px-2 py-1 text-gray-700', compact ? 'text-xs' : 'text-sm')}>
                Code: {error.code}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Diagnostic information component
 */
const DiagnosticInfo: React.FC<DiagnosticInfoProps> = ({ testResult, compact = false }) => {
  if (!testResult) return null;

  const sectionGap = compact ? 'space-y-3' : 'space-y-4';

  return (
    <div className={sectionGap}>
      {/* Test Details */}
      {testResult.details && (
        <div className={sectionGap}>
          <ConnectionTestSection details={testResult.details} compact={compact} />
          <AuthenticationTestSection details={testResult.details} compact={compact} />
          <ServiceTestSection details={testResult.details} compact={compact} />
          <RegionOptimizationSection details={testResult.details} compact={compact} />
        </div>
      )}

      {/* Error Information */}
      {testResult.error && <ErrorDisplay error={testResult.error} compact={compact} />}

      {/* Performance Metrics */}
      {testResult.metrics && (
        <div className={cn('rounded-lg border border-gray-200 bg-white', compact ? 'p-3' : 'p-4')}>
          <h4 className={cn('mb-3 font-medium text-gray-900', compact ? 'text-sm' : 'text-base')}>
            📊 Performance Metrics
          </h4>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <MetricDisplay
              label="Connection Time"
              value={testResult.metrics.connectionTime}
              unit="ms"
              status={testResult.metrics.connectionTime < 1000 ? 'good' : 'warning'}
              compact={compact}
            />
            <MetricDisplay
              label="Auth Time"
              value={testResult.metrics.authTime}
              unit="ms"
              status={testResult.metrics.authTime < 500 ? 'good' : 'warning'}
              compact={compact}
            />
            <MetricDisplay
              label="Total Time"
              value={testResult.metrics.totalTime}
              unit="ms"
              status={testResult.metrics.totalTime < 2000 ? 'good' : 'warning'}
              compact={compact}
            />
            <MetricDisplay
              label="Latency"
              value={testResult.metrics.latency}
              unit="ms"
              status={
                testResult.metrics.latency < 100 ? 'good' : testResult.metrics.latency < 300 ? 'warning' : 'error'
              }
              compact={compact}
            />
          </div>
          {testResult.metrics.bandwidth && (
            <div className="mt-3">
              <MetricDisplay
                label="Bandwidth"
                value={Math.round(testResult.metrics.bandwidth / 1024)}
                unit="KB/s"
                compact={compact}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Main ValidationTools component
 */
export const ValidationTools: React.FC<ValidationToolsProps> = ({
  azureConfig,
  configForm,
  onRunTest,
  onValidateConfig: _onValidateConfig,
  onHealthCheck,
  className,
  compact = false,
}) => {
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failure'>('idle');
  const [testResult, setTestResult] = useState<ConfigTestResult | null>(null);
  const [lastTestTime, setLastTestTime] = useState<Date | null>(null);
  const [isRunningHealthCheck, setIsRunningHealthCheck] = useState(false);
  const [healthCheckResult, setHealthCheckResult] = useState<ConfigTestResult | null>(null);

  // Current configuration to test
  const configToTest = useMemo(
    () =>
      configForm
        ? {
            subscriptionKey: configForm.subscriptionKey,
            region: configForm.region,
            language: configForm.language,
            endpoint: configForm.endpoint,
            enableLogging: configForm.enableLogging,
          }
        : azureConfig,
    [configForm, azureConfig],
  );

  // Check if configuration is ready for testing
  const canRunTests =
    configToTest && configToTest.subscriptionKey && configToTest.region && configToTest.subscriptionKey.length === 32;

  // Run full connectivity test
  const handleRunTest = useCallback(async () => {
    if (!configToTest || !onRunTest || testStatus === 'testing') return;

    setTestStatus('testing');
    setTestResult(null);

    try {
      const result = await onRunTest(configToTest);
      setTestResult(result);
      setTestStatus(result.success ? 'success' : 'failure');
      setLastTestTime(new Date());
    } catch (error) {
      console.error('Test execution failed:', error);
      setTestStatus('failure');
      setTestResult({
        status: 'failure',
        startTime: new Date(),
        endTime: new Date(),
        success: false,
        message: error instanceof Error ? error.message : 'Test execution failed',
      });
    }
  }, [configToTest, onRunTest, testStatus]);

  // Run health check
  const handleHealthCheck = useCallback(async () => {
    if (!configToTest || !onHealthCheck || isRunningHealthCheck) return;

    setIsRunningHealthCheck(true);
    setHealthCheckResult(null);

    try {
      const result = await onHealthCheck(configToTest);
      setHealthCheckResult(result);
    } catch (error) {
      console.error('Health check failed:', error);
      setHealthCheckResult({
        isHealthy: false,
        error: error instanceof Error ? error.message : 'Health check failed',
      });
    } finally {
      setIsRunningHealthCheck(false);
    }
  }, [configToTest, onHealthCheck, isRunningHealthCheck]);

  // Auto-refresh health check periodically
  useEffect(() => {
    if (!canRunTests || !onHealthCheck) return;

    const interval = setInterval(() => {
      handleHealthCheck();
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [canRunTests, onHealthCheck, handleHealthCheck]);

  const containerPadding = compact ? 'p-4' : 'p-6';
  const sectionGap = compact ? 'space-y-4' : 'space-y-6';
  const headerSize = compact ? 'text-xl' : 'text-2xl';

  return (
    <div className={cn(containerPadding, sectionGap, className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className={cn('font-bold text-gray-900', headerSize)}>Configuration Validation</h1>
        <div className="flex items-center gap-2">
          <StatusIndicator status={testStatus} compact={compact} />
          {lastTestTime && (
            <span className={cn('text-gray-600', compact ? 'text-xs' : 'text-sm')}>
              Last tested: {lastTestTime.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Configuration Status */}
      {configToTest ? (
        <div className={cn('rounded-lg border border-gray-200 bg-gray-50', compact ? 'p-3' : 'p-4')}>
          <h3 className={cn('mb-2 font-medium text-gray-900', compact ? 'text-sm' : 'text-base')}>
            Current Configuration
          </h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <span className={cn('text-gray-600', compact ? 'text-xs' : 'text-sm')}>Subscription Key:</span>
              <p className={cn('font-mono', compact ? 'text-xs' : 'text-sm')}>
                {configToTest.subscriptionKey ? `****${configToTest.subscriptionKey.slice(-4)}` : 'Not set'}
              </p>
            </div>
            <div>
              <span className={cn('text-gray-600', compact ? 'text-xs' : 'text-sm')}>Region:</span>
              <p className={compact ? 'text-xs' : 'text-sm'}>{configToTest.region || 'Not set'}</p>
            </div>
            <div>
              <span className={cn('text-gray-600', compact ? 'text-xs' : 'text-sm')}>Language:</span>
              <p className={compact ? 'text-xs' : 'text-sm'}>{configToTest.language || 'Not set'}</p>
            </div>
            <div>
              <span className={cn('text-gray-600', compact ? 'text-xs' : 'text-sm')}>Logging:</span>
              <p className={compact ? 'text-xs' : 'text-sm'}>{configToTest.enableLogging ? 'Enabled' : 'Disabled'}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-8 text-center">
          <div className="text-gray-500">
            <div className="mb-2 text-4xl">⚙️</div>
            <h3 className={cn('mb-1 font-medium', compact ? 'text-base' : 'text-lg')}>No Configuration Available</h3>
            <p className={compact ? 'text-sm' : 'text-base'}>Please configure Azure Speech Service settings first</p>
          </div>
        </div>
      )}

      {/* Test Controls */}
      {canRunTests && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleRunTest}
            disabled={testStatus === 'testing'}
            className={cn(
              'rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50',
              compact ? 'text-sm' : 'text-base',
            )}>
            {testStatus === 'testing' ? '🔄 Testing...' : '🧪 Run Full Test'}
          </button>
          <button
            onClick={handleHealthCheck}
            disabled={isRunningHealthCheck}
            className={cn(
              'rounded border border-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50',
              compact ? 'text-sm' : 'text-base',
            )}>
            {isRunningHealthCheck ? '🔄 Checking...' : '💚 Health Check'}
          </button>
        </div>
      )}

      {/* Test Results */}
      {testResult && (
        <div>
          <h2 className={cn('mb-4 font-semibold text-gray-900', compact ? 'text-lg' : 'text-xl')}>Test Results</h2>

          {/* Summary */}
          <div
            className={cn(
              'mb-4 rounded-lg border',
              testResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50',
              compact ? 'p-3' : 'p-4',
            )}>
            <div className="flex items-center justify-between">
              <div>
                <h3
                  className={cn(
                    'font-medium',
                    testResult.success ? 'text-green-900' : 'text-red-900',
                    compact ? 'text-sm' : 'text-base',
                  )}>
                  {testResult.success ? '✅ Configuration Valid' : '❌ Configuration Invalid'}
                </h3>
                <p
                  className={cn(
                    testResult.success ? 'text-green-800' : 'text-red-800',
                    compact ? 'text-xs' : 'text-sm',
                  )}>
                  {testResult.message}
                </p>
              </div>
              {testResult.duration && (
                <div className="text-right">
                  <div
                    className={cn(
                      'font-semibold',
                      testResult.success ? 'text-green-900' : 'text-red-900',
                      compact ? 'text-sm' : 'text-base',
                    )}>
                    {testResult.duration}ms
                  </div>
                  <div
                    className={cn(
                      testResult.success ? 'text-green-700' : 'text-red-700',
                      compact ? 'text-xs' : 'text-sm',
                    )}>
                    Test duration
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Detailed Results */}
          <DiagnosticInfo testResult={testResult} compact={compact} />
        </div>
      )}

      {/* Health Check Results */}
      {healthCheckResult && (
        <div>
          <h2 className={cn('mb-4 font-semibold text-gray-900', compact ? 'text-lg' : 'text-xl')}>Service Health</h2>
          <div
            className={cn(
              'rounded-lg border',
              healthCheckResult.isHealthy ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50',
              compact ? 'p-3' : 'p-4',
            )}>
            <div className="flex items-center gap-2">
              <span className="text-lg">{healthCheckResult.isHealthy ? '💚' : '❤️‍🩹'}</span>
              <span
                className={cn(
                  'font-medium',
                  healthCheckResult.isHealthy ? 'text-green-900' : 'text-red-900',
                  compact ? 'text-sm' : 'text-base',
                )}>
                Service is {healthCheckResult.isHealthy ? 'Healthy' : 'Unhealthy'}
              </span>
            </div>
            {healthCheckResult.error && (
              <p className={cn('mt-2 text-red-800', compact ? 'text-xs' : 'text-sm')}>{healthCheckResult.error}</p>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!canRunTests && (
        <div className="py-8 text-center">
          <div className="text-gray-500">
            <div className="mb-2 text-4xl">🔧</div>
            <h3 className={cn('mb-1 font-medium', compact ? 'text-base' : 'text-lg')}>Configuration Required</h3>
            <p className={compact ? 'text-sm' : 'text-base'}>
              Complete the Azure configuration to enable validation tools
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
