import {
  at,
  bottle,
  breast,
  compactText,
  expect,
  freezeClockAt,
  makeBaby,
  seed,
  test,
  type Entry,
} from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Dataset (NOW = Mon 5 Oct 2026 14:00):
 * - "current" week  28 Sep – 4 Oct: breast 10′ at 02/10/18 h + bottle 100 ml at 06/14/22 h
 *   → 6 feeds/day, 300 ml/day, 30 min/day, feeds every 4 h exactly.
 * - "previous" week 21 – 27 Sep: breast 8′ at 02/10/18 h + bottle 120 ml at 06/14 h
 *   → 5 feeds/day, 240 ml/day, 24 min/day; gaps 4 h ×4 + 8 h overnight.
 * - today: 2 entries that must be EXCLUDED from all averages.
 */
function dataset(): Entry[] {
  const out: Entry[] = [];
  const day = (d: Date) => d.toISOString().slice(0, 10);
  for (let i = 0; i < 14; i++) {
    const date = day(new Date(Date.UTC(2026, 8, 21 + i)));
    const current = i >= 7;
    for (const h of ['02', '10', '18']) out.push(breast('b1', at(`${date}T${h}:00`), [['right', current ? 10 : 8]]));
    for (const h of current ? ['06', '14', '22'] : ['06', '14']) out.push(bottle('b1', at(`${date}T${h}:00`), current ? 100 : 120));
  }
  out.push(bottle('b1', at('2026-10-05T06:00'), 240), breast('b1', at('2026-10-05T09:00'), [['left', 50]]));
  return out;
}

/** Visible delta text (screen-reader-only context removed). */
async function visibleDelta(page: Page, label: string): Promise<string> {
  const d = tile(page, label).locator('.stat__delta');
  return d.evaluate((el) => {
    const c = el.cloneNode(true);
    if (!(c instanceof HTMLElement)) return '';
    c.querySelectorAll('.visually-hidden').forEach((n) => n.remove());
    return c.textContent.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim();
  });
}

const tile = (page: Page, label: string) =>
  page.locator('.stat').filter({ has: page.locator('.stat__label', { hasText: label }) });

