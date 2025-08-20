# Remote Debugging Testing Guide

## Overview
This document outlines the process for testing Chrome extensions using Chrome DevTools Protocol (CDP) via remote debugging, particularly useful for debugging content script issues and SharePoint integration.

## Prerequisites
- Chrome/Edge browser with remote debugging enabled
- `websocat` tool for WebSocket communication
- `jq` for JSON processing
- Extension running in development mode

## Setup Remote Debugging

### 1. Start Browser with Remote Debugging
```bash
# For Edge
msedge --remote-debugging-port=9222

# For Chrome  
google-chrome --remote-debugging-port=9222
```

### 2. Verify Remote Debugging Access
```bash
curl -s http://localhost:9222/json | jq '.'
```

## Testing Chrome Extensions

### 1. Find Extension Tab/Service Worker
```bash
# List all tabs and find extension-related ones
curl -s http://localhost:9222/json | jq -r '.[] | select(.url | contains("chrome-extension")) | "\(.id): \(.url) - \(.title)"'

# Find specific extension popup
curl -s http://localhost:9222/json | jq -r '.[] | select(.title | contains("Meeting Summarizer")) | .id'
```

### 2. Open Extension Popup for Testing
```bash
# Create new tab with extension popup (replace EXTENSION_ID)
curl -s -X PUT -H "Content-Type: application/json" \
     -d '{"url": "chrome-extension://EXTENSION_ID/popup/index.html"}' \
     "http://localhost:9222/json/new"
```

### 3. Test Extension Functionality
```bash
# Connect to popup tab (replace TAB_ID)
TAB_ID="your_tab_id_here"

# Check available buttons
echo '{"id":1,"method":"Runtime.evaluate","params":{"expression":"Array.from(document.querySelectorAll(\"button\")).map(b => b.textContent).join(\", \")"}}' | websocat -n1 ws://localhost:9222/devtools/page/$TAB_ID

# Test extension messaging
echo '{"id":2,"method":"Runtime.evaluate","params":{"expression":"(async () => { const response = await chrome.runtime.sendMessage({ type: \"START_AUDIO_CAPTURE\", source: \"system_audio\" }); return JSON.stringify(response, null, 2); })()", "awaitPromise": true}}' | websocat -n1 ws://localhost:9222/devtools/page/$TAB_ID
```

## SharePoint Testing Workflow

### 1. Verify SharePoint Page Detection
```bash
# Find SharePoint tab
SHAREPOINT_TAB=$(curl -s http://localhost:9222/json | jq -r '.[] | select(.url | contains("sharepoint")) | .id')

# Check video elements
echo '{"id":3,"method":"Runtime.evaluate","params":{"expression":"document.querySelectorAll(\"video\").length"}}' | websocat -n1 ws://localhost:9222/devtools/page/$SHAREPOINT_TAB

# Check URL structure  
echo '{"id":4,"method":"Runtime.evaluate","params":{"expression":"window.location.href"}}' | websocat -n1 ws://localhost:9222/devtools/page/$SHAREPOINT_TAB
```

### 2. Test Content Script Injection
```bash
# Check if content script is loaded
echo '{"id":5,"method":"Runtime.evaluate","params":{"expression":"typeof window.meetingSummarizerContentScript !== \"undefined\""}}' | websocat -n1 ws://localhost:9222/devtools/page/$SHAREPOINT_TAB

# Force page reload to re-inject content scripts
echo '{"id":6,"method":"Page.reload"}' | websocat -n1 ws://localhost:9222/devtools/page/$SHAREPOINT_TAB
```

## Common Issues and Solutions

### Extension ID Changes
- **Problem**: Extension ID changes between reloads in development mode
- **Solution**: 
  1. Always query current extension ID before testing
  2. Consider adding fixed `key` field to manifest.json for stable ID
  3. Use dynamic lookup: `curl -s http://localhost:9222/json | jq -r '.[] | select(.url | contains("chrome-extension")) and (.url | contains("popup"))'`

### Multiple Extensions Conflict
- **Problem**: Multiple extensions with similar functionality
- **Solution**:
  1. Filter by specific extension name/title
  2. Disable other extensions during testing
  3. Use unique identifiers in extension popup content

### WebSocket Connection Issues
- **Problem**: JSON parsing errors or connection failures
- **Solution**:
  1. Ensure proper JSON escaping in websocat commands
  2. Use `-n1` flag for single message mode
  3. Verify tab ID is current and valid

