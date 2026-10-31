import swc from 'unplugin-swc';
import { defineProject } from 'vitest/config';

export default defineProject({
  // esbuild does not emit decorator metadata; SWC does, which Nest DI relies on.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    name: 'api',
    include: ['src/**/*.test.ts'],
  },
});
