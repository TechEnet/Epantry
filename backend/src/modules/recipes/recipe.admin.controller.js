import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  recordAdminAuditEvent,
} from '../admin/adminAudit.service.js'

import {
  createAdminRecipe,
  createAdminRecipeImageUploadIntent,
  createNextAdminRecipeVersion,
  getAdminRecipeVersion,
  listAdminRecipes,
  updateAdminRecipeDraft,
  updateAdminRecipeHeroImage,
} from './recipe.admin.service.js'

import {
  adminDishIdParamsSchema,
  adminRecipeVersionIdParamsSchema,
  createAdminRecipeSchema,
  createNextRecipeVersionSchema,
  listAdminRecipesQuerySchema,
  updateAdminRecipeDraftSchema,
  updateAdminRecipeImageSchema,
} from './recipe.admin.validation.js'

import {
  changeDishLifecycle,
  changeRecipeVersionLifecycle,
  publishRecipeVersion,
  reviewRecipeVersion,
  submitRecipeVersionForReview,
} from './recipe.governance.service.js'

import {
  changeDishLifecycleSchema,
  changeRecipeVersionLifecycleSchema,
  publishRecipeVersionSchema,
  reviewRecipeVersionSchema,
  submitRecipeForReviewSchema,
} from './recipe.governance.validation.js'

function parseOrThrow(
  schema,
  input,
) {
  const result =
    schema.safeParse(
      input,
    )

  if (
    !result.success
  ) {
    throw new ApiError(
      400,
      'Invalid Recipe administration request.',
      result.error.issues.map(
        (
          issue,
        ) => ({
          code:
            'VALIDATION_ERROR',

          field:
            issue.path.join(
              '.',
            ),

          message:
            issue.message,
        }),
      ),
    )
  }

  return result.data
}

function governanceAuditContext(
  req,
) {
  return {
    adminAuthorization:
      req.adminAuthorization,

    requestId:
      req.requestId,
  }
}

async function recordRecipeDraftAudit({
  req,
  entityType,
  entityId,
  reasonDetails,
  beforeSnapshot,
  afterSnapshot,
  operation,
}) {
  await recordAdminAuditEvent({
    actorUser:
      req.currentUser,

    adminAuthorization:
      req.adminAuthorization,

    action:
      'recipe.mutate',

    permissionKey:
      'recipe.mutate',

    entityType,

    entityId:
      String(
        entityId,
      ),

    reasonCode:
      'recipe.governance',

    reasonDetails,

    beforeSnapshot,

    afterSnapshot,

    metadata: {
      operation,
    },

    requestId:
      req.requestId,
  })
}


/*
|--------------------------------------------------------------------------
| Recipe Image Upload Intent
|--------------------------------------------------------------------------
*/

export async function createAdminRecipeImageUploadIntentController(
  req,
  res,
) {
  const uploadIntent =
    createAdminRecipeImageUploadIntent(
      req.currentUser,
    )

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        'Recipe image upload intent created successfully.',

      data: {
        uploadIntent,
      },
    })
}

/*
|--------------------------------------------------------------------------
| Recipe Hero Image
|--------------------------------------------------------------------------
*/

export async function updateAdminRecipeHeroImageController(
  req,
  res,
) {
  const {
    dishId,
  } =
    parseOrThrow(
      adminDishIdParamsSchema,
      req.params,
    )

  const input =
    parseOrThrow(
      updateAdminRecipeImageSchema,
      req.body,
    )

  const result =
    await updateAdminRecipeHeroImage(
      dishId,
      input.heroImageUrl,
      req.currentUser,
    )

  await recordRecipeDraftAudit({
    req,

    entityType:
      'dish',

    entityId:
      dishId,

    reasonDetails:
      input.heroImageUrl
        ? 'Recipe hero image updated.'
        : 'Recipe hero image removed.',

    beforeSnapshot: {
      heroImageUrl:
        result.previousHeroImageUrl,
    },

    afterSnapshot: {
      heroImageUrl:
        result.dish.heroImageUrl,
    },

    operation:
      'recipe_image_update',
  })

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        'Recipe hero image updated successfully.',

      data: {
        dish:
          result.dish,
      },
    })
}

/*
|--------------------------------------------------------------------------
| Browse
|--------------------------------------------------------------------------
*/

export async function listAdminRecipesController(
  req,
  res,
) {
  const query =
    parseOrThrow(
      listAdminRecipesQuerySchema,
      req.query,
    )

  const data =
    await listAdminRecipes(
      query,
    )

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        'Administrative Recipes loaded successfully.',

      data,
    })
}

/*
|--------------------------------------------------------------------------
| Create Recipe v1
|--------------------------------------------------------------------------
*/

export async function createAdminRecipeController(
  req,
  res,
) {
  const input =
    parseOrThrow(
      createAdminRecipeSchema,
      req.body,
    )

  const data =
    await createAdminRecipe(
      input,
      req.currentUser,
    )

  await recordRecipeDraftAudit({
    req,

    entityType:
      'recipe_version',

    entityId:
      data.recipeVersion.id,

    reasonDetails:
      'Recipe v1 draft created.',

    beforeSnapshot:
      null,

    afterSnapshot: {
      dish:
        data.dish,

      recipeVersion:
        data.recipeVersion,
    },

    operation:
      'recipe_create',
  })

  return res
    .status(
      201,
    )
    .json({
      success:
        true,

      message:
        'Recipe draft created successfully.',

      data,
    })
}

/*
|--------------------------------------------------------------------------
| Version Detail
|--------------------------------------------------------------------------
*/

