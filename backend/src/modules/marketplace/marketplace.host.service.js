import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  Brand,
  Category,
  Pack,
  ProductFamily,
  ProductVariant,
  ProductVersion,
} from '../catalog/catalog.models.js'

import {
  notifyActiveSuperAdminsBestEffort,
} from '../notifications/notification.service.js'

import {
  HostOffer,
  MarketplaceOrganization,
} from './marketplace.models.js'

import {
  normalizeMarketplaceKey,
} from './marketplace.constants.js'

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

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

function actorDisplayName(
  user,
) {
  return String(
    user?.displayName ||
      user?.fullName ||
      user?.name ||
      user?.email ||
      'Host Marketplace',
  )
    .trim()
    .slice(
      0,
      220,
    )
}

function escapeRegex(
  value,
) {
  return String(
    value ||
      '',
  ).replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  )
}

function duplicateKeyError(
  error,
) {
  return (
    error?.code ===
    11000
  )
}

/*
|--------------------------------------------------------------------------
| Ownership Filters
|--------------------------------------------------------------------------
|
| Every private Host resource query must include organizationId.
|
| The resource ID alone is never sufficient.
|--------------------------------------------------------------------------
*/

export function buildOwnedHostOfferFilter({
  offerId,
  organizationId,
}) {
  return {
    _id:
      offerId,

    organizationId,
  }
}

/*
|--------------------------------------------------------------------------
| Current Published Canonical Pack Filter
|--------------------------------------------------------------------------
*/

export function buildCurrentPublishedPackVersionFilter(
  packId,
  now = new Date(),
) {
  return {
    packId,

    publicationStatus:
      'published',

    $and: [
      {
        $or: [
          {
            effectiveFrom:
              null,
          },
          {
            effectiveFrom: {
              $lte:
                now,
            },
          },
        ],
      },

      {
        $or: [
          {
            effectiveTo:
              null,
          },
          {
            effectiveTo: {
              $gt:
                now,
            },
          },
        ],
      },
    ],
  }
}

/*
|--------------------------------------------------------------------------
| Serializers
|--------------------------------------------------------------------------
*/

export function serializeMarketplaceOrganization(
  organization,
) {
  if (
    !organization
  ) {
    return null
  }

  const value =
    typeof organization.toObject ===
    'function'
      ? organization.toObject()
      : organization

  return {
    id:
      stringifyId(
        value._id ||
          value.id,
      ),

    displayName:
      value.displayName,

    slug:
      value.slug,

    organizationType:
      value.organizationType,

    status:
      value.status,

    externalReference:
      value.externalReference ||
      '',

    createdAt:
      value.createdAt ||
      null,

    updatedAt:
      value.updatedAt ||
      null,
  }
}

