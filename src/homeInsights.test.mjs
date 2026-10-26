import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_HOME_STATE, HOME_STATE_KEY, parseHomeGoals, validHomeState } from './homeGoals.js'
import { bodyFatGoal, weeklyTrainingGoal, proteinGoal, cashBufferGoal, portfolioSignal, liquidCapital, homeNextAction } from './homeInsights.js'
import { CLOUD_STATE_KEYS } from './cloudSync.js'
import { fuelingFlag } from './whoopEnergy.js'
import { isDateKey } from './dates.js'

const now = new Date(2026, 9, 25, 17)
const finance = {
  msft: { shares: 100, price: 500, priceDate: 'Jun 9, 2026' },
  sarwa: { lastUpdated: 'Aug 22, 2026', holdings: [
    { ticker: 'ISDW', name: 'Global ETF', units: 100, value: 42000 },
    { ticker: 'USD', name: 'Cash', value: 90000 },
  ] },
  property: { value: 500000 },
}

test('day validation rejects rollover dates and stays reusable across mounted date selectors', () => {
  assert.equal(isDateKey('2028-02-29'), true)
  for (const invalid of [null, '2026-02-29', '2026-02-31', '2026-2-03', 'not-a-date']) assert.equal(isDateKey(invalid), false)
})

test('Home preferences validate and goal edits never treat missing targets as zero', () => {
  assert.ok(validHomeState(DEFAULT_HOME_STATE))
  assert.equal(validHomeState({ ...DEFAULT_HOME_STATE, mainGoal: 'unknown' }), false)
  assert.equal(validHomeState({ ...DEFAULT_HOME_STATE, goals: {} }), false)
  const values = { fatPct: '13.5', weeklyWorkouts: '4', protein: '180', cashBuffer: '' }
  assert.equal(parseHomeGoals(values).goals.cashBuffer, null)
  for (const [key, value] of [['fatPct', ''], ['fatPct', '41'], ['weeklyWorkouts', '1.5'], ['protein', '0'], ['cashBuffer', '-1']]) {
    assert.ok(parseHomeGoals({ ...values, [key]: value }).error)
  }
  assert.deepEqual(parseHomeGoals({ ...values, cashBuffer: '10000' }).goals, { fatPct: 13.5, weeklyWorkouts: 4, protein: 180, cashBuffer: 10000 })
  assert.ok(CLOUD_STATE_KEYS.includes(HOME_STATE_KEY))
})

test('body-fat orbit measures the gap closed from the first valid check-in, not current body-fat percentage', () => {
  const readings = [
    { date: '2026-10-24', fatPct: 16.3 },
    { date: '2026-01-01', fatPct: 22 },
    { date: '2026-11-01', fatPct: 12 },
    { date: '2026-10-25', fatPct: null },
    { date: '2026-02-31', fatPct: 10 },
  ]
  const goal = bodyFatGoal(readings, 13.5, now)
  assert.equal(goal.current, 16.3)
  assert.equal(goal.remaining, 2.8)
  assert.equal(goal.change, 5.7)
  assert.equal(goal.ageDays, 1)
  assert.ok(Math.abs(goal.progress - 5.7 / 8.5) < 1e-10)
  assert.equal(bodyFatGoal(readings, 20, now).progress, 1)
  assert.equal(bodyFatGoal([], 13.5, now).progress, null)
  assert.equal(bodyFatGoal([{ date: '2026-01-01', fatPct: 16 }], 13.5, now).progress, 0)
})

test('body-fat regression does not produce negative progress or claim a loss', () => {
  const goal = bodyFatGoal([{ date: '2026-01-01', fatPct: 16 }, { date: '2026-10-25', fatPct: 18 }], 13.5, now)
  assert.equal(goal.progress, 0)
  assert.equal(goal.change, -2)
  assert.equal(goal.remaining, 4.5)
})

test('weekly training counts logged local days across gyms and ignores future/duplicate sessions', () => {
  const sessions = [
    { date: '2026-10-18' }, { date: '2026-10-19' },
    { date: '2026-10-21', programId: 'beirut' }, { date: '2026-10-21' },
    { date: '2026-10-25' }, { date: '2026-10-26' },
  ]
  const goal = weeklyTrainingGoal(sessions, 4, now)
  assert.equal(goal.current, 3)
  assert.equal(goal.weekStart, '2026-10-19')
  assert.equal(goal.remaining, 1)
  assert.equal(goal.loggedToday, true)
  assert.equal(goal.progress, .75)
  assert.equal(weeklyTrainingGoal(sessions, 2, now).progress, 1)
  assert.equal(weeklyTrainingGoal(sessions, 4, new Date(2026, 9, 26)).current, 1)
})

