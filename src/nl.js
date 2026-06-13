// Natural-language food parsing — calls the local /ai/parse-food endpoint
// (headless Claude Code via the Vite middleware; not available on Netlify).

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
