/*
|--------------------------------------------------------------------------
| Admin Permission Definitions
|--------------------------------------------------------------------------
|
| These permissions belong to EPANTRY's privileged admin domain.
|
| They are NOT top-level application roles.
|
| Top-level application access remains exactly:
|
| customer
| host
| super_admin
|
| Seller / Brand / B2B are intentionally absent from authorization.
|
*/

function freezePermission(
  definition,
) {
  return Object.freeze({
    ...definition,
  })
}

export const ADMIN_PERMISSION_DEFINITIONS =
  Object.freeze([
    freezePermission({
      key:
        'admin.dashboard.read',

      domain:
        'admin',

      action:
        'read',

      label:
        'View admin dashboard',
    }),

    freezePermission({
      key:
        'admin.roles.read',

      domain:
        'admin',

      action:
        'read',

      label:
        'View admin roles',
    }),

    freezePermission({
      key:
        'admin.roles.manage',

      domain:
        'admin',

      action:
        'manage',

      label:
        'Manage admin roles',
    }),

    freezePermission({
      key:
        'admin.assignments.read',

      domain:
        'admin',

      action:
        'read',

      label:
        'View admin assignments',
    }),

    freezePermission({
      key:
        'admin.assignments.manage',

      domain:
        'admin',

      action:
        'manage',

      label:
        'Manage admin assignments',
    }),

    freezePermission({
      key:
        'admin.audit.read',

      domain:
        'admin',

      action:
        'read',

      label:
        'View privileged audit events',
    }),

    freezePermission({
      key:
        'host.review.read',

      domain:
        'host_review',

      action:
        'read',

      label:
        'View Host review queue',
    }),

    freezePermission({
      key:
        'host.review.approve',

      domain:
        'host_review',

      action:
        'approve',

      label:
        'Approve Host access',
    }),

    freezePermission({
      key:
        'host.review.reject',

      domain:
        'host_review',

      action:
        'reject',

      label:
        'Reject Host access',
    }),

    freezePermission({
      key:
        'host.review.suspend',

      domain:
        'host_review',

      action:
        'suspend',

      label:
        'Suspend Host access',
    }),

    freezePermission({
      key:
        'catalog.read',

      domain:
        'catalog',

      action:
        'read',

      label:
        'View governed catalog data',
    }),

    freezePermission({
      key:
        'catalog.mutate',

      domain:
        'catalog',

      action:
        'mutate',

      label:
        'Modify governed catalog data',
    }),

    freezePermission({
      key:
        'catalog.publish',

      domain:
        'catalog',

      action:
        'publish',

      label:
        'Publish governed catalog data',
    }),

    freezePermission({
      key:
        'recipe.read',

      domain:
        'recipe',

      action:
        'read',

      label:
        'View governed recipe data',
    }),

    freezePermission({
      key:
        'recipe.mutate',

      domain:
        'recipe',

      action:
        'mutate',

      label:
        'Modify governed recipe data',
    }),

    freezePermission({
      key:
        'recipe.publish',

      domain:
        'recipe',

      action:
        'publish',

      label:
        'Publish governed recipe data',
    }),

    freezePermission({
      key:
        'marketplace.read',

      domain:
        'marketplace',

      action:
        'read',

      label:
        'View marketplace operations',
    }),

    freezePermission({
      key:
        'marketplace.mutate',

      domain:
        'marketplace',

      action:
        'mutate',

      label:
        'Manage marketplace operations',
    }),

    freezePermission({
      key:
        'trust_safety.read',

      domain:
        'trust_safety',

      action:
        'read',

      label:
        'View trust and safety cases',
    }),

    freezePermission({
      key:
        'trust_safety.mutate',

      domain:
        'trust_safety',

      action:
        'mutate',

      label:
        'Manage trust and safety cases',
    }),

    freezePermission({
      key:
        'finance.read',

      domain:
        'finance',

      action:
        'read',

      label:
        'View finance operations',
    }),

    freezePermission({
      key:
        'finance.mutate',

      domain:
        'finance',

      action:
        'mutate',

      label:
        'Perform finance mutations',
    }),

    freezePermission({
      key:
        'cms.read',

      domain:
        'cms',

      action:
        'read',

      label:
        'View CMS content',
    }),

    freezePermission({
      key:
        'cms.mutate',

      domain:
        'cms',

      action:
        'mutate',

      label:
        'Modify CMS content',
    }),

    freezePermission({
      key:
        'cms.publish',

      domain:
        'cms',

      action:
        'publish',

      label:
        'Publish CMS content',
    }),
  ])

export const ADMIN_PERMISSION_KEYS =
  Object.freeze(
    ADMIN_PERMISSION_DEFINITIONS.map(
      (definition) =>
        definition.key,
    ),
  )

const ADMIN_PERMISSION_KEY_SET =
  new Set(
    ADMIN_PERMISSION_KEYS,
  )

/*
|--------------------------------------------------------------------------
| Permission Lookup
|--------------------------------------------------------------------------
*/

export function isKnownAdminPermission(
  permissionKey,
) {
  const normalized =
    String(
      permissionKey ||
        '',
    )
      .trim()
      .toLowerCase()

  return ADMIN_PERMISSION_KEY_SET.has(
    normalized,
  )
}

export function getAdminPermissionDefinition(
  permissionKey,
) {
  const normalized =
    String(
      permissionKey ||
        '',
    )
      .trim()
      .toLowerCase()

  return ADMIN_PERMISSION_DEFINITIONS.find(
    (definition) =>
      definition.key ===
      normalized,
  ) || null
}

/*
|--------------------------------------------------------------------------
| Permission Normalization
|--------------------------------------------------------------------------
|
| Role documents may only persist permission keys known by this code-level
| registry. This prevents a mutable database row from inventing new backend
| authority that no deployed policy understands.
|
*/

export function normalizeAdminPermissionKeys(
  permissionKeys,
  {
    allowEmpty =
      false,
  } = {},
) {
  if (
    !Array.isArray(
      permissionKeys,
    )
  ) {
    throw new Error(
      'Admin permissions must be provided as an array.',
    )
  }

  const normalized = [
    ...new Set(
      permissionKeys
        .map(
          (permissionKey) =>
            String(
              permissionKey ||
                '',
            )
              .trim()
              .toLowerCase(),
        )
        .filter(Boolean),
    ),
  ]

  if (
    !allowEmpty &&
    normalized.length ===
      0
  ) {
    throw new Error(
      'At least one admin permission is required.',
    )
  }

  const unknownPermissions =
    normalized.filter(
      (permissionKey) =>
        !ADMIN_PERMISSION_KEY_SET.has(
          permissionKey,
        ),
    )

  if (
    unknownPermissions.length >
    0
  ) {
    throw new Error(
      `Unknown admin permission key(s): ${unknownPermissions.join(', ')}`,
    )
  }

  return normalized
}