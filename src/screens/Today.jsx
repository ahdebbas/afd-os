import { useEffect, useState } from 'react'
import { Beef, Droplets, Dumbbell, Moon, Play, Settings2, Sun, Wallet, Wheat } from 'lucide-react'
import { useFood } from '../store'
import { ETF_SYMBOL, FINANCE, FITNESS, TARGETS, nextWorkoutIdx, sarwaTotal, usd } from '../data'
import { Gauge, Odometer } from '../ui'
import { useQuotes } from '../quotes'
import { usePersistentState } from '../hooks'
import { fetchWhoopCalories, WHOOP_POLL_MS } from '../whoop'
import { WhoopEnergyPanel } from '../whoopInsights'

const formatDate = () => new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).replace(',', '').replace(' ', ' · ').toUpperCase()
const shortWeekday = date => new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })

export default function Today({ goTo, onOpenSettings, dark, onToggleTheme }) {
  const { totals } = useFood()
  const quotes = useQuotes()
  const [program] = usePersistentState('afd-program-v2', FITNESS.program, Array.isArray)
  const [sessions] = usePersistentState('afd-sessions', [], Array.isArray)
  const [inbody] = usePersistentState('afd-inbody', FITNESS.inbody, Array.isArray)
  const [whoop, setWhoop] = useState(null)

  useEffect(() => {
    let alive = true
    const loadWhoop = async () => {
      const data = await fetchWhoopCalories()
      if (alive) setWhoop(data)
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void loadWhoop()
    }

    void Promise.resolve().then(loadWhoop)
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void loadWhoop()
    }, WHOOP_POLL_MS)
    window.addEventListener('focus', onVisibility)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      alive = false
      clearInterval(id)
      window.removeEventListener('focus', onVisibility)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const nextWorkout = program[nextWorkoutIdx(program, sessions)]
  const nextWorkoutName = nextWorkout?.name || 'Workout'
  const nextWorkoutExerciseCount = nextWorkout?.exercises?.length || 0
  const nextWorkoutDuration = nextWorkoutExerciseCount ? Math.max(30, Math.round((nextWorkoutExerciseCount * 6) / 5) * 5) : 45
  const nextWorkoutLast = [...sessions]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .find(s => s.name === nextWorkoutName)
  const nextWorkoutMeta = `${nextWorkoutExerciseCount || '—'} exercises · ~${nextWorkoutDuration} min · ${nextWorkoutLast ? `last ${shortWeekday(nextWorkoutLast.date)}` : 'not logged yet'}`
  const bodyReadings = [...inbody].sort((a, b) => (a.date < b.date ? -1 : 1))
  const latestBody = bodyReadings[bodyReadings.length - 1] || { fatPct: 0 }
  const prevBody = bodyReadings[bodyReadings.length - 2]
  const bodyTrend = prevBody?.fatPct != null ? latestBody.fatPct - prevBody.fatPct : null
  const bodyProgress = latestBody.fatPct
    ? Math.max(0, Math.min(1, (20 - latestBody.fatPct) / (20 - FITNESS.goal.fatPct)))
    : 0

  const msftQuote = quotes?.MSFT
  const msftPrice = msftQuote?.price ?? FINANCE.msft.price
  const msftChange = msftQuote?.changePct ?? FINANCE.msft.dayChangePct
  const etfLive = FINANCE.sarwa.holdings.some(h => quotes?.[ETF_SYMBOL[h.ticker]])
  const sarwaValue = etfLive ? sarwaTotal(FINANCE.sarwa, quotes) : FINANCE.sarwa.total
  const msftValue = FINANCE.msft.shares * msftPrice
  const total = msftValue + sarwaValue + FINANCE.property.value
  const financeBreakdown = [
    { label: 'MSFT', value: msftValue, tone: 'var(--asset-equity)' },
    { label: 'Sarwa', value: sarwaValue, tone: 'var(--asset-fund)' },
    { label: 'Property', value: FINANCE.property.value, tone: 'var(--asset-real)' },
  ].map(item => ({ ...item, share: total > 0 ? item.value / total : 0 }))
  const fuelPct = Math.min(1, totals.kcal / TARGETS.kcal)
  const remaining = Math.max(0, TARGETS.kcal - totals.kcal)

  const macros = [
    { Icon: Beef, label: 'P', val: totals.protein, target: TARGETS.protein, color: 'var(--acc-food)' },
    { Icon: Wheat, label: 'C', val: totals.carbs, target: TARGETS.carbs, color: 'var(--warn)' },
    { Icon: Droplets, label: 'F', val: totals.fat, target: TARGETS.fat, color: 'var(--acc-os)' },
  ]

  return (
    <div className="today-flagship">
      <header className="today-head">
        <div>
          <span className="today-eyebrow" style={{ '--acc': 'var(--acc-os)' }}>Evening systems check</span>
          <div className="today-date">{formatDate()}</div>
        </div>
        <div className="today-head-actions">
          <button onClick={onToggleTheme} className="today-gear press" aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}>
            {dark ? <Sun size={18} strokeWidth={2.2} /> : <Moon size={18} strokeWidth={2.2} />}
          </button>
          <button onClick={onOpenSettings} className="today-gear press" aria-label="Settings"><Settings2 size={18} strokeWidth={2.2} /></button>
          <div className="today-avatar" aria-hidden="true">A</div>
        </div>
      </header>

      <section onClick={() => goTo('food')} className="today-card today-fuel-hero today-tile-int" style={{ '--acc': 'var(--acc-food)' }}>
        <div className="today-fuel-kicker">
          <span className="today-eyebrow">Fuel</span>
          <span>Today</span>
        </div>
        <div className="today-fuel-hero-body">
          <div className="today-fuel-gauge">
            <Gauge pct={fuelPct} size={196} stroke={17} color={totals.kcal > TARGETS.kcal ? 'var(--down)' : 'var(--acc-food)'} label="Calorie target progress">
              <Odometer value={remaining} className="display today-fuel-left" />
              <span className="today-fuel-label">Kcal left</span>
            </Gauge>
          </div>
          <div className="today-fuel-macros">
            {macros.map(({ Icon, label, val, target, color }) => (
              <div key={label} className="today-fuel-macro">
                <div className="today-fuel-macro-top">
                  <span className="today-fuel-macro-id" style={{ color }}><Icon size={18} strokeWidth={2.35} />{label}</span>
                  <span className="today-fuel-macro-value">{Math.round(val) > 0 ? `${Math.round(val)}/${target}g` : '0g'}</span>
                </div>
                <div className="today-fuel-bar" style={{ '--macro-color': color }} aria-hidden="true">
                  <span style={{ width: `${Math.min(100, Math.max(0, (val / target) * 100))}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="today-compact-stack">
        <button onClick={() => goTo('fitness')} className="today-card today-brief-card today-tile-int" style={{ '--acc': 'var(--acc-fit)' }}>
          <div className="today-market-head">
            <span className="today-eyebrow">Fitness · today</span>
            <span className="today-body-kpi">
              <span className="today-body-kpi-row">
                <span className="today-body-current">{latestBody.fatPct || '—'}%</span>
                <span className="today-body-goal">goal {FITNESS.goal.fatPct}%</span>
                {bodyTrend != null && Math.abs(bodyTrend) >= 0.05 && (
                  <span className={`today-body-trend ${bodyTrend < 0 ? 'toward' : 'away'}`}>{bodyTrend > 0 ? '+' : ''}{bodyTrend.toFixed(1)}</span>
                )}
              </span>
              <span className="today-body-progress" aria-hidden="true"><span style={{ width: `${bodyProgress * 100}%` }} /></span>
            </span>
          </div>
          <span className="today-brief-row">
            <span className="today-icon-well"><Dumbbell size={16} strokeWidth={2.2} /></span>
            <span className="today-brief-copy">
              <span className="today-brief-main">{nextWorkoutName}</span>
              <span className="today-brief-sub">{nextWorkoutMeta}</span>
            </span>
            <span className="today-start-btn" aria-label="Start session"><Play size={15} strokeWidth={2.4} fill="currentColor" /></span>
          </span>
        </button>

        <button onClick={() => goTo('finance')} className="today-card today-brief-card today-finance-brief today-tile-int" style={{ '--acc': 'var(--acc-fin)' }}>
          <div className="today-market-head">
            <span className="today-eyebrow">Net worth</span>
          </div>
          <span className="today-brief-row">
            <span className="today-icon-well"><Wallet size={16} strokeWidth={2.2} /></span>
            <span className="today-brief-copy">
              <span className="today-net-headline">
                <span className="today-brief-main">{usd(total)}</span>
                <span className={`today-net-delta ${msftChange >= 0 ? 'up' : 'down'}`}>{msftChange >= 0 ? '↑' : '↓'} {Math.abs(msftChange).toFixed(2)}%</span>
              </span>
            </span>
          </span>
          <span className="today-allocation-bar" aria-hidden="true">
            {financeBreakdown.map(item => (
              <span key={item.label} style={{ '--asset-tone': item.tone, flexGrow: Math.max(item.share, 0.018) }} />
            ))}
          </span>
          <span className="today-finance-grid">
            {financeBreakdown.map(item => (
              <span key={item.label} className="today-finance-mini" style={{ '--asset-tone': item.tone }}>
                <span className="today-finance-label"><i />{item.label}</span>
                <strong>{usd(item.value)}</strong>
                <span className="today-finance-share">{Math.round(item.share * 100)}% of total</span>
              </span>
            ))}
          </span>
        </button>
      </div>

      <div className="today-whoop" style={{ '--acc': 'var(--acc-fin)' }}>
        <WhoopEnergyPanel whoop={whoop} eaten={totals.kcal} protein={totals.protein} compact />
      </div>
    </div>
  )
}
