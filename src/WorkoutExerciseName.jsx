import { useState } from 'react'
import { exerciseId, exerciseName, lastRecordedWeight } from './workoutHistory'

export default function WorkoutExerciseName({ exercise, sessions, catalog, onSwap, desktop = false }) {
  const [swapping, setSwapping] = useState(false)
  const last = lastRecordedWeight(sessions, exercise.name)
  const options = [...new Map([exercise, ...(exercise.alternatives || []).map(name => ({ name })), ...catalog]
    .map(item => [exerciseId(item.name), exerciseName(item.name)])).values()].sort()
  return (
    <span className="block min-w-0">
      {swapping ? (
        <select autoFocus aria-label={`Swap ${exercise.name}`} value={exerciseName(exercise.name)}
          className={`${desktop ? 'd-input' : 'field rounded-lg'} w-full text-[12px]`}
          onBlur={() => setSwapping(false)} onChange={event => { onSwap(event.target.value); setSwapping(false) }}>
          {options.map(option => <option key={exerciseId(option)}>{option}</option>)}
        </select>
      ) : <button type="button" onClick={() => setSwapping(true)} aria-label={`Swap ${exercise.name}`}
        className="text-left leading-snug">{exercise.name}</button>}
      <span className={`block text-[10px] font-normal mt-0.5 ${desktop ? 'd-t3' : 't3'}`}>
        {last ? `Last ${last.weight} kg · ${last.date}` : 'No logged weight'} · tap name to swap
      </span>
    </span>
  )
}
