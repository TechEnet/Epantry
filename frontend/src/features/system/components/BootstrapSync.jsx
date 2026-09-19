import {
  useEffect,
  useState,
} from 'react'

import {
  useAppStore,
} from '../../../store/app.store'

import {
  useBootstrapQuery,
} from '../hooks/useBootstrapQuery'

export default function BootstrapSync() {
  const {
    data,
  } =
    useBootstrapQuery()

  const setFeatureFlags =
    useAppStore(
      (
        state,
      ) =>
        state.setFeatureFlags,
    )

  const [
    isOnline,
    setIsOnline,
  ] =
    useState(
      () =>
        typeof navigator ===
          'undefined' ||
        navigator.onLine,
    )

  useEffect(
    () => {
      if (
        data?.data?.features
      ) {
        setFeatureFlags(
          data.data.features,
        )
      }
    },
    [
      data,
      setFeatureFlags,
    ],
  )

  useEffect(
    () => {
      function syncNetworkState() {
        setIsOnline(
          navigator.onLine,
        )
      }

      window.addEventListener(
        'online',
        syncNetworkState,
      )

      window.addEventListener(
        'offline',
        syncNetworkState,
      )

      return () => {
        window.removeEventListener(
          'online',
          syncNetworkState,
        )

        window.removeEventListener(
          'offline',
          syncNetworkState,
        )
      }
    },
    [],
  )

  if (
    isOnline
  ) {
    return null
  }

  return (
    <div
      className="sticky top-0 z-[100] border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-bold text-amber-900"
      aria-live="polite"
      role="status"
    >
      You are offline. Cached screens may remain visible, but live price, stock, order, privacy, admin and partner data can be stale or unavailable.
    </div>
  )
}