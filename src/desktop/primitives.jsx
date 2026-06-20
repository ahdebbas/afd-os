import { useId, useState } from 'react'
import { useCountUp } from '../hooks'

/* =====================================================================
   Desktop primitives — "Calm Productivity OS"
   Brand-new visuals; reuse shared math/hooks only. Scoped via .d-* classes.
   ===================================================================== */

const cx = (...c) => c.filter(Boolean).join(' ')

/* ---- Surfaces ---- */
export function Card({ as: Tag = 'section', className = '', bodyClass = '', title, eyebrow, actions, children, ...rest }) {
  return (
    <Tag className={cx('d-card flex flex-col', className)} {...rest}>
      {(title || actions || eyebrow) && (
        <header className="flex items-center justify-between gap-3 px-4 py-3 d-divider" style={{ borderTop: 'none', borderBottom: '1px solid var(--d-border)' }}>
          <div className="min-w-0">
            {eyebrow && <div className="d-eyebrow truncate">{eyebrow}</div>}
            {title && <h3 className="d-h2 d-t1 truncate leading-tight">{title}</h3>}
          </div>
          {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
        </header>
      )}
      <div className={cx('p-4', bodyClass)}>{children}</div>
    </Tag>
  )
}

/* ---- Animated number (reuses useCountUp) ---- */
export function NumberFlow({ value, format = v => Math.round(v).toLocaleString('en-US'), className = '', duration = 700 }) {
  const n = useCountUp(value, duration)
  return <span className={cx('d-num', className)}>{format(n)}</span>
}

/* ---- Stat block ---- */
export function Stat({ label, value, sub, delta, deltaDir, className = '' }) {
  const dir = deltaDir || (typeof delta === 'number' ? (delta >= 0 ? 'up' : 'down') : null)
  return (
    <div className={cx('flex flex-col gap-1', className)}>
      <span className="d-eyebrow">{label}</span>
      <span className="d-h1 d-t1 d-num leading-none">{value}</span>
      <div className="flex items-center gap-2">
        {delta != null && (
          <span className={cx('d-badge', dir === 'up' ? 'd-badge-up' : 'd-badge-down')}>
            {dir === 'up' ? '↑' : '↓'} {typeof delta === 'number' ? `${Math.abs(delta).toFixed(2)}%` : delta}
          </span>
        )}
        {sub && <span className="text-[12px] d-t3">{sub}</span>}
      </div>
    </div>
  )
}

/* ---- Thin progress ring ---- */
export function Ring({ pct = 0, size = 72, stroke = 7, color = 'var(--d-accent)', track = 'var(--d-border-strong)', children }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(1, pct))
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} opacity="0.5" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - clamped)} style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(0.22,1,0.36,1)' }} />
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center text-center">{children}</div>}
    </div>
  )
}

/* ---- Thin linear meter ---- */
export function Meter({ pct = 0, color = 'var(--d-accent)', height = 6, className = '' }) {
  const w = Math.max(0, Math.min(100, pct * 100))
  return (
    <div className={cx('w-full rounded-full overflow-hidden', className)} style={{ height, background: 'var(--d-panel-3)' }} aria-hidden="true">
      <div className="h-full rounded-full" style={{ width: `${w}%`, background: color, transition: 'width 0.6s cubic-bezier(0.22,1,0.36,1)' }} />
    </div>
  )
}

/* ---- Buttons ---- */
export function Button({ variant = 'outline', size, icon: Icon, children, className = '', ...rest }) {
  return (
    <button className={cx('d-btn', `d-btn-${variant}`, size === 'sm' && 'd-btn-sm', className)} {...rest}>
      {Icon && <Icon size={size === 'sm' ? 13 : 15} strokeWidth={2.2} />}
      {children}
    </button>
  )
}
export function IconButton({ icon: Icon, size = 16, className = '', ...rest }) {
  return (
    <button className={cx('d-icon-btn', className)} {...rest}>
      <Icon size={size} strokeWidth={2.1} />
    </button>
  )
}

