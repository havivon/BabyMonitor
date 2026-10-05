import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../components/toast';
import { serializeBackup } from '../../domain/backup';
import { DEFAULT_SETTINGS } from '../../domain/types';
import { appStore, selectBackupData } from '../../store';
import { local } from '../../test/helpers';
import pkg from '../../../package.json';
import { SettingsPage } from './SettingsPage';

const NOW = local(2026, 10, 5, 10);

function seed() {
  const s = appStore.getState();
  const noa = s.addBaby({
    name: 'נועה',
    birthDate: '2026-07-01',
    sex: 'female',
    birthWeightG: 3200,
  });
  const itai = s.addBaby({ name: 'איתי', birthDate: '2026-07-01', sex: 'male' });
  s.setActiveBaby(noa.id);
  s.addEntry({
    babyId: noa.id,
    type: 'bottle',
    at: NOW - 3_600_000,
    content: 'formula',
    amountMl: 120,
  });
  s.addEntry({
    babyId: itai.id,
    type: 'bottle',
    at: NOW - 3_600_000,
    content: 'formula',
    amountMl: 90,
  });
  s.addMeasurement({ babyId: itai.id, date: '2026-09-01', weightG: 5000 });
  return { noa, itai };
}

function renderPage() {
  const user = userEvent.setup();
  render(
    <ToastProvider>
      <SettingsPage />
    </ToastProvider>,
  );
  return user;
}

