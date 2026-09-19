import mongoose from 'mongoose'

import {
  ADMIN_PERMISSION_KEYS,
  normalizeAdminPermissionKeys,
} from './adminPermission.registry.js'

/*
|--------------------------------------------------------------------------
| Admin Role Model
|--------------------------------------------------------------------------
|
| These are internal privileged permission profiles only.
|
| They do NOT change EPANTRY's top-level application access model:
|
| customer
| host
| super_admin
|
| A specialized internal admin remains inside the controlled super_admin
| domain and receives only the permissions resolved from assigned roles.
|
*/

export const ADMIN_ROLE_STATUSES =
  Object.freeze([
    'active',
    'disabled',
  ])

export const ADMIN_PERMISSION_MODES =
  Object.freeze([
    'explicit',
    'all',
  ])

/*
|--------------------------------------------------------------------------
| System Role Templates
|--------------------------------------------------------------------------
|
| root_super_admin keeps the full Super Admin authority required by the SRS.
|
| Specialized roles are intentionally narrow. In particular, Catalog Admin
| receives no finance mutation permission.
|
| Marketplace Ops owns the current Host-review operational permissions because
| Seller / Brand / B2B have been consolidated into the Host access model.
|
*/

function freezeRoleTemplate({
  permissionKeys =
    [],

  ...template
}) {
  return Object.freeze({
    ...template,

    permissionKeys:
      Object.freeze([
        ...permissionKeys,
      ]),
  })
}

export const ADMIN_SYSTEM_ROLE_TEMPLATES =
  Object.freeze({
    root_super_admin:
      freezeRoleTemplate({
        key:
          'root_super_admin',

        name:
          'Super Admin',

        description:
          'Full governed EPANTRY platform administration.',

        permissionMode:
          'all',

        permissionKeys:
          [],
      }),

    catalog_admin:
      freezeRoleTemplate({
        key:
          'catalog_admin',

        name:
          'Catalog Admin',

        description:
          'Catalog governance without finance authority.',

        permissionMode:
          'explicit',

        permissionKeys: [
          'admin.dashboard.read',
          'catalog.read',
          'catalog.mutate',
          'catalog.publish',
        ],
      }),

    recipe_admin:
      freezeRoleTemplate({
        key:
          'recipe_admin',

        name:
          'Recipe Admin',

        description:
          'Recipe governance and publishing.',

        permissionMode:
          'explicit',

        permissionKeys: [
          'admin.dashboard.read',
          'recipe.read',
          'recipe.mutate',
          'recipe.publish',
        ],
      }),

    marketplace_ops:
      freezeRoleTemplate({
        key:
          'marketplace_ops',

        name:
          'Marketplace Ops',

        description:
          'Marketplace operations and Host access review.',

        permissionMode:
          'explicit',

        permissionKeys: [
          'admin.dashboard.read',
          'marketplace.read',
          'marketplace.mutate',
          'host.review.read',
          'host.review.approve',
          'host.review.reject',
          'host.review.suspend',
        ],
      }),

    trust_safety_admin:
      freezeRoleTemplate({
        key:
          'trust_safety_admin',

        name:
          'Trust & Safety',

        description:
          'Trust, safety and moderation operations.',

        permissionMode:
          'explicit',

        permissionKeys: [
          'admin.dashboard.read',
          'trust_safety.read',
          'trust_safety.mutate',
        ],
      }),

    finance_admin:
      freezeRoleTemplate({
        key:
          'finance_admin',

        name:
          'Finance Admin',

        description:
          'Finance review and controlled finance mutations.',

        permissionMode:
          'explicit',

        permissionKeys: [
          'admin.dashboard.read',
          'finance.read',
          'finance.mutate',
        ],
      }),

    cms_admin:
      freezeRoleTemplate({
        key:
          'cms_admin',

        name:
          'CMS Admin',

        description:
          'CMS content management and publishing.',

        permissionMode:
          'explicit',

        permissionKeys: [
          'admin.dashboard.read',
          'cms.read',
          'cms.mutate',
          'cms.publish',
        ],
      }),
  })

export const ADMIN_SYSTEM_ROLE_KEYS =
  Object.freeze(
    Object.keys(
      ADMIN_SYSTEM_ROLE_TEMPLATES,
    ),
  )

/*
|--------------------------------------------------------------------------
| Role Helpers
|--------------------------------------------------------------------------
*/

export function getAdminSystemRoleTemplate(
  roleKey,
) {
  const normalized =
    String(
      roleKey ||
        '',
    )
      .trim()
      .toLowerCase()

  return ADMIN_SYSTEM_ROLE_TEMPLATES[
    normalized
  ] || null
}

