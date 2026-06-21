import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { dateKey } from './dates'

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

/** 270° instrument gauge. `pct` 0..1 — color defaults to the module accent via --acc. */
export function Gauge({ pct, size = 170, stroke = 11, color = 'var(--acc)', label, children }) {
  const clamped = Math.max(0, Math.min(1, pct))
  const r = (size - stroke - 8) / 2
  const c = size / 2
  const START = -135
  const SWEEP = 270
  const d = arcPath(c, c, r, START, START + SWEEP)

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}
      role="progressbar" aria-valuenow={Math.round(clamped * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <path d={d} fill="none" stroke="var(--track)" strokeWidth={stroke * 0.55} strokeLinecap="butt"
          pathLength="100" />
        {/* gap 200 > pathLength so the dash never repeats (a repeat paints a phantom dot at the arc end) */}
        <path d={d} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          pathLength="100" strokeDasharray={`${clamped * 100} 200`}
          className="gauge-val" />
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

/**
 * Week day-selector strip. Compact raised capsule on the active day.
 * Future days are dimmed and non-interactive.
 */
export function DayStrip({ value, onChange }) {
  const todayKey = dateKey()
  // Rolling 7-day window ending today (today is rightmost), so the previous
  // six days are always visible and selectable regardless of the weekday.
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const key = dateKey(d)
    return {
      key,
      wd: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
      num: d.getDate(),
      isToday: key === todayKey,
      isFuture: key > todayKey,
    }
  })

  return (
    <div className="day-strip" role="group" aria-label="Select day">
      {days.map(d => {
        const selected = d.key === value
        return (
          <button key={d.key} onClick={() => !d.isFuture && onChange(d.key)}
            disabled={d.isFuture} aria-pressed={selected} aria-label={`${d.wd} ${d.num}`}
            className={`day-chip press ${selected ? 'day-chip-active' : ''} ${d.isToday ? 'day-chip-today' : ''} ${d.isFuture ? 'day-chip-disabled' : ''}`}>
            <span className="day-num">{d.num}</span>
            <span className="day-wd">{d.wd.slice(0, 3)}</span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * Smooth trend line for a single metric over time. InBody-style: gridline value labels,
 * glowing points, emphasized latest point with a dashed marker. `data` = [{ date, value }].
 */
export function TrendChart({ data, color = 'var(--acc)', unit = '' }) {
  const W = 320, H = 180
  const padL = 6, padR = 38, padT = 14, padB = 22
  const n = data.length
  const xAt = i => padL + (W - padL - padR) * (n <= 1 ? 0.5 : i / (n - 1))

  const vals = data.map(d => d.value)
  let min = Math.min(...vals), max = Math.max(...vals)
  if (min === max) { min -= 1; max += 1 }
  const pad = (max - min) * 0.18
  min -= pad; max += pad
  const yAt = v => padT + (H - padT - padB) * (1 - (v - min) / (max - min))

  const pts = data.map((d, i) => [xAt(i), yAt(d.value)])
  // Catmull-Rom → cubic bézier for a smooth curve through every point.
  const path = pts.length < 2
    ? (pts.length ? `M ${pts[0][0]} ${pts[0][1]}` : '')
    : pts.reduce((d, p, i) => {
        if (i === 0) return `M ${p[0].toFixed(1)} ${p[1].toFixed(1)}`
        const p0 = pts[i - 2] || pts[i - 1], p1 = pts[i - 1], p2 = p, p3 = pts[i + 1] || p
        const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6
        const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6
        return `${d} C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
      }, '')

  const lines = 4
  const grid = Array.from({ length: lines + 1 }, (_, i) => min + (max - min) * (i / lines))
  // Enough precision that adjacent gridline labels stay distinct.
  const step = (max - min) / lines
  const decimals = step >= 1 ? 0 : step >= 0.1 ? 1 : 2
  const fmtDate = s => { const d = new Date(s + 'T00:00:00'); return `${d.getMonth() + 1}.${d.getDate()}` }
  const last = pts[pts.length - 1]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
      aria-label={`Trend chart, latest ${data[n - 1]?.value}${unit}`} className="block">
      {grid.map((v, i) => {
        const y = yAt(v)
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--line)" strokeWidth="1" />
            <text x={W - padR + 5} y={y + 3} fill="var(--ink-3)" className="mono" fontSize="8.5">{v.toFixed(decimals)}</text>
          </g>
        )
      })}

      {last && <line x1={last[0]} y1={padT} x2={last[0]} y2={H - padB} stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="3 3" />}

      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 4px ${color})` }} />

      {pts.map((p, i) => {
        const isLast = i === pts.length - 1
        return <circle key={i} cx={p[0]} cy={p[1]} r={isLast ? 4 : 2.6} fill={color}
          stroke="var(--surface)" strokeWidth={isLast ? 2 : 1}
          style={isLast ? { filter: `drop-shadow(0 0 5px ${color})` } : undefined} />
      })}

      {n > 0 && <text x={padL} y={H - 6} fill="var(--ink-3)" className="mono" fontSize="8.5">{fmtDate(data[0].date)}</text>}
      {n > 1 && <text x={xAt(n - 1)} y={H - 6} fill="var(--ink-3)" className="mono" fontSize="8.5" textAnchor="end">{fmtDate(data[n - 1].date)}</text>}
    </svg>
  )
}

/** Monospace section label with leading tick. */
export function Label({ children, className = '' }) {
  return (
    <p className={`mono text-[10px] tracking-[0.08em] uppercase t3 flex items-center gap-2 ${className}`}>
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
