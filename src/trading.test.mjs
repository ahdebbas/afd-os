import test from 'node:test'
import assert from 'node:assert/strict'
import { FINANCE, holdingValue, reconcileFinance, sarwaTotal } from './data.js'
import { addTradingStock, normalizeTicker, removeTradingStock, tradingHoldings, validateTradingStock } from './tradingHoldings.js'
import { financeQuoteSymbols, freshQuoteCache, mergeQuoteResults } from './quoteCache.js'
import { buildCapitalPulse, buildFinanceSnapshot, toMarketSnapshot } from './financePerformance.js'
import { portfolioSignal } from './homeInsights.js'

const syncedAt = '2026-11-10T12:00:00Z'
const quote = { name: 'Apple Inc.', price: 200, currency: 'USD', changePct: 2, low52: 100, high52: 300, fetchedAt: syncedAt }
const snapshot = finance => toMarketSnapshot(buildFinanceSnapshot({ finance, quotes: { AAPL: quote }, quoteStatus: 'live', syncedAt }))

test('adding a normalized ticker preserves other accounts and records an offline price, not a cost basis', () => {
  const added = addTradingStock(FINANCE, ' aapl ', 10.5, quote)
  const holding = tradingHoldings(added).find(holding => holding.ticker === 'AAPL')
  assert.equal(holding.name, quote.name)
  assert.equal(holding.units, 10.5)
  assert.equal(holding.priceDate, syncedAt)
  assert.equal(holding.low52, 100)
  assert.equal(holdingValue(holding, null), 2100)
  assert.equal(holdingValue({ ...holding, units: 21 }, null), 4200)
  assert.equal(holdingValue(holding, { AAPL: { ...quote, price: 250 } }), 2625)
  assert.equal(holding.cost, undefined)
  assert.equal(added.properties, FINANCE.properties)
  assert.equal(added.sarwa, FINANCE.sarwa)
  assert.equal(added.msft, FINANCE.msft)
  assert.equal(FINANCE.sarwaTrade.holdings.length, 3)
})

test('invalid inputs, duplicate existing tickers, non-USD prices and overflow cannot create a stock', () => {
  assert.equal(normalizeTicker(' brk-b '), 'BRK-B')
  for (const ticker of ['', 'AAPL/anything', 'Apple Inc', '^GSPC', 'USD']) {
    assert.throws(() => addTradingStock(FINANCE, ticker, 1, quote), /Enter a stock ticker/)
  }
  for (const units of [-1, NaN, Infinity, '10']) {
    assert.throws(() => validateTradingStock(FINANCE, 'AAPL', units), /Shares must/)
  }
  for (const ticker of ['msft', 'GOOGL', 'NVDA', 'SPTE']) {
    assert.throws(() => addTradingStock(FINANCE, ticker, 1, quote), /already in Trading/)
  }
  for (const bad of [null, { ...quote, currency: 'EUR' }, { ...quote, price: 0 }, { ...quote, price: NaN }]) {
    assert.throws(() => addTradingStock(FINANCE, 'AAPL', 1, bad), /valid USD price/)
  }
  assert.throws(() => addTradingStock(FINANCE, 'AAPL', Number.MAX_VALUE, quote), /too large/)
})

test('removing and re-adding Microsoft never creates a duplicate or leaves a ghost value', () => {
  const removed = removeTradingStock(FINANCE, 'MSFT')
  assert.equal(removed.msft.shares, 0)
  assert.equal(removed.msft.removed, true)
  assert.equal(tradingHoldings(removed).some(holding => holding.ticker === 'MSFT'), false)
  assert.equal(snapshot(FINANCE).msft - snapshot(removed).msft, Math.round(FINANCE.msft.shares * FINANCE.msft.price))
  assert.equal(portfolioSignal(removed, null).positions.some(holding => holding.ticker === 'MSFT'), false)
  assert.equal(removed.sarwaTrade, FINANCE.sarwaTrade)
  const restored = addTradingStock(removed, 'msft', 2.5, { ...quote, name: 'Microsoft' })
  assert.equal(restored.msft.shares, 2.5)
  assert.equal(restored.msft.price, quote.price)
  assert.equal(tradingHoldings(restored).filter(holding => holding.ticker === 'MSFT').length, 1)
  assert.equal(restored.sarwaTrade.holdings.some(holding => holding.ticker === 'MSFT'), false)
})

