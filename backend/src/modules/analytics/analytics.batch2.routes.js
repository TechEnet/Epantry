import {
  Router,
} from 'express'

import {
  z,
} from 'zod'

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
  requireMfaAssurance,
  requireRecentMfaAuthentication,
} from '../auth/auth.middleware.js'

import {
  requireHostAccess,
} from '../auth/authorization.middleware.js'

import {
  loadAdminAuthorization,
  requireAdminAccess,
  requireAnyAdminPermission,
} from '../admin/adminPermission.middleware.js'

import {
  changeExperimentStatus,
  createExperimentDefinition,
  getAdminAnalyticsDashboard,
  getExperimentAssignment,
  getHostAnalyticsDashboard,
  listExperimentDefinitions,
  recordExperimentExposure,
} from './analytics.batch2.service.js'

const experimentRouter =
  Router()

const hostAnalyticsRouter =
  Router()

const adminAnalyticsRouter =
  Router()

const experimentKeySchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(120)
  .regex(
    /^[a-z0-9_-]+$/,
    'Experiment key may contain only lowercase letters, numbers, underscore and hyphen.',
  )

const objectIdSchema = z
  .string()
  .trim()
  .regex(
    /^[a-f\d]{24}$/i,
    'A valid MongoDB ObjectId is required.',
  )

const reportQuerySchema = z
  .object({
    start:
      z.coerce
        .date()
        .optional(),

    end:
      z.coerce
        .date()
        .optional(),
  })
  .strict()

const experimentParamsSchema = z
  .object({
    experimentKey:
      experimentKeySchema,
  })
  .strict()

const experimentIdActionParamsSchema = z
  .object({
    id:
      objectIdSchema,

    action:
      z.enum([
        'activate',
        'pause',
        'end',
      ]),
  })
  .strict()

const exposureBodySchema = z
  .object({
    surface:
      z
        .string()
        .trim()
        .min(2)
        .max(120),
  })
  .strict()

const variantSchema = z
  .object({
    key:
      z
        .string()
        .trim()
        .toLowerCase()
        .min(1)
        .max(80)
        .regex(
          /^[a-z0-9_-]+$/,
        ),

    label:
      z
        .string()
        .trim()
        .min(1)
        .max(160),

    weightBasisPoints:
      z
        .number()
        .int()
        .min(1)
        .max(10000),

    isControl:
      z
        .boolean()
        .default(false),
  })
  .strict()

const experimentCreateBodySchema = z
  .object({
    experimentKey:
      experimentKeySchema,

    name:
      z
        .string()
        .trim()
        .min(3)
        .max(220),

    description:
      z
        .string()
        .trim()
        .min(10)
        .max(1200),

    surfaceType:
      z.enum([
        'presentation',
        'workflow_effort',
        'notification_utility',
        'recommendation_utility',
      ]),

    surfaceKey:
      z
        .string()
        .trim()
        .toLowerCase()
        .min(2)
        .max(160),

    featureFlagKey:
      z
        .string()
        .trim()
        .toLowerCase()
        .min(2)
        .max(160),

    eligibleActorTypes:
      z
        .array(
          z.enum([
            'customer',
            'host',
          ]),
        )
        .min(1)
        .max(2),

    allocationBasisPoints:
      z
        .number()
        .int()
        .min(1)
        .max(10000)
        .default(10000),

    variants:
      z
        .array(
          variantSchema,
        )
        .min(2)
        .max(10),

    primaryUtilityMetricKey:
      z
        .string()
        .trim()
        .min(3)
        .max(180),

    guardrailMetricKeys:
      z
        .array(
          z
            .string()
            .trim()
            .min(3)
            .max(180),
        )
        .max(20)
        .default([]),

    holdoutRequired:
      z
        .boolean()
        .default(true),

    reason:
      z
        .string()
        .trim()
        .min(10)
        .max(1500),
  })
  .strict()
  .superRefine(
    (
      value,
      context,
    ) => {
      const total =
        value.variants.reduce(
          (
            sum,
            variant,
          ) =>
            sum +
            variant.weightBasisPoints,
          0,
        )

      if (
        total !==
        10000
      ) {
        context.addIssue({
          code:
            z.ZodIssueCode.custom,
          path: [
            'variants',
          ],
          message:
            'Variant weights must total exactly 10000 basis points.',
        })
      }
    },
  )

const experimentLifecycleBodySchema = z
  .object({
    reason:
      z
        .string()
        .trim()
        .min(10)
        .max(1500),
  })
  .strict()

function parseOrThrow(
  schema,
  value,
  code,
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
        'Invalid Analytics request.',
      [
        {
          code,
          issues:
            result.error.issues,
        },
      ],
    )
  }

  return result.data
}

