import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  normalizeAdminPermissionKeys,
} from './adminPermission.registry.js'

import {
  adminAuthorizationHasAllPermissions,
  adminAuthorizationHasAnyPermission,
  resolveAdminAuthorization,
} from './adminPermission.service.js'

/*
|--------------------------------------------------------------------------
| Admin Authorization Loader
|--------------------------------------------------------------------------
|
| Must run after:
|
| authenticateSession
| loadCurrentUser
| requireActiveAccount
|
| The resolved authorization is request-scoped and stored on:
|
| req.adminAuthorization
|
*/

export async function loadAdminAuthorization(
  req,
  res,
  next,
) {
  try {
    if (!req.currentUser) {
      throw new ApiError(
        500,
        'Admin authorization requires a loaded EPANTRY user.',
        [
          {
            code:
              'ADMIN_USER_REQUIRED',
          },
        ],
      )
    }

    req.adminAuthorization =
      await resolveAdminAuthorization(
        req.currentUser,
      )

    return next()
  } catch (error) {
    return next(
      error,
    )
  }
}

/*
|--------------------------------------------------------------------------
| Permission Denied Error
|--------------------------------------------------------------------------
*/

function createAdminPermissionDeniedError(
  requiredPermissionKeys,
  mode,
) {
  return new ApiError(
    403,
    'You do not have permission to perform this administrative action.',
    [
      {
        code:
          'ADMIN_PERMISSION_REQUIRED',

        mode,

        requiredPermissionKeys,
      },
    ],
  )
}

/*
|--------------------------------------------------------------------------
| Resolved Authorization Requirement
|--------------------------------------------------------------------------
*/

function requireLoadedAdminAuthorization(
  req,
) {
  if (
    !req.adminAuthorization
  ) {
    throw new ApiError(
      500,
      'Admin permission middleware requires resolved admin authorization.',
      [
        {
          code:
            'ADMIN_AUTHORIZATION_REQUIRED',
        },
      ],
    )
  }

  return req.adminAuthorization
}

/*
|--------------------------------------------------------------------------
| Require Administrative Access
|--------------------------------------------------------------------------
|
| This guard deliberately does NOT check:
|
| superAdminEnabled
| activeMode
| Customer mode
| Host mode
|
| Instead it trusts the already-resolved backend admin authorization.
|
| Valid sources:
|
| real Super Admin
|        ↓
| resolveAdminAuthorization()
|        ↓
| isAdmin = true
|
| limited internal admin
|        ↓
| AdminAssignment + active AdminRole
|        ↓
| resolveAdminAuthorization()
|        ↓
| isAdmin = true
|
| ordinary Customer / Host
|        ↓
| no admin permissions
|        ↓
| isAdmin = false
|
*/

export function requireAdminAccess(
  req,
  res,
  next,
) {
  try {
    const authorization =
      requireLoadedAdminAuthorization(
        req,
      )

    if (
      authorization.isAdmin ===
      true
    ) {
      return next()
    }

    throw new ApiError(
      403,
      'Administrative access is required.',
      [
        {
          code:
            'ADMIN_ACCESS_REQUIRED',
        },
      ],
    )
  } catch (error) {
    return next(
      error,
    )
  }
}

/*
|--------------------------------------------------------------------------
| Normalize Guard Permission Keys
|--------------------------------------------------------------------------
*/

function normalizeRequiredPermissionKeys(
  permissionKeys,
) {
  return normalizeAdminPermissionKeys(
    permissionKeys.flat(),
  )
}

/*
|--------------------------------------------------------------------------
| Require Any Admin Permission
|--------------------------------------------------------------------------
|
| Example:
|
| requireAnyAdminPermission(
|   'catalog.read',
|   'recipe.read',
| )
|
*/

export function requireAnyAdminPermission(
  ...permissionKeys
) {
  const requiredPermissionKeys =
    normalizeRequiredPermissionKeys(
      permissionKeys,
    )

  return function requireAnyAdminPermissionMiddleware(
    req,
    res,
    next,
  ) {
    try {
      const authorization =
        requireLoadedAdminAuthorization(
          req,
        )

      if (
        adminAuthorizationHasAnyPermission(
          authorization,
          requiredPermissionKeys,
        )
      ) {
        return next()
      }

      return next(
        createAdminPermissionDeniedError(
          requiredPermissionKeys,
          'any',
        ),
      )
    } catch (error) {
      return next(
        error,
      )
    }
  }
}

/*
|--------------------------------------------------------------------------
| Require All Admin Permissions
|--------------------------------------------------------------------------
|
| Example:
|
| requireAllAdminPermissions(
|   'catalog.read',
|   'catalog.publish',
| )
|
*/

export function requireAllAdminPermissions(
  ...permissionKeys
) {
  const requiredPermissionKeys =
    normalizeRequiredPermissionKeys(
      permissionKeys,
    )

  return function requireAllAdminPermissionsMiddleware(
    req,
    res,
    next,
  ) {
    try {
      const authorization =
        requireLoadedAdminAuthorization(
          req,
        )

      if (
        adminAuthorizationHasAllPermissions(
          authorization,
          requiredPermissionKeys,
        )
      ) {
        return next()
      }

      return next(
        createAdminPermissionDeniedError(
          requiredPermissionKeys,
          'all',
        ),
      )
    } catch (error) {
      return next(
        error,
      )
    }
  }
}

/*
|--------------------------------------------------------------------------
| Named Single Permission Guard
|--------------------------------------------------------------------------
|
| Most admin endpoints should use this guard because explicit one-action
| permissions make authorization intent easy to audit.
|
*/

export function requireAdminPermission(
  permissionKey,
) {
  return requireAllAdminPermissions(
    permissionKey,
  )
}