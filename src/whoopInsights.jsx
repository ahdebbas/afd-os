import { Activity, Clock, Flame, Target, TrendingDown, TrendingUp, Zap, TriangleAlert } from 'lucide-react'
import { TARGETS } from './data'
import { Label } from './ui'
import { connectWhoop } from './whoop'
import { projectBurn, recommendedIntake, fuelingFlag } from './whoopEnergy'

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
  const historyDays = whoop.days ?? 0
  const lastSampleAt = whoop.lastSampleAt ? new Date(whoop.lastSampleAt) : null
  const sampleAgeHours = lastSampleAt ? (Date.now() - lastSampleAt.getTime()) / 3600000 : null

  return {
    state: 'ready',
    burned,
    net,
    capLeft,
    paceBase,
    paceDelta,
    historyDays,
    sampleAgeHours,
    lastSampleAt,
    stale: sampleAgeHours != null && sampleAgeHours > 3,
  }
}

function EmptyWhoop({ whoop, compact = false }) {
  const state = whoopSnapshot(whoop).state
  const message = state === 'loading'
    ? 'Loading WHOOP energy...'
    : state === 'empty'
      ? 'WHOOP is connected; waiting for the current cycle burn.'
      : state === 'error'
        ? 'WHOOP did not respond. Try again after reconnecting.'
        : 'Connect WHOOP to turn burn, strain, and pace into food guidance.'

  return (
    <section className={`panel ${compact ? 'p-5' : 'p-6'}`} style={{ '--acc': 'var(--acc-fit)' }}>
      <Label className="mb-3"><Flame size={12} className="inline-block mr-0.5 -mt-0.5" /> Energy · WHOOP</Label>
      {state === 'loading' ? (
        <div className="whoop-skeleton" aria-label={message} role="status">
          <span className="whoop-skeleton-main" />
          <span className="whoop-skeleton-line" />
          <span className="whoop-skeleton-grid">
            <span />
            <span />
          </span>
        </div>
      ) : (
        <p className="mono text-[10px] t3 leading-relaxed">{message}</p>
      )}
      {(state === 'disconnected' || state === 'error') && (
        <button onClick={connectWhoop}
          className="press mt-4 w-full flex items-center justify-center gap-2 mono text-[10px] font-semibold acc-chip rounded-xl py-3">
          <Activity size={13} strokeWidth={2.5} /> Connect WHOOP
        </button>
      )}
    </section>
  )
}

