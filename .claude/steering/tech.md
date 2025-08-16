# Technology Stack - Meeting Summarizer Extension

## Core Architecture

### Browser Extension Framework
- **Manifest Version**: Chrome Extension Manifest v3
- **Cross-Browser Support**: Chrome, Edge, Firefox (with platform-specific builds)
- **Architecture Pattern**: Multi-page extension with background service worker

### Frontend Technology Stack
- **Framework**: React 19.1.1
- **Language**: TypeScript 5.9.2
- **Build Tool**: Vite 6.3.5 with Rollup
- **Styling**: Tailwind CSS 3.4.17
- **State Management**: React hooks with Chrome Storage API integration

### Development Environment
- **Monorepo Management**: Turborepo 2.5.5
- **Package Manager**: PNPM 10.11.0
- **Node Version**: >= 22.15.1
- **Hot Module Replacement**: Custom HMR plugin for extension development

## Azure Integration

### Azure Speech Service
- **Primary API**: Azure Cognitive Services Speech SDK
- **Authentication**: API Key-based authentication
- **Processing Mode**: Batch transcription with direct URL input
- **Supported Features**:
  - Speech-to-Text (STT) with high accuracy
  - Multi-language support
  - Real-time and batch processing modes
  - Direct audio URL processing (no local downloads required)

### API Configuration
```typescript
// Azure Speech Configuration
interface AzureSpeechConfig {
  subscriptionKey: string;
  serviceRegion: string;
  endpoint: string;
  language: string;
  outputFormat: 'detailed' | 'simple';
}
```

### Processing Workflow
1. **URL Extraction**: Extract SharePoint video/audio URLs from Teams meeting pages
2. **Direct Processing**: Send URLs directly to Azure Speech API
3. **Batch Transcription**: Use Azure's batch transcription service for large files
4. **Result Processing**: Parse transcription results and generate summaries

## Browser Extension Components

### Background Service Worker
```typescript
// Background script responsibilities
- Azure API communication
- Transcription job management
- Result caching and storage
- Cross-tab communication
- Error handling and retry logic
```

### Content Scripts
```typescript
// Content script responsibilities
- SharePoint/Teams page detection
- Video/audio URL extraction
- DOM manipulation for UI injection
- Page-specific event handling
```

### Popup Interface
```typescript
// Popup UI responsibilities
- Transcription controls
- Progress monitoring
- Quick result preview
- Settings access
```

### Options Page
```typescript
// Options page responsibilities
- Azure API configuration
- Language preferences
- Storage management
- Privacy settings
```

## Data Processing Pipeline

### 1. Content Detection
```typescript
interface MeetingDetection {
  pageType: 'sharepoint' | 'teams';
  meetingId: string;
  audioUrls: string[];
  metadata: {
    title: string;
    date: Date;
    participants: string[];
  };
}
```

### 2. Transcription Processing
```typescript
interface TranscriptionJob {
  jobId: string;
  audioUrl: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: TranscriptionResult;
}

interface TranscriptionResult {
  text: string;
  confidence: number;
  timestamp: Date;
  speakers?: SpeakerInfo[];
  segments: TranscriptionSegment[];
}
```

### 3. Summary Generation
```typescript
interface MeetingSummary {
  summary: string;
  keyPoints: string[];
  actionItems: ActionItem[];
  decisions: string[];
  nextSteps: string[];
}

interface ActionItem {
  task: string;
  assignee?: string;
  deadline?: Date;
  priority: 'high' | 'medium' | 'low';
}
```

## Storage Architecture

### Chrome Storage API Integration
```typescript
// Storage structure
interface StorageSchema {
  meetings: Record<string, MeetingRecord>;
  settings: UserSettings;
  cache: TranscriptionCache;
}

interface MeetingRecord {
  id: string;
  metadata: MeetingMetadata;
  transcription: TranscriptionResult;
  summary: MeetingSummary;
  createdAt: Date;
  updatedAt: Date;
}
```

### Local Storage Strategy
- **Transcription Results**: Stored locally using Chrome Storage API
- **Cache Management**: LRU cache for recent transcriptions
- **Privacy**: No cloud storage of meeting content
- **Sync**: Optional sync across user's browsers (Chrome sync)

## Security Considerations

### API Key Management
```typescript
// Secure storage of Azure credentials
interface SecureConfig {
  encryptedApiKey: string;
  region: string;
  // API key stored in Chrome storage with encryption
}
```

### Privacy Protection
- **Local Processing**: All sensitive data remains local
- **Encrypted Storage**: API keys and settings encrypted at rest
- **No External Logging**: Meeting content never sent to external analytics
- **User Consent**: Clear permissions for SharePoint access

### Content Security Policy
```typescript
// CSP for extension security
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'; connect-src https://*.cognitiveservices.azure.com https://*.speech.microsoft.com"
  }
}
```

## Performance Optimization

### Processing Efficiency
- **Streaming**: Process large audio files in chunks
- **Caching**: Cache transcription results to avoid reprocessing
- **Background Processing**: Non-blocking transcription jobs
- **Progressive Enhancement**: Show partial results as they become available

### Memory Management
```typescript
// Efficient resource management
class TranscriptionManager {
  private jobQueue: Map<string, TranscriptionJob> = new Map();
  private resultCache: LRUCache<string, TranscriptionResult>;
  
  async processAudio(url: string): Promise<TranscriptionResult> {
    // Implement efficient processing pipeline
  }
}
```

## Cross-Browser Compatibility

### Firefox Support
```typescript
// Firefox-specific manifest adjustments
{
  "browser_specific_settings": {
    "gecko": {
      "id": "meeting-summarizer@company.com",
      "strict_min_version": "109.0"
    }
  }
}
```

### Edge Support
- **Chromium-based**: Uses same codebase as Chrome
- **Microsoft Store**: Additional packaging for Edge Add-ons store
- **SharePoint Integration**: Enhanced integration with Microsoft ecosystem

## Development Tools

