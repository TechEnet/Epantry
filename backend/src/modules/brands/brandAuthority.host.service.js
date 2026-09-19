import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  Brand,
} from '../catalog/catalog.models.js'

import {
  requireActiveHostMarketplaceOrganization,
} from '../marketplace/marketplace.host.service.js'

import {
  BrandAuthorityGrant,
  BrandClaim,
  TrademarkOrIdentityCheck,
} from './brandAuthority.models.js'

function stringifyId(
  value,
) {
  if (
    value ===
      undefined ||
    value ===
      null
  ) {
    return null
  }

  return String(
    value,
  )
}

function actorIdFromUser(
  user,
) {
  return (
    user?._id ||
    user?.id ||
    null
  )
}

/*
|--------------------------------------------------------------------------
| Tenant Filters
|--------------------------------------------------------------------------
*/

export function buildOwnedBrandClaimFilter({
  claimId,
  organizationId,
}) {
  return {
    _id:
      claimId,

    organizationId,
  }
}

export function buildOwnedBrandIdentityCheckFilter({
  checkId,
  organizationId,
}) {
  return {
    _id:
      checkId,

    organizationId,
  }
}

/*
|--------------------------------------------------------------------------
| Serializers
|--------------------------------------------------------------------------
*/

export function serializeBrandIdentityCheck(
  check,
) {
  if (!check) {
    return null
  }

  const value =
    typeof check.toObject ===
      'function'
      ? check.toObject()
      : check

  return {
    id:
      stringifyId(
        value._id ||
          value.id,
      ),

    brandId:
      stringifyId(
        value.brandId,
      ),

    checkType:
      value.checkType,

    status:
      value.status,

    evidenceReference:
      value.evidenceReference,

    evidenceSummary:
      value.evidenceSummary ||
      '',

    sourceAuthority:
      value.sourceAuthority ||
      '',

    externalReference:
      value.externalReference ||
      '',

    effectiveFrom:
      value.effectiveFrom ||
      null,

    effectiveTo:
      value.effectiveTo ||
      null,

    checkedAt:
      value.checkedAt ||
      null,

    createdAt:
      value.createdAt ||
      null,

    updatedAt:
      value.updatedAt ||
      null,
  }
}

export function serializeBrandClaim(
  claim,
) {
  if (!claim) {
    return null
  }

  const value =
    typeof claim.toObject ===
      'function'
      ? claim.toObject()
      : claim

  return {
    id:
      stringifyId(
        value._id ||
          value.id,
      ),

    brandId:
      stringifyId(
        value.brandId,
      ),

    claimType:
      value.claimType,

    status:
      value.status,

    requestedMarketCodes:
      value.requestedMarketCodes ||
      [],

    evidenceCheckIds:
      (
        value.evidenceCheckIds ||
        []
      ).map(
        stringifyId,
      ),

    statement:
      value.statement ||
      '',

    reviewedAt:
      value.reviewedAt ||
      null,

    reviewReason:
      value.reviewReason ||
      '',

    createdAt:
      value.createdAt ||
      null,

    updatedAt:
      value.updatedAt ||
      null,
  }
}

/*
|--------------------------------------------------------------------------
| Canonical Brand
|--------------------------------------------------------------------------
*/

async function requireCanonicalBrand(
  brandId,
) {
  const brand =
    await Brand.findById(
      brandId,
    ).lean()

  if (!brand) {
    throw new ApiError(
      404,
      'Canonical Brand was not found.',
      [
        {
          code:
            'BRAND_AUTHORITY_BRAND_NOT_FOUND',
        },
      ],
    )
  }

  return brand
}

/*
|--------------------------------------------------------------------------
| Identity Evidence
|--------------------------------------------------------------------------
*/

