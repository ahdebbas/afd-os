import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

// OS-level announcements: events surface in the header island, then auto-dismiss.
const OsCtx = createContext(null)

export function OsProvider({ children }) {
  const [toast, setToast] = useState(null)
  const [timer, setAppTimer] = useState(null)
  const timerRef = useRef(null)

  const announce = useCallback((text, acc = 'var(--acc-food)', action = null) => {
    clearTimeout(timerRef.current)
    setToast({ text, acc, action, key: Date.now() })
    timerRef.current = setTimeout(() => setToast(null), 3500)
  }, [])

  // Timer logic for Rest timers
  useEffect(() => {
    if (!timer) return
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((timer.end - Date.now()) / 1000))
      if (remaining === 0) {
        setAppTimer(null)
        if (navigator.vibrate) navigator.vibrate([200, 100, 200])
        announce('REST COMPLETE', 'var(--acc-fit)')
      } else {
        setAppTimer({ ...timer, remaining })
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [timer, announce])

  const startTimer = useCallback((seconds) => {
    setAppTimer({ end: Date.now() + seconds * 1000, total: seconds, remaining: seconds })
  }, [])

  const cancelTimer = useCallback(() => setAppTimer(null), [])

  return <OsCtx.Provider value={{ toast, announce, startTimer, cancelTimer, timer }}>{children}</OsCtx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useOs = () => useContext(OsCtx)
