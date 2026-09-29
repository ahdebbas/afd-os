import { Beef, Droplets, Dumbbell, Flame, Landmark, Play, Wallet, Wheat } from 'lucide-react'
import { useClock, usePersistentState } from './hooks'
import { useFood } from './store'
import { useQuotes } from './quotes'
import { FINANCE, FITNESS, TARGETS, nextWorkoutIdx, reconcileFinance, sarwaTotal, usd } from './data'
import { DEFAULT_CASH_PULSE, buildCashProjection, formatCash } from './cashPulse'
import { dateKey } from './dates'
import { Gauge, Odometer } from './ui'
import { WhoopEnergyPanel } from './whoopInsights'

export default function TodayPulse({ onNavigate, whoop, cycles }) {
  const now = useClock()
  const today = dateKey(now)
  const { totals, entries } = useFood()
  const quotes = useQuotes()
  const [savedFinance] = usePersistentState('afd-finance', FINANCE)
  const finance = reconcileFinance(savedFinance)
  const [cash] = usePersistentState('afd-cash-pulse', DEFAULT_CASH_PULSE)
  const [program] = usePersistentState('afd-program-v2', FITNESS.program, Array.isArray)
  const [sessions] = usePersistentState('afd-sessions', [], Array.isArray)
  const [inbody] = usePersistentState('afd-inbody', FITNESS.inbody, Array.isArray)
  const [, setFoodDay] = usePersistentState('afd-food-day', today)
  const [, setFitnessDay] = usePersistentState('afd-fit-day', today)
  const navigate = destination => {
    if (destination === 'food') setFoodDay(today)
    if (destination === 'fitness') setFitnessDay(today)
    onNavigate(destination)
  }
  const nextWorkout = program[nextWorkoutIdx(program, sessions)]
  const todaySession = sessions.find(session => session.date === today)
  const monday = new Date(now)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  const workoutsThisWeek = sessions.filter(session => session.date >= dateKey(monday) && session.date <= today).length
  const readings = [...inbody].sort((first, second) => first.date.localeCompare(second.date))
  const latestBody = readings.at(-1) || {}
  const previousBody = readings.at(-2)
  const bodyMetrics = [
    { label: 'Weight', key: 'weight', unit: 'kg', lowerBetter: true },
    { label: 'Muscle', key: 'smm', unit: 'kg', lowerBetter: false },
    { label: 'Body fat', key: 'fatPct', unit: '%', lowerBetter: true },
  ].map(metric => ({ ...metric, value: latestBody[metric.key], delta: previousBody?.[metric.key] != null && latestBody[metric.key] != null ? latestBody[metric.key] - previousBody[metric.key] : null }))
  const projection = buildCashProjection(cash, now)
  const money = amount => formatCash(amount, projection.state.currency)
  const hasCash = Boolean(projection.state.cashAsOf)
  const remaining = TARGETS.kcal - totals.kcal
  const stock = quotes?.MSFT
  const msftValue = finance.msft.shares * (stock?.price ?? finance.msft.price)
  const fundValue = sarwaTotal(finance.sarwa, quotes)
  const total = msftValue + fundValue + finance.property.value
  const holdings = [
    { name: 'MSFT', value: msftValue, color: 'var(--asset-equity)' },
    { name: 'Sarwa', value: fundValue, color: 'var(--asset-fund)' },
    { name: 'Property', value: finance.property.value, color: 'var(--asset-real)' },
  ]
  const macros = [
    { Icon: Beef, label: 'P', value: totals.protein, target: TARGETS.protein, color: 'var(--acc-food)' },
    { Icon: Wheat, label: 'C', value: totals.carbs, target: TARGETS.carbs, color: 'var(--warn)' },
    { Icon: Droplets, label: 'F', value: totals.fat, target: TARGETS.fat, color: 'var(--acc-os)' },
  ]
  const burnReady = whoop?.connected && whoop.kcal != null
  const recentCycles = cycles?.connected ? [...(cycles.cycles || [])].sort((first, second) => first.date.localeCompare(second.date)).slice(-7) : []
  const endOffset = recentCycles.at(-1)?.partial ? 0 : 1
  const burnDays = recentCycles.map((cycle, index) => {
    const date = new Date(now)
    date.setDate(date.getDate() - (recentCycles.length - 1 - index) - endOffset)
    const key = dateKey(date)
    return { key, isToday: key === today, kcal: cycle.partial && burnReady ? Math.round(whoop.kcal) : cycle.kcal, label: date.toLocaleDateString('en-US', { weekday: 'narrow' }) }
  })
  if (burnReady && !burnDays.some(day => day.isToday)) {
    burnDays.push({ key: today, isToday: true, kcal: Math.round(whoop.kcal), label: now.toLocaleDateString('en-US', { weekday: 'narrow' }) })
    if (burnDays.length > 7) burnDays.shift()
  }
  const maxBurn = Math.max(1, ...burnDays.map(day => day.kcal || 0))

  return (
    <div className="space-y-4 today-restored">
      <div className="today-compact-stack">
        <button onClick={() => navigate('fitness')} aria-label="Open today's workout" className="today-card today-brief-card today-fit-card today-tile-int" style={{ '--acc': 'var(--acc-fin)' }}>
          <div className="today-market-head">
            <span className="today-eyebrow">Fitness · today</span>
            <span className="today-week-pill"><Dumbbell size={12} strokeWidth={2.4} /><strong>{workoutsThisWeek}</strong><span>{workoutsThisWeek === 1 ? 'workout' : 'workouts'} this week</span></span>
          </div>
          {burnDays.some(day => day.kcal != null) && <div className="today-burnchart">
            <div className="today-burnchart-head">
              <span className="today-micro-label">Burn · last 7 days</span>
              <span className="today-burnchart-today"><Flame size={13} /><strong>{burnReady ? Math.round(whoop.kcal).toLocaleString() : '—'}</strong> kcal today</span>
            </div>
            <div className="today-burnbars" aria-label="WHOOP burn history">{burnDays.map(day => <div key={day.key} className={`today-burnbar ${day.isToday ? 'on' : ''} ${day.kcal == null ? 'empty' : ''}`}>
              <span className="today-burnbar-val">{day.kcal == null ? '—' : day.kcal >= 1000 ? `${(day.kcal / 1000).toFixed(1)}k` : Math.round(day.kcal)}</span>
              <span className="today-burnbar-track"><span className="today-burnbar-fill" style={{ height: `${day.kcal != null ? Math.max(6, day.kcal / maxBurn * 100) : 0}%` }} /></span>
              <span className="today-burnbar-day">{day.label}</span>
            </div>)}</div>
          </div>}
          <span className="today-fit-body">{bodyMetrics.map(metric => <span key={metric.key} className="today-fit-metric">
            <span className="today-fit-metric-label">{metric.label}</span>
            <strong>{metric.value ?? '—'}<i>{metric.unit}</i></strong>
            {metric.delta != null && Math.abs(metric.delta) >= .05 && <span className={`today-fit-trend ${(metric.lowerBetter ? metric.delta < 0 : metric.delta > 0) ? 'good' : 'bad'}`}>{metric.delta > 0 ? '+' : ''}{metric.delta.toFixed(1)}</span>}
          </span>)}</span>
          <span className="today-brief-row today-fit-brief">
            <span className="today-icon-well"><Dumbbell size={16} strokeWidth={2.2} /></span>
            <span className="today-brief-copy"><span className="today-brief-main">{todaySession?.name || nextWorkout?.name || 'Workout'}</span><span className="today-brief-sub">{todaySession ? 'Logged today' : `${nextWorkout?.exercises.length || 0} exercises · next workout`}</span></span>
            <span className="today-start-btn"><Play size={15} fill="currentColor" /></span>
          </span>
        </button>
        <button onClick={() => navigate('finance')} aria-label="View holdings" className="today-card today-brief-card today-finance-brief today-tile-int" style={{ '--acc': 'var(--acc-fin)' }}>
          <div className="today-market-head"><span className="today-eyebrow">Net worth</span></div>
          <span className="today-brief-row">
            <span className="today-icon-well"><Wallet size={16} strokeWidth={2.2} /></span>
            <span className="today-brief-copy"><span className="today-net-headline"><span className="today-brief-main">{usd(total)}</span>{stock && <span className={`today-net-delta ${stock.changePct >= 0 ? 'up' : 'down'}`}>MSFT {stock.changePct >= 0 ? '+' : ''}{stock.changePct.toFixed(2)}%</span>}</span></span>
          </span>
          <span className="today-finance-grid">{holdings.map(holding => <span key={holding.name} className="today-finance-mini" style={{ '--asset-tone': holding.color }}>
            <span className="today-finance-label"><i />{holding.name}</span><strong>{usd(holding.value)}</strong><span className="today-finance-share">{total > 0 ? Math.round(holding.value / total * 100) : 0}% of total</span>
          </span>)}</span>
        </button>
      </div>
      <div className="today-whoop" style={{ '--acc': 'var(--acc-fin)' }}><WhoopEnergyPanel whoop={whoop} eaten={totals.kcal} protein={totals.protein} compact /></div>
      <button onClick={() => navigate('food')} aria-label="Log food for today" className="today-card today-fuel-hero today-fuel-bottom today-tile-int w-full text-left" style={{ '--acc': 'var(--acc-food)' }}>
        <div className="today-fuel-kicker"><span className="today-eyebrow">Fuel</span><span>{entries.length ? 'Based on logged food' : 'Intake unknown'}</span></div>
        <div className="today-fuel-hero-body">
          <div className="today-fuel-gauge"><Gauge pct={totals.kcal / TARGETS.kcal} size={152} stroke={15} color={remaining < 0 ? 'var(--down)' : 'var(--acc-food)'} label="Calorie target progress">
            {entries.length ? <Odometer value={Math.abs(remaining)} className="display today-fuel-left" /> : <span className="display today-fuel-left">—</span>}
            <span className="today-fuel-label">{entries.length ? remaining < 0 ? 'Kcal above target' : 'Kcal left' : 'Not logged'}</span>
          </Gauge></div>
          <div className="today-fuel-macros">{macros.map(({ Icon, label, value, target, color }) => <div key={label} className="today-fuel-macro">
            <div className="today-fuel-macro-top"><span className="today-fuel-macro-id" style={{ color }}><Icon size={18} strokeWidth={2.35} />{label}</span><span className="today-fuel-macro-value">{Math.round(value) > 0 ? `${Math.round(value)}/${target}g` : '0g'}</span></div>
            <div className="today-fuel-bar" style={{ '--macro-color': color }} aria-hidden="true"><span style={{ width: `${Math.min(100, Math.max(0, value / target * 100))}%` }} /></div>
          </div>)}</div>
        </div>
      </button>
      <button onClick={() => navigate('cash')} aria-label="Review cash" className="today-card today-brief-card today-tile-int w-full text-left" style={{ '--acc': 'var(--acc-cash)' }}>
        <div className="today-market-head"><span className="today-eyebrow">Cash</span><span className="today-micro-label">{hasCash && projection.snapshotStale ? 'Update snapshot' : 'Manual snapshot'}</span></div>
        <span className="today-brief-row"><span className="today-icon-well"><Landmark size={16} /></span><span className="today-brief-copy"><span className="today-brief-main today-cash-balance">{hasCash ? money(projection.state.currentCash) : 'Set balance'}</span><span className="today-brief-sub">{projection.overdue.length ? `${projection.overdue.length} uncovered payments past due` : `${money(projection.nextMonthsNeed)} planned · next 3 months`}</span></span></span>
      </button>
    </div>
  )
}
