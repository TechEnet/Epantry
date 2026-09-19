import mongoose from 'mongoose'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  User,
} from '../users/user.model.js'

import {
  activateHostAccess,
  rejectHostAccess,
  suspendHostAccess,
} from '../users/user.service.js'

import {
  normalizeAdminAuditReason,
  recordAdminAuditEvent,
} from './adminAudit.service.js'

/*
|--------------------------------------------------------------------------
| Admin Host Projection
|--------------------------------------------------------------------------
|
| Only application/business-access information required by the administrative
| Host review flow is exposed.
|
| Firebase credentials, tokens and other authentication secrets are never
| returned.
|
*/

const ADMIN_HOST_PROJECTION = {
  name:
    1,

  email:
    1,

  phone:
    1,

  emailVerified:
    1,

  phoneVerified:
    1,

  accountStatus:
    1,

  customerEnabled:
    1,

  hostEnabled:
    1,

  hostAccessStatus:
    1,

  superAdminEnabled:
    1,

  activeMode:
    1,

  createdAt:
    1,

  updatedAt:
    1,
}

/*
|--------------------------------------------------------------------------
| Host Management Statuses
|--------------------------------------------------------------------------
*/

export const ADMIN_HOST_FILTER_STATUSES =
  Object.freeze([
    'pending',
    'active',
    'rejected',
    'suspended',
  ])

/*
|--------------------------------------------------------------------------
| User ID
|--------------------------------------------------------------------------
*/

function normalizeUserId(
  userId,
) {
  const normalized =
    String(
      userId ||
        '',
    ).trim()

  if (
    !mongoose.Types.ObjectId.isValid(
      normalized,
    )
  ) {
    throw new ApiError(
      400,
      'A valid Host user ID is required.',
      [
        {
          code:
            'ADMIN_HOST_USER_ID_INVALID',
        },
      ],
    )
  }

  return normalized
}

/*
|--------------------------------------------------------------------------
| Admin Host Serializer
|--------------------------------------------------------------------------
*/

export function serializeAdminHostUser(
  user,
) {
  return {
    id:
      String(
        user._id,
      ),

    name:
      user.name,

    email:
      user.email,

    phone:
      user.phone ||
      null,

    emailVerified:
      user.emailVerified ===
      true,

    phoneVerified:
      user.phoneVerified ===
      true,

    accountStatus:
      user.accountStatus,

    customerEnabled:
      user.customerEnabled ===
      true,

    hostEnabled:
      user.hostEnabled ===
      true &&
      user.hostAccessStatus ===
        'active',

    hostAccessStatus:
      user.hostAccessStatus ||
      'not_requested',

    activeMode:
      user.activeMode ||
      null,

    createdAt:
      user.createdAt,

    updatedAt:
      user.updatedAt,
  }
}

/*
|--------------------------------------------------------------------------
| Host Management Filter
|--------------------------------------------------------------------------
|
| "all" still means users who have entered the Host lifecycle.
|
| Ordinary Customer-only users with:
|
| hostAccessStatus = not_requested
|
| are not part of the Host administration queue.
|
*/

function createHostStatusFilter(
  status,
) {
  if (
    status ===
    'all'
  ) {
    return {
      $in:
        ADMIN_HOST_FILTER_STATUSES,
    }
  }

  if (
    !ADMIN_HOST_FILTER_STATUSES.includes(
      status,
    )
  ) {
    throw new ApiError(
      400,
      'Invalid Host access status filter.',
      [
        {
          code:
            'ADMIN_HOST_STATUS_INVALID',

          allowedStatuses: [
            'all',
            ...ADMIN_HOST_FILTER_STATUSES,
          ],
        },
      ],
    )
  }

  return status
}

/*
|--------------------------------------------------------------------------
| List Host Applications / Accounts
|--------------------------------------------------------------------------
*/

