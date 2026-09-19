import mongoose from 'mongoose'

const {
  Schema,
} = mongoose

const objectId =
  Schema.Types.ObjectId

const moneySnapshotSchema =
  new Schema(
    {
      amountMinor: {
        type:
          Number,

        required:
          true,

        min:
          0,
      },

      currency: {
        type:
          String,

        required:
          true,

        trim:
          true,

        uppercase:
          true,

        default:
          'INR',
      },
    },
    {
      _id:
        false,
    },
  )

const orderTotalsSchema =
  new Schema(
    {
      itemSubtotalMinor: {
        type:
          Number,

        required:
          true,

        min:
          0,
      },

      knownFeesMinor: {
        type:
          Number,

        min:
          0,

        default:
          null,
      },

      totalLandedCostMinor: {
        type:
          Number,

        min:
          0,

        default:
          null,
      },

      landedCostCompleteness: {
        type:
          String,

        enum: [
          'item_prices_only',
          'complete',
        ],

        required:
          true,
      },

      currency: {
        type:
          String,

        required:
          true,

        default:
          'INR',
      },
    },
    {
      _id:
        false,
    },
  )

const reservationAllocationSchema =
  new Schema(
    {
      inventoryNodeId: {
        type:
          objectId,

        ref:
          'InventoryNode',

        required:
          true,
      },

      quantity: {
        type:
          Number,

        required:
          true,

        min:
          1,
      },
    },
    {
      _id:
        false,
    },
  )

const sellerOrderItemSchema =
  new Schema(
    {
      cartItemId: {
        type:
          objectId,

        required:
          true,
      },

      requirementLineId: {
        type:
          objectId,

        ref:
          'RequirementLine',

        default:
          null,
      },

      productMatchId: {
        type:
          objectId,

        ref:
          'ProductMatch',

        default:
          null,
      },

      canonicalIngredientId: {
        type:
          objectId,

        ref:
          'CanonicalIngredient',

        default:
          null,
      },

      displayName: {
        type:
          String,

        trim:
          true,

        maxlength:
          300,

        default:
          '',
      },

      productVersionId: {
        type:
          objectId,

        ref:
          'ProductVersion',

        required:
          true,
      },

      packId: {
        type:
          objectId,

        ref:
          'Pack',

        required:
          true,
      },

      offerId: {
        type:
          objectId,

        ref:
          'HostOffer',

        required:
          true,
      },

      packCount: {
        type:
          Number,

        required:
          true,

        min:
          1,
      },

      packQuantity: {
        type:
          Number,

        required:
          true,

        min:
          0.000001,
      },

      packUnit: {
        type:
          String,

        required:
          true,
      },

      requiredQuantity: {
        type:
          Number,

        required:
          true,

        min:
          0,
      },

      requiredUnit: {
        type:
          String,

        required:
          true,
      },

      suppliedQuantity: {
        type:
          Number,

        required:
          true,

        min:
          0,
      },

      surplusQuantity: {
        type:
          Number,

        required:
          true,

        min:
          0,
      },

      unitPrice: {
        type:
          moneySnapshotSchema,

        required:
          true,
      },

      lineTotal: {
        type:
          moneySnapshotSchema,

        required:
          true,
      },

      priceRecordedAt: {
        type:
          Date,

        default:
          null,
      },

      inventoryObservedAt: {
        type:
          Date,

        default:
          null,
      },

      reservationAllocations: {
        type: [
          reservationAllocationSchema,
        ],

        default:
          [],
      },
    },
    {
      _id:
        false,
    },
  )

/*
|--------------------------------------------------------------------------
| Inventory Reservation State
|--------------------------------------------------------------------------
|
| M05 InventorySnapshot stays immutable observation history.
|
| This is only M11 checkout reservation overlay.
|
*/

