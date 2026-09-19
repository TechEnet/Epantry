import crypto from 'crypto'

import mongoose from 'mongoose'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  isKnownAdminPermission,
} from './adminPermission.registry.js'

import {
  AdminAuditEvent,
  ADMIN_AUDIT_OUTCOMES,
} from './adminAudit.model.js'

import {
  getAdminAuditReasonDefinition,
  getAllowedAdminAuditReasonCodes,
  isCriticalAdminAuditAction,
  isKnownAdminAuditReasonCode,
} from './adminAudit.registry.js'

/*
|--------------------------------------------------------------------------
| Snapshot Safety
|--------------------------------------------------------------------------
*/

const MAX_AUDIT_DEPTH =
  8

const MAX_AUDIT_ARRAY_ITEMS =
  100

const MAX_AUDIT_OBJECT_KEYS =
  100

const MAX_AUDIT_STRING_LENGTH =
  4000

const REDACTED_VALUE =
  '[REDACTED]'

const SENSITIVE_AUDIT_KEY_PATTERN =
  /password|passcode|otp|token|secret|cookie|authorization|credential|registrationproof|verificationproof|idtoken|sessioncookie|csrf/i

/*
|--------------------------------------------------------------------------
| Audit Explorer Limits
|--------------------------------------------------------------------------
*/

const DEFAULT_AUDIT_PAGE =
  1

const DEFAULT_AUDIT_LIMIT =
  50

const MAX_AUDIT_LIMIT =
  100

const AUDIT_EVENT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/*
|--------------------------------------------------------------------------
| String Normalization
|--------------------------------------------------------------------------
*/

function normalizeOptionalString(
  value,
  maxLength,
) {
  const normalized =
    String(
      value ||
        '',
    ).trim()

  if (!normalized) {
    return null
  }

  return normalized.slice(
    0,
    maxLength,
  )
}

/*
|--------------------------------------------------------------------------
| Snapshot Sanitizer
|--------------------------------------------------------------------------
*/

export function sanitizeAdminAuditValue(
  value,
  depth =
    0,
) {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return null
  }

  if (
    depth >
    MAX_AUDIT_DEPTH
  ) {
    return '[MAX_DEPTH]'
  }

  if (
    value instanceof
    Date
  ) {
    return value.toISOString()
  }

  if (
    typeof value ===
    'string'
  ) {
    return value.slice(
      0,
      MAX_AUDIT_STRING_LENGTH,
    )
  }

  if (
    typeof value ===
      'number' ||
    typeof value ===
      'boolean'
  ) {
    return value
  }

  if (
    typeof value ===
    'bigint'
  ) {
    return String(
      value,
    )
  }

  if (
    Array.isArray(
      value,
    )
  ) {
    return value
      .slice(
        0,
        MAX_AUDIT_ARRAY_ITEMS,
      )
      .map(
        (item) =>
          sanitizeAdminAuditValue(
            item,
            depth + 1,
          ),
      )
  }

  if (
    typeof value?.toHexString ===
    'function'
  ) {
    return value.toHexString()
  }

  if (
    typeof value?.toObject ===
    'function'
  ) {
    return sanitizeAdminAuditValue(
      value.toObject({
        depopulate:
          true,

        getters:
          false,

        virtuals:
          false,
      }),

      depth,
    )
  }

  if (
    typeof value ===
    'object'
  ) {
    const result = {}

    const entries =
      Object.entries(
        value,
      ).slice(
        0,
        MAX_AUDIT_OBJECT_KEYS,
      )

    for (
      const [
        key,
        nestedValue,
      ]
      of entries
    ) {
      if (
        SENSITIVE_AUDIT_KEY_PATTERN.test(
          key,
        )
      ) {
        result[key] =
          REDACTED_VALUE

        continue
      }

      result[key] =
        sanitizeAdminAuditValue(
          nestedValue,
          depth + 1,
        )
    }

    return result
  }

  return String(
    value,
  ).slice(
    0,
    MAX_AUDIT_STRING_LENGTH,
  )
}

/*
|--------------------------------------------------------------------------
| Action Normalization
|--------------------------------------------------------------------------
*/

function normalizeAuditAction(
  action,
) {
  const normalized =
    String(
      action ||
        '',
    )
      .trim()
      .toLowerCase()

  if (
    !normalized ||
    !/^[a-z][a-z0-9_.:-]*$/.test(
      normalized,
    )
  ) {
    throw new ApiError(
      400,
      'A valid administrative audit action is required.',
      [
        {
          code:
            'ADMIN_AUDIT_ACTION_INVALID',
        },
      ],
    )
  }

  return normalized
}

