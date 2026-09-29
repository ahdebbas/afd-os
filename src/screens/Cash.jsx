import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarClock, Check, Pencil, Plus, Settings2, WalletCards } from 'lucide-react'
import { Label, Odometer, Sheet } from '../ui'
import { CashAlerts, CashForecast, CashMonths, CoverageControl, DeletePayment } from '../CashPlanning'
import { useClock, usePersistentState } from '../hooks'
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
} from '../cashPulse'

const cashValidator = value => value && typeof value === 'object'
const newId = prefix => `${prefix}-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`

function PaymentForm({ kind, initial, onSave, onDelete, onClose }) {
  const recurring = kind === 'commitment'
  const [form, setForm] = useState(() => recurring
    ? { name: initial?.name || '', amount: initial?.amount || '', dueDay: initial?.dueDay || 1, active: initial?.active !== false, endMonth: initial?.endMonth || '' }
    : { name: initial?.name || '', amount: initial?.amount || '', dueDate: initial?.dueDate || '' })

  const submit = event => {
    event.preventDefault()
    if (!form.name.trim() || !(Number(form.amount) > 0)) return
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
    onClose()
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        <span className="mono text-[10px] uppercase tracking-[0.08em] t3">Name</span>
        <input autoFocus value={form.name} onChange={event => setForm({ ...form, name: event.target.value })}
          placeholder={recurring ? 'Parents' : 'School fees'} className="field mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm outline-none" />
      </label>
      <label className="block">
        <span className="mono text-[10px] uppercase tracking-[0.08em] t3">Amount</span>
        <input value={form.amount} onChange={event => setForm({ ...form, amount: event.target.value })}
          type="number" inputMode="decimal" min="0" step="any" placeholder="0"
          className="field mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm outline-none" />
      </label>
      {recurring ? (
        <>
          <label className="block">
            <span className="mono text-[10px] uppercase tracking-[0.08em] t3">Due day</span>
            <input value={form.dueDay} onChange={event => setForm({ ...form, dueDay: event.target.value })}
              type="number" inputMode="numeric" min="1" max="31"
              className="field mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm outline-none" />
          </label>
          <label className="block">
            <span className="mono text-[10px] uppercase tracking-[0.08em] t3">Last payment month (optional)</span>
            <input type="month" min={initial?.startMonth || monthKey()} value={form.endMonth} onChange={event => setForm({ ...form, endMonth: event.target.value })} className="field mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm outline-none" />
          </label>
          <button type="button" onClick={() => setForm({ ...form, active: !form.active })} role="switch" aria-checked={form.active}
            className="press chip w-full rounded-xl px-3 py-3 flex items-center justify-between text-left">
            <span className="text-sm font-semibold t1">Active commitment</span>
            <span className={`mono text-[10px] uppercase ${form.active ? 'acc' : 't3'}`}>{form.active ? 'Active' : 'Paused'}</span>
          </button>
          {!form.active && <p className="text-[12px] t2">{!initial ? 'No payments scheduled while paused.' : initial.active === false ? 'Paused. Earlier unpaid commitments remain due.' : `Pause from ${monthLabel(monthKey(addMonths(new Date(), 1)))}. Existing obligations remain due.`}</p>}
        </>
      ) : (
        <label className="block">
          <span className="mono text-[10px] uppercase tracking-[0.08em] t3">Due date</span>
          <input value={form.dueDate} onChange={event => setForm({ ...form, dueDate: event.target.value })}
            type="date" required className="field mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm outline-none" />
        </label>
      )}
      {initial && <DeletePayment name={initial.name} onDelete={() => { onDelete(initial.id); onClose() }} />}
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={!form.name.trim() || !(Number(form.amount) > 0) || (!recurring && !form.dueDate)}
          className="press acc-chip rounded-xl py-3 flex-1 text-sm font-bold disabled:opacity-40">
          Save payment
        </button>
      </div>
    </form>
  )
}

