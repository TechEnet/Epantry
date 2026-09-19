import {
  Router,
} from 'express'

import {
  authenticateSession,
  loadCurrentUser,
  requireCsrfToken,
} from '../auth/auth.middleware.js'

import {
  createAccountProfilePhotoUploadIntentController,
  getAccountConsentsController,
  getAccountPreferencesController,
  getAccountProfileController,
  recordAccountConsentController,
  updateAccountPreferencesController,
  updateAccountProfileController,
} from './account.controller.js'

const router =
  Router()

/*
|--------------------------------------------------------------------------
| Profile
|--------------------------------------------------------------------------
*/

router.get(
  '/profile',

  authenticateSession,

  loadCurrentUser,

  getAccountProfileController,
)

router.patch(
  '/profile',

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  updateAccountProfileController,
)

router.post(
  '/profile/photo-upload-intent',

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  createAccountProfilePhotoUploadIntentController,
)

/*
|--------------------------------------------------------------------------
| Preferences
|--------------------------------------------------------------------------
*/

router.get(
  '/preferences',

  authenticateSession,

  loadCurrentUser,

  getAccountPreferencesController,
)

router.patch(
  '/preferences',

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  updateAccountPreferencesController,
)

/*
|--------------------------------------------------------------------------
| Consent
|--------------------------------------------------------------------------
*/

router.get(
  '/consents',

  authenticateSession,

  loadCurrentUser,

  getAccountConsentsController,
)

router.post(
  '/consents',

  authenticateSession,

  requireCsrfToken,

  loadCurrentUser,

  recordAccountConsentController,
)

export default router