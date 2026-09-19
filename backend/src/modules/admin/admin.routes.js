import {
  Router,
} from 'express'

import {
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireCsrfToken,
  requireMfaAssurance,
  requireRecentMfaAuthentication,
} from '../auth/auth.middleware.js'

import {
  requirePrivilegedAccess,
  requireRecentPrivilegedAccess,
} from '../auth/authorization.middleware.js'

import {
  loadAdminAuthorization,
  requireAdminAccess,
  requireAdminPermission,
} from './adminPermission.middleware.js'

import {
  rejectPrivilegedImpersonation,
} from './adminSafety.middleware.js'

import {
  getCurrentAdminAccessController,
} from './adminAccess.controller.js'

import {
  createAdminRoleController,
  getAdminUserRolesController,
  listAdminPermissionsController,
  listAdminRolesController,
  updateAdminRoleController,
  updateAdminUserRolesController,
} from './adminManagement.controller.js'

import {
  getAdminAuditEventController,
  listAdminAuditEventsController,
} from './adminAudit.controller.js'

import {
  approveHostController,
  getHostController,
  listHostsController,
  rejectHostController,
  suspendHostController,
} from './admin.controller.js'

import {
  createCatalogBrandController,
  createCatalogCategoryController,
  createNextProductVersionController,
  createProductDraftController,
  createProductFamilyController,
  createProductPackController,
  createProductVariantController,
  getProductVersionController,
  listCatalogBrandsController,
  listCatalogCategoriesController,
  listProductFamiliesController,
  listProductPacksController,
  listProductVariantsController,
  listProductVersionsController,
  submitProductVersionForReviewController,
  updateCatalogBrandController,
  updateCatalogCategoryController,
  updateProductDraftController,
  updateProductFamilyController,
  updateProductPackController,
  updateProductVariantController,
} from '../catalog/catalog.admin.controller.js'

import {
  createCanonicalIngredientController,
  createEvidenceSourceController,
  listCanonicalIngredientsController,
  listEvidenceSourcesController,
  publishProductVersionController,
  retireProductVersionController,
  updateCanonicalIngredientController,
  updateProductDraftFactsController,
} from '../catalog/catalog.governance.controller.js'

const router =
  Router()

/*
|--------------------------------------------------------------------------
| Privileged Impersonation Boundary
|--------------------------------------------------------------------------
|
| Applies to the complete /api/v1/admin surface.
|
*/

router.use(
  rejectPrivilegedImpersonation,
)

/*
|--------------------------------------------------------------------------
| Current Administrative Access
|--------------------------------------------------------------------------
|
| This is the frontend bootstrap contract for the privileged administration
| surface.
|
| It supports:
|
| - real Super Admin
| - limited internal admins resolved through AdminAssignment
|
| It does NOT inspect or mutate activeMode.
|
| Important ordering:
|
| resolve admin authorization
|        ↓
| reject ordinary Customer / Host
|        ↓
| require MFA from actual admins
|
| This prevents an ordinary non-admin account from being treated as an admin
| merely because it does not yet have MFA.
|
*/

router.get(
  '/access',

  authenticateSession,

  loadCurrentUser,

  requireActiveAccount,

  loadAdminAuthorization,

  requireAdminAccess,

  requireMfaAssurance,

  getCurrentAdminAccessController,
)

/*
|--------------------------------------------------------------------------
| Super Admin Control Plane
|--------------------------------------------------------------------------
*/

router.get(
  '/permissions',

  authenticateSession,

  loadCurrentUser,

  requireActiveAccount,

  ...requirePrivilegedAccess(
    'super_admin',
  ),

  loadAdminAuthorization,

  listAdminPermissionsController,
)

/*
|--------------------------------------------------------------------------
| Admin Roles
|--------------------------------------------------------------------------
*/

router.get(
  '/roles',

  authenticateSession,

  loadCurrentUser,

  requireActiveAccount,

  ...requirePrivilegedAccess(
    'super_admin',
  ),

  loadAdminAuthorization,

  listAdminRolesController,
)

router.post(
  '/roles',

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  requireActiveAccount,

  ...requireRecentPrivilegedAccess(
    'super_admin',
  ),

  loadAdminAuthorization,

  createAdminRoleController,
)

