import {
  apiClient,
} from '../../../api/apiClient'

/*
|--------------------------------------------------------------------------
| API Response Unwrapper
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
      'Unable to initialize secure household invitation request.',
    )
  }

  return csrfToken
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

/*
|--------------------------------------------------------------------------
| Household-side Invitation Administration
|--------------------------------------------------------------------------
*/

export async function listHouseholdInvitations(
  householdId,
) {
  const response =
    await apiClient.get(
      `/households/${encodeURIComponent(
        householdId,
      )}/invitations`,
    )

  return unwrapApiData(
    response,
  )
}

export async function createHouseholdInvitation(
  householdId,
  {
    email,
    role,
    roleLabel,
  },
) {
  return protectedPost(
    `/households/${encodeURIComponent(
      householdId,
    )}/invitations`,
    {
      email,
      role,
      roleLabel,
    },
  )
}

export async function resendHouseholdInvitation(
  householdId,
  invitationId,
) {
  return protectedPost(
    `/households/${encodeURIComponent(
      householdId,
    )}/invitations/${encodeURIComponent(
      invitationId,
    )}/resend`,
  )
}

export async function revokeHouseholdInvitation(
  householdId,
  invitationId,
) {
  return protectedDelete(
    `/households/${encodeURIComponent(
      householdId,
    )}/invitations/${encodeURIComponent(
      invitationId,
    )}`,
  )
}


export async function getHouseholdInvitationPreview(
  token,
) {
  const response =
    await apiClient.get(
      `/households/invitations/${encodeURIComponent(
        token,
      )}/preview`,
    )

  return unwrapApiData(
    response,
  )
}

/*
|--------------------------------------------------------------------------
| Invitee Invitation Lifecycle
|--------------------------------------------------------------------------
*/

export async function getHouseholdInvitation(
  token,
) {
  const response =
    await apiClient.get(
      `/households/invitations/${encodeURIComponent(
        token,
      )}`,
    )

  return unwrapApiData(
    response,
  )
}

export async function acceptHouseholdInvitation(
  token,
) {
  return protectedPost(
    `/households/invitations/${encodeURIComponent(
      token,
    )}/accept`,
  )
}

export async function declineHouseholdInvitation(
  token,
) {
  return protectedPost(
    `/households/invitations/${encodeURIComponent(
      token,
    )}/decline`,
  )
}
