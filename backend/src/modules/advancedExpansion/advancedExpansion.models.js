import crypto from 'crypto'

import mongoose from 'mongoose'

const {
  Schema,
} = mongoose

const objectId =
  Schema.Types.ObjectId

const baseOptions =
  Object.freeze({
    timestamps:
      true,

    strict:
      true,

    minimize:
      false,

    versionKey:
      false,
  })

export const RECEIPT_IMPORT_SOURCE_KINDS =
  Object.freeze([
    'receipt',
    'receipt_photo',
    'purchase_history',
  ])

export const RECEIPT_IMPORT_STATUSES =
  Object.freeze([
    'needs_review',
    'partially_applied',
    'applied',
    'cancelled',
  ])

export const RECEIPT_LINE_MATCH_STATES =
  Object.freeze([
    'exact_canonical',
    'user_confirmed',
    'unresolved',
    'excluded',
  ])

export const RECEIPT_LINE_MATCH_METHODS =
  Object.freeze([
    'barcode_identity',
    'customer_selection',
    'none',
  ])

export const MEMORY_FACT_TYPES =
  Object.freeze([
    'purchase_pattern',
    'depletion_signal',
    'leftover',
    'meal_repeat',
  ])

export const MEMORY_FACT_STATUSES =
  Object.freeze([
    'active',
    'paused',
    'forgotten',
  ])

export const MEMORY_FACT_SOURCES =
  Object.freeze([
    'receipt_import',
    'pantry_history',
    'customer_leftover',
    'recipe_history',
  ])

export const MEMORY_CONFIDENCE_CLASSES =
  Object.freeze([
    'high',
    'medium',
    'low',
  ])

const receiptQuantitySchema =
  new Schema(
    {
      mode: {
        type:
          String,

        enum: [
          'exact',
          'unknown',
        ],

        required:
          true,

        default:
          'unknown',
      },

      value: {
        type:
          Number,

        min:
          0,

        default:
          null,
      },

      unit: {
        type:
          String,

        trim:
          true,

        maxlength:
          40,

        default:
          null,
      },
    },
    {
      _id:
        false,

      strict:
        true,
    },
  )

const receiptLineSchema =
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
          120,
      },

      label: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          240,
      },

      barcode: {
        type:
          String,

        trim:
          true,

        maxlength:
          180,

        default:
          '',
      },

      quantity: {
        type:
          receiptQuantitySchema,

        required:
          true,

        default:
          () => ({
            mode:
              'unknown',
          }),
      },

      canonicalPackId: {
        type:
          objectId,

        ref:
          'Pack',

        default:
          null,
      },

      canonicalProductVersionId: {
        type:
          objectId,

        ref:
          'ProductVersion',

        default:
          null,
      },

      matchState: {
        type:
          String,

        enum:
          RECEIPT_LINE_MATCH_STATES,

        required:
          true,

        default:
          'unresolved',
      },

      matchMethod: {
        type:
          String,

        enum:
          RECEIPT_LINE_MATCH_METHODS,

        required:
          true,

        default:
          'none',
      },

      confidenceClass: {
        type:
          String,

        enum:
          MEMORY_CONFIDENCE_CLASSES,

        required:
          true,

        default:
          'low',
      },

      pantryApplied: {
        type:
          Boolean,

        required:
          true,

        default:
          false,
      },

      pantryObservationId: {
        type:
          objectId,

        ref:
          'PantryObservation',

        default:
          null,
      },

      appliedAt: {
        type:
          Date,

        default:
          null,
      },
    },
    {
      _id:
        false,

      strict:
        true,
    },
  )

const receiptImportSchema =
  new Schema(
    {
      receiptImportId: {
        type:
          String,

        required:
          true,

        unique:
          true,

        index:
          true,

        immutable:
          true,

        default:
          () =>
            `rcpt_${crypto.randomUUID()}`,
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

        immutable:
          true,
      },

      importedByUserId: {
        type:
          objectId,

        ref:
          'User',

        required:
          true,

        immutable:
          true,
      },

      sourceKind: {
        type:
          String,

        enum:
          RECEIPT_IMPORT_SOURCE_KINDS,

        required:
          true,

        immutable:
          true,
      },

      sourceArtifactRef: {
        type:
          String,

        trim:
          true,

        maxlength:
          500,

        default:
          '',

        immutable:
          true,
      },

      merchantLabel: {
        type:
          String,

        trim:
          true,

        maxlength:
          180,

        default:
          '',
      },

      market: {
        type:
          String,

        trim:
          true,

        uppercase:
          true,

        maxlength:
          10,

        required:
          true,

        default:
          'IN',
      },

      purchasedAt: {
        type:
          Date,

        required:
          true,

        index:
          true,
      },

      status: {
        type:
          String,

        enum:
          RECEIPT_IMPORT_STATUSES,

        required:
          true,

        default:
          'needs_review',

        index:
          true,
      },

      consentSnapshot: {
        explicitImportAcknowledged: {
          type:
            Boolean,

          required:
            true,

          immutable:
            true,
        },

        acknowledgedAt: {
          type:
            Date,

          required:
            true,

          immutable:
            true,
        },

        privacyPolicyVersion: {
          type:
            String,

          trim:
            true,

          maxlength:
            80,

          required:
            true,

          immutable:
            true,
        },

        personalizationGranted: {
          type:
            Boolean,

          required:
            true,

          immutable:
            true,
        },
      },

      lines: {
        type: [
          receiptLineSchema,
        ],

        required:
          true,

        validate: {
          validator:
            (
              value,
            ) =>
              Array.isArray(
                value,
              ) &&
              value.length >
                0 &&
              value.length <=
                100,

          message:
            'Receipt import requires between 1 and 100 lines.',
        },
      },

      cancelledAt: {
        type:
          Date,

        default:
          null,
      },
    },
    {
      ...baseOptions,

      collection:
        'receiptImports',
    },
  )

