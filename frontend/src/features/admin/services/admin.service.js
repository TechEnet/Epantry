import {
  apiClient,
} from '../../../api/apiClient'

/*
|--------------------------------------------------------------------------
| Controlled Administrative Reason Codes
|--------------------------------------------------------------------------
|
| The backend remains authoritative for accepted action/reason combinations.
|
| These constants only prevent frontend string duplication.
|
*/

export const ADMIN_REASON_CODES =
  Object.freeze({
    HOST_APPROVED:
      'host_review.approved',

    HOST_REJECTED:
      'host_review.rejected',

    HOST_SUSPENDED:
      'host_review.suspended',

    ROLE_CREATED:
      'admin_role.created',

    ROLE_UPDATED:
      'admin_role.updated',

    ROLE_DISABLED:
      'admin_role.disabled',

    ASSIGNMENT_GRANTED:
      'admin_assignment.granted',

    ASSIGNMENT_UPDATED:
      'admin_assignment.updated',

    ASSIGNMENT_REVOKED:
      'admin_assignment.revoked',
  })

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function unwrapApiData(
  response,
) {
  if (
    response?.data &&
    typeof response.data ===
      'object' &&
    Object.prototype.hasOwnProperty.call(
      response.data,
      'success',
    )
  ) {
    return response
      .data
      .data
  }

  if (
    response &&
    typeof response ===
      'object' &&
    Object.prototype.hasOwnProperty.call(
      response,
      'success',
    )
  ) {
    return response.data
  }

  return response?.data ??
    response
}

function normalizeString(
  value,
) {
  return String(
    value ||
      '',
  ).trim()
}

function encodePathValue(
  value,
) {
  return encodeURIComponent(
    normalizeString(
      value,
    ),
  )
}

function normalizeStringArray(
  values,
) {
  if (
    !Array.isArray(
      values,
    )
  ) {
    return []
  }

  return [
    ...new Set(
      values
        .map(
          (value) =>
            normalizeString(
              value,
            )
              .toLowerCase(),
        )
        .filter(Boolean),
    ),
  ]
}

/*
|--------------------------------------------------------------------------
| CSRF Challenge
|--------------------------------------------------------------------------
|
| Administrative mutations reuse the same secure double-submit CSRF contract
| already used by M02 authentication flows.
|
*/

async function requestCsrfToken() {
  const response =
    await apiClient.get(
      '/auth/csrf',
    )

  const data =
    unwrapApiData(
      response,
    )

  const csrfToken =
    data?.csrfToken

  if (!csrfToken) {
    throw new Error(
      'Unable to initialize secure administrative request.',
    )
  }

  return csrfToken
}

/*
|--------------------------------------------------------------------------
| Administrative Mutation
|--------------------------------------------------------------------------
*/

async function performAdminMutation({
  method,
  url,
  data =
    {},
}) {
  const csrfToken =
    await requestCsrfToken()

  const response =
    await apiClient.request({
      method,

      url,

      data,

      headers: {
        'x-csrf-token':
          csrfToken,
      },
    })

  return unwrapApiData(
    response,
  )
}

/*
|--------------------------------------------------------------------------
| Query Parameters
|--------------------------------------------------------------------------
*/

function normalizeQueryParams(
  values,
) {
  const result = {}

  for (
    const [
      key,
      value,
    ]
    of Object.entries(
      values ||
        {},
    )
  ) {
    if (
      value ===
        undefined ||
      value ===
        null ||
      value ===
        ''
    ) {
      continue
    }

    if (
      value instanceof
      Date
    ) {
      result[key] =
        value.toISOString()

      continue
    }

    result[key] =
      value
  }

  return result
}

/*
|--------------------------------------------------------------------------
| Current Admin Access Normalizer
|--------------------------------------------------------------------------
|
| This is UX state only.
|
| It NEVER replaces backend authorization checks.
|
| activeMode is deliberately absent.
|
*/

export function normalizeCurrentAdminAccess(
  access,
) {
  const permissionKeys =
    normalizeStringArray(
      access?.permissionKeys,
    )

  const roleKeys =
    normalizeStringArray(
      access?.roleKeys,
    )

  const isRootSuperAdmin =
    access?.isRootSuperAdmin ===
    true

  const isAdmin =
    access?.isAdmin ===
      true &&
    (
      isRootSuperAdmin ||
      permissionKeys.length >
        0
    )

  return {
    isAdmin,

    isRootSuperAdmin,

    source:
      access?.source ===
        'super_admin' ||
      access?.source ===
        'assignment'
        ? access.source
        : 'none',

    roleKeys,

    permissionKeys,
  }
}