export default function Cash() {
  const [cash, setCash] = usePersistentState('afd-cash-pulse', DEFAULT_CASH_PULSE, cashValidator)
  const [balanceOpen, setBalanceOpen] = useState(false)
  const [balanceDraft, setBalanceDraft] = useState('')
  const [editor, setEditor] = useState(null)
  const now = useClock()
  const projection = useMemo(() => buildCashProjection(cash, now), [cash, now])
  const { state } = projection

  useEffect(() => {
    setCash(reconcileCashPulse)
  }, [setCash])

  const saveBalance = event => {
    event.preventDefault()
    setCash(current => ({
      ...reconcileCashPulse(current),
      currentCash: Math.max(0, Number(balanceDraft) || 0),
      cashAsOf: new Date().toISOString(),
    }))
    setBalanceOpen(false)
  }

  const openBalance = () => {
    setBalanceDraft(String(state.currentCash || ''))
    setBalanceOpen(true)
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
  }

  const deletePayment = id => {
    const key = editor.kind === 'commitment' ? 'commitments' : 'oneOffs'
    setCash(current => {
      const normalized = reconcileCashPulse(current)
      return { ...normalized, [key]: normalized[key].filter(item => item.id !== id) }
    })
  }

  return (
    <div className="space-y-4 cash-page" style={{ '--acc': 'var(--acc-cash)' }}>
      <section className="panel p-6">
        <div className="flex items-center justify-between mb-3">
          <Label>Cash pulse</Label>
          <button onClick={openBalance} className="press chip rounded-lg w-8 h-8 flex items-center justify-center" aria-label="Edit current cash">
            <Settings2 size={14} />
          </button>
        </div>
        <p className="mono text-[10px] uppercase tracking-[0.12em] t3">Current cash</p>
        <Odometer value={state.currentCash} format={value => formatCash(value, state.currency)} className="cash-balance display font-bold t1" />
        <p className="mono text-[9px] t3 mt-1">
          {state.cashAsOf ? `Updated ${new Date(state.cashAsOf).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'Set your available cash snapshot'}
        </p>
        <CashForecast projection={projection} />
      </section>

      <CashAlerts projection={projection} onCover={toggleItem} onEditBalance={openBalance} />
      <CashMonths projection={projection} onToggle={toggleItem} />

      <section className="panel p-5">
        <div className="flex items-center justify-between mb-2">
          <Label><WalletCards size={12} /> Monthly commitments</Label>
          <button onClick={() => setEditor({ kind: 'commitment', item: null })} className="press acc-chip rounded-lg w-8 h-8 flex items-center justify-center" aria-label="Add monthly commitment">
            <Plus size={15} />
          </button>
        </div>
        {state.commitments.map((item, index) => (
          <div key={item.id} className={`flex items-center gap-3 py-3 ${index > 0 ? 'hairline-t' : ''}`}>
            <span className={`w-2 h-2 rounded-full ${item.active ? 'bg-[var(--up)]' : 'bg-[var(--ink-3)]'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold t1 truncate">{item.name}</p>
              <p className="text-[12px] t3">{item.amount > 0 ? `${formatCash(item.amount, state.currency)} · due ${item.dueDay}` : 'Amount not set'}{!item.active ? ' · paused' : ''}{item.endMonth ? ` · ends ${monthLabel(item.endMonth)}` : ''}</p>
              <CoverageControl item={item} state={state} setCash={setCash} />
            </div>
            <button onClick={() => setEditor({ kind: 'commitment', item })} className="press chip rounded-lg w-8 h-8 flex items-center justify-center t2" aria-label={`Edit ${item.name}`}>
              <Pencil size={13} />
            </button>
          </div>
        ))}
      </section>

      <section className="panel p-5">
        <div className="flex items-center justify-between mb-2">
          <Label><CalendarClock size={12} /> Planned one-offs</Label>
          <button onClick={() => setEditor({ kind: 'one-off', item: null })} className="press acc-chip rounded-lg w-8 h-8 flex items-center justify-center" aria-label="Add planned payment">
            <Plus size={15} />
          </button>
        </div>
        {state.oneOffs.length === 0 ? (
          <p className="text-[12px] t3 py-4">Add school fees, insurance, travel, or another known payment.</p>
        ) : state.oneOffs.map((item, index) => (
          <div key={item.id} className={`flex items-center gap-3 py-3 ${index > 0 ? 'hairline-t' : ''}`}>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold t1 truncate">{item.name}</p>
              <p className="mono text-[9px] uppercase t3">{formatCash(item.amount, state.currency)} · {new Date(`${item.dueDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{item.coveredAt ? ' · covered' : ''}</p>
            </div>
            <button onClick={() => setEditor({ kind: 'one-off', item })} className="press chip rounded-lg w-8 h-8 flex items-center justify-center t2" aria-label={`Edit ${item.name}`}>
              <Pencil size={13} />
            </button>
          </div>
        ))}
      </section>

      {createPortal(<div style={{ '--acc': 'var(--acc-cash)' }}><Sheet open={balanceOpen} onClose={() => setBalanceOpen(false)} title="Current cash">
        <form onSubmit={saveBalance} className="space-y-3">
          <p className="text-[12px] t2">Enter the cash available now. Covering payments will not change this number.</p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 mono text-[11px] t3">{state.currency}</span>
            <input autoFocus value={balanceDraft} onChange={event => setBalanceDraft(event.target.value)}
              type="number" inputMode="decimal" min="0" step="any" placeholder="0"
              className="field w-full rounded-xl pl-14 pr-3 py-3 text-lg outline-none" />
          </div>
          <button type="submit" className="press acc-chip rounded-xl py-3 w-full text-sm font-bold flex items-center justify-center gap-2">
            <Check size={15} /> Update snapshot
          </button>
        </form>
      </Sheet></div>, document.body)}

      {createPortal(<div style={{ '--acc': 'var(--acc-cash)' }}><Sheet open={Boolean(editor)} onClose={() => setEditor(null)} title={editor?.kind === 'one-off' ? 'Planned payment' : 'Monthly commitment'}>
        {editor && <PaymentForm key={`${editor.kind}-${editor.item?.id || 'new'}`} kind={editor.kind} initial={editor.item}
          onSave={savePayment} onDelete={deletePayment} onClose={() => setEditor(null)} />}
      </Sheet></div>, document.body)}
    </div>
  )
}