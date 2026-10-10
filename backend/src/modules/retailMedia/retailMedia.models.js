import mongoose from 'mongoose'

const { Schema } = mongoose
const objectId = Schema.Types.ObjectId

export const RETAIL_MEDIA_CAMPAIGN_STATUSES = Object.freeze([
  'pending_review',
  'approved',
  'active',
  'paused',
  'rejected',
  'ended',
])

export const RETAIL_MEDIA_PLACEMENTS = Object.freeze([
  'home',
  'search',
  'recipe',
  'product_detail',
  'pantry_replenishment',
  'basket_compare',
  'post_purchase',
])

export const RETAIL_MEDIA_PLACEMENT_SLOTS = Object.freeze({
  home: Object.freeze([
    Object.freeze({ key: 'hero', label: 'Hero section' }),
    Object.freeze({ key: 'explore_epantry', label: 'Explore EPANTRY' }),
    Object.freeze({ key: 'featured_content', label: 'Featured content' }),
  ]),
  search: Object.freeze([
    Object.freeze({ key: 'search_top', label: 'Top of search results' }),
    Object.freeze({ key: 'search_best_match', label: 'After best match' }),
    Object.freeze({ key: 'search_more_options', label: 'Before more options' }),
  ]),
  recipe: Object.freeze([
    Object.freeze({ key: 'recipe_hero', label: 'Recipe hero' }),
    Object.freeze({ key: 'recipe_collection', label: 'Recipe collection' }),
    Object.freeze({ key: 'recipe_restaurants', label: 'Restaurant recipes' }),
  ]),
  product_detail: Object.freeze([
    Object.freeze({ key: 'product_overview', label: 'Product overview' }),
    Object.freeze({ key: 'product_details', label: 'Product details' }),
    Object.freeze({ key: 'product_recommendations', label: 'Product recommendations' }),
  ]),
  pantry_replenishment: Object.freeze([
    Object.freeze({ key: 'pantry_header', label: 'Next Basket header' }),
    Object.freeze({ key: 'pantry_steps', label: 'How this page works' }),
    Object.freeze({ key: 'pantry_suggestions', label: 'Shopping suggestions' }),
  ]),
  basket_compare: Object.freeze([
    Object.freeze({ key: 'basket_compare_header', label: 'Compare header' }),
    Object.freeze({ key: 'basket_compare_results', label: 'Comparison results' }),
    Object.freeze({ key: 'basket_compare_checkout', label: 'Before checkout options' }),
  ]),
  post_purchase: Object.freeze([
    Object.freeze({ key: 'post_purchase_summary', label: 'Order summary' }),
    Object.freeze({ key: 'post_purchase_items', label: 'Order items' }),
    Object.freeze({ key: 'post_purchase_follow_up', label: 'After-order actions' }),
  ]),
})

export const RETAIL_MEDIA_SLOT_KEYS = Object.freeze(
  Object.values(RETAIL_MEDIA_PLACEMENT_SLOTS)
    .flat()
    .map((slot) => slot.key),
)

export const RETAIL_MEDIA_SPONSOR_LABELS = Object.freeze([
  'Sponsored',
  'Ad',
  'Paid placement',
])

export const RETAIL_MEDIA_PAYMENT_STATUSES = Object.freeze([
  'unpaid',
  'initiated',
  'paid',
])

export const RETAIL_MEDIA_DURATION_MINUTES = Object.freeze([
  240,
  720,
  1440,
  4320,
  10080,
  20160,
  43200,
])

const baseOptions = Object.freeze({
  timestamps: true,
  strict: true,
  minimize: false,
  versionKey: false,
})

const creativeSchema = new Schema(
  {
    headline: {
      type: String,
      trim: true,
      maxlength: 180,
      required: true,
    },

    body: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },

    landingRef: {
      type: String,
      trim: true,
      maxlength: 500,
      required: true,
    },

    sponsorLabel: {
      type: String,
      enum: RETAIL_MEDIA_SPONSOR_LABELS,
      required: true,
      default: 'Sponsored',
    },

    imageUrl: {
      type: String,
      trim: true,
      maxlength: 1200,
      default: '',
    },
  },
  {
    _id: false,
    strict: true,
  },
)

const placementChargeSchema = new Schema(
  {
    placement: {
      type: String,
      enum: RETAIL_MEDIA_PLACEMENTS,
      required: true,
    },

    amountMinor: {
      type: Number,
      min: 0,
      required: true,
    },
  },
  {
    _id: false,
    strict: true,
  },
)

const placementSelectionSchema = new Schema(
  {
    placement: {
      type: String,
      enum: RETAIL_MEDIA_PLACEMENTS,
      required: true,
    },

    slotKey: {
      type: String,
      enum: RETAIL_MEDIA_SLOT_KEYS,
      required: true,
    },

    slotLabel: {
      type: String,
      trim: true,
      maxlength: 120,
      required: true,
    },
  },
  {
    _id: false,
    strict: true,
  },
)

