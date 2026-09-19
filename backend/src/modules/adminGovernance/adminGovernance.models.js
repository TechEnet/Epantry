import crypto from 'crypto'

import mongoose from 'mongoose'

const { Schema } = mongoose
const objectId = Schema.Types.ObjectId

export const ADMIN_GOVERNANCE_DOMAINS = Object.freeze([
  'admin',
  'catalog',
  'recipe',
  'marketplace',
  'finance',
  'trust_safety',
  'cms',
  'host_review',
])

export const ADMIN_GOVERNANCE_SEVERITIES = Object.freeze([
  'informational',
  'low',
  'medium',
  'high',
  'critical',
])

export const ADMIN_GOVERNANCE_PRIORITIES = Object.freeze([
  'p0',
  'p1',
  'p2',
  'p3',
])

export const ADMIN_REVIEW_CASE_STATUSES = Object.freeze([
  'open',
  'in_review',
  'blocked',
  'resolved',
  'dismissed',
])

export const ADMIN_REVIEW_CASE_TYPES = Object.freeze([
  'data_quality',
  'safety',
  'source_conflict',
  'duplicate',
  'claim',
  'kyb',
  'marketplace_dispute',
  'finance_reconciliation',
  'integration_failure',
  'privacy',
  'policy',
  'support',
  'other',
])

export const ADMIN_INCIDENT_STATUSES = Object.freeze([
  'investigating',
  'monitoring',
  'resolved',
])

export const ADMIN_SUPPORT_CASE_STATUSES = Object.freeze([
  'open',
  'in_progress',
  'waiting',
  'resolved',
  'closed',
])

export const ADMIN_FEATURE_FLAG_ENVIRONMENTS = Object.freeze([
  'development',
  'staging',
  'production',
])

const baseOptions = Object.freeze({
  timestamps: true,
  strict: true,
  minimize: false,
  versionKey: false,
})

