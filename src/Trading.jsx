import { useState } from 'react'
import { Check, Settings2 } from 'lucide-react'
import { holdingValue, usd } from './data'

export default function Trading({ finance, setFinance, quotes, status, syncedAt, desktop = false }) {
  const [editing, setEditing] = useState(false)
  const { msft } = finance
  const trade = finance.sarwaTrade
  const holdings = [
    { ticker: 'MSFT', name: 'Microsoft', units: msft.shares, price: msft.price, value: msft.shares * msft.price },
    ...trade.holdings,
  ]
  const total = holdings.reduce((sum, holding) => sum + holdingValue(holding, quotes), 0)
  const msftPrice = quotes?.MSFT?.price ?? msft.price
  const rangePct = Math.max(0, Math.min(100, (msftPrice - msft.low52) / (msft.high52 - msft.low52) * 100))
  const vsLow = ((msftPrice / msft.low52 - 1) * 100).toFixed(1)
  const vsHigh = ((msftPrice / msft.high52 - 1) * 100).toFixed(1)
  const ink = desktop ? 'd-t1' : 't1'
  const muted = desktop ? 'd-t3' : 't3'
  const number = desktop ? 'd-num' : 'mono'
  const setUnits = (holding, input) => {
    const units = input.value === '' ? 0 : input.valueAsNumber
    const valid = Number.isFinite(units) && units >= 0
    input.setCustomValidity(valid ? '' : 'Shares must be a finite number of zero or more.')
    if (!valid) { input.reportValidity(); return }
    setFinance(previous => {
      if (holding.ticker === 'MSFT') return { ...previous, msft: { ...previous.msft, shares: units } }
      const current = previous.sarwaTrade ?? trade
      return {
        ...previous,
        sarwaTrade: { ...current, holdings: current.holdings.map(h => h.ticker === holding.ticker ? { ...h, units } : h) },
      }
    })
  }
  return (
    <section className={desktop ? 'd-card p-5' : 'panel p-6'} aria-label="Trading">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className={`${number} text-[12px] font-semibold ${ink}`}>Trading</h2>
        <button type="button" onClick={() => setEditing(!editing)}
          className={`press rounded-md p-2 ${desktop ? 'd-inset d-t2' : 'chip t2'}`}
          aria-label={editing ? 'Done editing Trading shares' : 'Edit Trading shares'}>
          {editing ? <Check size={14} /> : <Settings2 size={14} />}
        </button>
      </div>
      <p className={`${desktop ? 'd-h1 d-num' : 'display text-[36px] font-bold'} ${ink}`}>{usd(total)}</p>
      <p className={`text-[11px] mt-1 ${muted}`}>Share counts × market prices · Daily moves, not total returns</p>
      <div className="mt-3">
        {holdings.map(holding => {
          const quote = quotes?.[holding.ticker]
          const fresh = quote && status === 'live' && (!quote.fetchedAt || quote.fetchedAt === syncedAt)
          const source = quote ? `${fresh ? 'Live' : 'Cached'}${quote.fetchedAt ? ` · ${new Date(quote.fetchedAt).toLocaleString()}` : ''}`
            : holding.ticker === 'MSFT' ? `as of ${msft.priceDate}` : trade.lastUpdated
          const daily = quote?.changePct
          const price = quote?.price ?? holding.price ?? (holding.recordedUnits > 0 ? holding.value / holding.recordedUnits : null)
          return (
            <div key={holding.ticker} className={`py-3 ${desktop ? 'border-b border-[var(--d-border)] last:border-0' : 'hairline-t'}`}>
              <div className="flex items-start justify-between gap-3">
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
              {holding.ticker === 'MSFT' && (
                <div className="mt-4" role="group" aria-label="MSFT 52-week range">
                  <div className="relative h-1.5 rounded-full"
                    style={{ background: `linear-gradient(90deg, var(${desktop ? '--d-down' : '--down'}), var(${desktop ? '--d-warn' : '--warn'}), var(${desktop ? '--d-up' : '--up'}))`, opacity: 0.85 }}>
                    <span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1 h-4 rounded-full"
                      style={{ left: `${rangePct}%`, background: `var(${desktop ? '--d-text' : '--acc'})` }} />
                  </div>
                  <div className={`flex justify-between gap-2 mt-2 text-[10px] ${number} ${muted}`}>
                    <span>{usd(msft.low52, 2)} <span className={desktop ? 'd-up' : 'up'}>+{vsLow}%</span></span>
                    <span>52w</span>
                    <span><span className={desktop ? 'd-down' : 'down'}>{vsHigh}%</span> {usd(msft.high52, 2)}</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
