# AFD OS

A personal, mobile-first **PVA (personal-vault app)** for tracking finances, fitness, and calorie intake — built as an installable PWA with an OLED "mission control" UI.

## Modules

- **Today** — daily overview: fuel gauge, body-fat progress, net worth, quick log.
- **Finance** — MSFT position + Sarwa (halal) portfolio with daily market sync.
- **Cash** — manual USD balance, monthly commitments, planned one-offs, and three-month payment coverage. Uses the active shell's theme in light and dark mode; marking payments covered never deducts from the cash snapshot.
- **Food** — calorie/macro logging, presets, day timeline, 7-day trend & streak.
- **Fitness** — body composition, PRs, weekly sessions, injury constraints, program.

All monetary amounts use explicit **USD** labels (including stock prices and
market-change summaries); saved balances and holdings are not converted or changed.
The workout calendar starts on the current local day, advances after midnight or
app resume, and allows historical selection until the next day or reload.

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
For Cash UI checks, exercise balance editing, recurring and one-off payment forms,
month selection, and advance coverage in both themes and shells. On mobile, sheets
follow the visible viewport above the keyboard, and form touches do not trigger
module swipes.

## Data & privacy

All personal data is stored **locally in the browser** (`localStorage`) — nothing is sent to a server:

| Key               | Contents                          |
| ----------------- | --------------------------------- |
| `afd-food-log`    | Daily food entries                |
| `afd-presets`     | Saved food presets                |
| `afd-sessions`    | Logged workout sessions           |
| `afd-theme-dark`  | Theme preference                  |
| `afd-quotes`      | Cached market quotes (derived)    |

Because storage is per-device, use **Settings → Export backup** to download a JSON
snapshot, and **Restore backup** to import it on another device. Clearing browser
data will erase everything not backed up.

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
