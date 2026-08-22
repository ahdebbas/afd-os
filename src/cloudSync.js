export const CLOUD_STATE_KEYS = [
  'afd-presets',
  'afd-food-log',
  'afd-sessions',
  'afd-weights',
  'afd-inbody',
  'afd-program',
  'afd-finance',
  'afd-finance-snapshots',
  'afd-theme-dark',
  'afd-shell-mode',
]

export const CLOUD_STATE_EVENT = 'afd-cloud-state'

let syncSink = null
let debounceTimer = null
const pending = new Map()

const canSyncKey = key => CLOUD_STATE_KEYS.includes(key)

export function applyCloudState(key, value, present = true) {
  if (!canSyncKey(key)) return
  if (present) localStorage.setItem(key, JSON.stringify(value))
  else localStorage.removeItem(key)
  window.dispatchEvent(new CustomEvent(CLOUD_STATE_EVENT, { detail: { key, value, present } }))
}

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
