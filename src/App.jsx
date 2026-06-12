import { useEffect, useRef, useState } from 'react'
import { LayoutGrid, Wallet, UtensilsCrossed, Dumbbell, Sun, Moon, Plus, Check, Sparkles, Settings, Download, Upload } from 'lucide-react'
import { OsProvider, useOs } from './os'
import { QuotesProvider } from './quotes'
import { FoodProvider, useFood } from './store'
import { Sheet } from './ui'
import { FoodIcon } from './screens/Food'
import Today from './screens/Today'
import Finance from './screens/Finance'
import Food from './screens/Food'
import Fitness from './screens/Fitness'
import { useClock, usePersistentState } from './hooks'
import { exportData, importData } from './backup'

const TABS = [
  { id: 'today', label: 'Today', Icon: LayoutGrid, acc: 'var(--acc-os)', ambient: '#7C9EFF' },
  { id: 'finance', label: 'Finance', Icon: Wallet, acc: 'var(--acc-fin)', ambient: '#60A5FA' },
  { id: 'food', label: 'Food', Icon: UtensilsCrossed, acc: 'var(--acc-food)', ambient: '#34D399' },
  { id: 'fitness', label: 'Fitness', Icon: Dumbbell, acc: 'var(--acc-fit)', ambient: '#22D3EE' },
]

