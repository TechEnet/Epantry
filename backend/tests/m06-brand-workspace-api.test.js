import assert from 'node:assert/strict'

import fs from 'node:fs'

import test from 'node:test'

function readSource(
  relativePath,
) {
  return fs.readFileSync(
    new URL(
      `../src/${relativePath}`,
      import.meta.url,
    ),
    'utf8',
  )
}

/*
|--------------------------------------------------------------------------
| Source Contract Helpers
|--------------------------------------------------------------------------
|
| Governance assertions should inspect executable source, not documentation
| comments.
|
| Example:
|
|   "activeMode is NOT authority."
|
| is a valid security comment and must not be interpreted as runtime use of
| activeMode.
|--------------------------------------------------------------------------
*/

function stripSourceComments(
  source,
) {
  return source
    .replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    )
    .replace(
      /\/\/.*$/gm,
      '',
    )
}

test(
  'M06 application mounts Public Host and Admin Brand Authority surfaces separately',
  () => {
    const source =
      readSource(
        'app.js',
      )

    assert.match(
      source,
      /brandAuthorityPublicRoutes/,
    )

    assert.match(
      source,
      /brandAuthorityHostRoutes/,
    )

    assert.match(
      source,
      /brandAuthorityAdminRoutes/,
    )

    assert.match(
      source,
      /['"]\/api\/v1\/brands['"]/,
    )

    assert.match(
      source,
      /['"]\/api\/v1\/host['"]/,
    )

    assert.match(
      source,
      /['"]\/api\/v1\/admin['"]/,
    )
  },
)

test(
  'M06 Host Brand workspace requires session active account Host capability and MFA',
  () => {
    const source =
      readSource(
        'modules/brands/brandAuthority.host.routes.js',
      )

    assert.match(
      source,
      /authenticateSession/,
    )

    assert.match(
      source,
      /requireActiveAccount/,
    )

    assert.match(
      source,
      /requireHostAccess/,
    )

    assert.match(
      source,
      /requireMfaAssurance/,
    )
  },
)

test(
  'M06 Host Brand workspace does not grant Super Admin implicit tenant bypass',
  () => {
    const source =
      readSource(
        'modules/brands/brandAuthority.host.routes.js',
      )

    assert.doesNotMatch(
      source,
      /requireSuperAdmin/,
    )

    assert.doesNotMatch(
      source,
      /superAdminEnabled/,
    )
  },
)

test(
  'M06 exposes document-aligned Host Brand Claim endpoint',
  () => {
    const source =
      readSource(
        'modules/brands/brandAuthority.host.routes.js',
      )

    assert.match(
      source,
      /['"]\/brands\/:brandId\/claims['"]/,
    )

    assert.match(
      source,
      /createHostBrandClaimController/,
    )
  },
)

test(
  'M06 Host Brand Claim and Override mutations remain CSRF protected',
  () => {
    const source =
      readSource(
        'modules/brands/brandAuthority.host.routes.js',
      )

    assert.match(
      source,
      /requireCsrfToken/,
    )

    assert.match(
      source,
      /['"]\/brand-overrides['"]/,
    )

    assert.match(
      source,
      /['"]\/brand-overrides\/:id\/submit['"]/,
    )
  },
)

test(
  'M06 Host authority and proposal reads remain Organization scoped',
  () => {
    const source =
      readSource(
        'modules/brands/brandAuthority.workspace.service.js',
      )

    assert.match(
      source,
      /requireActiveHostMarketplaceOrganization/,
    )

    assert.match(
      source,
      /organizationId:\s*organization\._id/,
    )
  },
)

test(
  'M06 Admin Brand surface rejects privileged impersonation',
  () => {
    const source =
      readSource(
        'modules/brands/brandAuthority.admin.routes.js',
      )

    assert.match(
      source,
      /rejectPrivilegedImpersonation/,
    )
  },
)

test(
  'M06 Admin Brand reads require existing Catalog or Trust Safety permissions',
  () => {
    const source =
      readSource(
        'modules/brands/brandAuthority.admin.routes.js',
      )

    assert.match(
      source,
      /catalog\.read/,
    )

    assert.match(
      source,
      /trust_safety\.read/,
    )
  },
)

test(
  'M06 Brand verification mutations require Trust Safety mutation authority',
  () => {
    const source =
      readSource(
        'modules/brands/brandAuthority.admin.routes.js',
      )

    assert.match(
      source,
      /trust_safety\.mutate/,
    )

    assert.match(
      source,
      /requireBrandVerificationMutation/,
    )
  },
)

test(
  'M06 Admin Brand mutations require recent MFA and CSRF',
  () => {
    const source =
      readSource(
        'modules/brands/brandAuthority.admin.routes.js',
      )

    assert.match(
      source,
      /requireRecentMfaAuthentication/,
    )

    assert.match(
      source,
      /requireCsrfToken/,
    )
  },
)

test(
  'M06 exposes document-aligned Admin Brand Claim approval route',
  () => {
    const source =
      readSource(
        'modules/brands/brandAuthority.admin.routes.js',
      )

    assert.match(
      source,
      /['"]\/brand-claims\/:id\/approve['"]/,
    )

    assert.match(
      source,
      /approveAdminBrandClaimController/,
    )
  },
)

test(
  'M06 verified Host may create proposal but cannot approve its own Brand override',
  () => {
    const hostSource =
      readSource(
        'modules/brands/brandAuthority.host.routes.js',
      )

    assert.match(
      hostSource,
      /createHostContentOverrideController/,
    )

    assert.match(
      hostSource,
      /submitHostContentOverrideController/,
    )

    assert.doesNotMatch(
      hostSource,
      /reviewAdminContentOverrideController/,
    )
  },
)

test(
  'M06 critical content approval requires Trust Safety authority',
  () => {
    const source =
      readSource(
        'modules/brands/brandAuthority.api.controller.js',
      )

    assert.match(
      source,
      /BRAND_OVERRIDE_CRITICAL_TRUST_SAFETY_REQUIRED/,
    )

    assert.match(
      source,
      /trust_safety\.mutate/,
    )

    assert.match(
      source,
      /isCriticalBrandOverrideField/,
    )
  },
)

test(
  'M06 Admin exposes conflict queue and controlled conflict resolution',
  () => {
    const source =
      readSource(
        'modules/brands/brandAuthority.admin.routes.js',
      )

    assert.match(
      source,
      /['"]\/brand-conflicts['"]/,
    )

    assert.match(
      source,
      /['"]\/brand-conflicts\/:id\/resolve['"]/,
    )
  },
)

test(
  'M06 Brand APIs do not introduce Brand as a fourth top-level application role',
  () => {
    const files = [
      'modules/brands/brandAuthority.host.routes.js',

      'modules/brands/brandAuthority.admin.routes.js',

      'modules/brands/brandAuthority.api.controller.js',

      'modules/brands/brandAuthority.workspace.service.js',
    ]

    for (
      const file of
      files
    ) {
      const source =
        stripSourceComments(
          readSource(
            file,
          ),
        )

      assert.doesNotMatch(
        source,
        /\bactiveMode\b/,
        `${file} must not use activeMode as Brand authority`,
      )

      assert.doesNotMatch(
        source,
        /\baccountType\b/,
        `${file} must not introduce a legacy or fourth application role`,
      )
    }
  },
)

test(
  'M06 API integration never directly mutates existing ProductVersion',
  () => {
    const files = [
      'modules/brands/brandAuthority.api.controller.js',

      'modules/brands/brandAuthority.workspace.service.js',

      'modules/brands/brandAuthority.public.service.js',
    ]

    for (
      const file of
      files
    ) {
      const source =
        readSource(
          file,
        )

      assert.doesNotMatch(
        source,
        /ProductVersion\.(updateOne|updateMany|findOneAndUpdate|deleteOne|deleteMany|findByIdAndUpdate)/,
      )
    }
  },
)

test(
  'M06 Public Brand World remains separate from Host Brand authority writes',
  () => {
    const publicRoutes =
      readSource(
        'modules/brands/brandAuthority.public.routes.js',
      )

    const hostRoutes =
      readSource(
        'modules/brands/brandAuthority.host.routes.js',
      )

    assert.doesNotMatch(
      publicRoutes,
      /requireHostAccess/,
    )

    assert.match(
      hostRoutes,
      /requireHostAccess/,
    )
  },
)