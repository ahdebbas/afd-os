import assert from 'node:assert/strict'
import { DEFAULT_CASH_PULSE, reconcileCashPulse } from '../src/cashPulse.js'

const playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browserName = process.env.PLAYWRIGHT_BROWSER || 'chromium'
assert.ok(['chromium', 'webkit'].includes(browserName), 'PLAYWRIGHT_BROWSER must be chromium or webkit')
const origin = process.env.PULSE_URL || 'http://127.0.0.1:5173'
const browser = await playwright[browserName].launch({
  ...(browserName === 'chromium' ? { channel: 'chrome' } : {}),
  headless: true,
})
const savedCash = reconcileCashPulse({
  currentCash: 12345,
  cashAsOf: new Date().toISOString(),
  commitments: [{ id: 'fixture-payment', name: 'Fixture payment', amount: 123, dueDay: 1 }],
  oneOffs: [],
  coverage: {},
})
const emptyCash = reconcileCashPulse(DEFAULT_CASH_PULSE)
const userId = 'fixture-account'

async function check({ name, localCash, owner, dirty = false, signedIn = true, readError = false, invalidRead = false, editOffline = false }) {
  const errors = []
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, hasTouch: true,
    serviceWorkers: 'block',
  })
  try {
    await context.route('**/*', route => {
      const url = new URL(route.request().url())
      if (url.origin !== origin) return route.abort()
      if (url.pathname === '/src/supabase.js') return route.fulfill({
        contentType: 'application/javascript',
        body: `
          const user = { id: ${JSON.stringify(userId)}, email: 'fixture@example.invalid' };
          const session = { user, access_token: 'fixture-token' };
          let currentSession = ${signedIn ? 'session' : 'null'};
          const listeners = new Set();
          window.cloudFixture = {
            hold: true, readError: ${readError}, invalidRead: ${invalidRead},
            reads: 0, uploads: [], cash: ${JSON.stringify(savedCash)}
          };
          export const hasSupabaseConfig = true;
          export const getCachedSupabaseUserId = () => currentSession?.user.id ?? null;
          export const supabase = {
            auth: {
              getSession: async () => ({ data: { session: currentSession } }),
              onAuthStateChange: callback => {
                listeners.add(callback);
                return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
              },
              signInWithPassword: async () => {
                currentSession = session;
                for (const listener of listeners) listener('SIGNED_IN', session);
                return { data: { session }, error: null };
              }
            },
            from: () => ({
              select: () => ({
                order: async () => {
                  const fixture = window.cloudFixture;
                  fixture.reads++;
                  while (fixture.hold) await new Promise(resolve => setTimeout(resolve, 10));
                  if (fixture.readError) return { data: null, error: { message: 'Fixture read failed' } };
                  if (fixture.invalidRead) return { data: null, error: null };
                  return { data: [{ key: 'afd-cash-pulse', value: fixture.cash }], error: null };
                }
              }),
              upsert: async rows => {
                const fixture = window.cloudFixture;
                fixture.uploads.push(...rows);
                for (const row of rows) if (row.key === 'afd-cash-pulse') fixture.cash = row.value;
                return { error: null };
              }
            })
          };
        `,
      })
      if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { connected: false } })
      if (url.pathname.startsWith('/yq/')) return route.fulfill({ status: 503, body: 'Offline fixture' })
      if (url.pathname === '/food-sync.json') return route.fulfill({ json: { logs: {} } })
      return route.continue()
    })
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(({ localCash, owner, dirty }) => {
      if (sessionStorage.getItem('cloud-fixture-ready')) return
      sessionStorage.setItem('cloud-fixture-ready', 'true')
      localStorage.setItem('afd-tab', JSON.stringify('cash'))
      localStorage.setItem('afd-shell-mode', JSON.stringify('mobile'))
      if (localCash) localStorage.setItem('afd-cash-pulse', JSON.stringify(localCash))
      if (owner) localStorage.setItem('afd-cloud-user-id', owner)
      if (dirty) localStorage.setItem('afd-cloud-dirty-keys', JSON.stringify(['afd-cash-pulse']))
    }, { localCash, owner, dirty })
    await page.goto(origin)
    if (!signedIn) {
      await page.getByLabel('Email', { exact: true }).fill('fixture@example.invalid')
      await page.getByLabel('Password', { exact: true }).fill('fixture-password')
      await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    }
    await page.waitForFunction(() => window.cloudFixture?.reads > 0)
    assert.equal(await page.locator('.mobile-app').count(), 0, `${name}: modules mounted before the cloud read completed`)
    assert.equal(await page.evaluate(() => window.cloudFixture.uploads.length), 0)
    await page.evaluate(() => { window.cloudFixture.hold = false })

    if (readError || invalidRead) {
      if (owner === userId && localCash) {
        await page.locator('.mobile-app').waitFor()
        await page.getByRole('button', { name: 'Settings', exact: true }).click()
        await page.getByText('Sync error', { exact: true }).waitFor()
        await page.getByRole('button', { name: 'Close sheet', exact: true }).click()
        if (editOffline) {
          await page.getByRole('button', { name: 'Edit current cash', exact: true }).click()
          await page.getByRole('dialog').getByRole('spinbutton').fill('24680')
          await page.getByRole('button', { name: 'Update snapshot', exact: true }).click()
        }
        await page.getByRole('button', { name: 'Settings', exact: true }).click()
      } else {
        await page.getByText('Could not load cloud state', { exact: true }).waitFor()
        assert.equal(await page.locator('.mobile-app').count(), 0)
      }
      await page.waitForTimeout(500)
      assert.equal(await page.evaluate(() => window.cloudFixture.uploads.length), 0, `${name}: a failed read enabled uploads`)
      await page.evaluate(() => {
        window.cloudFixture.readError = false
        window.cloudFixture.invalidRead = false
      })
      await page.getByRole('button', { name: 'Retry cloud sync', exact: true }).click()
    }

    const expected = editOffline ? 24680 : dirty && owner === userId ? localCash.currentCash : savedCash.currentCash
    await page.waitForFunction(expected => JSON.parse(localStorage.getItem('afd-cash-pulse') || 'null')?.currentCash === expected, expected)
    await page.locator('.mobile-app').waitFor()
    await page.waitForTimeout(700)
    const result = await page.evaluate(() => ({
      local: JSON.parse(localStorage.getItem('afd-cash-pulse')),
      remote: window.cloudFixture.cash,
      uploadedCash: window.cloudFixture.uploads.filter(row => row.key === 'afd-cash-pulse').map(row => row.value.currentCash),
    }))
    assert.equal(result.local.currentCash, expected)
    assert.equal(result.remote.currentCash, expected)
    assert.ok(result.uploadedCash.every(amount => amount === expected), JSON.stringify(result.uploadedCash))
    if (!dirty && !editOffline) assert.deepEqual(result.uploadedCash, [], `${name}: mounting normalized cash produced an upload`)
    assert.deepEqual(errors, [])
    console.log(`PASS ${name}`)
  } finally {
    await context.close()
  }
}

try {
  await check({ name: 'new phone with an auth token waits for saved cloud cash' })
  await check({ name: 'new sign-in does not upload cash defaults', signedIn: false })
  await check({ name: 'clean stale empty cache yields to restored server cash', owner: userId, localCash: emptyCash })
  await check({ name: 'fresh-device read failure blocks initialization and uploads', readError: true })
  await check({ name: 'invalid cloud response is not treated as an empty account', invalidRead: true })
  await check({ name: 'cached offline data stays available without uploads', owner: userId, localCash: emptyCash, readError: true })
  await check({ name: 'genuine offline edits survive retry', owner: userId, localCash: savedCash, readError: true, editOffline: true })
  await check({ name: 'pending same-account edits are preserved', owner: userId, localCash: { ...savedCash, currentCash: 34567 }, dirty: true })
  await check({ name: 'account switching never uploads another account cache', owner: 'other-account', localCash: { ...savedCash, currentCash: 45678 }, dirty: true })
} finally {
  await browser.close()
}
