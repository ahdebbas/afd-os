import { holdingSymbol, reconcileFinance } from './data.js'

export const QUOTE_SYMBOLS = ['MSFT', 'ISDW.L', 'ISDU.L', 'ISDE.L', 'IGLN.L', 'QQQ', 'GOOGL', 'NVDA', 'SPTE']
export const QUOTE_REFRESH_MS = 60 * 60 * 1000
export const QUOTE_CACHE_VERSION = 1

export const validQuote = quote =>
  Number.isFinite(quote?.price) && quote.price > 0 && quote.currency === 'USD'

export function financeQuoteSymbols(saved) {
  const finance = reconcileFinance(saved)
  // Keep the existing MSFT/QQQ market feeds independent of Trading membership.
  return [...new Set(['MSFT', 'QQQ', ...[finance.sarwa, finance.sarwaTrade].flatMap(account =>
    (account?.holdings ?? []).filter(holding => holding.ticker !== 'USD').map(holdingSymbol))])]
}

export const freshQuoteCache = (cache, now = Date.now(), symbols = QUOTE_SYMBOLS) =>
  cache?.version === QUOTE_CACHE_VERSION && !!cache.syncedAt && now - new Date(cache.syncedAt).getTime() >= 0 &&
  now - new Date(cache.syncedAt).getTime() < QUOTE_REFRESH_MS &&
  symbols.every(symbol => validQuote(cache.data?.[symbol]) &&
    cache.data[symbol].fetchedAt === cache.syncedAt)

export function mergeQuoteResults(previous, results, syncedAt, symbols = QUOTE_SYMBOLS) {
  const data = { ...previous?.data }
  const errors = []
  symbols.forEach((symbol, index) => {
    const result = results[index]
    if (result?.status === 'fulfilled' && validQuote(result.value)) {
      data[symbol] = { ...result.value, fetchedAt: syncedAt }
    } else {
      errors.push(`${symbol}: ${result?.status === 'rejected' ? result.reason?.message ?? 'Quote unavailable' : 'Invalid USD quote'}`)
    }
  })
  return { version: QUOTE_CACHE_VERSION, data, syncedAt, errors }
}
