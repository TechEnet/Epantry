import {
  randomBytes,
} from 'node:crypto'

import {
  env,
} from '../../config/env.js'

import {
  firebaseAdminAuth,
} from '../../config/firebaseAdmin.js'

import {
  ApiError,
} from '../../utils/ApiError.js'

/*
|--------------------------------------------------------------------------
| Session Duration
|--------------------------------------------------------------------------
*/

const MILLISECONDS_PER_DAY =
  24 *
  60 *
  60 *
  1000

export const sessionExpiresInMs =
  env.authSessionDays *
  MILLISECONDS_PER_DAY

const FIREBASE_TOTP_FACTOR_ID =
  'totp'

/*
|--------------------------------------------------------------------------
| Cookie Security
|--------------------------------------------------------------------------
*/

export function getSessionCookieOptions() {
  return {
    maxAge:
      sessionExpiresInMs,

    httpOnly:
      true,

    secure:
      env.nodeEnv ===
      'production',

    sameSite:
      'lax',

    path:
      '/',
  }
}

/*
|--------------------------------------------------------------------------
| CSRF Cookie
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| Earlier this cookie was scoped to:
|
|   /api/v1/auth
|
| That meant authenticated state-changing APIs outside /auth could not reuse
| EPANTRY's CSRF protection.
|
| It is now scoped to:
|
|   /api/v1
|
| so the same double-submit token can protect:
|
| - auth
| - households
| - profile
| - preferences
| - future authenticated mutation APIs
|
*/

export function getCsrfCookieOptions() {
  return {
    httpOnly:
      false,

    secure:
      env.nodeEnv ===
      'production',

    sameSite:
      'lax',

    path:
      '/api/v1',

    maxAge:
      10 *
      60 *
      1000,
  }
}

/*
|--------------------------------------------------------------------------
| CSRF Token
|--------------------------------------------------------------------------
*/

export function generateCsrfToken() {
  return randomBytes(
    32,
  ).toString(
    'hex',
  )
}

/*
|--------------------------------------------------------------------------
| Firebase Authentication Assurance
|--------------------------------------------------------------------------
|
| auth_time:
|   When the current Firebase authentication session originally completed.
|
| firebase.sign_in_second_factor:
|   Present when the authentication event completed with a second factor.
|
| Assurance is derived only from verified Firebase claims.
|
*/

export function getFirebaseAuthAssurance(
  decodedClaims,
) {
  const authTimeSeconds =
    Number(
      decodedClaims?.auth_time,
    )

  const nowSeconds =
    Math.floor(
      Date.now() /
        1000,
    )

  const authenticationAgeSeconds =
    Number.isFinite(
      authTimeSeconds,
    )
      ? Math.max(
          0,
          nowSeconds -
            authTimeSeconds,
        )
      : null

  const secondFactorProvider =
    typeof decodedClaims
      ?.firebase
      ?.sign_in_second_factor ===
      'string' &&
    decodedClaims
      .firebase
      .sign_in_second_factor
      .trim()
      ? decodedClaims
          .firebase
          .sign_in_second_factor
          .trim()
      : null

  return {
    authTime:
      Number.isFinite(
        authTimeSeconds,
      )
        ? new Date(
            authTimeSeconds *
              1000,
          ).toISOString()
        : null,

    authenticationAgeSeconds,

    recentAuthenticationWindowSeconds:
      env
        .authRecentSignInSeconds,

    recentlyAuthenticated:
      authenticationAgeSeconds !==
        null &&
      authenticationAgeSeconds <=
        env
          .authRecentSignInSeconds,

    mfaAuthenticated:
      Boolean(
        secondFactorProvider,
      ),

    secondFactorProvider,
  }
}

/*
|--------------------------------------------------------------------------
| Create Firebase Session
|--------------------------------------------------------------------------
*/

