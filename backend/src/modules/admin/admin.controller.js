import {
  z,
} from 'zod'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  ApiResponse,
} from '../../utils/ApiResponse.js'

import {
  ADMIN_HOST_FILTER_STATUSES,
  approveAdminHostWithAudit,
  getAdminHost,
  listAdminHosts,
  rejectAdminHostWithAudit,
  suspendAdminHostWithAudit,
} from './admin.service.js'

/*
|--------------------------------------------------------------------------
| Validation
|--------------------------------------------------------------------------
*/

const hostUserParamsSchema =
  z.object({
    userId:
      z.string()
        .trim()
        .regex(
          /^[a-f\d]{24}$/i,
          'A valid Host user ID is required.',
        ),
  })
  .strict()

const listHostsQuerySchema =
  z.object({
    status:
      z.enum([
        'all',
        ...ADMIN_HOST_FILTER_STATUSES,
      ])
        .optional()
        .default(
          'pending',
        ),

    page:
      z.coerce
        .number()
        .int()
        .min(
          1,
        )
        .optional()
        .default(
          1,
        ),

    limit:
      z.coerce
        .number()
        .int()
        .min(
          1,
        )
        .max(
          100,
        )
        .optional()
        .default(
          25,
        ),
  })
  .strict()

/*
|--------------------------------------------------------------------------
| Host Mutation Reason
|--------------------------------------------------------------------------
|
| Action-specific reason matching is enforced again by the audit registry.
|
| Examples:
|
| approve  → host_review.approved
| reject   → host_review.rejected
| suspend  → host_review.suspended
|
*/

const hostMutationBodySchema =
  z.object({
    reasonCode:
      z.string()
        .trim()
        .min(
          1,
        )
        .max(
          120,
        ),

    reasonDetails:
      z.string()
        .trim()
        .max(
          1000,
        )
        .optional()
        .nullable(),
  })
  .strict()

/*
|--------------------------------------------------------------------------
| Parse Host User ID
|--------------------------------------------------------------------------
*/

function parseHostUserId(
  params,
) {
  const parsed =
    hostUserParamsSchema.safeParse(
      params,
    )

  if (
    !parsed.success
  ) {
    throw new ApiError(
      400,
      parsed.error
        .issues[0]
        ?.message ||
        'A valid Host user ID is required.',
      [
        {
          code:
            'ADMIN_HOST_USER_ID_INVALID',
        },
      ],
    )
  }

  return parsed.data
    .userId
}

/*
|--------------------------------------------------------------------------
| Parse Mutation Reason
|--------------------------------------------------------------------------
*/

function parseHostMutationBody(
  body,
) {
  const parsed =
    hostMutationBodySchema.safeParse(
      body,
    )

  if (
    !parsed.success
  ) {
    throw new ApiError(
      400,
      parsed.error
        .issues[0]
        ?.message ||
        'A controlled reason code is required.',
      [
        {
          code:
            'ADMIN_HOST_REASON_BODY_INVALID',
        },
      ],
    )
  }

  return parsed.data
}

/*
|--------------------------------------------------------------------------
| List Hosts
|--------------------------------------------------------------------------
*/

export async function listHostsController(
  req,
  res,
  next,
) {
  try {
    const parsed =
      listHostsQuerySchema.safeParse(
        req.query,
      )

    if (
      !parsed.success
    ) {
      throw new ApiError(
        400,
        parsed.error
          .issues[0]
          ?.message ||
          'Invalid Host list query.',
        [
          {
            code:
              'ADMIN_HOST_QUERY_INVALID',
          },
        ],
      )
    }

    const result =
      await listAdminHosts(
        parsed.data,
      )

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,

          {
            ...result,

            requestId:
              req.requestId,
          },

          'Host accounts loaded',
        ),
      )
  } catch (error) {
    return next(
      error,
    )
  }
}

/*
|--------------------------------------------------------------------------
| Host Details
|--------------------------------------------------------------------------
*/

export async function getHostController(
  req,
  res,
  next,
) {
  try {
    const userId =
      parseHostUserId(
        req.params,
      )

    const host =
      await getAdminHost(
        userId,
      )

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,

          {
            host,

            requestId:
              req.requestId,
          },

          'Host account loaded',
        ),
      )
  } catch (error) {
    return next(
      error,
    )
  }
}

/*
|--------------------------------------------------------------------------
| Approve Host
|--------------------------------------------------------------------------
*/

export async function approveHostController(
  req,
  res,
  next,
) {
  try {
    const userId =
      parseHostUserId(
        req.params,
      )

    const {
      reasonCode,
      reasonDetails,
    } =
      parseHostMutationBody(
        req.body,
      )

    const host =
      await approveAdminHostWithAudit({
        userId,

        actorUser:
          req.currentUser,

        adminAuthorization:
          req.adminAuthorization,

        reasonCode,
        reasonDetails,

        requestId:
          req.requestId,
      })

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,

          {
            host,

            requestId:
              req.requestId,
          },

          'Host application approved successfully',
        ),
      )
  } catch (error) {
    return next(
      error,
    )
  }
}

/*
|--------------------------------------------------------------------------
| Reject Host
|--------------------------------------------------------------------------
*/

export async function rejectHostController(
  req,
  res,
  next,
) {
  try {
    const userId =
      parseHostUserId(
        req.params,
      )

    const {
      reasonCode,
      reasonDetails,
    } =
      parseHostMutationBody(
        req.body,
      )

    const host =
      await rejectAdminHostWithAudit({
        userId,

        actorUser:
          req.currentUser,

        adminAuthorization:
          req.adminAuthorization,

        reasonCode,
        reasonDetails,

        requestId:
          req.requestId,
      })

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,

          {
            host,

            requestId:
              req.requestId,
          },

          'Host application rejected successfully',
        ),
      )
  } catch (error) {
    return next(
      error,
    )
  }
}

/*
|--------------------------------------------------------------------------
| Suspend Host
|--------------------------------------------------------------------------
*/

export async function suspendHostController(
  req,
  res,
  next,
) {
  try {
    const userId =
      parseHostUserId(
        req.params,
      )

    const {
      reasonCode,
      reasonDetails,
    } =
      parseHostMutationBody(
        req.body,
      )

    const host =
      await suspendAdminHostWithAudit({
        userId,

        actorUser:
          req.currentUser,

        adminAuthorization:
          req.adminAuthorization,

        reasonCode,
        reasonDetails,

        requestId:
          req.requestId,
      })

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,

          {
            host,

            requestId:
              req.requestId,
          },

          'Host access suspended successfully',
        ),
      )
  } catch (error) {
    return next(
      error,
    )
  }
}