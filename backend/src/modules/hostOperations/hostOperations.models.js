import mongoose from 'mongoose'

const { Schema } = mongoose
const objectId = Schema.Types.ObjectId

export const HOST_OPERATIONAL_ACTIVATION_STATES = Object.freeze([
  'onboarding',
  'pending_review',
  'active',
  'suspended',
])

export const HOST_KYB_STATUSES = Object.freeze([
  'draft',
  'submitted',
  'needs_information',
  'approved',
  'rejected',
])

export const HOST_ORG_MEMBER_STATUSES = Object.freeze([
  'active',
  'disabled',
])

export const HOST_COMMERCIAL_PROFILE_TYPES = Object.freeze([
  'seller',
  'brand',
  'b2b',
  'hybrid',
])

export const HOST_COMMERCIAL_PROFILE_REQUEST_STATUSES = Object.freeze([
  'declared',
  'reviewed',
])

export const HOST_ORG_PERMISSION_KEYS = Object.freeze([
  'organization.read',
  'organization.manage',
  'kyb.read',
  'kyb.manage',
  'catalog.read',
  'catalog.ingest',
  'pricing.read',
  'pricing.manage',
  'inventory.read',
  'inventory.manage',
  'orders.read',
  'orders.manage',
  'finance.read',
  'recipes.read',
  'recipes.submit',
  'campaigns.read',
  'campaigns.manage',
  'documents.read',
  'documents.manage',
  'team.read',
  'team.manage',
  'api.read',
  'api.manage',
])

export const HOST_CATALOG_IMPORT_STATUSES = Object.freeze([
  'completed',
  'completed_with_issues',
])

export const HOST_CATALOG_ROW_STATES = Object.freeze([
  'canonical_match',
  'needs_npi',
  'invalid',
])

export const HOST_BRAND_RECIPE_SUBMISSION_STATUSES = Object.freeze([
  'submitted',
  'accepted_for_governance',
  'changes_requested',
  'rejected',
])

export const HOST_CAMPAIGN_BRIEF_STATUSES = Object.freeze([
  'draft',
  'submitted_for_future_media_review',
  'withdrawn',
])

const hostCommercialProfileRequestSchema = new Schema(
  {
    organizationId: {
      type: objectId,
      ref: 'MarketplaceOrganization',
      required: true,
      index: true,
    },

    requestedByUserId: {
      type: objectId,
      ref: 'User',
      required: true,
      index: true,
    },

    organizationType: {
      type: String,
      enum: HOST_COMMERCIAL_PROFILE_TYPES,
      required: true,
      index: true,
    },

    previousOrganizationType: {
      type: String,
      enum: HOST_COMMERCIAL_PROFILE_TYPES,
      default: null,
    },

    note: {
      type: String,
      trim: true,
      maxlength: 1200,
      default: '',
    },

    status: {
      type: String,
      enum: HOST_COMMERCIAL_PROFILE_REQUEST_STATUSES,
      default: 'declared',
      required: true,
      index: true,
    },

    notifiedAdminUserIds: {
      type: [objectId],
      ref: 'User',
      default: [],
    },
  },
  {
    timestamps: true,
    strict: true,
    minimize: false,
    versionKey: false,
    collection: 'hostCommercialProfileRequests',
  },
)

hostCommercialProfileRequestSchema.index({
  organizationId: 1,
  createdAt: -1,
})

const baseOptions = Object.freeze({
  timestamps: true,
  strict: true,
  minimize: false,
  versionKey: false,
})

const addressSchema = new Schema(
  {
    line1: {
      type: String,
      trim: true,
      maxlength: 240,
      default: '',
    },

    line2: {
      type: String,
      trim: true,
      maxlength: 240,
      default: '',
    },

    city: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },

    state: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },

    postalCode: {
      type: String,
      trim: true,
      maxlength: 24,
      default: '',
    },

    countryCode: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 2,
      default: 'IN',
    },
  },
  {
    _id: false,
  },
)

