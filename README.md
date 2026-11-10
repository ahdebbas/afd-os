# AFD OS

A personal, mobile-first **PVA (personal-vault app)** for tracking finances, fitness, and calorie intake — built as an installable PWA with an OLED "mission control" UI.

## Modules

- **Home** — mobile Trajectory: one pinned goal, four supporting KPI cards, liquid capital, daily WHOOP burn analysis, and one contextual action. Desktop keeps its existing overview.
- **Finance** — Trading (MSFT, GOOGL, NVDA, SPTE) above Sarwa Invest (halal), with hourly market sync and manual refresh.
- **Cash** — manual USD balance, monthly commitments, planned one-offs, and three-month payment coverage. Uses the active shell's theme in light and dark mode; marking payments covered never deducts from the cash snapshot.
- **Food** — calorie/macro logging, presets, day timeline, 7-day trend & streak.
- **Fitness** — body composition, PRs, weekly sessions, injury constraints, program.

All monetary amounts use explicit **USD** labels (including stock prices and
market-change summaries); saved balances and holdings are not converted or changed.
The workout calendar starts on the current local day, advances after midnight or
app resume, and allows historical selection until the next day or reload.
The latest bundled InBody scan is added to existing saved histories by date;
saved readings for that date take precedence, and newer readings remain latest.
Home and Fitness use the same history on mobile and desktop. Scan data is
bundled in the client, just like the earlier readings, not private server-only data.

### Mobile Home

All five mobile pages share the Fitness visual system: Barlow body text,
Barlow Condensed display numbers/headings, JetBrains Mono labels, shared
light/dark surfaces, and the Fitness accent. Desktop styling is unchanged.

Use the left/right arrows beside the orbit to switch between **Body fat**,
**Training**, and **Cash buffer** in one tap. The sequence wraps in both directions;
the selected KPI persists without changing saved targets or progress.
The sliders button edits body-fat, weekly workout, daily protein, and optional USD
cash-buffer targets. Food, Fitness, WHOOP protein guidance, and monthly workout
pace use those same targets. Home's gym control switches the existing independent
Qatar / Beirut Workout programs.

The body-fat ring measures distance closed from the first valid InBody reading;
the last reading's date is always shown, and gaps use percentage points. Training
counts logged days across both gyms in the current local Monday-first week.
No food logs means intake is unknown, not zero. Cash has no invented default
target: progress uses the dated manual balance **before planned payments**, not a
bank feed or projected spendable cash.

The **Liquid capital** KPI adds the dated Cash balance to Trading and Sarwa Invest
securities, excluding property and before planned payments. Include any brokerage
cash in the Cash snapshot: USD holdings are not added separately. No cash-buffer
target is needed. Missing/invalid/future cash snapshots or unpriced holdings
suppress the total rather than treating unknown amounts as zero; known zero
balances and empty securities portfolios remain valid. Stale cash is labelled.
Cash and Invested assets also have separate tappable KPI cards, opening Cash and
Finance respectively. Tap the Liquid capital total for the cash snapshot, portfolio allocation, individual price
sources/dates, and links to Cash and Finance. Recorded, cached, and mixed-date
prices are labelled. Cash and price dates may differ; this is a saved-data
overview, not a synchronized live account balance. Allocation compares securities
only. Insights and goal explanations are calculated locally, not by external AI.

Trading groups Microsoft with the fractional GOOGL, NVDA, and SPTE positions in
one mobile/desktop Finance card, above Sarwa Invest. It shows a combined total,
editable shares, individual values and daily moves, plus live 52-week range bars
for MSFT, GOOGL, NVDA, and SPTE (explicitly unavailable when the feed has no range);
it does not infer cost bases or lifetime returns. Trading is included in net worth,
invested/liquid capital, allocations, and market-change snapshots. Purchases, sales,
and cash updates restart the whole portfolio's market-change baseline: invested
principal is never shown as a gain. Changes resume after another daily snapshot
with the same holdings; older snapshots are retained but are not compared across
holding changes. Snapshots missing quantity metadata also start a new baseline.
Existing Microsoft, Sarwa Trade, and Sarwa Invest saved quantities and history retain
their storage format; this grouping does not move, reset, or duplicate holdings.
Market refresh uses the same Yahoo Finance proxy as MSFT. Older cache formats
refresh automatically to fetch range data; a failed symbol does not block successful quotes. Cached
prices or the supplied screenshot values remain labelled fallbacks when offline.
Edited quantities scale the recorded fallback proportionally; screenshot quantities
are rounded, so a live shares-times-price value may differ from the screenshot.

The persistent dock still opens Home, Finance, Cash, Food, and Fitness. Contextual
Home actions open today's Food/Fitness; a body check-in opens the actual InBody
form. Normal tab navigation preserves historical browsing.
The daily WHOOP calorie-burn analysis remains on Home, using the same energy
widget and shared polling as the Original layout, including its loading,
disconnected, and error states. The mobile dock occupies its own layout row;
content scrolls above it without oversized spacer padding or a fixed overlay.
When installed on the Home Screen, the mobile shell fills the viewport using
fixed edges and the measured window height rather than relying on `100dvh` or
Safari's fixed-edge height, avoiding unused space below the dock when its layout
viewport retains browser-toolbar space. It remeasures on resize, rotation, and
app resume. The dock retains home-indicator safe-area padding. Browser tabs and
the desktop shell keep their existing sizing.
**Settings → Mobile Home → Original** restores the previous mobile dashboard
without changing saved data. Home layout, selected goal, and targets sync and
are included in JSON backups.

