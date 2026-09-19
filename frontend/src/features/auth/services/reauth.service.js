import {
  getMultiFactorResolver,
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

import {
  AUTH_SESSION_ESTABLISHED_EVENT,
} from './auth.service'

/*
|--------------------------------------------------------------------------
| Sensitive Re-authentication State
|--------------------------------------------------------------------------
|
| Firebase MultiFactorResolver stays only in memory.
|
*/

let activeStepUpMfaSignIn =
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

function createReauthError(
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

function getBackendErrorCode(
  error,
) {
  const firstError =
    Array.isArray(
      error?.errors,
    )
      ? error.errors[0]
      : null

  return firstError?.code ||
    null
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
    */
  }
}

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
      'Unable to initialize secure verification.',
    )
  }

  return csrfToken
}

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

function serializeSupportedFactors(
  resolver,
) {
  return resolver.hints
    .filter(
      (factor) =>
        factor.factorId ===
        TotpMultiFactorGenerator
          .FACTOR_ID,
    )
    .map(
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

function resolveSelectedFactor(
  factorUid,
) {
  const factor =
    activeStepUpMfaSignIn
      ?.factors
      ?.find(
        (item) =>
          item.uid ===
          factorUid,
      ) ||
    activeStepUpMfaSignIn
      ?.factors
      ?.[0]

  if (!factor) {
    throw createReauthError(
      'auth/mfa-factor-not-found',
      'The selected authentication factor is no longer available.',
    )
  }

  return factor
}

function isRetryableTotpError(
  error,
) {
  return (
    error?.code ===
      'auth/invalid-verification-code' ||
    error?.code ===
      'auth/invalid-mfa-code' ||
    error?.code ===
      'auth/code-expired'
  )
}

/*
|--------------------------------------------------------------------------
| Error Message
|--------------------------------------------------------------------------
*/

export function getReauthenticationErrorMessage(
  error,
) {
  const backendCode =
    getBackendErrorCode(
      error,
    )

  if (
    backendCode ===
    'AUTH_IDENTITY_MISMATCH'
  ) {
    return 'Re-authentication must use the account that is currently signed in.'
  }

  switch (
    error?.code
  ) {
    case 'auth/invalid-email':
      return 'Your account email is not valid.'

    case 'auth/user-disabled':
      return 'This Firebase account is currently unavailable.'

    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'The password you entered is incorrect.'

    case 'auth/too-many-requests':
      return 'Too many security attempts. Please wait and try again.'

    case 'auth/network-request-failed':
      return 'Network connection failed. Please try again.'

    case 'auth/mfa-challenge-missing':
    case 'auth/missing-multi-factor-session':
    case 'auth/invalid-multi-factor-session':
      return 'Your security verification session expired. Start verification again.'

    case 'auth/invalid-verification-code':
    case 'auth/invalid-mfa-code':
      return 'The authenticator code is incorrect. Enter the latest code and try again.'

    case 'auth/code-expired':
      return 'That authenticator code has expired. Enter the newest code from your app.'

    case 'auth/unsupported-second-factor':
      return 'This account uses an MFA factor that EPANTRY does not support yet.'

    default:
      return (
        error?.message ||
        'Unable to verify your identity. Please try again.'
      )
  }
}

/*
|--------------------------------------------------------------------------
| Current Server-side Assurance
|--------------------------------------------------------------------------
*/

export async function getCurrentAuthAssurance() {
  const response =
    await apiClient.get(
      '/auth/assurance',
    )

  return unwrapApiData(
    response,
  )
}

/*
|--------------------------------------------------------------------------
| Refresh Existing Session
|--------------------------------------------------------------------------
*/

async function refreshReauthenticatedSession(
  firebaseUser,
) {
  if (
    firebaseUser.emailVerified !==
    true
  ) {
    throw createReauthError(
      'auth/email-not-verified',
      'Email verification is required before continuing.',
    )
  }

  const idToken =
    await firebaseUser.getIdToken(
      true,
    )

  const csrfToken =
    await requestCsrfToken()

  const response =
    await apiClient.post(
      '/auth/reauth',

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
      response,
    )

  if (
    session?.authenticated !==
      true ||
    session?.reauthenticated !==
      true ||
    !session?.user
  ) {
    throw createReauthError(
      'auth/reauthentication-failed',
      'Unable to refresh authentication assurance.',
    )
  }

  publishEstablishedSession(
    session,
  )

  return session
}

/*
|--------------------------------------------------------------------------
| Cancel Step-up
|--------------------------------------------------------------------------
*/

export async function cancelSensitiveReauthentication() {
  activeStepUpMfaSignIn =
    null

  await clearTemporaryFirebaseAuth()
}

/*
|--------------------------------------------------------------------------
| Start Sensitive Re-authentication
|--------------------------------------------------------------------------
|
| Non-MFA:
| password
| → fresh Firebase token
| → /auth/reauth
|
| MFA:
| password
| → Firebase MFA resolver
| → caller asks for TOTP
|
*/

export async function startSensitiveReauthentication({
  email,
  password,
}) {
  await firebaseAuthReady

  await cancelSensitiveReauthentication()

  const normalizedEmail =
    normalizeEmail(
      email,
    )

  try {
    const credential =
      await signInWithEmailAndPassword(
        firebaseAuth,
        normalizedEmail,
        password,
      )

    const session =
      await refreshReauthenticatedSession(
        credential.user,
      )

    await clearTemporaryFirebaseAuth()

    return {
      reauthenticated:
        true,

      mfaRequired:
        false,

      session,

      assurance:
        session.assurance ||
        null,
    }
  } catch (error) {
    if (
      error?.code !==
      'auth/multi-factor-auth-required'
    ) {
      await clearTemporaryFirebaseAuth()

      throw error
    }

    const resolver =
      getMultiFactorResolver(
        firebaseAuth,
        error,
      )

    const factors =
      serializeSupportedFactors(
        resolver,
      )

    if (
      factors.length ===
      0
    ) {
      await clearTemporaryFirebaseAuth()

      throw createReauthError(
        'auth/unsupported-second-factor',
        'No supported TOTP authentication factor is available for this account.',
      )
    }

    activeStepUpMfaSignIn = {
      resolver,
      factors,
    }

    return {
      reauthenticated:
        false,

      mfaRequired:
        true,

      challenge: {
        factors,

        factorCount:
          factors.length,
      },
    }
  }
}

/*
|--------------------------------------------------------------------------
| Complete MFA Step-up
|--------------------------------------------------------------------------
*/

export async function completeSensitiveReauthenticationMfa({
  factorUid,
  verificationCode,
}) {
  const resolver =
    activeStepUpMfaSignIn
      ?.resolver

  if (!resolver) {
    throw createReauthError(
      'auth/mfa-challenge-missing',
      'Your security verification session is no longer available.',
    )
  }

  const factor =
    resolveSelectedFactor(
      factorUid,
    )

  const normalizedCode =
    normalizeVerificationCode(
      verificationCode,
    )

  if (
    normalizedCode.length !==
    6
  ) {
    throw createReauthError(
      'auth/invalid-mfa-code',
      'Enter the 6-digit code from your authenticator app.',
    )
  }

  const assertion =
    TotpMultiFactorGenerator.assertionForSignIn(
      factor.uid,
      normalizedCode,
    )

  try {
    const credential =
      await resolver.resolveSignIn(
        assertion,
      )

    const session =
      await refreshReauthenticatedSession(
        credential.user,
      )

    activeStepUpMfaSignIn =
      null

    await clearTemporaryFirebaseAuth()

    return {
      reauthenticated:
        true,

      mfaRequired:
        false,

      session,

      assurance:
        session.assurance ||
        null,
    }
  } catch (error) {
    if (
      isRetryableTotpError(
        error,
      )
    ) {
      throw error
    }

    activeStepUpMfaSignIn =
      null

    await clearTemporaryFirebaseAuth()

    throw error
  }
}