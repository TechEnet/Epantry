import assert from 'node:assert/strict'

import fs from 'node:fs'

import test from 'node:test'

import {
  createBrandClaimSchema,
  createBrandIdentityCheckSchema,
} from '../src/modules/brands/brandAuthority.host.validation.js'

import {
  buildOwnedBrandClaimFilter,
  buildOwnedBrandIdentityCheckFilter,
} from '../src/modules/brands/brandAuthority.host.service.js'

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

const BRAND_ID =
  '64b000000000000000000001'

const CHECK_ID =
  '64b000000000000000000002'

const CLAIM_ID =
  '64b000000000000000000003'

const ORGANIZATION_ID =
  '64b000000000000000000004'

test(
  'M06 Host accepts valid Brand identity evidence metadata',
  () => {
    const result =
      createBrandIdentityCheckSchema.safeParse({
        brandId:
          BRAND_ID,

        checkType:
          'trademark',

        evidenceReference:
          'controlled-asset-reference',

        evidenceSummary:
          'Trademark certificate metadata.',

        sourceAuthority:
          'Trademark Registry',
      })

    assert.equal(
      result.success,
      true,
    )
  },
)

test(
  'M06 Host identity evidence cannot inject Organization ownership',
  () => {
    const result =
      createBrandIdentityCheckSchema.safeParse({
        brandId:
          BRAND_ID,

        organizationId:
          ORGANIZATION_ID,

        checkType:
          'trademark',

        evidenceReference:
          'controlled-asset-reference',
      })

    assert.equal(
      result.success,
      false,
    )
  },
)

test(
  'M06 Host identity evidence cannot self-verify status or reviewer',
  () => {
    const result =
      createBrandIdentityCheckSchema.safeParse({
        brandId:
          BRAND_ID,

        checkType:
          'trademark',

        evidenceReference:
          'controlled-asset-reference',

        status:
          'verified',

        checkedByUserId:
          CLAIM_ID,
      })

    assert.equal(
      result.success,
      false,
    )
  },
)

test(
  'M06 Host identity evidence rejects reversed effective date window',
  () => {
    const result =
      createBrandIdentityCheckSchema.safeParse({
        brandId:
          BRAND_ID,

        checkType:
          'authorization_letter',

        evidenceReference:
          'controlled-asset-reference',

        effectiveFrom:
          '2026-08-22T10:00:00.000Z',

        effectiveTo:
          '2026-08-21T10:00:00.000Z',
      })

    assert.equal(
      result.success,
      false,
    )
  },
)

test(
  'M06 Host Brand Claim accepts explicit markets and evidence',
  () => {
    const result =
      createBrandClaimSchema.safeParse({
        brandId:
          BRAND_ID,

        claimType:
          'owner',

        requestedMarketCodes: [
          'in',
          ' IN ',
        ],

        evidenceCheckIds: [
          CHECK_ID,
        ],

        statement:
          'We are the Brand owner for India.',
      })

    assert.equal(
      result.success,
      true,
    )

    assert.deepEqual(
      result.data.requestedMarketCodes,
      [
        'IN',
      ],
    )
  },
)

test(
  'M06 Host Brand Claim requires at least one verification evidence record',
  () => {
    const result =
      createBrandClaimSchema.safeParse({
        brandId:
          BRAND_ID,

        claimType:
          'owner',

        requestedMarketCodes: [
          'IN',
        ],

        evidenceCheckIds:
          [],
      })

    assert.equal(
      result.success,
      false,
    )
  },
)

test(
  'M06 Host Brand Claim cannot inject Organization ownership',
  () => {
    const result =
      createBrandClaimSchema.safeParse({
        brandId:
          BRAND_ID,

        organizationId:
          ORGANIZATION_ID,

        claimType:
          'owner',

        requestedMarketCodes: [
          'IN',
        ],

        evidenceCheckIds: [
          CHECK_ID,
        ],
      })

    assert.equal(
      result.success,
      false,
    )
  },
)

