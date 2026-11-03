import test from 'node:test'
import assert from 'node:assert/strict'
import { FITNESS } from './data.js'
import { reconcileInbodyReadings } from './inbody.js'

test('latest bundled scan matches the supplied October 8 report', () => {
  assert.deepEqual(FITNESS.inbody.at(-1), {
    date: '2026-10-08', weight: 87.1, smm: 42.4, fatMass: 13.1, fatPct: 15,
    waist: 90.5, waistToHipRatio: 0.89, visceralFatLevel: 5, trunkFat: 7.1,
  })
})

test('older saved histories receive the new scan without losing or mutating readings', () => {
  const saved = [{ date: '2026-08-03', weight: 87.5, smm: 42.1, fatPct: 15.9 }]
  const before = structuredClone(saved)
  const merged = reconcileInbodyReadings(saved)
  assert.equal(merged.length, 2)
  assert.deepEqual(merged[0], saved[0])
  assert.deepEqual(merged[1], FITNESS.inbody.at(-1))
  assert.deepEqual(saved, before)
  assert.equal(reconcileInbodyReadings(merged), merged)
})

test('existing readings on the scan date win and are not overwritten or duplicated', () => {
  const saved = [{ date: '2026-10-08', weight: 87.2, note: 'User correction' }]
  assert.equal(reconcileInbodyReadings(saved), saved)
})

test('newer user readings stay latest after merging the bundled scan', () => {
  const saved = [{ date: '2026-11-01', weight: 86.5 }]
  const merged = reconcileInbodyReadings(saved)
  assert.equal(merged[0].date, '2026-10-08')
  assert.equal(merged.at(-1), saved[0])
  assert.equal(reconcileInbodyReadings(FITNESS.inbody), FITNESS.inbody)
})
