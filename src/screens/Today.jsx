import { useEffect, useState } from 'react'
import TodayPulse from '../TodayPulse'
import TrajectoryHome from '../TrajectoryHome'
import { useHomeGoals } from '../useHomeGoals'
import { useClock } from '../hooks'
import { fetchWhoopCalories, fetchWhoopCycles, WHOOP_POLL_MS } from '../whoop'

function OriginalToday({ goTo, whoop, cycles }) {
  const now = useClock()
  return (
    <div className="today-flagship">
      <header className="today-head">
        <div><h1 className="today-eyebrow" style={{ '--acc': 'var(--acc-os)' }}>Today</h1><div className="today-date">{now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).replace(',', '').replace(' ', ' · ').toUpperCase()}</div></div>
        <div className="today-head-actions">
          <div className="today-avatar" aria-hidden="true">A</div>
        </div>
      </header>
      <TodayPulse onNavigate={goTo} whoop={whoop} cycles={cycles} />
    </div>
  )
}

export default function Today(props) {
  const [home] = useHomeGoals()
  const [whoop, setWhoop] = useState(null)
  const [cycles, setCycles] = useState(null)
  useEffect(() => {
    let alive = true
    const load = async () => {
      const [result, history] = await Promise.all([fetchWhoopCalories(), fetchWhoopCycles()])
      if (alive) { setWhoop(result); setCycles(history) }
    }
    const refresh = () => { if (document.visibilityState === 'visible') void load() }
    void load()
    const timer = setInterval(refresh, WHOOP_POLL_MS)
    document.addEventListener('visibilitychange', refresh)
    return () => { alive = false; clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  return home.view === 'classic' ? <OriginalToday {...props} whoop={whoop} cycles={cycles} /> : <TrajectoryHome {...props} whoop={whoop} />
}