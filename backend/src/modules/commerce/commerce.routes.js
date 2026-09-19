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
  COMMERCE_OBJECTIVES,
} from './commerce.engine.js'

import {
  getBasketQuote,
  getMarketplaceCart,
  optimizeOutcomeBasket,
} from './commerce.service.js'

import {
  createDirectMarketplaceCart,
  createValidatedMarketplaceCart,
  updateDirectMarketplaceCartItem,
} from './commerce.checkout.service.js'

import {
  createExternalHandoffFromQuote,
  createPaymentIntent,
  getCustomerOrderDetail,
  getCustomerOrderTracking,
  getExternalHandoffPartners,
  listCustomerOrders,
  prepareFinalCheckout,
  verifyCustomerPayment,
} from './commerce.final.service.js'

const objectIdSchema =
  z
    .string()
    .regex(
      /^[a-f\d]{24}$/i,
      'A valid MongoDB ObjectId is required.',
    )

const pincodeSchema =
  z
    .string()
    .trim()
    .transform(
      (
        value,
      ) =>
        value.replace(
          /\s+/g,
          '',
        ),
    )
    .refine(
      (
        value,
      ) =>
        /^\d{6}$/.test(
          value,
        ),
      {
        message:
          'Pincode must contain exactly 6 digits.',
      },
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

export const basketOptimizeBodySchema =
  z
    .object({
      outcomePlanId:
        objectIdSchema,

      pincode:
        pincodeSchema,

      objective:
        z
          .enum(
            COMMERCE_OBJECTIVES,
          )
          .default(
            'best_value',
          ),

      fulfillmentType:
        z
          .enum([
            'delivery',
            'pickup',
          ])
          .optional(),
    })
    .strict()

export const createCartBodySchema =
  z
    .object({
      basketQuoteId:
        objectIdSchema,

      optionKey:
        z.enum([
          'best_value',
          'minimum_waste',
          'one_retailer',
        ]),
    })
    .strict()

export const createDirectCartBodySchema =
  z
    .object({
      cartId:
        objectIdSchema
          .optional(),

      packId:
        objectIdSchema,

      offerId:
        objectIdSchema,

      quantity:
        z
          .number()
          .int()
          .min(
            1,
          )
          .max(
            100000,
          )
          .default(
            1,
          ),

      pincode:
        pincodeSchema,

      fulfillmentType:
        z
          .enum([
            'delivery',
            'pickup',
          ])
          .default(
            'delivery',
          ),
    })
    .strict()

export const checkoutBodySchema =
  z
    .object({
      cartId:
        objectIdSchema,

      deliveryAddressId:
        objectIdSchema
          .optional(),
    })
    .strict()

export const paymentIntentBodySchema =
  z
    .object({
      orderId:
        objectIdSchema,
    })
    .strict()

export const paymentVerifyBodySchema =
  z
    .object({
      orderId:
        objectIdSchema,

      razorpayPaymentId:
        z
          .string()
          .trim()
          .min(
            1,
          )
          .max(
            160,
          ),

      razorpayOrderId:
        z
          .string()
          .trim()
          .min(
            1,
          )
          .max(
            160,
          ),

      razorpaySignature:
        z
          .string()
          .trim()
          .regex(
            /^[a-f\d]{64}$/i,
            'Razorpay signature must be a SHA-256 hexadecimal digest.',
          ),
    })
    .strict()

export const externalHandoffBodySchema =
  z
    .object({
      basketQuoteId:
        objectIdSchema,

      partnerId:
        z
          .string()
          .trim()
          .min(
            1,
          )
          .max(
            80,
          ),
    })
    .strict()

const idParamsSchema =
  z.object({
    id:
      objectIdSchema,
  })

const cartItemParamsSchema =
  z.object({
    id:
      objectIdSchema,

    itemId:
      objectIdSchema,
  })

const directCartItemMutationBodySchema =
  z
    .object({
      operation:
        z.enum([
          'decrement',
          'remove',
          'set_quantity',
        ]),

      quantity:
        z
          .coerce
          .number()
          .int()
          .min(
            1,
          )
          .max(
            100000,
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
          value.operation ===
            'set_quantity' &&
          value.quantity ===
            undefined
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,
            path: [
              'quantity',
            ],
            message:
              'Quantity is required when setting a direct Cart item quantity.',
          })
        }
      },
    )

