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
  loadAdminAuthorization,
  requireAdminAccess,
  requireAnyAdminPermission,
} from '../admin/adminPermission.middleware.js'

import {
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireCsrfToken,
  requireMfaAssurance,
  requireRecentAuthentication,
  requireRecentMfaAuthentication,
} from '../auth/auth.middleware.js'

import {
  requireCustomerAccess,
} from '../auth/authorization.middleware.js'

import {
  changeRegulatoryProfileStatus,
  changeRetentionPolicyStatus,
  createPrivacyRightsRequest,
  createRegulatoryProfile,
  createRetentionPolicy,
  getOwnPrivacyRequest,
  getPrivacyContext,
  listOwnPrivacyRequests,
  listRegulatoryProfiles,
  listRetentionPolicies,
} from './hardening.service.js'

import {
  lifecycleBodySchema,
  lifecycleParamsSchema,
  privacyRequestBodySchema,
  privacyRequestParamsSchema,
  regulatoryProfileBodySchema,
  retentionPolicyBodySchema,
} from './hardening.validation.js'

const privacyRouter =
  Router()

const adminPrivacyRouter =
  Router()

const adminRegulatoryRouter =
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
        'Invalid M20 request.',
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
  return async function m20HardeningController(
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

function send(
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

privacyRouter.use(
  sensitiveResponseNoStoreMiddleware,
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireCustomerAccess,
)

privacyRouter.get(
  '/context',
  wrap(
    async (
      req,
      res,
    ) =>
      send(
        req,
        res,
        200,
        await getPrivacyContext({
          actorUser:
            actorUser(
              req,
            ),
        }),
        'Privacy context loaded.',
      ),
  ),
)

privacyRouter.get(
  '/requests',
  wrap(
    async (
      req,
      res,
    ) =>
      send(
        req,
        res,
        200,
        await listOwnPrivacyRequests({
          actorUser:
            actorUser(
              req,
            ),
        }),
        'Privacy requests loaded.',
      ),
  ),
)

privacyRouter.get(
  '/requests/:id',
  wrap(
    async (
      req,
      res,
    ) => {
      const params =
        parseOrThrow(
          privacyRequestParamsSchema,
          req.params,
          'PRIVACY_REQUEST_ID_INVALID',
        )

      return send(
        req,
        res,
        200,
        await getOwnPrivacyRequest({
          requestObjectId:
            params.id,
          actorUser:
            actorUser(
              req,
            ),
        }),
        'Privacy request loaded.',
      )
    },
  ),
)

privacyRouter.post(
  '/requests',
  requireCsrfToken,
  requireRecentAuthentication,
  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          privacyRequestBodySchema,
          req.body,
          'PRIVACY_REQUEST_INPUT_INVALID',
        )

      const data =
        await createPrivacyRightsRequest({
          input,
          actorUser:
            actorUser(
              req,
            ),
          requestId:
            req.requestId,
        })

      return send(
        req,
        res,
        data.deduplicated
          ? 200
          : 201,
        data,
        data.deduplicated
          ? 'Existing privacy request returned.'
          : 'Privacy request created.',
      )
    },
  ),
)

adminPrivacyRouter.use(
  sensitiveResponseNoStoreMiddleware,
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireMfaAssurance,
  loadAdminAuthorization,
  requireAdminAccess,
)

adminPrivacyRouter.get(
  '/retention-policies',
  requireAnyAdminPermission(
    'trust_safety.read',
    'admin.audit.read',
  ),
  wrap(
    async (
      req,
      res,
    ) =>
      send(
        req,
        res,
        200,
        await listRetentionPolicies(),
        'Retention policies loaded.',
      ),
  ),
)

adminPrivacyRouter.post(
  '/retention-policies',
  requireAnyAdminPermission(
    'trust_safety.mutate',
  ),
  requireCsrfToken,
  requireRecentMfaAuthentication,
  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          retentionPolicyBodySchema,
          req.body,
          'RETENTION_POLICY_INPUT_INVALID',
        )

      return send(
        req,
        res,
        201,
        await createRetentionPolicy({
          input,
          actorUser:
            actorUser(
              req,
            ),
          adminAuthorization:
            req.adminAuthorization,
          requestId:
            req.requestId,
        }),
        'Retention Policy version created.',
      )
    },
  ),
)

adminPrivacyRouter.post(
  '/retention-policies/:id/:action',
  requireAnyAdminPermission(
    'trust_safety.mutate',
  ),
  requireCsrfToken,
  requireRecentMfaAuthentication,
  wrap(
    async (
      req,
      res,
    ) => {
      const params =
        parseOrThrow(
          lifecycleParamsSchema,
          req.params,
          'RETENTION_POLICY_ACTION_INVALID',
        )

      const input =
        parseOrThrow(
          lifecycleBodySchema,
          req.body,
          'RETENTION_POLICY_ACTION_INPUT_INVALID',
        )

      return send(
        req,
        res,
        200,
        await changeRetentionPolicyStatus({
          policyId:
            params.id,
          action:
            params.action,
          reason:
            input.reason,
          actorUser:
            actorUser(
              req,
            ),
          adminAuthorization:
            req.adminAuthorization,
          requestId:
            req.requestId,
        }),
        'Retention Policy lifecycle updated.',
      )
    },
  ),
)

adminRegulatoryRouter.use(
  sensitiveResponseNoStoreMiddleware,
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireMfaAssurance,
  loadAdminAuthorization,
  requireAdminAccess,
)

adminRegulatoryRouter.get(
  '/',
  requireAnyAdminPermission(
    'trust_safety.read',
    'admin.audit.read',
  ),
  wrap(
    async (
      req,
      res,
    ) =>
      send(
        req,
        res,
        200,
        await listRegulatoryProfiles(),
        'Regulatory Profiles loaded.',
      ),
  ),
)

adminRegulatoryRouter.post(
  '/',
  requireAnyAdminPermission(
    'trust_safety.mutate',
  ),
  requireCsrfToken,
  requireRecentMfaAuthentication,
  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          regulatoryProfileBodySchema,
          req.body,
          'REGULATORY_PROFILE_INPUT_INVALID',
        )

      return send(
        req,
        res,
        201,
        await createRegulatoryProfile({
          input,
          actorUser:
            actorUser(
              req,
            ),
          adminAuthorization:
            req.adminAuthorization,
          requestId:
            req.requestId,
        }),
        'Regulatory Profile version created.',
      )
    },
  ),
)

adminRegulatoryRouter.post(
  '/:id/:action',
  requireAnyAdminPermission(
    'trust_safety.mutate',
  ),
  requireCsrfToken,
  requireRecentMfaAuthentication,
  wrap(
    async (
      req,
      res,
    ) => {
      const params =
        parseOrThrow(
          lifecycleParamsSchema,
          req.params,
          'REGULATORY_PROFILE_ACTION_INVALID',
        )

      const input =
        parseOrThrow(
          lifecycleBodySchema,
          req.body,
          'REGULATORY_PROFILE_ACTION_INPUT_INVALID',
        )

      return send(
        req,
        res,
        200,
        await changeRegulatoryProfileStatus({
          profileId:
            params.id,
          action:
            params.action,
          reason:
            input.reason,
          actorUser:
            actorUser(
              req,
            ),
          adminAuthorization:
            req.adminAuthorization,
          requestId:
            req.requestId,
        }),
        'Regulatory Profile lifecycle updated.',
      )
    },
  ),
)

export {
  adminPrivacyRouter,
  adminRegulatoryRouter,
  privacyRouter,
}