### Content Script Communication Failures
- **Problem**: "Receiving end does not exist" errors
- **Solution**:
  1. Verify content script is properly injected
  2. Check manifest.json content script configuration
  3. Reload both extension and target page
  4. Verify messaging listeners are registered

## Testing Checklist

### Pre-Test Setup
- [ ] Remote debugging enabled and accessible
- [ ] Extension loaded in development mode
- [ ] Target SharePoint page loaded
- [ ] Required tools installed (`websocat`, `jq`)

### Extension Testing
- [ ] Extension popup opens correctly
- [ ] All expected buttons/UI elements present
- [ ] Extension messaging works between components
- [ ] No console errors in popup

### SharePoint Integration
- [ ] SharePoint page detected as SharePoint
- [ ] Video/meeting content found on page
- [ ] Content script successfully injected
- [ ] Message listeners properly registered
- [ ] Meeting detection logic executes without errors

### Error Handling
- [ ] Appropriate error messages for missing content
- [ ] Graceful handling of permission issues
- [ ] Recovery suggestions provided to user
- [ ] Detailed error information for debugging

## Automation Scripts

### Manual Extension Reload via Chrome DevTools Protocol

**Primary Development Tool**: Use these commands to reload the extension and refresh SharePoint pages after code changes:

```bash
# Step 1: Find Meeting Summarizer Extension Specifically
EXTENSION_SW_ID=$(curl -s http://localhost:9222/json | jq -r '.[] | select(.type == "service_worker" and (.url | contains("cbheahmbkoiomlngjaddonnefjgpgobj") or .url | contains("background.js"))) | .id' | head -1)

# Step 2: Reload Extension with Error Handling
if [ -n "$EXTENSION_SW_ID" ]; then
    echo "Reloading extension (Service Worker ID: $EXTENSION_SW_ID)..."
    echo '{"id":1,"method":"Runtime.evaluate","params":{"expression":"chrome.runtime.reload()"}}' | websocat -n1 "ws://localhost:9222/devtools/page/$EXTENSION_SW_ID"
    echo "Extension reloaded. Waiting for initialization..."
    sleep 3
else
    echo "❌ Extension service worker not found. Is the extension loaded?"
    exit 1
fi

# Step 3: Find New Service Worker ID After Reload
NEW_SW_ID=$(curl -s http://localhost:9222/json | jq -r '.[] | select(.type == "service_worker" and (.url | contains("cbheahmbkoiomlngjaddonnefjgpgobj") or .url | contains("background.js"))) | .id' | head -1)
echo "New Service Worker ID: $NEW_SW_ID"

# Step 4: Refresh SharePoint Page  
SHAREPOINT_TAB_ID=$(curl -s http://localhost:9222/json | jq -r '.[] | select(.url | contains("sharepoint")) | .id' | head -1)
if [ -n "$SHAREPOINT_TAB_ID" ]; then
    echo "Refreshing SharePoint page (Tab ID: $SHAREPOINT_TAB_ID)..."
    echo '{"id":2,"method":"Runtime.evaluate","params":{"expression":"location.reload()"}}' | websocat -n1 "ws://localhost:9222/devtools/page/$SHAREPOINT_TAB_ID"
else
    echo "⚠️ SharePoint tab not found. Please open a SharePoint page first."
fi
```

**What these commands do**:
- ✅ Finds and reloads extension via background service worker
- ✅ Refreshes SharePoint page to activate new content script
- ✅ Immediate feedback via JSON responses
- ✅ Simple and reliable - no script dependencies

**Use Cases**:
- After fixing bugs in content scripts or page handlers
- When testing DOM selector changes  
- For rapid development iteration cycles
- More reliable than complex automation scripts

### Quick Extension Test
```bash
#!/bin/bash
# Find and test extension popup
POPUP_TAB=$(curl -s http://localhost:9222/json | jq -r '.[] | select(.title | contains("Meeting Summarizer")) | .id')
if [ -n "$POPUP_TAB" ]; then
    echo "Testing extension functionality..."
    echo '{"id":1,"method":"Runtime.evaluate","params":{"expression":"document.title"}}' | websocat -n1 ws://localhost:9222/devtools/page/$POPUP_TAB
else
    echo "Extension popup not found"
fi
```

