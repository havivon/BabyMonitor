import {
  alertDialog,
  breast,
  dialog,
  expect,
  expectApprox,
  mmss,
  freezeClockAt,
  gotoTab,
  makeBaby,
  MIN,
  HOUR,
  NOW,
  readStore,
  seed,
  test,
  timelineItems,
  toast,
} from './fixtures';
import type { Page } from '@playwright/test';

const baby = makeBaby({ id: 'b1', name: 'נועה' });

async function openTimer(page: Page) {
  await page.getByRole('button', { name: /התחלת הנקה|הנקה פעילה/ }).click();
  const sheet = dialog(page, /^הנקה/);
  await expect(sheet).toBeVisible();
  return sheet;
}
const side = (sheet: ReturnType<typeof dialog>, name: 'ימין' | 'שמאל') =>
  sheet.locator('.side-btn').filter({ has: sheet.page().locator('.side-btn__label', { hasText: name }) });

test.describe('breastfeeding timer', () => {
  test.beforeEach(async ({ page }) => {
    await freezeClockAt(page);
    await seed(page, { babies: [baby] });
  });

  test('right → left → pause → resume → finish saves exact per-side durations; next side suggested', async ({ page }) => {
    await page.goto('/');
    const sheet = await openTimer(page);
    await expect(sheet.getByText('בחירת צד להתחלה')).toBeVisible();
    await expect(sheet.getByRole('timer')).toHaveText(mmss(0));

    await side(sheet, 'ימין').click();
    await expect(side(sheet, 'ימין')).toHaveAttribute('aria-pressed', 'true');
    await expect(sheet.getByText(/פועל · התחילה ב-/)).toContainText('14:00');
    await page.clock.fastForward(5 * MIN);
    await expect(sheet.getByRole('timer')).toHaveText(mmss(5));

    await side(sheet, 'שמאל').click(); // switch
    await expect(side(sheet, 'שמאל')).toHaveAttribute('aria-pressed', 'true');
    await expect(side(sheet, 'ימין')).toHaveAttribute('aria-pressed', 'false');
    await page.clock.fastForward(3 * MIN);
    await expect(sheet.getByRole('timer')).toHaveText(mmss(8));

    await sheet.getByRole('button', { name: 'השהיה', exact: true }).click();
    await expect(sheet.getByText('מושהה', { exact: true })).toBeVisible();
    await page.clock.fastForward(2 * MIN); // paused time is not counted
    await expect(sheet.getByRole('timer')).toHaveText(mmss(8));

    await sheet.getByRole('button', { name: 'המשך', exact: true }).click();
    await page.clock.fastForward(1 * MIN);
    await expect(sheet.getByRole('timer')).toHaveText(mmss(9));
    await expect(sheet.locator('.timer__breakdown')).toContainText(/ימין 05:0\d/);
    await expect(sheet.locator('.timer__breakdown')).toContainText(/שמאל 04:0\d/);

    await sheet.getByRole('button', { name: 'סיום ושמירה' }).click();
    await expect(sheet).toBeHidden();
    await expect(toast(page)).toContainText('ההנקה נשמרה · 9 ד׳');

    // Entry has the exact segments.
    const { entries, activeTimers } = await readStore(page);
    expect(activeTimers).toEqual({});
    expect(entries).toHaveLength(1);
    const e = entries[0] as Extract<(typeof entries)[number], { type: 'breast' }>;
    expect(e.type).toBe('breast');
    expectApprox(e.startedAt, NOW);
    expectApprox(e.endedAt - e.startedAt, 11 * MIN);
    const dur = (s: 'left' | 'right') =>
      e.segments.filter((x) => x.side === s).reduce((t, x) => t + x.endedAt - x.startedAt, 0);
    expectApprox(dur('right'), 5 * MIN, 5000);
    expectApprox(dur('left'), 4 * MIN, 5000);

    // History shows per-side minutes; Home suggests the other side (finished on left → right).
    await gotoTab(page, 'history');
    const item = timelineItems(page).first();
    await expect(item).toContainText('ימין 5 ד׳ · שמאל 4 ד׳');
    await expect(item.locator('.timeline-item__value')).toHaveText('9 ד׳');
    await expect(item.locator('.timeline-item__time')).toHaveText('14:00');
  });

  test('undo after finishing restores the running timer and removes the entry', async ({ page }) => {
    await page.goto('/');
    const sheet = await openTimer(page);
    await side(sheet, 'שמאל').click();
    await page.clock.fastForward(4 * MIN);
    await sheet.getByRole('button', { name: 'סיום ושמירה' }).click();
    await toast(page).getByRole('button', { name: 'בטל' }).click();
    await expect(page.getByRole('button', { name: 'פתיחת טיימר ההנקה', exact: true })).toBeVisible();
    const { entries, activeTimers } = await readStore(page);
    expect(entries).toHaveLength(0);
    expect(activeTimers.b1?.segments[0]?.side).toBe('left');
    expectApprox(activeTimers.b1?.segments[0]?.startedAt ?? 0, NOW);
  });

  test('timer survives reload and keeps counting with the clock', async ({ page }) => {
    await page.goto('/');
    const sheet = await openTimer(page);
    await side(sheet, 'ימין').click();
    await page.clock.fastForward(3 * MIN);
    await sheet.getByRole('button', { name: /מזעור/ }).click();
    const banner = page.getByRole('status').filter({ has: page.getByRole('button', { name: 'פתיחת טיימר ההנקה', exact: true }) });
    await expect(banner).toContainText('הנקה · ימין');
    await expect(banner).toContainText(/03:0\d/);

    await page.reload();
    await expect(banner).toContainText('הנקה · ימין');
    await expect(banner).toContainText('התחילה ב-14:00');
    await page.clock.fastForward(10 * MIN);
    await expect(banner).toContainText(/13:0\d/);
    // Banner is on every tab.
    await gotoTab(page, 'stats');
    await expect(page.getByRole('button', { name: 'פתיחת טיימר ההנקה', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'פתיחת טיימר ההנקה', exact: true }).click();
    await expect(dialog(page, 'הנקה').getByRole('timer')).toHaveText(mmss(13));
    // Banner hides while the sheet is open.
    await expect(page.getByRole('button', { name: 'פתיחת טיימר ההנקה', exact: true })).toHaveCount(0);
  });

  test('pause / resume from the banner', async ({ page }) => {
    await page.goto('/');
    const sheet = await openTimer(page);
    await side(sheet, 'ימין').click();
    await page.keyboard.press('Escape'); // minimise
    await expect(sheet).toBeHidden();
    await page.clock.fastForward(2 * MIN);
    await page.getByRole('button', { name: 'השהיית ההנקה' }).click();
    await expect(page.getByText('הנקה מושהית · ימין').first()).toBeVisible();
    await page.clock.fastForward(5 * MIN);
    await page.getByRole('button', { name: 'המשך ההנקה' }).click();
    await page.clock.fastForward(1 * MIN);
    await expect(page.locator('.timer-banner__time')).toHaveText(mmss(3));
  });

  test('cancel feed asks for confirmation; undo brings the timer back', async ({ page }) => {
    await page.goto('/');
    const sheet = await openTimer(page);
    await side(sheet, 'ימין').click();
    await page.clock.fastForward(2 * MIN);
    await sheet.getByRole('button', { name: 'ביטול הנקה' }).click();
    const confirm = alertDialog(page, 'לבטל את ההנקה?');
    await expect(confirm).toContainText('הזמן שנמדד לא יישמר.');
    await expect(confirm.getByRole('button', { name: 'חזרה לטיימר' })).toBeFocused();
    await confirm.getByRole('button', { name: 'ביטול ההנקה' }).click();
    await expect(sheet).toBeHidden();
    await expect(toast(page)).toContainText('ההנקה בוטלה');
    expect((await readStore(page)).activeTimers).toEqual({});
    await toast(page).getByRole('button', { name: 'בטל' }).click();
    await expect(page.getByRole('button', { name: 'פתיחת טיימר ההנקה', exact: true })).toBeVisible();
    expect((await readStore(page)).entries).toEqual([]);
  });

  test('finishing a feed under one minute asks first', async ({ page }) => {
    await page.goto('/');
    const sheet = await openTimer(page);
    await side(sheet, 'ימין').click();
    await page.clock.fastForward(20_000);
    await sheet.getByRole('button', { name: 'סיום ושמירה' }).click();
    const confirm = alertDialog(page, 'ההנקה קצרה מדקה. לשמור בכל זאת?');
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'מחיקה' }).click();
    await expect(sheet).toBeHidden();
    expect((await readStore(page)).entries).toEqual([]);
  });

  test('manual entry: validation, then saves the given minutes per side', async ({ page }) => {
    await page.goto('/');
    const sheet = await openTimer(page);
    await sheet.getByRole('button', { name: 'רישום ידני' }).click();
    const manual = dialog(page, 'הנקה · רישום ידני');
    await manual.getByRole('button', { name: 'שמירה' }).click();
    await expect(manual.getByText('יש להזין לפחות צד אחד')).toBeVisible();

    await manual.getByRole('group', { name: 'דקות מהירות (ימין)' }).getByRole('button', { name: '10 ד׳', exact: true }).click();
    await manual.getByRole('group', { name: 'דקות מהירות (שמאל)' }).getByRole('button', { name: '5 ד׳', exact: true }).click();
    await manual.getByRole('button', { name: 'הוספה של דקה (שמאל)' }).click(); // 6
    await expect(manual.getByLabel('שמאל (דקות)').first()).toHaveValue('6');
    // Default start is 30 minutes ago.
    await expect(manual.getByRole('button', { name: 'לפני 30 ד׳' })).toHaveAttribute('aria-pressed', 'true');
    await manual.getByRole('button', { name: 'שמירה' }).click();
    await expect(manual).toBeHidden();
    await expect(toast(page)).toContainText('ההנקה נשמרה · 16 ד׳');

    await gotoTab(page, 'history');
    const item = timelineItems(page).first();
    await expect(item.locator('.timeline-item__time')).toHaveText('13:30');
    await expect(item).toContainText('ימין 10 ד׳ · שמאל 6 ד׳');
    await expect(item.locator('.timeline-item__value')).toHaveText('16 ד׳');
  });

  test('manual entry that would end in the future is rejected', async ({ page }) => {
    await page.goto('/');
    const sheet = await openTimer(page);
    await sheet.getByRole('button', { name: 'רישום ידני' }).click();
    const manual = dialog(page, 'הנקה · רישום ידני');
    await manual.getByRole('button', { name: 'עכשיו' }).click();
    await manual.getByRole('group', { name: 'דקות מהירות (ימין)' }).getByRole('button', { name: '10 ד׳', exact: true }).click();
    await manual.getByRole('button', { name: 'שמירה' }).click();
    await expect(manual.getByText('ההנקה מסתיימת בעתיד — כדאי להקדים את שעת ההתחלה')).toBeVisible();
    expect((await readStore(page)).entries).toEqual([]);
  });

  test('edit start time of a running timer', async ({ page }) => {
    await page.goto('/');
    const sheet = await openTimer(page);
    await side(sheet, 'ימין').click();
    await page.clock.fastForward(1 * MIN);
    await sheet.getByRole('button', { name: 'עריכת שעת התחלה' }).click();
    await sheet.getByRole('button', { name: 'לפני 15 ד׳' }).click();
    await sheet.getByRole('button', { name: 'עדכון' }).click();
    await expect(sheet.getByRole('timer')).toHaveText(mmss(15));
    await expect(sheet.getByText(/פועל · התחילה ב-/)).toContainText('13:46');
  });

  test('editing start time into the future is refused', async ({ page }) => {
    await page.goto('/');
    const sheet = await openTimer(page);
    await side(sheet, 'ימין').click();
    await sheet.getByRole('button', { name: 'עריכת שעת התחלה' }).click();
    await sheet.getByLabel('שעת התחלה').fill('2026-10-05T18:00');
    await sheet.getByRole('button', { name: 'עדכון' }).click();
    await expect(sheet.getByText('שעת ההתחלה צריכה להיות לפני הזמן הנוכחי')).toBeVisible();
  });

  test('a timer running for > 90 minutes shows the "finish?" reminder', async ({ page }) => {
    await page.goto('/');
    const sheet = await openTimer(page);
    await side(sheet, 'ימין').click();
    await page.clock.fastForward(91 * MIN);
    await expect(sheet.getByText('הטיימר פועל כבר שעה וחצי — לסיים?')).toBeVisible();
  });
});