function DataHealth({ snap }) {
  const sampleText = snap.lastSampleAt
    ? `${snap.stale ? 'Stale' : 'Sampled'} ${snap.lastSampleAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'Sampling pending'
  const historyText = snap.historyDays >= 3 ? `${snap.historyDays}d history` : `${snap.historyDays}d history building`
  return (
    <div className="mt-4 pt-3 hairline-t flex items-center justify-between gap-2 mono text-[10px] t3">
      <span className={snap.stale ? 'down' : 't3'}><Clock size={10} className="inline-block mr-1 -mt-0.5" />{sampleText}</span>
      <span>{historyText}</span>
    </div>
  )
}

export function WhoopEnergyPanel({ whoop, eaten = 0, protein = 0, compact = false }) {
  const snap = whoopSnapshot(whoop, eaten)
  if (snap.state !== 'ready') return <EmptyWhoop whoop={whoop} compact={compact} />

  const paceKnown = snap.paceDelta != null
  const paceAhead = paceKnown && snap.paceDelta >= 0
  const netDeficit = snap.net >= 0
  const PaceIcon = paceAhead ? TrendingUp : TrendingDown
  const vsYesterday = whoop.yesterday == null ? null : snap.burned - whoop.yesterday
  const vsWeekly = whoop.weeklyAvg == null ? null : snap.burned - whoop.weeklyAvg

  const projected = projectBurn(whoop)
  const recommend = recommendedIntake(projected)
  const recIntakeLeft = recommend != null ? recommend - eaten : null
  const proteinLeft = Math.max(0, Math.round(TARGETS.protein - protein))
  const actionText = recommend == null
    ? 'Need more hours of burn data before giving an intake recommendation.'
    : recIntakeLeft == null
      ? null
      : recIntakeLeft >= 0
        ? `Eat ~${kcal(recIntakeLeft)} kcal more and stay on plan.${proteinLeft > 0 ? ` ${proteinLeft}g protein still open - make it protein-led.` : ''}`
        : `You are ~${kcal(Math.abs(recIntakeLeft))} kcal over plan.${proteinLeft > 0 ? ` ${proteinLeft}g protein still open - keep the next meal lean.` : ''}`

  return (
    <section className={`panel ${compact ? 'p-5' : 'p-6'}`} style={{ '--acc': 'var(--acc-fit)' }}>
      <div className="flex items-center justify-between mb-3">
        <Label><Flame size={12} className="inline-block mr-0.5 -mt-0.5" /> Energy · WHOOP</Label>
        <span className="mono text-[10px] t3">strain {whoop.strain != null ? whoop.strain.toFixed(1) : '—'}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className="display text-[38px] font-bold t1 leading-none">{kcal(snap.burned)}</span>
        <span className="mono text-[10px] t3 mb-1">kcal burned</span>
      </div>
      <p className="mono text-[10px] mt-3 t2 leading-relaxed">
        {eaten > 0 ? (
          <>
            <span className={netDeficit ? 'acc' : 'down'}>{netDeficit ? `${kcal(snap.net)} kcal net deficit` : `${kcal(Math.abs(snap.net))} kcal net surplus`}</span>
            {' '}after intake. Burn and pace are from WHOOP.
          </>
        ) : (
          <>
            <span className="acc">{kcal(snap.burned)} kcal burned so far.</span>
            {' '}No intake logged.
          </>
        )}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="chip rounded-2xl p-3 text-center">
          <div className={`display text-[22px] leading-none font-bold ${paceKnown ? paceAhead ? 'acc' : 'down' : 't1'}`}>
            {paceKnown ? `${paceAhead ? '+' : '−'}${kcal(Math.abs(snap.paceDelta))}` : '—'}
          </div>
          <div className="mono text-[10px] t3 mt-1.5">{paceKnown ? 'Pace' : 'Pace building'}</div>
        </div>
        <div className="chip rounded-2xl p-3 text-center">
          <div className={`display text-[22px] leading-none font-bold ${netDeficit ? 'acc' : 'down'}`}>{kcal(Math.abs(snap.net))}</div>
          <div className="mono text-[10px] t3 mt-1.5">{netDeficit ? 'Deficit' : 'Surplus'}</div>
        </div>
      </div>
      <div className="mt-3 panel-2 rounded-2xl px-3.5 py-3 space-y-2.5">
        <div className="flex items-center justify-between gap-3 mono text-[10px]">
          <span className="t3">Vs yesterday by now</span>
          <span className={vsYesterday == null ? 't3' : vsYesterday >= 0 ? 'acc' : 'down'}>
            {vsYesterday == null ? 'building' : `${vsYesterday >= 0 ? '+' : '−'}${kcal(Math.abs(vsYesterday))} kcal`}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 mono text-[10px]">
          <span className="t3">Vs weekly average</span>
          <span className={vsWeekly == null ? 't3' : vsWeekly >= 0 ? 'acc' : 'down'}>
            {vsWeekly == null ? 'building' : `${vsWeekly >= 0 ? '+' : '−'}${kcal(Math.abs(vsWeekly))} kcal`}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 mono text-[10px]">
          <span className="t3">Pace read</span>
          <span className="flex items-center gap-1.5">
            {paceKnown ? <PaceIcon size={12} strokeWidth={2.5} /> : <Zap size={12} strokeWidth={2.5} />}
            {paceKnown
              ? <span className={paceAhead ? 'acc' : 'down'}>{paceAhead ? 'ahead' : 'behind'}</span>
              : <span className="t3">building</span>}
          </span>
        </div>
      </div>
      {actionText && !compact && (
        <p className="today-energy-nudge mono text-[10px] mt-3 leading-relaxed">
          <Target size={13} strokeWidth={2.4} />
          <span>{actionText}</span>
        </p>
      )}
      <DataHealth snap={snap} />
    </section>
  )
}

export function WhoopBudgetFooter({ whoop, eaten, protein = 0 }) {
  const snap = whoopSnapshot(whoop, eaten)
  if (snap.state === 'loading') return null
  if (snap.state !== 'ready') {
    return (
      <button onClick={connectWhoop}
        className="press mt-5 pt-4 hairline-t w-full flex items-center justify-center gap-2 mono text-[10px] font-semibold acc">
        <Activity size={13} strokeWidth={2.5} /> {snap.state === 'empty' ? 'WHOOP connected · burn pending' : 'Connect WHOOP'}
      </button>
    )
  }

  const netDeficit = snap.net >= 0
  const flag = fuelingFlag({ whoop, eaten, protein, projectedBurn: projectBurn(whoop) })
  const kpis = [
    { label: 'Eaten', value: kcal(eaten), cls: 't1' },
    { label: 'Burned', value: kcal(snap.burned), cls: 't1' },
    { label: netDeficit ? 'Deficit' : 'Surplus', value: kcal(Math.abs(snap.net)), cls: netDeficit ? 'acc' : 'down' },
  ]
  return (
    <div className="mt-5 pt-4 hairline-t">
      <div className="grid grid-cols-3 gap-2">
        {kpis.map(k => (
          <div key={k.label} className="text-center">
            <div className={`display text-[20px] leading-none font-bold ${k.cls}`}>{k.value}</div>
            <div className="mono text-[9px] t3 mt-1.5 flex items-center justify-center gap-1">
              {k.label === 'Burned' && <Flame size={9} strokeWidth={2.5} />}{k.label}
            </div>
          </div>
        ))}
      </div>
      <p className="mono text-[9px] t3 text-center mt-3 leading-relaxed">
        {snap.capLeft >= 0 ? `${kcal(snap.capLeft)} kcal left before the food cap` : `${kcal(Math.abs(snap.capLeft))} kcal above the food cap`}
        {' '}· WHOOP only explains net position.
      </p>
      {flag && (
        <p className={`mono text-[9px] text-center mt-2 leading-relaxed flex items-center justify-center gap-1.5 ${flag.kind === 'protein' ? 't2' : 'down'}`}>
          <TriangleAlert size={10} strokeWidth={2.5} className="flex-shrink-0" />{flag.msg}
        </p>
      )}
    </div>
  )
}
