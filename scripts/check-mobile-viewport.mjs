import assert from 'node:assert/strict'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const origin = process.env.PULSE_URL || 'http://127.0.0.1:5173'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const errors = []

try {
  for (const standalone of [true, false]) {
    for (const dark of [false, true]) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        reducedMotion: 'reduce',
      })
      await context.route('**/*', async route => {
        const url = new URL(route.request().url())
        if (url.origin !== origin) return route.abort()
        if (url.pathname === '/src/cloud.jsx') return route.fulfill({
          contentType: 'application/javascript',
          body: 'export function CloudProvider({children}) { return children } export function CloudStatus() { return null }',
        })
        if (standalone && url.pathname === '/src/index.css') {
          const response = await route.fetch()
          return route.fulfill({ response, body: (await response.text()).replaceAll('(display-mode: standalone)', '(min-width: 0px)') })
        }
        if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { connected: false } })
        if (url.pathname.startsWith('/yq/')) return route.fulfill({ status: 503, body: 'Offline fixture' })
        if (url.pathname === '/food-sync.json') return route.fulfill({ json: { logs: {} } })
        return route.continue()
      })
      const page = await context.newPage()
      page.on('pageerror', error => errors.push(error.message))
      await page.addInitScript(({ standalone, dark }) => {
        Object.defineProperty(navigator, 'standalone', { value: standalone })
        localStorage.setItem('afd-shell-mode', JSON.stringify('mobile'))
        localStorage.setItem('afd-tab', JSON.stringify('finance'))
        localStorage.setItem('afd-theme-dark', JSON.stringify(dark))
      }, { standalone, dark })
      if (standalone) {
        const cdp = await context.newCDPSession(page)
        await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 47, bottom: 34, left: 0, right: 0 } })
      }
      await page.goto(origin)
      const dock = page.getByRole('navigation', { name: 'Modules' })
      await dock.waitFor()
      if (standalone) {
        // Model WebKit resolving fixed edges against a shorter containing block.
        await page.addStyleTag({ content: '#root { height: calc(100dvh - 54px); transform: translateZ(0); }' })
      }
      const checkDock = async () => {
        await page.waitForFunction(() => {
          const shell = document.querySelector('.mobile-app')
          const dock = document.querySelector('.mobile-dock-rail')
          return shell && dock && Math.abs(shell.getBoundingClientRect().bottom - window.innerHeight) < 1 &&
            Math.abs(dock.getBoundingClientRect().bottom - window.innerHeight) < 1
        }, undefined, { timeout: 5000 })
        const metrics = await page.evaluate(() => {
          const dock = document.querySelector('.mobile-dock-rail')
          const style = getComputedStyle(dock)
          const buttons = [...dock.querySelectorAll('button')]
          const contentBottom = Math.max(...buttons.map(button => button.getBoundingClientRect().bottom))
          return {
            padding: parseFloat(style.paddingBottom),
            gap: dock.getBoundingClientRect().bottom - contentBottom,
            height: dock.getBoundingClientRect().height,
            viewport: window.innerHeight,
            overflow: document.documentElement.scrollWidth > window.innerWidth,
          }
        })
        assert.ok(metrics.gap <= metrics.padding + 8, JSON.stringify(metrics))
        assert.ok(metrics.height <= 72 + metrics.padding, JSON.stringify(metrics))
        assert.equal(metrics.overflow, false)
        assert.ok(metrics.viewport > 0)
        if (standalone) assert.equal(metrics.padding, 34)
      }
      for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 375, height: 667 }]) {
        await page.setViewportSize(viewport)
        for (const name of ['Finance', 'Cash', 'Food', 'Fitness', 'Home']) {
          await dock.getByRole('button', { name, exact: true }).click()
          await checkDock()
        }
      }
      await page.evaluate(() => window.dispatchEvent(new Event('pageshow')))
      await checkDock()
      await page.evaluate(async () => {
        const { applyCloudState } = await import('/src/cloudSync.js')
        applyCloudState('afd-shell-mode', 'desktop')
      })
      await page.locator('.dsk').waitFor()
      assert.equal(await page.locator('[data-standalone]').count(), 0)
      assert.equal(await page.locator('[style*="--app-viewport-height"]').count(), 0)
      console.log(`PASS ${standalone ? 'installed' : 'browser'} ${dark ? 'dark' : 'light'}: all tabs, rotation, compact safe-area dock, resume, desktop switch`)
      await context.close()
    }
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