router.patch(
  '/roles/:roleId',

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  requireActiveAccount,

  ...requireRecentPrivilegedAccess(
    'super_admin',
  ),

  loadAdminAuthorization,

  updateAdminRoleController,
)

/*
|--------------------------------------------------------------------------
| Limited Internal Admin Assignment
|--------------------------------------------------------------------------
|
| Assignment management remains a REAL Super Admin control-plane capability.
|
| These endpoints never modify:
|
| customerEnabled
| hostEnabled
| hostAccessStatus
| superAdminEnabled
| activeMode
|
*/

router.get(
  '/users/:userId/roles',

  authenticateSession,

  loadCurrentUser,

  requireActiveAccount,

  ...requirePrivilegedAccess(
    'super_admin',
  ),

  loadAdminAuthorization,

  getAdminUserRolesController,
)

router.patch(
  '/users/:userId/roles',

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  requireActiveAccount,

  ...requireRecentPrivilegedAccess(
    'super_admin',
  ),

  loadAdminAuthorization,

  updateAdminUserRolesController,
)

/*
|--------------------------------------------------------------------------
| Audit Explorer
|--------------------------------------------------------------------------
*/

router.get(
  '/audit',

  authenticateSession,

  loadCurrentUser,

  requireActiveAccount,

  requireMfaAssurance,

  loadAdminAuthorization,

  requireAdminPermission(
    'admin.audit.read',
  ),

  listAdminAuditEventsController,
)

router.get(
  '/audit/:eventId',

  authenticateSession,

  loadCurrentUser,

  requireActiveAccount,

  requireMfaAssurance,

  loadAdminAuthorization,

  requireAdminPermission(
    'admin.audit.read',
  ),

  getAdminAuditEventController,
)

/*
|--------------------------------------------------------------------------
| Host Review Queue
|--------------------------------------------------------------------------
*/

router.get(
  '/hosts',

  authenticateSession,

  loadCurrentUser,

  requireActiveAccount,

  requireMfaAssurance,

  loadAdminAuthorization,

  requireAdminPermission(
    'host.review.read',
  ),

  listHostsController,
)

/*
|--------------------------------------------------------------------------
| Host Details
|--------------------------------------------------------------------------
*/

router.get(
  '/hosts/:userId',

  authenticateSession,

  loadCurrentUser,

  requireActiveAccount,

  requireMfaAssurance,

  loadAdminAuthorization,

  requireAdminPermission(
    'host.review.read',
  ),

  getHostController,
)

/*
|--------------------------------------------------------------------------
| Approve Host
|--------------------------------------------------------------------------
*/

router.patch(
  '/hosts/:userId/approve',

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  requireActiveAccount,

  requireRecentMfaAuthentication,

  loadAdminAuthorization,

  requireAdminPermission(
    'host.review.approve',
  ),

  approveHostController,
)

/*
|--------------------------------------------------------------------------
| Reject Host
|--------------------------------------------------------------------------
*/

router.patch(
  '/hosts/:userId/reject',

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  requireActiveAccount,

  requireRecentMfaAuthentication,

  loadAdminAuthorization,

  requireAdminPermission(
    'host.review.reject',
  ),

  rejectHostController,
)

/*
|--------------------------------------------------------------------------
| Suspend Host
|--------------------------------------------------------------------------
*/

router.patch(
  '/hosts/:userId/suspend',

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  requireActiveAccount,

  requireRecentMfaAuthentication,

  loadAdminAuthorization,

  requireAdminPermission(
    'host.review.suspend',
  ),

  suspendHostController,
)

/*
|--------------------------------------------------------------------------
| M04 Catalog - Brands
|--------------------------------------------------------------------------
*/

router.get(
  '/catalog/brands',

  authenticateSession,

  loadCurrentUser,

  requireActiveAccount,

  requireMfaAssurance,

  loadAdminAuthorization,

  requireAdminPermission(
    'catalog.read',
  ),

  listCatalogBrandsController,
)

