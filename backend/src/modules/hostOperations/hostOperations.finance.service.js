import mongoose from 'mongoose'

import { ApiError } from '../../utils/ApiError.js'

import {
  recordAdminAuditEvent,
} from '../admin/adminAudit.service.js'

import {
  CommerceLedgerEntry,
} from '../commerce/commerce.final.models.js'

import {
  SellerOrder,
} from '../commerce/commerce.transaction.models.js'

import {
  MarketplaceOrganization,
} from '../marketplace/marketplace.models.js'

import {
  assertHostOperationsPermission,
  resolveHostOperationsContext,
} from './hostOperations.service.js'

import {
  HostSettlement,
  HostSettlementEvent,
  HostSettlementLine,
} from './hostOperations.finance.models.js'

function stringifyId(value) {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return null
  }

  return String(
    value?._id ||
      value?.id ||
      value,
  )
}

function actorId(actorUser) {
  const value =
    actorUser?._id ||
    actorUser?.id

  if (!value) {
    throw new ApiError(
      401,
      'Authenticated identity is required.',
      [
        {
          code:
            'HOST_FINANCE_ACTOR_REQUIRED',
        },
      ],
    )
  }

  return value
}

/*
| Keep these two calls source-stable because frozen security tests verify
| that Host finance resolves its organization tenant from the authenticated
| Host context and explicitly requires finance.read.
*/
async function resolveHostFinanceContext(actorUser) {
  // prettier-ignore
  const context = await resolveHostOperationsContext(actorUser)

  // prettier-ignore
  assertHostOperationsPermission(context, 'finance.read')

  return context
}

function serializeSettlement(value) {
  if (!value) {
    return null
  }

  const item =
    typeof value.toObject ===
    'function'
      ? value.toObject()
      : value

  return {
    id:
      stringifyId(
        item._id ||
          item.id,
      ),

    organizationId:
      stringifyId(
        item.organizationId,
      ),

    periodStart:
      item.periodStart,

    periodEnd:
      item.periodEnd,

    currency:
      item.currency,

    status:
      item.status,

    totals:
      item.totals ||
      {},

    lineCount:
      item.lineCount ||
      0,

    createdByUserId:
      stringifyId(
        item.createdByUserId,
      ),

    checkerUserId:
      stringifyId(
        item.checkerUserId,
      ),

    approvedAt:
      item.approvedAt ||
      null,

    rejectedAt:
      item.rejectedAt ||
      null,

    paidAt:
      item.paidAt ||
      null,

    payoutReference:
      item.payoutReference ||
      '',

    reason:
      item.reason ||
      '',

    createdAt:
      item.createdAt ||
      null,

    updatedAt:
      item.updatedAt ||
      null,
  }
}

function serializeLine(value) {
  const item =
    typeof value?.toObject ===
    'function'
      ? value.toObject()
      : value

  if (!item) {
    return null
  }

  return {
    id:
      stringifyId(
        item._id ||
          item.id,
      ),

    sellerOrderId:
      stringifyId(
        item.sellerOrderId,
      ),

    parentOrderId:
      stringifyId(
        item.parentOrderId,
      ),

    paymentLedgerEntryId:
      stringifyId(
        item.paymentLedgerEntryId,
      ),

    currency:
      item.currency,

    grossMerchandiseMinor:
      item.grossMerchandiseMinor,

    platformFeeMinor:
      item.platformFeeMinor,

    taxWithheldMinor:
      item.taxWithheldMinor,

    adjustmentMinor:
      item.adjustmentMinor,

    netPayableMinor:
      item.netPayableMinor,

    sellerOrderStatusSnapshot:
      item.sellerOrderStatusSnapshot,

    sourcePolicyVersion:
      item.sourcePolicyVersion,

    occurredAt:
      item.occurredAt,
  }
}

