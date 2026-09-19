import mongoose from 'mongoose'

import {
  BRAND_AUTHORITY_SCOPES,
  BRAND_AUTHORITY_STATUSES,
  BRAND_CLAIM_STATUSES,
  BRAND_CLAIM_TYPES,
  BRAND_CONFLICT_SEVERITIES,
  BRAND_CONFLICT_STATUSES,
  BRAND_IDENTITY_CHECK_STATUSES,
  BRAND_IDENTITY_CHECK_TYPES,
  BRAND_OVERRIDE_FIELD_KEYS,
  BRAND_OVERRIDE_STATUSES,
  isValidBrandMarketCode,
  normalizeBrandAuthorityKey,
  normalizeBrandMarketCode,
} from './brandAuthority.constants.js'

const {
  Schema,
  model,
  models,
} =
  mongoose

const objectId =
  Schema.Types.ObjectId

const baseSchemaOptions = {
  timestamps:
    true,

  versionKey:
    false,

  strict:
    true,
}

function normalizeStringArray(
  values,
  normalizer,
) {
  if (
    !Array.isArray(
      values,
    )
  ) {
    return []
  }

  return [
    ...new Set(
      values
        .map(
          normalizer,
        )
        .filter(
          Boolean,
        ),
    ),
  ]
}

function validMarketCodeArray(
  values,
) {
  return (
    Array.isArray(
      values,
    ) &&
    values.length >
      0 &&
    values.every(
      isValidBrandMarketCode,
    )
  )
}

/*
|--------------------------------------------------------------------------
| Brand Claim
|--------------------------------------------------------------------------
|
| A Host commercial organization requests authority over an existing
| canonical M04 Brand.
|
| This document grants NO authority by itself.
|--------------------------------------------------------------------------
*/

const brandClaimSchema =
  new Schema(
    {
      brandId: {
        type:
          objectId,

        ref:
          'Brand',

        required:
          true,

        index:
          true,
      },

      organizationId: {
        type:
          objectId,

        ref:
          'MarketplaceOrganization',

        required:
          true,

        index:
          true,
      },

      claimType: {
        type:
          String,

        enum:
          BRAND_CLAIM_TYPES,

        required:
          true,
      },

      status: {
        type:
          String,

        enum:
          BRAND_CLAIM_STATUSES,

        default:
          'pending_review',

        required:
          true,

        index:
          true,
      },

      requestedMarketCodes: {
        type: [
          String,
        ],

        required:
          true,

        set:
          (
            values,
          ) =>
            normalizeStringArray(
              values,
              normalizeBrandMarketCode,
            ),

        validate: {
          validator:
            validMarketCodeArray,

          message:
            'Brand claim must contain at least one valid ISO-style two-letter market code.',
        },
      },

      evidenceCheckIds: {
        type: [
          {
            type:
              objectId,

            ref:
              'TrademarkOrIdentityCheck',
          },
        ],

        default:
          [],
      },

      statement: {
        type:
          String,

        trim:
          true,

        maxlength:
          4000,

        default:
          '',
      },

      submittedByUserId: {
        type:
          objectId,

        ref:
          'User',

        required:
          true,
      },

      reviewedByUserId: {
        type:
          objectId,

        ref:
          'User',

        default:
          null,
      },

      reviewedAt: {
        type:
          Date,

        default:
          null,
      },

      reviewReason: {
        type:
          String,

        trim:
          true,

        maxlength:
          4000,

        default:
          '',
      },
    },
    {
      ...baseSchemaOptions,

      collection:
        'brandClaims',
    },
  )

brandClaimSchema.index(
  {
    brandId:
      1,

    organizationId:
      1,

    status:
      1,
  },
)

brandClaimSchema.index(
  {
    organizationId:
      1,

    createdAt:
      -1,
  },
)

/*
|--------------------------------------------------------------------------
| Trademark / Identity Check
|--------------------------------------------------------------------------
|
| Evidence metadata only.
|
| Binary documents/media should remain outside MongoDB and be referenced
| through controlled asset/source identifiers.
|--------------------------------------------------------------------------
*/

