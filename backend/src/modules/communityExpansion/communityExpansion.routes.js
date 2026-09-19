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
  requireCustomerAccess,
} from '../auth/authorization.middleware.js'

import {
  COMMUNITY_REPORT_REASONS,
  COMMUNITY_REPORT_SUBJECT_TYPES,
  CREATOR_CONTENT_TYPES,
} from './communityExpansion.models.js'

import {
  listAdminCommunityReports,
  listAdminCreatorContent,
  listMyCreatorContent,
  registerCreatorContentGovernance,
  reportCommunityContent,
  resolveAdminCommunityReport,
  reviewAdminCreatorContent,
  updateCommunityPrivacy,
} from './communityExpansion.service.js'

const router = Router()

const objectIdSchema =
  z
    .string()
    .trim()
    .regex(
      /^[a-f\d]{24}$/i,
      'A valid MongoDB ObjectId is required.',
    )

const registerCreatorContentSchema =
  z
    .object({
      contentType:
        z.enum(
          CREATOR_CONTENT_TYPES,
        ),

      contentId:
        objectIdSchema,

      rights:
        z
          .object({
            ownerOrLicensor:
              z
                .string()
                .trim()
                .min(2)
                .max(300),

            allowedTerritories:
              z
                .array(
                  z
                    .string()
                    .trim()
                    .min(2)
                    .max(10),
                )
                .max(30)
                .default([]),

            publishFrom:
              z.coerce
                .date()
                .nullable()
                .optional()
                .default(null),

            publishUntil:
              z.coerce
                .date()
                .nullable()
                .optional()
                .default(null),

            downloadAllowed:
              z.boolean()
                .default(false),

            sponsored:
              z.boolean()
                .default(false),

            sponsorLabel:
              z
                .enum([
                  'Sponsored',
                  'Ad',
                  'Paid collaboration',
                ])
                .default('Sponsored'),

            disclosureText:
              z
                .string()
                .trim()
                .max(2000)
                .default(''),
          })
          .strict(),
    })
    .strict()
    .superRefine(
      (value, context) => {
        if (
          value.rights.publishFrom &&
          value.rights.publishUntil &&
          value.rights.publishUntil <=
            value.rights.publishFrom
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              'rights',
              'publishUntil',
            ],

            message:
              'Creator content publication window is invalid.',
          })
        }

        if (
          value.rights.sponsored ===
            true &&
          value.rights.disclosureText.length <
            5
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              'rights',
              'disclosureText',
            ],

            message:
              'Sponsored creator content requires explicit disclosure.',
          })
        }
      },
    )

const privacySchema =
  z
    .object({
      profilePublic:
        z.boolean()
          .optional(),

      communityRecipeId:
        objectIdSchema
          .optional(),

      recipeVisibility:
        z
          .enum([
            'private',
            'friends',
            'public',
          ])
          .optional(),
    })
    .strict()
    .superRefine(
      (value, context) => {
        if (
          Boolean(
            value.communityRecipeId,
          ) !==
          Boolean(
            value.recipeVisibility,
          )
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              'communityRecipeId',
            ],

            message:
              'communityRecipeId and recipeVisibility must be supplied together.',
          })
        }

        if (
          value.profilePublic ===
            undefined &&
          !value.communityRecipeId
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            message:
              'At least one Community privacy control is required.',
          })
        }
      },
    )

const reportSchema =
  z
    .object({
      subjectType:
        z.enum(
          COMMUNITY_REPORT_SUBJECT_TYPES,
        ),

      subjectId:
        objectIdSchema,

      reason:
        z.enum(
          COMMUNITY_REPORT_REASONS,
        ),

      details:
        z
          .string()
          .trim()
          .max(4000)
          .default(''),

      evidenceRefs:
        z
          .array(
            z
              .string()
              .trim()
              .min(1)
              .max(500),
          )
          .max(20)
          .default([]),
    })
    .strict()

const adminListSchema =
  z
    .object({
      status:
        z
          .string()
          .trim()
          .max(40)
          .default(''),

      governanceState:
        z
          .string()
          .trim()
          .max(40)
          .default(''),

      limit:
        z.coerce
          .number()
          .int()
          .min(1)
          .max(200)
          .default(100),
    })
    .strict()

const creatorContentReviewSchema =
  z
    .object({
      decision:
        z.enum([
          'approved',
          'restricted',
          'removed',
        ]),

      reason:
        z
          .string()
          .trim()
          .min(10)
          .max(4000),

      evidenceRefs:
        z
          .array(
            z
              .string()
              .trim()
              .min(1)
              .max(500),
          )
          .min(1)
          .max(30),
    })
    .strict()

const reportResolutionSchema =
  z
    .object({
      action:
        z.enum([
          'dismiss',
          'quarantine_content',
          'restrict_content',
          'remove_content',
          'suspend_creator',
        ]),

      reason:
        z
          .string()
          .trim()
          .min(10)
          .max(4000),

      evidenceRefs:
        z
          .array(
            z
              .string()
              .trim()
              .min(1)
              .max(500),
          )
          .min(1)
          .max(30),
    })
    .strict()

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

function requireIdempotencyKey(req) {
  return parseOrThrow(
    z
      .string()
      .trim()
      .min(8)
      .max(160),
    req.get(
      'idempotency-key',
    ),
    'M21_COMMUNITY_REPORT_IDEMPOTENCY_REQUIRED',
    'A valid Idempotency-Key header is required.',
  )
}

function wrap(handler) {
  return async function communityExpansionController(
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
      return next(error)
    }
  }
}

