import { FITNESS } from './data'
import { usePersistentState } from './hooks'

export function useInbodyReadings() {
  return usePersistentState('afd-inbody', FITNESS.inbody, Array.isArray)
}
