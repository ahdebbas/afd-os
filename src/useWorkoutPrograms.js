import { FITNESS, DEFAULT_WEIGHTS } from './data'
import { usePersistentState } from './hooks'
import { LEGACY_BEIRUT_PROGRAM, WORKOUT_GYMS, migrateBeirutProgram } from './workoutPrograms'

const validGym = value => WORKOUT_GYMS.some(gym => gym.id === value)
const validWeights = value => value && typeof value === 'object' && !Array.isArray(value)
const EMPTY_WEIGHTS = {}

export function useWorkoutPrograms(loggedProgramId) {
  const [activeProgramId, setActiveProgramId] = usePersistentState('afd-active-workout-program', 'current', validGym)
  const [current, setCurrent] = usePersistentState('afd-program-v2', FITNESS.program, Array.isArray)
  const [legacyBeirut] = usePersistentState('afd-program-beirut-v1', LEGACY_BEIRUT_PROGRAM, Array.isArray)
  const [beirut, setBeirut] = usePersistentState('afd-program-beirut-v2', null, value => value === null || Array.isArray(value))
  const [currentWeights, setCurrentWeights] = usePersistentState('afd-weights', DEFAULT_WEIGHTS, validWeights)
  const [beirutWeights, setBeirutWeights] = usePersistentState('afd-weights-beirut', EMPTY_WEIGHTS, validWeights)
  const programId = loggedProgramId ?? activeProgramId
  const isBeirut = programId === 'beirut'
  return {
    activeProgramId, setActiveProgramId, programId,
    program: isBeirut ? beirut ?? migrateBeirutProgram(legacyBeirut) : current,
    legacyProgram: isBeirut ? legacyBeirut : current,
    exerciseCatalog: [...current, ...legacyBeirut, ...(beirut ?? migrateBeirutProgram(legacyBeirut))].flatMap(day => day.exercises),
    setProgram: isBeirut ? update => setBeirut(prev => typeof update === 'function' ? update(prev ?? migrateBeirutProgram(legacyBeirut)) : update) : setCurrent,
    weights: isBeirut ? beirutWeights : currentWeights,
    allWeights: { ...currentWeights, ...Object.fromEntries(Object.entries(beirutWeights).map(([name, weight]) =>
      [name, Math.max(weight, currentWeights[name] ?? 0)])) },
    setWeights: isBeirut ? setBeirutWeights : setCurrentWeights,
  }
}