export async function getAdminRecipeVersionController(
  req,
  res,
) {
  const {
    versionId,
  } =
    parseOrThrow(
      adminRecipeVersionIdParamsSchema,
      req.params,
    )

  const data =
    await getAdminRecipeVersion(
      versionId,
    )

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        'Recipe Version loaded successfully.',

      data,
    })
}

/*
|--------------------------------------------------------------------------
| Draft Update
|--------------------------------------------------------------------------
*/

export async function updateAdminRecipeDraftController(
  req,
  res,
) {
  const {
    versionId,
  } =
    parseOrThrow(
      adminRecipeVersionIdParamsSchema,
      req.params,
    )

  const input =
    parseOrThrow(
      updateAdminRecipeDraftSchema,
      req.body,
    )

  const before =
    await getAdminRecipeVersion(
      versionId,
    )

  const data =
    await updateAdminRecipeDraft(
      versionId,
      input,
      req.currentUser,
    )

  await recordRecipeDraftAudit({
    req,

    entityType:
      'recipe_version',

    entityId:
      versionId,

    reasonDetails:
      'Recipe draft content updated.',

    beforeSnapshot:
      before,

    afterSnapshot:
      data,

    operation:
      'recipe_draft_update',
  })

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        'Recipe draft updated successfully.',

      data,
    })
}

/*
|--------------------------------------------------------------------------
| Next Version
|--------------------------------------------------------------------------
*/

export async function createNextAdminRecipeVersionController(
  req,
  res,
) {
  const {
    dishId,
  } =
    parseOrThrow(
      adminDishIdParamsSchema,
      req.params,
    )

  const input =
    parseOrThrow(
      createNextRecipeVersionSchema,
      req.body,
    )

  const data =
    await createNextAdminRecipeVersion(
      dishId,
      input,
      req.currentUser,
    )

  await recordRecipeDraftAudit({
    req,

    entityType:
      'recipe_version',

    entityId:
      data.recipeVersion.id,

    reasonDetails:
      input.changeReason,

    beforeSnapshot:
      null,

    afterSnapshot:
      data,

    operation:
      'recipe_next_version_create',
  })

  return res
    .status(
      201,
    )
    .json({
      success:
        true,

      message:
        'Next Recipe Version created successfully.',

      data,
    })
}

/*
|--------------------------------------------------------------------------
| Review Submission
|--------------------------------------------------------------------------
*/

export async function submitAdminRecipeForReviewController(
  req,
  res,
) {
  const {
    versionId,
  } =
    parseOrThrow(
      adminRecipeVersionIdParamsSchema,
      req.params,
    )

  const input =
    parseOrThrow(
      submitRecipeForReviewSchema,
      req.body,
    )

  const data =
    await submitRecipeVersionForReview(
      versionId,
      input,
      req.currentUser,
      governanceAuditContext(
        req,
      ),
    )

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        'Recipe submitted for review successfully.',

      data,
    })
}

/*
|--------------------------------------------------------------------------
| Review Decision
|--------------------------------------------------------------------------
*/

export async function reviewAdminRecipeVersionController(
  req,
  res,
) {
  const {
    versionId,
  } =
    parseOrThrow(
      adminRecipeVersionIdParamsSchema,
      req.params,
    )

  const input =
    parseOrThrow(
      reviewRecipeVersionSchema,
      req.body,
    )

  const data =
    await reviewRecipeVersion(
      versionId,
      input,
      req.currentUser,
      governanceAuditContext(
        req,
      ),
    )

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        'Recipe review recorded successfully.',

      data,
    })
}

/*
|--------------------------------------------------------------------------
| Publish
|--------------------------------------------------------------------------
*/

export async function publishAdminRecipeVersionController(
  req,
  res,
) {
  const {
    versionId,
  } =
    parseOrThrow(
      adminRecipeVersionIdParamsSchema,
      req.params,
    )

  const input =
    parseOrThrow(
      publishRecipeVersionSchema,
      req.body,
    )

  const data =
    await publishRecipeVersion(
      versionId,
      input,
      req.currentUser,
      governanceAuditContext(
        req,
      ),
    )

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        'Recipe published successfully.',

      data,
    })
}

/*
|--------------------------------------------------------------------------
| Recipe Version Lifecycle
|--------------------------------------------------------------------------
*/

export async function changeAdminRecipeVersionLifecycleController(
  req,
  res,
) {
  const {
    versionId,
  } =
    parseOrThrow(
      adminRecipeVersionIdParamsSchema,
      req.params,
    )

  const input =
    parseOrThrow(
      changeRecipeVersionLifecycleSchema,
      req.body,
    )

  const data =
    await changeRecipeVersionLifecycle(
      versionId,
      input,
      req.currentUser,
      governanceAuditContext(
        req,
      ),
    )

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        'Recipe Version lifecycle updated successfully.',

      data,
    })
}

/*
|--------------------------------------------------------------------------
| Dish Lifecycle
|--------------------------------------------------------------------------
*/

export async function changeAdminDishLifecycleController(
  req,
  res,
) {
  const {
    dishId,
  } =
    parseOrThrow(
      adminDishIdParamsSchema,
      req.params,
    )

  const input =
    parseOrThrow(
      changeDishLifecycleSchema,
      req.body,
    )

  const data =
    await changeDishLifecycle(
      dishId,
      input,
      req.currentUser,
      governanceAuditContext(
        req,
      ),
    )

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        'Dish lifecycle updated successfully.',

      data,
    })
}