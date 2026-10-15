import { expect, test } from '@playwright/test';

/**
 * The recruiter demo path: one-click login → role dashboards → ticket
 * detail → conversation. Proves the whole stack (UI ↔ API ↔ DB) end-to-end.
 */

test('landing page offers one-click demo logins', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Customer support, the full-stack way/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Try as Agent/i })).toBeVisible();
});

test('customer: demo login → see tickets → open detail → reply', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Try as Customer/i }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole('link', { name: 'My tickets' })).toBeVisible();

  await page.getByRole('link', { name: 'My tickets' }).click();
  await expect(page).toHaveURL(/\/tickets$/);

  const firstTicket = page.locator('table tbody tr td a').first();
  await firstTicket.click();
  await expect(page).toHaveURL(/\/tickets\/[\w-]+/);

  const reply = 'Playwright e2e reply';
  await page.getByPlaceholder(/Type your message/i).fill(reply);
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText(reply)).toBeVisible();
});

test('agent: queue shows grouped sections + priority cards', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('agent@helpdesk.dev');
  await page.getByLabel(/password/i).fill('Demo!Passw0rd');
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole('link', { name: 'Requests' }).click();
  await expect(page.getByText('Support requests')).toBeVisible();
  await expect(page.getByText(/Assigned, in progress|New/).first()).toBeVisible();
});

test('admin: reaches analytics + audit log', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('admin@helpdesk.dev');
  await page.getByLabel(/password/i).fill('Demo!Passw0rd');
  await page.getByRole('button', { name: /sign in/i }).click();

  await page.getByRole('link', { name: 'Analytics' }).click();
  await expect(page.getByText(/Agent workload|By priority/).first()).toBeVisible();

  await page.getByRole('link', { name: 'Audit log' }).click();
  await expect(page.getByRole('columnheader', { name: 'Action' })).toBeVisible();
});

test('customer cannot reach admin routes (client-side guard)', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('customer@helpdesk.dev');
  await page.getByLabel(/password/i).fill('Demo!Passw0rd');
  await page.getByRole('button', { name: /sign in/i }).click();

  await page.goto('/admin/users');
  await expect(page).not.toHaveURL(/\/admin\/users/); // RoleGuard redirects
});
