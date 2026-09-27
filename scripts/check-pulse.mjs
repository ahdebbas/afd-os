import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const origin = process.env.PULSE_URL || 'http://127.0.0.1:5173'
const output = join(tmpdir(), 'baseline-pulse-check')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const errors = []
const today = new Date()
const localDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const todayKey = localDate(today)
const yesterday = new Date(today)
yesterday.setDate(yesterday.getDate() - 1)
const yesterdayKey = localDate(yesterday)
const month = todayKey.slice(0, 7)
const fixture = {
  'afd-theme-dark': false,
  'afd-tab': 'today',
  'afd-shell-mode': 'auto',
  'afd-food-log': { [yesterdayKey]: [{ uid: 'fixture-meal', name: 'Test lunch', kcal: 600, protein: 40, carbs: 60, fat: 20, time: '12:00 PM' }] },
  'afd-cash-pulse': {
    currency: 'QAR', currentCash: 30000, cashAsOf: today.toISOString(), coverage: {}, oneOffs: [],
    commitments: [{ id: 'parents', name: 'Parents', amount: 2000, dueDay: 1, active: true, startMonth: month }],
  },
}

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  await context.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin !== origin) return route.abort()
    if (url.pathname === '/src/cloud.jsx') return route.fulfill({ contentType: 'application/javascript', body: 'export function CloudProvider({children}) { return children } export function CloudStatus() { return null }' })
    if (url.pathname === '/food-sync.json') return route.fulfill({ json: { logs: {} } })
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { connected: false } })
    return route.continue()
  })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(data => {
    if (sessionStorage.getItem('pulse-fixture-ready')) return
    for (const [key, value] of Object.entries(data)) localStorage.setItem(key, JSON.stringify(value))
    sessionStorage.setItem('pulse-fixture-ready', 'true')
  }, fixture)
  await page.goto(origin)
  await page.getByRole('heading', { name: 'Up next', exact: true }).waitFor()
  assert.equal(await page.getByText('Daily briefing', { exact: true }).count(), 0)
  await page.screenshot({ path: join(output, 'today-mobile.png') })

  await page.getByRole('navigation', { name: 'Modules' }).getByRole('button', { name: 'Cash', exact: true }).click()
  await page.getByRole('button', { name: 'Cover months for Parents', exact: true }).click()
  const picker = page.getByRole('group', { name: 'Parents advance coverage' })
  for (const checkbox of (await picker.getByRole('checkbox').all()).slice(0, 3)) await checkbox.check()
  await picker.getByRole('button', { name: 'Cover selected months' }).click()
  await page.getByText('Covered through', { exact: false }).waitFor()
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('afd-cash-pulse')))
  assert.equal(saved.currentCash, 30000)
  assert.equal(Object.keys(saved.coverage.parents).length, 3)
  await page.getByRole('button', { name: 'Edit current cash', exact: true }).click()
  await page.getByRole('dialog', { name: 'Current cash', exact: true }).getByRole('spinbutton').fill('35000')
  await page.getByRole('button', { name: 'Update snapshot', exact: true }).click()
  await page.getByRole('navigation', { name: 'Modules' }).getByRole('button', { name: 'Today', exact: true }).click()
  await page.locator('.pulse-status').filter({ hasText: 'Cash' }).getByText('QAR 35,000', { exact: true }).waitFor()
  console.log('PASS: advance coverage, modal balance update, same-shell home synchronization')

  await page.getByRole('navigation', { name: 'Modules' }).getByRole('button', { name: 'Food', exact: true }).click()
  await page.getByLabel('Log date', { exact: true }).fill(yesterdayKey)
  await page.getByRole('button', { name: 'Edit Test lunch', exact: true }).click()
  await page.getByLabel('Portion multiplier', { exact: true }).fill('0.5')
  await page.getByRole('button', { name: 'Save meal', exact: true }).click()
  await page.getByRole('button', { name: 'Remove Test lunch', exact: true }).click()
  await page.locator('.food-undo').getByRole('button', { name: 'Undo', exact: true }).click()
  let log = await page.evaluate(day => JSON.parse(localStorage.getItem('afd-food-log'))[day], yesterdayKey)
  assert.equal(log.length, 1)
  assert.equal(log[0].kcal, 300)
  await page.getByRole('button', { name: 'Add Keto Pizza', exact: true }).click()
  log = await page.evaluate(day => JSON.parse(localStorage.getItem('afd-food-log'))[day], yesterdayKey)
  assert.equal(log.length, 2)
  await page.reload()
  assert.equal(await page.getByLabel('Log date', { exact: true }).inputValue(), yesterdayKey)
  await page.screenshot({ path: join(output, 'food-mobile.png') })
  console.log('PASS: backfill, portion correction, delete/undo and preserved date after reload')

  await page.getByRole('navigation', { name: 'Modules' }).getByRole('button', { name: 'Fitness', exact: true }).click()
  await page.getByText('Next exercise', { exact: true }).waitFor()
  await page.screenshot({ path: join(output, 'fitness-mobile.png') })

  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    const nav = width < 1024 ? page.getByRole('navigation', { name: 'Modules' }) : page.getByRole('navigation', { name: 'Sections' })
    await nav.getByRole('button', { name: width < 1024 ? 'Today' : /Overview/ }).click()
    await page.getByRole('heading', { name: 'Up next', exact: true }).waitFor()
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, content: document.body.scrollWidth }))
    assert.ok(dimensions.content <= dimensions.viewport, `Viewport overflow at ${width}`)
    await page.screenshot({ path: join(output, `today-${width}.png`) })
    await nav.getByRole('button', { name: width < 1024 ? 'Cash' : /Cash/ }).click()
    await page.screenshot({ path: join(output, `cash-${width}.png`) })
  }
  assert.deepEqual(errors, [])
  console.log('PASS: mobile/desktop layout smoke tests; no uncaught browser errors')
  console.log(`Screenshots: ${output}`)
} finally {
  await browser.close()
}