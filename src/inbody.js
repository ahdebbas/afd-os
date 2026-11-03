import { FITNESS } from './data.js'

export function reconcileInbodyReadings(readings) {
  const latest = FITNESS.inbody.at(-1)
  if (readings.some(reading => reading.date === latest.date)) return readings
  return [...readings, latest].sort((a, b) => a.date.localeCompare(b.date))
}
