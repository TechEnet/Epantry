import {
  apiClient,
} from '../../../api/apiClient'

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

export function getHardeningErrorMessage(
  error,
  fallback = 'Unable to complete the request.',
) {
  return (
    error?.message ||
    fallback
  )
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

async function mutate({
  method = 'post',
  url,
  data = {},
}) {
  const csrf =
    await csrfToken()

  return unwrap(
    await apiClient.request({
      method,
      url,
      data,

      headers: {
        'x-csrf-token':
          csrf,
      },
    }),
  )
}

function queryString(
  input = {},
) {
  const params =
    new URLSearchParams()

  for (
    const [
      key,
      value,
    ] of Object.entries(
      input,
    )
  ) {
    if (
      value !== null &&
      value !== undefined &&
      value !== ''
    ) {
      params.set(
        key,
        String(
          value,
        ),
      )
    }
  }

  const value =
    params.toString()

  return value
    ? `?${value}`
    : ''
}

export async function getPrivacyContext() {
  return unwrap(
    await apiClient.get(
      '/privacy/context',
    ),
  )
}

export async function listOwnPrivacyRequests() {
  return unwrap(
    await apiClient.get(
      '/privacy/requests',
    ),
  )
}

export async function createPrivacyRequest(
  input,
) {
  return mutate({
    url:
      '/privacy/requests',

    data:
      input,
  })
}

export async function listPrivacyRequests(
  filters = {},
) {
  return unwrap(
    await apiClient.get(
      `/admin/reliability/privacy-requests${queryString(
        filters,
      )}`,
    ),
  )
}

export async function updatePrivacyRequest(
  requestId,
  input,
) {
  return mutate({
    method:
      'patch',

    url:
      `/admin/reliability/privacy-requests/${encodeURIComponent(
        String(
          requestId,
        ),
      )}`,

    data:
      input,
  })
}

export async function listRetentionPolicies() {
  return unwrap(
    await apiClient.get(
      '/admin/privacy/retention-policies',
    ),
  )
}

export async function createRetentionPolicy(
  input,
) {
  return mutate({
    url:
      '/admin/privacy/retention-policies',

    data:
      input,
  })
}

export async function transitionRetentionPolicy(
  policyId,
  action,
  reason,
) {
  return mutate({
    url:
      `/admin/privacy/retention-policies/${encodeURIComponent(
        String(
          policyId,
        ),
      )}/${encodeURIComponent(
        String(
          action,
        ),
      )}`,

    data: {
      reason,
    },
  })
}

export async function listRegulatoryProfiles() {
  return unwrap(
    await apiClient.get(
      '/admin/regulatory-profiles',
    ),
  )
}

export async function createRegulatoryProfile(
  input,
) {
  return mutate({
    url:
      '/admin/regulatory-profiles',

    data:
      input,
  })
}

export async function transitionRegulatoryProfile(
  profileId,
  action,
  reason,
) {
  return mutate({
    url:
      `/admin/regulatory-profiles/${encodeURIComponent(
        String(
          profileId,
        ),
      )}/${encodeURIComponent(
        String(
          action,
        ),
      )}`,

    data: {
      reason,
    },
  })
}

export async function listSecurityEvents(
  filters = {},
) {
  return unwrap(
    await apiClient.get(
      `/admin/reliability/security-events${queryString(
        filters,
      )}`,
    ),
  )
}

export async function listJobRuns(
  filters = {},
) {
  return unwrap(
    await apiClient.get(
      `/admin/reliability/job-runs${queryString(
        filters,
      )}`,
    ),
  )
}

export async function listLaunchGateRuns(
  filters = {},
) {
  return unwrap(
    await apiClient.get(
      `/admin/reliability/launch-gates${queryString(
        filters,
      )}`,
    ),
  )
}

export async function listRecoveryEvidence(
  filters = {},
) {
  return unwrap(
    await apiClient.get(
      `/admin/reliability/recovery-evidence${queryString(
        filters,
      )}`,
    ),
  )
}

export async function runLaunchGate(
  input,
) {
  return mutate({
    url:
      '/admin/reliability/launch-gates/run',

    data:
      input,
  })
}

export async function recordRecoveryEvidence(
  input,
) {
  return mutate({
    url:
      '/admin/reliability/recovery-evidence',

    data:
      input,
  })
}
export async function getDeploymentSecurityOverview() {
  return unwrap(
    await apiClient.get(
      '/admin/reliability/deployment-security',
    ),
  )
}
