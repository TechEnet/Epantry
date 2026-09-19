import {
  apiClient,
} from '../../../api/apiClient'

function unwrap(response) {
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

  return response?.data ??
    response
}

function path(value) {
  return encodeURIComponent(
    String(
      value || '',
    ).trim(),
  )
}

function idempotencyKey(prefix) {
  const suffix =
    typeof crypto !==
      'undefined' &&
    typeof crypto.randomUUID ===
      'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()
          .toString(16)
          .slice(2)}`

  return `${prefix}:${suffix}`.slice(
    0,
    160,
  )
}

async function getCsrfToken() {
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
      'Unable to initialize secure Community Trust request.',
    )
  }

  return data.csrfToken
}

async function mutate({
  method = 'post',
  url,
  data = {},
  idempotencyPrefix = '',
}) {
  const csrfToken =
    await getCsrfToken()

  const headers = {
    'x-csrf-token':
      csrfToken,
  }

  if (idempotencyPrefix) {
    headers['idempotency-key'] =
      idempotencyKey(
        idempotencyPrefix,
      )
  }

  return unwrap(
    await apiClient.request({
      method,
      url,
      data,
      headers,
    }),
  )
}

export function getCommunityExpansionErrorMessage(
  error,
  fallback =
    'Unable to complete this Community Trust action right now.',
) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    fallback
  )
}

export async function listMyCreatorContent() {
  return unwrap(
    await apiClient.get(
      '/community-trust/creator-content',
    ),
  )
}

export async function registerCreatorContent(
  input,
) {
  return mutate({
    url:
      '/community-trust/creator-content',
    data:
      input,
  })
}

export async function updateCommunityPrivacy(
  input,
) {
  return mutate({
    method:
      'patch',
    url:
      '/community-trust/privacy',
    data:
      input,
  })
}

export async function reportCommunityContent(
  input,
) {
  return mutate({
    url:
      '/community-trust/reports',
    data:
      input,
    idempotencyPrefix:
      'community-report',
  })
}

export async function listAdminCommunityReports(
  params = {},
) {
  return unwrap(
    await apiClient.get(
      '/admin/community-trust/reports',
      {
        params,
      },
    ),
  )
}

export async function resolveAdminCommunityReport({
  reportId,
  action,
  reason,
  evidenceRefs,
}) {
  return mutate({
    url:
      `/admin/community-trust/reports/${path(
        reportId,
      )}/resolve`,
    data: {
      action,
      reason,
      evidenceRefs,
    },
  })
}

export async function listAdminCreatorContent(
  params = {},
) {
  return unwrap(
    await apiClient.get(
      '/admin/community-trust/creator-content',
      {
        params,
      },
    ),
  )
}

export async function reviewAdminCreatorContent({
  creatorContentId,
  decision,
  reason,
  evidenceRefs,
}) {
  return mutate({
    url:
      `/admin/community-trust/creator-content/${path(
        creatorContentId,
      )}/review`,
    data: {
      decision,
      reason,
      evidenceRefs,
    },
  })
}