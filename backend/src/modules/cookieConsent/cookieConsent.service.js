import { createHash, randomBytes } from 'node:crypto'

import { env } from '../../config/env.js'
import { ApiError } from '../../utils/ApiError.js'
import { verifyFirebaseSession } from '../auth/auth.service.js'
import { CookieConsent } from './cookieConsent.model.js'

export const COOKIE_POLICY_VERSION = 'm1a-2026-11-05'
export const COOKIE_CONSENT_GUEST_NAME = 'epantry_consent_guest'
export const COOKIE_CONSENT_PATH = '/api/v1'

const GUEST_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000
const MAX_REVISIONS = 30
const GUEST_TOKEN_PATTERN = /^[\w-]{43}$/

function consentCookieOptions() {
  return {
    httpOnly: true,
    secure: env.nodeEnv === 'production' || env.authCookieSameSite === 'none',
    sameSite: env.authCookieSameSite || 'lax',
    path: COOKIE_CONSENT_PATH,
  }
}

export function clearGuestCookie(res) {
  res.clearCookie(COOKIE_CONSENT_GUEST_NAME, consentCookieOptions())
}

function hashGuestToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

/** A Firebase session always wins over any device/guest choice. */
export async function resolveConsentSubject(req, res) {
  const sessionCookie = req.cookies?.[env.authSessionCookieName]
  if (sessionCookie) {
    // Fail closed when a session cookie is stale. Never downgrade the same
    // request to a guest and accidentally use another browser user's choice.
    const session = await verifyFirebaseSession(sessionCookie)
    if (!session.uid) {
      throw new ApiError(401, 'Please sign in again to manage cookie settings.')
    }
    if (req.cookies?.[COOKIE_CONSENT_GUEST_NAME]) clearGuestCookie(res)
    return { subjectKey: `user:${session.uid}`, subjectType: 'user', token: null }
  }

  const existing = req.cookies?.[COOKIE_CONSENT_GUEST_NAME]
  const validToken = typeof existing === 'string' && GUEST_TOKEN_PATTERN.test(existing)
  return {
    subjectKey: validToken ? `guest:${hashGuestToken(existing)}` : null,
    subjectType: 'guest',
    token: validToken ? existing : null,
  }
}

export function validateConsentInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some((key) => !['policyVersion', 'preferences', 'analytics', 'source'].includes(key)) ||
      body.policyVersion !== COOKIE_POLICY_VERSION ||
      typeof body.preferences !== 'boolean' ||
      typeof body.analytics !== 'boolean' ||
      !['banner', 'settings'].includes(body.source)) {
    throw new ApiError(400, 'Invalid cookie preferences or outdated policy. Refresh and try again.')
  }
  return {
    policyVersion: COOKIE_POLICY_VERSION,
    preferences: body.preferences,
    analytics: body.analytics,
    source: body.source,
  }
}

export function serializeConsent(document) {
  return {
    policyVersion: COOKIE_POLICY_VERSION,
    hasDecision: Boolean(document && document.policyVersion === COOKIE_POLICY_VERSION),
    categories: {
      essential: true,
      preferences: Boolean(document?.policyVersion === COOKIE_POLICY_VERSION && document.preferences),
      analytics: Boolean(document?.policyVersion === COOKIE_POLICY_VERSION && document.analytics),
    },
    decidedAt: document?.decidedAt?.toISOString?.() || null,
    // Marketing tracking is intentionally absent: no marketing provider is connected.
  }
}

export async function readConsent(subject) {
  if (!subject.subjectKey) return serializeConsent(null)
  const document = await CookieConsent.findOne({ subjectKey: subject.subjectKey }).lean()
  return serializeConsent(document)
}

export async function saveConsent(subject, res, input, method) {
  let token = subject.token
  let subjectKey = subject.subjectKey

  if (!subjectKey && subject.subjectType === 'guest') {
    token = randomBytes(32).toString('base64url')
    subjectKey = `guest:${hashGuestToken(token)}`
  }
  if (!subjectKey) throw new ApiError(401, 'Unable to identify cookie preferences safely.')

  const existing = await CookieConsent.findOne({ subjectKey }).lean()
  if (method === 'PATCH' && !existing) {
    throw new ApiError(404, 'No saved cookie choices found. Choose your preferences first.')
  }
  if (method === 'POST' && existing && existing.policyVersion === COOKIE_POLICY_VERSION &&
      (existing.preferences !== input.preferences || existing.analytics !== input.analytics)) {
    throw new ApiError(409, 'Cookie choices already exist. Reload settings and update them.')
  }

  const unchanged = existing && existing.policyVersion === COOKIE_POLICY_VERSION &&
    existing.preferences === input.preferences && existing.analytics === input.analytics
  const decidedAt = unchanged ? existing.decidedAt : new Date()

  if (!unchanged) {
    const revision = {
      decidedAt,
      source: input.source,
      policyVersion: COOKIE_POLICY_VERSION,
      preferences: input.preferences,
      analytics: input.analytics,
    }
    try {
      await CookieConsent.findOneAndUpdate(
        { subjectKey },
        {
          $set: {
            policyVersion: COOKIE_POLICY_VERSION,
            preferences: input.preferences,
            analytics: input.analytics,
            decidedAt,
            expiresAt: subject.subjectType === 'guest'
              ? new Date(Date.now() + GUEST_MAX_AGE_MS)
              : null,
          },
          $setOnInsert: { subjectType: subject.subjectType },
          $push: { revisions: { $each: [revision], $slice: -MAX_REVISIONS } },
        },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
      )
    } catch (error) {
      // Concurrent first saves can race on the unique subject key. Return an
      // ordinary conflict instead of inventing a successful second decision.
      if (error?.code === 11000) throw new ApiError(409, 'Cookie choices changed. Refresh settings and try again.')
      throw error
    }
  }

  if (subject.subjectType === 'guest' && token) {
    res.cookie(COOKIE_CONSENT_GUEST_NAME, token, {
      ...consentCookieOptions(),
      maxAge: GUEST_MAX_AGE_MS,
    })
  }

  return serializeConsent({
    policyVersion: COOKIE_POLICY_VERSION,
    preferences: input.preferences,
    analytics: input.analytics,
    decidedAt,
  })
}

/**
 * Optional M19 and M1-B website analytics are forbidden unless the matching
 * signed-in account (or opted-in guest browser) explicitly allowed them.
 * Any lookup failure returns false; it must never enable tracking by default.
 */
export async function hasAnalyticsConsentForRequest(req) {
  try {
    const sessionCookie = req.cookies?.[env.authSessionCookieName]
    let subjectKey = null
    if (sessionCookie) {
      let uid = req.currentUser?.firebaseUid || req.user?.firebaseUid
      if (!uid) {
        const decoded = await verifyFirebaseSession(sessionCookie)
        uid = decoded?.uid
      }
      if (!uid) return false
      subjectKey = `user:${uid}`
    } else {
      const token = req.cookies?.[COOKIE_CONSENT_GUEST_NAME]
      if (typeof token !== 'string' || !GUEST_TOKEN_PATTERN.test(token)) return false
      subjectKey = `guest:${hashGuestToken(token)}`
    }
    const record = await CookieConsent.findOne({ subjectKey }).lean()
    return Boolean(
      record &&
      record.policyVersion === COOKIE_POLICY_VERSION &&
      record.analytics === true &&
      (!record.expiresAt || new Date(record.expiresAt).getTime() > Date.now())
    )
  } catch {
    return false
  }
}
