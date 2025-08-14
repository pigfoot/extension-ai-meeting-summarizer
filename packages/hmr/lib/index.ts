/**
 * Hot Module Replacement (HMR) Package - Enhanced Index
 *
 * Provides hot reload functionality for Chrome Extension development
 * with enhanced support for meeting-specific components and modules.
 */

// Type declarations for HMR
declare global {
  interface NodeModule {
    hot?: {
      accept(dependency?: string | string[], callback?: () => void): void;
      dispose(callback: () => void): void;
    };
  }
}

// Export existing HMR functionality
export * from './plugins/index.js';
export * from './initializers/init-client.js';
export type * from './initializers/init-reload-server.js';
export type * from './injections/refresh.js';
export type * from './injections/reload.js';
export * from './interpreter/index.js';
export * from './consts.js';
export type * from './types.js';

/**
 * Meeting-specific HMR configuration and utilities
 */
export const MeetingHMRConfig = {
  /**
   * File patterns to watch for meeting-related changes
   */
  WATCH_PATTERNS: [
    // Meeting core package
    'packages/meeting-core/**/*.ts',
    'packages/meeting-core/**/*.tsx',

    // Meeting types
    'packages/shared/lib/types/meeting.ts',
    'packages/shared/lib/types/azure.ts',
    'packages/shared/lib/types/extension.ts',

    // Storage schemas
    'packages/storage/lib/schemas/**/*.ts',
    'packages/storage/lib/utils/**/*.ts',

    // Chrome extension manifest and types
    'chrome-extension/manifest.ts',
    'chrome-extension/src/types/**/*.ts',
    'chrome-extension/utils/**/*.ts',

    // Background scripts
    'chrome-extension/src/background/**/*.ts',

    // Content scripts (for meeting detection)
    'chrome-extension/src/content/**/*.ts',
    'chrome-extension/src/content/**/*.tsx',
  ],

  /**
   * Modules that should trigger full reload instead of HMR
   */
  FULL_RELOAD_PATTERNS: [
    // Manifest changes require full reload
    'chrome-extension/manifest.ts',

    // Background script changes require full reload
    'chrome-extension/src/background/**/*.ts',

    // Core type changes might require full reload
    'packages/shared/lib/types/extension.ts',

    // Storage schema changes might require full reload
    'packages/storage/lib/schemas/**/*.ts',
  ],

  /**
   * HMR-friendly patterns (can use hot reload)
   */
  HOT_RELOAD_PATTERNS: [
    // UI components
    '**/*.tsx',
    '**/*.jsx',

    // Utility functions
    'packages/shared/lib/utils/**/*.ts',
    'packages/meeting-core/lib/**/*.ts',

    // CSS and styles
    '**/*.css',
    '**/*.scss',
    '**/*.sass',
  ],

  /**
   * Development server configuration
   */
  DEV_SERVER: {
    port: 8080,
    host: 'localhost',
    allowedHosts: ['localhost', '127.0.0.1'],
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization',
    },
  },
} as const;

/**
 * Enhanced HMR utilities for meeting functionality
 */
