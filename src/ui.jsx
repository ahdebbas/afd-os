import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

/** Odometer: digits roll vertically into place on mount and on change. */
export function Odometer({ value, format = v => Math.round(v).toLocaleString('en-US'), className = '' }) {
  const target = format(value)
  const [shown, setShown] = useState(() => target.replace(/[0-9]/g, '0'))

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(target))
    return () => cancelAnimationFrame(id)
  }, [target])

  return (
    <span className={`odo ${className}`} aria-label={target} role="text">
      {shown.split('').map((ch, i) =>
        /[0-9]/.test(ch) ? (
          <span key={i} className="odo-d" aria-hidden="true">
            <span className="odo-reel" style={{ transform: `translateY(-${ch}em)` }}>
              {DIGITS.map(n => <span key={n} className="odo-n">{n}</span>)}
            </span>
          </span>
        ) : (
          <span key={i} aria-hidden="true">{ch}</span>
        )
      )}
    </span>
  )
}

const polar = (cx, cy, r, deg) => {
  const rad = ((deg - 90) * Math.PI) / 180
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
}
const arcPath = (cx, cy, r, a0, a1) => {
  const [x0, y0] = polar(cx, cy, r, a0)
  const [x1, y1] = polar(cx, cy, r, a1)
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

/**
 * 270° instrument gauge. Dashed track, glowing value arc, tip marker.
 * `pct` 0..1 — color defaults to the module accent via --acc.
 */
export function Gauge({ pct, size = 170, stroke = 11, color = 'var(--acc)', label, children }) {
  const clamped = Math.max(0, Math.min(1, pct))
  const r = (size - stroke - 8) / 2
  const c = size / 2
  const START = -135
  const SWEEP = 270
  const d = arcPath(c, c, r, START, START + SWEEP)
  const [tx, ty] = polar(c, c, r, START + SWEEP * clamped)

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}
      role="progressbar" aria-valuenow={Math.round(clamped * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <path d={d} fill="none" stroke="var(--track)" strokeWidth={stroke * 0.55} strokeLinecap="butt"
          pathLength="100" strokeDasharray="0.35 1.3" />
        {/* gap 200 > pathLength so the dash never repeats (a repeat paints a phantom dot at the arc end) */}
        <path d={d} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          pathLength="100" strokeDasharray={`${clamped * 100} 200`}
          className="gauge-val" style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
        <circle cx={tx} cy={ty} r={stroke / 2 + 2.5} fill="var(--surface)" stroke={color} strokeWidth="2.5"
          style={{ filter: `drop-shadow(0 0 5px ${color})` }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}

/** HUD-style segmented bar: 14 cells, filled per pct. */
export function SegBar({ pct, color = 'var(--acc)', cells = 14 }) {
  const filled = Math.round(Math.max(0, Math.min(1, pct)) * cells)
  return (
    <div className="flex gap-[3px]" aria-hidden="true">
      {Array.from({ length: cells }, (_, i) => (
        <span key={i} className="h-[5px] flex-1 rounded-[2px] seg-cell"
          style={i < filled ? { background: color, boxShadow: `0 0 4px ${color}` } : {}} />
      ))}
    </div>
  )
}

/** Monospace section label with leading tick. */
export function Label({ children, className = '' }) {
  return (
    <p className={`mono text-[10px] tracking-[0.22em] uppercase t3 flex items-center gap-2 ${className}`}>
      <span className="w-1 h-1 rounded-full" style={{ background: 'var(--acc)' }} />
      {children}
    </p>
  )
}

/** Bottom sheet dialog. */
export function Sheet({ open, onClose, title, children }) {
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const restore = document.activeElement
    const panel = panelRef.current
    const focusable = () => Array.from(
      panel?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []
    ).filter(el => !el.disabled && el.offsetParent !== null)

    // Move focus into the sheet so keyboard/screen-reader users land inside it.
    ;(focusable()[0] || panel)?.focus()

    const onKey = e => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab') return
      const items = focusable()
      if (items.length === 0) { e.preventDefault(); return }
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }

    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      if (restore instanceof HTMLElement) restore.focus()
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 w-full backdrop cursor-default" onClick={onClose} aria-label="Close" tabIndex={-1} />
      {/* centering transform lives in the sheet-in keyframes; Tailwind's translate utility would double-apply (v4 uses the `translate` property) */}
      <div className="absolute bottom-0 left-1/2 w-full max-w-md sheet-in">
        <div ref={panelRef} tabIndex={-1} className="panel rounded-t-3xl rounded-b-none border-b-0 px-5 pt-3 pb-8 max-h-[82vh] overflow-y-auto outline-none">
          <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: 'var(--track)' }} />
          <div className="flex items-center justify-between mb-4">
            <Label>{title}</Label>
            <button onClick={onClose} aria-label="Close sheet" className="press w-8 h-8 rounded-lg chip flex items-center justify-center t3">
              <X size={14} strokeWidth={2.5} />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
