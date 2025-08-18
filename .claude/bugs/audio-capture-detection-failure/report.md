# Bug Report

## Bug Summary
Extension popup fails to start audio capture with error "No meeting recordings detected on current page" when attempting to capture meeting audio from SharePoint pages.

## Bug Details

### Expected Behavior
When clicking the "start audio capture" button in the extension popup on a SharePoint page containing meeting recordings, the system should:
1. Detect meeting recordings on the current page
2. Extract audio URLs from SharePoint Stream/Teams recordings
3. Begin audio transcription process using Azure Speech API
4. Show progress indicators for transcription job

### Actual Behavior  
When clicking the "start audio capture" button in the extension popup, the system displays error message: `Failed to start audio capture: No meeting recordings detected on current page`

### Steps to Reproduce
1. Navigate to a SharePoint page containing Teams meeting recordings
2. Open the extension popup by clicking the extension icon
3. Click the "start audio capture" button
4. Observe the error message: "Failed to start audio capture: No meeting recordings detected on current page"

### Environment
- **Version**: [Current development version - needs to be verified]
- **Platform**: macOS (Darwin 24.6.0), Microsoft Edge browser
- **Configuration**: Extension v3 with Azure Speech API integration, development mode with HMR enabled

## Impact Assessment

### Severity
- [x] High - Major functionality broken
- [ ] Critical - System unusable
- [ ] Medium - Feature impaired but workaround exists
- [ ] Low - Minor issue or cosmetic

### Affected Users
- Development team testing the extension
- Users attempting to transcribe SharePoint-hosted Teams meeting recordings
- Corporate users relying on meeting transcription for productivity

### Affected Features
- Core meeting detection functionality in SharePoint pages
- Audio URL extraction from Teams/Stream recordings
- Content script communication with background script
- Extension popup "start audio capture" workflow

## Additional Context

### Error Messages
```
Failed to start audio capture: No meeting recordings detected on current page
```

### Actual Response from Background Script
```json
{
  "success": false,
  "error": "No meeting recordings detected on current page",
  "errorType": "content_detection",
  "message": "No meeting recordings found. Please navigate to a SharePoint page with recorded meetings.",
  "recovery": [
    "Ensure you are on a SharePoint page with meeting recordings",
    "Check that the meeting has recorded content available",
    "Verify you have permission to access the meeting recordings",
    "Try navigating to a different meeting page"
  ],
  "details": {
    "type": "content_detection",
    "error": "No meeting recordings detected on current page",
    "recovery": [
      "Ensure you are on a SharePoint page with meeting recordings",
      "Check that the meeting has recorded content available", 
      "Verify you have permission to access the meeting recordings",
      "Try navigating to a different meeting page"
    ],
    "userMessage": "No meeting recordings found. Please navigate to a SharePoint page with recorded meetings."
  }
}
```

### Screenshots/Media
[To be captured during analysis - user should take screenshot of error in popup]

### Related Issues
- Potential connection to HMR compatibility issues with content scripts mentioned in steering documents
- Content script message listener registration problems that may affect SharePoint page detection
- SharePoint/Teams URL pattern recognition issues

## Initial Analysis

### Suspected Root Cause
Based on the steering documents, this may be related to:
1. **Content Script Communication Issues**: HMR system conflicts with Chrome API message listeners, potentially preventing content scripts from properly registering SharePoint detection handlers
2. **SharePoint URL Pattern Recognition**: Meeting detector may not be correctly identifying SharePoint pages with Teams recordings
3. **Authentication/Permission Issues**: Extension may lack proper permissions to access SharePoint content or detect embedded media URLs

### Affected Components
- `packages/meeting-detector/` - SharePoint content detection logic
- `pages/content/` - Content script responsible for SharePoint page analysis  
- `pages/popup/` - Extension popup UI and audio capture initiation
- `packages/azure-speech/` - Audio transcription service integration
- Background service worker - Message handling between content script and popup

## Debugging Strategy
- Use remote debugging via Chrome DevTools Protocol (CDP) on port 9222
- Inspect content script loading and message listener registration
- Verify SharePoint page detection logic and URL extraction
- Check extension permissions and SharePoint access
- Validate content-background script communication flow