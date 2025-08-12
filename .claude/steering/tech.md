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

## API Integration Details

### Azure Speech SDK Usage
```typescript
import { SpeechConfig, AudioConfig, SpeechRecognizer } from 'microsoft-cognitiveservices-speech-sdk';

class AzureSpeechService {
  private config: SpeechConfig;
  
  constructor(subscriptionKey: string, region: string) {
    this.config = SpeechConfig.fromSubscription(subscriptionKey, region);
  }
  
  async transcribeFromUrl(audioUrl: string): Promise<TranscriptionResult> {
    // Implement batch transcription with URL input
    // Use --input URL parameter for direct processing
  }
}
```

### SharePoint URL Extraction
```typescript
class SharePointExtractor {
  detectMeetingPage(): boolean {
    // Detect SharePoint meeting pages
    return window.location.hostname.includes('sharepoint.com') ||
           window.location.hostname.includes('teams.microsoft.com');
  }
  
  extractAudioUrls(): string[] {
    // Extract video/audio manifest URLs from SharePoint
    // Parse Teams meeting page structure
  }
}
```

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