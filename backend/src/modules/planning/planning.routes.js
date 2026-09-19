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
  requireCsrfToken,
} from '../auth/auth.middleware.js'

import {
  requireCustomerAccess,
} from '../auth/authorization.middleware.js'

import {
  MEAL_TYPES,
  PLANNED_MEAL_STATUSES,
  RECOMMENDATION_FEEDBACK_ACTIONS,
} from './planning.models.js'

import {
  addPlannedMeal,
  createMealPlan,
  deleteMealPlan,
  getMealPlan,
  getNextBasket,
  getRecommendationPreferences,
  listMealPlans,
  submitNextBasketFeedback,
  updatePlannedMeal,
  updateRecommendationPreferences,
} from './planning.service.js'

const objectIdSchema =
  z
    .string()
    .trim()
    .regex(
      /^[a-f\d]{24}$/i,
      'A valid MongoDB ObjectId is required.',
    )

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

const exactQuantitySchema =
  z
    .object({
      mode:
        z.literal(
          'exact',
        ),

      value:
        z
          .number()
          .finite()
          .min(
            0,
          ),

      unit:
        z
          .string()
          .trim()
          .min(
            1,
          )
          .max(
            40,
          ),
    })
    .strict()

export const createMealPlanBodySchema =
  z
    .object({
      title:
        z
          .string()
          .trim()
          .min(
            1,
          )
          .max(
            140,
          )
          .optional(),

      horizonStart:
        z.coerce
          .date()
          .optional(),

      horizonEnd:
        z.coerce
          .date()
          .optional(),
    })
    .strict()

export const addPlannedMealBodySchema =
  z
    .object({
      recipeSlug:
        z
          .string()
          .trim()
          .min(
            1,
          )
          .max(
            180,
          ),

      plannedAt:
        z.coerce.date(),

      mealType:
        z.enum(
          MEAL_TYPES,
        ),

      servings:
        z.coerce
          .number()
          .int()
          .min(
            1,
          )
          .max(
            100,
          ),

      priority:
        z.coerce
          .number()
          .int()
          .min(
            1,
          )
          .max(
            5,
          )
          .default(
            3,
          ),
    })
    .strict()

export const updatePlannedMealBodySchema =
  z
    .object({
      plannedAt:
        z.coerce
          .date()
          .optional(),

      mealType:
        z
          .enum(
            MEAL_TYPES,
          )
          .optional(),

      servings:
        z.coerce
          .number()
          .int()
          .min(
            1,
          )
          .max(
            100,
          )
          .optional(),

      priority:
        z.coerce
          .number()
          .int()
          .min(
            1,
          )
          .max(
            5,
          )
          .optional(),

      status:
        z
          .enum(
            PLANNED_MEAL_STATUSES,
          )
          .optional(),
    })
    .strict()
    .refine(
      (
        value,
      ) =>
        Object.keys(
          value,
        ).length >
        0,
      {
        message:
          'Planned Meal update requires at least one actual change.',
      },
    )

export const recommendationFeedbackBodySchema =
  z
    .object({
      action:
        z.enum(
          RECOMMENDATION_FEEDBACK_ACTIONS,
        ),

      quantity:
        exactQuantitySchema
          .optional(),

      brandId:
        objectIdSchema
          .optional(),

      snoozeUntil:
        z.coerce
          .date()
          .optional(),

      note:
        z
          .string()
          .trim()
          .min(
            1,
          )
          .max(
            500,
          )
          .optional(),
    })
    .strict()
    .superRefine(
      (
        value,
        ctx,
      ) => {
        if (
          [
            'correct',
            'change_quantity',
          ].includes(
            value.action,
          ) &&
          !value.quantity
        ) {
          ctx.addIssue({
            code:
              z.ZodIssueCode
                .custom,

            path: [
              'quantity',
            ],

            message:
              'This feedback action requires an explicit quantity.',
          })
        }

        if (
          value.action ===
            'change_brand' &&
          !value.brandId
        ) {
          ctx.addIssue({
            code:
              z.ZodIssueCode
                .custom,

            path: [
              'brandId',
            ],

            message:
              'Change-brand feedback requires a canonical Brand ID.',
          })
        }

        if (
          value.action ===
          'snooze'
        ) {
          if (
            !value.snoozeUntil
          ) {
            ctx.addIssue({
              code:
                z.ZodIssueCode
                  .custom,

              path: [
                'snoozeUntil',
              ],

              message:
                'Snooze feedback requires snoozeUntil.',
            })
          } else if (
            value.snoozeUntil <=
            new Date()
          ) {
            ctx.addIssue({
              code:
                z.ZodIssueCode
                  .custom,

              path: [
                'snoozeUntil',
              ],

              message:
                'snoozeUntil must be in the future.',
            })
          }
        }
      },
    )

