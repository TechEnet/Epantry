import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  ApiResponse,
} from '../../utils/ApiResponse.js'

import {
  publicPackOffersParamsSchema,
  publicPackOffersQuerySchema,
} from './marketplace.public.validation.js'

import {
  listPublicEligibleOffers,
} from './marketplace.public.service.js'

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

export async function listPublicEligibleOffersController(
  req,
  res,
  next,
) {
  try {
    const {
      packId,
    } =
      parseOrThrow(
        publicPackOffersParamsSchema,
        req.params,
        'PUBLIC_MARKETPLACE_PACK_ID_INVALID',
        'Invalid Pack ID.',
      )

    const query =
      parseOrThrow(
        publicPackOffersQuerySchema,
        req.query,
        'PUBLIC_MARKETPLACE_QUERY_INVALID',
        'Invalid Marketplace Offer query.',
      )

    const result =
      await listPublicEligibleOffers({
        packId,

        ...query,
      })

    return res
      .status(
        200,
      )
      .json(
        new ApiResponse(
          200,
          {
            ...result,

            requestId:
              req.requestId,
          },
          'Eligible Marketplace Offers loaded',
        ),
      )
  } catch (error) {
    return next(
      error,
    )
  }
}