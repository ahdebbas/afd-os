import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { TARGETS } from './data'
import { useOs } from './os'
import { usePersistentState } from './hooks'
import { todayKey } from './dates'

const DEFAULT_PRESETS = [
  // Breakfast
  { id: 'p9',  name: 'Cottage Cheese + Milk Bread', kcal: 254, protein: 29, carbs: 27, fat: 3,  emoji: '🧀', category: 'Breakfast' },
  { id: 'p10', name: 'Boiled Egg',                  kcal: 70,  protein: 6,  carbs: 0,  fat: 5,  emoji: '🥚', category: 'Breakfast' },
  { id: 'p11', name: 'Fried Egg (Oil Spray)',        kcal: 85,  protein: 6,  carbs: 0,  fat: 6,  emoji: '🍳', category: 'Breakfast' },
  { id: 'p12', name: 'Egg White',                    kcal: 17,  protein: 4,  carbs: 0,  fat: 0,  emoji: '🥚', category: 'Breakfast' },
  // Snacks
  { id: 'p1',  name: 'Beef-XP Isolate (30g)',        kcal: 114, protein: 28, carbs: 0,  fat: 0,  emoji: '🥤', category: 'Snacks' },
  { id: 'p4',  name: 'Protein Marble Brownie',       kcal: 325, protein: 22, carbs: 22, fat: 13, emoji: '🍫', category: 'Snacks' },
  { id: 'p5',  name: 'Chocolate Protein Brownie',    kcal: 165, protein: 12, carbs: 18, fat: 5,  emoji: '🧁', category: 'Snacks' },
  { id: 'p6',  name: 'White Choc Protein Cookie',    kcal: 151, protein: 12, carbs: 10, fat: 7,  emoji: '🍪', category: 'Snacks' },
  { id: 'p13', name: 'Banana',                       kcal: 89,  protein: 1,  carbs: 23, fat: 0,  emoji: '🍌', category: 'Snacks' },
  // Meals
  { id: 'p2',  name: 'Keto Pizza',                   kcal: 494, protein: 59, carbs: 6,  fat: 26, emoji: '🍕', category: 'Meals' },
  { id: 'p3',  name: 'Chicken Zucchini Pasta',       kcal: 337, protein: 35, carbs: 29, fat: 9,  emoji: '🍝', category: 'Meals' },
  { id: 'p8',  name: 'Malek Tawook — Chicken Meal',  kcal: 725, protein: 82, carbs: 42, fat: 24, emoji: '🍗', category: 'Meals' },
  // Build — per-100g cooked building blocks (multi-tap to scale to your portion)
  { id: 'p14', name: 'Rice — 100g',                  kcal: 130, protein: 3,  carbs: 28, fat: 0,  emoji: '🍚', category: 'Build' },
  { id: 'p15', name: 'Chicken — 100g',               kcal: 165, protein: 31, carbs: 0,  fat: 4,  emoji: '🍗', category: 'Build' },
  { id: 'p16', name: 'Beef — 100g',                  kcal: 217, protein: 26, carbs: 0,  fat: 12, emoji: '🥩', category: 'Build' },
  { id: 'p17', name: 'Salmon — 100g',                kcal: 206, protein: 22, carbs: 0,  fat: 13, emoji: '🐟', category: 'Build' },
  { id: 'p18', name: 'White Fish / Shrimp — 100g',   kcal: 100, protein: 22, carbs: 0,  fat: 1,  emoji: '🦐', category: 'Build' },
  { id: 'p19', name: 'Sweet Potato — 100g',          kcal: 90,  protein: 2,  carbs: 21, fat: 0,  emoji: '🍠', category: 'Build' },
  { id: 'p20', name: 'Potato — 100g',                kcal: 87,  protein: 2,  carbs: 20, fat: 0,  emoji: '🥔', category: 'Build' },
  { id: 'p21', name: 'Pasta — 100g',                 kcal: 158, protein: 6,  carbs: 31, fat: 1,  emoji: '🍝', category: 'Build' },
  { id: 'p22', name: 'Mixed Veggies — 100g',         kcal: 50,  protein: 3,  carbs: 10, fat: 0,  emoji: '🥦', category: 'Build' },
  { id: 'p23', name: 'Avocado — 100g',               kcal: 160, protein: 2,  carbs: 9,  fat: 15, emoji: '🥑', category: 'Build' },
  { id: 'p24', name: 'Olive Oil — 1 tbsp',           kcal: 119, protein: 0,  carbs: 0,  fat: 14, emoji: '🫒', category: 'Build' },
  // Drinks
  { id: 'p7',  name: 'Iced Almond Latte',            kcal: 30,  protein: 1,  carbs: 2,  fat: 2,  emoji: '☕', category: 'Drinks' },
]

