import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  Pack,
  ProductFamily,
  ProductVariant,
  ProductVersion,
} from '../catalog/catalog.models.js'

import {
  requireActiveHostMarketplaceOrganization,
} from '../marketplace/marketplace.host.service.js'

import {
  BrandAuthorityGrant,
  ContentConflictCase,
  ContentOverrideProposal,
  TrademarkOrIdentityCheck,
} from './brandAuthority.models.js'

import {
  BRAND_OVERRIDE_CRITICAL_FIELD_KEYS,
} from './brandAuthority.constants.js'

const FIELD_SCOPE_MAP =
  Object.freeze({
    display_name:
      'official_content',

    description:
      'official_content',

    pack_images:
      'packaging_media',

    ingredient_declaration:
      'regulated_facts',

    allergens:
      'regulated_facts',

    nutrition:
      'regulated_facts',

    dietary_flags:
      'regulated_facts',

    certifications:
      'claims_certifications',

    claims:
      'claims_certifications',

    manufacturer:
      'official_content',

    importer:
      'official_content',

    country_of_origin:
      'official_content',

    net_quantity:
      'regulated_facts',

    preparation_instructions:
      'official_content',

    storage_instructions:
      'official_content',

    category_attributes:
      'official_content',

    packaging:
      'packaging_media',
  })

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

export function requiredBrandAuthorityScopeForField(
  fieldKey,
) {
  return (
    FIELD_SCOPE_MAP[
      fieldKey
    ] ||
    null
  )
}

export function isCriticalBrandOverrideField(
  fieldKey,
) {
  return BRAND_OVERRIDE_CRITICAL_FIELD_KEYS.includes(
    fieldKey,
  )
}

export function buildOwnedContentOverrideFilter({
  proposalId,
  organizationId,
}) {
  return {
    _id:
      proposalId,

    organizationId,
  }
}