### Enhanced Extension Diagnostics

**Advanced Diagnostic Commands**: Use these for comprehensive extension state analysis:

```bash
#!/bin/bash
# Enhanced Extension State Diagnosis

# Step 1: Find Extension Service Worker
EXTENSION_SW_ID=$(curl -s http://localhost:9222/json | jq -r '.[] | select(.type == "service_worker" and (.url | contains("cbheahmbkoiomlngjaddonnefjgpgobj"))) | .id' | head -1)

if [ -z "$EXTENSION_SW_ID" ]; then
    echo "❌ Extension service worker not found"
    exit 1
fi

echo "🔍 Extension Service Worker ID: $EXTENSION_SW_ID"

# Step 2: Test Extension Background Service Connectivity
echo "📡 Testing extension message handling..."
CONNECTIVITY_TEST=$(echo '{"id":10,"method":"Runtime.evaluate","params":{"expression":"chrome.runtime.sendMessage({type: \"GET_STATUS\"}).then(result => JSON.stringify({success: true, result})).catch(err => JSON.stringify({success: false, error: err.message}))", "awaitPromise": true}}' | websocat -n1 "ws://localhost:9222/devtools/page/$EXTENSION_SW_ID" | jq -r '.result.result.value' 2>/dev/null)

echo "🔌 Connectivity Result: $CONNECTIVITY_TEST"

# Step 3: Run Job State Diagnostic (if connectivity works)
if echo "$CONNECTIVITY_TEST" | grep -q '"success":true'; then
    echo "✅ Extension responding. Running job state diagnostic..."
    JOB_DIAGNOSTIC=$(echo '{"id":11,"method":"Runtime.evaluate","params":{"expression":"chrome.runtime.sendMessage({type: \"DEBUG_JOB_STATE\"}).then(result => JSON.stringify(result, null, 2)).catch(err => JSON.stringify({error: err.message}))", "awaitPromise": true}}' | websocat -n1 "ws://localhost:9222/devtools/page/$EXTENSION_SW_ID" | jq -r '.result.result.value' 2>/dev/null)
    
    echo "📊 Job State Diagnostic:"
    echo "$JOB_DIAGNOSTIC" | jq '.' 2>/dev/null || echo "$JOB_DIAGNOSTIC"
else
    echo "❌ Extension not responding. Checking initialization..."
    
    # Step 4: Check Extension Initialization State
    INIT_CHECK=$(echo '{"id":12,"method":"Runtime.evaluate","params":{"expression":"console.log(\"=== Extension Init Check ===\"); [\"backgroundService\", \"backgroundMain\", \"chrome\"].forEach(name => console.log(name + \":\", typeof globalThis[name])); \"Init check completed\""}}' | websocat -n1 "ws://localhost:9222/devtools/page/$EXTENSION_SW_ID")
    
    echo "🔧 Check browser console for initialization details"
fi

# Step 5: Check for Console Errors
echo "📝 Checking for recent errors..."
ERROR_CHECK=$(echo '{"id":13,"method":"Runtime.evaluate","params":{"expression":"console.log(\"Recent errors and warnings should appear above\"); \"Error check completed\""}}' | websocat -n1 "ws://localhost:9222/devtools/page/$EXTENSION_SW_ID")
```

### SharePoint Detection Test
```bash
#!/bin/bash
# Test SharePoint page detection
SP_TAB=$(curl -s http://localhost:9222/json | jq -r '.[] | select(.url | contains("sharepoint")) | .id')
if [ -n "$SP_TAB" ]; then
    echo "Testing SharePoint detection..."
    echo '{"id":1,"method":"Runtime.evaluate","params":{"expression":"document.querySelectorAll(\"video\").length + \" video elements found\""}}' | websocat -n1 ws://localhost:9222/devtools/page/$SP_TAB
else
    echo "SharePoint page not found"
fi
```

## Best Practices

1. **Use Chrome DevTools Protocol reload commands** after code changes
2. **Always verify current state** before testing
3. **Use dynamic tab/extension ID lookup** instead of hardcoded values
4. **Test in isolation** - disable conflicting extensions
5. **Monitor console output** for detailed error information
6. **Document test results** in bug reports and verification documents
7. **Use simple, reliable commands** over complex automation
8. **Test with real SharePoint pages** that contain meeting recordings

### Development Workflow Recommendations

