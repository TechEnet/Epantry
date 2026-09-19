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
  API_AUTH_SESSION_INVALIDATED_EVENT,
} from '../../../api/apiClient'

import {
  AUTH_SESSION_CLEARED_EVENT,
  AUTH_SESSION_ESTABLISHED_EVENT,
  cancelPendingMfaLogin,
  completeMfaLogin as completeMfaLoginService,
  getCurrentAuthSession,
  loginWithEmailAndPassword,
  logoutCurrentSession,
  requestHostAccess as requestHostAccessService,
  switchActiveMode as switchActiveModeService,
} from '../services/auth.service'

const AuthContext =
  createContext(null)

/*
|--------------------------------------------------------------------------
| Session Normalizer
|--------------------------------------------------------------------------
*/

function normalizeSession(
  session,
) {
  if (
    session?.authenticated ===
      true &&
    session?.user
  ) {
    return {
      authenticated:
        true,

      user:
        session.user,
    }
  }

  return {
    authenticated:
      false,

    user:
      null,
  }
}

/*
|--------------------------------------------------------------------------
| Available Modes Normalizer
|--------------------------------------------------------------------------
|
| availableModes is supplied by the backend and is used only for experience
| selection.
|
| It is NOT treated as a replacement for backend authorization.
|
*/

function normalizeAvailableModes(
  user,
) {
  if (
    !Array.isArray(
      user?.availableModes,
    )
  ) {
    return []
  }

  return user.availableModes.filter(
    (mode) =>
      mode ===
        'customer' ||
      mode ===
        'host',
  )
}

/*
|--------------------------------------------------------------------------
| Active Mode Normalizer
|--------------------------------------------------------------------------
|
| activeMode is UX state only.
|
| The backend remains authoritative for actual Customer / Host access.
|
*/

function normalizeActiveMode(
  user,
  availableModes,
) {
  const mode =
    user?.activeMode

  if (
    mode !==
      'customer' &&
    mode !==
      'host'
  ) {
    return null
  }

  if (
    !availableModes.includes(
      mode,
    )
  ) {
    return null
  }

  return mode
}

