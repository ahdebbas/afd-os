import { useEffect, useMemo, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { FITNESS, DEFAULT_WEIGHTS, nextWorkoutIdx } from '../../data'
import { usePersistentState } from '../../hooks'
import { todayKey } from '../../dates'
import { useFood } from '../../store'
import { useOs } from '../../os'
import { connectWhoop, fetchWhoopCycles, WHOOP_POLL_MS } from '../../whoop'
import { Card, Segmented, Button, Badge, Ring, LineChart, NumberFlow, Stat } from '../primitives'

const METRICS = [
  { key: 'weight', label: 'Weight', unit: 'kg' },
  { key: 'smm', label: 'Muscle', unit: 'kg' },
  { key: 'fatMass', label: 'Fat mass', unit: 'kg' },
  { key: 'fatPct', label: 'Body fat', unit: '%' },
]

function SetTracker({ spec, onTick }) {
  const total = (String(spec).match(/^(\d+)×/) || [])[1] ? parseInt(spec, 10) : 1
  const [done, setDone] = useState(0)
  const toggle = () => { const next = done >= total ? 0 : done + 1; setDone(next); if (next > done) onTick?.() }
  return (
    <button onClick={toggle} className="flex gap-1.5 items-center">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className="w-3.5 h-3.5 rounded-full" style={{
          background: i < done ? 'var(--d-accent)' : 'transparent',
          border: `1.5px solid ${i < done ? 'var(--d-accent)' : 'var(--d-border-strong)'}`,
        }} />
      ))}
      <span className="d-num text-[12px] d-t3 ml-1">{spec}</span>
    </button>
  )
}

function WeightCell({ weight, onCommit }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const ref = useRef(null)
  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select() } }, [editing])
  const commit = () => { setEditing(false); const n = parseFloat(draft); onCommit(Number.isFinite(n) && n > 0 ? n : null) }
  if (editing) {
    return <input ref={ref} value={draft} type="number" inputMode="decimal" step="2.5"
      onChange={e => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
      className="d-input d-num text-center" style={{ width: 78, height: 30 }} aria-label="Weight kg" />
  }
  return (
    <button onClick={() => { setDraft(weight != null ? String(weight) : ''); setEditing(true) }}
      className="d-num text-[13px] px-2.5 rounded-[8px]" style={{ height: 30, minWidth: 78,
        background: weight != null ? 'var(--d-accent-weak)' : 'var(--d-panel-3)',
        color: weight != null ? 'var(--d-accent)' : 'var(--d-text-3)' }}>
      {weight != null ? weight : 'add'}<span className="text-[10px] opacity-70 ml-0.5">kg</span>
    </button>
  )
}

