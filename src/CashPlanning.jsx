import { useState } from 'react'
import { CalendarCheck, CalendarClock, Check, CheckCircle2, Circle, Clock, Trash2, X } from 'lucide-react'
import { useClock } from './hooks'
import { activeInMonth, addMonths, cashDueLabel, coveredThrough, formatCash, monthKey, monthLabel, setCommitmentCoverage } from './cashPulse'

export function CoverageControl({ item, state, setCash }) {
  const [open, setOpen] = useState(false)
  const [changes, setChanges] = useState({})
  const now = useClock()
  const months = [...new Set([
    ...Array.from({ length: 6 }, (_, index) => monthKey(addMonths(now, index))).filter(month => activeInMonth(item, month)),
    ...Object.keys(state.coverage[item.id] || {}),
  ])].sort()
  const through = coveredThrough(state, item.id, now)
  const changed = Object.entries(changes).filter(([month, covered]) => covered !== Boolean(state.coverage[item.id]?.[month]))
  const coverAmount = changed.filter(([, covered]) => covered).length * item.amount
  const reopenAmount = changed.filter(([, covered]) => !covered).length * item.amount
  return (
    <div className="cash-coverage-control">
      <div className="cash-coverage-heading">
        <span>{through ? `Covered through ${monthLabel(through)}` : activeInMonth(item, monthKey(now)) ? 'Not covered this month' : item.active ? 'Not scheduled this month' : 'Paused'}</span>
        <button type="button" disabled={!item.amount || !months.length} title={`Manage coverage for ${item.name}`} aria-label={`Cover months for ${item.name}`}
          onClick={() => { setChanges({}); setOpen(!open) }} className="cash-tool" aria-expanded={open}>
          <CalendarCheck size={17} />
        </button>
      </div>
      {open && (
        <div className="cash-coverage-picker" role="group" aria-label={`${item.name} advance coverage`}>
          <div className="cash-month-options">
            {months.map(month => {
              const covered = Boolean(state.coverage[item.id]?.[month])
              return <label key={month}>
                <input type="checkbox" checked={changes[month] ?? covered}
                  onChange={event => setChanges(previous => ({ ...previous, [month]: event.target.checked }))} />
                {monthLabel(month)}
              </label>
            })}
          </div>
          <div className="cash-coverage-totals" aria-live="polite">
            {coverAmount > 0 && <span>Cover {formatCash(coverAmount, state.currency)}</span>}
            {reopenAmount > 0 && <span>Reopen {formatCash(reopenAmount, state.currency)}</span>}
            {changed.length > 0 && <small>Cash balance unchanged</small>}
          </div>
          <div className="cash-coverage-heading">
            <button type="button" className="cash-action" disabled={!changed.length} onClick={() => {
              setCash(current => changed.reduce((next, [month, covered]) => setCommitmentCoverage(next, item.id, month, covered), current))
              setOpen(false)
            }}><Check size={15} /> Save coverage</button>
            <button type="button" className="cash-tool" title="Cancel coverage" aria-label="Cancel coverage" onClick={() => setOpen(false)}><X size={16} /></button>
          </div>
        </div>
      )}
    </div>
  )
}

export function DeletePayment({ name, onDelete }) {
  const [confirming, setConfirming] = useState(false)
  if (!confirming) return <button type="button" className="cash-action down" aria-label={`Delete ${name}`} onClick={() => setConfirming(true)}><Trash2 size={16} /> Delete</button>
  return <div className="cash-delete-confirm" role="group" aria-label={`Confirm deletion of ${name}`}>
    <p>Delete {name} and remove its unpaid obligations?</p>
    <div><button type="button" className="cash-action down" onClick={onDelete}><Trash2 size={15} /> Confirm delete</button><button type="button" className="cash-action" onClick={() => setConfirming(false)}>Cancel</button></div>
  </div>
}

