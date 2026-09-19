import {
  apiClient,
} from '../../../api/apiClient'

/*
|--------------------------------------------------------------------------
| Precise GPS Location
|--------------------------------------------------------------------------
*/

export async function reverseGeocodeLocation({
  latitude,
  longitude,
}) {
  const response =
    await apiClient.post(
      '/location/reverse-geocode',

      {
        latitude,
        longitude,
      },
    )

  return {
    ...response.data.data,

    accuracyMode:
      'precise',
  }
}

/*
|--------------------------------------------------------------------------
| Approximate Network Location
|--------------------------------------------------------------------------
|
| Used only when precise browser/device geolocation cannot be obtained.
|
| This is intentionally marked as approximate because an IP-derived
| location is not the same as GPS location.
|
*/

export async function getApproximateNetworkLocation() {
  const response =
    await fetch(
      'https://ipapi.co/json/',

      {
        headers: {
          Accept:
            'application/json',
        },
      },
    )

  if (!response.ok) {
    throw new Error(
      'Approximate location lookup failed.',
    )
  }

  const data =
    await response.json()

  if (data?.error) {
    throw new Error(
      data.reason ||
        'Approximate location lookup failed.',
    )
  }

  const city =
    data?.city || ''

  const state =
    data?.region || ''

  const country =
    data?.country_name || ''

  const label = [
    city,
    state,
    country,
  ]
    .filter(Boolean)
    .join(', ')

  if (!label) {
    throw new Error(
      'Approximate location could not be determined.',
    )
  }

  return {
    city,

    state,

    country,

    postcode:
      data?.postal || '',

    label,

    provider:
      'IP network location',

    source:
      'network',

    accuracyMode:
      'approximate',
  }
}