import { useEffect, useMemo, useState } from 'react'
import { Apple, Beef, Coffee, Cookie, Drumstick, Egg, Fish, Milk, Salad, Sandwich, UtensilsCrossed, Wheat, Droplets, X, Plus, Pencil, ArrowUp } from 'lucide-react'
import { useFood } from '../store'
import { TARGETS } from '../data'
import { SegBar, Label, Odometer, DayStrip, Gauge } from '../ui'
import { dateKey, todayKey } from '../dates'
import { usePersistentState } from '../hooks'
import { fetchWhoopCalories, WHOOP_POLL_MS } from '../whoop'
import { WhoopBudgetFooter } from '../whoopInsights'

const FOOD_CATEGORY_MAP = {
  protein: { Icon: Egg, color: 'var(--acc-food)' },
  carb: { Icon: Wheat, color: 'var(--warn)' },
  dairy: { Icon: Milk, color: 'var(--acc-os)' },
  meat: { Icon: Beef, color: 'var(--down)' },
  poultry: { Icon: Drumstick, color: 'var(--acc-fin)' },
  fish: { Icon: Fish, color: 'var(--acc-fit)' },
  veg: { Icon: Salad, color: 'var(--up)' },
  fruit: { Icon: Apple, color: 'var(--fuel-carbs)' },
  drink: { Icon: Coffee, color: 'var(--ink-2)' },
  snack: { Icon: Cookie, color: 'var(--acc-os)' },
  meal: { Icon: Sandwich, color: 'var(--acc-fin)' },
  other: { Icon: UtensilsCrossed, color: 'var(--ink-2)' },
}

function foodCategory(item = {}) {
  if (item.foodCategory && FOOD_CATEGORY_MAP[item.foodCategory]) return item.foodCategory
  const name = (item.name || '').toLowerCase()
  if (/egg|white/.test(name)) return 'protein'
  if (/cottage|cheese|milk|latte/.test(name)) return 'dairy'
  if (/chicken|tawook/.test(name)) return 'poultry'
  if (/beef|steak/.test(name)) return 'meat'
  if (/salmon|fish|shrimp/.test(name)) return 'fish'
  if (/veggie|salad|zucchini|avocado/.test(name)) return 'veg'
  if (/banana|apple|fruit/.test(name)) return 'fruit'
  if (/coffee|latte|drink|shake|isolate/.test(name) || item.category === 'Drinks') return 'drink'
  if (/brownie|cookie|choc|sweet/.test(name) || item.category === 'Snacks') return 'snack'
  if (/bread|rice|potato|pasta|pizza/.test(name)) return 'carb'
  if (item.category === 'Meals') return 'meal'
  return 'other'
}

export const FoodIcon = ({ item, size = 20 }) => {
  const { Icon } = FOOD_CATEGORY_MAP[foodCategory(item)]
  return <Icon size={size} strokeWidth={2.25} />
}

const TREND_MACROS = [
  { key: 'protein', label: 'P', color: 'var(--fuel-protein)', kcalPerG: 4 },
  { key: 'carbs', label: 'C', color: 'var(--fuel-carbs)', kcalPerG: 4 },
  { key: 'fat', label: 'F', color: 'var(--fuel-fat)', kcalPerG: 9 },
]

function FoodPlate({ preset, large = false }) {
  const tone = FOOD_CATEGORY_MAP[foodCategory(preset)].color
  return (
    <div className={`food-plate ${large ? 'food-plate-lg' : ''}`} style={{ '--plate-tone': tone }} aria-hidden="true">
      <span className="food-plate-glow" />
      <span className="food-plate-dish"><FoodIcon item={preset} size={large ? 22 : 20} /></span>
    </div>
  )
}

const macroLine = entry => `${entry.protein || 0}P · ${entry.carbs ?? 0}C · ${entry.fat ?? 0}F`

function macroPhrase(entry) {
  const protein = entry.protein || 0
  const carbs = entry.carbs || 0
  const fat = entry.fat || 0
  if (protein >= 45) return 'protein anchor'
  if (carbs >= 25 && fat <= 10) return 'clean carb lift'
  if (fat >= 18) return 'rich and filling'
  if (entry.kcal <= 120) return 'small bite'
  return 'balanced add'
}

function dayNote(entries, totals, remaining, isToday) {
  if (!entries.length) return isToday ? 'Start with one tap. Keep it honest and light.' : 'No meals were logged on this day.'
  if (remaining < 0) return `Over target by ${Math.abs(remaining).toLocaleString()} kcal. Keep the rest of the day simple.`
  if (totals.protein >= TARGETS.protein) return 'Protein is covered. The remaining calories are optional, not a chase.'
  return `${Math.max(0, Math.round(TARGETS.protein - totals.protein))}g protein still open. Pick the next thing with purpose.`
}

