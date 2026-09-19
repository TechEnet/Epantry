import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  HostOffer,
  InventoryNode,
  InventorySnapshot,
  PriceRule,
  ServiceArea,
} from './marketplace.models.js'

import {
  buildEffectivePriceRuleFilter,
} from './marketplace.pricing.service.js'

import {
  buildOwnedHostOfferFilter,
  requireActiveHostMarketplaceOrganization,
  serializeHostOffer,
  validateOfferCanonicalPack,
} from './marketplace.host.service.js'

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

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
| Offer Readiness
|--------------------------------------------------------------------------
|
| Activation is intentionally explicit.
|
| Host cannot set status=active through generic PATCH.
|
| Readiness requires:
|
| - canonical M04 Pack still published
| - effective Price Rule
| - active Service Area
| - active Inventory Node reachable by Service Area
| - at least one Inventory Snapshot
|
| Stock may currently be zero. Active Offer != in-stock Offer.
|
| Public eligibility independently requires sellable stock > 0.
|--------------------------------------------------------------------------
*/

export async function inspectHostOfferReadiness(
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
      'Retired Host Offer cannot be activated.',
      [
        {
          code:
            'MARKETPLACE_OFFER_RETIRED',
        },
      ],
    )
  }

  await validateOfferCanonicalPack(
    offer.packId,
  )

  const now =
    new Date()

  const effectivePrice =
    await PriceRule.findOne(
      buildEffectivePriceRuleFilter({
        organizationId:
          organization._id,

        offerId:
          offer._id,

        at:
          now,
      }),
    )
      .sort({
        effectiveFrom:
          -1,

        _id:
          -1,
      })
      .lean()

  const activeNodes =
    await InventoryNode.find({
      organizationId:
        organization._id,

      status:
        'active',
    })
      .select({
        _id:
          1,
      })
      .lean()

  const activeNodeIds =
    activeNodes.map(
      (
        node,
      ) =>
        node._id,
    )

  const serviceAreas =
    await ServiceArea.find({
      organizationId:
        organization._id,

      status:
        'active',
    })
      .select({
        inventoryNodeId:
          1,

        postalCodes:
          1,

        fulfillmentTypes:
          1,
      })
      .lean()

  const activeNodeIdSet =
    new Set(
      activeNodeIds.map(
        String,
      ),
    )

  const serviceableNodeIds =
    new Set()

  for (
    const serviceArea of
    serviceAreas
  ) {
    if (
      serviceArea.inventoryNodeId
    ) {
      const nodeId =
        String(
          serviceArea.inventoryNodeId,
        )

      if (
        activeNodeIdSet.has(
          nodeId,
        )
      ) {
        serviceableNodeIds.add(
          nodeId,
        )
      }

      continue
    }

    for (
      const nodeId of
      activeNodeIdSet
    ) {
      serviceableNodeIds.add(
        nodeId,
      )
    }
  }

  let inventorySnapshot =
    null

  if (
    serviceableNodeIds.size >
    0
  ) {
    inventorySnapshot =
      await InventorySnapshot.findOne({
        organizationId:
          organization._id,

        offerId:
          offer._id,

        inventoryNodeId: {
          $in: [
            ...serviceableNodeIds,
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
  }

  const checks = {
    canonicalPublished:
      true,

    effectivePrice:
      Boolean(
        effectivePrice,
      ),

    serviceArea:
      serviceAreas.length >
      0,

    activeInventoryNode:
      activeNodeIds.length >
      0,

    serviceableInventoryNode:
      serviceableNodeIds.size >
      0,

    inventorySnapshot:
      Boolean(
        inventorySnapshot,
      ),
  }

  const ready =
    Object.values(
      checks,
    ).every(
      Boolean,
    )

  return {
    organizationId:
      String(
        organization._id,
      ),

    offer:
      serializeHostOffer(
        offer,
      ),

    ready,

    checks,
  }
}

/*
|--------------------------------------------------------------------------
| Activate Offer
|--------------------------------------------------------------------------
*/

export async function activateHostOffer(
  offerId,
  actorUser,
) {
  const readiness =
    await inspectHostOfferReadiness(
      offerId,
      actorUser,
    )

  if (
    !readiness.ready
  ) {
    throw new ApiError(
      409,
      'Host Offer is not commercially ready for activation.',
      [
        {
          code:
            'MARKETPLACE_OFFER_NOT_READY',

          checks:
            readiness.checks,
        },
      ],
    )
  }

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
    'active'
  ) {
    return {
      offer:
        serializeHostOffer(
          offer,
        ),

      readiness,
    }
  }

  offer.status =
    'active'

  offer.updatedByUserId =
    actorIdFromUser(
      actorUser,
    )

  await offer.save()

  return {
    offer:
      serializeHostOffer(
        offer,
      ),

    readiness,
  }
}