test(
  'M06 Host Brand Claim cannot self-verify or grant Brand authority',
  () => {
    const result =
      createBrandClaimSchema.safeParse({
        brandId:
          BRAND_ID,

        claimType:
          'owner',

        requestedMarketCodes: [
          'IN',
        ],

        evidenceCheckIds: [
          CHECK_ID,
        ],

        status:
          'verified',

        authorityGrantId:
          CLAIM_ID,
      })

    assert.equal(
      result.success,
      false,
    )
  },
)

test(
  'M06 private Brand Claim filter always scopes resource by Host Organization',
  () => {
    assert.deepEqual(
      buildOwnedBrandClaimFilter({
        claimId:
          CLAIM_ID,

        organizationId:
          ORGANIZATION_ID,
      }),
      {
        _id:
          CLAIM_ID,

        organizationId:
          ORGANIZATION_ID,
      },
    )
  },
)

test(
  'M06 private identity evidence filter always scopes resource by Host Organization',
  () => {
    assert.deepEqual(
      buildOwnedBrandIdentityCheckFilter({
        checkId:
          CHECK_ID,

        organizationId:
          ORGANIZATION_ID,
      }),
      {
        _id:
          CHECK_ID,

        organizationId:
          ORGANIZATION_ID,
      },
    )
  },
)

test(
  'M06 Host Brand service derives tenant from active Host Marketplace Organization',
  () => {
    const source =
      readSource(
        'modules/brands/brandAuthority.host.service.js',
      )

    assert.match(
      source,
      /requireActiveHostMarketplaceOrganization/,
    )

    assert.match(
      source,
      /organization\._id/,
    )
  },
)

test(
  'M06 Host Brand service requires existing canonical M04 Brand',
  () => {
    const source =
      readSource(
        'modules/brands/brandAuthority.host.service.js',
      )

    assert.match(
      source,
      /Brand\.findById/,
    )

    assert.match(
      source,
      /BRAND_AUTHORITY_BRAND_NOT_FOUND/,
    )
  },
)

test(
  'M06 claim evidence must belong to the same Brand and Host Organization',
  () => {
    const source =
      readSource(
        'modules/brands/brandAuthority.host.service.js',
      )

    assert.match(
      source,
      /brandId,/,
    )

    assert.match(
      source,
      /organizationId,/,
    )

    assert.match(
      source,
      /evidenceCheckIds/,
    )

    assert.match(
      source,
      /BRAND_AUTHORITY_EVIDENCE_NOT_FOUND/,
    )
  },
)

test(
  'M06 Host cannot create BrandAuthorityGrant through Brand Claim service',
  () => {
    const source =
      readSource(
        'modules/brands/brandAuthority.host.service.js',
      )

    assert.doesNotMatch(
      source,
      /BrandAuthorityGrant\.create\s*\(/,
    )

    assert.doesNotMatch(
      source,
      /BrandAuthorityGrant\.findOneAndUpdate\s*\(/,
    )
  },
)

test(
  'M06 Host Brand Claim service introduces no Super Admin tenant bypass or activeMode authority',
  () => {
    const source =
      readSource(
        'modules/brands/brandAuthority.host.service.js',
      )

    assert.doesNotMatch(
      source,
      /superAdminEnabled/,
    )

    assert.doesNotMatch(
      source,
      /requireSuperAdmin/,
    )

    assert.doesNotMatch(
      source,
      /activeMode/,
    )
  },
)

test(
  'M06 Brand Claim input cannot mutate M05 price inventory or serviceability',
  () => {
    const source =
      readSource(
        'modules/brands/brandAuthority.host.validation.js',
      )

    assert.doesNotMatch(
      source,
      /listPrice|salePrice|availableQuantity|reservedQuantity/,
    )

    assert.doesNotMatch(
      source,
      /serviceAreaId|inventoryNodeId/,
    )
  },
)