/*
|--------------------------------------------------------------------------
| Permission Helpers
|--------------------------------------------------------------------------
|
| Frontend permission checks are for:
|
| navigation
| route UX
| buttons
| sections
|
| Backend remains the final authorization authority.
|
*/

export function hasAdminPermission(
  access,
  permissionKey,
) {
  const normalizedPermission =
    normalizeString(
      permissionKey,
    )
      .toLowerCase()

  if (!normalizedPermission) {
    return false
  }

  return normalizeStringArray(
    access?.permissionKeys,
  ).includes(
    normalizedPermission,
  )
}

export function hasAnyAdminPermission(
  access,
  permissionKeys,
) {
  const required =
    normalizeStringArray(
      permissionKeys,
    )

  if (
    required.length ===
    0
  ) {
    return false
  }

  const granted =
    new Set(
      normalizeStringArray(
        access?.permissionKeys,
      ),
    )

  return required.some(
    (permissionKey) =>
      granted.has(
        permissionKey,
      ),
  )
}

export function hasAllAdminPermissions(
  access,
  permissionKeys,
) {
  const required =
    normalizeStringArray(
      permissionKeys,
    )

  if (
    required.length ===
    0
  ) {
    return false
  }

  const granted =
    new Set(
      normalizeStringArray(
        access?.permissionKeys,
      ),
    )

  return required.every(
    (permissionKey) =>
      granted.has(
        permissionKey,
      ),
  )
}

/*
|--------------------------------------------------------------------------
| Current Administrative Access
|--------------------------------------------------------------------------
|
| Supports both:
|
| real Super Admin
| limited internal AdminAssignment
|
*/

export async function getCurrentAdminAccess() {
  const response =
    await apiClient.get(
      '/admin/access',
    )

  const data =
    unwrapApiData(
      response,
    )

  return {
    access:
      normalizeCurrentAdminAccess(
        data?.access,
      ),

    requestId:
      data?.requestId ||
      null,
  }
}

/*
|--------------------------------------------------------------------------
| Permission Catalog
|--------------------------------------------------------------------------
|
| Super Admin control-plane endpoint.
|
*/

export async function getAdminPermissionCatalog() {
  const response =
    await apiClient.get(
      '/admin/permissions',
    )

  const data =
    unwrapApiData(
      response,
    )

  return {
    permissions:
      Array.isArray(
        data?.permissions,
      )
        ? data.permissions
        : [],

    requestId:
      data?.requestId ||
      null,
  }
}

/*
|--------------------------------------------------------------------------
| Admin Roles
|--------------------------------------------------------------------------
*/

export async function getAdminRoles() {
  const response =
    await apiClient.get(
      '/admin/roles',
    )

  const data =
    unwrapApiData(
      response,
    )

  return {
    roles:
      Array.isArray(
        data?.roles,
      )
        ? data.roles
        : [],

    requestId:
      data?.requestId ||
      null,
  }
}

export async function createAdminRole({
  key,
  name,
  description,
  permissionKeys,

  reasonCode =
    ADMIN_REASON_CODES
      .ROLE_CREATED,

  reasonDetails =
    null,
}) {
  const data =
    await performAdminMutation({
      method:
        'post',

      url:
        '/admin/roles',

      data: {
        key,

        name,

        description,

        permissionKeys,

        reasonCode,

        reasonDetails,
      },
    })

  return {
    role:
      data?.role ||
      null,

    requestId:
      data?.requestId ||
      null,
  }
}

export async function updateAdminRole({
  roleId,

  name,
  description,
  permissionKeys,
  status,

  reasonCode,
  reasonDetails =
    null,
}) {
  const payload = {
    reasonCode,

    reasonDetails,
  }

  if (
    name !==
    undefined
  ) {
    payload.name =
      name
  }

  if (
    description !==
    undefined
  ) {
    payload.description =
      description
  }

  if (
    permissionKeys !==
    undefined
  ) {
    payload.permissionKeys =
      permissionKeys
  }

  if (
    status !==
    undefined
  ) {
    payload.status =
      status
  }

  const data =
    await performAdminMutation({
      method:
        'patch',

      url:
        `/admin/roles/${encodePathValue(
          roleId,
        )}`,

      data:
        payload,
    })

  return {
    role:
      data?.role ||
      null,

    requestId:
      data?.requestId ||
      null,
  }
}

/*
|--------------------------------------------------------------------------
| User Admin Assignments
|--------------------------------------------------------------------------
*/

export async function getAdminUserRoles(
  userId,
) {
  const response =
    await apiClient.get(
      `/admin/users/${encodePathValue(
        userId,
      )}/roles`,
    )

  const data =
    unwrapApiData(
      response,
    )

  return {
    access:
      data?.access ||
      null,

    requestId:
      data?.requestId ||
      null,
  }
}

