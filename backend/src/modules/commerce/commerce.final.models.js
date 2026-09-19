import mongoose from 'mongoose'

const {
  Schema,
} =
  mongoose

const objectId =
  Schema.Types.ObjectId

function appendOnlyGuard(
  label,
) {
  return function blockMutation() {
    throw new Error(
      `${label} records are append-only and cannot be changed or deleted.`,
    )
  }
}

const commerceHostPolicySchema =
  new Schema(
    {
      organizationId: {
        type:
          objectId,

        ref:
          'MarketplaceOrganization',

        required:
          true,

        unique:
          true,

        index:
          true,
      },

      currency: {
        type:
          String,

        required:
          true,

        uppercase:
          true,

        trim:
          true,

        default:
          'INR',
      },

      deliveryFeeMinor: {
        type:
          Number,

        required:
          true,

        min:
          0,
      },

      freeDeliveryThresholdMinor: {
        type:
          Number,

        min:
          0,

        default:
          null,
      },

      cancellationPolicySummary: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      returnPolicySummary: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      status: {
        type:
          String,

        enum: [
          'active',
          'disabled',
        ],

        required:
          true,

        default:
          'active',
      },

      version: {
        type:
          Number,

        required:
          true,

        min:
          1,

        default:
          1,
      },

      updatedByUserId: {
        type:
          objectId,

        ref:
          'User',

        required:
          true,
      },
    },
    {
      timestamps:
        true,

      collection:
        'hostCommercePolicies',
    },
  )

const sellerPromiseSnapshotSchema =
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

      sellerOrderId: {
        type:
          objectId,

        ref:
          'SellerOrder',

        required:
          true,

        unique:
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

      currency: {
        type:
          String,

        required:
          true,

        uppercase:
          true,
      },

      itemSubtotalMinor: {
        type:
          Number,

        required:
          true,

        min:
          0,
      },

      deliveryFeeMinor: {
        type:
          Number,

        required:
          true,

        min:
          0,
      },

      totalLandedCostMinor: {
        type:
          Number,

        required:
          true,

        min:
          0,
      },

      policyVersion: {
        type:
          Number,

        required:
          true,

        min:
          1,
      },

      cancellationPolicySummary: {
        type:
          String,

        required:
          true,
      },

      returnPolicySummary: {
        type:
          String,

        required:
          true,
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
      timestamps: {
        createdAt:
          true,

        updatedAt:
          false,
      },

      collection:
        'sellerPromiseSnapshots',
    },
  )

const commercePaymentIntentSchema =
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

      provider: {
        type:
          String,

        enum: [
          'razorpay',
        ],

        required:
          true,

        default:
          'razorpay',
      },

      providerOrderId: {
        type:
          String,

        required:
          true,

        unique:
          true,

        trim:
          true,
      },

      providerPaymentId: {
        type:
          String,

        trim:
          true,

        default:
          '',
      },

      amountMinor: {
        type:
          Number,

        required:
          true,

        min:
          1,
      },

      currency: {
        type:
          String,

        required:
          true,

        uppercase:
          true,
      },

      status: {
        type:
          String,

        enum: [
          'created',
          'verified',
          'paid',
          'failed',
          'cancelled',
        ],

        required:
          true,

        default:
          'created',

        index:
          true,
      },

      createIdempotencyKey: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      paidAt: {
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
        'payments',
    },
  )

