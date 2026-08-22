import { userIdFromToken } from '../../lib/whoop.js'

const MODEL = 'gemini-flash-lite-latest'
const MAX_BODY_BYTES = 12_000
const PHASES = new Set(['morning', 'day', 'evening'])
const INACTIVITY = new Set(['normal', 'attention', 'high', 'no_history'])

const clampNumber = (value, min, max) => {
  if (value == null) return null
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : null
}

function validateContext(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  if (!PHASES.has(value.phase) || typeof value.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)) return null
  const food = value.food || {}
  const training = value.training || {}
  if (!INACTIVITY.has(training.inactivity)) return null

  return {
    phase: value.phase,
    date: value.date,
    food: {
      todayKcal: clampNumber(food.todayKcal, 0, 20_000),
      todayProtein: clampNumber(food.todayProtein, 0, 1_000),
      yesterdayKcal: clampNumber(food.yesterdayKcal, 0, 20_000),
      yesterdayProtein: clampNumber(food.yesterdayProtein, 0, 1_000),
      loggedDays: clampNumber(food.loggedDays, 0, 7),
      avgKcal: clampNumber(food.avgKcal, 0, 20_000),
      kcalTarget: clampNumber(food.kcalTarget, 500, 10_000),
      proteinTarget: clampNumber(food.proteinTarget, 20, 1_000),
    },
    training: {
      nextWorkout: String(training.nextWorkout || 'Workout').slice(0, 80),
      exerciseCount: clampNumber(training.exerciseCount, 0, 30),
      sessionsThisWeek: clampNumber(training.sessionsThisWeek, 0, 14),
      lastWorkoutDays: clampNumber(training.lastWorkoutDays, 0, 365),
      inactivity: training.inactivity,
    },
    whoop: value.whoop?.connected ? {
      connected: true,
      kcal: clampNumber(value.whoop.kcal, 0, 20_000),
      strain: clampNumber(value.whoop.strain, 0, 21),
      yesterday: clampNumber(value.whoop.yesterday, 0, 20_000),
      weeklyAvg: clampNumber(value.whoop.weeklyAvg, 0, 20_000),
    } : { connected: false },
    body: value.body ? {
      weight: clampNumber(value.body.weight, 20, 500),
      fatPct: clampNumber(value.body.fatPct, 2, 70),
      fatPctDelta: clampNumber(value.body.fatPctDelta, -20, 20),
    } : null,
  }
}

const responseSchema = {
  type: 'OBJECT',
  properties: {
    headline: { type: 'STRING' },
    bullets: { type: 'ARRAY', items: { type: 'STRING' }, minItems: 3, maxItems: 5 },
    tone: { type: 'STRING', enum: ['steady', 'attention', 'recovery'] },
  },
  required: ['headline', 'bullets', 'tone'],
}

function normalizeBriefing(value, context) {
  if (!value || typeof value !== 'object') throw new Error('Gemini returned invalid briefing data')
  let bullets = Array.isArray(value.bullets)
    ? value.bullets.map(item => String(item).trim().slice(0, 180)).filter(Boolean).slice(0, 5)
    : []
    if (bullets.length < 3) throw new Error('Gemini returned too few briefing bullets')
  if (context.training.inactivity === 'high') {
      bullets = [...bullets.slice(0, 4), `${context.training.lastWorkoutDays} days since your last workout; make ${context.training.nextWorkout} the priority.`]
  } else if (context.training.inactivity === 'attention') {
      bullets = [...bullets.slice(0, 4), `Training has been quiet for ${context.training.lastWorkoutDays} days; ${context.training.nextWorkout} is ready.`]
  }
  return {
    headline: String(value.headline || '').trim().slice(0, 90),
    bullets,
    tone: ['steady', 'attention', 'recovery'].includes(value.tone) ? value.tone : 'steady',
    phaseLabel: context.phase === 'morning' ? 'Morning briefing' : context.phase === 'day' ? 'Day update' : 'Evening check-in',
    source: 'gemini',
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  try {
    const contentLength = Number(req.headers['content-length'] || 0)
    if (contentLength > MAX_BODY_BYTES) return res.status(413).json({ error: 'Briefing payload is too large' })
    const auth = req.headers.authorization || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    const uid = await userIdFromToken(token)
    if (!uid) return res.status(401).json({ error: 'Not authenticated' })
    if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: 'Briefing service is not configured' })

    const context = validateContext(req.body?.context)
    if (!context) return res.status(400).json({ error: 'Invalid briefing context' })
    const inactivityRule = context.training.inactivity === 'high'
      ? 'Include workout inactivity in one bullet after the two calorie bullets.'
      : context.training.inactivity === 'attention'
        ? 'Mention workout inactivity in one bullet after the two calorie bullets.'
        : ''
    const prompt = `Create a concise ${context.phase} health-and-training briefing from the JSON summary below.
Use only supplied facts. Do not diagnose, prescribe, invent measurements, change calorie targets, or mention finance.
  Return only 3 to 5 short, scannable bullets; do not write a summary paragraph.
  The first bullet MUST state today's calories logged versus target and calories remaining or over.
  The second bullet MUST analyze recent calorie tracking using loggedDays, avgKcal, yesterdayKcal, and kcalTarget when available.
  Use the remaining bullets for protein and training. Keep each bullet to one short sentence.
${inactivityRule}
Context: ${JSON.stringify(context)}`

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 320,
          responseMimeType: 'application/json',
          responseSchema,
        },
      }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!response.ok) {
      const status = response.status === 429 ? 429 : 502
      return res.status(status).json({ error: response.status === 429 ? 'Briefing quota reached' : 'Briefing service unavailable' })
    }
    const data = await response.json()
    const text = data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || ''
    const briefing = normalizeBriefing(JSON.parse(text), context)
    return res.status(200).json({ briefing, generatedAt: new Date().toISOString() })
  } catch (error) {
    const timeout = error?.name === 'TimeoutError'
    return res.status(timeout ? 504 : 502).json({ error: timeout ? 'Briefing request timed out' : 'Could not generate briefing' })
  }
}