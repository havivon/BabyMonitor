/**
 * Shared E2E fixtures & helpers (QA-owned).
 *
 * - `test` fails any test that logs a console error / warning or throws an uncaught page error
 *   (allow-list specific messages with `test.use({ consoleAllow: /regex/ })`).
 * - `seed()` writes the persisted store (`babymonitor:v1`, zustand `persist` envelope) BEFORE the
 *   app boots, once per tab (reloads keep whatever the app wrote since).
 * - Data builders produce records in the exact persisted shape of `src/store/persistence.ts`.
 * - `expectNoUnlabeledControls()` uses Chromium's computed accessibility tree (CDP).
 * - `expectNoHorizontalOverflow()` asserts `scrollWidth <= clientWidth` for the page and any open
 *   dialog / sheet.
 */
import { expect, test as base, type Locator, type Page } from '@playwright/test';

export { expect };

// ---------------------------------------------------------------------------------- time

/** Monday 5 Oct 2026, 14:00 Israel time (UTC+3, before the DST change on 25 Oct). */
export const NOW = Date.parse('2026-10-05T14:00:00+03:00');
export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

/** Epoch ms of a local Israel wall-clock time, e.g. `at('2026-10-05T09:30')` (Oct 2026 = +03:00). */
export function at(local: string, offset = '+03:00'): number {
  return Date.parse(`${local}:00${offset}`);
}

// ---------------------------------------------------------------------------------- data

export type Side = 'left' | 'right';

export interface Baby {
  id: string;
  name: string;
  birthDate: string;
  sex: 'male' | 'female';
  birthWeightG?: number;
  createdAt: number;
}

export type Entry =
  | {
      id: string;
      babyId: string;
      type: 'breast';
      startedAt: number;
      endedAt: number;
      segments: { side: Side; startedAt: number; endedAt: number }[];
      note?: string;
    }
  | {
      id: string;
      babyId: string;
      type: 'bottle';
      at: number;
      content: 'breastmilk' | 'formula';
      amountMl: number;
      note?: string;
    }
  | {
      id: string;
      babyId: string;
      type: 'solid';
      at: number;
      foods: string[];
      amount?: string;
      isNewFood?: boolean;
      reaction?: string;
      note?: string;
    };

export interface Measurement {
  id: string;
  babyId: string;
  date: string;
  weightG?: number;
  lengthMm?: number;
  headMm?: number;
  note?: string;
}

export interface ActiveTimer {
  babyId: string;
  segments: { side: Side; startedAt: number; endedAt?: number }[];
  pausedAt?: number;
}

export interface Settings {
  volumeUnit: 'ml' | 'oz';
  weightUnit: 'kg' | 'lb';
  theme: 'auto' | 'light' | 'dark';
  activeBabyId: string | null;
}

export interface SeedData {
  babies?: Baby[];
  entries?: Entry[];
  measurements?: Measurement[];
  activeTimers?: Record<string, ActiveTimer>;
  settings?: Partial<Settings>;
}

let seq = 0;
const nextId = (prefix: string): string => `${prefix}-${++seq}`;

export function makeBaby(overrides: Partial<Baby> = {}): Baby {
  return {
    id: overrides.id ?? nextId('baby'),
    name: 'נועה',
    birthDate: '2026-08-01',
    sex: 'female',
    createdAt: Date.parse('2026-08-02T10:00:00+03:00'),
    ...overrides,
  };
}

/** A breastfeed starting at `startedAt` with consecutive segments, e.g. `[['right', 10], ['left', 5]]` (minutes). */
export function breast(
  babyId: string,
  startedAt: number,
  sides: [Side, number][],
  extra: { id?: string; note?: string } = {},
): Entry {
  let t = startedAt;
  const segments = sides.map(([side, minutes]) => {
    const seg = { side, startedAt: t, endedAt: t + minutes * MIN };
    t = seg.endedAt;
    return seg;
  });
  return {
    id: extra.id ?? nextId('e'),
    babyId,
    type: 'breast',
    startedAt,
    endedAt: t,
    segments,
    ...(extra.note ? { note: extra.note } : {}),
  };
}

export function bottle(
  babyId: string,
  atMs: number,
  amountMl: number,
  content: 'breastmilk' | 'formula' = 'formula',
  extra: { id?: string; note?: string } = {},
): Entry {
  return {
    id: extra.id ?? nextId('e'),
    babyId,
    type: 'bottle',
    at: atMs,
    content,
    amountMl,
    ...(extra.note ? { note: extra.note } : {}),
  };
}

export function solid(
  babyId: string,
  atMs: number,
  foods: string[],
  extra: Partial<Extract<Entry, { type: 'solid' }>> = {},
): Entry {
  return { id: nextId('e'), babyId, type: 'solid', at: atMs, foods, ...extra };
}

export const STORAGE_KEY = 'babymonitor:v1';

/** The persisted `state` (same shape as a backup file's `data`). */
export interface PersistedState {
  babies: Baby[];
  entries: Entry[];
  measurements: Measurement[];
  activeTimers: Record<string, ActiveTimer>;
  settings: Settings;
}

