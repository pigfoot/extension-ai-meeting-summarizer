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

1. **Always verify current state** before testing
2. **Use dynamic tab/extension ID lookup** instead of hardcoded values
3. **Test in isolation** - disable conflicting extensions
4. **Monitor console output** for detailed error information
5. **Document test results** in bug reports and verification documents
6. **Automate repetitive testing** with scripts
7. **Test with real SharePoint pages** that contain meeting recordings

## Troubleshooting

### Common Error Patterns
- `"Could not establish connection"` → Content script injection issue
- `"No meeting recordings detected"` → Detection logic failure
- `"JSON: invalid token"` → Malformed WebSocket message
- `"Receiving end does not exist"` → Message listener not registered

### Debug Steps
1. Verify browser is running with remote debugging
2. Check extension is loaded and active
3. Confirm target page is accessible
4. Test basic WebSocket connection
5. Validate JSON message format
6. Check Chrome extension permissions
7. Review content script injection timing