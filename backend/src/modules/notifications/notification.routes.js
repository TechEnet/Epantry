import {
  Router,
} from 'express'

import { rateLimit } from 'express-rate-limit'

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
  checkItemAvailability,
  createAvailabilityWatch,
  getNotificationPreferences,
  listCustomerDemandBoard,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  performNotificationAction,
  updateNotificationPreferences,
} from './notification.service.js'

import {
  availabilityWatchBodySchema,
  notificationActionBodySchema,
  notificationIdParamsSchema,
  notificationListQuerySchema,
  updateNotificationPreferencesBodySchema,
} from './notification.validation.js'

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
        'Invalid Notification request.',
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
  return async function notificationController(
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

function actorUser(
  req,
) {
  return (
    req.currentUser ||
    req.user
  )
}

function requireCustomerNotificationAccess(
  req,
  res,
  next,
) {
  const user =
    actorUser(
      req,
    )

  if (
    user?.customerEnabled === true ||
    user?.superAdminEnabled === true ||
    (user?.hostEnabled === true && user?.hostAccessStatus === 'active')
  ) {
    return next()
  }

  return next(
    new ApiError(
      403,
      'Customer, Host or Super Admin access is required for notifications.',
      [
        {
          code:
            'CUSTOMER_ACCESS_REQUIRED',
        },
      ],
    ),
  )
}

router.use(
  sensitiveResponseNoStoreMiddleware,
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireCustomerNotificationAccess,
)



router.post(
  '/availability/check',
  requireCsrfToken,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          availabilityWatchBodySchema,
          req.body,
          'AVAILABILITY_CHECK_INPUT_INVALID',
        )

      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            {
              ...(await checkItemAvailability({
                input,
              })),
              requestId:
                req.requestId,
            },
            'Item availability checked.',
          ),
        )
    },
  ),
)

const customerRequestRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 12,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => String(actorUser(req)?._id || 'unresolved-account'),
  message: { message: 'Too many requests. Please try again shortly.' },
})

router.post(
  '/availability-watches',
  customerRequestRateLimit,
  requireCsrfToken,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          availabilityWatchBodySchema,
          req.body,
          'AVAILABILITY_WATCH_INPUT_INVALID',
        )

      if (input.source === 'search' && (actorUser(req)?.customerEnabled !== true ||
          actorUser(req)?.activeMode === 'host' || actorUser(req)?.superAdminEnabled === true)) {
        throw new ApiError(403, 'Customer access is required to request an item.')
      }

      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            {
              ...(await createAvailabilityWatch({
                input,
                actorUser:
                  actorUser(
                    req,
                  ),
              })),
              requestId:
                req.requestId,
            },
            'Availability notification preference saved.',
          ),
        )
    },
  ),
)

router.get('/customer-demand', wrap(async (req, res) => {
  const user = actorUser(req)
  if (!(user?.superAdminEnabled === true ||
    (user?.hostEnabled === true && user?.hostAccessStatus === 'active' &&
      (user?.activeMode === 'host' || user?.customerEnabled !== true)))) {
    throw new ApiError(403, 'Host or Super Admin access is required.')
  }
  const status = String(req.query.status || 'active')
  const query = String(req.query.query || '').trim()
  const page = Number(req.query.page || 1)
  if (!['active', 'notified'].includes(status) ||
      query.length > 80 || !Number.isInteger(page) || page < 1 || page > 50) {
    throw new ApiError(400, 'Invalid customer demand filters.')
  }
  const board = await listCustomerDemandBoard({ status, query, page, limit: 30 })
  return res.status(200).json(new ApiResponse(200, { ...board, requestId: req.requestId }, 'Customer requests loaded.'))
}))

router.get(
  '/preferences',

  wrap(
    async (
      req,
      res,
    ) =>
      res
        .status(200)
        .json(
          new ApiResponse(
            200,
            {
              ...(await getNotificationPreferences({
                actorUser:
                  actorUser(
                    req,
                  ),
              })),
              requestId:
                req.requestId,
            },
            'Notification preferences loaded.',
          ),
        ),
  ),
)

router.patch(
  '/preferences',
  requireCsrfToken,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          updateNotificationPreferencesBodySchema,
          req.body,
          'NOTIFICATION_PREFERENCES_INPUT_INVALID',
        )

      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            {
              ...(await updateNotificationPreferences({
                input,
                actorUser:
                  actorUser(
                    req,
                  ),
              })),
              requestId:
                req.requestId,
            },
            'Notification preferences updated.',
          ),
        )
    },
  ),
)

router.get(
  '/',

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          notificationListQuerySchema,
          req.query,
          'NOTIFICATION_LIST_QUERY_INVALID',
        )

      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            {
              ...(await listNotifications({
                actorUser:
                  actorUser(
                    req,
                  ),
                input,
              })),
              requestId:
                req.requestId,
            },
            'Notifications loaded.',
          ),
        )
    },
  ),
)

router.patch(
  '/read-all',
  requireCsrfToken,

  wrap(
    async (
      req,
      res,
    ) =>
      res
        .status(200)
        .json(
          new ApiResponse(
            200,
            {
              ...(await markAllNotificationsRead({
                actorUser:
                  actorUser(
                    req,
                  ),
              })),
              requestId:
                req.requestId,
            },
            'Notifications marked as read.',
          ),
        ),
  ),
)

router.patch(
  '/:id/read',
  requireCsrfToken,

  wrap(
    async (
      req,
      res,
    ) => {
      const params =
        parseOrThrow(
          notificationIdParamsSchema,
          req.params,
          'NOTIFICATION_ID_INVALID',
        )

      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            {
              ...(await markNotificationRead({
                notificationId:
                  params.id,
                actorUser:
                  actorUser(
                    req,
                  ),
              })),
              requestId:
                req.requestId,
            },
            'Notification marked as read.',
          ),
        )
    },
  ),
)

router.post(
  '/:id/actions',
  requireCsrfToken,

  wrap(
    async (
      req,
      res,
    ) => {
      const params =
        parseOrThrow(
          notificationIdParamsSchema,
          req.params,
          'NOTIFICATION_ID_INVALID',
        )

      const input =
        parseOrThrow(
          notificationActionBodySchema,
          req.body,
          'NOTIFICATION_ACTION_INPUT_INVALID',
        )

      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            {
              ...(await performNotificationAction({
                notificationId:
                  params.id,
                input,
                actorUser:
                  actorUser(
                    req,
                  ),
                correlationId:
                  req.requestId,
              })),
              requestId:
                req.requestId,
            },
            'Notification action recorded.',
          ),
        )
    },
  ),
)

export default router