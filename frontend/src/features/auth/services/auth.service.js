import {
  getMultiFactorResolver,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  TotpMultiFactorGenerator,
} from 'firebase/auth'

import {
  apiClient,
} from '../../../api/apiClient'

import {
  firebaseAuth,
  firebaseAuthReady,
} from '../../../lib/firebase'

export const AUTH_SESSION_ESTABLISHED_EVENT =
  'epantry:auth-session-established'

export const AUTH_SESSION_CLEARED_EVENT =
  'epantry:auth-session-cleared'

/*
|--------------------------------------------------------------------------
| In-Memory MFA Sign-In Resolver
|--------------------------------------------------------------------------
|
| Firebase MultiFactorResolver is security-sensitive, short-lived state.
|
| It deliberately lives only inside this module and is never stored in:
|
| - localStorage
| - sessionStorage
| - React Context
| - Zustand
| - MongoDB
|
*/

let activeMfaSignIn =
  null

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function normalizeEmail(
  email,
) {
  return String(
    email ||
      '',
  )
    .trim()
    .toLowerCase()
}

function normalizeVerificationCode(
  code,
) {
  return String(
    code ||
      '',
  )
    .replace(
      /\D/g,
      '',
    )
    .trim()
}

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

function createAuthError(
  code,
  message,
) {
  const error =
    new Error(
      message,
    )

  error.code =
    code

  return error
}

async function clearTemporaryFirebaseAuth() {
  if (
    !firebaseAuth.currentUser
  ) {
    return
  }

  try {
    await signOut(
      firebaseAuth,
    )
  } catch {
    /*
    |--------------------------------------------------------------------------
    | Firebase persistence is in-memory only.
    |--------------------------------------------------------------------------
    |
    | Browser refresh also clears temporary Firebase state.
    |
    */
  }
}

/*
|--------------------------------------------------------------------------
| CSRF Challenge
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
      'Unable to initialize secure session.',
    )
  }

  return csrfToken
}

/*
|--------------------------------------------------------------------------
| Session Events
|--------------------------------------------------------------------------
*/

function publishEstablishedSession(
  session,
) {
  if (
    typeof window ===
      'undefined' ||
    session?.authenticated !==
      true ||
    !session?.user
  ) {
    return
  }

  window.dispatchEvent(
    new CustomEvent(
      AUTH_SESSION_ESTABLISHED_EVENT,

      {
        detail:
          session,
      },
    ),
  )
}

function publishClearedSession(
  reason =
    'logout',
) {
  if (
    typeof window ===
      'undefined'
  ) {
    return
  }

  window.dispatchEvent(
    new CustomEvent(
      AUTH_SESSION_CLEARED_EVENT,

      {
        detail: {
          reason,
        },
      },
    ),
  )
}

/*
|--------------------------------------------------------------------------
| Login Error Messages
|--------------------------------------------------------------------------
*/

export function getLoginErrorMessage(
  error,
) {
  switch (
    error?.code
  ) {
    case 'auth/invalid-email':
      return 'Enter a valid email address.'

    case 'auth/user-disabled':
      return 'This account is currently unavailable.'

    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email or password is incorrect.'

    case 'auth/too-many-requests':
      return 'Too many sign-in attempts. Please wait and try again.'

    case 'auth/network-request-failed':
      return 'Network connection failed. Please try again.'

    case 'auth/email-not-verified':
      return 'Email verification is required before signing in.'

    case 'auth/mfa-challenge-missing':
    case 'auth/missing-multi-factor-session':
    case 'auth/invalid-multi-factor-session':
      return 'Your MFA sign-in session has expired. Please start sign in again.'

    case 'auth/invalid-verification-code':
    case 'auth/invalid-mfa-code':
      return 'The authenticator code is incorrect. Enter the latest code and try again.'

    case 'auth/code-expired':
      return 'That authenticator code has expired. Enter the newest code from your app.'

    case 'auth/mfa-factor-not-found':
      return 'The selected authentication factor is no longer available. Please start sign in again.'

    case 'auth/unsupported-second-factor':
      return 'This account uses an MFA factor that EPANTRY does not support yet.'

    default:
      return (
        error?.message ||
        'Unable to sign in. Please try again.'
      )
  }
}

/*
|--------------------------------------------------------------------------
| Password Reset Error Messages
|--------------------------------------------------------------------------
*/

