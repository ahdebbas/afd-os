import { useEffect, useRef, useState } from 'react'

const reducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * State persisted to localStorage. Reads are guarded against corrupted/legacy
 * data, writes are best-effort (quota/private-mode failures are swallowed),
 * and an optional `validate` lets callers reject malformed shapes.
 */
export function usePersistentState(key, fallback, validate) {
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

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state))
    } catch { /* storage full or unavailable — keep in-memory value */ }
  }, [key, state])

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
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [])
  return now
}
