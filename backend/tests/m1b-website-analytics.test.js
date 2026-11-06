import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const projectRoot = path.resolve(root, '..')
const read = (relative) => fs.readFileSync(path.resolve(root, relative), 'utf8')

function memoryStorage() {
  const data = new Map()
  return {
    getItem(key) { return data.get(key) || null },
    setItem(key, value) { data.set(key, String(value)) },
    removeItem(key) { data.delete(key) },
    size() { return data.size },
  }
}

function clientHarness() {
  const localStorage = memoryStorage()
  const sessionStorage = memoryStorage()
  const listeners = new Map()
  const calls = []
  let permitted = false
  const window = {
    innerWidth: 420,
    location: { pathname: '/recipes/jeera-rice', search: '?utm_source=demo&utm_campaign=launch_week', hostname: 'epantry.in' },
    localStorage, sessionStorage,
    setTimeout: () => 123, clearTimeout() {},
    addEventListener(name, fn) { listeners.set(name, fn) },
  }
  const document = { referrer: 'https://google.com/search?q=private', }
  const clientSource = fs.readFileSync(
    path.join(projectRoot, 'frontend/src/features/websiteAnalytics/websiteAnalytics.client.js'), 'utf8',
  )
  const executable = clientSource.slice(clientSource.indexOf('// M1-B:'))
    .replace(/^export /gm, '')
  const api = new Function('apiClient', 'COOKIE_CONSENT_UPDATED_EVENT', 'isWebsiteAnalyticsAllowed', 'window', 'document', 'crypto', 'fetch',
    `${executable}\nreturn { safeWebsitePage, recordWebsitePage, recordWebsiteAction, clearWebsiteAnalyticsIdentity }`,
  )({ defaults: { baseURL: '/api/v1' } },
    'consent:updated', () => permitted, window, document, crypto, (url, opts) => { calls.push([url, JSON.parse(opts.body), opts]); return Promise.resolve({ ok: true }) })
  return { api, calls, localStorage, sessionStorage, listeners, window, setConsent(value) { permitted = value } }
}

test('M1-B allows only approved public/Customer pages, never Host, Admin or account history', () => {
  const h = clientHarness()
  assert.equal(h.api.safeWebsitePage('/recipes/jeera-rice').pageKey, '/recipes/:slug')
  assert.equal(h.api.safeWebsitePage('/grocery/product/milk').entityType, 'product')
  assert.equal(h.api.safeWebsitePage('/recipes/what-should-we-cook'), null)
  for (const p of ['/host/dashboard', '/admin/analytics', '/account', '/orders/a123', '/recipes/jeera-rice/history']) {
    assert.equal(h.api.safeWebsitePage(p), null)
  }
})

test('M1-B never generates identifiers or transmits before analytics consent', async () => {
  const h = clientHarness()
  assert.equal(h.api.recordWebsitePage('/recipes/jeera-rice'), false)
  assert.equal(h.api.recordWebsiteAction('bookmark_add', { entityType: 'recipe', entityId: 'jeera-rice' }), false)
  assert.equal(h.calls.length, 0)
  assert.equal(h.localStorage.size(), 0)
  assert.equal(h.sessionStorage.size(), 0)
})

test('M1-B consented route emits session + page + recipe once; actions have no search/payment text', async () => {
  const h = clientHarness()
  h.setConsent(true)
  assert.equal(h.api.recordWebsitePage('/recipes/jeera-rice'), true)
  assert.equal(h.calls.length, 3)
  assert.deepEqual(h.calls.map((args) => args[1].eventName), ['session_start', 'page_view', 'recipe_view'])
  assert.equal(h.api.recordWebsitePage('/recipes/jeera-rice'), false)
  assert.equal(h.calls.length, 3)
  assert.equal(h.api.recordWebsiteAction('search_submit'), true)
  assert.equal(h.api.recordWebsiteAction('bookmark_add', { entityType: 'recipe', entityId: 'jeera-rice' }), true)
  assert.equal(h.api.recordWebsiteAction('purchase_complete'), false)
  assert.equal(h.calls.length, 5)
  for (const [url, payload, config] of h.calls) {
    assert.equal(url, '/api/v1/website-analytics/events')
    assert.equal(config.headers['x-epantry-analytics'], '1')
    assert.equal(payload.pageKey, '/recipes/:slug')
    assert.ok(payload.eventId)
    assert.ok(payload.visitorId)
    assert.ok(payload.sessionId)
    assert.equal(JSON.stringify(payload).includes('private'), false)
    assert.equal(JSON.stringify(payload).includes('paymentId'), false)
  }
  assert.equal(h.calls[0][1].campaign, 'launch_week')
  assert.equal(h.calls[0][1].source, 'campaign')
})

