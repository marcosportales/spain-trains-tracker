import { defineConfig } from '@playwright/test';

/**
 * Live e2e: no mocks, against an already running `pnpm dev:all` (web on `WEB_PORT`, default 3000).
 * Kept apart from `playwright.config.ts` so the default `pnpm test` never depends on live data.
 */
const baseURL = `http://localhost:${process.env.WEB_PORT ?? '3000'}`;

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.live.ts',
  reporter: 'list',
  use: { baseURL, locale: 'es', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
