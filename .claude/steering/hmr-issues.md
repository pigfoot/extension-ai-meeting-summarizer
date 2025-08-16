# HMR (Hot Module Replacement) Technical Debt Tracking

**Document Purpose**: Dedicated tracking and documentation of HMR system-related technical issues, solutions, and future improvement plans.

## 🎯 Issue Overview

### Core Problem: Content Script HMR Incompatibility

**Discovery Date**: 2025-08-16  
**Impact Scope**: Chrome Extension Content Scripts  
**Severity**: High (affects development experience)  
**Status**: Temporarily resolved, pending fundamental improvements

## 📋 Detailed Issue Documentation

### Original Design vs Actual Requirements Conflict

#### Original HMR Design Assumptions ❌
```typescript
// HMR system design assumption: code can be loaded asynchronously
main.js -> import('./main_dev.js')  // Dynamic loading of actual logic

// Suitable for:
- React component reloading
- CSS style updates  
- General business logic
```

#### Chrome Extension Actual Requirements ✅
```typescript
// Chrome APIs must be registered synchronously
chrome.runtime.onMessage.addListener(...);  // Must be immediately available
chrome.storage.onChanged.addListener(...);  // Cannot be delayed loading
```

### Issue Discovery Timeline

| Time | Event | Discovery Method |
|------|------|------------------|
| **Step 1** | Feature test failure | User clicks "start audio capture" with no response |
| **Step 2** | Error message confirmation | Console: `Could not establish connection. Receiving end does not exist.` |
| **Step 3** | Content Script status check | `window.contentScript` is `undefined` |
| **Step 4** | Remote Debugging diagnosis | `http://localhost:9222` check extension status |
| **Step 5** | File structure analysis | content/all.iife.js only contains HMR code |
| **Step 6** | Plugin chain analysis | Confirmed `makeEntryPointPlugin` causes code separation |
| **Step 7** | Root cause determination | HMR dynamic import conflicts with Chrome API synchronous requirements |

### Technical Implementation Issue Analysis

#### HMR Plugin Chain Issues
```typescript
// Issue 1: makeEntryPointPlugin
generateBundle(options, bundle) {
  // Move original code to _dev.js
  safeWriteFileSync(resolve(outputDir, newFileName), module.code);
  
  // Main file only keeps dynamic import
  module.code = `import('./${newFileNameBase}');`;
}

// Issue 2: watchRebuildPlugin  
const hmrCode = (refresh ? refreshCode : '') + (reload ? reloadCode : '');
// Inject WebSocket connection code, but HMR server may not be running during development

// Issue 3: withPageConfig
plugins: [react(), IS_DEV && watchRebuildPlugin({ refresh: true }), ...]
// All pages enable HMR by default, including unsuitable content scripts
```

#### Failed Code Execution Flow
```typescript
// 1. Extension loads content/all.iife.js
// 2. File content: import('./all.iife_dev.js');
// 3. Dynamic import executes -> Asynchronous loading
// 4. Chrome tries to send message -> Message listener not yet registered
// 5. Error: Receiving end does not exist
```

## 🔧 Solution Documentation

### Temporary Solution (Implemented)

**Implementation Date**: 2025-08-16  
**Method**: Selective HMR plugin disabling

#### Modified Files:
1. **pages/content/build.mts**
   ```typescript
   // Disable content script HMR entry point plugin
   plugins: [/* IS_DEV && makeEntryPointPlugin() */],
   ```

2. **packages/vite-config/lib/with-page-config.ts**
   ```typescript
   // Disable global watch rebuild plugin
   plugins: [react(), /* IS_DEV && watchRebuildPlugin({ refresh: true }) */, nodePolyfills()],
   ```

3. **packages/vite-config/lib/build-content-script.ts**
   ```typescript
   // Disable content script builder HMR plugin
   plugins: [/* IS_DEV && makeEntryPointPlugin() */],
   ```

