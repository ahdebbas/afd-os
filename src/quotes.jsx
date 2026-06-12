import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useOs } from './os'

// Daily market sync via Yahoo Finance.
//  - dev/preview: proxied through Vite (see vite.config.js)
//  - production:  proxied through Netlify (see netlify.toml `/yq/*` redirect)
// Cached in localStorage; refetched at most once per calendar day, or on manual refresh.

const SYMBOLS = ['MSFT', 'ISDW.L', 'ISDU.L', 'ISDE.L', 'IGLN.L']
const CACHE_KEY = 'afd-quotes'
const todayKey = () => new Date().toISOString().slice(0, 10)

const loadCache = () => {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)) } catch { return null }
}

async function fetchQuote(symbol) {
  const res = await fetch(`/yq/v8/finance/chart/${symbol}?interval=1d&range=1d`)
  if (!res.ok) throw new Error(`${symbol}: HTTP ${res.status}`)
  const meta = (await res.json()).chart.result[0].meta
  const price = meta.regularMarketPrice
  const prev = meta.chartPreviousClose
  return { price, changePct: prev ? ((price / prev - 1) * 100) : 0, currency: meta.currency }
}

const QuotesCtx = createContext(null)

export function QuotesProvider({ children }) {
  const os = useOs()
  const [cache, setCache] = useState(() => loadCache())
  const [status, setStatus] = useState(() => {
    const c = loadCache()
    if (!c) return 'idle'
    return c.date === todayKey() ? 'live' : 'stale'
  })
  const inflight = useRef(false)

  const refresh = useCallback(async () => {
    if (inflight.current) return
    inflight.current = true
    setStatus('loading')
    try {
      const pairs = await Promise.all(SYMBOLS.map(s => fetchQuote(s).then(q => [s, q])))
      const next = { date: todayKey(), syncedAt: new Date().toISOString(), data: Object.fromEntries(pairs) }
      localStorage.setItem(CACHE_KEY, JSON.stringify(next))
      setCache(next)
      setStatus('live')
      const m = next.data.MSFT
      os?.announce(`MARKET SYNC · MSFT $${m.price.toFixed(2)} ${m.changePct >= 0 ? '+' : ''}${m.changePct.toFixed(1)}%`, 'var(--acc-fin)')
    } catch {
      // Offline or proxy unavailable — keep cached/static values, flag freshness.
      setStatus(loadCache() ? 'stale' : 'error')
    } finally {
      inflight.current = false
    }
  }, [os])

  useEffect(() => {
    if (cache?.date === todayKey()) return
    const id = setTimeout(refresh, 0)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = {
    data: cache?.data ?? null,
    syncedAt: cache?.syncedAt ?? null,
    status,
    refresh,
  }
  return <QuotesCtx.Provider value={value}>{children}</QuotesCtx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useQuotes = () => useContext(QuotesCtx)?.data ?? null

// eslint-disable-next-line react-refresh/only-export-components
export const useQuotesMeta = () => {
  const ctx = useContext(QuotesCtx)
  return {
    status: ctx?.status ?? 'idle',
    syncedAt: ctx?.syncedAt ?? null,
    refresh: ctx?.refresh ?? (() => {}),
  }
}