const inventoryReservationStateSchema =
  new Schema(
    {
      organizationId: {
        type:
          objectId,

        ref:
          'MarketplaceOrganization',

        required:
          true,
      },

      offerId: {
        type:
          objectId,

        ref:
          'HostOffer',

        required:
          true,
      },

      inventoryNodeId: {
        type:
          objectId,

        ref:
          'InventoryNode',

        required:
          true,
      },

      capacityAvailableQuantity: {
        type:
          Number,

        required:
          true,

        min:
          0,

        default:
          0,
      },

      capacityBaselineReservedQuantity: {
        type:
          Number,

        required:
          true,

        min:
          0,

        default:
          0,
      },

      capacitySellableQuantity: {
        type:
          Number,

        required:
          true,

        min:
          0,

        default:
          0,
      },

      checkoutReservedQuantity: {
        type:
          Number,

        required:
          true,

        min:
          0,

        default:
          0,
      },

      inventoryObservedAt: {
        type:
          Date,

        default:
          null,
      },
    },
    {
      timestamps:
        true,

      collection:
        'inventoryReservationStates',
    },
  )

inventoryReservationStateSchema.index(
  {
    offerId:
      1,

    inventoryNodeId:
      1,
  },
  {
    unique:
      true,
  },
)

/*
|--------------------------------------------------------------------------
| Inventory Reservation
|--------------------------------------------------------------------------
*/

const inventoryReservationSchema =
  new Schema(
    {
      ownerUserId: {
        type:
          objectId,

        ref:
          'User',

        required:
          true,

        index:
          true,
      },

      householdId: {
        type:
          objectId,

        ref:
          'Household',

        required:
          true,

        index:
          true,
      },

      marketplaceCartId: {
        type:
          objectId,

        ref:
          'MarketplaceCart',

        required:
          true,

        index:
          true,
      },

      parentOrderId: {
        type:
          objectId,

        ref:
          'ParentOrder',

        required:
          true,

        index:
          true,
      },

      sellerOrderId: {
        type:
          objectId,

        ref:
          'SellerOrder',

        required:
          true,

        index:
          true,
      },

      cartItemId: {
        type:
          objectId,

        required:
          true,
      },

      organizationId: {
        type:
          objectId,

        ref:
          'MarketplaceOrganization',

        required:
          true,
      },

      offerId: {
        type:
          objectId,

        ref:
          'HostOffer',

        required:
          true,

        index:
          true,
      },

      inventoryNodeId: {
        type:
          objectId,

        ref:
          'InventoryNode',

        required:
          true,

        index:
          true,
      },

      quantity: {
        type:
          Number,

        required:
          true,

        min:
          1,
      },

      status: {
        type:
          String,

        enum: [
          'active',
          'converted',
          'released',
          'expired',
        ],

        required:
          true,

        default:
          'active',

        index:
          true,
      },

      expiresAt: {
        type:
          Date,

        required:
          true,

        index:
          true,
      },

      releasedAt: {
        type:
          Date,

        default:
          null,
      },

      releaseReason: {
        type:
          String,

        trim:
          true,

        default:
          '',
      },

      idempotencyKey: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },
    },
    {
      timestamps:
        true,

      collection:
        'inventoryReservations',
    },
  )

inventoryReservationSchema.index(
  {
    parentOrderId:
      1,

    cartItemId:
      1,

    inventoryNodeId:
      1,
  },
  {
    unique:
      true,
  },
)

inventoryReservationSchema.index({
  offerId:
    1,

  inventoryNodeId:
    1,

  status:
    1,

  expiresAt:
    1,
})

const deliveryAddressSnapshotSchema =
  new Schema(
    {
      sourceAddressId: {
        type:
          objectId,

        ref:
          'DeliveryAddress',

        default:
          null,
      },

      recipientType: {
        type:
          String,

        enum: [
          'self',
          'other',
        ],

        default:
          'self',
      },

      recipientName: {
        type:
          String,

        trim:
          true,

        default:
          '',
      },

      phone: {
        type:
          String,

        trim:
          true,

        default:
          '',
      },

      label: {
        type:
          String,

        trim:
          true,

        default:
          'home',
      },

      customLabel: {
        type:
          String,

        trim:
          true,

        default:
          '',
      },

      addressLine1: {
        type:
          String,

        trim:
          true,

        default:
          '',
      },

      addressLine2: {
        type:
          String,

        trim:
          true,

        default:
          '',
      },

      area: {
        type:
          String,

        trim:
          true,

        default:
          '',
      },

      landmark: {
        type:
          String,

        trim:
          true,

        default:
          '',
      },

      city: {
        type:
          String,

        trim:
          true,

        default:
          '',
      },

      state: {
        type:
          String,

        trim:
          true,

        default:
          '',
      },

      postalCode: {
        type:
          String,

        trim:
          true,

        default:
          '',
      },

      country: {
        type:
          String,

        trim:
          true,

        default:
          'India',
      },

      deliveryInstructions: {
        type:
          String,

        trim:
          true,

        default:
          '',
      },

      capturedAt: {
        type:
          Date,

        required:
          true,

        default:
          Date.now,
      },
    },
    {
      _id:
        false,
    },
  )

