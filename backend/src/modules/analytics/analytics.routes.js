import {
  Router,
} from 'express'

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
  recordAnalyticsEvent,
} from './analytics.service.js'

import {
  analyticsEventBodySchema,
} from './analytics.validation.js'

const router =
  Router()

function parseOrThrow(
  schema,
  value,
  code,
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
        'Invalid Analytics request.',
      [
        {
          code,
          issues:
            parsed.error.issues,
        },
      ],
    )
  }

  return parsed.data
}

function wrap(
  handler,
) {
  return async function analyticsController(
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

router.use(
  sensitiveResponseNoStoreMiddleware,
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
)

/*
| Client analytics ingestion is intentionally narrow:
|
| - authenticated actor is derived by backend
| - no organization ID is accepted from client
| - event names are EPANTRY-owned registry keys
| - payload is allow-listed and privacy minimized
| - analytics never grants authorization
*/
router.post(
  '/events',
  requireCsrfToken,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          analyticsEventBodySchema,
          req.body,
          'ANALYTICS_EVENT_INPUT_INVALID',
        )

      const data =
        await recordAnalyticsEvent({
          input,
          actorUser:
            req.currentUser ||
            req.user,
          requestId:
            req.requestId,
          organizationId:
            null,
        })

      return res
        .status(
          data.deduplicated
            ? 200
            : 201,
        )
        .json(
          new ApiResponse(
            data.deduplicated
              ? 200
              : 201,
            {
              ...data,
              requestId:
                req.requestId,
            },
            data.deduplicated
              ? 'Analytics event already recorded.'
              : 'Analytics event recorded.',
          ),
        )
    },
  ),
)

export default router