import { test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

/**
 * Not a test — generates the README screenshots. Run against the seeded
 * dev stack:  npx playwright test e2e/screenshots.spec.ts
 */
const OUT = 'docs/screenshots';

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill('Demo!Passw0rd');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard/);
}

test.beforeAll(async () => mkdir(OUT, { recursive: true }));

test('capture screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto('/');
  await page.screenshot({ path: `${OUT}/01-landing.png` });

  // Agent: queue + detail + dashboard
  await login(page, 'agent@helpdesk.dev');
  await page.screenshot({ path: `${OUT}/02-dashboard-agent.png` });
  await page.getByRole('link', { name: 'Requests' }).click();
  await page.waitForSelector('table');
  await page.screenshot({ path: `${OUT}/03-queue.png` });
  await page.locator('table tbody tr td a').first().click();
  await page.waitForSelector('textarea');
  await page.screenshot({ path: `${OUT}/04-ticket-detail.png` });

  // Admin: analytics + users
  await login(page, 'admin@helpdesk.dev');
  await page.getByRole('link', { name: 'Analytics' }).click();
  await page.waitForSelector('svg.recharts-surface, table');
  await page.screenshot({ path: `${OUT}/05-analytics.png` });
  await page.getByRole('link', { name: 'Users' }).click();
  await page.waitForSelector('table');
  await page.screenshot({ path: `${OUT}/06-users.png` });

  // Customer view
  await login(page, 'customer@helpdesk.dev');
  await page.screenshot({ path: `${OUT}/07-dashboard-customer.png` });
});