const trademarkOrIdentityCheckSchema =
  new Schema(
    {
      brandId: {
        type:
          objectId,

        ref:
          'Brand',

        required:
          true,

        index:
          true,
      },

      organizationId: {
        type:
          objectId,

        ref:
          'MarketplaceOrganization',

        required:
          true,

        index:
          true,
      },

      checkType: {
        type:
          String,

        enum:
          BRAND_IDENTITY_CHECK_TYPES,

        required:
          true,
      },

      status: {
        type:
          String,

        enum:
          BRAND_IDENTITY_CHECK_STATUSES,

        default:
          'pending',

        required:
          true,

        index:
          true,
      },

      evidenceReference: {
        type:
          String,

        trim:
          true,

        maxlength:
          2048,

        required:
          true,
      },

      evidenceSummary: {
        type:
          String,

        trim:
          true,

        maxlength:
          6000,

        default:
          '',
      },

      sourceAuthority: {
        type:
          String,

        trim:
          true,

        maxlength:
          300,

        default:
          '',
      },

      externalReference: {
        type:
          String,

        trim:
          true,

        maxlength:
          500,

        default:
          '',
      },

      effectiveFrom: {
        type:
          Date,

        default:
          null,
      },

      effectiveTo: {
        type:
          Date,

        default:
          null,
      },

      checkedAt: {
        type:
          Date,

        default:
          null,
      },

      checkedByUserId: {
        type:
          objectId,

        ref:
          'User',

        default:
          null,
      },

      createdByUserId: {
        type:
          objectId,

        ref:
          'User',

        required:
          true,
      },
    },
    {
      ...baseSchemaOptions,

      collection:
        'trademarkOrIdentityChecks',
    },
  )

trademarkOrIdentityCheckSchema.pre(
  'validate',
  function validateEvidenceWindow(
    next,
  ) {
    if (
      this.effectiveFrom &&
      this.effectiveTo &&
      this.effectiveTo <=
        this.effectiveFrom
    ) {
      this.invalidate(
        'effectiveTo',
        'Evidence effectiveTo must be later than effectiveFrom.',
      )
    }

    next()
  },
)

/*
|--------------------------------------------------------------------------
| Brand Authority Grant
|--------------------------------------------------------------------------
|
| This is the actual verified authority record.
|
| It is scoped to:
| - canonical Brand
| - Host organization
| - markets
| - optional sub-brand keys
| - optional ProductFamily IDs
| - explicit authority scopes
|
| It does NOT create a new application role.
|--------------------------------------------------------------------------
*/

const brandAuthorityGrantSchema =
  new Schema(
    {
      brandId: {
        type:
          objectId,

        ref:
          'Brand',

        required:
          true,

        index:
          true,
      },

      organizationId: {
        type:
          objectId,

        ref:
          'MarketplaceOrganization',

        required:
          true,

        index:
          true,
      },

      claimId: {
        type:
          objectId,

        ref:
          'BrandClaim',

        required:
          true,
      },

      authorityType: {
        type:
          String,

        enum:
          BRAND_CLAIM_TYPES,

        required:
          true,
      },

      status: {
        type:
          String,

        enum:
          BRAND_AUTHORITY_STATUSES,

        default:
          'active',

        required:
          true,

        index:
          true,
      },

      marketCodes: {
        type: [
          String,
        ],

        required:
          true,

        set:
          (
            values,
          ) =>
            normalizeStringArray(
              values,
              normalizeBrandMarketCode,
            ),

        validate: {
          validator:
            validMarketCodeArray,

          message:
            'Brand authority must contain at least one valid market code.',
        },
      },

      subBrandKeys: {
        type: [
          String,
        ],

        default:
          [],

        set:
          (
            values,
          ) =>
            normalizeStringArray(
              values,
              normalizeBrandAuthorityKey,
            ),
      },

      productFamilyIds: {
        type: [
          {
            type:
              objectId,

            ref:
              'ProductFamily',
          },
        ],

        default:
          [],
      },

      scopes: {
        type: [
          {
            type:
              String,

            enum:
              BRAND_AUTHORITY_SCOPES,
          },
        ],

        required:
          true,

        validate: {
          validator(
            values,
          ) {
            return (
              Array.isArray(
                values,
              ) &&
              values.length >
                0
            )
          },

          message:
            'Brand authority must contain at least one explicit scope.',
        },
      },

      validFrom: {
        type:
          Date,

        required:
          true,
      },

      validUntil: {
        type:
          Date,

        default:
          null,
      },

      grantedByUserId: {
        type:
          objectId,

        ref:
          'User',

        required:
          true,
      },

      suspendedByUserId: {
        type:
          objectId,

        ref:
          'User',

        default:
          null,
      },

      revokedByUserId: {
        type:
          objectId,

        ref:
          'User',

        default:
          null,
      },

      lifecycleReason: {
        type:
          String,

        trim:
          true,

        maxlength:
          4000,

        default:
          '',
      },
    },
    {
      ...baseSchemaOptions,

      collection:
        'brandAuthorities',
    },
  )

