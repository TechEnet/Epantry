import {
  ApiResponse,
} from '../../utils/ApiResponse.js'

import {
  reverseGeocode,
} from './location.service.js'

export async function reverseGeocodeController(
  req,
  res,
  next,
) {
  try {
    const location =
      await reverseGeocode({
        latitude:
          req.body
            ?.latitude,

        longitude:
          req.body
            ?.longitude,
      })

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,

          {
            ...location,

            requestId:
              req.requestId,
          },

          'Location resolved successfully',
        ),
      )
  } catch (error) {
    return next(error)
  }
}