import {
  bottle,
  breast,
  dialog,
  expect,
  freezeClockAt,
  gotoTab,
  makeBaby,
  NOW,
  MIN,
  onboard,
  seed,
  test,
  timelineItems,
} from './fixtures';

test.describe('multiple babies', () => {
  test.beforeEach(async ({ page }) => {
    await freezeClockAt(page);
  });

  test('add a second baby from the header switcher, switch back and forth, data stays isolated', async ({ page }) => {
    await page.goto('/');
    await onboard(page, { name: 'נועה', birthDate: '2026-08-01', sex: 'בת' });

    // Log a bottle for baby A.
    await page.getByRole('button', { name: 'הוספת בקבוק' }).click();
    const sheet = dialog(page, 'בקבוק');
    await sheet.getByRole('button', { name: '120 מ״ל' }).click();
    await sheet.getByRole('button', { name: 'שמירה' }).click();
    await expect(sheet).toBeHidden();
    await expect(timelineItems(page)).toHaveCount(1);

    // Add baby B via the switcher.
    await page.getByRole('button', { name: /החלפת ילד\/ה/ }).click();
    const switcher = dialog(page, 'ילדים');
    await switcher.getByRole('button', { name: 'הוספת ילד/ה' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'הוספת ילד/ה' })).toBeVisible();
    await onboard(page, { name: 'איתי', birthDate: '2026-09-15', sex: 'בן' });

    // B is active and has no data.
    await expect(page.getByRole('button', { name: /החלפת ילד\/ה: איתי/ })).toBeVisible();
    await expect(page.getByText('עוד לא נרשמו האכלות')).toBeVisible();
    await gotoTab(page, 'history');
    await expect(page.getByText('אין עדיין רישומים')).toBeVisible();

    // Switch back to A — A's bottle is there.
    await gotoTab(page, 'home');
    await page.getByRole('button', { name: /החלפת ילד\/ה/ }).click();
    await expect(switcher.getByRole('radio', { name: /איתי/ })).toHaveAttribute('aria-checked', 'true');
    await switcher.getByRole('radio', { name: /נועה/ }).click();
    await expect(switcher).toBeHidden();
    await expect(page.getByRole('button', { name: /החלפת ילד\/ה: נועה/ })).toBeVisible();
    await expect(timelineItems(page)).toHaveCount(1);
    await expect(timelineItems(page).first()).toContainText('120');
  });

  test('history, stats and growth only show the active baby', async ({ page }) => {
    const a = makeBaby({ id: 'a', name: 'נועה', birthWeightG: 3300 });
    const b = makeBaby({ id: 'b', name: 'איתי', sex: 'male', birthDate: '2026-09-15', birthWeightG: 3600 });
    await seed(page, {
      babies: [a, b],
      entries: [
        bottle('a', NOW - 60 * MIN, 90),
        bottle('a', NOW - 26 * 60 * MIN, 100),
        breast('b', NOW - 30 * MIN, [['left', 7]]),
      ],
      measurements: [{ id: 'mb', babyId: 'b', date: '2026-10-01', weightG: 4200 }],
      settings: { activeBabyId: 'b' },
    });
    await page.goto('/#/history');
    await expect(timelineItems(page)).toHaveCount(1);
    await expect(timelineItems(page).first()).toContainText('הנקה');
    await gotoTab(page, 'growth');
    await expect(page.getByRole('button', { name: /עריכת מדידה מ-1 באוקטובר 2026/ })).toBeVisible();
    await expect(page.getByText('בנים · ')).toBeVisible();

    await gotoTab(page, 'settings');
    await page.getByRole('button', { name: 'בחירת נועה' }).click();
    await gotoTab(page, 'history');
    await expect(timelineItems(page)).toHaveCount(2);
    await expect(page.locator('.timeline-item--breast')).toHaveCount(0);
    await gotoTab(page, 'growth');
    await expect(page.getByRole('button', { name: /עריכת מדידה/ })).toHaveCount(0);
    await expect(page.getByText('בנות · ')).toBeVisible();
  });

  test('a running timer belongs to its baby and is not shown for another baby', async ({ page }) => {
    const a = makeBaby({ id: 'a', name: 'נועה' });
    const b = makeBaby({ id: 'b', name: 'איתי', sex: 'male' });
    await seed(page, {
      babies: [a, b],
      activeTimers: { a: { babyId: 'a', segments: [{ side: 'right', startedAt: NOW - 5 * MIN }] } },
      settings: { activeBabyId: 'a' },
    });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'פתיחת טיימר ההנקה' })).toBeVisible();
    await page.getByRole('button', { name: /החלפת ילד\/ה/ }).click();
    const switcher = dialog(page, 'ילדים');
    // The switcher marks the feeding baby.
    await expect(switcher.getByRole('radio', { name: /נועה/ })).toContainText('הנקה');
    await switcher.getByRole('radio', { name: /איתי/ }).click();
    // B can start its own feed; A's timer is untouched.
    await page.getByRole('button', { name: 'התחלת הנקה' }).click();
    const sheet = dialog(page, 'הנקה');
    await expect(sheet.getByText('בחירת צד להתחלה')).toBeVisible();
    await sheet.getByRole('button', { name: /^שמאל/ }).click();
    await sheet.getByRole('button', { name: /מזעור/ }).click();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('babymonitor:v1') ?? '{}'));
    expect(Object.keys(stored.state.activeTimers).sort()).toEqual(['a', 'b']);
    expect(stored.state.activeTimers.a.segments).toEqual([{ side: 'right', startedAt: NOW - 5 * MIN }]);
  });

  test('deleting a baby (with confirmation) removes only its data', async ({ page }) => {
    const a = makeBaby({ id: 'a', name: 'נועה' });
    const b = makeBaby({ id: 'b', name: 'איתי', sex: 'male' });
    await seed(page, {
      babies: [a, b],
      entries: [bottle('a', NOW - 60 * MIN, 90), bottle('b', NOW - 60 * MIN, 150)],
      settings: { activeBabyId: 'b' },
    });
    await page.goto('/#/settings');
    await page.getByRole('button', { name: 'עריכת הפרטים של איתי' }).click();
    await page.getByRole('button', { name: 'מחיקת איתי' }).click();
    const confirm = page.getByRole('alertdialog', { name: 'למחוק את איתי?' });
    await expect(confirm.getByRole('button', { name: 'ביטול' })).toBeFocused();
    await confirm.getByRole('button', { name: 'מחיקת איתי' }).click();
    await expect(page.getByRole('button', { name: 'עריכת הפרטים של איתי' })).toHaveCount(0);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('babymonitor:v1') ?? '{}'));
    expect(stored.state.babies.map((x: { id: string }) => x.id)).toEqual(['a']);
    expect(stored.state.entries.map((x: { babyId: string }) => x.babyId)).toEqual(['a']);
    expect(stored.state.settings.activeBabyId).toBe('a');
  });
});
