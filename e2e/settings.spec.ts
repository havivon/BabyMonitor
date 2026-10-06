import { readFileSync } from 'node:fs';
import {
  alertDialog,
  at,
  bottle,
  breast,
  expect,
  freezeClockAt,
  makeBaby,
  NOW,
  MIN,
  backupFile,
  persistedState,
  type PersistedState,
  readStore,
  seed,
  solid,
  test,
  toast,
  type SeedData,
} from './fixtures';
import type { Browser, Page } from '@playwright/test';

const data: SeedData = {
  babies: [
    makeBaby({ id: 'b1', name: 'נועה', birthWeightG: 3300 }),
    makeBaby({ id: 'b2', name: 'איתי', sex: 'male', birthDate: '2026-09-01' }),
  ],
  entries: [
    breast(
      'b1',
      at('2026-10-05T08:00'),
      [
        ['right', 10],
        ['left', 5],
      ],
      { id: 'e1', note: 'בבוקר' },
    ),
    bottle('b1', at('2026-10-05T11:00'), 120, 'formula', { id: 'e2' }),
    {
      ...solid('b1', at('2026-10-05T12:00'), ['בטטה', 'גזר'], {
        amount: 'כפית',
        isNewFood: true,
        reaction: 'פריחה',
      }),
      id: 'e3',
    },
    bottle('b2', at('2026-10-05T10:00'), 60, 'breastmilk', { id: 'e4', note: '=SUM(A1)' }),
  ],
  measurements: [
    { id: 'm1', babyId: 'b1', date: '2026-10-01', weightG: 4800, lengthMm: 560, note: 'טיפת חלב' },
  ],
  settings: { volumeUnit: 'ml', weightUnit: 'kg', theme: 'dark', activeBabyId: 'b1' },
};

interface BackupJson {
  format: string;
  version: number;
  exportedAt: number;
  data: PersistedState;
}

async function exportBackup(page: Page): Promise<{ name: string; json: BackupJson; raw: string }> {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /ייצוא גיבוי/ }).click(),
  ]);
  const raw = readFileSync(await download.path(), 'utf8');
  return { name: download.suggestedFilename(), json: JSON.parse(raw) as BackupJson, raw };
}

async function chooseFile(page: Page, trigger: () => Promise<void>, name: string, content: string) {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), trigger()]);
  await chooser.setFiles({
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(content, 'utf8'),
  });
}

async function freshPage(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const p = await ctx.newPage();
  await p.clock.install({ time: NOW });
  return p;
}

