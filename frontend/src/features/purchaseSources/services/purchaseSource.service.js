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

async function requestCsrfToken() {
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
      'Unable to initialize secure purchase-source request.',
    )
  }

  return data.csrfToken
}

async function protectedPost(
  url,
  payload = {},
) {
  const csrfToken =
    await requestCsrfToken()

  const response =
    await apiClient.post(
      url,
      payload,
      {
        headers: {
          'x-csrf-token':
            csrfToken,
        },
      },
    )

  return unwrapApiData(
    response,
  )
}

async function protectedPatch(
  url,
  payload,
) {
  const csrfToken =
    await requestCsrfToken()

  const response =
    await apiClient.patch(
      url,
      payload,
      {
        headers: {
          'x-csrf-token':
            csrfToken,
        },
      },
    )

  return unwrapApiData(
    response,
  )
}

async function protectedDelete(
  url,
) {
  const csrfToken =
    await requestCsrfToken()

  const response =
    await apiClient.delete(
      url,
      {
        headers: {
          'x-csrf-token':
            csrfToken,
        },
      },
    )

  return unwrapApiData(
    response,
  )
}

export async function getPurchaseSourceProviders() {
  const response =
    await apiClient.get(
      '/purchase-sources/providers',
    )

  return unwrapApiData(
    response,
  )
}

export async function getPurchaseSources() {
  const response =
    await apiClient.get(
      '/purchase-sources',
    )

  return unwrapApiData(
    response,
  )
}

export async function createPurchaseSource({
  householdId,
  provider,
  displayLabel,
  consentScopes,
}) {
  return protectedPost(
    '/purchase-sources',
    {
      householdId,
      provider,
      displayLabel,
      consentAccepted:
        true,
      consentScopes,
    },
  )
}

export async function beginPurchaseSourceAuthorization(
  sourceId,
) {
  return protectedPost(
    `/purchase-sources/${encodeURIComponent(
      sourceId,
    )}/authorization`,
  )
}

export async function requestPurchaseSourceSync(
  sourceId,
) {
  return protectedPost(
    `/purchase-sources/${encodeURIComponent(
      sourceId,
    )}/sync`,
  )
}

export async function updatePurchaseSource(
  sourceId,
  action,
) {
  return protectedPatch(
    `/purchase-sources/${encodeURIComponent(
      sourceId,
    )}/actions`,
    {
      action,
    },
  )
}

export async function getPurchaseHistory({
  sourceId = '',
  limit = 40,
} = {}) {
  const params =
    new URLSearchParams()

  if (sourceId) {
    params.set(
      'sourceId',
      sourceId,
    )
  }

  params.set(
    'limit',
    String(
      limit,
    ),
  )

  const response =
    await apiClient.get(
      `/purchase-sources/transactions/history?${params.toString()}`,
    )

  return unwrapApiData(
    response,
  )
}

export async function correctPurchaseTransaction(
  transactionId,
  payload,
) {
  return protectedPatch(
    `/purchase-sources/transactions/${encodeURIComponent(
      transactionId,
    )}`,
    payload,
  )
}

export async function deleteImportedPurchaseHistory(
  sourceId,
) {
  return protectedDelete(
    `/purchase-sources/${encodeURIComponent(
      sourceId,
    )}/history`,
  )
}
