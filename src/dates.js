// Local-time date keys (YYYY-MM-DD).
//
// IMPORTANT: never use `new Date().toISOString().slice(0, 10)` for day keys.
// toISOString() is UTC, so in timezones ahead of UTC (e.g. Beirut, UTC+3) the
// early-morning hours still read as the previous day — the food log, workout
// sessions, and day strip would all show "yesterday" until UTC caught up.
// These helpers use the local calendar date instead.

export const dateKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const todayKey = () => dateKey()
