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
  requireAdminAccess,
} =
  await import(
    '../src/modules/admin/adminPermission.middleware.js'
  )

const {
  serializeCurrentAdminAccess,
} =
  await import(
    '../src/modules/admin/adminAccess.controller.js'
  )

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
| Limited Internal Admin
|--------------------------------------------------------------------------
*/

test(
  'resolved limited internal admin passes the generic admin access gate without Super Admin capability',

  async () => {
    const error =
      await runMiddleware(
        requireAdminAccess,

        {
          currentUser: {
            customerEnabled:
              true,

            superAdminEnabled:
              false,

            activeMode:
              'customer',
          },

          adminAuthorization: {
            isAdmin:
              true,

            isRootSuperAdmin:
              false,

            source:
              'assignment',

            roleKeys: [
              'catalog_admin',
            ],

            permissionKeys: [
              'catalog.read',
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
| Ordinary Customer / Host
|--------------------------------------------------------------------------
*/

test(
  'ordinary application user cannot pass the generic admin access gate',

  async () => {
    const error =
      await runMiddleware(
        requireAdminAccess,

        {
          adminAuthorization: {
            isAdmin:
              false,

            isRootSuperAdmin:
              false,

            source:
              'none',

            roleKeys:
              [],

            permissionKeys:
              [],
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
      'ADMIN_ACCESS_REQUIRED',
    )
  },
)

/*
|--------------------------------------------------------------------------
| Safe Access Serialization
|--------------------------------------------------------------------------
*/

test(
  'admin access bootstrap exposes effective permissions without assignment or application-mode state',

  () => {
    const access =
      serializeCurrentAdminAccess({
        userId:
          '64b000000000000000004001',

        assignmentId:
          '64b000000000000000004002',

        isAdmin:
          true,

        isRootSuperAdmin:
          false,

        source:
          'assignment',

        roleKeys: [
          'marketplace_ops',
        ],

        permissionKeys: [
          'host.review.read',
          'host.review.approve',
        ],
      })

    assert.equal(
      access.isAdmin,
      true,
    )

    assert.equal(
      access.isRootSuperAdmin,
      false,
    )

    assert.deepEqual(
      access.roleKeys,
      [
        'marketplace_ops',
      ],
    )

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        access,
        'assignmentId',
      ),
      false,
    )

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        access,
        'activeMode',
      ),
      false,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Backend + Frontend Contract
|--------------------------------------------------------------------------
*/

test(
  'M03 admin access bootstrap is MFA protected and frontend service uses backend admin contracts',

  async () => {
    const backendRoutes =
      await readFile(
        new URL(
          '../src/modules/admin/admin.routes.js',
          import.meta.url,
        ),

        'utf8',
      )

    assert.match(
      backendRoutes,

      /router\.get\(\s*'\/access',\s*authenticateSession,\s*loadCurrentUser,\s*requireActiveAccount,\s*loadAdminAuthorization,\s*requireAdminAccess,\s*requireMfaAssurance,\s*getCurrentAdminAccessController,/s,
    )

    const frontendService =
      await readFile(
        new URL(
          '../../frontend/src/features/admin/services/admin.service.js',
          import.meta.url,
        ),

        'utf8',
      )

    assert.match(
      frontendService,
      /['"]\/admin\/access['"]/,
    )

    assert.match(
      frontendService,
      /['"]\/admin\/roles['"]/,
    )

    assert.match(
      frontendService,
      /['"]\/admin\/hosts['"]/,
    )

    assert.match(
      frontendService,
      /['"]\/admin\/audit['"]/,
    )

    assert.doesNotMatch(
      frontendService,
      /activeMode\s*===?\s*['"](admin|super_admin)['"]/i,
    )

    assert.doesNotMatch(
      frontendService,
      /['"]seller['"]|['"]brand['"]|['"]b2b['"]|['"]b2b_operator['"]/i,
    )
  },
)