import { Router } from 'express'

import { sensitiveResponseNoStoreMiddleware } from '../../middlewares/security.middleware.js'
import { ApiError } from '../../utils/ApiError.js'
import { ApiResponse } from '../../utils/ApiResponse.js'

import {
  loadAdminAuthorization,
  requireAdminAccess,
  requireAnyAdminPermission,
} from '../admin/adminPermission.middleware.js'

import { rejectPrivilegedImpersonation } from '../admin/adminSafety.middleware.js'

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
  createAdminSettlement,
  decideAdminSettlement,
  getAdminSettlement,
  getHostEarningsOverview,
  getHostFinanceSummary,
  getHostSettlement,
  listAdminSettlements,
  listHostSettlements,
  markAdminSettlementPaid,
} from './hostOperations.finance.service.js'

import {
  adminCreateSettlementSchema,
  adminSettlementDecisionSchema,
  adminSettlementPaidSchema,
  hostFinanceQuerySchema,
  settlementIdParamsSchema,
} from './hostOperations.finance.validation.js'

const router = Router()
const hostRouter = Router()
const adminRouter = Router()

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
  '/earnings',
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
        await getHostEarningsOverview({
          actorUser:
            req.currentUser,
        }),
        'Host earnings loaded.',
      ),
  ),
)

hostRouter.get(
  '/summary',
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
        await getHostFinanceSummary({
          actorUser:
            req.currentUser,
        }),
        'Host finance summary loaded.',
      ),
  ),
)

hostRouter.get(
  '/settlements',
  ...hostSecurity,

  wrap(
    async (
      req,
      res,
    ) => {
      const query =
        parseOrThrow(
          hostFinanceQuerySchema,
          req.query,
          'HOST_FINANCE_QUERY_INVALID',
          'Invalid finance query.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await listHostSettlements({
          ...query,
          actorUser:
            req.currentUser,
        }),
        'Host settlements loaded.',
      )
    },
  ),
)

hostRouter.get(
  '/settlements/:id',
  ...hostSecurity,

  wrap(
    async (
      req,
      res,
    ) => {
      const { id } =
        parseOrThrow(
          settlementIdParamsSchema,
          req.params,
          'HOST_SETTLEMENT_ID_INVALID',
          'Invalid settlement ID.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await getHostSettlement({
          settlementId:
            id,

          actorUser:
            req.currentUser,
        }),
        'Host settlement loaded.',
      )
    },
  ),
)

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

adminRouter.get(
  '/settlements',

  requireAnyAdminPermission(
    'finance.read',
  ),

  wrap(
    async (
      req,
      res,
    ) => {
      const query =
        parseOrThrow(
          hostFinanceQuerySchema,
          req.query,
          'ADMIN_FINANCE_QUERY_INVALID',
          'Invalid settlement query.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await listAdminSettlements(
          query,
        ),
        'Settlement queue loaded.',
      )
    },
  ),
)

adminRouter.get(
  '/settlements/:id',

  requireAnyAdminPermission(
    'finance.read',
  ),

  wrap(
    async (
      req,
      res,
    ) => {
      const { id } =
        parseOrThrow(
          settlementIdParamsSchema,
          req.params,
          'ADMIN_SETTLEMENT_ID_INVALID',
          'Invalid settlement ID.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await getAdminSettlement({
          settlementId:
            id,
        }),
        'Settlement loaded.',
      )
    },
  ),
)

adminRouter.post(
  '/settlements',

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
      const input =
        parseOrThrow(
          adminCreateSettlementSchema,
          req.body,
          'ADMIN_SETTLEMENT_INPUT_INVALID',
          'Invalid settlement proposal.',
        )

      return sendSuccess(
        req,
        res,
        201,
        await createAdminSettlement({
          input,

          actorUser:
            req.currentUser,

          adminAuthorization:
            req.adminAuthorization,

          requestId:
            req.requestId,
        }),
        'Settlement proposal created for maker-checker approval.',
      )
    },
  ),
)

adminRouter.post(
  '/settlements/:id/decision',

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
      const { id } =
        parseOrThrow(
          settlementIdParamsSchema,
          req.params,
          'ADMIN_SETTLEMENT_ID_INVALID',
          'Invalid settlement ID.',
        )

      const input =
        parseOrThrow(
          adminSettlementDecisionSchema,
          req.body,
          'ADMIN_SETTLEMENT_DECISION_INVALID',
          'Invalid settlement decision.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await decideAdminSettlement({
          settlementId:
            id,

          input,

          actorUser:
            req.currentUser,

          adminAuthorization:
            req.adminAuthorization,

          requestId:
            req.requestId,
        }),
        'Settlement decision recorded.',
      )
    },
  ),
)

adminRouter.post(
  '/settlements/:id/paid',

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
      const { id } =
        parseOrThrow(
          settlementIdParamsSchema,
          req.params,
          'ADMIN_SETTLEMENT_ID_INVALID',
          'Invalid settlement ID.',
        )

      const input =
        parseOrThrow(
          adminSettlementPaidSchema,
          req.body,
          'ADMIN_SETTLEMENT_PAID_INVALID',
          'Invalid payout reconciliation input.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await markAdminSettlementPaid({
          settlementId:
            id,

          input,

          actorUser:
            req.currentUser,

          adminAuthorization:
            req.adminAuthorization,

          requestId:
            req.requestId,
        }),
        'Settlement marked paid after external payout reconciliation.',
      )
    },
  ),
)

router.use(
  '/host/operations/finance',
  hostRouter,
)

router.use(
  '/admin/host-operations/finance',
  adminRouter,
)

export default router