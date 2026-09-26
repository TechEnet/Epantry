import crypto from 'node:crypto'

import mongoose from 'mongoose'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  createNotificationIntentBestEffort,
} from '../notifications/notification.service.js'

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
  requireActiveHostMarketplaceOrganization,
} from '../marketplace/marketplace.host.service.js'

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
} from '../pantry/pantry.service.js'

import {
  BasketQuote,
  MarketplaceCart,
} from './commerce.models.js'

import {
  createCheckout,
  ensureCheckoutDeliveryAddressSnapshot,
  getParentOrder,
  recordExternalHandoffFromAdapter,
} from './commerce.checkout.service.js'

import {
  CommerceHostPolicy,
  CommerceLedgerEntry,
  CommerceOrderEvent,
  CommercePaymentIntent,
  CommercePaymentWebhookEvent,
  SellerPromiseSnapshot,
} from './commerce.final.models.js'

import {
  ExternalHandoff,
  InventoryReservation,
  InventoryReservationState,
  ParentOrder,
  SellerOrder,
} from './commerce.transaction.models.js'

import {
  createRazorpayOrder,
  fetchRazorpayPayment,
  getRazorpayPublicConfig,
  hashProviderPayload,
  verifyRazorpayCheckoutSignature,
  verifyRazorpayWebhookSignature,
} from './commerce.payment.provider.js'

import {
  listExternalCommercePartners,
  resolveExternalCommercePartner,
} from './commerce.partner.provider.js'

const RESERVATION_TTL_SECONDS =
  10 * 60

const HOST_LOW_STOCK_THRESHOLD =
  5

const HOST_TRANSITIONS =
  Object.freeze({
    confirmed:
      new Set([
        'seller_accepted',
        'rejected',
        'partial_unavailable',
        'substitution_requested',
        'seller_cancelled',
      ]),

    seller_accepted:
      new Set([
        'picking',
        'partial_unavailable',
        'substitution_requested',
        'seller_cancelled',
      ]),

    picking:
      new Set([
        'packed',
        'partial_unavailable',
        'substitution_requested',
        'seller_cancelled',
      ]),

    packed:
      new Set([
        'carrier_handoff',
        'out_for_delivery',
        'seller_cancelled',
      ]),

    carrier_handoff:
      new Set([
        'out_for_delivery',
        'delivered',
        'delivery_failed',
      ]),

    out_for_delivery:
      new Set([
        'delivered',
        'delivery_failed',
      ]),

    delivery_failed:
      new Set([
        'out_for_delivery',
        'returned',
      ]),

    substitution_requested:
      new Set([
        'seller_accepted',
        'partial_unavailable',
        'seller_cancelled',
      ]),

    return_requested:
      new Set([
        'returned',
      ]),

    returned:
      new Set([
        'refunded',
      ]),
  })

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

function shortOrderReference(
  value,
) {
  const normalized =
    stringifyId(
      value,
    ) ||
    ''

  return normalized
    .slice(
      -8,
    )
    .toUpperCase()
}

function commerceStatusLabel(
  value,
) {
  return String(
    value ||
      'updated',
  )
    .split(
      '_',
    )
    .map(
      (token) =>
        `${token
          .charAt(
            0,
          )
          .toUpperCase()}${token.slice(
          1,
        )}`,
    )
    .join(
      ' ',
    )
}

const CUSTOMER_ORDER_NOTIFICATION_STATUSES =
  new Set([
    'seller_accepted',
    'picking',
    'packed',
    'carrier_handoff',
    'out_for_delivery',
    'delivered',
    'rejected',
    'partial_unavailable',
    'seller_cancelled',
    'delivery_failed',
  ])

const CUSTOMER_ORDER_PROBLEM_MESSAGES =
  Object.freeze({
    rejected:
      'could not accept this part of your order. Open the order to review the affected delivery.',

    partial_unavailable:
      'reported that some items are unavailable. Open the order to review what needs attention.',

    seller_cancelled:
      'cancelled this delivery. Open the order to see the latest status and affected items.',

    delivery_failed:
      'could not complete the delivery attempt. Open the order to review the latest update.',
  })


async function getCurrentOfferInventoryState({
  organizationId,
  offerId,
  session = null,
}) {
  const nodeQuery =
    InventoryNode.find({
      organizationId,
      status:
        'active',
    }).select('_id')

  if (session) {
    nodeQuery.session(
      session,
    )
  }

  const nodes =
    await nodeQuery.lean()

  if (
    nodes.length ===
    0
  ) {
    return {
      sellableQuantity:
        0,
      snapshotIds:
        [],
    }
  }

  const aggregate =
    InventorySnapshot.aggregate([
      {
        $match: {
          organizationId:
            new mongoose.Types.ObjectId(
              String(
                organizationId,
              ),
            ),
          offerId:
            new mongoose.Types.ObjectId(
              String(
                offerId,
              ),
            ),
          inventoryNodeId: {
            $in:
              nodes.map(
                (node) =>
                  node._id,
              ),
          },
        },
      },
      {
        $sort: {
          observedAt:
            -1,
          _id:
            -1,
        },
      },
      {
        $group: {
          _id:
            '$inventoryNodeId',
          snapshot: {
            $first:
              '$$ROOT',
          },
        },
      },
      {
        $replaceRoot: {
          newRoot:
            '$snapshot',
        },
      },
    ])

  if (session) {
    aggregate.session(
      session,
    )
  }

  const snapshots =
    await aggregate

  return {
    sellableQuantity:
      snapshots.reduce(
        (
          total,
          snapshot,
        ) =>
          total +
          getSellableQuantity(
            snapshot,
          ),
        0,
      ),
    snapshotIds:
      snapshots
        .map(
          (snapshot) =>
            stringifyId(
              snapshot._id,
            ),
        )
        .filter(
          Boolean,
        )
        .sort(),
  }
}

async function consumePaidInventoryReservations({
  parentOrderId,
  now,
  session,
}) {
  const reservations =
    await InventoryReservation
      .find({
        parentOrderId,
        status:
          'active',
      })
      .session(
        session,
      )
      .lean()

  if (
    reservations.length ===
    0
  ) {
    return []
  }

  const sellerOrders =
    await SellerOrder
      .find({
        parentOrderId,
      })
      .select(
        'organizationId items',
      )
      .session(
        session,
      )
      .lean()

  const itemByOffer =
    new Map()

  for (
    const sellerOrder
    of sellerOrders
  ) {
    for (
      const item
      of sellerOrder.items ||
      []
    ) {
      const offerId =
        stringifyId(
          item.offerId,
        )

      if (
        offerId &&
        !itemByOffer.has(
          offerId,
        )
      ) {
        itemByOffer.set(
          offerId,
          {
            organizationId:
              sellerOrder.organizationId,
            displayName:
              String(
                item.displayName ||
                  '',
              ).trim(),
          },
        )
      }
    }
  }

  const grouped =
    new Map()

  for (
    const reservation
    of reservations
  ) {
    const key =
      `${stringifyId(
        reservation.offerId,
      )}:${stringifyId(
        reservation.inventoryNodeId,
      )}`

    const existing =
      grouped.get(
        key,
      )

    if (existing) {
      existing.quantity +=
        Number(
          reservation.quantity ||
            0,
        )
      continue
    }

    grouped.set(
      key,
      {
        organizationId:
          reservation.organizationId,
        offerId:
          reservation.offerId,
        inventoryNodeId:
          reservation.inventoryNodeId,
        quantity:
          Number(
            reservation.quantity ||
              0,
          ),
      },
    )
  }

  const beforeByOffer =
    new Map()

  const organizationByOffer =
    new Map()

  for (
    const group
    of grouped.values()
  ) {
    const offerId =
      stringifyId(
        group.offerId,
      )

    if (
      !organizationByOffer.has(
        offerId,
      )
    ) {
      organizationByOffer.set(
        offerId,
        stringifyId(
          group.organizationId,
        ),
      )
    }

    if (
      beforeByOffer.has(
        offerId,
      )
    ) {
      continue
    }

    const state =
      await getCurrentOfferInventoryState({
        organizationId:
          group.organizationId,
        offerId:
          group.offerId,
        session,
      })

    beforeByOffer.set(
      offerId,
      state.sellableQuantity,
    )
  }

  for (
    const group
    of grouped.values()
  ) {
    if (
      !Number.isInteger(
        group.quantity,
      ) ||
      group.quantity <=
        0
    ) {
      throw new ApiError(
        409,
        'Reserved inventory quantity is invalid during payment finalization.',
        [
          {
            code:
              'PAYMENT_INVENTORY_RESERVATION_INVALID',
          },
        ],
      )
    }

    const previousSnapshot =
      await InventorySnapshot
        .findOne({
          organizationId:
            group.organizationId,
          offerId:
            group.offerId,
          inventoryNodeId:
            group.inventoryNodeId,
        })
        .sort({
          observedAt:
            -1,
          _id:
            -1,
        })
        .session(
          session,
        )
        .lean()

    const updatedState =
      await InventoryReservationState
        .findOneAndUpdate(
          {
            organizationId:
              group.organizationId,
            offerId:
              group.offerId,
            inventoryNodeId:
              group.inventoryNodeId,
            capacityAvailableQuantity: {
              $gte:
                group.quantity,
            },
            capacitySellableQuantity: {
              $gte:
                group.quantity,
            },
            checkoutReservedQuantity: {
              $gte:
                group.quantity,
            },
          },
          {
            $inc: {
              capacityAvailableQuantity:
                -group.quantity,
              capacitySellableQuantity:
                -group.quantity,
              checkoutReservedQuantity:
                -group.quantity,
            },
            $set: {
              inventoryObservedAt:
                now,
            },
          },
          {
            new:
              true,
            session,
          },
        )
        .lean()

    if (
      !updatedState
    ) {
      throw new ApiError(
        409,
        'Reserved inventory could not be finalized for the paid order.',
        [
          {
            code:
              'PAYMENT_INVENTORY_FINALIZATION_CONFLICT',
            offerId:
              stringifyId(
                group.offerId,
              ),
            inventoryNodeId:
              stringifyId(
                group.inventoryNodeId,
              ),
          },
        ],
      )
    }

    await InventorySnapshot.create(
      [
        {
          organizationId:
            group.organizationId,
          offerId:
            group.offerId,
          inventoryNodeId:
            group.inventoryNodeId,
          availableQuantity:
            updatedState.capacityAvailableQuantity,
          reservedQuantity:
            updatedState.capacityBaselineReservedQuantity,
          sourceType:
            previousSnapshot?.sourceType ||
            'manual',
          sourceReference:
            `customer_order:${stringifyId(
              parentOrderId,
            )}`,
          observedAt:
            now,
          createdByUserId:
            null,
        },
      ],
      {
        session,
      },
    )
  }

  await InventoryReservation.updateMany(
    {
      _id: {
        $in:
          reservations.map(
            (reservation) =>
              reservation._id,
          ),
      },
      status:
        'active',
    },
    {
      $set: {
        status:
          'converted',
      },
    },
    {
      session,
    },
  )

  return [
    ...beforeByOffer.entries(),
  ].map(
    ([
      offerId,
      beforeQuantity,
    ]) => {
      const item =
        itemByOffer.get(
          offerId,
        )

      return {
        offerId,
        organizationId:
          stringifyId(
            item?.organizationId ||
              organizationByOffer.get(
                offerId,
              ),
          ),
        displayName:
          item?.displayName ||
          '',
        beforeQuantity,
      }
    },
  )
}

