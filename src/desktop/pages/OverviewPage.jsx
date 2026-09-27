import { useEffect, useState } from 'react'
import { Clock, Target, TrendingDown, TrendingUp, TriangleAlert, Zap } from 'lucide-react'
import { useFood } from '../../store'
import TodayPulse from '../../TodayPulse'
import { usePersistentState } from '../../hooks'
import { DEFICIT_GOAL, TARGETS } from '../../data'
import { connectWhoop, fetchWhoopCalories, WHOOP_POLL_MS } from '../../whoop'
import { fuelingFlag, projectBurn, recommendedIntake } from '../../whoopEnergy'
import { Card, Button } from '../primitives'

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
  const { totals } = useFood()
  const [whoop, setWhoop] = useState(null)
  useEffect(() => {
    let alive = true
    const load = async () => { const d = await fetchWhoopCalories(); if (alive) setWhoop(d) }
    void load()
    const id = setInterval(() => { if (document.visibilityState === 'visible') void load() }, WHOOP_POLL_MS)
    return () => { alive = false; clearInterval(id) }
  }, [])

  return (
    <div className="d-enter space-y-4">
      <TodayPulse onNavigate={onNavigate} whoop={whoop} />
      <details className="pulse-details">
        <summary>Energy details</summary>
        <WhoopInsightsCard whoop={whoop} eaten={totals.kcal} protein={totals.protein} />
      </details>
    </div>
  )
}