function serializeEvent(value) {
  const item =
    typeof value?.toObject ===
    'function'
      ? value.toObject()
      : value

  if (!item) {
    return null
  }

  return {
    id:
      stringifyId(
        item._id ||
          item.id,
      ),

    eventType:
      item.eventType,

    actorUserId:
      stringifyId(
        item.actorUserId,
      ),

    reason:
      item.reason,

    metadata:
      item.metadata ||
      {},

    occurredAt:
      item.occurredAt,
  }
}

async function appendSettlementEvent({
  settlement,
  actorUser,
  eventType,
  reason,
  metadata = {},
}) {
  return HostSettlementEvent.create({
    settlementId:
      settlement._id,

    organizationId:
      settlement.organizationId,

    eventType,

    actorUserId:
      actorId(
        actorUser,
      ),

    reason,
    metadata,
  })
}

async function getFinanceSnapshotForOrganization(
  organizationId,
) {
  const settledOrderIds =
    await HostSettlementLine.distinct(
      'sellerOrderId',
      {
        organizationId,
      },
    )

  const [
    deliveredOrders,
    unsettledDeliveredOrders,
    paidSettlements,
    pendingSettlements,
  ] =
    await Promise.all([
      SellerOrder.countDocuments({
        organizationId,

        status:
          'delivered',
      }),

      SellerOrder.countDocuments({
        organizationId,

        status:
          'delivered',

        ...(settledOrderIds.length
          ? {
              _id: {
                $nin:
                  settledOrderIds,
              },
            }
          : {}),
      }),

      HostSettlement.find({
        organizationId,

        status:
          'paid',
      })
        .select(
          'totals',
        )
        .lean(),

      HostSettlement.countDocuments({
        organizationId,

        status: {
          $in: [
            'pending_approval',
            'approved',
          ],
        },
      }),
    ])

  const paidNetMinor =
    paidSettlements.reduce(
      (
        total,
        settlement,
      ) =>
        total +
        Number(
          settlement?.totals
            ?.netPayableMinor ||
            0,
        ),
      0,
    )

  return {
    deliveredOrders,
    unsettledDeliveredOrders,
    pendingSettlements,
    paidNetMinor,

    policy: {
      appendOnlySettlementLines:
        true,

      commissionScheduleConfigured:
        false,

      automaticPayoutExecution:
        false,

      historicalLedgerMutationAllowed:
        false,
    },
  }
}