function send(
  req,
  res,
  status,
  data,
  message,
) {
  return res
    .status(status)
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

const customerSecurity = [
  sensitiveResponseNoStoreMiddleware,
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireCustomerAccess,
]

const adminSecurity = [
  sensitiveResponseNoStoreMiddleware,
  rejectPrivilegedImpersonation,
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  loadAdminAuthorization,
  requireAdminAccess,
  requireMfaAssurance,
]

router.get(
  '/community-trust/creator-content',
  ...customerSecurity,
  wrap(
    async (req, res) =>
      send(
        req,
        res,
        200,
        await listMyCreatorContent({
          actorUser:
            req.currentUser,
        }),
        'Creator provenance and rights records loaded.',
      ),
  ),
)

router.post(
  '/community-trust/creator-content',
  ...customerSecurity,
  requireCsrfToken,
  wrap(
    async (req, res) => {
      const input =
        parseOrThrow(
          registerCreatorContentSchema,
          req.body,
          'M21_CREATOR_CONTENT_INPUT_INVALID',
          'Invalid Creator content provenance input.',
        )

      return send(
        req,
        res,
        201,
        await registerCreatorContentGovernance({
          input,
          actorUser:
            req.currentUser,
        }),
        'Creator content provenance registered for governance.',
      )
    },
  ),
)

router.patch(
  '/community-trust/privacy',
  ...customerSecurity,
  requireCsrfToken,
  wrap(
    async (req, res) => {
      const input =
        parseOrThrow(
          privacySchema,
          req.body,
          'M21_COMMUNITY_PRIVACY_INPUT_INVALID',
          'Invalid Community privacy control.',
        )

      return send(
        req,
        res,
        200,
        await updateCommunityPrivacy({
          input,
          actorUser:
            req.currentUser,
        }),
        'Community privacy controls updated.',
      )
    },
  ),
)

router.post(
  '/community-trust/reports',
  ...customerSecurity,
  requireCsrfToken,
  wrap(
    async (req, res) => {
      const input =
        parseOrThrow(
          reportSchema,
          req.body,
          'M21_COMMUNITY_REPORT_INPUT_INVALID',
          'Invalid Community report.',
        )

      return send(
        req,
        res,
        201,
        await reportCommunityContent({
          input,
          idempotencyKey:
            requireIdempotencyKey(
              req,
            ),
          actorUser:
            req.currentUser,
        }),
        'Community trust report recorded.',
      )
    },
  ),
)

router.get(
  '/admin/community-trust/reports',
  ...adminSecurity,
  requireAnyAdminPermission(
    'trust_safety.read',
    'recipe.read',
  ),
  wrap(
    async (req, res) => {
      const query =
        parseOrThrow(
          adminListSchema,
          req.query,
          'M21_COMMUNITY_REPORT_ADMIN_QUERY_INVALID',
          'Invalid Community report query.',
        )

      return send(
        req,
        res,
        200,
        await listAdminCommunityReports({
          status:
            query.status,
          limit:
            query.limit,
        }),
        'Community trust report queue loaded.',
      )
    },
  ),
)

router.post(
  '/admin/community-trust/reports/:reportId/resolve',
  ...adminSecurity,
  requireCsrfToken,
  requireRecentMfaAuthentication,
  requireAnyAdminPermission(
    'trust_safety.mutate',
  ),
  wrap(
    async (req, res) => {
      const reportId =
        parseOrThrow(
          objectIdSchema,
          req.params.reportId,
          'M21_COMMUNITY_REPORT_ID_INVALID',
          'Invalid Community report ID.',
        )

      const input =
        parseOrThrow(
          reportResolutionSchema,
          req.body,
          'M21_COMMUNITY_REPORT_RESOLUTION_INVALID',
          'Invalid Community report resolution.',
        )

      return send(
        req,
        res,
        200,
        await resolveAdminCommunityReport({
          reportId,
          input,
          actorUser:
            req.currentUser,
          adminAuthorization:
            req.adminAuthorization,
          requestId:
            req.requestId,
        }),
        'Community report resolution recorded.',
      )
    },
  ),
)

router.get(
  '/admin/community-trust/creator-content',
  ...adminSecurity,
  requireAnyAdminPermission(
    'trust_safety.read',
    'recipe.read',
  ),
  wrap(
    async (req, res) => {
      const query =
        parseOrThrow(
          adminListSchema,
          req.query,
          'M21_CREATOR_CONTENT_ADMIN_QUERY_INVALID',
          'Invalid Creator content governance query.',
        )

      return send(
        req,
        res,
        200,
        await listAdminCreatorContent({
          governanceState:
            query.governanceState,
          limit:
            query.limit,
        }),
        'Creator content governance queue loaded.',
      )
    },
  ),
)

router.post(
  '/admin/community-trust/creator-content/:creatorContentId/review',
  ...adminSecurity,
  requireCsrfToken,
  requireRecentMfaAuthentication,
  requireAnyAdminPermission(
    'trust_safety.mutate',
  ),
  wrap(
    async (req, res) => {
      const creatorContentId =
        parseOrThrow(
          objectIdSchema,
          req.params.creatorContentId,
          'M21_CREATOR_CONTENT_ID_INVALID',
          'Invalid Creator content governance ID.',
        )

      const input =
        parseOrThrow(
          creatorContentReviewSchema,
          req.body,
          'M21_CREATOR_CONTENT_REVIEW_INVALID',
          'Invalid Creator content governance decision.',
        )

      return send(
        req,
        res,
        200,
        await reviewAdminCreatorContent({
          creatorContentId,
          input,
          actorUser:
            req.currentUser,
          adminAuthorization:
            req.adminAuthorization,
          requestId:
            req.requestId,
        }),
        'Creator content governance decision recorded.',
      )
    },
  ),
)

export default router