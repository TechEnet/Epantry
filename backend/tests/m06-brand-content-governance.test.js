import assert from 'node:assert/strict'

import fs from 'node:fs'

import test from 'node:test'

import {
  createContentOverrideProposalSchema,
  resolveContentConflictSchema,
  reviewContentOverrideProposalSchema,
} from '../src/modules/brands/brandAuthority.override.validation.js'

import {
  buildActiveOwnedBrandAuthorityFilter,
  buildApprovedCanonicalOverrideRequest,
  buildOwnedContentOverrideFilter,
  isCriticalBrandOverrideField,
  requiredBrandAuthorityScopeForField,
} from '../src/modules/brands/brandAuthority.override.service.js'

const AUTHORITY_ID =
  '64d000000000000000000001'

const ORGANIZATION_ID =
  '64d000000000000000000002'

const FAMILY_ID =
  '64d000000000000000000003'

const VARIANT_ID =
  '64d000000000000000000004'

const PACK_ID =
  '64d000000000000000000005'

const VERSION_ID =
  '64d000000000000000000006'

const PROPOSAL_ID =
  '64d000000000000000000007'

const EVIDENCE_ID =
  '64d000000000000000000008'

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
  'M06 Brand override accepts governed canonical content proposal',
  () => {
    const result =
      createContentOverrideProposalSchema.safeParse({
        authorityGrantId:
          AUTHORITY_ID,

        productFamilyId:
          FAMILY_ID,

        productVariantId:
          VARIANT_ID,

        packId:
          PACK_ID,

        baseProductVersionId:
          VERSION_ID,

        marketCodes: [
          'IN',
        ],

        fieldChanges: [
          {
            fieldKey:
              'description',

            proposedValue:
              'Official Brand description.',

            changeReason:
              'Updated official content.',
          },
        ],
      })

    assert.equal(
      result.success,
      true,
    )
  },
)

test(
  'M06 Brand override rejects commercial price field',
  () => {
    const result =
      createContentOverrideProposalSchema.safeParse({
        authorityGrantId:
          AUTHORITY_ID,

        productFamilyId:
          FAMILY_ID,

        productVariantId:
          VARIANT_ID,

        packId:
          PACK_ID,

        baseProductVersionId:
          VERSION_ID,

        marketCodes: [
          'IN',
        ],

        fieldChanges: [
          {
            fieldKey:
              'price',

            proposedValue:
              100,

            changeReason:
              'Invalid commercial mutation.',
          },
        ],
      })

    assert.equal(
      result.success,
      false,
    )
  },
)

test(
  'M06 Brand override rejects duplicate canonical field changes',
  () => {
    const result =
      createContentOverrideProposalSchema.safeParse({
        authorityGrantId:
          AUTHORITY_ID,

        productFamilyId:
          FAMILY_ID,

        productVariantId:
          VARIANT_ID,

        packId:
          PACK_ID,

        baseProductVersionId:
          VERSION_ID,

        marketCodes: [
          'IN',
        ],

        fieldChanges: [
          {
            fieldKey:
              'description',

            proposedValue:
              'One',

            changeReason:
              'First description.',
          },

          {
            fieldKey:
              'description',

            proposedValue:
              'Two',

            changeReason:
              'Second description.',
          },
        ],
      })

    assert.equal(
      result.success,
      false,
    )
  },
)

test(
  'M06 regulated nutrition field requires regulated_facts authority',
  () => {
    assert.equal(
      requiredBrandAuthorityScopeForField(
        'nutrition',
      ),
      'regulated_facts',
    )
  },
)

test(
  'M06 claims and certifications require claims_certifications authority',
  () => {
    assert.equal(
      requiredBrandAuthorityScopeForField(
        'claims',
      ),
      'claims_certifications',
    )

    assert.equal(
      requiredBrandAuthorityScopeForField(
        'certifications',
      ),
      'claims_certifications',
    )
  },
)

test(
  'M06 packaging media uses separate Brand authority scope',
  () => {
    assert.equal(
      requiredBrandAuthorityScopeForField(
        'pack_images',
      ),
      'packaging_media',
    )
  },
)

test(
  'M06 allergen nutrition ingredient and net quantity fields remain critical',
  () => {
    for (
      const fieldKey of [
        'allergens',
        'nutrition',
        'ingredient_declaration',
        'net_quantity',
      ]
    ) {
      assert.equal(
        isCriticalBrandOverrideField(
          fieldKey,
        ),
        true,
      )
    }
  },
)

test(
  'M06 owned content proposal filter is Host Organization scoped',
  () => {
    assert.deepEqual(
      buildOwnedContentOverrideFilter({
        proposalId:
          PROPOSAL_ID,

        organizationId:
          ORGANIZATION_ID,
      }),
      {
        _id:
          PROPOSAL_ID,

        organizationId:
          ORGANIZATION_ID,
      },
    )
  },
)

