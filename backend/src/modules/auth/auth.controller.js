import {
  env,
} from '../../config/env.js'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  ApiResponse,
} from '../../utils/ApiResponse.js'

import {
  assertSessionEligibleAccount,
  getMfaPolicyForUser,
  recordSuccessfulLogin,
  requireUserByFirebaseUid,
  serializeCurrentUser,
} from '../users/user.service.js'

import {
  createFirebaseSession,
  generateCsrfToken,
  getCsrfCookieOptions,
  getFirebaseAuthAssurance,
  getFirebaseMfaStatus,
  getSessionCookieOptions,
} from './auth.service.js'

import {
  completeRegistration,
} from './registration.service.js'

import {
  requestRegistrationEmailOtp,
  verifyRegistrationEmailOtp,
} from './registrationOtp.service.js'

/*
|--------------------------------------------------------------------------
| Cookie Clearing Helpers
|--------------------------------------------------------------------------
|
| Express clearCookie() must use the same path as the cookie being removed.
|
| EPANTRY previously used:
|
| /api/v1/auth
|
| Current CSRF scope is:
|
| /api/v1
|
| During migration both cookies may exist under the same cookie name.
|
*/

function getCookieClearOptions(
  cookieOptions,
) {
  const {
    maxAge,
    ...clearOptions
  } =
    cookieOptions

  return clearOptions
}

function clearLegacyCsrfCookie(
  res,
) {
  const currentOptions =
    getCookieClearOptions(
      getCsrfCookieOptions(),
    )

  res.clearCookie(
    env
      .authCsrfCookieName,

    {
      ...currentOptions,

      path:
        '/api/v1/auth',
    },
  )
}

function clearCurrentCsrfCookie(
  res,
) {
  res.clearCookie(
    env
      .authCsrfCookieName,

    getCookieClearOptions(
      getCsrfCookieOptions(),
    ),
  )
}

function clearAllCsrfCookies(
  res,
) {
  clearCurrentCsrfCookie(
    res,
  )

  clearLegacyCsrfCookie(
    res,
  )
}

function clearSessionCookie(
  res,
) {
  res.clearCookie(
    env
      .authSessionCookieName,

    getCookieClearOptions(
      getSessionCookieOptions(),
    ),
  )
}

/*
|--------------------------------------------------------------------------
| Registration - Request Email OTP
|--------------------------------------------------------------------------
*/

export async function requestRegistrationOtpController(
  req,
  res,
) {
  const result =
    await requestRegistrationEmailOtp(
      req.body,
    )

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,

        {
          ...result,

          requestId:
            req.requestId,
        },

        'Verification code sent',
      ),
    )
}

/*
|--------------------------------------------------------------------------
| Registration - Verify Email OTP
|--------------------------------------------------------------------------
*/

export async function verifyRegistrationEmailController(
  req,
  res,
) {
  const result =
    await verifyRegistrationEmailOtp(
      req.body,
    )

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,

        {
          ...result,

          requestId:
            req.requestId,
        },

        'Email verified successfully',
      ),
    )
}

/*
|--------------------------------------------------------------------------
| Registration - Complete Firebase + EPANTRY Account
|--------------------------------------------------------------------------
*/

export async function completeRegistrationController(
  req,
  res,
) {
  const result =
    await completeRegistration(
      req.body,
    )

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,

        {
          ...result,

          requestId:
            req.requestId,
        },

        'EPANTRY account created successfully',
      ),
    )
}

/*
|--------------------------------------------------------------------------
| CSRF Token
|--------------------------------------------------------------------------
|
| Before issuing the current /api/v1 scoped cookie, remove the old
| /api/v1/auth scoped version.
|
*/

export function csrfTokenController(
  req,
  res,
) {
  const csrfToken =
    generateCsrfToken()

  clearLegacyCsrfCookie(
    res,
  )

  res.cookie(
    env
      .authCsrfCookieName,

    csrfToken,

    getCsrfCookieOptions(),
  )

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,

        {
          csrfToken,

          requestId:
            req.requestId,
        },

        'Security token created',
      ),
    )
}

/*
|--------------------------------------------------------------------------
| Create Authenticated Session
|--------------------------------------------------------------------------
*/

export async function createSessionController(
  req,
  res,
) {
  const {
    idToken,
  } =
    req.body ||
    {}

  const session =
    await createFirebaseSession(
      idToken,
    )

  const applicationUser =
    await requireUserByFirebaseUid(
      session
        .firebaseIdentity
        .uid,
    )

  assertSessionEligibleAccount(
    applicationUser,
  )

  const lastLoginAt =
    await recordSuccessfulLogin(
      applicationUser._id,
    )

  const currentUser = {
    ...applicationUser,

    lastLoginAt,
  }

  res.cookie(
    env
      .authSessionCookieName,

    session.sessionCookie,

    getSessionCookieOptions(),
  )

  clearAllCsrfCookies(
    res,
  )

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,

        {
          authenticated:
            true,

          user:
            serializeCurrentUser(
              currentUser,
            ),

          assurance:
            session.assurance,

          expiresAt:
            session.expiresAt,

          requestId:
            req.requestId,
        },

        'Authenticated session created',
      ),
    )
}