test.describe('next-side rule', () => {
  test('after a timer feed ending on left, Home / tile / timer sheet suggest right', async ({ page }) => {
    await freezeClockAt(page);
    await seed(page, { babies: [baby] });
    await page.goto('/');
    const sheet = await openTimer(page);
    await side(sheet, 'ימין').click();
    await page.clock.fastForward(6 * MIN);
    await side(sheet, 'שמאל').click();
    await page.clock.fastForward(5 * MIN);
    await sheet.getByRole('button', { name: 'סיום ושמירה' }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByText('הצד הבא: ימין')).toBeVisible();
    await expect(page.getByRole('button', { name: 'התחלת הנקה' })).toContainText('הבא: ימין');
    const sheet2 = await openTimer(page);
    await expect(side(sheet2, 'ימין')).toContainText('הבא בתור');
    await expect(side(sheet2, 'שמאל')).not.toContainText('הבא בתור');
    await expect(sheet2.locator('.timer__breakdown')).toContainText('בפעם הקודמת:');
    await expect(sheet2.locator('.timer__breakdown')).toContainText('שמאל');
    await expect(sheet2.locator('.timer__breakdown')).toContainText('11 ד׳');
  });

  // BUG-001: a pause splits the last side into two segments; the "< 2 min = unfinished" rule must
  // look at the whole last-side run (left 3 + 1 = 4 min), not at the post-pause fragment.
  test('pause/resume on the last side does not flip the suggestion (BUG-001)', async ({ page }) => {
    await freezeClockAt(page);
    await seed(page, { babies: [baby] });
    await page.goto('/');
    const sheet = await openTimer(page);
    await side(sheet, 'ימין').click();
    await page.clock.fastForward(5 * MIN);
    await side(sheet, 'שמאל').click();
    await page.clock.fastForward(3 * MIN);
    await sheet.getByRole('button', { name: 'השהיה', exact: true }).click();
    await page.clock.fastForward(2 * MIN);
    await sheet.getByRole('button', { name: 'המשך', exact: true }).click();
    await page.clock.fastForward(1 * MIN);
    await sheet.getByRole('button', { name: 'סיום ושמירה' }).click();
    await expect(sheet).toBeHidden();
    // Finished on the left after 4 minutes on it → next is right.
    await expect(page.getByText('הצד הבא: ימין')).toBeVisible();
  });

  test('a last segment under 2 minutes suggests the same side again', async ({ page }) => {
    await freezeClockAt(page);
    await seed(page, { babies: [baby], entries: [breast('b1', NOW - 2 * HOUR, [['right', 10], ['left', 1]])] });
    await page.goto('/');
    await expect(page.getByText('הצד הבא: שמאל')).toBeVisible();
  });

  test('a single finished side suggests the other side', async ({ page }) => {
    await freezeClockAt(page);
    await seed(page, { babies: [baby], entries: [breast('b1', NOW - 2 * HOUR, [['left', 12]])] });
    await page.goto('/');
    await expect(page.getByText('הצד הבא: ימין')).toBeVisible();
  });
});

