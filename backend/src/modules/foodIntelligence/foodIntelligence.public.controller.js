import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  ApiResponse,
} from '../../utils/ApiResponse.js'

import {
  productFoodIntelligenceParamsSchema,
  recipeFoodIntelligenceParamsSchema,
} from './foodIntelligence.public.validation.js'

import {
  getPublicProductFoodIntelligence,
  getPublicRecipeFoodIntelligence,
} from './foodIntelligence.public.service.js'

/*
|--------------------------------------------------------------------------
| Parse
|--------------------------------------------------------------------------
*/

function parseOrThrow(
  schema,
  value,
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
      'Invalid Food Intelligence request.',
      result.error.issues.map(
        (
          issue,
        ) => ({
          code:
            'FOOD_INTELLIGENCE_VALIDATION_ERROR',

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

/*
|--------------------------------------------------------------------------
| Response
|--------------------------------------------------------------------------
*/

function sendSuccess(
  req,
  res,
  data,
  message,
) {
  return res
    .status(
      200,
    )
    .json(
      new ApiResponse(
        200,
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
  return async function wrappedFoodIntelligenceController(
    req,
    res,
    next,
  ) {
    try {
      return await handler(
        req,
        res,
      )
    } catch (
      error
    ) {
      return next(
        error,
      )
    }
  }
}

/*
|--------------------------------------------------------------------------
| Product
|--------------------------------------------------------------------------
*/

export const getPublicProductFoodIntelligenceController =
  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          productFoodIntelligenceParamsSchema,
          req.params,
        )

      const foodIntelligence =
        await getPublicProductFoodIntelligence(
          id,
        )

      return sendSuccess(
        req,
        res,
        {
          foodIntelligence,
        },
        'Product Food Intelligence loaded',
      )
    },
  )

/*
|--------------------------------------------------------------------------
| Recipe
|--------------------------------------------------------------------------
*/

export const getPublicRecipeFoodIntelligenceController =
  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          recipeFoodIntelligenceParamsSchema,
          req.params,
        )

      const foodIntelligence =
        await getPublicRecipeFoodIntelligence(
          id,
        )

      return sendSuccess(
        req,
        res,
        {
          foodIntelligence,
        },
        'Recipe Food Intelligence loaded',
      )
    },
  )