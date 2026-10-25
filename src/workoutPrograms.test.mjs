import test from 'node:test'
import assert from 'node:assert/strict'
import { FITNESS } from './data.js'
import { BEIRUT_PROGRAM, nextProgramWorkoutIdx, sessionProgramId, sessionsForProgram } from './workoutPrograms.js'
import { CLOUD_STATE_KEYS } from './cloudSync.js'

test('legacy sessions remain in the current gym without mutating history', () => {
  const sessions = [
    { date: '2026-01-01', idx: 2, name: FITNESS.program[2].name },
    { date: '2026-01-02', programId: 'beirut', idx: 0, name: BEIRUT_PROGRAM[0].name },
  ]
  assert.equal(sessionProgramId(sessions[0]), 'current')
  assert.deepEqual(sessionsForProgram(sessions, 'current'), [sessions[0]])
  assert.deepEqual(sessionsForProgram(sessions, 'beirut'), [sessions[1]])
  assert.equal(sessions[0].programId, undefined)
})

test('each gym resumes its own rotation after months away, regardless of the other gym', () => {
  const sessions = [
    { date: '2025-01-01', idx: 2, name: FITNESS.program[2].name },
    { date: '2025-01-02', programId: 'beirut', idx: 0, name: BEIRUT_PROGRAM[0].name },
  ]
  assert.equal(nextProgramWorkoutIdx(FITNESS.program, sessions, 'current'), 3)
  assert.equal(nextProgramWorkoutIdx(BEIRUT_PROGRAM, sessions, 'beirut'), 1)
  assert.equal(nextProgramWorkoutIdx(BEIRUT_PROGRAM, sessions.slice(0, 1), 'beirut'), 0)
  assert.equal(nextProgramWorkoutIdx(FITNESS.program, [], 'current'), 0)
})

test('both rotations wrap and history ordering does not affect the suggestion', () => {
  const sessions = [
    { date: '2025-01-04', programId: 'beirut', idx: 1 },
    { date: '2025-01-03', idx: 3 },
    { date: '2025-01-01', programId: 'beirut', idx: 0 },
  ]
  assert.equal(nextProgramWorkoutIdx(FITNESS.program, sessions, 'current'), 0)
  assert.equal(nextProgramWorkoutIdx(BEIRUT_PROGRAM, sessions, 'beirut'), 0)
})

test('Beirut template matches the requested order, sets and reps including both arm exercises', () => {
  assert.deepEqual(BEIRUT_PROGRAM.map(day => day.exercises.map(e => [e.name, e.sets])), [
    [
      ['Barbell Squat', '3×6–8'], ['Chest Press Machine', '3×6–10'],
      ['Lat Pulldown / Pull-ups', '3×8–10'], ['Leg Extension', '3×10–15'],
      ['Dumbbell Incline Press', '3×8–10'], ['Dumbbell/Cable Lateral Raise', '3×12–15'],
      ['Cable Triceps Pushdown', '2–3×10–15'], ['Cable/DB Biceps Curl', '2–3×10–15'],
    ],
    [
      ['Barbell Hip Thrust', '3×6–10'], ['Romanian Deadlift', '3×8–10'],
      ['Lat Pulldown / Pull-ups', '3×8–10'], ['Seated Leg Curl', '3×10–15'],
      ['Shoulder Press Machine', '3×8–10'], ['Cable Row / One-arm DB Row', '3×8–12'],
      ['Lateral Raise', '2–3×12–15'], ['Cable Biceps Curl', '2×10–15'],
      ['Cable Triceps Pushdown', '2×10–15'],
    ],
  ])
})

test('gym preference and Beirut data are eligible for cloud sync', () => {
  for (const key of ['afd-active-workout-program', 'afd-program-beirut-v1', 'afd-weights-beirut']) {
    assert.ok(CLOUD_STATE_KEYS.includes(key))
  }
})
