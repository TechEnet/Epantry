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
  activateHostOffer,
  inspectHostOfferReadiness,
} from './marketplace.offer-readiness.service.js'

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

export const inspectHostOfferReadinessController =
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

      const result =
        await inspectHostOfferReadiness(
          id,
          req.currentUser,
        )

      return sendSuccess(
        req,
        res,
        200,
        result,
        'Host Offer readiness loaded',
      )
    },
  )

export const activateHostOfferController =
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

      const result =
        await activateHostOffer(
          id,
          req.currentUser,
        )

      return sendSuccess(
        req,
        res,
        200,
        result,
        'Host Offer activated',
      )
    },
  )