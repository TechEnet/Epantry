import crypto from 'crypto'

import mongoose from 'mongoose'

const {
  Schema,
} = mongoose

const objectId =
  Schema.Types.ObjectId

const baseOptions = Object.freeze({
  timestamps: true,
  strict: true,
  minimize: false,
  versionKey: false,
})

export const DISH_PASSPORT_STATUSES = Object.freeze([
  'draft',
  'approved',
  'published',
  'retired',
])

export const DISH_PASSPORT_VISIBILITIES = Object.freeze([
  'internal',
  'public',
])

export const DISH_PASSPORT_VERIFICATION_STATES = Object.freeze([
  'verified',
  'requires_verification',
])

export const HOSPITALITY_CHANGE_SOURCE_TYPES = Object.freeze([
  'product_version',
  'canonical_ingredient',
  'recipe_version',
  'production_recipe_version',
  'supplier_product',
])

export const HOSPITALITY_CHANGE_DOMAINS = Object.freeze([
  'formulation',
  'ingredient',
  'nutrition',
  'allergen',
  'dietary',
  'commercial',
  'recipe',
])

export const HOSPITALITY_CHANGE_SEVERITIES = Object.freeze([
  'informational',
  'commercial',
  'dietary',
  'allergen_critical',
  'regulatory_review',
])

export const HOSPITALITY_CHANGE_CASE_STATUSES = Object.freeze([
  'detected',
  'recalculated',
  'approved',
  'published',
  'dismissed',
  'blocked',
])

const evidenceSchema = new Schema(
  {
    type: {
      type: String,
      enum: [
        'source',
        'document',
        'ticket',
        'audit_event',
        'external_reference',
        'other',
      ],
      required: true,
    },

    label: {
      type: String,
      trim: true,
      maxlength: 240,
      required: true,
    },

    referenceId: {
      type: String,
      trim: true,
      maxlength: 300,
      default: '',
    },

    uri: {
      type: String,
      trim: true,
      maxlength: 1500,
      default: '',
    },

    note: {
      type: String,
      trim: true,
      maxlength: 1500,
      default: '',
    },
  },
  {
    _id: false,
  },
)

const dishPassportSnapshotSchema = new Schema(
  {
    passportKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 80,
      index: true,
      immutable: true,
    },

    versionNumber: {
      type: Number,
      required: true,
      min: 1,
      immutable: true,
    },

    organizationId: {
      type: objectId,
      ref: 'MarketplaceOrganization',
      required: true,
      index: true,
      immutable: true,
    },

    outletId: {
      type: objectId,
      ref: 'HospitalityOutlet',
      required: true,
      index: true,
      immutable: true,
    },

    productionRecipeVersionId: {
      type: objectId,
      ref: 'HospitalityProductionRecipeVersion',
      required: true,
      index: true,
      immutable: true,
    },

    dishId: {
      type: objectId,
      ref: 'Dish',
      required: true,
      index: true,
      immutable: true,
    },

    sourceRecipeVersionId: {
      type: objectId,
      ref: 'RecipeVersion',
      required: true,
      index: true,
      immutable: true,
    },

    foodCalculationId: {
      type: objectId,
      ref: 'FoodCalculation',
      required: true,
      index: true,
      immutable: true,
    },

    changeCaseId: {
      type: objectId,
      ref: 'HospitalityChangeCase',
      default: null,
      index: true,
      immutable: true,
    },

    status: {
      type: String,
      enum: DISH_PASSPORT_STATUSES,
      required: true,
      default: 'draft',
      index: true,
    },

    visibility: {
      type: String,
      enum: DISH_PASSPORT_VISIBILITIES,
      required: true,
      default: 'internal',
      index: true,
    },

    verificationState: {
      type: String,
      enum: DISH_PASSPORT_VERIFICATION_STATES,
      required: true,
      index: true,
      immutable: true,
    },

    sourceFingerprint: {
      type: String,
      required: true,
      trim: true,
      minlength: 64,
      maxlength: 64,
      index: true,
      immutable: true,
    },

    snapshot: {
      type: Schema.Types.Mixed,
      required: true,
      immutable: true,
    },

    effectiveFrom: {
      type: Date,
      default: null,
      index: true,
    },

    effectiveTo: {
      type: Date,
      default: null,
      index: true,
    },

    supersedesSnapshotId: {
      type: objectId,
      ref: 'DishPassportSnapshot',
      default: null,
      immutable: true,
    },

    generatedAt: {
      type: Date,
      required: true,
      default: Date.now,
      immutable: true,
    },

    generatedByUserId: {
      type: objectId,
      ref: 'User',
      required: true,
      immutable: true,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    approvedByUserId: {
      type: objectId,
      ref: 'User',
      default: null,
    },

    publishedAt: {
      type: Date,
      default: null,
    },

    publishedByUserId: {
      type: objectId,
      ref: 'User',
      default: null,
    },

    retiredAt: {
      type: Date,
      default: null,
    },

    governanceEvents: {
      type: [
        new Schema(
          {
            eventType: {
              type: String,
              enum: [
                'approved',
                'published',
                'retired',
              ],
              required: true,
            },

            actorUserId: {
              type: objectId,
              ref: 'User',
              required: true,
            },

            reason: {
              type: String,
              trim: true,
              maxlength: 4000,
              required: true,
            },

            evidence: {
              type: [evidenceSchema],
              default: [],
            },

            occurredAt: {
              type: Date,
              required: true,
              default: Date.now,
            },
          },
          {
            _id: false,
          },
        ),
      ],
      default: [],
    },
  },
  {
    ...baseOptions,
    collection: 'dishPassportSnapshots',
  },
)

