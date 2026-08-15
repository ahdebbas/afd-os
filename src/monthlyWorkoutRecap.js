import { dateKey, todayKey } from './dates'

const round1 = n => Number.isFinite(n) ? Math.round(n * 10) / 10 : null

// Deterministic — every number traces to a logged session or InBody reading. No estimation.
export function buildMonthlyWorkoutRecap({ sessions = [], inbody = [], now = new Date() }) {
  const monthStart = dateKey(new Date(now.getFullYear(), now.getMonth(), 1))
  const monthLabel = new Date(`${monthStart}T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const today = todayKey()
  const daysElapsed = now.getDate()

  const sessionsThisMonth = sessions.filter(s => s.date >= monthStart && s.date <= today)
  const sessionsBeforeMonth = sessions.filter(s => s.date < monthStart)

  const splitCounts = new Map()
  for (const s of sessionsThisMonth) splitCounts.set(s.name, (splitCounts.get(s.name) || 0) + 1)
  const splitBreakdown = [...splitCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  const expected = Math.max(0, Math.round((daysElapsed / 7) * 4))
  const paceNote = sessionsThisMonth.length === 0
    ? 'No sessions logged yet this month.'
    : `${sessionsThisMonth.length} logged vs ~${expected} on a 4×/week pace.`

  // Baseline is the best weight on record strictly before this month — never the live/current
  // working weight, so a same-day edit can't be misread as a mid-month gain.
  const preMonthBest = new Map()
  for (const s of sessionsBeforeMonth) {
    for (const [exercise, weight] of Object.entries(s.weights || {})) {
      const w = +weight
      if (!Number.isFinite(w)) continue
      if (!preMonthBest.has(exercise) || w > preMonthBest.get(exercise)) preMonthBest.set(exercise, w)
    }
  }

  const monthBest = new Map()
  let heaviestLift = null
  for (const s of sessionsThisMonth) {
    for (const [exercise, weight] of Object.entries(s.weights || {})) {
      const w = +weight
      if (!Number.isFinite(w)) continue
      if (!monthBest.has(exercise) || w > monthBest.get(exercise)) monthBest.set(exercise, w)
      if (!heaviestLift || w > heaviestLift.weight) heaviestLift = { exercise, weight: w }
    }
  }

  const topGains = [...monthBest.entries()]
    .map(([exercise, to]) => ({ exercise, from: preMonthBest.get(exercise) ?? null, to }))
    .filter(gain => gain.from != null && gain.to > gain.from)
    .map(gain => ({ exercise: gain.exercise, delta: round1(gain.to - gain.from) }))
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3)

  const orderedInbody = [...inbody].filter(r => r?.date).sort((a, b) => a.date.localeCompare(b.date))
  const latestThisMonth = [...orderedInbody].reverse().find(r => r.date >= monthStart && r.date <= today)
  const baseline = [...orderedInbody].reverse().find(r => r.date < monthStart)

  let bodyChange = null
  if (latestThisMonth && baseline) {
    bodyChange = {
      type: 'delta',
      fatPctDelta: round1(latestThisMonth.fatPct - baseline.fatPct),
      weightDelta: round1(latestThisMonth.weight - baseline.weight),
    }
  } else if (latestThisMonth) {
    bodyChange = { type: 'first', fatPct: latestThisMonth.fatPct, weight: latestThisMonth.weight }
  }

  return { monthLabel, sessionsCount: sessionsThisMonth.length, paceNote, splitBreakdown, topGains, heaviestLift, bodyChange }
}
