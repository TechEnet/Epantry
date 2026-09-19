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
  RETAIL_MEDIA_PLACEMENTS,
} from '../retailMedia/retailMedia.models.js'

import {
  CREATOR_SESSION_ACCESS_TYPES,
} from './expansionExecution.models.js'

import {
  bookCreatorSession,
  cancelCreatorBooking,
  createCreatorSession,
  decideSafeSponsoredPlacement,
  listMyCreatorBookings,
  listMyCreatorSessions,
  listPublicCreatorSessions,
  publishCreatorSession,
  recordCreatorAttendance,
  verifyCreatorBookingPayment,
} from './expansionExecution.service.js'

const router =
  Router()

const objectIdSchema =
  z
    .string()
    .trim()
    .regex(
      /^[a-f\d]{24}$/i,
      'A valid MongoDB ObjectId is required.',
    )

const idempotencySchema =
  z
    .string()
    .trim()
    .min(
      8,
    )
    .max(
      180,
    )

const safeSponsoredDecisionSchema =
  z
    .object({
      searchSessionId:
        objectIdSchema,

      placement:
        z.enum(
          RETAIL_MEDIA_PLACEMENTS,
        ),

      marketCode:
        z
          .string()
          .trim()
          .min(
            2,
          )
          .max(
            10,
          )
          .transform(
            (
              value,
            ) =>
              value.toUpperCase(),
          )
          .default(
            'IN',
          ),

      pincode:
        z
          .string()
          .trim()
          .min(
            3,
          )
          .max(
            20,
          )
          .optional(),

      fulfillmentType:
        z
          .string()
          .trim()
          .max(
            80,
          )
          .optional(),
    })
    .strict()

const creatorSessionSchema =
  z
    .object({
      courseId:
        objectIdSchema,

      title:
        z
          .string()
          .trim()
          .min(
            2,
          )
          .max(
            220,
          ),

      summary:
        z
          .string()
          .trim()
          .max(
            5000,
          )
          .default(
            '',
          ),

      startsAt:
        z.coerce.date(),

      endsAt:
        z.coerce.date(),

      timezone:
        z
          .string()
          .trim()
          .min(
            2,
          )
          .max(
            120,
          )
          .default(
            'Asia/Kolkata',
          ),

      capacity:
        z
          .number()
          .int()
          .min(
            1,
          )
          .max(
            10000,
          ),

      accessType:
        z.enum(
          CREATOR_SESSION_ACCESS_TYPES,
        ),

      priceMinor:
        z
          .number()
          .int()
          .min(
            0,
          )
          .default(
            0,
          ),

      currency:
        z
          .string()
          .trim()
          .length(
            3,
          )
          .transform(
            (
              value,
            ) =>
              value.toUpperCase(),
          )
          .default(
            'INR',
          ),

      cancellationCutoffMinutes:
        z
          .number()
          .int()
          .min(
            0,
          )
          .max(
            10080,
          )
          .default(
            120,
          ),

      commercialDisclosure:
        z
          .string()
          .trim()
          .max(
            3000,
          )
          .default(
            '',
          ),
    })
    .strict()
    .superRefine(
      (
        value,
        context,
      ) => {
        if (
          value.endsAt <=
          value.startsAt
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode
                .custom,

            path: [
              'endsAt',
            ],

            message:
              'Session must end after it starts.',
          })
        }

        if (
          value.accessType ===
            'paid' &&
          value.priceMinor <=
            0
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode
                .custom,

            path: [
              'priceMinor',
            ],

            message:
              'Paid session requires a positive price.',
          })
        }

        if (
          value.accessType !==
            'paid' &&
          value.priceMinor !==
            0
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode
                .custom,

            path: [
              'priceMinor',
            ],

            message:
              'Free or entitled sessions cannot carry a payable price.',
          })
        }
      },
    )

const paymentVerificationSchema =
  z
    .object({
      providerOrderId:
        z
          .string()
          .trim()
          .min(
            1,
          )
          .max(
            240,
          ),

      providerPaymentId:
        z
          .string()
          .trim()
          .min(
            1,
          )
          .max(
            240,
          ),

      signature:
        z
          .string()
          .trim()
          .min(
            10,
          )
          .max(
            500,
          ),
    })
    .strict()

const reasonSchema =
  z
    .object({
      reason:
        z
          .string()
          .trim()
          .min(
            10,
          )
          .max(
            4000,
          ),
    })
    .strict()

