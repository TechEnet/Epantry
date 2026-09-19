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

export const SECURITY_EVENT_SEVERITIES = Object.freeze([
  'info',
  'warning',
  'critical',
])

export const PRIVACY_RIGHT_TYPES = Object.freeze([
  'access_export',
  'deletion',
])

export const PRIVACY_REQUEST_STATUSES = Object.freeze([
  'submitted',
  'in_review',
  'blocked',
  'processing',
  'completed',
  'rejected',
  'cancelled',
])

export const RETENTION_POLICY_STATUSES = Object.freeze([
  'draft',
  'in_review',
  'approved',
  'effective',
  'superseded',
])

export const RETENTION_ACTIONS = Object.freeze([
  'delete',
  'anonymize',
  'restrict',
  'retain',
])

export const REGULATORY_PROFILE_STATUSES = Object.freeze([
  'draft',
  'in_review',
  'approved',
  'effective',
  'superseded',
])

export const REGULATORY_OPERATOR_CONTEXTS = Object.freeze([
  'consumer_service',
  'marketplace_operator',
  'brand_content_operator',
  'hospitality_operator',
  'platform_operator',
])

const evidenceReferenceSchema = new Schema(
  {
    referenceType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },

    reference: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    note: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
  },
  {
    _id: false,
  },
)

const securityEventSchema = new Schema(
  {
    securityEventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true,
      default: () => `sec_${crypto.randomUUID()}`,
    },

    eventVersion: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
      immutable: true,
    },

    eventType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
      index: true,
      immutable: true,
    },

    severity: {
      type: String,
      enum: SECURITY_EVENT_SEVERITIES,
      required: true,
      index: true,
      immutable: true,
    },

    sourceDomain: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      index: true,
      immutable: true,
    },

    occurredAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
      immutable: true,
    },

    requestId: {
      type: String,
      trim: true,
      maxlength: 160,
      default: '',
      index: true,
      immutable: true,
    },

    correlationId: {
      type: String,
      trim: true,
      maxlength: 180,
      default: '',
      index: true,
      immutable: true,
    },

    actorUserId: {
      type: objectId,
      ref: 'User',
      default: null,
      index: true,
      immutable: true,
    },

    organizationId: {
      type: objectId,
      ref: 'MarketplaceOrganization',
      default: null,
      index: true,
      immutable: true,
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
      immutable: true,
    },
  },
  {
    ...baseOptions,
    collection: 'securityEvents',
  },
)

securityEventSchema.index({
  eventType: 1,
  occurredAt: -1,
})

securityEventSchema.index({
  severity: 1,
  occurredAt: -1,
})

const retentionPolicySchema = new Schema(
  {
    policyKey: {
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

    dataClass: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
      index: true,
      immutable: true,
    },

    purpose: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
      immutable: true,
    },

    retentionDays: {
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

        message: 'Retention days must be an integer or null.',
      },
    },

    dispositionAction: {
      type: String,
      enum: RETENTION_ACTIONS,
      required: true,
      immutable: true,
    },

    immutableRecordClass: {
      type: Boolean,
      required: true,
      default: false,
      immutable: true,
    },

    applicability: {
      type: [String],
      default: [],
      immutable: true,
    },

    effectiveFrom: {
      type: Date,
      required: true,
      index: true,
      immutable: true,
    },

    effectiveTo: {
      type: Date,
      default: null,
      index: true,
      immutable: true,
    },

    evidenceRefs: {
      type: [evidenceReferenceSchema],
      default: [],
      immutable: true,
    },

    status: {
      type: String,
      enum: RETENTION_POLICY_STATUSES,
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

    submittedAt: {
      type: Date,
      default: null,
    },

    submittedByUserId: {
      type: objectId,
      ref: 'User',
      default: null,
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

    activatedAt: {
      type: Date,
      default: null,
    },

    activatedByUserId: {
      type: objectId,
      ref: 'User',
      default: null,
    },

    supersededAt: {
      type: Date,
      default: null,
    },
  },
  {
    ...baseOptions,
    collection: 'retentionPolicies',
  },
)

retentionPolicySchema.index(
  {
    policyKey: 1,
    versionNumber: 1,
  },
  {
    unique: true,
  },
)

