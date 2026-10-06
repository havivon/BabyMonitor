/**
 * Backup export / import (versioned JSON) and CSV export.
 *
 * Import is all-or-nothing: `parseBackup` validates EVERY record and either returns a fully
 * normalised `BackupData` or a single `BackupError` — callers then replace state atomically.
 * Unknown properties are stripped; references (babyId) and id uniqueness are checked.
 */
import { formatClock, isValidDateKey, toDateKey } from './dates';
import { breastDurations, compareEntriesDesc, entryEndTime, entryTime } from './feeding';
import type {
  ActiveTimer,
  Baby,
  BreastSegment,
  FeedingEntry,
  Measurement,
  Settings,
  TimerSegment,
} from './types';
import { DEFAULT_SETTINGS } from './types';

export const BACKUP_FORMAT = 'babymonitor-backup';
export const BACKUP_VERSION = 1;

export interface BackupData {
  babies: Baby[];
  entries: FeedingEntry[];
  measurements: Measurement[];
  activeTimers: Record<string, ActiveTimer>;
  settings: Settings;
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: number;
  data: BackupData;
}

export type BackupErrorCode =
  | 'INVALID_JSON'
  | 'NOT_A_BACKUP'
  | 'UNSUPPORTED_VERSION'
  | 'INVALID_DATA'
  | 'DUPLICATE_ID'
  | 'UNKNOWN_BABY';

export interface BackupError {
  code: BackupErrorCode;
  /** JSON-path-like location of the problem, e.g. `data.entries[3].amountMl`. */
  path?: string;
  /** Developer-facing detail (English). The UI maps `code` to Hebrew text. */
  message: string;
}

export type ParseBackupResult =
  | { ok: true; data: BackupData; /** From the file header, when present. */ exportedAt?: number }
  | { ok: false; error: BackupError };

export function createBackup(data: BackupData, now: number): BackupFile {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now, data };
}

export function serializeBackup(data: BackupData, now: number): string {
  return JSON.stringify(createBackup(data, now), null, 2);
}

/** Suggested download file name, e.g. `babymonitor-backup-2026-10-05.json`. */
export function backupFileName(now: number): string {
  return `babymonitor-backup-${toDateKey(now)}.json`;
}

// ---------------------------------------------------------------- validation primitives

class ValidationError extends Error {
  readonly code: BackupErrorCode;
  readonly path: string;
  constructor(code: BackupErrorCode, path: string, message: string) {
    super(message);
    this.code = code;
    this.path = path;
  }
}

type Obj = Record<string, unknown>;

function fail(path: string, message: string, code: BackupErrorCode = 'INVALID_DATA'): never {
  throw new ValidationError(code, path, message);
}

function isObject(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function obj(v: unknown, path: string): Obj {
  if (!isObject(v)) fail(path, 'expected an object');
  return v;
}

function arr(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) fail(path, 'expected an array');
  return v;
}

function str(v: unknown, path: string, { nonEmpty = false } = {}): string {
  if (typeof v !== 'string' || (nonEmpty && v.trim() === '')) {
    fail(path, nonEmpty ? 'expected a non-empty string' : 'expected a string');
  }
  return v;
}

function optStr(v: unknown, path: string): string | undefined {
  return v === undefined || v === null ? undefined : str(v, path);
}

function num(v: unknown, path: string, { min = 0, integer = false } = {}): number {
  if (
    typeof v !== 'number' ||
    !Number.isFinite(v) ||
    v < min ||
    (integer && !Number.isInteger(v))
  ) {
    fail(path, `expected a finite ${integer ? 'integer' : 'number'} >= ${min}`);
  }
  return v;
}

function optNum(v: unknown, path: string): number | undefined {
  return v === undefined || v === null ? undefined : num(v, path);
}

