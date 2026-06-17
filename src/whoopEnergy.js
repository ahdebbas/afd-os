// Pure WHOOP-energy math shared across screens. Kept JSX-free so it can export
// freely without tripping react-refresh/only-export-components.
import { TARGETS, DEFICIT_GOAL } from './data'

// Fraction of the local day elapsed (0–1), based on the device clock.
const dayFraction = (now = new Date()) =>
  (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400

/**
 * Extrapolate the current WHOOP burn to a full-day total by assuming the
 * remaining hours burn at the average rate seen so far. Returns null before
 * 06:00 (too little signal) or when burn data is missing.
 */
export function projectBurn(whoop, now = new Date()) {
  if (!whoop?.connected || whoop.kcal == null) return null
  if (now.getHours() < 6) return null
  const frac = dayFraction(now)
  if (frac < 0.05) return null
  const projected = Math.round(whoop.kcal / frac)
  return Math.max(Math.round(whoop.kcal), projected)
}

/**
 * Calories you can eat today and still land on the target deficit, given the
 * projected end-of-day burn. Clamped to a sane floor and the fixed food cap.
 */
export function recommendedIntake(projectedBurn) {
  if (projectedBurn == null) return null
  const raw = projectedBurn - DEFICIT_GOAL
  return Math.round(Math.max(1500, Math.min(TARGETS.kcal, raw)))
}

/**
 * Surface a single coaching flag when strain and intake are mismatched.
 * Returns { kind: 'under' | 'over' | 'protein', msg } or null.
 */
export function fuelingFlag({ whoop, eaten = 0, protein = 0, projectedBurn = null, now = new Date() }) {
  if (!whoop?.connected || whoop.kcal == null) return null
  const strain = whoop.strain
  const projectedNet = (projectedBurn ?? whoop.kcal) - eaten
  const lateDay = now.getHours() >= 17

  if (strain != null && strain >= 14 && projectedNet > 1000) {
    return { kind: 'under', msg: `High strain (${strain.toFixed(1)}) on a ${Math.round(projectedNet).toLocaleString()} kcal deficit — eat more to protect recovery.` }
  }
  if (strain != null && strain < 8 && projectedNet < -200) {
    return { kind: 'over', msg: `Low-strain day with a surplus building — ease off intake to stay on the cut.` }
  }
  if (lateDay && eaten > 600 && protein < TARGETS.protein * 0.5) {
    return { kind: 'protein', msg: `Protein at ${Math.round(protein)}g, under half target this late — prioritise a protein-heavy next meal.` }
  }
  return null
}

/**
 * Build TrendChart points from the Fitness `energy.days` array
 * (`[{ key, burned, eaten }]`), plotting net energy (burned − eaten) for days
 * with logged food only, oldest → newest.
 */
export function netEnergyData(days) {
  if (!Array.isArray(days)) return []
  return days
    .filter(d => d.eaten > 0)
    .map(d => ({ date: d.key, value: d.burned - d.eaten }))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
}
