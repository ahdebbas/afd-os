import { WORKOUT_GYMS } from './workoutPrograms'

export default function WorkoutGymSelector({ value, onChange, loggedProgramId, desktop = false }) {
  return (
    <div className="mb-4">
      <div role="group" aria-label="Workout gym" className={`flex gap-1 p-1 rounded-xl ${desktop ? 'd-inset' : 'chip'}`}>
        {WORKOUT_GYMS.map(gym => (
          <button key={gym.id} type="button" aria-pressed={value === gym.id} onClick={() => onChange(gym.id)}
            className={`press flex-1 rounded-lg px-3 py-2 text-[12px] font-semibold ${desktop ? 'd-t1' : value === gym.id ? 'acc-chip' : 't3'}`}
            style={desktop && value === gym.id ? { background: 'var(--d-accent-weak)', color: 'var(--d-accent)' } : undefined}>
            {gym.label}
          </button>
        ))}
      </div>
      <p className={`text-[11px] mt-2 ${desktop ? 'd-t3' : 't3'}`} role="status">
        {loggedProgramId && loggedProgramId !== value
          ? `Showing the logged ${WORKOUT_GYMS.find(gym => gym.id === loggedProgramId)?.label} workout. Your gym choice applies to the next unlogged day.`
          : 'Each gym remembers its next workout and weights. Switch anytime.'}
      </p>
    </div>
  )
}
