// Shared app defaults. Account records are loaded from saved state.

export const TARGETS = { kcal: 1950, protein: 180, carbs: 170, fat: 54 }

// Target daily energy deficit (kcal) used by WHOOP-adaptive intake guidance.
export const DEFICIT_GOAL = 500

export const FITNESS = {
  inbody: [],
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
  injuries: [],
}

export const DEFAULT_WEIGHTS = {}

export const FINANCE = {
  version: 4,
  properties: [],
  msft: { shares: 0, price: 0 },
  sarwaTrade: { lastUpdated: null, holdings: [] },
  sarwa: { total: 0, lastUpdated: null, holdings: [] },
}

export function reconcileFinance(finance) {
  if (!finance) return FINANCE
  if (finance.version === FINANCE.version) return finance
  const { property, ...portfolio } = finance
  return {
    ...portfolio,
    version: FINANCE.version,
    msft: finance.msft ?? FINANCE.msft,
    sarwa: finance.sarwa ?? FINANCE.sarwa,
    sarwaTrade: finance.sarwaTrade ?? FINANCE.sarwaTrade,
    properties: finance.properties ?? (property ? [{
      id: 'legacy-property',
      name: property.name || 'Property',
      location: property.location ?? '',
      purchaseValue: property.purchaseValue ?? null,
      currentValue: property.value,
    }] : FINANCE.properties),
  }
}

export const propertyTotal = finance => finance.properties.reduce((sum, property) => sum + property.currentValue, 0)

export const ETF_SYMBOL = { ISDW: 'ISDW.L', ISDU: 'ISDU.L', ISDE: 'ISDE.L', IGLN: 'IGLN.L' }
export const holdingSymbol = h => h.symbol ?? ETF_SYMBOL[h.ticker] ?? h.ticker

// Live value of a Sarwa holding given the quotes map; falls back to the recorded value.
export const holdingValue = (h, q) => {
  if (h.units != null && Number(h.units) === 0) return 0
  const quote = q?.[holdingSymbol(h)]
  if (quote && h.units != null) return h.units * quote.price
  // Screenshot quantities are rounded; preserve its value until quantities change.
  if (h.recordedUnits > 0 && h.units != null) return h.value * h.units / h.recordedUnits
  if (Number.isFinite(h.price) && h.units != null) return h.units * h.price
  return h.value
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

export { formatUsd as usd } from './currency.js'
