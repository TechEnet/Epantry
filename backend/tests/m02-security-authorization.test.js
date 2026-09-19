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
  requireActiveAccount,
  requireCsrfToken,
  requireMfaAssurance,
  requireRecentAuthentication,
  requireRecentMfaAuthentication,
} =
  await import(
    '../src/modules/auth/auth.middleware.js'
  )

const {
  getCsrfCookieOptions,
  getFirebaseAuthAssurance,
  getSessionCookieOptions,
} =
  await import(
    '../src/modules/auth/auth.service.js'
  )

const {
  getGrantedAccessTypes,
  isPrivilegedUser,
  loadHouseholdTenantFromParam,
  requireAllAccess,
  requireAnyAccess,
  requireCustomerAccess,
  requireHostAccess,
  requireHouseholdOwnedResource,
  requireHouseholdTenantRole,
  requirePrivilegedAccess,
  requireRecentPrivilegedAccess,
  requireSelfOwnedResource,
  requireSuperAdminAccess,
  userHasAllAccess,
  userHasAnyAccess,
} =
  await import(
    '../src/modules/auth/authorization.middleware.js'
  )

const {
  getAvailableModes,
  getResolvedActiveMode,
  hasCustomerAccess,
  hasHostAccess,
  hasSuperAdminAccess,
} =
  await import(
    '../src/modules/users/user.service.js'
  )

const {
  Household,
} =
  await import(
    '../src/modules/households/household.model.js'
  )

const {
  HouseholdMembership,
} =
  await import(
    '../src/modules/households/householdMembership.model.js'
  )

const {
  sensitiveResponseNoStoreMiddleware,
} =
  await import(
    '../src/middlewares/security.middleware.js'
  )

const {
  env,
} =
  await import(
    '../src/config/env.js'
  )

/*
|--------------------------------------------------------------------------
| Request / Response Doubles
|--------------------------------------------------------------------------
*/

function createResponseDouble() {
  const headers =
    new Map()

  return {
    headers,

    set(
      name,
      value,
    ) {
      headers.set(
        String(
          name,
        ).toLowerCase(),

        value,
      )

      return this
    },

    clearCookie() {
      return this
    },
  }
}

function createRequest({
  cookies = {},
  headers = {},
  currentUser = null,
  auth = null,
  params = {},
  tenant = null,
  resource = undefined,
} = {}) {
  const normalizedHeaders =
    Object.fromEntries(
      Object.entries(
        headers,
      ).map(
        (
          [
            key,
            value,
          ],
        ) => [
          key.toLowerCase(),

          value,
        ],
      ),
    )

  return {
    cookies,

    currentUser,

    auth,

    params,

    tenant,

    resource,

    get(
      name,
    ) {
      return normalizedHeaders[
        String(
          name,
        ).toLowerCase()
      ]
    },
  }
}

/*
|--------------------------------------------------------------------------
| Middleware Runner
|--------------------------------------------------------------------------
*/

async function runMiddleware(
  middleware,
  req,
  res =
    createResponseDouble(),
) {
  return new Promise(
    (
      resolve,
      reject,
    ) => {
      let finished =
        false

      const next =
        (
          error,
        ) => {
          if (finished) {
            return
          }

          finished =
            true

          resolve({
            error:
              error ||
              null,

            req,

            res,
          })
        }

      try {
        const result =
          middleware(
            req,
            res,
            next,
          )

        if (
          result &&
          typeof result.then ===
            'function'
        ) {
          result.catch(
            reject,
          )
        }
      } catch (error) {
        resolve({
          error,

          req,

          res,
        })
      }
    },
  )
}

/*
|--------------------------------------------------------------------------
| Middleware Chain Runner
|--------------------------------------------------------------------------
*/

async function runMiddlewareChain(
  middlewares,
  req,
) {
  const res =
    createResponseDouble()

  for (
    const middleware
    of middlewares
  ) {
    const result =
      await runMiddleware(
        middleware,
        req,
        res,
      )

    if (
      result.error
    ) {
      return result
    }
  }

  return {
    error:
      null,

    req,

    res,
  }
}

/*
|--------------------------------------------------------------------------
| Temporary Mongoose Model Method Mock
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
    'Expected middleware to reject the request.',
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
}

/*
|--------------------------------------------------------------------------
| Cookie Security
|--------------------------------------------------------------------------
*/