export async function createBrandIdentityCheck(
  input,
  actorUser,
) {
  const actorUserId =
    actorIdFromUser(
      actorUser,
    )

  const organization =
    await requireActiveHostMarketplaceOrganization(
      actorUser,
    )

  await requireCanonicalBrand(
    input.brandId,
  )

  const check =
    await TrademarkOrIdentityCheck.create({
      brandId:
        input.brandId,

      organizationId:
        organization._id,

      checkType:
        input.checkType,

      status:
        'pending',

      evidenceReference:
        input.evidenceReference,

      evidenceSummary:
        input.evidenceSummary,

      sourceAuthority:
        input.sourceAuthority,

      externalReference:
        input.externalReference,

      effectiveFrom:
        input.effectiveFrom ||
        null,

      effectiveTo:
        input.effectiveTo ||
        null,

      checkedAt:
        null,

      checkedByUserId:
        null,

      createdByUserId:
        actorUserId,
    })

  return {
    identityCheck:
      serializeBrandIdentityCheck(
        check,
      ),
  }
}

export async function listBrandIdentityChecks(
  {
    page,
    limit,
    brandId,
    status,
  },
  actorUser,
) {
  const organization =
    await requireActiveHostMarketplaceOrganization(
      actorUser,
    )

  const filter = {
    organizationId:
      organization._id,
  }

  if (brandId) {
    filter.brandId =
      brandId
  }

  if (
    status !==
    'all'
  ) {
    filter.status =
      status
  }

  const skip =
    (
      page -
      1
    ) *
    limit

  const [
    identityChecks,
    total,
  ] =
    await Promise.all([
      TrademarkOrIdentityCheck.find(
        filter,
      )
        .sort({
          createdAt:
            -1,

          _id:
            -1,
        })
        .skip(
          skip,
        )
        .limit(
          limit,
        )
        .lean(),

      TrademarkOrIdentityCheck.countDocuments(
        filter,
      ),
    ])

  return {
    identityChecks:
      identityChecks.map(
        serializeBrandIdentityCheck,
      ),

    pagination: {
      page,

      limit,

      total,

      pages:
        total ===
        0
          ? 0
          : Math.ceil(
              total /
                limit,
            ),
    },
  }
}

