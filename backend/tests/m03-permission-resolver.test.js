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
} =
  await import(
    '../src/modules/admin/adminPermission.registry.js'
  )

const {
  AdminAssignment,
} =
  await import(
    '../src/modules/admin/adminAssignment.model.js'
  )

const {
  AdminRole,
} =
  await import(
    '../src/modules/admin/adminRole.model.js'
  )

const {
  adminAuthorizationHasAllPermissions,
  adminAuthorizationHasAnyPermission,
  resolveAdminAuthorization,
} =
  await import(
    '../src/modules/admin/adminPermission.service.js'
  )

const {
  loadAdminAuthorization,
  requireAdminPermission,
} =
  await import(
    '../src/modules/admin/adminPermission.middleware.js'
  )

/*
|--------------------------------------------------------------------------
| Query Doubles
|--------------------------------------------------------------------------
*/

function createLeanResult(
  value,
) {
  return {
    lean:
      async () =>
        value,
  }
}

/*
|--------------------------------------------------------------------------
| Temporary Model Mocking
|--------------------------------------------------------------------------
*/

async function withMockedModelMethods(
  replacements,
  callback,
) {
  const originals = []

  try {
    for (
      const {
        target,
        key,
        implementation,
      }
      of replacements
    ) {
      originals.push({
        target,

        key,

        implementation:
          target[key],
      })

      target[key] =
        implementation
    }

    return await callback()
  } finally {
    for (
      const original
      of originals.reverse()
    ) {
      original.target[
        original.key
      ] =
        original
          .implementation
    }
  }
}

/*
|--------------------------------------------------------------------------
| Middleware Runner
|--------------------------------------------------------------------------
*/

function runMiddleware(
  middleware,
  req,
) {
  return new Promise(
    (resolve) => {
      middleware(
        req,

        {},

        (error) => {
          resolve(
            error ||
              null,
          )
        },
      )
    },
  )
}

/*
|--------------------------------------------------------------------------
| Root Super Admin
|--------------------------------------------------------------------------
*/