export function getPasswordResetErrorMessage(
  error,
) {
  switch (
    error?.code
  ) {
    case 'auth/invalid-email':
    case 'auth/missing-email':
      return 'Enter a valid email address.'

    case 'auth/too-many-requests':
      return 'Too many password reset attempts. Please wait and try again.'

    case 'auth/network-request-failed':
      return 'Network connection failed. Please try again.'

    default:
      return (
        error?.message ||
        'Unable to send the password reset email. Please try again.'
      )
  }
}

/*
|--------------------------------------------------------------------------
| Create HttpOnly EPANTRY Session
|--------------------------------------------------------------------------
*/

export async function createEpantrySession(
  idToken,
) {
  const csrfToken =
    await requestCsrfToken()

  const sessionResponse =
    await apiClient.post(
      '/auth/session',

      {
        idToken,
      },

      {
        headers: {
          'x-csrf-token':
            csrfToken,
        },
      },
    )

  const session =
    unwrapApiData(
      sessionResponse,
    )

  publishEstablishedSession(
    session,
  )

  return session
}

/*
|--------------------------------------------------------------------------
| Fully Authenticated Firebase User → EPANTRY Session
|--------------------------------------------------------------------------
*/

async function establishSessionFromFirebaseUser(
  firebaseUser,
) {
  if (
    firebaseUser.emailVerified !==
      true
  ) {
    throw createAuthError(
      'auth/email-not-verified',
      'Email verification is required before signing in.',
    )
  }

  const idToken =
    await firebaseUser.getIdToken(
      true,
    )

  const session =
    await createEpantrySession(
      idToken,
    )

  return {
    authenticated:
      session?.authenticated ===
      true,

    mfaRequired:
      false,

    user:
      session?.user ||
      null,

    expiresAt:
      session?.expiresAt ||
      null,
  }
}

/*
|--------------------------------------------------------------------------
| Serialize MFA Hints
|--------------------------------------------------------------------------
|
| MultiFactorResolver itself never leaves this module.
|
| React receives only the safe metadata needed to show the MFA challenge.
|
*/

function serializeMfaHints(
  resolver,
) {
  return resolver.hints.map(
    (factor) => ({
      uid:
        factor.uid,

      factorId:
        factor.factorId,

      displayName:
        factor.displayName ||
        'Authenticator',
    }),
  )
}

/*
|--------------------------------------------------------------------------
| Cancel Pending MFA Login
|--------------------------------------------------------------------------
*/

export async function cancelPendingMfaLogin() {
  activeMfaSignIn =
    null

  await clearTemporaryFirebaseAuth()
}

/*
|--------------------------------------------------------------------------
| Login - First Factor
|--------------------------------------------------------------------------
|
| NON-MFA USER
|
| Email + Password
|       ↓
| Firebase authenticated user
|       ↓
| ID token
|       ↓
| EPANTRY HttpOnly session
|
|
| MFA USER
|
| Email + Password
|       ↓
| auth/multi-factor-auth-required
|       ↓
| MultiFactorResolver
|       ↓
| Resolver kept only in module memory
|       ↓
| Safe factor metadata returned to React
|
*/

export async function loginWithEmailAndPassword({
  email,
  password,
}) {
  await firebaseAuthReady

  /*
  |--------------------------------------------------------------------------
  | Clear Any Previous MFA Attempt
  |--------------------------------------------------------------------------
  */

  await cancelPendingMfaLogin()

  const normalizedEmail =
    normalizeEmail(
      email,
    )

  try {
    /*
    |--------------------------------------------------------------------------
    | First Factor
    |--------------------------------------------------------------------------
    */

    const credential =
      await signInWithEmailAndPassword(
        firebaseAuth,
        normalizedEmail,
        password,
      )

    /*
    |--------------------------------------------------------------------------
    | User Does Not Require MFA
    |--------------------------------------------------------------------------
    */

    const result =
      await establishSessionFromFirebaseUser(
        credential.user,
      )

    await clearTemporaryFirebaseAuth()

    return result
  } catch (error) {
    /*
    |--------------------------------------------------------------------------
    | Normal Login Error
    |--------------------------------------------------------------------------
    */

    if (
      error?.code !==
      'auth/multi-factor-auth-required'
    ) {
      await clearTemporaryFirebaseAuth()

      throw error
    }

    /*
    |--------------------------------------------------------------------------
    | Password Accepted - MFA Required
    |--------------------------------------------------------------------------
    |
    | Firebase error proves the first factor succeeded.
    |
    */

    const resolver =
      getMultiFactorResolver(
        firebaseAuth,
        error,
      )

    const factors =
      serializeMfaHints(
        resolver,
      )

    /*
    |--------------------------------------------------------------------------
    | EPANTRY Currently Supports TOTP MFA
    |--------------------------------------------------------------------------
    */

    const supportedFactors =
      factors.filter(
        (factor) =>
          factor.factorId ===
          TotpMultiFactorGenerator
            .FACTOR_ID,
      )

    if (
      supportedFactors.length ===
      0
    ) {
      activeMfaSignIn =
        null

      await clearTemporaryFirebaseAuth()

      throw createAuthError(
        'auth/unsupported-second-factor',
        'No supported TOTP authentication factor is available for this account.',
      )
    }

    /*
    |--------------------------------------------------------------------------
    | Resolver Remains Private
    |--------------------------------------------------------------------------
    */

    activeMfaSignIn = {
      resolver,

      email:
        normalizedEmail,

      factors:
        supportedFactors,
    }

    return {
      authenticated:
        false,

      mfaRequired:
        true,

      user:
        null,

      challenge: {
        factors:
          supportedFactors,

        factorCount:
          supportedFactors.length,
      },
    }
  }
}

