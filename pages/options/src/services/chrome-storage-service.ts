/**
 * Chrome Extension Storage Service
 * 
 * Real implementation that uses chrome.storage APIs instead of localStorage
 * to ensure configuration is shared between options page and background script.
 */

import type { AzureSpeechConfig } from '@extension/shared/lib/types/azure';

interface StorageService {
  loadConfig(): Promise<AzureSpeechConfig>;
  saveConfig(config: AzureSpeechConfig): Promise<void>;
  loadPreferences(): Promise<UserPreferences>;
  savePreferences(preferences: UserPreferences): Promise<void>;
  getStorageStats(): Promise<StorageStatistics>;
  cleanupStorage(categories: string[]): Promise<void>;
  exportConfig(): Promise<string>;
  importConfig(config: string): Promise<void>;
}

interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  enableNotifications: boolean;
  autoSave: boolean;
  language: string;
}

interface StorageStatistics {
  totalSize: number;
  availableSpace: number;
  itemCount: number;
  lastCleanup: string;
}

/**
 * Default Azure configuration
 */
const defaultAzureConfig: AzureSpeechConfig = {
  subscriptionKey: '',
  serviceRegion: 'eastus',
  language: 'en-US',
  enableLogging: false,
};

/**
 * Default user preferences
 */
const defaultPreferences: UserPreferences = {
  theme: 'auto',
  enableNotifications: true,
  autoSave: true,
  language: 'en-US',
};

/**
 * Chrome Extension Storage Service Implementation
 */
export class ChromeStorageService implements StorageService {
  private static readonly AZURE_CONFIG_KEY = 'azureSpeechConfig';
  private static readonly USER_PREFERENCES_KEY = 'userPreferences';

  /**
   * Load Azure Speech configuration from chrome.storage.sync
   */
  async loadConfig(): Promise<AzureSpeechConfig> {
    try {
      console.log('[ChromeStorageService] Loading Azure config from chrome.storage.sync...');
      
      const result = await chrome.storage.sync.get([ChromeStorageService.AZURE_CONFIG_KEY]);
      const storedConfig = result[ChromeStorageService.AZURE_CONFIG_KEY];
      
      if (storedConfig) {
        console.log('[ChromeStorageService] Found existing Azure config');
        return { ...defaultAzureConfig, ...storedConfig };
      } else {
        console.log('[ChromeStorageService] No Azure config found, using defaults');
        return defaultAzureConfig;
      }
    } catch (error) {
      console.error('[ChromeStorageService] Error loading Azure config:', error);
      return defaultAzureConfig;
    }
  }

  /**
   * Save Azure Speech configuration to chrome.storage.sync
   */
  async saveConfig(config: AzureSpeechConfig): Promise<void> {
    try {
      console.log('[ChromeStorageService] Saving Azure config to chrome.storage.sync...', config);
      
      await chrome.storage.sync.set({
        [ChromeStorageService.AZURE_CONFIG_KEY]: config
      });
      
      console.log('[ChromeStorageService] Azure config saved successfully');
    } catch (error) {
      console.error('[ChromeStorageService] Error saving Azure config:', error);
      throw error;
    }
  }

  /**
   * Load user preferences from chrome.storage.sync
   */
  async loadPreferences(): Promise<UserPreferences> {
    try {
      const result = await chrome.storage.sync.get([ChromeStorageService.USER_PREFERENCES_KEY]);
      const storedPreferences = result[ChromeStorageService.USER_PREFERENCES_KEY];
      
      if (storedPreferences) {
        return { ...defaultPreferences, ...storedPreferences };
      } else {
        return defaultPreferences;
      }
    } catch (error) {
      console.error('[ChromeStorageService] Error loading preferences:', error);
      return defaultPreferences;
    }
  }

