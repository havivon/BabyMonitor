import { expect, freezeClockAt, makeBaby, seed, test } from './fixtures';

test.describe('PWA', () => {
  test('manifest is linked, valid, Hebrew RTL, with fetchable PNG icons of the declared sizes', async ({ page, request }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBeTruthy();
    const res = await request.get(new URL(href ?? '', page.url()).toString());
    expect(res.ok()).toBe(true);
    const m = (await res.json()) as Record<string, unknown> & { icons: { src: string; sizes: string; type: string; purpose?: string }[] };
    expect(m).toMatchObject({ lang: 'he', dir: 'rtl', display: 'standalone' });
    expect(typeof m.name).toBe('string');
    expect(typeof m.short_name).toBe('string');
    expect(String(m.short_name).length).toBeLessThanOrEqual(12);
    expect(m.start_url).toBeTruthy();
    expect(m.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(m.background_color).toMatch(/^#[0-9a-f]{6}$/i);
    const sizes = m.icons.map((i) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect(m.icons.some((i) => i.purpose?.includes('maskable'))).toBe(true);
    for (const icon of m.icons) {
      const r = await request.get(new URL(icon.src, new URL(href ?? '', page.url())).toString());
      expect(r.ok(), icon.src).toBe(true);
      const buf = await r.body();
      expect(buf.subarray(1, 4).toString('ascii'), icon.src).toBe('PNG');
      const [w, h] = [buf.readUInt32BE(16), buf.readUInt32BE(20)];
      expect(`${w}x${h}`, icon.src).toBe(icon.sizes);
    }
  });

  test('index.html: lang/dir, viewport-fit=cover, theme-color for both schemes, title', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'he');
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/);
    await expect(page.locator('meta[name="theme-color"][media*="light"]')).toHaveAttribute('content', '#f8f5ef');
    await expect(page.locator('meta[name="theme-color"][media*="dark"]')).toHaveAttribute('content', '#141211');
    await expect(page).toHaveTitle(/\S/);
  });

  test('service worker registers and the app loads offline after the first visit', async ({ page, context }) => {
    await freezeClockAt(page);
    await seed(page, { babies: [makeBaby({ id: 'b1', birthWeightG: 3300 })] });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'הוספת בקבוק' })).toBeVisible();
    const sw = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return { state: reg.active?.state, scope: reg.scope };
    });
    expect(sw.state).toBe('activated');
    expect(sw.scope).toBe(new URL('/', page.url()).toString());
    // Make sure the page is controlled, then go offline.
    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('button', { name: 'הוספת בקבוק' })).toBeVisible();
    // Lazy routes and the WHO tables are precached too.
    await page.goto('/#/growth');
    await expect(page.locator('.percentile__value')).toHaveText(/\d/);
    await page.goto('/#/stats');
    await expect(page.getByRole('heading', { name: 'סטטיסטיקה' })).toBeVisible();
    // Fonts are self-hosted (no request leaves the origin).
    const external = await page.evaluate(() =>
      performance.getEntriesByType('resource').map((e) => e.name).filter((n) => !n.startsWith(location.origin)),
    );
    expect(external).toEqual([]);
    await context.setOffline(false);
  });
});
