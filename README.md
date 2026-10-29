# AFD OS

A personal, mobile-first **PVA (personal-vault app)** for tracking finances, fitness, and calorie intake — built as an installable PWA with an OLED "mission control" UI.

## Modules

- **Home** — mobile Trajectory: one pinned goal, four supporting KPI cards, liquid capital, daily WHOOP burn analysis, and one contextual action. Desktop keeps its existing overview.
- **Finance** — MSFT position + Sarwa (halal) portfolio with daily market sync.
- **Cash** — manual USD balance, monthly commitments, planned one-offs, and three-month payment coverage. Uses the active shell's theme in light and dark mode; marking payments covered never deducts from the cash snapshot.
- **Food** — calorie/macro logging, presets, day timeline, 7-day trend & streak.
- **Fitness** — body composition, PRs, weekly sessions, injury constraints, program.

All monetary amounts use explicit **USD** labels (including stock prices and
market-change summaries); saved balances and holdings are not converted or changed.
The workout calendar starts on the current local day, advances after midnight or
app resume, and allows historical selection until the next day or reload.

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
Current gym / Beirut programs.

The body-fat ring measures distance closed from the first valid InBody reading;
the last reading's date is always shown, and gaps use percentage points. Training
counts logged days across both gyms in the current local Monday-first week.
No food logs means intake is unknown, not zero. Cash has no invented default
target: progress uses the dated manual balance **before planned payments**, not a
bank feed or projected spendable cash.

The **Liquid capital** KPI adds the dated Cash balance to direct MSFT and ETF
values, excluding property and before planned payments. Include any brokerage
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

The persistent dock still opens Home, Finance, Cash, Food, and Fitness. Contextual
Home actions open today's Food/Fitness; a body check-in opens the actual InBody
form. Normal tab navigation preserves historical browsing.
The daily WHOOP calorie-burn analysis remains on Home, using the same energy
widget and shared polling as the Original layout, including its loading,
disconnected, and error states. The mobile dock occupies its own layout row;
content scrolls above it without oversized spacer padding or a fixed overlay.
**Settings → Mobile Home → Original** restores the previous mobile dashboard
without changing saved data. Home layout, selected goal, and targets sync and
are included in JSON backups.

### Switching workout gyms

Use **Fitness → Current gym / Beirut** on mobile or desktop. The current four-day
split is preserved; Beirut has the two-day A/B program. Each gym keeps independent
working weights, template additions, and rotation history. Returning resumes that
gym's next workout even after weeks away, with no automatic restart. Beirut starts
with blank weights rather than copying loads from different equipment.

Sessions and weekly totals remain combined. Existing sessions belong to Current
gym. A logged date always displays its original gym; changing the selector on a
logged date sets the gym for the next unlogged day without changing that session.
Gym selection, templates, and weights are included in cloud sync and JSON backups.
Beirut Day B lists the biceps and triceps work separately, with two sets each.

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
Currency and workout date checks:
`node --test src/currency.test.mjs src/monthlyWorkoutRecap.test.mjs`.
Gym rotation checks: `node --test src/workoutPrograms.test.mjs`.
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