const privacyPolicyDecisionSchema = new Schema(
  {
    policyKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    policyVersionNumber: {
      type: Number,
      required: true,
      min: 1,
    },

    dataClass: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    action: {
      type: String,
      enum: RETENTION_ACTIONS,
      required: true,
    },

    immutableRecordClass: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  {
    _id: false,
  },
)

const privacyRightsRequestSchema = new Schema(
  {
    requestId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true,
      default: () => `prv_${crypto.randomUUID()}`,
    },

    userId: {
      type: objectId,
      ref: 'User',
      required: true,
      index: true,
      immutable: true,
    },

    requestType: {
      type: String,
      enum: PRIVACY_RIGHT_TYPES,
      required: true,
      index: true,
      immutable: true,
    },

    scope: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      default: 'account',
      immutable: true,
    },

    status: {
      type: String,
      enum: PRIVACY_REQUEST_STATUSES,
      required: true,
      default: 'submitted',
      index: true,
    },

    requestedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
      immutable: true,
    },

    retentionEvaluation: {
      type: [privacyPolicyDecisionSchema],
      default: [],
      immutable: true,
    },

    consentSnapshot: {
      type: Schema.Types.Mixed,
      default: {},
      immutable: true,
    },

    exportArtifactStatus: {
      type: String,
      enum: [
        'not_generated',
        'available',
        'expired',
      ],
      default: 'not_generated',
    },

    blockedReasonCode: {
      type: String,
      trim: true,
      maxlength: 160,
      default: '',
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    ...baseOptions,
    collection: 'privacyRightsRequests',
  },
)

privacyRightsRequestSchema.index({
  userId: 1,
  requestedAt: -1,
})

const regulatoryProfileSchema = new Schema(
  {
    profileKey: {
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

    jurisdiction: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 40,
      index: true,
      immutable: true,
    },

    operatorApplicability: {
      type: [String],
      enum: REGULATORY_OPERATOR_CONTEXTS,
      required: true,
      immutable: true,
    },

    effectiveFrom: {
      type: Date,
      required: true,
      index: true,
      immutable: true,
    },

    effectiveTo: {
      type: Date,
      default: null,
      index: true,
      immutable: true,
    },

    requiredFields: {
      type: [String],
      default: [],
      immutable: true,
    },

    calculationMethodologyVersion: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      immutable: true,
    },

    presentationRules: {
      type: Schema.Types.Mixed,
      default: {},
      immutable: true,
    },

    evidenceRefs: {
      type: [evidenceReferenceSchema],
      default: [],
      immutable: true,
    },

    status: {
      type: String,
      enum: REGULATORY_PROFILE_STATUSES,
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

    submittedAt: {
      type: Date,
      default: null,
    },

    submittedByUserId: {
      type: objectId,
      ref: 'User',
      default: null,
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

    activatedAt: {
      type: Date,
      default: null,
    },

    activatedByUserId: {
      type: objectId,
      ref: 'User',
      default: null,
    },

    supersededAt: {
      type: Date,
      default: null,
    },
  },
  {
    ...baseOptions,
    collection: 'regulatoryProfiles',
  },
)

regulatoryProfileSchema.index(
  {
    profileKey: 1,
    versionNumber: 1,
  },
  {
    unique: true,
  },
)

regulatoryProfileSchema.index({
  jurisdiction: 1,
  operatorApplicability: 1,
  effectiveFrom: -1,
})

function protectAppendOnlyModel(
  schema,
  message,
) {
  schema.pre(
    [
      'updateOne',
      'updateMany',
      'findOneAndUpdate',
      'replaceOne',
      'deleteOne',
      'deleteMany',
      'findOneAndDelete',
    ],
    function preventMutation(next) {
      const error =
        new Error(message)

      error.code =
        'APPEND_ONLY_RECORD'

      next(error)
    },
  )
}

protectAppendOnlyModel(
  securityEventSchema,
  'Security events are append-only.',
)

export const SecurityEvent =
  mongoose.models.SecurityEvent ||
  mongoose.model(
    'SecurityEvent',
    securityEventSchema,
  )

export const RetentionPolicy =
  mongoose.models.RetentionPolicy ||
  mongoose.model(
    'RetentionPolicy',
    retentionPolicySchema,
  )

export const PrivacyRightsRequest =
  mongoose.models.PrivacyRightsRequest ||
  mongoose.model(
    'PrivacyRightsRequest',
    privacyRightsRequestSchema,
  )

export const RegulatoryProfile =
  mongoose.models.RegulatoryProfile ||
  mongoose.model(
    'RegulatoryProfile',
    regulatoryProfileSchema,
  )