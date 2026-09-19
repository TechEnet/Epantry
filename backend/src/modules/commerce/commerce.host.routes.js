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
  requireMfaAssurance,
} from '../auth/auth.middleware.js'

import {
  requireHostAccess,
} from '../auth/authorization.middleware.js'

import {
  getHostCommercePolicy,
  getHostSellerOrder,
  listHostSellerOrders,
  saveHostCommercePolicy,
  updateHostSellerOrderStatus,
} from './commerce.final.service.js'

const objectIdSchema =
  z
    .string()
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
    )
    .max(
      160,
    )

export const hostCommercePolicyBodySchema =
  z
    .object({
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

      deliveryFeeMinor:
        z
          .number()
          .int()
          .min(
            0,
          ),

      freeDeliveryThresholdMinor:
        z
          .number()
          .int()
          .min(
            0,
          )
          .nullable()
          .optional(),

      cancellationPolicySummary:
        z
          .string()
          .trim()
          .min(
            10,
          )
          .max(
            1200,
          ),

      returnPolicySummary:
        z
          .string()
          .trim()
          .min(
            10,
          )
          .max(
            1200,
          ),
    })
    .strict()

export const hostSellerOrderStatusBodySchema =
  z
    .object({
      status:
        z.enum([
          'seller_accepted',
          'picking',
          'packed',
          'carrier_handoff',
          'out_for_delivery',
          'delivered',
          'rejected',
          'partial_unavailable',
          'substitution_requested',
          'seller_cancelled',
          'delivery_failed',
          'return_requested',
          'returned',
          'refunded',
        ]),
    })
    .strict()

const orderParamsSchema =
  z.object({
    id:
      objectIdSchema,
  })

const ordersQuerySchema =
  z.object({
    status:
      z
        .string()
        .trim()
        .optional(),

    page:
      z.coerce
        .number()
        .int()
        .min(
          1,
        )
        .optional(),

    limit:
      z.coerce
        .number()
        .int()
        .min(
          1,
        )
        .max(
          50,
        )
        .optional(),
  })

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
    'HOST_COMMERCE_IDEMPOTENCY_KEY_INVALID',
    'A valid Idempotency-Key header is required.',
  )
}

function wrap(
  handler,
) {
  return async function wrappedHostCommerceController(
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

const router =
  Router()

router.use(
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireHostAccess,
  requireMfaAssurance,
)

router.get(
  '/policy',

  wrap(
    async (
      req,
      res,
    ) =>
      sendSuccess(
        req,
        res,
        200,
        await getHostCommercePolicy({
          actorUser:
            req.currentUser,
        }),
        'Host checkout policy loaded.',
      ),
  ),
)

router.put(
  '/policy',

  requireCsrfToken,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          hostCommercePolicyBodySchema,
          req.body,
          'HOST_COMMERCE_POLICY_INVALID',
          'Invalid Host checkout policy.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await saveHostCommercePolicy({
          input,

          actorUser:
            req.currentUser,
        }),
        'Host checkout policy saved.',
      )
    },
  ),
)

router.get(
  '/orders',

  wrap(
    async (
      req,
      res,
    ) => {
      const query =
        parseOrThrow(
          ordersQuerySchema,
          req.query,
          'HOST_ORDERS_QUERY_INVALID',
          'Invalid Host Orders query.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await listHostSellerOrders({
          ...query,

          actorUser:
            req.currentUser,
        }),
        'Host Orders loaded.',
      )
    },
  ),
)

router.get(
  '/orders/:id',

  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          orderParamsSchema,
          req.params,
          'HOST_SELLER_ORDER_ID_INVALID',
          'Invalid Host Order ID.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await getHostSellerOrder({
          sellerOrderId:
            id,

          actorUser:
            req.currentUser,
        }),
        'Host Order loaded.',
      )
    },
  ),
)

router.post(
  '/orders/:id/status',

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
          orderParamsSchema,
          req.params,
          'HOST_SELLER_ORDER_ID_INVALID',
          'Invalid Host Order ID.',
        )

      const input =
        parseOrThrow(
          hostSellerOrderStatusBodySchema,
          req.body,
          'HOST_SELLER_ORDER_STATUS_INVALID',
          'Invalid Host Order status command.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await updateHostSellerOrderStatus({
          sellerOrderId:
            id,

          nextStatus:
            input.status,

          idempotencyKey:
            requireIdempotencyKey(
              req,
            ),

          actorUser:
            req.currentUser,
        }),
        'Host Order status updated.',
      )
    },
  ),
)

export default router