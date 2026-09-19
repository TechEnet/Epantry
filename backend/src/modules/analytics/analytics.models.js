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

export const ANALYTICS_ACTOR_TYPES = Object.freeze([
  'customer',
  'host',
  'super_admin',
  'system',
  'anonymous',
])

export const ANALYTICS_DECISION_CONTEXTS = Object.freeze([
  'organic',
  'sponsored',
  'mixed',
  'not_applicable',
])

export const ANALYTICS_CONFIDENCE_TIERS = Object.freeze([
  'verified',
  'high',
  'medium',
  'low',
  'unknown',
  'not_applicable',
])

export const ATTRIBUTION_LEVELS = Object.freeze([
  'view_assisted',
  'selection_assisted',
  'basket_assisted',
  'transaction_attributed',
])

export const METRIC_PERIODS = Object.freeze([
  'hour',
  'day',
  'week',
  'month',
])

const entityReferenceSchema = new Schema(
  {
    entityType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },

    entityId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },

    version: {
      type: String,
      trim: true,
      maxlength: 80,
      default: '',
    },
  },
  {
    _id: false,
  },
)

const featureFlagContextSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    value: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
  },
  {
    _id: false,
  },
)

const experimentContextSchema = new Schema(
  {
    experimentKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    variantKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
  },
  {
    _id: false,
  },
)

const analyticsEventSchema = new Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true,
      default: () => `evt_${crypto.randomUUID()}`,
    },

    clientEventId: {
      type: String,
      trim: true,
      maxlength: 160,
      default: null,
      immutable: true,
    },

    eventName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
      index: true,
      immutable: true,
    },

    eventVersion: {
      type: Number,
      required: true,
      min: 1,
      index: true,
      immutable: true,
    },

    occurredAt: {
      type: Date,
      required: true,
      index: true,
      immutable: true,
    },

    receivedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
      immutable: true,
    },

    correlationId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
      index: true,
      immutable: true,
    },

    sessionId: {
      type: String,
      trim: true,
      maxlength: 180,
      default: '',
      immutable: true,
    },

    actorType: {
      type: String,
      enum: ANALYTICS_ACTOR_TYPES,
      required: true,
      index: true,
      immutable: true,
    },

    actorPseudonym: {
      type: String,
      trim: true,
      minlength: 64,
      maxlength: 64,
      default: '',
      index: true,
      immutable: true,
    },

    householdPseudonym: {
      type: String,
      trim: true,
      minlength: 64,
      maxlength: 64,
      default: '',
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

    entities: {
      type: [entityReferenceSchema],
      default: [],
      immutable: true,
    },

    sourceDomain: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      index: true,
      immutable: true,
    },

    sourceVersion: {
      type: String,
      trim: true,
      maxlength: 80,
      default: '',
      immutable: true,
    },

    decisionContext: {
      type: String,
      enum: ANALYTICS_DECISION_CONTEXTS,
      default: 'not_applicable',
      index: true,
      immutable: true,
    },

    confidenceTier: {
      type: String,
      enum: ANALYTICS_CONFIDENCE_TIERS,
      default: 'not_applicable',
      index: true,
      immutable: true,
    },

    featureFlags: {
      type: [featureFlagContextSchema],
      default: [],
      immutable: true,
    },

    experiments: {
      type: [experimentContextSchema],
      default: [],
      immutable: true,
    },

    payload: {
      type: Schema.Types.Mixed,
      default: {},
      immutable: true,
    },
  },
  {
    ...baseOptions,
    collection: 'analyticsEvents',
  },
)

analyticsEventSchema.index(
  {
    clientEventId: 1,
  },
  {
    unique: true,
    sparse: true,
  },
)

analyticsEventSchema.index({
  eventName: 1,
  occurredAt: -1,
})

analyticsEventSchema.index({
  organizationPseudonym: 1,
  eventName: 1,
  occurredAt: -1,
})

