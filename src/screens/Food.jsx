import { useState } from 'react'
import { GlassWater, Pizza, Soup, Cookie, CakeSlice, UtensilsCrossed, Beef, Wheat, Droplets, X, Plus } from 'lucide-react'
import { useFood } from '../store'
import { TARGETS } from '../data'
import { Gauge, SegBar, Label, Odometer } from '../ui'

// Stored entries keep their emoji field for backward compat; render as SVG
const EMOJI_ICONS = { '🥤': GlassWater, '🍕': Pizza, '🍝': Soup, '🍫': CakeSlice, '🧁': CakeSlice, '🍪': Cookie }
export const FoodIcon = ({ emoji, size = 18 }) => {
  const I = EMOJI_ICONS[emoji] || UtensilsCrossed
  return <I size={size} strokeWidth={2.25} />
}

const TREND_MACROS = [
  { key: 'protein', label: 'P', color: 'var(--acc-food)', kcalPerG: 4 },
  { key: 'carbs', label: 'C', color: '#FBBF24', kcalPerG: 4 },
  { key: 'fat', label: 'F', color: '#A78BFA', kcalPerG: 9 },
]

/** Last 7 days of fuel: stacked macro bars vs target, streak, averages. Built from the existing log. */
function History({ logs }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const key = d.toISOString().slice(0, 10)
    const day = (logs[key] || []).reduce(
      (a, e) => ({ kcal: a.kcal + e.kcal, protein: a.protein + (e.protein || 0), carbs: a.carbs + (e.carbs || 0), fat: a.fat + (e.fat || 0) }),
      { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    )
    return { key, ...day, label: d.toLocaleDateString('en-US', { weekday: 'narrow' }), isToday: i === 6 }
  })
  const tracked = days.filter(d => d.kcal > 0)
  const avgOf = k => (tracked.length ? Math.round(tracked.reduce((a, d) => a + d[k], 0) / tracked.length) : 0)
  const avgKcal = avgOf('kcal')

  let streak = 0
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i]
    if (d.kcal > 0 && d.kcal <= TARGETS.kcal) streak++
    else if (d.isToday && d.kcal === 0) continue // today not logged yet doesn't break it
    else break
  }

  return (
    <section className="panel p-6">
      <div className="flex items-center justify-between mb-4">
        <Label>Trend · 7 days</Label>
        <span className="mono text-[10px] t3">
          {streak > 0 && <span className="acc">{streak}d on target · </span>}
          avg {avgKcal ? avgKcal.toLocaleString() : '—'}
        </span>
      </div>

      <div className="flex items-end justify-between gap-2 h-24" aria-hidden="true">
        {days.map(d => {
          const macroKcal = TREND_MACROS.map(m => d[m.key] * m.kcalPerG)
          const macroSum = macroKcal.reduce((a, v) => a + v, 0)
          const over = d.kcal > TARGETS.kcal
          return (
            <div key={d.key} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
              <div className="hbar w-full overflow-hidden flex flex-col-reverse" style={{
                height: `${Math.max(d.kcal > 0 ? 8 : 3, Math.min(100, (d.kcal / TARGETS.kcal) * 100))}%`,
                background: 'var(--track)',
                opacity: d.isToday || over ? 1 : 0.65,
                boxShadow: d.isToday && d.kcal > 0 ? '0 0 8px var(--acc)' : 'none',
              }}>
                {d.kcal > 0 && TREND_MACROS.map((m, i) => (
                  <div key={m.key} style={{ height: `${(macroKcal[i] / Math.max(d.kcal, macroSum)) * 100}%`, background: m.color }} />
                ))}
              </div>
              <span className={`mono text-[9px] ${over ? 'down' : d.isToday ? 'acc' : 't3'}`}>{d.label}</span>
            </div>
          )
        })}
      </div>

      <div className="mt-4 pt-4 hairline-t flex items-center justify-between">
        {TREND_MACROS.map(m => (
          <span key={m.key} className="mono text-[10px] t3 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-[2px]" style={{ background: m.color }} aria-hidden="true" />
            {m.label} avg <span className="t1 font-semibold">{avgOf(m.key)}g</span>
          </span>
        ))}
      </div>
    </section>
  )
}

