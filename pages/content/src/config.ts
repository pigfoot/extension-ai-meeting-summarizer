/**
 * Content Script Configuration
 *
 * Default configuration values and environment-specific settings
 * for the content script system.
 */

import type { AnalysisConfig } from './analysis/content-analyzer';
import type { CompatibilityConfig } from './compat/browser-compat';
import type { ContentScriptConfig } from './content-script';
import type { ActivationConfig } from './features/feature-activation';

/**
 * Environment detection
 */
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';
const isTesting = process.env.NODE_ENV === 'test';

/**
 * Default content script configuration
 */
export const DEFAULT_CONTENT_SCRIPT_CONFIG: ContentScriptConfig = {
  autoInitialize: true,
  enableDebugLogging: isDevelopment,
  initializationTimeout: 30000,
  enablePerformanceMonitoring: !isTesting,
  featureActivationDelay: isDevelopment ? 500 : 1000,
  enableErrorReporting: isProduction,
  compatibilityMode: 'auto',
  maxInitRetries: 3,
};

/**
 * Default content analysis configuration
 */
export const DEFAULT_ANALYSIS_CONFIG: AnalysisConfig = {
  enableRealTimeMonitoring: true,
  analysisInterval: isDevelopment ? 1000 : 2000,
  meetingThreshold: 0.7,
  changeSensitivity: 'medium',
  platformRules: {
    sharepoint: true,
    teams: true,
    generic: true,
  },
  advancedFeatures: {
    semanticAnalysis: false,
    contextLearning: false,
    patternRecognition: true,
  },
  performance: {
    maxAnalysisTime: 5000,
    cacheResults: true,
    throttleUpdates: !isDevelopment,
  },
};

/**
 * Default feature activation configuration
 */
export const DEFAULT_ACTIVATION_CONFIG: ActivationConfig = {
  autoActivation: true,
  activationDelay: 1000,
  enableResourceMonitoring: !isTesting,
  maxConcurrentFeatures: 10,
  performanceMode: isDevelopment ? 'aggressive' : 'balanced',
  updateStrategy: isDevelopment ? 'immediate' : 'throttled',
  enableDebugLogging: isDevelopment,
};

/**
 * Default browser compatibility configuration
 */
export const DEFAULT_COMPATIBILITY_CONFIG: CompatibilityConfig = {
  enablePolyfills: true,
  enableFeatureLogging: isDevelopment,
  strictMode: false,
  fallbackStrategy: 'graceful',
  minimumVersions: {
    chrome: 88,
    firefox: 78,
    safari: 14,
    edge: 88,
  },
  featureOverrides: {},
};

/**
 * Platform-specific configurations
 */
export const PLATFORM_CONFIGS = {
  sharepoint: {
    analysis: {
      platformRules: {
        sharepoint: true,
        teams: false,
        generic: true,
      },
      meetingThreshold: 0.6, // Lower threshold for SharePoint
    },
    activation: {
      maxConcurrentFeatures: 8, // Fewer features on SharePoint
      performanceMode: 'conservative' as const,
    },
  },

  teams: {
    analysis: {
      platformRules: {
        sharepoint: false,
        teams: true,
        generic: true,
      },
      meetingThreshold: 0.8, // Higher threshold for Teams
    },
    activation: {
      maxConcurrentFeatures: 12, // More features on Teams
      performanceMode: 'balanced' as const,
    },
  },

  generic: {
    analysis: {
      platformRules: {
        sharepoint: false,
        teams: false,
        generic: true,
      },
      meetingThreshold: 0.5, // Lower threshold for unknown platforms
    },
    activation: {
      maxConcurrentFeatures: 6, // Conservative for unknown platforms
      performanceMode: 'conservative' as const,
    },
  },
} as const;

/**
 * Feature-specific configurations
 */
export const FEATURE_CONFIGS = {
  transcriptionButton: {
    priority: 'high' as const,
    resourceRequirements: {
      memoryUsage: 1024,
      cpuIntensive: false,
      networkAccess: false,
      permissions: [],
    },
    activationConditions: {
      minMeetingConfidence: 0.7,
      requiredIndicators: ['hasVideo', 'hasAudio'],
      platformCompatibility: ['teams', 'sharepoint'],
      contentTypes: ['meeting.video', 'meeting.audio'],
    },
  },

  progressIndicator: {
    priority: 'medium' as const,
    resourceRequirements: {
      memoryUsage: 2048,
      cpuIntensive: false,
      networkAccess: true,
      permissions: [],
    },
    activationConditions: {
      minMeetingConfidence: 0.8,
      requiredIndicators: ['hasVideo'],
      platformCompatibility: ['teams', 'sharepoint'],
      contentTypes: ['meeting.video'],
    },
  },

  statusPanel: {
    priority: 'low' as const,
    resourceRequirements: {
      memoryUsage: 4096,
      cpuIntensive: false,
      networkAccess: false,
      permissions: [],
    },
    activationConditions: {
      minMeetingConfidence: 0.6,
      requiredIndicators: [],
      platformCompatibility: ['teams', 'sharepoint', 'generic'],
      contentTypes: ['meeting.video', 'meeting.audio', 'meeting.recording'],
    },
  },
} as const;

/**
 * Performance configurations by device type
 */