test.describe('forgotten (stale) timer', () => {
  test('a timer older than 6 hours asks for the real end time and saves it', async ({ page }) => {
    await freezeClockAt(page);
    await seed(page, {
      babies: [baby],
      activeTimers: { b1: { babyId: 'b1', segments: [{ side: 'left', startedAt: NOW - 7 * HOUR }] } },
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'פתיחת טיימר ההנקה', exact: true }).click();
    const sheet = dialog(page, 'הנקה');
    await expect(sheet.getByText('הטיימר פועל כבר יותר מ-6 שעות')).toBeVisible();
    // Default suggested end = start + 20 min.
    await expect(sheet.getByLabel('שעת סיום')).toHaveValue('2026-10-05T07:20');
    await sheet.getByLabel('שעת סיום').fill('2026-10-05T07:25');
    await sheet.getByRole('button', { name: 'שמירה' }).click();
    await expect(sheet).toBeHidden();
    const { entries, activeTimers } = await readStore(page);
    expect(activeTimers).toEqual({});
    expect(entries[0]).toMatchObject({ type: 'breast', startedAt: NOW - 7 * HOUR, endedAt: NOW - 7 * HOUR + 25 * MIN });
  });

  test('stale end time before the start is rejected', async ({ page }) => {
    await freezeClockAt(page);
    await seed(page, {
      babies: [baby],
      activeTimers: { b1: { babyId: 'b1', segments: [{ side: 'left', startedAt: NOW - 7 * HOUR }] } },
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'פתיחת טיימר ההנקה', exact: true }).click();
    const sheet = dialog(page, 'הנקה');
    await sheet.getByLabel('שעת סיום').fill('2026-10-05T06:00');
    await expect(sheet.getByText('שעת הסיום צריכה להיות אחרי שעת ההתחלה')).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'שמירה' })).toBeDisabled();
  });
});
