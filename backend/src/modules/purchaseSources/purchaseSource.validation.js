import {
  z,
} from 'zod'

import {
  PURCHASE_SOURCE_PROVIDERS,
  PURCHASE_SOURCE_SCOPES,
} from './purchaseSource.model.js'

import {
  PURCHASE_ITEM_MATCH_STATUSES,
  PURCHASE_TRANSACTION_SOURCE_TYPES,
  PURCHASE_TRANSACTION_STATUSES,
} from './purchaseTransaction.model.js'

const objectIdSchema =
  z.string()
    .trim()
    .regex(
      /^[a-f\d]{24}$/i,
      'A valid ObjectId is required.',
    )

export const purchaseSourceIdParamsSchema =
  z.object({
    sourceId:
      z.string()
        .trim()
        .min(
          10,
          'Purchase source id is required.',
        )
        .max(
          100,
          'Purchase source id is invalid.',
        )
        .regex(
          /^psrc_[A-Za-z0-9-]+$/,
          'Purchase source id is invalid.',
        ),
  })
    .strict()

export const purchaseTransactionIdParamsSchema =
  z.object({
    transactionId:
      z.string()
        .trim()
        .min(
          10,
          'Purchase transaction id is required.',
        )
        .max(
          100,
          'Purchase transaction id is invalid.',
        )
        .regex(
          /^ptxn_[A-Za-z0-9-]+$/,
          'Purchase transaction id is invalid.',
        ),
  })
    .strict()

/*
|--------------------------------------------------------------------------
| Customer Connection Intent
|--------------------------------------------------------------------------
|
| consentAccepted must be explicitly true. The backend never infers consent
| from a button click or provider callback alone.
|
*/

export const createPurchaseSourceBodySchema =
  z.object({
    provider:
      z.enum(
        PURCHASE_SOURCE_PROVIDERS,
      ),

    householdId:
      objectIdSchema,

    displayLabel:
      z.string()
        .trim()
        .max(
          160,
          'Display label cannot exceed 160 characters.',
        )
        .optional()
        .default(''),

    consentAccepted:
      z.literal(
        true,
        {
          errorMap:
            () => ({
              message:
                'Explicit purchase-history consent is required.',
            }),
        },
      ),

    consentScopes:
      z.array(
        z.enum(
          PURCHASE_SOURCE_SCOPES,
        ),
      )
        .min(
          1,
          'At least one purchase-history scope is required.',
        )
        .max(
          PURCHASE_SOURCE_SCOPES.length,
          'Too many purchase-history scopes were supplied.',
        )
        .transform(
          (items) =>
            [
              ...new Set(
                items,
              ),
            ],
        ),
  })
    .strict()

export const purchaseSourceActionBodySchema =
  z.object({
    action:
      z.enum([
        'pause',
        'resume',
        'revoke',
        'pause_learning',
        'resume_learning',
      ]),
  })
    .strict()

export const purchaseTransactionListQuerySchema =
  z.object({
    sourceId:
      z.string()
        .trim()
        .regex(
          /^psrc_[A-Za-z0-9-]+$/,
          'Purchase source id is invalid.',
        )
        .optional(),

    limit:
      z.coerce
        .number()
        .int()
        .min(1)
        .max(100)
        .default(40),
  })
    .strict()

const transactionItemCorrectionSchema =
  z.object({
    lineKey:
      z.string()
        .trim()
        .regex(
          /^[a-f\d]{64}$/i,
          'A valid purchase line key is required.',
        ),

    excludedFromLearning:
      z.boolean()
        .optional(),

    correctedLabel:
      z.string()
        .trim()
        .max(
          240,
          'Corrected label cannot exceed 240 characters.',
        )
        .optional(),

    canonicalPackId:
      objectIdSchema
        .nullable()
        .optional(),

    canonicalIngredientId:
      objectIdSchema
        .nullable()
        .optional(),

    quantity:
      z.number()
        .min(0)
        .nullable()
        .optional(),

    note:
      z.string()
        .trim()
        .max(
          500,
          'Item correction note cannot exceed 500 characters.',
        )
        .optional(),
  })
    .strict()
    .refine(
      (value) =>
        Object.keys(
          value,
        ).some(
          (key) =>
            key !==
            'lineKey',
        ),
      {
        message:
          'At least one item correction is required.',
      },
    )

