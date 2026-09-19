import assert from 'node:assert/strict'

import fs from 'node:fs'

import test from 'node:test'

import {
  isAdminActionMakerCheckerReady,
} from '../src/modules/admin/adminSafety.registry.js'

import {
  buildActiveOwnedBrandAuthorityFilter,
  buildOwnedContentOverrideFilter,
} from '../src/modules/brands/brandAuthority.override.service.js'

import {
  buildOwnedBrandClaimFilter,
  buildOwnedBrandIdentityCheckFilter,
} from '../src/modules/brands/brandAuthority.host.service.js'

function readBackendFile(
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

function readFrontendFile(
  relativePath,
) {
  return fs.readFileSync(
    new URL(
      `../../frontend/${relativePath}`,
      import.meta.url,
    ),
    'utf8',
  )
}

function stripComments(
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
  'M06 freeze keeps Brand World on the canonical M04 Product graph',
  () => {
    const source =
      readBackendFile(
        'modules/brands/brandAuthority.public.service.js',
      )

    assert.match(
      source,
      /ProductFamily/,
    )

    assert.match(
      source,
      /ProductVariant/,
    )

    assert.match(
      source,
      /Pack/,
    )

    assert.match(
      source,
      /ProductVersion/,
    )
  },
)

test(
  'M06 freeze keeps Public Brand routes read-only and unauthenticated',
  () => {
    const source =
      readBackendFile(
        'modules/brands/brandAuthority.public.routes.js',
      )

    assert.match(
      source,
      /router\.get/,
    )

    assert.doesNotMatch(
      source,
      /router\.(post|patch|delete)/,
    )

    assert.doesNotMatch(
      source,
      /authenticateSession/,
    )
  },
)

test(
  'M06 freeze keeps Host Brand workspace behind active Host capability and MFA',
  () => {
    const source =
      readBackendFile(
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
  'M06 freeze keeps Brand Claim and identity evidence ownership Host scoped',
  () => {
    assert.deepEqual(
      buildOwnedBrandClaimFilter({
        claimId:
          'claim-a',

        organizationId:
          'organization-a',
      }),
      {
        _id:
          'claim-a',

        organizationId:
          'organization-a',
      },
    )

    assert.deepEqual(
      buildOwnedBrandIdentityCheckFilter({
        checkId:
          'check-a',

        organizationId:
          'organization-a',
      }),
      {
        _id:
          'check-a',

        organizationId:
          'organization-a',
      },
    )
  },
)

test(
  'M06 freeze keeps Content Override ownership Host Organization scoped',
  () => {
    assert.deepEqual(
      buildOwnedContentOverrideFilter({
        proposalId:
          'proposal-a',

        organizationId:
          'organization-a',
      }),
      {
        _id:
          'proposal-a',

        organizationId:
          'organization-a',
      },
    )
  },
)

test(
  'M06 freeze requires effective active authority for Host content proposal',
  () => {
    const at =
      new Date(
        '2026-08-22T10:00:00.000Z',
      )

    const filter =
      buildActiveOwnedBrandAuthorityFilter({
        authorityGrantId:
          'authority-a',

        organizationId:
          'organization-a',

        at,
      })

    assert.equal(
      filter._id,
      'authority-a',
    )

    assert.equal(
      filter.organizationId,
      'organization-a',
    )

    assert.equal(
      filter.status,
      'active',
    )

    assert.deepEqual(
      filter.validFrom,
      {
        $lte:
          at,
      },
    )
  },
)

test(
  'M06 freeze records privileged Brand governance through immutable admin audit service',
  () => {
    const source =
      readBackendFile(
        'modules/brands/brandAuthority.api.controller.js',
      )

    assert.match(
      source,
      /recordAdminAuditEvent/,
    )

    assert.match(
      source,
      /beforeSnapshot/,
    )

    assert.match(
      source,
      /afterSnapshot/,
    )

    assert.match(
      source,
      /requestId/,
    )
  },
)

test(
  'M06 freeze uses controlled Trust Safety and Catalog audit reasons',
  () => {
    const source =
      readBackendFile(
        'modules/brands/brandAuthority.api.controller.js',
      )

    assert.match(
      source,
      /trust_safety\.enforcement/,
    )

    assert.match(
      source,
      /catalog\.governance/,
    )
  },
)

test(
  'M06 freeze marks Trust Safety mutation dual-control ready',
  () => {
    assert.equal(
      isAdminActionMakerCheckerReady(
        'trust_safety.mutate',
      ),
      true,
    )
  },
)

test(
  'M06 freeze enforces distinct proposer and checker for critical Brand approval',
  () => {
    const source =
      readBackendFile(
        'modules/brands/brandAuthority.api.controller.js',
      )

    assert.match(
      source,
      /assertDistinctMakerCheckerActors/,
    )

    assert.match(
      source,
      /submittedByUserId/,
    )

    assert.match(
      source,
      /BRAND_OVERRIDE_CRITICAL_TRUST_SAFETY_REQUIRED/,
    )
  },
)

test(
  'M06 freeze keeps Brand content proposal separate from direct ProductVersion mutation',
  () => {
    const files = [
      'modules/brands/brandAuthority.api.controller.js',
      'modules/brands/brandAuthority.override.service.js',
      'modules/brands/brandAuthority.workspace.service.js',
      'modules/brands/brandAuthority.public.service.js',
    ]

    for (
      const file of
      files
    ) {
      const source =
        readBackendFile(
          file,
        )

      assert.doesNotMatch(
        source,
        /ProductVersion\.(updateOne|updateMany|findOneAndUpdate|findByIdAndUpdate|deleteOne|deleteMany)/,
      )
    }
  },
)

test(
  'M06 freeze keeps M05 commercial models outside Brand canonical override flow',
  () => {
    const source =
      readBackendFile(
        'modules/brands/brandAuthority.override.service.js',
      )

    assert.doesNotMatch(
      source,
      /\bPriceRule\b/,
    )

    assert.doesNotMatch(
      source,
      /\bInventorySnapshot\b/,
    )

    assert.doesNotMatch(
      source,
      /\bServiceArea\b/,
    )

    assert.doesNotMatch(
      source,
      /\bHostOffer\b/,
    )
  },
)

test(
  'M06 freeze does not create Brand as a fourth application role',
  () => {
    const files = [
      'modules/brands/brandAuthority.api.controller.js',
      'modules/brands/brandAuthority.host.routes.js',
      'modules/brands/brandAuthority.admin.routes.js',
      'modules/brands/brandAuthority.workspace.service.js',
    ]

    for (
      const file of
      files
    ) {
      const source =
        stripComments(
          readBackendFile(
            file,
          ),
        )

      assert.doesNotMatch(
        source,
        /\bactiveMode\b/,
      )

      assert.doesNotMatch(
        source,
        /\baccountType\b/,
      )

      assert.doesNotMatch(
        source,
        /\bbrandEnabled\b/,
      )
    }
  },
)

test(
  'M06 freeze keeps Super Admin from receiving implicit Host Brand tenant bypass',
  () => {
    const files = [
      'modules/brands/brandAuthority.host.routes.js',
      'modules/brands/brandAuthority.host.service.js',
      'modules/brands/brandAuthority.override.service.js',
      'modules/brands/brandAuthority.workspace.service.js',
    ]

    for (
      const file of
      files
    ) {
      const source =
        readBackendFile(
          file,
        )

      assert.doesNotMatch(
        source,
        /requireSuperAdmin/,
      )

      assert.doesNotMatch(
        source,
        /superAdminEnabled/,
      )
    }
  },
)

test(
  'M06 freeze exposes Public Host and Admin frontend route trees separately',
  () => {
    const source =
      readFrontendFile(
        'src/routes/AppRoutes.jsx',
      )

    assert.match(
      source,
      /path="\/brands"/,
    )

    assert.match(
      source,
      /path="\/brands\/:brandKey"/,
    )

    assert.match(
      source,
      /path="\/host\/brands"/,
    )

    assert.match(
      source,
      /path="\/admin\/brands"/,
    )
  },
)

test(
  'M06 freeze keeps frontend Host Brand authorization capability based',
  () => {
    const source =
      stripComments(
        readFrontendFile(
          'src/routes/AppRoutes.jsx',
        ),
      )

    assert.match(
      source,
      /APPLICATION_ACCESS_TYPES\.HOST/,
    )

    assert.match(
      source,
      /hostEnabled/,
    )

    assert.doesNotMatch(
      source,
      /\bactiveMode\b/,
    )
  },
)