/*
|--------------------------------------------------------------------------
| Parent Order
|--------------------------------------------------------------------------
*/

const parentOrderSchema =
  new Schema(
    {
      ownerUserId: {
        type:
          objectId,

        ref:
          'User',

        required:
          true,

        index:
          true,
      },

      householdId: {
        type:
          objectId,

        ref:
          'Household',

        required:
          true,

        index:
          true,
      },

      sourceType: {
        type:
          String,

        enum: [
          'basket_quote',
          'direct_product',
        ],

        required:
          true,

        default:
          'basket_quote',

        index:
          true,
      },

      outcomePlanId: {
        type:
          objectId,

        ref:
          'OutcomePlan',

        default:
          null,

        index:
          true,
      },

      outcomePlanRevision: {
        type:
          Number,

        min:
          1,

        default:
          null,
      },

      marketplaceCartId: {
        type:
          objectId,

        ref:
          'MarketplaceCart',

        required:
          true,

        index:
          true,
      },

      sellerOrderIds: {
        type: [
          objectId,
        ],

        default:
          [],
      },

      externalHandoffIds: {
        type: [
          objectId,
        ],

        default:
          [],
      },

      totals: {
        type:
          orderTotalsSchema,

        required:
          true,
      },

      deliveryAddressSnapshot: {
        type:
          deliveryAddressSnapshotSchema,

        default:
          null,
      },

      status: {
        type:
          String,

        enum: [
          'draft',
          'payment_pending',
          'confirmed',
          'partially_unavailable',
          'customer_cancelled',
          'seller_cancelled',
          'delivery_failed',
          'delivered',
          'return_requested',
          'returned',
          'refunded',
        ],

        required:
          true,

        default:
          'draft',

        index:
          true,
      },

      paymentStatus: {
        type:
          String,

        enum: [
          'not_started',
          'pending',
          'paid',
          'failed',
          'refunded',
        ],

        required:
          true,

        default:
          'not_started',
      },

      paymentProvider: {
        type:
          String,

        trim:
          true,

        default:
          'razorpay',
      },

      paymentReady: {
        type:
          Boolean,

        required:
          true,

        default:
          false,
      },

      checkoutBlockers: {
        type: [
          String,
        ],

        default:
          [],
      },

      reservationExpiresAt: {
        type:
          Date,

        default:
          null,
      },

      createIdempotencyKey: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          160,
      },
    },
    {
      timestamps:
        true,

      collection:
        'parentOrders',
    },
  )

parentOrderSchema.index(
  {
    ownerUserId:
      1,

    createIdempotencyKey:
      1,
  },
  {
    unique:
      true,
  },
)

parentOrderSchema.index({
  ownerUserId:
    1,

  householdId:
    1,

  createdAt:
    -1,
})

/*
|--------------------------------------------------------------------------
| Seller Order
|--------------------------------------------------------------------------
*/