export function CashForecast({ projection }) {
  const { state, nextPayment } = projection
  const money = value => formatCash(value, state.currency)
  return <div className="cash-forecast">
    <div className="cash-forecast-result">
      <span>Cash after planned payments</span>
      <strong className={state.cashAsOf && projection.shortfall > 0 ? 'down' : ''}>{state.cashAsOf ? money(projection.projectedCash) : '—'}</strong>
      <small>Next 3 months, including overdue obligations</small>
    </div>
    <dl className="cash-forecast-details">
      <div><dt>Remaining obligations</dt><dd>{money(projection.nextMonthsNeed + projection.carryoverNeed)}</dd></div>
      <div><dt>Coverage at monthly rate</dt><dd>{projection.runwayMonths == null ? '—' : `${projection.runwayMonths.toFixed(1)} months`}</dd></div>
    </dl>
    {state.cashAsOf && projection.shortfall > 0 && <p className="cash-shortfall">Short by {money(projection.shortfall)}</p>}
    {nextPayment && <div className="cash-next-payment"><CalendarClock size={18} /><div><span>Next payment · {cashDueLabel(nextPayment)}</span><strong>{nextPayment.name}</strong></div><strong>{money(nextPayment.amount)}</strong></div>}
    <p className="cash-forecast-note">Manual balance. No income or everyday spending assumed.</p>
  </div>
}

export function CashMonths({ projection, onToggle }) {
  const [selection, setSelection] = useState(null)
  const now = useClock()
  const selected = projection.months.find(month => month.key === selection) || projection.months[0]
  const money = value => formatCash(value, projection.state.currency)
  return <section className="cash-calendar" aria-label="Month coverage">
    <div className="cash-month-tabs" role="tablist" aria-label="Payment months">
      {projection.months.map((month, index) => <button key={month.key} type="button" role="tab" id={`cash-tab-${month.key}`} aria-controls={`cash-month-${month.key}`} aria-selected={selected.key === month.key} tabIndex={selected.key === month.key ? 0 : -1}
        onClick={() => setSelection(month.key)} onKeyDown={event => {
          const next = event.key === 'ArrowRight' ? (index + 1) % projection.months.length : event.key === 'ArrowLeft' ? (index + projection.months.length - 1) % projection.months.length : event.key === 'Home' ? 0 : event.key === 'End' ? projection.months.length - 1 : null
          if (next == null) return
          event.preventDefault()
          event.stopPropagation()
          setSelection(projection.months[next].key)
          event.currentTarget.parentElement.children[next].focus()
        }}><span>{month.label}</span><strong>{money(month.needed)}</strong><small>still needed</small></button>)}
    </div>
    <div className="cash-month-panel" role="tabpanel" id={`cash-month-${selected.key}`} aria-labelledby={`cash-tab-${selected.key}`}>
      <div className="cash-month-heading"><h2>{selected.label}</h2><span>{selected.items.filter(item => item.covered).length} / {selected.items.length} covered</span></div>
      {!selected.items.length && <p className="cash-empty">No payments scheduled.</p>}
      {selected.items.map(item => {
        const due = cashDueLabel(item, now)
        const overdue = due.startsWith('Overdue')
        return <button type="button" key={`${item.type}-${item.id}`} aria-pressed={item.covered} aria-label={`${item.covered ? 'Uncover' : 'Cover'} ${item.name}, ${selected.label}`} onClick={() => onToggle(item, selected.key)} className={`cash-payment-row ${item.covered ? 'is-covered' : overdue ? 'is-overdue' : ''}`}>
          {item.covered ? <CheckCircle2 size={20} /> : <Circle size={20} />}
          <span><strong>{item.name}</strong><small>{due}</small></span><strong>{money(item.amount)}</strong>
        </button>
      })}
    </div>
  </section>
}

export function CashAlerts({ projection, onCover, onEditBalance }) {
  return (
    <div className="cash-alerts">
      {projection.snapshotStale && <div className="cash-notice">
        <Clock size={17} />
        <span>{projection.snapshotAgeDays == null ? 'No cash snapshot yet' : `Cash snapshot is ${projection.snapshotAgeDays} days old`}</span>
        <button className="cash-action" onClick={onEditBalance}>Update cash</button>
      </div>}
      {projection.carryover.length > 0 && <section className="cash-overdue" aria-label="Unpaid earlier months">
        <h2>Unpaid earlier months <strong>{formatCash(projection.carryoverNeed, projection.state.currency)}</strong></h2>
        {projection.carryover.map(item => <div className="cash-overdue-row" key={`${item.type}-${item.id}-${item.month}`}>
          <div><strong>{item.name}</strong><span>{cashDueLabel(item)}</span></div>
          <span>{formatCash(item.amount, projection.state.currency)}</span>
          <button className="cash-tool" title={`Cover ${item.name}, ${item.month}`} aria-label={`Cover ${item.name}, ${item.month}`} onClick={() => onCover(item, item.month)}><Check size={18} /></button>
        </div>)}
      </section>}
    </div>
  )
}