/** zustand `persist` envelope stored under `babymonitor:v1`. */
export interface PersistedEnvelope {
  state: PersistedState;
  version: number;
}

/** Full persisted state for seed data (defaults filled in). */
export function persistedState(data: SeedData): PersistedState {
  const babies = data.babies ?? [];
  return {
    babies,
    entries: data.entries ?? [],
    measurements: data.measurements ?? [],
    activeTimers: data.activeTimers ?? {},
    settings: {
      volumeUnit: 'ml',
      weightUnit: 'kg',
      theme: 'auto',
      activeBabyId: babies[0]?.id ?? null,
      ...data.settings,
    },
  };
}

/** The exact value the app persists under `babymonitor:v1` (zustand `persist` envelope, v1). */
export function persistedValue(data: SeedData): string {
  const envelope: PersistedEnvelope = { state: persistedState(data), version: 1 };
  return JSON.stringify(envelope);
}

/** A backup file (as exported by Settings) containing `data`. */
export function backupFile(state: PersistedState, exportedAt = NOW): string {
  return JSON.stringify({ format: 'babymonitor-backup', version: 1, exportedAt, data: state });
}

/** Raw localStorage value of `key` (default: the store key). */
export async function readRaw(page: Page, key: string = STORAGE_KEY): Promise<string | null> {
  return page.evaluate((k) => localStorage.getItem(k), key);
}

/**
 * Seeds localStorage before any app script runs. Runs once per tab (guarded by sessionStorage), so
 * `page.reload()` exercises the app's own persistence. Pass a raw string to seed arbitrary bytes.
 */
export async function seed(page: Page, data: SeedData | string): Promise<void> {
  const raw = typeof data === 'string' ? data : persistedValue(data);
  await page.addInitScript(
    ([key, value]) => {
      if (sessionStorage.getItem('__qa_seeded')) return;
      localStorage.setItem(key, value);
      sessionStorage.setItem('__qa_seeded', '1');
    },
    [STORAGE_KEY, raw] as const,
  );
}

/** Reads the app's persisted envelope `{ state, version }`. */
export async function readEnvelope(page: Page): Promise<PersistedEnvelope> {
  const raw = await readRaw(page);
  if (!raw) throw new Error('store not persisted');
  return JSON.parse(raw) as PersistedEnvelope;
}

/** Reads the app's persisted state (parsed `state` of the zustand envelope). */
export async function readStore(page: Page): Promise<PersistedState> {
  return (await readEnvelope(page)).state;
}

/**
 * Installs the fake clock at `time` (default NOW) — call before the first navigation. The clock
 * keeps running in real time (React Suspense / lazy routes need timers); jump with
 * `page.clock.fastForward()`. Second-level displays may therefore drift by a few real seconds —
 * use `mmss()` for tolerant timer-display assertions.
 */
export async function freezeClockAt(page: Page, time = NOW): Promise<void> {
  await page.clock.install({ time });
}

/** Regex for a `mm:ss` timer display that may be up to 9 real seconds past `m` whole minutes. */
export function mmss(minutes: number): RegExp {
  const h = Math.floor(minutes / 60);
  const m = String(minutes % 60).padStart(2, '0');
  return h ? new RegExp(`^${h}:${m}:0\\d$`) : new RegExp(`^${m}:0\\d$`);
}

/** Asserts `actual` is `expected` ms plus at most `slackMs` of real elapsed time. */
export function expectApprox(actual: number, expected: number, slackMs = 10_000): void {
  expect(actual).toBeGreaterThanOrEqual(expected);
  expect(actual).toBeLessThanOrEqual(expected + slackMs);
}

// ---------------------------------------------------------------------------------- UI helpers

export const TABS = {
  home: 'בית',
  history: 'היסטוריה',
  growth: 'גדילה',
  stats: 'סטטיסטיקה',
  settings: 'הגדרות',
} as const;

export const ROUTES = {
  home: '/#/',
  history: '/#/history',
  growth: '/#/growth',
  stats: '/#/stats',
  settings: '/#/settings',
} as const;

export async function gotoTab(page: Page, tab: keyof typeof TABS): Promise<void> {
  await page.getByRole('navigation', { name: 'ניווט ראשי' }).getByRole('link', { name: TABS[tab] }).click();
  await expect(
    page.getByRole('navigation', { name: 'ניווט ראשי' }).getByRole('link', { name: TABS[tab] }),
  ).toHaveAttribute('aria-current', 'page');
}

/** The currently open modal sheet / dialog with the given accessible name. */
export function dialog(page: Page, name: string | RegExp): Locator {
  return page.getByRole('dialog', { name });
}

export function alertDialog(page: Page, name: string | RegExp): Locator {
  return page.getByRole('alertdialog', { name });
}

/** The single toast in the polite live region. */
export function toast(page: Page): Locator {
  return page.locator('.toast-region .toast');
}