test.describe('stats', () => {
  test.beforeEach(async ({ page }) => {
    await freezeClockAt(page);
  });

  test('empty state with under 2 days of data', async ({ page }) => {
    await seed(page, { babies: [makeBaby({ id: 'b1' })], entries: [bottle('b1', at('2026-10-05T08:00'), 90)] });
    await page.goto('/#/stats');
    await expect(page.getByText('אין עדיין מספיק נתונים')).toBeVisible();
    await expect(page.getByText('אחרי כמה ימים של רישום יופיעו כאן מגמות.')).toBeVisible();
  });

  test('7-day averages (complete days only) and deltas vs the previous week', async ({ page }) => {
    await seed(page, { babies: [makeBaby({ id: 'b1', birthDate: '2026-08-01' })], entries: dataset() });
    await page.goto('/#/stats');
    const range = page.getByRole('radiogroup', { name: 'טווח' });
    await expect(range.getByRole('radio', { name: '7 ימים' })).toHaveAttribute('aria-checked', 'true');

    expect(await compactText(tile(page, 'האכלות ביום').locator('.stat__value'))).toBe('6');
    expect(await compactText(tile(page, 'בקבוק ביום').locator('.stat__value'))).toBe('300מ״ל');
    expect(await compactText(tile(page, 'הנקה ביום').locator('.stat__value'))).toBe('30ד׳');
    expect(await compactText(tile(page, 'מרווח ממוצע').locator('.stat__value'))).toBe('4:00שע׳');

    expect(await visibleDelta(page, 'האכלות ביום')).toBe('+1');
    expect(await visibleDelta(page, 'בקבוק ביום')).toBe('+60 מ״ל');
    expect(await visibleDelta(page, 'הנקה ביום')).toBe('+6 ד׳');
    // previous: 160 h / 34 gaps = 4:42:21 → current 4:00 is 42 min shorter.
    expect(await visibleDelta(page, 'מרווח ממוצע')).toBe('−42 ד׳');
    // Screen readers hear the period; sighted users get one caption.
    await expect(tile(page, 'בקבוק ביום').locator('.stat__delta')).toContainText('לעומת 7 הימים הקודמים');
    await expect(page.getByText('ממוצע יומי · השינוי לעומת 7 הימים הקודמים')).toBeVisible();

    // Charts, with today's bar labelled.
    await expect(page.getByRole('heading', { name: 'האכלות לפי יום' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'כמות בקבוק יומית' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'זמן הנקה יומי' })).toBeVisible();
    const feedsChart = page.locator('section.card').filter({ has: page.getByRole('heading', { name: 'האכלות לפי יום' }) });
    await expect(feedsChart.locator('svg text').filter({ hasText: /^היום$/ }).first()).toBeVisible();
    await expect(page.getByText('הממוצעים מחושבים על ימים מלאים בלבד, ללא היום.')).toBeVisible();
    // Mixed feeding → no guideline band.
    await expect(page.getByText('טווח מומלץ (בקבוק בלבד)')).toHaveCount(0);
  });

  test('14 and 30 days: averages only over days since the first entry; no delta without a previous period', async ({ page }) => {
    await seed(page, { babies: [makeBaby({ id: 'b1', birthDate: '2026-08-01' })], entries: dataset() });
    await page.goto('/#/stats');
    const range = page.getByRole('radiogroup', { name: 'טווח' });
    for (const r of ['14 ימים', '30 ימים']) {
      await range.getByRole('radio', { name: r }).click();
      await expect(range.getByRole('radio', { name: r })).toHaveAttribute('aria-checked', 'true');
      expect(await compactText(tile(page, 'האכלות ביום').locator('.stat__value'))).toBe('5.5');
      expect(await compactText(tile(page, 'בקבוק ביום').locator('.stat__value'))).toBe('270מ״ל');
      expect(await compactText(tile(page, 'הנקה ביום').locator('.stat__value'))).toBe('27ד׳');
      // 332 h / 76 gaps = 4 h 22 min.
      expect(await compactText(tile(page, 'מרווח ממוצע').locator('.stat__value'))).toBe('4:22שע׳');
      await expect(tile(page, 'האכלות ביום').locator('.stat__delta')).toHaveCount(0);
      await expect(tile(page, 'האכלות ביום').locator('.stat__sub')).toHaveText('ממוצע יומי');
    }
  });

  test('oz unit is used for bottle averages', async ({ page }) => {
    await seed(page, { babies: [makeBaby({ id: 'b1', birthDate: '2026-08-01' })], entries: dataset(), settings: { volumeUnit: 'oz' } });
    await page.goto('/#/stats');
    // 300 ml = 10.1 oz; previous 240 ml = 8.1 oz.
    expect(await compactText(tile(page, 'בקבוק ביום').locator('.stat__value'))).toBe('10.1oz');
    expect(await visibleDelta(page, 'בקבוק ביום')).toBe('+2 oz');
  });

  test('bottle-only baby with a weight gets the guideline band and disclaimer', async ({ page }) => {
    const entries: Entry[] = [];
    for (const d of ['01', '02', '03', '04']) for (const h of ['02', '06', '10', '14', '18', '22']) entries.push(bottle('b1', at(`2026-10-${d}T${h}:00`), 110));
    await seed(page, {
      babies: [makeBaby({ id: 'b1', birthDate: '2026-08-01', birthWeightG: 3300 })],
      measurements: [{ id: 'm', babyId: 'b1', date: '2026-10-01', weightG: 4500 }],
      entries,
    });
    await page.goto('/#/stats');
    await expect(page.getByText('טווח מומלץ (בקבוק בלבד)')).toBeVisible();
    await expect(page.locator('section.card').filter({ hasText: 'כמות בקבוק יומית' })).toContainText('אינו תחליף לייעוץ רפואי');
    await expect(page.getByRole('heading', { name: 'זמן הנקה יומי' })).toHaveCount(0);
  });

  // Regression for BUG-003 (fixed during QA): zero change used to show a "trending up" icon.
  test('a zero change is shown as neutral, not as an upward trend', async ({ page }) => {
    const entries: Entry[] = [];
    for (let i = 0; i < 14; i++) {
      const date = new Date(Date.UTC(2026, 8, 21 + i)).toISOString().slice(0, 10);
      entries.push(bottle('b1', at(`${date}T08:00`), 100), bottle('b1', at(`${date}T16:00`), 100));
    }
    await seed(page, { babies: [makeBaby({ id: 'b1', birthDate: '2026-04-01' })], entries });
    await page.goto('/#/stats');
    const delta = tile(page, 'האכלות ביום').locator('.stat__delta');
    expect(await visibleDelta(page, 'האכלות ביום')).toBe('ללא שינוי');
    await expect(delta.locator('svg')).toHaveCount(0);
  });
});
