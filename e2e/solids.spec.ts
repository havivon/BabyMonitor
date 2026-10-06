import {
  dialog,
  expect,
  freezeClockAt,
  gotoTab,
  makeBaby,
  MIN,
  NOW,
  readStore,
  seed,
  solid,
  test,
  timelineItems,
  toast,
} from './fixtures';
import type { Page } from '@playwright/test';

const baby = makeBaby({ id: 'b1', birthDate: '2026-03-01' });

async function openSolid(page: Page) {
  await page.getByRole('button', { name: 'הוספת מוצקים' }).click();
  const sheet = dialog(page, 'מוצקים');
  await expect(sheet).toBeVisible();
  return sheet;
}
const foodInput = (sheet: ReturnType<typeof dialog>) => sheet.getByRole('textbox', { name: 'מזון', exact: true });

test.describe('solids', () => {
  test.beforeEach(async ({ page }) => {
    await freezeClockAt(page);
  });

  test('multiple foods (Enter and comma), remove a chip, amount, new-food flag, reaction', async ({ page }) => {
    await seed(page, { babies: [baby] });
    await page.goto('/');
    const sheet = await openSolid(page);
    await sheet.getByRole('button', { name: 'שמירה' }).click();
    await expect(sheet.getByText('יש להזין לפחות מזון אחד')).toBeVisible();
    await expect(foodInput(sheet)).toBeFocused();

    await foodInput(sheet).fill('בטטה');
    await foodInput(sheet).press('Enter');
    await expect(sheet).toBeVisible(); // Enter adds a chip, does not submit
    await foodInput(sheet).pressSequentially('אבוקדו, גזר,');
    await expect(sheet.getByRole('button', { name: 'הסרת בטטה' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'הסרת אבוקדו' })).toBeVisible();
    await sheet.getByRole('button', { name: 'הסרת גזר' }).click();
    await expect(sheet.getByRole('button', { name: 'הסרת גזר' })).toHaveCount(0);

    // Never logged before → "new food" defaults on.
    await expect(sheet.getByRole('switch', { name: /מזון חדש/ })).toBeChecked();
    await sheet.getByRole('radio', { name: 'כפית', exact: true }).click();
    await expect(sheet.getByRole('radio', { name: 'כפית', exact: true })).toHaveAttribute('aria-checked', 'true');
    await expect(sheet.getByRole('radio', { name: 'ללא תגובה' })).toHaveAttribute('aria-checked', 'true');
    await sheet.getByRole('radio', { name: 'פריחה' }).click();
    await sheet.getByRole('button', { name: 'שמירה' }).click();
    await expect(sheet).toBeHidden();
    await expect(toast(page)).toContainText('הרישום נשמר');

    const { entries } = await readStore(page);
    expect(entries[0]).toMatchObject({ type: 'solid', foods: ['בטטה', 'אבוקדו'], amount: 'כפית', isNewFood: true, reaction: 'פריחה' });

    await gotoTab(page, 'history');
    const item = timelineItems(page).first();
    await expect(item).toContainText('מוצקים');
    await expect(item.locator('.badge')).toHaveText('חדש');
    await expect(item.locator('.timeline-item__meta')).toHaveText('בטטה, אבוקדו · כפית');
    await expect(item.locator('.timeline-item__note')).toHaveText('פריחה');
    // Solids-only day reads "מוצקים פעם אחת".
    await expect(page.locator('.day-header__summary').first()).toHaveText('מוצקים פעם אחת');
  });

  test('recent foods are suggested; known foods are not flagged as new', async ({ page }) => {
    await seed(page, {
      babies: [baby],
      entries: [
        solid('b1', NOW - 26 * 60 * MIN, ['בטטה', 'אבוקדו']),
        solid('b1', NOW - 3 * 60 * MIN, ['גזר']),
      ],
    });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'הוספת מוצקים' })).toContainText('אחרון: 11:00');
    const sheet = await openSolid(page);
    const recent = sheet.getByRole('group', { name: 'מזונות אחרונים' });
    // Most recent first.
    await expect(recent.getByRole('button')).toHaveText(['גזר', 'בטטה', 'אבוקדו']);
    await recent.getByRole('button', { name: 'הוספת בטטה' }).click();
    await expect(sheet.getByRole('button', { name: 'הסרת בטטה' })).toBeVisible();
    await expect(recent.getByRole('button', { name: 'הוספת בטטה' })).toHaveCount(0);
    await expect(sheet.getByRole('switch', { name: /מזון חדש/ })).not.toBeChecked();

    // Typing a known food in another letter case / with spaces does not duplicate it.
    await foodInput(sheet).fill(' בטטה ');
    await foodInput(sheet).press('Enter');
    await expect(sheet.getByRole('button', { name: 'הסרת בטטה' })).toHaveCount(1);

    await foodInput(sheet).fill('תירס');
    await foodInput(sheet).press('Enter');
    await expect(sheet.getByRole('switch', { name: /מזון חדש/ })).toBeChecked();
    await sheet.getByRole('button', { name: 'שמירה' }).click();
    await expect(sheet).toBeHidden();
    const saved = (await readStore(page)).entries.at(-1);
    expect(saved).toMatchObject({ foods: ['בטטה', 'תירס'], isNewFood: true, reaction: 'ללא תגובה' });
  });

  test('"אחר" reaction keeps the free text and edit shows it again', async ({ page }) => {
    await seed(page, { babies: [baby] });
    await page.goto('/');
    const sheet = await openSolid(page);
    await foodInput(sheet).fill('ביצה');
    await foodInput(sheet).press('Enter');
    await sheet.getByRole('radio', { name: 'אחר' }).click();
    await sheet.getByLabel('מה קרה?').fill('שיעול קל');
    await sheet.getByRole('button', { name: 'שמירה' }).click();
    await expect(sheet).toBeHidden();
    expect((await readStore(page)).entries[0]).toMatchObject({ foods: ['ביצה'], reaction: 'שיעול קל' });

    await timelineItems(page).first().click();
    const edit = dialog(page, 'עריכת האכלה');
    await expect(edit.getByRole('radio', { name: 'אחר' })).toHaveAttribute('aria-checked', 'true');
    await expect(edit.getByLabel('מה קרה?')).toHaveValue('שיעול קל');
    await expect(edit.getByRole('switch', { name: /מזון חדש/ })).toBeChecked();
  });

  test('amount chip can be cleared by tapping it again', async ({ page }) => {
    await seed(page, { babies: [baby] });
    await page.goto('/');
    const sheet = await openSolid(page);
    await foodInput(sheet).fill('אפונה');
    await foodInput(sheet).press('Enter');
    const chip = sheet.getByRole('radio', { name: 'קערית', exact: true });
    await chip.click();
    await chip.click();
    await expect(chip).toHaveAttribute('aria-checked', 'false');
    await sheet.getByRole('button', { name: 'שמירה' }).click();
    await expect(sheet).toBeHidden();
    expect((await readStore(page)).entries[0]).not.toHaveProperty('amount');
  });

  // BUG-005: leaving the food field commits the typed text as a chip ABOVE the other controls, so
  // the layout jumps between pointerdown and pointerup and the user's first tap is lost.
  test('first tap after typing a food is not lost (BUG-005)', async ({ page }) => {
    await seed(page, { babies: [baby] });
    await page.goto('/');
    const sheet = await openSolid(page);
    await foodInput(sheet).fill('אפונה');
    const chip = sheet.getByRole('radio', { name: 'קערית', exact: true });
    await chip.click();
    await expect(chip).toHaveAttribute('aria-checked', 'true');
    const other = sheet.getByRole('radio', { name: 'אחר' });
    await foodInput(sheet).fill('קישוא');
    await other.click();
    await expect(other).toHaveAttribute('aria-checked', 'true');
  });
});