/** Epoch ms between 2000-01-01 and 2200-01-01 (catches seconds-vs-ms and garbage). */
function time(v: unknown, path: string): number {
  const t = num(v, path, { integer: true });
  if (t < 946_684_800_000 || t > 7_258_118_400_000) fail(path, 'timestamp out of range');
  return t;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], path: string): T {
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) {
    fail(path, `expected one of ${allowed.join(', ')}`);
  }
  return v as T;
}

function dateKey(v: unknown, path: string): string {
  if (!isValidDateKey(v)) fail(path, 'expected a YYYY-MM-DD date');
  return v;
}

function optBool(v: unknown, path: string): boolean | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'boolean') fail(path, 'expected a boolean');
  return v;
}

/** Copies only defined optional props so the output has no `undefined`-valued keys. */
function withOptional<T extends object>(base: T, optional: Partial<T>): T {
  const out = { ...base };
  for (const [k, v] of Object.entries(optional)) if (v !== undefined) (out as Obj)[k] = v;
  return out;
}

const SIDES = ['left', 'right'] as const;

// ---------------------------------------------------------------- record validators

function parseBaby(v: unknown, p: string): Baby {
  const o = obj(v, p);
  return withOptional<Baby>(
    {
      id: str(o.id, `${p}.id`, { nonEmpty: true }),
      name: str(o.name, `${p}.name`, { nonEmpty: true }),
      birthDate: dateKey(o.birthDate, `${p}.birthDate`),
      sex: oneOf(o.sex, ['male', 'female'] as const, `${p}.sex`),
      createdAt: time(o.createdAt, `${p}.createdAt`),
    },
    { birthWeightG: optNum(o.birthWeightG, `${p}.birthWeightG`) },
  );
}

function parseSegment(v: unknown, p: string): BreastSegment {
  const o = obj(v, p);
  const startedAt = time(o.startedAt, `${p}.startedAt`);
  const endedAt = time(o.endedAt, `${p}.endedAt`);
  if (endedAt < startedAt) fail(`${p}.endedAt`, 'segment ends before it starts');
  return { side: oneOf(o.side, SIDES, `${p}.side`), startedAt, endedAt };
}

function parseEntry(v: unknown, p: string): FeedingEntry {
  const o = obj(v, p);
  const id = str(o.id, `${p}.id`, { nonEmpty: true });
  const babyId = str(o.babyId, `${p}.babyId`, { nonEmpty: true });
  const note = optStr(o.note, `${p}.note`);
  const type = oneOf(o.type, ['breast', 'bottle', 'solid'] as const, `${p}.type`);
  switch (type) {
    case 'breast': {
      const startedAt = time(o.startedAt, `${p}.startedAt`);
      const endedAt = time(o.endedAt, `${p}.endedAt`);
      if (endedAt < startedAt) fail(`${p}.endedAt`, 'feed ends before it starts');
      const segments = arr(o.segments, `${p}.segments`).map((s, i) =>
        parseSegment(s, `${p}.segments[${i}]`),
      );
      return withOptional<FeedingEntry>(
        { id, babyId, type, startedAt, endedAt, segments },
        { note },
      );
    }
    case 'bottle':
      return withOptional<FeedingEntry>(
        {
          id,
          babyId,
          type,
          at: time(o.at, `${p}.at`),
          content: oneOf(o.content, ['breastmilk', 'formula'] as const, `${p}.content`),
          amountMl: num(o.amountMl, `${p}.amountMl`),
        },
        { note },
      );
    case 'solid':
      return withOptional<FeedingEntry>(
        {
          id,
          babyId,
          type,
          at: time(o.at, `${p}.at`),
          foods: arr(o.foods, `${p}.foods`).map((f, i) => str(f, `${p}.foods[${i}]`)),
        },
        {
          amount: optStr(o.amount, `${p}.amount`),
          isNewFood: optBool(o.isNewFood, `${p}.isNewFood`),
          reaction: optStr(o.reaction, `${p}.reaction`),
          note,
        },
      );
  }
}

