import assert from 'node:assert/strict'

import fs from 'node:fs'

import mongoose from 'mongoose'

import test from 'node:test'

import {
  BRAND_AUTHORITY_SCOPES,
  BRAND_CLAIM_TYPES,
  BRAND_OVERRIDE_CRITICAL_FIELD_KEYS,
  BRAND_OVERRIDE_FIELD_KEYS,
  normalizeBrandMarketCode,
} from '../src/modules/brands/brandAuthority.constants.js'

import {
  BrandAuthorityGrant,
  BrandClaim,
  ContentConflictCase,
  ContentOverrideProposal,
  TrademarkOrIdentityCheck,
} from '../src/modules/brands/brandAuthority.models.js'

function objectId() {
  return new mongoose.Types.ObjectId()
}

test(
  'M06 exposes owner licensee and distributor as brand claim relationships, not application roles',
  () => {
    assert.deepEqual(
      BRAND_CLAIM_TYPES,
      [
        'owner',
        'licensee',
        'distributor',
      ],
    )
  },
)

test(
  'M06 registers dedicated Brand Authority collections without duplicating canonical brands',
  () => {
    assert.equal(
      BrandClaim.collection.name,
      'brandClaims',
    )

    assert.equal(
      BrandAuthorityGrant.collection.name,
      'brandAuthorities',
    )

    assert.equal(
      TrademarkOrIdentityCheck.collection.name,
      'trademarkOrIdentityChecks',
    )

    assert.equal(
      ContentOverrideProposal.collection.name,
      'contentOverrideProposals',
    )

    assert.equal(
      ContentConflictCase.collection.name,
      'contentConflictCases',
    )
  },
)

test(
  'M06 Brand Claim references an existing canonical Brand and Host organization',
  () => {
    const claim =
      new BrandClaim({
        brandId:
          objectId(),

        organizationId:
          objectId(),

        claimType:
          'owner',

        requestedMarketCodes: [
          'IN',
        ],

        submittedByUserId:
          objectId(),
      })

    const error =
      claim.validateSync()

    assert.equal(
      error,
      undefined,
    )

    assert.ok(
      claim.brandId,
    )

    assert.ok(
      claim.organizationId,
    )
  },
)

test(
  'M06 Brand Claim rejects invalid market scope instead of guessing geography',
  () => {
    const claim =
      new BrandClaim({
        brandId:
          objectId(),

        organizationId:
          objectId(),

        claimType:
          'owner',

        requestedMarketCodes: [
          'india',
        ],

        submittedByUserId:
          objectId(),
      })

    const error =
      claim.validateSync()

    assert.ok(
      error?.errors
        ?.requestedMarketCodes,
    )
  },
)

test(
  'M06 market code normalization is deterministic',
  () => {
    assert.equal(
      normalizeBrandMarketCode(
        ' in ',
      ),
      'IN',
    )
  },
)

test(
  'M06 identity evidence stores references and verification state without embedding uploaded binaries',
  () => {
    const check =
      new TrademarkOrIdentityCheck({
        brandId:
          objectId(),

        organizationId:
          objectId(),

        checkType:
          'trademark',

        evidenceReference:
          'asset-or-authoritative-source-reference',

        sourceAuthority:
          'Trademark authority',

        createdByUserId:
          objectId(),
      })

    const error =
      check.validateSync()

    assert.equal(
      error,
      undefined,
    )

    assert.equal(
      TrademarkOrIdentityCheck.schema.path(
        'binary',
      ),
      undefined,
    )

    assert.equal(
      TrademarkOrIdentityCheck.schema.path(
        'fileBuffer',
      ),
      undefined,
    )
  },
)

test(
  'M06 Brand Authority requires explicit markets and authority scopes',
  () => {
    const authority =
      new BrandAuthorityGrant({
        brandId:
          objectId(),

        organizationId:
          objectId(),

        claimId:
          objectId(),

        authorityType:
          'owner',

        marketCodes: [
          'IN',
        ],

        scopes: [
          'official_content',
        ],

        validFrom:
          new Date(),

        grantedByUserId:
          objectId(),
      })

    const error =
      authority.validateSync()

    assert.equal(
      error,
      undefined,
    )
  },
)

test(
  'M06 Brand Authority supports product-family restricted authority',
  () => {
    const familyId =
      objectId()

    const authority =
      new BrandAuthorityGrant({
        brandId:
          objectId(),

        organizationId:
          objectId(),

        claimId:
          objectId(),

        authorityType:
          'licensee',

        marketCodes: [
          'IN',
        ],

        productFamilyIds: [
          familyId,
        ],

        scopes: [
          'packaging_media',
        ],

        validFrom:
          new Date(),

        grantedByUserId:
          objectId(),
      })

    const error =
      authority.validateSync()

    assert.equal(
      error,
      undefined,
    )

    assert.equal(
      String(
        authority.productFamilyIds[0],
      ),
      String(
        familyId,
      ),
    )
  },
)

