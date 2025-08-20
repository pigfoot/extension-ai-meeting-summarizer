import 'webextension-polyfill';
import { BackgroundMain } from './services/background-main';
// import { exampleThemeStorage } from '@extension/storage';

// Initialize background service main coordinator
let backgroundService: BackgroundMain | null = null;
let isInitializing = false;
let isInitialized = false;

/**
 * Initialize the enhanced background service system
 */
const initializeBackgroundService = async (): Promise<void> => {
  // Prevent duplicate initialization
  if (isInitializing) {
    console.log('[Background] ⏳ Background service already initializing, skipping...');
    return;
  }

  if (isInitialized) {
    console.log('[Background] ✅ Background service already initialized, skipping...');
    return;
  }

  try {
    isInitializing = true;
    console.log('[Background] 🚀 Initializing enhanced background service');

    // Create background service coordinator
    backgroundService = new BackgroundMain({
      enablePerformanceMonitoring: true,
      enableErrorAggregation: true,
      enableJobOrchestration: true,
      enableAzureIntegration: true,
      enableStorageCoordination: true,
      enableMessagingCoordination: true,
      healthCheckInterval: 30000, // 30 seconds
      recovery: {
        enableAutoRecovery: true,
        maxRetryAttempts: 3,
        recoveryDelay: 5000,
      },
      debug: {
        enableDebugLogging: process.env.NODE_ENV === 'development',
        logPerformanceMetrics: process.env.NODE_ENV === 'development',
        logSubsystemStatus: process.env.NODE_ENV === 'development',
      },
    });

    // Initialize the background service
    await backgroundService.initialize();

    isInitialized = true;
    console.log('[Background] ✅ Enhanced background service initialized successfully');

    // Log service statistics
    const stats = backgroundService.getStats();
    console.log('[Background] Service statistics:', {
      uptime: stats.uptime,
      subsystems: stats.subsystems,
      totalOperations: stats.totalOperations,
    });
  } catch (error) {
    console.error('[Background] ❌ Failed to initialize enhanced background service:', error);
    backgroundService = null;
    // Fallback to basic initialization
    console.log('[Background] Falling back to basic initialization');
  } finally {
    isInitializing = false;
  }
};

/**
 * Handle extension startup
 */
const handleExtensionStartup = async (): Promise<void> => {
  try {
    console.log('[Background] Extension startup detected');

    // Maintain existing theme storage functionality
    // const theme = await exampleThemeStorage.get();
    // console.log('[Background] Current theme:', theme);

    // Initialize enhanced background service
    await initializeBackgroundService();
  } catch (error) {
    console.error('[Background] Extension startup failed:', error);
  }
};

/**
 * Handle extension shutdown
 */
const handleExtensionShutdown = async (): Promise<void> => {
  try {
    console.log('[Background] Extension shutdown detected');

    if (backgroundService) {
      await backgroundService.shutdown();
      backgroundService = null;
    }
  } catch (error) {
    console.error('[Background] Extension shutdown failed:', error);
  }
};

/**
 * Get background service instance
 */
const getBackgroundService = (): BackgroundMain | null => backgroundService;

// OLD FALLBACK HANDLER REMOVED - Using simplified direct handler instead

// Register message handler

// CRITICAL: Add handler immediately to ensure it's first in line
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (message?.type === 'GET_STATUS') {
      const response = {
        status: 'connected',
        timestamp: new Date().toISOString(),
      };
      sendResponse(response);
      return true;
    }

    // For all other messages, delegate to backgroundService if available
    if (backgroundService) {
      try {
        const messageRouter = backgroundService.getSubsystem('messageRouter');
        if (messageRouter && typeof messageRouter.routeMessage === 'function') {
          messageRouter
            .routeMessage(message, sender)
            .then(response => {
              sendResponse(response);
            })
            .catch(error => {
              console.error('[Background] MessageRouter error:', error);
              sendResponse({
                success: false,
                error: error instanceof Error ? error.message : 'MessageRouter failed',
              });
            });
          return true; // Keep channel open for async response
        }
      } catch (error) {
        console.error('[Background] ❌ Delegation failed:', error);
      }
    }

    // Fallback response for unsupported messages
    sendResponse({
      success: false,
      error: 'Background service not ready or message type not supported',
      messageType: message?.type,
    });
    return true;
  } catch (error) {
    console.error('[Background] Direct handler error:', error);
    sendResponse({ error: 'Direct handler failed' });
    return true;
  }
});

console.log('[Background] ✅ DIRECT message handler registered');

// Handle service worker installation and startup
chrome.runtime.onInstalled.addListener(details => {
  console.log('[Background] Extension installed/updated:', details.reason);
  handleExtensionStartup();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[Background] Browser startup detected');
  handleExtensionStartup();
});

// Handle service worker suspension
chrome.runtime.onSuspend.addListener(() => {
  console.log('[Background] Service worker suspension detected');
  handleExtensionShutdown();
});

// Handle service worker suspension cancel
chrome.runtime.onSuspendCanceled.addListener(() => {
  console.log('[Background] Service worker suspension canceled');
});

// Initialize on script load
handleExtensionStartup();

// Export for testing and debugging
if (process.env.NODE_ENV === 'development') {
  (globalThis as typeof globalThis & { __backgroundService: unknown }).__backgroundService = {
    getService: getBackgroundService,
    restart: async () => {
      if (backgroundService) {
        await backgroundService.restart();
      }
    },
    getStats: () => backgroundService?.getStats(),
    getHealth: () => backgroundService?.getSubsystemHealth(),
  };
}

console.log('[Background] Enhanced background service loaded');
console.log("Edit 'chrome-extension/src/background/index.ts' and save to reload.");

// Expose service for other modules if needed
export { getBackgroundService, BackgroundMain };