async function notifyHostsAboutLowInventory(
  candidates,
) {
  if (
    !Array.isArray(
      candidates,
    ) ||
    candidates.length ===
      0
  ) {
    return
  }

  try {
    for (
      const candidate
      of candidates
    ) {
      if (
        Number(
          candidate.beforeQuantity ||
            0,
        ) <
        HOST_LOW_STOCK_THRESHOLD
      ) {
        continue
      }

      const current =
        await getCurrentOfferInventoryState({
          organizationId:
            candidate.organizationId,
          offerId:
            candidate.offerId,
        })

      if (
        current.sellableQuantity >=
        HOST_LOW_STOCK_THRESHOLD
      ) {
        continue
      }

      const offer =
        await HostOffer
          .findOne({
            _id:
              candidate.offerId,
            organizationId:
              candidate.organizationId,
          })
          .select(
            'createdByUserId organizationId merchantSku',
          )
          .lean()

      if (!offer) {
        continue
      }

      let hostUserId =
        offer.createdByUserId

      if (!hostUserId) {
        const organization =
          await MarketplaceOrganization
            .findById(
              offer.organizationId,
            )
            .select(
              'ownerUserId',
            )
            .lean()

        hostUserId =
          organization?.ownerUserId ||
          null
      }

      if (!hostUserId) {
        continue
      }

      const itemName =
        String(
          candidate.displayName ||
            offer.merchantSku ||
            'This item',
        ).trim()

      const snapshotSignature =
        crypto
          .createHash(
            'sha256',
          )
          .update(
            current.snapshotIds.join(
              ':',
            ) ||
              `${candidate.offerId}:${current.sellableQuantity}`,
          )
          .digest(
            'hex',
          )
          .slice(
            0,
            24,
          )

      await createNotificationIntentBestEffort({
        userId:
          hostUserId,
        category:
          'operations',
        triggerType:
          'host_inventory_low',
        reasonCode:
          'host_inventory_low',
        explanation:
          `${itemName} is running low. ${current.sellableQuantity} unit${
            current.sellableQuantity ===
            1
              ? ''
              : 's'
          } remain. Open the listing to increase stock.`,
        relatedEntityType:
          'host_offer',
        relatedEntityId:
          candidate.offerId,
        sourceDomain:
          'marketplace',
        sourceVersion:
          'inventory-v1',
        actions: [
          'dismiss',
        ],
        requestedChannels: [
          'in_app',
        ],
        dedupeKey:
          `host-stock-low:${candidate.offerId}:${snapshotSignature}`,
      })
    }
  } catch {
    // Low-stock notifications are best-effort and must never block a paid order.
  }
}

async function notifyHostsAboutConfirmedOrder(
  parentOrderId,
) {
  if (
    !parentOrderId
  ) {
    return
  }

  try {
    const sellerOrders =
    await SellerOrder
      .find({
        parentOrderId,
        status:
          'confirmed',
      })
      .select(
        '_id organizationId sellerName',
      )
      .lean()

  if (
    sellerOrders.length ===
    0
  ) {
    return
  }

  const organizationIds =
    [
      ...new Set(
        sellerOrders
          .map(
            (order) =>
              stringifyId(
                order.organizationId,
              ),
          )
          .filter(
            Boolean,
          ),
      ),
    ]

  const organizations =
    await MarketplaceOrganization
      .find({
        _id: {
          $in:
            organizationIds,
        },
      })
      .select(
        '_id ownerUserId',
      )
      .lean()

  const ownerByOrganization =
    new Map(
      organizations.map(
        (organization) => [
          stringifyId(
            organization._id,
          ),
          organization.ownerUserId,
        ],
      ),
    )

  await Promise.all(
    sellerOrders.map(
      async (order) => {
        const hostUserId =
          ownerByOrganization.get(
            stringifyId(
              order.organizationId,
            ),
          )

        if (
          !hostUserId
        ) {
          return
        }

        const sellerOrderId =
          stringifyId(
            order._id,
          )

        await createNotificationIntentBestEffort({
          userId:
            hostUserId,
          category:
            'order',
          triggerType:
            'order_milestone',
          reasonCode:
            'host_new_paid_order',
          explanation:
            `New paid order ${shortOrderReference(
              sellerOrderId,
            )} is ready for acceptance.`,
          relatedEntityType:
            'host_seller_order',
          relatedEntityId:
            sellerOrderId,
          sourceDomain:
            'commerce',
          sourceVersion:
            'seller-order-v1',
          actions: [
            'dismiss',
          ],
          requestedChannels: [
            'in_app',
          ],
          dedupeKey:
            `host-order:${sellerOrderId}:confirmed`,
        })
      },
    ),
  )
  } catch {
    // Order notifications are best-effort and must never block payment finalization.
  }
}

