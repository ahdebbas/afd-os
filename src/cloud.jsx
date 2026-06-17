import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Cloud, LogOut, Mail, Shield, TriangleAlert } from 'lucide-react'
import { CLOUD_STATE_KEYS, clearCloudSyncSink, setCloudSyncSink } from './cloudSync'
import { hasSupabaseConfig, supabase } from './supabase'

const CloudCtx = createContext(null)
const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY

function TurnstileCaptcha({ onToken, resetSignal }) {
  const boxRef = useRef(null)
  const widgetRef = useRef(null)

  useEffect(() => {
    if (!turnstileSiteKey || !boxRef.current) return
    let cancelled = false
    const render = () => {
      if (cancelled || !window.turnstile || !boxRef.current || widgetRef.current != null) return
      widgetRef.current = window.turnstile.render(boxRef.current, {
        sitekey: turnstileSiteKey,
        callback: onToken,
        'expired-callback': () => onToken(''),
        'error-callback': () => onToken(''),
      })
    }

    if (window.turnstile) render()
    else {
      let script = document.querySelector('script[data-turnstile]')
      if (!script) {
        script = document.createElement('script')
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
        script.async = true
        script.defer = true
        script.dataset.turnstile = 'true'
        document.head.appendChild(script)
      }
      script.addEventListener('load', render, { once: true })
    }

    return () => {
      cancelled = true
      if (window.turnstile && widgetRef.current != null) window.turnstile.remove(widgetRef.current)
      widgetRef.current = null
    }
  }, [onToken])

  useEffect(() => {
    if (!window.turnstile || widgetRef.current == null) return
    window.turnstile.reset(widgetRef.current)
    onToken('')
  }, [resetSignal, onToken])

  if (!turnstileSiteKey) return null
  return <div ref={boxRef} className="min-h-[65px] flex justify-center" />
}

function ConfigMissing() {
  return (
    <div className="min-h-dvh w-full max-w-md mx-auto flex items-center justify-center px-6">
      <section className="panel p-6" style={{ '--acc': 'var(--acc-os)' }}>
        <div className="w-11 h-11 rounded-2xl acc-chip flex items-center justify-center mb-4">
          <TriangleAlert size={20} strokeWidth={2.5} />
        </div>
        <h1 className="display text-[34px] leading-none font-bold t1">Supabase setup</h1>
        <p className="text-sm t2 mt-3 leading-relaxed">
          Add your Supabase URL and publishable key to a local .env file, then restart the dev server.
        </p>
        <div className="mt-4 panel-2 rounded-2xl p-4 mono text-[10px] t2 leading-relaxed">
          VITE_SUPABASE_URL=...<br />
          VITE_SUPABASE_PUBLISHABLE_KEY=...
        </div>
      </section>
    </div>
  )
}

function AuthScreen() {
  const { signIn, signUp, authBusy, authError, authMessage } = useCloud()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaReset, setCaptchaReset] = useState(0)

  const submit = async e => {
    e.preventDefault()
    if (mode === 'signup') await signUp(email, password, captchaToken)
    else await signIn(email, password, captchaToken)
    setCaptchaReset(v => v + 1)
  }

  const captchaRequired = Boolean(turnstileSiteKey)

  return (
    <div className="min-h-dvh w-full max-w-md mx-auto flex items-center justify-center px-6">
      <section className="panel p-6 w-full" style={{ '--acc': 'var(--acc-os)' }}>
        <div className="w-12 h-12 rounded-2xl acc-chip flex items-center justify-center mb-5">
          <Shield size={22} strokeWidth={2.5} />
        </div>
        <h1 className="display text-[42px] leading-none font-bold t1">AFD OS</h1>
        <p className="text-sm t2 mt-2 leading-relaxed">Sign in to sync food, training, finance, and settings with Supabase.</p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <label className="block">
            <span className="mono text-[10px] tracking-[0.14em] uppercase t2 font-semibold">Email</span>
            <div className="field mt-1.5 rounded-xl px-3 py-2.5 flex items-center gap-2">
              <Mail size={15} className="t3" />
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" required
                className="bg-transparent outline-none flex-1 text-sm t1" autoComplete="email" />
            </div>
          </label>
          <label className="block">
            <span className="mono text-[10px] tracking-[0.14em] uppercase t2 font-semibold">Password</span>
            <input value={password} onChange={e => setPassword(e.target.value)} type="password" required minLength={6}
              className="field mt-1.5 rounded-xl px-3 py-2.5 w-full text-sm outline-none" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
          </label>
          <TurnstileCaptcha onToken={setCaptchaToken} resetSignal={captchaReset} />
          {!turnstileSiteKey && authError?.includes('captcha') && (
            <p className="text-[12px] down leading-relaxed" role="alert">
              Supabase captcha is enabled. Set VITE_TURNSTILE_SITE_KEY in the app environment or disable captcha protection in Supabase Auth.
            </p>
          )}
          {authError && <p className="text-[12px] down leading-relaxed" role="alert">{authError}</p>}
          {authMessage && <p className="text-[12px] up leading-relaxed" role="status">{authMessage}</p>}
          <button disabled={authBusy || !email || password.length < 6 || (captchaRequired && !captchaToken)}
            className="press w-full rounded-xl py-3.5 font-bold text-sm acc-chip disabled:opacity-40 disabled:cursor-not-allowed">
            {authBusy ? 'Working...' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <button onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
          className="press mt-4 w-full chip rounded-xl py-3 mono text-[10px] tracking-[0.12em] uppercase t2 font-semibold">
          {mode === 'signup' ? 'Already have an account' : 'Create a new account'}
        </button>
      </section>
    </div>
  )
}

