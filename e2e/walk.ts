/** Walks through every sheet / dialog of the app (QA helper shared by a11y and layout specs). */
import { dialog, expect, ROUTES } from './fixtures';
import type { Page } from '@playwright/test';

export /** Opens every sheet/dialog reachable from a page and runs `check` on each. */
async function eachSheet(page: Page, check: (name: string) => Promise<void>) {
  await page.goto(ROUTES.home);
  const sheets: [string, string | RegExp, string | RegExp][] = [
    ['timer', 'התחלת הנקה', 'הנקה'],
    ['bottle', 'הוספת בקבוק', 'בקבוק'],
    ['solid', 'הוספת מוצקים', 'מוצקים'],
    ['switcher', /החלפת ילד\/ה/, 'ילדים'],
  ];
  for (const [label, trigger, title] of sheets) {
    await page.getByRole('button', { name: trigger }).first().click();
    await expect(dialog(page, title)).toBeVisible();
    await check(label);
    await page.keyboard.press('Escape');
    await expect(dialog(page, title)).toBeHidden();
  }
  // Running timer + manual form.
  await page.getByRole('button', { name: 'התחלת הנקה' }).click();
  await dialog(page, 'הנקה').getByRole('button', { name: 'רישום ידני' }).click();
  await check('timer-manual');
  await dialog(page, /רישום ידני/)
    .getByRole('button', { name: 'חזרה לטיימר' })
    .click();
  await dialog(page, 'הנקה').locator('.side-btn').first().click();
  await check('timer-running');
  await dialog(page, 'הנקה').getByRole('button', { name: 'ביטול הנקה' }).click();
  await check('timer-cancel-dialog');
  await page.getByRole('alertdialog').getByRole('button', { name: 'ביטול ההנקה' }).click();
  // Edit sheets.
  await page.goto(ROUTES.history);
  for (const type of ['breast', 'bottle', 'solid']) {
    await page.locator(`.timeline-item--${type}`).first().click();
    await expect(dialog(page, 'עריכת האכלה')).toBeVisible();
    await check(`edit-${type}`);
    await page.keyboard.press('Escape');
    await expect(dialog(page, 'עריכת האכלה')).toBeHidden();
  }
  await page.goto(ROUTES.growth);
  await page.getByRole('button', { name: 'הוספת מדידה' }).first().click();
  await check('measurement-new');
  await page.keyboard.press('Escape');
  await page
    .getByRole('button', { name: /עריכת מדידה/ })
    .first()
    .click();
  await check('measurement-edit');
  await page.keyboard.press('Escape');
  await page.goto(ROUTES.settings);
  await page
    .getByRole('button', { name: /עריכת הפרטים של/ })
    .first()
    .click();
  await check('baby-edit');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'מחיקת כל הנתונים' }).click();
  await check('wipe-dialog');
  await page.keyboard.press('Escape');
}
