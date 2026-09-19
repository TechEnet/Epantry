import {
  z,
} from 'zod'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  ApiResponse,
} from '../../utils/ApiResponse.js'

import {
  requestHostAccess,
  serializeCurrentUser,
  switchUserActiveMode,
} from './user.service.js'

/*
|--------------------------------------------------------------------------
| Switch Mode Input
|--------------------------------------------------------------------------
*/

const switchModeSchema =
  z.object({
    mode:
      z.enum([
        'customer',
        'host',
      ]),
  })
  .strict()

/*
|--------------------------------------------------------------------------
| Switch Active Mode Controller
|--------------------------------------------------------------------------
*/

export async function switchActiveModeController(
  req,
  res,
  next,
) {
  try {
    const parsed =
      switchModeSchema.safeParse(
        req.body,
      )

    if (
      !parsed.success
    ) {
      throw new ApiError(
        400,
        parsed.error
          .issues[0]
          ?.message ||
          'Application mode must be customer or host.',
        [
          {
            code:
              'AUTH_MODE_INVALID',
          },
        ],
      )
    }

    const previousMode =
      req.currentUser
        ?.activeMode ||
      null

    const updatedUser =
      await switchUserActiveMode({
        user:
          req.currentUser,

        mode:
          parsed.data
            .mode,
      })

    const serializedUser =
      serializeCurrentUser(
        updatedUser,
      )

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,

          {
            user:
              serializedUser,

            previousMode,

            activeMode:
              serializedUser
                .activeMode,

            modeChanged:
              previousMode !==
              serializedUser
                .activeMode,

            requestId:
              req.requestId,
          },

          'Application mode updated successfully',
        ),
      )
  } catch (error) {
    return next(
      error,
    )
  }
}

/*
|--------------------------------------------------------------------------
| Request Host Access Controller
|--------------------------------------------------------------------------
|
| Customer
|     ↓
| Become a Host
|     ↓
| Host onboarding becomes pending
|
| This endpoint NEVER directly grants Host authorization.
|
*/

export async function requestHostAccessController(
  req,
  res,
  next,
) {
  try {
    const result =
      await requestHostAccess({
        user:
          req.currentUser,
      })

    const serializedUser =
      serializeCurrentUser(
        result.user,
      )

    let message =
      'Host onboarding request submitted successfully'

    if (
      result.hostRequestState ===
      'already_pending'
    ) {
      message =
        'Host onboarding is already pending'
    }

    if (
      result.hostRequestState ===
      'already_active'
    ) {
      message =
        'Host access is already active'
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,

          {
            user:
              serializedUser,

            hostRequest: {
              state:
                result
                  .hostRequestState,

              changed:
                result
                  .requestChanged,

              status:
                serializedUser
                  .hostAccessStatus,

              hostEnabled:
                serializedUser
                  .hostEnabled,
            },

            requestId:
              req.requestId,
          },

          message,
        ),
      )
  } catch (error) {
    return next(
      error,
    )
  }
}