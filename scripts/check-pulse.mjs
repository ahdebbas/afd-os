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
  await page.getByRole('button', { name: "Open today's workout", exact: true }).waitFor()
  assert.equal(await page.getByText('Daily briefing', { exact: true }).count(), 0)
  await page.screenshot({ path: join(output, 'today-mobile.png') })

  await page.getByRole('navigation', { name: 'Modules' }).getByRole('button', { name: 'Cash', exact: true }).click()
  await page.locator('.cash-forecast-result').getByText('QAR\u00a024,000', { exact: true }).waitFor()
  await page.locator('.cash-next-payment').getByText('Parents', { exact: true }).waitFor()
  const tabs = page.getByRole('tablist', { name: 'Payment months' }).getByRole('tab')
  await tabs.nth(1).click()
  assert.match(await page.getByRole('tabpanel').innerText(), /Due /)
  await tabs.nth(1).press('ArrowRight')
  assert.equal(await tabs.nth(2).getAttribute('aria-selected'), 'true')
  await tabs.nth(2).press('Home')
  assert.equal(await tabs.nth(0).getAttribute('aria-selected'), 'true')
  if (today.getDate() > 1) await page.locator('.cash-payment-row.is-overdue').waitFor()
  await page.getByRole('button', { name: 'Cover months for Parents', exact: true }).click()
  const picker = page.getByRole('group', { name: 'Parents advance coverage' })
  for (const checkbox of (await picker.getByRole('checkbox').all()).slice(0, 3)) await checkbox.check()
  await picker.getByText('Cover QAR\u00a06,000', { exact: true }).waitFor()
  await picker.getByRole('button', { name: 'Save coverage' }).click()
  await page.getByText('Covered through', { exact: false }).waitFor()
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('afd-cash-pulse')))
  assert.equal(saved.currentCash, 30000)
  assert.equal(Object.keys(saved.coverage.parents).length, 3)
  await page.getByRole('button', { name: 'Cover months for Parents', exact: true }).click()
  await picker.getByRole('checkbox').nth(4).check()
  await picker.getByText('Cover QAR\u00a02,000', { exact: true }).waitFor()
  await picker.getByRole('button', { name: 'Save coverage' }).click()
  await page.getByRole('button', { name: 'Cover months for Parents', exact: true }).click()
  await picker.getByRole('checkbox').nth(4).uncheck()
  await picker.getByText('Reopen QAR\u00a02,000', { exact: true }).waitFor()
  await picker.getByRole('button', { name: 'Save coverage' }).click()
  const reversed = await page.evaluate(() => JSON.parse(localStorage.getItem('afd-cash-pulse')))
  assert.equal(reversed.currentCash, 30000)
  assert.equal(Object.keys(reversed.coverage.parents).length, 3)
  await page.getByRole('button', { name: 'Edit Parents', exact: true }).click()
  let paymentDialog = page.getByRole('dialog', { name: 'Monthly commitment', exact: true })
  await paymentDialog.getByLabel('Amount', { exact: true }).fill('2500')
  const endMonth = localDate(new Date(today.getFullYear(), today.getMonth() + 1, 1)).slice(0, 7)
  await paymentDialog.getByLabel('Last payment month (optional)', { exact: true }).fill(endMonth)
  await paymentDialog.getByRole('button', { name: 'Delete Parents', exact: true }).click()
  assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('afd-cash-pulse')))).commitments.length, 1)
  await paymentDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await paymentDialog.getByRole('button', { name: 'Save payment', exact: true }).click()
  await page.reload()
  const edited = await page.evaluate(() => JSON.parse(localStorage.getItem('afd-cash-pulse')))
  assert.equal(edited.commitments[0].endMonth, endMonth)
  assert.equal(edited.commitments[0].amount, 2500)
  assert.equal(edited.currentCash, 30000)
  await page.getByRole('button', { name: 'Add planned payment', exact: true }).click()
  paymentDialog = page.getByRole('dialog', { name: 'Planned payment', exact: true })
  await paymentDialog.getByLabel('Name', { exact: true }).fill('Test insurance')
  await paymentDialog.getByLabel('Amount', { exact: true }).fill('700')
  await paymentDialog.getByLabel('Due date', { exact: true }).fill(todayKey)
  await paymentDialog.getByRole('button', { name: 'Save payment', exact: true }).click()
  await page.getByRole('button', { name: 'Edit Test insurance', exact: true }).click()
  await paymentDialog.getByRole('button', { name: 'Delete Test insurance', exact: true }).click()
  await paymentDialog.getByRole('button', { name: 'Confirm delete', exact: true }).click()
  assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('afd-cash-pulse')))).oneOffs.length, 0)
  await page.getByRole('button', { name: 'Edit current cash', exact: true }).click()
  await page.getByRole('dialog', { name: 'Current cash', exact: true }).getByRole('spinbutton').fill('35000')
  await page.getByRole('button', { name: 'Update snapshot', exact: true }).click()
  await page.getByRole('navigation', { name: 'Modules' }).getByRole('button', { name: 'Today', exact: true }).click()
  await page.locator('.today-cash-balance').filter({ hasText: 'QAR\u00a035,000' }).waitFor()
  console.log('PASS: reversible advance coverage, preview totals, keyboard month tabs, end-month persistence, edit amounts, deletion confirmation and cash synchronization')

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

  for (const width of [320, 390, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    const nav = width < 1024 ? page.getByRole('navigation', { name: 'Modules' }) : page.getByRole('navigation', { name: 'Sections' })
    await nav.getByRole('button', { name: width < 1024 ? 'Today' : /Overview/ }).click()
    await page.locator(width < 1024 ? '.today-restored' : '.overview-restored').waitFor()
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, content: document.body.scrollWidth }))
    assert.ok(dimensions.content <= dimensions.viewport, `Viewport overflow at ${width}`)
    const homeWidgets = page.locator(width < 1024 ? '.today-restored button.today-card' : '.overview-restored > .grid > .d-card')
    assert.equal(await homeWidgets.count(), width < 1024 ? 4 : 5)
    const widgetBounds = await homeWidgets.evaluateAll(widgets => widgets.map(widget => {
      const bounds = widget.getBoundingClientRect()
      return { left: bounds.left, right: bounds.right, overflow: widget.scrollWidth > widget.clientWidth + 1 }
    }))
    await page.screenshot({ path: join(output, `today-${width}.png`) })
    assert.ok(widgetBounds.every(bounds => bounds.left >= 0 && bounds.right <= width && !bounds.overflow), `Widget overflow at ${width}: ${JSON.stringify(widgetBounds)}`)
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await page.screenshot({ path: join(output, `today-dark-${width}.png`) })
    await page.evaluate(() => document.documentElement.classList.remove('dark'))
    await nav.getByRole('button', { name: width < 1024 ? 'Cash' : /Cash/ }).click()
    await page.getByRole('tablist', { name: 'Payment months' }).waitFor()
    const cashFits = await page.locator(width < 1024 ? '.cash-page' : '.cash-desktop').evaluate(section => {
      const elements = [section, ...section.querySelectorAll('.cash-forecast-result, .cash-forecast-details, .cash-next-payment, .cash-month-tabs, .cash-payment-row, button[role="tab"]')]
      return elements.every(element => {
        const bounds = element.getBoundingClientRect()
        return bounds.left >= 0 && bounds.right <= innerWidth + 1 && element.scrollWidth <= element.clientWidth + 1
      })
    })
    assert.ok(cashFits, `Cash overflow at ${width}`)
    await page.screenshot({ path: join(output, `cash-${width}.png`) })
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await page.screenshot({ path: join(output, `cash-dark-${width}.png`) })
    await page.evaluate(() => document.documentElement.classList.remove('dark'))
  }
  await page.getByRole('button', { name: 'Cover months for Parents', exact: true }).click()
  await picker.getByRole('checkbox').nth(0).uncheck()
  await picker.getByRole('button', { name: 'Save coverage' }).click()
  await page.getByRole('button', { name: 'Edit Parents', exact: true }).click()
  await page.getByLabel('Last payment month (optional)', { exact: true }).fill('')
  await page.getByLabel('Active commitment', { exact: true }).uncheck()
  await page.getByRole('button', { name: 'Save payment', exact: true }).click()
  await page.getByRole('tablist', { name: 'Payment months' }).getByRole('tab').nth(1).click()
  await page.getByRole('tabpanel').getByText('No payments scheduled.', { exact: true }).waitFor()
  await page.getByRole('tablist', { name: 'Payment months' }).getByRole('tab').nth(0).click()
  await page.getByRole('tabpanel').getByText('Parents', { exact: true }).waitFor()
  const paused = await page.evaluate(() => JSON.parse(localStorage.getItem('afd-cash-pulse')))
  assert.equal(paused.currentCash, 35000)
  assert.equal(paused.commitments[0].active, false)
  assert.equal(paused.commitments[0].endMonth, null)
  assert.equal(paused.commitments[0].pausedPeriods.length, 1)
  console.log('PASS: desktop pause preserves current obligations and removes future payments')
  await page.setViewportSize({ width: 390, height: 900 })
  await page.getByRole('navigation', { name: 'Modules' }).getByRole('button', { name: 'Finance', exact: true }).click()
  let marketChange = page.getByRole('region', { name: 'Market value change', exact: true })
  await marketChange.getByText('No earlier snapshot to compare.', { exact: true }).waitFor()
  assert.equal(await marketChange.getByRole('table').count(), 0)
  const history = [3, 9, 35].map(days => {
    const date = new Date(today)
    date.setDate(date.getDate() - days)
    return { date: localDate(date), msft: 80000000 + days, sarwa: 20000000, marketTotal: 100000000 + days, msftNetWorthShare: 80, positionsKey: 'earlier-positions' }
  })
  await page.addInitScript(() => {
    const history = sessionStorage.getItem('finance-history-fixture')
    if (history) localStorage.setItem('afd-finance-snapshots', history)
  })
  await page.evaluate(history => sessionStorage.setItem('finance-history-fixture', JSON.stringify(history)), history)
  await page.reload()
  marketChange = page.getByRole('region', { name: 'Market value change', exact: true })
  await marketChange.getByRole('table').waitFor()
  for (const days of [3, 9, 35]) await marketChange.getByRole('rowheader', { name: `${days} days`, exact: true }).waitFor()
  await marketChange.getByText('Includes holding changes; not investment return.', { exact: false }).waitFor()
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 900 })
    const fits = await marketChange.evaluate(section => {
      const bounds = section.getBoundingClientRect()
      return bounds.left >= 0 && bounds.right <= innerWidth && section.scrollWidth <= section.clientWidth + 1 && [...section.querySelectorAll('th, td, dd, strong')].every(element => element.scrollWidth <= element.clientWidth + 1)
    })
    assert.ok(fits, `Market change overflow at ${width}`)
  }
  await page.evaluate(history => sessionStorage.setItem('finance-history-fixture', JSON.stringify(history)), history.slice(-1))
  await page.reload()
  await marketChange.locator('.capital-pulse-result').waitFor()
  assert.equal(await marketChange.getByRole('table').count(), 0)
  console.log('PASS: market change empty state, actual periods, holding-change caveat, deduplication and large-value layout')
  const reviewContext = await browser.newContext({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' })
  await reviewContext.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.origin !== origin) return route.abort()
    if (url.pathname === '/src/cloud.jsx') return route.fulfill({ contentType: 'application/javascript', body: 'export function CloudProvider({children}) { return children } export function CloudStatus() { return null }' })
    if (url.pathname === '/src/supabase.js') return route.fulfill({ contentType: 'application/javascript', body: 'export const hasSupabaseConfig=true; export const supabase={auth:{getSession:async()=>({data:{session:window.reviewUser ? {access_token:window.reviewUser,user:{id:window.reviewUser}}:null}})}};' })
    if (url.pathname === '/food-sync.json') return route.fulfill({ json: { logs: { [todayKey]: [{ uid: 'review-sync', name: 'Imported review meal', kcal: 300, protein: 20, carbs: 30, fat: 10 }] } } })
    if (url.pathname.startsWith('/api/whoop/')) return route.fulfill({ json: { connected: true, kcal: 1200, cycles: [], owner: route.request().headers().authorization } })
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} })
    if (url.pathname.startsWith('/yq/')) return route.abort()
    return route.continue()
  })
  await reviewContext.addInitScript(day => {
    window.reviewUser = null
    if (sessionStorage.getItem('review-ready')) return
    localStorage.setItem('afd-tab', JSON.stringify('food'))
    localStorage.setItem('afd-food-day', JSON.stringify(day))
    localStorage.setItem('afd-presets', JSON.stringify([{ id: 'p2', name: 'Edited pizza', kcal: 999, protein: 40, carbs: 30, fat: 20, category: 'Meals' }]))
    sessionStorage.setItem('review-ready', 'true')
  }, todayKey)
  const review = await reviewContext.newPage()
  review.on('pageerror', error => errors.push(error.message))
  await review.goto(origin)
  await review.getByRole('button', { name: 'Remove Imported review meal', exact: true }).click()
  await review.reload()
  await review.getByRole('button', { name: 'Add Edited pizza', exact: true }).waitFor()
  assert.equal(await review.getByRole('button', { name: 'Remove Imported review meal', exact: true }).count(), 0)
  const restoredPresets = await review.evaluate(() => JSON.parse(localStorage.getItem('afd-presets')))
  assert.equal(restoredPresets.length, 1)
  assert.equal(restoredPresets[0].kcal, 999)
  assert.deepEqual(await review.evaluate(async () => {
    const api = await import('/src/whoop.js')
    const before = await api.fetchWhoopCalories()
    window.reviewUser = 'review-A'
    const first = await api.fetchWhoopCalories()
    window.reviewUser = 'review-B'
    const second = await api.fetchWhoopCalories()
    return { before: before.connected, first: first.owner, second: second.owner }
  }), { before: false, first: 'Bearer review-A', second: 'Bearer review-B' })
  assert.deepEqual(await review.evaluate(async () => {
    const { importData } = await import('/src/backup.js')
    const cloud = await import('/src/cloudSync.js')
    localStorage.removeItem('afd-cloud-dirty-keys')
    await importData(new Blob([JSON.stringify({ app: 'afd-os', version: 1, data: { 'afd-cash-pulse': { currency: 'QAR', currentCash: 12345, commitments: [], oneOffs: [], coverage: {} } } })]))
    return {
      cash: JSON.parse(localStorage.getItem('afd-cash-pulse')).currentCash,
      preserve: cloud.shouldPreserveHydrationChange('user1', 'user1', false, cloud.isCloudStateDirty('afd-cash-pulse')),
      programSynced: cloud.CLOUD_STATE_KEYS.includes('afd-program-v2'),
      progressSynced: cloud.CLOUD_STATE_KEYS.includes('afd-fit-exercise-progress'),
    }
  }), { cash: 12345, preserve: true, programSynced: true, progressSynced: true })
  assert.deepEqual(await review.evaluate(async () => {
    const { FINANCE, holdingValue, sarwaTotal } = await import('/src/data.js')
    const empty = { ...FINANCE.sarwa, holdings: FINANCE.sarwa.holdings.map(holding => ({ ...holding, units: 0 })) }
    return [holdingValue(empty.holdings[0], { 'ISDW.L': { price: 100 } }), sarwaTotal(empty, null)]
  }), [0, 0])
  await review.getByRole('button', { name: 'Add Edited pizza', exact: true }).click()
  for (const width of [320, 390, 430, 1024, 1440]) {
    await review.setViewportSize({ width, height: 900 })
    const desktop = width >= 1024
    const navigation = review.getByRole('navigation', { name: desktop ? 'Sections' : 'Modules' })
    for (const module of ['Today', 'Finance', 'Cash', 'Food', 'Fitness']) {
      await navigation.getByRole('button', { name: desktop ? new RegExp(module === 'Today' ? 'Overview' : module) : module, exact: !desktop }).click()
      const root = desktop ? review.locator('.d-enter').first() : module === 'Today' ? review.locator('.today-restored') : review.locator('.screen-scroll[aria-hidden="false"] .boot > div').first()
      for (const dark of [false, true]) {
        await review.evaluate(dark => document.documentElement.classList.toggle('dark', dark), dark)
        const overflowing = await root.evaluate(root => [...root.querySelectorAll('.panel,.d-card,.today-card,.food-hero,.food-journal-entry')].filter(element => {
          const bounds = element.getBoundingClientRect()
          return bounds.right > innerWidth + 2 || element.scrollWidth > element.clientWidth + 2
        }).map(element => element.textContent.slice(0, 70)))
        assert.deepEqual(overflowing, [], `${module} overflow at ${width}, dark=${dark}`)
        if (!desktop && module === 'Today') {
          const gaps = await root.evaluate(root => [...root.children].slice(1).map((node, index) => Math.round(node.getBoundingClientRect().top - root.children[index].getBoundingClientRect().bottom)))
          assert.deepEqual(gaps, [16, 16, 16])
        }
        await review.screenshot({ path: join(output, `review-${module.toLowerCase()}-${width}-${dark ? 'dark' : 'light'}.png`) })
      }
    }
  }
  await review.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: /Food/ }).click()
  await review.getByPlaceholder('kcal', { exact: true }).fill('-100')
  await review.getByRole('button', { name: /Add to today/ }).click()
  assert.equal(await review.getByPlaceholder('kcal', { exact: true }).inputValue(), '-100')
  assert.ok(await review.evaluate(() => Object.values(JSON.parse(localStorage.getItem('afd-food-log'))).flat().every(entry => entry.kcal >= 0)))
  await review.evaluate(day => {
    localStorage.setItem('afd-sessions', JSON.stringify([{ date: day, idx: 0, name: 'Chest & Triceps', weights: {} }]))
    localStorage.setItem('afd-tab', JSON.stringify('fitness'))
  }, todayKey)
  await review.reload()
  await review.getByRole('button', { name: 'Undo', exact: true }).waitFor()
  assert.equal(await review.locator('.d-card h3').first().innerText(), 'Chest & Triceps')
  await review.keyboard.press('Meta+l')
  const quickLog = review.getByRole('dialog', { name: 'Quick log', exact: true })
  await quickLog.waitFor()
  for (const width of [320, 390, 1440]) {
    await review.setViewportSize({ width, height: 900 })
    assert.ok(await quickLog.evaluate(root => {
      const panel = root.querySelector('.panel')
      return panel.scrollWidth <= panel.clientWidth + 1
    }), `Quick Log overflow at ${width}`)
  }
  await reviewContext.close()
  console.log('PASS: reload persistence, WHOOP isolation, restore preservation, zero holdings, input validation, recorded workout and all-page spacing in both themes')
  assert.deepEqual(errors, [])
  console.log('PASS: mobile/desktop layout smoke tests; no uncaught browser errors')
  console.log(`Screenshots: ${output}`)
} finally {
  await browser.close()
}