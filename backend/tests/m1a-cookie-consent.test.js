import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

// The consent unit tests use a minimal in-memory model double so they run
// without live Firebase credentials, MongoDB, or external services.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

function harness() {
  const store = new Map()
  const cookies = []
  const CookieConsent = {
    findOne: ({ subjectKey }) => ({ lean: async () => store.get(subjectKey) || null }),
    findOneAndUpdate: async ({ subjectKey }, update) => {
      const current = store.get(subjectKey) || { subjectKey, revisions: [], subjectType: update.$setOnInsert.subjectType }
      const next = {
        ...current,
        ...update.$set,
        revisions: [...current.revisions, ...update.$push.revisions.$each].slice(-30),
      }
      store.set(subjectKey, next)
      return next
    },
  }
  class ApiError extends Error {
    constructor(statusCode, message) { super(message); this.statusCode = statusCode }
  }
  const env = {
    nodeEnv: 'development',
    frontendUrl: 'http://localhost:5173',
    authCookieSameSite: 'lax',
    authSessionCookieName: 'auth_session',
  }
  const source = read('src/modules/cookieConsent/cookieConsent.service.js')
    .replace(/^import .*\n/gm, '')
    .replace(/^export /gm, '')
  const api = new Function('createHash', 'randomBytes', 'env', 'ApiError', 'verifyFirebaseSession', 'CookieConsent',
    `${source}\nreturn { resolveConsentSubject, validateConsentInput, saveConsent, readConsent, serializeConsent, hasAnalyticsConsentForRequest, clearGuestCookie, COOKIE_POLICY_VERSION, COOKIE_CONSENT_GUEST_NAME }`)(
      createHash, randomBytes, env, ApiError,
      async (cookie) => cookie === 'valid-session' ? { uid: 'real-user-123' } : Promise.reject(new ApiError(401, 'Expired session')),
      CookieConsent,
    )
  const res = {
    cookie(name, value, settings) { cookies.push({ name, value, settings }) },
    clearCookie(name, settings) { cookies.push({ name, cleared: true, settings }) },
  }
  return { api, res, cookies, store }
}

test('M1-A stores guest choices only after an explicit action and remembers them using HttpOnly scoped cookie', async () => {
  const h = harness()
  const before = await h.api.resolveConsentSubject({ cookies: {} }, h.res)
  assert.equal(before.subjectKey, null)
  assert.equal((await h.api.readConsent(before)).hasDecision, false)
  assert.equal(h.cookies.length, 0)

  const input = h.api.validateConsentInput({
    policyVersion: h.api.COOKIE_POLICY_VERSION,
    preferences: false, analytics: false, source: 'banner',
  })
  const saved = await h.api.saveConsent(before, h.res, input, 'POST')
  assert.deepEqual(saved.categories, { essential: true, preferences: false, analytics: false })
  assert.equal(h.cookies[0].settings.httpOnly, true)
  assert.equal(h.cookies[0].settings.path, '/api/v1')
  assert.equal(h.cookies[0].settings.sameSite, 'lax')
  assert.equal(h.store.size, 1)
  const guest = await h.api.resolveConsentSubject({ cookies: { [h.api.COOKIE_CONSENT_GUEST_NAME]: h.cookies[0].value } }, h.res)
  const returned = await h.api.readConsent(guest)
  assert.equal(returned.hasDecision, true)
  assert.equal(returned.categories.analytics, false)
  assert.equal(await h.api.hasAnalyticsConsentForRequest({ cookies: { [h.api.COOKIE_CONSENT_GUEST_NAME]: h.cookies[0].value } }), false)

  const updated = await h.api.saveConsent(guest, h.res,
    h.api.validateConsentInput({ policyVersion: h.api.COOKIE_POLICY_VERSION, preferences: true, analytics: true, source: 'settings' }),
    'PATCH')
  assert.equal(updated.categories.analytics, true)
  assert.equal(await h.api.hasAnalyticsConsentForRequest({ cookies: { [h.api.COOKIE_CONSENT_GUEST_NAME]: h.cookies[0].value } }), true)
  assert.equal(h.store.values().next().value.revisions.length, 2)
})

test('M1-A rejects malformed or invented categories; essential is never opt-out', () => {
  const h = harness()
  const baseline = { policyVersion: h.api.COOKIE_POLICY_VERSION, preferences: false, analytics: false, source: 'banner' }
  for (const input of [
    { ...baseline, analytics: 'true' },
    { ...baseline, marketing: true },
    { ...baseline, essential: false },
    { ...baseline, policyVersion: 'old-v1' },
    { ...baseline, source: 'ads' },
    null,
  ]) {
    assert.throws(() => h.api.validateConsentInput(input), (error) => error.statusCode === 400)
  }
  assert.equal(h.api.serializeConsent(null).categories.essential, true)
  assert.equal(h.api.serializeConsent(null).categories.analytics, false)
})

test('M1-A isolates signed-in account decisions from prior guest choices and denies stale sessions', async () => {
  const h = harness()
  const guest = await h.api.resolveConsentSubject({ cookies: {} }, h.res)
  await h.api.saveConsent(guest, h.res,
    h.api.validateConsentInput({ policyVersion: h.api.COOKIE_POLICY_VERSION, preferences: true, analytics: true, source: 'banner' }), 'POST')
  const cookie = h.cookies[0].value
  const signedIn = await h.api.resolveConsentSubject({ cookies: { auth_session: 'valid-session', [h.api.COOKIE_CONSENT_GUEST_NAME]: cookie } }, h.res)
  assert.equal(signedIn.subjectType, 'user')
  assert.equal(signedIn.subjectKey, 'user:real-user-123')
  assert.equal((await h.api.readConsent(signedIn)).hasDecision, false)
  assert.equal(await h.api.hasAnalyticsConsentForRequest({ cookies: { auth_session: 'valid-session' } }), false)
  assert.equal(h.cookies[1].cleared, true)
  await assert.rejects(
    h.api.resolveConsentSubject({ cookies: { auth_session: 'expired-session', [h.api.COOKIE_CONSENT_GUEST_NAME]: cookie } }, h.res),
    (error) => error.statusCode === 401,
  )
})

test('M1-A is wired separately from the existing account consent and operational analytics routes', () => {
  const app = read('src/app.js')
  assert.match(app, /app\.use\('\/api\/v1\/privacy\/consent', cookieConsentRoutes\)/)
  const router = read('src/modules/cookieConsent/cookieConsent.routes.js')
  assert.match(router, /verifyConsentWrite/)
  assert.match(router, /consentWriteLimiter/)
  assert.match(router, /req\.get\('origin'\)/)
  assert.match(router, /req\.get\('x-epantry-consent'\)/)
  assert.match(router, /req\.is\('application\/json'\)/)
})


test('M1-A explicitly blocks the existing M19 automatic and manual analytics writes before consent', () => {
  const auto = read('src/middlewares/analyticsInstrumentation.middleware.js')
  const manual = read('src/modules/analytics/analytics.routes.js')
  assert.match(auto, /if \(!\(await hasAnalyticsConsentForRequest\(req\)\)\) return/)
  assert.match(manual, /if \(!\(await hasAnalyticsConsentForRequest\(req\)\)\)/)
})