router.post(
  '/catalog/brands',

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  requireActiveAccount,

  requireRecentMfaAuthentication,

  loadAdminAuthorization,

  requireAdminPermission(
    'catalog.mutate',
  ),

  createCatalogBrandController,
)

router.patch(
  '/catalog/brands/:id',

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  requireActiveAccount,

  requireRecentMfaAuthentication,

  loadAdminAuthorization,

  requireAdminPermission(
    'catalog.mutate',
  ),

  updateCatalogBrandController,
)

/*
|--------------------------------------------------------------------------
| M04 Catalog - Categories
|--------------------------------------------------------------------------
*/

router.get(
  '/catalog/categories',

  authenticateSession,

  loadCurrentUser,

  requireActiveAccount,

  requireMfaAssurance,

  loadAdminAuthorization,

  requireAdminPermission(
    'catalog.read',
  ),

  listCatalogCategoriesController,
)

router.post(
  '/catalog/categories',

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  requireActiveAccount,

  requireRecentMfaAuthentication,

  loadAdminAuthorization,

  requireAdminPermission(
    'catalog.mutate',
  ),

  createCatalogCategoryController,
)

router.patch(
  '/catalog/categories/:id',

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  requireActiveAccount,

  requireRecentMfaAuthentication,

  loadAdminAuthorization,

  requireAdminPermission(
    'catalog.mutate',
  ),

  updateCatalogCategoryController,
)

/*
|--------------------------------------------------------------------------
| M04 Catalog - Product Families
|--------------------------------------------------------------------------
*/

router.get(
  '/catalog/product-families',

  authenticateSession,

  loadCurrentUser,

  requireActiveAccount,

  requireMfaAssurance,

  loadAdminAuthorization,

  requireAdminPermission(
    'catalog.read',
  ),

  listProductFamiliesController,
)

router.post(
  '/catalog/product-families',

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  requireActiveAccount,

  requireRecentMfaAuthentication,

  loadAdminAuthorization,

  requireAdminPermission(
    'catalog.mutate',
  ),

  createProductFamilyController,
)

router.patch(
  '/catalog/product-families/:id',

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  requireActiveAccount,

  requireRecentMfaAuthentication,

  loadAdminAuthorization,

  requireAdminPermission(
    'catalog.mutate',
  ),

  updateProductFamilyController,
)

/*
|--------------------------------------------------------------------------
| M04 Catalog - Product Variants
|--------------------------------------------------------------------------
*/

router.get(
  '/catalog/product-variants',

  authenticateSession,

  loadCurrentUser,

  requireActiveAccount,

  requireMfaAssurance,

  loadAdminAuthorization,

  requireAdminPermission(
    'catalog.read',
  ),

  listProductVariantsController,
)

router.post(
  '/catalog/product-variants',

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  requireActiveAccount,

  requireRecentMfaAuthentication,

  loadAdminAuthorization,

  requireAdminPermission(
    'catalog.mutate',
  ),

  createProductVariantController,
)

router.patch(
  '/catalog/product-variants/:id',

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  requireActiveAccount,

  requireRecentMfaAuthentication,

  loadAdminAuthorization,

  requireAdminPermission(
    'catalog.mutate',
  ),

  updateProductVariantController,
)

/*
|--------------------------------------------------------------------------
| M04 Catalog - Packs
|--------------------------------------------------------------------------
*/

router.get(
  '/catalog/packs',

  authenticateSession,

  loadCurrentUser,

  requireActiveAccount,

  requireMfaAssurance,

  loadAdminAuthorization,

  requireAdminPermission(
    'catalog.read',
  ),

  listProductPacksController,
)

router.post(
  '/catalog/packs',

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  requireActiveAccount,

  requireRecentMfaAuthentication,

  loadAdminAuthorization,

  requireAdminPermission(
    'catalog.mutate',
  ),

  createProductPackController,
)

router.patch(
  '/catalog/packs/:id',

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  requireActiveAccount,

  requireRecentMfaAuthentication,

  loadAdminAuthorization,

  requireAdminPermission(
    'catalog.mutate',
  ),

  updateProductPackController,
)

/*
|--------------------------------------------------------------------------
| M04 Catalog - Product Versions
|--------------------------------------------------------------------------
*/

