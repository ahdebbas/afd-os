import { useEffect, useMemo, useRef, useState } from 'react'
import { Trophy, TriangleAlert, Flame, Beef, Zap, Dumbbell, Check, Plus, RefreshCw, ArrowRight } from 'lucide-react'
import { FITNESS, DEFAULT_WEIGHTS, sessionIdx, nextWorkoutIdx } from '../data'
import { Gauge, Label, DayStrip, TrendChart } from '../ui'
import { useOs } from '../os'
import { usePersistentState } from '../hooks'
import { dateKey, todayKey } from '../dates'
import { fetchWhoopCalories, fetchWhoopCycles, WHOOP_POLL_MS } from '../whoop'
import { useFood } from '../store'
import { WhoopEnergyPanel } from '../whoopInsights'
import { netEnergyData } from '../whoopEnergy'

const METRICS = [
  { key: 'weight', label: 'Weight', unit: 'kg' },
  { key: 'smm', label: 'Muscle', unit: 'kg' },
  { key: 'fatMass', label: 'Fat mass', unit: 'kg' },
  { key: 'fatPct', label: 'Body fat', unit: '%' },
]
const shortDate = s => new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const longDate = s => new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

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

function ExerciseRow({ exercise, index, weight, flash, onCommit }) {
  return (
    <div className={`flex justify-between items-start gap-2 py-2.5 ${index > 0 ? 'hairline-t' : ''}`}>
      <span className="text-sm t1 font-medium flex items-start gap-2.5 min-w-0 flex-1 pr-1">
        <span className="mono text-[9px] w-3 flex-shrink-0 mt-1 t2">{String(index + 1).padStart(2, '0')}</span>
        <span className="leading-snug">{exercise.name}</span>
      </span>
      <div className="flex items-center justify-end gap-2 flex-shrink-0">
        <span className="mono text-[10px] t2 w-20 text-right pt-1.5">{exercise.sets}</span>
        <WeightCell weight={weight} flash={flash} onCommit={onCommit} />
      </div>
    </div>
  )
}

