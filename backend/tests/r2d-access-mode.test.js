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
  activateHostAccess,
  getAvailableModes,
  getMfaPolicyForUser,
  getResolvedActiveMode,
  hasCustomerAccess,
  hasHostAccess,
  hasSuperAdminAccess,
  rejectHostAccess,
  requestHostAccess,
  serializeCurrentUser,
  suspendHostAccess,
  switchUserActiveMode,
} =
  await import(
    '../src/modules/users/user.service.js'
  )

const {
  User,
} =
  await import(
    '../src/modules/users/user.model.js'
  )

const {
  getGrantedAccessTypes,
  userHasAnyAccess,
} =
  await import(
    '../src/modules/auth/authorization.middleware.js'
  )

/*
|--------------------------------------------------------------------------
| Fixtures
|--------------------------------------------------------------------------
*/

const USER_ID =
  '64b000000000000000000001'

function createBaseUser(
  overrides =
    {},
) {
  return {
    _id:
      USER_ID,

    firebaseUid:
      'firebase-test-user',

    name:
      'EPANTRY Test User',

    email:
      'test@example.com',

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
      'not_requested',

    superAdminEnabled:
      false,

    activeMode:
      'customer',

    lastLoginAt:
      null,

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
| Model Mock Helper
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
    'Expected operation to throw an API error.',
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
        (
          item,
        ) =>
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
| Customer-only Access
|--------------------------------------------------------------------------
*/

test(
  'Customer-only account exposes only Customer mode',

  () => {
    const user =
      createBaseUser()

    assert.equal(
      hasCustomerAccess(
        user,
      ),

      true,
    )

    assert.equal(
      hasHostAccess(
        user,
      ),

      false,
    )

    assert.equal(
      hasSuperAdminAccess(
        user,
      ),

      false,
    )

    assert.deepEqual(
      getAvailableModes(
        user,
      ),

      [
        'customer',
      ],
    )

    assert.equal(
      getResolvedActiveMode(
        user,
      ),

      'customer',
    )

    assert.deepEqual(
      getGrantedAccessTypes(
        user,
      ),

      [
        'customer',
      ],
    )
  },
)

test(
  'Customer-only account cannot switch to Host mode',

  async () => {
    const user =
      createBaseUser()

    await assert.rejects(
      async () =>
        switchUserActiveMode({
          user,

          mode:
            'host',
        }),

      (
        error,
      ) =>
        assertApiError(
          error,

          {
            statusCode:
              403,

            code:
              'AUTH_HOST_ACCESS_REQUIRED',
          },
        ),
    )
  },
)

/*
|--------------------------------------------------------------------------
| Pending Host
|--------------------------------------------------------------------------
*/

test(
  'pending Host remains Customer-only even when activeMode is manipulated to host',

  () => {
    const user =
      createBaseUser({
        hostAccessStatus:
          'pending',

        activeMode:
          'host',
      })

    assert.equal(
      hasHostAccess(
        user,
      ),

      false,
    )

    assert.equal(
      userHasAnyAccess(
        user,

        'host',
      ),

      false,
    )

    assert.deepEqual(
      getAvailableModes(
        user,
      ),

      [
        'customer',
      ],
    )

    assert.equal(
      getResolvedActiveMode(
        user,
      ),

      'customer',
    )

    const serialized =
      serializeCurrentUser(
        user,
      )

    assert.equal(
      serialized
        .hostEnabled,

      false,
    )

    assert.deepEqual(
      serialized
        .availableModes,

      [
        'customer',
      ],
    )

    assert.equal(
      serialized
        .activeMode,

      'customer',
    )
  },
)

test(
  'pending Host cannot switch to Host mode',

  async () => {
    const user =
      createBaseUser({
        hostAccessStatus:
          'pending',
      })

    await assert.rejects(
      async () =>
        switchUserActiveMode({
          user,

          mode:
            'host',
        }),

      (
        error,
      ) =>
        assertApiError(
          error,

          {
            statusCode:
              403,

            code:
              'AUTH_HOST_ACCESS_REQUIRED',
          },
        ),
    )
  },
)

test(
  'pending Host MFA policy is recommended but not yet required',

  () => {
    const user =
      createBaseUser({
        hostAccessStatus:
          'pending',
      })

    const policy =
      getMfaPolicyForUser(
        user,
      )

    assert.equal(
      policy.required,
      false,
    )

    assert.equal(
      policy.recommended,
      true,
    )

    assert.equal(
      policy.reason,
      'host_onboarding',
    )
  },
)

/*
|--------------------------------------------------------------------------
| Become A Host
|--------------------------------------------------------------------------
*/

test(
  'Customer can submit Host request without receiving Host authorization',

  {
    concurrency:
      false,
  },

  async () => {
    const user =
      createBaseUser()

    let capturedFilter =
      null

    let capturedUpdate =
      null

    const updatedUser =
      createBaseUser({
        hostAccessStatus:
          'pending',

        hostEnabled:
          false,

        activeMode:
          'customer',
      })

    await withMockedModelMethods(
      [
        {
          target:
            User,

          key:
            'findOneAndUpdate',

          implementation(
            filter,
            update,
          ) {
            capturedFilter =
              filter

            capturedUpdate =
              update

            return createLeanResult(
              updatedUser,
            )
          },
        },
      ],

      async () => {
        const result =
          await requestHostAccess({
            user,
          })

        assert.equal(
          result
            .requestChanged,

          true,
        )

        assert.equal(
          result
            .hostRequestState,

          'submitted',
        )

        assert.equal(
          result
            .user
            .customerEnabled,

          true,
        )

        assert.equal(
          result
            .user
            .hostEnabled,

          false,
        )

        assert.equal(
          result
            .user
            .hostAccessStatus,

          'pending',
        )

        assert.equal(
          result
            .user
            .activeMode,

          'customer',
        )
      },
    )

    assert.equal(
      capturedFilter
        .customerEnabled,

      true,
    )

    assert.equal(
      capturedFilter
        .hostEnabled,

      false,
    )

    assert.equal(
      capturedFilter
        .hostAccessStatus,

      'not_requested',
    )

    assert.equal(
      capturedUpdate
        .$set
        .hostEnabled,

      false,
    )

    assert.equal(
      capturedUpdate
        .$set
        .hostAccessStatus,

      'pending',
    )

    assert.equal(
      capturedUpdate
        .$set
        .activeMode,

      'customer',
    )
  },
)

test(
  'duplicate pending Host request is idempotent',

  async () => {
    const user =
      createBaseUser({
        hostAccessStatus:
          'pending',
      })

    const result =
      await requestHostAccess({
        user,
      })

    assert.equal(
      result
        .requestChanged,

      false,
    )

    assert.equal(
      result
        .hostRequestState,

      'already_pending',
    )

    assert.equal(
      result.user,
      user,
    )
  },
)

test(
  'active Host request is idempotent and does not create another identity',

  async () => {
    const user =
      createBaseUser({
        hostEnabled:
          true,

        hostAccessStatus:
          'active',

        activeMode:
          'host',
      })

    const result =
      await requestHostAccess({
        user,
      })

    assert.equal(
      result
        .requestChanged,

      false,
    )

    assert.equal(
      result
        .hostRequestState,

      'already_active',
    )

    assert.equal(
      result.user,
      user,
    )
  },
)

test(
  'rejected Host application cannot silently reset itself to pending',

  async () => {
    const user =
      createBaseUser({
        hostAccessStatus:
          'rejected',
      })

    await assert.rejects(
      async () =>
        requestHostAccess({
          user,
        }),

      (
        error,
      ) =>
        assertApiError(
          error,

          {
            statusCode:
              409,

            code:
              'AUTH_HOST_REAPPLICATION_REQUIRED',
          },
        ),
    )
  },
)

/*
|--------------------------------------------------------------------------
| Approved Host
|--------------------------------------------------------------------------
*/

test(
  'approved Host has both Customer and Host modes',

  () => {
    const user =
      createBaseUser({
        hostEnabled:
          true,

        hostAccessStatus:
          'active',

        activeMode:
          'customer',
      })

    assert.equal(
      hasCustomerAccess(
        user,
      ),

      true,
    )

    assert.equal(
      hasHostAccess(
        user,
      ),

      true,
    )

    assert.deepEqual(
      getAvailableModes(
        user,
      ),

      [
        'customer',
        'host',
      ],
    )

    assert.deepEqual(
      getGrantedAccessTypes(
        user,
      ),

      [
        'customer',
        'host',
      ],
    )
  },
)

test(
  'approved Host can switch from Customer to Host using an atomic access filter',

  {
    concurrency:
      false,
  },

  async () => {
    const user =
      createBaseUser({
        hostEnabled:
          true,

        hostAccessStatus:
          'active',

        activeMode:
          'customer',
      })

    const updatedUser =
      createBaseUser({
        hostEnabled:
          true,

        hostAccessStatus:
          'active',

        activeMode:
          'host',
      })

    let capturedFilter =
      null

    let capturedUpdate =
      null

    await withMockedModelMethods(
      [
        {
          target:
            User,

          key:
            'findOneAndUpdate',

          implementation(
            filter,
            update,
          ) {
            capturedFilter =
              filter

            capturedUpdate =
              update

            return createLeanResult(
              updatedUser,
            )
          },
        },
      ],

      async () => {
        const result =
          await switchUserActiveMode({
            user,

            mode:
              'host',
          })

        assert.equal(
          result
            .activeMode,

          'host',
        )
      },
    )

    assert.equal(
      capturedFilter
        .accountStatus,

      'active',
    )

    assert.equal(
      capturedFilter
        .hostEnabled,

      true,
    )

    assert.equal(
      capturedFilter
        .hostAccessStatus,

      'active',
    )

    assert.deepEqual(
      capturedFilter
        .superAdminEnabled,

      {
        $ne:
          true,
      },
    )

    assert.equal(
      capturedUpdate
        .$set
        .activeMode,

      'host',
    )
  },
)

test(
  'approved Host can switch back to Customer mode',

  {
    concurrency:
      false,
  },

  async () => {
    const user =
      createBaseUser({
        hostEnabled:
          true,

        hostAccessStatus:
          'active',

        activeMode:
          'host',
      })

    const updatedUser =
      createBaseUser({
        hostEnabled:
          true,

        hostAccessStatus:
          'active',

        activeMode:
          'customer',
      })

    let capturedFilter =
      null

    await withMockedModelMethods(
      [
        {
          target:
            User,

          key:
            'findOneAndUpdate',

          implementation(
            filter,
          ) {
            capturedFilter =
              filter

            return createLeanResult(
              updatedUser,
            )
          },
        },
      ],

      async () => {
        const result =
          await switchUserActiveMode({
            user,

            mode:
              'customer',
          })

        assert.equal(
          result
            .activeMode,

          'customer',
        )
      },
    )

    assert.equal(
      capturedFilter
        .customerEnabled,

      true,
    )

    assert.deepEqual(
      capturedFilter
        .superAdminEnabled,

      {
        $ne:
          true,
      },
    )
  },
)

test(
  'active Host MFA policy remains required',

  () => {
    const user =
      createBaseUser({
        hostEnabled:
          true,

        hostAccessStatus:
          'active',
      })

    const policy =
      getMfaPolicyForUser(
        user,
      )

    assert.equal(
      policy.required,
      true,
    )

    assert.equal(
      policy.recommended,
      true,
    )

    assert.equal(
      policy.reason,
      'host',
    )
  },
)

/*
|--------------------------------------------------------------------------
| Controlled Host Lifecycle
|--------------------------------------------------------------------------
*/

test(
  'Host approval enables Host while retaining Customer access',

  {
    concurrency:
      false,
  },

  async () => {
    const activatedUser =
      createBaseUser({
        customerEnabled:
          true,

        hostEnabled:
          true,

        hostAccessStatus:
          'active',
      })

    let capturedUpdate =
      null

    await withMockedModelMethods(
      [
        {
          target:
            User,

          key:
            'findOneAndUpdate',

          implementation(
            filter,
            update,
          ) {
            capturedUpdate =
              update

            assert.equal(
              filter
                .customerEnabled,

              true,
            )

            assert.equal(
              filter
                .hostAccessStatus,

              'pending',
            )

            return createLeanResult(
              activatedUser,
            )
          },
        },
      ],

      async () => {
        const result =
          await activateHostAccess(
            USER_ID,
          )

        assert.equal(
          result
            .customerEnabled,

          true,
        )

        assert.equal(
          result
            .hostEnabled,

          true,
        )

        assert.equal(
          result
            .hostAccessStatus,

          'active',
        )
      },
    )

    assert.equal(
      capturedUpdate
        .$set
        .customerEnabled,

      true,
    )

    assert.equal(
      capturedUpdate
        .$set
        .hostEnabled,

      true,
    )

    assert.equal(
      capturedUpdate
        .$set
        .hostAccessStatus,

      'active',
    )
  },
)

test(
  'Host rejection preserves Customer access and Customer mode',

  {
    concurrency:
      false,
  },

  async () => {
    const rejectedUser =
      createBaseUser({
        customerEnabled:
          true,

        hostEnabled:
          false,

        hostAccessStatus:
          'rejected',

        activeMode:
          'customer',
      })

    await withMockedModelMethods(
      [
        {
          target:
            User,

          key:
            'findOneAndUpdate',

          implementation() {
            return createLeanResult(
              rejectedUser,
            )
          },
        },
      ],

      async () => {
        const result =
          await rejectHostAccess(
            USER_ID,
          )

        assert.equal(
          result
            .customerEnabled,

          true,
        )

        assert.equal(
          result
            .hostEnabled,

          false,
        )

        assert.equal(
          result
            .hostAccessStatus,

          'rejected',
        )

        assert.equal(
          result
            .activeMode,

          'customer',
        )
      },
    )
  },
)

test(
  'Host suspension removes Host capability but preserves Customer access',

  {
    concurrency:
      false,
  },

  async () => {
    const suspendedUser =
      createBaseUser({
        customerEnabled:
          true,

        hostEnabled:
          false,

        hostAccessStatus:
          'suspended',

        activeMode:
          'customer',
      })

    let capturedUpdate =
      null

    await withMockedModelMethods(
      [
        {
          target:
            User,

          key:
            'findOneAndUpdate',

          implementation(
            filter,
            update,
          ) {
            capturedUpdate =
              update

            return createLeanResult(
              suspendedUser,
            )
          },
        },
      ],

      async () => {
        const result =
          await suspendHostAccess(
            USER_ID,
          )

        assert.equal(
          result
            .customerEnabled,

          true,
        )

        assert.equal(
          result
            .hostEnabled,

          false,
        )

        assert.equal(
          result
            .hostAccessStatus,

          'suspended',
        )

        assert.equal(
          result
            .activeMode,

          'customer',
        )
      },
    )

    assert.equal(
      capturedUpdate
        .$set
        .hostEnabled,

      false,
    )

    assert.equal(
      capturedUpdate
        .$set
        .hostAccessStatus,

      'suspended',
    )

    assert.equal(
      capturedUpdate
        .$set
        .activeMode,

      'customer',
    )
  },
)

/*
|--------------------------------------------------------------------------
| Super Admin Isolation
|--------------------------------------------------------------------------
*/

test(
  'Super Admin remains outside normal Customer and Host mode switching',

  () => {
    const user =
      createBaseUser({
        customerEnabled:
          false,

        hostEnabled:
          false,

        hostAccessStatus:
          'not_requested',

        superAdminEnabled:
          true,

        activeMode:
          null,
      })

    assert.equal(
      hasSuperAdminAccess(
        user,
      ),

      true,
    )

    assert.deepEqual(
      getGrantedAccessTypes(
        user,
      ),

      [
        'super_admin',
      ],
    )

    assert.deepEqual(
      getAvailableModes(
        user,
      ),

      [],
    )

    assert.equal(
      getResolvedActiveMode(
        user,
      ),

      null,
    )
  },
)

test(
  'Super Admin cannot use normal Customer Host mode switch',

  async () => {
    const user =
      createBaseUser({
        customerEnabled:
          false,

        hostEnabled:
          false,

        superAdminEnabled:
          true,

        activeMode:
          null,
      })

    await assert.rejects(
      async () =>
        switchUserActiveMode({
          user,

          mode:
            'customer',
        }),

      (
        error,
      ) =>
        assertApiError(
          error,

          {
            statusCode:
              403,

            code:
              'AUTH_MODE_SWITCH_NOT_AVAILABLE',
          },
        ),
    )
  },
)

test(
  'Super Admin cannot request Host onboarding through public Customer flow',

  async () => {
    const user =
      createBaseUser({
        customerEnabled:
          false,

        hostEnabled:
          false,

        superAdminEnabled:
          true,

        activeMode:
          null,
      })

    await assert.rejects(
      async () =>
        requestHostAccess({
          user,
        }),

      (
        error,
      ) =>
        assertApiError(
          error,

          {
            statusCode:
              403,

            code:
              'AUTH_HOST_ONBOARDING_NOT_AVAILABLE',
          },
        ),
    )
  },
)

test(
  'Super Admin MFA policy remains required',

  () => {
    const user =
      createBaseUser({
        customerEnabled:
          false,

        hostEnabled:
          false,

        superAdminEnabled:
          true,

        activeMode:
          null,
      })

    const policy =
      getMfaPolicyForUser(
        user,
      )

    assert.equal(
      policy.required,
      true,
    )

    assert.equal(
      policy.recommended,
      true,
    )

    assert.equal(
      policy.reason,
      'super_admin',
    )
  },
)