export async function getHostEarningsOverview({
  actorUser,
}) {
  const context =
    await resolveHostFinanceContext(
      actorUser,
    )

  const organizationId =
    context.organization._id

  const organizationObjectId =
    new mongoose.Types.ObjectId(
      organizationId,
    )

  const [
    settledOrderIds,
    organizationParentOrderIds,
  ] = await Promise.all([
    HostSettlementLine.distinct(
      'sellerOrderId',
      {
        organizationId,
      },
    ),

    SellerOrder.distinct(
      'parentOrderId',
      {
        organizationId,
      },
    ),
  ])

  const capturedParentOrderIds =
    organizationParentOrderIds.length
      ? await CommerceLedgerEntry.distinct(
          'parentOrderId',
          {
            parentOrderId: {
              $in:
                organizationParentOrderIds,
            },

            entryType:
              'payment_captured',
          },
        )
      : []

  const capturedParentObjectIds =
    capturedParentOrderIds.map(
      (value) =>
        new mongoose.Types.ObjectId(
          value,
        ),
    )

  const [
    capturedAggregate,
    deliveredAggregate,
    awaitingAggregate,
    settlementAggregates,
    recentOrders,
    recentSettlements,
  ] = await Promise.all([
    capturedParentObjectIds.length
      ? SellerOrder.aggregate([
          {
            $match: {
              organizationId:
                organizationObjectId,

              parentOrderId: {
                $in:
                  capturedParentObjectIds,
              },
            },
          },
          {
            $group: {
              _id:
                '$commercialSnapshot.currency',
              amountMinor: {
                $sum:
                  '$commercialSnapshot.itemSubtotalMinor',
              },
              orderCount: {
                $sum:
                  1,
              },
            },
          },
        ])
      : [],

    SellerOrder.aggregate([
      {
        $match: {
          organizationId:
            organizationObjectId,
          status:
            'delivered',
        },
      },
      {
        $group: {
          _id:
            '$commercialSnapshot.currency',
          amountMinor: {
            $sum:
              '$commercialSnapshot.itemSubtotalMinor',
          },
          orderCount: {
            $sum:
              1,
          },
        },
      },
    ]),

    SellerOrder.aggregate([
      {
        $match: {
          organizationId:
            organizationObjectId,
          status:
            'delivered',
          ...(settledOrderIds.length
            ? {
                _id: {
                  $nin:
                    settledOrderIds.map(
                      (value) =>
                        new mongoose.Types.ObjectId(
                          value,
                        ),
                    ),
                },
              }
            : {}),
        },
      },
      {
        $group: {
          _id:
            '$commercialSnapshot.currency',
          amountMinor: {
            $sum:
              '$commercialSnapshot.itemSubtotalMinor',
          },
          orderCount: {
            $sum:
              1,
          },
        },
      },
    ]),

    HostSettlement.aggregate([
      {
        $match: {
          organizationId:
            organizationObjectId,
          status: {
            $in: [
              'pending_approval',
              'approved',
              'paid',
            ],
          },
        },
      },
      {
        $group: {
          _id:
            '$status',
          netPayableMinor: {
            $sum:
              '$totals.netPayableMinor',
          },
          grossMerchandiseMinor: {
            $sum:
              '$totals.grossMerchandiseMinor',
          },
          settlementCount: {
            $sum:
              1,
          },
        },
      },
    ]),

    capturedParentObjectIds.length
      ? SellerOrder.find({
          organizationId,
          parentOrderId: {
            $in:
              capturedParentObjectIds,
          },
        })
          .select(
            '_id parentOrderId sellerName status commercialSnapshot createdAt updatedAt',
          )
          .sort({
            updatedAt:
              -1,
            createdAt:
              -1,
          })
          .limit(
            12,
          )
          .lean()
      : [],

    HostSettlement.find({
      organizationId,
    })
      .sort({
        periodEnd:
          -1,
        createdAt:
          -1,
      })
      .limit(
        8,
      )
      .lean(),
  ])

  const captured =
    capturedAggregate[0] ||
    {}

  const delivered =
    deliveredAggregate[0] ||
    {}

  const awaiting =
    awaitingAggregate[0] ||
    {}

  const settlementTotals =
    new Map(
      settlementAggregates.map(
        (item) => [
          item._id,
          item,
        ],
      ),
    )

  const paid =
    settlementTotals.get(
      'paid',
    ) ||
    {}

  const pendingApproval =
    settlementTotals.get(
      'pending_approval',
    ) ||
    {}

  const approved =
    settlementTotals.get(
      'approved',
    ) ||
    {}

  const paidMinor =
    Number(
      paid.netPayableMinor ||
        0,
    )

  const inSettlementMinor =
    Number(
      pendingApproval.netPayableMinor ||
        0,
    ) +
    Number(
      approved.netPayableMinor ||
        0,
    )

  const awaitingSettlementMinor =
    Number(
      awaiting.amountMinor ||
        0,
    )

  const capturedRevenueMinor =
    Number(
      captured.amountMinor ||
        0,
    )

  const recentOrderIds =
    recentOrders.map(
      (order) =>
        order._id,
    )

  const recentLines =
    recentOrderIds.length
      ? await HostSettlementLine.find({
          organizationId,
          sellerOrderId: {
            $in:
              recentOrderIds,
          },
        })
          .select(
            'sellerOrderId settlementId netPayableMinor grossMerchandiseMinor',
          )
          .lean()
      : []

  const recentSettlementIds = [
    ...new Set(
      recentLines
        .map(
          (line) =>
            stringifyId(
              line.settlementId,
            ),
        )
        .filter(
          Boolean,
        ),
    ),
  ]

  const recentOrderSettlements =
    recentSettlementIds.length
      ? await HostSettlement.find({
          _id: {
            $in:
              recentSettlementIds,
          },
        })
          .select(
            '_id status paidAt periodEnd',
          )
          .lean()
      : []

  const settlementStatusById =
    new Map(
      recentOrderSettlements.map(
        (settlement) => [
          stringifyId(
            settlement._id,
          ),
          settlement,
        ],
      ),
    )

  const lineBySellerOrderId =
    new Map(
      recentLines.map(
        (line) => [
          stringifyId(
            line.sellerOrderId,
          ),
          line,
        ],
      ),
    )

  const currency =
    captured._id ||
    delivered._id ||
    recentSettlements[0]?.currency ||
    'INR'

  return {
    organizationId:
      stringifyId(
        organizationId,
      ),

    earnings: {
      currency,

      /*
       * Revenue is recognized for this Host as soon as the customer payment
       * is captured for a parent order containing this Host's SellerOrder.
       * Settlement availability remains delivery-gated below.
       */
      totalEarnedMinor:
        capturedRevenueMinor,

      capturedRevenueMinor,

      paidMinor,
      inSettlementMinor,
      awaitingSettlementMinor,

      deliveredGrossMinor:
        Number(
          delivered.amountMinor ||
            0,
        ),

      capturedOrders:
        Number(
          captured.orderCount ||
            0,
        ),

      deliveredOrders:
        Number(
          delivered.orderCount ||
            0,
        ),

      awaitingSettlementOrders:
        Number(
          awaiting.orderCount ||
            0,
        ),

      openSettlements:
        Number(
          pendingApproval.settlementCount ||
            0,
        ) +
        Number(
          approved.settlementCount ||
            0,
        ),

      paidSettlements:
        Number(
          paid.settlementCount ||
            0,
        ),

      refreshedAt:
        new Date(),
    },

    recentOrders:
      recentOrders.map(
        (order) => {
          const line =
            lineBySellerOrderId.get(
              stringifyId(
                order._id,
              ),
            ) ||
            null

          const settlement =
            line
              ? settlementStatusById.get(
                  stringifyId(
                    line.settlementId,
                  ),
                ) ||
                null
              : null

          return {
            sellerOrderId:
              stringifyId(
                order._id,
              ),

            parentOrderId:
              stringifyId(
                order.parentOrderId,
              ),

            sellerName:
              order.sellerName ||
              '',

            orderStatus:
              order.status ||
              '',

            currency:
              order.commercialSnapshot?.currency ||
              currency,

            grossMinor:
              Number(
                order.commercialSnapshot?.itemSubtotalMinor ||
                  0,
              ),

            netPayableMinor:
              line
                ? Number(
                    line.netPayableMinor ||
                      0,
                  )
                : null,

            settlementStatus:
              settlement?.status ||
              (
                order.status ===
                  'delivered'
                  ? 'awaiting_settlement'
                  : 'not_yet_settleable'
              ),

            paidAt:
              settlement?.paidAt ||
              null,

            createdAt:
              order.createdAt ||
              null,

            updatedAt:
              order.updatedAt ||
              null,
          }
        },
      ),

    recentSettlements:
      recentSettlements.map(
        serializeSettlement,
      ),

    policy: {
      sourceOfTruth:
        'CommerceLedgerEntry + SellerOrder + HostSettlement',

      revenueRecognition:
        'captured_customer_payment',

      settlementEligibility:
        'delivered_seller_order',

      automaticPayoutExecution:
        false,

      commissionScheduleConfigured:
        false,
    },
  }
}

