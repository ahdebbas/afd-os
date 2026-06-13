import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import process from 'node:process'

// ---------------------------------------------------------------------------
// AI food parsing — local-only endpoint backed by headless Claude Code, which
// runs on the Claude subscription (no API key, no per-token billing).
// Not available on Netlify; the UI degrades gracefully when the endpoint 404s.
// ---------------------------------------------------------------------------
const CLAUDE_BIN = [`${homedir()}/.local/bin/claude`, '/usr/local/bin/claude'].find(existsSync) || 'claude'

const foodPrompt = text => `You are a nutrition estimator. Parse this description of food eaten into separate items with calorie and macro estimates. Assume reasonable portions when unspecified.
Respond with ONLY a JSON array, no markdown fences, no commentary:
[{"name": "Short Capitalized Name", "kcal": 0, "protein": 0, "carbs": 0, "fat": 0}]
All values are integers; protein/carbs/fat in grams.
Description: """${text.replace(/"""/g, '"')}"""`

function parseFoodHandler(req, res, next) {
  if (!req.url.startsWith('/ai/parse-food')) return next()
  res.setHeader('Content-Type', 'application/json')
  if (req.method !== 'POST') { res.statusCode = 405; return res.end('{"error":"POST only"}') }

  let body = ''
  req.on('data', c => { body += c })
  req.on('end', () => {
    let text
    try { text = String(JSON.parse(body).text || '').trim() } catch { /* fall through */ }
    if (!text || text.length > 600) {
      res.statusCode = 400
      return res.end(JSON.stringify({ error: 'Provide a food description under 600 characters' }))
    }

    // Clean env: this server may itself run under a Claude Code session.
    const env = Object.fromEntries(Object.entries(process.env)
      .filter(([k]) => !/^(CLAUDE|ANTHROPIC)/.test(k)))

    execFile(
      CLAUDE_BIN,
      ['-p', foodPrompt(text), '--output-format', 'json', '--model', 'sonnet', '--strict-mcp-config'],
      { timeout: 90_000, env },
      (err, stdout) => {
        try {
          if (err && !stdout) throw new Error(err.killed ? 'Claude timed out' : `Claude CLI failed: ${err.message.slice(0, 200)}`)
          const out = JSON.parse(stdout)
          if (out.is_error) throw new Error(out.result || 'Claude returned an error')
          const match = String(out.result).match(/\[[\s\S]*\]/)
          if (!match) throw new Error('No JSON in model output')
          const items = JSON.parse(match[0]).slice(0, 12).map(i => ({
            name: String(i.name || 'Item').slice(0, 60),
            kcal: Math.max(0, Math.round(+i.kcal || 0)),
            protein: Math.max(0, Math.round(+i.protein || 0)),
            carbs: Math.max(0, Math.round(+i.carbs || 0)),
            fat: Math.max(0, Math.round(+i.fat || 0)),
          })).filter(i => i.kcal > 0 || i.protein > 0)
          if (!items.length) throw new Error('Could not identify any food items')
          res.end(JSON.stringify({ items }))
        } catch (e) {
          res.statusCode = 502
          res.end(JSON.stringify({ error: e.message }))
        }
      },
    )
  })
}

const aiFood = () => ({
  name: 'afd-ai-food',
  configureServer(server) { server.middlewares.use(parseFoodHandler) },
  configurePreviewServer(server) { server.middlewares.use(parseFoodHandler) },
})

// Same-origin proxy to Yahoo Finance (no CORS headers on their end, no API key needed).
// Works in `vite dev` and `vite preview`; a static host would need its own rewrite rule.
const yahooProxy = {
  '/yq': {
    target: 'https://query1.finance.yahoo.com',
    changeOrigin: true,
    rewrite: path => path.replace(/^\/yq/, ''),
    headers: { 'User-Agent': 'Mozilla/5.0' },
  },
}

export default defineConfig({
  server: { proxy: yahooProxy },
  preview: { proxy: yahooProxy },
  plugins: [
    aiFood(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'AFD OS — personal mission control',
        short_name: 'AFD OS',
        description: 'Personal OS — finance, fitness & calorie tracking',
        theme_color: '#04060C',
        background_color: '#04060C',
        display: 'standalone',
        orientation: 'portrait',
        categories: ['health', 'finance', 'productivity'],
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
