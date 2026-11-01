import swc from 'unplugin-swc';
import { defineProject } from 'vitest/config';

// DATABASE_URL lives in the repo-root `.env` (see `.env.example`). Load it so tests use the
// same database as `pnpm db:up`, e.g. on 5433 when another Postgres holds 5432.
// Variables already set in the shell win over the file.
try {
  process.loadEnvFile(new URL('../../.env', import.meta.url));
} catch {
  // No .env: fall back to the defaults.
}

export default defineProject({
  // esbuild does not emit decorator metadata; SWC does, which Nest DI relies on.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    name: 'api',
    include: ['src/**/*.test.ts'],
  },
});
