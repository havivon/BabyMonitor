import {
  at,
  bottle,
  breast,
  dialog,
  DAY,
  expect,
  freezeClockAt,
  HOUR,
  makeBaby,
  MIN,
  NOW,
  readStore,
  seed,
  solid,
  test,
  text,
  timelineItems,
  type Entry,
} from './fixtures';

const baby = makeBaby({ id: 'b1', birthDate: '2026-04-01' });

test.describe('history', () => {
  test('empty state', async ({ page }) => {
    await freezeClockAt(page);
    await seed(page, { babies: [baby] });
    await page.goto('/#/history');
    await expect(page.getByText('אין עדיין רישומים')).toBeVisible();
    await expect(page.getByText('האכלות שיירשמו יופיעו כאן, מסודרות לפי ימים.')).toBeVisible();
  });

  test('groups by local day (newest first), a midnight-crossing feed belongs to its start day', async ({ page }) => {
    await freezeClockAt(page);
    await seed(page, {
      babies: [baby],
      entries: [
        bottle('b1', at('2026-10-05T00:10'), 120),
        breast('b1', at('2026-10-04T23:50'), [['right', 15], ['left', 10]]), // ends 00:15 on the 5th
        bottle('b1', at('2026-10-04T08:00'), 90),
        solid('b1', at('2026-10-04T12:00'), ['בטטה']),
        bottle('b1', at('2026-10-03T09:00'), 60),
        bottle('b1', at('2026-09-28T09:00'), 60),
      ],
    });
    await page.goto('/#/history');
    const days = page.locator('.timeline__day');
    await expect(days).toHaveCount(4);
    const titles = await days.locator('.day-header__title').allTextContents();
    expect(titles.map((t) => t.replace(/\s+/g, ' ').trim())).toEqual([
      'היום · יום ב׳, 5 באוקטובר',
      'אתמול · יום א׳, 4 באוקטובר',
      'שבת, 3 באוקטובר',
      'יום ב׳, 28 בספטמבר',
    ]);
    expect(await text(days.nth(0).locator('.day-header__summary'))).toBe('האכלה אחת · 120 מ״ל');
    expect(await text(days.nth(1).locator('.day-header__summary'))).toBe('2 האכלות · 90 מ״ל · 25 ד׳ הנקה');
    // Order inside a day: newest first.
    await expect(days.nth(1).locator('.timeline-item__time')).toHaveText(['23:50', '12:00', '08:00']);
    await expect(days.nth(1).locator('.timeline-item--breast')).toContainText('ימין 15 ד׳ · שמאל 10 ד׳');
  });

  test('a live feed started before midnight and finished after it is filed under the start day', async ({ page }) => {
    await freezeClockAt(page, at('2026-10-05T23:50'));
    await seed(page, { babies: [baby] });
    await page.goto('/');
    await page.getByRole('button', { name: 'התחלת הנקה' }).click();
    const sheet = dialog(page, 'הנקה');
    await sheet.locator('.side-btn').first().click();
    await page.clock.fastForward(20 * MIN);
    await sheet.getByRole('button', { name: 'סיום ושמירה' }).click();
    await expect(sheet).toBeHidden();
    await page.goto('/#/history');
    const day = page.locator('.timeline__day').first();
    await expect(day.locator('.day-header__title')).toContainText('אתמול');
    await expect(day.locator('.day-header__title')).toContainText('5 באוקטובר');
    await expect(day.locator('.timeline-item__time')).toHaveText('23:50');
    await expect(day.locator('.timeline-item__value')).toHaveText('20 ד׳');
  });

  test('filters by type; empty filter state offers "הצגת הכול"', async ({ page }) => {
    await freezeClockAt(page);
    await seed(page, {
      babies: [baby],
      entries: [
        bottle('b1', NOW - 1 * HOUR, 100),
        bottle('b1', NOW - 2 * HOUR, 80),
        breast('b1', NOW - 3 * HOUR, [['left', 12]]),
      ],
    });
    await page.goto('/#/history');
    const filters = page.getByRole('radiogroup', { name: 'סינון לפי סוג' });
    await expect(filters.getByRole('radio', { name: 'הכול' })).toHaveAttribute('aria-checked', 'true');
    await expect(timelineItems(page)).toHaveCount(3);

    await filters.getByRole('radio', { name: 'בקבוק' }).click();
    await expect(timelineItems(page)).toHaveCount(2);
    await expect(page.locator('.timeline-item--breast')).toHaveCount(0);
    expect(await text(page.locator('.day-header__summary').first())).toBe('2 האכלות · 180 מ״ל');

    await filters.getByRole('radio', { name: 'הנקה' }).click();
    await expect(timelineItems(page)).toHaveCount(1);
    expect(await text(page.locator('.day-header__summary').first())).toBe('האכלה אחת · 12 ד׳ הנקה');

    await filters.getByRole('radio', { name: 'מוצקים' }).click();
    await expect(page.getByText('אין רישומי מוצקים להצגה')).toBeVisible();
    await page.getByRole('button', { name: 'הצגת הכול' }).click();
    await expect(timelineItems(page)).toHaveCount(3);
    await expect(filters.getByRole('radio', { name: 'הכול' })).toHaveAttribute('aria-checked', 'true');
  });

  test('renders 14 days at a time and loads more on demand', async ({ page }) => {
    await freezeClockAt(page);
    const entries: Entry[] = [];
    for (let d = 0; d < 30; d++) {
      for (let i = 0; i < 6; i++) entries.push(bottle('b1', NOW - d * DAY - i * 3 * HOUR - 10 * MIN, 60));
    }
    await seed(page, { babies: [baby], entries });
    await page.goto('/#/history');
    const days = page.locator('.timeline__day');
    await expect(days).toHaveCount(14);
    const more = page.getByRole('button', { name: 'הצגת ימים נוספים' });
    await more.click();
    await expect(days).toHaveCount(28);
    await more.scrollIntoViewIfNeeded(); // infinite scroll also triggers it
    await expect(days).toHaveCount(31); // 30 days back + today's partial day boundary
    await expect(more).toHaveCount(0);
    expect(await timelineItems(page).count()).toBe(180);
  });

  test('tap an item opens its edit sheet; delete there and undo', async ({ page }) => {
    await freezeClockAt(page);
    await seed(page, { babies: [baby], entries: [breast('b1', NOW - HOUR, [['right', 10], ['left', 7]], { id: 'x1' })] });
    await page.goto('/#/history');
    await timelineItems(page).first().click();
    const sheet = dialog(page, 'עריכת האכלה');
    await expect(sheet.getByLabel('ימין (דקות)').first()).toHaveValue('10');
    await expect(sheet.getByLabel('שמאל (דקות)').first()).toHaveValue('7');
    // Change a side's minutes: segments are rebuilt sequentially, start unchanged.
    await sheet.getByLabel('שמאל (דקות)').first().fill('9');
    await sheet.getByRole('button', { name: 'שמירה' }).click();
    await expect(sheet).toBeHidden();
    await expect(timelineItems(page).first()).toContainText('ימין 10 ד׳ · שמאל 9 ד׳');
    const e = (await readStore(page)).entries[0] as Extract<Entry, { type: 'breast' }>;
    expect(e.startedAt).toBe(NOW - HOUR);
    expect(e.endedAt).toBe(NOW - HOUR + 19 * MIN);
  });
});

