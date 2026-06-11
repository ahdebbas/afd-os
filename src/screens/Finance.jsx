const data = {
  msft: { shares: 552, price: 411.74, dayChangePct: -1.44, low52: 356.28, high52: 555.45, priceDate: 'Jun 9, 2026' },
  sarwa: {
    total: 29437.60,
    lastUpdated: 'May 23, 2026',
    holdings: [
      { ticker: 'ISDW', name: 'Developed Mkts (Halal)', alloc: 62.6, value: 18648.93, perf: 11.61 },
      { ticker: 'ISDU', name: 'US Stocks (Halal)',      alloc: 25.9, value: 7700.54,  perf: 17.53 },
      { ticker: 'ISDE', name: 'Emerging Mkts (Halal)', alloc: 6.4,  value: 1906.40,  perf: 25.01 },
      { ticker: 'IGLN', name: 'Gold',                  alloc: 4.0,  value: 1181.73,  perf: -11.96 },
    ],
  },
}

const usd = n => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const colors = ['#30D158', '#64D2FF', '#BF5AF2', '#FFD60A']

export default function Finance() {
  const msftValue = data.msft.shares * data.msft.price
  const total = msftValue + data.sarwa.total
  const pct = ((data.msft.price - data.msft.low52) / (data.msft.high52 - data.msft.low52) * 100).toFixed(1)

  return (
    <div className="p-4 space-y-3">
      {/* Total */}
      <div className="rounded-3xl bg-[#1C1C1E] border border-white/[0.06] p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-1">Total Portfolio</p>
        <p className="text-4xl font-black tracking-tight">{usd(total)}</p>
        <p className="text-sm text-white/40 mt-1">MSFT {usd(msftValue)} · Sarwa {usd(data.sarwa.total)}</p>
      </div>

      {/* MSFT */}
      <div className="rounded-3xl bg-[#1C1C1E] border border-white/[0.06] p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">📊 MSFT Position</p>
        <p className="text-3xl font-black tracking-tight">{usd(msftValue)}</p>
        <span className={`inline-flex items-center gap-1 text-sm font-semibold mt-2 px-2.5 py-1 rounded-lg ${
          data.msft.dayChangePct >= 0 ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
        }`}>
          {data.msft.dayChangePct >= 0 ? '▲' : '▼'} {Math.abs(data.msft.dayChangePct)}% today
        </span>
        <div className="mt-4 space-y-2.5">
          {[['Shares', `${data.msft.shares} sh`], ['Last price', `$${data.msft.price}`], ['As of', data.msft.priceDate]].map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm border-t border-white/[0.06] pt-2.5">
              <span className="text-white/50">{k}</span>
              <span className="font-semibold">{v}</span>
            </div>
          ))}
        </div>
        {/* 52-week range */}
        <div className="mt-4">
          <div className="relative h-1.5 rounded-full bg-white/10">
            <div className="absolute inset-0 rounded-full" style={{ background: 'linear-gradient(90deg,#FF453A,#FFD60A,#30D158)', opacity: 0.4 }} />
            <div className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-md -translate-x-1/2" style={{ left: `${pct}%` }} />
          </div>
          <div className="flex justify-between text-[11px] text-white/30 mt-1.5 font-mono">
            <span>${data.msft.low52}</span>
            <span className="text-white/50 font-medium">52-week</span>
            <span>${data.msft.high52}</span>
          </div>
        </div>
      </div>

      {/* Sarwa */}
      <div className="rounded-3xl bg-[#1C1C1E] border border-white/[0.06] p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">🌱 Sarwa Portfolio</p>
        <p className="text-3xl font-black tracking-tight">{usd(data.sarwa.total)}</p>
        <div className="mt-4 space-y-0">
          {data.sarwa.holdings.map((h, i) => (
            <div key={h.ticker} className="flex items-center justify-between py-3 border-t border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colors[i] }} />
                <div>
                  <span className="font-bold text-sm">{h.ticker}</span>
                  <span className="text-white/40 text-xs ml-1.5">{h.alloc}%</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">{usd(h.value)}</div>
                <div className={`text-xs font-semibold ${h.perf >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {h.perf >= 0 ? '+' : ''}{h.perf}%
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-white/25 mt-3">As of {data.sarwa.lastUpdated}</p>
      </div>
    </div>
  )
}
