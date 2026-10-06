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
  // First run: no baby yet → onboarding.
  await expect(
    page.getByRole('heading', { level: 1, name: 'ברוכים הבאים ל-BabyMonitor' }),
  ).toBeVisible();
  await page.getByLabel('שם').fill('נועה');
  await page.getByLabel('תאריך לידה').fill('2026-07-01');
  await page.getByRole('radio', { name: 'בת' }).click();
  await page.getByRole('button', { name: 'התחלה' }).click();
  await expect(page.getByText('עוד לא נרשמו האכלות')).toBeVisible();

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
    name: 'BabyMonitor — מעקב האכלה וגדילה',
    short_name: 'מעקב האכלה',
    lang: 'he',
    dir: 'rtl',
    display: 'standalone',
  });
});
