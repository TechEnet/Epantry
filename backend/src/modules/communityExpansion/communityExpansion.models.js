import mongoose from 'mongoose'

const { Schema } = mongoose
const objectId = Schema.Types.ObjectId

export const CREATOR_CONTENT_TYPES = Object.freeze([
  'community_recipe',
  'creator_course',
])

export const CREATOR_CONTENT_GOVERNANCE_STATES = Object.freeze([
  'pending_review',
  'approved',
  'restricted',
  'removed',
])

export const COMMUNITY_REPORT_SUBJECT_TYPES = Object.freeze([
  'community_recipe',
  'creator_profile',
  'creator_course',
  'community_review',
])

export const COMMUNITY_REPORT_REASONS = Object.freeze([
  'spam',
  'harassment',
  'unsafe_food_advice',
  'copyright',
  'undisclosed_sponsorship',
  'fake_review',
  'dangerous_allergen_claim',
  'privacy',
  'other',
])

export const COMMUNITY_REPORT_STATUSES = Object.freeze([
  'open',
  'in_review',
  'actioned',
  'dismissed',
])

const baseOptions = Object.freeze({
  timestamps: true,
  strict: true,
  minimize: false,
  versionKey: false,
})

const rightsSchema = new Schema(
  {
    ownerOrLicensor: {
      type: String,
      trim: true,
      maxlength: 300,
      required: true,
    },

    allowedTerritories: {
      type: [String],
      default: [],
    },

    publishFrom: {
      type: Date,
      default: null,
    },

    publishUntil: {
      type: Date,
      default: null,
    },

    downloadAllowed: {
      type: Boolean,
      required: true,
      default: false,
    },

    sponsored: {
      type: Boolean,
      required: true,
      default: false,
    },

    sponsorLabel: {
      type: String,
      enum: [
        'Sponsored',
        'Ad',
        'Paid collaboration',
      ],
      default: 'Sponsored',
    },

    disclosureText: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },

    takedownState: {
      type: String,
      enum: [
        'clear',
        'restricted',
        'removed',
      ],
      required: true,
      default: 'clear',
    },
  },
  {
    _id: false,
    strict: true,
  },
)

const creatorContentSchema = new Schema(
  {
    creatorProfileId: {
      type: objectId,
      ref: 'CreatorProfile',
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

    contentType: {
      type: String,
      enum: CREATOR_CONTENT_TYPES,
      required: true,
      index: true,
      immutable: true,
    },

    contentId: {
      type: objectId,
      required: true,
      index: true,
      immutable: true,
    },

    sourceLineage: {
      sourceContentType: {
        type: String,
        trim: true,
        maxlength: 80,
        default: '',
      },

      sourceContentId: {
        type: String,
        trim: true,
        maxlength: 240,
        default: '',
      },

      attributionLabel: {
        type: String,
        trim: true,
        maxlength: 500,
        default: '',
      },

      creatorProseCopied: {
        type: Boolean,
        required: true,
        default: false,
      },

      creatorMediaCopied: {
        type: Boolean,
        required: true,
        default: false,
      },

      foodIntelligenceCopied: {
        type: Boolean,
        required: true,
        default: false,
      },
    },

    rights: {
      type: rightsSchema,
      required: true,
    },

    governanceState: {
      type: String,
      enum: CREATOR_CONTENT_GOVERNANCE_STATES,
      required: true,
      default: 'pending_review',
      index: true,
    },

    reviewReason: {
      type: String,
      trim: true,
      maxlength: 4000,
      default: '',
    },

    reviewEvidenceRefs: {
      type: [String],
      default: [],
    },

    reviewedByUserId: {
      type: objectId,
      ref: 'User',
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    ...baseOptions,
    collection: 'creatorContent',
  },
)

creatorContentSchema.index(
  {
    contentType: 1,
    contentId: 1,
  },
  {
    unique: true,
    name: 'creator_content_unique_source',
  },
)

creatorContentSchema.pre(
  'validate',
  function validateCreatorContent(next) {
    if (
      this.rights?.publishFrom &&
      this.rights?.publishUntil &&
      this.rights.publishUntil <=
        this.rights.publishFrom
    ) {
      this.invalidate(
        'rights.publishUntil',
        'Creator content publication window is invalid.',
      )
    }

    if (
      this.rights?.sponsored === true &&
      !String(
        this.rights?.disclosureText || '',
      ).trim()
    ) {
      this.invalidate(
        'rights.disclosureText',
        'Sponsored creator content requires explicit disclosure text.',
      )
    }

    if (
      this.sourceLineage?.foodIntelligenceCopied ===
      true
    ) {
      this.invalidate(
        'sourceLineage.foodIntelligenceCopied',
        'Food Intelligence must be recalculated and can never be copied through creator lineage.',
      )
    }

    next()
  },
)

const communityReportSchema = new Schema(
  {
    reporterUserId: {
      type: objectId,
      ref: 'User',
      required: true,
      index: true,
      immutable: true,
    },

    subjectType: {
      type: String,
      enum: COMMUNITY_REPORT_SUBJECT_TYPES,
      required: true,
      index: true,
      immutable: true,
    },

    subjectId: {
      type: objectId,
      required: true,
      index: true,
      immutable: true,
    },

    reason: {
      type: String,
      enum: COMMUNITY_REPORT_REASONS,
      required: true,
      index: true,
      immutable: true,
    },

    details: {
      type: String,
      trim: true,
      maxlength: 4000,
      default: '',
      immutable: true,
    },

    evidenceRefs: {
      type: [String],
      default: [],
      immutable: true,
    },

    idempotencyKey: {
      type: String,
      trim: true,
      maxlength: 160,
      required: true,
      immutable: true,
    },

    status: {
      type: String,
      enum: COMMUNITY_REPORT_STATUSES,
      required: true,
      default: 'open',
      index: true,
    },

    resolution: {
      action: {
        type: String,
        enum: [
          'none',
          'dismiss',
          'quarantine_content',
          'restrict_content',
          'remove_content',
          'suspend_creator',
        ],
        default: 'none',
      },

      reason: {
        type: String,
        trim: true,
        maxlength: 4000,
        default: '',
      },

      evidenceRefs: {
        type: [String],
        default: [],
      },

      resolvedByUserId: {
        type: objectId,
        ref: 'User',
        default: null,
      },

      resolvedAt: {
        type: Date,
        default: null,
      },
    },
  },
  {
    ...baseOptions,
    collection: 'communityReports',
  },
)

communityReportSchema.index(
  {
    reporterUserId: 1,
    idempotencyKey: 1,
  },
  {
    unique: true,
    name: 'community_report_idempotency',
  },
)

communityReportSchema.index({
  status: 1,
  reason: 1,
  createdAt: 1,
})

export const CreatorContent =
  mongoose.models.CreatorContent ||
  mongoose.model(
    'CreatorContent',
    creatorContentSchema,
  )

export const CommunityReport =
  mongoose.models.CommunityReport ||
  mongoose.model(
    'CommunityReport',
    communityReportSchema,
  )