test(
  'root Super Admin keeps full deployed admin authority without an assignment',

  {
    concurrency:
      false,
  },

  async () => {
    let assignmentLookupCalled =
      false

    await withMockedModelMethods(
      [
        {
          target:
            AdminAssignment,

          key:
            'findOne',

          implementation() {
            assignmentLookupCalled =
              true

            return createLeanResult(
              null,
            )
          },
        },
      ],

      async () => {
        const authorization =
          await resolveAdminAuthorization({
            _id:
              '64b000000000000000000301',

            superAdminEnabled:
              true,
          })

        assert.equal(
          authorization.isAdmin,
          true,
        )

        assert.equal(
          authorization.isRootSuperAdmin,
          true,
        )

        assert.equal(
          authorization.source,
          'super_admin',
        )

        assert.deepEqual(
          authorization.permissionKeys,
          [
            ...ADMIN_PERMISSION_KEYS,
          ],
        )
      },
    )

    assert.equal(
      assignmentLookupCalled,
      false,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Limited Catalog Admin
|--------------------------------------------------------------------------
*/

test(
  'limited internal admin can receive Catalog permissions without becoming Super Admin',

  {
    concurrency:
      false,
  },

  async () => {
    await withMockedModelMethods(
      [
        {
          target:
            AdminAssignment,

          key:
            'findOne',

          implementation() {
            return createLeanResult({
              _id:
                '64b000000000000000000401',

              roleIds: [
                '64b000000000000000000402',
              ],
            })
          },
        },

        {
          target:
            AdminRole,

          key:
            'find',

          implementation() {
            return createLeanResult([
              {
                _id:
                  '64b000000000000000000402',

                key:
                  'catalog_admin',

                status:
                  'active',

                permissionMode:
                  'explicit',

                permissionKeys: [
                  'admin.dashboard.read',
                  'catalog.read',
                  'catalog.mutate',
                  'catalog.publish',
                ],
              },
            ])
          },
        },
      ],

      async () => {
        const authorization =
          await resolveAdminAuthorization({
            _id:
              '64b000000000000000000303',

            customerEnabled:
              true,

            superAdminEnabled:
              false,

            activeMode:
              'customer',
          })

        assert.equal(
          authorization.isAdmin,
          true,
        )

        assert.equal(
          authorization.isRootSuperAdmin,
          false,
        )

        assert.equal(
          authorization.source,
          'assignment',
        )

        assert.equal(
          adminAuthorizationHasAnyPermission(
            authorization,
            'catalog.mutate',
          ),
          true,
        )

        assert.equal(
          adminAuthorizationHasAnyPermission(
            authorization,
            'finance.mutate',
          ),
          false,
        )

        assert.equal(
          authorization.roleKeys.includes(
            'catalog_admin',
          ),
          true,
        )
      },
    )
  },
)

/*
|--------------------------------------------------------------------------
| Root-role Escalation Protection
|--------------------------------------------------------------------------
*/

test(
  'limited internal admin cannot inherit an all-permissions role from an assignment',

  {
    concurrency:
      false,
  },

  async () => {
    await withMockedModelMethods(
      [
        {
          target:
            AdminAssignment,

          key:
            'findOne',

          implementation() {
            return createLeanResult({
              _id:
                '64b000000000000000000411',

              roleIds: [
                '64b000000000000000000412',
              ],
            })
          },
        },

        {
          target:
            AdminRole,

          key:
            'find',

          implementation() {
            return createLeanResult([
              {
                _id:
                  '64b000000000000000000412',

                key:
                  'root_super_admin',

                status:
                  'active',

                permissionMode:
                  'all',

                permissionKeys:
                  [],
              },
            ])
          },
        },
      ],

      async () => {
        const authorization =
          await resolveAdminAuthorization({
            _id:
              '64b000000000000000000304',

            superAdminEnabled:
              false,
          })

        assert.equal(
          authorization.isAdmin,
          false,
        )

        assert.equal(
          authorization.isRootSuperAdmin,
          false,
        )

        assert.deepEqual(
          authorization.permissionKeys,
          [],
        )
      },
    )
  },
)

/*
|--------------------------------------------------------------------------
| Missing / Expired Assignment
|--------------------------------------------------------------------------
*/

test(
  'missing or expired internal-admin assignment resolves to no admin permissions',

  {
    concurrency:
      false,
  },

  async () => {
    await withMockedModelMethods(
      [
        {
          target:
            AdminAssignment,

          key:
            'findOne',

          implementation() {
            return createLeanResult(
              null,
            )
          },
        },
      ],

      async () => {
        const authorization =
          await resolveAdminAuthorization({
            _id:
              '64b000000000000000000305',

            superAdminEnabled:
              false,
          })

        assert.equal(
          authorization.isAdmin,
          false,
        )

        assert.equal(
          authorization.source,
          'none',
        )

        assert.deepEqual(
          authorization.permissionKeys,
          [],
        )
      },
    )
  },
)

/*
|--------------------------------------------------------------------------
| Any / All Semantics
|--------------------------------------------------------------------------
*/

test(
  'permission helpers preserve any versus all semantics',

  () => {
    const authorization = {
      permissionKeys: [
        'catalog.read',
        'catalog.mutate',
      ],
    }

    assert.equal(
      adminAuthorizationHasAnyPermission(
        authorization,
        [
          'finance.read',
          'catalog.read',
        ],
      ),
      true,
    )

    assert.equal(
      adminAuthorizationHasAllPermissions(
        authorization,
        [
          'catalog.read',
          'catalog.mutate',
        ],
      ),
      true,
    )

    assert.equal(
      adminAuthorizationHasAllPermissions(
        authorization,
        [
          'catalog.read',
          'finance.read',
        ],
      ),
      false,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Permission Denied
|--------------------------------------------------------------------------
*/

test(
  'admin permission middleware denies a permission that was not granted',

  async () => {
    const middleware =
      requireAdminPermission(
        'finance.mutate',
      )

    const error =
      await runMiddleware(
        middleware,

        {
          adminAuthorization: {
            permissionKeys: [
              'catalog.read',
              'catalog.mutate',
            ],
          },
        },
      )

    assert.ok(
      error,
    )

    assert.equal(
      error.statusCode,
      403,
    )

    assert.equal(
      error.errors[0].code,
      'ADMIN_PERMISSION_REQUIRED',
    )
  },
)

/*
|--------------------------------------------------------------------------
| Permission Allowed
|--------------------------------------------------------------------------
*/

test(
  'admin permission middleware allows an explicitly granted permission',

  async () => {
    const middleware =
      requireAdminPermission(
        'catalog.mutate',
      )

    const error =
      await runMiddleware(
        middleware,

        {
          adminAuthorization: {
            permissionKeys: [
              'catalog.read',
              'catalog.mutate',
            ],
          },
        },
      )

    assert.equal(
      error,
      null,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Request-scoped Authorization
|--------------------------------------------------------------------------
*/

test(
  'admin authorization loader stores request-scoped permission context',

  {
    concurrency:
      false,
  },

  async () => {
    await withMockedModelMethods(
      [
        {
          target:
            AdminAssignment,

          key:
            'findOne',

          implementation() {
            return createLeanResult(
              null,
            )
          },
        },
      ],

      async () => {
        const req = {
          currentUser: {
            _id:
              '64b000000000000000000306',

            superAdminEnabled:
              false,
          },
        }

        const error =
          await runMiddleware(
            loadAdminAuthorization,
            req,
          )

        assert.equal(
          error,
          null,
        )

        assert.equal(
          req.adminAuthorization.isAdmin,
          false,
        )

        assert.deepEqual(
          req.adminAuthorization.permissionKeys,
          [],
        )
      },
    )
  },
)

/*
|--------------------------------------------------------------------------
| Unknown Permission Protection
|--------------------------------------------------------------------------
*/

test(
  'unknown admin permission cannot be used to construct a permission guard',

  () => {
    assert.throws(
      () =>
        requireAdminPermission(
          'seller.manage',
        ),

      /Unknown admin permission key/,
    )
  },
)