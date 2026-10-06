import {
  at,
  bottle,
  compactText,
  breast,
  DAY,
  expect,
  freezeClockAt,
  makeBaby,
  NOW,
  seed,
  solid,
  test,
  text,
  timelineItems,
  type Entry,
} from './fixtures';
import type { Page } from '@playwright/test';

const stat = (page: Page, label: string) =>
  page.locator('.stat').filter({ has: page.locator('.stat__label', { hasText: label }) });

test.describe('home dashboard', () => {
  test('today totals are exact for a mixed set of entries', async ({ page }) => {
    await freezeClockAt(page);
    await seed(page, {
      babies: [makeBaby({ id: 'b1', birthDate: '2026-08-01' })],
      entries: [
        breast('b1', at('2026-10-05T06:00'), [['right', 12], ['left', 8]]),
        bottle('b1', at('2026-10-05T09:00'), 120, 'formula'),
        breast('b1', at('2026-10-05T11:00'), [['left', 15]]),
        bottle('b1', at('2026-10-05T12:30'), 90, 'breastmilk'),
        solid('b1', at('2026-10-05T13:00'), ['בטטה']),
        // yesterday
        breast('b1', at('2026-10-04T18:00'), [['right', 10]]),
        bottle('b1', at('2026-10-04T22:00'), 150),
        // two days ago — must not count anywhere
        bottle('b1', at('2026-10-03T22:00'), 150),
      ],
    });
    await page.goto('/');

    // Hero: time since the last MILK feed's start (12:30 → 14:00).
    expect(await compactText(page.locator('.since__value'))).toBe('1שע׳30ד׳');
    const meta = await text(page.locator('.since__meta'));
    expect(meta).toContain('בקבוק');
    expect(meta).toContain('90 מ״ל');
    expect(meta).toContain('חלב אם שאוב');
    expect(meta).toContain('12:30');
    await expect(page.getByText('הצד הבא: ימין')).toBeVisible();

    // Tiles.
    await expect(page.getByRole('button', { name: 'התחלת הנקה' })).toContainText('הבא: ימין');
    await expect(page.getByRole('button', { name: 'הוספת בקבוק' })).toContainText('אחרון: 90 מ״ל');
    await expect(page.getByRole('button', { name: 'הוספת מוצקים' })).toContainText('אחרון: 13:00');

    // Today section.
    expect(await compactText(stat(page, 'האכלות').locator('.stat__value'))).toBe('4');
    expect(await text(stat(page, 'האכלות').locator('.stat__sub'))).toBe('אתמול: 2');
    expect(await compactText(stat(page, 'בקבוק').locator('.stat__value'))).toBe('210מ״ל');
    expect(await text(stat(page, 'בקבוק').locator('.stat__sub'))).toBe('2 בקבוקים');
    expect(await compactText(stat(page, 'הנקה').locator('.stat__value'))).toBe('35ד׳');
    expect(await text(stat(page, 'הנקה').locator('.stat__sub'))).toBe('2 הנקות');
    // Starts 06:00, 09:00, 11:00, 12:30 → 6.5 h / 3 gaps = 2:10.
    expect(await compactText(stat(page, 'מרווח ממוצע').locator('.stat__value'))).toBe('2:10שע׳');

    // Recent: last 3, newest first.
    await expect(timelineItems(page)).toHaveCount(3);
    await expect(page.locator('.timeline-item__time')).toHaveText(['13:00', '12:30', '11:00']);

    // Mixed feeding → no bottle ml guideline on Home.
    await expect(page.getByText('כמות בקבוק יומית')).toHaveCount(0);
  });

  test('metrics without data show "—"', async ({ page }) => {
    await freezeClockAt(page);
    await seed(page, { babies: [makeBaby({ id: 'b1' })], entries: [solid('b1', NOW - 60_000 * 30, ['אורז'])] });
    await page.goto('/');
    expect(await compactText(stat(page, 'האכלות').locator('.stat__value'))).toBe('0');
    expect(await compactText(stat(page, 'בקבוק').locator('.stat__value'))).toBe('—');
    expect(await compactText(stat(page, 'הנקה').locator('.stat__value'))).toBe('—');
    expect(await compactText(stat(page, 'מרווח ממוצע').locator('.stat__value'))).toBe('—');
  });

  test('"since last feed" formats: now / minutes / one day / days', async ({ page }) => {
    await freezeClockAt(page);
    await seed(page, { babies: [makeBaby({ id: 'b1' })], entries: [bottle('b1', NOW - 20_000, 60, 'formula', { id: 'x' })] });
    await page.goto('/');
    expect(await text(page.locator('.since__value'))).toBe('עכשיו');
    await page.clock.fastForward('25:00');
    await expect(page.locator('.since__value')).toHaveText(/^25\s*ד׳$/);
    await page.clock.fastForward(DAY);
    await expect(page.locator('.since__value')).toHaveText('יום אחד');
    await page.clock.fastForward(2 * DAY);
    await expect(page.locator('.since__value')).toHaveText(/^3\s*ימים$/);
  });

  test('bottle-fed baby with a weight gets the daily ml guideline', async ({ page }) => {
    await freezeClockAt(page);
    const entries: Entry[] = [];
    for (const day of ['02', '03', '04'])
      for (const h of ['02', '06', '10', '14', '18', '22']) entries.push(bottle('b1', at(`2026-10-${day}T${h}:00`), 100));
    entries.push(bottle('b1', at('2026-10-05T08:00'), 120), bottle('b1', at('2026-10-05T12:00'), 130));
    await seed(page, {
      babies: [makeBaby({ id: 'b1', birthDate: '2026-08-01', birthWeightG: 3300 })],
      measurements: [{ id: 'm', babyId: 'b1', date: '2026-10-01', weightG: 4000 }],
      entries,
    });
    await page.goto('/');
    const card = page.locator('section.card').filter({ hasText: 'כמות בקבוק יומית' });
    await expect(card).toBeVisible();
    await expect(card).toContainText('הנחיה כללית');
    // 4 kg × 120–180 ml/kg = 480–720 ml; today 250 ml; 600 ml / 6 feeds = 100 ml per feed.
    expect(await text(card.locator('.meter__head'))).toContain('250 מ״ל היום');
    expect(await text(card.locator('.meter__head'))).toContain('מומלץ 480–720 מ״ל');
    expect(await text(card)).toContain('כ-100 מ״ל להאכלה (לפי 6 האכלות ביום)');
    await expect(card.locator('.disclaimer')).toContainText('אינו תחליף לייעוץ רפואי');
    await expect(card.getByRole('meter')).toHaveAttribute('aria-valuenow', '250');
  });

  // Israel DST ends 25 Oct 2026 (25-hour day). "Yesterday" must be the previous CALENDAR day,
  // not `now − 24 h` (which at 23:30 on the 25th still falls on the 25th).
  test('"אתמול" count is the previous calendar day on the DST change day (BUG-006)', async ({ page }) => {
    await freezeClockAt(page, at('2026-10-25T23:30', '+02:00'));
    await seed(page, {
      babies: [makeBaby({ id: 'b1' })],
      entries: [
        bottle('b1', at('2026-10-25T10:00', '+02:00'), 100),
        bottle('b1', at('2026-10-24T09:00', '+03:00'), 100),
        bottle('b1', at('2026-10-24T15:00', '+03:00'), 100),
      ],
    });
    await page.goto('/');
    expect(await compactText(stat(page, 'האכלות').locator('.stat__value'))).toBe('1');
    expect(await text(stat(page, 'האכלות').locator('.stat__sub'))).toBe('אתמול: 2');
  });
});
