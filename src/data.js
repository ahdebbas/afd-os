// Static personal data shared across screens

export const TARGETS = { kcal: 1950, protein: 180, carbs: 170, fat: 54 }

export const FITNESS = {
  bodyComp: { weight: 90.4, muscleMass: 43.3, fatMass: 14.8, fatPct: 16.4, date: 'May 23, 2026' },
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
  msft: { shares: 552, price: 411.74, dayChangePct: -1.44, low52: 356.28, high52: 555.45, priceDate: 'Jun 9, 2026' },
  sarwa: {
    total: 29437.60,
    lastUpdated: 'May 23, 2026',
    holdings: [
      { ticker: 'ISDW', name: 'Developed Mkts (Halal)', alloc: 62.6, value: 18648.93, perf: 11.61 },
      { ticker: 'ISDU', name: 'US Stocks (Halal)',      alloc: 25.9, value: 7700.54,  perf: 17.53 },
      { ticker: 'ISDE', name: 'Emerging Mkts (Halal)', alloc: 6.4,  value: 1906.40,  perf: 25.01 },
      { ticker: 'IGLN', name: 'Gold',                  alloc: 4.0,  value: 1181.73,  perf: -11.96 },
    ],
  },
}

export const usd = n => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