export async function updateAdminUserRoles({
  userId,
  roleKeys,

  expiresAt =
    null,

  reasonCode,
  reasonDetails =
    null,
}) {
  const data =
    await performAdminMutation({
      method:
        'patch',

      url:
        `/admin/users/${encodePathValue(
          userId,
        )}/roles`,

      data: {
        roleKeys:
          normalizeStringArray(
            roleKeys,
          ),

        expiresAt:
          expiresAt instanceof
          Date
            ? expiresAt
                .toISOString()
            : expiresAt,

        reasonCode,

        reasonDetails,
      },
    })

  return {
    access:
      data?.access ||
      null,

    requestId:
      data?.requestId ||
      null,
  }
}

/*
|--------------------------------------------------------------------------
| Host Review Queue
|--------------------------------------------------------------------------
*/

export async function getAdminHosts({
  status =
    'pending',

  page =
    1,

  limit =
    25,
} = {}) {
  const response =
    await apiClient.get(
      '/admin/hosts',

      {
        params:
          normalizeQueryParams({
            status,

            page,

            limit,
          }),
      },
    )

  const data =
    unwrapApiData(
      response,
    )

  return {
    hosts:
      Array.isArray(
        data?.hosts,
      )
        ? data.hosts
        : [],

    pagination:
      data?.pagination ||
      null,

    filter:
      data?.filter ||
      null,

    requestId:
      data?.requestId ||
      null,
  }
}

export async function getAdminHost(
  userId,
) {
  const response =
    await apiClient.get(
      `/admin/hosts/${encodePathValue(
        userId,
      )}`,
    )

  const data =
    unwrapApiData(
      response,
    )

  return {
    host:
      data?.host ||
      null,

    requestId:
      data?.requestId ||
      null,
  }
}

/*
|--------------------------------------------------------------------------
| Host Approval
|--------------------------------------------------------------------------
*/

export async function approveAdminHost({
  userId,

  reasonDetails =
    null,
}) {
  const data =
    await performAdminMutation({
      method:
        'patch',

      url:
        `/admin/hosts/${encodePathValue(
          userId,
        )}/approve`,

      data: {
        reasonCode:
          ADMIN_REASON_CODES
            .HOST_APPROVED,

        reasonDetails,
      },
    })

  return {
    host:
      data?.host ||
      null,

    requestId:
      data?.requestId ||
      null,
  }
}

/*
|--------------------------------------------------------------------------
| Host Rejection
|--------------------------------------------------------------------------
*/

export async function rejectAdminHost({
  userId,

  reasonDetails =
    null,
}) {
  const data =
    await performAdminMutation({
      method:
        'patch',

      url:
        `/admin/hosts/${encodePathValue(
          userId,
        )}/reject`,

      data: {
        reasonCode:
          ADMIN_REASON_CODES
            .HOST_REJECTED,

        reasonDetails,
      },
    })

  return {
    host:
      data?.host ||
      null,

    requestId:
      data?.requestId ||
      null,
  }
}

/*
|--------------------------------------------------------------------------
| Host Suspension
|--------------------------------------------------------------------------
*/

export async function suspendAdminHost({
  userId,

  reasonDetails =
    null,
}) {
  const data =
    await performAdminMutation({
      method:
        'patch',

      url:
        `/admin/hosts/${encodePathValue(
          userId,
        )}/suspend`,

      data: {
        reasonCode:
          ADMIN_REASON_CODES
            .HOST_SUSPENDED,

        reasonDetails,
      },
    })

  return {
    host:
      data?.host ||
      null,

    requestId:
      data?.requestId ||
      null,
  }
}

/*
|--------------------------------------------------------------------------
| Audit Explorer
|--------------------------------------------------------------------------
*/

export async function getAdminAuditEvents({
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
  const response =
    await apiClient.get(
      '/admin/audit',

      {
        params:
          normalizeQueryParams({
            page,

            limit,

            actorUserId,

            action,

            permissionKey,

            entityType,

            entityId,

            outcome,

            requestId,

            from,

            to,
          }),
      },
    )

  const data =
    unwrapApiData(
      response,
    )

  return {
    events:
      Array.isArray(
        data?.events,
      )
        ? data.events
        : [],

    pagination:
      data?.pagination ||
      null,

    filter:
      data?.filter ||
      null,

    requestId:
      data?.requestId ||
      null,
  }
}

export async function getAdminAuditEvent(
  eventId,
) {
  const response =
    await apiClient.get(
      `/admin/audit/${encodePathValue(
        eventId,
      )}`,
    )

  const data =
    unwrapApiData(
      response,
    )

  return {
    event:
      data?.event ||
      null,

    requestId:
      data?.requestId ||
      null,
  }
}