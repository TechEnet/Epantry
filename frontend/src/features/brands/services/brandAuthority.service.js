import {
  apiClient,
} from '../../../api/apiClient'

function unwrap(
  response,
) {
  return (
    response?.data?.data ??
    response?.data ??
    null
  )
}

async function getCsrfToken() {
  const response =
    await apiClient.get(
      '/auth/csrf',
    )

  const payload =
    unwrap(
      response,
    )

  const csrfToken =
    payload?.csrfToken ||
    response?.data?.csrfToken ||
    null

  if (!csrfToken) {
    throw new Error(
      'Unable to establish CSRF protection.',
    )
  }

  return csrfToken
}

async function protectedPost(
  url,
  data = {},
) {
  const csrfToken =
    await getCsrfToken()

  const response =
    await apiClient.post(
      url,
      data,
      {
        headers: {
          'x-csrf-token':
            csrfToken,
        },
      },
    )

  return unwrap(
    response,
  )
}

/*
|--------------------------------------------------------------------------
| Public Brand World
|--------------------------------------------------------------------------
*/

export async function listBrandWorlds(
  params = {},
) {
  const response =
    await apiClient.get(
      '/brands',
      {
        params,
      },
    )

  return unwrap(
    response,
  )
}

export async function getBrandWorld(
  brandKey,
) {
  const response =
    await apiClient.get(
      `/brands/${encodeURIComponent(
        brandKey,
      )}`,
    )

  return unwrap(
    response,
  )
}

export async function getBrandProductHistory(
  brandKey,
  packId,
) {
  const response =
    await apiClient.get(
      `/brands/${encodeURIComponent(
        brandKey,
      )}/products/${encodeURIComponent(
        packId,
      )}/history`,
    )

  return unwrap(
    response,
  )
}

/*
|--------------------------------------------------------------------------
| Host — Identity Evidence
|--------------------------------------------------------------------------
*/

export async function listHostBrandIdentityChecks(
  params = {},
) {
  const response =
    await apiClient.get(
      '/host/brands/identity-checks',
      {
        params,
      },
    )

  return unwrap(
    response,
  )
}

export async function createHostBrandIdentityCheck(
  brandId,
  input,
) {
  return protectedPost(
    `/host/brands/${encodeURIComponent(
      brandId,
    )}/identity-checks`,
    input,
  )
}

/*
|--------------------------------------------------------------------------
| Host — Claims
|--------------------------------------------------------------------------
*/

export async function listHostBrandClaims(
  params = {},
) {
  const response =
    await apiClient.get(
      '/host/brands/claims',
      {
        params,
      },
    )

  return unwrap(
    response,
  )
}

export async function createHostBrandClaim(
  brandId,
  input,
) {
  return protectedPost(
    `/host/brands/${encodeURIComponent(
      brandId,
    )}/claims`,
    input,
  )
}

/*
|--------------------------------------------------------------------------
| Host — Authorities
|--------------------------------------------------------------------------
*/

export async function listHostBrandAuthorities(
  params = {},
) {
  const response =
    await apiClient.get(
      '/host/brands/authorities',
      {
        params,
      },
    )

  return unwrap(
    response,
  )
}

/*
|--------------------------------------------------------------------------
| Host — Content Overrides
|--------------------------------------------------------------------------
*/

export async function listHostBrandOverrides(
  params = {},
) {
  const response =
    await apiClient.get(
      '/host/brand-overrides',
      {
        params,
      },
    )

  return unwrap(
    response,
  )
}

export async function getHostBrandOverride(
  proposalId,
) {
  const response =
    await apiClient.get(
      `/host/brand-overrides/${encodeURIComponent(
        proposalId,
      )}`,
    )

  return unwrap(
    response,
  )
}

export async function createHostBrandOverride(
  input,
) {
  return protectedPost(
    '/host/brand-overrides',
    input,
  )
}

export async function submitHostBrandOverride(
  proposalId,
) {
  return protectedPost(
    `/host/brand-overrides/${encodeURIComponent(
      proposalId,
    )}/submit`,
  )
}

/*
|--------------------------------------------------------------------------
| Admin — Claims / Evidence
|--------------------------------------------------------------------------
*/

export async function listAdminBrandClaims(
  params = {},
) {
  const response =
    await apiClient.get(
      '/admin/brand-claims',
      {
        params,
      },
    )

  return unwrap(
    response,
  )
}

export async function getAdminBrandClaim(
  claimId,
) {
  const response =
    await apiClient.get(
      `/admin/brand-claims/${encodeURIComponent(
        claimId,
      )}`,
    )

  return unwrap(
    response,
  )
}

export async function reviewAdminBrandIdentityCheck(
  checkId,
  input,
) {
  return protectedPost(
    `/admin/brand-identity-checks/${encodeURIComponent(
      checkId,
    )}/review`,
    input,
  )
}

export async function approveAdminBrandClaim(
  claimId,
  input,
) {
  return protectedPost(
    `/admin/brand-claims/${encodeURIComponent(
      claimId,
    )}/approve`,
    input,
  )
}

export async function rejectAdminBrandClaim(
  claimId,
  input,
) {
  return protectedPost(
    `/admin/brand-claims/${encodeURIComponent(
      claimId,
    )}/reject`,
    input,
  )
}

/*
|--------------------------------------------------------------------------
| Admin — Authorities
|--------------------------------------------------------------------------
*/

export async function listAdminBrandAuthorities(
  params = {},
) {
  const response =
    await apiClient.get(
      '/admin/brand-authorities',
      {
        params,
      },
    )

  return unwrap(
    response,
  )
}

export async function changeAdminBrandAuthorityLifecycle(
  authorityId,
  input,
) {
  return protectedPost(
    `/admin/brand-authorities/${encodeURIComponent(
      authorityId,
    )}/lifecycle`,
    input,
  )
}

/*
|--------------------------------------------------------------------------
| Admin — Overrides
|--------------------------------------------------------------------------
*/

export async function listAdminBrandOverrides(
  params = {},
) {
  const response =
    await apiClient.get(
      '/admin/brand-overrides',
      {
        params,
      },
    )

  return unwrap(
    response,
  )
}

export async function reviewAdminBrandOverride(
  proposalId,
  input,
) {
  return protectedPost(
    `/admin/brand-overrides/${encodeURIComponent(
      proposalId,
    )}/review`,
    input,
  )
}

/*
|--------------------------------------------------------------------------
| Admin — Conflicts
|--------------------------------------------------------------------------
*/

export async function listAdminBrandConflicts(
  params = {},
) {
  const response =
    await apiClient.get(
      '/admin/brand-conflicts',
      {
        params,
      },
    )

  return unwrap(
    response,
  )
}

export async function resolveAdminBrandConflict(
  conflictId,
  input,
) {
  return protectedPost(
    `/admin/brand-conflicts/${encodeURIComponent(
      conflictId,
    )}/resolve`,
    input,
  )
}