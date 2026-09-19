import {
  Router,
} from 'express'

import {
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireCsrfToken,
  requireMfaAssurance,
} from '../auth/auth.middleware.js'

import {
  requireHostAccess,
} from '../auth/authorization.middleware.js'

import {
  createHostBrandClaimController,
  createHostBrandIdentityCheckController,
  createHostContentOverrideController,
  getHostBrandClaimController,
  getHostBrandIdentityCheckController,
  getHostContentOverrideController,
  listHostBrandAuthoritiesController,
  listHostBrandClaimsController,
  listHostBrandIdentityChecksController,
  listHostContentOverridesController,
  submitHostContentOverrideController,
} from './brandAuthority.api.controller.js'

const router =
  Router()

/*
|--------------------------------------------------------------------------
| Host Brand Authority Security Boundary
|--------------------------------------------------------------------------
|
| activeMode is NOT authority.
|
| Active Host capability + MFA required.
| Super Admin gets no implicit Host tenant bypass.
|--------------------------------------------------------------------------
*/

router.use(
  authenticateSession,

  loadCurrentUser,

  requireActiveAccount,

  requireHostAccess,

  requireMfaAssurance,
)

/*
|--------------------------------------------------------------------------
| Identity Evidence
|--------------------------------------------------------------------------
*/

router.get(
  '/brands/identity-checks',

  listHostBrandIdentityChecksController,
)

router.get(
  '/brands/identity-checks/:id',

  getHostBrandIdentityCheckController,
)

router.post(
  '/brands/:brandId/identity-checks',

  requireCsrfToken,

  createHostBrandIdentityCheckController,
)

/*
|--------------------------------------------------------------------------
| Brand Claims
|--------------------------------------------------------------------------
*/

router.get(
  '/brands/claims',

  listHostBrandClaimsController,
)

router.get(
  '/brands/claims/:id',

  getHostBrandClaimController,
)

router.post(
  '/brands/:brandId/claims',

  requireCsrfToken,

  createHostBrandClaimController,
)

/*
|--------------------------------------------------------------------------
| Verified Authority
|--------------------------------------------------------------------------
*/

router.get(
  '/brands/authorities',

  listHostBrandAuthoritiesController,
)

/*
|--------------------------------------------------------------------------
| Brand Content Overrides
|--------------------------------------------------------------------------
*/

router.get(
  '/brand-overrides',

  listHostContentOverridesController,
)

router.get(
  '/brand-overrides/:id',

  getHostContentOverrideController,
)

router.post(
  '/brand-overrides',

  requireCsrfToken,

  createHostContentOverrideController,
)

router.post(
  '/brand-overrides/:id/submit',

  requireCsrfToken,

  submitHostContentOverrideController,
)

export default router