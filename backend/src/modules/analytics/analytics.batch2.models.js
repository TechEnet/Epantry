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

export const EXPERIMENT_STATUSES = Object.freeze([
  'draft',
  'active',
  'paused',
  'ended',
])

export const EXPERIMENT_SURFACE_TYPES = Object.freeze([
  'presentation',
  'workflow_effort',
  'notification_utility',
  'recommendation_utility',
])

export const EXPERIMENT_ELIGIBLE_ACTOR_TYPES = Object.freeze([
  'customer',
  'host',
])

const experimentVariantSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 80,
    },

    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },

    weightBasisPoints: {
      type: Number,
      required: true,
      min: 1,
      max: 10000,

      validate: {
        validator(value) {
          return Number.isInteger(value)
        },

        message:
          'Experiment variant weight must use integer basis points.',
      },
    },

    isControl: {
      type: Boolean,
      default: false,
    },
  },
  {
    _id: false,
  },
)

const experimentDefinitionSchema = new Schema(
  {
    experimentKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
      index: true,
      immutable: true,
    },

    versionNumber: {
      type: Number,
      required: true,
      min: 1,
      immutable: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 220,
      immutable: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1200,
      immutable: true,
    },

    surfaceType: {
      type: String,
      enum: EXPERIMENT_SURFACE_TYPES,
      required: true,
      immutable: true,
    },

    surfaceKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 160,
      immutable: true,
    },

    featureFlagKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 160,
      immutable: true,
    },

    eligibleActorTypes: {
      type: [String],
      enum: EXPERIMENT_ELIGIBLE_ACTOR_TYPES,
      required: true,
      default: ['customer'],
      immutable: true,
    },

    allocationBasisPoints: {
      type: Number,
      required: true,
      min: 1,
      max: 10000,
      default: 10000,
      immutable: true,

      validate: {
        validator(value) {
          return Number.isInteger(value)
        },

        message:
          'Experiment allocation must use integer basis points.',
      },
    },

    variants: {
      type: [experimentVariantSchema],
      required: true,
      immutable: true,
    },

    primaryUtilityMetricKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
      immutable: true,
    },

    guardrailMetricKeys: {
      type: [String],
      default: [],
      immutable: true,
    },

    holdoutRequired: {
      type: Boolean,
      required: true,
      default: true,
      immutable: true,
    },

    status: {
      type: String,
      enum: EXPERIMENT_STATUSES,
      required: true,
      default: 'draft',
      index: true,
    },

    createdByUserId: {
      type: objectId,
      ref: 'User',
      required: true,
      immutable: true,
    },

    activatedAt: {
      type: Date,
      default: null,
    },

    activatedByUserId: {
      type: objectId,
      ref: 'User',
      default: null,
    },

    pausedAt: {
      type: Date,
      default: null,
    },

    pausedByUserId: {
      type: objectId,
      ref: 'User',
      default: null,
    },

    endedAt: {
      type: Date,
      default: null,
    },

    endedByUserId: {
      type: objectId,
      ref: 'User',
      default: null,
    },

    lifecycleReason: {
      type: String,
      trim: true,
      maxlength: 1500,
      default: '',
    },
  },
  {
    ...baseOptions,
    collection: 'experimentDefinitions',
  },
)

experimentDefinitionSchema.index(
  {
    experimentKey: 1,
    versionNumber: 1,
  },
  {
    unique: true,
  },
)

experimentDefinitionSchema.pre(
  'validate',
  function validateExperimentDefinition() {
    const variants =
      this.variants || []

    if (
      variants.length < 2
    ) {
      this.invalidate(
        'variants',
        'Experiment requires at least two variants.',
      )

      return
    }

    const keys =
      new Set(
        variants.map(
          (variant) =>
            variant.key,
        ),
      )

    if (
      keys.size !==
      variants.length
    ) {
      this.invalidate(
        'variants',
        'Experiment variant keys must be unique.',
      )
    }

    const totalWeight =
      variants.reduce(
        (
          total,
          variant,
        ) =>
          total +
          Number(
            variant.weightBasisPoints || 0,
          ),
        0,
      )

    if (
      totalWeight !==
      10000
    ) {
      this.invalidate(
        'variants',
        'Experiment variant weights must total exactly 10000 basis points.',
      )
    }

    const controlCount =
      variants.filter(
        (variant) =>
          variant.isControl ===
          true,
      ).length

    if (
      this.holdoutRequired ===
        true &&
      controlCount !==
        1
    ) {
      this.invalidate(
        'variants',
        'Holdout experiment requires exactly one control variant.',
      )
    }
  },
)

const experimentAssignmentSchema = new Schema(
  {
    assignmentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true,
      default: () => `expas_${crypto.randomUUID()}`,
    },

    experimentDefinitionId: {
      type: objectId,
      ref: 'ExperimentDefinition',
      required: true,
      index: true,
      immutable: true,
    },

    experimentKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
      index: true,
      immutable: true,
    },

    experimentVersion: {
      type: Number,
      required: true,
      min: 1,
      immutable: true,
    },

    actorType: {
      type: String,
      enum: EXPERIMENT_ELIGIBLE_ACTOR_TYPES,
      required: true,
      immutable: true,
    },

    actorPseudonym: {
      type: String,
      required: true,
      trim: true,
      minlength: 64,
      maxlength: 64,
      index: true,
      immutable: true,
    },

    organizationPseudonym: {
      type: String,
      trim: true,
      minlength: 64,
      maxlength: 64,
      default: '',
      index: true,
      immutable: true,
    },

    bucket: {
      type: Number,
      required: true,
      min: 0,
      max: 9999,
      immutable: true,
    },

    variantKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 80,
      immutable: true,
    },

    featureFlagKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 160,
      immutable: true,
    },

    featureFlagEnabledAtAssignment: {
      type: Boolean,
      required: true,
      immutable: true,
    },

    assignedAt: {
      type: Date,
      required: true,
      default: Date.now,
      immutable: true,
    },

    exposedAt: {
      type: Date,
      default: null,
    },

    lastExposedAt: {
      type: Date,
      default: null,
    },

    exposureCount: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  {
    ...baseOptions,
    collection: 'experimentAssignments',
  },
)

experimentAssignmentSchema.index(
  {
    experimentKey: 1,
    experimentVersion: 1,
    actorPseudonym: 1,
  },
  {
    unique: true,
  },
)

export const ExperimentDefinition =
  mongoose.models.ExperimentDefinition ||
  mongoose.model(
    'ExperimentDefinition',
    experimentDefinitionSchema,
  )

export const ExperimentAssignment =
  mongoose.models.ExperimentAssignment ||
  mongoose.model(
    'ExperimentAssignment',
    experimentAssignmentSchema,
  )