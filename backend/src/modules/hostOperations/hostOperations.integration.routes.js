import { Router } from 'express'

import { sensitiveResponseNoStoreMiddleware } from '../../middlewares/security.middleware.js'
import { ApiError } from '../../utils/ApiError.js'
import { ApiResponse } from '../../utils/ApiResponse.js'

import {
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireCsrfToken,
  requireMfaAssurance,
  requireRecentMfaAuthentication,
} from '../auth/auth.middleware.js'

import { requireHostAccess } from '../auth/authorization.middleware.js'

import {
  authenticateHostServiceAccount,
  requireHostServiceAccountScope,
} from './hostOperations.integration.middleware.js'

import {
  createHostServiceAccount,
  createHostWebhook,
  listHostOperationsAudit,
  listHostServiceAccounts,
  listHostWebhooks,
  rotateHostServiceAccountCredential,
  rotateHostWebhookSecret,
  updateHostServiceAccount,
  updateHostWebhook,
} from './hostOperations.integration.service.js'

import {
  createServiceAccountSchema,
  createWebhookSchema,
  integrationListQuerySchema,
  serviceAccountIdParamsSchema,
  updateServiceAccountSchema,
  updateWebhookSchema,
  webhookIdParamsSchema,
} from './hostOperations.integration.validation.js'

const router =
  Router()

const hostRouter =
  Router()

const serviceRouter =
  Router()

function parseOrThrow(
  schema,
  value,
  code,
  message,
) {
  const parsed =
    schema.safeParse(
      value,
    )

  if (!parsed.success) {
    throw new ApiError(
      400,
      parsed.error.issues[0]?.message ||
        message,
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

const wrap =
  (handler) =>
    async (
      req,
      res,
      next,
    ) => {
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

function sendSuccess(
  req,
  res,
  statusCode,
  data,
  message,
) {
  return res
    .status(
      statusCode,
    )
    .json(
      new ApiResponse(
        statusCode,
        {
          ...data,
          requestId:
            req.requestId,
        },
        message,
      ),
    )
}

const hostSecurity = [
  sensitiveResponseNoStoreMiddleware,
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireHostAccess,
  requireMfaAssurance,
]

hostRouter.get(
  '/service-accounts',
  ...hostSecurity,

  wrap(
    async (
      req,
      res,
    ) =>
      sendSuccess(
        req,
        res,
        200,
        await listHostServiceAccounts({
          actorUser:
            req.currentUser,
        }),
        'Service Accounts loaded.',
      ),
  ),
)

hostRouter.post(
  '/service-accounts',
  ...hostSecurity,
  requireCsrfToken,
  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          createServiceAccountSchema,
          req.body,
          'HOST_SERVICE_ACCOUNT_INPUT_INVALID',
          'Invalid Service Account input.',
        )

      return sendSuccess(
        req,
        res,
        201,
        await createHostServiceAccount({
          input,

          actorUser:
            req.currentUser,

          requestId:
            req.requestId,
        }),
        'Service Account created. Store the API key now; it will not be shown again.',
      )
    },
  ),
)

hostRouter.patch(
  '/service-accounts/:id',
  ...hostSecurity,
  requireCsrfToken,
  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const { id } =
        parseOrThrow(
          serviceAccountIdParamsSchema,
          req.params,
          'HOST_SERVICE_ACCOUNT_ID_INVALID',
          'Invalid Service Account ID.',
        )

      const input =
        parseOrThrow(
          updateServiceAccountSchema,
          req.body,
          'HOST_SERVICE_ACCOUNT_UPDATE_INVALID',
          'Invalid Service Account update.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await updateHostServiceAccount({
          serviceAccountId:
            id,

          input,

          actorUser:
            req.currentUser,

          requestId:
            req.requestId,
        }),
        'Service Account updated.',
      )
    },
  ),
)

hostRouter.post(
  '/service-accounts/:id/rotate',
  ...hostSecurity,
  requireCsrfToken,
  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const { id } =
        parseOrThrow(
          serviceAccountIdParamsSchema,
          req.params,
          'HOST_SERVICE_ACCOUNT_ID_INVALID',
          'Invalid Service Account ID.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await rotateHostServiceAccountCredential({
          serviceAccountId:
            id,

          actorUser:
            req.currentUser,

          requestId:
            req.requestId,
        }),
        'API credential rotated. Store the new key now.',
      )
    },
  ),
)

hostRouter.get(
  '/webhooks',
  ...hostSecurity,

  wrap(
    async (
      req,
      res,
    ) =>
      sendSuccess(
        req,
        res,
        200,
        await listHostWebhooks({
          actorUser:
            req.currentUser,
        }),
        'Organization webhooks loaded.',
      ),
  ),
)

hostRouter.post(
  '/webhooks',
  ...hostSecurity,
  requireCsrfToken,
  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          createWebhookSchema,
          req.body,
          'HOST_WEBHOOK_INPUT_INVALID',
          'Invalid webhook input.',
        )

      return sendSuccess(
        req,
        res,
        201,
        await createHostWebhook({
          input,

          actorUser:
            req.currentUser,

          requestId:
            req.requestId,
        }),
        'Webhook created. Store the signing secret now; it will not be shown again.',
      )
    },
  ),
)

hostRouter.patch(
  '/webhooks/:id',
  ...hostSecurity,
  requireCsrfToken,
  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const { id } =
        parseOrThrow(
          webhookIdParamsSchema,
          req.params,
          'HOST_WEBHOOK_ID_INVALID',
          'Invalid webhook ID.',
        )

      const input =
        parseOrThrow(
          updateWebhookSchema,
          req.body,
          'HOST_WEBHOOK_UPDATE_INVALID',
          'Invalid webhook update.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await updateHostWebhook({
          webhookId:
            id,

          input,

          actorUser:
            req.currentUser,

          requestId:
            req.requestId,
        }),
        'Webhook updated.',
      )
    },
  ),
)

hostRouter.post(
  '/webhooks/:id/rotate-secret',
  ...hostSecurity,
  requireCsrfToken,
  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const { id } =
        parseOrThrow(
          webhookIdParamsSchema,
          req.params,
          'HOST_WEBHOOK_ID_INVALID',
          'Invalid webhook ID.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await rotateHostWebhookSecret({
          webhookId:
            id,

          actorUser:
            req.currentUser,

          requestId:
            req.requestId,
        }),
        'Webhook signing secret rotated. Store the new secret now.',
      )
    },
  ),
)

hostRouter.get(
  '/audit',
  ...hostSecurity,

  wrap(
    async (
      req,
      res,
    ) => {
      const query =
        parseOrThrow(
          integrationListQuerySchema,
          req.query,
          'HOST_OPERATIONS_AUDIT_QUERY_INVALID',
          'Invalid audit query.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await listHostOperationsAudit({
          ...query,

          actorUser:
            req.currentUser,
        }),
        'Host operations audit loaded.',
      )
    },
  ),
)

serviceRouter.use(
  sensitiveResponseNoStoreMiddleware,
  authenticateHostServiceAccount,
)

serviceRouter.get(
  '/whoami',

  requireHostServiceAccountScope(
    'catalog.read',
  ),

  wrap(
    async (
      req,
      res,
    ) =>
      sendSuccess(
        req,
        res,
        200,
        {
          serviceAccount:
            req.hostServiceAccount,

          policy: {
            cookieSessionRequired:
              false,

            modeSwitchIsAuthorizationAuthority:
              false,
          },
        },
        'Service Account authenticated.',
      ),
  ),
)

router.use(
  '/host/operations/integrations',
  hostRouter,
)

router.use(
  '/host-service',
  serviceRouter,
)

export default router