test(
  'session cookie remains HttpOnly and CSRF cookie is scoped to /api/v1',

  () => {
    const sessionOptions =
      getSessionCookieOptions()

    const csrfOptions =
      getCsrfCookieOptions()

    assert.equal(
      sessionOptions
        .httpOnly,

      true,
    )

    assert.equal(
      sessionOptions
        .path,

      '/',
    )

    assert.equal(
      sessionOptions
        .sameSite,

      'lax',
    )

    assert.equal(
      csrfOptions
        .httpOnly,

      false,
    )

    assert.equal(
      csrfOptions
        .path,

      '/api/v1',
    )

    assert.equal(
      csrfOptions
        .sameSite,

      'lax',
    )
  },
)

/*
|--------------------------------------------------------------------------
| CSRF
|--------------------------------------------------------------------------
*/

test(
  'CSRF middleware rejects a missing token',

  async () => {
    const req =
      createRequest({
        cookies: {},
      })

    const {
      error,
    } =
      await runMiddleware(
        requireCsrfToken,
        req,
      )

    assertApiError(
      error,

      {
        statusCode:
          403,
      },
    )
  },
)

test(
  'CSRF middleware rejects a mismatched token',

  async () => {
    const req =
      createRequest({
        cookies: {
          [
            env
              .authCsrfCookieName
          ]:
            '123456',
        },

        headers: {
          'x-csrf-token':
            '654321',
        },
      })

    const {
      error,
    } =
      await runMiddleware(
        requireCsrfToken,
        req,
      )

    assertApiError(
      error,

      {
        statusCode:
          403,
      },
    )
  },
)

