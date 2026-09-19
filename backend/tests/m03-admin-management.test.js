import assert from 'node:assert/strict'

import {
  readFile,
} from 'node:fs/promises'

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
  USER_ACCESS_TYPES,
} =
  await import(
    '../src/modules/users/user.model.js'
  )

const {
  ADMIN_SYSTEM_ROLE_TEMPLATES,
} =
  await import(
    '../src/modules/admin/adminRole.model.js'
  )

const {
  NON_DELEGABLE_ADMIN_PERMISSIONS,
  isAssignableAdminRoleKey,
  serializeAdminAssignment,
  serializeAdminRole,
  validateDelegatedPermissionKeys,
} =
  await import(
    '../src/modules/admin/adminManagement.service.js'
  )

/*
|--------------------------------------------------------------------------
| Top-level Architecture
|--------------------------------------------------------------------------
*/

test(
  'M03 admin management preserves Customer Host Super Admin as the only top-level access types',

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
| Delegated Permission Safety
|--------------------------------------------------------------------------
*/

test(
  'limited admin roles may receive ordinary domain permissions',

  () => {
    const permissions =
      validateDelegatedPermissionKeys([
        'catalog.read',
        'catalog.mutate',
      ])

    assert.deepEqual(
      permissions,
      [
        'catalog.read',
        'catalog.mutate',
      ],
    )
  },
)

test(
  'limited admin roles cannot receive role or assignment control-plane mutation power',

  () => {
    assert.deepEqual(
      NON_DELEGABLE_ADMIN_PERMISSIONS,
      [
        'admin.roles.manage',
        'admin.assignments.manage',
      ],
    )

    assert.throws(
      () =>
        validateDelegatedPermissionKeys([
          'catalog.read',
          'admin.assignments.manage',
        ]),

      (error) =>
        error?.statusCode ===
          400 &&
        error?.errors?.[0]?.code ===
          'ADMIN_ROLE_PERMISSION_NON_DELEGABLE',
    )
  },
)

/*
|--------------------------------------------------------------------------
| Root Super Admin Protection
|--------------------------------------------------------------------------
*/

test(
  'root Super Admin role cannot be delegated through an AdminAssignment',

  () => {
    assert.equal(
      isAssignableAdminRoleKey(
        'root_super_admin',
      ),
      false,
    )
  },
)

test(
  'specialized internal admin system roles remain assignable',

  () => {
    for (
      const roleKey
      of [
        'catalog_admin',
        'recipe_admin',
        'marketplace_ops',
        'trust_safety_admin',
        'finance_admin',
        'cms_admin',
      ]
    ) {
      assert.ok(
        ADMIN_SYSTEM_ROLE_TEMPLATES[
          roleKey
        ],
      )

      assert.equal(
        isAssignableAdminRoleKey(
          roleKey,
        ),
        true,
      )
    }
  },
)

/*
|--------------------------------------------------------------------------
| Role Serializer
|--------------------------------------------------------------------------
*/

test(
  'admin role serializer exposes permission policy without internal mongoose state',

  () => {
    const serialized =
      serializeAdminRole({
        _id:
          '64b000000000000000001001',

        key:
          'catalog_admin',

        name:
          'Catalog Admin',

        description:
          'Catalog governance.',

        status:
          'active',

        permissionMode:
          'explicit',

        permissionKeys: [
          'catalog.read',
          'catalog.mutate',
        ],

        isSystem:
          true,

        createdAt:
          null,

        updatedAt:
          null,
      })

    assert.equal(
      serialized.key,
      'catalog_admin',
    )

    assert.equal(
      serialized.isSystem,
      true,
    )

    assert.deepEqual(
      serialized.permissionKeys,
      [
        'catalog.read',
        'catalog.mutate',
      ],
    )
  },
)

/*
|--------------------------------------------------------------------------
| Assignment Does Not Change Application Mode
|--------------------------------------------------------------------------
*/

test(
  'limited admin assignment serializer preserves Customer Host access state without creating an admin activeMode',

  () => {
    const serialized =
      serializeAdminAssignment({
        user: {
          _id:
            '64b000000000000000001011',

          name:
            'Internal Operator',

          email:
            'operator@example.com',

          accountStatus:
            'active',

          customerEnabled:
            true,

          hostEnabled:
            false,

          hostAccessStatus:
            'not_requested',

          superAdminEnabled:
            false,

          activeMode:
            'customer',
        },

        assignment: {
          _id:
            '64b000000000000000001012',

          status:
            'active',

          scope:
            'platform',

          roleIds: [
            '64b000000000000000001013',
          ],

          assignedBy:
            '64b000000000000000001014',

          assignedAt:
            new Date(),

          expiresAt:
            null,

          revokedBy:
            null,

          revokedAt:
            null,
        },

        roles: [
          {
            _id:
              '64b000000000000000001013',

            key:
              'catalog_admin',

            name:
              'Catalog Admin',

            description:
              'Catalog governance.',

            status:
              'active',

            permissionMode:
              'explicit',

            permissionKeys: [
              'catalog.read',
            ],

            isSystem:
              true,
          },
        ],
      })

    assert.equal(
      serialized.user.customerEnabled,
      true,
    )

    assert.equal(
      serialized.user.superAdminEnabled,
      false,
    )

    assert.equal(
      serialized.user.activeMode,
      'customer',
    )

    assert.equal(
      serialized.roles[0].key,
      'catalog_admin',
    )
  },
)

/*
|--------------------------------------------------------------------------
| Route Contract
|--------------------------------------------------------------------------
*/

test(
  'M03 exposes role management and user-role assignment APIs under the separate admin router',

  async () => {
    const routesSource =
      await readFile(
        new URL(
          '../src/modules/admin/admin.routes.js',
          import.meta.url,
        ),

        'utf8',
      )

    assert.match(
      routesSource,
      /router\.get\(\s*'\/permissions'/s,
    )

    assert.match(
      routesSource,
      /router\.get\(\s*'\/roles'/s,
    )

    assert.match(
      routesSource,
      /router\.post\(\s*'\/roles'/s,
    )

    assert.match(
      routesSource,
      /router\.patch\(\s*'\/roles\/:roleId'/s,
    )

    assert.match(
      routesSource,
      /router\.get\(\s*'\/users\/:userId\/roles'/s,
    )

    assert.match(
      routesSource,
      /router\.patch\(\s*'\/users\/:userId\/roles'/s,
    )

    assert.match(
      routesSource,
      /requireRecentPrivilegedAccess\(\s*'super_admin'/s,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Legacy Auth Roles
|--------------------------------------------------------------------------
*/

test(
  'M03 admin management does not reintroduce legacy Seller Brand or B2B authorization values',

  async () => {
    const files =
      await Promise.all(
        [
          '../src/modules/admin/adminManagement.service.js',
          '../src/modules/admin/adminManagement.controller.js',
          '../src/modules/admin/admin.routes.js',
        ].map(
          (relativePath) =>
            readFile(
              new URL(
                relativePath,
                import.meta.url,
              ),

              'utf8',
            ),
        ),
      )

    const source =
      files.join(
        '\n',
      )

    assert.doesNotMatch(
      source,
      /['"]seller['"]|['"]brand['"]|['"]b2b['"]|['"]b2b_operator['"]/i,
    )

    assert.doesNotMatch(
      source,
      /activeMode\s*[:=]\s*['"](admin|super_admin)['"]/i,
    )
  },
)