import test from 'node:test'
import assert from 'node:assert/strict'
import { QUOTE_SYMBOLS, QUOTE_REFRESH_MS, freshQuoteCache, mergeQuoteResults } from './quoteCache.js'

const syncedAt = '2026-11-10T12:00:00Z'
const now = new Date(syncedAt).getTime()
const results = () => QUOTE_SYMBOLS.map(() => ({ status: 'fulfilled', value: { price: 100, currency: 'USD', changePct: 2 } }))

test('complete caches stay fresh for one hour, missing new symbols force refresh', () => {
  const cache = mergeQuoteResults(null, results(), syncedAt)
  assert.equal(freshQuoteCache(cache, now), true)
  assert.equal(freshQuoteCache(cache, now + QUOTE_REFRESH_MS - 1), true)
  assert.equal(freshQuoteCache(cache, now + QUOTE_REFRESH_MS), false)
  assert.equal(freshQuoteCache(cache, now - 1), false)
  for (const symbol of ['GOOGL', 'NVDA', 'SPTE']) {
    const old = structuredClone(cache)
    delete old.data[symbol]
    assert.equal(freshQuoteCache(old, now), false)
  }
})

test('one failed symbol preserves its cache but never blocks other successful quotes or claims freshness', () => {
  const previous = mergeQuoteResults(null, results(), '2026-11-09T12:00:00Z')
  const partial = results()
  partial[QUOTE_SYMBOLS.indexOf('SPTE')] = { status: 'rejected', reason: new Error('HTTP 503') }
  const next = mergeQuoteResults(previous, partial, syncedAt)
  assert.equal(next.data.MSFT.fetchedAt, syncedAt)
  assert.equal(next.data.GOOGL.fetchedAt, syncedAt)
  assert.equal(next.data.SPTE.fetchedAt, previous.syncedAt)
  assert.deepEqual(next.errors, ['SPTE: HTTP 503'])
  assert.equal(freshQuoteCache(next, now), false)
  const uncached = mergeQuoteResults(null, partial, syncedAt)
  assert.equal(uncached.data.SPTE, undefined)
  assert.equal(uncached.data.MSFT.price, 100)
})

test('invalid quote payloads do not replace known prices', () => {
  const previous = mergeQuoteResults(null, results(), syncedAt)
  for (const bad of [{ price: NaN, currency: 'USD' }, { price: -1, currency: 'USD' }, { price: 10, currency: 'EUR' }, null]) {
    const invalid = results()
    invalid[0].value = bad
    const next = mergeQuoteResults(previous, invalid, syncedAt)
    assert.equal(next.data.MSFT, previous.data.MSFT)
    assert.match(next.errors[0], /MSFT: Invalid USD quote/)
  }
})
