import { TARGETS } from './data'
import { dateKey, todayKey } from './dates'

export const briefingPhase = (hour = new Date().getHours()) =>
  hour < 11 ? 'morning' : hour < 17 ? 'day' : 'evening'

const totalsFor = entries => (entries || []).reduce((totals, entry) => ({
  kcal: totals.kcal + (+entry.kcal || 0),
  protein: totals.protein + (+entry.protein || 0),
}), { kcal: 0, protein: 0 })

const daysAgo = date => {
  if (!date) return null
  const today = new Date(`${todayKey()}T00:00:00`)
  const then = new Date(`${date}T00:00:00`)
  return Math.max(0, Math.round((today - then) / 86400000))
}

export function buildBriefingContext({ logs, totals, sessions, nextWorkout, inbody, whoop, now = new Date() }) {
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayTotals = totalsFor(logs?.[dateKey(yesterday)])
  const recentFood = []
  for (let offset = 1; offset <= 7; offset++) {
    const day = new Date(now)
    day.setDate(day.getDate() - offset)
    const dayTotals = totalsFor(logs?.[dateKey(day)])
    if (dayTotals.kcal > 0) recentFood.push(dayTotals)
  }

  const orderedSessions = [...(sessions || [])].sort((a, b) => b.date.localeCompare(a.date))
  const lastSession = orderedSessions[0] || null
  const lastWorkoutDays = daysAgo(lastSession?.date)
  const inactivity = lastWorkoutDays == null
    ? 'no_history'
    : lastWorkoutDays >= 5
      ? 'high'
      : lastWorkoutDays >= 3
        ? 'attention'
        : 'normal'
  const weekMonday = new Date(now)
  weekMonday.setDate(weekMonday.getDate() - ((weekMonday.getDay() + 6) % 7))
  const weekStart = dateKey(weekMonday)
  const bodyReadings = [...(inbody || [])].sort((a, b) => a.date.localeCompare(b.date))
  const latestBody = bodyReadings.at(-1) || null
  const previousBody = bodyReadings.at(-2) || null

  return {
    phase: briefingPhase(now.getHours()),
    date: todayKey(),
    food: {
      todayKcal: Math.round(totals?.kcal || 0),
      todayProtein: Math.round(totals?.protein || 0),
      yesterdayKcal: Math.round(yesterdayTotals.kcal),
      yesterdayProtein: Math.round(yesterdayTotals.protein),
      loggedDays: recentFood.length,
      avgKcal: recentFood.length ? Math.round(recentFood.reduce((sum, day) => sum + day.kcal, 0) / recentFood.length) : null,
      kcalTarget: TARGETS.kcal,
      proteinTarget: TARGETS.protein,
    },
    training: {
      nextWorkout: nextWorkout?.name || 'Workout',
      exerciseCount: nextWorkout?.exercises?.length || 0,
      sessionsThisWeek: orderedSessions.filter(session => session.date >= weekStart && session.date <= todayKey()).length,
      lastWorkoutDays,
      inactivity,
    },
    whoop: whoop?.connected ? {
      connected: true,
      kcal: whoop.kcal == null ? null : Math.round(whoop.kcal),
      strain: whoop.strain == null ? null : +whoop.strain.toFixed(1),
      yesterday: whoop.yesterday == null ? null : Math.round(whoop.yesterday),
      weeklyAvg: whoop.weeklyAvg == null ? null : Math.round(whoop.weeklyAvg),
    } : { connected: false },
    body: latestBody ? {
      weight: latestBody.weight ?? null,
      fatPct: latestBody.fatPct ?? null,
      fatPctDelta: previousBody?.fatPct == null || latestBody.fatPct == null
        ? null
        : +(latestBody.fatPct - previousBody.fatPct).toFixed(1),
    } : null,
  }
}

export function fallbackBriefing(context) {
  const { phase, food, training } = context
  const phaseLabel = phase === 'morning' ? 'Morning briefing' : phase === 'day' ? 'Day update' : 'Evening check-in'
  const priorities = []

  if (training.inactivity === 'high') priorities.push(`${training.lastWorkoutDays} days since your last workout. Make ${training.nextWorkout} the priority.`)
  else if (training.inactivity === 'attention') priorities.push(`Training has been quiet for ${training.lastWorkoutDays} days. ${training.nextWorkout} is ready when you are.`)
  else if (training.inactivity === 'no_history') priorities.push(`Start the rotation with ${training.nextWorkout}.`)
  else priorities.push(`Next up: ${training.nextWorkout}.`)

  if (food.todayProtein === 0) priorities.push('Start protein early so the target stays manageable.')
  else if (food.todayProtein < food.proteinTarget * 0.5 && phase !== 'morning') priorities.push(`${Math.max(0, food.proteinTarget - food.todayProtein)}g protein remains today.`)
  else priorities.push('Keep meals aligned with today’s protein target.')

  const headline = training.inactivity === 'high'
    ? 'Time to restart your training rhythm'
    : phase === 'morning'
      ? 'Set the shape of the day'
      : phase === 'day'
        ? 'Keep the day moving'
        : 'Close the day deliberately'

  return {
    headline,
    summary: `${training.sessionsThisWeek} workout${training.sessionsThisWeek === 1 ? '' : 's'} logged this week. ${food.todayKcal.toLocaleString()} of ${food.kcalTarget.toLocaleString()} kcal logged today.`,
    priorities: priorities.slice(0, 3),
    tone: training.inactivity === 'high' ? 'attention' : 'steady',
    phaseLabel,
    source: 'local',
  }
}