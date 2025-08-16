/**
 * Options Page Layout Component
 *
 * Implements full page layout with navigation and sections, with responsive design
 * for different screen sizes. Provides comprehensive layout for options page.
 */

import { AzureConfigForm } from './AzureConfigForm';
import { PreferencesPanel } from './PreferencesPanel';
import { StorageManagement } from './StorageManagement';
import { ValidationTools } from './ValidationTools';
import { cn } from '@extension/ui';
import { useState, useCallback, useEffect, useMemo } from 'react';
import type {
  OptionsPageState,
  OptionsView,
  OptionsError,
  ValidationError,
  UserPreferences,
  ConfigTestResult,
} from '../types/options-state';
import type { AzureSpeechConfig } from '@extension/shared';

// Import options-specific components
import type React from 'react';

/**
 * Options layout component props
 */
interface OptionsLayoutProps {
  /** Current options page state */
  state: OptionsPageState;
  /** State update handlers */
  onStateChange: (updates: Partial<OptionsPageState>) => void;
  /** Navigation handlers */
  onNavigate: (view: OptionsView) => void;
  /** Save changes handler */
  onSave: () => Promise<void>;
  /** Reset to defaults handler */
  onReset: () => void;
  /** Test configuration handler */
  onTestConfig: () => Promise<ConfigTestResult>;
  /** Export configuration handler */
  onExport: () => void;
  /** Import configuration handler */
  onImport: (config: string) => void;
  /** Storage cleanup handler */
  onStorageCleanup: (categories: string[]) => Promise<void>;
  /** Custom class name */
  className?: string;
}

/**
 * Navigation section configuration
 */
interface NavSection {
  id: OptionsView;
  label: string;
  icon: string;
  description: string;
  badge?: string | number;
  disabled?: boolean;
}

/**
 * Get navigation sections configuration
 */
const getNavigationSections = (state: OptionsPageState): NavSection[] => [
  {
    id: 'azure',
    label: 'Azure Configuration',
    icon: '☁️',
    description: 'Configure Azure Speech Services',
    badge: state.validationErrors.filter(e => e.field.startsWith('azure')).length || undefined,
  },
  {
    id: 'preferences',
    label: 'Preferences',
    icon: '⚙️',
    description: 'Extension behavior and settings',
    badge: state.isDirty ? '●' : undefined,
  },
  {
    id: 'storage',
    label: 'Storage Management',
    icon: '💾',
    description: 'Manage storage and cache',
    badge:
      state.storageStats.healthStatus === 'critical'
        ? '⚠️'
        : state.storageStats.healthStatus === 'warning'
          ? '⚠️'
          : undefined,
  },
  {
    id: 'about',
    label: 'About',
    icon: 'ℹ️',
    description: 'Extension information and support',
  },
];

/**
 * Responsive sidebar navigation component
 */
const Sidebar: React.FC<{
  sections: NavSection[];
  currentView: OptionsView;
  onNavigate: (view: OptionsView) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  mobile?: boolean;
}> = ({ sections, currentView, onNavigate, collapsed = false, onToggleCollapse, mobile = false }) => (
  <div
    className={cn(
      'flex flex-col border-r border-gray-200 bg-white transition-all duration-200',
      mobile ? 'fixed inset-y-0 left-0 z-50 w-64 transform' : collapsed ? 'w-16' : 'w-64',
      mobile && !collapsed && 'translate-x-0',
      mobile && collapsed && '-translate-x-full',
    )}>
    {/* Header */}
    <div
      className={cn('flex items-center justify-between border-b border-gray-200 p-4', collapsed && !mobile && 'px-2')}>
      {(!collapsed || mobile) && <h2 className="text-lg font-semibold text-gray-900">Extension Settings</h2>}
      {onToggleCollapse && (
        <button
          onClick={onToggleCollapse}
          className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? '→' : '←'}
        </button>
      )}
    </div>

    {/* Navigation */}
    <nav className="flex-1 p-2">
      <ul className="space-y-1">
        {sections.map(section => (
          <li key={section.id}>
            <button
              onClick={() => !section.disabled && onNavigate(section.id)}
              disabled={section.disabled}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-all duration-150',
                currentView === section.id
                  ? 'border border-blue-200 bg-blue-100 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900',
                section.disabled && 'cursor-not-allowed opacity-50',
                collapsed && !mobile && 'justify-center px-2',
              )}
              title={collapsed && !mobile ? section.label : section.description}>
              <span className="flex-shrink-0 text-lg">{section.icon}</span>
              {(!collapsed || mobile) && (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{section.label}</div>
                    <div className="truncate text-xs text-gray-500">{section.description}</div>
                  </div>
                  {section.badge && (
                    <span
                      className={cn(
                        'flex-shrink-0 text-xs',
                        typeof section.badge === 'number'
                          ? 'min-w-[20px] rounded-full bg-red-500 px-2 py-0.5 text-center text-white'
                          : 'text-red-500',
                      )}>
                      {section.badge}
                    </span>
                  )}
                </>
              )}
            </button>
          </li>
        ))}
      </ul>
    </nav>

    {/* Footer */}
    {(!collapsed || mobile) && (
      <div className="border-t border-gray-200 p-4">
        <div className="text-xs text-gray-500">Extension v1.0.0</div>
      </div>
    )}
  </div>
);

