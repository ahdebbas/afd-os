const data = {
  bodyComp: { weight: 90.4, muscleMass: 43.3, fatMass: 14.8, fatPct: 16.4, date: 'May 23, 2026' },
  goal: { fatPct: 13.5 },
  prs: [
    { name: 'Bench', value: '90', unit: 'kg×5' },
    { name: 'Squat', value: '120', unit: 'kg×8' },
    { name: 'Hip Thrust', value: '110', unit: 'kg×11' },
    { name: 'OHP', value: '55', unit: 'kg×10' },
    { name: 'Deadlift', value: '105', unit: 'kg×8' },
    { name: 'Lat Pull', value: '75', unit: 'kg×8' },
  ],
  program: [
    { name: 'Upper A', exercises: [['Barbell Bench Press','4×6–8'],['Incline DB Press','3×8–10'],['Seated Shoulder Press','3×8–10'],['DB Lateral Raises','3×12–15'],['Triceps Pushdown','3×10–12'],['Cable Biceps Curl','3×10–12']] },
    { name: 'Lower A', exercises: [['Barbell Squat','4×6–8'],['Smith Feet-Fwd Squat','3×8–10'],['Leg Press','3×10–12'],['Hip Thrust','3×8–10'],['Hip Abduction','3×12–15'],['Calf Raise','3×10–12']] },
    { name: 'Upper B', exercises: [['Incline Bench Press','4×6–8'],['Lat Pulldown','3×8–10'],['Chest Press Machine','3×8–10'],['Rear Delt Cable','3×12–15'],['Overhead Press','3×8–10'],['Skull Crushers','3×10–12']] },
    { name: 'Full Body', exercises: [['Hip Thrust','3×6–8'],['Romanian Deadlift','3×8–10'],['Bench / Chest Press','3×6–8'],['Lat Pulldown','3×8–10'],['Lateral Raises','3×12–15'],['Biceps Curl','3×10–12']] },
  ],
}

import { useState } from 'react'

const C = 2 * Math.PI * 54

export default function Fitness() {
  const [day, setDay] = useState(0)
  const { bodyComp, goal, prs, program } = data
  const progress = Math.max(0.03, Math.min(1, (20 - bodyComp.fatPct) / (20 - goal.fatPct)))
  const offset = C * (1 - progress)

  return (
    <div className="p-4 space-y-3">
      {/* Body comp from InBody */}
      <div className="rounded-3xl bg-[#1C1C1E] border border-white/[0.06] p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-4">📱 InBody · {bodyComp.date}</p>
        <div className="flex items-center gap-6">
          {/* Ring */}
          <div className="relative flex-shrink-0 w-32 h-32">
            <svg className="-rotate-90" width="128" height="128" viewBox="0 0 128 128">
              <circle cx="64" cy="64" r="54" fill="none" stroke="rgba(255,159,10,0.15)" strokeWidth="12"/>
              <circle cx="64" cy="64" r="54" fill="none" stroke="url(#fg)" strokeWidth="12"
                strokeLinecap="round" strokeDasharray={C.toFixed(1)} strokeDashoffset={offset.toFixed(1)}/>
              <defs>
                <linearGradient id="fg" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#FF9F0A"/>
                  <stop offset="100%" stopColor="#30D158"/>
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-black">{bodyComp.fatPct}%</span>
              <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wide">body fat</span>
            </div>
          </div>
          {/* Stats */}
          <div className="flex-1 space-y-2.5">
            {[
              ['Weight', `${bodyComp.weight} kg`],
              ['Muscle', `${bodyComp.muscleMass} kg`],
              ['Fat mass', `${bodyComp.fatMass} kg`],
              ['Goal', `${goal.fatPct}%`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span className="text-white/40">{k}</span>
                <span className="font-semibold">{v}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Nutrition */}
        <div className="mt-4 pt-4 border-t border-white/[0.06] grid grid-cols-3 gap-3 text-center">
          {[['🔥 Calories', '1,900–2,000'], ['🥩 Protein', '~2g/kg'], ['⚡ Burn', '~2,100/day']].map(([k, v]) => (
            <div key={k} className="bg-white/5 rounded-2xl py-2.5 px-2">
              <div className="text-xs text-white/40 mb-1">{k}</div>
              <div className="text-sm font-bold">{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* PRs */}
      <div className="rounded-3xl bg-[#1C1C1E] border border-white/[0.06] p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">🏆 Personal Records</p>
        <div className="grid grid-cols-3 gap-2">
          {prs.map(pr => (
            <div key={pr.name} className="bg-white/5 rounded-2xl p-3 text-center">
              <div className="text-xs text-white/40 mb-1">{pr.name}</div>
              <div className="text-xl font-black">{pr.value}</div>
              <div className="text-[10px] text-white/30 font-mono">{pr.unit}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Injury notice */}
      <div className="rounded-2xl bg-orange-500/10 border border-orange-500/25 px-4 py-3 text-sm text-orange-300 leading-relaxed">
        ⚠️ <strong>Left shoulder:</strong> machine/Smith only, no front raises. <strong>Lower back:</strong> monitor hip thrusts.
      </div>

      {/* Program */}
      <div className="rounded-3xl bg-[#1C1C1E] border border-white/[0.06] p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">🏋️ 4×/week Program</p>
        {/* Segmented control */}
        <div className="grid grid-cols-4 gap-1 bg-white/5 rounded-xl p-1 mb-4">
          {program.map((d, i) => (
            <button key={i} onClick={() => setDay(i)}
              className={`text-xs font-semibold py-2 rounded-lg transition-all ${
                day === i ? 'bg-[#3A3A3C] text-white' : 'text-white/30'
              }`}>
              {d.name.split(' ')[0]}<br/>{d.name.split(' ')[1] || ''}
            </button>
          ))}
        </div>
        <div className="space-y-0">
          {program[day].exercises.map(([ex, sets]) => (
            <div key={ex} className="flex justify-between items-center py-3 border-t border-white/[0.06] text-sm">
              <span>{ex}</span>
              <span className="text-white/40 font-mono font-semibold">{sets}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