test('food with no entries stays unknown, while zero logged protein and over-target values remain meaningful', () => {
  assert.equal(proteinGoal([], 180).available, false)
  assert.equal(proteinGoal([], 180).remaining, null)
  assert.equal(proteinGoal([{ protein: 0 }], 180).remaining, 180)
  assert.equal(proteinGoal([{ protein: 100 }, { protein: 36 }], 180).remaining, 44)
  assert.equal(proteinGoal([{ protein: 200 }], 180).progress, 1)
  assert.equal(proteinGoal([{ protein: 179.9 }], 180).remaining, 1)
  assert.equal(proteinGoal([{ protein: 179.9 }], 180).complete, false)
  assert.equal(proteinGoal([{ protein: -10 }], 180).invalid, true)
})

test('cash goal uses an explicitly dated manual snapshot, without assuming missing cash is zero or deducting plans', () => {
  const cash = { currentCash: 8200, cashAsOf: '2026-10-24T12:00:00Z', commitments: [], oneOffs: [] }
  const goal = cashBufferGoal(cash, 10000, now)
  assert.equal(goal.current, 8200)
  assert.equal(goal.remaining, 1800)
  assert.equal(goal.progress, .82)
  assert.equal(goal.stale, false)
  assert.equal(cashBufferGoal({ ...cash, cashAsOf: null }, 10000, now).current, null)
  assert.equal(cashBufferGoal({ ...cash, cashAsOf: 'invalid' }, 10000, now).available, false)
  assert.equal(cashBufferGoal({ ...cash, cashAsOf: '2026-12-01' }, 10000, now).available, false)
  assert.equal(cashBufferGoal({ ...cash, cashAsOf: '2026-10-01' }, 10000, now).stale, true)
  assert.equal(cashBufferGoal({ ...cash, currentCash: 0 }, 10000, now).current, 0)
  assert.equal(cashBufferGoal(cash, null, now).progress, null)
  assert.equal(cashBufferGoal(cash, 5000, now).progress, 1)
  assert.equal(cashBufferGoal({ ...cash, currentCash: 9999.99 }, 10000, now).complete, false)
  assert.ok(Math.abs(cashBufferGoal({ ...cash, currentCash: 9999.99 }, 10000, now).remaining - .01) < 1e-8)
})

test('portfolio signal uses actual market values and excludes cash and property from its denominator', () => {
  const result = portfolioSignal(finance, { MSFT: { price: 580, currency: 'USD' }, 'ISDW.L': { price: 420, currency: 'USD' } }, { status: 'live', syncedAt: '2026-10-25T12:00:00Z' })
  assert.equal(result.headline, 'MSFT is 58% of your invested portfolio.')
  assert.equal(result.total, 100000)
  assert.equal(result.share, .58)
  assert.equal(result.positions.length, 2)
  assert.equal(result.source, 'Synced prices')
})

test('recorded and mixed portfolio prices are labelled, and invalid quotes never masquerade as current prices', () => {
  assert.equal(portfolioSignal(finance, null).source, 'Recorded values')
  assert.equal(portfolioSignal(finance, { MSFT: { price: 580, currency: 'USD' } }).source, 'Mixed price dates')
  assert.equal(portfolioSignal(finance, { MSFT: { price: 580 } }).source, 'Recorded values')
  assert.equal(portfolioSignal(finance, { MSFT: { price: -1 } }).largest.value, 50000)
  assert.equal(portfolioSignal(finance, { MSFT: { price: 580, currency: 'EUR' } }).largest.value, 50000)
  const incomplete = portfolioSignal({ ...finance, msft: { shares: 100 } }, null)
  assert.equal(incomplete.available, false)
  assert.equal(incomplete.share, null)
  assert.equal(incomplete.missingCount, 1)
  const empty = portfolioSignal({ msft: { shares: 0 }, sarwa: { holdings: [] } }, null)
  assert.equal(empty.available, false)
  assert.equal(empty.total, 0)
})

test('liquid capital adds saved cash to securities, excluding property and separate brokerage cash', () => {
  const cash = cashBufferGoal({
    currentCash: 8200, cashAsOf: '2026-10-24T12:00:00Z',
    oneOffs: [{ id: 'bill', name: 'Bill', amount: 500, dueDate: '2026-10-26' }],
  }, null, now)
  const portfolio = portfolioSignal(finance, { MSFT: { price: 580, currency: 'USD' } })
  assert.equal(cash.configured, false)
  assert.deepEqual(liquidCapital(cash, portfolio), {
    available: true, total: 108200, cash: 8200, invested: 100000,
  })
})

