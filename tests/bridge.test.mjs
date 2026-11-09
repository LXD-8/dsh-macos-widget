import test from 'node:test'
import assert from 'node:assert/strict'
import { createWidgetBridge, createWidgetRegistry } from '../index.js'

/** Registry with one readable widget. */
function registryWith(read = async () => ({ title: 'A', sections: [] })) {
  const registry = createWidgetRegistry()
  registry.register({ id: 'a', title: 'Alpha', subtitle: 'first', read })
  return registry
}

test('bridge lists widgets and serves their payloads', async () => {
  const bridge = createWidgetBridge({ registry: registryWith(), port: 0, cacheSeconds: 60 })
  await bridge.listen()
  try {
    const base = bridge.status().endpoint
    assert.deepEqual(await (await fetch(`${base}/widgets`)).json(), {
      selectedId: 'a',
      widgets: [{ id: 'a', title: 'Alpha', subtitle: 'first' }],
    })
    assert.deepEqual(await (await fetch(`${base}/widgets/a`)).json(), { title: 'A', sections: [] })
    assert.deepEqual(await (await fetch(`${base}/widget`)).json(), { title: 'A', sections: [] })
  } finally {
    await bridge.close()
  }
})

test('bridge caches payloads until refresh is requested', async () => {
  let reads = 0
  const bridge = createWidgetBridge({ registry: registryWith(async () => ({ reads: ++reads })), port: 0, cacheSeconds: 60 })
  await bridge.listen()
  try {
    const url = `${bridge.status().endpoint}/widgets/a`
    assert.deepEqual(await (await fetch(url)).json(), { reads: 1 })
    assert.deepEqual(await (await fetch(url)).json(), { reads: 1 })
    assert.deepEqual(await (await fetch(`${url}?refresh=1`)).json(), { reads: 2 })
  } finally {
    await bridge.close()
  }
})

test('bridge reports unknown widgets and failing readers', async () => {
  const bridge = createWidgetBridge({ registry: registryWith(async () => { throw new Error('boom') }), port: 0, cacheSeconds: 60 })
  await bridge.listen()
  try {
    const base = bridge.status().endpoint
    assert.equal((await fetch(`${base}/widgets/missing`)).status, 404)
    assert.equal((await fetch(`${base}/widgets/a`)).status, 502)
    assert.match(bridge.status().lastError, /boom/)
  } finally {
    await bridge.close()
  }
})

test('bridge selection switches the served widget', async () => {
  const registry = createWidgetRegistry()
  registry.register({ id: 'a', title: 'Alpha', read: async () => ({ id: 'a' }) })
  registry.register({ id: 'b', title: 'Beta', read: async () => ({ id: 'b' }) })
  const bridge = createWidgetBridge({ registry, port: 0, cacheSeconds: 60 })
  await bridge.listen()
  try {
    const base = bridge.status().endpoint
    assert.deepEqual(await (await fetch(`${base}/widget`)).json(), { id: 'a' })
    bridge.select('b')
    assert.deepEqual(await (await fetch(`${base}/widget`)).json(), { id: 'b' })
    assert.equal(bridge.status().selectedId, 'b')
    assert.throws(() => bridge.select('missing'), /unknown widget/)
  } finally {
    await bridge.close()
  }
})

test('bridge rejects non-GET and unknown paths', async () => {
  const bridge = createWidgetBridge({ registry: registryWith(), port: 0, cacheSeconds: 60 })
  await bridge.listen()
  try {
    const base = bridge.status().endpoint
    assert.equal((await fetch(`${base}/widgets/a`, { method: 'POST' })).status, 405)
    assert.equal((await fetch(`${base}/nope`)).status, 404)
  } finally {
    await bridge.close()
  }
})

import { createSelectHandler, createStatusHandler } from '../index.js'

/** Minimal response double for route handlers. */
function responseDouble() {
  return {
    status: 0,
    headers: {},
    body: '',
    writeHead(status, headers) {
      this.status = status
      this.headers = headers ?? {}
    },
    end(body) {
      this.body = body ?? ''
    },
  }
}

/** Minimal request double yielding one body chunk. */
function requestDouble(method, body) {
  return {
    method,
    [Symbol.asyncIterator]: async function* () {
      if (body !== undefined) yield body
    },
  }
}

test('status handler serves GET and rejects other methods', async () => {
  const handler = createStatusHandler({ status: () => ({ listening: true }) })
  const ok = responseDouble()
  await handler(requestDouble('GET'), ok)
  assert.equal(ok.status, 200)
  assert.deepEqual(JSON.parse(ok.body), { listening: true })

  const rejected = responseDouble()
  await handler(requestDouble('POST'), rejected)
  assert.equal(rejected.status, 405)
  assert.equal(rejected.headers.allow, 'GET')
})

test('select handler validates method, body, and widget id', async () => {
  const selected = []
  const handler = createSelectHandler({
    select: (id) => {
      if (id !== 'a') throw new Error('unknown widget')
      selected.push(id)
    },
    status: () => ({ selectedId: selected.at(-1) ?? null }),
  })

  const ok = responseDouble()
  await handler(requestDouble('POST', JSON.stringify({ id: 'a' })), ok)
  assert.equal(ok.status, 200)
  assert.deepEqual(selected, ['a'])
  assert.deepEqual(JSON.parse(ok.body), { selectedId: 'a' })

  const rejectedMethod = responseDouble()
  await handler(requestDouble('GET'), rejectedMethod)
  assert.equal(rejectedMethod.status, 405)
  assert.equal(rejectedMethod.headers.allow, 'POST')

  const rejectedBody = responseDouble()
  await handler(requestDouble('POST', '{not json'), rejectedBody)
  assert.equal(rejectedBody.status, 400)

  const rejectedId = responseDouble()
  await handler(requestDouble('POST', JSON.stringify({ id: 'missing' })), rejectedId)
  assert.equal(rejectedId.status, 400)
  assert.match(JSON.parse(rejectedId.body).error, /unknown widget/)

  const oversized = responseDouble()
  await handler(requestDouble('POST', 'x'.repeat(9000)), oversized)
  assert.equal(oversized.status, 400)
})

test('restored selection wins once its widget registers', async () => {
  const registry = createWidgetRegistry()
  const bridge = createWidgetBridge({ registry, port: 0, cacheSeconds: 60 })
  bridge.restore('b')
  registry.register({ id: 'a', title: 'Alpha', read: async () => ({ id: 'a' }) })
  registry.register({ id: 'b', title: 'Beta', read: async () => ({ id: 'b' }) })
  await bridge.listen()
  try {
    assert.equal(bridge.status().selectedId, 'b')
    assert.deepEqual(await (await fetch(`${bridge.status().endpoint}/widget`)).json(), { id: 'b' })
  } finally {
    await bridge.close()
  }
})