### Code Quality
- **ESLint**: TypeScript/React linting with custom rules
- **Prettier**: Code formatting with Tailwind plugin
- **TypeScript**: Strict type checking enabled
- **Husky**: Pre-commit hooks for quality gates

### Testing Framework
```typescript
// Testing strategy
- Unit Tests: Jest with React Testing Library
- Integration Tests: WebdriverIO for E2E testing
- API Tests: Mock Azure Speech API responses
- Browser Tests: Cross-browser compatibility testing
```

### Build Pipeline
```typescript
// Build configuration
{
  "scripts": {
    "dev": "turbo watch dev --env CLI_CEB_DEV=true",
    "build": "turbo build --env production",
    "build:firefox": "turbo build --env CLI_CEB_FIREFOX=true",
    "test": "turbo test --continue",
    "lint": "turbo lint --continue"
  }
}
```

## Development Testing Workflow

### Development Environment Setup

#### HMR Development Server
```bash
# Start Edge-specific development environment with HMR
pnpm dev:edge

# Alternative browsers
pnpm dev:chrome     # For Chrome development  
pnpm dev:firefox    # For Firefox development
```

**Features**:
- **Hot Module Replacement**: Real-time code updates without extension reload
- **Source Maps**: Full debugging support with original TypeScript source
- **Live Rebuild**: Automatic manifest and asset updates
- **Multi-browser Support**: Browser-specific builds and configurations

#### Extension Loading Process
```typescript
// Extension development workflow
1. Execute: pnpm dev:edge
2. Navigate to: edge://extensions/
3. Enable: Developer mode toggle
4. Click: "Load unpacked"
5. Select: ./dist directory
6. Verify: Extension loaded successfully
```

### Remote Debugging Configuration

#### Chrome DevTools Protocol Integration
```bash
# Launch Edge with remote debugging enabled
msedge --remote-debugging-port=9222

# Alternative debugging ports
msedge --remote-debugging-port=9223  # Secondary instance
chrome --remote-debugging-port=9222  # Chrome debugging
```

**Debugging Interface**:
- **Local Access**: http://localhost:9222
- **Extension Inspector**: Direct access to Service Worker context
- **Real-time Console**: Live error monitoring and debugging
- **Network Tab**: Azure API request/response inspection

#### Service Worker Debugging
```typescript
// Service Worker debug workflow
1. Access: http://localhost:9222
2. Select: "Service workers" tab
3. Locate: chrome-extension://[extension-id]/service_worker.js
4. Click: "inspect" link
5. Debug: Full DevTools for background script

// Console debugging commands
chrome.runtime.sendMessage({type: 'GET_STATUS'});
chrome.storage.local.get(null, console.log);
```

## HMR (Hot Module Replacement) 限制和已知問題

### 🚨 Critical Issue: Content Script HMR 兼容性問題

**問題摘要**: HMR 系統與需要立即執行的 Content Script 代碼不兼容，導致 Chrome API message listeners 無法及時註冊。

#### 技術根本原因

**HMR 架構衝突**:
```typescript
// HMR 使用動態 import 模式
// main file (all.iife.js):
import('./all.iife_dev.js');  // 異步載入

// 但 Chrome message listeners 必須同步執行:
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 必須在 content script 載入時立即可用
});
```

**問題表現**:
1. **通信失敗**: `Could not establish connection. Receiving end does not exist.`
2. **WebSocket 錯誤**: `WebSocket connection to 'ws://localhost:8081/' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED`
3. **Content Script 未載入**: `window.contentScript` 為 `undefined`

#### 問題發現過程

**Timeline**:
1. **症狀發現**: Background script 向 content script 發送訊息失敗
2. **Remote Debugging 診斷**: 透過 `http://localhost:9222` 檢查 content script 狀態
3. **檔案分析**: 發現 content script 只包含 HMR 代碼，實際邏輯未執行
4. **插件分析**: 確認 `makeEntryPointPlugin` 和 `watchRebuildPlugin` 衝突
5. **根本原因**: HMR 動態 import 與 Chrome API 同步需求不兼容

#### 現行暫時解決方案

**實施狀態**: ✅ **已實施** - 功能恢復正常

**方法**: 選擇性禁用 HMR 插件
```typescript
// pages/content/build.mts
plugins: [/* IS_DEV && makeEntryPointPlugin() */],  // 禁用

// packages/vite-config/lib/with-page-config.ts  
plugins: [react(), /* IS_DEV && watchRebuildPlugin({ refresh: true }) */],  // 禁用

// packages/vite-config/lib/build-content-script.ts
plugins: [/* IS_DEV && makeEntryPointPlugin() */],  // 禁用
```

**影響**:
- ✅ **正面**: Content script 通信恢復正常
- ✅ **正面**: Message listeners 立即可用
- ❌ **負面**: Content script 失去 HMR 支持
- ❌ **負面**: 需要手動重新載入擴展來測試變更

#### 技術債務記錄

**問題根源**:
1. **makeEntryPointPlugin**: 將代碼分離為 `main.js` + `main_dev.js`，使用動態 import
2. **watchRebuildPlugin**: 注入 WebSocket 重載代碼
3. **設計假設**: HMR 系統假設代碼可以異步載入，但 Chrome extension APIs 需要同步執行

**適用場景分析**:
```typescript
// ✅ 適合 HMR 的代碼
- React 組件 (可異步重載)
- UI 樣式 (可動態更新)
- 非關鍵業務邏輯 (延遲載入可接受)

// ❌ 不適合 HMR 的代碼  
- chrome.runtime.onMessage.addListener (必須同步)
- 初始化代碼 (必須立即執行)
- 系統級 API 註冊 (時機敏感)
```

#### 未來解決方案規劃

**技術方向**: 智能條件式 HMR 策略

