import assert from 'node:assert/strict'

import {
  readFile,
} from 'node:fs/promises'

import {
  dirname,
  resolve,
} from 'node:path'

import {
  fileURLToPath,
} from 'node:url'

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
  ADMIN_HOST_FILTER_STATUSES,
  approveAdminHost,
  approveAdminHostWithAudit,
  getAdminHost,
  listAdminHosts,
  rejectAdminHost,
  serializeAdminHostUser,
  suspendAdminHost,
} =
  await import(
    '../src/modules/admin/admin.service.js'
  )

const {
  AdminAuditEvent,
} =
  await import(
    '../src/modules/admin/adminAudit.model.js'
  )

const {
  User,
} =
  await import(
    '../src/modules/users/user.model.js'
  )

/*
|--------------------------------------------------------------------------
| Project Paths
|--------------------------------------------------------------------------
*/

const currentFile =
  fileURLToPath(
    import.meta.url,
  )

const testsDirectory =
  dirname(
    currentFile,
  )

const backendRoot =
  resolve(
    testsDirectory,
    '..',
  )

/*
|--------------------------------------------------------------------------
| Fixtures
|--------------------------------------------------------------------------
*/

const HOST_USER_ID =
  '64b000000000000000000011'

const ADMIN_USER_ID =
  '64b000000000000000000012'

function createHostUser(
  overrides =
    {},
) {
  return {
    _id:
      HOST_USER_ID,

    name:
      'Test Host',

    email:
      'host@example.com',

    phone:
      '+919876543210',

    emailVerified:
      true,

    phoneVerified:
      false,

    accountStatus:
      'active',

    customerEnabled:
      true,

    hostEnabled:
      false,

    hostAccessStatus:
      'pending',

    superAdminEnabled:
      false,

    activeMode:
      'customer',

    createdAt:
      new Date(
        '2026-08-01T00:00:00.000Z',
      ),

    updatedAt:
      new Date(
        '2026-08-01T00:00:00.000Z',
      ),

    ...overrides,
  }
}

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

function createFindQuery(
  value,
) {
  return {
    sort() {
      return this
    },

    skip() {
      return this
    },

    limit() {
      return this
    },

    async lean() {
      return value
    },
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
| API Error Assertion
|--------------------------------------------------------------------------
*/

function assertApiError(
  error,
  {
    statusCode,
    code,
  },
) {
  assert.ok(
    error,
    'Expected operation to reject.',
  )

  assert.equal(
    error.statusCode,
    statusCode,
  )

  if (code) {
    assert.ok(
      Array.isArray(
        error.errors,
      ),
    )

    assert.ok(
      error.errors.some(
        (item) =>
          item?.code ===
          code,
      ),

      `Expected error code ${code}.`,
    )
  }

  return true
}

/*
|--------------------------------------------------------------------------
| Serializer
|--------------------------------------------------------------------------
*/

test(
  'admin Host serializer exposes access state without authentication secrets',

  () => {
    const host =
      serializeAdminHostUser(
        createHostUser(),
      )

    assert.equal(
      host.id,
      HOST_USER_ID,
    )

    assert.equal(
      host.customerEnabled,
      true,
    )

    assert.equal(
      host.hostEnabled,
      false,
    )

    assert.equal(
      host.hostAccessStatus,
      'pending',
    )

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        host,
        'firebaseUid',
      ),
      false,
    )

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        host,
        'roles',
      ),
      false,
    )

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        host,
        'accountType',
      ),
      false,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Host Queue
|--------------------------------------------------------------------------
*/

test(
  'Admin Host queue supports only Host lifecycle statuses',

  () => {
    assert.deepEqual(
      ADMIN_HOST_FILTER_STATUSES,
      [
        'pending',
        'active',
        'rejected',
        'suspended',
      ],
    )
  },
)

test(
  'pending Host queue uses pending status by default',

  {
    concurrency:
      false,
  },

  async () => {
    let capturedFilter =
      null

    await withMockedModelMethods(
      [
        {
          target:
            User,

          key:
            'find',

          implementation(
            filter,
          ) {
            capturedFilter =
              filter

            return createFindQuery([
              createHostUser(),
            ])
          },
        },

        {
          target:
            User,

          key:
            'countDocuments',

          implementation:
            async () =>
              1,
        },
      ],

      async () => {
        const result =
          await listAdminHosts()

        assert.equal(
          result.hosts.length,
          1,
        )

        assert.equal(
          result.hosts[0]
            .hostAccessStatus,
          'pending',
        )

        assert.equal(
          result.pagination
            .total,
          1,
        )
      },
    )

    assert.equal(
      capturedFilter
        .hostAccessStatus,
      'pending',
    )
  },
)