test(
  'CSRF middleware accepts the matching double-submit token',

  async () => {
    const token =
      'same-security-token'

    const req =
      createRequest({
        cookies: {
          [
            env
              .authCsrfCookieName
          ]:
            token,
        },

        headers: {
          'x-csrf-token':
            token,
        },
      })

    const {
      error,
    } =
      await runMiddleware(
        requireCsrfToken,
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
| Cache Protection
|--------------------------------------------------------------------------
*/

test(
  'sensitive response middleware applies no-store headers',

  async () => {
    const req =
      createRequest()

    const res =
      createResponseDouble()

    const {
      error,
    } =
      await runMiddleware(
        sensitiveResponseNoStoreMiddleware,
        req,
        res,
      )

    assert.equal(
      error,
      null,
    )

    assert.match(
      String(
        res.headers.get(
          'cache-control',
        ),
      ),

      /no-store/,
    )

    assert.equal(
      res.headers.get(
        'pragma',
      ),

      'no-cache',
    )
  },
)

/*
|--------------------------------------------------------------------------
| Firebase Authentication Assurance
|--------------------------------------------------------------------------
*/

test(
  'Firebase claims expose recent TOTP MFA assurance',

  () => {
    const nowSeconds =
      Math.floor(
        Date.now() /
          1000,
      )

    const safeRecentAge =
      Math.max(
        0,

        Math.min(
          10,

          env
            .authRecentSignInSeconds -
            1,
        ),
      )

    const assurance =
      getFirebaseAuthAssurance({
        auth_time:
          nowSeconds -
          safeRecentAge,

        firebase: {
          sign_in_second_factor:
            'totp',
        },
      })

    assert.equal(
      assurance
        .recentlyAuthenticated,

      true,
    )

    assert.equal(
      assurance
        .mfaAuthenticated,

      true,
    )

    assert.equal(
      assurance
        .secondFactorProvider,

      'totp',
    )
  },
)

test(
  'stale authentication fails the recent-auth gate with 428',

  async () => {
    const req =
      createRequest({
        auth: {
          assurance: {
            recentlyAuthenticated:
              false,

            recentAuthenticationWindowSeconds:
              env
                .authRecentSignInSeconds,

            mfaAuthenticated:
              true,
          },
        },
      })

    const {
      error,
    } =
      await runMiddleware(
        requireRecentAuthentication,
        req,
      )

    assertApiError(
      error,

      {
        statusCode:
          428,

        code:
          'AUTH_RECENT_REQUIRED',
      },
    )
  },
)

test(
  'non-MFA authentication fails the MFA assurance gate with 428',

  async () => {
    const req =
      createRequest({
        auth: {
          assurance: {
            recentlyAuthenticated:
              true,

            mfaAuthenticated:
              false,
          },
        },
      })

    const {
      error,
    } =
      await runMiddleware(
        requireMfaAssurance,
        req,
      )

    assertApiError(
      error,

      {
        statusCode:
          428,

        code:
          'AUTH_MFA_REQUIRED',
      },
    )
  },
)

test(
  'recent MFA authentication satisfies the strongest assurance gate',

  async () => {
    const req =
      createRequest({
        auth: {
          assurance: {
            recentlyAuthenticated:
              true,

            mfaAuthenticated:
              true,
          },
        },
      })

    const {
      error,
    } =
      await runMiddleware(
        requireRecentMfaAuthentication,
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
| Global Account Status
|--------------------------------------------------------------------------
*/

test(
  'active global account passes the active-account gate',

  async () => {
    const req =
      createRequest({
        currentUser: {
          accountStatus:
            'active',
        },
      })

    const {
      error,
    } =
      await runMiddleware(
        requireActiveAccount,
        req,
      )

    assert.equal(
      error,
      null,
    )
  },
)

test(
  'pending Host onboarding does not block an active Customer account',

  async () => {
    const req =
      createRequest({
        currentUser: {
          accountStatus:
            'active',

          customerEnabled:
            true,

          hostEnabled:
            false,

          hostAccessStatus:
            'pending',

          activeMode:
            'customer',
        },
      })

    const {
      error,
    } =
      await runMiddleware(
        requireActiveAccount,
        req,
      )

    assert.equal(
      error,
      null,
    )
  },
)

test(
  'suspended global account fails the active-account gate',

  async () => {
    const req =
      createRequest({
        currentUser: {
          accountStatus:
            'suspended',
        },
      })

    const {
      error,
    } =
      await runMiddleware(
        requireActiveAccount,
        req,
      )

    assertApiError(
      error,

      {
        statusCode:
          403,
      },
    )
  },
)

test(
  'disabled global account fails the active-account gate',

  async () => {
    const req =
      createRequest({
        currentUser: {
          accountStatus:
            'disabled',
        },
      })

    const {
      error,
    } =
      await runMiddleware(
        requireActiveAccount,
        req,
      )

    assertApiError(
      error,

      {
        statusCode:
          403,
      },
    )
  },
)

test(
  'locked global account fails the active-account gate with 423',

  async () => {
    const req =
      createRequest({
        currentUser: {
          accountStatus:
            'locked',
        },
      })

    const {
      error,
    } =
      await runMiddleware(
        requireActiveAccount,
        req,
      )

    assertApiError(
      error,

      {
        statusCode:
          423,
      },
    )
  },
)

/*
|--------------------------------------------------------------------------
| Application Access
|--------------------------------------------------------------------------
*/

test(
  'Customer-only user receives only Customer application access',

  () => {
    const user = {
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
    }

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
      getGrantedAccessTypes(
        user,
      ),

      [
        'customer',
      ],
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

    assert.equal(
      isPrivilegedUser(
        user,
      ),

      false,
    )
  },
)

test(
  'legacy accountType cannot grant Host access',

  async () => {
    const req =
      createRequest({
        currentUser: {
          _id:
            '64b000000000000000000001',

          accountType:
            'seller',

          customerEnabled:
            true,

          hostEnabled:
            false,

          hostAccessStatus:
            'not_requested',

          superAdminEnabled:
            false,
        },
      })

    const {
      error,
    } =
      await runMiddleware(
        requireHostAccess,
        req,
      )

    assertApiError(
      error,

      {
        statusCode:
          403,

        code:
          'AUTH_ACCESS_REQUIRED',
      },
    )
  },
)

test(
  'pending Host cannot gain Host authority from a manipulated activeMode',

  async () => {
    const user = {
      _id:
        '64b000000000000000000001',

      customerEnabled:
        true,

      hostEnabled:
        false,

      hostAccessStatus:
        'pending',

      superAdminEnabled:
        false,

      activeMode:
        'host',
    }

    assert.equal(
      hasHostAccess(
        user,
      ),

      false,
    )

    assert.deepEqual(
      getGrantedAccessTypes(
        user,
      ),

      [
        'customer',
      ],
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

    const req =
      createRequest({
        currentUser:
          user,
      })

    const {
      error,
    } =
      await runMiddleware(
        requireHostAccess,
        req,
      )

    assertApiError(
      error,

      {
        statusCode:
          403,

        code:
          'AUTH_ACCESS_REQUIRED',
      },
    )
  },
)

test(
  'hostEnabled without active Host status does not grant Host access',

  () => {
    const user = {
      customerEnabled:
        true,

      hostEnabled:
        true,

      hostAccessStatus:
        'pending',

      superAdminEnabled:
        false,
    }

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
  'active Host receives both Customer and Host access',

  () => {
    const user = {
      customerEnabled:
        true,

      hostEnabled:
        true,

      hostAccessStatus:
        'active',

      superAdminEnabled:
        false,

      activeMode:
        'host',
    }

    assert.deepEqual(
      getGrantedAccessTypes(
        user,
      ),

      [
        'customer',
        'host',
      ],
    )

    assert.equal(
      userHasAnyAccess(
        user,

        [
          'host',
          'super_admin',
        ],
      ),

      true,
    )

    assert.equal(
      userHasAllAccess(
        user,

        [
          'customer',
          'host',
        ],
      ),

      true,
    )

    assert.equal(
      isPrivilegedUser(
        user,
      ),

      true,
    )
  },
)

test(
  'all-access guard requires every requested application capability',

  async () => {
    const req =
      createRequest({
        currentUser: {
          _id:
            '64b000000000000000000001',

          customerEnabled:
            true,

          hostEnabled:
            false,

          hostAccessStatus:
            'pending',

          superAdminEnabled:
            false,
        },
      })

    const {
      error,
    } =
      await runMiddleware(
        requireAllAccess(
          'customer',
          'host',
        ),

        req,
      )

    assertApiError(
      error,

      {
        statusCode:
          403,

        code:
          'AUTH_ACCESS_REQUIRED',
      },
    )
  },
)

test(
  'named Customer access gate allows Customer capability',

  async () => {
    const req =
      createRequest({
        currentUser: {
          customerEnabled:
            true,

          hostEnabled:
            false,

          hostAccessStatus:
            'not_requested',

          superAdminEnabled:
            false,
        },
      })

    const {
      error,
    } =
      await runMiddleware(
        requireCustomerAccess,
        req,
      )

    assert.equal(
      error,
      null,
    )
  },
)

test(
  'named Super Admin gate requires explicit Super Admin capability',

  async () => {
    const req =
      createRequest({
        currentUser: {
          customerEnabled:
            false,

          hostEnabled:
            false,

          hostAccessStatus:
            'not_requested',

          superAdminEnabled:
            true,
        },
      })

    const {
      error,
    } =
      await runMiddleware(
        requireSuperAdminAccess,
        req,
      )

    assert.equal(
      error,
      null,
    )
  },
)

test(
  'legacy Seller role name is rejected by the new access API',

  () => {
    assert.throws(
      () =>
        requireAnyAccess(
          'seller',
        ),

      /Unknown EPANTRY application access type/,
    )
  },
)

test(
  'legacy Brand role name is rejected by the new access API',

  () => {
    assert.throws(
      () =>
        requireAnyAccess(
          'brand',
        ),

      /Unknown EPANTRY application access type/,
    )
  },
)

test(
  'legacy B2B operator role name is rejected by the new access API',

  () => {
    assert.throws(
      () =>
        requireAnyAccess(
          'b2b_operator',
        ),

      /Unknown EPANTRY application access type/,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Privileged Access + MFA
|--------------------------------------------------------------------------
*/

test(
  'Host privileged access requires MFA assurance',

  async () => {
    const req =
      createRequest({
        currentUser: {
          _id:
            '64b000000000000000000001',

          customerEnabled:
            true,

          hostEnabled:
            true,

          hostAccessStatus:
            'active',

          superAdminEnabled:
            false,
        },

        auth: {
          assurance: {
            recentlyAuthenticated:
              true,

            mfaAuthenticated:
              false,
          },
        },
      })

    const result =
      await runMiddlewareChain(
        requirePrivilegedAccess(
          'host',
        ),

        req,
      )

    assertApiError(
      result.error,

      {
        statusCode:
          428,

        code:
          'AUTH_MFA_REQUIRED',
      },
    )
  },
)

test(
  'pending Host cannot pass privileged Host gate even with MFA',

  async () => {
    const req =
      createRequest({
        currentUser: {
          _id:
            '64b000000000000000000001',

          customerEnabled:
            true,

          hostEnabled:
            false,

          hostAccessStatus:
            'pending',

          superAdminEnabled:
            false,
        },

        auth: {
          assurance: {
            recentlyAuthenticated:
              true,

            mfaAuthenticated:
              true,
          },
        },
      })

    const result =
      await runMiddlewareChain(
        requirePrivilegedAccess(
          'host',
        ),

        req,
      )

    assertApiError(
      result.error,

      {
        statusCode:
          403,

        code:
          'AUTH_ACCESS_REQUIRED',
      },
    )
  },
)

test(
  'recent Super Admin privileged access requires recent MFA',

  async () => {
    const req =
      createRequest({
        currentUser: {
          _id:
            '64b000000000000000000099',

          customerEnabled:
            false,

          hostEnabled:
            false,

          hostAccessStatus:
            'not_requested',

          superAdminEnabled:
            true,
        },

        auth: {
          assurance: {
            recentlyAuthenticated:
              false,

            recentAuthenticationWindowSeconds:
              env
                .authRecentSignInSeconds,

            mfaAuthenticated:
              true,
          },
        },
      })

    const result =
      await runMiddlewareChain(
        requireRecentPrivilegedAccess(
          'super_admin',
        ),

        req,
      )

    assertApiError(
      result.error,

      {
        statusCode:
          428,

        code:
          'AUTH_RECENT_REQUIRED',
      },
    )
  },
)

/*
|--------------------------------------------------------------------------
| Household Tenant Authorization
|--------------------------------------------------------------------------
*/

test(
  'household tenant loader rejects an outsider',

  {
    concurrency:
      false,
  },

  async () => {
    const householdId =
      '64b000000000000000000010'

    const userId =
      '64b000000000000000000001'

    await withMockedModelMethods(
      [
        {
          target:
            HouseholdMembership,

          key:
            'findOne',

          implementation() {
            return {
              lean:
                async () =>
                  null,
            }
          },
        },
      ],

      async () => {
        const req =
          createRequest({
            currentUser: {
              _id:
                userId,

              customerEnabled:
                true,

              hostEnabled:
                false,

              hostAccessStatus:
                'not_requested',

              superAdminEnabled:
                false,
            },

            params: {
              householdId,
            },
          })

        const {
          error,
        } =
          await runMiddleware(
            loadHouseholdTenantFromParam(
              'householdId',
            ),

            req,
          )

        assertApiError(
          error,

          {
            statusCode:
              403,

            code:
              'HOUSEHOLD_MEMBERSHIP_REQUIRED',
          },
        )
      },
    )
  },
)

test(
  'Super Admin receives no implicit household bypass',

  {
    concurrency:
      false,
  },

  async () => {
    const householdId =
      '64b000000000000000000010'

    await withMockedModelMethods(
      [
        {
          target:
            HouseholdMembership,

          key:
            'findOne',

          implementation() {
            return {
              lean:
                async () =>
                  null,
            }
          },
        },
      ],

      async () => {
        const req =
          createRequest({
            currentUser: {
              _id:
                '64b000000000000000000099',

              superAdminEnabled:
                true,
            },

            params: {
              householdId,
            },
          })

        const {
          error,
        } =
          await runMiddleware(
            loadHouseholdTenantFromParam(
              'householdId',
            ),

            req,
          )

        assertApiError(
          error,

          {
            statusCode:
              403,

            code:
              'HOUSEHOLD_MEMBERSHIP_REQUIRED',
          },
        )
      },
    )
  },
)

test(
  'active household member becomes an explicit household tenant',

  {
    concurrency:
      false,
  },

  async () => {
    const householdId =
      '64b000000000000000000010'

    const userId =
      '64b000000000000000000001'

    const membership = {
      _id:
        '64b000000000000000000020',

      userId,

      householdId,

      role:
        'member',

      status:
        'active',
    }

    const household = {
      _id:
        householdId,

      name:
        'Test Household',

      status:
        'active',
    }

    await withMockedModelMethods(
      [
        {
          target:
            HouseholdMembership,

          key:
            'findOne',

          implementation() {
            return {
              lean:
                async () =>
                  membership,
            }
          },
        },

        {
          target:
            Household,

          key:
            'findOne',

          implementation() {
            return {
              lean:
                async () =>
                  household,
            }
          },
        },
      ],

      async () => {
        const req =
          createRequest({
            currentUser: {
              _id:
                userId,

              customerEnabled:
                true,
            },

            params: {
              householdId,
            },
          })

        const {
          error,
        } =
          await runMiddleware(
            loadHouseholdTenantFromParam(
              'householdId',
            ),

            req,
          )

        assert.equal(
          error,
          null,
        )

        assert.equal(
          req
            .tenant
            .type,

          'household',
        )

        assert.equal(
          req
            .tenant
            .id,

          householdId,
        )

        assert.equal(
          req
            .tenant
            .role,

          'member',
        )
      },
    )
  },
)

test(
  'household member cannot pass owner/admin role gate',

  async () => {
    const req =
      createRequest({
        tenant: {
          type:
            'household',

          id:
            '64b000000000000000000010',

          role:
            'member',

          membership: {
            role:
              'member',
          },
        },
      })

    const {
      error,
    } =
      await runMiddleware(
        requireHouseholdTenantRole(
          'owner',
          'admin',
        ),

        req,
      )

    assertApiError(
      error,

      {
        statusCode:
          403,

        code:
          'HOUSEHOLD_ROLE_REQUIRED',
      },
    )
  },
)

test(
  'household owner passes owner/admin role gate',

  async () => {
    const req =
      createRequest({
        tenant: {
          type:
            'household',

          id:
            '64b000000000000000000010',

          role:
            'owner',

          membership: {
            role:
              'owner',
          },
        },
      })

    const {
      error,
    } =
      await runMiddleware(
        requireHouseholdTenantRole(
          'owner',
          'admin',
        ),

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
| Self-owned Resources
|--------------------------------------------------------------------------
*/

test(
  'self-owned resource guard allows the owning user',

  async () => {
    const userId =
      '64b000000000000000000001'

    const req =
      createRequest({
        currentUser: {
          _id:
            userId,
        },

        resource: {
          userId,
        },
      })

    const {
      error,
    } =
      await runMiddleware(
        requireSelfOwnedResource(),

        req,
      )

    assert.equal(
      error,
      null,
    )
  },
)

test(
  'foreign self-owned resource is concealed with 404',

  async () => {
    const req =
      createRequest({
        currentUser: {
          _id:
            '64b000000000000000000001',
        },

        resource: {
          userId:
            '64b000000000000000000002',
        },
      })

    const {
      error,
    } =
      await runMiddleware(
        requireSelfOwnedResource(),

        req,
      )

    assertApiError(
      error,

      {
        statusCode:
          404,

        code:
          'RESOURCE_NOT_FOUND',
      },
    )
  },
)

/*
|--------------------------------------------------------------------------
| Household-owned Resources
|--------------------------------------------------------------------------
*/

test(
  'household-owned resource guard allows matching tenant resource',

  async () => {
    const householdId =
      '64b000000000000000000010'

    const req =
      createRequest({
        tenant: {
          type:
            'household',

          id:
            householdId,
        },

        resource: {
          householdId,
        },
      })

    const {
      error,
    } =
      await runMiddleware(
        requireHouseholdOwnedResource(),

        req,
      )

    assert.equal(
      error,
      null,
    )
  },
)

test(
  'cross-tenant resource mismatch is concealed with 404',

  async () => {
    const req =
      createRequest({
        tenant: {
          type:
            'household',

          id:
            '64b000000000000000000010',
        },

        resource: {
          householdId:
            '64b000000000000000000011',
        },
      })

    const {
      error,
    } =
      await runMiddleware(
        requireHouseholdOwnedResource(),

        req,
      )

    assertApiError(
      error,

      {
        statusCode:
          404,

        code:
          'RESOURCE_NOT_FOUND',
      },
    )
  },
)