import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  ApiResponse,
} from '../../utils/ApiResponse.js'

import {
  createHostOfferSchema,
  hostOfferIdParamsSchema,
  listHostOffersQuerySchema,
  updateHostOfferSchema,
} from './marketplace.host.validation.js'

import {
  createHostOffer,
  getHostMarketplaceOrganization,
  getHostOffer,
  listHostOffers,
  updateHostOffer,
} from './marketplace.host.service.js'

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
| Organization
|--------------------------------------------------------------------------
*/

export const getHostMarketplaceOrganizationController =
  wrap(
    async (
      req,
      res,
    ) => {
      const result =
        await getHostMarketplaceOrganization(
          req.currentUser,
        )

      return sendSuccess(
        req,
        res,
        200,
        result,
        'Host Marketplace organization loaded',
      )
    },
  )

/*
|--------------------------------------------------------------------------
| Offers
|--------------------------------------------------------------------------
*/

export const listHostOffersController =
  wrap(
    async (
      req,
      res,
    ) => {
      const query =
        parseOrThrow(
          listHostOffersQuerySchema,
          req.query,
          'MARKETPLACE_OFFER_QUERY_INVALID',
          'Invalid Host Offer query.',
        )

      const result =
        await listHostOffers(
          query,
          req.currentUser,
        )

      return sendSuccess(
        req,
        res,
        200,
        result,
        'Host Offers loaded',
      )
    },
  )

export const getHostOfferController =
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
        await getHostOffer(
          id,
          req.currentUser,
        )

      return sendSuccess(
        req,
        res,
        200,
        result,
        'Host Offer loaded',
      )
    },
  )

export const createHostOfferController =
  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          createHostOfferSchema,
          req.body,
          'MARKETPLACE_OFFER_INPUT_INVALID',
          'Invalid Host Offer input.',
        )

      const result =
        await createHostOffer(
          input,
          req.currentUser,
        )

      return sendSuccess(
        req,
        res,
        201,
        result,
        'Host Offer created',
      )
    },
  )

export const updateHostOfferController =
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
          updateHostOfferSchema,
          req.body,
          'MARKETPLACE_OFFER_INPUT_INVALID',
          'Invalid Host Offer input.',
        )

      const result =
        await updateHostOffer(
          id,
          input,
          req.currentUser,
        )

      return sendSuccess(
        req,
        res,
        200,
        result,
        'Host Offer updated',
      )
    },
  )