const hostOperationalProfileSchema = new Schema(
  {
    organizationId: {
      type: objectId,
      ref: 'MarketplaceOrganization',
      required: true,
      unique: true,
      index: true,
    },

    activationState: {
      type: String,
      enum: HOST_OPERATIONAL_ACTIVATION_STATES,
      required: true,
      default: 'onboarding',
      index: true,
    },

    legalEntityName: {
      type: String,
      trim: true,
      maxlength: 240,
      default: '',
    },

    businessType: {
      type: String,
      enum: [
        'proprietorship',
        'partnership',
        'llp',
        'private_limited',
        'public_limited',
        'other',
      ],
      default: 'other',
    },

    jurisdictionCountryCode: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 2,
      default: 'IN',
    },

    registeredAddress: {
      type: addressSchema,
      default: () => ({}),
    },

    supportEmail: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 254,
      default: '',
    },

    supportPhone: {
      type: String,
      trim: true,
      maxlength: 32,
      default: '',
    },

    commercial: {
      settlementCurrency: {
        type: String,
        trim: true,
        uppercase: true,
        maxlength: 3,
        default: 'INR',
      },

      fulfillmentTypes: {
        type: [
          String,
        ],
        enum: [
          'delivery',
          'pickup',
        ],
        default: [],
      },

      cancellationPolicySummary: {
        type: String,
        trim: true,
        maxlength: 1200,
        default: '',
      },

      returnPolicySummary: {
        type: String,
        trim: true,
        maxlength: 1200,
        default: '',
      },

      commercialSetupComplete: {
        type: Boolean,
        required: true,
        default: false,
      },
    },

    activationReview: {
      requestedAt: {
        type: Date,
        default: null,
      },

      reviewedAt: {
        type: Date,
        default: null,
      },

      reviewedByUserId: {
        type: objectId,
        ref: 'User',
        default: null,
      },

      reason: {
        type: String,
        trim: true,
        maxlength: 4000,
        default: '',
      },

      testOrderReference: {
        type: String,
        trim: true,
        maxlength: 240,
        default: '',
      },
    },

    createdByUserId: {
      type: objectId,
      ref: 'User',
      default: null,
    },

    updatedByUserId: {
      type: objectId,
      ref: 'User',
      default: null,
    },
  },
  {
    ...baseOptions,
    collection: 'hostOperationalProfiles',
  },
)

const hostOrganizationMemberSchema = new Schema(
  {
    organizationId: {
      type: objectId,
      ref: 'MarketplaceOrganization',
      required: true,
      index: true,
    },

    userId: {
      type: objectId,
      ref: 'User',
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: HOST_ORG_MEMBER_STATUSES,
      required: true,
      default: 'active',
      index: true,
    },

    roleLabel: {
      type: String,
      trim: true,
      maxlength: 120,
      default: 'Staff',
    },

    permissionKeys: {
      type: [
        {
          type: String,
          enum: HOST_ORG_PERMISSION_KEYS,
        },
      ],
      required: true,
      default: [],
    },

    invitedByUserId: {
      type: objectId,
      ref: 'User',
      default: null,
    },

    createdByUserId: {
      type: objectId,
      ref: 'User',
      default: null,
    },

    updatedByUserId: {
      type: objectId,
      ref: 'User',
      default: null,
    },
  },
  {
    ...baseOptions,
    collection: 'orgMembers',
  },
)

hostOrganizationMemberSchema.index(
  {
    organizationId: 1,
    userId: 1,
  },
  {
    unique: true,
    name: 'host_org_member_unique_user',
  },
)

const hostOrganizationDocumentSchema = new Schema(
  {
    organizationId: {
      type: objectId,
      ref: 'MarketplaceOrganization',
      required: true,
      index: true,
    },

    documentType: {
      type: String,
      enum: [
        'incorporation',
        'tax_registration',
        'food_license',
        'bank_proof',
        'authorization_letter',
        'identity',
        'address',
        'other',
      ],
      required: true,
      index: true,
    },

    label: {
      type: String,
      trim: true,
      maxlength: 220,
      required: true,
    },

    providerKey: {
      type: String,
      trim: true,
      maxlength: 80,
      default: '',
    },

    providerAssetId: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },

    originalFileName: {
      type: String,
      trim: true,
      maxlength: 300,
      default: '',
    },

    mimeType: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },

    bytes: {
      type: Number,
      min: 0,
      default: 0,
    },

    checksumSha256: {
      type: String,
      trim: true,
      maxlength: 64,
      default: '',
    },

    status: {
      type: String,
      enum: [
        'registered',
        'accepted',
        'rejected',
        'expired',
      ],
      required: true,
      default: 'registered',
      index: true,
    },

    expiresAt: {
      type: Date,
      default: null,
    },

    createdByUserId: {
      type: objectId,
      ref: 'User',
      default: null,
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

    reviewReason: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: '',
    },
  },
  {
    ...baseOptions,
    collection: 'organizationDocuments',
  },
)

hostOrganizationDocumentSchema.index({
  organizationId: 1,
  documentType: 1,
  createdAt: -1,
})

