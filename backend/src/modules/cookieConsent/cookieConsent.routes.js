import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'

import { env } from '../../config/env.js'
import { ApiError } from '../../utils/ApiError.js'
import { ApiResponse } from '../../utils/ApiResponse.js'
import { sensitiveResponseNoStoreMiddleware } from '../../middlewares/security.middleware.js'
import {
  readConsent,
  resolveConsentSubject,
  saveConsent,
  validateConsentInput,
} from './cookieConsent.service.js'

const router = Router()

const consentWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many cookie preference updates. Try again shortly.' },
})

router.use(sensitiveResponseNoStoreMiddleware)

// Cookie preferences are explicitly for the browser UI. Reject requests from
// other origins (including form-based CSRF) and require a non-simple header.
export function verifyConsentWrite(req, _res, next) {
  const origin = req.get('origin')
  let allowedOrigin
  try {
    allowedOrigin = new URL(env.frontendUrl).origin
  } catch {
    return next(new ApiError(503, 'Cookie preferences are not configured.'))
  }
  if (!origin || origin !== allowedOrigin ||
      req.get('x-epantry-consent') !== '1' ||
      !req.is('application/json')) {
    return next(new ApiError(403, 'Cookie preference request failed security validation.'))
  }
  return next()
}

function wrap(handler) {
  return async (req, res, next) => {
    try { await handler(req, res) } catch (error) { next(error) }
  }
}

router.get('/', wrap(async (req, res) => {
  const subject = await resolveConsentSubject(req, res)
  const result = await readConsent(subject)
  res.status(200).json(new ApiResponse(200, result, 'Cookie preferences loaded.'))
}))

for (const [method, verb, status] of [
  ['post', 'POST', 201],
  ['patch', 'PATCH', 200],
]) {
  router[method]('/', consentWriteLimiter, verifyConsentWrite, wrap(async (req, res) => {
    const input = validateConsentInput(req.body)
    const subject = await resolveConsentSubject(req, res)
    const result = await saveConsent(subject, res, input, verb)
    res.status(status).json(new ApiResponse(status, result, 'Cookie preferences saved.'))
  }))
}

export default router
