import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Plus, Undo2 } from 'lucide-react'
import { useFood } from './store'
import { Sheet } from './ui'

export function FoodUndo() {
  const { removed, undoRemoval } = useFood()
  if (!removed) return null
  return <div className="food-undo" role="status">
    <span>{removed.items.length === 1 ? removed.items[0].entry.name : `${removed.items.length} entries`} removed · {removed.day}</span>
    <button onClick={undoRemoval}><Undo2 size={16} /> Undo</button>
  </div>
}

export function RecentMeals({ day }) {
  const { logs, addEntry } = useFood()
  const names = new Set()
  const recent = Object.keys(logs).filter(date => date <= day).sort().reverse().flatMap(date => [...logs[date]].reverse())
    .filter(entry => {
      if (names.has(entry.name)) return false
      names.add(entry.name)
      return true
    }).slice(0, 4)
  if (!recent.length) return null
  return <section className="food-recent" aria-label="Repeat a recent meal">
    <h2>Recent meals</h2>
    <div>{recent.map(entry => <button key={entry.name} onClick={() => addEntry(entry, day)} title={`Repeat ${entry.name}`}>
      <Plus size={16} /><span>{entry.name}<small>{entry.kcal} kcal</small></span>
    </button>)}</div>
  </section>
}

export function FoodEntryEditor({ entry, day, onClose }) {
  const { updateEntry } = useFood()
  const [form, setForm] = useState(() => ({ name: entry.name, kcal: entry.kcal, protein: entry.protein || 0, carbs: entry.carbs || 0, fat: entry.fat || 0 }))
  const [portion, setPortion] = useState('1')
  const scale = value => {
    setPortion(value)
    if (!(Number(value) > 0)) return
    setForm(previous => ({ ...previous, ...Object.fromEntries(['kcal', 'protein', 'carbs', 'fat'].map(key => [key, Math.round((entry[key] || 0) * Number(value))])) }))
  }
  return createPortal(<Sheet open onClose={onClose} title="Edit meal">
    <form className="food-entry-editor" onSubmit={event => {
      event.preventDefault()
      updateEntry(entry.uid, { name: form.name.trim(), ...Object.fromEntries(['kcal', 'protein', 'carbs', 'fat'].map(key => [key, Number(form[key])])), portion: (entry.portion || 1) * Number(portion) }, day)
      onClose()
    }}>
      <p>{day}</p>
      <label>Name<input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
      <label>Portion multiplier<input type="number" min="0.01" step="any" required value={portion} onChange={event => scale(event.target.value)} /></label>
      <div className="food-editor-macros">{['kcal', 'protein', 'carbs', 'fat'].map(key => <label key={key}>{key === 'kcal' ? 'Calories' : `${key} (g)`}
        <input type="number" min="0" step="any" required value={form[key]} onChange={event => setForm({ ...form, [key]: event.target.value })} />
      </label>)}</div>
      <button className="cash-action" type="submit" disabled={!form.name.trim()}><Check size={16} /> Save meal</button>
    </form>
  </Sheet>, document.body)
}