import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, Check, CheckCircle2, Circle, Pencil, Plus, Trash2, WalletCards } from 'lucide-react'
import { usePersistentState } from '../../hooks'
import {
  DEFAULT_CASH_PULSE,
  buildCashProjection,
  formatCash,
  reconcileCashPulse,
  setCommitmentCoverage,
} from '../../cashPulse'
import { Badge, Button, Card, IconButton, NumberFlow, Stat } from '../primitives'

const cashValidator = value => value && typeof value === 'object'
const newId = prefix => `${prefix}-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`

function PaymentEditor({ kind, initial, onSave, onDelete, onCancel }) {
  const recurring = kind === 'commitment'
  const [form, setForm] = useState(() => recurring
    ? { name: initial?.name || '', amount: initial?.amount || '', dueDay: initial?.dueDay || 1, active: initial?.active !== false }
    : { name: initial?.name || '', amount: initial?.amount || '', dueDate: initial?.dueDate || '' })

  const submit = event => {
    event.preventDefault()
    if (!form.name.trim() || !(Number(form.amount) > 0) || (!recurring && !form.dueDate)) return
    onSave({
      ...initial,
      id: initial?.id || newId(recurring ? 'commitment' : 'one-off'),
      name: form.name.trim(),
      amount: Number(form.amount),
      ...(recurring
        ? { dueDay: Math.max(1, Math.min(31, Number(form.dueDay) || 1)), active: form.active }
        : { dueDate: form.dueDate, coveredAt: initial?.coveredAt || null }),
    })
  }

  return (
    <form onSubmit={submit} className="d-inset p-3 mb-3">
      <div className={`grid gap-2 ${recurring ? 'grid-cols-[1fr_130px_90px_auto]' : 'grid-cols-[1fr_130px_150px_auto]'}`}>
        <input autoFocus value={form.name} onChange={event => setForm({ ...form, name: event.target.value })}
          placeholder="Payment name" className="d-input" />
        <input value={form.amount} onChange={event => setForm({ ...form, amount: event.target.value })}
          type="number" min="0" step="any" placeholder="Amount" className="d-input d-num" />
        {recurring ? (
          <input value={form.dueDay} onChange={event => setForm({ ...form, dueDay: event.target.value })}
            type="number" min="1" max="31" placeholder="Due day" className="d-input d-num" />
        ) : (
          <input value={form.dueDate} onChange={event => setForm({ ...form, dueDate: event.target.value })}
            type="date" required className="d-input d-num" />
        )}
        <div className="flex gap-1">
          <IconButton icon={Check} type="submit" aria-label="Save payment" />
          <Button size="sm" variant="ghost" type="button" onClick={onCancel}>Cancel</Button>
        </div>
      </div>
      {recurring && (
        <label className="mt-2 inline-flex items-center gap-2 text-[12px] d-t2 cursor-pointer">
          <input type="checkbox" checked={form.active} onChange={event => setForm({ ...form, active: event.target.checked })} />
          Active commitment
        </label>
      )}
      {initial && (
        <button type="button" onClick={() => onDelete(initial.id)} className="mt-2 inline-flex items-center gap-1.5 text-[11px] d-down">
          <Trash2 size={12} /> Delete payment
        </button>
      )}
    </form>
  )
}

