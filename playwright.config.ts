import { defineConfig } from '@playwright/test';

/**
 * E2E runs against the real dev stack — web on :5173 proxying the API on
 * :4000, backed by the local seeded `helpdesk` DB. Start servers first:
 *   npm run dev:api & npm run dev:web
 * then: npx playwright test
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
