const ALIASES = [
  ['Barbell Back Squat', 'Barbell Squat'],
  ['Incline Dumbbell Press', 'Dumbbell Incline Press', 'Incline DB Press'],
  ['Leg Extension', 'Leg Extension Machine'],
  ['Machine Shoulder Press', 'Shoulder Press Machine'],
  ['Cable Rear Delt Fly', 'Rear Delt Cable Fly'],
  ['Hammer Curl', 'Hammer Curl (dumbbell)'],
  ['Bulgarian Split Squat', 'Bulgarian Split Squat (dumbbell)'],
]

const normalize = name => name.trim().replace(/\s+/g, ' ').toLowerCase()
const aliases = new Map(ALIASES.flatMap(group => group.map(name => [normalize(name), group[0]])))
export const exerciseId = name => normalize(aliases.get(normalize(name)) ?? name)
export const exerciseName = name => aliases.get(normalize(name)) ?? name.trim()

export function lastRecordedWeight(sessions, name, beforeDate = '9999-12-31') {
  const id = exerciseId(name)
  const ordered = sessions.filter(session => session.date < beforeDate).sort((a, b) => b.date.localeCompare(a.date))
  for (const session of ordered) {
    const entry = Object.entries(session.weights || {}).find(([key, weight]) =>
      exerciseId(key) === id && Number.isFinite(Number(weight)) && Number(weight) > 0)
    if (entry) return { date: session.date, weight: Number(entry[1]) }
  }
  return null
}

export function workoutPRs(sessions, weights = {}) {
  const best = new Map()
  const consider = (name, weight) => {
    const id = exerciseId(name)
    if (Number.isFinite(Number(weight)) && Number(weight) > (best.get(id)?.[1] ?? 0)) best.set(id, [exerciseName(name), Number(weight)])
  }
  Object.entries(weights).forEach(([name, weight]) => consider(name, weight))
  sessions.forEach(session => Object.entries(session.weights || {}).forEach(([name, weight]) => consider(name, weight)))
  return [...best.values()].sort((a, b) => b[1] - a[1])
}

export const exercisePR = (sessions, name) =>
  workoutPRs(sessions).find(([key]) => exerciseId(key) === exerciseId(name))?.[1] ?? 0

export function loggedExercises(session, program, legacyProgram, day) {
  return session?.exercises ?? (session && !session.templateVersion ? legacyProgram[day]?.exercises : null) ?? program[day].exercises
}

export function workoutSnapshot(exercises, effectiveWeight) {
  const weights = {}
  exercises.forEach(exercise => {
    const weight = effectiveWeight(exercise.name)
    if (weight != null) weights[exercise.name] = weight
  })
  return { exercises: exercises.map(exercise => ({ ...exercise })), weights, templateVersion: 2 }
}
