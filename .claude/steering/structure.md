# Project Structure - Meeting Summarizer Extension

## Repository Organization

### Monorepo Architecture
The project follows a monorepo structure using Turborepo for efficient build orchestration and package management.

```
extension-ai-meeting-summarizer/
├── chrome-extension/           # Extension manifest and core files
├── pages/                      # Extension pages (popup, options, content)
├── packages/                   # Shared packages and utilities
├── tests/                      # End-to-end and integration tests
├── .claude/                    # Claude AI development context
└── docs/                       # Project documentation
```

## Chrome Extension Structure

### Core Extension Files
```
chrome-extension/
├── manifest.ts                 # Extension manifest configuration
├── public/                     # Static assets
│   ├── icon-128.png           # Extension icons
│   ├── icon-34.png
│   └── content.css            # Injected styles
├── src/
│   └── background/            # Background service worker
│       └── index.ts           # Main background script
├── utils/
│   └── plugins/               # Build-time plugins
│       └── make-manifest-plugin.ts
└── vite.config.mts            # Vite configuration
```

### Extension Pages Structure
```
pages/
├── popup/                      # Extension popup UI
│   ├── src/
│   │   ├── Popup.tsx          # Main popup component
│   │   ├── components/        # Popup-specific components
│   │   └── hooks/             # Popup-specific hooks
│   ├── index.html
│   └── vite.config.mts
├── options/                    # Options/settings page
│   ├── src/
│   │   ├── Options.tsx        # Main options component
│   │   ├── components/        # Settings components
│   │   └── services/          # Azure API configuration
│   ├── index.html
│   └── vite.config.mts
└── content/                    # Content scripts
    ├── src/
    │   ├── matches/           # Page-specific matchers
    │   │   ├── sharepoint/    # SharePoint page handling
    │   │   └── teams/         # Teams page handling
    │   └── services/          # Content script services
    └── build.mts
```

## Package Structure

### Shared Packages
```
packages/
├── shared/                     # Common utilities and types
│   ├── lib/
│   │   ├── types/             # TypeScript type definitions
│   │   ├── utils/             # Utility functions
│   │   └── constants/         # Application constants
│   └── index.mts
├── storage/                    # Storage management
│   ├── lib/
│   │   ├── meeting-storage.ts # Meeting data storage
│   │   ├── config-storage.ts  # Configuration storage
│   │   └── cache-manager.ts   # Transcription cache
│   └── index.mts
├── azure-speech/              # Azure Speech Service integration
│   ├── lib/
│   │   ├── speech-client.ts   # Azure Speech API client
│   │   ├── transcription.ts   # Transcription service
│   │   └── batch-processor.ts # Batch processing
│   └── index.mts
├── meeting-parser/            # Meeting content parsing
│   ├── lib/
│   │   ├── sharepoint-parser.ts # SharePoint URL extraction
│   │   ├── summary-generator.ts # Meeting summarization
│   │   └── action-extractor.ts  # Action item extraction
│   └── index.mts
└── ui/                        # Shared UI components
    ├── lib/
    │   ├── components/        # Reusable components
    │   ├── hooks/             # Custom hooks
    │   └── styles/            # Shared styles
    └── index.ts
```

## File Naming Conventions

### Component Files
```typescript
// React components use PascalCase with .tsx extension
MeetingSummary.tsx
ActionItemList.tsx
TranscriptionProgress.tsx

// Component directory structure
components/
├── MeetingSummary/
│   ├── MeetingSummary.tsx     # Main component
│   ├── MeetingSummary.test.tsx # Component tests
│   ├── MeetingSummary.types.ts # Component types
│   └── index.ts               # Barrel export
```

### Service Files
```typescript
// Services use kebab-case with .ts extension
azure-speech.service.ts
meeting-detection.service.ts
transcription-manager.service.ts

// Service structure
services/
├── azure-speech.service.ts    # External API integration
├── meeting-detection.service.ts # Content detection logic
└── storage.service.ts         # Data persistence
```

### Type Definition Files
```typescript
// Types use kebab-case with .types.ts extension
meeting.types.ts
transcription.types.ts
azure-config.types.ts

// Type organization
types/
├── api/                       # API-related types
│   ├── azure-speech.types.ts
│   └── sharepoint.types.ts
├── domain/                    # Business logic types
│   ├── meeting.types.ts
│   └── transcription.types.ts
└── ui/                        # UI-related types
    └── component.types.ts
```

## Code Organization Patterns

### Feature-Based Structure
```typescript
// Each major feature has its own directory
src/
├── features/
│   ├── transcription/         # Transcription feature
│   │   ├── components/        # Feature-specific components
│   │   ├── services/          # Feature-specific services
│   │   ├── types/             # Feature-specific types
│   │   └── index.ts           # Feature barrel export
│   ├── summarization/         # Summary generation feature
│   └── action-items/          # Action item extraction feature
```

### Service Layer Pattern
```typescript
// Clear separation between UI and business logic
src/
├── presentation/              # UI layer
│   ├── components/
│   ├── hooks/
│   └── pages/
├── application/               # Application services
│   ├── transcription.service.ts
│   ├── meeting-parser.service.ts
│   └── storage.service.ts
├── domain/                    # Business logic
│   ├── entities/
│   ├── value-objects/
│   └── repositories/
└── infrastructure/            # External integrations
    ├── azure/
    ├── chrome-apis/
    └── sharepoint/
```