test(
  'M06 active Brand authority filter is Organization scoped and effective dated',
  () => {
    const at =
      new Date(
        '2026-08-22T10:00:00.000Z',
      )

    const filter =
      buildActiveOwnedBrandAuthorityFilter({
        authorityGrantId:
          AUTHORITY_ID,

        organizationId:
          ORGANIZATION_ID,

        at,
      })

    assert.equal(
      filter._id,
      AUTHORITY_ID,
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
  'M06 critical proposal evidence must already be verified',
  () => {
    const source =
      readSource(
        'modules/brands/brandAuthority.override.service.js',
      )

    assert.match(
      source,
      /BRAND_OVERRIDE_CRITICAL_EVIDENCE_REQUIRED/,
    )

    assert.match(
      source,
      /status:\s*'verified'/,
    )

    assert.match(
      source,
      /BRAND_OVERRIDE_EVIDENCE_NOT_VERIFIED/,
    )
  },
)

test(
  'M06 content proposal validates canonical Brand Family Variant Pack chain',
  () => {
    const source =
      readSource(
        'modules/brands/brandAuthority.override.service.js',
      )

    assert.match(
      source,
      /ProductFamily\.findOne/,
    )

    assert.match(
      source,
      /ProductVariant\.findOne/,
    )

    assert.match(
      source,
      /Pack\.findOne/,
    )

    assert.match(
      source,
      /ProductVersion\.findOne/,
    )
  },
)

test(
  'M06 content proposal base version must be published canonical truth',
  () => {
    const source =
      readSource(
        'modules/brands/brandAuthority.override.service.js',
      )

    assert.match(
      source,
      /status:\s*'published'/,
    )

    assert.match(
      source,
      /BRAND_OVERRIDE_BASE_VERSION_INVALID/,
    )
  },
)

test(
  'M06 admin content review supports approve reject and conflict decisions',
  () => {
    for (
      const decision of [
        'approve',
        'reject',
        'conflict',
      ]
    ) {
      assert.equal(
        reviewContentOverrideProposalSchema.safeParse({
          decision,

          reason:
            'Governed review decision.',
        }).success,
        true,
      )
    }
  },
)

test(
  'M06 conflict resolution requires selected proposal when approving',
  () => {
    assert.equal(
      resolveContentConflictSchema.safeParse({
        resolution:
          'approve_proposal',

        reason:
          'Evidence selected.',
      }).success,
      false,
    )

    assert.equal(
      resolveContentConflictSchema.safeParse({
        resolution:
          'approve_proposal',

        selectedProposalId:
          PROPOSAL_ID,

        reason:
          'Evidence selected.',
      }).success,
      true,
    )
  },
)

test(
  'M06 conflict workflow supports quarantine for unresolved safety evidence',
  () => {
    const result =
      resolveContentConflictSchema.safeParse({
        resolution:
          'quarantine',

        reason:
          'Safety evidence remains contradictory.',
      })

    assert.equal(
      result.success,
      true,
    )
  },
)

test(
  'M06 approved Brand proposal builds M04 canonical versioning handoff without commercial state',
  () => {
    const request =
      buildApprovedCanonicalOverrideRequest({
        _id:
          PROPOSAL_ID,

        status:
          'approved',

        brandId:
          '64d000000000000000000009',

        organizationId:
          ORGANIZATION_ID,

        authorityGrantId:
          AUTHORITY_ID,

        productFamilyId:
          FAMILY_ID,

        productVariantId:
          VARIANT_ID,

        packId:
          PACK_ID,

        baseProductVersionId:
          VERSION_ID,

        requestedEffectiveFrom:
          null,

        fieldChanges: [
          {
            fieldKey:
              'allergens',

            proposedValue: [
              'milk',
            ],

            changeReason:
              'Verified label update.',

            evidenceCheckIds: [
              EVIDENCE_ID,
            ],
          },
        ],
      })

    assert.equal(
      request.baseProductVersionId,
      VERSION_ID,
    )

    assert.equal(
      request.changes[0].fieldKey,
      'allergens',
    )

    assert.equal(
      request.provenance.sourceType,
      'verified_brand_authority',
    )

    assert.equal(
      Object.hasOwn(
        request,
        'price',
      ),
      false,
    )

    assert.equal(
      Object.hasOwn(
        request,
        'inventory',
      ),
      false,
    )
  },
)

test(
  'M06 canonical handoff refuses unapproved proposal',
  () => {
    assert.throws(
      () =>
        buildApprovedCanonicalOverrideRequest({
          status:
            'submitted',
        }),
      /Only an approved Brand Content Override Proposal/,
    )
  },
)

test(
  'M06 override service never directly updates or deletes ProductVersion',
  () => {
    const source =
      readSource(
        'modules/brands/brandAuthority.override.service.js',
      )

    assert.doesNotMatch(
      source,
      /ProductVersion\.(updateOne|updateMany|findOneAndUpdate|deleteOne|deleteMany|findByIdAndUpdate)/,
    )
  },
)

test(
  'M06 Brand override service does not mutate M05 price inventory or serviceability models',
  () => {
    const source =
      readSource(
        'modules/brands/brandAuthority.override.service.js',
      )

    assert.doesNotMatch(
      source,
      /PriceRule|InventorySnapshot|ServiceArea|HostOffer/,
    )
  },
)

test(
  'M06 Brand override authority remains separate from Customer Host Super Admin application roles',
  () => {
    const source =
      readSource(
        'modules/brands/brandAuthority.override.service.js',
      )

    assert.doesNotMatch(
      source,
      /activeMode/,
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