export function AuthProvider({
  children,
}) {
  const [
    user,
    setUser,
  ] = useState(null)

  const userRef =
    useRef(null)

  /*
  |--------------------------------------------------------------------------
  | MFA Login Challenge
  |--------------------------------------------------------------------------
  |
  | Important:
  |
  | This contains ONLY safe metadata.
  |
  | Firebase MultiFactorResolver itself remains private inside auth.service.js.
  |
  */

  const [
    mfaChallenge,
    setMfaChallenge,
  ] = useState(null)

  const [
    isBootstrapping,
    setIsBootstrapping,
  ] = useState(true)

  const [
    isAuthenticating,
    setIsAuthenticating,
  ] = useState(false)

  const [
    isCompletingMfa,
    setIsCompletingMfa,
  ] = useState(false)

  const [
    isLoggingOut,
    setIsLoggingOut,
  ] = useState(false)

  const [
    isRefreshing,
    setIsRefreshing,
  ] = useState(false)

  const [
    isSwitchingMode,
    setIsSwitchingMode,
  ] = useState(false)

  const [
    isRequestingHostAccess,
    setIsRequestingHostAccess,
  ] = useState(false)

  const [
    authError,
    setAuthError,
  ] = useState(null)

  const [
    sessionNotice,
    setSessionNotice,
  ] = useState(null)

  /*
  |--------------------------------------------------------------------------
  | Current User Ref
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    userRef.current =
      user
  }, [
    user,
  ])

  /*
  |--------------------------------------------------------------------------
  | Session Bootstrap + Global Events
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    let isActive =
      true

    /*
    |--------------------------------------------------------------------------
    | Session Established
    |--------------------------------------------------------------------------
    |
    | Triggered by:
    |
    | - normal login
    | - MFA login
    | - registration
    | - MFA enrollment
    |
    */

    const handleEstablishedSession =
      (event) => {
        if (!isActive) {
          return
        }

        const session =
          normalizeSession(
            event.detail,
          )

        if (
          !session.authenticated
        ) {
          return
        }

        userRef.current =
          session.user

        setUser(
          session.user,
        )

        setMfaChallenge(
          null,
        )

        setAuthError(
          null,
        )

        setSessionNotice(
          null,
        )
      }

    /*
    |--------------------------------------------------------------------------
    | Session Cleared
    |--------------------------------------------------------------------------
    */

    const handleClearedSession =
      () => {
        if (!isActive) {
          return
        }

        userRef.current =
          null

        setUser(
          null,
        )

        setMfaChallenge(
          null,
        )

        setAuthError(
          null,
        )

        setSessionNotice(
          null,
        )
      }

    /*
    |--------------------------------------------------------------------------
    | Expired / Invalid Server Session
    |--------------------------------------------------------------------------
    */

    const handleInvalidSession =
      () => {
        if (!isActive) {
          return
        }

        const hadAuthenticatedUser =
          Boolean(
            userRef.current,
          )

        userRef.current =
          null

        setUser(
          null,
        )

        setMfaChallenge(
          null,
        )

        if (
          hadAuthenticatedUser
        ) {
          setSessionNotice(
            'Your session has expired. Please sign in again.',
          )
        }
      }

    window.addEventListener(
      AUTH_SESSION_ESTABLISHED_EVENT,
      handleEstablishedSession,
    )

    window.addEventListener(
      AUTH_SESSION_CLEARED_EVENT,
      handleClearedSession,
    )

    window.addEventListener(
      API_AUTH_SESSION_INVALIDATED_EVENT,
      handleInvalidSession,
    )

    /*
    |--------------------------------------------------------------------------
    | HttpOnly Session Bootstrap
    |--------------------------------------------------------------------------
    */

    const bootstrap =
      async () => {
        setIsBootstrapping(
          true,
        )

        setAuthError(
          null,
        )

        try {
          const session =
            normalizeSession(
              await getCurrentAuthSession(),
            )

          if (!isActive) {
            return
          }

          userRef.current =
            session.user

          setUser(
            session.user,
          )
        } catch (error) {
          if (!isActive) {
            return
          }

          userRef.current =
            null

          setUser(
            null,
          )

          setAuthError(
            error,
          )
        } finally {
          if (isActive) {
            setIsBootstrapping(
              false,
            )
          }
        }
      }

    bootstrap()

    return () => {
      isActive =
        false

      window.removeEventListener(
        AUTH_SESSION_ESTABLISHED_EVENT,
        handleEstablishedSession,
      )

      window.removeEventListener(
        AUTH_SESSION_CLEARED_EVENT,
        handleClearedSession,
      )

      window.removeEventListener(
        API_AUTH_SESSION_INVALIDATED_EVENT,
        handleInvalidSession,
      )

      /*
      |--------------------------------------------------------------------------
      | Destroy Any Incomplete MFA Resolver
      |--------------------------------------------------------------------------
      */

      void cancelPendingMfaLogin()
    }
  }, [])

  /*
  |--------------------------------------------------------------------------
  | Login - First Factor
  |--------------------------------------------------------------------------
  */

  const login =
    useCallback(
      async ({
        email,
        password,
      }) => {
        setIsAuthenticating(
          true,
        )

        setAuthError(
          null,
        )

        setMfaChallenge(
          null,
        )

        try {
          const result =
            await loginWithEmailAndPassword({
              email,
              password,
            })

          /*
          |--------------------------------------------------------------------------
          | MFA Required
          |--------------------------------------------------------------------------
          */

          if (
            result?.mfaRequired ===
            true
          ) {
            userRef.current =
              null

            setUser(
              null,
            )

            setMfaChallenge(
              result.challenge,
            )

            return result
          }

          /*
          |--------------------------------------------------------------------------
          | Normal Successful Login
          |--------------------------------------------------------------------------
          */

          const session =
            normalizeSession(
              result,
            )

          if (
            !session.authenticated ||
            !session.user
          ) {
            throw new Error(
              'Unable to establish an authenticated session.',
            )
          }

          userRef.current =
            session.user

          setUser(
            session.user,
          )

          setMfaChallenge(
            null,
          )

          setSessionNotice(
            null,
          )

          return result
        } catch (error) {
          setAuthError(
            error,
          )

          throw error
        } finally {
          setIsAuthenticating(
            false,
          )
        }
      },
      [],
    )

  /*
  |--------------------------------------------------------------------------
  | Login - MFA Second Factor
  |--------------------------------------------------------------------------
  */

  const completeMfaLogin =
    useCallback(
      async ({
        factorUid,
        verificationCode,
      }) => {
        setIsCompletingMfa(
          true,
        )

        setAuthError(
          null,
        )

        try {
          const result =
            await completeMfaLoginService({
              factorUid,
              verificationCode,
            })

          const session =
            normalizeSession(
              result,
            )

          if (
            !session.authenticated ||
            !session.user
          ) {
            throw new Error(
              'Unable to establish an authenticated session after MFA verification.',
            )
          }

          userRef.current =
            session.user

          setUser(
            session.user,
          )

          setMfaChallenge(
            null,
          )

          setSessionNotice(
            null,
          )

          return result
        } catch (error) {
          setAuthError(
            error,
          )

          throw error
        } finally {
          setIsCompletingMfa(
            false,
          )
        }
      },
      [],
    )

  /*
  |--------------------------------------------------------------------------
  | Cancel MFA Login
  |--------------------------------------------------------------------------
  */

  const cancelMfaLogin =
    useCallback(
      async () => {
        await cancelPendingMfaLogin()

        setMfaChallenge(
          null,
        )

        setAuthError(
          null,
        )
      },
      [],
    )

  /*
  |--------------------------------------------------------------------------
  | Logout
  |--------------------------------------------------------------------------
  */

  const logout =
    useCallback(
      async () => {
        setIsLoggingOut(
          true,
        )

        setAuthError(
          null,
        )

        try {
          const result =
            await logoutCurrentSession()

          userRef.current =
            null

          setUser(
            null,
          )

          setMfaChallenge(
            null,
          )

          setSessionNotice(
            null,
          )

          return result
        } catch (error) {
          setAuthError(
            error,
          )

          throw error
        } finally {
          setIsLoggingOut(
            false,
          )
        }
      },
      [],
    )

  /*
  |--------------------------------------------------------------------------
  | Refresh Session
  |--------------------------------------------------------------------------
  */

  const refreshSession =
    useCallback(
      async () => {
        setIsRefreshing(
          true,
        )

        setAuthError(
          null,
        )

        try {
          const session =
            normalizeSession(
              await getCurrentAuthSession(),
            )

          userRef.current =
            session.user

          setUser(
            session.user,
          )

          return session
        } catch (error) {
          userRef.current =
            null

          setUser(
            null,
          )

          setMfaChallenge(
            null,
          )

          setAuthError(
            error,
          )

          throw error
        } finally {
          setIsRefreshing(
            false,
          )
        }
      },
      [],
    )

  /*
  |--------------------------------------------------------------------------
  | Switch Customer / Host Mode
  |--------------------------------------------------------------------------
  |
  | This changes only the selected application experience.
  |
  | The backend independently verifies actual access before persisting the
  | requested mode.
  |
  */

  const switchMode =
    useCallback(
      async (
        mode,
      ) => {
        setIsSwitchingMode(
          true,
        )

        setAuthError(
          null,
        )

        try {
          const result =
            await switchActiveModeService(
              mode,
            )

          if (
            !result?.user
          ) {
            throw new Error(
              'Unable to update your EPANTRY mode.',
            )
          }

          userRef.current =
            result.user

          setUser(
            result.user,
          )

          return result
        } catch (error) {
          setAuthError(
            error,
          )

          throw error
        } finally {
          setIsSwitchingMode(
            false,
          )
        }
      },
      [],
    )

  /*
  |--------------------------------------------------------------------------
  | Request Host Access
  |--------------------------------------------------------------------------
  |
  | Customer → pending Host application.
  |
  | A successful request does NOT imply Host authorization.
  |
  */

  const requestHostAccess =
    useCallback(
      async () => {
        setIsRequestingHostAccess(
          true,
        )

        setAuthError(
          null,
        )

        try {
          const result =
            await requestHostAccessService()

          if (
            !result?.user
          ) {
            throw new Error(
              'Unable to update your Host access request.',
            )
          }

          userRef.current =
            result.user

          setUser(
            result.user,
          )

          return result
        } catch (error) {
          setAuthError(
            error,
          )

          throw error
        } finally {
          setIsRequestingHostAccess(
            false,
          )
        }
      },
      [],
    )

  /*
  |--------------------------------------------------------------------------
  | Clear Session Notice
  |--------------------------------------------------------------------------
  */

  const clearSessionNotice =
    useCallback(
      () => {
        setSessionNotice(
          null,
        )
      },
      [],
    )

  /*
  |--------------------------------------------------------------------------
  | Derived Authentication State
  |--------------------------------------------------------------------------
  */

  const isAuthenticated =
    Boolean(
      user,
    )

  const isMfaRequired =
    Boolean(
      mfaChallenge,
    )

  const status =
    isBootstrapping
      ? 'bootstrapping'
      : isAuthenticated
        ? 'authenticated'
        : isMfaRequired
          ? 'mfa-required'
          : 'unauthenticated'

  /*
  |--------------------------------------------------------------------------
  | Derived Application Access State
  |--------------------------------------------------------------------------
  |
  | These values describe the current backend-provided identity state.
  |
  | They are useful for UX and routing decisions, but protected backend
  | operations must still pass server-side authorization.
  |
  */

  const currentUser =
    user

  const availableModes =
    useMemo(
      () =>
        normalizeAvailableModes(
          user,
        ),
      [
        user,
      ],
    )

  const activeMode =
    useMemo(
      () =>
        normalizeActiveMode(
          user,
          availableModes,
        ),
      [
        user,
        availableModes,
      ],
    )

  const customerEnabled =
    user?.customerEnabled ===
    true

  const hostEnabled =
    user?.hostEnabled ===
      true &&
    user?.hostAccessStatus ===
      'active'

  const hostAccessStatus =
    user?.hostAccessStatus ||
    null

  const superAdminEnabled =
    user?.superAdminEnabled ===
    true

  const canSwitchToCustomer =
    availableModes.includes(
      'customer',
    )

  const canSwitchToHost =
    availableModes.includes(
      'host',
    )

  /*
  |--------------------------------------------------------------------------
  | Context Value
  |--------------------------------------------------------------------------
  */

  const value =
    useMemo(
      () => ({
        /*
        |--------------------------------------------------------------------------
        | Identity
        |--------------------------------------------------------------------------
        */

        user,

        currentUser,

        /*
        |--------------------------------------------------------------------------
        | Authentication
        |--------------------------------------------------------------------------
        */

        status,

        isAuthenticated,

        isBootstrapping,

        isAuthenticating,

        isMfaRequired,

        mfaChallenge,

        isCompletingMfa,

        isLoggingOut,

        isRefreshing,

        authError,

        sessionNotice,

        /*
        |--------------------------------------------------------------------------
        | Application Access / Mode
        |--------------------------------------------------------------------------
        */

        customerEnabled,

        hostEnabled,

        hostAccessStatus,

        superAdminEnabled,

        availableModes,

        activeMode,

        canSwitchToCustomer,

        canSwitchToHost,

        isSwitchingMode,

        isRequestingHostAccess,

        /*
        |--------------------------------------------------------------------------
        | Actions
        |--------------------------------------------------------------------------
        */

        login,

        completeMfaLogin,

        cancelMfaLogin,

        logout,

        refreshSession,

        switchMode,

        requestHostAccess,

        clearSessionNotice,
      }),
      [
        user,
        currentUser,
        status,
        isAuthenticated,
        isBootstrapping,
        isAuthenticating,
        isMfaRequired,
        mfaChallenge,
        isCompletingMfa,
        isLoggingOut,
        isRefreshing,
        authError,
        sessionNotice,
        customerEnabled,
        hostEnabled,
        hostAccessStatus,
        superAdminEnabled,
        availableModes,
        activeMode,
        canSwitchToCustomer,
        canSwitchToHost,
        isSwitchingMode,
        isRequestingHostAccess,
        login,
        completeMfaLogin,
        cancelMfaLogin,
        logout,
        refreshSession,
        switchMode,
        requestHostAccess,
        clearSessionNotice,
      ],
    )

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  )
}

/*
|--------------------------------------------------------------------------
| useAuth
|--------------------------------------------------------------------------
*/

export function useAuth() {
  const context =
    useContext(
      AuthContext,
    )

  if (!context) {
    throw new Error(
      'useAuth must be used inside AuthProvider.',
    )
  }

  return context
}