export const recommendationPreferencePatchSchema =
  z
    .object({
      nextBasketEnabled:
        z
          .boolean()
          .optional(),

      pausedUntil:
        z.coerce
          .date()
          .nullable()
          .optional(),

      notificationFrequency:
        z
          .enum([
            'off',
            'important_only',
            'daily',
            'weekly',
          ])
          .optional(),
    })
    .strict()
    .refine(
      (
        value,
      ) =>
        Object.keys(
          value,
        ).length >
        0,
      {
        message:
          'Recommendation preferences require at least one actual change.',
      },
    )

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

  if (
    !result.success
  ) {
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

function requireIdempotencyKey(
  req,
) {
  return parseOrThrow(
    idempotencyKeySchema,
    req.get(
      'idempotency-key',
    ),
    'PLANNING_IDEMPOTENCY_KEY_INVALID',
    'A valid Idempotency-Key header is required.',
  )
}

function wrap(
  handler,
) {
  return async function wrappedPlanningController(
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
  statusCode,
  data,
  message,
) {
  return res
    .status(
      statusCode,
    )
    .json(
      new ApiResponse(
        statusCode,
        {
          ...data,

          requestId:
            req.requestId,
        },
        message,
      ),
    )
}

const planningRoutes =
  Router()

planningRoutes.use(
  [
    '/meal-plans',
    '/planned-meals',
    '/next-basket',
  ],

  authenticateSession,

  loadCurrentUser,

  requireActiveAccount,

  requireCustomerAccess,
)

/*
|--------------------------------------------------------------------------
| P16 Meal Plan
|--------------------------------------------------------------------------
*/

planningRoutes.post(
  '/meal-plans',

  requireCsrfToken,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          createMealPlanBodySchema,
          req.body,
          'MEAL_PLAN_CREATE_INVALID',
          'Invalid Meal Plan request.',
        )

      return sendSuccess(
        req,
        res,
        201,
        await createMealPlan({
          input,

          idempotencyKey:
            requireIdempotencyKey(
              req,
            ),

          actorUser:
            req.currentUser,
        }),
        'Meal Plan created successfully.',
      )
    },
  ),
)

planningRoutes.get(
  '/meal-plans',

  wrap(
    async (
      req,
      res,
    ) =>
      sendSuccess(
        req,
        res,
        200,
        await listMealPlans({
          actorUser:
            req.currentUser,
        }),
        'Meal Plans loaded successfully.',
      ),
  ),
)

planningRoutes.get(
  '/meal-plans/:id',

  wrap(
    async (
      req,
      res,
    ) => {
      const mealPlanId =
        parseOrThrow(
          objectIdSchema,
          req.params.id,
          'MEAL_PLAN_ID_INVALID',
          'Invalid Meal Plan ID.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await getMealPlan({
          mealPlanId,

          actorUser:
            req.currentUser,
        }),
        'Meal Plan loaded successfully.',
      )
    },
  ),
)

