import { useEffect, useMemo, useRef, useState } from 'react'
import {
  LayoutGrid, UtensilsCrossed, Dumbbell, Wallet, Search, Plus, Settings,
  Sun, Moon, Monitor, CornerDownLeft, Command as CommandIcon,
} from 'lucide-react'
import { IconButton } from './primitives'
import OverviewPage from './pages/OverviewPage'
import FoodPage from './pages/FoodPage'
import FitnessPage from './pages/FitnessPage'
import FinancePage from './pages/FinancePage'

const NAV = [
  { id: 'today', label: 'Overview', Icon: LayoutGrid, hint: '⌘1' },
  { id: 'food', label: 'Food', Icon: UtensilsCrossed, hint: '⌘3' },
  { id: 'fitness', label: 'Fitness', Icon: Dumbbell, hint: '⌘4' },
  { id: 'finance', label: 'Finance', Icon: Wallet, hint: '⌘2' },
]

const PAGES = {
  today: OverviewPage,
  food: FoodPage,
  fitness: FitnessPage,
  finance: FinancePage,
}

function CommandPalette({ onClose, actions }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef(null)

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return actions
    return actions.filter(a => a.label.toLowerCase().includes(t) || (a.group || '').toLowerCase().includes(t))
  }, [q, actions])

  useEffect(() => { inputRef.current?.focus() }, [])

  const run = a => { onClose(); a.run() }

  const onKey = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(filtered.length - 1, s + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(0, s - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[sel]) run(filtered[sel]) }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  return (
    <div className="d-palette-backdrop" onMouseDown={onClose}>
      <div className="d-palette" onMouseDown={e => e.stopPropagation()} role="dialog" aria-label="Command palette">
        <div className="flex items-center gap-2.5 px-3.5 h-12 d-divider" style={{ borderTop: 'none', borderBottom: '1px solid var(--d-border)' }}>
          <Search size={16} className="d-t3 shrink-0" />
          <input ref={inputRef} value={q} onChange={e => { setQ(e.target.value); setSel(0) }} onKeyDown={onKey}
            placeholder="Search commands…" className="flex-1 bg-transparent outline-none text-[14px] d-t1" />
          <span className="d-kbd">esc</span>
        </div>
        <div className="max-h-[320px] d-scroll py-1.5">
          {filtered.length === 0 && <div className="px-4 py-6 text-center d-t3 text-[13px]">No matches</div>}
          {filtered.map((a, i) => (
            <button key={a.id} onMouseEnter={() => setSel(i)} onClick={() => run(a)}
              className="w-full flex items-center gap-3 px-3.5 py-2 text-left"
              style={{ background: i === sel ? 'var(--d-accent-weak)' : 'transparent', color: i === sel ? 'var(--d-accent)' : 'var(--d-text)' }}>
              {a.Icon && <a.Icon size={15} strokeWidth={2.1} className="shrink-0" />}
              <span className="flex-1 text-[13px] font-medium">{a.label}</span>
              {a.group && <span className="text-[11px] d-t3">{a.group}</span>}
              {i === sel && <CornerDownLeft size={13} className="d-t3" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function DesktopApp({
  tab,
  onTabChange,
  dark,
  onToggleTheme,
  onOpenSettings,
  onOpenLog,
  shellMode,
  nextShellLabel,
  onCycleShell,
}) {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const activeNav = NAV.find(n => n.id === tab) || NAV[0]
  const Page = PAGES[tab] || OverviewPage
  const now = new Date()

  useEffect(() => {
    const onKey = e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(o => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const actions = useMemo(() => [
    ...NAV.map(n => ({ id: `go-${n.id}`, label: `Go to ${n.label}`, group: 'Navigate', Icon: n.Icon, run: () => onTabChange(n.id) })),
    { id: 'log', label: 'Log a meal', group: 'Action', Icon: Plus, run: onOpenLog },
    { id: 'theme', label: dark ? 'Switch to light theme' : 'Switch to dark theme', group: 'Action', Icon: dark ? Sun : Moon, run: onToggleTheme },
    { id: 'shell', label: `Shell mode → ${nextShellLabel}`, group: 'Action', Icon: Monitor, run: onCycleShell },
    { id: 'settings', label: 'Open settings', group: 'Action', Icon: Settings, run: onOpenSettings },
  ], [dark, nextShellLabel, onTabChange, onOpenLog, onToggleTheme, onCycleShell, onOpenSettings])

  return (
    <div className="dsk h-dvh w-full flex" style={{ background: 'var(--d-bg)' }}>
      {/* Sidebar */}
      <aside className="w-[232px] shrink-0 flex flex-col px-3 py-4 d-divider-l" style={{ borderLeft: 'none', borderRight: '1px solid var(--d-border)' }}>
        <div className="flex items-center gap-2.5 px-2 pb-4">
          <span className="grid place-items-center w-8 h-8 rounded-[9px]" style={{ background: 'var(--d-accent)', color: 'var(--d-on-accent)' }}>
            <CommandIcon size={17} strokeWidth={2.4} />
          </span>
          <div className="leading-tight">
            <div className="text-[14px] font-semibold d-t1">AFD OS</div>
            <div className="text-[11px] d-t3">Personal dashboard</div>
          </div>
        </div>

        <button onClick={() => setPaletteOpen(true)}
          className="d-input flex items-center gap-2 mb-3 text-left" style={{ cursor: 'text' }}>
          <Search size={14} className="d-t3" />
          <span className="flex-1 text-[13px] d-t3">Search…</span>
          <span className="d-kbd">⌘K</span>
        </button>

        <nav className="flex flex-col gap-0.5" aria-label="Sections">
          {NAV.map(n => (
            <button key={n.id} onClick={() => onTabChange(n.id)} aria-current={tab === n.id ? 'page' : undefined}
              className={`d-nav ${tab === n.id ? 'd-nav-active' : ''}`}>
              <n.Icon size={16} strokeWidth={2.1} />
              <span className="flex-1">{n.label}</span>
              <span className="text-[11px] d-t3">{n.hint}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto flex items-center gap-1.5">
          <button onClick={onCycleShell} className="d-nav flex-1" title={`Switch shell → ${nextShellLabel}`}>
            <Monitor size={16} strokeWidth={2.1} />
            <span className="flex-1">Shell</span>
            <span className="text-[11px] d-t3">{shellMode}</span>
          </button>
          <IconButton icon={Settings} onClick={onOpenSettings} aria-label="Settings" />
          <IconButton icon={dark ? Sun : Moon} onClick={onToggleTheme} aria-label="Toggle theme" />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 flex flex-col">
        <header className="h-[60px] shrink-0 flex items-center justify-between gap-4 px-6 d-divider" style={{ borderTop: 'none', borderBottom: '1px solid var(--d-border)' }}>
          <div className="min-w-0">
            {tab !== 'food' && <div className="d-eyebrow">{now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>}
            <h1 className="text-[19px] font-semibold d-t1 leading-tight">{activeNav.label}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPaletteOpen(true)} className="d-btn d-btn-outline d-btn-sm">
              <Search size={13} /> Search <span className="d-kbd">⌘K</span>
            </button>
          </div>
        </header>

        <div className="flex-1 min-h-0 d-scroll">
          <div className="max-w-[1440px] mx-auto px-7 py-6">
            <Page onNavigate={onTabChange} onOpenLog={onOpenLog} dark={dark} />
          </div>
        </div>
      </main>

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} actions={actions} />}
    </div>
  )
}