export default function CashPage() {
  const [cash, setCash] = usePersistentState('afd-cash-pulse', DEFAULT_CASH_PULSE, cashValidator)
  const [balanceDraft, setBalanceDraft] = useState(null)
  const [editor, setEditor] = useState(null)
  const projection = useMemo(() => buildCashProjection(cash), [cash])
  const { state } = projection

  useEffect(() => {
    setCash(reconcileCashPulse)
  }, [setCash])

  const saveBalance = () => {
    setCash(current => ({
      ...reconcileCashPulse(current),
      currentCash: Math.max(0, Number(balanceDraft ?? state.currentCash) || 0),
      cashAsOf: new Date().toISOString(),
    }))
    setBalanceDraft(null)
  }

  const toggleItem = (item, month) => {
    if (item.type === 'recurring') {
      setCash(current => setCommitmentCoverage(reconcileCashPulse(current), item.id, month, !item.covered))
      return
    }
    setCash(current => {
      const normalized = reconcileCashPulse(current)
      return {
        ...normalized,
        oneOffs: normalized.oneOffs.map(oneOff => oneOff.id === item.id
          ? { ...oneOff, coveredAt: oneOff.coveredAt ? null : new Date().toISOString() }
          : oneOff),
      }
    })
  }

  const savePayment = item => {
    const key = editor.kind === 'commitment' ? 'commitments' : 'oneOffs'
    setCash(current => {
      const normalized = reconcileCashPulse(current)
      const exists = normalized[key].some(entry => entry.id === item.id)
      return { ...normalized, [key]: exists ? normalized[key].map(entry => entry.id === item.id ? item : entry) : [...normalized[key], item] }
    })
    setEditor(null)
  }

  const deletePayment = id => {
    const key = editor.kind === 'commitment' ? 'commitments' : 'oneOffs'
    setCash(current => {
      const normalized = reconcileCashPulse(current)
      return { ...normalized, [key]: normalized[key].filter(item => item.id !== id) }
    })
    setEditor(null)
  }

  const runway = projection.runwayMonths == null ? '—' : projection.runwayMonths >= 100 ? '99+' : projection.runwayMonths.toFixed(1)

  return (
    <div className="d-enter space-y-4">
      <Card>
        <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr] gap-7 items-end">
          <div>
            <div className="d-eyebrow mb-1">Current cash</div>
            <div className="flex items-center gap-2">
              <div className="d-input flex items-center gap-2 !h-10 max-w-[250px]">
                <span className="d-mono text-[11px] d-t3">{state.currency}</span>
                <input value={balanceDraft ?? String(state.currentCash || '')} onFocus={() => setBalanceDraft(String(state.currentCash || ''))}
                  onChange={event => setBalanceDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') saveBalance() }}
                  type="number" min="0" step="any" className="min-w-0 flex-1 bg-transparent outline-none text-[19px] font-semibold d-num d-t1" aria-label="Current cash" />
              </div>
              <Button size="sm" variant="primary" onClick={saveBalance}>Update</Button>
            </div>
            <div className="text-[11px] d-t3 mt-1.5">
              {state.cashAsOf ? `Snapshot updated ${new Date(state.cashAsOf).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'Manual snapshot · never auto-deducted'}
            </div>
          </div>
          <Stat label="Runway" value={<>{runway}<span className="text-[14px] d-t3 ml-1">months</span></>} sub={`${formatCash(projection.recurringMonthly, state.currency)} recurring monthly`} />
          <Stat label="Next 3 months" value={<NumberFlow value={projection.nextMonthsNeed} format={value => formatCash(value, state.currency)} />} sub="uncovered commitments" />
          <Stat label="Projected cash" value={<NumberFlow value={projection.projectedCash} format={value => formatCash(value, state.currency)} />} sub={projection.shortfall > 0 ? `${formatCash(projection.shortfall, state.currency)} short` : 'after known payments'} />
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        {projection.months.map(month => (
          <Card key={month.key} eyebrow={`${month.items.length} major payment${month.items.length === 1 ? '' : 's'}`} title={month.label}
            actions={<div className="text-right"><div className="d-num text-[13px] font-medium d-t1">{formatCash(month.needed, state.currency)}</div><div className="text-[10px] d-t3">still needed</div></div>}>
            {month.items.length === 0 ? (
              <div className="py-8 text-center text-[13px] d-t3">No funded payments yet.</div>
            ) : month.items.map((item, index) => (
              <button key={`${item.type}-${item.id}`} onClick={() => toggleItem(item, month.key)} aria-pressed={item.covered}
                className={`w-full flex items-center gap-3 py-3 text-left ${index > 0 ? 'd-divider' : ''}`}>
                {item.covered ? <CheckCircle2 size={18} className="d-up shrink-0" /> : <Circle size={18} className="d-t3 shrink-0" />}
                <span className="flex-1 min-w-0">
                  <span className={`block text-[13px] font-medium truncate ${item.covered ? 'd-t3' : 'd-t1'}`}>{item.name}</span>
                  <span className="text-[11px] d-t3">{item.type === 'one-off' ? 'One-off' : `Due day ${item.dueDay}`}</span>
                </span>
                <span className={`d-num text-[12px] ${item.covered ? 'd-t3' : 'd-t1'}`}>{formatCash(item.amount, state.currency)}</span>
              </button>
            ))}
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card eyebrow="Repeats monthly" title="Commitments"
          actions={<Button size="sm" variant="outline" icon={Plus} onClick={() => setEditor({ kind: 'commitment', item: null })}>Add</Button>}>
          {editor?.kind === 'commitment' && <PaymentEditor key={editor.item?.id || 'new-commitment'} kind="commitment" initial={editor.item}
            onSave={savePayment} onDelete={deletePayment} onCancel={() => setEditor(null)} />}
          {state.commitments.map((item, index) => (
            <div key={item.id} className={`flex items-center gap-3 py-3 ${index > 0 ? 'd-divider' : ''}`}>
              <WalletCards size={16} className={item.active ? 'd-accent' : 'd-t3'} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium d-t1 truncate">{item.name}</div>
                <div className="text-[11px] d-t3">{item.amount > 0 ? `${formatCash(item.amount, state.currency)} · due day ${item.dueDay}` : 'Amount not set'}</div>
              </div>
              {!item.active && <Badge>Paused</Badge>}
              <IconButton icon={Pencil} onClick={() => setEditor({ kind: 'commitment', item })} aria-label={`Edit ${item.name}`} />
            </div>
          ))}
        </Card>

        <Card eyebrow="Known future payments" title="Planned one-offs"
          actions={<Button size="sm" variant="outline" icon={Plus} onClick={() => setEditor({ kind: 'one-off', item: null })}>Add</Button>}>
          {editor?.kind === 'one-off' && <PaymentEditor key={editor.item?.id || 'new-one-off'} kind="one-off" initial={editor.item}
            onSave={savePayment} onDelete={deletePayment} onCancel={() => setEditor(null)} />}
          {state.oneOffs.length === 0 ? (
            <div className="py-8 text-center">
              <CalendarClock size={20} className="d-t3 mx-auto mb-2" />
              <p className="text-[13px] d-t3">Add school fees, insurance, travel, or another known payment.</p>
            </div>
          ) : state.oneOffs.map((item, index) => (
            <div key={item.id} className={`flex items-center gap-3 py-3 ${index > 0 ? 'd-divider' : ''}`}>
              <CalendarClock size={16} className="d-accent" />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium d-t1 truncate">{item.name}</div>
                <div className="text-[11px] d-t3">{formatCash(item.amount, state.currency)} · {new Date(`${item.dueDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
              </div>
              {item.coveredAt && <Badge tone="up">Covered</Badge>}
              <IconButton icon={Pencil} onClick={() => setEditor({ kind: 'one-off', item })} aria-label={`Edit ${item.name}`} />
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}