const downloads: { name: string; text: string; type: string; bytes: Uint8Array }[] = [];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  appStore.getState().resetAll();
  localStorage.clear();
  downloads.length = 0;
  let blob: Blob | null = null;
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: (b: Blob) => {
      blob = b;
      return 'blob:mock';
    },
    revokeObjectURL: () => undefined,
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    const b = blob;
    if (!b) return;
    const name = this.download;
    void b.arrayBuffer().then((buf) => {
      const bytes = new Uint8Array(buf);
      downloads.push({ name, text: new TextDecoder().decode(bytes), type: b.type, bytes });
    });
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('SettingsPage', () => {
  it('lists babies, marks the active one and switches', async () => {
    const { itai } = seed();
    const user = renderPage();
    expect(screen.getByText('נבחר')).toBeInTheDocument();
    expect(screen.getAllByText('1.7.2026')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'בחירת איתי' }));
    expect(appStore.getState().settings.activeBabyId).toBe(itai.id);
  });

  it('switches units and theme', async () => {
    seed();
    const user = renderPage();
    await user.click(screen.getByRole('radio', { name: 'אונקיות' }));
    await user.click(screen.getByRole('radio', { name: 'ליברות' }));
    await user.click(screen.getByRole('radio', { name: 'כהה' }));
    expect(appStore.getState().settings).toMatchObject({
      volumeUnit: 'oz',
      weightUnit: 'lb',
      theme: 'dark',
    });
    expect(screen.getByRole('radio', { name: 'כהה' })).toHaveAttribute('aria-checked', 'true');
  });

  it('deletes a baby after confirming the cascade warning', async () => {
    const { itai, noa } = seed();
    const user = renderPage();
    await user.click(screen.getByRole('button', { name: 'עריכת הפרטים של איתי' }));
    await user.click(screen.getByRole('button', { name: 'מחיקת איתי' }));
    const dialog = screen.getByRole('alertdialog', { name: 'למחוק את איתי?' });
    expect(within(dialog).getByText(/כל ההאכלות והמדידות של איתי יימחקו/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'מחיקת איתי' }));
    const state = appStore.getState();
    expect(state.babies.map((b) => b.id)).toEqual([noa.id]);
    expect(state.entries.every((e) => e.babyId !== itai.id)).toBe(true);
    expect(state.measurements).toEqual([]);
  });

  it('exports a JSON backup and CSV files', async () => {
    seed();
    const user = renderPage();
    await user.click(screen.getByRole('button', { name: /ייצוא גיבוי/ }));
    await user.click(screen.getByRole('button', { name: /ייצוא האכלות לגיליון/ }));
    await user.click(screen.getByRole('button', { name: /ייצוא מדידות לגיליון/ }));
    await vi.waitFor(() => {
      expect(downloads).toHaveLength(3);
    });
    const byName = (prefix: string) => downloads.find((d) => d.name.startsWith(prefix));
    const json = byName('babymonitor-backup-');
    expect(json?.name).toBe('babymonitor-backup-2026-10-05.json');
    expect(JSON.parse(json?.text ?? '{}')).toMatchObject({
      format: 'babymonitor-backup',
      data: { babies: [{}, {}] },
    });
    const feedings = byName('babymonitor-feedings-');
    expect(feedings?.name).toBe('babymonitor-feedings-2026-10-05.csv');
    expect([...(feedings?.bytes.slice(0, 3) ?? [])]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 BOM for Excel
    expect(feedings?.text).toMatch(/^תינוק,סוג/);
    expect(byName('babymonitor-measurements-')?.name).toBe(
      'babymonitor-measurements-2026-10-05.csv',
    );
    expect(await screen.findByText('קובץ הגיליון נשמר')).toBeInTheDocument();
  });

  it('imports a valid backup after confirmation (replacing all data)', async () => {
    seed();
    const backup = serializeBackup(
      {
        babies: [{ id: 'x1', name: 'מיה', birthDate: '2026-01-01', sex: 'female', createdAt: NOW }],
        entries: [],
        measurements: [],
        activeTimers: {},
        settings: { ...DEFAULT_SETTINGS, activeBabyId: 'x1' },
      },
      NOW,
    );
    const user = renderPage();
    await user.upload(
      screen.getByTestId('backup-file-input'),
      new File([backup], 'b.json', { type: 'application/json' }),
    );
    const dialog = await screen.findByRole('alertdialog', { name: 'לייבא את הגיבוי?' });
    expect(within(dialog).getByText(/1 ילד\/ה, 0 רישומי האכלה, 0 מדידות/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'ייבוא והחלפה' }));
    expect(appStore.getState().babies.map((b) => b.name)).toEqual(['מיה']);
    expect(await screen.findByText('הגיבוי יובא בהצלחה')).toBeInTheDocument();
  });

  it('keeps data when the import is cancelled', async () => {
    seed();
    const before = selectBackupData(appStore.getState());
    const user = renderPage();
    const json = serializeBackup(
      { ...before, babies: before.babies.slice(0, 1), entries: [], measurements: [] },
      NOW,
    );
    await user.upload(screen.getByTestId('backup-file-input'), new File([json], 'b.json'));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'ביטול' }));
    expect(selectBackupData(appStore.getState())).toEqual(before);
  });

  it.each([
    ['not json', '{oops', 'הקובץ אינו קובץ גיבוי תקין (JSON). לא יובא דבר.'],
    ['other json', '{"a":1}', 'הקובץ אינו גיבוי תקין של BabyMonitor. לא יובא דבר.'],
    ['future version', '{"format":"babymonitor-backup","version":9,"data":{}}', /גרסה חדשה יותר/],
    [
      'corrupt data',
      '{"format":"babymonitor-backup","version":1,"data":{"babies":[{}],"entries":[]}}',
      /חלק מהנתונים בקובץ פגומים/,
    ],
  ])(
    'rejects an invalid file (%s) with a Hebrew message and imports nothing',
    async (_label, text, message) => {
      seed();
      const before = selectBackupData(appStore.getState());
      const user = renderPage();
      await user.upload(screen.getByTestId('backup-file-input'), new File([text], 'x.json'));
      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(selectBackupData(appStore.getState())).toEqual(before);
    },
  );

  it('wipes all data only after a double confirmation', async () => {
    seed();
    const user = renderPage();
    await user.click(screen.getByRole('button', { name: 'מחיקת כל הנתונים' }));
    await user.click(screen.getByRole('button', { name: 'מחיקה לצמיתות' }));
    expect(appStore.getState().babies).toHaveLength(2);
    const second = screen.getByRole('alertdialog', { name: 'בטוח למחוק הכול?' });
    await user.click(within(second).getByRole('button', { name: 'כן, למחוק הכול' }));
    expect(appStore.getState().babies).toEqual([]);
  });

  it('shows privacy, version and disclaimer', () => {
    seed();
    renderPage();
    expect(screen.getByText('הנתונים נשמרים רק במכשיר הזה')).toBeInTheDocument();
    expect(screen.getByText(pkg.version)).toBeInTheDocument();
    expect(screen.getByText(/אינם תחליף לייעוץ רפואי/)).toBeInTheDocument();
  });
});
