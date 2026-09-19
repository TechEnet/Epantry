import mongoose from 'mongoose'

const { Schema } = mongoose
const objectId = Schema.Types.ObjectId

const baseOptions = Object.freeze({
  timestamps: true,
  strict: true,
  minimize: false,
  versionKey: false,
})

export const CREATOR_SESSION_ACCESS_TYPES = Object.freeze([
  'free',
  'entitled',
  'paid',
])

export const CREATOR_SESSION_STATUSES = Object.freeze([
  'draft',
  'published',
  'cancelled',
  'completed',
])

export const CREATOR_BOOKING_STATUSES = Object.freeze([
  'reserved',
  'payment_required',
  'confirmed',
  'cancelled',
  'attended',
  'refund_review_required',
])

function protectAppendOnly(schema, label) {
  const operations = [
    'updateOne',
    'updateMany',
    'findOneAndUpdate',
    'replaceOne',
    'deleteOne',
    'deleteMany',
    'findOneAndDelete',
  ]

  for (const operation of operations) {
    schema.pre(operation, function rejectMutation(next) {
      next(
        new Error(
          `${label} is append-only and cannot be mutated or deleted.`,
        ),
      )
    })
  }
}

const sponsoredEligibilityEvidenceSchema = new Schema(
  {
    customerUserId: {
      type: objectId,
      ref: 'User',
      required: true,
      index: true,
      immutable: true,
    },

    searchSessionId: {
      type: objectId,
      ref: 'SearchSession',
      required: true,
      index: true,
      immutable: true,
    },

    candidateSetId: {
      type: objectId,
      ref: 'CandidateSet',
      default: null,
      immutable: true,
    },

    rankingDecisionId: {
      type: objectId,
      ref: 'RankingDecision',
      default: null,
      immutable: true,
    },

    campaignId: {
      type: objectId,
      ref: 'Campaign',
      default: null,
      index: true,
      immutable: true,
    },

    placement: {
      type: String,
      trim: true,
      maxlength: 80,
      required: true,
      index: true,
      immutable: true,
    },

    marketCode: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 10,
      required: true,
      immutable: true,
    },

    promotedEntityType: {
      type: String,
      enum: ['product', 'recipe'],
      default: null,
      immutable: true,
    },

    promotedEntityId: {
      type: String,
      trim: true,
      maxlength: 240,
      default: '',
      immutable: true,
    },

    canonicalVersionPublished: {
      type: Boolean,
      required: true,
      default: false,
      immutable: true,
    },

    approvedFoodCalculationId: {
      type: objectId,
      ref: 'FoodCalculation',
      default: null,
      immutable: true,
    },

    organicCandidatePresent: {
      type: Boolean,
      required: true,
      default: false,
      immutable: true,
    },

    unresolvedHardConstraintsPresent: {
      type: Boolean,
      required: true,
      default: true,
      immutable: true,
    },

    serviceabilityRequired: {
      type: Boolean,
      required: true,
      default: false,
      immutable: true,
    },

    serviceableOfferCount: {
      type: Number,
      min: 0,
      required: true,
      default: 0,
      immutable: true,
    },

    outcome: {
      type: String,
      enum: [
        'eligible',
        'suppressed',
        'served',
        'no_eligible_campaign',
      ],
      required: true,
      index: true,
      immutable: true,
    },

    reasonCodes: {
      type: [String],
      default: [],
      immutable: true,
    },

    sponsoredRankScore: {
      type: Number,
      default: null,
      immutable: true,
    },

    policy: {
      safetyEvaluatedBeforePaidRanking: {
        type: Boolean,
        required: true,
        default: true,
        immutable: true,
      },

      organicRankingMutated: {
        type: Boolean,
        required: true,
        default: false,
        immutable: true,
      },

      clientSafetyAssertionTrusted: {
        type: Boolean,
        required: true,
        default: false,
        immutable: true,
      },
    },

    decidedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
      immutable: true,
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },

    strict: true,
    minimize: false,
    versionKey: false,

    collection:
      'sponsoredEligibilityEvidence',
  },
)

sponsoredEligibilityEvidenceSchema.index({
  searchSessionId: 1,
  placement: 1,
  decidedAt: -1,
})

protectAppendOnly(
  sponsoredEligibilityEvidenceSchema,
  'Sponsored eligibility evidence',
)

