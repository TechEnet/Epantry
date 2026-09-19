import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  requireActiveHostMarketplaceOrganization,
} from '../marketplace/marketplace.host.service.js'

import {
  BrandAuthorityGrant,
  ContentConflictCase,
  ContentOverrideProposal,
} from './brandAuthority.models.js'

import {
  serializeBrandAuthorityGrant,
} from './brandAuthority.admin.service.js'

import {
  serializeContentOverrideProposal,
} from './brandAuthority.override.service.js'

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

export async function listHostBrandAuthorities(
  {
    page,
    limit,
    status,
    brandId,
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

  const skip =
    (
      page -
      1
    ) *
    limit

  const [
    authorities,
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
      authorities.map(
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

export async function listHostContentOverrides(
  {
    page,
    limit,
    status,
    brandId,
    packId,
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

  if (packId) {
    filter.packId =
      packId
  }

  const skip =
    (
      page -
      1
    ) *
    limit

  const [
    proposals,
    total,
  ] =
    await Promise.all([
      ContentOverrideProposal.find(
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

      ContentOverrideProposal.countDocuments(
        filter,
      ),
    ])

  return {
    proposals:
      proposals.map(
        serializeContentOverrideProposal,
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

export async function getHostContentOverride(
  proposalId,
  actorUser,
) {
  const organization =
    await requireActiveHostMarketplaceOrganization(
      actorUser,
    )

  const proposal =
    await ContentOverrideProposal.findOne({
      _id:
        proposalId,

      organizationId:
        organization._id,
    }).lean()

  if (!proposal) {
    throw new ApiError(
      404,
      'Brand Content Override Proposal was not found.',
      [
        {
          code:
            'BRAND_OVERRIDE_NOT_FOUND',
        },
      ],
    )
  }

  return {
    proposal:
      serializeContentOverrideProposal(
        proposal,
      ),
  }
}

export async function listAdminContentOverrides({
  page,
  limit,
  status,
  brandId,
  packId,
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

  if (packId) {
    filter.packId =
      packId
  }

  const skip =
    (
      page -
      1
    ) *
    limit

  const [
    proposals,
    total,
  ] =
    await Promise.all([
      ContentOverrideProposal.find(
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

      ContentOverrideProposal.countDocuments(
        filter,
      ),
    ])

  return {
    proposals:
      proposals.map(
        serializeContentOverrideProposal,
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

export async function listAdminBrandConflicts({
  page,
  limit,
  status,
  severity,
  brandId,
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

  if (
    severity !==
    'all'
  ) {
    filter.severity =
      severity
  }

  if (brandId) {
    filter.brandId =
      brandId
  }

  const skip =
    (
      page -
      1
    ) *
    limit

  const [
    conflicts,
    total,
  ] =
    await Promise.all([
      ContentConflictCase.find(
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

      ContentConflictCase.countDocuments(
        filter,
      ),
    ])

  return {
    conflicts:
      conflicts.map(
        (
          conflict,
        ) => ({
          id:
            stringifyId(
              conflict._id,
            ),

          brandId:
            stringifyId(
              conflict.brandId,
            ),

          productFamilyId:
            stringifyId(
              conflict.productFamilyId,
            ),

          packId:
            stringifyId(
              conflict.packId,
            ),

          baseProductVersionId:
            stringifyId(
              conflict.baseProductVersionId,
            ),

          proposalIds:
            (
              conflict.proposalIds ||
              []
            ).map(
              stringifyId,
            ),

          fieldKeys:
            conflict.fieldKeys ||
            [],

          severity:
            conflict.severity,

          status:
            conflict.status,

          openedReason:
            conflict.openedReason,

          resolutionReason:
            conflict.resolutionReason ||
            '',

          resolvedAt:
            conflict.resolvedAt ||
            null,

          createdAt:
            conflict.createdAt ||
            null,
        }),
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