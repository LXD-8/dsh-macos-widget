/**
 * DSH macOS widgets — Host half.
 *
 * A generic provider: other Host plugins register a widget descriptor with
 * `ctx.macosWidgets.register()`, and this plugin serves every registered
 * widget on a fixed loopback bridge that the WidgetKit companion reads.
 *
 * The widget extension runs in the system widget host, outside the DSH page,
 * so it cannot use `dsh-app://` or the host session cookie. The bridge is the
 * stable surface: loopback only, GET only, no credentials.
 *
 * Plugin-owned routes (on the DSH host web server):
 *   GET /macos-widget/api/status
 *
 * Loopback bridge (read by the native extension):
 *   GET /widgets            registered widget directory + current selection
 *   GET /widget             the selected widget payload
 *   GET /widgets/<id>       one widget payload
 *
 * Selection route (plugin-owned, on the DSH host web server):
 *   POST /macos-widget/api/select  { "id": "<registered widget>" }
 */
import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export const name = 'dsh-macos-widget'
export const inject = ['webServer']

/** Loader schema; the vendored schemastery exists only in a source checkout. */
let Config
try {
  const { default: z } = await import('@deepseek-ai/schemastery')
  Config = z.object({
    port: z.number().min(0).max(65535).default(47823),
    cacheSeconds: z.number().min(0).default(30),
  })
} catch {
  // No source checkout: the plugin still runs with runtime coercion.
}
export { Config }

/** Loopback port the WidgetKit companion is built against. */
export const DEFAULT_PORT = 47823
/** Seconds a widget payload stays warm. */
export const DEFAULT_CACHE_SECONDS = 30
/** Plugin-owned status route consumed by the settings section. */
export const STATUS_PATH = '/macos-widget/api/status'
export const SELECT_PATH = '/macos-widget/api/select'
const LOOPBACK = '127.0.0.1'

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

/**
 * Reject requests whose Host is neither loopback nor the DSH web origin.
 * @param req - Incoming request.
 * @param originHost - Host of the DSH web server, or undefined in tests.
 * @returns whether the request may proceed.
 */
function trustedHost(req, originHost) {
  if (originHost === undefined) return true
  const host = req.headers?.host
  if (typeof host !== 'string' || host === '') return false
  const name = host.startsWith('[') ? host.slice(1, host.indexOf(']')) : host.split(':')[0]
  if (name === '127.0.0.1' || name === 'localhost' || name === '::1') return true
  return host === originHost
}

/**
 * Status route: GET returns the bridge state.
 * @param bridge - Widget bridge whose state is reported.
 * @returns the request handler.
 */
export function createStatusHandler(bridge, options = {}) {
  return async (req, res) => {
    if (!trustedHost(req, options.originHost)) {
      res.writeHead(403)
      res.end()
      return
    }
    if (req.method !== 'GET') {
      res.writeHead(405, { allow: 'GET' })
      res.end()
      return
    }
    sendJson(res, 200, bridge.status())
  }
}

/**
 * Selection route: POST `{ "id": "<registered widget>" }` switches the shown widget.
 * @param bridge - Widget bridge whose selection is changed.
 * @returns the request handler.
 */
export function createSelectHandler(bridge, options = {}) {
  return async (req, res) => {
    if (!trustedHost(req, options.originHost)) {
      res.writeHead(403)
      res.end()
      return
    }
    if (req.method !== 'POST') {
      res.writeHead(405, { allow: 'POST' })
      res.end()
      return
    }
    let body = ''
    try {
      for await (const chunk of req) {
        body += chunk
        if (body.length > 8 * 1024) throw new Error('select body is too large')
      }
      const parsed = JSON.parse(body)
      if (typeof parsed?.id !== 'string' || parsed.id === '') throw new Error('select needs a widget id')
      bridge.select(parsed.id)
      sendJson(res, 200, bridge.status())
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
    }
  }
}

/**
 * Create the widget registry other Host plugins contribute to.
 * @returns register, list, and lookup controls.
 */
export function createWidgetRegistry() {
  const widgets = new Map()
  return {
    /**
     * Register one widget descriptor.
     * @param descriptor - `{ id, title?, subtitle?, read }`; `read()` returns the generic payload.
     * @returns the disposer that unregisters the descriptor.
     */
    register(descriptor) {
      if (typeof descriptor?.id !== 'string' || descriptor.id === '') throw new Error('macos-widget: widget id must be text')
      if (typeof descriptor.read !== 'function') throw new Error(`macos-widget: widget "${descriptor.id}" needs read()`)
      widgets.set(descriptor.id, descriptor)
      return () => {
        if (widgets.get(descriptor.id) === descriptor) widgets.delete(descriptor.id)
      }
    },
    /** Directory rows for the widget picker. */
    list: () => [...widgets.values()].map(widget => ({ id: widget.id, title: widget.title ?? widget.id, subtitle: widget.subtitle ?? null })),
    /** One descriptor, when registered. */
    get: id => widgets.get(id),
  }
}

/**
 * Create the loopback bridge over a widget registry.
 * @param options - Registry, port, cache window, and logger.
 * @returns the bridge controls.
 */
