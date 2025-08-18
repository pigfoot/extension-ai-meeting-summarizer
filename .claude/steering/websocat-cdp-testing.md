# WebSocket + Chrome DevTools Protocol Testing Guide

## Overview

This document provides comprehensive guidance on using `websocat` to interact with Chrome DevTools Protocol (CDP) for debugging and testing Chrome extensions.

## Prerequisites

### Installation Requirements
```bash
# Install websocat (if not already installed)
brew install websocat

# Verify installation
which websocat
# Expected: /opt/homebrew/bin/websocat
```

### Browser Setup
```bash
# Launch Edge with remote debugging enabled
msedge --remote-debugging-port=9222

# Alternative debugging ports for multiple instances
msedge --remote-debugging-port=9223  # Secondary instance
chrome --remote-debugging-port=9222  # Chrome debugging
```

## CDP WebSocket Connection Basics

### Finding Available Tabs
```bash
# List all available tabs and their WebSocket endpoints
curl -s http://localhost:9222/json | jq '.[] | {title, id, url}' | head -10
```

Expected output format:
```json
{
  "title": "AI Taskforce sync up (2025)-20250811_103305UTC-Meeting Recording.mp4",
  "id": "0C36484F0E18A4F5CB3FF1F0B69D7A2F",
  "url": "https://trendmicro-my.sharepoint.com/..."
}
```

### Basic WebSocket Connection Pattern
```bash
# Basic syntax for CDP commands
echo '{"id":1,"method":"DOMAIN.METHOD","params":{...}}' | websocat -n1 ws://localhost:9222/devtools/page/TAB_ID

# Parameters explanation:
# -n1: Read one message and close connection
# TAB_ID: The 32-character hexadecimal ID from the tabs list
```

## Core CDP Testing Commands

### 1. Runtime Domain - JavaScript Execution

#### Basic JavaScript Evaluation
```bash
# Get user agent
echo '{"id":1,"method":"Runtime.evaluate","params":{"expression":"navigator.userAgent"}}' | websocat -n1 ws://localhost:9222/devtools/page/TAB_ID

# Get page title
echo '{"id":2,"method":"Runtime.evaluate","params":{"expression":"document.title"}}' | websocat -n1 ws://localhost:9222/devtools/page/TAB_ID

# Get current URL
echo '{"id":3,"method":"Runtime.evaluate","params":{"expression":"window.location.href"}}' | websocat -n1 ws://localhost:9222/devtools/page/TAB_ID
```

#### DOM Queries and Analysis
```bash
# Count video elements on page
echo '{"id":4,"method":"Runtime.evaluate","params":{"expression":"document.querySelectorAll(\"video\").length"}}' | websocat -n1 ws://localhost:9222/devtools/page/TAB_ID

# Get video element details (serialized for CDP)
echo '{"id":5,"method":"Runtime.evaluate","params":{"expression":"JSON.stringify(Array.from(document.querySelectorAll(\"video\")).map(v => ({src: v.src, currentSrc: v.currentSrc, tagName: v.tagName})))"}}' | websocat -n1 ws://localhost:9222/devtools/page/TAB_ID

# Test random number generation
echo '{"id":6,"method":"Runtime.evaluate","params":{"expression":"Math.random()"}}' | websocat -n1 ws://localhost:9222/devtools/page/TAB_ID
```

### 2. DOM Domain - Document Structure Access

#### Document Tree Inspection
```bash
# Get complete DOM document tree
echo '{"id":7,"method":"DOM.getDocument"}' | websocat -n1 ws://localhost:9222/devtools/page/TAB_ID
```

This returns the complete DOM structure including:
- Node IDs for further manipulation
- Element attributes and structure
- Document metadata (URL, compatibility mode, etc.)

### 3. Console Domain - Debug Output Monitoring

#### Enable Console Message Reception
```bash
# Enable console domain to receive log messages
echo '{"id":8,"method":"Console.enable"}' | websocat -n1 ws://localhost:9222/devtools/page/TAB_ID
```

