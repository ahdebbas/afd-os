import { useEffect, useState } from 'react'
import { ArrowRight, Flame, Beef, Wheat, Droplets, TrendingUp, TrendingDown, Dumbbell } from 'lucide-react'
import { useFood } from '../store'
import { FITNESS, FINANCE, TARGETS, usd, sarwaTotal, ETF_SYMBOL, nextWorkoutIdx } from '../data'
import { Gauge, SegBar, Label, Odometer } from '../ui'
import { useQuotes } from '../quotes'
import { usePersistentState } from '../hooks'
import { fetchWhoopCalories } from '../whoop'
import { WhoopEnergyPanel } from '../whoopInsights'

export default function Today({ goTo, openLog }) {
  const { totals, remaining, proteinLeft } = useFood()
  const q = useQuotes()

  const { goal } = FITNESS
  const [inbody] = usePersistentState('afd-inbody', FITNESS.inbody, Array.isArray)
  const latestBody = [...inbody].sort((a, b) => (a.date < b.date ? -1 : 1)).at(-1) || { fatPct: 0 }

  // Next workout in the rotation, derived from the logged sessions (same source as Fitness).
  const [program] = usePersistentState('afd-program-v2', FITNESS.program, Array.isArray)
  const [sessions] = usePersistentState('afd-sessions', [], Array.isArray)
  const nextWorkout = program[nextWorkoutIdx(program, sessions)]?.name
  const toGoal = (latestBody.fatPct - goal.fatPct).toFixed(1)
  const msftPrice = q?.MSFT?.price ?? FINANCE.msft.price
  const msftChange = q?.MSFT ? q.MSFT.changePct : FINANCE.msft.dayChangePct
  const etfLive = FINANCE.sarwa.holdings.some(h => q?.[ETF_SYMBOL[h.ticker]])
  const total = FINANCE.msft.shares * msftPrice + (etfLive ? sarwaTotal(FINANCE.sarwa, q) : FINANCE.sarwa.total) + FINANCE.property.value
  const msftUp = msftChange >= 0

  const macros = [
    { Icon: Beef, label: 'P', val: totals.protein, target: TARGETS.protein, color: 'var(--acc-food)' },
    { Icon: Wheat, label: 'C', val: totals.carbs, target: TARGETS.carbs, color: '#FBBF24' },
    { Icon: Droplets, label: 'F', val: totals.fat, target: TARGETS.fat, color: '#A78BFA' },
  ]

  const [whoop, setWhoop] = useState(null)
  useEffect(() => { fetchWhoopCalories().then(setWhoop) }, [])

  const hour = new Date().getHours()
  const phase = hour < 5 ? 'Night ops' : hour < 12 ? 'Morning systems check' : hour < 18 ? 'Midday status' : 'Evening review'

  return (
    <>
      <div className="px-1">
        <p className="mono text-[10px] tracking-[0.24em] uppercase t3">{phase}</p>
        <p className="text-[15px] t2 font-medium mt-1.5">
          {remaining > 0
            ? <>{remaining.toLocaleString()} kcal and {Math.max(0, proteinLeft)}g protein to go.</>
            : <>Fuel target hit — {totals.protein >= TARGETS.protein ? 'protein covered too. Strong day.' : `${Math.max(0, proteinLeft)}g protein still open.`}</>}
        </p>
      </div>

      {/* Fuel hero */}
      <section className="panel p-6" style={{ '--acc': 'var(--acc-food)' }}>
        <Label className="mb-3">Fuel · today</Label>
        <div className="flex items-center gap-5">
          <Gauge pct={totals.kcal / TARGETS.kcal} size={172} label="Calories eaten">
            <Odometer value={Math.max(0, remaining)} className="display text-[44px] font-bold t1" />
            <span className="mono text-[9px] tracking-[0.2em] uppercase t3 mt-1.5">{remaining >= 0 ? 'kcal left' : 'kcal over'}</span>
          </Gauge>
          <div className="flex-1 space-y-3.5 min-w-0">
            {macros.map(({ Icon, label, val, target, color }) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="t3 flex items-center gap-1.5" style={{ color }}>
                    <Icon size={13} strokeWidth={2.5} />
                    <span className="mono text-[9px] tracking-[0.18em] uppercase">{label}</span>
                  </span>
                  <span className="mono text-[11px] t2">{Math.round(val)}<span className="t3">/{target}g</span></span>
                </div>
                <SegBar pct={val / target} color={color} cells={10} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Module bento */}
      <div className="grid grid-cols-2 gap-3.5">
        <button onClick={() => goTo('fitness')} className="panel tile p-5 text-left" style={{ '--acc': 'var(--acc-fit)' }}>
          <Label className="mb-3">Body</Label>
          <div className="h-[54px] flex items-start overflow-hidden">
            <p className="display text-[22px] leading-[1.12] font-bold t1">{nextWorkout || '—'}</p>
          </div>
          <p className="mono text-[9px] tracking-[0.18em] uppercase t3 mt-1 flex items-center gap-1.5">
            <Dumbbell size={10} strokeWidth={2.5} /> next workout
          </p>
          <p className="mono text-[10px] mt-3 acc flex items-center gap-1.5">
            <Flame size={11} strokeWidth={2.5} /> {latestBody.fatPct}% fat · {toGoal}% to goal
          </p>
          <span className="mono text-[9px] tracking-[0.16em] uppercase t3 mt-4 flex items-center gap-1">open <ArrowRight size={10} /></span>
        </button>

        <button onClick={() => goTo('finance')} className="panel tile p-5 text-left" style={{ '--acc': 'var(--acc-fin)' }}>
          <Label className="mb-3">Net</Label>
          <div className="h-[54px] flex items-start">
            <Odometer value={total} format={usd} className="display text-[30px] leading-none font-bold t1" />
          </div>
          <p className="mono text-[9px] tracking-[0.18em] uppercase t3 mt-1">total portfolio</p>
          <p className={`mono text-[10px] mt-3 flex items-center gap-1.5 ${msftUp ? 'up' : 'down'}`}>
            {msftUp ? <TrendingUp size={11} strokeWidth={2.5} /> : <TrendingDown size={11} strokeWidth={2.5} />}
            MSFT {msftUp ? '+' : ''}{msftChange.toFixed(2)}% {q?.MSFT ? 'live' : 'today'}
          </p>
          <span className="mono text-[9px] tracking-[0.16em] uppercase t3 mt-4 flex items-center gap-1">open <ArrowRight size={10} /></span>
        </button>
      </div>

      {/* Log shortcut */}
      <button onClick={openLog} className="panel tile w-full p-4 flex items-center justify-between" style={{ '--acc': 'var(--acc-food)' }}>
        <span className="mono text-[10px] tracking-[0.2em] uppercase t3">Log a meal from anywhere — tap +</span>
        <ArrowRight size={13} className="t3" />
      </button>

      <WhoopEnergyPanel whoop={whoop} eaten={totals.kcal} protein={totals.protein} compact />
    </>
  )
}
