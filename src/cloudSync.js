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
const CLOUD_DIRTY_KEYS = 'afd-cloud-dirty-keys'

let syncSink = null
let debounceTimer = null
const pending = new Map()

const canSyncKey = key => CLOUD_STATE_KEYS.includes(key)

const readDirtyKeys = () => {
  try {
    const keys = JSON.parse(localStorage.getItem(CLOUD_DIRTY_KEYS) || '[]')
    return new Set(Array.isArray(keys) ? keys.filter(canSyncKey) : [])
  } catch {
    return new Set()
  }
}

const writeDirtyKeys = keys => {
  try {
    if (keys.size) localStorage.setItem(CLOUD_DIRTY_KEYS, JSON.stringify([...keys]))
    else localStorage.removeItem(CLOUD_DIRTY_KEYS)
  } catch { /* best-effort metadata; app state remains available locally */ }
}

const markCloudStateDirty = key => {
  const keys = readDirtyKeys()
  keys.add(key)
  writeDirtyKeys(keys)
}

export const isCloudStateDirty = key => readDirtyKeys().has(key)

export const shouldPreserveHydrationChange = (hydrationUserId, userId, localChanged, unsynced = false) =>
  (localChanged || unsynced) && (!hydrationUserId || hydrationUserId === userId)

export function discardCloudStateDirty(key) {
  const keys = readDirtyKeys()
  keys.delete(key)
  writeDirtyKeys(keys)
}

export function confirmCloudStateSynced(key, value) {
  if (localStorage.getItem(key) === JSON.stringify(value)) discardCloudStateDirty(key)
}

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
  markCloudStateDirty(key)
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
