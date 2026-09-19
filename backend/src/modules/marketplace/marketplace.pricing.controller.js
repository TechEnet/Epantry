import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  ApiResponse,
} from '../../utils/ApiResponse.js'

import {
  hostOfferIdParamsSchema,
} from './marketplace.host.validation.js'

import {
  createHostPriceRuleSchema,
  effectiveHostPriceQuerySchema,
  listHostPriceRulesQuerySchema,
} from './marketplace.pricing.validation.js'

import {
  createHostPriceRule,
  getHostEffectivePrice,
  listHostPriceRules,
} from './marketplace.pricing.service.js'

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
  return async function wrappedController(
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
| Price History
|--------------------------------------------------------------------------
*/

export const listHostPriceRulesController =
  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          hostOfferIdParamsSchema,
          req.params,
          'MARKETPLACE_OFFER_ID_INVALID',
          'Invalid Host Offer ID.',
        )

      const query =
        parseOrThrow(
          listHostPriceRulesQuerySchema,
          req.query,
          'MARKETPLACE_PRICE_QUERY_INVALID',
          'Invalid Price Rule query.',
        )

      const result =
        await listHostPriceRules(
          id,
          query,
          req.currentUser,
        )

      return sendSuccess(
        req,
        res,
        200,
        result,
        'Host Offer price history loaded',
      )
    },
  )

/*
|--------------------------------------------------------------------------
| Effective Price
|--------------------------------------------------------------------------
*/

export const getHostEffectivePriceController =
  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          hostOfferIdParamsSchema,
          req.params,
          'MARKETPLACE_OFFER_ID_INVALID',
          'Invalid Host Offer ID.',
        )

      const {
        at,
      } =
        parseOrThrow(
          effectiveHostPriceQuerySchema,
          req.query,
          'MARKETPLACE_PRICE_QUERY_INVALID',
          'Invalid effective price query.',
        )

      const result =
        await getHostEffectivePrice(
          id,
          at,
          req.currentUser,
        )

      return sendSuccess(
        req,
        res,
        200,
        result,
        'Effective Host Offer price resolved',
      )
    },
  )

/*
|--------------------------------------------------------------------------
| New Price Rule
|--------------------------------------------------------------------------
*/

export const createHostPriceRuleController =
  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          hostOfferIdParamsSchema,
          req.params,
          'MARKETPLACE_OFFER_ID_INVALID',
          'Invalid Host Offer ID.',
        )

      const input =
        parseOrThrow(
          createHostPriceRuleSchema,
          req.body,
          'MARKETPLACE_PRICE_INPUT_INVALID',
          'Invalid Price Rule input.',
        )

      const result =
        await createHostPriceRule(
          id,
          input,
          req.currentUser,
        )

      return sendSuccess(
        req,
        res,
        201,
        result,
        'Host Offer Price Rule created',
      )
    },
  )