planningRoutes.delete(
  '/meal-plans/:id',

  requireCsrfToken,

  wrap(
    async (
      req,
      res,
    ) => {
      const mealPlanId =
        parseOrThrow(
          objectIdSchema,
          req.params.id,
          'MEAL_PLAN_ID_INVALID',
          'Invalid Meal Plan ID.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await deleteMealPlan({
          mealPlanId,

          actorUser:
            req.currentUser,
        }),
        'Meal Plan deleted successfully.',
      )
    },
  ),
)

planningRoutes.post(
  '/meal-plans/:id/meals',

  requireCsrfToken,

  wrap(
    async (
      req,
      res,
    ) => {
      const mealPlanId =
        parseOrThrow(
          objectIdSchema,
          req.params.id,
          'MEAL_PLAN_ID_INVALID',
          'Invalid Meal Plan ID.',
        )

      const input =
        parseOrThrow(
          addPlannedMealBodySchema,
          req.body,
          'PLANNED_MEAL_CREATE_INVALID',
          'Invalid Planned Meal request.',
        )

      return sendSuccess(
        req,
        res,
        201,
        await addPlannedMeal({
          mealPlanId,

          input,

          idempotencyKey:
            requireIdempotencyKey(
              req,
            ),

          actorUser:
            req.currentUser,
        }),
        'Planned Meal added successfully.',
      )
    },
  ),
)

planningRoutes.patch(
  '/planned-meals/:id',

  requireCsrfToken,

  wrap(
    async (
      req,
      res,
    ) => {
      const plannedMealId =
        parseOrThrow(
          objectIdSchema,
          req.params.id,
          'PLANNED_MEAL_ID_INVALID',
          'Invalid Planned Meal ID.',
        )

      const input =
        parseOrThrow(
          updatePlannedMealBodySchema,
          req.body,
          'PLANNED_MEAL_UPDATE_INVALID',
          'Invalid Planned Meal update.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await updatePlannedMeal({
          plannedMealId,

          input,

          actorUser:
            req.currentUser,
        }),
        'Planned Meal updated successfully.',
      )
    },
  ),
)

/*
|--------------------------------------------------------------------------
| P17 Next Basket
|--------------------------------------------------------------------------
|
| Recommendation only.
|
| No Cart / Checkout / Order / Payment authority exists here.
|
*/

planningRoutes.get(
  '/next-basket',

  wrap(
    async (
      req,
      res,
    ) =>
      sendSuccess(
        req,
        res,
        200,
        await getNextBasket({
          actorUser:
            req.currentUser,
        }),
        'Next Basket loaded successfully.',
      ),
  ),
)

planningRoutes.post(
  '/next-basket/:id/feedback',

  requireCsrfToken,

  wrap(
    async (
      req,
      res,
    ) => {
      const predictionId =
        parseOrThrow(
          objectIdSchema,
          req.params.id,
          'NEXT_BASKET_PREDICTION_ID_INVALID',
          'Invalid Next Basket suggestion ID.',
        )

      const input =
        parseOrThrow(
          recommendationFeedbackBodySchema,
          req.body,
          'NEXT_BASKET_FEEDBACK_INVALID',
          'Invalid Next Basket feedback.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await submitNextBasketFeedback({
          predictionId,

          input,

          idempotencyKey:
            requireIdempotencyKey(
              req,
            ),

          actorUser:
            req.currentUser,
        }),
        'Next Basket feedback recorded successfully.',
      )
    },
  ),
)

planningRoutes.get(
  '/next-basket/preferences',

  wrap(
    async (
      req,
      res,
    ) =>
      sendSuccess(
        req,
        res,
        200,
        await getRecommendationPreferences({
          actorUser:
            req.currentUser,
        }),
        'Next Basket preferences loaded successfully.',
      ),
  ),
)

planningRoutes.patch(
  '/next-basket/preferences',

  requireCsrfToken,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          recommendationPreferencePatchSchema,
          req.body,
          'NEXT_BASKET_PREFERENCES_INVALID',
          'Invalid Next Basket preferences.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await updateRecommendationPreferences({
          input,

          actorUser:
            req.currentUser,
        }),
        'Next Basket preferences updated successfully.',
      )
    },
  ),
)

export default planningRoutes