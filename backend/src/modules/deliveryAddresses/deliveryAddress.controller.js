import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  ApiResponse,
} from '../../utils/ApiResponse.js'

import {
  createDeliveryAddress,
  getDefaultDeliveryAddress,
  listDeliveryAddresses,
  setDefaultDeliveryAddress,
  updateDeliveryAddress,
} from './deliveryAddress.service.js'

import {
  createDeliveryAddressSchema,
  deliveryAddressIdParamsSchema,
  updateDeliveryAddressSchema,
} from './deliveryAddress.validation.js'

function parseOrThrow(
  schema,
  value,
  fallback,
) {
  const parsed =
    schema.safeParse(
      value,
    )

  if (
    !parsed.success
  ) {
    throw new ApiError(
      400,
      parsed.error
        .issues[0]
        ?.message ||
        fallback,
    )
  }

  return parsed.data
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
  return async function wrappedDeliveryAddressController(
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

export const listDeliveryAddressesController =
  wrap(
    async (
      req,
      res,
    ) => {
      const result =
        await listDeliveryAddresses(
          req.currentUser,
        )

      return sendSuccess(
        req,
        res,
        200,
        result,
        'Delivery addresses loaded successfully.',
      )
    },
  )

export const getDefaultDeliveryAddressController =
  wrap(
    async (
      req,
      res,
    ) => {
      const result =
        await getDefaultDeliveryAddress(
          req.currentUser,
        )

      return sendSuccess(
        req,
        res,
        200,
        result,
        result.address
          ? 'Default delivery address loaded successfully.'
          : 'No delivery address has been saved yet.',
      )
    },
  )

export const createDeliveryAddressController =
  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          createDeliveryAddressSchema,
          req.body,
          'Invalid delivery address.',
        )

      const result =
        await createDeliveryAddress(
          input,
          req.currentUser,
        )

      return sendSuccess(
        req,
        res,
        201,
        result,
        'Delivery address saved successfully.',
      )
    },
  )

export const updateDeliveryAddressController =
  wrap(
    async (
      req,
      res,
    ) => {
      const params =
        parseOrThrow(
          deliveryAddressIdParamsSchema,
          req.params,
          'Invalid delivery address identity.',
        )

      const input =
        parseOrThrow(
          updateDeliveryAddressSchema,
          req.body,
          'Invalid delivery address.',
        )

      const result =
        await updateDeliveryAddress(
          params.id,
          input,
          req.currentUser,
        )

      return sendSuccess(
        req,
        res,
        200,
        result,
        'Delivery address updated successfully.',
      )
    },
  )

export const setDefaultDeliveryAddressController =
  wrap(
    async (
      req,
      res,
    ) => {
      const params =
        parseOrThrow(
          deliveryAddressIdParamsSchema,
          req.params,
          'Invalid delivery address identity.',
        )

      const result =
        await setDefaultDeliveryAddress(
          params.id,
          req.currentUser,
        )

      return sendSuccess(
        req,
        res,
        200,
        result,
        'Default delivery address updated successfully.',
      )
    },
  )
