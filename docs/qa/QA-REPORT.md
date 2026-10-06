# BabyMonitor: QA Report

QA Engineer · build tested: working tree as of 6 Oct 2026 (commits up to `4b529fe` plus in-progress engineer edits) · Chromium (`/opt/pw-browsers/chromium`), mobile viewport 390×844 (plus 360×640 and 768 for layout), `he-IL`, `Asia/Jerusalem`.

## 1. Summary

- **12 bugs found.** Engineering fixed 10 of them while QA was running: BUG-001 to 006, 008, 010, 011 and 012. Each fix is verified by a passing regression test in the final run.
- **2 remain open, both Minor:** BUG-007 (lb edit changes the stored grams) and BUG-009 (reversed ranges in insight copy). Fixes for both are in the working tree, not yet committed (`measurementForm.ts`, `insightCopy.ts`).
- There are no Blocker bugs. The main flows work end to end in light and dark themes and from 360px to 768px:
  - onboarding
  - breastfeeding timer (switch / pause / resume / reload / stale)
  - bottle, solids
  - history, growth with WHO percentiles, stats
  - settings, backup / CSV
  - offline PWA
- **Console:** no errors or warnings on any page or flow (every test enforces this).
- **Layout:** no horizontal overflow at 360px on any page or open sheet. RTL order is correct.
- **WHO percentiles** match an independent LMS computation from `data/who/weianthro.txt`.
- **Performance** is good. With one year of data (4,015 entries) and 4× CPU throttling, every screen renders in ≤ 0.82 s (see §5).

### E2E suite: `npm run e2e` result (final run)

```
115 tests (113 QA in 14 spec files + 2 smoke) · 113 passed · 2 failed   (2.2 min)
```

The 2 failures are open-bug tests. They assert the CORRECT behaviour on purpose and will pass once the fixes land:

| Failing test | Fails until |
|---|---|
| `growth.spec.ts` › editing only the note in lb mode keeps the stored grams (BUG-007) | BUG-007 |
| `growth.spec.ts` › numeric ranges in growth insights are not visually reversed (BUG-009) | BUG-009 |

These regression tests failed during QA and now pass after the engineering fixes:

- BUG-001 to BUG-006
- BUG-008: `persistence.spec.ts` › unparseable JSON …
- BUG-010: `babies.spec.ts` › … non-active baby …
- BUG-011: `layout.spec.ts` › long name …
- BUG-012: `bottle.spec.ts` › oz edit sheet …

Note on runs: `playwright.config.ts` reuses any server already on port 4173. Twice during QA, someone else's preview server on that port went away mid-run and caused a mass `ERR_CONNECTION_REFUSED`. That is environmental, not a product failure. Rerun with port 4173 free.

`npm run lint`, `npm run typecheck` (`tsc -b`, incl. `tsconfig.e2e.json`) and `prettier --check` pass for all QA files in `e2e/`.

## 2. Bug list

Severity scale: **Blocker** = core flow unusable / data loss for everyone · **Major** = wrong data, data loss in a plausible case, or a flow that misleads · **Minor** = wrong but recoverable / small · **Cosmetic** = visual only.

### Found by QA: details

These bugs were open when found. Their status is in each heading.

#### BUG-008 · Major · ✅ FIXED during QA (`4b529fe`) · Unreadable stored data is silently discarded (no `:corrupt` copy)
- **Area:** `src/store/appStore.ts` (zustand `persist` + `createJSONStorage`).
- **Steps:**
  1. Put a non-JSON / truncated value in localStorage `babymonitor:v1`, e.g. `{"state":{"babies":[{"id":"b1","name":"נועה"`. This is what an interrupted write or a full disk can leave behind.
  2. Open the app.
  3. Complete onboarding, or make any change.