test.describe('settings', () => {
  test.beforeEach(async ({ page }) => {
    await freezeClockAt(page);
  });

  test('theme: dark / light / auto set data-theme on <html> and theme-color, and persist', async ({
    page,
  }) => {
    await seed(page, { babies: [makeBaby({ id: 'b1' })] });
    await page.goto('/#/settings');
    const html = page.locator('html');
    await expect(html).not.toHaveAttribute('data-theme', /.*/);
    const theme = page.getByRole('radiogroup', { name: 'ערכת נושא' });
    await expect(theme.getByRole('radio', { name: 'אוטומטי' })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    await theme.getByRole('radio', { name: 'כהה' }).click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute(
      'content',
      '#141211',
    );
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(20, 18, 17)');
    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'dark');

    await theme.getByRole('radio', { name: 'בהיר' }).click();
    await expect(html).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('meta[name="theme-color"]').last()).toHaveAttribute(
      'content',
      '#f8f5ef',
    );

    await theme.getByRole('radio', { name: 'אוטומטי' }).click();
    await expect(html).not.toHaveAttribute('data-theme', /.*/);
    // Keyboard: arrows move the selection inside the radiogroup.
    await theme.getByRole('radio', { name: 'אוטומטי' }).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(theme.getByRole('radio', { name: 'בהיר' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  test('export JSON → valid backup file equal to the stored data', async ({ page }) => {
    await seed(page, data);
    await page.goto('/#/settings');
    const { name, json } = await exportBackup(page);
    expect(name).toBe('babymonitor-backup-2026-10-05.json');
    expect(json).toMatchObject({ format: 'babymonitor-backup', version: 1 });
    expect(typeof json.exportedAt).toBe('number');
    expect(json.data).toEqual(await readStore(page));
    expect(json.data).toEqual(persistedState(data));
    await expect(toast(page)).toContainText('קובץ הגיבוי נשמר');
  });

  test('backup round trip: import the exported file into a fresh install', async ({
    page,
    browser,
  }) => {
    await seed(page, data);
    await page.goto('/#/settings');
    const { raw } = await exportBackup(page);
    const original = await readStore(page);

    const p2 = await freshPage(browser);
    await p2.goto('/');
    await expect(p2.getByRole('heading', { name: 'ברוכים הבאים ל-BabyMonitor' })).toBeVisible();
    await chooseFile(
      p2,
      () => p2.getByRole('button', { name: 'יש לי קובץ גיבוי' }).click(),
      'backup.json',
      raw,
    );
    await expect(p2).toHaveURL(/#\/$/);
    await expect(toast(p2)).toContainText('הגיבוי יובא בהצלחה');
    expect(await readStore(p2)).toEqual(original);
    await expect(p2.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(p2.getByRole('button', { name: /החלפת ילד\/ה: נועה/ })).toBeVisible();
    await p2.context().close();
  });

  test('import from Settings asks to confirm and replaces all data', async ({ page }) => {
    await seed(page, {
      babies: [makeBaby({ id: 'old', name: 'ישן' })],
      entries: [bottle('old', NOW - 10 * MIN, 30)],
    });
    await page.goto('/#/settings');
    const backup = backupFile(persistedState(data));
    await chooseFile(
      page,
      () => page.getByRole('button', { name: /ייבוא מגיבוי/ }).click(),
      'b.json',
      backup,
    );
    const confirm = alertDialog(page, 'לייבא את הגיבוי?');
    await expect(confirm).toContainText('2 ילדים, 4 רישומי האכלה, 1 מדידות');
    await expect(confirm.getByRole('button', { name: 'ביטול' })).toBeFocused();
    await confirm.getByRole('button', { name: 'ייבוא והחלפה' }).click();
    await expect(toast(page)).toContainText('הגיבוי יובא בהצלחה');
    expect(await readStore(page)).toEqual(persistedState(data));
    await expect(page.getByRole('button', { name: 'עריכת הפרטים של ישן' })).toHaveCount(0);
  });

  test('importing invalid files shows a Hebrew error and changes nothing', async ({ page }) => {
    await seed(page, data);
    await page.goto('/#/settings');
    const before = await readStore(page);
    const importRow = () => page.getByRole('button', { name: /ייבוא מגיבוי/ }).click();

    await chooseFile(page, importRow, 'x.json', 'this is not json');
    await expect(toast(page)).toContainText('הקובץ אינו קובץ גיבוי תקין (JSON). לא יובא דבר.');
    await expect(toast(page)).toHaveAttribute('role', 'alert');

    await chooseFile(page, importRow, 'x.json', JSON.stringify({ hello: 'world' }));
    await expect(toast(page)).toContainText('הקובץ אינו גיבוי תקין של BabyMonitor. לא יובא דבר.');

    await chooseFile(
      page,
      importRow,
      'x.json',
      JSON.stringify({ format: 'babymonitor-backup', version: 99, data: {} }),
    );
    await expect(toast(page)).toContainText('הגיבוי נוצר בגרסה חדשה יותר של האפליקציה');

    const valid = persistedState(data);
    const broken = {
      ...valid,
      entries: valid.entries.map((e) => (e.type === 'bottle' ? { ...e, amountMl: -5 } : e)),
    };
    await chooseFile(page, importRow, 'x.json', backupFile(broken));
    await expect(toast(page)).toContainText('חלק מהנתונים בקובץ פגומים, ולכן לא יובא דבר.');

    await expect(alertDialog(page, 'לייבא את הגיבוי?')).toHaveCount(0);
    expect(await readStore(page)).toEqual(before);
  });

  test('importing a backup while a timer runs replaces the timer state without errors', async ({
    page,
  }) => {
    await seed(page, {
      babies: [makeBaby({ id: 'b1' })],
      activeTimers: {
        b1: { babyId: 'b1', segments: [{ side: 'left', startedAt: NOW - 3 * MIN }] },
      },
    });
    await page.goto('/#/settings');
    await expect(
      page.getByRole('button', { name: 'פתיחת טיימר ההנקה', exact: true }),
    ).toBeVisible();
    const backup = backupFile(persistedState(data));
    await chooseFile(
      page,
      () => page.getByRole('button', { name: /ייבוא מגיבוי/ }).click(),
      'b.json',
      backup,
    );
    await alertDialog(page, 'לייבא את הגיבוי?')
      .getByRole('button', { name: 'ייבוא והחלפה' })
      .click();
    await expect(page.getByRole('button', { name: 'פתיחת טיימר ההנקה', exact: true })).toHaveCount(
      0,
    );
    expect((await readStore(page)).activeTimers).toEqual({});
  });

  test('CSV export: UTF-8 BOM, Hebrew headers, one row per feed, formula-injection safe', async ({
    page,
  }) => {
    await seed(page, data);
    await page.goto('/#/settings');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /ייצוא האכלות לגיליון/ }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('babymonitor-feedings-2026-10-05.csv');
    const buf = readFileSync(await download.path());
    expect([...buf.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const lines = buf
      .toString('utf8')
      .replace(/^\uFEFF/, '')
      .split('\r\n')
      .filter(Boolean);
    expect(lines[0]).toBe(
      'תינוק,סוג,תאריך,שעת התחלה,שעת סיום,משך (דקות),שמאל (דקות),ימין (דקות),צד אחרון,תוכן,כמות (מ״ל),מזונות,כמות מוצקים,מזון חדש,תגובה,הערה',
    );
    expect(lines).toHaveLength(5);
    expect(lines).toContain('נועה,בקבוק,2026-10-05,11:00,,,,,,תמ״ל,120,,,,,');
    expect(lines).toContain('נועה,הנקה,2026-10-05,08:00,08:15,15,5,10,שמאל,,,,,,,בבוקר');
    expect(lines).toContain('נועה,מוצקים,2026-10-05,12:00,,,,,,,,בטטה; גזר,כפית,כן,פריחה,');
    expect(lines).toContain("איתי,בקבוק,2026-10-05,10:00,,,,,,חלב אם,60,,,,,'=SUM(A1)");

    const [m] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /ייצוא מדידות לגיליון/ }).click(),
    ]);
    const mText = readFileSync(await m.path(), 'utf8');
    expect(
      mText.startsWith('\uFEFFתינוק,תאריך,משקל (גרם),אורך (ס״מ),היקף ראש (ס״מ),הערה\r\n'),
    ).toBe(true);
    expect(mText).toContain('נועה,2026-10-01,4800,56,,טיפת חלב');
  });

  test('delete all data needs two confirmations, then returns to onboarding', async ({ page }) => {
    await seed(page, data);
    await page.goto('/#/settings');
    await page.getByRole('button', { name: 'מחיקת כל הנתונים' }).click();
    const first = alertDialog(page, 'למחוק את כל הנתונים?');
    await expect(first.getByRole('button', { name: 'ביטול' })).toBeFocused();
    await first.getByRole('button', { name: 'מחיקה לצמיתות' }).click();
    const second = alertDialog(page, 'בטוח למחוק הכול?');
    // Backing out at the last step keeps everything.
    await second.getByRole('button', { name: 'ביטול' }).click();
    expect((await readStore(page)).babies).toHaveLength(2);

    await page.getByRole('button', { name: 'מחיקת כל הנתונים' }).click();
    await alertDialog(page, 'למחוק את כל הנתונים?')
      .getByRole('button', { name: 'מחיקה לצמיתות' })
      .click();
    await alertDialog(page, 'בטוח למחוק הכול?')
      .getByRole('button', { name: 'כן, למחוק הכול' })
      .click();
    await expect(page).toHaveURL(/#\/onboarding$/);
    await expect(page.getByRole('heading', { name: 'ברוכים הבאים ל-BabyMonitor' })).toBeVisible();
    const after = await readStore(page);
    expect(after).toMatchObject({ babies: [], entries: [], measurements: [], activeTimers: {} });
  });

  test('about section shows privacy, sources, version and disclaimer', async ({ page }) => {
    await seed(page, { babies: [makeBaby({ id: 'b1' })] });
    await page.goto('/#/settings');
    await expect(page.getByText('הנתונים נשמרים רק במכשיר הזה')).toBeVisible();
    await expect(page.getByText('WHO Child Growth Standards')).toBeVisible();
    await expect(page.locator('.row').filter({ hasText: 'גרסה' })).toContainText(/\d+\.\d+\.\d+/);
    await expect(page.getByText(/אינם תחליף לייעוץ רפואי/)).toBeVisible();
  });
});