function HydratingScreen() {
  return (
    <div className="min-h-dvh w-full max-w-md mx-auto flex items-center justify-center px-6">
      <section className="panel p-6 w-full text-center" style={{ '--acc': 'var(--acc-os)' }}>
        <Cloud size={22} className="mx-auto acc nl-busy" />
        <p className="mono text-[10px] tracking-[0.18em] uppercase t2 mt-4">Loading cloud state</p>
      </section>
    </div>
  )
}

export function CloudProvider({ children }) {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [cloudReady, setCloudReady] = useState(false)
  const [syncStatus, setSyncStatus] = useState('idle')
  const [syncError, setSyncError] = useState(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState(null)
  const [authMessage, setAuthMessage] = useState(null)

  useEffect(() => {
    if (!supabase) return
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setAuthLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setCloudReady(false)
    })
    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!supabase || !session?.user) {
      clearCloudSyncSink()
      return
    }

    let cancelled = false

    const hydrate = async () => {
      setSyncStatus('syncing')
      setSyncError(null)
      const { data, error } = await supabase
        .from('app_state')
        .select('key,value,updated_at')
        .order('key')

      if (cancelled) return
      if (error) {
        setSyncError(error.message)
        setSyncStatus('error')
        setCloudReady(true)
        return
      }

      const rows = new Map((data || []).map(row => [row.key, row.value]))
      for (const key of CLOUD_STATE_KEYS) {
        if (rows.has(key)) localStorage.setItem(key, JSON.stringify(rows.get(key)))
        else localStorage.removeItem(key)
      }

      setCloudReady(true)
      setSyncStatus('synced')

      setCloudSyncSink(async batch => {
        if (!batch.length) return
        setSyncStatus('syncing')
        setSyncError(null)
        const rows = batch.map(item => ({
          user_id: session.user.id,
          key: item.key,
          value: item.value,
        }))
        const { error } = await supabase
          .from('app_state')
          .upsert(rows, { onConflict: 'user_id,key' })
        if (error) {
          setSyncError(error.message)
          setSyncStatus('error')
          return
        }
        setSyncStatus('synced')
      })
    }

    hydrate()
    return () => {
      cancelled = true
      clearCloudSyncSink()
    }
  }, [session])

  const signIn = async (email, password, captchaToken) => {
    setAuthBusy(true)
    setAuthError(null)
    setAuthMessage(null)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: captchaToken ? { captchaToken } : undefined,
    })
    if (error) setAuthError(error.message)
    else if (data.session) {
      setSession(data.session)
      setCloudReady(false)
    }
    setAuthBusy(false)
  }

  const signUp = async (email, password, captchaToken) => {
    setAuthBusy(true)
    setAuthError(null)
    setAuthMessage(null)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: captchaToken ? { captchaToken } : undefined,
    })
    if (error) setAuthError(error.message)
    else if (!data.session) setAuthMessage('Account created. Check your email to confirm it, then sign in.')
    else {
      setAuthMessage('Account created. Loading your workspace...')
      setSession(data.session)
      setCloudReady(false)
    }
    setAuthBusy(false)
  }

  const signOut = async () => {
    clearCloudSyncSink()
    for (const key of CLOUD_STATE_KEYS) localStorage.removeItem(key)
    await supabase.auth.signOut()
  }

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    cloudReady,
    syncStatus,
    syncError,
    authBusy,
    authError,
    authMessage,
    signIn,
    signUp,
    signOut,
  }), [session, cloudReady, syncStatus, syncError, authBusy, authError, authMessage])

  if (!hasSupabaseConfig) return <ConfigMissing />
  if (authLoading) return <HydratingScreen />

  return (
    <CloudCtx.Provider value={value}>
      {!session ? <AuthScreen /> : !cloudReady ? <HydratingScreen /> : children}
    </CloudCtx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useCloud = () => useContext(CloudCtx)

export function CloudStatus() {
  const cloud = useCloud()
  if (!cloud?.user) return null
  const label = cloud.syncStatus === 'syncing' ? 'Syncing' : cloud.syncStatus === 'error' ? 'Sync error' : 'Synced'
  const Icon = cloud.syncStatus === 'synced' ? Check : Cloud
  return (
    <div className="panel-2 rounded-2xl px-4 py-3" style={{ '--acc': cloud.syncStatus === 'error' ? 'var(--down)' : 'var(--acc-os)' }}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="mono text-[10px] tracking-[0.14em] uppercase t2 font-semibold flex items-center gap-2">
            <Icon size={13} className="acc" /> {label}
          </p>
          <p className="text-[12px] t3 mt-1 truncate">{cloud.user.email}</p>
          {cloud.syncError && <p className="text-[12px] down mt-1 leading-relaxed">{cloud.syncError}</p>}
        </div>
        <button onClick={cloud.signOut} className="press chip rounded-xl w-9 h-9 flex items-center justify-center t2" aria-label="Sign out">
          <LogOut size={15} strokeWidth={2.25} />
        </button>
      </div>
    </div>
  )
}
