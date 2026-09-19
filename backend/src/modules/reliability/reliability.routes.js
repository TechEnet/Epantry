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
  requireRecentMfaAuthentication,
} from '../auth/auth.middleware.js'

import {
  listSecurityEvents,
} from '../hardening/hardening.service.js'

import {
  listPrivacyRequestsForAdmin,
  updatePrivacyRequestForAdmin,
} from '../hardening/privacyOps.service.js'

import {
  getDeploymentSecurityOverview,
} from './deploymentSecurity.service.js'

import {
  getReliabilityOverview,
  listJobRuns,
  listLaunchGateRuns,
  listRecoveryEvidence,
  recordRecoveryEvidence,
  runLaunchGate,
} from './reliability.service.js'

const adminReliabilityRouter =
  Router()

const listQuerySchema = z
  .object({
    limit:
      z.coerce
        .number()
        .int()
        .min(1)
        .max(200)
        .default(100),

    status:
      z.string()
        .trim()
        .max(80)
        .optional(),

    severity:
      z.enum([
        'info',
        'warning',
        'critical',
      ])
        .optional(),

    environment:
      z.enum([
        'staging',
        'production',
      ])
        .optional(),

    evidenceType:
      z.enum([
        'restore_drill',
        'rollback_drill',
      ])
        .optional(),

    requestType:
      z.enum([
        'access_export',
        'deletion',
      ])
        .optional(),
  })
  .strict()

const launchEvidenceItemSchema = z
  .object({
    status:
      z.enum([
        'pass',
        'fail',
        'not_run',
      ]),

    evidenceRef:
      z.string()
        .trim()
        .max(500)
        .default(''),

    observedAt:
      z.coerce
        .date()
        .nullable()
        .optional(),

    summary:
      z.string()
        .trim()
        .max(1200)
        .default(''),
  })
  .strict()

const launchGateRunSchema = z
  .object({
    releaseRef:
      z.string()
        .trim()
        .min(1)
        .max(220),

    environment:
      z.enum([
        'staging',
        'production',
      ]),

    reason:
      z.string()
        .trim()
        .min(1)
        .max(2000),

    evidence:
      z.object({
        securityRegression:
          launchEvidenceItemSchema,

        recipeScaling:
          launchEvidenceItemSchema,

        pantryExclusion:
          launchEvidenceItemSchema,

        landedCost:
          launchEvidenceItemSchema,

        nutritionTraceability:
          launchEvidenceItemSchema,

        allergenFailClosed:
          launchEvidenceItemSchema,

        aiAdversarial:
          launchEvidenceItemSchema,

        economicIdempotency:
          launchEvidenceItemSchema,

        tenantIsolation:
          launchEvidenceItemSchema,

        dishPassportReproducibility:
          launchEvidenceItemSchema,

        privilegedAudit:
          launchEvidenceItemSchema,

        privacyJurisdictionReview:
          launchEvidenceItemSchema,

        loadRegression:
          launchEvidenceItemSchema,

        browserAccessibility:
          launchEvidenceItemSchema,
      })
        .strict(),
  })
  .strict()

const recoveryEvidenceBodySchema = z
  .object({
    evidenceType:
      z.enum([
        'restore_drill',
        'rollback_drill',
      ]),

    environment:
      z.enum([
        'staging',
        'production',
      ]),

    sourceSnapshotRef:
      z.string()
        .trim()
        .min(1)
        .max(500),

    restoredTargetRef:
      z.string()
        .trim()
        .min(1)
        .max(500),

    recoveryPointAt:
      z.coerce.date(),

    startedAt:
      z.coerce.date(),

    completedAt:
      z.coerce.date(),

    verificationChecks:
      z.object({
        integrityCheckPassed:
          z.boolean(),

        applicationSmokePassed:
          z.boolean(),

        tenantIsolationPassed:
          z.boolean(),
      })
        .strict(),

    evidenceRefs:
      z.array(
        z.string()
          .trim()
          .min(1)
          .max(500),
      )
        .max(20)
        .default([]),

    notes:
      z.string()
        .trim()
        .max(4000)
        .default(''),

    reason:
      z.string()
        .trim()
        .min(1)
        .max(2000),
  })
  .strict()

const privacyRequestParamsSchema = z
  .object({
    id:
      z.string()
        .regex(
          /^[0-9a-f]{24}$/i,
          'Invalid privacy request ID.',
        ),
  })
  .strict()

const privacyRequestUpdateSchema = z
  .object({
    status:
      z.enum([
        'submitted',
        'in_review',
        'blocked',
        'processing',
        'completed',
        'rejected',
        'cancelled',
      ]),

    blockedReasonCode:
      z.string()
        .trim()
        .max(160)
        .default(''),

    exportArtifactStatus:
      z.enum([
        'not_generated',
        'available',
        'expired',
      ])
        .optional(),

    reason:
      z.string()
        .trim()
        .min(1)
        .max(2000),
  })
  .strict()

