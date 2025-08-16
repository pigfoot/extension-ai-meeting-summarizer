# Implementation Plan

## Task Overview
The Content-to-Transcription Integration implementation connects the fully completed content-detection and azure-speech packages through targeted enhancements to background services. This approach transforms the extension from simulation to real transcription functionality by integrating existing, tested components without duplicating implementation.

## Steering Document Compliance
Tasks follow structure.md conventions by enhancing existing background services rather than creating new packages. Tech.md alignment is maintained through proper integration of existing Azure Speech API and content detection patterns, maintaining secure credential management and proper TypeScript configuration.

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

### Phase 1: MessageRouter Content Detection Integration

- [x] 1. Add content detection import and URL selection in message-router.ts
  - File: chrome-extension/src/background/messaging/message-router.ts
  - Import meeting-detector package and contentDetector service
  - Add selectBestAudioUrl method for choosing optimal quality URLs
  - Purpose: Enable content detection capability in MessageRouter
  - _Leverage: packages/meeting-detector/lib/index.ts existing exports_
  - _Requirements: 1.1, 1.2_

- [x] 2. Replace fake URL creation with real content detection in handleStartAudioCapture
  - File: chrome-extension/src/background/messaging/message-router.ts
  - Replace `audioUrl: msg.audioUrl || 'system://audio-capture'` with content detection call
  - Add error handling for cases where no URLs are detected
  - Add metadata extraction from content detection results
  - Purpose: Use real SharePoint URLs instead of fake placeholder URLs
  - _Leverage: packages/meeting-detector/lib/extraction/media-url-scanner.ts_
  - _Requirements: 1.1, 1.3_

- [x] 3. Add content detection error handling and user feedback in message-router.ts
  - File: chrome-extension/src/background/messaging/message-router.ts
  - Implement specific error messages for different content detection failure scenarios
  - Add recovery suggestions for common issues (no URLs found, access denied, etc.)
  - Add fallback behavior when content detection fails
  - Purpose: Provide clear feedback when content detection encounters issues
  - _Leverage: packages/meeting-detector/lib/validation/permission-checker.ts error patterns_
  - _Requirements: 1.4, 5.5_

### Phase 2: JobCoordinator Azure Speech Integration

- [x] 4. Add Azure Speech service initialization in job-coordinator.ts
  - File: chrome-extension/src/background/jobs/job-coordinator.ts
  - Import AzureSpeechService from azure-speech package
  - Add azureSpeechService property and initialization method
  - Add configuration validation before initializing Azure service
  - Purpose: Enable real Azure Speech API integration in JobCoordinator
  - _Leverage: packages/azure-speech/lib/index.ts AzureSpeechService_
  - _Requirements: 2.1, 2.2_

- [x] 5. Replace executeAzureTranscription simulation with real Azure Speech API calls
  - File: chrome-extension/src/background/jobs/job-coordinator.ts
  - Replace simulation logic with actual Azure Speech service.startTranscription call
  - Remove mock result generation and use real Azure Speech API responses
  - Add real Azure job ID tracking and status monitoring
  - Purpose: Use actual Azure Speech API instead of simulation
  - _Leverage: packages/azure-speech/lib/batch/batch-transcription-service.ts_
  - _Requirements: 2.2, 2.4_

- [x] 6. Implement real Azure progress monitoring in job-coordinator.ts
  - File: chrome-extension/src/background/jobs/job-coordinator.ts
  - Add monitorAzureTranscription method with real Azure status polling
  - Replace simulation progress stages with actual Azure Speech API stages
  - Add updateProgressFromAzureStatus method for real progress mapping
  - Purpose: Provide real transcription progress instead of simulated stages
  - _Leverage: packages/azure-speech/lib/batch/progress-monitor.ts_
  - _Requirements: 2.3, 4.2_

- [x] 7. Add Azure Speech error handling and recovery in job-coordinator.ts
  - File: chrome-extension/src/background/jobs/job-coordinator.ts
  - Implement Azure-specific error handling for authentication, quota, and network failures
  - Add integration with existing Azure Speech error recovery service
  - Add timeout handling for long-running Azure transcription jobs
  - Purpose: Handle Azure Speech API errors gracefully with proper recovery
  - _Leverage: packages/azure-speech/lib/errors/recovery-service.ts_
  - _Requirements: 2.5, 5.1, 5.2_

### Phase 3: Background Service Configuration Integration

- [x] 8. Add Azure configuration loading in background-main.ts
  - File: chrome-extension/src/background/services/background-main.ts
  - Add loadAzureConfiguration method to retrieve stored Azure credentials
  - Add Azure service initialization to existing service initialization flow
  - Add configuration validation and error handling for missing credentials
  - Purpose: Load and validate Azure Speech configuration during service initialization
  - _Leverage: packages/storage/lib/schemas/config.ts Azure configuration schema_
  - _Requirements: 3.4, 5.1_

- [x] 9. Initialize content detection service in background-main.ts
  - File: chrome-extension/src/background/services/background-main.ts
  - Import and initialize contentDetector from meeting-detector package
  - Add content detector initialization to service startup sequence
  - Add error handling for content detection initialization failures
  - Purpose: Ensure content detection service is available for MessageRouter
  - _Leverage: packages/meeting-detector/lib/index.ts contentDetector export_
  - _Requirements: 3.1, 3.2_

