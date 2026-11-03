import test from 'node:test'
import assert from 'node:assert/strict'
import { FITNESS } from './data.js'
import { BEIRUT_PROGRAM, LEGACY_BEIRUT_PROGRAM, migrateBeirutProgram, nextProgramWorkoutIdx, sessionProgramId, sessionsForProgram } from './workoutPrograms.js'
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

test('Beirut template matches the requested order, sets, reps and rest exactly', () => {
  assert.deepEqual(BEIRUT_PROGRAM.map(day => day.exercises.map(e => [e.name, e.sets, e.rest])), [
    [
      ['Barbell Back Squat', '3×6–8', 180], ['Barbell Bench Press', '3×6–8', 180],
      ['Incline Dumbbell Press', '3×8–10', 120], ['Lat Pulldown', '3×8–12', 120],
      ['Leg Extension', '3×10–15', 90], ['Cable Lateral Raise', '3×12–20', 60],
      ['Cable Triceps Pushdown', '3×10–15', 60], ['Dumbbell Biceps Curl', '2×10–12', 60],
    ],
    [
      ['Barbell Hip Thrust', '4×6–10', 180], ['Romanian Deadlift', '3×8–10', 180],
      ['Chest Press Machine', '3×8–12', 120], ['Seated Cable Row', '3×8–12', 120],
      ['Seated Leg Curl', '3×10–15', 90], ['Machine Shoulder Press', '3×8–12', 120],
      ['Cable Rear Delt Fly', '3×12–20', 60], ['Hammer Curl', '3×10–12', 60],
    ],
    [
      ['Incline Chest Press Machine', '3×8–12', 120], ['Pull-ups', '3×8–12', 120],
      ['Bulgarian Split Squat', '3×8–10', 120], ['Cable Chest Fly', '2×12–15', 60],
      ['Cable Lateral Raise', '4×12–20', 60], ['Cable Biceps Curl', '3×10–15', 60],
      ['Overhead Cable Triceps Extension', '3×10–15', 60],
    ],
  ])
  assert.deepEqual(BEIRUT_PROGRAM.map(day => day.exercises.reduce((total, exercise) => total + Number(exercise.sets.match(/^\d+/)[0]), 0)), [23, 25, 21])
  assert.equal(BEIRUT_PROGRAM[2].optional, true)
  assert.equal(BEIRUT_PROGRAM[2].exercises[2].perLeg, true)
  assert.deepEqual(BEIRUT_PROGRAM[2].exercises[0].alternatives, ['Incline Dumbbell Press'])
  assert.deepEqual(BEIRUT_PROGRAM[2].exercises[1].alternatives, ['Lat Pulldown'])
})

test('optional C does not advance or enter the mandatory A/B rotation', () => {
  const sessions = [
    { date: '2026-10-01', programId: 'beirut', idx: 0 },
    { date: '2026-10-03', programId: 'beirut', idx: 2 },
  ]
  assert.equal(nextProgramWorkoutIdx(BEIRUT_PROGRAM, sessions, 'beirut'), 1)
  assert.equal(nextProgramWorkoutIdx(BEIRUT_PROGRAM, [...sessions, { date: '2026-10-04', programId: 'beirut', idx: 1 }], 'beirut'), 0)
  assert.equal(nextProgramWorkoutIdx(BEIRUT_PROGRAM, [sessions[1]], 'beirut'), 0)
})

test('Beirut migration preserves legacy data and additions without duplicating aliases', () => {
  const legacy = structuredClone(LEGACY_BEIRUT_PROGRAM)
  legacy[0].exercises.push({ name: 'Calf Raise', sets: '3×12' }, { name: 'Barbell Back Squat', sets: '2×5' })
  const original = JSON.stringify(legacy)
  const qatar = JSON.stringify(FITNESS.program)
  const result = migrateBeirutProgram(legacy)
  assert.equal(result.length, 3)
  assert.equal(result[0].exercises.length, 9)
  assert.deepEqual(result[0].exercises.at(-1), { name: 'Calf Raise', sets: '3×12' })
  assert.equal(JSON.stringify(legacy), original)
  assert.equal(JSON.stringify(FITNESS.program), qatar)
})

test('gym preference and Beirut data are eligible for cloud sync', () => {
  for (const key of ['afd-active-workout-program', 'afd-program-beirut-v1', 'afd-program-beirut-v2', 'afd-weights-beirut', 'afd-workout-swaps']) {
    assert.ok(CLOUD_STATE_KEYS.includes(key))
  }
})