export function buildActiveOwnedBrandAuthorityFilter({
  authorityGrantId,
  organizationId,
  at = new Date(),
}) {
  return {
    _id:
      authorityGrantId,

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

function ensureProposalMarketsWithinAuthority(
  authority,
  marketCodes,
) {
  const authorityMarkets =
    new Set(
      authority.marketCodes ||
        [],
    )

  const outsideAuthority =
    marketCodes.filter(
      (
        market,
      ) =>
        !authorityMarkets.has(
          market,
        ),
    )

  if (
    outsideAuthority.length >
    0
  ) {
    throw new ApiError(
      409,
      'Content proposal market scope exceeds verified Brand authority.',
      [
        {
          code:
            'BRAND_OVERRIDE_MARKET_SCOPE_EXCEEDED',
        },
      ],
    )
  }
}

function ensureFieldScopesWithinAuthority(
  authority,
  fieldChanges,
) {
  const scopes =
    new Set(
      authority.scopes ||
        [],
    )

  for (
    const change of
    fieldChanges
  ) {
    const requiredScope =
      requiredBrandAuthorityScopeForField(
        change.fieldKey,
      )

    if (
      !requiredScope ||
      !scopes.has(
        requiredScope,
      )
    ) {
      throw new ApiError(
        403,
        `Verified Brand authority does not permit ${change.fieldKey}.`,
        [
          {
            code:
              'BRAND_OVERRIDE_SCOPE_NOT_GRANTED',

            fieldKey:
              change.fieldKey,

            requiredScope,
          },
        ],
      )
    }
  }
}

async function requireOwnedActiveAuthority(
  authorityGrantId,
  organizationId,
) {
  const authority =
    await BrandAuthorityGrant.findOne(
      buildActiveOwnedBrandAuthorityFilter({
        authorityGrantId,

        organizationId,
      }),
    ).lean()

  if (!authority) {
    throw new ApiError(
      404,
      'Active Brand authority was not found.',
      [
        {
          code:
            'BRAND_OVERRIDE_AUTHORITY_NOT_FOUND',
        },
      ],
    )
  }

  return authority
}

async function requireCanonicalProposalTarget({
  authority,
  productFamilyId,
  productVariantId,
  packId,
  baseProductVersionId,
}) {
  const family =
    await ProductFamily.findOne({
      _id:
        productFamilyId,

      brandId:
        authority.brandId,
    }).lean()

  if (!family) {
    throw new ApiError(
      404,
      'Product Family is outside this Brand authority.',
      [
        {
          code:
            'BRAND_OVERRIDE_PRODUCT_FAMILY_NOT_FOUND',
        },
      ],
    )
  }

  if (
    Array.isArray(
      authority.productFamilyIds,
    ) &&
    authority.productFamilyIds.length >
      0
  ) {
    const allowedFamilies =
      new Set(
        authority.productFamilyIds.map(
          String,
        ),
      )

    if (
      !allowedFamilies.has(
        String(
          family._id,
        ),
      )
    ) {
      throw new ApiError(
        403,
        'Brand authority does not cover this Product Family.',
        [
          {
            code:
              'BRAND_OVERRIDE_PRODUCT_FAMILY_NOT_GRANTED',
          },
        ],
      )
    }
  }

  const variant =
    await ProductVariant.findOne({
      _id:
        productVariantId,

      productFamilyId:
        family._id,
    }).lean()

  if (!variant) {
    throw new ApiError(
      404,
      'Product Variant is outside the selected Product Family.',
      [
        {
          code:
            'BRAND_OVERRIDE_VARIANT_NOT_FOUND',
        },
      ],
    )
  }

  const pack =
    await Pack.findOne({
      _id:
        packId,

      productVariantId:
        variant._id,
    }).lean()

  if (!pack) {
    throw new ApiError(
      404,
      'Pack is outside the selected Product Variant.',
      [
        {
          code:
            'BRAND_OVERRIDE_PACK_NOT_FOUND',
        },
      ],
    )
  }

  const baseVersion =
    await ProductVersion.findOne({
      _id:
        baseProductVersionId,

      packId:
        pack._id,

      status:
        'published',
    }).lean()

  if (!baseVersion) {
    throw new ApiError(
      409,
      'Content proposal must reference a published canonical Product Version for this Pack.',
      [
        {
          code:
            'BRAND_OVERRIDE_BASE_VERSION_INVALID',
        },
      ],
    )
  }

  return {
    family,

    variant,

    pack,

    baseVersion,
  }
}

async function ensureProposalEvidence({
  authority,
  organizationId,
  fieldChanges,
}) {
  const requiredEvidenceIds =
    [
      ...new Set(
        fieldChanges
          .filter(
            (
              change,
            ) =>
              isCriticalBrandOverrideField(
                change.fieldKey,
              ) ||
              change.evidenceCheckIds.length >
                0,
          )
          .flatMap(
            (
              change,
            ) =>
              change.evidenceCheckIds,
          ),
      ),
    ]

  for (
    const change of
    fieldChanges
  ) {
    if (
      isCriticalBrandOverrideField(
        change.fieldKey,
      ) &&
      change.evidenceCheckIds.length ===
        0
    ) {
      throw new ApiError(
        409,
        `Evidence is required for critical Brand field ${change.fieldKey}.`,
        [
          {
            code:
              'BRAND_OVERRIDE_CRITICAL_EVIDENCE_REQUIRED',

            fieldKey:
              change.fieldKey,
          },
        ],
      )
    }
  }

  if (
    requiredEvidenceIds.length ===
    0
  ) {
    return
  }

  const checks =
    await TrademarkOrIdentityCheck.find({
      _id: {
        $in:
          requiredEvidenceIds,
      },

      brandId:
        authority.brandId,

      organizationId,

      status:
        'verified',
    })
      .select({
        _id:
          1,
      })
      .lean()

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

  const allVerified =
    requiredEvidenceIds.every(
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
    !allVerified ||
    checks.length !==
      requiredEvidenceIds.length
  ) {
    throw new ApiError(
      409,
      'All referenced Brand evidence must belong to this authority and already be verified.',
      [
        {
          code:
            'BRAND_OVERRIDE_EVIDENCE_NOT_VERIFIED',
        },
      ],
    )
  }
}

export function serializeContentOverrideProposal(
  proposal,
) {
  if (!proposal) {
    return null
  }

  const value =
    typeof proposal.toObject ===
      'function'
      ? proposal.toObject()
      : proposal

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

    authorityGrantId:
      stringifyId(
        value.authorityGrantId,
      ),

    productFamilyId:
      stringifyId(
        value.productFamilyId,
      ),

    productVariantId:
      stringifyId(
        value.productVariantId,
      ),

    packId:
      stringifyId(
        value.packId,
      ),

    baseProductVersionId:
      stringifyId(
        value.baseProductVersionId,
      ),

    marketCodes:
      value.marketCodes ||
      [],

    fieldChanges:
      value.fieldChanges ||
      [],

    status:
      value.status,

    requestedEffectiveFrom:
      value.requestedEffectiveFrom ||
      null,

    submittedAt:
      value.submittedAt ||
      null,

    reviewedAt:
      value.reviewedAt ||
      null,

    reviewReason:
      value.reviewReason ||
      '',

    approvedAt:
      value.approvedAt ||
      null,

    conflictCaseId:
      stringifyId(
        value.conflictCaseId,
      ),

    activatedAt:
      value.activatedAt ||
      null,

    activatedProductVersionId:
      stringifyId(
        value.activatedProductVersionId,
      ),

    createdAt:
      value.createdAt ||
      null,

    updatedAt:
      value.updatedAt ||
      null,
  }
}

export async function createContentOverrideProposal(
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

  const authority =
    await requireOwnedActiveAuthority(
      input.authorityGrantId,
      organization._id,
    )

  ensureProposalMarketsWithinAuthority(
    authority,
    input.marketCodes,
  )

  ensureFieldScopesWithinAuthority(
    authority,
    input.fieldChanges,
  )

  await requireCanonicalProposalTarget({
    authority,

    productFamilyId:
      input.productFamilyId,

    productVariantId:
      input.productVariantId,

    packId:
      input.packId,

    baseProductVersionId:
      input.baseProductVersionId,
  })

  const proposal =
    await ContentOverrideProposal.create({
      brandId:
        authority.brandId,

      organizationId:
        organization._id,

      authorityGrantId:
        authority._id,

      productFamilyId:
        input.productFamilyId,

      productVariantId:
        input.productVariantId,

      packId:
        input.packId,

      baseProductVersionId:
        input.baseProductVersionId,

      marketCodes:
        input.marketCodes,

      fieldChanges:
        input.fieldChanges,

      status:
        'draft',

      requestedEffectiveFrom:
        input.requestedEffectiveFrom ||
        null,

      submittedByUserId:
        actorUserId,

      submittedAt:
        null,

      reviewedByUserId:
        null,

      reviewedAt:
        null,

      reviewReason:
        '',

      approvedByUserId:
        null,

      approvedAt:
        null,

      activatedByUserId:
        null,

      activatedAt:
        null,

      activatedProductVersionId:
        null,

      conflictCaseId:
        null,
    })

  return {
    proposal:
      serializeContentOverrideProposal(
        proposal,
      ),
  }
}

export async function submitContentOverrideProposal(
  proposalId,
  actorUser,
) {
  const organization =
    await requireActiveHostMarketplaceOrganization(
      actorUser,
    )

  const proposal =
    await ContentOverrideProposal.findOne(
      buildOwnedContentOverrideFilter({
        proposalId,

        organizationId:
          organization._id,
      }),
    )

  if (
    !proposal ||
    proposal.status !==
      'draft'
  ) {
    throw new ApiError(
      404,
      'Draft Brand Content Override Proposal was not found.',
      [
        {
          code:
            'BRAND_OVERRIDE_DRAFT_NOT_FOUND',
        },
      ],
    )
  }

  const authority =
    await requireOwnedActiveAuthority(
      proposal.authorityGrantId,
      organization._id,
    )

  ensureProposalMarketsWithinAuthority(
    authority,
    proposal.marketCodes,
  )

  ensureFieldScopesWithinAuthority(
    authority,
    proposal.fieldChanges,
  )

  await ensureProposalEvidence({
    authority,

    organizationId:
      organization._id,

    fieldChanges:
      proposal.fieldChanges,
  })

  proposal.status =
    'submitted'

  proposal.submittedAt =
    new Date()

  await proposal.save()

  return {
    proposal:
      serializeContentOverrideProposal(
        proposal,
      ),
  }
}

function resolveConflictSeverity(
  fieldChanges,
) {
  if (
    fieldChanges.some(
      (
        change,
      ) =>
        isCriticalBrandOverrideField(
          change.fieldKey,
        ),
    )
  ) {
    return 'safety_critical'
  }

  if (
    fieldChanges.some(
      (
        change,
      ) =>
        [
          'claims',
          'certifications',
          'manufacturer',
          'importer',
          'country_of_origin',
        ].includes(
          change.fieldKey,
        ),
    )
  ) {
    return 'regulated'
  }

  return 'standard'
}

export async function reviewContentOverrideProposal(
  proposalId,
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

  const proposal =
    await ContentOverrideProposal.findOne({
      _id:
        proposalId,

      status: {
        $in: [
          'submitted',
          'in_review',
        ],
      },
    })

  if (!proposal) {
    throw new ApiError(
      404,
      'Reviewable Brand Content Override Proposal was not found.',
      [
        {
          code:
            'BRAND_OVERRIDE_NOT_REVIEWABLE',
        },
      ],
    )
  }

  const now =
    new Date()

  proposal.reviewedByUserId =
    actorUserId

  proposal.reviewedAt =
    now

  proposal.reviewReason =
    reason

  if (
    decision ===
    'approve'
  ) {
    proposal.status =
      'approved'

    proposal.approvedByUserId =
      actorUserId

    proposal.approvedAt =
      now
  } else if (
    decision ===
    'reject'
  ) {
    proposal.status =
      'rejected'
  } else {
    const conflict =
      await ContentConflictCase.create({
        brandId:
          proposal.brandId,

        productFamilyId:
          proposal.productFamilyId,

        packId:
          proposal.packId,

        baseProductVersionId:
          proposal.baseProductVersionId,

        proposalIds: [
          proposal._id,
        ],

        fieldKeys:
          proposal.fieldChanges.map(
            (
              change,
            ) =>
              change.fieldKey,
          ),

        severity:
          resolveConflictSeverity(
            proposal.fieldChanges,
          ),

        status:
          'open',

        openedReason:
          reason,

        resolutionReason:
          '',

        openedByUserId:
          actorUserId,

        resolvedByUserId:
          null,

        resolvedAt:
          null,
      })

    proposal.status =
      'conflict'

    proposal.conflictCaseId =
      conflict._id
  }

  await proposal.save()

  return {
    proposal:
      serializeContentOverrideProposal(
        proposal,
      ),
  }
}

export async function resolveContentConflictCase(
  conflictCaseId,
  {
    resolution,
    selectedProposalId,
    reason,
  },
  actorUser,
) {
  const actorUserId =
    actorIdFromUser(
      actorUser,
    )

  const conflict =
    await ContentConflictCase.findOne({
      _id:
        conflictCaseId,

      status: {
        $in: [
          'open',
          'in_review',
        ],
      },
    })

  if (!conflict) {
    throw new ApiError(
      404,
      'Open Brand Content Conflict Case was not found.',
      [
        {
          code:
            'BRAND_CONTENT_CONFLICT_NOT_FOUND',
        },
      ],
    )
  }

  if (
    resolution ===
    'quarantine'
  ) {
    conflict.status =
      'quarantined'
  } else {
    if (
      !selectedProposalId ||
      !conflict.proposalIds
        .map(
          String,
        )
        .includes(
          String(
            selectedProposalId,
          ),
        )
    ) {
      throw new ApiError(
        409,
        'Selected proposal does not belong to this conflict case.',
        [
          {
            code:
              'BRAND_CONTENT_CONFLICT_PROPOSAL_INVALID',
          },
        ],
      )
    }

    await ContentOverrideProposal.updateOne(
      {
        _id:
          selectedProposalId,

        conflictCaseId:
          conflict._id,

        status:
          'conflict',
      },
      {
        $set: {
          status:
            resolution ===
            'approve_proposal'
              ? 'approved'
              : 'rejected',

          reviewedByUserId:
            actorUserId,

          reviewedAt:
            new Date(),

          reviewReason:
            reason,

          approvedByUserId:
            resolution ===
            'approve_proposal'
              ? actorUserId
              : null,

          approvedAt:
            resolution ===
            'approve_proposal'
              ? new Date()
              : null,
        },
      },
    )

    conflict.status =
      'resolved'
  }

  conflict.resolutionReason =
    reason

  conflict.resolvedByUserId =
    actorUserId

  conflict.resolvedAt =
    new Date()

  await conflict.save()

  return {
    conflict: {
      id:
        stringifyId(
          conflict._id,
        ),

      status:
        conflict.status,

      severity:
        conflict.severity,

      proposalIds:
        conflict.proposalIds.map(
          stringifyId,
        ),

      resolutionReason:
        conflict.resolutionReason,

      resolvedByUserId:
        stringifyId(
          conflict.resolvedByUserId,
        ),

      resolvedAt:
        conflict.resolvedAt,
    },
  }
}

/*
|--------------------------------------------------------------------------
| Canonical Activation Boundary
|--------------------------------------------------------------------------
|
| M06 does NOT mutate an existing published ProductVersion.
|
| This function produces a governed handoff contract for the existing M04
| versioning workflow. Actual creation/publication of the NEW canonical
| ProductVersion will be wired through the governed API integration later.
|--------------------------------------------------------------------------
*/

export function buildApprovedCanonicalOverrideRequest(
  proposal,
) {
  if (
    !proposal ||
    proposal.status !==
      'approved'
  ) {
    throw new ApiError(
      409,
      'Only an approved Brand Content Override Proposal may enter canonical versioning.',
      [
        {
          code:
            'BRAND_OVERRIDE_NOT_APPROVED',
        },
      ],
    )
  }

  return {
    baseProductVersionId:
      stringifyId(
        proposal.baseProductVersionId,
      ),

    productFamilyId:
      stringifyId(
        proposal.productFamilyId,
      ),

    productVariantId:
      stringifyId(
        proposal.productVariantId,
      ),

    packId:
      stringifyId(
        proposal.packId,
      ),

    requestedEffectiveFrom:
      proposal.requestedEffectiveFrom ||
      null,

    changes:
      (
        proposal.fieldChanges ||
        []
      ).map(
        (
          change,
        ) => ({
          fieldKey:
            change.fieldKey,

          proposedValue:
            change.proposedValue,

          changeReason:
            change.changeReason,

          evidenceCheckIds:
            (
              change.evidenceCheckIds ||
              []
            ).map(
              stringifyId,
            ),
        }),
      ),

    provenance: {
      sourceType:
        'verified_brand_authority',

      brandId:
        stringifyId(
          proposal.brandId,
        ),

      organizationId:
        stringifyId(
          proposal.organizationId,
        ),

      authorityGrantId:
        stringifyId(
          proposal.authorityGrantId,
        ),

      proposalId:
        stringifyId(
          proposal._id ||
            proposal.id,
        ),
    },
  }
}