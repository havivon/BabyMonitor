# BabyMonitor — Design QA review

Reviewer: Design · Build reviewed: `2e5b58a` ("WIP: review fixes and e2e suite in progress"), served with `vite preview --port 4321`.
Method: Playwright (Chromium) with seeded `babymonitor:v1` data (mixed feeding, bottle-only and empty modes). Viewport screenshots at **360×740, 390×844 and 768×1024**, light and dark, with reduced motion on (one run with motion on, to check the sheet animation).
Coverage: 26 scenarios, 343 screenshots. Evidence for the findings is in `docs/design/review/`; every file name is `<scenario>-<theme>-<width>[-step].png`.
Automated checks on every screenshot: no horizontal overflow at any width and no console errors. A text-contrast scan found no text below AA. Every interactive element is at least 48px or has the `::after` hit-area extension.

## What is good (keep it)
- Overall fidelity to the spec and mockups is high. Tokens, radii, card rhythm, tiles, the timeline rail, the sheets and the tab bar all match.
- Timer, sides and banner are correct:
  - ימין is physically on the right.
  - The "הבא בתור" hint and the dashed border show before start.
  - In dark, the active side uses `--color-breast-fill` (no glare).
  - The paused state is clear.
  - The 90-minute warning and the >6 h end-time prompt are implemented as decided.
- RTL basics are right: logical layout, the undo icon is flipped, times use LTR isolates, charts run LTR, progress fills from the right, and the switch thumb travels to the inline end.
- Layout at 768: the content column is centered at 560px, and sheets become a centered 480px dialog with an exit animation (220 ms).
- Focus rings are visible (`focus-light-390-b.png`), and empty states exist on every list screen.

---

## P1 — must fix

**P1-1 · Numeric ranges inside data strings render reversed ("2–3 כפיות" shows as "3–2 כפיות")**
- Screens: Home → "אחרונות", History, solids sheet amount chips, edit-solid sheet.
- Cause: the amount strings from `he.solid.amounts` and stored `entry.amount` are plain text. Hebrew bidi reorders `2–3` as two separate number runs.
- Fix: add a helper to `src/i18n/format.ts`:
  ```ts
  /** Wrap number ranges/signed numbers in LRI…PDI so bidi keeps them LTR inside Hebrew text. */
  export const isolateNumbers = (s: string) =>
    s.replace(/[+−-]?\d+(?:[.,]\d+)?(?:\s*[–-]\s*\d+(?:[.,]\d+)?)?/g, (m) => `⁦${m}⁩`);
  ```
  - Apply it wherever user or preset text is displayed: the `TimelineItem` meta (solids amount and foods), the `SolidSheet` amount chip labels, and the edit-sheet food/amount chips.
  - Do **not** apply it in the CSV export.
  - Alternative for JSX you control: `<span className="ltr">2–3</span>`.
- Evidence: `review/home-light-390-s1.png`, `review/solids-light-390.png`, `review/history-light-360.png`, `review/edit-solid-light-390.png`

**P1-2 · Growth charts: the Y axis always starts at 0, so the curves are squashed and the percentile labels overlap**
- Screens: Growth → משקל (0–10 kg; spec is 2–10), אורך (0–75 cm), היקף ראש (0–45 cm).
- In length and head, the five WHO lines squeeze into the top 20% of the chart, and the "97/85/50/15/3" labels collide.
- Cause: `yDomain()` is correct, but the bands are stacked Areas (a base series plus a delta), so Recharts stretches the domain to include the stack's 0 baseline.
- Fix in `GrowthChart.tsx`:
  1. Render each band as a **range area**: `<Area dataKey={(r) => [r.p3, r.p97]} … />` and `<Area dataKey={(r) => [r.p15, r.p85]} … />`. Remove the stacked base/delta series.
  2. Add `allowDataOverflow` to `<YAxis domain={domain}>`.
  3. Use explicit ticks:
     - weight: every 2 kg from `domain[0]`
     - length and head: every 5 cm
  4. Right-edge percentile labels: keep at least 11px between consecutive labels. Nudge them apart starting from P50, or show only 3/50/97 when the spacing would be under 11px.
- Expected result: weight 2–10, length 45–75, head 30–50, curves filling the plot as in `mockup-light.png`.
- Evidence: `review/growth-light-390.png`, `review/growth-light-390-length.png`, `review/growth-dark-390-head.png`