export async function listAdminHosts({
  status =
    'pending',

  page =
    1,

  limit =
    25,
} = {}) {
  const normalizedStatus =
    String(
      status ||
        'pending',
    )
      .trim()
      .toLowerCase()

  const normalizedPage =
    Math.max(
      1,
      Number(
        page,
      ) ||
        1,
    )

  const normalizedLimit =
    Math.min(
      100,

      Math.max(
        1,
        Number(
          limit,
        ) ||
          25,
      ),
    )

  const hostAccessStatus =
    createHostStatusFilter(
      normalizedStatus,
    )

  const filter = {
    hostAccessStatus,
  }

  const skip =
    (
      normalizedPage -
      1
    ) *
    normalizedLimit

  const [
    users,
    total,
  ] =
    await Promise.all([
      User.find(
        filter,

        ADMIN_HOST_PROJECTION,
      )
        .sort({
          createdAt:
            -1,

          _id:
            -1,
        })
        .skip(
          skip,
        )
        .limit(
          normalizedLimit,
        )
        .lean(),

      User.countDocuments(
        filter,
      ),
    ])

  const totalPages =
    total ===
      0
      ? 0
      : Math.ceil(
          total /
            normalizedLimit,
        )

  return {
    hosts:
      users.map(
        serializeAdminHostUser,
      ),

    pagination: {
      page:
        normalizedPage,

      limit:
        normalizedLimit,

      total,

      totalPages,
    },

    filter: {
      status:
        normalizedStatus,
    },
  }
}

/*
|--------------------------------------------------------------------------
| Require Host-management User
|--------------------------------------------------------------------------
*/

async function requireHostManagementUser(
  userId,
) {
  const normalizedUserId =
    normalizeUserId(
      userId,
    )

  const user =
    await User.findOne(
      {
        _id:
          normalizedUserId,

        hostAccessStatus: {
          $in:
            ADMIN_HOST_FILTER_STATUSES,
        },
      },

      ADMIN_HOST_PROJECTION,
    ).lean()

  if (!user) {
    throw new ApiError(
      404,
      'Host account or application was not found.',
      [
        {
          code:
            'ADMIN_HOST_NOT_FOUND',
        },
      ],
    )
  }

  return user
}

/*
|--------------------------------------------------------------------------
| Get Host Application / Account
|--------------------------------------------------------------------------
*/

export async function getAdminHost(
  userId,
) {
  const user =
    await requireHostManagementUser(
      userId,
    )

  return serializeAdminHostUser(
    user,
  )
}

/*
|--------------------------------------------------------------------------
| Approve Host
|--------------------------------------------------------------------------
|
| Only:
|
| pending → active
|
| Customer access remains active.
|
| Approval does not automatically change activeMode to Host.
| The user may switch modes themselves after access exists.
|
*/

export async function approveAdminHost(
  userId,
) {
  const user =
    await requireHostManagementUser(
      userId,
    )

  if (
    user.hostAccessStatus !==
      'pending' ||
    user.hostEnabled ===
      true
  ) {
    throw new ApiError(
      409,
      'Only a pending Host application can be approved.',
      [
        {
          code:
            'ADMIN_HOST_APPROVAL_STATE_INVALID',

          currentStatus:
            user.hostAccessStatus,
        },
      ],
    )
  }

  const updatedUser =
    await activateHostAccess(
      user._id,
    )

  return serializeAdminHostUser(
    updatedUser,
  )
}

/*
|--------------------------------------------------------------------------
| Reject Host
|--------------------------------------------------------------------------
|
| Only:
|
| pending → rejected
|
| Customer access remains intact.
|
*/

export async function rejectAdminHost(
  userId,
) {
  const user =
    await requireHostManagementUser(
      userId,
    )

  if (
    user.hostAccessStatus !==
      'pending' ||
    user.hostEnabled ===
      true
  ) {
    throw new ApiError(
      409,
      'Only a pending Host application can be rejected.',
      [
        {
          code:
            'ADMIN_HOST_REJECTION_STATE_INVALID',

          currentStatus:
            user.hostAccessStatus,
        },
      ],
    )
  }

  const updatedUser =
    await rejectHostAccess(
      user._id,
    )

  return serializeAdminHostUser(
    updatedUser,
  )
}

/*
|--------------------------------------------------------------------------
| Suspend Host
|--------------------------------------------------------------------------
|
| Only:
|
| active → suspended
|
| Customer access remains intact.
| activeMode is safely returned to Customer by the existing lifecycle helper.
|
*/

