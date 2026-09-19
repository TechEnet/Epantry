import {
  Router,
} from 'express'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  loadAdminAuthorization,
  requireAdminAccess,
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
  requireRecentMfaAuthentication,
} from '../auth/auth.middleware.js'

import {
  activateIngredientRelationController,
  activateRuleProfileController,
  approveFoodCalculationController,
  calculateProductFoodIntelligenceController,
  calculateRecipeFoodIntelligenceController,
  declareProductFoodIntelligenceController,
  declareRecipeFoodIntelligenceController,
  createIngredientRelationController,
  createRuleProfileController,
  getFoodCalculationController,
  getLatestProductFoodIntelligenceController,
  getLatestRecipeFoodIntelligenceController,
  listFoodCalculationsController,
  listIngredientRelationsController,
  listRuleProfilesController,
  retireIngredientRelationController,
  retireRuleProfileController,
  testFoodRuleController,
} from './foodIntelligence.admin.controller.js'

const router =
  Router()

function permissionKeys(
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

function requireAnyPermission(
  required,
) {
  return (
    req,
    res,
    next,
  ) => {
    const available =
      permissionKeys(
        req,
      )

    if (
      !required.some(
        (
          key,
        ) =>
          available.has(
            key,
          ),
      )
    ) {
      return next(
        new ApiError(
          403,
          'Administrative permission is required.',
          [
            {
              code:
                'ADMIN_PERMISSION_REQUIRED',

              requiredAny:
                required,
            },
          ],
        ),
      )
    }

    return next()
  }
}

const requireFoodRead =
  requireAnyPermission([
    'catalog.read',
    'recipe.read',
    'trust_safety.read',
  ])

const requireProductCalculation =
  requireAnyPermission([
    'catalog.mutate',
    'trust_safety.mutate',
  ])

const requireRecipeCalculation =
  requireAnyPermission([
    'recipe.mutate',
    'trust_safety.mutate',
  ])

const requireFoodSafetyMutation =
  requireAnyPermission([
    'trust_safety.mutate',
  ])

/*
|--------------------------------------------------------------------------
| Entire Food Intelligence Admin Surface
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
| Product / Recipe Calculation
|--------------------------------------------------------------------------
*/

router.get(
  '/food-intelligence/products/:productVersionId/latest',

  requireFoodRead,

  getLatestProductFoodIntelligenceController,
)

router.post(
  '/food-intelligence/products/:productVersionId/calculate',

  requireCsrfToken,

  requireRecentMfaAuthentication,

  requireProductCalculation,

  calculateProductFoodIntelligenceController,
)

router.post(
  '/food-intelligence/products/:productVersionId/declare',

  requireCsrfToken,

  requireRecentMfaAuthentication,

  requireProductCalculation,

  declareProductFoodIntelligenceController,
)

router.get(
  '/food-intelligence/recipes/:recipeVersionId/latest',

  requireFoodRead,

  getLatestRecipeFoodIntelligenceController,
)

router.post(
  '/food-intelligence/recipes/:recipeVersionId/calculate',

  requireCsrfToken,

  requireRecentMfaAuthentication,

  requireRecipeCalculation,

  calculateRecipeFoodIntelligenceController,
)

router.post(
  '/food-intelligence/recipes/:recipeVersionId/declare',

  requireCsrfToken,

  requireRecentMfaAuthentication,

  requireRecipeCalculation,

  declareRecipeFoodIntelligenceController,
)

/*
|--------------------------------------------------------------------------
| Ingredient / Allergen Mapping — A07 backend
|--------------------------------------------------------------------------
*/

router.get(
  '/food-intelligence/ingredient-relations',

  requireFoodRead,

  listIngredientRelationsController,
)

router.post(
  '/food-intelligence/ingredient-relations',

  requireCsrfToken,

  requireRecentMfaAuthentication,

  requireFoodSafetyMutation,

  createIngredientRelationController,
)

router.post(
  '/food-intelligence/ingredient-relations/:id/activate',

  requireCsrfToken,

  requireRecentMfaAuthentication,

  requireFoodSafetyMutation,

  activateIngredientRelationController,
)

router.post(
  '/food-intelligence/ingredient-relations/:id/retire',

  requireCsrfToken,

  requireRecentMfaAuthentication,

  requireFoodSafetyMutation,

  retireIngredientRelationController,
)

/*
|--------------------------------------------------------------------------
| Rule Profiles
|--------------------------------------------------------------------------
*/

router.get(
  '/food-rules',

  requireFoodRead,

  listRuleProfilesController,
)

router.post(
  '/food-rules',

  requireCsrfToken,

  requireRecentMfaAuthentication,

  requireFoodSafetyMutation,

  createRuleProfileController,
)

/*
|--------------------------------------------------------------------------
| Document-aligned Rule Test API
|--------------------------------------------------------------------------
*/

router.post(
  '/food-rules/test',

  requireCsrfToken,

  requireFoodRead,

  testFoodRuleController,
)

router.post(
  '/food-rules/:id/activate',

  requireCsrfToken,

  requireRecentMfaAuthentication,

  requireFoodSafetyMutation,

  activateRuleProfileController,
)

router.post(
  '/food-rules/:id/retire',

  requireCsrfToken,

  requireRecentMfaAuthentication,

  requireFoodSafetyMutation,

  retireRuleProfileController,
)

/*
|--------------------------------------------------------------------------
| Trust / Safety Calculation Queue — A17 backend
|--------------------------------------------------------------------------
*/

router.get(
  '/food-intelligence/calculations',

  requireFoodRead,

  listFoodCalculationsController,
)

router.get(
  '/food-intelligence/calculations/:id',

  requireFoodRead,

  getFoodCalculationController,
)

router.post(
  '/food-intelligence/calculations/:id/approve',

  requireCsrfToken,

  requireRecentMfaAuthentication,

  requireFoodSafetyMutation,

  approveFoodCalculationController,
)

export default router