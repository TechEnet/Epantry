import mongoose from 'mongoose'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  ProductVersion,
} from '../catalog/catalog.models.js'

import {
  DeliveryAddress,
} from '../deliveryAddresses/deliveryAddress.models.js'

import {
  HostOffer,
  InventoryNode,
  InventorySnapshot,
  MarketplaceOrganization,
  ServiceArea,
} from '../marketplace/marketplace.models.js'

import {
  getSellableQuantity,
} from '../marketplace/marketplace.inventory.service.js'

import {
  listPublicEligibleOffers,
} from '../marketplace/marketplace.public.service.js'

import {
  normalizePostalCode,
} from '../marketplace/marketplace.constants.js'

import {
  resolveFulfillmentIntersection,
  resolveServiceAreaInventoryNodeIds,
} from '../marketplace/marketplace.serviceability.service.js'

import {
  getOutcomePlan,
} from '../outcomes/outcomePlan.service.js'

import {
  requireCurrentPantryHousehold,
  requireOrProvisionDirectCommerceHousehold,
} from '../pantry/pantry.service.js'

import {
  MarketplaceCart,
} from './commerce.models.js'

import {
  createMarketplaceCart,
  getBasketQuote,
  getMarketplaceCart,
} from './commerce.service.js'

import {
  ExternalHandoff,
  InventoryReservation,
  InventoryReservationState,
  ParentOrder,
  SellerOrder,
} from './commerce.transaction.models.js'

const DEFAULT_RESERVATION_TTL_SECONDS =
  10 * 60

const MIN_RESERVATION_TTL_SECONDS =
  60

const MAX_RESERVATION_TTL_SECONDS =
  60 * 60

function stringifyId(
  value,
) {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return null
  }

  return String(
    value,
  )
}

function actorIdFromUser(
  actorUser,
) {
  const actorUserId =
    actorUser?._id ||
    actorUser?.id

  if (
    !actorUserId
  ) {
    throw new ApiError(
      401,
      'Authenticated user identity is required.',
      [
        {
          code:
            'COMMERCE_ACTOR_REQUIRED',
        },
      ],
    )
  }

  return actorUserId
}

function cleanSnapshotText(
  value,
) {
  return String(
    value ||
      '',
  ).trim()
}

async function resolveDeliveryAddressSnapshot({
  deliveryAddressId,
  ownerUserId,
  cart,
  now =
    new Date(),
}) {
  const fulfillmentType =
    cart?.fulfillmentType ||
    'delivery'

  if (
    fulfillmentType !==
    'delivery'
  ) {
    return null
  }

  if (
    !deliveryAddressId ||
    !mongoose.Types.ObjectId.isValid(
      deliveryAddressId,
    )
  ) {
    throw new ApiError(
      409,
      'Choose a delivery address before continuing to payment.',
      [
        {
          code:
            'CHECKOUT_DELIVERY_ADDRESS_REQUIRED',
        },
      ],
    )
  }

  const address =
    await DeliveryAddress
      .findOne({
        _id:
          deliveryAddressId,

        userId:
          ownerUserId,

        status:
          'active',
      })
      .lean()

  if (!address) {
    throw new ApiError(
      404,
      'The selected delivery address is no longer available.',
      [
        {
          code:
            'CHECKOUT_DELIVERY_ADDRESS_NOT_FOUND',
        },
      ],
    )
  }

  const addressPincode =
    normalizePostalCode(
      address.postalCode,
    )

  const cartPincode =
    normalizePostalCode(
      cart?.pincode,
    )

  if (
    !addressPincode ||
    !cartPincode ||
    addressPincode !==
      cartPincode
  ) {
    throw new ApiError(
      409,
      'The selected delivery address does not match the pincode used for this Cart. Choose an address for the same pincode and try again.',
      [
        {
          code:
            'CHECKOUT_DELIVERY_ADDRESS_PINCODE_MISMATCH',

          cartPincode:
            cartPincode ||
            null,

          addressPincode:
            addressPincode ||
            null,
        },
      ],
    )
  }

  return {
    sourceAddressId:
      address._id,

    recipientType:
      address.recipientType ||
      'self',

    recipientName:
      cleanSnapshotText(
        address.recipientName,
      ),

    phone:
      cleanSnapshotText(
        address.phone,
      ),

    label:
      cleanSnapshotText(
        address.label,
      ) ||
      'home',

    customLabel:
      cleanSnapshotText(
        address.customLabel,
      ),

    addressLine1:
      cleanSnapshotText(
        address.addressLine1,
      ),

    addressLine2:
      cleanSnapshotText(
        address.addressLine2,
      ),

    area:
      cleanSnapshotText(
        address.area,
      ),

    landmark:
      cleanSnapshotText(
        address.landmark,
      ),

    city:
      cleanSnapshotText(
        address.city,
      ),

    state:
      cleanSnapshotText(
        address.state,
      ),

    postalCode:
      addressPincode,

    country:
      cleanSnapshotText(
        address.country,
      ) ||
      'India',

    deliveryInstructions:
      cleanSnapshotText(
        address.deliveryInstructions,
      ),

    capturedAt:
      now,
  }
}

