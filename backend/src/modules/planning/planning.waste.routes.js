import {
  Router,
} from 'express'

import {
  z,
} from 'zod'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  ApiResponse,
} from '../../utils/ApiResponse.js'

import {
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
} from '../auth/auth.middleware.js'

import {
  requireCustomerAccess,
} from '../auth/authorization.middleware.js'

import {
  getNextPossibility,
  getWasteReduction,
} from './planning.waste.service.js'

export const wasteReductionQuerySchema =
  z
    .object({
      horizonDays:
        z.coerce
          .number()
          .int()
          .min(
            1,
          )
          .max(
            30,
          )
          .default(
            7,
          ),
    })
    .strict()

function parseOrThrow(
  schema,
  value,
  code,
  fallbackMessage,
) {
  const result =
    schema.safeParse(
      value,
    )

  if (!result.success) {
    throw new ApiError(
      400,

      result.error
        .issues[0]
        ?.message ||
        fallbackMessage,

      [
        {
          code,
        },
      ],
    )
  }

  return result.data
}

function wrap(
  handler,
) {
  return async function wrappedPlanningWasteController(
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

const planningWasteRoutes =
  Router()

/*
|--------------------------------------------------------------------------
| M13 Part 3 Security Boundary
|--------------------------------------------------------------------------
|
| Customer capability is the authority for these Customer-facing read-only
| recommendation surfaces. `activeMode` is never consulted for authorization.
|
| Every Host retains Customer access through the existing Customer capability
| model. No Seller / Brand / B2B top-level role logic exists here.
|
*/

planningWasteRoutes.use(
  [
    '/waste-reduction',
    '/next-possibility',
  ],

  authenticateSession,

  loadCurrentUser,

  requireActiveAccount,

  requireCustomerAccess,
)

/*
|--------------------------------------------------------------------------
| Waste Reduction
|--------------------------------------------------------------------------
|
| GET only.
|
| This route does not mutate Pantry, Meal Plan, Cart, Checkout,
| Order or Payment state.
|
*/

planningWasteRoutes.get(
  '/waste-reduction',

  wrap(
    async (
      req,
      res,
    ) => {
      const query =
        parseOrThrow(
          wasteReductionQuerySchema,

          req.query,

          'WASTE_REDUCTION_QUERY_INVALID',

          'Invalid Waste Reduction request.',
        )

      return sendSuccess(
        req,

        res,

        await getWasteReduction({
          actorUser:
            req.currentUser,

          horizonDays:
            query.horizonDays,
        }),

        'Waste Reduction signals loaded successfully.',
      )
    },
  ),
)

/*
|--------------------------------------------------------------------------
| Next Possibility
|--------------------------------------------------------------------------
|
| Published-recipe recommendation only.
|
| No automatic Meal Plan change and no automatic commerce action
| is permitted.
|
*/

planningWasteRoutes.get(
  '/next-possibility',

  wrap(
    async (
      req,
      res,
    ) => {
      const query =
        parseOrThrow(
          wasteReductionQuerySchema,

          req.query,

          'NEXT_POSSIBILITY_QUERY_INVALID',

          'Invalid Next Possibility request.',
        )

      return sendSuccess(
        req,

        res,

        await getNextPossibility({
          actorUser:
            req.currentUser,

          horizonDays:
            query.horizonDays,
        }),

        'Next Possibility recommendations loaded successfully.',
      )
    },
  ),
)

export default planningWasteRoutes