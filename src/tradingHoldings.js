import { reconcileFinance } from './data.js'
import { validQuote } from './quoteCache.js'

export const normalizeTicker = ticker => ticker.trim().toUpperCase()

export function tradingHoldings(finance) {
  const { msft, sarwaTrade } = reconcileFinance(finance)
  return [
    ...(msft.removed ? [] : [{
      ...msft, ticker: 'MSFT', name: msft.name || 'Microsoft',
      units: msft.shares, value: msft.shares * msft.price,
    }]),
    ...(sarwaTrade?.holdings ?? []),
  ]
}

export function validateTradingStock(finance, ticker, units) {
  if (!/^[A-Z0-9][A-Z0-9.-]*$/.test(ticker) || ticker === 'USD') {
    throw new Error('Enter a stock ticker such as AAPL or BRK-B, not a company name or cash.')
  }
  if (!Number.isFinite(units) || units < 0) throw new Error('Shares must be a finite number of zero or more.')
  if (tradingHoldings(finance).some(holding => holding.ticker === ticker)) {
    throw new Error(`${ticker} is already in Trading. Use Edit shares to change its quantity.`)
  }
}

export function addTradingStock(saved, input, units, quote) {
  const finance = reconcileFinance(saved)
  const ticker = normalizeTicker(input)
  validateTradingStock(finance, ticker, units)
  if (!validQuote(quote)) throw new Error(`${ticker}: A valid USD price is required.`)
  const value = units * quote.price
  if (!Number.isFinite(value)) throw new Error('Position value is too large.')
  const recorded = {
    price: quote.price, priceDate: quote.fetchedAt,
    low52: quote.low52, high52: quote.high52,
  }
  if (ticker === 'MSFT') return {
    ...finance,
    msft: { ...finance.msft, ...recorded, shares: units, dayChangePct: quote.changePct, removed: false },
  }
  const account = finance.sarwaTrade ?? { holdings: [] }
  return {
    ...finance,
    sarwaTrade: { ...account, holdings: [...account.holdings, {
      ...recorded, ticker, symbol: ticker, name: quote.name || ticker, units, recordedUnits: units, value,
    }] },
  }
}

export function removeTradingStock(saved, ticker) {
  const finance = reconcileFinance(saved)
  if (ticker === 'MSFT') return { ...finance, msft: { ...finance.msft, shares: 0, removed: true } }
  return {
    ...finance,
    sarwaTrade: { ...finance.sarwaTrade, holdings: finance.sarwaTrade.holdings.filter(holding => holding.ticker !== ticker) },
  }
}
