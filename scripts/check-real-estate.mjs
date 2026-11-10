import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { FINANCE, reconcileFinance, sarwaTotal, usd } from '../src/data.js'
import { DEFAULT_HOME_STATE } from '../src/homeGoals.js'
import { buildFinanceSnapshot, toMarketSnapshot } from '../src/financePerformance.js'
import { QUOTE_SYMBOLS, mergeQuoteResults } from '../src/quoteCache.js'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const origin = process.env.PULSE_URL || 'http://127.0.0.1:5173'
const syncedAt = new Date().toISOString()
const cache = mergeQuoteResults(null, QUOTE_SYMBOLS.map(() => ({
  status: 'fulfilled', value: { price: 100, currency: 'USD', changePct: 0, low52: 50, high52: 150 },
})), syncedAt)
const finance = { ...FINANCE, version: 3, property: { name: 'Beirut apartment', location: 'Beirut, Lebanon', value: 420000 } }
delete finance.properties
const reconciled = reconcileFinance(finance)
const stockValue = reconciled.msft.shares * 100 + sarwaTotal(reconciled.sarwa, cache.data) + sarwaTotal(reconciled.sarwaTrade, cache.data)
const baseline = toMarketSnapshot(buildFinanceSnapshot({ finance: reconciled, quotes: cache.data }))
const earlier = new Date()
earlier.setDate(earlier.getDate() - 8)
baseline.date = `${earlier.getFullYear()}-${String(earlier.getMonth() + 1).padStart(2, '0')}-${String(earlier.getDate()).padStart(2, '0')}`
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
      if (url.pathname.startsWith('/yq/')) return route.abort()
      return route.continue()
    })
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(fixture => {
      if (sessionStorage.getItem('properties-ready')) return
      for (const [key, value] of Object.entries(fixture)) localStorage.setItem(key, JSON.stringify(value))
      sessionStorage.setItem('properties-ready', 'true')
    }, {
      'afd-tab': 'finance', 'afd-theme-dark': dark, 'afd-shell-mode': 'auto',
      'afd-home-v1': { ...DEFAULT_HOME_STATE, view: 'classic' },
      'afd-finance': finance, 'afd-finance-snapshots': [baseline], 'afd-quotes': cache,
    })
    await page.goto(origin)
    const estate = page.getByRole('region', { name: 'Real estate', exact: true })
    const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('afd-finance')))
    const waitProperties = count => page.waitForFunction(count =>
      JSON.parse(localStorage.getItem('afd-finance'))?.properties?.length === count, count)
    const assertTotals = async value => {
      assert.equal(await estate.getByLabel('Total property value', { exact: true }).innerText(), usd(value))
      await page.waitForFunction(({ mobile, expected }) => {
        const element = mobile ? document.querySelector('.finance-total')
          : [...document.querySelectorAll('.d-eyebrow')].find(element => element.textContent === 'Net worth')?.parentElement.querySelector('.d-h1')
        return (mobile ? element?.getAttribute('aria-label') : element?.textContent) === expected
      }, { mobile: width < 1024, expected: usd(stockValue + value) })
      if (width < 1024) {
        const market = page.getByRole('region', { name: 'Market value change', exact: true })
        await market.locator('.capital-pulse-result').waitFor()
        assert.match((await market.locator('.capital-pulse-result').innerText()).replace(/\s/g, ' '), /USD 0/)
        assert.equal(await market.getByText('Baseline restarted', { exact: false }).count(), 0)
      }
    }
    const switchTab = tab => page.getByRole('navigation', { name: width < 1024 ? 'Modules' : 'Sections' })
      .getByRole('button', { name: width < 1024 ? tab === 'today' ? 'Today' : 'Finance' : new RegExp(tab === 'today' ? 'Overview' : 'Finance'), exact: width < 1024 }).click()
    await estate.waitFor()
    await waitProperties(1)
    assert.equal((await stored()).version, FINANCE.version)
    await estate.getByText('Not set', { exact: true }).waitFor()
    await assertTotals(420000)

    await estate.getByRole('button', { name: 'Edit Beirut apartment', exact: true }).click()
    let form = estate.getByRole('form', { name: 'Edit property', exact: true })
    await form.getByLabel('Current value (USD)', { exact: true }).fill('999999')
    await form.getByRole('button', { name: 'Cancel', exact: true }).click()
    assert.equal((await stored()).properties[0].currentValue, 420000)
    await estate.getByRole('button', { name: 'Edit Beirut apartment', exact: true }).click()
    form = estate.getByRole('form', { name: 'Edit property', exact: true })
    await form.getByLabel('Property name', { exact: true }).fill('Property X')
    await form.getByLabel('Purchase value (USD, optional)', { exact: true }).fill('200000')
    await form.getByLabel('Current value (USD)', { exact: true }).fill('450000.75')
    await form.getByRole('button', { name: 'Save property', exact: true }).click()
    await estate.getByRole('group', { name: 'Property X', exact: true }).waitFor()
    await assertTotals(450000.75)

    await estate.getByRole('button', { name: 'Add property', exact: true }).click()
    form = estate.getByRole('form', { name: 'Add property', exact: true })
    await form.getByLabel('Property name', { exact: true }).fill('   ')
    await form.getByLabel('Current value (USD)', { exact: true }).fill('125000.25')
    await form.getByRole('button', { name: 'Save property', exact: true }).click()
    assert.equal(await form.getByLabel('Property name', { exact: true }).evaluate(input => input.checkValidity()), false)
    assert.equal((await stored()).properties.length, 1)
    await form.getByLabel('Property name', { exact: true }).fill('Property Y')
    await form.getByLabel('Purchase value (USD, optional)', { exact: true }).fill('-1')
    await form.getByRole('button', { name: 'Save property', exact: true }).click()
    assert.equal(await form.getByLabel('Purchase value (USD, optional)', { exact: true }).evaluate(input => input.checkValidity()), false)
    await form.getByLabel('Purchase value (USD, optional)', { exact: true }).fill('')
    await form.getByLabel('Current value (USD)', { exact: true }).fill('-1')
    await form.getByRole('button', { name: 'Save property', exact: true }).click()
    assert.equal(await form.getByLabel('Current value (USD)', { exact: true }).evaluate(input => input.checkValidity()), false)
    await form.getByLabel('Current value (USD)', { exact: true }).fill('125000.25')
    await form.getByRole('button', { name: 'Save property', exact: true }).click()
    await waitProperties(2)
    let saved = await stored()
    assert.equal(saved.properties[1].purchaseValue, null)
    assert.notEqual(saved.properties[0].id, saved.properties[1].id)
    await assertTotals(575001)
    await page.reload()
    await estate.getByRole('group', { name: 'Property Y', exact: true }).waitFor()
    assert.deepEqual((await stored()).properties, saved.properties)
    await assertTotals(575001)

    await estate.getByRole('button', { name: 'Edit Property Y', exact: true }).click()
    form = estate.getByRole('form', { name: 'Edit property', exact: true })
    await form.getByLabel('Purchase value (USD, optional)', { exact: true }).fill('0')
    await form.getByLabel('Current value (USD)', { exact: true }).fill('0')
    await form.getByRole('button', { name: 'Save property', exact: true }).click()
    await assertTotals(450000.75)
    const zero = estate.getByRole('group', { name: 'Property Y', exact: true })
    assert.equal(await zero.getByText(usd(0, 2), { exact: true }).count(), 2)
    await estate.getByRole('button', { name: 'Edit Property Y', exact: true }).click()
    form = estate.getByRole('form', { name: 'Edit property', exact: true })
    await form.getByLabel('Current value (USD)', { exact: true }).fill('125000.25')
    await form.getByRole('button', { name: 'Save property', exact: true }).click()
    await assertTotals(575001)

    if (width < 1024) for (const small of [320, 390]) {
      await page.setViewportSize({ width: small, height: 1000 })
      assert.ok(await estate.evaluate(element => element.scrollWidth <= element.clientWidth + 1))
    }
    await switchTab('today')
    const home = width < 1024 ? page.getByRole('button', { name: 'View holdings', exact: true })
      : page.locator('.d-card').filter({ has: page.getByText('Capital', { exact: true }) })
    await home.getByText(usd(stockValue + 575001), { exact: true }).waitFor()
    await home.getByText(usd(575001), { exact: true }).waitFor()
    await switchTab('finance')
    await estate.waitFor()

    const downloadPromise = page.waitForEvent('download')
    await page.evaluate(async () => { const { exportData } = await import('/src/backup.js'); exportData() })
    const download = await downloadPromise
    const backup = JSON.parse(await readFile(await download.path(), 'utf8'))
    saved = await stored()
    assert.deepEqual(backup.data['afd-finance'].properties, saved.properties)
    await download.delete()
    await estate.getByRole('button', { name: 'Delete Property Y', exact: true }).click()
    await estate.getByRole('group', { name: 'Confirm deletion of Property Y', exact: true }).getByRole('button', { name: 'Cancel', exact: true }).click()
    assert.equal((await stored()).properties.length, 2)
    for (const name of ['Property Y', 'Property X']) {
      await estate.getByRole('button', { name: `Delete ${name}`, exact: true }).click()
      await estate.getByRole('button', { name: 'Confirm delete', exact: true }).click()
    }
    await waitProperties(0)
    await page.reload()
    await estate.getByText('No properties yet. Add your first property.', { exact: true }).waitFor()
    await assertTotals(0)
    const restored = await page.evaluate(async finance => {
      const { importData } = await import('/src/backup.js')
      return importData(new File([JSON.stringify({ app: 'afd-os', data: { 'afd-finance': finance } })], 'properties.json', { type: 'application/json' }))
    }, saved)
    assert.equal(restored, 1)
    await waitProperties(2)
    await assertTotals(575001)
    assert.deepEqual((await stored()).properties, saved.properties)
    assert.deepEqual(errors, [])
    console.log(`PASS ${width < 1024 ? 'mobile' : 'desktop'} ${dark ? 'dark' : 'light'}: migration, CRUD, validation, totals, Home, market exclusion, reload, backup`)
    await context.close()
  }
} finally {
  await browser.close()
}
