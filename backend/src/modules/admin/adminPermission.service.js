import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  AdminAssignment,
} from './adminAssignment.model.js'

import {
  ADMIN_PERMISSION_KEYS,
  normalizeAdminPermissionKeys,
} from './adminPermission.registry.js'

import {
  AdminRole,
} from './adminRole.model.js'

/*
|--------------------------------------------------------------------------
| Admin Permission Resolution
|--------------------------------------------------------------------------
|
| EPANTRY keeps two privileged concepts intentionally separate:
|
| 1. Root Super Admin
|    - represented by the existing User.superAdminEnabled capability
|    - keeps the full Super Admin authority already defined by M02/SRS
|
| 2. Limited internal admin
|    - receives only permissions from an active AdminAssignment
|    - does NOT require or receive superAdminEnabled
|    - does NOT become a fourth top-level application access type
|    - does NOT participate in customer/host activeMode switching
|
| Seller / Brand / B2B are intentionally absent. Their business-side access
| has already been consolidated into Host.
|
*/

const ROOT_SUPER_ADMIN_ROLE_KEY =
  'root_super_admin'

/*
|--------------------------------------------------------------------------
| User ID
|--------------------------------------------------------------------------
*/

function normalizeUserId(
  user,
) {
  const userId =
    String(
      user?._id ||
        user?.id ||
        '',
    ).trim()

  if (!userId) {
    throw new ApiError(
      500,
      'Admin permission resolution requires a loaded EPANTRY user.',
      [
        {
          code:
            'ADMIN_USER_REQUIRED',
        },
      ],
    )
  }

  return userId
}

/*
|--------------------------------------------------------------------------
| Empty Authorization
|--------------------------------------------------------------------------
*/

function createEmptyAdminAuthorization(
  userId,
) {
  return {
    userId,

    isAdmin:
      false,

    isRootSuperAdmin:
      false,

    source:
      'none',

    assignmentId:
      null,

    roleKeys:
      [],

    permissionKeys:
      [],
  }
}

/*
|--------------------------------------------------------------------------
| Root Super Admin Authorization
|--------------------------------------------------------------------------
|
| Real Super Admin retains all currently deployed admin permissions.
|
| No AdminAssignment is required for root Super Admin.
|
*/

function createRootSuperAdminAuthorization(
  userId,
) {
  return {
    userId,

    isAdmin:
      true,

    isRootSuperAdmin:
      true,

    source:
      'super_admin',

    assignmentId:
      null,

    roleKeys: [
      ROOT_SUPER_ADMIN_ROLE_KEY,
    ],

    permissionKeys: [
      ...ADMIN_PERMISSION_KEYS,
    ],
  }
}

/*
|--------------------------------------------------------------------------
| Required Permission Normalization
|--------------------------------------------------------------------------
*/

function normalizeRequiredPermissions(
  permissionKeys,
) {
  return normalizeAdminPermissionKeys(
    Array.isArray(
      permissionKeys,
    )
      ? permissionKeys
      : [
          permissionKeys,
        ],
  )
}

/*
|--------------------------------------------------------------------------
| Resolve Effective Admin Permissions
|--------------------------------------------------------------------------
|
| Root Super Admin:
|
| superAdminEnabled === true
|        ↓
| all deployed admin permissions
|
| Limited internal admin:
|
| active AdminAssignment
|        ↓
| active explicit AdminRole records
|        ↓
| code-known permission keys
|
| Important:
|
| A permissionMode === "all" role is deliberately NOT honored for a limited
| internal admin.
|
| Full platform authority can only come from the existing
| superAdminEnabled=true capability.
|
*/

export async function resolveAdminAuthorization(
  user,
  {
    now =
      new Date(),
  } = {},
) {
  const userId =
    normalizeUserId(
      user,
    )

  /*
  |--------------------------------------------------------------------------
  | Root Super Admin
  |--------------------------------------------------------------------------
  */

  if (
    user?.superAdminEnabled ===
    true
  ) {
    return createRootSuperAdminAuthorization(
      userId,
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Limited Internal Admin Assignment
  |--------------------------------------------------------------------------
  */

  const assignment =
    await AdminAssignment.findOne({
      userId,

      status:
        'active',

      $or: [
        {
          expiresAt:
            null,
        },

        {
          expiresAt: {
            $gt:
              now,
          },
        },
      ],
    }).lean()

  if (!assignment) {
    return createEmptyAdminAuthorization(
      userId,
    )
  }

  const roleIds =
    Array.isArray(
      assignment.roleIds,
    )
      ? assignment.roleIds
      : []

  if (
    roleIds.length ===
    0
  ) {
    return createEmptyAdminAuthorization(
      userId,
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Active Assigned Roles
  |--------------------------------------------------------------------------
  */

  const roles =
    await AdminRole.find({
      _id: {
        $in:
          roleIds,
      },

      status:
        'active',
    }).lean()

  /*
  |--------------------------------------------------------------------------
  | Explicit Roles Only
  |--------------------------------------------------------------------------
  |
  | This is a defense-in-depth boundary.
  |
  | Even if root_super_admin were accidentally attached to an ordinary
  | AdminAssignment, permissionMode=all will not elevate that user.
  |
  */

  const explicitRoles =
    roles.filter(
      (role) =>
        role?.permissionMode ===
        'explicit',
    )

  /*
  |--------------------------------------------------------------------------
  | Effective Permission Set
  |--------------------------------------------------------------------------
  */

  const permissionKeys =
    normalizeAdminPermissionKeys(
      explicitRoles.flatMap(
        (role) =>
          Array.isArray(
            role.permissionKeys,
          )
            ? role.permissionKeys
            : [],
      ),

      {
        allowEmpty:
          true,
      },
    )

  /*
  |--------------------------------------------------------------------------
  | Effective Role Keys
  |--------------------------------------------------------------------------
  */

  const roleKeys = [
    ...new Set(
      explicitRoles
        .map(
          (role) =>
            String(
              role?.key ||
                '',
            )
              .trim()
              .toLowerCase(),
        )
        .filter(Boolean),
    ),
  ]

  return {
    userId,

    isAdmin:
      permissionKeys.length >
      0,

    isRootSuperAdmin:
      false,

    source:
      permissionKeys.length >
      0
        ? 'assignment'
        : 'none',

    assignmentId:
      permissionKeys.length >
      0
        ? String(
            assignment._id,
          )
        : null,

    roleKeys,

    permissionKeys,
  }
}

/*
|--------------------------------------------------------------------------
| Has Any Permission
|--------------------------------------------------------------------------
*/

export function adminAuthorizationHasAnyPermission(
  authorization,
  permissionKeys,
) {
  const requiredPermissions =
    normalizeRequiredPermissions(
      permissionKeys,
    )

  const grantedPermissions =
    new Set(
      authorization?.permissionKeys ||
        [],
    )

  return requiredPermissions.some(
    (permissionKey) =>
      grantedPermissions.has(
        permissionKey,
      ),
  )
}

/*
|--------------------------------------------------------------------------
| Has All Permissions
|--------------------------------------------------------------------------
*/

export function adminAuthorizationHasAllPermissions(
  authorization,
  permissionKeys,
) {
  const requiredPermissions =
    normalizeRequiredPermissions(
      permissionKeys,
    )

  const grantedPermissions =
    new Set(
      authorization?.permissionKeys ||
        [],
    )

  return requiredPermissions.every(
    (permissionKey) =>
      grantedPermissions.has(
        permissionKey,
      ),
  )
}