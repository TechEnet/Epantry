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

function appendCloudinaryParameter(
  formData,
  key,
  value,
) {
  if (
    value === undefined ||
    value === null
  ) {
    return
  }

  formData.append(
    key,
    Array.isArray(value)
      ? value.join(',')
      : String(value),
  )
}

async function createRetailMediaImageUploadIntent() {
  return mutate({
    url:
      '/host/retail-media/image-upload-intent',
    data: {},
  })
}

export async function uploadRetailMediaImage({
  file,
}) {
  if (!file) {
    throw new Error(
      'Choose a campaign image first.',
    )
  }

  const data =
    await createRetailMediaImageUploadIntent()

  const intent =
    data?.uploadIntent

  if (
    !intent?.uploadUrl ||
    !intent?.apiKey ||
    !intent?.signature ||
    !intent?.signedParameters
  ) {
    throw new Error(
      'Campaign image upload could not be prepared.',
    )
  }

  const maxBytes =
    Number(intent.constraints?.maxBytes || 0)
  const allowedMimeTypes =
    Array.isArray(intent.constraints?.allowedMimeTypes)
      ? intent.constraints.allowedMimeTypes
      : []

  if (maxBytes > 0 && file.size > maxBytes) {
    throw new Error(
      'This campaign image is larger than the allowed upload size.',
    )
  }

  if (
    allowedMimeTypes.length > 0 &&
    !allowedMimeTypes.includes(file.type)
  ) {
    throw new Error(
      'Use a JPEG, PNG, or WebP campaign image.',
    )
  }

  const formData =
    new FormData()

  formData.append(
    'file',
    file,
  )
  formData.append(
    'api_key',
    intent.apiKey,
  )
  formData.append(
    'signature',
    intent.signature,
  )

  for (
    const [key, value] of Object.entries(intent.signedParameters)
  ) {
    appendCloudinaryParameter(
      formData,
      key,
      value,
    )
  }

  const response =
    await fetch(
      intent.uploadUrl,
      {
        method: 'POST',
        body: formData,
      },
    )

  let payload = null

  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ||
        'Campaign image upload failed.',
    )
  }

  const imageUrl =
    String(
      payload?.secure_url ||
        payload?.url ||
        '',
    ).trim()

  if (!imageUrl) {
    throw new Error(
      'Campaign image upload did not return an image URL.',
    )
  }

  return {
    imageUrl,
    publicId:
      payload?.public_id || '',
  }
}

export async function getHostRetailMediaPlacementAvailability({
  placement,
  slotKey,
  durationMinutes,
  requestedStartAt = null,
}) {
  return unwrap(
    await apiClient.get(
      '/host/retail-media/placement-availability',
      {
        params: {
          placement,
          slotKey,
          durationMinutes,
          ...(requestedStartAt
            ? { requestedStartAt }
            : {}),
        },
      },
    ),
  )
}

export async function getPublicRetailMediaPromotion({
  campaignId,
}) {
  return unwrap(
    await apiClient.get(
      `/retail-media/campaigns/${path(
        campaignId,
      )}`,
    ),
  )
}

export async function getPublicSponsoredPlacement({
  placement,
  slotKey,
  marketCode = 'IN',
  viewerKey = '',
}) {
  return unwrap(
    await apiClient.get(
      '/retail-media/placement',
      {
        params: {
          placement,
          slotKey,
          marketCode,
          ...(viewerKey ? { viewerKey } : {}),
        },
      },
    ),
  )
}

export async function getHostRetailMediaPricing() {
  return unwrap(
    await apiClient.get(
      '/host/retail-media/pricing',
    ),
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

export async function updateHostRetailMediaCampaign({
  campaignId,
  input,
}) {
  return mutate({
    method:
      'patch',
    url:
      `/host/retail-media/campaigns/${path(
        campaignId,
      )}`,
    data:
      input,
  })
}

export async function createRetailMediaCampaignPaymentIntent({
  campaignId,
}) {
  return mutate({
    url:
      `/host/retail-media/campaigns/${path(
        campaignId,
      )}/payment-intent`,
    data: {},
  })
}

export async function verifyRetailMediaCampaignPayment({
  campaignId,
  razorpayPaymentId,
  razorpayOrderId,
  razorpaySignature,
}) {
  return mutate({
    url:
      `/host/retail-media/campaigns/${path(
        campaignId,
      )}/payment-verify`,
    data: {
      razorpayPaymentId,
      razorpayOrderId,
      razorpaySignature,
    },
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