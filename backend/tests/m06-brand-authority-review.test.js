import assert from 'node:assert/strict'

import fs from 'node:fs'

import test from 'node:test'

import {
  approveBrandClaimSchema,
  changeBrandAuthorityLifecycleSchema,
  reviewBrandIdentityCheckSchema,
} from '../src/modules/brands/brandAuthority.admin.validation.js'

import {
  buildActiveBrandAuthorityFilter,
  buildAdminBrandClaimFilter,
} from '../src/modules/brands/brandAuthority.admin.service.js'

const CLAIM_ID =
  '64c000000000000000000001'

const BRAND_ID =
  '64c000000000000000000002'

const ORGANIZATION_ID =
  '64c000000000000000000003'

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

test(
  'M06 admin evidence review accepts verified rejected and conflict decisions',
  () => {
    for (
      const decision of [
        'verified',
        'rejected',
        'conflict',
      ]
    ) {
      const result =
        reviewBrandIdentityCheckSchema.safeParse({
          decision,

          reason:
            'Verified against authoritative evidence.',
        })

      assert.equal(
        result.success,
        true,
      )
    }
  },
)

test(
  'M06 admin evidence review requires an explicit reason',
  () => {
    const result =
      reviewBrandIdentityCheckSchema.safeParse({
        decision:
          'verified',

        reason:
          '',
      })

    assert.equal(
      result.success,
      false,
    )
  },
)

test(
  'M06 authority approval requires explicit market and permission scopes',
  () => {
    const result =
      approveBrandClaimSchema.safeParse({
        marketCodes: [
          'IN',
        ],

        scopes: [
          'official_content',
        ],

        reason:
          'Ownership evidence verified.',
      })

    assert.equal(
      result.success,
      true,
    )
  },
)

test(
  'M06 authority approval rejects price as a Brand authority scope',
  () => {
    const result =
      approveBrandClaimSchema.safeParse({
        marketCodes: [
          'IN',
        ],

        scopes: [
          'price',
        ],

        reason:
          'Invalid commercial scope.',
      })

    assert.equal(
      result.success,
      false,
    )
  },
)

test(
  'M06 authority approval rejects reversed validity window',
  () => {
    const result =
      approveBrandClaimSchema.safeParse({
        marketCodes: [
          'IN',
        ],

        scopes: [
          'official_content',
        ],

        validFrom:
          '2026-08-22T10:00:00.000Z',

        validUntil:
          '2026-08-21T10:00:00.000Z',

        reason:
          'Invalid dates.',
      })

    assert.equal(
      result.success,
      false,
    )
  },
)

test(
  'M06 authority lifecycle allows only suspension or revocation',
  () => {
    assert.equal(
      changeBrandAuthorityLifecycleSchema.safeParse({
        action:
          'suspend',

        reason:
          'Authority requires further review.',
      }).success,
      true,
    )

    assert.equal(
      changeBrandAuthorityLifecycleSchema.safeParse({
        action:
          'activate',

        reason:
          'Client must not self activate.',
      }).success,
      false,
    )
  },
)

test(
  'M06 active authority filter is scoped by Brand and Host organization',
  () => {
    const at =
      new Date(
        '2026-08-22T10:00:00.000Z',
      )

    const filter =
      buildActiveBrandAuthorityFilter({
        brandId:
          BRAND_ID,

        organizationId:
          ORGANIZATION_ID,

        at,
      })

    assert.equal(
      filter.brandId,
      BRAND_ID,
    )

    assert.equal(
      filter.organizationId,
      ORGANIZATION_ID,
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
  'M06 admin Brand Claim filter does not depend on Host activeMode',
  () => {
    assert.deepEqual(
      buildAdminBrandClaimFilter({
        claimId:
          CLAIM_ID,
      }),
      {
        _id:
          CLAIM_ID,
      },
    )
  },
)

test(
  'M06 claim approval requires verified evidence before authority creation',
  () => {
    const source =
      readSource(
        'modules/brands/brandAuthority.admin.service.js',
      )

    assert.match(
      source,
      /BRAND_AUTHORITY_VERIFIED_EVIDENCE_REQUIRED/,
    )

    assert.match(
      source,
      /check\.status ===\s*'verified'/,
    )
  },
)

test(
  'M06 conflicting evidence blocks Brand authority grant',
  () => {
    const source =
      readSource(
        'modules/brands/brandAuthority.admin.service.js',
      )

    assert.match(
      source,
      /BRAND_AUTHORITY_EVIDENCE_CONFLICT/,
    )

    assert.match(
      source,
      /check\.status ===\s*'conflict'/,
    )
  },
)

test(
  'M06 admin cannot expand Brand authority beyond Host requested markets',
  () => {
    const source =
      readSource(
        'modules/brands/brandAuthority.admin.service.js',
      )

    assert.match(
      source,
      /BRAND_AUTHORITY_MARKET_SCOPE_EXCEEDED/,
    )

    assert.match(
      source,
      /ensureMarketSubset/,
    )
  },
)

test(
  'M06 Product Family restricted authority verifies canonical Brand ownership',
  () => {
    const source =
      readSource(
        'modules/brands/brandAuthority.admin.service.js',
      )

    assert.match(
      source,
      /ProductFamily\.find/,
    )

    assert.match(
      source,
      /brandId/,
    )

    assert.match(
      source,
      /BRAND_AUTHORITY_PRODUCT_FAMILY_SCOPE_INVALID/,
    )
  },
)

test(
  'M06 only review service creates verified BrandAuthorityGrant',
  () => {
    const adminSource =
      readSource(
        'modules/brands/brandAuthority.admin.service.js',
      )

    const hostSource =
      readSource(
        'modules/brands/brandAuthority.host.service.js',
      )

    assert.match(
      adminSource,
      /BrandAuthorityGrant\.create\s*\(/,
    )

    assert.doesNotMatch(
      hostSource,
      /BrandAuthorityGrant\.create\s*\(/,
    )
  },
)

test(
  'M06 Brand authority review does not mutate Customer Host Super Admin access model',
  () => {
    const source =
      readSource(
        'modules/brands/brandAuthority.admin.service.js',
      )

    assert.doesNotMatch(
      source,
      /activeMode/,
    )

    assert.doesNotMatch(
      source,
      /hostEnabled/,
    )

    assert.doesNotMatch(
      source,
      /superAdminEnabled/,
    )

    assert.doesNotMatch(
      source,
      /accountType/,
    )
  },
)