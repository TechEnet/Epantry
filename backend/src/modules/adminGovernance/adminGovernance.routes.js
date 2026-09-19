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
  rejectPrivilegedImpersonation,
} from '../admin/adminSafety.middleware.js'

import {
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireCsrfToken,
  requireMfaAssurance,
  requireRecentMfaAuthentication,
} from '../auth/auth.middleware.js'

import {
  assignAdminReviewCase,
  createAdminFeatureFlag,
  createAdminIncident,
  createAdminReviewCase,
  createAdminSupportCase,
  decideAdminReviewCase,
  executeAdminGovernanceAction,
  getAdminGovernanceCommandCenter,
  getAdminPolicyOverview,
  getAdminReviewCase,
  listAdminFeatureFlags,
  listAdminIncidents,
  listAdminReviewCases,
  listAdminSupportCases,
  searchAdminGovernance,
  updateAdminFeatureFlag,
  updateAdminIncident,
  updateAdminSupportCase,
} from './adminGovernance.service.js'

import {
  adminGovernanceIdParamsSchema,
  adminGovernanceSearchQuerySchema,
  assignReviewCaseBodySchema,
  createFeatureFlagBodySchema,
  createIncidentBodySchema,
  createReviewCaseBodySchema,
  createSupportCaseBodySchema,
  decideReviewCaseBodySchema,
  executeGovernanceActionBodySchema,
  listFeatureFlagsQuerySchema,
  listIncidentsQuerySchema,
  listReviewCasesQuerySchema,
  listSupportCasesQuerySchema,
  updateFeatureFlagBodySchema,
  updateIncidentBodySchema,
  updateSupportCaseBodySchema,
} from './adminGovernance.validation.js'

const router =
  Router()

const adminRouter =
  Router()

const GOVERNANCE_READ_PERMISSIONS = [
  'admin.dashboard.read',
  'admin.audit.read',
  'admin.roles.read',
  'admin.assignments.read',
  'host.review.read',
  'catalog.read',
  'recipe.read',
  'marketplace.read',
  'trust_safety.read',
  'finance.read',
  'cms.read',
]

const GOVERNANCE_MUTATE_PERMISSIONS = [
  'admin.roles.manage',
  'admin.assignments.manage',
  'host.review.approve',
  'host.review.reject',
  'host.review.suspend',
  'catalog.mutate',
  'catalog.publish',
  'recipe.mutate',
  'recipe.publish',
  'marketplace.mutate',
  'trust_safety.mutate',
  'finance.mutate',
  'cms.mutate',
  'cms.publish',
]

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

  if (
    !parsed.success
  ) {
    throw new ApiError(
      400,
      parsed.error
        .issues[0]
        ?.message ||
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

function wrap(
  handler,
) {
  return async function adminGovernanceController(
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

function actorUser(
  req,
) {
  return req.currentUser ||
    req.user
}

function requireResolvedRootSuperAdmin(
  req,
  res,
  next,
) {
  if (
    req.adminAuthorization
      ?.isRootSuperAdmin ===
    true
  ) {
    return next()
  }

  return next(
    new ApiError(
      403,
      'Real Super Admin authority is required for platform feature-flag mutation.',
      [
        {
          code:
            'ADMIN_GOVERNANCE_ROOT_SUPER_ADMIN_REQUIRED',
        },
      ],
    ),
  )
}

/*
|--------------------------------------------------------------------------
| Entire M17 Governance Surface
|--------------------------------------------------------------------------
|
| Internal admins are resolved exclusively by M03:
|
| real Super Admin
|        OR
| AdminAssignment -> AdminRole -> permissionKeys
|
| activeMode is never consulted.
|
*/

adminRouter.use(
  sensitiveResponseNoStoreMiddleware,
  rejectPrivilegedImpersonation,
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  loadAdminAuthorization,
  requireAdminAccess,
  requireMfaAssurance,
)

/*
|--------------------------------------------------------------------------
| Part 2 - Command Center + Global Search
|--------------------------------------------------------------------------
*/

adminRouter.get(
  '/command-center',

  requireAnyAdminPermission(
    ...GOVERNANCE_READ_PERMISSIONS,
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
        await getAdminGovernanceCommandCenter({
          adminAuthorization:
            req.adminAuthorization,
        }),
        'Admin governance command center loaded.',
      ),
  ),
)

adminRouter.get(
  '/search',

  requireAnyAdminPermission(
    ...GOVERNANCE_READ_PERMISSIONS,
  ),

  wrap(
    async (
      req,
      res,
    ) => {
      const query =
        parseOrThrow(
          adminGovernanceSearchQuerySchema,
          req.query,
          'ADMIN_GOVERNANCE_SEARCH_QUERY_INVALID',
          'Invalid governance search query.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await searchAdminGovernance({
          query,
          adminAuthorization:
            req.adminAuthorization,
        }),
        'Admin governance search completed.',
      )
    },
  ),
)

/*
|--------------------------------------------------------------------------
| Part 1 - Unified Review Cases
|--------------------------------------------------------------------------
*/

adminRouter.get(
  '/review-cases',

  requireAnyAdminPermission(
    ...GOVERNANCE_READ_PERMISSIONS,
  ),

  wrap(
    async (
      req,
      res,
    ) => {
      const query =
        parseOrThrow(
          listReviewCasesQuerySchema,
          req.query,
          'ADMIN_REVIEW_CASE_QUERY_INVALID',
          'Invalid review-case query.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await listAdminReviewCases({
          query,
          adminAuthorization:
            req.adminAuthorization,
        }),
        'Review cases loaded.',
      )
    },
  ),
)

