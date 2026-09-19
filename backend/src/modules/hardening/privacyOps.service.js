import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  recordAdminAuditEvent,
} from '../admin/adminAudit.service.js'

import {
  PrivacyRightsRequest,
} from './hardening.models.js'

const PRIVACY_WORKFLOW_TRANSITIONS =
  Object.freeze({
    submitted:
      Object.freeze([
        'in_review',
        'cancelled',
      ]),

    in_review:
      Object.freeze([
        'blocked',
        'processing',
        'rejected',
        'cancelled',
      ]),

    blocked:
      Object.freeze([
        'in_review',
        'processing',
        'rejected',
        'cancelled',
      ]),

    processing:
      Object.freeze([
        'blocked',
        'completed',
      ]),

    completed:
      Object.freeze([]),

    rejected:
      Object.freeze([]),

    cancelled:
      Object.freeze([]),
  })

function id(
  value,
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null
  }

  return String(
    value?._id ||
      value?.id ||
      value,
  )
}

function actorId(
  actorUser,
) {
  const value =
    actorUser?._id ||
    actorUser?.id

  if (!value) {
    throw new ApiError(
      401,
      'Authenticated administrative identity is required.',
      [
        {
          code:
            'PRIVACY_OPS_ACTOR_REQUIRED',
        },
      ],
    )
  }

  return value
}

function serializePrivacyRequest(
  value,
) {
  const item =
    typeof value?.toObject ===
      'function'
      ? value.toObject()
      : value

  const user =
    item.userId &&
    typeof item.userId ===
      'object' &&
    !Array.isArray(
      item.userId,
    )
      ? item.userId
      : null

  return {
    id:
      id(
        item._id,
      ),

    requestId:
      item.requestId,

    userId:
      id(
        user ||
          item.userId,
      ),

    user:
      user
        ? {
            id:
              id(
                user,
              ),

            name:
              user.name ||
              user.displayName ||
              '',

            email:
              user.email ||
              '',

            customerEnabled:
              user.customerEnabled ===
              true,

            hostEnabled:
              user.hostEnabled ===
              true,

            hostAccessStatus:
              user.hostAccessStatus ||
              null,
          }
        : null,

    requestType:
      item.requestType,

    scope:
      item.scope,

    status:
      item.status,

    requestedAt:
      item.requestedAt,

    retentionEvaluation:
      item.retentionEvaluation ||
      [],

    consentSnapshot:
      item.consentSnapshot ||
      {},

    exportArtifactStatus:
      item.exportArtifactStatus,

    blockedReasonCode:
      item.blockedReasonCode ||
      '',

    completedAt:
      item.completedAt ||
      null,

    createdAt:
      item.createdAt ||
      null,

    updatedAt:
      item.updatedAt ||
      null,
  }
}

async function auditPrivacyOpsMutation({
  actorUser,
  adminAuthorization,
  request,
  beforeSnapshot,
  reason,
  requestId,
}) {
  return recordAdminAuditEvent({
    actorUser,
    adminAuthorization,

    action:
      'trust_safety.mutate',

    permissionKey:
      'trust_safety.mutate',

    entityType:
      'privacy_rights_request',

    entityId:
      request._id,

    outcome:
      'success',

    reasonCode:
      'trust_safety.enforcement',

    reasonDetails:
      reason,

    beforeSnapshot,

    afterSnapshot:
      serializePrivacyRequest(
        request,
      ),

    metadata: {
      m20PrivacyOps:
        true,

      governedWorkflow:
        true,

      blindDeletionCascade:
        false,
    },

    requestId,
  })
}

export async function listPrivacyRequestsForAdmin({
  limit = 100,
  status = null,
  requestType = null,
} = {}) {
  const filter = {}

  if (status) {
    filter.status =
      status
  }

  if (requestType) {
    filter.requestType =
      requestType
  }

  const records =
    await PrivacyRightsRequest.find(
      filter,
    )
      .sort({
        requestedAt:
          -1,
      })
      .limit(
        Math.min(
          Math.max(
            Number(
              limit,
            ) ||
              100,
            1,
          ),
          200,
        ),
      )
      .populate(
        'userId',
        'name displayName email customerEnabled hostEnabled hostAccessStatus',
      )
      .lean()

  return {
    privacyRequests:
      records.map(
        serializePrivacyRequest,
      ),
  }
}

export async function updatePrivacyRequestForAdmin({
  privacyRequestId,
  input,
  actorUser,
  adminAuthorization,
  requestId = '',
}) {
  actorId(
    actorUser,
  )

  const request =
    await PrivacyRightsRequest.findById(
      privacyRequestId,
    )

  if (!request) {
    throw new ApiError(
      404,
      'Privacy rights request was not found.',
      [
        {
          code:
            'PRIVACY_REQUEST_NOT_FOUND',
        },
      ],
    )
  }

  const beforeSnapshot =
    serializePrivacyRequest(
      request,
    )

  const allowedStatuses =
    PRIVACY_WORKFLOW_TRANSITIONS[
      request.status
    ] ||
    []

  if (
    input.status !==
      request.status &&
    !allowedStatuses.includes(
      input.status,
    )
  ) {
    throw new ApiError(
      409,
      'Privacy request workflow transition is not allowed.',
      [
        {
          code:
            'PRIVACY_REQUEST_TRANSITION_INVALID',

          from:
            request.status,

          to:
            input.status,
        },
      ],
    )
  }

  if (
    input.status ===
      'blocked' &&
    !input.blockedReasonCode
  ) {
    throw new ApiError(
      400,
      'Blocked privacy requests require a reason code.',
      [
        {
          code:
            'PRIVACY_REQUEST_BLOCK_REASON_REQUIRED',
        },
      ],
    )
  }

  if (
    input.status ===
      'completed' &&
    request.requestType ===
      'access_export' &&
    input.exportArtifactStatus !==
      'available'
  ) {
    throw new ApiError(
      409,
      'An access/export request cannot complete before its export artifact is available.',
      [
        {
          code:
            'PRIVACY_EXPORT_ARTIFACT_REQUIRED',
        },
      ],
    )
  }

  request.status =
    input.status

  request.blockedReasonCode =
    input.status ===
      'blocked'
      ? input.blockedReasonCode
      : ''

  if (
    input.exportArtifactStatus
  ) {
    request.exportArtifactStatus =
      input.exportArtifactStatus
  }

  request.completedAt =
    input.status ===
      'completed'
      ? new Date()
      : null

  await request.save()

  await auditPrivacyOpsMutation({
    actorUser,
    adminAuthorization,
    request,
    beforeSnapshot,

    reason:
      input.reason,

    requestId,
  })

  return {
    privacyRequest:
      serializePrivacyRequest(
        request,
      ),
  }
}