export async function getHostFinanceSummary({
  actorUser,
}) {
  const context =
    await resolveHostFinanceContext(
      actorUser,
    )

  return {
    organizationId:
      stringifyId(
        context.organization._id,
      ),

    summary:
      await getFinanceSnapshotForOrganization(
        context.organization._id,
      ),
  }
}

export async function listHostSettlements({
  page,
  limit,
  status,
  actorUser,
}) {
  const context =
    await resolveHostFinanceContext(
      actorUser,
    )

  const filter = {
    organizationId:
      context.organization._id,
  }

  if (status) {
    filter.status =
      status
  }

  const skip =
    (page - 1) *
    limit

  const [
    records,
    total,
  ] =
    await Promise.all([
      HostSettlement.find(
        filter,
      )
        .sort({
          periodEnd:
            -1,

          createdAt:
            -1,
        })
        .skip(
          skip,
        )
        .limit(
          limit,
        )
        .lean(),

      HostSettlement.countDocuments(
        filter,
      ),
    ])

  return {
    settlements:
      records.map(
        serializeSettlement,
      ),

    pagination: {
      page,
      limit,
      total,

      pages:
        total
          ? Math.ceil(
              total /
                limit,
            )
          : 0,
    },
  }
}

export async function getHostSettlement({
  settlementId,
  actorUser,
}) {
  const context =
    await resolveHostFinanceContext(
      actorUser,
    )

  const settlement =
    await HostSettlement.findOne({
      _id:
        settlementId,

      organizationId:
        context.organization._id,
    }).lean()

  if (!settlement) {
    throw new ApiError(
      404,
      'Settlement was not found.',
      [
        {
          code:
            'HOST_SETTLEMENT_NOT_FOUND',
        },
      ],
    )
  }

  const [
    lines,
    events,
  ] =
    await Promise.all([
      HostSettlementLine.find({
        settlementId,

        organizationId:
          context.organization._id,
      })
        .sort({
          occurredAt:
            1,
        })
        .lean(),

      HostSettlementEvent.find({
        settlementId,

        organizationId:
          context.organization._id,
      })
        .sort({
          occurredAt:
            1,
        })
        .lean(),
    ])

  return {
    settlement:
      serializeSettlement(
        settlement,
      ),

    lines:
      lines.map(
        serializeLine,
      ),

    events:
      events.map(
        serializeEvent,
      ),

    policy: {
      historyIsAppendOnly:
        true,

      automaticPayoutExecution:
        false,
    },
  }
}

