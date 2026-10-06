import {
  bottle,
  dialog,
  expect,
  freezeClockAt,
  gotoTab,
  makeBaby,
  NOW,
  persistedState,
  readEnvelope,
  readRaw,
  readStore,
  seed,
  STORAGE_KEY,
  test,
  timelineItems,
} from './fixtures';

test.describe('persistence', () => {
  test.beforeEach(async ({ page }) => {
    await freezeClockAt(page);
  });

  test('entries, settings and the active baby survive a reload', async ({ page }) => {
    await seed(page, { babies: [makeBaby({ id: 'a', name: 'נועה' }), makeBaby({ id: 'b', name: 'איתי', sex: 'male' })] });
    await page.goto('/');
    await page.getByRole('button', { name: 'הוספת בקבוק' }).click();
    await dialog(page, 'בקבוק').getByRole('button', { name: 'שמירה' }).click();
    await gotoTab(page, 'settings');
    await page.getByRole('radio', { name: 'אונקיות' }).click();
    await page.getByRole('button', { name: 'בחירת איתי' }).click();
    await page.getByRole('button', { name: 'בחירת נועה' }).click();
    await page.reload();
    await expect(page.getByRole('radio', { name: 'אונקיות' })).toHaveAttribute('aria-checked', 'true');
    await gotoTab(page, 'history');
    await expect(timelineItems(page)).toHaveCount(1);
    await expect(timelineItems(page).first()).toContainText('oz');
    const s = await readStore(page);
    expect(s.settings).toMatchObject({ volumeUnit: 'oz', activeBabyId: 'a' });
  });

  test('the stored format is the versioned envelope { state, version: 1 }', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('radio', { name: 'בת' }).click(); // nothing persisted yet
    await page.getByLabel('שם', { exact: true }).fill('נועה');
    await page.getByLabel('תאריך לידה').fill('2026-08-01');
    await page.getByRole('button', { name: 'התחלה' }).click();
    await expect(page).toHaveURL(/#\/$/);
    expect(await readEnvelope(page)).toEqual({
      state: {
        babies: [{ id: expect.any(String), name: 'נועה', birthDate: '2026-08-01', sex: 'female', createdAt: expect.any(Number) }],
        entries: [],
        measurements: [],
        activeTimers: {},
        settings: { volumeUnit: 'ml', weightUnit: 'kg', theme: 'auto', activeBabyId: expect.any(String) },
      },
      version: 1,
    });
  });
});

test.describe('corrupt storage', () => {
  test.use({ consoleAllow: /persisted state rejected|\[store\]/ });

  test('schema-invalid data: app recovers to onboarding and keeps a :corrupt copy', async ({ page }) => {
    await freezeClockAt(page);
    const state = persistedState({ babies: [makeBaby({ id: 'b1' })], entries: [bottle('b1', NOW - 1000, 90)] });
    // amountMl must be a number — corrupt it.
    const bad = { state: { ...state, entries: state.entries.map((e) => ({ ...e, amountMl: 'lots' })) }, version: 1 };
    const raw = JSON.stringify(bad);
    await seed(page, raw);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'ברוכים הבאים ל-BabyMonitor' })).toBeVisible();
    const corrupt = await readRaw(page, `${STORAGE_KEY}:corrupt`);
    expect(corrupt).toBe(JSON.stringify(bad.state));
  });

  // BUG-008: a NON-JSON value never reaches the store's `merge` (zustand's JSON storage throws while
  // parsing), so no ":corrupt" copy is kept and the next write overwrites the user's bytes.
  test('unparseable JSON: app recovers and keeps the original bytes in :corrupt (BUG-008)', async ({ page }) => {
    await freezeClockAt(page);
    const raw = '{"state":{"babies":[{"id":"b1","name":"נועה"'; // truncated write
    await seed(page, raw);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'ברוכים הבאים ל-BabyMonitor' })).toBeVisible();
    // Using the app writes the store…
    await page.getByLabel('שם', { exact: true }).fill('נועה');
    await page.getByLabel('תאריך לידה').fill('2026-08-01');
    await page.getByRole('radio', { name: 'בת' }).click();
    await page.getByRole('button', { name: 'התחלה' }).click();
    await expect(page).toHaveURL(/#\/$/);
    const [corrupt, current] = await page.evaluate(
      (k) => [localStorage.getItem(`${k}:corrupt`), localStorage.getItem(k)],
      STORAGE_KEY,
    );
    // The user's bytes must survive somewhere.
    expect([corrupt, current]).toContain(raw);
    expect(corrupt).toBe(raw);
  });

  test('garbage in localStorage never crashes the app (no page error)', async ({ page }) => {
    await freezeClockAt(page);
    await seed(page, JSON.stringify({ state: { babies: 'nope' }, version: 1 }));
    await page.goto('/#/history');
    await expect(page).toHaveURL(/#\/onboarding$/);
  });

  test('a future store version is not silently discarded', async ({ page }) => {
    await freezeClockAt(page);
    const v2 = { state: persistedState({ babies: [makeBaby({ id: 'b1', name: 'נועה' })] }), version: 2 };
    await seed(page, JSON.stringify(v2));
    await page.goto('/');
    // Either it loads the (compatible) data or it preserves it in :corrupt — never loses it.
    const switcher = page.getByRole('button', { name: /החלפת ילד\/ה: נועה/ });
    const welcome = page.getByRole('heading', { name: 'ברוכים הבאים ל-BabyMonitor' });
    await expect(switcher.or(welcome)).toBeVisible();
    const loaded = await switcher.isVisible();
    const corrupt = await readRaw(page, `${STORAGE_KEY}:corrupt`);
    expect(loaded || corrupt !== null).toBe(true);
  });
});
