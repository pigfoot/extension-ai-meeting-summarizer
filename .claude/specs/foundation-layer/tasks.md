# Implementation Plan

## Task Overview
The foundation layer implementation extends the existing monorepo structure with meeting-specific enhancements, comprehensive TypeScript types, cross-browser manifest generation, and enhanced storage capabilities. This approach builds upon existing packages/storage, packages/shared, and chrome-extension infrastructure while adding meeting-specific functionality.

## Steering Document Compliance
Tasks follow structure.md conventions by extending existing packages rather than creating parallel systems, using documented kebab-case naming for services and PascalCase for components. Tech.md patterns are maintained by leveraging existing TypeScript 5.9.2 strict configuration, Turborepo 2.5.5 task orchestration, and established build systems.

## Atomic Task Requirements
**Each task must meet these criteria for optimal agent execution:**
- **File Scope**: Touches 1-3 related files maximum
- **Time Boxing**: Completable in 15-30 minutes
- **Single Purpose**: One testable outcome per task
- **Specific Files**: Must specify exact files to create/modify
- **Agent-Friendly**: Clear input/output with minimal context switching

## Task Format Guidelines
- Use checkbox format: `- [ ] Task number. Task description`
- **Specify files**: Always include exact file paths to create/modify
- **Include implementation details** as bullet points
- Reference requirements using: `_Requirements: X.Y, Z.A_`
- Reference existing code to leverage using: `_Leverage: path/to/file.ts, path/to/component.tsx_`
- Focus only on coding tasks (no deployment, user testing, etc.)
- **Avoid broad terms**: No "system", "integration", "complete" in task titles

## Tasks

### Phase 1: Enhanced TypeScript Type System

- [ ] 1. Create meeting domain types in packages/shared/lib/types/meeting.ts
  - File: packages/shared/lib/types/meeting.ts
  - Define MeetingRecord, MeetingMetadata, TranscriptionResult interfaces
  - Include proper JSDoc documentation for all interfaces
  - Purpose: Establish core meeting data structures with strong typing
  - _Leverage: packages/shared/lib/types/index.ts structure_
  - _Requirements: 2.1, 2.2_

- [ ] 2. Create Azure Speech API types in packages/shared/lib/types/azure.ts
  - File: packages/shared/lib/types/azure.ts
  - Define AzureSpeechConfig, SpeechClient, TranscriptionJob interfaces
  - Add API response types for Azure Speech recognition
  - Purpose: Provide type safety for Azure Speech API integration
  - _Leverage: packages/shared/lib/types/index.ts patterns_
  - _Requirements: 2.2_

- [ ] 3. Create extension-specific types in packages/shared/lib/types/extension.ts
  - File: packages/shared/lib/types/extension.ts
  - Define ExtensionStorageSchema, ChromeStorageKeys, MessageTypes
  - Add background service communication types
  - Purpose: Type Chrome Extension specific functionality
  - _Leverage: packages/shared/lib/types/index.ts organization_
  - _Requirements: 2.3_

- [ ] 4. Update shared types index in packages/shared/lib/types/index.ts
  - File: packages/shared/lib/types/index.ts (modify existing)
  - Export all new meeting, azure, and extension types
  - Maintain existing type exports from other modules
  - Purpose: Provide centralized type access across packages
  - _Leverage: existing barrel export pattern_
  - _Requirements: 2.1, 2.2, 2.3_

### Phase 2: Enhanced Storage Foundation

- [ ] 5. Create meeting storage schema in packages/storage/lib/schemas/meeting.ts
  - File: packages/storage/lib/schemas/meeting.ts
  - Define storage schemas for MeetingRecord, transcription cache
  - Add validation functions using existing validation patterns
  - Purpose: Extend storage with meeting-specific data structures
  - _Leverage: packages/storage/lib/schemas structure, packages/storage/lib/base/base.ts_
  - _Requirements: 5.1, 5.2_

- [ ] 6. Create Azure config storage in packages/storage/lib/schemas/config.ts
  - File: packages/storage/lib/schemas/config.ts
  - Define AzureSpeechConfig storage with encryption support
  - Add secure storage helpers for sensitive data
  - Purpose: Provide secure configuration storage for Azure API
  - _Leverage: packages/storage/lib/base/base.ts encryption patterns_
  - _Requirements: 5.2_

- [ ] 7. Create cache management utilities in packages/storage/lib/utils/cache.ts
  - File: packages/storage/lib/utils/cache.ts
  - Implement LRU cache for transcription results
  - Add cache cleanup and size management functions
  - Purpose: Optimize performance with intelligent caching
  - _Leverage: packages/storage/lib/base/base.ts patterns_
  - _Requirements: 5.3_

