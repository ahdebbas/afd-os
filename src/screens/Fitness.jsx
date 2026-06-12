import { useEffect, useMemo, useRef, useState } from 'react'
import { Trophy, TriangleAlert, Flame, Beef, Zap, CheckCircle2, Dumbbell, Check } from 'lucide-react'
import { FITNESS, DEFAULT_WEIGHTS } from '../data'
import { Gauge, Label } from '../ui'
import { useOs } from '../os'
import { usePersistentState } from '../hooks'

const todayKey = () => new Date().toISOString().slice(0, 10)

const relativeDay = dateStr => {
  const d = new Date(dateStr + 'T00:00:00')
  const diff = Math.round((new Date(todayKey() + 'T00:00:00') - d) / 86400000)
  return diff <= 0 ? 'today' : diff === 1 ? 'yesterday' : `${diff}d ago`
}

/** Inline-editable weight cell: tap to type, commits on blur/Enter. */
function WeightCell({ weight, flash, onCommit }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    if (editing) { ref.current?.focus(); ref.current?.select() }
  }, [editing])

  const start = () => { setDraft(weight != null ? String(weight) : ''); setEditing(true) }
  const commit = () => {
    setEditing(false)
    const n = parseFloat(draft)
    onCommit(Number.isFinite(n) && n > 0 ? n : null)
  }

  if (editing) {
    return (
      <input ref={ref} value={draft} type="number" inputMode="decimal" min="0" step="2.5"
        onChange={e => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        aria-label="Weight in kilograms"
        className="field rounded-lg w-[66px] px-2 py-1.5 text-center mono text-[12px] outline-none" />
    )
  }
  return (
    <button onClick={start}
      aria-label={weight != null ? `Edit weight, ${weight} kilograms` : 'Add weight'}
      className={`press rounded-lg px-2.5 py-1.5 mono text-[12px] w-[66px] text-center ${weight != null ? 'acc-chip font-semibold' : 'chip t3'} ${flash ? 'pr-flash' : ''}`}>
      {weight != null ? weight : 'add'}<span className="text-[9px] t3 ml-0.5">kg</span>
    </button>
  )
}