function QuickLog({ open, onClose }) {
  const { presets, addEntry, remaining, proteinLeft } = useFood()
  const [flash, setFlash] = useState(null)

  const log = p => {
    addEntry(p)
    setFlash(p.id)
    setTimeout(() => setFlash(f => (f === p.id ? null : f)), 900)
  }

  return (
    <Sheet open={open} onClose={onClose} title="Quick log">
      <div className="flex items-center justify-between mb-4 panel-2 rounded-2xl px-4 py-3" style={{ '--acc': 'var(--acc-food)' }}>
        <div>
          <span className="display text-[30px] leading-none font-bold t1">{Math.max(0, remaining).toLocaleString()}</span>
          <span className="mono text-[10px] tracking-[0.18em] uppercase t3 ml-2">kcal left</span>
        </div>
        <div className="text-right">
          <span className="display text-[30px] leading-none font-bold t1">{Math.max(0, proteinLeft)}</span>
          <span className="mono text-[10px] tracking-[0.18em] uppercase t3 ml-2">g prot left</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5" style={{ '--acc': 'var(--acc-food)' }}>
        {presets.map(p => (
          <button key={p.id} onClick={() => log(p)}
            className={`press rounded-2xl p-4 text-left ${flash === p.id ? 'acc-chip' : 'chip'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center acc-chip">
                {flash === p.id ? <Check size={15} strokeWidth={3} /> : <FoodIcon emoji={p.emoji} size={15} />}
              </span>
              {flash === p.id && <span className="mono text-[9px] tracking-[0.18em] uppercase acc">logged</span>}
            </div>
            <div className="text-[13px] font-bold leading-tight t1">{p.name}</div>
            <div className="mono text-[10px] t3 mt-1.5">{p.kcal} kcal · {p.protein}P</div>
          </button>
        ))}
      </div>
    </Sheet>
  )
}

function SettingsSheet({ open, onClose }) {
  const { announce } = useOs()
  const fileRef = useRef(null)
  const [msg, setMsg] = useState(null)

  const onExport = () => {
    exportData()
    announce('BACKUP EXPORTED')
  }

  const onImportFile = async e => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const n = await importData(file)
      setMsg({ ok: true, text: `Restored ${n} dataset${n === 1 ? '' : 's'} · reloading…` })
      setTimeout(() => window.location.reload(), 700)
    } catch (err) {
      setMsg({ ok: false, text: err.message || 'Import failed' })
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Settings">
      <div className="space-y-3" style={{ '--acc': 'var(--acc-os)' }}>
        <p className="text-[13px] t2 leading-relaxed">
          Your data lives only on this device. Export a backup regularly — or to move to a new device.
        </p>
        <button onClick={onExport}
          className="press w-full chip rounded-2xl px-4 py-3.5 flex items-center gap-3 text-left">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center acc-chip"><Download size={16} strokeWidth={2.25} /></span>
          <span>
            <span className="block text-sm font-bold t1">Export backup</span>
            <span className="block mono text-[10px] t3 mt-0.5">Download a .json snapshot</span>
          </span>
        </button>
        <button onClick={() => fileRef.current?.click()}
          className="press w-full chip rounded-2xl px-4 py-3.5 flex items-center gap-3 text-left">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center acc-chip"><Upload size={16} strokeWidth={2.25} /></span>
          <span>
            <span className="block text-sm font-bold t1">Restore backup</span>
            <span className="block mono text-[10px] t3 mt-0.5">Import a previously exported file</span>
          </span>
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onImportFile} aria-label="Backup file" />
        {msg && <p className={`mono text-[11px] ${msg.ok ? 'up' : 'down'}`} role="status">{msg.text}</p>}
      </div>
    </Sheet>
  )
}

function Island({ dark, onTheme, onSettings }) {
  const { toast } = useOs()
  const now = useClock()

  return (
    <div className={`dock island rounded-2xl px-4 py-3 ${toast ? 'island-live' : ''}`}
      style={toast ? { '--toast-acc': toast.acc } : {}}>
      <div className="island-idle flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--acc-food)', boxShadow: '0 0 8px var(--acc-food)' }} aria-hidden="true" />
          <span className="display text-[19px] font-bold tracking-[0.06em] t1 uppercase">AFD&nbsp;OS</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="mono text-[10px] tracking-[0.14em] uppercase t3">
            {now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
          </span>
          <button onClick={onSettings}
            className="press w-8 h-8 rounded-lg chip flex items-center justify-center t2" aria-label="Settings">
            <Settings size={14} strokeWidth={2.5} />
          </button>
          <button onClick={onTheme}
            className="press w-8 h-8 rounded-lg chip flex items-center justify-center t2" aria-label="Toggle theme">
            {dark ? <Sun size={14} strokeWidth={2.5} /> : <Moon size={14} strokeWidth={2.5} />}
          </button>
        </div>
      </div>
      <div className="island-toast" role="status" aria-live="polite">
        {toast && (
          <>
            <Sparkles size={13} strokeWidth={2.5} style={{ color: toast.acc }} />
            <span className="mono text-[11px] tracking-[0.16em] uppercase t1">{toast.text}</span>
          </>
        )}
      </div>
    </div>
  )
}

function Shell() {
  const [tab, setTab] = useState('today')
  const [logOpen, setLogOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [drag, setDrag] = useState(0)
  const [dragging, setDragging] = useState(false)
  const touch = useRef(null)
  const [dark, setDark] = usePersistentState('afd-theme-dark', true, v => typeof v === 'boolean')

  const idx = TABS.findIndex(t => t.id === tab)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  // Keyboard navigation between modules
  useEffect(() => {
    const onKey = e => {
      if (logOpen || settingsOpen) return
      if (e.key === 'ArrowRight' && idx < TABS.length - 1) setTab(TABS[idx + 1].id)
      if (e.key === 'ArrowLeft' && idx > 0) setTab(TABS[idx - 1].id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [idx, logOpen, settingsOpen])

  // Swipe between modules — finger-following with edge damping
  const onTouchStart = e => {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, locked: null }
    setDragging(true)
  }
  const onTouchMove = e => {
    if (!touch.current) return
    const dx = e.touches[0].clientX - touch.current.x
    const dy = e.touches[0].clientY - touch.current.y
    if (touch.current.locked === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      touch.current.locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    }
    if (touch.current.locked !== 'x') return
    const atEdge = (idx === 0 && dx > 0) || (idx === TABS.length - 1 && dx < 0)
    setDrag(atEdge ? dx / 3 : dx)
  }
  const onTouchEnd = () => {
    if (touch.current?.locked === 'x' && Math.abs(drag) > 56) {
      const next = idx + (drag < 0 ? 1 : -1)
      if (next >= 0 && next < TABS.length) setTab(TABS[next].id)
    }
    touch.current = null
    setDrag(0)
    setDragging(false)
  }

  return (
    <div className="h-dvh w-full max-w-md mx-auto relative flex flex-col">
      <div className="ambient" style={{ '--ambient': TABS[idx].ambient }} aria-hidden="true" />

      {/* Island header */}
      <header className="flex-shrink-0 z-50 px-5 pt-4 pb-2">
        <Island dark={dark} onTheme={() => setDark(!dark)} onSettings={() => setSettingsOpen(true)} />
      </header>

      {/* Module carousel */}
      <div className="flex-1 overflow-hidden" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <div className={`carousel ${dragging && drag !== 0 ? 'dragging' : ''}`}
          style={{ transform: `translateX(calc(${-idx * 100}% + ${drag}px))` }}>
          {TABS.map(t => (
            <div key={t.id} className="w-full h-full flex-shrink-0 min-w-0 screen-scroll px-5 pt-2 pb-36"
              aria-hidden={t.id !== tab} inert={t.id !== tab ? true : undefined}>
              <div className="boot space-y-4">
                {t.id === 'today' && <Today goTo={setTab} openLog={() => setLogOpen(true)} />}
                {t.id === 'finance' && <Finance />}
                {t.id === 'food' && <Food />}
                {t.id === 'fitness' && <Fitness />}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dock + FAB */}
      <nav className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3" aria-label="Modules">
        <div className="dock dock-track rounded-[24px] p-1 flex" style={{ '--acc': TABS[idx].acc }}>
          <span className="dock-pill" style={{ width: 70, transform: `translateX(${idx * 70}px)` }} aria-hidden="true" />
          {TABS.map(t => {
            const active = tab === t.id
            return (
              <button key={t.id} onClick={() => setTab(t.id)} aria-label={t.label} aria-current={active ? 'page' : undefined}
                className="dock-btn flex flex-col items-center gap-1 pt-2.5 pb-2 rounded-xl w-[70px]"
                style={{ color: active ? t.acc : 'var(--ink-3)' }}>
                <t.Icon size={19} strokeWidth={active ? 2.5 : 2} />
                <span className="mono text-[8px] tracking-[0.16em] uppercase">{t.label}</span>
              </button>
            )
          })}
        </div>
        <button onClick={() => setLogOpen(true)} aria-label="Quick log food"
          className="fab w-[52px] h-[52px] rounded-2xl flex items-center justify-center">
          <Plus size={22} strokeWidth={2.75} />
        </button>
      </nav>

      <QuickLog open={logOpen} onClose={() => setLogOpen(false)} />
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}

export default function App() {
  return (
    <OsProvider>
      <QuotesProvider>
        <FoodProvider>
          <Shell />
        </FoodProvider>
      </QuotesProvider>
    </OsProvider>
  )
}
