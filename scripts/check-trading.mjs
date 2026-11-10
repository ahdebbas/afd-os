import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { FINANCE, propertyTotal, sarwaTotal, usd } from '../src/data.js'
import { DEFAULT_HOME_STATE } from '../src/homeGoals.js'
import { QUOTE_SYMBOLS, mergeQuoteResults } from '../src/quoteCache.js'
import { buildFinanceSnapshot, toMarketSnapshot } from '../src/financePerformance.js'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const origin = process.env.PULSE_URL || 'http://127.0.0.1:5173'
const syncedAt = new Date().toISOString()
const cache = mergeQuoteResults(null, QUOTE_SYMBOLS.map(() => ({
  status: 'fulfilled', value: { price: 100, currency: 'USD', changePct: 0, low52: 50, high52: 300 },
})), syncedAt)
const baseline = { ...toMarketSnapshot(buildFinanceSnapshot({ finance: FINANCE, quotes: cache.data })), date: '2020-01-01' }
const initialTotal = FINANCE.msft.shares * 100 + sarwaTotal(FINANCE.sarwaTrade, cache.data)
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  for (const width of [390, 1440]) for (const dark of [false, true]) {
    const errors = []
    const requests = []
    const prices = { AAPL: 200 }
    const failures = new Set()
    let held = null
    let holdSymbol = null
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' })
    await context.route('**/*', route => {
      const url = new URL(route.request().url())
      if (url.origin !== origin) return route.abort()
      if (url.pathname === '/src/cloud.jsx') return route.fulfill({ contentType: 'application/javascript', body: 'export function CloudProvider({children}) { return children } export function CloudStatus() { return null }' })
      if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { connected: false } })
      if (url.pathname === '/food-sync.json') return route.fulfill({ json: { logs: {} } })
      if (!url.pathname.startsWith('/yq/')) return route.continue()
      const ticker = decodeURIComponent(url.pathname.split('/').at(-1))
      requests.push(ticker)
      const fulfill = () => route.fulfill(failures.has(ticker) ? { status: 503, body: 'Offline' }
        : { json: { chart: { result: [{ meta: {
          regularMarketPrice: prices[ticker] ?? 100, chartPreviousClose: 100,
          currency: ticker === 'SAP.DE' ? 'EUR' : 'USD', shortName: ticker === 'AAPL' ? 'Apple Inc.' : ticker,
          ...ticker === 'BRK-B' ? {} : { fiftyTwoWeekLow: 50, fiftyTwoWeekHigh: 300 },
        } }] } } })
      if (ticker === holdSymbol) { held = fulfill; holdSymbol = null; return }
      return fulfill()
    })
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    await page.clock.install()
    await page.addInitScript(fixture => {
      if (sessionStorage.getItem('trading-ready')) return
      for (const [key, value] of Object.entries(fixture)) localStorage.setItem(key, JSON.stringify(value))
      sessionStorage.setItem('trading-ready', 'true')
    }, {
      'afd-tab': 'finance', 'afd-theme-dark': dark, 'afd-shell-mode': 'auto',
      'afd-home-v1': { ...DEFAULT_HOME_STATE, view: 'classic' },
      'afd-finance': FINANCE, 'afd-finance-snapshots': [baseline], 'afd-quotes': cache,
    })
    await page.goto(origin)
    const trading = page.getByRole('region', { name: 'Trading', exact: true })
    const row = ticker => trading.getByRole('group', { name: `${ticker} holding`, exact: true })
    const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('afd-finance')))
    const waitCache = ticker => page.waitForFunction(ticker => {
      const cache = JSON.parse(localStorage.getItem('afd-quotes'))
      return cache?.data?.[ticker]?.fetchedAt === cache?.syncedAt && !cache.errors?.length
    }, ticker)
    const netWorth = async () => {
      const finance = await stored()
      const quotes = await page.evaluate(() => JSON.parse(localStorage.getItem('afd-quotes')).data)
      return finance.msft.shares * (quotes.MSFT?.price ?? finance.msft.price)
        + sarwaTotal(finance.sarwa, quotes) + sarwaTotal(finance.sarwaTrade, quotes) + propertyTotal(finance)
    }
    const assertNetWorth = async () => page.waitForFunction(({ mobile, expected }) => {
      const element = mobile ? document.querySelector('.finance-total')
        : [...document.querySelectorAll('.d-eyebrow')].find(element => element.textContent === 'Net worth')?.parentElement.querySelector('.d-h1')
      return (mobile ? element?.getAttribute('aria-label') : element?.textContent) === expected
    }, { mobile: width < 1024, expected: usd(await netWorth()) })
    const switchTab = tab => page.getByRole('navigation', { name: width < 1024 ? 'Modules' : 'Sections' })
      .getByRole('button', { name: width < 1024 ? tab === 'today' ? 'Today' : 'Finance' : new RegExp(tab === 'today' ? 'Overview' : 'Finance'), exact: width < 1024 }).click()
    const add = async (ticker, shares = '2.5') => {
      if (!await trading.getByRole('form', { name: 'Add stock', exact: true }).count()) {
        await trading.getByRole('button', { name: 'Add stock', exact: true }).click()
      }
      const form = trading.getByRole('form', { name: 'Add stock', exact: true })
      await form.getByLabel('Stock ticker', { exact: true }).fill(ticker)
      await form.getByLabel('Number of shares', { exact: true }).fill(shares)
      await form.getByRole('button', { name: 'Save stock', exact: true }).click()
      return form
    }
    const refresh = async () => {
      const button = width < 1024 ? page.getByRole('button', { name: 'Refresh market data', exact: true })
        : page.locator('button:has(svg.lucide-refresh-cw)').first()
      await button.click()
    }
    const remove = async (ticker, confirmed = true) => {
      page.once('dialog', dialog => confirmed ? dialog.accept() : dialog.dismiss())
      await row(ticker).getByRole('button', { name: `Remove ${ticker}`, exact: true }).click()
      if (confirmed) await row(ticker).waitFor({ state: 'detached' })
    }
    await trading.waitFor()
    await trading.getByText(usd(initialTotal), { exact: true }).waitFor()
    assert.equal(await trading.getByRole('group', { name: / holding$/ }).count(), 4)
    let form = await add('msft')
    await form.getByRole('alert').getByText(/already in Trading/).waitFor()
    assert.equal(requests.length, 0)
    form = await add('Apple Inc')
    await form.getByRole('alert').getByText(/Enter a stock ticker/).waitFor()
    form = await add('SAP.DE')
    await form.getByRole('alert').getByText(/Only USD-priced/).waitFor()
    failures.add('FAIL')
    form = await add('FAIL')
    await form.getByRole('alert').getByText(/HTTP 503/).waitFor()
    assert.equal((await stored()).sarwaTrade.holdings.length, 3)
    await add(' aapl ')
    await row('AAPL').getByText('Apple Inc.', { exact: true }).waitFor()
    await waitCache('AAPL')
    await trading.getByText(usd(initialTotal + 500), { exact: true }).waitFor()
    await assertNetWorth()
    await row('AAPL').getByRole('meter').waitFor()
    assert.equal((await stored()).sarwaTrade.holdings.at(-1).units, 2.5)
    if (width < 1024) await page.getByText('Purchases and sales are not gains.', { exact: false }).first().waitFor()
    const count = requests.length
    prices.AAPL = 250
    await refresh()
    await row('AAPL').getByText(`${usd(250, 2)} / share`, { exact: true }).waitFor()
    assert.equal(requests.slice(count).includes('AAPL'), true)
    prices.AAPL = 300
    await page.clock.fastForward(60 * 60 * 1000)
    await row('AAPL').getByText(`${usd(300, 2)} / share`, { exact: true }).waitFor()
    await waitCache('AAPL')
    await trading.getByRole('button', { name: 'Edit Trading shares', exact: true }).click()
    await row('AAPL').getByLabel('AAPL shares', { exact: true }).fill('3.25')
    await row('AAPL').getByText(usd(975, 2), { exact: true }).waitFor()
    await assertNetWorth()
    failures.add('AAPL')
    const beforeFailure = requests.length
    await refresh()
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('afd-quotes')).errors.some(error => error.startsWith('AAPL:')))
    await row('AAPL').getByText(usd(975, 2), { exact: true }).waitFor()
    await page.clock.fastForward(250)
    assert.equal(requests.length - beforeFailure, QUOTE_SYMBOLS.length + 1, 'a failed symbol must not trigger a retry loop')
    await remove('AAPL', false)
    assert.equal(await row('AAPL').count(), 1)
    await remove('AAPL')
    await row('GOOGL').getByText(/^Live/).waitFor()
    const afterRemoval = requests.length
    await refresh()
    await waitCache('MSFT')
    assert.equal(requests.slice(afterRemoval).includes('AAPL'), false)
    await remove('MSFT')
    assert.equal((await stored()).msft.shares, 0)
    await assertNetWorth()
    await page.reload()
    await trading.waitFor()
    assert.equal(await row('MSFT').count(), 0)
    assert.equal(await row('AAPL').count(), 0)
    await add('msft', '1.25')
    await row('MSFT').waitFor()
    assert.equal((await stored()).sarwaTrade.holdings.some(holding => holding.ticker === 'MSFT'), false)
    assert.equal((await stored()).msft.shares, 1.25)
    await add('BRK-B', '0')
    await row('BRK-B').getByText('BRK-B 52-week range unavailable', { exact: true }).waitFor()
    await waitCache('BRK-B')
    await trading.getByRole('button', { name: 'Edit Trading shares', exact: true }).click()
    await row('BRK-B').getByLabel('BRK-B shares', { exact: true }).fill('2')
    await row('BRK-B').getByText(usd(200, 2), { exact: true }).waitFor()

    // A changed cloud/import membership during a pending sync must be fetched next.
    holdSymbol = 'NVDA'
    held = null
    const pendingRequest = page.waitForRequest(request => request.url().includes('/NVDA?'))
    await refresh()
    await pendingRequest
    await page.evaluate(async () => {
      const { applyCloudState } = await import('/src/cloudSync.js')
      const finance = JSON.parse(localStorage.getItem('afd-finance'))
      finance.sarwaTrade.holdings.push({ ticker: 'AMD', name: 'AMD', units: 2, recordedUnits: 2, price: 90, value: 180 })
      applyCloudState('afd-finance', finance)
    })
    await row('AMD').waitFor()
    assert.ok(held)
    await held()
    await waitCache('AMD')
    await row('AMD').getByText(`${usd(100, 2)} / share`, { exact: true }).waitFor()
    await assertNetWorth()
    const expectedHome = usd(await netWorth())
    await switchTab('today')
    const home = width < 1024 ? page.getByRole('button', { name: 'View holdings', exact: true })
      : page.locator('.d-card').filter({ has: page.getByText('Capital', { exact: true }) })
    await home.getByText(expectedHome, { exact: true }).waitFor()
    await switchTab('finance')
    await trading.waitFor()
    const edit = trading.getByRole('button', { name: 'Edit Trading shares', exact: true })
    if (await edit.count()) await edit.click()
    await row('AMD').getByRole('button', { name: 'Remove AMD', exact: true }).waitFor()

    // Cancel an outstanding validation without creating a row.
    holdSymbol = 'CANCEL'
    held = null
    form = await add('CANCEL')
    await form.getByRole('button', { name: 'Checking price...', exact: true }).waitFor()
    await form.getByRole('button', { name: 'Cancel', exact: true }).click()
    if (held) await held()
    assert.equal(await row('CANCEL').count(), 0)
    assert.equal((await stored()).sarwaTrade.holdings.some(holding => holding.ticker === 'CANCEL'), false)
    if (width < 1024) for (const small of [320, 390]) {
      await page.setViewportSize({ width: small, height: 1000 })
      assert.ok(await trading.evaluate(element => element.scrollWidth <= element.clientWidth + 1))
    }
    const downloadReady = page.waitForEvent('download')
    await page.evaluate(async () => { const { exportData } = await import('/src/backup.js'); exportData() })
    const download = await downloadReady
    const backedUp = JSON.parse(await readFile(await download.path(), 'utf8')).data['afd-finance']
    assert.deepEqual(backedUp, await stored())
    await download.delete()
    for (const ticker of ['MSFT', 'GOOGL', 'NVDA', 'SPTE', 'BRK-B', 'AMD']) await remove(ticker)
    await trading.getByText('No Trading stocks yet. Add a stock to track its value.', { exact: true }).waitFor()
    await page.reload()
    await trading.getByText('No Trading stocks yet. Add a stock to track its value.', { exact: true }).waitFor()
    assert.equal((await stored()).sarwaTrade.holdings.length, 0)
    assert.equal((await stored()).msft.removed, true)
    await assertNetWorth()
    const restored = await page.evaluate(async finance => {
      const { importData } = await import('/src/backup.js')
      return importData(new File([JSON.stringify({ app: 'afd-os', data: { 'afd-finance': finance } })], 'trading.json', { type: 'application/json' }))
    }, backedUp)
    assert.equal(restored, 1)
    await row('AMD').waitFor()
    assert.deepEqual(await stored(), backedUp)
    await assertNetWorth()
    assert.deepEqual(errors, [])
    console.log(`Trading passed: ${width}px ${dark ? 'dark' : 'light'}`)
    await context.close()
  }
} finally {
  await browser.close()
}
