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
      'Unable to initialize secure household request.',
    )
  }

  return csrfToken
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

/*
|--------------------------------------------------------------------------
| Current Household
|--------------------------------------------------------------------------
*/

export async function getMyHousehold() {
  const response =
    await apiClient.get(
      '/households/me',
    )

  return unwrapApiData(
    response,
  )
}


export async function selectMyHousehold(
  householdId,
) {
  const csrfToken =
    await requestCsrfToken()

  const response =
    await apiClient.post(
      `/households/${encodeURIComponent(
        householdId,
      )}/select`,
      {},
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
| Household Members
|--------------------------------------------------------------------------
*/

export async function getMyHouseholdMembers() {
  const response =
    await apiClient.get(
      '/households/me/members',
    )

  return unwrapApiData(
    response,
  )
}

export async function updateHouseholdMemberRole(
  householdId,
  membershipId,
  role,
) {
  return protectedPatch(
    `/households/${encodeURIComponent(
      householdId,
    )}/members/${encodeURIComponent(
      membershipId,
    )}/role`,
    {
      role,
    },
  )
}

export async function removeHouseholdMember(
  householdId,
  membershipId,
) {
  return protectedDelete(
    `/households/${encodeURIComponent(
      householdId,
    )}/members/${encodeURIComponent(
      membershipId,
    )}`,
  )
}

/*
|--------------------------------------------------------------------------
| Create Household
|--------------------------------------------------------------------------
*/

export async function createMyHousehold({
  name,
  usualPeopleCount,
}) {
  const csrfToken =
    await requestCsrfToken()

  const response =
    await apiClient.post(
      '/households',

      {
        name,

        usualPeopleCount,
      },

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