adminRouter.get(
  '/review-cases/:id',

  requireAnyAdminPermission(
    ...GOVERNANCE_READ_PERMISSIONS,
  ),

  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          adminGovernanceIdParamsSchema,
          req.params,
          'ADMIN_REVIEW_CASE_ID_INVALID',
          'Invalid review-case ID.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await getAdminReviewCase({
          reviewCaseId:
            id,
          adminAuthorization:
            req.adminAuthorization,
        }),
        'Review case loaded.',
      )
    },
  ),
)

adminRouter.post(
  '/review-cases',

  requireCsrfToken,
  requireRecentMfaAuthentication,

  requireAnyAdminPermission(
    ...GOVERNANCE_MUTATE_PERMISSIONS,
  ),

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          createReviewCaseBodySchema,
          req.body,
          'ADMIN_REVIEW_CASE_INPUT_INVALID',
          'Invalid review-case input.',
        )

      return sendSuccess(
        req,
        res,
        201,
        await createAdminReviewCase({
          input,
          actorUser:
            actorUser(req),
          adminAuthorization:
            req.adminAuthorization,
          requestId:
            req.requestId,
        }),
        'Review case created.',
      )
    },
  ),
)

adminRouter.post(
  '/review-cases/:id/assign',

  requireCsrfToken,
  requireRecentMfaAuthentication,

  requireAnyAdminPermission(
    ...GOVERNANCE_MUTATE_PERMISSIONS,
  ),

  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          adminGovernanceIdParamsSchema,
          req.params,
          'ADMIN_REVIEW_CASE_ID_INVALID',
          'Invalid review-case ID.',
        )

      const input =
        parseOrThrow(
          assignReviewCaseBodySchema,
          req.body,
          'ADMIN_REVIEW_CASE_ASSIGNMENT_INVALID',
          'Invalid review-case assignment.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await assignAdminReviewCase({
          reviewCaseId:
            id,
          input,
          actorUser:
            actorUser(req),
          adminAuthorization:
            req.adminAuthorization,
          requestId:
            req.requestId,
        }),
        'Review case assignment updated.',
      )
    },
  ),
)

adminRouter.post(
  '/review-cases/:id/decision',

  requireCsrfToken,
  requireRecentMfaAuthentication,

  requireAnyAdminPermission(
    ...GOVERNANCE_MUTATE_PERMISSIONS,
  ),

  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          adminGovernanceIdParamsSchema,
          req.params,
          'ADMIN_REVIEW_CASE_ID_INVALID',
          'Invalid review-case ID.',
        )

      const input =
        parseOrThrow(
          decideReviewCaseBodySchema,
          req.body,
          'ADMIN_REVIEW_CASE_DECISION_INVALID',
          'Invalid review-case decision.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await decideAdminReviewCase({
          reviewCaseId:
            id,
          input,
          actorUser:
            actorUser(req),
          adminAuthorization:
            req.adminAuthorization,
          requestId:
            req.requestId,
        }),
        'Review case decision recorded.',
      )
    },
  ),
)