/*
|--------------------------------------------------------------------------
| Re-authenticate Existing Session
|--------------------------------------------------------------------------
|
| Existing EPANTRY session UID and newly authenticated Firebase UID must match.
|
*/

export async function reauthenticateSessionController(
  req,
  res,
) {
  const {
    idToken,
  } =
    req.body ||
    {}

  const session =
    await createFirebaseSession(
      idToken,
    )

  if (
    session
      .firebaseIdentity
      .uid !==
    req.auth
      .firebaseUid
  ) {
    throw new ApiError(
      403,
      'Re-authentication must use the currently signed-in account.',
      [
        {
          code:
            'AUTH_IDENTITY_MISMATCH',
        },
      ],
    )
  }

  assertSessionEligibleAccount(
    req.currentUser,
  )

  res.cookie(
    env
      .authSessionCookieName,

    session.sessionCookie,

    getSessionCookieOptions(),
  )

  clearAllCsrfCookies(
    res,
  )

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,

        {
          authenticated:
            true,

          reauthenticated:
            true,

          user:
            serializeCurrentUser(
              req.currentUser,
            ),

          assurance:
            session.assurance,

          expiresAt:
            session.expiresAt,

          requestId:
            req.requestId,
        },

        'Authentication assurance refreshed',
      ),
    )
}

/*
|--------------------------------------------------------------------------
| Firebase Session Status
|--------------------------------------------------------------------------
*/

export function sessionStatusController(
  req,
  res,
) {
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,

        {
          authenticated:
            true,

          email:
            req.auth
              .email,

          emailVerified:
            req.auth
              .emailVerified,

          assurance:
            req.auth
              .assurance ||
            getFirebaseAuthAssurance(
              req.auth
                .firebaseClaims,
            ),

          requestId:
            req.requestId,
        },

        'Authenticated session is valid',
      ),
    )
}

/*
|--------------------------------------------------------------------------
| Current EPANTRY User
|--------------------------------------------------------------------------
*/

export function currentUserController(
  req,
  res,
) {
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,

        {
          authenticated:
            true,

          user:
            serializeCurrentUser(
              req.currentUser,
            ),

          requestId:
            req.requestId,
        },

        'Current user loaded',
      ),
    )
}

/*
|--------------------------------------------------------------------------
| MFA Status + Application Policy
|--------------------------------------------------------------------------
*/

export async function mfaStatusController(
  req,
  res,
) {
  const firebaseMfa =
    await getFirebaseMfaStatus(
      req.auth
        .firebaseUid,
    )

  const policy =
    getMfaPolicyForUser(
      req.currentUser,
    )

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,

        {
          mfa: {
            ...firebaseMfa,

            policy,

            enrollmentRequired:
              policy.required &&
              !firebaseMfa.enrolled,

            enrollmentRecommended:
              policy.recommended &&
              !firebaseMfa.enrolled,
          },

          requestId:
            req.requestId,
        },

        'Multi-factor authentication status loaded',
      ),
    )
}

/*
|--------------------------------------------------------------------------
| Authentication Assurance
|--------------------------------------------------------------------------
*/

export function authAssuranceController(
  req,
  res,
) {
  const assurance =
    req.auth
      .assurance ||
    getFirebaseAuthAssurance(
      req.auth
        .firebaseClaims,
    )

  const policy =
    getMfaPolicyForUser(
      req.currentUser,
    )

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,

        {
          assurance,

          policy,

          stepUp: {
            recentAuthenticationRequired:
              !assurance
                .recentlyAuthenticated,

            mfaAuthenticationRequired:
              policy.required &&
              !assurance
                .mfaAuthenticated,

            satisfiedForAccountPolicy:
              assurance
                .recentlyAuthenticated &&
              (
                !policy.required ||
                assurance
                  .mfaAuthenticated
              ),
          },

          requestId:
            req.requestId,
        },

        'Authentication assurance loaded',
      ),
    )
}

/*
|--------------------------------------------------------------------------
| Logout
|--------------------------------------------------------------------------
|
| Logout remains safe even though Firebase client auth is normally already
| cleared after session exchange.
|
*/

export function logoutController(
  req,
  res,
) {
  clearSessionCookie(
    res,
  )

  clearAllCsrfCookies(
    res,
  )

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,

        {
          authenticated:
            false,

          requestId:
            req.requestId,
        },

        'Signed out successfully',
      ),
    )
}