function currentPublishedVersionFilter(
  now,
) {
  return {
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

function reservationTtlSeconds() {
  const parsed =
    Number(
      process.env.COMMERCE_RESERVATION_TTL_SECONDS,
    )

  if (
    !Number.isFinite(
      parsed,
    )
  ) {
    return DEFAULT_RESERVATION_TTL_SECONDS
  }

  return Math.min(
    MAX_RESERVATION_TTL_SECONDS,
    Math.max(
      MIN_RESERVATION_TTL_SECONDS,
      Math.floor(
        parsed,
      ),
    ),
  )
}

function checkoutExpiryFromNow(
  now,
) {
  return new Date(
    new Date(
      now,
    ).getTime() +
      reservationTtlSeconds() *
        1000,
  )
}

function toPlain(
  value,
) {
  if (
    value &&
    typeof value.toObject ===
      'function'
  ) {
    return value.toObject()
  }

  return value
}

function buildOrderTotals(
  cart,
) {
  return {
    itemSubtotalMinor:
      cart.itemSubtotalMinor,

    knownFeesMinor:
      cart.knownFeesMinor ??
      null,

    totalLandedCostMinor:
      cart.totalLandedCostMinor ??
      null,

    landedCostCompleteness:
      cart.landedCostCompleteness,

    currency:
      cart.currency,
  }
}

function checkoutReadiness(
  cart,
) {
  const blockers = []

  if (
    cart.landedCostCompleteness !==
      'complete' ||
    !Number.isInteger(
      Number(
        cart.totalLandedCostMinor,
      ),
    )
  ) {
    blockers.push(
      'LANDED_COST_INCOMPLETE',
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Current M05 does not contain governed seller cancellation/return policies.
  | We fail closed instead of inventing them.
  |--------------------------------------------------------------------------
  */

  blockers.push(
    'SELLER_POLICIES_NOT_CONFIGURED',
  )

  return {
    paymentReady:
      blockers.length ===
      0,

    blockers,
  }
}

/*
|--------------------------------------------------------------------------
| One Retailer integrity
|--------------------------------------------------------------------------
*/

export async function createValidatedMarketplaceCart({
  basketQuoteId,
  optionKey,
  idempotencyKey,
  actorUser,
}) {
  const quoteData =
    await getBasketQuote({
      quoteId:
        basketQuoteId,

      actorUser,
    })

  const option =
    (
      quoteData.options ||
      []
    ).find(
      (
        item,
      ) =>
        item.optionKey ===
        optionKey,
    )

  if (
    !option
  ) {
    throw new ApiError(
      400,
      'Selected basket quote option does not exist.',
      [
        {
          code:
            'BASKET_QUOTE_OPTION_INVALID',
        },
      ],
    )
  }

  if (
    optionKey ===
      'one_retailer' &&
    option.objectiveSatisfied !==
      true
  ) {
    throw new ApiError(
      409,
      'One Retailer is not available for every requirement. Choose a transparent split option instead.',
      [
        {
          code:
            'ONE_RETAILER_OBJECTIVE_NOT_SATISFIED',
        },
      ],
    )
  }

  return createMarketplaceCart({
    basketQuoteId,
    optionKey,
    idempotencyKey,
    actorUser,
  })
}

/*
|--------------------------------------------------------------------------
| Direct Product Cart
|--------------------------------------------------------------------------
|
| PDP purchase intentionally bypasses Outcome/Basket planning because the
| customer has already selected one exact canonical Pack and one eligible
| Host Offer. Server truth is re-read here; client price/inventory is ignored.
|--------------------------------------------------------------------------
*/

export async function createDirectMarketplaceCart({
  cartId =
    null,
  packId,
  offerId,
  quantity,
  pincode,
  fulfillmentType,
  idempotencyKey,
  actorUser,
  now =
    new Date(),
}) {
  const ownerUserId =
    actorIdFromUser(
      actorUser,
    )

  const {
    householdId,
  } =
    await requireOrProvisionDirectCommerceHousehold(
      actorUser,
    )

  const existing =
    await MarketplaceCart
      .findOne({
        ownerUserId,

        createIdempotencyKey:
          idempotencyKey,
      })
      .lean()

  if (
    existing
  ) {
    return getMarketplaceCart({
      cartId:
        existing._id,

      actorUser,
    })
  }

  const normalizedPincode =
    normalizePostalCode(
      pincode,
    )

  const requestedQuantity =
    Number(
      quantity,
    )

  const publicResult =
    await listPublicEligibleOffers({
      packId,
      pincode:
        normalizedPincode,
      fulfillmentType:
        fulfillmentType ||
        undefined,
    })

  const currentOffer =
    (
      publicResult.offers ||
      []
    ).find(
      (
        candidate,
      ) =>
        stringifyId(
          candidate.id,
        ) ===
        stringifyId(
          offerId,
        ),
    )

  if (
    !currentOffer
  ) {
    throw new ApiError(
      409,
      'Selected offer is no longer eligible for this product and pincode.',
      [
        {
          code:
            'DIRECT_CART_OFFER_NOT_ELIGIBLE',

          offerId:
            stringifyId(
              offerId,
            ),
        },
      ],
    )
  }

  const minimumOrderQuantity =
    Number(
      currentOffer.minimumOrderQuantity ||
      1,
    )

  const maximumOrderQuantity =
    currentOffer.maximumOrderQuantity ===
      null ||
    currentOffer.maximumOrderQuantity ===
      undefined
      ? null
      : Number(
          currentOffer.maximumOrderQuantity,
        )

  if (
    !Number.isInteger(
      requestedQuantity,
    ) ||
    requestedQuantity <
      1 ||
    requestedQuantity <
      minimumOrderQuantity ||
    (
      maximumOrderQuantity !==
        null &&
      requestedQuantity >
        maximumOrderQuantity
    )
  ) {
    throw new ApiError(
      400,
      'Requested quantity is outside the active Offer order limits.',
      [
        {
          code:
            'DIRECT_CART_QUANTITY_INVALID',

          minimumOrderQuantity,
          maximumOrderQuantity,
        },
      ],
    )
  }

  const [
    offer,
    productVersion,
    nodeCapacity,
  ] =
    await Promise.all([
      HostOffer
        .findOne({
          _id:
            offerId,

          packId,

          status:
            'active',
        })
        .select({
          _id:
            1,

          packId:
            1,

          organizationId:
            1,
        })
        .lean(),

      ProductVersion
        .findOne({
          packId,

          ...currentPublishedVersionFilter(
            now,
          ),
        })
        .sort({
          version:
            -1,
        })
        .select({
          _id:
            1,

          displayName:
            1,

          packId:
            1,

          netQuantity:
            1,
        })
        .lean(),

      loadServiceableNodeCapacity({
        offerId,
        pincode:
          normalizedPincode,
        fulfillmentType:
          fulfillmentType ||
          undefined,
      }),
    ])

  if (
    !offer ||
    !productVersion
  ) {
    throw new ApiError(
      409,
      'Selected product or Offer is no longer available for direct purchase.',
      [
        {
          code:
            'DIRECT_CART_PRODUCT_STALE',
        },
      ],
    )
  }

  const sellableQuantity =
    nodeCapacity.reduce(
      (
        total,
        node,
      ) =>
        total +
        Number(
          node.sellableQuantity ||
          0,
        ),
      0,
    )

  if (
    sellableQuantity <
    requestedQuantity
  ) {
    throw new ApiError(
      409,
      'Selected inventory is no longer sufficient for this quantity.',
      [
        {
          code:
            'DIRECT_CART_INVENTORY_CHANGED',

          offerId:
            stringifyId(
              offerId,
            ),
        },
      ],
    )
  }

  const packQuantity =
    Number(
      productVersion.netQuantity?.value,
    )

  const packUnit =
    String(
      productVersion.netQuantity?.unit ||
      '',
    ).trim()

  if (
    !Number.isFinite(
      packQuantity,
    ) ||
    packQuantity <=
      0 ||
    !packUnit
  ) {
    throw new ApiError(
      409,
      'Published product pack quantity is incomplete.',
      [
        {
          code:
            'DIRECT_CART_PACK_QUANTITY_INVALID',
        },
      ],
    )
  }

  const unitPriceMinor =
    Number(
      currentOffer.price?.effectiveAmountMinor,
    )

  if (
    !Number.isInteger(
      unitPriceMinor,
    ) ||
    unitPriceMinor <
      0
  ) {
    throw new ApiError(
      409,
      'Selected Offer does not have a valid current price.',
      [
        {
          code:
            'DIRECT_CART_PRICE_INVALID',
        },
      ],
    )
  }

  const currency =
    currentOffer.price?.currency ||
    'INR'

  const suppliedQuantity =
    packQuantity *
    requestedQuantity

  const lineTotalMinor =
    unitPriceMinor *
    requestedQuantity

  const directCartItem =
    {
      requirementLineId:
        null,

      productMatchId:
        null,

      canonicalIngredientId:
        null,

      displayName:
        productVersion.displayName ||
        'Marketplace product',

      productVersionId:
        productVersion._id,

      packId:
        productVersion.packId,

      offerId:
        offer._id,

      organizationId:
        offer.organizationId,

      sellerName:
        currentOffer.seller?.name ||
        'Marketplace Host',

      packCount:
        requestedQuantity,

      packQuantity,
      packUnit,

      requiredQuantity:
        suppliedQuantity,

      requiredUnit:
        packUnit,

      suppliedQuantity,

      surplusQuantity:
        0,

      unitPrice: {
        amountMinor:
          unitPriceMinor,

        currency,
      },

      lineTotal: {
        amountMinor:
          lineTotalMinor,

        currency,
      },

      priceRecordedAt:
        currentOffer.price?.recordedAt ||
        null,

      inventoryObservedAt:
        currentOffer.inventoryObservedAt ||
        null,
    }

  const requestedFulfillmentType =
    fulfillmentType ||
    'delivery'

  let activeDirectCart =
    null

  if (
    cartId &&
    mongoose.Types.ObjectId.isValid(
      String(
        cartId,
      ),
    )
  ) {
    activeDirectCart =
      await MarketplaceCart
        .findOne({
          _id:
            cartId,

          ownerUserId,
          householdId,

          sourceType:
            'direct_product',

          status:
            'draft',
        })

    if (
      activeDirectCart &&
      (
        String(
          activeDirectCart.pincode ||
          '',
        ) !==
          String(
            normalizedPincode,
          ) ||
        String(
          activeDirectCart.fulfillmentType ||
          'delivery',
        ) !==
          String(
            requestedFulfillmentType,
          )
      )
    ) {
      throw new ApiError(
        409,
        'Your active Marketplace Cart uses a different delivery context. Keep one pincode and fulfillment type for items in the same order.',
        [
          {
            code:
              'DIRECT_CART_DELIVERY_CONTEXT_MISMATCH',

            cartId:
              stringifyId(
                activeDirectCart._id,
              ),

            cartPincode:
              activeDirectCart.pincode,

            requestedPincode:
              normalizedPincode,
          },
        ],
      )
    }
  }

  if (
    !activeDirectCart
  ) {
    activeDirectCart =
      await MarketplaceCart
        .findOne({
          ownerUserId,
          householdId,

          sourceType:
            'direct_product',

          pincode:
            normalizedPincode,

          fulfillmentType:
            requestedFulfillmentType,

          status:
            'draft',
        })
        .sort({
          updatedAt:
            -1,
        })
  }

  if (
    activeDirectCart
  ) {
    if (
      String(
        activeDirectCart.currency ||
        'INR',
      ) !==
      String(
        currency,
      )
    ) {
      throw new ApiError(
        409,
        'The active Marketplace Cart uses a different currency.',
        [
          {
            code:
              'DIRECT_CART_CURRENCY_MISMATCH',
          },
        ],
      )
    }

    const existingLine =
      (
        activeDirectCart.items ||
        []
      ).find(
        (
          item,
        ) =>
          stringifyId(
            item.packId,
          ) ===
            stringifyId(
              productVersion.packId,
            ) &&
          stringifyId(
            item.offerId,
          ) ===
            stringifyId(
              offer._id,
            ),
      )

    if (
      existingLine
    ) {
      const combinedPackCount =
        Number(
          existingLine.packCount ||
          0,
        ) +
        requestedQuantity

      if (
        combinedPackCount <
          minimumOrderQuantity ||
        (
          maximumOrderQuantity !==
            null &&
          combinedPackCount >
            maximumOrderQuantity
        )
      ) {
        throw new ApiError(
          400,
          'Requested quantity is outside the active Offer order limits.',
          [
            {
              code:
                'DIRECT_CART_QUANTITY_INVALID',

              minimumOrderQuantity,
              maximumOrderQuantity,
            },
          ],
        )
      }

      if (
        sellableQuantity <
        combinedPackCount
      ) {
        throw new ApiError(
          409,
          'Selected inventory is no longer sufficient for this quantity.',
          [
            {
              code:
                'DIRECT_CART_INVENTORY_CHANGED',

              offerId:
                stringifyId(
                  offerId,
                ),
            },
          ],
        )
      }

      const combinedSuppliedQuantity =
        packQuantity *
        combinedPackCount

      existingLine.packCount =
        combinedPackCount

      existingLine.packQuantity =
        packQuantity

      existingLine.packUnit =
        packUnit

      existingLine.requiredQuantity =
        combinedSuppliedQuantity

      existingLine.requiredUnit =
        packUnit

      existingLine.suppliedQuantity =
        combinedSuppliedQuantity

      existingLine.surplusQuantity =
        0

      existingLine.unitPrice =
        {
          amountMinor:
            unitPriceMinor,

          currency,
        }

      existingLine.lineTotal =
        {
          amountMinor:
            unitPriceMinor *
            combinedPackCount,

          currency,
        }

      existingLine.priceRecordedAt =
        currentOffer.price?.recordedAt ||
        null

      existingLine.inventoryObservedAt =
        currentOffer.inventoryObservedAt ||
        null
    } else {
      activeDirectCart.items.push(
        directCartItem,
      )
    }

    activeDirectCart.itemSubtotalMinor =
      (
        activeDirectCart.items ||
        []
      ).reduce(
        (
          total,
          item,
        ) =>
          total +
          Number(
            item.lineTotal?.amountMinor ||
            0,
          ),
        0,
      )

    activeDirectCart.sellerCount =
      new Set(
        (
          activeDirectCart.items ||
          []
        ).map(
          (
            item,
          ) =>
            stringifyId(
              item.organizationId,
            ),
        ),
      ).size

    activeDirectCart.knownFeesMinor =
      null

    activeDirectCart.totalLandedCostMinor =
      null

    activeDirectCart.landedCostCompleteness =
      'item_prices_only'

    activeDirectCart.createIdempotencyKey =
      idempotencyKey

    try {
      await activeDirectCart.save()
    } catch (
      error
    ) {
      if (
        error?.code ===
        11000
      ) {
        const duplicate =
          await MarketplaceCart
            .findOne({
              ownerUserId,

              createIdempotencyKey:
                idempotencyKey,
            })
            .lean()

        if (
          duplicate
        ) {
          return getMarketplaceCart({
            cartId:
              duplicate._id,

            actorUser,
          })
        }
      }

      throw error
    }

    return getMarketplaceCart({
      cartId:
        activeDirectCart._id,

      actorUser,
    })
  }

  let cart

  try {
    cart =
      await MarketplaceCart.create({
        ownerUserId,
        householdId,

        sourceType:
          'direct_product',

        outcomePlanId:
          null,

        outcomePlanRevision:
          null,

        basketQuoteId:
          null,

        optionKey:
          null,

        pincode:
          normalizedPincode,

        fulfillmentType:
          requestedFulfillmentType,

        items: [
          directCartItem,
        ],

        itemSubtotalMinor:
          lineTotalMinor,

        knownFeesMinor:
          null,

        totalLandedCostMinor:
          null,

        landedCostCompleteness:
          'item_prices_only',

        currency,

        sellerCount:
          1,

        status:
          'draft',

        createIdempotencyKey:
          idempotencyKey,
      })
  } catch (
    error
  ) {
    if (
      error?.code ===
      11000
    ) {
      const duplicate =
        await MarketplaceCart
          .findOne({
            ownerUserId,

            createIdempotencyKey:
              idempotencyKey,
          })
          .lean()

      if (
        duplicate
      ) {
        return getMarketplaceCart({
          cartId:
            duplicate._id,

          actorUser,
        })
      }
    }

    throw error
  }

  return getMarketplaceCart({
    cartId:
      cart._id,

    actorUser,
  })
}


export async function updateDirectMarketplaceCartItem({
  cartId,
  itemId,
  operation,
  quantity,
  actorUser,
}) {
  const ownerUserId =
    actorIdFromUser(
      actorUser,
    )

  const {
    householdId,
  } =
    await requireCurrentPantryHousehold(
      actorUser,
    )

  const cart =
    await MarketplaceCart
      .findOne({
        _id:
          cartId,

        ownerUserId,
        householdId,

        sourceType:
          'direct_product',

        status:
          'draft',
      })

  if (
    !cart
  ) {
    throw new ApiError(
      404,
      'Active direct Marketplace Cart was not found.',
      [
        {
          code:
            'DIRECT_CART_NOT_FOUND',
        },
      ],
    )
  }

  const item =
    cart.items.id(
      itemId,
    ) ||
    (
      cart.items ||
      []
    ).find(
      (
        cartItem,
      ) =>
        stringifyId(
          cartItem.packId,
        ) ===
        stringifyId(
          itemId,
        ),
    )

  if (
    !item
  ) {
    throw new ApiError(
      404,
      'Marketplace Cart item was not found.',
      [
        {
          code:
            'DIRECT_CART_ITEM_NOT_FOUND',
        },
      ],
    )
  }

  if (
    operation ===
      'remove'
  ) {
    item.deleteOne()
  } else if (
    operation ===
      'decrement'
  ) {
    const currentPackCount =
      Number(
        item.packCount ||
        0,
      )

    if (
      !Number.isInteger(
        currentPackCount,
      ) ||
      currentPackCount <=
        1
    ) {
      throw new ApiError(
        400,
        'Cart item quantity cannot be decreased below one pack.',
        [
          {
            code:
              'DIRECT_CART_ITEM_MINIMUM_QUANTITY',
          },
        ],
      )
    }

    const offer =
      await HostOffer
        .findOne({
          _id:
            item.offerId,

          packId:
            item.packId,

          status:
            'active',
        })
        .select({
          minimumOrderQuantity:
            1,
        })
        .lean()

    if (
      !offer
    ) {
      throw new ApiError(
        409,
        'The Offer for this Cart item is no longer active.',
        [
          {
            code:
              'DIRECT_CART_ITEM_OFFER_STALE',
          },
        ],
      )
    }

    const minimumOrderQuantity =
      Number(
        offer.minimumOrderQuantity ||
        1,
      )

    const nextPackCount =
      currentPackCount -
      1

    if (
      nextPackCount <
      minimumOrderQuantity
    ) {
      throw new ApiError(
        400,
        'Cart item quantity cannot be decreased below the Offer minimum.',
        [
          {
            code:
              'DIRECT_CART_ITEM_MINIMUM_QUANTITY',

            minimumOrderQuantity,
          },
        ],
      )
    }

    const packQuantity =
      Number(
        item.packQuantity ||
        0,
      )

    const unitPriceMinor =
      Number(
        item.unitPrice?.amountMinor ||
        0,
      )

    item.packCount =
      nextPackCount

    item.requiredQuantity =
      packQuantity *
      nextPackCount

    item.suppliedQuantity =
      packQuantity *
      nextPackCount

    item.surplusQuantity =
      0

    item.lineTotal = {
      amountMinor:
        unitPriceMinor *
        nextPackCount,

      currency:
        item.unitPrice?.currency ||
        cart.currency ||
        'INR',
    }
  } else if (
    operation ===
      'set_quantity'
  ) {
    const nextPackCount =
      Number(
        quantity,
      )

    if (
      !Number.isInteger(
        nextPackCount,
      ) ||
      nextPackCount <
        1
    ) {
      throw new ApiError(
        400,
        'Cart item quantity must be a positive whole number.',
        [
          {
            code:
              'DIRECT_CART_ITEM_QUANTITY_INVALID',
          },
        ],
      )
    }

    const offer =
      await HostOffer
        .findOne({
          _id:
            item.offerId,

          packId:
            item.packId,

          status:
            'active',
        })
        .select({
          minimumOrderQuantity:
            1,

          maximumOrderQuantity:
            1,
        })
        .lean()

    if (
      !offer
    ) {
      throw new ApiError(
        409,
        'The Offer for this Cart item is no longer active.',
        [
          {
            code:
              'DIRECT_CART_ITEM_OFFER_STALE',
          },
        ],
      )
    }

    const minimumOrderQuantity =
      Math.max(
        1,
        Number(
          offer.minimumOrderQuantity ||
          1,
        ),
      )

    const maximumOrderQuantity =
      offer.maximumOrderQuantity ===
        null ||
      offer.maximumOrderQuantity ===
        undefined
        ? null
        : Number(
            offer.maximumOrderQuantity,
          )

    if (
      nextPackCount <
        minimumOrderQuantity ||
      (
        maximumOrderQuantity !==
          null &&
        nextPackCount >
          maximumOrderQuantity
      )
    ) {
      throw new ApiError(
        400,
        'Requested quantity is outside the active Offer order limits.',
        [
          {
            code:
              'DIRECT_CART_QUANTITY_INVALID',

            minimumOrderQuantity,
            maximumOrderQuantity,
          },
        ],
      )
    }

    const nodeCapacity =
      await loadServiceableNodeCapacity({
        offerId:
          item.offerId,

        pincode:
          cart.pincode,

        fulfillmentType:
          cart.fulfillmentType ||
          undefined,
      })

    const sellableQuantity =
      nodeCapacity.reduce(
        (
          total,
          node,
        ) =>
          total +
          Number(
            node.sellableQuantity ||
            0,
          ),
        0,
      )

    if (
      sellableQuantity <
      nextPackCount
    ) {
      throw new ApiError(
        409,
        'Selected inventory is no longer sufficient for this quantity.',
        [
          {
            code:
              'DIRECT_CART_INVENTORY_CHANGED',

            offerId:
              stringifyId(
                item.offerId,
              ),
          },
        ],
      )
    }

    const packQuantity =
      Number(
        item.packQuantity ||
        0,
      )

    const unitPriceMinor =
      Number(
        item.unitPrice?.amountMinor ||
        0,
      )

    item.packCount =
      nextPackCount

    item.requiredQuantity =
      packQuantity *
      nextPackCount

    item.suppliedQuantity =
      packQuantity *
      nextPackCount

    item.surplusQuantity =
      0

    item.lineTotal = {
      amountMinor:
        unitPriceMinor *
        nextPackCount,

      currency:
        item.unitPrice?.currency ||
        cart.currency ||
        'INR',
    }
  } else {
    throw new ApiError(
      400,
      'Unsupported direct Cart item operation.',
      [
        {
          code:
            'DIRECT_CART_ITEM_OPERATION_INVALID',
        },
      ],
    )
  }

  cart.itemSubtotalMinor =
    (
      cart.items ||
      []
    ).reduce(
      (
        total,
        cartItem,
      ) =>
        total +
        Number(
          cartItem.lineTotal?.amountMinor ||
          0,
        ),
      0,
    )

  cart.sellerCount =
    new Set(
      (
        cart.items ||
        []
      ).map(
        (
          cartItem,
        ) =>
          stringifyId(
            cartItem.organizationId,
          ),
      ),
    ).size

  cart.knownFeesMinor =
    null

  cart.totalLandedCostMinor =
    null

  cart.landedCostCompleteness =
    'item_prices_only'

  await cart.save()

  return getMarketplaceCart({
    cartId:
      cart._id,

    actorUser,
  })
}

/*
|--------------------------------------------------------------------------
| Serviceable node capacity
|--------------------------------------------------------------------------
*/

async function loadServiceableNodeCapacity({
  offerId,
  pincode,
  fulfillmentType,
  session,
}) {
  const normalizedPincode =
    normalizePostalCode(
      pincode,
    )

  const offer =
    await HostOffer
      .findOne({
        _id:
          offerId,

        status:
          'active',
      })
      .session(
        session ||
        null,
      )
      .lean()

  if (
    !offer
  ) {
    return []
  }

  const organization =
    await MarketplaceOrganization
      .findOne({
        _id:
          offer.organizationId,

        status:
          'active',
      })
      .session(
        session ||
        null,
      )
      .lean()

  if (
    !organization
  ) {
    return []
  }

  const [
    serviceAreas,
    activeNodes,
  ] =
    await Promise.all([
      ServiceArea
        .find({
          organizationId:
            organization._id,

          status:
            'active',

          postalCodes:
            normalizedPincode,
        })
        .session(
          session ||
          null,
        )
        .lean(),

      InventoryNode
        .find({
          organizationId:
            organization._id,

          status:
            'active',
        })
        .session(
          session ||
          null,
        )
        .lean(),
    ])

  const activeNodeIds =
    activeNodes.map(
      (
        node,
      ) =>
        stringifyId(
          node._id,
        ),
    )

  const eligibleNodeIds =
    new Set()

  for (
    const serviceArea
    of serviceAreas
  ) {
    const supported =
      resolveFulfillmentIntersection({
        offerFulfillmentTypes:
          offer.fulfillmentTypes,

        serviceAreaFulfillmentTypes:
          serviceArea.fulfillmentTypes,

        requestedFulfillmentType:
          fulfillmentType ||
          undefined,
      })

    if (
      supported.length ===
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
      const nodeId
      of nodeIds
    ) {
      eligibleNodeIds.add(
        stringifyId(
          nodeId,
        ),
      )
    }
  }

  if (
    eligibleNodeIds.size ===
    0
  ) {
    return []
  }

  const snapshots =
    await InventorySnapshot
      .find({
        organizationId:
          organization._id,

        offerId:
          offer._id,

        inventoryNodeId: {
          $in: [
            ...eligibleNodeIds,
          ],
        },
      })
      .sort({
        observedAt:
          -1,

        _id:
          -1,
      })
      .session(
        session ||
        null,
      )
      .lean()

  const latestByNode =
    new Map()

  for (
    const snapshot
    of snapshots
  ) {
    const nodeId =
      stringifyId(
        snapshot.inventoryNodeId,
      )

    if (
      !latestByNode.has(
        nodeId,
      )
    ) {
      latestByNode.set(
        nodeId,
        snapshot,
      )
    }
  }

  return [
    ...latestByNode.values(),
  ]
    .map(
      (
        snapshot,
      ) => ({
        organizationId:
          organization._id,

        offerId:
          offer._id,

        inventoryNodeId:
          snapshot.inventoryNodeId,

        availableQuantity:
          Number(
            snapshot.availableQuantity ||
            0,
          ),

        baselineReservedQuantity:
          Number(
            snapshot.reservedQuantity ||
            0,
          ),

        sellableQuantity:
          getSellableQuantity(
            snapshot,
          ),

        inventoryObservedAt:
          snapshot.observedAt ||
          null,
      }),
    )
    .sort(
      (
        left,
        right,
      ) => {
        if (
          right.sellableQuantity !==
          left.sellableQuantity
        ) {
          return (
            right.sellableQuantity -
            left.sellableQuantity
          )
        }

        const rightTime =
          right.inventoryObservedAt
            ? new Date(
                right.inventoryObservedAt,
              ).getTime()
            : 0

        const leftTime =
          left.inventoryObservedAt
            ? new Date(
                left.inventoryObservedAt,
              ).getTime()
            : 0

        if (
          rightTime !==
          leftTime
        ) {
          return (
            rightTime -
            leftTime
          )
        }

        return stringifyId(
          left.inventoryNodeId,
        ).localeCompare(
          stringifyId(
            right.inventoryNodeId,
          ),
        )
      },
    )
}

/*
|--------------------------------------------------------------------------
| Reservation expiry
|--------------------------------------------------------------------------
*/

async function expireReservation({
  reservationId,
  now,
  session,
}) {
  const expired =
    await InventoryReservation
      .findOneAndUpdate(
        {
          _id:
            reservationId,

          status:
            'active',

          expiresAt: {
            $lte:
              now,
          },
        },
        {
          $set: {
            status:
              'expired',

            releasedAt:
              now,

            releaseReason:
              'reservation_expired',
          },
        },
        {
          new:
            false,

          session,
        },
      )
      .lean()

  if (
    !expired
  ) {
    return false
  }

  await InventoryReservationState.updateOne(
    {
      offerId:
        expired.offerId,

      inventoryNodeId:
        expired.inventoryNodeId,

      checkoutReservedQuantity: {
        $gte:
          expired.quantity,
      },
    },
    {
      $inc: {
        checkoutReservedQuantity:
          -expired.quantity,
      },
    },
    {
      session,
    },
  )

  return true
}

async function expireNodeReservations({
  offerId,
  inventoryNodeId,
  now,
  session,
}) {
  const expired =
    await InventoryReservation
      .find({
        offerId,
        inventoryNodeId,

        status:
          'active',

        expiresAt: {
          $lte:
            now,
        },
      })
      .select({
        _id:
          1,
      })
      .session(
        session ||
        null,
      )
      .lean()

  for (
    const reservation
    of expired
  ) {
    await expireReservation({
      reservationId:
        reservation._id,

      now,
      session,
    })
  }
}

async function expireParentOrderReservations({
  parentOrderId,
  now,
}) {
  const session =
    await mongoose.startSession()

  try {
    await session.withTransaction(
      async () => {
        const expired =
          await InventoryReservation
            .find({
              parentOrderId,

              status:
                'active',

              expiresAt: {
                $lte:
                  now,
              },
            })
            .select({
              _id:
                1,
            })
            .session(
              session,
            )
            .lean()

        for (
          const reservation
          of expired
        ) {
          await expireReservation({
            reservationId:
              reservation._id,

            now,
            session,
          })
        }
      },
    )
  } finally {
    await session.endSession()
  }
}

/*
|--------------------------------------------------------------------------
| Reservation state synchronization
|--------------------------------------------------------------------------
*/

async function synchronizeReservationState({
  node,
  now,
  session,
}) {
  await expireNodeReservations({
    offerId:
      node.offerId,

    inventoryNodeId:
      node.inventoryNodeId,

    now,
    session,
  })

  await InventoryReservationState.updateOne(
    {
      offerId:
        node.offerId,

      inventoryNodeId:
        node.inventoryNodeId,
    },
    {
      $setOnInsert: {
        organizationId:
          node.organizationId,

        offerId:
          node.offerId,

        inventoryNodeId:
          node.inventoryNodeId,

        checkoutReservedQuantity:
          0,
      },

      $set: {
        organizationId:
          node.organizationId,

        capacityAvailableQuantity:
          node.availableQuantity,

        capacityBaselineReservedQuantity:
          node.baselineReservedQuantity,

        capacitySellableQuantity:
          node.sellableQuantity,

        inventoryObservedAt:
          node.inventoryObservedAt,
      },
    },
    {
      upsert:
        true,

      session,
    },
  )

  return InventoryReservationState
    .findOne({
      offerId:
        node.offerId,

      inventoryNodeId:
        node.inventoryNodeId,
    })
    .session(
      session,
    )
    .lean()
}

async function reserveNodeQuantity({
  node,
  quantity,
  now,
  session,
}) {
  const state =
    await synchronizeReservationState({
      node,
      now,
      session,
    })

  const currentlyAvailable =
    Math.max(
      0,
      Number(
        state.capacitySellableQuantity ||
        0,
      ) -
        Number(
          state.checkoutReservedQuantity ||
          0,
        ),
    )

  if (
    currentlyAvailable <
    quantity
  ) {
    return null
  }

  return InventoryReservationState
    .findOneAndUpdate(
      {
        offerId:
          node.offerId,

        inventoryNodeId:
          node.inventoryNodeId,

        $expr: {
          $lte: [
            {
              $add: [
                '$checkoutReservedQuantity',
                quantity,
              ],
            },
            '$capacitySellableQuantity',
          ],
        },
      },
      {
        $inc: {
          checkoutReservedQuantity:
            quantity,
        },
      },
      {
        new:
          true,

        session,
      },
    )
    .lean()
}

async function allocateCartItem({
  item,
  cart,
  now,
  session,
}) {
  const nodeCapacity =
    await loadServiceableNodeCapacity({
      offerId:
        item.offerId,

      pincode:
        cart.pincode,

      fulfillmentType:
        cart.fulfillmentType ||
        undefined,

      session,
    })

  if (
    nodeCapacity.length ===
    0
  ) {
    throw new ApiError(
      409,
      'Selected cart inventory is no longer serviceable.',
      [
        {
          code:
            'CHECKOUT_SERVICEABILITY_CHANGED',

          offerId:
            stringifyId(
              item.offerId,
            ),
        },
      ],
    )
  }

  let remaining =
    Number(
      item.packCount,
    )

  const allocations = []

  for (
    const node
    of nodeCapacity
  ) {
    if (
      remaining <=
      0
    ) {
      break
    }

    const state =
      await synchronizeReservationState({
        node,
        now,
        session,
      })

    const available =
      Math.max(
        0,
        Number(
          state.capacitySellableQuantity ||
          0,
        ) -
          Number(
            state.checkoutReservedQuantity ||
            0,
          ),
      )

    const quantity =
      Math.min(
        remaining,
        available,
      )

    if (
      quantity <=
      0
    ) {
      continue
    }

    const reservedState =
      await reserveNodeQuantity({
        node,
        quantity,
        now,
        session,
      })

    if (
      !reservedState
    ) {
      throw new ApiError(
        409,
        'Selected inventory changed during checkout. Refresh the comparison before retrying.',
        [
          {
            code:
              'CHECKOUT_INVENTORY_CONTENTION',

            offerId:
              stringifyId(
                item.offerId,
              ),
          },
        ],
      )
    }

    allocations.push({
      inventoryNodeId:
        node.inventoryNodeId,

      quantity,

      inventoryObservedAt:
        node.inventoryObservedAt,
    })

    remaining -=
      quantity
  }

  if (
    remaining >
    0
  ) {
    throw new ApiError(
      409,
      'Selected inventory is no longer sufficient for checkout.',
      [
        {
          code:
            'CHECKOUT_INVENTORY_CHANGED',

          offerId:
            stringifyId(
              item.offerId,
            ),
        },
      ],
    )
  }

  return allocations
}

/*
|--------------------------------------------------------------------------
| Price / offer revalidation
|--------------------------------------------------------------------------
*/

async function revalidateCartItem({
  item,
  cart,
}) {
  const result =
    await listPublicEligibleOffers({
      packId:
        item.packId,

      pincode:
        cart.pincode,

      fulfillmentType:
        cart.fulfillmentType ||
        undefined,
    })

  const offer =
    (
      result.offers ||
      []
    ).find(
      (
        candidate,
      ) =>
        stringifyId(
          candidate.id,
        ) ===
        stringifyId(
          item.offerId,
        ),
    )

  if (
    !offer
  ) {
    throw new ApiError(
      409,
      'Cart is stale because a selected offer is no longer eligible.',
      [
        {
          code:
            'CHECKOUT_OFFER_STALE',

          offerId:
            stringifyId(
              item.offerId,
            ),
        },
      ],
    )
  }

  const currentPriceMinor =
    Number(
      offer.price?.effectiveAmountMinor,
    )

  if (
    currentPriceMinor !==
    Number(
      item.unitPrice?.amountMinor,
    )
  ) {
    throw new ApiError(
      409,
      'Cart is stale because a selected price changed.',
      [
        {
          code:
            'CHECKOUT_PRICE_CHANGED',

          offerId:
            stringifyId(
              item.offerId,
            ),
        },
      ],
    )
  }

  return offer
}

/*
|--------------------------------------------------------------------------
| Checkout
|--------------------------------------------------------------------------
|
| Current M05 has no governed delivery-fee or seller policy source.
| Therefore payment remains blocked until that truth is complete.
|--------------------------------------------------------------------------
*/

export async function createCheckout({
  cartId,
  deliveryAddressId =
    null,
  idempotencyKey,
  actorUser,
  now =
    new Date(),
}) {
  const ownerUserId =
    actorIdFromUser(
      actorUser,
    )

  const {
    householdId,
  } =
    await requireCurrentPantryHousehold(
      actorUser,
    )

  const existing =
    await ParentOrder
      .findOne({
        ownerUserId,

        createIdempotencyKey:
          idempotencyKey,
      })
      .lean()

  if (
    existing
  ) {
    return getParentOrder({
      orderId:
        existing._id,

      actorUser,
      now,
    })
  }

  const cart =
    await MarketplaceCart
      .findOne({
        _id:
          cartId,

        ownerUserId,

        householdId,

        status: {
          $in: [
            'draft',
            'checkout_pending',
          ],
        },
      })

  if (
    !cart
  ) {
    throw new ApiError(
      404,
      'Marketplace Cart was not found.',
      [
        {
          code:
            'MARKETPLACE_CART_NOT_FOUND',
        },
      ],
    )
  }

  const deliveryAddressSnapshot =
    await resolveDeliveryAddressSnapshot({
      deliveryAddressId,
      ownerUserId,
      cart,
      now,
    })

  const cartSourceType =
    cart.sourceType ||
    'basket_quote'

  if (
    cartSourceType ===
    'basket_quote'
  ) {
    const outcome =
      await getOutcomePlan({
        planId:
          cart.outcomePlanId,

        actorUser,
      })

    if (
      Number(
        outcome.plan.revision,
      ) !==
      Number(
        cart.outcomePlanRevision,
      )
    ) {
      throw new ApiError(
        409,
        'Cart is stale because the Outcome Plan changed.',
        [
          {
            code:
              'CHECKOUT_OUTCOME_PLAN_CHANGED',
          },
        ],
      )
    }
  }

  if (
    !Array.isArray(
      cart.items,
    ) ||
    cart.items.length ===
      0
  ) {
    throw new ApiError(
      409,
      'Empty Marketplace Cart cannot enter checkout.',
      [
        {
          code:
            'CHECKOUT_CART_EMPTY',
        },
      ],
    )
  }

  for (
    const item
    of cart.items
  ) {
    await revalidateCartItem({
      item,
      cart,
    })
  }

  const readiness =
    checkoutReadiness(
      cart,
    )

  const parentOrderId =
    new mongoose.Types.ObjectId()

  const grouped =
    new Map()

  for (
    const item
    of cart.items
  ) {
    const organizationId =
      stringifyId(
        item.organizationId,
      )

    if (
      !grouped.has(
        organizationId,
      )
    ) {
      grouped.set(
        organizationId,
        {
          _id:
            new mongoose.Types.ObjectId(),

          organizationId:
            item.organizationId,

          sellerName:
            item.sellerName,

          items:
            [],
        },
      )
    }

    grouped
      .get(
        organizationId,
      )
      .items
      .push(
        item,
      )
  }

  const reservationExpiresAt =
    readiness.paymentReady
      ? checkoutExpiryFromNow(
          now,
        )
      : null

  const session =
    await mongoose.startSession()

  try {
    await session.withTransaction(
      async () => {
        const sellerOrderDocuments =
          []

        const reservationDocuments =
          []

        for (
          const group
          of grouped.values()
        ) {
          const sellerItems =
            []

          for (
            const item
            of group.items
          ) {
            let allocations =
              []

            if (
              readiness.paymentReady
            ) {
              allocations =
                await allocateCartItem({
                  item,
                  cart,
                  now,
                  session,
                })

              for (
                const allocation
                of allocations
              ) {
                reservationDocuments.push({
                  ownerUserId,
                  householdId,

                  marketplaceCartId:
                    cart._id,

                  parentOrderId,

                  sellerOrderId:
                    group._id,

                  cartItemId:
                    item._id,

                  organizationId:
                    item.organizationId,

                  offerId:
                    item.offerId,

                  inventoryNodeId:
                    allocation.inventoryNodeId,

                  quantity:
                    allocation.quantity,

                  status:
                    'active',

                  expiresAt:
                    reservationExpiresAt,

                  idempotencyKey,
                })
              }
            }

            sellerItems.push({
              cartItemId:
                item._id,

              requirementLineId:
                item.requirementLineId,

              productMatchId:
                item.productMatchId,

              canonicalIngredientId:
                item.canonicalIngredientId ||
                null,

              displayName:
                item.displayName ||
                '',

              productVersionId:
                item.productVersionId,

              packId:
                item.packId,

              offerId:
                item.offerId,

              packCount:
                item.packCount,

              packQuantity:
                item.packQuantity,

              packUnit:
                item.packUnit,

              requiredQuantity:
                item.requiredQuantity,

              requiredUnit:
                item.requiredUnit,

              suppliedQuantity:
                item.suppliedQuantity,

              surplusQuantity:
                item.surplusQuantity,

              unitPrice:
                item.unitPrice,

              lineTotal:
                item.lineTotal,

              priceRecordedAt:
                item.priceRecordedAt ||
                null,

              inventoryObservedAt:
                item.inventoryObservedAt ||
                null,

              reservationAllocations:
                allocations.map(
                  (
                    allocation,
                  ) => ({
                    inventoryNodeId:
                      allocation.inventoryNodeId,

                    quantity:
                      allocation.quantity,
                  }),
                ),
            })
          }

          const itemSubtotalMinor =
            sellerItems.reduce(
              (
                total,
                item,
              ) =>
                total +
                Number(
                  item.lineTotal.amountMinor,
                ),
              0,
            )

          sellerOrderDocuments.push({
            _id:
              group._id,

            parentOrderId,

            organizationId:
              group.organizationId,

            sellerName:
              group.sellerName,

            items:
              sellerItems,

            commercialSnapshot: {
              itemSubtotalMinor,

              knownFeesMinor:
                null,

              totalLandedCostMinor:
                null,

              landedCostCompleteness:
                cart.landedCostCompleteness,

              currency:
                cart.currency,
            },

            fulfillment: {
              fulfillmentType:
                cart.fulfillmentType ||
                null,

              pincode:
                cart.pincode,

              deliveryAddressSnapshot,

              promiseState:
                cart.landedCostCompleteness ===
                'complete'
                  ? 'serviceable'
                  : 'needs_fee_quote',

              cancellationPolicyState:
                'not_configured',

              returnPolicyState:
                'not_configured',
            },

            status:
              readiness.paymentReady
                ? 'payment_pending'
                : 'draft',

            reservationExpiresAt,
          })
        }

        await ParentOrder.create(
          [
            {
              _id:
                parentOrderId,

              ownerUserId,
              householdId,

              sourceType:
                cartSourceType,

              outcomePlanId:
                cart.outcomePlanId ||
                null,

              outcomePlanRevision:
                cart.outcomePlanRevision ??
                null,

              marketplaceCartId:
                cart._id,

              sellerOrderIds:
                sellerOrderDocuments.map(
                  (
                    order,
                  ) =>
                    order._id,
                ),

              externalHandoffIds:
                [],

              totals:
                buildOrderTotals(
                  cart,
                ),

              deliveryAddressSnapshot,

              status:
                readiness.paymentReady
                  ? 'payment_pending'
                  : 'draft',

              paymentStatus:
                readiness.paymentReady
                  ? 'pending'
                  : 'not_started',

              paymentProvider:
                'razorpay',

              paymentReady:
                readiness.paymentReady,

              checkoutBlockers:
                readiness.blockers,

              reservationExpiresAt,

              createIdempotencyKey:
                idempotencyKey,
            },
          ],
          {
            session,
          },
        )

        if (
          sellerOrderDocuments.length >
          0
        ) {
          await SellerOrder.insertMany(
            sellerOrderDocuments,
            {
              session,
            },
          )
        }

        if (
          reservationDocuments.length >
          0
        ) {
          await InventoryReservation.insertMany(
            reservationDocuments,
            {
              session,
            },
          )
        }

        if (
          readiness.paymentReady
        ) {
          cart.status =
            'checkout_pending'

          await cart.save({
            session,
          })
        }
      },
    )
  } catch (
    error
  ) {
    if (
      error?.code ===
      11000
    ) {
      const duplicate =
        await ParentOrder
          .findOne({
            ownerUserId,

            createIdempotencyKey:
              idempotencyKey,
          })
          .lean()

      if (
        duplicate
      ) {
        return getParentOrder({
          orderId:
            duplicate._id,

          actorUser,
          now,
        })
      }
    }

    throw error
  } finally {
    await session.endSession()
  }

  return getParentOrder({
    orderId:
      parentOrderId,

    actorUser,
    now,
  })
}

export async function ensureCheckoutDeliveryAddressSnapshot({
  parentOrderId,
  deliveryAddressId,
  actorUser,
  now =
    new Date(),
}) {
  const ownerUserId =
    actorIdFromUser(
      actorUser,
    )

  const {
    householdId,
  } =
    await requireCurrentPantryHousehold(
      actorUser,
    )

  const order =
    await ParentOrder
      .findOne({
        _id:
          parentOrderId,

        ownerUserId,
        householdId,
      })
      .lean()

  if (!order) {
    throw new ApiError(
      404,
      'Order was not found.',
      [
        {
          code:
            'PARENT_ORDER_NOT_FOUND',
        },
      ],
    )
  }

  if (
    ![
      'draft',
      'payment_pending',
    ].includes(
      order.status,
    )
  ) {
    return getParentOrder({
      orderId:
        order._id,
      actorUser,
      now,
    })
  }

  const cart =
    await MarketplaceCart
      .findOne({
        _id:
          order.marketplaceCartId,

        ownerUserId,
        householdId,
      })
      .lean()

  if (!cart) {
    throw new ApiError(
      404,
      'Marketplace Cart was not found.',
      [
        {
          code:
            'MARKETPLACE_CART_NOT_FOUND',
        },
      ],
    )
  }

  const deliveryAddressSnapshot =
    await resolveDeliveryAddressSnapshot({
      deliveryAddressId,
      ownerUserId,
      cart,
      now,
    })

  if (!deliveryAddressSnapshot) {
    return getParentOrder({
      orderId:
        order._id,
      actorUser,
      now,
    })
  }

  const session =
    await mongoose.startSession()

  try {
    await session.withTransaction(
      async () => {
        await ParentOrder.updateOne(
          {
            _id:
              order._id,

            ownerUserId,
            householdId,

            status: {
              $in: [
                'draft',
                'payment_pending',
              ],
            },
          },
          {
            $set: {
              deliveryAddressSnapshot,
            },
          },
          {
            session,
          },
        )

        await SellerOrder.updateMany(
          {
            parentOrderId:
              order._id,

            'fulfillment.fulfillmentType':
              'delivery',

            status: {
              $in: [
                'draft',
                'payment_pending',
              ],
            },
          },
          {
            $set: {
              'fulfillment.deliveryAddressSnapshot':
                deliveryAddressSnapshot,
            },
          },
          {
            session,
          },
        )
      },
    )
  } finally {
    await session.endSession()
  }

  return getParentOrder({
    orderId:
      order._id,
    actorUser,
    now,
  })
}

/*
|--------------------------------------------------------------------------
| External retailer handoff adapter boundary
|--------------------------------------------------------------------------
|
| No customer API accepts arbitrary redirect URLs.
|--------------------------------------------------------------------------
*/

export async function recordExternalHandoffFromAdapter({
  ownerUserId,
  householdId,
  outcomePlanId,
  parentOrderId =
    null,
  partnerId,
  destinationUrl,
  items =
    [],
  attribution =
    {},
  now =
    new Date(),
  session =
    null,
}) {
  let parsedUrl

  try {
    parsedUrl =
      new URL(
        destinationUrl,
      )
  } catch {
    throw new ApiError(
      500,
      'Partner adapter returned an invalid handoff destination.',
      [
        {
          code:
            'EXTERNAL_HANDOFF_DESTINATION_INVALID',
        },
      ],
    )
  }

  if (
    parsedUrl.protocol !==
    'https:'
  ) {
    throw new ApiError(
      500,
      'Partner adapter handoff destination must use HTTPS.',
      [
        {
          code:
            'EXTERNAL_HANDOFF_DESTINATION_INSECURE',
        },
      ],
    )
  }

  const [
    handoff,
  ] =
    await ExternalHandoff.create(
      [
        {
          ownerUserId,
          householdId,
          outcomePlanId,
          parentOrderId,
          partnerId,

          targetType:
            'retailer',

          items,

          destinationUrl:
            parsedUrl.toString(),

          attribution,

          handedOffAt:
            now,
        },
      ],
      {
        session:
          session ||
          undefined,
      },
    )

  return handoff
}

function serializeSellerOrder(
  raw,
) {
  const order =
    toPlain(
      raw,
    )

  return {
    id:
      stringifyId(
        order._id,
      ),

    organizationId:
      stringifyId(
        order.organizationId,
      ),

    sellerName:
      order.sellerName,

    status:
      order.status,

    commercialSnapshot:
      order.commercialSnapshot,

    fulfillment:
      order.fulfillment,

    reservationExpiresAt:
      order.reservationExpiresAt ||
      null,

    items:
      (
        order.items ||
        []
      ).map(
        (
          item,
        ) => ({
          cartItemId:
            stringifyId(
              item.cartItemId,
            ),

          requirementLineId:
            stringifyId(
              item.requirementLineId,
            ),

          productMatchId:
            stringifyId(
              item.productMatchId,
            ),

          canonicalIngredientId:
            stringifyId(
              item.canonicalIngredientId,
            ),

          displayName:
            item.displayName ||
            '',

          productVersionId:
            stringifyId(
              item.productVersionId,
            ),

          packId:
            stringifyId(
              item.packId,
            ),

          offerId:
            stringifyId(
              item.offerId,
            ),

          packCount:
            item.packCount,

          packQuantity:
            item.packQuantity,

          packUnit:
            item.packUnit,

          requiredQuantity:
            item.requiredQuantity,

          requiredUnit:
            item.requiredUnit,

          suppliedQuantity:
            item.suppliedQuantity,

          surplusQuantity:
            item.surplusQuantity,

          unitPrice:
            item.unitPrice,

          lineTotal:
            item.lineTotal,

          priceRecordedAt:
            item.priceRecordedAt ||
            null,

          inventoryObservedAt:
            item.inventoryObservedAt ||
            null,

          reservationAllocations:
            (
              item.reservationAllocations ||
              []
            ).map(
              (
                allocation,
              ) => ({
                inventoryNodeId:
                  stringifyId(
                    allocation.inventoryNodeId,
                  ),

                quantity:
                  allocation.quantity,
              }),
            ),
        }),
      ),
  }
}

export async function getParentOrder({
  orderId,
  actorUser,
  now =
    new Date(),
}) {
  const ownerUserId =
    actorIdFromUser(
      actorUser,
    )

  const {
    householdId,
  } =
    await requireCurrentPantryHousehold(
      actorUser,
    )

  const order =
    await ParentOrder
      .findOne({
        _id:
          orderId,

        ownerUserId,

        householdId,
      })
      .lean()

  if (
    !order
  ) {
    throw new ApiError(
      404,
      'Order was not found.',
      [
        {
          code:
            'PARENT_ORDER_NOT_FOUND',
        },
      ],
    )
  }

  await expireParentOrderReservations({
    parentOrderId:
      order._id,

    now,
  })

  const [
    sellerOrders,
    reservations,
    externalHandoffs,
  ] =
    await Promise.all([
      SellerOrder
        .find({
          parentOrderId:
            order._id,
        })
        .sort({
          createdAt:
            1,

          _id:
            1,
        })
        .lean(),

      InventoryReservation
        .find({
          parentOrderId:
            order._id,
        })
        .sort({
          createdAt:
            1,

          _id:
            1,
        })
        .lean(),

      ExternalHandoff
        .find({
          parentOrderId:
            order._id,
        })
        .sort({
          handedOffAt:
            1,
        })
        .lean(),
    ])

  const activeReservations =
    reservations.filter(
      (
        reservation,
      ) =>
        reservation.status ===
        'active',
    )

  return {
    order: {
      id:
        stringifyId(
          order._id,
        ),

      sourceType:
        order.sourceType ||
        'basket_quote',

      outcomePlanId:
        stringifyId(
          order.outcomePlanId,
        ),

      outcomePlanRevision:
        order.outcomePlanRevision,

      marketplaceCartId:
        stringifyId(
          order.marketplaceCartId,
        ),

      status:
        order.status,

      paymentStatus:
        order.paymentStatus,

      paymentProvider:
        order.paymentProvider,

      paymentReady:
        order.paymentReady ===
        true,

      checkoutBlockers:
        order.checkoutBlockers ||
        [],

      totals:
        order.totals,

      deliveryAddressSnapshot:
        order.deliveryAddressSnapshot ||
        null,

      reservationExpiresAt:
        order.reservationExpiresAt ||
        null,

      createdAt:
        order.createdAt,

      updatedAt:
        order.updatedAt,
    },

    sellerOrders:
      sellerOrders.map(
        serializeSellerOrder,
      ),

    reservations: {
      activeCount:
        activeReservations.length,

      totalCount:
        reservations.length,

      items:
        reservations.map(
          (
            reservation,
          ) => ({
            id:
              stringifyId(
                reservation._id,
              ),

            sellerOrderId:
              stringifyId(
                reservation.sellerOrderId,
              ),

            offerId:
              stringifyId(
                reservation.offerId,
              ),

            inventoryNodeId:
              stringifyId(
                reservation.inventoryNodeId,
              ),

            quantity:
              reservation.quantity,

            status:
              reservation.status,

            expiresAt:
              reservation.expiresAt,
          }),
        ),
    },

    externalHandoffs:
      externalHandoffs.map(
        (
          handoff,
        ) => ({
          id:
            stringifyId(
              handoff._id,
            ),

          partnerId:
            handoff.partnerId,

          targetType:
            handoff.targetType,

          destinationUrl:
            handoff.destinationUrl,

          handedOffAt:
            handoff.handedOffAt,
        }),
      ),

    transparency: {
      multiSeller:
        sellerOrders.length >
        1,

      landedCostComplete:
        order.totals
          ?.landedCostCompleteness ===
        'complete',

      sellerPoliciesComplete:
        sellerOrders.every(
          (
            sellerOrder,
          ) =>
            sellerOrder.fulfillment
              ?.cancellationPolicyState ===
              'configured' &&
            sellerOrder.fulfillment
              ?.returnPolicyState ===
              'configured',
        ),

      paymentBlocked:
        order.paymentReady !==
        true,
    },
  }
}