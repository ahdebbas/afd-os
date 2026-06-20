import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Clock, Target, TrendingDown, TrendingUp, TriangleAlert, Zap } from 'lucide-react'
import { useFood } from '../../store'
import { useQuotes } from '../../quotes'
import { usePersistentState } from '../../hooks'
import { dateKey } from '../../dates'
import { DEFICIT_GOAL, FITNESS, FINANCE, TARGETS, ETF_SYMBOL, sarwaTotal, nextWorkoutIdx, usd } from '../../data'
import { connectWhoop, fetchWhoopCalories, WHOOP_POLL_MS } from '../../whoop'
import { fuelingFlag, projectBurn, recommendedIntake } from '../../whoopEnergy'
import { Card, Ring, Meter, NumberFlow, Badge, Button } from '../primitives'

function MacroRow({ label, val, target, color }) {
  return (
    <div className="grid grid-cols-[64px_minmax(0,1fr)_72px] items-center gap-3">
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
  const flag = fuelingFlag({ whoop, eaten, protein, projectedBurn: projected })
  const vsYesterday = whoop.yesterday == null ? null : snap.burned - whoop.yesterday
  const vsWeekly = whoop.weeklyAvg == null ? null : snap.burned - whoop.weeklyAvg
  const paceKnown = snap.paceDelta != null
  const paceAhead = paceKnown && snap.paceDelta >= 0
  const PaceIcon = paceAhead ? TrendingUp : paceKnown ? TrendingDown : Zap
  const sampleText = snap.lastSampleAt
    ? `${snap.stale ? 'stale' : 'sampled'} ${snap.lastSampleAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'sampling pending'
  const actionText = recommend == null
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
            <span className={netDeficit ? 'd-up' : 'd-down'}>{netDeficit ? `${kcal(snap.net)} kcal net deficit` : `${kcal(Math.abs(snap.net))} kcal net surplus`}</span>
            {' '}after {kcal(eaten)} eaten. Food cap is {kcal(TARGETS.kcal)} kcal.
          </p>

          <div className="grid grid-cols-3 gap-2 mt-4">
            <MiniKpi label={snap.capLeft >= 0 ? 'cap left' : 'over cap'} value={kcal(Math.abs(snap.capLeft))} tone={snap.capLeft >= 0 ? 't1' : 'down'} />
            <MiniKpi label={netDeficit ? 'deficit' : 'surplus'} value={kcal(Math.abs(snap.net))} tone={netDeficit ? 'up' : 'down'} />
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
  const q = useQuotes()

  const [inbody] = usePersistentState('afd-inbody', FITNESS.inbody, Array.isArray)
  const latestBody = [...inbody].sort((a, b) => (a.date < b.date ? -1 : 1)).at(-1) || { fatPct: 0 }
  const [program] = usePersistentState('afd-program-v2', FITNESS.program, Array.isArray)
  const [sessions] = usePersistentState('afd-sessions', [], Array.isArray)
  const nextWorkout = program[nextWorkoutIdx(program, sessions)]?.name
  const toGoal = (latestBody.fatPct - FITNESS.goal.fatPct).toFixed(1)

  const weekCount = useMemo(() => {
    let c = 0
    for (let i = 0; i < 7; i++) {
      const d = new Date()
      const dow = (d.getDay() + 6) % 7
      d.setDate(d.getDate() - dow + i)
      if (sessions.find(s => s.date === dateKey(d))) c++
    }
    return c
  }, [sessions])

  const msftPrice = q?.MSFT?.price ?? FINANCE.msft.price
  const msftChange = q?.MSFT ? q.MSFT.changePct : FINANCE.msft.dayChangePct
  const etfLive = FINANCE.sarwa.holdings.some(h => q?.[ETF_SYMBOL[h.ticker]])
  const sarwaValue = etfLive ? sarwaTotal(FINANCE.sarwa, q) : FINANCE.sarwa.total
  const msftValue = FINANCE.msft.shares * msftPrice
  const total = msftValue + sarwaValue + FINANCE.property.value
  const msftUp = msftChange >= 0

  const [whoop, setWhoop] = useState(null)
  useEffect(() => {
    let alive = true
    const load = async () => { const d = await fetchWhoopCalories(); if (alive) setWhoop(d) }
    void load()
    const id = setInterval(() => { if (document.visibilityState === 'visible') void load() }, WHOOP_POLL_MS)
    return () => { alive = false; clearInterval(id) }
  }, [])

  const todayEntries = entries || []
  const kcalPct = totals.kcal / TARGETS.kcal

  const statusLine = remaining > 0
    ? `${remaining.toLocaleString()} kcal and ${Math.max(0, proteinLeft)}g protein left today.`
    : 'Fuel target met for today.'

  return (
    <div className="d-enter space-y-4">
      <p className="text-[14px] d-t2">{statusLine}</p>

      <div className="grid grid-cols-3 gap-4">
        <Card eyebrow="Food · today" title="Fuel"
          actions={<Button size="sm" variant="ghost" icon={ArrowRight} onClick={() => onNavigate('food')}>Open</Button>}>
          <div className="flex items-center gap-4">
            <Ring pct={kcalPct} size={104} stroke={9} color={remaining < 0 ? 'var(--d-down)' : 'var(--d-accent)'}>
              <div>
                <NumberFlow value={Math.max(0, remaining)} className="text-[26px] font-semibold d-t1 leading-none" />
                <div className="text-[10px] d-t3 mt-1">{remaining >= 0 ? 'kcal left' : 'over'}</div>
              </div>
            </Ring>
            <div className="flex-1 space-y-2.5 min-w-0">
              <MacroRow label="Protein" val={totals.protein} target={TARGETS.protein} color="var(--d-accent)" />
              <MacroRow label="Carbs" val={totals.carbs} target={TARGETS.carbs} color="var(--d-warn)" />
              <MacroRow label="Fat" val={totals.fat} target={TARGETS.fat} color="var(--d-up)" />
            </div>
          </div>
        </Card>

        <Card eyebrow="Fitness" title="Training"
          actions={<Button size="sm" variant="ghost" icon={ArrowRight} onClick={() => onNavigate('fitness')}>Open</Button>}>
          <div className="flex items-center gap-4">
            <Ring pct={Math.max(0.04, Math.min(1, (20 - latestBody.fatPct) / (20 - FITNESS.goal.fatPct)))} size={104} stroke={9} color="var(--d-accent)">
              <div>
                <span className="text-[24px] font-semibold d-t1 leading-none d-num">{latestBody.fatPct}<span className="text-[13px] d-t3">%</span></span>
                <div className="text-[10px] d-t3 mt-1">body fat</div>
              </div>
            </Ring>
            <div className="flex-1 min-w-0 space-y-2.5">
              <div>
                <div className="d-eyebrow">Next workout</div>
                <div className="text-[15px] font-semibold d-t1 truncate">{nextWorkout || '—'}</div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge tone="accent">{toGoal}% to goal</Badge>
                <Badge tone={weekCount >= 4 ? 'up' : 'neutral'}>{weekCount}/4 sessions</Badge>
              </div>
            </div>
          </div>
        </Card>

        <Card eyebrow="Finance" title="Capital"
          actions={<Button size="sm" variant="ghost" icon={ArrowRight} onClick={() => onNavigate('finance')}>Open</Button>}>
          <NumberFlow value={total} format={usd} className="d-h1 d-t1 block leading-none" />
          <div className="flex items-center gap-2 mt-2">
            <Badge tone={msftUp ? 'up' : 'down'}>{msftUp ? '↑' : '↓'} {Math.abs(msftChange).toFixed(2)}% MSFT</Badge>
            <span className="text-[12px] d-t3">{q?.MSFT ? 'live' : 'last close'}</span>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-[12px]"><span className="d-t2">MSFT</span><span className="d-num d-t1">{usd(msftValue)}</span></div>
            <div className="flex items-center justify-between text-[12px]"><span className="d-t2">Sarwa</span><span className="d-num d-t1">{usd(sarwaValue)}</span></div>
            <div className="flex items-center justify-between text-[12px]"><span className="d-t2">Property</span><span className="d-num d-t1">{usd(FINANCE.property.value)}</span></div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-[1.5fr_0.9fr] gap-4">
        <WhoopInsightsCard whoop={whoop} eaten={totals.kcal} protein={totals.protein} />

        <Card eyebrow={`${todayEntries.length} ${todayEntries.length === 1 ? 'entry' : 'entries'}`} title="Today's log"
          actions={<Button size="sm" variant="ghost" icon={ArrowRight} onClick={() => onNavigate('food')}>Food</Button>}>
          {todayEntries.length === 0 ? (
            <p className="text-[13px] d-t3">Nothing logged yet.</p>
          ) : (
            <div className="space-y-0.5 -mx-1">
              {todayEntries.slice(-5).reverse().map(e => (
                <div key={e.uid} className="flex items-center justify-between px-1 py-1.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-[11px] d-t3 d-num w-10">{e.time}</span>
                    <span className="text-[13px] d-t1 truncate">{e.name}</span>
                  </div>
                  <span className="text-[12px] d-num d-t2 shrink-0">{e.kcal} kcal</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
