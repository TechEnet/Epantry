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
  createServiceAreaSchema,
  listServiceAreasQuerySchema,
  resolveHostServiceabilityQuerySchema,
  serviceAreaIdParamsSchema,
  updateServiceAreaSchema,
} from './marketplace.serviceability.validation.js'

import {
  createServiceArea,
  getServiceArea,
  listServiceAreas,
  resolveHostOfferServiceability,
  updateServiceArea,
} from './marketplace.serviceability.service.js'

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
| Service Areas
|--------------------------------------------------------------------------
*/

export const listServiceAreasController =
  wrap(
    async (
      req,
      res,
    ) => {
      const query =
        parseOrThrow(
          listServiceAreasQuerySchema,
          req.query,
          'MARKETPLACE_SERVICE_AREA_QUERY_INVALID',
          'Invalid Service Area query.',
        )

      const result =
        await listServiceAreas(
          query,
          req.currentUser,
        )

      return sendSuccess(
        req,
        res,
        200,
        result,
        'Service Areas loaded',
      )
    },
  )

export const getServiceAreaController =
  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          serviceAreaIdParamsSchema,
          req.params,
          'MARKETPLACE_SERVICE_AREA_ID_INVALID',
          'Invalid Service Area ID.',
        )

      const result =
        await getServiceArea(
          id,
          req.currentUser,
        )

      return sendSuccess(
        req,
        res,
        200,
        result,
        'Service Area loaded',
      )
    },
  )

export const createServiceAreaController =
  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          createServiceAreaSchema,
          req.body,
          'MARKETPLACE_SERVICE_AREA_INPUT_INVALID',
          'Invalid Service Area input.',
        )

      const result =
        await createServiceArea(
          input,
          req.currentUser,
        )

      return sendSuccess(
        req,
        res,
        201,
        result,
        'Service Area created',
      )
    },
  )

export const updateServiceAreaController =
  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          serviceAreaIdParamsSchema,
          req.params,
          'MARKETPLACE_SERVICE_AREA_ID_INVALID',
          'Invalid Service Area ID.',
        )

      const input =
        parseOrThrow(
          updateServiceAreaSchema,
          req.body,
          'MARKETPLACE_SERVICE_AREA_INPUT_INVALID',
          'Invalid Service Area input.',
        )

      const result =
        await updateServiceArea(
          id,
          input,
          req.currentUser,
        )

      return sendSuccess(
        req,
        res,
        200,
        result,
        'Service Area updated',
      )
    },
  )

/*
|--------------------------------------------------------------------------
| Offer Serviceability Preview
|--------------------------------------------------------------------------
*/

export const resolveHostOfferServiceabilityController =
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
          resolveHostServiceabilityQuerySchema,
          req.query,
          'MARKETPLACE_SERVICEABILITY_QUERY_INVALID',
          'Invalid serviceability query.',
        )

      const result =
        await resolveHostOfferServiceability(
          id,
          query,
          req.currentUser,
        )

      return sendSuccess(
        req,
        res,
        200,
        result,
        'Host Offer serviceability resolved',
      )
    },
  )