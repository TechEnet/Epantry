import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  useQueryClient,
} from '@tanstack/react-query'

import {
  PWA_EVENTS,
  activatePwaUpdate,
  canInstallPwa,
  getConnectivitySnapshot,
  installPwa,
  isStandalonePwa,
  shouldShowIosInstallHint,
} from '../services/pwa.service'

const PwaContext =
  createContext(null)

function nowIso() {
  return new Date().toISOString()
}

export function PwaProvider({
  children,
}) {
  const queryClient =
    useQueryClient()

  const initialOnline =
    getConnectivitySnapshot()
      .online

  const [
    online,
    setOnline,
  ] = useState(
    initialOnline,
  )

  const onlineRef =
    useRef(
      initialOnline,
    )

  const [
    reconnectNotice,
    setReconnectNotice,
  ] = useState(false)

  const [
    reconnectedAt,
    setReconnectedAt,
  ] = useState(null)

  const [
    updateAvailable,
    setUpdateAvailable,
  ] = useState(false)

  const [
    installAvailable,
    setInstallAvailable,
  ] = useState(
    canInstallPwa(),
  )

  const [
    installed,
    setInstalled,
  ] = useState(
    isStandalonePwa(),
  )

  const [
    iosInstallHint,
  ] = useState(
    shouldShowIosInstallHint(),
  )

  const [
    registrationError,
    setRegistrationError,
  ] = useState('')

  useEffect(() => {
    function handleConnectivity(
      event,
    ) {
      const nextOnline =
        event?.detail?.online !==
        false

      const wasOnline =
        onlineRef.current

      onlineRef.current =
        nextOnline

      setOnline(
        nextOnline,
      )

      if (
        !wasOnline &&
        nextOnline
      ) {
        setReconnectedAt(
          nowIso(),
        )

        setReconnectNotice(
          true,
        )

        void queryClient.invalidateQueries({
          refetchType: 'active',
        })
      }
    }

    function handleUpdateAvailable() {
      setUpdateAvailable(
        true,
      )
    }

    function handleInstallAvailable() {
      setInstallAvailable(
        true,
      )
    }

    function handleInstalled() {
      setInstalled(
        true,
      )

      setInstallAvailable(
        false,
      )
    }

    function handleRegistrationError(
      event,
    ) {
      setRegistrationError(
        event?.detail?.message ||
          'PWA registration failed.',
      )
    }

    window.addEventListener(
      PWA_EVENTS.connectivityChanged,
      handleConnectivity,
    )

    window.addEventListener(
      PWA_EVENTS.updateAvailable,
      handleUpdateAvailable,
    )

    window.addEventListener(
      PWA_EVENTS.installAvailable,
      handleInstallAvailable,
    )

    window.addEventListener(
      PWA_EVENTS.installed,
      handleInstalled,
    )

    window.addEventListener(
      PWA_EVENTS.registrationError,
      handleRegistrationError,
    )

    return () => {
      window.removeEventListener(
        PWA_EVENTS.connectivityChanged,
        handleConnectivity,
      )

      window.removeEventListener(
        PWA_EVENTS.updateAvailable,
        handleUpdateAvailable,
      )

      window.removeEventListener(
        PWA_EVENTS.installAvailable,
        handleInstallAvailable,
      )

      window.removeEventListener(
        PWA_EVENTS.installed,
        handleInstalled,
      )

      window.removeEventListener(
        PWA_EVENTS.registrationError,
        handleRegistrationError,
      )
    }
  }, [
    queryClient,
  ])

  const install =
    useCallback(
      async () => {
        const result =
          await installPwa()

        if (
          result?.accepted ===
          true
        ) {
          setInstallAvailable(
            false,
          )
        }

        return result
      },
      [],
    )

  const activateUpdate =
    useCallback(
      () => {
        const activated =
          activatePwaUpdate()

        if (activated) {
          setUpdateAvailable(
            false,
          )
        }

        return activated
      },
      [],
    )

  const dismissReconnectNotice =
    useCallback(
      () => {
        setReconnectNotice(
          false,
        )
      },
      [],
    )

  const dismissRegistrationError =
    useCallback(
      () => {
        setRegistrationError(
          '',
        )
      },
      [],
    )

  const value =
    useMemo(
      () => ({
        online,
        offline: !online,
        reconnectNotice,
        reconnectedAt,
        updateAvailable,
        installAvailable:
          installAvailable &&
          !installed,
        installed,
        iosInstallHint:
          iosInstallHint &&
          !installed,
        registrationError,
        install,
        activateUpdate,
        dismissReconnectNotice,
        dismissRegistrationError,
      }),
      [
        online,
        reconnectNotice,
        reconnectedAt,
        updateAvailable,
        installAvailable,
        installed,
        iosInstallHint,
        registrationError,
        install,
        activateUpdate,
        dismissReconnectNotice,
        dismissRegistrationError,
      ],
    )

  return (
    <PwaContext.Provider
      value={value}
    >
      {children}
    </PwaContext.Provider>
  )
}

export function usePwa() {
  const context =
    useContext(
      PwaContext,
    )

  if (!context) {
    throw new Error(
      'usePwa must be used within PwaProvider.',
    )
  }

  return context
}
