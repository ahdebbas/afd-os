import { useState } from 'react'
import { CalendarCheck, Check, Clock, X } from 'lucide-react'
import { addMonths, coveredThrough, formatCash, monthKey, monthLabel, setCoverageMonths } from './cashPulse'

export function CoverageControl({ item, state, setCash }) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState([])
  const months = Array.from({ length: 6 }, (_, index) => monthKey(addMonths(new Date(), index)))
    .filter(month => (!item.startMonth || month >= item.startMonth) && (!item.endMonth || month <= item.endMonth))
  const through = coveredThrough(state, item.id)
  return (
    <div className="cash-coverage-control">
      <div className="cash-coverage-heading">
        <span>{through ? `Covered through ${monthLabel(through)}` : 'Not covered this month'}</span>
        <button type="button" disabled={!item.active || !item.amount} title={`Cover months for ${item.name}`} aria-label={`Cover months for ${item.name}`}
          onClick={() => { setSelected([]); setOpen(!open) }} className="cash-tool" aria-expanded={open}>
          <CalendarCheck size={17} />
        </button>
      </div>
      {open && (
        <div className="cash-coverage-picker" role="group" aria-label={`${item.name} advance coverage`}>
          <div className="cash-month-options">
            {months.map(month => {
              const covered = Boolean(state.coverage[item.id]?.[month])
              return <label key={month}>
                <input type="checkbox" disabled={covered} checked={covered || selected.includes(month)}
                  onChange={event => setSelected(previous => event.target.checked ? [...previous, month] : previous.filter(value => value !== month))} />
                {monthLabel(month)}{covered ? ' (covered)' : ''}
              </label>
            })}
          </div>
          <div className="cash-coverage-heading">
            <button type="button" className="cash-action" disabled={!selected.length} onClick={() => {
              setCash(current => setCoverageMonths(current, item.id, selected, true))
              setOpen(false)
            }}><Check size={15} /> Cover selected months</button>
            <button type="button" className="cash-tool" title="Cancel coverage" aria-label="Cancel coverage" onClick={() => setOpen(false)}><X size={16} /></button>
          </div>
        </div>
      )}
    </div>
  )
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
          <div><strong>{item.name}</strong><span>Due {item.dueDate}</span></div>
          <span>{formatCash(item.amount, projection.state.currency)}</span>
          <button className="cash-tool" title={`Cover ${item.name}, ${item.month}`} aria-label={`Cover ${item.name}, ${item.month}`} onClick={() => onCover(item, item.month)}><Check size={18} /></button>
        </div>)}
      </section>}
    </div>
  )
}