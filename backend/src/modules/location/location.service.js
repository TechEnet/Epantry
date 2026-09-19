import {
  env,
} from '../../config/env.js'

import {
  ApiError,
} from '../../utils/ApiError.js'

const CACHE_TTL_MS =
  24 * 60 * 60 * 1000

/*
|--------------------------------------------------------------------------
| Nominatim public API limit is one request per second.
|--------------------------------------------------------------------------
*/

const PROVIDER_MIN_INTERVAL_MS =
  1100

const reverseGeocodeCache =
  new Map()

let providerQueue =
  Promise.resolve()

let lastProviderRequestAt =
  0

function wait(
  milliseconds,
) {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        milliseconds,
      ),
  )
}

function validateCoordinate(
  value,
  minimum,
  maximum,
  fieldName,
) {
  const number =
    Number(value)

  if (
    !Number.isFinite(
      number,
    ) ||
    number < minimum ||
    number > maximum
  ) {
    throw new ApiError(
      400,
      `${fieldName} must be a valid coordinate.`,
    )
  }

  return number
}

function getCacheKey(
  latitude,
  longitude,
) {
  return `${latitude.toFixed(
    4,
  )}:${longitude.toFixed(4)}`
}

function readCachedLocation(
  key,
) {
  const cached =
    reverseGeocodeCache.get(
      key,
    )

  if (!cached) {
    return null
  }

  if (
    Date.now() -
      cached.cachedAt >
    CACHE_TTL_MS
  ) {
    reverseGeocodeCache.delete(
      key,
    )

    return null
  }

  return cached.value
}

function writeCachedLocation(
  key,
  value,
) {
  reverseGeocodeCache.set(
    key,
    {
      cachedAt:
        Date.now(),

      value,
    },
  )
}

async function runProviderRequest(
  request,
) {
  const previous =
    providerQueue.catch(
      () => undefined,
    )

  providerQueue =
    previous.then(
      async () => {
        const elapsed =
          Date.now() -
          lastProviderRequestAt

        const waitFor =
          Math.max(
            0,
            PROVIDER_MIN_INTERVAL_MS -
              elapsed,
          )

        if (waitFor > 0) {
          await wait(
            waitFor,
          )
        }

        try {
          return await request()
        } finally {
          lastProviderRequestAt =
            Date.now()
        }
      },
    )

  return providerQueue
}

function normalizeLocation(
  providerData,
) {
  const address =
    providerData?.address ||
    {}

  const city =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.city_district ||
    address.county ||
    ''

  const state =
    address.state ||
    address.region ||
    ''

  const country =
    address.country || ''

  const district =
    address.city_district ||
    address.state_district ||
    address.county ||
    ''

  const neighbourhood =
    address.neighbourhood ||
    address.quarter ||
    ''

  const suburb =
    address.suburb ||
    address.residential ||
    ''

  const road =
    address.road ||
    address.pedestrian ||
    address.footway ||
    ''

  const houseNumber =
    address.house_number ||
    ''

  const compactLabel = [
    houseNumber && road
      ? `${houseNumber} ${road}`
      : road,
    neighbourhood ||
      suburb,
    city,
    state,
    country,
  ]
    .filter(Boolean)
    .join(', ')

  return {
    houseNumber,

    road,

    neighbourhood,

    suburb,

    district,

    city,

    state,

    country,

    postcode:
      address.postcode ||
      '',

    label:
      compactLabel ||
      providerData?.display_name ||
      'Location available',

    provider:
      'OpenStreetMap Nominatim',
  }
}

export async function reverseGeocode({
  latitude,
  longitude,
}) {
  const safeLatitude =
    validateCoordinate(
      latitude,
      -90,
      90,
      'latitude',
    )

  const safeLongitude =
    validateCoordinate(
      longitude,
      -180,
      180,
      'longitude',
    )

  const cacheKey =
    getCacheKey(
      safeLatitude,
      safeLongitude,
    )

  const cachedLocation =
    readCachedLocation(
      cacheKey,
    )

  if (cachedLocation) {
    return {
      ...cachedLocation,

      source: 'cache',
    }
  }

  const location =
    await runProviderRequest(
      async () => {
        const url =
          new URL(
            '/reverse',
            env.geocodingBaseUrl,
          )

        url.searchParams.set(
          'format',
          'jsonv2',
        )

        url.searchParams.set(
          'lat',
          String(
            safeLatitude,
          ),
        )

        url.searchParams.set(
          'lon',
          String(
            safeLongitude,
          ),
        )

        url.searchParams.set(
          'zoom',
          '18',
        )

        url.searchParams.set(
          'addressdetails',
          '1',
        )

        url.searchParams.set(
          'accept-language',
          'en',
        )

        let response

        try {
          response =
            await fetch(
              url,
              {
                headers: {
                  Accept:
                    'application/json',

                  'User-Agent':
                    env.geocodingUserAgent,
                },

                signal:
                  AbortSignal.timeout(
                    8000,
                  ),
              },
            )
        } catch {
          throw new ApiError(
            502,
            'Location lookup provider is currently unavailable.',
          )
        }

        if (
          !response.ok
        ) {
          throw new ApiError(
            502,
            'Location lookup provider returned an error.',
          )
        }

        const providerData =
          await response.json()

        return normalizeLocation(
          providerData,
        )
      },
    )

  writeCachedLocation(
    cacheKey,
    location,
  )

  return {
    ...location,

    source: 'provider',
  }
}