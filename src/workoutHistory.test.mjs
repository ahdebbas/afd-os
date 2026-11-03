import test from 'node:test'
import assert from 'node:assert/strict'
import { exerciseId, exercisePR, lastRecordedWeight, loggedExercises, workoutPRs, workoutSnapshot } from './workoutHistory.js'
import { BEIRUT_PROGRAM, LEGACY_BEIRUT_PROGRAM } from './workoutPrograms.js'

test('identity merges spelling aliases but never different equipment or ambiguous legacy alternatives', () => {
  assert.equal(exerciseId('Barbell Back Squat'), exerciseId('Barbell Squat'))
  assert.equal(exerciseId('Dumbbell Incline Press'), exerciseId('Incline Dumbbell Press'))
  assert.equal(exerciseId(' Cable   Rear Delt Fly '), exerciseId('Rear Delt Cable Fly'))
  assert.notEqual(exerciseId('Hip Thrust Machine'), exerciseId('Barbell Hip Thrust'))
  assert.notEqual(exerciseId('Romanian Deadlift (dumbbell)'), exerciseId('Romanian Deadlift'))
  assert.notEqual(exerciseId('Flat Barbell / Smith Bench Press'), exerciseId('Barbell Bench Press'))
})

test('last logged weight, date and PRs follow shared exercises across programs without mutating sessions', () => {
  const sessions = [
    { date: '2026-10-05', programId: 'beirut', weights: { 'Cable Rear Delt Fly': 17.5 } },
    { date: '2026-10-02', weights: { 'Rear Delt Cable Fly': 20 } },
  ]
  const before = JSON.stringify(sessions)
  assert.deepEqual(lastRecordedWeight(sessions, 'Rear Delt Cable Fly'), { date: '2026-10-05', weight: 17.5 })
  assert.deepEqual(lastRecordedWeight(sessions, 'Cable Rear Delt Fly', '2026-10-05'), { date: '2026-10-02', weight: 20 })
  assert.equal(exercisePR(sessions, 'Rear Delt Cable Fly'), 20)
  assert.deepEqual(workoutPRs(sessions), [['Cable Rear Delt Fly', 20]])
  assert.equal(JSON.stringify(sessions), before)
})

test('invalid weights are ignored and unlogged exercises have no invented date', () => {
  assert.equal(lastRecordedWeight([{ date: '2026-10-01', weights: { 'Lat Pulldown': 'bad' } }], 'Lat Pulldown'), null)
  assert.equal(lastRecordedWeight([], 'Lat Pulldown'), null)
})

test('logging keeps one weight and snapshots exercise swaps without requiring per-set inputs', () => {
  const exercises = BEIRUT_PROGRAM[2].exercises.map((exercise, index) => index === 0 ? { ...exercise, name: 'Incline Dumbbell Press' } : exercise)
  const snapshot = workoutSnapshot(exercises, name => name === 'Incline Dumbbell Press' ? 25 : null)
  assert.deepEqual(snapshot.weights, { 'Incline Dumbbell Press': 25 })
  assert.equal(snapshot.exerciseLogs, undefined)
  assert.equal(snapshot.exercises[0].name, 'Incline Dumbbell Press')
  assert.notEqual(snapshot.exercises[0], exercises[0])
  assert.deepEqual(loggedExercises(snapshot, BEIRUT_PROGRAM, LEGACY_BEIRUT_PROGRAM, 2), exercises)
  assert.equal(BEIRUT_PROGRAM[2].exercises[0].name, 'Incline Chest Press Machine')
})

test('legacy logged Beirut dates retain their original prescription after template update', () => {
  const session = { date: '2026-01-02', programId: 'beirut', idx: 1, weights: { 'Barbell Hip Thrust': 100 } }
  assert.equal(loggedExercises(session, BEIRUT_PROGRAM, LEGACY_BEIRUT_PROGRAM, 1), LEGACY_BEIRUT_PROGRAM[1].exercises)
  assert.equal(loggedExercises(null, BEIRUT_PROGRAM, LEGACY_BEIRUT_PROGRAM, 1), BEIRUT_PROGRAM[1].exercises)
  assert.equal(session.weights['Barbell Hip Thrust'], 100)
})