export default function FitnessPage() {
  const os = useOs()
  const { logs: foodLogs } = useFood()
  const [program] = usePersistentState('afd-program-v2', FITNESS.program, Array.isArray)
  const [sessions, setSessions] = usePersistentState('afd-sessions', [], Array.isArray)
  const [weights, setWeights] = usePersistentState('afd-weights', DEFAULT_WEIGHTS, v => v && typeof v === 'object' && !Array.isArray(v))
  const [inbody] = usePersistentState('afd-inbody', FITNESS.inbody, Array.isArray)
  const [metric, setMetric] = useState('weight')

  const today = todayKey()
  const suggested = nextWorkoutIdx(program, sessions)
  const [day, setDay] = useState(suggested)
  const todaySession = sessions.find(s => s.date === today)
  const done = !!todaySession

  const lastWeights = useMemo(() => {
    const m = {}
    ;[...sessions].sort((a, b) => (a.date < b.date ? -1 : 1)).forEach(s =>
      Object.entries(s.weights || {}).forEach(([n, w]) => { if (Number.isFinite(+w) && +w > 0) m[n] = +w }))
    return m
  }, [sessions])

  const effWeight = name => todaySession?.weights?.[name] ?? weights[name] ?? lastWeights[name] ?? null

  const setWeight = (name, val) => {
    setWeights(prev => { const next = { ...prev }; if (val == null) delete next[name]; else next[name] = val; return next })
    if (todaySession) setSessions(prev => prev.map(s => {
      if (s.date !== today) return s
      const w = { ...(s.weights || {}) }; if (val == null) delete w[name]; else w[name] = val
      return { ...s, weights: w }
    }))
  }

  const toggleDone = () => {
    if (done) { setSessions(prev => prev.filter(s => s.date !== today)); return }
    const snap = {}
    program[day].exercises.forEach(e => { const w = effWeight(e.name); if (w != null) snap[e.name] = w })
    setSessions(prev => [...prev, { date: today, idx: day, name: program[day].name, weights: snap }])
    os?.announce(`SESSION LOGGED · ${program[day].name}`, 'var(--acc-fit)')
  }

  const weekCount = useMemo(() => {
    let c = 0
    for (let i = 0; i < 7; i++) {
      const d = new Date(); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow + i)
      const key = d.toISOString().slice(0, 10)
      if (sessions.find(s => s.date === key)) c++
    }
    return c
  }, [sessions])

  const readings = useMemo(() => [...inbody].sort((a, b) => (a.date < b.date ? -1 : 1)), [inbody])
  const latest = readings[readings.length - 1] || { weight: 0, smm: 0, fatMass: 0, fatPct: 0 }
  const prev = readings[readings.length - 2]
  const selMetric = METRICS.find(m => m.key === metric)
  const chartData = readings.filter(r => r[metric] != null).map(r => ({ date: r.date, value: r[metric] }))
  const toGoal = (latest.fatPct - FITNESS.goal.fatPct).toFixed(1)

  const history = useMemo(
    () => [...sessions].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 12),
    [sessions],
  )
  const fmtDay = d => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  // Compact WHOOP energy snapshot
  const [cycles, setCycles] = useState(null)
  useEffect(() => {
    let alive = true
    const load = async () => { const c = await fetchWhoopCycles(); if (alive) setCycles(c) }
    void load()
    const id = setInterval(() => { if (document.visibilityState === 'visible') void load() }, WHOOP_POLL_MS)
    return () => { alive = false; clearInterval(id) }
  }, [])

  const energy = useMemo(() => {
    if (!cycles?.connected || !cycles.cycles?.length) return null
    const burn = {}; cycles.cycles.forEach(c => { if (!c.partial) burn[c.date] = c.kcal })
    const days = []
    for (let i = 1; i <= 7; i++) { const d = new Date(); d.setDate(d.getDate() - i); const k = d.toISOString().slice(0, 10); if (burn[k] != null) days.push({ k, burned: burn[k], eaten: (foodLogs[k] || []).reduce((a, e) => a + e.kcal, 0) }) }
    if (!days.length) return null
    const maintenance = Math.round(days.reduce((a, d) => a + d.burned, 0) / days.length)
    const logged = days.filter(d => d.eaten > 0)
    const avgIntake = logged.length ? Math.round(logged.reduce((a, d) => a + d.eaten, 0) / logged.length) : 0
    const avgDeficit = logged.length ? Math.round(logged.reduce((a, d) => a + (d.burned - d.eaten), 0) / logged.length) : 0
    const predictedKg = (avgDeficit * 7) / 7700
    return { maintenance, avgIntake, predictedKg, loggedDays: logged.length }
  }, [cycles, foodLogs])

  return (
    <div className="d-enter space-y-4">
      <div className="grid grid-cols-[1fr_400px] gap-4 items-start">
        {/* Workout console */}
        <Card eyebrow="Workout" title={program[day].name}
          actions={
            <div className="flex items-center gap-2">
              {done && <Badge tone="up"><Check size={11} /> logged</Badge>}
              <Button size="sm" variant={done ? 'outline' : 'primary'} onClick={toggleDone}>{done ? 'Undo' : 'Finish workout'}</Button>
            </div>
          }>
          <Segmented className="mb-3" value={day} onChange={setDay}
            options={program.map((d, i) => ({ value: i, label: d.name.split(' & ')[0] }))} />
          <table className="d-table">
            <thead><tr><th style={{ width: 34 }}>#</th><th>Exercise</th><th>Sets</th><th style={{ textAlign: 'right' }}>Weight</th></tr></thead>
            <tbody>
              {program[day].exercises.map((e, i) => (
                <tr key={e.name}>
                  <td className="d-num d-t3">{String(i + 1).padStart(2, '0')}</td>
                  <td className="d-t1 font-medium">{e.name}</td>
                  <td><SetTracker spec={e.sets} onTick={() => os?.startTimer?.(90)} /></td>
                  <td style={{ textAlign: 'right' }}><WeightCell weight={effWeight(e.name)} onCommit={v => setWeight(e.name, v)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Right rail — small cards stacked to match the console height */}
        <div className="space-y-4">
          <Card eyebrow="This week" title="Training load">
            <div className="flex items-center justify-between">
              <Stat label="Sessions" value={`${weekCount}/4`} />
              <Ring pct={weekCount / 4} size={64} stroke={7}>
                <span className="text-[14px] font-semibold d-num d-t1">{weekCount}</span>
              </Ring>
            </div>
          </Card>

          <Card eyebrow="Recent" title="Workout history">
            {history.length === 0 ? (
              <p className="text-[13px] d-t3">No sessions logged yet — finish a workout to start the streak.</p>
            ) : (
              <div className="space-y-1 max-h-[300px] d-scroll -mr-1 pr-1">
                {history.map(s => {
                  const lifts = Object.keys(s.weights || {}).length
                  return (
                    <div key={s.date} className="flex items-center justify-between gap-3 px-2.5 py-2 rounded-[10px]" style={{ background: 'var(--d-panel-3)' }}>
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium d-t1 truncate">{s.name}</div>
                        <div className="text-[11px] d-t3 d-num">{fmtDay(s.date)}</div>
                      </div>
                      <Badge tone={lifts ? 'accent' : 'neutral'}>{lifts} {lifts === 1 ? 'lift' : 'lifts'}</Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Body composition — full width so the chart can breathe */}
      <Card eyebrow="InBody" title="Body composition"
        actions={
          <Segmented value={metric} onChange={setMetric}
            options={METRICS.map(m => ({ value: m.key, label: m.label }))} />
        }>
        <div className="flex items-center gap-5 mb-4">
          <Ring pct={Math.max(0.04, Math.min(1, (20 - latest.fatPct) / (20 - FITNESS.goal.fatPct)))} size={88} stroke={8}>
            <div>
              <span className="text-[22px] font-semibold d-t1 d-num leading-none">{latest.fatPct}<span className="text-[12px] d-t3">%</span></span>
              <div className="text-[10px] d-t3 mt-0.5">body fat</div>
            </div>
          </Ring>
          <div className="flex items-center gap-2.5 flex-wrap">
            <Badge tone="accent">{toGoal}% to goal {FITNESS.goal.fatPct}%</Badge>
            <span className="text-[12px] d-t2 d-num">{latest.weight}kg · {latest.smm}kg muscle</span>
            {prev && <span className="text-[11px] d-t3 d-num">{(latest.weight - prev.weight >= 0 ? '+' : '')}{(latest.weight - prev.weight).toFixed(1)}kg since last</span>}
          </div>
        </div>
        <LineChart data={chartData} unit={selMetric.unit} height={240} />
      </Card>

      {/* Energy */}
      <Card eyebrow="WHOOP · 7 days" title="Energy balance">
        {!energy ? (
          <div className="flex items-center justify-between gap-4">
            <p className="text-[13px] d-t3">Connect WHOOP and log food days to build the energy model.</p>
            <Button size="sm" variant="primary" onClick={connectWhoop}>Connect WHOOP</Button>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4">
            <div><div className="d-eyebrow">Maintenance</div><NumberFlow value={energy.maintenance} className="d-h2 d-t1 block mt-1" /><div className="text-[11px] d-t3 mt-0.5">avg burn</div></div>
            <div><div className="d-eyebrow">Avg intake</div><NumberFlow value={energy.avgIntake} className="d-h2 d-t1 block mt-1" /><div className="text-[11px] d-t3 mt-0.5">{energy.loggedDays} food days</div></div>
            <div><div className="d-eyebrow">Weekly fat</div><div className={`d-h2 d-num mt-1 ${energy.predictedKg >= 0 ? 'd-up' : 'd-down'}`}>{energy.predictedKg >= 0 ? '−' : '+'}{Math.abs(energy.predictedKg).toFixed(2)}</div><div className="text-[11px] d-t3 mt-0.5">kg projected</div></div>
            <div><div className="d-eyebrow">To goal</div><div className="d-h2 d-t1 d-num mt-1">{toGoal}%</div><div className="text-[11px] d-t3 mt-0.5">body fat</div></div>
          </div>
        )}
      </Card>
    </div>
  )
}
