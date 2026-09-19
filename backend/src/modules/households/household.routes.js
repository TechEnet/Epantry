import {
  Router,
} from 'express'

import {
  loadHouseholdTenantFromParam,
  requireCustomerAccess,
  requireHouseholdTenantRole,
} from '../auth/authorization.middleware.js'

import {
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireCsrfToken,
} from '../auth/auth.middleware.js'

import {
  createHouseholdController,
  getHouseholdByIdController,
  getHouseholdMembersByIdController,
  getMyHouseholdController,
  getMyHouseholdMembersController,
  removeHouseholdMemberController,
  selectHouseholdController,
  updateHouseholdController,
  updateHouseholdMemberRoleController,
} from './household.controller.js'

import {
  acceptHouseholdInvitationController,
  createHouseholdInvitationController,
  declineHouseholdInvitationController,
  getHouseholdInvitationController,
  getHouseholdInvitationPreviewController,
  listHouseholdInvitationsController,
  resendHouseholdInvitationController,
  revokeHouseholdInvitationController,
} from './householdInvitation.controller.js'

const router =
  Router()

/*
|--------------------------------------------------------------------------
| Current Household Context
|--------------------------------------------------------------------------
|
| Household information is application/tenant data, not basic authentication
| identity.
|
| A Firebase session can remain cryptographically valid even if the EPANTRY
| account is later suspended, disabled or locked.
|
| Therefore household reads must evaluate CURRENT MongoDB account status.
|
*/

router.get(
  '/me',

  authenticateSession,

  loadCurrentUser,

  requireActiveAccount,

  getMyHouseholdController,
)

router.get(
  '/me/members',

  authenticateSession,

  loadCurrentUser,

  requireActiveAccount,

  getMyHouseholdMembersController,
)

/*
|--------------------------------------------------------------------------
| Invitee Invitation Context
|--------------------------------------------------------------------------
|
| These routes intentionally sit before the generic /:householdId routes.
|
| A pending invitation grants NO household tenant access. The invitation
| service validates:
|
| - active EPANTRY account
| - Customer capability
| - verified current email
| - invited email match
| - invitation status/expiry
|
*/


router.get(
  '/invitations/:token/preview',

  getHouseholdInvitationPreviewController,
)

router.get(
  '/invitations/:token',

  authenticateSession,

  loadCurrentUser,

  requireActiveAccount,

  requireCustomerAccess,

  getHouseholdInvitationController,
)

router.post(
  '/invitations/:token/accept',

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  requireActiveAccount,

  requireCustomerAccess,

  acceptHouseholdInvitationController,
)

router.post(
  '/invitations/:token/decline',

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  requireActiveAccount,

  requireCustomerAccess,

  declineHouseholdInvitationController,
)

/*
|--------------------------------------------------------------------------
| Create Household
|--------------------------------------------------------------------------
*/

router.post(
  '/',

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  requireActiveAccount,

  createHouseholdController,
)

/*
|--------------------------------------------------------------------------
| Household Invitation Administration
|--------------------------------------------------------------------------
|
| Route authorization proves tenant membership + owner/admin role.
| Invitation service repeats the same role checks for defense in depth.
|
*/

router.get(
  '/:householdId/invitations',

  authenticateSession,

  loadCurrentUser,

  requireActiveAccount,

  loadHouseholdTenantFromParam(
    'householdId',
  ),

  requireHouseholdTenantRole(
    'owner',
    'admin',
  ),

  listHouseholdInvitationsController,
)

router.post(
  '/:householdId/invitations',

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  requireActiveAccount,

  loadHouseholdTenantFromParam(
    'householdId',
  ),

  requireHouseholdTenantRole(
    'owner',
    'admin',
  ),

  createHouseholdInvitationController,
)

router.post(
  '/:householdId/invitations/:invitationId/resend',

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  requireActiveAccount,

  loadHouseholdTenantFromParam(
    'householdId',
  ),

  requireHouseholdTenantRole(
    'owner',
    'admin',
  ),

  resendHouseholdInvitationController,
)

router.delete(
  '/:householdId/invitations/:invitationId',

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  requireActiveAccount,

  loadHouseholdTenantFromParam(
    'householdId',
  ),

  requireHouseholdTenantRole(
    'owner',
    'admin',
  ),

  revokeHouseholdInvitationController,
)


router.post(
  '/:householdId/select',

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  requireActiveAccount,

  requireCustomerAccess,

  selectHouseholdController,
)

/*
|--------------------------------------------------------------------------
| Explicit Tenant-scoped Household Context
|--------------------------------------------------------------------------
|
| householdId is untrusted route input until loadHouseholdTenantFromParam()
| proves that the current user has an ACTIVE membership in that household.
|
| No application role, including super_admin, bypasses this membership check.
|
*/

router.get(
  '/:householdId',

  authenticateSession,

  loadCurrentUser,

  requireActiveAccount,

  loadHouseholdTenantFromParam(
    'householdId',
  ),

  getHouseholdByIdController,
)

/*
|--------------------------------------------------------------------------
| Explicit Tenant-scoped Member Listing
|--------------------------------------------------------------------------
*/

router.get(
  '/:householdId/members',

  authenticateSession,

  loadCurrentUser,

  requireActiveAccount,

  loadHouseholdTenantFromParam(
    'householdId',
  ),

  getHouseholdMembersByIdController,
)

/*
|--------------------------------------------------------------------------
| Household Member Management
|--------------------------------------------------------------------------
|
| Role update:
|   route requires owner; service repeats owner-only rule.
|
| Removal:
|   route allows owner/admin; service protects owner/admin hierarchy.
|
*/

router.patch(
  '/:householdId/members/:membershipId/role',

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  requireActiveAccount,

  loadHouseholdTenantFromParam(
    'householdId',
  ),

  requireHouseholdTenantRole(
    'owner',
  ),

  updateHouseholdMemberRoleController,
)

router.delete(
  '/:householdId/members/:membershipId',

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  requireActiveAccount,

  loadHouseholdTenantFromParam(
    'householdId',
  ),

  requireHouseholdTenantRole(
    'owner',
    'admin',
  ),

  removeHouseholdMemberController,
)

/*
|--------------------------------------------------------------------------
| Household Resource Mutation
|--------------------------------------------------------------------------
|
| Authorization composition:
|
| valid Firebase session
| -> loaded EPANTRY user
| -> active account
| -> active household membership
| -> owner/admin household role
| -> controller
|
| Service layer repeats the owner/admin membership requirement for defense
| in depth.
|
*/

router.patch(
  '/:householdId',

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  requireActiveAccount,

  loadHouseholdTenantFromParam(
    'householdId',
  ),

  requireHouseholdTenantRole(
    'owner',
    'admin',
  ),

  updateHouseholdController,
)

export default router
