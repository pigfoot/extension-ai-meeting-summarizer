# Requirements Document

## Introduction

The Content-to-Transcription Integration connects the fully implemented Content Detection system with the Azure Speech Integration system, enabling the Meeting Summarizer extension to automatically extract SharePoint URLs and process them through Azure Speech API for transcription. This integration transforms the extension from using simulation to providing real transcription functionality.

## Alignment with Product Vision

This integration directly realizes the product vision by:

- **"Auto-detects Teams meeting recordings on SharePoint pages"** - Utilizes existing content-detection package 
- **"Transcribes audio content using Azure Speech API directly from SharePoint URLs"** - Connects existing azure-speech package
- **"One-Click Transcription: Processes recordings without manual file downloads"** - Implements the complete URL-to-transcription pipeline
- **"Native SharePoint Integration: Direct access to Teams recordings without additional setup"** - Bridges the gap between detection and processing

This integration completes the extension's core functionality by connecting two fully implemented systems.

## Requirements

### Requirement 1: Content Detection Integration

**User Story:** As a user, I want the system to automatically detect SharePoint meeting recordings and pass real URLs to the transcription system, so that actual transcription occurs instead of simulation.

#### Acceptance Criteria

1. WHEN user navigates to a SharePoint page THEN system SHALL use existing meeting-detector package to extract audio URLs
2. WHEN audio URLs are detected THEN system SHALL replace 'system://audio-capture' fake URLs with real SharePoint URLs
3. WHEN multiple recordings are found THEN system SHALL prioritize highest quality URLs for transcription
4. WHEN URL extraction fails THEN system SHALL provide specific error messages and fallback detection methods
5. WHEN authentication tokens are required THEN system SHALL preserve SharePoint authentication for Azure Speech API access

### Requirement 2: Azure Speech Service Connection

**User Story:** As a developer, I want the job processing system to use real Azure Speech API instead of simulation, so that actual transcription results are generated from SharePoint audio content.

#### Acceptance Criteria

1. WHEN JobCoordinator processes a transcription job THEN system SHALL use existing azure-speech package instead of simulation
2. WHEN real audio URLs are provided THEN system SHALL submit jobs to Azure Speech Batch Transcription API
3. WHEN Azure jobs are submitted THEN system SHALL monitor real progress using existing ProgressMonitor and JobManager
4. WHEN transcription completes THEN system SHALL retrieve actual results using existing ResultRetriever
5. WHEN Azure API errors occur THEN system SHALL use existing ErrorRecoveryService for proper error handling

### Requirement 3: Background Service Integration

**User Story:** As a system administrator, I want the background services to coordinate content detection and transcription seamlessly, so that the complete workflow operates without user intervention.

#### Acceptance Criteria

1. WHEN popup triggers "Start Audio Capture" THEN MessageRouter SHALL invoke content detection before creating transcription jobs
2. WHEN content detection completes THEN system SHALL pass detected URLs directly to JobCoordinator with real Azure Speech configuration
3. WHEN jobs are queued THEN system SHALL use real audio URLs instead of 'system://audio-capture' placeholder
4. WHEN background services initialize THEN system SHALL ensure both meeting-detector and azure-speech packages are properly configured
5. WHEN extension starts THEN system SHALL validate that Azure Speech credentials are configured before enabling transcription features

### Requirement 4: Progress Tracking Enhancement

**User Story:** As a user, I want to see real transcription progress with actual Azure Speech API stages, so that I understand what processing is occurring.

#### Acceptance Criteria

1. WHEN transcription begins THEN progress updates SHALL reflect real Azure Speech API stages instead of simulation
2. WHEN progress is displayed THEN system SHALL show actual Azure job IDs and status information
3. WHEN transcription fails THEN error messages SHALL provide real Azure Speech API error information
4. WHEN transcription completes THEN system SHALL display actual confidence scores and speaker diarization results
5. WHEN multiple jobs are running THEN system SHALL track real concurrent Azure Speech API usage

### Requirement 5: Configuration and Error Handling

**User Story:** As a user, I want proper configuration validation and error handling that works with real Azure Speech API, so that issues are clearly communicated and resolved.

#### Acceptance Criteria