export function createWidgetBridge({ registry, port = DEFAULT_PORT, cacheSeconds = DEFAULT_CACHE_SECONDS, logger = console }) {
  let boundPort = port
  const cache = new Map()
  let preferredId = null
  let lastFetchAt = null
  let lastError = null

  const endpoint = () => `http://${LOOPBACK}:${boundPort}`

  /** Selected id, falling back to the first registered widget. */
  const currentSelection = () => {
    if (preferredId !== null && registry.get(preferredId) !== undefined) return preferredId
    const first = registry.list()[0]
    return first === undefined ? null : first.id
  }

  const readPayload = async (id, force = false) => {
    const widget = registry.get(id)
    if (widget === undefined) {
      const error = new Error(`unknown widget "${id}"`)
      error.code = 'NOT_FOUND'
      throw error
    }
    const hit = cache.get(id)
    if (!force && hit !== undefined && Date.now() - hit.at < cacheSeconds * 1000) return hit.body
    const payload = await widget.read()
    const body = JSON.stringify(payload)
    cache.set(id, { at: Date.now(), body })
    lastFetchAt = new Date().toISOString()
    lastError = null
    return body
  }

  const server = createServer(async (req, res) => {
    if (req.method !== 'GET') {
      res.writeHead(405, { allow: 'GET' })
      res.end()
      return
    }
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (url.pathname === '/widgets') {
      sendJson(res, 200, { selectedId: currentSelection(), widgets: registry.list() })
      return
    }
    if (url.pathname === '/widget') {
      const id = currentSelection()
      if (id === null) {
        sendJson(res, 404, { error: 'no widget registered' })
        return
      }
      try {
        const body = await readPayload(id, url.searchParams.get('refresh') === '1')
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        res.end(body)
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
        sendJson(res, 502, { error: lastError })
      }
      return
    }
    const match = /^\/widgets\/([^/]+)$/u.exec(url.pathname)
    if (match === null) {
      res.writeHead(404)
      res.end()
      return
    }
    const id = decodeURIComponent(match[1])
    try {
      const body = await readPayload(id, url.searchParams.get('refresh') === '1')
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(body)
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
      if (error?.code === 'NOT_FOUND') {
        sendJson(res, 404, { error: lastError })
        return
      }
      logger.warn?.(`macos-widget: widget "${id}" failed: ${lastError}`)
      sendJson(res, 502, { error: lastError })
    }
  })
  server.on('error', (error) => {
    lastError = error instanceof Error ? error.message : String(error)
  })

  return {
    /** Current bridge state for the settings page. */
    status: () => ({
      listening: server.listening,
      port: boundPort,
      endpoint: endpoint(),
      widgets: registry.list(),
      selectedId: currentSelection(),
      lastFetchAt,
      lastError,
    }),
    /** Select which registered widget the native surface shows. */
    select: (id) => {
      if (registry.get(id) === undefined) throw new Error(`unknown widget "${id}"`)
      preferredId = id
    },
    /** Restore a persisted selection before its widget registers. */
    restore: (id) => {
      preferredId = id
    },
    /** Read one widget payload through the warm cache. */
    readPayload,
    /** Bind the loopback port; resolves once listening. */
    listen: () => new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(port, LOOPBACK, () => {
        const address = server.address()
        if (address !== null && typeof address === 'object') boundPort = address.port
        resolve()
      })
    }),
    /** Release the loopback port. */
    close: () => new Promise((resolve) => {
      if (!server.listening) {
        resolve()
        return
      }
      server.close(() => resolve())
    }),
  }
}

/**
 * Provide the registry and start the bridge.
 * @param ctx - Host plugin context.
 * @param config - Optional port and cache window.
 */
/** Where the selection survives a Host restart. */
function selectionFile() {
  return join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'macos-widget', 'selection.json')
}

/** Read the persisted widget id, when present. */
async function readPersistedSelection() {
  try {
    const parsed = JSON.parse(await readFile(selectionFile(), 'utf8'))
    return typeof parsed?.id === 'string' ? parsed.id : null
  } catch {
    return null
  }
}

/** Persist the selected widget id; a failure only loses the preference. */
async function persistSelection(id) {
  try {
    await mkdir(dirname(selectionFile()), { recursive: true })
    await writeFile(selectionFile(), JSON.stringify({ id }))
  } catch (error) {
    console.warn(`macos-widget: could not persist selection: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export function apply(ctx, config) {
  const registry = createWidgetRegistry()
  const bridge = createWidgetBridge({
    registry,
    port: config?.port ?? DEFAULT_PORT,
    cacheSeconds: config?.cacheSeconds ?? DEFAULT_CACHE_SECONDS,
  })
  ctx.effect(() => ctx.provide('macosWidgets', {
    register: registry.register,
    list: registry.list,
  }), 'macos-widget: registry service')
  ctx.effect(() => {
    bridge.listen().catch((error) => {
      console.warn(`macos-widget: loopback server unavailable: ${error instanceof Error ? error.message : String(error)}`)
    })
    return () => { void bridge.close() }
  }, 'macos-widget: loopback server')
  const originHost = new URL(ctx.webServer.getOrigin()).host
  const selection = {
    status: bridge.status,
    select: (id) => {
      bridge.select(id)
      void persistSelection(id)
    },
  }
  void readPersistedSelection().then((id) => {
    if (id !== null) bridge.restore(id)
  })
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: STATUS_PATH,
    handler: createStatusHandler(bridge, { originHost }),
  }), 'macos-widget: status route')
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: SELECT_PATH,
    handler: createSelectHandler(selection, { originHost }),
  }), 'macos-widget: select route')
}
