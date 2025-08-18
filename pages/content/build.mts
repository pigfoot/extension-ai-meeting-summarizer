import { resolve } from 'node:path';
import { makeSmartEntryPointPlugin } from '@extension/hmr';
import { getContentScriptEntries, withPageConfig } from '@extension/vite-config';
import { IS_DEV } from '@extension/env';
import { build } from 'vite';

const rootDir = resolve(import.meta.dirname);
const srcDir = resolve(rootDir, 'src');
const matchesDir = resolve(srcDir, 'matches');

const configs = Object.entries(getContentScriptEntries(matchesDir)).map(([name, entry]) =>
  withPageConfig(
    {
      mode: IS_DEV ? 'development' : undefined,
      resolve: {
        alias: {
          '@src': srcDir,
        },
      },
      publicDir: resolve(rootDir, 'public'),
      plugins: [
        makeSmartEntryPointPlugin({
          autoDetect: true,
          forceInline: ['**/content/**/*.ts', '**/content/**/*.js'],
          enablePageReload: false, // Always disable for content scripts
          logAnalysisResults: IS_DEV,
          warnOnIncompatibility: true,
        }),
      ],
      build: {
        lib: {
          name: name,
          formats: ['iife'],
          entry,
          fileName: name,
        },
        outDir: resolve(rootDir, '..', '..', 'dist', 'content'),
      },
    },
    { excludeWatchRebuildPlugin: true },
  ),
);

const builds = configs.map(async config => {
  //@ts-expect-error This is hidden property into vite's resolveConfig()
  config.configFile = false;
  await build(config);
});

await Promise.all(builds);
