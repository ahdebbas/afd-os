import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
import { FINANCE, usd } from '../data'
import { Label, Odometer } from '../ui'
import { useQuotes, useQuotesMeta } from '../quotes'

const COLORS = ['var(--acc-food)', 'var(--acc-fin)', '#A78BFA', '#FBBF24']
const ETF_SYMBOL = { ISDW: 'ISDW.L', ISDU: 'ISDU.L', ISDE: 'ISDE.L', IGLN: 'IGLN.L' }

const SYNC = {
  loading: { text: 'Syncing…', color: 'var(--ink-3)' },
  live: { text: 'Live', color: 'var(--up)' },
  stale: { text: 'Stale', color: 'var(--warn)' },
  error: { text: 'Offline', color: 'var(--down)' },
  idle: { text: 'Offline', color: 'var(--ink-3)' },
}

export default function Finance() {
  const { msft, sarwa } = FINANCE
  const q = useQuotes()
  const { status, syncedAt, refresh } = useQuotesMeta()
  const sync = SYNC[status] ?? SYNC.idle
  const live = q?.MSFT
  const price = live?.price ?? msft.price
  const dayChangePct = live ? live.changePct : msft.dayChangePct
  const priceDate = live ? 'live · today' : `as of ${msft.priceDate}`
  const msftValue = msft.shares * price
  const total = msftValue + sarwa.total
  const rangePct = Math.max(0, Math.min(100, (price - msft.low52) / (msft.high52 - msft.low52) * 100)).toFixed(1)
  const vsLow = ((price / msft.low52 - 1) * 100).toFixed(1)
  const vsHigh = ((price / msft.high52 - 1) * 100).toFixed(1)
  const msftUp = dayChangePct >= 0
  const Trend = msftUp ? TrendingUp : TrendingDown

  return (
    <div className="space-y-4" style={{ '--acc': 'var(--acc-fin)' }}>
      {/* Net worth */}
      <section className="panel p-6">
        <div className="flex items-center justify-between mb-3">
          <Label>Capital module</Label>
          <span className={`mono text-[10px] flex items-center gap-1 ${msftUp ? 'up' : 'down'}`}>
            <Trend size={11} strokeWidth={2.5} /> {msftUp ? '+' : ''}{dayChangePct.toFixed(2)}% MSFT
          </span>
        </div>
        <Odometer value={total} format={usd} className="display text-[58px] font-bold tracking-tight t1" />
        <div className="mt-4 flex gap-2">
          <span className="acc-chip rounded-lg px-3 py-1.5 mono text-[10px]">MSFT {usd(msftValue)}</span>
          <span className="chip rounded-lg px-3 py-1.5 mono text-[10px] t2">SARWA {usd(sarwa.total)}</span>
        </div>
        <button onClick={refresh} disabled={status === 'loading'}
          className="press mt-3 inline-flex items-center gap-2 chip rounded-lg px-3 py-1.5 disabled:opacity-60"
          aria-label="Refresh market data">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: sync.color, boxShadow: `0 0 6px ${sync.color}` }} aria-hidden="true" />
          <span className="mono text-[10px] tracking-[0.14em] uppercase" style={{ color: sync.color }}>{sync.text}</span>
          {syncedAt && status !== 'loading' && (
            <span className="mono text-[10px] t3">· {new Date(syncedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
          )}
          <RefreshCw size={11} strokeWidth={2.5} className={`t3 ${status === 'loading' ? 'animate-spin' : ''}`} />
        </button>
      </section>

      {/* MSFT */}
      <section className="panel p-6">
        <div className="flex items-center justify-between mb-3">
          <Label>MSFT · {msft.shares} sh</Label>
          <span className={`mono text-[10px] ${live ? 'acc' : 't3'}`}>{priceDate}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <p className="display text-[36px] leading-none font-bold t1">{usd(msftValue)}</p>
          <p className="mono text-[13px] t2">${price.toFixed(2)}</p>
        </div>

        {/* 52-week instrument rail */}
        <div className="mt-6">
          <div className="relative h-7">
            <div className="absolute top-1/2 -translate-y-1/2 inset-x-0 h-[3px] rounded-full"
              style={{ background: 'linear-gradient(90deg, var(--down), #FBBF24, var(--up))', opacity: 0.5 }} />
            {[0, 25, 50, 75, 100].map(t => (
              <span key={t} className="absolute top-1/2 -translate-y-1/2 w-px h-2.5" style={{ left: `${t}%`, background: 'var(--track)' }} />
            ))}
            <span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[3px] h-7 rounded-full"
              style={{ left: `${rangePct}%`, background: 'var(--acc)', boxShadow: '0 0 8px var(--acc)' }} />
          </div>
          <div className="flex justify-between mt-1.5 mono text-[10px]">
            <span className="t3">${msft.low52} <span className="up">+{vsLow}%</span></span>
            <span className="t3 tracking-[0.18em] uppercase">52w</span>
            <span className="t3"><span className="down">{vsHigh}%</span> ${msft.high52}</span>
          </div>
        </div>
      </section>

      {/* Sarwa */}
      <section className="panel p-6">
        <div className="flex items-center justify-between mb-3">
          <Label>Sarwa · halal</Label>
          <span className="mono text-[10px] t3">as of {sarwa.lastUpdated}</span>
        </div>
        <p className="display text-[36px] leading-none font-bold t1">{usd(sarwa.total)}</p>

        <div className="mt-4 flex h-[6px] rounded-full overflow-hidden gap-[3px]" aria-hidden="true">
          {sarwa.holdings.map((h, i) => (
            <div key={h.ticker} className="rounded-[2px]" style={{ width: `${h.alloc}%`, background: COLORS[i], boxShadow: `0 0 5px ${COLORS[i]}` }} />
          ))}
        </div>

        <div className="mt-3">
          {sarwa.holdings.map((h, i) => (
            <div key={h.ticker} className={`flex items-center justify-between py-3.5 ${i > 0 ? 'hairline-t' : ''}`}>
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-[2px] flex-shrink-0" style={{ background: COLORS[i] }} />
                <div>
                  <span className="mono text-[12px] font-semibold t1">{h.ticker}</span>
                  <span className="mono text-[10px] t3 ml-2">{h.alloc}%</span>
                  {q?.[ETF_SYMBOL[h.ticker]] && (
                    <span className={`mono text-[10px] ml-2 ${q[ETF_SYMBOL[h.ticker]].changePct >= 0 ? 'up' : 'down'}`}>
                      ${q[ETF_SYMBOL[h.ticker]].price.toFixed(2)} {q[ETF_SYMBOL[h.ticker]].changePct >= 0 ? '+' : ''}{q[ETF_SYMBOL[h.ticker]].changePct.toFixed(1)}%
                    </span>
                  )}
                  <p className="text-[11px] t3 mt-0.5">{h.name}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold t1">{usd(h.value)}</div>
                <div className={`mono text-[10px] inline-flex items-center gap-1 ${h.perf >= 0 ? 'up' : 'down'}`}>
                  {h.perf >= 0 ? <TrendingUp size={10} strokeWidth={2.5} /> : <TrendingDown size={10} strokeWidth={2.5} />}
                  {h.perf >= 0 ? '+' : ''}{h.perf}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
