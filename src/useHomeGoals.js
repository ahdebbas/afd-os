import { usePersistentState } from './hooks'
import { DEFAULT_HOME_STATE, HOME_STATE_KEY, validHomeState } from './homeGoals'

export function useHomeGoals() {
  return usePersistentState(HOME_STATE_KEY, DEFAULT_HOME_STATE, validHomeState)
}
