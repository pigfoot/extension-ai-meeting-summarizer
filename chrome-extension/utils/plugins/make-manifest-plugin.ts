import { browserDetectUtils, getBrowserManifestAdjustments, checkBrowserCompatibility } from '../browser-detect';
import { ManifestParser } from '@extension/dev-utils';
import { IS_DEV } from '@extension/env';
import { colorfulLog } from '@extension/shared';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { platform } from 'node:process';
import { pathToFileURL } from 'node:url';
import type { TargetBrowser, ManifestValidationResult, ManifestGenerationResult } from '../../src/types/manifest';
import type { ManifestType } from '@extension/shared';
import type { PluginOption } from 'vite';

const manifestFile = resolve(import.meta.dirname, '..', '..', 'manifest.js');
// const refreshFilePath = resolve(
//   import.meta.dirname,
//   '..',
//   '..',
//   '..',
//   'packages',
//   'hmr',
//   'dist',
//   'lib',
//   'injections',
//   'refresh.js',
// );

// const withHMRId = (code: string) => `(function() {let __HMR_ID = 'chrome-extension-hmr';${code}\n})();`;

/**
 * Environment variables for target browser detection
 */
const TARGET_BROWSER = (process.env.TARGET_BROWSER as TargetBrowser) || 'chrome';
const BUILD_ENVIRONMENT = (process.env.NODE_ENV as 'development' | 'production') || 'development';

const getManifestWithCacheBurst = async () => {
  const withCacheBurst = (path: string) => `${path}?${Date.now().toString()}`;

  /**
   * In Windows, import() doesn't work without file:// protocol.
   * So, we need to convert path to file:// protocol. (url.pathToFileURL)
   */
  if (platform === 'win32') {
    return (await import(withCacheBurst(pathToFileURL(manifestFile).href))).default;
  } else {
    return (await import(withCacheBurst(manifestFile))).default;
  }
};

const addRefreshContentScript = (_manifest: ManifestType) => {
  // DISABLED: refresh.js content script injection interferes with Chrome extension messaging
  // Content scripts already use Smart HMR with inline strategy, no need for separate refresh.js injection
  // manifest.content_scripts = manifest.content_scripts || [];
  // manifest.content_scripts.push({
  //   matches: ['http://*/*', 'https://*/*', '<all_urls>'],
  //   js: ['refresh.js'], // for public's HMR(refresh) support
  // });
};

/**
 * Apply browser-specific manifest transformations
 */
const applyBrowserSpecificTransformations = (
  manifest: ManifestType,
  targetBrowser: TargetBrowser,
): ManifestGenerationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const transformations: string[] = [];

  try {
    // Get browser-specific adjustments
    const adjustments = getBrowserManifestAdjustments(targetBrowser);

    // Create a deep copy of the manifest
    const transformedManifest = JSON.parse(JSON.stringify(manifest)) as ManifestType;

    // Remove unsupported properties
    adjustments.remove.forEach(property => {
      if (property in transformedManifest) {
        delete (transformedManifest as Record<string, unknown>)[property];
        transformations.push(`Removed unsupported property: ${property}`);
      }
    });

    // Modify existing properties
    Object.entries(adjustments.modify).forEach(([key, value]) => {
      if (key in transformedManifest) {
        (transformedManifest as Record<string, unknown>)[key] = value;
        transformations.push(`Modified property: ${key}`);
      }
    });

    // Add new properties
    Object.entries(adjustments.add).forEach(([key, value]) => {
      (transformedManifest as Record<string, unknown>)[key] = value;
      transformations.push(`Added property: ${key}`);
    });

    // Apply browser-specific permission filtering
    if (transformedManifest.permissions) {
      const originalPermissions = [...transformedManifest.permissions];
      transformedManifest.permissions = browserDetectUtils.filterPermissionsForBrowser(
        targetBrowser,
        transformedManifest.permissions,
      );

      const removedPermissions = originalPermissions.filter(p => !transformedManifest.permissions?.includes(p));

      if (removedPermissions.length > 0) {
        transformations.push(`Filtered unsupported permissions: ${removedPermissions.join(', ')}`);
        warnings.push(
          `Some permissions were removed for ${targetBrowser} compatibility: ${removedPermissions.join(', ')}`,
        );
      }
    }

    // Apply content script configuration
    if (transformedManifest.content_scripts) {
      const contentScriptConfig = browserDetectUtils.getBrowserContentScriptConfig(targetBrowser);

      transformedManifest.content_scripts = transformedManifest.content_scripts.map(script => ({
        ...script,
        run_at: contentScriptConfig.runAt,
        ...(contentScriptConfig.worldContext && { world: contentScriptConfig.worldContext }),
      }));

      transformations.push(`Applied ${targetBrowser} content script configuration`);
    }

    // Firefox-specific transformations
    if (targetBrowser === 'firefox') {
      // Ensure Firefox-specific background script configuration
      if (transformedManifest.background && 'service_worker' in transformedManifest.background) {
        transformedManifest.background = {
          scripts: [transformedManifest.background.service_worker],
          persistent: false,
        };
        transformations.push('Converted service worker to background scripts for Firefox');
      }

      // Add Firefox-specific browser settings if not present
      if (!transformedManifest.browser_specific_settings) {
        transformedManifest.browser_specific_settings = {
          gecko: {
            id: 'meeting-summarizer@extension.local',
            strict_min_version: '109.0',
          },
        };
        transformations.push('Added Firefox browser_specific_settings');
      }
    }

    // Validate the transformed manifest
    const validation = validateManifest(transformedManifest, targetBrowser);

    return {
      manifest: transformedManifest,
      browser: targetBrowser,
      success: validation.isValid,
      errors: [...errors, ...validation.errors.map(e => e.toString())],
      warnings: [...warnings, ...validation.warnings],
      transformations,
      validation,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    errors.push(`Transformation failed: ${errorMessage}`);

    return {
      manifest,
      browser: targetBrowser,
      success: false,
      errors,
      warnings,
      transformations,
      validation: {
        isValid: false,
        errors: ['TRANSFORMATION_FAILED'],
        warnings: [],
        compatibilityIssues: [],
        validatedAt: new Date().toISOString(),
      },
      generatedAt: new Date().toISOString(),
    };
  }
};

