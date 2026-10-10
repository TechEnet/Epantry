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
| Fresh Browser Location
|--------------------------------------------------------------------------
|
| A low-accuracy cached position can be many kilometres away. Request a
| fresh, high-accuracy reading and keep the best fix received while the
| device refines it. A desktop without GPS may still be coarse; do not
| describe such a reading as precise.
|
*/
const POSITION_WAIT_MS = 11000
const FIRST_FIX_REFINEMENT_MS = 1800
const TARGET_ACCURACY_METERS = 150
const PRECISE_ACCURACY_METERS = 250

const LAST_RESORT_BROWSER_OPTIONS = {
  enableHighAccuracy: false,
  timeout: 5500,
  maximumAge: 0,
}

function getPosition(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  })
}

function positionAccuracy(position) {
  const accuracy = Number(position?.coords?.accuracy)
  return Number.isFinite(accuracy) && accuracy >= 0
    ? accuracy
    : Infinity
}

function getBestPosition() {
  return new Promise((resolve, reject) => {
    let bestPosition = null
    let watchId = null
    let settled = false
    let timeoutId = null
    let refinementId = null

    const finish = (callback, value) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)
      window.clearTimeout(refinementId)
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId)
      }
      callback(value)
    }

    timeoutId = window.setTimeout(() => {
      if (bestPosition) {
        finish(resolve, bestPosition)
      } else {
        finish(reject, {
          code: 3,
          message: 'A fresh device location could not be obtained in time.',
        })
      }
    }, POSITION_WAIT_MS)

    try {
      const id = navigator.geolocation.watchPosition(
        (position) => {
          if (positionAccuracy(position) < positionAccuracy(bestPosition)) {
            bestPosition = position
          }
          if (positionAccuracy(bestPosition) <= TARGET_ACCURACY_METERS) {
            finish(resolve, bestPosition)
          } else if (refinementId === null) {
            // A desktop may never reach GPS accuracy. Return the first browser
            // fix promptly after a short chance for a better reading.
            refinementId = window.setTimeout(() => {
              finish(resolve, bestPosition)
            }, FIRST_FIX_REFINEMENT_MS)
          }
        },
        (error) => {
          // Permission denial cannot be repaired by retrying geolocation.
          if (error?.code === 1) {
            finish(reject, error)
          } else if (bestPosition) {
            finish(resolve, bestPosition)
          } else {
            finish(reject, error)
          }
        },
        {
          enableHighAccuracy: true,
          timeout: POSITION_WAIT_MS,
          maximumAge: 0,
        },
      )
      watchId = id
      // Defensive cleanup if a test/browser synchronously invokes a callback.
      if (settled) navigator.geolocation.clearWatch(id)
    } catch (error) {
      if (bestPosition) {
        finish(resolve, bestPosition)
      } else {
        finish(reject, error)
      }
    }
  })
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
    return 'Device location is blocked. Allow Location for localhost in Chrome and enable Chrome under macOS Location Services, then try again.'
  }

  if (
    error?.code === 2
  ) {
    return 'Your device could not provide a location. Check Wi-Fi and Location Services, then try again.'
  }

  if (
    error?.code === 3
  ) {
    return 'Device location took too long. Check Wi-Fi and try again.'
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
      async (reasonMessage = '') => {
        // A failed refresh must not replace an existing location with the
        // same IP guess or clear the reason why precise location failed.
        if (currentLocation) {
          setError(
            reasonMessage || 'Device location could not be refreshed.',
            'ready',
          )
          return currentLocation
        }

        try {
          const location = await getApproximateNetworkLocation()
          setLocation(location)
          if (reasonMessage) {
            setError(reasonMessage, 'ready')
          }
          return location
        } catch (networkError) {
          setError(
            reasonMessage || networkError?.message || 'Current location could not be loaded.',
          )
          return null
        }
      },
      [currentLocation, setError, setLocation],
    )

  /*
  |--------------------------------------------------------------------------
  | Request Location
  |--------------------------------------------------------------------------
  */

  const requestCurrentLocation =
    useCallback(
      async () => {
        if (useLocationStore.getState().currentLocationStatus === 'requesting') {
          return
        }

        setStatus('requesting')

        const reportLocationFailure = (message, failureStatus = 'error') => {
          setError(message, currentLocation ? 'ready' : failureStatus)
        }

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

        let position

        try {
          position = await getBestPosition()
        } catch (highAccuracyError) {
          if (highAccuracyError?.code === 1) {
            reportLocationFailure(
              getGeolocationErrorMessage(highAccuracyError),
              'denied',
            )
            return
          }

          // Some desktops can only supply a coarse browser position.
          // Still prefer a fresh browser fix over a city guessed from the IP.
          try {
            position = await getPosition(LAST_RESORT_BROWSER_OPTIONS)
          } catch (browserError) {
            if (browserError?.code === 1) {
              reportLocationFailure(
                getGeolocationErrorMessage(browserError),
                'denied',
              )
              return
            }
            await resolveApproximateLocation(
              getGeolocationErrorMessage(browserError),
            )
            return
          }
        }

        // Location accuracy (metres) is supplied by the browser itself.
        // The reverse-geocoder turns these coordinates into a readable name;
        // its result alone is not proof of GPS-level precision.
        const accuracyMeters = positionAccuracy(position)

        try {
          const location = await reverseGeocodeLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          })

          setLocation({
            ...location,
            source: 'device',
            accuracyMeters: Number.isFinite(accuracyMeters)
              ? Math.round(accuracyMeters)
              : null,
            accuracyMode: accuracyMeters <= PRECISE_ACCURACY_METERS
              ? 'precise'
              : 'approximate',
          })
        } catch (geocodingError) {
          // Never replace a valid device position with an unrelated city
          // guessed from the public IP merely because reverse geocoding failed.
          // Coordinates are intentionally not saved in session storage.
          // The browser location was still obtained: report that accurately.
          setLocation({
            label: 'Device location detected (address unavailable)',
            source: 'device',
            accuracyMeters: Number.isFinite(accuracyMeters)
              ? Math.round(accuracyMeters)
              : null,
            accuracyMode: accuracyMeters <= PRECISE_ACCURACY_METERS
              ? 'precise'
              : 'approximate',
          })
          setError(
            'Device location was detected, but its address could not be loaded. Try Refresh again.',
            'ready',
          )
        }
      },

      [
        currentLocation,
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