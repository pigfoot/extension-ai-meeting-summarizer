/**
 * Foundation Layer Validation Tests
 * 
 * Comprehensive test suite to validate the foundation layer implementation
 * including type system integration, storage schema validation, manifest
 * generation, and cross-browser compatibility.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Import foundation layer components
import {
  MeetingRecord,
  MeetingParticipant,
  TranscriptionResult,
  MeetingSummary,
  ActionItem,
  AzureSpeechConfig,
  ExtensionStorageSchema,
  UserPreferences,
} from '@extension/shared/lib/types';

import {
  validateMeetingRecord,
  validateCachedTranscription,
  createMeetingStorage,
  createSecureAzureConfigStorage,
  createUserPreferencesStorage,
  validateAzureConfig,
  encryptionUtils,
  TranscriptionLRUCache,
  cacheUtils,
} from '@extension/storage';

import {
  MeetingCore,
  MeetingUtils,
  MeetingLogger,
  MEETING_CONSTANTS,
} from '@extension/meeting-core';

import {
  browserDetectUtils,
  getBrowserManifestAdjustments,
  checkBrowserCompatibility,
} from '../chrome-extension/utils/browser-detect';

describe('Foundation Layer - Type System Integration', () => {
  it('should export all required meeting types', () => {
    // Test that all essential types are available
    expect(typeof MeetingRecord).toBe('undefined'); // Type, not runtime value
    
    // Test type availability through usage
    const mockMeeting: Partial<MeetingRecord> = {
      id: 'test-meeting-123',
      title: 'Test Meeting',
      status: 'completed',
      source: 'sharepoint',
    };
    
    expect(mockMeeting.id).toBe('test-meeting-123');
    expect(mockMeeting.status).toBe('completed');
  });

  it('should validate meeting record structure', () => {
    const validMeeting: Partial<MeetingRecord> = {
      id: 'meeting-123',
      title: 'Foundation Layer Test Meeting',
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 3600000).toISOString(),
      status: 'completed',
      source: 'sharepoint',
      participants: [
        {
          id: 'user-1',
          name: 'John Doe',
          email: 'john@example.com',
          role: 'organizer',
          attended: true,
        } as MeetingParticipant,
      ],
      organizer: {
        id: 'user-1',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'organizer',
      } as MeetingParticipant,
      metadata: {
        duration: 60,
        language: 'en-US',
        tags: ['foundation', 'test'],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const validation = validateMeetingRecord(validMeeting);
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should validate Azure Speech configuration', () => {
    const validConfig: Partial<AzureSpeechConfig> = {
      subscriptionKey: 'a'.repeat(32), // 32 character key
      serviceRegion: 'eastus',
      language: 'en-US',
      recognitionMode: 'Conversation',
      outputFormat: 'detailed',
      enableSpeakerDiarization: true,
      maxSpeakers: 5,
      enableWordTimestamps: true,
      profanityOption: 'Masked',
      enablePhraseHints: false,
      requestTimeout: 30000,
      enableAutomaticPunctuation: true,
    };

    const validation = validateAzureConfig(validConfig);
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should detect invalid meeting records', () => {
    const invalidMeeting = {
      // Missing required fields
      title: '',
      status: 'invalid-status',
    };

    const validation = validateMeetingRecord(invalidMeeting);
    expect(validation.isValid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
    expect(validation.errors).toContain('INVALID_ID');
    expect(validation.errors).toContain('MISSING_TITLE');
    expect(validation.errors).toContain('INVALID_STATUS');
  });
});

describe('Foundation Layer - Storage Schema Validation', () => {
  let meetingStorage: ReturnType<typeof createMeetingStorage>;
  let configStorage: ReturnType<typeof createSecureAzureConfigStorage>;
  let preferencesStorage: ReturnType<typeof createUserPreferencesStorage>;

  beforeEach(() => {
    meetingStorage = createMeetingStorage();
    configStorage = createSecureAzureConfigStorage();
    preferencesStorage = createUserPreferencesStorage();
  });

  it('should create and manage meeting storage', async () => {
    const testMeeting: MeetingRecord = {
      id: 'test-storage-meeting',
      title: 'Storage Test Meeting',
      description: 'Testing storage functionality',
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 3600000).toISOString(),
      status: 'completed',
      source: 'sharepoint',
      participants: [],
      organizer: {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
      } as MeetingParticipant,
      metadata: {
        duration: 60,
        language: 'en-US',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Test storage operations
    await meetingStorage.set({ [testMeeting.id]: testMeeting });
    const stored = await meetingStorage.get();
    
    expect(stored[testMeeting.id]).toBeDefined();
    expect(stored[testMeeting.id].title).toBe(testMeeting.title);
    expect(stored[testMeeting.id].status).toBe('completed');
  });

  it('should handle Azure configuration encryption', async () => {
    const testConfig: AzureSpeechConfig = {
      subscriptionKey: 'test-key-32-characters-long-key',
      serviceRegion: 'eastus',
      language: 'en-US',
      recognitionMode: 'Conversation',
      outputFormat: 'detailed',
      enableSpeakerDiarization: true,
      enableWordTimestamps: true,
      profanityOption: 'Masked',
      enablePhraseHints: false,
      requestTimeout: 30000,
      enableAutomaticPunctuation: true,
    };

    const password = 'test-encryption-password';
    
    // Test encryption
    const encrypted = await encryptionUtils.encrypt(testConfig, password);
    expect(encrypted.encryptedData).toBeDefined();
    expect(encrypted.algorithm).toBe('AES-GCM');
    expect(encrypted.checksum).toBeDefined();

    // Test decryption
    const decrypted = await encryptionUtils.decrypt(encrypted, password);
    expect(decrypted.subscriptionKey).toBe(testConfig.subscriptionKey);
    expect(decrypted.serviceRegion).toBe(testConfig.serviceRegion);
  });

  it('should manage user preferences storage', async () => {
    const testPreferences: UserPreferences = {
      defaultLanguage: 'zh-TW',
      autoStartTranscription: true,
      enableNotifications: true,
      autoSaveTranscriptions: true,
      enableSpeakerDiarization: true,
      transcriptionQuality: 'accurate',
      theme: 'dark',
      maxStorageSize: 1000,
      dataRetentionDays: 30,
      privacySettings: {
        shareAnalytics: false,
        localStorageOnly: true,
        encryptData: true,
        autoDeleteOldData: true,
        confirmDataSharing: true,
      },
      keyboardShortcuts: {
        toggleTranscription: 'Ctrl+Shift+T',
        openSidePanel: 'Ctrl+Shift+S',
        saveMeeting: 'Ctrl+Shift+M',
        quickSummary: 'Ctrl+Shift+Q',
      },
    };

    await preferencesStorage.set(testPreferences);
    const stored = await preferencesStorage.get();
    
    expect(stored.defaultLanguage).toBe('zh-TW');
    expect(stored.transcriptionQuality).toBe('accurate');
    expect(stored.privacySettings.encryptData).toBe(true);
  });
});

describe('Foundation Layer - Cache Management', () => {
  let cache: TranscriptionLRUCache;

  beforeEach(() => {
    cache = new TranscriptionLRUCache({
      maxSize: 1024 * 1024, // 1MB
      maxEntries: 10,
      defaultTTL: 3600000, // 1 hour
    });
  });

  afterEach(() => {
    cache.dispose();
  });

  it('should cache and retrieve transcription results', async () => {
    const cacheKey = 'test-transcription-123';
    const transcriptionData = {
      meetingId: 'meeting-123',
      transcriptionText: 'This is a test transcription for foundation layer validation.',
      cachedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      hitCount: 1,
      dataSize: 1024,
      checksum: 'test-checksum',
    };

    // Cache the data
    const setResult = await cache.set(cacheKey, transcriptionData);
    expect(setResult.success).toBe(true);

    // Retrieve the data
    const getResult = await cache.get(cacheKey);
    expect(getResult.success).toBe(true);
    expect(getResult.data?.transcriptionText).toBe(transcriptionData.transcriptionText);
    expect(getResult.cacheStatus).toBe('hit');
  });

  it('should handle cache eviction and cleanup', async () => {
    // Fill cache to capacity
    for (let i = 0; i < 15; i++) {
      await cache.set(`key-${i}`, {
        meetingId: `meeting-${i}`,
        transcriptionText: `Transcription ${i}`,
        cachedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        hitCount: 1,
        dataSize: 100,
        checksum: `checksum-${i}`,
      });
    }

    const stats = cache.getStatistics();
    expect(stats.totalEntries).toBeLessThanOrEqual(10); // Max entries enforced
  });

  it('should generate appropriate cache keys', () => {
    const cacheKey = cacheUtils.generateTranscriptionCacheKey('meeting-123', {
      language: 'en-US',
      quality: 'high',
      speakerDiarization: true,
    });

    expect(cacheKey).toBe('meeting-123_lang-en-US_quality-high_diarization');
  });
});

describe('Foundation Layer - Cross-Browser Compatibility', () => {
  it('should detect browser capabilities correctly', () => {
    const chromeCapabilities = browserDetectUtils.detectBrowserCapabilities('chrome', '120');
    expect(chromeCapabilities.browser).toBe('chrome');
    expect(chromeCapabilities.supportedAPIs).toContain('sidePanel');
    expect(chromeCapabilities.supportedAPIs).toContain('serviceWorker');

    const firefoxCapabilities = browserDetectUtils.detectBrowserCapabilities('firefox', '120');
    expect(firefoxCapabilities.browser).toBe('firefox');
    expect(firefoxCapabilities.supportedAPIs).not.toContain('sidePanel');
    expect(firefoxCapabilities.limitations).toContain('No sidePanel API support');
  });

  it('should generate appropriate manifest adjustments', () => {
    const chromeAdjustments = getBrowserManifestAdjustments('chrome');
    expect(chromeAdjustments.remove).toHaveLength(0);

    const firefoxAdjustments = getBrowserManifestAdjustments('firefox');
    expect(firefoxAdjustments.remove).toContain('sidePanel');
    expect(firefoxAdjustments.remove).toContain('offscreen');
  });

  it('should validate browser version compatibility', () => {
    const chromeCompat = checkBrowserCompatibility('chrome', '120');
    expect(chromeCompat.compatible).toBe(true);

    const oldChromeCompat = checkBrowserCompatibility('chrome', '100');
    expect(oldChromeCompat.compatible).toBe(false);
    expect(oldChromeCompat.issues).toHaveLength(1);
  });

  it('should filter permissions correctly for each browser', () => {
    const permissions = ['storage', 'scripting', 'sidePanel', 'notifications', 'contextMenus'];
    
    const chromePermissions = browserDetectUtils.filterPermissionsForBrowser('chrome', permissions);
    expect(chromePermissions).toContain('sidePanel');
    expect(chromePermissions).toContain('contextMenus');

    const firefoxPermissions = browserDetectUtils.filterPermissionsForBrowser('firefox', permissions);
    expect(firefoxPermissions).not.toContain('sidePanel');
    expect(firefoxPermissions).toContain('menus'); // Firefox uses 'menus' instead of 'contextMenus'
  });
});

describe('Foundation Layer - Meeting Core Integration', () => {
  beforeEach(async () => {
    await MeetingCore.initialize();
  });

  it('should initialize Meeting Core successfully', async () => {
    const health = MeetingCore.getHealthStatus();
    expect(health.healthy).toBe(true);
    expect(health.version).toBeDefined();
    expect(health.dependencies).toContain('@extension/shared');
    expect(health.dependencies).toContain('@extension/storage');
  });

  it('should provide meeting utility functions', () => {
    const meetingId = MeetingUtils.generateMeetingId();
    expect(meetingId).toMatch(/^meeting_\d+_[a-z0-9]+$/);

    const isSharePointUrl = MeetingUtils.isMeetingUrl('https://company.sharepoint.com/sites/team/SitePages/meeting.aspx');
    expect(isSharePointUrl).toBe(true);

    const isTeamsUrl = MeetingUtils.isMeetingUrl('https://teams.microsoft.com/l/meetup-join/conversations/123');
    expect(isTeamsUrl).toBe(true);

    const isRegularUrl = MeetingUtils.isMeetingUrl('https://google.com');
    expect(isRegularUrl).toBe(false);
  });

  it('should format meeting duration correctly', () => {
    expect(MeetingUtils.formatDuration(30)).toBe('30m');
    expect(MeetingUtils.formatDuration(90)).toBe('1h 30m');
    expect(MeetingUtils.formatDuration(120)).toBe('2h 0m');
  });

  it('should extract SharePoint site information', () => {
    const url = 'https://company.sharepoint.com/sites/engineering/SitePages/meeting.aspx';
    const siteInfo = MeetingUtils.extractSharePointSiteInfo(url);
    
    expect(siteInfo).not.toBeNull();
    expect(siteInfo?.tenant).toBe('company');
    expect(siteInfo?.site).toBe('engineering');
  });

  it('should validate meeting record completeness', () => {
    const incompleteMeeting = {
      id: 'test-123',
      title: 'Test Meeting',
      // Missing other required fields
    };

    const isValid = MeetingUtils.isValidMeetingRecord(incompleteMeeting);
    expect(isValid).toBe(false);

    const completeMeeting: MeetingRecord = {
      id: 'test-123',
      title: 'Complete Test Meeting',
      startTime: new Date().toISOString(),
      status: 'completed',
      source: 'sharepoint',
      participants: [],
      organizer: {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
      } as MeetingParticipant,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const isCompleteValid = MeetingUtils.isValidMeetingRecord(completeMeeting);
    expect(isCompleteValid).toBe(true);
  });
});

describe('Foundation Layer - Constants and Configuration', () => {
  it('should provide correct meeting constants', () => {
    expect(MEETING_CONSTANTS.DEFAULT_LANGUAGE).toBe('en-US');
    expect(MEETING_CONSTANTS.DEFAULT_TRANSCRIPTION_QUALITY).toBe('balanced');
    expect(MEETING_CONSTANTS.MAX_AUDIO_SIZE).toBe(25 * 1024 * 1024);
    expect(MEETING_CONSTANTS.SHAREPOINT_PATTERNS).toHaveLength(3);
    expect(MEETING_CONSTANTS.TEAMS_PATTERNS).toHaveLength(2);
  });

  it('should provide storage key constants', () => {
    expect(MEETING_CONSTANTS.STORAGE_KEYS.MEETINGS).toBe('meetings');
    expect(MEETING_CONSTANTS.STORAGE_KEYS.AZURE_CONFIG).toBe('azureConfig');
    expect(MEETING_CONSTANTS.STORAGE_KEYS.USER_PREFERENCES).toBe('userPreferences');
  });

  it('should provide cache configuration limits', () => {
    expect(MEETING_CONSTANTS.CACHE_LIMITS.MAX_ENTRIES).toBe(1000);
    expect(MEETING_CONSTANTS.CACHE_LIMITS.MAX_SIZE).toBe(50 * 1024 * 1024);
    expect(MEETING_CONSTANTS.CACHE_LIMITS.DEFAULT_TTL).toBe(24 * 60 * 60 * 1000);
  });
});

describe('Foundation Layer - Error Handling and Logging', () => {
  it('should handle storage errors gracefully', async () => {
    // Test with invalid data
    const invalidConfig = {
      invalidField: 'invalid-value',
    };

    const validation = validateAzureConfig(invalidConfig);
    expect(validation.isValid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  it('should provide meeting logger functionality', () => {
    // Test that logger methods exist and don't throw
    expect(() => {
      MeetingLogger.info('Test info message');
      MeetingLogger.warn('Test warning message');
      MeetingLogger.error('Test error message');
      MeetingLogger.debug('Test debug message');
    }).not.toThrow();
  });

  it('should handle cache errors appropriately', async () => {
    const cache = new TranscriptionLRUCache();
    
    // Test getting non-existent key
    const result = await cache.get('non-existent-key');
    expect(result.success).toBe(false);
    expect(result.cacheStatus).toBe('miss');
    
    cache.dispose();
  });
});

describe('Foundation Layer - Performance and Optimization', () => {
  it('should validate serialization performance', () => {
    const largeMeeting: MeetingRecord = {
      id: 'large-meeting-123',
      title: 'Large Meeting for Performance Test',
      startTime: new Date().toISOString(),
      status: 'completed',
      source: 'sharepoint',
      participants: Array(100).fill(null).map((_, i) => ({
        id: `user-${i}`,
        name: `User ${i}`,
        email: `user${i}@example.com`,
      })) as MeetingParticipant[],
      organizer: {
        id: 'user-0',
        name: 'User 0',
        email: 'user0@example.com',
      } as MeetingParticipant,
      metadata: {
        duration: 120,
        language: 'en-US',
        customProperties: {
          largeData: 'x'.repeat(10000), // 10KB of data
        },
      },
      transcription: {
        id: 'transcription-123',
        meetingId: 'large-meeting-123',
        fullText: 'Large transcription text. '.repeat(1000), // ~30KB
        segments: [],
        confidence: 'high',
        language: 'en-US',
        status: 'completed',
        processedAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const startTime = performance.now();
    const validation = validateMeetingRecord(largeMeeting);
    const endTime = performance.now();

    expect(validation.isValid).toBe(true);
    expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
  });

  it('should handle cache performance under load', async () => {
    const cache = new TranscriptionLRUCache({
      maxSize: 10 * 1024 * 1024, // 10MB
      maxEntries: 1000,
    });

    const operations = [];
    const startTime = performance.now();

    // Perform 100 cache operations
    for (let i = 0; i < 100; i++) {
      operations.push(cache.set(`key-${i}`, {
        meetingId: `meeting-${i}`,
        transcriptionText: `Transcription ${i} `.repeat(100),
        cachedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        hitCount: 1,
        dataSize: 1000,
        checksum: `checksum-${i}`,
      }));
    }

    await Promise.all(operations);
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    
    const stats = cache.getStatistics();
    expect(stats.totalEntries).toBeGreaterThan(0);
    
    cache.dispose();
  });
});