async function eligibleSettlementOrders({
  organizationId,
  periodStart,
  periodEnd,
}) {
  const alreadySettledIds =
    await HostSettlementLine.distinct(
      'sellerOrderId',
      {
        organizationId,
      },
    )

  const orders =
    await SellerOrder.find({
      organizationId,

      status:
        'delivered',

      createdAt: {
        $gte:
          periodStart,

        $lt:
          periodEnd,
      },

      ...(alreadySettledIds.length
        ? {
            _id: {
              $nin:
                alreadySettledIds,
            },
          }
        : {}),
    })
      .sort({
        createdAt:
          1,
      })
      .lean()

  const parentOrderIds = [
    ...new Set(
      orders.map(
        (order) =>
          stringifyId(
            order.parentOrderId,
          ),
      ),
    ),
  ]

  const ledgerEntries =
    parentOrderIds.length
      ? await CommerceLedgerEntry.find({
          parentOrderId: {
            $in:
              parentOrderIds,
          },

          entryType:
            'payment_captured',
        })
          .sort({
            occurredAt:
              1,
          })
          .lean()
      : []

  const ledgerBySellerOrder =
    new Map()

  const ledgerByParent =
    new Map()

  for (
    const entry of
    ledgerEntries
  ) {
    const sellerOrderKey =
      stringifyId(
        entry.sellerOrderId,
      )

    if (
      sellerOrderKey &&
      !ledgerBySellerOrder.has(
        sellerOrderKey,
      )
    ) {
      ledgerBySellerOrder.set(
        sellerOrderKey,
        entry,
      )
    }

    const parentKey =
      stringifyId(
        entry.parentOrderId,
      )

    if (
      !ledgerByParent.has(
        parentKey,
      )
    ) {
      ledgerByParent.set(
        parentKey,
        entry,
      )
    }
  }

  return orders
    .map(
      (order) => ({
        order,

        ledger:
          ledgerBySellerOrder.get(
            stringifyId(
              order._id,
            ),
          ) ||
          ledgerByParent.get(
            stringifyId(
              order.parentOrderId,
            ),
          ) ||
          null,
      }),
    )
    .filter(
      (item) =>
        item.ledger,
    )
}