const hostKybCaseSchema = new Schema(
  {
    organizationId: {
      type: objectId,
      ref: 'MarketplaceOrganization',
      required: true,
      unique: true,
      index: true,
    },

    status: {
      type: String,
      enum: HOST_KYB_STATUSES,
      required: true,
      default: 'draft',
      index: true,
    },

    legalEntityName: {
      type: String,
      trim: true,
      maxlength: 240,
      required: true,
    },

    businessType: {
      type: String,
      enum: [
        'proprietorship',
        'partnership',
        'llp',
        'private_limited',
        'public_limited',
        'other',
      ],
      required: true,
    },

    jurisdictionCountryCode: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 2,
      default: 'IN',
    },

    taxRegistration: {
      registrationType: {
        type: String,
        trim: true,
        uppercase: true,
        maxlength: 40,
        default: '',
      },

      last4: {
        type: String,
        trim: true,
        maxlength: 4,
        default: '',
      },

      fingerprintSha256: {
        type: String,
        trim: true,
        maxlength: 64,
        default: '',
      },
    },

    documentIds: [
      {
        type: objectId,
        ref: 'HostOrganizationDocument',
      },
    ],

    submittedAt: {
      type: Date,
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    reviewedByUserId: {
      type: objectId,
      ref: 'User',
      default: null,
    },

    reviewReason: {
      type: String,
      trim: true,
      maxlength: 4000,
      default: '',
    },

    createdByUserId: {
      type: objectId,
      ref: 'User',
      default: null,
    },

    updatedByUserId: {
      type: objectId,
      ref: 'User',
      default: null,
    },
  },
  {
    ...baseOptions,
    collection: 'kybCases',
  },
)

const hostCatalogIngestJobSchema = new Schema(
  {
    organizationId: {
      type: objectId,
      ref: 'MarketplaceOrganization',
      required: true,
      index: true,
    },

    sourceType: {
      type: String,
      enum: [
        'manual_bulk',
        'csv_normalized',
        'erp',
        'external_api',
      ],
      required: true,
      default: 'manual_bulk',
    },

    status: {
      type: String,
      enum: HOST_CATALOG_IMPORT_STATUSES,
      required: true,
      index: true,
    },

    rowCount: {
      type: Number,
      min: 0,
      required: true,
    },

    matchedCount: {
      type: Number,
      min: 0,
      required: true,
    },

    npiRequiredCount: {
      type: Number,
      min: 0,
      required: true,
    },

    invalidCount: {
      type: Number,
      min: 0,
      required: true,
    },

    averageDataQualityScore: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
      default: 0,
    },

    idempotencyKey: {
      type: String,
      trim: true,
      maxlength: 160,
      required: true,
    },

    createdByUserId: {
      type: objectId,
      ref: 'User',
      default: null,
    },
  },
  {
    ...baseOptions,
    collection: 'catalogIngestJobs',
  },
)

hostCatalogIngestJobSchema.index(
  {
    organizationId: 1,
    idempotencyKey: 1,
  },
  {
    unique: true,
    name: 'host_catalog_ingest_idempotency',
  },
)

const hostCatalogIngestRowSchema = new Schema(
  {
    organizationId: {
      type: objectId,
      ref: 'MarketplaceOrganization',
      required: true,
      index: true,
    },

    jobId: {
      type: objectId,
      ref: 'HostCatalogIngestJob',
      required: true,
      index: true,
    },

    rowNumber: {
      type: Number,
      min: 1,
      required: true,
    },

    merchantSku: {
      type: String,
      trim: true,
      maxlength: 180,
      default: '',
    },

    gtin: {
      type: String,
      trim: true,
      maxlength: 14,
      default: '',
    },

    requestedPackId: {
      type: objectId,
      ref: 'Pack',
      default: null,
    },

    matchedPackId: {
      type: objectId,
      ref: 'Pack',
      default: null,
      index: true,
    },

    matchedProductVersionId: {
      type: objectId,
      ref: 'ProductVersion',
      default: null,
    },

    state: {
      type: String,
      enum: HOST_CATALOG_ROW_STATES,
      required: true,
      index: true,
    },

    dataQualityScore: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
      default: 0,
    },

    recipeEligible: {
      type: Boolean,
      required: true,
      default: false,
    },

    issueCodes: {
      type: [
        String,
      ],
      default: [],
    },

    inputSnapshot: {
      type: Schema.Types.Mixed,
      default: {},
    },

    npiHandoff: {
      required: {
        type: Boolean,
        required: true,
        default: false,
      },

      nextPath: {
        type: String,
        trim: true,
        maxlength: 300,
        default: '',
      },

      reason: {
        type: String,
        trim: true,
        maxlength: 600,
        default: '',
      },
    },
  },
  {
    ...baseOptions,
    collection: 'catalogIngestRows',
  },
)

hostCatalogIngestRowSchema.index(
  {
    organizationId: 1,
    jobId: 1,
    rowNumber: 1,
  },
  {
    unique: true,
  },
)