dishPassportSnapshotSchema.index(
  {
    organizationId: 1,
    outletId: 1,
    passportKey: 1,
    versionNumber: 1,
  },
  {
    unique: true,
  },
)

dishPassportSnapshotSchema.index({
  passportKey: 1,
  status: 1,
  effectiveFrom: -1,
})

const protectedPassportFields = [
  'passportKey',
  'versionNumber',
  'organizationId',
  'outletId',
  'productionRecipeVersionId',
  'dishId',
  'sourceRecipeVersionId',
  'foodCalculationId',
  'changeCaseId',
  'verificationState',
  'sourceFingerprint',
  'snapshot',
  'supersedesSnapshotId',
  'generatedAt',
  'generatedByUserId',
]

dishPassportSnapshotSchema.pre(
  'save',
  function preventPassportSnapshotContentMutation(next) {
    if (
      !this.isNew &&
      protectedPassportFields.some(
        (field) => this.isModified(field),
      )
    ) {
      return next(
        new Error(
          'Dish Passport snapshot content is immutable. Generate a new version instead.',
        ),
      )
    }

    return next()
  },
)

const greyBookSnapshotSchema = new Schema(
  {
    greyBookKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 80,
      index: true,
      immutable: true,
    },

    versionNumber: {
      type: Number,
      required: true,
      min: 1,
      immutable: true,
    },

    organizationId: {
      type: objectId,
      ref: 'MarketplaceOrganization',
      required: true,
      index: true,
      immutable: true,
    },

    outletId: {
      type: objectId,
      ref: 'HospitalityOutlet',
      required: true,
      index: true,
      immutable: true,
    },

    changeCaseId: {
      type: objectId,
      ref: 'HospitalityChangeCase',
      default: null,
      index: true,
      immutable: true,
    },

    effectiveAt: {
      type: Date,
      required: true,
      index: true,
      immutable: true,
    },

    passportSnapshotIds: {
      type: [
        {
          type: objectId,
          ref: 'DishPassportSnapshot',
        },
      ],
      required: true,
      default: [],
      immutable: true,
    },

    sourceFingerprint: {
      type: String,
      required: true,
      trim: true,
      minlength: 64,
      maxlength: 64,
      index: true,
      immutable: true,
    },

    snapshot: {
      type: Schema.Types.Mixed,
      required: true,
      immutable: true,
    },

    generatedAt: {
      type: Date,
      required: true,
      default: Date.now,
      immutable: true,
    },

    generatedByUserId: {
      type: objectId,
      ref: 'User',
      required: true,
      immutable: true,
    },
  },
  {
    ...baseOptions,
    collection: 'greyBookSnapshots',
  },
)

greyBookSnapshotSchema.index(
  {
    organizationId: 1,
    outletId: 1,
    versionNumber: 1,
  },
  {
    unique: true,
  },
)

