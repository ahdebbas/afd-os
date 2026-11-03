import { BEIRUT_CONFIG } from './workoutPrograms'

export default function WorkoutProgramGuide({ programId, day, desktop = false }) {
  if (programId !== 'beirut') return null
  return (
    <details className={`text-[12px] mb-4 ${desktop ? 'd-t2' : 't2'}`}>
      <summary className="cursor-pointer">{BEIRUT_CONFIG.name} · {day.optional ? 'Optional Day C' : 'Full Body A/B · 75–90 min'} · {day.exercises.reduce((total, exercise) => total + Number(exercise.sets.match(/^\d+/)?.[0] ?? 0), 0)} working sets</summary>
      <div className="space-y-2 mt-2">
        <p>{BEIRUT_CONFIG.location} · {BEIRUT_CONFIG.goal}</p>
        <p>{BEIRUT_CONFIG.frequency}. {BEIRUT_CONFIG.split}. {BEIRUT_CONFIG.duration}.</p>
        <p>{BEIRUT_CONFIG.intensity}. {BEIRUT_CONFIG.progression}</p>
        <p>Travel week: Monday Qatar Upper A, Tuesday Qatar Lower, Thursday Qatar Upper B, Saturday Beirut Day B. Beirut replaces Qatar sessions rather than automatically adding volume. Select Day B manually for this schedule.</p>
        <p>Full week in Beirut: Monday Day A, Wednesday Day B, Saturday Day C (optional). Training twice? Perform A and B. Day C is never automatically added to the A/B rotation.</p>
        <p>Tap an exercise name to swap if equipment is occupied or discomfort occurs. Keep existing injury constraints; do not train through pain. Log one working weight per exercise; sets and reps are targets, not required tracking inputs.</p>
      </div>
    </details>
  )
}
