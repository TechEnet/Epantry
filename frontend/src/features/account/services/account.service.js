import {
  apiClient,
} from '../../../api/apiClient'

/*
|--------------------------------------------------------------------------
| Response Helper
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

/*
|--------------------------------------------------------------------------
| CSRF
|--------------------------------------------------------------------------
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
      'Unable to initialize secure account request.',
    )
  }

  return csrfToken
}

/*
|--------------------------------------------------------------------------
| Profile
|--------------------------------------------------------------------------
*/

export async function getAccountProfile() {
  const response =
    await apiClient.get(
      '/account/profile',
    )

  const data =
    unwrapApiData(
      response,
    )

  return data?.profile ||
    null
}

export async function updateAccountProfile(
  payload,
) {
  const csrfToken =
    await requestCsrfToken()

  const response =
    await apiClient.patch(
      '/account/profile',

      payload,

      {
        headers: {
          'x-csrf-token':
            csrfToken,
        },
      },
    )

  const data =
    unwrapApiData(
      response,
    )

  return data?.profile ||
    null
}

function appendCloudinaryParameter(
  formData,
  key,
  value,
) {
  if (
    value ===
      undefined ||
    value ===
      null ||
    value ===
      ''
  ) {
    return
  }

  formData.append(
    key,
    Array.isArray(
      value,
    )
      ? value.join(
          ',',
        )
      : String(
          value,
        ),
  )
}

export async function uploadAccountProfilePhoto(
  file,
) {
  if (!file) {
    throw new Error(
      'Choose a profile photo first.',
    )
  }

  const csrfToken =
    await requestCsrfToken()

  const intentResponse =
    await apiClient.post(
      '/account/profile/photo-upload-intent',
      {},
      {
        headers: {
          'x-csrf-token':
            csrfToken,
        },
      },
    )

  const intentData =
    unwrapApiData(
      intentResponse,
    )

  const intent =
    intentData?.uploadIntent

  if (
    !intent?.uploadUrl ||
    !intent?.apiKey ||
    !intent?.signature ||
    !intent?.signedParameters
  ) {
    throw new Error(
      'Profile photo upload could not be initialized.',
    )
  }

  const maxBytes =
    Number(
      intent.constraints
        ?.maxBytes ||
        0,
    )

  const allowedMimeTypes =
    Array.isArray(
      intent.constraints
        ?.allowedMimeTypes,
    )
      ? intent.constraints
          .allowedMimeTypes
      : []

  if (
    maxBytes >
      0 &&
    file.size >
      maxBytes
  ) {
    throw new Error(
      'Profile photo is larger than the allowed upload size.',
    )
  }

  if (
    allowedMimeTypes.length >
      0 &&
    !allowedMimeTypes.includes(
      file.type,
    )
  ) {
    throw new Error(
      'Use a JPEG, PNG, or WebP profile photo.',
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
    const [
      key,
      value,
    ] of Object.entries(
      intent.signedParameters,
    )
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
        method:
          'POST',
        body:
          formData,
      },
    )

  let payload =
    null

  try {
    payload =
      await response.json()
  } catch {
    payload =
      null
  }

  if (!response.ok) {
    throw new Error(
      payload?.error
        ?.message ||
        'Profile photo upload failed.',
    )
  }

  const profilePhotoUrl =
    String(
      payload?.secure_url ||
        payload?.url ||
        '',
    ).trim()

  if (!profilePhotoUrl) {
    throw new Error(
      'Profile photo upload did not return an image URL.',
    )
  }

  return {
    profilePhotoUrl,
  }
}

/*
|--------------------------------------------------------------------------
| Preferences
|--------------------------------------------------------------------------
*/

export async function getAccountPreferences() {
  const response =
    await apiClient.get(
      '/account/preferences',
    )

  const data =
    unwrapApiData(
      response,
    )

  return data?.preferences ||
    null
}

export async function updateAccountPreferences(
  payload,
) {
  const csrfToken =
    await requestCsrfToken()

  const response =
    await apiClient.patch(
      '/account/preferences',

      payload,

      {
        headers: {
          'x-csrf-token':
            csrfToken,
        },
      },
    )

  const data =
    unwrapApiData(
      response,
    )

  return data?.preferences ||
    null
}

/*
|--------------------------------------------------------------------------
| Consents
|--------------------------------------------------------------------------
*/

export async function getAccountConsents() {
  const response =
    await apiClient.get(
      '/account/consents',
    )

  const data =
    unwrapApiData(
      response,
    )

  return data?.consents ||
    null
}

export async function recordAccountConsent({
  consentType,
  decision,
}) {
  const csrfToken =
    await requestCsrfToken()

  const response =
    await apiClient.post(
      '/account/consents',

      {
        consentType,

        decision,
      },

      {
        headers: {
          'x-csrf-token':
            csrfToken,
        },
      },
    )

  const data =
    unwrapApiData(
      response,
    )

  return data?.consents ||
    null
}