greyBookSnapshotSchema.pre(
  'save',
  function preventGreyBookMutation(next) {
    if (
      !this.isNew &&
      this.isModified()
    ) {
      return next(
        new Error(
          'Grey Book history is immutable. Generate a new snapshot instead.',
        ),
      )
    }

    return next()
  },
)

const hospitalityChangeCaseSchema = new Schema(
  {
    caseKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true,
      default: () => `HC-${crypto.randomUUID()}`,
    },

    organizationId: {
      type: objectId,
      ref: 'MarketplaceOrganization',
      required: true,
      index: true,
      immutable: true,
    },

    source: {
      type: {
        type: String,
        enum: HOSPITALITY_CHANGE_SOURCE_TYPES,
        required: true,
      },

      id: {
        type: String,
        trim: true,
        maxlength: 200,
        required: true,
      },

      version: {
        type: String,
        trim: true,
        maxlength: 160,
        default: '',
      },
    },

    changedDomains: {
      type: [
        {
          type: String,
          enum: HOSPITALITY_CHANGE_DOMAINS,
        },
      ],
      required: true,
      default: [],
    },

    severity: {
      type: String,
      enum: HOSPITALITY_CHANGE_SEVERITIES,
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: HOSPITALITY_CHANGE_CASE_STATUSES,
      required: true,
      default: 'detected',
      index: true,
    },

    reason: {
      type: String,
      trim: true,
      maxlength: 4000,
      required: true,
    },

    evidence: {
      type: [evidenceSchema],
      default: [],
    },

    impactedProductionRecipeVersionIds: {
      type: [
        {
          type: objectId,
          ref: 'HospitalityProductionRecipeVersion',
        },
      ],
      default: [],
    },

    impactedMenuIds: {
      type: [
        {
          type: objectId,
          ref: 'HospitalityMenu',
        },
      ],
      default: [],
    },

    impactedOutletIds: {
      type: [
        {
          type: objectId,
          ref: 'HospitalityOutlet',
        },
      ],
      default: [],
    },

    baselinePassportSnapshotIds: {
      type: [
        {
          type: objectId,
          ref: 'DishPassportSnapshot',
        },
      ],
      default: [],
    },

    candidatePassportSnapshotIds: {
      type: [
        {
          type: objectId,
          ref: 'DishPassportSnapshot',
        },
      ],
      default: [],
    },

    baselineGreyBookSnapshotIds: {
      type: [
        {
          type: objectId,
          ref: 'HospitalityGreyBookSnapshot',
        },
      ],
      default: [],
    },

    generatedGreyBookSnapshotIds: {
      type: [
        {
          type: objectId,
          ref: 'HospitalityGreyBookSnapshot',
        },
      ],
      default: [],
    },

    recalculationNotes: {
      type: [Schema.Types.Mixed],
      default: [],
    },

    createdByUserId: {
      type: objectId,
      ref: 'User',
      required: true,
    },

    recalculatedByUserId: {
      type: objectId,
      ref: 'User',
      default: null,
    },

    recalculatedAt: {
      type: Date,
      default: null,
    },

    approvedByUserId: {
      type: objectId,
      ref: 'User',
      default: null,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    publishedByUserId: {
      type: objectId,
      ref: 'User',
      default: null,
    },

    publishedAt: {
      type: Date,
      default: null,
    },
  },
  {
    ...baseOptions,
    collection: 'hospitalityChangeCases',
  },
)

hospitalityChangeCaseSchema.index({
  organizationId: 1,
  status: 1,
  severity: 1,
  createdAt: -1,
})

export const DishPassportSnapshot =
  mongoose.models.DishPassportSnapshot ||
  mongoose.model(
    'DishPassportSnapshot',
    dishPassportSnapshotSchema,
  )

export const HospitalityGreyBookSnapshot =
  mongoose.models.HospitalityGreyBookSnapshot ||
  mongoose.model(
    'HospitalityGreyBookSnapshot',
    greyBookSnapshotSchema,
  )

export const HospitalityChangeCase =
  mongoose.models.HospitalityChangeCase ||
  mongoose.model(
    'HospitalityChangeCase',
    hospitalityChangeCaseSchema,
  )