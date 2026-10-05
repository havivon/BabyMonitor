# BabyMonitor — Design System & Screen Spec

Owner: Design · Status: v1, ready for build · Language: Hebrew (RTL) · Companion files:

| File | What it is |
|---|---|
| `src/styles/tokens.css` | Every design token (CSS custom properties). Light on `:root`, dark on `[data-theme="dark"]` and on OS dark preference. |
| `src/styles/global.css` | Reset, base typography, focus ring, reduced motion, utilities. |
| `src/styles/components.css` | Production CSS for all components. Engineers compose these classes; no per-component CSS needed for v1. |
| `docs/design/mockup.html` | Static mockup that uses the three CSS files above. Open it in a browser. |
| `docs/design/mockup-light.png`, `mockup-dark.png` | Screenshots of the mockup (12 screens per theme). |

**Import order** in `main.tsx`: `@fontsource/rubik/400.css`, `500.css`, `600.css`, `700.css`, then `tokens.css`, `global.css`, `components.css`.
Set `<html lang="he" dir="rtl">` in `index.html`. Set `data-theme="light" | "dark"` on `<html>` when the user picks a theme. Remove the attribute for "auto".
Also set `<meta name="theme-color">`: `#f8f5ef` for light and `#141211` for dark. Use two tags with `media="(prefers-color-scheme: …)"` and update them when the theme is forced.

**Rule:** the markup in `mockup.html` is the reference. When this doc and the mockup disagree, follow the mockup and report the gap to Design.

---

## 1. Visual direction

**"A calm night-light."** The app is used at 3 a.m. with one hand, by someone who is tired and maybe worried. Every decision follows from that:

- **Warm and quiet.** Backgrounds are warm paper (`#f8f5ef`), not clinical white. The dark theme uses warm charcoal (`#141211` / `#1e1b19`), never pure black or pure white. The brand color is a muted **teal** (`#2a746c`), which reads as calm and trustworthy. A soft **apricot** accent (`#e59468`) adds warmth to suggestions ("הצד הבא").
- **Friendly, not childish.** No pastel rainbows, cartoon babies, or bubbly display fonts. The one font is Rubik. Its rounded terminals feel friendly and it has excellent Hebrew support. Corners are generous: 14–28px. Shadows are soft and warm-tinted.
- **Big and obvious.** The most common actions are large: 124px tiles, a 132px side button for each breast, a 64–76px timer, and 56px primary buttons. No touch target is smaller than 48px. One primary action per screen.
- **Color has meaning.** Each feeding type has one color everywhere: tile, timeline dot, badge, chart series, legend. The colors are never decoration, and they are always paired with an icon and a label.
- **Modest imagery.** We use object and abstract icons only (heart, bottle, apple, sprout, droplet). There are no people, bodies, or illustrations.

---

## 2. Color

All colors are tokens. Never write a hex value in a component. The CSS name is always `--color-<token>`.

### 2.1 Core palette

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#f8f5ef` | `#141211` | App background |
| `surface` | `#ffffff` | `#1e1b19` | Cards, inputs, lists, tab bar |
| `surface-2` | `#f2ede4` | `#272320` | Sunken: segmented track, stepper well, hover rows |
| `surface-3` | `#eae4d9` | `#302b27` | Pressed / hover on surface-2, switch track (off) |
| `surface-raised` | `#ffffff` | `#25211e` | Sheets, dialogs |
| `thumb` | `#ffffff` | `#3a3530` | Selected segment, stepper buttons |
| `border` | `#e4dccf` | `#38322d` | Hairlines, card outlines, dividers |
| `border-strong` | `#8c8276` | `#7d746b` | Input outlines (≥ 3:1) |
| `text` | `#1f2b29` | `#eae3d8` | Primary text |
| `text-muted` | `#56625f` | `#b2a99d` | Secondary text, meta, inactive tabs |
| `text-subtle` | `#626c69` | `#9a9186` | Placeholders, tertiary |
| `primary` | `#2a746c` | `#73c7ba` | Primary buttons, links, active tab, focus |
| `primary-hover` / `-active` | `#23655e` / `#1c5650` | `#86d1c5` / `#5fb3a6` | Button states |
| `on-primary` | `#ffffff` | `#0f2421` | Text on primary |
| `primary-soft` / `on-primary-soft` | `#e0f0ec` / `#1c5650` | `#1b3430` / `#a6e0d6` | Selected chips, tonal buttons, active tab pill |
| `accent` | `#e59468` | `#efa27a` | **Decorative only** (dashed "next side" border). Never used for text. |
| `accent-soft` / `on-accent-soft` | `#fcebdf` / `#9a4520` | `#3a281e` / `#f4b996` | "הבא בתור" hint, "חדש" badge, next-side pill |
| `danger` / `on-danger` / `danger-soft` | `#b83a32` / `#fff` / `#fbe7e4` | `#f08b80` / `#2a0f0c` / `#3b1f1c` | Destructive actions, errors |
| `success` / `success-soft` | `#2c7a4b` / `#e3f2e8` | `#7fcb98` / `#1c3124` | Live dot, confirmations |
| `warning` / `warning-soft` | `#8a5a00` / `#fff2d3` | `#e8bc5e` / `#352a14` | Guideline flags (weight loss > 10%, < P3) |
| `info` / `info-soft` | `#2e6aa8` / `#e6eff9` | `#86b5ec` / `#1c2a3b` | Neutral notices (install hint) |
| `scrim` | `rgb(31 26 20 / .42)` | `rgb(0 0 0 / .56)` | Behind sheets/dialogs |
| `toast-bg` / `toast-text` / `toast-action` | `#24302e` / `#f4efe7` / `#9edbd1` | `#3a3530` / `#eae3d8` / `#8fd3c7` | Toasts. Inverse in light. Only slightly raised in dark, so there is no glare. |
| `tabbar-bg` | `rgb(255 255 255 / .92)` | `rgb(30 27 25 / .94)` | Translucent tab bar (with backdrop blur) |
| `focus-ring` | `#2a746c` | `#73c7ba` | 3px focus outline |

### 2.2 Category colors (feeding types + growth)

| Category | Token | Light | Dark | `-soft` (L / D) | `on-` (L / D) | Icon |
|---|---|---|---|---|---|---|
| הנקה (breast) | `breast` | `#b03f7a` plum-rose | `#ea92bf` | `#fae7f0` / `#3a2230` | `#fff` / `#141211` | `heart` |
| בקבוק (bottle) | `bottle` | `#2d69ad` blue | `#86b6ee` | `#e5eef9` / `#1d2b3d` | `#fff` / `#141211` | `milk` |
| מוצקים (solids) | `solid` | `#9e540a` ochre | `#edb16a` | `#fcefdc` / `#3a2b18` | `#fff` / `#141211` | `apple` |
| גדילה (growth) | `growth` | `#6650bd` violet | `#b3a2f2` | `#ede9fa` / `#2b2541` | `#fff` / `#141211` | `sprout` / `weight` |

Plus `breast-fill` / `on-breast-fill`: `#b03f7a` / `#fff` in light and `#83405f` / `#f7ecf1` in dark. Use it for **large** breast-colored areas (the active side button). In dark, the full pastel would glare.

**Why these colors.** Breast, bottle and solids appear together in the timeline and the stacked chart. They come from the Okabe–Ito palette (reddish-purple, blue, orange), which stays distinct with protanopia, deuteranopia and tritanopia. Growth is violet and only appears on its own screen. Color is **never the only signal**: every use comes with an icon (tile, timeline, badge) or a text legend (charts).

**How to use them.** A category always uses the same color in every form:
- **Strong** (`--color-breast`): icon strokes, chart series, text in badges.
- **Soft** (`--color-breast-soft`): tile background, timeline icon bubble, badge background.
- **On** (`--color-on-breast`): an icon or text on a strong fill.

---

## 3. Typography

Font: **Rubik** (400/500/600/700, Hebrew + Latin), self-hosted via `@fontsource/rubik`. The fallback stack is in `--font-sans`. Never set text in all caps or with letter-spacing (Hebrew has no case).

| Token | Size / line-height | Weight | Use |
|---|---|---|---|
| `--fs-display` | timer uses `clamp(56px, 19vw, 76px)` / 1 | 500 | Breastfeeding timer `mm:ss` |
| `--fs-hero` | 40 / 44 | 600 | Time since last feed, stepper value |
| `--fs-h1` | 28 / 34 | 600 | Onboarding title, stat values |
| `--fs-h2` | 22 / 28 | 600 | App header title, sheet title, side-button label |
| `--fs-h3` | 18 / 24 | 600 | Card & section titles, empty-state title |
| `--fs-body-lg` | 17 / 26 | 400 | Inputs, tile labels (600) |
| `--fs-body` | 16 / 24 | 400 | Default, list titles (500) |
| `--fs-body-sm` | 14 / 20 | 400 | Meta, hints, chips, buttons-sm |
| `--fs-caption` | 13 / 18 | 400–500 | Captions, stat labels, day summary |
| `--fs-micro` | 12 / 16 | 500–600 | Tab labels, badges, chart ticks |

Numbers that update or line up (timers, amounts, columns) use `.num` (tabular figures). Inputs are 17px, which prevents the iOS focus zoom.

---

## 4. Spacing, shape, elevation, motion, layers

- **Spacing (4px grid):** `--space-1` 4 · `-2` 8 · `-3` 12 · `-4` 16 · `-5` 20 · `-6` 24 · `-7` 28 · `-8` 32 · `-10` 40 · `-12` 48 · `-14` 56 · `-16` 64 (plus `-0-5` 2px).
  Rhythm: 16px page gutter. 24px between page sections. 12px between cards in a grid and between a section title and its content. 8px between a label and its control.
- **Radii:** `xs` 6 (small inner elements) · `sm` 10 (inputs, seg options, icon squares) · `md` 14 (buttons, toasts, banners) · `lg` 20 (cards, tiles, lists, large buttons) · `xl` 28 (sheets, dialogs, hero card, side buttons) · `pill` (chips, badges, avatars, tab indicator).
- **Elevation:** `--shadow-1` (cards, resting buttons) · `--shadow-2` (hover, floating timer banner) · `--shadow-3` (toasts, dialogs) · `--shadow-sheet`. In dark, shadows get deeper and a 1px top highlight (`--shadow-inset-hl`) lifts surfaces.
- **Motion:** `--dur-instant` 80ms (press scale) · `--dur-fast` 140ms (hover/color) · `--dur-base` 220ms (seg, chips, toast in) · `--dur-slow` 320ms (sheet in). Easings: `--ease-standard`, `--ease-decelerate` (enter), `--ease-accelerate` (exit). Exits use about 70% of the enter duration.
  Pressed elements scale to 0.97–0.98. The live timer pulses (halo on the active side, dot on the banner). **`prefers-reduced-motion: reduce`** turns all of this off globally (`global.css`), and every state must still be readable without motion.
