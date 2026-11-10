import { useEffect, useRef, useState } from 'react'
import { Check, Plus, Settings2, Trash2 } from 'lucide-react'
import { holdingValue, usd } from './data'
import { useQuotesMeta } from './quotes'
import { addTradingStock, normalizeTicker, removeTradingStock, tradingHoldings, validateTradingStock } from './tradingHoldings.js'

export default function Trading({ finance, setFinance, quotes, status, syncedAt, desktop = false }) {
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const { lookupQuote } = useQuotesMeta()
  const lookup = useRef(null)
  const latestFinance = useRef(finance)
  useEffect(() => { latestFinance.current = finance }, [finance])
  useEffect(() => () => lookup.current?.abort(), [])
  const trade = finance.sarwaTrade
  const holdings = tradingHoldings(finance)
  const total = holdings.reduce((sum, holding) => sum + holdingValue(holding, quotes), 0)
  const ink = desktop ? 'd-t1' : 't1'
  const muted = desktop ? 'd-t3' : 't3'
  const number = desktop ? 'd-num' : 'mono'
  const field = `${desktop ? 'd-inset d-t1' : 'field'} ${number} w-full rounded px-2 py-2 text-[13px]`
  const button = `press rounded-md px-3 py-2 text-[12px] ${desktop ? 'd-inset d-t2' : 'chip t2'}`
  const cancelAdd = () => {
    lookup.current?.abort()
    lookup.current = null
    setPending(false)
    setError('')
    setAdding(false)
  }
  const addStock = async event => {
    event.preventDefault()
    if (pending) return
    const form = event.currentTarget
    const ticker = normalizeTicker(form.elements.namedItem('ticker').value)
    const units = form.elements.namedItem('shares').valueAsNumber
    const controller = new AbortController()
    lookup.current = controller
    setError('')
    try {
      validateTradingStock(latestFinance.current, ticker, units)
      if (!lookupQuote) throw new Error('Quote service is unavailable. Try reloading the app.')
      setPending(true)
      const quote = await lookupQuote(ticker, { signal: controller.signal })
      if (controller.signal.aborted) return
      addTradingStock(latestFinance.current, ticker, units, quote)
      setFinance(previous => addTradingStock(previous, ticker, units, quote))
      setAdding(false)
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.message)
    } finally {
      if (lookup.current === controller) {
        lookup.current = null
        setPending(false)
      }
    }
  }
  const removeStock = ticker => {
    if (!window.confirm(`Remove ${ticker} from Trading? This only removes it from your dashboard; it does not sell any shares.`)) return
    setFinance(previous => removeTradingStock(previous, ticker))
  }
  const setUnits = (holding, input) => {
    const units = input.value === '' ? 0 : input.valueAsNumber
    const price = quotes?.[holding.ticker]?.price ?? holding.price ?? (holding.recordedUnits > 0 ? holding.value / holding.recordedUnits : 0)
    const valid = Number.isFinite(units) && units >= 0 && Number.isFinite(units * price)
    input.setCustomValidity(valid ? '' : 'Shares must be zero or more, with a finite position value.')
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
        <div className="flex items-center gap-1">
        <button type="button" onClick={() => { setError(''); setAdding(true) }} className={button} aria-label="Add stock" disabled={adding}>
          <Plus size={14} className="inline mr-1" />Add stock
        </button>
        <button type="button" onClick={() => setEditing(!editing)} disabled={!holdings.length}
          className={`press rounded-md p-2 ${desktop ? 'd-inset d-t2' : 'chip t2'}`}
          aria-label={editing ? 'Done editing Trading shares' : 'Edit Trading shares'}>
          {editing ? <Check size={14} /> : <Settings2 size={14} />}
        </button>
        </div>
      </div>
      <p className={`${desktop ? 'd-h1 d-num' : 'display text-[36px] font-bold'} ${ink}`}>{usd(total)}</p>
      <p className={`text-[11px] mt-1 ${muted}`}>Share counts × market prices · Daily moves, not total returns</p>
      {adding && <form onSubmit={addStock} aria-label="Add stock" className={`mt-4 rounded-lg p-3 ${desktop ? 'd-inset' : 'chip'}`}>
        <p className={`text-[11px] mb-3 ${muted}`}>Add a USD-priced stock or ETF. We verify its price before saving.</p>
        <div className="grid grid-cols-2 gap-3">
          <label className={`text-[11px] ${muted}`}>Ticker
            <input name="ticker" aria-label="Stock ticker" required autoFocus disabled={pending} placeholder="AAPL"
              autoCapitalize="characters" autoCorrect="off" spellCheck={false} className={`${field} mt-1`} />
          </label>
          <label className={`text-[11px] ${muted}`}>Shares
            <input name="shares" aria-label="Number of shares" required disabled={pending} type="number" min="0" step="any"
              inputMode="decimal" placeholder="10.5" className={`${field} mt-1`} />
          </label>
        </div>
        {error && <p role="alert" className={`text-[12px] mt-3 ${desktop ? 'd-down' : 'down'}`}>{error}</p>}
        <div className="flex gap-2 mt-3">
          <button type="submit" className={button} disabled={pending}>{pending ? 'Checking price...' : 'Save stock'}</button>
          <button type="button" onClick={cancelAdd} className={button}>Cancel</button>
        </div>
      </form>}
      <div className="mt-3">
        {!holdings.length && <p className={`text-[12px] py-3 ${muted}`}>No Trading stocks yet. Add a stock to track its value.</p>}
        {holdings.map(holding => {
          const quote = quotes?.[holding.ticker]
          const fresh = quote && status === 'live' && (!quote.fetchedAt || quote.fetchedAt === syncedAt)
          const source = quote ? `${fresh ? 'Live' : 'Cached'}${quote.fetchedAt ? ` · ${new Date(quote.fetchedAt).toLocaleString()}` : ''}`
            : holding.priceDate ? `Recorded · ${holding.priceDate}` : trade.lastUpdated
          const daily = quote?.changePct
          const price = quote?.price ?? holding.price ?? (holding.recordedUnits > 0 ? holding.value / holding.recordedUnits : null)
          const low52 = quote ? quote.low52 : holding.low52
          const high52 = quote ? quote.high52 : holding.high52
          const hasRange = Number.isFinite(price) && Number.isFinite(low52) && Number.isFinite(high52) && low52 > 0 && high52 > low52
          const rangePct = hasRange ? Math.max(0, Math.min(100, (price - low52) / (high52 - low52) * 100)) : null
          const vsLow = hasRange ? ((price / low52 - 1) * 100).toFixed(1) : null
          const vsHigh = hasRange ? ((price / high52 - 1) * 100).toFixed(1) : null
          return (
            <div key={holding.ticker} role="group" aria-label={`${holding.ticker} holding`} className={`py-3 ${desktop ? 'border-b border-[var(--d-border)] last:border-0' : 'hairline-t'}`}>
              <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={`${number} text-[13px] font-semibold ${ink}`}>{holding.ticker}</p>
                <p className={`text-[11px] ${muted}`}>{holding.name}</p>
                {editing ? <input type="number" min="0" step="any" inputMode="decimal" value={holding.units}
                  onChange={event => setUnits(holding, event.currentTarget)}
                  aria-label={`${holding.ticker} shares`}
                  className={`${desktop ? 'd-inset d-t1' : 'field'} ${number} mt-1 w-28 rounded px-2 py-1 text-[13px]`} />
                  : <p className={`${number} text-[11px] mt-1 ${muted}`}>{holding.units.toLocaleString('en-US', { maximumFractionDigits: 8 })} shares</p>}
                {editing && <button type="button" onClick={() => removeStock(holding.ticker)} aria-label={`Remove ${holding.ticker}`}
                  className={`press flex items-center gap-1 mt-2 py-1 text-[11px] ${desktop ? 'd-down' : 'down'}`}>
                  <Trash2 size={12} />Remove
                </button>}
                <p className={`text-[10px] mt-1 ${muted}`}>{source}</p>
              </div>
              <div className={`text-right shrink-0 ${number}`}>
                <p className={`font-semibold text-[14px] ${ink}`}>{usd(holdingValue(holding, quotes), 2)}</p>
                <p className={`text-[11px] mt-1 ${muted}`}>{Number.isFinite(price) ? `${usd(price, 2)} / share` : 'Price unavailable'}</p>
                {Number.isFinite(daily) ? <p className={`text-[11px] mt-1 ${desktop ? daily >= 0 ? 'd-up' : 'd-down' : daily >= 0 ? 'up' : 'down'}`}>{daily >= 0 ? '+' : ''}{daily.toFixed(2)}% today</p>
                  : <p className={`text-[11px] mt-1 ${muted}`}>Daily move unavailable</p>}
              </div>
              </div>
              {hasRange ? (
                <div className="mt-4" role="group" aria-label={`${holding.ticker} 52-week range`}>
                  <div className="relative h-1.5 rounded-full" role="meter" aria-label={`${holding.ticker} position in 52-week range`}
                    aria-valuemin={0} aria-valuemax={100} aria-valuenow={rangePct}
                    style={{ background: `linear-gradient(90deg, var(${desktop ? '--d-down' : '--down'}), var(${desktop ? '--d-warn' : '--warn'}), var(${desktop ? '--d-up' : '--up'}))`, opacity: 0.85 }}>
                    <span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1 h-4 rounded-full"
                      style={{ left: `${rangePct}%`, background: `var(${desktop ? '--d-text' : '--acc'})` }} />
                  </div>
                  <div className={`flex justify-between gap-2 mt-2 text-[10px] ${number} ${muted}`}>
                    <span>{usd(low52, 2)} <span className={desktop ? price >= low52 ? 'd-up' : 'd-down' : price >= low52 ? 'up' : 'down'}>{price >= low52 ? '+' : ''}{vsLow}%</span></span>
                    <span>52w</span>
                    <span><span className={desktop ? price > high52 ? 'd-up' : 'd-down' : price > high52 ? 'up' : 'down'}>{price > high52 ? '+' : ''}{vsHigh}%</span> {usd(high52, 2)}</span>
                  </div>
                </div>
              ) : <p className={`text-[10px] mt-3 ${muted}`}>{holding.ticker} 52-week range unavailable</p>}
            </div>
          )
        })}
      </div>
    </section>
  )
}
