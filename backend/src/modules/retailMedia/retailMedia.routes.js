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
  requireHostAccess,
  requireSuperAdminAccess,
} from '../auth/authorization.middleware.js'

import {
  RETAIL_MEDIA_PLACEMENTS,
  RETAIL_MEDIA_SPONSOR_LABELS,
} from './retailMedia.models.js'

import {
  createRetailMediaCampaignFromBrief,
  createRetailMediaCampaignPaymentIntent,
  decideLowRiskSponsoredPlacement,
  getHostRetailMediaPricing,
  listAdminAdDecisionLogs,
  listAdminRetailMediaCampaigns,
  listHostRetailMediaCampaigns,
  reviewAdminRetailMediaCampaign,
  transitionHostRetailMediaCampaign,
  verifyRetailMediaCampaignPayment,
} from './retailMedia.service.js'

const router = Router()

const objectIdSchema =
  z
    .string()
    .trim()
    .regex(
      /^[a-f\d]{24}$/i,
      'A valid MongoDB ObjectId is required.',
    )

const createFromBriefSchema =
  z
    .object({
      placements:
        z
          .array(
            z.enum(
              RETAIL_MEDIA_PLACEMENTS,
            ),
          )
          .min(1)
          .max(10),

      startsAt:
        z.coerce
          .date()
          .nullable()
          .optional()
          .default(null),

      endsAt:
        z.coerce
          .date()
          .nullable()
          .optional()
          .default(null),

      dailyBudgetMinor:
        z
          .number()
          .int()
          .min(0)
          .default(0),

      lifetimeBudgetMinor:
        z
          .number()
          .int()
          .min(0)
          .default(0),

      bidMinor:
        z
          .number()
          .int()
          .min(0)
          .max(1000000)
          .default(0),

      qualityScore:
        z
          .number()
          .min(0)
          .max(100)
          .default(50),

      contextualTags:
        z
          .array(
            z
              .string()
              .trim()
              .min(1)
              .max(80),
          )
          .max(30)
          .default([]),

      frequencyCapPerContext:
        z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(3),

      headline:
        z
          .string()
          .trim()
          .min(2)
          .max(180),

      body:
        z
          .string()
          .trim()
          .max(500)
          .default(''),

      landingRef:
        z
          .string()
          .trim()
          .min(1)
          .max(500),

      sponsorLabel:
        z
          .enum(
            RETAIL_MEDIA_SPONSOR_LABELS,
          )
          .default('Sponsored'),
    })
    .strict()
    .superRefine(
      (value, context) => {
        if (
          value.startsAt &&
          value.endsAt &&
          value.endsAt <= value.startsAt
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              'endsAt',
            ],

            message:
              'Campaign end must be after campaign start.',
          })
        }

        if (
          value.dailyBudgetMinor > 0 &&
          value.lifetimeBudgetMinor > 0 &&
          value.dailyBudgetMinor > value.lifetimeBudgetMinor
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              'dailyBudgetMinor',
            ],

            message:
              'Daily budget cannot exceed lifetime budget.',
          })
        }
      },
    )

const paymentVerifySchema =
  z
    .object({
      razorpayPaymentId:
        z
          .string()
          .trim()
          .min(1)
          .max(180),

      razorpayOrderId:
        z
          .string()
          .trim()
          .min(1)
          .max(180),

      razorpaySignature:
        z
          .string()
          .trim()
          .min(1)
          .max(240),
    })
    .strict()

const transitionSchema =
  z
    .object({
      action:
        z.enum([
          'activate',
          'pause',
          'resume',
        ]),
    })
    .strict()

