import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, X, Search } from 'lucide-react'
import { useFood } from '../../store'
import { usePersistentState } from '../../hooks'
import { dateKey, todayKey } from '../../dates'
import { TARGETS } from '../../data'
import { Card, Ring, Meter, NumberFlow, Segmented, DataTable, Button, IconButton } from '../primitives'

const CATEGORIES = ['Breakfast', 'Snacks', 'Meals', 'Build', 'Drinks']
const BLANK = { name: '', kcal: '', protein: '', carbs: '', fat: '', category: 'Meals', save: false }

function MacroRow({ label, val, target, color }) {
  return (
    <div className="grid grid-cols-[62px_minmax(0,1fr)_74px] items-center gap-3">
      <span className="text-[12px] d-t2">{label}</span>
      <Meter pct={target ? val / target : 0} color={color} />
      <span className="text-[12px] d-t3 d-num text-right">{Math.round(val)}<span className="d-t3">/{target}g</span></span>
    </div>
  )
}

export default function FoodPage() {
  const { presets, logs, addEntry, removeEntry, addPreset } = useFood()
  const [date, setDate] = usePersistentState('afd-food-day', todayKey(),
    v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v))
  const [category, setCategory] = useState(CATEGORIES[0])
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(BLANK)

  const isToday = date === todayKey()
  const dayLabel = isToday ? 'Today' : new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const entries = logs[date] || []
  const totals = entries.reduce(
    (a, e) => ({ kcal: a.kcal + e.kcal, protein: a.protein + (e.protein || 0), carbs: a.carbs + (e.carbs || 0), fat: a.fat + (e.fat || 0) }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 })
  const remaining = TARGETS.kcal - totals.kcal

  const shiftWeek = n => {
    const d = new Date(date + 'T00:00:00')
    d.setDate(d.getDate() + n * 7)
    const k = dateKey(d)
    setDate(k > todayKey() ? todayKey() : k)
  }
  const weekStart = (() => { const d = new Date(date + 'T00:00:00'); d.setDate(d.getDate() - d.getDay()); return d })()
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d })
  const curWeekStart = (() => { const d = new Date(todayKey() + 'T00:00:00'); d.setDate(d.getDate() - d.getDay()); return d })()
  const canForward = weekStart.getTime() < curWeekStart.getTime()

  const filtered = presets.filter(p => {
    const q = search.trim().toLowerCase()
    if (q) return p.name.toLowerCase().includes(q)
    return p.category === category
  })

  const submit = () => {
    if (!form.kcal) return
    const item = { name: form.name || 'Custom', kcal: +form.kcal || 0, protein: +form.protein || 0, carbs: +form.carbs || 0, fat: +form.fat || 0, category: form.category }
    addEntry({ ...item, emoji: '🍽️' }, date)
    if (form.save) addPreset({ ...item, emoji: '🍽️' })
    setForm(BLANK)
  }

  const presetCols = [
    { key: 'name', label: 'Preset', render: p => <span className="font-medium d-t1">{p.name}</span> },
    { key: 'kcal', label: 'Kcal', align: 'right', render: p => <span className="d-num d-t1">{p.kcal}</span> },
    { key: 'macros', label: 'P / C / F', align: 'right', render: p => <span className="d-num d-t3">{p.protein ?? 0} · {p.carbs ?? 0} · {p.fat ?? 0}</span> },
    { key: 'add', label: '', align: 'right', width: 44, render: () => <Plus size={14} className="d-accent inline" /> },
  ]

  const logCols = [
    { key: 'time', label: 'Time', width: 64, render: e => <span className="d-num d-t3 text-[12px]">{e.time}</span> },
    { key: 'name', label: 'Item', render: e => <span className="d-t1">{e.name}</span> },
    { key: 'kcal', label: 'Kcal', align: 'right', render: e => <span className="d-num d-t1">{e.kcal}</span> },
    { key: 'rm', label: '', align: 'right', width: 40, render: e => (
      <button onClick={ev => { ev.stopPropagation(); removeEntry(e.uid, date) }} aria-label={`Remove ${e.name}`} className="d-icon-btn" style={{ width: 26, height: 26 }}><X size={13} /></button>
    ) },
  ]

  return (
    <div className="d-enter space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
        <Card eyebrow={isToday ? 'Today' : 'Selected day'} title={dayLabel}
          actions={<span className="text-[12px] d-t3 d-num">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>}>
          <div className="flex items-center gap-6">
            <Ring pct={totals.kcal / TARGETS.kcal} size={96} stroke={9} color={remaining < 0 ? 'var(--d-down)' : 'var(--d-accent)'}>
              <div>
                <NumberFlow value={Math.abs(remaining)} className="text-[22px] font-semibold d-t1 leading-none" />
                <div className="text-[10px] d-t3 mt-1">{remaining >= 0 ? 'kcal left' : 'over'}</div>
              </div>
            </Ring>
            <div className="flex-1 min-w-0 space-y-2.5">
              <MacroRow label="Protein" val={totals.protein} target={TARGETS.protein} color="var(--d-accent)" />
              <MacroRow label="Carbs" val={totals.carbs} target={TARGETS.carbs} color="var(--d-warn)" />
              <MacroRow label="Fat" val={totals.fat} target={TARGETS.fat} color="var(--d-up)" />
              <div className="text-[11px] d-t3 d-num pt-1">{Math.round(totals.kcal).toLocaleString()} / {TARGETS.kcal.toLocaleString()} kcal logged</div>
            </div>
          </div>
        </Card>

        <Card eyebrow="Calendar" title="This week"
          actions={!isToday && <Button size="sm" variant="ghost" onClick={() => setDate(todayKey())}>Today</Button>}>
          <div className="flex items-center gap-2">
            <IconButton icon={ChevronLeft} onClick={() => shiftWeek(-1)} aria-label="Previous week" />
            <div className="flex-1 grid grid-cols-7 gap-1 p-1 rounded-[14px]" style={{ background: 'var(--d-panel-3)' }}>
              {weekDays.map(d => {
                const key = dateKey(d)
                const sel = key === date
                const isFuture = key > todayKey()
                const isToday2 = key === todayKey()
                const wd = ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()]
                return (
                  <button key={key} disabled={isFuture} onClick={() => setDate(key)}
                    className={`relative flex flex-col items-center justify-center h-[48px] rounded-[11px] transition-colors ${sel || isFuture ? '' : 'hover:bg-[var(--d-panel)]'}`}
                    style={{
                      background: sel ? 'var(--d-accent)' : undefined,
                      color: sel ? 'var(--d-on-accent)' : isFuture ? 'var(--d-text-3)' : isToday2 ? 'var(--d-accent)' : 'var(--d-text)',
                      opacity: isFuture ? 0.4 : 1,
                      cursor: isFuture ? 'default' : 'pointer',
                    }}>
                    <span className="text-[10px] font-semibold leading-none" style={{ opacity: 0.65 }}>{wd}</span>
                    <span className="text-[15px] font-semibold d-num leading-none mt-1">{d.getDate()}</span>
                    {isToday2 && !sel && <span className="absolute bottom-1.5 w-1 h-1 rounded-full" style={{ background: 'var(--d-accent)' }} />}
                  </button>
                )
              })}
            </div>
            <IconButton icon={ChevronRight} onClick={() => canForward && shiftWeek(1)} aria-label="Next week" disabled={!canForward} style={{ opacity: canForward ? 1 : 0.35 }} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-[1fr_360px] gap-4 items-start">
        <div className="space-y-4">
          {/* Presets */}
          <Card title="Presets" eyebrow={`${filtered.length} items`} bodyClass="!p-0"
            actions={
              <div className="flex items-center gap-2">
                <div className="d-input flex items-center gap-2 w-[180px]" style={{ height: 30 }}>
                  <Search size={13} className="d-t3" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search" className="flex-1 bg-transparent outline-none text-[13px] d-t1" />
                </div>
              </div>
            }>
            <div className="px-4 py-3 d-divider" style={{ borderTop: 'none', borderBottom: '1px solid var(--d-border)' }}>
              <Segmented options={CATEGORIES.map(c => ({ value: c, label: c }))} value={category} onChange={setCategory} />
            </div>
            {filtered.length === 0
              ? <p className="text-[13px] d-t3 p-4">No presets here.</p>
              : <DataTable columns={presetCols} rows={filtered} getRowKey={p => p.id} onRowClick={p => addEntry(p, date)} />}
          </Card>

          <Card title="Log" eyebrow={`${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`} bodyClass="!p-0">
            {entries.length === 0
              ? <p className="text-[13px] d-t3 p-4">Nothing logged.</p>
              : <DataTable columns={logCols} rows={entries} getRowKey={e => e.uid} />}
          </Card>
        </div>

        {/* Right: quick add */}
        <div className="space-y-4">
          <Card title="Quick add">
            <div className="space-y-2.5">
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Name" className="d-input" />
              <div className="grid grid-cols-4 gap-2">
                {['kcal', 'protein', 'carbs', 'fat'].map(f => (
                  <input key={f} value={form[f]} onChange={e => setForm({ ...form, [f]: e.target.value })} placeholder={f === 'kcal' ? 'kcal' : f[0].toUpperCase()} type="number" inputMode="numeric" className="d-input text-center !px-1" />
                ))}
              </div>
              <Segmented options={CATEGORIES.map(c => ({ value: c, label: c }))} value={form.category} onChange={c => setForm({ ...form, category: c })} />
              <label className="flex items-center gap-2 text-[13px] d-t2 cursor-pointer select-none">
                <input type="checkbox" checked={form.save} onChange={e => setForm({ ...form, save: e.target.checked })} style={{ accentColor: 'var(--d-accent)' }} />
                Save as preset
              </label>
              <Button variant="primary" className="w-full" disabled={!form.kcal} onClick={submit}>
                <Plus size={15} strokeWidth={2.4} /> Add to {dayLabel.toLowerCase()}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
