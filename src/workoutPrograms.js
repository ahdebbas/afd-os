import { nextWorkoutIdx, sessionIdx } from './data.js'
import { exerciseId } from './workoutHistory.js'

export const WORKOUT_GYMS = [
  { id: 'current', label: 'Qatar' },
  { id: 'beirut', label: 'Beirut Workout' },
]

export const LEGACY_BEIRUT_PROGRAM = [
  { name: 'Beirut Day A — Chest & Quads', exercises: [
    { name: 'Barbell Squat', sets: '3×6–8' },
    { name: 'Chest Press Machine', sets: '3×6–10' },
    { name: 'Lat Pulldown / Pull-ups', sets: '3×8–10' },
    { name: 'Leg Extension', sets: '3×10–15' },
    { name: 'Dumbbell Incline Press', sets: '3×8–10' },
    { name: 'Dumbbell/Cable Lateral Raise', sets: '3×12–15' },
    { name: 'Cable Triceps Pushdown', sets: '2–3×10–15' },
    { name: 'Cable/DB Biceps Curl', sets: '2–3×10–15' },
  ] },
  { name: 'Beirut Day B — Glutes & Back', exercises: [
    { name: 'Barbell Hip Thrust', sets: '3×6–10' },
    { name: 'Romanian Deadlift', sets: '3×8–10' },
    { name: 'Lat Pulldown / Pull-ups', sets: '3×8–10' },
    { name: 'Seated Leg Curl', sets: '3×10–15' },
    { name: 'Shoulder Press Machine', sets: '3×8–10' },
    { name: 'Cable Row / One-arm DB Row', sets: '3×8–12' },
    { name: 'Lateral Raise', sets: '2–3×12–15' },
    { name: 'Cable Biceps Curl', sets: '2×10–15' },
    { name: 'Cable Triceps Pushdown', sets: '2×10–15' },
  ] },
]

export const BEIRUT_CONFIG = {
  name: 'Beirut Workout',
  location: 'Beirut',
  goal: 'Muscle hypertrophy with emphasis on chest, shoulders, arms and glutes while reducing body fat',
  frequency: '2 mandatory days per week, with an optional third day',
  split: 'Full Body A / Full Body B / Optional Specialization C',
  duration: 'Approximately 75–90 minutes for A and B',
  intensity: '1–2 reps in reserve on compounds; 0–2 on isolations',
  progression: 'Double progression: increase weight after all prescribed sets reach the upper rep target with good form.',
}

export const BEIRUT_PROGRAM = [
  { name: 'Beirut Day A — Chest, Quads & Shoulders', exercises: [
    { name: 'Barbell Back Squat', sets: '3×6–8', rest: 180 },
    { name: 'Barbell Bench Press', sets: '3×6–8', rest: 180 },
    { name: 'Incline Dumbbell Press', sets: '3×8–10', rest: 120 },
    { name: 'Lat Pulldown', sets: '3×8–12', rest: 120 },
    { name: 'Leg Extension', sets: '3×10–15', rest: 90 },
    { name: 'Cable Lateral Raise', sets: '3×12–20', rest: 60 },
    { name: 'Cable Triceps Pushdown', sets: '3×10–15', rest: 60 },
    { name: 'Dumbbell Biceps Curl', sets: '2×10–12', rest: 60 },
  ] },
  { name: 'Beirut Day B — Glutes, Back & Upper Body', exercises: [
    { name: 'Barbell Hip Thrust', sets: '4×6–10', rest: 180 },
    { name: 'Romanian Deadlift', sets: '3×8–10', rest: 180 },
    { name: 'Chest Press Machine', sets: '3×8–12', rest: 120 },
    { name: 'Seated Cable Row', sets: '3×8–12', rest: 120 },
    { name: 'Seated Leg Curl', sets: '3×10–15', rest: 90 },
    { name: 'Machine Shoulder Press', sets: '3×8–12', rest: 120 },
    { name: 'Cable Rear Delt Fly', sets: '3×12–20', rest: 60 },
    { name: 'Hammer Curl', sets: '3×10–12', rest: 60 },
  ] },
  { name: 'Beirut Day C — Optional Chest, Delts & Arms', optional: true, exercises: [
    { name: 'Incline Chest Press Machine', sets: '3×8–12', rest: 120, alternatives: ['Incline Dumbbell Press'] },
    { name: 'Pull-ups', sets: '3×8–12', rest: 120, alternatives: ['Lat Pulldown'] },
    { name: 'Bulgarian Split Squat', sets: '3×8–10', rest: 120, perLeg: true },
    { name: 'Cable Chest Fly', sets: '2×12–15', rest: 60 },
    { name: 'Cable Lateral Raise', sets: '4×12–20', rest: 60 },
    { name: 'Cable Biceps Curl', sets: '3×10–15', rest: 60 },
    { name: 'Overhead Cable Triceps Extension', sets: '3×10–15', rest: 60 },
  ] },
]

export function migrateBeirutProgram(legacy = LEGACY_BEIRUT_PROGRAM) {
  return BEIRUT_PROGRAM.map((day, i) => ({
    ...day,
    exercises: [...day.exercises, ...(legacy[i]?.exercises || []).filter(exercise =>
      !LEGACY_BEIRUT_PROGRAM[i]?.exercises.some(original => original.name === exercise.name)
      && !day.exercises.some(original => exerciseId(original.name) === exerciseId(exercise.name)))],
  }))
}

export const sessionProgramId = session => session?.programId ?? 'current'
export const sessionsForProgram = (sessions, programId) =>
  sessions.filter(session => sessionProgramId(session) === programId)
export const nextProgramWorkoutIdx = (program, sessions, programId) => {
  const mandatory = program.map((day, index) => ({ day, index })).filter(({ day }) => !day.optional)
  if (!mandatory.length) return 0
  const mandatorySessions = sessionsForProgram(sessions, programId).filter(session =>
    mandatory.some(({ index }) => index === sessionIdx(session, program)))
  const rotation = mandatory.map(({ day }) => day)
  const mapped = mandatorySessions.map(session => ({
    ...session, idx: mandatory.findIndex(({ index }) => index === sessionIdx(session, program)),
  }))
  return mandatory[nextWorkoutIdx(rotation, mapped, Infinity)].index
}
