import { useEffect, useState } from 'react'
import { ArrowRight, Bell, Beef, Wheat, Droplets, TrendingUp, TrendingDown, Dumbbell, UtensilsCrossed, Wallet, Plus, Target } from 'lucide-react'
import { useFood } from '../store'
import { FITNESS, FINANCE, TARGETS, usd, sarwaTotal, ETF_SYMBOL, nextWorkoutIdx } from '../data'
import { SegBar, Label, Odometer } from '../ui'
import { useQuotes } from '../quotes'
import { usePersistentState } from '../hooks'
import { fetchWhoopCalories, WHOOP_POLL_MS } from '../whoop'
import { WhoopEnergyPanel } from '../whoopInsights'

export default function Today({ goTo, openLog }) {
  const { totals, remaining, proteinLeft } = useFood()
  const q = useQuotes()

  const { goal } = FITNESS
  const [inbody] = usePersistentState('afd-inbody', FITNESS.inbody, Array.isArray)
  const latestBody = [...inbody].sort((a, b) => (a.date < b.date ? -1 : 1)).at(-1) || { fatPct: 0 }
  const [program] = usePersistentState('afd-program-v2', FITNESS.program, Array.isArray)
  const [sessions] = usePersistentState('afd-sessions', [], Array.isArray)
  const nextWorkout = program[nextWorkoutIdx(program, sessions)]?.name
  const bodyGap = latestBody.fatPct - goal.fatPct
  const msftPrice = q?.MSFT?.price ?? FINANCE.msft.price
  const msftChange = q?.MSFT ? q.MSFT.changePct : FINANCE.msft.dayChangePct
  const etfLive = FINANCE.sarwa.holdings.some(h => q?.[ETF_SYMBOL[h.ticker]])
  const total = FINANCE.msft.shares * msftPrice + (etfLive ? sarwaTotal(FINANCE.sarwa, q) : FINANCE.sarwa.total) + FINANCE.property.value
  const msftUp = msftChange >= 0

  const macros = [
    { Icon: Beef, label: 'P', val: totals.protein, target: TARGETS.protein, color: 'var(--home-metal)' },
    { Icon: Wheat, label: 'C', val: totals.carbs, target: TARGETS.carbs, color: '#B8B8B8' },
    { Icon: Droplets, label: 'F', val: totals.fat, target: TARGETS.fat, color: '#8F939A' },
  ]

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

  const hour = new Date().getHours()
  const phase = hour < 5 ? 'Night ops' : hour < 12 ? 'Morning systems check' : hour < 18 ? 'Midday status' : 'Evening review'
  const burned = whoop?.connected && whoop.kcal != null ? Math.round(whoop.kcal) : null
  const net = burned != null ? burned - totals.kcal : null
  const fuelPct = Math.min(1, totals.kcal / TARGETS.kcal)
  const netLabel = net == null ? 'pending' : `${Math.abs(net).toLocaleString()} ${net >= 0 ? 'deficit' : 'surplus'}`
  const tip = (() => {
    if (proteinLeft > 20) return `${Math.max(0, proteinLeft)}g protein still open. Make the next meal protein-led.`
    if (remaining < 0) return `You are ${Math.abs(remaining).toLocaleString()} kcal over the food cap. Keep dinner simple.`
    if (burned != null && net != null) return `WHOOP has you at a ${Math.abs(net).toLocaleString()} kcal ${net >= 0 ? 'deficit' : 'surplus'} right now.`
    return `${remaining.toLocaleString()} kcal left today. Log early so the plan stays honest.`
  })()

  return (
    <div className="home-mobile space-y-4">
      <div className="home-topbar">
        <div className="home-avatar" aria-hidden="true">A</div>
        <button className="home-bell press" aria-label="Notifications"><Bell size={16} strokeWidth={2.4} /></button>
      </div>

      <section className="home-hero" style={{ '--acc': 'var(--home-metal)' }}>
        <div className="relative z-10">
          <p className="mono text-[10px] tracking-[0.18em] uppercase text-white/62">{phase}</p>
          <div className="mt-2 flex items-end justify-between gap-4">
            <div>
              <p className="text-white/72 text-[13px] font-medium">Daily balance</p>
              <Odometer value={Math.abs(remaining)} className="display text-[54px] leading-none font-bold text-white" />
              <p className="mono text-[10px] tracking-[0.16em] uppercase text-white/58 mt-1">{remaining >= 0 ? 'kcal left' : 'kcal over'}</p>
            </div>
          </div>
          <div className="home-hero-progress mt-5">
            <span style={{ width: `${Math.max(6, fuelPct * 100)}%` }} />
          </div>
          <div className="home-hero-stats">
            <span><b>{totals.kcal.toLocaleString()}</b> eaten</span>
            <span><b>{burned != null ? burned.toLocaleString() : '—'}</b> burned</span>
            <span><b>{netLabel}</b> net</span>
            <span><b>{Math.max(0, proteinLeft)}g</b> protein open</span>
          </div>
        </div>
        <div className="home-card-art" aria-hidden="true">
          <span className="home-card-slab" />
          <span className="home-card-orb home-card-orb-a" />
          <span className="home-card-orb home-card-orb-b" />
        </div>
      </section>

      <div className="home-status-rail">
        <button onClick={() => goTo('food')} className="home-status-card food-card press text-left" style={{ '--acc': 'var(--home-metal)' }}>
          <div className="home-card-head">
            <Label>Fuel</Label>
            <div className="display text-[32px] leading-none font-bold t1 mt-3">{Math.round(totals.kcal).toLocaleString()}</div>
            <p className="text-[12px] t3 mt-1">of {TARGETS.kcal.toLocaleString()} kcal</p>
          </div>
          <div className="mt-4 space-y-2.5">
            {macros.map(({ Icon, label, val, target, color }) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 mono text-[8px] tracking-[0.14em] uppercase" style={{ color }}><Icon size={10} />{label}</span>
                  <span className="mono text-[9px] t3">{Math.round(val)}/{target}</span>
                </div>
                <SegBar pct={val / target} color={color} cells={6} />
              </div>
            ))}
          </div>
        </button>

        <button onClick={() => goTo('fitness')} className="home-status-card fitness-card press text-left" style={{ '--acc': 'var(--home-metal)' }}>
          <div className="home-card-head">
            <Label>Fitness</Label>
            <div className="home-workout-title t1">{nextWorkout || 'Workout'}</div>
            <p className="text-[12px] t3 mt-1">next workout</p>
          </div>
          <div className="home-fitness-orb" aria-hidden="true"><Dumbbell size={27} strokeWidth={2.3} /></div>
          <p className={`mono text-[10px] mt-4 flex items-center gap-1.5 ${bodyGap <= 0 ? 'up' : 'acc'}`}>
            <Target size={11} /> {latestBody.fatPct}% fat · {Math.abs(bodyGap).toFixed(1)}% {bodyGap <= 0 ? 'past goal' : 'to goal'}
          </p>
        </button>

        <button onClick={() => goTo('finance')} className="home-status-card net-card press text-left" style={{ '--acc': 'var(--home-metal)' }}>
          <div className="home-card-head">
            <Label>Net</Label>
            <Odometer value={total} format={usd} className="display text-[34px] leading-none font-bold t1 mt-3" />
            <p className="text-[12px] t3 mt-1">total portfolio</p>
          </div>
          <div className="home-net-gift" aria-hidden="true"><Wallet size={28} strokeWidth={2.3} /></div>
          <p className={`mono text-[10px] mt-4 flex items-center gap-1.5 ${msftUp ? 'up' : 'down'}`}>
            {msftUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />} MSFT {msftUp ? '+' : ''}{msftChange.toFixed(2)}%
          </p>
        </button>
      </div>

      <section className="home-actions panel p-4">
        <Label className="mb-3">Quick actions</Label>
        <div className="grid grid-cols-4 gap-3">
          <button onClick={openLog} className="home-action press"><span><Plus size={16} /></span><em>Log</em></button>
          <button onClick={() => goTo('food')} className="home-action press"><span><UtensilsCrossed size={16} /></span><em>Food</em></button>
          <button onClick={() => goTo('fitness')} className="home-action press"><span><Dumbbell size={16} /></span><em>Train</em></button>
          <button onClick={() => goTo('finance')} className="home-action press"><span><Wallet size={16} /></span><em>Net</em></button>
        </div>
      </section>

      <button onClick={() => proteinLeft > 20 ? goTo('food') : goTo('fitness')} className="home-tip press text-left">
        <span className="home-tip-sun" aria-hidden="true" />
        <span><strong>Pro tip:</strong> {tip}</span>
        <ArrowRight size={14} className="t3 shrink-0" />
      </button>

      <WhoopEnergyPanel whoop={whoop} eaten={totals.kcal} protein={totals.protein} compact />
    </div>
  )
}