export async function createAdminSettlement({
  input,
  actorUser,
  adminAuthorization,
  requestId,
}) {
  const makerUserId =
    actorId(
      actorUser,
    )

  const organization =
    await MarketplaceOrganization.findOne({
      _id:
        input.organizationId,

      status:
        'active',
    }).lean()

  if (!organization) {
    throw new ApiError(
      404,
      'Marketplace organization was not found.',
      [
        {
          code:
            'FINANCE_SETTLEMENT_ORGANIZATION_NOT_FOUND',
        },
      ],
    )
  }

  const eligible =
    await eligibleSettlementOrders({
      organizationId:
        organization._id,

      periodStart:
        input.periodStart,

      periodEnd:
        input.periodEnd,
    })

  if (!eligible.length) {
    throw new ApiError(
      409,
      'No paid, delivered and unsettled SellerOrders exist in this period.',
      [
        {
          code:
            'FINANCE_SETTLEMENT_NO_ELIGIBLE_ORDERS',
        },
      ],
    )
  }

  const currencies = [
    ...new Set(
      eligible.map(
        ({
          order,
        }) =>
          order
            .commercialSnapshot
            ?.currency ||
          'INR',
      ),
    ),
  ]

  if (
    currencies.length !==
    1
  ) {
    throw new ApiError(
      409,
      'A settlement batch may contain only one currency.',
      [
        {
          code:
            'FINANCE_SETTLEMENT_MULTI_CURRENCY_NOT_SUPPORTED',
        },
      ],
    )
  }

  const currency =
    currencies[0]

  const lineInputs =
    eligible.map(
      ({
        order,
        ledger,
      }) => {
        const grossMerchandiseMinor =
          Number(
            order
              .commercialSnapshot
              ?.itemSubtotalMinor ||
              0,
          )

        return {
          organizationId:
            organization._id,

          sellerOrderId:
            order._id,

          parentOrderId:
            order.parentOrderId,

          paymentLedgerEntryId:
            ledger._id,

          currency,

          grossMerchandiseMinor,

          platformFeeMinor:
            0,

          taxWithheldMinor:
            0,

          adjustmentMinor:
            0,

          netPayableMinor:
            grossMerchandiseMinor,

          sellerOrderStatusSnapshot:
            order.status,

          sourcePolicyVersion:
            'm16-v1-no-commission-schedule',

          occurredAt:
            new Date(),
        }
      },
    )

  const totals =
    lineInputs.reduce(
      (
        acc,
        line,
      ) => ({
        grossMerchandiseMinor:
          acc.grossMerchandiseMinor +
          line.grossMerchandiseMinor,

        platformFeeMinor:
          acc.platformFeeMinor +
          line.platformFeeMinor,

        taxWithheldMinor:
          acc.taxWithheldMinor +
          line.taxWithheldMinor,

        adjustmentMinor:
          acc.adjustmentMinor +
          line.adjustmentMinor,

        netPayableMinor:
          acc.netPayableMinor +
          line.netPayableMinor,
      }),
      {
        grossMerchandiseMinor:
          0,

        platformFeeMinor:
          0,

        taxWithheldMinor:
          0,

        adjustmentMinor:
          0,

        netPayableMinor:
          0,
      },
    )

  const session =
    await mongoose.startSession()

  let settlement =
    null

  try {
    await session.withTransaction(
      async () => {
        const created =
          await HostSettlement.create(
            [
              {
                organizationId:
                  organization._id,

                periodStart:
                  input.periodStart,

                periodEnd:
                  input.periodEnd,

                currency,

                status:
                  'pending_approval',

                totals,

                lineCount:
                  lineInputs.length,

                createdByUserId:
                  makerUserId,

                reason:
                  input.reason,
              },
            ],
            {
              session,
            },
          )

        settlement =
          created[0]

        await HostSettlementLine.insertMany(
          lineInputs.map(
            (line) => ({
              ...line,

              settlementId:
                settlement._id,
            }),
          ),
          {
            session,
          },
        )

        await HostSettlementEvent.create(
          [
            {
              settlementId:
                settlement._id,

              organizationId:
                settlement.organizationId,

              eventType:
                'created',

              actorUserId:
                makerUserId,

              reason:
                input.reason,

              metadata: {
                makerCheckerRequired:
                  true,

                lineCount:
                  lineInputs.length,
              },
            },
          ],
          {
            session,
          },
        )
      },
    )
  } finally {
    await session.endSession()
  }

  await recordAdminAuditEvent({
    actorUser,
    adminAuthorization,

    action:
      'finance.mutate',

    permissionKey:
      'finance.mutate',

    entityType:
      'settlement',

    entityId:
      stringifyId(
        settlement._id,
      ),

    reasonCode:
      'finance.operation',

    reasonDetails:
      input.reason,

    beforeSnapshot:
      null,

    afterSnapshot:
      serializeSettlement(
        settlement,
      ),

    metadata: {
      operation:
        'm16_settlement_create',

      makerCheckerRequired:
        true,
    },

    requestId,
  })

  return getAdminSettlement({
    settlementId:
      settlement._id,
  })
}

