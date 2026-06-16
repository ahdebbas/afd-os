// Server-side WHOOP helpers, shared by the /api/whoop/* Vercel functions.
// Never imported by client code — relies on secret env vars (client secret,
// Supabase service-role key) that must never ship to the browser.
import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'

const WHOOP_AUTH = 'https://api.prod.whoop.com/oauth/oauth2/auth'
const WHOOP_TOKEN = 'https://api.prod.whoop.com/oauth/oauth2/token'
const WHOOP_API = 'https://api.prod.whoop.com/developer'
const SCOPES = 'read:cycles offline'

const env = (...keys) => {
  for (const k of keys) if (process.env[k]) return process.env[k]
  return undefined
}

export const config = {
  clientId: env('WHOOP_CLIENT_ID'),
  clientSecret: env('WHOOP_CLIENT_SECRET'),
  redirectUri: env('WHOOP_REDIRECT_URI'),
  appUrl: env('WHOOP_APP_URL') || 'https://afd-os.vercel.app',
  // State is HMAC-signed; falls back to the client secret if no dedicated key set.
  stateSecret: env('WHOOP_STATE_SECRET', 'WHOOP_CLIENT_SECRET'),
  supabaseUrl: env('SUPABASE_URL', 'VITE_SUPABASE_URL'),
  supabaseAnon: env('SUPABASE_ANON_KEY', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_ANON_KEY'),
  supabaseService: env('SUPABASE_SERVICE_ROLE_KEY'),
}

// Service-role client: bypasses RLS so functions can write any user's tokens.
const admin = () => createClient(config.supabaseUrl, config.supabaseService, { auth: { persistSession: false } })

// Verify a Supabase user JWT and return its user id (or null).
export async function userIdFromToken(token) {
  if (!token) return null
  const sb = createClient(config.supabaseUrl, config.supabaseAnon, { auth: { persistSession: false } })
  const { data, error } = await sb.auth.getUser(token)
  return error || !data?.user ? null : data.user.id
}

const b64url = s => Buffer.from(s).toString('base64url')
const sign = data => crypto.createHmac('sha256', config.stateSecret).update(data).digest('base64url')

// Tamper-proof OAuth state carrying the user id through the WHOOP redirect.
export function makeState(uid) {
  const payload = b64url(JSON.stringify({ uid, ts: Date.now() }))
  return `${payload}.${sign(payload)}`
}
export function readState(state) {
  const [payload, sig] = String(state || '').split('.')
  if (!payload || !sig || sign(payload) !== sig) return null
  try {
    const { uid, ts } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (Date.now() - ts > 10 * 60 * 1000) return null // 10-min window
    return uid
  } catch { return null }
}

export function authorizeUrl(state) {
  const p = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: SCOPES,
    state,
  })
  return `${WHOOP_AUTH}?${p}`
}

async function tokenRequest(params) {
  const r = await fetch(WHOOP_TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...params }),
  })
  if (!r.ok) throw new Error(`WHOOP token ${r.status}: ${(await r.text()).slice(0, 200)}`)
  return r.json()
}

export const exchangeCode = code =>
  tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: config.redirectUri })

export const refreshTokens = refresh_token =>
  tokenRequest({ grant_type: 'refresh_token', refresh_token, scope: 'offline' })

export async function saveTokens(uid, tok) {
  const expires_at = new Date(Date.now() + (tok.expires_in - 60) * 1000).toISOString()
  const { error } = await admin().from('whoop_tokens').upsert(
    { user_id: uid, access_token: tok.access_token, refresh_token: tok.refresh_token, expires_at, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  )
  if (error) throw new Error(`save tokens: ${error.message}`)
}

export async function clearTokens(uid) {
  await admin().from('whoop_tokens').delete().eq('user_id', uid)
}

// Valid access token for uid, refreshing if expired. null if not connected.
export async function validAccessToken(uid) {
  const { data, error } = await admin().from('whoop_tokens').select('*').eq('user_id', uid).maybeSingle()
  if (error || !data) return null
  if (new Date(data.expires_at).getTime() > Date.now()) return data.access_token
  const tok = await refreshTokens(data.refresh_token)
  if (!tok.refresh_token) tok.refresh_token = data.refresh_token // WHOOP may omit on refresh
  await saveTokens(uid, tok)
  return tok.access_token
}

// Latest (current) cycle's energy expenditure, converted kJ -> kcal.
export async function fetchTodayCalories(accessToken) {
  const r = await fetch(`${WHOOP_API}/v2/cycle?limit=1`, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!r.ok) throw new Error(`WHOOP cycle ${r.status}`)
  const data = await r.json()
  const cycle = data.records?.[0]
  const kj = cycle?.score?.kilojoule
  return {
    kcal: kj == null ? null : Math.round(kj / 4.184),
    strain: cycle?.score?.strain ?? null,
    start: cycle?.start ?? null,
  }
}
