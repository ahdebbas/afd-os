// Static personal data shared across screens

export const TARGETS = { kcal: 1950, protein: 180, carbs: 170, fat: 54 }

// Target daily energy deficit (kcal) used by WHOOP-adaptive intake guidance.
export const DEFICIT_GOAL = 500

export const FITNESS = {
  // InBody readings over time (most recent last). Latest drives the cards/gauge.
  inbody: [
    { date: '2024-03-30', weight: 97.5, smm: 43.4, fatMass: 21.4, fatPct: 22.0 },
    { date: '2025-03-02', weight: 98.4, smm: 45.0, fatMass: 19.7, fatPct: 20.0 },
    { date: '2025-04-02', weight: 97.7, smm: 45.6, fatMass: 18.2, fatPct: 18.6 },
    { date: '2025-06-30', weight: 93.3, smm: 42.8, fatMass: 18.4, fatPct: 19.7 },
    { date: '2025-12-06', weight: 95.3, smm: 44.5, fatMass: 17.7, fatPct: 18.6 },
    { date: '2026-01-26', weight: 93.0, smm: 43.0, fatMass: 17.7, fatPct: 19.0 },
    { date: '2026-04-03', weight: 93.4, smm: 43.6, fatMass: 17.3, fatPct: 18.5 },
    { date: '2026-05-09', weight: 90.7, smm: 42.7, fatMass: 16.0, fatPct: 17.7 },
    { date: '2026-05-23', weight: 90.4, smm: 43.3, fatMass: 14.8, fatPct: 16.3 },
    { date: '2026-06-13', weight: 88.3, smm: 42.2, fatMass: 14.4, fatPct: 16.3 },
  ],
  goal: { fatPct: 13.5 },
  // 4-day split — chest, arms & glutes focus
  program: [
    { name: 'Chest & Triceps', exercises: [
      { name: 'Smith Machine Incline Press', sets: '4×6–8' },
      { name: 'Chest Press Machine', sets: '3×8–10' },
      { name: 'Pec Deck / Cable Fly (high-to-low)', sets: '3×10–12' },
      { name: 'Cable Pull-Through', sets: '3×12–15' },
      { name: 'Triceps Pushdown (rope)', sets: '3×10–12' },
      { name: 'Overhead Cable Triceps Extension', sets: '3×10–12' },
      { name: 'Cable Lateral Raise', sets: '3×12–15' },
      { name: 'Hammer Curl (dumbbell)', sets: '3×10–12' },
    ] },
    { name: 'Glutes & Hams', exercises: [
      { name: 'Hip Thrust Machine', sets: '4×8–10' },
      { name: 'Leg Press (feet high/wide)', sets: '3×8–10' },
      { name: 'Romanian Deadlift (dumbbell)', sets: '3×8–10' },
      { name: 'Hip Abduction Machine', sets: '3×12–15' },
      { name: 'Leg Curl Machine', sets: '3×10–12' },
      { name: 'Bulgarian Split Squat (dumbbell)', sets: '3×8–10' },
      { name: 'Calf Raise Machine', sets: '3×12–15' },
    ] },
    { name: 'Back & Biceps', exercises: [
      { name: 'Lat Pulldown', sets: '4×8–10' },
      { name: 'Seated Cable Row', sets: '3×8–10' },
      { name: 'Smith Machine Shoulder Press', sets: '3×8–10' },
      { name: 'Cable Biceps Curl', sets: '3×10–12' },
      { name: 'Incline Dumbbell Curl', sets: '3×10–12' },
      { name: 'Rear Delt Cable Fly', sets: '3×12–15' },
    ] },
    { name: 'Quads & Glutes', exercises: [
      { name: 'Hip Thrust Machine', sets: '3×6–8' },
      { name: 'Smith Squat or Hack/Leg Press', sets: '4×8–10' },
      { name: 'Leg Extension Machine', sets: '3×12–15' },
      { name: 'Flat Barbell / Smith Bench Press', sets: '3×6–8' },
      { name: 'EZ-Bar or Cable Biceps Curl', sets: '3×10–12' },
      { name: 'Cable Lateral Raise', sets: '3×12–15' },
      { name: 'Rear Delt Cable Fly', sets: '3×12–15' },
      { name: 'Cable / Dumbbell Front Raise', sets: '3×12–15' },
    ] },
  ],
  injuries: [
    ['Left shoulder', 'pain resolved — Smith/machine still preferred, but reintroduce free-weight presses & front raises gradually, light first, stop if discomfort'],
    ['Lower back', 'hip thrust on the machine (not barbell floor loading); stop or reduce ROM if any lower-back loading'],
  ],
}

