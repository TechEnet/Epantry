import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  getPublicRecipe,
  getPublicRecipeHistory,
  getWhatShouldWeCook,
  generateAiCook,
  listPublicRecipes,
  scalePublicRecipe,
} from './recipe.public.service.js'

import {
  aiCookBodySchema,
  listPublicRecipesQuerySchema,
  publicRecipeHistoryQuerySchema,
  publicRecipeScaleQuerySchema,
  publicRecipeSlugParamsSchema,
  whatShouldWeCookQuerySchema,
} from './recipe.public.validation.js'

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
      'Invalid Recipe request.',
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

export async function listPublicRecipesController(
  req,
  res,
) {
  const query =
    parseOrThrow(
      listPublicRecipesQuerySchema,
      req.query,
    )

  const data =
    await listPublicRecipes(
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
        'Recipes loaded successfully.',

      data,
    })
}


export async function generateAiCookController(
  req,
  res,
) {
  const input =
    parseOrThrow(
      aiCookBodySchema,
      req.body,
    )

  const data =
    await generateAiCook(
      input,
    )

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        input.action ===
          'suggestions'
          ? 'AI cooking ideas generated successfully.'
          : 'AI recipe generated successfully.',

      data,
    })
}

export async function getWhatShouldWeCookController(
  req,
  res,
) {
  const query =
    parseOrThrow(
      whatShouldWeCookQuerySchema,
      req.query,
    )

  const data =
    await getWhatShouldWeCook(
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
        'Recipe suggestions loaded successfully.',

      data,
    })
}

export async function getPublicRecipeController(
  req,
  res,
) {
  const {
    slug,
  } =
    parseOrThrow(
      publicRecipeSlugParamsSchema,
      req.params,
    )

  const data =
    await getPublicRecipe(
      slug,
    )

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        'Recipe loaded successfully.',

      data,
    })
}

export async function getPublicRecipeHistoryController(
  req,
  res,
) {
  const {
    slug,
  } =
    parseOrThrow(
      publicRecipeSlugParamsSchema,
      req.params,
    )

  const query =
    parseOrThrow(
      publicRecipeHistoryQuerySchema,
      req.query,
    )

  const data =
    await getPublicRecipeHistory(
      slug,
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
        'Recipe history loaded successfully.',

      data,
    })
}

export async function scalePublicRecipeController(
  req,
  res,
) {
  const {
    slug,
  } =
    parseOrThrow(
      publicRecipeSlugParamsSchema,
      req.params,
    )

  const {
    servings,
  } =
    parseOrThrow(
      publicRecipeScaleQuerySchema,
      req.query,
    )

  const data =
    await scalePublicRecipe(
      slug,
      servings,
    )

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        'Recipe scaled successfully.',

      data,
    })
}