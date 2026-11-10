import assert from 'node:assert/strict'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const origin = process.env.PULSE_URL || 'http://127.0.0.1:5173'
const today = new Date()
const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
const cash = {
  currency: 'USD', currentCash: 30000, cashAsOf: today.toISOString(), coverage: {},
  commitments: [{ id: 'parents', name: 'Parents', amount: 2000, dueDay: 1, active: true, startMonth: date.slice(0, 7) }],
  oneOffs: [{ id: 'insurance', name: 'Insurance', amount: 1000, dueDate: date }],
}
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  for (const width of [390, 1440]) for (const dark of [false, true]) {
    const errors = []
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' })
    await context.route('**/*', route => {
      const url = new URL(route.request().url())
      if (url.origin !== origin) return route.abort()
      if (url.pathname === '/src/cloud.jsx') return route.fulfill({ contentType: 'application/javascript', body: 'export function CloudProvider({children}) { return children } export function CloudStatus() { return null }' })
      if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { connected: false } })
      if (url.pathname === '/food-sync.json') return route.fulfill({ json: { logs: {} } })
      if (url.pathname.startsWith('/yq/')) return route.fulfill({ status: 503, body: 'Offline fixture' })
      return route.continue()
    })
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(fixture => {
      if (sessionStorage.getItem('commitments-ready')) return
      for (const [key, value] of Object.entries(fixture)) localStorage.setItem(key, JSON.stringify(value))
      sessionStorage.setItem('commitments-ready', 'true')
    }, { 'afd-tab': 'cash', 'afd-shell-mode': 'auto', 'afd-theme-dark': dark, 'afd-cash-pulse': cash })
    await page.goto(origin)
    const details = page.locator('details[aria-label="Monthly commitments"]')
    const summary = details.locator('summary')
    await summary.waitFor()
    assert.equal(await details.getAttribute('open'), null)
    const oneOffsBottom = await page.getByText('Planned one-offs', { exact: true })
      .evaluate(element => element.closest('section').getBoundingClientRect().bottom)
    assert.ok((await details.boundingBox()).y >= oneOffsBottom)
    assert.equal(await details.locator('[aria-label="Add monthly commitment"]').isVisible(), false)
    const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('afd-cash-pulse')))
    const before = await stored()
    const forecast = await page.locator('.cash-forecast-result').innerText()
    await summary.focus()
    await summary.press('Enter')
    await details.getByRole('button', { name: 'Add monthly commitment', exact: true }).waitFor()
    await details.getByRole('button', { name: 'Edit Parents', exact: true }).waitFor()
    assert.deepEqual(await stored(), before)
    await summary.click()
    assert.equal(await details.getAttribute('open'), null)
    await summary.focus()
    await summary.press('Space')
    assert.notEqual(await details.getAttribute('open'), null)
    assert.equal(await page.locator('.cash-forecast-result').innerText(), forecast)
    assert.deepEqual(await stored(), before)

    await details.getByRole('button', { name: 'Add monthly commitment', exact: true }).click()
    const form = width < 1024 ? page.getByRole('dialog', { name: 'Monthly commitment', exact: true }).locator('form') : details.locator('form')
    await form.getByLabel(width < 1024 ? 'Name' : 'Payment name', { exact: true }).fill('Utilities')
    await form.getByLabel('Amount (USD)', { exact: true }).fill('100')
    if (width >= 1024) {
      await summary.click()
      assert.equal(await form.isVisible(), false)
      await summary.click()
      assert.equal(await form.getByLabel('Payment name', { exact: true }).inputValue(), 'Utilities')
    }
    await form.getByRole('button', { name: 'Save payment', exact: true }).click()
    await details.getByText('Utilities', { exact: true }).waitFor()
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('afd-cash-pulse')).commitments.length === 2)
    assert.match(await summary.innerText(), /\(2\)/)
    const after = await stored()
    const afterForecast = await page.locator('.cash-forecast-result').innerText()
    await summary.click()
    assert.deepEqual(await stored(), after)
    assert.equal(await page.locator('.cash-forecast-result').innerText(), afterForecast)
    if (width < 1024) {
      await page.setViewportSize({ width: 320, height: 900 })
      assert.ok(await details.evaluate(element => element.scrollWidth <= element.clientWidth + 1))
    }
    await page.reload()
    await summary.waitFor()
    assert.equal(await details.getAttribute('open'), null)
    assert.equal((await stored()).commitments.length, 2)
    await summary.click()
    await details.getByRole('button', { name: 'Edit Parents', exact: true }).click()
    const edit = width < 1024 ? page.getByRole('dialog', { name: 'Monthly commitment', exact: true }).locator('form') : details.locator('form')
    assert.equal(await edit.getByLabel('Amount (USD)', { exact: true }).inputValue(), '2000')
    assert.deepEqual(errors, [])
    console.log(`PASS ${width < 1024 ? 'mobile' : 'desktop'} ${dark ? 'dark' : 'light'}: order, collapsed default, keyboard toggle, add/edit, draft preservation, forecast and reload`)
    await context.close()
  }
} finally {
  await browser.close()
}
