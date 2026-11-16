# Handoff: AFD OS — "Today" Flagship Dashboard (mobile, light + dark)

## Overview
High-fidelity implementation spec for the **AFD OS mobile "Today" screen** — a single-column dashboard with a net-worth hero, a calorie "fuel" card, a body-fat trend card, a market-sync list, and a bottom tab bar. Target: the **existing AFD OS React + Vite app**. Ships in **both themes** — a light "daylight" variant (`:root`) and a dark OLED "instrument" variant (`html.dark`) — switchable with a toggle.

**This is an implementation spec, not a redesign.** Recreate the look documented here using the app's existing components and CSS-variable system. The values below are final.

## About the design files
- `reference-mock.html` — a **self-contained** HTML/CSS reference (inline tokens, no build step, inline SVG sparklines) with a **working light/dark toggle** (top-left). Open it in a browser to see both themes. It is a **reference**, not code to ship — port it into the React app using existing components.

## Fidelity
**High-fidelity.** Exact hex, px, weight, shadow, and radius values throughout. Match them precisely.

---

## 0. Theming model (READ FIRST)

The screen is driven entirely by CSS custom properties. **Light is the base (`:root`); dark overrides under `html.dark`.** A theme toggle just adds/removes the `dark` class on `<html>` (persist to `localStorage`; the app already has a dark-mode setup — reuse it). Every component below reads tokens, so it themes automatically.

Three rules are **theme-conditional** (not just token swaps) — apply exactly:
1. **Eyebrow tick glow** — dark only. `html.dark .eyebrow::before { box-shadow: 0 0 8px var(--acc); }` (no glow in light).
2. **Hero sparkline end-dot** — light: solid dot + 2.5px white ring + soft shadow, no pulse. Dark: accent glow + pulsing ring.
3. **Card top-highlight** — `--panel-top` is a faint white in dark, `transparent` in light.

```css
/* sparkline dot — base (light) */
.spark .dot { fill:var(--acc); stroke:#fff; stroke-width:2.5; filter:drop-shadow(0 2px 4px rgba(21,23,28,.25)); }
.spark .dot-ring { display:none; }
/* sparkline dot — dark override */
html.dark .spark .dot { stroke:none; filter:drop-shadow(0 0 5px var(--acc)); }
html.dark .spark .dot-ring { display:block; fill:none; stroke:var(--acc); stroke-width:1.5; opacity:.4; } /* + pulse anim */
```

Glow is a **dark-mode live-signal only** — in light, surfaces are clean and shadow-lifted, never glowing.

---

## 1. Design tokens (both themes)

The app already declares most of these. **Light lives in `:root`, dark in `html.dark`.** Use these exact values — the light set is tuned specifically for this screen (cool canvas, white cards that lift, vivid accents, near-black numerics); the app's older beige paper values will look washed-out here, so replace them.

```css
/* LIGHT — "daylight" (base) */
:root {
  --bg:        #EAECEF;   /* cool off-white canvas */
  --surface:   #FFFFFF;   /* pure-white cards (lift on shadow) */
  --surface-2: #F4F5F8;

  --ink:   #15171C;       /* near-black numerics */
  --ink-2: rgba(21,23,28,0.60);
  --ink-3: rgba(21,23,28,0.42);

  --line:  rgba(21,23,28,0.08);
  --track: rgba(21,23,28,0.10);
  --chip:  rgba(21,23,28,0.04);
  --field: rgba(21,23,28,0.04);

  --acc-os:   #3B4FA8;   /* periwinkle */
  --acc-fin:  #2E5BC7;   /* blue */
  --acc-food: #157A57;   /* green */
  --acc-fit:  #157E92;   /* cyan */

  --up:   #157A57;
  --down: #C4453B;
  --warn: #9A6516;
  --ring: #3B4FA8;

  --panel-shadow: 0 1px 2px rgba(21,23,28,0.05), 0 8px 20px rgba(21,23,28,0.07);
  --panel-top: transparent;
}

/* DARK — "instrument" OLED (override) */
html.dark {
  --bg:        #04060C;   /* OLED canvas */
  --surface:   #0A0E17;   /* raised cards */
  --surface-2: #11151F;

  --ink:   #EDF1F7;
  --ink-2: rgba(237,241,247,0.62);
  --ink-3: rgba(237,241,247,0.46);

  --line:  rgba(237,241,247,0.07);
  --track: rgba(237,241,247,0.09);
  --chip:  rgba(237,241,247,0.045);
  --field: rgba(0,0,0,0.35);

  --acc-os:   #8FA2D8;   /* periwinkle */
  --acc-fin:  #6E93CC;   /* blue */
  --acc-food: #46B58C;   /* green */
  --acc-fit:  #4FAFC0;   /* cyan */

  --up:   #46B58C;
  --down: #E0796F;
  --warn: #D6A84E;
  --ring: #8FA2D8;

  --panel-shadow: inset 0 1px 0 rgba(255,255,255,0.04), 0 1px 0 rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.45);
  --panel-top: rgba(255,255,255,0.04);
}
```