/** Completes onboarding through the UI. */
export async function onboard(
  page: Page,
  { name = 'נועה', birthDate = '2026-08-01', sex = 'בת', weight }: {
    name?: string;
    birthDate?: string;
    sex?: 'בת' | 'בן';
    weight?: string;
  } = {},
): Promise<void> {
  await page.getByLabel('שם', { exact: true }).fill(name);
  await page.getByLabel('תאריך לידה').fill(birthDate);
  await page.getByRole('radio', { name: sex }).click();
  if (weight !== undefined) await page.getByLabel(/משקל לידה/).fill(weight);
  await page.getByRole('button', { name: /^(התחלה|שמירה)$/ }).click();
}

/** Timeline items (buttons) inside History / Home recent list. */
export function timelineItems(scope: Page | Locator): Locator {
  return scope.locator('.timeline-item');
}

/** Text with ALL whitespace removed (for values whose parts are separated only by CSS gaps). */
export async function compactText(locator: Locator): Promise<string> {
  return (await text(locator)).replace(/\s+/g, '');
}

/** Normalised text (collapses whitespace, strips bidi isolation marks). */
export async function text(locator: Locator): Promise<string> {
  const t = (await locator.textContent()) ?? '';
  return t.replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------------- a11y / layout

const INTERACTIVE_ROLES = new Set([
  'button',
  'link',
  'textbox',
  'searchbox',
  'checkbox',
  'radio',
  'switch',
  'combobox',
  'listbox',
  'spinbutton',
  'slider',
  'menuitem',
  'tab',
  'DateTime',
  'Date',
  'InputTime',
  'date',
  'time',
]);

interface AxNode {
  nodeId: string;
  ignored: boolean;
  role?: { value: string };
  name?: { value: string };
  backendDOMNodeId?: number;
}

/**
 * Every exposed interactive control on the page (incl. open sheets) has a non-empty accessible
 * name, as computed by Chromium. Returns the offenders for a readable failure message.
 */
export async function expectNoUnlabeledControls(page: Page, context = ''): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  try {
    const { nodes } = (await cdp.send('Accessibility.getFullAXTree')) as { nodes: AxNode[] };
    const offenders: string[] = [];
    for (const n of nodes) {
      if (n.ignored || !n.role) continue;
      if (!INTERACTIVE_ROLES.has(n.role.value)) continue;
      const name = (n.name?.value ?? '').trim();
      if (name) continue;
      let html = '';
      if (n.backendDOMNodeId) {
        try {
          const { object } = (await cdp.send('DOM.resolveNode', {
            backendNodeId: n.backendDOMNodeId,
          })) as { object: { objectId: string } };
          const res = (await cdp.send('Runtime.callFunctionOn', {
            objectId: object.objectId,
            functionDeclaration: 'function(){return this.outerHTML.slice(0,200)}',
            returnByValue: true,
          })) as { result: { value: string } };
          html = res.result.value;
        } catch {
          /* node gone */
        }
      }
      offenders.push(`${n.role.value}: ${html}`);
    }
    expect(offenders, `unlabeled controls ${context}`).toEqual([]);
  } finally {
    await cdp.detach();
  }
}

/** No horizontal scrolling of the document or of any open dialog/sheet. */
export async function expectNoHorizontalOverflow(page: Page, context = ''): Promise<void> {
  const report = await page.evaluate(() => {
    const out: string[] = [];
    const doc = document.documentElement;
    if (doc.scrollWidth > doc.clientWidth) out.push(`document ${doc.scrollWidth} > ${doc.clientWidth}`);
    for (const d of Array.from(document.querySelectorAll('dialog[open]'))) {
      const el = d as HTMLElement;
      if (el.scrollWidth > el.clientWidth + 1)
        out.push(`dialog.${el.className} ${el.scrollWidth} > ${el.clientWidth}`);
      for (const inner of Array.from(el.querySelectorAll<HTMLElement>('.sheet__body'))) {
        if (inner.scrollWidth > inner.clientWidth + 1)
          out.push(`sheet__body ${inner.scrollWidth} > ${inner.clientWidth}`);
      }
    }
    return out;
  });
  expect(report, `horizontal overflow ${context}`).toEqual([]);
}

// ---------------------------------------------------------------------------------- test

interface Fixtures {
  /** Console messages (error/warning) that are expected in this test (one regex; use `|`). */
  consoleAllow: RegExp | null;
  /** Auto fixture: fails the test on console errors / warnings / uncaught page errors. */
  consoleGuard: string[];
}

export const test = base.extend<Fixtures>({
  consoleAllow: [null, { option: true }],
  consoleGuard: [
    async ({ page, consoleAllow }, use) => {
      const problems: string[] = [];
      const allowed = (t: string) => consoleAllow?.test(t) ?? false;
      page.on('console', (msg) => {
        const type = msg.type();
        if (type !== 'error' && type !== 'warning') return;
        const t = msg.text();
        if (!allowed(t)) problems.push(`console.${type}: ${t}`);
      });
      page.on('pageerror', (err) => {
        if (!allowed(err.message)) problems.push(`pageerror: ${err.message}`);
      });
      await use(problems);
      expect(problems, 'console errors / warnings / page errors').toEqual([]);
    },
    { auto: true },
  ],
});
