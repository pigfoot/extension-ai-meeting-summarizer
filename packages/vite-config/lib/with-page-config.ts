import env, { IS_DEV, IS_PROD } from '@extension/env';
import { watchRebuildPlugin } from '@extension/hmr';
import react from '@vitejs/plugin-react-swc';
import deepmerge from 'deepmerge';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import type { UserConfig } from 'vite';

export const watchOption = IS_DEV
  ? {
      chokidar: {
        awaitWriteFinish: true,
      },
    }
  : undefined;

export interface WithPageConfigOptions {
  /** Exclude watchRebuildPlugin (useful for content scripts with custom HMR) */
  excludeWatchRebuildPlugin?: boolean;
}

export const withPageConfig = (config: UserConfig, options?: WithPageConfigOptions) => {
  const { excludeWatchRebuildPlugin = false } = options || {};
  
  return defineConfig(
    deepmerge(
      {
        define: {
          'process.env': env,
        },
        base: '',
        plugins: [
          react(), 
          IS_DEV && !excludeWatchRebuildPlugin && watchRebuildPlugin({ refresh: true }), 
          nodePolyfills()
        ].filter(Boolean),
        build: {
          sourcemap: IS_DEV,
          minify: IS_PROD,
          reportCompressedSize: IS_PROD,
          emptyOutDir: IS_PROD,
          watch: watchOption,
          rollupOptions: {
            external: ['chrome'],
          },
        },
      },
      config,
    ),
  );
};
