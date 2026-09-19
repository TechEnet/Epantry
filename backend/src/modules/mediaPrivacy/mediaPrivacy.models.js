import crypto from 'crypto'

import mongoose from 'mongoose'

const { Schema } = mongoose
const objectId = Schema.Types.ObjectId

const baseOptions = Object.freeze({
  timestamps: true,
  strict: true,
  minimize: false,
  versionKey: false,
})

export const MEDIA_PRIVACY_RISK_TYPES = Object.freeze([
  'face',
  'home_address',
  'receipt_personal_data',
  'personal_correspondence',
  'household_information',
  'geolocation_metadata',
  'device_metadata',
  'sensitive_text',
  'other',
])

export const MEDIA_PRIVACY_RISK_SEVERITIES = Object.freeze([
  'low',
  'medium',
  'high',
  'critical',
])

export const MEDIA_PRIVACY_DETECTOR_STATUSES = Object.freeze([
  'completed',
  'unavailable',
  'failed',
])

export const MEDIA_PRIVACY_METADATA_STATUSES = Object.freeze([
  'completed',
  'failed',
  'not_required',
])

export const MEDIA_PRIVACY_DECISIONS = Object.freeze([
  'safe_to_use',
  'needs_review',
  'redaction_required',
])

export const MEDIA_PRIVACY_REVIEW_STATUSES = Object.freeze([
  'open',
  'in_review',
  'resolved',
  'cancelled',
])

export const MEDIA_PRIVACY_REVIEW_DECISIONS = Object.freeze([
  'safe_to_use',
  'redaction_required',
  'reupload_required',
  'delete_media',
])

export const MEDIA_REDACTION_JOB_STATUSES = Object.freeze([
  'queued',
  'processing',
  'succeeded',
  'failed',
  'cancelled',
])

export const MEDIA_REDACTION_OPERATION_TYPES = Object.freeze([
  'blur',
  'solid_mask',
  'crop',
])

export const MEDIA_RETENTION_ACTIONS = Object.freeze([
  'cleanup_requested',
  'delete_original',
  'delete_redacted_copy',
  'retain_until',
  'cleanup_completed',
  'cleanup_failed',
])

const normalizedBoundingBoxSchema = new Schema(
  {
    x: { type: Number, required: true, min: 0, max: 1 },
    y: { type: Number, required: true, min: 0, max: 1 },
    width: { type: Number, required: true, min: 0, max: 1 },
    height: { type: Number, required: true, min: 0, max: 1 },
  },
  { _id: false },
)

const privacyFindingSchema = new Schema(
  {
    riskType: {
      type: String,
      enum: MEDIA_PRIVACY_RISK_TYPES,
      required: true,
    },

    severity: {
      type: String,
      enum: MEDIA_PRIVACY_RISK_SEVERITIES,
      required: true,
    },

    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },

    boundingBox: {
      type: normalizedBoundingBoxSchema,
      default: null,
    },

    reasonCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 120,
    },

    evidenceFingerprint: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 128,
      default: '',
    },
  },
  { _id: false },
)

const mediaSafetyAssessmentSchema = new Schema(
  {
    assessmentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true,
      default: () => `msa_${crypto.randomUUID()}`,
    },

    imageEvidenceId: {
      type: objectId,
      ref: 'ImageEvidence',
      required: true,
      index: true,
      immutable: true,
    },

    ownerUserId: {
      type: objectId,
      ref: 'User',
      required: true,
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

    detectorProvider: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      immutable: true,
    },

    detectorModel: {
      type: String,
      trim: true,
      maxlength: 160,
      default: '',
      immutable: true,
    },

    detectorStatus: {
      type: String,
      enum: MEDIA_PRIVACY_DETECTOR_STATUSES,
      required: true,
      immutable: true,
    },

    metadataStatus: {
      type: String,
      enum: MEDIA_PRIVACY_METADATA_STATUSES,
      required: true,
      immutable: true,
    },

    metadataStripped: {
      type: Boolean,
      required: true,
      immutable: true,
    },

    decision: {
      type: String,
      enum: MEDIA_PRIVACY_DECISIONS,
      required: true,
      index: true,
      immutable: true,
    },

    highestSeverity: {
      type: String,
      enum: MEDIA_PRIVACY_RISK_SEVERITIES,
      default: null,
      index: true,
      immutable: true,
    },

    findings: {
      type: [privacyFindingSchema],
      default: [],
      immutable: true,
    },

    reasonCodes: {
      type: [String],
      default: [],
      immutable: true,
    },

    scannerVersion: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      immutable: true,
    },

    requestId: {
      type: String,
      trim: true,
      maxlength: 160,
      default: '',
      immutable: true,
    },

    correlationId: {
      type: String,
      trim: true,
      maxlength: 180,
      default: '',
      immutable: true,
    },

    assessedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
      immutable: true,
    },
  },
  {
    ...baseOptions,
    collection: 'mediaSafetyAssessments',
  },
)

mediaSafetyAssessmentSchema.index({ imageEvidenceId: 1, assessedAt: -1 })
mediaSafetyAssessmentSchema.index({ decision: 1, assessedAt: -1 })

const redactionOperationSchema = new Schema(
  {
    operationType: {
      type: String,
      enum: MEDIA_REDACTION_OPERATION_TYPES,
      required: true,
    },

    boundingBox: {
      type: normalizedBoundingBoxSchema,
      default: null,
    },

    reasonCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 120,
    },
  },
  { _id: false },
)

