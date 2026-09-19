import {
  ApiResponse,
} from '../../utils/ApiResponse.js'

import {
  createAccountProfilePhotoUploadIntent,
  getAccountConsents,
  getAccountPreferences,
  getAccountProfile,
  recordAccountConsent,
  updateAccountPreferences,
  updateAccountProfile,
} from './account.service.js'

/*
|--------------------------------------------------------------------------
| GET /account/profile
|--------------------------------------------------------------------------
*/

export function getAccountProfileController(
  req,
  res,
) {
  const profile =
    getAccountProfile(
      req.currentUser,
    )

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,

        {
          profile,

          requestId:
            req.requestId,
        },

        'Account profile loaded',
      ),
    )
}

export function createAccountProfilePhotoUploadIntentController(
  req,
  res,
) {
  const uploadIntent =
    createAccountProfilePhotoUploadIntent(
      req.currentUser,
    )

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {
          uploadIntent,
          requestId:
            req.requestId,
        },
        'Profile photo upload intent created',
      ),
    )
}

/*
|--------------------------------------------------------------------------
| PATCH /account/profile
|--------------------------------------------------------------------------
*/

export async function updateAccountProfileController(
  req,
  res,
) {
  const profile =
    await updateAccountProfile({
      userId:
        req.currentUser._id,

      payload:
        req.body,
    })

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,

        {
          profile,

          requestId:
            req.requestId,
        },

        'Account profile updated',
      ),
    )
}

/*
|--------------------------------------------------------------------------
| GET /account/preferences
|--------------------------------------------------------------------------
*/

export async function getAccountPreferencesController(
  req,
  res,
) {
  const preferences =
    await getAccountPreferences(
      req.currentUser._id,
    )

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,

        {
          preferences,

          requestId:
            req.requestId,
        },

        'Account preferences loaded',
      ),
    )
}

/*
|--------------------------------------------------------------------------
| PATCH /account/preferences
|--------------------------------------------------------------------------
*/

export async function updateAccountPreferencesController(
  req,
  res,
) {
  const preferences =
    await updateAccountPreferences({
      userId:
        req.currentUser._id,

      payload:
        req.body,
    })

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,

        {
          preferences,

          requestId:
            req.requestId,
        },

        'Account preferences updated',
      ),
    )
}

/*
|--------------------------------------------------------------------------
| GET /account/consents
|--------------------------------------------------------------------------
*/

export async function getAccountConsentsController(
  req,
  res,
) {
  const consents =
    await getAccountConsents(
      req.currentUser._id,
    )

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,

        {
          consents,

          requestId:
            req.requestId,
        },

        'Consent settings loaded',
      ),
    )
}

/*
|--------------------------------------------------------------------------
| POST /account/consents
|--------------------------------------------------------------------------
*/

export async function recordAccountConsentController(
  req,
  res,
) {
  const consents =
    await recordAccountConsent({
      userId:
        req.currentUser._id,

      payload:
        req.body,

      requestId:
        req.requestId,
    })

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,

        {
          consents,

          requestId:
            req.requestId,
        },

        'Consent preference updated',
      ),
    )
}