/**
 * Top header component
 */
const Header: React.FC<{
  currentView: OptionsView;
  isDirty: boolean;
  isLoading: boolean;
  isSubmitting: boolean;
  lastSaved?: Date;
  onSave: () => void;
  onReset: () => void;
  onExport: () => void;
  onMenuToggle?: () => void;
  mobile?: boolean;
}> = ({
  currentView,
  isDirty,
  isLoading,
  isSubmitting,
  lastSaved,
  onSave,
  onReset,
  onExport,
  onMenuToggle,
  mobile = false,
}) => {
  const getViewTitle = (view: OptionsView) => {
    switch (view) {
      case 'azure':
        return 'Azure Configuration';
      case 'preferences':
        return 'Preferences';
      case 'storage':
        return 'Storage Management';
      case 'about':
        return 'About';
      default:
        return 'Settings';
    }
  };

  return (
    <div className="border-b border-gray-200 bg-white px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {mobile && onMenuToggle && (
            <button
              onClick={onMenuToggle}
              className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 lg:hidden">
              ☰
            </button>
          )}

          <div>
            <h1 className="text-xl font-semibold text-gray-900">{getViewTitle(currentView)}</h1>
            <div className="mt-1 flex items-center gap-4">
              {lastSaved && <span className="text-sm text-gray-500">Last saved: {lastSaved.toLocaleString()}</span>}
              {isDirty && <span className="text-sm font-medium text-amber-600">Unsaved changes</span>}
              {isLoading && (
                <span className="flex items-center gap-1 text-sm text-blue-600">
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  Loading...
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Export button */}
          <button
            onClick={onExport}
            disabled={isLoading}
            className="rounded-lg border border-gray-300 bg-gray-100 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50">
            📤 Export
          </button>

          {/* Reset button */}
          <button
            onClick={onReset}
            disabled={isLoading || isSubmitting || !isDirty}
            className="rounded-lg border border-gray-300 bg-gray-100 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50">
            Reset
          </button>

          {/* Save button */}
          <button
            onClick={onSave}
            disabled={isLoading || isSubmitting || !isDirty}
            className="flex items-center gap-2 rounded-lg border border-blue-600 bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
            {isSubmitting ? (
              <>
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Saving...
              </>
            ) : (
              <>
                <span>💾</span>
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Error display component
 */
const ErrorBanner: React.FC<{
  error: OptionsError;
  validationErrors: ValidationError[];
  onDismiss: () => void;
  onRetry?: () => void;
}> = ({ error, validationErrors, onDismiss, onRetry }) => {
  const hasValidationErrors = validationErrors.length > 0;

  return (
    <div className="mx-6 mt-4 rounded-r-lg border-l-4 border-red-400 bg-red-50 p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-red-500">⚠️</span>
            <h3 className="text-lg font-medium text-red-800">
              {error.type.charAt(0).toUpperCase() + error.type.slice(1)} Error
            </h3>
          </div>

          <p className="mb-2 text-red-700">{error.message}</p>

          {error.details && (
            <details className="text-sm text-red-600">
              <summary className="cursor-pointer hover:text-red-800">Technical Details</summary>
              <pre className="mt-2 overflow-x-auto rounded bg-red-100 p-2 text-xs">{error.details}</pre>
            </details>
          )}

          {hasValidationErrors && (
            <div className="mt-3">
              <h4 className="mb-2 text-sm font-medium text-red-800">Validation Errors:</h4>
              <ul className="space-y-1 text-sm text-red-700">
                {validationErrors.map((validationError, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="mt-0.5 text-red-500">•</span>
                    <span>
                      <strong>{validationError.field}:</strong> {validationError.message}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error.recoveryActions && error.recoveryActions.length > 0 && (
            <div className="mt-3">
              <h4 className="mb-2 text-sm font-medium text-red-800">Suggested Actions:</h4>
              <ul className="space-y-1 text-sm text-red-700">
                {error.recoveryActions.map((action, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="mt-0.5 text-red-500">•</span>
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="ml-4 flex items-center gap-2">
          {error.recoverable && onRetry && (
            <button
              onClick={onRetry}
              className="rounded bg-red-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-red-700">
              Retry
            </button>
          )}
          <button
            onClick={onDismiss}
            className="rounded bg-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-400">
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * About page content
 */
const AboutView: React.FC = () => (
  <div className="mx-auto max-w-4xl space-y-6">
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-xl font-semibold text-gray-900">Meeting Summarizer Extension</h2>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="mb-2 font-medium text-gray-900">Version Information</h3>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600">Version:</dt>
              <dd className="font-medium">1.0.0</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Build:</dt>
              <dd className="font-mono text-xs">20240101.1200</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">API Version:</dt>
              <dd className="font-mono text-xs">v1.2.3</dd>
            </div>
          </dl>
        </div>

        <div>
          <h3 className="mb-2 font-medium text-gray-900">Support</h3>
          <div className="space-y-2 text-sm">
            <div>
              <a
                href="https://github.com/example/meeting-summarizer/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-800">
                Report an Issue
              </a>
            </div>
            <div>
              <a
                href="https://docs.example.com/meeting-summarizer"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-800">
                Documentation
              </a>
            </div>
            <div>
              <a href="mailto:support@example.com" className="text-blue-600 underline hover:text-blue-800">
                Contact Support
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 border-t border-gray-200 pt-6">
        <h3 className="mb-2 font-medium text-gray-900">Privacy & Terms</h3>
        <div className="space-y-2 text-sm text-gray-600">
          <p>
            This extension processes audio locally using Azure Speech Services. Your meeting data is only stored locally
            unless explicitly exported.
          </p>
          <div className="flex gap-4">
            <a href="#" className="text-blue-600 underline hover:text-blue-800">
              Privacy Policy
            </a>
            <a href="#" className="text-blue-600 underline hover:text-blue-800">
              Terms of Service
            </a>
            <a href="#" className="text-blue-600 underline hover:text-blue-800">
              Open Source Licenses
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
);

/**
 * Main content area component
 */
const MainContent: React.FC<{
  currentView: OptionsView;
  state: OptionsPageState;
  onStateChange: (updates: Partial<OptionsPageState>) => void;
  onTestConfig: () => Promise<ConfigTestResult>;
  onStorageCleanup: (categories: string[]) => Promise<void>;
}> = ({ currentView, state, onStateChange, onTestConfig, onStorageCleanup }) => {
  const renderContent = () => {
    switch (currentView) {
      case 'azure':
        return (
          <div className="space-y-6">
            <AzureConfigForm
              config={state.azureConfig}
              testResults={state.testResults}
              validationErrors={state.validationErrors.filter(e => e.field.startsWith('azure'))}
              isLoading={state.isLoading}
              onConfigChange={config =>
                onStateChange({
                  azureConfig: { ...state.azureConfig, ...config },
                  isDirty: true,
                })
              }
              onTest={onTestConfig}
            />

            <ValidationTools
              config={state.azureConfig}
              testResults={state.testResults}
              onTest={onTestConfig}
              isLoading={state.isLoading}
            />
          </div>
        );

      case 'preferences':
        return (
          <PreferencesPanel
            preferences={state.userPreferences}
            onPreferencesChange={preferences =>
              onStateChange({
                userPreferences: { ...state.userPreferences, ...preferences },
                isDirty: true,
              })
            }
            supportedLanguages={state.supportedLanguages}
          />
        );

      case 'storage':
        return (
          <StorageManagement
            stats={state.storageStats}
            onCleanup={onStorageCleanup}
            onRefresh={() => onStateChange({ isLoading: true })}
            isLoading={state.isLoading}
          />
        );

      case 'about':
        return <AboutView />;

      default:
        return (
          <div className="flex h-64 items-center justify-center">
            <div className="text-center text-gray-500">
              <p>View not found: {currentView}</p>
            </div>
          </div>
        );
    }
  };

  return <div className="flex-1 overflow-y-auto p-6">{renderContent()}</div>;
};

/**
 * Main OptionsLayout component
 */
export const OptionsLayout: React.FC<OptionsLayoutProps> = ({
  state,
  onStateChange,
  onNavigate,
  onSave,
  onReset,
  onTestConfig,
  onExport,
  onImport,
  onStorageCleanup,
  className,
}) => {
  // Responsive state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Navigation sections
  const navigationSections = useMemo(() => getNavigationSections(state), [state]);

  // Handle navigation
  const handleNavigate = useCallback(
    (view: OptionsView) => {
      onNavigate(view);
      onStateChange({ currentView: view });
      if (isMobile) {
        setMobileMenuOpen(false);
      }
    },
    [onNavigate, onStateChange, isMobile],
  );

  // Handle error dismissal
  const handleErrorDismiss = useCallback(() => {
    onStateChange({ error: undefined });
  }, [onStateChange]);

  // Handle sidebar toggle
  const handleSidebarToggle = useCallback(() => {
    if (isMobile) {
      setMobileMenuOpen(!mobileMenuOpen);
    } else {
      setSidebarCollapsed(!sidebarCollapsed);
    }
  }, [isMobile, mobileMenuOpen, sidebarCollapsed]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarCollapsed(false);
        setMobileMenuOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle mobile menu backdrop click
  const handleBackdropClick = useCallback(() => {
    if (isMobile && mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  }, [isMobile, mobileMenuOpen]);

  return (
    <div className={cn('flex min-h-screen bg-gray-50', className)}>
      {/* Mobile backdrop */}
      {isMobile && mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black bg-opacity-50" onClick={handleBackdropClick} />
      )}

      {/* Sidebar */}
      <Sidebar
        sections={navigationSections}
        currentView={state.currentView}
        onNavigate={handleNavigate}
        collapsed={isMobile ? !mobileMenuOpen : sidebarCollapsed}
        onToggleCollapse={!isMobile ? handleSidebarToggle : undefined}
        mobile={isMobile}
      />

      {/* Main content area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <Header
          currentView={state.currentView}
          isDirty={state.isDirty}
          isLoading={state.isLoading}
          isSubmitting={state.isSubmitting}
          lastSaved={state.lastSaved}
          onSave={onSave}
          onReset={onReset}
          onExport={onExport}
          onMenuToggle={isMobile ? handleSidebarToggle : undefined}
          mobile={isMobile}
        />

        {/* Error banner */}
        {state.error && (
          <ErrorBanner
            error={state.error}
            validationErrors={state.validationErrors}
            onDismiss={handleErrorDismiss}
            onRetry={state.error.recoverable ? onTestConfig : undefined}
          />
        )}

        {/* Main content */}
        <MainContent
          currentView={state.currentView}
          state={state}
          onStateChange={onStateChange}
          onTestConfig={onTestConfig}
          onStorageCleanup={onStorageCleanup}
        />
      </div>
    </div>
  );
};

/**
 * Compact options layout for embedded use
 */
export const CompactOptionsLayout: React.FC<OptionsLayoutProps> = props => {
  const compactState = {
    ...props.state,
    userPreferences: {
      ...props.state.userPreferences,
      interface: {
        ...props.state.userPreferences.interface,
        compactMode: true,
      },
    },
  };

  return <OptionsLayout {...props} state={compactState} className="h-screen" />;
};

/**
 * Mobile-optimized options layout
 */
export const MobileOptionsLayout: React.FC<OptionsLayoutProps> = props => (
  <div className="min-h-screen bg-gray-50">
    <OptionsLayout {...props} className="mobile-layout" />
  </div>
);