**Card surface uses both:** `background-image: linear-gradient(168deg, var(--panel-top), transparent 34%);` (a faint top-sheen in dark, nothing in light).

**Backdrop wash** (`.screen::before`): light `radial-gradient(130% 55% at 50% -8%, rgba(46,91,199,.05), transparent 50%)`; dark `radial-gradient(130% 60% at 50% -10%, rgba(143,162,216,.10), transparent 52%)`.

**Per-card accent pattern.** Each card sets a local `--acc` so one panel system serves every module:
```css
/* on the card element */
style={{ '--acc': 'var(--acc-fin)' }}   /* net worth = finance blue */
```
Chips, gauges, sparklines, and icon wells all read `var(--acc)`.

---

## 2. Typography tokens

Three families (already imported via Google Fonts in `index.css` — add Barlow if missing):

```css
--font-display: "Barlow Condensed", system-ui, sans-serif;  /* big numerics, hero */
--font-body:    "Barlow", -apple-system, sans-serif;        /* labels, copy */
--font-mono:    "JetBrains Mono", ui-monospace, monospace;  /* eyebrows, tickers, numerics */
```

All numerics use `font-variant-numeric: tabular-nums`.

| Role | Family | Size / Weight | Tracking | Notes |
|---|---|---|---|---|
| Hero numeral (net worth) | display | **56px / 800** | `0.005em` | line-height .95 |
| Hero currency `$` | display | 30px / 600 | — | color `--ink-2`, baseline-aligned |
| Card value (kcal, %) | display | 27px / 700 | — | line-height 1 |
| Ring center % | display | 16px / 700 | — | — |
| Eyebrow (NET WORTH, MARKET SYNC) | mono | 10px / 400 | `0.22em` | uppercase, `--ink-3`, leading accent tick |
| Micro label (of 1,950 kcal) | mono | 9px / 400 | `0.16em` | uppercase, `--ink-3` |
| Delta chip | mono | 12px / 600 | — | tabular-nums |
| List name | body | 13px / 400 | — | `--ink-2` |
| List ticker / price | mono | 13px | — | tabular-nums |
| Date (FRI · JUN 13) | display | 15px / 600 | `0.04em` | `--ink-2` |
| Dock label | mono | 9px / 400 | `0.10em` | uppercase |

---

## 3. Spacing, radius & shadow tokens

```css
/* radii (Instrument scale) */
--r-panel: 16px;   /* cards */
--r-tile:  14px;   /* list rows, inner tiles */
--r-chip:  10px;   /* icon wells, gear, range buttons */
--r-field: 10px;
--r-pill:  9999px; /* chips, dots, avatar */

/* spacing (4pt) */
4 · 8 · 10 · 12 · 14 · 16 · 18 · 20 · 22 · 24 · 28

/* elevation */
--panel-shadow: inset 0 1px 0 rgba(255,255,255,0.04), 0 1px 0 rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.45);
```

Key gaps: **screen vertical gap 16px**, **card padding 16–22px**, **two-up tile grid gap 14px**, **status-bar height 50px**, **dock height 84px**.

**Glow is a state, not decoration** — only the live "today" dot on the hero sparkline glows. Resting cards never glow.

---

## 4. Component specs

All cards share the base panel:
```css
.card {
  background: var(--surface);
  background-image: linear-gradient(168deg, rgba(255,255,255,0.04), transparent 34%);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);          /* 16px */
  box-shadow: var(--panel-shadow);
}
```

### 4.1 Header
Row, space-between, padding `8px 4px 0`.
- **Left:** eyebrow "EVENING SYSTEMS CHECK" (mono eyebrow, `--acc: var(--acc-os)`, leading 5px tick with `box-shadow: 0 0 8px var(--acc)`), then date "FRI · JUN 13" (display 15px/600, `--ink-2`, 6px below).
- **Right:** gear button + avatar, 10px gap.
  - Gear: 38×38, `--r-chip`, `background: var(--surface)`, `1px var(--line)`, icon 18px `--ink-2`. `:active { transform: scale(.94) }`.
  - Avatar: 38×38, `--r-pill`, `background: var(--surface)`, `1px var(--line)`, initial in display 16px/700 `--ink-2`.

