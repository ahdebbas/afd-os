import { useState } from 'react'
import Finance from './screens/Finance'
import Fitness from './screens/Fitness'

const tabs = [
  { id: 'finance', label: 'Finance', icon: '💼' },
  { id: 'fitness', label: 'Fitness', icon: '🔥' },
]

export default function App() {
  const [tab, setTab] = useState('finance')

  return (
    <div className="min-h-screen bg-black text-white flex flex-col max-w-2xl mx-auto relative">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/[0.08] px-6 py-4 flex items-center justify-between">
        <span className="text-lg font-semibold tracking-tight">AFD OS</span>
        <span className="text-sm text-white/40">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
      </header>

      {/* Screen */}
      <main className="flex-1 pb-28">
        {tab === 'finance' && <Finance />}
        {tab === 'fitness' && <Fitness />}
      </main>

      {/* iOS-style tab bar */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl bg-black/90 backdrop-blur-xl border-t border-white/[0.08] flex pb-safe">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-3 transition-all duration-200 ${
              tab === t.id ? 'text-blue-400' : 'text-white/30'
            }`}
          >
            <span className="text-2xl leading-none">{t.icon}</span>
            <span className="text-[10px] font-semibold tracking-widest uppercase mt-1">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