const campaignPaymentSchema = new Schema(
  {
    status: {
      type: String,
      enum: RETAIL_MEDIA_PAYMENT_STATUSES,
      required: true,
      default: 'unpaid',
      index: true,
    },

    provider: {
      type: String,
      enum: ['razorpay'],
      required: true,
      default: 'razorpay',
    },

    providerMode: {
      type: String,
      enum: ['test', 'live', 'unknown'],
      required: true,
      default: 'unknown',
    },

    currency: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 3,
      required: true,
      default: 'INR',
    },

    requiredAmountMinor: {
      type: Number,
      min: 0,
      required: true,
      default: 0,
    },

    placementCharges: {
      type: [placementChargeSchema],
      default: [],
    },

    providerOrderId: {
      type: String,
      trim: true,
      maxlength: 180,
      default: '',
    },

    providerPaymentId: {
      type: String,
      trim: true,
      maxlength: 180,
      default: '',
    },

    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: false,
    strict: true,
  },
)

const reviewSchema = new Schema(
  {
    decision: {
      type: String,
      enum: [
        'pending',
        'approved',
        'rejected',
      ],
      required: true,
      default: 'pending',
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
    _id: false,
    strict: true,
  },
)

const campaignSchema = new Schema(
  {
    sourceHostCampaignBriefId: {
      type: objectId,
      ref: 'HostCampaignBrief',
      required: true,
      unique: true,
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

    brandId: {
      type: objectId,
      ref: 'Brand',
      default: null,
      index: true,
      immutable: true,
    },

    authorityGrantId: {
      type: objectId,
      ref: 'BrandAuthorityGrant',
      default: null,
      immutable: true,
    },

    title: {
      type: String,
      trim: true,
      maxlength: 220,
      required: true,
    },

    objective: {
      type: String,
      enum: [
        'awareness',
        'consideration',
        'conversion',
        'sampling',
        'promotion',
      ],
      required: true,
    },

    marketCodes: {
      type: [String],
      required: true,
      default: ['IN'],
    },

    placements: {
      type: [String],
      enum: RETAIL_MEDIA_PLACEMENTS,
      required: true,
      default: [],
    },

    placementSelections: {
      type: [placementSelectionSchema],
      required: true,
      default: [],
    },

    durationMinutes: {
      type: Number,
      enum: RETAIL_MEDIA_DURATION_MINUTES,
      required: true,
      default: 1440,
    },

    startsAt: {
      type: Date,
      default: null,
      index: true,
    },

    endsAt: {
      type: Date,
      default: null,
      index: true,
    },

    scheduledStartsAt: {
      type: Date,
      default: null,
      index: true,
    },

    scheduledEndsAt: {
      type: Date,
      default: null,
      index: true,
    },

    reservationHeldUntil: {
      type: Date,
      default: null,
      index: true,
    },

    budget: {
      dailyAmountMinor: {
        type: Number,
        min: 0,
        default: 0,
      },

      lifetimeAmountMinor: {
        type: Number,
        min: 0,
        default: 0,
      },

      currency: {
        type: String,
        trim: true,
        uppercase: true,
        maxlength: 3,
        default: 'INR',
      },
    },

    bidMinor: {
      type: Number,
      min: 0,
      max: 1000000,
      required: true,
      default: 0,
    },

    qualityScore: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
      default: 50,
    },

    promotedEntityType: {
      type: String,
      enum: [
        'product',
        'brand',
        'recipe',
        'generic',
      ],
      required: true,
      default: 'generic',
      index: true,
    },

    promotedEntityId: {
      type: String,
      trim: true,
      maxlength: 240,
      default: '',
    },

    contextualTags: {
      type: [String],
      default: [],
    },

    frequencyCapPerContext: {
      type: Number,
      min: 1,
      max: 50,
      required: true,
      default: 3,
    },

    creative: {
      type: creativeSchema,
      required: true,
    },

    commercialDisclosure: {
      type: String,
      trim: true,
      maxlength: 2000,
      required: true,
    },

    status: {
      type: String,
      enum: RETAIL_MEDIA_CAMPAIGN_STATUSES,
      required: true,
      default: 'pending_review',
      index: true,
    },

    review: {
      type: reviewSchema,
      required: true,
      default: () => ({
        decision: 'pending',
      }),
    },

    payment: {
      type: campaignPaymentSchema,
      required: true,
      default: () => ({
        status: 'unpaid',
        provider: 'razorpay',
        providerMode: 'unknown',
        currency: 'INR',
        requiredAmountMinor: 0,
        placementCharges: [],
      }),
    },

    createdByUserId: {
      type: objectId,
      ref: 'User',
      required: true,
    },

    activatedAt: {
      type: Date,
      default: null,
    },

    pausedAt: {
      type: Date,
      default: null,
    },
  },
  {
    ...baseOptions,
    collection: 'campaigns',
  },
)

campaignSchema.index({
  organizationId: 1,
  status: 1,
  createdAt: -1,
})

campaignSchema.index({
  status: 1,
  placements: 1,
  startsAt: 1,
  endsAt: 1,
})

campaignSchema.index({
  status: 1,
  marketCodes: 1,
  startsAt: 1,
  endsAt: 1,
})

campaignSchema.index({
  'placementSelections.placement': 1,
  'placementSelections.slotKey': 1,
  scheduledStartsAt: 1,
  scheduledEndsAt: 1,
})

campaignSchema.pre(
  'validate',
  function validateCampaignWindow(next) {
    if (
      this.startsAt &&
      this.endsAt &&
      this.endsAt <= this.startsAt
    ) {
      this.invalidate(
        'endsAt',
        'Campaign end must be after campaign start.',
      )
    }

    if (
      this.budget?.dailyAmountMinor > 0 &&
      this.budget?.lifetimeAmountMinor > 0 &&
      this.budget.dailyAmountMinor > this.budget.lifetimeAmountMinor
    ) {
      this.invalidate(
        'budget.dailyAmountMinor',
        'Daily budget cannot exceed lifetime budget.',
      )
    }

    next()
  },
)

const adDecisionLogSchema = new Schema(
  {
    campaignId: {
      type: objectId,
      ref: 'Campaign',
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

    placement: {
      type: String,
      enum: RETAIL_MEDIA_PLACEMENTS,
      required: true,
      immutable: true,
      index: true,
    },

    slotKey: {
      type: String,
      enum: ['', ...RETAIL_MEDIA_SLOT_KEYS],
      default: '',
      immutable: true,
      index: true,
    },

    marketCode: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 10,
      required: true,
      immutable: true,
    },

    contextFingerprint: {
      type: String,
      trim: true,
      maxlength: 128,
      required: true,
      immutable: true,
      index: true,
    },

    promotedEntityType: {
      type: String,
      enum: [
        'product',
        'brand',
        'recipe',
        'generic',
      ],
      default: 'generic',
      immutable: true,
    },

    promotedEntityId: {
      type: String,
      trim: true,
      maxlength: 240,
      default: '',
      immutable: true,
    },

    outcome: {
      type: String,
      enum: [
        'served',
        'suppressed',
        'no_eligible_campaign',
      ],
      required: true,
      immutable: true,
      index: true,
    },

    reasonCodes: {
      type: [String],
      required: true,
      default: [],
      immutable: true,
    },

    sponsorLabel: {
      type: String,
      enum: RETAIL_MEDIA_SPONSOR_LABELS,
      default: 'Sponsored',
      immutable: true,
    },

    sponsoredRankScore: {
      type: Number,
      default: null,
      immutable: true,
    },

    organicAlternativeRequired: {
      type: Boolean,
      required: true,
      default: true,
      immutable: true,
    },

    safetySeparation: {
      hardConstraintsEvaluatedBeforePaidRanking: {
        type: Boolean,
        required: true,
        default: true,
        immutable: true,
      },

      sensitiveTargetingUsed: {
        type: Boolean,
        required: true,
        default: false,
        immutable: true,
      },

      productOrRecipeServingSuppressedWithoutSafetyEligibility: {
        type: Boolean,
        required: true,
        default: true,
        immutable: true,
      },
    },

    decidedAt: {
      type: Date,
      required: true,
      default: Date.now,
      immutable: true,
      index: true,
    },
  },
  {
    ...baseOptions,
    collection: 'adDecisionLogs',
  },
)

adDecisionLogSchema.index({
  campaignId: 1,
  contextFingerprint: 1,
  decidedAt: -1,
})

function protectAppendOnlyModel(schema) {
  for (const operation of [
    'updateOne',
    'updateMany',
    'findOneAndUpdate',
    'replaceOne',
    'deleteOne',
    'deleteMany',
    'findOneAndDelete',
  ]) {
    schema.pre(operation, function rejectMutation(next) {
      next(
        new Error(
          'Ad decision evidence is append-only and cannot be mutated or deleted.',
        ),
      )
    })
  }
}

protectAppendOnlyModel(adDecisionLogSchema)

export const Campaign =
  mongoose.models.Campaign ||
  mongoose.model(
    'Campaign',
    campaignSchema,
  )

export const AdDecisionLog =
  mongoose.models.AdDecisionLog ||
  mongoose.model(
    'AdDecisionLog',
    adDecisionLogSchema,
  )