- **Z-index:** `--z-sticky` 5 (day headers) · `--z-header` 10 · `--z-timer-banner` 20 · `--z-tabbar` 30 · `--z-scrim` 40 · `--z-sheet` 50 · `--z-toast` 60.
- **Sizes:** `--touch-min` 48 · controls 40/48/56 (`--control-h-sm/-/-lg`) · `--header-h` 56 · `--tabbar-h` 64 · `--timer-banner-h` 56 · `--content-max` 560 · `--gutter` 16. Icons: 18 (inline), 22 (default), 28 (large). The lucide stroke is 2 (1.75 at ≥ 28px).

---

## 5. Layout & app shell

```
┌──────────── safe-area-top ────────────┐
│ .app-header  (sticky, 56px)            │  title / baby switcher (start) · actions (end)
├────────────────────────────────────────┤
│ .page  (max 560px, 16px gutters,       │  scrolls; bottom padding reserves
│         24px gap between sections)     │  tab bar + timer banner + 32px
│                                        │
│   ┌ .timer-banner (fixed, 56px) ────┐  │  only while a breastfeeding timer exists
│   └─────────────────────────────────┘  │  8px above the tab bar
├────────────────────────────────────────┤
│ .tabbar (fixed, 64px + safe-bottom)    │  5 tabs, RTL order: בית is right-most
└────────────────────────────────────────┘
```

- **Mobile first:** designed at 390×844. Must work from 360×640 up to desktop. At ≥ 560px the content column is centered (`max-inline-size: 560px`). The header, tab bar, banner, toasts and sheets align to the same column.
- **Sheets on desktop:** at ≥ 640px, `.sheet` becomes a centered 480px dialog with all corners rounded and no handle.
- **Root structure:**

```html
<div class="app app--has-timer">        <!-- add --has-timer while a timer exists -->
  <header class="app-header">…</header>
  <main class="page">…</main>
  <div class="timer-banner">…</div>      <!-- portal, all tabs except when the timer sheet is open -->
  <div class="toast-region" aria-live="polite">…</div>
  <nav class="tabbar" aria-label="ניווט ראשי">…</nav>
</div>
```

- **Safe areas:** `--safe-top/bottom/left/right` read `env(safe-area-inset-*)`. This requires `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`. The header pads the top, the tab bar and sheet footers pad the bottom.
- **Header scroll state:** add `.is-scrolled` to `.app-header` when `scrollY > 4`. This shows a hairline.
- **Tabs and routes:** `#/` בית (`house`) · `#/history` היסטוריה (`history`) · `#/growth` גדילה (`sprout`) · `#/stats` סטטיסטיקה (`chart-column`) · `#/settings` הגדרות (`settings`). DOM order is the same, and RTL puts בית on the right.

---

## 6. Components

Conventions: class names are BEM-ish (`.block`, `.block__part`, `.block--variant`). **State comes from ARIA attributes** wherever one exists (`aria-pressed`, `aria-checked`, `aria-current`, `aria-invalid`, `:disabled`). Use `.is-*` classes only when no ARIA attribute fits. Icons are lucide-react with `aria-hidden` (the default) and `size`/`strokeWidth` left to CSS.

### 6.1 Button — `.btn`
Variants:
- `--primary`: filled teal, one per view.
- `--secondary`: tonal teal.
- `--outline`: neutral, for "ביטול".
- `--ghost`: text-only teal.
- `--danger`: filled red.
- `--ghost-danger`: red text.

Sizes: default 48px · `--sm` 40px visual with a 48px hit area · `--lg` 56px, radius 20, semibold. Use `--block` for full width.

```html
<button class="btn btn--primary btn--lg"><Check/>שמירה</button>
```

| State | Treatment |
|---|---|
| hover | `primary-hover` / tonal mix / `surface-2` |
| active | `primary-active` + `scale(.98)` |
| focus-visible | 3px `focus-ring` outline, 2px offset (global) |
| disabled / `aria-disabled="true"` | opacity .4, no shadow, no pointer events |
| loading | keep the label, swap the icon for `loader-circle` (spinning; static under reduced motion), set `aria-busy="true"` |

The icon always comes before the label in the DOM, so it sits on the right in RTL.

### 6.2 IconButton — `.icon-btn`
A circle, 48px by default.
- `--sm`: 40px visual, 48px hit area.
- `--lg`: 72px.
- `--filled`: `surface-2` background.
- `--primary`: teal fill.

It **must** have an `aria-label`. States are the same as `.btn`.

### 6.3 Card — `.card`
A surface with a 1px border, `shadow-1`, radius 20 and 16px padding (`--card-pad`), arranged as a flex column with 12px gap.
- Modifiers: `--roomy` (20px padding) · `--flat` (sunken, no border or shadow) · `--flush` (no padding; use it for lists) · `--interactive` (when the card is a `<button>` or `<a>`: hover lifts to `shadow-2`, press scales to .99).
- Parts: `__header` (flex between) · `__title` · `__subtitle` · `__action` (text link) · `__body` · `__footer` (hairline on top).

### 6.4 "Since last feed" hero — `.card.since`
- Parts: `__top` (`__label` on the start side, a next-side `badge--accent badge--lg` on the end side) · `__value` (hero 40px) made of `__part`s, each a number plus a `__unit` (17px, muted) · `__meta` (type badge plus details).
- It counts **from the start of the last completed feed** and updates every 30 s.
- Value format:
  - under 1 h: `<n> ד׳`
  - 1 h to 24 h: `<h> שע׳ <m> ד׳`
  - 24 h or more: `<d> ימים` (or `יום אחד` for 1)
  - under 1 min: `עכשיו`
- While a timer runs, the hero keeps showing the previous feed. The banner owns the live state.

### 6.5 Action tile — `.tile` in `.tile-grid`
A grid of 3 equal columns, 12px gap. Each tile is at least 124px tall, with radius 20, `--tile-soft` background and a 16% tinted border. It contains:
- `__icon`: a 52px filled circle with a colored glow, 26px icon
- `__label`: 17px, semibold
- `__meta`: 13px, muted; may be empty, but keeps its height

Color modifiers: `--breast`, `--bottle`, `--solid`, `--growth`. `--active` adds a pulsing halo (breast tile while the timer runs). Hover tints 8% more. Pressing scales to .97.

Each tile is a `<button>` with an action `aria-label` ("הוספת בקבוק").

### 6.6 Segmented control — `.seg` / `.seg__option`
A sunken track (`surface-2`, radius 14, 4px padding). The selected option gets the `thumb` fill, `shadow-1`, semibold text.
- Markup: `role="radiogroup"` + `aria-label`. Each option is `<button role="radio" aria-checked>`. Arrow keys move the selection (roving tabindex).
- Sizes:
  - default: options 40px visual, 48px hit area
  - `--lg`: 48px
  - `--inline`: content-width, 36px, for settings rows
- Options may contain an 18px icon before the label.

### 6.7 Chip — `.chip`
A pill (40px visual, 48px hit area) with `surface` background, 1px border and a 14px medium label. It is a toggle: `aria-pressed="true"` (or `aria-checked` inside a radiogroup) selects it, giving it `primary-soft` fill, a teal border and semibold text.
- `__dot` + `--breast/--bottle/--solid/--growth`: category dot, used on filter chips.
- `--lg`: 48px, radius 14, 16px text, for quick amounts.

Containers:
- `.chip-row`: a horizontal scroller that bleeds to the screen edges; use it for filters, quick times and suggestions.
- `.chip-grid`: equal columns (`--chip-cols`, default 5); use it for the quick amounts 30/60/90/120/150.
- `.cluster`: wraps; use it for multi-row choices.

Quick-amount behavior: a chip is pressed when its value equals the stepper value. Tapping a chip sets the stepper.

### 6.8 Stepper — `.stepper`
A sunken well (radius 20, 8px padding). DOM order is `[−] value [+]`, which renders as **+ on the left and − on the right** in RTL (increment toward the inline end).
- `__btn`: 56×56, `thumb` fill, radius 14.
- `__value`: holds either `__input` (an editable `<input inputmode="numeric">`, 40px semibold, LTR) or a static `__number`, plus `__unit`.
- Step: 10 ml (1 oz in oz mode). Long-press repeats every 120 ms after 400 ms.
- Range: 0–400 ml. At the bounds the button is disabled.

### 6.9 Fields — `.field`, `.input`, `.select`, `.textarea`, `.input-group`, `.input--picker`, `.switch`
- **`.field`** is a column with 8px gap: `__label` (14px semibold, optional `__optional` "(לא חובה)") → control → `__hint` (13px muted) **or** `__error` (13px danger, with a `circle-alert` icon).
  - Invalid: add `.field--invalid` (or `aria-invalid="true"` on the control) and link the error with `aria-describedby`.
  - Validate on blur and on submit, never while the user is typing.
- **Inputs** are 48px tall, `surface` background, 1px `border-strong`, radius 10, 17px text.
  - Hover: muted border.
  - Focus: teal border plus a 3px teal halo, shown on any focus (including touch).
  - Disabled: sunken.
- **Number entry:** `.input--num` (LTR digits, right-aligned, tabular). Use `inputmode="decimal"` for kg and `"numeric"` for ml.
- **Units:** `.input-group` + `.input-group__affix` (e.g. `ק״ג`) at the inline end.
- **Select:** wrap in `.select-wrap` for the chevron.
- **Date/time:** `.input--picker` is a `<label>` that shows a friendly value (`__value`: "היום, 14:05") with a clock or calendar icon. A transparent native `<input type="datetime-local" | "date" class="input__native">` covers it. On desktop, call `input.showPicker()` on click.
  - Default: now.
  - `max` = now (no future times).
  - Add quick chips under the field: עכשיו · לפני 15 ד׳ · לפני 30 ד׳ · לפני שעה.
- **Switch:** `<input type="checkbox" role="switch" class="switch">`, 52×32. When on, the track is teal and the thumb moves to the inline end. Put it inside a `<label class="switch-row">` with `__text`, `__title` and `__hint`.

### 6.10 Bottom sheet / modal — `.sheet`, `.scrim`, `.dialog`
Use native `<dialog class="sheet">` + `showModal()`. This gives you a focus trap, Esc to close and an inert background; `::backdrop` is styled as the scrim. If you use a `div` instead, add `.scrim` and `role="dialog" aria-modal="true"`.

