/**
 * Core data model — mirrors docs/PRD.md §4 exactly.
 * Units: times are epoch milliseconds, volumes ml, weights grams, lengths millimetres.
 * Calendar dates (birth date, measurement date) are local `YYYY-MM-DD` strings.
 */

/** Epoch milliseconds (UTC instant). */
export type EpochMs = number;
/** Local calendar date `YYYY-MM-DD` — never parse with `new Date(str)` (that is UTC). */
export type IsoDate = string;

export type Sex = 'male' | 'female';
export type Side = 'left' | 'right';
export type BottleContent = 'breastmilk' | 'formula';
export type VolumeUnit = 'ml' | 'oz';
export type WeightUnit = 'kg' | 'lb';
export type ThemePreference = 'auto' | 'light' | 'dark';

export interface Baby {
  id: string;
  name: string;
  birthDate: IsoDate;
  sex: Sex;
  birthWeightG?: number;
  createdAt: EpochMs;
}

export interface BreastSegment {
  side: Side;
  startedAt: EpochMs;
  endedAt: EpochMs;
}

export interface BreastEntry {
  id: string;
  babyId: string;
  type: 'breast';
  startedAt: EpochMs;
  endedAt: EpochMs;
  segments: BreastSegment[];
  note?: string;
}

export interface BottleEntry {
  id: string;
  babyId: string;
  type: 'bottle';
  at: EpochMs;
  content: BottleContent;
  amountMl: number;
  note?: string;
}

export interface SolidEntry {
  id: string;
  babyId: string;
  type: 'solid';
  at: EpochMs;
  foods: string[];
  amount?: string;
  isNewFood?: boolean;
  reaction?: string;
  note?: string;
}

export type FeedingEntry = BreastEntry | BottleEntry | SolidEntry;
export type FeedingType = FeedingEntry['type'];

/** Distributive `Omit` so it works per union member. */
export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** A feeding entry before an id has been assigned (input to `addEntry`). */
export type NewFeedingEntry = DistributiveOmit<FeedingEntry, 'id'>;

export interface Measurement {
  id: string;
  babyId: string;
  date: IsoDate;
  weightG?: number;
  lengthMm?: number;
  headMm?: number;
  note?: string;
}

export interface TimerSegment {
  side: Side;
  startedAt: EpochMs;
  /** Undefined while this segment is the one currently running. */
  endedAt?: EpochMs;
}

/** A running/paused breastfeeding timer. Persisted so it survives reloads (timestamps, not counters). */
export interface ActiveTimer {
  babyId: string;
  segments: TimerSegment[];
  /** Set while paused; the last segment is closed at this instant. */
  pausedAt?: EpochMs;
}

export interface Settings {
  volumeUnit: VolumeUnit;
  weightUnit: WeightUnit;
  theme: ThemePreference;
  activeBabyId: string | null;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  volumeUnit: 'ml',
  weightUnit: 'kg',
  theme: 'auto',
  activeBabyId: null,
});

export const SIDES: readonly Side[] = ['left', 'right'];
export const FEEDING_TYPES: readonly FeedingType[] = ['breast', 'bottle', 'solid'];
