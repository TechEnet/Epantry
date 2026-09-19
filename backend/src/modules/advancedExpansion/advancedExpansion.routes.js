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
  requireCsrfToken,
} from '../auth/auth.middleware.js'

import {
  PANTRY_QUANTITY_UNITS,
} from '../pantry/pantry.constants.js'

import {
  RECEIPT_IMPORT_SOURCE_KINDS,
} from './advancedExpansion.models.js'

import {
  cancelReceiptImport,
  createReceiptImport,
  getAdvancedPlanningIntelligence,
  getHouseholdMemory,
  listReceiptImports,
  recordLeftover,
  requireM21AdvancedPantryFeature,
  reviewReceiptLine,
  updateMemoryFactControl,
} from './advancedExpansion.service.js'

const objectIdSchema =
  z
    .string()
    .trim()
    .regex(
      /^[a-f\d]{24}$/i,
      'A valid MongoDB ObjectId is required.',
    )

const receiptImportIdSchema =
  z
    .string()
    .trim()
    .min(8)
    .max(120)

const lineKeySchema =
  z
    .string()
    .trim()
    .min(1)
    .max(120)

const unknownQuantitySchema =
  z
    .object({
      mode:
        z.literal(
          'unknown',
        ),
    })
    .strict()

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
          .min(0),

      unit:
        z.enum(
          PANTRY_QUANTITY_UNITS,
        ),
    })
    .strict()

const receiptLineSchema =
  z
    .object({
      lineKey:
        lineKeySchema,

      label:
        z
          .string()
          .trim()
          .min(1)
          .max(240),

      barcode:
        z
          .string()
          .trim()
          .max(180)
          .default(''),

      quantity:
        z
          .union([
            exactQuantitySchema,
            unknownQuantitySchema,
          ])
          .default({
            mode:
              'unknown',
          }),
    })
    .strict()

const createReceiptImportBodySchema =
  z
    .object({
      sourceKind:
        z.enum(
          RECEIPT_IMPORT_SOURCE_KINDS,
        ),

      sourceArtifactRef:
        z
          .string()
          .trim()
          .max(500)
          .default(''),

      merchantLabel:
        z
          .string()
          .trim()
          .max(180)
          .default(''),

      market:
        z
          .string()
          .trim()
          .min(2)
          .max(10)
          .default('IN'),

      purchasedAt:
        z.coerce.date(),

      explicitImportAcknowledged:
        z.literal(
          true,
        ),

      lines:
        z
          .array(
            receiptLineSchema,
          )
          .min(1)
          .max(100),
    })
    .strict()

const receiptListQuerySchema =
  z
    .object({
      limit:
        z.coerce
          .number()
          .int()
          .min(1)
          .max(100)
          .default(50),
    })
    .strict()

const receiptParamsSchema =
  z
    .object({
      receiptImportId:
        receiptImportIdSchema,
    })
    .strict()

const receiptLineParamsSchema =
  z
    .object({
      receiptImportId:
        receiptImportIdSchema,

      lineKey:
        lineKeySchema,
    })
    .strict()

const receiptLineReviewBodySchema =
  z
    .object({
      action:
        z.enum([
          'apply',
          'exclude',
        ]),

      canonicalPackId:
        objectIdSchema
          .optional(),
    })
    .strict()
    .superRefine(
      (
        value,
        ctx,
      ) => {
        if (
          value.action ===
            'exclude' &&
          value.canonicalPackId
        ) {
          ctx.addIssue({
            code:
              z.ZodIssueCode
                .custom,

            path: [
              'canonicalPackId',
            ],

            message:
              'Excluded receipt lines cannot also select a canonical Pack.',
          })
        }
      },
    )

const memoryControlParamsSchema =
  z
    .object({
      memoryFactId:
        z
          .string()
          .trim()
          .min(8)
          .max(120),
    })
    .strict()

const memoryControlBodySchema =
  z
    .object({
      action:
        z.enum([
          'pause',
          'resume',
          'forget',
        ]),
    })
    .strict()

const leftoverBodySchema =
  z
    .object({
      eventKey:
        z
          .string()
          .trim()
          .min(8)
          .max(160),

      recipeVersionId:
        objectIdSchema,

      leftoverServings:
        z.coerce
          .number()
          .finite()
          .positive()
          .max(100),

      storageZone:
        z.enum([
          'fridge',
          'freezer',
          'other',
        ]),

      occurredAt:
        z.coerce
          .date()
          .optional(),

      useSoonAt:
        z.coerce.date(),

      note:
        z
          .string()
          .trim()
          .max(500)
          .default(''),
    })
    .strict()

const planningQuerySchema =
  z
    .object({
      horizonDays:
        z.coerce
          .number()
          .int()
          .min(1)
          .max(30)
          .default(7),
    })
    .strict()

function parseOrThrow(
  schema,
  value,
  code,
  fallbackMessage,
) {
  const parsed =
    schema.safeParse(
      value,
    )

  if (!parsed.success) {
    throw new ApiError(
      400,

      parsed.error
        .issues[0]
        ?.message ||
        fallbackMessage,

      [
        {
          code,

          issues:
            parsed.error.issues,
        },
      ],
    )
  }

  return parsed.data
}

