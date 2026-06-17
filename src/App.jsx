import { useEffect, useRef, useState } from 'react'
import { LayoutGrid, Wallet, UtensilsCrossed, Dumbbell, Sun, Moon, Check, Sparkles, Settings, Download, Upload, ArrowUp, Target } from 'lucide-react'
import { OsProvider, useOs } from './os'
import { QuotesProvider } from './quotes'
import { FoodProvider, useFood } from './store'
import { CloudProvider, CloudStatus } from './cloud'
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
const DOCK_ITEM_WIDTH = 62

/** Natural-language logging: describe a meal, Claude estimates the macros. */
// Removed NLLog as requested.

function QuickLog({ open, onClose }) {
  const { presets, addEntry, remaining, proteinLeft } = useFood()
  const [flash, setFlash] = useState(null)
  
  const [form, setForm] = useState({ name: '', kcal: '', protein: '', carbs: '', fat: '' })

  const log = p => {
    addEntry(p)
    setFlash(p.id)
    setTimeout(() => setFlash(f => (f === p.id ? null : f)), 900)
  }

  const logManual = (e) => {
    e.preventDefault()
    if (!form.kcal) return
    const entry = {
      name: form.name || 'Quick log',
      kcal: +form.kcal || 0,
      protein: +form.protein || 0,
      carbs: +form.carbs || 0,
      fat: +form.fat || 0,
      emoji: '🍽️'
    }
    const id = 'temp-' + Date.now()
    log({ ...entry, id })
    setForm({ name: '', kcal: '', protein: '', carbs: '', fat: '' })
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
      
      {/* Manual Entry Form */}
      <form onSubmit={logManual} className="mb-4 space-y-2 panel-2 rounded-2xl p-3" style={{ '--acc': 'var(--acc-food)' }}>
        <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
          placeholder="What did you eat?" className="field w-full rounded-xl px-3 py-2 text-sm outline-none" />
        <div className="flex gap-2">
          <input value={form.kcal} onChange={e => setForm({...form, kcal: e.target.value})}
            placeholder="kcal" type="number" inputMode="numeric" required className="field flex-1 rounded-xl px-3 py-2 text-sm outline-none" />
          <input value={form.protein} onChange={e => setForm({...form, protein: e.target.value})}
            placeholder="P" type="number" inputMode="numeric" className="field flex-1 rounded-xl px-3 py-2 text-sm outline-none" />
          <input value={form.carbs} onChange={e => setForm({...form, carbs: e.target.value})}
            placeholder="C" type="number" inputMode="numeric" className="field flex-1 rounded-xl px-3 py-2 text-sm outline-none" />
          <input value={form.fat} onChange={e => setForm({...form, fat: e.target.value})}
            placeholder="F" type="number" inputMode="numeric" className="field flex-1 rounded-xl px-3 py-2 text-sm outline-none" />
          <button type="submit" disabled={!form.kcal} aria-label="Log manually"
            className="press acc-chip rounded-xl w-10 flex items-center justify-center disabled:opacity-30">
            <ArrowUp size={16} strokeWidth={2.5} />
          </button>
        </div>
      </form>

      <div className="panel rounded-2xl overflow-hidden" style={{ '--acc': 'var(--acc-food)' }}>
        {presets.map((p, i) => (
          <button key={p.id} onClick={() => log(p)}
            className={`press w-full flex items-center gap-3 px-4 py-3 text-left ${flash === p.id ? 'acc-chip' : ''} ${i > 0 ? 'hairline-t' : ''}`}>
            <span className="w-8 h-8 flex-shrink-0 rounded-xl flex items-center justify-center acc-chip text-[15px]">
              {flash === p.id ? <Check size={14} strokeWidth={3} className="acc" /> : <FoodIcon emoji={p.emoji} size={15} />}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[13px] font-semibold t1 truncate">{p.name}</span>
              <span className="mono text-[10px] t3">{p.kcal} kcal</span>
            </span>
            <span className="flex-shrink-0 flex gap-1.5 items-center">
              {flash === p.id
                ? <span className="mono text-[9px] tracking-[0.16em] uppercase acc">logged</span>
                : <>
                    <span className="mono text-[10px] acc font-semibold">{p.protein}P</span>
                    <span className="mono text-[10px] t3">{p.carbs}C</span>
                    <span className="mono text-[10px] t3">{p.fat}F</span>
                  </>
              }
            </span>
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
  const [adaptive, setAdaptive] = usePersistentState('afd-whoop-adaptive', true, v => typeof v === 'boolean')

  const onExport = () => {
    exportData()
    announce('BACKUP EXPORTED')
  }

  const onImportFile = async e => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!window.confirm('This will completely overwrite your current local data. Are you sure you want to restore from this backup?')) return
    if (navigator.vibrate) navigator.vibrate([100, 100, 100])
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
        <CloudStatus />
        <p className="text-[13px] t2 leading-relaxed">
          Your data lives only on this device. Export a backup regularly — or to move to a new device.
        </p>
        <button onClick={() => setAdaptive(v => !v)} role="switch" aria-checked={adaptive}
          className="press w-full chip rounded-2xl px-4 py-3.5 flex items-center gap-3 text-left">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center acc-chip"><Target size={16} strokeWidth={2.25} /></span>
          <span className="flex-1">
            <span className="block text-sm font-bold t1">Adaptive intake guidance</span>
            <span className="block mono text-[10px] t3 mt-0.5">WHOOP burn projection &amp; recommended calories</span>
          </span>
          <span className={`w-10 h-6 rounded-full flex-shrink-0 relative transition-colors ${adaptive ? 'acc-chip' : 'chip'}`} style={{ borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--line)' }}>
            <span className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full transition-all ${adaptive ? 'left-[18px]' : 'left-1'}`}
              style={{ background: adaptive ? 'var(--acc)' : 'var(--ink-3)' }} />
          </span>
        </button>
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
  const { toast, timer, cancelTimer } = useOs()
  const now = useClock()

  const formatTimer = () => {
    if (!timer) return ''
    const left = timer.remaining ?? 0
    const m = Math.floor(left / 60)
    const s = left % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className={`dock island rounded-2xl px-4 py-3 ${toast ? 'island-live' : ''}`}
      style={toast ? { '--toast-acc': toast.acc } : {}}>
      <div className="island-idle flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--acc-food)', boxShadow: '0 0 8px var(--acc-food)' }} aria-hidden="true" />
          <span className="display text-[19px] font-bold tracking-[0.06em] t1 uppercase">AFD&nbsp;OS</span>
        </div>
        <div className="flex items-center gap-2">
          {timer && (
            <button onClick={cancelTimer} className="mono text-[10px] tracking-[0.1em] text-[var(--acc-fit)] mr-2 flex items-center gap-1.5 press">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--acc-fit)] animate-pulse" />
              {formatTimer()}
            </button>
          )}
          {!timer && (
            <span className="mono text-[10px] tracking-[0.1em] uppercase t3 mr-0.5 whitespace-nowrap">
              {now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
            </span>
          )}
          <button onClick={onSettings}
            className="press w-9 h-9 rounded-xl chip t1 flex items-center justify-center border"
            style={{ borderColor: 'var(--line)' }} aria-label="Settings">
            <Settings size={16} strokeWidth={2.5} />
          </button>
          <button onClick={onTheme}
            className="press w-9 h-9 rounded-xl chip t1 flex items-center justify-center border"
            style={{ borderColor: 'var(--line)' }} aria-label="Toggle theme">
            {dark ? <Sun size={16} strokeWidth={2.5} /> : <Moon size={16} strokeWidth={2.5} />}
          </button>
        </div>
      </div>
      <div className="island-toast" role="status" aria-live="polite">
        {toast && (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Sparkles size={13} strokeWidth={2.5} style={{ color: toast.acc }} />
              <span className="mono text-[11px] tracking-[0.16em] uppercase t1">{toast.text}</span>
            </div>
            {toast.action && (
              <button onClick={toast.action.onClick}
                className="press mono text-[10px] tracking-[0.1em] uppercase font-bold px-2 py-1 rounded chip"
                style={{ color: toast.acc }}>
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Shell() {
  // Persisted so an iOS PWA reload (e.g. after backgrounding) resumes on the same tab.
  const [tab, setTab] = usePersistentState('afd-tab', 'today', v => TABS.some(t => t.id === v))
  const [logOpen, setLogOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [dark, setDark] = usePersistentState('afd-theme-dark', true, v => typeof v === 'boolean')
  const [kbOpen, setKbOpen] = useState(false)
  const [drag, setDrag] = useState(0)
  const [dragging, setDragging] = useState(false)
  const touch = useRef(null)

  const idx = TABS.findIndex(t => t.id === tab)

  const handleTabChange = (newTabId) => {
    setTab(newTabId)
  }

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  useEffect(() => {
    if (!window.visualViewport) return
    const onResize = () => {
      setKbOpen(window.visualViewport.height < window.innerHeight * 0.8)
    }
    window.visualViewport.addEventListener('resize', onResize)
    return () => window.visualViewport.removeEventListener('resize', onResize)
  }, [])

  // Keyboard navigation between modules
  useEffect(() => {
    const onKey = e => {
      if (logOpen || settingsOpen) return
      if (e.key === 'ArrowRight' && idx < TABS.length - 1) handleTabChange(TABS[idx + 1].id)
      if (e.key === 'ArrowLeft' && idx > 0) handleTabChange(TABS[idx - 1].id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [idx, logOpen, settingsOpen])

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
      if (next >= 0 && next < TABS.length) handleTabChange(TABS[next].id)
    }
    touch.current = null
    setDrag(0)
    setDragging(false)
  }

  return (
    <div className="h-dvh w-full max-w-md mx-auto relative flex flex-col">
      <div className="ambient" style={{ '--ambient': TABS[idx].ambient }} aria-hidden="true" />

      {/* Island header */}
      <header className="app-header flex-shrink-0 z-50 px-5 pb-2">
        <Island dark={dark} onTheme={() => setDark(!dark)} onSettings={() => setSettingsOpen(true)} />
      </header>

      {/* Module carousel */}
      <div className="flex-1 overflow-hidden relative" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <div className={`carousel ${dragging && drag !== 0 ? 'dragging' : ''}`}
          style={{ transform: `translateX(calc(${-idx * 100}% + ${drag}px))` }}>
          {TABS.map(t => (
            <div key={t.id} className="w-full h-full flex-shrink-0 min-w-0 screen-scroll px-5 pt-2 pb-36"
              aria-hidden={t.id !== tab} inert={t.id !== tab ? true : undefined}>
              <div className="boot space-y-4">
                {t.id === 'today' && <Today goTo={handleTabChange} openLog={() => setLogOpen(true)} />}
                {t.id === 'finance' && <Finance />}
                {t.id === 'food' && <Food />}
                {t.id === 'fitness' && <Fitness />}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dock */}
      <nav className={`app-dock fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 transition-opacity ${kbOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} aria-label="Modules">
        <div className="dock dock-track rounded-[24px] p-1 flex" style={{ '--acc': TABS[idx].acc }}>
          <span className="dock-pill" style={{ width: DOCK_ITEM_WIDTH, transform: `translateX(${idx * DOCK_ITEM_WIDTH}px)` }} aria-hidden="true" />
          {TABS.map(t => {
            const active = tab === t.id
            return (
              <button key={t.id} onClick={() => handleTabChange(t.id)} aria-label={t.label} aria-current={active ? 'page' : undefined}
                className="dock-btn flex flex-col items-center gap-1 pt-2 pb-1.5 rounded-xl w-[62px]"
                style={{ color: active ? t.acc : 'var(--ink-3)' }}>
                <t.Icon size={18} strokeWidth={active ? 2.5 : 2} />
                <span className="mono text-[7px] tracking-[0.12em] uppercase">{t.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      <QuickLog open={logOpen} onClose={() => setLogOpen(false)} />
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}

export default function App() {
  return (
    <CloudProvider>
      <OsProvider>
        <QuotesProvider>
          <FoodProvider>
            <Shell />
          </FoodProvider>
        </QuotesProvider>
      </OsProvider>
    </CloudProvider>
  )
}