**Phase 1: 內容檢測機制**
```typescript
// 實現內容分析器
function analyzeCodeForHMRCompatibility(bundleCode: string): HMRCompatibility {
  const hasImmediateExecutionRequirements = /chrome\.runtime\.onMessage\.addListener|chrome\.storage\.onChanged\.addListener/.test(bundleCode);
  
  return {
    isHMRCompatible: !hasImmediateExecutionRequirements,
    requiresImmediateExecution: hasImmediateExecutionRequirements,
    recommendedStrategy: hasImmediateExecutionRequirements ? 'inline' : 'dynamic-import'
  };
}
```

**Phase 2: Smart Entry Point Plugin**
```typescript
// 新插件: makeSmartEntryPointPlugin
export const makeSmartEntryPointPlugin = (): PluginOption => ({
  name: 'smart-entry-point-plugin',
  generateBundle(options, bundle) {
    for (const module of Object.values(bundle)) {
      const compatibility = analyzeCodeForHMRCompatibility(module.code);
      
      if (compatibility.requiresImmediateExecution) {
        // 直接內聯代碼，不使用動態 import
        // 保留可選的頁面重載功能
      } else {
        // 使用現有 HMR 機制
        this.applyStandardHMR(module);
      }
    }
  }
});
```

**Phase 3: 配置選項**
```typescript
// 允許手動覆寫自動檢測
interface HMRConfig {
  autoDetect: boolean;
  forceInline: string[];  // 強制內聯的檔案模式
  forceDynamic: string[]; // 強制動態載入的檔案模式
  enableReload: boolean;  // 是否啟用頁面重載
}
```

#### 開發指南

**Content Script 開發規則**:
1. **立即執行代碼**: 涉及 Chrome APIs 的代碼必須意識到 HMR 限制
2. **分離策略**: 將 UI 邏輯與系統 API 分離
3. **測試方法**: 修改 content script 後手動重新載入擴展

**臨時開發流程**:
```bash
# 1. 修改 content script 代碼
# 2. 重新載入擴展 (edge://extensions/)
# 3. 重新整理目標頁面
# 4. 測試功能
```

**檢測問題的方法**:
```javascript
// 在任何頁面 console 檢查 content script 狀態
console.log("Content script loaded:", window.contentScript);
console.log("Content script ready:", window.contentScript?.isReady());
```

#### 相關檔案和配置

**影響的檔案**:
- `pages/content/build.mts`
- `packages/vite-config/lib/with-page-config.ts`
- `packages/vite-config/lib/build-content-script.ts`
- `packages/hmr/lib/plugins/make-entry-point-plugin.ts`
- `packages/hmr/lib/plugins/watch-rebuild-plugin.ts`

**監控指標**:
- Content script 載入時間
- Message listener 註冊成功率
- WebSocket 連接錯誤頻率
- 開發者體驗滿意度

這個技術債務需要在後續開發週期中優先解決，以恢復完整的 HMR 開發體驗。

### Manual Functionality Testing

#### Core Feature Validation
```typescript
// SharePoint Meeting Detection Test
async function testMeetingDetection() {
  // 1. Navigate to SharePoint meeting recording page
  // 2. Open extension popup
  // 3. Verify meeting content detection
  
  const detection = await chrome.runtime.sendMessage({
    type: 'DETECT_MEETING_CONTENT'
  });
  
  console.log('Detection Result:', detection);
  return detection.audioUrls.length > 0;
}

// Audio Transcription Test  
async function testAudioTranscription() {
  // 1. Ensure Azure Speech API configuration
  // 2. Start audio capture from detected meeting
  // 3. Monitor transcription progress
  
  const transcription = await chrome.runtime.sendMessage({
    type: 'START_TRANSCRIPTION',
    audioUrl: 'detected-sharepoint-url'
  });
  
  console.log('Transcription Job:', transcription);
  return transcription.jobId;
}
```

#### UI Component Testing
```typescript
// Popup Interface Testing
1. Extension Icon Click → Popup loads correctly
2. Meeting Detection Status → Green/Red indicator accuracy  
3. Audio Capture Button → Proper disabled/enabled states
4. Progress Indicators → Real-time Azure job progress
5. Error Messages → User-friendly error presentation

// Options Page Testing  
1. Navigate: chrome-extension://[id]/options.html
2. Azure Configuration → API key validation
3. Language Settings → Transcription language selection
4. Storage Management → Meeting data cleanup
5. Permission Validation → SharePoint access verification
```

### Automated Testing Execution

#### Unit Testing Suite
```bash
# Execute all unit tests
pnpm test:unit

# Test specific packages
pnpm -F @extension/azure-speech test:unit
pnpm -F @extension/meeting-detector test:unit  
pnpm -F @extension/storage test:unit

# Watch mode for development
pnpm test:watch
```

**Coverage Areas**:
- **Azure Speech Integration**: API authentication, transcription jobs, error handling
- **SharePoint Detection**: URL extraction, metadata parsing, access validation
- **Storage Operations**: Chrome Storage API, caching, data integrity
- **UI Components**: React component rendering, user interactions

#### Integration Testing
```bash
# Full integration test suite
pnpm test:integration

# Browser-specific integration
pnpm test:integration --browser=edge
pnpm test:integration --browser=chrome
```

**Test Scenarios**:
- **End-to-End Flow**: SharePoint → Detection → Transcription → Storage
- **Error Recovery**: Network failures, API errors, permission issues
- **Cross-browser Compatibility**: Manifest differences, API variations
- **Performance**: Large file handling, memory usage, response times

#### E2E Testing with WebdriverIO
```bash
# Complete E2E test execution
pnpm e2e:edge
pnpm e2e:chrome  
pnpm e2e:firefox

# All browsers sequential
pnpm e2e:all
```