const creatorSessionSchema = new Schema(
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

    courseId: {
      type: objectId,
      ref: 'CreatorCourse',
      required: true,
      index: true,
      immutable: true,
    },

    title: {
      type: String,
      trim: true,
      maxlength: 220,
      required: true,
    },

    summary: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: '',
    },

    startsAt: {
      type: Date,
      required: true,
      index: true,
    },

    endsAt: {
      type: Date,
      required: true,
    },

    timezone: {
      type: String,
      trim: true,
      maxlength: 120,
      required: true,
      default: 'Asia/Kolkata',
    },

    capacity: {
      type: Number,
      min: 1,
      max: 10000,
      required: true,
    },

    reservedSeats: {
      type: Number,
      min: 0,
      required: true,
      default: 0,
    },

    accessType: {
      type: String,
      enum: CREATOR_SESSION_ACCESS_TYPES,
      required: true,
      default: 'free',
      index: true,
    },

    priceMinor: {
      type: Number,
      min: 0,
      required: true,
      default: 0,
    },

    currency: {
      type: String,
      trim: true,
      uppercase: true,
      minlength: 3,
      maxlength: 3,
      required: true,
      default: 'INR',
    },

    cancellationCutoffMinutes: {
      type: Number,
      min: 0,
      max: 10080,
      required: true,
      default: 120,
    },

    commercialDisclosure: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: '',
    },

    status: {
      type: String,
      enum: CREATOR_SESSION_STATUSES,
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

    publishedAt: {
      type: Date,
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    ...baseOptions,

    collection:
      'creatorSessions',
  },
)

creatorSessionSchema.pre(
  'validate',
  function validateCreatorSession(next) {
    if (
      this.endsAt &&
      this.startsAt &&
      this.endsAt <=
        this.startsAt
    ) {
      this.invalidate(
        'endsAt',
        'Creator session must end after it starts.',
      )
    }

    if (
      this.accessType ===
        'paid' &&
      this.priceMinor <= 0
    ) {
      this.invalidate(
        'priceMinor',
        'Paid Creator session requires a positive server-owned price.',
      )
    }

    if (
      this.accessType !==
        'paid' &&
      this.priceMinor !== 0
    ) {
      this.invalidate(
        'priceMinor',
        'Free or entitlement sessions cannot carry a payable price.',
      )
    }

    next()
  },
)

creatorSessionSchema.index({
  status: 1,
  startsAt: 1,
  creatorProfileId: 1,
})

