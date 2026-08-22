import { useEffect, useState } from 'react'
import { RefreshCw, Settings2, Check } from 'lucide-react'
import { FINANCE as DEFAULT_FINANCE, ETF_SYMBOL, holdingValue, holdingPerf, reconcileFinance, sarwaTotal, usd } from '../../data'
import { useQuotes, useQuotesMeta } from '../../quotes'
import { usePersistentState } from '../../hooks'
import { Card, Stat, DataTable, Meter, Badge, Button, IconButton, NumberFlow } from '../primitives'

const ALLOC_COLORS = ['var(--d-accent)', 'var(--d-up)', 'var(--d-warn)', 'var(--d-text-3)', 'var(--d-accent-line)', 'var(--d-border-strong)']

const SYNC = {
  loading: 'Syncing…', live: 'Live', stale: 'Stale', error: 'Offline', idle: 'Offline',
}

export default function FinancePage() {
  const [FINANCE, setFinance] = usePersistentState('afd-finance', DEFAULT_FINANCE, v => v && typeof v === 'object')
  const { msft, sarwa, property } = FINANCE
  const [editMode, setEditMode] = useState(false)
  const q = useQuotes()
  const { status, syncedAt, refresh } = useQuotesMeta()

  useEffect(() => {
    setFinance(reconcileFinance)
  }, [setFinance])

  // Update a Sarwa holding's unit count (edit mode); value re-derives from live quotes.
  const setUnits = (ticker, val) => setFinance({
    ...FINANCE,
    sarwa: { ...sarwa, holdings: sarwa.holdings.map(h => h.ticker === ticker ? { ...h, units: val } : h) },
  })

  const live = q?.MSFT
  const price = live?.price ?? msft.price
  const dayChangePct = live ? live.changePct : msft.dayChangePct
  const msftValue = msft.shares * price
  const etfLive = sarwa.holdings.some(h => q?.[ETF_SYMBOL[h.ticker]])
  const sarwaValue = etfLive ? sarwaTotal(sarwa, q) : sarwa.total
  const total = msftValue + sarwaValue + property.value
  const rangePct = Math.max(0, Math.min(100, ((price - msft.low52) / (msft.high52 - msft.low52)) * 100))
  const vsLow = ((price / msft.low52 - 1) * 100).toFixed(1)
  const vsHigh = ((price / msft.high52 - 1) * 100).toFixed(1)

  const allocations = [
    { key: 'MSFT', value: msftValue, color: ALLOC_COLORS[0] },
    { key: 'Sarwa', value: sarwaValue, color: ALLOC_COLORS[1] },
    { key: 'Property', value: property.value, color: ALLOC_COLORS[2] },
  ]

  const rows = sarwa.holdings.map((h, i) => {
    const value = holdingValue(h, q)
    const alloc = etfLive ? (value / sarwaValue) * 100 : h.alloc
    const perf = h.units != null ? holdingPerf(h, q) : null
    const quote = q?.[ETF_SYMBOL[h.ticker]]
    return { ...h, value, alloc, perf, quote, color: ALLOC_COLORS[i % ALLOC_COLORS.length] }
  })

  const columns = [
    { key: 'ticker', label: 'Ticker', render: r => (
      <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-[3px]" style={{ background: r.color }} /><span className="font-medium d-t1">{r.ticker}</span></span>
    ) },
    { key: 'name', label: 'Name', render: r => <span className="d-t2">{r.name}</span> },
    { key: 'price', label: 'Price', align: 'right', render: r => <span className="d-num d-t2">{r.quote ? `$${r.quote.price.toFixed(2)}` : '—'}</span> },
    { key: 'alloc', label: 'Alloc', align: 'right', render: r => <span className="d-num d-t2">{r.alloc.toFixed(1)}%</span> },
    { key: 'value', label: editMode ? 'Units' : 'Value', align: 'right', render: r => editMode && r.units != null
      ? <input value={r.units} type="number" min="0" step="any"
          onChange={e => setUnits(r.ticker, e.target.value === '' ? 0 : +e.target.value)}
          aria-label={`${r.ticker} units`}
          className="d-num text-right w-24 px-2 py-1 rounded"
          style={{ background: 'var(--d-panel-3)', border: '1px solid var(--d-border)', color: 'var(--d-text)' }} />
      : <span className="d-num d-t1 font-medium">{usd(r.value)}</span> },
    { key: 'perf', label: 'Return', align: 'right', render: r => r.perf == null
      ? <span className="d-t3">—</span>
      : <Badge tone={r.perf >= 0 ? 'up' : 'down'}>{r.perf >= 0 ? '+' : ''}{r.perf.toFixed(2)}%</Badge> },
  ]

  return (
    <div className="d-enter space-y-4">
      {/* Net worth header */}
      <Card>
        <div className="flex items-start justify-between gap-4">
          <Stat label="Net worth" value={<NumberFlow value={total} format={usd} />} delta={dayChangePct} sub="vs MSFT day move" />
          <Button size="sm" variant="outline" icon={RefreshCw} onClick={refresh} disabled={status === 'loading'}>
            {SYNC[status] ?? 'Offline'}{syncedAt && status !== 'loading' ? ` · ${new Date(syncedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` : ''}
          </Button>
        </div>
        <div className="mt-5">
          <div className="flex h-2 rounded-full overflow-hidden gap-[3px]">
            {allocations.map(a => (
              <div key={a.key} style={{ width: `${(a.value / total) * 100}%`, background: a.color }} />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-4">
            {allocations.map(a => (
              <div key={a.key} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[13px] d-t2"><span className="w-2 h-2 rounded-[3px]" style={{ background: a.color }} />{a.key}</span>
                <span className="d-num text-[13px] d-t1 font-medium">{usd(a.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-[1fr_360px] gap-4">
        <Card eyebrow="Sarwa · halal" title="Holdings" bodyClass="!p-0"
          actions={<IconButton icon={editMode ? Check : Settings2} onClick={() => setEditMode(!editMode)} aria-label={editMode ? 'Done editing units' : 'Edit units'} />}>
          <DataTable columns={columns} rows={rows} getRowKey={r => r.ticker} />
        </Card>

        <div className="space-y-4">
          <Card eyebrow={`${msft.shares} shares`} title="MSFT">
            <div className="flex items-baseline justify-between">
              <NumberFlow value={msftValue} format={usd} className="d-h1 d-t1" />
              <div className="text-right">
                <div className="d-num text-[13px] d-t2">${price.toFixed(2)}</div>
                <div className={`text-[11px] ${live ? 'd-accent' : 'd-t3'}`}>{live ? 'live · today' : `as of ${msft.priceDate}`}</div>
              </div>
            </div>
            <div className="mt-5">
              <div className="relative h-1.5 rounded-full" style={{ background: 'linear-gradient(90deg, var(--d-down), var(--d-warn), var(--d-up))', opacity: 0.85 }}>
                <span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1 h-4 rounded-full" style={{ left: `${rangePct}%`, background: 'var(--d-text)' }} />
              </div>
              <div className="flex justify-between mt-2 text-[11px] d-num">
                <span className="d-t3">${msft.low52} <span className="d-up">+{vsLow}%</span></span>
                <span className="d-t3">52w</span>
                <span className="d-t3"><span className="d-down">{vsHigh}%</span> ${msft.high52}</span>
              </div>
            </div>
          </Card>

          <Card eyebrow={property.location} title="Real estate">
            <NumberFlow value={property.value} format={usd} className="d-h1 d-t1 block" />
            <p className="text-[13px] d-t2 mt-2">{property.name}</p>
            <div className="mt-3 flex items-center justify-between text-[12px]">
              <span className="d-t3">Share of net worth</span>
              <span className="d-num d-t1">{((property.value / total) * 100).toFixed(0)}%</span>
            </div>
            <Meter className="mt-2" pct={property.value / total} color="var(--d-accent)" />
          </Card>
        </div>
      </div>
    </div>
  )
}