export async function createFirebaseSession(
  idToken,
) {
  if (
    typeof idToken !==
      'string' ||
    !idToken.trim() ||
    idToken.length >
      10000
  ) {
    throw new ApiError(
      400,
      'A valid Firebase ID token is required.',
    )
  }

  let decodedToken

  try {
    decodedToken =
      await firebaseAdminAuth.verifyIdToken(
        idToken,
        true,
      )
  } catch {
    throw new ApiError(
      401,
      'Unable to establish an authenticated session.',
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Verified Email Required
  |--------------------------------------------------------------------------
  */

  if (
    decodedToken
      .email_verified !==
    true
  ) {
    throw new ApiError(
      403,
      'Email verification is required before continuing.',
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Recent Authentication
  |--------------------------------------------------------------------------
  */

  const assurance =
    getFirebaseAuthAssurance(
      decodedToken,
    )

  if (
    !assurance
      .recentlyAuthenticated
  ) {
    throw new ApiError(
      401,
      'Recent authentication is required. Please sign in again.',
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Firebase Session Cookie
  |--------------------------------------------------------------------------
  */

  let sessionCookie

  try {
    sessionCookie =
      await firebaseAdminAuth.createSessionCookie(
        idToken,
        {
          expiresIn:
            sessionExpiresInMs,
        },
      )
  } catch {
    throw new ApiError(
      401,
      'Unable to establish an authenticated session.',
    )
  }

  return {
    sessionCookie,

    firebaseIdentity: {
      uid:
        decodedToken.uid,

      email:
        decodedToken.email ||
        null,

      emailVerified:
        decodedToken
          .email_verified ===
        true,
    },

    assurance,

    expiresAt:
      new Date(
        Date.now() +
          sessionExpiresInMs,
      ).toISOString(),
  }
}

/*
|--------------------------------------------------------------------------
| Verify Firebase Session
|--------------------------------------------------------------------------
*/

export async function verifyFirebaseSession(
  sessionCookie,
) {
  if (
    typeof sessionCookie !==
      'string' ||
    !sessionCookie
  ) {
    throw new ApiError(
      401,
      'Authentication required.',
    )
  }

  try {
    return await firebaseAdminAuth.verifySessionCookie(
      sessionCookie,
      true,
    )
  } catch {
    throw new ApiError(
      401,
      'Your session is invalid or has expired. Please sign in again.',
    )
  }
}

/*
|--------------------------------------------------------------------------
| Safe Firebase MFA Factor Serialization
|--------------------------------------------------------------------------
*/

function serializeFirebaseMfaFactor(
  factor,
) {
  return {
    uid:
      factor.uid,

    factorId:
      factor.factorId,

    displayName:
      factor.displayName ||
      null,

    enrollmentTime:
      factor.enrollmentTime ||
      null,
  }
}

/*
|--------------------------------------------------------------------------
| Firebase MFA Enrollment Status
|--------------------------------------------------------------------------
*/

export async function getFirebaseMfaStatus(
  firebaseUid,
) {
  if (
    typeof firebaseUid !==
      'string' ||
    !firebaseUid.trim()
  ) {
    throw new ApiError(
      400,
      'A valid Firebase identity is required.',
    )
  }

  let firebaseUser

  try {
    firebaseUser =
      await firebaseAdminAuth.getUser(
        firebaseUid.trim(),
      )
  } catch (error) {
    if (
      error?.code ===
      'auth/user-not-found'
    ) {
      throw new ApiError(
        401,
        'Your Firebase account is no longer available. Please sign in again.',
      )
    }

    throw new ApiError(
      503,
      'Unable to load multi-factor authentication status. Please try again.',
    )
  }

  const enrolledFactors =
    Array.isArray(
      firebaseUser
        .multiFactor
        ?.enrolledFactors,
    )
      ? firebaseUser
          .multiFactor
          .enrolledFactors
      : []

  const factors =
    enrolledFactors.map(
      serializeFirebaseMfaFactor,
    )

  const totpEnrolled =
    factors.some(
      (factor) =>
        factor.factorId ===
        FIREBASE_TOTP_FACTOR_ID,
    )

  return {
    enrolled:
      factors.length >
      0,

    totpEnrolled,

    factorCount:
      factors.length,

    factors,
  }
}