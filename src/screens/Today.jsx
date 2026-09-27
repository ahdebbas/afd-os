import { useEffect, useState } from 'react'
import { Moon, Settings2, Sun } from 'lucide-react'
import TodayPulse from '../TodayPulse'
import { useClock } from '../hooks'
import { fetchWhoopCalories, WHOOP_POLL_MS } from '../whoop'

export default function Today({ goTo, onOpenSettings, dark, onToggleTheme }) {
  const now = useClock()
  const [whoop, setWhoop] = useState(null)
  useEffect(() => {
    let alive = true
    const load = async () => {
      const result = await fetchWhoopCalories()
      if (alive) setWhoop(result)
    }
    void load()
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void load() }, WHOOP_POLL_MS)
    return () => { alive = false; clearInterval(timer) }
  }, [])
  return (
    <div className="today-flagship">
      <header className="today-head">
        <div><h1 className="pulse-page-title">Today</h1><p className="pulse-page-date">{now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p></div>
        <div className="today-head-actions">
          <button onClick={onToggleTheme} className="today-gear press" title={dark ? 'Light theme' : 'Dark theme'} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
          <button onClick={onOpenSettings} className="today-gear press" title="Settings" aria-label="Settings"><Settings2 size={18} /></button>
        </div>
      </header>
      <TodayPulse onNavigate={goTo} whoop={whoop} />
    </div>
  )
}