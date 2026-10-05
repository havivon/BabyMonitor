# BabyMonitor — Product Requirements (PRD)

Owner: Team Lead · Status: Approved for build · UI language: **Hebrew (RTL)**

## 1. Research summary — what such an app needs

Reviewed the category (Huckleberry, Baby Tracker – Nursing, Glow Baby, Baby Connect, Feed Baby) and
pediatric guidance (WHO growth standards, common pediatric rules of thumb). Findings:

**Must have (core value)**
1. **Very fast logging** — parents log at night, one-handed, half asleep. A feed must be loggable in ≤ 3 taps.
   Large touch targets (≥ 48px), dark/night mode, no mandatory fields beyond type.
2. **Breastfeeding timer** with left/right side, pause/resume, switching sides mid-feed, and a
   **"next side" suggestion** (the side not finished last). Timer must survive app close / reload
   (store start timestamps, not ticking counters).
3. **Bottle log** — content (expressed breast milk / formula), amount in ml, time.
4. **Solids log** — food(s), approximate amount, "new food" flag and reaction notes (allergy tracking).
5. **Editable time** — every entry can be logged retroactively (time picker defaulting to now), edited, deleted (with undo).
6. **Dashboard** — time since last feed (live), last feed details, next side, today's totals.
7. **History / timeline** grouped by day, filterable by type.
8. **Weight tracking** — weight (+ optional length & head circumference) over time, chart with
   **WHO percentile curves**, current percentile, gain per day/week, % vs birth weight.
9. **Local-first privacy** — data stays on the device; **backup export/import** (JSON) and CSV export.
10. **Works offline**, installable to home screen (PWA).

**Should have (recommended)**
- Multiple babies (twins / siblings) with quick switching.
- Statistics: last 7 / 14 / 30 days — feeds per day, ml per day, breastfeeding minutes per day, avg interval.
- Guideline calculations with clear "not medical advice" disclaimer:
  - Expected daily milk for bottle-fed infants 0–6 months ≈ **150 ml/kg/day** (range 120–180), capped at ~1000 ml/day.
    Show: today's ml vs. expected range, suggested per-feed amount = daily / feeds-per-day.
  - Newborn weight: normal loss up to ~7% in first days, **> 10% → consult**; birth weight expected regained by **day 10–14**.
  - Typical gain: 0–3 m ≈ 150–200 g/week (≈ 25–30 g/day), 3–6 m ≈ 100–150 g/week, 6–12 m ≈ 70–90 g/week.
  - Percentile from WHO LMS tables (z = ((X/M)^L − 1)/(L·S); percentile = Φ(z)). Flag < 3rd or > 97th percentile, and
    crossing two major percentile lines downward.
- Units: ml/oz and kg/lb toggles (stored internally as ml and grams).
- Light / dark / auto theme.

**Out of scope (v1)**: cloud sync & accounts, push notifications, diaper/sleep tracking, photos.

## 2. Users & key flows
- Parent/caregiver on a phone, often at night. Hebrew speaker.
- Flow A — start breastfeeding: Home → "הנקה" → tap side (ימין/שמאל) → timer runs → switch side / pause → "סיום" → saved.
- Flow B — bottle: Home → "בקבוק" → choose content → amount (stepper + quick chips 30/60/90/120/150 ml) → time (default now) → save.
- Flow C — solids: Home → "מוצקים" → food name (with recent suggestions) → amount → new food? reaction? → save.
- Flow D — weight: Growth tab → "הוספת מדידה" → date, weight (kg/g), optional length/head → chart & percentile update.
- Flow E — first run: onboarding: baby name, birth date, sex (needed for WHO tables), birth weight (optional but recommended).

## 3. Information architecture (bottom tab bar, RTL)
1. **בית** (Home/dashboard)  2. **היסטוריה** (Timeline)  3. **גדילה** (Growth/weight)  4. **סטטיסטיקה** (Stats)  5. **הגדרות** (Settings)
Primary "add" actions on Home as large tiles; an active breastfeeding timer shows as a persistent banner on all tabs.

## 4. Data model (all times are epoch ms; amounts ml; weights grams; lengths mm)
```ts
Baby { id, name, birthDate: 'YYYY-MM-DD', sex: 'male'|'female', birthWeightG?: number, createdAt }
FeedingEntry =
  | { id, babyId, type:'breast', startedAt, endedAt, segments: {side:'left'|'right', startedAt, endedAt}[], note? }
  | { id, babyId, type:'bottle', at, content:'breastmilk'|'formula', amountMl, note? }
  | { id, babyId, type:'solid', at, foods: string[], amount?: string, isNewFood?: boolean, reaction?: string, note? }
Measurement { id, babyId, date:'YYYY-MM-DD', weightG?, lengthMm?, headMm?, note? }
ActiveTimer { babyId, segments: {side, startedAt, endedAt?}[], pausedAt? } // persisted so it survives reloads
Settings { volumeUnit:'ml'|'oz', weightUnit:'kg'|'lb', theme:'auto'|'light'|'dark', activeBabyId }
```
Persisted with a versioned schema (migrations-ready), local only.

## 5. Tech decisions (Team Lead)
- **Vite + React 19 + TypeScript (strict)**, React Router (hash router for static hosting).
- State: **Zustand** with `persist` (localStorage, versioned). Pure domain logic in `src/domain` (no React) — unit tested.
- Dates: **date-fns** + `he` locale. Charts: **Recharts** (rendered inside `dir="ltr"` containers).
- Styling: plain CSS with design tokens (CSS custom properties) owned by the designer in `src/styles/`. Font: Rubik via `@fontsource` (offline).
- PWA: `vite-plugin-pwa` (manifest, offline precache, Hebrew name, icons).
- Quality: ESLint, Prettier, `tsc --noEmit`, **Vitest** (+ Testing Library) for units/components, **Playwright** (Chromium at
  `/opt/pw-browsers/chromium`, mobile viewport) for E2E.
- WHO data: official LMS tables from the WHO `anthro` repository (`data/who/*.txt`) converted at build time to compact modules.

## 6. Quality bar (Definition of Done)
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run e2e` all pass.
- No console errors. Works at 360×640 up to desktop. Full RTL correctness. WCAG AA contrast in both themes.
- All user-facing text in Hebrew, consistent terminology. Empty states, validation messages, and confirmation for destructive actions.
- Medical-adjacent numbers are labeled as guidelines with a disclaimer to consult a pediatrician.