export async function listAdminSettlements({
  page,
  limit,
  status,
}) {
  const filter =
    status
      ? {
          status,
        }
      : {}

  const skip =
    (page - 1) *
    limit

  const [
    records,
    total,
  ] =
    await Promise.all([
      HostSettlement.find(
        filter,
      )
        .sort({
          createdAt:
            -1,
        })
        .skip(
          skip,
        )
        .limit(
          limit,
        )
        .lean(),

      HostSettlement.countDocuments(
        filter,
      ),
    ])

  return {
    settlements:
      records.map(
        serializeSettlement,
      ),

    pagination: {
      page,
      limit,
      total,

      pages:
        total
          ? Math.ceil(
              total /
                limit,
            )
          : 0,
    },
  }
}

export async function getAdminSettlement({
  settlementId,
}) {
  const settlement =
    await HostSettlement.findById(
      settlementId,
    ).lean()

  if (!settlement) {
    throw new ApiError(
      404,
      'Settlement was not found.',
      [
        {
          code:
            'FINANCE_SETTLEMENT_NOT_FOUND',
        },
      ],
    )
  }

  const [
    organization,
    lines,
    events,
  ] =
    await Promise.all([
      MarketplaceOrganization.findById(
        settlement.organizationId,
      )
        .select(
          'displayName slug organizationType status',
        )
        .lean(),

      HostSettlementLine.find({
        settlementId,
      })
        .sort({
          occurredAt:
            1,
        })
        .lean(),

      HostSettlementEvent.find({
        settlementId,
      })
        .sort({
          occurredAt:
            1,
        })
        .lean(),
    ])

  return {
    settlement:
      serializeSettlement(
        settlement,
      ),

    organization:
      organization
        ? {
            id:
              stringifyId(
                organization._id,
              ),

            displayName:
              organization.displayName,

            slug:
              organization.slug,

            organizationType:
              organization.organizationType,

            status:
              organization.status,
          }
        : null,

    lines:
      lines.map(
        serializeLine,
      ),

    events:
      events.map(
        serializeEvent,
      ),
  }
}