### 4.2 System-check eyebrow (the leading tick label)
Reused across cards. Inline-flex, 8px gap, `white-space: nowrap`:
```css
.eyebrow { display:inline-flex; align-items:center; gap:8px;
  font-family:var(--font-mono); font-size:10px; letter-spacing:.22em;
  text-transform:uppercase; color:var(--ink-3); }
.eyebrow::before { content:""; width:5px; height:5px; border-radius:50%;
  background:var(--acc); box-shadow:0 0 8px var(--acc); }
```

### 4.3 Net-worth card (HERO) — `--acc: var(--acc-fin)`
Padding `22px 22px 8px`.
1. Eyebrow "NET WORTH".
2. Hero value: `$` (display 30px/600 `--ink-2`) + `463,540` (display **56px/800**, tabular, line-height .95). Use the existing **odometer** component for the digits if available.
3. Deltas row (12px top): up-chip `↑ 1.85%` + sub "+$8,420 today · +$41,900 90d" (mono 11px `--ink-3`).
   - Chip: `padding:4px 9px; border-radius:99px; color:var(--up); background:color-mix(in srgb,var(--up) 15%,transparent)`.
4. **Sparkline** (full width, 76px tall, 16px top) — see §5.
5. **Range bar:** 5 buttons (1W/1M/3M/1Y/ALL), flex, 4px gap, each 28px tall `--r-chip`, mono 11px/600. Active: `background:color-mix(in srgb,var(--acc) 14%,transparent); border:1px solid color-mix(in srgb,var(--acc) 24%,transparent); color:var(--acc)`. Default 3M active.

### 4.4 Fuel card (calories) — `--acc: var(--acc-food)`
Two-up grid, left cell. Padding 16px, column, 10px gap.
- Top row: icon well (32×32 `--r-chip`, `color:var(--acc)`, `background:color-mix(in srgb,var(--acc) 14%,transparent)`, `utensils-crossed` 16px) + label "663 LEFT" (mono micro).
- Body: ring + meta, 14px gap.
  - **Ring:** 64×64 SVG, two `<circle r=27 stroke-width=6>` rotated −90°: track `var(--track)`, value `var(--acc)` round-cap, `stroke-dasharray` = `(pct·circumference) (circumference)`. Circumference = `2π·27 ≈ 169.6`; 66% → `112 170`. Center "%" display 16px/700.
  - Meta: value "1,287" (display 22px/700), label "OF 1,950 KCAL" (mono micro).

### 4.5 Body-fat card — `--acc: var(--acc-fit)`
Two-up grid, right cell. Padding 16px, column, 10px gap.
- Top row: icon well (`dumbbell`) + down-delta chip "−3.7" (up-toned, since lower BF is good): `color:var(--up); background:color-mix(...up 15%...)`.
- Label "BODY FAT" (mono micro), value "16.3" (display 27px/700) + "%" (16px `--ink-3`).
- **Mini sparkline** (full width, 30px tall) — declining trend, `stroke:var(--acc)`, width 2 — see §5.

### 4.6 Market-sync card — `--acc: var(--acc-fin)`
Padding `6px 6px 8px`.
- Head row (space-between, `8px 10px 6px`): eyebrow "MARKET SYNC" + "16:42 EST" (mono 10px `--ink-3`).
- Rows (`.lrow`, padding 10px, `--r-tile`; divider `border-top:1px solid var(--line)` between):
  - Ticker (mono 13px/600, 42px wide) · name (body 13px `--ink-2`, flex:1) · **micro-spark** (44×22, `up`→`--up`, `down`→`--down`, width 1.8) · price (mono 13px, 64px right-aligned, tabular).
  - Data: MSFT $411.74 (down), VOO $512.30 (up), NVDA $138.07 (up).

### 4.7 Bottom nav (dock)
Absolute bottom, height 84px, padding `10px 22px 26px`, `background:linear-gradient(to top,var(--bg) 62%,transparent)`, `border-top:1px solid var(--line)`.
- 4 buttons (Today/Finance/Food/Fitness), column, 4px gap, icon 22px + mono 9px/.10em uppercase label, color `--ink-3`. Active = `--acc-os`. `:active{ transform:scale(.92) }`. Icons: `layout-grid`, `wallet`, `utensils-crossed`, `dumbbell` (lucide-react, already in app).

---

## 5. Sparklines (the data-viz)

Inline SVG, `preserveAspectRatio="none"`, viewBox matched to render size. Build the `d` from a numeric array:

```js
function sparkPath(data, w, h, pad = 6) {
  const min = Math.min(...data), max = Math.max(...data), span = (max - min) || 1;
  return data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = pad + (1 - (v - min) / span) * (h - pad * 2);
    return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}
```

