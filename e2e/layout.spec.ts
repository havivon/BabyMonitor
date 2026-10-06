import {
  bottle,
  breast,
  expect,
  expectNoHorizontalOverflow,
  freezeClockAt,
  makeBaby,
  NOW,
  HOUR,
  MIN,
  ROUTES,
  seed,
  solid,
  test,
  type SeedData,
} from './fixtures';
import { eachSheet } from './walk';

// Worst case content: 30-char names, long food lists, big numbers, a running timer.
const longName = 'אלכסנדרה-מרגריטה בת-שבע לוי';
const heavy: SeedData = {
  babies: [
    makeBaby({ id: 'b1', name: longName, birthWeightG: 3300 }),
    makeBaby({ id: 'b2', name: 'יהונתן-אברהם בן-ציון כהן', sex: 'male' }),
  ],
  entries: [
    breast('b1', NOW - 5 * HOUR, [['right', 59], ['left', 61]], { note: 'הערה ארוכה מאוד שנכתבה באמצע הלילה על ההנקה הזו ועל כל מה שקרה בה' }),
    bottle('b1', NOW - 3 * HOUR, 450, 'breastmilk'),
    solid('b1', NOW - 2 * HOUR, ['בטטה אפויה בתנור', 'אבוקדו מעוך עם בננה', 'דייסת שיבולת שועל', 'גזר'], { amount: '2–3 כפיות', isNewFood: true, reaction: 'אי-נוחות בבטן' }),
    bottle('b1', NOW - 26 * HOUR, 120),
  ],
  measurements: [{ id: 'm1', babyId: 'b1', date: '2026-09-01', weightG: 4200, lengthMm: 540, headMm: 370, note: 'נשקל בטיפת חלב בשכונה' }],
  activeTimers: { b1: { babyId: 'b1', segments: [{ side: 'left', startedAt: NOW - 75 * MIN }] } },
};

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`no horizontal overflow at 360×640 (${scheme})`, () => {
    test.use({ viewport: { width: 360, height: 640 }, colorScheme: scheme });

    test.beforeEach(async ({ page }) => {
      await freezeClockAt(page);
    });

    test('onboarding', async ({ page }) => {
      await page.goto('/');
      await page.getByLabel('שם', { exact: true }).fill('א'.repeat(31));
      await page.getByRole('button', { name: 'התחלה' }).focus();
      await page.getByLabel('שם', { exact: true }).blur();
      await expectNoHorizontalOverflow(page, 'onboarding');
    });

    test('every page', async ({ page }) => {
      await seed(page, heavy);
      for (const [name, route] of Object.entries(ROUTES)) {
        await page.goto(route);
        await expect(page.locator('main.page:not([aria-busy])')).toBeVisible();
        await page.waitForTimeout(300); // charts settle
        await expectNoHorizontalOverflow(page, name);
      }
    });

    test('every sheet and dialog', async ({ page }) => {
      await seed(page, { ...heavy, activeTimers: {} });
      await eachSheet(page, (n) => expectNoHorizontalOverflow(page, n));
    });
  });
}

test.describe('long names', () => {
  test.use({ viewport: { width: 360, height: 640 } });
  test('a 30-character name is truncated in the header, not overflowing or wrapping the tab bar', async ({ page }) => {
    await freezeClockAt(page);
    await seed(page, heavy);
    await page.goto('/');
    const name = page.locator('.baby-switch__name');
    await expect(name).toHaveText(longName);
    const box = await page.locator('.baby-switch').boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= 360).toBe(true);
    const tabbar = await page.locator('.tabbar').boundingBox();
    expect(tabbar?.height ?? 999).toBeLessThan(100);
  });
});