export async function suspendAdminHost(
  userId,
) {
  const user =
    await requireHostManagementUser(
      userId,
    )

  if (
    user.hostAccessStatus !==
      'active' ||
    user.hostEnabled !==
      true
  ) {
    throw new ApiError(
      409,
      'Only an active Host account can be suspended.',
      [
        {
          code:
            'ADMIN_HOST_SUSPENSION_STATE_INVALID',

          currentStatus:
            user.hostAccessStatus,
        },
      ],
    )
  }

  const updatedUser =
    await suspendHostAccess(
      user._id,
    )

  return serializeAdminHostUser(
    updatedUser,
  )
}

/*
|--------------------------------------------------------------------------
| Audited Host Mutation
|--------------------------------------------------------------------------
|
| Public/admin routes MUST use this audited wrapper for privileged Host
| mutations.
|
| Existing lifecycle helpers remain small and independently testable, while
| the administrative API receives:
|
| - controlled reason code
| - actor authorization snapshot
| - before state
| - after state
| - permission key
| - request correlation
|
*/

async function runAuditedHostMutation({
  userId,

  actorUser,
  adminAuthorization,

  action,
  permissionKey,

  reasonCode,
  reasonDetails,

  requestId,

  mutation,
}) {
  /*
  |--------------------------------------------------------------------------
  | Fail Before Mutation If Reason Is Invalid
  |--------------------------------------------------------------------------
  */

  normalizeAdminAuditReason({
    action,

    reasonCode,

    reasonDetails,
  })

  /*
  |--------------------------------------------------------------------------
  | Before Snapshot
  |--------------------------------------------------------------------------
  */

  const beforeSnapshot =
    await getAdminHost(
      userId,
    )

  /*
  |--------------------------------------------------------------------------
  | Existing Host Lifecycle Mutation
  |--------------------------------------------------------------------------
  */

  const afterSnapshot =
    await mutation(
      userId,
    )

  /*
  |--------------------------------------------------------------------------
  | Immutable Audit
  |--------------------------------------------------------------------------
  */

  await recordAdminAuditEvent({
    actorUser,

    adminAuthorization,

    action,

    permissionKey,

    entityType:
      'user',

    entityId:
      afterSnapshot.id,

    outcome:
      'success',

    reasonCode,

    reasonDetails,

    beforeSnapshot,

    afterSnapshot,

    metadata: {
      lifecycle:
        'host_access',

      previousHostAccessStatus:
        beforeSnapshot
          .hostAccessStatus,

      resultingHostAccessStatus:
        afterSnapshot
          .hostAccessStatus,
    },

    requestId,
  })

  return afterSnapshot
}

/*
|--------------------------------------------------------------------------
| Audited Host Approval
|--------------------------------------------------------------------------
*/

export async function approveAdminHostWithAudit({
  userId,

  actorUser,
  adminAuthorization,

  reasonCode,
  reasonDetails,

  requestId,
}) {
  return runAuditedHostMutation({
    userId,

    actorUser,
    adminAuthorization,

    action:
      'host.review.approve',

    permissionKey:
      'host.review.approve',

    reasonCode,
    reasonDetails,

    requestId,

    mutation:
      approveAdminHost,
  })
}

/*
|--------------------------------------------------------------------------
| Audited Host Rejection
|--------------------------------------------------------------------------
*/

export async function rejectAdminHostWithAudit({
  userId,

  actorUser,
  adminAuthorization,

  reasonCode,
  reasonDetails,

  requestId,
}) {
  return runAuditedHostMutation({
    userId,

    actorUser,
    adminAuthorization,

    action:
      'host.review.reject',

    permissionKey:
      'host.review.reject',

    reasonCode,
    reasonDetails,

    requestId,

    mutation:
      rejectAdminHost,
  })
}

/*
|--------------------------------------------------------------------------
| Audited Host Suspension
|--------------------------------------------------------------------------
*/

export async function suspendAdminHostWithAudit({
  userId,

  actorUser,
  adminAuthorization,

  reasonCode,
  reasonDetails,

  requestId,
}) {
  return runAuditedHostMutation({
    userId,

    actorUser,
    adminAuthorization,

    action:
      'host.review.suspend',

    permissionKey:
      'host.review.suspend',

    reasonCode,
    reasonDetails,

    requestId,

    mutation:
      suspendAdminHost,
  })
}