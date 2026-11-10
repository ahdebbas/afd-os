import test from 'node:test'
import assert from 'node:assert/strict'
import { FINANCE, propertyTotal, reconcileFinance } from './data.js'
import { buildCapitalPulse, buildFinanceSnapshot, toMarketSnapshot } from './financePerformance.js'

test('legacy single-property data migrates once without inventing a purchase value', () => {
  for (const version of [1, 2, 3]) {
    const saved = structuredClone(FINANCE)
    saved.version = version
    delete saved.properties
    saved.property = { name: 'Property X', location: 'Beirut', value: 123456.78 }
    const migrated = reconcileFinance(saved)
    assert.equal(migrated.version, FINANCE.version)
    assert.deepEqual(migrated.properties, [{
      id: 'legacy-property', name: 'Property X', location: 'Beirut', purchaseValue: null, currentValue: 123456.78,
    }])
    assert.equal(migrated.property, undefined)
    assert.equal(reconcileFinance(migrated), migrated)
    assert.equal(migrated.msft, saved.msft)
    assert.equal(migrated.sarwaTrade, saved.sarwaTrade)
    if (version >= 2) assert.equal(migrated.sarwa, saved.sarwa)
  }
})

test('migration preserves an explicitly recorded zero purchase value', () => {
  const saved = { ...FINANCE, version: 3, properties: undefined, property: { name: 'Gifted property', value: 250000, purchaseValue: 0 } }
  assert.equal(reconcileFinance(saved).properties[0].purchaseValue, 0)
})

test('multiple properties total current values only, never purchase values', () => {
  const finance = { ...FINANCE, properties: [
    { id: 'x', name: 'Property X', purchaseValue: 200000, currentValue: 250000.50 },
    { id: 'y', name: 'Property Y', purchaseValue: null, currentValue: 100000.25 },
    { id: 'z', name: 'Property Z', purchaseValue: 40000, currentValue: 0 },
  ] }
  assert.equal(propertyTotal(finance), 350000.75)
  const before = buildFinanceSnapshot({ finance: FINANCE })
  const after = buildFinanceSnapshot({ finance })
  assert.equal(after.totalValue, Math.round(before.totalValue - 420000 + 350000.75))
  assert.equal(after.property.value, 350001)
  assert.equal(after.positionsKey, before.positionsKey)
  assert.equal(toMarketSnapshot(after).marketTotal, toMarketSnapshot(before).marketTotal)
})

test('purchase value and property naming updates cannot change net worth or market gains', () => {
  const before = buildFinanceSnapshot({ finance: FINANCE })
  const finance = structuredClone(FINANCE)
  finance.properties[0].name = 'Property X'
  finance.properties[0].purchaseValue = 200000
  const after = buildFinanceSnapshot({ finance })
  assert.equal(after.totalValue, before.totalValue)
  assert.deepEqual({ ...toMarketSnapshot(after), recordedAt: null }, { ...toMarketSnapshot(before), recordedAt: null })
})

test('property valuation changes do not reset or inflate market performance', () => {
  const finance = structuredClone(FINANCE)
  finance.properties[0].currentValue += 50000
  const before = buildFinanceSnapshot({ finance: FINANCE })
  const after = buildFinanceSnapshot({ finance })
  const pulse = buildCapitalPulse(
    [{ ...toMarketSnapshot(before), date: '2026-11-09' }],
    { ...toMarketSnapshot(after), date: '2026-11-10' },
  )
  assert.equal(after.totalValue - before.totalValue, 50000)
  assert.equal(pulse.primary.totalChange, 0)
  assert.equal(pulse.baselineReset, false)
})

test('empty property collections stay empty after migration and reload', () => {
  const finance = { ...FINANCE, version: 3, properties: [] }
  const migrated = reconcileFinance(finance)
  assert.deepEqual(migrated.properties, [])
  assert.equal(propertyTotal(migrated), 0)
  const restored = reconcileFinance(JSON.parse(JSON.stringify(migrated)))
  assert.deepEqual(restored.properties, [])
  assert.equal(buildFinanceSnapshot({ finance: restored }).property.value, 0)
})

test('saved property entries survive JSON round trips without resetting their values', () => {
  const finance = { ...FINANCE, properties: [
    { id: 'x', name: 'Property X', location: 'Beirut', purchaseValue: 125000.25, currentValue: 150000.50 },
    { id: 'y', name: 'Property Y', location: '', purchaseValue: null, currentValue: 0 },
  ] }
  assert.deepEqual(reconcileFinance(JSON.parse(JSON.stringify(finance))), finance)
})