const sellerOrderSchema =
  new Schema(
    {
      parentOrderId: {
        type:
          objectId,

        ref:
          'ParentOrder',

        required:
          true,

        index:
          true,
      },

      organizationId: {
        type:
          objectId,

        ref:
          'MarketplaceOrganization',

        required:
          true,

        index:
          true,
      },

      sellerName: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      items: {
        type: [
          sellerOrderItemSchema,
        ],

        default:
          [],
      },

      commercialSnapshot: {
        type:
          orderTotalsSchema,

        required:
          true,
      },

      fulfillment: {
        type: {
          fulfillmentType: {
            type:
              String,

            enum: [
              'delivery',
              'pickup',
            ],

            default:
              null,
          },

          pincode: {
            type:
              String,

            required:
              true,
          },

          deliveryAddressSnapshot: {
            type:
              deliveryAddressSnapshotSchema,

            default:
              null,
          },

          promiseState: {
            type:
              String,

            enum: [
              'serviceable',
              'needs_fee_quote',
            ],

            required:
              true,
          },

          cancellationPolicyState: {
            type:
              String,

            enum: [
              'not_configured',
              'configured',
            ],

            required:
              true,

            default:
              'not_configured',
          },

          returnPolicyState: {
            type:
              String,

            enum: [
              'not_configured',
              'configured',
            ],

            required:
              true,

            default:
              'not_configured',
          },
        },

        required:
          true,

        _id:
          false,
      },

      status: {
        type:
          String,

        enum: [
          'draft',
          'payment_pending',
          'confirmed',
          'seller_accepted',
          'picking',
          'packed',
          'carrier_handoff',
          'out_for_delivery',
          'delivered',
          'rejected',
          'partial_unavailable',
          'substitution_requested',
          'customer_cancelled',
          'seller_cancelled',
          'delivery_failed',
          'return_requested',
          'returned',
          'refunded',
        ],

        required:
          true,

        default:
          'draft',

        index:
          true,
      },

      reservationExpiresAt: {
        type:
          Date,

        default:
          null,
      },
    },
    {
      timestamps:
        true,

      collection:
        'sellerOrders',
    },
  )

sellerOrderSchema.index({
  organizationId:
    1,

  status:
    1,

  createdAt:
    -1,
})

/*
|--------------------------------------------------------------------------
| External Handoff
|--------------------------------------------------------------------------
|
| destinationUrl is supplied only by a normalized server-side partner adapter.
|--------------------------------------------------------------------------
*/

const externalHandoffSchema =
  new Schema(
    {
      ownerUserId: {
        type:
          objectId,

        ref:
          'User',

        required:
          true,

        index:
          true,
      },

      householdId: {
        type:
          objectId,

        ref:
          'Household',

        required:
          true,

        index:
          true,
      },

      outcomePlanId: {
        type:
          objectId,

        ref:
          'OutcomePlan',

        required:
          true,

        index:
          true,
      },

      parentOrderId: {
        type:
          objectId,

        ref:
          'ParentOrder',

        default:
          null,
      },

      partnerId: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      targetType: {
        type:
          String,

        enum: [
          'retailer',
        ],

        required:
          true,

        default:
          'retailer',
      },

      items: {
        type: [
          {
            requirementLineId: {
              type:
                objectId,

              ref:
                'RequirementLine',

              required:
                true,
            },

            canonicalIngredientId: {
              type:
                objectId,

              ref:
                'CanonicalIngredient',

              required:
                true,
            },

            quantity: {
              type:
                Number,

              required:
                true,

              min:
                0,
            },

            unit: {
              type:
                String,

              required:
                true,
            },
          },
        ],

        default:
          [],
      },

      destinationUrl: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      attribution: {
        type:
          Schema.Types.Mixed,

        default:
          {},
      },

      handedOffAt: {
        type:
          Date,

        required:
          true,

        default:
          Date.now,
      },
    },
    {
      timestamps: {
        createdAt:
          true,

        updatedAt:
          false,
      },

      collection:
        'externalHandoffs',
    },
  )

function blockImmutableTransactionEventMutation(
  label,
) {
  return function immutableTransactionEventMutationBlocked() {
    throw new Error(
      `${label} records are append-only and cannot be changed or deleted.`,
    )
  }
}

externalHandoffSchema.pre(
  [
    'updateOne',
    'updateMany',
    'findOneAndUpdate',
    'deleteOne',
    'deleteMany',
    'findOneAndDelete',
  ],
  blockImmutableTransactionEventMutation(
    'External Handoff',
  ),
)

export const InventoryReservationState =
  mongoose.models.InventoryReservationState ||
  mongoose.model(
    'InventoryReservationState',
    inventoryReservationStateSchema,
  )

export const InventoryReservation =
  mongoose.models.InventoryReservation ||
  mongoose.model(
    'InventoryReservation',
    inventoryReservationSchema,
  )

export const ParentOrder =
  mongoose.models.ParentOrder ||
  mongoose.model(
    'ParentOrder',
    parentOrderSchema,
  )

export const SellerOrder =
  mongoose.models.SellerOrder ||
  mongoose.model(
    'SellerOrder',
    sellerOrderSchema,
  )

export const ExternalHandoff =
  mongoose.models.ExternalHandoff ||
  mongoose.model(
    'ExternalHandoff',
    externalHandoffSchema,
  )