const creatorSessionBookingSchema = new Schema(
  {
    sessionId: {
      type: objectId,
      ref: 'CreatorSession',
      required: true,
      index: true,
      immutable: true,
    },

    courseId: {
      type: objectId,
      ref: 'CreatorCourse',
      required: true,
      immutable: true,
    },

    customerUserId: {
      type: objectId,
      ref: 'User',
      required: true,
      index: true,
      immutable: true,
    },

    status: {
      type: String,
      enum: CREATOR_BOOKING_STATUSES,
      required: true,
      index: true,
    },

    seatCount: {
      type: Number,
      min: 1,
      max: 1,
      required: true,
      default: 1,
      immutable: true,
    },

    accessTypeSnapshot: {
      type: String,
      enum: CREATOR_SESSION_ACCESS_TYPES,
      required: true,
      immutable: true,
    },

    amountMinor: {
      type: Number,
      min: 0,
      required: true,
      immutable: true,
    },

    currency: {
      type: String,
      trim: true,
      uppercase: true,
      minlength: 3,
      maxlength: 3,
      required: true,
      immutable: true,
    },

    idempotencyKey: {
      type: String,
      trim: true,
      maxlength: 180,
      required: true,
      immutable: true,
    },

    provider: {
      type: String,
      enum: [
        'none',
        'razorpay',
      ],
      required: true,
      default: 'none',
    },

    providerOrderId: {
      type: String,
      trim: true,
      maxlength: 240,
      default: '',
    },

    providerPaymentId: {
      type: String,
      trim: true,
      maxlength: 240,
      default: '',
    },

    entitlementId: {
      type: objectId,
      ref: 'CourseEntitlement',
      default: null,
    },

    confirmedAt: {
      type: Date,
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    attendedAt: {
      type: Date,
      default: null,
    },

    refundReviewRequiredAt: {
      type: Date,
      default: null,
    },
  },
  {
    ...baseOptions,

    collection:
      'creatorSessionBookings',
  },
)

creatorSessionBookingSchema.index(
  {
    sessionId: 1,
    customerUserId: 1,
  },
  {
    unique: true,

    name:
      'creator_session_customer_unique',
  },
)

creatorSessionBookingSchema.index(
  {
    customerUserId: 1,
    idempotencyKey: 1,
  },
  {
    unique: true,

    name:
      'creator_booking_idempotency_unique',
  },
)

const creatorSessionEventSchema = new Schema(
  {
    sessionId: {
      type: objectId,
      ref: 'CreatorSession',
      required: true,
      index: true,
      immutable: true,
    },

    bookingId: {
      type: objectId,
      ref: 'CreatorSessionBooking',
      default: null,
      index: true,
      immutable: true,
    },

    actorType: {
      type: String,
      enum: [
        'customer',
        'creator',
        'system',
        'payment_provider',
      ],
      required: true,
      immutable: true,
    },

    actorUserId: {
      type: objectId,
      ref: 'User',
      default: null,
      immutable: true,
    },

    eventType: {
      type: String,
      enum: [
        'session_created',
        'session_published',
        'session_cancelled',
        'session_completed',
        'seat_reserved',
        'payment_order_created',
        'payment_signature_verified',
        'booking_confirmed',
        'booking_cancelled',
        'refund_review_required',
        'attendance_recorded',
      ],
      required: true,
      index: true,
      immutable: true,
    },

    reason: {
      type: String,
      trim: true,
      maxlength: 4000,
      required: true,
      immutable: true,
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
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
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },

    strict: true,
    minimize: false,
    versionKey: false,

    collection:
      'creatorSessionEvents',
  },
)

protectAppendOnly(
  creatorSessionEventSchema,
  'Creator session event',
)

const creatorPaymentEvidenceSchema = new Schema(
  {
    bookingId: {
      type: objectId,
      ref: 'CreatorSessionBooking',
      required: true,
      unique: true,
      index: true,
      immutable: true,
    },

    customerUserId: {
      type: objectId,
      ref: 'User',
      required: true,
      index: true,
      immutable: true,
    },

    provider: {
      type: String,
      enum: [
        'razorpay',
      ],
      required: true,
      immutable: true,
    },

    providerOrderId: {
      type: String,
      trim: true,
      maxlength: 240,
      required: true,
      immutable: true,
    },

    providerPaymentId: {
      type: String,
      trim: true,
      maxlength: 240,
      required: true,
      immutable: true,
    },

    amountMinor: {
      type: Number,
      min: 1,
      required: true,
      immutable: true,
    },

    currency: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 3,
      required: true,
      immutable: true,
    },

    checkoutSignatureVerified: {
      type: Boolean,
      required: true,
      default: true,
      immutable: true,
    },

    settlementOrCreatorPayoutClaimed: {
      type: Boolean,
      required: true,
      default: false,
      immutable: true,
    },

    verifiedAt: {
      type: Date,
      required: true,
      default: Date.now,
      immutable: true,
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },

    strict: true,
    minimize: false,
    versionKey: false,

    collection:
      'creatorPaymentEvidence',
  },
)

protectAppendOnly(
  creatorPaymentEvidenceSchema,
  'Creator payment evidence',
)

export const SponsoredEligibilityEvidence =
  mongoose.models.SponsoredEligibilityEvidence ||
  mongoose.model(
    'SponsoredEligibilityEvidence',
    sponsoredEligibilityEvidenceSchema,
  )

export const CreatorSession =
  mongoose.models.CreatorSession ||
  mongoose.model(
    'CreatorSession',
    creatorSessionSchema,
  )

export const CreatorSessionBooking =
  mongoose.models.CreatorSessionBooking ||
  mongoose.model(
    'CreatorSessionBooking',
    creatorSessionBookingSchema,
  )

export const CreatorSessionEvent =
  mongoose.models.CreatorSessionEvent ||
  mongoose.model(
    'CreatorSessionEvent',
    creatorSessionEventSchema,
  )

export const CreatorPaymentEvidence =
  mongoose.models.CreatorPaymentEvidence ||
  mongoose.model(
    'CreatorPaymentEvidence',
    creatorPaymentEvidenceSchema,
  )