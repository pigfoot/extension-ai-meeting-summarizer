import { createChromeExtensionAnalyzer } from '../analyzers/chrome-extension-analyzer.js';
import { IS_FIREFOX } from '@extension/env';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, resolve, sep } from 'node:path';
import type { PluginOption, OutputChunk, OutputAsset } from 'vite';

/**
 * Configuration options for Smart HMR
 */
export interface SmartHMROptions {
  /** Enable automatic detection of HMR compatibility */
  autoDetect?: boolean;
  /** File patterns to force inline (no HMR) */
  forceInline?: string[];
  /** File patterns to force dynamic import (HMR) */
  forceDynamic?: string[];
  /** Enable page reload mechanism for inline files */
  enablePageReload?: boolean;
  /** Enable WebSocket reload for development */
  enableWebSocketReload?: boolean;
  /** Log analysis results for debugging */
  logAnalysisResults?: boolean;
  /** Warn when code incompatibility is detected */
  warnOnIncompatibility?: boolean;
}

/**
 * Extract content directory from output directory for Firefox
 */
const extractContentDir = (outputDir: string) => {
  const parts = outputDir.split(sep);
  const distIndex = parts.indexOf('dist');

  if (distIndex !== -1 && distIndex < parts.length - 1) {
    return parts.slice(distIndex + 1);
  }

  throw new Error('Output directory does not contain "dist"');
};

/**
 * Safe file write with directory creation
 */
const safeWriteFileSync = (path: string, data: string) => {
  const folder = path.split(sep).slice(0, -1).join(sep);

  if (!existsSync(folder)) {
    mkdirSync(folder, { recursive: true });
  }
  writeFileSync(path, data);
};

/**
 * Check if file matches any of the given patterns
 */
const matchesPatterns = (fileName: string, patterns: string[]): boolean => {
  if (!patterns.length) return false;

  return patterns.some(pattern => {
    // Convert glob-like pattern to regex
    const regexPattern = pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\./g, '\\.');

    const regex = new RegExp(regexPattern);
    return regex.test(fileName);
  });
};

/**
 * Generate page reload code for inline files
 */
const generatePageReloadCode = (): string => `
// Smart HMR: Page reload mechanism for content scripts
if (typeof window !== 'undefined' && window.location) {
  const hmrReloadKey = 'smart-hmr-reload-' + window.location.href;
  const lastReload = localStorage.getItem(hmrReloadKey);
  const currentTime = Date.now().toString();
  
  // Check if we should reload (development environment only)
  if (lastReload && (Date.now() - parseInt(lastReload)) < 1000) {
    // Prevent reload loops
    console.log('[Smart HMR] Skipping reload to prevent loops');
  } else {
    // Store reload timestamp
    localStorage.setItem(hmrReloadKey, currentTime);
    
    // Listen for file changes via WebSocket (if available)
    try {
      const ws = new WebSocket('ws://localhost:8081');
      ws.onmessage = () => {
        console.log('[Smart HMR] File changed, reloading page...');
        window.location.reload();
      };
    } catch (e) {
      console.log('[Smart HMR] WebSocket not available, using polling fallback');
    }
  }
}`;

/**
 * Apply inline strategy (no HMR, immediate execution)
 */
const applyInlineStrategy = (module: OutputChunk, outputDir: string, enablePageReload: boolean) => {
  // Keep the code inline, no file separation
  let finalCode = module.code;

  // Optionally add page reload mechanism
  if (enablePageReload) {
    finalCode = finalCode + '\n' + generatePageReloadCode();
  }

  module.code = finalCode;
};

/**
 * Apply HMR strategy (dynamic import for hot reloading)
 */
const applyHMRStrategy = (module: OutputChunk, outputDir: string) => {
  const fileName = module.fileName;
  const newFileName = fileName.replace('.js', '_dev.js');
  const newFileNameBase = basename(newFileName);

  // Write the actual code to _dev.js file
  safeWriteFileSync(resolve(outputDir, newFileName), module.code);

  // Replace main file content with dynamic import
  if (IS_FIREFOX) {
    const contentDirectory = extractContentDir(outputDir);
    module.code = `import(browser.runtime.getURL("${contentDirectory}/${newFileNameBase}"));`;
  } else {
    module.code = `import('./${newFileNameBase}');`;
  }
};

/**
 * Handle asset modules (source maps, etc.)
 */
const handleAssetModule = (module: OutputAsset, outputDir: string) => {
  const fileName = module.fileName;

  if (fileName.endsWith('.map')) {
    const originalFileName = fileName.replace('.map', '');
    const newFileName = originalFileName.replace('.js', '_dev.js');
    const replacedSource = String(module.source).replaceAll(originalFileName, newFileName);

    module.source = '';
    safeWriteFileSync(resolve(outputDir, newFileName), replacedSource);
  }
};

/**
 * Smart Entry Point Plugin that analyzes code and applies appropriate HMR strategy
 */
export const makeSmartEntryPointPlugin = (options: SmartHMROptions = {}): PluginOption => {
  const {
    autoDetect = true,
    forceInline = [],
    forceDynamic = [],
    enablePageReload = false,
    logAnalysisResults = false,
    warnOnIncompatibility = true,
  } = options;

  const analyzer = createChromeExtensionAnalyzer();

  return {
    name: 'smart-entry-point-plugin',
    generateBundle(options, bundle) {
      const outputDir = options.dir;

      if (!outputDir) {
        throw new Error('Output directory not found');
      }

      for (const module of Object.values(bundle)) {
        if (module.type !== 'chunk') {
          // Handle non-chunk modules (assets, etc.)
          handleAssetModule(module, outputDir);
          continue;
        }

        const fileName = module.fileName;
        let strategy: 'inline' | 'dynamic-import' = 'dynamic-import';

        // Check manual overrides first
        if (matchesPatterns(fileName, forceInline)) {
          strategy = 'inline';
          if (logAnalysisResults) {
            console.log(`[Smart HMR] ${fileName}: Forced inline strategy`);
          }
        } else if (matchesPatterns(fileName, forceDynamic)) {
          strategy = 'dynamic-import';
          if (logAnalysisResults) {
            console.log(`[Smart HMR] ${fileName}: Forced dynamic-import strategy`);
          }
        } else if (autoDetect) {
          // Analyze code for HMR compatibility
          const analysis = analyzer.analyze(module.code);
          strategy = analysis.recommendedStrategy === 'inline' ? 'inline' : 'dynamic-import';

          if (logAnalysisResults) {
            console.log(`[Smart HMR] ${fileName}: Analysis result:`, {
              isHMRCompatible: analysis.isHMRCompatible,
              strategy: analysis.recommendedStrategy,
              reasons: analysis.reasons,
              chromeAPIUsage: analysis.chromeAPIUsage,
            });
          }

          if (warnOnIncompatibility && !analysis.isHMRCompatible) {
            console.warn(`[Smart HMR] ${fileName}: HMR incompatible - ${analysis.reasons.join(', ')}`);
          }
        }

        // Apply the determined strategy
        if (strategy === 'inline') {
          applyInlineStrategy(module, outputDir, enablePageReload);
        } else {
          applyHMRStrategy(module, outputDir);
        }
      }
    },
  };
};