After enabling, you'll automatically receive console messages from the page:
```json
{
  "method": "Console.messageAdded",
  "params": {
    "message": {
      "source": "console-api",
      "level": "info", 
      "text": "[Sensitivity label]: Sensitivity label policy check is not enabled",
      "url": "https://...",
      "line": 33,
      "column": 41862
    }
  }
}
```

## Extension-Specific Testing

### Content Script Verification
```bash
# Check if content script loaded properly
echo '{"id":10,"method":"Runtime.evaluate","params":{"expression":"typeof window.contentScript"}}' | websocat -n1 ws://localhost:9222/devtools/page/TAB_ID

# Test content script readiness
echo '{"id":11,"method":"Runtime.evaluate","params":{"expression":"window.contentScript?.isReady()"}}' | websocat -n1 ws://localhost:9222/devtools/page/TAB_ID

# Get content script statistics
echo '{"id":12,"method":"Runtime.evaluate","params":{"expression":"window.contentScript?.getStatistics()"}}' | websocat -n1 ws://localhost:9222/devtools/page/TAB_ID
```

### Chrome Extension API Testing
```bash
# Test Chrome runtime API availability
echo '{"id":13,"method":"Runtime.evaluate","params":{"expression":"typeof chrome"}}' | websocat -n1 ws://localhost:9222/devtools/page/TAB_ID

# Check message listeners
echo '{"id":14,"method":"Runtime.evaluate","params":{"expression":"chrome.runtime.onMessage.hasListeners()"}}' | websocat -n1 ws://localhost:9222/devtools/page/TAB_ID
```

### SharePoint Page Analysis
```bash
# Detect SharePoint-specific elements
echo '{"id":15,"method":"Runtime.evaluate","params":{"expression":"JSON.stringify({hasVideo: document.querySelectorAll(\"video\").length > 0, hasSharePointElements: document.querySelectorAll(\"[data-sp-feature-tag]\").length > 0, pageTitle: document.title, url: window.location.href})"}}' | websocat -n1 ws://localhost:9222/devtools/page/TAB_ID

# Extract meeting metadata
echo '{"id":16,"method":"Runtime.evaluate","params":{"expression":"JSON.stringify({title: document.title, recordingUrl: window.location.href.includes(\"Recording\"), streamUrl: window.location.href.includes(\"stream.aspx\")})"}}' | websocat -n1 ws://localhost:9222/devtools/page/TAB_ID
```

## Advanced CDP Patterns

### Async Operations and Promises
```bash
# Execute async operations (requires proper Promise handling)
echo '{"id":17,"method":"Runtime.evaluate","params":{"expression":"(async () => { try { const analysis = await window.contentScript?.getStatistics(); return {success: true, data: analysis}; } catch(error) { return {success: false, error: error.message}; } })()", "awaitPromise": true}}' | websocat -n1 ws://localhost:9222/devtools/page/TAB_ID
```

### Complex Object Inspection
```bash
# Get detailed object properties (returns object reference)
echo '{"id":18,"method":"Runtime.evaluate","params":{"expression":"window.contentScript"}}' | websocat -n1 ws://localhost:9222/devtools/page/TAB_ID

# For complex objects, use JSON.stringify for serialization
echo '{"id":19,"method":"Runtime.evaluate","params":{"expression":"JSON.stringify(window.contentScript, null, 2)"}}' | websocat -n1 ws://localhost:9222/devtools/page/TAB_ID
```

## Troubleshooting Common Issues

### Connection Issues
```bash
# Verify CDP endpoint is accessible
curl -s http://localhost:9222/json/version

# Expected response includes:
# {"Browser": "Edge/...", "Protocol-Version": "1.3", ...}
```

### WebSocket Connection Failures
```bash
# Test basic connectivity
echo '{"id":1,"method":"Runtime.evaluate","params":{"expression":"\"connection test\""}}' | websocat -n1 ws://localhost:9222/devtools/page/TAB_ID

# If fails, verify:
# 1. Browser launched with --remote-debugging-port=9222
# 2. TAB_ID is correct (32 hex characters)
# 3. No firewall blocking localhost:9222
```

### JSON Format Errors
Common error: `{"error":{"code":-32700,"message":"JSON: invalid token at position X"}}`