test('M1-B reload check does not erase returning IDs; rejection and account switch do', () => {
  const h = clientHarness()
  h.setConsent(true)
  h.api.recordWebsitePage('/recipes/jeera-rice')
  const visitor = h.localStorage.getItem('epantry:website-visitor-v1')
  assert.ok(visitor)
  h.setConsent(false)
  h.listeners.get('consent:updated')({ detail: { analytics: false, hasDecision: false } })
  assert.equal(h.localStorage.getItem('epantry:website-visitor-v1'), visitor)
  h.listeners.get('consent:updated')({ detail: { analytics: false, hasDecision: true } })
  assert.equal(h.localStorage.getItem('epantry:website-visitor-v1'), null)
  h.setConsent(true)
  h.api.recordWebsitePage('/recipes/jeera-rice')
  assert.ok(h.localStorage.size())
  h.listeners.get('epantry:website-identity-changed')()
  assert.equal(h.localStorage.size(), 0)
})

test('M1-B ingest is idempotent and rejects future/very old timestamps', async () => {
  const source = read('src/modules/websiteAnalytics/websiteAnalytics.service.js')
    .replace(/^import .*\n/gm, '').replace(/^export /gm, '')
  const inserted = []
  let dup = false
  const Model = {
    async updateOne(filter, update) { inserted.push({ filter, update }); return { upsertedCount: dup ? 0 : 1 } },
    aggregate() { return { option() { return [{ day: '2026-11-06', events: 1 }] } } },
  }
  const api = new Function('COOKIE_POLICY_VERSION', 'WebsiteAnalyticsEvent',
    `${source}\nreturn { ingestWebsiteEvent, aggregateWebsiteDays }`,
  )('m1a-2026-11-05', Model)
  const now = new Date('2026-11-06T06:00:00.000Z')
  const input = { eventId: crypto.randomUUID(), occurredAt: now.toISOString(), eventName: 'page_view' }
  assert.deepEqual(await api.ingestWebsiteEvent(input, now), { accepted: true, deduplicated: false })
  assert.equal(inserted[0].update.$setOnInsert.consentPolicyVersion, 'm1a-2026-11-05')
  assert.equal(inserted[0].update.$setOnInsert.expiresAt - now, 90 * 86400000)
  dup = true
  assert.deepEqual(await api.ingestWebsiteEvent(input, now), { accepted: true, deduplicated: true })
  assert.equal((await api.ingestWebsiteEvent({ ...input, occurredAt: '2026-11-04T00:00:00.000Z' }, now)).accepted, false)
  assert.equal((await api.ingestWebsiteEvent({ ...input, occurredAt: '2026-11-07T00:00:00.000Z' }, now)).accepted, false)
  assert.equal((await api.aggregateWebsiteDays({ start: '2026-11-06', end: '2026-11-07' }))[0].events, 1)
  await assert.rejects(() => api.aggregateWebsiteDays({ start: '2026-01-01', end: '2026-11-07' }), RangeError)
})

test('M1-B backend requires server-verified consent, origin and allowlisted event schema', () => {
  const app = read('src/app.js')
  const routes = read('src/modules/websiteAnalytics/websiteAnalytics.routes.js')
  const validation = read('src/modules/websiteAnalytics/websiteAnalytics.validation.js')
  const model = read('src/modules/websiteAnalytics/websiteAnalytics.model.js')
  assert.match(app, /app\.use\('\/api\/v1\/website-analytics', websiteAnalyticsRoutes\)/)
  assert.match(routes, /await hasAnalyticsConsentForRequest\(req\)/)
  assert.match(routes, /req\.get\('origin'\)/)
  assert.match(routes, /req\.get\('x-epantry-analytics'\)/)
  assert.match(validation, /\.strict\(\)/)
  assert.doesNotMatch(validation, /purchase_complete['"]\s*,/)
  assert.match(model, /expireAfterSeconds: 0/)
  assert.doesNotMatch(model, /email:\s*\{/)
  assert.doesNotMatch(model, /password:\s*\{/)
  assert.doesNotMatch(model, /ipAddress:\s*\{/)
})
