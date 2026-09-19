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
  requireAdminPermission,
} from '../admin/adminPermission.middleware.js'

import {
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireMfaAssurance,
} from '../auth/auth.middleware.js'

import {
  listSearchAiQuality,
} from './search.admin.service.js'

const qualityQuerySchema =
  z
    .object({
      page:
        z.coerce
          .number()
          .int()
          .min(
            1,
          )
          .optional(),

      limit:
        z.coerce
          .number()
          .int()
          .min(
            1,
          )
          .max(
            50,
          )
          .optional(),

      status:
        z
          .enum([
            'succeeded',
            'failed',
            'fallback',
          ])
          .optional(),
    })
    .strict()

function parseOrThrow(
  schema,
  value,
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
        'Invalid Search AI quality query.',
      [
        {
          code:
            'SEARCH_AI_QUALITY_QUERY_INVALID',
        },
      ],
    )
  }

  return result.data
}

function wrap(
  handler,
) {
  return async function wrappedSearchAdminController(
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

const searchAdminRoutes =
  Router()

searchAdminRoutes.use(
  sensitiveResponseNoStoreMiddleware,
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  loadAdminAuthorization,
  requireAdminAccess,
  requireMfaAssurance,
  requireAdminPermission(
    'admin.audit.read',
  ),
)

searchAdminRoutes.get(
  '/quality',
  wrap(
    async (
      req,
      res,
    ) => {
      const query =
        parseOrThrow(
          qualityQuerySchema,
          req.query,
        )

      return res
        .status(
          200,
        )
        .json(
          new ApiResponse(
            200,
            {
              ...(
                await listSearchAiQuality(
                  query,
                )
              ),

              requestId:
                req.requestId,
            },
            'Search and AI quality queue loaded successfully.',
          ),
        )
    },
  ),
)

export default searchAdminRoutes