export default function Fitness() {
  const os = useOs()
  const { goal, injuries } = FITNESS
  // Program lives in storage so new exercises added during a workout persist to the template.
  // Key is versioned: bump the suffix whenever FITNESS.program is redesigned so existing
  // devices re-seed from the new template instead of showing the stale cached split.
  const [program, setProgram] = usePersistentState('afd-program-v2', FITNESS.program, Array.isArray)
  const [sessions, setSessions] = usePersistentState('afd-sessions', [], Array.isArray)
  const [weights, setWeights] = usePersistentState('afd-weights', DEFAULT_WEIGHTS,
    v => v && typeof v === 'object' && !Array.isArray(v))
  const [inbody, setInbody] = usePersistentState('afd-inbody', FITNESS.inbody, Array.isArray)
  const [flashPR, setFlashPR] = useState(null)
  const [exForm, setExForm] = useState({ open: false, name: '', sets: '' })
  const [metric, setMetric] = useState('weight')
  const [inForm, setInForm] = useState({ open: false, date: '', weight: '', smm: '', fatMass: '', fatPct: '' })

  // WHOOP burn + intraday pacing (today only). Null until loaded.
  const [whoop, setWhoop] = useState(null)
  const [cycles, setCycles] = useState(null)
  const [whoopLoadedAt, setWhoopLoadedAt] = useState(null)
  const [refreshingWhoop, setRefreshingWhoop] = useState(false)
  const { logs: foodLogs } = useFood()
  const refreshWhoop = async ({ silent = false } = {}) => {
    if (!silent) setRefreshingWhoop(true)
    try {
      const [burn, history] = await Promise.all([fetchWhoopCalories(), fetchWhoopCycles()])
      setWhoop(burn)
      setCycles(history)
      setWhoopLoadedAt(new Date())
    } finally {
      if (!silent) setRefreshingWhoop(false)
    }
  }
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refreshWhoop({ silent: true })
    }

    void Promise.resolve().then(() => refreshWhoop())
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void refreshWhoop({ silent: true })
    }, WHOOP_POLL_MS)
    window.addEventListener('focus', onVisibility)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearInterval(id)
      window.removeEventListener('focus', onVisibility)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const today = todayKey()
  // Persisted so a reload mid-workout resumes on the same day; snapped to today below if stale.
  const [selDate, setSelDate] = usePersistentState('afd-fit-day', today,
    v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v))
  useEffect(() => { if (selDate < today) setSelDate(today) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const isToday = selDate === today
  const idxOf = s => sessionIdx(s, program)

  // Most-recent-first, so the rotation suggestion follows the last workout actually done.
  const ordered = useMemo(
    () => [...sessions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [sessions]
  )
  const selSession = sessions.find(s => s.date === selDate)
  const done = !!selSession

  const lastLogged = ordered.find(s => idxOf(s) >= 0)
  const suggested = nextWorkoutIdx(program, sessions)
  const activeIdx = selSession ? Math.max(0, idxOf(selSession)) : suggested

  // Most recent logged weight per exercise across all sessions (oldest→newest so newer wins).
  const lastWeights = useMemo(() => {
    const m = {}
    ;[...ordered].reverse().forEach(s =>
      Object.entries(s.weights || {}).forEach(([n, w]) => { if (Number.isFinite(+w) && +w > 0) m[n] = +w })
    )
    return m
  }, [ordered])

  // Effective weight in a cell: the selected day's snapshot, else current value, else last logged, else seed.
  const effWeight = name => selSession?.weights?.[name] ?? weights[name] ?? lastWeights[name] ?? null

  // Selected rotation day follows the suggestion / logged session, but a manual tap sticks.
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

  const setGlobalWeight = (name, val) => setWeights(prev => {
    const next = { ...prev }
    if (val == null) delete next[name]
    else next[name] = val
    return next
  })

  const setWeight = (name, val) => {
    const prevBest = bestFor(name)
    if (selSession) {
      // Editing a logged day updates that day's snapshot.
      setSessions(prev => prev.map(s => {
        if (s.date !== selDate) return s
        const w = { ...(s.weights || {}) }
        if (val == null) delete w[name]
        else w[name] = val
        return { ...s, weights: w }
      }))
      if (isToday) setGlobalWeight(name, val) // keep the live working weight in sync
    } else {
      setGlobalWeight(name, val)
    }
    if (val != null && val > prevBest) {
      setFlashPR(name)
      setTimeout(() => setFlashPR(f => (f === name ? null : f)), 1200)
    }
  }

  const toggleDone = () => {
    if (done) {
      setSessions(prev => prev.filter(s => s.date !== selDate))
    } else {
      const snap = {}
      program[day].exercises.forEach(e => { const w = effWeight(e.name); if (w != null) snap[e.name] = w })
      setSessions(prev => [...prev, { date: selDate, idx: day, name: program[day].name, weights: snap }])
      os?.announce(`SESSION LOGGED · ${program[day].name}`, 'var(--acc-fit)')
    }
  }

  const addExercise = () => {
    const name = exForm.name.trim()
    if (!name) return
    const sets = exForm.sets.trim() || '3×10'
    setProgram(prev => prev.map((d, i) => i === day ? { ...d, exercises: [...d.exercises, { name, sets }] } : d))
    setExForm({ open: false, name: '', sets: '' })
    os?.announce(`EXERCISE ADDED · ${program[day].name}`, 'var(--acc-fit)')
  }

  const dayStatus = key => {
    if (key === today) return 'today'
    return sessions.find(s => s.date === key) ? 'win' : 'empty'
  }

  const dayLabel = isToday ? 'Today' : (() => {
    const d = new Date(selDate + 'T00:00:00')
    return `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${d.getDate()}`
  })()

  // Sessions logged in the current Monday-first week.
  const weekCount = (() => {
    let c = 0
    for (let i = 0; i < 7; i++) {
      const d = new Date()
      const dow = (d.getDay() + 6) % 7
      d.setDate(d.getDate() - dow + i)
      if (sessions.find(s => s.date === dateKey(d))) c++
    }
    return c
  })()

  // InBody readings, oldest→newest. Latest drives the cards + gauge.
  const readings = useMemo(() => [...inbody].sort((a, b) => (a.date < b.date ? -1 : 1)), [inbody])
  const latest = useMemo(
    () => readings[readings.length - 1] || { weight: 0, smm: 0, fatMass: 0, fatPct: 0, date: today },
    [readings, today])
  const prevReading = readings[readings.length - 2]
  const firstReading = readings[0]
  const selMetric = METRICS.find(m => m.key === metric)
  const chartData = readings.filter(r => r[metric] != null).map(r => ({ date: r.date, value: r[metric] }))

  // Energy balance: real maintenance (avg burn), net deficit, predicted vs actual
  // fat loss, and goal ETA — from WHOOP cycles + the food log + InBody. #1/#2/#4.
  const energy = useMemo(() => {
    if (!cycles?.connected || !cycles.cycles?.length) return null
    const burnByDate = {}
    cycles.cycles.forEach(c => { if (!c.partial) burnByDate[c.date] = c.kcal })
    const days = []
    for (let i = 1; i <= 7; i++) { // last 7 completed days (exclude today, which is partial)
      const d = new Date(); d.setDate(d.getDate() - i)
      const key = dateKey(d)
      if (burnByDate[key] == null) continue
      const eaten = (foodLogs[key] || []).reduce((a, e) => a + e.kcal, 0)
      days.push({ key, burned: burnByDate[key], eaten })
    }
    if (!days.length) return null
    const maintenance = Math.round(days.reduce((a, d) => a + d.burned, 0) / days.length)
    const logged = days.filter(d => d.eaten > 0) // only days you actually logged food
    const netDeficit = logged.reduce((a, d) => a + (d.burned - d.eaten), 0)
    const avgIntake = logged.length ? Math.round(logged.reduce((a, d) => a + d.eaten, 0) / logged.length) : 0
    const avgDeficit = logged.length ? Math.round(netDeficit / logged.length) : 0
    const weeklyDeficit = logged.length ? Math.round(avgDeficit * 7) : 0
    const deficitDays = logged.filter(d => d.burned > d.eaten).length
    const predictedKg = weeklyDeficit / 7700 // ~7,700 kcal per kg of fat

    let actualKg = null
    if (readings.length >= 2) actualKg = latest.weight - readings[readings.length - 2].weight

    let etaDate = null
    if (latest.fatPct && latest.weight && logged.length && predictedKg > 0) {
      const weeklyFatPct = (predictedKg / logged.length * 7) / latest.weight * 100
      const weeks = weeklyFatPct > 0.01 ? (latest.fatPct - goal.fatPct) / weeklyFatPct : 0
      if (weeks > 0 && weeks < 260) { const dt = new Date(); dt.setDate(dt.getDate() + Math.round(weeks * 7)); etaDate = dateKey(dt) }
    }
    const insight = logged.length < 3
      ? 'Log more food days to make the WHOOP projection trustworthy.'
      : avgDeficit < 0
        ? 'Food is outrunning burn this week; fat-loss ETA is paused.'
        : avgDeficit > 900
          ? 'Deficit is aggressive; protect training quality and protein.'
          : 'Deficit is controlled enough to support the body-fat goal.'

    return { maintenance, avgIntake, avgDeficit, weeklyDeficit, netDeficit, predictedKg, loggedDays: logged.length, burnDays: days.length, deficitDays, actualKg, etaDate, insight, days }
  }, [cycles, foodLogs, readings, latest, goal])

  const addResult = () => {
    const weight = +inForm.weight || null
    if (!inForm.date || weight == null) return
    const entry = { date: inForm.date, weight, smm: +inForm.smm || null, fatMass: +inForm.fatMass || null, fatPct: +inForm.fatPct || null }
    setInbody(prev => [...prev.filter(r => r.date !== inForm.date), entry].sort((a, b) => (a.date < b.date ? -1 : 1)))
    setInForm({ open: false, date: '', weight: '', smm: '', fatMass: '', fatPct: '' })
    os?.announce('INBODY LOGGED', 'var(--acc-fit)')
  }

  const progress = Math.max(0.03, Math.min(1, (20 - latest.fatPct) / (20 - goal.fatPct)))
  const toGoal = (latest.fatPct - goal.fatPct).toFixed(1)

  const fuel = [
    { Icon: Flame, label: 'Intake', value: '1.9–2.0k' },
    { Icon: Beef, label: 'Protein', value: '~2g/kg' },
    { Icon: Zap, label: 'Burn', value: '~2,100' },
  ]

  return (
    <div className="space-y-4" style={{ '--acc': 'var(--acc-fit)' }}>
      {/* Day selector */}
      <section className="panel p-4">
        <DayStrip value={selDate} onChange={setSelDate} status={dayStatus} />
        <div className="mt-3 pt-3 hairline-t flex items-center justify-between">
          <span className="mono text-[10px] tracking-[0.14em] uppercase t2 font-semibold">This week</span>
          <span className="mono text-[10px] t2"><span className={weekCount >= 4 ? 'acc' : 't1'}>{weekCount}</span> / 4 sessions</span>
        </div>
      </section>

      {/* Workout — rotation + inline weights (backlog any day) */}
      <section className="panel p-6">
        <div className="flex items-center justify-between mb-1">
          <Label><Dumbbell size={12} className="inline-block mr-0.5 -mt-0.5" /> {isToday ? 'Today’s workout' : `${dayLabel} workout`}</Label>
          {lastLogged && (
            <span className="mono text-[10px] t3">last · {program[idxOf(lastLogged)]?.name} {relativeDay(lastLogged.date)}</span>
          )}
        </div>

        {/* Rotation strip */}
        <div className="grid grid-cols-4 gap-1 chip rounded-2xl p-1 mb-4">
          {program.map((d, i) => {
            const selected = day === i
            // Split at the "&" so every tab renders as a consistent two-line label.
            const [head, ...rest] = d.name.split(' & ')
            return (
              <button key={d.name} onClick={() => setDay(i)} aria-pressed={selected}
                className={`press relative flex flex-col items-center justify-center text-center mono text-[9px] tracking-0 font-semibold px-1 py-2.5 rounded-xl leading-tight ${selected ? 'acc-chip' : 't3'}`}>
                <span>{head}</span>
                {rest.length > 0 && <span>&amp; {rest.join(' & ')}</span>}
                {selected && done && idxOf(selSession) === day && (
                  <span className="mt-1 inline-flex items-center gap-1 text-[8px] tracking-0 t2"><Check size={9} strokeWidth={3} /> done</span>
                )}
                {selected && !done && day === suggested && isToday && (
                  <span className="mt-1 inline-flex items-center gap-1 text-[8px] tracking-0 t2">up next <ArrowRight size={9} strokeWidth={2.5} /></span>
                )}
              </button>
            )
          })}
        </div>

        {/* Exercise table */}
        <div className="flex items-center justify-between pb-2 mono text-[9px] tracking-[0.16em] uppercase t3">
          <span>Exercise</span>
          <div className="flex items-center gap-3">
            <span className="w-20 text-right">Target</span>
            <span className="w-[66px] text-center">Weight</span>
          </div>
        </div>
        {program[day].exercises.map((e, i) => (
          <ExerciseRow
            key={e.name}
            exercise={e}
            index={i}
            weight={effWeight(e.name)}
            flash={flashPR === e.name}
            onCommit={val => setWeight(e.name, val)}
          />
        ))}

        {/* Add exercise → saves to this day's template */}
        {exForm.open ? (
          <div className="mt-3 space-y-2 panel-2 rounded-2xl p-3">
            <input value={exForm.name} autoFocus
              onChange={e => setExForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') addExercise(); if (e.key === 'Escape') setExForm({ open: false, name: '', sets: '' }) }}
              placeholder="New exercise name" aria-label="New exercise name"
              className="field w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" />
            <div className="flex gap-2">
              <input value={exForm.sets}
                onChange={e => setExForm(f => ({ ...f, sets: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') addExercise() }}
                placeholder="Sets · e.g. 3×10" aria-label="Sets and reps"
                className="field flex-1 rounded-xl px-3.5 py-2.5 text-sm outline-none mono" />
              <button onClick={addExercise} disabled={!exForm.name.trim()}
                className="press acc-chip rounded-xl px-5 text-[12px] font-semibold disabled:opacity-30 disabled:cursor-not-allowed">
                Add
              </button>
            </div>
            <p className="mono text-[9px] t3">Saves to the {program[day].name} template</p>
          </div>
        ) : (
          <button onClick={() => setExForm({ open: true, name: '', sets: '' })}
            className="press w-full mt-2 flex items-center justify-center gap-1.5 text-[12px] font-semibold t3 py-2.5 rounded-xl chip">
            <Plus size={12} strokeWidth={3} /> Add exercise
          </button>
        )}

        <button onClick={toggleDone}
          className={`press w-full mt-4 rounded-xl py-3.5 text-[13px] font-semibold ${done ? 'chip t2' : 'fitness-finish-primary'}`}>
          {done ? `${isToday ? 'Finished' : dayLabel} ${selSession.name} ✓ · tap to undo` : `${isToday ? 'Finish' : `Log ${dayLabel} ·`} ${program[day].name}`}
        </button>
      </section>

      {isToday && <WhoopEnergyPanel whoop={whoop} eaten={(foodLogs[today] || []).reduce((a, e) => a + e.kcal, 0)} protein={(foodLogs[today] || []).reduce((a, e) => a + (e.protein || 0), 0)} />}

      {/* Body module — InBody log */}
      <section className="panel p-6">
        <div className="flex items-center justify-between mb-4">
          <Label>Body module</Label>
          <span className="mono text-[10px] t3">InBody · {longDate(latest.date)}</span>
        </div>

        {/* Fat% gauge + goal */}
        <div className="flex items-center gap-4 mb-4">
          <Gauge pct={progress} size={132} label="Progress toward body fat goal">
            <span className="display text-[32px] leading-none font-bold t1">{latest.fatPct}<span className="text-[16px] t3">%</span></span>
            <span className="mono text-[9px] tracking-[0.08em] uppercase t3 mt-1.5">body fat</span>
          </Gauge>
          <div className="flex-1 space-y-2.5">
            <div className="acc-chip rounded-xl px-3 py-2">
              <span className="mono text-[10px] tracking-[0.12em] uppercase">{toGoal}% → goal {goal.fatPct}%</span>
            </div>
            {firstReading && readings.length > 1 && (
              <p className="mono text-[10px] t3 leading-relaxed">
                {(() => { const dw = latest.weight - firstReading.weight, df = latest.fatPct - firstReading.fatPct
                  return `${dw >= 0 ? '+' : ''}${dw.toFixed(1)}kg · ${df >= 0 ? '+' : ''}${df.toFixed(1)}% bf since ${shortDate(firstReading.date)}` })()}
              </p>
            )}
          </div>
        </div>

        {/* Metric switcher */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {METRICS.map(m => {
            const sel = metric === m.key
            const val = latest[m.key]
            const d = prevReading ? val - prevReading[m.key] : null
            return (
              <button key={m.key} onClick={() => setMetric(m.key)} aria-pressed={sel}
                className={`press rounded-2xl py-2.5 px-1 text-center ${sel ? 'acc-chip' : 'chip'}`}>
                <div className="mono text-[8px] tracking-[0.08em] uppercase t3 leading-tight min-h-[18px] flex items-center justify-center">{m.label}</div>
                <div className="display text-[19px] font-bold leading-none t1 mt-0.5">{val}<span className="text-[9px] t3 ml-0.5">{m.unit}</span></div>
                {d != null && Math.abs(d) >= 0.05 && (
                  <div className="mono text-[8px] t3 mt-1">{d > 0 ? '▲' : '▼'}{Math.abs(d).toFixed(1)}</div>
                )}
              </button>
            )
          })}
        </div>

        {/* Trend chart for the selected metric */}
        <div className="panel-2 rounded-2xl p-3">
          {chartData.length > 0
            ? <TrendChart data={chartData} unit={selMetric.unit} />
            : <p className="text-sm t3 text-center py-8">No readings yet — add an InBody result below.</p>}
        </div>

        {/* Add InBody result */}
        {inForm.open ? (
          <div className="mt-3 space-y-2 panel-2 rounded-2xl p-3">
            <input type="date" value={inForm.date} onChange={e => setInForm(f => ({ ...f, date: e.target.value }))}
              aria-label="Test date" className="field w-full rounded-xl px-3.5 py-2.5 text-sm outline-none mono" />
            <div className="grid grid-cols-2 gap-2">
              {[['weight', 'Weight kg'], ['smm', 'Muscle kg'], ['fatMass', 'Fat mass kg'], ['fatPct', 'Body fat %']].map(([k, ph]) => (
                <input key={k} value={inForm[k]} onChange={e => setInForm(f => ({ ...f, [k]: e.target.value }))}
                  placeholder={ph} aria-label={ph} type="number" inputMode="decimal"
                  className="field rounded-xl px-3 py-2.5 text-sm outline-none mono" />
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setInForm({ open: false, date: '', weight: '', smm: '', fatMass: '', fatPct: '' })}
                className="press chip t2 rounded-xl px-4 py-2.5 mono text-[10px] tracking-[0.14em] uppercase font-semibold">Cancel</button>
              <button onClick={addResult} disabled={!inForm.date || !inForm.weight}
                className="press acc-chip flex-1 rounded-xl py-2.5 mono text-[10px] tracking-[0.14em] uppercase font-semibold disabled:opacity-30 disabled:cursor-not-allowed">
                Save result
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setInForm({ open: true, date: today, weight: '', smm: '', fatMass: '', fatPct: '' })}
            className="press w-full mt-3 flex items-center justify-center gap-1.5 mono text-[10px] tracking-[0.14em] uppercase t3 py-2.5 rounded-xl chip">
            <Plus size={12} strokeWidth={3} /> Add InBody result
          </button>
        )}

        {/* Fuel targets */}
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

      {/* Energy balance · 7d — real maintenance, net deficit, predicted vs actual */}
      {energy && (() => {
        const losingPredicted = energy.predictedKg > 0
        const losingActual = energy.actualKg != null && energy.actualKg < 0
        const tracking = energy.actualKg != null && losingPredicted === losingActual
        const kpis = [
          { label: 'Avg burn', value: energy.maintenance.toLocaleString(), sub: `${energy.burnDays} WHOOP days` },
          { label: 'Avg intake', value: energy.avgIntake ? energy.avgIntake.toLocaleString() : '—', sub: `${energy.loggedDays} food days` },
          { label: 'Weekly fat', value: `${energy.predictedKg >= 0 ? '−' : '+'}${Math.abs(energy.predictedKg).toFixed(1)}`, sub: 'kg projected' },
        ]
        return (
          <section className="panel p-6">
            <div className="flex items-center justify-between mb-4">
              <Label><Zap size={12} className="inline-block mr-0.5 -mt-0.5" /> Energy balance · 7d</Label>
              <button onClick={refreshWhoop} disabled={refreshingWhoop}
                className="press chip rounded-lg px-2.5 py-1.5 mono text-[9px] tracking-[0.14em] uppercase t3 disabled:opacity-40 inline-flex items-center gap-1">
                <RefreshCw size={10} className={refreshingWhoop ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {kpis.map(k => (
                <div key={k.label} className="text-center">
                  <div className="display text-[22px] leading-none font-bold t1">{k.value}</div>
                  <div className="mono text-[8px] tracking-[0.14em] uppercase t3 mt-1.5">{k.label}</div>
                  <div className="mono text-[8px] t3 mt-0.5">{k.sub}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 hairline-t space-y-1.5">
              <p className="mono text-[10px] t2 leading-relaxed">{energy.insight}</p>
              {energy.actualKg != null ? (
                <p className="mono text-[10px] t3">
                  reconcile · predicted {energy.predictedKg >= 0 ? '−' : '+'}{Math.abs(energy.predictedKg).toFixed(1)}kg/week fat
                  {' '}vs InBody {energy.actualKg <= 0 ? '−' : '+'}{Math.abs(energy.actualKg).toFixed(1)}kg{' '}
                  <span className={tracking ? 'acc' : 'down'}>{tracking ? 'tracking' : 'check'}</span>
                </p>
              ) : (
                <p className="mono text-[10px] t3">add ≥2 InBody readings to validate against actual change</p>
              )}
              <p className="mono text-[10px] t3">
                goal {goal.fatPct}% · {energy.etaDate ? <>ETA ≈ <span className="t1">{longDate(energy.etaDate)}</span></> : 'ETA — (need more data)'}
              </p>
              {whoopLoadedAt && <p className="mono text-[9px] t3">WHOOP refreshed {whoopLoadedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>}
            </div>
          </section>
        )
      })()}

      {energy && (
        <section className="panel p-6">
          <div className="flex items-center justify-between mb-4">
            <Label><Zap size={12} className="inline-block mr-0.5 -mt-0.5" /> Weekly coaching</Label>
            <span className="mono text-[10px] t3">{energy.loggedDays}/7 food days</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="chip rounded-2xl p-3">
              <div className="mono text-[8px] tracking-[0.14em] uppercase t3">Deficit consistency</div>
              <div className="display text-[26px] leading-none font-bold t1 mt-1.5">{energy.deficitDays}/{energy.loggedDays || 0}</div>
              <p className="mono text-[9px] t3 mt-1.5">logged food days under burn</p>
            </div>
            <div className="chip rounded-2xl p-3">
              <div className="mono text-[8px] tracking-[0.14em] uppercase t3">Training load</div>
              <div className="display text-[26px] leading-none font-bold t1 mt-1.5">{weekCount}/4</div>
              <p className="mono text-[9px] t3 mt-1.5">sessions this week</p>
            </div>
            <div className="chip rounded-2xl p-3">
              <div className="mono text-[8px] tracking-[0.14em] uppercase t3">Body target</div>
              <div className="display text-[26px] leading-none font-bold t1 mt-1.5">{toGoal}%</div>
              <p className="mono text-[9px] t3 mt-1.5">body fat to goal</p>
            </div>
            <div className="chip rounded-2xl p-3">
              <div className="mono text-[8px] tracking-[0.14em] uppercase t3">Next week</div>
              <div className={`display text-[26px] leading-none font-bold mt-1.5 ${energy.avgDeficit >= 0 ? 'acc' : 'down'}`}>
                {energy.avgDeficit >= 0 ? 'Hold' : 'Reset'}
              </div>
              <p className="mono text-[9px] t3 mt-1.5">{energy.avgDeficit >= 0 ? 'repeat the current deficit' : 'bring intake below burn'}</p>
            </div>
          </div>
          <p className="mono text-[10px] t2 leading-relaxed mt-4 pt-4 hairline-t">
            {energy.loggedDays < 5
              ? 'Report confidence is limited until at least five food days are logged.'
              : energy.avgDeficit >= 350
                ? 'Keep calories steady; the WHOOP burn trend already supports the cut.'
                : 'Tighten the calorie cap or add low-strain movement before changing the lifting plan.'}
          </p>
          {(() => {
            const net = netEnergyData(energy.days)
            if (net.length < 2) return null
            return (
              <div className="mt-4 pt-4 hairline-t">
                <div className="flex items-center justify-between mb-2">
                  <span className="mono text-[8px] tracking-[0.14em] uppercase t3">Net energy · burn − intake</span>
                  <span className="mono text-[8px] t3">{net.length}d</span>
                </div>
                <TrendChart data={net} color="var(--acc-fit)" unit=" kcal" />
              </div>
            )
          })()}
        </section>
      )}

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