- [ ] 8. Update storage index in packages/storage/lib/index.ts
  - File: packages/storage/lib/index.ts (modify existing)
  - Export new meeting schemas, config storage, and cache utilities
  - Maintain existing storage exports
  - Purpose: Provide centralized storage access
  - _Leverage: existing barrel export pattern_
  - _Requirements: 5.1, 5.2, 5.3_

### Phase 3: Cross-Browser Manifest System

- [ ] 9. Create manifest configuration types in chrome-extension/src/types/manifest.ts
  - File: chrome-extension/src/types/manifest.ts
  - Define BrowserManifestConfig, BrowserSpecificSettings interfaces
  - Add manifest generation configuration types
  - Purpose: Type manifest generation system for cross-browser support
  - _Leverage: chrome-extension/manifest.ts structure_
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 10. Create browser detection utility in chrome-extension/utils/browser-detect.ts
  - File: chrome-extension/utils/browser-detect.ts
  - Implement browser detection for Chrome, Firefox, Edge
  - Add browser capability detection functions
  - Purpose: Support browser-specific manifest generation
  - _Leverage: chrome-extension/utils patterns_
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 11. Enhance manifest plugin in chrome-extension/utils/plugins/make-manifest-plugin.ts
  - File: chrome-extension/utils/plugins/make-manifest-plugin.ts (modify existing)
  - Add browser-specific manifest generation logic
  - Implement Firefox browser_specific_settings handling
  - Purpose: Generate appropriate manifests for each target browser
  - _Leverage: existing make-manifest-plugin.ts structure_
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 12. Create Firefox-specific manifest template in chrome-extension/templates/firefox-manifest.json
  - File: chrome-extension/templates/firefox-manifest.json
  - Define Firefox-compatible manifest with gecko settings
  - Include browser_specific_settings configuration
  - Purpose: Provide Firefox-specific manifest template
  - _Leverage: chrome-extension/manifest.ts as base_
  - _Requirements: 4.2_

### Phase 4: Enhanced Monorepo Configuration

- [ ] 13. Update Turborepo configuration in turbo.json
  - File: turbo.json (modify existing)
  - Add meeting-specific build tasks and dependencies
  - Configure cache patterns for enhanced development workflow
  - Purpose: Optimize build orchestration for meeting components
  - _Leverage: existing turbo.json structure and cache configuration_
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 14. Update root package.json scripts
  - File: package.json (modify existing)
  - Add meeting-specific development and build scripts
  - Configure cross-browser build commands
  - Purpose: Provide convenient development commands
  - _Leverage: existing script patterns and naming conventions_
  - _Requirements: 1.1, 1.4_

- [ ] 15. Create meeting package configuration in packages/meeting-core/package.json
  - File: packages/meeting-core/package.json
  - Set up new package for meeting-specific utilities
  - Configure dependencies on shared and storage packages
  - Purpose: Establish meeting-specific package structure
  - _Leverage: packages/shared/package.json structure_
  - _Requirements: 1.1_

- [ ] 16. Create meeting package index in packages/meeting-core/lib/index.ts
  - File: packages/meeting-core/lib/index.ts
  - Set up barrel exports for meeting utilities
  - Prepare structure for future meeting components
  - Purpose: Provide centralized meeting functionality access
  - _Leverage: packages/shared/lib/index.ts patterns_
  - _Requirements: 1.1_

### Phase 5: Enhanced Development Workflow

- [ ] 17. Update TypeScript root configuration in tsconfig.json
  - File: tsconfig.json (modify existing)
  - Add path mappings for new meeting packages
  - Ensure strict type checking for meeting types
  - Purpose: Provide IntelliSense and type safety across packages
  - _Leverage: existing tsconfig.json structure and strict settings_
  - _Requirements: 2.4_

- [ ] 18. Create meeting package TypeScript config in packages/meeting-core/tsconfig.json
  - File: packages/meeting-core/tsconfig.json
  - Extend root TypeScript configuration
  - Configure package-specific compilation settings
  - Purpose: Enable TypeScript compilation for meeting package
  - _Leverage: packages/shared/tsconfig.json structure_
  - _Requirements: 2.4_

- [ ] 19. Update HMR configuration in packages/hmr/lib/index.ts
  - File: packages/hmr/lib/index.ts (modify existing)
  - Add meeting package to hot reload monitoring
  - Configure HMR for meeting development workflow
  - Purpose: Enable fast development iteration for meeting features
  - _Leverage: existing HMR package monitoring patterns_
  - _Requirements: 1.4_

- [ ] 20. Create foundation layer validation tests in tests/foundation/foundation.test.ts
  - File: tests/foundation/foundation.test.ts
  - Test type system integration across packages
  - Test storage schema validation and serialization
  - Purpose: Ensure foundation layer reliability and type safety
  - _Leverage: existing test utilities and patterns_
  - _Requirements: 2.1, 2.2, 5.1_