import { useState } from 'react'
import { Check, Settings2 } from 'lucide-react'
import { holdingValue, sarwaTotal, usd } from './data'

export default function SarwaTrade({ finance, setFinance, quotes, status, syncedAt, desktop = false }) {
  const [editing, setEditing] = useState(false)
  const trade = finance.sarwaTrade
  const ink = desktop ? 'd-t1' : 't1'
  const muted = desktop ? 'd-t3' : 't3'
  const number = desktop ? 'd-num' : 'mono'
  const setUnits = (holding, input) => {
    const units = input.value === '' ? 0 : input.valueAsNumber
    const valid = Number.isFinite(units) && units >= 0
    input.setCustomValidity(valid ? '' : 'Shares must be a finite number of zero or more.')
    if (!valid) { input.reportValidity(); return }
    setFinance(previous => {
      const current = previous.sarwaTrade ?? trade
      return {
        ...previous,
        sarwaTrade: { ...current, holdings: current.holdings.map(h => h.ticker === holding.ticker ? { ...h, units } : h) },
      }
    })
  }
  return (
    <section className={desktop ? 'd-card p-5' : 'panel p-6'} aria-label="Sarwa Trade">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className={`${number} text-[12px] font-semibold ${ink}`}>Sarwa Trade</h2>
        <button type="button" onClick={() => setEditing(!editing)}
          className={`press rounded-md p-2 ${desktop ? 'd-inset d-t2' : 'chip t2'}`}
          aria-label={editing ? 'Done editing Sarwa Trade shares' : 'Edit Sarwa Trade shares'}>
          {editing ? <Check size={14} /> : <Settings2 size={14} />}
        </button>
      </div>
      <p className={`${desktop ? 'd-h1 d-num' : 'display text-[36px] font-bold'} ${ink}`}>{usd(sarwaTotal(trade, quotes))}</p>
      <p className={`text-[11px] mt-1 ${muted}`}>Share counts × market prices · Daily moves, not total returns</p>
      <div className="mt-3">
        {trade.holdings.map(holding => {
          const quote = quotes?.[holding.ticker]
          const fresh = quote && status === 'live' && (!quote.fetchedAt || quote.fetchedAt === syncedAt)
          const source = quote ? `${fresh ? 'Live' : 'Cached'}${quote.fetchedAt ? ` · ${new Date(quote.fetchedAt).toLocaleString()}` : ''}` : trade.lastUpdated
          const daily = quote?.changePct
          const price = quote?.price ?? holding.price ?? (holding.recordedUnits > 0 ? holding.value / holding.recordedUnits : null)
          return (
            <div key={holding.ticker} className={`flex items-start justify-between gap-3 py-3 ${desktop ? 'border-b border-[var(--d-border)] last:border-0' : 'hairline-t'}`}>
              <div className="min-w-0">
                <p className={`${number} text-[13px] font-semibold ${ink}`}>{holding.ticker}</p>
                <p className={`text-[11px] ${muted}`}>{holding.name}</p>
                {editing ? <input type="number" min="0" step="any" inputMode="decimal" value={holding.units}
                  onChange={event => setUnits(holding, event.currentTarget)}
                  aria-label={`${holding.ticker} shares`}
                  className={`${desktop ? 'd-inset d-t1' : 'field'} ${number} mt-1 w-28 rounded px-2 py-1 text-[13px]`} />
                  : <p className={`${number} text-[11px] mt-1 ${muted}`}>{holding.units.toLocaleString('en-US', { maximumFractionDigits: 8 })} shares</p>}
                <p className={`text-[10px] mt-1 ${muted}`}>{source}</p>
              </div>
              <div className={`text-right shrink-0 ${number}`}>
                <p className={`font-semibold text-[14px] ${ink}`}>{usd(holdingValue(holding, quotes), 2)}</p>
                <p className={`text-[11px] mt-1 ${muted}`}>{Number.isFinite(price) ? `${usd(price, 2)} / share` : 'Price unavailable'}</p>
                {Number.isFinite(daily) ? <p className={`text-[11px] mt-1 ${desktop ? daily >= 0 ? 'd-up' : 'd-down' : daily >= 0 ? 'up' : 'down'}`}>{daily >= 0 ? '+' : ''}{daily.toFixed(2)}% today</p>
                  : <p className={`text-[11px] mt-1 ${muted}`}>Daily move unavailable</p>}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