export const MeetingHMRUtils = {
  /**
   * Check if file change should trigger full reload
   */
  shouldFullReload(filePath: string): boolean {
    return MeetingHMRConfig.FULL_RELOAD_PATTERNS.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
      return regex.test(filePath);
    });
  },

  /**
   * Check if file supports hot reload
   */
  supportsHotReload(filePath: string): boolean {
    return MeetingHMRConfig.HOT_RELOAD_PATTERNS.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
      return regex.test(filePath);
    });
  },

  /**
   * Determine reload strategy for a file change
   */
  getReloadStrategy(filePath: string): 'full' | 'hot' | 'none' {
    if (this.shouldFullReload(filePath)) {
      return 'full';
    }

    if (this.supportsHotReload(filePath)) {
      return 'hot';
    }

    return 'none';
  },

  /**
   * Generate HMR-friendly module ID for meeting components
   */
  generateModuleId(filePath: string): string {
    // Convert file path to a consistent module ID
    const normalizedPath = filePath
      .replace(/\\/g, '/')
      .replace(/^.*\/packages\//, '@extension/')
      .replace(/^.*\/chrome-extension\//, '@extension/chrome-extension/')
      .replace(/\.tsx?$/, '')
      .replace(/\/index$/, '');

    return normalizedPath;
  },

  /**
   * Create HMR accept callback for meeting modules
   */
  createMeetingHMRCallback(moduleId: string): (() => void) | undefined {
    return () => {
      console.log(`[MeetingHMR] Hot reloading module: ${moduleId}`);

      // Trigger custom events for meeting-specific modules
      if (moduleId.includes('meeting-core')) {
        window.dispatchEvent(
          new CustomEvent('meeting-core-hmr-update', {
            detail: { moduleId },
          }),
        );
      }

      if (moduleId.includes('storage')) {
        window.dispatchEvent(
          new CustomEvent('storage-hmr-update', {
            detail: { moduleId },
          }),
        );
      }

      if (moduleId.includes('types')) {
        // Type changes might need special handling
        window.dispatchEvent(
          new CustomEvent('types-hmr-update', {
            detail: { moduleId },
          }),
        );
      }
    };
  },

  /**
   * Setup HMR listeners for meeting functionality
   */
  setupMeetingHMRListeners(): void {
    if (typeof window === 'undefined') return;

    // Listen for meeting core updates
    window.addEventListener('meeting-core-hmr-update', event => {
      const { moduleId } = (event as CustomEvent).detail;
      console.log(`[MeetingHMR] Meeting core module updated: ${moduleId}`);

      // Refresh meeting-related UI components
      const meetingElements = document.querySelectorAll('[data-meeting-component]');
      meetingElements.forEach(element => {
        element.dispatchEvent(new CustomEvent('refresh-meeting-component'));
      });
    });

    // Listen for storage updates
    window.addEventListener('storage-hmr-update', event => {
      const { moduleId } = (event as CustomEvent).detail;
      console.log(`[MeetingHMR] Storage module updated: ${moduleId}`);

      // Clear storage caches if needed
      if (moduleId.includes('cache')) {
        window.dispatchEvent(new CustomEvent('clear-storage-cache'));
      }
    });

    // Listen for type updates
    window.addEventListener('types-hmr-update', event => {
      const { moduleId } = (event as CustomEvent).detail;
      console.log(`[MeetingHMR] Types updated: ${moduleId}`);

      // Type updates might require full page refresh in development
      if (process.env.NODE_ENV === 'development') {
        console.warn('[MeetingHMR] Type definitions updated, consider full page refresh');
      }
    });
  },

  /**
   * Cleanup HMR listeners
   */
  cleanupMeetingHMRListeners(): void {
    if (typeof window === 'undefined') return;

    window.removeEventListener('meeting-core-hmr-update', this.setupMeetingHMRListeners);
    window.removeEventListener('storage-hmr-update', this.setupMeetingHMRListeners);
    window.removeEventListener('types-hmr-update', this.setupMeetingHMRListeners);
  },
} as const;

/**
 * HMR development server utilities
 */
export const HMRDevServer = {
  /**
   * Check if HMR is available
   */
  isHMRAvailable(): boolean {
    return typeof module !== 'undefined' && (module as NodeModule).hot !== undefined;
  },

  /**
   * Check if running in development mode
   */
  isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
  },

  /**
   * Enable HMR for meeting modules
   */
  enableMeetingHMR(): void {
    if (!this.isHMRAvailable() || !this.isDevelopment()) {
      return;
    }

    console.log('[MeetingHMR] Enabling HMR for meeting modules');

    // Setup HMR listeners
    MeetingHMRUtils.setupMeetingHMRListeners();

    // Accept HMR updates for this module
    const moduleHot = (module as NodeModule).hot;
    if (moduleHot) {
      moduleHot.accept();

      // Handle disposal
      moduleHot.dispose(() => {
        MeetingHMRUtils.cleanupMeetingHMRListeners();
      });
    }
  },

  /**
   * Create HMR-enabled module wrapper
   */
  createHMRModule<T>(moduleFactory: () => T, moduleId?: string): T {
    const moduleResult = moduleFactory();

    if (this.isHMRAvailable() && this.isDevelopment()) {
      const id = moduleId || 'anonymous-module';
      console.log(`[MeetingHMR] Registering HMR module: ${id}`);

      // Setup HMR callback
      const callback = MeetingHMRUtils.createMeetingHMRCallback(id);
      const moduleHot = (module as NodeModule).hot;
      if (moduleHot) {
        moduleHot.accept(undefined, callback);
      }
    }

    return moduleResult;
  },
} as const;

/**
 * Auto-setup HMR for meeting functionality in development
 */
if (HMRDevServer.isDevelopment()) {
  // Setup HMR listeners when module loads
  if (typeof window !== 'undefined') {
    // Defer setup until DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        HMRDevServer.enableMeetingHMR();
      });
    } else {
      HMRDevServer.enableMeetingHMR();
    }
  }
}

// Default export for convenience
export default {
  config: MeetingHMRConfig,
  utils: MeetingHMRUtils,
  server: HMRDevServer,
};
