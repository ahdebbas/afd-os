import { useEffect, useState } from 'react'
import { ArrowRight, Clock, Target, TrendingDown, TrendingUp, TriangleAlert, Zap } from 'lucide-react'
import { useFood } from '../../store'
import { useQuotes } from '../../quotes'
import { useClock, usePersistentState } from '../../hooks'
import { dateKey } from '../../dates'
import { DEFICIT_GOAL, TARGETS, FITNESS, FINANCE, nextWorkoutIdx, reconcileFinance, sarwaTotal, usd } from '../../data'
import { connectWhoop, fetchWhoopCalories, WHOOP_POLL_MS } from '../../whoop'
import { fuelingFlag, projectBurn, recommendedIntake } from '../../whoopEnergy'
import { Card, Button, Ring, Meter, NumberFlow, Badge } from '../primitives'

function MacroRow({ label, val, target, color }) {
  return (
    <div className="grid grid-cols-[52px_minmax(0,1fr)_64px] items-center gap-2">
      <span className="text-[12px] d-t2">{label}</span>
      <Meter pct={target ? val / target : 0} color={color} />
      <span className="text-[12px] d-t3 d-num text-right">{Math.round(val)}<span className="d-t3">/{target}g</span></span>
    </div>
  )
}

const kcal = n => Math.round(n).toLocaleString('en-US')

function whoopSnapshot(whoop, eaten = 0) {
  if (!whoop) return { state: 'loading' }
  if (!whoop.connected) return { state: whoop.error ? 'error' : 'disconnected' }
  if (whoop.kcal == null) return { state: 'empty' }

  const burned = Math.round(whoop.kcal)
  const net = burned - eaten
  const capLeft = TARGETS.kcal - eaten
  const paceBase = whoop.weeklyAvg ?? whoop.yesterday
  const paceDelta = paceBase == null ? null : burned - paceBase
  const lastSampleAt = whoop.lastSampleAt ? new Date(whoop.lastSampleAt) : null
  const sampleAgeHours = lastSampleAt ? (Date.now() - lastSampleAt.getTime()) / 3600000 : null

  return {
    state: 'ready',
    burned,
    net,
    capLeft,
    paceDelta,
    historyDays: whoop.days ?? 0,
    lastSampleAt,
    stale: sampleAgeHours != null && sampleAgeHours > 3,
  }
}

function MiniKpi({ label, value, tone = 't1', sub }) {
  return (
    <div className="d-inset px-3 py-2.5">
      <div className={`text-[18px] font-semibold d-num leading-none ${tone === 'up' ? 'd-up' : tone === 'down' ? 'd-down' : 'd-t1'}`}>{value}</div>
      <div className="text-[10px] d-t3 mt-1">{label}</div>
      {sub && <div className="text-[10px] d-t3 mt-0.5 d-num">{sub}</div>}
    </div>
  )
}

