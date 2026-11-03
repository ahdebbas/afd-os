import { usePersistentState } from './hooks'
import { loggedExercises } from './workoutHistory'

const validSwaps = value => value && typeof value === 'object' && !Array.isArray(value)
const EMPTY_SWAPS = {}

export function useWorkoutExercises({ date, programId, day, program, legacyProgram, session, setSessions }) {
  const [swaps, setSwaps] = usePersistentState('afd-workout-swaps', EMPTY_SWAPS, validSwaps)
  const key = `${date}:${programId}:${day}`
  const base = loggedExercises(session, program, legacyProgram, day)
  const exercises = session ? base : base.map((exercise, index) => ({ ...exercise, name: swaps[key]?.[index] ?? exercise.name }))
  const swapExercise = (index, name) => {
    if (session) {
      setSessions(previous => previous.map(item => item.date === date
        ? { ...item, exercises: exercises.map((exercise, i) => i === index ? { ...exercise, name } : exercise) } : item))
    } else {
      setSwaps(previous => ({ ...previous, [key]: { ...previous[key], [index]: name } }))
    }
  }
  return { exercises, swapExercise }
}
