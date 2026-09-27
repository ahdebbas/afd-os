import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCashProjection, coveredThrough, reconcileCashPulse, setCoverageMonths } from './cashPulse.js'

const now = new Date('2026-09-24T12:00:00')
const base = {
  currentCash: 30000,
  cashAsOf: now.toISOString(),
  commitments: [
    { id: 'parents', name: 'Parents', amount: 2000, dueDay: 31, active: true, startMonth: '2026-09' },
    { id: 'car', name: 'Car', amount: 1000, dueDay: 1, active: true, startMonth: '2026-09' },
  ],
  oneOffs: [{ id: 'school', name: 'School', amount: 1500, dueDate: '2026-10-10' }],
  coverage: {},
}

test('advance coverage preserves cash and excludes only named months', () => {
  const state = setCoverageMonths(base, 'parents', ['2026-09', '2026-10', '2026-11'], true)
  const result = buildCashProjection(state, now)
  assert.equal(result.state.currentCash, 30000)
  assert.equal(result.nextMonthsNeed, 4500)
  assert.equal(result.runwayMonths, 10)
  assert.equal(coveredThrough(state, 'parents', now), '2026-11')
  const undone = setCoverageMonths(state, 'parents', ['2026-10'], false)
  assert.equal(coveredThrough(undone, 'parents', now), '2026-09')
})

test('overdue payments survive month rollover without double counting', () => {
  const result = buildCashProjection(base, new Date('2026-10-05T12:00:00'))
  assert.equal(result.carryoverNeed, 3000)
  assert.equal(result.nextMonthsNeed, 10500)
  assert.equal(result.projectedCash, 16500)
  assert.equal(result.nextPayment.dueDate, '2026-09-01')
  assert.equal(result.overdue.length, 3)
})

test('unpaid old one-offs remain visible and paid ones do not', () => {
  const state = { ...base, commitments: [], oneOffs: [{ ...base.oneOffs[0], dueDate: '2026-08-02' }] }
  assert.equal(buildCashProjection(state, now).carryoverNeed, 1500)
  state.oneOffs[0].coveredAt = now.toISOString()
  assert.equal(buildCashProjection(state, now).carryoverNeed, 0)
})

test('month end and year boundaries produce real dates', () => {
  const result = buildCashProjection(base, new Date('2026-12-24T12:00:00'))
  assert.deepEqual(result.months.map(month => month.key), ['2026-12', '2027-01', '2027-02'])
  assert.equal(result.months[2].items.find(item => item.id === 'parents').dueDate, '2027-02-28')
})

test('legacy commitments start now rather than inventing arrears', () => {
  const normalized = reconcileCashPulse({ ...base, commitments: [{ ...base.commitments[0], startMonth: null }] }, now)
  assert.equal(normalized.commitments[0].startMonth, '2026-09')
  assert.equal(buildCashProjection(normalized, now).carryoverNeed, 0)
})

test('paused and empty commitments do not create monthly coverage', () => {
  const result = buildCashProjection({ ...base, commitments: base.commitments.map(item => ({ ...item, active: false })) }, now)
  assert.equal(result.runwayMonths, null)
  assert.equal(result.nextMonthsNeed, 1500)
  assert.equal(result.carryoverNeed, 0)
})

test('cash snapshot freshness is explicit', () => {
  assert.equal(buildCashProjection(base, now).snapshotStale, false)
  assert.equal(buildCashProjection({ ...base, cashAsOf: null }, now).snapshotStale, true)
  assert.equal(buildCashProjection({ ...base, cashAsOf: '2026-09-01T12:00:00' }, now).snapshotStale, true)
})