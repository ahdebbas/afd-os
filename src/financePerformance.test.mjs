import test from 'node:test'
import assert from 'node:assert/strict'
import { FINANCE, reconcileFinance, holdingValue, sarwaTotal } from './data.js'
import { buildFinanceSnapshot, toMarketSnapshot, buildCapitalPulse } from './financePerformance.js'

const quotes = {
  MSFT: { price: 500, changePct: 1, currency: 'USD' },
  GOOGL: { price: 300, changePct: 2, currency: 'USD' },
  NVDA: { price: 200, changePct: -3, currency: 'USD' },
  SPTE: { price: 50, changePct: 0.5, currency: 'USD' },
}
const snapshot = finance => buildFinanceSnapshot({ finance, quotes, quoteStatus: 'live', syncedAt: '2026-11-10T12:00:00Z' })

test('Trade seeds screenshot quantities and recorded values, never inferred costs', () => {
  assert.deepEqual(FINANCE.sarwaTrade.holdings.map(h => [h.ticker, h.units, h.value]), [
    ['GOOGL', 41.21, 11968.58], ['NVDA', 68.27, 12201.51], ['SPTE', 348.3, 15255.58],
  ])
  for (const holding of FINANCE.sarwaTrade.holdings) {
    assert.equal(holding.cost, undefined)
    assert.equal(holdingValue(holding, null), holding.value)
    assert.equal(holdingValue(holding, quotes), holding.units * quotes[holding.ticker].price)
    assert.equal(holdingValue({ ...holding, units: 0 }, quotes), 0)
    assert.equal(holdingValue({ ...holding, units: 0 }, null), 0)
    assert.equal(holdingValue({ ...holding, units: holding.units * 2 }, null), holding.value * 2)
  }
  assert.ok(Math.abs(sarwaTotal(FINANCE.sarwaTrade, null) - 39425.67) < 1e-8)
  assert.equal(sarwaTotal(FINANCE.sarwaTrade, quotes), 43432)
})

test('version 2 migration adds Trade without resetting saved holdings, values, or quantities', () => {
  const saved = structuredClone(FINANCE)
  saved.version = 2
  delete saved.sarwaTrade
  saved.msft.shares = 42
  saved.property.value = 123456
  saved.sarwa.holdings[0].units = 0
  saved.sarwa.holdings[0].value = 987
  const migrated = reconcileFinance(saved)
  assert.equal(migrated.msft, saved.msft)
  assert.equal(migrated.property, saved.property)
  assert.equal(migrated.sarwa, saved.sarwa)
  assert.deepEqual(migrated.sarwaTrade, FINANCE.sarwaTrade)
  assert.equal(reconcileFinance(migrated), migrated)
  migrated.sarwaTrade = structuredClone(migrated.sarwaTrade)
  migrated.sarwaTrade.holdings[0].units = 9
  assert.equal(reconcileFinance(migrated).sarwaTrade.holdings[0].units, 9)
  const restored = JSON.parse(JSON.stringify(migrated))
  assert.deepEqual(reconcileFinance(restored), migrated)
})

test('legacy migration still refreshes old halal data and preserves edited units', () => {
  const migrated = reconcileFinance({ version: 1, msft: { shares: 12 }, sarwa: { holdings: [{ ticker: 'ISDW', units: 11 }] } })
  assert.equal(migrated.sarwa.holdings[0].units, 11)
  assert.equal(migrated.sarwa.holdings[0].cost, FINANCE.sarwa.holdings[0].cost)
  assert.equal(migrated.msft.shares, 12)
  assert.deepEqual(migrated.sarwaTrade, FINANCE.sarwaTrade)
})

test('Finance totals, allocations, and market snapshots include Trade exactly once and exclude property from market totals', () => {
  const result = snapshot(FINANCE)
  assert.equal(result.sarwaTrade.value, 43432)
  assert.equal(result.totalValue, Math.round(552 * 500 + sarwaTotal(FINANCE.sarwa, quotes) + 43432 + 420000))
  assert.equal(result.sarwaTrade.totalReturn, null)
  assert.deepEqual(result.sarwaTrade.holdings.map(h => h.dayChange), [2, -3, 0.5])
  assert.ok(Math.abs(Object.values(result.allocations).reduce((a, b) => a + b) - 100) < 0.2)
  const market = toMarketSnapshot(result)
  assert.equal(market.sarwaTrade, 43432)
  assert.equal(market.marketTotal, result.msft.value + result.sarwa.value + 43432)
})

test('Trade price changes affect market contributors without marking positions changed', () => {
  const current = toMarketSnapshot(snapshot(FINANCE))
  const baseline = { ...current, date: '2026-11-01', sarwaTrade: current.sarwaTrade - 500, marketTotal: current.marketTotal - 500 }
  current.date = '2026-11-10'
  const pulse = buildCapitalPulse([baseline], current)
  assert.equal(pulse.primary.sarwaTradeChange, 500)
  assert.equal(pulse.primary.totalChange, 500)
  assert.equal(pulse.primary.positionsChanged, false)
  assert.match(pulse.summary, /Trading/)
})

test('market contributors group Microsoft and Trade without changing the saved snapshot shape', () => {
  const baseline = { date: '2026-11-01', msft: 10000, sarwa: 5000, sarwaTrade: 2000, marketTotal: 17000, msftNetWorthShare: 50, positionsKey: 'same' }
  const current = { ...baseline, date: '2026-11-10', msft: 11000, sarwaTrade: 1100, sarwa: 5200, marketTotal: 17300 }
  const pulse = buildCapitalPulse([baseline], current)
  assert.equal(pulse.primary.msftChange, 1000)
  assert.equal(pulse.primary.sarwaTradeChange, -900)
  assert.equal(pulse.primary.totalChange, 300)
  assert.match(pulse.summary, /Sarwa Invest was the largest contributor at \+USD/)
})

test('old snapshots without Trade remain readable and addition/editing is labelled as a position change', () => {
  const current = { ...toMarketSnapshot(snapshot(FINANCE)), date: '2026-11-10' }
  const baseline = { ...current, date: '2026-11-01', marketTotal: current.marketTotal - current.sarwaTrade }
  delete baseline.sarwaTrade
  delete baseline.positionsKey
  const pulse = buildCapitalPulse([baseline], current)
  assert.equal(pulse.primary.sarwaTradeChange, 43432)
  assert.equal(pulse.primary.positionsChanged, true)
  assert.match(pulse.summary, /Holdings changed/)
  const edited = structuredClone(FINANCE)
  edited.sarwaTrade.holdings[0].units = 0
  assert.notEqual(snapshot(edited).positionsKey, snapshot(FINANCE).positionsKey)
  const oldFinance = { ...FINANCE }
  delete oldFinance.sarwaTrade
  assert.equal(snapshot(oldFinance).sarwaTrade.value, 0)
})
