import { Router } from 'express'

import {
  loadAdminAuthorization,
  requireAdminAccess,
  requireAnyAdminPermission,
} from '../admin/adminPermission.middleware.js'

import {
  rejectPrivilegedImpersonation,
} from '../admin/adminSafety.middleware.js'

import {
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireCsrfToken,
  requireMfaAssurance,
  requireRecentAuthentication,
  requireRecentMfaAuthentication,
} from '../auth/auth.middleware.js'

import {
  requireCustomerAccess,
  requireHostAccess,
} from '../auth/authorization.middleware.js'

import {
  createCustomerMediaRedaction,
  createHostMediaRedaction,
  getAdminMediaPrivacyReview,
  getCustomerMediaPrivacyState,
  getHostMediaPrivacyState,
  listAdminMediaPrivacyReviews,
  recheckCustomerMediaPrivacy,
  recheckHostMediaPrivacy,
  requestCustomerMediaCleanup,
  requestHostMediaCleanup,
  resolveAdminMediaPrivacyReview,
} from './mediaPrivacy.controller.js'

const customerRouter = Router()
const hostRouter = Router()
const adminRouter = Router()

function wrap(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next)
  }
}

customerRouter.use(
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireCustomerAccess,
)

customerRouter.get(
  '/evidence/:imageEvidenceId',
  wrap(getCustomerMediaPrivacyState),
)

customerRouter.post(
  '/evidence/:imageEvidenceId/recheck',
  requireCsrfToken,
  wrap(recheckCustomerMediaPrivacy),
)

customerRouter.post(
  '/evidence/:imageEvidenceId/redaction-jobs',
  requireCsrfToken,
  wrap(createCustomerMediaRedaction),
)

customerRouter.post(
  '/evidence/:imageEvidenceId/cleanup-request',
  requireCsrfToken,
  requireRecentAuthentication,
  wrap(requestCustomerMediaCleanup),
)

hostRouter.use(
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireHostAccess,
  requireMfaAssurance,
)

hostRouter.get(
  '/evidence/:imageEvidenceId',
  wrap(getHostMediaPrivacyState),
)

hostRouter.post(
  '/evidence/:imageEvidenceId/recheck',
  requireCsrfToken,
  requireRecentMfaAuthentication,
  wrap(recheckHostMediaPrivacy),
)

hostRouter.post(
  '/evidence/:imageEvidenceId/redaction-jobs',
  requireCsrfToken,
  requireRecentMfaAuthentication,
  wrap(createHostMediaRedaction),
)

hostRouter.post(
  '/evidence/:imageEvidenceId/cleanup-request',
  requireCsrfToken,
  requireRecentMfaAuthentication,
  wrap(requestHostMediaCleanup),
)

adminRouter.use(
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireMfaAssurance,
  loadAdminAuthorization,
  requireAdminAccess,
  rejectPrivilegedImpersonation,
)

adminRouter.get(
  '/review-cases',
  requireAnyAdminPermission('trust_safety.read', 'admin.audit.read'),
  wrap(listAdminMediaPrivacyReviews),
)

adminRouter.get(
  '/review-cases/:privacyReviewCaseId',
  requireAnyAdminPermission('trust_safety.read', 'admin.audit.read'),
  wrap(getAdminMediaPrivacyReview),
)

adminRouter.patch(
  '/review-cases/:privacyReviewCaseId',
  requireAnyAdminPermission('trust_safety.mutate'),
  requireCsrfToken,
  requireRecentMfaAuthentication,
  wrap(resolveAdminMediaPrivacyReview),
)

export {
  adminRouter as adminMediaPrivacyRouter,
  customerRouter as customerMediaPrivacyRouter,
  hostRouter as hostMediaPrivacyRouter,
}
