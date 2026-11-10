import { useState } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { propertyTotal, reconcileFinance, usd } from './data'

export default function RealEstate({ finance, setFinance, netWorth, desktop = false }) {
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [error, setError] = useState('')
  const total = propertyTotal(finance)
  const share = netWorth > 0 ? total / netWorth * 100 : 0
  const pendingDelete = finance.properties.find(property => property.id === deleting)
  const locked = Boolean(editing || pendingDelete)
  const ink = desktop ? 'd-t1' : 't1'
  const muted = desktop ? 'd-t3' : 't3'
  const number = desktop ? 'd-num' : 'mono'
  const action = `press inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2 text-[12px] disabled:opacity-40 ${desktop ? 'd-inset d-t2' : 'chip t2'}`
  const field = `${desktop ? 'd-inset d-t1' : 'field'} mt-1 w-full min-w-0 rounded-lg px-3 py-2 text-[14px]`

  const save = event => {
    event.preventDefault()
    const form = event.currentTarget
    const name = form.elements.namedItem('name')
    const location = form.elements.namedItem('location')
    const purchase = form.elements.namedItem('purchaseValue')
    const current = form.elements.namedItem('currentValue')
    name.setCustomValidity(name.value.trim() ? '' : 'Enter a property name.')
    for (const input of [purchase, current]) {
      const optional = input === purchase && input.value === ''
      input.setCustomValidity(optional || Number.isFinite(input.valueAsNumber) && input.valueAsNumber >= 0
        ? '' : 'Enter a finite value of zero or more.')
    }
    if (!form.reportValidity()) return
    if (editing.id && !finance.properties.some(property => property.id === editing.id)) {
      setError('This property was removed elsewhere. Cancel and add it again if needed.')
      return
    }
    const property = {
      id: editing.id ?? crypto.randomUUID(),
      name: name.value.trim(),
      location: location.value.trim(),
      purchaseValue: purchase.value === '' ? null : purchase.valueAsNumber,
      currentValue: current.valueAsNumber,
    }
    setFinance(previous => {
      const latest = reconcileFinance(previous)
      return {
        ...latest,
        properties: editing.id
          ? latest.properties.map(item => item.id === editing.id ? property : item)
          : [...latest.properties, property],
      }
    })
    setEditing(null)
    setError('')
  }

  return (
    <section className={desktop ? 'd-card p-5' : 'panel p-6'} aria-label="Real estate">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className={`${number} text-[12px] font-semibold ${ink}`}>Real estate</h2>
        <button type="button" className={action} disabled={locked} onClick={() => {
          setError('')
          setEditing({ id: null, name: '', location: '', purchaseValue: null, currentValue: '' })
        }}><Plus size={14} /> Add property</button>
      </div>
      <p className={`${desktop ? 'd-h1 d-num' : 'display text-[36px] font-bold'} break-words ${ink}`} aria-label="Total property value">{usd(total)}</p>
      <p className={`text-[11px] mt-1 ${muted}`}>{finance.properties.length} {finance.properties.length === 1 ? 'property' : 'properties'} · Current values count toward net worth</p>
      {desktop && <div className="mt-3">
        <div className={`flex justify-between gap-2 text-[12px] ${muted}`}>
          <span>Share of net worth</span><span className={number}>{share.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 mt-2 overflow-hidden rounded-full bg-[var(--d-border)]" role="meter" aria-label="Real estate share of net worth"
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={share}>
          <div className="h-full bg-[var(--d-accent)]" style={{ width: `${share}%` }} />
        </div>
      </div>}
      {editing && <form key={editing.id ?? 'new'} onSubmit={save} aria-label={editing.id ? 'Edit property' : 'Add property'} className="mt-4 space-y-3">
        <h3 className={`text-[13px] font-semibold ${ink}`}>{editing.id ? 'Edit property' : 'New property'}</h3>
        <label className={`block text-[12px] ${muted}`}>Property name
          <input name="name" required defaultValue={editing.name} className={field}
            onInput={event => event.currentTarget.setCustomValidity('')} />
        </label>
        <label className={`block text-[12px] ${muted}`}>Location (optional)
          <input name="location" defaultValue={editing.location} className={field} />
        </label>
        <label className={`block text-[12px] ${muted}`}>Purchase value (USD, optional)
          <input name="purchaseValue" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={editing.purchaseValue ?? ''} className={`${field} ${number}`}
            onInput={event => event.currentTarget.setCustomValidity('')} />
        </label>
        <label className={`block text-[12px] ${muted}`}>Current value (USD)
          <input name="currentValue" type="number" min="0" step="0.01" inputMode="decimal" required defaultValue={editing.currentValue} className={`${field} ${number}`}
            onInput={event => event.currentTarget.setCustomValidity('')} />
        </label>
        {error && <p role="alert" className={`text-[12px] ${desktop ? 'd-down' : 'down'}`}>{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={action}><Check size={14} /> Save property</button>
          <button type="button" className={action} onClick={() => { setEditing(null); setError('') }}><X size={14} /> Cancel</button>
        </div>
      </form>}
      <div className="mt-3">
        {finance.properties.map(property => (
          <div key={property.id} role="group" aria-label={property.name}
            className={`py-4 ${desktop ? 'border-t border-[var(--d-border)]' : 'hairline-t'}`}>
            <h3 className={`text-[14px] font-semibold break-words ${ink}`}>{property.name}</h3>
            {property.location && <p className={`text-[11px] mt-1 break-words ${muted}`}>{property.location}</p>}
            <dl className="grid grid-cols-2 gap-3 mt-3 text-[11px]">
              <div className="min-w-0"><dt className={muted}>Purchase value</dt>
                <dd className={`${number} mt-1 break-words ${ink}`}>{property.purchaseValue == null ? 'Not set' : usd(property.purchaseValue, 2)}</dd></div>
              <div className="min-w-0"><dt className={muted}>Current value</dt>
                <dd className={`${number} mt-1 break-words ${ink}`}>{usd(property.currentValue, 2)}</dd></div>
            </dl>
            {deleting === property.id ? <div className="mt-3 space-y-2" role="group" aria-label={`Confirm deletion of ${property.name}`}>
              <p className={`text-[12px] ${muted}`}>Delete {property.name}? Its current value will be removed from net worth.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={action} onClick={() => {
                  setFinance(previous => {
                    const latest = reconcileFinance(previous)
                    return { ...latest, properties: latest.properties.filter(item => item.id !== property.id) }
                  })
                  setDeleting(null)
                }}><Trash2 size={14} /> Confirm delete</button>
                <button type="button" className={action} onClick={() => setDeleting(null)}>Cancel</button>
              </div>
            </div> : <div className="flex flex-wrap gap-2 mt-3">
              <button type="button" className={action} disabled={locked} aria-label={`Edit ${property.name}`}
                onClick={() => { setError(''); setEditing(property) }}><Pencil size={14} /> Edit</button>
              <button type="button" className={action} disabled={locked} aria-label={`Delete ${property.name}`}
                onClick={() => setDeleting(property.id)}><Trash2 size={14} /> Delete</button>
            </div>}
          </div>
        ))}
        {!finance.properties.length && <p className={`text-[12px] mt-4 ${muted}`}>No properties yet. Add your first property.</p>}
      </div>
    </section>
  )
}
