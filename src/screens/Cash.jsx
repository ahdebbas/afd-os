import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, Check, CheckCircle2, Circle, Pencil, Plus, Settings2, Trash2, WalletCards } from 'lucide-react'
import { Label, Odometer, Sheet } from '../ui'
import { usePersistentState } from '../hooks'
import {
  DEFAULT_CASH_PULSE,
  buildCashProjection,
  formatCash,
  reconcileCashPulse,
  setCommitmentCoverage,
} from '../cashPulse'

const cashValidator = value => value && typeof value === 'object'
const newId = prefix => `${prefix}-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`

function PaymentForm({ kind, initial, onSave, onDelete, onClose }) {
  const recurring = kind === 'commitment'
  const [form, setForm] = useState(() => recurring
    ? { name: initial?.name || '', amount: initial?.amount || '', dueDay: initial?.dueDay || 1, active: initial?.active !== false }
    : { name: initial?.name || '', amount: initial?.amount || '', dueDate: initial?.dueDate || '' })

  const submit = event => {
    event.preventDefault()
    if (!form.name.trim() || !(Number(form.amount) > 0)) return
    onSave({
      ...initial,
      id: initial?.id || newId(recurring ? 'commitment' : 'one-off'),
      name: form.name.trim(),
      amount: Number(form.amount),
      ...(recurring
        ? { dueDay: Math.max(1, Math.min(31, Number(form.dueDay) || 1)), active: form.active }
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
          <button type="button" onClick={() => setForm({ ...form, active: !form.active })} role="switch" aria-checked={form.active}
            className="press chip w-full rounded-xl px-3 py-3 flex items-center justify-between text-left">
            <span className="text-sm font-semibold t1">Active commitment</span>
            <span className={`mono text-[10px] uppercase ${form.active ? 'acc' : 't3'}`}>{form.active ? 'Active' : 'Paused'}</span>
          </button>
        </>
      ) : (
        <label className="block">
          <span className="mono text-[10px] uppercase tracking-[0.08em] t3">Due date</span>
          <input value={form.dueDate} onChange={event => setForm({ ...form, dueDate: event.target.value })}
            type="date" required className="field mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm outline-none" />
        </label>
      )}
      <div className="flex gap-2 pt-1">
        {initial && (
          <button type="button" onClick={() => { onDelete(initial.id); onClose() }} aria-label={`Delete ${initial.name}`}
            className="press field rounded-xl w-11 flex items-center justify-center down">
            <Trash2 size={16} />
          </button>
        )}
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
  const projection = useMemo(() => buildCashProjection(cash), [cash])
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

  const runway = projection.runwayMonths == null ? '—' : projection.runwayMonths >= 100 ? '99+' : projection.runwayMonths.toFixed(1)

  return (
    <div className="space-y-4" style={{ '--acc': 'var(--acc-cash)' }}>
      <section className="panel p-6">
        <div className="flex items-center justify-between mb-3">
          <Label>Cash pulse</Label>
          <button onClick={openBalance} className="press chip rounded-lg w-8 h-8 flex items-center justify-center" aria-label="Edit current cash">
            <Settings2 size={14} />
          </button>
        </div>
        <p className="mono text-[10px] uppercase tracking-[0.12em] t3">Current cash</p>
        <Odometer value={state.currentCash} format={value => formatCash(value, state.currency)} className="display text-[52px] font-bold tracking-tight t1" />
        <p className="mono text-[9px] t3 mt-1">
          {state.cashAsOf ? `Updated ${new Date(state.cashAsOf).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'Set your available cash snapshot'}
        </p>
        <div className="grid grid-cols-3 gap-2 mt-5">
          <div className="chip rounded-xl p-3 min-w-0">
            <span className="mono text-[9px] uppercase t3 block">Runway</span>
            <strong className="display text-[25px] t1 block mt-1">{runway}<small className="text-[12px] t3 ml-1">mo</small></strong>
          </div>
          <div className="chip rounded-xl p-3 min-w-0">
            <span className="mono text-[9px] uppercase t3 block">3-mo need</span>
            <strong className="display text-[20px] t1 block mt-1 truncate">{formatCash(projection.nextMonthsNeed, state.currency)}</strong>
          </div>
          <div className="chip rounded-xl p-3 min-w-0">
            <span className="mono text-[9px] uppercase t3 block">After</span>
            <strong className={`display text-[20px] block mt-1 truncate ${projection.projectedCash < 0 ? 'down' : 'up'}`}>
              {formatCash(projection.projectedCash, state.currency)}
            </strong>
          </div>
        </div>
        {projection.shortfall > 0 && (
          <p className="mt-3 rounded-xl px-3 py-2.5 text-[12px] down" style={{ background: 'color-mix(in srgb, var(--down) 10%, transparent)' }}>
            Short by {formatCash(projection.shortfall, state.currency)} across the next three months.
          </p>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between px-1 mb-3">
          <Label>Month coverage</Label>
          <span className="mono text-[9px] uppercase t3">Tap to cover</span>
        </div>
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2" data-no-carousel-swipe="true">
          {projection.months.map(month => (
            <article key={month.key} className="panel p-4 min-w-[86%] snap-start">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-[16px] font-bold t1">{month.label}</h2>
                  <p className="mono text-[9px] uppercase t3 mt-0.5">{month.items.length} major payment{month.items.length === 1 ? '' : 's'}</p>
                </div>
                <div className="text-right">
                  <strong className="mono text-[13px] t1 block">{formatCash(month.needed, state.currency)}</strong>
                  <span className="mono text-[9px] uppercase t3">still needed</span>
                </div>
              </div>
              {month.items.length === 0 ? (
                <p className="py-5 text-center text-[12px] t3">No funded payments yet.</p>
              ) : month.items.map((item, index) => (
                <button key={`${item.type}-${item.id}`} onClick={() => toggleItem(item, month.key)}
                  className={`press w-full flex items-center gap-3 py-3 text-left ${index > 0 ? 'hairline-t' : ''}`}
                  aria-pressed={item.covered}>
                  {item.covered ? <CheckCircle2 size={19} className="up shrink-0" /> : <Circle size={19} className="t3 shrink-0" />}
                  <span className="flex-1 min-w-0">
                    <span className={`block text-[13px] font-semibold truncate ${item.covered ? 't3' : 't1'}`}>{item.name}</span>
                    <span className="mono text-[9px] uppercase t3">{item.type === 'one-off' ? 'One-off' : `Due ${item.dueDay}`}</span>
                  </span>
                  <span className={`mono text-[11px] ${item.covered ? 't3' : 't1'}`}>{formatCash(item.amount, state.currency)}</span>
                </button>
              ))}
            </article>
          ))}
        </div>
      </section>

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
              <p className="mono text-[9px] uppercase t3">{item.amount > 0 ? `${formatCash(item.amount, state.currency)} · due ${item.dueDay}` : 'Amount not set'}{!item.active ? ' · paused' : ''}</p>
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

      <Sheet open={balanceOpen} onClose={() => setBalanceOpen(false)} title="Current cash">
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
      </Sheet>

      <Sheet open={Boolean(editor)} onClose={() => setEditor(null)} title={editor?.kind === 'one-off' ? 'Planned payment' : 'Monthly commitment'}>
        {editor && <PaymentForm key={`${editor.kind}-${editor.item?.id || 'new'}`} kind={editor.kind} initial={editor.item}
          onSave={savePayment} onDelete={deletePayment} onClose={() => setEditor(null)} />}
      </Sheet>
    </div>
  )
}