function JournalEntry({ entry, preset, canRemove, onRemove, count = 1, hideTime = false }) {
  return (
    <article className="food-journal-entry">
      <FoodPlate preset={preset || entry} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold t1 leading-tight truncate">{entry.name}{count > 1 ? ` ×${count}` : ''}</h3>
            <p className="text-[11px] t3 mt-0.5 truncate">{macroPhrase(entry)}{hideTime ? '' : ` · ${entry.time || 'logged'}`}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[13px] font-bold t1">{entry.kcal * count}</div>
            <div className="text-[9px] t3 uppercase tracking-[0.12em]">cal</div>
          </div>
        </div>
        <div className="mono text-[10px] t3 mt-2">{count > 1 ? macroLine({ protein: (entry.protein || 0) * count, carbs: (entry.carbs || 0) * count, fat: (entry.fat || 0) * count }) : macroLine(entry)}</div>
      </div>
      {canRemove && (
        <button onClick={onRemove} aria-label={`Remove ${entry.name}${count > 1 ? ' group' : ''}`} className="food-delete press">
          <X size={12} strokeWidth={2.6} />
        </button>
      )}
    </article>
  )
}

function groupConsecutiveEntries(entries) {
  return entries.reduce((groups, entry) => {
    const prev = groups.at(-1)
    const same = prev && ['name', 'kcal', 'protein', 'carbs', 'fat', 'time'].every(key => (prev.entry[key] || 0) === (entry[key] || 0))
    if (same) prev.items.push(entry)
    else groups.push({ entry, items: [entry] })
    return groups
  }, [])
}

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
    let alive = true
    const loadWhoop = async () => {
      const data = await fetchWhoopCalories()
      if (alive) setWhoop(data)
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void loadWhoop()
    }

    // Clean the ?whoop=… param left by the OAuth redirect, then load burn data.
    if (new URLSearchParams(window.location.search).get('whoop')) {
      window.history.replaceState({}, '', window.location.pathname)
    }
    void Promise.resolve().then(loadWhoop)

    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void loadWhoop()
    }, WHOOP_POLL_MS)
    window.addEventListener('focus', onVisibility)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      alive = false
      clearInterval(id)
      window.removeEventListener('focus', onVisibility)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  // Selected-day view, derived from the log. Editing (add/remove) only applies to today.
  const entries = logs[date] || []
  const totals = entries.reduce(
    (a, e) => ({ kcal: a.kcal + e.kcal, protein: a.protein + (e.protein || 0), carbs: a.carbs + (e.carbs || 0), fat: a.fat + (e.fat || 0) }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  )
  const remaining = TARGETS.kcal - totals.kcal
  const progress = Math.min(1, totals.kcal / TARGETS.kcal)

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
  const [activeCategory, setActiveCategory] = useState('Breakfast')
  const blankForm = { name: '', kcal: '', protein: '', carbs: '', fat: '', category: 'Meals', save: false, editId: null }
  const [form, setForm] = useState(blankForm)

  // Open the form prefilled to edit an existing preset's macros/name/category.
  const openEdit = p => {
    setForm({ name: p.name, kcal: String(p.kcal), protein: String(p.protein ?? ''), carbs: String(p.carbs ?? ''),
      fat: String(p.fat ?? ''), category: p.category || 'Meals', save: false, editId: p.id })
    setShowForm(true)
    setEditMode(false)
  }

  const CATEGORIES = ['Breakfast', 'Snacks', 'Meals', 'Build', 'Drinks']
  const filteredPresets = presets.filter(p => p.category === activeCategory)

  const macros = [
    { Icon: Beef, label: 'P', val: totals.protein, target: TARGETS.protein, color: 'var(--fuel-protein)' },
    { Icon: Wheat, label: 'C', val: totals.carbs, target: TARGETS.carbs, color: 'var(--fuel-carbs)' },
    { Icon: Droplets, label: 'F', val: totals.fat, target: TARGETS.fat, color: 'var(--fuel-fat)' },
  ]

  const presetByName = useMemo(() => new Map(presets.map(p => [p.name, p])), [presets])
  const journalGroups = groupConsecutiveEntries(entries)

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
    <div className="food-journal space-y-4 pb-24" style={{ '--acc': 'var(--acc-food)' }}>
      <section className="food-day-picker">
        <DayStrip value={date} onChange={setDate} status={dayStatus} />
      </section>

      <section className="food-hero">
        <div className="food-fuel-kicker">
          <span className="food-fuel-dot" />
          <span>Fuel</span>
          <span className="food-fuel-sep">·</span>
          <span>{isToday ? 'Today' : dayLabel}</span>
        </div>

        <div className="food-fuel-body">
          <div className="food-fuel-gauge">
            <Gauge pct={progress} size={196} stroke={17} color={remaining < 0 ? 'var(--down)' : 'var(--fuel-protein)'} label="Calorie target progress">
              <Odometer value={Math.max(0, remaining)} className="display food-fuel-kcal" />
              <span className="food-fuel-label">Kcal left</span>
            </Gauge>
          </div>
          <div className="food-fuel-macros">
            {macros.map(({ Icon, label, val, target, color }) => (
              <div key={label} className="food-fuel-macro">
                <div className="food-fuel-macro-top">
                  <span className="food-fuel-macro-id" style={{ color }}>
                    <Icon size={18} strokeWidth={2.35} />
                    <span>{label}</span>
                  </span>
                  <span className="food-fuel-macro-value">{Math.round(val)}/{target}g</span>
                </div>
                <SegBar pct={val / target} color={color} cells={10} />
              </div>
            ))}
          </div>
        </div>

        {isToday && <WhoopBudgetFooter whoop={whoop} eaten={totals.kcal} protein={totals.protein} />}
      </section>

      {isToday && (
      <section className="food-presets">
        <div className="flex items-center justify-between px-1 mb-3">
          <Label>Plates</Label>
          <button onClick={() => { setEditMode(!editMode); setShowForm(false); setForm(blankForm) }} className="food-link press">
            {editMode ? 'Done' : 'Edit'}
          </button>
        </div>
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

        <div className="food-plates-rail">
          {filteredPresets.map(p => (
            <button key={p.id} onClick={() => editMode ? openEdit(p) : addEntry(p)}
              aria-label={editMode ? `Edit ${p.name}` : `Add ${p.name}`}
              className="food-preset-card press relative">
              {editMode && (
                <span onClick={e => { e.stopPropagation(); removePreset(p.id) }}
                  role="button" aria-label={`Delete ${p.name}`}
                  className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full flex items-center justify-center shadow-md cursor-pointer text-white"
                  style={{ background: 'var(--down)' }}>
                  <X size={14} strokeWidth={3} />
                </span>
              )}
              <div className="flex items-start justify-between mb-2.5">
                <FoodPlate preset={p} />
                <span aria-hidden="true"
                  className="w-6 h-6 rounded-full flex items-center justify-center acc-chip opacity-70">
                  {editMode ? <Pencil size={12} strokeWidth={2.5} /> : <Plus size={13} strokeWidth={3} />}
                </span>
              </div>
              <div className="text-[13px] font-bold leading-tight t1">{p.name}</div>
              <div className="mono text-[10px] t3 mt-2">{p.kcal} kcal · {macroLine(p)}</div>
            </button>
          ))}
        </div>
      </section>
      )}

      <section className="food-logbook">
        <div className="food-journal-head px-1 mb-3">
          <Label>Journal · {entries.length}</Label>
          <span className="mono text-[10px] t3">{insight}</span>
        </div>
        {entries.length === 0 ? (
          <div className="food-empty">
            <p className="text-[15px] font-semibold t1">Nothing logged yet</p>
            <p className="text-[13px] t3 mt-1">{isToday ? 'Tap a quick plate or use the bottom input.' : 'No food logged this day.'}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {journalGroups.map((group, index) => (
              <JournalEntry
                key={group.items.map(e => e.uid).join('-')}
                entry={group.entry}
                preset={presetByName.get(group.entry.name)}
                count={group.items.length}
                hideTime={index > 0 && journalGroups[index - 1].entry.time === group.entry.time}
                canRemove={isToday}
                onRemove={() => group.items.forEach(e => removeEntry(e.uid))}
              />
            ))}
            <p className="food-note">{dayNote(entries, totals, remaining, isToday)}</p>
          </div>
        )}
      </section>

      <History logs={logs} />

      {isToday && showForm && (
        <div className="food-form-sheet">
          {form.editId && (
            <p className="mono text-[10px] tracking-[0.14em] uppercase t3 flex items-center gap-1.5 pb-0.5">
              <Pencil size={11} strokeWidth={2.5} /> Editing preset
            </p>
          )}
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="Food name" aria-label="Food name" className="field w-full rounded-2xl px-4 py-3 text-sm outline-none" />
          <div className="grid grid-cols-4 gap-2">
            {['kcal', 'protein', 'carbs', 'fat'].map(f => (
              <input key={f} value={form[f]} onChange={e => setForm({ ...form, [f]: e.target.value })}
                placeholder={f} aria-label={f} type="number" inputMode="numeric"
                className="field rounded-2xl px-2 py-3 text-sm outline-none text-center mono" />
            ))}
          </div>
          <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {CATEGORIES.map(cat => (
              <button key={cat} type="button" onClick={() => setForm({ ...form, category: cat })}
                className={`press mono text-[10px] tracking-[0.12em] uppercase font-semibold rounded-full px-3 py-1.5 flex-shrink-0 ${
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
        </div>
      )}

      {isToday && (
        <div className="food-composer">
          <button onClick={() => { setShowForm(!showForm); setEditMode(false); setForm(blankForm) }} className="food-composer-plus press" aria-label="Add custom food">
            {showForm ? <X size={17} /> : <Plus size={17} />}
          </button>
          <button onClick={() => { setShowForm(true); setEditMode(false); setForm(blankForm) }} className="food-composer-field press">What did you eat?</button>
          <button onClick={submitCustom} disabled={!showForm || !form.kcal} className="food-composer-send press" aria-label="Submit food">
            <ArrowUp size={15} strokeWidth={3} />
          </button>
        </div>
      )}
    </div>
  )
}
