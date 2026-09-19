import express, {
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
  requireHostAccess,
} from '../auth/authorization.middleware.js'

import {
  PARTNER_OPERATIONS,
  PARTNER_TYPES,
} from './executionScale.models.js'

import {
  createPartnerConnection,
  createPurchaseOrdersFromProcurementPlan,
  executeSettlementPayout,
  listAdminExecutionEvidence,
  listHostExecutionScale,
  processPartnerWebhook,
  reconcileSettlementPayout,
  reviewPartnerConnection,
  runHostPartnerSync,
  submitPurchaseOrder,
  transitionPurchaseOrder,
} from './executionScale.service.js'

const router =
  Router()

const webhookRouter =
  Router()

const objectIdSchema =
  z
    .string()
    .trim()
    .regex(
      /^[a-f\d]{24}$/i,
      'A valid MongoDB ObjectId is required.',
    )

const idempotencySchema =
  z
    .string()
    .trim()
    .min(
      8,
    )
    .max(
      180,
    )

const reasonSchema =
  z
    .string()
    .trim()
    .min(
      10,
    )
    .max(
      4000,
    )

const operationPathsSchema =
  z
    .object({
      catalogSync:
        z
          .string()
          .trim()
          .max(
            300,
          )
          .default(
            '',
          ),

      inventorySync:
        z
          .string()
          .trim()
          .max(
            300,
          )
          .default(
            '',
          ),

      supplierPurchaseOrder:
        z
          .string()
          .trim()
          .max(
            300,
          )
          .default(
            '',
          ),

      payoutExecution:
        z
          .string()
          .trim()
          .max(
            300,
          )
          .default(
            '',
          ),
    })
    .strict()

const createPartnerConnectionSchema =
  z
    .object({
      partnerKey:
        z
          .string()
          .trim()
          .toLowerCase()
          .regex(
            /^[a-z][a-z0-9_.-]{2,99}$/,
          ),

      displayName:
        z
          .string()
          .trim()
          .min(
            2,
          )
          .max(
            220,
          ),

      partnerType:
        z.enum(
          PARTNER_TYPES,
        ),

      baseUrl:
        z
          .string()
          .trim()
          .url()
          .max(
            600,
          ),

      credentialEnvKey:
        z
          .union([
            z
              .string()
              .trim()
              .regex(
                /^[A-Z][A-Z0-9_]*$/,
              )
              .max(
                160,
              ),

            z.literal(
              '',
            ),
          ])
          .default(
            '',
          ),

      webhookSecretEnvKey:
        z
          .union([
            z
              .string()
              .trim()
              .regex(
                /^[A-Z][A-Z0-9_]*$/,
              )
              .max(
                160,
              ),

            z.literal(
              '',
            ),
          ])
          .default(
            '',
          ),

      allowedOperations:
        z
          .array(
            z.enum(
              PARTNER_OPERATIONS,
            ),
          )
          .min(
            1,
          )
          .max(
            8,
          ),

      operationPaths:
        operationPathsSchema,
    })
    .strict()

const partnerReviewSchema =
  z
    .object({
      decision:
        z.enum([
          'activate',
          'reject',
          'disable',
        ]),

      reason:
        reasonSchema,
    })
    .strict()

const syncSchema =
  z
    .object({
      operation:
        z.enum([
          'catalog_sync',
          'inventory_sync',
        ]),
    })
    .strict()

const createPurchaseOrdersSchema =
  z
    .object({
      reason:
        reasonSchema,
    })
    .strict()

const purchaseOrderTransitionSchema =
  z
    .object({
      action:
        z.enum([
          'approve',
          'acknowledge',
          'partially_receive',
          'receive',
          'cancel',
          'close',
        ]),

      reason:
        reasonSchema,

      providerReference:
        z
          .string()
          .trim()
          .max(
            300,
          )
          .default(
            '',
          ),

      observedTotalMinor:
        z
          .number()
          .int()
          .min(
            0,
          )
          .nullable()
          .default(
            null,
          ),

      evidenceRefs:
        z
          .array(
            z
              .string()
              .trim()
              .min(
                1,
              )
              .max(
                500,
              ),
          )
          .max(
            30,
          )
          .default(
            [],
          ),
    })
    .strict()
    .superRefine(
      (
        value,
        context,
      ) => {
        if (
          value.action ===
            'receive' &&
          value
            .observedTotalMinor ===
            null
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode
                .custom,

            path: [
              'observedTotalMinor',
            ],

            message:
              'Receiving requires an observed total for deterministic variance evidence.',
          })
        }
      },
    )