router.get(
  '/catalog/product-versions',

  authenticateSession,

  loadCurrentUser,

  requireActiveAccount,

  requireMfaAssurance,

  loadAdminAuthorization,

  requireAdminPermission(
    'catalog.read',
  ),

  listProductVersionsController,
)

router.post(
  '/catalog/product-versions',

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  requireActiveAccount,

  requireRecentMfaAuthentication,

  loadAdminAuthorization,

  requireAdminPermission(
    'catalog.mutate',
  ),

  createProductDraftController,
)

router.get(
  '/catalog/product-versions/:id',

  authenticateSession,

  loadCurrentUser,

  requireActiveAccount,

  requireMfaAssurance,

  loadAdminAuthorization,

  requireAdminPermission(
    'catalog.read',
  ),

  getProductVersionController,
)

router.patch(
  '/catalog/product-versions/:id',

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  requireActiveAccount,

  requireRecentMfaAuthentication,

  loadAdminAuthorization,

  requireAdminPermission(
    'catalog.mutate',
  ),

  updateProductDraftController,
)

router.patch(
  '/catalog/product-versions/:id/facts',

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  requireActiveAccount,

  requireRecentMfaAuthentication,

  loadAdminAuthorization,

  requireAdminPermission(
    'catalog.mutate',
  ),

  updateProductDraftFactsController,
)

router.post(
  '/catalog/product-versions/:id/submit-review',

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  requireActiveAccount,

  requireRecentMfaAuthentication,

  loadAdminAuthorization,

  requireAdminPermission(
    'catalog.mutate',
  ),

  submitProductVersionForReviewController,
)

router.post(
  '/catalog/product-versions/:id/next-version',

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  requireActiveAccount,

  requireRecentMfaAuthentication,

  loadAdminAuthorization,

  requireAdminPermission(
    'catalog.mutate',
  ),

  createNextProductVersionController,
)

/*
|--------------------------------------------------------------------------
| M04 Catalog - Publish / Retire
|--------------------------------------------------------------------------
*/

router.post(
  '/catalog/product-versions/:id/publish',

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  requireActiveAccount,

  requireRecentMfaAuthentication,

  loadAdminAuthorization,

  requireAdminPermission(
    'catalog.publish',
  ),

  publishProductVersionController,
)

router.post(
  '/catalog/product-versions/:id/retire',

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  requireActiveAccount,

  requireRecentMfaAuthentication,

  loadAdminAuthorization,

  requireAdminPermission(
    'catalog.publish',
  ),

  retireProductVersionController,
)

/*
|--------------------------------------------------------------------------
| M04 Catalog - Ingredient Dictionary
|--------------------------------------------------------------------------
*/

router.get(
  '/catalog/ingredients',

  authenticateSession,

  loadCurrentUser,

  requireActiveAccount,

  requireMfaAssurance,

  loadAdminAuthorization,

  requireAdminPermission(
    'catalog.read',
  ),

  listCanonicalIngredientsController,
)

router.post(
  '/catalog/ingredients',

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  requireActiveAccount,

  requireRecentMfaAuthentication,

  loadAdminAuthorization,

  requireAdminPermission(
    'catalog.mutate',
  ),

  createCanonicalIngredientController,
)

router.patch(
  '/catalog/ingredients/:id',

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  requireActiveAccount,

  requireRecentMfaAuthentication,

  loadAdminAuthorization,

  requireAdminPermission(
    'catalog.mutate',
  ),

  updateCanonicalIngredientController,
)

/*
|--------------------------------------------------------------------------
| M04 Catalog - Evidence
|--------------------------------------------------------------------------
*/

router.get(
  '/catalog/evidence',

  authenticateSession,

  loadCurrentUser,

  requireActiveAccount,

  requireMfaAssurance,

  loadAdminAuthorization,

  requireAdminPermission(
    'catalog.read',
  ),

  listEvidenceSourcesController,
)

router.post(
  '/catalog/evidence',

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  requireActiveAccount,

  requireRecentMfaAuthentication,

  loadAdminAuthorization,

  requireAdminPermission(
    'catalog.mutate',
  ),

  createEvidenceSourceController,
)

export default router