import '@src/Popup.css';
import { withErrorBoundary, withSuspense } from '@extension/shared';
import { ErrorDisplay, LoadingSpinner } from '@extension/ui';
import { useState, useEffect } from 'react';

const Popup = () => {
  const [currentView, setCurrentView] = useState<'jobs' | 'meetings' | 'summary' | 'settings'>('jobs');
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'error' | 'reconnecting'>(
    'disconnected',
  );
  const [activeJobs, setActiveJobs] = useState<unknown[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  useEffect(() => {
    // Try to connect to background service
    const connectToBackground = async () => {
      try {
        setConnectionStatus('reconnecting');
        console.log('[Popup] Connecting to background service...');

        const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
        console.log('[Popup] Status response:', response);

        if (response && response.status === 'connected') {
          setConnectionStatus('connected');
          console.log('[Popup] Connected successfully. Services:', response.services);
        } else {
          setConnectionStatus('error');
          console.error('[Popup] Connection failed:', response);
        }
      } catch (error) {
        setConnectionStatus('error');
        console.error('[Popup] Connection error:', error);
      }
    };

    // Poll for active jobs
    const pollActiveJobs = async () => {
      try {
        console.log('[Popup] Polling for active jobs...');
        const response = await chrome.runtime.sendMessage({ type: 'GET_ACTIVE_JOBS' });
        console.log('[Popup] GET_ACTIVE_JOBS response:', response);

        if (response && response.jobs) {
          console.log(`[Popup] Setting ${response.jobs.length} active jobs:`, response.jobs);
          setActiveJobs(response.jobs);

          // Clear debug info if we have jobs
          if (response.jobs.length > 0) {
            setDebugInfo(null);
          }
        } else {
          console.warn('[Popup] No jobs in response or invalid response:', response);
          setActiveJobs([]);

          // If connected but no jobs, run diagnostic
          if (connectionStatus === 'connected') {
            await runJobStateDiagnostic();
          }
        }
      } catch (error) {
        console.error('[Popup] Failed to get active jobs:', error);
        setActiveJobs([]);
      }
    };

    // Auto-diagnostic when connected but no jobs shown
    const runJobStateDiagnostic = async () => {
      try {
        console.log('[Popup] Running job state diagnostic...');
        const debugResponse = await chrome.runtime.sendMessage({ type: 'DEBUG_JOB_STATE' });
        console.log('[Popup] DEBUG_JOB_STATE response:', debugResponse);

        if (debugResponse && !debugResponse.error) {
          const { jobTracker, jobQueue, analysis } = debugResponse;
          const diagnostic = `Jobs State Analysis:
• JobTracker: ${jobTracker?.totalJobs || 0} total jobs
• JobQueue: ${jobQueue?.totalQueued || 0} queued jobs  
• Analysis: ${analysis?.trackedButNotQueued || 0} tracked but not queued, ${analysis?.possibleStuckJobs || 0} possibly stuck`;

          setDebugInfo(diagnostic);
          console.log('[Popup] Diagnostic info:', diagnostic);
        } else {
          setDebugInfo(`Diagnostic failed: ${debugResponse?.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.log('[Popup] Diagnostic request failed:', error);
        setDebugInfo(`Diagnostic error: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    };

    connectToBackground();

    // Set up polling intervals
    const connectionInterval = setInterval(connectToBackground, 10000); // Check connection every 10s
    const jobsInterval = setInterval(pollActiveJobs, 2000); // Check jobs every 2s

    return () => {
      clearInterval(connectionInterval);
      clearInterval(jobsInterval);
    };
  }, [connectionStatus]);

  const startAudioCapture = async () => {
    try {
      console.log('[Popup] Starting audio capture...');
      setIsLoading(true);

      const response = await chrome.runtime.sendMessage({
        type: 'START_AUDIO_CAPTURE',
        source: 'system_audio',
      });

      console.log('[Popup] Audio capture response:', response);

      if (response && response.success) {
        console.log('[Popup] Job started successfully:', response.job);
        // Job started successfully - polling will pick it up
      } else {
        console.error('[Popup] Failed to start audio capture:', response);
        alert(`Failed to start audio capture: ${response?.error || response?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[Popup] Error starting audio capture:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const openFullOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  const getConnectionIndicator = () => {
    switch (connectionStatus) {
      case 'connected':
        return { icon: '🟢', label: 'Connected', color: 'text-green-600' };
      case 'disconnected':
        return { icon: '🔴', label: 'Disconnected', color: 'text-red-600' };
      case 'error':
        return { icon: '⚠️', label: 'Error', color: 'text-orange-600' };
      case 'reconnecting':
        return { icon: '🟡', label: 'Connecting...', color: 'text-yellow-600' };
    }
  };

  const connection = getConnectionIndicator();

  const renderMainContent = () => {
    switch (currentView) {
      case 'jobs':
        return (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="mb-2 text-lg font-semibold text-gray-900">Active Jobs</h2>
              {activeJobs.length === 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">No active transcription jobs</p>
                  {connectionStatus === 'connected' && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700">
                      <div className="flex items-center gap-2">
                        <span>ℹ️</span>
                        <span>
                          Connected to background service. Jobs may be processing in background.
                          <br />
                          <strong>Status sync improved</strong> - processing jobs should now appear here.
                        </span>
                      </div>
                    </div>
                  )}
                  {debugInfo && connectionStatus === 'connected' && (
                    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800">
                      <div className="flex items-start gap-2">
                        <span>🔍</span>
                        <div>
                          <div className="font-medium">Diagnostic Info:</div>
                          <pre className="mt-1 whitespace-pre-wrap">{debugInfo}</pre>
                        </div>
                      </div>
                    </div>
                  )}
                  {connectionStatus === 'error' && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                      <div className="flex items-center gap-2">
                        <span>⚠️</span>
                        <span>Unable to connect to background service. Job status unavailable.</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {activeJobs.map((job, index) => (
                    <div key={job.id || index} className="rounded border bg-gray-50 p-3 text-left">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-sm font-medium">{job.title || job.id}</div>
                        <div
                          className={`rounded px-2 py-1 text-xs ${
                            job.status === 'processing'
                              ? 'bg-blue-100 text-blue-700'
                              : job.status === 'completed'
                                ? 'bg-green-100 text-green-700'
                                : job.status === 'failed'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-gray-100 text-gray-700'
                          }`}>
                          {job.status}
                        </div>
                      </div>

                      {job.progress !== undefined && (
                        <div className="mb-2">
                          <div className="mb-1 flex justify-between text-xs text-gray-600">
                            <span>{job.stage || 'Processing'}</span>
                            <span>{job.progress}%</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-gray-200">
                            <div
                              className="h-2 rounded-full bg-blue-600 transition-all duration-300"
                              style={{ width: `${Math.min(100, Math.max(0, job.progress || 0))}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="text-xs text-gray-500">
                        {job.startTime && `Started: ${new Date(job.startTime).toLocaleTimeString()}`}
                        {job.estimatedCompletion && ` • ETA: ${new Date(job.estimatedCompletion).toLocaleTimeString()}`}
                      </div>

                      {job.error && <div className="mt-2 rounded bg-red-50 p-2 text-xs text-red-600">{job.error}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t pt-4">
              <button
                onClick={startAudioCapture}
                disabled={isLoading || connectionStatus !== 'connected'}
                className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⏳</span>
                    Starting...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">🎤 Start Audio Capture</span>
                )}
              </button>

              <p className="mt-2 text-center text-xs text-gray-500">Capture system audio for real-time transcription</p>
            </div>
          </div>
        );

      case 'meetings':
        return (
          <div className="text-center">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Recent Meetings</h2>
            <p className="text-sm text-gray-500">No recent meetings found</p>
          </div>
        );

      case 'summary':
        return (
          <div className="text-center">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Summary</h2>
            <p className="text-sm text-gray-500">Select a meeting to view its summary</p>
          </div>
        );

      case 'settings':
        return (
          <div className="space-y-4">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Settings</h2>
            <button
              onClick={openFullOptions}
              className="w-full rounded-lg bg-gray-100 px-4 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-200">
              Open Full Settings
            </button>
          </div>
        );
    }
  };

  const tabs = [
    { id: 'jobs' as const, label: 'Jobs', icon: '⚡', badge: activeJobs.length || undefined },
    { id: 'meetings' as const, label: 'Meetings', icon: '📋' },
    { id: 'summary' as const, label: 'Summary', icon: '📝' },
    { id: 'settings' as const, label: 'Settings', icon: '⚙️' },
  ];

  return (
    <div className="popup-container">
      {/* Header with Navigation */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-3 py-2">
        {/* Navigation Tabs */}
        <div className="flex min-w-0 flex-1 items-center gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setCurrentView(tab.id)}
              className={`relative flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                currentView === tab.id
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}>
              <span className="text-sm">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.badge && (
                <span className="ml-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-xs text-white">
                  {typeof tab.badge === 'number' && tab.badge > 99 ? '99+' : tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Connection Status */}
        <div className={`flex items-center gap-1 ${connection.color}`}>
          <span className="text-xs">{connection.icon}</span>
          <span className="text-xs font-medium">{connection.label}</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4">{renderMainContent()}</div>

      {/* Footer */}
      <div className="flex items-center justify-center border-t border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
        <span>Meeting Summarizer Extension</span>
      </div>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Popup, <LoadingSpinner />), ErrorDisplay);
