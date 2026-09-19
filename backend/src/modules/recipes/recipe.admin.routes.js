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
  changeAdminDishLifecycleController,
  changeAdminRecipeVersionLifecycleController,
  createAdminRecipeController,
  createAdminRecipeImageUploadIntentController,
  createNextAdminRecipeVersionController,
  getAdminRecipeVersionController,
  listAdminRecipesController,
  publishAdminRecipeVersionController,
  reviewAdminRecipeVersionController,
  submitAdminRecipeForReviewController,
  updateAdminRecipeDraftController,
  updateAdminRecipeHeroImageController,
} from './recipe.admin.controller.js'

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

function requireRecipePermission(
  permissionKey,
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

    if (
      !effective.has(
        permissionKey,
      )
    ) {
      return next(
        new ApiError(
          403,
          'Recipe administrative permission is required.',
          [
            {
              code:
                'ADMIN_PERMISSION_REQUIRED',

              required:
                permissionKey,
            },
          ],
        ),
      )
    }

    return next()
  }
}

const requireRecipeRead =
  requireRecipePermission(
    'recipe.read',
  )

const requireRecipeMutation =
  requireRecipePermission(
    'recipe.mutate',
  )

const requireRecipePublish =
  requireRecipePermission(
    'recipe.publish',
  )

/*
|--------------------------------------------------------------------------
| Entire Recipe Admin Surface
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
| Read
|--------------------------------------------------------------------------
*/

router.get(
  '/recipes',

  requireRecipeRead,

  listAdminRecipesController,
)

router.get(
  '/recipes/versions/:versionId',

  requireRecipeRead,

  getAdminRecipeVersionController,
)

/*
|--------------------------------------------------------------------------
| Create / Draft
|--------------------------------------------------------------------------
*/


router.post(
  '/recipes/image-upload-intent',

  requireCsrfToken,

  requireRecentMfaAuthentication,

  requireRecipeMutation,

  createAdminRecipeImageUploadIntentController,
)

router.patch(
  '/recipes/:dishId/image',

  requireCsrfToken,

  requireRecentMfaAuthentication,

  requireRecipeMutation,

  updateAdminRecipeHeroImageController,
)

router.post(
  '/recipes',

  requireCsrfToken,

  requireRecentMfaAuthentication,

  requireRecipeMutation,

  createAdminRecipeController,
)

router.patch(
  '/recipes/versions/:versionId',

  requireCsrfToken,

  requireRecentMfaAuthentication,

  requireRecipeMutation,

  updateAdminRecipeDraftController,
)

router.post(
  '/recipes/:dishId/versions',

  requireCsrfToken,

  requireRecentMfaAuthentication,

  requireRecipeMutation,

  createNextAdminRecipeVersionController,
)

/*
|--------------------------------------------------------------------------
| Review
|--------------------------------------------------------------------------
*/

router.post(
  '/recipes/versions/:versionId/submit-review',

  requireCsrfToken,

  requireRecentMfaAuthentication,

  requireRecipeMutation,

  submitAdminRecipeForReviewController,
)

router.post(
  '/recipes/versions/:versionId/review',

  requireCsrfToken,

  requireRecentMfaAuthentication,

  requireRecipeMutation,

  reviewAdminRecipeVersionController,
)

/*
|--------------------------------------------------------------------------
| Publish
|--------------------------------------------------------------------------
*/

router.post(
  '/recipes/versions/:versionId/publish',

  requireCsrfToken,

  requireRecentMfaAuthentication,

  requireRecipePublish,

  publishAdminRecipeVersionController,
)

/*
|--------------------------------------------------------------------------
| Lifecycle
|--------------------------------------------------------------------------
*/

router.post(
  '/recipes/versions/:versionId/lifecycle',

  requireCsrfToken,

  requireRecentMfaAuthentication,

  requireRecipeMutation,

  changeAdminRecipeVersionLifecycleController,
)

router.post(
  '/recipes/:dishId/lifecycle',

  requireCsrfToken,

  requireRecentMfaAuthentication,

  requireRecipeMutation,

  changeAdminDishLifecycleController,
)

export default router