**P1-3 · The milk-target card shows on Growth for a mixed-fed baby (breaks Team Lead decision 3)**
- Screen: Growth (משקל). "כמות חלב יומית משוערת 698–1,000 מ״ל · כ-110 מ״ל להאכלה" appears although the baby is breastfed several times a day.
- Fix: in `GrowthPage.tsx`, render `MilkGuideCard` only when the same "mainly bottle-fed" predicate used by Home's `MilkGuideline` is true (no breastfeeding in the last 72 h).
  - Export that predicate once from `features/home/milkGuide.ts`, or move it to `domain/feeding.ts`, and use it in both places.
- Evidence: `review/growth-light-390-s1.png`. Compare `review/home-bottle-light-390-s1.png`, which correctly shows the meter for a bottle-only baby.

**P1-4 · Dark mode: the switch's "off" thumb is invisible (1.22:1 against the track; fails WCAG 1.4.11)**
- Screen: Solids → "מזון חדש" (off state).
- Fix: this is design-owned CSS. Engineers may apply it verbatim:
  - `tokens.css`: add `--color-switch-thumb: #ffffff;` to the light block and `--color-switch-thumb: #d9d1c5;` to **both** dark blocks (9.25:1 on `#302b27`).
  - `components.css`: `.switch::before { background: var(--color-switch-thumb); }` and `.switch:checked::before { background: var(--color-on-primary); }`.
    - Checked contrast: white on teal (5.5:1) in light, `#0f2421` on mint (8.2:1) in dark.
- Evidence: `review/solids-dark-390-errors.png`

---

## P2 — should fix

**P2-1 · Home with an active timer shows the same live time three times** (hero "הנקה בתהליך 12:47", tile meta "פעילה · 12:47", banner "12:47")
- The new active hero is a good change, and Design accepts it as a spec amendment to §6.4 and §7.2.
- Fix:
  - On the Home route only, do not render `.timer-banner`. Also drop `app--has-timer` there.
  - Make the active hero a `button.card.card--interactive` that opens the timer sheet, with `aria-label` "פתיחת טיימר ההנקה".
  - Change the tile meta to "פעילה · ימין" (side, not time).
  - Keep the banner on every other tab.
- Evidence: `review/home-timer-light-360.png`, `review/home-timer-light-768.png`

**P2-2 · Bottle stepper: the focus ring covers the unit "מ״ל"**
- The input box is 4.2ch at 40px, so its outline runs over the unit.
- Fix in `components.css`:
  - `.stepper__input { inline-size: 3.6ch; border-radius: var(--radius-sm); }`
  - `.stepper__value { gap: var(--space-2); }`
  - `.stepper__input:focus-visible { outline-offset: 2px; }`
- Also do not auto-select or focus the input when a chip or ± is pressed; keep focus on the pressed button.
- Evidence: `review/bottle-light-390-warn.png`

**P2-3 · Dark mode: segmented tracks and the stepper well disappear inside sheets**
- `surface-2` (`#272320`) on `surface-raised` (`#25211e`) is 1.02:1.
- Fix:
  - In both dark blocks of `tokens.css`, set `--color-surface-2: #2e2925`. `text-muted` on it is still 6.2:1.
  - Add `.sheet .seg, .sheet .stepper { box-shadow: inset 0 0 0 1px var(--color-border); }` to `components.css`.
- Evidence: `review/bottle-dark-390.png`, `review/bottle-dark-768.png`

**P2-4 · Stats: delta lines wrap onto 2–3 lines at 360–390** ("+43 מ״ל מהשבוע / הקודם")
- Fix in `StatsPage.tsx`:
  - The delta shows only the signed value and unit (`+43 מ״ל`, `−0.1`) in `.stat__delta` with `white-space: nowrap`.
  - Add one caption under the grid: "השינוי לעומת {7/14/30} הימים הקודמים" (`.text-sm.text-muted`).
  - A zero delta shows "ללא שינוי" with **no** trend icon. Today it shows "0 ד׳" with a rising arrow.
- Evidence: `review/stats-light-360.png`

**P2-5 · Stats "זמן הנקה יומי": the left-side series uses opacity 0.5 (2.2:1 light / 2.6:1 dark; fails 1.4.11 for graphics)**
- Fix in `StatsPage.tsx` (`leftMin` series and legend swatch): replace `opacity: 0.5` with `color: 'color-mix(in srgb, var(--color-breast) 70%, var(--color-surface))'`. That gives `#c879a2`, 3.1:1 in light, and `#ad6e8d`, 4.4:1 in dark.
- Keep the 2px surface separator.
- For today's partial bar, apply `fillOpacity={0.45}` to both segments, not on top of the 0.5.
- Evidence: `review/stats-light-390-s1.png`, `review/stats-dark-390-30s.png`