function WhoopInsightsCard({ whoop, eaten, protein }) {
  const [adaptive] = usePersistentState('afd-whoop-adaptive', true, v => typeof v === 'boolean')
  const snap = whoopSnapshot(whoop, eaten)

  if (snap.state !== 'ready') {
    const message = snap.state === 'loading'
      ? 'Loading WHOOP energy...'
      : snap.state === 'empty'
        ? 'WHOOP is connected; waiting for the current cycle burn.'
        : snap.state === 'error'
          ? 'WHOOP did not respond. Reconnect if this keeps happening.'
          : 'Connect WHOOP to turn burn, strain, and pace into food guidance.'

    return (
      <Card eyebrow="WHOOP" title="Energy insights">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[13px] d-t3">{message}</p>
          {(snap.state === 'disconnected' || snap.state === 'error') && (
            <Button size="sm" variant="primary" onClick={connectWhoop}>Connect WHOOP</Button>
          )}
        </div>
      </Card>
    )
  }

  const netDeficit = snap.net >= 0
  const projected = projectBurn(whoop)
  const recommend = recommendedIntake(projected)
  const recLeft = recommend != null ? recommend - eaten : null
  const flag = eaten > 0 ? fuelingFlag({ whoop, eaten, protein, projectedBurn: projected }) : null
  const vsYesterday = whoop.yesterday == null ? null : snap.burned - whoop.yesterday
  const vsWeekly = whoop.weeklyAvg == null ? null : snap.burned - whoop.weeklyAvg
  const paceKnown = snap.paceDelta != null
  const paceAhead = paceKnown && snap.paceDelta >= 0
  const PaceIcon = paceAhead ? TrendingUp : paceKnown ? TrendingDown : Zap
  const sampleText = snap.lastSampleAt
    ? `${snap.stale ? 'stale' : 'sampled'} ${snap.lastSampleAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'sampling pending'
  const actionText = eaten <= 0
    ? 'Intake unknown. No meals logged today.'
    : recommend == null
    ? 'Need more hours of burn data before giving an intake recommendation.'
    : recLeft >= 0
      ? `You can still eat about ${kcal(recLeft)} kcal and stay on plan.`
      : `You are about ${kcal(Math.abs(recLeft))} kcal above the recommended intake for today.`

  return (
    <Card eyebrow="WHOOP" title="Energy insights"
      actions={<span className="text-[12px] d-t3 d-num">strain {whoop.strain != null ? whoop.strain.toFixed(1) : '—'}</span>}>
      <div className="grid grid-cols-[1.1fr_1fr] gap-4">
        <div>
          <div className="flex items-end gap-2">
            <span className="text-[34px] font-semibold d-t1 d-num leading-none">{kcal(snap.burned)}</span>
            <span className="text-[11px] d-t3 mb-1">kcal burned</span>
          </div>
          <p className="text-[13px] d-t2 mt-3 leading-relaxed">
            {eaten > 0 ? `${kcal(Math.abs(snap.net))} kcal ${netDeficit ? 'below' : 'above'} burn based on logged food. Intake may be incomplete.` : 'No intake logged. Food balance is unknown.'}
          </p>

          <div className="grid grid-cols-3 gap-2 mt-4">
            <MiniKpi label={snap.capLeft >= 0 ? 'cap left' : 'over cap'} value={kcal(Math.abs(snap.capLeft))} tone={snap.capLeft >= 0 ? 't1' : 'down'} />
            <MiniKpi label={eaten > 0 ? 'logged balance' : 'intake unknown'} value={eaten > 0 ? kcal(Math.abs(snap.net)) : '—'} />
            <MiniKpi label="tonight" value={projected != null ? `~${kcal(projected)}` : '—'} />
          </div>
        </div>

        <div className="space-y-2.5">
          <div className="d-inset px-3 py-2.5 space-y-2">
            <div className="flex items-center justify-between gap-3 text-[12px]">
              <span className="d-t3">vs yesterday by now</span>
              <span className={`d-num ${vsYesterday == null ? 'd-t3' : vsYesterday >= 0 ? 'd-up' : 'd-down'}`}>{vsYesterday == null ? 'building' : `${vsYesterday >= 0 ? '+' : '-'}${kcal(Math.abs(vsYesterday))} kcal`}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-[12px]">
              <span className="d-t3">vs weekly average</span>
              <span className={`d-num ${vsWeekly == null ? 'd-t3' : vsWeekly >= 0 ? 'd-up' : 'd-down'}`}>{vsWeekly == null ? 'building' : `${vsWeekly >= 0 ? '+' : '-'}${kcal(Math.abs(vsWeekly))} kcal`}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-[12px]">
              <span className="d-t3">pace read</span>
              <span className={`flex items-center gap-1.5 ${paceKnown ? (paceAhead ? 'd-up' : 'd-down') : 'd-t3'}`}><PaceIcon size={13} />{paceKnown ? (paceAhead ? 'ahead' : 'behind') : 'building'}</span>
            </div>
          </div>

          {adaptive && projected != null && recommend != null && (
            <div className="d-inset px-3 py-2.5 flex items-start gap-2.5">
              <Target size={14} className="d-accent shrink-0 mt-0.5" />
              <p className="text-[12px] d-t2 leading-relaxed">
                Projected burn <span className="d-t1 d-num">~{kcal(projected)}</span> · eat <span className="d-accent d-num">~{kcal(recommend)}</span> for a {kcal(DEFICIT_GOAL)} deficit.
              </p>
            </div>
          )}

          <p className="text-[12px] d-t2 leading-relaxed"><span className={recLeft != null && recLeft < 0 ? 'd-down' : 'd-accent'}>Action:</span> {actionText}</p>
          {flag && (
            <p className={`text-[12px] leading-relaxed flex items-start gap-1.5 ${flag.kind === 'protein' ? 'd-t2' : 'd-down'}`}>
              <TriangleAlert size={13} className="shrink-0 mt-0.5" />{flag.msg}
            </p>
          )}
        </div>
      </div>
      <div className="mt-4 pt-3 d-divider flex items-center justify-between gap-3 text-[11px] d-t3">
        <span className={snap.stale ? 'd-down' : 'd-accent'}><Clock size={12} className="inline-block mr-1 -mt-0.5" />{sampleText}</span>
        <span>{snap.historyDays >= 3 ? `${snap.historyDays}d history` : `${snap.historyDays}d history building`}</span>
      </div>
    </Card>
  )
}

export default function OverviewPage({ onNavigate }) {
  const { totals, remaining, proteinLeft, entries } = useFood()
  const quotes = useQuotes()
  const today = dateKey(useClock())
  const [savedFinance] = usePersistentState('afd-finance', FINANCE)
  const finance = reconcileFinance(savedFinance)
  const [inbody] = usePersistentState('afd-inbody', FITNESS.inbody, Array.isArray)
  const latestBody = [...inbody].sort((first, second) => first.date.localeCompare(second.date)).at(-1)
  const [program] = usePersistentState('afd-program-v2', FITNESS.program, Array.isArray)
  const [sessions] = usePersistentState('afd-sessions', [], Array.isArray)
  const [, setFoodDay] = usePersistentState('afd-food-day', today)
  const [, setFitnessDay] = usePersistentState('afd-fit-day', today)
  const navigate = destination => {
    if (destination === 'food') setFoodDay(today)
    if (destination === 'fitness') setFitnessDay(today)
    onNavigate(destination)
  }
  const nextWorkout = program[nextWorkoutIdx(program, sessions)]?.name
  const monday = new Date(today + 'T00:00:00')
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  const weekCount = sessions.filter(session => session.date >= dateKey(monday) && session.date <= today).length
  const toGoal = latestBody?.fatPct != null ? (latestBody.fatPct - FITNESS.goal.fatPct).toFixed(1) : null
  const msftValue = finance.msft.shares * (quotes?.MSFT?.price ?? finance.msft.price)
  const sarwaValue = sarwaTotal(finance.sarwa, quotes)
  const total = msftValue + sarwaValue + finance.property.value
  const msftChange = quotes?.MSFT?.changePct
  const [whoop, setWhoop] = useState(null)
  useEffect(() => {
    let alive = true
    const load = async () => { const d = await fetchWhoopCalories(); if (alive) setWhoop(d) }
    void load()
    const id = setInterval(() => { if (document.visibilityState === 'visible') void load() }, WHOOP_POLL_MS)
    return () => { alive = false; clearInterval(id) }
  }, [])

  return (
    <div className="d-enter space-y-4 overview-restored">
      <p className="text-[14px] d-t2">{entries.length ? `${Math.abs(Math.round(remaining)).toLocaleString()} kcal ${remaining < 0 ? 'above' : 'to'} target and ${Math.max(0, Math.round(proteinLeft))}g protein left, based on logged food.` : 'No meals logged today. Intake unknown.'}</p>
      <div className="grid grid-cols-1 min-[1200px]:grid-cols-3 gap-4">
        <Card eyebrow="Food · today" title="Fuel" actions={<Button size="sm" variant="ghost" icon={ArrowRight} onClick={() => navigate('food')}>Open</Button>}>
          <div className="flex items-center gap-4">
            <Ring pct={totals.kcal / TARGETS.kcal} size={104} stroke={9} color={remaining < 0 ? 'var(--d-down)' : 'var(--d-accent)'}>
              <div>
                {entries.length ? <NumberFlow value={Math.abs(remaining)} className="text-[26px] font-semibold d-t1 leading-none" /> : <span className="text-[26px] d-t1">—</span>}
                <div className="text-[10px] d-t3 mt-1">{entries.length ? remaining < 0 ? 'above target' : 'kcal left' : 'not logged'}</div>
              </div>
            </Ring>
            <div className="flex-1 space-y-2.5 min-w-0">
              <MacroRow label="Protein" val={totals.protein} target={TARGETS.protein} color="var(--d-accent)" />
              <MacroRow label="Carbs" val={totals.carbs} target={TARGETS.carbs} color="var(--d-warn)" />
              <MacroRow label="Fat" val={totals.fat} target={TARGETS.fat} color="var(--d-up)" />
            </div>
          </div>
        </Card>
        <Card eyebrow="Fitness" title="Training" actions={<Button size="sm" variant="ghost" icon={ArrowRight} onClick={() => navigate('fitness')}>Open</Button>}>
          <div className="flex items-center gap-4">
            <Ring pct={latestBody?.fatPct != null ? Math.max(0, Math.min(1, (20 - latestBody.fatPct) / (20 - FITNESS.goal.fatPct))) : 0} size={104} stroke={9} color="var(--d-accent)">
              <div><span className="text-[24px] font-semibold d-t1 d-num">{latestBody?.fatPct ?? '—'}<span className="text-[13px] d-t3">%</span></span><div className="text-[10px] d-t3 mt-1">body fat</div></div>
            </Ring>
            <div className="flex-1 min-w-0 space-y-2.5">
              <div><div className="d-eyebrow">Next workout</div><div className="text-[15px] font-semibold d-t1">{nextWorkout || '—'}</div></div>
              <div className="flex items-center gap-2 flex-wrap">{toGoal != null && <Badge tone="accent">{toGoal}% to goal</Badge>}<Badge tone={weekCount >= 4 ? 'up' : 'neutral'}>{weekCount}/4 sessions</Badge></div>
            </div>
          </div>
        </Card>
        <Card eyebrow="Finance" title="Capital" actions={<Button size="sm" variant="ghost" icon={ArrowRight} onClick={() => navigate('finance')}>Open</Button>}>
          <NumberFlow value={total} format={usd} className="d-h1 d-t1 block leading-none break-words" />
          <div className="flex items-center gap-2 mt-2">{msftChange != null && <Badge tone={msftChange >= 0 ? 'up' : 'down'}>{msftChange >= 0 ? '+' : ''}{msftChange.toFixed(2)}% MSFT</Badge>}<span className="text-[12px] d-t3">{quotes?.MSFT ? 'live' : 'last known prices'}</span></div>
          <div className="mt-4 space-y-2">{[['MSFT', msftValue], ['Sarwa', sarwaValue], ['Property', finance.property.value]].map(([label, value]) => <div key={label} className="flex items-center justify-between text-[12px]"><span className="d-t2">{label}</span><span className="d-num d-t1">{usd(value)}</span></div>)}</div>
        </Card>
      </div>
      <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,.9fr)] gap-4">
        <WhoopInsightsCard whoop={whoop} eaten={totals.kcal} protein={totals.protein} />
        <Card eyebrow={`${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`} title="Today's log" actions={<Button size="sm" variant="ghost" icon={ArrowRight} onClick={() => navigate('food')}>Food</Button>}>
          {!entries.length ? <p className="text-[13px] d-t3">Nothing logged yet.</p> : <div className="space-y-0.5 -mx-1">{entries.slice(-5).reverse().map(entry => <div key={entry.uid} className="flex items-center justify-between px-1 py-1.5 gap-2"><div className="flex items-center gap-2.5 min-w-0"><span className="text-[11px] d-t3 d-num w-10">{entry.time}</span><span className="text-[13px] d-t1 truncate">{entry.name}</span></div><span className="text-[12px] d-num d-t2 shrink-0">{entry.kcal} kcal</span></div>)}</div>}
        </Card>
      </div>
    </div>
  )
}