**Test Coverage**:
```typescript
// E2E test scenarios
describe('Meeting Summarizer E2E', () => {
  it('detects SharePoint meeting content', async () => {
    await browser.url('https://company.sharepoint.com/meeting-recording');
    await extensionPopup.open();
    await expect(meetingDetector).toHaveStatus('detected');
  });
  
  it('transcribes audio with Azure Speech', async () => {
    await extensionPopup.startTranscription(); 
    await expect(transcriptionProgress).toEventuallyComplete();
    await expect(transcriptionResult).toContainText();
  });
  
  it('stores and retrieves meeting summaries', async () => {
    await optionsPage.open();
    await storageManager.verifyMeetingData();
    await expect(meetingList).toHaveLength.greaterThan(0);
  });
});
```

### Code Quality Assurance

#### Lint and Format Validation
```bash
# Check all code quality issues
pnpm ci:lint

# Individual components
pnpm lint                    # All packages lint check
pnpm lint:fix               # Auto-fix formatting issues  
pnpm format:check           # Prettier format validation
pnpm type-check            # TypeScript type validation
```

**Quality Gates**:
- **ESLint Rules**: TypeScript-specific, React hooks, accessibility
- **Prettier Formatting**: Consistent code style, Tailwind CSS ordering
- **Type Safety**: Strict TypeScript compilation, no implicit any
- **Import Standards**: Extensionless imports, consistent path resolution

#### Pre-commit Validation
```typescript
// Husky pre-commit hooks configuration
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx,json}": [
      "prettier --write",
      "eslint --fix"
    ]
  }
}

// Quality validation pipeline
1. Lint staged files → Fix auto-correctable issues
2. Type check → Ensure TypeScript compilation  
3. Unit tests → Verify affected functionality
4. Build validation → Confirm extension compiles
```

### Testing Best Practices

#### Development Workflow
```typescript
// Recommended testing sequence for new features
1. **Unit Tests First**: Write tests before implementation (TDD)
2. **HMR Development**: Use live reload for rapid iteration
3. **Manual Validation**: Test in actual browser extension context
4. **Integration Testing**: Verify component interactions  
5. **E2E Verification**: Complete user workflow testing
6. **Cross-browser Testing**: Validate on Chrome, Edge, Firefox
```

#### Debugging Strategies
```typescript
// Effective debugging approaches
1. **Console Logging**: Use ColorfulLogger for structured output
2. **Chrome DevTools**: Leverage remote debugging for Service Worker
3. **Network Inspection**: Monitor Azure API requests/responses
4. **Storage Inspection**: Verify Chrome Storage API operations
5. **Performance Profiling**: Identify memory leaks and bottlenecks
```

#### Test Data Management
```typescript
// Test environment configuration
const testConfig = {
  azure: {
    subscriptionKey: 'test-key-not-real',
    region: 'westus2',
    endpoint: 'https://test.cognitiveservices.azure.com'
  },
  sharepoint: {
    testUrls: [
      'https://test.sharepoint.com/meeting1',
      'https://test.sharepoint.com/meeting2'  
    ],
    mockAudioUrls: [
      'https://test.sharepoint.com/audio1.mp4',
      'https://test.sharepoint.com/audio2.wav'
    ]
  }
};
```

This comprehensive testing workflow ensures reliable development cycles and maintains high code quality standards throughout the extension development process.

## API Integration Details

### Azure Speech SDK Integration - PRODUCTION IMPLEMENTATION

**Implementation Status**: ✅ **100% COMPLETE** - Enterprise-grade Azure Speech API integration

The `packages/azure-speech` package provides comprehensive Azure Speech API integration with:

```typescript
import { AzureSpeechService, BatchTranscriptionService } from '@extension/azure-speech';

// ✅ Real Production Implementation
class AzureSpeechService {
  private batchService: BatchTranscriptionService;
  private authHandler: AuthenticationHandler;
  private jobManager: JobManager;
  private errorRecovery: ErrorRecoveryService;
  
  constructor(config: AzureSpeechConfig) {
    // Initialize all production services
    this.batchService = new BatchTranscriptionService(config);
    this.authHandler = new AuthenticationHandler(config);
    this.jobManager = new JobManager(config);
    this.errorRecovery = new ErrorRecoveryService(config);
  }
  
  async startTranscription(audioUrl: string, config: TranscriptionConfig): Promise<TranscriptionJobResult> {
    // ✅ Real Azure Speech Batch Transcription API
    return await this.batchService.submitBatchJob(audioUrl, config);
  }
  
  async getTranscriptionStatus(azureJobId: string): Promise<TranscriptionStatus> {
    // ✅ Real Azure API status polling with exponential backoff
    return await this.batchService.getJobStatus(azureJobId);
  }
  
  async getTranscriptionResult(job: TranscriptionJob): Promise<TranscriptionResult> {
    // ✅ Real transcription results with speaker diarization
    return await this.batchService.retrieveResults(job);
  }
}
```

#### ✅ Production Features Implemented
- **Enterprise Authentication**: Complete credential validation and token management
- **Batch Transcription**: Real Azure Speech Batch API with job lifecycle management
- **Error Recovery**: Circuit breaker patterns, retry logic, and automatic recovery
- **Multi-language Support**: Comprehensive language detection and mixed-language handling
- **Progress Monitoring**: Real-time Azure job status polling with intelligent intervals
- **Rate Limiting**: API quota management and request throttling

### SharePoint Content Detection - PRODUCTION IMPLEMENTATION

**Implementation Status**: ✅ **100% COMPLETE** - Comprehensive SharePoint meeting detection

The `packages/meeting-detector` package provides production-ready SharePoint analysis with:

