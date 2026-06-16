# WHOOP Integration — Spec (for approval, not yet built)

Status: **draft for review.** Nothing here is implemented beyond the existing
OAuth plumbing (`api/whoop/*`, `lib/whoop.js`, `whoop_tokens`). Edit freely.

## Goal & guiding principles
Use WHOOP's energy-expenditure data to make calorie tracking smarter, **without
ever encouraging overeating**.

1. **1,900 kcal is a hard intake ceiling.** WHOOP burn never raises the food
   budget. It only ever surfaces the resulting *deficit* (motivation), or
   suggests eating *less* on low-movement days — never more.
2. **The motivating number is the deficit, not headroom to eat.** Kills the
   classic tracker trap of "burned 500 → eat 500 back."
3. **Honest data.** Intraday comparisons are interpolated/sparse, so they're
   labelled as estimates (`~1,900 by 3PM`), never implied minute-precision.
4. **Manual before automatic.** Workout import starts as one-tap (you confirm)
   before any auto-import; nothing silently writes to the program until trusted.

---

## Scope
Focus: **calories + workouts only.** Recovery and sleep are out of scope for now.

| Feature | Scope |
|---|---|
| Burn / intraday / deficit | `read:cycles` (already have) |
| Workouts (import + backfill) | `read:workout` (add) |

**Action:** add `read:workout` in the WHOOP developer dashboard + update `SCOPES`
in `lib/whoop.js` to `read:cycles read:workout offline`, then **re-consent once**
(tokens must be re-issued to carry the new scope). One-time tap.

---

## Data model

### `whoop_tokens` (exists)
Already created via `supabase/whoop_schema.sql`. No change.

### `whoop_samples` (new)
The intraday curve we build ourselves (WHOOP exposes no hourly history).

```
whoop_samples
  user_id      uuid    references auth.users
  captured_at  timestamptz   -- wall-clock time of the sample
  cycle_id     bigint        -- WHOOP cycle id (detect day reset; cycles reset at WAKE, not midnight)
  kcal         integer       -- cumulative burn at capture time
  primary key (user_id, captured_at)
```
- RLS: user can read own rows; writes only via service role (same pattern as tokens).
- Why `cycle_id`: so "same time yesterday" never compares across a cycle reset.
- Retention: keep ~30–60 days; a cleanup can prune older rows.

---

## Endpoints

### Existing
- `GET /api/whoop/login` — start OAuth
- `GET /api/whoop/callback` — store tokens
- `GET /api/whoop/calories` — current cumulative burn (+ strain)
- `POST /api/whoop/disconnect` — unlink

### New
- `GET /api/whoop/sample?secret=…` — **cron target.** Secret-protected (shared
  token in `WHOOP_CRON_SECRET`). Loops connected users, pulls current cumulative
  burn, inserts a `whoop_samples` row. Idempotent-ish (dedupe by the hour).
- `GET /api/whoop/intraday` — for the logged-in user, returns: burned-so-far,
  same-time-yesterday (interpolated), weekly-avg-at-this-hour (interpolated).
- `GET /api/whoop/workouts?range=7d` — recent WHOOP workouts (sport, start/end,
  duration, kcal, strain) for import + report.
- `GET /api/whoop/report?range=7d` — aggregates for the weekly report.

---

## Cron setup (cron-job.org)
1. Create a free account at cron-job.org.
2. New cron job → URL `https://afd-os.vercel.app/api/whoop/sample?secret=<token>`
   (or secret via custom header — preferred).
3. Schedule: **every hour**.
4. Add `WHOOP_CRON_SECRET` to Vercel env; the endpoint rejects calls without it.
- App-open also fires one opportunistic sample (free extra density).
- Note: even hourly cron cannot *backfill* missed hours — WHOOP only ever
  returns "now." Gaps are filled by interpolation between captured samples.

---

## Features

### F1 — Deficit framing (no new infra; uses `read:cycles`)
On the Food screen, replace the current burned/net panel with deficit-first copy:
- `Eaten 1,400 / 1,900 · Burned 2,600 → deficit 1,200`
- Gauge stays anchored to the 1,900 ceiling. Burn shown as "deficit earned."
- On low-movement days, optionally suggest a *lower* ceiling (never higher).
- **Supersedes the burned/net UI already pushed** to `main` (that gets reworked here).

### F2 — Intraday pacing (the flagship; needs the sampler + `whoop_samples`)
A panel: *"Burned 1,850 by 3PM — ahead of yesterday (1,620) and your weekly
3PM avg (1,710)."*
- Optional tiny sparkline: today's curve vs yesterday's ghost line.
- Empty for the first ~week until samples accumulate; degrade gracefully.
- All comparison values labelled as estimates.

### F3 — Workouts (needs `read:workout`)
- **Auto-import** WHOOP-detected workouts into the Fitness session tracker:
  sport, duration, kcal, strain. Map WHOOP sport → program rotation slot where
  possible; dedupe by WHOOP workout id so re-runs never duplicate.
- **Calorie backfill:** a workout that happened while the app was closed is
  retrievable after the fact, so its burn sharpens the intraday curve (F2)
  around exercise (where straight-line interpolation is least accurate).
- Phase 1: show recent workouts + one-tap import. Phase 2 (if liked):
  auto-import on the hourly sample.

### F4 — Weekly report (needs `read:cycles` + `read:workout`)
One review screen, extending the existing 7-day fuel trend:
- Eaten vs burned bars per day
- Net weekly deficit → projected fat-loss, tied to the InBody body-fat goal
- Workouts logged that week (count, total strain, total kcal)

---

## Build order (phased)
1. **F1 deficit framing** — small, immediate, no infra. Also resolves the
   already-pushed UI.
2. **Sampler + `whoop_samples` + cron** — start ASAP so data accumulates.
3. **F2 intraday comparison UI** — once a few days of samples exist.
4. **F3 workouts** — add `read:workout` scope + re-consent, then import.
5. **F4 reporting.**

---

## Open decisions / risks
- **Cycle-vs-clock-time skew:** variable wake times distort early-morning
  comparisons. Mitigated by storing `cycle_id` + comparing by wall-clock hour.
- **Interpolation accuracy:** worst around workouts (burn spikes). Optional
  `read:workout` backfill sharpens this later.
- **cron-job.org dependency:** external; if it lapses, sampling stops (app-open
  sampling remains as a fallback).
- **Re-consent friction:** adding scopes later = one re-auth tap.
- **Privacy:** burn/recovery data now stored in Supabase — already RLS-protected,
  same posture as the rest of the app.