/*
|--------------------------------------------------------------------------
| Reason Normalization
|--------------------------------------------------------------------------
*/

export function normalizeAdminAuditReason({
  action,
  reasonCode,
  reasonDetails,
}) {
  const normalizedAction =
    normalizeAuditAction(
      action,
    )

  const normalizedReasonCode =
    String(
      reasonCode ||
        '',
    )
      .trim()
      .toLowerCase()

  const normalizedReasonDetails =
    normalizeOptionalString(
      reasonDetails,
      1000,
    )

  const isCritical =
    isCriticalAdminAuditAction(
      normalizedAction,
    )

  if (
    isCritical &&
    !normalizedReasonCode
  ) {
    throw new ApiError(
      400,
      'A controlled reason code is required for this privileged action.',
      [
        {
          code:
            'ADMIN_REASON_REQUIRED',

          action:
            normalizedAction,
        },
      ],
    )
  }

  if (
    !normalizedReasonCode
  ) {
    return {
      code:
        null,

      details:
        normalizedReasonDetails,
    }
  }

  if (
    !isKnownAdminAuditReasonCode(
      normalizedReasonCode,
    )
  ) {
    throw new ApiError(
      400,
      'Unknown administrative reason code.',
      [
        {
          code:
            'ADMIN_REASON_INVALID',

          reasonCode:
            normalizedReasonCode,
        },
      ],
    )
  }

  if (
    isCritical
  ) {
    const allowedReasonCodes =
      getAllowedAdminAuditReasonCodes(
        normalizedAction,
      )

    if (
      !allowedReasonCodes.includes(
        normalizedReasonCode,
      )
    ) {
      throw new ApiError(
        400,
        'The supplied reason code is not valid for this privileged action.',
        [
          {
            code:
              'ADMIN_REASON_ACTION_MISMATCH',

            action:
              normalizedAction,

            reasonCode:
              normalizedReasonCode,

            allowedReasonCodes,
          },
        ],
      )
    }
  }

  const definition =
    getAdminAuditReasonDefinition(
      normalizedReasonCode,
    )

  if (
    definition?.requiresDetails &&
    !normalizedReasonDetails
  ) {
    throw new ApiError(
      400,
      'Additional reason details are required for this administrative reason.',
      [
        {
          code:
            'ADMIN_REASON_DETAILS_REQUIRED',

          reasonCode:
            normalizedReasonCode,
        },
      ],
    )
  }

  return {
    code:
      normalizedReasonCode,

    details:
      normalizedReasonDetails,
  }
}

/*
|--------------------------------------------------------------------------
| Actor Snapshot
|--------------------------------------------------------------------------
*/

function buildAuditActor({
  actorUser,
  adminAuthorization,
}) {
  const userId =
    String(
      actorUser?._id ||
        actorUser?.id ||
        '',
    ).trim()

  if (!userId) {
    throw new ApiError(
      500,
      'Administrative audit requires an actor user.',
      [
        {
          code:
            'ADMIN_AUDIT_ACTOR_REQUIRED',
        },
      ],
    )
  }

  const source =
    adminAuthorization?.source ===
      'super_admin' ||
    adminAuthorization?.source ===
      'assignment'
      ? adminAuthorization.source
      : 'none'

  return {
    userId,

    source,

    isRootSuperAdmin:
      adminAuthorization?.isRootSuperAdmin ===
      true,

    roleKeys: [
      ...new Set(
        (
          adminAuthorization?.roleKeys ||
          []
        )
          .map(
            (roleKey) =>
              String(
                roleKey ||
                  '',
              )
                .trim()
                .toLowerCase(),
          )
          .filter(Boolean),
      ),
    ],

    permissionKeys: [
      ...new Set(
        (
          adminAuthorization?.permissionKeys ||
          []
        )
          .map(
            (permissionKey) =>
              String(
                permissionKey ||
                  '',
              )
                .trim()
                .toLowerCase(),
          )
          .filter(
            (permissionKey) =>
              isKnownAdminPermission(
                permissionKey,
              ),
          ),
      ),
    ],
  }
}

/*
|--------------------------------------------------------------------------
| Permission Validation
|--------------------------------------------------------------------------
*/