1. WHEN extension is first configured THEN system SHALL validate Azure Speech credentials using existing authentication handlers
2. WHEN SharePoint authentication expires THEN system SHALL detect authentication failures and prompt for re-authorization
3. WHEN Azure Speech API quota is exceeded THEN system SHALL display proper quota information and retry schedules using existing rate limiting
4. WHEN network connectivity fails THEN system SHALL use existing retry logic and circuit breaker patterns for recovery
5. WHEN configuration is invalid THEN system SHALL provide specific guidance for Azure Speech API setup using existing validation components

## Integration Architecture

### Existing Components to Connect

#### Content Detection (100% Complete)
- **packages/meeting-detector/lib/extraction/media-url-scanner.ts** - Extract real SharePoint URLs
- **packages/meeting-detector/lib/analyzers/sharepoint-analyzer.ts** - Analyze SharePoint pages
- **packages/meeting-detector/lib/extraction/auth-token-preserver.ts** - Preserve authentication tokens

#### Azure Speech Integration (100% Complete)
- **packages/azure-speech/lib/batch/batch-transcription-service.ts** - Real Azure Speech API integration
- **packages/azure-speech/lib/batch/job-manager.ts** - Job lifecycle management
- **packages/azure-speech/lib/auth/auth-handler.ts** - Azure authentication handling

#### Background Services (Requires Integration)
- **chrome-extension/src/background/messaging/message-router.ts** - Replace simulation with real content detection
- **chrome-extension/src/background/jobs/job-coordinator.ts** - Replace simulation with real Azure Speech API calls

### Integration Points

1. **MessageRouter Enhancement** - Invoke meeting-detector before creating jobs
2. **JobCoordinator Replacement** - Replace executeAzureTranscription simulation with real Azure Speech calls
3. **URL Flow** - content-detection → real URLs → azure-speech → actual transcription results
4. **Error Handling** - Connect content detection errors with Azure Speech error recovery

## Non-Functional Requirements

### Performance
- URL extraction SHALL complete within 3 seconds using existing content-detection performance
- Azure Speech job submission SHALL maintain existing azure-speech performance standards
- Integration overhead SHALL not exceed 5% of existing component performance
- End-to-end transcription SHALL complete within Azure Speech API SLA timeframes

### Security
- SharePoint authentication tokens SHALL be handled using existing auth-token-preserver security
- Azure Speech credentials SHALL use existing secure storage and authentication handlers
- Integration SHALL not introduce new security vulnerabilities beyond existing component risks
- URL validation SHALL use existing url-validator and permission-checker components

### Reliability
- Integration SHALL achieve 99% success rate for valid SharePoint URLs using existing component reliability
- Failed integrations SHALL provide detailed error information from both content detection and Azure Speech systems
- System SHALL gracefully handle cases where content detection finds no URLs or Azure Speech is unavailable
- Integration SHALL maintain existing retry and error recovery capabilities from both systems

### Usability
- Integration SHALL be transparent to users - no additional configuration beyond existing Azure Speech setup
- Error messages SHALL provide actionable guidance combining insights from both content detection and Azure Speech systems
- Progress updates SHALL clearly indicate whether issues are from content detection or transcription phases
- System SHALL automatically detect and resolve common integration issues without user intervention

## Success Criteria

### Technical Success
- ✅ **Real URL Flow**: SharePoint URLs extracted by content-detection flow through to azure-speech
- ✅ **Simulation Replacement**: No more fake 'system://audio-capture' URLs in job processing
- ✅ **Actual Transcription**: Real Azure Speech API results returned to users
- ✅ **Error Integration**: Proper error handling across both content detection and transcription phases

### User Experience Success  
- ✅ **Seamless Operation**: Users see transcription work without understanding the integration complexity
- ✅ **Real Results**: Actual meeting transcriptions with proper speaker diarization and confidence scores
- ✅ **Clear Progress**: Real-time updates showing actual Azure Speech API processing stages
- ✅ **Proper Errors**: Clear error messages when SharePoint URLs are inaccessible or Azure Speech fails

This integration leverages 100% completed content-detection and azure-speech-integration specs to create a fully functional transcription system.