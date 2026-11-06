import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { authenticateSession, loadCurrentUser, requireActiveAccount, requireMfaAssurance } from '../auth/auth.middleware.js'
import { loadAdminAuthorization, requireAdminAccess } from '../admin/adminPermission.middleware.js'
import { sensitiveResponseNoStoreMiddleware } from '../../middlewares/security.middleware.js'
import { ApiResponse } from '../../utils/ApiResponse.js'
import { ApiError } from '../../utils/ApiError.js'
import { getWebsiteAnalyticsReport } from './websiteAnalytics.report.service.js'

const router = Router()

router.use(
  sensitiveResponseNoStoreMiddleware,
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireMfaAssurance,
  loadAdminAuthorization,
  requireAdminAccess,
  // This is aggregate visitor data, not the existing broad operational
  // analytics surface. Restrict it to real root Super Admin accounts.
  (req, _res, next) => req.adminAuthorization?.isRootSuperAdmin === true
    ? next()
    : next(new ApiError(403, 'Website analytics is available to the Super Admin only.')),
)

router.use(rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many website report requests.' },
}))

router.get('/report', async (req, res, next) => {
  try {
    const result = await getWebsiteAnalyticsReport(req.query)
    return res.status(200).json(new ApiResponse(200, result, 'Website analytics loaded.'))
  } catch (error) {
    if (error instanceof RangeError) return next(new ApiError(400, error.message))
    return next(error)
  }
})

export default router