### Switching workout gyms

Use **Fitness → Qatar / Beirut Workout** on mobile or desktop. The existing Qatar
four-day split is unchanged. Beirut Workout (Beirut) has Full Body A (chest, quads,
shoulders; 23 sets), Full Body B (glutes, back, upper body; 25 sets), and optional
Specialization C (chest, delts, arms; 21 sets). A/B take approximately 75–90 minutes.
The goal is hypertrophy emphasizing chest, shoulders, arms and glutes while reducing
body fat. Use 1–2 reps in reserve on compounds and 0–2 on isolations.

The mandatory rotation remains A/B; C is manually selectable and never automatically
adds volume or advances A/B. Full Beirut week: Monday A, Wednesday B, optional
Saturday C. With two sessions, do A/B only. Travel week: Monday Qatar Upper A,
Tuesday Qatar Lower, Thursday Qatar Upper B, Saturday Beirut B (select B manually).
Beirut sessions replace Qatar sessions rather than adding workouts. Qatar's saved
day names and exercises are not renamed to match these schedule labels.

Each program retains working weights, template additions, and its own rotation,
even after weeks away. Exercise history, dated last logged weights, PRs and monthly progression
are shared across programs. Known spelling aliases reuse one exercise identity;
different equipment and ambiguous legacy combined exercises stay separate.
Loads remain editable per program; never assume different machines use equivalent loads.
The compact exercise row retains one editable weight; there are no per-set weight
or rep-entry fields. Prescribed sets, rep ranges and rest are shown as guidance.
Use double progression: increase weight after completing all prescribed sets at
the upper rep target with good form. Tap an exercise name to swap for that day's
workout without changing the program template. Its own last recorded weight is
used, never the replaced exercise's load. Respect existing injury constraints and
swap or stop for discomfort.

Sessions and weekly totals remain combined. Existing sessions belong to Current
gym. A logged date always displays its original gym; changing the selector on a
logged date sets the gym for the next unlogged day without changing that session.
Gym selection, templates, weights and daily exercise swaps are included in cloud
sync and JSON backups. Existing sessions, weights, legacy Beirut templates and Qatar
data are retained. The updated Beirut template uses a separate versioned key;
custom additions carry forward without duplicating prescribed exercises. New
sessions snapshot their exercises so later template edits do not rewrite history.

## Tech

- React 19 + Vite
- Tailwind CSS v4
- `vite-plugin-pwa` (offline + installable)
- `lucide-react` icons

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run lint
npm run build    # outputs dist/
npm run preview  # serve the production build locally
```

Cash calculation checks: `node --test src/cashPulse.test.mjs`.
Finance, quote-cache, and portfolio checks:
`node --test src/financePerformance.test.mjs src/quoteCache.test.mjs src/homeInsights.test.mjs src/currency.test.mjs src/cloudSync.test.mjs`.
Installed-app dock/viewport browser checks: `node scripts/check-mobile-viewport.mjs`
with the dev server running (uses the same `PLAYWRIGHT_MODULE` / `PULSE_URL`
overrides as `scripts/check-pulse.mjs`).
Currency and workout date checks:
`node --test src/currency.test.mjs src/monthlyWorkoutRecap.test.mjs`.
Workout checks: `node --test src/workoutPrograms.test.mjs src/workoutHistory.test.mjs src/monthlyWorkoutRecap.test.mjs`.
Home goal, source, and target checks:
`node --test src/homeInsights.test.mjs src/monthlyWorkoutRecap.test.mjs`.
For Cash UI checks, exercise balance editing, recurring and one-off payment forms,
month selection, and advance coverage in both themes and shells. On mobile, sheets
follow the visible viewport above the keyboard, and form touches do not trigger
module swipes.

## Data & privacy

Personal data is cached **locally in the browser** (`localStorage`) and eligible
datasets sync to your authenticated account when cloud sync is configured.
Home insights are calculated locally and do not make external AI requests.

| Key               | Contents                          |
| ----------------- | --------------------------------- |
| `afd-food-log`    | Daily food entries                |
| `afd-presets`     | Saved food presets                |
| `afd-sessions`    | Logged workout sessions           |
| `afd-theme-dark`  | Theme preference                  |
| `afd-quotes`      | Cached market quotes (derived)    |
| `afd-home-v1`     | Mobile Home layout, main goal, and shared targets |

Use **Settings → Export backup** to download a JSON snapshot, and **Restore backup**
to import one. Clearing browser data removes the local copy; unsynced changes are
lost unless backed up.

> Note: finance figures are bundled into the client. Treat any public deployment as
> publicly visible, or keep the site access-restricted.

## Market data

Quotes come from Yahoo Finance via a same-origin proxy (no API key, avoids CORS):

- **dev / preview** — Vite proxy (`vite.config.js`)
- **production** — Netlify redirect (`netlify.toml`)

If the proxy is unreachable the UI falls back to cached/static values and shows a
**Stale**/**Offline** indicator in the Finance module; tap it to retry.

## Deploy to Netlify

`netlify.toml` is already configured:

- Build command `npm run build`, publish directory `dist`
- `/yq/*` → Yahoo Finance proxy (keeps live quotes working in production)
- SPA fallback so all routes resolve to the app shell

Connect the repo in Netlify (or `netlify deploy --prod`) — no extra settings needed.