const hostBrandRecipeSubmissionSchema = new Schema(
  {
    organizationId: {
      type: objectId,
      ref: 'MarketplaceOrganization',
      required: true,
      index: true,
    },

    brandId: {
      type: objectId,
      ref: 'Brand',
      required: true,
      index: true,
    },

    authorityGrantId: {
      type: objectId,
      ref: 'BrandAuthorityGrant',
      required: true,
      index: true,
    },

    marketCode: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 2,
      required: true,
    },

    dishId: {
      type: objectId,
      ref: 'Dish',
      required: true,
      index: true,
    },

    recipeVersionId: {
      type: objectId,
      ref: 'RecipeVersion',
      required: true,
      unique: true,
      index: true,
    },

    status: {
      type: String,
      enum: HOST_BRAND_RECIPE_SUBMISSION_STATUSES,
      required: true,
      default: 'submitted',
      index: true,
    },

    nominationDisclosure: {
      type: String,
      trim: true,
      maxlength: 2000,
      required: true,
    },

    nominatedProductPackIds: [
      {
        type: objectId,
        ref: 'Pack',
      },
    ],

    submittedByUserId: {
      type: objectId,
      ref: 'User',
      required: true,
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

    reviewReason: {
      type: String,
      trim: true,
      maxlength: 4000,
      default: '',
    },
  },
  {
    ...baseOptions,
    collection: 'brandRecipeSubmissions',
  },
)

const hostCampaignBriefSchema = new Schema(
  {
    organizationId: {
      type: objectId,
      ref: 'MarketplaceOrganization',
      required: true,
      index: true,
    },

    brandId: {
      type: objectId,
      ref: 'Brand',
      default: null,
      index: true,
    },

    authorityGrantId: {
      type: objectId,
      ref: 'BrandAuthorityGrant',
      default: null,
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
      type: [
        String,
      ],
      default: [
        'IN',
      ],
    },

    requestedPlacements: {
      type: [
        String,
      ],
      default: [],
    },

    startsAt: {
      type: Date,
      default: null,
    },

    endsAt: {
      type: Date,
      default: null,
    },

    budget: {
      amountMinor: {
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

    promotedEntityType: {
      type: String,
      enum: [
        'product',
        'brand',
        'recipe',
        'generic',
      ],
      default: 'generic',
    },

    promotedEntityId: {
      type: String,
      trim: true,
      maxlength: 240,
      default: '',
    },

    commercialDisclosure: {
      type: String,
      trim: true,
      maxlength: 2000,
      required: true,
    },

    status: {
      type: String,
      enum: HOST_CAMPAIGN_BRIEF_STATUSES,
      required: true,
      default: 'draft',
      index: true,
    },

    createdByUserId: {
      type: objectId,
      ref: 'User',
      required: true,
    },

    submittedAt: {
      type: Date,
      default: null,
    },
  },
  {
    ...baseOptions,
    collection: 'hostCampaignBriefs',
  },
)

hostCampaignBriefSchema.pre(
  'validate',
  function validateCampaignWindow(
    next,
  ) {
    if (
      this.startsAt &&
      this.endsAt &&
      this.endsAt <=
        this.startsAt
    ) {
      this.invalidate(
        'endsAt',
        'Campaign end must be after campaign start.',
      )
    }

    next()
  },
)

export const HostOperationalProfile =
  mongoose.models.HostOperationalProfile ||
  mongoose.model(
    'HostOperationalProfile',
    hostOperationalProfileSchema,
  )

export const HostOrganizationMember =
  mongoose.models.HostOrganizationMember ||
  mongoose.model(
    'HostOrganizationMember',
    hostOrganizationMemberSchema,
  )

export const HostOrganizationDocument =
  mongoose.models.HostOrganizationDocument ||
  mongoose.model(
    'HostOrganizationDocument',
    hostOrganizationDocumentSchema,
  )

export const HostKybCase =
  mongoose.models.HostKybCase ||
  mongoose.model(
    'HostKybCase',
    hostKybCaseSchema,
  )

export const HostCatalogIngestJob =
  mongoose.models.HostCatalogIngestJob ||
  mongoose.model(
    'HostCatalogIngestJob',
    hostCatalogIngestJobSchema,
  )

export const HostCatalogIngestRow =
  mongoose.models.HostCatalogIngestRow ||
  mongoose.model(
    'HostCatalogIngestRow',
    hostCatalogIngestRowSchema,
  )

export const HostBrandRecipeSubmission =
  mongoose.models.HostBrandRecipeSubmission ||
  mongoose.model(
    'HostBrandRecipeSubmission',
    hostBrandRecipeSubmissionSchema,
  )

export const HostCampaignBrief =
  mongoose.models.HostCampaignBrief ||
  mongoose.model(
    'HostCampaignBrief',
    hostCampaignBriefSchema,
  )
export const HostCommercialProfileRequest =
  mongoose.models.HostCommercialProfileRequest ||
  mongoose.model(
    'HostCommercialProfileRequest',
    hostCommercialProfileRequestSchema,
  )
