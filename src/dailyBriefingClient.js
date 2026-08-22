import { supabase } from './supabase'

const CACHE_KEY = 'afd-daily-briefing'
const COOLDOWN_MS = 2 * 60 * 60 * 1000

const fingerprint = context => JSON.stringify(context)

const readCache = () => {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)) }
  catch { return null }
}

export function cachedBriefing(context) {
  const cached = readCache()
  if (!cached || !Array.isArray(cached.bullets) || cached.date !== context.date || cached.phase !== context.phase) return null
  return cached
}

export async function requestDailyBriefing(context, { force = false } = {}) {
  const cached = cachedBriefing(context)
  const contextFingerprint = fingerprint(context)
  const fresh = cached && cached.fingerprint === contextFingerprint && Date.now() - new Date(cached.generatedAt).getTime() < COOLDOWN_MS
  if (!force && fresh) return cached

  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not authenticated')
  const response = await fetch('/api/ai/daily-briefing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ context }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'Could not generate briefing')
  const next = {
    ...result.briefing,
    date: context.date,
    phase: context.phase,
    fingerprint: contextFingerprint,
    generatedAt: result.generatedAt,
  }
  localStorage.setItem(CACHE_KEY, JSON.stringify(next))
  return next
}