#### Verification Results:
- ✅ Content script communication restored
- ✅ `window.contentScript` loads correctly
- ✅ Message listeners immediately available
- ✅ Extension functionality working normally
- ❌ Lost HMR support for content scripts

### Impact Assessment

#### Positive Impact ✅
- **Functionality Restored**: Chrome extension core features working
- **Development Stability**: No more communication errors
- **Testing Feasibility**: Can perform complete functionality testing

#### Negative Impact ❌
- **Degraded Development Experience**: Content script changes require manual reload
- **Reduced Development Efficiency**: Longer testing cycles
- **Technical Debt**: Accumulated fundamental issues that need resolution

## 🚀 Future Solution Design

### Long-term Solution: Smart Conditional HMR

#### Phase 1: Code Analysis Engine
```typescript
interface HMRCompatibilityAnalyzer {
  analyze(code: string): HMRCompatibilityResult;
}

interface HMRCompatibilityResult {
  isHMRCompatible: boolean;
  reasons: string[];
  recommendedStrategy: 'inline' | 'dynamic-import' | 'hybrid';
  chromeAPIUsage: {
    hasMessageListeners: boolean;
    hasStorageListeners: boolean;
    hasTabListeners: boolean;
    immediateExecutionRequired: boolean;
  };
}

// Implementation example
class ChromeExtensionHMRAnalyzer implements HMRCompatibilityAnalyzer {
  analyze(code: string): HMRCompatibilityResult {
    const chromeAPIPatterns = [
      /chrome\.runtime\.onMessage\.addListener/,
      /chrome\.storage\.onChanged\.addListener/,
      /chrome\.tabs\.onUpdated\.addListener/,
      /chrome\.windows\.onCreated\.addListener/
    ];
    
    const hasImmediateExecution = chromeAPIPatterns.some(pattern => 
      pattern.test(code)
    );
    
    return {
      isHMRCompatible: !hasImmediateExecution,
      reasons: hasImmediateExecution ? 
        ['Chrome API listeners require immediate execution'] : [],
      recommendedStrategy: hasImmediateExecution ? 'inline' : 'dynamic-import',
      chromeAPIUsage: {
        hasMessageListeners: /chrome\.runtime\.onMessage\.addListener/.test(code),
        hasStorageListeners: /chrome\.storage\.onChanged\.addListener/.test(code),
        hasTabListeners: /chrome\.tabs\.onUpdated\.addListener/.test(code),
        immediateExecutionRequired: hasImmediateExecution
      }
    };
  }
}
```

#### Phase 2: Smart Entry Point Plugin
```typescript
export const makeSmartEntryPointPlugin = (options?: SmartHMROptions): PluginOption => ({
  name: 'smart-entry-point-plugin',
  generateBundle(options, bundle) {
    const analyzer = new ChromeExtensionHMRAnalyzer();
    
    for (const module of Object.values(bundle)) {
      if (module.type !== 'chunk') continue;
      
      const analysis = analyzer.analyze(module.code);
      
      if (analysis.chromeAPIUsage.immediateExecutionRequired) {
        // Strategy A: Inline mode (maintain immediate execution)
        this.applyInlineStrategy(module, options);
      } else {
        // Strategy B: HMR mode (support hot reload)
        this.applyHMRStrategy(module, options);
      }
    }
  },
  
  applyInlineStrategy(module, options) {
    // Keep code inline, don't separate files
    // Optional: Add page reload mechanism (non-HMR)
    if (options?.enablePageReload) {
      const reloadCode = this.generatePageReloadCode();
      module.code += reloadCode;
    }
  },
  
  applyHMRStrategy(module, options) {
    // Use original HMR mechanism
    // Generate _dev.js file and dynamic import
    this.applyOriginalHMRLogic(module);
  }
});
```

