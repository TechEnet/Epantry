import {
  keepPreviousData,
  useQuery,
} from '@tanstack/react-query'

import {
  useAdmin,
} from '../context/AdminContext'

import {
  getAdminAuditEvent,
  getAdminAuditEvents,
} from '../services/admin.service'

/*
|--------------------------------------------------------------------------
| Audit Permission
|--------------------------------------------------------------------------
*/

export const ADMIN_AUDIT_PERMISSIONS =
  Object.freeze({
    READ:
      'admin.audit.read',
  })

/*
|--------------------------------------------------------------------------
| Audit Outcomes
|--------------------------------------------------------------------------
*/

export const ADMIN_AUDIT_OUTCOMES =
  Object.freeze([
    'success',
    'denied',
    'failed',
  ])

/*
|--------------------------------------------------------------------------
| Query Keys
|--------------------------------------------------------------------------
*/

export const ADMIN_AUDIT_QUERY_KEYS =
  Object.freeze({
    root:
      Object.freeze([
        'admin',
        'audit',
      ]),

    lists:
      Object.freeze([
        'admin',
        'audit',
        'lists',
      ]),

    details:
      Object.freeze([
        'admin',
        'audit',
        'details',
      ]),

    list(
      filters,
    ) {
      return [
        'admin',
        'audit',
        'lists',
        filters,
      ]
    },

    detail(
      eventId,
    ) {
      return [
        'admin',
        'audit',
        'details',
        String(
          eventId ||
            '',
        ).trim(),
      ]
    },
  })

/*
|--------------------------------------------------------------------------
| Generic String
|--------------------------------------------------------------------------
*/

function normalizeOptionalString(
  value,
) {
  const normalized =
    String(
      value ||
        '',
    ).trim()

  return normalized ||
    null
}

/*
|--------------------------------------------------------------------------
| Positive Integer
|--------------------------------------------------------------------------
*/

function normalizePositiveInteger(
  value,
  fallback,
  maximum =
    Number.MAX_SAFE_INTEGER,
) {
  const normalized =
    Number(
      value,
    )

  if (
    !Number.isInteger(
      normalized,
    ) ||
    normalized <
      1
  ) {
    return fallback
  }

  return Math.min(
    normalized,
    maximum,
  )
}

/*
|--------------------------------------------------------------------------
| Date Filter
|--------------------------------------------------------------------------
|
| Query keys should remain stable and serializable.
|
| Date instances therefore become ISO strings before being used by React
| Query or sent through the admin service.
|
*/

function normalizeAuditDate(
  value,
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

  if (
    value instanceof
    Date
  ) {
    if (
      Number.isNaN(
        value.getTime(),
      )
    ) {
      return null
    }

    return value.toISOString()
  }

  const normalized =
    String(
      value,
    ).trim()

  return normalized ||
    null
}

/*
|--------------------------------------------------------------------------
| Outcome
|--------------------------------------------------------------------------
*/

function normalizeAuditOutcome(
  value,
) {
  const normalized =
    normalizeOptionalString(
      value,
    )
      ?.toLowerCase() ||
    null

  if (!normalized) {
    return null
  }

  return ADMIN_AUDIT_OUTCOMES.includes(
    normalized,
  )
    ? normalized
    : null
}

/*
|--------------------------------------------------------------------------
| Audit Explorer Filters
|--------------------------------------------------------------------------
|
| These are frontend query-state normalizers only.
|
| Backend performs authoritative validation for:
|
| actor IDs
| permission keys
| actions
| date ranges
| outcomes
|
*/

export function normalizeAdminAuditExplorerFilters({
  page =
    1,

  limit =
    50,

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
  return {
    page:
      normalizePositiveInteger(
        page,
        1,
      ),

    limit:
      normalizePositiveInteger(
        limit,
        50,
        100,
      ),

    actorUserId:
      normalizeOptionalString(
        actorUserId,
      ),

    action:
      normalizeOptionalString(
        action,
      )
        ?.toLowerCase() ||
      null,

    permissionKey:
      normalizeOptionalString(
        permissionKey,
      )
        ?.toLowerCase() ||
      null,

    entityType:
      normalizeOptionalString(
        entityType,
      )
        ?.toLowerCase() ||
      null,

    entityId:
      normalizeOptionalString(
        entityId,
      ),

    outcome:
      normalizeAuditOutcome(
        outcome,
      ),

    requestId:
      normalizeOptionalString(
        requestId,
      ),

    from:
      normalizeAuditDate(
        from,
      ),

    to:
      normalizeAuditDate(
        to,
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Remove Empty Filters
|--------------------------------------------------------------------------
|
| Keeping empty fields out of the service request makes the final URL easier
| to inspect and prevents accidental cache fragmentation.
|
*/

function compactAdminAuditFilters(
  filters,
) {
  return Object.fromEntries(
    Object.entries(
      filters,
    ).filter(
      ([
        key,
        value,
      ]) => {
        if (
          key ===
            'page' ||
          key ===
            'limit'
        ) {
          return true
        }

        return (
          value !==
            null &&
          value !==
            undefined &&
          value !==
            ''
        )
      },
    ),
  )
}

/*
|--------------------------------------------------------------------------
| Audit Explorer Query
|--------------------------------------------------------------------------
*/

export function useAdminAuditEvents(
  filters =
    {},
) {
  const {
    isAdminAccessReady,
    hasAdminPermission,
  } = useAdmin()

  const normalizedFilters =
    normalizeAdminAuditExplorerFilters(
      filters,
    )

  const requestFilters =
    compactAdminAuditFilters(
      normalizedFilters,
    )

  const canReadAudit =
    isAdminAccessReady &&
    hasAdminPermission(
      ADMIN_AUDIT_PERMISSIONS.READ,
    )

  const query =
    useQuery({
      queryKey:
        ADMIN_AUDIT_QUERY_KEYS.list(
          normalizedFilters,
        ),

      queryFn:
        () =>
          getAdminAuditEvents(
            requestFilters,
          ),

      enabled:
        canReadAudit,

      placeholderData:
        keepPreviousData,

      staleTime:
        15 * 1000,
    })

  return {
    ...query,

    canReadAudit,

    filters:
      normalizedFilters,

    events:
      Array.isArray(
        query.data?.events,
      )
        ? query.data.events
        : [],

    pagination:
      query.data?.pagination ||
      null,

    responseFilter:
      query.data?.filter ||
      null,

    requestId:
      query.data?.requestId ||
      null,
  }
}

/*
|--------------------------------------------------------------------------
| Audit Event Detail Query
|--------------------------------------------------------------------------
*/

export function useAdminAuditEvent(
  eventId,
) {
  const {
    isAdminAccessReady,
    hasAdminPermission,
  } = useAdmin()

  const normalizedEventId =
    normalizeOptionalString(
      eventId,
    )

  const canReadAudit =
    isAdminAccessReady &&
    hasAdminPermission(
      ADMIN_AUDIT_PERMISSIONS.READ,
    )

  const query =
    useQuery({
      queryKey:
        ADMIN_AUDIT_QUERY_KEYS.detail(
          normalizedEventId,
        ),

      queryFn:
        () =>
          getAdminAuditEvent(
            normalizedEventId,
          ),

      enabled:
        canReadAudit &&
        Boolean(
          normalizedEventId,
        ),

      staleTime:
        30 * 1000,
    })

  return {
    ...query,

    canReadAudit,

    event:
      query.data?.event ||
      null,

    requestId:
      query.data?.requestId ||
      null,
  }
}