const adminReviewSchema =
  z
    .object({
      decision:
        z.enum([
          'approve',
          'reject',
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

const decisionSchema =
  z
    .object({
      placement:
        z.enum(
          RETAIL_MEDIA_PLACEMENTS,
        ),

      marketCode:
        z
          .string()
          .trim()
          .min(2)
          .max(10)
          .default('IN'),

      contextTags:
        z
          .array(
            z
              .string()
              .trim()
              .min(1)
              .max(80),
          )
          .max(30)
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

      outcome:
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

function wrap(handler) {
  return async function retailMediaController(
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

const hostSecurity = [
  sensitiveResponseNoStoreMiddleware,
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireHostAccess,
  requireMfaAssurance,
]

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

/*
| Host is the only business-facing application capability.
| Brand/Seller/B2B are lenses inside the Host organization, never roles.
| activeMode is presentation state and is never authorization authority.
*/

router.get(
  '/host/retail-media/pricing',
  ...hostSecurity,
  wrap(
    async (req, res) =>
      send(
        req,
        res,
        200,
        await getHostRetailMediaPricing({
          actorUser:
            req.currentUser,
        }),
        'Retail Media placement pricing loaded.',
      ),
  ),
)

router.get(
  '/host/retail-media/campaigns',
  ...hostSecurity,
  wrap(
    async (req, res) =>
      send(
        req,
        res,
        200,
        await listHostRetailMediaCampaigns({
          actorUser:
            req.currentUser,
        }),
        'Retail Media campaigns loaded.',
      ),
  ),
)

router.post(
  '/host/retail-media/campaigns/from-brief/:briefId',
  ...hostSecurity,
  requireCsrfToken,
  requireRecentMfaAuthentication,
  wrap(
    async (req, res) => {
      const briefId =
        parseOrThrow(
          objectIdSchema,
          req.params.briefId,
          'M21_RETAIL_MEDIA_BRIEF_ID_INVALID',
          'Invalid Campaign Brief ID.',
        )

      const input =
        parseOrThrow(
          createFromBriefSchema,
          req.body,
          'M21_RETAIL_MEDIA_CAMPAIGN_INPUT_INVALID',
          'Invalid Retail Media campaign input.',
        )

      return send(
        req,
        res,
        201,
        await createRetailMediaCampaignFromBrief({
          briefId,
          input,
          actorUser:
            req.currentUser,
        }),
        'Retail Media campaign created from the governed Host Campaign Brief.',
      )
    },
  ),
)

router.post(
  '/host/retail-media/campaigns/:campaignId/payment-intent',
  ...hostSecurity,
  requireCsrfToken,
  requireRecentMfaAuthentication,
  wrap(
    async (req, res) => {
      const campaignId =
        parseOrThrow(
          objectIdSchema,
          req.params.campaignId,
          'M21_RETAIL_MEDIA_CAMPAIGN_ID_INVALID',
          'Invalid Retail Media Campaign ID.',
        )

      return send(
        req,
        res,
        200,
        await createRetailMediaCampaignPaymentIntent({
          campaignId,
          actorUser:
            req.currentUser,
        }),
        'Retail Media test payment initialized.',
      )
    },
  ),
)

router.post(
  '/host/retail-media/campaigns/:campaignId/payment-verify',
  ...hostSecurity,
  requireCsrfToken,
  requireRecentMfaAuthentication,
  wrap(
    async (req, res) => {
      const campaignId =
        parseOrThrow(
          objectIdSchema,
          req.params.campaignId,
          'M21_RETAIL_MEDIA_CAMPAIGN_ID_INVALID',
          'Invalid Retail Media Campaign ID.',
        )

      const input =
        parseOrThrow(
          paymentVerifySchema,
          req.body,
          'M21_RETAIL_MEDIA_PAYMENT_VERIFY_INVALID',
          'Invalid Retail Media payment verification payload.',
        )

      return send(
        req,
        res,
        200,
        await verifyRetailMediaCampaignPayment({
          campaignId,
          input,
          actorUser:
            req.currentUser,
        }),
        'Retail Media test payment verified.',
      )
    },
  ),
)

router.post(
  '/host/retail-media/campaigns/:campaignId/transition',
  ...hostSecurity,
  requireCsrfToken,
  requireRecentMfaAuthentication,
  wrap(
    async (req, res) => {
      const campaignId =
        parseOrThrow(
          objectIdSchema,
          req.params.campaignId,
          'M21_RETAIL_MEDIA_CAMPAIGN_ID_INVALID',
          'Invalid Retail Media Campaign ID.',
        )

      const input =
        parseOrThrow(
          transitionSchema,
          req.body,
          'M21_RETAIL_MEDIA_TRANSITION_INVALID',
          'Invalid Retail Media campaign transition.',
        )

      return send(
        req,
        res,
        200,
        await transitionHostRetailMediaCampaign({
          campaignId,
          action:
            input.action,
          actorUser:
            req.currentUser,
        }),
        'Retail Media campaign state updated.',
      )
    },
  ),
)

/*
| Low-risk Customer placement serving.
|
| The first production lane intentionally serves only brand/generic units.
| Product/recipe units are suppressed until an upstream server-side safety
| eligibility boundary exists. Hard safety can therefore never be purchased.
*/
router.post(
  '/retail-media/decision',
  ...customerSecurity,
  requireCsrfToken,
  wrap(
    async (req, res) => {
      const input =
        parseOrThrow(
          decisionSchema,
          req.body,
          'M21_RETAIL_MEDIA_DECISION_INPUT_INVALID',
          'Invalid sponsored placement context.',
        )

      return send(
        req,
        res,
        200,
        await decideLowRiskSponsoredPlacement({
          input,
        }),
        'Sponsored placement decision completed with organic/safety separation.',
      )
    },
  ),
)

router.get(
  '/admin/retail-media/campaigns',
  ...adminSecurity,
  requireAnyAdminPermission(
    'trust_safety.read',
    'marketplace.read',
  ),
  wrap(
    async (req, res) => {
      const query =
        parseOrThrow(
          adminListSchema,
          req.query,
          'M21_RETAIL_MEDIA_ADMIN_QUERY_INVALID',
          'Invalid Retail Media admin query.',
        )

      return send(
        req,
        res,
        200,
        await listAdminRetailMediaCampaigns({
          status:
            query.status,
          limit:
            query.limit,
        }),
        'Retail Media policy queue loaded.',
      )
    },
  ),
)

router.post(
  '/admin/retail-media/campaigns/:campaignId/review',
  ...adminSecurity,
  requireCsrfToken,
  requireRecentMfaAuthentication,
  requireAnyAdminPermission(
    'trust_safety.mutate',
  ),
  requireSuperAdminAccess,
  wrap(
    async (req, res) => {
      const campaignId =
        parseOrThrow(
          objectIdSchema,
          req.params.campaignId,
          'M21_RETAIL_MEDIA_CAMPAIGN_ID_INVALID',
          'Invalid Retail Media Campaign ID.',
        )

      const input =
        parseOrThrow(
          adminReviewSchema,
          req.body,
          'M21_RETAIL_MEDIA_ADMIN_REVIEW_INVALID',
          'Invalid Retail Media policy decision.',
        )

      return send(
        req,
        res,
        200,
        await reviewAdminRetailMediaCampaign({
          campaignId,
          input,
          actorUser:
            req.currentUser,
          adminAuthorization:
            req.adminAuthorization,
          requestId:
            req.requestId,
        }),
        'Retail Media policy decision recorded.',
      )
    },
  ),
)

router.get(
  '/admin/retail-media/decision-logs',
  ...adminSecurity,
  requireAnyAdminPermission(
    'trust_safety.read',
    'marketplace.read',
  ),
  wrap(
    async (req, res) => {
      const query =
        parseOrThrow(
          adminListSchema,
          req.query,
          'M21_RETAIL_MEDIA_DECISION_LOG_QUERY_INVALID',
          'Invalid Retail Media decision-log query.',
        )

      return send(
        req,
        res,
        200,
        await listAdminAdDecisionLogs({
          outcome:
            query.outcome,
          limit:
            query.limit,
        }),
        'Append-only Retail Media decision evidence loaded.',
      )
    },
  ),
)

export default router