function parseMeasurement(v: unknown, p: string): Measurement {
  const o = obj(v, p);
  return withOptional<Measurement>(
    {
      id: str(o.id, `${p}.id`, { nonEmpty: true }),
      babyId: str(o.babyId, `${p}.babyId`, { nonEmpty: true }),
      date: dateKey(o.date, `${p}.date`),
    },
    {
      weightG: optNum(o.weightG, `${p}.weightG`),
      lengthMm: optNum(o.lengthMm, `${p}.lengthMm`),
      headMm: optNum(o.headMm, `${p}.headMm`),
      note: optStr(o.note, `${p}.note`),
    },
  );
}

function parseTimer(v: unknown, p: string): ActiveTimer {
  const o = obj(v, p);
  const segments = arr(o.segments, `${p}.segments`).map((s, i): TimerSegment => {
    const sp = `${p}.segments[${i}]`;
    const so = obj(s, sp);
    const startedAt = time(so.startedAt, `${sp}.startedAt`);
    const endedAt =
      so.endedAt === undefined || so.endedAt === null
        ? undefined
        : time(so.endedAt, `${sp}.endedAt`);
    if (endedAt !== undefined && endedAt < startedAt)
      fail(`${sp}.endedAt`, 'segment ends before it starts');
    return withOptional<TimerSegment>(
      { side: oneOf(so.side, SIDES, `${sp}.side`), startedAt },
      { endedAt },
    );
  });
  if (segments.length === 0) fail(`${p}.segments`, 'timer has no segments');
  const pausedAt =
    o.pausedAt === undefined || o.pausedAt === null ? undefined : time(o.pausedAt, `${p}.pausedAt`);
  return withOptional<ActiveTimer>(
    { babyId: str(o.babyId, `${p}.babyId`, { nonEmpty: true }), segments },
    { pausedAt },
  );
}

function parseSettings(v: unknown, p: string): Settings {
  if (v === undefined || v === null) return { ...DEFAULT_SETTINGS };
  const o = obj(v, p);
  const pick = <T extends string>(key: keyof Settings, allowed: readonly T[], fallback: T): T =>
    o[key] === undefined ? fallback : oneOf(o[key], allowed, `${p}.${key}`);
  const activeBabyId =
    o.activeBabyId === undefined || o.activeBabyId === null
      ? null
      : str(o.activeBabyId, `${p}.activeBabyId`);
  return {
    volumeUnit: pick('volumeUnit', ['ml', 'oz'] as const, DEFAULT_SETTINGS.volumeUnit),
    weightUnit: pick('weightUnit', ['kg', 'lb'] as const, DEFAULT_SETTINGS.weightUnit),
    theme: pick('theme', ['auto', 'light', 'dark'] as const, DEFAULT_SETTINGS.theme),
    activeBabyId,
  };
}

function assertUniqueIds(items: readonly { id: string }[], path: string): void {
  const seen = new Set<string>();
  items.forEach((item, i) => {
    if (seen.has(item.id)) fail(`${path}[${i}].id`, `duplicate id "${item.id}"`, 'DUPLICATE_ID');
    seen.add(item.id);
  });
}

/**
 * Validates and normalises the `data` payload of a backup (also used to sanity-check persisted state).
 * Throws nothing — returns a result.
 */
export function validateBackupData(raw: unknown): ParseBackupResult {
  try {
    return { ok: true, data: parseData(raw, 'data') };
  } catch (e) {
    return { ok: false, error: toBackupError(e) };
  }
}

