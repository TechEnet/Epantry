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

export const JOB_RUN_STATUSES = Object.freeze([
  'succeeded',
  'failed',
])

export const LAUNCH_GATE_RUN_STATUSES = Object.freeze([
  'passed',
  'blocked',
])

export const RECOVERY_EVIDENCE_TYPES = Object.freeze([
  'restore_drill',
  'rollback_drill',
])

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

const jobRunSchema = new Schema(
  {
    jobRunId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true,
      default: () => `job_${crypto.randomUUID()}`,
    },

    jobVersion: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
      immutable: true,
    },

    jobType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      index: true,
      immutable: true,
    },

    jobKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
      index: true,
      immutable: true,
    },

    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 220,
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

    attemptNumber: {
      type: Number,
      required: true,
      min: 1,
      immutable: true,
    },

    status: {
      type: String,
      enum: JOB_RUN_STATUSES,
      required: true,
      index: true,
      immutable: true,
    },

    startedAt: {
      type: Date,
      required: true,
      immutable: true,
    },

    finishedAt: {
      type: Date,
      required: true,
      immutable: true,
    },

    durationMs: {
      type: Number,
      required: true,
      min: 0,
      immutable: true,
    },

    retryable: {
      type: Boolean,
      required: true,
      default: false,
      immutable: true,
    },

    errorCode: {
      type: String,
      trim: true,
      maxlength: 160,
      default: '',
      immutable: true,
    },

    resultFingerprint: {
      type: String,
      trim: true,
      maxlength: 128,
      default: '',
      immutable: true,
    },
  },
  {
    ...baseOptions,
    collection: 'jobRuns',
  },
)

jobRunSchema.index({
  jobType: 1,
  idempotencyKey: 1,
  attemptNumber: -1,
})

jobRunSchema.index({
  status: 1,
  finishedAt: -1,
})

const recoveryEvidenceSchema = new Schema(
  {
    recoveryEvidenceId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true,
      default: () => `rcv_${crypto.randomUUID()}`,
    },

    evidenceType: {
      type: String,
      enum: RECOVERY_EVIDENCE_TYPES,
      required: true,
      index: true,
      immutable: true,
    },

    environment: {
      type: String,
      enum: [
        'staging',
        'production',
      ],
      required: true,
      index: true,
      immutable: true,
    },

    sourceSnapshotRef: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
      immutable: true,
    },

    restoredTargetRef: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
      immutable: true,
    },

    recoveryPointAt: {
      type: Date,
      required: true,
      immutable: true,
    },

    startedAt: {
      type: Date,
      required: true,
      immutable: true,
    },

    completedAt: {
      type: Date,
      required: true,
      index: true,
      immutable: true,
    },

    verificationChecks: {
      integrityCheckPassed: {
        type: Boolean,
        required: true,
        immutable: true,
      },

      applicationSmokePassed: {
        type: Boolean,
        required: true,
        immutable: true,
      },

      tenantIsolationPassed: {
        type: Boolean,
        required: true,
        immutable: true,
      },
    },

    verified: {
      type: Boolean,
      required: true,
      index: true,
      immutable: true,
    },

    evidenceRefs: {
      type: [String],
      default: [],
      immutable: true,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 4000,
      default: '',
      immutable: true,
    },

    recordedByUserId: {
      type: objectId,
      ref: 'User',
      required: true,
      immutable: true,
    },
  },
  {
    ...baseOptions,
    collection: 'recoveryEvidence',
  },
)

recoveryEvidenceSchema.index({
  evidenceType: 1,
  verified: 1,
  completedAt: -1,
})

const launchGateRunSchema = new Schema(
  {
    launchGateRunId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true,
      default: () => `lgr_${crypto.randomUUID()}`,
    },

    releaseRef: {
      type: String,
      required: true,
      trim: true,
      maxlength: 220,
      index: true,
      immutable: true,
    },

    environment: {
      type: String,
      enum: [
        'staging',
        'production',
      ],
      required: true,
      index: true,
      immutable: true,
    },

    inputFingerprint: {
      type: String,
      required: true,
      trim: true,
      maxlength: 128,
      index: true,
      immutable: true,
    },

    status: {
      type: String,
      enum: LAUNCH_GATE_RUN_STATUSES,
      required: true,
      index: true,
      immutable: true,
    },

    gateResults: {
      type: [Schema.Types.Mixed],
      default: [],
      immutable: true,
    },

    blockerCodes: {
      type: [String],
      default: [],
      immutable: true,
    },

    activeIncidentRefs: {
      type: [String],
      default: [],
      immutable: true,
    },

    recoveryEvidenceRef: {
      type: String,
      default: '',
      immutable: true,
    },

    deterministicInput: {
      type: Schema.Types.Mixed,
      required: true,
      immutable: true,
    },

    startedAt: {
      type: Date,
      required: true,
      immutable: true,
    },

    completedAt: {
      type: Date,
      required: true,
      index: true,
      immutable: true,
    },

    executedByUserId: {
      type: objectId,
      ref: 'User',
      required: true,
      immutable: true,
    },
  },
  {
    ...baseOptions,
    collection: 'launchGateRuns',
  },
)

launchGateRunSchema.index({
  releaseRef: 1,
  completedAt: -1,
})

protectAppendOnlyModel(
  jobRunSchema,
  'Job Run attempts are append-only.',
)

protectAppendOnlyModel(
  recoveryEvidenceSchema,
  'Recovery evidence is append-only.',
)

protectAppendOnlyModel(
  launchGateRunSchema,
  'Launch Gate runs are append-only.',
)

export const JobRun =
  mongoose.models.JobRun ||
  mongoose.model(
    'JobRun',
    jobRunSchema,
  )

export const RecoveryEvidence =
  mongoose.models.RecoveryEvidence ||
  mongoose.model(
    'RecoveryEvidence',
    recoveryEvidenceSchema,
  )

export const LaunchGateRun =
  mongoose.models.LaunchGateRun ||
  mongoose.model(
    'LaunchGateRun',
    launchGateRunSchema,
  )