```typescript
import { sharePointAnalyzer, mediaUrlScanner, contentDetector } from '@extension/meeting-detector';

// ✅ Real Production Implementation  
class SharePointIntegration {
  async detectMeetingContent(): Promise<MeetingDetectionResult> {
    // ✅ Real SharePoint page analysis
    const pageAnalysis = await sharePointAnalyzer.analyzeSharePointPage(
      window.location.href, 
      document
    );
    
    // ✅ Real media URL extraction
    const audioUrls = mediaUrlScanner.scanPageForMediaUrls(document);
    
    // ✅ Real meeting metadata extraction
    const metadata = sharePointAnalyzer.extractMeetingMetadata(document, window.location.href);
    
    return {
      audioUrls,
      metadata,
      confidence: pageAnalysis.confidence,
      platform: 'sharepoint'
    };
  }
  
  async extractAudioUrls(): Promise<AudioUrlInfo[]> {
    // ✅ Real SharePoint Stream URL extraction
    const urls = mediaUrlScanner.scanPageForMediaUrls(document);
    
    // ✅ Real authentication token preservation
    const authenticatedUrls = await authTokenPreserver.preserveTokens(urls);
    
    // ✅ Real URL validation and format checking
    const validatedUrls = await Promise.all(
      authenticatedUrls.map(url => mediaUrlScanner.validateMediaUrl(url.url))
    );
    
    return validatedUrls.filter(result => result.isValid && result.accessible);
  }
}
```

#### ✅ Production Features Implemented
- **Cross-Tenant Support**: Compatible with SharePoint Online, 2019, 2016, and custom domains
- **Media URL Extraction**: Direct MP4, WAV, MP3 URL extraction from SharePoint Stream pages
- **Authentication Handling**: SharePoint SSO token preservation and access validation
- **Metadata Extraction**: Meeting title, participants, date, duration, and agenda parsing
- **Permission Validation**: Access permission checking and graceful error handling
- **Dynamic Content**: SPA navigation monitoring and real-time content detection

### Integration Architecture - COMPLETE END-TO-END FLOW

```typescript
// ✅ Complete Production Integration
import { contentDetector } from '@extension/meeting-detector';
import { AzureSpeechService } from '@extension/azure-speech';

class ProductionTranscriptionFlow {
  async processSharePointMeeting(): Promise<TranscriptionResult> {
    // Step 1: Real content detection
    const detection = await contentDetector.detectMeetingContent();
    
    if (!detection.audioUrls.length) {
      throw new Error('No meeting recordings found on SharePoint page');
    }
    
    // Step 2: Select best quality URL
    const audioUrl = this.selectBestQualityUrl(detection.audioUrls);
    
    // Step 3: Real Azure Speech transcription
    const azureService = new AzureSpeechService(this.azureConfig);
    const transcriptionJob = await azureService.startTranscription(audioUrl, {
      language: 'en-US',
      enableSpeakerDiarization: true,
      outputFormat: 'detailed'
    });
    
    // Step 4: Monitor real progress
    while (transcriptionJob.status !== 'completed') {
      const status = await azureService.getTranscriptionStatus(transcriptionJob.jobId);
      if (status.status === 'failed') {
        throw new Error(`Transcription failed: ${status.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // Step 5: Retrieve actual results
    return await azureService.getTranscriptionResult(transcriptionJob);
  }
}
```

#### ✅ Production Integration Status
- **Real URLs**: SharePoint Stream URLs → Azure Speech API (no simulation)
- **Real Transcription**: Actual Azure Speech results with speaker diarization
- **Real Progress**: Azure API status polling with actual completion times
- **Real Error Handling**: Production-grade error recovery and user feedback

## Module Import Standards

### Extensionless Imports Policy
The project enforces **Always use Extensionless Imports** as a core development standard to maintain clean, maintainable code and follow modern TypeScript best practices.

#### Project Standard - Two Import Categories

**Category 1: TypeScript Source Files (.ts/.tsx)**
```typescript
// ✅ Correct - Extensionless imports (95% of codebase)
import { MeetingData } from './types/meeting';
import { ColorfulLogger } from '../utils/colorful-logger';
import * as helpers from './utils/helpers';

// ❌ Incorrect - Imports with extensions
import { MeetingData } from './types/meeting.js';
import { ColorfulLogger } from '../utils/colorful-logger.js';
```

**Category 2: Package Entry Points (.mts files)**
```typescript
// ✅ Required - Must use .js extensions (Technical requirement)
export * from './lib/index.js';
export { withSuspense } from './lib/hoc/with-suspense.js';
export * from './lib/utils/helpers.js';

// ❌ Incorrect - Will cause build failures
export * from './lib/index';
export { withSuspense } from './lib/hoc/with-suspense';
```

#### TypeScript Configuration
```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "noEmit": false
  }
}
```

#### Technical Requirements by File Type

| File Type | Extension Required | Reason | Example |
|-----------|-------------------|--------|---------|
| `.ts/.tsx` files | ❌ No | Bundler handles resolution | `from './utils/helper'` |
| `index.mts` files | ✅ Yes | Entry points reference compiled `.js` | `from './lib/index.js'` |
| Node.js runtime scripts | ✅ Yes | Direct Node.js execution | `from './consts.js'` |

#### Complete List of Files Requiring .js Extensions

**Package Entry Points (index.mts files)**:
- `packages/storage/index.mts`
- `packages/shared/index.mts` 
- `packages/i18n/index.mts`
- `packages/azure-speech/index.mts`
- `packages/meeting-core/index.mts`
- `packages/meeting-detector/index.mts`
- `packages/meeting-processor/index.mts`
- All other `index.mts` files

**Node.js Runtime Scripts**:
- `packages/i18n/lib/prepare-build.ts`
- `packages/i18n/lib/set-related-locale-import.ts`

**Technical Explanation**: `index.mts` files serve as package entry points and are compiled to `index.mjs`. They reference files in the `lib/` directory that have already been compiled to `.js` files. TypeScript's ES Module resolution requires explicit `.js` extensions when importing compiled JavaScript files from `.mts` files.

#### Solution Analysis and Results

**Solution 1: tsc-alias Post-Processing (Attempted - Not Used)**
```bash
# Approach: Use tsc-alias to convert extensionless imports to .js extensions
npm install --save-dev tsc-alias

