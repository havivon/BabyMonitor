import {
  bottle,
  breast,
  dialog,
  expect,
  expectNoUnlabeledControls,
  freezeClockAt,
  makeBaby,
  NOW,
  MIN,
  HOUR,
  ROUTES,
  seed,
  solid,
  test,
  timelineItems,
  type SeedData,
} from './fixtures';
import { eachSheet } from './walk';

const rich: SeedData = {
  babies: [makeBaby({ id: 'b1', birthWeightG: 3300 }), makeBaby({ id: 'b2', name: 'איתי', sex: 'male' })],
  entries: [
    breast('b1', NOW - 3 * HOUR, [['right', 10], ['left', 6]]),
    bottle('b1', NOW - 2 * HOUR, 120),
    solid('b1', NOW - 1 * HOUR, ['בטטה'], { isNewFood: true, reaction: 'פריחה' }),
    bottle('b1', NOW - 26 * HOUR, 90),
  ],
  measurements: [{ id: 'm1', babyId: 'b1', date: '2026-09-01', weightG: 4200, lengthMm: 540, headMm: 370 }],
};

test.describe('accessibility smoke', () => {
  test.beforeEach(async ({ page }) => {
    await freezeClockAt(page);
  });

  test('onboarding: no unlabeled controls, RTL, one h1', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('h1')).toHaveCount(1);
    await expectNoUnlabeledControls(page, 'onboarding');
  });

  for (const [name, route] of Object.entries(ROUTES)) {
    test(`${name}: no unlabeled controls, RTL, exactly one h1, current tab marked`, async ({ page }) => {
      await seed(page, rich);
      await page.goto(route);
      await expect(page.locator('main.page:not([aria-busy])')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.getByRole('navigation', { name: 'ניווט ראשי' }).locator('[aria-current="page"]')).toHaveCount(1);
      await expectNoUnlabeledControls(page, name);
    });
  }

  test('every sheet and dialog has only labeled controls', async ({ page }) => {
    await seed(page, rich);
    await eachSheet(page, (n) => expectNoUnlabeledControls(page, n));
  });

  test('empty states have no unlabeled controls', async ({ page }) => {
    await seed(page, { babies: [makeBaby({ id: 'b1' })] });
    for (const route of Object.values(ROUTES)) {
      await page.goto(route);
      await expect(page.locator('main.page:not([aria-busy])')).toBeVisible();
      await expectNoUnlabeledControls(page, route);
    }
  });

  test('keyboard: sheet takes focus, Esc closes it and focus returns to the trigger', async ({ page }) => {
    await seed(page, rich);
    await page.goto('/');
    const trigger = page.getByRole('button', { name: 'הוספת בקבוק' });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const sheet = dialog(page, 'בקבוק');
    await expect(sheet).toBeVisible();
    // Initial focus is inside the sheet (first field).
    expect(await sheet.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(trigger).toBeFocused();

    // Timer sheet: initial focus on the right side; Esc minimises.
    const timerTile = page.getByRole('button', { name: 'התחלת הנקה' });
    await timerTile.focus();
    await page.keyboard.press('Enter');
    await expect(dialog(page, 'הנקה').locator('.side-btn').first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog(page, 'הנקה')).toBeHidden();
    await expect(timerTile).toBeFocused();
  });

  test('keyboard: Tab stays inside an open sheet (focus trap)', async ({ page }) => {
    await seed(page, rich);
    await page.goto('/');
    await page.getByRole('button', { name: 'הוספת מוצקים' }).click();
    const sheet = dialog(page, 'מוצקים');
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const inside = await sheet.evaluate((d) => d.contains(document.activeElement) || document.activeElement === document.body);
      expect(inside, `tab #${i}`).toBe(true);
    }
  });

  test('keyboard: confirm dialogs focus the safe action and Esc cancels without closing the parent sheet', async ({ page }) => {
    await seed(page, rich);
    await page.goto('/#/history');
    await page.locator('.timeline-item--bottle').first().click();
    const sheet = dialog(page, 'עריכת האכלה');
    await sheet.getByRole('button', { name: '30 מ״ל' }).click();
    await page.keyboard.press('Escape');
    const confirm = page.getByRole('alertdialog', { name: 'לצאת בלי לשמור?' });
    await expect(confirm.getByRole('button', { name: 'המשך עריכה' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(confirm).toBeHidden();
    await expect(sheet).toBeVisible();
  });

  test('toast is announced politely and undo is a real button', async ({ page }) => {
    await seed(page, rich);
    await page.goto('/#/history');
    await timelineItems(page).first().click();
    await dialog(page, 'עריכת האכלה').getByRole('button', { name: 'מחיקה' }).click();
    await expect(page.locator('.toast-region')).toHaveAttribute('aria-live', 'polite');
    await expect(page.locator('.toast-region').getByRole('button', { name: 'בטל' })).toBeVisible();
  });

  test('timer display is role=timer and not a live region; banner is role=status', async ({ page }) => {
    await seed(page, { babies: [makeBaby({ id: 'b1' })], activeTimers: { b1: { babyId: 'b1', segments: [{ side: 'right', startedAt: NOW - 5 * MIN }] } } });
    await page.goto('/');
    await expect(page.getByRole('status').filter({ has: page.getByRole('button', { name: 'פתיחת טיימר ההנקה', exact: true }) })).toBeVisible();
    await page.getByRole('button', { name: 'פתיחת טיימר ההנקה', exact: true }).click();
    const t = dialog(page, 'הנקה').getByRole('timer');
    await expect(t).toHaveAttribute('aria-live', 'off');
    await expect(dialog(page, 'הנקה').locator('.side-btn').first()).toHaveAttribute('aria-label', /ימין, 5 דקות, צד פעיל/);
  });
});