const redactionJobSchema = new Schema(
  {
    redactionJobId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true,
      default: () => `rdj_${crypto.randomUUID()}`,
    },

    sourceImageEvidenceId: {
      type: objectId,
      ref: 'ImageEvidence',
      required: true,
      index: true,
      immutable: true,
    },

    sourceAssessmentId: {
      type: objectId,
      ref: 'MediaSafetyAssessment',
      required: true,
      index: true,
      immutable: true,
    },

    ownerUserId: {
      type: objectId,
      ref: 'User',
      required: true,
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

    requestedByUserId: {
      type: objectId,
      ref: 'User',
      required: true,
      immutable: true,
    },

    operations: {
      type: [redactionOperationSchema],
      required: true,
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length > 0 && value.length <= 50
        },
        message: 'At least one and no more than 50 redaction operations are required.',
      },
    },

    status: {
      type: String,
      enum: MEDIA_REDACTION_JOB_STATUSES,
      required: true,
      default: 'queued',
      index: true,
    },

    outputImageEvidenceId: {
      type: objectId,
      ref: 'ImageEvidence',
      default: null,
      index: true,
    },

    outputAssessmentId: {
      type: objectId,
      ref: 'MediaSafetyAssessment',
      default: null,
      index: true,
    },

    originalRetainUntil: {
      type: Date,
      required: true,
      index: true,
      immutable: true,
    },

    attemptCount: {
      type: Number,
      min: 0,
      max: 10,
      default: 0,
    },

    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },

    failureCode: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 120,
      default: '',
    },
  },
  {
    ...baseOptions,
    collection: 'redactionJobs',
  },
)

redactionJobSchema.index({ ownerUserId: 1, createdAt: -1 })
redactionJobSchema.index({ organizationId: 1, createdAt: -1 })
redactionJobSchema.index({ status: 1, createdAt: 1 })

const privacyReviewCaseSchema = new Schema(
  {
    privacyReviewCaseId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true,
      default: () => `prc_${crypto.randomUUID()}`,
    },

    imageEvidenceId: {
      type: objectId,
      ref: 'ImageEvidence',
      required: true,
      index: true,
      immutable: true,
    },

    assessmentId: {
      type: objectId,
      ref: 'MediaSafetyAssessment',
      required: true,
      index: true,
      immutable: true,
    },

    ownerUserId: {
      type: objectId,
      ref: 'User',
      required: true,
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

    reasonCodes: {
      type: [String],
      default: [],
      immutable: true,
    },

    status: {
      type: String,
      enum: MEDIA_PRIVACY_REVIEW_STATUSES,
      required: true,
      default: 'open',
      index: true,
    },

    assignedToUserId: {
      type: objectId,
      ref: 'User',
      default: null,
      index: true,
    },

    decision: {
      type: String,
      enum: MEDIA_PRIVACY_REVIEW_DECISIONS,
      default: null,
      index: true,
    },

    resolutionNote: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },

    resolvedAt: { type: Date, default: null },
    resolvedByUserId: { type: objectId, ref: 'User', default: null },
  },
  {
    ...baseOptions,
    collection: 'privacyReviewCases',
  },
)

privacyReviewCaseSchema.index({ status: 1, createdAt: 1 })
privacyReviewCaseSchema.index({ organizationId: 1, status: 1, createdAt: -1 })

const mediaRetentionRecordSchema = new Schema(
  {
    retentionRecordId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true,
      default: () => `mrr_${crypto.randomUUID()}`,
    },

    imageEvidenceId: {
      type: objectId,
      ref: 'ImageEvidence',
      required: true,
      index: true,
      immutable: true,
    },

    ownerUserId: {
      type: objectId,
      ref: 'User',
      required: true,
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

    action: {
      type: String,
      enum: MEDIA_RETENTION_ACTIONS,
      required: true,
      index: true,
      immutable: true,
    },

    reasonCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 120,
      immutable: true,
    },

    policyKey: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 120,
      default: '',
      immutable: true,
    },

    policyVersion: {
      type: Number,
      min: 1,
      default: null,
      immutable: true,
    },

    retainUntil: {
      type: Date,
      default: null,
      index: true,
      immutable: true,
    },

    actorUserId: {
      type: objectId,
      ref: 'User',
      default: null,
      immutable: true,
    },

    requestId: {
      type: String,
      trim: true,
      maxlength: 160,
      default: '',
      immutable: true,
    },

    correlationId: {
      type: String,
      trim: true,
      maxlength: 180,
      default: '',
      immutable: true,
    },

    occurredAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
      immutable: true,
    },
  },
  {
    ...baseOptions,
    collection: 'retentionRecords',
  },
)

mediaRetentionRecordSchema.index({ imageEvidenceId: 1, occurredAt: -1 })
mediaRetentionRecordSchema.index({ action: 1, occurredAt: -1 })

function protectAppendOnlyModel(schema, message) {
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
      const error = new Error(message)
      error.code = 'APPEND_ONLY_RECORD'
      next(error)
    },
  )
}

protectAppendOnlyModel(
  mediaSafetyAssessmentSchema,
  'Media privacy assessments are append-only evidence.',
)

protectAppendOnlyModel(
  mediaRetentionRecordSchema,
  'Media retention records are append-only evidence.',
)

export const MediaSafetyAssessment =
  mongoose.models.MediaSafetyAssessment ||
  mongoose.model('MediaSafetyAssessment', mediaSafetyAssessmentSchema)

export const RedactionJob =
  mongoose.models.RedactionJob ||
  mongoose.model('RedactionJob', redactionJobSchema)

export const PrivacyReviewCase =
  mongoose.models.PrivacyReviewCase ||
  mongoose.model('PrivacyReviewCase', privacyReviewCaseSchema)

export const MediaRetentionRecord =
  mongoose.models.MediaRetentionRecord ||
  mongoose.model('MediaRetentionRecord', mediaRetentionRecordSchema)
