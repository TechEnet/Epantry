import {
  timingSafeEqual,
} from 'node:crypto'

import {
  env,
} from '../../config/env.js'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  assertSessionEligibleAccount,
  requireUserByFirebaseUid,
} from '../users/user.service.js'

import {
  getFirebaseAuthAssurance,
  getSessionCookieOptions,
  verifyFirebaseSession,
} from './auth.service.js'

/*
|--------------------------------------------------------------------------
| CSRF Protection
|--------------------------------------------------------------------------
*/

export function requireCsrfToken(
  req,
  res,
  next,
) {
  const cookieToken =
    req.cookies?.[
      env
        .authCsrfCookieName
    ]

  const headerToken =
    req.get(
      'x-csrf-token',
    )

  if (
    !cookieToken ||
    !headerToken
  ) {
    return next(
      new ApiError(
        403,
        'Security validation failed. Please refresh and try again.',
      ),
    )
  }

  const cookieBuffer =
    Buffer.from(
      String(
        cookieToken,
      ),
    )

  const headerBuffer =
    Buffer.from(
      String(
        headerToken,
      ),
    )

  if (
    cookieBuffer.length !==
    headerBuffer.length
  ) {
    return next(
      new ApiError(
        403,
        'Security validation failed. Please refresh and try again.',
      ),
    )
  }

  if (
    !timingSafeEqual(
      cookieBuffer,
      headerBuffer,
    )
  ) {
    return next(
      new ApiError(
        403,
        'Security validation failed. Please refresh and try again.',
      ),
    )
  }

  return next()
}

/*
|--------------------------------------------------------------------------
| Firebase Authentication
|--------------------------------------------------------------------------
*/

export async function authenticateSession(
  req,
  res,
  next,
) {
  const sessionCookie =
    req.cookies?.[
      env
        .authSessionCookieName
    ]

  try {
    const decoded =
      await verifyFirebaseSession(
        sessionCookie,
      )

    req.auth = {
      firebaseUid:
        decoded.uid,

      email:
        decoded.email ||
        null,

      emailVerified:
        decoded
          .email_verified ===
        true,

      firebaseClaims:
        decoded,

      assurance:
        getFirebaseAuthAssurance(
          decoded,
        ),
    }

    return next()
  } catch (error) {
    res.clearCookie(
      env
        .authSessionCookieName,

      {
        ...getSessionCookieOptions(),

        maxAge:
          undefined,
      },
    )

    return next(
      error,
    )
  }
}

/*
|--------------------------------------------------------------------------
| Load EPANTRY Application User
|--------------------------------------------------------------------------
*/

export async function loadCurrentUser(
  req,
  res,
  next,
) {
  try {
    const user =
      await requireUserByFirebaseUid(
        req.auth
          ?.firebaseUid,
      )

    req.currentUser =
      user

    return next()
  } catch (error) {
    return next(
      error,
    )
  }
}

/*
|--------------------------------------------------------------------------
| Require Recent Authentication
|--------------------------------------------------------------------------
|
| Use AFTER authenticateSession.
|
| 428 intentionally means:
|
| Session is valid,
| but stronger/fresher authentication is required.
|
| It is NOT 401 because 401 would mean the session itself is invalid.
|
*/

export function requireRecentAuthentication(
  req,
  res,
  next,
) {
  const assurance =
    req.auth?.assurance ||
    getFirebaseAuthAssurance(
      req.auth
        ?.firebaseClaims,
    )

  if (
    assurance
      .recentlyAuthenticated
  ) {
    return next()
  }

  return next(
    new ApiError(
      428,
      'Recent authentication is required before continuing.',
      [
        {
          code:
            'AUTH_RECENT_REQUIRED',

          maxAgeSeconds:
            assurance
              .recentAuthenticationWindowSeconds,
        },
      ],
    ),
  )
}

/*
|--------------------------------------------------------------------------
| Require MFA Assurance
|--------------------------------------------------------------------------
|
| "MFA factor enrolled" and "this session authenticated with MFA"
| are two different things.
|
| This middleware requires the latter.
|
*/

export function requireMfaAssurance(
  req,
  res,
  next,
) {
  const assurance =
    req.auth?.assurance ||
    getFirebaseAuthAssurance(
      req.auth
        ?.firebaseClaims,
    )

  if (
    assurance
      .mfaAuthenticated
  ) {
    return next()
  }

  return next(
    new ApiError(
      428,
      'Multi-factor authentication is required before continuing.',
      [
        {
          code:
            'AUTH_MFA_REQUIRED',
        },
      ],
    ),
  )
}

/*
|--------------------------------------------------------------------------
| Require Recent MFA Authentication
|--------------------------------------------------------------------------
|
| Strongest reusable step-up requirement.
|
*/

export function requireRecentMfaAuthentication(
  req,
  res,
  next,
) {
  const assurance =
    req.auth?.assurance ||
    getFirebaseAuthAssurance(
      req.auth
        ?.firebaseClaims,
    )

  const failures = []

  if (
    !assurance
      .recentlyAuthenticated
  ) {
    failures.push({
      code:
        'AUTH_RECENT_REQUIRED',

      maxAgeSeconds:
        assurance
          .recentAuthenticationWindowSeconds,
    })
  }

  if (
    !assurance
      .mfaAuthenticated
  ) {
    failures.push({
      code:
        'AUTH_MFA_REQUIRED',
    })
  }

  if (
    failures.length ===
    0
  ) {
    return next()
  }

  return next(
    new ApiError(
      428,
      'Recent multi-factor authentication is required before continuing.',
      failures,
    ),
  )
}

/*
|--------------------------------------------------------------------------
| Require Active Global Account
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| This checks ONLY the global EPANTRY account state.
|
| Host onboarding lifecycle is separate:
|
| hostAccessStatus:
| - not_requested
| - pending
| - active
| - rejected
| - suspended
|
| Therefore:
|
| accountStatus = active
| hostAccessStatus = pending
|
| is completely valid and Customer access remains usable.
|
| Do NOT apply this middleware to /auth/me so the client can still inspect
| account state when appropriate.
|
*/

export function requireActiveAccount(
  req,
  res,
  next,
) {
  const user =
    req.currentUser

  if (!user) {
    return next(
      new ApiError(
        500,
        'Unable to evaluate account access.',
      ),
    )
  }

  try {
    assertSessionEligibleAccount(
      user,
    )

    return next()
  } catch (error) {
    return next(
      error,
    )
  }
}