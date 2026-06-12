import { createContext, useCallback, useContext, useRef, useState } from 'react'

// OS-level announcements: events surface in the header island, then auto-dismiss.
const OsCtx = createContext(null)

export function OsProvider({ children }) {
  const [toast, setToast] = useState(null)
  const timer = useRef(null)

  const announce = useCallback((text, acc = 'var(--acc-food)') => {
    clearTimeout(timer.current)
    setToast({ text, acc, key: Date.now() })
    timer.current = setTimeout(() => setToast(null), 2400)
  }, [])

  return <OsCtx.Provider value={{ toast, announce }}>{children}</OsCtx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useOs = () => useContext(OsCtx)