const purchaseOrderSubmitSchema =
  z
    .object({
      partnerConnectionId:
        objectIdSchema,
    })
    .strict()

const payoutExecuteSchema =
  z
    .object({
      partnerConnectionId:
        objectIdSchema,
    })
    .strict()

const payoutReconcileSchema =
  z
    .object({
      outcome:
        z.enum([
          'matched',
          'variance',
          'manual_review',
        ]),

      observedAmountMinor:
        z
          .number()
          .int()
          .min(
            0,
          ),

      providerReference:
        z
          .string()
          .trim()
          .min(
            1,
          )
          .max(
            300,
          ),

      evidenceRefs:
        z
          .array(
            z
              .string()
              .trim()
              .min(
                1,
              )
              .max(
                500,
              ),
          )
          .min(
            1,
          )
          .max(
            30,
          ),

      reason:
        reasonSchema,
    })
    .strict()

const listQuerySchema =
  z
    .object({
      limit:
        z.coerce
          .number()
          .int()
          .min(
            1,
          )
          .max(
            200,
          )
          .default(
            100,
          ),
    })
    .strict()

function parseOrThrow(
  schema,
  value,
  code,
  fallbackMessage,
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
        fallbackMessage,

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

function idempotencyKey(
  req,
) {
  return parseOrThrow(
    idempotencySchema,

    req.get(
      'idempotency-key',
    ),

    'M22_IDEMPOTENCY_KEY_REQUIRED',

    'A valid Idempotency-Key header is required.',
  )
}

function wrap(
  handler,
) {
  return async function executionScaleController(
    req,
    res,
    next,
  ) {
    try {
      return await handler(
        req,
        res,
      )
    } catch (
      error
    ) {
      return next(
        error,
      )
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

const hostSecurity = [
  sensitiveResponseNoStoreMiddleware,
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireHostAccess,
  requireMfaAssurance,
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
|--------------------------------------------------------------------------
| Security Boundary
|--------------------------------------------------------------------------
|
| Host:
|
| hostEnabled === true
| hostAccessStatus === active
|
| through frozen requireHostAccess.
|
| activeMode never grants Host authority.
|
| Admin:
|
| resolved M03 permissions only.
|
*/

router.get(
  '/host/execution-scale',

  ...hostSecurity,

  wrap(
    async (
      req,
      res,
    ) =>
      send(
        req,
        res,
        200,

        await listHostExecutionScale({
          actorUser:
            req.currentUser,
        }),

        'M22 execution-scale workspace loaded.',
      ),
  ),
)

router.post(
  '/host/execution-scale/partners',

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
          createPartnerConnectionSchema,

          req.body,

          'M22_PARTNER_CONNECTION_INPUT_INVALID',

          'Invalid partner connection input.',
        )

      return send(
        req,
        res,
        201,

        await createPartnerConnection({
          input,

          actorUser:
            req.currentUser,
        }),

        'Partner connection proposed for administrative activation.',
      )
    },
  ),
)

router.post(
  '/host/execution-scale/partners/:partnerConnectionId/sync',

  ...hostSecurity,

  requireCsrfToken,
  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const partnerConnectionId =
        parseOrThrow(
          objectIdSchema,

          req.params
            .partnerConnectionId,

          'M22_PARTNER_CONNECTION_ID_INVALID',

          'Invalid partner connection ID.',
        )

      const input =
        parseOrThrow(
          syncSchema,

          req.body,

          'M22_PARTNER_SYNC_INPUT_INVALID',

          'Invalid partner sync request.',
        )

      return send(
        req,
        res,
        200,

        await runHostPartnerSync({
          partnerConnectionId,

          operation:
            input.operation,

          idempotencyKey:
            idempotencyKey(
              req,
            ),

          actorUser:
            req.currentUser,

          correlationId:
            req.requestId,
        }),

        'Partner sync completed through frozen domain services.',
      )
    },
  ),
)

/*
|--------------------------------------------------------------------------
| Procurement Execution
|--------------------------------------------------------------------------
*/

