import { useEffect, useState } from 'react'
import { Beef, Droplets, Dumbbell, Flame, Moon, Play, Settings2, Sun, Wallet, Wheat } from 'lucide-react'
import { useFood } from '../store'
import { ETF_SYMBOL, FINANCE, FITNESS, TARGETS, nextWorkoutIdx, sarwaTotal, usd } from '../data'
import { Gauge, Odometer } from '../ui'
import { useQuotes } from '../quotes'
import { usePersistentState } from '../hooks'
import { dateKey, todayKey } from '../dates'
import { fetchWhoopCalories, fetchWhoopCycles, WHOOP_POLL_MS } from '../whoop'
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
  const [cycles, setCycles] = useState(null)

  useEffect(() => {
    let alive = true
    const loadWhoop = async () => {
      const [data, history] = await Promise.all([fetchWhoopCalories(), fetchWhoopCycles()])
      if (alive) { setWhoop(data); setCycles(history) }
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

  // WHOOP burn history → last 7 days for the mini chart (today uses the live intraday burn).
  const burnReady = whoop?.connected && whoop.kcal != null
  const burnBase = burnReady ? (whoop.weeklyAvg ?? whoop.yesterday ?? null) : null
  const burnDelta = burnReady && burnBase != null ? whoop.kcal - burnBase : null
  // WHOOP reports one cycle per physiological day (sleep-to-sleep), which doesn't line
  // up with calendar midnight — so we plot the last 7 cycles by their own date rather
  // than forcing a fixed weekday grid (which would blank out the boundary day). The most
  // recent cycle may be `partial` (in progress); it's the "current" bar and uses the
  // fresher live intraday burn.
  // WHOOP returns burn per cycle (≈ one per calendar day), but stamps each cycle's date
  // from its UTC start — which lands a day early for east-of-UTC timezones (Beirut, +3),
  // shifting every weekday label back one day. The cycles are consecutive and the newest
  // (`partial`) one is today, so anchor the latest bar to today and walk backwards. This
  // gives correct weekday labels that match the WHOOP app, with today as the live bar.
  const sortedCycles = cycles?.connected ? [...(cycles.cycles || [])].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)) : []
  const recentCycles = sortedCycles.slice(-7)
  const lastIsPartial = recentCycles.length > 0 && !!recentCycles[recentCycles.length - 1].partial
  // If the live/partial cycle is present it's today; otherwise the newest completed cycle
  // is yesterday and a live "today" bar is appended below.
  const endOffset = lastIsPartial ? 0 : 1
  const burnDays = recentCycles.map((c, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (recentCycles.length - 1 - i) - endOffset)
    const key = dateKey(d)
    return {
      key,
      isToday: key === todayKey(),
      kcal: c.partial && burnReady ? Math.round(whoop.kcal) : c.kcal,
      label: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
    }
  })
  // Fallback: live burn exists but today's cycle hasn't surfaced yet — append a live bar.
  if (burnReady && !burnDays.some(d => d.isToday)) {
    burnDays.push({ key: todayKey(), isToday: true, kcal: Math.round(whoop.kcal), label: new Date().toLocaleDateString('en-US', { weekday: 'narrow' }) })
    if (burnDays.length > 7) burnDays.shift()
  }
  const hasBurn = burnDays.some(d => d.kcal != null)
  const maxBurn = Math.max(1, ...burnDays.map(d => d.kcal || 0))
  const todayBurn = burnDays.find(d => d.isToday)?.kcal ?? burnDays[burnDays.length - 1]?.kcal ?? null
  const kcalCompact = n => (n >= 1000 ? `${(n / 1000).toFixed(n >= 9950 ? 0 : 1)}k` : `${Math.round(n)}`)

  // Workouts logged this week (Monday → today).
  const weekMonday = (() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dateKey(d) })()
  const workoutsThisWeek = sessions.filter(s => s.date >= weekMonday && s.date <= todayKey()).length

  // Body composition snapshot (latest InBody vs the previous reading).
  const bodyMetrics = [
    { label: 'Weight', value: latestBody.weight, unit: 'kg', delta: prevBody?.weight != null ? latestBody.weight - prevBody.weight : null, lowerBetter: true },
    { label: 'Muscle', value: latestBody.smm, unit: 'kg', delta: prevBody?.smm != null ? latestBody.smm - prevBody.smm : null, lowerBetter: false },
    { label: 'Body fat', value: latestBody.fatPct, unit: '%', delta: bodyTrend, lowerBetter: true },
  ]

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
            <Gauge pct={fuelPct} size={152} stroke={15} color={totals.kcal > TARGETS.kcal ? 'var(--down)' : 'var(--acc-food)'} label="Calorie target progress">
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
        <button onClick={() => goTo('fitness')} className="today-card today-brief-card today-fit-card today-tile-int" style={{ '--acc': 'var(--acc-fin)' }}>
          <div className="today-market-head">
            <span className="today-eyebrow">Fitness · today</span>
            <span className="today-week-pill">
              <Dumbbell size={12} strokeWidth={2.4} />
              <strong>{workoutsThisWeek}</strong>
              <span>{workoutsThisWeek === 1 ? 'workout' : 'workouts'} this week</span>
            </span>
          </div>

          {hasBurn && (
            <div className="today-burnchart">
              <div className="today-burnchart-head">
                <span className="today-micro-label">Burn · last 7 days</span>
                <span className="today-burnchart-today">
                  <Flame size={13} strokeWidth={2.4} />
                  <strong>{todayBurn != null ? todayBurn.toLocaleString() : '—'}</strong> kcal today
                  {burnDelta != null && (
                    <span className={`today-burn-delta ${burnDelta >= 0 ? 'up' : 'down'}`}>{burnDelta >= 0 ? '+' : ''}{Math.round(burnDelta).toLocaleString()}</span>
                  )}
                </span>
              </div>
              <div className="today-burnbars" aria-hidden="true">
                {burnDays.map(d => (
                  <div key={d.key} className={`today-burnbar ${d.isToday ? 'on' : ''} ${d.kcal == null ? 'empty' : ''}`}>
                    <span className="today-burnbar-val">{d.kcal != null ? kcalCompact(d.kcal) : '–'}</span>
                    <span className="today-burnbar-track">
                      <span className="today-burnbar-fill" style={{ height: `${d.kcal != null ? Math.max(6, Math.round((d.kcal / maxBurn) * 100)) : 0}%` }} />
                    </span>
                    <span className="today-burnbar-day">{d.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <span className="today-fit-body">
            {bodyMetrics.map(m => {
              const good = m.delta == null ? null : (m.lowerBetter ? m.delta < 0 : m.delta > 0)
              return (
                <span key={m.label} className="today-fit-metric">
                  <span className="today-fit-metric-label">{m.label}</span>
                  <strong>{m.value != null ? m.value : '—'}<i>{m.unit}</i></strong>
                  {m.delta != null && Math.abs(m.delta) >= 0.05 && (
                    <span className={`today-fit-trend ${good ? 'good' : 'bad'}`}>{m.delta > 0 ? '+' : ''}{m.delta.toFixed(1)}</span>
                  )}
                </span>
              )
            })}
          </span>

          <span className="today-brief-row today-fit-brief">
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
