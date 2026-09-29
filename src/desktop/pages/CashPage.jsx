import { useEffect, useMemo, useRef, useState } from 'react'
import { CashAlerts, CashForecast, CashMonths, CoverageControl, DeletePayment } from '../../CashPlanning'
import { CalendarClock, Check, Pencil, Plus, WalletCards } from 'lucide-react'
import { useClock, usePersistentState } from '../../hooks'
import {
  DEFAULT_CASH_PULSE,
  buildCashProjection,
  formatCash,
  reconcileCashPulse,
  monthKey,
  setCommitmentCoverage,
  setCommitmentActive,
  addMonths,
  monthLabel,
} from '../../cashPulse'
import { Badge, Button, Card, IconButton } from '../primitives'

const cashValidator = value => value && typeof value === 'object'
const newId = prefix => `${prefix}-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`

function PaymentEditor({ kind, initial, onSave, onDelete, onCancel }) {
  const recurring = kind === 'commitment'
  const [form, setForm] = useState(() => recurring
    ? { name: initial?.name || '', amount: initial?.amount || '', dueDay: initial?.dueDay || 1, active: initial?.active !== false, endMonth: initial?.endMonth || '' }
    : { name: initial?.name || '', amount: initial?.amount || '', dueDate: initial?.dueDate || '' })

  const submit = event => {
    event.preventDefault()
    if (!form.name.trim() || !(Number(form.amount) > 0) || (!recurring && !form.dueDate)) return
    const schedule = recurring ? setCommitmentActive(initial || {}, form.active) : null
    onSave({
      ...initial,
      id: initial?.id || newId(recurring ? 'commitment' : 'one-off'),
      name: form.name.trim(),
      amount: Number(form.amount),
      ...(recurring
        ? { active: schedule.active, pausedPeriods: schedule.pausedPeriods, dueDay: Math.max(1, Math.min(31, Number(form.dueDay) || 1)), startMonth: initial?.startMonth || monthKey(), endMonth: form.endMonth || null }
        : { dueDate: form.dueDate, coveredAt: initial?.coveredAt || null }),
    })
  }

  return (
    <form onSubmit={submit} className="d-inset p-3 mb-3">
      <div className={`grid gap-2 ${recurring ? 'grid-cols-[1fr_130px_90px_auto]' : 'grid-cols-[1fr_130px_150px_auto]'}`}>
        <input autoFocus value={form.name} onChange={event => setForm({ ...form, name: event.target.value })}
          aria-label="Payment name" placeholder="Payment name" className="d-input" />
        <input value={form.amount} onChange={event => setForm({ ...form, amount: event.target.value })}
          type="number" min="0" step="any" aria-label="Amount" placeholder="Amount" className="d-input d-num" />
        {recurring ? (
          <input value={form.dueDay} onChange={event => setForm({ ...form, dueDay: event.target.value })}
            type="number" min="1" max="31" aria-label="Due day" placeholder="Due day" className="d-input d-num" />
        ) : (
          <input value={form.dueDate} onChange={event => setForm({ ...form, dueDate: event.target.value })}
            type="date" aria-label="Due date" required className="d-input d-num" />
        )}
        <div className="flex gap-1">
          <IconButton icon={Check} type="submit" aria-label="Save payment" />
          <Button size="sm" variant="ghost" type="button" onClick={onCancel}>Cancel</Button>
        </div>
      </div>
      {recurring && (
        <label className="cash-end-month">Last payment month (optional)
          <input type="month" className="d-input" min={initial?.startMonth || monthKey()} value={form.endMonth} onChange={event => setForm({ ...form, endMonth: event.target.value })} />
        </label>
      )}
      {recurring && (
        <label className="mt-2 inline-flex items-center gap-2 text-[12px] d-t2 cursor-pointer">
          <input type="checkbox" checked={form.active} onChange={event => setForm({ ...form, active: event.target.checked })} />
          Active commitment
        </label>
      )}
      {recurring && !form.active && <p className="text-[12px] d-t2 mt-2">{!initial ? 'No payments scheduled while paused.' : initial.active === false ? 'Paused. Earlier unpaid commitments remain due.' : `Pause from ${monthLabel(monthKey(addMonths(new Date(), 1)))}. Existing obligations remain due.`}</p>}
      {initial && <DeletePayment name={initial.name} onDelete={() => onDelete(initial.id)} />}
    </form>
  )
}

export default function CashPage() {
  const [cash, setCash] = usePersistentState('afd-cash-pulse', DEFAULT_CASH_PULSE, cashValidator)
  const [balanceDraft, setBalanceDraft] = useState(null)
  const balanceRef = useRef(null)
  const [editor, setEditor] = useState(null)
  const now = useClock()
  const projection = useMemo(() => buildCashProjection(cash, now), [cash, now])
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

  return (
    <div className="d-enter cash-desktop space-y-4">
      <Card>
        <div className="cash-desktop-overview">
          <div>
            <div className="d-eyebrow mb-1">Current cash</div>
            <div className="flex items-center gap-2">
              <div className="d-input flex items-center gap-2 !h-10 max-w-[250px]">
                <span className="d-mono text-[11px] d-t3">{state.currency}</span>
                <input ref={balanceRef} value={balanceDraft ?? String(state.currentCash || '')} onFocus={() => setBalanceDraft(String(state.currentCash || ''))}
                  onChange={event => setBalanceDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') saveBalance() }}
                  type="number" min="0" step="any" className="min-w-0 flex-1 bg-transparent outline-none text-[19px] font-semibold d-num d-t1" aria-label="Current cash" />
              </div>
              <Button size="sm" variant="primary" onClick={saveBalance}>Update</Button>
            </div>
            <div className="text-[11px] d-t3 mt-1.5">
              {state.cashAsOf ? `Snapshot updated ${new Date(state.cashAsOf).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'Manual snapshot · never auto-deducted'}
            </div>
          </div>
          <CashForecast projection={projection} />
        </div>
      </Card>

      <CashAlerts projection={projection} onCover={toggleItem} onEditBalance={() => balanceRef.current?.focus()} />
      <CashMonths projection={projection} onToggle={toggleItem} />

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
                <div className="text-[12px] d-t3">{item.amount > 0 ? `${formatCash(item.amount, state.currency)} · due day ${item.dueDay}` : 'Amount not set'}{item.endMonth ? ` · ends ${monthLabel(item.endMonth)}` : ''}</div>
                <CoverageControl item={item} state={state} setCash={setCash} />
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