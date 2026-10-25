import { FITNESS, DEFAULT_WEIGHTS } from './data'
import { usePersistentState } from './hooks'
import { BEIRUT_PROGRAM, WORKOUT_GYMS } from './workoutPrograms'

const validGym = value => WORKOUT_GYMS.some(gym => gym.id === value)
const validWeights = value => value && typeof value === 'object' && !Array.isArray(value)
const EMPTY_WEIGHTS = {}

export function useWorkoutPrograms(loggedProgramId) {
  const [activeProgramId, setActiveProgramId] = usePersistentState('afd-active-workout-program', 'current', validGym)
  const [current, setCurrent] = usePersistentState('afd-program-v2', FITNESS.program, Array.isArray)
  const [beirut, setBeirut] = usePersistentState('afd-program-beirut-v1', BEIRUT_PROGRAM, Array.isArray)
  const [currentWeights, setCurrentWeights] = usePersistentState('afd-weights', DEFAULT_WEIGHTS, validWeights)
  const [beirutWeights, setBeirutWeights] = usePersistentState('afd-weights-beirut', EMPTY_WEIGHTS, validWeights)
  const programId = loggedProgramId ?? activeProgramId
  const isBeirut = programId === 'beirut'
  return {
    activeProgramId, setActiveProgramId, programId,
    program: isBeirut ? beirut : current,
    setProgram: isBeirut ? setBeirut : setCurrent,
    weights: isBeirut ? beirutWeights : currentWeights,
    setWeights: isBeirut ? setBeirutWeights : setCurrentWeights,
  }
}
