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

const projectRoot =
  resolve(
    backendRoot,
    '..',
  )

/*
|--------------------------------------------------------------------------
| Source Helpers
|--------------------------------------------------------------------------
*/

async function readProjectFile(
  relativePath,
) {
  return readFile(
    resolve(
      projectRoot,
      relativePath,
    ),

    'utf8',
  )
}

async function assertContains(
  relativePath,
  expectedValues,
) {
  const source =
    await readProjectFile(
      relativePath,
    )

  for (
    const expectedValue
    of expectedValues
  ) {
    assert.ok(
      source.includes(
        expectedValue,
      ),

      `${relativePath} is missing required contract: ${expectedValue}`,
    )
  }

  return source
}

/*
|--------------------------------------------------------------------------
| Authentication Backend
|--------------------------------------------------------------------------
*/

test(
  'M02 authentication backend exposes session, MFA and re-authentication contracts',

  async () => {
    await assertContains(
      'backend/src/modules/auth/auth.routes.js',

      [
        "'/session'",
        "'/reauth'",
        "'/mfa/status'",
        "'/assurance'",
        "'/logout'",
        'requireCsrfToken',
        'authenticateSession',
      ],
    )

    await assertContains(
      'backend/src/modules/auth/auth.service.js',

      [
        'httpOnly:',
        "path:\n      '/api/v1'",
        'auth_time',
        'sign_in_second_factor',
        'recentlyAuthenticated',
        'mfaAuthenticated',
      ],
    )

    await assertContains(
      'backend/src/modules/auth/auth.middleware.js',

      [
        'requireRecentAuthentication',
        'requireMfaAssurance',
        'requireRecentMfaAuthentication',
        'AUTH_RECENT_REQUIRED',
        'AUTH_MFA_REQUIRED',
        'assertSessionEligibleAccount',
      ],
    )
  },
)

/*
|--------------------------------------------------------------------------
| Customer / Host / Super Admin Access Model
|--------------------------------------------------------------------------
*/

