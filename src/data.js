// Static personal data shared across screens

export const TARGETS = { kcal: 1950, protein: 180, carbs: 170, fat: 54 }

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
  program: [
    { name: 'Upper A', exercises: [
      { name: 'Barbell Bench Press', sets: '4×6–8' },
      { name: 'Incline DB Press', sets: '3×8–10' },
      { name: 'Seated Shoulder Press', sets: '3×8–10' },
      { name: 'DB Lateral Raises', sets: '3×12–15' },
      { name: 'Triceps Pushdown', sets: '3×10–12' },
      { name: 'Cable Biceps Curl', sets: '3×10–12' },
    ] },
    { name: 'Lower A', exercises: [
      { name: 'Barbell Squat', sets: '4×6–8' },
      { name: 'Smith Feet-Fwd Squat', sets: '3×8–10' },
      { name: 'Leg Press', sets: '3×10–12' },
      { name: 'Hip Thrust', sets: '3×8–10' },
      { name: 'Hip Abduction', sets: '3×12–15' },
      { name: 'Calf Raise', sets: '3×10–12' },
    ] },
    { name: 'Upper B', exercises: [
      { name: 'Incline Bench Press', sets: '4×6–8' },
      { name: 'Lat Pulldown', sets: '3×8–10' },
      { name: 'Chest Press Machine', sets: '3×8–10' },
      { name: 'Rear Delt Cable', sets: '3×12–15' },
      { name: 'Overhead Press', sets: '3×8–10' },
      { name: 'Skull Crushers', sets: '3×10–12' },
    ] },
    { name: 'Full Body', exercises: [
      { name: 'Hip Thrust', sets: '3×6–8' },
      { name: 'Romanian Deadlift', sets: '3×8–10' },
      { name: 'Bench / Chest Press', sets: '3×6–8' },
      { name: 'Lat Pulldown', sets: '3×8–10' },
      { name: 'Lateral Raises', sets: '3×12–15' },
      { name: 'Biceps Curl', sets: '3×10–12' },
    ] },
  ],
  injuries: [
    ['Left shoulder', 'machine/Smith only, no front raises'],
    ['Lower back', 'monitor hip thrusts'],
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
    // Cash (USD) has no units/symbol — it falls back to its fixed value.
    holdings: [
      { ticker: 'ISDW', name: 'Developed Mkts (Halal)', alloc: 60.2, value: 18746.86, perf: 12.20, units: 279.8039 },
      { ticker: 'ISDU', name: 'US Stocks (Halal)',      alloc: 24.8, value: 7721.80,  perf: 17.85, units: 75.9272 },
      { ticker: 'ISDE', name: 'Emerging Mkts (Halal)', alloc: 6.4,  value: 1997.03,  perf: 30.96, units: 52.6921 },
      { ticker: 'QQQ',  name: 'Invesco QQQ Trust',      alloc: 3.8,  value: 1192.96,  perf: 19.66, units: 1.65 },
      { ticker: 'IGLN', name: 'Gold',                  alloc: 3.7,  value: 1150.38,  perf: -14.30, units: 14.0569 },
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
export const sarwaTotal = (sarwa, q) => sarwa.holdings.reduce((s, h) => s + holdingValue(h, q), 0)

export const usd = n => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