**P2-6 · History: the sticky day header looks broken when stuck, and the rhythm is inconsistent**
- The stuck header's background only covers the content width, so card borders and text peek out at its sides.
- The summary wraps to a second line on some days but not others ("היום…" vs "אתמול…").
- Fix in `app-extra.css` (replace rule 1):
  ```css
  .day-header {
    margin-inline: calc(var(--gutter) * -1);
    padding-inline: calc(var(--gutter) + var(--space-1));
    flex-direction: column;
    align-items: flex-start;
    gap: 0;
  }
  ```
  Below 560px the summary always sits under the title. At ≥ 560px, `@media (min-width: 560px) { .day-header { flex-direction: row; align-items: baseline; } }`.
- Evidence: `review/history-light-390-s1.png`, `review/history-light-360.png`

---

## P3 — polish

| # | Screen | Issue | Fix | Evidence |
|---|---|---|---|---|
| P3-1 | Growth summary, birth-only state | "קרוב לחציון לפי WHO • בגיל היום הראשון" is awkward Hebrew | When age is 0 days use "ביום הלידה"; otherwise keep "בגיל …" | `review/growth-empty-light-390.png` |
| P3-2 | Growth → מדידות | The birth row has no sub line | Add `row__sub` "משקל לידה" when `date === baby.birthDate` | `review/growth-light-390-s1.png` |
| P3-3 | Milk guide (Home meter + Growth card) | "698–1,000 מ״ל" looks falsely precise | Round the range to 10 ml (`Math.round(x/10)*10`) and per-feed to 5 ml | `review/home-bottle-light-390-s1.png` |
| P3-4 | Bottle | The >400 ml warning is a muted hint and easy to miss | Render it as `<p class="field__error" style="color:var(--color-warning)">` with a `TriangleAlert` icon (role="status") | — |
| P3-5 | Timer, long/stale | The unused side shows "00:00" | Show "—" for a side with no segments (side button and breakdown) | `review/timer-long-dark-390.png` |
| P3-6 | Timer, stale state | A full-height sheet holds one field, leaving a big empty area | Use the default (auto-height) sheet for the stale prompt: drop `sheet--full` in that state | `review/timer-stale-light-390.png` |
| P3-7 | Solids | Hint "Enter או פסיק מוסיפים מזון" is a desktop concept and sits below the suggestions | Copy: "אפשר להוסיף כמה מזונות — מפרידים בפסיק". Place it directly under the input, above the suggestion chips | `review/solids-light-390.png` |
| P3-8 | Solids / edit-solid | Added food chips look like the selected suggestion chips | Added foods: `chip chip--solid` with a `__dot` and `X`. Keep suggestions as plain chips with `+` | `review/edit-solid-light-390.png` |
| P3-9 | Measurement sheet | The footer "שמירה" has no check icon (every other sheet has one) | Add `<Check/>` | `review/growth-add-light-390-errors.png` |
| P3-10 | History, filtered empty | Generic history icon and a big gap before the button | Use the filtered type's icon and color (`.empty__icon` with `--empty-color/--empty-soft` = type tokens). Add `.empty__text` "אפשר לבחור סוג אחר או להציג הכול." | `review/history-filter-light-390.png` |
| P3-11 | Stats, empty | The 7/14/30 control shows with no data | Hide the `.seg` until at least 2 days of data exist | — |
| P3-12 | Onboarding | The birth-weight placeholder "3.30" reads like a prefilled value | Remove the placeholder; the hint already explains the field | `review/onboarding-light-390.png` |
| P3-13 | Settings → אודות | The version shows 0.1.0 | Set `version` to 1.0.0 for release (or show `import.meta.env` build version) | `review/settings-light-390.png` |
| P3-14 | Home, dark | The three 52px tile discs are the brightest elements on screen at night | Design follow-up (no engineering action now): Design will evaluate the dark-only `.tile__icon` treatment (soft disc + colored icon) in the next token pass | `review/home-timer-dark-390.png` |

---

## Spec amendments Design accepts from the build
1. **Age label** (`formatAge`): weeks under 2 months, then months, then years; e.g. "3 חודשים", "חודשיים", "שבועיים ויום". This replaces DESIGN §8.3 "N חודשים ו-M ימים".
2. **Active-timer hero on Home**, with the P2-1 adjustment.
3. **Baby rows in Settings**: a "בחירה" text action plus a pencil icon button replace "tap row = select, chevron = edit".
4. **Breast chart split by side** (ימין/שמאל), with the P2-5 color fix.

DESIGN.md will be updated to match after these fixes land.
