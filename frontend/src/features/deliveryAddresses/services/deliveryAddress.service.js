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

async function getCsrfToken() {
  const response =
    await apiClient.get(
      '/auth/csrf',
    )

  const data =
    unwrapApiData(
      response,
    )

  if (
    !data?.csrfToken
  ) {
    throw new Error(
      'Unable to obtain CSRF protection token.',
    )
  }

  return data.csrfToken
}

async function csrfRequest({
  method,
  url,
  data,
}) {
  const csrfToken =
    await getCsrfToken()

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

export function getDeliveryAddressErrorMessage(
  error,
  fallback =
    'Unable to update your delivery address right now.',
) {
  return (
    error?.response
      ?.data
      ?.message ||
    error?.message ||
    fallback
  )
}

export async function listDeliveryAddresses() {
  const response =
    await apiClient.get(
      '/delivery-addresses',
    )

  return unwrapApiData(
    response,
  )
}

export async function getDefaultDeliveryAddress() {
  const response =
    await apiClient.get(
      '/delivery-addresses/default',
    )

  return unwrapApiData(
    response,
  )
}

export async function createDeliveryAddress(
  input,
) {
  return csrfRequest({
    method:
      'post',
    url:
      '/delivery-addresses',
    data:
      input,
  })
}

export async function updateDeliveryAddress(
  addressId,
  input,
) {
  return csrfRequest({
    method:
      'patch',
    url:
      `/delivery-addresses/${encodeURIComponent(
        String(
          addressId ||
            '',
        ),
      )}`,
    data:
      input,
  })
}

export async function setDefaultDeliveryAddress(
  addressId,
) {
  return csrfRequest({
    method:
      'patch',
    url:
      `/delivery-addresses/${encodeURIComponent(
        String(
          addressId ||
            '',
        ),
      )}/default`,
  })
}
