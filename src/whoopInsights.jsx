import { Activity, Clock, Flame, TrendingDown, TrendingUp, Zap } from 'lucide-react'
import { TARGETS } from './data'
import { Label } from './ui'
import { connectWhoop } from './whoop'

const kcal = n => Math.round(n).toLocaleString('en-US')
const hourLabel = h => `${String(h).padStart(2, '0')}:00`

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
      <p className="mono text-[10px] t3 leading-relaxed">{message}</p>
      {(state === 'disconnected' || state === 'error') && (
        <button onClick={connectWhoop}
          className="press mt-4 w-full flex items-center justify-center gap-2 mono text-[10px] tracking-[0.14em] uppercase font-semibold acc-chip rounded-xl py-3">
          <Activity size={13} strokeWidth={2.5} /> Connect WHOOP
        </button>
      )}
    </section>
  )
}

export function BurnPaceChart({ whoop }) {
  const series = whoop?.series
  const today = series?.today || []
  const weekly = series?.weeklyAvg || []
  const yesterday = series?.yesterday || []
  const all = [...today, ...weekly, ...yesterday].map(p => p.kcal).filter(Number.isFinite)
  if (today.length < 2 || all.length < 2) return null

  const W = 320, H = 92
  const pad = { l: 8, r: 8, t: 10, b: 18 }
  const maxHour = Math.max(...[...today, ...weekly, ...yesterday].map(p => p.hour), 1)
  const min = Math.min(...all)
  const max = Math.max(...all)
  const span = Math.max(1, max - min)
  const xAt = h => pad.l + (W - pad.l - pad.r) * (h / Math.max(1, maxHour))
  const yAt = v => pad.t + (H - pad.t - pad.b) * (1 - ((v - min) / span))
  const pathFor = points => points.map((p, i) => `${i ? 'L' : 'M'} ${xAt(p.hour).toFixed(1)} ${yAt(p.kcal).toFixed(1)}`).join(' ')
  const lastToday = today.at(-1)

  return (
    <div className="mt-4 panel-2 rounded-2xl p-3">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="WHOOP intraday burn pace">
        {[0, 0.5, 1].map(t => {
          const y = pad.t + (H - pad.t - pad.b) * t
          return <line key={t} x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="var(--line)" strokeWidth="1" />
        })}
        {weekly.length > 1 && <path d={pathFor(weekly)} fill="none" stroke="var(--ink-3)" strokeWidth="1.8" strokeDasharray="4 4" />}
        {yesterday.length > 1 && <path d={pathFor(yesterday)} fill="none" stroke="var(--warn)" strokeWidth="1.6" opacity="0.7" />}
        <path d={pathFor(today)} fill="none" stroke="var(--acc)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"
          style={{ filter: 'drop-shadow(0 0 4px var(--acc))' }} />
        {lastToday && <circle cx={xAt(lastToday.hour)} cy={yAt(lastToday.kcal)} r="4" fill="var(--acc)" stroke="var(--surface)" strokeWidth="2" />}
        <text x={pad.l} y={H - 4} fill="var(--ink-3)" className="mono" fontSize="8.5">00:00</text>
        <text x={W - pad.r} y={H - 4} fill="var(--ink-3)" className="mono" fontSize="8.5" textAnchor="end">{hourLabel(maxHour)}</text>
      </svg>
      <div className="flex items-center justify-between mt-2 mono text-[8px] tracking-[0.12em] uppercase t3">
        <span className="acc">Today</span>
        {yesterday.length > 1 && <span style={{ color: 'var(--warn)' }}>Yesterday</span>}
        {weekly.length > 1 && <span>Weekly avg</span>}
      </div>
    </div>
  )
}