test(
  'Admin Host queue all filter excludes Customer-only not_requested users',

  {
    concurrency:
      false,
  },

  async () => {
    let capturedFilter =
      null

    await withMockedModelMethods(
      [
        {
          target:
            User,

          key:
            'find',

          implementation(
            filter,
          ) {
            capturedFilter =
              filter

            return createFindQuery(
              [],
            )
          },
        },

        {
          target:
            User,

          key:
            'countDocuments',

          implementation:
            async () =>
              0,
        },
      ],

      async () => {
        const result =
          await listAdminHosts({
            status:
              'all',
          })

        assert.deepEqual(
          result.hosts,
          [],
        )
      },
    )

    assert.deepEqual(
      capturedFilter
        .hostAccessStatus,
      {
        $in: [
          'pending',
          'active',
          'rejected',
          'suspended',
        ],
      },
    )
  },
)

test(
  'invalid Admin Host queue status is rejected',

  async () => {
    await assert.rejects(
      async () =>
        listAdminHosts({
          status:
            'seller',
        }),

      (error) =>
        assertApiError(
          error,
          {
            statusCode:
              400,

            code:
              'ADMIN_HOST_STATUS_INVALID',
          },
        ),
    )
  },
)

/*
|--------------------------------------------------------------------------
| Host Details
|--------------------------------------------------------------------------
*/

test(
  'Admin can load a Host application by user ID',

  {
    concurrency:
      false,
  },

  async () => {
    await withMockedModelMethods(
      [
        {
          target:
            User,

          key:
            'findOne',

          implementation() {
            return createLeanResult(
              createHostUser(),
            )
          },
        },
      ],

      async () => {
        const result =
          await getAdminHost(
            HOST_USER_ID,
          )

        assert.equal(
          result.id,
          HOST_USER_ID,
        )

        assert.equal(
          result.hostAccessStatus,
          'pending',
        )
      },
    )
  },
)

test(
  'invalid Host user ID is rejected before database access',

  async () => {
    await assert.rejects(
      async () =>
        getAdminHost(
          'invalid-user-id',
        ),

      (error) =>
        assertApiError(
          error,
          {
            statusCode:
              400,

            code:
              'ADMIN_HOST_USER_ID_INVALID',
          },
        ),
    )
  },
)