/*
|--------------------------------------------------------------------------
| Login - Second Factor
|--------------------------------------------------------------------------
*/

export async function completeMfaLogin({
  factorUid,
  verificationCode,
}) {
  const active =
    activeMfaSignIn

  if (
    !active?.resolver
  ) {
    throw createAuthError(
      'auth/mfa-challenge-missing',
      'Your MFA sign-in session is no longer available.',
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Resolve Selected Factor
  |--------------------------------------------------------------------------
  */

  const selectedFactor =
    active.factors.find(
      (factor) =>
        factor.uid ===
        factorUid,
    ) ||
    active.factors[0]

  if (!selectedFactor) {
    throw createAuthError(
      'auth/mfa-factor-not-found',
      'The selected authentication factor is not available.',
    )
  }

  if (
    selectedFactor.factorId !==
    TotpMultiFactorGenerator
      .FACTOR_ID
  ) {
    throw createAuthError(
      'auth/unsupported-second-factor',
      'This authentication factor is not supported by EPANTRY yet.',
    )
  }

  const normalizedCode =
    normalizeVerificationCode(
      verificationCode,
    )

  if (
    normalizedCode.length !==
    6
  ) {
    throw createAuthError(
      'auth/invalid-mfa-code',
      'Enter the 6-digit code from your authenticator app.',
    )
  }

  /*
  |--------------------------------------------------------------------------
  | TOTP Assertion
  |--------------------------------------------------------------------------
  */

  const assertion =
    TotpMultiFactorGenerator.assertionForSignIn(
      selectedFactor.uid,
      normalizedCode,
    )

  try {
    /*
    |--------------------------------------------------------------------------
    | Complete Firebase MFA Authentication
    |--------------------------------------------------------------------------
    */

    const credential =
      await active.resolver.resolveSignIn(
        assertion,
      )

    /*
    |--------------------------------------------------------------------------
    | MFA-complete Firebase Identity → HttpOnly Session
    |--------------------------------------------------------------------------
    */

    const result =
      await establishSessionFromFirebaseUser(
        credential.user,
      )

    activeMfaSignIn =
      null

    await clearTemporaryFirebaseAuth()

    return result
  } catch (error) {
    /*
    |--------------------------------------------------------------------------
    | Retryable Authenticator Code Error
    |--------------------------------------------------------------------------
    |
    | Resolver stays alive so user can enter another current code without
    | re-entering the password.
    |
    */

    if (
      error?.code ===
        'auth/invalid-verification-code' ||
      error?.code ===
        'auth/invalid-mfa-code' ||
      error?.code ===
        'auth/code-expired'
    ) {
      throw error
    }

    /*
    |--------------------------------------------------------------------------
    | Fatal / Expired MFA Challenge
    |--------------------------------------------------------------------------
    */

    activeMfaSignIn =
      null

    await clearTemporaryFirebaseAuth()

    throw error
  }
}

/*
|--------------------------------------------------------------------------
| Logout
|--------------------------------------------------------------------------
*/

export async function logoutCurrentSession() {
  /*
  |--------------------------------------------------------------------------
  | Also Kill Any Incomplete MFA Challenge
  |--------------------------------------------------------------------------
  */

  await cancelPendingMfaLogin()

  const csrfToken =
    await requestCsrfToken()

  const response =
    await apiClient.post(
      '/auth/logout',

      {},

      {
        headers: {
          'x-csrf-token':
            csrfToken,
        },
      },
    )

  const result =
    unwrapApiData(
      response,
    )

  await clearTemporaryFirebaseAuth()

  publishClearedSession(
    'logout',
  )

  return {
    authenticated:
      result?.authenticated ===
      true,

    signedOut:
      result?.authenticated !==
      true,
  }
}

/*
|--------------------------------------------------------------------------
| Forgot Password
|--------------------------------------------------------------------------
*/

export async function requestPasswordResetEmail(
  email,
) {
  await firebaseAuthReady

  const normalizedEmail =
    normalizeEmail(
      email,
    )

  try {
    await sendPasswordResetEmail(
      firebaseAuth,
      normalizedEmail,
    )
  } catch (error) {
    /*
    |--------------------------------------------------------------------------
    | Account Enumeration Protection
    |--------------------------------------------------------------------------
    */

    if (
      error?.code ===
      'auth/user-not-found'
    ) {
      return {
        requested:
          true,
      }
    }

    throw error
  }

  return {
    requested:
      true,
  }
}

/*
|--------------------------------------------------------------------------
| Current HttpOnly Session
|--------------------------------------------------------------------------
|
| /auth/me is authoritative for the current application identity.
|
| The returned user may contain:
|
| customerEnabled
| hostEnabled
| hostAccessStatus
| superAdminEnabled
| availableModes
| activeMode
|
| activeMode is presentation / experience state only.
|
*/

export async function getCurrentAuthSession() {
  try {
    const response =
      await apiClient.get(
        '/auth/me',
      )

    const data =
      unwrapApiData(
        response,
      )

    return {
      authenticated:
        data?.authenticated ===
        true,

      user:
        data?.user ||
        null,
    }
  } catch (error) {
    if (
      error?.status ===
      401
    ) {
      return {
        authenticated:
          false,

        user:
          null,
      }
    }

    throw error
  }
}

/*
|--------------------------------------------------------------------------
| Switch Customer / Host Experience Mode
|--------------------------------------------------------------------------
|
| activeMode is NOT an authorization credential.
|
| The backend independently verifies:
|
| - authenticated session
| - active global account
| - stored Customer / Host access
|
| before changing the persisted mode.
|
*/

export async function switchActiveMode(
  mode,
) {
  const normalizedMode =
    String(
      mode ||
        '',
    )
      .trim()
      .toLowerCase()

  if (
    normalizedMode !==
      'customer' &&
    normalizedMode !==
      'host'
  ) {
    throw createAuthError(
      'auth/invalid-active-mode',
      'Choose a valid Customer or Host mode.',
    )
  }

  const csrfToken =
    await requestCsrfToken()

  const response =
    await apiClient.patch(
      '/auth/mode',

      {
        mode:
          normalizedMode,
      },

      {
        headers: {
          'x-csrf-token':
            csrfToken,
        },
      },
    )

  const data =
    unwrapApiData(
      response,
    )

  if (
    !data?.user
  ) {
    throw createAuthError(
      'auth/invalid-mode-response',
      'Unable to update your EPANTRY mode.',
    )
  }

  return data
}

/*
|--------------------------------------------------------------------------
| Request Host Access
|--------------------------------------------------------------------------
|
| Public Customer → Host onboarding request.
|
| This endpoint does NOT grant Host authorization.
|
| Expected normal transition:
|
| customerEnabled = true
| hostEnabled = false
| hostAccessStatus = not_requested
|
|                ↓
|
| customerEnabled = true
| hostEnabled = false
| hostAccessStatus = pending
| activeMode = customer
|
| Host authorization exists only after controlled backend approval.
|
*/

export async function requestHostAccess() {
  const csrfToken =
    await requestCsrfToken()

  const response =
    await apiClient.post(
      '/auth/host/request',

      {},

      {
        headers: {
          'x-csrf-token':
            csrfToken,
        },
      },
    )

  const data =
    unwrapApiData(
      response,
    )

  if (
    !data?.user
  ) {
    throw createAuthError(
      'auth/invalid-host-request-response',
      'Unable to update your Host access request.',
    )
  }

  return data
}