- **Expected:** The same as for schema-invalid data, which works today. The unreadable value is kept in `babymonitor:v1:corrupt` and an error is logged. The user's bytes are never destroyed.
- **Actual:**
  - JSON parsing throws inside zustand's storage *before* the store's `merge()` runs, so the `:corrupt` safeguard never runs.
  - Nothing is logged.
  - The app silently starts at onboarding.
  - The first write overwrites the original bytes: all history is lost with no way to recover it.
- **Evidence:** `docs/qa/evidence/BUG-008-unparseable-storage-starts-fresh.png`. Test: `persistence.spec.ts` (BUG-008).
- **Fix hint:** use a custom `storage.getItem` that catches the `JSON.parse` error, stashes the raw string in `${name}:corrupt`, and returns `null`.

#### BUG-010 · Major · ✅ FIXED during QA (`4b529fe`, `useBannerTimer`) · A running breastfeeding timer for the non-active baby is invisible
- **Area:** `src/app/AppLayout.tsx` / `TimerBanner` (they use `useActiveTimer()` = active baby only). `selectAllTimers` exists but is unused.
- **Steps:**
  1. With twins A and B, start a feed for B.
  2. Switch to A (header switcher).
  3. Browse any tab.
- **Expected:** DESIGN §6.18 says "appears on every tab while a timer exists". A parent tending twins must see that B is still feeding, so the timer isn't forgotten and doesn't end up in the > 6 h stale flow.
- **Actual:** A's screens show no banner and no indicator anywhere. The only hint is a small "הנקה" badge inside the baby-switcher sheet.
- **Evidence:** `BUG-010-other-baby-timer-invisible-history.png`, `BUG-010-other-baby-timer-invisible-home.png`. Test: `babies.spec.ts` (BUG-010).

#### BUG-007 · Minor · OPEN (fix in progress, uncommitted) · Editing a measurement in lb mode silently changes the stored weight
- **Area:** `src/features/growth/measurementForm.ts` (`measurementToFormValues` pre-fills `gToLb(g).toFixed(2)`), `MeasurementSheet.tsx`.
- **Steps:**
  1. Settings → weight unit lb.
  2. Growth → tap a measurement of 3,346 g (shown 7.38 lb).
  3. Change only the note and save.
- **Expected:** `weightG` stays 3346. The bottle sheet already does this for ml/oz: it keeps the stored value when the amount is untouched.
- **Actual:** `weightG` becomes **3348**. The rounded lb value is converted back on every save, which changes medical data the user didn't touch.
- **Evidence:** `BUG-007-lb-edit-prefill.png`. Test: `growth.spec.ts` (BUG-007).

#### BUG-009 · Minor · OPEN (fix in progress, uncommitted) · Numeric ranges in growth insight text are shown reversed (RTL bidi)
- **Area:** `src/features/growth/insightCopy.ts` (the strings are plain text inside RTL paragraphs).
- **Steps:**
  1. Newborn with 7–10 % weight loss (e.g. birth 3,500 g, day 3 → 3,200 g). Banner text: "ירידה של 7%–10% בימים הראשונים…".
  2. Baby 3–6 m with slow gain. Text: "…הטווח הנפוץ בגיל הזה הוא 100–150 גר׳ לשבוע".
- **Expected:** Ranges render in reading order, as DESIGN §11.3 requires (LTR isolate).
- **Actual:** They display as **"10%–7%"** and **"150–100 גר׳"**. This is medical-adjacent copy, so reversed ranges are misleading. An automated scan of every page / tab / baby found only these 2 instances: all other ranges (milk guideline 120–180, chart subtitles, legends) are correctly isolated.
- **Evidence:** `BUG-009-range-reversed-7-10.png`, `BUG-009-range-reversed-100-150-dark.png`, `BUG-009-range-reversed-100-150-768.png`. Test: `growth.spec.ts` (BUG-009), via helper `unisolatedRanges()` in `e2e/fixtures.ts`.

#### BUG-012 · Minor · ✅ FIXED during QA (`4b529fe`) · oz mode: the edit sheet shows a different amount than the lists
- **Area:** `src/features/feeding/BottleSheet.tsx` (`displayVolume` rounds to the 0.5 oz step).
- **Steps:**
  1. Volume unit oz.
  2. A 125 ml bottle shows "4.2 oz" in History / Home.
  3. Tap it.