**Prevention:**
- Ensure proper JSON escaping in complex expressions
- Use single quotes inside double quotes: `"expression":"console.log('test')"`
- Escape special characters: `\"` for quotes inside strings

### Tab ID Changes
Tab IDs change when:
- Page reloads
- Navigation occurs
- Browser restarts

**Solution:**
```bash
# Always refresh tab list before testing
curl -s http://localhost:9222/json | jq '.[] | select(.url | test("sharepoint")) | {title, id}' | head -5
```

## Testing Workflow Examples

### Complete Extension Testing Flow
```bash
#!/bin/bash

# 1. Get current SharePoint tab
TAB_ID=$(curl -s http://localhost:9222/json | jq -r '.[] | select(.url | test("sharepoint")) | .id' | head -1)

if [ -z "$TAB_ID" ]; then
    echo "No SharePoint tab found"
    exit 1
fi

echo "Testing tab: $TAB_ID"

# 2. Test basic page info
echo "=== Page Information ==="
echo '{"id":1,"method":"Runtime.evaluate","params":{"expression":"({title: document.title, url: window.location.href})"}}' | websocat -n1 ws://localhost:9222/devtools/page/$TAB_ID

# 3. Test content script
echo "=== Content Script Status ==="
echo '{"id":2,"method":"Runtime.evaluate","params":{"expression":"typeof window.contentScript"}}' | websocat -n1 ws://localhost:9222/devtools/page/$TAB_ID

# 4. Test video detection
echo "=== Video Detection ==="
echo '{"id":3,"method":"Runtime.evaluate","params":{"expression":"document.querySelectorAll(\"video\").length"}}' | websocat -n1 ws://localhost:9222/devtools/page/$TAB_ID

# 5. Test Chrome API
echo "=== Chrome API Status ==="
echo '{"id":4,"method":"Runtime.evaluate","params":{"expression":"typeof chrome"}}' | websocat -n1 ws://localhost:9222/devtools/page/$TAB_ID
```

### Content Analysis Debugging
```bash
# Debug content analyzer results
TAB_ID="YOUR_TAB_ID"

echo "=== Content Analysis Debug ==="
echo '{"id":5,"method":"Runtime.evaluate","params":{"expression":"(async () => { if (window.contentScript?.isReady()) { const analysis = await window.contentAnalyzer?.analyzeContent(); return {confidence: analysis?.meetingConfidence, indicators: analysis?.meetingIndicators}; } return {error: \"Content script not ready\"}; })()", "awaitPromise": true}}' | websocat -n1 ws://localhost:9222/devtools/page/$TAB_ID
```

## Best Practices

### 1. Command ID Management
- Use sequential IDs for commands in the same session
- This helps track request/response pairs

### 2. Error Handling
- Always check for `{"error": {...}}` in responses
- Common errors: invalid JSON, method not found, execution exceptions

### 3. Expression Complexity
- For complex JavaScript, consider breaking into smaller commands
- Use `JSON.stringify()` for serializing complex objects
- Be mindful of execution timeouts for long-running operations

### 4. Security Considerations
- Only use CDP on development/test environments
- Never expose CDP endpoints in production
- Be careful with expressions that modify page state

## Integration with Extension Development

### Development Workflow
1. **Start browser with CDP**: `msedge --remote-debugging-port=9222`
2. **Load extension**: Navigate to `edge://extensions/` and load unpacked
3. **Navigate to test page**: Open SharePoint meeting recording page
4. **Get tab ID**: `curl -s http://localhost:9222/json | jq '.[] | {title, id}'`
5. **Test functionality**: Use websocat commands to verify content script behavior
6. **Debug issues**: Use Runtime.evaluate to inspect internal state
7. **Iterate**: Make code changes and retest without browser restart

### Common Debug Scenarios
- **Content script not loading**: Check `window.contentScript` availability
- **Meeting detection failing**: Test `contentAnalyzer.analyzeContent()` results
- **Chrome API issues**: Verify `chrome.runtime` availability and permissions
- **SharePoint URL extraction**: Test media URL detection manually

This comprehensive guide enables efficient debugging and testing of Chrome extension functionality using WebSocket-based CDP communication.