# Configuration attempted
{
  "compilerOptions": {
    "moduleResolution": "node16",
    "module": "ES2022"
  },
  "scripts": {
    "build": "tsc && tsc-alias"
  }
}
```

**Result**: ❌ **Rejected**
- **Complexity**: Required post-processing step for every build
- **Node.js Runtime Issues**: Even with tsc-alias, Node.js runtime still required explicit .js extensions for vite.config.mts execution
- **Maintenance Overhead**: Additional tool to maintain and configure
- **User Decision**: "算了 那還是不要用 tsc-alias 好了" (Let's not use tsc-alias)

**Solution 2: Full Architectural Refactoring (Not Pursued)**
- **Approach**: Separate Node.js and browser code completely
- **Scope**: Too large for current requirements
- **Impact**: Would require major restructuring

**Solution 3: Mixed Mode - Extensionless with Selective .js Extensions (Implemented)**
```typescript
// Final approach: Identify Node.js runtime packages and add .js extensions only where required
```

**Result**: ✅ **Successfully Implemented**
- **Coverage**: ~70-80% of codebase maintains extensionless imports
- **Node.js Compatibility**: Targeted .js extensions for Node.js runtime packages only
- **Build Success**: Complete Edge extension build successful
- **Performance**: No additional build tools required

**Solution 4: Vite Plugin Resolution (Attempted - Limited Success)**
```typescript
// Attempted configuration
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default defineConfig({
  plugins: [
    nodeResolve({
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      preferBuiltins: false
    })
  ]
});
```

**Result**: ⚠️ **Partial Success**
- **Bundler Resolution**: Works for Vite bundling process
- **Node.js Runtime Limitation**: Cannot resolve Node.js runtime requirements (vite.config.mts execution)
- **Scope**: Limited to build-time, not runtime module resolution

#### Final Package Configuration

**Packages with .js Extensions (Node.js Runtime)**
| Package | Reason | ModuleResolution |
|---------|--------|------------------|
| `packages/i18n` | Build scripts executed by Node.js | `node16` |
| `packages/env` | Used by vite.config.mts | `bundler` |
| `packages/shared` | Used by vite.config.mts | `bundler` |
| `packages/dev-utils` | Build utilities | `bundler` |
| `packages/hmr` | Vite plugins | `bundler` |
| `packages/vite-config` | Vite configuration | `bundler` |
| `packages/zipper` | Build scripts | `bundler` |

**Packages with Extensionless Imports (Browser/Bundler Only)**
| Package | ModuleResolution | Use Case |
|---------|------------------|----------|
| `packages/meeting-core` | `bundler` | React components |
| `packages/storage` | `bundler` | Chrome extension APIs |
| `packages/ui` | `bundler` | UI components |
| `packages/tailwind-config` | `bundler` | Styling |
| `chrome-extension` | `bundler` | Extension bundle |

#### Implementation Strategy
- **Hybrid Approach**: Mixed mode supporting both extensionless and .js extensions
- **Build Tool Compatibility**: Leverages Vite's bundler module resolution
- **Selective Application**: .js extensions only for packages used by Node.js runtime
- **TypeScript Compilation**: No post-processing tools (tsc-alias) required
- **Coverage**: 70-80% of project files maintain extensionless imports

#### Benefits
- **Standards Compliance**: Maintains "Always use Extensionless Imports" principle where possible
- **Build Performance**: No additional post-processing steps required
- **Runtime Compatibility**: Resolves Node.js ES module requirements
- **Modern Standards**: Follows current TypeScript/ES module conventions
- **Tool Compatibility**: Works seamlessly with Vite, ESLint, and IDEs

## Third-Party Dependencies

### Core Dependencies
```json
{
  "dependencies": {
    "react": "^19.1.1",
    "react-dom": "^19.1.1",
    "microsoft-cognitiveservices-speech-sdk": "^1.34.0"
  },
  "devDependencies": {
    "typescript": "^5.9.2",
    "vite": "^6.3.5",
    "turbo": "^2.5.5",
    "tailwindcss": "^3.4.17"
  }
}
```

### Constraint Management
- **Bundle Size**: Keep extension under 10MB total
- **Permission Minimization**: Request only necessary browser permissions
- **API Rate Limits**: Implement proper throttling for Azure API calls
- **Memory Usage**: Efficient cleanup of transcription resources

## Package.json Configuration Standards for Browser Extensions

### Problem Root Cause Analysis

During the development of the `@extension/meeting-detector` package, a critical build resolution error occurred:

```
[commonjs--resolver] Failed to resolve entry for package "@extension/meeting-detector". 
The package may have incorrect main/module/exports specified in its package.json.
```

#### Root Cause Investigation

The failure occurred due to **inconsistent package.json configuration patterns** across the monorepo:

**Original Template Style** (i18n, storage, shared, azure-speech):
```json
{
  "types": "index.mts",
  "main": "dist/index.mjs"
}
```

**Developer-Created Style** (meeting-detector, meeting-core):
```json
{
  "types": "dist/index.d.ts",
  "main": "dist/index.js"
}
```

#### Why This Caused Build Failures

1. **Build Order Dependencies**: Packages with `"types": "dist/index.d.ts"` must be built **before** they can be consumed
2. **Missing Dist Directory**: When `meeting-detector/dist/` didn't exist, the bundler couldn't resolve the package entry point
3. **IDE Integration Issues**: TypeScript couldn't provide intellisense until the dist files were generated

### Browser Extension vs. Node.js Package Differences

Based on research from `vite-plugin-web-extension` and `vitesse-webext`, browser extension workspace packages have **fundamentally different requirements** than publishable Node.js packages:

#### Key Differences

| Aspect | Browser Extensions | Node.js Packages |
|--------|-------------------|------------------|
| **Publication** | Never published to npm | Published to npm registry |
| **Bundling** | Always bundled by Vite/Webpack | Used as external dependencies |
| **Development** | Source file access critical for IDE | Dist files acceptable for IDE |
| **Resolution** | Types should point to source | Types can point to dist |

#### Browser Extension Specific Requirements

1. **Workspace-Only Usage**: Extension packages are only used within the monorepo
2. **Vite Bundler Processing**: All code gets bundled into final extension
3. **Development Experience**: IDE should directly access source files for better debugging
4. **Build Independence**: Packages shouldn't require pre-building to be consumable

### Browser Extension Best Practices (from vite-plugin-web-extension Research)

Based on analysis of production browser extension tooling, the **original template configuration is correct**:

#### ✅ Recommended Configuration
```json
{
  "name": "@extension/package-name",
  "type": "module",
  "private": true,
  "sideEffects": false,
  "types": "index.mts",
  "main": "dist/index.mjs",
  "exports": {
    ".": {
      "types": "./dist/index.d.mts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.mjs"
    }
  },
  "files": ["dist/**"]
}
```

#### Why This Configuration Works Better

1. **Development Experience**: `"types": "index.mts"` allows IDE to access source files directly
2. **Build Independence**: Packages work without requiring pre-compilation
3. **Bundler Compatibility**: Vite can resolve and bundle source files efficiently
4. **TypeScript Integration**: Better source-to-source debugging and navigation

### Implementation Requirements

To maintain consistency and prevent future build issues:

#### Configuration Standardization
1. **meeting-detector**: Update to use `"types": "index.mts"`, `"main": "dist/index.mjs"`
2. **meeting-core**: Update to use `"types": "index.mts"`, `"main": "dist/index.mjs"`
3. **All future packages**: Follow original template pattern

#### TypeScript Consistency
```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false
  }
}
```

#### Build Script Alignment
```json
{
  "scripts": {
    "ready": "tsc -b",
    "clean:bundle": "rimraf dist",    
    "type-check": "tsc --noEmit"
  }
}
```

### Expected Benefits

1. **Eliminates Build Order Dependencies**: All packages work without pre-compilation
2. **Improved Developer Experience**: Better IDE integration and source navigation
3. **Consistent Standards**: Unified configuration pattern across all packages
4. **Future-Proofing**: Alignment with browser extension tooling best practices

## New Package Creation Guidelines

### CRITICAL: Complete Checklist for Adding New Packages

When creating new workspace packages, follow this exact checklist to prevent build failures and maintain consistency:

#### 1. Package.json Configuration

**✅ Required Configuration Template:**
```json
{
  "name": "@extension/package-name",
  "version": "0.1.0",
  "description": "chrome extension - package description",
  "type": "module",
  "private": true,
  "sideEffects": false,
  "files": ["dist/**"],
  "types": "index.mts",
  "main": "dist/index.mjs",
  "exports": {
    ".": {
      "types": "./dist/index.d.mts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.mjs"
    },
    "./package.json": "./package.json"
  },
  "scripts": {
    "clean:bundle": "rimraf dist",
    "clean:node_modules": "pnpx rimraf node_modules",
    "clean:turbo": "rimraf .turbo",
    "clean": "pnpm clean:bundle && pnpm clean:node_modules && pnpm clean:turbo",
    "ready": "tsc -b",
    "lint": "eslint .",
    "lint:fix": "pnpm lint --fix",
    "format": "prettier . --write --ignore-path ../../.prettierignore",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    // Add workspace dependencies as needed
  },
  "devDependencies": {
    "@extension/tsconfig": "workspace:*"
    // Add other dev dependencies as needed
  }
}
```

**❌ Common Mistakes to Avoid:**
- ✗ `"types": "dist/index.d.ts"` (should be `"index.mts"`)
- ✗ `"main": "dist/index.js"` (should be `"dist/index.mjs"`)
- ✗ Missing `@extension/tsconfig` in devDependencies
- ✗ Using `"ready": "tsx lib/index.ts"` (should be `"tsc -b"`)

#### 2. TypeScript Configuration (tsconfig.json)

**✅ Required Configuration Template:**
```json
{
  "extends": "@extension/tsconfig/module",
  "compilerOptions": {
    "baseUrl": ".",
    "outDir": "dist"
  },
  "include": ["index.mts", "lib"]
}
```

**❌ Common Mistakes to Avoid:**
- ✗ `"extends": "../tsconfig/base.json"` (use workspace reference)
- ✗ Adding unnecessary `"composite": true` or `"references"`
- ✗ Complex compiler options (use module template)

#### 3. Entry Point File (index.mts)

**✅ Required Entry Point Template:**
```typescript
// Simple export - most packages
export * from './lib/index.js';

