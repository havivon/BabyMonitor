import { expect, test } from '@playwright/test';

test('app shell loads in Hebrew RTL without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');

  await expect(page).toHaveTitle('מעקב האכלה');
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  // Hash routes resolve.
  await page.goto('/#/settings');
  await expect(page.getByRole('heading', { name: 'הגדרות' })).toBeVisible();

  expect(errors).toEqual([]);
});

test('serves a valid Hebrew web app manifest', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.ok()).toBe(true);
  const manifest = (await res.json()) as Record<string, unknown>;
  expect(manifest).toMatchObject({
    name: 'מעקב האכלה לתינוק',
    short_name: 'מעקב האכלה',
    lang: 'he',
    dir: 'rtl',
    display: 'standalone',
  });
});