function samePermissionSet(
  left,
  right,
) {
  const normalizedLeft =
    normalizeAdminPermissionKeys(
      left,
      {
        allowEmpty:
          true,
      },
    )
      .sort()

  const normalizedRight =
    normalizeAdminPermissionKeys(
      right,
      {
        allowEmpty:
          true,
      },
    )
      .sort()

  if (
    normalizedLeft.length !==
    normalizedRight.length
  ) {
    return false
  }

  return normalizedLeft.every(
    (
      permissionKey,
      index,
    ) =>
      permissionKey ===
      normalizedRight[index],
  )
}

/*
|--------------------------------------------------------------------------
| Schema
|--------------------------------------------------------------------------
*/

const adminRoleSchema =
  new mongoose.Schema(
    {
      key: {
        type:
          String,

        required:
          true,

        unique:
          true,

        trim:
          true,

        lowercase:
          true,

        minlength:
          3,

        maxlength:
          64,

        match: [
          /^[a-z][a-z0-9_]*$/,
          'Admin role key must use lowercase letters, numbers and underscores.',
        ],
      },

      name: {
        type:
          String,

        required:
          true,

        trim:
          true,

        minlength:
          2,

        maxlength:
          80,
      },

      description: {
        type:
          String,

        required:
          true,

        trim:
          true,

        minlength:
          2,

        maxlength:
          280,
      },

      status: {
        type:
          String,

        enum:
          ADMIN_ROLE_STATUSES,

        required:
          true,

        default:
          'active',

        index:
          true,
      },

      permissionMode: {
        type:
          String,

        enum:
          ADMIN_PERMISSION_MODES,

        required:
          true,

        default:
          'explicit',
      },

      permissionKeys: {
        type: [
          String,
        ],

        default: [],

        validate: {
          validator(
            permissionKeys,
          ) {
            return permissionKeys.every(
              (permissionKey) =>
                ADMIN_PERMISSION_KEYS.includes(
                  permissionKey,
                ),
            )
          },

          message:
            'Admin role contains an unknown permission key.',
        },
      },

      isSystem: {
        type:
          Boolean,

        required:
          true,

        default:
          false,

        index:
          true,
      },

      createdBy: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          'User',

        default:
          null,
      },

      updatedBy: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          'User',

        default:
          null,
      },
    },

    {
      timestamps:
        true,

      collection:
        'adminRoles',

      minimize:
        false,
    },
  )

/*
|--------------------------------------------------------------------------
| Role Invariants
|--------------------------------------------------------------------------
*/

adminRoleSchema.pre(
  'validate',

  function validateAdminRole(
    next,
  ) {
    try {
      this.permissionKeys =
        normalizeAdminPermissionKeys(
          this.permissionKeys,
          {
            allowEmpty:
              this.permissionMode ===
              'all',
          },
        )

      if (
        this.permissionMode ===
          'all' &&
        this.key !==
          'root_super_admin'
      ) {
        this.invalidate(
          'permissionMode',
          'Only the root Super Admin system role may grant all admin permissions.',
        )
      }

      if (
        this.permissionMode ===
          'all' &&
        this.permissionKeys.length >
          0
      ) {
        this.invalidate(
          'permissionKeys',
          'An all-permissions role must not persist explicit permission keys.',
        )
      }

      if (
        this.isSystem
      ) {
        const template =
          getAdminSystemRoleTemplate(
            this.key,
          )

        if (!template) {
          this.invalidate(
            'key',
            'Unknown system admin role key.',
          )
        } else {
          if (
            this.permissionMode !==
            template.permissionMode
          ) {
            this.invalidate(
              'permissionMode',
              'System admin role permission mode must match the code-defined template.',
            )
          }

          if (
            !samePermissionSet(
              this.permissionKeys,
              template.permissionKeys,
            )
          ) {
            this.invalidate(
              'permissionKeys',
              'System admin role permissions must match the code-defined template.',
            )
          }
        }
      }

      next()
    } catch (error) {
      this.invalidate(
        'permissionKeys',
        error.message,
      )

      next()
    }
  },
)

/*
|--------------------------------------------------------------------------
| Indexes
|--------------------------------------------------------------------------
*/

adminRoleSchema.index({
  status:
    1,

  isSystem:
    1,

  name:
    1,
})

/*
|--------------------------------------------------------------------------
| Model
|--------------------------------------------------------------------------
*/

export const AdminRole =
  mongoose.models.AdminRole ||
  mongoose.model(
    'AdminRole',
    adminRoleSchema,
  )