function parseOrThrow(
  schema,
  value,
  code,
) {
  const parsed =
    schema.safeParse(
      value,
    )

  if (!parsed.success) {
    throw new ApiError(
      400,
      parsed.error
        .issues[0]
        ?.message ||
        'Invalid reliability request.',
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
  return async function reliabilityController(
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
  data,
  message,
  status = 200,
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

adminReliabilityRouter.use(
  sensitiveResponseNoStoreMiddleware,
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireMfaAssurance,
  loadAdminAuthorization,
  requireAdminAccess,
)

adminReliabilityRouter.get(
  '/overview',

  requireAnyAdminPermission(
    'admin.dashboard.read',
    'admin.audit.read',
    'trust_safety.read',
  ),

  wrap(
    async (
      req,
      res,
    ) =>
      send(
        req,
        res,

        await getReliabilityOverview(),

        'Reliability overview loaded.',
      ),
  ),
)

adminReliabilityRouter.get(
  '/deployment-security',

  requireAnyAdminPermission(
    'admin.dashboard.read',
    'admin.audit.read',
    'trust_safety.read',
  ),

  wrap(
    async (
      req,
      res,
    ) =>
      send(
        req,
        res,

        await getDeploymentSecurityOverview(),

        'Deployment security overview loaded.',
      ),
  ),
)

adminReliabilityRouter.get(
  '/job-runs',

  requireAnyAdminPermission(
    'admin.audit.read',
    'trust_safety.read',
  ),

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          listQuerySchema,
          req.query,
          'JOB_RUN_QUERY_INVALID',
        )

      return send(
        req,
        res,

        await listJobRuns({
          limit:
            input.limit,

          status:
            input.status ||
            null,
        }),

        'Job Runs loaded.',
      )
    },
  ),
)

adminReliabilityRouter.get(
  '/security-events',

  requireAnyAdminPermission(
    'admin.audit.read',
    'trust_safety.read',
  ),

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          listQuerySchema,
          req.query,
          'SECURITY_EVENT_QUERY_INVALID',
        )

      return send(
        req,
        res,

        await listSecurityEvents({
          limit:
            input.limit,

          severity:
            input.severity ||
            null,
        }),

        'Security Events loaded.',
      )
    },
  ),
)

adminReliabilityRouter.get(
  '/launch-gates',

  requireAnyAdminPermission(
    'admin.audit.read',
    'trust_safety.read',
  ),

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          listQuerySchema,
          req.query,
          'LAUNCH_GATE_QUERY_INVALID',
        )

      return send(
        req,
        res,

        await listLaunchGateRuns({
          limit:
            input.limit,

          status:
            input.status ||
            null,

          environment:
            input.environment ||
            null,
        }),

        'Launch Gate runs loaded.',
      )
    },
  ),
)

adminReliabilityRouter.post(
  '/launch-gates/run',

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
          launchGateRunSchema,
          req.body,
          'LAUNCH_GATE_INPUT_INVALID',
        )

      return send(
        req,
        res,

        await runLaunchGate({
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

        'Launch Gate run recorded.',

        201,
      )
    },
  ),
)

adminReliabilityRouter.get(
  '/recovery-evidence',

  requireAnyAdminPermission(
    'admin.audit.read',
    'trust_safety.read',
  ),

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          listQuerySchema,
          req.query,
          'RECOVERY_EVIDENCE_QUERY_INVALID',
        )

      return send(
        req,
        res,

        await listRecoveryEvidence({
          limit:
            input.limit,

          environment:
            input.environment ||
            null,

          evidenceType:
            input.evidenceType ||
            null,
        }),

        'Recovery evidence loaded.',
      )
    },
  ),
)

adminReliabilityRouter.post(
  '/recovery-evidence',

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
          recoveryEvidenceBodySchema,
          req.body,
          'RECOVERY_EVIDENCE_INPUT_INVALID',
        )

      return send(
        req,
        res,

        await recordRecoveryEvidence({
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

        'Recovery evidence recorded.',

        201,
      )
    },
  ),
)

adminReliabilityRouter.get(
  '/privacy-requests',

  requireAnyAdminPermission(
    'admin.audit.read',
    'trust_safety.read',
  ),

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          listQuerySchema,
          req.query,
          'PRIVACY_OPS_QUERY_INVALID',
        )

      return send(
        req,
        res,

        await listPrivacyRequestsForAdmin({
          limit:
            input.limit,

          status:
            input.status ||
            null,

          requestType:
            input.requestType ||
            null,
        }),

        'Privacy rights requests loaded.',
      )
    },
  ),
)

adminReliabilityRouter.patch(
  '/privacy-requests/:id',

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
          privacyRequestParamsSchema,
          req.params,
          'PRIVACY_OPS_ID_INVALID',
        )

      const input =
        parseOrThrow(
          privacyRequestUpdateSchema,
          req.body,
          'PRIVACY_OPS_INPUT_INVALID',
        )

      return send(
        req,
        res,

        await updatePrivacyRequestForAdmin({
          privacyRequestId:
            params.id,

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

        'Privacy rights request updated.',
      )
    },
  ),
)

export {
  adminReliabilityRouter,
}