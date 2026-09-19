import {
  apiClient,
} from '../../../api/apiClient'

const HOST_ORGANIZATION_STORAGE_KEY =
  'epantry_hospitality_organization_id'

function unwrap(
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
    return response.data.data
  }

  return (
    response?.data ??
    response
  )
}

export function getAnalyticsErrorMessage(
  error,
  fallback = 'Unable to load analytics.',
) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    fallback
  )
}

function hostOrganizationHeaders() {
  const organizationId =
    window.localStorage.getItem(
      HOST_ORGANIZATION_STORAGE_KEY,
    ) ||
    ''

  return organizationId
    ? {
        'x-epantry-organization-id':
          organizationId,
      }
    : {}
}

async function csrfToken() {
  const response =
    await apiClient.get(
      '/auth/csrf',
    )

  const data =
    unwrap(
      response,
    )

  if (!data?.csrfToken) {
    throw new Error(
      'Unable to establish CSRF protection.',
    )
  }

  return data.csrfToken
}

function queryString({
  start,
  end,
} = {}) {
  const params =
    new URLSearchParams()

  if (start) {
    params.set(
      'start',
      new Date(
        start,
      ).toISOString(),
    )
  }

  if (end) {
    params.set(
      'end',
      new Date(
        end,
      ).toISOString(),
    )
  }

  const value =
    params.toString()

  return value
    ? `?${value}`
    : ''
}

async function mutate({
  method = 'post',
  url,
  data = {},
  headers = {},
}) {
  const csrf =
    await csrfToken()

  return unwrap(
    await apiClient.request({
      method,
      url,
      data,
      headers: {
        ...headers,
        'x-csrf-token':
          csrf,
      },
    }),
  )
}

export async function getNotificationPreferences() {
  return unwrap(
    await apiClient.get(
      '/notifications/preferences',
    ),
  )
}

export async function updateNotificationPreferences(
  input,
) {
  return mutate({
    method: 'patch',
    url:
      '/notifications/preferences',
    data:
      input,
  })
}

export async function listNotifications({
  limit = 60,
  status,
} = {}) {
  const params =
    new URLSearchParams({
      limit:
        String(
          limit,
        ),
    })

  if (status) {
    params.set(
      'status',
      status,
    )
  }

  return unwrap(
    await apiClient.get(
      `/notifications?${params.toString()}`,
    ),
  )
}

export async function markNotificationRead(
  notificationId,
) {
  return mutate({
    method: 'patch',
    url:
      `/notifications/${encodeURIComponent(String(notificationId))}/read`,
  })
}

export async function markAllNotificationsRead() {
  return mutate({
    method: 'patch',
    url:
      '/notifications/read-all',
  })
}

export async function performNotificationAction(
  notificationId,
  input,
) {
  return mutate({
    url:
      `/notifications/${encodeURIComponent(String(notificationId))}/actions`,
    data:
      input,
  })
}

export async function getHostAnalyticsDashboard(
  range = {},
) {
  return unwrap(
    await apiClient.get(
      `/host/analytics/dashboard${queryString(range)}`,
      {
        headers:
          hostOrganizationHeaders(),
      },
    ),
  )
}

export async function getAdminAnalyticsDashboard(
  range = {},
) {
  return unwrap(
    await apiClient.get(
      `/admin/analytics/dashboard${queryString(range)}`,
    ),
  )
}

export async function listExperimentDefinitions() {
  return unwrap(
    await apiClient.get(
      '/admin/analytics/experiments',
    ),
  )
}

export async function createExperimentDefinition(
  input,
) {
  return mutate({
    url:
      '/admin/analytics/experiments',
    data:
      input,
  })
}

export async function changeExperimentStatus(
  experimentId,
  action,
  reason,
) {
  return mutate({
    url:
      `/admin/analytics/experiments/${encodeURIComponent(String(experimentId))}/${encodeURIComponent(String(action))}`,
    data: {
      reason,
    },
  })
}

export async function getExperimentAssignment(
  experimentKey,
) {
  return unwrap(
    await apiClient.get(
      `/experiments/${encodeURIComponent(String(experimentKey))}/assignment`,
      {
        headers:
          hostOrganizationHeaders(),
      },
    ),
  )
}

export async function recordExperimentExposure(
  experimentKey,
  surface,
) {
  return mutate({
    url:
      `/experiments/${encodeURIComponent(String(experimentKey))}/expose`,
    data: {
      surface,
    },
    headers:
      hostOrganizationHeaders(),
  })
}