- **Expected:** The stepper shows 4.2.
- **Actual:** The stepper shows **4**. The stored ml is preserved when untouched, which is good. But the editor misreports the logged amount, and any +/− starts from the wrong value (4 → 4.5).
- **Evidence:** `BUG-012-list-shows-4.2oz.png`, `BUG-012-editor-shows-4oz.png`. Test: `bottle.spec.ts` (BUG-012).

#### BUG-011 · Cosmetic · ✅ FIXED during QA (`4b529fe`) · A long baby name wraps onto two lines and grows the header
- **Area:** `.baby-switch__name` (`src/app/BabySwitcher.tsx` / `components.css`).
- **Steps:** At 360px, use a 30-character name ("אלכסנדרה-מרגריטה בת-שבע לוי").
- **Expected:** One line with an ellipsis (`.truncate`), and the header stays 56px.
- **Actual:** The name wraps to 2 lines (43px tall), which pushes the header down.
- **Evidence:** `BUG-011-long-name-wraps-header.png`. Test: `layout.spec.ts` (BUG-011).

### Fixed during QA, earlier batch (regression tests in place, all passing)

| ID | Sev. | Summary | Area | Regression test |
|---|---|---|---|---|
| BUG-001 | Major | Next-side suggestion wrong after pause/resume. "left 3′ ‖ pause ‖ left 1′" counted as an unfinished 1′ segment, so it suggested left again. | `src/domain/feeding.ts` `suggestNextSide` (now `lastSideRunMs`) | `breastfeeding.spec.ts` › pause/resume on the last side does not flip the suggestion (BUG-001) |
| BUG-002 | Major | Growth "כמות חלב יומית משוערת" card gave an ml target to a breastfed / mixed-fed baby, and counted breastfeeds in "האכלות ביום" (DESIGN §6.20 / §14.3). | `src/features/growth/milkModel.ts` (now uses shared `isMainlyBottleFed`) | `growth.spec.ts` › daily milk guideline card: only for a mainly bottle-fed baby |
| BUG-003 | Cosmetic | Stats: a zero change showed a "trending up" icon. | `src/features/stats/StatsPage.tsx` | `stats.spec.ts` › a zero change is shown as neutral |
| BUG-004 | Major | Rapid double tap on "שמירה" created duplicate entries. The sheet stayed clickable during its exit animation. Affected bottle, solids, manual breastfeed and measurement sheets. | `src/components/Sheet.tsx` (now `inert` while closing) | `bottle.spec.ts` › a rapid double tap on save creates only one entry (also verified for solids / manual / measurement) |
| BUG-005 | Minor | Solids: after typing a food, the first tap on a chip below was lost. Blur committed the draft as a chip, so the layout jumped 48px between pointerdown and pointerup. | `src/features/feeding/SolidSheet.tsx` | `solids.spec.ts` › first tap after typing a food is not lost (BUG-005) |
| BUG-006 | Minor | Home "אתמול: N" used `now − 24h`. On the DST change day (25 Oct 2026, 23:00–23:59) it showed today's count. | `src/features/home/HomePage.tsx` | `home.spec.ts` › "אתמול" count … on the DST change day (BUG-006). Evidence (after fix): `BUG-006-after-fix-yesterday-count-dst.png` |

### Observations (not filed as bugs; for the Team Lead / engineers)

- **OBS-1 · History paging (gate removed).**
  - An earlier commit started infinite scroll only after the first tap on "הצגת ימים נוספים", so the button couldn't jump away under the user's finger.
  - HEAD no longer has that gate. Scrolling the button into view loads more days and moves the button mid-tap. Playwright's own click hit exactly this ("element was detached"), so real taps can be swallowed too.
  - **Recommendation:** restore the gate, or trigger loading from a sentinel *below* the button.
  - The tests accept both designs.
