import { createContext, useContext, useMemo } from 'react'
import { TARGETS } from './data'
import { useOs } from './os'
import { usePersistentState } from './hooks'

const DEFAULT_PRESETS = [
  { id: 'p1', name: 'Beef-XP Isolate (30g)', kcal: 114, protein: 28, carbs: 0, fat: 0, emoji: '🥤' },
  { id: 'p2', name: 'Keto Pizza', kcal: 494, protein: 59, carbs: 6, fat: 26, emoji: '🍕' },
  { id: 'p3', name: 'Chicken Zucchini Pasta', kcal: 337, protein: 35, carbs: 29, fat: 9, emoji: '🍝' },
  { id: 'p4', name: 'Protein Marble Brownie', kcal: 325, protein: 22, carbs: 22, fat: 13, emoji: '🍫' },
  { id: 'p5', name: 'Chocolate Protein Brownie', kcal: 165, protein: 12, carbs: 18, fat: 5, emoji: '🧁' },
  { id: 'p6', name: 'White Choc Protein Cookie', kcal: 151, protein: 12, carbs: 10, fat: 7, emoji: '🍪' },
]

const todayKey = () => new Date().toISOString().slice(0, 10)

const FoodCtx = createContext(null)

export function FoodProvider({ children }) {
  const os = useOs()
  const [presets, setPresets] = usePersistentState('afd-presets', DEFAULT_PRESETS, Array.isArray)
  const [logs, setLogs] = usePersistentState('afd-food-log', {}, v => v && typeof v === 'object' && !Array.isArray(v))

  const today = todayKey()
  const entries = useMemo(() => logs[today] || [], [logs, today])
  const totals = useMemo(() => entries.reduce(
    (a, e) => ({ kcal: a.kcal + e.kcal, protein: a.protein + (e.protein || 0), carbs: a.carbs + (e.carbs || 0), fat: a.fat + (e.fat || 0) }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  ), [entries])

  const addEntry = item => {
    const entry = { ...item, time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }), uid: Date.now() + Math.random() }
    setLogs(prev => ({ ...prev, [today]: [...(prev[today] || []), entry] }))
    os?.announce(`FUEL +${item.kcal} kcal · ${item.protein || 0}P`)
  }
  const removeEntry = uid => setLogs(prev => ({ ...prev, [today]: (prev[today] || []).filter(e => e.uid !== uid) }))
  const addPreset = item => setPresets(prev => [...prev, { ...item, id: 'p' + Date.now() }])
  const removePreset = id => setPresets(prev => prev.filter(x => x.id !== id))

  const value = {
    presets, entries, totals, logs,
    remaining: TARGETS.kcal - totals.kcal,
    proteinLeft: TARGETS.protein - totals.protein,
    addEntry, removeEntry, addPreset, removePreset,
  }
  return <FoodCtx.Provider value={value}>{children}</FoodCtx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useFood = () => useContext(FoodCtx)
