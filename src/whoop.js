// Client-side WHOOP helpers. The browser only ever holds the Supabase session
// token; all WHOOP secrets live server-side in the /api/whoop/* functions.
import { supabase } from './supabase'

// Client refresh cadence for WHOOP surfaces while the app stays open.
export const WHOOP_POLL_MS = 5 * 60 * 1000

async function accessToken() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data?.session?.access_token ?? null
}

// Full-page redirect into the WHOOP consent flow.
export async function connectWhoop() {
  const t = await accessToken()
  if (!t) return
  const p = new URLSearchParams({ t, returnTo: window.location.origin })
  window.location.href = `/api/whoop/login?${p}`
}

// { connected, kcal, strain, yesterday, weeklyAvg, days } — kcal is calories
// burned this cycle; yesterday/weeklyAvg are cumulative burn at this hour on
// prior days (null until history accumulates).
//
// Client-side cache: every screen (Today, Food, Fitness) fetches WHOOP on mount,
// focus, visibility change, and a poll — which produced bursts of duplicate calls
// that tripped WHOOP's 429 rate limit. We collapse them into at most one upstream
// request per endpoint per TTL window, share any in-flight request, and on failure
// (e.g. 429) keep serving the last good data instead of dropping to an error.
const CACHE_TTL = 60 * 1000
const whoopCache = {
  intraday: { ts: 0, data: null, inflight: null },
  cycles: { ts: 0, data: null, inflight: null },
}
let cacheUser = null

export function clearWhoopCache() {
  cacheUser = null
  for (const key of Object.keys(whoopCache)) whoopCache[key] = { ts: 0, data: null, inflight: null }
}

supabase?.auth.onAuthStateChange?.((_event, session) => {
  if (cacheUser !== session?.user?.id) clearWhoopCache()
})

async function cachedGet(key, url) {
  const { data: sessionData } = supabase ? await supabase.auth.getSession() : { data: null }
  const session = sessionData?.session
  if (!session?.access_token || !session.user?.id) {
    clearWhoopCache()
    return { connected: false }
  }
  const user = session.user.id
  if (cacheUser !== user) {
    clearWhoopCache()
    cacheUser = user
  }
  const c = whoopCache[key]
  if (c.data && Date.now() - c.ts < CACHE_TTL) return c.data
  if (c.inflight) return c.inflight

  c.inflight = (async () => {
    try {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${session.access_token}` } })
      if (cacheUser !== user || whoopCache[key] !== c) return { connected: false }
      if (!r.ok) {
        const body = await r.text().catch(() => '')
        console.warn(`[whoop] ${url} failed`, r.status, body.slice(0, 300))
        // Rate-limited / transient: prefer the last good payload over an error flash.
        return c.data || { connected: false, error: true, status: r.status }
      }
      const data = await r.json()
      if (cacheUser !== user || whoopCache[key] !== c) return { connected: false }
      c.data = data
      c.ts = Date.now()
      return data
    } catch (e) {
      if (cacheUser !== user || whoopCache[key] !== c) return { connected: false }
      console.warn(`[whoop] ${url} threw`, e?.message)
      return c.data || { connected: false, error: true }
    } finally {
      c.inflight = null
    }
  })()
  return c.inflight
}

export const fetchWhoopCalories = () => cachedGet('intraday', '/api/whoop/intraday')

// { connected, cycles: [{ date, kcal, partial }] } — per-day total burn.
export const fetchWhoopCycles = () => cachedGet('cycles', '/api/whoop/cycles')

export async function disconnectWhoop() {
  const t = await accessToken()
  if (!t) return
  const response = await fetch('/api/whoop/disconnect', { method: 'POST', headers: { Authorization: `Bearer ${t}` } })
  if (!response.ok) throw new Error('Could not disconnect WHOOP')
  clearWhoopCache()
}
