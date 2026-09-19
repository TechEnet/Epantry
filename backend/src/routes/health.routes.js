import {
  Router,
} from 'express'

import {
  ApiResponse,
} from '../utils/ApiResponse.js'

import {
  getLivenessStatus,
  getReadinessStatus,
} from '../modules/reliability/reliability.service.js'

const router =
  Router()

function sendLiveness(
  req,
  res,
) {
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {
          ...getLivenessStatus(),

          requestId:
            req.requestId,
        },
        'EPANTRY API is running',
      ),
    )
}

async function sendReadiness(
  req,
  res,
  next,
) {
  try {
    const readiness =
      await getReadinessStatus()

    const status =
      readiness.ready
        ? 200
        : 503

    return res
      .status(
        status,
      )
      .json(
        new ApiResponse(
          status,
          {
            ...readiness,

            database:
              readiness.components.database.state,

            requestId:
              req.requestId,
          },

          readiness.ready
            ? 'EPANTRY API is ready'
            : 'EPANTRY API is not ready',
        ),
      )
  } catch (error) {
    return next(
      error,
    )
  }
}

router.get(
  '/health',
  sendLiveness,
)

router.get(
  '/health/live',
  sendLiveness,
)

router.get(
  '/ready',
  sendReadiness,
)

router.get(
  '/health/ready',
  sendReadiness,
)

export default router