import { ETF_SYMBOL, holdingValue } from './data.js'
import { buildCashProjection } from './cashPulse.js'
import { dateKey, isDateKey } from './dates.js'

const clamp = value => Math.max(0, Math.min(1, value))
const round1 = value => Math.round(value * 10) / 10
const amount = value => value != null && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0

export function bodyFatGoal(inbody, target, now = new Date()) {
  const today = dateKey(now)
  const readings = inbody
    .filter(reading => isDateKey(reading?.date) && reading.date <= today && Number(reading.fatPct) > 0 && Number(reading.fatPct) < 100)
    .sort((a, b) => a.date.localeCompare(b.date))
  const baseline = readings[0]
  const latest = readings.at(-1)
  if (!latest) return { available: false, current: null, target, remaining: null, progress: null, complete: false, latestDate: null }
  const current = Number(latest.fatPct)
  const start = Number(baseline.fatPct)
  const complete = current <= target
  return {
    available: true, current, target, complete,
    remaining: round1(Math.max(0, current - target)),
    progress: complete ? 1 : start > target ? clamp((start - current) / (start - target)) : 0,
    change: round1(start - current),
    baseline: start, baselineDate: baseline.date, latestDate: latest.date,
    ageDays: Math.round((new Date(`${today}T12:00:00`) - new Date(`${latest.date}T12:00:00`)) / 86400000),
  }
}

export function weeklyTrainingGoal(sessions, target, now = new Date()) {
  const today = dateKey(now)
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  const weekStart = dateKey(monday)
  const loggedDays = new Set(sessions.filter(session => isDateKey(session?.date) && session.date >= weekStart && session.date <= today).map(session => session.date))
  const current = loggedDays.size
  return {
    available: true, current, target, weekStart,
    remaining: Math.max(0, target - current),
    progress: clamp(current / target), complete: current >= target,
    loggedToday: loggedDays.has(today),
  }
}

export function proteinGoal(entries, target) {
  const valid = entries.every(entry => amount(entry.protein ?? 0))
  if (!entries.length || !valid) return { available: false, invalid: !valid, current: null, target, remaining: null, progress: null, complete: false }
  const current = entries.reduce((total, entry) => total + Number(entry.protein ?? 0), 0)
  return {
    available: true, current, target, remaining: Math.max(0, Math.ceil(target - current)),
    progress: clamp(current / target), complete: current >= target,
  }
}

export function cashBufferGoal(cash, target, now = new Date()) {
  const projection = buildCashProjection(cash, now)
  const timestamp = cash?.cashAsOf ? new Date(cash.cashAsOf).getTime() : NaN
  const available = Number.isFinite(timestamp) && timestamp <= now.getTime() && amount(cash?.currentCash)
  const current = available ? projection.state.currentCash : null
  const configured = target != null
  return {
    available, configured, current, target,
    remaining: available && configured ? Math.max(0, target - current) : null,
    progress: available && configured ? clamp(current / target) : null,
    complete: available && configured && current >= target,
    asOf: available ? cash.cashAsOf : null,
    stale: !available || projection.snapshotStale,
    overdueCount: projection.overdue.length,
    plannedNeed: projection.nextMonthsNeed,
  }
}

export function portfolioSignal(finance, quotes, meta = {}) {
  const positions = []
  let missingCount = 0
  const usableQuotes = Object.fromEntries(Object.entries(quotes || {}).filter(([, quote]) =>
    Number.isFinite(quote?.price) && quote.price > 0 && quote.currency === 'USD'))
  const msft = finance.msft
  if (!amount(msft?.shares)) missingCount++
  else if (Number(msft.shares) > 0) {
    const quote = usableQuotes.MSFT
    const price = quote?.price ?? msft.price
    if (!Number.isFinite(Number(price)) || Number(price) <= 0) missingCount++
    else positions.push({
      ticker: 'MSFT', name: 'Microsoft', value: Number(msft.shares) * Number(price),
      source: quote ? 'quotes' : 'recorded', asOf: quote ? meta.syncedAt : msft.priceDate,
    })
  }
  for (const holding of finance.sarwa?.holdings || []) {
    if (holding.ticker === 'USD') continue
    if (holding.units != null && !amount(holding.units)) { missingCount++; continue }
    if (holding.units != null && Number(holding.units) === 0) continue
    const quote = usableQuotes[ETF_SYMBOL[holding.ticker]]
    const quoted = !!quote && holding.units != null
    const value = holdingValue(holding, usableQuotes)
    if (!amount(value)) { missingCount++; continue }
    if (Number(value) === 0) continue
    positions.push({
      ticker: holding.ticker, name: holding.name, value: Number(value),
      source: quoted ? 'quotes' : 'recorded', asOf: quoted ? meta.syncedAt : finance.sarwa.lastUpdated,
    })
  }
  positions.sort((a, b) => b.value - a.value)
  const total = positions.reduce((sum, position) => sum + position.value, 0)
  const quotedCount = positions.filter(position => position.source === 'quotes').length
  const source = quotedCount === 0 ? 'Recorded values'
    : quotedCount < positions.length ? 'Mixed price dates'
      : meta.status === 'live' && meta.syncedAt ? 'Synced prices' : 'Cached prices'
  const largest = positions[0] || null
  const available = missingCount === 0 && total > 0
  return {
    available, positions, total, largest, source, missingCount,
    syncedAt: quotedCount ? meta.syncedAt ?? null : null,
    quotesFresh: meta.status === 'live' && !!meta.syncedAt,
    share: available ? largest.value / total : null,
    headline: missingCount ? 'Update unpriced holdings in Finance.'
      : available ? `${largest.ticker} is ${Math.round(largest.value / total * 100)}% of your invested portfolio.`
        : 'Add investments to see your portfolio mix.',
  }
}

export function liquidCapital(cash, portfolio) {
  const cashValue = cash.available ? cash.current : null
  const invested = portfolio.missingCount === 0 && amount(portfolio.total) ? portfolio.total : null
  const total = cashValue != null && invested != null ? cashValue + invested : null
  const available = total != null && Number.isFinite(total)
  return { available, total: available ? total : null, cash: cashValue, invested }
}

export function homeNextAction({ mainGoal, body, training, protein, cash, nextWorkout }) {
  if (mainGoal === 'cash') {
    if (!cash.configured) return { kind: 'settings', label: 'Set your buffer target' }
    return { kind: 'navigate', destination: 'cash', label: !cash.available ? 'Set your cash balance' : cash.stale ? 'Update your cash snapshot' : 'Review cash' }
  }
  if (mainGoal === 'body' && !body.available) return { kind: 'navigate', destination: 'fitness', section: 'inbody', label: 'Add a body check-in' }
  if ((mainGoal === 'training' && training.complete) || (mainGoal === 'body' && body.complete)) {
    return { kind: 'why', label: mainGoal === 'training' ? 'Weekly target reached. View goal' : 'Target reached. View goal' }
  }
  if (mainGoal === 'training' && training.loggedToday) return { kind: 'navigate', destination: 'fitness', label: "View today's workout" }
  if (!training.complete && !training.loggedToday) {
    const name = nextWorkout?.name?.split(' \u2014 ')[0]
    return { kind: 'navigate', destination: 'fitness', label: name ? `Open ${name}` : 'Open your workout' }
  }
  if (!protein.available || !protein.complete) return { kind: 'navigate', destination: 'food', label: protein.available ? 'Log food' : "Log today's food" }
  return { kind: 'why', label: 'Daily habits covered. View goal' }
}
