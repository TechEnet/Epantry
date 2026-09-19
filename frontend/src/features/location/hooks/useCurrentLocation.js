import {
  useCallback,
} from 'react'

import {
  getApproximateNetworkLocation,
  reverseGeocodeLocation,
} from '../api/locationApi'

import {
  useLocationStore,
} from '../store/location.store'

/*
|--------------------------------------------------------------------------
| Geolocation Options
|--------------------------------------------------------------------------
*/

const FIRST_ATTEMPT_OPTIONS = {
  enableHighAccuracy: false,

  timeout: 10000,

  maximumAge:
    5 * 60 * 1000,
}

const WATCH_ATTEMPT_OPTIONS = {
  enableHighAccuracy: true,

  timeout: 10000,

  maximumAge: 0,
}

/*
|--------------------------------------------------------------------------
| One-Time Position
|--------------------------------------------------------------------------
*/

function getPosition(
  options,
) {
  return new Promise(
    (
      resolve,
      reject,
    ) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        options,
      )
    },
  )
}

/*
|--------------------------------------------------------------------------
| Retry Through Watch Position
|--------------------------------------------------------------------------
|
| Some devices temporarily report POSITION_UNAVAILABLE even though
| permission has already been granted.
|
*/

function watchForPosition(
  options,
) {
  return new Promise(
    (
      resolve,
      reject,
    ) => {
      let watchId = null

      let settled = false

      const finish = (
        callback,
        value,
      ) => {
        if (settled) {
          return
        }

        settled = true

        if (
          watchId !== null
        ) {
          navigator.geolocation.clearWatch(
            watchId,
          )
        }

        window.clearTimeout(
          timeoutId,
        )

        callback(value)
      }

      const timeoutId =
        window.setTimeout(
          () => {
            finish(
              reject,

              {
                code: 3,

                message:
                  'Location request timed out.',
              },
            )
          },

          12000,
        )

      watchId =
        navigator.geolocation.watchPosition(
          (position) => {
            finish(
              resolve,
              position,
            )
          },

          (error) => {
            /*
            |--------------------------------------------------------------------------
            | Permission Denied
            |--------------------------------------------------------------------------
            |
            | Do not keep retrying if the user/browser denied permission.
            |
            */

            if (
              error?.code ===
              1
            ) {
              finish(
                reject,
                error,
              )
            }
          },

          options,
        )
    },
  )
}

/*
|--------------------------------------------------------------------------
| Secure Context
|--------------------------------------------------------------------------
*/

function isLocalhost() {
  return [
    'localhost',
    '127.0.0.1',
    '[::1]',
  ].includes(
    window.location.hostname,
  )
}

function canRequestPreciseLocation() {
  return (
    window.isSecureContext ||
    isLocalhost()
  )
}

/*
|--------------------------------------------------------------------------
| Error Message
|--------------------------------------------------------------------------
*/

function getGeolocationErrorMessage(
  error,
) {
  if (
    error?.code === 1
  ) {
    return 'Location permission was denied. Allow location access in your browser settings and try again.'
  }

  if (
    error?.code === 2
  ) {
    return 'A precise location is temporarily unavailable on this device.'
  }

  if (
    error?.code === 3
  ) {
    return 'The precise location request timed out.'
  }

  return 'Your current location could not be determined.'
}

/*
|--------------------------------------------------------------------------
| Hook
|--------------------------------------------------------------------------
*/

export function useCurrentLocation() {
  const currentLocation =
    useLocationStore(
      (state) =>
        state.currentLocation,
    )

  const status =
    useLocationStore(
      (state) =>
        state.currentLocationStatus,
    )

  const error =
    useLocationStore(
      (state) =>
        state.currentLocationError,
    )

  const setStatus =
    useLocationStore(
      (state) =>
        state.setCurrentLocationStatus,
    )

  const setLocation =
    useLocationStore(
      (state) =>
        state.setCurrentLocation,
    )

  const setError =
    useLocationStore(
      (state) =>
        state.setCurrentLocationError,
    )

  /*
  |--------------------------------------------------------------------------
  | Approximate Fallback
  |--------------------------------------------------------------------------
  */

  const resolveApproximateLocation =
    useCallback(
      async (
        reasonMessage = '',
      ) => {
        try {
          setStatus(
            'requesting',
          )

          const location =
            await getApproximateNetworkLocation()

          setLocation(
            location,
          )

          return location
        } catch (
          networkError
        ) {
          setError(
            reasonMessage ||
              networkError?.message ||
              'Current location could not be loaded.',
          )

          return null
        }
      },

      [
        setError,
        setLocation,
        setStatus,
      ],
    )

  /*
  |--------------------------------------------------------------------------
  | Request Location
  |--------------------------------------------------------------------------
  */

  const requestCurrentLocation =
    useCallback(
      async () => {
        /*
        |--------------------------------------------------------------------------
        | Browser Has No Geolocation API
        |--------------------------------------------------------------------------
        */

        if (
          !navigator.geolocation
        ) {
          await resolveApproximateLocation(
            'Precise location is not supported by this browser.',
          )

          return
        }

        /*
        |--------------------------------------------------------------------------
        | Mobile LAN HTTP
        |--------------------------------------------------------------------------
        |
        | Precise browser location generally requires a secure context.
        | Use approximate network location during insecure local development.
        |
        */

        if (
          !canRequestPreciseLocation()
        ) {
          await resolveApproximateLocation(
            'Precise browser location requires a secure connection on this device.',
          )

          return
        }

        setStatus(
          'requesting',
        )

        try {
          let position

          /*
          |--------------------------------------------------------------------------
          | Attempt 1
          |--------------------------------------------------------------------------
          |
          | Lower accuracy is intentionally tried first because desktop
          | devices often resolve it more reliably.
          |
          */

          try {
            position =
              await getPosition(
                FIRST_ATTEMPT_OPTIONS,
              )
          } catch (
            firstError
          ) {
            /*
            |--------------------------------------------------------------------------
            | Permission Denied
            |--------------------------------------------------------------------------
            */

            if (
              firstError?.code ===
              1
            ) {
              setError(
                getGeolocationErrorMessage(
                  firstError,
                ),

                'denied',
              )

              return
            }

            /*
            |--------------------------------------------------------------------------
            | Attempt 2
            |--------------------------------------------------------------------------
            */

            position =
              await watchForPosition(
                WATCH_ATTEMPT_OPTIONS,
              )
          }

          /*
          |--------------------------------------------------------------------------
          | Reverse Geocode
          |--------------------------------------------------------------------------
          */

          const location =
            await reverseGeocodeLocation(
              {
                latitude:
                  position.coords
                    .latitude,

                longitude:
                  position.coords
                    .longitude,
              },
            )

          setLocation(
            location,
          )
        } catch (
          locationError
        ) {
          /*
          |--------------------------------------------------------------------------
          | Explicit Denial
          |--------------------------------------------------------------------------
          */

          if (
            locationError?.code ===
            1
          ) {
            setError(
              getGeolocationErrorMessage(
                locationError,
              ),

              'denied',
            )

            return
          }

          /*
          |--------------------------------------------------------------------------
          | GPS / CoreLocation Temporarily Unavailable
          |--------------------------------------------------------------------------
          |
          | Fall back to approximate city-level network location.
          |
          */

          await resolveApproximateLocation(
            getGeolocationErrorMessage(
              locationError,
            ),
          )
        }
      },

      [
        resolveApproximateLocation,
        setError,
        setLocation,
        setStatus,
      ],
    )

  return {
    currentLocation,

    status,

    error,

    requestCurrentLocation,
  }
}