export default function Food() {
  const { presets, entries, totals, remaining, logs, addEntry, removeEntry, addPreset, removePreset } = useFood()
  const [showForm, setShowForm] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState({ name: '', kcal: '', protein: '', carbs: '', fat: '', save: false })

  const macros = [
    { Icon: Beef, label: 'Protein', val: totals.protein, target: TARGETS.protein, color: 'var(--acc-food)' },
    { Icon: Wheat, label: 'Carbs', val: totals.carbs, target: TARGETS.carbs, color: '#FBBF24' },
    { Icon: Droplets, label: 'Fat', val: totals.fat, target: TARGETS.fat, color: '#A78BFA' },
  ]

  const submitCustom = () => {
    const item = {
      name: form.name || 'Custom',
      kcal: +form.kcal || 0,
      protein: +form.protein || 0,
      carbs: +form.carbs || 0,
      fat: +form.fat || 0,
      emoji: '🍽️',
    }
    addEntry(item)
    if (form.save) addPreset(item)
    setForm({ name: '', kcal: '', protein: '', carbs: '', fat: '', save: false })
    setShowForm(false)
  }

  return (
    <div className="space-y-4" style={{ '--acc': 'var(--acc-food)' }}>
      {/* Fuel gauge */}
      <section className="panel p-6">
        <div className="flex items-center justify-between mb-2">
          <Label>Fuel module</Label>
          <span className="mono text-[10px] t3">{totals.kcal.toLocaleString()} / {TARGETS.kcal.toLocaleString()} kcal</span>
        </div>
        <div className="flex flex-col items-center">
          <Gauge pct={totals.kcal / TARGETS.kcal} size={210} stroke={13} label="Calories eaten"
            color={remaining < 0 ? 'var(--down)' : 'var(--acc)'}>
            <Odometer value={Math.abs(remaining)} className={`display text-[58px] font-bold ${remaining < 0 ? 'down' : 't1'}`} />
            <span className="mono text-[10px] tracking-[0.22em] uppercase t3 mt-2">{remaining >= 0 ? 'kcal left' : 'kcal over'}</span>
          </Gauge>
        </div>
        <div className="mt-2 space-y-4">
          {macros.map(({ Icon, label, val, target, color }) => (
            <div key={label}>
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-2" style={{ color }}>
                  <Icon size={14} strokeWidth={2.5} />
                  <span className="mono text-[10px] tracking-[0.18em] uppercase">{label}</span>
                </span>
                <span className="mono text-[11px] t1">{Math.round(val)}g <span className="t3">/ {target}g</span></span>
              </div>
              <SegBar pct={val / target} color={color} />
            </div>
          ))}
        </div>
      </section>

      {/* Quick add */}
      <section className="panel p-6">
        <div className="flex items-center justify-between mb-4">
          <Label>Presets · {presets.length}</Label>
          <div className="flex gap-2">
            <button onClick={() => { setEditMode(!editMode); setShowForm(false) }}
              className="press mono text-[10px] tracking-[0.14em] uppercase font-semibold rounded-lg px-3.5 py-2 chip t2">
              {editMode ? 'Done' : 'Edit'}
            </button>
            <button onClick={() => { setShowForm(!showForm); setEditMode(false) }}
              className="press mono text-[10px] tracking-[0.14em] uppercase font-semibold rounded-lg px-3 py-2 acc-chip inline-flex items-center gap-1">
              {showForm ? 'Cancel' : <><Plus size={12} strokeWidth={3} /> Custom</>}
            </button>
          </div>
        </div>

        {showForm && (
          <div className="mb-4 space-y-2.5 panel-2 rounded-2xl p-4">
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Name" aria-label="Food name" className="field w-full rounded-xl px-4 py-3 text-sm outline-none" />
            <div className="grid grid-cols-4 gap-2">
              {['kcal', 'protein', 'carbs', 'fat'].map(f => (
                <input key={f} value={form[f]} onChange={e => setForm({ ...form, [f]: e.target.value })}
                  placeholder={f} aria-label={f} type="number" inputMode="numeric"
                  className="field rounded-xl px-2 py-3 text-sm outline-none text-center mono" />
              ))}
            </div>
            <label className="flex items-center gap-2.5 text-sm t2 py-1 px-1 font-medium cursor-pointer">
              <input type="checkbox" checked={form.save} onChange={e => setForm({ ...form, save: e.target.checked })}
                className="w-4 h-4" style={{ accentColor: 'var(--acc)' }} />
              Save as preset
            </label>
            <button onClick={submitCustom} disabled={!form.kcal}
              className="press w-full disabled:opacity-30 disabled:cursor-not-allowed rounded-xl py-3.5 font-bold text-sm acc-chip">
              Add to log
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          {presets.map(p => (
            <button key={p.id} onClick={() => editMode ? null : addEntry(p)}
              className="press chip rounded-2xl p-4 text-left relative">
              {editMode && (
                <span onClick={e => { e.stopPropagation(); removePreset(p.id) }}
                  role="button" aria-label={`Delete ${p.name}`}
                  className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full flex items-center justify-center shadow-md cursor-pointer text-white"
                  style={{ background: 'var(--down)' }}>
                  <X size={14} strokeWidth={3} />
                </span>
              )}
              <span className="w-9 h-9 rounded-xl flex items-center justify-center mb-2.5 acc-chip">
                <FoodIcon emoji={p.emoji} size={16} />
              </span>
              <div className="text-[13px] font-bold leading-tight t1">{p.name}</div>
              <div className="mono text-[10px] t3 mt-2">{p.kcal} kcal · {p.protein}P {p.carbs ?? 0}C {p.fat ?? 0}F</div>
            </button>
          ))}
        </div>
      </section>

      {/* Day log — timeline */}
      <section className="panel p-6">
        <Label className="mb-4">Log · {entries.length} {entries.length === 1 ? 'entry' : 'entries'}</Label>
        {entries.length === 0 ? (
          <p className="text-sm t3 text-center py-5">Nothing logged yet — tap a preset or the + button</p>
        ) : (
          <div className="relative pl-4">
            <span className="absolute left-0 top-2 bottom-2 w-px" style={{ background: 'var(--line)' }} aria-hidden="true" />
            {entries.map(e => (
              <div key={e.uid} className="relative py-3 flex items-center justify-between">
                <span className="absolute -left-[18.5px] w-[9px] h-[9px] rounded-full border-2"
                  style={{ background: 'var(--surface)', borderColor: 'var(--acc)' }} aria-hidden="true" />
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="text-sm font-bold t1 truncate">{e.name}</div>
                    <div className="mono text-[10px] t3 mt-0.5">{e.time} · {e.protein}P {e.carbs ?? 0}C {e.fat ?? 0}F</div>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 flex-shrink-0">
                  <span className="mono text-[12px] font-semibold t1">{e.kcal}</span>
                  <button onClick={() => removeEntry(e.uid)} aria-label={`Remove ${e.name}`}
                    className="press t3 p-1.5 rounded-lg chip">
                    <X size={13} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <History logs={logs} />
    </div>
  )
}
