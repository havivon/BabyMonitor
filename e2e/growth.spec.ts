import {
  alertDialog,
  dialog,
  expect,
  freezeClockAt,
  gotoTab,
  makeBaby,
  readStore,
  seed,
  test,
  text,
  toast,
} from './fixtures';
import { weightPercentile, whoRow } from './who';
import type { Page } from '@playwright/test';

async function openAdd(page: Page) {
  await page.getByRole('button', { name: 'הוספת מדידה' }).first().click();
  const sheet = dialog(page, 'מדידה חדשה');
  await expect(sheet).toBeVisible();
  return sheet;
}
const weightInput = (sheet: ReturnType<typeof dialog>) => sheet.getByLabel('משקל', { exact: true });
const badge = (page: Page) => page.locator('.percentile__value');

test.describe('growth', () => {
  test.beforeEach(async ({ page }) => {
    await freezeClockAt(page);
  });

  test('empty state, then add a measurement in kg with length and head', async ({ page }) => {
    await seed(page, { babies: [makeBaby({ id: 'b1', birthDate: '2026-08-01' })] });
    await page.goto('/#/growth');
    await expect(page.getByText('עוד אין מדידות')).toBeVisible();
    await expect(page.getByText('המידע אינו מהווה ייעוץ רפואי')).toBeVisible();
    const sheet = await openAdd(page);
    await expect(sheet.getByLabel('תאריך')).toHaveValue('2026-10-05');
    await weightInput(sheet).fill('5');
    await sheet.getByLabel(/^אורך/).fill('57.5');
    await sheet.getByLabel(/^היקף ראש/).fill('39');
    await sheet.getByRole('button', { name: 'שמירה' }).click();
    await expect(sheet).toBeHidden();
    await expect(toast(page)).toContainText('המדידה נשמרה');
    expect((await readStore(page)).measurements[0]).toMatchObject({ date: '2026-10-05', weightG: 5000, lengthMm: 575, headMm: 390 });
    await expect(page.locator('.percentile__main')).toHaveText(/5\.00\s*ק״ג/);
    // Length / head tabs.
    await page.getByRole('radio', { name: 'אורך' }).click();
    await expect(page.locator('.percentile__main')).toHaveText(/57\.5\s*ס״מ/);
    await expect(page.getByRole('heading', { name: 'אורך לגיל' })).toBeVisible();
    await page.getByRole('radio', { name: 'היקף ראש' }).click();
    await expect(page.locator('.percentile__main')).toHaveText(/39\.0\s*ס״מ/);
  });

  test('weight typed in grams (> 100) is read as grams', async ({ page }) => {
    await seed(page, { babies: [makeBaby({ id: 'b1', birthDate: '2026-08-01' })] });
    await page.goto('/#/growth');
    const sheet = await openAdd(page);
    await weightInput(sheet).fill('4250');
    await sheet.getByRole('button', { name: 'שמירה' }).click();
    await expect(sheet).toBeHidden();
    expect((await readStore(page)).measurements[0]?.weightG).toBe(4250);
    await expect(page.locator('.percentile__main')).toHaveText(/4\.25\s*ק״ג/);
  });

  test('lb mode: input in lb, stored as grams, displayed in lb', async ({ page }) => {
    await seed(page, { babies: [makeBaby({ id: 'b1', birthDate: '2026-08-01' })], settings: { weightUnit: 'lb' } });
    await page.goto('/#/growth');
    const sheet = await openAdd(page);
    await expect(sheet.locator('.input-group__affix').first()).toHaveText('lb');
    await weightInput(sheet).fill('11.02');
    await sheet.getByRole('button', { name: 'שמירה' }).click();
    await expect(sheet).toBeHidden();
    expect((await readStore(page)).measurements[0]?.weightG).toBe(Math.round(11.02 * 453.59237));
    await expect(page.locator('.percentile__main')).toHaveText(/11\.0\s*lb/);
  });

  // BUG-007: the lb edit form pre-fills 2-decimal lb, so saving an untouched weight re-converts
  // and silently changes the stored grams.
  test('editing only the note in lb mode keeps the stored grams (BUG-007)', async ({ page }) => {
    await seed(page, {
      babies: [makeBaby({ id: 'b1', birthDate: '2026-08-01' })],
      measurements: [{ id: 'm1', babyId: 'b1', date: '2026-10-01', weightG: 3346 }],
      settings: { weightUnit: 'lb' },
    });
    await page.goto('/#/growth');
    await page.getByRole('button', { name: /עריכת מדידה מ-1 באוקטובר 2026/ }).click();
    const sheet = dialog(page, 'עריכת מדידה');
    await sheet.getByLabel(/^הערה/).fill('טיפת חלב');
    await sheet.getByRole('button', { name: 'שמירה' }).click();
    await expect(sheet).toBeHidden();
    expect((await readStore(page)).measurements[0]).toMatchObject({ weightG: 3346, note: 'טיפת חלב' });
  });

  test('validation messages', async ({ page }) => {
    await seed(page, { babies: [makeBaby({ id: 'b1', birthDate: '2026-08-01' })] });
    await page.goto('/#/growth');
    const sheet = await openAdd(page);
    await sheet.getByRole('button', { name: 'שמירה' }).click();
    await expect(sheet.getByText('יש להזין לפחות ערך אחד')).toBeVisible();
    await expect(weightInput(sheet)).toBeFocused();

    await weightInput(sheet).fill('0.3');
    await sheet.getByRole('button', { name: 'שמירה' }).click();
    await expect(sheet.getByText('המשקל צריך להיות בין 0.5 ל-30 ק״ג')).toBeVisible();
    await weightInput(sheet).fill('abc');
    await expect(sheet.getByText('המשקל צריך להיות בין 0.5 ל-30 ק״ג')).toBeVisible();
    await weightInput(sheet).fill('31');
    await expect(sheet.getByText('המשקל צריך להיות בין 0.5 ל-30 ק״ג')).toBeVisible();
    await weightInput(sheet).fill('5.1');
    await expect(sheet.getByText('המשקל צריך להיות בין 0.5 ל-30 ק״ג')).toHaveCount(0);

    await sheet.getByLabel(/^אורך/).fill('200');
    await sheet.getByLabel(/^היקף ראש/).fill('10');
    await sheet.getByRole('button', { name: 'שמירה' }).click();
    await expect(sheet.getByText('האורך צריך להיות בין 30 ל-120 ס״מ')).toBeVisible();
    await expect(sheet.getByText('היקף הראש צריך להיות בין 25 ל-60 ס״מ')).toBeVisible();
    await sheet.getByLabel(/^אורך/).fill('');
    await sheet.getByLabel(/^היקף ראש/).fill('');

    await sheet.getByLabel('תאריך').fill('2026-07-20');
    await expect(sheet.getByText('תאריך המדידה לא יכול להיות לפני תאריך הלידה')).toBeVisible();
    await sheet.getByLabel('תאריך').fill('2026-10-06');
    await expect(sheet.getByText('אי אפשר לבחור תאריך עתידי')).toBeVisible();
    await sheet.getByRole('button', { name: 'שמירה' }).click();
    await expect(sheet).toBeVisible();
    expect((await readStore(page)).measurements).toEqual([]);

    await sheet.getByLabel('תאריך').fill('2026-10-05');
    await sheet.getByRole('button', { name: 'שמירה' }).click();
    await expect(sheet).toBeHidden();
    expect((await readStore(page)).measurements).toHaveLength(1);
  });

  test('percentile: boy with WHO median birth weight 3.3464 kg is P50', async ({ page }) => {
    // Sanity of the reference table itself.
    expect(whoRow('male', 0).m).toBe(3.3464);
    await seed(page, { babies: [makeBaby({ id: 'b1', sex: 'male', birthDate: '2026-10-05', birthWeightG: 3346.4 })] });
    await page.goto('/#/growth');
    await expect(badge(page)).toHaveText('50');
    await expect(page.locator('.percentile')).toContainText('קרוב לחציון לפי WHO');
    await expect(page.getByText('בנים · ')).toBeVisible();
  });

  test('percentile matches the WHO LMS formula for girl, day 65, 5.00 kg and boy, day 30, 3.9 kg', async ({ page }) => {
    // Girl born 1 Aug 2026; 5 Oct 2026 = day 65.
    const pGirl = weightPercentile('female', 65, 5.0);
    await seed(page, {
      babies: [makeBaby({ id: 'g', birthDate: '2026-08-01' }), makeBaby({ id: 'b', name: 'איתי', sex: 'male', birthDate: '2026-09-05' })],
      measurements: [
        { id: 'm1', babyId: 'g', date: '2026-10-05', weightG: 5000 },
        { id: 'm2', babyId: 'b', date: '2026-10-05', weightG: 3900 },
      ],
      settings: { activeBabyId: 'g' },
    });
    await page.goto('/#/growth');
    await expect(badge(page)).toHaveText(String(Math.round(pGirl)));
    await expect(page.locator('.list .badge--growth').first()).toHaveText(String(Math.round(pGirl)));

    const pBoy = weightPercentile('male', 30, 3.9); // tail: < P3 → one decimal
    await gotoTab(page, 'settings');
    await page.getByRole('button', { name: 'בחירת איתי' }).click();
    await gotoTab(page, 'growth');
    const expected = pBoy < 3 || pBoy > 97 ? (Math.round(pBoy * 10) / 10).toString() : String(Math.round(pBoy));
    await expect(badge(page)).toHaveText(expected);
    if (pBoy < 3) {
      await expect(page.getByText('המשקל מתחת לאחוזון 3')).toBeVisible();
      await expect(page.locator('.banner').filter({ hasText: 'מתחת לאחוזון 3' })).toContainText('כדאי להתייעץ עם רופא/ת הילדים');
    }
  });

  test('> 10% birth-weight loss in the first days shows a consult banner', async ({ page }) => {
    await seed(page, {
      babies: [makeBaby({ id: 'b1', birthDate: '2026-09-28', birthWeightG: 3500 })],
      measurements: [{ id: 'm1', babyId: 'b1', date: '2026-10-02', weightG: 3100 }],
    });
    await page.goto('/#/growth');
    const banner = page.locator('.banner').filter({ hasText: 'ממשקל הלידה' }).first();
    await expect(banner).toBeVisible();
    // (3500 − 3100) / 3500 = 11.4 %
    expect(await text(banner.locator('.banner__title'))).toBe('ירידה של 11.4% ממשקל הלידה');
    await expect(banner).toContainText('כדאי להתייעץ עם רופא/ת הילדים');
    await expect(banner).toHaveClass(/banner--(danger|warning)/);
    // "% vs birth weight" in the summary.
    await expect(page.locator('.kv__item').filter({ hasText: 'ממשקל הלידה' })).toContainText('−11%');
  });

  test('gain per day / week between measurements ≥ 7 days apart', async ({ page }) => {
    await seed(page, {
      babies: [makeBaby({ id: 'b1', birthDate: '2026-08-01', birthWeightG: 3300 })],
      measurements: [
        { id: 'm1', babyId: 'b1', date: '2026-09-21', weightG: 4500 },
        { id: 'm2', babyId: 'b1', date: '2026-10-05', weightG: 4920 },
      ],
    });
    await page.goto('/#/growth');
    // 420 g / 14 days = 30 g/day = 210 g/week.
    await expect(page.locator('.kv__item').filter({ hasText: 'עלייה ליום' })).toContainText('+30');
    await expect(page.locator('.kv__item').filter({ hasText: 'עלייה לשבוע' })).toContainText('+210');
  });

  test('edit a measurement, delete it and undo', async ({ page }) => {
    await seed(page, {
      babies: [makeBaby({ id: 'b1', birthDate: '2026-08-01' })],
      measurements: [{ id: 'm1', babyId: 'b1', date: '2026-10-01', weightG: 4800, note: 'א' }],
    });
    await page.goto('/#/growth');
    await page.getByRole('button', { name: /עריכת מדידה מ-1 באוקטובר 2026/ }).click();
    const sheet = dialog(page, 'עריכת מדידה');
    await expect(weightInput(sheet)).toHaveValue('4.8');
    await weightInput(sheet).fill('4.85');
    await sheet.getByRole('button', { name: 'שמירה' }).click();
    await expect(sheet).toBeHidden();
    expect((await readStore(page)).measurements[0]).toMatchObject({ id: 'm1', weightG: 4850 });

    await page.getByRole('button', { name: /עריכת מדידה מ-1 באוקטובר 2026/ }).click();
    await sheet.getByRole('button', { name: 'מחיקה' }).click();
    await expect(toast(page)).toContainText('המדידה נמחקה');
    await expect(page.getByText('עוד אין מדידות')).toBeVisible();
    await toast(page).getByRole('button', { name: 'בטל' }).click();
    await expect(page.getByRole('button', { name: /עריכת מדידה מ-1 באוקטובר 2026/ })).toBeVisible();
    expect((await readStore(page)).measurements).toEqual([{ id: 'm1', babyId: 'b1', date: '2026-10-01', weightG: 4850, note: 'א' }]);
  });

  test('dirty measurement sheet asks before closing', async ({ page }) => {
    await seed(page, { babies: [makeBaby({ id: 'b1', birthDate: '2026-08-01' })] });
    await page.goto('/#/growth');
    const sheet = await openAdd(page);
    await weightInput(sheet).fill('5');
    await page.keyboard.press('Escape');
    await expect(alertDialog(page, 'לצאת בלי לשמור?')).toBeVisible();
  });
});