export async function decideAdminSettlement({
  settlementId,
  input,
  actorUser,
  adminAuthorization,
  requestId,
}) {
  const checkerUserId =
    actorId(
      actorUser,
    )

  const settlement =
    await HostSettlement.findById(
      settlementId,
    )

  if (!settlement) {
    throw new ApiError(
      404,
      'Settlement was not found.',
      [
        {
          code:
            'FINANCE_SETTLEMENT_NOT_FOUND',
        },
      ],
    )
  }

  if (
    settlement.status !==
    'pending_approval'
  ) {
    throw new ApiError(
      409,
      'Settlement is not awaiting maker-checker approval.',
      [
        {
          code:
            'FINANCE_SETTLEMENT_DECISION_STATE_INVALID',
        },
      ],
    )
  }

  if (
    stringifyId(
      settlement.createdByUserId,
    ) ===
    stringifyId(
      checkerUserId,
    )
  ) {
    throw new ApiError(
      409,
      'Settlement maker cannot approve or reject their own batch.',
      [
        {
          code:
            'FINANCE_SETTLEMENT_MAKER_CHECKER_REQUIRED',
        },
      ],
    )
  }

  const before =
    serializeSettlement(
      settlement,
    )

  settlement.checkerUserId =
    checkerUserId

  settlement.reason =
    input.reason

  if (
    input.decision ===
    'approve'
  ) {
    settlement.status =
      'approved'

    settlement.approvedAt =
      new Date()
  } else {
    settlement.status =
      'rejected'

    settlement.rejectedAt =
      new Date()
  }

  await settlement.save()

  await appendSettlementEvent({
    settlement,
    actorUser,

    eventType:
      input.decision ===
      'approve'
        ? 'approved'
        : 'rejected',

    reason:
      input.reason,

    metadata: {
      checkerUserId:
        stringifyId(
          checkerUserId,
        ),
    },
  })

  await recordAdminAuditEvent({
    actorUser,
    adminAuthorization,

    action:
      'finance.mutate',

    permissionKey:
      'finance.mutate',

    entityType:
      'settlement',

    entityId:
      stringifyId(
        settlement._id,
      ),

    reasonCode:
      'finance.operation',

    reasonDetails:
      input.reason,

    beforeSnapshot:
      before,

    afterSnapshot:
      serializeSettlement(
        settlement,
      ),

    metadata: {
      operation:
        'm16_settlement_decision',

      decision:
        input.decision,

      makerCheckerEnforced:
        true,
    },

    requestId,
  })

  return getAdminSettlement({
    settlementId:
      settlement._id,
  })
}

export async function markAdminSettlementPaid({
  settlementId,
  input,
  actorUser,
  adminAuthorization,
  requestId,
}) {
  const settlement =
    await HostSettlement.findById(
      settlementId,
    )

  if (!settlement) {
    throw new ApiError(
      404,
      'Settlement was not found.',
      [
        {
          code:
            'FINANCE_SETTLEMENT_NOT_FOUND',
        },
      ],
    )
  }

  if (
    settlement.status !==
    'approved'
  ) {
    throw new ApiError(
      409,
      'Only an approved settlement can be marked paid.',
      [
        {
          code:
            'FINANCE_SETTLEMENT_PAYMENT_STATE_INVALID',
        },
      ],
    )
  }

  const before =
    serializeSettlement(
      settlement,
    )

  settlement.status =
    'paid'

  settlement.paidAt =
    new Date()

  settlement.payoutReference =
    input.payoutReference

  settlement.reason =
    input.reason

  await settlement.save()

  await appendSettlementEvent({
    settlement,
    actorUser,

    eventType:
      'paid',

    reason:
      input.reason,

    metadata: {
      payoutReference:
        input.payoutReference,

      providerExecutionPerformed:
        false,
    },
  })

  await recordAdminAuditEvent({
    actorUser,
    adminAuthorization,

    action:
      'finance.mutate',

    permissionKey:
      'finance.mutate',

    entityType:
      'settlement',

    entityId:
      stringifyId(
        settlement._id,
      ),

    reasonCode:
      'finance.operation',

    reasonDetails:
      input.reason,

    beforeSnapshot:
      before,

    afterSnapshot:
      serializeSettlement(
        settlement,
      ),

    metadata: {
      operation:
        'm16_settlement_mark_paid',

      providerExecutionPerformed:
        false,
    },

    requestId,
  })

  return getAdminSettlement({
    settlementId:
      settlement._id,
  })
}