const attributionEventSchema = new Schema(
  {
    attributionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true,
      default: () => `attr_${crypto.randomUUID()}`,
    },

    eventVersion: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
      immutable: true,
    },

    occurredAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
      immutable: true,
    },

    correlationId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
      index: true,
      immutable: true,
    },

    organizationId: {
      type: objectId,
      ref: 'MarketplaceOrganization',
      required: true,
      index: true,
      immutable: true,
    },

    organizationPseudonym: {
      type: String,
      required: true,
      trim: true,
      minlength: 64,
      maxlength: 64,
      index: true,
      immutable: true,
    },

    actorPseudonym: {
      type: String,
      trim: true,
      minlength: 64,
      maxlength: 64,
      default: '',
      immutable: true,
    },

    level: {
      type: String,
      enum: ATTRIBUTION_LEVELS,
      required: true,
      index: true,
      immutable: true,
    },

    sourceEntity: {
      type: entityReferenceSchema,
      required: true,
      immutable: true,
    },

    targetEntity: {
      type: entityReferenceSchema,
      required: true,
      immutable: true,
    },

    orderId: {
      type: objectId,
      ref: 'ParentOrder',
      default: null,
      index: true,
      immutable: true,
    },

    revenueMinor: {
      type: Number,
      min: 0,
      default: null,
      immutable: true,

      validate: {
        validator(value) {
          return (
            value === null ||
            Number.isInteger(value)
          )
        },

        message:
          'Attributed revenue must use integer minor units.',
      },
    },

    currency: {
      type: String,
      trim: true,
      uppercase: true,
      minlength: 3,
      maxlength: 3,
      default: null,
      immutable: true,
    },

    evidenceReferences: {
      type: [String],
      default: [],
      immutable: true,
    },
  },
  {
    ...baseOptions,
    collection: 'attributionEvents',
  },
)

attributionEventSchema.pre(
  'validate',
  function validateAttributionRevenue() {
    const hasRevenue =
      this.revenueMinor !==
      null

    if (
      hasRevenue &&
      this.level !==
        'transaction_attributed'
    ) {
      this.invalidate(
        'revenueMinor',
        'Revenue may only be attached to transaction-attributed evidence.',
      )
    }

    if (
      hasRevenue &&
      !this.currency
    ) {
      this.invalidate(
        'currency',
        'Currency is required when attributed revenue is recorded.',
      )
    }
  },
)

const metricAggregateSchema = new Schema(
  {
    metricKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
      index: true,
    },

    metricVersion: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },

    period: {
      type: String,
      enum: METRIC_PERIODS,
      required: true,
      index: true,
    },

    periodStart: {
      type: Date,
      required: true,
      index: true,
    },

    organizationId: {
      type: objectId,
      ref: 'MarketplaceOrganization',
      default: null,
      index: true,
    },

    organizationPseudonym: {
      type: String,
      trim: true,
      minlength: 64,
      maxlength: 64,
      default: '',
      index: true,
    },

    dimensions: {
      type: Schema.Types.Mixed,
      default: {},
    },

    value: {
      type: Number,
      required: true,
      default: 0,
    },

    numerator: {
      type: Number,
      default: null,
    },

    denominator: {
      type: Number,
      default: null,
    },

    sourceEventVersion: {
      type: Number,
      min: 1,
      default: 1,
    },

    computedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    ...baseOptions,
    collection: 'metricAggregates',
  },
)

metricAggregateSchema.index(
  {
    metricKey: 1,
    metricVersion: 1,
    period: 1,
    periodStart: 1,
    organizationId: 1,
    organizationPseudonym: 1,
  },
  {
    unique: true,
  },
)

export const AnalyticsEvent =
  mongoose.models.AnalyticsEvent ||
  mongoose.model(
    'AnalyticsEvent',
    analyticsEventSchema,
  )

export const AttributionEvent =
  mongoose.models.AttributionEvent ||
  mongoose.model(
    'AttributionEvent',
    attributionEventSchema,
  )

export const MetricAggregate =
  mongoose.models.MetricAggregate ||
  mongoose.model(
    'MetricAggregate',
    metricAggregateSchema,
  )