function parseData(raw: unknown, p: string): BackupData {
  const o = obj(raw, p);
  const babies = arr(o.babies, `${p}.babies`).map((b, i) => parseBaby(b, `${p}.babies[${i}]`));
  const entries = arr(o.entries, `${p}.entries`).map((e, i) => parseEntry(e, `${p}.entries[${i}]`));
  const measurements = arr(o.measurements ?? [], `${p}.measurements`).map((m, i) =>
    parseMeasurement(m, `${p}.measurements[${i}]`),
  );
  const timersObj = obj(o.activeTimers ?? {}, `${p}.activeTimers`);
  const activeTimers: Record<string, ActiveTimer> = {};
  for (const [key, t] of Object.entries(timersObj)) {
    const timer = parseTimer(t, `${p}.activeTimers.${key}`);
    if (timer.babyId !== key)
      fail(`${p}.activeTimers.${key}.babyId`, 'timer key does not match babyId');
    activeTimers[key] = timer;
  }
  const settings = parseSettings(o.settings, `${p}.settings`);

  assertUniqueIds(babies, `${p}.babies`);
  assertUniqueIds(entries, `${p}.entries`);
  assertUniqueIds(measurements, `${p}.measurements`);

  const babyIds = new Set(babies.map((b) => b.id));
  const checkRef = (babyId: string, path: string): void => {
    if (!babyIds.has(babyId)) fail(path, `unknown babyId "${babyId}"`, 'UNKNOWN_BABY');
  };
  entries.forEach((e, i) => checkRef(e.babyId, `${p}.entries[${i}].babyId`));
  measurements.forEach((m, i) => checkRef(m.babyId, `${p}.measurements[${i}].babyId`));
  Object.keys(activeTimers).forEach((id) => checkRef(id, `${p}.activeTimers.${id}`));

  // A dangling active baby is repaired (not rejected): fall back to the first baby.
  if (settings.activeBabyId === null || !babyIds.has(settings.activeBabyId)) {
    settings.activeBabyId = babies[0]?.id ?? null;
  }
  return { babies, entries, measurements, activeTimers, settings };
}

/** Record kinds that can be validated one at a time (used by cloud sync for remote documents). */
export interface RecordTypes {
  baby: Baby;
  entry: FeedingEntry;
  measurement: Measurement;
  timer: ActiveTimer;
}
export type RecordKind = keyof RecordTypes;

const RECORD_PARSERS: { [K in RecordKind]: (v: unknown, p: string) => RecordTypes[K] } = {
  baby: parseBaby,
  entry: parseEntry,
  measurement: parseMeasurement,
  timer: parseTimer,
};

/**
 * Validates and normalises ONE record with the same strict rules as backup import (unknown fields
 * stripped). Returns `null` for malformed data — never throws.
 */
export function parseRecord<K extends RecordKind>(kind: K, raw: unknown): RecordTypes[K] | null {
  try {
    return RECORD_PARSERS[kind](raw, kind);
  } catch {
    return null;
  }
}

function toBackupError(e: unknown): BackupError {
  if (e instanceof ValidationError) return { code: e.code, path: e.path, message: e.message };
  return { code: 'INVALID_DATA', message: e instanceof Error ? e.message : String(e) };
}

/** Parses a backup file's text. Never throws; never returns partial data. */
export function parseBackup(json: string): ParseBackupResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json.replace(/^\uFEFF/, ''));
  } catch {
    return { ok: false, error: { code: 'INVALID_JSON', message: 'File is not valid JSON' } };
  }
  if (!isObject(raw) || raw.format !== BACKUP_FORMAT) {
    return {
      ok: false,
      error: { code: 'NOT_A_BACKUP', message: 'Missing or wrong "format" marker' },
    };
  }
  const version = raw.version;
  if (
    typeof version !== 'number' ||
    !Number.isInteger(version) ||
    version < 1 ||
    version > BACKUP_VERSION
  ) {
    return {
      ok: false,
      error: {
        code: 'UNSUPPORTED_VERSION',
        path: 'version',
        message: `Unsupported backup version ${String(version)}`,
      },
    };
  }
  // Future: migrate older versions here before validating.
  try {
    const data = parseData(raw.data, 'data');
    return typeof raw.exportedAt === 'number'
      ? { ok: true, data, exportedAt: raw.exportedAt }
      : { ok: true, data };
  } catch (e) {
    return { ok: false, error: toBackupError(e) };
  }
}

// ---------------------------------------------------------------- CSV

