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
    summary: { type: 'STRING' },
    priorities: { type: 'ARRAY', items: { type: 'STRING' }, minItems: 1, maxItems: 3 },
    tone: { type: 'STRING', enum: ['steady', 'attention', 'recovery'] },
    dataNotes: { type: 'ARRAY', items: { type: 'STRING' }, maxItems: 3 },
  },
  required: ['headline', 'summary', 'priorities', 'tone'],
}

function normalizeBriefing(value, context) {
  if (!value || typeof value !== 'object') throw new Error('Gemini returned invalid briefing data')
  let priorities = Array.isArray(value.priorities)
    ? value.priorities.map(item => String(item).trim().slice(0, 180)).filter(Boolean).slice(0, 3)
    : []
  if (!priorities.length) throw new Error('Gemini returned no priorities')
  if (context.training.inactivity === 'high') {
    priorities = [`${context.training.lastWorkoutDays} days since your last workout. Make ${context.training.nextWorkout} the priority.`, ...priorities].slice(0, 3)
  } else if (context.training.inactivity === 'attention') {
    priorities = [`Training has been quiet for ${context.training.lastWorkoutDays} days. ${context.training.nextWorkout} is ready when you are.`, ...priorities].slice(0, 3)
  }
  return {
    headline: String(value.headline || '').trim().slice(0, 90),
    summary: String(value.summary || '').trim().slice(0, 280),
    priorities,
    tone: ['steady', 'attention', 'recovery'].includes(value.tone) ? value.tone : 'steady',
    dataNotes: Array.isArray(value.dataNotes)
      ? value.dataNotes.map(item => String(item).trim().slice(0, 100)).filter(Boolean).slice(0, 3)
      : [],
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
      ? 'Workout inactivity MUST be the first priority.'
      : context.training.inactivity === 'attention'
        ? 'Mention workout inactivity in a priority.'
        : ''
    const prompt = `Create a concise ${context.phase} health-and-training briefing from the JSON summary below.
Use only supplied facts. Do not diagnose, prescribe, invent measurements, change calorie targets, or mention finance.
Keep the summary to two short sentences and each priority to one practical sentence.
Do not repeat tactical real-time calorie advice; focus on the day plan and training rhythm.
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