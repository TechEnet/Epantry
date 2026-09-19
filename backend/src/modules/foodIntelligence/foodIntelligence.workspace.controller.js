import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  ApiResponse,
} from '../../utils/ApiResponse.js'

import {
  foodIntelligenceWorkspaceListQuerySchema,
} from './foodIntelligence.workspace.validation.js'

import {
  listFoodCalculations,
  listFoodIngredientRelations,
  listFoodRuleProfiles,
} from './foodIntelligence.workspace.service.js'

/*
|--------------------------------------------------------------------------
| Parse
|--------------------------------------------------------------------------
*/

function parseQuery(
  query,
) {
  const result =
    foodIntelligenceWorkspaceListQuerySchema.safeParse(
      query,
    )

  if (
    !result.success
  ) {
    throw new ApiError(
      400,
      'Invalid Food Intelligence workspace query.',
      result.error.issues.map(
        (
          issue,
        ) => ({
          code:
            'FOOD_INTELLIGENCE_WORKSPACE_QUERY_INVALID',

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
  return async function wrappedWorkspaceController(
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
| Mappings
|--------------------------------------------------------------------------
*/

export const listFoodIngredientRelationsController =
  wrap(
    async (
      req,
      res,
    ) => {
      const query =
        parseQuery(
          req.query,
        )

      const result =
        await listFoodIngredientRelations(
          query,
        )

      return sendSuccess(
        req,
        res,
        result,
        'Food ingredient mappings loaded',
      )
    },
  )

/*
|--------------------------------------------------------------------------
| Rules
|--------------------------------------------------------------------------
*/

export const listFoodRuleProfilesController =
  wrap(
    async (
      req,
      res,
    ) => {
      const query =
        parseQuery(
          req.query,
        )

      const result =
        await listFoodRuleProfiles(
          query,
        )

      return sendSuccess(
        req,
        res,
        result,
        'Food rule profiles loaded',
      )
    },
  )

/*
|--------------------------------------------------------------------------
| Calculations
|--------------------------------------------------------------------------
*/

export const listFoodCalculationsController =
  wrap(
    async (
      req,
      res,
    ) => {
      const query =
        parseQuery(
          req.query,
        )

      const result =
        await listFoodCalculations(
          query,
        )

      return sendSuccess(
        req,
        res,
        result,
        'Food Intelligence calculations loaded',
      )
    },
  )