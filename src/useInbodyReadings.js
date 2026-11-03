import { FITNESS } from './data'
import { usePersistentState } from './hooks'
import { reconcileInbodyReadings } from './inbody'

export function useInbodyReadings() {
  const [readings, setReadings] = usePersistentState('afd-inbody', FITNESS.inbody, Array.isArray)
  const reconciled = reconcileInbodyReadings(readings)
  if (reconciled !== readings) setReadings(reconciled)
  return [reconciled, setReadings]
}
