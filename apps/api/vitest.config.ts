import { defineConfig } from 'vitest/config';

/**
 * API tests run against the dedicated helpdesk_test database.
 * fileParallelism is off because suites share one DB — sequential files
 * avoid fixture races; within a file tests still run concurrently where safe.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        'postgresql://postgres:postgres@localhost:5432/helpdesk_test',
      SESSION_SECRET: 'test-session-secret-at-least-32-chars-long',
      WEB_ORIGIN: 'http://localhost:5173',
      UPLOAD_DIR: './uploads-test',
    },
  },
});
