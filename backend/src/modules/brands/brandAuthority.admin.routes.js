import {
  Router,
} from 'express'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireCsrfToken,
  requireMfaAssurance,
  requireRecentMfaAuthentication,
} from '../auth/auth.middleware.js'

import {
  loadAdminAuthorization,
  requireAdminAccess,
} from '../admin/adminPermission.middleware.js'

import {
  rejectPrivilegedImpersonation,
} from '../admin/adminSafety.middleware.js'

import {
  approveAdminBrandClaimController,
  changeAdminBrandAuthorityLifecycleController,
  getAdminBrandClaimController,
  listAdminBrandAuthoritiesController,
  listAdminBrandClaimsController,
  listAdminBrandConflictsController,
  listAdminContentOverridesController,
  rejectAdminBrandClaimController,
  resolveAdminBrandConflictController,
  reviewAdminBrandIdentityCheckController,
  reviewAdminContentOverrideController,
} from './brandAuthority.api.controller.js'

const router =
  Router()

function extractAdminPermissionKeys(
  req,
) {
  const raw =
    req.adminAuthorization
      ?.permissionKeys ||
    req.adminAuthorization
      ?.permissions ||
    req.adminAuthorization
      ?.effectivePermissions ||
    []

  return new Set(
    raw
      .map(
        (
          value,
        ) =>
          typeof value ===
          'string'
            ? value
            : value?.key,
      )
      .filter(
        Boolean,
      ),
  )
}

function requireAnyBrandAdminPermission(
  permissionKeys,
) {
  return (
    req,
    res,
    next,
  ) => {
    const effective =
      extractAdminPermissionKeys(
        req,
      )

    const allowed =
      permissionKeys.some(
        (
          permissionKey,
        ) =>
          effective.has(
            permissionKey,
          ),
      )

    if (!allowed) {
      return next(
        new ApiError(
          403,
          'Administrative permission is required.',
          [
            {
              code:
                'ADMIN_PERMISSION_REQUIRED',

              requiredAny:
                permissionKeys,
            },
          ],
        ),
      )
    }

    return next()
  }
}

const requireBrandRead =
  requireAnyBrandAdminPermission([
    'catalog.read',
    'trust_safety.read',
  ])

const requireBrandVerificationMutation =
  requireAnyBrandAdminPermission([
    'trust_safety.mutate',
  ])

const requireBrandContentMutation =
  requireAnyBrandAdminPermission([
    'catalog.mutate',
    'trust_safety.mutate',
  ])

const requireBrandConflictMutation =
  requireAnyBrandAdminPermission([
    'trust_safety.mutate',
  ])

/*
|--------------------------------------------------------------------------
| Entire Admin Brand Surface
|--------------------------------------------------------------------------
*/

router.use(
  rejectPrivilegedImpersonation,

  authenticateSession,

  loadCurrentUser,

  requireActiveAccount,

  loadAdminAuthorization,

  requireAdminAccess,

  requireMfaAssurance,
)

/*
|--------------------------------------------------------------------------
| Claim Review Queue
|--------------------------------------------------------------------------
*/

router.get(
  '/brand-claims',

  requireBrandRead,

  listAdminBrandClaimsController,
)

router.get(
  '/brand-claims/:id',

  requireBrandRead,

  getAdminBrandClaimController,
)

router.post(
  '/brand-identity-checks/:id/review',

  requireCsrfToken,

  requireRecentMfaAuthentication,

  requireBrandVerificationMutation,

  reviewAdminBrandIdentityCheckController,
)

router.post(
  '/brand-claims/:id/approve',

  requireCsrfToken,

  requireRecentMfaAuthentication,

  requireBrandVerificationMutation,

  approveAdminBrandClaimController,
)

router.post(
  '/brand-claims/:id/reject',

  requireCsrfToken,

  requireRecentMfaAuthentication,

  requireBrandVerificationMutation,

  rejectAdminBrandClaimController,
)

/*
|--------------------------------------------------------------------------
| Brand Authority Lifecycle
|--------------------------------------------------------------------------
*/

router.get(
  '/brand-authorities',

  requireBrandRead,

  listAdminBrandAuthoritiesController,
)

router.post(
  '/brand-authorities/:id/lifecycle',

  requireCsrfToken,

  requireRecentMfaAuthentication,

  requireBrandVerificationMutation,

  changeAdminBrandAuthorityLifecycleController,
)

/*
|--------------------------------------------------------------------------
| Content Override Review
|--------------------------------------------------------------------------
*/

router.get(
  '/brand-overrides',

  requireBrandRead,

  listAdminContentOverridesController,
)

router.post(
  '/brand-overrides/:id/review',

  requireCsrfToken,

  requireRecentMfaAuthentication,

  requireBrandContentMutation,

  reviewAdminContentOverrideController,
)

/*
|--------------------------------------------------------------------------
| Conflict Queue
|--------------------------------------------------------------------------
*/

router.get(
  '/brand-conflicts',

  requireBrandRead,

  listAdminBrandConflictsController,
)

router.post(
  '/brand-conflicts/:id/resolve',

  requireCsrfToken,

  requireRecentMfaAuthentication,

  requireBrandConflictMutation,

  resolveAdminBrandConflictController,
)

export default router