const FoodCtx = createContext(null)
const nutrition = (item, partial = false) => {
  const values = Object.fromEntries(['kcal', 'protein', 'carbs', 'fat']
    .filter(key => !partial || key in item)
    .map(key => [key, Number(item[key] ?? 0)]))
  return Object.values(values).every(value => Number.isFinite(value) && value >= 0) ? values : null
}

export function FoodProvider({ children }) {
  const os = useOs()
  const [presets, setPresets] = usePersistentState('afd-presets', DEFAULT_PRESETS, Array.isArray)
  const [logs, setLogs] = usePersistentState('afd-food-log', {}, v => v && typeof v === 'object' && !Array.isArray(v))
  const [removed, setRemoved] = useState(null)
  const [syncSeen, setSyncSeen] = usePersistentState('afd-food-sync-seen', {}, value => value && typeof value === 'object' && !Array.isArray(value))

  const today = todayKey()
  const entries = useMemo(() => logs[today] || [], [logs, today])
  const totals = useMemo(() => entries.reduce(
    (a, e) => ({ kcal: a.kcal + e.kcal, protein: a.protein + (e.protein || 0), carbs: a.carbs + (e.carbs || 0), fat: a.fat + (e.fat || 0) }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  ), [entries])

  useEffect(() => {
    let cancelled = false
    fetch('/food-sync.json')
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
      .then(data => {
        if (cancelled || !data?.logs) return
        const incoming = Object.entries(data.logs).flatMap(([date, entries]) => Array.isArray(entries)
          ? entries.filter(entry => entry?.uid && !syncSeen[entry.uid] && nutrition(entry)).map(entry => ({ date, entry: { ...entry, ...nutrition(entry) } })) : [])
        if (!incoming.length) return
        setLogs(prev => {
          const next = { ...prev }
          let changed = false
          for (const { date, entry } of incoming) {
            if (!(next[date] || []).some(existing => existing.uid === entry.uid)) {
              next[date] = [...(next[date] || []), entry]
              changed = true
            }
          }
          return changed ? next : prev
        })
        setSyncSeen(previous => ({ ...previous, ...Object.fromEntries(incoming.map(({ entry }) => [entry.uid, true])) }))
      })
    return () => { cancelled = true }
  }, [syncSeen, setLogs, setSyncSeen])

  const addEntry = (item, day = todayKey()) => {
    const values = nutrition(item)
    if (!values) { os?.announce('Enter non-negative nutrition values', 'var(--down)'); return false }
    const uid = crypto.randomUUID()
    const entry = { ...item, ...values, time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }), uid }
    setLogs(prev => ({ ...prev, [day]: [...(prev[day] || []), entry] }))
    os?.announce(`FUEL +${item.kcal} kcal · ${item.protein || 0}P`, 'var(--acc-food)', {
      label: 'Undo',
      onClick: () => setLogs(previous => ({ ...previous, [day]: (previous[day] || []).filter(item => item.uid !== uid) }))
    })
  }
  const removeEntry = (uid, day = todayKey()) => {
    const ids = new Set(Array.isArray(uid) ? uid : [uid])
    const items = (logs[day] || []).map((entry, index) => ({ entry, index })).filter(item => ids.has(item.entry.uid))
    if (!items.length) return
    setRemoved({ day, items })
    setLogs(previous => ({ ...previous, [day]: (previous[day] || []).filter(entry => !ids.has(entry.uid)) }))
  }
  const undoRemoval = () => {
    if (!removed) return
    setLogs(previous => {
      const entries = [...(previous[removed.day] || [])]
      for (const { entry, index } of removed.items) {
        if (!entries.some(item => item.uid === entry.uid)) entries.splice(index, 0, entry)
      }
      return { ...previous, [removed.day]: entries }
    })
    setRemoved(null)
  }
  const updateEntry = (uid, patch, day = todayKey()) => {
    const values = nutrition(patch, true)
    if (!values) return false
    setLogs(previous => ({ ...previous, [day]: (previous[day] || []).map(entry => entry.uid === uid ? { ...entry, ...patch, ...values, uid: entry.uid } : entry) }))
  }
  const addPreset = item => {
    const values = nutrition(item)
    if (!values) return false
    setPresets(prev => [...prev, { ...item, ...values, id: crypto.randomUUID() }])
  }
  const removePreset = id => setPresets(prev => prev.filter(x => x.id !== id))
  const updatePreset = (id, patch) => {
    const values = nutrition(patch, true)
    if (!values) return false
    setPresets(prev => prev.map(p => (p.id === id ? { ...p, ...patch, ...values } : p)))
  }

  const value = {
    presets, entries, totals, logs,
    remaining: TARGETS.kcal - totals.kcal,
    proteinLeft: TARGETS.protein - totals.protein,
    addEntry, removeEntry, updateEntry, removed, undoRemoval, addPreset, removePreset, updatePreset,
  }
  return <FoodCtx.Provider value={value}>{children}</FoodCtx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useFood = () => useContext(FoodCtx)