export const correctPurchaseTransactionBodySchema =
  z.object({
    excludedFromLearning:
      z.boolean()
        .optional(),

    correctionNote:
      z.string()
        .trim()
        .max(
          800,
          'Correction note cannot exceed 800 characters.',
        )
        .optional(),

    itemCorrections:
      z.array(
        transactionItemCorrectionSchema,
      )
        .max(
          100,
          'Too many purchase item corrections were supplied.',
        )
        .optional(),
  })
    .strict()
    .refine(
      (value) =>
        Object.keys(
          value,
        ).length >
        0,
      {
        message:
          'At least one transaction correction is required.',
      },
    )

/*
|--------------------------------------------------------------------------
| Trusted Adapter Normalized Input
|--------------------------------------------------------------------------
|
| Provider adapters must normalize raw Gmail / Outlook / retailer / receipt
| payloads into this contract before the core purchase domain accepts them.
|
| No email body or OAuth credential field exists in this schema by design.
|
*/

const normalizedPurchaseItemSchema =
  z.object({
    externalLineReference:
      z.string()
        .trim()
        .min(1)
        .max(500)
        .optional(),

    sourceLabel:
      z.string()
        .trim()
        .min(
          1,
          'Purchase item label is required.',
        )
        .max(240),

    brand:
      z.string()
        .trim()
        .max(160)
        .optional()
        .default(''),

    packText:
      z.string()
        .trim()
        .max(120)
        .optional()
        .default(''),

    quantityOrdered:
      z.number()
        .min(0)
        .default(1),

    quantityFulfilled:
      z.number()
        .min(0)
        .nullable()
        .optional()
        .default(null),

    unitPriceMinor:
      z.number()
        .int()
        .min(0)
        .nullable()
        .optional()
        .default(null),

    discountMinor:
      z.number()
        .int()
        .min(0)
        .optional()
        .default(0),

    canonicalPackId:
      objectIdSchema
        .nullable()
        .optional()
        .default(null),

    canonicalIngredientId:
      objectIdSchema
        .nullable()
        .optional()
        .default(null),

    matchStatus:
      z.enum(
        PURCHASE_ITEM_MATCH_STATUSES,
      )
        .optional()
        .default('unmatched'),

    matchConfidence:
      z.number()
        .min(0)
        .max(1)
        .nullable()
        .optional()
        .default(null),
  })
    .strict()

export const normalizedPurchaseTransactionSchema =
  z.object({
    externalReference:
      z.string()
        .trim()
        .min(
          1,
          'External transaction reference is required.',
        )
        .max(500),

    sourceType:
      z.enum(
        PURCHASE_TRANSACTION_SOURCE_TYPES,
      ),

    merchantName:
      z.string()
        .trim()
        .max(180)
        .optional()
        .default(''),

    purchasedAt:
      z.coerce
        .date(),

    expectedDeliveryAt:
      z.coerce
        .date()
        .nullable()
        .optional()
        .default(null),

    deliveredAt:
      z.coerce
        .date()
        .nullable()
        .optional()
        .default(null),

    currency:
      z.string()
        .trim()
        .toUpperCase()
        .regex(
          /^[A-Z]{3}$/,
          'Currency must use a three-letter ISO code.',
        )
        .optional()
        .default('INR'),

    totalMinor:
      z.number()
        .int()
        .min(0)
        .nullable()
        .optional()
        .default(null),

    status:
      z.enum(
        PURCHASE_TRANSACTION_STATUSES,
      )
        .optional()
        .default('ordered'),

    items:
      z.array(
        normalizedPurchaseItemSchema,
      )
        .max(
          250,
          'A normalized purchase transaction cannot exceed 250 line items.',
        )
        .default([]),
  })
    .strict()

export const normalizedPurchaseBatchSchema =
  z.object({
    transactions:
      z.array(
        normalizedPurchaseTransactionSchema,
      )
        .max(
          500,
          'A single purchase ingestion batch cannot exceed 500 transactions.',
        ),

    syncSummary:
      z.string()
        .trim()
        .max(500)
        .optional()
        .default(''),
  })
    .strict()
