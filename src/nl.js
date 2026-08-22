import { supabase } from './supabase'

// Natural-language food parsing — calls the local /ai/parse-food endpoint
// (headless Claude Code via the Vite middleware; not available on Netlify).

const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_RAW_PHOTO_BYTES = 15_000_000
const MAX_PHOTO_EDGE = 1280
const MAX_PREPARED_BYTES = 1_400_000

export async function parseFood(text) {
  let r
  try {
    r = await fetch('/ai/parse-food', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
  } catch {
    throw new Error('Could not reach the local server')
  }
  if (r.status === 404) throw new Error('AI parsing runs on the local server only — open the app via npm run dev')
  const d = await r.json().catch(() => ({}))
  if (!r.ok) {
    const msg = d.error || 'Parsing failed'
    throw new Error(/Not logged in/i.test(msg)
      ? 'Claude CLI is not logged in — run `claude` in Terminal once and log in with your subscription'
      : msg)
  }
  return d.items
}

const canvasBlob = (canvas, quality) => new Promise((resolve, reject) => {
  canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not prepare this photo')), 'image/jpeg', quality)
})

const blobBase64 = blob => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
  reader.onerror = () => reject(new Error('Could not read this photo'))
  reader.readAsDataURL(blob)
})

export async function prepareFoodPhoto(file) {
  if (!file || !PHOTO_TYPES.has(file.type)) throw new Error('Use a JPEG, PNG, or WebP photo')
  if (file.size > MAX_RAW_PHOTO_BYTES) throw new Error('Photo is too large')

  let bitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not prepare this photo')
    context.drawImage(bitmap, 0, 0, width, height)
    const blob = await canvasBlob(canvas, 0.76)
    if (blob.size > MAX_PREPARED_BYTES) throw new Error('Photo is still too large after resizing')
    return { imageBase64: await blobBase64(blob), mimeType: 'image/jpeg' }
  } catch (error) {
    if (error?.message?.includes('too large') || error?.message?.includes('prepare')) throw error
    throw new Error('This photo could not be opened', { cause: error })
  } finally {
    bitmap?.close()
  }
}

async function requestFoodAnalysis(payload, { signal } = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Sign in to analyze food')

  const response = await fetch('/api/ai/parse-food-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
    signal,
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'Could not analyze this food')
  if (!Array.isArray(result.items) || !result.items.length) throw new Error('No food was identified')
  return result.items
}

export const requestFoodImageAnalysis = (photo, options) => requestFoodAnalysis(photo, options)

export function requestFoodTextAnalysis(text, options) {
  const description = String(text || '').trim()
  if (!description) throw new Error('Describe what you ate')
  return requestFoodAnalysis({ text: description }, options)
}

/** Collapse multiple parsed items into one (for saving a whole meal as a single preset). */
export function combineItems(items) {
  if (items.length === 1) return items[0]
  return {
    name: items.map(i => i.name).join(' + ').slice(0, 60),
    kcal: items.reduce((a, i) => a + i.kcal, 0),
    protein: items.reduce((a, i) => a + i.protein, 0),
    carbs: items.reduce((a, i) => a + i.carbs, 0),
    fat: items.reduce((a, i) => a + i.fat, 0),
  }
}