- **Hero sparkline:** `<path>` line `stroke:var(--acc); stroke-width:2.5; round caps`. Add an **area fill** under it: same path + `L${w} ${h} L0 ${h} Z`, filled with a vertical `linearGradient` from `var(--acc)`@0.22 to @0. End **dot**: filled circle r3.5 `var(--acc)` with `filter:drop-shadow(0 0 5px var(--acc))`, plus a pulsing ring (r7→12, opacity .4→0, 2.4s) — the only glow on the screen.
- **Mini / micro sparks:** just the line path, no fill, no dot. Width 2 (body-fat) / 1.8 (market).

Recommend a small `<Sparkline data line area dot accent />` React component reused by all three.

---

## 6. Responsive rules (390px target)

The screen is a single fluid column — it fills the device width; the 402px mock is just the frame. For a real 390px viewport:

```css
.screen { width: 100%; min-height: 100dvh; }
.body {
  padding: 4px 16px calc(env(safe-area-inset-bottom, 0) + 100px);  /* clear the dock */
  display: flex; flex-direction: column; gap: 16px;
}
.app-header { padding-top: calc(max(env(safe-area-inset-top,0), 46px) + 10px); }
.dock { padding-bottom: calc(env(safe-area-inset-bottom,0) + 20px); }
```

- **At ≤390px:** hero numeral may step from 56px → **clamp(44px, 13.5vw, 56px)** to avoid overflow with the `$`. Two-up tile grid stays `1fr 1fr` (tiles are designed for ~170px each at 390px). Sparkline scales via `width:100%` + `preserveAspectRatio="none"`.
- Use `100dvh` (not `vh`) so mobile browser chrome doesn't clip the dock.
- All tap targets ≥44px (gear/avatar are 38px visual but give them 44px hit area via padding).
- Horizontal scrollers (if you add preset rails) use `scrollbar-width:none` + `scroll-snap-type:x proximity`.

---

## 7. Mapping to existing AFD OS code

| This screen | Existing AFD OS source | How to wire |
|---|---|---|
| Screen shell, header, carousel, dock | `src/App.jsx` (`.app-header`, `.dock`, `.dock-btn`, `.dock-pill`, `.carousel`) | This is the **Today** pane of the existing mobile carousel. Reuse the dock + sliding `.dock-pill`. |
| Net-worth odometer digits | `.odo / .odo-d / .odo-reel / .odo-n` in `index.css` (+ App.jsx odometer logic) | Feed the net-worth total into the existing odometer; wrap in display 56px/800. |
| Net worth + 90d series, holdings | `src/data.js`, `src/screens/Finance.jsx` | Pull total + history for the sparkline; pull MSFT/VOO/NVDA quotes for Market Sync. |
| Fuel ring + kcal targets | `src/screens/Food.jsx`, `TARGETS.kcal` (1950) in `data.js`; existing `.gauge-val` | Reuse the gauge transition class; compute `dasharray` from consumed/target. |
| Body-fat value + trend | `src/screens/Fitness.jsx` (weight/bodyfat history) | Feed the history array into the mini `Sparkline`. |
| Icons | `lucide-react` (already a dependency) | `LayoutGrid, Wallet, UtensilsCrossed, Dumbbell, Settings2, TrendingUp`. |
| Date label | `src/dates.js` (`dateKey`) | Format as `EEE · MMM d` → "FRI · JUN 13". |
| Eyebrow tick, chips, hairlines | existing `.eyebrow`/`.acc-chip`/`.hairline-t` utilities | Reuse; they already read `--acc`/`--line`. |

**New code to add:** a reusable `Sparkline` component (§5) and the net-worth **range bar** (1W…ALL) with state. Everything else maps onto existing components.

---

## 8. Verification checklist
- [ ] **Both themes** read correctly via the toggle (light = white cards lift on cool-grey canvas; dark = OLED black with muted accents). No washed-out beige.
- [ ] Glow appears in **dark only** (eyebrow tick + sparkline dot); light uses a clean white-ringed dot and flat tick.
- [ ] Net worth is the clear focal point — biggest element on screen; everything else quiet.
- [ ] Each card's accent is correct: net worth blue, fuel green, body-fat cyan, dock-active periwinkle.
- [ ] Sparklines render with `preserveAspectRatio="none"`, area gradient under the hero line, single pulsing today-dot (the only glow).
- [ ] Tabular numerics — digits don't shift width; deltas are signed.
- [ ] Cards are 16px radius, flat, hairline border + grounded shadow (not floaty).
- [ ] Dock clears the home indicator; content scrolls under a 100px bottom pad.
- [ ] Entrance motion degrades safely (content visible with `prefers-reduced-motion: reduce`).

## Files in this package
- `README.md` — this spec.
- `reference-mock.html` — self-contained target (open in a browser).
