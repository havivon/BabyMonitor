import { expect, freezeClockAt, onboard, readStore, test } from './fixtures';

test.describe('first run / onboarding', () => {
  test.beforeEach(async ({ page }) => {
    await freezeClockAt(page);
  });

  test('first run shows onboarding in Hebrew RTL, without tab bar', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/#\/onboarding$/);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'he');
    await expect(page.getByRole('heading', { level: 1, name: 'ברוכים הבאים ל-BabyMonitor' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'ניווט ראשי' })).toHaveCount(0);
    await expect(page.getByText('בלי הרשמה ובלי שרת — הכול נשמר במכשיר שלך')).toBeVisible();
  });

  test('validates on blur: required name, birth date not in future, sex required', async ({ page }) => {
    await page.goto('/');
    const start = page.getByRole('button', { name: 'התחלה' });
    // Disabled-looking until required fields are valid.
    await expect(start).toHaveAttribute('aria-disabled', 'true');

    const name = page.getByLabel('שם', { exact: true });
    await name.focus();
    await name.blur();
    await expect(page.getByText('יש להזין שם')).toBeVisible();
    await expect(name).toHaveAttribute('aria-invalid', 'true');

    await name.fill('נועה');
    await name.blur();
    await expect(page.getByText('יש להזין שם')).toHaveCount(0);

    const birth = page.getByLabel('תאריך לידה');
    await birth.fill('2026-10-06'); // tomorrow
    await birth.blur();
    await expect(page.getByText('תאריך הלידה לא יכול להיות בעתיד')).toBeVisible();

    await birth.fill('2023-01-01'); // > 3 years ago
    await birth.blur();
    await expect(page.getByText('תאריך הלידה צריך להיות בשלוש השנים האחרונות')).toBeVisible();

    await birth.fill('2026-08-01');
    await expect(start).toHaveAttribute('aria-disabled', 'true'); // sex still missing
    await page.getByRole('radio', { name: 'בת' }).click();
    await expect(page.getByRole('radio', { name: 'בת' })).toHaveAttribute('aria-checked', 'true');
    await expect(start).not.toHaveAttribute('aria-disabled', 'true');
  });

  test('invalid birth weight blocks submit with a Hebrew range error', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('שם', { exact: true }).fill('נועה');
    await page.getByLabel('תאריך לידה').fill('2026-08-01');
    await page.getByRole('radio', { name: 'בת' }).click();
    await page.getByLabel(/משקל לידה/).fill('33');
    await page.getByRole('button', { name: 'התחלה' }).click();
    await expect(page.getByText(/משקל הלידה צריך להיות בין 0.5 ל-6.5 ק״ג/)).toBeVisible();
    await expect(page).toHaveURL(/#\/onboarding$/);
    await expect(page.getByLabel(/משקל לידה/)).toBeFocused();
  });

  test('name longer than 30 characters is rejected', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('שם', { exact: true }).fill('א'.repeat(31));
    await page.getByLabel('שם', { exact: true }).blur();
    await expect(page.getByText('השם יכול להכיל עד 30 תווים')).toBeVisible();
  });

  test('completing onboarding lands on Home with the baby in the header', async ({ page }) => {
    await page.goto('/');
    await onboard(page, { name: 'נועה', birthDate: '2026-08-01', weight: '3.3' });
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByRole('button', { name: /החלפת ילד\/ה: נועה/ })).toBeVisible();
    await expect(page.getByText('עוד לא נרשמו האכלות')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'ניווט ראשי' })).toBeVisible();
    // Visiting onboarding again with a baby keeps "add child" semantics, not first run.
    const stored = await readStore(page);
    expect(stored.babies).toHaveLength(1);
    expect(stored.babies[0]).toMatchObject({ name: 'נועה', birthDate: '2026-08-01', sex: 'female', birthWeightG: 3300 });
  });
});