const ordersQuerySchema =
  z.object({
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
    'COMMERCE_IDEMPOTENCY_KEY_INVALID',
    'A valid Idempotency-Key header is required.',
  )
}

function wrap(
  handler,
) {
  return async function wrappedCommerceController(
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

const commerceRoutes =
  Router()

commerceRoutes.use(
  [
    '/basket-optimize',
    '/basket-quotes',
    '/cart',
    '/checkout',
    '/orders',
    '/payments',
    '/external-handoff-partners',
    '/external-handoffs',
  ],
  sensitiveResponseNoStoreMiddleware,
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireCustomerAccess,
)

commerceRoutes.post(
  '/basket-optimize',
  requireCsrfToken,
  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          basketOptimizeBodySchema,
          req.body,
          'BASKET_OPTIMIZE_INVALID',
          'Invalid basket optimization request.',
        )

      return sendSuccess(
        req,
        res,
        201,
        await optimizeOutcomeBasket({
          outcomePlanId:
            input.outcomePlanId,

          pincode:
            input.pincode,

          objective:
            input.objective,

          fulfillmentType:
            input.fulfillmentType ||
            null,

          idempotencyKey:
            requireIdempotencyKey(
              req,
            ),

          actorUser:
            req.currentUser,
        }),
        'Basket comparison created successfully.',
      )
    },
  ),
)

commerceRoutes.get(
  '/basket-quotes/:id',
  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          idParamsSchema,
          req.params,
          'BASKET_QUOTE_ID_INVALID',
          'Invalid basket quote ID.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await getBasketQuote({
          quoteId:
            id,

          actorUser:
            req.currentUser,
        }),
        'Basket quote loaded successfully.',
      )
    },
  ),
)

commerceRoutes.post(
  '/cart/direct',
  requireCsrfToken,
  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          createDirectCartBodySchema,
          req.body,
          'DIRECT_MARKETPLACE_CART_CREATE_INVALID',
          'Invalid direct Marketplace Cart request.',
        )

      return sendSuccess(
        req,
        res,
        201,
        await createDirectMarketplaceCart({
          cartId:
            input.cartId ||
            null,

          packId:
            input.packId,

          offerId:
            input.offerId,

          quantity:
            input.quantity,

          pincode:
            input.pincode,

          fulfillmentType:
            input.fulfillmentType,

          idempotencyKey:
            requireIdempotencyKey(
              req,
            ),

          actorUser:
            req.currentUser,
        }),
        'Direct Marketplace Cart created successfully.',
      )
    },
  ),
)

commerceRoutes.post(
  '/cart',
  requireCsrfToken,
  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          createCartBodySchema,
          req.body,
          'MARKETPLACE_CART_CREATE_INVALID',
          'Invalid Marketplace Cart request.',
        )

      return sendSuccess(
        req,
        res,
        201,
        await createValidatedMarketplaceCart({
          basketQuoteId:
            input.basketQuoteId,

          optionKey:
            input.optionKey,

          idempotencyKey:
            requireIdempotencyKey(
              req,
            ),

          actorUser:
            req.currentUser,
        }),
        'Marketplace Cart created successfully.',
      )
    },
  ),
)


commerceRoutes.patch(
  '/cart/:id/items/:itemId',
  requireCsrfToken,
  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
        itemId,
      } =
        parseOrThrow(
          cartItemParamsSchema,
          req.params,
          'DIRECT_MARKETPLACE_CART_ITEM_ID_INVALID',
          'Invalid direct Marketplace Cart item identity.',
        )

      const {
        operation,
        quantity,
      } =
        parseOrThrow(
          directCartItemMutationBodySchema,
          req.body,
          'DIRECT_MARKETPLACE_CART_ITEM_UPDATE_INVALID',
          'Invalid direct Marketplace Cart item update.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await updateDirectMarketplaceCartItem({
          cartId:
            id,

          itemId,
          operation,
          quantity,

          actorUser:
            req.currentUser,
        }),
        'Direct Marketplace Cart item updated successfully.',
      )
    },
  ),
)

