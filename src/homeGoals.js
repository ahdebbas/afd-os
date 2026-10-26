import { FITNESS, TARGETS } from './data.js'

export const HOME_STATE_KEY = 'afd-home-v1'
export const HOME_GOALS = [
  { id: 'body', label: 'Body fat' },
  { id: 'training', label: 'Training' },
  { id: 'cash', label: 'Cash buffer' },
]
export const DEFAULT_HOME_STATE = {
  view: 'trajectory',
  mainGoal: 'body',
  goals: {
    fatPct: FITNESS.goal.fatPct,
    weeklyWorkouts: 4,
    protein: TARGETS.protein,
    cashBuffer: null,
  },
}

export function validHomeGoals(goals) {
  return !!goals
    && Number.isFinite(goals.fatPct) && goals.fatPct >= 5 && goals.fatPct <= 40
    && Number.isInteger(goals.weeklyWorkouts) && goals.weeklyWorkouts >= 1 && goals.weeklyWorkouts <= 7
    && Number.isInteger(goals.protein) && goals.protein >= 1 && goals.protein <= 500
    && (goals.cashBuffer === null || (Number.isInteger(goals.cashBuffer) && goals.cashBuffer >= 1 && goals.cashBuffer <= 10_000_000))
}

export const validHomeState = value => !!value
  && ['trajectory', 'classic'].includes(value.view)
  && HOME_GOALS.some(goal => goal.id === value.mainGoal)
  && validHomeGoals(value.goals)

export function parseHomeGoals(values) {
  const goals = {
    fatPct: Number(values.fatPct),
    weeklyWorkouts: Number(values.weeklyWorkouts),
    protein: Number(values.protein),
    cashBuffer: String(values.cashBuffer ?? '').trim() === '' ? null : Number(values.cashBuffer),
  }
  if (!validHomeGoals(goals)) {
    return { error: 'Use body fat 5-40%, 1-7 whole workouts per week, 1-500g whole protein, and an optional whole USD buffer from 1 to 10,000,000.' }
  }
  return { goals }
}