router.post(
  '/host/execution-scale/procurement-plans/:procurementPlanId/purchase-orders',

  ...hostSecurity,

  requireCsrfToken,
  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const procurementPlanId =
        parseOrThrow(
          objectIdSchema,

          req.params
            .procurementPlanId,

          'M22_PROCUREMENT_PLAN_ID_INVALID',

          'Invalid Procurement Plan ID.',
        )

      const input =
        parseOrThrow(
          createPurchaseOrdersSchema,

          req.body,

          'M22_PURCHASE_ORDER_CREATE_INPUT_INVALID',

          'Invalid Purchase Order creation request.',
        )

      return send(
        req,
        res,
        201,

        await createPurchaseOrdersFromProcurementPlan({
          procurementPlanId,

          idempotencyKey:
            idempotencyKey(
              req,
            ),

          reason:
            input.reason,

          actorUser:
            req.currentUser,
        }),

        'Purchase Order drafts created from M18 Procurement Plan supplier selections.',
      )
    },
  ),
)

router.post(
  '/host/execution-scale/purchase-orders/:purchaseOrderId/transition',

  ...hostSecurity,

  requireCsrfToken,
  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const purchaseOrderId =
        parseOrThrow(
          objectIdSchema,

          req.params
            .purchaseOrderId,

          'M22_PURCHASE_ORDER_ID_INVALID',

          'Invalid Purchase Order ID.',
        )

      const input =
        parseOrThrow(
          purchaseOrderTransitionSchema,

          req.body,

          'M22_PURCHASE_ORDER_TRANSITION_INVALID',

          'Invalid Purchase Order transition.',
        )

      return send(
        req,
        res,
        200,

        await transitionPurchaseOrder({
          purchaseOrderId,

          input,

          actorUser:
            req.currentUser,
        }),

        'Purchase Order lifecycle updated.',
      )
    },
  ),
)

router.post(
  '/host/execution-scale/purchase-orders/:purchaseOrderId/submit',

  ...hostSecurity,

  requireCsrfToken,
  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const purchaseOrderId =
        parseOrThrow(
          objectIdSchema,

          req.params
            .purchaseOrderId,

          'M22_PURCHASE_ORDER_ID_INVALID',

          'Invalid Purchase Order ID.',
        )

      const input =
        parseOrThrow(
          purchaseOrderSubmitSchema,

          req.body,

          'M22_PURCHASE_ORDER_SUBMIT_INPUT_INVALID',

          'Invalid Purchase Order submission request.',
        )

      return send(
        req,
        res,
        200,

        await submitPurchaseOrder({
          purchaseOrderId,

          partnerConnectionId:
            input
              .partnerConnectionId,

          actorUser:
            req.currentUser,

          correlationId:
            req.requestId,
        }),

        'Purchase Order submitted through approved supplier connection.',
      )
    },
  ),
)

/*
|--------------------------------------------------------------------------
| Admin Partner Governance
|--------------------------------------------------------------------------
*/

router.post(
  '/admin/execution-scale/partners/:partnerConnectionId/review',

  ...adminSecurity,

  requireCsrfToken,
  requireRecentMfaAuthentication,

  requireAnyAdminPermission(
    'marketplace.mutate',
    'finance.mutate',
  ),

  wrap(
    async (
      req,
      res,
    ) => {
      const partnerConnectionId =
        parseOrThrow(
          objectIdSchema,

          req.params
            .partnerConnectionId,

          'M22_PARTNER_CONNECTION_ID_INVALID',

          'Invalid partner connection ID.',
        )

      const input =
        parseOrThrow(
          partnerReviewSchema,

          req.body,

          'M22_PARTNER_REVIEW_INPUT_INVALID',

          'Invalid partner review request.',
        )

      return send(
        req,
        res,
        200,

        await reviewPartnerConnection({
          partnerConnectionId,

          input,

          actorUser:
            req.currentUser,

          adminAuthorization:
            req.adminAuthorization,

          requestId:
            req.requestId,
        }),

        'Partner connection governance decision recorded.',
      )
    },
  ),
)

router.get(
  '/admin/execution-scale/evidence',

  ...adminSecurity,

  requireAnyAdminPermission(
    'marketplace.read',
    'finance.read',
  ),

  wrap(
    async (
      req,
      res,
    ) => {
      const query =
        parseOrThrow(
          listQuerySchema,

          req.query,

          'M22_EXECUTION_EVIDENCE_QUERY_INVALID',

          'Invalid execution evidence query.',
        )

      return send(
        req,
        res,
        200,

        await listAdminExecutionEvidence({
          limit:
            query.limit,
        }),

        'M22 execution evidence loaded.',
      )
    },
  ),
)

