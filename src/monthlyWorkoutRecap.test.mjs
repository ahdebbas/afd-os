import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMonthlyWorkoutRecap } from './monthlyWorkoutRecap.js'
import { dateKey } from './dates.js'

test('workout recap follows the supplied local calendar day at month rollover', () => {
  const sessions = [
    { date: '2026-09-30', name: 'Chest & Triceps' },
    { date: '2026-10-01', name: 'Glutes & Hams' },
    { date: '2026-10-02', name: 'Back & Biceps' },
  ]
  const now = new Date(2026, 9, 1, 0, 5)
  const recap = buildMonthlyWorkoutRecap({ sessions, now })
  assert.equal(dateKey(now), '2026-10-01')
  assert.equal(recap.sessionsCount, 1)
  assert.equal(recap.splitBreakdown[0].name, 'Glutes & Hams')
})
