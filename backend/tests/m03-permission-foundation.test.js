import assert from 'node:assert/strict'

import {
  test,
} from 'node:test'

/*
|--------------------------------------------------------------------------
| Test Environment
|--------------------------------------------------------------------------
*/

process.env.NODE_ENV =
  'test'

process.env.PORT =
  process.env.PORT ||
  '5001'

process.env.MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb://127.0.0.1:27017/epantry_test'

process.env.FRONTEND_URL =
  process.env.FRONTEND_URL ||
  'http://localhost:5173'

/*
|--------------------------------------------------------------------------
| Production Imports
|--------------------------------------------------------------------------
*/

const {
  ADMIN_PERMISSION_KEYS,
  isKnownAdminPermission,
  normalizeAdminPermissionKeys,
} =
  await import(
    '../src/modules/admin/adminPermission.registry.js'
  )

const {
  ADMIN_SYSTEM_ROLE_KEYS,
  ADMIN_SYSTEM_ROLE_TEMPLATES,
  AdminRole,
} =
  await import(
    '../src/modules/admin/adminRole.model.js'
  )

const {
  AdminAssignment,
} =
  await import(
    '../src/modules/admin/adminAssignment.model.js'
  )

const {
  USER_ACCESS_TYPES,
} =
  await import(
    '../src/modules/users/user.model.js'
  )

/*
|--------------------------------------------------------------------------
| Top-level Access Architecture
|--------------------------------------------------------------------------
*/

test(
  'M03 does not change the Customer Host Super Admin top-level access model',

  () => {
    assert.deepEqual(
      USER_ACCESS_TYPES,
      [
        'customer',
        'host',
        'super_admin',
      ],
    )
  },
)

/*
|--------------------------------------------------------------------------
| Permission Registry
|--------------------------------------------------------------------------
*/

test(
  'admin permission registry contains only unique known permission keys',

  () => {
    assert.equal(
      new Set(
        ADMIN_PERMISSION_KEYS,
      ).size,
      ADMIN_PERMISSION_KEYS.length,
    )

    for (
      const permissionKey
      of ADMIN_PERMISSION_KEYS
    ) {
      assert.equal(
        isKnownAdminPermission(
          permissionKey,
        ),
        true,
      )
    }
  },
)

test(
  'permission normalization rejects authority that is not deployed in the registry',

  () => {
    assert.throws(
      () =>
        normalizeAdminPermissionKeys([
          'catalog.read',
          'finance.superpower',
        ]),
      /Unknown admin permission key/,
    )
  },
)

/*
|--------------------------------------------------------------------------
| System Role Matrix
|--------------------------------------------------------------------------
*/

test(
  'system admin roles contain the SRS specialized responsibility profiles',

  () => {
    assert.deepEqual(
      ADMIN_SYSTEM_ROLE_KEYS,
      [
        'root_super_admin',
        'catalog_admin',
        'recipe_admin',
        'marketplace_ops',
        'trust_safety_admin',
        'finance_admin',
        'cms_admin',
      ],
    )
  },
)

test(
  'Catalog Admin cannot perform finance mutation',

  () => {
    const catalogRole =
      ADMIN_SYSTEM_ROLE_TEMPLATES
        .catalog_admin

    assert.equal(
      catalogRole.permissionKeys.includes(
        'catalog.mutate',
      ),
      true,
    )

    assert.equal(
      catalogRole.permissionKeys.includes(
        'finance.mutate',
      ),
      false,
    )
  },
)

test(
  'Marketplace Ops contains Host review permissions after Seller Brand B2B consolidation',

  () => {
    const marketplaceRole =
      ADMIN_SYSTEM_ROLE_TEMPLATES
        .marketplace_ops

    for (
      const permissionKey
      of [
        'host.review.read',
        'host.review.approve',
        'host.review.reject',
        'host.review.suspend',
      ]
    ) {
      assert.equal(
        marketplaceRole.permissionKeys.includes(
          permissionKey,
        ),
        true,
      )
    }
  },
)

test(
  'every explicit system role uses only registered permissions',

  () => {
    for (
      const role
      of Object.values(
        ADMIN_SYSTEM_ROLE_TEMPLATES,
      )
    ) {
      if (
        role.permissionMode ===
        'all'
      ) {
        assert.equal(
          role.key,
          'root_super_admin',
        )

        assert.deepEqual(
          role.permissionKeys,
          [],
        )

        continue
      }

      for (
        const permissionKey
        of role.permissionKeys
      ) {
        assert.equal(
          isKnownAdminPermission(
            permissionKey,
          ),
          true,
        )
      }
    }
  },
)

/*
|--------------------------------------------------------------------------
| Model Validation
|--------------------------------------------------------------------------
*/

test(
  'custom admin role cannot persist an unknown permission',

  async () => {
    const role =
      new AdminRole({
        key:
          'custom_catalog_review',

        name:
          'Custom Catalog Review',

        description:
          'Limited catalog review role.',

        permissionMode:
          'explicit',

        permissionKeys: [
          'catalog.read',
          'finance.superpower',
        ],

        isSystem:
          false,
      })

    await assert.rejects(
      role.validate(),
      /Unknown admin permission key|unknown permission/i,
    )
  },
)

test(
  'non-root admin role cannot grant all permissions',

  async () => {
    const role =
      new AdminRole({
        key:
          'custom_all_access',

        name:
          'Custom All Access',

        description:
          'This role must be rejected.',

        permissionMode:
          'all',

        permissionKeys:
          [],

        isSystem:
          false,
      })

    await assert.rejects(
      role.validate(),
      /Only the root Super Admin system role may grant all admin permissions/i,
    )
  },
)

test(
  'admin assignment supports multiple internal permission profiles for one user',

  async () => {
    const assignment =
      new AdminAssignment({
        userId:
          '64b000000000000000000101',

        roleIds: [
          '64b000000000000000000201',
          '64b000000000000000000202',
          '64b000000000000000000201',
        ],

        status:
          'active',

        scope:
          'platform',
      })

    await assignment.validate()

    assert.equal(
      assignment.roleIds.length,
      2,
    )
  },
)