test('an entirely empty Trading account and new stocks survive persistence without reseeding', () => {
  let finance = FINANCE
  for (const holding of tradingHoldings(finance)) finance = removeTradingStock(finance, holding.ticker)
  const restored = reconcileFinance(JSON.parse(JSON.stringify(finance)))
  assert.deepEqual(tradingHoldings(restored), [])
  assert.equal(sarwaTotal(restored.sarwaTrade, { NVDA: quote }), 0)
  assert.equal(restored.msft.shares, 0)
  const added = addTradingStock(restored, 'BRK-B', 0, quote)
  const roundTrip = reconcileFinance(JSON.parse(JSON.stringify(added)))
  const holding = tradingHoldings(roundTrip)[0]
  assert.equal(holding.ticker, 'BRK-B')
  assert.equal(holdingValue(holding), 0)
  assert.equal(holdingValue({ ...holding, units: 2 }), 400)
})

test('dynamic symbol sets deduplicate shared ETFs, ignore cash and stop requiring removed stocks', () => {
  const added = addTradingStock(FINANCE, 'AAPL', 1, quote)
  const shared = addTradingStock(added, 'ISDW.L', 1, quote)
  const symbols = financeQuoteSymbols(shared)
  assert.equal(symbols.filter(symbol => symbol === 'ISDW.L').length, 1)
  assert.equal(symbols.includes('USD'), false)
  assert.equal(symbols.includes('AAPL'), true)
  const previous = mergeQuoteResults(null, financeQuoteSymbols(FINANCE).map(() => ({ status: 'fulfilled', value: quote })), syncedAt, financeQuoteSymbols(FINANCE))
  const now = new Date(syncedAt).getTime()
  assert.equal(freshQuoteCache(previous, now, symbols), false)
  const results = symbols.map(symbol => symbol === 'AAPL'
    ? { status: 'rejected', reason: new Error('Offline') }
    : { status: 'fulfilled', value: quote })
  const partial = mergeQuoteResults(previous, results, syncedAt, symbols)
  assert.deepEqual(partial.errors, ['AAPL: Offline'])
  assert.equal(partial.data.MSFT.price, quote.price)
  assert.equal(partial.data.AAPL, undefined)
  const remaining = financeQuoteSymbols(removeTradingStock(shared, 'AAPL'))
  assert.equal(remaining.includes('AAPL'), false)
  assert.equal(freshQuoteCache(partial, now, remaining), true)
})

test('new symbol result ordering and missing results cannot corrupt another cached quote', () => {
  const merged = mergeQuoteResults(null, [
    { status: 'fulfilled', value: { ...quote, price: 123 } },
    { status: 'fulfilled', value: { ...quote, price: 456 } },
  ], syncedAt, ['NVDA', 'AAPL', 'MISSING'])
  assert.equal(merged.data.NVDA.price, 123)
  assert.equal(merged.data.AAPL.price, 456)
  assert.match(merged.errors[0], /^MISSING:/)
  assert.equal(merged.data.MISSING, undefined)
})

test('verified Trading tickers are not accidentally remapped by Sarwa Invest aliases', () => {
  const added = addTradingStock(FINANCE, 'ISDW', 1, quote)
  const holding = tradingHoldings(added).find(holding => holding.ticker === 'ISDW')
  assert.equal(holdingValue(holding, { ISDW: quote, 'ISDW.L': { ...quote, price: 99 } }), 200)
  assert.equal(financeQuoteSymbols(added).includes('ISDW'), true)
  assert.equal(financeQuoteSymbols(added).includes('ISDW.L'), true)
})

test('adding/removing stocks updates Finance and Home totals and restarts the entire market baseline', () => {
  const added = addTradingStock(FINANCE, 'AAPL', 10.5, quote)
  assert.equal(snapshot(added).marketTotal - snapshot(FINANCE).marketTotal, 2100)
  const before = portfolioSignal(FINANCE, null)
  const after = portfolioSignal(added, null)
  assert.equal(after.total - before.total, 2100)
  assert.equal(after.positions.find(holding => holding.ticker === 'AAPL').asOf, syncedAt)
  for (const [previous, changed] of [
    [FINANCE, added], [added, removeTradingStock(added, 'AAPL')],
    [FINANCE, removeTradingStock(FINANCE, 'MSFT')],
    [FINANCE, removeTradingStock(FINANCE, 'NVDA')],
  ]) {
    const baseline = { ...snapshot(previous), date: '2026-11-01' }
    const current = { ...snapshot(changed), date: '2026-11-10' }
    assert.notEqual(current.positionsKey, baseline.positionsKey)
    const pulse = buildCapitalPulse([baseline], current)
    assert.equal(pulse.primary, undefined)
    assert.equal(pulse.baselineReset, true)
    assert.match(pulse.summary, /Purchases and sales are not gains/)
  }
})