function wrap(
  handler,
) {
  return async function analyticsBatch2Controller(
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

function organizationIdHint(
  req,
) {
  const value =
    String(
      req.get(
        'x-epantry-organization-id',
      ) ||
        '',
    ).trim()

  if (!value) {
    return null
  }

  return parseOrThrow(
    objectIdSchema,
    value,
    'HOST_ANALYTICS_ORGANIZATION_ID_INVALID',
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

experimentRouter.use(
  sensitiveResponseNoStoreMiddleware,
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
)

experimentRouter.get(
  '/:experimentKey/assignment',
  wrap(
    async (
      req,
      res,
    ) => {
      const params =
        parseOrThrow(
          experimentParamsSchema,
          req.params,
          'EXPERIMENT_KEY_INVALID',
        )

      return send(
        req,
        res,
        200,
        await getExperimentAssignment({
          experimentKey:
            params.experimentKey,
          actorUser:
            actorUser(
              req,
            ),
          organizationIdHint:
            organizationIdHint(
              req,
            ),
        }),
        'Experiment assignment resolved.',
      )
    },
  ),
)

experimentRouter.post(
  '/:experimentKey/expose',
  requireCsrfToken,
  wrap(
    async (
      req,
      res,
    ) => {
      const params =
        parseOrThrow(
          experimentParamsSchema,
          req.params,
          'EXPERIMENT_KEY_INVALID',
        )

      const input =
        parseOrThrow(
          exposureBodySchema,
          req.body,
          'EXPERIMENT_EXPOSURE_INPUT_INVALID',
        )

      return send(
        req,
        res,
        200,
        await recordExperimentExposure({
          experimentKey:
            params.experimentKey,
          surface:
            input.surface,
          actorUser:
            actorUser(
              req,
            ),
          organizationIdHint:
            organizationIdHint(
              req,
            ),
          correlationId:
            req.requestId,
        }),
        'Experiment exposure recorded.',
      )
    },
  ),
)

hostAnalyticsRouter.use(
  sensitiveResponseNoStoreMiddleware,
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireHostAccess,
  requireMfaAssurance,
)

hostAnalyticsRouter.get(
  '/dashboard',
  wrap(
    async (
      req,
      res,
    ) => {
      const query =
        parseOrThrow(
          reportQuerySchema,
          req.query,
          'HOST_ANALYTICS_QUERY_INVALID',
        )

      return send(
        req,
        res,
        200,
        await getHostAnalyticsDashboard({
          actorUser:
            actorUser(
              req,
            ),
          organizationIdHint:
            organizationIdHint(
              req,
            ),
          start:
            query.start,
          end:
            query.end,
        }),
        'Host analytics loaded.',
      )
    },
  ),
)

adminAnalyticsRouter.use(
  sensitiveResponseNoStoreMiddleware,
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireMfaAssurance,
  loadAdminAuthorization,
  requireAdminAccess,
)

adminAnalyticsRouter.get(
  '/dashboard',
  requireAnyAdminPermission(
    'admin.dashboard.read',
    'admin.audit.read',
    'marketplace.read',
    'trust_safety.read',
  ),
  wrap(
    async (
      req,
      res,
    ) => {
      const query =
        parseOrThrow(
          reportQuerySchema,
          req.query,
          'ADMIN_ANALYTICS_QUERY_INVALID',
        )

      return send(
        req,
        res,
        200,
        await getAdminAnalyticsDashboard({
          adminAuthorization:
            req.adminAuthorization,
          start:
            query.start,
          end:
            query.end,
        }),
        'Administrative analytics loaded.',
      )
    },
  ),
)

adminAnalyticsRouter.get(
  '/experiments',
  requireAnyAdminPermission(
    'admin.dashboard.read',
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
        await listExperimentDefinitions({
          adminAuthorization:
            req.adminAuthorization,
        }),
        'Experiment definitions loaded.',
      ),
  ),
)

adminAnalyticsRouter.post(
  '/experiments',
  requireCsrfToken,
  requireRecentMfaAuthentication,
  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          experimentCreateBodySchema,
          req.body,
          'EXPERIMENT_DEFINITION_INPUT_INVALID',
        )

      return send(
        req,
        res,
        201,
        await createExperimentDefinition({
          input,
          actorUser:
            actorUser(
              req,
            ),
          adminAuthorization:
            req.adminAuthorization,
        }),
        'Experiment Definition created.',
      )
    },
  ),
)

adminAnalyticsRouter.post(
  '/experiments/:id/:action',
  requireCsrfToken,
  requireRecentMfaAuthentication,
  wrap(
    async (
      req,
      res,
    ) => {
      const params =
        parseOrThrow(
          experimentIdActionParamsSchema,
          req.params,
          'EXPERIMENT_ACTION_PARAMS_INVALID',
        )

      const input =
        parseOrThrow(
          experimentLifecycleBodySchema,
          req.body,
          'EXPERIMENT_ACTION_INPUT_INVALID',
        )

      return send(
        req,
        res,
        200,
        await changeExperimentStatus({
          experimentId:
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
        }),
        'Experiment lifecycle updated.',
      )
    },
  ),
)

export {
  adminAnalyticsRouter,
  experimentRouter,
  hostAnalyticsRouter,
}