export const PERFORMANCE_CONFIGS = {
  desktop: {
    contentScript: {
      enablePerformanceMonitoring: true,
      featureActivationDelay: 1000,
    },
    analysis: {
      analysisInterval: 2000,
      maxAnalysisTime: 5000,
      cacheResults: true,
    },
    activation: {
      maxConcurrentFeatures: 12,
      performanceMode: 'balanced' as const,
    },
  },

  mobile: {
    contentScript: {
      enablePerformanceMonitoring: false,
      featureActivationDelay: 2000,
    },
    analysis: {
      analysisInterval: 4000,
      maxAnalysisTime: 3000,
      cacheResults: true,
    },
    activation: {
      maxConcurrentFeatures: 6,
      performanceMode: 'conservative' as const,
    },
  },

  lowEnd: {
    contentScript: {
      enablePerformanceMonitoring: false,
      featureActivationDelay: 3000,
    },
    analysis: {
      analysisInterval: 5000,
      maxAnalysisTime: 2000,
      cacheResults: false,
    },
    activation: {
      maxConcurrentFeatures: 4,
      performanceMode: 'conservative' as const,
    },
  },
} as const;

/**
 * Configuration factory functions
 */
export const ConfigFactory = {
  /**
   * Create configuration for specific platform
   */
  forPlatform(platform: keyof typeof PLATFORM_CONFIGS) {
    const platformConfig = PLATFORM_CONFIGS[platform];

    return {
      contentScript: DEFAULT_CONTENT_SCRIPT_CONFIG,
      analysis: { ...DEFAULT_ANALYSIS_CONFIG, ...platformConfig.analysis },
      activation: { ...DEFAULT_ACTIVATION_CONFIG, ...platformConfig.activation },
      compatibility: DEFAULT_COMPATIBILITY_CONFIG,
    };
  },

  /**
   * Create configuration for specific environment
   */
  forEnvironment(env: 'development' | 'production' | 'test') {
    const baseConfig = {
      contentScript: DEFAULT_CONTENT_SCRIPT_CONFIG,
      analysis: DEFAULT_ANALYSIS_CONFIG,
      activation: DEFAULT_ACTIVATION_CONFIG,
      compatibility: DEFAULT_COMPATIBILITY_CONFIG,
    };

    switch (env) {
      case 'development':
        return {
          ...baseConfig,
          contentScript: {
            ...baseConfig.contentScript,
            enableDebugLogging: true,
            featureActivationDelay: 500,
          },
          analysis: {
            ...baseConfig.analysis,
            analysisInterval: 1000,
            performance: {
              ...baseConfig.analysis.performance,
              throttleUpdates: false,
            },
          },
          activation: {
            ...baseConfig.activation,
            updateStrategy: 'immediate' as const,
            enableDebugLogging: true,
          },
          compatibility: {
            ...baseConfig.compatibility,
            enableFeatureLogging: true,
          },
        };

      case 'production':
        return {
          ...baseConfig,
          contentScript: {
            ...baseConfig.contentScript,
            enableDebugLogging: false,
            enableErrorReporting: true,
          },
          activation: {
            ...baseConfig.activation,
            performanceMode: 'balanced' as const,
            enableDebugLogging: false,
          },
        };

      case 'test':
        return {
          ...baseConfig,
          contentScript: {
            ...baseConfig.contentScript,
            autoInitialize: false,
            enablePerformanceMonitoring: false,
          },
          analysis: {
            ...baseConfig.analysis,
            enableRealTimeMonitoring: false,
          },
          activation: {
            ...baseConfig.activation,
            autoActivation: false,
            enableResourceMonitoring: false,
          },
        };

      default:
        return baseConfig;
    }
  },

  /**
   * Create configuration for device performance level
   */
  forPerformance(level: keyof typeof PERFORMANCE_CONFIGS) {
    const perfConfig = PERFORMANCE_CONFIGS[level];

    return {
      contentScript: { ...DEFAULT_CONTENT_SCRIPT_CONFIG, ...perfConfig.contentScript },
      analysis: { ...DEFAULT_ANALYSIS_CONFIG, ...perfConfig.analysis },
      activation: { ...DEFAULT_ACTIVATION_CONFIG, ...perfConfig.activation },
      compatibility: DEFAULT_COMPATIBILITY_CONFIG,
    };
  },

  /**
   * Create adaptive configuration based on environment
   */
  adaptive() {
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    interface NavigatorWithMemory extends Navigator {
      deviceMemory?: number;
    }
    const isLowEnd =
      navigator.hardwareConcurrency <= 2 ||
      ((navigator as NavigatorWithMemory).deviceMemory && (navigator as NavigatorWithMemory).deviceMemory! <= 2);

    let performanceLevel: keyof typeof PERFORMANCE_CONFIGS = 'desktop';

    if (isLowEnd) {
      performanceLevel = 'lowEnd';
    } else if (isMobile) {
      performanceLevel = 'mobile';
    }

    return this.forPerformance(performanceLevel);
  },
};

/**
 * Get configuration for current environment
 */
export const getCurrentConfig = () => {
  if (isDevelopment) {
    return ConfigFactory.forEnvironment('development');
  } else if (isProduction) {
    return ConfigFactory.forEnvironment('production');
  } else if (isTesting) {
    return ConfigFactory.forEnvironment('test');
  } else {
    return ConfigFactory.adaptive();
  }
};

// Export current configuration as default
export const config = getCurrentConfig();
