/**
 * Minimal Diagnostic Content Script
 * 
 * This script is designed to test basic Chrome Extension content script injection
 * with minimal dependencies to isolate injection issues.
 */

console.log('[DIAGNOSTIC] Starting minimal content script injection test');
console.log('[DIAGNOSTIC] Script loaded at:', new Date().toISOString());
console.log('[DIAGNOSTIC] Page URL:', window.location.href);
console.log('[DIAGNOSTIC] Page title:', document.title);

// Create global diagnostic object for easy inspection
(window as any).diagnosticContentScript = {
  loaded: true,
  timestamp: Date.now(),
  chromeRuntime: !!chrome?.runtime,
  extensionId: chrome?.runtime?.id || 'undefined',
  pageUrl: window.location.href,
  pageTitle: document.title,
  userAgent: navigator.userAgent,
  readyState: document.readyState
};

console.log('[DIAGNOSTIC] Global object created:', (window as any).diagnosticContentScript);

// Test Chrome runtime availability
if (chrome?.runtime) {
  console.log('[DIAGNOSTIC] Chrome runtime available');
  console.log('[DIAGNOSTIC] Extension ID:', chrome.runtime.id);
  
  // Test message listener registration
  if (chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('[DIAGNOSTIC] Message received:', message);
      console.log('[DIAGNOSTIC] Message sender:', sender);
      
      const response = {
        diagnostic: true,
        received: true,
        timestamp: Date.now(),
        messageType: message.type || 'unknown',
        pageUrl: window.location.href
      };
      
      console.log('[DIAGNOSTIC] Sending response:', response);
      sendResponse(response);
      
      return true; // Keep message channel open for async response
    });
    console.log('[DIAGNOSTIC] Message listener registered successfully');
    
    // Update global object
    (window as any).diagnosticContentScript.messageListenerRegistered = true;
  } else {
    console.error('[DIAGNOSTIC] chrome.runtime.onMessage not available');
    (window as any).diagnosticContentScript.messageListenerRegistered = false;
  }
} else {
  console.error('[DIAGNOSTIC] chrome.runtime not available');
  (window as any).diagnosticContentScript.chromeRuntime = false;
}

// Test DOM ready state
console.log('[DIAGNOSTIC] Document ready state:', document.readyState);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[DIAGNOSTIC] DOMContentLoaded event fired');
    (window as any).diagnosticContentScript.domContentLoaded = Date.now();
  });
}

window.addEventListener('load', () => {
  console.log('[DIAGNOSTIC] Window load event fired');
  (window as any).diagnosticContentScript.windowLoaded = Date.now();
});

// Test if we can find video elements (for SharePoint detection)
const testVideoDetection = () => {
  const videos = document.querySelectorAll('video');
  console.log('[DIAGNOSTIC] Video elements found:', videos.length);
  
  if (videos.length > 0) {
    videos.forEach((video, index) => {
      console.log(`[DIAGNOSTIC] Video ${index + 1}:`, {
        src: video.src,
        currentSrc: video.currentSrc,
        controls: video.controls,
        duration: video.duration
      });
    });
  }
  
  (window as any).diagnosticContentScript.videoElementsFound = videos.length;
  return videos.length;
};

// Run video detection immediately and after page load
testVideoDetection();
window.addEventListener('load', testVideoDetection);

// Test SharePoint specific detection
const testSharePointDetection = () => {
  const isSharePoint = window.location.href.includes('sharepoint');
  const isStreamPage = window.location.href.includes('stream.aspx');
  const hasStreamPattern = /\/stream\.aspx/i.test(window.location.href);
  
  console.log('[DIAGNOSTIC] SharePoint detection:', {
    isSharePoint,
    isStreamPage,
    hasStreamPattern,
    url: window.location.href
  });
  
  (window as any).diagnosticContentScript.sharePointDetection = {
    isSharePoint,
    isStreamPage,
    hasStreamPattern
  };
};

testSharePointDetection();

// Create a simple function to test communication from console
(window as any).testDiagnosticCommunication = function() {
  if (chrome?.runtime) {
    console.log('[DIAGNOSTIC] Testing communication...');
    chrome.runtime.sendMessage(
      { type: 'DIAGNOSTIC_TEST', source: 'content-script' },
      (response) => {
        console.log('[DIAGNOSTIC] Communication test response:', response);
      }
    );
  } else {
    console.error('[DIAGNOSTIC] Cannot test communication - chrome.runtime not available');
  }
};

console.log('[DIAGNOSTIC] Diagnostic content script initialization completed');
console.log('[DIAGNOSTIC] Available test functions: window.testDiagnosticCommunication()');
console.log('[DIAGNOSTIC] Global state: window.diagnosticContentScript');