import { useEffect, useState } from 'react'
import { Moon, Settings2, Sun } from 'lucide-react'
import TodayPulse from '../TodayPulse'
import { useClock } from '../hooks'
import { fetchWhoopCalories, fetchWhoopCycles, WHOOP_POLL_MS } from '../whoop'

export default function Today({ goTo, onOpenSettings, dark, onToggleTheme }) {
  const now = useClock()
  const [whoop, setWhoop] = useState(null)
  const [cycles, setCycles] = useState(null)
  useEffect(() => {
    let alive = true
    const load = async () => {
      const [result, history] = await Promise.all([fetchWhoopCalories(), fetchWhoopCycles()])
      if (alive) { setWhoop(result); setCycles(history) }
    }
    void load()
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void load() }, WHOOP_POLL_MS)
    return () => { alive = false; clearInterval(timer) }
  }, [])
  return (
    <div className="today-flagship">
      <header className="today-head">
        <div><h1 className="today-eyebrow" style={{ '--acc': 'var(--acc-os)' }}>Today</h1><div className="today-date">{now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).replace(',', '').replace(' ', ' · ').toUpperCase()}</div></div>
        <div className="today-head-actions">
          <button onClick={onToggleTheme} className="today-gear press" title={dark ? 'Light theme' : 'Dark theme'} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
          <button onClick={onOpenSettings} className="today-gear press" title="Settings" aria-label="Settings"><Settings2 size={18} /></button>
          <div className="today-avatar" aria-hidden="true">A</div>
        </div>
      </header>
      <TodayPulse onNavigate={goTo} whoop={whoop} cycles={cycles} />
    </div>
  )
}