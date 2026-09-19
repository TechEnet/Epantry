import { apiClient } from '../../../api/apiClient'

function unwrapApiData(response) {
  if (
    response?.data &&
    typeof response.data === 'object' &&
    Object.prototype.hasOwnProperty.call(response.data, 'success')
  ) {
    return response.data.data
  }

  return response?.data ?? response
}

function encodePath(value) {
  return encodeURIComponent(String(value || '').trim())
}

async function getCsrfToken() {
  const response = await apiClient.get('/auth/csrf')
  const data = unwrapApiData(response)

  if (!data?.csrfToken) {
    throw new Error('Unable to obtain CSRF protection token.')
  }

  return data.csrfToken
}

async function csrfRequest({ method, url, data }) {
  const csrfToken = await getCsrfToken()
  const response = await apiClient.request({
    method,
    url,
    data,
    headers: {
      'x-csrf-token': csrfToken,
    },
  })

  return unwrapApiData(response)
}

function scopePrefix(scope) {
  return scope === 'host'
    ? '/host/media-privacy'
    : '/media-privacy'
}

export function extractMediaPrivacyHolds(error) {
  const errors = Array.isArray(error?.response?.data?.errors)
    ? error.response.data.errors
    : []

  return errors.filter(
    (item) => item?.code === 'MEDIA_PRIVACY_CLEARANCE_REQUIRED',
  )
}

export function getMediaPrivacyErrorMessage(
  error,
  fallback = 'Unable to complete the privacy action right now.',
) {
  return error?.response?.data?.message || error?.message || fallback
}

export async function getMediaPrivacyState(imageEvidenceId, scope = 'customer') {
  const response = await apiClient.get(
    `${scopePrefix(scope)}/evidence/${encodePath(imageEvidenceId)}`,
  )

  return unwrapApiData(response)
}

export async function recheckMediaPrivacy(imageEvidenceId, scope = 'customer') {
  return csrfRequest({
    method: 'post',
    url: `${scopePrefix(scope)}/evidence/${encodePath(imageEvidenceId)}/recheck`,
  })
}

export async function requestMediaRedaction({
  imageEvidenceId,
  assessmentId,
  operations,
  scope = 'customer',
}) {
  return csrfRequest({
    method: 'post',
    url: `${scopePrefix(scope)}/evidence/${encodePath(imageEvidenceId)}/redaction-jobs`,
    data: {
      assessmentId,
      operations,
    },
  })
}

export async function requestMediaCleanup(imageEvidenceId, scope = 'customer') {
  return csrfRequest({
    method: 'post',
    url: `${scopePrefix(scope)}/evidence/${encodePath(imageEvidenceId)}/cleanup-request`,
  })
}

export async function listAdminMediaPrivacyReviews({
  page = 1,
  limit = 20,
  status = 'open',
} = {}) {
  const response = await apiClient.get('/admin/media-privacy/review-cases', {
    params: { page, limit, status },
  })

  return unwrapApiData(response)
}

export async function resolveAdminMediaPrivacyReview({
  privacyReviewCaseId,
  decision,
  resolutionNote,
}) {
  return csrfRequest({
    method: 'patch',
    url: `/admin/media-privacy/review-cases/${encodePath(privacyReviewCaseId)}`,
    data: {
      decision,
      resolutionNote,
    },
  })
}
