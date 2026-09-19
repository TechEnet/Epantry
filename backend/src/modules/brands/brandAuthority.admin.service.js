import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  ProductFamily,
} from '../catalog/catalog.models.js'

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

function uniqueStrings(
  values,
) {
  return [
    ...new Set(
      (
        values ||
        []
      ).map(
        String,
      ),
    ),
  ]
}

export function buildAdminBrandClaimFilter({
  claimId,
}) {
  return {
    _id:
      claimId,
  }
}

export function buildActiveBrandAuthorityFilter({
  brandId,
  organizationId,
  at = new Date(),
}) {
  return {
    brandId,

    organizationId,

    status:
      'active',

    validFrom: {
      $lte:
        at,
    },

    $or: [
      {
        validUntil:
          null,
      },

      {
        validUntil: {
          $gt:
            at,
        },
      },
    ],
  }
}

export function serializeAdminBrandClaim(
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

    organizationId:
      stringifyId(
        value.organizationId,
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

    submittedByUserId:
      stringifyId(
        value.submittedByUserId,
      ),

    reviewedByUserId:
      stringifyId(
        value.reviewedByUserId,
      ),

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

export function serializeBrandAuthorityGrant(
  grant,
) {
  if (!grant) {
    return null
  }

  const value =
    typeof grant.toObject ===
      'function'
      ? grant.toObject()
      : grant

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

    organizationId:
      stringifyId(
        value.organizationId,
      ),

    claimId:
      stringifyId(
        value.claimId,
      ),

    authorityType:
      value.authorityType,

    status:
      value.status,

    marketCodes:
      value.marketCodes ||
      [],

    subBrandKeys:
      value.subBrandKeys ||
      [],

    productFamilyIds:
      (
        value.productFamilyIds ||
        []
      ).map(
        stringifyId,
      ),

    scopes:
      value.scopes ||
      [],

    validFrom:
      value.validFrom,

    validUntil:
      value.validUntil ||
      null,

    grantedByUserId:
      stringifyId(
        value.grantedByUserId,
      ),

    suspendedByUserId:
      stringifyId(
        value.suspendedByUserId,
      ),

    revokedByUserId:
      stringifyId(
        value.revokedByUserId,
      ),

    lifecycleReason:
      value.lifecycleReason ||
      '',

    createdAt:
      value.createdAt ||
      null,

    updatedAt:
      value.updatedAt ||
      null,
  }
}

function ensureMarketSubset(
  requestedMarketCodes,
  grantedMarketCodes,
) {
  const requested =
    new Set(
      requestedMarketCodes ||
        [],
    )

  const outsideClaim =
    (
      grantedMarketCodes ||
      []
    ).filter(
      (
        market,
      ) =>
        !requested.has(
          market,
        ),
    )

  if (
    outsideClaim.length >
    0
  ) {
    throw new ApiError(
      409,
      'Brand authority cannot exceed the market scope requested by the Host.',
      [
        {
          code:
            'BRAND_AUTHORITY_MARKET_SCOPE_EXCEEDED',
        },
      ],
    )
  }
}

async function ensureProductFamiliesBelongToBrand({
  brandId,
  productFamilyIds,
}) {
  if (
    !productFamilyIds ||
    productFamilyIds.length ===
      0
  ) {
    return
  }

  const families =
    await ProductFamily.find({
      _id: {
        $in:
          productFamilyIds,
      },

      brandId,
    })
      .select({
        _id:
          1,
      })
      .lean()

  const foundIds =
    new Set(
      families.map(
        (
          family,
        ) =>
          String(
            family._id,
          ),
      ),
    )

  const allValid =
    productFamilyIds.every(
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
    !allValid ||
    families.length !==
      productFamilyIds.length
  ) {
    throw new ApiError(
      409,
      'One or more Product Families do not belong to the claimed Brand.',
      [
        {
          code:
            'BRAND_AUTHORITY_PRODUCT_FAMILY_SCOPE_INVALID',
        },
      ],
    )
  }
}

async function loadClaimEvidence(
  claim,
) {
  const checks =
    await TrademarkOrIdentityCheck.find({
      _id: {
        $in:
          claim.evidenceCheckIds,
      },

      brandId:
        claim.brandId,

      organizationId:
        claim.organizationId,
    }).lean()

  if (
    checks.length !==
    claim.evidenceCheckIds.length
  ) {
    throw new ApiError(
      409,
      'Brand Claim evidence set is incomplete.',
      [
        {
          code:
            'BRAND_AUTHORITY_EVIDENCE_INCOMPLETE',
        },
      ],
    )
  }

  return checks
}

function ensureVerifiedEvidence(
  checks,
) {
  const hasConflict =
    checks.some(
      (
        check,
      ) =>
        check.status ===
        'conflict',
    )

  if (
    hasConflict
  ) {
    throw new ApiError(
      409,
      'Conflicting identity evidence must be resolved before Brand authority can be granted.',
      [
        {
          code:
            'BRAND_AUTHORITY_EVIDENCE_CONFLICT',
        },
      ],
    )
  }

  const hasVerified =
    checks.some(
      (
        check,
      ) =>
        check.status ===
        'verified',
    )

  if (
    !hasVerified
  ) {
    throw new ApiError(
      409,
      'At least one verified identity evidence record is required before Brand authority can be granted.',
      [
        {
          code:
            'BRAND_AUTHORITY_VERIFIED_EVIDENCE_REQUIRED',
        },
      ],
    )
  }
}

export async function listAdminBrandClaims({
  page,
  limit,
  status,
  brandId,
  organizationId,
}) {
  const filter =
    {}

  if (
    status !==
    'all'
  ) {
    filter.status =
      status
  }

  if (brandId) {
    filter.brandId =
      brandId
  }

  if (organizationId) {
    filter.organizationId =
      organizationId
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
        serializeAdminBrandClaim,
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

export async function getAdminBrandClaim(
  claimId,
) {
  const claim =
    await BrandClaim.findOne(
      buildAdminBrandClaimFilter({
        claimId,
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

  const evidenceChecks =
    await TrademarkOrIdentityCheck.find({
      _id: {
        $in:
          claim.evidenceCheckIds,
      },

      brandId:
        claim.brandId,

      organizationId:
        claim.organizationId,
    })
      .sort({
        createdAt:
          1,
      })
      .lean()

  return {
    claim:
      serializeAdminBrandClaim(
        claim,
      ),

    evidenceChecks:
      evidenceChecks.map(
        (
          check,
        ) => ({
          id:
            stringifyId(
              check._id,
            ),

          checkType:
            check.checkType,

          status:
            check.status,

          evidenceReference:
            check.evidenceReference,

          evidenceSummary:
            check.evidenceSummary ||
            '',

          sourceAuthority:
            check.sourceAuthority ||
            '',

          externalReference:
            check.externalReference ||
            '',

          effectiveFrom:
            check.effectiveFrom ||
            null,

          effectiveTo:
            check.effectiveTo ||
            null,

          checkedAt:
            check.checkedAt ||
            null,
        }),
      ),
  }
}

export async function reviewBrandIdentityCheck(
  checkId,
  {
    decision,
    reason,
  },
  actorUser,
) {
  const actorUserId =
    actorIdFromUser(
      actorUser,
    )

  const check =
    await TrademarkOrIdentityCheck.findOne({
      _id:
        checkId,

      status: {
        $in: [
          'pending',
          'conflict',
        ],
      },
    })

  if (!check) {
    throw new ApiError(
      404,
      'Pending Brand identity evidence was not found.',
      [
        {
          code:
            'BRAND_AUTHORITY_IDENTITY_CHECK_NOT_REVIEWABLE',
        },
      ],
    )
  }

  check.status =
    decision

  check.checkedAt =
    new Date()

  check.checkedByUserId =
    actorUserId

  check.evidenceSummary =
    [
      check.evidenceSummary,
      `Review: ${reason}`,
    ]
      .filter(
        Boolean,
      )
      .join(
        '\n',
      )

  await check.save()

  return {
    identityCheck: {
      id:
        stringifyId(
          check._id,
        ),

      status:
        check.status,

      checkedAt:
        check.checkedAt,

      checkedByUserId:
        stringifyId(
          check.checkedByUserId,
        ),
    },
  }
}

export async function approveBrandClaim(
  claimId,
  {
    marketCodes,
    scopes,
    productFamilyIds,
    subBrandKeys,
    validFrom,
    validUntil,
    reason,
  },
  actorUser,
) {
  const actorUserId =
    actorIdFromUser(
      actorUser,
    )

  const claim =
    await BrandClaim.findOne({
      _id:
        claimId,

      status: {
        $in: [
          'pending_review',
          'conflict',
        ],
      },
    })

  if (!claim) {
    throw new ApiError(
      404,
      'Reviewable Brand Claim was not found.',
      [
        {
          code:
            'BRAND_AUTHORITY_CLAIM_NOT_REVIEWABLE',
        },
      ],
    )
  }

  ensureMarketSubset(
    claim.requestedMarketCodes,
    marketCodes,
  )

  await ensureProductFamiliesBelongToBrand({
    brandId:
      claim.brandId,

    productFamilyIds,
  })

  const evidenceChecks =
    await loadClaimEvidence(
      claim,
    )

  ensureVerifiedEvidence(
    evidenceChecks,
  )

  const now =
    new Date()

  const effectiveFrom =
    validFrom
      ? new Date(
          validFrom,
        )
      : now

  const effectiveUntil =
    validUntil
      ? new Date(
          validUntil,
        )
      : null

  const existingAuthority =
    await BrandAuthorityGrant.findOne(
      buildActiveBrandAuthorityFilter({
        brandId:
          claim.brandId,

        organizationId:
          claim.organizationId,

        at:
          now,
      }),
    ).lean()

  if (existingAuthority) {
    throw new ApiError(
      409,
      'An active Brand authority already exists for this Host organization and Brand.',
      [
        {
          code:
            'BRAND_AUTHORITY_ACTIVE_GRANT_EXISTS',
        },
      ],
    )
  }

  const grant =
    await BrandAuthorityGrant.create({
      brandId:
        claim.brandId,

      organizationId:
        claim.organizationId,

      claimId:
        claim._id,

      authorityType:
        claim.claimType,

      status:
        'active',

      marketCodes:
        uniqueStrings(
          marketCodes,
        ),

      subBrandKeys:
        uniqueStrings(
          subBrandKeys,
        ),

      productFamilyIds,

      scopes:
        uniqueStrings(
          scopes,
        ),

      validFrom:
        effectiveFrom,

      validUntil:
        effectiveUntil,

      grantedByUserId:
        actorUserId,

      suspendedByUserId:
        null,

      revokedByUserId:
        null,

      lifecycleReason:
        reason,
    })

  claim.status =
    'verified'

  claim.reviewedByUserId =
    actorUserId

  claim.reviewedAt =
    now

  claim.reviewReason =
    reason

  await claim.save()

  return {
    claim:
      serializeAdminBrandClaim(
        claim,
      ),

    authority:
      serializeBrandAuthorityGrant(
        grant,
      ),
  }
}

export async function rejectBrandClaim(
  claimId,
  {
    reason,
  },
  actorUser,
) {
  const actorUserId =
    actorIdFromUser(
      actorUser,
    )

  const claim =
    await BrandClaim.findOne({
      _id:
        claimId,

      status: {
        $in: [
          'pending_review',
          'conflict',
        ],
      },
    })

  if (!claim) {
    throw new ApiError(
      404,
      'Reviewable Brand Claim was not found.',
      [
        {
          code:
            'BRAND_AUTHORITY_CLAIM_NOT_REVIEWABLE',
        },
      ],
    )
  }

  claim.status =
    'rejected'

  claim.reviewedByUserId =
    actorUserId

  claim.reviewedAt =
    new Date()

  claim.reviewReason =
    reason

  await claim.save()

  return {
    claim:
      serializeAdminBrandClaim(
        claim,
      ),
  }
}

export async function changeBrandAuthorityLifecycle(
  grantId,
  {
    action,
    reason,
  },
  actorUser,
) {
  const actorUserId =
    actorIdFromUser(
      actorUser,
    )

  const grant =
    await BrandAuthorityGrant.findById(
      grantId,
    )

  if (!grant) {
    throw new ApiError(
      404,
      'Brand Authority Grant was not found.',
      [
        {
          code:
            'BRAND_AUTHORITY_GRANT_NOT_FOUND',
        },
      ],
    )
  }

  if (
    grant.status ===
    'revoked'
  ) {
    throw new ApiError(
      409,
      'Revoked Brand authority is terminal.',
      [
        {
          code:
            'BRAND_AUTHORITY_ALREADY_REVOKED',
        },
      ],
    )
  }

  if (
    action ===
    'suspend'
  ) {
    if (
      grant.status !==
      'active'
    ) {
      throw new ApiError(
        409,
        'Only active Brand authority may be suspended.',
        [
          {
            code:
              'BRAND_AUTHORITY_NOT_ACTIVE',
          },
        ],
      )
    }

    grant.status =
      'suspended'

    grant.suspendedByUserId =
      actorUserId
  } else {
    grant.status =
      'revoked'

    grant.revokedByUserId =
      actorUserId
  }

  grant.lifecycleReason =
    reason

  await grant.save()

  await BrandClaim.updateOne(
    {
      _id:
        grant.claimId,
    },
    {
      $set: {
        status:
          action ===
          'suspend'
            ? 'suspended'
            : 'revoked',

        reviewedByUserId:
          actorUserId,

        reviewedAt:
          new Date(),

        reviewReason:
          reason,
      },
    },
  )

  return {
    authority:
      serializeBrandAuthorityGrant(
        grant,
      ),
  }
}

export async function listAdminBrandAuthorities({
  page,
  limit,
  status,
  brandId,
  organizationId,
}) {
  const filter =
    {}

  if (
    status !==
    'all'
  ) {
    filter.status =
      status
  }

  if (brandId) {
    filter.brandId =
      brandId
  }

  if (organizationId) {
    filter.organizationId =
      organizationId
  }

  const skip =
    (
      page -
      1
    ) *
    limit

  const [
    grants,
    total,
  ] =
    await Promise.all([
      BrandAuthorityGrant.find(
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

      BrandAuthorityGrant.countDocuments(
        filter,
      ),
    ])

  return {
    authorities:
      grants.map(
        serializeBrandAuthorityGrant,
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