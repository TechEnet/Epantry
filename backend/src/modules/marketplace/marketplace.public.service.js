import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  Pack,
  ProductVersion,
} from '../catalog/catalog.models.js'

import {
  HostOffer,
  InventoryNode,
  InventorySnapshot,
  MarketplaceOrganization,
  PriceRule,
  ServiceArea,
} from './marketplace.models.js'

import {
  normalizePostalCode,
} from './marketplace.constants.js'

import {
  buildCurrentPublishedPackVersionFilter,
} from './marketplace.host.service.js'

import {
  resolveFulfillmentIntersection,
  resolveServiceAreaInventoryNodeIds,
} from './marketplace.serviceability.service.js'

/*
|--------------------------------------------------------------------------
| Pure Eligibility
|--------------------------------------------------------------------------
*/

export function isPublicOfferEligible({
  organization,
  offer,
  priceRule,
  serviceable,
  sellableQuantity,
}) {
  return (
    organization?.status ===
      'active' &&
    offer?.status ===
      'active' &&
    Boolean(
      priceRule,
    ) &&
    serviceable ===
      true &&
    Number(
      sellableQuantity ||
        0,
    ) >
      0
  )
}

/*
|--------------------------------------------------------------------------
| Public Serializer
|--------------------------------------------------------------------------
|
| Do not expose:
|
| ownerUserId
| createdByUserId
| sourceReference
| internal Inventory Node details
| private Service Area definitions
|--------------------------------------------------------------------------
*/

export function serializePublicEligibleOffer({
  organization,
  offer,
  priceRule,
  fulfillmentTypes,
  sellableQuantity,
  latestObservedAt,
  at,
}) {
  const effectiveAmountMinor =
    priceRule.salePrice
      ?.amountMinor ??
    priceRule.listPrice
      ?.amountMinor ??
    null

  const currency =
    priceRule.salePrice
      ?.currency ||
    priceRule.listPrice
      ?.currency ||
    null

  const observedAt =
    latestObservedAt
      ? new Date(
          latestObservedAt,
        )
      : null

  const inventoryAgeSeconds =
    observedAt
      ? Math.max(
          0,
          Math.floor(
            (
              at.getTime() -
              observedAt.getTime()
            ) /
              1000,
          ),
        )
      : null

  return {
    id:
      String(
        offer._id,
      ),

    packId:
      String(
        offer.packId,
      ),

    seller: {
      name:
        organization.displayName,

      slug:
        organization.slug,
    },

    merchantSku:
      offer.merchantSku ||
      '',

    price: {
      listAmountMinor:
        priceRule
          .listPrice
          .amountMinor,

      saleAmountMinor:
        priceRule.salePrice
          ?.amountMinor ??
        null,

      effectiveAmountMinor,

      currency,

      effectiveFrom:
        priceRule.effectiveFrom,

      effectiveTo:
        priceRule.effectiveTo ||
        null,

      recordedAt:
        priceRule.createdAt ||
        null,
    },

    availability:
      sellableQuantity >
      0
        ? 'in_stock'
        : 'out_of_stock',

    /*
    |--------------------------------------------------------------------------
    | Exact stock quantity remains internal.
    |--------------------------------------------------------------------------
    */

    inventoryObservedAt:
      observedAt,

    inventoryAgeSeconds,

    fulfillmentTypes,

    minimumOrderQuantity:
      offer.minimumOrderQuantity,

    maximumOrderQuantity:
      offer.maximumOrderQuantity ??
      null,
  }
}

/*
|--------------------------------------------------------------------------
| Public Canonical Pack Gate
|--------------------------------------------------------------------------
*/

async function requirePublicCanonicalPack(
  packId,
  now,
) {
  const pack =
    await Pack.findOne({
      _id:
        packId,

      status:
        'active',
    })
      .select({
        _id:
          1,

        variantId:
          1,

        packKey:
          1,
      })
      .lean()

  if (
    !pack
  ) {
    throw new ApiError(
      404,
      'Product was not found.',
      [
        {
          code:
            'PUBLIC_MARKETPLACE_PRODUCT_NOT_FOUND',
        },
      ],
    )
  }

  const publishedVersion =
    await ProductVersion.findOne(
      buildCurrentPublishedPackVersionFilter(
        pack._id,
        now,
      ),
    )
      .sort({
        version:
          -1,
      })
      .select({
        _id:
          1,

        version:
          1,

        packId:
          1,
      })
      .lean()

  if (
    !publishedVersion
  ) {
    throw new ApiError(
      404,
      'Product was not found.',
      [
        {
          code:
            'PUBLIC_MARKETPLACE_PRODUCT_NOT_FOUND',
        },
      ],
    )
  }

  return {
    pack,

    publishedVersion,
  }
}

/*
|--------------------------------------------------------------------------
| Public Eligible Offers
|--------------------------------------------------------------------------
*/

