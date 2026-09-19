import crypto from 'node:crypto'

import mongoose from 'mongoose'

const {
  Schema,
  model,
  models,
} = mongoose

export const PURCHASE_TRANSACTION_STATUSES =
  Object.freeze([
    'ordered',
    'partially_fulfilled',
    'delivered',
    'cancelled',
    'refunded',
  ])

export const PURCHASE_TRANSACTION_SOURCE_TYPES =
  Object.freeze([
    'commerce_email',
    'retailer_order',
    'receipt_import',
  ])

export const PURCHASE_ITEM_MATCH_STATUSES =
  Object.freeze([
    'unmatched',
    'candidate',
    'matched',
    'needs_review',
  ])

/*
|--------------------------------------------------------------------------
| Customer Override
|--------------------------------------------------------------------------
|
| Imported provider data and customer corrections are intentionally separate.
| A later provider re-sync may refresh source facts, but it must never erase a
| customer's correction/exclusion decision.
|
*/

const customerOverrideSchema =
  new Schema(
    {
      correctedLabel: {
        type:
          String,

        trim:
          true,

        maxlength:
          240,

        default:
          '',
      },

      canonicalPackId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'Pack',

        default:
          null,
      },

      canonicalIngredientId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'CanonicalIngredient',

        default:
          null,
      },

      quantity: {
        type:
          Number,

        min:
          0,

        default:
          null,
      },

      note: {
        type:
          String,

        trim:
          true,

        maxlength:
          500,

        default:
          '',
      },

      correctedAt: {
        type:
          Date,

        default:
          null,
      },

      correctedByUserId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'User',

        default:
          null,
      },
    },

    {
      _id:
        false,

      strict:
        'throw',
    },
  )

/*
|--------------------------------------------------------------------------
| Imported Purchase Line
|--------------------------------------------------------------------------
|
| lineKey is a one-way hash derived by the trusted adapter/ingestion layer.
| Raw provider line identifiers are not stored.
|
*/

const purchaseTransactionItemSchema =
  new Schema(
    {
      lineKey: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          64,
      },

      sourceLabel: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          240,
      },

      brand: {
        type:
          String,

        trim:
          true,

        maxlength:
          160,

        default:
          '',
      },

      packText: {
        type:
          String,

        trim:
          true,

        maxlength:
          120,

        default:
          '',
      },

      quantityOrdered: {
        type:
          Number,

        min:
          0,

        required:
          true,

        default:
          1,
      },

      quantityFulfilled: {
        type:
          Number,

        min:
          0,

        default:
          null,
      },

      unitPriceMinor: {
        type:
          Number,

        min:
          0,

        default:
          null,
      },

      discountMinor: {
        type:
          Number,

        min:
          0,

        default:
          0,
      },

      canonicalPackId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'Pack',

        default:
          null,

        index:
          true,
      },

      canonicalIngredientId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'CanonicalIngredient',

        default:
          null,

        index:
          true,
      },

      matchStatus: {
        type:
          String,

        enum:
          PURCHASE_ITEM_MATCH_STATUSES,

        required:
          true,

        default:
          'unmatched',
      },

      matchConfidence: {
        type:
          Number,

        min:
          0,

        max:
          1,

        default:
          null,
      },

      excludedFromLearning: {
        type:
          Boolean,

        required:
          true,

        default:
          false,
      },

      customerOverride: {
        type:
          customerOverrideSchema,

        required:
          true,

        default:
          () => ({}),
      },
    },

    {
      _id:
        false,

      strict:
        'throw',
    },
  )

/*
|--------------------------------------------------------------------------
| Purchase Transaction
|--------------------------------------------------------------------------
|
| This collection stores normalized commerce evidence, not mailbox content.
| Full email bodies, OAuth tokens and arbitrary inbox data are forbidden here.
|
*/

const purchaseTransactionSchema =
  new Schema(
    {
      transactionId: {
        type:
          String,

        required:
          true,

        unique:
          true,

        immutable:
          true,

        index:
          true,

        default:
          () =>
            `ptxn_${crypto.randomUUID()}`,
      },

      userId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'User',

        required:
          true,

        immutable:
          true,

        index:
          true,
      },

      householdId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'Household',

        required:
          true,

        immutable:
          true,

        index:
          true,
      },

      sourceId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'ConnectedPurchaseSource',

        required:
          true,

        immutable:
          true,

        index:
          true,
      },

      externalReferenceHash: {
        type:
          String,

        required:
          true,

        immutable:
          true,

        trim:
          true,

        maxlength:
          64,
      },

      sourceType: {
        type:
          String,

        enum:
          PURCHASE_TRANSACTION_SOURCE_TYPES,

        required:
          true,

        immutable:
          true,
      },

      merchantName: {
        type:
          String,

        trim:
          true,

        maxlength:
          180,

        default:
          '',
      },

      purchasedAt: {
        type:
          Date,

        required:
          true,

        index:
          true,
      },

      expectedDeliveryAt: {
        type:
          Date,

        default:
          null,
      },

      deliveredAt: {
        type:
          Date,

        default:
          null,
      },

      currency: {
        type:
          String,

        trim:
          true,

        uppercase:
          true,

        minlength:
          3,

        maxlength:
          3,

        default:
          'INR',
      },

      totalMinor: {
        type:
          Number,

        min:
          0,

        default:
          null,
      },

      status: {
        type:
          String,

        enum:
          PURCHASE_TRANSACTION_STATUSES,

        required:
          true,

        default:
          'ordered',

        index:
          true,
      },

      items: {
        type: [
          purchaseTransactionItemSchema,
        ],

        required:
          true,

        default:
          [],
      },

      excludedFromLearning: {
        type:
          Boolean,

        required:
          true,

        default:
          false,

        index:
          true,
      },

      correctionNote: {
        type:
          String,

        trim:
          true,

        maxlength:
          800,

        default:
          '',
      },

      correctedAt: {
        type:
          Date,

        default:
          null,
      },

      correctedByUserId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'User',

        default:
          null,
      },

      importedAt: {
        type:
          Date,

        required:
          true,

        default:
          Date.now,
      },
    },

    {
      timestamps:
        true,

      collection:
        'purchase_transactions',

      strict:
        'throw',

      minimize:
        false,
    },
  )

purchaseTransactionSchema.index(
  {
    sourceId:
      1,

    externalReferenceHash:
      1,
  },
  {
    unique:
      true,

    name:
      'purchase_transaction_source_external_unique',
  },
)

purchaseTransactionSchema.index(
  {
    userId:
      1,

    householdId:
      1,

    purchasedAt:
      -1,
  },
  {
    name:
      'purchase_transaction_owner_household_recent',
  },
)

export const PurchaseTransaction =
  models.PurchaseTransaction ||
  model(
    'PurchaseTransaction',
    purchaseTransactionSchema,
  )
