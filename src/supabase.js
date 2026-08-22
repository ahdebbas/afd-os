import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublicKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY

export const hasSupabaseConfig = Boolean(supabaseUrl && supabasePublicKey)

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabasePublicKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

export function getCachedSupabaseUserId() {
  if (!supabaseUrl) return null
  try {
    const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
    const session = JSON.parse(localStorage.getItem(`sb-${projectRef}-auth-token`))
    return session?.user?.id ?? null
  } catch {
    return null
  }
}