export async function listPublicEligibleOffers({
  packId,
  pincode,
  fulfillmentType,
}) {
  const now =
    new Date()

  const normalizedPincode =
    normalizePostalCode(
      pincode,
    )

  await requirePublicCanonicalPack(
    packId,
    now,
  )

  const offers =
    await HostOffer.find({
      packId,

      status:
        'active',
    })
      .select({
        organizationId:
          1,

        packId:
          1,

        merchantSku:
          1,

        fulfillmentTypes:
          1,

        minimumOrderQuantity:
          1,

        maximumOrderQuantity:
          1,

        status:
          1,
      })
      .lean()

  if (
    offers.length ===
    0
  ) {
    return {
      packId,

      pincode:
        normalizedPincode,

      offers:
        [],
    }
  }

  const organizationIds = [
    ...new Set(
      offers.map(
        (
          offer,
        ) =>
          String(
            offer.organizationId,
          ),
      ),
    ),
  ]

  const organizations =
    await MarketplaceOrganization.find({
      _id: {
        $in:
          organizationIds,
      },

      status:
        'active',
    })
      .select({
        displayName:
          1,

        slug:
          1,

        status:
          1,
      })
      .lean()

  const organizationById =
    new Map(
      organizations.map(
        (
          organization,
        ) => [
          String(
            organization._id,
          ),
          organization,
        ],
      ),
    )

  const activeOffers =
    offers.filter(
      (
        offer,
      ) =>
        organizationById.has(
          String(
            offer.organizationId,
          ),
        ),
    )

  if (
    activeOffers.length ===
    0
  ) {
    return {
      packId,

      pincode:
        normalizedPincode,

      offers:
        [],
    }
  }

  const offerIds =
    activeOffers.map(
      (
        offer,
      ) =>
        offer._id,
    )

  const activeOrganizationIds =
    organizations.map(
      (
        organization,
      ) =>
        organization._id,
    )

  const [
    priceRules,
    serviceAreas,
    activeInventoryNodes,
  ] =
    await Promise.all([
      PriceRule.find({
        organizationId: {
          $in:
            activeOrganizationIds,
        },

        offerId: {
          $in:
            offerIds,
        },

        status: {
          $ne:
            'disabled',
        },

        effectiveFrom: {
          $lte:
            now,
        },

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
      })
        .sort({
          effectiveFrom:
            -1,

          _id:
            -1,
        })
        .lean(),

      ServiceArea.find({
        organizationId: {
          $in:
            activeOrganizationIds,
        },

        status:
          'active',

        postalCodes:
          normalizedPincode,
      })
        .select({
          organizationId:
            1,

          inventoryNodeId:
            1,

          fulfillmentTypes:
            1,
        })
        .lean(),

      InventoryNode.find({
        organizationId: {
          $in:
            activeOrganizationIds,
        },

        status:
          'active',
      })
        .select({
          organizationId:
            1,

          _id:
            1,
        })
        .lean(),
    ])

  /*
  |--------------------------------------------------------------------------
  | Newest effective Price Rule per Organization + Offer
  |--------------------------------------------------------------------------
  */

  const priceByOffer =
    new Map()

  for (
    const priceRule of
    priceRules
  ) {
    const key =
      `${priceRule.organizationId}:${priceRule.offerId}`

    if (
      !priceByOffer.has(
        key,
      )
    ) {
      priceByOffer.set(
        key,
        priceRule,
      )
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Active Nodes per Organization
  |--------------------------------------------------------------------------
  */

  const nodeIdsByOrganization =
    new Map()

  for (
    const node of
    activeInventoryNodes
  ) {
    const organizationId =
      String(
        node.organizationId,
      )

    if (
      !nodeIdsByOrganization.has(
        organizationId,
      )
    ) {
      nodeIdsByOrganization.set(
        organizationId,
        [],
      )
    }

    nodeIdsByOrganization
      .get(
        organizationId,
      )
      .push(
        String(
          node._id,
        ),
      )
  }

  const serviceAreasByOrganization =
    new Map()

  for (
    const serviceArea of
    serviceAreas
  ) {
    const organizationId =
      String(
        serviceArea.organizationId,
      )

    if (
      !serviceAreasByOrganization.has(
        organizationId,
      )
    ) {
      serviceAreasByOrganization.set(
        organizationId,
        [],
      )
    }

    serviceAreasByOrganization
      .get(
        organizationId,
      )
      .push(
        serviceArea,
      )
  }

  /*
  |--------------------------------------------------------------------------
  | Determine eligible Nodes per Offer
  |--------------------------------------------------------------------------
  */

  const candidateContexts =
    []

  const allCandidateNodeIds =
    new Set()

  for (
    const offer of
    activeOffers
  ) {
    const organizationId =
      String(
        offer.organizationId,
      )

    const organization =
      organizationById.get(
        organizationId,
      )

    const priceRule =
      priceByOffer.get(
        `${organizationId}:${offer._id}`,
      )

    if (
      !organization ||
      !priceRule
    ) {
      continue
    }

    const areas =
      serviceAreasByOrganization.get(
        organizationId,
      ) ||
      []

    const activeNodeIds =
      nodeIdsByOrganization.get(
        organizationId,
      ) ||
      []

    const eligibleNodeIds =
      new Set()

    const eligibleFulfillmentTypes =
      new Set()

    for (
      const serviceArea of
      areas
    ) {
      const fulfillmentTypes =
        resolveFulfillmentIntersection({
          offerFulfillmentTypes:
            offer.fulfillmentTypes,

          serviceAreaFulfillmentTypes:
            serviceArea.fulfillmentTypes,

          requestedFulfillmentType:
            fulfillmentType,
        })

      if (
        fulfillmentTypes.length ===
        0
      ) {
        continue
      }

      const nodeIds =
        resolveServiceAreaInventoryNodeIds({
          serviceArea,

          activeInventoryNodeIds:
            activeNodeIds,
        })

      for (
        const nodeId of
        nodeIds
      ) {
        eligibleNodeIds.add(
          nodeId,
        )

        allCandidateNodeIds.add(
          nodeId,
        )
      }

      for (
        const type of
        fulfillmentTypes
      ) {
        eligibleFulfillmentTypes.add(
          type,
        )
      }
    }

    if (
      eligibleNodeIds.size ===
      0
    ) {
      continue
    }

    candidateContexts.push({
      organization,

      offer,

      priceRule,

      eligibleNodeIds,

      fulfillmentTypes: [
        ...eligibleFulfillmentTypes,
      ],
    })
  }

  if (
    candidateContexts.length ===
    0
  ) {
    return {
      packId,

      pincode:
        normalizedPincode,

      offers:
        [],
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Latest Inventory Snapshot per Organization + Offer + Node
  |--------------------------------------------------------------------------
  */

  const snapshots =
    await InventorySnapshot.find({
      organizationId: {
        $in:
          activeOrganizationIds,
      },

      offerId: {
        $in:
          offerIds,
      },

      inventoryNodeId: {
        $in: [
          ...allCandidateNodeIds,
        ],
      },
    })
      .sort({
        observedAt:
          -1,

        _id:
          -1,
      })
      .lean()

  const latestSnapshotByKey =
    new Map()

  for (
    const snapshot of
    snapshots
  ) {
    const key =
      `${snapshot.organizationId}:${snapshot.offerId}:${snapshot.inventoryNodeId}`

    if (
      !latestSnapshotByKey.has(
        key,
      )
    ) {
      latestSnapshotByKey.set(
        key,
        snapshot,
      )
    }
  }

  const eligibleOffers =
    []

  for (
    const context of
    candidateContexts
  ) {
    let sellableQuantity =
      0

    let latestObservedAt =
      null

    for (
      const nodeId of
      context.eligibleNodeIds
    ) {
      const key =
        `${context.offer.organizationId}:${context.offer._id}:${nodeId}`

      const snapshot =
        latestSnapshotByKey.get(
          key,
        )

      if (
        !snapshot
      ) {
        continue
      }

      const nodeSellable =
        Math.max(
          0,
          Number(
            snapshot.availableQuantity ||
              0,
          ) -
            Number(
              snapshot.reservedQuantity ||
                0,
            ),
        )

      sellableQuantity +=
        nodeSellable

      if (
        !latestObservedAt ||
        new Date(
          snapshot.observedAt,
        ) >
          new Date(
            latestObservedAt,
          )
      ) {
        latestObservedAt =
          snapshot.observedAt
      }
    }

    if (
      !isPublicOfferEligible({
        organization:
          context.organization,

        offer:
          context.offer,

        priceRule:
          context.priceRule,

        serviceable:
          true,

        sellableQuantity,
      })
    ) {
      continue
    }

    eligibleOffers.push(
      serializePublicEligibleOffer({
        ...context,

        sellableQuantity,

        latestObservedAt,

        at:
          now,
      }),
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Organic Deterministic Ordering
  |--------------------------------------------------------------------------
  |
  | Lowest effective commercial price first.
  |
  | No sponsored / affiliate override exists here.
  |--------------------------------------------------------------------------
  */

  eligibleOffers.sort(
    (
      left,
      right,
    ) => {
      const priceDifference =
        left.price
          .effectiveAmountMinor -
        right.price
          .effectiveAmountMinor

      if (
        priceDifference !==
        0
      ) {
        return priceDifference
      }

      return left.seller.name.localeCompare(
        right.seller.name,
      )
    },
  )

  return {
    packId:
      String(
        packId,
      ),

    pincode:
      normalizedPincode,

    requestedFulfillmentType:
      fulfillmentType ||
      null,

    offers:
      eligibleOffers,
  }
}