function wrap(
  handler,
) {
  return async function wrappedAdvancedExpansionController(
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

function send(
  req,
  res,
  data,
  message,
  status = 200,
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

const advancedExpansionRoutes =
  Router()

advancedExpansionRoutes.use(
  async function requireAdvancedExpansionFeature(
    req,
    res,
    next,
  ) {
    try {
      await requireM21AdvancedPantryFeature()

      return next()
    } catch (
      error
    ) {
      return next(
        error,
      )
    }
  },
)

/*
|--------------------------------------------------------------------------
| Security Boundary
|--------------------------------------------------------------------------
|
| Parent:
|
| /api/v1/pantry
|
| already requires:
|
| authenticateSession
| loadCurrentUser
| requireActiveAccount
| requireCustomerAccess
|
| Host retains Customer access through the frozen shared identity model.
|
| activeMode is never authorization authority.
|
*/

advancedExpansionRoutes.get(
  '/receipt-imports',

  wrap(
    async (
      req,
      res,
    ) => {
      const query =
        parseOrThrow(
          receiptListQuerySchema,
          req.query,
          'M21_RECEIPT_LIST_QUERY_INVALID',
          'Invalid receipt-vault request.',
        )

      return send(
        req,
        res,

        await listReceiptImports({
          actorUser:
            req.currentUser,

          limit:
            query.limit,
        }),

        'Receipt and purchase evidence loaded.',
      )
    },
  ),
)

advancedExpansionRoutes.post(
  '/receipt-imports',

  requireCsrfToken,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          createReceiptImportBodySchema,
          req.body,
          'M21_RECEIPT_IMPORT_INVALID',
          'Invalid receipt import.',
        )

      return send(
        req,
        res,

        await createReceiptImport({
          input,

          actorUser:
            req.currentUser,
        }),

        'Receipt evidence imported for Customer review.',

        201,
      )
    },
  ),
)

advancedExpansionRoutes.post(
  '/receipt-imports/:receiptImportId/lines/:lineKey/review',

  requireCsrfToken,

  wrap(
    async (
      req,
      res,
    ) => {
      const params =
        parseOrThrow(
          receiptLineParamsSchema,
          req.params,
          'M21_RECEIPT_LINE_PARAMS_INVALID',
          'Invalid receipt-line reference.',
        )

      const input =
        parseOrThrow(
          receiptLineReviewBodySchema,
          req.body,
          'M21_RECEIPT_LINE_REVIEW_INVALID',
          'Invalid receipt-line review.',
        )

      return send(
        req,
        res,

        await reviewReceiptLine({
          receiptImportId:
            params.receiptImportId,

          lineKey:
            params.lineKey,

          input,

          actorUser:
            req.currentUser,
        }),

        'Receipt line review applied.',
      )
    },
  ),
)

advancedExpansionRoutes.post(
  '/receipt-imports/:receiptImportId/cancel',

  requireCsrfToken,

  wrap(
    async (
      req,
      res,
    ) => {
      const params =
        parseOrThrow(
          receiptParamsSchema,
          req.params,
          'M21_RECEIPT_PARAMS_INVALID',
          'Invalid receipt import reference.',
        )

      return send(
        req,
        res,

        await cancelReceiptImport({
          receiptImportId:
            params.receiptImportId,

          actorUser:
            req.currentUser,
        }),

        'Receipt import cancelled.',
      )
    },
  ),
)

advancedExpansionRoutes.get(
  '/memory',

  wrap(
    async (
      req,
      res,
    ) =>
      send(
        req,
        res,

        await getHouseholdMemory({
          actorUser:
            req.currentUser,
        }),

        'Household memory loaded.',
      ),
  ),
)

advancedExpansionRoutes.post(
  '/memory/:memoryFactId/control',

  requireCsrfToken,

  wrap(
    async (
      req,
      res,
    ) => {
      const params =
        parseOrThrow(
          memoryControlParamsSchema,
          req.params,
          'M21_MEMORY_PARAMS_INVALID',
          'Invalid household-memory reference.',
        )

      const input =
        parseOrThrow(
          memoryControlBodySchema,
          req.body,
          'M21_MEMORY_CONTROL_INVALID',
          'Invalid household-memory control.',
        )

      return send(
        req,
        res,

        await updateMemoryFactControl({
          memoryFactId:
            params.memoryFactId,

          action:
            input.action,

          actorUser:
            req.currentUser,
        }),

        'Household memory control updated.',
      )
    },
  ),
)

advancedExpansionRoutes.post(
  '/leftovers',

  requireCsrfToken,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          leftoverBodySchema,
          req.body,
          'M21_LEFTOVER_INPUT_INVALID',
          'Invalid leftover observation.',
        )

      return send(
        req,
        res,

        await recordLeftover({
          input,

          actorUser:
            req.currentUser,
        }),

        'Explicit leftover evidence recorded.',

        201,
      )
    },
  ),
)

advancedExpansionRoutes.get(
  '/planning',

  wrap(
    async (
      req,
      res,
    ) => {
      const query =
        parseOrThrow(
          planningQuerySchema,
          req.query,
          'M21_ADVANCED_PLANNING_QUERY_INVALID',
          'Invalid advanced-planning request.',
        )

      return send(
        req,
        res,

        await getAdvancedPlanningIntelligence({
          actorUser:
            req.currentUser,

          horizonDays:
            query.horizonDays,
        }),

        'Advanced household planning intelligence loaded.',
      )
    },
  ),
)

export default advancedExpansionRoutes