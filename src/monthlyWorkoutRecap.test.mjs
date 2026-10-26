import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMonthlyWorkoutRecap } from './monthlyWorkoutRecap.js'
import { dateKey } from './dates.js'

test('recap combines session totals but never compares weights between gyms', () => {
  const sessions = [
    { date: '2026-09-30', name: 'Chest', weights: { 'Chest Press Machine': 30 } },
    { date: '2026-09-30', programId: 'beirut', name: 'Beirut A', weights: { 'Chest Press Machine': 70 } },
    { date: '2026-10-01', name: 'Chest', weights: { 'Chest Press Machine': 35 } },
    { date: '2026-10-02', programId: 'beirut', name: 'Beirut A', weights: { 'Chest Press Machine': 75 } },
  ]
  const recap = buildMonthlyWorkoutRecap({ sessions, now: new Date(2026, 9, 3) })
  assert.equal(recap.sessionsCount, 2)
  assert.deepEqual(recap.topGains, [
    { exercise: 'Chest Press Machine', delta: 5 },
    { exercise: 'Chest Press Machine (Beirut)', delta: 5 },
  ])
})

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

test('monthly pace uses the saved weekly goal without changing the default', () => {
  const sessions = [{ date: '2026-10-01', name: 'Chest' }]
  const now = new Date(2026, 9, 14)
  assert.match(buildMonthlyWorkoutRecap({ sessions, now, weeklyTarget: 3 }).paceNote, /~6 on a 3×\/week pace/)
  assert.match(buildMonthlyWorkoutRecap({ sessions, now }).paceNote, /~8 on a 4×\/week pace/)
})