- **Anatomy:**
  - `__handle`: decorative, 36×5.
  - `__header`: `__icon` (36px category bubble from `.sheet--breast/--bottle/--solid/--growth`) + `__title` (22px) + close `.icon-btn` (`x`, aria-label "סגירה").
  - `__body`: scrolls; 24px gap between fields.
  - `__footer`: sticky, hairline on top, safe-area padding. Buttons stretch equally. A `--ghost-danger` button or an icon button keeps its natural width.
- **Variants:** default height fits the content, up to the viewport minus 24px. `--full` is for the timer.
- **Motion:** slides up in 320ms decelerate. Closing slides down in 220ms. Under reduced motion it appears instantly.
- **Closing:** tap the scrim, press Esc, use the close button, or swipe down on the handle area (optional, ≥ 80px).
  - If the form is dirty, ask "לצאת בלי לשמור?" first. Buttons: "יציאה" (danger) and "המשך עריכה".
- **Edit mode:** use the same sheet with the title "עריכת האכלה". The footer is `[מחיקה (btn--ghost-danger, trash-2)] [שמירה (primary)]`. Deleting closes the sheet immediately and shows the undo toast (no confirm dialog).
- **`.dialog`** is a centered confirmation for irreversible actions (delete all data, import that overwrites):
  - `role="alertdialog"`
  - `__icon` (danger bubble) · `__title` · `__text` · `__actions` (stacked: the danger action first, then `btn--outline` "ביטול")
  - Initial focus goes to "ביטול".

### 6.11 Toast — `.toast-region` > `.toast`
A pill-ish bar, radius 14, `toast-bg`, `shadow-3`, 52px tall. It sits 12px above the tab bar (and above the timer banner when one is shown).
- Parts: `__icon` (`check`; `--error` uses `circle-alert` in danger color) · `__text` · `__action` ("בטל" with an `undo-2` icon flipped for RTL using `.flip-rtl`).
- Lifetime: 6 s with an action, 3.5 s without. The timer pauses on hover or focus.
- At most one toast at a time; a new toast replaces the old one.
- The region is `aria-live="polite"`. The toast never takes focus.
- Undo restores the exact entry, including its id.

### 6.12 Empty state — `.empty`
A centered column: `__icon` (72px soft circle with a 32px icon) · `__title` · `__text` (max 34ch) · `__action` (optional button).
- Modifiers: `--compact` (24px padding, for use inside cards) · `--growth` (violet).

### 6.13 Stat tile — `.stat` in `.stat-grid`
A 2-column grid with 12px gap. Each tile is a card (radius 20) containing:
- `__label`: a 16px icon in the category color, plus a 13px label
- `__value`: 28px, semibold, tabular, with an optional `__unit`
- `__sub` (muted) **or** `__delta`

`__delta--positive` / `--negative` color the delta. Use them **only** when the direction has a clear good/bad meaning; otherwise leave the delta neutral.

Category modifiers: `--breast/--bottle/--solid/--growth/--primary`. Leave the modifier off for neutral metrics such as the interval.

### 6.14 Timeline — `.timeline` > `.timeline__day` > `.day-header` + `.timeline__list` > `li` > `.timeline-item`
- **`.day-header`** is sticky under the app header. `__title` is "היום · יום ב׳, 5 באוקטובר" and `__summary` is "5 האכלות · 360 מ״ל".
- **`.timeline__list`** is a card containing the items.
- **`.timeline-item`** is a `<button>` that opens the edit sheet. It is a 4-column grid: `__time` (48px, LTR, tabular) · `__icon` (36px soft bubble) · `__body` (`__title` with an optional badge, `__meta`, optional `__note` quote) · `__value` (semibold amount or duration).
  - A 2px rail connects consecutive icons.
  - Category: `--breast/--bottle/--solid/--growth`.
  - `--compact` drops the time column.
- Item content:
  - **Breast:** title "הנקה", meta = segments in order ("ימין 12 ד׳ · שמאל 9 ד׳"), value = total minutes.
  - **Bottle:** title "בקבוק", meta = "תמ״ל" or "חלב אם שאוב" (icon `droplet` for breast milk, `milk` for formula), value = amount.
  - **Solids:** title "מוצקים", plus `badge--accent` "חדש" if `isNewFood`. Meta = foods joined with ", " + " · " + amount. Note = reaction (if not "ללא תגובה").
  - The user's `note` appears as `__note`.

### 6.15 Badge — `.badge`
A 22px pill with 12px semibold text. Modifiers:
- color: `--primary --accent --breast --bottle --solid --growth --success --warning --danger` (no modifier = neutral)
- size: `--lg` (28px, 13px)
- state: `--live` (pulsing `__dot`)

It may contain a 12px icon.

### 6.16 Tab bar — `.tabbar` > `.tabbar__inner` > `a.tabbar__item`
A fixed, translucent bar with backdrop blur and a hairline on top. Five equal columns, 64px tall plus the safe area.
- Each item: `__icon` (a 56×30 pill containing a 22px icon) + a 12px label.
- The current item has `aria-current="page"`: teal label and a `primary-soft` pill behind the icon.
- Labels are always visible. Do not add badges in v1.

### 6.17 Breastfeeding timer — `.timer` + `.side-btn`

```html
<div class="timer [timer--paused]">
  <div class="timer__head">
    <span class="badge badge--breast badge--lg badge--live"><span class="badge__dot"></span>פועל · התחילה ב-<span class="ltr num">14:02</span></span>
    <div class="timer__display" role="timer" aria-live="off">12:34</div>
    <div class="timer__breakdown"><span>ימין <strong class="ltr num">08:10</strong></span><span>שמאל <strong class="ltr num">04:24</strong></span></div>
  </div>
  <div class="timer__sides" role="group" aria-label="צד">
    <button class="side-btn side-btn--active" aria-pressed="true">…ימין…</button>   <!-- RIGHT side first in DOM -->
    <button class="side-btn [side-btn--next]" aria-pressed="false">…שמאל…</button>
  </div>
  <p class="timer__hint">…</p>
</div>
```