const evidenceSchema = new Schema(
  {
    type: {
      type: String,
      enum: [
        'source',
        'document',
        'audit_event',
        'incident',
        'ticket',
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

    checksumSha256: {
      type: String,
      trim: true,
      maxlength: 64,
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

const governanceEntitySchema = new Schema(
  {
    type: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 120,
      required: true,
    },

    id: {
      type: String,
      trim: true,
      maxlength: 200,
      required: true,
    },

    label: {
      type: String,
      trim: true,
      maxlength: 300,
      default: '',
    },
  },
  {
    _id: false,
  },
)

const governanceTimelineSchema = new Schema(
  {
    eventType: {
      type: String,
      enum: [
        'created',
        'assigned',
        'status_changed',
        'decision',
        'command_executed',
        'evidence_added',
      ],
      required: true,
    },

    actorUserId: {
      type: objectId,
      ref: 'User',
      required: true,
    },

    note: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
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
)

const adminReviewCaseSchema = new Schema(
  {
    caseKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true,
      default: () => `RC-${crypto.randomUUID()}`,
    },

    domain: {
      type: String,
      enum: ADMIN_GOVERNANCE_DOMAINS,
      required: true,
      index: true,
    },

    caseType: {
      type: String,
      enum: ADMIN_REVIEW_CASE_TYPES,
      required: true,
      index: true,
    },

    entity: {
      type: governanceEntitySchema,
      required: true,
    },

    severity: {
      type: String,
      enum: ADMIN_GOVERNANCE_SEVERITIES,
      required: true,
      default: 'medium',
      index: true,
    },

    priority: {
      type: String,
      enum: ADMIN_GOVERNANCE_PRIORITIES,
      required: true,
      default: 'p2',
      index: true,
    },

    status: {
      type: String,
      enum: ADMIN_REVIEW_CASE_STATUSES,
      required: true,
      default: 'open',
      index: true,
    },

    summary: {
      type: String,
      trim: true,
      maxlength: 500,
      required: true,
    },

    details: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: '',
    },

    evidence: {
      type: [evidenceSchema],
      default: [],
    },

    assignedToUserId: {
      type: objectId,
      ref: 'User',
      default: null,
      index: true,
    },

    decision: {
      code: {
        type: String,
        enum: [
          'accepted',
          'rejected',
          'needs_action',
          'resolved',
          'dismissed',
          'quarantined',
          'disabled',
          'recovered',
        ],
        default: null,
      },

      reason: {
        type: String,
        trim: true,
        maxlength: 4000,
        default: '',
      },

      decidedByUserId: {
        type: objectId,
        ref: 'User',
        default: null,
      },

      decidedAt: {
        type: Date,
        default: null,
      },
    },

    beforeSnapshot: {
      type: Schema.Types.Mixed,
      default: null,
    },

    afterSnapshot: {
      type: Schema.Types.Mixed,
      default: null,
    },

    timeline: {
      type: [governanceTimelineSchema],
      default: [],
    },

    createdByUserId: {
      type: objectId,
      ref: 'User',
      required: true,
    },

    updatedByUserId: {
      type: objectId,
      ref: 'User',
      required: true,
    },

    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    ...baseOptions,
    collection: 'reviewCases',
  },
)

adminReviewCaseSchema.index({
  domain: 1,
  status: 1,
  priority: 1,
  severity: 1,
  createdAt: 1,
})

adminReviewCaseSchema.index({
  'entity.type': 1,
  'entity.id': 1,
  status: 1,
})

const adminIncidentSchema = new Schema(
  {
    incidentKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true,
      default: () => `INC-${crypto.randomUUID()}`,
    },

    domain: {
      type: String,
      enum: ADMIN_GOVERNANCE_DOMAINS,
      required: true,
      index: true,
    },

    title: {
      type: String,
      trim: true,
      maxlength: 300,
      required: true,
    },

    summary: {
      type: String,
      trim: true,
      maxlength: 5000,
      required: true,
    },

    severity: {
      type: String,
      enum: ADMIN_GOVERNANCE_SEVERITIES,
      required: true,
      default: 'high',
      index: true,
    },

    status: {
      type: String,
      enum: ADMIN_INCIDENT_STATUSES,
      required: true,
      default: 'investigating',
      index: true,
    },

    impactedSurfaces: {
      type: [String],
      default: [],
    },

    evidence: {
      type: [evidenceSchema],
      default: [],
    },

    banner: {
      enabled: {
        type: Boolean,
        required: true,
        default: false,
      },

      message: {
        type: String,
        trim: true,
        maxlength: 1000,
        default: '',
      },
    },

    assignedToUserId: {
      type: objectId,
      ref: 'User',
      default: null,
      index: true,
    },

    timeline: {
      type: [governanceTimelineSchema],
      default: [],
    },

    createdByUserId: {
      type: objectId,
      ref: 'User',
      required: true,
    },

    updatedByUserId: {
      type: objectId,
      ref: 'User',
      required: true,
    },

    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    ...baseOptions,
    collection: 'incidents',
  },
)

adminIncidentSchema.index({
  domain: 1,
  status: 1,
  severity: 1,
  startedAt: -1,
})

const adminSupportCaseSchema = new Schema(
  {
    supportKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true,
      default: () => `SUP-${crypto.randomUUID()}`,
    },

    domain: {
      type: String,
      enum: ADMIN_GOVERNANCE_DOMAINS,
      required: true,
      index: true,
    },

    subject: {
      type: {
        type: String,
        enum: [
          'user',
          'organization',
          'order',
          'product',
          'recipe',
          'integration',
          'other',
        ],
        required: true,
      },

      id: {
        type: String,
        trim: true,
        maxlength: 200,
        required: true,
      },
    },

    title: {
      type: String,
      trim: true,
      maxlength: 300,
      required: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 5000,
      required: true,
    },

    priority: {
      type: String,
      enum: ADMIN_GOVERNANCE_PRIORITIES,
      required: true,
      default: 'p2',
      index: true,
    },

    status: {
      type: String,
      enum: ADMIN_SUPPORT_CASE_STATUSES,
      required: true,
      default: 'open',
      index: true,
    },

    evidence: {
      type: [evidenceSchema],
      default: [],
    },

    assignedToUserId: {
      type: objectId,
      ref: 'User',
      default: null,
      index: true,
    },

    timeline: {
      type: [governanceTimelineSchema],
      default: [],
    },

    createdByUserId: {
      type: objectId,
      ref: 'User',
      required: true,
    },

    updatedByUserId: {
      type: objectId,
      ref: 'User',
      required: true,
    },

    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    ...baseOptions,
    collection: 'supportCases',
  },
)

adminSupportCaseSchema.index({
  domain: 1,
  status: 1,
  priority: 1,
  createdAt: -1,
})

adminSupportCaseSchema.index({
  'subject.type': 1,
  'subject.id': 1,
})

const adminFeatureFlagSchema = new Schema(
  {
    key: {
      type: String,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 100,
      match: [
        /^[a-z][a-z0-9_.-]*$/,
        'Feature flag key must use lowercase letters, numbers, dots, underscores or hyphens.',
      ],
      required: true,
      unique: true,
      index: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1500,
      required: true,
    },

    enabled: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },

    environments: {
      type: [
        {
          type: String,
          enum: ADMIN_FEATURE_FLAG_ENVIRONMENTS,
        },
      ],
      required: true,
      default: ['development'],
    },

    rolloutPercentage: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
      default: 0,
    },

    ownerDomain: {
      type: String,
      enum: ADMIN_GOVERNANCE_DOMAINS,
      required: true,
      default: 'admin',
      index: true,
    },

    riskLevel: {
      type: String,
      enum: [
        'low',
        'medium',
        'high',
        'critical',
      ],
      required: true,
      default: 'medium',
    },

    expiresAt: {
      type: Date,
      default: null,
    },

    changeReason: {
      type: String,
      trim: true,
      maxlength: 4000,
      required: true,
    },

    changeEvidence: {
      type: [evidenceSchema],
      default: [],
    },

    version: {
      type: Number,
      min: 1,
      required: true,
      default: 1,
    },

    createdByUserId: {
      type: objectId,
      ref: 'User',
      required: true,
    },

    updatedByUserId: {
      type: objectId,
      ref: 'User',
      required: true,
    },
  },
  {
    ...baseOptions,
    collection: 'featureFlags',
  },
)

adminFeatureFlagSchema.index({
  enabled: 1,
  ownerDomain: 1,
  updatedAt: -1,
})

export const AdminReviewCase =
  mongoose.models.AdminReviewCase ||
  mongoose.model(
    'AdminReviewCase',
    adminReviewCaseSchema,
  )

export const AdminIncident =
  mongoose.models.AdminIncident ||
  mongoose.model(
    'AdminIncident',
    adminIncidentSchema,
  )

export const AdminSupportCase =
  mongoose.models.AdminSupportCase ||
  mongoose.model(
    'AdminSupportCase',
    adminSupportCaseSchema,
  )

export const AdminFeatureFlag =
  mongoose.models.AdminFeatureFlag ||
  mongoose.model(
    'AdminFeatureFlag',
    adminFeatureFlagSchema,
  )