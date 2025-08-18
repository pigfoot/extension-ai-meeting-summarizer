import sucrase from '@rollup/plugin-sucrase';
import type { Plugin, RollupOptions } from 'rollup';

const plugins = [
  sucrase({
    exclude: ['node_modules/**'],
    transforms: ['typescript'],
  }),
] satisfies Plugin[];

export default [
  {
    plugins,
    input: 'lib/injections/reload.ts',
    output: {
      format: 'esm',
      file: 'dist/lib/injections/reload.js',
    },
  },
  // DISABLED: refresh.js build interferes with Chrome extension messaging
  // {
  //   plugins,
  //   input: 'lib/injections/refresh.ts',
  //   output: {
  //     format: 'esm',
  //     file: 'dist/lib/injections/refresh.js',
  //   },
  // },
] satisfies RollupOptions[];
