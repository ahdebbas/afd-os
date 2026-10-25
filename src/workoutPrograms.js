import { nextWorkoutIdx } from './data.js'

export const WORKOUT_GYMS = [
  { id: 'current', label: 'Current gym' },
  { id: 'beirut', label: 'Beirut' },
]

export const BEIRUT_PROGRAM = [
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

export const sessionProgramId = session => session?.programId ?? 'current'
export const sessionsForProgram = (sessions, programId) =>
  sessions.filter(session => sessionProgramId(session) === programId)
export const nextProgramWorkoutIdx = (program, sessions, programId) =>
  nextWorkoutIdx(program, sessionsForProgram(sessions, programId), Infinity)