receiptImportSchema.index({
  householdId:
    1,

  createdAt:
    -1,
})

const memoryDetailsSchema =
  new Schema(
    {
      label: {
        type:
          String,

        trim:
          true,

        maxlength:
          240,

        default:
          '',
      },

      leftoverServings: {
        type:
          Number,

        min:
          0,

        max:
          100,

        default:
          null,
      },

      storageZone: {
        type:
          String,

        enum: [
          'fridge',
          'freezer',
          'other',
        ],

        default:
          null,
      },

      useSoonAt: {
        type:
          Date,

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
    },
    {
      _id:
        false,

      strict:
        true,
    },
  )

const householdMemoryFactSchema =
  new Schema(
    {
      memoryFactId: {
        type:
          String,

        required:
          true,

        unique:
          true,

        index:
          true,

        immutable:
          true,

        default:
          () =>
            `mem_${crypto.randomUUID()}`,
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

        immutable:
          true,
      },

      factKey: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          300,
      },

      factType: {
        type:
          String,

        enum:
          MEMORY_FACT_TYPES,

        required:
          true,

        index:
          true,
      },

      status: {
        type:
          String,

        enum:
          MEMORY_FACT_STATUSES,

        required:
          true,

        default:
          'active',

        index:
          true,
      },

      sourceType: {
        type:
          String,

        enum:
          MEMORY_FACT_SOURCES,

        required:
          true,
      },

      canonicalPackId: {
        type:
          objectId,

        ref:
          'Pack',

        default:
          null,

        index:
          true,
      },

      canonicalIngredientId: {
        type:
          objectId,

        ref:
          'CanonicalIngredient',

        default:
          null,

        index:
          true,
      },

      recipeVersionId: {
        type:
          objectId,

        ref:
          'RecipeVersion',

        default:
          null,

        index:
          true,
      },

      firstObservedAt: {
        type:
          Date,

        required:
          true,
      },

      lastObservedAt: {
        type:
          Date,

        required:
          true,

        index:
          true,
      },

      observedCount: {
        type:
          Number,

        min:
          1,

        required:
          true,

        default:
          1,
      },

      averageIntervalDays: {
        type:
          Number,

        min:
          0,

        max:
          3650,

        default:
          null,
      },

      nextExpectedAt: {
        type:
          Date,

        default:
          null,

        index:
          true,
      },

      confidenceClass: {
        type:
          String,

        enum:
          MEMORY_CONFIDENCE_CLASSES,

        required:
          true,

        default:
          'low',
      },

      details: {
        type:
          memoryDetailsSchema,

        required:
          true,

        default:
          () => ({}),
      },

      evidenceRefs: {
        type: [
          String,
        ],

        default:
          [],
      },

      createdByUserId: {
        type:
          objectId,

        ref:
          'User',

        required:
          true,
      },

      updatedByUserId: {
        type:
          objectId,

        ref:
          'User',

        required:
          true,
      },

      forgottenAt: {
        type:
          Date,

        default:
          null,
      },
    },
    {
      ...baseOptions,

      collection:
        'householdMemoryFacts',
    },
  )

householdMemoryFactSchema.index(
  {
    householdId:
      1,

    factKey:
      1,
  },
  {
    unique:
      true,

    name:
      'household_memory_fact_identity',
  },
)

householdMemoryFactSchema.index({
  householdId:
    1,

  status:
    1,

  nextExpectedAt:
    1,
})

export const ReceiptImport =
  mongoose.models.ReceiptImport ||
  mongoose.model(
    'ReceiptImport',
    receiptImportSchema,
  )

export const HouseholdMemoryFact =
  mongoose.models
    .HouseholdMemoryFact ||
  mongoose.model(
    'HouseholdMemoryFact',
    householdMemoryFactSchema,
  )