/**
 * Validate manifest for specific browser
 */
const validateManifest = (manifest: ManifestType, targetBrowser: TargetBrowser): ManifestValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const compatibilityIssues: Array<{
    browser: TargetBrowser;
    severity: 'error' | 'warning';
    description: string;
    property: string;
    suggestedFix: string;
  }> = [];

  // Check browser capabilities
  const capabilities = browserDetectUtils.detectBrowserCapabilities(targetBrowser);

  // Validate permissions
  if (manifest.permissions) {
    manifest.permissions.forEach(permission => {
      if (!capabilities.supportedPermissions.includes(permission)) {
        compatibilityIssues.push({
          browser: targetBrowser,
          severity: 'warning',
          description: `Permission '${permission}' is not supported in ${targetBrowser}`,
          property: 'permissions',
          suggestedFix: `Remove or replace permission '${permission}'`,
        });
      }
    });
  }

  // Validate manifest version
  if (manifest.manifest_version === 3 && !browserDetectUtils.supportsManifestV3(targetBrowser)) {
    compatibilityIssues.push({
      browser: targetBrowser,
      severity: 'error',
      description: `Manifest V3 is not fully supported in ${targetBrowser}`,
      property: 'manifest_version',
      suggestedFix: `Consider using Manifest V2 for ${targetBrowser}`,
    });
  }

  // Validate background script configuration
  if (manifest.background) {
    if (
      'service_worker' in manifest.background &&
      !browserDetectUtils.checkBrowserFeatureSupport(targetBrowser, 'serviceWorker')
    ) {
      compatibilityIssues.push({
        browser: targetBrowser,
        severity: 'warning',
        description: `Service workers have limited support in ${targetBrowser}`,
        property: 'background.service_worker',
        suggestedFix: `Use background scripts instead of service worker for ${targetBrowser}`,
      });
    }
  }

  // Check for browser-specific required fields
  if (targetBrowser === 'firefox' && !manifest.browser_specific_settings?.gecko) {
    warnings.push('Firefox requires browser_specific_settings.gecko configuration');
  }

  return {
    isValid: errors.length === 0 && compatibilityIssues.filter(issue => issue.severity === 'error').length === 0,
    errors,
    warnings,
    compatibilityIssues,
    validatedAt: new Date().toISOString(),
  };
};

/**
 * Generate manifest file name based on browser and environment
 */
const getManifestFileName = (browser: TargetBrowser, environment: string): string => {
  if (environment === 'development') {
    return 'manifest.json';
  }
  return browser === 'chrome' ? 'manifest.json' : `manifest.${browser}.json`;
};