export default function Fitness() {
  const os = useOs()
  const { bodyComp, goal, program, injuries } = FITNESS
  const [sessions, setSessions] = usePersistentState('afd-sessions', [], Array.isArray)
  const [weights, setWeights] = usePersistentState('afd-weights', DEFAULT_WEIGHTS,
    v => v && typeof v === 'object' && !Array.isArray(v))
  const [flashPR, setFlashPR] = useState(null)

  const today = todayKey()
  const idxOf = s => (Number.isInteger(s.idx) ? s.idx : program.findIndex(p => p.name === s.name))

  // Most-recent-first, so the rotation suggestion follows the last workout actually done.
  const ordered = useMemo(
    () => [...sessions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [sessions]
  )
  const todaySession = sessions.find(s => s.date === today)
  const todayDone = !!todaySession

  const lastLogged = ordered.find(s => idxOf(s) >= 0)
  const suggested = lastLogged ? (idxOf(lastLogged) + 1) % program.length : 0
  const activeIdx = todayDone ? Math.max(0, idxOf(todaySession)) : suggested

  // Most recent logged weight per exercise across all sessions (oldest→newest so newer wins).
  const lastWeights = useMemo(() => {
    const m = {}
    ;[...ordered].reverse().forEach(s =>
      Object.entries(s.weights || {}).forEach(([n, w]) => { if (Number.isFinite(+w) && +w > 0) m[n] = +w })
    )
    return m
  }, [ordered])

  // Effective weight shown in a cell: explicit current value, else last logged, else seed.
  const effWeight = name => weights[name] ?? lastWeights[name] ?? null

  // Selected day follows the suggestion, but a manual tap sticks until the rotation moves.
  const [day, setDay] = useState(activeIdx)
  const prevActive = useRef(activeIdx)
  useEffect(() => {
    if (prevActive.current !== activeIdx) { setDay(activeIdx); prevActive.current = activeIdx }
  }, [activeIdx])

  // Best weight per exercise across current values + every logged snapshot.
  const bestFor = name => {
    let best = +weights[name] || 0
    sessions.forEach(s => { const x = +s.weights?.[name]; if (Number.isFinite(x) && x > best) best = x })
    return best
  }

  const prs = useMemo(() => {
    const best = {}
    const consider = (n, w) => { if (w > 0 && (!best[n] || w > best[n])) best[n] = w }
    Object.entries(weights).forEach(([n, w]) => consider(n, +w || 0))
    sessions.forEach(s => Object.entries(s.weights || {}).forEach(([n, w]) => consider(n, +w || 0)))
    return Object.entries(best).sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [weights, sessions])

  const setWeight = (name, val) => {
    const prevBest = bestFor(name)
    setWeights(prev => {
      const next = { ...prev }
      if (val == null) delete next[name]
      else next[name] = val
      return next
    })
    if (val != null && val > prevBest) {
      setFlashPR(name)
      setTimeout(() => setFlashPR(f => (f === name ? null : f)), 1200)
    }
  }

  const toggleDone = () => {
    if (todayDone) {
      setSessions(prev => prev.filter(s => s.date !== today))
    } else {
      const snap = {}
      program[day].exercises.forEach(e => { const w = effWeight(e.name); if (w != null) snap[e.name] = w })
      setSessions(prev => [...prev, { date: today, idx: day, name: program[day].name, weights: snap }])
      os?.announce(`SESSION LOGGED · ${program[day].name}`, 'var(--acc-fit)')
    }
  }

  // Current week, Monday-first
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    const dow = (d.getDay() + 6) % 7 // 0 = Monday
    d.setDate(d.getDate() - dow + i)
    const key = d.toISOString().slice(0, 10)
    const session = sessions.find(s => s.date === key)
    return { key, label: d.toLocaleDateString('en-US', { weekday: 'narrow' }), session, isToday: key === today }
  })
  const weekCount = week.filter(d => d.session).length

  const progress = Math.max(0.03, Math.min(1, (20 - bodyComp.fatPct) / (20 - goal.fatPct)))
  const toGoal = (bodyComp.fatPct - goal.fatPct).toFixed(1)

  const fuel = [
    { Icon: Flame, label: 'Intake', value: '1.9–2.0k' },
    { Icon: Beef, label: 'Protein', value: '~2g/kg' },
    { Icon: Zap, label: 'Burn', value: '~2,100' },
  ]

  return (
    <div className="space-y-4" style={{ '--acc': 'var(--acc-fit)' }}>
      {/* Today's workout — rotation + inline weights */}
      <section className="panel p-6">
        <div className="flex items-center justify-between mb-1">
          <Label><Dumbbell size={12} className="inline-block mr-0.5 -mt-0.5" /> Today’s workout</Label>
          {lastLogged && (
            <span className="mono text-[10px] t3">last · {program[idxOf(lastLogged)]?.name} {relativeDay(lastLogged.date)}</span>
          )}
        </div>

        <div className="flex items-center gap-2.5 mb-4">
          <span className="display text-[34px] font-bold t1 leading-none">{program[day].name}</span>
          {todayDone && idxOf(todaySession) === day ? (
            <span className="acc-chip rounded-md px-2 py-0.5 mono text-[9px] tracking-[0.16em] uppercase inline-flex items-center gap-1">
              <Check size={11} strokeWidth={3} /> done
            </span>
          ) : day === suggested && (
            <span className="acc-chip rounded-md px-2 py-0.5 mono text-[9px] tracking-[0.16em] uppercase">next</span>
          )}
        </div>

        {/* Rotation strip */}
        <div className="grid grid-cols-4 gap-1 chip rounded-2xl p-1 mb-4">
          {program.map((d, i) => {
            const isNext = i === suggested && !todayDone
            const selected = day === i
            return (
              <button key={d.name} onClick={() => setDay(i)} aria-pressed={selected}
                className={`press relative mono text-[10px] tracking-[0.04em] uppercase font-semibold py-2.5 rounded-xl leading-tight ${selected ? 'acc-chip' : 't3'}`}>
                {isNext && (
                  <span className="absolute top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
                    style={{ background: 'var(--acc)', boxShadow: '0 0 6px var(--acc)' }} aria-hidden="true" />
                )}
                {d.name.split(' ')[0]}<br />{d.name.split(' ')[1] || ''}
              </button>
            )
          })}
        </div>

        {/* Exercise table */}
        <div className="flex items-center justify-between pb-2 mono text-[9px] tracking-[0.16em] uppercase t3">
          <span>Exercise</span>
          <div className="flex items-center gap-3">
            <span className="w-14 text-right">Target</span>
            <span className="w-[66px] text-center">Weight</span>
          </div>
        </div>
        {program[day].exercises.map((e, i) => (
          <div key={e.name} className={`flex justify-between items-center py-2.5 ${i > 0 ? 'hairline-t' : ''}`}>
            <span className="text-sm t1 font-medium flex items-center gap-2.5 min-w-0">
              <span className="mono text-[9px] t3 w-4 flex-shrink-0">{String(i + 1).padStart(2, '0')}</span>
              <span className="truncate">{e.name}</span>
            </span>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="mono text-[11px] t3 w-14 text-right">{e.sets}</span>
              <WeightCell weight={effWeight(e.name)} flash={flashPR === e.name}
                onCommit={val => setWeight(e.name, val)} />
            </div>
          </div>
        ))}

        <button onClick={toggleDone}
          className={`press w-full mt-4 rounded-xl py-3.5 mono text-[11px] tracking-[0.18em] uppercase font-semibold ${todayDone ? 'chip t2' : 'acc-chip'}`}>
          {todayDone ? `Finished ${todaySession.name} ✓ · tap to undo` : `Finish ${program[day].name}`}
        </button>
      </section>

      {/* Sessions this week */}
      <section className="panel p-6">
        <div className="flex items-center justify-between mb-4">
          <Label>This week</Label>
          <span className="mono text-[10px] t3"><span className={weekCount >= 4 ? 'acc' : 't2'}>{weekCount}</span> / 4 sessions</span>
        </div>
        <div className="flex justify-between mb-1">
          {week.map(d => (
            <div key={d.key} className="flex flex-col items-center gap-2">
              <span className="w-8 h-8 rounded-full flex items-center justify-center border"
                title={d.session ? d.session.name : undefined}
                style={d.session
                  ? { background: 'color-mix(in srgb, var(--acc) 16%, transparent)', borderColor: 'var(--acc)', color: 'var(--acc)', boxShadow: '0 0 8px color-mix(in srgb, var(--acc) 40%, transparent)' }
                  : { borderColor: d.isToday ? 'var(--ink-3)' : 'var(--line)', color: 'var(--ink-3)' }}>
                {d.session ? <CheckCircle2 size={15} strokeWidth={2.5} /> : <span className="mono text-[9px]">{d.label}</span>}
              </span>
              <span className={`mono text-[8px] tracking-[0.1em] ${d.isToday ? 'acc' : 't3'}`}>{d.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Body composition */}
      <section className="panel p-6">
        <div className="flex items-center justify-between mb-2">
          <Label>Body module</Label>
          <span className="mono text-[10px] t3">InBody · {bodyComp.date}</span>
        </div>
        <div className="flex items-center gap-5">
          <Gauge pct={progress} size={164} label="Progress toward body fat goal">
            <span className="display text-[40px] leading-none font-bold t1">{bodyComp.fatPct}<span className="text-[20px] t3">%</span></span>
            <span className="mono text-[9px] tracking-[0.2em] uppercase t3 mt-1.5">body fat</span>
          </Gauge>
          <div className="flex-1 space-y-3">
            {[
              ['Weight', `${bodyComp.weight} kg`],
              ['Muscle', `${bodyComp.muscleMass} kg`],
              ['Fat mass', `${bodyComp.fatMass} kg`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between items-baseline">
                <span className="mono text-[10px] tracking-[0.14em] uppercase t3">{k}</span>
                <span className="text-sm font-bold t1">{v}</span>
              </div>
            ))}
            <div className="acc-chip rounded-xl px-3 py-2 mt-1">
              <span className="mono text-[10px] tracking-[0.12em] uppercase">{toGoal}% → goal {goal.fatPct}%</span>
            </div>
          </div>
        </div>
        <div className="mt-5 pt-5 hairline-t grid grid-cols-3 gap-2.5">
          {fuel.map(({ Icon, label, value }) => (
            <div key={label} className="chip rounded-2xl py-3 px-2 text-center">
              <Icon size={15} strokeWidth={2.25} className="inline-block acc mb-1.5" />
              <div className="mono text-[9px] tracking-[0.16em] uppercase t3">{label}</div>
              <div className="text-[13px] font-bold t1 mt-0.5">{value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PRs — auto-derived from logged weights */}
      <section className="panel p-6">
        <Label className="mb-4"><Trophy size={12} className="inline-block mr-0.5 -mt-0.5" /> Personal records</Label>
        {prs.length === 0 ? (
          <p className="text-sm t3 text-center py-3">Log weights above to start tracking PRs.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            {prs.map(([name, w]) => (
              <div key={name} className="chip rounded-2xl p-3.5 text-center">
                <div className="mono text-[9px] tracking-[0.1em] uppercase t3 leading-tight min-h-[24px] flex items-center justify-center">{name}</div>
                <div className="display text-[28px] leading-none font-bold t1 mt-1.5">{w}</div>
                <div className="mono text-[9px] t3 mt-1">kg</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Constraints */}
      <section className="panel px-5 py-4 flex gap-3 items-start border-l-4" style={{ borderLeftColor: 'var(--warn)' }}>
        <TriangleAlert size={17} strokeWidth={2.25} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--warn)' }} />
        <div className="text-[13px] leading-relaxed space-y-0.5" style={{ color: 'var(--warn)' }}>
          {injuries.map(([part, note]) => (
            <p key={part}><strong>{part}:</strong> {note}.</p>
          ))}
        </div>
      </section>
    </div>
  )
}
