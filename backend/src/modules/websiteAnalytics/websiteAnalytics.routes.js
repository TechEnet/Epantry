import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { env } from '../../config/env.js'
import { sensitiveResponseNoStoreMiddleware } from '../../middlewares/security.middleware.js'
import { ApiResponse } from '../../utils/ApiResponse.js'
import { hasAnalyticsConsentForRequest } from '../cookieConsent/cookieConsent.service.js'
import { websiteEventSchema } from './websiteAnalytics.validation.js'
import { ingestWebsiteEvent } from './websiteAnalytics.service.js'

const router = Router()
const ingestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 240,
  standardHeaders: 'draft-8', legacyHeaders: false,
  message: { success: false, message: 'Too many analytics events.' },
})

function allowedWebsiteOrigin(req) {
  try {
    return req.get('origin') === new URL(env.frontendUrl).origin
  } catch { return false }
}

function isObviousBot(req) {
  return /(?:bot|crawler|spider|headless|lighthouse|pagespeed|prerender)/i.test(
    String(req.get('user-agent') || '').slice(0, 200),
  )
}

router.use(sensitiveResponseNoStoreMiddleware)

router.post('/events', ingestLimiter, async (req, res, next) => {
  try {
    if (!allowedWebsiteOrigin(req) || req.get('x-epantry-analytics') !== '1' ||
        !req.is('application/json')) {
      return res.status(403).json(new ApiResponse(403, null, 'Analytics request origin was not accepted.'))
    }
    // No user-auth prerequisite: guests must be measurable only when the
    // explicit M1-A guest HttpOnly cookie permits analytics.
    if (!(await hasAnalyticsConsentForRequest(req))) {
      return res.status(403).json(new ApiResponse(403, null, 'Website analytics is not enabled.'))
    }
    if (isObviousBot(req)) {
      return res.status(202).json(new ApiResponse(202, { accepted: false }, 'Automated visit ignored.'))
    }
    const parsed = websiteEventSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json(new ApiResponse(400, null, 'Invalid website event.'))
    }
    const result = await ingestWebsiteEvent(parsed.data)
    if (!result.accepted) {
      return res.status(400).json(new ApiResponse(400, null, 'Event timestamp is outside the allowed window.'))
    }
    const status = result.deduplicated ? 200 : 202
    return res.status(status).json(new ApiResponse(status, { accepted: true, deduplicated: result.deduplicated },
      result.deduplicated ? 'Event already recorded.' : 'Event accepted.'))
  } catch (error) { return next(error) }
})

export default router
