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
      'Unable to initialize secure Retail Media request.',
    )
  }

  return data.csrfToken
}

async function mutate({
  method = 'post',
  url,
  data = {},
}) {
  const csrfToken =
    await getCsrfToken()

  return unwrap(
    await apiClient.request({
      method,
      url,
      data,
      headers: {
        'x-csrf-token':
          csrfToken,
      },
    }),
  )
}

function path(value) {
  return encodeURIComponent(
    String(
      value || '',
    ).trim(),
  )
}

export function getRetailMediaErrorMessage(
  error,
  fallback =
    'Unable to complete this Retail Media action right now.',
) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    fallback
  )
}

export async function listHostRetailMediaCampaigns() {
  return unwrap(
    await apiClient.get(
      '/host/retail-media/campaigns',
    ),
  )
}

export async function createRetailMediaCampaignFromBrief({
  briefId,
  input,
}) {
  return mutate({
    url:
      `/host/retail-media/campaigns/from-brief/${path(
        briefId,
      )}`,
    data:
      input,
  })
}

export async function transitionRetailMediaCampaign({
  campaignId,
  action,
}) {
  return mutate({
    url:
      `/host/retail-media/campaigns/${path(
        campaignId,
      )}/transition`,
    data: {
      action,
    },
  })
}

export async function getLowRiskSponsoredDecision(input) {
  return mutate({
    url:
      '/retail-media/decision',
    data:
      input,
  })
}

export async function listAdminRetailMediaCampaigns(
  params = {},
) {
  return unwrap(
    await apiClient.get(
      '/admin/retail-media/campaigns',
      {
        params,
      },
    ),
  )
}

export async function reviewAdminRetailMediaCampaign({
  campaignId,
  decision,
  reason,
  evidenceRefs,
}) {
  return mutate({
    url:
      `/admin/retail-media/campaigns/${path(
        campaignId,
      )}/review`,
    data: {
      decision,
      reason,
      evidenceRefs,
    },
  })
}

export async function listAdminAdDecisionLogs(
  params = {},
) {
  return unwrap(
    await apiClient.get(
      '/admin/retail-media/decision-logs',
      {
        params,
      },
    ),
  )
}