// Multiple exports - complex packages
export * from './lib/types/index.js';
export * from './lib/utils/index.js';
export { SpecificFunction } from './lib/specific-module.js';
```

**❌ Critical Import Rule:**
- ✗ `export * from './lib/index';` (missing .js extension)
- ✓ `export * from './lib/index.js';` (required .js extension)

#### 4. Directory Structure

**✅ Required Structure:**
```
packages/your-package/
├── index.mts           # Entry point (required)
├── package.json        # Package configuration
├── tsconfig.json       # TypeScript configuration  
├── lib/                # Source code directory
│   ├── index.ts        # Main export file
│   ├── types/          # Type definitions
│   └── utils/          # Utility functions
└── dist/               # Compiled output (auto-generated)
```

#### 5. Common Dependencies

**Always Include:**
```json
{
  "devDependencies": {
    "@extension/tsconfig": "workspace:*"
  }
}
```

**Frequently Needed:**
```json
{
  "dependencies": {
    "@extension/shared": "workspace:*",
    "@extension/storage": "workspace:*"
  }
}
```

#### 6. Verification Steps

After creating a new package, run these commands to verify:

```bash
# 1. Install dependencies
pnpm install

# 2. Build the package
pnpm exec turbo ready --filter=@extension/your-package

# 3. Verify files are generated
ls packages/your-package/dist/
# Should see: index.d.mts, index.mjs, lib/, tsconfig.tsbuildinfo