#### Phase 3: Configuration System
```typescript
// Configuration options in vite.config.mts
interface SmartHMROptions {
  // Auto-detection mode
  autoDetect: boolean;
  
  // Manual override rules  
  forceInline: string[];        // Force inline file patterns
  forceDynamic: string[];       // Force HMR file patterns
  
  // Feature switches
  enablePageReload: boolean;    // Enable page reload for inline files
  enableWebSocketReload: boolean; // Whether to attempt WebSocket reload
  
  // Development experience
  logAnalysisResults: boolean;  // Whether to log analysis results
  warnOnIncompatibility: boolean; // Warn about incompatible code
}

// Usage example
export default defineConfig({
  plugins: [
    makeSmartEntryPointPlugin({
      autoDetect: true,
      forceInline: ['**/content/**/*.ts'],  // Force inline for content scripts
      forceDynamic: ['**/popup/**/*.ts'],   // Use HMR for popup scripts
      enablePageReload: true,               // Support page reload for inline files
      logAnalysisResults: true
    })
  ]
});
```

#### Phase 4: Hybrid Development Experience
```typescript
// Expected development experience improvements
interface ImprovedDevExperience {
  contentScripts: {
    reloadStrategy: 'page-reload';        // Page reload instead of HMR
    reloadSpeed: 'fast';                  // Optimized reload speed
    debugFriendly: true;                  // Maintain source maps
  };
  
  uiComponents: {
    reloadStrategy: 'hmr';                // Full HMR support
    preserveState: true;                  // Maintain component state
    hotStyleReload: true;                 // Hot style reload
  };
  
  backgroundScripts: {
    reloadStrategy: 'service-worker-reload'; // Service Worker reload
    preserveStorage: true;                // Maintain storage state
  };
}
```

## 📊 Implementation Plan

### Priority Ranking

| Phase | Task | Priority | Estimated Duration | Dependencies |
|-------|------|----------|-------------------|--------------|
| Phase 1 | Design code analysis engine | High | 2-3 days | None |
| Phase 2 | Implement smart plugin prototype | High | 3-5 days | Phase 1 |
| Phase 3 | Build configuration system | Medium | 2-3 days | Phase 2 |
| Phase 4 | Integration testing and optimization | Medium | 2-3 days | Phase 1-3 |
| Phase 5 | Documentation and guide updates | Low | 1-2 days | Phase 1-4 |

### Success Metrics

#### Technical Metrics
- ✅ Content scripts maintain immediate execution capability
- ✅ UI components maintain full HMR support
- ✅ Auto-detection accuracy > 95%
- ✅ Development reload time < 2 seconds

#### Development Experience Metrics  
- ✅ Reduce manual reload times by 80%+
- ✅ Maintain error debugging capability
- ✅ Backward compatible with existing configurations

## 🔄 Monitoring and Maintenance

### Continuous Monitoring Items
1. **HMR Compatibility Error Rate**: Monitor new code auto-detection failures
2. **Development Reload Time**: Ensure performance meets expectations
3. **WebSocket Connection Stability**: Avoid connection issue recurrence
4. **Extension Functionality Correctness**: Ensure core features are unaffected

### Maintenance Plan
- **Weekly Check**: HMR analysis accuracy
- **Monthly Evaluation**: Development experience improvement effectiveness
- **Quarterly Update**: Adjust detection rules based on Chrome Extension API changes

## 📝 Related Resources

### Technical References
- [Chrome Extension Manifest V3 API](https://developer.chrome.com/docs/extensions/mv3/)
- [Vite Plugin Development Guide](https://vitejs.dev/guide/api-plugin.html)
- [Browser Extension HMR Best Practices](https://github.com/crxjs/chrome-extension-tools)

### Internal Documentation
- `.claude/steering/tech.md` - Main technical documentation
- `packages/hmr/` - HMR plugin implementation
- `packages/vite-config/` - Vite configuration system

### Monitoring Tools
- Chrome DevTools Protocol (Remote Debugging)
- Extension built-in error monitoring
- Development environment performance metrics

---

**Last Updated**: 2025-08-16  
**Owner**: Development Team  
**Status**: Temporarily resolved, awaiting fundamental improvement implementation