export async function getBrandIdentityCheck(
  checkId,
  actorUser,
) {
  const organization =
    await requireActiveHostMarketplaceOrganization(
      actorUser,
    )

  const check =
    await TrademarkOrIdentityCheck.findOne(
      buildOwnedBrandIdentityCheckFilter({
        checkId,

        organizationId:
          organization._id,
      }),
    ).lean()

  if (!check) {
    throw new ApiError(
      404,
      'Brand identity evidence was not found.',
      [
        {
          code:
            'BRAND_AUTHORITY_IDENTITY_CHECK_NOT_FOUND',
        },
      ],
    )
  }

  return {
    identityCheck:
      serializeBrandIdentityCheck(
        check,
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Claim Evidence Validation
|--------------------------------------------------------------------------
*/

async function requireOwnedClaimEvidence({
  brandId,
  evidenceCheckIds,
  organizationId,
}) {
  const checks =
    await TrademarkOrIdentityCheck.find({
      _id: {
        $in:
          evidenceCheckIds,
      },

      brandId,

      organizationId,
    }).lean()

  const foundIds =
    new Set(
      checks.map(
        (
          check,
        ) =>
          String(
            check._id,
          ),
      ),
    )

  const allOwned =
    evidenceCheckIds.every(
      (
        id,
      ) =>
        foundIds.has(
          String(
            id,
          ),
        ),
    )

  if (
    !allOwned ||
    checks.length !==
      evidenceCheckIds.length
  ) {
    throw new ApiError(
      404,
      'One or more Brand identity evidence records were not found.',
      [
        {
          code:
            'BRAND_AUTHORITY_EVIDENCE_NOT_FOUND',
        },
      ],
    )
  }

  return checks
}

/*
|--------------------------------------------------------------------------
| Brand Claim
|--------------------------------------------------------------------------
*/

export async function createBrandClaim(
  input,
  actorUser,
) {
  const actorUserId =
    actorIdFromUser(
      actorUser,
    )

  const organization =
    await requireActiveHostMarketplaceOrganization(
      actorUser,
    )

  await requireCanonicalBrand(
    input.brandId,
  )

  await requireOwnedClaimEvidence({
    brandId:
      input.brandId,

    evidenceCheckIds:
      input.evidenceCheckIds,

    organizationId:
      organization._id,
  })

  const existingClaim =
    await BrandClaim.findOne({
      brandId:
        input.brandId,

      organizationId:
        organization._id,

      status: {
        $in: [
          'pending_review',
          'verified',
          'conflict',
          'suspended',
        ],
      },
    })
      .sort({
        createdAt:
          -1,
      })
      .lean()

  if (existingClaim) {
    throw new ApiError(
      409,
      'This Host organization already has an active or unresolved claim for this Brand.',
      [
        {
          code:
            'BRAND_AUTHORITY_CLAIM_ALREADY_EXISTS',
        },
      ],
    )
  }

  const claim =
    await BrandClaim.create({
      brandId:
        input.brandId,

      organizationId:
        organization._id,

      claimType:
        input.claimType,

      status:
        'pending_review',

      requestedMarketCodes:
        input.requestedMarketCodes,

      evidenceCheckIds:
        input.evidenceCheckIds,

      statement:
        input.statement,

      submittedByUserId:
        actorUserId,

      reviewedByUserId:
        null,

      reviewedAt:
        null,

      reviewReason:
        '',
    })

  return {
    claim:
      serializeBrandClaim(
        claim,
      ),
  }
}

export async function listBrandClaims(
  {
    page,
    limit,
    brandId,
    status,
  },
  actorUser,
) {
  const organization =
    await requireActiveHostMarketplaceOrganization(
      actorUser,
    )

  const filter = {
    organizationId:
      organization._id,
  }

  if (brandId) {
    filter.brandId =
      brandId
  }

  if (
    status !==
    'all'
  ) {
    filter.status =
      status
  }

  const skip =
    (
      page -
      1
    ) *
    limit

  const [
    claims,
    total,
  ] =
    await Promise.all([
      BrandClaim.find(
        filter,
      )
        .sort({
          createdAt:
            -1,

          _id:
            -1,
        })
        .skip(
          skip,
        )
        .limit(
          limit,
        )
        .lean(),

      BrandClaim.countDocuments(
        filter,
      ),
    ])

  return {
    claims:
      claims.map(
        serializeBrandClaim,
      ),

    pagination: {
      page,

      limit,

      total,

      pages:
        total ===
        0
          ? 0
          : Math.ceil(
              total /
                limit,
            ),
    },
  }
}

export async function getBrandClaim(
  claimId,
  actorUser,
) {
  const organization =
    await requireActiveHostMarketplaceOrganization(
      actorUser,
    )

  const claim =
    await BrandClaim.findOne(
      buildOwnedBrandClaimFilter({
        claimId,

        organizationId:
          organization._id,
      }),
    ).lean()

  if (!claim) {
    throw new ApiError(
      404,
      'Brand Claim was not found.',
      [
        {
          code:
            'BRAND_AUTHORITY_CLAIM_NOT_FOUND',
        },
      ],
    )
  }

  return {
    claim:
      serializeBrandClaim(
        claim,
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Explicit Authority Boundary
|--------------------------------------------------------------------------
|
| This module intentionally does not create, approve, suspend or revoke
| BrandAuthorityGrant.
|
| Host submits evidence + claim.
| Part 3 administrative verification decides authority.
|--------------------------------------------------------------------------
*/

export function hostBrandClaimServiceHasNoAuthorityGrantMutation() {
  return (
    typeof BrandAuthorityGrant.create !==
    'undefined'
  )
}