1. **After Code Changes**: 
   - Use manual Chrome DevTools Protocol commands (see above)
   - Commands handle both extension reload and page refresh reliably
   
2. **Bug Fix Verification**:
   - Run the two-step reload process to apply fixes immediately
   - Test end-to-end functionality after reload
   
3. **DOM Selector Testing**:
   - Particularly important for SharePoint handler changes
   - Manual reload ensures content script gets latest selector logic
   - Simpler than automation scripts but just as effective

## Troubleshooting

### Common Error Patterns
- `"Could not establish connection"` → Content script injection issue  
  - **Solution**: Use Chrome DevTools Protocol reload commands to re-inject content scripts
- `"No meeting recordings detected"` → Detection logic failure
  - **Solution**: Reload extension and refresh page after DOM selector fixes
- `"JSON: invalid token"` → Malformed WebSocket message
  - **Solution**: Check JSON escaping in websocat commands
- `"Receiving end does not exist"` → Message listener not registered
- `chrome.runtime is undefined` → Extension context not available
  - **Solution**: Extension needs reload; use manual reload commands

### Debug Steps
1. **First**: Try Chrome DevTools Protocol reload commands (see Automation Scripts section)
2. Verify browser is running with remote debugging (`curl -s http://localhost:9222/json`)
3. Check extension is loaded and active
4. **Run Enhanced Diagnostics** (see Enhanced Extension Diagnostics section)
5. Confirm target page is accessible
6. Test basic WebSocket connection
7. Validate JSON message format
8. Check Chrome extension permissions
9. Review content script injection timing

### Advanced Troubleshooting

#### Extension Message Handler Issues
**Problem**: "Could not establish connection. Receiving end does not exist"
**Root Causes & Solutions**:
1. **Service Worker Not Fully Initialized**
   ```bash
   # Check if extension service worker is responding
   EXTENSION_SW_ID=$(curl -s http://localhost:9222/json | jq -r '.[] | select(.type == "service_worker" and (.url | contains("cbheahmbkoiomlngjaddonnefjgpgobj"))) | .id' | head -1)
   echo '{"id":1,"method":"Runtime.evaluate","params":{"expression":"typeof chrome !== \"undefined\" && typeof chrome.runtime !== \"undefined\""}}' | websocat -n1 "ws://localhost:9222/devtools/page/$EXTENSION_SW_ID"
   ```

2. **Message Listeners Not Registered**
   - Check background service initialization logs
   - Verify BackgroundMain.initialize() completed successfully
   - Look for "fallback message handler" logs indicating proper setup

3. **Extension Reload Required**
   ```bash
   # Force reload and wait for initialization
   echo '{"id":1,"method":"Runtime.evaluate","params":{"expression":"chrome.runtime.reload()"}}' | websocat -n1 "ws://localhost:9222/devtools/page/$EXTENSION_SW_ID"
   sleep 3
   # Re-test connectivity
   ```

#### Job State Synchronization Issues
**Problem**: JobTracker shows jobs but JobQueueManager queue is empty
**Diagnostic Commands**:
```bash
# Use the enhanced diagnostic script above, look for:
# - JobTracker.totalJobs > 0 
# - JobQueue.totalQueued = 0
# - Analysis showing "trackedButNotQueued" jobs
```

**Common Causes**:
1. **State Sync Failure**: Jobs added to tracker but not queue
2. **Processing Loop Issues**: Jobs taken from queue but stuck in processing
3. **Azure Service Initialization**: Jobs fail Azure availability check

#### Service Worker Console Access
**Problem**: Need to see service worker logs directly
**Solution**: Use browser DevTools or remote debugging console access:
```bash
# Enable console logging in service worker
EXTENSION_SW_ID="YOUR_SW_ID"
echo '{"id":1,"method":"Runtime.enable"}' | websocat -n1 "ws://localhost:9222/devtools/page/$EXTENSION_SW_ID"
echo '{"id":2,"method":"Console.enable"}' | websocat -n1 "ws://localhost:9222/devtools/page/$EXTENSION_SW_ID"
```

### Manual Reload Troubleshooting
If Chrome DevTools Protocol commands fail:
- Ensure `websocat` and `jq` are installed
- Verify remote debugging is enabled on port 9222
- Check that extension is loaded in browser
- Manually reload extension in browser as fallback
- Check service worker and tab IDs are current