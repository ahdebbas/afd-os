import test from 'node:test'
import assert from 'node:assert/strict'
import { formatUsd } from './currency.js'
import { usd, FINANCE, holdingValue } from './data.js'
import { formatCash, reconcileCashPulse } from './cashPulse.js'
import { buildCapitalPulse } from './financePerformance.js'

test('all money formatters use the USD code with grouping and the requested precision', () => {
  for (const value of [0, 1234, -1234]) {
    assert.equal(usd(value), formatCash(value))
    assert.match(usd(value), /USD/)
    assert.ok(!usd(value).includes('$'))
  }
  assert.equal(formatUsd(1234.567), 'USD\u00a01,235')
  assert.equal(usd(1234.567, 2), 'USD\u00a01,234.57')
  assert.equal(formatCash(1234, 'QAR'), 'USD\u00a01,234')
})

test('USD formatting does not convert balances or holding values', () => {
  const cash = reconcileCashPulse({ currency: 'QAR', currentCash: 1234.56 })
  assert.equal(cash.currency, 'USD')
  assert.equal(cash.currentCash, 1234.56)
  const holding = FINANCE.sarwa.holdings[0]
  assert.equal(holdingValue(holding, null), holding.value)
  assert.equal(holdingValue(holding, { 'ISDW.L': { price: 70 } }), holding.units * 70)
})

test('market summaries consistently label gains, losses, and position changes in USD', () => {
  const baseline = { date: '2026-09-24', msft: 1000, sarwa: 500, marketTotal: 1500, msftNetWorthShare: 50, positionsKey: 'original' }
  for (const change of [100, -100]) {
    for (const positionsKey of ['original', 'updated']) {
      const current = { ...baseline, date: '2026-10-01', msft: baseline.msft + change, marketTotal: baseline.marketTotal + change, positionsKey }
      const pulse = buildCapitalPulse([baseline], current)
      assert.ok(pulse.headline.includes('USD\u00a0100'))
      assert.ok(pulse.summary.includes('USD\u00a0100'))
      assert.ok(!pulse.headline.includes('$'))
      assert.ok(!pulse.summary.includes('$'))
    }
  }
})