test('liquid capital updates with cash, quantities, and eligible quotes', () => {
  const cash = cashBufferGoal({ currentCash: 9000, cashAsOf: '2026-10-25T12:00:00Z' }, null, now)
  const changedFinance = { ...finance, msft: { ...finance.msft, shares: 200 } }
  const portfolio = portfolioSignal(changedFinance, {
    MSFT: { price: 600, currency: 'USD' }, 'ISDW.L': { price: 400, currency: 'USD' },
  })
  assert.equal(liquidCapital(cash, portfolio).total, 169000)
})

test('missing, invalid, and future cash snapshots suppress the total, not the known invested value', () => {
  const portfolio = portfolioSignal(finance, null)
  for (const snapshot of [
    {}, { currentCash: 8200, cashAsOf: null }, { currentCash: 8200, cashAsOf: 'invalid' },
    { currentCash: 8200, cashAsOf: '2026-12-01' }, { currentCash: -1, cashAsOf: '2026-10-24' },
  ]) {
    assert.deepEqual(liquidCapital(cashBufferGoal(snapshot, null, now), portfolio), {
      available: false, total: null, cash: null, invested: 92000,
    })
  }
})

test('unpriced stocks or ETFs suppress the capital total rather than presenting partial investments', () => {
  const cash = cashBufferGoal({ currentCash: 8200, cashAsOf: '2026-10-24' }, null, now)
  for (const incomplete of [
    { ...finance, msft: { shares: 100 } },
    { ...finance, sarwa: { holdings: [{ ticker: 'ISDW', units: 100 }] } },
  ]) {
    assert.deepEqual(liquidCapital(cash, portfolioSignal(incomplete, null)), {
      available: false, total: null, cash: 8200, invested: null,
    })
  }
})

test('zero cash and an empty invested portfolio remain valid, including a genuine zero total', () => {
  const cash = cashBufferGoal({ currentCash: 0, cashAsOf: '2026-10-24' }, null, now)
  const empty = portfolioSignal({ msft: { shares: 0 }, sarwa: { holdings: [] } }, null)
  assert.deepEqual(liquidCapital(cash, empty), { available: true, total: 0, cash: 0, invested: 0 })
  assert.equal(liquidCapital(cash, portfolioSignal(finance, null)).total, 92000)
  assert.equal(liquidCapital(cashBufferGoal({ currentCash: 8200, cashAsOf: '2026-10-24' }, null, now), empty).total, 8200)
})

test('stale cash retains its saved value and freshness warning rather than masquerading as current cash', () => {
  const cash = cashBufferGoal({ currentCash: 8200.25, cashAsOf: '2026-10-01' }, null, now)
  assert.equal(cash.stale, true)
  assert.equal(cash.asOf, '2026-10-01')
  assert.equal(liquidCapital(cash, portfolioSignal(finance, null)).total, 100200.25)
})

test('next action follows the selected real goal and never logs data or assumes a second workout today', () => {
  const context = {
    mainGoal: 'body',
    body: bodyFatGoal([{ date: '2026-10-24', fatPct: 16.3 }], 13.5, now),
    training: weeklyTrainingGoal([], 4, now),
    protein: proteinGoal([], 180),
    cash: cashBufferGoal({}, null, now),
    nextWorkout: { name: 'Beirut Day B \u2014 Glutes & Back' },
  }
  assert.equal(homeNextAction(context).label, 'Open Beirut Day B')
  assert.equal(homeNextAction({ ...context, mainGoal: 'cash' }).kind, 'settings')
  assert.equal(homeNextAction({ ...context, body: bodyFatGoal([], 13.5, now) }).section, 'inbody')
  const logged = weeklyTrainingGoal([{ date: '2026-10-25' }], 4, now)
  assert.equal(homeNextAction({ ...context, training: logged }).destination, 'food')
  assert.equal(homeNextAction({ ...context, mainGoal: 'training', training: logged }).label, "View today's workout")
  assert.equal(homeNextAction({ ...context, mainGoal: 'training', training: { ...logged, complete: true } }).kind, 'why')
})

test('WHOOP protein coaching respects edited targets and preserves the legacy default', () => {
  const context = { whoop: { connected: true, kcal: 1800 }, eaten: 1000, protein: 80, now }
  assert.equal(fuelingFlag({ ...context, proteinTarget: 150 }), null)
  assert.equal(fuelingFlag(context)?.kind, 'protein')
  assert.equal(fuelingFlag({ ...context, proteinTarget: 220 })?.kind, 'protein')
})