test(
  'M06 authority scopes do not provide direct commercial price or inventory authority',
  () => {
    assert.equal(
      BRAND_AUTHORITY_SCOPES.includes(
        'price',
      ),
      false,
    )

    assert.equal(
      BRAND_AUTHORITY_SCOPES.includes(
        'inventory',
      ),
      false,
    )

    assert.equal(
      BRAND_AUTHORITY_SCOPES.includes(
        'serviceability',
      ),
      false,
    )
  },
)

test(
  'M06 Content Override accepts governed canonical field proposal',
  () => {
    const proposal =
      new ContentOverrideProposal({
        brandId:
          objectId(),

        organizationId:
          objectId(),

        authorityGrantId:
          objectId(),

        productFamilyId:
          objectId(),

        productVariantId:
          objectId(),

        packId:
          objectId(),

        baseProductVersionId:
          objectId(),

        marketCodes: [
          'IN',
        ],

        fieldChanges: [
          {
            fieldKey:
              'ingredient_declaration',

            proposedValue:
              'Milk, sugar',

            changeReason:
              'Updated manufacturer label evidence.',
          },
        ],

        submittedByUserId:
          objectId(),
      })

    const error =
      proposal.validateSync()

    assert.equal(
      error,
      undefined,
    )
  },
)

test(
  'M06 Content Override cannot propose price through governed field keys',
  () => {
    assert.equal(
      BRAND_OVERRIDE_FIELD_KEYS.includes(
        'price',
      ),
      false,
    )

    const proposal =
      new ContentOverrideProposal({
        brandId:
          objectId(),

        organizationId:
          objectId(),

        authorityGrantId:
          objectId(),

        productFamilyId:
          objectId(),

        productVariantId:
          objectId(),

        packId:
          objectId(),

        baseProductVersionId:
          objectId(),

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

        submittedByUserId:
          objectId(),
      })

    const error =
      proposal.validateSync()

    assert.ok(
      error?.errors[
        'fieldChanges.0.fieldKey'
      ],
    )
  },
)

test(
  'M06 Content Override cannot propose stock or serviceability as canonical Product truth',
  () => {
    assert.equal(
      BRAND_OVERRIDE_FIELD_KEYS.includes(
        'stock',
      ),
      false,
    )

    assert.equal(
      BRAND_OVERRIDE_FIELD_KEYS.includes(
        'inventory',
      ),
      false,
    )

    assert.equal(
      BRAND_OVERRIDE_FIELD_KEYS.includes(
        'serviceability',
      ),
      false,
    )
  },
)

test(
  'M06 Content Override requires immutable base ProductVersion identity',
  () => {
    assert.ok(
      ContentOverrideProposal.schema.path(
        'baseProductVersionId',
      ),
    )

    assert.ok(
      ContentOverrideProposal.schema.path(
        'activatedProductVersionId',
      ),
    )

    assert.equal(
      ContentOverrideProposal.schema.path(
        'productVersionData',
      ),
      undefined,
    )
  },
)

test(
  'M06 marks safety and regulated Product fields as critical override fields',
  () => {
    assert.ok(
      BRAND_OVERRIDE_CRITICAL_FIELD_KEYS.includes(
        'allergens',
      ),
    )

    assert.ok(
      BRAND_OVERRIDE_CRITICAL_FIELD_KEYS.includes(
        'ingredient_declaration',
      ),
    )

    assert.ok(
      BRAND_OVERRIDE_CRITICAL_FIELD_KEYS.includes(
        'nutrition',
      ),
    )
  },
)

test(
  'M06 Content Conflict Case supports safety-critical review instead of automatic winner selection',
  () => {
    const conflict =
      new ContentConflictCase({
        brandId:
          objectId(),

        productFamilyId:
          objectId(),

        packId:
          objectId(),

        baseProductVersionId:
          objectId(),

        proposalIds: [
          objectId(),
        ],

        fieldKeys: [
          'allergens',
        ],

        severity:
          'safety_critical',

        openedReason:
          'Brand evidence conflicts with current verified label evidence.',

        openedByUserId:
          objectId(),
      })

    const error =
      conflict.validateSync()

    assert.equal(
      error,
      undefined,
    )

    assert.equal(
      conflict.status,
      'open',
    )
  },
)

test(
  'M06 Brand Authority models do not create a new top-level role or activeMode authority',
  () => {
    const source =
      fs.readFileSync(
        new URL(
          '../src/modules/brands/brandAuthority.models.js',
          import.meta.url,
        ),
        'utf8',
      )

    assert.doesNotMatch(
      source,
      /accountType/,
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
      /hostEnabled/,
    )
  },
)