import assert from 'node:assert/strict'
import { afterEach, beforeEach, mock, test } from 'node:test'
import { clearCloudSyncSink, confirmCloudStateSynced, hasUnsyncedCloudState, queueCloudState, setCloudSyncSink } from './cloudSync.js'
import { FINANCE } from './data.js'

beforeEach(() => {
  const storage = new Map()
  globalThis.localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  }
  mock.timers.enable({ apis: ['setTimeout'] })
})

afterEach(() => {
  clearCloudSyncSink()
  mock.timers.reset()
  delete globalThis.localStorage
})

const advance = async milliseconds => {
  mock.timers.tick(milliseconds)
  await Promise.resolve()
  await Promise.resolve()
}

test('Trade holdings round-trip in the existing finance cloud payload', async () => {
  const finance = structuredClone(FINANCE)
  finance.sarwaTrade.holdings[0].units = 12.345
  const batches = []
  setCloudSyncSink(async batch => { batches.push(JSON.parse(JSON.stringify(batch))); return true })
  queueCloudState('afd-finance', finance)
  await advance(350)
  assert.equal(batches[0][0].key, 'afd-finance')
  assert.deepEqual(batches[0][0].value, finance)
})

test('multiple property entries round-trip in the existing finance cloud payload', async () => {
  const finance = structuredClone(FINANCE)
  finance.properties = [
    { id: 'x', name: 'Property X', location: 'Beirut', purchaseValue: 200000, currentValue: 250000.50 },
    { id: 'y', name: 'Property Y', location: '', purchaseValue: null, currentValue: 0 },
  ]
  const batches = []
  setCloudSyncSink(async batch => { batches.push(JSON.parse(JSON.stringify(batch))); return true })
  queueCloudState('afd-finance', finance)
  await advance(350)
  assert.deepEqual(batches[0][0].value.properties, finance.properties)
})

test('failed writes retry without requiring another edit', async () => {
  const batches = []
  setCloudSyncSink(async batch => { batches.push(batch); return batches.length > 1 })
  queueCloudState('afd-food-log', { version: 1 })
  await advance(350)
  await advance(5000)
  assert.equal(batches.length, 2)
  assert.deepEqual(batches[0], batches[1])
})

test('a newer edit replaces the failed value on retry', async () => {
  const batches = []
  setCloudSyncSink(async batch => { batches.push(batch); return batches.length > 1 })
  queueCloudState('afd-food-log', { version: 1 })
  await advance(350)
  queueCloudState('afd-food-log', { version: 2 })
  await advance(350)
  assert.equal(batches[1][0].value.version, 2)
})

test('thrown network errors retry and unrelated success cannot clear dirty state', async () => {
  let attempts = 0
  setCloudSyncSink(async () => { attempts++; throw new Error('offline') })
  localStorage.setItem('afd-food-log', JSON.stringify({ version: 1 }))
  queueCloudState('afd-food-log', { version: 1 })
  await advance(350)
  await advance(5000)
  assert.equal(attempts, 2)
  confirmCloudStateSynced('afd-theme-dark', true)
  assert.equal(hasUnsyncedCloudState(), true)
  confirmCloudStateSynced('afd-food-log', { version: 1 })
  assert.equal(hasUnsyncedCloudState(), false)
})

test('only one upload runs at a time', async () => {
  const batches = []
  let finish
  setCloudSyncSink(batch => {
    batches.push(batch)
    return new Promise(resolve => { finish = resolve })
  })
  queueCloudState('afd-food-log', { version: 1 })
  await advance(350)
  queueCloudState('afd-food-log', { version: 2 })
  await advance(350)
  assert.equal(batches.length, 1)
  finish(true)
  await advance(0)
  await advance(350)
  assert.equal(batches.length, 2)
  assert.equal(batches[1][0].value.version, 2)
  finish(true)
  await advance(0)
})

test('an old account failure is not replayed to a new sink', async () => {
  let finish
  setCloudSyncSink(() => new Promise(resolve => { finish = resolve }))
  queueCloudState('afd-food-log', { owner: 'old' })
  await advance(350)
  clearCloudSyncSink()
  const batches = []
  setCloudSyncSink(async batch => { batches.push(batch); return true })
  queueCloudState('afd-food-log', { owner: 'new' })
  finish(false)
  await advance(0)
  await advance(350)
  assert.equal(batches.length, 1)
  assert.equal(batches[0][0].value.owner, 'new')
})