const UTF8_BOM = '\uFEFF';
const TYPE_LABEL: Record<FeedingEntry['type'], string> = {
  breast: 'הנקה',
  bottle: 'בקבוק',
  solid: 'מוצקים',
};
const CONTENT_LABEL = { breastmilk: 'חלב אם', formula: 'תמ״ל' } as const;
const SIDE_LABEL = { left: 'שמאל', right: 'ימין' } as const;

export const FEEDINGS_CSV_HEADERS = [
  'תינוק',
  'סוג',
  'תאריך',
  'שעת התחלה',
  'שעת סיום',
  'משך (דקות)',
  'שמאל (דקות)',
  'ימין (דקות)',
  'צד אחרון',
  'תוכן',
  'כמות (מ״ל)',
  'מזונות',
  'כמות מוצקים',
  'מזון חדש',
  'תגובה',
  'הערה',
] as const;

/**
 * Escapes one CSV cell. Text cells starting with = + - @ (or tab/CR) are prefixed with an apostrophe
 * to prevent spreadsheet formula injection (OWASP CSV injection guidance).
 */
export function csvCell(value: string | number | undefined): string {
  if (value === undefined) return '';
  if (typeof value === 'number') return String(value);
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function toCsv(rows: readonly (readonly (string | number | undefined)[])[]): string {
  return UTF8_BOM + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

const minutes = (ms: number): number => Math.round((ms / 60_000) * 10) / 10;

/**
 * Feedings → Excel-friendly CSV (UTF-8 with BOM, CRLF, Hebrew headers), newest first.
 * Times are LOCAL (`YYYY-MM-DD`, `HH:mm`). Durations in minutes (one decimal).
 */
export function feedingsToCsv(entries: readonly FeedingEntry[], babies: readonly Baby[]): string {
  const names = new Map(babies.map((b) => [b.id, b.name]));
  const rows = [...entries].sort(compareEntriesDesc).map((e) => {
    const start = entryTime(e);
    const common = [
      names.get(e.babyId) ?? '',
      TYPE_LABEL[e.type],
      toDateKey(start),
      formatClock(start),
    ];
    switch (e.type) {
      case 'breast': {
        const d = breastDurations(e);
        const lastSeg = [...e.segments].sort((a, b) => a.startedAt - b.startedAt).pop();
        return [
          ...common,
          formatClock(entryEndTime(e)),
          minutes(d.total),
          minutes(d.left),
          minutes(d.right),
          lastSeg ? SIDE_LABEL[lastSeg.side] : undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          e.note,
        ];
      }
      case 'bottle':
        return [
          ...common,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          CONTENT_LABEL[e.content],
          e.amountMl,
          undefined,
          undefined,
          undefined,
          undefined,
          e.note,
        ];
      case 'solid':
        return [
          ...common,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          e.foods.join('; '),
          e.amount,
          e.isNewFood ? 'כן' : undefined,
          e.reaction,
          e.note,
        ];
    }
  });
  return toCsv([FEEDINGS_CSV_HEADERS, ...rows]);
}

export const MEASUREMENTS_CSV_HEADERS = [
  'תינוק',
  'תאריך',
  'משקל (גרם)',
  'אורך (ס״מ)',
  'היקף ראש (ס״מ)',
  'הערה',
] as const;

/** Measurements → CSV (UTF-8 BOM, CRLF), oldest first. */
export function measurementsToCsv(
  measurements: readonly Measurement[],
  babies: readonly Baby[],
): string {
  const names = new Map(babies.map((b) => [b.id, b.name]));
  const rows = [...measurements]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((m) => [
      names.get(m.babyId) ?? '',
      m.date,
      m.weightG,
      m.lengthMm === undefined ? undefined : m.lengthMm / 10,
      m.headMm === undefined ? undefined : m.headMm / 10,
      m.note,
    ]);
  return toCsv([MEASUREMENTS_CSV_HEADERS, ...rows]);
}
