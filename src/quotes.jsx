import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useOs } from './os'
import { todayKey } from './dates'
import { formatUsd } from './currency.js'
import { QUOTE_SYMBOLS, QUOTE_REFRESH_MS, freshQuoteCache, mergeQuoteResults, validQuote } from './quoteCache.js'

// Hourly market sync via Yahoo Finance.
//  - dev/preview: proxied through Vite (see vite.config.js)
//  - production:  proxied through Netlify (see netlify.toml `/yq/*` redirect)
// Cached in localStorage; refetched at most once per hour, or on manual refresh.

const CACHE_KEY = 'afd-quotes'

const loadCache = () => {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)) } catch { return null }
}

// Fresh while the cached sync is under an hour old.
const isFresh = freshQuoteCache

async function fetchQuote(symbol) {
  const res = await fetch(`/yq/v8/finance/chart/${symbol}?interval=1d&range=1d`)
  if (!res.ok) throw new Error(`${symbol}: HTTP ${res.status}`)
  const payload = await res.json()
  const meta = payload.chart?.result?.[0]?.meta
  if (!meta) throw new Error(`${symbol}: ${payload.chart?.error?.description ?? 'Missing quote'}`)
  const price = meta.regularMarketPrice
  const prev = meta.chartPreviousClose
  const quote = {
    price,
    changePct: Number.isFinite(prev) && prev > 0 ? ((price / prev - 1) * 100) : 0,
    currency: meta.currency,
    low52: Number.isFinite(meta.fiftyTwoWeekLow) && meta.fiftyTwoWeekLow > 0 ? meta.fiftyTwoWeekLow : null,
    high52: Number.isFinite(meta.fiftyTwoWeekHigh) && meta.fiftyTwoWeekHigh > 0 ? meta.fiftyTwoWeekHigh : null,
  }
  if (!validQuote(quote)) throw new Error(`${symbol}: Invalid USD quote`)
  return quote
}

const QuotesCtx = createContext(null)

export function QuotesProvider({ children }) {
  const announce = useOs()?.announce
  const [cache, setCache] = useState(() => loadCache())
  const [status, setStatus] = useState(() => {
    const c = loadCache()
    if (!c) return 'idle'
    return isFresh(c) ? 'live' : 'stale'
  })
  const inflight = useRef(false)

  const refresh = useCallback(async () => {
    if (inflight.current) return
    inflight.current = true
    setStatus('loading')
    try {
      const results = await Promise.allSettled(QUOTE_SYMBOLS.map(fetchQuote))
      const next = { date: todayKey(), ...mergeQuoteResults(loadCache(), results, new Date().toISOString()) }
      localStorage.setItem(CACHE_KEY, JSON.stringify(next))
      setCache(next)
      setStatus(next.errors.length ? Object.keys(next.data).length ? 'stale' : 'error' : 'live')
      if (next.errors.length) {
        console.error('Market sync incomplete:', next.errors)
        announce?.(`MARKET SYNC INCOMPLETE · ${next.errors.join(' · ')}`, 'var(--warn)')
      }
      const m = next.data.MSFT
      if (!next.errors.length && m) announce?.(`MARKET SYNC · MSFT ${formatUsd(m.price, 2)}${m.changePct == null ? '' : ` ${m.changePct >= 0 ? '+' : ''}${m.changePct.toFixed(1)}%`}`, 'var(--acc-fin)')
    } catch (error) {
      console.error('Market sync failed:', error)
      announce?.(`MARKET SYNC FAILED · ${error.message}`, 'var(--down)')
      // Offline or proxy unavailable — keep cached/static values, flag freshness.
      setStatus(loadCache() ? 'stale' : 'error')
    } finally {
      inflight.current = false
    }
  }, [announce])

  useEffect(() => {
    // Fetch on mount unless the cache is still fresh, then poll hourly.
    const initial = setTimeout(() => {
      if (!isFresh(loadCache())) refresh()
    }, 0)
    const id = setInterval(refresh, QUOTE_REFRESH_MS)
    return () => {
      clearTimeout(initial)
      clearInterval(id)
    }
  }, [refresh])

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