- [x] 10. Update service health monitoring in background-main.ts
  - File: chrome-extension/src/background/services/background-main.ts
  - Add health checks for both content detection and Azure Speech services
  - Update getHealthStatus method to include content detection and Azure Speech status
  - Add service dependency validation (Azure credentials required for transcription)
  - Purpose: Monitor health of integrated content detection and transcription services
  - _Leverage: existing health monitoring patterns in BackgroundMain_
  - _Requirements: 3.3, 5.3_

### Phase 4: Progress and Error Display Integration

- [x] 11. Update progress stage mapping for real Azure Speech stages in job-coordinator.ts
  - File: chrome-extension/src/background/jobs/job-coordinator.ts
  - Replace simulation progress stages with actual Azure Speech API stage names
  - Add stage duration estimates based on real Azure Speech processing times
  - Add Azure job ID display in progress metadata for debugging
  - Purpose: Show users actual Azure Speech processing stages instead of simulation
  - _Leverage: packages/azure-speech/lib/batch/job-manager.ts stage definitions_
  - _Requirements: 4.1, 4.2_

- [x] 12. Add content detection phase to progress tracking in message-router.ts
  - File: chrome-extension/src/background/messaging/message-router.ts
  - Add progress updates during content detection phase
  - Add estimated time for content detection and URL extraction
  - Add content detection confidence score to job metadata
  - Purpose: Show users that content detection is occurring before transcription
  - _Leverage: packages/meeting-detector/lib/utils/confidence-calculator.ts_
  - _Requirements: 4.3, 4.4_

- [ ] 13. Enhance error messages with integration-specific guidance in message-router.ts
  - File: chrome-extension/src/background/messaging/message-router.ts
  - Add specific error messages that distinguish between content detection and transcription failures
  - Add recovery suggestions that account for both content detection and Azure Speech issues
  - Add error categorization for integration-specific problems
  - Purpose: Help users understand whether issues are from content detection or transcription
  - _Leverage: packages/azure-speech/lib/errors/error-classifier.ts error categorization_
  - _Requirements: 5.4, 5.5_

### Phase 5: Configuration Validation and Testing

- [ ] 14. Add Azure Speech configuration testing integration in options page
  - File: pages/options/src/components/AzureConfigForm.tsx
  - Import AzureSpeechService for configuration testing
  - Add testAzureConfiguration method that validates credentials with real Azure API
  - Add connection testing that verifies Azure Speech service accessibility
  - Purpose: Allow users to test Azure Speech configuration with real API validation
  - _Leverage: packages/azure-speech/lib/auth/credential-validator.ts_
  - _Requirements: 5.1, 5.3_

- [ ] 15. Add content detection capability validation in background-main.ts
  - File: chrome-extension/src/background/services/background-main.ts
  - Add validateContentDetection method to check meeting-detector package functionality
  - Add startup validation that ensures content detection is working properly
  - Add graceful degradation when content detection is not available
  - Purpose: Ensure content detection service is functional before enabling transcription features
  - _Leverage: packages/meeting-detector/lib/core/detection-coordinator.ts_
  - _Requirements: 3.5, 5.3_

- [ ] 16. Add integration status reporting in background-main.ts
  - File: chrome-extension/src/background/services/background-main.ts
  - Add getIntegrationStatus method that reports on both content detection and Azure Speech status
  - Add integration readiness check that validates both services are configured and functional
  - Add status messages that help users understand what needs to be configured
  - Purpose: Provide clear status information about the complete integration
  - _Leverage: existing service status reporting patterns_
  - _Requirements: 5.4, 5.5_

## Implementation Status Summary

### 📋 Implementation Plan Overview
- **Total Tasks**: 16 tasks across 5 phases
- **Integration Approach**: Connect existing completed packages (content-detection + azure-speech) through background service enhancements
- **No New Packages**: Leverages 100% completed meeting-detector and azure-speech packages
- **Targeted Changes**: Focuses on 3 key files that currently use simulation

### 🎯 Key Files to Modify
1. **message-router.ts** - Replace fake URL with content detection
2. **job-coordinator.ts** - Replace simulation with real Azure Speech API
3. **background-main.ts** - Initialize and coordinate both services

### 🔗 Integration Architecture
```
content-detection (✅ Complete) 
    ↓ Real SharePoint URLs
message-router.ts (🔄 Enhanced)
    ↓ Real URLs to jobs  
job-coordinator.ts (🔄 Enhanced)
    ↓ Real Azure Speech API calls
azure-speech (✅ Complete)
    ↓ Actual transcription results
```

### ✅ Success Criteria
- **No Simulation**: Complete removal of 'system://audio-capture' fake URLs
- **Real Transcription**: Actual Azure Speech API integration producing real results
- **Seamless UX**: Users see real transcription without understanding integration complexity
- **Proper Errors**: Clear distinction between content detection and transcription failures

This implementation plan transforms the extension from simulation to reality by connecting two fully implemented systems through targeted background service integration.