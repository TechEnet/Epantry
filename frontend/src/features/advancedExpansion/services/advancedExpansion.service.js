import {
  apiClient,
} from '../../../api/apiClient'

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
    return response.data.data
  }

  return (
    response?.data ??
    response
  )
}

async function getCsrfToken() {
  const response =
    await apiClient.get(
      '/auth/csrf',
    )

  const data =
    unwrapApiData(
      response,
    )

  if (!data?.csrfToken) {
    throw new Error(
      'Unable to obtain CSRF protection token.',
    )
  }

  return data.csrfToken
}

async function csrfRequest({
  method,
  url,
  data = {},
}) {
  const csrfToken =
    await getCsrfToken()

  return unwrapApiData(
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

export function getAdvancedExpansionErrorMessage(
  error,
  fallback =
    'Unable to load advanced household intelligence right now.',
) {
  return (
    error?.message ||
    fallback
  )
}

export async function listReceiptImports({
  limit = 50,
} = {}) {
  return unwrapApiData(
    await apiClient.get(
      `/pantry/intelligence/receipt-imports?limit=${encodeURIComponent(
        limit,
      )}`,
    ),
  )
}

export async function createReceiptImport(
  input,
) {
  return csrfRequest({
    method:
      'post',

    url:
      '/pantry/intelligence/receipt-imports',

    data:
      input,
  })
}

export async function reviewReceiptLine({
  receiptImportId,
  lineKey,
  action,
  canonicalPackId,
}) {
  return csrfRequest({
    method:
      'post',

    url:
      `/pantry/intelligence/receipt-imports/${encodeURIComponent(
        receiptImportId,
      )}/lines/${encodeURIComponent(
        lineKey,
      )}/review`,

    data: {
      action,

      ...(canonicalPackId
        ? {
            canonicalPackId,
          }
        : {}),
    },
  })
}

export async function cancelReceiptImport(
  receiptImportId,
) {
  return csrfRequest({
    method:
      'post',

    url:
      `/pantry/intelligence/receipt-imports/${encodeURIComponent(
        receiptImportId,
      )}/cancel`,
  })
}

export async function getHouseholdMemory() {
  return unwrapApiData(
    await apiClient.get(
      '/pantry/intelligence/memory',
    ),
  )
}

export async function updateMemoryControl({
  memoryFactId,
  action,
}) {
  return csrfRequest({
    method:
      'post',

    url:
      `/pantry/intelligence/memory/${encodeURIComponent(
        memoryFactId,
      )}/control`,

    data: {
      action,
    },
  })
}

export async function recordLeftover(
  input,
) {
  return csrfRequest({
    method:
      'post',

    url:
      '/pantry/intelligence/leftovers',

    data:
      input,
  })
}

export async function getAdvancedPlanningIntelligence({
  horizonDays = 7,
} = {}) {
  return unwrapApiData(
    await apiClient.get(
      `/pantry/intelligence/planning?horizonDays=${encodeURIComponent(
        horizonDays,
      )}`,
    ),
  )
}