test.describe('DST (Israel, clocks go back 25 Oct 2026 02:00 → 01:00)', () => {
  test('entries around the change are grouped and timed correctly', async ({ page }) => {
    await freezeClockAt(page, at('2026-10-25T12:00', '+02:00'));
    const start = at('2026-10-25T01:40', '+03:00'); // before the change
    await seed(page, {
      babies: [baby],
      entries: [
        // 30 real minutes: 01:40 IDT → 01:10 IST
        breast('b1', start, [['right', 30]]),
        bottle('b1', at('2026-10-25T00:30', '+03:00'), 100),
        bottle('b1', at('2026-10-25T03:00', '+02:00'), 110),
        bottle('b1', at('2026-10-24T23:30', '+03:00'), 90),
      ],
    });
    await page.goto('/#/history');
    const days = page.locator('.timeline__day');
    await expect(days).toHaveCount(2);
    await expect(days.nth(0).locator('.timeline-item__time')).toHaveText(['03:00', '01:40', '00:30']);
    await expect(days.nth(0).locator('.timeline-item--breast .timeline-item__value')).toHaveText('30 ד׳');
    expect(await text(days.nth(0).locator('.day-header__summary'))).toBe('3 האכלות · 210 מ״ל · 30 ד׳ הנקה');
    await expect(days.nth(1).locator('.timeline-item__time')).toHaveText(['23:30']);
  });
});
