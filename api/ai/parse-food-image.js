import { userIdFromToken } from '../../lib/whoop.js'

const MODEL = 'gemini-flash-lite-latest'
const MAX_BODY_BYTES = 2_000_000
const MAX_IMAGE_BYTES = 1_400_000
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

const responseSchema = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      minItems: 1,
      maxItems: 12,
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          kcal: { type: 'INTEGER' },
          protein: { type: 'INTEGER' },
          carbs: { type: 'INTEGER' },
          fat: { type: 'INTEGER' },
        },
        required: ['name', 'kcal', 'protein', 'carbs', 'fat'],
      },
    },
  },
  required: ['items'],
}

const clampMacro = (value, max) => {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(0, Math.round(number))) : 0
}

function normalizeItems(value) {
  const items = Array.isArray(value?.items) ? value.items : []
  const normalized = items.slice(0, 12).map(item => ({
    name: String(item?.name || 'Food').trim().slice(0, 60),
    kcal: clampMacro(item?.kcal, 10_000),
    protein: clampMacro(item?.protein, 1_000),
    carbs: clampMacro(item?.carbs, 1_000),
    fat: clampMacro(item?.fat, 1_000),
  })).filter(item => item.kcal > 0 || item.protein > 0 || item.carbs > 0 || item.fat > 0)
  if (!normalized.length) throw new Error('Could not identify food in this photo')
  return normalized
}

function readImage(body) {
  const mimeType = String(body?.mimeType || '')
  const data = String(body?.imageBase64 || '')
  if (!IMAGE_TYPES.has(mimeType)) throw new Error('Use a JPEG, PNG, or WebP image')
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) throw new Error('Invalid image data')
  const bytes = Buffer.byteLength(data, 'base64')
  if (!bytes || bytes > MAX_IMAGE_BYTES) throw new Error('Photo is too large to analyze')
  return { mimeType, data }
}

function readDescription(body) {
  const description = String(body?.text || '').trim()
  if (description.length > 600) throw new Error('Keep the food description under 600 characters')
  return description
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  try {
    const contentLength = Number(req.headers['content-length'] || 0)
    if (contentLength > MAX_BODY_BYTES) return res.status(413).json({ error: 'Photo payload is too large' })

    const auth = req.headers.authorization || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    const uid = await userIdFromToken(token)
    if (!uid) return res.status(401).json({ error: 'Not authenticated' })
    if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: 'Food analysis is not configured' })

    let description
    let image
    try {
      description = readDescription(req.body)
      image = req.body?.imageBase64 ? readImage(req.body) : null
      if (!description && !image) throw new Error('Describe your food or add a photo')
    }
    catch (error) { return res.status(400).json({ error: error.message }) }

    const prompt = `${image ? 'Identify foods shown or named in the image or screenshot and estimate the pictured portions.' : 'Parse the food description and estimate the stated portions.'}
Return each distinct food component with integer calories, protein, carbohydrates, and fat in grams.
  When a screenshot contains explicit nutrition values, use those values instead of estimating them.
  Use short names. Make reasonable estimates when portions are unclear. Do not include plates, utensils, packaging, or non-food objects.
  ${description ? `User description: ${JSON.stringify(description)}` : ''}`

    const parts = [{ text: prompt }]
    if (image) parts.push({ inlineData: image })

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.25,
          maxOutputTokens: 640,
          responseMimeType: 'application/json',
          responseSchema,
        },
      }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) {
      const status = response.status === 429 ? 429 : 502
      return res.status(status).json({ error: response.status === 429 ? 'Food analysis quota reached' : 'Food analysis service unavailable' })
    }

    const data = await response.json()
    const text = data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || ''
    return res.status(200).json({ items: normalizeItems(JSON.parse(text)) })
  } catch (error) {
    const timeout = error?.name === 'TimeoutError'
    return res.status(timeout ? 504 : 502).json({ error: timeout ? 'Food analysis timed out' : 'Could not analyze this food' })
  }
}