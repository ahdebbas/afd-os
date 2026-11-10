import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useOs } from './os'
import { todayKey } from './dates'
import { formatUsd } from './currency.js'
import { FINANCE } from './data.js'
import { usePersistentState } from './hooks'
import { financeQuoteSymbols, QUOTE_REFRESH_MS, freshQuoteCache, mergeQuoteResults, validQuote } from './quoteCache.js'

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

async function fetchQuote(symbol, { signal } = {}) {
  const res = await fetch(`/yq/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`, { signal })
  if (!res.ok) throw new Error(`${symbol}: HTTP ${res.status}`)
  const payload = await res.json()
  const meta = payload.chart?.result?.[0]?.meta
  if (!meta) throw new Error(`${symbol}: ${payload.chart?.error?.description ?? 'Missing quote'}`)
  const price = meta.regularMarketPrice
  const prev = meta.chartPreviousClose
  const quote = {
    name: [meta.longName, meta.shortName].find(name => typeof name === 'string' && name.trim()) || symbol,
    price,
    changePct: Number.isFinite(prev) && prev > 0 ? ((price / prev - 1) * 100) : 0,
    currency: meta.currency,
    low52: Number.isFinite(meta.fiftyTwoWeekLow) && meta.fiftyTwoWeekLow > 0 ? meta.fiftyTwoWeekLow : null,
    high52: Number.isFinite(meta.fiftyTwoWeekHigh) && meta.fiftyTwoWeekHigh > 0 ? meta.fiftyTwoWeekHigh : null,
  }
  if (!validQuote(quote)) throw new Error(`${symbol}: A valid USD price is required. Only USD-priced stocks and ETFs are supported.`)
  return { ...quote, fetchedAt: new Date().toISOString() }
}

const QuotesCtx = createContext(null)

export function QuotesProvider({ children }) {
  const announce = useOs()?.announce
  const [finance] = usePersistentState('afd-finance', FINANCE)
  const symbolsKey = JSON.stringify(financeQuoteSymbols(finance))
  const symbolsRef = useRef(JSON.parse(symbolsKey))
  const [cache, setCache] = useState(() => loadCache())
  const [status, setStatus] = useState(() => {
    const c = loadCache()
    if (!c) return 'idle'
    return isFresh(c, Date.now(), symbolsRef.current) ? 'live' : 'stale'
  })
  const inflight = useRef(null)

  const refresh = useCallback(async function refreshQuotes() {
    const symbols = symbolsRef.current
    const key = JSON.stringify(symbols)
    if (inflight.current) {
      if (inflight.current.key === key) return inflight.current.promise
      await inflight.current.promise
      return refreshQuotes()
    }
    const request = { key }
    request.promise = (async () => {
      setStatus('loading')
      try {
        const results = await Promise.allSettled(symbols.map(symbol => fetchQuote(symbol)))
        const next = { date: todayKey(), ...mergeQuoteResults(loadCache(), results, new Date().toISOString(), symbols) }
        localStorage.setItem(CACHE_KEY, JSON.stringify(next))
        setCache(next)
        setStatus(isFresh(next, Date.now(), symbolsRef.current) ? 'live' : Object.keys(next.data).length ? 'stale' : 'error')
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
      }
    })().finally(() => { inflight.current = null })
    inflight.current = request
    return request.promise
  }, [announce])

  useEffect(() => {
    symbolsRef.current = JSON.parse(symbolsKey)
    const initial = setTimeout(() => {
      if (!isFresh(loadCache(), Date.now(), symbolsRef.current)) refresh()
      else if (!inflight.current) setStatus('live')
    }, 0)
    const id = setInterval(refresh, QUOTE_REFRESH_MS)
    return () => {
      clearTimeout(initial)
      clearInterval(id)
    }
  }, [refresh, symbolsKey])

  const value = {
    data: cache?.data ?? null,
    syncedAt: cache?.syncedAt ?? null,
    status,
    refresh,
    lookupQuote: fetchQuote,
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
    lookupQuote: ctx?.lookupQuote,
  }
}
