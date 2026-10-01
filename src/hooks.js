import { useEffect, useRef, useState } from 'react'
import { CLOUD_STATE_EVENT, queueCloudState } from './cloudSync'
import { dateKey } from './dates'
const LOCAL_STATE_EVENT = 'afd-local-state'

const reducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * State persisted to localStorage. Reads are guarded against corrupted/legacy
 * data, writes are best-effort (quota/private-mode failures are swallowed),
 * and an optional `validate` lets callers reject malformed shapes.
 */
export function usePersistentState(key, fallback, validate) {
  const cloudUpdateRef = useRef(false)
  const origin = useRef(Symbol(key))
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw == null) return fallback
      const parsed = JSON.parse(raw)
      if (validate && !validate(parsed)) return fallback
      return parsed ?? fallback
    } catch {
      return fallback
    }
  })
  const previousStateRef = useRef(state)

  useEffect(() => {
    if (Object.is(previousStateRef.current, state)) return
    previousStateRef.current = state
    try {
      localStorage.setItem(key, JSON.stringify(state))
      if (cloudUpdateRef.current) cloudUpdateRef.current = false
      else {
        queueCloudState(key, state)
        window.dispatchEvent(new CustomEvent(LOCAL_STATE_EVENT, { detail: { key, value: state, present: true, origin: origin.current } }))
      }
    } catch { /* storage full or unavailable — keep in-memory value */ }
  }, [key, state])

  useEffect(() => {
    const applyCloudUpdate = event => {
      if (event.detail?.key !== key) return
      if (event.detail.origin === origin.current) return
      const next = event.detail.present ? event.detail.value : fallback
      if (validate && !validate(next)) return
      setState(current => {
        const resolved = next ?? fallback
        if (Object.is(current, resolved)) return current
        cloudUpdateRef.current = true
        return resolved
      })
    }
    window.addEventListener(CLOUD_STATE_EVENT, applyCloudUpdate)
    window.addEventListener(LOCAL_STATE_EVENT, applyCloudUpdate)
    return () => {
      window.removeEventListener(CLOUD_STATE_EVENT, applyCloudUpdate)
      window.removeEventListener(LOCAL_STATE_EVENT, applyCloudUpdate)
    }
  }, [fallback, key, validate])

  return [state, setState]
}

/** Animate a number from its previous value to `target`. Respects reduced motion. */
export function useCountUp(target, duration = 800) {
  const [val, setVal] = useState(reducedMotion() ? target : 0)
  const fromRef = useRef(0)

  useEffect(() => {
    if (reducedMotion()) {
      const raf = requestAnimationFrame(() => { setVal(target); fromRef.current = target })
      return () => cancelAnimationFrame(raf)
    }
    const from = fromRef.current
    let raf, t0
    const tick = t => {
      if (t0 === undefined) t0 = t
      const p = Math.min(1, (t - t0) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      const v = from + (target - from) * eased
      setVal(v)
      fromRef.current = v
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return val
}

/** Current time, refreshed every minute. */
export function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const refresh = () => setNow(new Date())
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    const id = setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('pageshow', refresh)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])
  return now
}

export function useCurrentDaySelection() {
  const today = dateKey(useClock())
  const [selection, setSelection] = useState(null)
  const date = selection?.today === today ? selection.date : today
  return [date, date => setSelection({ today, date }), today]
}
