import { useEffect, useState } from 'react'
import { GlassWater, Pizza, Soup, Cookie, CakeSlice, UtensilsCrossed, Beef, Wheat, Droplets, X, Plus, Pencil, Flame, Activity } from 'lucide-react'
import { useFood } from '../store'
import { TARGETS } from '../data'
import { Gauge, SegBar, Label, Odometer, DayStrip } from '../ui'
import { dateKey, todayKey } from '../dates'
import { usePersistentState } from '../hooks'
import { connectWhoop, fetchWhoopCalories } from '../whoop'

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
    const key = dateKey(d)
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
  const { presets, logs, addEntry, removeEntry, addPreset, removePreset, updatePreset } = useFood()
  // Persisted so a reload mid-session resumes on the same day; snapped to today below if stale.
  const [date, setDate] = usePersistentState('afd-food-day', todayKey(),
    v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v))
  useEffect(() => { if (date < todayKey()) setDate(todayKey()) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const isToday = date === todayKey()
  const [showForm, setShowForm] = useState(false)

  // WHOOP: calories burned for the current cycle. Pulled once on mount (today only).
  const [whoop, setWhoop] = useState(null)
  useEffect(() => {
    // Clean the ?whoop=… param left by the OAuth redirect, then load burn data.
    if (new URLSearchParams(window.location.search).get('whoop')) {
      window.history.replaceState({}, '', window.location.pathname)
    }
    fetchWhoopCalories().then(setWhoop)
  }, [])

  // Selected-day view, derived from the log. Editing (add/remove) only applies to today.
  const entries = logs[date] || []
  const totals = entries.reduce(
    (a, e) => ({ kcal: a.kcal + e.kcal, protein: a.protein + (e.protein || 0), carbs: a.carbs + (e.carbs || 0), fat: a.fat + (e.fat || 0) }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  )
  const remaining = TARGETS.kcal - totals.kcal

  const dayStatus = key => {
    if (key === todayKey()) return 'today'
    const day = logs[key]
    if (!day || day.length === 0) return 'empty'
    const k = day.reduce((a, e) => a + e.kcal, 0)
    return k > 0 && k <= TARGETS.kcal ? 'win' : 'miss'
  }

  const dayLabel = isToday ? 'Today' : (() => {
    const d = new Date(date + 'T00:00:00')
    return `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${d.getDate()}`
  })()

  // Comparative one-liner under the gauge: real number + the next action.
  const insight = (() => {
    if (totals.kcal === 0) return isToday ? 'Nothing logged yet — tap a preset to start' : 'No food logged this day'
    if (remaining < 0) return `${Math.abs(remaining).toLocaleString()} kcal over target`
    const pLeft = Math.max(0, Math.round(TARGETS.protein - totals.protein))
    return pLeft > 0
      ? `${remaining.toLocaleString()} kcal left · ${pLeft}g protein to go`
      : `${remaining.toLocaleString()} kcal left · protein hit ✓`
  })()

  const [editMode, setEditMode] = useState(false)
  const [activeCategory, setActiveCategory] = useState('All')
  const blankForm = { name: '', kcal: '', protein: '', carbs: '', fat: '', category: 'Meals', save: false, editId: null }
  const [form, setForm] = useState(blankForm)

  // Open the form prefilled to edit an existing preset's macros/name/category.
  const openEdit = p => {
    setForm({ name: p.name, kcal: String(p.kcal), protein: String(p.protein ?? ''), carbs: String(p.carbs ?? ''),
      fat: String(p.fat ?? ''), category: p.category || 'Meals', save: false, editId: p.id })
    setShowForm(true)
    setEditMode(false)
  }

  const CATEGORIES = ['All', 'Breakfast', 'Snacks', 'Meals', 'Build', 'Drinks']
  const filteredPresets = activeCategory === 'All' ? presets : presets.filter(p => p.category === activeCategory)

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
      category: form.category,
    }
    if (form.editId) {
      updatePreset(form.editId, item) // edit existing preset, don't log it
    } else {
      addEntry({ ...item, emoji: '🍽️' })
      if (form.save) addPreset({ ...item, emoji: '🍽️' })
    }
    setForm(blankForm)
    setShowForm(false)
  }

  return (
    <div className="space-y-4" style={{ '--acc': 'var(--acc-food)' }}>
      {/* Day selector */}
      <section className="panel p-4">
        <DayStrip value={date} onChange={setDate} status={dayStatus} />
      </section>

      {/* Fuel gauge */}
      <section className="panel p-6">
        <div className="flex items-center justify-between mb-2">
          <Label>Fuel · {dayLabel}</Label>
          <span className="mono text-[10px] t3">{totals.kcal.toLocaleString()} / {TARGETS.kcal.toLocaleString()} kcal</span>
        </div>
        <div className="flex flex-col items-center">
          <Gauge pct={totals.kcal / TARGETS.kcal} size={210} stroke={13} label="Calories eaten"
            color={remaining < 0 ? 'var(--down)' : 'var(--acc)'}>
            <Odometer value={Math.abs(remaining)} className={`display text-[58px] font-bold ${remaining < 0 ? 'down' : 't1'}`} />
            <span className="mono text-[10px] tracking-[0.22em] uppercase t3 mt-2">{remaining >= 0 ? 'kcal left' : 'kcal over'}</span>
          </Gauge>
          <p className="mono text-[10px] t2 mt-3 text-center leading-relaxed">{insight}</p>
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

        {/* WHOOP KPIs — compact footer. Burn never raises the 1,950 cap; it only
            surfaces the deficit (F1). */}
        {isToday && whoop && (whoop.connected && whoop.kcal != null ? (() => {
          const deficit = whoop.kcal - totals.kcal // burned − eaten; positive = deficit
          const kpis = [
            { label: 'Burned', value: whoop.kcal.toLocaleString(), cls: 't1' },
            { label: deficit >= 0 ? 'Deficit' : 'Surplus', value: Math.abs(deficit).toLocaleString(), cls: deficit >= 0 ? 'acc' : 'down' },
            { label: 'Strain', value: whoop.strain != null ? whoop.strain.toFixed(1) : '—', cls: 't1' },
          ]
          return (
            <div className="mt-5 pt-4 hairline-t grid grid-cols-3 gap-2">
              {kpis.map(k => (
                <div key={k.label} className="text-center">
                  <div className={`display text-[20px] leading-none font-bold ${k.cls}`}>{k.value}</div>
                  <div className="mono text-[8px] tracking-[0.18em] uppercase t3 mt-1.5 flex items-center justify-center gap-1">
                    {k.label === 'Burned' && <Flame size={9} strokeWidth={2.5} />}{k.label}
                  </div>
                </div>
              ))}
            </div>
          )
        })() : (
          <button onClick={connectWhoop}
            className="press mt-5 pt-4 hairline-t w-full flex items-center justify-center gap-2 mono text-[10px] tracking-[0.14em] uppercase font-semibold acc">
            <Activity size={13} strokeWidth={2.5} /> Connect WHOOP
          </button>
        ))}
      </section>

      {/* Quick add — only today is editable */}
      {isToday && (
      <section className="panel p-6">
        <div className="flex items-center justify-between mb-3">
          <Label>Presets · {presets.length}</Label>
          <div className="flex gap-2">
            <button onClick={() => { setEditMode(!editMode); setShowForm(false); setForm(blankForm) }}
              className="press mono text-[10px] tracking-[0.14em] uppercase font-semibold rounded-lg px-3.5 py-2 chip t2">
              {editMode ? 'Done' : 'Edit'}
            </button>
            <button onClick={() => { setShowForm(!showForm); setEditMode(false); setForm(blankForm) }}
              className="press mono text-[10px] tracking-[0.14em] uppercase font-semibold rounded-lg px-3 py-2 acc-chip inline-flex items-center gap-1">
              {showForm ? 'Cancel' : <><Plus size={12} strokeWidth={3} /> Custom</>}
            </button>
          </div>
        </div>

        {/* Category filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 mb-4" style={{ scrollbarWidth: 'none' }}>
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={`press flex-shrink-0 mono text-[10px] tracking-[0.14em] uppercase font-semibold rounded-full px-3.5 py-1.5 transition-colors ${
                activeCategory === cat ? 'acc-chip' : 'chip t2'
              }`}>
              {cat}
            </button>
          ))}
        </div>

        {showForm && (
          <div className="mb-4 space-y-2.5 panel-2 rounded-2xl p-4">
            {form.editId && (
              <p className="mono text-[10px] tracking-[0.14em] uppercase t3 flex items-center gap-1.5 pb-0.5">
                <Pencil size={11} strokeWidth={2.5} /> Editing preset
              </p>
            )}
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Name" aria-label="Food name" className="field w-full rounded-xl px-4 py-3 text-sm outline-none" />
            <div className="grid grid-cols-4 gap-2">
              {['kcal', 'protein', 'carbs', 'fat'].map(f => (
                <input key={f} value={form[f]} onChange={e => setForm({ ...form, [f]: e.target.value })}
                  placeholder={f} aria-label={f} type="number" inputMode="numeric"
                  className="field rounded-xl px-2 py-3 text-sm outline-none text-center mono" />
              ))}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {CATEGORIES.filter(c => c !== 'All').map(cat => (
                <button key={cat} type="button" onClick={() => setForm({ ...form, category: cat })}
                  className={`press mono text-[10px] tracking-[0.12em] uppercase font-semibold rounded-full px-3 py-1.5 ${
                    form.category === cat ? 'acc-chip' : 'chip t2'
                  }`}>
                  {cat}
                </button>
              ))}
            </div>
            {!form.editId && (
              <label className="flex items-center gap-2.5 text-sm t2 py-1 px-1 font-medium cursor-pointer">
                <input type="checkbox" checked={form.save} onChange={e => setForm({ ...form, save: e.target.checked })}
                  className="w-4 h-4" style={{ accentColor: 'var(--acc)' }} />
                Save as preset
              </label>
            )}
            <button onClick={submitCustom} disabled={!form.kcal}
              className="press w-full disabled:opacity-30 disabled:cursor-not-allowed rounded-xl py-3.5 font-bold text-sm acc-chip">
              {form.editId ? 'Save changes' : 'Add to log'}
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          {filteredPresets.map(p => (
            <button key={p.id} onClick={() => editMode ? openEdit(p) : addEntry(p)}
              aria-label={editMode ? `Edit ${p.name}` : `Add ${p.name}`}
              className="press chip rounded-2xl p-4 text-left relative">
              {editMode && (
                <span onClick={e => { e.stopPropagation(); removePreset(p.id) }}
                  role="button" aria-label={`Delete ${p.name}`}
                  className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full flex items-center justify-center shadow-md cursor-pointer text-white"
                  style={{ background: 'var(--down)' }}>
                  <X size={14} strokeWidth={3} />
                </span>
              )}
              <div className="flex items-start justify-between mb-2.5">
                <span className="w-9 h-9 rounded-xl flex items-center justify-center acc-chip">
                  <FoodIcon emoji={p.emoji} size={16} />
                </span>
                <span aria-hidden="true"
                  className="w-6 h-6 rounded-full flex items-center justify-center acc-chip opacity-70">
                  {editMode ? <Pencil size={12} strokeWidth={2.5} /> : <Plus size={13} strokeWidth={3} />}
                </span>
              </div>
              <div className="text-[13px] font-bold leading-tight t1">{p.name}</div>
              <div className="mono text-[10px] t3 mt-2">{p.kcal} kcal · {p.protein}P {p.carbs ?? 0}C {p.fat ?? 0}F</div>
            </button>
          ))}
        </div>
      </section>
      )}

      {/* Day log — timeline */}
      <section className="panel p-6">
        <Label className="mb-4">Log · {dayLabel} · {entries.length} {entries.length === 1 ? 'entry' : 'entries'}</Label>
        {entries.length === 0 ? (
          <p className="text-sm t3 text-center py-5">{isToday ? 'Nothing logged yet — tap a preset or the + button' : 'No food logged this day'}</p>
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
                  {isToday && (
                    <button onClick={() => removeEntry(e.uid)} aria-label={`Remove ${e.name}`}
                      className="press t3 p-1.5 rounded-lg chip">
                      <X size={13} strokeWidth={2.5} />
                    </button>
                  )}
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