commercePaymentIntentSchema.index(
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

const commercePaymentWebhookSchema =
  new Schema(
    {
      provider: {
        type:
          String,

        enum: [
          'razorpay',
        ],

        required:
          true,
      },

      providerEventId: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      eventType: {
        type:
          String,

        required:
          true,
      },

      providerOrderId: {
        type:
          String,

        trim:
          true,

        default:
          '',
      },

      providerPaymentId: {
        type:
          String,

        trim:
          true,

        default:
          '',
      },

      payloadHash: {
        type:
          String,

        required:
          true,
      },

      status: {
        type:
          String,

        enum: [
          'received',
          'processed',
          'ignored',
          'failed',
        ],

        required:
          true,

        default:
          'received',
      },

      processedAt: {
        type:
          Date,

        default:
          null,
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
        'paymentWebhookEvents',
    },
  )

commercePaymentWebhookSchema.index(
  {
    provider:
      1,

    providerEventId:
      1,
  },
  {
    unique:
      true,
  },
)

const commerceOrderEventSchema =
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

      sellerOrderId: {
        type:
          objectId,

        ref:
          'SellerOrder',

        default:
          null,

        index:
          true,
      },

      organizationId: {
        type:
          objectId,

        ref:
          'MarketplaceOrganization',

        default:
          null,
      },

      actorType: {
        type:
          String,

        enum: [
          'customer',
          'host',
          'system',
          'payment_provider',
        ],

        required:
          true,
      },

      actorUserId: {
        type:
          objectId,

        ref:
          'User',

        default:
          null,
      },

      eventType: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      fromStatus: {
        type:
          String,

        trim:
          true,

        default:
          '',
      },

      toStatus: {
        type:
          String,

        trim:
          true,

        default:
          '',
      },

      note: {
        type:
          String,

        trim:
          true,

        maxlength:
          1000,

        default:
          '',
      },

      idempotencyKey: {
        type:
          String,

        trim:
          true,

        default:
          '',
      },

      occurredAt: {
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
        'orderEvents',
    },
  )

commerceOrderEventSchema.index({
  parentOrderId:
    1,

  occurredAt:
    1,

  _id:
    1,
})

commerceOrderEventSchema.index(
  {
    parentOrderId:
      1,

    sellerOrderId:
      1,

    idempotencyKey:
      1,
  },
  {
    partialFilterExpression: {
      idempotencyKey: {
        $type:
          'string',

        $gt:
          '',
      },
    },
  },
)

commerceOrderEventSchema.index(
  {
    sellerOrderId:
      1,

    idempotencyKey:
      1,
  },
  {
    unique:
      true,

    partialFilterExpression: {
      sellerOrderId: {
        $type:
          'objectId',
      },

      idempotencyKey: {
        $type:
          'string',

        $gt:
          '',
      },
    },
  },
)

const commerceLedgerEntrySchema =
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

      sellerOrderId: {
        type:
          objectId,

        ref:
          'SellerOrder',

        default:
          null,

        index:
          true,
      },

      paymentIntentId: {
        type:
          objectId,

        ref:
          'CommercePaymentIntent',

        required:
          true,
      },

      entryType: {
        type:
          String,

        enum: [
          'payment_captured',
        ],

        required:
          true,
      },

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

        uppercase:
          true,
      },

      idempotencyKey: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      occurredAt: {
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
        'ledgerEntries',
    },
  )

commerceLedgerEntrySchema.index(
  {
    idempotencyKey:
      1,
  },
  {
    unique:
      true,
  },
)

for (
  const [
    schema,
    label,
  ]
  of [
    [
      sellerPromiseSnapshotSchema,
      'Seller Promise Snapshot',
    ],

    [
      commerceOrderEventSchema,
      'Order Event',
    ],

    [
      commerceLedgerEntrySchema,
      'Ledger Entry',
    ],
  ]
) {
  schema.pre(
    [
      'updateOne',
      'updateMany',
      'findOneAndUpdate',
      'deleteOne',
      'deleteMany',
      'findOneAndDelete',
    ],
    appendOnlyGuard(
      label,
    ),
  )
}

export const CommerceHostPolicy =
  mongoose.models.CommerceHostPolicy ||
  mongoose.model(
    'CommerceHostPolicy',
    commerceHostPolicySchema,
  )

export const SellerPromiseSnapshot =
  mongoose.models.SellerPromiseSnapshot ||
  mongoose.model(
    'SellerPromiseSnapshot',
    sellerPromiseSnapshotSchema,
  )

export const CommercePaymentIntent =
  mongoose.models.CommercePaymentIntent ||
  mongoose.model(
    'CommercePaymentIntent',
    commercePaymentIntentSchema,
  )

export const CommercePaymentWebhookEvent =
  mongoose.models.CommercePaymentWebhookEvent ||
  mongoose.model(
    'CommercePaymentWebhookEvent',
    commercePaymentWebhookSchema,
  )

export const CommerceOrderEvent =
  mongoose.models.CommerceOrderEvent ||
  mongoose.model(
    'CommerceOrderEvent',
    commerceOrderEventSchema,
  )

export const CommerceLedgerEntry =
  mongoose.models.CommerceLedgerEntry ||
  mongoose.model(
    'CommerceLedgerEntry',
    commerceLedgerEntrySchema,
  )