// Seed working weights (kg) for the main lifts — merged with the user's edits.
export const DEFAULT_WEIGHTS = {
  'Barbell Bench Press': 90,
  'Barbell Squat': 120,
  'Hip Thrust': 110,
  'Overhead Press': 55,
  'Lat Pulldown': 75,
}

export const FINANCE = {
  property: { name: 'Beirut apartment', location: 'Beirut, Lebanon', value: 420000 },
  msft: { shares: 552, price: 411.74, dayChangePct: -1.44, low52: 356.28, high52: 555.45, priceDate: 'Jun 9, 2026' },
  sarwa: {
    total: 31154.18,
    lastUpdated: 'Jun 13, 2026',
    // Exact unit counts from Sarwa, so value = units × live price tracks the daily quote.
    // `cost` is the position's cost basis (total invested); perf is derived live from
    // value vs. cost so it updates with the price instead of being a manual snapshot.
    // Cash (USD) has no units/symbol — it falls back to its fixed value/perf.
    holdings: [
      { ticker: 'ISDW', name: 'Developed Mkts (Halal)', alloc: 60.2, value: 18746.86, cost: 16708.43, perf: 12.20, units: 279.8039 },
      { ticker: 'ISDU', name: 'US Stocks (Halal)',      alloc: 24.8, value: 7721.80,  cost: 6552.23,  perf: 17.85, units: 75.9272 },
      { ticker: 'ISDE', name: 'Emerging Mkts (Halal)', alloc: 6.4,  value: 1997.03,  cost: 1525.07,  perf: 30.96, units: 52.6921 },
      { ticker: 'QQQ',  name: 'Invesco QQQ Trust',      alloc: 3.8,  value: 1192.96,  cost: 996.96,   perf: 19.66, units: 1.65 },
      { ticker: 'IGLN', name: 'Gold',                  alloc: 3.7,  value: 1150.38,  cost: 1342.33,  perf: -14.30, units: 14.0569 },
      { ticker: 'USD',  name: 'Cash (USD)',            alloc: 1.1,  value: 345.15,   perf: 0 },
    ],
  },
}

export const ETF_SYMBOL = { ISDW: 'ISDW.L', ISDU: 'ISDU.L', ISDE: 'ISDE.L', IGLN: 'IGLN.L', QQQ: 'QQQ' }

// Live value of a Sarwa holding given the quotes map; falls back to the recorded value.
export const holdingValue = (h, q) => {
  const quote = q?.[ETF_SYMBOL[h.ticker]]
  return quote && h.units ? h.units * quote.price : h.value
}

// Rotation index of a logged session within the program (stored idx, or name match).
export const sessionIdx = (s, program) =>
  Number.isInteger(s.idx) ? s.idx : program.findIndex(p => p.name === s.name)

// Suggested next workout: the day after the most recent session in the rotation.
// If it's been more than `gapDays` since the last session, restart at day 1.
export const RESTART_GAP_DAYS = 7
export const nextWorkoutIdx = (program, sessions, gapDays = RESTART_GAP_DAYS) => {
  if (!program?.length) return 0
  const ordered = [...sessions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  const last = ordered.find(s => sessionIdx(s, program) >= 0)
  if (!last) return 0
  const days = Math.floor((Date.now() - new Date(last.date + 'T00:00:00').getTime()) / 86400000)
  if (days > gapDays) return 0
  return (sessionIdx(last, program) + 1) % program.length
}

// Total return on a holding, derived live from current value vs. cost basis.
// Falls back to the recorded perf when there's no cost basis (e.g. cash).
export const holdingPerf = (h, q) =>
  h.cost ? (holdingValue(h, q) / h.cost - 1) * 100 : h.perf
export const sarwaTotal = (sarwa, q) => sarwa.holdings.reduce((s, h) => s + holdingValue(h, q), 0)

export const usd = n => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
