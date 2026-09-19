import {
  Router,
} from 'express'

import {
  z,
} from 'zod'

import {
  sensitiveResponseNoStoreMiddleware,
} from '../../middlewares/security.middleware.js'

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
  requireCsrfToken,
} from '../auth/auth.middleware.js'

import {
  requireCustomerAccess,
} from '../auth/authorization.middleware.js'

import {
  createRecipeOutcomePlan,
  getOutcomePlan,
  updateOutcomePlanRequirements,
} from './outcomePlan.service.js'

const objectIdSchema =
  z
    .string()
    .regex(
      /^[a-f\d]{24}$/i,
      'A valid MongoDB ObjectId is required.',
    )

const recipeIdentitySchema =
  z
    .string()
    .trim()
    .min(
      1,
    )
    .max(
      220,
    )

const targetServingsSchema =
  z.coerce
    .number()
    .finite()
    .positive()
    .max(
      1000,
    )

export const outcomePlanCreateBodySchema =
  z
    .object({
      recipeId:
        recipeIdentitySchema,

      targetServings:
        targetServingsSchema,
    })
    .strict()

export const recipeOutcomePlanBodySchema =
  z
    .object({
      targetServings:
        targetServingsSchema,

      purchaseMode:
        z
          .enum([
            'missing_only',
            'full_recipe',
          ])
          .optional(),

      selectedCanonicalIngredientIds:
        z
          .array(
            objectIdSchema,
          )
          .max(
            100,
          )
          .optional(),
    })
    .strict()

export const outcomePlanUpdateBodySchema =
  z
    .object({
      targetServings:
        targetServingsSchema
          .optional(),

      decisions:
        z
          .array(
            z
              .object({
                requirementLineId:
                  objectIdSchema,

                action:
                  z.enum([
                    'include_optional',
                    'exclude_optional',
                  ]),
              })
              .strict(),
          )
          .max(
            100,
          )
          .optional(),
    })
    .strict()
    .superRefine(
      (
        value,
        context,
      ) => {
        if (
          value.targetServings ===
            undefined &&
          (
            !Array.isArray(
              value.decisions,
            ) ||
            value.decisions.length ===
              0
          )
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            message:
              'At least one serving or optional requirement change is required.',
          })
        }
      },
    )

const planParamsSchema =
  z.object({
    id:
      objectIdSchema,
  })

const recipeParamsSchema =
  z.object({
    id:
      recipeIdentitySchema,
  })

const idempotencyKeySchema =
  z
    .string()
    .trim()
    .min(
      8,
      'Idempotency-Key must contain at least 8 characters.',
    )
    .max(
      160,
      'Idempotency-Key is too long.',
    )

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

function requireIdempotencyKey(
  req,
) {
  return parseOrThrow(
    idempotencyKeySchema,
    req.get(
      'idempotency-key',
    ),
    'OUTCOME_PLAN_IDEMPOTENCY_KEY_INVALID',
    'A valid Idempotency-Key header is required.',
  )
}

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

function wrap(
  handler,
) {
  return async function wrappedOutcomePlanController(
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
| Customer Outcome Plan Router
|--------------------------------------------------------------------------
|
| Host retains Customer capability and may therefore use normal Customer
| household features.
|
| There is no Host tenant bypass.
| There is no Super Admin household bypass.
| activeMode is not authorization.
|
*/

const outcomePlanRoutes =
  Router()

outcomePlanRoutes.use(
  sensitiveResponseNoStoreMiddleware,

  authenticateSession,

  loadCurrentUser,

  requireActiveAccount,

  requireCustomerAccess,
)

outcomePlanRoutes.post(
  '/',

  requireCsrfToken,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          outcomePlanCreateBodySchema,

          req.body,

          'OUTCOME_PLAN_CREATE_INVALID',

          'Invalid Outcome Plan request.',
        )

      const data =
        await createRecipeOutcomePlan({
          recipeId:
            input.recipeId,

          targetServings:
            input.targetServings,

          purchaseMode:
            input.purchaseMode ||
            'missing_only',

          selectedCanonicalIngredientIds:
            input.selectedCanonicalIngredientIds ||
            [],

          idempotencyKey:
            requireIdempotencyKey(
              req,
            ),

          actorUser:
            req.currentUser,
        })

      return sendSuccess(
        req,

        res,

        201,

        data,

        'Outcome Plan created successfully.',
      )
    },
  ),
)

outcomePlanRoutes.get(
  '/:id',

  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          planParamsSchema,

          req.params,

          'OUTCOME_PLAN_ID_INVALID',

          'Invalid Outcome Plan ID.',
        )

      const data =
        await getOutcomePlan({
          planId:
            id,

          actorUser:
            req.currentUser,
        })

      return sendSuccess(
        req,

        res,

        200,

        data,

        'Outcome Plan loaded successfully.',
      )
    },
  ),
)

outcomePlanRoutes.patch(
  '/:id/requirements',

  requireCsrfToken,

  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          planParamsSchema,

          req.params,

          'OUTCOME_PLAN_ID_INVALID',

          'Invalid Outcome Plan ID.',
        )

      const input =
        parseOrThrow(
          outcomePlanUpdateBodySchema,

          req.body,

          'OUTCOME_PLAN_REQUIREMENTS_INVALID',

          'Invalid Outcome Plan requirement update.',
        )

      const data =
        await updateOutcomePlanRequirements({
          planId:
            id,

          targetServings:
            input.targetServings,

          decisions:
            input.decisions ||
            [],

          idempotencyKey:
            requireIdempotencyKey(
              req,
            ),

          actorUser:
            req.currentUser,
        })

      return sendSuccess(
        req,

        res,

        200,

        data,

        'Outcome Plan recalculated successfully.',
      )
    },
  ),
)

/*
|--------------------------------------------------------------------------
| Recipe Convenience Route
|--------------------------------------------------------------------------
|
| Only:
|
| POST /api/v1/recipes/:id/outcome-plan
|
| is protected here.
|
| Existing M07 public Recipe routes remain public.
|
*/

const outcomePlanRecipeRoutes =
  Router()

outcomePlanRecipeRoutes.use(
  '/:id/outcome-plan',

  sensitiveResponseNoStoreMiddleware,

  authenticateSession,

  loadCurrentUser,

  requireActiveAccount,

  requireCustomerAccess,
)

outcomePlanRecipeRoutes.post(
  '/:id/outcome-plan',

  requireCsrfToken,

  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          recipeParamsSchema,

          req.params,

          'OUTCOME_PLAN_RECIPE_ID_INVALID',

          'Invalid Recipe identity.',
        )

      const input =
        parseOrThrow(
          recipeOutcomePlanBodySchema,

          req.body,

          'OUTCOME_PLAN_RECIPE_CREATE_INVALID',

          'Invalid Recipe Outcome Plan request.',
        )

      const data =
        await createRecipeOutcomePlan({
          recipeId:
            id,

          targetServings:
            input.targetServings,

          purchaseMode:
            input.purchaseMode ||
            'missing_only',

          selectedCanonicalIngredientIds:
            input.selectedCanonicalIngredientIds ||
            [],

          idempotencyKey:
            requireIdempotencyKey(
              req,
            ),

          actorUser:
            req.currentUser,
        })

      return sendSuccess(
        req,

        res,

        201,

        data,

        'Recipe Outcome Plan created successfully.',
      )
    },
  ),
)

export {
  outcomePlanRecipeRoutes,
  outcomePlanRoutes,
}