export function serializeHostOffer(
  offer,
) {
  if (
    !offer
  ) {
    return null
  }

  const value =
    typeof offer.toObject ===
    'function'
      ? offer.toObject()
      : offer

  return {
    id:
      stringifyId(
        value._id ||
          value.id,
      ),

    organizationId:
      stringifyId(
        value.organizationId,
      ),

    packId:
      stringifyId(
        value.packId,
      ),

    merchantSku:
      value.merchantSku ||
      '',

    offerKey:
      value.offerKey,

    status:
      value.status,

    fulfillmentTypes:
      value.fulfillmentTypes ||
      [],

    minimumOrderQuantity:
      value.minimumOrderQuantity,

    maximumOrderQuantity:
      value.maximumOrderQuantity ??
      null,

    externalReference:
      value.externalReference ||
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
| Host Marketplace Organization
|--------------------------------------------------------------------------
|
| Existing M02 Host approval remains the identity/access lifecycle.
|
| We do NOT create a second Seller login or Seller application role.
|
| Once an approved active Host creates their first commercial Offer, a single
| commercial organization is initialized automatically.
|--------------------------------------------------------------------------
*/

export async function findHostMarketplaceOrganization(
  actorUser,
) {
  const actorUserId =
    actorIdFromUser(
      actorUser,
    )

  if (
    !actorUserId
  ) {
    throw new ApiError(
      401,
      'Authenticated Host identity is required.',
      [
        {
          code:
            'MARKETPLACE_HOST_IDENTITY_REQUIRED',
        },
      ],
    )
  }

  return MarketplaceOrganization.findOne({
    ownerUserId:
      actorUserId,
  })
}

export async function requireActiveHostMarketplaceOrganization(
  actorUser,
) {
  const organization =
    await findHostMarketplaceOrganization(
      actorUser,
    )

  if (
    !organization
  ) {
    throw new ApiError(
      404,
      'Host Marketplace organization was not found.',
      [
        {
          code:
            'MARKETPLACE_ORGANIZATION_NOT_FOUND',
        },
      ],
    )
  }

  if (
    organization.status !==
    'active'
  ) {
    throw new ApiError(
      403,
      'Host Marketplace organization is not active.',
      [
        {
          code:
            'MARKETPLACE_ORGANIZATION_NOT_ACTIVE',
        },
      ],
    )
  }

  return organization
}

export async function ensureHostMarketplaceOrganization(
  actorUser,
) {
  const actorUserId =
    actorIdFromUser(
      actorUser,
    )

  if (
    !actorUserId
  ) {
    throw new ApiError(
      401,
      'Authenticated Host identity is required.',
      [
        {
          code:
            'MARKETPLACE_HOST_IDENTITY_REQUIRED',
        },
      ],
    )
  }

  const existing =
    await MarketplaceOrganization.findOne({
      ownerUserId:
        actorUserId,
    })

  if (
    existing
  ) {
    if (
      existing.status !==
      'active'
    ) {
      throw new ApiError(
        403,
        'Host Marketplace organization is not active.',
        [
          {
            code:
              'MARKETPLACE_ORGANIZATION_NOT_ACTIVE',
          },
        ],
      )
    }

    return existing
  }

  const actorId =
    String(
      actorUserId,
    )

  const displayName =
    actorDisplayName(
      actorUser,
    )

  const organizationSlug =
    normalizeMarketplaceKey(
      `host-${actorId}`,
    )

  try {
    return await MarketplaceOrganization.create({
      ownerUserId:
        actorUserId,

      displayName,

      slug:
        organizationSlug,

      organizationType:
        'hybrid',

      /*
      |--------------------------------------------------------------------------
      | Existing active Host approval is the activation source of truth.
      |--------------------------------------------------------------------------
      |
      | Routes calling this service already require:
      |
      | hostEnabled === true
      | hostAccessStatus === active
      |
      */

      status:
        'active',

      createdByUserId:
        actorUserId,

      updatedByUserId:
        actorUserId,
    })
  } catch (error) {
    if (
      !duplicateKeyError(
        error,
      )
    ) {
      throw error
    }

    const concurrentOrganization =
      await MarketplaceOrganization.findOne({
        ownerUserId:
          actorUserId,
      })

    if (
      concurrentOrganization
    ) {
      if (
        concurrentOrganization.status !==
        'active'
      ) {
        throw new ApiError(
          403,
          'Host Marketplace organization is not active.',
          [
            {
              code:
                'MARKETPLACE_ORGANIZATION_NOT_ACTIVE',
            },
          ],
        )
      }

      return concurrentOrganization
    }

    throw new ApiError(
      409,
      'Host Marketplace organization could not be initialized safely.',
      [
        {
          code:
            'MARKETPLACE_ORGANIZATION_CONFLICT',
        },
      ],
    )
  }
}

/*
|--------------------------------------------------------------------------
| Organization Summary
|--------------------------------------------------------------------------
*/

export async function getHostMarketplaceOrganization(
  actorUser,
) {
  const organization =
    await findHostMarketplaceOrganization(
      actorUser,
    )

  return {
    organization:
      serializeMarketplaceOrganization(
        organization,
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Canonical Pack Eligibility
|--------------------------------------------------------------------------
|
| An Offer may reference only a currently public canonical Pack.
|
| All hierarchy entities must be active and the Pack must have a current
| published ProductVersion.
|--------------------------------------------------------------------------
*/

async function requireCatalogDocument(
  Model,
  id,
  entityName,
) {
  const document =
    await Model.findById(
      id,
    ).lean()

  if (
    !document
  ) {
    throw new ApiError(
      404,
      `${entityName} was not found.`,
      [
        {
          code:
            'MARKETPLACE_CANONICAL_REFERENCE_NOT_FOUND',

          entity:
            entityName,
        },
      ],
    )
  }

  return document
}

function assertActiveCatalogEntity(
  document,
  entityName,
) {
  if (
    document.status !==
    'active'
  ) {
    throw new ApiError(
      409,
      `${entityName} is not active and cannot receive a commercial Offer.`,
      [
        {
          code:
            'MARKETPLACE_CANONICAL_REFERENCE_INACTIVE',

          entity:
            entityName,
        },
      ],
    )
  }
}

export async function validateOfferCanonicalPack(
  packId,
) {
  const pack =
    await requireCatalogDocument(
      Pack,
      packId,
      'Pack',
    )

  assertActiveCatalogEntity(
    pack,
    'Pack',
  )

  const variant =
    await requireCatalogDocument(
      ProductVariant,
      pack.variantId,
      'Product Variant',
    )

  assertActiveCatalogEntity(
    variant,
    'Product Variant',
  )

  const family =
    await requireCatalogDocument(
      ProductFamily,
      variant.familyId,
      'Product Family',
    )

  assertActiveCatalogEntity(
    family,
    'Product Family',
  )

  const [
    brand,
    category,
  ] =
    await Promise.all([
      requireCatalogDocument(
        Brand,
        family.brandId,
        'Brand',
      ),

      requireCatalogDocument(
        Category,
        family.categoryId,
        'Category',
      ),
    ])

  assertActiveCatalogEntity(
    brand,
    'Brand',
  )

  assertActiveCatalogEntity(
    category,
    'Category',
  )

  const currentVersion =
    await ProductVersion.findOne(
      buildCurrentPublishedPackVersionFilter(
        pack._id,
      ),
    )
      .sort({
        version:
          -1,
      })
      .lean()

  if (
    !currentVersion
  ) {
    throw new ApiError(
      409,
      'Pack has no current published canonical Product Version.',
      [
        {
          code:
            'MARKETPLACE_CANONICAL_PRODUCT_UNPUBLISHED',
        },
      ],
    )
  }

  return {
    pack,

    variant,

    family,

    brand,

    category,

    currentVersion,
  }
}

/*
|--------------------------------------------------------------------------
| Create Host Offer
|--------------------------------------------------------------------------
*/

export async function createHostOffer(
  input,
  actorUser,
) {
  const actorUserId =
    actorIdFromUser(
      actorUser,
    )

  const organization =
    await ensureHostMarketplaceOrganization(
      actorUser,
    )

  await validateOfferCanonicalPack(
    input.packId,
  )

  try {
    const offer =
      await HostOffer.create({
        organizationId:
          organization._id,

        packId:
          input.packId,

        merchantSku:
          input.merchantSku,

        fulfillmentTypes:
          input.fulfillmentTypes,

        minimumOrderQuantity:
          input.minimumOrderQuantity,

        maximumOrderQuantity:
          input.maximumOrderQuantity,

        externalReference:
          input.externalReference,

        /*
        |--------------------------------------------------------------------------
        | Part 2 Offer always starts as draft.
        |--------------------------------------------------------------------------
        */

        status:
          'draft',

        createdByUserId:
          actorUserId,

        updatedByUserId:
          actorUserId,
      })

    await notifyActiveSuperAdminsBestEffort({
      triggerType:
        'host_listing_created',
      reasonCode:
        'host_grocery_listing_created',
      explanation: `${organization.displayName || actorDisplayName(actorUser)} created a new Grocery marketplace listing.`,
      relatedEntityType:
        'host_grocery_listing',
      relatedEntityId:
        stringifyId(
          offer._id,
        ),
      sourceDomain:
        'marketplace',
      sourceVersion:
        'host-offer-v1',
      dedupeScope: `host-offer-created:${stringifyId(offer._id)}`,
    })

    return {
      organization:
        serializeMarketplaceOrganization(
          organization,
        ),

      offer:
        serializeHostOffer(
          offer,
        ),
    }
  } catch (error) {
    if (
      duplicateKeyError(
        error,
      )
    ) {
      throw new ApiError(
        409,
        'This Host organization already has an Offer for the selected Pack or merchant SKU.',
        [
          {
            code:
              'MARKETPLACE_OFFER_DUPLICATE',
          },
        ],
      )
    }

    throw error
  }
}

/*
|--------------------------------------------------------------------------
| List Host Offers
|--------------------------------------------------------------------------
*/

export async function listHostOffers({
  page,
  limit,
  status,
  packId,
  search,
}, actorUser) {
  const organization =
    await findHostMarketplaceOrganization(
      actorUser,
    )

  if (
    !organization
  ) {
    return {
      organization:
        null,

      offers:
        [],

      pagination: {
        page,
        limit,
        total:
          0,

        pages:
          0,
      },
    }
  }

  if (
    organization.status !==
    'active'
  ) {
    throw new ApiError(
      403,
      'Host Marketplace organization is not active.',
      [
        {
          code:
            'MARKETPLACE_ORGANIZATION_NOT_ACTIVE',
        },
      ],
    )
  }

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

  if (
    packId
  ) {
    filter.packId =
      packId
  }

  if (
    search
  ) {
    const expression =
      new RegExp(
        escapeRegex(
          search,
        ),
        'i',
      )

    filter.$or = [
      {
        merchantSku:
          expression,
      },

      {
        offerKey:
          expression,
      },

      {
        externalReference:
          expression,
      },
    ]
  }

  const skip =
    (
      page -
      1
    ) *
    limit

  const [
    offers,
    total,
  ] =
    await Promise.all([
      HostOffer.find(
        filter,
      )
        .sort({
          updatedAt:
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

      HostOffer.countDocuments(
        filter,
      ),
    ])

  return {
    organization:
      serializeMarketplaceOrganization(
        organization,
      ),

    offers:
      offers.map(
        serializeHostOffer,
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

/*
|--------------------------------------------------------------------------
| Get Owned Host Offer
|--------------------------------------------------------------------------
*/

export async function getHostOffer(
  offerId,
  actorUser,
) {
  const organization =
    await requireActiveHostMarketplaceOrganization(
      actorUser,
    )

  const offer =
    await HostOffer.findOne(
      buildOwnedHostOfferFilter({
        offerId,

        organizationId:
          organization._id,
      }),
    ).lean()

  /*
  |--------------------------------------------------------------------------
  | Cross-Host resources are intentionally concealed as 404.
  |--------------------------------------------------------------------------
  */

  if (
    !offer
  ) {
    throw new ApiError(
      404,
      'Host Offer was not found.',
      [
        {
          code:
            'MARKETPLACE_OFFER_NOT_FOUND',
        },
      ],
    )
  }

  return {
    organization:
      serializeMarketplaceOrganization(
        organization,
      ),

    offer:
      serializeHostOffer(
        offer,
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Retire Canonical Publication When Last Host Listing Is Deleted
|--------------------------------------------------------------------------
|
| Host Offer deletion is a commercial retirement, not a hard-delete of
| governed catalog history. However, when the retired Offer was the final
| non-retired Offer for a Pack, leaving its ProductVersion published causes
| stale canonical records to block a future re-listing of the same GTIN as a
| cross-Pack duplicate.
|
| Keep immutable history, but retire the currently published ProductVersion
| once no Host has a draft/active/paused Offer for the Pack. Another Host
| listing the same Pack therefore protects the canonical publication.
|
*/

async function retirePublishedPackVersionIfUnlisted({
  packId,
  actorUserId,
}) {
  const remainingOffer =
    await HostOffer.exists({
      packId,

      status: {
        $ne:
          'retired',
      },
    })

  if (remainingOffer) {
    return {
      retiredCount:
        0,
    }
  }

  const now =
    new Date()

  const result =
    await ProductVersion.updateMany(
      {
        packId,

        publicationStatus:
          'published',
      },
      {
        $set: {
          publicationStatus:
            'retired',

          effectiveTo:
            now,

          retiredAt:
            now,

          retiredByUserId:
            actorUserId,

          retireReason:
            'Automatically retired because the final Host listing for this Pack was deleted.',
        },
      },
    )

  return {
    retiredCount:
      result.modifiedCount ||
      0,
  }
}

/*
|--------------------------------------------------------------------------
| Update Owned Host Offer
|--------------------------------------------------------------------------
*/

export async function updateHostOffer(
  offerId,
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

  const offer =
    await HostOffer.findOne(
      buildOwnedHostOfferFilter({
        offerId,

        organizationId:
          organization._id,
      }),
    )

  if (
    !offer
  ) {
    throw new ApiError(
      404,
      'Host Offer was not found.',
      [
        {
          code:
            'MARKETPLACE_OFFER_NOT_FOUND',
        },
      ],
    )
  }

  if (
    offer.status ===
    'retired'
  ) {
    throw new ApiError(
      409,
      'A retired Host Offer cannot be modified.',
      [
        {
          code:
            'MARKETPLACE_OFFER_RETIRED',
        },
      ],
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Re-verify canonical eligibility for normal edits.
  |--------------------------------------------------------------------------
  | A retirement-only mutation must remain possible even when the canonical
  | Pack has itself become ineligible; otherwise a Host could be trapped with
  | an undeletable commercial listing.
  |--------------------------------------------------------------------------
  */

  const retirementOnly =
    input.status ===
      'retired' &&
    Object.keys(
      input,
    ).every(
      (key) =>
        key ===
        'status',
    )

  if (!retirementOnly) {
    await validateOfferCanonicalPack(
      offer.packId,
    )
  }

  for (
    const [
      key,
      value,
    ] of Object.entries(
      input,
    )
  ) {
    offer[key] =
      value
  }

  offer.updatedByUserId =
    actorUserId

  try {
    await offer.save()
  } catch (error) {
    if (
      duplicateKeyError(
        error,
      )
    ) {
      throw new ApiError(
        409,
        'Merchant SKU already exists inside this Host organization.',
        [
          {
            code:
              'MARKETPLACE_OFFER_SKU_DUPLICATE',
          },
        ],
      )
    }

    throw error
  }

  if (retirementOnly) {
    await retirePublishedPackVersionIfUnlisted({
      packId:
        offer.packId,

      actorUserId,
    })
  }

  await notifyActiveSuperAdminsBestEffort({
    triggerType:
      'host_listing_updated',
    reasonCode:
      'host_grocery_listing_updated',
    explanation: `${organization.displayName || actorDisplayName(actorUser)} updated a Grocery marketplace listing${retirementOnly ? ' and retired it' : ''}.`,
    relatedEntityType:
      'host_grocery_listing',
    relatedEntityId:
      stringifyId(
        offer._id,
      ),
    sourceDomain:
      'marketplace',
    sourceVersion:
      'host-offer-v1',
    dedupeScope: `host-offer-updated:${stringifyId(offer._id)}:${String(offer.updatedAt?.getTime?.() || Date.now())}`,
  })

  return {
    organization:
      serializeMarketplaceOrganization(
        organization,
      ),

    offer:
      serializeHostOffer(
        offer,
      ),
  }
}