/*
|--------------------------------------------------------------------------
| Part 1 - Incidents
|--------------------------------------------------------------------------
*/

adminRouter.get(
  '/incidents',

  requireAnyAdminPermission(
    ...GOVERNANCE_READ_PERMISSIONS,
  ),

  wrap(
    async (
      req,
      res,
    ) => {
      const query =
        parseOrThrow(
          listIncidentsQuerySchema,
          req.query,
          'ADMIN_INCIDENT_QUERY_INVALID',
          'Invalid incident query.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await listAdminIncidents({
          query,
          adminAuthorization:
            req.adminAuthorization,
        }),
        'Incidents loaded.',
      )
    },
  ),
)

adminRouter.post(
  '/incidents',

  requireCsrfToken,
  requireRecentMfaAuthentication,

  requireAnyAdminPermission(
    ...GOVERNANCE_MUTATE_PERMISSIONS,
  ),

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          createIncidentBodySchema,
          req.body,
          'ADMIN_INCIDENT_INPUT_INVALID',
          'Invalid incident input.',
        )

      return sendSuccess(
        req,
        res,
        201,
        await createAdminIncident({
          input,
          actorUser:
            actorUser(req),
          adminAuthorization:
            req.adminAuthorization,
          requestId:
            req.requestId,
        }),
        'Incident created.',
      )
    },
  ),
)

adminRouter.patch(
  '/incidents/:id',

  requireCsrfToken,
  requireRecentMfaAuthentication,

  requireAnyAdminPermission(
    ...GOVERNANCE_MUTATE_PERMISSIONS,
  ),

  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          adminGovernanceIdParamsSchema,
          req.params,
          'ADMIN_INCIDENT_ID_INVALID',
          'Invalid incident ID.',
        )

      const input =
        parseOrThrow(
          updateIncidentBodySchema,
          req.body,
          'ADMIN_INCIDENT_UPDATE_INVALID',
          'Invalid incident update.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await updateAdminIncident({
          incidentId:
            id,
          input,
          actorUser:
            actorUser(req),
          adminAuthorization:
            req.adminAuthorization,
          requestId:
            req.requestId,
        }),
        'Incident updated.',
      )
    },
  ),
)

/*
|--------------------------------------------------------------------------
| Part 1 - Support Cases
|--------------------------------------------------------------------------
*/

adminRouter.get(
  '/support-cases',

  requireAnyAdminPermission(
    ...GOVERNANCE_READ_PERMISSIONS,
  ),

  wrap(
    async (
      req,
      res,
    ) => {
      const query =
        parseOrThrow(
          listSupportCasesQuerySchema,
          req.query,
          'ADMIN_SUPPORT_CASE_QUERY_INVALID',
          'Invalid support-case query.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await listAdminSupportCases({
          query,
          adminAuthorization:
            req.adminAuthorization,
        }),
        'Support cases loaded.',
      )
    },
  ),
)

adminRouter.post(
  '/support-cases',

  requireCsrfToken,
  requireRecentMfaAuthentication,

  requireAnyAdminPermission(
    ...GOVERNANCE_MUTATE_PERMISSIONS,
  ),

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          createSupportCaseBodySchema,
          req.body,
          'ADMIN_SUPPORT_CASE_INPUT_INVALID',
          'Invalid support-case input.',
        )

      return sendSuccess(
        req,
        res,
        201,
        await createAdminSupportCase({
          input,
          actorUser:
            actorUser(req),
          adminAuthorization:
            req.adminAuthorization,
          requestId:
            req.requestId,
        }),
        'Support case created.',
      )
    },
  ),
)

adminRouter.patch(
  '/support-cases/:id',

  requireCsrfToken,
  requireRecentMfaAuthentication,

  requireAnyAdminPermission(
    ...GOVERNANCE_MUTATE_PERMISSIONS,
  ),

  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          adminGovernanceIdParamsSchema,
          req.params,
          'ADMIN_SUPPORT_CASE_ID_INVALID',
          'Invalid support-case ID.',
        )

      const input =
        parseOrThrow(
          updateSupportCaseBodySchema,
          req.body,
          'ADMIN_SUPPORT_CASE_UPDATE_INVALID',
          'Invalid support-case update.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await updateAdminSupportCase({
          supportCaseId:
            id,
          input,
          actorUser:
            actorUser(req),
          adminAuthorization:
            req.adminAuthorization,
          requestId:
            req.requestId,
        }),
        'Support case updated.',
      )
    },
  ),
)

