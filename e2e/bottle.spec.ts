import {
  alertDialog,
  bottle,
  dialog,
  expect,
  expectApprox,
  freezeClockAt,
  gotoTab,
  makeBaby,
  MIN,
  NOW,
  readStore,
  seed,
  test,
  timelineItems,
  toast,
} from './fixtures';
import type { Page } from '@playwright/test';

const baby = makeBaby({ id: 'b1' });

async function openBottle(page: Page) {
  await page.getByRole('button', { name: 'הוספת בקבוק' }).click();
  const sheet = dialog(page, 'בקבוק');
  await expect(sheet).toBeVisible();
  return sheet;
}

test.describe('bottle', () => {
  test.beforeEach(async ({ page }) => {
    await freezeClockAt(page);
  });

  test('add with chip + stepper, content, retro time and note', async ({ page }) => {
    await seed(page, { babies: [baby] });
    await page.goto('/');
    const sheet = await openBottle(page);
    // Defaults: breast milk, 90 ml, now.
    await expect(sheet.getByRole('radio', { name: 'חלב אם שאוב' })).toHaveAttribute('aria-checked', 'true');
    await expect(sheet.getByLabel('כמות במ״ל')).toHaveValue('90');
    await expect(sheet.getByRole('button', { name: '90 מ״ל' })).toHaveAttribute('aria-pressed', 'true');

    await sheet.getByRole('radio', { name: 'תמ״ל' }).click();
    await sheet.getByRole('button', { name: '120 מ״ל' }).click();
    await sheet.getByRole('button', { name: 'הוספה של 10 מ״ל' }).click();
    await expect(sheet.getByLabel('כמות במ״ל')).toHaveValue('130');
    await expect(sheet.getByRole('button', { name: '120 מ״ל' })).toHaveAttribute('aria-pressed', 'false');
    await sheet.getByRole('button', { name: 'לפני 30 ד׳' }).click();
    await sheet.getByLabel(/הערה/).fill('גיהוק אחרי חצי');
    await sheet.getByRole('button', { name: 'שמירה' }).click();
    await expect(sheet).toBeHidden();
    await expect(toast(page)).toContainText('הבקבוק נשמר');

    const { entries } = await readStore(page);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ type: 'bottle', content: 'formula', amountMl: 130, note: 'גיהוק אחרי חצי' });
    expectApprox((entries[0] as { at: number }).at, NOW - 30 * MIN);

    await gotoTab(page, 'history');
    const item = timelineItems(page).first();
    await expect(item.locator('.timeline-item__time')).toHaveText('13:30');
    await expect(item).toContainText('תמ״ל');
    await expect(item.locator('.timeline-item__value')).toHaveText('130 מ״ל');
    await expect(item).toContainText('גיהוק אחרי חצי');

    // Next open defaults to the last content and amount.
    await gotoTab(page, 'home');
    await expect(page.getByRole('button', { name: 'הוספת בקבוק' })).toContainText('אחרון: 130 מ״ל');
    const again = await openBottle(page);
    await expect(again.getByRole('radio', { name: 'תמ״ל' })).toHaveAttribute('aria-checked', 'true');
    await expect(again.getByLabel('כמות במ״ל')).toHaveValue('130');
  });

  test('stepper decrements to 0 and the − button disables at the bound', async ({ page }) => {
    await seed(page, { babies: [baby] });
    await page.goto('/');
    const sheet = await openBottle(page);
    await sheet.getByRole('button', { name: '30 מ״ל' }).click();
    const dec = sheet.getByRole('button', { name: 'הפחתה של 10 מ״ל' });
    await dec.click();
    await dec.click();
    await dec.click();
    await expect(sheet.getByLabel('כמות במ״ל')).toHaveValue('0');
    await expect(dec).toBeDisabled();
    await sheet.getByRole('button', { name: 'שמירה' }).click();
    await expect(sheet.getByText('יש להזין כמות גדולה מ-0')).toBeVisible();
    await expect(sheet).toBeVisible();
    expect((await readStore(page)).entries).toEqual([]);
  });

  test('validation: amount > 500 rejected, > 400 warns but saves, future time rejected', async ({ page }) => {
    await seed(page, { babies: [baby] });
    await page.goto('/');
    const sheet = await openBottle(page);
    const amount = sheet.getByLabel('כמות במ״ל');
    await amount.fill('510');
    await amount.blur();
    await expect(sheet.getByText('הכמות המקסימלית היא 500 מ״ל')).toBeVisible();
    await expect(amount).toHaveAttribute('aria-invalid', 'true');
    await sheet.getByRole('button', { name: 'שמירה' }).click();
    await expect(sheet).toBeVisible();
    await expect(amount).toBeFocused();

    await amount.fill('450');
    await amount.blur();
    await expect(sheet.getByText('כמות גבוהה מהרגיל — לבדוק שוב?')).toBeVisible();

    await sheet.getByLabel('שעה', { exact: true }).fill('2026-10-05T16:00');
    await expect(sheet.getByText('אי אפשר לבחור שעה עתידית')).toBeVisible();
    await sheet.getByRole('button', { name: 'שמירה' }).click();
    await expect(sheet).toBeVisible();
    expect((await readStore(page)).entries).toEqual([]);

    await sheet.getByRole('button', { name: 'עכשיו' }).click();
    await expect(sheet.getByText('אי אפשר לבחור שעה עתידית')).toHaveCount(0);
    await sheet.getByRole('button', { name: 'שמירה' }).click();
    await expect(sheet).toBeHidden();
    expect((await readStore(page)).entries[0]).toMatchObject({ amountMl: 450 });
  });

  test('typed non-numeric amount is rejected', async ({ page }) => {
    await seed(page, { babies: [baby] });
    await page.goto('/');
    const sheet = await openBottle(page);
    await sheet.getByLabel('כמות במ״ל').fill('abc');
    await sheet.getByRole('button', { name: 'שמירה' }).click();
    await expect(sheet.getByText('יש להזין כמות גדולה מ-0')).toBeVisible();
    expect((await readStore(page)).entries).toEqual([]);
  });

  test('edit an entry, then undo the edit', async ({ page }) => {
    await seed(page, { babies: [baby], entries: [bottle('b1', NOW - 60 * MIN, 90, 'breastmilk', { id: 'x1' })] });
    await page.goto('/#/history');
    await timelineItems(page).first().click();
    const sheet = dialog(page, 'עריכת האכלה');
    await expect(sheet.getByLabel('כמות במ״ל')).toHaveValue('90');
    await sheet.getByRole('button', { name: '150 מ״ל' }).click();
    await sheet.getByRole('radio', { name: 'תמ״ל' }).click();
    await sheet.getByRole('button', { name: 'שמירה' }).click();
    await expect(toast(page)).toContainText('השינויים נשמרו');
    await expect(timelineItems(page).first().locator('.timeline-item__value')).toHaveText('150 מ״ל');
    let { entries } = await readStore(page);
    expect(entries).toEqual([{ id: 'x1', babyId: 'b1', type: 'bottle', at: NOW - 60 * MIN, content: 'formula', amountMl: 150 }]);

    await toast(page).getByRole('button', { name: 'בטל' }).click();
    await expect(timelineItems(page).first().locator('.timeline-item__value')).toHaveText('90 מ״ל');
    ({ entries } = await readStore(page));
    expect(entries[0]).toMatchObject({ id: 'x1', amountMl: 90, content: 'breastmilk' });
  });

  test('delete from the edit sheet, undo restores the exact entry', async ({ page }) => {
    const original = bottle('b1', NOW - 60 * MIN, 90, 'breastmilk', { id: 'x1', note: 'הערה' });
    await seed(page, { babies: [baby], entries: [original] });
    await page.goto('/#/history');
    await timelineItems(page).first().click();
    const sheet = dialog(page, 'עריכת האכלה');
    await sheet.getByRole('button', { name: 'מחיקה' }).click();
    await expect(sheet).toBeHidden();
    await expect(toast(page)).toContainText('הרישום נמחק');
    await expect(page.getByText('אין עדיין רישומים')).toBeVisible();
    expect((await readStore(page)).entries).toEqual([]);
    await toast(page).getByRole('button', { name: 'בטל' }).click();
    await expect(timelineItems(page)).toHaveCount(1);
    expect((await readStore(page)).entries).toEqual([original]);
  });

  test('closing a dirty sheet asks before discarding', async ({ page }) => {
    await seed(page, { babies: [baby] });
    await page.goto('/');
    const sheet = await openBottle(page);
    await sheet.getByRole('button', { name: '60 מ״ל' }).click();
    await sheet.getByRole('button', { name: 'סגירה' }).click();
    const confirm = alertDialog(page, 'לצאת בלי לשמור?');
    await expect(confirm.getByRole('button', { name: 'המשך עריכה' })).toBeFocused();
    await confirm.getByRole('button', { name: 'המשך עריכה' }).click();
    await expect(sheet).toBeVisible();
    await page.keyboard.press('Escape');
    await alertDialog(page, 'לצאת בלי לשמור?').getByRole('button', { name: 'יציאה' }).click();
    await expect(sheet).toBeHidden();
    expect((await readStore(page)).entries).toEqual([]);
  });

  test('a rapid double tap on save creates only one entry', async ({ page }) => {
    await seed(page, { babies: [baby] });
    await page.goto('/');
    const sheet = await openBottle(page);
    await sheet.getByRole('button', { name: 'שמירה' }).dblclick();
    await expect(sheet).toBeHidden();
    expect((await readStore(page)).entries).toHaveLength(1);
  });

  test('ml ↔ oz switch is reflected everywhere and stored ml never changes', async ({ page }) => {
    await seed(page, { babies: [baby], entries: [bottle('b1', NOW - 60 * MIN, 120, 'formula', { id: 'x1' })] });
    await page.goto('/#/settings');
    await page.getByRole('radio', { name: 'אונקיות' }).click();
    await expect(page.getByRole('radio', { name: 'אונקיות' })).toHaveAttribute('aria-checked', 'true');

    await gotoTab(page, 'home');
    await expect(page.getByRole('button', { name: 'הוספת בקבוק' })).toContainText('אחרון: 4.1 oz');
    await expect(page.locator('.stat--bottle .stat__value')).toHaveText(/4\.1\s*oz/);
    await expect(page.locator('.since__meta')).toContainText('4.1 oz');

    await gotoTab(page, 'history');
    await expect(timelineItems(page).first().locator('.timeline-item__value')).toHaveText('4.1 oz');
    await expect(page.locator('.day-header__summary').first()).toContainText('4.1 oz');

    // The sheet works in oz: chips 1–5 oz, step 0.5 oz.
    await timelineItems(page).first().click();
    const sheet = dialog(page, 'עריכת האכלה');
    await expect(sheet.getByRole('button', { name: '1 oz', exact: true })).toBeVisible();
    await expect(sheet.getByRole('button', { name: '5 oz', exact: true })).toBeVisible();
    // Editing only the note must not change the stored ml (no oz rounding drift).
    await sheet.getByLabel(/הערה/).fill('רק הערה');
    await sheet.getByRole('button', { name: 'שמירה' }).click();
    await expect(sheet).toBeHidden();
    expect((await readStore(page)).entries[0]).toMatchObject({ amountMl: 120, note: 'רק הערה' });

    // A new 3 oz bottle is stored as whole ml (3 × 29.5735 ≈ 89).
    await gotoTab(page, 'home');
    const add = await openBottle(page);
    await add.getByRole('button', { name: '3 oz', exact: true }).click();
    await add.getByRole('button', { name: 'שמירה' }).click();
    await expect(add).toBeHidden();
    const amounts = (await readStore(page)).entries.map((e) => (e as { amountMl: number }).amountMl).sort();
    expect(amounts).toEqual([120, 89]);

    // Back to ml.
    await gotoTab(page, 'settings');
    await page.getByRole('radio', { name: 'מיליליטר' }).click();
    await gotoTab(page, 'history');
    await expect(page.locator('.day-header__summary').first()).toContainText('209 מ״ל');
  });
});
