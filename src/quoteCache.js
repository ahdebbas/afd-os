export const QUOTE_SYMBOLS = ['MSFT', 'ISDW.L', 'ISDU.L', 'ISDE.L', 'IGLN.L', 'QQQ', 'GOOGL', 'NVDA', 'SPTE']
export const QUOTE_REFRESH_MS = 60 * 60 * 1000
export const QUOTE_CACHE_VERSION = 1

export const validQuote = quote =>
  Number.isFinite(quote?.price) && quote.price > 0 && quote.currency === 'USD'

export const freshQuoteCache = (cache, now = Date.now()) =>
  cache?.version === QUOTE_CACHE_VERSION && !!cache.syncedAt && now - new Date(cache.syncedAt).getTime() >= 0 &&
  now - new Date(cache.syncedAt).getTime() < QUOTE_REFRESH_MS &&
  QUOTE_SYMBOLS.every(symbol => validQuote(cache.data?.[symbol]) &&
    cache.data[symbol].fetchedAt === cache.syncedAt)

export function mergeQuoteResults(previous, results, syncedAt) {
  const data = { ...previous?.data }
  const errors = []
  results.forEach((result, index) => {
    const symbol = QUOTE_SYMBOLS[index]
    if (result.status === 'fulfilled' && validQuote(result.value)) {
      data[symbol] = { ...result.value, fetchedAt: syncedAt }
    } else {
      errors.push(`${symbol}: ${result.status === 'rejected' ? result.reason?.message ?? 'Quote unavailable' : 'Invalid USD quote'}`)
    }
  })
  return { version: QUOTE_CACHE_VERSION, data, syncedAt, errors }
}