commerceRoutes.get(
  '/cart/:id',
  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          idParamsSchema,
          req.params,
          'MARKETPLACE_CART_ID_INVALID',
          'Invalid Marketplace Cart ID.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await getMarketplaceCart({
          cartId:
            id,

          actorUser:
            req.currentUser,
        }),
        'Marketplace Cart loaded successfully.',
      )
    },
  ),
)

commerceRoutes.post(
  '/checkout',
  requireCsrfToken,
  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          checkoutBodySchema,
          req.body,
          'CHECKOUT_CREATE_INVALID',
          'Invalid checkout request.',
        )

      return sendSuccess(
        req,
        res,
        201,
        await prepareFinalCheckout({
          cartId:
            input.cartId,

          deliveryAddressId:
            input.deliveryAddressId ||
            null,

          idempotencyKey:
            requireIdempotencyKey(
              req,
            ),

          actorUser:
            req.currentUser,
        }),
        'Checkout preparation completed.',
      )
    },
  ),
)

commerceRoutes.post(
  '/payments/intents',
  requireCsrfToken,
  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          paymentIntentBodySchema,
          req.body,
          'PAYMENT_INTENT_CREATE_INVALID',
          'Invalid payment intent request.',
        )

      return sendSuccess(
        req,
        res,
        201,
        await createPaymentIntent({
          orderId:
            input.orderId,

          idempotencyKey:
            requireIdempotencyKey(
              req,
            ),

          actorUser:
            req.currentUser,
        }),
        'Hosted payment intent created.',
      )
    },
  ),
)

commerceRoutes.post(
  '/payments/verify',
  requireCsrfToken,
  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          paymentVerifyBodySchema,
          req.body,
          'PAYMENT_VERIFY_INVALID',
          'Invalid payment verification request.',
        )

      requireIdempotencyKey(
        req,
      )

      return sendSuccess(
        req,
        res,
        200,
        await verifyCustomerPayment({
          input,

          actorUser:
            req.currentUser,
        }),
        'Payment verified successfully.',
      )
    },
  ),
)

commerceRoutes.get(
  '/external-handoff-partners',
  wrap(
    async (
      req,
      res,
    ) =>
      sendSuccess(
        req,
        res,
        200,
        getExternalHandoffPartners(),
        'External retailer partners loaded.',
      ),
  ),
)

/*
|--------------------------------------------------------------------------
| External Retailer Handoff
|--------------------------------------------------------------------------
|
| Express route().post() is intentionally used here.
|
| The endpoint is still:
| POST /api/v1/external-handoffs
|
| External retailer execution remains separate from the EPANTRY Cart and
| Order transaction path. The client chooses only a governed partner ID.
| Destination authority remains server-side.
|
*/

commerceRoutes
  .route(
    '/external-handoffs',
  )
  .post(
    requireCsrfToken,
    wrap(
      async (
        req,
        res,
      ) => {
        const input =
          parseOrThrow(
            externalHandoffBodySchema,
            req.body,
            'EXTERNAL_HANDOFF_INVALID',
            'Invalid external handoff request.',
          )

        return sendSuccess(
          req,
          res,
          201,
          await createExternalHandoffFromQuote({
            basketQuoteId:
              input.basketQuoteId,

            partnerId:
              input.partnerId,

            idempotencyKey:
              requireIdempotencyKey(
                req,
              ),

            actorUser:
              req.currentUser,
          }),
          'External retailer handoff created.',
        )
      },
    ),
  )

commerceRoutes.get(
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
          'ORDERS_QUERY_INVALID',
          'Invalid Orders query.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await listCustomerOrders({
          ...query,

          actorUser:
            req.currentUser,
        }),
        'Orders loaded successfully.',
      )
    },
  ),
)

commerceRoutes.get(
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
          idParamsSchema,
          req.params,
          'PARENT_ORDER_ID_INVALID',
          'Invalid Order ID.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await getCustomerOrderDetail({
          orderId:
            id,

          actorUser:
            req.currentUser,
        }),
        'Order loaded successfully.',
      )
    },
  ),
)

commerceRoutes.get(
  '/orders/:id/track',
  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          idParamsSchema,
          req.params,
          'PARENT_ORDER_ID_INVALID',
          'Invalid Order ID.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await getCustomerOrderTracking({
          orderId:
            id,

          actorUser:
            req.currentUser,
        }),
        'Order tracking loaded successfully.',
      )
    },
  ),
)

export default commerceRoutes