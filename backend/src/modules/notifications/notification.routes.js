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
  getNotificationPreferences,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  performNotificationAction,
  updateNotificationPreferences,
} from './notification.service.js'

import {
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
    user?.customerEnabled ===
      true ||
    user?.superAdminEnabled ===
      true
  ) {
    return next()
  }

  return next(
    new ApiError(
      403,
      'Customer or Super Admin access is required for notifications.',
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