- **OBS-2 · Import while a feed is running.** Importing a backup replaces a running timer without a word. The confirm text says "replaces all data", which is technically correct, but consider "(כולל הנקה פעילה)".
- **OBS-3 · Counts differ between screens.** Home "האכלות" and Stats "האכלות ביום" count milk feeds only. The "האכלות לפי יום" chart stacks solids too, so the headline number (e.g. 9) is lower than the bar height (11). This follows a documented domain rule, but a legend note would avoid confusion.
- **OBS-4 · Storage growth.** One year ≈ 746 KB in localStorage. At ~5 MB that is roughly 6 years of headroom. Every save re-serialises the whole store synchronously (§5). The `err.storageFull` path was not exercised: quota errors are hard to provoke in Chromium.
- **OBS-5 · Single-baby switcher.** With one baby the switcher is not inert and shows its chevron (DESIGN §6.24 says inert). This is reasonable, because it is the entry point to "הוספת ילד/ה", but the spec should be updated.
- **OBS-6 · Birth weight.** It is stored only on `Baby.birthWeightG`, not as a Measurement (DESIGN §7.1 says both). Engineering chose a single source of truth on purpose. Growth shows it as the "משקל לידה" row, and percentiles / insights use it correctly.

## 3. Coverage matrix

✅ = automated E2E (passing) · ❌ = automated, failing until the bug is fixed · 🔍 = exploratory (scripted Playwright + screenshots)

