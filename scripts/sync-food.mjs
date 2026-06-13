#!/usr/bin/env node
// Parses food-log.md → public/food-sync.json
// Run: npm run sync-food

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src  = join(root, 'food-log.md')
const dest = join(root, 'public', 'food-sync.json')

const text = readFileSync(src, 'utf8')
const logs = {}

let currentDate = null

for (const raw of text.split('\n')) {
  const line = raw.trim()

  // ## YYYY-MM-DD
  const dateMatch = line.match(/^##\s+(\d{4}-\d{2}-\d{2})$/)
  if (dateMatch) { currentDate = dateMatch[1]; continue }

  // - Name | NNN kcal | XP XC XF [emoji] [@ H:MM AM/PM]
  if (!currentDate || !line.startsWith('- ')) continue

  const body = line.slice(2).trim()

  // Extract optional time: @ H:MM AM/PM or @ HH:MM
  let time = '12:00 PM'
  const timeMatch = body.match(/@\s*(\d{1,2}:\d{2}(?:\s*[AP]M)?)\s*$/i)
  if (timeMatch) time = timeMatch[1].trim()
  const noTime = body.replace(/@\s*\d{1,2}:\d{2}(?:\s*[AP]M)?\s*$/i, '').trim()

  // Extract emoji (optional, appears after macros)
  const emojiMatch = noTime.match(/([\u{1F300}-\u{1FFFF}]|[☀-➿])/u)
  const emoji = emojiMatch ? emojiMatch[0] : undefined
  const noEmoji = noTime.replace(/([\u{1F300}-\u{1FFFF}]|[☀-➿])/gu, '').trim()

  // Split on |
  const parts = noEmoji.split('|').map(s => s.trim())
  if (parts.length < 3) continue

  const name = parts[0]
  const kcalMatch = parts[1].match(/(\d+)/)
  if (!kcalMatch) continue
  const kcal = parseInt(kcalMatch[1])

  // Macros: XP XC XF (or X P X C X F)
  const macros = parts[2].match(/(\d+)\s*[Pp].*?(\d+)\s*[Cc].*?(\d+)\s*[Ff]/)
  const protein = macros ? parseInt(macros[1]) : 0
  const carbs   = macros ? parseInt(macros[2]) : 0
  const fat     = macros ? parseInt(macros[3]) : 0

  // Deterministic uid from date + name (stable across re-runs)
  const uid = [...(currentDate + name)].reduce((h, c) => Math.imul(31, h) + c.charCodeAt(0) | 0, 0) >>> 0

  const entry = { name, kcal, protein, carbs, fat, time, uid }
  if (emoji) entry.emoji = emoji
  ;(logs[currentDate] ??= []).push(entry)
}

mkdirSync(join(root, 'public'), { recursive: true })
writeFileSync(dest, JSON.stringify({ logs }, null, 2))

const total = Object.values(logs).reduce((n, arr) => n + arr.length, 0)
console.log(`✓ Synced ${total} entries across ${Object.keys(logs).length} day(s) → public/food-sync.json`)