function normalizeAuditPermissionKey(
  permissionKey,
) {
  const normalized =
    String(
      permissionKey ||
        '',
    )
      .trim()
      .toLowerCase()

  if (!normalized) {
    return null
  }

  if (
    !isKnownAdminPermission(
      normalized,
    )
  ) {
    throw new ApiError(
      400,
      'Unknown administrative permission key.',
      [
        {
          code:
            'ADMIN_AUDIT_PERMISSION_INVALID',

          permissionKey:
            normalized,
        },
      ],
    )
  }

  return normalized
}

/*
|--------------------------------------------------------------------------
| Entity
|--------------------------------------------------------------------------
*/

function normalizeAuditEntity({
  entityType,
  entityId,
}) {
  const normalizedType =
    String(
      entityType ||
        '',
    )
      .trim()
      .toLowerCase()

  const normalizedId =
    String(
      entityId ||
        '',
    ).trim()

  if (
    !normalizedType ||
    !normalizedId
  ) {
    throw new ApiError(
      400,
      'Administrative audit entity type and ID are required.',
      [
        {
          code:
            'ADMIN_AUDIT_ENTITY_REQUIRED',
        },
      ],
    )
  }

  return {
    type:
      normalizedType.slice(
        0,
        100,
      ),

    id:
      normalizedId.slice(
        0,
        160,
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Record Admin Audit Event
|--------------------------------------------------------------------------
*/

export async function recordAdminAuditEvent({
  actorUser,
  adminAuthorization,

  action,
  permissionKey,

  entityType,
  entityId,

  outcome =
    'success',

  reasonCode,
  reasonDetails,

  beforeSnapshot =
    null,

  afterSnapshot =
    null,

  metadata =
    null,

  requestId,
}) {
  const normalizedAction =
    normalizeAuditAction(
      action,
    )

  const normalizedReason =
    normalizeAdminAuditReason({
      action:
        normalizedAction,

      reasonCode,

      reasonDetails,
    })

  const normalizedPermissionKey =
    normalizeAuditPermissionKey(
      permissionKey,
    )

  const actor =
    buildAuditActor({
      actorUser,

      adminAuthorization,
    })

  const entity =
    normalizeAuditEntity({
      entityType,

      entityId,
    })

  const normalizedRequestId =
    normalizeOptionalString(
      requestId,
      120,
    ) ||
    crypto.randomUUID()

  const event =
    await AdminAuditEvent.create({
      actor,

      action:
        normalizedAction,

      permissionKey:
        normalizedPermissionKey,

      entity,

      outcome,

      reason:
        normalizedReason,

      beforeSnapshot:
        sanitizeAdminAuditValue(
          beforeSnapshot,
        ),

      afterSnapshot:
        sanitizeAdminAuditValue(
          afterSnapshot,
        ),

      metadata:
        sanitizeAdminAuditValue(
          metadata,
        ),

      requestId:
        normalizedRequestId,

      occurredAt:
        new Date(),
    })

  return event
}

/*
|--------------------------------------------------------------------------
| Audit Event Serializer
|--------------------------------------------------------------------------
|
| Audit explorer never populates the User document.
|
| This keeps the explorer independent from authentication secrets and avoids
| accidentally exposing internal User fields.
|
*/

export function serializeAdminAuditEvent(
  event,
) {
  return {
    id:
      event?._id
        ? String(
            event._id,
          )
        : null,

    eventId:
      event.eventId,

    actor: {
      userId:
        event.actor?.userId
          ? String(
              event.actor.userId,
            )
          : null,

      source:
        event.actor?.source ||
        'none',

      isRootSuperAdmin:
        event.actor
          ?.isRootSuperAdmin ===
        true,

      roleKeys:
        Array.isArray(
          event.actor?.roleKeys,
        )
          ? [
              ...event.actor.roleKeys,
            ]
          : [],

      permissionKeys:
        Array.isArray(
          event.actor
            ?.permissionKeys,
        )
          ? [
              ...event.actor
                .permissionKeys,
            ]
          : [],
    },

    action:
      event.action,

    permissionKey:
      event.permissionKey ||
      null,

    entity: {
      type:
        event.entity?.type ||
        null,

      id:
        event.entity?.id ||
        null,
    },

    outcome:
      event.outcome,

    reason: {
      code:
        event.reason?.code ||
        null,

      details:
        event.reason?.details ||
        null,
    },

    beforeSnapshot:
      event.beforeSnapshot ??
      null,

    afterSnapshot:
      event.afterSnapshot ??
      null,

    metadata:
      event.metadata ??
      null,

    requestId:
      event.requestId,

    occurredAt:
      event.occurredAt,

    createdAt:
      event.createdAt ||
      null,
  }
}

/*
|--------------------------------------------------------------------------
| Audit Explorer Helpers
|--------------------------------------------------------------------------
*/

function normalizeAuditExplorerObjectId(
  value,
) {
  const normalized =
    normalizeOptionalString(
      value,
      24,
    )

  if (!normalized) {
    return null
  }

  if (
    !mongoose.Types.ObjectId.isValid(
      normalized,
    )
  ) {
    throw new ApiError(
      400,
      'A valid audit actor user ID is required.',
      [
        {
          code:
            'ADMIN_AUDIT_ACTOR_ID_INVALID',
        },
      ],
    )
  }

  return normalized
}

function normalizeAuditExplorerAction(
  value,
) {
  const normalized =
    normalizeOptionalString(
      value,
      120,
    )

  if (!normalized) {
    return null
  }

  const lower =
    normalized.toLowerCase()

  if (
    !/^[a-z][a-z0-9_.:-]*$/.test(
      lower,
    )
  ) {
    throw new ApiError(
      400,
      'Invalid administrative audit action filter.',
      [
        {
          code:
            'ADMIN_AUDIT_ACTION_FILTER_INVALID',
        },
      ],
    )
  }

  return lower
}

function normalizeAuditExplorerPermission(
  value,
) {
  const normalized =
    normalizeOptionalString(
      value,
      120,
    )

  if (!normalized) {
    return null
  }

  const lower =
    normalized.toLowerCase()

  if (
    !isKnownAdminPermission(
      lower,
    )
  ) {
    throw new ApiError(
      400,
      'Unknown administrative permission filter.',
      [
        {
          code:
            'ADMIN_AUDIT_PERMISSION_FILTER_INVALID',
        },
      ],
    )
  }

  return lower
}

function normalizeAuditExplorerOutcome(
  value,
) {
  const normalized =
    normalizeOptionalString(
      value,
      40,
    )

  if (!normalized) {
    return null
  }

  const lower =
    normalized.toLowerCase()

  if (
    !ADMIN_AUDIT_OUTCOMES.includes(
      lower,
    )
  ) {
    throw new ApiError(
      400,
      'Invalid administrative audit outcome filter.',
      [
        {
          code:
            'ADMIN_AUDIT_OUTCOME_FILTER_INVALID',
        },
      ],
    )
  }

  return lower
}

function normalizeAuditExplorerDate(
  value,
  {
    code,
  },
) {
  if (
    value ===
      undefined ||
    value ===
      null ||
    value ===
      ''
  ) {
    return null
  }

  const date =
    value instanceof
    Date
      ? value
      : new Date(
          value,
        )

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    throw new ApiError(
      400,
      'Invalid administrative audit date filter.',
      [
        {
          code,
        },
      ],
    )
  }

  return date
}

/*
|--------------------------------------------------------------------------
| Build Audit Explorer Filter
|--------------------------------------------------------------------------
*/

export function buildAdminAuditExplorerFilter({
  actorUserId,
  action,
  permissionKey,
  entityType,
  entityId,
  outcome,
  requestId,
  from,
  to,
} = {}) {
  const normalizedActorUserId =
    normalizeAuditExplorerObjectId(
      actorUserId,
    )

  const normalizedAction =
    normalizeAuditExplorerAction(
      action,
    )

  const normalizedPermissionKey =
    normalizeAuditExplorerPermission(
      permissionKey,
    )

  const normalizedEntityType =
    normalizeOptionalString(
      entityType,
      100,
    )?.toLowerCase() ||
    null

  const normalizedEntityId =
    normalizeOptionalString(
      entityId,
      160,
    )

  const normalizedOutcome =
    normalizeAuditExplorerOutcome(
      outcome,
    )

  const normalizedRequestId =
    normalizeOptionalString(
      requestId,
      120,
    )

  const normalizedFrom =
    normalizeAuditExplorerDate(
      from,
      {
        code:
          'ADMIN_AUDIT_FROM_INVALID',
      },
    )

  const normalizedTo =
    normalizeAuditExplorerDate(
      to,
      {
        code:
          'ADMIN_AUDIT_TO_INVALID',
      },
    )

  if (
    normalizedFrom &&
    normalizedTo &&
    normalizedFrom >
      normalizedTo
  ) {
    throw new ApiError(
      400,
      'Audit date range start must be before the end date.',
      [
        {
          code:
            'ADMIN_AUDIT_DATE_RANGE_INVALID',
        },
      ],
    )
  }

  const filter = {}

  if (
    normalizedActorUserId
  ) {
    filter[
      'actor.userId'
    ] =
      normalizedActorUserId
  }

  if (
    normalizedAction
  ) {
    filter.action =
      normalizedAction
  }

  if (
    normalizedPermissionKey
  ) {
    filter.permissionKey =
      normalizedPermissionKey
  }

  if (
    normalizedEntityType
  ) {
    filter[
      'entity.type'
    ] =
      normalizedEntityType
  }

  if (
    normalizedEntityId
  ) {
    filter[
      'entity.id'
    ] =
      normalizedEntityId
  }

  if (
    normalizedOutcome
  ) {
    filter.outcome =
      normalizedOutcome
  }

  if (
    normalizedRequestId
  ) {
    filter.requestId =
      normalizedRequestId
  }

  if (
    normalizedFrom ||
    normalizedTo
  ) {
    filter.occurredAt = {}

    if (
      normalizedFrom
    ) {
      filter.occurredAt
        .$gte =
        normalizedFrom
    }

    if (
      normalizedTo
    ) {
      filter.occurredAt
        .$lte =
        normalizedTo
    }
  }

  return {
    filter,

    normalized: {
      actorUserId:
        normalizedActorUserId,

      action:
        normalizedAction,

      permissionKey:
        normalizedPermissionKey,

      entityType:
        normalizedEntityType,

      entityId:
        normalizedEntityId,

      outcome:
        normalizedOutcome,

      requestId:
        normalizedRequestId,

      from:
        normalizedFrom
          ? normalizedFrom
              .toISOString()
          : null,

      to:
        normalizedTo
          ? normalizedTo
              .toISOString()
          : null,
    },
  }
}

/*
|--------------------------------------------------------------------------
| List Audit Events
|--------------------------------------------------------------------------
*/

export async function listAdminAuditEvents({
  page =
    DEFAULT_AUDIT_PAGE,

  limit =
    DEFAULT_AUDIT_LIMIT,

  ...filters
} = {}) {
  const normalizedPage =
    Math.max(
      1,
      Number(
        page,
      ) ||
        DEFAULT_AUDIT_PAGE,
    )

  const normalizedLimit =
    Math.min(
      MAX_AUDIT_LIMIT,

      Math.max(
        1,
        Number(
          limit,
        ) ||
          DEFAULT_AUDIT_LIMIT,
      ),
    )

  const {
    filter,
    normalized,
  } =
    buildAdminAuditExplorerFilter(
      filters,
    )

  const skip =
    (
      normalizedPage -
      1
    ) *
    normalizedLimit

  const [
    events,
    total,
  ] =
    await Promise.all([
      AdminAuditEvent.find(
        filter,
      )
        .sort({
          occurredAt:
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

      AdminAuditEvent.countDocuments(
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
    events:
      events.map(
        serializeAdminAuditEvent,
      ),

    pagination: {
      page:
        normalizedPage,

      limit:
        normalizedLimit,

      total,

      totalPages,
    },

    filter:
      normalized,
  }
}

/*
|--------------------------------------------------------------------------
| Get Audit Event
|--------------------------------------------------------------------------
*/

export async function getAdminAuditEvent(
  eventId,
) {
  const normalizedEventId =
    String(
      eventId ||
        '',
    )
      .trim()
      .toLowerCase()

  if (
    !AUDIT_EVENT_ID_PATTERN.test(
      normalizedEventId,
    )
  ) {
    throw new ApiError(
      400,
      'A valid administrative audit event ID is required.',
      [
        {
          code:
            'ADMIN_AUDIT_EVENT_ID_INVALID',
        },
      ],
    )
  }

  const event =
    await AdminAuditEvent.findOne({
      eventId:
        normalizedEventId,
    }).lean()

  if (!event) {
    throw new ApiError(
      404,
      'Administrative audit event was not found.',
      [
        {
          code:
            'ADMIN_AUDIT_EVENT_NOT_FOUND',
        },
      ],
    )
  }

  return serializeAdminAuditEvent(
    event,
  )
}