brandAuthorityGrantSchema.pre(
  'validate',
  function validateAuthorityWindow(
    next,
  ) {
    if (
      this.validFrom &&
      this.validUntil &&
      this.validUntil <=
        this.validFrom
    ) {
      this.invalidate(
        'validUntil',
        'Brand authority validUntil must be later than validFrom.',
      )
    }

    next()
  },
)

brandAuthorityGrantSchema.index(
  {
    organizationId:
      1,

    brandId:
      1,

    status:
      1,
  },
)

brandAuthorityGrantSchema.index(
  {
    brandId:
      1,

    status:
      1,

    validFrom:
      -1,
  },
)

/*
|--------------------------------------------------------------------------
| Content Override Field Change
|--------------------------------------------------------------------------
|
| ProposedValue intentionally remains flexible because canonical fields have
| different shapes.
|
| The allowed fieldKey enum prevents this proposal object from becoming a
| generic price/stock/commercial mutation channel.
|--------------------------------------------------------------------------
*/

const brandFieldChangeSchema =
  new Schema(
    {
      fieldKey: {
        type:
          String,

        enum:
          BRAND_OVERRIDE_FIELD_KEYS,

        required:
          true,
      },

      proposedValue: {
        type:
          Schema.Types.Mixed,

        required:
          true,
      },

      evidenceCheckIds: {
        type: [
          {
            type:
              objectId,

            ref:
              'TrademarkOrIdentityCheck',
          },
        ],

        default:
          [],
      },

      changeReason: {
        type:
          String,

        trim:
          true,

        minlength:
          3,

        maxlength:
          3000,

        required:
          true,
      },
    },
    {
      _id:
        false,

      strict:
        true,
    },
  )

/*
|--------------------------------------------------------------------------
| Content Override Proposal
|--------------------------------------------------------------------------
|
| Brand submissions never mutate ProductVersion directly.
|
| The proposal references the current immutable ProductVersion. A later
| approved activation flow may create a NEW ProductVersion.
|--------------------------------------------------------------------------
*/

const contentOverrideProposalSchema =
  new Schema(
    {
      brandId: {
        type:
          objectId,

        ref:
          'Brand',

        required:
          true,

        index:
          true,
      },

      organizationId: {
        type:
          objectId,

        ref:
          'MarketplaceOrganization',

        required:
          true,

        index:
          true,
      },

      authorityGrantId: {
        type:
          objectId,

        ref:
          'BrandAuthorityGrant',

        required:
          true,
      },

      productFamilyId: {
        type:
          objectId,

        ref:
          'ProductFamily',

        required:
          true,
      },

      productVariantId: {
        type:
          objectId,

        ref:
          'ProductVariant',

        required:
          true,
      },

      packId: {
        type:
          objectId,

        ref:
          'Pack',

        required:
          true,
      },

      baseProductVersionId: {
        type:
          objectId,

        ref:
          'ProductVersion',

        required:
          true,
      },

      marketCodes: {
        type: [
          String,
        ],

        required:
          true,

        set:
          (
            values,
          ) =>
            normalizeStringArray(
              values,
              normalizeBrandMarketCode,
            ),

        validate: {
          validator:
            validMarketCodeArray,

          message:
            'Content Override Proposal must contain at least one market code.',
        },
      },

      fieldChanges: {
        type: [
          brandFieldChangeSchema,
        ],

        required:
          true,

        validate: {
          validator(
            values,
          ) {
            return (
              Array.isArray(
                values,
              ) &&
              values.length >
                0 &&
              values.length <=
                50
            )
          },

          message:
            'Content Override Proposal must contain between 1 and 50 field changes.',
        },
      },

      status: {
        type:
          String,

        enum:
          BRAND_OVERRIDE_STATUSES,

        default:
          'draft',

        required:
          true,

        index:
          true,
      },

      requestedEffectiveFrom: {
        type:
          Date,

        default:
          null,
      },

      submittedByUserId: {
        type:
          objectId,

        ref:
          'User',

        required:
          true,
      },

      submittedAt: {
        type:
          Date,

        default:
          null,
      },

      reviewedByUserId: {
        type:
          objectId,

        ref:
          'User',

        default:
          null,
      },

      reviewedAt: {
        type:
          Date,

        default:
          null,
      },

      reviewReason: {
        type:
          String,

        trim:
          true,

        maxlength:
          4000,

        default:
          '',
      },

      approvedByUserId: {
        type:
          objectId,

        ref:
          'User',

        default:
          null,
      },

      approvedAt: {
        type:
          Date,

        default:
          null,
      },

      activatedByUserId: {
        type:
          objectId,

        ref:
          'User',

        default:
          null,
      },

      activatedAt: {
        type:
          Date,

        default:
          null,
      },

      activatedProductVersionId: {
        type:
          objectId,

        ref:
          'ProductVersion',

        default:
          null,
      },

      conflictCaseId: {
        type:
          objectId,

        ref:
          'ContentConflictCase',

        default:
          null,
      },
    },
    {
      ...baseSchemaOptions,

      collection:
        'contentOverrideProposals',
    },
  )