| Area | What was verified | E2E file | Status |
|---|---|---|---|
| First run / onboarding | Hebrew RTL, no tab bar, required name / date / sex, future date, > 3 years, > 30 chars, birth-weight range, focus on first invalid field, lands on Home, persisted shape | `onboarding.spec.ts` | ✅ |
| Multiple babies | Add 2nd baby via switcher, switch both ways, isolation in Home / History / Growth (sex label), per-baby timers, delete baby with confirm (only its data), non-active baby's timer visibility | `babies.spec.ts` | ✅ (BUG-010 fixed) |
| Breastfeeding timer | Right → left → pause → resume → finish with exact per-side durations, toast, undo restores timer, survives reload and keeps counting (clock API), banner on non-Home tabs, Home live card, pause/resume from banner, cancel + confirm + undo, < 1 min confirm, manual entry (validation, chips, stepper, default −30′, end-in-future), edit start time (incl. future refused), 90-min reminder, stale > 6 h (default end, custom end, end < start), next-side rule (other side, < 2 min same side, pause run) | `breastfeeding.spec.ts` | ✅ |
| Bottle | Defaults, content seg, chips + stepper (snap / bounds / disabled), retro time chip, note, last-used defaults, 0 / NaN / > 500 rejected, > 400 warning, future time, edit + undo, delete + undo (exact restore), dirty-close confirm, double tap, ml ↔ oz everywhere (tile, hero, today, history, day summary, chips), whole-ml storage, ml unchanged on note-only edit, oz editor value | `bottle.spec.ts` | ✅ (BUG-012 fixed) |
| Solids | Enter / comma chips, remove chip, empty validation + focus, new-food auto flag, amount chip select / clear, reactions incl. "אחר" text round trip, recent-food suggestions (order, de-dup, case / space), timeline meta / badge / note, solids-only day summary | `solids.spec.ts` | ✅ |
| History | Empty state, day grouping + Hebrew titles (היום / אתמול / weekday / שבת), newest first, midnight-crossing feed under its start day (seeded and live), exact day summaries, filters + empty filter + "הצגת הכול", 14-day paging + load more / infinite scroll, edit breastfeed minutes, **DST 25 Oct** (times, 30-min feed across fall-back, grouping) | `history.spec.ts` | ✅ |
| Home totals | Exact hero (since last milk feed), last-feed meta, next side, tile metas, today: feeds / yesterday / ml / bottles / breast min / avg interval (2:10), recent 3, "—" when no data, since formats (עכשיו / minutes / יום אחד / ימים), bottle-only guideline (480–720 ml, 100 ml × 6, meter aria), DST "yesterday" | `home.spec.ts` | ✅ |
| Growth | Empty state, add kg + length + head, grams input (> 100), lb input / display, validation (none, < 0.5, > 30, NaN, length, head, before birth, future), WHO P50 for boy 3.3464 kg at birth, girl day 65 5.00 kg and boy day 30 3.9 kg vs independent LMS math, < P3 banner, > 10 % loss banner (11.4 %) + consult copy, % vs birth, gain / day and / week, edit, delete + undo, dirty close, milk card only when bottle-fed, lb edit drift, reversed ranges | `growth.spec.ts`, `who.ts` | ✅ / ❌ BUG-007, BUG-009 |
| Stats | Empty state (< 2 days), 7-day averages over complete days (6 / 300 ml / 30′ / 4:00), deltas (+1, +60 מ״ל, +6 ד׳, −42 ד׳) + SR context + caption, 14 / 30 days averaged only since the first entry (5.5 / 270 / 27 / 4:22), no delta without previous period, oz, guideline band only for bottle-fed, charts + "היום" tick, zero delta neutral | `stats.spec.ts` | ✅ |
| Settings | Theme auto / light / dark → `data-theme` + theme-color + body bg + persists + arrow keys, export JSON (download, name, format, equality with store), **round trip into a fresh browser context** via onboarding import, import with confirm (summary, safe focus), invalid JSON / not-a-backup / future version / corrupt record → Hebrew error toast and nothing changed, import while a timer runs, CSV feedings + measurements (BOM, CRLF, exact Hebrew headers, rows, formula-injection escaping), delete-all double confirm (cancel at step 2 keeps data) → onboarding, About | `settings.spec.ts` | ✅ |
| Persistence | Reload keeps entries / units / active baby, persisted envelope `{state, version: 1}`, schema-invalid data → onboarding + `:corrupt` copy, garbage never crashes, future store version not lost, unparseable JSON | `persistence.spec.ts` | ✅ (BUG-008 fixed) |
| Accessibility | Every page and every sheet / dialog: no unlabeled controls (Chromium AX tree via CDP), `dir=rtl`, one `h1`, `aria-current` tab, Esc closes sheets, focus returns to trigger, initial focus (first field / right side), focus trap, nested confirm Esc keeps parent, safe-action focus, polite toast with real undo button, `role=timer` `aria-live=off`, banner `role=status`, side-button labels | `a11y.spec.ts`, `walk.ts` | ✅ |
| Console hygiene | Every test fails on any console error / warning / page error (auto fixture `consoleGuard`) | `fixtures.ts` | ✅ |
| Layout | No horizontal overflow at 360×640 on every page and every sheet, light + dark, worst-case content (long names / foods / notes, 450 ml, running timer), long-name header | `layout.spec.ts` | ✅ (BUG-011 fixed) |
| PWA | Manifest linked + valid (he / rtl / standalone / colors / short_name ≤ 12 / icons 192, 512, maskable fetched and PNG size-checked), index meta, SW registers + activates, **offline reload** of Home / Growth (WHO chunk) / Stats, no external requests (self-hosted fonts) | `pwa.spec.ts` | ✅ |
| Exploratory 🔍 | Light / dark at 360 / 390 / 768; midnight + DST live timers; 0 / 1 / many entries; 1-year perf; rapid double taps (all sheets); timer for A while on B; import during a timer; lb / oz round trips; Hebrew truncation; RTL mirroring (side buttons, stepper, tabs); number / range reversal scan on all pages; medical copy (loss 7 % / 10 %, regain by day 14, P3 / P97, crossing lines, 120–180 ml/kg capped 1,000, typical gains) | scratch scripts | findings above |

**Medical copy review:** thresholds and wording match PRD §1. The flags are:

- > 10 % loss → "מצדיקה בדיקה", 7–10 % → follow closely
- not regained by day 14
- < P3 / > P97
- downward crossing of 2 lines
- slow gain vs 150–200 / 100–150 / 70–90 g/week

