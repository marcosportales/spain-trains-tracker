import { defineConfig } from '@playwright/test';
import { MOCK_API_PORT, WEB_PORT } from './e2e/fixtures.js';

const baseURL = `http://localhost:${WEB_PORT}`;

/**
 * The web app against a mock API serving fixtures (`e2e/mock-api.ts`), so the smoke test needs
 * neither Postgres nor the worker. `NEXT_PUBLIC_API_URL` is inlined at build time.
 */
export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL, locale: 'en', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: `pnpm build && pnpm start --port ${WEB_PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      NEXT_PUBLIC_API_URL: `http://localhost:${MOCK_API_PORT}`,
      NEXT_PUBLIC_SITE_URL: baseURL,
    },
  },
});