test(
  'Customer-only user is not exposed through Host management',

  {
    concurrency:
      false,
  },

  async () => {
    await withMockedModelMethods(
      [
        {
          target:
            User,

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
        await assert.rejects(
          async () =>
            getAdminHost(
              HOST_USER_ID,
            ),

          (error) =>
            assertApiError(
              error,
              {
                statusCode:
                  404,

                code:
                  'ADMIN_HOST_NOT_FOUND',
              },
            ),
        )
      },
    )
  },
)

/*
|--------------------------------------------------------------------------
| Approve Pending Host
|--------------------------------------------------------------------------
*/

test(
  'Super Admin lifecycle approval enables Host and retains Customer access',

  {
    concurrency:
      false,
  },

  async () => {
    const activeHost =
      createHostUser({
        hostEnabled:
          true,

        hostAccessStatus:
          'active',
      })

    let mutationUpdate =
      null

    await withMockedModelMethods(
      [
        {
          target:
            User,

          key:
            'findOne',

          implementation() {
            return createLeanResult(
              createHostUser(),
            )
          },
        },

        {
          target:
            User,

          key:
            'findOneAndUpdate',

          implementation(
            filter,
            update,
          ) {
            mutationUpdate =
              update

            return createLeanResult(
              activeHost,
            )
          },
        },
      ],

      async () => {
        const result =
          await approveAdminHost(
            HOST_USER_ID,
          )

        assert.equal(
          result.customerEnabled,
          true,
        )

        assert.equal(
          result.hostEnabled,
          true,
        )

        assert.equal(
          result.hostAccessStatus,
          'active',
        )

        assert.equal(
          result.activeMode,
          'customer',
        )
      },
    )

    assert.equal(
      mutationUpdate
        .$set
        .customerEnabled,
      true,
    )

    assert.equal(
      mutationUpdate
        .$set
        .hostEnabled,
      true,
    )

    assert.equal(
      mutationUpdate
        .$set
        .hostAccessStatus,
      'active',
    )
  },
)

test(
  'active Host cannot be approved again',

  {
    concurrency:
      false,
  },

  async () => {
    await withMockedModelMethods(
      [
        {
          target:
            User,

          key:
            'findOne',

          implementation() {
            return createLeanResult(
              createHostUser({
                hostEnabled:
                  true,

                hostAccessStatus:
                  'active',
              }),
            )
          },
        },
      ],

      async () => {
        await assert.rejects(
          async () =>
            approveAdminHost(
              HOST_USER_ID,
            ),

          (error) =>
            assertApiError(
              error,
              {
                statusCode:
                  409,

                code:
                  'ADMIN_HOST_APPROVAL_STATE_INVALID',
              },
            ),
        )
      },
    )
  },
)

/*
|--------------------------------------------------------------------------
| Reject Pending Host
|--------------------------------------------------------------------------
*/

test(
  'Host rejection preserves Customer access',

  {
    concurrency:
      false,
  },

  async () => {
    const rejectedHost =
      createHostUser({
        hostEnabled:
          false,

        hostAccessStatus:
          'rejected',

        activeMode:
          'customer',
      })

    let mutationUpdate =
      null

    await withMockedModelMethods(
      [
        {
          target:
            User,

          key:
            'findOne',

          implementation() {
            return createLeanResult(
              createHostUser(),
            )
          },
        },

        {
          target:
            User,

          key:
            'findOneAndUpdate',

          implementation(
            filter,
            update,
          ) {
            mutationUpdate =
              update

            return createLeanResult(
              rejectedHost,
            )
          },
        },
      ],

      async () => {
        const result =
          await rejectAdminHost(
            HOST_USER_ID,
          )

        assert.equal(
          result.customerEnabled,
          true,
        )

        assert.equal(
          result.hostEnabled,
          false,
        )

        assert.equal(
          result.hostAccessStatus,
          'rejected',
        )

        assert.equal(
          result.activeMode,
          'customer',
        )
      },
    )

    assert.equal(
      mutationUpdate
        .$set
        .hostEnabled,
      false,
    )

    assert.equal(
      mutationUpdate
        .$set
        .hostAccessStatus,
      'rejected',
    )

    assert.equal(
      mutationUpdate
        .$set
        .activeMode,
      'customer',
    )
  },
)

test(
  'active Host cannot be rejected as if still pending',

  {
    concurrency:
      false,
  },

  async () => {
    await withMockedModelMethods(
      [
        {
          target:
            User,

          key:
            'findOne',

          implementation() {
            return createLeanResult(
              createHostUser({
                hostEnabled:
                  true,

                hostAccessStatus:
                  'active',
              }),
            )
          },
        },
      ],

      async () => {
        await assert.rejects(
          async () =>
            rejectAdminHost(
              HOST_USER_ID,
            ),

          (error) =>
            assertApiError(
              error,
              {
                statusCode:
                  409,

                code:
                  'ADMIN_HOST_REJECTION_STATE_INVALID',
              },
            ),
        )
      },
    )
  },
)

/*
|--------------------------------------------------------------------------
| Suspend Active Host
|--------------------------------------------------------------------------
*/

test(
  'Host suspension removes Host access and safely returns mode to Customer',

  {
    concurrency:
      false,
  },

  async () => {
    const activeHost =
      createHostUser({
        hostEnabled:
          true,

        hostAccessStatus:
          'active',

        activeMode:
          'host',
      })

    const suspendedHost =
      createHostUser({
        hostEnabled:
          false,

        hostAccessStatus:
          'suspended',

        activeMode:
          'customer',
      })

    let mutationUpdate =
      null

    await withMockedModelMethods(
      [
        {
          target:
            User,

          key:
            'findOne',

          implementation() {
            return createLeanResult(
              activeHost,
            )
          },
        },

        {
          target:
            User,

          key:
            'findOneAndUpdate',

          implementation(
            filter,
            update,
          ) {
            mutationUpdate =
              update

            return createLeanResult(
              suspendedHost,
            )
          },
        },
      ],

      async () => {
        const result =
          await suspendAdminHost(
            HOST_USER_ID,
          )

        assert.equal(
          result.customerEnabled,
          true,
        )

        assert.equal(
          result.hostEnabled,
          false,
        )

        assert.equal(
          result.hostAccessStatus,
          'suspended',
        )

        assert.equal(
          result.activeMode,
          'customer',
        )
      },
    )

    assert.equal(
      mutationUpdate
        .$set
        .hostEnabled,
      false,
    )

    assert.equal(
      mutationUpdate
        .$set
        .hostAccessStatus,
      'suspended',
    )

    assert.equal(
      mutationUpdate
        .$set
        .activeMode,
      'customer',
    )
  },
)

test(
  'pending Host cannot be suspended as an active Host',

  {
    concurrency:
      false,
  },

  async () => {
    await withMockedModelMethods(
      [
        {
          target:
            User,

          key:
            'findOne',

          implementation() {
            return createLeanResult(
              createHostUser(),
            )
          },
        },
      ],

      async () => {
        await assert.rejects(
          async () =>
            suspendAdminHost(
              HOST_USER_ID,
            ),

          (error) =>
            assertApiError(
              error,
              {
                statusCode:
                  409,

                code:
                  'ADMIN_HOST_SUSPENSION_STATE_INVALID',
              },
            ),
        )
      },
    )
  },
)

/*
|--------------------------------------------------------------------------
| Audit Reason Fail-closed
|--------------------------------------------------------------------------
*/

test(
  'audited Host approval rejects an invalid action reason before lifecycle mutation',

  {
    concurrency:
      false,
  },

  async () => {
    let databaseTouched =
      false

    await withMockedModelMethods(
      [
        {
          target:
            User,

          key:
            'findOne',

          implementation() {
            databaseTouched =
              true

            return createLeanResult(
              createHostUser(),
            )
          },
        },
      ],

      async () => {
        await assert.rejects(
          async () =>
            approveAdminHostWithAudit({
              userId:
                HOST_USER_ID,

              actorUser: {
                _id:
                  ADMIN_USER_ID,
              },

              adminAuthorization: {
                source:
                  'assignment',

                isRootSuperAdmin:
                  false,

                roleKeys: [
                  'marketplace_ops',
                ],

                permissionKeys: [
                  'host.review.read',
                  'host.review.approve',
                ],
              },

              reasonCode:
                'host_review.rejected',

              requestId:
                'audit-reason-test',
            }),

          (error) =>
            assertApiError(
              error,
              {
                statusCode:
                  400,

                code:
                  'ADMIN_REASON_ACTION_MISMATCH',
              },
            ),
        )
      },
    )

    assert.equal(
      databaseTouched,
      false,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Audited Approval
|--------------------------------------------------------------------------
*/

test(
  'audited Host approval records delegated actor permission and before after state',

  {
    concurrency:
      false,
  },

  async () => {
    const pendingHost =
      createHostUser()

    const activeHost =
      createHostUser({
        hostEnabled:
          true,

        hostAccessStatus:
          'active',

        activeMode:
          'customer',
      })

    let auditPayload =
      null

    await withMockedModelMethods(
      [
        {
          target:
            User,

          key:
            'findOne',

          implementation() {
            return createLeanResult(
              pendingHost,
            )
          },
        },

        {
          target:
            User,

          key:
            'findOneAndUpdate',

          implementation() {
            return createLeanResult(
              activeHost,
            )
          },
        },

        {
          target:
            AdminAuditEvent,

          key:
            'create',

          implementation:
            async (
              payload,
            ) => {
              auditPayload =
                payload

              return {
                _id:
                  '64b000000000000000000099',

                ...payload,
              }
            },
        },
      ],

      async () => {
        const result =
          await approveAdminHostWithAudit({
            userId:
              HOST_USER_ID,

            actorUser: {
              _id:
                ADMIN_USER_ID,

              customerEnabled:
                true,

              superAdminEnabled:
                false,

              activeMode:
                'customer',
            },

            adminAuthorization: {
              source:
                'assignment',

              isRootSuperAdmin:
                false,

              roleKeys: [
                'marketplace_ops',
              ],

              permissionKeys: [
                'host.review.read',
                'host.review.approve',
              ],
            },

            reasonCode:
              'host_review.approved',

            reasonDetails:
              'Application review completed.',

            requestId:
              'host-approve-request',
          })

        assert.equal(
          result.hostAccessStatus,
          'active',
        )
      },
    )

    assert.ok(
      auditPayload,
    )

    assert.equal(
      auditPayload.action,
      'host.review.approve',
    )

    assert.equal(
      auditPayload.permissionKey,
      'host.review.approve',
    )

    assert.equal(
      auditPayload.actor.source,
      'assignment',
    )

    assert.equal(
      auditPayload
        .actor
        .isRootSuperAdmin,
      false,
    )

    assert.deepEqual(
      auditPayload
        .actor
        .roleKeys,
      [
        'marketplace_ops',
      ],
    )

    assert.equal(
      auditPayload
        .beforeSnapshot
        .hostAccessStatus,
      'pending',
    )

    assert.equal(
      auditPayload
        .afterSnapshot
        .hostAccessStatus,
      'active',
    )

    assert.equal(
      auditPayload
        .reason
        .code,
      'host_review.approved',
    )

    assert.equal(
      auditPayload.requestId,
      'host-approve-request',
    )
  },
)

/*
|--------------------------------------------------------------------------
| Fine-grained Host Read Route
|--------------------------------------------------------------------------
*/

test(
  'Admin Host read routes require MFA and host review read permission',

  async () => {
    const source =
      await readFile(
        resolve(
          backendRoot,
          'src/modules/admin/admin.routes.js',
        ),

        'utf8',
      )

    assert.match(
      source,

      /router\.get\(\s*'\/hosts',\s*authenticateSession,\s*loadCurrentUser,\s*requireActiveAccount,\s*requireMfaAssurance,\s*loadAdminAuthorization,\s*requireAdminPermission\(\s*'host\.review\.read',\s*\),\s*listHostsController,/s,
    )

    assert.match(
      source,

      /router\.get\(\s*'\/hosts\/:userId',\s*authenticateSession,\s*loadCurrentUser,\s*requireActiveAccount,\s*requireMfaAssurance,\s*loadAdminAuthorization,\s*requireAdminPermission\(\s*'host\.review\.read',\s*\),\s*getHostController,/s,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Fine-grained Host Write Routes
|--------------------------------------------------------------------------
*/

test(
  'Admin Host mutations require CSRF recent MFA and action-specific permission',

  async () => {
    const source =
      await readFile(
        resolve(
          backendRoot,
          'src/modules/admin/admin.routes.js',
        ),

        'utf8',
      )

    assert.match(
      source,

      /router\.patch\(\s*'\/hosts\/:userId\/approve',\s*authenticateSession,\s*requireCsrfToken,\s*loadCurrentUser,\s*requireActiveAccount,\s*requireRecentMfaAuthentication,\s*loadAdminAuthorization,\s*requireAdminPermission\(\s*'host\.review\.approve',\s*\),\s*approveHostController,/s,
    )

    assert.match(
      source,

      /router\.patch\(\s*'\/hosts\/:userId\/reject',\s*authenticateSession,\s*requireCsrfToken,\s*loadCurrentUser,\s*requireActiveAccount,\s*requireRecentMfaAuthentication,\s*loadAdminAuthorization,\s*requireAdminPermission\(\s*'host\.review\.reject',\s*\),\s*rejectHostController,/s,
    )

    assert.match(
      source,

      /router\.patch\(\s*'\/hosts\/:userId\/suspend',\s*authenticateSession,\s*requireCsrfToken,\s*loadCurrentUser,\s*requireActiveAccount,\s*requireRecentMfaAuthentication,\s*loadAdminAuthorization,\s*requireAdminPermission\(\s*'host\.review\.suspend',\s*\),\s*suspendHostController,/s,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Super Admin Control Plane Remains Separate
|--------------------------------------------------------------------------
*/

test(
  'real Super Admin retains exclusive role and assignment management control plane',

  async () => {
    const source =
      await readFile(
        resolve(
          backendRoot,
          'src/modules/admin/admin.routes.js',
        ),

        'utf8',
      )

    assert.match(
      source,

      /router\.post\(\s*'\/roles',[\s\S]*?\.\.\.requireRecentPrivilegedAccess\(\s*'super_admin',\s*\)/,
    )

    assert.match(
      source,

      /router\.patch\(\s*'\/users\/:userId\/roles',[\s\S]*?\.\.\.requireRecentPrivilegedAccess\(\s*'super_admin',\s*\)/,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Admin Route Mount
|--------------------------------------------------------------------------
*/

test(
  'Admin router is mounted separately from Customer and Host application modes',

  async () => {
    const source =
      await readFile(
        resolve(
          backendRoot,
          'src/app.js',
        ),

        'utf8',
      )

    assert.ok(
      source.includes(
        "import adminRoutes from './modules/admin/admin.routes.js'",
      ),
    )

    assert.match(
      source,

      /app\.use\(\s*'\/api\/v1\/admin',\s*sensitiveResponseNoStoreMiddleware,\s*adminRoutes,\s*\)/s,
    )
  },
)