/*
|--------------------------------------------------------------------------
| Payout Execution
|--------------------------------------------------------------------------
|
| finance.mutate only.
|
| This executes/reconciles provider state.
|
| It does NOT mark M16 Settlement paid.
|--------------------------------------------------------------------------
*/

router.post(
  '/admin/execution-scale/settlements/:settlementId/payouts/execute',

  ...adminSecurity,

  requireCsrfToken,
  requireRecentMfaAuthentication,

  requireAnyAdminPermission(
    'finance.mutate',
  ),

  wrap(
    async (
      req,
      res,
    ) => {
      const settlementId =
        parseOrThrow(
          objectIdSchema,

          req.params
            .settlementId,

          'M22_SETTLEMENT_ID_INVALID',

          'Invalid Settlement ID.',
        )

      const input =
        parseOrThrow(
          payoutExecuteSchema,

          req.body,

          'M22_PAYOUT_EXECUTION_INPUT_INVALID',

          'Invalid payout execution request.',
        )

      return send(
        req,
        res,
        200,

        await executeSettlementPayout({
          settlementId,

          partnerConnectionId:
            input
              .partnerConnectionId,

          idempotencyKey:
            idempotencyKey(
              req,
            ),

          actorUser:
            req.currentUser,

          adminAuthorization:
            req.adminAuthorization,

          requestId:
            req.requestId,

          correlationId:
            req.requestId,
        }),

        'Payout provider execution completed; M16 settlement paid state remains separately governed.',
      )
    },
  ),
)

router.post(
  '/admin/execution-scale/payouts/:payoutExecutionId/reconcile',

  ...adminSecurity,

  requireCsrfToken,
  requireRecentMfaAuthentication,

  requireAnyAdminPermission(
    'finance.mutate',
  ),

  wrap(
    async (
      req,
      res,
    ) => {
      const payoutExecutionId =
        parseOrThrow(
          objectIdSchema,

          req.params
            .payoutExecutionId,

          'M22_PAYOUT_EXECUTION_ID_INVALID',

          'Invalid payout execution ID.',
        )

      const input =
        parseOrThrow(
          payoutReconcileSchema,

          req.body,

          'M22_PAYOUT_RECONCILIATION_INPUT_INVALID',

          'Invalid payout reconciliation request.',
        )

      return send(
        req,
        res,
        200,

        await reconcileSettlementPayout({
          payoutExecutionId,

          input,

          actorUser:
            req.currentUser,

          adminAuthorization:
            req.adminAuthorization,

          requestId:
            req.requestId,
        }),

        'Payout reconciliation evidence recorded.',
      )
    },
  ),
)

/*
|--------------------------------------------------------------------------
| Raw Partner Webhook
|--------------------------------------------------------------------------
|
| This router MUST be mounted before express.json().
|
| Raw body:
|
| verify HMAC
| hash
| normalize bounded metadata
| discard raw content
|
| Webhook is evidence-only in M22 Batch 1.
|--------------------------------------------------------------------------
*/

webhookRouter.post(
  '/:partnerConnectionId',

  express.raw({
    type:
      '*/*',

    limit:
      '512kb',
  }),

  wrap(
    async (
      req,
      res,
    ) => {
      const partnerConnectionId =
        parseOrThrow(
          objectIdSchema,

          req.params
            .partnerConnectionId,

          'M22_WEBHOOK_CONNECTION_ID_INVALID',

          'Invalid webhook partner connection ID.',
        )

      const result =
        await processPartnerWebhook({
          partnerConnectionId,

          rawBody:
            Buffer.isBuffer(
              req.body,
            )
              ? req.body
              : Buffer.from(
                  req.body ||
                    '',
                ),

          signature:
            req.get(
              'x-epantry-signature',
            ) ||
            req.get(
              'x-signature',
            ) ||
            '',

          providerEventId:
            req.get(
              'x-provider-event-id',
            ) ||
            '',
        })

      return send(
        req,
        res,
        202,

        result,

        'Partner webhook accepted as signed execution evidence.',
      )
    },
  ),
)

export const executionScaleWebhookRouter =
  webhookRouter

export default router