async function notifyCustomerAboutSellerOrderStatus({
  order,
  nextStatus,
}) {
  if (
    !order ||
    !CUSTOMER_ORDER_NOTIFICATION_STATUSES.has(
      nextStatus,
    )
  ) {
    return
  }

  try {
    const parentOrder =
    await ParentOrder
      .findById(
        order.parentOrderId,
      )
      .select(
        '_id ownerUserId householdId',
      )
      .lean()

  if (
    !parentOrder?.ownerUserId
  ) {
    return
  }

  const parentOrderId =
    stringifyId(
      parentOrder._id,
    )

  const sellerOrderId =
    stringifyId(
      order._id,
    )

  const statusLabel =
    commerceStatusLabel(
      nextStatus,
    )

  const sellerName =
    String(
      order.sellerName ||
        'Your seller',
    ).trim() ||
    'Your seller'

  await createNotificationIntentBestEffort({
    userId:
      parentOrder.ownerUserId,
    householdId:
      parentOrder.householdId ||
      null,
    category:
      'order',
    triggerType:
      'order_milestone',
    reasonCode:
      `customer_order_${nextStatus}`,
    explanation:
      CUSTOMER_ORDER_PROBLEM_MESSAGES[
        nextStatus
      ]
        ? `${sellerName} ${CUSTOMER_ORDER_PROBLEM_MESSAGES[nextStatus]}`
        : `${sellerName} updated order ${shortOrderReference(
            parentOrderId,
          )}: ${statusLabel}.`,
    relatedEntityType:
      'parent_order',
    relatedEntityId:
      parentOrderId,
    sourceDomain:
      'commerce',
    sourceVersion:
      'seller-order-v1',
    actions: [
      'dismiss',
    ],
    requestedChannels: [
      'in_app',
    ],
    dedupeKey:
      `customer-order:${parentOrderId}:seller:${sellerOrderId}:status:${nextStatus}`,
  })
  } catch {
    // Customer milestone notifications are best-effort and must not block fulfilment.
  }
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

function boundedPagination({
  page =
    1,
  limit =
    20,
}) {
  const normalizedPage =
    Math.max(
      1,
      Math.floor(
        Number(
          page,
        ) ||
          1,
      ),
    )

  const normalizedLimit =
    Math.min(
      50,
      Math.max(
        1,
        Math.floor(
          Number(
            limit,
          ) ||
            20,
        ),
      ),
    )

  return {
    page:
      normalizedPage,

    limit:
      normalizedLimit,
  }
}

function orderReceipt({
  orderId,
  idempotencyKey,
}) {
  return `ep_${crypto
    .createHash(
      'sha256',
    )
    .update(
      `${orderId}:${idempotencyKey}`,
    )
    .digest(
      'hex',
    )
    .slice(
      0,
      24,
    )}`
}

function reservationExpiry(
  now,
) {
  return new Date(
    new Date(
      now,
    ).getTime() +
      RESERVATION_TTL_SECONDS *
        1000,
  )
}

function calculateDeliveryFee({
  policy,
  itemSubtotalMinor,
  fulfillmentType,
}) {
  if (
    fulfillmentType ===
    'pickup'
  ) {
    return 0
  }

  if (
    policy.freeDeliveryThresholdMinor !==
      null &&
    policy.freeDeliveryThresholdMinor !==
      undefined &&
    Number(
      itemSubtotalMinor,
    ) >=
      Number(
        policy.freeDeliveryThresholdMinor,
      )
  ) {
    return 0
  }

  return Number(
    policy.deliveryFeeMinor ||
      0,
  )
}

async function appendOrderEvent({
  parentOrderId,
  sellerOrderId =
    null,
  organizationId =
    null,
  actorType,
  actorUserId =
    null,
  eventType,
  fromStatus =
    '',
  toStatus =
    '',
  note =
    '',
  idempotencyKey =
    '',
  occurredAt =
    new Date(),
  session =
    null,
}) {
  try {
    const [
      event,
    ] =
      await CommerceOrderEvent.create(
        [
          {
            parentOrderId,
            sellerOrderId,
            organizationId,
            actorType,
            actorUserId,
            eventType,
            fromStatus,
            toStatus,
            note,
            idempotencyKey,
            occurredAt,
          },
        ],
        {
          session:
            session ||
            undefined,
        },
      )

    return event
  } catch (
    error
  ) {
    if (
      error?.code ===
      11000
    ) {
      return null
    }

    throw error
  }
}

async function loadOwnedParentOrder({
  orderId,
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

  return {
    order,
    ownerUserId,
    householdId,
  }
}

export async function getHostCommercePolicy({
  actorUser,
}) {
  const organization =
    await requireActiveHostMarketplaceOrganization(
      actorUser,
    )

  const policy =
    await CommerceHostPolicy
      .findOne({
        organizationId:
          organization._id,
      })
      .lean()

  return {
    policy:
      policy
        ? {
            id:
              stringifyId(
                policy._id,
              ),

            organizationId:
              stringifyId(
                policy.organizationId,
              ),

            currency:
              policy.currency,

            deliveryFeeMinor:
              policy.deliveryFeeMinor,

            freeDeliveryThresholdMinor:
              policy.freeDeliveryThresholdMinor ??
              null,

            cancellationPolicySummary:
              policy.cancellationPolicySummary,

            returnPolicySummary:
              policy.returnPolicySummary,

            status:
              policy.status,

            version:
              policy.version,

            updatedAt:
              policy.updatedAt,
          }
        : null,
  }
}

export async function saveHostCommercePolicy({
  input,
  actorUser,
}) {
  const organization =
    await requireActiveHostMarketplaceOrganization(
      actorUser,
    )

  const actorUserId =
    actorIdFromUser(
      actorUser,
    )

  const current =
    await CommerceHostPolicy
      .findOne({
        organizationId:
          organization._id,
      })
      .lean()

  const nextVersion =
    current
      ? Number(
          current.version ||
            1,
        ) +
        1
      : 1

  await CommerceHostPolicy
    .findOneAndUpdate(
      {
        organizationId:
          organization._id,
      },
      {
        $set: {
          currency:
            String(
              input.currency ||
                'INR',
            ).toUpperCase(),

          deliveryFeeMinor:
            input.deliveryFeeMinor,

          freeDeliveryThresholdMinor:
            input.freeDeliveryThresholdMinor ??
            null,

          cancellationPolicySummary:
            input.cancellationPolicySummary,

          returnPolicySummary:
            input.returnPolicySummary,

          status:
            'active',

          version:
            nextVersion,

          updatedByUserId:
            actorUserId,
        },
      },
      {
        upsert:
          true,

        new:
          true,

        setDefaultsOnInsert:
          true,
      },
    )
    .lean()

  return getHostCommercePolicy({
    actorUser,
  })
}

async function loadServiceableNodes({
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
    nodes,
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
    nodes.map(
      (
        node,
      ) =>
        stringifyId(
          node._id,
        ),
    )

  const eligibleIds =
    new Set()

  for (
    const area
    of serviceAreas
  ) {
    const supported =
      resolveFulfillmentIntersection({
        offerFulfillmentTypes:
          offer.fulfillmentTypes,

        serviceAreaFulfillmentTypes:
          area.fulfillmentTypes,

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

    for (
      const nodeId
      of resolveServiceAreaInventoryNodeIds({
        serviceArea:
          area,

        activeInventoryNodeIds:
          activeNodeIds,
      })
    ) {
      eligibleIds.add(
        stringifyId(
          nodeId,
        ),
      )
    }
  }

  if (
    eligibleIds.size ===
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
            ...eligibleIds,
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

  const latest =
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
      !latest.has(
        nodeId,
      )
    ) {
      latest.set(
        nodeId,
        snapshot,
      )
    }
  }

  return [
    ...latest.values(),
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
      ) =>
        right.sellableQuantity -
        left.sellableQuantity,
    )
}

async function synchronizeReservationState({
  node,
  now,
  session,
}) {
  const expired =
    await InventoryReservation
      .find({
        offerId:
          node.offerId,

        inventoryNodeId:
          node.inventoryNodeId,

        status:
          'active',

        expiresAt: {
          $lte:
            now,
        },
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
    await InventoryReservation.updateOne(
      {
        _id:
          reservation._id,

        status:
          'active',
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
        session,
      },
    )
  }

  const activeReserved =
    await InventoryReservation.aggregate(
      [
        {
          $match: {
            offerId:
              node.offerId,

            inventoryNodeId:
              node.inventoryNodeId,

            status:
              'active',

            expiresAt: {
              $gt:
                now,
            },
          },
        },

        {
          $group: {
            _id:
              null,

            total: {
              $sum:
                '$quantity',
            },
          },
        },
      ],
      {
        session,
      },
    )

  const activeReservedQuantity =
    Number(
      activeReserved[0]?.total ||
        0,
    )

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
      },

      $set: {
        capacityAvailableQuantity:
          node.availableQuantity,

        capacityBaselineReservedQuantity:
          node.baselineReservedQuantity,

        capacitySellableQuantity:
          node.sellableQuantity,

        checkoutReservedQuantity:
          activeReservedQuantity,

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

async function reserveSellerOrder({
  sellerOrder,
  cart,
  ownerUserId,
  householdId,
  parentOrderId,
  expiresAt,
  idempotencyKey,
  now,
  session,
}) {
  const existing =
    await InventoryReservation
      .find({
        parentOrderId,

        sellerOrderId:
          sellerOrder._id,

        status:
          'active',

        expiresAt: {
          $gt:
            now,
        },
      })
      .session(
        session,
      )
      .lean()

  if (
    existing.length >
    0
  ) {
    return
  }

  for (
    const item
    of sellerOrder.items ||
    []
  ) {
    let remaining =
      Number(
        item.packCount,
      )

    const nodes =
      await loadServiceableNodes({
        offerId:
          item.offerId,

        pincode:
          cart.pincode,

        fulfillmentType:
          cart.fulfillmentType ||
          undefined,

        session,
      })

    for (
      const node
      of nodes
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

      const reserved =
        await InventoryReservationState
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

      if (
        !reserved
      ) {
        throw new ApiError(
          409,
          'Inventory changed while checkout was being reserved.',
          [
            {
              code:
                'CHECKOUT_INVENTORY_CONTENTION',
            },
          ],
        )
      }

      await InventoryReservation.create(
        [
          {
            ownerUserId,
            householdId,

            marketplaceCartId:
              cart._id,

            parentOrderId,

            sellerOrderId:
              sellerOrder._id,

            cartItemId:
              item.cartItemId,

            organizationId:
              sellerOrder.organizationId,

            offerId:
              item.offerId,

            inventoryNodeId:
              node.inventoryNodeId,

            quantity,

            status:
              'active',

            expiresAt,

            idempotencyKey:
              `${idempotencyKey}:${stringifyId(
                item.cartItemId,
              )}:${stringifyId(
                node.inventoryNodeId,
              )}`,
          },
        ],
        {
          session,
        },
      )

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
  }
}

async function upgradeCheckoutIfReady({
  parentOrderId,
  actorUser,
  idempotencyKey,
  now,
}) {
  const {
    order,
    ownerUserId,
    householdId,
  } =
    await loadOwnedParentOrder({
      orderId:
        parentOrderId,

      actorUser,
    })

  if (
    order.paymentStatus ===
      'paid' ||
    order.status ===
      'confirmed'
  ) {
    return
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

  const sellerOrders =
    await SellerOrder
      .find({
        parentOrderId:
          order._id,
      })
      .lean()

  const organizationIds =
    sellerOrders.map(
      (
        sellerOrder,
      ) =>
        sellerOrder.organizationId,
    )

  const policies =
    await CommerceHostPolicy
      .find({
        organizationId: {
          $in:
            organizationIds,
        },

        status:
          'active',
      })
      .lean()

  const policyByOrganization =
    new Map(
      policies.map(
        (
          policy,
        ) => [
          stringifyId(
            policy.organizationId,
          ),

          policy,
        ],
      ),
    )

  const blockers =
    []

  const sellerPromises =
    []

  let knownFeesMinor =
    0

  for (
    const sellerOrder
    of sellerOrders
  ) {
    const policy =
      policyByOrganization.get(
        stringifyId(
          sellerOrder.organizationId,
        ),
      )

    if (
      !policy ||
      String(
        policy.currency,
      ).toUpperCase() !==
        String(
          order.totals?.currency ||
            cart.currency,
        ).toUpperCase()
    ) {
      blockers.push(
        'SELLER_POLICIES_NOT_CONFIGURED',
      )

      continue
    }

    const itemSubtotalMinor =
      Number(
        sellerOrder.commercialSnapshot
          ?.itemSubtotalMinor ||
          0,
      )

    const deliveryFeeMinor =
      calculateDeliveryFee({
        policy,
        itemSubtotalMinor,

        fulfillmentType:
          cart.fulfillmentType,
      })

    knownFeesMinor +=
      deliveryFeeMinor

    sellerPromises.push({
      sellerOrder,
      policy,
      itemSubtotalMinor,
      deliveryFeeMinor,

      totalLandedCostMinor:
        itemSubtotalMinor +
        deliveryFeeMinor,
    })
  }

  if (
    sellerPromises.length !==
    sellerOrders.length
  ) {
    blockers.push(
      'LANDED_COST_INCOMPLETE',
    )
  }

  if (
    !getRazorpayPublicConfig()
      .configured
  ) {
    blockers.push(
      'PAYMENT_PROVIDER_NOT_CONFIGURED',
    )
  }

  if (
    blockers.length >
    0
  ) {
    await ParentOrder.updateOne(
      {
        _id:
          order._id,

        ownerUserId,
        householdId,
      },
      {
        $set: {
          paymentReady:
            false,

          checkoutBlockers: [
            ...new Set(
              blockers,
            ),
          ],
        },
      },
    )

    return
  }

  const totalLandedCostMinor =
    Number(
      cart.itemSubtotalMinor,
    ) +
    knownFeesMinor

  const expiresAt =
    reservationExpiry(
      now,
    )

  const session =
    await mongoose.startSession()

  try {
    await session.withTransaction(
      async () => {
        const currentOrder =
          await ParentOrder
            .findOne({
              _id:
                order._id,

              ownerUserId,
              householdId,
            })
            .session(
              session,
            )

        if (
          !currentOrder ||
          currentOrder.paymentStatus ===
            'paid'
        ) {
          return
        }

        for (
          const item
          of sellerPromises
        ) {
          await reserveSellerOrder({
            sellerOrder:
              item.sellerOrder,

            cart,
            ownerUserId,
            householdId,

            parentOrderId:
              order._id,

            expiresAt,
            idempotencyKey,
            now,
            session,
          })

          const existingPromise =
            await SellerPromiseSnapshot
              .findOne({
                sellerOrderId:
                  item.sellerOrder._id,
              })
              .session(
                session,
              )
              .lean()

          if (
            !existingPromise
          ) {
            await SellerPromiseSnapshot.create(
              [
                {
                  parentOrderId:
                    order._id,

                  sellerOrderId:
                    item.sellerOrder._id,

                  organizationId:
                    item.sellerOrder.organizationId,

                  currency:
                    item.policy.currency,

                  itemSubtotalMinor:
                    item.itemSubtotalMinor,

                  deliveryFeeMinor:
                    item.deliveryFeeMinor,

                  totalLandedCostMinor:
                    item.totalLandedCostMinor,

                  policyVersion:
                    item.policy.version,

                  cancellationPolicySummary:
                    item.policy
                      .cancellationPolicySummary,

                  returnPolicySummary:
                    item.policy
                      .returnPolicySummary,

                  capturedAt:
                    now,
                },
              ],
              {
                session,
              },
            )
          }

          await SellerOrder.updateOne(
            {
              _id:
                item.sellerOrder._id,

              parentOrderId:
                order._id,
            },
            {
              $set: {
                'commercialSnapshot.knownFeesMinor':
                  item.deliveryFeeMinor,

                'commercialSnapshot.totalLandedCostMinor':
                  item.totalLandedCostMinor,

                'commercialSnapshot.landedCostCompleteness':
                  'complete',

                'fulfillment.promiseState':
                  'serviceable',

                'fulfillment.cancellationPolicyState':
                  'configured',

                'fulfillment.returnPolicyState':
                  'configured',

                status:
                  'payment_pending',

                reservationExpiresAt:
                  expiresAt,
              },
            },
            {
              session,
            },
          )
        }

        currentOrder.totals = {
          itemSubtotalMinor:
            cart.itemSubtotalMinor,

          knownFeesMinor,

          totalLandedCostMinor,

          landedCostCompleteness:
            'complete',

          currency:
            cart.currency,
        }

        currentOrder.status =
          'payment_pending'

        currentOrder.paymentStatus =
          'pending'

        currentOrder.paymentReady =
          true

        currentOrder.checkoutBlockers =
          []

        currentOrder.reservationExpiresAt =
          expiresAt

        await currentOrder.save({
          session,
        })

        await MarketplaceCart.updateOne(
          {
            _id:
              cart._id,

            ownerUserId,
            householdId,
          },
          {
            $set: {
              knownFeesMinor,

              totalLandedCostMinor,

              landedCostCompleteness:
                'complete',

              status:
                'checkout_pending',
            },
          },
          {
            session,
          },
        )

        await appendOrderEvent({
          parentOrderId:
            order._id,

          actorType:
            'system',

          eventType:
            'checkout_ready',

          fromStatus:
            order.status,

          toStatus:
            'payment_pending',

          note:
            'Commercial promises captured and inventory reserved.',

          idempotencyKey:
            `checkout-ready:${stringifyId(
              order._id,
            )}`,

          occurredAt:
            now,

          session,
        })
      },
    )
  } finally {
    await session.endSession()
  }
}

async function enrichOrderDetail({
  detail,
}) {
  const sellerOrderIds =
    (
      detail.sellerOrders ||
      []
    ).map(
      (
        sellerOrder,
      ) =>
        sellerOrder.id,
    )

  const [
    promises,
    timeline,
  ] =
    await Promise.all([
      SellerPromiseSnapshot
        .find({
          sellerOrderId: {
            $in:
              sellerOrderIds,
          },
        })
        .lean(),

      CommerceOrderEvent
        .find({
          parentOrderId:
            detail.order.id,
        })
        .sort({
          occurredAt:
            1,

          _id:
            1,
        })
        .lean(),
    ])

  const promiseBySellerOrder =
    new Map(
      promises.map(
        (
          promise,
        ) => [
          stringifyId(
            promise.sellerOrderId,
          ),

          promise,
        ],
      ),
    )

  return {
    ...detail,

    sellerOrders:
      (
        detail.sellerOrders ||
        []
      ).map(
        (
          sellerOrder,
        ) => {
          const promise =
            promiseBySellerOrder.get(
              sellerOrder.id,
            )

          return {
            ...sellerOrder,

            promise:
              promise
                ? {
                    deliveryFeeMinor:
                      promise.deliveryFeeMinor,

                    totalLandedCostMinor:
                      promise.totalLandedCostMinor,

                    currency:
                      promise.currency,

                    policyVersion:
                      promise.policyVersion,

                    cancellationPolicySummary:
                      promise
                        .cancellationPolicySummary,

                    returnPolicySummary:
                      promise
                        .returnPolicySummary,

                    capturedAt:
                      promise.capturedAt,
                  }
                : null,
          }
        },
      ),

    timeline:
      timeline.map(
        (
          event,
        ) => ({
          id:
            stringifyId(
              event._id,
            ),

          sellerOrderId:
            stringifyId(
              event.sellerOrderId,
            ),

          actorType:
            event.actorType,

          eventType:
            event.eventType,

          fromStatus:
            event.fromStatus,

          toStatus:
            event.toStatus,

          note:
            event.note,

          occurredAt:
            event.occurredAt,
        }),
      ),
  }
}

export async function prepareFinalCheckout({
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

  let existing =
    await ParentOrder
      .findOne({
        marketplaceCartId:
          cartId,

        ownerUserId,

        householdId,

        status: {
          $in: [
            'draft',
            'payment_pending',
            'confirmed',
          ],
        },
      })
      .sort({
        createdAt:
          -1,
      })
      .lean()

  if (
    !existing
  ) {
    const created =
      await createCheckout({
        cartId,
        deliveryAddressId,
        idempotencyKey,
        actorUser,
        now,
      })

    existing =
      created?.order?.id
        ? await ParentOrder
            .findById(
              created.order.id,
            )
            .lean()
        : null
  }

  if (
    !existing
  ) {
    throw new ApiError(
      500,
      'Checkout preparation did not create an Order.',
      [
        {
          code:
            'CHECKOUT_ORDER_NOT_CREATED',
        },
      ],
    )
  }

  await ensureCheckoutDeliveryAddressSnapshot({
    parentOrderId:
      existing._id,

    deliveryAddressId,
    actorUser,
    now,
  })

  await upgradeCheckoutIfReady({
    parentOrderId:
      existing._id,

    actorUser,
    idempotencyKey,
    now,
  })

  return enrichOrderDetail({
    detail:
      await getParentOrder({
        orderId:
          existing._id,

        actorUser,
        now,
      }),
  })
}

export function getExternalHandoffPartners() {
  return {
    partners:
      listExternalCommercePartners(),
  }
}

export async function createExternalHandoffFromQuote({
  basketQuoteId,
  partnerId,
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

  const quote =
    await BasketQuote
      .findOne({
        _id:
          basketQuoteId,

        ownerUserId,

        householdId,

        status:
          'active',
      })
      .lean()

  if (
    !quote
  ) {
    throw new ApiError(
      404,
      'Basket quote was not found.',
      [
        {
          code:
            'BASKET_QUOTE_NOT_FOUND',
        },
      ],
    )
  }

  const unmatchedIds =
    new Set(
      (
        quote.unmatchedRequirementLineIds ||
        []
      ).map(
        stringifyId,
      ),
    )

  if (
    unmatchedIds.size ===
    0
  ) {
    throw new ApiError(
      409,
      'This comparison has no unmatched requirements for external handoff.',
      [
        {
          code:
            'EXTERNAL_HANDOFF_NOT_REQUIRED',
        },
      ],
    )
  }

  const existing =
    await ExternalHandoff
      .findOne({
        ownerUserId,

        householdId,

        outcomePlanId:
          quote.outcomePlanId,

        'attribution.idempotencyKey':
          idempotencyKey,
      })
      .lean()

  if (
    existing
  ) {
    return {
      handoff: {
        id:
          stringifyId(
            existing._id,
          ),

        partnerId:
          existing.partnerId,

        destinationUrl:
          existing.destinationUrl,

        handedOffAt:
          existing.handedOffAt,

        leavingEpantry:
          true,
      },
    }
  }

  const outcome =
    await getOutcomePlan({
      planId:
        quote.outcomePlanId,

      actorUser,
    })

  const items =
    (
      outcome.productMatchingInput ||
      []
    )
      .filter(
        (
          item,
        ) =>
          unmatchedIds.has(
            stringifyId(
              item.requirementLineId,
            ),
          ),
      )
      .map(
        (
          item,
        ) => ({
          requirementLineId:
            item.requirementLineId,

          canonicalIngredientId:
            item.canonicalIngredientId,

          quantity:
            item.quantity,

          unit:
            item.unit,
        }),
      )

  if (
    items.length ===
    0
  ) {
    throw new ApiError(
      409,
      'Unmatched requirement snapshot is no longer available.',
      [
        {
          code:
            'EXTERNAL_HANDOFF_REQUIREMENTS_STALE',
        },
      ],
    )
  }

  const partner =
    resolveExternalCommercePartner(
      partnerId,
    )

  const handoff =
    await recordExternalHandoffFromAdapter({
      ownerUserId,
      householdId,

      outcomePlanId:
        quote.outcomePlanId,

      parentOrderId:
        null,

      partnerId:
        partner.id,

      destinationUrl:
        partner.destinationUrl,

      items,

      attribution: {
        source:
          'basket_quote_unmatched_requirements',

        basketQuoteId:
          stringifyId(
            quote._id,
          ),

        partnerLabel:
          partner.label,

        idempotencyKey,
      },

      now,
    })

  return {
    handoff: {
      id:
        stringifyId(
          handoff._id,
        ),

      partnerId:
        handoff.partnerId,

      destinationUrl:
        handoff.destinationUrl,

      handedOffAt:
        handoff.handedOffAt,

      leavingEpantry:
        true,
    },
  }
}

export async function listCustomerOrders({
  page,
  limit,
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

  const pagination =
    boundedPagination({
      page,
      limit,
    })

  const filter = {
    ownerUserId,
    householdId,
  }

  const [
    orders,
    total,
  ] =
    await Promise.all([
      ParentOrder
        .find(
          filter,
        )
        .sort({
          createdAt:
            -1,

          _id:
            -1,
        })
        .skip(
          (
            pagination.page -
            1
          ) *
            pagination.limit,
        )
        .limit(
          pagination.limit,
        )
        .lean(),

      ParentOrder.countDocuments(
        filter,
      ),
    ])

  const parentOrderIds =
    orders.map(
      (order) =>
        order._id,
    )

  const sellerOrders =
    parentOrderIds.length > 0
      ? await SellerOrder
          .find({
            parentOrderId: {
              $in:
                parentOrderIds,
            },
          })
          .select({
            parentOrderId:
              1,

            sellerName:
              1,

            status:
              1,

            items:
              1,
          })
          .lean()
      : []

  const orderItemSummaryByParentId =
    new Map()

  for (const sellerOrder of sellerOrders) {
    const parentOrderId =
      stringifyId(
        sellerOrder.parentOrderId,
      )

    const current =
      orderItemSummaryByParentId.get(
        parentOrderId,
      ) || {
        primaryItemName:
          '',

        itemCount:
          0,

        sellerCount:
          0,

        sellerProgress:
          [],

        statusCounts:
          {},
      }

    const itemNames =
      []

    for (const item of sellerOrder.items || []) {
      current.itemCount +=
        1

      const itemName =
        String(
          item.displayName ||
            '',
        ).trim()

      if (
        itemName &&
        !current.primaryItemName
      ) {
        current.primaryItemName =
          itemName
      }

      if (
        itemName &&
        itemNames.length <
          4
      ) {
        itemNames.push(
          itemName,
        )
      }
    }

    const sellerStatus =
      String(
        sellerOrder.status ||
          'confirmed',
      )

    current.sellerCount +=
      1

    current.statusCounts[
      sellerStatus
    ] =
      Number(
        current.statusCounts[
          sellerStatus
        ] ||
          0,
      ) +
      1

    current.sellerProgress.push({
      id:
        stringifyId(
          sellerOrder._id,
        ),

      sellerName:
        String(
          sellerOrder.sellerName ||
            'Host',
        ).trim() ||
        'Host',

      status:
        sellerStatus,

      itemCount:
        (
          sellerOrder.items ||
          []
        ).length,

      itemNames,
    })

    orderItemSummaryByParentId.set(
      parentOrderId,
      current,
    )
  }


  return {
    orders:
      orders.map(
        (
          order,
        ) => ({
          id:
            stringifyId(
              order._id,
            ),

          primaryItemName:
            orderItemSummaryByParentId.get(
              stringifyId(
                order._id,
              ),
            )?.primaryItemName ||
            '',

          itemCount:
            orderItemSummaryByParentId.get(
              stringifyId(
                order._id,
              ),
            )?.itemCount ||
            0,

          sellerCount:
            orderItemSummaryByParentId.get(
              stringifyId(
                order._id,
              ),
            )?.sellerCount ||
            0,

          sellerProgress:
            orderItemSummaryByParentId.get(
              stringifyId(
                order._id,
              ),
            )?.sellerProgress ||
            [],

          sellerStatusCounts:
            orderItemSummaryByParentId.get(
              stringifyId(
                order._id,
              ),
            )?.statusCounts ||
            {},

          status:
            order.status,

          paymentStatus:
            order.paymentStatus,

          paymentReady:
            order.paymentReady ===
            true,

          totals:
            order.totals,

          reservationExpiresAt:
            order.reservationExpiresAt ||
            null,

          createdAt:
            order.createdAt,

          updatedAt:
            order.updatedAt,
        }),
      ),

    pagination: {
      ...pagination,

      total,

      pages:
        Math.max(
          1,
          Math.ceil(
            total /
              pagination.limit,
          ),
        ),
    },
  }
}

export async function getCustomerOrderDetail({
  orderId,
  actorUser,
  now =
    new Date(),
}) {
  const detail =
    await getParentOrder({
      orderId,
      actorUser,
      now,
    })

  return enrichOrderDetail({
    detail,
  })
}

export async function getCustomerOrderTracking({
  orderId,
  actorUser,
  now =
    new Date(),
}) {
  const detail =
    await getCustomerOrderDetail({
      orderId,
      actorUser,
      now,
    })

  return {
    order: {
      id:
        detail.order.id,

      status:
        detail.order.status,

      paymentStatus:
        detail.order.paymentStatus,
    },

    sellerOrders:
      detail.sellerOrders.map(
        (
          sellerOrder,
        ) => ({
          id:
            sellerOrder.id,

          sellerName:
            sellerOrder.sellerName,

          status:
            sellerOrder.status,
        }),
      ),

    timeline:
      detail.timeline,
  }
}

export async function createPaymentIntent({
  orderId,
  idempotencyKey,
  actorUser,
}) {
  const {
    order,
    ownerUserId,
    householdId,
  } =
    await loadOwnedParentOrder({
      orderId,
      actorUser,
    })

  const existing =
    await CommercePaymentIntent
      .findOne({
        ownerUserId,

        createIdempotencyKey:
          idempotencyKey,
      })
      .lean()

  if (
    existing
  ) {
    return {
      paymentIntent: {
        id:
          stringifyId(
            existing._id,
          ),

        parentOrderId:
          stringifyId(
            existing.parentOrderId,
          ),

        status:
          existing.status,

        amountMinor:
          existing.amountMinor,

        currency:
          existing.currency,
      },

      checkout: {
        ...getRazorpayPublicConfig(),

        providerOrderId:
          existing.providerOrderId,

        amountMinor:
          existing.amountMinor,

        currency:
          existing.currency,
      },
    }
  }

  if (
    order.paymentReady !==
      true ||
    order.status !==
      'payment_pending' ||
    order.paymentStatus !==
      'pending' ||
    order.totals
      ?.landedCostCompleteness !==
      'complete' ||
    !Number.isInteger(
      Number(
        order.totals
          ?.totalLandedCostMinor,
      ),
    )
  ) {
    throw new ApiError(
      409,
      'Order is not ready to start hosted payment.',
      [
        {
          code:
            'PAYMENT_ORDER_NOT_READY',
        },
      ],
    )
  }

  if (
    !order.reservationExpiresAt ||
    new Date(
      order.reservationExpiresAt,
    ) <=
      new Date()
  ) {
    throw new ApiError(
      409,
      'Inventory reservation expired. Revalidate checkout before paying.',
      [
        {
          code:
            'PAYMENT_RESERVATION_EXPIRED',
        },
      ],
    )
  }

  const provider =
    await createRazorpayOrder({
      amountMinor:
        order.totals
          .totalLandedCostMinor,

      currency:
        order.totals.currency,

      receipt:
        orderReceipt({
          orderId:
            order._id,

          idempotencyKey,
        }),

      notes: {
        epantry_parent_order_id:
          stringifyId(
            order._id,
          ),
      },
    })

  let intent

  try {
    intent =
      await CommercePaymentIntent.create({
        ownerUserId,
        householdId,

        parentOrderId:
          order._id,

        provider:
          'razorpay',

        providerOrderId:
          provider.providerOrderId,

        amountMinor:
          order.totals
            .totalLandedCostMinor,

        currency:
          order.totals.currency,

        status:
          'created',

        createIdempotencyKey:
          idempotencyKey,
      })
  } catch (
    error
  ) {
    if (
      error?.code !==
      11000
    ) {
      throw error
    }

    intent =
      await CommercePaymentIntent
        .findOne({
          ownerUserId,

          createIdempotencyKey:
            idempotencyKey,
        })
        .lean()
  }

  return {
    paymentIntent: {
      id:
        stringifyId(
          intent._id,
        ),

      parentOrderId:
        stringifyId(
          intent.parentOrderId,
        ),

      status:
        intent.status,

      amountMinor:
        intent.amountMinor,

      currency:
        intent.currency,
    },

    checkout: {
      ...getRazorpayPublicConfig(),

      providerOrderId:
        intent.providerOrderId,

      amountMinor:
        intent.amountMinor,

      currency:
        intent.currency,
    },
  }
}

async function finalizePaidPayment({
  paymentIntent,
  providerPaymentId,
  confirmationSource =
    'webhook',
  now,
}) {
  let newlyConfirmedParentOrderId =
    null

  let lowStockCandidates =
    []

  const session =
    await mongoose.startSession()

  try {
    await session.withTransaction(
      async () => {
        const intent =
          await CommercePaymentIntent
            .findById(
              paymentIntent._id,
            )
            .session(
              session,
            )

        if (
          !intent ||
          intent.status ===
            'paid'
        ) {
          return
        }

        const parentOrder =
          await ParentOrder
            .findById(
              intent.parentOrderId,
            )
            .session(
              session,
            )

        if (
          !parentOrder
        ) {
          throw new ApiError(
            404,
            'Order was not found for payment finalization.',
            [
              {
                code:
                  'PAYMENT_PARENT_ORDER_NOT_FOUND',
              },
            ],
          )
        }

        if (
          parentOrder.paymentStatus ===
          'paid'
        ) {
          intent.status =
            'paid'

          intent.providerPaymentId =
            providerPaymentId ||
            intent.providerPaymentId

          intent.paidAt =
            intent.paidAt ||
            now

          await intent.save({
            session,
          })

          return
        }

        intent.status =
          'paid'

        intent.providerPaymentId =
          providerPaymentId

        intent.paidAt =
          now

        await intent.save({
          session,
        })

        const previousParentStatus =
          parentOrder.status

        parentOrder.status =
          'confirmed'

        parentOrder.paymentStatus =
          'paid'

        parentOrder.paymentReady =
          false

        parentOrder.checkoutBlockers =
          []

        await parentOrder.save({
          session,
        })

        newlyConfirmedParentOrderId =
          parentOrder._id

        await SellerOrder.updateMany(
          {
            parentOrderId:
              parentOrder._id,

            status: {
              $in: [
                'draft',
                'payment_pending',
              ],
            },
          },
          {
            $set: {
              status:
                'confirmed',
            },
          },
          {
            session,
          },
        )

        lowStockCandidates =
          await consumePaidInventoryReservations({
            parentOrderId:
              parentOrder._id,
            now,
            session,
          })

        await MarketplaceCart.updateOne(
          {
            _id:
              parentOrder.marketplaceCartId,
          },
          {
            $set: {
              status:
                'converted',
            },
          },
          {
            session,
          },
        )

        const ledgerKey =
          `payment:${stringifyId(
            intent._id,
          )}`

        const existingLedger =
          await CommerceLedgerEntry
            .findOne({
              idempotencyKey:
                ledgerKey,
            })
            .session(
              session,
            )
            .lean()

        if (
          !existingLedger
        ) {
          await CommerceLedgerEntry.create(
            [
              {
                parentOrderId:
                  parentOrder._id,

                paymentIntentId:
                  intent._id,

                entryType:
                  'payment_captured',

                amountMinor:
                  intent.amountMinor,

                currency:
                  intent.currency,

                idempotencyKey:
                  ledgerKey,

                occurredAt:
                  now,
              },
            ],
            {
              session,
            },
          )
        }

        await appendOrderEvent({
          parentOrderId:
            parentOrder._id,

          actorType:
            'payment_provider',

          eventType:
            'payment_captured',

          fromStatus:
            previousParentStatus,

          toStatus:
            'confirmed',

          note:
            confirmationSource ===
              'payment_api'
              ? 'Captured payment confirmed directly with the payment provider API after signed checkout verification.'
              : 'Captured payment confirmed by signed payment provider webhook.',

          idempotencyKey:
            `payment:${stringifyId(
              intent._id,
            )}`,

          occurredAt:
            now,

          session,
        })
      },
    )
  } finally {
    await session.endSession()
  }

  if (
    newlyConfirmedParentOrderId
  ) {
    await notifyHostsAboutConfirmedOrder(
      newlyConfirmedParentOrderId,
    )

    await notifyHostsAboutLowInventory(
      lowStockCandidates,
    )
  }
}

export async function verifyCustomerPayment({
  input,
  actorUser,
  now =
    new Date(),
}) {
  const {
    order,
    ownerUserId,
    householdId,
  } =
    await loadOwnedParentOrder({
      orderId:
        input.orderId,

      actorUser,
    })

  const intent =
    await CommercePaymentIntent
      .findOne({
        parentOrderId:
          order._id,

        ownerUserId,
        householdId,

        provider:
          'razorpay',

        providerOrderId:
          input.razorpayOrderId,
      })
      .lean()

  if (
    !intent
  ) {
    throw new ApiError(
      404,
      'Payment intent was not found.',
      [
        {
          code:
            'PAYMENT_INTENT_NOT_FOUND',
        },
      ],
    )
  }

  if (
    intent.status ===
    'paid'
  ) {
    return getCustomerOrderDetail({
      orderId:
        order._id,

      actorUser,
      now,
    })
  }

  /*
   * Important:
   *
   * Signature verification uses the provider Order ID stored by EPANTRY when
   * the Razorpay Order was created. The browser-returned order identity is
   * checked against that server value, but is never the authority by itself.
   */

  if (
    input.razorpayOrderId !==
    intent.providerOrderId
  ) {
    throw new ApiError(
      400,
      'Payment order identity does not match the server-created order.',
      [
        {
          code:
            'PAYMENT_ORDER_ID_MISMATCH',
        },
      ],
    )
  }

  const valid =
    verifyRazorpayCheckoutSignature({
      providerOrderId:
        intent.providerOrderId,

      providerPaymentId:
        input.razorpayPaymentId,

      signature:
        input.razorpaySignature,
    })

  if (
    !valid
  ) {
    throw new ApiError(
      400,
      'Payment signature verification failed.',
      [
        {
          code:
            'PAYMENT_SIGNATURE_INVALID',
        },
      ],
    )
  }

  await CommercePaymentIntent.updateOne(
    {
      _id:
        intent._id,

      status: {
        $in: [
          'created',
          'verified',
        ],
      },
    },
    {
      $set: {
        status:
          'verified',

        providerPaymentId:
          input.razorpayPaymentId,
      },
    },
  )

  await appendOrderEvent({
    parentOrderId:
      order._id,

    actorType:
      'payment_provider',

    eventType:
      'payment_signature_verified',

    fromStatus:
      order.status,

    toStatus:
      order.status,

    note:
      'Hosted checkout callback signature verified. Server-side captured-payment confirmation is being checked.',

    idempotencyKey:
      `payment-signature:${stringifyId(
        intent._id,
      )}`,

    occurredAt:
      now,
  })

  let providerPayment

  try {
    providerPayment =
      await fetchRazorpayPayment({
        providerPaymentId:
          input.razorpayPaymentId,
      })
  } catch (
    error
  ) {
    if (
      error instanceof
        ApiError &&
      [
        502,
        503,
      ].includes(
        error.statusCode,
      )
    ) {
      return getCustomerOrderDetail({
        orderId:
          order._id,

        actorUser,
        now,
      })
    }

    throw error
  }

  if (
    providerPayment.providerPaymentId !==
    String(
      input.razorpayPaymentId,
    )
  ) {
    throw new ApiError(
      409,
      'Payment provider returned a different payment identity.',
      [
        {
          code:
            'PAYMENT_PROVIDER_PAYMENT_ID_MISMATCH',
        },
      ],
    )
  }

  if (
    providerPayment.providerOrderId !==
    intent.providerOrderId
  ) {
    throw new ApiError(
      409,
      'Payment provider order identity does not match the EPANTRY payment intent.',
      [
        {
          code:
            'PAYMENT_PROVIDER_ORDER_ID_MISMATCH',
        },
      ],
    )
  }

  if (
    !Number.isInteger(
      Number(
        providerPayment.amountMinor,
      ),
    ) ||
    Number(
      providerPayment.amountMinor,
    ) !==
      Number(
        intent.amountMinor,
      )
  ) {
    throw new ApiError(
      409,
      'Payment provider amount does not match the EPANTRY payment intent.',
      [
        {
          code:
            'PAYMENT_PROVIDER_AMOUNT_MISMATCH',
        },
      ],
    )
  }

  if (
    String(
      providerPayment.currency ||
        '',
    ).toUpperCase() !==
    String(
      intent.currency ||
        '',
    ).toUpperCase()
  ) {
    throw new ApiError(
      409,
      'Payment provider currency does not match the EPANTRY payment intent.',
      [
        {
          code:
            'PAYMENT_PROVIDER_CURRENCY_MISMATCH',
        },
      ],
    )
  }

  if (
    providerPayment.captured !==
      true ||
    providerPayment.status !==
      'captured'
  ) {
    return getCustomerOrderDetail({
      orderId:
        order._id,

      actorUser,
      now,
    })
  }

  const refreshedIntent =
    await CommercePaymentIntent
      .findById(
        intent._id,
      )
      .lean()

  if (
    !refreshedIntent
  ) {
    throw new ApiError(
      404,
      'Payment intent was not found during payment finalization.',
      [
        {
          code:
            'PAYMENT_INTENT_NOT_FOUND',
        },
      ],
    )
  }

  await finalizePaidPayment({
    paymentIntent:
      refreshedIntent,

    providerPaymentId:
      providerPayment.providerPaymentId,

    confirmationSource:
      'payment_api',

    now,
  })

  return getCustomerOrderDetail({
    orderId:
      order._id,

    actorUser,
    now,
  })
}

export async function processRazorpayWebhook({
  rawBody,
  signature,
  providerEventId,
  now =
    new Date(),
}) {
  if (
    !providerEventId
  ) {
    throw new ApiError(
      400,
      'Payment webhook event ID is required.',
      [
        {
          code:
            'PAYMENT_WEBHOOK_EVENT_ID_REQUIRED',
        },
      ],
    )
  }

  if (
    !verifyRazorpayWebhookSignature({
      rawBody,
      signature,
    })
  ) {
    throw new ApiError(
      400,
      'Payment webhook signature is invalid.',
      [
        {
          code:
            'PAYMENT_WEBHOOK_SIGNATURE_INVALID',
        },
      ],
    )
  }

  let payload

  try {
    payload =
      JSON.parse(
        rawBody.toString(
          'utf8',
        ),
      )
  } catch {
    throw new ApiError(
      400,
      'Payment webhook payload is invalid JSON.',
      [
        {
          code:
            'PAYMENT_WEBHOOK_PAYLOAD_INVALID',
        },
      ],
    )
  }

  const eventType =
    String(
      payload?.event ||
        '',
    )

  const providerOrderId =
    payload?.payload
      ?.payment
      ?.entity
      ?.order_id ||
    payload?.payload
      ?.order
      ?.entity
      ?.id ||
    ''

  const providerPaymentId =
    payload?.payload
      ?.payment
      ?.entity
      ?.id ||
    ''

  let event =
    await CommercePaymentWebhookEvent
      .findOne({
        provider:
          'razorpay',

        providerEventId,
      })

  if (
    event &&
    [
      'processed',
      'ignored',
    ].includes(
      event.status,
    )
  ) {
    return {
      processed:
        event.status ===
        'processed',

      duplicate:
        true,
    }
  }

  if (
    !event
  ) {
    try {
      event =
        await CommercePaymentWebhookEvent.create({
          provider:
            'razorpay',

          providerEventId,

          eventType,

          providerOrderId,

          providerPaymentId,

          payloadHash:
            hashProviderPayload(
              rawBody,
            ),

          status:
            'received',
        })
    } catch (
      error
    ) {
      if (
        error?.code !==
        11000
      ) {
        throw error
      }

      event =
        await CommercePaymentWebhookEvent
          .findOne({
            provider:
              'razorpay',

            providerEventId,
          })
    }
  }

  if (
    eventType !==
    'payment.captured'
  ) {
    event.status =
      'ignored'

    event.processedAt =
      now

    await event.save()

    return {
      processed:
        false,

      duplicate:
        false,
    }
  }

  const intent =
    await CommercePaymentIntent
      .findOne({
        provider:
          'razorpay',

        providerOrderId,
      })
      .lean()

  if (
    !intent
  ) {
    event.status =
      'ignored'

    event.processedAt =
      now

    await event.save()

    return {
      processed:
        false,

      duplicate:
        false,
    }
  }

  await finalizePaidPayment({
    paymentIntent:
      intent,

    providerPaymentId,

    confirmationSource:
      'webhook',

    now,
  })

  event.status =
    'processed'

  event.processedAt =
    now

  await event.save()

  return {
    processed:
      true,

    duplicate:
      false,
  }
}

export async function listHostSellerOrders({
  status,
  page,
  limit,
  actorUser,
}) {
  const organization =
    await requireActiveHostMarketplaceOrganization(
      actorUser,
    )

  const pagination =
    boundedPagination({
      page,
      limit,
    })

  const filter = {
    organizationId:
      organization._id,

    ...(status
      ? {
          status,
        }
      : {}),
  }

  const [
    orders,
    total,
  ] =
    await Promise.all([
      SellerOrder
        .find(
          filter,
        )
        .sort({
          createdAt:
            -1,

          _id:
            -1,
        })
        .skip(
          (
            pagination.page -
            1
          ) *
            pagination.limit,
        )
        .limit(
          pagination.limit,
        )
        .lean(),

      SellerOrder.countDocuments(
        filter,
      ),
    ])

  return {
    orders:
      orders.map(
        (
          order,
        ) => ({
          id:
            stringifyId(
              order._id,
            ),

          parentOrderId:
            stringifyId(
              order.parentOrderId,
            ),

          sellerName:
            order.sellerName,

          status:
            order.status,

          commercialSnapshot:
            order.commercialSnapshot,

          fulfillment:
            order.fulfillment,

          itemCount:
            order.items?.length ||
            0,

          itemNames:
            (
              order.items ||
              []
            )
              .map(
                (
                  item,
                ) =>
                  String(
                    item?.displayName ||
                      '',
                  ).trim(),
              )
              .filter(
                Boolean,
              ),

          createdAt:
            order.createdAt,

          updatedAt:
            order.updatedAt,
        }),
      ),

    pagination: {
      ...pagination,

      total,

      pages:
        Math.max(
          1,
          Math.ceil(
            total /
              pagination.limit,
          ),
        ),
    },
  }
}

export async function getHostSellerOrder({
  sellerOrderId,
  actorUser,
}) {
  const organization =
    await requireActiveHostMarketplaceOrganization(
      actorUser,
    )

  const order =
    await SellerOrder
      .findOne({
        _id:
          sellerOrderId,

        organizationId:
          organization._id,
      })
      .lean()

  if (
    !order
  ) {
    throw new ApiError(
      404,
      'Host Order was not found.',
      [
        {
          code:
            'HOST_SELLER_ORDER_NOT_FOUND',
        },
      ],
    )
  }

  const [
    promise,
    timeline,
  ] =
    await Promise.all([
      SellerPromiseSnapshot
        .findOne({
          sellerOrderId:
            order._id,

          organizationId:
            organization._id,
        })
        .lean(),

      CommerceOrderEvent
        .find({
          sellerOrderId:
            order._id,

          organizationId:
            organization._id,
        })
        .sort({
          occurredAt:
            1,

          _id:
            1,
        })
        .lean(),
    ])

  return {
    order: {
      id:
        stringifyId(
          order._id,
        ),

      parentOrderId:
        stringifyId(
          order.parentOrderId,
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
        order.items ||
        [],

      createdAt:
        order.createdAt,

      updatedAt:
        order.updatedAt,
    },

    promise:
      promise
        ? {
            deliveryFeeMinor:
              promise.deliveryFeeMinor,

            totalLandedCostMinor:
              promise.totalLandedCostMinor,

            currency:
              promise.currency,

            cancellationPolicySummary:
              promise
                .cancellationPolicySummary,

            returnPolicySummary:
              promise
                .returnPolicySummary,

            capturedAt:
              promise.capturedAt,
          }
        : null,

    timeline:
      timeline.map(
        (
          event,
        ) => ({
          id:
            stringifyId(
              event._id,
            ),

          actorType:
            event.actorType,

          eventType:
            event.eventType,

          fromStatus:
            event.fromStatus,

          toStatus:
            event.toStatus,

          note:
            event.note,

          occurredAt:
            event.occurredAt,
        }),
      ),
  }
}

async function recalculateParentStatus({
  parentOrderId,
  session,
}) {
  const sellerOrders =
    await SellerOrder
      .find({
        parentOrderId,
      })
      .session(
        session,
      )
      .lean()

  const statuses =
    sellerOrders.map(
      (
        order,
      ) =>
        order.status,
    )

  let parentStatus =
    'confirmed'

  if (
    statuses.length >
      0 &&
    statuses.every(
      (
        status,
      ) =>
        status ===
        'delivered',
    )
  ) {
    parentStatus =
      'delivered'
  } else if (
    statuses.some(
      (
        status,
      ) =>
        status ===
        'delivery_failed',
    )
  ) {
    parentStatus =
      'delivery_failed'
  } else if (
    statuses.some(
      (
        status,
      ) =>
        [
          'rejected',
          'partial_unavailable',
          'seller_cancelled',
        ].includes(
          status,
        ),
    )
  ) {
    parentStatus =
      'partially_unavailable'
  } else if (
    statuses.length >
      0 &&
    statuses.every(
      (
        status,
      ) =>
        status ===
        'refunded',
    )
  ) {
    parentStatus =
      'refunded'
  } else if (
    statuses.length >
      0 &&
    statuses.every(
      (
        status,
      ) =>
        [
          'returned',
          'refunded',
        ].includes(
          status,
        ),
    )
  ) {
    parentStatus =
      'returned'
  }

  await ParentOrder.updateOne(
    {
      _id:
        parentOrderId,
    },
    {
      $set: {
        status:
          parentStatus,
      },
    },
    {
      session,
    },
  )
}

export async function updateHostSellerOrderStatus({
  sellerOrderId,
  nextStatus,
  idempotencyKey,
  actorUser,
  now =
    new Date(),
}) {
  const organization =
    await requireActiveHostMarketplaceOrganization(
      actorUser,
    )

  const actorUserId =
    actorIdFromUser(
      actorUser,
    )

  const order =
    await SellerOrder
      .findOne({
        _id:
          sellerOrderId,

        organizationId:
          organization._id,
      })
      .lean()

  if (
    !order
  ) {
    throw new ApiError(
      404,
      'Host Order was not found.',
      [
        {
          code:
            'HOST_SELLER_ORDER_NOT_FOUND',
        },
      ],
    )
  }

  if (
    order.status ===
    nextStatus
  ) {
    return getHostSellerOrder({
      sellerOrderId,

      actorUser,
    })
  }

  const allowed =
    HOST_TRANSITIONS[
      order.status
    ]

  if (
    !allowed ||
    !allowed.has(
      nextStatus,
    )
  ) {
    throw new ApiError(
      409,
      'Seller Order status transition is not allowed.',
      [
        {
          code:
            'HOST_SELLER_ORDER_TRANSITION_INVALID',

          fromStatus:
            order.status,

          toStatus:
            nextStatus,
        },
      ],
    )
  }

  const duplicate =
    await CommerceOrderEvent
      .findOne({
        sellerOrderId:
          order._id,

        organizationId:
          organization._id,

        idempotencyKey,
      })
      .lean()

  if (
    duplicate
  ) {
    return getHostSellerOrder({
      sellerOrderId,

      actorUser,
    })
  }

  const session =
    await mongoose.startSession()

  try {
    await session.withTransaction(
      async () => {
        const updated =
          await SellerOrder
            .findOneAndUpdate(
              {
                _id:
                  order._id,

                organizationId:
                  organization._id,

                status:
                  order.status,
              },
              {
                $set: {
                  status:
                    nextStatus,
                },
              },
              {
                new:
                  true,

                session,
              },
            )
            .lean()

        if (
          !updated
        ) {
          throw new ApiError(
            409,
            'Seller Order changed before this transition could be applied.',
            [
              {
                code:
                  'HOST_SELLER_ORDER_CONCURRENT_CHANGE',
              },
            ],
          )
        }

        await appendOrderEvent({
          parentOrderId:
            order.parentOrderId,

          sellerOrderId:
            order._id,

          organizationId:
            organization._id,

          actorType:
            'host',

          actorUserId,

          eventType:
            'seller_order_status_changed',

          fromStatus:
            order.status,

          toStatus:
            nextStatus,

          idempotencyKey,

          occurredAt:
            now,

          session,
        })

        await recalculateParentStatus({
          parentOrderId:
            order.parentOrderId,

          session,
        })
      },
    )
  } finally {
    await session.endSession()
  }

  await notifyCustomerAboutSellerOrderStatus({
    order,
    nextStatus,
  })

  return getHostSellerOrder({
    sellerOrderId,

    actorUser,
  })
}