/*
|--------------------------------------------------------------------------
| Part 3 - Policy / Feature Flags
|--------------------------------------------------------------------------
|
| M08 RuleProfile remains the governed food-rule source of truth.
| M17 only adds platform feature flags and an aggregation view.
|
| Feature-flag writes are intentionally restricted to resolved real
| Super Admin authority. No new top-level application role is introduced.
|
*/

adminRouter.get(
  '/policy',

  requireAnyAdminPermission(
    'admin.dashboard.read',
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
        await getAdminPolicyOverview({
          adminAuthorization:
            req.adminAuthorization,
        }),
        'Platform policy overview loaded.',
      ),
  ),
)

adminRouter.get(
  '/feature-flags',

  requireAnyAdminPermission(
    'admin.dashboard.read',
  ),

  wrap(
    async (
      req,
      res,
    ) => {
      const query =
        parseOrThrow(
          listFeatureFlagsQuerySchema,
          req.query,
          'ADMIN_FEATURE_FLAG_QUERY_INVALID',
          'Invalid feature-flag query.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await listAdminFeatureFlags({
          query,
          adminAuthorization:
            req.adminAuthorization,
        }),
        'Feature flags loaded.',
      )
    },
  ),
)

adminRouter.post(
  '/feature-flags',

  requireCsrfToken,
  requireRecentMfaAuthentication,
  requireResolvedRootSuperAdmin,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          createFeatureFlagBodySchema,
          req.body,
          'ADMIN_FEATURE_FLAG_INPUT_INVALID',
          'Invalid feature-flag input.',
        )

      return sendSuccess(
        req,
        res,
        201,
        await createAdminFeatureFlag({
          input,
          actorUser:
            actorUser(req),
          adminAuthorization:
            req.adminAuthorization,
          requestId:
            req.requestId,
        }),
        'Feature flag created.',
      )
    },
  ),
)

adminRouter.patch(
  '/feature-flags/:id',

  requireCsrfToken,
  requireRecentMfaAuthentication,
  requireResolvedRootSuperAdmin,

  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          adminGovernanceIdParamsSchema,
          req.params,
          'ADMIN_FEATURE_FLAG_ID_INVALID',
          'Invalid feature-flag ID.',
        )

      const input =
        parseOrThrow(
          updateFeatureFlagBodySchema,
          req.body,
          'ADMIN_FEATURE_FLAG_UPDATE_INVALID',
          'Invalid feature-flag update.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await updateAdminFeatureFlag({
          featureFlagId:
            id,
          input,
          actorUser:
            actorUser(req),
          adminAuthorization:
            req.adminAuthorization,
          requestId:
            req.requestId,
        }),
        'Feature flag updated.',
      )
    },
  ),
)

/*
|--------------------------------------------------------------------------
| Part 3 - Controlled Quarantine / Disable / Recover Commands
|--------------------------------------------------------------------------
|
| No direct canonical write occurs here.
|
| product_version quarantine/disable -> M04 retirement service
| recipe_version quarantine/disable  -> M07 lifecycle service
| dish quarantine/disable/recover     -> M07 lifecycle service
|
| ProductVersion and RecipeVersion recovery never rewrites history.
|
*/

adminRouter.post(
  '/actions/execute',

  requireCsrfToken,
  requireRecentMfaAuthentication,

  requireAnyAdminPermission(
    'catalog.publish',
    'recipe.mutate',
  ),

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          executeGovernanceActionBodySchema,
          req.body,
          'ADMIN_GOVERNANCE_ACTION_INPUT_INVALID',
          'Invalid governance action.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await executeAdminGovernanceAction({
          input,
          actorUser:
            actorUser(req),
          adminAuthorization:
            req.adminAuthorization,
          requestId:
            req.requestId,
        }),
        'Governance action executed through the owning domain service.',
      )
    },
  ),
)

router.use(
  '/admin/governance',
  adminRouter,
)

export default router