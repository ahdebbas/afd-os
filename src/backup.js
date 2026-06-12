// Local-first backup: export/import all user-generated data as a JSON file.
// Quotes are a derived cache and are intentionally excluded.

const BACKUP_KEYS = ['afd-presets', 'afd-food-log', 'afd-sessions', 'afd-weights', 'afd-fit-day', 'afd-theme-dark']

export function exportData() {
  const data = {}
  for (const key of BACKUP_KEYS) {
    const raw = localStorage.getItem(key)
    if (raw == null) continue
    try { data[key] = JSON.parse(raw) } catch { /* skip unreadable key */ }
  }
  const payload = { app: 'afd-os', version: 1, exportedAt: new Date().toISOString(), data }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `afd-os-backup-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Returns the number of keys restored, or throws on an invalid file. */
export async function importData(file) {
  const text = await file.text()
  const parsed = JSON.parse(text)
  if (!parsed || parsed.app !== 'afd-os' || typeof parsed.data !== 'object') {
    throw new Error('Not a valid AFD OS backup file')
  }
  let restored = 0
  for (const key of BACKUP_KEYS) {
    if (key in parsed.data) {
      localStorage.setItem(key, JSON.stringify(parsed.data[key]))
      restored++
    }
  }
  return restored
}
