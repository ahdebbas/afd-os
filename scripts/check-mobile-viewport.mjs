import assert from 'node:assert/strict'
import { DEFAULT_HOME_STATE } from '../src/homeGoals.js'

const playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const engine = process.env.PLAYWRIGHT_BROWSER || 'chromium'
const origin = process.env.PULSE_URL || 'http://127.0.0.1:5173'
const browser = await playwright[engine].launch({ ...(engine === 'chromium' ? { channel: 'chrome' } : {}), headless: true })
const errors = []
const viewports = [
  { width: 466, height: 678 },
  { width: 956, height: 666 },
  { width: 666, height: 956 },
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
      const contrast = await page.evaluate(() => {
        const style = getComputedStyle(document.body)
        const luminance = token => {
          const value = style.getPropertyValue(token).trim().replace('#', '')
          const channels = [0, 2, 4].map(index => parseInt(value.slice(index, index + 2), 16) / 255)
            .map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4)
          return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722
        }
        return ['--ink', '--ink-2', '--ink-3', '--acc-fit'].flatMap(text => ['--bg', '--surface', '--chip', '--field'].map(background => {
          const values = [luminance(text), luminance(background)].sort((a, b) => b - a)
          return { text, background, ratio: (values[0] + .05) / (values[1] + .05) }
        }))
      })
      assert.ok(contrast.every(item => item.ratio >= 4.5), JSON.stringify(contrast))
      if (standalone) {
        // Model WebKit resolving fixed edges against a shorter containing block.
        await page.addStyleTag({ content: '#root { height: calc(100dvh - 54px); transform: translateZ(0); }' })
      }
      const checkDock = async () => {
        await page.waitForFunction(() => {
          const shell = document.querySelector('.mobile-app')
          const viewportBottom = (visualViewport?.height ?? innerHeight) + (visualViewport?.offsetTop ?? 0)
          return shell && Math.abs(shell.getBoundingClientRect().bottom - viewportBottom) < 1
        }, undefined, { timeout: 5000 }).catch(async error => {
          const geometry = await page.locator('.mobile-app').evaluate(element => ({
            bounds: element.getBoundingClientRect().toJSON(),
            height: getComputedStyle(element).height,
            declaredHeight: element.style.getPropertyValue('--app-viewport-height'),
            viewport: { height: visualViewport?.height, top: visualViewport?.offsetTop, width: innerWidth },
          }))
          throw new Error(`${error.message}: ${JSON.stringify(geometry)}`)
        })
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
            rail: innerWidth >= 800,
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
            dockRight: bounds.right,
            workspace: document.querySelector('.app-workspace').getBoundingClientRect().toJSON(),
            scrollBottom: scroll.getBoundingClientRect().bottom,
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
        if (metrics.rail) {
          assert.ok(metrics.left >= metrics.workspace.right - 1, JSON.stringify(metrics))
        } else {
          assert.ok(metrics.scrollBottom <= metrics.dockTop + 1, JSON.stringify(metrics))
          assert.ok(metrics.height >= 70, JSON.stringify(metrics))
        }
        assert.ok(metrics.targetSizes.every(size => size.width >= 44 && size.height >= 44), JSON.stringify(metrics))
        assert.equal(metrics.activeCount, 1)
        assert.notEqual(metrics.activeBackground, 'rgba(0, 0, 0, 0)')
        assert.ok(metrics.contentBottom <= metrics.scrollBottom - 15, JSON.stringify(metrics))
        assert.equal(metrics.overflow, false)
        assert.deepEqual(metrics.clipped, [], JSON.stringify(metrics))
        assert.equal(metrics.headerOverflow, false, JSON.stringify(metrics))
        assert.equal(metrics.shellWidth, await page.evaluate(() => innerWidth))
        assert.ok(metrics.viewport > 0)
      }
      for (const viewport of viewports) {
        await page.setViewportSize(viewport)
        for (const name of ['Finance', 'Cash', 'Food', 'Fitness', homeView === 'trajectory' ? 'Home' : 'Today']) {
          await dock.getByRole('button', { name, exact: true }).click()
          await checkDock()
          const layout = page.locator('.screen-scroll[aria-hidden="false"] :is(.finance-workspace, .cash-layout, .food-workspace, .fitness-workspace, .trajectory-home, .today-restored)')
          const layoutMetrics = await layout.evaluate(element => ({
            columns: getComputedStyle(element).display === 'grid' ? getComputedStyle(element).gridTemplateColumns.split(' ').length : 1,
            available: element.closest('.screen-scroll').clientWidth - parseFloat(getComputedStyle(element.closest('.screen-scroll')).paddingLeft) - parseFloat(getComputedStyle(element.closest('.screen-scroll')).paddingRight),
          }))
          const expanded = name === 'Home' ? viewport.width >= 800 : layoutMetrics.available >= 680
          assert.equal(layoutMetrics.columns, expanded ? 2 : 1, `${name} ${JSON.stringify(viewport)}: ${JSON.stringify(layoutMetrics)}`)
          if (name === 'Home' && homeView === 'trajectory') {
            const homeMetrics = await layout.evaluate(element => {
              const rect = selector => element.querySelector(selector).getBoundingClientRect()
              const focus = rect('.trajectory-focus')
              const action = rect('.trajectory-focus .trajectory-primary')
              const overview = rect('.trajectory-overview')
              const portfolio = rect('.trajectory-portfolio')
              const scroll = element.closest('.screen-scroll')
              const scrollBounds = scroll.getBoundingClientRect()
              const capital = element.querySelector('.trajectory-capital-total')
              const capitalStyle = getComputedStyle(capital)
              const componentAmounts = [...element.querySelectorAll('.trajectory-capital-metric .trajectory-mini-number')]
              return {
                actionInsideFocus: action.left >= focus.left && action.right <= focus.right,
                focusSeparateFromOverview: focus.right <= overview.left + 1,
                capitalFits: capital.scrollWidth <= capital.clientWidth + 1 && capitalStyle.whiteSpace === 'nowrap',
                componentAmountsFit: componentAmounts.every(amount => amount.scrollWidth <= amount.clientWidth + 1 && getComputedStyle(amount).whiteSpace === 'nowrap'),
                portfolioRightInset: scrollBounds.right - Math.max(focus.right, overview.right, portfolio.right),
                wide: innerWidth >= 800,
              }
            })
            assert.ok(homeMetrics.actionInsideFocus, JSON.stringify(homeMetrics))
            if (homeMetrics.wide) {
              assert.ok(homeMetrics.focusSeparateFromOverview, JSON.stringify(homeMetrics))
              assert.ok(homeMetrics.portfolioRightInset >= 22 && homeMetrics.portfolioRightInset <= 26, JSON.stringify(homeMetrics))
            }
            assert.ok(homeMetrics.capitalFits, JSON.stringify(homeMetrics))
            assert.ok(homeMetrics.componentAmountsFit, JSON.stringify(homeMetrics))
          }
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
      assert.equal(await page.locator('.screen-scroll[aria-hidden="false"]').evaluate(element => getComputedStyle(element).paddingBottom), '24px')
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
      await page.setViewportSize({ width: 956, height: 666 })
      await page.getByRole('button', { name: 'Settings', exact: true }).click()
      const settings = page.getByRole('dialog', { name: 'Settings', exact: true })
      await settings.waitFor()
      const dialogBounds = await settings.locator('.sheet-panel').boundingBox()
      assert.ok(dialogBounds.width <= 560 && dialogBounds.y >= 0 && dialogBounds.y + dialogBounds.height <= 666)
      await page.keyboard.press('Escape')
      await settings.waitFor({ state: 'hidden' })
      assert.equal(await page.getByRole('button', { name: 'Settings', exact: true }).evaluate(element => element === document.activeElement), true)
      await dock.getByRole('button', { name: 'Cash', exact: true }).click()
      await page.getByRole('button', { name: 'Add planned payment', exact: true }).click()
      const payment = page.getByRole('dialog', { name: 'Planned payment', exact: true })
      const name = payment.getByLabel('Name', { exact: true })
      await name.fill('Unsaved payment')
      await payment.getByLabel('Amount (USD)', { exact: true }).fill('123.45')
      for (const viewport of [{ width: 466, height: 678 }, { width: 956, height: 400 }]) {
        await page.setViewportSize(viewport)
        assert.equal(await name.inputValue(), 'Unsaved payment')
        assert.equal(await payment.getByLabel('Amount (USD)', { exact: true }).inputValue(), '123.45')
        const save = payment.getByRole('button', { name: 'Save payment', exact: true })
        await save.scrollIntoViewIfNeeded()
        const bounds = await save.boundingBox()
        assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= viewport.height, JSON.stringify(bounds))
      }
      await page.keyboard.press('Escape')
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
