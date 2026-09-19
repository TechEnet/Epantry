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
  requireMfaAssurance,
} from '../auth/auth.middleware.js'

import {
  loadAdminAuthorization,
  requireAdminAccess,
} from '../admin/adminPermission.middleware.js'

import {
  rejectPrivilegedImpersonation,
} from '../admin/adminSafety.middleware.js'

import {
  listFoodCalculationsController,
  listFoodIngredientRelationsController,
  listFoodRuleProfilesController,
} from './foodIntelligence.workspace.controller.js'

const router =
  Router()

/*
|--------------------------------------------------------------------------
| Read Permission
|--------------------------------------------------------------------------
*/

const FOOD_INTELLIGENCE_READ_PERMISSIONS =
  Object.freeze([
    'catalog.read',
    'recipe.read',
    'trust_safety.read',
  ])

function requireFoodIntelligenceReadPermission(
  req,
  res,
  next,
) {
  const permissionKeys =
    Array.isArray(
      req.adminAuthorization
        ?.permissionKeys,
    )
      ? req.adminAuthorization
          .permissionKeys
      : []

  const allowed =
    FOOD_INTELLIGENCE_READ_PERMISSIONS.some(
      (
        permissionKey,
      ) =>
        permissionKeys.includes(
          permissionKey,
        ),
    )

  if (!allowed) {
    return next(
      new ApiError(
        403,
        'Food Intelligence administration permission is required.',
        [
          {
            code:
              'FOOD_INTELLIGENCE_ADMIN_READ_FORBIDDEN',

            requiredAnyPermission: [
              ...FOOD_INTELLIGENCE_READ_PERMISSIONS,
            ],
          },
        ],
      ),
    )
  }

  return next()
}

/*
|--------------------------------------------------------------------------
| Security Boundary
|--------------------------------------------------------------------------
*/

router.use(
  authenticateSession,

  loadCurrentUser,

  requireActiveAccount,

  rejectPrivilegedImpersonation,

  loadAdminAuthorization,

  requireAdminAccess,

  requireMfaAssurance,

  requireFoodIntelligenceReadPermission,
)

/*
|--------------------------------------------------------------------------
| A07 Ingredient / Allergen Mapping
|--------------------------------------------------------------------------
*/

router.get(
  '/food-intelligence/ingredient-relations',

  listFoodIngredientRelationsController,
)

/*
|--------------------------------------------------------------------------
| Rule Profiles
|--------------------------------------------------------------------------
*/

router.get(
  '/food-intelligence/rule-profiles',

  listFoodRuleProfilesController,
)

/*
|--------------------------------------------------------------------------
| A17 Trust / Safety Queue
|--------------------------------------------------------------------------
*/

router.get(
  '/food-intelligence/calculations',

  listFoodCalculationsController,
)

export default router