## Testing Structure

### Test Organization
```
tests/
├── unit/                      # Unit tests
│   ├── services/              # Service layer tests
│   ├── components/            # Component tests
│   └── utils/                 # Utility function tests
├── integration/               # Integration tests
│   ├── azure-speech/          # Azure API integration tests
│   ├── storage/               # Storage integration tests
│   └── extension/             # Extension functionality tests
├── e2e/                       # End-to-end tests
│   ├── specs/                 # Test specifications
│   ├── fixtures/              # Test data and fixtures
│   └── utils/                 # Test utilities
└── mocks/                     # Mock implementations
    ├── azure-responses/       # Mocked Azure API responses
    └── chrome-apis/           # Mocked Chrome APIs
```

### Test File Naming
```typescript
// Test files follow same name as source with .test.ts/.spec.ts
src/services/transcription.service.ts
tests/unit/services/transcription.service.test.ts

// E2E tests use descriptive names
tests/e2e/specs/meeting-transcription-workflow.spec.ts
tests/e2e/specs/sharepoint-integration.spec.ts
```

## Configuration Files

### Root Level Configuration
```
├── package.json               # Root package configuration
├── turbo.json                 # Turborepo configuration
├── tsconfig.json              # Base TypeScript config
├── eslint.config.ts           # ESLint configuration
├── .prettierrc                # Prettier configuration
├── tailwind.config.ts         # Tailwind CSS configuration
└── vite.config.mts            # Base Vite configuration
```

### Package-Specific Configuration
```
packages/shared/
├── package.json               # Package dependencies
├── tsconfig.json              # Package-specific TS config
└── vite.config.mts            # Package build configuration

pages/popup/
├── package.json
├── tsconfig.json
├── vite.config.mts            # Popup-specific Vite config
└── tailwind.config.ts         # Popup-specific Tailwind config
```

## Build and Development Structure

### Build Outputs
```
dist/                          # Build output directory
├── chrome/                    # Chrome extension build
│   ├── manifest.json
│   ├── popup/
│   ├── options/
│   ├── content/
│   └── background.js
├── firefox/                   # Firefox extension build
│   ├── manifest.json          # Firefox-specific manifest
│   └── [same structure as chrome]
└── edge/                      # Edge extension build
    └── [same structure as chrome]
```

### Development Scripts
```json
{
  "scripts": {
    "dev": "turbo watch dev --env CLI_CEB_DEV=true",
    "build": "turbo build",
    "build:chrome": "turbo build --env CLI_CEB_CHROME=true",
    "build:firefox": "turbo build --env CLI_CEB_FIREFOX=true",
    "build:edge": "turbo build --env CLI_CEB_EDGE=true",
    "test": "turbo test --continue",
    "lint": "turbo lint --continue",
    "type-check": "turbo type-check"
  }
}
```

## Import Path Conventions

### Absolute Imports
```typescript
// Use absolute imports from package roots
import { TranscriptionService } from '@extension/azure-speech';
import { MeetingStorage } from '@extension/storage';
import { MeetingSummary } from '@extension/ui';
```

### Relative Imports
```typescript
// Use relative imports within same package
import { parseTranscriptionResult } from './transcription-parser';
import { ActionItem } from '../types/meeting.types';
import { Button } from '../../components/Button';
```

### Barrel Exports
```typescript
// Each package/feature exports through index.ts
// packages/azure-speech/index.mts
export { TranscriptionService } from './lib/transcription-service';
export { SpeechClient } from './lib/speech-client';
export type { TranscriptionResult, SpeechConfig } from './lib/types';
```

## Documentation Structure

### Code Documentation
```typescript
/**
 * Transcribes audio from SharePoint URL using Azure Speech API
 * 
 * @param audioUrl - Direct URL to SharePoint audio/video file
 * @param config - Azure Speech configuration
 * @returns Promise resolving to transcription result
 * 
 * @example
 * ```typescript
 * const result = await transcribeFromUrl(
 *   'https://company.sharepoint.com/audio.mp4',
 *   { language: 'en-US', outputFormat: 'detailed' }
 * );
 * ```
 */
async function transcribeFromUrl(
  audioUrl: string, 
  config: SpeechConfig
): Promise<TranscriptionResult> {
  // Implementation
}
```

### README Structure
```
packages/[package-name]/
├── README.md                  # Package documentation
│   ├── Installation
│   ├── Usage Examples
│   ├── API Reference
│   └── Contributing
└── docs/                      # Detailed documentation
    ├── api.md                 # API documentation
    ├── examples.md            # Usage examples
    └── architecture.md        # Technical architecture
```

## Version Control Structure

### Branch Organization
```
main                           # Production-ready code
├── develop                    # Development integration branch
├── feature/transcription-ui   # Feature branches
├── feature/azure-integration
├── bugfix/memory-leak
└── release/v1.0.0            # Release preparation branches
```

### Commit Message Convention
```
feat(azure): add batch transcription support
fix(popup): resolve memory leak in transcription display
docs(readme): update installation instructions
test(e2e): add SharePoint integration tests
refactor(storage): improve cache management efficiency
```