- **`__display`**: 56–76px, weight 500, tabular, LTR. Format `mm:ss`, or `h:mm:ss` from 60 minutes. `--paused` turns it muted.
- **`.side-btn`** (132px tall, radius 28, 2px border) contains `__label` (22px "ימין"/"שמאל"), `__time` (that side's accumulated time) and `__state` (icon + text).
  - **The DOM order must be ימין then שמאל**, so the physical right side is on the right of the screen.
  - Default: `surface-raised` with a border.
  - `--active`: `breast-fill` background with `on-breast-fill` text and a slow pulsing halo. `__state` = `timer` icon + "צד פעיל".
  - `--next`: dashed accent border plus a floating `__hint` pill ("הבא בתור", `sparkles` icon), shown only before the timer starts.
  - Paused (`.timer--paused .side-btn--active`): soft breast background and no halo.
- **Behavior:**
  - Tapping a side when nothing runs starts it.
  - Tapping the other side switches (this closes the current segment and opens a new one).
  - Tapping the active side does nothing.
- **Controls** live in `.sheet__footer`: `[השהיה | המשך] (btn--secondary btn--lg, pause/play)` and `[סיום ושמירה] (btn--primary btn--lg, check)`.
  - Under the sides there is a `.cluster` with `btn--ghost btn--sm` "עריכת שעת התחלה" and `btn--ghost-danger btn--sm` "ביטול הנקה" (needs confirmation).
  - `.timer__controls` exists for using the timer inline outside a sheet (a 2-column grid).
- **"Next side" rule:** the next side is the side that was **not** the last segment of the previous breastfeeding.
  - If the last segment was under 2 minutes, suggest the same side again, because it was probably not finished.
  - Show it on the Home hero badge, the breast tile meta, and the `--next` side button.

### 6.18 Active-timer banner — `.timer-banner`
A fixed bar 8px above the tab bar, inset 12px, radius 20, `breast-soft` background, `shadow-2`. It appears on **every tab** while a timer exists and hides only while the timer sheet is open.
- Structure: `button.timer-banner__main` (opens the timer sheet) containing `__icon` (a filled breast circle with a live dot), `__text` (`__title` "הנקה · ימין", `__meta` "התחילה ב-14:02") and `__time` (tabular, breast color). Next to it is a separate `.icon-btn` for pause/resume. Never nest these buttons.
- `--paused` turns the live dot gray and the title becomes "הנקה מושהית · ימין".
- Add `.app--has-timer` to `.app` so the page and toasts reserve space for the banner.

### 6.19 Banner (inline notice) — `.banner`
Radius 14, soft background, 12×16 padding. It contains `__icon` (20px) and `__body` (`__title` semibold in the tone color, `__text` in body color).
- Tones: `--info` (default) `--warning` `--danger` `--success` `--neutral`.
- Use it for guideline flags. Always add the advice sentence "כדאי להתייעץ עם רופא/ת הילדים".
- Not dismissible in v1, except the install hint, which gets an `x` icon-btn and is remembered in localStorage.

### 6.20 Meter — `.meter`
Compares the day's bottle ml with the guideline range.
- Structure: `__head` (`__value` + range text) · `__track` (10px) containing `__range` (`--from`/`--to` in %) and `__fill` (`--value` in %, `--meter-color`) · optional `__labels`.
- It fills from the inline start (right in RTL).
- Show it **only** when bottle feeds are the main source (no breastfeeding logged in the last 72 h) and a weight exists.

### 6.21 Percentile — `.percentile` + `.pscale`
- **`.percentile`**: `__badge` (84px violet circle with `__value` "48" and `__label` "אחוזון") + `__body` (`__title` "משקל אחרון · 1 באוקטובר", `__main` "5.82 ק״ג", a muted description).
- **`.pscale`** is a linear 0–100 track and is **always LTR** (low on the left, as in the charts).
  - Zones: 3/15/85/97.
  - `__marker` is positioned with `--p` (e.g. `48%`).
  - `__ticks` are `span`s with inline `left:%`.
- Description copy:
  - P15–P85: "קרוב לחציון לפי WHO" if P40–P60, otherwise "בטווח הנפוץ לפי WHO".
  - P3–P15 or P85–P97: "בטווח התקין, בקצה ה[נמוך/גבוה]".
  - Below P3 or above P97: show the warning banner (see §8).

### 6.22 Charts — `.chart`, `.chart-legend`, `.chart-tooltip`
See §10.

### 6.23 List rows — `.list` > `li` > `.row`
`.list` is a card with hairline separators. `.row` is at least 56px tall and contains:
- `__icon` (36px square, radius 10, sunken) or an `.avatar`
- `__body` (`__title`, `__sub`)
- `__end` (muted text, a `__value`, a badge, or a `chevron-left`)

Rows are `<button>` or `<a>` (with hover) or a `<div>` (static).
- `--primary`: a teal "add" row.
- `--danger`: red title and icon.
- `--growth`: violet icon.
- `--wrap`: the trailing control drops below at full width (theme seg).

### 6.24 Others
- **`.avatar`**: 36px circle with the first letter of the name. Sizes `--sm` 28, `--lg` 48. `--alt` (accent) is for the second baby; alternate primary and accent by baby index.
- **`.baby-switch`**: a pill button in the header, containing an avatar, `__text` (`__name` 18px semibold, `__age` 13px muted) and `chevron-down`. It opens a sheet listing babies (`.list` of `.row`s with `aria-checked`) plus "הוספת ילד/ה". With a single baby the chevron is hidden and the button is inert.
- **`.brand-mark`**: a 64px teal gradient square, radius 20, with `droplet`. Used in onboarding and About.
- **`.onboarding`**: `__intro`, `__title`, `__lead`, `__form`, `__footer`.
- **`.kv`**: a key–value grid (`--kv-cols`, default 3): `__item`, `__label`, `__value`.
- **`.disclaimer`**: 13px muted text with a 16px `info` or `shield-check` icon.
- **`.divider`**: a 1px rule.
- **`.section`**: `__header`, `__title`, `__eyebrow` (13px muted group label for settings), `__action` (text link with `chevron-left`).

---

## 7. Screens

Shared rules:
- Every list screen has an empty state.
- Every destructive action has either an undo toast (single entries) or a confirm dialog (bulk or irreversible).
- Every medical-adjacent number carries "הנחיה כללית" or a disclaimer.

### 7.1 Onboarding (first run; no baby exists)
`.onboarding`, no tab bar.
1. `brand-mark` · title "ברוכים הבאים ל-BabyMonitor" · lead "מעקב רגוע ופשוט אחר האכלות וגדילה. כמה פרטים קטנים ומתחילים."
2. Form:
   - **שם** (required, 1–30 chars).
   - **תאריך לידה** (date picker; not in the future, not more than 3 years ago).
   - **מין**: `.seg--lg` with בת | בן, required. Hint: "משמש לחישוב אחוזוני הגדילה לפי טבלאות WHO".
   - **משקל לידה (לא חובה)**: `.input-group` with ק״ג (or lb). Hint: "מומלץ — כך אפשר לעקוב אחרי החזרה למשקל הלידה". When entered, it is also saved as a Measurement on the birth date.
3. Footer: `btn--primary btn--lg btn--block` "התחלה" (disabled until the required fields are valid) · `.disclaimer` with `shield-check` "בלי הרשמה ובלי שרת — הכול נשמר במכשיר שלך".
4. Below it, a ghost link "יש לי קובץ גיבוי" opens the import flow.

### 7.2 Home (בית)
Header: `.baby-switch`. Page, in order:
1. **Hero** `.card.since`:
   - "מאז ההאכלה האחרונה", the value, and the meta (type badge + summary + time).
   - Next-side `badge--accent badge--lg` with `arrow-left-right`: "הצד הבא: שמאל". Shown only if a breastfeeding exists.
   - Empty: `.empty--compact` with `clock`, "עוד לא נרשמו האכלות" and "בחירה באחד מסוגי ההאכלה כאן למטה תתחיל את הרישום. כל רישום אפשר לערוך אחר כך."
2. **Quick add** `.tile-grid` (visually hidden h2 "הוספת האכלה"):
   - הנקה: opens the timer sheet. Meta: "הבא: שמאל", or "פעילה · 12:34" with `--active` when a timer exists.
   - בקבוק: opens the bottle sheet. Meta: "אחרון: 120 מ״ל".
   - מוצקים: opens the solids sheet. Meta: "אחרון: אתמול" / "אחרון: 12:30".
   - Empty meta: "טיימר ימין/שמאל" / "חלב אם או תמ״ל" / "מזון וכמות".
3. **Today** section "היום" + action "לסטטיסטיקה". A `.stat-grid` with:
   - האכלות (sub: "אתמול: 7")
   - בקבוק ml (sub: "3 בקבוקים")
   - הנקה minutes (sub: "2 הנקות")
   - מרווח ממוצע h:mm (sub: "בין האכלות"; neutral)
   - Show "—" for metrics without data.
4. **Guideline card** (conditional, see Meter §6.20). Title "כמות בקבוק יומית" + badge "הנחיה כללית". Meter showing "360 מ״ל היום" / "מומלץ 700–1,040 מ״ל". Line "כ-145 מ״ל להאכלה (לפי 6 האכלות ביום)". Disclaimer.
5. **Notices**: `banner--warning` for growth flags; `banner--info` install hint (dismissible).
6. **Recent** section "אחרונות" + action "לכל ההיסטוריה". A `.timeline__list` with the last 3 items. Hidden when empty.

### 7.3 Breastfeeding timer (sheet, `.sheet--full.sheet--breast`)
- **Before start:**
  - Badge "בחירת צד להתחלה" · display "00:00" (subtle color).
  - Breakdown "בפעם הקודמת: ימין · 14 ד׳ · 02:30".
  - Sides with the `--next` hint.
  - `__hint` "הטיימר ממשיך לפעול גם כשהאפליקציה סגורה".
  - Footer: `btn--outline` "רישום ידני" (pencil) switches the sheet to the **manual form**: שעת התחלה (picker), ימין (דקות) stepper, שמאל (דקות) stepper (step 1, quick chips 5/10/15/20), הערה. Validation: "יש להזין לפחות צד אחד".
- **Running:**
  - Badge `--breast --live` "פועל · התחילה ב-14:02" · display · breakdown.
  - Sides (active / switch).
  - Ghost actions: "עריכת שעת התחלה" and "ביטול הנקה".
  - Footer: השהיה + סיום ושמירה.
  - Header close = `chevron-down` "מזעור" (the timer keeps running and the banner appears).
- **Paused:** `.timer--paused`; badge "מושהה" (neutral); the footer button becomes "המשך" (play).
- **Save** writes the entry and closes the sheet. Toast: "ההנקה נשמרה · 21 ד׳" with "בטל".
  - A feed under 1 minute asks first: "ההנקה קצרה מדקה. לשמור בכל זאת?"
- **Cancel** shows a dialog: "לבטל את ההנקה?" / "הזמן שנמדד לא יישמר." Buttons: "ביטול ההנקה" (danger) and "חזרה לטיימר".
- Timer state persists as timestamps, so it survives reloads. On return the display catches up immediately.

### 7.4 Bottle (sheet, `.sheet--bottle`)
1. `.seg--lg` with **חלב אם שאוב** (`droplet`) | **תמ״ל** (`milk`). Default: the last used.
2. **כמות**:
   - `.stepper` (default: the last amount, else 90 ml).
   - `.chip-grid` 30 · 60 · 90 · 120 · 150 (oz: 1 · 2 · 3 · 4 · 5).
3. **שעה**: picker ("היום, 14:05") + chip-row עכשיו · לפני 15 ד׳ · לפני 30 ד׳ · לפני שעה.
4. **הערה (לא חובה)**: textarea, placeholder "למשל: גיהוק אחרי חצי בקבוק".
5. Footer: "שמירה". Toast: "הבקבוק נשמר" + "בטל".

Validation:
- amount ≤ 0: "יש להזין כמות גדולה מ-0"
- amount > 400 ml: inline warning "כמות גבוהה מהרגיל — לבדוק שוב?" (allowed)
- time in the future: "אי אפשר לבחור שעה עתידית"

### 7.5 Solids (sheet, `.sheet--solid`)
1. **מזון**: input (placeholder "למשל: בטטה, אבוקדו"). Enter or comma turns the text into a removable chip. Recent foods appear as `+` chips in a `.chip-row`; tapping one adds it.
2. **כמות משוערת (לא חובה)**: `.cluster` of chips טעימה · כפית · 2–3 כפיות · חצי קערית · קערית (single-select, tap again to clear).
3. `.switch-row` **מזון חדש**, hint "עוזר לזהות רגישויות בהמשך". On by default when the food was never logged before.
4. **תגובה**: chips ללא תגובה (default) · פריחה · אי-נוחות בבטן · הקאה · אחר. "אחר" reveals a text input "מה קרה?".
5. **שעה** picker + quick chips. Footer "שמירה". Toast: "הרישום נשמר".

Validation: "יש להזין לפחות מזון אחד".

### 7.6 History (היסטוריה)
- Header: "היסטוריה" + `icon-btn` `calendar` "מעבר לתאריך" (date picker that scrolls to that day).
- `.chip-row` filters: הכול · הנקה · בקבוק · מוצקים (single-select; "הכול" is the default).
- `.timeline` grouped by day, newest first:
  - Day titles: "היום · …", "אתמול · …", otherwise "יום ד׳, 1 באוקטובר".
  - Summary: "N האכלות · X מ״ל · Y ד׳ הנקה". Omit zero parts.
  - Rendering: load 14 days at a time (infinite scroll).
- Tap an item to open its edit sheet. Delete shows the toast "הרישום נמחק" + "בטל".
- Empty states:
  - No data: `history` icon, "אין עדיין רישומים", "האכלות שיירשמו יופיעו כאן, מסודרות לפי ימים."
  - Filter with no results: "אין רישומי [בקבוק] להצגה" + ghost button "הצגת הכול".

### 7.7 Growth (גדילה)
- Header: "גדילה" + `btn--secondary btn--sm` "הוספת מדידה" (`plus`).
- `.seg`: משקל | אורך | היקף ראש. This switches the card, chart and list values.
- **Summary card** (`.card--roomy`): `.percentile` + `.pscale` + divider + `.kv`.
  - Weight: עלייה ליום · עלייה לשבוע · ממשקל הלידה.
  - Length and head: "שינוי מהמדידה הקודמת".
  - Gain is the average between the last two measurements ≥ 7 days apart. Before then show "—" with a hint.
- **Chart card**: title "משקל לגיל" (אורך לגיל / היקף ראש לגיל), subtitle "בנות · 0–6 חודשים · WHO".
  - WHO bands, P50 dashed, baby line (see §10).
  - The x-range grows with age: 0–6 m, then 0–12, then 0–24.
  - Legend: name · אחוזון 50 · אחוזונים 15–85.
- **Measurements** section: `.list` of rows, newest first.
  - Each row: date title; sub with the other measures; end shows the value + `badge--growth` percentile; birth row gets sub "משקל לידה".
  - Tap to edit, with delete in the footer and undo.
- **Flags** (`banner--warning`, above the summary):
  - Below P3: "המשקל מתחת לאחוזון 3 …"
  - Above P97: "… מעל אחוזון 97 …"
  - Weight loss > 10% from birth weight in the first 14 days: "ירידה של 11% ממשקל הלידה …"
  - Not back to birth weight by day 14: "משקל הלידה עוד לא חזר אחרי שבועיים …"
  - Crossing two major percentile lines downward: "המשקל ירד בשני קווי אחוזון מאז [date] …"
  - Every flag ends with "כדאי להתייעץ עם רופא/ת הילדים."
- **Add form** (`.sheet--growth`, title "מדידה חדשה"):
  - תאריך (date, default today)
  - משקל (ק״ג, `.input--num`, 2 decimals; lb mode: lb)
  - אורך (לא חובה, ס״מ)
  - היקף ראש (לא חובה, ס״מ)
  - הערה
  - Validation:
    - "יש להזין לפחות ערך אחד"
    - "המשקל צריך להיות בין 0.5 ל-30 ק״ג"
    - "האורך צריך להיות בין 30 ל-120 ס״מ"
    - "היקף הראש צריך להיות בין 25 ל-60 ס״מ"
    - "תאריך המדידה לא יכול להיות לפני תאריך הלידה"
- Empty: `.empty--growth` with `sprout`, "עוד אין מדידות", "הוספת מדידת משקל ראשונה תציג את עקומת הגדילה והאחוזון." and the button "הוספת מדידה".
- Footer disclaimer: "האחוזונים מחושבים לפי טבלאות ארגון הבריאות העולמי (WHO). המידע אינו מהווה ייעוץ רפואי."

### 7.8 Stats (סטטיסטיקה)
- Header "סטטיסטיקה". `.seg` 7 ימים | 14 ימים | 30 ימים (default 7).
- `.stat-grid` with daily averages over **complete days** (today is excluded from averages):
  - האכלות ביום, with a neutral delta "+0.3 מהתקופה הקודמת"
  - בקבוק ביום (מ״ל)
  - הנקה ביום (ד׳)
  - מרווח ממוצע (h:mm שע׳, neutral)
- Chart cards (each `.card` + `.chart` + `.chart-legend`):
  1. **האכלות לפי יום**: stacked bars by type.
  2. **כמות בקבוק יומית**: bars plus a guideline band (only when a weight exists). Legend "טווח מומלץ (בקבוק בלבד)".
  3. **זמן הנקה יומי**: bars in breast color.
  - Hide a chart when its series has no data. Today's bar is drawn at 45% opacity and labeled "היום".
- Empty (under 2 days of data): `chart-column` icon, "אין עדיין מספיק נתונים", "אחרי כמה ימים של רישום יופיעו כאן מגמות."
- Disclaimer under the guideline chart.

### 7.9 Settings (הגדרות)
Sections use `.section__eyebrow` + `.list`:
1. **ילדים**:
   - A row per baby: avatar, name, "תאריך לידה: 1.7.2026". The active baby gets `badge--primary` "נבחר"; tapping a row selects that baby, and the chevron opens the edit sheet (name, birth date, sex, birth weight, delete with confirm).
   - `row--primary` "הוספת ילד/ה".
2. **יחידות ותצוגה**:
   - נפח `seg--inline` מ״ל | oz
   - משקל `seg--inline` ק״ג | lb
   - ערכת נושא (`row--wrap`) `.seg`: אוטומטי | בהיר | כהה
3. **גיבוי ונתונים**:
   - ייצוא גיבוי ("קובץ JSON לשמירה או להעברה למכשיר אחר")
   - ייבוא מגיבוי (file picker → dialog → toast)
   - ייצוא לגיליון (CSV)
   - `row--danger` מחיקת כל הנתונים (dialog)
4. **אודות**:
   - `shield-check` "הנתונים נשמרים רק במכשיר הזה" / "אין חשבון, אין שרת ואין שיתוף"
   - גרסה 1.0.0
   - מקורות: "טבלאות גדילה: WHO Child Growth Standards"
   - Disclaimer.

---

## 8. Hebrew microcopy

Voice: warm, calm, short, gender-neutral. Use nouns and infinitives for actions ("הוספת האכלה", "שמירה"), not the imperative. Where a gendered noun is unavoidable, use the slash form (רופא/ת, ילד/ה). Typography: use **gershayim ״ (U+05F4)** and **geresh ׳ (U+05F3)**, never `"` or `'`. Use an en dash for ranges.

### 8.1 Glossary (always use exactly these terms)
| Concept | Term | Abbrev. / unit |
|---|---|---|
| Breastfeeding | הנקה | — |
| Bottle | בקבוק | — |
| Solids | מוצקים | — |
| Expressed breast milk | חלב אם שאוב | — |
| Formula | תמ״ל | — |
| Right / Left | ימין / שמאל | — |
| Next side | הצד הבא | — |
| Feed / feeding (generic) | האכלה (pl. האכלות) | — |
| Entry | רישום | — |
| Weight / length / head circumference | משקל / אורך / היקף ראש | ק״ג, גר׳, ס״מ |
| Percentile | אחוזון (pl. אחוזונים) | — |
| Measurement | מדידה | — |
| Volume | נפח | מ״ל, oz |
| Minutes / hours | דקות / שעות | ד׳ / שע׳ |
| Pediatrician | רופא/ת הילדים | — |

### 8.2 Strings

| Key | Hebrew |
|---|---|
| **Navigation** | |
| `tab.home` | בית |
| `tab.history` | היסטוריה |
| `tab.growth` | גדילה |
| `tab.stats` | סטטיסטיקה |
| `tab.settings` | הגדרות |
| `nav.label` | ניווט ראשי |
| **Common** | |
| `common.save` | שמירה |
| `common.cancel` | ביטול |
| `common.close` | סגירה |
| `common.delete` | מחיקה |
| `common.edit` | עריכה |
| `common.undo` | בטל |
| `common.optional` | (לא חובה) |
| `common.now` | עכשיו |
| `common.today` | היום |
| `common.yesterday` | אתמול |
| `common.minAgo` | לפני {n} ד׳ |
| `common.hourAgo` | לפני שעה |
| `common.guideline` | הנחיה כללית |
| `common.seeDoctor` | כדאי להתייעץ עם רופא/ת הילדים. |
| `common.leaveDirty.title` | לצאת בלי לשמור? |
| `common.leaveDirty.confirm` | יציאה |
| `common.leaveDirty.cancel` | המשך עריכה |
| **Onboarding** | |
| `onb.title` | ברוכים הבאים ל-BabyMonitor |
| `onb.lead` | מעקב רגוע ופשוט אחר האכלות וגדילה. כמה פרטים קטנים ומתחילים. |
| `onb.name` | שם |
| `onb.namePh` | למשל: נועה |
| `onb.birthDate` | תאריך לידה |
| `onb.sex` | מין |
| `onb.sex.female` | בת |
| `onb.sex.male` | בן |
| `onb.sexHint` | משמש לחישוב אחוזוני הגדילה לפי טבלאות WHO |
| `onb.birthWeight` | משקל לידה |
| `onb.birthWeightHint` | מומלץ — כך אפשר לעקוב אחרי החזרה למשקל הלידה |
| `onb.start` | התחלה |
| `onb.privacy` | בלי הרשמה ובלי שרת — הכול נשמר במכשיר שלך |
| `onb.import` | יש לי קובץ גיבוי |
| `onb.err.name` | יש להזין שם |
| `onb.err.birthDate` | יש לבחור תאריך לידה |
| `onb.err.birthFuture` | תאריך הלידה לא יכול להיות בעתיד |
| `onb.err.sex` | יש לבחור מין לחישוב האחוזונים |
| **Home** | |
| `home.since` | מאז ההאכלה האחרונה |
| `home.nextSide` | הצד הבא: {side} |
| `home.addHeading` | הוספת האכלה |
| `home.tile.breast.aria` | התחלת הנקה |
| `home.tile.bottle.aria` | הוספת בקבוק |
| `home.tile.solid.aria` | הוספת מוצקים |
| `home.tile.breastMeta` | הבא: {side} |
| `home.tile.breastActive` | פעילה · {time} |
| `home.tile.last` | אחרון: {value} |
| `home.today` | היום |
| `home.toStats` | לסטטיסטיקה |
| `home.stat.feeds` | האכלות |
| `home.stat.bottle` | בקבוק |
| `home.stat.breast` | הנקה |
| `home.stat.interval` | מרווח ממוצע |
| `home.stat.yesterday` | אתמול: {n} |
| `home.stat.betweenFeeds` | בין האכלות |
| `home.recent` | אחרונות |
| `home.toHistory` | לכל ההיסטוריה |
| `home.empty.title` | עוד לא נרשמו האכלות |
| `home.empty.text` | בחירה באחד מסוגי ההאכלה כאן למטה תתחיל את הרישום. כל רישום אפשר לערוך אחר כך. |
| `home.guide.title` | כמות בקבוק יומית |
| `home.guide.value` | {n} מ״ל היום |
| `home.guide.range` | מומלץ {min}–{max} מ״ל |
| `home.guide.perFeed` | כ-{n} מ״ל להאכלה (לפי {k} האכלות ביום) |
| `home.guide.disclaimer` | לפי כ-150 מ״ל לק״ג ליום עבור תינוקות הניזונים מבקבוק. אינו תחליף לייעוץ רפואי. |
| `home.install.title` | אפשר להתקין למסך הבית |
| `home.install.text` | כך האפליקציה נפתחת מהר יותר ועובדת גם בלי אינטרנט. |
| **Timer** | |
| `timer.title` | הנקה |
| `timer.chooseSide` | בחירת צד להתחלה |
| `timer.previous` | בפעם הקודמת: {side} · {min} ד׳ · {time} |
| `timer.right` | ימין |
| `timer.left` | שמאל |
| `timer.start` | התחלה |
| `timer.nextHint` | הבא בתור |
| `timer.activeSide` | צד פעיל |
| `timer.switchHere` | החלפה לצד זה |
| `timer.running` | פועל · התחילה ב-{time} |
| `timer.paused` | מושהה |
| `timer.pause` | השהיה |
| `timer.resume` | המשך |
| `timer.finish` | סיום ושמירה |
| `timer.minimize` | מזעור — הטיימר ימשיך לפעול |
| `timer.editStart` | עריכת שעת התחלה |
| `timer.cancel` | ביטול הנקה |
| `timer.bgHint` | הטיימר ממשיך לפעול גם כשהאפליקציה סגורה |
| `timer.manual` | רישום ידני |
| `timer.manual.start` | שעת התחלה |
| `timer.manual.rightMin` | ימין (דקות) |
| `timer.manual.leftMin` | שמאל (דקות) |
| `timer.manual.err` | יש להזין לפחות צד אחד |
| `timer.cancel.title` | לבטל את ההנקה? |
| `timer.cancel.text` | הזמן שנמדד לא יישמר. |
| `timer.cancel.confirm` | ביטול ההנקה |
| `timer.cancel.back` | חזרה לטיימר |
| `timer.short.title` | ההנקה קצרה מדקה. לשמור בכל זאת? |
| `timer.short.confirm` | שמירה |
| `timer.short.discard` | מחיקה |
| `timer.saved` | ההנקה נשמרה · {min} ד׳ |
| `banner.title` | הנקה · {side} |
| `banner.titlePaused` | הנקה מושהית · {side} |
| `banner.meta` | התחילה ב-{time} |
| `banner.open` | פתיחת טיימר ההנקה |
| `banner.pause` | השהיית ההנקה |
| `banner.resume` | המשך ההנקה |
| `sr.started` | הטיימר הופעל, צד {side} |
| `sr.switched` | הוחלף לצד {side} |
| `sr.paused` | הטיימר הושהה |
| `sr.resumed` | הטיימר חודש |
| `sr.saved` | ההנקה נשמרה |
| **Bottle** | |
| `bottle.title` | בקבוק |
| `bottle.content` | תוכן הבקבוק |
| `bottle.breastmilk` | חלב אם שאוב |
| `bottle.formula` | תמ״ל |
| `bottle.amount` | כמות |
| `bottle.dec` | הפחתה של {step} {unit} |
| `bottle.inc` | הוספה של {step} {unit} |
| `bottle.quick` | כמויות מהירות |
| `bottle.time` | שעה |
| `bottle.note` | הערה |
| `bottle.notePh` | למשל: גיהוק אחרי חצי בקבוק |
| `bottle.err.zero` | יש להזין כמות גדולה מ-0 |
| `bottle.warn.high` | כמות גבוהה מהרגיל — לבדוק שוב? |
| `time.err.future` | אי אפשר לבחור שעה עתידית |
| `bottle.saved` | הבקבוק נשמר |
| **Solids** | |
| `solid.title` | מוצקים |
| `solid.food` | מזון |
| `solid.foodPh` | למשל: בטטה, אבוקדו |
| `solid.recent` | מזונות אחרונים |
| `solid.amount` | כמות משוערת |
| `solid.amount.*` | טעימה · כפית · 2–3 כפיות · חצי קערית · קערית |
| `solid.isNew` | מזון חדש |
| `solid.isNewHint` | עוזר לזהות רגישויות בהמשך |
| `solid.reaction` | תגובה |
| `solid.reaction.*` | ללא תגובה · פריחה · אי-נוחות בבטן · הקאה · אחר |
| `solid.reactionOtherPh` | מה קרה? |
| `solid.err.food` | יש להזין לפחות מזון אחד |
| `solid.newBadge` | חדש |
| `entry.saved` | הרישום נשמר |
| **Edit / delete** | |
| `edit.title` | עריכת האכלה |
| `edit.titleMeasurement` | עריכת מדידה |
| `entry.deleted` | הרישום נמחק |
| `entry.restored` | הרישום שוחזר |
| **History** | |
| `history.title` | היסטוריה |
| `history.jump` | מעבר לתאריך |
| `history.filter` | סינון לפי סוג |
| `history.all` | הכול |
| `history.summary` | {n} האכלות · {ml} מ״ל · {min} ד׳ הנקה |
| `history.empty.title` | אין עדיין רישומים |
| `history.empty.text` | האכלות שיירשמו יופיעו כאן, מסודרות לפי ימים. |
| `history.emptyFilter` | אין רישומי {type} להצגה |
| `history.showAll` | הצגת הכול |
| **Growth** | |
| `growth.title` | גדילה |
| `growth.add` | הוספת מדידה |
| `growth.weight` | משקל |
| `growth.length` | אורך |
| `growth.head` | היקף ראש |
| `growth.percentile` | אחוזון |
| `growth.last` | {metric} אחרון · {date} |
| `growth.nearMedian` | קרוב לחציון לפי WHO |
| `growth.common` | בטווח הנפוץ לפי WHO |
| `growth.edgeLow` | בטווח התקין, בקצה הנמוך |
| `growth.edgeHigh` | בטווח התקין, בקצה הגבוה |
| `growth.perDay` | עלייה ליום |
| `growth.perWeek` | עלייה לשבוע |
| `growth.vsBirth` | ממשקל הלידה |
| `growth.sinceLast` | שינוי מהמדידה הקודמת |
| `growth.needMore` | יוצג אחרי שתי מדידות בהפרש של שבוע לפחות |
| `growth.chart.weight` | משקל לגיל |
| `growth.chart.length` | אורך לגיל |
| `growth.chart.head` | היקף ראש לגיל |
| `growth.chart.sub` | {בנות/בנים} · {range} חודשים · WHO |
| `growth.ageAxis` | גיל בחודשים |
| `growth.legend.median` | אחוזון 50 |
| `growth.legend.band` | אחוזונים 15–85 |
| `growth.list` | מדידות |
| `growth.birthRow` | משקל לידה |
| `growth.empty.title` | עוד אין מדידות |
| `growth.empty.text` | הוספת מדידת משקל ראשונה תציג את עקומת הגדילה והאחוזון. |
| `growth.form.title` | מדידה חדשה |
| `growth.form.date` | תאריך |
| `growth.err.none` | יש להזין לפחות ערך אחד |
| `growth.err.weight` | המשקל צריך להיות בין 0.5 ל-30 ק״ג |
| `growth.err.length` | האורך צריך להיות בין 30 ל-120 ס״מ |
| `growth.err.head` | היקף הראש צריך להיות בין 25 ל-60 ס״מ |
| `growth.err.beforeBirth` | תאריך המדידה לא יכול להיות לפני תאריך הלידה |
| `growth.saved` | המדידה נשמרה |
| `flag.belowP3` | המשקל מתחת לאחוזון 3. כדאי להתייעץ עם רופא/ת הילדים. |
| `flag.aboveP97` | המשקל מעל אחוזון 97. כדאי להתייעץ עם רופא/ת הילדים. |
| `flag.loss10.title` | ירידה של {pct}% ממשקל הלידה |
| `flag.loss10.text` | ירידה של יותר מ-10% בימים הראשונים מצדיקה בדיקה. כדאי להתייעץ עם רופא/ת הילדים. |
| `flag.notRegained` | משקל הלידה עוד לא חזר אחרי שבועיים. כדאי להתייעץ עם רופא/ת הילדים. |
| `flag.crossing` | המשקל ירד בשני קווי אחוזון מאז {date}. כדאי להתייעץ עם רופא/ת הילדים. |
| `growth.disclaimer` | האחוזונים מחושבים לפי טבלאות ארגון הבריאות העולמי (WHO). המידע אינו מהווה ייעוץ רפואי. |
| **Stats** | |
| `stats.title` | סטטיסטיקה |
| `stats.range` | 7 ימים · 14 ימים · 30 ימים |
| `stats.feedsPerDay` | האכלות ביום |
| `stats.bottlePerDay` | בקבוק ביום |
| `stats.breastPerDay` | הנקה ביום |
| `stats.interval` | מרווח ממוצע |
| `stats.dailyAvg` | ממוצע יומי |
| `stats.vsPrev` | {delta} מהתקופה הקודמת |
| `stats.chart.feeds` | האכלות לפי יום |
| `stats.chart.ml` | כמות בקבוק יומית |
| `stats.chart.breast` | זמן הנקה יומי |
| `stats.legend.target` | טווח מומלץ (בקבוק בלבד) |
| `stats.today` | היום |
| `stats.empty.title` | אין עדיין מספיק נתונים |
| `stats.empty.text` | אחרי כמה ימים של רישום יופיעו כאן מגמות. |
| **Settings** | |
| `set.title` | הגדרות |
| `set.babies` | ילדים |
| `set.birthDate` | תאריך לידה: {date} |
| `set.selected` | נבחר |
| `set.addBaby` | הוספת ילד/ה |
| `set.editBaby` | עריכת פרטים |
| `set.deleteBaby` | מחיקת {name} |
| `set.deleteBaby.title` | למחוק את {name}? |
| `set.deleteBaby.text` | כל ההאכלות והמדידות של {name} יימחקו מהמכשיר הזה. |
| `set.units` | יחידות ותצוגה |
| `set.volume` | נפח |
| `set.weight` | משקל |
| `set.theme` | ערכת נושא |
| `set.theme.*` | אוטומטי · בהיר · כהה |
| `set.data` | גיבוי ונתונים |
| `set.export` | ייצוא גיבוי |
| `set.exportSub` | קובץ JSON לשמירה או להעברה למכשיר אחר |
| `set.exported` | קובץ הגיבוי נשמר |
| `set.import` | ייבוא מגיבוי |
| `set.import.title` | לייבא את הגיבוי? |
| `set.import.text` | הייבוא יחליף את כל הנתונים שבמכשיר בנתונים מהקובץ. |
| `set.import.confirm` | ייבוא והחלפה |
| `set.imported` | הגיבוי יובא בהצלחה |
| `set.import.err` | הקובץ אינו גיבוי תקין של BabyMonitor |
| `set.csv` | ייצוא לגיליון (CSV) |
| `set.wipe` | מחיקת כל הנתונים |
| `set.wipe.title` | למחוק את כל הנתונים? |
| `set.wipe.text` | כל ההאכלות, המדידות והילדים יימחקו מהמכשיר הזה. אי אפשר לבטל את הפעולה — אלא אם נשמר קובץ גיבוי. |
| `set.wipe.confirm` | מחיקה לצמיתות |
| `set.about` | אודות |
| `set.local` | הנתונים נשמרים רק במכשיר הזה |
| `set.localSub` | אין חשבון, אין שרת ואין שיתוף |
| `set.version` | גרסה |
| `set.sources` | טבלאות גדילה: WHO Child Growth Standards |
| `set.disclaimer` | BabyMonitor נועדה למעקב אישי. החישובים מבוססים על הנחיות כלליות ואינם תחליף לייעוץ רפואי. בכל שאלה או חשש — כדאי להתייעץ עם רופא/ת הילדים או עם אחות טיפת חלב. |
| **Errors** | |
| `err.generic` | משהו השתבש. כדאי לנסות שוב. |
| `err.storageFull` | אין מספיק מקום באחסון של הדפדפן. כדאי לייצא גיבוי ולמחוק נתונים ישנים. |

### 8.3 Formatting
- **Clock times:** 24 h `HH:mm`, always wrapped in `<span class="ltr num">`.
- **Dates:**
  - in lists: `EEEE, d בMMMM` with date-fns `he` → "יום שני, 5 באוקטובר"
  - day headers: short weekday "יום ב׳"
  - rows: `d.M.yyyy`
- **Durations:** under 1 h "N ד׳", otherwise "H שע׳ M ד׳". Timer `mm:ss` / `h:mm:ss`. Intervals `h:mm` + "שע׳".
- **Amounts:**
  - ml: integer, thousands separator `1,040`
  - oz: 1 decimal
  - kg: 2 decimals (`5.82`)
  - lb: 1 decimal
  - gains: grams with a sign (`+27 גר׳`)
  - cm: 1 decimal
- **Number before unit**, separated by a space: `120 מ״ל`. Signs and percentages go inside `.ltr`: `<span class="ltr">+76%</span>`.
- **Age:**
  - under 1 month: "N ימים"
  - under 2 years: "N חודשים ו-M ימים"
  - after that: "N שנים ו-M חודשים"
  - In settings and lists, avoid gendered verbs ("נולדה"); use "תאריך לידה:".

---

## 9. Iconography — lucide-react

Use the outline style, `strokeWidth={2}` (1.75 at ≥ 28px). The size comes from CSS. Icons are decorative (`aria-hidden`) unless they are the only content of a button, in which case the button carries the `aria-label`.

| Use | Icon |
|---|---|
| הנקה (breast) | `Heart` |
| בקבוק / תמ״ל | `Milk` |
| חלב אם שאוב | `Droplet` |
| מוצקים | `Apple` |
| Growth tab / growth empty | `Sprout` |
| Weight | `Weight` |
| Length | `Ruler` |
| Head circumference | `CircleDashed` |
| Home tab | `House` |
| History tab | `History` |
| Stats tab | `ChartColumn` |
| Settings tab | `Settings` |
| Add | `Plus` |
| Stepper − / + | `Minus` / `Plus` |
| Save / done / selected | `Check` |
| Close sheet | `X` |
| Minimize timer, select chevron, baby switch | `ChevronDown` |
| Row disclosure, "see all" link (points to inline end in RTL) | `ChevronLeft` |
| Back (if ever needed) | `ChevronRight` |
| Start side | `Play` |
| Pause | `Pause` |
| Active side / timer | `Timer` |
| Switch side / next side | `ArrowLeftRight` |
| "הבא בתור" hint | `Sparkles` |
| Time / time since / feeds count | `Clock` |
| Date picker | `Calendar` |
| Interval | `Repeat2` |
| Trend delta | `TrendingUp` / `TrendingDown` |
| Undo | `Undo2` with `.flip-rtl` |
| Edit | `Pencil` |
| Delete | `Trash2` |
| Export / import | `Download` / `Upload` |
| CSV | `FileSpreadsheet` |
| Theme | `SunMoon` (+ `Sun`, `Moon` in options if desired) |
| Privacy | `ShieldCheck` |
| Info / disclaimer | `Info` |
| Warning flag | `TriangleAlert` |
| Error | `CircleAlert` |
| Loading | `LoaderCircle` |
| Brand mark | `Droplet` |

**Do not use** `Baby` or any icon that depicts people or bodies.

---

## 10. Charts (Recharts)

- Always wrap the chart in `<div class="chart" dir="ltr">` with a `ResponsiveContainer` at 100%×100%. Set height via `--chart-h` (default 220; growth uses 236 or `.chart--tall` 280; stats uses 170–180). Time and age run left to right.
- Pass colors as CSS variables, e.g. `fill="var(--color-bottle)"`. Evergreen browsers resolve `var()` in SVG presentation attributes, and the charts then follow the theme without re-rendering. `components.css` already themes grid, axes and tick text through `.recharts-*` selectors.
- **Common props:**
  - `<CartesianGrid vertical={false} />` (stroke from CSS)
  - `<XAxis tickLine={false} axisLine={false} tickMargin={8} />`
  - `<YAxis width={32} tickLine={false} axisLine={false} tickCount={5} />`
  - Tooltip: `content={<ChartTooltip/>}` using `.chart-tooltip` (title, then rows with a legend swatch + `<strong>` value). `cursor={{ fill: 'var(--color-surface-2)' }}`.
  - `isAnimationActive` = false under reduced motion. Otherwise use 400 ms ease-out.
- **Growth chart** (`ComposedChart`, x = age in months as a number, y = kg / cm):
  1. `<Area>` P3→P97: render a stacked pair (transparent base `P3` + `P97−P3` delta) with `fill="var(--color-chart-band-outer)"`.
  2. The same for P15→P85 with `--color-chart-band-inner`.
  3. `<Line>` P3, P15, P85, P97: `stroke="var(--color-chart-pline)" strokeWidth={1} dot={false}`.
  4. `<Line>` P50: `stroke="var(--color-chart-median)" strokeWidth={1.5} strokeDasharray="4 4" dot={false}`.
  5. Baby: `<Line type="monotone" stroke="var(--color-growth)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--color-growth)', stroke: 'var(--color-surface)', strokeWidth: 2 }} activeDot={{ r: 6 }} />`. Give the latest point an extra halo (r 7, 35% opacity).
  - Percentile labels "3 15 50 85 97" at the right edge (10px, axis color). Axis captions "גיל בחודשים" (bottom center) and "ק״ג"/"ס״מ" (above the y-axis).
- **Feeds per day:** a `BarChart` with three `<Bar stackId="f">` in order breast, bottle, solid. `barSize={24}`; only the top segment gets `radius={[6,6,0,0]}` (or use a rounded clip). Separate segments with a 2px `--color-surface` gap (`stroke="var(--color-surface)" strokeWidth={2}`).
- **ml per day:** `<ReferenceArea y1={min} y2={max} fill="var(--color-chart-target)" />` + two `<ReferenceLine strokeDasharray="3 3" stroke="var(--color-primary)" strokeOpacity={0.7}/>` + `<Bar fill="var(--color-bottle)" radius={[6,6,0,0]} barSize={24}/>`.
- **Breast minutes:** the same bar style in `--color-breast`.
- Today's bar uses `fillOpacity={0.45}` and its tick label "היום" is semibold.
- Each chart has an `aria-label` describing it. Charts also need a text alternative: the stat tiles above carry the key numbers. An optional "הצגה כטבלה" toggle is out of scope for v1.

---

## 11. RTL rules

1. The document is `dir="rtl"`. Use **logical properties only**: `margin-inline-start`, `padding-inline-end`, `inset-inline-start`, `border-start-start-radius`, `text-align: start`. Never use `left`/`right`, except inside LTR islands (charts, `.pscale`).
2. Flex and grid follow the direction automatically. **DOM order = reading order**: the first child is on the right.
3. **Numbers, times, units with signs, ranges and Latin text** go in an LTR isolate: `<span class="ltr num">14:05</span>`, `<span class="ltr">15–85</span>`, `<span class="ltr">+27</span>`. Without it, Hebrew bidi reverses ranges ("85–15").
   - Inputs that hold numbers use `.input--num`.
   - The timer display, `.timeline-item__time`, `.side-btn__time`, `.timer-banner__time` and `.stepper__input` already set `direction: ltr`.
4. **Directional icons** point toward the inline end in RTL. Use `ChevronLeft` for "forward/more", and flip arrows that imply direction with `.flip-rtl` (e.g. `Undo2`). Do **not** flip clocks, checkmarks, play/pause, or `ArrowLeftRight`.
5. **Physical sides are physical:** "ימין" is always the right button on screen (DOM first in RTL). Never mirror it.
6. **Charts are LTR** (`dir="ltr"` wrapper); tooltips inside switch back to RTL (`.chart-tooltip { direction: rtl }`).
7. **Progress** fills from the inline start (right). The switch thumb moves to the inline end (left) when on. The stepper's + is at the inline end.
8. Mixed strings: build them as separate spans rather than concatenating digits and Hebrew in one text node, e.g. `התחילה ב-<span class="ltr num">14:02</span>`.

---

## 12. Accessibility

- **Contrast:** every text pair is AA (≥ 4.5:1) in both themes, and every meaningful UI boundary is ≥ 3:1. Verified numerically from `tokens.css`:

| Pair (fg on bg) | Use | Light | Dark |
|---|---|---|---|
| `text` on `bg` | Body text | 13.44 | 14.66 |
| `text` on `surface` | Body text on card | 14.63 | 13.44 |
| `text-muted` on `bg` | Secondary text | 5.83 | 8.05 |
| `text-muted` on `surface` | Secondary text on card | 6.35 | 7.39 |
| `text-muted` on `surface-2` | Secondary text on sunken | 5.44 | 6.72 |
| `text-muted` on `surface-raised` | Muted text in sheets | 6.35 | 6.89 |
| `text-subtle` on `surface` | Placeholder/tertiary | 5.43 | 5.52 |
| `text-subtle` on `bg` | Tertiary on bg | 4.99 | 6.02 |
| `on-primary` on `primary` | Primary button label | 5.51 | 8.19 |
| `on-primary` on `primary-hover` | Primary button hover | 6.79 | 9.22 |
| `primary` on `surface` | Link/ghost button, active tab | 5.51 | 8.65 |
| `primary` on `bg` | Link on bg | 5.06 | 9.43 |
| `on-primary-soft` on `primary-soft` | Selected chip / seg / tab pill | 7.15 | 9.02 |
| `on-accent-soft` on `accent-soft` | "Next side" hint, NEW badge | 5.57 | 8.14 |
| `on-danger` on `danger` | Danger button | 5.69 | 7.43 |
| `danger` on `surface` | Danger text / ghost | 5.69 | 7.10 |
| `danger` on `danger-soft` | Error banner | 4.78 | 6.23 |
| `warning` on `warning-soft` | Warning banner | 5.33 | 7.90 |
| `success` on `success-soft` | Success badge | 4.54 | 7.20 |
| `info` on `info-soft` | Info banner | 4.83 | 6.81 |
| `breast` on `surface` | Breast icon/text | 5.47 | 7.64 |
| `breast` on `breast-soft` | Breast badge / bubble | 4.63 | 6.45 |
| `on-breast` on `breast` | Breast filled (tile icon) | 5.47 | 8.33 |
| `on-breast-fill` on `breast-fill` | Active side button | 5.47 | 6.36 |
| `bottle` on `surface` | Bottle icon/text | 5.62 | 8.11 |
| `bottle` on `bottle-soft` | Bottle badge / bubble | 4.80 | 6.78 |
| `on-bottle` on `bottle` | Bottle filled | 5.62 | 8.84 |
| `solid` on `surface` | Solids icon/text | 5.64 | 9.05 |
| `solid` on `solid-soft` | Solids badge / bubble | 4.97 | 7.21 |
| `on-solid` on `solid` | Solids filled | 5.64 | 9.87 |
| `growth` on `surface` | Growth icon/line | 6.09 | 7.64 |
| `growth` on `growth-soft` | Growth bubble / percentile | 5.12 | 6.49 |
| `on-growth` on `growth` | Growth filled | 6.09 | 8.33 |
| `text` on `breast-soft` | Title on breast tile | 12.36 | 11.35 |
| `text-muted` on `breast-soft` | Meta on breast tile | 5.37 | 6.24 |
| `text-muted` on `bottle-soft` | Meta on bottle tile | 5.42 | 6.18 |
| `text-muted` on `solid-soft` | Meta on solids tile | 5.60 | 5.89 |
| `toast-text` on `toast-bg` | Toast text | 11.94 | 9.51 |
| `toast-action` on `toast-bg` | Toast "בטל" action | 8.79 | 7.11 |
| `border-strong` on `surface` | Input outline (UI ≥ 3) | 3.77 | 3.74 |
| `focus-ring` on `bg` | Focus ring (UI ≥ 3) | 5.06 | 9.43 |
| `focus-ring` on `surface` | Focus ring on card (UI ≥ 3) | 5.51 | 8.65 |
| `chart-axis` on `surface` | Axis ticks | 6.35 | 7.39 |
| `growth` on `chart-band-inner` | Baby line over band (graphic ≥ 3) | 4.64 | 6.16 |

  `accent` (apricot) is decorative only. It is used for the dashed next-side border, which always comes with the "הבא בתור" text pill.

- **Focus:** a global `:focus-visible` gives a 3px `focus-ring` outline with a 2px offset. Rows and tab items use an inset offset. Never remove outlines without a replacement. Inputs also show a halo on any focus.
- **Touch targets:** at least 48×48 everywhere. Smaller visuals (`btn--sm`, `icon-btn--sm`, chips, seg options, switch) extend their hit area with `::after`. Keep at least 8px between adjacent targets.
- **Timer:**
  - `role="timer"` on `.timer__display` with `aria-live="off"`, so it never announces every second.
  - A separate visually-hidden `aria-live="polite"` region announces events (`sr.started`, `sr.switched`, `sr.paused`, `sr.resumed`, `sr.saved`).
  - Side buttons use `aria-pressed` and an `aria-label` such as "ימין, 8 דקות ו-10 שניות, צד פעיל".
  - The banner is `role="status"`. Its main button is labeled "פתיחת טיימר ההנקה" and its pause button "השהיית ההנקה".
- **Tab bar:** `<nav aria-label="ניווט ראשי">` with `<a>` items. The current one has `aria-current="page"`. Labels are always visible text and icons are `aria-hidden`.
- **Sheets and dialogs:**
  - Use `<dialog>` + `showModal()`, with `aria-labelledby` pointing at the `__title`.
  - Initial focus: the first field. For the timer, the active side or the first side. For destructive dialogs, "ביטול".
  - Esc closes. Focus returns to the trigger. The background is inert.
  - Confirmations use `role="alertdialog"` + `aria-describedby`.
- **Forms:** every control has a visible `<label>`. Errors go in `.field__error` and are linked with `aria-describedby` + `aria-invalid`. On a failed submit, focus the first invalid field. Radio-like groups (`.seg`, single-select chips) use `role="radiogroup"` / `role="radio"` + `aria-checked` with arrow-key navigation. Toggle chips use `aria-pressed`.
- **Toasts:** a polite live region. The undo button is a real button. 6 s minimum, paused on hover or focus.
- **Text and zoom:** layouts reflow up to 200% text size. Avoid fixed heights on text containers; tiles use `min-block-size`.
- **Language:** `lang="he"` on `<html>`. Latin fragments (BabyMonitor, WHO, JSON, oz) need no `lang` change, but should be isolated with `.ltr` when they are adjacent to numbers.

---

## 13. Class inventory (all classes in `components.css` + `global.css`)

**Shell & layout:** `app` `app--has-timer` `app-header` `app-header__title` `app-header__actions` `is-scrolled` `page` `section` `section__header` `section__title` `section__eyebrow` `section__action`

**Utilities (global.css):** `visually-hidden` `ltr` `num` `flip-rtl` `truncate` `text-muted` `text-subtle` `text-sm` `text-center` `stack` `stack--2` `stack--3` `stack--4` `stack--6` `stack--8` `cluster` `cluster--1` `cluster--3` `cluster--4` `cluster--nowrap` `cluster--between` `spacer` `grid-2` `grid-3`

**Identity:** `avatar` `avatar--sm` `avatar--lg` `avatar--alt` `baby-switch` `baby-switch__text` `baby-switch__name` `baby-switch__age` `brand-mark`

**Buttons:** `btn` `btn--primary` `btn--secondary` `btn--outline` `btn--ghost` `btn--danger` `btn--ghost-danger` `btn--sm` `btn--lg` `btn--block` `icon-btn` `icon-btn--filled` `icon-btn--primary` `icon-btn--sm` `icon-btn--lg`

**Card & hero:** `card` `card--flat` `card--roomy` `card--flush` `card--interactive` `card__header` `card__title` `card__subtitle` `card__action` `card__body` `card__footer` `since` `since__top` `since__label` `since__value` `since__part` `since__unit` `since__meta`

**Tiles:** `tile-grid` `tile` `tile--breast` `tile--bottle` `tile--solid` `tile--growth` `tile--active` `tile__icon` `tile__label` `tile__meta`

**Selection controls:** `seg` `seg--lg` `seg--inline` `seg__option` `chip` `chip--lg` `chip--breast` `chip--bottle` `chip--solid` `chip--growth` `chip__dot` `chip-row` `chip-grid` `stepper` `stepper__btn` `stepper__value` `stepper__input` `stepper__number` `stepper__unit` `switch` `switch-row` `switch-row__text` `switch-row__title` `switch-row__hint`

**Fields:** `field` `field--invalid` `field__label` `field__optional` `field__hint` `field__error` `input` `input--num` `input--picker` `input__value` `input__native` `select` `select-wrap` `textarea` `input-group` `input-group__affix`

**Overlays:** `scrim` `sheet` `sheet--full` `sheet--breast` `sheet--bottle` `sheet--solid` `sheet--growth` `sheet__handle` `sheet__header` `sheet__icon` `sheet__title` `sheet__body` `sheet__footer` `dialog` `dialog__icon` `dialog__title` `dialog__text` `dialog__actions` `toast-region` `toast` `toast--error` `toast__icon` `toast__text` `toast__action`

**Feedback & data:** `empty` `empty--compact` `empty--growth` `empty__icon` `empty__title` `empty__text` `empty__action` `stat-grid` `stat` `stat--breast` `stat--bottle` `stat--solid` `stat--growth` `stat--primary` `stat__label` `stat__value` `stat__unit` `stat__sub` `stat__delta` `stat__delta--positive` `stat__delta--negative` `badge` `badge--lg` `badge--live` `badge--primary` `badge--accent` `badge--breast` `badge--bottle` `badge--solid` `badge--growth` `badge--success` `badge--warning` `badge--danger` `badge__dot` `banner` `banner--info` `banner--warning` `banner--danger` `banner--success` `banner--neutral` `banner__icon` `banner__body` `banner__title` `banner__text` `meter` `meter__head` `meter__value` `meter__track` `meter__range` `meter__fill` `meter__labels` `disclaimer` `kv` `kv__item` `kv__label` `kv__value` `divider`

**Timeline:** `timeline` `timeline__day` `timeline__list` `day-header` `day-header__title` `day-header__summary` `timeline-item` `timeline-item--breast` `timeline-item--bottle` `timeline-item--solid` `timeline-item--growth` `timeline-item--compact` `timeline-item__time` `timeline-item__icon` `timeline-item__body` `timeline-item__title` `timeline-item__meta` `timeline-item__note` `timeline-item__value`

**Navigation:** `tabbar` `tabbar__inner` `tabbar__item` `tabbar__icon`

**Timer:** `timer` `timer--paused` `timer__head` `timer__display` `timer__breakdown` `timer__sides` `timer__hint` `timer__controls` `side-btn` `side-btn--active` `side-btn--next` `side-btn__label` `side-btn__time` `side-btn__state` `side-btn__hint` `timer-banner` `timer-banner--paused` `timer-banner__main` `timer-banner__icon` `timer-banner__text` `timer-banner__title` `timer-banner__meta` `timer-banner__time`

**Growth:** `percentile` `percentile__badge` `percentile__value` `percentile__label` `percentile__body` `percentile__title` `percentile__main` `pscale` `pscale__track` `pscale__marker` `pscale__ticks`

**Charts:** `chart` `chart--tall` `chart-legend` `legend-item` `legend-swatch` `legend-swatch--line` `legend-swatch--dashed` `legend-swatch--breast` `legend-swatch--bottle` `legend-swatch--solid` `legend-swatch--growth` `legend-swatch--band` `legend-swatch--target` `chart-tooltip` `chart-tooltip__title` `chart-tooltip__row`

**Lists & onboarding:** `list` `row` `row--primary` `row--danger` `row--growth` `row--wrap` `row__icon` `row__body` `row__title` `row__sub` `row__end` `row__value` `onboarding` `onboarding__intro` `onboarding__title` `onboarding__lead` `onboarding__form` `onboarding__footer`

**State hooks (not classes):** `[aria-pressed]`, `[aria-checked]`, `[aria-current="page"]`, `[aria-invalid]`, `[aria-disabled]`, `:disabled`, `.is-selected`, `.is-scrolled`.

**CSS variables components accept:** `--card-pad`, `--stack-gap`, `--cluster-gap`, `--grid-gap`, `--chip-cols`, `--kv-cols`, `--chart-h`, `--from`/`--to`/`--value`/`--meter-color` (meter), `--p` (pscale), `--avatar-size`, `--page-extra-bottom`.

---

## 14. Assumptions & open questions

1. **App name:** the UI shows "BabyMonitor" in Latin. If a Hebrew product name is wanted for the PWA manifest (`name`/`short_name`), Design proposes `short_name: "BabyMonitor"` and `name: "BabyMonitor — מעקב האכלות וגדילה"`.
2. **Time since last feed** counts from the **start** of the last feed (the pediatric convention).
3. **Guideline meter** appears only for mainly bottle-fed babies (no breastfeeding in 72 h) who have a weight. Mixed feeding gets no ml target, to avoid alarming parents.
4. **Next-side rule** includes the "< 2 min means unfinished" tweak (§6.17). Engineering should confirm this in `src/domain`.
5. **Timer max:** to keep a forgotten timer from saving a 6-hour feed, auto-pause after 90 min. Then show the banner "הטיימר פועל כבר שעה וחצי — לסיים?" (proposal; needs Team Lead sign-off).
6. **Icons for the PWA** (192/512/maskable) are not designed in this pass. The proposal is the `brand-mark`: teal gradient rounded square with a white `droplet`. Design can export SVG/PNG on request.
7. **Fonts:** the mockup loads Rubik from Google Fonts. The app must use `@fontsource/rubik` (offline). No other font weights are needed.
