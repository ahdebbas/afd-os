export const CLOUD_STATE_KEYS = [
  'afd-presets',
  'afd-food-log',
  'afd-sessions',
  'afd-weights',
  'afd-inbody',
  'afd-program',
  'afd-finance',
  'afd-theme-dark',
]

let syncSink = null
let debounceTimer = null
const pending = new Map()

const canSyncKey = key => CLOUD_STATE_KEYS.includes(key)

export function setCloudSyncSink(sink) {
  syncSink = sink
  flushCloudSyncSoon()
}

export function clearCloudSyncSink() {
  syncSink = null
  pending.clear()
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = null
}

export function queueCloudState(key, value) {
  if (!canSyncKey(key)) return
  pending.set(key, value)
  flushCloudSyncSoon()
}

function flushCloudSyncSoon() {
  if (!syncSink || pending.size === 0) return
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(flushCloudSync, 350)
}

async function flushCloudSync() {
  if (!syncSink || pending.size === 0) return
  const batch = Array.from(pending.entries()).map(([key, value]) => ({ key, value }))
  pending.clear()
  debounceTimer = null
  await syncSink(batch)
}