test(
  'R2 access model exposes Customer, Host and Super Admin capabilities',

  async () => {
    const userModel =
      await assertContains(
        'backend/src/modules/users/user.model.js',

        [
          'USER_ACCESS_TYPES',
          "'customer'",
          "'host'",
          "'super_admin'",
          'customerEnabled:',
          'hostEnabled:',
          'hostAccessStatus:',
          'superAdminEnabled:',
          'activeMode:',
        ],
      )

    assert.equal(
      /^\s*accountType:\s*\{/m.test(
        userModel,
      ),

      false,

      'User schema must not use accountType as top-level authorization state.',
    )

    assert.equal(
      /^\s*roles:\s*\{/m.test(
        userModel,
      ),

      false,

      'User schema must not use legacy roles as top-level authorization state.',
    )
  },
)

/*
|--------------------------------------------------------------------------
| Authorization + Tenant + Resource Protection
|--------------------------------------------------------------------------
*/

test(
  'M02 authorization layer uses access capabilities instead of legacy application roles',

  async () => {
    const authorization =
      await assertContains(
        'backend/src/modules/auth/authorization.middleware.js',

        [
          'getGrantedAccessTypes',
          'userHasAnyAccess',
          'userHasAllAccess',
          'requireAnyAccess',
          'requireAllAccess',
          'requireCustomerAccess',
          'requireHostAccess',
          'requireSuperAdminAccess',
          'requirePrivilegedAccess',
          'requireRecentPrivilegedAccess',
          'loadHouseholdTenantFromParam',
          'requireHouseholdTenantRole',
          'requireSelfOwnedResource',
          'requireHouseholdOwnedResource',
        ],
      )

    assert.equal(
      /\bexport\s+function\s+requireAnyRole\b/.test(
        authorization,
      ),

      false,

      'Legacy requireAnyRole authorization must not be exported.',
    )

    assert.equal(
      /\bexport\s+function\s+requireAllRoles\b/.test(
        authorization,
      ),

      false,

      'Legacy requireAllRoles authorization must not be exported.',
    )

    assert.equal(
      /\bgetGrantedUserRoles\b/.test(
        authorization,
      ),

      false,

      'Legacy getGrantedUserRoles helper must not remain in authorization logic.',
    )
  },
)

/*
|--------------------------------------------------------------------------
| Mode Switching + Become A Host
|--------------------------------------------------------------------------
*/

test(
  'R2 backend exposes secure same-account Customer and Host mode contracts',

  async () => {
    const routes =
      await assertContains(
        'backend/src/modules/auth/auth.routes.js',

        [
          "'/mode'",
          "'/host/request'",
          'switchActiveModeController',
          'requestHostAccessController',
          'requireCsrfToken',
          'requireActiveAccount',
        ],
      )

    assert.match(
      routes,

      /router\.patch\(\s*'\/mode',\s*authSessionRateLimiter,\s*authenticateSession,\s*requireCsrfToken,\s*loadCurrentUser,\s*requireActiveAccount,\s*switchActiveModeController,/s,

      'PATCH /auth/mode must require session, CSRF, current user and active global account.',
    )

    assert.match(
      routes,

      /router\.post\(\s*'\/host\/request',\s*authSessionRateLimiter,\s*authenticateSession,\s*requireCsrfToken,\s*loadCurrentUser,\s*requireActiveAccount,\s*requestHostAccessController,/s,

      'POST /auth/host/request must require session, CSRF, current user and active global account.',
    )

    await assertContains(
      'backend/src/modules/users/user.service.js',

      [
        'getAvailableModes',
        'getResolvedActiveMode',
        'switchUserActiveMode',
        'requestHostAccess',
        'activateHostAccess',
        'rejectHostAccess',
        'suspendHostAccess',
        'hostAccessStatus',
        'AUTH_HOST_ACCESS_REQUIRED',
        'AUTH_MODE_SWITCH_NOT_AVAILABLE',
      ],
    )
  },
)

/*
|--------------------------------------------------------------------------
| Global Account vs Host Lifecycle
|--------------------------------------------------------------------------
*/

test(
  'global account status remains separate from Host onboarding lifecycle',

  async () => {
    const userModel =
      await readProjectFile(
        'backend/src/modules/users/user.model.js',
      )

    const authMiddleware =
      await readProjectFile(
        'backend/src/modules/auth/auth.middleware.js',
      )

    await assertContains(
      'backend/src/modules/users/user.model.js',

      [
        'USER_ACCOUNT_STATUSES',
        "'active'",
        "'suspended'",
        "'disabled'",
        "'locked'",
        'HOST_ACCESS_STATUSES',
        "'not_requested'",
        "'pending'",
        "'rejected'",
      ],
    )

    assert.equal(
      /case\s+'pending'/.test(
        authMiddleware,
      ),

      false,

      'Global active-account middleware must not treat pending as a global account state.',
    )

    assert.equal(
      /case\s+'rejected'/.test(
        authMiddleware,
      ),

      false,

      'Global active-account middleware must not treat rejected as a global account state.',
    )

    assert.ok(
      userModel.includes(
        'hostAccessStatus',
      ),
    )
  },
)

/*
|--------------------------------------------------------------------------
| Public Registration
|--------------------------------------------------------------------------
*/

test(
  'public registration supports only Customer and Host account journeys',

  async () => {
    const challengeModel =
      await assertContains(
        'backend/src/modules/auth/verificationChallenge.model.js',

        [
          'PUBLIC_REGISTRATION_ACCOUNT_TYPES',
          "'customer'",
          "'host'",
        ],
      )

    assert.match(
      challengeModel,

      /PUBLIC_REGISTRATION_ACCOUNT_TYPES[\s\S]*?Object\.freeze\(\[\s*'customer',\s*'host',?\s*\]\)/,

      'Public registration account types must contain only Customer and Host.',
    )

    await assertContains(
      'backend/src/modules/auth/registration.service.js',

      [
        "case 'customer':",
        "case 'host':",
        'customerEnabled:',
        'hostEnabled:',
        'hostAccessStatus:',
        'superAdminEnabled:',
        'activeMode:',
      ],
    )

    await assertContains(
      'backend/src/modules/auth/registrationOtp.service.js',

      [
        'PUBLIC_REGISTRATION_ACCOUNT_TYPES',
        'accountType',
      ],
    )
  },
)

/*
|--------------------------------------------------------------------------
| Household Contract
|--------------------------------------------------------------------------
*/

test(
  'M02 household routes enforce active tenant authorization on protected reads and writes',

  async () => {
    const routes =
      await assertContains(
        'backend/src/modules/households/household.routes.js',

        [
          "'/me'",
          "'/me/members'",
          "'/:householdId'",
          "'/:householdId/members'",
          'loadHouseholdTenantFromParam',
          'requireHouseholdTenantRole',
          'requireCsrfToken',
          'requireActiveAccount',
        ],
      )

    assert.match(
      routes,

      /router\.get\(\s*'\/me',\s*authenticateSession,\s*loadCurrentUser,\s*requireActiveAccount,\s*getMyHouseholdController,/s,

      'GET /households/me must enforce active-account access.',
    )

    assert.match(
      routes,

      /router\.get\(\s*'\/me\/members',\s*authenticateSession,\s*loadCurrentUser,\s*requireActiveAccount,\s*getMyHouseholdMembersController,/s,

      'GET /households/me/members must enforce active-account access.',
    )

    await assertContains(
      'backend/src/modules/households/household.service.js',

      [
        'requireHouseholdMembershipAccess',
        'getCurrentHouseholdContext',
        'getHouseholdMembersForUser',
        'updateHouseholdForUser',
        'HOUSEHOLD_MEMBERSHIP_REQUIRED',
        'HOUSEHOLD_ROLE_REQUIRED',
      ],
    )
  },
)

/*
|--------------------------------------------------------------------------
| Profile + Preferences + Consent
|--------------------------------------------------------------------------
*/

test(
  'M02 account APIs expose profile, preferences and audited consent',

  async () => {
    await assertContains(
      'backend/src/modules/users/account.routes.js',

      [
        "'/profile'",
        "'/preferences'",
        "'/consents'",
        'requireCsrfToken',
        'authenticateSession',
      ],
    )

    await assertContains(
      'backend/src/modules/users/account.service.js',

      [
        'CURRENT_CONSENT_VERSIONS',
        'updateAccountProfile',
        'updateAccountPreferences',
        'recordAccountConsent',
        'personalizationEnabled',
      ],
    )

    await assertContains(
      'backend/src/modules/users/userConsent.model.js',

      [
        'USER_CONSENT_TYPES',
        'USER_CONSENT_DECISIONS',
        'recordedAt',
        'CONSENT_EVENT_IMMUTABLE',
      ],
    )

    await assertContains(
      'backend/src/modules/users/userPreference.model.js',

      [
        'dietaryLifestyles',
        'allergens',
        'preferredCuisines',
        'dislikedIngredients',
        'personalizationEnabled',
      ],
    )
  },
)

/*
|--------------------------------------------------------------------------
| Frontend MFA + Re-authentication
|--------------------------------------------------------------------------
*/

test(
  'M02 frontend contains login MFA, enrollment and reusable re-authentication services',

  async () => {
    const authService =
      await assertContains(
        'frontend/src/features/auth/services/auth.service.js',

        [
          'getMultiFactorResolver',
          'TotpMultiFactorGenerator',
          'completeMfaLogin',
          'cancelPendingMfaLogin',
        ],
      )

    const mfaService =
      await assertContains(
        'frontend/src/features/auth/services/mfa.service.js',

        [
          'generateSecret',
          'generateQrCodeUrl',
          'assertionForEnrollment',
          'createEpantrySession',
        ],
      )

    const reauthService =
      await assertContains(
        'frontend/src/features/auth/services/reauth.service.js',

        [
          'startSensitiveReauthentication',
          'completeSensitiveReauthenticationMfa',
          "'/auth/reauth'",
          'AUTH_IDENTITY_MISMATCH',
        ],
      )

    for (
      const source
      of [
        authService,
        mfaService,
        reauthService,
      ]
    ) {
      assert.equal(
        /localStorage\s*\./.test(
          source,
        ),

        false,

        'Auth credential/MFA services must not persist secrets or ID tokens in localStorage.',
      )

      assert.equal(
        /sessionStorage\s*\./.test(
          source,
        ),

        false,

        'Auth credential/MFA services must not persist secrets or ID tokens in sessionStorage.',
      )
    }

    await assertContains(
      'frontend/src/features/auth/pages/LoginPage.jsx',

      [
        'isMfaRequired',
        'completeMfaLogin',
        'verificationCode',
        'Back to password',
      ],
    )

    await assertContains(
      'frontend/src/features/auth/pages/MfaEnrollmentPage.jsx',

      [
        'startTotpEnrollment',
        'completeTotpEnrollment',
      ],
    )
  },
)

/*
|--------------------------------------------------------------------------
| Frontend Application Identity
|--------------------------------------------------------------------------
*/

test(
  'M02 frontend exposes account and household identity routes',

  async () => {
    await assertContains(
      'frontend/src/app/AppProviders.jsx',

      [
        'AuthProvider',
        'HouseholdProvider',
      ],
    )

    await assertContains(
      'frontend/src/routes/AppRoutes.jsx',

      [
        '/account/settings',
        '/account/security/mfa',
        '/account/household',
        'AuthenticatedRoute',
      ],
    )

    await assertContains(
      'frontend/src/features/households/context/HouseholdContext.jsx',

      [
        'getMyHousehold',
        'createHousehold',
        'loadMembers',
      ],
    )

    await assertContains(
      'frontend/src/features/account/pages/AccountSettingsPage.jsx',

      [
        'Profile & preferences',
        'Consent & privacy',
        'personalization',
      ],
    )
  },
)

/*
|--------------------------------------------------------------------------
| Frontend Session Hardening
|--------------------------------------------------------------------------
*/

test(
  'M02 frontend distinguishes credential-exchange 401 from expired-session 401',

  async () => {
    await assertContains(
      'frontend/src/api/apiClient.js',

      [
        'API_AUTH_SESSION_INVALIDATED_EVENT',
        'CREDENTIAL_EXCHANGE_PATHS',
        "'/auth/reauth'",
        'shouldInvalidateCurrentSession',
      ],
    )
  },
)

/*
|--------------------------------------------------------------------------
| TOTP QR Dependency
|--------------------------------------------------------------------------
*/

test(
  'M02 frontend includes QR generation dependency used by TOTP enrollment',

  async () => {
    const packageSource =
      await readProjectFile(
        'frontend/package.json',
      )

    const packageJson =
      JSON.parse(
        packageSource,
      )

    assert.ok(
      packageJson
        .dependencies
        ?.qrcode,

      'frontend/package.json must include qrcode for local TOTP QR rendering.',
    )
  },
)