/* ---- Segmented control ---- */
export function Segmented({ options, value, onChange, className = '' }) {
  return (
    <div className={cx('d-segmented', className)} role="tablist">
      {options.map(o => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={cx('d-seg', value === o.value && 'd-seg-active')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ---- Badge / Pill ---- */
export function Badge({ tone = 'neutral', children, className = '' }) {
  return <span className={cx('d-badge', `d-badge-${tone}`, className)}>{children}</span>
}
export function Pill({ children, className = '' }) {
  return <span className={cx('d-pill', className)}>{children}</span>
}

/* ---- Data table ---- */
export function DataTable({ columns, rows, getRowKey = (_, i) => i, onRowClick, className = '' }) {
  return (
    <table className={cx('d-table', className)}>
      <thead>
        <tr>
          {columns.map(col => (
            <th key={col.key} style={{ width: col.width, textAlign: col.align || 'left' }}>{col.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={getRowKey(row, i)} className={onRowClick ? 'd-row-btn' : undefined}
            onClick={onRowClick ? () => onRowClick(row) : undefined}>
            {columns.map(col => (
              <td key={col.key} style={{ textAlign: col.align || 'left' }} className={col.cellClass}>
                {col.render ? col.render(row, i) : row[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/* ---- Sparkline ---- */
export function Sparkline({ data = [], width = 120, height = 32, color = 'var(--d-accent)', strokeWidth = 1.5 }) {
  if (data.length < 2) return <svg width={width} height={height} aria-hidden="true" />
  const vals = data.map(d => (typeof d === 'number' ? d : d.value))
  const min = Math.min(...vals), max = Math.max(...vals)
  const span = max - min || 1
  const pts = vals.map((v, i) => [(i / (vals.length - 1)) * width, height - ((v - min) / span) * (height - 4) - 2])
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  return (
    <svg width={width} height={height} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ---- Line chart (calm, smoothed, soft area, interactive points) ---- */
export function LineChart({ data = [], unit = '', height = 180, color = 'var(--d-accent)' }) {
  const gid = useId().replace(/:/g, '')
  const [active, setActive] = useState(null)
  if (data.length < 2) {
    return <div className="grid place-items-center d-t3 text-[13px]" style={{ height }}>Not enough data yet.</div>
  }
  const W = 600, H = height
  const padX = 8, padTop = 16, padBot = 26
  const vals = data.map(d => d.value)
  const min = Math.min(...vals), max = Math.max(...vals)
  const span = max - min || 1
  const x = i => padX + (i / (data.length - 1)) * (W - padX * 2)
  const y = v => padTop + (1 - (v - min) / span) * (H - padTop - padBot)
  const pts = data.map((d, i) => [x(i), y(d.value)])

  // Catmull-Rom → cubic bezier smoothing
  let path = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6
    path += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  const area = `${path} L ${pts[pts.length - 1][0].toFixed(1)} ${H - padBot} L ${pts[0][0].toFixed(1)} ${H - padBot} Z`
  const fmtLabel = i => {
    const dt = new Date(data[i].date + 'T00:00:00')
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const onMove = e => {
    const rect = e.currentTarget.getBoundingClientRect()
    const frac = (e.clientX - rect.left) / rect.width
    setActive(Math.max(0, Math.min(data.length - 1, Math.round(frac * (data.length - 1)))))
  }
  const pct = i => (x(i) / W) * 100

  return (
    <div className="relative" style={{ height: H }} onMouseMove={onMove} onMouseLeave={() => setActive(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img" className="block">
        <defs>
          <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.16" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map(t => (
          <line key={t} x1={padX} x2={W - padX} y1={padTop + t * (H - padTop - padBot)} y2={padTop + t * (H - padTop - padBot)}
            stroke="var(--d-border)" strokeWidth="1" />
        ))}
        <path d={area} fill={`url(#g${gid})`} />
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {active != null && (
          <line x1={x(active)} x2={x(active)} y1={padTop} y2={H - padBot} stroke="var(--d-border-strong)" strokeWidth="1" strokeDasharray="3 3" />
        )}
      </svg>

      {/* axis labels */}
      <span className="absolute d-num text-[11px] d-t3" style={{ left: 8, top: 2 }}>{max.toFixed(1)}{unit}</span>
      <span className="absolute d-num text-[11px] d-t3" style={{ left: `${pct(0)}%`, bottom: 4 }}>{fmtLabel(0)}</span>
      <span className="absolute d-num text-[11px] d-t3" style={{ left: `${pct(data.length - 1)}%`, bottom: 4, transform: 'translateX(-100%)' }}>{fmtLabel(data.length - 1)}</span>

      {/* interactive data points */}
      {pts.map((p, i) => (
        <span key={i} className="absolute rounded-full pointer-events-none" style={{
          left: `${pct(i)}%`, top: p[1], width: active === i ? 11 : 7, height: active === i ? 11 : 7,
          transform: 'translate(-50%, -50%)', background: 'var(--d-panel)',
          border: `2px solid ${color}`, boxShadow: active === i ? 'var(--d-shadow)' : 'none',
          opacity: active == null ? (i === pts.length - 1 ? 1 : 0.45) : active === i ? 1 : 0.25,
          transition: 'width .12s, height .12s, opacity .12s',
        }} />
      ))}

      {/* tooltip */}
      {active != null && (
        <div className="absolute d-num text-[11px] px-2 py-1 rounded-[8px] pointer-events-none" style={{
          left: `${pct(active)}%`, top: pts[active][1] - 12,
          transform: `translate(${active > data.length / 2 ? '-100%' : '0'}, -100%)`,
          background: 'var(--d-panel)', border: '1px solid var(--d-border)', boxShadow: 'var(--d-shadow-pop)',
          whiteSpace: 'nowrap', color: 'var(--d-text)', zIndex: 2,
        }}>
          <span className="font-semibold">{data[active].value}{unit}</span>
          <span className="d-t3 ml-1.5">{fmtLabel(active)}</span>
        </div>
      )}
    </div>
  )
}