  /**
   * Save user preferences to chrome.storage.sync
   */
  async savePreferences(preferences: UserPreferences): Promise<void> {
    try {
      await chrome.storage.sync.set({
        [ChromeStorageService.USER_PREFERENCES_KEY]: preferences
      });
    } catch (error) {
      console.error('[ChromeStorageService] Error saving preferences:', error);
      throw error;
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<StorageStatistics> {
    try {
      const [syncData, localData] = await Promise.all([
        chrome.storage.sync.get(null),
        chrome.storage.local.get(null)
      ]);

      const syncSize = JSON.stringify(syncData).length;
      const localSize = JSON.stringify(localData).length;
      const totalSize = syncSize + localSize;
      const itemCount = Object.keys(syncData).length + Object.keys(localData).length;

      // Chrome storage.sync has 100KB limit, storage.local has much higher limits
      const availableSpace = Math.max(0, 100 * 1024 - syncSize); // Approximate available sync space

      return {
        totalSize,
        availableSpace,
        itemCount,
        lastCleanup: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[ChromeStorageService] Error getting storage stats:', error);
      return {
        totalSize: 0,
        availableSpace: 100 * 1024,
        itemCount: 0,
        lastCleanup: new Date().toISOString(),
      };
    }
  }

  /**
   * Clean up storage by removing specified categories
   */
  async cleanupStorage(categories: string[]): Promise<void> {
    try {
      console.log('[ChromeStorageService] Cleaning up storage categories:', categories);

      if (categories.includes('errors')) {
        // Remove error reports from local storage
        const localData = await chrome.storage.local.get(null);
        const errorKeys = Object.keys(localData).filter(key => 
          key.startsWith('error_report_') || key.startsWith('error_final_report_')
        );
        
        if (errorKeys.length > 0) {
          await chrome.storage.local.remove(errorKeys);
          console.log(`[ChromeStorageService] Removed ${errorKeys.length} error reports`);
        }
      }

      if (categories.includes('cache')) {
        // Remove cache data from local storage
        const localData = await chrome.storage.local.get(null);
        const cacheKeys = Object.keys(localData).filter(key => 
          key.includes('cache_') || key.includes('temp_')
        );
        
        if (cacheKeys.length > 0) {
          await chrome.storage.local.remove(cacheKeys);
          console.log(`[ChromeStorageService] Removed ${cacheKeys.length} cache items`);
        }
      }

      if (categories.includes('old-jobs')) {
        // Remove old completed jobs
        const localData = await chrome.storage.local.get(['jobs']);
        if (localData.jobs) {
          const jobs = localData.jobs;
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - 7); // Remove jobs older than 7 days

          const cleanedJobs: typeof jobs = {};
          let removedCount = 0;

          Object.entries(jobs).forEach(([jobId, job]: [string, any]) => {
            const jobDate = new Date(job.createdAt || 0);
            if (jobDate > cutoffDate || job.status === 'processing' || job.status === 'initializing') {
              cleanedJobs[jobId] = job;
            } else {
              removedCount++;
            }
          });

          if (removedCount > 0) {
            await chrome.storage.local.set({ jobs: cleanedJobs });
            console.log(`[ChromeStorageService] Removed ${removedCount} old jobs`);
          }
        }
      }

      console.log('[ChromeStorageService] Storage cleanup completed');
    } catch (error) {
      console.error('[ChromeStorageService] Error during storage cleanup:', error);
      throw error;
    }
  }

  /**
   * Export configuration as JSON string
   */
  async exportConfig(): Promise<string> {
    try {
      const [config, preferences] = await Promise.all([
        this.loadConfig(),
        this.loadPreferences()
      ]);

      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        config,
        preferences
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('[ChromeStorageService] Error exporting config:', error);
      throw error;
    }
  }

  /**
   * Import configuration from JSON string
   */
  async importConfig(configString: string): Promise<void> {
    try {
      const data = JSON.parse(configString);
      
      if (data.config) {
        await this.saveConfig(data.config);
      }
      
      if (data.preferences) {
        await this.savePreferences(data.preferences);
      }

      console.log('[ChromeStorageService] Configuration imported successfully');
    } catch (error) {
      console.error('[ChromeStorageService] Error importing config:', error);
      throw error;
    }
  }
}

/**
 * Create and return a Chrome Storage Service instance
 */
export const chromeStorageService = new ChromeStorageService();