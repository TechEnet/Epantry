import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  ApiResponse,
} from '../../utils/ApiResponse.js'

import {
  recipeCookedBodySchema,
  recipeCookedIdempotencySchema,
  recipeCookedParamsSchema,
} from './pantry.api.validation.js'

import {
  getRecipePantryReconciliation,
  recordRecipeCooked,
} from './pantry.recipe.service.js'

/*
|--------------------------------------------------------------------------
| Validation
|--------------------------------------------------------------------------
*/

function parseOrThrow(
  schema,
  value,
  code,
  message,
) {
  const result =
    schema.safeParse(
      value,
    )

  if (
    !result.success
  ) {
    throw new ApiError(
      400,
      result.error
        .issues[0]
        ?.message ||
        message,
      [
        {
          code,
        },
      ],
    )
  }

  return result.data
}

/*
|--------------------------------------------------------------------------
| Response
|--------------------------------------------------------------------------
*/

function sendSuccess(
  req,
  res,
  status,
  data,
  message,
) {
  return res
    .status(
      status,
    )
    .json(
      new ApiResponse(
        status,
        {
          ...data,

          requestId:
            req.requestId,
        },
        message,
      ),
    )
}

/*
|--------------------------------------------------------------------------
| Wrapper
|--------------------------------------------------------------------------
*/

function wrap(
  handler,
) {
  return async function wrappedPantryRecipeController(
    req,
    res,
    next,
  ) {
    try {
      return await handler(
        req,
        res,
      )
    } catch (error) {
      return next(
        error,
      )
    }
  }
}

/*
|--------------------------------------------------------------------------
| GET /recipes/:id/pantry
|--------------------------------------------------------------------------
|
| Useful bridge for Part 5 Recipe Detail quick actions.
|
| This remains a Pantry-derived status projection, NOT M10 Outcome Plan.
|
*/

export const getRecipePantryReconciliationController =
  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          recipeCookedParamsSchema,
          req.params,
          'PANTRY_RECIPE_ID_INVALID',
          'Invalid Recipe ID.',
        )

      const body =
        parseOrThrow(
          recipeCookedBodySchema,
          {
            targetServings:
              req.query
                .targetServings,
          },
          'PANTRY_RECIPE_RECONCILIATION_INVALID',
          'Invalid Recipe Pantry reconciliation request.',
        )

      const data =
        await getRecipePantryReconciliation({
          recipeId:
            id,

          targetServings:
            body.targetServings,

          actorUser:
            req.currentUser,
        })

      return sendSuccess(
        req,
        res,
        200,
        data,
        'Recipe Pantry availability recalculated successfully.',
      )
    },
  )

/*
|--------------------------------------------------------------------------
| POST /recipes/:id/cooked
|--------------------------------------------------------------------------
*/

export const recordRecipeCookedController =
  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          recipeCookedParamsSchema,
          req.params,
          'PANTRY_RECIPE_ID_INVALID',
          'Invalid Recipe ID.',
        )

      const input =
        parseOrThrow(
          recipeCookedBodySchema,
          req.body,
          'PANTRY_RECIPE_COOKED_INVALID',
          'Invalid cooked Recipe request.',
        )

      const idempotencyKey =
        parseOrThrow(
          recipeCookedIdempotencySchema,
          req.get(
            'idempotency-key',
          ),
          'PANTRY_IDEMPOTENCY_KEY_INVALID',
          'A valid Idempotency-Key header is required.',
        )

      const data =
        await recordRecipeCooked({
          recipeId:
            id,

          targetServings:
            input.targetServings,

          occurredAt:
            input.occurredAt ||
            new Date(),

          idempotencyKey,

          actorUser:
            req.currentUser,
        })

      return sendSuccess(
        req,
        res,
        201,
        data,
        'Recipe cooked event recorded successfully.',
      )
    },
  )