export default (config: {
  outDir: string;
  targetBrowser?: TargetBrowser;
  generateMultipleBrowsers?: boolean;
}): PluginOption => {
  const makeManifest = (manifest: ManifestType, to: string, targetBrowser: TargetBrowser = 'chrome') => {
    if (!existsSync(to)) {
      mkdirSync(to, { recursive: true });
    }

    // Apply browser-specific transformations
    const transformationResult = applyBrowserSpecificTransformations(manifest, targetBrowser);

    if (!transformationResult.success) {
      colorfulLog(`Manifest generation failed for ${targetBrowser}:`, 'error');
      transformationResult.errors.forEach(error => {
        colorfulLog(`  Error: ${error}`, 'error');
      });
      return;
    }

    // Log transformation details
    if (transformationResult.transformations.length > 0) {
      colorfulLog(
        `Applied ${transformationResult.transformations.length} transformations for ${targetBrowser}:`,
        'info',
      );
      transformationResult.transformations.forEach(transformation => {
        colorfulLog(`  - ${transformation}`, 'info');
      });
    }

    // Log warnings
    if (transformationResult.warnings.length > 0) {
      transformationResult.warnings.forEach(warning => {
        colorfulLog(`  Warning: ${warning}`, 'warning');
      });
    }

    const transformedManifest = transformationResult.manifest;

    // Add HMR content script for development
    if (IS_DEV) {
      addRefreshContentScript(transformedManifest);
    }

    // Generate manifest file name
    const manifestFileName = getManifestFileName(targetBrowser, BUILD_ENVIRONMENT);
    const manifestPath = resolve(to, manifestFileName);

    // Write manifest file
    try {
      const manifestString = ManifestParser.convertManifestToString(transformedManifest, targetBrowser === 'firefox');
      writeFileSync(manifestPath, manifestString);

      // Store generation result for debugging
      if (IS_DEV) {
        const resultPath = resolve(to, `manifest.${targetBrowser}.result.json`);
        writeFileSync(resultPath, JSON.stringify(transformationResult, null, 2));
      }

      colorfulLog(`✅ Manifest generated for ${targetBrowser}: ${manifestPath}`, 'success');
    } catch (error) {
      colorfulLog(`❌ Failed to write manifest for ${targetBrowser}: ${error}`, 'error');
      return;
    }

    // DISABLED: HMR refresh script generation interferes with Chrome extension messaging
    // Background scripts and content scripts already have Smart HMR built-in
    // if (IS_DEV) {
    //   const refreshFileString = readFileSync(refreshFilePath, 'utf-8');
    //   writeFileSync(resolve(to, 'refresh.js'), withHMRId(refreshFileString));
    // }
  };

  const makeMultipleBrowserManifests = async (baseManifest: ManifestType, outDir: string) => {
    const browsers: TargetBrowser[] = ['chrome', 'firefox', 'edge'];

    colorfulLog(`🔄 Generating manifests for multiple browsers: ${browsers.join(', ')}`, 'info');

    for (const browser of browsers) {
      try {
        makeManifest(baseManifest, outDir, browser);

        // Check browser compatibility
        const compatibility = checkBrowserCompatibility(browser, '120'); // Assume modern version
        if (!compatibility.compatible) {
          colorfulLog(`⚠️  Compatibility issues detected for ${browser}:`, 'warning');
          compatibility.issues.forEach(issue => {
            colorfulLog(`  - ${issue.description}`, 'warning');
          });
        }
      } catch (error) {
        colorfulLog(`❌ Failed to generate manifest for ${browser}: ${error}`, 'error');
      }
    }
  };

  return {
    name: 'make-manifest-enhanced',
    buildStart() {
      this.addWatchFile(manifestFile);

      // Log build configuration
      colorfulLog(`🚀 Building for browser: ${TARGET_BROWSER}`, 'info');
      colorfulLog(`📦 Environment: ${BUILD_ENVIRONMENT}`, 'info');

      if (config.generateMultipleBrowsers) {
        colorfulLog(`🌐 Multi-browser build enabled`, 'info');
      }
    },
    async writeBundle() {
      const outDir = config.outDir;
      const baseManifest = await getManifestWithCacheBurst();

      try {
        if (config.generateMultipleBrowsers) {
          // Generate manifests for all supported browsers
          await makeMultipleBrowserManifests(baseManifest, outDir);
        } else {
          // Generate manifest for target browser only
          const targetBrowser = config.targetBrowser || TARGET_BROWSER;
          makeManifest(baseManifest, outDir, targetBrowser);
        }

        colorfulLog(`✨ Manifest generation completed`, 'success');
      } catch (error) {
        colorfulLog(`💥 Manifest generation failed: ${error}`, 'error');
        throw error;
      }
    },

    // Add configuration methods for runtime use
    configResolved(resolvedConfig) {
      // Store resolved config for debugging
      if (IS_DEV) {
        const configPath = resolve(config.outDir, 'build.config.json');
        if (existsSync(config.outDir)) {
          writeFileSync(
            configPath,
            JSON.stringify(
              {
                target: TARGET_BROWSER,
                environment: BUILD_ENVIRONMENT,
                generateMultiple: config.generateMultipleBrowsers,
                viteConfig: {
                  mode: resolvedConfig.mode,
                  command: resolvedConfig.command,
                },
              },
              null,
              2,
            ),
          );
        }
      }
    },
  };
};