function DataHealth({ snap }) {
  const sampleText = snap.lastSampleAt
    ? `${snap.stale ? 'stale' : 'sampled'} ${snap.lastSampleAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'sampling pending'
  const historyText = snap.historyDays >= 3 ? `${snap.historyDays}d history` : `${snap.historyDays}d history building`
  return (
    <div className="mt-4 pt-3 hairline-t flex items-center justify-between gap-2 mono text-[9px] tracking-[0.12em] uppercase t3">
      <span className={snap.stale ? 'down' : 'acc'}><Clock size={10} className="inline-block mr-1 -mt-0.5" />{sampleText}</span>
      <span>{historyText}</span>
    </div>
  )
}

export function WhoopEnergyPanel({ whoop, eaten = 0, compact = false, showChart = true }) {
  const snap = whoopSnapshot(whoop, eaten)
  if (snap.state !== 'ready') return <EmptyWhoop whoop={whoop} compact={compact} />

  const paceKnown = snap.paceDelta != null
  const paceAhead = paceKnown && snap.paceDelta >= 0
  const netDeficit = snap.net >= 0
  const PaceIcon = paceAhead ? TrendingUp : TrendingDown
  const paceLabel = whoop.weeklyAvg != null ? 'weekly pace' : 'yesterday pace'

  return (
    <section className={`panel ${compact ? 'p-5' : 'p-6'}`} style={{ '--acc': 'var(--acc-fit)' }}>
      <div className="flex items-center justify-between mb-3">
        <Label><Flame size={12} className="inline-block mr-0.5 -mt-0.5" /> Energy · WHOOP</Label>
        <span className="mono text-[10px] t3">strain {whoop.strain != null ? whoop.strain.toFixed(1) : '—'}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className="display text-[38px] font-bold t1 leading-none">{kcal(snap.burned)}</span>
        <span className="mono text-[9px] tracking-[0.2em] uppercase t3 mb-1">kcal burned</span>
      </div>
      <p className="mono text-[10px] mt-3 t2 leading-relaxed">
        <span className={netDeficit ? 'acc' : 'down'}>{netDeficit ? `${kcal(snap.net)} kcal net deficit` : `${kcal(Math.abs(snap.net))} kcal net surplus`}</span>
        {' '}after {kcal(eaten)} eaten. Food cap stays {kcal(TARGETS.kcal)} kcal.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="chip rounded-2xl p-3 text-center">
          <div className={`display text-[22px] leading-none font-bold ${snap.capLeft >= 0 ? 't1' : 'down'}`}>{kcal(Math.abs(snap.capLeft))}</div>
          <div className="mono text-[8px] tracking-[0.14em] uppercase t3 mt-1.5">{snap.capLeft >= 0 ? 'cap left' : 'over cap'}</div>
        </div>
        <div className="chip rounded-2xl p-3 text-center">
          <div className={`display text-[22px] leading-none font-bold ${netDeficit ? 'acc' : 'down'}`}>{kcal(Math.abs(snap.net))}</div>
          <div className="mono text-[8px] tracking-[0.14em] uppercase t3 mt-1.5">{netDeficit ? 'deficit' : 'surplus'}</div>
        </div>
        <div className="chip rounded-2xl p-3 text-center">
          <div className={`display text-[22px] leading-none font-bold ${paceAhead ? 'acc' : paceKnown ? 'down' : 't1'}`}>
            {paceKnown ? `${paceAhead ? '+' : '−'}${kcal(Math.abs(snap.paceDelta))}` : '—'}
          </div>
          <div className="mono text-[8px] tracking-[0.14em] uppercase t3 mt-1.5">pace</div>
        </div>
      </div>
      <p className="mono text-[10px] mt-3 t3 flex items-center gap-1.5">
        {paceKnown ? <PaceIcon size={12} strokeWidth={2.5} /> : <Zap size={12} strokeWidth={2.5} />}
        {paceKnown
          ? <><span className={paceAhead ? 'acc' : 'down'}>{paceAhead ? 'ahead of' : 'behind'}</span> {paceLabel} by this hour</>
          : 'building pace history from hourly samples'}
      </p>
      {showChart && <BurnPaceChart whoop={whoop} />}
      <DataHealth snap={snap} />
    </section>
  )
}

export function WhoopBudgetFooter({ whoop, eaten }) {
  const snap = whoopSnapshot(whoop, eaten)
  if (snap.state === 'loading') return null
  if (snap.state !== 'ready') {
    return (
      <button onClick={connectWhoop}
        className="press mt-5 pt-4 hairline-t w-full flex items-center justify-center gap-2 mono text-[10px] tracking-[0.14em] uppercase font-semibold acc">
        <Activity size={13} strokeWidth={2.5} /> {snap.state === 'empty' ? 'WHOOP connected · burn pending' : 'Connect WHOOP'}
      </button>
    )
  }

  const netDeficit = snap.net >= 0
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
            <div className="mono text-[8px] tracking-[0.18em] uppercase t3 mt-1.5 flex items-center justify-center gap-1">
              {k.label === 'Burned' && <Flame size={9} strokeWidth={2.5} />}{k.label}
            </div>
          </div>
        ))}
      </div>
      <p className="mono text-[9px] t3 text-center mt-3 leading-relaxed">
        {snap.capLeft >= 0 ? `${kcal(snap.capLeft)} kcal left before the food cap` : `${kcal(Math.abs(snap.capLeft))} kcal above the food cap`}
        {' '}· WHOOP only explains net position.
      </p>
    </div>
  )
}
