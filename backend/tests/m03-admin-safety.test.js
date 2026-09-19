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
  ADMIN_AUDIT_CRITICAL_ACTIONS,
} =
  await import(
    '../src/modules/admin/adminAudit.registry.js'
  )

const {
  ADMIN_PRIVILEGED_SAFETY_POLICIES,
  getAdminPrivilegedSafetyPolicy,
  isAdminActionMakerCheckerReady,
} =
  await import(
    '../src/modules/admin/adminSafety.registry.js'
  )

const {
  assertDistinctMakerCheckerActors,
  detectPrivilegedImpersonation,
  rejectPrivilegedImpersonation,
} =
  await import(
    '../src/modules/admin/adminSafety.middleware.js'
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
| Top-level Access Architecture
|--------------------------------------------------------------------------
*/

test(
  'M03 privileged safety preserves Customer Host Super Admin as the only top-level access types',

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
| Critical Policy Coverage
|--------------------------------------------------------------------------
*/

test(
  'every critical admin audit action has an explicit privileged safety policy',

  () => {
    assert.equal(
      Object.keys(
        ADMIN_PRIVILEGED_SAFETY_POLICIES,
      ).length,
      ADMIN_AUDIT_CRITICAL_ACTIONS.length,
    )

    for (
      const action
      of ADMIN_AUDIT_CRITICAL_ACTIONS
    ) {
      const policy =
        getAdminPrivilegedSafetyPolicy(
          action,
        )

      assert.ok(
        policy,
      )

      assert.equal(
        policy.allowImpersonation,
        false,
      )
    }
  },
)

/*
|--------------------------------------------------------------------------
| Maker-checker Ready Operations
|--------------------------------------------------------------------------
*/

test(
  'control-plane authority and finance mutation are maker-checker ready',

  () => {
    for (
      const action
      of [
        'admin.role.create',
        'admin.role.update',
        'admin.assignment.grant',
        'admin.assignment.revoke',
        'finance.mutate',
      ]
    ) {
      assert.equal(
        isAdminActionMakerCheckerReady(
          action,
        ),
        true,
      )
    }
  },
)

/*
|--------------------------------------------------------------------------
| Existing Host Flow
|--------------------------------------------------------------------------
*/

test(
  'current Host review remains single actor while keeping the future safety registry explicit',

  () => {
    for (
      const action
      of [
        'host.review.approve',
        'host.review.reject',
        'host.review.suspend',
      ]
    ) {
      const policy =
        getAdminPrivilegedSafetyPolicy(
          action,
        )

      assert.equal(
        policy.makerCheckerMode,
        'single_actor',
      )

      assert.equal(
        policy.allowImpersonation,
        false,
      )
    }
  },
)

/*
|--------------------------------------------------------------------------
| Maker / Checker Separation
|--------------------------------------------------------------------------
*/

test(
  'maker-checker hook accepts two distinct administrative actors',

  () => {
    const result =
      assertDistinctMakerCheckerActors({
        makerUserId:
          '64b000000000000000003001',

        checkerUserId:
          '64b000000000000000003002',
      })

    assert.equal(
      result.makerUserId,
      '64b000000000000000003001',
    )

    assert.equal(
      result.checkerUserId,
      '64b000000000000000003002',
    )
  },
)

test(
  'maker-checker hook forbids self approval',

  () => {
    assert.throws(
      () =>
        assertDistinctMakerCheckerActors({
          makerUserId:
            '64b000000000000000003011',

          checkerUserId:
            '64b000000000000000003011',
        }),

      (error) =>
        error?.statusCode ===
          409 &&
        error?.errors?.[0]?.code ===
          'ADMIN_MAKER_CHECKER_SELF_APPROVAL_FORBIDDEN',
    )
  },
)

/*
|--------------------------------------------------------------------------
| Normal Privileged Request
|--------------------------------------------------------------------------
*/

test(
  'privileged impersonation guard allows a normal admin request',

  async () => {
    const req = {
      headers:
        {},
    }

    const detected =
      detectPrivilegedImpersonation(
        req,
      )

    assert.equal(
      detected.active,
      false,
    )

    const error =
      await runMiddleware(
        rejectPrivilegedImpersonation,
        req,
      )

    assert.equal(
      error,
      null,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Internal Impersonation Context
|--------------------------------------------------------------------------
*/

test(
  'privileged impersonation guard rejects an active internal impersonation context',

  async () => {
    const error =
      await runMiddleware(
        rejectPrivilegedImpersonation,

        {
          headers:
            {},

          impersonationContext: {
            active:
              true,

            targetUserId:
              '64b000000000000000003021',
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
      'ADMIN_PRIVILEGED_IMPERSONATION_FORBIDDEN',
    )

    assert.equal(
      error.errors[0].source,
      'request_context',
    )
  },
)

/*
|--------------------------------------------------------------------------
| Reserved Impersonation Headers
|--------------------------------------------------------------------------
*/

test(
  'privileged impersonation guard rejects reserved impersonation request headers',

  async () => {
    const error =
      await runMiddleware(
        rejectPrivilegedImpersonation,

        {
          headers: {
            'x-epantry-impersonated-user-id':
              '64b000000000000000003031',
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
      'ADMIN_PRIVILEGED_IMPERSONATION_FORBIDDEN',
    )

    assert.equal(
      error.errors[0].source,
      'request_header',
    )
  },
)

/*
|--------------------------------------------------------------------------
| Admin Router Safety Boundary
|--------------------------------------------------------------------------
*/

test(
  'entire admin router uses the privileged impersonation boundary without reintroducing legacy auth roles',

  async () => {
    const source =
      await readFile(
        new URL(
          '../src/modules/admin/admin.routes.js',
          import.meta.url,
        ),

        'utf8',
      )

    assert.match(
      source,
      /router\.use\(\s*rejectPrivilegedImpersonation,\s*\)/s,
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