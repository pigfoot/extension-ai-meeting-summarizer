# Bug Report: Extension Communication Failure

## Bug Summary
Extension shows "Failed to start audio capture: Content detection failed: Could not establish connection. Receiving end does not exist." error on load

## Bug Details

### Expected Behavior
Extension should load normally with:
1. Content script properly injected into web pages
2. Background script and content script communication established
3. Audio capture functionality available for use

### Actual Behavior  
Extension shows error immediately on load:
- Displays "Failed to start audio capture" 
- Specific error: `Content detection failed: Could not establish connection. Receiving end does not exist.`
- Content script fails to establish communication connection

### Steps to Reproduce
1. Start development environment: `pnpm dev:edge`
2. Open Edge browser and navigate to `edge://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select `./dist` directory
5. Observe extension loading behavior

### Environment
- **Version**: 0.0.1 (development build)
- **Platform**: macOS Darwin 24.6.0, Edge browser
- **Configuration**: Development mode with HMR enabled
- **Build System**: Vite 6.3.5, Turborepo 2.5.5, pnpm 10.11.0

## Impact Assessment

### Severity
- [x] High - Major functionality broken

### Affected Users
Development team, unable to test extension functionality

### Affected Features
- Chrome Extension core communication mechanism
- Content script injection and execution
- Audio capture functionality initialization

## Additional Context

### Error Messages
```
Failed to start audio capture: Content detection failed: Could not establish connection. Receiving end does not exist.
```

### Related Background: Previous HMR Content Script Issue

**Important Background**: Previously resolved a similar content script communication issue (`hmr-content-script-incompatibility`) with the following technical root cause:

#### Previous Issue Technical Analysis
1. **HMR System vs Chrome Extension Conflict**:
   - HMR uses dynamic imports: `import('./all.iife_dev.js')`
   - Chrome APIs require synchronous execution: `chrome.runtime.onMessage.addListener()`
   - Caused message listeners to fail timely registration

2. **Previous Solution Implemented**:
   - Implemented Smart HMR system
   - Used inline strategy for content scripts
   - Set `enablePageReload: false` to avoid HMR artifacts

3. **Verification Status**:
   - Previous issue confirmed resolved (2025-08-16)
   - Smart HMR analysis working correctly
   - Production builds clean without HMR artifacts

### Current Issue Analysis

**Possible Causes**:
1. **Configuration Regression**: Smart HMR configuration may have been overridden or reverted
2. **New Environment Issue**: Development environment configuration changes
3. **Different Root Cause**: Although symptoms are similar, may be a different communication issue
4. **Build Artifacts**: Possible stale build artifacts

### Initial Analysis

### Suspected Root Cause
Although symptoms are similar to the previous HMR content script issue, possible causes include:
1. HMR configuration regression to problematic state
2. Build system generating incorrect content script structure
3. Extension manifest or content script injection issues

### Affected Components
Based on previous analysis, potentially affected components:
- `pages/content/build.mts` - Content script build configuration
- `packages/vite-config/lib/with-page-config.ts` - HMR plugin configuration  
- `packages/hmr/lib/plugins/make-entry-point-plugin.ts` - Smart HMR system
- `dist/content/all.iife.js` - Final generated content script
- `dist/manifest.json` - Extension manifest file

---

**Created**: 2025-08-16  
**Reporter**: Development Team  
**Status**: New  
**Priority**: High  
**Related Issues**: Previously resolved `hmr-content-script-incompatibility`