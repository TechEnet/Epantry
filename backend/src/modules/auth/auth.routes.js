import {
  Router,
} from 'express'

import {
  authEmailOtpRateLimiter,
  authSessionRateLimiter,
} from '../../middlewares/security.middleware.js'

import {
  requestHostAccessController,
  switchActiveModeController,
} from '../users/user.controller.js'

import {
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireCsrfToken,
} from './auth.middleware.js'

import {
  authAssuranceController,
  completeRegistrationController,
  createSessionController,
  csrfTokenController,
  currentUserController,
  logoutController,
  mfaStatusController,
  reauthenticateSessionController,
  requestRegistrationOtpController,
  sessionStatusController,
  verifyRegistrationEmailController,
} from './auth.controller.js'

const router =
  Router()

/*
|--------------------------------------------------------------------------
| Registration - Request OTP
|--------------------------------------------------------------------------
*/

router.post(
  '/register/request-otp',

  authEmailOtpRateLimiter,

  requestRegistrationOtpController,
)

/*
|--------------------------------------------------------------------------
| Registration - Verify Email
|--------------------------------------------------------------------------
*/

router.post(
  '/register/verify-email',

  authEmailOtpRateLimiter,

  verifyRegistrationEmailController,
)

/*
|--------------------------------------------------------------------------
| Registration - Complete Account
|--------------------------------------------------------------------------
*/

router.post(
  '/register/complete',

  authSessionRateLimiter,

  completeRegistrationController,
)

/*
|--------------------------------------------------------------------------
| CSRF Challenge
|--------------------------------------------------------------------------
*/

router.get(
  '/csrf',

  csrfTokenController,
)

/*
|--------------------------------------------------------------------------
| Normal Login Session
|--------------------------------------------------------------------------
*/

router.post(
  '/session',

  authSessionRateLimiter,

  requireCsrfToken,

  createSessionController,
)

/*
|--------------------------------------------------------------------------
| Step-up / Re-authentication
|--------------------------------------------------------------------------
*/

router.post(
  '/reauth',

  authSessionRateLimiter,

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  reauthenticateSessionController,
)

/*
|--------------------------------------------------------------------------
| Session Status
|--------------------------------------------------------------------------
*/

router.get(
  '/session',

  authenticateSession,

  sessionStatusController,
)

/*
|--------------------------------------------------------------------------
| Current User
|--------------------------------------------------------------------------
*/

router.get(
  '/me',

  authenticateSession,

  loadCurrentUser,

  currentUserController,
)

/*
|--------------------------------------------------------------------------
| Switch Customer / Host Mode
|--------------------------------------------------------------------------
|
| Only changes UX/application mode.
|
| It does not grant access.
|
*/

router.patch(
  '/mode',

  authSessionRateLimiter,

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  requireActiveAccount,

  switchActiveModeController,
)

/*
|--------------------------------------------------------------------------
| Become A Host
|--------------------------------------------------------------------------
|
| Customer requests Host onboarding on the SAME account.
|
| Result:
|
| customerEnabled = true
| hostEnabled = false
| hostAccessStatus = pending
| activeMode = customer
|
| Host access is NOT granted by this endpoint.
|
*/

router.post(
  '/host/request',

  authSessionRateLimiter,

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  requireActiveAccount,

  requestHostAccessController,
)

/*
|--------------------------------------------------------------------------
| MFA Status
|--------------------------------------------------------------------------
*/

router.get(
  '/mfa/status',

  authenticateSession,

  loadCurrentUser,

  mfaStatusController,
)

/*
|--------------------------------------------------------------------------
| Authentication Assurance
|--------------------------------------------------------------------------
*/

router.get(
  '/assurance',

  authenticateSession,

  loadCurrentUser,

  authAssuranceController,
)

/*
|--------------------------------------------------------------------------
| Logout
|--------------------------------------------------------------------------
*/

router.post(
  '/logout',

  requireCsrfToken,

  logoutController,
)

export default router