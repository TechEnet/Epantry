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

export async function getPublicPackOffers({
  packId,
  pincode,
  fulfillmentType,
}) {
  const response =
    await apiClient.get(
      `/marketplace/packs/${encodeURIComponent(
        packId,
      )}/offers`,
      {
        params: {
          pincode,

          ...(fulfillmentType
            ? {
                fulfillmentType,
              }
            : {}),
        },
      },
    )

  return unwrap(
    response,
  )
}

/*
|--------------------------------------------------------------------------
| Host Organization
|--------------------------------------------------------------------------
*/

export async function getHostMarketplaceOrganization() {
  const response =
    await apiClient.get(
      '/host/marketplace/organization',
    )

  return unwrap(
    response,
  )
}

/*
|--------------------------------------------------------------------------
| Host Offers
|--------------------------------------------------------------------------
*/

export async function listHostOffers(
  params = {},
) {
  const response =
    await apiClient.get(
      '/host/marketplace/offers',
      {
        params,
      },
    )

  return unwrap(
    response,
  )
}

export async function createHostOffer(
  input,
) {
  return protectedPost(
    '/host/marketplace/offers',
    input,
  )
}

export async function updateHostOffer(
  offerId,
  input,
) {
  const csrfToken =
    await getCsrfToken()

  const response =
    await apiClient.patch(
      `/host/marketplace/offers/${encodeURIComponent(
        offerId,
      )}`,
      input,
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

export async function deleteHostOffer(
  offerId,
) {
  return updateHostOffer(
    offerId,
    {
      status:
        'retired',
    },
  )
}

export async function getHostOfferReadiness(
  offerId,
) {
  const response =
    await apiClient.get(
      `/host/marketplace/offers/${encodeURIComponent(
        offerId,
      )}/readiness`,
    )

  return unwrap(
    response,
  )
}

export async function activateHostOffer(
  offerId,
) {
  return protectedPost(
    `/host/marketplace/offers/${encodeURIComponent(
      offerId,
    )}/activate`,
  )
}

/*
|--------------------------------------------------------------------------
| Pricing
|--------------------------------------------------------------------------
*/

export async function createHostPriceRule(
  offerId,
  input,
) {
  return protectedPost(
    `/host/marketplace/offers/${encodeURIComponent(
      offerId,
    )}/prices`,
    input,
  )
}

export async function getHostEffectivePrice(
  offerId,
) {
  const response =
    await apiClient.get(
      `/host/marketplace/offers/${encodeURIComponent(
        offerId,
      )}/effective-price`,
    )

  return unwrap(
    response,
  )
}

/*
|--------------------------------------------------------------------------
| Inventory
|--------------------------------------------------------------------------
*/

export async function listInventoryNodes(
  params = {},
) {
  const response =
    await apiClient.get(
      '/host/marketplace/inventory-nodes',
      {
        params,
      },
    )

  return unwrap(
    response,
  )
}

export async function createInventoryNode(
  input,
) {
  return protectedPost(
    '/host/marketplace/inventory-nodes',
    input,
  )
}

export async function createInventorySnapshots(
  items,
) {
  return protectedPost(
    '/host/marketplace/inventory-snapshots/bulk',
    {
      items,
    },
  )
}

export async function getHostCurrentInventory(
  offerId,
) {
  const response =
    await apiClient.get(
      `/host/marketplace/offers/${encodeURIComponent(
        offerId,
      )}/current-inventory`,
    )

  return unwrap(
    response,
  )
}

/*
|--------------------------------------------------------------------------
| Service Areas
|--------------------------------------------------------------------------
*/

export async function listServiceAreas(
  params = {},
) {
  const response =
    await apiClient.get(
      '/host/marketplace/service-areas',
      {
        params,
      },
    )

  return unwrap(
    response,
  )
}

export async function createServiceArea(
  input,
) {
  return protectedPost(
    '/host/marketplace/service-areas',
    input,
  )
}

export async function updateServiceArea(
  serviceAreaId,
  input,
) {
  const csrfToken =
    await getCsrfToken()

  const response =
    await apiClient.patch(
      `/host/marketplace/service-areas/${encodeURIComponent(
        serviceAreaId,
      )}`,
      input,
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

export async function checkHostOfferServiceability(
  offerId,
  {
    pincode,
    fulfillmentType,
  },
) {
  const response =
    await apiClient.get(
      `/host/marketplace/offers/${encodeURIComponent(
        offerId,
      )}/serviceability`,
      {
        params: {
          pincode,

          ...(fulfillmentType
            ? {
                fulfillmentType,
              }
            : {}),
        },
      },
    )

  return unwrap(
    response,
  )
}