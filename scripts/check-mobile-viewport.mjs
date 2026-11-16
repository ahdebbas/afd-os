import assert from 'node:assert/strict'
import { DEFAULT_HOME_STATE } from '../src/homeGoals.js'

const playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const engine = process.env.PLAYWRIGHT_BROWSER || 'chromium'
const origin = process.env.PULSE_URL || 'http://127.0.0.1:5173'
const browser = await playwright[engine].launch({ ...(engine === 'chromium' ? { channel: 'chrome' } : {}), headless: true })
const errors = []
const viewports = [
  { width: 390, height: 844 },
  { width: 840, height: 760 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
  { width: 360, height: 740 },
  { width: 540, height: 720 },
  { width: 720, height: 720 },
  { width: 1100, height: 820 },
  { width: 1280, height: 900 },
  { width: 844, height: 390 },
  { width: 375, height: 667 },
]

try {
  for (const standalone of [true, false]) {
    for (const dark of [false, true]) {
      for (const homeView of ['trajectory', 'classic']) {
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
      await page.addInitScript(({ standalone, dark, homeView, homeState }) => {
        Object.defineProperty(navigator, 'standalone', { value: standalone })
        localStorage.setItem('afd-shell-mode', JSON.stringify('auto'))
        localStorage.setItem('afd-tab', JSON.stringify('finance'))
        localStorage.setItem('afd-theme-dark', JSON.stringify(dark))
        localStorage.setItem('afd-home-v1', JSON.stringify({ ...homeState, view: homeView }))
      }, { standalone, dark, homeView, homeState: DEFAULT_HOME_STATE })
      if (standalone && engine === 'chromium') {
        const cdp = await context.newCDPSession(page)
        await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 47, bottom: 34, left: 24, right: 24 } })
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
          const bottom = dock && parseFloat(getComputedStyle(dock).bottom)
          const viewportBottom = (visualViewport?.height ?? innerHeight) + (visualViewport?.offsetTop ?? 0)
          return shell && dock && Math.abs(shell.getBoundingClientRect().bottom - viewportBottom) < 1 &&
            Math.abs(dock.getBoundingClientRect().bottom + bottom - viewportBottom) < 1
        }, undefined, { timeout: 5000 })
        const metrics = await page.evaluate(() => {
          const dock = document.querySelector('.mobile-dock-rail')
          const style = getComputedStyle(dock)
          const buttons = [...dock.querySelectorAll('button')]
          const bounds = dock.getBoundingClientRect()
          const scroll = document.querySelector('.screen-scroll[aria-hidden="false"]')
          scroll.scrollTop = scroll.scrollHeight
          const active = dock.querySelector('[aria-current="page"]')
          return {
            padding: parseFloat(style.paddingBottom),
            bottom: parseFloat(style.bottom),
            gap: (visualViewport?.height ?? innerHeight) + (visualViewport?.offsetTop ?? 0) - bounds.bottom,
            height: bounds.height,
            radius: parseFloat(style.borderRadius),
            left: bounds.left,
            right: bounds.right,
            targetSizes: buttons.map(button => {
              const rect = button.getBoundingClientRect()
              return { width: rect.width, height: rect.height }
            }),
            activeCount: dock.querySelectorAll('[aria-current="page"]').length,
            activeBackground: getComputedStyle(active).backgroundColor,
            contentBottom: scroll.querySelector('.boot').getBoundingClientRect().bottom,
            dockTop: bounds.top,
            viewport: visualViewport?.height ?? innerHeight,
            overflow: document.documentElement.scrollWidth > window.innerWidth,
            shellWidth: document.querySelector('.mobile-app').getBoundingClientRect().width,
            clipped: [...scroll.querySelectorAll('.panel, .trajectory-mini-goal, .food-entry-panel, .food-hero, .food-presets, .food-logbook, .workout-exercise-row')]
              .filter(element => element.scrollWidth > element.clientWidth + 1)
              .map(element => ({ className: element.className, width: element.clientWidth, scroll: element.scrollWidth })),
            headerOverflow: [...document.querySelectorAll('.app-header, .island-idle')]
              .some(element => element.scrollWidth > element.clientWidth + 1),
          }
        })
        assert.ok(Math.abs(metrics.gap - metrics.bottom) < 1, JSON.stringify(metrics))
        assert.equal(metrics.height, 70)
        assert.equal(metrics.padding, 5)
        assert.ok(metrics.radius >= metrics.height / 2)
        assert.ok(metrics.left >= 16 && metrics.right <= await page.evaluate(() => innerWidth - 16))
        assert.ok(metrics.targetSizes.every(size => size.width >= 44 && size.height >= 44), JSON.stringify(metrics))
        assert.equal(metrics.activeCount, 1)
        assert.notEqual(metrics.activeBackground, 'rgba(0, 0, 0, 0)')
        assert.ok(metrics.contentBottom <= metrics.dockTop - 15, JSON.stringify(metrics))
        assert.equal(metrics.overflow, false)
        assert.deepEqual(metrics.clipped, [], JSON.stringify(metrics))
        assert.equal(metrics.headerOverflow, false, JSON.stringify(metrics))
        assert.equal(metrics.shellWidth, Math.min(1120, await page.evaluate(() => innerWidth)))
        assert.ok(metrics.viewport > 0)
        assert.equal(metrics.bottom, standalone && engine === 'chromium' ? 34 : 12)
      }
      for (const viewport of viewports) {
        await page.setViewportSize(viewport)
        for (const name of ['Finance', 'Cash', 'Food', 'Fitness', homeView === 'trajectory' ? 'Home' : 'Today']) {
          await dock.getByRole('button', { name, exact: true }).click()
          await checkDock()
          const layout = page.locator('.screen-scroll[aria-hidden="false"] .module-layout, .screen-scroll[aria-hidden="false"] .trajectory-home, .screen-scroll[aria-hidden="false"] .today-restored')
          const layoutMetrics = await layout.evaluate(element => ({
            columns: getComputedStyle(element).gridTemplateColumns.split(' ').length,
            available: element.closest('.screen-scroll').clientWidth - parseFloat(getComputedStyle(element.closest('.screen-scroll')).paddingLeft) - parseFloat(getComputedStyle(element.closest('.screen-scroll')).paddingRight),
          }))
          assert.equal(layoutMetrics.columns, layoutMetrics.available >= 680 ? 2 : 1, `${name} ${JSON.stringify(viewport)}: ${JSON.stringify(layoutMetrics)}`)
        }
      }
      await page.setViewportSize({ width: 390, height: 844 })
      await page.evaluate(() => window.dispatchEvent(new Event('pageshow')))
      await checkDock()
      // A geometry change without text entry must never hide navigation.
      await page.evaluate(() => {
        Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: window.innerHeight * 0.55 })
        Object.defineProperty(window.visualViewport, 'offsetTop', { configurable: true, value: 32 })
        window.visualViewport.dispatchEvent(new Event('resize'))
        window.visualViewport.dispatchEvent(new Event('scroll'))
      })
      await checkDock()
      await page.evaluate(() => {
        delete window.visualViewport.height
        delete window.visualViewport.offsetTop
        window.visualViewport.dispatchEvent(new Event('resize'))
      })
      await checkDock()

      await dock.getByRole('button', { name: 'Fitness', exact: true }).click()
      const selectedDate = await page.locator('.screen-scroll[aria-hidden="false"] .day-chip[aria-pressed="true"]').getAttribute('data-date')
      const exercise = page.locator('.fitness-console .workout-exercise-row').first()
      const completed = exercise.locator('.workout-exercise-toggle')
      const wasComplete = await completed.getAttribute('aria-pressed')
      await completed.click()
      await exercise.getByRole('button', { name: /^(Add weight|Edit weight,)/ }).click()
      const weight = exercise.getByRole('spinbutton', { name: 'Weight in kilograms' })
      await weight.fill('77.5')
      for (const viewport of [viewports[1], viewports[0], viewports[1], viewports[0]]) {
        await page.setViewportSize(viewport)
        assert.equal(await weight.inputValue(), '77.5')
        assert.equal(await weight.evaluate(element => element === document.activeElement), true)
        assert.notEqual(await completed.getAttribute('aria-pressed'), wasComplete)
        assert.equal(await page.locator('.screen-scroll[aria-hidden="false"] .day-chip[aria-pressed="true"]').getAttribute('data-date'), selectedDate)
        assert.equal(await dock.locator('[aria-current="page"]').getAttribute('aria-label'), 'Fitness')
        await checkDock()
      }
      await page.evaluate(() => {
        Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: window.innerHeight * 0.55 })
        window.visualViewport.dispatchEvent(new Event('resize'))
      })
      await dock.waitFor({ state: 'hidden' })
      assert.equal(await page.locator('.screen-scroll[aria-hidden="false"]').evaluate(element => getComputedStyle(element).paddingBottom), '16px')
      await page.evaluate(() => {
        delete window.visualViewport.height
        window.visualViewport.dispatchEvent(new Event('resize'))
      })
      await dock.waitFor()
      await checkDock()
      assert.equal(await weight.inputValue(), '77.5')
      // Blur must recover navigation even if WebKit has not restored its height yet.
      await page.evaluate(() => {
        Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: window.innerHeight * 0.55 })
        window.visualViewport.dispatchEvent(new Event('resize'))
      })
      await dock.waitFor({ state: 'hidden' })
      await weight.evaluate(element => element.blur())
      await dock.waitFor()
      await checkDock()
      await page.evaluate(() => {
        delete window.visualViewport.height
        window.dispatchEvent(new Event('pageshow'))
        document.dispatchEvent(new Event('visibilitychange'))
      })
      await checkDock()
      await exercise.getByRole('button', { name: 'Edit weight, 77.5 kilograms' }).waitFor()
      await dock.getByRole('button', { name: 'Food', exact: true }).click()
      const meal = page.getByRole('textbox', { name: 'Describe what you ate' })
      await meal.fill('Unsaved meal draft')
      for (const viewport of [viewports[1], viewports[0]]) {
        await page.setViewportSize(viewport)
        assert.equal(await meal.inputValue(), 'Unsaved meal draft')
        assert.equal(await meal.evaluate(element => element === document.activeElement), true)
      }
      await dock.getByRole('button', { name: 'Fitness', exact: true }).click()
      await exercise.getByRole('button', { name: 'Edit weight, 77.5 kilograms' }).waitFor()
      await page.evaluate(async () => {
        const { applyCloudState } = await import('/src/cloudSync.js')
        applyCloudState('afd-shell-mode', 'mobile')
      })
      await page.setViewportSize({ width: 1100, height: 820 })
      await checkDock()
      await page.evaluate(async () => {
        const { applyCloudState } = await import('/src/cloudSync.js')
        applyCloudState('afd-shell-mode', 'desktop')
      })
      await page.locator('.dsk').waitFor()
      assert.equal(await page.locator('[data-standalone]').count(), 0)
      assert.equal(await page.locator('[style*="--app-viewport-height"]').count(), 0)
      console.log(`PASS ${engine} ${standalone ? 'installed' : 'browser'} ${dark ? 'dark' : 'light'} ${homeView}: all tabs, adaptive columns, safe areas, folding, state, resume, keyboard, desktop switch`)
      await context.close()
      }
    }
  }
  const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })
  await desktopContext.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.origin !== origin) return route.abort()
    if (url.pathname === '/src/cloud.jsx') return route.fulfill({ contentType: 'application/javascript', body: 'export function CloudProvider({children}) { return children } export function CloudStatus() { return null }' })
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { connected: false } })
    if (url.pathname.startsWith('/yq/')) return route.fulfill({ status: 503, body: 'Offline fixture' })
    if (url.pathname === '/food-sync.json') return route.fulfill({ json: { logs: {} } })
    return route.continue()
  })
  const desktopPage = await desktopContext.newPage()
  desktopPage.on('pageerror', error => errors.push(error.message))
  await desktopPage.goto(origin)
  await desktopPage.locator('.dsk').waitFor()
  await desktopPage.setViewportSize({ width: 840, height: 760 })
  await desktopPage.getByRole('navigation', { name: 'Modules' }).waitFor()
  await desktopContext.close()
  console.log('PASS mouse-first Auto: desktop at wide width, touch layout below breakpoint')
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