# 4. Test full build
pnpm build:edge
```

#### 7. Integration Testing

Add your package to consumers:
```json
{
  "dependencies": {
    "@extension/your-package": "workspace:*"
  }
}
```

Import in TypeScript files:
```typescript
// ✅ Correct usage in other packages
import { YourFunction } from '@extension/your-package';
```

### Special Case: UI Component Packages

**IMPORTANT**: UI packages with React components and Tailwind CSS have different configuration requirements:

#### UI Package Configuration Template:
```json
{
  "name": "@extension/ui",
  "version": "0.5.0",
  "description": "chrome extension - ui components",
  "type": "module",
  "private": true,
  "sideEffects": true,
  "files": ["dist/**"],
  "types": "index.ts",
  "main": "dist/index.js",
  "scripts": {
    "ready": "tsc -b && tsc-alias -p tsconfig.json",
    // ... other scripts
  },
  "devDependencies": {
    "@extension/tsconfig": "workspace:*",
    "tsc-alias": "^1.8.16"
    // ... other dependencies
  }
}
```

#### UI Package tsconfig.json:
```json
{
  "extends": "@extension/tsconfig/base",
  "compilerOptions": {
    "outDir": "dist",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    },
    "noEmit": false,
    "declaration": true
  },
  "include": ["index.ts", "lib", "tailwind.config.ts"]
}
```

#### Key Differences for UI Packages:
- **Entry Point**: `index.ts` (not `index.mts`)
- **Build Output**: `dist/index.js` (not `dist/index.mjs`)
- **TSConfig**: Extends `@extension/tsconfig/base` (not `module`)
- **Path Mapping**: Includes `"@/*": ["./*"]` for internal component imports
- **Build Tool**: Uses `tsc-alias` for path alias resolution
- **Tailwind**: Includes `tailwind.config.ts` in build process

### Troubleshooting Common Issues

**Build Error: "Failed to resolve entry for package"**
- ✗ Check `"main"` points to `"dist/index.mjs"`
- ✗ Check `"types"` points to `"index.mts"`
- ✗ Verify `index.mts` uses `.js` extensions
- ✗ Run `tsc -b` to generate dist files

**TypeScript Error: "File '@extension/tsconfig/module' not found"**
- ✗ Add `"@extension/tsconfig": "workspace:*"` to devDependencies
- ✗ Run `pnpm install`

**Import Resolution Errors**
- ✗ Verify extensionless imports in `.ts` files
- ✗ Verify `.js` extensions in `index.mts` files

## Build System Issues and Resolutions

### Critical Module Resolution Problems (Resolved)

During development and testing phases, several critical build system issues were encountered and successfully resolved:

#### Problem 1: Workspace Package Externalization Error

**Issue**: Vite configuration incorrectly externalized workspace packages instead of bundling them
```typescript
// ❌ Problematic configuration in chrome-extension/vite.config.mts
rollupOptions: {
  external: ['chrome', '@extension/meeting-detector', '@extension/azure-speech'],
}
```

**Symptoms**:
- Runtime error: `Uncaught TypeError: Failed to resolve module specifier "@extension/azure-speech"`
- Extension Service Worker crashes on startup
- Module imports failing in browser context despite successful build

**Root Cause**: Chrome extensions run in a sandboxed environment that cannot resolve workspace package specifiers at runtime. Workspace packages must be bundled, not externalized.

**Solution**: Remove workspace packages from external configuration
```typescript
// ✅ Corrected configuration
rollupOptions: {
  external: ['chrome'], // Only externalize browser APIs
}
```

#### Problem 2: Turbo Task Configuration Warnings

**Issue**: Turbo configuration warnings for chrome-extension build tasks
```
WARNING no output files found for task chrome-extension#ready
```

**Root Cause**: Generic task configuration didn't match chrome-extension's specific build outputs

**Solution**: Add chrome-extension specific task configuration in turbo.json
```json
{
  "chrome-extension#ready": {
    "dependsOn": ["^ready"],  
    "outputs": ["manifest.js", "*.tsbuildinfo"],
    "cache": true,
    "inputs": ["manifest.ts", "pre-build.tsconfig.json"]
  }
}
```

#### Problem 3: Package Export Path Mismatches

**Issue**: Package export configurations didn't match actual build output structure

**Symptoms**:
- TypeScript compilation errors during build
- Module not found errors in bundler
- Inconsistent path resolution

**Solution**: Align package.json exports with actual build output
```json
{
  "types": "dist/index.d.ts",
  "main": "dist/index.js",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  }
}
```

### Build Process Validation

#### Successful Resolution Verification

**Testing Process**:
1. **Lint Resolution**: Fixed 293+ ESLint errors across all packages
2. **HMR Testing**: Successfully built 77 modules (937.42 kB background.js)
3. **CDP Remote Debugging**: Verified Service Worker operation with Microsoft Edge
4. **Runtime Verification**: Confirmed all modules load correctly in browser context

**Final Status**:
- ✅ All lint errors resolved
- ✅ HMR build successful with proper module bundling
- ✅ Service Worker operational without runtime errors
- ✅ Chrome DevTools Protocol debugging functional

#### Key Insights

1. **Workspace Dependencies**: Must be bundled for Chrome extension environment
2. **Externalization Scope**: Only externalize browser APIs (`chrome`), never workspace packages
3. **Build Tool Configuration**: Turbo task configurations must match actual package output patterns
4. **Module Resolution**: Extension runtime cannot resolve workspace specifiers without bundling

#### Prevention Measures

**Build Configuration Validation**:
```typescript
// Recommended Vite configuration for Chrome extensions with workspace packages
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['chrome'], // Only browser APIs
      // Never externalize: '@extension/*' packages
    },
  },
});
```

**Package Configuration Standards**:
- Ensure `exports` paths match actual `dist/` structure
- Use consistent `types` and `main` field declarations
- Test package resolution with `pnpm exec tsc` before build

**Turbo Task Specificity**:
- Define package-specific tasks for non-standard build outputs
- Match `outputs` arrays with actual file generation patterns
- Use `inputs` filtering to improve cache efficiency

This resolution establishes a stable foundation for the Chrome extension build system with proper workspace package integration.