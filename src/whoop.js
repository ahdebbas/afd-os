// Client-side WHOOP helpers. The browser only ever holds the Supabase session
// token; all WHOOP secrets live server-side in the /api/whoop/* functions.
import { supabase } from './supabase'

async function accessToken() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data?.session?.access_token ?? null
}

// Full-page redirect into the WHOOP consent flow.
export async function connectWhoop() {
  const t = await accessToken()
  if (!t) return
  window.location.href = `/api/whoop/login?t=${encodeURIComponent(t)}`
}

// { connected, kcal, strain, start } — kcal is calories burned this cycle.
export async function fetchWhoopCalories() {
  const t = await accessToken()
  if (!t) return { connected: false }
  try {
    const r = await fetch('/api/whoop/calories', { headers: { Authorization: `Bearer ${t}` } })
    if (!r.ok) return { connected: false, error: true }
    return await r.json()
  } catch {
    return { connected: false, error: true }
  }
}

export async function disconnectWhoop() {
  const t = await accessToken()
  if (!t) return
  await fetch('/api/whoop/disconnect', { method: 'POST', headers: { Authorization: `Bearer ${t}` } })
}