const listSchema =
  z
    .object({
      limit:
        z.coerce
          .number()
          .int()
          .min(
            1,
          )
          .max(
            100,
          )
          .default(
            50,
          ),
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

function requireIdempotencyKey(req) {
  return parseOrThrow(
    idempotencySchema,

    req.get(
      'idempotency-key',
    ),

    'M22_CREATOR_BOOKING_IDEMPOTENCY_REQUIRED',

    'A valid Idempotency-Key header is required.',
  )
}

function wrap(handler) {
  return async function expansionExecutionController(
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

function send(
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

const customerSecurity = [
  sensitiveResponseNoStoreMiddleware,
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireCustomerAccess,
]

/*
| Product / Recipe sponsored units are Customer-context only because the
| deterministic organic SearchSession belongs to the authenticated Customer.
| activeMode is never authorization authority.
*/

router.post(
  '/retail-media/safe-decision',

  ...customerSecurity,

  requireCsrfToken,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          safeSponsoredDecisionSchema,

          req.body,

          'M22_SAFE_SPONSORED_INPUT_INVALID',

          'Invalid safe sponsored-decision context.',
        )

      return send(
        req,
        res,
        200,

        await decideSafeSponsoredPlacement({
          input,

          actorUser:
            req.currentUser,
        }),

        'Safe Product/Recipe sponsored decision completed after organic and food-safety eligibility.',
      )
    },
  ),
)

router.get(
  '/creator-sessions',

  ...customerSecurity,

  wrap(
    async (
      req,
      res,
    ) => {
      const query =
        parseOrThrow(
          listSchema,

          req.query,

          'M22_CREATOR_SESSION_LIST_INVALID',

          'Invalid Creator session list query.',
        )

      return send(
        req,
        res,
        200,

        await listPublicCreatorSessions({
          limit:
            query.limit,
        }),

        'Creator sessions loaded.',
      )
    },
  ),
)

router.get(
  '/creator-sessions/mine',

  ...customerSecurity,

  wrap(
    async (
      req,
      res,
    ) =>
      send(
        req,
        res,
        200,

        await listMyCreatorSessions({
          actorUser:
            req.currentUser,
        }),

        'Creator-owned sessions loaded.',
      ),
  ),
)

router.get(
  '/creator-bookings/mine',

  ...customerSecurity,

  wrap(
    async (
      req,
      res,
    ) =>
      send(
        req,
        res,
        200,

        await listMyCreatorBookings({
          actorUser:
            req.currentUser,
        }),

        'Customer Creator-session bookings loaded.',
      ),
  ),
)

router.post(
  '/creator-sessions',

  ...customerSecurity,

  requireCsrfToken,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          creatorSessionSchema,

          req.body,

          'M22_CREATOR_SESSION_INPUT_INVALID',

          'Invalid Creator session input.',
        )

      return send(
        req,
        res,
        201,

        await createCreatorSession({
          input,

          actorUser:
            req.currentUser,
        }),

        'Creator session draft created.',
      )
    },
  ),
)

router.post(
  '/creator-sessions/:sessionId/publish',

  ...customerSecurity,

  requireCsrfToken,

  wrap(
    async (
      req,
      res,
    ) => {
      const sessionId =
        parseOrThrow(
          objectIdSchema,

          req.params
            .sessionId,

          'M22_CREATOR_SESSION_ID_INVALID',

          'Invalid Creator session ID.',
        )

      return send(
        req,
        res,
        200,

        await publishCreatorSession({
          sessionId,

          actorUser:
            req.currentUser,
        }),

        'Creator session published after M15/M21 governance checks.',
      )
    },
  ),
)

router.post(
  '/creator-sessions/:sessionId/book',

  ...customerSecurity,

  requireCsrfToken,

  wrap(
    async (
      req,
      res,
    ) => {
      const sessionId =
        parseOrThrow(
          objectIdSchema,

          req.params
            .sessionId,

          'M22_CREATOR_SESSION_ID_INVALID',

          'Invalid Creator session ID.',
        )

      return send(
        req,
        res,
        201,

        await bookCreatorSession({
          sessionId,

          idempotencyKey:
            requireIdempotencyKey(
              req,
            ),

          actorUser:
            req.currentUser,
        }),

        'Creator session booking created from server-owned capacity and economics.',
      )
    },
  ),
)

router.post(
  '/creator-bookings/:bookingId/payment/verify',

  ...customerSecurity,

  requireCsrfToken,

  wrap(
    async (
      req,
      res,
    ) => {
      const bookingId =
        parseOrThrow(
          objectIdSchema,

          req.params
            .bookingId,

          'M22_CREATOR_BOOKING_ID_INVALID',

          'Invalid Creator booking ID.',
        )

      const input =
        parseOrThrow(
          paymentVerificationSchema,

          req.body,

          'M22_CREATOR_PAYMENT_VERIFICATION_INVALID',

          'Invalid hosted checkout verification payload.',
        )

      return send(
        req,
        res,
        200,

        await verifyCreatorBookingPayment({
          bookingId,

          input,

          actorUser:
            req.currentUser,
        }),

        'Creator booking checkout evidence verified.',
      )
    },
  ),
)

router.post(
  '/creator-bookings/:bookingId/cancel',

  ...customerSecurity,

  requireCsrfToken,

  wrap(
    async (
      req,
      res,
    ) => {
      const bookingId =
        parseOrThrow(
          objectIdSchema,

          req.params
            .bookingId,

          'M22_CREATOR_BOOKING_ID_INVALID',

          'Invalid Creator booking ID.',
        )

      const input =
        parseOrThrow(
          reasonSchema,

          req.body,

          'M22_CREATOR_BOOKING_CANCEL_INVALID',

          'Invalid Creator booking cancellation.',
        )

      return send(
        req,
        res,
        200,

        await cancelCreatorBooking({
          bookingId,

          reason:
            input.reason,

          actorUser:
            req.currentUser,
        }),

        'Creator booking cancellation recorded.',
      )
    },
  ),
)

router.post(
  '/creator-bookings/:bookingId/attendance',

  ...customerSecurity,

  requireCsrfToken,

  wrap(
    async (
      req,
      res,
    ) => {
      const bookingId =
        parseOrThrow(
          objectIdSchema,

          req.params
            .bookingId,

          'M22_CREATOR_BOOKING_ID_INVALID',

          'Invalid Creator booking ID.',
        )

      const input =
        parseOrThrow(
          reasonSchema,

          req.body,

          'M22_CREATOR_ATTENDANCE_INVALID',

          'Invalid attendance evidence.',
        )

      return send(
        req,
        res,
        200,

        await recordCreatorAttendance({
          bookingId,

          reason:
            input.reason,

          actorUser:
            req.currentUser,
        }),

        'Creator session attendance recorded.',
      )
    },
  ),
)

export default router