contentOverrideProposalSchema.index(
  {
    organizationId:
      1,

    brandId:
      1,

    status:
      1,

    createdAt:
      -1,
  },
)

contentOverrideProposalSchema.index(
  {
    packId:
      1,

    baseProductVersionId:
      1,

    status:
      1,
  },
)

/*
|--------------------------------------------------------------------------
| Content Conflict Case
|--------------------------------------------------------------------------
|
| Conflicting authoritative evidence becomes a review case.
|
| Safety/regulated conflicts must never be silently resolved by source count,
| popularity or a Host writing directly over canonical data.
|--------------------------------------------------------------------------
*/

const contentConflictCaseSchema =
  new Schema(
    {
      brandId: {
        type:
          objectId,

        ref:
          'Brand',

        required:
          true,

        index:
          true,
      },

      productFamilyId: {
        type:
          objectId,

        ref:
          'ProductFamily',

        required:
          true,
      },

      packId: {
        type:
          objectId,

        ref:
          'Pack',

        required:
          true,
      },

      baseProductVersionId: {
        type:
          objectId,

        ref:
          'ProductVersion',

        required:
          true,
      },

      proposalIds: {
        type: [
          {
            type:
              objectId,

            ref:
              'ContentOverrideProposal',
          },
        ],

        required:
          true,

        validate: {
          validator(
            values,
          ) {
            return (
              Array.isArray(
                values,
              ) &&
              values.length >
                0
            )
          },

          message:
            'Content Conflict Case must reference at least one proposal.',
        },
      },

      fieldKeys: {
        type: [
          {
            type:
              String,

            enum:
              BRAND_OVERRIDE_FIELD_KEYS,
          },
        ],

        required:
          true,

        validate: {
          validator(
            values,
          ) {
            return (
              Array.isArray(
                values,
              ) &&
              values.length >
                0
            )
          },

          message:
            'Content Conflict Case must identify at least one conflicting field.',
        },
      },

      severity: {
        type:
          String,

        enum:
          BRAND_CONFLICT_SEVERITIES,

        default:
          'standard',

        required:
          true,
      },

      status: {
        type:
          String,

        enum:
          BRAND_CONFLICT_STATUSES,

        default:
          'open',

        required:
          true,

        index:
          true,
      },

      openedReason: {
        type:
          String,

        trim:
          true,

        minlength:
          3,

        maxlength:
          4000,

        required:
          true,
      },

      resolutionReason: {
        type:
          String,

        trim:
          true,

        maxlength:
          4000,

        default:
          '',
      },

      openedByUserId: {
        type:
          objectId,

        ref:
          'User',

        required:
          true,
      },

      resolvedByUserId: {
        type:
          objectId,

        ref:
          'User',

        default:
          null,
      },

      resolvedAt: {
        type:
          Date,

        default:
          null,
      },
    },
    {
      ...baseSchemaOptions,

      collection:
        'contentConflictCases',
    },
  )

contentConflictCaseSchema.index(
  {
    status:
      1,

    severity:
      1,

    createdAt:
      -1,
  },
)

contentConflictCaseSchema.index(
  {
    brandId:
      1,

    packId:
      1,

    status:
      1,
  },
)

/*
|--------------------------------------------------------------------------
| Models
|--------------------------------------------------------------------------
*/

export const BrandClaim =
  models.BrandClaim ||
  model(
    'BrandClaim',
    brandClaimSchema,
  )

export const TrademarkOrIdentityCheck =
  models.TrademarkOrIdentityCheck ||
  model(
    'TrademarkOrIdentityCheck',
    trademarkOrIdentityCheckSchema,
  )

export const BrandAuthorityGrant =
  models.BrandAuthorityGrant ||
  model(
    'BrandAuthorityGrant',
    brandAuthorityGrantSchema,
  )

export const ContentOverrideProposal =
  models.ContentOverrideProposal ||
  model(
    'ContentOverrideProposal',
    contentOverrideProposalSchema,
  )

export const ContentConflictCase =
  models.ContentConflictCase ||
  model(
    'ContentConflictCase',
    contentConflictCaseSchema,
  )