Each flag ends with "כדאי להתייעץ עם רופא/ת הילדים", and every guideline figure carries "הנחיה כללית" or a disclaimer. The only copy defect is the reversed ranges (BUG-009).

## 4. Test infrastructure (for engineers)

- **`e2e/fixtures.ts`**
  - `test` with the auto console guard; opt out per test with `test.use({ consoleAllow: /regex/ })`.
  - Typed data builders: `makeBaby`, `breast`, `bottle`, `solid`.
  - `seed()` writes the exact persisted envelope before boot, once per tab, so reloads exercise real persistence.
  - `readStore()` / `readEnvelope()` / `readRaw()`.
  - `freezeClockAt()` (fake clock from NOW = Mon 5 Oct 2026 14:00 IDT).
  - `mmss()` / `expectApprox()` for second-level tolerance.
  - `expectNoUnlabeledControls()` (CDP AX tree), `expectNoHorizontalOverflow()`, `unisolatedRanges()`.
- **`e2e/walk.ts`** opens every sheet / dialog in the app (shared by the a11y and layout specs).
- **`e2e/who.ts`** is an independent WHO LMS percentile implementation that reads `data/who/weianthro.txt` (no app imports).
- **Clock note:** the clock runs in real time after `install`. Pausing it breaks React Suspense / lazy routes, so tests jump time with `page.clock.fastForward()`.

## 5. Performance (1 year ≈ 4,015 entries + 52 measurements, 746 KB stored)

Median of 3 runs, preview build, 390×844:

| Action | Desktop CPU | 4× CPU throttle (≈ mid-range phone) |
|---|---|---|
| Cold load → Home rendered | 437 ms | 812 ms |
| Tab → History (14 days) | 52 ms | 135 ms |
| History filter "בקבוק" | 133 ms | 482 ms |
| Tab → Stats (7 days) | 185 ms | 652 ms |
| Stats → 30 days | 127 ms | 503 ms |
| Tab → Growth | 189 ms | 414 ms |
| Tab → Home | 80 ms | 608 ms |
| Add bottle (open + save) | 135 ms | 399 ms |
| Longest main-thread task | 85 ms | 415 ms |

- **Verdict:** acceptable. Nothing exceeds 1 s, even throttled.
- Home and Stats recompute over all entries on each visit, and every save `JSON.stringify`s the whole store (≈ 0.75 MB). These are the first places to optimise if data grows (e.g. memoised per-day aggregates, or IndexedDB).
- Evidence: `PERF-history-1-year.png`.

## 6. Evidence index (`docs/qa/evidence/`)

| File | Shows |
|---|---|
| `BUG-007-lb-edit-prefill.png` | lb editor pre-filled with rounded 7.38 lb |
| `BUG-008-unparseable-storage-starts-fresh.png` | app silently at onboarding with unreadable data, no `:corrupt` |
| `BUG-009-range-reversed-7-10.png` | "10%–7%" in the weight-loss banner |
| `BUG-009-range-reversed-100-150-dark.png`, `BUG-009-range-reversed-100-150-768.png` | "150–100 גר׳" in the slow-gain banner |
| `BUG-010-other-baby-timer-invisible-history.png`, `BUG-010-other-baby-timer-invisible-home.png` | B is feeding, A's screens show nothing |
| `BUG-011-long-name-wraps-header.png` | 2-line name in the header at 360px |
| `BUG-012-list-shows-4.2oz.png`, `BUG-012-editor-shows-4oz.png` | list 4.2 oz vs editor 4 |
| `BUG-006-after-fix-yesterday-count-dst.png` | fixed: "אתמול: 2" at 23:30 on 25 Oct |
| `OK-timer-sheet-360-light.png`, `OK-home-live-feed-360-dark.png`, `OK-dst-live-feed-history.png`, `PERF-history-1-year.png` | reference states that were verified as correct |
